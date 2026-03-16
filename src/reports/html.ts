// ========================================
// HTML 報告產生器
// 使用模板引擎產生獨立 HTML 檔案（含內嵌 CSS）
// ========================================

import type {
  HealthReport,
  MetricHealth,
  Recommendation,
  Anomaly,
  KeywordAnalysisResult,
  OfferingAnalysisResult,
  FlywheelResult,
  FlywheelInsight,
} from "../api/types.ts";
import type { QuickRatioResult } from "../analysis/quick-ratio.ts";
import type { PMFScoreResult } from "../analysis/pmf-score.ts";
import type { MRRForecastResult } from "../analysis/mrr-forecast.ts";
import type { ScenarioAnalysisResult, ScenarioResult } from "../analysis/scenario-engine.ts";
import { formatCurrency, formatPercent, formatNumber, formatChange, formatByUnit } from "../utils/formatting.ts";
import { t, tMetric, tTrend, tQRGrade, tPMFGrade, getLocale } from "../i18n/index.ts";

/** 健康狀態對應的 CSS class */
const STATUS_CLASS: Record<string, string> = {
  green: "status-green",
  yellow: "status-yellow",
  red: "status-red",
};

/** 健康狀態圖示 */
const STATUS_DOT: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/**
 * 跳脫 HTML 特殊字元，防止 XSS
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 產生指標卡片 HTML
 */
function renderMetricCard(metric: MetricHealth): string {
  const name = tMetric(metric.metricId, metric.name);
  const value = formatByUnit(metric.value, metric.unit);
  const dot = STATUS_DOT[metric.status] ?? "⚪";
  const statusClass = STATUS_CLASS[metric.status] ?? "";
  const change = metric.changePercent !== 0 ? formatChange(metric.changePercent) : "";
  const changeClass = metric.changePercent > 0 ? "change-positive" : metric.changePercent < 0 ? "change-negative" : "";
  const benchmark = metric.benchmark > 0 ? formatByUnit(metric.benchmark, metric.unit) : "";

  return `
    <div class="metric-card ${statusClass}">
      <div class="metric-header">
        <span class="metric-name">${escapeHtml(name)}</span>
        <span class="metric-status">${dot}</span>
      </div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-details">
        ${change ? `<span class="metric-change ${changeClass}">${escapeHtml(change)} ${t("misc.mom")}</span>` : ""}
        ${benchmark ? `<span class="metric-benchmark">${t("misc.benchmark_label")}: ${escapeHtml(benchmark)}</span>` : ""}
      </div>
      <div class="metric-trend">${escapeHtml(tTrend(metric.trend))}</div>
    </div>`;
}

/**
 * 產生建議 HTML
 */
function renderRecommendationItem(rec: Recommendation, index: number): string {
  const impactClass = `impact-${rec.impact}`;
  const relatedName = tMetric(rec.relatedMetric, rec.relatedMetric);

  return `
    <div class="recommendation-item">
      <div class="rec-header">
        <span class="rec-number">${index + 1}</span>
        <span class="rec-title">${escapeHtml(rec.title)}</span>
        <span class="rec-impact ${impactClass}">${escapeHtml(t(`impact.${rec.impact}`))}</span>
      </div>
      <p class="rec-description">${escapeHtml(rec.description)}</p>
      <span class="rec-related">${t("rec.related")}: ${escapeHtml(relatedName)}</span>
    </div>`;
}

/**
 * 產生異常 HTML
 */
function renderAnomalyItem(anomaly: Anomaly): string {
  const icon = anomaly.type === "spike" ? "⚡" : "📉";
  const typeClass = anomaly.type === "spike" ? "anomaly-spike" : "anomaly-drop";

  return `
    <div class="anomaly-item ${typeClass}">
      <span class="anomaly-icon">${icon}</span>
      <span class="anomaly-metric">${escapeHtml(anomaly.metric)}</span>
      <span class="anomaly-magnitude">${anomaly.type === "spike" ? "+" : "-"}${anomaly.magnitude.toFixed(1)}%</span>
      <span class="anomaly-date">${escapeHtml(anomaly.date)}</span>
    </div>`;
}

/**
 * 計算健康分數長條圖的寬度百分比
 */
function calculateBarWidth(metric: MetricHealth): number {
  if (metric.benchmark <= 0) return 50;

  if (metric.unit === "%") {
    // 百分比指標：以 100% 為滿
    return Math.min(Math.max(metric.value, 0), 100);
  }

  // 金額/數量指標：以基準的 2 倍為滿
  const ratio = metric.value / (metric.benchmark * 2);
  return Math.min(Math.max(ratio * 100, 5), 100);
}

/**
 * 產生健康分數長條圖 HTML
 */
