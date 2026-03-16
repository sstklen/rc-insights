// ========================================
// Executive Summary 產生器
// 數據層：只存結構化數據，不存 prose
// 渲染層用 renderLocalizedSummary() 產生翻譯文字
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
import { formatCurrency, formatByUnit } from "../utils/formatting.ts";
import { t, tMetric } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";

/** 洞見類型（結構化，不含文字） */
export interface KeyInsightData {
  icon: string;
  /** 洞見類型 ID — 渲染器用此 ID 查 i18n key */
  type: "qr_strong" | "qr_treading" | "qr_leaking" | "top_strength" | "critical" | "forecast" | "best_lever";
  urgency: "high" | "medium" | "low";
  /** 結構化資料，渲染器用來組文字 */
  data: Record<string, string | number>;
}

/** Executive Summary 結構（純數據，語言無關） */
export interface ExecutiveSummary {
  healthScore: number;
  healthGrade: "Excellent" | "Good" | "Fair" | "At Risk";
  /** 結構化洞見 — 不含 prose，渲染器用 type + data 產生翻譯文字 */
  keyInsights: KeyInsightData[];
  /** Top Action 結構化資料 */
  topAction: {
    scenarioName: string;
    delta: number;
    reason: string;
  };
  /** 飛輪層級 */
  flywheelLevel: {
    current: number;
  };
  /** 核心數值（渲染器組 headline 用） */
  mrrValue: number;
  qrCurrent: number;
}

