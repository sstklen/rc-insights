// ========================================
// 建議引擎 — 決策 + 行動 + 驗證（完整閉環）
// 每個建議不只說「做什麼」，還說「怎麼做」和「怎麼驗證」
// ========================================

import type { MetricHealth, Recommendation, Anomaly, HealthStatus, ActionStep, VerifyStep } from "../api/types.ts";
import { BENCHMARKS, KEY_FACTS } from "./benchmarks.ts";

/**
 * 建議模板 — 每個指標對應不同狀態的建議
 * 每個建議包含：決策（title/description）+ 行動（actions）+ 驗證（verify）
 */
const RECOMMENDATION_TEMPLATES: Record<
  string,
  Record<HealthStatus, (metric: MetricHealth) => Recommendation | null>
> = {
  trial_conversion_rate: {
    green: (m) => ({
      priority: 3,
      title: "Strong trial conversion — invest in acquisition",
      description: `Your trial conversion rate of ${m.value.toFixed(1)}% exceeds ${
        m.value >= (BENCHMARKS["trial_conversion_rate"]?.topQuartile ?? 55) ? "75%" : "50%"
      } of apps. Your funnel works — pour more users in.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
      actions: [
        {
          what: "Increase Apple Search Ads budget by 30% on your top-converting keywords",
          where: "app_store_connect",
        },
        {
          what: "Create a new Offering with a shorter trial (3 days instead of 7) to test if conversion holds",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "short-trial-test", trial_days: 3 },
        },
        {
          what: "Set up an A/B Experiment between current and new Offering",
          where: "revenuecat_dashboard",
          dashboardPath: "/experiments/new",
        },
      ],
      verify: {
        metric: "trials_new",
        direction: "increase",
        checkAfter: "2 weeks",
        successCriteria: "New trials +30% while trial_conversion_rate stays above 40%",
      },
    }),
    yellow: (m) => ({
      priority: 2,
      title: "Trial conversion has room for improvement",
      description: `Trial conversion rate of ${m.value.toFixed(1)}% is below the median of ${
        BENCHMARKS["trial_conversion_rate"]?.median ?? 35
      }%. ${KEY_FACTS.day0TrialCancelRate}% of 3-day trial cancellations happen on Day 0 — your onboarding is the bottleneck.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
      actions: [
        {
          what: "Review your onboarding flow — users must see core value within 60 seconds of first launch",
          where: "code",
        },
        {
          what: "Add a push notification on Day 1 of trial highlighting the #1 feature",
          where: "code",
        },
        {
          what: "Create a discounted annual Offering shown only to trial users on Day 5",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "trial-day5-annual-discount" },
        },
      ],
      verify: {
        metric: "trial_conversion_rate",
        direction: "increase",
        checkAfter: "4 weeks",
        successCriteria: "Trial conversion rate ≥ 35% (median)",
      },
    }),
    red: (m) => ({
      priority: 1,
      title: "Trial conversion critically low — immediate action needed",
      description: `Trial conversion rate is only ${m.value.toFixed(1)}%. For every 100 trials, only ${Math.round(m.value)} convert. This is the highest-leverage fix available.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
      actions: [
        {
          what: "Audit trial onboarding: does the user see core value before Day 0 ends?",
          where: "code",
        },
        {
          what: "A/B test a 7-day trial vs current trial length",
          where: "revenuecat_dashboard",
          dashboardPath: "/experiments/new",
        },
        {
          what: "Add a free tier with limited features — let users experience value before any paywall",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "free-tier-limited" },
        },
        {
          what: "Review App Store screenshots and description — do they set accurate expectations?",
          where: "app_store_connect",
        },
      ],
      verify: {
        metric: "trial_conversion_rate",
        direction: "increase",
        checkAfter: "4 weeks",
        successCriteria: "Trial conversion rate ≥ 20% (bottom quartile threshold)",
      },
    }),
  },

  churn: {
    green: (m) => ({
      priority: 4,
      title: "Churn is well-controlled",
      description: `Monthly churn rate of ${m.value.toFixed(1)}% is excellent. Focus on maintaining this while growing acquisition.`,
      relatedMetric: "churn",
      impact: "low",
      actions: [
        {
          what: "Push more users toward annual plans — annual churn is typically 50% lower than monthly",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "annual-upsell-prompt" },
        },
      ],
      verify: {
        metric: "churn",
        direction: "stable",
        checkAfter: "1 month",
        successCriteria: "Monthly churn stays below 5%",
      },
    }),
    yellow: (m) => ({
      priority: 2,
      title: "Churn slightly elevated — retention actions needed",
      description: `Monthly churn of ${m.value.toFixed(1)}% is above 5%. Every 1% churn reduction compounds to ~12% more revenue annually.`,
      relatedMetric: "churn",
      impact: "medium",
      actions: [
        {
          what: "Check Subscription Status chart for 'Billing Issue' count — involuntary churn is often 20-40% of total and fixable",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/subscription_status",
        },
        {
          what: "Enable grace period for failed payments (RevenueCat handles retry automatically)",
          where: "revenuecat_dashboard",
          dashboardPath: "/project/settings",
        },
        {
          what: "Create a win-back Offering: 50% off for 3 months, targeted at cancelled users",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "win-back-50-off-3mo" },
        },
        {
          what: "Send renewal reminder push notification 3 days before expiry",
          where: "code",
        },
      ],
      verify: {
        metric: "churn",
        direction: "decrease",
        checkAfter: "6 weeks",
        successCriteria: "Monthly churn ≤ 5%",
      },
    }),
    red: (m) => ({
      priority: 1,
      title: "Churn rate critical — urgent action required",
      description: `Monthly churn rate of ${m.value.toFixed(1)}% is bleeding revenue. At this rate, you lose half your subscribers in ${Math.round(Math.log(0.5) / Math.log(1 - m.value / 100))} months.`,
      relatedMetric: "churn",
      impact: "high",
      actions: [
        {
          what: "Add a cancellation survey (1 question: 'Why are you leaving?') to identify root causes",
          where: "code",
        },
        {
          what: "Check for billing issues in Subscription Status — fix involuntary churn first",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/subscription_status",
        },
        {
          what: "Create aggressive win-back: first month free for returning users",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "win-back-first-month-free" },
        },
        {
          what: "Offer annual plan at 40% discount to lock in remaining monthly users",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "annual-40-off-retention" },
        },
      ],
      verify: {
        metric: "churn",
        direction: "decrease",
        checkAfter: "4 weeks",
        successCriteria: `Monthly churn ≤ ${BENCHMARKS["churn"]?.bottomQuartile ?? 8}%`,
      },
    }),
  },

  refund_rate: {
    green: () => null, // 不需要行動
    yellow: (m) => ({
      priority: 3,
      title: "Refund rate approaching warning level",
      description: `Refund rate of ${m.value.toFixed(1)}% — check if trial terms are clearly communicated.`,
      relatedMetric: "refund_rate",
      impact: "medium",
      actions: [
        {
          what: "Review paywall copy — users should understand exactly what they're paying for before subscribing",
          where: "code",
        },
        {
          what: "Add a confirmation screen before purchase showing price and renewal terms",
          where: "code",
        },
      ],
      verify: {
        metric: "refund_rate",
        direction: "decrease",
        checkAfter: "4 weeks",
        successCriteria: "Refund rate < 3% (median)",
      },
    }),
    red: (m) => ({
      priority: 1,
      title: "Refund rate too high — store review risk",
      description: `Refund rate of ${m.value.toFixed(1)}% may trigger App Store/Play Store reviews.`,
      relatedMetric: "refund_rate",
      impact: "high",
      actions: [
        {
          what: "Audit App Store screenshots and description — do they match actual functionality?",
          where: "app_store_connect",
        },
        {
          what: "Ensure trial-to-paid transition has clear 'you will be charged' messaging",
          where: "code",
        },
        {
          what: "Check refund reasons in App Store Connect for patterns",
          where: "app_store_connect",
        },
      ],
      verify: {
        metric: "refund_rate",
        direction: "decrease",
        checkAfter: "4 weeks",
        successCriteria: "Refund rate < 3%",
      },
    }),
  },

  mrr: {
    green: (m) => ({
      priority: 4,
      title: "MRR performing well",
      description: `MRR of $${m.value.toLocaleString()} is above median. ${m.trend === "growing" ? "Growth trend positive." : "Consider investing in growth."}`,
      relatedMetric: "mrr",
      impact: "low",
      actions: [
        {
          what: "Review MRR Movement chart to understand where growth is coming from",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/mrr_movement",
        },
      ],
      verify: {
        metric: "mrr",
        direction: "increase",
        checkAfter: "1 month",
        successCriteria: "MRR MoM growth ≥ 2%",
      },
    }),
    yellow: (m) => ({
      priority: 3,
      title: "MRR has growth potential",
      description: `MRR of $${m.value.toLocaleString()} — focus on the highest-leverage metric (trial conversion or churn).`,
      relatedMetric: "mrr",
      impact: "medium",
      actions: [
        {
          what: "Identify your biggest leak: check MRR Movement for Churned vs New",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/mrr_movement",
        },
        {
          what: "If Churned > New: fix churn first. If New < Churned: scale acquisition.",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/mrr_movement",
        },
      ],
      verify: {
        metric: "mrr",
        direction: "increase",
        checkAfter: "2 months",
        successCriteria: "MRR above current value",
      },
    }),
    red: (m) => ({
      priority: 2,
      title: "MRR below benchmark — growth strategy needed",
      description: `MRR of $${m.value.toLocaleString()} is below most apps.`,
      relatedMetric: "mrr",
      impact: "medium",
      actions: [
        {
          what: "Focus all effort on trial conversion first — it's the fastest lever for MRR",
          where: "code",
        },
        {
          what: "Consider raising prices — if conversion stays stable, MRR grows immediately",
          where: "mcp",
          mcpTool: "rc_create_product",
          mcpParams: { price_tier: "higher" },
        },
      ],
      verify: {
        metric: "mrr",
        direction: "increase",
        checkAfter: "3 months",
        successCriteria: "MRR ≥ $2,000 (median)",
      },
    }),
  },

  ltv_per_customer: {
    green: () => null,
    yellow: (m) => ({
      priority: 3,
      title: "LTV could be improved",
      description: `LTV per customer of $${m.value.toFixed(2)} — annual plans and premium tiers increase LTV.`,
      relatedMetric: "ltv_per_customer",
      impact: "medium",
      actions: [
        {
          what: "Introduce annual plan at 2 months free (saves user money, locks in 12 months)",
          where: "mcp",
          mcpTool: "rc_create_product",
          mcpParams: { duration: "annual", discount: "2_months_free" },
        },
      ],
      verify: {
        metric: "ltv_per_customer",
        direction: "increase",
        checkAfter: "3 months",
        successCriteria: "LTV ≥ $3.50 (median)",
      },
    }),
    red: (m) => ({
      priority: 2,
      title: "LTV too low — limits acquisition investment",
      description: `LTV $${m.value.toFixed(2)} constrains CAC. Fix retention before scaling acquisition.`,
      relatedMetric: "ltv_per_customer",
      impact: "medium",
      actions: [
        {
          what: "Improve retention: focus on Month 2-3 drop-off (check retention chart)",
          where: "revenuecat_dashboard",
          dashboardPath: "/charts/subscription_retention",
        },
        {
          what: "Add premium tier with higher-value features",
          where: "mcp",
          mcpTool: "rc_create_offering",
          mcpParams: { name: "premium-tier" },
        },
      ],
      verify: {
        metric: "ltv_per_customer",
        direction: "increase",
        checkAfter: "3 months",
        successCriteria: "LTV ≥ $3.50",
      },
    }),
  },
};

/**
 * 根據健康指標產生建議（含行動 + 驗證）
 */
export function generateRecommendations(
  metrics: MetricHealth[],
  anomalies: Anomaly[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const metric of metrics) {
    const templates = RECOMMENDATION_TEMPLATES[metric.metricId];
    if (!templates) continue;
    const generator = templates[metric.status];
    if (!generator) continue;
    const rec = generator(metric);
    if (rec) recommendations.push(rec);
  }

  for (const anomaly of anomalies) {
    if (anomaly.type === "drop" && anomaly.magnitude > 20) {
      recommendations.push({
        priority: 1,
        title: `Unusual drop in ${anomaly.metric}`,
        description: `${anomaly.metric} dropped ${anomaly.magnitude.toFixed(1)}% on ${anomaly.date}. Investigate immediately.`,
        relatedMetric: anomaly.metric,
        impact: "high",
        actions: [
          {
            what: `Check ${anomaly.metric} chart for the exact date and drill into segments`,
            where: "revenuecat_dashboard",
          },
          {
            what: "Check if an app update, pricing change, or competitor action caused the drop",
            where: "external",
          },
        ],
        verify: {
          metric: anomaly.metric,
          direction: "increase",
          checkAfter: "2 weeks",
          successCriteria: `${anomaly.metric} returns to pre-drop level`,
        },
      });
    }
    if (anomaly.type === "spike" && anomaly.magnitude > 20) {
      recommendations.push({
        priority: 3,
        title: `Unusual spike in ${anomaly.metric}`,
        description: `${anomaly.metric} spiked ${anomaly.magnitude.toFixed(1)}% on ${anomaly.date}. If positive, replicate the strategy.`,
        relatedMetric: anomaly.metric,
        impact: "medium",
      });
    }
  }

  recommendations.sort((a, b) => a.priority - b.priority);
  return recommendations;
}

/** 取前 N 筆最重要的建議 */
export function getTopInsights(recommendations: Recommendation[], count = 3): Recommendation[] {
  return recommendations.slice(0, count);
}
