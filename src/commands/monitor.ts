// ========================================
// Monitor 排程指令
// 定時執行 analyze，比較前次結果，偵測異常並發警報
// 使用 SQLite（bun:sqlite）快取上一次分析結果
// ========================================

import { Database } from "bun:sqlite";
import chalk from "chalk";
import { runHealthCheck } from "../analysis/health-check.ts";
import { logger } from "../utils/logger.ts";
import { formatCurrency, formatPercent } from "../utils/formatting.ts";
import type {
  HealthReport,
  MonitorAlert,
  MonitorSnapshot,
  AlertChannel,
} from "../api/types.ts";
import { join } from "node:path";
import { homedir } from "node:os";

// ========================================
// 警報通道介面（Slack / Email placeholder）
// ========================================

/** 警報通道介面 — 所有通道實作此介面 */
interface AlertSender {
  send(alerts: MonitorAlert[]): Promise<void>;
}

/** Terminal 警報通道（已實作） */
class TerminalAlertSender implements AlertSender {
  async send(alerts: MonitorAlert[]): Promise<void> {
    if (alerts.length === 0) return;

    console.log("");
    console.log(chalk.bold.red(`  ${"=".repeat(50)}`));
    console.log(chalk.bold.red("  MONITOR ALERTS"));
    console.log(chalk.bold.red(`  ${"=".repeat(50)}`));
    console.log("");

    for (const alert of alerts) {
      const icon = alert.severity === "critical" ? "!!!" : alert.severity === "warning" ? "(!)" : "(i)";
      const severityColor =
        alert.severity === "critical"
          ? chalk.bgRed.white.bold
          : alert.severity === "warning"
            ? chalk.yellow.bold
            : chalk.cyan;

      console.log(`  ${severityColor(`${icon} [${alert.severity.toUpperCase()}]`)} ${chalk.white(alert.metric)}`);
      console.log(`     ${alert.message}`);
      console.log(
        `     ${chalk.gray(`Previous: ${alert.previousValue} → Current: ${alert.currentValue} (${alert.changePercent >= 0 ? "+" : ""}${alert.changePercent.toFixed(1)}%)`)}`,
      );
      console.log(`     ${chalk.gray(alert.triggeredAt)}`);
      console.log("");
    }

    // Promise resolved 以符合 interface
    await Promise.resolve();
  }
}

/** Slack 警報通道（Placeholder — 未實作） */
class SlackAlertSender implements AlertSender {
  async send(alerts: MonitorAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    // TODO: 實作 Slack Webhook 整合
    // 需要：SLACK_WEBHOOK_URL 環境變數
    // 格式：POST to webhook URL with { text: ..., blocks: [...] }
    logger.warn(`Slack alerts not yet implemented. ${alerts.length} alert(s) would be sent.`);
    await Promise.resolve();
  }
}

/** Email 警報通道（Placeholder — 未實作） */
class EmailAlertSender implements AlertSender {
  async send(alerts: MonitorAlert[]): Promise<void> {
    if (alerts.length === 0) return;
    // TODO: 實作 Email 整合
    // 需要：SMTP 設定或 SendGrid/SES API key
    // 格式：HTML 郵件 with alert summary
    logger.warn(`Email alerts not yet implemented. ${alerts.length} alert(s) would be sent.`);
    await Promise.resolve();
  }
}

/** 根據 channel 名稱建立對應的 AlertSender */
function createAlertSender(channel: AlertChannel): AlertSender {
  switch (channel) {
    case "slack":
      return new SlackAlertSender();
    case "email":
      return new EmailAlertSender();
    case "terminal":
    default:
      return new TerminalAlertSender();
  }
}

// ========================================
// SQLite 快取層
// ========================================

/** 初始化 SQLite 資料庫（存放在 ~/.rc-insights/monitor.db） */
function initDatabase(): Database {
  const dbDir = join(homedir(), ".rc-insights");
  // 確保目錄存在
  try {
    Bun.spawnSync(["mkdir", "-p", dbDir]);
  } catch {
    // 忽略
  }

  const dbPath = join(dbDir, "monitor.db");
  const db = new Database(dbPath);

  // 建立快照表
  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      mrr REAL NOT NULL DEFAULT 0,
      churn_rate REAL NOT NULL DEFAULT 0,
      quick_ratio REAL NOT NULL DEFAULT 0,
      anomaly_count INTEGER NOT NULL DEFAULT 0,
      report_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 建立索引
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_project_time
    ON snapshots (project_id, timestamp DESC)
  `);

  return db;
}

/** 儲存快照到 SQLite */
function saveSnapshot(db: Database, snapshot: MonitorSnapshot): void {
  const stmt = db.prepare(`
    INSERT INTO snapshots (project_id, timestamp, mrr, churn_rate, quick_ratio, anomaly_count, report_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    snapshot.projectId,
    snapshot.timestamp,
    snapshot.mrr,
    snapshot.churnRate,
    snapshot.quickRatio,
    snapshot.anomalyCount,
    snapshot.reportJson,
  );
}

