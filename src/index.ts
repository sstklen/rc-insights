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
import { setLocale } from "./i18n/index.ts";
import type { Locale } from "./i18n/index.ts";
import { startMonitor } from "./commands/monitor.ts";
import { startServer } from "./commands/serve.ts";
import type { AlertChannel } from "./api/types.ts";
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
  .option("--llm-key <key>", "Anthropic or OpenAI API key for AI-powered insights (optional)")
  .option("--llm-model <model>", "LLM model to use (default: claude-3-5-haiku-20241022 or gpt-4o-mini)")
  .option("--lang <lang>", "Report language: en, zh, ja", "en")
  .option("--verbose", "Enable verbose logging", false)
  .action(async (options) => {
    try {
      // 設定日誌等級
      if (options.verbose) {
        setLogLevel("debug");
      }

      // 設定報告語系
      const lang = options.lang as string;
      if (!["en", "zh", "ja"].includes(lang)) {
        console.error(chalk.red(`Error: Unsupported language "${lang}". Use: en, zh, ja`));
        process.exit(1);
      }
      setLocale(lang as Locale);

      // 驗證 API key 格式
      const apiKey = options.apiKey as string;
      if (!apiKey || apiKey.length < 10) {
        console.error(chalk.red("Error: Invalid API key format. Please provide a valid RevenueCat v2 API key."));
        console.error(chalk.gray("How to get one: RevenueCat Dashboard → Project Settings → API Keys → V2 Secret Key"));
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
          logger.success(`HTML report saved: ${htmlPath}`);
        }

        if (formats.includes("md") || format === "all") {
          const mdContent = renderMarkdownReport(report);
          const mdPath = join(outputDir, `${safeProjectName}-health-report-${timestamp}.md`);
          await Bun.write(mdPath, mdContent);
          logger.success(`Markdown report saved: ${mdPath}`);
        }

        // 同時儲存 JSON 原始資料（方便後續分析）
        const jsonPath = join(outputDir, `${safeProjectName}-health-data-${timestamp}.json`);
        await Bun.write(jsonPath, JSON.stringify(report, null, 2));
        logger.success(`JSON data saved: ${jsonPath}`);
      }

      console.log("");
      logger.success("Analysis complete!");
      console.log("");
    } catch (err) {
      console.error("");

      if (err instanceof Error) {
        // 根據錯誤類型給出明確指引
        if (err.message.includes("401") || err.message.includes("Unauthorized")) {
          console.error(chalk.red("Authentication failed: API key is invalid or expired."));
          console.error(chalk.gray("Make sure you're using a V2 Secret API Key (not V1 or Public Key)."));
        } else if (err.message.includes("403") || err.message.includes("Forbidden")) {
          console.error(chalk.red("Permission denied: This API key cannot access the specified project."));
        } else if (err.message.includes("404")) {
          console.error(chalk.red("Resource not found: The project ID may be incorrect."));
          console.error(chalk.gray("Try omitting --project-id to let the tool auto-detect."));
        } else if (err.message.includes("429")) {
          console.error(chalk.red("Rate limited: Please wait and try again."));
        } else if (err.message.includes("ENOTFOUND") || err.message.includes("fetch")) {
          console.error(chalk.red("Network error: Unable to connect to the RevenueCat API."));
          console.error(chalk.gray("Please check your network connection."));
        } else {
          console.error(chalk.red(`Error: ${err.message}`));
        }

        if (process.env["DEBUG"]) {
          console.error(chalk.gray(err.stack ?? ""));
        }
      } else {
        console.error(chalk.red("Unknown error:"), err);
      }

      process.exit(1);
    }
  });

program
  .command("monitor")
  .description("Continuously monitor subscription metrics and alert on significant changes")
  .requiredOption("--api-key <key>", "RevenueCat v2 API key (Bearer token)")
  .option("--project-id <id>", "RevenueCat project ID (auto-detects if not specified)")
  .option("--interval <interval>", "Check interval (e.g. 30m, 6h, 1d)", "6h")
  .option("--alert <channel>", "Alert channel: terminal, slack, email", "terminal")
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
        console.error(chalk.red("Error: Invalid API key format. Please provide a valid RevenueCat v2 API key."));
        process.exit(1);
      }

      // 驗證 alert channel
      const alertChannel = options.alert as string;
      if (!["terminal", "slack", "email"].includes(alertChannel)) {
        console.error(chalk.red(`Error: Unknown alert channel "${alertChannel}". Use: terminal, slack, email`));
        process.exit(1);
      }

      await startMonitor({
        apiKey,
        projectId: options.projectId as string | undefined,
        interval: options.interval as string,
        alert: alertChannel as AlertChannel,
        verbose: options.verbose as boolean,
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error(chalk.red(`Error: ${err.message}`));
      } else {
        console.error(chalk.red("Unknown error:"), err);
      }
      process.exit(1);
    }
  });

program
  .command("serve")
  .alias("api")
  .description("Start HTTP API server")
  .option("--port <port>", "Server port", "3100")
  .action((options) => {
    const port = parseInt(options.port as string, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error(chalk.red(`Error: Invalid port "${options.port}". Must be 1-65535.`));
      process.exit(1);
    }
    startServer({ port });
  });

program
  .command("mcp")
  .description("Start as MCP Server (for AI agent integration)")
  .action(async () => {
    const { startMCPServer } = await import("./mcp/server.ts");
    await startMCPServer();
  });

// 解析命令列參數
program.parse();
