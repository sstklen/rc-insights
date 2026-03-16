// ========================================
// MCP Server for rc-insights
// 讓 AI Agent 透過 MCP 協議呼叫訂閱分析能力
// ========================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { runHealthCheck } from "../analysis/health-check.ts";
import type { HealthReport } from "../api/types.ts";
import { setLocale } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";

/** 版本號（與 CLI 同步） */
const VERSION = "1.0.0";

// ========================================
// 報告快取（同一 API key 在單次 session 內不重複呼叫）
// ========================================

interface CachedReport {
  report: HealthReport;
  timestamp: number;
}

const reportCache = new Map<string, CachedReport>();

/** 快取有效時間：5 分鐘 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 快取上限筆數 */
const CACHE_MAX_SIZE = 20;

/**
 * 取得健康報告（含快取）
 * 所有 tool 共用，避免同一 session 重複打 RevenueCat API
 */
async function getReport(apiKey: string, projectId?: string): Promise<HealthReport> {
  const cacheKey = `${apiKey}:${projectId ?? "auto"}`;
  const cached = reportCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.report;
  }

  // 禁用 ora spinner — 在 MCP 啟動時一次性設定，而非每次呼叫都改
  // （避免併發競態：多個 request 同時改 process.env）
  // 注意：process.env.CI 在 startMCPServer() 中已設為 "true"

  try {
    const report = await runHealthCheck(apiKey, projectId);
    reportCache.set(cacheKey, { report, timestamp: Date.now() });

    // 超過上限時，刪除最舊的快取
    if (reportCache.size > CACHE_MAX_SIZE) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [key, entry] of reportCache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) reportCache.delete(oldestKey);
    }

    return report;
  } catch (err) {
    throw err;
  }
}

// ========================================
// 錯誤處理
// ========================================

/**
 * 把 Error 轉成 MCP 友善的 error response
 */
function formatError(err: unknown): { content: Array<{ type: "text"; text: string }> } {
  const message = err instanceof Error ? err.message : String(err);

  let errorCode = "UNKNOWN_ERROR";
  let hint = "";

  if (message.includes("401") || message.includes("Unauthorized")) {
    errorCode = "INVALID_API_KEY";
    hint = "Make sure you're using a RevenueCat V2 Secret API Key (not V1 or Public Key).";
  } else if (message.includes("403") || message.includes("Forbidden")) {
    errorCode = "PERMISSION_DENIED";
    hint = "This API key cannot access the specified project.";
  } else if (message.includes("404")) {
    errorCode = "PROJECT_NOT_FOUND";
    hint = "The project ID may be incorrect. Try omitting projectId to auto-detect.";
  } else if (message.includes("429")) {
    errorCode = "RATE_LIMITED";
    hint = "RevenueCat API rate limit hit. Please wait and try again.";
  } else if (message.includes("ENOTFOUND") || message.includes("fetch")) {
    errorCode = "NETWORK_ERROR";
    hint = "Unable to connect to the RevenueCat API. Check your network connection.";
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error: errorCode,
        message,
        hint,
      }),
    }],
  };
}

// ========================================
// Tool 輸入 Schema（Zod v3 格式，MCP SDK 需要）
// ========================================

const baseInputSchema = {
  apiKey: z.string().describe("RevenueCat v2 API key"),
  projectId: z.string().optional().describe("Project ID (optional, auto-detects if not specified)"),
};

const analyzeInputSchema = {
  ...baseInputSchema,
  lang: z.enum(["en", "zh", "ja"]).optional().describe("Report language (default: en)"),
};

// ========================================
// MCP Server 建立與啟動
// ========================================

