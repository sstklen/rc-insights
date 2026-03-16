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
import { daysAgo, today } from "../utils/formatting.ts";
import { logger } from "../utils/logger.ts";
import ora from "ora";

/** 分析需要取得的圖表清單 */
const ANALYSIS_CHARTS: ChartName[] = [
  "mrr",
  "arr",
  "churn",
  "trial_conversion_rate",
  "revenue",
  "actives",
  "customers_new",
  "trials_new",
  "refund_rate",
  "ltv_per_customer",
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
 */
function calculateMoMChange(chartData: ChartData): number {
  // 取出非 incomplete 的值，按時間排序
  const completeValues = chartData.values
    .filter((v) => !v.incomplete)
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
  const completeValues = chartData.values
    .filter((v) => !v.incomplete)
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
  const completeValues = chartData.values
    .filter((v) => !v.incomplete)
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
        description: `${metricName} 在 ${date} ${change > 0 ? "飆升" : "下跌"} ${Math.abs(change).toFixed(1)}%`,
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
 * 從圖表資料取得最新值
 */
function getLatestValue(chartData: ChartData): number {
  const completeValues = chartData.values
    .filter((v) => !v.incomplete)
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

  const projectSpinner = ora("取得專案資訊...").start();
  try {
    const projects = await client.getProjects();

    if (projects.length === 0) {
      projectSpinner.fail("找不到任何專案");
      throw new Error("你的 RevenueCat 帳號下沒有專案。請先在 RevenueCat 控制台建立專案。");
    }

    if (!resolvedProjectId) {
      // 自動使用第一個專案
      resolvedProjectId = projects[0]!.id;
      projectName = projects[0]!.name;
      projectSpinner.succeed(`使用專案: ${projectName} (${resolvedProjectId})`);
    } else {
      const found = projects.find((p) => p.id === resolvedProjectId);
      if (found) {
        projectName = found.name;
        projectSpinner.succeed(`使用專案: ${projectName}`);
      } else {
        projectSpinner.warn(`專案 ID ${resolvedProjectId} 未在列表中找到，嘗試直接使用`);
      }
    }
  } catch (err) {
    projectSpinner.fail("取得專案資訊失敗");
    throw err;
  }

  // 步驟 2：取得概覽
  const overviewSpinner = ora("取得概覽指標...").start();
  let overview: OverviewMetric[] = [];
  try {
    const overviewData = await client.getOverview(resolvedProjectId);
    overview = overviewData.metrics;
    overviewSpinner.succeed(`取得 ${overview.length} 個概覽指標`);
  } catch (err) {
    overviewSpinner.warn(`概覽指標取得失敗: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 步驟 3：取得圖表資料（最近 90 天，月解析度）
  const chartSpinner = ora(`取得 ${ANALYSIS_CHARTS.length} 個圖表資料（需要約 ${Math.ceil(ANALYSIS_CHARTS.length * 4 / 60)} 分鐘）...`).start();
  const charts = await client.getCharts(resolvedProjectId, ANALYSIS_CHARTS, {
    start_date: daysAgo(90),
    end_date: today(),
    resolution: "month",
  });
  chartSpinner.succeed(`成功取得 ${charts.size}/${ANALYSIS_CHARTS.length} 個圖表`);

  // 步驟 4：分析每個指標
  const analysisSpinner = ora("分析健康指標...").start();
  const metrics: MetricHealth[] = [];
  const allAnomalies: Anomaly[] = [];

  for (const [chartName, chartData] of charts) {
    const benchmark = getBenchmark(chartName);
    const overviewMetric = findOverviewValue(overview, chartName);
    const unit = getUnitForMetric(chartName, overviewMetric);

    // 優先使用概覽的值（較即時），沒有則從圖表取最新值
    const value = overviewMetric?.value ?? getLatestValue(chartData);
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
      name: chartName,
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

  analysisSpinner.succeed(`分析完成: ${metrics.length} 個指標, ${allAnomalies.length} 個異常`);

  // 步驟 5：產生建議
  const recSpinner = ora("產生建議...").start();
  const recommendations = generateRecommendations(metrics, allAnomalies);
  recSpinner.succeed(`產生 ${recommendations.length} 條建議`);

  // 組裝報告
  const report: HealthReport = {
    projectName,
    projectId: resolvedProjectId,
    generatedAt: new Date().toISOString(),
    overview,
    metrics,
    anomalies: allAnomalies,
    recommendations,
  };

  logger.info(`共發送 ${client.getRequestCount()} 次 API 請求`);

  return report;
}
