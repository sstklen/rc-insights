// ========================================
// 核心健康分析邏輯
// 整合 API 資料、基準比對、趨勢偵測、異常偵測
// ========================================

import type {
  ChartData,
  ChartName,
  HealthReport,
  MetricHealth,
  Anomaly,
  OverviewMetric,
  HealthStatus,
  TrendDirection,
} from "../api/types.ts";
import { RevenueCatClient } from "../api/client.ts";
import { getBenchmark, evaluateAgainstBenchmark } from "./benchmarks.ts";
import { generateRecommendations } from "./recommendations.ts";
import { calculateQuickRatio } from "./quick-ratio.ts";
import { calculatePMFScore } from "./pmf-score.ts";
import { forecastMRR } from "./mrr-forecast.ts";
import { runScenarios } from "./scenario-engine.ts";
import { analyzeKeywords } from "./keyword-analysis.ts";
import { analyzeOfferings } from "./offering-analysis.ts";
import { createLLMClient } from "../intelligence/llm-client.ts";
import { SYSTEM_PROMPT, buildAnalysisPrompt, buildNextProductPrompt, buildAgentPlanPrompt } from "../intelligence/prompts.ts";
import type { LLMAnalysisContext } from "../intelligence/prompts.ts";
import { convertToEnhanced, generateFallbackNextProduct } from "../intelligence/fallback.ts";
import { generateExecutiveSummary } from "./executive-summary.ts";
import { analyzeFlywheel } from "./flywheel.ts";
import type { EnhancedRecommendation, FallbackNextProductSuggestion } from "../intelligence/fallback.ts";
import { daysAgo, today } from "../utils/formatting.ts";
import { logger } from "../utils/logger.ts";
import ora from "ora";

/** 分析需要取得的圖表清單 — 包含深層分析端點 */
const ANALYSIS_CHARTS: ChartName[] = [
  "mrr",
  "mrr_movement",         // 🔥 MRR 變動拆解（New/Churned/Expansion/Contraction）
  "arr",
  "churn",
  "trial_conversion_rate",
  "revenue",
  "actives",
  "subscription_status",  // 🔥 訂閱狀態（Set to Renew / Cancel / Billing Issue）
  "customers_new",
  "trials_new",
  "refund_rate",
  "ltv_per_customer",
  "ltv_per_paying_customer",
  "conversion_to_paying",
];

/** 指標 ID 對應到概覽中的欄位名稱（模糊匹配用） */
const OVERVIEW_METRIC_MAP: Record<string, string[]> = {
  mrr: ["mrr", "monthly_recurring_revenue"],
  arr: ["arr", "annual_recurring_revenue"],
  actives: ["active_subscribers", "actives"],
  churn: ["churn", "churn_rate"],
  trial_conversion_rate: ["trial_conversion", "trial_conversion_rate", "conversion_to_paying"],
  refund_rate: ["refund_rate", "refund"],
  ltv_per_customer: ["ltv_per_customer", "ltv", "lifetime_value"],
};

/**
 * 從概覽指標中尋找特定指標的值
 */
function findOverviewValue(overview: OverviewMetric[], metricId: string): OverviewMetric | undefined {
  const possibleNames = OVERVIEW_METRIC_MAP[metricId] ?? [metricId];
  return overview.find(
    (m) =>
      possibleNames.includes(m.id.toLowerCase()) ||
      possibleNames.some((name) => m.name.toLowerCase().includes(name)),
  );
}

/**
 * 計算月環比變化百分比
 * 從圖表資料的最近兩個月數據點推算
 * 只使用第一個量度（measure=0）的值，避免多量度圖表混亂
 */
function calculateMoMChange(chartData: ChartData): number {
  const measureIdx = getPrimaryMeasureIndex(chartData);
  const completeValues = chartData.values
    .filter((v) => !v.incomplete && v.measure === measureIdx)
    .sort((a, b) => a.cohort - b.cohort);

  if (completeValues.length < 2) return 0;

  const latest = completeValues[completeValues.length - 1];
  const previous = completeValues[completeValues.length - 2];

  if (!latest || !previous || previous.value === 0) return 0;

  return ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
}

/**
 * 偵測趨勢方向
 * 使用最近 3 個數據點判斷走勢
 */
