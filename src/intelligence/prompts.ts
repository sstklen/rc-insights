// ========================================
// LLM Prompt 模板
// 所有與 LLM 溝通用的提示詞集中管理
// ========================================

// ---- 型別定義 ----

/** LLM 分析所需的上下文資料 */
export interface LLMAnalysisContext {
  /** App 名稱 */
  appName: string;
  /** App 類別（例如 "Health & Fitness", "Productivity"） */
  category: string;
  /** 目前的價格點（例如 ["$9.99/mo", "$49.99/yr"]） */
  pricePoints: string[];
  /** 各指標的摘要 */
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    status: string;
    benchmark?: number;
  }>;
  /** Quick Ratio 分析結果 */
  quickRatio?: { value: number; grade: string };
  /** PMF Score（如有） */
  pmfScore?: { score: number; grade: string };
  /** 異常偵測結果 */
  anomalies: Array<{
    metric: string;
    type: string;
    date: string;
    magnitude: number;
  }>;
  /** 關鍵字分佈（如有 attribution 資料） */
  keywords?: Array<{
    keyword: string;
    trials: number;
    revenue: number;
  }>;
  /** Offering 表現（如有） */
  offerings?: Array<{
    name: string;
    conversionRate: number;
    revenue: number;
  }>;
  /** MRR 預測（如有） */
  mrrForecast?: {
    currentMRR: number;
    projectedMRR6m: number;
    trend: string;
  };
}

// ---- System Prompt ----

/** 系統提示詞 — 定義 LLM 的角色和規則 */
export const SYSTEM_PROMPT = `You are a subscription app growth advisor analyzing RevenueCat metrics data.

Rules:
- Every recommendation must include specific, actionable steps
- Include expected quantitative impact (e.g., "+$200-400 MRR within 3 months")
- Include implementation timeline
- Base all advice on the provided data, never fabricate numbers
- Respond ONLY in valid JSON matching the requested schema
- Be concise and practical, not academic
- Reference industry benchmarks from SOSA 2026 (State of Subscription Apps) when relevant
- Consider the app's category and price points when making suggestions`;

// ---- Prompt 建構函式 ----

/**
 * 建構分析建議的 User Prompt
 * 把所有分析數據結構化成 prompt，要求 LLM 回傳 JSON 格式的建議
 */
export function buildAnalysisPrompt(context: LLMAnalysisContext): string {
  const metricsBlock = context.metrics
    .map((m) => {
      const benchmarkStr = m.benchmark != null ? ` (benchmark: ${m.benchmark}${m.unit})` : '';
      return `- ${m.name}: ${m.value}${m.unit} [${m.status}]${benchmarkStr}`;
    })
    .join('\n');

  const anomaliesBlock = context.anomalies.length > 0
    ? context.anomalies
        .map((a) => `- ${a.metric}: ${a.type} of ${a.magnitude.toFixed(1)}% on ${a.date}`)
        .join('\n')
    : 'No anomalies detected.';

  const quickRatioBlock = context.quickRatio
    ? `Quick Ratio: ${context.quickRatio.value} (${context.quickRatio.grade})`
    : 'Quick Ratio: not available';

  const forecastBlock = context.mrrForecast
    ? `MRR Forecast: current $${context.mrrForecast.currentMRR}, projected 6-month $${context.mrrForecast.projectedMRR6m} (${context.mrrForecast.trend})`
    : 'MRR Forecast: not available';

  const keywordsBlock = context.keywords && context.keywords.length > 0
    ? 'Top Keywords:\n' + context.keywords
        .slice(0, 10)
        .map((k) => `- "${k.keyword}": ${k.trials} trials, $${k.revenue} revenue`)
        .join('\n')
    : '';

  const offeringsBlock = context.offerings && context.offerings.length > 0
    ? 'Offerings Performance:\n' + context.offerings
        .map((o) => `- "${o.name}": ${o.conversionRate}% conversion, $${o.revenue} revenue`)
        .join('\n')
    : '';

  return `Analyze the following subscription app data and provide growth recommendations.

## App Info
- Name: ${context.appName}
- Category: ${context.category}
- Price Points: ${context.pricePoints.join(', ') || 'unknown'}

## Current Metrics
${metricsBlock}

## Health Indicators
${quickRatioBlock}
${forecastBlock}

## Anomalies
${anomaliesBlock}

${keywordsBlock}

${offeringsBlock}

## Required Output
Return a JSON object with this exact schema:
{
  "recommendations": [
    {
      "priority": 1,
      "title": "Short actionable title",
      "description": "Detailed explanation with data references",
      "actionSteps": ["Step 1", "Step 2", "Step 3"],
      "expectedImpact": "+$X-Y MRR within Z months",
      "timeToImplement": "X days/weeks",
      "confidence": "high|medium|low",
      "relatedMetric": "metric_name"
    }
  ]
}

Provide 3-5 recommendations, ordered by priority (1=highest). Focus on the biggest revenue opportunities first.`;
}

