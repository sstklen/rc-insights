// ========================================
// A2A Agent Card
// 遵循 A2A Protocol spec，在 /.well-known/agent.json 發布
// ========================================

/** A2A Skill 定義 */
export interface A2ASkill {
  id: string;
  name: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
}

/** A2A Agent Card 定義 */
export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  skills: A2ASkill[];
  defaultInputModes: string[];
  defaultOutputModes: string[];
}

/** Agent Card 靜態部分（url 在 runtime 動態設定） */
const AGENT_CARD_BASE: Omit<A2AAgentCard, "url"> = {
  name: "rc-insights",
  description:
    "AI-powered subscription health analyzer for RevenueCat apps. Diagnoses subscription metrics, predicts MRR, scores product-market fit, and generates autonomous action plans.",
  version: "1.0.0",
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  skills: [
    {
      id: "analyze-health",
      name: "Subscription Health Analysis",
      description:
        "Complete health check: 14 metrics, anomaly detection, benchmarks, Quick Ratio, PMF Score, MRR forecast, what-if scenarios, flywheel insights, and action plan",
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    },
    {
      id: "predict-mrr",
      name: "MRR Prediction",
      description:
        "6-month MRR forecast with base/optimistic/pessimistic scenarios and seasonality adjustment",
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    },
    {
      id: "score-pmf",
      name: "Product-Market Fit Scoring",
      description:
        "0-100 PMF score based on trial conversion, churn, quick ratio, revenue growth, and LTV",
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    },
    {
      id: "flywheel-insights",
      name: "Data Flywheel Insights",
      description:
        "4-layer insight engine: your data (free), peer benchmarks ($), category intelligence ($), market opportunities ($)",
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    },
    {
      id: "generate-actions",
      name: "Autonomous Action Plan",
      description:
        "Generate MCP-compatible action plan that can be executed by RevenueCat MCP Server",
      inputModes: ["application/json"],
      outputModes: ["application/json"],
    },
  ],
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
};

/**
 * 產生 Agent Card（帶動態 url）
 * @param port - HTTP server 監聽的 port
 */
export function buildAgentCard(port: number): A2AAgentCard {
  return {
    ...AGENT_CARD_BASE,
    url: `http://localhost:${port}`,
  };
}
