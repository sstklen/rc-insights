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

/** 圖表分段資料 — segment 查詢時回傳的個別分段 */
export interface ChartSegment {
  /** 分段顯示名稱（例如 "brown noise", "Total"） */
  display_name: string;
  /** 分段識別碼 */
  id: string;
  /** 該分段的時間序列資料點 */
  values: ChartValue[];
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
  /** 圖表資料點（無 segment 時使用） */
  values: ChartValue[];
  /** 量度定義陣列 */
  measures: ChartMeasure[];
  /** 分段資料（有 segment 查詢時回傳，否則為 null 或不存在） */
  segments?: ChartSegment[] | null;
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

/** 專案列表回應（API 回傳的是 items 不是 projects） */
export interface ProjectsResponse {
  items: Project[];
  next_page: string | null;
  object: string;
}

/** 圖表查詢選項 */
export interface ChartQueryOptions {
  /** 開始日期（ISO 8601 格式） */
  start_date?: string;
  /** 結束日期（ISO 8601 格式） */
  end_date?: string;
  /** 時間解析度 */
  resolution?: "day" | "week" | "month";
  /** 分段維度，例如 "attribution_keyword", "offering_identifier", "product_duration" */
  segment?: string;
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
  /** 指標內部識別碼（例如 "churn", "mrr"） */
  metricId: string;
  /** 指標顯示名稱（來自 API 的 display_name） */
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
  /** 戰略行動：改變軌跡的根本動作（為什麼 → 做什麼 → 預期結果） */
  strategy?: StrategyAction;
  /** 戰術行動：立即可執行的具體步驟 */
  actions?: ActionStep[];
  /** 驗證方式：做完後怎麼確認有效 */
  verify?: VerifyStep;
}

/** 戰略行動：解決根因，改變 12 個月軌跡 */
export interface StrategyAction {
  /** 根因分析：為什麼會有這個問題 */
  rootCause: string;
  /** 戰略方向：要做什麼根本改變 */
  strategicMove: string;
  /** 預期 12 個月結果 */
  expectedOutcome: string;
}

/** 具體行動步驟 */
export interface ActionStep {
  /** 行動描述 */
  what: string;
  /** 在哪裡做（Dashboard URL / MCP tool / 外部工具） */
  where: "revenuecat_dashboard" | "mcp" | "app_store_connect" | "code" | "external";
  /** RevenueCat Dashboard 的具體路徑（如果 where=revenuecat_dashboard） */
  dashboardPath?: string;
  /** MCP Server tool 名稱（如果 where=mcp） */
  mcpTool?: string;
  /** MCP tool 參數（如果 where=mcp） */
  mcpParams?: Record<string, unknown>;
}

/** 驗證步驟：做完行動後怎麼確認有效 */
export interface VerifyStep {
  /** 要看什麼指標 */
  metric: string;
  /** 預期方向 */
  direction: "increase" | "decrease" | "stable";
  /** 多久後檢查 */
  checkAfter: string;
  /** 成功的判定標準 */
  successCriteria: string;
}

// ========================================
// 關鍵字分析型別
// ========================================

/** 單一關鍵字的分析洞察 */
export interface KeywordInsight {
  /** 關鍵字名稱 */
  keyword: string;
  /** 總試用數 */
  totalTrials: number;
  /** 總營收 */
  totalRevenue: number;
  /** 平均轉換率（百分比），資料不可用時為 null */
  avgConversionRate: number | null;
  /** 效率等級 */
  efficiency: "high" | "medium" | "low";
  /** 文字建議 */
  recommendation: string;
}

/** 關鍵字分析結果 */
export interface KeywordAnalysisResult {
  /** 按營收排序的關鍵字洞察 */
  keywords: KeywordInsight[];
  /** 營收最高的關鍵字 */
  topKeyword: string;
  /** 分析摘要敘述 */
  narrative: string;
  /** 是否有歸因資料（false 表示完全沒有關鍵字資料） */
  hasAttributionData: boolean;
}

// ========================================
// Offering/Paywall 分析型別
// ========================================

/** 單一 Offering 的分析洞察 */
export interface OfferingInsight {
  /** Offering 顯示名稱 */
  offeringName: string;
  /** Offering 識別碼 */
  offeringId: string;
  /** 試用開始數 */
  trialStarts: number;
  /** 轉換率（百分比），資料不可用時為 null */
  conversionRate: number | null;
  /** 營收 */
  revenue: number;
  /** 表現等級 */
  performance: "top" | "average" | "below";
}

/** Offering 分析結果 */
export interface OfferingAnalysisResult {
  /** 按營收排序的 Offering 洞察 */
  offerings: OfferingInsight[];
  /** 表現最好的 Offering */
  bestOffering: string;
  /** 分析摘要敘述 */
  narrative: string;
}

/** Quick Ratio 分析結果（由 quick-ratio.ts 計算） */
import type { QuickRatioResult } from "../analysis/quick-ratio.ts";
export type { QuickRatioResult };
/** PMF Score 分析結果（由 pmf-score.ts 計算） */
import type { PMFScoreResult } from "../analysis/pmf-score.ts";
export type { PMFScoreResult };
/** MRR 預測結果（由 mrr-forecast.ts 產生） */
import type { MRRForecastResult } from "../analysis/mrr-forecast.ts";
export type { MRRForecastResult };
/** 場景分析結果（由 scenario-engine.ts 產生） */
import type { ScenarioAnalysisResult } from "../analysis/scenario-engine.ts";
export type { ScenarioAnalysisResult };
/** Executive Summary（由 executive-summary.ts 產生） */
import type { ExecutiveSummary } from "../analysis/executive-summary.ts";
export type { ExecutiveSummary };

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
  /** 關鍵字歸因分析（額外 API 呼叫，可能為 undefined） */
  keywordAnalysis?: KeywordAnalysisResult;
  /** Offering/Paywall 實驗分析（額外 API 呼叫，可能為 undefined） */
  offeringAnalysis?: OfferingAnalysisResult;
  /** Quick Ratio 分析（需要 mrr_movement 圖表資料） */
  quickRatio?: QuickRatioResult;
  /** PMF Score 分析（綜合多指標評分） */
  pmfScore?: PMFScoreResult;
  /** MRR 六個月預測（需要 12 個月歷史數據） */
  mrrForecast?: MRRForecastResult;
  /** What-if 場景分析 */
  scenarios?: ScenarioAnalysisResult;
  /** LLM 增強建議（有 LLM API key 時可用） */
  llmRecommendations?: LLMRecommendationResult[];
  /** LLM 下一個產品建議 */
  nextProductSuggestions?: NextProductSuggestion[];
  /** LLM Agent 行動計畫 */
  agentPlan?: AgentPlanResult;
  /** 飛輪分析結果 */
  flywheel?: FlywheelResult;
  /** Executive Summary（報告最上面的關鍵提煉） */
  executiveSummary?: ExecutiveSummary;
}

