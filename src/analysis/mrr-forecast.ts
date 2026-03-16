// ========================================
// MRR 六個月預測模組
// 基於歷史趨勢 + 季節性指數 + 三種情境
// ========================================

import type { ChartData } from "../api/types.ts";
import { formatCurrency } from "../utils/formatting.ts";

/** MRR 預測結果 */
export interface MRRForecastResult {
  /** 目前 MRR */
  currentMRR: number;
  /** 月平均淨成長率（例如 0.004 = 0.4%） */
  monthlyGrowthRate: number;
  /** 季節性指數（月份 1-12 → 係數） */
  seasonalityIndex: Record<number, number>;
  /** 每月預測值（三種情境） */
  predictions: Array<{
    /** 月份字串，例如 "2026-04" */
    month: string;
    /** 基準情境 */
    base: number;
    /** 樂觀情境 */
    optimistic: number;
    /** 悲觀情境 */
    pessimistic: number;
  }>;
  /** 十二個月展望 */
  twelveMonthOutlook: {
    base: number;
    optimistic: number;
    pessimistic: number;
  };
  /** 白話解釋 */
  narrative: string;
}

/**
 * 從圖表資料中提取月度數值
 * 過濾不完整期間，只取主要量度（measure=0）
 * 依時間排序返回 { month(1-12), year, value, cohort } 陣列
 */
function extractMonthlyValues(
  chartData: ChartData,
): Array<{ month: number; year: number; value: number; cohort: number }> {
  // 取 measure=0 的資料點（MRR/Revenue 的主量度）
  const values = chartData.values
    .filter((v) => !v.incomplete && v.measure === 0)
    .sort((a, b) => a.cohort - b.cohort);

  return values.map((v) => {
    const date = new Date(v.cohort * 1000);
    return {
      month: date.getMonth() + 1, // 1-12
      year: date.getFullYear(),
      value: v.value,
      cohort: v.cohort,
    };
  });
}

/**
 * 計算月平均淨成長率
 * 公式：(最近月 MRR - 最早月 MRR) / 最早月 MRR / 月數
 */
function calculateGrowthRate(monthlyValues: Array<{ value: number }>): number {
  if (monthlyValues.length < 2) return 0;

  const earliest = monthlyValues[0]!;
  const latest = monthlyValues[monthlyValues.length - 1]!;
  const months = monthlyValues.length - 1;

  if (earliest.value === 0 || months === 0) return 0;

  return (latest.value - earliest.value) / earliest.value / months;
}

/**
 * 計算每個月份的季節性係數
 * seasonality[month] = 該月歷史平均 / 全年平均
 * 如果數據不足（少於 6 個月），回傳全部 1.0（無季節性）
 */
function calculateSeasonality(
  revenueValues: Array<{ month: number; value: number }>,
): Record<number, number> {
  const index: Record<number, number> = {};

  // 預設所有月份係數 = 1.0
  for (let m = 1; m <= 12; m++) {
    index[m] = 1.0;
  }

  // 數據太少無法計算季節性
  if (revenueValues.length < 6) return index;

  // 計算全年平均
  const overallAvg =
    revenueValues.reduce((sum, v) => sum + v.value, 0) / revenueValues.length;

  if (overallAvg === 0) return index;

  // 計算每個月份的平均值
  const monthBuckets: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) {
    monthBuckets[m] = [];
  }

  for (const v of revenueValues) {
    monthBuckets[v.month]!.push(v.value);
  }

  for (let m = 1; m <= 12; m++) {
    const bucket = monthBuckets[m]!;
    if (bucket.length > 0) {
      const monthAvg = bucket.reduce((sum, val) => sum + val, 0) / bucket.length;
      index[m] = monthAvg / overallAvg;
    }
    // 沒有數據的月份保持 1.0
  }

  return index;
}

/**
 * 計算歷史數據的標準差（用於置信區間）
 */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * 產生月份字串，從目前月份往後推 N 個月
 * 返回 "YYYY-MM" 格式
 */
