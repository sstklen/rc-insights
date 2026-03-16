// ========================================
// HTTP API Server
// 用 Bun.serve() 原生 HTTP server 提供 REST API
// 啟動方式：rc-insights serve --port 3100
// ========================================

import { runHealthCheck } from "../analysis/health-check.ts";
import { renderHtmlReport } from "../reports/html.ts";
import { renderMarkdownReport } from "../reports/markdown.ts";
import { setLocale, getLocale } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";
import type { HealthReport } from "../api/types.ts";
import { buildAgentCard } from "../a2a/agent-card.ts";
import { listTools, callTool } from "../a2a/webmcp.ts";
import type { MCPToolCallRequest } from "../a2a/webmcp.ts";

/** 版本號（與 index.ts 一致） */
const VERSION = "1.0.0";

/** 執行中的 server port（供 Agent Card 動態設定 url） */
let serverPort = 3100;

/** CORS headers — 所有回應都加上 */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** 回傳 JSON response */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

/** 回傳錯誤 JSON response */
function errorResponse(message: string, statusCode: number): Response {
  return jsonResponse({ error: message, statusCode }, statusCode);
}

/** 回傳 HTML response */
function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

/** 回傳 Markdown response */
function markdownResponse(md: string): Response {
  return new Response(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

/**
 * 從 request 取得 apiKey
 * POST: 從 JSON body 讀取
 * GET: 從 query string 的 api_key 讀取
 */
async function extractApiKey(req: Request, url: URL): Promise<string | null> {
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (typeof body.apiKey === "string" && body.apiKey.length > 0) {
        return body.apiKey;
      }
    } catch {
      // JSON parse 失敗
    }
    return null;
  }

  // GET: 從 query string
  return url.searchParams.get("api_key");
}

/**
 * 從 request 取得 POST body（已解析的 JSON）
 * GET 時回傳空物件
 */
async function extractBody(req: Request, url: URL): Promise<Record<string, unknown>> {
  if (req.method === "POST") {
    try {
      // body 可能已經被 extractApiKey 讀過了，
      // 所以用 clone() 的方式不可行。改為在呼叫端統一解析一次。
      return {};
    } catch {
      return {};
    }
  }
  // GET: 把 query string 轉成物件
  const obj: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams) {
    obj[key] = value;
  }
  return obj;
}

/** 解析 POST body 一次，同時提取 apiKey 和其他參數 */
async function parseRequest(
  req: Request,
  url: URL,
): Promise<{ apiKey: string | null; projectId?: string; lang?: string }> {
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      return {
        apiKey: typeof body.apiKey === "string" ? body.apiKey : null,
        projectId: typeof body.projectId === "string" ? body.projectId : undefined,
        lang: typeof body.lang === "string" ? body.lang : undefined,
      };
    } catch {
      return { apiKey: null };
    }
  }

  // GET: 從 query string
  return {
    apiKey: url.searchParams.get("api_key"),
    projectId: url.searchParams.get("project_id") ?? undefined,
    lang: url.searchParams.get("lang") ?? undefined,
  };
}

/**
 * 執行完整分析並回傳 HealthReport
 * 設定語系後呼叫 runHealthCheck
 */
async function runAnalysis(
  apiKey: string,
  projectId?: string,
  lang?: string,
): Promise<HealthReport> {
  // 設定語系（預設 en）— 保存/恢復以減少併發風險
  // 注意：這不是完全併發安全的（全域 mutable state），
  // 但 HTTP serve 是相對低併發場景，v1 可接受。
  // 完整修法需要 AsyncLocalStorage 或將 locale 參數化到 render 層。
  const prevLocale = getLocale();
  const locale = lang ?? "en";
  if (["en", "zh", "ja"].includes(locale)) {
    setLocale(locale as Locale);
  }

  try {
    return await runHealthCheck(apiKey, projectId);
  } finally {
    setLocale(prevLocale);
  }
}

