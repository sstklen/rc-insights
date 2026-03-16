// ========================================
// What-if 場景分析引擎
// 模擬 Fix Churn / Scale Acquisition / Price Optimization
// ========================================

import { formatCurrency, formatPercent } from "../utils/formatting.ts";

/** 單一場景結果 */
export interface ScenarioResult {
  /** 場景名稱 */
  name: string;
  /** 場景說明 */
  description: string;
  /** 參數變更明細 */
  changes: Record<string, { from: number; to: number; unit: string }>;
  /** 場景預測 MRR */
  projectedMRR: {
    month3: number;
    month6: number;
    month12: number;
  };
  /** 維持現狀的預測 MRR */
  currentProjection: {
    month3: number;
    month6: number;
    month12: number;
  };
  /** 改善幅度 */
  improvement: {
    /** 第 12 個月的 MRR 差額 */
    month12Delta: number;
    /** 第 12 個月的 MRR 差額百分比 */
    month12DeltaPercent: number;
  };
  /** 白話解釋 */
  narrative: string;
}

/** 場景分析結果（包含所有場景） */
export interface ScenarioAnalysisResult {
  /** 各場景結果 */
  scenarios: ScenarioResult[];
  /** 影響最大的場景名稱 */
  bestScenario: string;
  /** 綜合建議 */
  combinedNarrative: string;
}

/**
 * 模擬 N 個月後的 MRR
 * 每月邏輯：retained = MRR × (1 - churnRate) + monthlyNewMRR
 *
 * @param startMRR - 起始 MRR
 * @param monthlyChurnRate - 月流失率（0-1 之間，例如 0.061 = 6.1%）
 * @param monthlyNewMRR - 每月新增 MRR
 * @param months - 模擬月數
 * @returns 第 N 個月的 MRR
 */
function simulateMRR(
  startMRR: number,
  monthlyChurnRate: number,
  monthlyNewMRR: number,
  months: number,
): number {
  let mrr = startMRR;
  for (let i = 0; i < months; i++) {
    mrr = mrr * (1 - monthlyChurnRate) + monthlyNewMRR;
  }
  return Math.round(mrr * 100) / 100;
}

/**
 * 計算維持現狀的 MRR 預測（3/6/12 個月）
 */
function baselineProjection(
  currentMRR: number,
  monthlyChurnRate: number,
  monthlyNewMRR: number,
): { month3: number; month6: number; month12: number } {
  return {
    month3: simulateMRR(currentMRR, monthlyChurnRate, monthlyNewMRR, 3),
    month6: simulateMRR(currentMRR, monthlyChurnRate, monthlyNewMRR, 6),
    month12: simulateMRR(currentMRR, monthlyChurnRate, monthlyNewMRR, 12),
  };
}

/**
 * 場景 1: Fix Churn — 把 churn 降到 4%
 */
function scenarioFixChurn(
  currentMRR: number,
  monthlyChurn: number,
  monthlyNewMRR: number,
  baseline: { month3: number; month6: number; month12: number },
): ScenarioResult {
  const targetChurn = 4.0;
  const newChurnRate = targetChurn / 100;
  const currentChurnRate = monthlyChurn / 100;

  const projected = {
    month3: simulateMRR(currentMRR, newChurnRate, monthlyNewMRR, 3),
    month6: simulateMRR(currentMRR, newChurnRate, monthlyNewMRR, 6),
    month12: simulateMRR(currentMRR, newChurnRate, monthlyNewMRR, 12),
  };

  const month12Delta = projected.month12 - baseline.month12;
  const month12DeltaPercent =
    baseline.month12 > 0 ? (month12Delta / baseline.month12) * 100 : 0;

  return {
    name: "Fix Churn",
    description: `Reduce monthly churn from ${formatPercent(monthlyChurn)} to ${formatPercent(targetChurn)}`,
    changes: {
      monthlyChurn: {
        from: monthlyChurn,
        to: targetChurn,
        unit: "%",
      },
    },
    projectedMRR: projected,
    currentProjection: baseline,
    improvement: {
      month12Delta: Math.round(month12Delta * 100) / 100,
      month12DeltaPercent: Math.round(month12DeltaPercent * 10) / 10,
    },
    narrative:
      `Reducing churn from ${monthlyChurn.toFixed(1)}% to ${targetChurn.toFixed(1)}% ` +
      `would ${month12Delta >= 0 ? "add" : "save"} ~${formatCurrency(Math.abs(month12Delta))}/month to MRR within 12 months ` +
      `(from ${formatCurrency(baseline.month12)} to ${formatCurrency(projected.month12)}).`,
  };
}

/**
 * 場景 2: Scale Acquisition — new trials 增加 50%
 * 假設轉換率不變，所以 new_mrr 也增加 50%
 */
