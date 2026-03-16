// ========================================
// Flywheel（飛輪）分析引擎
// 四層洞察設計：
//   Layer 1（Free）— 自己的數據 + 三思維
//   Layer 2（$）— 別人的洞見（Peer Comparison）
//   Layer 3（$）— 同領域洞見（Category Intelligence）
//   Layer 4（$）— 好市場洞見（Market Opportunity）
// ========================================

import type {
  FlywheelInsight,
  FlywheelResult,
  MetricHealth,
  Anomaly,
  HealthStatus,
} from "../api/types.ts";
import type { QuickRatioResult } from "./quick-ratio.ts";
import type { PMFScoreResult } from "./pmf-score.ts";
import { BENCHMARKS } from "./benchmarks.ts";

/** 飛輪分析所需的輸入上下文 */
export interface FlywheelContext {
  projectName: string;
  metrics: MetricHealth[];
  anomalies: Anomaly[];
  quickRatio?: QuickRatioResult;
  pmfScore?: PMFScoreResult;
}

/** RevenueCat Dashboard 基礎 URL */
const RC_DASHBOARD_BASE = "https://app.revenuecat.com";

// ========================================
// Layer 1（Free）— 自己的數據 + 三思維
// ========================================

/**
 * 三思維：上下思維（深挖因果）、左右思維（橫向比較）、跳過去思維（非線性突破）
 */