function futureMonth(monthsAhead: number): string {
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  const yyyy = future.getFullYear();
  const mm = String(future.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

/**
 * 取得未來第 N 個月的月份數字（1-12）
 */
function futureMonthNumber(monthsAhead: number): number {
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  return future.getMonth() + 1; // 1-12
}

/**
 * MRR 六個月預測
 *
 * @param mrrChartData - MRR 圖表資料（需 12 個月數據）
 * @param revenueChartData - Revenue 圖表資料（用來算季節性）
 * @param forecastMonths - 預測月數，預設 6
 * @returns MRR 預測結果
 */
export function forecastMRR(
  mrrChartData: ChartData,
  revenueChartData: ChartData,
  forecastMonths = 6,
): MRRForecastResult {
  // 提取歷史月度數據
  const mrrValues = extractMonthlyValues(mrrChartData);
  const revenueValues = extractMonthlyValues(revenueChartData);

  // A) 基礎趨勢：月平均淨成長率
  const growthRate = calculateGrowthRate(mrrValues);

  // B) 季節性指數
  const seasonalityIndex = calculateSeasonality(revenueValues);

  // 目前 MRR（最新月份的值）
  const currentMRR = mrrValues.length > 0 ? mrrValues[mrrValues.length - 1]!.value : 0;

  // 歷史月環比變化（用於標準差計算）
  const momChanges: number[] = [];
  for (let i = 1; i < mrrValues.length; i++) {
    const prev = mrrValues[i - 1]!;
    if (prev.value > 0) {
      momChanges.push((mrrValues[i]!.value - prev.value) / prev.value);
    }
  }
  const _stdDev = calculateStdDev(momChanges);

  // 三種情境的成長率調整
  const OPTIMISTIC_BOOST = 0.02; // +2% per month
  const PESSIMISTIC_DRAG = -0.02; // -2% per month

  // C) 預測公式：forecast[M] = current_MRR × (1 + rate)^months × seasonality[M]
  const predictions: MRRForecastResult["predictions"] = [];

  for (let ahead = 1; ahead <= forecastMonths; ahead++) {
    const monthStr = futureMonth(ahead);
    const monthNum = futureMonthNumber(ahead);
    const seasonality = seasonalityIndex[monthNum] ?? 1.0;

    const base = currentMRR * Math.pow(1 + growthRate, ahead) * seasonality;
    const optimistic =
      currentMRR * Math.pow(1 + growthRate + OPTIMISTIC_BOOST, ahead) * seasonality;
    const pessimistic =
      currentMRR * Math.pow(1 + growthRate + PESSIMISTIC_DRAG, ahead) * seasonality;

    predictions.push({
      month: monthStr,
      base: Math.round(base * 100) / 100,
      optimistic: Math.round(optimistic * 100) / 100,
      pessimistic: Math.round(pessimistic * 100) / 100,
    });
  }

  // D) 十二個月展望
  const month12Seasonality = seasonalityIndex[futureMonthNumber(12)] ?? 1.0;
  const twelveMonthOutlook = {
    base:
      Math.round(
        currentMRR * Math.pow(1 + growthRate, 12) * month12Seasonality * 100,
      ) / 100,
    optimistic:
      Math.round(
        currentMRR *
          Math.pow(1 + growthRate + OPTIMISTIC_BOOST, 12) *
          month12Seasonality *
          100,
      ) / 100,
    pessimistic:
      Math.round(
        currentMRR *
          Math.pow(1 + growthRate + PESSIMISTIC_DRAG, 12) *
          month12Seasonality *
          100,
      ) / 100,
  };

  // 產生白話解釋
  const growthPct = (growthRate * 100).toFixed(1);
  const direction = growthRate > 0 ? "growing" : growthRate < 0 ? "declining" : "flat";
  const sixMonthBase = predictions[predictions.length - 1]?.base ?? currentMRR;
  const sixMonthDelta = sixMonthBase - currentMRR;
  const deltaSign = sixMonthDelta >= 0 ? "+" : "";

  const narrative =
    `MRR is currently ${formatCurrency(currentMRR)} and ${direction} at ${growthPct}%/month. ` +
    `At this rate, MRR is projected to reach ${formatCurrency(sixMonthBase)} in ${forecastMonths} months ` +
    `(${deltaSign}${formatCurrency(sixMonthDelta)}). ` +
    `In an optimistic scenario (+2%/mo boost), it could reach ${formatCurrency(predictions[predictions.length - 1]?.optimistic ?? currentMRR)}. ` +
    `In a pessimistic scenario (-2%/mo drag), it may fall to ${formatCurrency(predictions[predictions.length - 1]?.pessimistic ?? currentMRR)}.`;

  return {
    currentMRR,
    monthlyGrowthRate: growthRate,
    seasonalityIndex,
    predictions,
    twelveMonthOutlook,
    narrative,
  };
}
