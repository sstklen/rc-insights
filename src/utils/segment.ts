// ========================================
// Segment 共用工具函數
// 從 keyword-analysis / offering-analysis 提取的重複邏輯
// ========================================

import type { ChartSegment } from "../api/types.ts";

/**
 * 加總 segment 中所有 values 的 value 欄位
 * 只取 measure=0（主要量度）且非 incomplete 的資料點
 */
export function sumSegmentValues(segment: ChartSegment): number {
  return segment.values
    .filter((v) => v.measure === 0 && !v.incomplete)
    .reduce((sum, v) => sum + v.value, 0);
}

/**
 * 計算 segment 中所有完整資料點的平均值
 * 用於轉換率等百分比指標
 */
export function avgSegmentValues(segment: ChartSegment): number | null {
  const complete = segment.values.filter((v) => v.measure === 0 && !v.incomplete);
  if (complete.length === 0) return null;
  const sum = complete.reduce((acc, v) => acc + v.value, 0);
  return sum / complete.length;
}

/**
 * 從 ChartData 的 segments 中提取有效的分段資料
 * 過濾掉 id 為空或在 filterSet 中的 segment（比對時忽略大小寫並去空白）
 * 回傳 Map<segment id, ChartSegment>
 */
export function extractValidSegments(
  segments: ChartSegment[] | null | undefined,
  filterSet: Set<string>,
): Map<string, ChartSegment> {
  const result = new Map<string, ChartSegment>();
  if (!segments) return result;

  for (const seg of segments) {
    // 跳過 id 為 undefined/null/空字串的 segment
    if (!seg.id) continue;
    if (!filterSet.has(seg.id.toLowerCase().trim())) {
      result.set(seg.id, seg);
    }
  }
  return result;
}
