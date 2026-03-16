// ========================================
// PMF Score 計算模組
// 綜合 5 個指標算出 0-100 分的 Product-Market Fit 評分
// ========================================

import { linearInterpolate, clamp, weightedAverage } from "../utils/math.ts";

/** PMF Score 分析結果 */
export interface PMFScoreResult {
  /** 總分 0-100 */
  score: number;
  /** 等級 */
  grade: 'Strong PMF' | 'Approaching PMF' | 'Pre-PMF' | 'No PMF Signal';
  /** 各項因子明細 */
  breakdown: Array<{
    factor: string;
    rawValue: number;
    score: number;
    weight: number;
    weighted: number;
    explanation: string;
  }>;
  /** 一段式總結 */
  diagnosis: string;
  /** 決策建議 */
  decisionAdvice: {
    verdict: '🚀 Double Down' | '🔧 Optimize' | '🔄 Pivot' | '🚪 Harvest & Explore';
    reasoning: string;
    topActions: string[];
  };
}

/**
 * 各指標的映射參數
 * direction: 'higher' = 越高越好，'lower' = 越低越好
 */
interface FactorConfig {
  name: string;
  weight: number;
  min0: number;      // 對應 0 分的輸入值
  max100: number;    // 對應 100 分的輸入值
  direction: 'higher' | 'lower';
  unit: string;
}

/** 五大因子設定 */
const FACTORS: FactorConfig[] = [
  {
    name: 'Trial Conversion Rate',
    weight: 0.25,
    min0: 10,        // ≤10% → 0 分
    max100: 60,      // ≥60% → 100 分
    direction: 'higher',
    unit: '%',
  },
  {
    name: 'Monthly Churn Rate',
    weight: 0.25,
    min0: 15,        // ≥15% → 0 分（越低越好，所以反轉）
    max100: 2,       // ≤2% → 100 分
    direction: 'lower',
    unit: '%',
  },
  {
    name: 'Quick Ratio',
    weight: 0.20,
    min0: 0.5,       // ≤0.5 → 0 分
    max100: 4.0,     // ≥4.0 → 100 分
    direction: 'higher',
    unit: 'x',
  },
  {
    name: 'Revenue Growth (3m MoM)',
    weight: 0.15,
    min0: -10,       // ≤-10% → 0 分
    max100: 10,      // ≥10% → 100 分
    direction: 'higher',
    unit: '%',
  },
  {
    name: 'LTV per Paying Customer',
    weight: 0.15,
    min0: 5,         // ≤$5 → 0 分
    max100: 60,      // ≥$60 → 100 分
    direction: 'higher',
    unit: '$',
  },
];

/**
 * 計算 PMF Score
 *
 * @param params.trialConversionRate  - 試用轉換率，例如 41.2（百分比）
 * @param params.monthlyChurnRate     - 月流失率，例如 6.1（百分比）
 * @param params.quickRatio           - Quick Ratio，例如 1.0
 * @param params.revenueGrowthRate    - MoM 收入成長率，例如 0.4（百分比）
 * @param params.ltvPerPayingCustomer - 付費用戶終身價值，例如 18.93（美元）
 */
