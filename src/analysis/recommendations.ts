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
      title: "試用轉換表現優異 — 加大獲客投入",
      description: `你的試用轉換率 ${m.value.toFixed(1)}% 超過 ${
        m.value >= (BENCHMARKS["trial_conversion_rate"]?.topQuartile ?? 55) ? "75%" : "50%"
      } 的 app。建議加大試用獲客投入（廣告、ASO），因為你的轉換漏斗已經很健康。`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
    yellow: (m) => ({
      priority: 2,
      title: "試用轉換率有提升空間",
      description: `試用轉換率 ${m.value.toFixed(1)}% 略低於中位數 ${
        BENCHMARKS["trial_conversion_rate"]?.median ?? 35
      }%。建議：(1) 優化 onboarding 流程，(2) 在試用期間發送推播提醒價值亮點，(3) 考慮調整試用天數。SOSA 2026 指出 ${KEY_FACTS.day0TrialCancelRate}% 的 3 天試用取消發生在 Day 0。`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
    red: (m) => ({
      priority: 1,
      title: "試用轉換率偏低 — 需要立即改善",
      description: `試用轉換率僅 ${m.value.toFixed(1)}%，遠低於中位數 ${
        BENCHMARKS["trial_conversion_rate"]?.median ?? 35
      }%。這是最影響收入的指標。建議：(1) 審視試用 onboarding 是否展示核心價值，(2) 檢查定價策略，(3) 考慮 A/B 測試不同試用期長度，(4) 加入 paywall 前的免費功能體驗。`,
      relatedMetric: "trial_conversion_rate",
      impact: "high",
    }),
  },

  churn: {
    green: (m) => ({
      priority: 4,
      title: "流失控制良好",
      description: `月流失率 ${m.value.toFixed(1)}% 表現優異。建議持續監控並維持目前策略。可考慮推動更多用戶轉為年訂閱以進一步降低流失。`,
      relatedMetric: "churn",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 2,
      title: "流失率略高 — 考慮留存策略",
      description: `月流失率 ${m.value.toFixed(1)}% 高於健康水準 5%。建議：(1) 在訂閱到期前 3-5 天發送續訂提醒，(2) 對即將流失的用戶提供折扣挽回方案，(3) 分析取消原因找出共通模式。`,
      relatedMetric: "churn",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 1,
      title: "流失率過高 — 緊急處理",
      description: `月流失率 ${m.value.toFixed(1)}% 超過警戒線 ${
        BENCHMARKS["churn"]?.bottomQuartile ?? 8
      }%。建議立即：(1) 調查取消原因（加入取消流程問卷），(2) 實施 win-back 優惠，(3) 檢查是否有 billing issue 導致非自願流失，(4) 考慮推出年訂閱優惠。`,
      relatedMetric: "churn",
      impact: "high",
    }),
  },

  refund_rate: {
    green: (m) => ({
      priority: 5,
      title: "退款率健康",
      description: `退款率 ${m.value.toFixed(1)}% 遠低於中位數 ${
        BENCHMARKS["refund_rate"]?.median ?? 3
      }%，表示用戶滿意度高。`,
      relatedMetric: "refund_rate",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "退款率接近警戒",
      description: `退款率 ${m.value.toFixed(1)}% 接近中位數。建議檢查：(1) 試用條款是否清晰，(2) 定價頁面是否有誤導，(3) 是否有地區性異常退款模式。`,
      relatedMetric: "refund_rate",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 1,
      title: "退款率過高 — 可能觸發平台審查",
      description: `退款率 ${m.value.toFixed(1)}% 偏高。過高退款率可能導致 App Store/Play Store 審查。建議：(1) 改善購買前的功能說明，(2) 確保試用轉付費有明確提示，(3) 加強客服回應速度。`,
      relatedMetric: "refund_rate",
      impact: "high",
    }),
  },

  mrr: {
    green: (m) => ({
      priority: 4,
      title: "MRR 表現穩健",
      description: `MRR $${m.value.toLocaleString()} ${
        m.value >= (BENCHMARKS["mrr"]?.topQuartile ?? 10_000)
          ? `已進入前 ${KEY_FACTS.appsReaching10kMRR}% 的 app 行列`
          : "高於中位數"
      }。${m.trend === "growing" ? "而且持續成長中，趨勢良好。" : "建議持續投資成長。"}`,
      relatedMetric: "mrr",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "MRR 有成長空間",
      description: `MRR $${m.value.toLocaleString()} 尚未達到中位數水準。關鍵槓桿：(1) 提升試用轉換率，(2) 降低流失率，(3) 提升 ARPU（例如推出更高價方案或年訂閱）。`,
      relatedMetric: "mrr",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 2,
      title: "MRR 偏低 — 需要成長策略",
      description: `MRR $${m.value.toLocaleString()} 低於大多數 app。建議聚焦在最高槓桿的指標改善，通常是試用轉換率和流失率。`,
      relatedMetric: "mrr",
      impact: "medium",
    }),
  },

  ltv_per_customer: {
    green: (m) => ({
      priority: 5,
      title: "LTV 表現良好",
      description: `每客戶 LTV $${m.value.toFixed(2)} 表現良好。可考慮加大付費獲客（CAC）預算，因為 LTV 支撐得住。`,
      relatedMetric: "ltv_per_customer",
      impact: "low",
    }),
    yellow: (m) => ({
      priority: 3,
      title: "LTV 可進一步提升",
      description: `每客戶 LTV $${m.value.toFixed(2)}。建議：(1) 推出年訂閱方案提升 LTV，(2) 加入加值功能提升 ARPU，(3) 改善留存以延長訂閱時長。`,
      relatedMetric: "ltv_per_customer",
      impact: "medium",
    }),
    red: (m) => ({
      priority: 2,
      title: "LTV 偏低 — 限制獲客投資",
      description: `每客戶 LTV 僅 $${m.value.toFixed(2)}，較低的 LTV 限制了你能投入的獲客成本。建議先改善留存和轉換率，再加大獲客投入。`,
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

  // 根據每個指標的健康狀態產生對應建議
  for (const metric of metrics) {
    const templates = RECOMMENDATION_TEMPLATES[metric.name];
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
        title: `${anomaly.metric} 出現異常飆升`,
        description: `${anomaly.date} 偵測到 ${anomaly.metric} 飆升 ${anomaly.magnitude.toFixed(1)}%。${anomaly.description} 建議調查原因，如果是正面因素（如行銷活動成功），考慮複製此策略。`,
        relatedMetric: anomaly.metric,
        impact: "medium",
      });
    }

    if (anomaly.type === "drop" && anomaly.magnitude > 20) {
      recommendations.push({
        priority: 1,
        title: `${anomaly.metric} 出現異常下跌`,
        description: `${anomaly.date} 偵測到 ${anomaly.metric} 下跌 ${anomaly.magnitude.toFixed(1)}%。${anomaly.description} 建議立即調查是否有技術問題、定價變更或市場因素。`,
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
