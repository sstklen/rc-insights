// ========================================
// Executive Summary 產生器
// 提煉整份報告的關鍵洞見，放在報告最上面
// ========================================

import type {
  MetricHealth,
  Anomaly,
  FlywheelInsight,
} from "../api/types.ts";
import type { QuickRatioResult } from "./quick-ratio.ts";
import type { PMFScoreResult } from "./pmf-score.ts";
import type { MRRForecastResult } from "./mrr-forecast.ts";
import type { ScenarioAnalysisResult } from "./scenario-engine.ts";
import { formatCurrency, formatPercent, formatByUnit } from "../utils/formatting.ts";
import { tMetric } from "../i18n/index.ts";

/** Executive Summary 結構 */
export interface ExecutiveSummary {
  /** 一句話結論 */
  headline: string;
  /** 健康分數（0-100，綜合所有指標） */
  healthScore: number;
  /** 健康等級 */
  healthGrade: "Excellent" | "Good" | "Fair" | "At Risk";
  /** 3-5 個關鍵洞見（按重要性排序） */
  keyInsights: Array<{
    icon: string;
    title: string;
    detail: string;
    urgency: "high" | "medium" | "low";
  }>;
  /** 一個最重要的行動建議 */
  topAction: {
    title: string;
    expectedImpact: string;
    reason: string;
  };
  /** 飛輪層級指示 */
  flywheelLevel: {
    current: number;
    label: string;
    nextUnlock: string;
  };
}

/**
 * 產生 Executive Summary
 * 從完整報告數據中提煉最重要的 3-5 個洞見
 */
export function generateExecutiveSummary(params: {
  projectName: string;
  metrics: MetricHealth[];
  anomalies: Anomaly[];
  quickRatio?: QuickRatioResult;
  pmfScore?: PMFScoreResult;
  mrrForecast?: MRRForecastResult;
  scenarios?: ScenarioAnalysisResult;
  flywheel?: { insights: FlywheelInsight[]; currentLayer: number };
}): ExecutiveSummary {
  const { metrics, anomalies, quickRatio, pmfScore, mrrForecast, scenarios } = params;

  // === 計算健康分數 ===
  const greenCount = metrics.filter((m) => m.status === "green").length;
  const yellowCount = metrics.filter((m) => m.status === "yellow").length;
  const redCount = metrics.filter((m) => m.status === "red").length;
  const total = metrics.length || 1;
  // 權重：green=100, yellow=50, red=0
  const healthScore = Math.round(((greenCount * 100 + yellowCount * 50) / total) * 10) / 10;
  const healthGrade: ExecutiveSummary["healthGrade"] =
    healthScore >= 80 ? "Excellent" :
    healthScore >= 60 ? "Good" :
    healthScore >= 40 ? "Fair" : "At Risk";

  // === 提煉關鍵洞見 ===
  const keyInsights: ExecutiveSummary["keyInsights"] = [];

  // 洞見 1：MRR 和 Quick Ratio 的組合判斷
  const mrrMetric = metrics.find((m) => m.metricId === "mrr");
  if (mrrMetric && quickRatio) {
    if (quickRatio.current >= 2.0) {
      keyInsights.push({
        icon: "🚀",
        title: `Strong Growth: QR ${quickRatio.current.toFixed(1)}x`,
        detail: `MRR ${formatCurrency(mrrMetric.value)} with Quick Ratio ${quickRatio.current.toFixed(2)} — revenue inflow significantly exceeds losses.`,
        urgency: "low",
      });
    } else if (quickRatio.current >= 1.0) {
      keyInsights.push({
        icon: "⚖️",
        title: `Treading Water: QR ${quickRatio.current.toFixed(1)}x`,
        detail: `MRR ${formatCurrency(mrrMetric.value)} is stable but not growing — new revenue roughly equals losses (${formatCurrency(quickRatio.timeSeries.at(-1)?.inflow ?? 0)} in vs ${formatCurrency(quickRatio.timeSeries.at(-1)?.outflow ?? 0)} out).`,
        urgency: "medium",
      });
    } else {
      keyInsights.push({
        icon: "📉",
        title: `Revenue Leaking: QR ${quickRatio.current.toFixed(1)}x`,
        detail: `MRR ${formatCurrency(mrrMetric.value)} is declining — losing more than gaining every month.`,
        urgency: "high",
      });
    }
  }

  // 洞見 2：最強指標
  const greenMetrics = metrics.filter((m) => m.status === "green");
  if (greenMetrics.length > 0) {
    const best = greenMetrics.reduce((a, b) =>
      // 選相對於基準表現最好的
      a.benchmark > 0 && b.benchmark > 0
        ? (a.value / a.benchmark > b.value / b.benchmark ? a : b)
        : a,
    );
    keyInsights.push({
      icon: "💪",
      title: `Top Strength: ${tMetric(best.metricId, best.metricId)}`,
      detail: `${tMetric(best.metricId, best.metricId)} at ${formatByUnit(best.value, best.unit)} beats benchmark of ${formatByUnit(best.benchmark, best.unit)}.`,
      urgency: "low",
    });
  }

  // 洞見 3：最弱指標
  const redMetrics = metrics.filter((m) => m.status === "red");
  if (redMetrics.length > 0) {
    const worst = redMetrics[0]!;
    keyInsights.push({
      icon: "🚨",
      title: `Critical: ${tMetric(worst.metricId, worst.metricId)}`,
      detail: `${tMetric(worst.metricId, worst.metricId)} at ${formatByUnit(worst.value, worst.unit)} needs immediate attention.`,
      urgency: "high",
    });
  }

  // 洞見 4：MRR 預測
  if (mrrForecast) {
    const sixMonth = mrrForecast.predictions.at(-1);
    if (sixMonth) {
      const delta = sixMonth.base - mrrForecast.currentMRR;
      const direction = delta >= 0 ? "grow" : "decline";
      keyInsights.push({
        icon: "🔮",
        title: `6-Month Outlook: ${formatCurrency(sixMonth.base)}`,
        detail: `MRR projected to ${direction} from ${formatCurrency(mrrForecast.currentMRR)} to ${formatCurrency(sixMonth.base)} (${delta >= 0 ? "+" : ""}${formatCurrency(delta)}).`,
        urgency: delta < 0 ? "high" : "low",
      });
    }
  }

  // 洞見 5：最佳 Scenario
  if (scenarios) {
    const best = scenarios.scenarios.reduce((a, b) =>
      a.improvement.month12Delta > b.improvement.month12Delta ? a : b,
    );
    keyInsights.push({
      icon: "💡",
      title: `Best Lever: ${best.name}`,
      detail: `${best.description} could add ${formatCurrency(best.improvement.month12Delta)}/month (+${best.improvement.month12DeltaPercent.toFixed(1)}%) within 12 months.`,
      urgency: "medium",
    });
  }

  // === 一句話 headline ===
  const headline = buildHeadline(healthGrade, mrrMetric, quickRatio, pmfScore);

  // === Top Action ===
  const topAction = buildTopAction(metrics, quickRatio, pmfScore, scenarios);

  // === 飛輪層級 ===
  const flywheelLevel = {
    current: params.flywheel?.currentLayer ?? 1,
    label: ["", "Your Data", "Peer Comparison", "Category Intelligence", "Market Opportunity"][params.flywheel?.currentLayer ?? 1] ?? "Your Data",
    nextUnlock: params.flywheel?.currentLayer === 1
      ? "Unlock peer benchmarks to see how similar apps perform"
      : params.flywheel?.currentLayer === 2
        ? "Unlock category intelligence to see your competitive landscape"
        : params.flywheel?.currentLayer === 3
          ? "Unlock market opportunities to find your next big move"
          : "You've unlocked all insight layers!",
  };

  // 限制 5 個洞見，按 urgency 排序
  const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  keyInsights.sort((a, b) => (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1));
  const topInsights = keyInsights.slice(0, 5);

  return {
    headline,
    healthScore,
    healthGrade,
    keyInsights: topInsights,
    topAction,
    flywheelLevel,
  };
}

