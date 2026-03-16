// ========================================
// 日誌工具 — 統一的終端輸出管理
// ========================================

import chalk from "chalk";

/** 日誌等級 */
type LogLevel = "debug" | "info" | "warn" | "error";

/** 目前啟用的日誌等級 */
let currentLevel: LogLevel = "info";

/** 日誌等級對應的數值權重 */
const levelWeight: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 設定日誌等級 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** 取得目前日誌等級 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

/** 檢查指定等級是否應該輸出 */
function shouldLog(level: LogLevel): boolean {
  return levelWeight[level] >= levelWeight[currentLevel];
}

/** 取得時間戳字串 */
function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/** 偵錯訊息 — 僅在 debug 等級時輸出 */
export function debug(message: string, ...args: unknown[]): void {
  if (!shouldLog("debug")) return;
  console.log(chalk.gray(`[${timestamp()}] DBG`), chalk.gray(message), ...args);
}

/** 一般資訊 */
export function info(message: string, ...args: unknown[]): void {
  if (!shouldLog("info")) return;
  console.log(chalk.blue(`[${timestamp()}] INF`), message, ...args);
}

/** 警告訊息 */
export function warn(message: string, ...args: unknown[]): void {
  if (!shouldLog("warn")) return;
  console.log(chalk.yellow(`[${timestamp()}] WRN`), chalk.yellow(message), ...args);
}

/** 錯誤訊息 */
export function error(message: string, ...args: unknown[]): void {
  if (!shouldLog("error")) return;
  console.error(chalk.red(`[${timestamp()}] ERR`), chalk.red(message), ...args);
}

/** 成功訊息 — 不受日誌等級限制，總是顯示 */
export function success(message: string, ...args: unknown[]): void {
  console.log(chalk.green("✓"), chalk.green(message), ...args);
}

/** 失敗訊息 — 不受日誌等級限制，總是顯示 */
export function fail(message: string, ...args: unknown[]): void {
  console.error(chalk.red("✗"), chalk.red(message), ...args);
}

/** 整合匯出 */
export const logger = {
  debug,
  info,
  warn,
  error,
  success,
  fail,
  setLevel: setLogLevel,
  getLevel: getLogLevel,
};