export async function startMCPServer(): Promise<void> {
  const server = new McpServer({
    name: "rc-insights",
    version: VERSION,
  }, {
    capabilities: {
      tools: {},
    },
  });

  // MCP Server 生命週期內一次性禁用 ora spinner
  // （stdout 是 JSON-RPC 通道，spinner 輸出會污染協議）
  process.env["CI"] = "true";

  // ----------------------------------
  // Tool 1: 完整健康分析
  // ----------------------------------
  server.tool(
    "analyze_subscription_health",
    "Analyze a RevenueCat app's subscription health metrics, predict MRR, score PMF, and generate actionable recommendations",
    analyzeInputSchema,
    async (args) => {
      try {
        // 設定語系（如果有指定）
        if (args.lang) {
          setLocale(args.lang as Locale);
        }
        const report = await getReport(args.apiKey, args.projectId);

        const result = {
          projectName: report.projectName,
          projectId: report.projectId,
          generatedAt: report.generatedAt,
          healthGrade: report.executiveSummary?.healthGrade ?? "N/A",
          healthScore: report.executiveSummary?.healthScore ?? 0,
          executiveSummary: report.executiveSummary ?? null,
          metricsCount: report.metrics.length,
          metrics: report.metrics.map((m) => ({
            id: m.metricId,
            name: m.name,
            value: m.value,
            unit: m.unit,
            status: m.status,
            trend: m.trend,
            changePercent: m.changePercent,
            benchmark: m.benchmark,
          })),
          anomalies: report.anomalies,
          quickRatio: report.quickRatio ?? null,
          pmfScore: report.pmfScore ?? null,
          mrrForecast: report.mrrForecast ?? null,
          scenarios: report.scenarios ?? null,
          flywheel: report.flywheel ?? null,
          recommendations: report.recommendations,
          llmRecommendations: report.llmRecommendations ?? null,
          agentPlan: report.agentPlan ?? null,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 2: Quick Ratio 計算
  // ----------------------------------
  server.tool(
    "calculate_quick_ratio",
    "Calculate the Quick Ratio (revenue inflow/outflow) from MRR Movement data. Quick Ratio > 4 is excellent, < 1 means shrinking.",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        if (!report.quickRatio) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "INSUFFICIENT_DATA",
                message: "Quick Ratio could not be calculated. MRR Movement data may be unavailable.",
              }),
            }],
          };
        }

        const result = {
          projectName: report.projectName,
          quickRatio: report.quickRatio,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 3: PMF Score
  // ----------------------------------
  server.tool(
    "score_product_market_fit",
    "Calculate a 0-100 Product-Market Fit score based on 5 weighted factors: trial conversion, churn, quick ratio, revenue growth, LTV",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        if (!report.pmfScore) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "INSUFFICIENT_DATA",
                message: "PMF Score could not be calculated. Subscription metrics may be insufficient.",
              }),
            }],
          };
        }

        const result = {
          projectName: report.projectName,
          pmfScore: report.pmfScore,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 4: MRR 預測
  // ----------------------------------
  server.tool(
    "forecast_mrr",
    "Forecast MRR for the next 6 months with base/optimistic/pessimistic scenarios based on 12-month historical data",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        if (!report.mrrForecast) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "INSUFFICIENT_DATA",
                message: "MRR forecast could not be generated. At least 3 months of MRR history is required.",
              }),
            }],
          };
        }

        const result = {
          projectName: report.projectName,
          mrrForecast: report.mrrForecast,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 5: 飛輪洞見
  // ----------------------------------
  server.tool(
    "get_flywheel_insights",
    "Get 4-layer flywheel insights: your data metrics, peer comparison, category intelligence, and market opportunities",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        if (!report.flywheel) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "INSUFFICIENT_DATA",
                message: "Flywheel analysis could not be generated.",
              }),
            }],
          };
        }

        const result = {
          projectName: report.projectName,
          flywheel: report.flywheel,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 6: What-If 場景
  // ----------------------------------
  server.tool(
    "simulate_scenarios",
    "Run what-if scenarios: Fix Churn (halve churn rate), Scale Acquisition (double new MRR), Price Optimization (improve trial conversion)",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        if (!report.scenarios) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "INSUFFICIENT_DATA",
                message: "Scenario simulation could not be run. MRR and churn data are required.",
              }),
            }],
          };
        }

        const result = {
          projectName: report.projectName,
          scenarios: report.scenarios,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // Tool 7: 生成行動計畫
  // ----------------------------------
  server.tool(
    "generate_action_plan",
    "Generate an AI-powered action plan with MCP tool references (mcpTool + mcpParams) for autonomous execution by AI agents",
    baseInputSchema,
    async (args) => {
      try {
        const report = await getReport(args.apiKey, args.projectId);

        const result = {
          projectName: report.projectName,
          agentPlan: report.agentPlan ?? null,
          recommendations: report.llmRecommendations ?? report.recommendations.map((r) => ({
            priority: r.priority,
            title: r.title,
            description: r.description,
            relatedMetric: r.relatedMetric,
            source: "rule_engine",
          })),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    },
  );

  // ----------------------------------
  // 啟動 Server（Stdio Transport）
  // ----------------------------------
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