/**
 * 產生 Executive Summary（純結構化數據）
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
  const { metrics, quickRatio, mrrForecast, scenarios } = params;

  // 健康分數
  const greenCount = metrics.filter((m) => m.status === "green").length;
  const yellowCount = metrics.filter((m) => m.status === "yellow").length;
  const total = metrics.length || 1;
  const healthScore = Math.round(((greenCount * 100 + yellowCount * 50) / total) * 10) / 10;
  const healthGrade: ExecutiveSummary["healthGrade"] =
    healthScore >= 80 ? "Excellent" :
    healthScore >= 60 ? "Good" :
    healthScore >= 40 ? "Fair" : "At Risk";

  // 關鍵洞見
  const keyInsights: KeyInsightData[] = [];
  const mrrMetric = metrics.find((m) => m.metricId === "mrr");
  const mrrValue = mrrMetric?.value ?? 0;
  const qrCurrent = quickRatio?.current ?? 0;

  // 洞見 1: Quick Ratio
  if (mrrMetric && quickRatio) {
    const qrType = quickRatio.current >= 2.0 ? "qr_strong" as const
      : quickRatio.current >= 1.0 ? "qr_treading" as const
      : "qr_leaking" as const;
    keyInsights.push({
      icon: qrType === "qr_strong" ? "🚀" : qrType === "qr_treading" ? "⚖️" : "📉",
      type: qrType,
      urgency: qrType === "qr_leaking" ? "high" : qrType === "qr_treading" ? "medium" : "low",
      data: {
        qr: quickRatio.current,
        mrr: mrrMetric.value,
        inflow: quickRatio.timeSeries.at(-1)?.inflow ?? 0,
        outflow: quickRatio.timeSeries.at(-1)?.outflow ?? 0,
      },
    });
  }

  // 洞見 2: 最強指標
  const greenMetrics = metrics.filter((m) => m.status === "green");
  if (greenMetrics.length > 0) {
    const best = greenMetrics.reduce((a, b) =>
      a.benchmark > 0 && b.benchmark > 0
        ? (a.value / a.benchmark > b.value / b.benchmark ? a : b)
        : a,
    );
    keyInsights.push({
      icon: "💪",
      type: "top_strength",
      urgency: "low",
      data: {
        metricId: best.metricId,
        metricName: best.name,
        value: best.value,
        unit: best.unit,
        benchmark: best.benchmark,
      },
    });
  }

  // 洞見 3: 最弱指標
  const redMetrics = metrics.filter((m) => m.status === "red");
  if (redMetrics.length > 0) {
    const worst = redMetrics[0]!;
    keyInsights.push({
      icon: "🚨",
      type: "critical",
      urgency: "high",
      data: {
        metricId: worst.metricId,
        metricName: worst.name,
        value: worst.value,
        unit: worst.unit,
      },
    });
  }

  // 洞見 4: MRR 預測
  if (mrrForecast) {
    const sixMonth = mrrForecast.predictions.at(-1);
    if (sixMonth) {
      keyInsights.push({
        icon: "🔮",
        type: "forecast",
        urgency: sixMonth.base < mrrForecast.currentMRR ? "high" : "low",
        data: {
          currentMRR: mrrForecast.currentMRR,
          projectedMRR: sixMonth.base,
          delta: sixMonth.base - mrrForecast.currentMRR,
        },
      });
    }
  }

  // 洞見 5: 最佳 Scenario
  if (scenarios) {
    const best = scenarios.scenarios.reduce((a, b) =>
      a.improvement.month12Delta > b.improvement.month12Delta ? a : b,
    );
    keyInsights.push({
      icon: "💡",
      type: "best_lever",
      urgency: "medium",
      data: {
        name: best.name,
        description: best.description,
        delta: best.improvement.month12Delta,
        deltaPercent: best.improvement.month12DeltaPercent,
      },
    });
  }

  // 排序
  const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  keyInsights.sort((a, b) => (urgencyOrder[a.urgency] ?? 1) - (urgencyOrder[b.urgency] ?? 1));

  // Top Action
  let topAction: ExecutiveSummary["topAction"];
  if (scenarios) {
    const best = scenarios.scenarios.reduce((a, b) =>
      a.improvement.month12Delta > b.improvement.month12Delta ? a : b,
    );
    topAction = {
      scenarioName: best.name,
      delta: best.improvement.month12Delta,
      reason: best.description,
    };
  } else {
    topAction = {
      scenarioName: "Scale Acquisition",
      delta: 0,
      reason: "Healthy conversion funnel",
    };
  }

  return {
    healthScore,
    healthGrade,
    keyInsights: keyInsights.slice(0, 5),
    topAction,
    flywheelLevel: { current: params.flywheel?.currentLayer ?? 1 },
    mrrValue,
    qrCurrent,
  };
}

// ========================================
// 渲染器用：把結構化數據變成翻譯文字
// 在 render time 呼叫（locale 已由渲染器設好）
// ========================================

/** 渲染 headline — 從 healthGrade + mrrValue 組合 */
export function renderHeadline(es: ExecutiveSummary, locale?: Locale): string {
  const mrrStr = formatCurrency(es.mrrValue);
  const key = `es.headline.${es.healthGrade.toLowerCase().replace(/ /g, "_")}`;
  const template = t(key, locale);
  // 如果 i18n 有 key 就用，沒有就 fallback 英文
  if (template !== key) {
    return template.replace("$MRR", mrrStr);
  }
  // English fallback
  switch (es.healthGrade) {
    case "Excellent": return `${mrrStr} MRR and growing strong — invest in acquisition.`;
    case "Good": return `${mrrStr} MRR with solid fundamentals — optimize to unlock growth.`;
    case "Fair": return es.qrCurrent < 1.1
      ? `${mrrStr} MRR but treading water — fix churn before scaling.`
      : `${mrrStr} MRR with mixed signals — focus on your strengths.`;
    case "At Risk": return `${mrrStr} MRR with declining metrics — urgent action needed.`;
  }
}