function detectTrend(chartData: ChartData): TrendDirection {
  const measureIdx = getPrimaryMeasureIndex(chartData);
  const completeValues = chartData.values
    .filter((v) => !v.incomplete && v.measure === measureIdx)
    .sort((a, b) => a.cohort - b.cohort);

  if (completeValues.length < 3) return "stable";

  // 取最近 3 個數據點
  const recent = completeValues.slice(-3);
  const first = recent[0]!.value;
  const last = recent[recent.length - 1]!.value;

  if (first === 0) return "stable";

  const changeRate = ((last - first) / Math.abs(first)) * 100;

  // 超過 5% 視為成長/衰退，否則穩定
  if (changeRate > 5) return "growing";
  if (changeRate < -5) return "declining";
  return "stable";
}

/**
 * 偵測異常值
 * 標準：任一數據點變化超過前一點 30% 以上
 */
function detectAnomalies(chartData: ChartData, metricName: string): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const measureIdx = getPrimaryMeasureIndex(chartData);
  const completeValues = chartData.values
    .filter((v) => !v.incomplete && v.measure === measureIdx)
    .sort((a, b) => a.cohort - b.cohort);

  for (let i = 1; i < completeValues.length; i++) {
    const prev = completeValues[i - 1]!;
    const curr = completeValues[i]!;

    if (prev.value === 0) continue;

    const change = ((curr.value - prev.value) / Math.abs(prev.value)) * 100;

    if (Math.abs(change) > 30) {
      const date = new Date(curr.cohort * 1000).toISOString().slice(0, 10);
      anomalies.push({
        metric: metricName,
        type: change > 0 ? "spike" : "drop",
        date,
        magnitude: Math.abs(change),
        description: `${metricName} ${change > 0 ? "spiked" : "dropped"} ${Math.abs(change).toFixed(1)}% on ${date}`,
      });
    }
  }

  return anomalies;
}

/**
 * 判斷指標的單位
 */
function getUnitForMetric(metricId: string, overviewMetric?: OverviewMetric): string {
  if (overviewMetric?.unit) return overviewMetric.unit;

  const percentMetrics = ["churn", "trial_conversion_rate", "refund_rate", "conversion_to_paying"];
  if (percentMetrics.includes(metricId)) return "%";

  const dollarMetrics = ["mrr", "arr", "revenue", "ltv_per_customer", "ltv_per_paying_customer"];
  if (dollarMetrics.includes(metricId)) return "$";

  return "#";
}

/**
 * 找出圖表的主要量度索引
 * 優先使用 chartable=true 的量度；如果有多個，優先百分比量度
 * 例如 Churn 圖表有 Actives(#)/Churned(#)/Churn Rate(%) — 我們要 Churn Rate
 */
function getPrimaryMeasureIndex(chartData: ChartData): number {
  if (!chartData.measures || chartData.measures.length === 0) return 0;

  // 先找 chartable=true 且單位是 % 的（最有分析價值）
  const percentIdx = chartData.measures.findIndex(
    (m) => m.chartable && m.unit === "%",
  );
  if (percentIdx >= 0) return percentIdx;

  // 再找任何 chartable=true 的
  const chartableIdx = chartData.measures.findIndex((m) => m.chartable);
  if (chartableIdx >= 0) return chartableIdx;

  // 都沒有就用第一個
  return 0;
}

/**
 * 從圖表資料取得最新值
 * 自動選擇正確的量度（例如 Churn 取 Churn Rate 而不是 Actives 數量）
 */
function getLatestValue(chartData: ChartData): number {
  const measureIdx = getPrimaryMeasureIndex(chartData);
  const completeValues = chartData.values
    .filter((v) => !v.incomplete && v.measure === measureIdx)
    .sort((a, b) => b.cohort - a.cohort);

  return completeValues[0]?.value ?? 0;
}

/**
 * 執行完整健康分析
 * 這是主要的分析入口函式
 *
 * @param apiKey - RevenueCat API key
 * @param projectId - 專案 ID（可選，若未指定會自動偵測）
 * @returns 完整的健康報告
 */