export function calculatePMFScore(params: {
  trialConversionRate: number;
  monthlyChurnRate: number;
  quickRatio: number;
  revenueGrowthRate: number;
  ltvPerPayingCustomer: number;
}): PMFScoreResult {
  const { trialConversionRate, monthlyChurnRate, quickRatio, revenueGrowthRate, ltvPerPayingCustomer } = params;
  const rawValues = [
    trialConversionRate,
    monthlyChurnRate,
    quickRatio,
    revenueGrowthRate,
    ltvPerPayingCustomer,
  ];

  // 計算各因子得分
  const breakdown = FACTORS.map((factor, i) => {
    const rawValue = rawValues[i]!;
    let factorScore: number;

    if (factor.direction === 'lower') {
      // 越低越好：min0 對應 0 分，max100 對應 100 分
      // 例如 churn: 15% → 0 分，2% → 100 分
      factorScore = linearInterpolate(rawValue, factor.min0, factor.max100, 0, 100);
    } else {
      // 越高越好：min0 對應 0 分，max100 對應 100 分
      factorScore = linearInterpolate(rawValue, factor.min0, factor.max100, 0, 100);
    }

    // 裁剪到 0-100
    factorScore = clamp(Math.round(factorScore * 10) / 10, 0, 100);

    const weighted = Math.round(factorScore * factor.weight * 10) / 10;
    const explanation = buildFactorExplanation(factor, rawValue, factorScore);

    return {
      factor: factor.name,
      rawValue,
      score: factorScore,
      weight: factor.weight,
      weighted,
      explanation,
    };
  });

  // 加權平均得到總分
  const scores = breakdown.map((b) => b.score);
  const weights = breakdown.map((b) => b.weight);
  const totalScore = Math.round(weightedAverage(scores, weights) * 10) / 10;

  // 分級
  const grade = gradePMFScore(totalScore);

  // 診斷摘要
  const diagnosis = buildDiagnosis(totalScore, grade, breakdown);

  // 決策建議
  const decisionAdvice = buildDecisionAdvice(totalScore, grade, quickRatio, breakdown);

  return {
    score: totalScore,
    grade,
    breakdown,
    diagnosis,
    decisionAdvice,
  };
}

/**
 * 根據總分評定 PMF 等級
 */
function gradePMFScore(score: number): PMFScoreResult['grade'] {
  if (score >= 80) return 'Strong PMF';
  if (score >= 60) return 'Approaching PMF';
  if (score >= 40) return 'Pre-PMF';
  return 'No PMF Signal';
}

/**
 * 產生單一因子的解釋文字
 */
function buildFactorExplanation(factor: FactorConfig, rawValue: number, score: number): string {
  const formattedValue = factor.unit === '$'
    ? `$${rawValue.toFixed(2)}`
    : factor.unit === 'x'
      ? `${rawValue.toFixed(2)}x`
      : `${rawValue.toFixed(1)}%`;

  // 根據分數判定表現
  let performance: string;
  if (score >= 80) {
    performance = 'excellent';
  } else if (score >= 60) {
    performance = 'above average';
  } else if (score >= 40) {
    performance = 'average';
  } else if (score >= 20) {
    performance = 'below average';
  } else {
    performance = 'poor';
  }

  // 中位數參考值（SOSA 2026 基準）
  const medianRef: Record<string, string> = {
    'Trial Conversion Rate': '35%',
    'Monthly Churn Rate': '6%',
    'Quick Ratio': '1.5x',
    'Revenue Growth (3m MoM)': '0%',
    'LTV per Paying Customer': '$15',
  };

  const median = medianRef[factor.name] ?? '';
  const medianNote = median ? ` (median: ${median})` : '';

  return `${factor.name} of ${formattedValue} is ${performance}${medianNote}`;
}

/**
 * 產生一段式診斷摘要
 */
function buildDiagnosis(
  score: number,
  grade: PMFScoreResult['grade'],
  breakdown: PMFScoreResult['breakdown'],
): string {
  // 找出最強和最弱因子
  const sorted = [...breakdown].sort((a, b) => b.score - a.score);
  const strongest = sorted[0]!;
  const weakest = sorted[sorted.length - 1]!;

  const gradeDescriptions: Record<PMFScoreResult['grade'], string> = {
    'Strong PMF': 'Top 5% of apps — your product has clear market demand.',
    'Approaching PMF': 'Top 25% — solid foundation with room for optimization.',
    'Pre-PMF': 'Average performance — product-market fit is still emerging.',
    'No PMF Signal': 'Below average — significant gaps between product and market need.',
  };

  return `PMF Score: ${score}/100 (${grade}). ${gradeDescriptions[grade]} ` +
    `Strongest factor: ${strongest.factor} (${strongest.score}/100). ` +
    `Weakest factor: ${weakest.factor} (${weakest.score}/100) — focus improvement here.`;
}

