// ========================================
// 關鍵字歸因分析模組
// 透過 segment=attribution_keyword 拉取按廣告關鍵字分段的營收、試用、轉換率
// 整合後按營收排序，標記效率等級
// ========================================

import type {
  ChartQueryOptions,
  ChartSegment,
  KeywordInsight,
  KeywordAnalysisResult,
} from "../api/types.ts";
import type { RevenueCatClient } from "../api/client.ts";
import { logger } from "../utils/logger.ts";
import { sumSegmentValues, avgSegmentValues, extractValidSegments } from "../utils/segment.ts";

/** 需要過濾掉的非真實關鍵字（API 回傳的佔位值） */
const FILTERED_KEYWORDS = new Set([
  "total",
  "no keyword",
  "no attribution",
]);

/**
 * 判斷關鍵字效率等級
 * 高營收 + 高轉換率 = high
 * 高試用 + 低轉換率 = low
 * 其餘 = medium
 */
function classifyEfficiency(
  revenue: number,
  trials: number,
  conversionRate: number | null,
  medianRevenue: number,
  medianConversion: number | null,
): "high" | "medium" | "low" {
  // 沒有轉換率資料時，只看營收
  if (conversionRate === null || medianConversion === null) {
    return revenue >= medianRevenue ? "high" : "medium";
  }

  const highRevenue = revenue >= medianRevenue;
  const highConversion = conversionRate >= medianConversion;
  const highTrials = trials > 0;

  if (highRevenue && highConversion) return "high";
  if (highTrials && !highConversion) return "low";
  return "medium";
}

/**
 * 為關鍵字產生文字建議
 */
function generateRecommendation(
  keyword: string,
  efficiency: "high" | "medium" | "low",
  revenue: number,
  trials: number,
  conversionRate: number | null,
): string {
  switch (efficiency) {
    case "high":
      return `"${keyword}" is a top performer — consider increasing ad spend on this keyword.`;
    case "low":
      return `"${keyword}" drives ${trials} trials but converts poorly${conversionRate !== null ? ` (${conversionRate.toFixed(1)}%)` : ""} — review the landing page or paywall for this traffic source.`;
    case "medium":
      return `"${keyword}" shows moderate performance ($${revenue.toFixed(0)} revenue) — monitor and test optimizations.`;
  }
}

/**
 * 分析關鍵字歸因表現
 *
 * 呼叫 3 個 segment API（revenue, trials_new, trial_conversion_rate）
 * 整合後按營收排序，標記效率等級
 *
 * @param client - RevenueCat API 客戶端
 * @param projectId - 專案 ID
 * @param dateOptions - 日期查詢選項（不含 segment，函數自行加入）
 */
