// ========================================
// SOSA 2026 基準數據
// 來源：RevenueCat State of Subscription Apps 2026
// ========================================

/** 單一基準定義 */
export interface Benchmark {
  /** 基準名稱 */
  name: string;
  /** 對應指標的識別碼 */
  metricId: string;
  /** 中位數 */
  median: number;
  /** 前 25% 門檻 */
  topQuartile: number;
  /** 後 25% 門檻（低於此值表現差） */
  bottomQuartile: number;
  /** 單位 */
  unit: string;
  /** 來源說明 */
  source: string;
  /** 判斷方向：higher = 越高越好，lower = 越低越好 */
  direction: "higher" | "lower";
}

/**
 * SOSA 2026 核心基準數據
 * 所有百分比值以百分比形式儲存（例如 35 代表 35%）
 */
export const BENCHMARKS: Record<string, Benchmark> = {
  // === 試用轉換 ===
  trial_conversion_rate: {
    name: "試用轉換率",
    metricId: "trial_conversion_rate",
    median: 35,
    topQuartile: 55,
    bottomQuartile: 20,
    unit: "%",
    source: "SOSA 2026: 中位數 ~35%, 前 25% ~55%",
    direction: "higher",
  },

  // === 流失率 ===
  churn: {
    name: "月流失率",
    metricId: "churn",
    median: 6,
    topQuartile: 3.5,
    bottomQuartile: 8,
    unit: "%",
    source: "SOSA 2026: 健康 <5%, 中位數 ~6%, 警戒 >8%",
    direction: "lower",
  },

  // === 退款率 ===
  refund_rate: {
    name: "退款率",
    metricId: "refund_rate",
    median: 3,
    topQuartile: 1.5,
    bottomQuartile: 5,
    unit: "%",
    source: "SOSA 2026: 中位數 ~3%",
    direction: "lower",
  },

  // === MRR 門檻 ===
  mrr: {
    name: "月經常性收入 (MRR)",
    metricId: "mrr",
    median: 2_000,
    topQuartile: 10_000,
    bottomQuartile: 500,
    unit: "$",
    source: "SOSA 2026: 僅 4.6% 的 app 達到 $10K MRR",
    direction: "higher",
  },

  // === ARR ===
  arr: {
    name: "年經常性收入 (ARR)",
    metricId: "arr",
    median: 24_000,
    topQuartile: 120_000,
    bottomQuartile: 6_000,
    unit: "$",
    source: "SOSA 2026: 由 MRR 基準推算",
    direction: "higher",
  },

  // === LTV ===
  ltv_per_customer: {
    name: "每客戶終身價值",
    metricId: "ltv_per_customer",
    median: 3.5,
    topQuartile: 8,
    bottomQuartile: 1,
    unit: "$",
    source: "SOSA 2026: 視 app 類型差異大",
    direction: "higher",
  },
};

/**
 * 關鍵事實 — 報告中引用的重要統計
 */
export const KEY_FACTS = {
  /** Day 0 試用取消佔所有 3 天試用取消的比例 */
  day0TrialCancelRate: 55,
  /** 達到 $10K MRR 的 app 百分比 */
  appsReaching10kMRR: 4.6,
  /** 年訂閱比月訂閱的留存優勢（倍數） */
  annualRetentionAdvantage: "Annual subscribers retain significantly better than monthly",
  /** 中位數 app 收入 */
  medianAppRevenue: "Most apps earn under $1K/month",
};

/**
 * 根據指標名稱取得對應基準
 * 若無對應基準則回傳 undefined
 */
export function getBenchmark(metricId: string): Benchmark | undefined {
  return BENCHMARKS[metricId];
}

/**
 * 取得所有基準的摘要（用於報告）
 */
export function getAllBenchmarks(): Benchmark[] {
  return Object.values(BENCHMARKS);
}

/**
 * 評估數值相對於基準的表現
 * @param value - 實際數值
 * @param benchmark - 基準定義
 * @returns "green" | "yellow" | "red"
 */
export function evaluateAgainstBenchmark(
  value: number,
  benchmark: Benchmark,
): "green" | "yellow" | "red" {
  if (benchmark.direction === "higher") {
    // 越高越好：超過中位數=綠，低於底部四分位=紅，其餘=黃
    if (value >= benchmark.median) return "green";
    if (value <= benchmark.bottomQuartile) return "red";
    return "yellow";
  } else {
    // 越低越好：低於中位數=綠，超過底部四分位=紅，其餘=黃
    if (value <= benchmark.topQuartile) return "green";
    if (value >= benchmark.bottomQuartile) return "red";
    return "yellow";
  }
}