function renderHealthBars(metrics: MetricHealth[]): string {
  const statusOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...metrics].sort(
    (a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1),
  );

  return sorted
    .map((m) => {
      const name = tMetric(m.metricId, m.name);
      const width = calculateBarWidth(m);
      const colorClass = STATUS_CLASS[m.status] ?? "";
      const value = formatByUnit(m.value, m.unit);

      return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(name)}</span>
        <div class="bar-container">
          <div class="bar-fill ${colorClass}" style="width: ${width}%"></div>
        </div>
        <span class="bar-value">${escapeHtml(value)}</span>
      </div>`;
    })
    .join("\n");
}

// ========================================
// Crystal Ball & Strategy 渲染輔助函數
// ========================================

/** Quick Ratio grade → CSS class */
function qrGradeClass(grade: QuickRatioResult["grade"]): string {
  const map: Record<QuickRatioResult["grade"], string> = {
    excellent: "qr-grade-excellent",
    healthy: "qr-grade-healthy",
    concerning: "qr-grade-concerning",
    leaking: "qr-grade-leaking",
  };
  return map[grade];
}

/** PMF grade → gauge CSS class */
function pmfGaugeClass(grade: PMFScoreResult["grade"]): string {
  if (grade === "Strong PMF") return "pmf-gauge-strong";
  if (grade === "Approaching PMF") return "pmf-gauge-approaching";
  if (grade === "Pre-PMF") return "pmf-gauge-pre";
  return "pmf-gauge-no";
}

/** 渲染 Quick Ratio 卡片 */
function renderQuickRatio(qr: QuickRatioResult): string {
  return `
    <div class="qr-card">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("qr.title"))}</h3>
      <div class="qr-header">
        <span class="qr-value">${escapeHtml(qr.current.toFixed(2))}</span>
        <span class="qr-grade ${qrGradeClass(qr.grade)}">${escapeHtml(tQRGrade(qr.grade))}</span>
      </div>
      <div class="qr-interpretation">${escapeHtml(qr.interpretation)}</div>
    </div>`;
}

/** 渲染 PMF Score 儀表板 */
function renderPMFScore(pmf: PMFScoreResult): string {
  const breakdownRows = pmf.breakdown
    .map(
      (b) => `
        <tr>
          <td>${escapeHtml(b.factor)}</td>
          <td>${escapeHtml(b.rawValue.toFixed(2))}</td>
          <td>${escapeHtml(b.score.toFixed(1))}</td>
          <td>${escapeHtml(b.weight.toFixed(2))}</td>
          <td>${escapeHtml(b.weighted.toFixed(1))}</td>
        </tr>`,
    )
    .join("\n");

  const actionItems = pmf.decisionAdvice.topActions
    .map((a) => `<li>${escapeHtml(a)}</li>`)
    .join("\n");

  return `
    <div class="pmf-dashboard">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("pmf.title"))}</h3>
      <div class="pmf-gauge ${pmfGaugeClass(pmf.grade)}">
        <span class="pmf-score-number">${escapeHtml(pmf.score.toFixed(0))}</span>
        <span class="pmf-score-label">/ 100</span>
      </div>
      <div class="pmf-grade-text">${escapeHtml(tPMFGrade(pmf.grade))}</div>

      <table class="benchmark-table" style="margin-bottom:1rem;">
        <thead>
          <tr>
            <th>${escapeHtml(t("table.factor"))}</th>
            <th>${escapeHtml(t("table.raw_value"))}</th>
            <th>${escapeHtml(t("table.score"))}</th>
            <th>${escapeHtml(t("table.weight"))}</th>
            <th>${escapeHtml(t("table.weighted"))}</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownRows}
        </tbody>
      </table>

      <div class="pmf-diagnosis">${escapeHtml(pmf.diagnosis)}</div>

      <div class="pmf-advice-card">
        <div class="pmf-verdict">${escapeHtml(pmf.decisionAdvice.verdict)}</div>
        <div class="pmf-reasoning">${escapeHtml(pmf.decisionAdvice.reasoning)}</div>
        <ul class="pmf-actions">
          ${actionItems}
        </ul>
      </div>
    </div>`;
}

/** 渲染 MRR Forecast */
function renderMRRForecast(forecast: MRRForecastResult): string {
  const predictionRows = forecast.predictions
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.month)}</td>
          <td class="forecast-base">${escapeHtml(formatCurrency(p.base))}</td>
          <td class="forecast-optimistic">${escapeHtml(formatCurrency(p.optimistic))}</td>
          <td class="forecast-pessimistic">${escapeHtml(formatCurrency(p.pessimistic))}</td>
        </tr>`,
    )
    .join("\n");

  return `
    <div style="background:white;border-radius:10px;padding:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:1rem;">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("forecast.title"))}</h3>
      <div class="forecast-narrative">${escapeHtml(forecast.narrative)}</div>
      <table class="forecast-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("table.month"))}</th>
            <th>${escapeHtml(t("table.base"))}</th>
            <th>${escapeHtml(t("table.optimistic"))}</th>
            <th>${escapeHtml(t("table.pessimistic"))}</th>
          </tr>
        </thead>
        <tbody>
          ${predictionRows}
        </tbody>
      </table>
    </div>`;
}