/** 建構一句話 headline */
function buildHeadline(
  grade: ExecutiveSummary["healthGrade"],
  mrr?: MetricHealth,
  qr?: QuickRatioResult,
  pmf?: PMFScoreResult,
): string {
  const mrrStr = mrr ? formatCurrency(mrr.value) : "N/A";

  switch (grade) {
    case "Excellent":
      return `${mrrStr} MRR and growing strong — invest in acquisition.`;
    case "Good":
      return `${mrrStr} MRR with solid fundamentals — optimize to unlock growth.`;
    case "Fair":
      return qr && qr.current < 1.1
        ? `${mrrStr} MRR but treading water — fix churn before scaling.`
        : `${mrrStr} MRR with mixed signals — focus on your strengths.`;
    case "At Risk":
      return `${mrrStr} MRR with declining metrics — urgent action needed.`;
  }
}

/** 建構 Top Action */
function buildTopAction(
  metrics: MetricHealth[],
  qr?: QuickRatioResult,
  pmf?: PMFScoreResult,
  scenarios?: ScenarioAnalysisResult,
): ExecutiveSummary["topAction"] {
  // 如果有 scenarios，推薦最佳場景
  if (scenarios) {
    const best = scenarios.scenarios.reduce((a, b) =>
      a.improvement.month12Delta > b.improvement.month12Delta ? a : b,
    );
    return {
      title: best.name,
      expectedImpact: `+${formatCurrency(best.improvement.month12Delta)}/month within 12 months`,
      reason: best.description,
    };
  }

  // 沒有 scenarios 時用基本邏輯
  const churn = metrics.find((m) => m.metricId === "churn");
  if (churn && churn.value > 6) {
    return {
      title: "Reduce Churn",
      expectedImpact: "Protecting $200-800/month MRR",
      reason: `Monthly churn at ${formatPercent(churn.value)} is above healthy threshold.`,
    };
  }

  return {
    title: "Scale Acquisition",
    expectedImpact: "Grow top-of-funnel",
    reason: "Your conversion funnel is healthy — invest in getting more users in.",
  };
}

