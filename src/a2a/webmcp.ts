// ========================================
// WebMCP — HTTP-based MCP tool endpoints
// 讓 AI Agent 透過 HTTP 呼叫 MCP tools（不需 stdio transport）
// ========================================

import { runHealthCheck } from "../analysis/health-check.ts";
import type { HealthReport } from "../api/types.ts";

// ── Tool definitions（與 MCP server 的 tools 完全一致） ──

/** MCP Tool 定義 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/** MCP Tool Call 請求 */
export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/** MCP Tool Call 回應 */
export interface MCPToolCallResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** 所有可用 tools 的定義 */
const TOOLS: MCPToolDefinition[] = [
  {
    name: "analyze_subscription_health",
    description:
      "Run a complete subscription health analysis: 14 metrics, anomaly detection, benchmarks, Quick Ratio, PMF Score, MRR forecast, what-if scenarios, flywheel insights, and action plan.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "RevenueCat v2 API secret key (Bearer token)",
        },
        projectId: {
          type: "string",
          description: "RevenueCat project ID (optional, auto-detects if not specified)",
        },
      },
      required: ["apiKey"],
    },
  },
  {
    name: "predict_mrr",
    description:
      "6-month MRR forecast with base/optimistic/pessimistic scenarios and seasonality adjustment.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "RevenueCat v2 API secret key (Bearer token)",
        },
        projectId: {
          type: "string",
          description: "RevenueCat project ID (optional)",
        },
      },
      required: ["apiKey"],
    },
  },
  {
    name: "score_pmf",
    description:
      "Calculate a 0-100 Product-Market Fit score based on trial conversion, churn, quick ratio, revenue growth, and LTV.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "RevenueCat v2 API secret key (Bearer token)",
        },
        projectId: {
          type: "string",
          description: "RevenueCat project ID (optional)",
        },
      },
      required: ["apiKey"],
    },
  },
  {
    name: "get_flywheel_insights",
    description:
      "4-layer insight engine: your data (free), peer benchmarks ($), category intelligence ($), market opportunities ($).",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "RevenueCat v2 API secret key (Bearer token)",
        },
        projectId: {
          type: "string",
          description: "RevenueCat project ID (optional)",
        },
      },
      required: ["apiKey"],
    },
  },
  {
    name: "generate_action_plan",
    description:
      "Generate an MCP-compatible action plan that can be executed by RevenueCat MCP Server.",
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "RevenueCat v2 API secret key (Bearer token)",
        },
        projectId: {
          type: "string",
          description: "RevenueCat project ID (optional)",
        },
      },
      required: ["apiKey"],
    },
  },
];

/**
 * 列出所有可用 tools
 * 回傳格式與 MCP protocol 的 tools/list 一致
 */
export function listTools(): { tools: MCPToolDefinition[] } {
  return { tools: TOOLS };
}

/**
 * 呼叫特定 tool
 * 回傳格式與 MCP protocol 的 tools/call 一致
 */
export async function callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
  const { name, arguments: args } = request;

  // 驗證 tool 是否存在
  const toolDef = TOOLS.find((t) => t.name === name);
  if (!toolDef) {
    return {
      content: [{ type: "text", text: `Tool not found: "${name}". Use /mcp/tools/list to see available tools.` }],
      isError: true,
    };
  }

  // 驗證 required params
  const apiKey = args.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return {
      content: [{ type: "text", text: "Missing required parameter: apiKey" }],
      isError: true,
    };
  }

  const projectId = typeof args.projectId === "string" ? args.projectId : undefined;

  try {
    // 所有 tools 都先跑完整分析，再從 report 中抽取對應部分
    const report = await runHealthCheck(apiKey, projectId);
    const result = extractToolResult(name, report);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

/**
 * 從完整 HealthReport 中抽取特定 tool 的結果
 */
function extractToolResult(toolName: string, report: HealthReport): unknown {
  switch (toolName) {
    case "analyze_subscription_health":
      return report;

    case "predict_mrr":
      return {
        quickRatio: report.quickRatio ?? null,
        pmfScore: report.pmfScore ?? null,
        mrrForecast: report.mrrForecast ?? null,
        scenarios: report.scenarios ?? null,
      };

    case "score_pmf":
      return {
        pmfScore: report.pmfScore ?? null,
      };

    case "get_flywheel_insights":
      return report.flywheel ?? null;

    case "generate_action_plan":
      return report.agentPlan ?? null;

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