/**
 * 建構「下一個產品」建議的 Prompt
 * 三種思維方向：
 *   - 上下走（Vertical）：在同一價值鏈上深化
 *   - 左右走（Horizontal）：擴展到相鄰功能
 *   - 跳過去（Adjacent）：進入新市場
 */
export function buildNextProductPrompt(context: LLMAnalysisContext): string {
  const metricsBlock = context.metrics
    .map((m) => `- ${m.name}: ${m.value}${m.unit} [${m.status}]`)
    .join('\n');

  const keywordsBlock = context.keywords && context.keywords.length > 0
    ? 'User Search Keywords (from attribution):\n' + context.keywords
        .slice(0, 15)
        .map((k) => `- "${k.keyword}": ${k.trials} trials, $${k.revenue} revenue`)
        .join('\n')
    : 'No keyword data available.';

  return `Based on the following subscription app data, suggest the next product or feature this company should build.

## App Info
- Name: ${context.appName}
- Category: ${context.category}
- Price Points: ${context.pricePoints.join(', ') || 'unknown'}

## Current Metrics
${metricsBlock}

${keywordsBlock}

## Think in THREE directions:

1. **Vertical (Up/Down the Value Chain)**: Go deeper into what you already do. Premium tier, enterprise version, or a lighter free tier to widen the funnel.

2. **Horizontal (Expand Sideways)**: Add adjacent features that your current users would love. Look at what keywords bring users and what they might also need.

3. **Adjacent (Jump to New Market)**: Apply your tech/expertise to a different audience or market segment entirely.

## Required Output
Return a JSON object with this exact schema:
{
  "suggestions": [
    {
      "direction": "vertical|horizontal|adjacent",
      "directionLabel": "Up/Down the Value Chain | Expand Sideways | Jump to New Market",
      "title": "Product/feature name",
      "rationale": "Why this makes sense based on the data",
      "dataEvidence": ["Evidence point 1", "Evidence point 2"],
      "score": 4,
      "implementationComplexity": "low|medium|high"
    }
  ],
  "topPick": { ...same structure as above... },
  "ecosystemInsight": "RevenueCat's data from 115,000 apps shows that apps similar to yours that expanded into [X] grew 3x faster",
  "narrative": "2-3 sentence strategic summary"
}

Provide exactly 3 suggestions (one per direction). Score each 1-5 based on data evidence strength and market opportunity.`;
}

/**
 * 建構 Agent 行動計畫的 Prompt
 * 引用 MCP Server 的 tool 名稱，讓 Agent 知道可以做什麼
 */
export function buildAgentPlanPrompt(context: LLMAnalysisContext): string {
  const metricsBlock = context.metrics
    .map((m) => `- ${m.name}: ${m.value}${m.unit} [${m.status}]`)
    .join('\n');

  const anomaliesBlock = context.anomalies.length > 0
    ? context.anomalies
        .map((a) => `- ${a.metric}: ${a.type} of ${a.magnitude.toFixed(1)}% on ${a.date}`)
        .join('\n')
    : 'No anomalies detected.';

  return `You are an AI agent that can take actions via RevenueCat's MCP Server to optimize this subscription app.

## App Info
- Name: ${context.appName}
- Category: ${context.category}
- Price Points: ${context.pricePoints.join(', ') || 'unknown'}

## Current Metrics
${metricsBlock}

## Anomalies
${anomaliesBlock}

## Available MCP Tools
You can suggest actions using these RevenueCat MCP Server tools:
- **CreateOffering**: Create a new offering (subscription package bundle)
- **UpdateOffering**: Update an existing offering's metadata
- **ListOfferings**: List all current offerings
- **CreateProduct**: Create a new product (subscription tier)
- **UpdateProduct**: Update product configuration
- **CreateEntitlement**: Create an entitlement (feature access gate)
- **CreatePackage**: Create a package within an offering

## Required Output
Return a JSON object with this exact schema:
{
  "summary": "One paragraph explaining the overall strategy",
  "actions": [
    {
      "id": 1,
      "type": "offering|paywall|pricing|monitor|alert",
      "description": "What this action does and why",
      "mcpTool": "CreateOffering",
      "mcpParams": { "param1": "value1" },
      "expectedImpact": "+$X MRR or +Y% conversion",
      "priority": "immediate|this_week|this_month"
    }
  ],
  "estimatedMRRImpact": "+$X-Y MRR within Z months",
  "disclaimer": "These are AI-generated suggestions. Review before executing."
}

Provide 3-7 actions, ordered by priority. Only suggest actions that the available MCP tools can execute.`;
}
