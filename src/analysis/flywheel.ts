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

  // Peer MRR band comparison — 用 SOSA 2026 真實基準，部分解鎖
  if (mrrMetric) {
    const mrrBand = getMRRBand(mrrMetric.value);
    const benchmarkChurn = BENCHMARKS["churn"];
    const currentChurn = churnMetric?.value ?? 0;
    const topQuartileChurn = benchmarkChurn?.topQuartile ?? 3.5;
    const churnGap = currentChurn - topQuartileChurn;

    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: `Your position: ${mrrBand.label} MRR band`,
      description:
        `SOSA 2026 data (115,000+ apps): In your MRR band (${mrrBand.range}), ` +
        `median churn is 6.0%, top 25% achieve 3.5%. You're at ${currentChurn.toFixed(1)}% — ` +
        `${churnGap > 0 ? `${churnGap.toFixed(1)}pp above top quartile. ` +
          `Closing this gap = ~${Math.round(churnGap * mrrMetric.value / 100 * 12)}/year saved revenue.` :
          `within top quartile — excellent.`}`,
      isPremium: false, // Layer 2 部分解鎖：SOSA 基準是公開數據
      estimatedValue: churnGap > 0
        ? `+$${Math.round(churnGap * mrrMetric.value / 100)}/mo if churn matches top 25%`
        : "Already performing well vs peers",
      actionUrl: `${RC_DASHBOARD_BASE}/charts/churn`,
      mcpAction: "rc_get_chart:churn",
    });
  }

  // Peer trial conversion — 用 SOSA 數據做真實比較
  if (trialConvMetric) {
    const benchConv = BENCHMARKS["trial_conversion_rate"];
    const median = benchConv?.median ?? 35;
    const top25 = benchConv?.topQuartile ?? 55;
    const percentile = trialConvMetric.value >= top25 ? "top 25%" :
      trialConvMetric.value >= median ? "above median" : "below median";

    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: `Trial conversion: ${percentile} (${trialConvMetric.value.toFixed(1)}% vs ${median}% median)`,
      description:
        `SOSA 2026: Median trial conversion is ${median}%, top 25% is ${top25}%. ` +
        `Your ${trialConvMetric.value.toFixed(1)}% is ${percentile}. ` +
        `${trialConvMetric.value >= median ?
          `This is your competitive advantage — invest in scaling acquisition to exploit it.` :
          `Key improvement: 55% of Day-0 cancellations happen because users don't see value fast enough.`}`,
      isPremium: false, // SOSA 數據是公開的
      estimatedValue: `+$${estimateTrialConversionRevenue(ctx).toLocaleString()}/mo potential`,
      actionUrl: `${RC_DASHBOARD_BASE}/charts/trial_conversion_rate`,
    });
  }

  // Peer churn playbook — 這個保持 premium（具體策略需要付費）
  if (churnMetric) {
    insights.push({
      layer: 2,
      layerName: "Peer Comparison",
      title: `Churn playbook: what ${churnMetric.value < 5 ? "you're doing right" : "top apps do differently"}`,
      description:
        `Apps that cut churn from ${churnMetric.value.toFixed(1)}% to <3.5% typically used three moves: ` +
        `(1) Grace period + smart dunning (fixes 20-40% of churn), ` +
        `(2) Annual-first pricing (bypasses monthly churn decisions), ` +
        `(3) Cancellation flow with offers (recovers 10-15% of intending cancellers).`,
      isPremium: false, // 給具體策略，不只是 teaser
      estimatedValue: `Save ~$${estimateChurnSaving(ctx).toLocaleString()}/mo in retained revenue`,
      actionUrl: `${RC_DASHBOARD_BASE}/charts/subscription_status`,
      mcpAction: "rc_create_offering",
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

  // Category pricing — 用 SOSA 數據 + MRR 推算
  const currentARPU = mrrMetric && ctx.metrics.find((m) => m.metricId === "actives")
    ? mrrMetric.value / (ctx.metrics.find((m) => m.metricId === "actives")!.value || 1)
    : 0;
  insights.push({
    layer: 3,
    layerName: "Category Intelligence",
    title: `Pricing gap: Sound/Sleep apps charge $5-10/mo, your ARPU is $${currentARPU.toFixed(2)}`,
    description:
      `Sound and wellness category data shows top 10 apps average $7.99/mo ARPU. ` +
      `Your estimated ARPU of $${currentARPU.toFixed(2)} suggests significant pricing headroom. ` +
      `A 2x price increase with a 20% conversion drop still nets +50% more revenue. ` +
      `Test with a new premium tier before changing existing pricing.`,
    isPremium: true,
    estimatedValue: `+50-100% ARPU if pricing matches category leaders`,
    mcpAction: "rc_create_product",
  });

  // Category trial patterns — SOSA 中的具體數據
  insights.push({
    layer: 3,
    layerName: "Category Intelligence",
    title: "SOSA 2026: 55% of 3-day trial cancels happen on Day 0",
    description:
      `Across all categories, 55% of 3-day trial cancellations happen within the first few hours. ` +
      `7-day trials outperform 3-day by 15% in conversion but cost nothing extra. ` +
      `However, 14-day and 30-day trials show no improvement over 7-day — longer ≠ better. ` +
      `If your trial is currently 3 days, switching to 7 is a free win.`,
    isPremium: true,
    estimatedValue: "+10-15% trial conversion (if currently on 3-day trial)",
    mcpAction: "rc_create_offering",
  });

  // Category retention — 具體的 Month 2 問題
  if (mrrMetric) {
    insights.push({
      layer: 3,
      layerName: "Category Intelligence",
      title: "Month 2 is where you lose them — the 'utility cliff'",
      description:
        `Utility apps (sound, weather, calculator) have a specific retention pattern: ` +
        `Month 1 retention is high (novelty), Month 2 drops sharply (utility fully explored). ` +
        `Top apps in this category combat this with: drip content (new sounds monthly), ` +
        `usage stats (sleep tracking), social features (shared playlists). ` +
        `Your product needs a reason to come back in Month 2 that didn't exist in Month 1.`,
      isPremium: true,
      estimatedValue: "Reduce M2-M3 churn by 30-50% with engagement hooks",
    });
  }

  return insights;
}

// ========================================
// Layer 4（$）— 好市場洞見（Market Opportunity）
// ========================================

function generateLayer4Insights(ctx: FlywheelContext): FlywheelInsight[] {
  const insights: FlywheelInsight[] = [];

  // Adjacent market — 用 Dark Noise 的真實定位推算
  const mrrVal = ctx.metrics.find((m) => m.metricId === "mrr")?.value ?? 0;
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "Baby Sleep market: same tech, 3x ARPU, growing 40%/year",
    description:
      `Your audio engine already works. Baby Sleep apps charge $4.99-9.99/mo (vs your ~$2.99). ` +
      `Parents have near-zero price sensitivity for baby sleep. ` +
      `Estimated TAM: 10x your current addressable market. ` +
      `Execution: add 10 baby sounds + rename one Offering to "Baby Sleep" + target 'baby white noise' ASA keywords. ` +
      `Same RevenueCat project, new Offering, new audience.`,
    isPremium: true,
    estimatedValue: `+$${Math.round(mrrVal * 0.5)}-${Math.round(mrrVal * 1.5)}/mo within 12 months (new segment)`,
    mcpAction: "rc_create_offering",
  });

  // Geographic — 用 SOSA Japan/APAC 數據
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "Japan: highest LTV per subscriber in APAC, +40% growth",
    description:
      `SOSA 2026: Japan subscription app revenue growing 40% YoY, highest LTV in APAC. ` +
      `Japanese users prefer annual plans (lower churn). ` +
      `Execution: Japanese App Store localization + JPY pricing + '環境音' keyword targeting. ` +
      `If 10% of current users are from Japan with 2x LTV, that's already $${Math.round(mrrVal * 0.1 * 2)}/mo untapped.`,
    isPremium: true,
    estimatedValue: `+$${Math.round(mrrVal * 0.2)}-${Math.round(mrrVal * 0.5)}/mo from Japan market`,
  });

  // B2B — 跳到企業市場
  insights.push({
    layer: 4,
    layerName: "Market Opportunity",
    title: "B2B: office ambient sound for focus — $49/seat/mo market",
    description:
      `Remote work drove demand for focus/ambient sound. B2B SaaS charges per-seat ($5-49/seat/mo). ` +
      `Slack integration + team admin panel + volume licensing = enterprise product from existing tech. ` +
      `Even 20 companies × 10 seats × $5/seat = $1,000/mo MRR from zero effort on the core product. ` +
      `RevenueCat's Web Billing makes B2B subscription possible without app stores.`,
    isPremium: true,
    estimatedValue: "+$1,000-5,000/mo from B2B segment (12-month horizon)",
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
