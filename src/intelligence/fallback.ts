// ========================================
// Fallback 邏輯
// 當 LLM 不可用時，用規則引擎產生建議
// ========================================

import type { Recommendation } from "../api/types.ts";
import type { LLMAnalysisContext } from "./prompts.ts";

/** 增強版建議（同時支援 LLM 與規則引擎產出） */
export interface EnhancedRecommendation {
  /** 優先級（1 最高） */
  priority: number;
  /** 標題 */
  title: string;
  /** 詳細說明 */
  description: string;
  /** 具體執行步驟 */
  actionSteps: string[];
  /** 預期影響 */
  expectedImpact: string;
  /** 預估實施時間 */
  timeToImplement: string;
  /** 信心水準 */
  confidence: 'high' | 'medium' | 'low';
  /** 來源：LLM 生成或規則引擎 */
  source: 'llm' | 'rule_engine';
  /** 相關指標 */
  relatedMetric: string;
}

/**
 * 把現有規則引擎的 Recommendation 轉換成 EnhancedRecommendation 格式
 * 自動補上 actionSteps、expectedImpact、timeToImplement 等欄位
 */
export function convertToEnhanced(rec: Recommendation): EnhancedRecommendation {
  // 根據 impact 等級推算 actionSteps 和 expectedImpact
  const actionSteps = extractActionSteps(rec.description);
  const expectedImpact = estimateImpact(rec.impact, rec.relatedMetric);
  const timeToImplement = estimateTimeline(rec.impact);
  const confidence = mapConfidence(rec.impact);

  return {
    priority: rec.priority,
    title: rec.title,
    description: rec.description,
    actionSteps,
    expectedImpact,
    timeToImplement,
    confidence,
    source: 'rule_engine',
    relatedMetric: rec.relatedMetric,
  };
}

/**
 * 從建議描述中提取行動步驟
 * 規則引擎的建議描述通常以「(1)...,(2)...,(3)...」格式撰寫
 */
function extractActionSteps(description: string): string[] {
  // 嘗試從 (1)...(2)...(3)... 格式提取
  const numberedPattern = /\((\d+)\)\s*([^(]+?)(?=\(\d+\)|$)/g;
  const steps: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = numberedPattern.exec(description)) !== null) {
    const step = match[2]?.trim().replace(/[,.]$/, '');
    if (step) {
      steps.push(step);
    }
  }

  if (steps.length > 0) return steps;

  // 沒有編號格式 → 整段描述作為一個步驟
  return [description.replace(/\s+/g, ' ').trim()];
}

/**
 * 根據 impact 和指標類型推算預期影響
 */
function estimateImpact(impact: string, relatedMetric: string): string {
  const impactMap: Record<string, Record<string, string>> = {
    high: {
      trial_conversion_rate: '+10-20% trial conversion improvement, potentially +$500-2000 MRR within 3 months',
      churn: '-2-3% churn reduction, protecting $200-800 MRR per month',
      refund_rate: '-1-2% refund rate reduction, saving $100-500 per month',
      mrr: '+$500-2000 MRR growth within 3-6 months',
      default: 'Significant revenue impact expected within 1-3 months',
    },
    medium: {
      trial_conversion_rate: '+5-10% trial conversion improvement, +$200-500 MRR within 3 months',
      churn: '-1-2% churn reduction, protecting $100-400 MRR per month',
      mrr: '+$200-500 MRR growth within 3-6 months',
      default: 'Moderate revenue impact expected within 2-4 months',
    },
    low: {
      default: 'Incremental improvement; helps maintain current trajectory',
    },
  };

  const byImpact = impactMap[impact] ?? impactMap['low']!;
  return byImpact[relatedMetric] ?? byImpact['default']!;
}

/**
 * 根據 impact 推算實施時間
 */
function estimateTimeline(impact: string): string {
  switch (impact) {
    case 'high': return '1-2 weeks';
    case 'medium': return '2-4 weeks';
    case 'low': return '1-2 months';
    default: return '2-4 weeks';
  }
}

/**
 * 把 impact 映射到 confidence
 */
function mapConfidence(impact: string): 'high' | 'medium' | 'low' {
  // 規則引擎的建議基於確定的基準數據，所以 confidence 偏高
  switch (impact) {
    case 'high': return 'high';
    case 'medium': return 'medium';
    case 'low': return 'medium';
    default: return 'low';
  }
}

/**
 * 規則引擎版的「下一個產品」建議
 * 基於指標狀態和 keyword 資料推導基本建議
 */
export interface FallbackNextProductSuggestion {
  direction: 'vertical' | 'horizontal' | 'adjacent';
  directionLabel: string;
  title: string;
  rationale: string;
  dataEvidence: string[];
  score: number;
  implementationComplexity: 'low' | 'medium' | 'high';
}

