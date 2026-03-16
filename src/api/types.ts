// ========================================
// RevenueCat Charts API v2 型別定義
// ========================================

/** 概覽指標 — 來自 /metrics/overview 端點 */
export interface OverviewMetric {
  /** 指標唯一識別碼，例如 "mrr", "active_subscribers" */
  id: string;
  /** 指標顯示名稱 */
  name: string;
  /** 指標說明 */
  description: string;
  /** 單位，"$" 代表金額，"#" 代表數量 */
  unit: string;
  /** ISO 8601 期間，"P0D" 為即時快照，"P28D" 為 28 天期間 */
  period: string;
  /** 指標數值 */
  value: number;
}

/** 概覽回應 */
export interface OverviewResponse {
  metrics: OverviewMetric[];
}

/** 圖表資料值 */
export interface ChartValue {
  /** 世代時間戳（Unix 秒） */
  cohort: number;
  /** 是否為不完整期間（尚未結束的區間） */
  incomplete: boolean;
  /** 對應 measures 陣列的索引 */
  measure: number;
  /** 指標數值 */
  value: number;
}

/** 圖表量度定義 */
export interface ChartMeasure {
  /** 顯示名稱 */
  display_name: string;
  /** 說明 */
  description: string;
  /** 單位，例如 "$", "#", "%" */
  unit: string;
  /** 是否可繪圖 */
  chartable: boolean;
  /** 是否可列表 */
  tabulable: boolean;
  /** 小數精度 */
  decimal_precision: number;
}

/** 圖表回應 — 來自 /charts/{chartName} 端點 */
export interface ChartData {
  /** 圖表顯示名稱 */
  display_name: string;
  /** 圖表說明 */
  description: string;
  /** 分類 */
  category: string;
  /** 時間解析度，例如 "month", "week", "day" */
  resolution: string;
  /** 開始時間戳（Unix 秒） */
  start_date: number;
  /** 結束時間戳（Unix 秒） */
  end_date: number;
  /** 摘要統計 */
  summary: Record<string, Record<string, number>>;
  /** 圖表資料點 */
  values: ChartValue[];
  /** 量度定義陣列 */
  measures: ChartMeasure[];
}

/** 圖表選項回應 */
export interface ChartOptions {
  /** 可用篩選選項 */
  filters: ChartFilter[];
}

/** 圖表篩選器 */
export interface ChartFilter {
  /** 篩選器名稱 */
  name: string;
  /** 篩選器類型 */
  type: string;
  /** 可選值 */
  values: string[];
}

/** 專案資訊 */
export interface Project {
  /** 專案 ID */
  id: string;
  /** 專案名稱 */
  name: string;
}

/** 專案列表回應 */
export interface ProjectsResponse {
  projects: Project[];
}

/** 圖表查詢選項 */
export interface ChartQueryOptions {
  /** 開始日期（ISO 8601 格式） */
  start_date?: string;
  /** 結束日期（ISO 8601 格式） */
  end_date?: string;
  /** 時間解析度 */
  resolution?: "day" | "week" | "month";
}

/** 所有可用的圖表名稱 */
export type ChartName =
  | "actives"
  | "actives_movement"
  | "actives_new"
  | "arr"
  | "churn"
  | "cohort_explorer"
  | "conversion_to_paying"
  | "customers_new"
  | "ltv_per_customer"
  | "ltv_per_paying_customer"
  | "mrr"
  | "mrr_movement"
  | "refund_rate"
  | "revenue"
  | "subscription_retention"
  | "subscription_status"
  | "trials"
  | "trials_movement"
  | "trials_new"
  | "customers_active"
  | "trial_conversion_rate";

/** 健康狀態等級 */
export type HealthStatus = "green" | "yellow" | "red";

/** 趨勢方向 */
export type TrendDirection = "growing" | "stable" | "declining";

/** 單一指標的健康評估結果 */
export interface MetricHealth {
  /** 指標名稱 */
  name: string;
  /** 目前數值 */
  value: number;
  /** 單位 */
  unit: string;
  /** 健康狀態 */
  status: HealthStatus;
  /** 趨勢方向 */
  trend: TrendDirection;
  /** 月環比變化百分比 */
  changePercent: number;
  /** 基準值 */
  benchmark: number;
  /** 基準說明 */
  benchmarkLabel: string;
}

/** 異常偵測結果 */
export interface Anomaly {
  /** 指標名稱 */
  metric: string;
  /** 異常類型 */
  type: "spike" | "drop";
  /** 發生日期 */
  date: string;
  /** 變化幅度百分比 */
  magnitude: number;
  /** 說明 */
  description: string;
}

/** 建議項目 */
export interface Recommendation {
  /** 優先級（1 最高） */
  priority: number;
  /** 標題 */
  title: string;
  /** 詳細說明 */
  description: string;
  /** 相關指標 */
  relatedMetric: string;
  /** 預期影響 */
  impact: "high" | "medium" | "low";
}

/** 完整健康報告 */
export interface HealthReport {
  /** 專案名稱 */
  projectName: string;
  /** 專案 ID */
  projectId: string;
  /** 報告產生時間 */
  generatedAt: string;
  /** 概覽指標（原始） */
  overview: OverviewMetric[];
  /** 各指標健康評估 */
  metrics: MetricHealth[];
  /** 異常偵測 */
  anomalies: Anomaly[];
  /** 建議 */
  recommendations: Recommendation[];
}