/** 路由處理 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── GET /health ──
  if (path === "/health" && req.method === "GET") {
    return jsonResponse({ status: "ok", version: VERSION });
  }

  // ── POST /analyze 或 GET /analyze ──
  if (path === "/analyze" && (req.method === "POST" || req.method === "GET")) {
    const params = await parseRequest(req, url);

    if (!params.apiKey) {
      return errorResponse("Missing apiKey", 400);
    }

    try {
      const report = await runAnalysis(params.apiKey, params.projectId, params.lang);
      return jsonResponse(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = inferHttpStatus(message);
      return errorResponse(message, status);
    }
  }

  // ── POST /predict ──
  if (path === "/predict" && req.method === "POST") {
    const params = await parseRequest(req, url);

    if (!params.apiKey) {
      return errorResponse("Missing apiKey", 400);
    }

    try {
      const report = await runAnalysis(params.apiKey, params.projectId, params.lang);
      return jsonResponse({
        quickRatio: report.quickRatio ?? null,
        pmfScore: report.pmfScore ?? null,
        mrrForecast: report.mrrForecast ?? null,
        scenarios: report.scenarios ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = inferHttpStatus(message);
      return errorResponse(message, status);
    }
  }

  // ── POST /flywheel ──
  if (path === "/flywheel" && req.method === "POST") {
    const params = await parseRequest(req, url);

    if (!params.apiKey) {
      return errorResponse("Missing apiKey", 400);
    }

    try {
      const report = await runAnalysis(params.apiKey, params.projectId, params.lang);
      return jsonResponse(report.flywheel ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = inferHttpStatus(message);
      return errorResponse(message, status);
    }
  }

  // ── GET /report/html ──
  if (path === "/report/html" && req.method === "GET") {
    const params = await parseRequest(req, url);

    if (!params.apiKey) {
      return errorResponse("Missing api_key query parameter", 400);
    }

    try {
      const report = await runAnalysis(params.apiKey, params.projectId, params.lang);
      const html = renderHtmlReport(report);
      return htmlResponse(html);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = inferHttpStatus(message);
      return errorResponse(message, status);
    }
  }

  // ── GET /report/md ──
  if (path === "/report/md" && req.method === "GET") {
    const params = await parseRequest(req, url);

    if (!params.apiKey) {
      return errorResponse("Missing api_key query parameter", 400);
    }

    try {
      const report = await runAnalysis(params.apiKey, params.projectId, params.lang);
      const md = renderMarkdownReport(report);
      return markdownResponse(md);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const status = inferHttpStatus(message);
      return errorResponse(message, status);
    }
  }

  // ── GET /.well-known/agent.json — A2A Agent Card ──
  if (path === "/.well-known/agent.json" && req.method === "GET") {
    return jsonResponse(buildAgentCard(serverPort));
  }

  // ── POST /mcp/tools/list — WebMCP: 列出可用 tools ──
  if (path === "/mcp/tools/list" && req.method === "POST") {
    return jsonResponse(listTools());
  }

  // ── POST /mcp/tools/call — WebMCP: 呼叫特定 tool ──
  if (path === "/mcp/tools/call" && req.method === "POST") {
    try {
      const body = (await req.json()) as Record<string, unknown>;

      // 驗證 request 格式
      if (typeof body.name !== "string" || body.name.length === 0) {
        return errorResponse('Missing required field: "name" (tool name)', 400);
      }
      if (typeof body.arguments !== "object" || body.arguments === null || Array.isArray(body.arguments)) {
        return errorResponse('Missing or invalid field: "arguments" (must be an object)', 400);
      }

      const toolRequest: MCPToolCallRequest = {
        name: body.name,
        arguments: body.arguments as Record<string, unknown>,
      };

      const result = await callTool(toolRequest);

      // 如果 tool 回傳 isError，用 4xx/5xx status
      if (result.isError) {
        const text = result.content[0]?.text ?? "Unknown error";
        const status = text.includes("not found") ? 404 : 400;
        return jsonResponse(result, status);
      }

      return jsonResponse(result);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return errorResponse("Invalid JSON in request body", 400);
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return errorResponse(message, 500);
    }
  }

  // ── 404 ──
  return errorResponse("Not found", 404);
}

/**
 * 從錯誤訊息推斷 HTTP status code
 * 讓 RevenueCat API 的錯誤能正確透傳
 */
function inferHttpStatus(message: string): number {
  if (message.includes("401") || message.includes("Unauthorized")) return 401;
  if (message.includes("403") || message.includes("Forbidden")) return 403;
  if (message.includes("404")) return 404;
  if (message.includes("429")) return 429;
  return 500;
}

/** 啟動參數 */
export interface ServeOptions {
  port: number;
}

/**
 * 啟動 HTTP API Server
 */
export function startServer(options: ServeOptions): void {
  const { port } = options;

  // 設定 module-level port 供 Agent Card 使用
  serverPort = port;

  const server = Bun.serve({
    port,
    fetch: handleRequest,
  });

  console.log("");
  console.log(`  rc-insights API server v${VERSION}`);
  console.log(`  Listening on http://localhost:${server.port}`);
  console.log("");
  console.log("  Endpoints:");
  console.log("    GET  /health                       Health check");
  console.log("    POST /analyze                      Full analysis (JSON)");
  console.log("    GET  /analyze?api_key=...          Full analysis (JSON)");
  console.log("    POST /predict                      Crystal ball predictions");
  console.log("    POST /flywheel                     Flywheel analysis");
  console.log("    GET  /report/html?api_key=...      HTML report");
  console.log("    GET  /report/md?api_key=...        Markdown report");
  console.log("");
  console.log("  A2A / WebMCP:");
  console.log("    GET  /.well-known/agent.json       A2A Agent Card");
  console.log("    POST /mcp/tools/list               List available MCP tools");
  console.log("    POST /mcp/tools/call               Call an MCP tool");
  console.log("");
  console.log("  Press Ctrl+C to stop");
  console.log("");
}
