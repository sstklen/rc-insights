// ========================================
// 統計工具函數 — 線性映射、加權平均、移動平均等
// ========================================

/**
 * 線性插值映射
 * 將 value 從 [minIn, maxIn] 範圍映射到 [minOut, maxOut]
 * 結果不自動裁剪，需要的話請搭配 clamp 使用
 */
export function linearInterpolate(
  value: number,
  minIn: number,
  maxIn: number,
  minOut: number,
  maxOut: number,
): number {
  if (maxIn === minIn) return (minOut + maxOut) / 2;
  return minOut + ((value - minIn) / (maxIn - minIn)) * (maxOut - minOut);
}

/**
 * 數值裁剪 — 限制在 [min, max] 範圍內
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 加權平均
 * values 與 weights 長度必須相同
 */
export function weightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0 || values.length !== weights.length) return 0;

  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]! * weights[i]!;
    weightSum += weights[i]!;
  }

  return weightSum === 0 ? 0 : sum / weightSum;
}

/**
 * 移動平均
 * 回傳與原陣列等長的陣列，前 window-1 個元素用可用資料計算
 */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0) return [];
  if (window <= 0) return [...values];

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    // 從 max(0, i - window + 1) 到 i 的平均
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) {
      sum += values[j]!;
    }
    result.push(sum / (i - start + 1));
  }

  return result;
}

/**
 * 標準差（母體標準差）
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * 簡單線性回歸斜率
 * 將 values 視為等距時間序列（x=0,1,2,...），回傳每期變化量
 * 正值代表上升趨勢，負值代表下降趨勢
 */
export function trendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  // 最小二乘法：slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}
