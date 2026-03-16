// ========================================
// HTML 報告產生器
// 使用模板引擎產生獨立 HTML 檔案（含內嵌 CSS）
// ========================================

import type { HealthReport, MetricHealth, Recommendation, Anomaly } from "../api/types.ts";
import { formatCurrency, formatPercent, formatNumber, formatChange } from "../utils/formatting.ts";

/** 指標顯示名稱 */
const DISPLAY_NAMES: Record<string, string> = {
  mrr: "MRR",
  arr: "ARR",
  churn: "Churn Rate",
  trial_conversion_rate: "Trial → Paid",
  revenue: "Revenue",
  actives: "Active Subscribers",
  customers_new: "New Customers",
  trials_new: "New Trials",
  refund_rate: "Refund Rate",
  ltv_per_customer: "LTV per Customer",
};

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
 * 格式化數值
 */
function formatValue(value: number, unit: string): string {
  switch (unit) {
    case "$":
      return formatCurrency(value);
    case "%":
      return formatPercent(value);
    case "#":
      return formatNumber(value);
    default:
      return value.toLocaleString("en-US");
  }
}

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
  const name = DISPLAY_NAMES[metric.name] ?? metric.name;
  const value = formatValue(metric.value, metric.unit);
  const dot = STATUS_DOT[metric.status] ?? "⚪";
  const statusClass = STATUS_CLASS[metric.status] ?? "";
  const change = metric.changePercent !== 0 ? formatChange(metric.changePercent) : "";
  const changeClass = metric.changePercent > 0 ? "change-positive" : metric.changePercent < 0 ? "change-negative" : "";
  const benchmark = metric.benchmark > 0 ? formatValue(metric.benchmark, metric.unit) : "";

  return `
    <div class="metric-card ${statusClass}">
      <div class="metric-header">
        <span class="metric-name">${escapeHtml(name)}</span>
        <span class="metric-status">${dot}</span>
      </div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-details">
        ${change ? `<span class="metric-change ${changeClass}">${escapeHtml(change)} MoM</span>` : ""}
        ${benchmark ? `<span class="metric-benchmark">Benchmark: ${escapeHtml(benchmark)}</span>` : ""}
      </div>
      <div class="metric-trend">${escapeHtml(metric.trend)}</div>
    </div>`;
}

/**
 * 產生建議 HTML
 */
function renderRecommendationItem(rec: Recommendation, index: number): string {
  const impactClass = `impact-${rec.impact}`;
  const relatedName = DISPLAY_NAMES[rec.relatedMetric] ?? rec.relatedMetric;

  return `
    <div class="recommendation-item">
      <div class="rec-header">
        <span class="rec-number">${index + 1}</span>
        <span class="rec-title">${escapeHtml(rec.title)}</span>
        <span class="rec-impact ${impactClass}">${escapeHtml(rec.impact.toUpperCase())}</span>
      </div>
      <p class="rec-description">${escapeHtml(rec.description)}</p>
      <span class="rec-related">Related: ${escapeHtml(relatedName)}</span>
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
      const name = DISPLAY_NAMES[m.name] ?? m.name;
      const width = calculateBarWidth(m);
      const colorClass = STATUS_CLASS[m.status] ?? "";
      const value = formatValue(m.value, m.unit);

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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.projectName)} — Subscription Health Report</title>
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

    /* === RWD === */
    @media (max-width: 640px) {
      .summary-bar { flex-direction: column; align-items: center; }
      .metrics-grid { grid-template-columns: 1fr; }
      .bar-label { width: 100px; font-size: 0.75rem; }
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>📊 ${escapeHtml(report.projectName)}</h1>
    <div class="subtitle">Subscription Health Report — ${escapeHtml(dateStr)}</div>
  </div>

  <div class="container">

    <div class="summary-bar">
      <div class="summary-item">
        <div class="count count-green">${greenCount}</div>
        <div class="label">Healthy</div>
      </div>
      <div class="summary-item">
        <div class="count count-yellow">${yellowCount}</div>
        <div class="label">Attention</div>
      </div>
      <div class="summary-item">
        <div class="count count-red">${redCount}</div>
        <div class="label">Critical</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">📈 Metrics Overview</h2>
      <div class="metrics-grid">
        ${metricCards}
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">📊 Health Score Chart</h2>
      ${healthBars}
    </div>

    ${report.anomalies.length > 0 ? `
    <div class="section">
      <h2 class="section-title">⚠️ Anomalies Detected</h2>
      ${anomalyItems}
    </div>
    ` : ""}

    ${report.recommendations.length > 0 ? `
    <div class="section">
      <h2 class="section-title">💡 Recommendations</h2>
      ${recommendationItems}
    </div>
    ` : ""}

    <div class="section">
      <h2 class="section-title">📏 SOSA 2026 Benchmarks</h2>
      <table class="benchmark-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Median</th>
            <th>Top 25%</th>
            <th>Bottom 25%</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Trial Conversion</td><td>35%</td><td>55%</td><td>20%</td></tr>
          <tr><td>Monthly Churn</td><td>6%</td><td>3.5%</td><td>8%</td></tr>
          <tr><td>Refund Rate</td><td>3%</td><td>1.5%</td><td>5%</td></tr>
          <tr><td>MRR</td><td>$2,000</td><td>$10,000</td><td>$500</td></tr>
          <tr><td>LTV per Customer</td><td>$3.50</td><td>$8.00</td><td>$1.00</td></tr>
        </tbody>
      </table>
    </div>

  </div>

  <div class="footer">
    Generated by <a href="https://github.com/nicething/rc-insights">rc-insights</a> — an AI-powered tool for RevenueCat Charts API
  </div>

</body>
</html>`;
}
