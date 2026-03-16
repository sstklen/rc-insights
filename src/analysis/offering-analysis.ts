// ========================================
// Offering/Paywall 實驗分析模組
// 透過 segment=offering_identifier 拉取按 Offering 分段的營收、試用、轉換率
// 比較不同 Offering 的表現，找出最佳付費牆設計
// ========================================

import type {
  ChartQueryOptions,
  ChartSegment,
  OfferingInsight,
  OfferingAnalysisResult,
} from "../api/types.ts";
import type { RevenueCatClient } from "../api/client.ts";
import { logger } from "../utils/logger.ts";
import { sumSegmentValues, avgSegmentValues, extractValidSegments } from "../utils/segment.ts";

/** 需要過濾掉的 segment（Total 是所有 offering 的加總，不是具體 offering） */
const FILTERED_OFFERING_IDS = new Set(["total"]);

/**
 * 根據營收排名判斷 offering 表現等級
 * 前 25% = top, 後 25% = below, 其餘 = average
 */
function classifyPerformance(
  rank: number,
  total: number,
): "top" | "average" | "below" {
  if (total <= 1) return "top";
  const percentile = rank / total;
  if (percentile <= 0.25) return "top";
  if (percentile > 0.75) return "below";
  return "average";
}

/**
 * 分析 Offering/Paywall 實驗表現
 *
 * 呼叫 3 個 segment API（revenue, trials_new, trial_conversion_rate）
 * 整合後按營收排序，比較不同 offering 的表現
 *
 * @param client - RevenueCat API 客戶端
 * @param projectId - 專案 ID
 * @param dateOptions - 日期查詢選項（不含 segment，函數自行加入）
 */
export async function analyzeOfferings(
  client: RevenueCatClient,
  projectId: string,
  dateOptions: ChartQueryOptions,
): Promise<OfferingAnalysisResult> {
  const segmentOptions: ChartQueryOptions = {
    ...dateOptions,
    segment: "offering_identifier",
  };

  // 依序呼叫 API（受速率限制保護）
  // 1. 營收按 offering 分段
  let revenueSegments: Map<string, ChartSegment> = new Map();
  try {
    const revenueData = await client.getChart(projectId, "revenue", segmentOptions);
    revenueSegments = extractValidSegments(revenueData.segments, FILTERED_OFFERING_IDS);
    logger.debug(`Offering revenue segments: ${revenueSegments.size}`);
  } catch (err) {
    logger.warn(`Failed to fetch offering revenue: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. 轉換率按 offering 分段
  let conversionSegments: Map<string, ChartSegment> = new Map();
  try {
    const conversionData = await client.getChart(projectId, "trial_conversion_rate", segmentOptions);
    conversionSegments = extractValidSegments(conversionData.segments, FILTERED_OFFERING_IDS);
    logger.debug(`Offering conversion segments: ${conversionSegments.size}`);
  } catch (err) {
    logger.debug(`Offering conversion rate not available: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. 試用數按 offering 分段
  let trialsSegments: Map<string, ChartSegment> = new Map();
  try {
    const trialsData = await client.getChart(projectId, "trials_new", segmentOptions);
    trialsSegments = extractValidSegments(trialsData.segments, FILTERED_OFFERING_IDS);
    logger.debug(`Offering trials segments: ${trialsSegments.size}`);
  } catch (err) {
    logger.debug(`Offering trials not available: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 合併所有出現過的 offering
  const allOfferings = new Set<string>([
    ...revenueSegments.keys(),
    ...conversionSegments.keys(),
    ...trialsSegments.keys(),
  ]);

  // 沒有任何 offering 資料 → 回傳空結果
  if (allOfferings.size === 0) {
    return {
      offerings: [],
      bestOffering: "N/A",
      narrative: "No offering segment data found. This may mean the app uses a single default offering.",
    };
  }

  // 整合每個 offering 的資料
  const rawInsights: Array<{
    offeringId: string;
    offeringName: string;
    revenue: number;
    trialStarts: number;
    conversionRate: number | null;
  }> = [];

  for (const offeringId of allOfferings) {
    const revSeg = revenueSegments.get(offeringId);
    const convSeg = conversionSegments.get(offeringId);
    const trialSeg = trialsSegments.get(offeringId);

    // 取顯示名稱（優先從 revenue segment 取，因為通常最完整）
    const displayName = revSeg?.display_name
      ?? convSeg?.display_name
      ?? trialSeg?.display_name
      ?? offeringId;

    const revenue = revSeg ? sumSegmentValues(revSeg) : 0;
    const trialStarts = trialSeg ? sumSegmentValues(trialSeg) : 0;
    const conversionRate = convSeg ? avgSegmentValues(convSeg) : null;

    rawInsights.push({
      offeringId,
      offeringName: displayName,
      revenue,
      trialStarts,
      conversionRate,
    });
  }

  // 按營收排序（高到低）
  rawInsights.sort((a, b) => b.revenue - a.revenue);

  // 產生最終洞察
  const total = rawInsights.length;
  const offerings: OfferingInsight[] = rawInsights.map((raw, index) => ({
    offeringName: raw.offeringName,
    offeringId: raw.offeringId,
    trialStarts: Math.round(raw.trialStarts),
    conversionRate: raw.conversionRate !== null
      ? Math.round(raw.conversionRate * 100) / 100
      : null,
    revenue: Math.round(raw.revenue * 100) / 100,
    performance: classifyPerformance(index, total),
  }));

  const bestOffering = offerings[0]?.offeringName ?? "N/A";
  const bestRevenue = offerings[0]?.revenue ?? 0;

  // 找出轉換率最高的 offering（有轉換率資料的才列入）
  const withConversion = offerings.filter((o) => o.conversionRate !== null);
  const bestConverter = withConversion.length > 0
    ? withConversion.reduce((best, curr) =>
        (curr.conversionRate ?? 0) > (best.conversionRate ?? 0) ? curr : best,
      )
    : null;

  // 產生分析摘要
  const totalRevenue = offerings.reduce((sum, o) => sum + o.revenue, 0);
  const topCount = offerings.filter((o) => o.performance === "top").length;
  const belowCount = offerings.filter((o) => o.performance === "below").length;

  const narrativeParts = [
    `Analyzed ${offerings.length} offerings generating $${totalRevenue.toFixed(0)} total revenue.`,
    `Best by revenue: "${bestOffering}" ($${bestRevenue.toFixed(0)}).`,
  ];

  if (bestConverter && bestConverter.offeringName !== bestOffering) {
    narrativeParts.push(
      `Best by conversion: "${bestConverter.offeringName}" (${bestConverter.conversionRate!.toFixed(1)}%).`,
    );
  }

  if (belowCount > 0) {
    narrativeParts.push(
      `${belowCount} offering${belowCount > 1 ? "s" : ""} underperforming — consider A/B testing alternatives.`,
    );
  }

  if (topCount > 1) {
    narrativeParts.push(
      `${topCount} top-performing offerings — analyze what makes them effective.`,
    );
  }

  return {
    offerings,
    bestOffering,
    narrative: narrativeParts.join(" "),
  };
}