export async function analyzeKeywords(
  client: RevenueCatClient,
  projectId: string,
  dateOptions: ChartQueryOptions,
): Promise<KeywordAnalysisResult> {
  const segmentOptions: ChartQueryOptions = {
    ...dateOptions,
    segment: "attribution_keyword",
  };

  // 依序呼叫 API（受速率限制保護）
  // 1. 營收按關鍵字分段
  let revenueSegments: Map<string, ChartSegment> = new Map();
  try {
    const revenueData = await client.getChart(projectId, "revenue", segmentOptions);
    revenueSegments = extractValidSegments(revenueData.segments, FILTERED_KEYWORDS);
    logger.debug(`Keyword revenue segments: ${revenueSegments.size}`);
  } catch (err) {
    logger.warn(`Failed to fetch keyword revenue: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. 試用數按關鍵字分段
  let trialsSegments: Map<string, ChartSegment> = new Map();
  try {
    const trialsData = await client.getChart(projectId, "trials_new", segmentOptions);
    trialsSegments = extractValidSegments(trialsData.segments, FILTERED_KEYWORDS);
    logger.debug(`Keyword trials segments: ${trialsSegments.size}`);
  } catch (err) {
    logger.warn(`Failed to fetch keyword trials: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. 轉換率按關鍵字分段（可能不支援，graceful 失敗）
  let conversionSegments: Map<string, ChartSegment> = new Map();
  try {
    const conversionData = await client.getChart(projectId, "trial_conversion_rate", segmentOptions);
    conversionSegments = extractValidSegments(conversionData.segments, FILTERED_KEYWORDS);
    logger.debug(`Keyword conversion segments: ${conversionSegments.size}`);
  } catch (err) {
    logger.debug(`Keyword conversion rate not available: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 合併所有出現過的關鍵字
  const allKeywords = new Set<string>([
    ...revenueSegments.keys(),
    ...trialsSegments.keys(),
    ...conversionSegments.keys(),
  ]);

  // 沒有任何關鍵字資料 → 回傳空結果
  if (allKeywords.size === 0) {
    return {
      keywords: [],
      topKeyword: "N/A",
      narrative: "No keyword attribution data found. This may mean the app does not use Apple Search Ads or other attributed install sources.",
      hasAttributionData: false,
    };
  }

  // 整合每個關鍵字的資料
  const rawInsights: Array<{
    keyword: string;
    totalRevenue: number;
    totalTrials: number;
    avgConversionRate: number | null;
  }> = [];

  for (const keyword of allKeywords) {
    const revSeg = revenueSegments.get(keyword);
    const trialSeg = trialsSegments.get(keyword);
    const convSeg = conversionSegments.get(keyword);

    const totalRevenue = revSeg ? sumSegmentValues(revSeg) : 0;
    const totalTrials = trialSeg ? sumSegmentValues(trialSeg) : 0;
    const avgConversionRate = convSeg ? avgSegmentValues(convSeg) : null;

    rawInsights.push({ keyword, totalRevenue, totalTrials, avgConversionRate });
  }

  // 按營收排序（高到低）
  rawInsights.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // 計算中位數，用於效率分類
  const revenues = rawInsights.map((r) => r.totalRevenue).sort((a, b) => a - b);
  const medianRevenue = revenues.length > 0
    ? revenues[Math.floor(revenues.length / 2)]!
    : 0;

  const convRates = rawInsights
    .map((r) => r.avgConversionRate)
    .filter((r): r is number => r !== null)
    .sort((a, b) => a - b);
  const medianConversion = convRates.length > 0
    ? convRates[Math.floor(convRates.length / 2)]!
    : null;

  // 產生最終洞察
  const keywords: KeywordInsight[] = rawInsights.map((raw) => {
    const efficiency = classifyEfficiency(
      raw.totalRevenue,
      raw.totalTrials,
      raw.avgConversionRate,
      medianRevenue,
      medianConversion,
    );

    return {
      keyword: raw.keyword,
      totalTrials: Math.round(raw.totalTrials),
      totalRevenue: Math.round(raw.totalRevenue * 100) / 100,
      avgConversionRate: raw.avgConversionRate !== null
        ? Math.round(raw.avgConversionRate * 100) / 100
        : null,
      efficiency,
      recommendation: generateRecommendation(
        raw.keyword,
        efficiency,
        raw.totalRevenue,
        raw.totalTrials,
        raw.avgConversionRate,
      ),
    };
  });

  const topKeyword = keywords[0]?.keyword ?? "N/A";

  // 產生分析摘要
  const highCount = keywords.filter((k) => k.efficiency === "high").length;
  const lowCount = keywords.filter((k) => k.efficiency === "low").length;
  const totalRevenue = keywords.reduce((sum, k) => sum + k.totalRevenue, 0);

  const narrative = [
    `Found ${keywords.length} attributed keywords generating $${totalRevenue.toFixed(0)} total revenue.`,
    `Top keyword: "${topKeyword}" ($${keywords[0]?.totalRevenue.toFixed(0) ?? "0"}).`,
    highCount > 0 ? `${highCount} high-efficiency keyword${highCount > 1 ? "s" : ""} worth scaling.` : "",
    lowCount > 0 ? `${lowCount} low-efficiency keyword${lowCount > 1 ? "s" : ""} need paywall/landing optimization.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    keywords,
    topKeyword,
    narrative,
    hasAttributionData: true,
  };
}