/** 渲染場景卡片 */
function renderScenarioCard(scenario: ScenarioResult, isBest: boolean): string {
  const delta = scenario.improvement.month12Delta;
  const pct = scenario.improvement.month12DeltaPercent;
  const deltaClass = delta >= 0 ? "scenario-delta-positive" : "scenario-delta-negative";
  const deltaSign = delta >= 0 ? "+" : "";

  return `
    <div class="scenario-card ${isBest ? "scenario-card-best" : ""}">
      ${isBest ? `<span class="scenario-best-badge">${escapeHtml(t("scenario.best"))}</span>` : ""}
      <div class="scenario-name">${escapeHtml(scenario.name)}</div>
      <div class="scenario-description">${escapeHtml(scenario.description)}</div>
      <div class="scenario-mrr">${escapeHtml(formatCurrency(scenario.projectedMRR.month12))}</div>
      <div class="scenario-improvement">
        <span class="${deltaClass}">${escapeHtml(deltaSign + formatCurrency(delta))} (${escapeHtml(deltaSign + pct.toFixed(1))}%)</span>
        <span style="font-size:0.75rem;color:var(--gray-500);"> ${escapeHtml(t("scenario.vs_baseline"))}</span>
      </div>
      <div class="scenario-narrative">${escapeHtml(scenario.narrative)}</div>
    </div>`;
}

/** 渲染 Scenarios 區塊 */
function renderScenarios(data: ScenarioAnalysisResult): string {
  const cards = data.scenarios
    .map((s) => renderScenarioCard(s, s.name === data.bestScenario))
    .join("\n");

  return `
    <div style="background:white;border-radius:10px;padding:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:1rem;">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("scenario.title"))}</h3>
      <div class="forecast-narrative">${escapeHtml(data.combinedNarrative)}</div>
      <div class="scenarios-grid">
        ${cards}
      </div>
    </div>`;
}

/** 效率等級 → badge CSS class */
function efficiencyBadgeClass(efficiency: "high" | "medium" | "low"): string {
  const map: Record<string, string> = { high: "badge-high", medium: "badge-medium", low: "badge-low" };
  return map[efficiency] ?? "badge-medium";
}

/** 表現等級 → badge CSS class */
function performanceBadgeClass(performance: "top" | "average" | "below"): string {
  const map: Record<string, string> = { top: "badge-top", average: "badge-average", below: "badge-below" };
  return map[performance] ?? "badge-average";
}

/** 渲染 Keyword Analysis */
function renderKeywordAnalysis(data: KeywordAnalysisResult): string {
  if (!data.hasAttributionData || data.keywords.length === 0) return "";

  const rows = data.keywords
    .map(
      (k) => `
        <tr>
          <td>${escapeHtml(k.keyword)}</td>
          <td>${escapeHtml(formatNumber(k.totalTrials))}</td>
          <td>${escapeHtml(formatCurrency(k.totalRevenue))}</td>
          <td>${k.avgConversionRate !== null ? escapeHtml(formatPercent(k.avgConversionRate)) : t("misc.na")}</td>
          <td><span class="efficiency-badge ${efficiencyBadgeClass(k.efficiency)}">${escapeHtml(k.efficiency)}</span></td>
        </tr>`,
    )
    .join("\n");

  return `
    <div style="margin-bottom:1.5rem;">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("strategy.keyword_analysis"))}</h3>
      <div class="strategy-narrative">${escapeHtml(data.narrative)}</div>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("table.keyword"))}</th>
            <th>${escapeHtml(t("table.trials"))}</th>
            <th>${escapeHtml(t("table.revenue"))}</th>
            <th>${escapeHtml(t("table.conversion"))}</th>
            <th>${escapeHtml(t("table.efficiency"))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

/** 渲染 Offering Analysis */
function renderOfferingAnalysis(data: OfferingAnalysisResult): string {
  if (data.offerings.length === 0) return "";

  const rows = data.offerings
    .map(
      (o) => `
        <tr>
          <td>${escapeHtml(o.offeringName)}</td>
          <td>${escapeHtml(formatNumber(o.trialStarts))}</td>
          <td>${o.conversionRate !== null ? escapeHtml(formatPercent(o.conversionRate)) : t("misc.na")}</td>
          <td>${escapeHtml(formatCurrency(o.revenue))}</td>
          <td><span class="performance-badge ${performanceBadgeClass(o.performance)}">${escapeHtml(o.performance)}</span></td>
        </tr>`,
    )
    .join("\n");

  return `
    <div style="margin-bottom:1.5rem;">
      <h3 style="margin-bottom:0.8rem;font-size:1rem;">${escapeHtml(t("strategy.offering_analysis"))}</h3>
      <div class="strategy-narrative">${escapeHtml(data.narrative)}</div>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("table.name"))}</th>
            <th>${escapeHtml(t("table.trials"))}</th>
            <th>${escapeHtml(t("table.conversion"))}</th>
            <th>${escapeHtml(t("table.revenue"))}</th>
            <th>${escapeHtml(t("table.performance"))}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}

