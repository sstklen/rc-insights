// ========================================
// 終端機美化輸出
// 使用 chalk 色彩和 Unicode box-drawing 字元
// ========================================

import chalk from "chalk";
import type { HealthReport, MetricHealth, Recommendation, Anomaly } from "../api/types.ts";
import { formatCurrency, formatPercent, formatNumber, formatChange } from "../utils/formatting.ts";

/** 健康狀態對應的圖示 */
const STATUS_ICON: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/** 趨勢方向對應的文字 */
const TREND_LABEL: Record<string, string> = {
  growing: "Growing",
  stable: "Stable",
  declining: "Declining",
};

/** 影響等級對應的色彩 */
function impactColor(impact: string): (text: string) => string {
  switch (impact) {
    case "high":
      return chalk.red;
    case "medium":
      return chalk.yellow;
    default:
      return chalk.gray;
  }
}

/**
 * 根據單位格式化數值
 */
function formatMetricValue(value: number, unit: string): string {
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
 * 繪製頂部標題框
 */
function renderHeader(projectName: string): string {
  const title = `  📊 ${projectName} — Subscription Health`;
  const subtitle = "     Report by rc-insights";
  const width = Math.max(title.length, subtitle.length) + 4;
  const border = "─".repeat(width);

  return [
    "",
    chalk.cyan(`  ┌${border}┐`),
    chalk.cyan(`  │`) + chalk.bold.white(title.padEnd(width)) + chalk.cyan("│"),
    chalk.cyan(`  │`) + chalk.gray(subtitle.padEnd(width)) + chalk.cyan("│"),
    chalk.cyan(`  └${border}┘`),
    "",
  ].join("\n");
}

/**
 * 繪製分隔線標題
 */
function renderSectionTitle(title: string): string {
  return [
    "",
    chalk.bold.white(`  ${title}`),
    chalk.gray(`  ${"─".repeat(40)}`),
  ].join("\n");
}

/**
 * 繪製概覽指標表格
 */
function renderMetricsTable(metrics: MetricHealth[]): string {
  const lines: string[] = [];

  // 排序：紅色優先，然後黃色，最後綠色
  const statusOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...metrics].sort(
    (a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1),
  );

  for (const metric of sorted) {
    const icon = STATUS_ICON[metric.status] ?? "⚪";
    const name = getDisplayName(metric.name).padEnd(16);
    const value = formatMetricValue(metric.value, metric.unit).padStart(10);
    const trend = TREND_LABEL[metric.trend] ?? "Unknown";
    const change = metric.changePercent !== 0 ? ` (${formatChange(metric.changePercent)} MoM)` : "";

    let trendColored: string;
    switch (metric.trend) {
      case "growing":
        trendColored = chalk.green(`${trend}${change}`);
        break;
      case "declining":
        trendColored = chalk.red(`${trend}${change}`);
        break;
      default:
        trendColored = chalk.gray(`${trend}${change}`);
    }

    // 基準比較
    const benchmarkNote =
      metric.benchmark > 0
        ? chalk.gray(` (benchmark: ${formatMetricValue(metric.benchmark, metric.unit)})`)
        : "";

    lines.push(`  ${icon} ${chalk.white(name)} ${chalk.bold(value)}  ${trendColored}${benchmarkNote}`);
  }

  return lines.join("\n");
}

/**
 * 繪製建議區塊
 */
function renderRecommendations(recommendations: Recommendation[], maxCount = 5): string {
  const lines: string[] = [];
  const top = recommendations.slice(0, maxCount);

  for (let i = 0; i < top.length; i++) {
    const rec = top[i]!;
    const impactLabel = impactColor(rec.impact)(`[${rec.impact.toUpperCase()}]`);
    lines.push(`  ${chalk.bold.white(`${i + 1}.`)} ${chalk.bold(rec.title)} ${impactLabel}`);
    lines.push(`     ${chalk.gray("→")} ${rec.description}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 繪製異常區塊
 */
function renderAnomalies(anomalies: Anomaly[]): string {
  if (anomalies.length === 0) {
    return chalk.gray("  No anomalies detected in the analyzed period.");
  }

  const lines: string[] = [];
  for (const anomaly of anomalies.slice(0, 5)) {
    const icon = anomaly.type === "spike" ? chalk.yellow("⚡") : chalk.red("📉");
    const magnitude = chalk.bold(
      anomaly.type === "spike"
        ? chalk.yellow(`+${anomaly.magnitude.toFixed(1)}%`)
        : chalk.red(`-${anomaly.magnitude.toFixed(1)}%`),
    );
    lines.push(`  ${icon} ${chalk.white(anomaly.metric)} ${magnitude} on ${chalk.gray(anomaly.date)}`);
  }

  return lines.join("\n");
}

/**
 * 將內部指標名稱轉為顯示名稱
 */
function getDisplayName(metricId: string): string {
  const names: Record<string, string> = {
    mrr: "MRR",
    arr: "ARR",
    churn: "Churn Rate",
    trial_conversion_rate: "Trial → Paid",
    revenue: "Revenue",
    actives: "Active Subs",
    customers_new: "New Customers",
    trials_new: "New Trials",
    refund_rate: "Refund Rate",
    ltv_per_customer: "LTV/Customer",
  };
  return names[metricId] ?? metricId;
}

/**
 * 產生完整的終端機報告
 * @param report - 健康報告資料
 * @returns 格式化的終端機輸出字串
 */
export function renderTerminalReport(report: HealthReport): string {
  const sections: string[] = [];

  // 標題
  sections.push(renderHeader(report.projectName));

  // 產生時間
  sections.push(
    chalk.gray(`  Generated: ${new Date(report.generatedAt).toLocaleString()}`),
  );

  // 概覽指標
  sections.push(renderSectionTitle("Overview (Last 28 days)"));
  sections.push(renderMetricsTable(report.metrics));

  // 異常偵測
  if (report.anomalies.length > 0) {
    sections.push(renderSectionTitle("⚠️  Anomalies Detected"));
    sections.push(renderAnomalies(report.anomalies));
  }

  // 建議
  if (report.recommendations.length > 0) {
    sections.push(renderSectionTitle("💡 Key Insights & Recommendations"));
    sections.push(renderRecommendations(report.recommendations));
  }

  // 底部
  sections.push("");
  sections.push(
    chalk.gray("  ─".repeat(20)),
  );
  sections.push(
    chalk.gray("  Generated by rc-insights — AI-powered subscription health analysis"),
  );
  sections.push("");

  return sections.join("\n");
}