/** LLM 增強建議 */
export interface LLMRecommendationResult {
  priority: number;
  title: string;
  description: string;
  actionSteps: string[];
  expectedImpact: string;
  timeToImplement: string;
  confidence: "high" | "medium" | "low";
  relatedMetric: string;
  source: "llm" | "rule_engine";
}

/** 下一個產品建議 */
export interface NextProductSuggestion {
  direction: "vertical" | "horizontal" | "adjacent";
  directionLabel: string;
  title: string;
  rationale: string;
  dataEvidence: string[];
  score: number;
  implementationComplexity: "low" | "medium" | "high";
  source: "llm" | "rule_engine";
}

// ========================================
// Flywheel（飛輪）型別
// ========================================

/** 飛輪單一洞察 */
export interface FlywheelInsight {
  /** 飛輪層級：1-4 */
  layer: 1 | 2 | 3 | 4;
  /** 層級名稱 */
  layerName: "Your Data" | "Peer Comparison" | "Category Intelligence" | "Market Opportunity";
  /** 洞察標題 */
  title: string;
  /** 洞察說明 */
  description: string;
  /** 連結到 RevenueCat Dashboard 的 URL */
  actionUrl?: string;
  /** MCP Server 可執行的動作識別碼 */
  mcpAction?: string;
  /** 是否需要付費解鎖 */
  isPremium: boolean;
  /** 預估價值說明 */
  estimatedValue: string;
}

/** 飛輪分析結果 */
export interface FlywheelResult {
  /** 所有飛輪洞察 */
  insights: FlywheelInsight[];
  /** 用戶目前所在層級 */
  currentLayer: number;
  /** 引導升級的文字 */
  nextLayerTeaser: string;
  /** 飛輪整體敘事 */
  flyWheelNarrative: string;
}

// ========================================
// Monitor（監控）型別
// ========================================

/** 警報類型 */
export type AlertChannel = "slack" | "email" | "terminal";

/** 監控警報 */
export interface MonitorAlert {
  /** 警報等級 */
  severity: "critical" | "warning" | "info";
  /** 觸發指標 */
  metric: string;
  /** 警報訊息 */
  message: string;
  /** 前次值 */
  previousValue: number;
  /** 目前值 */
  currentValue: number;
  /** 變動百分比 */
  changePercent: number;
  /** 觸發時間 */
  triggeredAt: string;
}

/** 監控快照（存入 SQLite） */
export interface MonitorSnapshot {
  /** 快照 ID */
  id?: number;
  /** 專案 ID */
  projectId: string;
  /** 快照時間 */
  timestamp: string;
  /** MRR 值 */
  mrr: number;
  /** Churn Rate */
  churnRate: number;
  /** Quick Ratio */
  quickRatio: number;
  /** 異常數量 */
  anomalyCount: number;
  /** 完整報告 JSON */
  reportJson: string;
}

/** Agent 行動計畫 */
export interface AgentPlanResult {
  summary: string;
  actions: Array<{
    id: number;
    type: string;
    description: string;
    mcpTool: string;
    mcpParams: Record<string, unknown>;
    expectedImpact: string;
    priority: string;
  }>;
  estimatedMRRImpact: string;
  disclaimer: string;
  source: "llm" | "rule_engine";
}
