// ========================================
// Markdown 報告產生器
// 產生可直接分享的 .md 檔案
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
import { t, tMetric, tTrendIcon, tQRGradeIcon, tPMFGradeIcon } from "../i18n/index.ts";

/** 健康狀態圖示 */
const STATUS_ICON: Record<string, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

/** 效率等級圖示 */
const EFFICIENCY_ICON: Record<string, string> = {
  high: "🟢",
  medium: "🟡",
  low: "🔴",
};

/** Offering 表現等級圖示 */
const PERFORMANCE_ICON: Record<string, string> = {
  top: "🟢",
  average: "🟡",
  below: "🔴",
};

/**
 * 產生 Markdown 報告
 * @param report - 健康報告資料
 * @returns Markdown 字串
 */
export function renderMarkdownReport(report: HealthReport): string {
  const lines: string[] = [];

  // 標題
  lines.push(`# 📊 ${report.projectName} — ${t("header.subscription_health_report")}`);
  lines.push("");
  lines.push(`> ${t("header.report_by")} — ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push("");

  // 概覽表格
  lines.push(`## ${t("section.overview_md")}`);
  lines.push("");
  lines.push(`| ${t("table.metric")} | ${t("table.value")} | ${t("table.status")} | ${t("table.trend")} | ${t("table.mom_change")} | ${t("table.benchmark")} |`);
  lines.push("|--------|------:|:------:|-------|------------|-----------|");

  // 排序：紅色優先
  const statusOrder: Record<string, number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...report.metrics].sort(
    (a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1),
  );

  for (const metric of sorted) {
    const name = tMetric(metric.metricId, metric.name);
    const value = formatByUnit(metric.value, metric.unit);
    const icon = STATUS_ICON[metric.status] ?? "⚪";
    const trend = tTrendIcon(metric.trend);
    const change = metric.changePercent !== 0 ? formatChange(metric.changePercent) : "—";
    const benchmark = metric.benchmark > 0 ? formatByUnit(metric.benchmark, metric.unit) : "—";

    lines.push(`| ${name} | ${value} | ${icon} | ${trend} | ${change} | ${benchmark} |`);
  }

  lines.push("");

  // 異常偵測
  if (report.anomalies.length > 0) {
    lines.push(`## ⚠️ ${t("section.anomalies")}`);
    lines.push("");

    for (const anomaly of report.anomalies) {
      const icon = anomaly.type === "spike" ? "⚡" : "📉";
      lines.push(
        `- ${icon} **${anomaly.metric}**: ${anomaly.type === "spike" ? "+" : "-"}${anomaly.magnitude.toFixed(1)}% on ${anomaly.date} — ${anomaly.description}`,
      );
    }

    lines.push("");
  }

  // 建議
  if (report.recommendations.length > 0) {
    lines.push(`## 💡 ${t("section.recommendations_md")}`);
    lines.push("");

    for (let i = 0; i < report.recommendations.length; i++) {
      const rec = report.recommendations[i]!;
      const impactIcon = rec.impact === "high" ? "🔴" : rec.impact === "medium" ? "🟡" : "🟢";
      const impactBadge = `${impactIcon} ${t(`impact.${rec.impact}`)}`;

      lines.push(`### ${i + 1}. ${rec.title}`);
      lines.push("");
      lines.push(`**${t("rec.impact")}:** ${impactBadge} | **${t("rec.related_metric")}:** ${tMetric(rec.relatedMetric, rec.relatedMetric)}`);
      lines.push("");
      lines.push(rec.description);
      lines.push("");
    }
  }

  // Crystal Ball
  const hasCrystalBall = report.quickRatio || report.pmfScore || report.mrrForecast || report.scenarios;
  if (hasCrystalBall) {
    lines.push(`## 🔮 ${t("section.crystal_ball")}`);
    lines.push("");

    // --- Quick Ratio ---
    if (report.quickRatio) {
      const qr = report.quickRatio;
      const gradeLabel = tQRGradeIcon(qr.grade);
      lines.push(`### ${t("qr.title")}: ${qr.current.toFixed(2)} (${gradeLabel})`);
      lines.push("");
      lines.push(`> ${qr.interpretation}`);
      lines.push("");
      lines.push(`| ${t("table.month")} | ${t("table.ratio")} | ${t("table.inflow")} | ${t("table.outflow")} |`);
      lines.push("|-------|------:|-------:|--------:|");
      // 顯示最近 6 個月（或全部如果不足 6 個）
      const recentQR = qr.timeSeries.slice(-6);
      for (const row of recentQR) {
        lines.push(`| ${row.date} | ${row.ratio.toFixed(2)} | ${formatCurrency(row.inflow)} | ${formatCurrency(row.outflow)} |`);
      }
      lines.push("");
    }

    // --- PMF Score ---
    if (report.pmfScore) {
      const pmf = report.pmfScore;
      const gradeLabel = tPMFGradeIcon(pmf.grade);
      lines.push(`### ${t("pmf.title")}: ${pmf.score}/100 (${gradeLabel})`);
      lines.push("");
      lines.push(`> ${pmf.diagnosis}`);
      lines.push("");
      lines.push(`| ${t("table.factor")} | ${t("table.value")} | ${t("table.score")} | ${t("table.weight")} |`);
      lines.push("|--------|------:|------:|-------:|");
      for (const b of pmf.breakdown) {
        const valueStr = b.factor.includes("LTV")
          ? formatCurrency(b.rawValue)
          : b.factor.includes("Quick Ratio")
            ? `${b.rawValue.toFixed(2)}x`
            : formatPercent(b.rawValue);
        lines.push(`| ${b.factor} | ${valueStr} | ${b.score}/100 | ${(b.weight * 100).toFixed(0)}% |`);
      }
      lines.push("");
      lines.push(`**${t("pmf.decision_label")}:** ${pmf.decisionAdvice.verdict}`);
      lines.push("");
      lines.push(pmf.decisionAdvice.reasoning);
      lines.push("");
      for (const action of pmf.decisionAdvice.topActions) {
        lines.push(`- ${action}`);
      }
      lines.push("");
    }

    // --- MRR Forecast ---
    if (report.mrrForecast) {
      const fc = report.mrrForecast;
      lines.push(`### ${t("forecast.title")}`);
      lines.push("");
      lines.push(`> ${fc.narrative}`);
      lines.push("");
      lines.push(`| ${t("table.month")} | ${t("table.base")} | ${t("table.optimistic")} | ${t("table.pessimistic")} |`);
      lines.push("|-------|-----:|-----------:|------------:|");
      for (const p of fc.predictions) {
        lines.push(`| ${p.month} | ${formatCurrency(p.base)} | ${formatCurrency(p.optimistic)} | ${formatCurrency(p.pessimistic)} |`);
      }
      lines.push("");
    }

    // --- What-If Scenarios ---
    if (report.scenarios) {
      const sc = report.scenarios;
      lines.push(`### ${t("scenario.title")}`);
      lines.push("");
      lines.push(`${t("scenario.best_scenario")}: **${sc.bestScenario}**`);
      lines.push("");
      lines.push(`| ${t("table.scenario")} | ${t("table.12m_impact")} | ${t("table.pct_change")} |`);
      lines.push("|----------|----------------:|---------:|");
      for (const s of sc.scenarios) {
        const deltaSign = s.improvement.month12Delta >= 0 ? "+" : "";
        const pctSign = s.improvement.month12DeltaPercent >= 0 ? "+" : "";
        lines.push(`| ${s.name} | ${deltaSign}${formatCurrency(s.improvement.month12Delta)} | ${pctSign}${s.improvement.month12DeltaPercent.toFixed(1)}% |`);
      }
      lines.push("");
      for (const s of sc.scenarios) {
        lines.push(`**${s.name}:** ${s.narrative}`);
        lines.push("");
      }
    }
  }

  // Flywheel Insights
  if (report.flywheel) {
    const fw = report.flywheel;
    lines.push("## 🔄 Flywheel Insights");
    lines.push("");
    lines.push(`> ${fw.flyWheelNarrative}`);
    lines.push("");

    // Group insights by layer
    const byLayer = new Map<number, FlywheelInsight[]>();
    for (const insight of fw.insights) {
      const arr = byLayer.get(insight.layer) ?? [];
      arr.push(insight);
      byLayer.set(insight.layer, arr);
    }

    const defaultLayerNames = ["Your Data", "Peer Comparison", "Category Intelligence", "Market Opportunity"];
    const layerTags = ["Free", "$", "$", "$"];

    for (let layer = 1; layer <= 4; layer++) {
      const insights = byLayer.get(layer) ?? [];
      const isFree = layer <= fw.currentLayer;
      const layerName = insights[0]?.layerName ?? defaultLayerNames[layer - 1];
      const tag = layerTags[layer - 1];

      lines.push(`### Layer ${layer}: ${layerName} (${tag})`);
      lines.push("");

      if (insights.length === 0) {
        lines.push("_No insights for this layer_");
        lines.push("");
      } else if (isFree) {
        for (const insight of insights) {
          lines.push(`- **${insight.title}**`);
          lines.push(`  ${insight.description}`);
          if (insight.actionUrl) {
            lines.push(`  [Do This [Do This →]{2192}](${insight.actionUrl})`);
          }
          if (insight.estimatedValue) {
            lines.push(`  _Value: ${insight.estimatedValue}_`);
          }
        }
        lines.push("");
      } else {
        for (const insight of insights) {
          lines.push(`- \`[LOCKED]\` ~~${insight.title}~~`);
        }
        lines.push("");
      }
    }

    lines.push(`**Current Level: ${fw.currentLayer}/4** | Next: ${fw.nextLayerTeaser}`);
    lines.push("");
  }

  // Strategy Analysis
  const hasStrategy = report.keywordAnalysis || report.offeringAnalysis;
  if (hasStrategy) {
    lines.push(`## 🎯 ${t("section.strategy_analysis")}`);
    lines.push("");

    // --- Keyword Attribution ---
    if (report.keywordAnalysis && report.keywordAnalysis.hasAttributionData) {
      const kw = report.keywordAnalysis;
      lines.push(`### ${t("strategy.keyword_attribution")}`);
      lines.push("");
      lines.push(`> ${kw.narrative}`);
      lines.push("");
      lines.push(`| ${t("table.keyword")} | ${t("table.trials")} | ${t("table.revenue")} | ${t("table.conversion")} | ${t("table.efficiency")} |`);
      lines.push("|---------|-------:|--------:|-----------:|:----------:|");
      for (const k of kw.keywords) {
        const conv = k.avgConversionRate !== null ? formatPercent(k.avgConversionRate) : t("misc.na");
        const eff = EFFICIENCY_ICON[k.efficiency] ?? k.efficiency;
        lines.push(`| ${k.keyword} | ${formatNumber(k.totalTrials)} | ${formatCurrency(k.totalRevenue)} | ${conv} | ${eff} |`);
      }
      lines.push("");
    }

    // --- Offering Performance ---
    if (report.offeringAnalysis) {
      const of_ = report.offeringAnalysis;
      lines.push(`### ${t("strategy.offering_performance")}`);
      lines.push("");
      lines.push(`> ${of_.narrative}`);
      lines.push("");
      lines.push(`| ${t("table.offering")} | ${t("table.trials")} | ${t("table.conversion")} | ${t("table.revenue")} | ${t("table.performance")} |`);
      lines.push("|----------|-------:|-----------:|--------:|:-----------:|");
      for (const o of of_.offerings) {
        const conv = o.conversionRate !== null ? formatPercent(o.conversionRate) : t("misc.na");
        const perf = PERFORMANCE_ICON[o.performance] ?? o.performance;
        lines.push(`| ${o.offeringName} | ${formatNumber(o.trialStarts)} | ${conv} | ${formatCurrency(o.revenue)} | ${perf} |`);
      }
      lines.push("");
    }
  }

  // Next Product Suggestions
  if (report.nextProductSuggestions && report.nextProductSuggestions.length > 0) {
    lines.push(`## 🚀 ${t("section.next_product_ideas")}`);
    lines.push("");
    for (const s of report.nextProductSuggestions) {
      const dir = t(`product.direction.${s.direction}`) !== `product.direction.${s.direction}` ? t(`product.direction.${s.direction}`) : s.directionLabel;
      const scoreStars = "★".repeat(Math.min(s.score, 5)) + "☆".repeat(Math.max(5 - s.score, 0));
      lines.push(`### ${dir}: ${s.title} ${scoreStars}`);
      lines.push("");
      lines.push(s.rationale);
      lines.push("");
      if (s.dataEvidence.length > 0) {
        lines.push(`**${t("product.evidence")}:**`);
        for (const e of s.dataEvidence) {
          lines.push(`- ${e}`);
        }
        lines.push("");
      }
      lines.push(`*${t("product.complexity")}: ${s.implementationComplexity} | ${t("product.source")}: ${s.source}*`);
      lines.push("");
    }
  }

  // Agent Plan
  if (report.agentPlan) {
    lines.push(`## 🤖 ${t("section.agent_plan")}`);
    lines.push("");
    lines.push(`> ${report.agentPlan.summary}`);
    lines.push("");
    lines.push(`| ${t("table.action_id")} | ${t("table.action")} | ${t("table.mcp_tool")} | ${t("table.priority")} | ${t("table.expected_impact")} |`);
    lines.push("|---|--------|----------|----------|-----------------|");
    for (const action of report.agentPlan.actions) {
      lines.push(`| ${action.id} | ${action.description} | \`${action.mcpTool}\` | ${action.priority} | ${action.expectedImpact} |`);
    }
    lines.push("");
    lines.push(`**${t("agent.estimated_total_impact")}:** ${report.agentPlan.estimatedMRRImpact}`);
    lines.push("");
    lines.push(`*${report.agentPlan.disclaimer}*`);
    lines.push("");
  }

  // 基準參考
  lines.push(`## 📏 ${t("section.benchmark_reference")}`);
  lines.push("");
  lines.push(t("benchmark.description"));
  lines.push("");
  lines.push(`| ${t("table.metric")} | ${t("table.median")} | ${t("table.top_25")} | ${t("table.bottom_25")} |`);
  lines.push("|--------|-------:|--------:|-----------:|");
  lines.push(`| ${t("benchmark.trial_conversion")} | 35% | 55% | 20% |`);
  lines.push(`| ${t("benchmark.monthly_churn")} | 6% | 3.5% | 8% |`);
  lines.push(`| ${t("benchmark.refund_rate")} | 3% | 1.5% | 5% |`);
  lines.push(`| ${t("benchmark.mrr")} | $2,000 | $10,000 | $500 |`);
  lines.push("");

  // 底部
  lines.push("---");
  lines.push("");
  lines.push(`*${t("footer.generated_by")}*`);
  lines.push("");

  return lines.join("\n");
}