export async function runHealthCheck(
  apiKey: string,
  projectId?: string,
): Promise<HealthReport> {
  const client = new RevenueCatClient(apiKey);

  // 步驟 1：確認專案
  let resolvedProjectId = projectId;
  let projectName = "Unknown Project";

  const projectSpinner = ora("Fetching project info...").start();
  try {
    const projects = await client.getProjects();

    if (projects.length === 0) {
      projectSpinner.fail("No projects found");
      throw new Error("No projects found in your RevenueCat account. Please create a project in the RevenueCat dashboard first.");
    }

    if (!resolvedProjectId) {
      // 自動使用第一個專案
      resolvedProjectId = projects[0]!.id;
      projectName = projects[0]!.name;
      projectSpinner.succeed(`Using project: ${projectName} (${resolvedProjectId})`);
    } else {
      const found = projects.find((p) => p.id === resolvedProjectId);
      if (found) {
        projectName = found.name;
        projectSpinner.succeed(`Using project: ${projectName}`);
      } else {
        projectSpinner.warn(`Project ID ${resolvedProjectId} not found in list, attempting to use directly`);
      }
    }
  } catch (err) {
    projectSpinner.fail("Failed to fetch project info");
    throw err;
  }

  // 步驟 2：取得概覽
  const overviewSpinner = ora("Fetching overview metrics...").start();
  let overview: OverviewMetric[] = [];
  try {
    const overviewData = await client.getOverview(resolvedProjectId);
    overview = overviewData.metrics;
    overviewSpinner.succeed(`Fetched ${overview.length} overview metrics`);
  } catch (err) {
    overviewSpinner.warn(`Failed to fetch overview metrics: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 3：取得圖表資料（最近 90 天，月解析度）
  const chartSpinner = ora(`Fetching ${ANALYSIS_CHARTS.length} charts (est. ~${Math.ceil(ANALYSIS_CHARTS.length * 4 / 60)} min)...`).start();
  const charts = await client.getCharts(resolvedProjectId, ANALYSIS_CHARTS, {
    start_date: daysAgo(90),
    end_date: today(),
    resolution: "month",
  });
  chartSpinner.succeed(`Fetched ${charts.size}/${ANALYSIS_CHARTS.length} charts`);

  // 步驟 4：分析每個指標
  const analysisSpinner = ora("Analyzing health metrics...").start();
  const metrics: MetricHealth[] = [];
  const allAnomalies: Anomaly[] = [];

  for (const [chartName, chartData] of charts) {
    const benchmark = getBenchmark(chartName);
    const overviewMetric = findOverviewValue(overview, chartName);
    // 從圖表量度定義取得正確單位
    const primaryIdx = getPrimaryMeasureIndex(chartData);
    const primaryMeasure = chartData.measures?.[primaryIdx];
    const unit = primaryMeasure?.unit ?? getUnitForMetric(chartName, overviewMetric);

    // 從圖表取主要量度的最新值（比概覽更精確，因為概覽可能是不同指標）
    const value = getLatestValue(chartData);
    const change = calculateMoMChange(chartData);
    const trend = detectTrend(chartData);

    // 健康狀態判定
    let status: HealthStatus = "yellow";
    let benchmarkValue = 0;
    let benchmarkLabel = "N/A";

    if (benchmark) {
      status = evaluateAgainstBenchmark(value, benchmark);
      benchmarkValue = benchmark.median;
      benchmarkLabel = benchmark.source;
    }

    metrics.push({
      metricId: chartName,
      name: chartData.display_name || chartName,
      value,
      unit,
      status,
      trend,
      changePercent: change,
      benchmark: benchmarkValue,
      benchmarkLabel,
    });

    // 偵測異常
    const anomalies = detectAnomalies(chartData, chartData.display_name || chartName);
    allAnomalies.push(...anomalies);
  }

  analysisSpinner.succeed(`Analysis complete: ${metrics.length} metrics, ${allAnomalies.length} anomalies`);

  // 步驟 5：產生建議
  const recSpinner = ora("Generating recommendations...").start();
  const recommendations = generateRecommendations(metrics, allAnomalies);
  recSpinner.succeed(`Generated ${recommendations.length} recommendations`);

  // 步驟 6：計算 Quick Ratio（從 mrr_movement 圖表）
  const mrrMovementChart = charts.get("mrr_movement");
  let quickRatioResult: import("./quick-ratio.ts").QuickRatioResult | undefined;
  if (mrrMovementChart) {
    try {
      quickRatioResult = calculateQuickRatio(mrrMovementChart);
      logger.debug(`Quick Ratio: ${quickRatioResult.current} (${quickRatioResult.grade})`);
    } catch (err) {
      logger.warn(`Failed to calculate Quick Ratio: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 步驟 7：計算 PMF Score（綜合 5 個指標）
  let pmfScoreResult: import("./pmf-score.ts").PMFScoreResult | undefined;
  try {
    // 從 metrics 陣列提取各指標最新值
    const trialConversionMetric = metrics.find((m) => m.metricId === "trial_conversion_rate");
    const churnMetric = metrics.find((m) => m.metricId === "churn");
    const revenueMetric = metrics.find((m) => m.metricId === "revenue");
    const ltvMetric = metrics.find((m) => m.metricId === "ltv_per_paying_customer");

    const trialConversionRate = trialConversionMetric?.value ?? 0;
    const monthlyChurnRate = churnMetric?.value ?? 0;
    const qr = quickRatioResult?.current ?? 0;
    // 用 MRR 的 MoM 變化（比 Revenue 更穩定，不受季節性單月暴漲暴跌影響）
    const mrrMetricForPMF = metrics.find((m) => m.metricId === "mrr");
    const revenueGrowthRate = mrrMetricForPMF?.changePercent ?? revenueMetric?.changePercent ?? 0;
    const ltvPerPayingCustomer = ltvMetric?.value ?? 0;

    pmfScoreResult = calculatePMFScore(
      trialConversionRate,
      monthlyChurnRate,
      qr,
      revenueGrowthRate,
      ltvPerPayingCustomer,
    );
    logger.debug(`PMF Score: ${pmfScoreResult.score}/100 (${pmfScoreResult.grade})`);
  } catch (err) {
    logger.warn(`Failed to calculate PMF Score: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 8：拉 12 個月歷史數據（MRR 預測 + 場景分析用）
  // 額外 2 次 API call（mrr + revenue），需要 ~8 秒
  const forecastSpinner = ora("Fetching 12-month history for MRR forecast (+2 API calls, ~8s)...").start();
  let mrrForecastResult: import("./mrr-forecast.ts").MRRForecastResult | undefined;
  let scenarioResult: import("./scenario-engine.ts").ScenarioAnalysisResult | undefined;
  try {
    const mrrLong = await client.getChart(resolvedProjectId, "mrr", {
      start_date: daysAgo(365),
      end_date: today(),
      resolution: "month",
    });
    const revenueLong = await client.getChart(resolvedProjectId, "revenue", {
      start_date: daysAgo(365),
      end_date: today(),
      resolution: "month",
    });
    forecastSpinner.succeed("Fetched 12-month history for MRR forecast");

    // 步驟 8a：MRR 預測
    const forecastCalcSpinner = ora("Calculating MRR forecast & scenarios...").start();
    try {
      mrrForecastResult = forecastMRR(mrrLong, revenueLong, 6);

      // 步驟 9：場景分析
      // 從已取得的指標中提取場景分析需要的參數
      const currentMRR = mrrForecastResult.currentMRR;
      const churnMetricForScenario = metrics.find((m) => m.metricId === "churn");
      const monthlyChurn = churnMetricForScenario?.value ?? 5.0; // 預設 5%

      // 從 mrr_movement 圖表提取新增 MRR（New MRR 通常是 measure=0）
      const mrrMovementForNew = charts.get("mrr_movement");
      let monthlyNewMRR = 0;
      if (mrrMovementForNew) {
        // mrr_movement 的第一個 measure 通常是 "New" MRR
        const newMRRValues = mrrMovementForNew.values
          .filter((v) => !v.incomplete && v.measure === 0)
          .sort((a, b) => b.cohort - a.cohort);
        monthlyNewMRR = newMRRValues[0]?.value ?? 0;
      }

      // 試用轉換率和新試用數
      const trialConvMetric = metrics.find((m) => m.metricId === "trial_conversion_rate");
      const trialsNewChart = charts.get("trials_new");
      const trialConversionRate = trialConvMetric?.value ?? 0;
      let monthlyNewTrials = 0;
      if (trialsNewChart) {
        const trialsValues = trialsNewChart.values
          .filter((v) => !v.incomplete && v.measure === 0)
          .sort((a, b) => b.cohort - a.cohort);
        monthlyNewTrials = trialsValues[0]?.value ?? 0;
      }

      scenarioResult = runScenarios(
        currentMRR,
        monthlyChurn,
        monthlyNewMRR,
        trialConversionRate,
        monthlyNewTrials,
      );

      forecastCalcSpinner.succeed(
        `MRR forecast: ${mrrForecastResult.predictions.length} months | ` +
        `Scenarios: ${scenarioResult.scenarios.length} (best: ${scenarioResult.bestScenario})`,
      );
    } catch (err) {
      forecastCalcSpinner.warn(`Failed to calculate forecast/scenarios: ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    forecastSpinner.warn(`Failed to fetch 12-month history: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 10：關鍵字歸因分析（額外 3 次 API call with segment）
  let keywordAnalysis: import("../api/types.ts").KeywordAnalysisResult | undefined;
  const kwSpinner = ora("Analyzing keyword performance...").start();
  try {
    keywordAnalysis = await analyzeKeywords(client, resolvedProjectId, {
      start_date: daysAgo(180),
      end_date: today(),
      resolution: "month",
    });
    kwSpinner.succeed(`Keyword analysis: ${keywordAnalysis.keywords.length} keywords found`);
  } catch (err) {
    kwSpinner.warn(`Keyword analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 11：Offering/Paywall 實驗分析（額外 3 次 API call with segment）
  let offeringAnalysis: import("../api/types.ts").OfferingAnalysisResult | undefined;
  const ofSpinner = ora("Analyzing offering performance...").start();
  try {
    offeringAnalysis = await analyzeOfferings(client, resolvedProjectId, {
      start_date: daysAgo(180),
      end_date: today(),
      resolution: "month",
    });
    ofSpinner.succeed(`Offering analysis: ${offeringAnalysis.offerings.length} offerings found`);
  } catch (err) {
    ofSpinner.warn(`Offering analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 12：LLM 智慧分析（如果有 API key 的話）
  let llmRecommendations: import("../api/types.ts").LLMRecommendationResult[] | undefined;
  let nextProductSuggestions: import("../api/types.ts").NextProductSuggestion[] | undefined;
  let agentPlan: import("../api/types.ts").AgentPlanResult | undefined;

  // 建構 LLM 上下文（不管有沒有 LLM 都需要，fallback 也用得到）
  const llmContext: LLMAnalysisContext = {
    appName: projectName,
    category: "Unknown", // 無法從 Charts API 自動偵測，未來可加 --category CLI 參數
    pricePoints: [], // 從 API 無法直接取得
    metrics: metrics.map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      status: m.status,
      benchmark: m.benchmark > 0 ? m.benchmark : undefined,
    })),
    quickRatio: quickRatioResult ? { value: quickRatioResult.current, grade: quickRatioResult.grade } : undefined,
    pmfScore: pmfScoreResult ? { score: pmfScoreResult.score, grade: pmfScoreResult.grade } : undefined,
    anomalies: allAnomalies.map((a) => ({
      metric: a.metric,
      type: a.type,
      date: a.date,
      magnitude: a.magnitude,
    })),
    keywords: keywordAnalysis?.keywords.slice(0, 10).map((k) => ({
      keyword: k.keyword,
      trials: k.totalTrials,
      revenue: k.totalRevenue,
    })),
    offerings: offeringAnalysis?.offerings.slice(0, 10).map((o) => ({
      name: o.offeringName,
      conversionRate: o.conversionRate ?? 0,
      revenue: o.revenue,
    })),
    mrrForecast: mrrForecastResult ? {
      currentMRR: mrrForecastResult.currentMRR,
      projectedMRR6m: mrrForecastResult.predictions[mrrForecastResult.predictions.length - 1]?.base ?? mrrForecastResult.currentMRR,
      trend: mrrForecastResult.monthlyGrowthRate > 0 ? "growing" : mrrForecastResult.monthlyGrowthRate < 0 ? "declining" : "flat",
    } : undefined,
  };

  const llmClient = createLLMClient();
  if (llmClient) {
    const llmSpinner = ora("Generating AI-powered insights (LLM)...").start();
    try {
      // 呼叫 LLM 取得增強建議
      const analysisPrompt = buildAnalysisPrompt(llmContext);
      const analysisResponse = await llmClient.generate(SYSTEM_PROMPT, analysisPrompt);
      const parsedRecs = JSON.parse(analysisResponse.content);
      if (parsedRecs.recommendations && Array.isArray(parsedRecs.recommendations)) {
        llmRecommendations = parsedRecs.recommendations.map((r: Record<string, unknown>) => ({
          ...r,
          source: "llm" as const,
        }));
      }

      // 呼叫 LLM 取得下一個產品建議
      const nextProductPrompt = buildNextProductPrompt(llmContext);
      const nextProductResponse = await llmClient.generate(SYSTEM_PROMPT, nextProductPrompt);
      const parsedNext = JSON.parse(nextProductResponse.content);
      if (parsedNext.suggestions && Array.isArray(parsedNext.suggestions)) {
        nextProductSuggestions = parsedNext.suggestions.map((s: Record<string, unknown>) => ({
          ...s,
          source: "llm" as const,
        }));
      }

      // 呼叫 LLM 取得 Agent 行動計畫
      const agentPrompt = buildAgentPlanPrompt(llmContext);
      const agentResponse = await llmClient.generate(SYSTEM_PROMPT, agentPrompt);
      const parsedAgent = JSON.parse(agentResponse.content);
      agentPlan = { ...parsedAgent, source: "llm" as const };

      llmSpinner.succeed(`AI insights generated (${analysisResponse.provider}/${analysisResponse.model}, ${analysisResponse.tokensUsed} tokens)`);
    } catch (err) {
      llmSpinner.warn(`LLM analysis failed, using rule engine fallback: ${err instanceof Error ? err.message : String(err)}`);
      // Fallback: 用規則引擎
      llmRecommendations = recommendations.map(convertToEnhanced);
      nextProductSuggestions = generateFallbackNextProduct(llmContext).map((s) => ({
        ...s,
        source: "rule_engine" as const,
      }));
    }
  } else {
    // 沒有 LLM API key → 用規則引擎
    logger.debug("No LLM API key found, using rule engine for enhanced recommendations");
    llmRecommendations = recommendations.map(convertToEnhanced);
    nextProductSuggestions = generateFallbackNextProduct(llmContext).map((s) => ({
      ...s,
      source: "rule_engine" as const,
    }));
  }

  // 步驟 13：Executive Summary（提煉關鍵洞見）
  const executiveSummary = generateExecutiveSummary({
    projectName,
    metrics,
    anomalies: allAnomalies,
    quickRatio: quickRatioResult,
    pmfScore: pmfScoreResult,
    mrrForecast: mrrForecastResult,
    scenarios: scenarioResult,
  });
  logger.debug(`Executive Summary: ${executiveSummary.healthGrade} (${executiveSummary.healthScore}/100)`);

  // 步驟 14：Flywheel 飛輪分析
  const flywheelResult = analyzeFlywheel({
    projectName,
    metrics,
    anomalies: allAnomalies,
    quickRatio: quickRatioResult,
    pmfScore: pmfScoreResult,
  });
  logger.debug(`Flywheel: ${flywheelResult.insights.length} insights (Layer ${flywheelResult.currentLayer})`);

  // 組裝報告
  const report: HealthReport = {
    projectName,
    projectId: resolvedProjectId,
    generatedAt: new Date().toISOString(),
    overview,
    metrics,
    anomalies: allAnomalies,
    recommendations,
    keywordAnalysis,
    offeringAnalysis,
    quickRatio: quickRatioResult,
    pmfScore: pmfScoreResult,
    mrrForecast: mrrForecastResult,
    scenarios: scenarioResult,
    llmRecommendations,
    nextProductSuggestions,
    agentPlan,
    executiveSummary,
    flywheel: flywheelResult,
  };

  logger.info(`Total API requests: ${client.getRequestCount()}`);

  return report;
}
