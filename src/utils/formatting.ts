// ========================================
// 格式化工具 — 數字、貨幣、日期、百分比
// ========================================

/**
 * 格式化貨幣金額
 * 小於 1000 直接顯示，超過用 K/M 縮寫
 */
export function formatCurrency(value: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : currency;

  if (Math.abs(value) >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${symbol}${(value / 1_000).toFixed(1)}K`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${symbol}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `${symbol}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 格式化百分比
 * @param value - 原始值（0.35 代表 35%）如果 isRaw=true，否則直接就是百分比值
 * @param isRaw - 是否為原始比率（需乘以 100）
 */
export function formatPercent(value: number, isRaw = false): string {
  const pct = isRaw ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

/**
 * 格式化數字 — 帶千位分隔符
 */
export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/**
 * 格式化帶正負號的百分比變化
 */
export function formatChange(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * Unix 時間戳轉可讀日期
 */
export function formatDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Unix 時間戳轉 ISO 日期字串（YYYY-MM-DD）
 */
export function formatISODate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toISOString().slice(0, 10);
}

/**
 * 取得 N 天前的 ISO 日期字串
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * 取得今天的 ISO 日期字串
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 根據單位自動選擇格式化方式
 */
export function formatByUnit(value: number, unit: string): string {
  switch (unit) {
    case "$":
      return formatCurrency(value);
    case "%":
      return formatPercent(value);
    case "#":
      return formatNumber(value);
    default:
      return value.toLocaleString("en-US");
  }
}

/**
 * 將秒數轉為可讀時間（用於速率限制等待顯示）
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s`;
}

/**
 * 右對齊字串到指定寬度
 */
export function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/**
 * 左對齊字串到指定寬度
 */
export function padLeft(str: string, width: number): string {
  return str.padStart(width);
}
