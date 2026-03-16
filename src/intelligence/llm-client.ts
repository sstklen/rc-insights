// ========================================
// LLM API 客戶端
// 支援 Gemini / Anthropic / OpenAI，自動 fallback
// Gemini 優先（便宜、快、多模態）
// ========================================

import { GoogleGenAI } from "@google/genai";

/** LLM 供應商設定 */
export interface LLMConfig {
  /** 供應商 */
  provider: 'gemini' | 'anthropic' | 'openai';
  /** API 金鑰 */
  apiKey: string;
  /** 模型名稱 */
  model: string;
  /** 最大 token 數 */
  maxTokens?: number;
  /** 請求逾時（毫秒），預設 30000 */
  timeout?: number;
}

/** LLM 回應結構 */
export interface LLMResponse {
  /** 回應內容 */
  content: string;
  /** 使用的供應商 */
  provider: string;
  /** 使用的模型 */
  model: string;
  /** 消耗的 token 數 */
  tokensUsed: number;
}

/** LLM 呼叫錯誤 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * LLM 客戶端
 * 依序嘗試每個 provider，第一個成功就回傳，全部失敗丟 error
 */
export class LLMClient {
  private configs: LLMConfig[];

  constructor(configs: LLMConfig[]) {
    if (configs.length === 0) {
      throw new Error('至少需要一個 LLM config');
    }
    this.configs = configs;
  }

  /**
   * 呼叫 LLM 生成回應
   * 依序嘗試每個 provider，第一個成功即回傳
   */
  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    const errors: LLMError[] = [];

    for (const config of this.configs) {
      try {
        let response: LLMResponse;
        switch (config.provider) {
          case 'gemini':
            response = await this.callGemini(config, systemPrompt, userPrompt);
            break;
          case 'anthropic':
            response = await this.callAnthropic(config, systemPrompt, userPrompt);
            break;
          case 'openai':
            response = await this.callOpenAI(config, systemPrompt, userPrompt);
            break;
        }
        return response;
      } catch (err) {
        const llmErr = err instanceof LLMError
          ? err
          : new LLMError(
              err instanceof Error ? err.message : String(err),
              config.provider,
            );
        errors.push(llmErr);
      }
    }

    // 全部失敗 → 丟出錯誤摘要
    const summary = errors
      .map((e) => `[${e.provider}] ${e.message}`)
      .join('; ');
    throw new LLMError(
      `All LLM providers failed: ${summary}`,
      'all',
    );
  }

  /**
   * 呼叫 Google Gemini API（使用官方 SDK）
   */
  private async callGemini(
    config: LLMConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    try {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });

      const response = await ai.models.generateContent({
        model: config.model || 'gemini-2.0-flash',
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: config.maxTokens || 4096,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text;
      if (!text) {
        throw new LLMError('Gemini 回應中無文字內容', 'gemini');
      }

      // Gemini SDK 的 usageMetadata
      const usage = response.usageMetadata;
      const tokensUsed = (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0);

      return {
        content: text,
        provider: 'gemini',
        model: config.model || 'gemini-2.0-flash',
        tokensUsed,
      };
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(
        `Gemini API error: ${err instanceof Error ? err.message : String(err)}`,
        'gemini',
      );
    }
  }

  /**
   * 呼叫 Anthropic Messages API
   */
  private async callAnthropic(
    config: LLMConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const timeout = config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-5-haiku-20241022',
          max_tokens: config.maxTokens || 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new LLMError(
          `Anthropic API returned ${res.status}: ${body}`,
          'anthropic',
          res.status,
        );
      }

      const data = await res.json() as {
        content: Array<{ type: string; text: string }>;
        model: string;
        usage: { input_tokens: number; output_tokens: number };
      };

      const textBlock = data.content.find((c) => c.type === 'text');
      if (!textBlock) {
        throw new LLMError('Anthropic response has no text content', 'anthropic');
      }

      return {
        content: textBlock.text,
        provider: 'anthropic',
        model: data.model,
        tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 呼叫 OpenAI Chat Completions API
   */
  private async callOpenAI(
    config: LLMConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResponse> {
    const timeout = config.timeout ?? 30_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          max_tokens: config.maxTokens || 2048,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new LLMError(
          `OpenAI API returned ${res.status}: ${body}`,
          'openai',
          res.status,
        );
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new LLMError('OpenAI response has no content', 'openai');
      }

      return {
        content,
        provider: 'openai',
        model: data.model,
        tokensUsed: data.usage?.total_tokens ?? 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * 從環境變數 / CLI 參數建構 LLM 設定
 * 優先順序：Gemini → Anthropic → OpenAI
 *
 * Gemini 優先的理由：
 *   1. 便宜（Flash 每百萬 token $0.075，比 Haiku 的 $0.25 便宜 3 倍）
 *   2. 快（Flash 延遲最低）
 *   3. JSON mode 原生支援
 *   4. 對 RevenueCat 面試加分（展示多 LLM 整合能力）
 */
export function buildLLMConfigs(options?: {
  llmKey?: string;
  llmModel?: string;
}): LLMConfig[] {
  const configs: LLMConfig[] = [];

  // 來源 1：CLI 參數 --llm-key（自動偵測 provider）
  if (options?.llmKey) {
    const key = options.llmKey;
    if (key.startsWith('AIza')) {
      // Google API key 格式
      configs.push({
        provider: 'gemini',
        apiKey: key,
        model: options.llmModel || 'gemini-2.0-flash',
      });
    } else if (key.startsWith('sk-ant-')) {
      configs.push({
        provider: 'anthropic',
        apiKey: key,
        model: options.llmModel || 'claude-3-5-haiku-20241022',
      });
    } else if (key.startsWith('sk-')) {
      configs.push({
        provider: 'openai',
        apiKey: key,
        model: options.llmModel || 'gpt-4o-mini',
      });
    }
  }

  // 來源 2：GEMINI_API_KEY 或 GOOGLE_API_KEY 環境變數（最優先）
  const geminiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'];
  if (geminiKey && !configs.some((c) => c.provider === 'gemini')) {
    configs.push({
      provider: 'gemini',
      apiKey: geminiKey,
      model: options?.llmModel || 'gemini-2.0-flash',
    });
  }

  // 來源 3：ANTHROPIC_API_KEY 環境變數
  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey && !configs.some((c) => c.provider === 'anthropic')) {
    configs.push({
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: options?.llmModel || 'claude-3-5-haiku-20241022',
    });
  }

  // 來源 4：OPENAI_API_KEY 環境變數
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey && !configs.some((c) => c.provider === 'openai')) {
    configs.push({
      provider: 'openai',
      apiKey: openaiKey,
      model: options?.llmModel || 'gpt-4o-mini',
    });
  }

  return configs;
}

/**
 * 建構 LLMClient（如果有可用的設定）
 * 沒有任何 API key → 回傳 null
 */
export function createLLMClient(options?: {
  llmKey?: string;
  llmModel?: string;
}): LLMClient | null {
  const configs = buildLLMConfigs(options);
  if (configs.length === 0) return null;
  return new LLMClient(configs);
}
