// ========================================
// RevenueCat Charts API v2 客戶端
// 含速率限制（15 req/min）與錯誤處理
// ========================================

import type {
  ChartData,
  ChartName,
  ChartOptions,
  ChartQueryOptions,
  OverviewResponse,
  Project,
  ProjectsResponse,
} from "./types.ts";
import { logger } from "../utils/logger.ts";

/** API 基底網址 */
const BASE_URL = "https://api.revenuecat.com/v2";

/** 速率限制：每分鐘最多 15 次請求 */
const RATE_LIMIT_PER_MINUTE = 15;

/** 兩次請求之間的最小間隔（毫秒）= 60000 / 15 = 4000ms */
const MIN_INTERVAL_MS = Math.ceil(60_000 / RATE_LIMIT_PER_MINUTE);

/** API 錯誤類別 */
export class RevenueCatAPIError extends Error {
  constructor(
    public statusCode: number,
    public statusText: string,
    public body: string,
  ) {
    super(`RevenueCat API error [${statusCode}]: ${statusText}`);
    this.name = "RevenueCatAPIError";
  }
}

/** RevenueCat API v2 客戶端 */
export class RevenueCatClient {
  private apiKey: string;
  private lastRequestTime = 0;
  private requestCount = 0;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === "") {
      throw new Error("API key cannot be empty. Please provide your RevenueCat v2 API key via --api-key.");
    }
    this.apiKey = apiKey.trim();
  }

  /**
   * 速率限制等待 — 確保不超過 15 req/min
   * 如果距離上次請求不足間隔時間，自動等待
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - elapsed;
      logger.debug(`Rate limit: waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
    logger.debug(`API request #${this.requestCount}`);
  }

  /**
   * 發送 HTTP 請求到 RevenueCat API
   * 含速率限制、重試邏輯、錯誤處理
   */
  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    await this.rateLimit();

    let url = `${BASE_URL}${path}`;

    // 組合查詢參數
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    logger.debug(`GET ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    // 處理 429 Too Many Requests — 自動重試
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
      logger.warn(`Rate limited, retrying after ${waitSeconds} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      return this.request<T>(path, params);
    }

    // 處理其他錯誤
    if (!response.ok) {
      const body = await response.text();
      throw new RevenueCatAPIError(response.status, response.statusText, body);
    }

    const data = (await response.json()) as T;
    return data;
  }

  /**
   * 取得所有專案列表
   */
  async getProjects(): Promise<Project[]> {
    const response = await this.request<ProjectsResponse>("/projects");
    return response.items;
  }

  /**
   * 取得專案概覽指標
   * 包含 MRR、ARR、Active Subscribers 等即時指標
   */
  async getOverview(projectId: string): Promise<OverviewResponse> {
    return this.request<OverviewResponse>(`/projects/${projectId}/metrics/overview`);
  }

  /**
   * 取得指定圖表資料
   * @param projectId - 專案 ID
   * @param chartName - 圖表名稱（見 ChartName 型別）
   * @param options - 查詢選項（日期範圍、解析度）
   */
  async getChart(
    projectId: string,
    chartName: ChartName,
    options?: ChartQueryOptions,
  ): Promise<ChartData> {
    const params: Record<string, string> = {};

    if (options?.start_date) {
      params["start_date"] = options.start_date;
    }
    if (options?.end_date) {
      params["end_date"] = options.end_date;
    }
    if (options?.resolution) {
      params["resolution"] = options.resolution;
    }
    if (options?.segment) {
      params["segment"] = options.segment;
    }

    return this.request<ChartData>(`/projects/${projectId}/charts/${chartName}`, params);
  }

  /**
   * 取得圖表可用篩選選項
   */
  async getChartOptions(projectId: string, chartName: ChartName): Promise<ChartOptions> {
    return this.request<ChartOptions>(`/projects/${projectId}/charts/${chartName}/options`);
  }

  /**
   * 批次取得多個圖表資料
   * 自動處理速率限制，依序請求
   * @param projectId - 專案 ID
   * @param chartNames - 圖表名稱列表
   * @param options - 查詢選項
   * @returns Map<圖表名稱, 圖表資料>
   */
  async getCharts(
    projectId: string,
    chartNames: ChartName[],
    options?: ChartQueryOptions,
  ): Promise<Map<ChartName, ChartData>> {
    const results = new Map<ChartName, ChartData>();

    for (const name of chartNames) {
      try {
        const data = await this.getChart(projectId, name, options);
        results.set(name, data);
        logger.debug(`Chart fetched: ${name}`);
      } catch (err) {
        // 單一圖表失敗不影響其他圖表
        logger.warn(`Failed to fetch chart ${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return results;
  }

  /** 取得已發送的請求數量（用於除錯） */
  getRequestCount(): number {
    return this.requestCount;
  }
}