/** 取得上一次的快照 */
function getLastSnapshot(db: Database, projectId: string): MonitorSnapshot | null {
  const row = db.query(`
    SELECT id, project_id, timestamp, mrr, churn_rate, quick_ratio, anomaly_count, report_json
    FROM snapshots
    WHERE project_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(projectId) as Record<string, unknown> | null;

  if (!row) return null;

  return {
    id: row["id"] as number,
    projectId: row["project_id"] as string,
    timestamp: row["timestamp"] as string,
    mrr: row["mrr"] as number,
    churnRate: row["churn_rate"] as number,
    quickRatio: row["quick_ratio"] as number,
    anomalyCount: row["anomaly_count"] as number,
    reportJson: row["report_json"] as string,
  };
}

// ========================================
// 比較邏輯 — 偵測顯著變化
// ========================================

/** 警報門檻設定 */
const ALERT_THRESHOLDS = {
  /** MRR 變動超過此百分比觸發警報 */
  mrrChangePercent: 5,
  /** Churn 升高超過此絕對值觸發警報 */
  churnIncreaseAbsolute: 1.0,
  /** Quick Ratio 跌破此值觸發警報 */
  quickRatioFloor: 1.0,
  /** 新異常數量門檻 */
  newAnomalyThreshold: 0,
};

/** 比較新舊快照，產生警報 */
function compareSnapshots(
  current: MonitorSnapshot,
  previous: MonitorSnapshot,
): MonitorAlert[] {
  const alerts: MonitorAlert[] = [];
  const now = new Date().toISOString();

  // 1. MRR 變動超過 5%
  if (previous.mrr > 0) {
    const mrrChange = ((current.mrr - previous.mrr) / previous.mrr) * 100;
    if (Math.abs(mrrChange) >= ALERT_THRESHOLDS.mrrChangePercent) {
      alerts.push({
        severity: Math.abs(mrrChange) >= 10 ? "critical" : "warning",
        metric: "MRR",
        message:
          mrrChange > 0
            ? `MRR increased ${mrrChange.toFixed(1)}% from ${formatCurrency(previous.mrr)} to ${formatCurrency(current.mrr)}`
            : `MRR decreased ${Math.abs(mrrChange).toFixed(1)}% from ${formatCurrency(previous.mrr)} to ${formatCurrency(current.mrr)}`,
        previousValue: previous.mrr,
        currentValue: current.mrr,
        changePercent: mrrChange,
        triggeredAt: now,
      });
    }
  }

  // 2. Churn 突然升高
  const churnIncrease = current.churnRate - previous.churnRate;
  if (churnIncrease >= ALERT_THRESHOLDS.churnIncreaseAbsolute) {
    alerts.push({
      severity: churnIncrease >= 2.0 ? "critical" : "warning",
      metric: "Churn Rate",
      message: `Churn rate increased from ${formatPercent(previous.churnRate)} to ${formatPercent(current.churnRate)} (+${churnIncrease.toFixed(1)}pp)`,
      previousValue: previous.churnRate,
      currentValue: current.churnRate,
      changePercent: previous.churnRate > 0 ? (churnIncrease / previous.churnRate) * 100 : 0,
      triggeredAt: now,
    });
  }

  // 3. Quick Ratio 跌破 1.0
  if (
    current.quickRatio < ALERT_THRESHOLDS.quickRatioFloor &&
    previous.quickRatio >= ALERT_THRESHOLDS.quickRatioFloor
  ) {
    alerts.push({
      severity: "critical",
      metric: "Quick Ratio",
      message: `Quick Ratio dropped below 1.0 (from ${previous.quickRatio.toFixed(2)} to ${current.quickRatio.toFixed(2)}). Revenue base is now contracting.`,
      previousValue: previous.quickRatio,
      currentValue: current.quickRatio,
      changePercent:
        previous.quickRatio > 0
          ? ((current.quickRatio - previous.quickRatio) / previous.quickRatio) * 100
          : 0,
      triggeredAt: now,
    });
  }

  // 4. 新異常出現
  if (current.anomalyCount > previous.anomalyCount) {
    const newAnomalies = current.anomalyCount - previous.anomalyCount;
    alerts.push({
      severity: newAnomalies >= 3 ? "warning" : "info",
      metric: "Anomalies",
      message: `${newAnomalies} new anomaly(ies) detected (total: ${current.anomalyCount}, was: ${previous.anomalyCount})`,
      previousValue: previous.anomalyCount,
      currentValue: current.anomalyCount,
      changePercent: previous.anomalyCount > 0 ? (newAnomalies / previous.anomalyCount) * 100 : 100,
      triggeredAt: now,
    });
  }

  return alerts;
}

// ========================================
// Interval 解析
// ========================================

/** 將 interval 字串（如 "6h", "30m", "1d"）解析為毫秒 */
export function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid interval format: "${interval}". Use format like "30m", "6h", "1d".`);
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;

  switch (unit) {
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown interval unit: "${unit}"`);
  }
}

/** 格式化毫秒為可讀文字 */
function formatIntervalMs(ms: number): string {
  if (ms >= 86_400_000) return `${(ms / 86_400_000).toFixed(0)} day(s)`;
  if (ms >= 3_600_000) return `${(ms / 3_600_000).toFixed(0)} hour(s)`;
  return `${(ms / 60_000).toFixed(0)} minute(s)`;
}

// ========================================
// 從 HealthReport 提取快照數據
// ========================================

function extractSnapshot(report: HealthReport): MonitorSnapshot {
  const mrrMetric = report.metrics.find((m) => m.metricId === "mrr");
  const churnMetric = report.metrics.find((m) => m.metricId === "churn");

  return {
    projectId: report.projectId,
    timestamp: report.generatedAt,
    mrr: mrrMetric?.value ?? 0,
    churnRate: churnMetric?.value ?? 0,
    quickRatio: report.quickRatio?.current ?? 0,
    anomalyCount: report.anomalies.length,
    reportJson: JSON.stringify(report),
  };
}

// ========================================
// Monitor 主要邏輯
// ========================================

export interface MonitorOptions {
  apiKey: string;
  projectId?: string;
  interval: string;
  alert: AlertChannel;
  verbose?: boolean;
}

/**
 * 執行一次分析 + 比較 + 警報
 * @returns 本次產生的警報列表
 */
async function runMonitorCycle(
  db: Database,
  apiKey: string,
  projectId: string | undefined,
  alertSender: AlertSender,
): Promise<MonitorAlert[]> {
  const cycleStart = new Date();
  console.log("");
  console.log(chalk.gray(`  [${cycleStart.toLocaleString()}] Starting monitor cycle...`));

  try {
    // 執行完整分析
    const report = await runHealthCheck(apiKey, projectId);
    const currentSnapshot = extractSnapshot(report);

    // 取得上一次快照
    const previousSnapshot = getLastSnapshot(db, report.projectId);

    // 儲存本次快照
    saveSnapshot(db, currentSnapshot);

    // 比較並產生警報
    let alerts: MonitorAlert[] = [];
    if (previousSnapshot) {
      alerts = compareSnapshots(currentSnapshot, previousSnapshot);
    } else {
      console.log(chalk.gray("  First run — no previous data to compare. Baseline saved."));
    }

    // 發送警報
    if (alerts.length > 0) {
      await alertSender.send(alerts);
    } else if (previousSnapshot) {
      console.log(chalk.green("  No significant changes detected. All metrics within thresholds."));
    }

    // 簡要摘要
    console.log("");
    console.log(chalk.gray("  --- Monitor Summary ---"));
    console.log(chalk.gray(`  MRR: ${formatCurrency(currentSnapshot.mrr)}`));
    console.log(chalk.gray(`  Churn: ${formatPercent(currentSnapshot.churnRate)}`));
    console.log(chalk.gray(`  Quick Ratio: ${currentSnapshot.quickRatio.toFixed(2)}`));
    console.log(chalk.gray(`  Anomalies: ${currentSnapshot.anomalyCount}`));
    console.log(chalk.gray(`  Alerts: ${alerts.length}`));

    const elapsed = ((Date.now() - cycleStart.getTime()) / 1000).toFixed(1);
    console.log(chalk.gray(`  Completed in ${elapsed}s`));

    return alerts;
  } catch (err) {
    console.error(chalk.red(`  Monitor cycle failed: ${err instanceof Error ? err.message : String(err)}`));
    return [];
  }
}

/**
 * 啟動 Monitor 排程
 * 主要入口 — 由 CLI 子指令呼叫
 */
export async function startMonitor(options: MonitorOptions): Promise<void> {
  const intervalMs = parseInterval(options.interval);
  const alertSender = createAlertSender(options.alert);

  console.log("");
  console.log(chalk.bold.cyan("  rc-insights monitor"));
  console.log(chalk.gray("  Continuous subscription health monitoring"));
  console.log("");
  console.log(chalk.gray(`  Interval:  ${formatIntervalMs(intervalMs)}`));
  console.log(chalk.gray(`  Alert:     ${options.alert}`));
  console.log(chalk.gray(`  DB:        ~/.rc-insights/monitor.db`));
  console.log("");

  // 初始化 DB
  const db = initDatabase();

  // 立即跑第一次
  await runMonitorCycle(db, options.apiKey, options.projectId, alertSender);

  // 設定定時排程
  console.log("");
  console.log(chalk.gray(`  Next check in ${formatIntervalMs(intervalMs)}. Press Ctrl+C to stop.`));

  const timer = setInterval(async () => {
    await runMonitorCycle(db, options.apiKey, options.projectId, alertSender);
    console.log("");
    console.log(chalk.gray(`  Next check in ${formatIntervalMs(intervalMs)}. Press Ctrl+C to stop.`));
  }, intervalMs);

  // Graceful shutdown：清理 timer + 關閉 DB
  process.on("SIGINT", () => {
    clearInterval(timer);
    db.close();
    console.log(chalk.gray("\n  Monitor stopped. Database closed."));
    process.exit(0);
  });

  // 保持進程運行
  await new Promise(() => {
    // 永遠不 resolve — 進程會一直跑直到 Ctrl+C
  });
}