/**
 * 決策矩陣 — 根據 PMF 等級與成長動態給出行動建議
 *
 * - Strong PMF + Growing (QR > 1.3):   Double Down
 * - Strong PMF + Flat (QR 0.9-1.3):    Optimize
 * - Weak PMF + Growing:                Fix Leaks First
 * - Weak PMF + Flat:                   Pivot
 * - Any PMF + Declining (QR < 0.9):    Harvest & Explore
 */
function buildDecisionAdvice(
  score: number,
  grade: PMFScoreResult['grade'],
  quickRatio: number,
  breakdown: PMFScoreResult['breakdown'],
): PMFScoreResult['decisionAdvice'] {
  const isStrongPMF = score >= 60;
  const isGrowing = quickRatio > 1.3;
  const isFlat = quickRatio >= 0.9 && quickRatio <= 1.3;
  const isDeclining = quickRatio < 0.9;

  // 找出最弱因子用於建議
  const sorted = [...breakdown].sort((a, b) => a.score - b.score);
  const weakest = sorted[0]!;
  const secondWeakest = sorted[1]!;

  if (isDeclining) {
    return {
      verdict: '🚪 Harvest & Explore',
      reasoning: `Quick Ratio of ${quickRatio.toFixed(2)} indicates declining revenue. ` +
        `Revenue losses outpace gains regardless of PMF score.`,
      topActions: [
        'Conduct exit interviews with recently churned customers',
        `Address ${weakest.factor} urgently (scoring ${weakest.score}/100)`,
        'Evaluate whether to pivot the product or explore adjacent markets',
      ],
    };
  }

  if (isStrongPMF && isGrowing) {
    return {
      verdict: '🚀 Double Down',
      reasoning: `Strong PMF (${score}/100) combined with healthy growth (QR ${quickRatio.toFixed(2)}) ` +
        `signals clear product-market fit. Invest aggressively in acquisition.`,
      topActions: [
        'Scale acquisition spend — unit economics support growth',
        'Expand to adjacent user segments or markets',
        `Optimize ${weakest.factor} to unlock even more growth (${weakest.score}/100)`,
      ],
    };
  }

  if (isStrongPMF && isFlat) {
    return {
      verdict: '🔧 Optimize',
      reasoning: `Good PMF (${score}/100) but flat growth (QR ${quickRatio.toFixed(2)}). ` +
        `The product resonates but needs operational improvements to grow.`,
      topActions: [
        `Improve ${weakest.factor} (${weakest.score}/100) — biggest growth lever`,
        `Then tackle ${secondWeakest.factor} (${secondWeakest.score}/100)`,
        'A/B test onboarding and paywall to increase conversion efficiency',
      ],
    };
  }

  if (!isStrongPMF && isGrowing) {
    return {
      verdict: '🔧 Optimize',
      reasoning: `Growing revenue (QR ${quickRatio.toFixed(2)}) despite moderate PMF (${score}/100). ` +
        `Fix the leaks before scaling further.`,
      topActions: [
        `Fix ${weakest.factor} first (${weakest.score}/100) — the biggest leak`,
        'Reduce churn before increasing acquisition',
        'Interview retained users to understand what keeps them — double down on that',
      ],
    };
  }

  // Weak PMF + Flat
  return {
    verdict: '🔄 Pivot',
    reasoning: `Low PMF (${score}/100) with flat growth (QR ${quickRatio.toFixed(2)}). ` +
      `Current approach is not gaining traction.`,
    topActions: [
      'Talk to your most engaged users — find the niche that loves you',
      'Consider a significant product or positioning change',
      `${weakest.factor} at ${weakest.score}/100 suggests fundamental issues with the current model`,
    ],
  };
}