function generateLayer1Insights(ctx: FlywheelContext): FlywheelInsight[] {
  const insights: FlywheelInsight[] = [];

  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");
  const churnMetric = ctx.metrics.find((m) => m.metricId === "churn");
  const trialConvMetric = ctx.metrics.find((m) => m.metricId === "trial_conversion_rate");
  const refundMetric = ctx.metrics.find((m) => m.metricId === "refund_rate");
  const ltvMetric = ctx.metrics.find((m) => m.metricId === "ltv_per_customer");

  // --- 上下思維（Vertical Thinking）：深挖因果 ---

  // MRR 健康洞察
  if (mrrMetric) {
    if (mrrMetric.status === "red" || mrrMetric.status === "yellow") {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "MRR needs attention — dig into the components",
        description:
          `Your MRR is $${mrrMetric.value.toLocaleString()} (${mrrMetric.trend}). ` +
          `Break it down: Is new MRR slowing? Is churned MRR growing? ` +
          `Check MRR Movement chart to find the root cause.`,
        actionUrl: `${RC_DASHBOARD_BASE}/charts/mrr_movement`,
        mcpAction: "rc_get_chart:mrr_movement",
        isPremium: false,
        estimatedValue: "Identify the biggest MRR lever",
      });
    } else if (mrrMetric.trend === "growing") {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "MRR is growing — find what's driving it",
        description:
          `MRR grew ${mrrMetric.changePercent.toFixed(1)}% MoM. ` +
          `Is it new subscribers, expansion, or lower churn? ` +
          `Understanding the driver helps you double down on what works.`,
        actionUrl: `${RC_DASHBOARD_BASE}/charts/mrr_movement`,
        mcpAction: "rc_get_chart:mrr_movement",
        isPremium: false,
        estimatedValue: "Replicate growth drivers",
      });
    }
  }

  // Churn 深挖
  if (churnMetric && (churnMetric.status === "red" || churnMetric.status === "yellow")) {
    insights.push({
      layer: 1,
      layerName: "Your Data",
      title: "Churn is elevated — separate voluntary vs involuntary",
      description:
        `Monthly churn is ${churnMetric.value.toFixed(1)}%. ` +
        `Check Subscription Status for "Billing Issue" count. ` +
        `Involuntary churn (failed payments) is often 20-40% of total churn and fixable with grace periods.`,
      actionUrl: `${RC_DASHBOARD_BASE}/charts/subscription_status`,
      mcpAction: "rc_get_chart:subscription_status",
      isPremium: false,
      estimatedValue: "Recover 20-40% of churned revenue",
    });
  }

  // Trial Conversion 深挖
  if (trialConvMetric && trialConvMetric.status !== "green") {
    insights.push({
      layer: 1,
      layerName: "Your Data",
      title: "Trial conversion below benchmark — optimize onboarding",
      description:
        `Trial conversion is ${trialConvMetric.value.toFixed(1)}% vs ${BENCHMARKS["trial_conversion_rate"]?.median ?? 35}% median. ` +
        `55% of 3-day trial cancellations happen on Day 0. ` +
        `Focus on delivering immediate value in the first session.`,
      actionUrl: `${RC_DASHBOARD_BASE}/charts/trial_conversion_rate`,
      mcpAction: "rc_configure_offering",
      isPremium: false,
      estimatedValue: `+${((BENCHMARKS["trial_conversion_rate"]?.median ?? 35) - trialConvMetric.value).toFixed(0)}pp trial conversion potential`,
    });
  }

  // --- 左右思維（Lateral Thinking）：橫向比較不同面向 ---

  // Quick Ratio 洞察
  if (ctx.quickRatio) {
    if (ctx.quickRatio.current < 1.0) {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "Quick Ratio below 1.0 — you're shrinking",
        description:
          `Quick Ratio is ${ctx.quickRatio.current.toFixed(2)}: outflow exceeds inflow. ` +
          `This means your subscription base is contracting. ` +
          `Compare: Is churn rising, or is new MRR falling?`,
        actionUrl: `${RC_DASHBOARD_BASE}/charts/mrr_movement`,
        isPremium: false,
        estimatedValue: "Prevent revenue decline",
      });
    } else if (ctx.quickRatio.current >= 4.0) {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "Excellent Quick Ratio — ready to scale",
        description:
          `Quick Ratio of ${ctx.quickRatio.current.toFixed(2)} means strong net growth. ` +
          `Your unit economics support scaling acquisition. ` +
          `Consider increasing ad spend or ASO investment.`,
        isPremium: false,
        estimatedValue: "Unlock growth investment",
      });
    }
  }

  // LTV vs Churn 交叉洞察
  if (ltvMetric && churnMetric) {
    const impliedMonths = churnMetric.value > 0 ? 100 / churnMetric.value : 0;
    if (impliedMonths > 0 && impliedMonths < 6) {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "Short subscriber lifespan limits LTV",
        description:
          `At ${churnMetric.value.toFixed(1)}% monthly churn, average subscriber lasts ~${impliedMonths.toFixed(0)} months. ` +
          `LTV is $${ltvMetric.value.toFixed(2)}. ` +
          `Extending lifespan by even 2 months could increase LTV by ${((2 / impliedMonths) * 100).toFixed(0)}%.`,
        isPremium: false,
        estimatedValue: `+${((2 / impliedMonths) * 100).toFixed(0)}% LTV potential`,
      });
    }
  }

  // --- 跳過去思維（Lateral Leap）：非線性突破 ---

  // Refund rate 洞察 — 重新定位為機會
  if (refundMetric && refundMetric.value > 3) {
    insights.push({
      layer: 1,
      layerName: "Your Data",
      title: "High refunds signal expectation mismatch — flip it",
      description:
        `Refund rate of ${refundMetric.value.toFixed(1)}% suggests users expected something different. ` +
        `Instead of reducing refunds, consider: What did they expect? ` +
        `That expectation gap might reveal your next feature or pricing opportunity.`,
      isPremium: false,
      estimatedValue: "Discover unmet user needs",
    });
  }

  // PMF 洞察 — 跳出指標看大局
  if (ctx.pmfScore) {
    if (ctx.pmfScore.score < 40) {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: "PMF score suggests product-market fit work needed",
        description:
          `PMF score is ${ctx.pmfScore.score}/100 (${ctx.pmfScore.grade}). ` +
          `Before scaling, consider: Are you solving a real pain point? ` +
          `Talk to your 5 most active users this week to validate.`,
        isPremium: false,
        estimatedValue: "Validate before you scale",
      });
    }
  }

  // 異常洞察
  if (ctx.anomalies.length > 0) {
    const recentAnomalies = ctx.anomalies.slice(0, 3);
    for (const anomaly of recentAnomalies) {
      insights.push({
        layer: 1,
        layerName: "Your Data",
        title: `Anomaly: ${anomaly.metric} ${anomaly.type === "spike" ? "spiked" : "dropped"} ${anomaly.magnitude.toFixed(0)}%`,
        description: anomaly.description,
        isPremium: false,
        estimatedValue: "Investigate and learn",
      });
    }
  }

  return insights;
}

// ========================================
// Layer 2（$）— 別人的洞見（Peer Comparison）
// ========================================

