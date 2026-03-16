// ========================================
// Quick Ratio 計算模組
// Quick Ratio = (New MRR + Resubscription MRR + Expansion MRR)
//             / (Churned MRR + Contraction MRR)
// 從 MRR Movement 圖表數據計算
// ========================================

import type { ChartData } from "../api/types.ts";
import { trendSlope } from "../utils/math.ts";

/** Quick Ratio 分析結果 */
export interface QuickRatioResult {
  /** 最新完整月份的 Quick Ratio */
  current: number;
  /** 近 3 個完整月平均 */
  average3m: number;
  /** 近 12 個完整月平均（資料不足時為 NaN） */
  average12m: number;
  /** 趨勢方向 */
  trend: 'growing' | 'stable' | 'declining';
  /** 健康等級 */
  grade: 'excellent' | 'healthy' | 'concerning' | 'leaking';
  /** 白話解釋 */
  interpretation: string;
  /** 時間序列資料 */
  timeSeries: Array<{
    date: string;
    ratio: number;
    inflow: number;
    outflow: number;
  }>;
}

/**
 * 多量度時間序列整合結構
 * 把同一 cohort 時間點下各 measure 的值對齊在同一列
 */
interface MultiMeasureRow {
  /** ISO 日期字串 */
  date: string;
  /** Unix 時間戳 */
  cohort: number;
  /** 是否為不完整期間 */
  incomplete: boolean;
  /** 各 measure 的值，key 為 measure index */
  values: Record<number, number>;
}

/**
 * 將多 measure 的 ChartData.values 按 cohort 整合成一張表
 * 每個 cohort 時間點一行，各 measure 值並列
 */
export function getMultiMeasureTimeSeries(chartData: ChartData): MultiMeasureRow[] {
  const rowMap = new Map<number, MultiMeasureRow>();

  for (const v of chartData.values) {
    let row = rowMap.get(v.cohort);
    if (!row) {
      const dateStr = new Date(v.cohort * 1000).toISOString().slice(0, 10);
      row = {
        date: dateStr,
        cohort: v.cohort,
        incomplete: v.incomplete,
        values: {},
      };
      rowMap.set(v.cohort, row);
    }
    // 如果任一 measure 標記 incomplete，整列都標記
    if (v.incomplete) row.incomplete = true;
    row.values[v.measure] = v.value;
  }

  // 按時間排序
  return Array.from(rowMap.values()).sort((a, b) => a.cohort - b.cohort);
}

/**
 * 計算 Quick Ratio
 *
 * MRR Movement 各 measure 對應：
 *   0: New MRR ($)
 *   1: Resubscription MRR ($)
 *   2: Expansion MRR ($)
 *   3: Churned MRR ($) — 正數，代表流失金額
 *   4: Contraction MRR ($)
 *   5: Movement ($) — 淨變動
 *
 * @param mrrMovementChart - mrr_movement 圖表的原始資料
 */
export function calculateQuickRatio(mrrMovementChart: ChartData): QuickRatioResult {
  const rows = getMultiMeasureTimeSeries(mrrMovementChart);

  // 只取完整月份
  const completeRows = rows.filter((r) => !r.incomplete);

  // 計算每月的 Quick Ratio
  const timeSeries = completeRows.map((row) => {
    const newMrr = row.values[0] ?? 0;
    const resubMrr = row.values[1] ?? 0;
    const expansionMrr = row.values[2] ?? 0;
    const churnedMrr = row.values[3] ?? 0;
    const contractionMrr = row.values[4] ?? 0;

    const inflow = newMrr + resubMrr + expansionMrr;
    const outflow = churnedMrr + contractionMrr;

    // 分母為零時 Quick Ratio 為 Infinity（無流失 = 完美）
    // 但實務上我們用一個很大的值替代，方便後續計算
    const ratio = outflow === 0 ? (inflow > 0 ? 999 : 0) : inflow / outflow;

    return {
      date: row.date,
      ratio: Math.round(ratio * 100) / 100,
      inflow: Math.round(inflow * 100) / 100,
      outflow: Math.round(outflow * 100) / 100,
    };
  });

  // 取各期間平均值
  const current = timeSeries.length > 0
    ? timeSeries[timeSeries.length - 1]!.ratio
    : 0;

  const recent3 = timeSeries.slice(-3);
  const average3m = recent3.length > 0
    ? recent3.reduce((sum, r) => sum + r.ratio, 0) / recent3.length
    : 0;

  const recent12 = timeSeries.slice(-12);
  const average12m = recent12.length >= 12
    ? recent12.reduce((sum, r) => sum + r.ratio, 0) / recent12.length
    : NaN;

  // 趨勢判定 — 用最近資料點的線性回歸斜率
  const ratioValues = timeSeries.map((r) => r.ratio);
  const slope = trendSlope(ratioValues);
  let trend: 'growing' | 'stable' | 'declining';
  if (slope > 0.1) {
    trend = 'growing';
  } else if (slope < -0.1) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  // 分級 — 基於最新值
  const grade = gradeQuickRatio(current);

  // 白話解釋
  const interpretation = buildInterpretation(current, grade);

  return {
    current: Math.round(current * 100) / 100,
    average3m: Math.round(average3m * 100) / 100,
    average12m: isNaN(average12m) ? NaN : Math.round(average12m * 100) / 100,
    trend,
    grade,
    interpretation,
    timeSeries,
  };
}

/**
 * 根據 Quick Ratio 值評定等級
 */
function gradeQuickRatio(ratio: number): QuickRatioResult['grade'] {
  // 特殊區間：接近 1.0（0.95 ~ 1.05）仍歸為 concerning，但 interpretation 會特別標記
  if (ratio > 4.0) return 'excellent';
  if (ratio >= 2.0) return 'healthy';
  if (ratio >= 1.0) return 'concerning';
  return 'leaking';
}

/**
 * 產生白話解釋
 */
function buildInterpretation(ratio: number, grade: QuickRatioResult['grade']): string {
  // 特殊情況：剛好踩在 1.0 附近
  if (ratio >= 0.95 && ratio <= 1.05) {
    return "Treading water — perfectly replacing losses but not growing";
  }

  switch (grade) {
    case 'excellent':
      return "Hyper-growth: revenue inflow far exceeds losses";
    case 'healthy':
      return "Strong growth efficiency";
    case 'concerning':
      return "Growing, but barely outpacing losses";
    case 'leaking':
      return "Losing more than gaining — business is shrinking";
  }
}
