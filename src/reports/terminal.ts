// ========================================
// 終端機美化輸出
// 使用 chalk 色彩和 Unicode box-drawing 字元
// ========================================

import chalk from "chalk";
import type {
  HealthReport,
  MetricHealth,
  Recommendation,
  Anomaly,
  KeywordAnalysisResult,
  OfferingAnalysisResult,
  NextProductSuggestion,
  AgentPlanResult,
  FlywheelResult,
  FlywheelInsight,
} from "../api/types.ts";
import type { QuickRatioResult } from "../analysis/quick-ratio.ts";
import type { PMFScoreResult } from "../analysis/pmf-score.ts";
import type { MRRForecastResult } from "../analysis/mrr-forecast.ts";
import type { ScenarioAnalysisResult } from "../analysis/scenario-engine.ts";
import { formatCurrency, formatPercent, formatNumber, formatChange } from "../utils/formatting.ts";
import { t, tMetric, tTrend, tQRGrade, tPMFGrade } from "../i18n/index.ts";

/** 健康狀態對應的圖示 */
const STATUS_ICON: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
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
  const title = `  📊 ${projectName} — ${t("header.subtitle")}`;
  const subtitle = `     ${t("header.report_by")}`;
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
    // 優先使用 i18n 翻譯名稱，fallback 到 API 顯示名稱
    const name = tMetric(metric.metricId, metric.name).padEnd(16);
    const value = formatMetricValue(metric.value, metric.unit).padStart(10);
    const trend = tTrend(metric.trend);
    const change = metric.changePercent !== 0 ? ` (${formatChange(metric.changePercent)} ${t("misc.mom")})` : "";

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
        ? chalk.gray(` (${t("misc.benchmark_label")}: ${formatMetricValue(metric.benchmark, metric.unit)})`)
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
    return chalk.gray(`  ${t("anomaly.none")}`);
  }

  const lines: string[] = [];
  for (const anomaly of anomalies.slice(0, 5)) {
    const icon = anomaly.type === "spike" ? chalk.yellow("⚡") : chalk.red("📉");
    const magnitude = chalk.bold(
      anomaly.type === "spike"
        ? chalk.yellow(`+${anomaly.magnitude.toFixed(1)}%`)
        : chalk.red(`-${anomaly.magnitude.toFixed(1)}%`),
    );
    lines.push(`  ${icon} ${chalk.white(anomaly.metric)} ${magnitude} ${t("anomaly.on")} ${chalk.gray(anomaly.date)}`);
  }

  return lines.join("\n");
}

/**
 * 將內部指標名稱轉為顯示名稱（已由 i18n tMetric() 取代，保留供 fallback）
 */
function getDisplayName(metricId: string): string {
  return tMetric(metricId, metricId);
}

// ========================================
// Crystal Ball 區塊
// ========================================

/**
 * 繪製 Quick Ratio 區塊
 */