// ========================================
// Flywheel 渲染輔助函數
// ========================================

/** 每層的圖示 */
const FLYWHEEL_LAYER_ICONS: Record<number, string> = {
  1: "📊",
  2: "👥",
  3: "🏷️",
  4: "🌍",
};

/** 渲染 Flywheel 區塊 */
function renderFlywheelHtml(fw: FlywheelResult): string {
  // Group insights by layer
  const byLayer = new Map<number, FlywheelInsight[]>();
  for (const insight of fw.insights) {
    const arr = byLayer.get(insight.layer) ?? [];
    arr.push(insight);
    byLayer.set(insight.layer, arr);
  }

  const layerCards: string[] = [];

  for (let layer = 1; layer <= 4; layer++) {
    const insights = byLayer.get(layer) ?? [];
    const isFree = layer <= fw.currentLayer;
    const icon = FLYWHEEL_LAYER_ICONS[layer] ?? "📊";
    // Get layerName from first insight or use default
    const layerName = insights[0]?.layerName ?? ["Your Data", "Peer Comparison", "Category Intelligence", "Market Opportunity"][layer - 1];
    const tagClass = isFree ? "flywheel-tag-free" : "flywheel-tag-premium";
    const tagText = isFree ? "Free" : "$";
    const premiumClass = isFree ? "" : "flywheel-layer-premium";

    const insightItems = insights.map((insight) => {
      const actionLink = insight.actionUrl && isFree
        ? `<a class="flywheel-insight-action" href="${escapeHtml(insight.actionUrl)}">Do This &rarr;</a>`
        : "";
      const valueNote = insight.estimatedValue
        ? `<div class="flywheel-insight-value">${escapeHtml(insight.estimatedValue)}</div>`
        : "";

      return `
        <div class="flywheel-insight">
          <div class="flywheel-insight-title">${isFree ? "" : "🔒 "}${escapeHtml(insight.title)}</div>
          <div class="flywheel-insight-desc">${escapeHtml(insight.description)}</div>
          ${actionLink}
          ${valueNote}
        </div>`;
    }).join("\n");

    const overlay = !isFree ? `
      <div class="flywheel-layer-overlay">
        <div style="font-size:0.9rem;font-weight:600;color:var(--gray-700);">🔒 Premium Insights</div>
        <a href="#" class="unlock-btn">Unlock &rarr;</a>
      </div>` : "";

    layerCards.push(`
      <div class="flywheel-layer ${premiumClass}">
        ${overlay}
        <div class="flywheel-layer-content">
          <div class="flywheel-layer-header">
            <span class="flywheel-layer-icon">${icon}</span>
            <span class="flywheel-layer-title">Layer ${layer}: ${escapeHtml(layerName ?? "")}</span>
            <span class="flywheel-layer-tag ${tagClass}">${tagText}</span>
          </div>
          ${insightItems || '<div style="color:var(--gray-500);font-size:0.85rem;">No insights for this layer</div>'}
        </div>
      </div>`);
  }

  return `
    <div class="flywheel-section">
      <div class="flywheel-narrative">${escapeHtml(fw.flyWheelNarrative)}</div>
      ${layerCards.join("\n")}
      <div class="flywheel-footer">
        <strong>Current Level: ${fw.currentLayer}/4</strong>
        <span style="margin:0 0.5rem;">|</span>
        <span class="flywheel-next">${escapeHtml(fw.nextLayerTeaser)}</span>
      </div>
    </div>`;
}

/**
 * 產生完整的 HTML 報告
 * 包含內嵌 CSS，不依賴外部資源
 *
 * @param report - 健康報告資料
 * @returns 完整的 HTML 字串
 */
