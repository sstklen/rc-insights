// ========================================
// AI 建議引擎
// 根據健康指標分析產生可執行建議
// ========================================

import type { MetricHealth, Recommendation, Anomaly, HealthStatus } from "../api/types.ts";
import { BENCHMARKS, KEY_FACTS } from "./benchmarks.ts";

/**
 * 建議模板 — 每個指標對應不同狀態的建議
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
      } of apps. Consider scaling acquisition (ads, ASO) since your conversion funnel is already healthy.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
    yellow: (m) => ({
      priority: 2,
      title: "Trial conversion has room for improvement",
      description: `Trial conversion rate of ${m.value.toFixed(1)}% is below the median of ${
        BENCHMARKS["trial_conversion_rate"]?.median ?? 35
      }%. Suggestions: (1) Optimize the onboarding flow, (2) Send push notifications highlighting value during the trial, (3) Consider adjusting trial length. SOSA 2026 reports that ${KEY_FACTS.day0TrialCancelRate}% of 3-day trial cancellations happen on Day 0.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
    red: (m) => ({
      priority: 1,
      title: "Trial conversion critically low — immediate action needed",
      description: `Trial conversion rate is only ${m.value.toFixed(1)}%, well below the median of ${
        BENCHMARKS["trial_conversion_rate"]?.median ?? 35
      }%. This is the highest-leverage metric for revenue. Suggestions: (1) Audit whether the trial onboarding showcases core value, (2) Review pricing strategy, (3) A/B test different trial durations, (4) Add free feature access before the paywall.`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
  },

  churn: {
    green: (m) => ({
      priority: 4,
      title: "Churn is well-controlled",
      description: `Monthly churn rate of ${m.value.toFixed(1)}% is excellent. Maintain current retention strategies. Consider pushing more users toward annual plans to further reduce churn.`,
      relatedMetric: "churn",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 2,
      title: "Churn slightly elevated — consider retention strategies",
      description: `Monthly churn rate of ${m.value.toFixed(1)}% is above the healthy threshold of 5%. Suggestions: (1) Send renewal reminders 3-5 days before expiry, (2) Offer discount win-back flows to at-risk users, (3) Analyze cancellation reasons for common patterns.`,
      relatedMetric: "churn",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 1,
      title: "Churn rate critical — urgent action required",
      description: `Monthly churn rate of ${m.value.toFixed(1)}% exceeds the warning threshold of ${
        BENCHMARKS["churn"]?.bottomQuartile ?? 8
      }%. Immediate actions: (1) Add a cancellation survey to identify root causes, (2) Implement win-back offers, (3) Check for billing issues causing involuntary churn, (4) Consider annual subscription discounts.`,
      relatedMetric: "churn",
      impact: "high",
    }),
  },

  refund_rate: {
    green: (m) => ({
      priority: 5,
      title: "Refund rate is healthy",
      description: `Refund rate of ${m.value.toFixed(1)}% is well below the median of ${
        BENCHMARKS["refund_rate"]?.median ?? 3
      }%, indicating strong user satisfaction.`,
      relatedMetric: "refund_rate",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "Refund rate approaching warning level",
      description: `Refund rate of ${m.value.toFixed(1)}% is near the median. Review: (1) Whether trial terms are clearly communicated, (2) Whether the pricing page is misleading, (3) Whether there are region-specific refund patterns.`,
      relatedMetric: "refund_rate",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 1,
      title: "Refund rate too high — potential store review risk",
      description: `Refund rate of ${m.value.toFixed(1)}% is elevated. High refund rates may trigger App Store/Play Store reviews. Suggestions: (1) Improve pre-purchase feature descriptions, (2) Ensure trial-to-paid transition has clear prompts, (3) Improve customer support response times.`,
      relatedMetric: "refund_rate",
      impact: "high",
    }),
  },

  mrr: {
    green: (m) => ({
      priority: 4,
      title: "MRR performing well",
      description: `MRR of $${m.value.toLocaleString()} ${
        m.value >= (BENCHMARKS["mrr"]?.topQuartile ?? 10_000)
          ? `places you in the top ${KEY_FACTS.appsReaching10kMRR}% of apps`
          : "is above the median"
      }. ${m.trend === "growing" ? "Growth trend is positive — keep investing." : "Consider investing in growth."}`,
      relatedMetric: "mrr",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "MRR has growth potential",
      description: `MRR of $${m.value.toLocaleString()} hasn't reached the median yet. Key levers: (1) Improve trial conversion, (2) Reduce churn, (3) Increase ARPU (e.g., higher-tier plans or annual subscriptions).`,
      relatedMetric: "mrr",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 2,
      title: "MRR below benchmark — growth strategy needed",
      description: `MRR of $${m.value.toLocaleString()} is below most apps. Focus on the highest-leverage improvements, typically trial conversion and churn reduction.`,
      relatedMetric: "mrr",
      impact: "medium",
    }),
  },

  ltv_per_customer: {
    green: (m) => ({
      priority: 5,
      title: "LTV looking strong",
      description: `LTV per customer of $${m.value.toFixed(2)} is healthy. Consider scaling paid acquisition (CAC) since your LTV can support it.`,
      relatedMetric: "ltv_per_customer",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "LTV could be improved",
      description: `LTV per customer of $${m.value.toFixed(2)} has room to grow. Suggestions: (1) Introduce annual plans to boost LTV, (2) Add premium features to increase ARPU, (3) Improve retention to extend subscription lifetimes.`,
      relatedMetric: "ltv_per_customer",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 2,
      title: "LTV too low — limits acquisition investment",
      description: `LTV per customer is only $${m.value.toFixed(2)}. Low LTV constrains how much you can invest in acquisition. Prioritize improving retention and conversion before scaling acquisition spend.`,
      relatedMetric: "ltv_per_customer",
      impact: "medium",
    }),
  },
};

/**
 * 根據健康指標產生建議列表
 * @param metrics - 各指標的健康評估結果
 * @param anomalies - 異常偵測結果
 * @returns 排序後的建議列表（優先級從高到低）
 */