/**
 * 當 LLM 不可用時，根據規則產生基本的「下一個產品」建議
 */
export function generateFallbackNextProduct(
  context: LLMAnalysisContext,
): FallbackNextProductSuggestion[] {
  const suggestions: FallbackNextProductSuggestion[] = [];

  // 分析指標狀態
  const mrrMetric = context.metrics.find((m) => m.name.toLowerCase().includes('mrr'));
  const churnMetric = context.metrics.find((m) => m.name.toLowerCase().includes('churn'));
  const conversionMetric = context.metrics.find((m) =>
    m.name.toLowerCase().includes('trial') || m.name.toLowerCase().includes('conversion'),
  );

  // 方向 1：Vertical — 根據轉換率和 MRR 判斷
  if (conversionMetric && conversionMetric.status === 'green') {
    suggestions.push({
      direction: 'vertical',
      directionLabel: 'Up/Down the Value Chain',
      title: 'Launch a Premium Tier',
      rationale:
        'Your trial conversion is strong, suggesting users see clear value. A premium tier with advanced features can capture high-willingness-to-pay users.',
      dataEvidence: [
        `Trial conversion at ${conversionMetric.value}${conversionMetric.unit} (${conversionMetric.status})`,
        mrrMetric ? `Current MRR: $${mrrMetric.value}` : 'MRR data not available',
      ],
      score: 4,
      implementationComplexity: 'medium',
    });
  } else {
    suggestions.push({
      direction: 'vertical',
      directionLabel: 'Up/Down the Value Chain',
      title: 'Introduce a Free Tier or Extended Trial',
      rationale:
        'Conversion needs improvement. A free tier or longer trial can widen the funnel, letting more users experience core value before committing.',
      dataEvidence: [
        conversionMetric
          ? `Trial conversion at ${conversionMetric.value}${conversionMetric.unit} (${conversionMetric.status})`
          : 'Conversion data not available',
        'SOSA 2026: 55% of 3-day trial cancellations happen on Day 0',
      ],
      score: 3,
      implementationComplexity: 'low',
    });
  }

  // 方向 2：Horizontal — 根據 keyword 資料推導
  if (context.keywords && context.keywords.length > 0) {
    const topKeywords = context.keywords.slice(0, 5);
    const keywordList = topKeywords.map((k) => `"${k.keyword}"`).join(', ');
    suggestions.push({
      direction: 'horizontal',
      directionLabel: 'Expand Sideways',
      title: `Add Features Aligned with Top Keywords`,
      rationale:
        `Users are finding you through ${keywordList}. Building features directly matching these search intents can improve conversion and retention.`,
      dataEvidence: topKeywords.map(
        (k) => `"${k.keyword}": ${k.trials} trials, $${k.revenue} revenue`,
      ),
      score: 3,
      implementationComplexity: 'medium',
    });
  } else {
    suggestions.push({
      direction: 'horizontal',
      directionLabel: 'Expand Sideways',
      title: 'Add Complementary Utility Features',
      rationale:
        'Without keyword data, a safe horizontal play is adding features that complement your core offering — widgets, integrations, or export capabilities.',
      dataEvidence: [
        `Category: ${context.category}`,
        'General pattern: complementary features reduce churn by giving users more reasons to stay',
      ],
      score: 2,
      implementationComplexity: 'medium',
    });
  }

  // 方向 3：Adjacent — 根據 MRR 和流失率推導
  const churnIsLow = churnMetric && churnMetric.status === 'green';
  const mrrIsHealthy = mrrMetric && mrrMetric.status !== 'red';

  if (churnIsLow && mrrIsHealthy) {
    suggestions.push({
      direction: 'adjacent',
      directionLabel: 'Jump to New Market',
      title: 'Launch a B2B / Team Plan',
      rationale:
        'With healthy retention and revenue, you have a stable base to explore B2B. Team/enterprise plans often have 3-5x higher ARPU.',
      dataEvidence: [
        churnMetric ? `Churn rate: ${churnMetric.value}${churnMetric.unit} (healthy)` : '',
        mrrMetric ? `MRR: $${mrrMetric.value}` : '',
        'Industry: B2B plans typically have 3-5x higher ARPU than consumer',
      ].filter(Boolean),
      score: 3,
      implementationComplexity: 'high',
    });
  } else {
    suggestions.push({
      direction: 'adjacent',
      directionLabel: 'Jump to New Market',
      title: 'Create a Lite Version for Emerging Markets',
      rationale:
        'Before jumping to a new market, consider a localized lite version. Lower price points in emerging markets can add volume without cannibalizing existing revenue.',
      dataEvidence: [
        `Category: ${context.category}`,
        'SOSA 2026: Emerging market apps see 2-3x trial volume with localized pricing',
      ],
      score: 2,
      implementationComplexity: 'medium',
    });
  }

  return suggestions;
}