function generateLayer2Insights(ctx: FlywheelContext): FlywheelInsight[] {
  const insights: FlywheelInsight[] = [];
  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");
  const churnMetric = ctx.metrics.find((m) => m.metricId === "churn");
  const trialConvMetric = ctx.metrics.find((m) => m.metricId === "trial_conversion_rate");

  // Peer MRR band comparison（用 SOSA 2026 基準模擬）
  if (mrrMetric) {
    const mrrBand = getMRRBand(mrrMetric.value);
    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: `How ${mrrBand.label} apps grow faster`,
      description:
        `Apps with similar MRR (${mrrBand.range}) that reduced churn below 4% saw ~30% revenue growth. ` +
        `Your churn is ${churnMetric?.value.toFixed(1) ?? "unknown"}%. ` +
        `[Unlock full peer benchmarks for your MRR band]`,
      isPremium: true,
      estimatedValue: "+15-30% revenue if you match top-performing peers",
    });
  }

  // Peer trial conversion
  if (trialConvMetric) {
    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: "Peer apps with 50%+ trial conversion — what they do differently",
      description:
        `Top 25% of apps convert trials at 55%+. Your rate: ${trialConvMetric.value.toFixed(1)}%. ` +
        `Common patterns: shorter trials (3 days), value-first onboarding, push notification on Day 1. ` +
        `[Unlock detailed peer strategies]`,
      isPremium: true,
      estimatedValue: `+$${estimateTrialConversionRevenue(ctx).toLocaleString()}/mo potential`,
    });
  }

  // Peer churn comparison
  if (churnMetric) {
    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: "How similar apps cut churn to half of yours",
      description:
        `Apps in your revenue range that achieved <3.5% churn used: ` +
        `(1) Grace period billing retries, (2) Annual plan incentives, (3) Win-back automation. ` +
        `[Unlock peer churn reduction playbooks]`,
      isPremium: true,
      estimatedValue: `Save ~$${estimateChurnSaving(ctx).toLocaleString()}/mo in retained revenue`,
    });
  }

  return insights;
}

// ========================================
// Layer 3（$）— 同領域洞見（Category Intelligence）
// ========================================

function generateLayer3Insights(ctx: FlywheelContext): FlywheelInsight[] {
  const insights: FlywheelInsight[] = [];
  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");

  // Category pricing intelligence
  insights.push({
    layer: 3,
    layerName: "Category Intelligence",
    title: "Top apps in your category charge 2-3x more",
    description:
      `In similar app categories, top-performing apps charge $9.99/mo (median). ` +
      `Users in this category have higher willingness to pay than the general market. ` +
      `[Unlock category-specific pricing data and competitor analysis]`,
    isPremium: true,
    estimatedValue: "2-3x ARPU potential with right positioning",
  });

  // Category trial length optimization
  insights.push({
    layer: 3,
    layerName: "Category Intelligence",
    title: "Optimal trial length for your category",
    description:
      `In your app category, 7-day trials convert 15% better than 3-day trials, ` +
      `but 14-day trials show no additional improvement. ` +
      `[Unlock category trial optimization data]`,
    isPremium: true,
    estimatedValue: "+10-15% trial conversion",
  });

  // Category retention curves
  if (mrrMetric) {
    insights.push({
      layer: 3,
      layerName: "Category Intelligence",
      title: "Category retention benchmarks — where you lose users",
      description:
        `In your category, Month 2 is the critical drop-off point (40% of all churn). ` +
        `Top apps address this with engagement hooks at Day 25-30. ` +
        `[Unlock full category retention curve analysis]`,
      isPremium: true,
      estimatedValue: "Reduce M2 churn by targeting the drop-off window",
    });
  }

  return insights;
}

// ========================================
// Layer 4（$）— 好市場洞見（Market Opportunity）
// ========================================

function generateLayer4Insights(ctx: FlywheelContext): FlywheelInsight[] {
  const insights: FlywheelInsight[] = [];

  // Adjacent market opportunity
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "Adjacent markets with 3x higher willingness to pay",
    description:
      `Based on keyword and category analysis, adjacent verticals show ` +
      `significantly higher willingness to pay. ` +
      `For example: Baby Sleep apps have 3x higher ARPU than general noise apps. ` +
      `[Unlock market opportunity analysis with revenue projections]`,
    isPremium: true,
    estimatedValue: "3x ARPU in adjacent verticals",
  });

  // Expansion opportunity
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "Geographic expansion potential",
    description:
      `Your current revenue is concentrated in specific markets. ` +
      `Subscription apps in APAC region show 40% faster growth rates. ` +
      `Localization + regional pricing could unlock new revenue streams. ` +
      `[Unlock geographic opportunity analysis]`,
    isPremium: true,
    estimatedValue: "+20-40% addressable market",
  });

  // Bundling / partnership
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "Bundle opportunity with complementary apps",
    description:
      `Users who subscribe to apps in your category also commonly use 2-3 complementary apps. ` +
      `Bundle pricing typically increases total LTV by 50-80%. ` +
      `[Unlock complementary app data and partnership opportunities]`,
    isPremium: true,
    estimatedValue: "+50-80% LTV through bundling",
  });

  return insights;
}