function scenarioScaleAcquisition(
  currentMRR: number,
  monthlyChurn: number,
  monthlyNewMRR: number,
  monthlyNewTrials: number,
  trialConversionRate: number,
  baseline: { month3: number; month6: number; month12: number },
): ScenarioResult {
  const churnRate = monthlyChurn / 100;
  const scaleFactor = 1.5;
  const newTrials = Math.round(monthlyNewTrials * scaleFactor);
  const scaledNewMRR = monthlyNewMRR * scaleFactor;

  const projected = {
    month3: simulateMRR(currentMRR, churnRate, scaledNewMRR, 3),
    month6: simulateMRR(currentMRR, churnRate, scaledNewMRR, 6),
    month12: simulateMRR(currentMRR, churnRate, scaledNewMRR, 12),
  };

  const month12Delta = projected.month12 - baseline.month12;
  const month12DeltaPercent =
    baseline.month12 > 0 ? (month12Delta / baseline.month12) * 100 : 0;

  return {
    name: "Scale Acquisition",
    description: `Increase new trials by 50% (from ${monthlyNewTrials} to ${newTrials}/month)`,
    changes: {
      monthlyNewTrials: {
        from: monthlyNewTrials,
        to: newTrials,
        unit: "#",
      },
      monthlyNewMRR: {
        from: monthlyNewMRR,
        to: Math.round(scaledNewMRR * 100) / 100,
        unit: "$",
      },
    },
    projectedMRR: projected,
    currentProjection: baseline,
    improvement: {
      month12Delta: Math.round(month12Delta * 100) / 100,
      month12DeltaPercent: Math.round(month12DeltaPercent * 10) / 10,
    },
    narrative:
      `Scaling new trials from ${monthlyNewTrials} to ${newTrials}/month ` +
      `(at ${trialConversionRate.toFixed(1)}% conversion) ` +
      `would add ~${formatCurrency(Math.abs(month12Delta))}/month to MRR within 12 months ` +
      `(from ${formatCurrency(baseline.month12)} to ${formatCurrency(projected.month12)}).`,
  };
}

/**
 * 場景 3: Price Optimization — ARPU 提升 20%
 * MRR × 1.2 作為新基準，然後按原成長率推算
 */
function scenarioPriceOptimization(
  currentMRR: number,
  monthlyChurn: number,
  monthlyNewMRR: number,
  baseline: { month3: number; month6: number; month12: number },
): ScenarioResult {
  const churnRate = monthlyChurn / 100;
  const priceLift = 1.2;
  const liftedMRR = currentMRR * priceLift;
  // 新用戶 MRR 也按比例提升
  const liftedNewMRR = monthlyNewMRR * priceLift;

  const projected = {
    month3: simulateMRR(liftedMRR, churnRate, liftedNewMRR, 3),
    month6: simulateMRR(liftedMRR, churnRate, liftedNewMRR, 6),
    month12: simulateMRR(liftedMRR, churnRate, liftedNewMRR, 12),
  };

  const month12Delta = projected.month12 - baseline.month12;
  const month12DeltaPercent =
    baseline.month12 > 0 ? (month12Delta / baseline.month12) * 100 : 0;

  return {
    name: "Price Optimization",
    description: `Increase ARPU by 20% through pricing changes`,
    changes: {
      currentMRR: {
        from: currentMRR,
        to: Math.round(liftedMRR * 100) / 100,
        unit: "$",
      },
    },
    projectedMRR: projected,
    currentProjection: baseline,
    improvement: {
      month12Delta: Math.round(month12Delta * 100) / 100,
      month12DeltaPercent: Math.round(month12DeltaPercent * 10) / 10,
    },
    narrative:
      `Increasing ARPU by 20% (lifting MRR from ${formatCurrency(currentMRR)} to ${formatCurrency(liftedMRR)}) ` +
      `would add ~${formatCurrency(Math.abs(month12Delta))}/month to MRR within 12 months ` +
      `(from ${formatCurrency(baseline.month12)} to ${formatCurrency(projected.month12)}).`,
  };
}

/**
 * 執行所有 What-if 場景分析
 *
 * @param params.currentMRR - 目前 MRR
 * @param params.monthlyChurn - 月流失率百分比（例如 6.1）
 * @param params.monthlyNewMRR - 每月新增 MRR 金額
 * @param params.trialConversionRate - 試用轉換率百分比
 * @param params.monthlyNewTrials - 每月新增試用數
 * @returns 場景分析結果
 */
export function runScenarios(params: {
  currentMRR: number;
  monthlyChurn: number;
  monthlyNewMRR: number;
  trialConversionRate: number;
  monthlyNewTrials: number;
}): ScenarioAnalysisResult {
  const { currentMRR, monthlyChurn, monthlyNewMRR, trialConversionRate, monthlyNewTrials } = params;
  // 計算維持現狀的基準預測
  const churnRate = monthlyChurn / 100;
  const baseline = baselineProjection(currentMRR, churnRate, monthlyNewMRR);

  // 跑三個場景
  const fixChurn = scenarioFixChurn(currentMRR, monthlyChurn, monthlyNewMRR, baseline);
  const scaleAcq = scenarioScaleAcquisition(
    currentMRR,
    monthlyChurn,
    monthlyNewMRR,
    monthlyNewTrials,
    trialConversionRate,
    baseline,
  );
  const priceOpt = scenarioPriceOptimization(
    currentMRR,
    monthlyChurn,
    monthlyNewMRR,
    baseline,
  );

  const scenarios = [fixChurn, scaleAcq, priceOpt];

  // 找出影響最大的場景（依 month12Delta 排序）
  const sorted = [...scenarios].sort(
    (a, b) => b.improvement.month12Delta - a.improvement.month12Delta,
  );
  const bestScenario = sorted[0]!.name;

  // 產生綜合建議
  const combinedNarrative =
    `Among the three scenarios analyzed, "${bestScenario}" has the highest potential impact ` +
    `(+${formatCurrency(sorted[0]!.improvement.month12Delta)}/month at 12 months). ` +
    `Current baseline projects MRR at ${formatCurrency(baseline.month12)} in 12 months. ` +
    scenarios
      .map(
        (s) =>
          `${s.name}: ${s.improvement.month12Delta >= 0 ? "+" : ""}${formatCurrency(s.improvement.month12Delta)} (${s.improvement.month12DeltaPercent >= 0 ? "+" : ""}${s.improvement.month12DeltaPercent}%)`,
      )
      .join(". ") +
    ".";

  return {
    scenarios,
    bestScenario,
    combinedNarrative,
  };
}