export function renderHtmlReport(report: HealthReport): string {
  const metricCards = report.metrics.map(renderMetricCard).join("\n");
  const healthBars = renderHealthBars(report.metrics);
  const recommendationItems = report.recommendations
    .map((rec, i) => renderRecommendationItem(rec, i))
    .join("\n");
  const anomalyItems = report.anomalies.map(renderAnomalyItem).join("\n");
  const dateStr = new Date(report.generatedAt).toLocaleString();

  // 計算摘要統計
  const greenCount = report.metrics.filter((m) => m.status === "green").length;
  const yellowCount = report.metrics.filter((m) => m.status === "yellow").length;
  const redCount = report.metrics.filter((m) => m.status === "red").length;

  return `<!DOCTYPE html>
<html lang="${getLocale()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.projectName)} — ${escapeHtml(t("header.subscription_health_report"))}</title>
  <style>
    /* === 全域樣式 === */
    :root {
      --purple-primary: #6B4CF6;
      --purple-light: #8B6FF7;
      --purple-dark: #4A2FD4;
      --green: #22C55E;
      --green-bg: #F0FDF4;
      --yellow: #EAB308;
      --yellow-bg: #FEFCE8;
      --red: #EF4444;
      --red-bg: #FEF2F2;
      --gray-50: #F9FAFB;
      --gray-100: #F3F4F6;
      --gray-200: #E5E7EB;
      --gray-300: #D1D5DB;
      --gray-500: #6B7280;
      --gray-700: #374151;
      --gray-900: #111827;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--gray-50);
      color: var(--gray-900);
      line-height: 1.6;
    }

    /* === 頂部橫幅 === */
    .header {
      background: linear-gradient(135deg, var(--purple-primary), var(--purple-dark));
      color: white;
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; }
    .header .subtitle { opacity: 0.85; font-size: 0.95rem; }

    /* === 容器 === */
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
    }

    /* === 摘要統計 === */
    .summary-bar {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin: -1.5rem auto 2rem;
      position: relative;
      z-index: 1;
    }
    .summary-item {
      background: white;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      min-width: 120px;
    }
    .summary-item .count { font-size: 1.8rem; font-weight: 700; }
    .summary-item .label { font-size: 0.8rem; color: var(--gray-500); text-transform: uppercase; }
    .count-green { color: var(--green); }
    .count-yellow { color: var(--yellow); }
    .count-red { color: var(--red); }

    /* === 章節 === */
    .section { margin-bottom: 2.5rem; }
    .section-title {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--gray-200);
    }

    /* === 指標卡片網格 === */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem;
    }
    .metric-card {
      background: white;
      border-radius: 10px;
      padding: 1.2rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border-left: 4px solid var(--gray-300);
      transition: transform 0.15s;
    }
    .metric-card:hover { transform: translateY(-2px); }
    .metric-card.status-green { border-left-color: var(--green); background: var(--green-bg); }
    .metric-card.status-yellow { border-left-color: var(--yellow); background: var(--yellow-bg); }
    .metric-card.status-red { border-left-color: var(--red); background: var(--red-bg); }
    .metric-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .metric-name { font-size: 0.85rem; font-weight: 600; color: var(--gray-700); }
    .metric-value { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.3rem; }
    .metric-details { font-size: 0.8rem; color: var(--gray-500); }
    .metric-change { margin-right: 0.5rem; }
    .change-positive { color: var(--green); }
    .change-negative { color: var(--red); }
    .metric-trend { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.3rem; text-transform: capitalize; }

    /* === 長條圖 === */
    .bar-row { display: flex; align-items: center; margin-bottom: 0.6rem; }
    .bar-label { width: 140px; font-size: 0.85rem; font-weight: 500; color: var(--gray-700); flex-shrink: 0; }
    .bar-container { flex: 1; height: 24px; background: var(--gray-100); border-radius: 12px; overflow: hidden; margin: 0 0.8rem; }
    .bar-fill { height: 100%; border-radius: 12px; transition: width 0.5s ease; }
    .bar-fill.status-green { background: var(--green); }
    .bar-fill.status-yellow { background: var(--yellow); }
    .bar-fill.status-red { background: var(--red); }
    .bar-value { width: 80px; text-align: right; font-size: 0.85rem; font-weight: 600; flex-shrink: 0; }

    /* === 建議 === */
    .recommendation-item {
      background: white;
      border-radius: 10px;
      padding: 1.2rem;
      margin-bottom: 0.8rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .rec-header { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.5rem; }
    .rec-number {
      background: var(--purple-primary);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .rec-title { font-weight: 600; flex: 1; }
    .rec-impact {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .impact-high { background: var(--red-bg); color: var(--red); }
    .impact-medium { background: var(--yellow-bg); color: var(--yellow); }
    .impact-low { background: var(--green-bg); color: var(--green); }
    .rec-description { font-size: 0.9rem; color: var(--gray-700); margin-bottom: 0.5rem; line-height: 1.5; }
    .rec-related { font-size: 0.75rem; color: var(--gray-500); }

    /* === 異常 === */
    .anomaly-item {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.8rem 1rem;
      background: white;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .anomaly-spike { border-left: 3px solid var(--yellow); }
    .anomaly-drop { border-left: 3px solid var(--red); }
    .anomaly-icon { font-size: 1.2rem; }
    .anomaly-metric { font-weight: 600; flex: 1; }
    .anomaly-magnitude { font-weight: 700; }
    .anomaly-spike .anomaly-magnitude { color: var(--yellow); }
    .anomaly-drop .anomaly-magnitude { color: var(--red); }
    .anomaly-date { color: var(--gray-500); font-size: 0.85rem; }

    /* === 基準表格 === */
    .benchmark-table { width: 100%; border-collapse: collapse; }
    .benchmark-table th {
      text-align: left;
      padding: 0.6rem 1rem;
      background: var(--gray-100);
      font-size: 0.8rem;
      text-transform: uppercase;
      color: var(--gray-500);
    }
    .benchmark-table td {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid var(--gray-100);
      font-size: 0.9rem;
    }

    /* === 底部 === */
    .footer {
      text-align: center;
      padding: 2rem;
      color: var(--gray-500);
      font-size: 0.85rem;
      border-top: 1px solid var(--gray-200);
      margin-top: 2rem;
    }
    .footer a { color: var(--purple-primary); text-decoration: none; }

    /* === Crystal Ball 區塊 === */
    .crystal-ball-section {
      background: linear-gradient(135deg, #F5F3FF, #EDE9FE);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    /* Quick Ratio 卡片 */
    .qr-card {
      background: white;
      border-radius: 10px;
      padding: 1.5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      margin-bottom: 1rem;
    }
    .qr-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .qr-value { font-size: 2rem; font-weight: 700; }
    .qr-grade {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .qr-grade-excellent { background: #DCFCE7; color: #166534; }
    .qr-grade-healthy { background: #DCFCE7; color: #166534; }
    .qr-grade-concerning { background: #FEF9C3; color: #854D0E; }
    .qr-grade-leaking { background: #FEE2E2; color: #991B1B; }
    .qr-interpretation { font-size: 0.9rem; color: var(--gray-700); }

    /* PMF Score 儀表板 */
    .pmf-dashboard {
      background: white;
      border-radius: 10px;
      padding: 1.5rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      margin-bottom: 1rem;
    }
    .pmf-gauge {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      border: 8px solid var(--gray-200);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      position: relative;
    }
    .pmf-gauge-strong { border-color: var(--green); }
    .pmf-gauge-approaching { border-color: #A3E635; }
    .pmf-gauge-pre { border-color: var(--yellow); }
    .pmf-gauge-no { border-color: var(--red); }
    .pmf-score-number { font-size: 2rem; font-weight: 700; line-height: 1; }
    .pmf-score-label { font-size: 0.7rem; color: var(--gray-500); }
    .pmf-grade-text { text-align: center; font-weight: 600; margin-bottom: 1rem; color: var(--gray-700); }
    .pmf-diagnosis { font-size: 0.9rem; color: var(--gray-700); margin-bottom: 1rem; line-height: 1.5; }

    .pmf-advice-card {
      background: var(--gray-50);
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
      border-left: 4px solid var(--purple-primary);
    }
    .pmf-verdict { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; }
    .pmf-reasoning { font-size: 0.85rem; color: var(--gray-700); margin-bottom: 0.8rem; line-height: 1.5; }
    .pmf-actions { list-style: none; padding: 0; }
    .pmf-actions li {
      font-size: 0.85rem;
      padding: 0.3rem 0;
      padding-left: 1.2rem;
      position: relative;
      color: var(--gray-700);
    }
    .pmf-actions li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--purple-primary);
      font-weight: 700;
    }

    /* MRR Forecast */
    .forecast-narrative {
      font-size: 0.9rem;
      color: var(--gray-700);
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    .forecast-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    .forecast-table th {
      text-align: left;
      padding: 0.6rem 1rem;
      background: var(--gray-100);
      font-size: 0.8rem;
      text-transform: uppercase;
      color: var(--gray-500);
    }
    .forecast-table td {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid var(--gray-100);
      font-size: 0.9rem;
    }
    .forecast-base { background: #F5F3FF; }
    .forecast-optimistic { background: #F0FDF4; }
    .forecast-pessimistic { background: #FEF2F2; }

    /* Scenarios */
    .scenarios-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    .scenario-card {
      background: white;
      border-radius: 10px;
      padding: 1.2rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      border-top: 3px solid var(--gray-300);
      position: relative;
    }
    .scenario-card-best { border-top-color: var(--purple-primary); }
    .scenario-best-badge {
      position: absolute;
      top: -0.5rem;
      right: 1rem;
      background: var(--purple-primary);
      color: white;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .scenario-name { font-size: 1rem; font-weight: 700; margin-bottom: 0.3rem; }
    .scenario-description { font-size: 0.8rem; color: var(--gray-500); margin-bottom: 0.8rem; }
    .scenario-mrr { font-size: 1.3rem; font-weight: 700; color: var(--purple-primary); margin-bottom: 0.3rem; }
    .scenario-improvement { font-size: 0.85rem; margin-bottom: 0.5rem; }
    .scenario-delta-positive { color: var(--green); font-weight: 600; }
    .scenario-delta-negative { color: var(--red); font-weight: 600; }
    .scenario-narrative { font-size: 0.8rem; color: var(--gray-700); line-height: 1.4; }

    /* === Strategy 區塊 === */
    .strategy-narrative {
      font-size: 0.9rem;
      color: var(--gray-700);
      margin-bottom: 1rem;
      line-height: 1.5;
    }
    .efficiency-badge, .performance-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-high, .badge-top { background: #DCFCE7; color: #166534; }
    .badge-medium, .badge-average { background: #FEF9C3; color: #854D0E; }
    .badge-low, .badge-below { background: #FEE2E2; color: #991B1B; }

    /* === Flywheel 區塊 === */
    .flywheel-section {
      background: linear-gradient(135deg, #F0F9FF, #E0F2FE);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .flywheel-narrative {
      font-size: 0.9rem;
      color: var(--gray-700);
      margin-bottom: 1.5rem;
      line-height: 1.5;
    }
    .flywheel-layer {
      background: white;
      border-radius: 10px;
      padding: 1.2rem 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      position: relative;
    }
    .flywheel-layer-premium {
      background: rgba(255,255,255,0.6);
      overflow: hidden;
    }
    .flywheel-layer-premium .flywheel-layer-content {
      filter: blur(2px);
      user-select: none;
    }
    .flywheel-layer-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.5);
      border-radius: 10px;
      z-index: 1;
    }
    .flywheel-layer-overlay .unlock-btn {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.4rem 1.2rem;
      background: var(--purple-primary);
      color: white;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .flywheel-layer-overlay .unlock-btn:hover {
      background: var(--purple-dark);
    }
    .flywheel-layer-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-bottom: 0.8rem;
    }
    .flywheel-layer-icon { font-size: 1.2rem; }
    .flywheel-layer-title { font-size: 1rem; font-weight: 700; }
    .flywheel-layer-tag {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.1rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .flywheel-tag-free { background: #DCFCE7; color: #166534; }
    .flywheel-tag-premium { background: var(--gray-100); color: var(--gray-500); }
    .flywheel-insight {
      padding: 0.6rem 0;
      border-bottom: 1px solid var(--gray-100);
    }
    .flywheel-insight:last-child { border-bottom: none; }
    .flywheel-insight-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.2rem; }
    .flywheel-insight-desc { font-size: 0.85rem; color: var(--gray-700); line-height: 1.4; }
    .flywheel-insight-action {
      display: inline-block;
      margin-top: 0.3rem;
      color: var(--purple-primary);
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
    }
    .flywheel-insight-action:hover { text-decoration: underline; }
    .flywheel-insight-value { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.2rem; }
    .flywheel-footer {
      text-align: center;
      padding: 1rem 0 0;
      font-size: 0.9rem;
      color: var(--gray-700);
    }
    .flywheel-footer strong { color: var(--gray-900); }
    .flywheel-footer .flywheel-next { color: var(--purple-primary); font-weight: 600; }

    /* === RWD === */
    @media (max-width: 640px) {
      .summary-bar { flex-direction: column; align-items: center; }
      .metrics-grid { grid-template-columns: 1fr; }
      .bar-label { width: 100px; font-size: 0.75rem; }
      .scenarios-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>📊 ${escapeHtml(report.projectName)}</h1>
    <div class="subtitle">${escapeHtml(t("header.subscription_health_report"))} — ${escapeHtml(dateStr)}</div>
  </div>

  <div class="container">

    <div class="summary-bar">
      <div class="summary-item">
        <div class="count count-green">${greenCount}</div>
        <div class="label">${escapeHtml(t("status.healthy"))}</div>
      </div>
      <div class="summary-item">
        <div class="count count-yellow">${yellowCount}</div>
        <div class="label">${escapeHtml(t("status.attention"))}</div>
      </div>
      <div class="summary-item">
        <div class="count count-red">${redCount}</div>
        <div class="label">${escapeHtml(t("status.critical"))}</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">📈 ${escapeHtml(t("section.metrics_overview"))}</h2>
      <div class="metrics-grid">
        ${metricCards}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">📊 ${escapeHtml(t("section.health_score_chart"))}</h2>
      ${healthBars}
    </div>

    ${report.anomalies.length > 0 ? `
    <div class="section">
      <h2 class="section-title">⚠️ ${escapeHtml(t("section.anomalies"))}</h2>
      ${anomalyItems}
    </div>
    ` : ""}

    ${report.recommendations.length > 0 ? `
    <div class="section">
      <h2 class="section-title">💡 ${escapeHtml(t("section.recommendations_md"))}</h2>
      ${recommendationItems}
    </div>
    ` : ""}

    ${report.quickRatio || report.pmfScore || report.mrrForecast || report.scenarios ? `
    <div class="section">
      <h2 class="section-title">🔮 ${escapeHtml(t("section.crystal_ball"))}</h2>
      <div class="crystal-ball-section">
        ${report.quickRatio ? renderQuickRatio(report.quickRatio) : ""}
        ${report.pmfScore ? renderPMFScore(report.pmfScore) : ""}
        ${report.mrrForecast ? renderMRRForecast(report.mrrForecast) : ""}
        ${report.scenarios ? renderScenarios(report.scenarios) : ""}
      </div>
    </div>
    ` : ""}

    ${report.flywheel ? `
    <div class="section">
      <h2 class="section-title">🔄 Flywheel Insights</h2>
      ${renderFlywheelHtml(report.flywheel)}
    </div>
    ` : ""}

    ${report.keywordAnalysis || report.offeringAnalysis ? `
    <div class="section">
      <h2 class="section-title">🎯 ${escapeHtml(t("section.strategy"))}</h2>
      ${report.keywordAnalysis ? renderKeywordAnalysis(report.keywordAnalysis) : ""}
      ${report.offeringAnalysis ? renderOfferingAnalysis(report.offeringAnalysis) : ""}
    </div>
    ` : ""}

    ${report.nextProductSuggestions && report.nextProductSuggestions.length > 0 ? `
    <div class="section">
      <h2 class="section-title">🚀 ${escapeHtml(t("section.next_product_ideas"))}</h2>
      <div class="scenarios-grid">
        ${report.nextProductSuggestions.map((s) => {
          const dirIcons: Record<string, string> = { vertical: "↕️", horizontal: "↔️", adjacent: "🔀" };
          const icon = dirIcons[s.direction] ?? "💡";
          const scoreStars = "★".repeat(Math.min(s.score, 5)) + "☆".repeat(Math.max(5 - s.score, 0));
          return `
          <div class="scenario-card">
            <div class="scenario-name">${icon} ${escapeHtml(s.title)}</div>
            <div class="scenario-description">${escapeHtml(s.directionLabel)}</div>
            <div style="color: var(--yellow); margin-bottom: 0.5rem;">${scoreStars}</div>
            <div class="scenario-narrative">${escapeHtml(s.rationale)}</div>
            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--gray-500);">
              ${escapeHtml(t("product.complexity"))}: ${escapeHtml(s.implementationComplexity)} | ${escapeHtml(t("product.source"))}: ${escapeHtml(s.source)}
            </div>
          </div>`;
        }).join("\n")}
      </div>
    </div>
    ` : ""}

    ${report.agentPlan ? `
    <div class="section">
      <h2 class="section-title">🤖 ${escapeHtml(t("section.agent_plan"))}</h2>
      <div class="crystal-ball-section">
        <p class="forecast-narrative">${escapeHtml(report.agentPlan.summary)}</p>
        <table class="benchmark-table">
          <thead><tr><th>${escapeHtml(t("table.action_id"))}</th><th>${escapeHtml(t("table.action"))}</th><th>${escapeHtml(t("table.mcp_tool"))}</th><th>${escapeHtml(t("table.priority"))}</th><th>${escapeHtml(t("table.expected_impact"))}</th></tr></thead>
          <tbody>
            ${report.agentPlan.actions.map((a) => `
              <tr>
                <td>${a.id}</td>
                <td>${escapeHtml(a.description)}</td>
                <td><code>${escapeHtml(a.mcpTool)}</code></td>
                <td>${escapeHtml(a.priority)}</td>
                <td>${escapeHtml(a.expectedImpact)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p style="font-weight: 700; color: var(--purple-primary); margin-top: 1rem;">
          ${escapeHtml(t("agent.estimated_impact"))}: ${escapeHtml(report.agentPlan.estimatedMRRImpact)}
        </p>
        <p style="font-size: 0.8rem; color: var(--gray-500); font-style: italic;">
          ${escapeHtml(report.agentPlan.disclaimer)}
        </p>
      </div>
    </div>
    ` : ""}

    <div class="section">
      <h2 class="section-title">📏 ${escapeHtml(t("section.benchmarks"))}</h2>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>${escapeHtml(t("table.metric"))}</th>
            <th>${escapeHtml(t("table.median"))}</th>
            <th>${escapeHtml(t("table.top_25"))}</th>
            <th>${escapeHtml(t("table.bottom_25"))}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>${escapeHtml(t("benchmark.trial_conversion"))}</td><td>35%</td><td>55%</td><td>20%</td></tr>
          <tr><td>${escapeHtml(t("benchmark.monthly_churn"))}</td><td>6%</td><td>3.5%</td><td>8%</td></tr>
          <tr><td>${escapeHtml(t("benchmark.refund_rate"))}</td><td>3%</td><td>1.5%</td><td>5%</td></tr>
          <tr><td>${escapeHtml(t("benchmark.mrr"))}</td><td>$2,000</td><td>$10,000</td><td>$500</td></tr>
          <tr><td>${escapeHtml(t("benchmark.ltv_per_customer"))}</td><td>$3.50</td><td>$8.00</td><td>$1.00</td></tr>
        </tbody>
      </table>
    </div>

  </div>

  <div class="footer">
    ${t("footer.generated_by_html")}
  </div>

</body>
</html>`;
}
