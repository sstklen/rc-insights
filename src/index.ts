#!/usr/bin/env bun
// ========================================
// rc-insights CLI 入口
// AI 驅動的訂閱健康報告產生器
// ========================================

import { Command } from "commander";
import chalk from "chalk";
import { runHealthCheck } from "./analysis/health-check.ts";
import { renderTerminalReport } from "./reports/terminal.ts";
import { renderMarkdownReport } from "./reports/markdown.ts";
import { renderHtmlReport } from "./reports/html.ts";
import { setLogLevel } from "./utils/logger.ts";
import { logger } from "./utils/logger.ts";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/** 版本號 */
const VERSION = "1.0.0";

/** 建立 CLI 程式 */
const program = new Command();

program
  .name("rc-insights")
  .description("AI-powered subscription health report generator for RevenueCat Charts API v2")
  .version(VERSION);

program
  .command("analyze")
  .description("Analyze your RevenueCat subscription metrics and generate a health report")
  .requiredOption("--api-key <key>", "RevenueCat v2 API key (Bearer token)")
  .option("--project-id <id>", "RevenueCat project ID (auto-detects if not specified)")
  .option("--format <format>", "Output format: terminal, html, md, all", "all")
  .option("--output <dir>", "Output directory for report files", "./rc-insights-report")
  .option("--verbose", "Enable verbose logging", false)
  .action(async (options) => {
    try {
      // 設定日誌等級
      if (options.verbose) {
        setLogLevel("debug");
      }

      // 驗證 API key 格式
      const apiKey = options.apiKey as string;
      if (!apiKey || apiKey.length < 10) {
        console.error(chalk.red("錯誤：API key 格式不正確。請提供有效的 RevenueCat v2 API key。"));
        console.error(chalk.gray("取得方式：RevenueCat Dashboard → Project Settings → API Keys → V2 Secret Key"));
        process.exit(1);
      }

      // 顯示開始訊息
      console.log("");
      console.log(chalk.bold.cyan("  rc-insights") + chalk.gray(` v${VERSION}`));
      console.log(chalk.gray("  AI-powered subscription health analysis"));
      console.log("");

      // 執行分析
      const report = await runHealthCheck(apiKey, options.projectId as string | undefined);

      // 決定輸出格式
      const format = (options.format as string).toLowerCase();
      const formats = format === "all" ? ["terminal", "html", "md"] : [format];

      // 終端機輸出（總是顯示，除非只要求檔案格式）
      if (formats.includes("terminal") || format === "all") {
        const terminalOutput = renderTerminalReport(report);
        console.log(terminalOutput);
      }

      // 檔案輸出
      const fileFormats = formats.filter((f) => f !== "terminal");
      if (fileFormats.length > 0 || format === "all") {
        const outputDir = resolve(options.output as string);
        await mkdir(outputDir, { recursive: true });

        const timestamp = new Date().toISOString().slice(0, 10);
        const safeProjectName = report.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        if (formats.includes("html") || format === "all") {
          const htmlContent = renderHtmlReport(report);
          const htmlPath = join(outputDir, `${safeProjectName}-health-report-${timestamp}.html`);
          await Bun.write(htmlPath, htmlContent);
          logger.success(`HTML 報告已儲存: ${htmlPath}`);
        }

        if (formats.includes("md") || format === "all") {
          const mdContent = renderMarkdownReport(report);
          const mdPath = join(outputDir, `${safeProjectName}-health-report-${timestamp}.md`);
          await Bun.write(mdPath, mdContent);
          logger.success(`Markdown 報告已儲存: ${mdPath}`);
        }

        // 同時儲存 JSON 原始資料（方便後續分析）
        const jsonPath = join(outputDir, `${safeProjectName}-health-data-${timestamp}.json`);
        await Bun.write(jsonPath, JSON.stringify(report, null, 2));
        logger.success(`JSON 資料已儲存: ${jsonPath}`);
      }

      console.log("");
      logger.success("分析完成！");
      console.log("");
    } catch (err) {
      console.error("");

      if (err instanceof Error) {
        // 根據錯誤類型給出明確指引
        if (err.message.includes("401") || err.message.includes("Unauthorized")) {
          console.error(chalk.red("認證失敗：API key 無效或已過期。"));
          console.error(chalk.gray("請確認你使用的是 V2 Secret API Key（不是 V1 或 Public Key）。"));
        } else if (err.message.includes("403") || err.message.includes("Forbidden")) {
          console.error(chalk.red("權限不足：此 API key 無法存取指定的專案。"));
        } else if (err.message.includes("404")) {
          console.error(chalk.red("找不到資源：專案 ID 可能不正確。"));
          console.error(chalk.gray("試試不指定 --project-id，讓工具自動偵測。"));
        } else if (err.message.includes("429")) {
          console.error(chalk.red("觸發速率限制：請稍後再試。"));
        } else if (err.message.includes("ENOTFOUND") || err.message.includes("fetch")) {
          console.error(chalk.red("網路錯誤：無法連線到 RevenueCat API。"));
          console.error(chalk.gray("請檢查網路連線。"));
        } else {
          console.error(chalk.red(`錯誤：${err.message}`));
        }

        if (process.env["DEBUG"]) {
          console.error(chalk.gray(err.stack ?? ""));
        }
      } else {
        console.error(chalk.red("未知錯誤："), err);
      }

      process.exit(1);
    }
  });

// 解析命令列參數
program.parse();