/** 渲染單個洞見的 title + detail — 從 type + data 組合 */
export function renderInsight(insight: KeyInsightData, locale?: Locale): { title: string; detail: string } {
  const d = insight.data;
  const titleKey = `es.insight.${insight.type}.title`;
  const detailKey = `es.insight.${insight.type}.detail`;
  const titleTpl = t(titleKey, locale);
  const detailTpl = t(detailKey, locale);

  // 嘗試用 i18n template
  if (titleTpl !== titleKey && detailTpl !== detailKey) {
    return {
      title: fillTemplate(titleTpl, d),
      detail: fillTemplate(detailTpl, d),
    };
  }

  // English fallback（保持跟原本一樣的文字品質）
  switch (insight.type) {
    case "qr_strong":
      return {
        title: `Strong Growth: QR ${Number(d.qr).toFixed(1)}x`,
        detail: `MRR ${formatCurrency(Number(d.mrr))} with Quick Ratio ${Number(d.qr).toFixed(2)} — revenue inflow significantly exceeds losses.`,
      };
    case "qr_treading":
      return {
        title: `Treading Water: QR ${Number(d.qr).toFixed(1)}x`,
        detail: `MRR ${formatCurrency(Number(d.mrr))} is stable but not growing — new revenue roughly equals losses (${formatCurrency(Number(d.inflow))} in vs ${formatCurrency(Number(d.outflow))} out).`,
      };
    case "qr_leaking":
      return {
        title: `Revenue Leaking: QR ${Number(d.qr).toFixed(1)}x`,
        detail: `MRR ${formatCurrency(Number(d.mrr))} is declining — losing more than gaining every month.`,
      };
    case "top_strength":
      return {
        title: `Top Strength: ${tMetric(String(d.metricId), String(d.metricName), locale)}`,
        detail: `${tMetric(String(d.metricId), String(d.metricName), locale)} at ${formatByUnit(Number(d.value), String(d.unit))} beats benchmark of ${formatByUnit(Number(d.benchmark), String(d.unit))}.`,
      };
    case "critical":
      return {
        title: `Critical: ${tMetric(String(d.metricId), String(d.metricName), locale)}`,
        detail: `${tMetric(String(d.metricId), String(d.metricName), locale)} at ${formatByUnit(Number(d.value), String(d.unit))} needs immediate attention.`,
      };
    case "forecast":
      return {
        title: `6-Month Outlook: ${formatCurrency(Number(d.projectedMRR))}`,
        detail: `MRR projected to ${Number(d.delta) >= 0 ? "grow" : "decline"} from ${formatCurrency(Number(d.currentMRR))} to ${formatCurrency(Number(d.projectedMRR))} (${Number(d.delta) >= 0 ? "+" : ""}${formatCurrency(Number(d.delta))}).`,
      };
    case "best_lever":
      return {
        title: `Best Lever: ${d.name}`,
        detail: `${d.description} could add ${formatCurrency(Number(d.delta))}/month (+${Number(d.deltaPercent).toFixed(1)}%) within 12 months.`,
      };
  }
}

/** 渲染 top action 文字 */
export function renderTopAction(es: ExecutiveSummary, locale?: Locale): { title: string; impact: string; reason: string } {
  return {
    title: es.topAction.scenarioName,
    impact: es.topAction.delta > 0
      ? `+${formatCurrency(es.topAction.delta)}/month within 12 months`
      : t("es.action.grow_funnel", locale) !== "es.action.grow_funnel"
        ? t("es.action.grow_funnel", locale)
        : "Grow top-of-funnel",
    reason: es.topAction.reason,
  };
}

/** 渲染飛輪層級文字 */
export function renderFlywheelLevel(es: ExecutiveSummary, locale?: Locale): { label: string; nextUnlock: string } {
  const labels = [
    "",
    t("es.flywheel.layer1", locale) !== "es.flywheel.layer1" ? t("es.flywheel.layer1", locale) : "Your Data",
    t("es.flywheel.layer2", locale) !== "es.flywheel.layer2" ? t("es.flywheel.layer2", locale) : "Peer Comparison",
    t("es.flywheel.layer3", locale) !== "es.flywheel.layer3" ? t("es.flywheel.layer3", locale) : "Category Intelligence",
    t("es.flywheel.layer4", locale) !== "es.flywheel.layer4" ? t("es.flywheel.layer4", locale) : "Market Opportunity",
  ];
  const unlocks = [
    "",
    t("es.flywheel.unlock2", locale) !== "es.flywheel.unlock2" ? t("es.flywheel.unlock2", locale) : "Unlock peer benchmarks to see how similar apps perform",
    t("es.flywheel.unlock3", locale) !== "es.flywheel.unlock3" ? t("es.flywheel.unlock3", locale) : "Unlock category intelligence to see your competitive landscape",
    t("es.flywheel.unlock4", locale) !== "es.flywheel.unlock4" ? t("es.flywheel.unlock4", locale) : "Unlock market opportunities to find your next big move",
    t("es.flywheel.unlocked", locale) !== "es.flywheel.unlocked" ? t("es.flywheel.unlocked", locale) : "You've unlocked all insight layers!",
  ];
  const c = es.flywheelLevel.current;
  return {
    label: labels[c] ?? "Your Data",
    nextUnlock: unlocks[c] ?? "",
  };
}

/** 簡單模板填充 $key → value */
function fillTemplate(template: string, data: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const formatted = typeof value === "number" ? String(value) : value;
    result = result.replace(`$${key}`, formatted);
  }
  return result;
}