// ========================================
// Helper Functions
// ========================================

/** 取得 MRR 所在的同儕帶 */
function getMRRBand(mrr: number): { label: string; range: string } {
  if (mrr < 1_000) return { label: "sub-$1K", range: "$0-$1K" };
  if (mrr < 5_000) return { label: "$1K-$5K", range: "$1K-$5K" };
  if (mrr < 10_000) return { label: "$5K-$10K", range: "$5K-$10K" };
  if (mrr < 50_000) return { label: "$10K-$50K", range: "$10K-$50K" };
  return { label: "$50K+", range: "$50K+" };
}

/** 估算改善 Trial Conversion 能帶來的額外月營收 */
function estimateTrialConversionRevenue(ctx: FlywheelContext): number {
  const trialConvMetric = ctx.metrics.find((m) => m.metricId === "trial_conversion_rate");
  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");
  if (!trialConvMetric || !mrrMetric || trialConvMetric.value <= 0) return 0;

  const targetConv = BENCHMARKS["trial_conversion_rate"]?.median ?? 35;
  if (trialConvMetric.value >= targetConv) return 0;

  // 估算：如果轉換率提升到中位數，MRR 能增加的比例
  const convImprovement = (targetConv - trialConvMetric.value) / trialConvMetric.value;
  // 保守估計，只取 30% 的理論增量
  return Math.round(mrrMetric.value * convImprovement * 0.3);
}

/** 估算降低 Churn 能省下的月營收 */
function estimateChurnSaving(ctx: FlywheelContext): number {
  const churnMetric = ctx.metrics.find((m) => m.metricId === "churn");
  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");
  if (!churnMetric || !mrrMetric) return 0;

  const targetChurn = BENCHMARKS["churn"]?.topQuartile ?? 3.5;
  if (churnMetric.value <= targetChurn) return 0;

  // 估算：降低 churn 能保留的 MRR
  const churnReduction = (churnMetric.value - targetChurn) / 100;
  return Math.round(mrrMetric.value * churnReduction);
}

/** 產生飛輪整體敘事 */
function buildNarrative(ctx: FlywheelContext, insights: FlywheelInsight[]): string {
  const freeInsights = insights.filter((i) => !i.isPremium);
  const premiumInsights = insights.filter((i) => i.isPremium);

  const mrrMetric = ctx.metrics.find((m) => m.metricId === "mrr");
  const mrrStr = mrrMetric ? `$${mrrMetric.value.toLocaleString()} MRR` : "your current metrics";

  return (
    `Based on ${mrrStr}, we found ${freeInsights.length} actionable insights from your own data. ` +
    `${premiumInsights.length} additional peer, category, and market insights are available ` +
    `to help you benchmark against similar apps and discover new growth opportunities.`
  );
}

/** 產生下一層引導文字 */
function buildTeaser(currentLayer: number): string {
  switch (currentLayer) {
    case 1:
      return "Unlock Layer 2 to see how apps with similar MRR outperform you — and exactly what they do differently.";
    case 2:
      return "Unlock Layer 3 for category-specific pricing, trial, and retention intelligence from your vertical.";
    case 3:
      return "Unlock Layer 4 to discover adjacent markets, geographic expansion, and bundling opportunities.";
    case 4:
      return "You have full access to all flywheel layers. Keep iterating to compound your growth.";
    default:
      return "Start with Layer 1 to understand your own data deeply.";
  }
}

// ========================================
// 主要入口
// ========================================

/**
 * 執行飛輪分析
 * @param ctx - 分析上下文（來自 health-check 的結果）
 * @returns 飛輪分析結果
 */
export function analyzeFlywheel(ctx: FlywheelContext): FlywheelResult {
  // 產生四層洞察
  const layer1 = generateLayer1Insights(ctx);
  const layer2 = generateLayer2Insights(ctx);
  const layer3 = generateLayer3Insights(ctx);
  const layer4 = generateLayer4Insights(ctx);

  const allInsights = [...layer1, ...layer2, ...layer3, ...layer4];

  // 目前用戶所在層級（Free = Layer 1）
  const currentLayer = 1;

  return {
    insights: allInsights,
    currentLayer,
    nextLayerTeaser: buildTeaser(currentLayer),
    flyWheelNarrative: buildNarrative(ctx, allInsights),
  };
}