function renderQuickRatio(qr: QuickRatioResult): string {
  const lines: string[] = [];

  // Grade 顏色
  const gradeColor =
    qr.grade === "excellent" || qr.grade === "healthy"
      ? chalk.green
      : qr.grade === "concerning"
        ? chalk.yellow
        : chalk.red;

  lines.push(`  ${chalk.bold(`${t("qr.title")}:`)} ${chalk.bold.white(qr.current.toFixed(2))} ${gradeColor(`[${tQRGrade(qr.grade).toUpperCase()}]`)}`);
  lines.push(`  ${chalk.gray(qr.interpretation)}`);
  lines.push("");

  // 時間序列 — 最近 3 個月
  const recent = qr.timeSeries.slice(-3);
  if (recent.length > 0) {
    lines.push(`  ${chalk.gray(t("table.date").padEnd(12))} ${chalk.gray(t("table.ratio").padStart(8))} ${chalk.gray(t("table.inflow").padStart(10))} ${chalk.gray(t("table.outflow").padStart(10))}`);
    for (const row of recent) {
      const ratioColor = row.ratio >= 2 ? chalk.green : row.ratio >= 1 ? chalk.yellow : chalk.red;
      lines.push(
        `  ${chalk.white(row.date.padEnd(12))} ${ratioColor(row.ratio.toFixed(2).padStart(8))} ${chalk.green(formatCurrency(row.inflow).padStart(10))} ${chalk.red(formatCurrency(row.outflow).padStart(10))}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * 繪製 PMF Score 區塊
 */
function renderPMFScore(pmf: PMFScoreResult): string {
  const lines: string[] = [];

  const gradeColor =
    pmf.grade === "Strong PMF"
      ? chalk.green
      : pmf.grade === "Approaching PMF"
        ? chalk.yellow
        : chalk.red;

  lines.push(`  ${chalk.bold(`${t("pmf.title")}:`)} ${chalk.bold.white(`${pmf.score}/100`)} ${gradeColor(`[${tPMFGrade(pmf.grade)}]`)}`);
  lines.push("");

  // Breakdown 表格
  lines.push(`  ${chalk.gray(t("table.factor").padEnd(30))} ${chalk.gray(t("table.raw_value").padStart(8))} ${chalk.gray(t("table.score").padStart(7))} ${chalk.gray(t("table.weight").padStart(7))}`);
  for (const b of pmf.breakdown) {
    const scoreColor = b.score >= 60 ? chalk.green : b.score >= 40 ? chalk.yellow : chalk.red;
    lines.push(
      `  ${chalk.white(b.factor.padEnd(30))} ${chalk.white(b.rawValue.toFixed(1).padStart(8))} ${scoreColor(b.score.toFixed(0).padStart(7))} ${chalk.gray((b.weight * 100).toFixed(0).padStart(6) + "%")}`,
    );
  }
  lines.push("");

  // Diagnosis
  lines.push(`  ${chalk.gray(`${t("pmf.diagnosis_label")}:`)} ${pmf.diagnosis}`);
  lines.push("");

  // Decision Advice
  lines.push(`  ${chalk.bold(`${t("pmf.verdict_label")}:`)} ${pmf.decisionAdvice.verdict}`);
  for (const action of pmf.decisionAdvice.topActions) {
    lines.push(`     ${chalk.gray("→")} ${action}`);
  }

  return lines.join("\n");
}

/**
 * 繪製 MRR Forecast 區塊
 */
function renderMRRForecast(forecast: MRRForecastResult): string {
  const lines: string[] = [];

  lines.push(`  ${chalk.gray(forecast.narrative)}`);
  lines.push("");

  // Predictions 表格
  lines.push(`  ${chalk.gray(t("table.month").padEnd(10))} ${chalk.gray(t("table.base").padStart(10))} ${chalk.gray(t("table.optimistic").padStart(12))} ${chalk.gray(t("table.pessimistic").padStart(12))}`);
  for (const p of forecast.predictions) {
    lines.push(
      `  ${chalk.white(p.month.padEnd(10))} ${chalk.bold(formatCurrency(p.base).padStart(10))} ${chalk.green(formatCurrency(p.optimistic).padStart(12))} ${chalk.red(formatCurrency(p.pessimistic).padStart(12))}`,
    );
  }

  return lines.join("\n");
}

/**
 * 繪製 Scenarios 區塊
 */
function renderScenarios(scenarios: ScenarioAnalysisResult): string {
  const lines: string[] = [];

  lines.push(`  ${chalk.bold(`${t("scenario.best_scenario")}:`)} ${chalk.green(scenarios.bestScenario)}`);
  lines.push("");

  // Scenario 表格
  lines.push(`  ${chalk.gray(t("table.scenario").padEnd(22))} ${chalk.gray(t("table.description").padEnd(40))} ${chalk.gray(t("table.mrr_12m").padStart(10))} ${chalk.gray(t("table.delta_pct").padStart(8))}`);
  for (const s of scenarios.scenarios) {
    const deltaColor = s.improvement.month12Delta >= 0 ? chalk.green : chalk.red;
    const sign = s.improvement.month12Delta >= 0 ? "+" : "";
    const signPct = s.improvement.month12DeltaPercent >= 0 ? "+" : "";
    lines.push(
      `  ${chalk.white(s.name.padEnd(22))} ${chalk.gray(s.description.slice(0, 40).padEnd(40))} ${deltaColor((sign + formatCurrency(s.improvement.month12Delta)).padStart(10))} ${deltaColor((signPct + s.improvement.month12DeltaPercent.toFixed(1) + "%").padStart(8))}`,
    );
  }
  lines.push("");

  // Combined narrative
  lines.push(`  ${chalk.gray(scenarios.combinedNarrative)}`);

  return lines.join("\n");
}

/**
 * 繪製完整 Crystal Ball 區塊
 */
function renderCrystalBall(report: HealthReport): string {
  const sections: string[] = [];
  let hasContent = false;

  if (report.quickRatio) {
    sections.push(renderQuickRatio(report.quickRatio));
    sections.push("");
    hasContent = true;
  }

  if (report.pmfScore) {
    sections.push(renderPMFScore(report.pmfScore));
    sections.push("");
    hasContent = true;
  }

  if (report.mrrForecast) {
    sections.push(renderMRRForecast(report.mrrForecast));
    sections.push("");
    hasContent = true;
  }

  if (report.scenarios) {
    sections.push(renderScenarios(report.scenarios));
    hasContent = true;
  }

  if (!hasContent) return "";

  return [renderSectionTitle(`🔮 ${t("section.crystal_ball")}`), ...sections].join("\n");
}

// ========================================
// Flywheel 區塊
// ========================================

/** 每層的圖示與標籤 */
const LAYER_META: Record<number, { icon: string; label: string; tag: string }> = {
  1: { icon: "📊", label: "Your Data", tag: "Free" },
  2: { icon: "👥", label: "Peer Comparison", tag: "$" },
  3: { icon: "🏷️", label: "Category Intelligence", tag: "$" },
  4: { icon: "🌍", label: "Market Opportunity", tag: "$" },
};

/**
 * 繪製 Flywheel 區塊
 */
function renderFlywheel(fw: FlywheelResult): string {
  const lines: string[] = [];

  // Narrative
  lines.push(`  ${chalk.gray(fw.flyWheelNarrative)}`);
  lines.push("");

  // Group insights by layer
  const byLayer = new Map<number, FlywheelInsight[]>();
  for (const insight of fw.insights) {
    const arr = byLayer.get(insight.layer) ?? [];
    arr.push(insight);
    byLayer.set(insight.layer, arr);
  }

  // Render each layer (1-4)
  for (let layer = 1; layer <= 4; layer++) {
    const meta = LAYER_META[layer]!;
    const insights = byLayer.get(layer) ?? [];
    const isFree = layer <= fw.currentLayer;

    // Layer header
    const tagColor = isFree ? chalk.green : chalk.gray;
    lines.push(`  ${meta.icon} ${chalk.bold.white(`Layer ${layer}: ${meta.label}`)} ${tagColor(`(${meta.tag})`)}`);

    if (insights.length === 0) {
      lines.push(chalk.gray(`     No insights for this layer`));
    } else if (isFree) {
      // Free layer — full display
      for (const insight of insights) {
        lines.push(`     ${chalk.green("•")} ${chalk.white(insight.title)}`);
        lines.push(`       ${chalk.gray(insight.description)}`);
        if (insight.actionUrl) {
          lines.push(`       ${chalk.cyan("Do This →")} ${chalk.underline.cyan(insight.actionUrl)}`);
        }
        if (insight.estimatedValue) {
          lines.push(`       ${chalk.gray(`Value: ${insight.estimatedValue}`)}`);
        }
      }
    } else {
      // Premium layer — teaser only
      for (const insight of insights) {
        lines.push(`     ${chalk.gray("🔒")} ${chalk.gray(insight.title)}`);
      }
    }

    lines.push("");
  }

  // Current level + next teaser
  lines.push(`  ${chalk.bold.white(`Current Level: ${fw.currentLayer}/4`)} ${chalk.gray("|")} ${chalk.cyan(`Next: ${fw.nextLayerTeaser}`)}`);

  return lines.join("\n");
}

// ========================================
// Strategy 區塊
// ========================================

/**
 * 繪製 Keyword Analysis 區塊
 */
function renderKeywordAnalysis(kw: KeywordAnalysisResult): string {
  const lines: string[] = [];

  lines.push(`  ${chalk.gray(kw.narrative)}`);
  lines.push("");

  // Top 5 keywords 表格
  const top5 = kw.keywords.slice(0, 5);
  if (top5.length > 0) {
    lines.push(`  ${chalk.gray(t("table.keyword").padEnd(24))} ${chalk.gray(t("table.trials").padStart(8))} ${chalk.gray(t("table.revenue").padStart(10))} ${chalk.gray(t("table.efficiency").padStart(12))}`);
    for (const k of top5) {
      const effColor =
        k.efficiency === "high" ? chalk.green : k.efficiency === "medium" ? chalk.yellow : chalk.red;
      lines.push(
        `  ${chalk.white(k.keyword.slice(0, 24).padEnd(24))} ${chalk.white(formatNumber(k.totalTrials).padStart(8))} ${chalk.white(formatCurrency(k.totalRevenue).padStart(10))} ${effColor(k.efficiency.toUpperCase().padStart(12))}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * 繪製 Offering Analysis 區塊
 */
function renderOfferingAnalysis(oa: OfferingAnalysisResult): string {
  const lines: string[] = [];

  lines.push(`  ${chalk.gray(oa.narrative)}`);
  lines.push("");

  // Offerings 表格
  if (oa.offerings.length > 0) {
    lines.push(`  ${chalk.gray(t("table.offering").padEnd(24))} ${chalk.gray(t("table.trials").padStart(8))} ${chalk.gray(t("table.conversion").padStart(8))} ${chalk.gray(t("table.revenue").padStart(10))} ${chalk.gray(t("table.performance").padStart(10))}`);
    for (const o of oa.offerings) {
      const perfColor =
        o.performance === "top" ? chalk.green : o.performance === "average" ? chalk.yellow : chalk.red;
      const convStr = o.conversionRate !== null ? formatPercent(o.conversionRate) : t("misc.na");
      lines.push(
        `  ${chalk.white(o.offeringName.slice(0, 24).padEnd(24))} ${chalk.white(formatNumber(o.trialStarts).padStart(8))} ${chalk.white(convStr.padStart(8))} ${chalk.white(formatCurrency(o.revenue).padStart(10))} ${perfColor(o.performance.toUpperCase().padStart(10))}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * 繪製完整 Strategy 區塊
 */
function renderStrategy(report: HealthReport): string {
  const sections: string[] = [];
  let hasContent = false;

  if (report.keywordAnalysis?.hasAttributionData) {
    sections.push(renderKeywordAnalysis(report.keywordAnalysis));
    sections.push("");
    hasContent = true;
  }

  if (report.offeringAnalysis && report.offeringAnalysis.offerings.length > 0) {
    sections.push(renderOfferingAnalysis(report.offeringAnalysis));
    hasContent = true;
  }

  if (!hasContent) return "";

  return [renderSectionTitle(`🎯 ${t("section.strategy")}`), ...sections].join("\n");
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
    chalk.gray(`  ${t("header.generated")}: ${new Date(report.generatedAt).toLocaleString()}`),
  );

  // ★ Executive Summary（報告最上面的關鍵提煉）
  if (report.executiveSummary) {
    const es = report.executiveSummary;
    const gradeColor =
      es.healthGrade === "Excellent" ? chalk.green :
      es.healthGrade === "Good" ? chalk.cyan :
      es.healthGrade === "Fair" ? chalk.yellow : chalk.red;

    sections.push("");
    sections.push(`  ${gradeColor.bold(`[${es.healthGrade.toUpperCase()}]`)} ${chalk.bold.white(es.headline)}`);
    sections.push(`  ${chalk.gray(`Health Score: ${es.healthScore}/100`)}`);
    sections.push("");

    for (const insight of es.keyInsights) {
      const uColor = insight.urgency === "high" ? chalk.red : insight.urgency === "medium" ? chalk.yellow : chalk.green;
      sections.push(`  ${insight.icon} ${uColor.bold(insight.title)}`);
      sections.push(`     ${chalk.gray(insight.detail)}`);
    }
    sections.push("");
    sections.push(`  ${chalk.bold.cyan("→ #1 Action:")} ${chalk.bold(es.topAction.title)}`);
    sections.push(`     ${chalk.gray(es.topAction.reason)} → ${chalk.green(es.topAction.expectedImpact)}`);
    sections.push(`  ${chalk.gray(`Flywheel Layer ${es.flywheelLevel.current}/4: ${es.flywheelLevel.label}`)}`);
  }

  // 概覽指標
  sections.push(renderSectionTitle(t("section.overview")));
  sections.push(renderMetricsTable(report.metrics));

  // 異常偵測
  if (report.anomalies.length > 0) {
    sections.push(renderSectionTitle(`⚠️  ${t("section.anomalies")}`));
    sections.push(renderAnomalies(report.anomalies));
  }

  // 建議
  if (report.recommendations.length > 0) {
    sections.push(renderSectionTitle(`💡 ${t("section.recommendations")}`));
    sections.push(renderRecommendations(report.recommendations));
  }

  // Crystal Ball
  const crystalBall = renderCrystalBall(report);
  if (crystalBall) {
    sections.push(crystalBall);
  }

  // Flywheel
  if (report.flywheel) {
    sections.push(renderSectionTitle("🔄 Flywheel Insights"));
    sections.push(renderFlywheel(report.flywheel));
  }

  // Strategy
  const strategy = renderStrategy(report);
  if (strategy) {
    sections.push(strategy);
  }

  // Next Product Suggestions
  if (report.nextProductSuggestions && report.nextProductSuggestions.length > 0) {
    sections.push(renderSectionTitle(`🚀 ${t("section.next_product_ideas")}`));
    const npLines: string[] = [];
    const dirIcons: Record<string, string> = {
      vertical: "↕️",
      horizontal: "↔️",
      adjacent: "🔀",
    };
    for (const s of report.nextProductSuggestions) {
      const icon = dirIcons[s.direction] ?? "💡";
      const scoreStars = "★".repeat(Math.min(s.score, 5)) + "☆".repeat(Math.max(5 - s.score, 0));
      npLines.push(`  ${icon} ${chalk.bold(s.title)} ${chalk.gray(`[${s.directionLabel}]`)} ${chalk.yellow(scoreStars)}`);
      npLines.push(`     ${chalk.gray(s.rationale.slice(0, 100))}${s.rationale.length > 100 ? "..." : ""}`);
      npLines.push(`     ${chalk.gray(`${t("product.complexity")}: ${s.implementationComplexity} | ${t("product.source")}: ${s.source}`)}`);
      npLines.push("");
    }
    sections.push(npLines.join("\n"));
  }

  // Agent Plan
  if (report.agentPlan) {
    sections.push(renderSectionTitle(`🤖 ${t("section.agent_plan")}`));
    const apLines: string[] = [];
    apLines.push(`  ${chalk.gray(report.agentPlan.summary)}`);
    apLines.push("");
    for (const action of report.agentPlan.actions) {
      const priorityColor = action.priority === "immediate" ? chalk.red : action.priority === "this_week" ? chalk.yellow : chalk.gray;
      apLines.push(`  ${chalk.bold(`${action.id}.`)} ${chalk.white(action.description)}`);
      apLines.push(`     ${chalk.cyan(`MCP: ${action.mcpTool}`)} ${priorityColor(`[${action.priority}]`)} → ${chalk.green(action.expectedImpact)}`);
    }
    apLines.push("");
    apLines.push(`  ${chalk.bold(`${t("agent.estimated_impact")}:`)} ${chalk.green(report.agentPlan.estimatedMRRImpact)}`);
    apLines.push(`  ${chalk.gray(report.agentPlan.disclaimer)}`);
    sections.push(apLines.join("\n"));
  }

  // 底部
  sections.push("");
  sections.push(
    chalk.gray("  ─".repeat(20)),
  );
  sections.push(
    chalk.gray(`  ${t("footer.generated_by")}`),
  );
  sections.push("");

  return sections.join("\n");
}