export function generateRecommendations(
  metrics: MetricHealth[],
  anomalies: Anomaly[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 根據每個指標的健康狀態產生對應建議（使用 metricId 查找模板）
  for (const metric of metrics) {
    const templates = RECOMMENDATION_TEMPLATES[metric.metricId];
    if (!templates) continue;

    const generator = templates[metric.status];
    if (!generator) continue;

    const rec = generator(metric);
    if (rec) {
      recommendations.push(rec);
    }
  }

  // 根據異常加入額外建議
  for (const anomaly of anomalies) {
    if (anomaly.type === "spike" && anomaly.magnitude > 20) {
      recommendations.push({
        priority: 3,
        title: `Unusual spike in ${anomaly.metric}`,
        description: `${anomaly.metric} spiked ${anomaly.magnitude.toFixed(1)}% on ${anomaly.date}. If this was caused by a positive factor (e.g., successful marketing campaign), consider replicating the strategy.`,
        relatedMetric: anomaly.metric,
        impact: "medium",
      });
    }

    if (anomaly.type === "drop" && anomaly.magnitude > 20) {
      recommendations.push({
        priority: 1,
        title: `Unusual drop in ${anomaly.metric}`,
        description: `${anomaly.metric} dropped ${anomaly.magnitude.toFixed(1)}% on ${anomaly.date}. Investigate immediately for potential technical issues, pricing changes, or market factors.`,
        relatedMetric: anomaly.metric,
        impact: "high",
      });
    }
  }

  // 按優先級排序（數字越小越優先）
  recommendations.sort((a, b) => a.priority - b.priority);

  return recommendations;
}

/**
 * 產生報告摘要用的關鍵洞察（取前 N 筆最重要的建議）
 */
export function getTopInsights(recommendations: Recommendation[], count = 3): Recommendation[] {
  return recommendations.slice(0, count);
}
