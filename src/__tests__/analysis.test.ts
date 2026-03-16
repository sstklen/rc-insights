// ========================================
// rc-insights 自動化測試
// 覆蓋核心分析邏輯、工具函數、i18n
// ========================================

import { describe, it, expect } from "bun:test";
import { calculateQuickRatio, getMultiMeasureTimeSeries } from "../analysis/quick-ratio.ts";
import { calculatePMFScore } from "../analysis/pmf-score.ts";
import { forecastMRR } from "../analysis/mrr-forecast.ts";
import { runScenarios } from "../analysis/scenario-engine.ts";
import { generateExecutiveSummary, renderHeadline, renderInsight, renderFlywheelLevel } from "../analysis/executive-summary.ts";
import { linearInterpolate, clamp, weightedAverage, trendSlope } from "../utils/math.ts";
import { formatCurrency, formatPercent, formatNumber, formatByUnit } from "../utils/formatting.ts";
import { sumSegmentValues, avgSegmentValues, extractValidSegments } from "../utils/segment.ts";
import { setLocale, t, tMetric, getLocale } from "../i18n/index.ts";
import type { ChartData, ChartValue, MetricHealth, Anomaly } from "../api/types.ts";

// ========================================
// Utils: math.ts
// ========================================
describe("math utilities", () => {
  it("linearInterpolate maps correctly", () => {
    expect(linearInterpolate(50, 0, 100, 0, 1)).toBe(0.5);
    expect(linearInterpolate(0, 0, 100, 0, 1)).toBe(0);
    expect(linearInterpolate(100, 0, 100, 0, 1)).toBe(1);
  });

  it("clamp restricts to range", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it("weightedAverage works", () => {
    expect(weightedAverage([100, 0], [0.5, 0.5])).toBe(50);
    expect(weightedAverage([80, 60], [0.75, 0.25])).toBe(75);
    expect(weightedAverage([], [])).toBe(0);
  });

  it("trendSlope detects direction", () => {
    expect(trendSlope([1, 2, 3, 4, 5])).toBeGreaterThan(0);
    expect(trendSlope([5, 4, 3, 2, 1])).toBeLessThan(0);
    expect(trendSlope([3, 3, 3])).toBe(0);
  });
});

// ========================================
// Utils: formatting.ts
// ========================================
describe("formatting utilities", () => {
  it("formatCurrency handles different scales", () => {
    expect(formatCurrency(500)).toBe("$500.00");
    expect(formatCurrency(4562)).toContain("$4,562");
    expect(formatCurrency(54700)).toContain("$54.7K");
    expect(formatCurrency(1500000)).toContain("$1.5M");
  });

  it("formatPercent works", () => {
    expect(formatPercent(6.7)).toBe("6.7%");
    expect(formatPercent(0.35, true)).toBe("35.0%");
  });

  it("formatByUnit dispatches correctly", () => {
    expect(formatByUnit(100, "$")).toContain("$");
    expect(formatByUnit(50, "%")).toContain("%");
    expect(formatByUnit(2500, "#")).toBe("2,500");
  });
});

// ========================================
// Utils: segment.ts
// ========================================
describe("segment utilities", () => {
  const mockSegment = {
    display_name: "test",
    id: "test",
    values: [
      { cohort: 1000, incomplete: false, measure: 0, value: 10 },
      { cohort: 2000, incomplete: false, measure: 0, value: 20 },
      { cohort: 3000, incomplete: true, measure: 0, value: 30 },
      { cohort: 4000, incomplete: false, measure: 1, value: 99 },
    ],
  };

  it("sumSegmentValues sums measure=0 complete values", () => {
    expect(sumSegmentValues(mockSegment)).toBe(30); // 10 + 20 (not 30=incomplete, not 99=measure1)
  });

  it("avgSegmentValues averages measure=0 complete values", () => {
    expect(avgSegmentValues(mockSegment)).toBe(15); // (10+20)/2
  });

  it("extractValidSegments filters by set", () => {
    const segments = [
      { display_name: "A", id: "good", values: [] },
      { display_name: "B", id: "total", values: [] },
      { display_name: "C", id: "no keyword", values: [] },
    ];
    const filterSet = new Set(["total", "no keyword"]);
    const result = extractValidSegments(segments, filterSet);
    expect(result.size).toBe(1);
    expect(result.has("good")).toBe(true);
  });

  it("extractValidSegments handles null/undefined", () => {
    expect(extractValidSegments(null, new Set()).size).toBe(0);
    expect(extractValidSegments(undefined, new Set()).size).toBe(0);
  });
});

// ========================================
// Analysis: Quick Ratio
// ========================================
describe("Quick Ratio", () => {
  // 建構一個簡化的 mrr_movement ChartData
  function makeMRRMovement(months: Array<{ newMrr: number; churnedMrr: number }>): ChartData {
    const values: ChartValue[] = [];
    months.forEach((m, i) => {
      const cohort = new Date(2025, i, 1).getTime() / 1000;
      // measure 0 = New, measure 3 = Churned
      values.push({ cohort, incomplete: false, measure: 0, value: m.newMrr });
      values.push({ cohort, incomplete: false, measure: 1, value: 0 }); // resub
      values.push({ cohort, incomplete: false, measure: 2, value: 0 }); // expansion
      values.push({ cohort, incomplete: false, measure: 3, value: m.churnedMrr });
      values.push({ cohort, incomplete: false, measure: 4, value: 0 }); // contraction
    });
    return {
      display_name: "MRR Movement",
      description: "",
      category: "",
      resolution: "month",
      start_date: 0,
      end_date: 0,
      summary: {},
      values,
      measures: [],
    };
  }

  it("calculates QR correctly for balanced inflow/outflow", () => {
    const data = makeMRRMovement([
      { newMrr: 100, churnedMrr: 100 },
      { newMrr: 200, churnedMrr: 200 },
    ]);
    const result = calculateQuickRatio(data);
    expect(result.current).toBe(1);
    expect(result.grade).toBe("concerning");
  });

  it("grades excellent for high QR", () => {
    const data = makeMRRMovement([
      { newMrr: 500, churnedMrr: 100 },
    ]);
    const result = calculateQuickRatio(data);
    expect(result.current).toBe(5);
    expect(result.grade).toBe("excellent");
  });

  it("grades leaking for QR < 1", () => {
    const data = makeMRRMovement([
      { newMrr: 50, churnedMrr: 100 },
    ]);
    const result = calculateQuickRatio(data);
    expect(result.current).toBe(0.5);
    expect(result.grade).toBe("leaking");
  });
});

// ========================================
// Analysis: PMF Score
// ========================================
describe("PMF Score", () => {
  it("scores high for excellent metrics", () => {
    const result = calculatePMFScore({
      trialConversionRate: 60,
      monthlyChurnRate: 2,
      quickRatio: 4,
      revenueGrowthRate: 10,
      ltvPerPayingCustomer: 60,
    });
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.grade).toBe("Strong PMF");
    expect(result.decisionAdvice.verdict).toContain("Double Down");
  });

  it("scores low for poor metrics", () => {
    const result = calculatePMFScore({
      trialConversionRate: 10,
      monthlyChurnRate: 15,
      quickRatio: 0.5,
      revenueGrowthRate: -10,
      ltvPerPayingCustomer: 5,
    });
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.grade).toBe("No PMF Signal");
  });

  it("produces Dark Noise-like result", () => {
    const result = calculatePMFScore({
      trialConversionRate: 47.4,
      monthlyChurnRate: 6.7,
      quickRatio: 1.05,
      revenueGrowthRate: 0.4,
      ltvPerPayingCustomer: 20.57,
    });
    expect(result.score).toBeGreaterThan(40);
    expect(result.score).toBeLessThan(65);
    expect(result.breakdown.length).toBe(5);
  });
});

// ========================================
// Analysis: Scenarios
// ========================================
describe("Scenario Engine", () => {
  it("Fix Churn always improves MRR", () => {
    const result = runScenarios({
      currentMRR: 4558,
      monthlyChurn: 6.7,
      monthlyNewMRR: 270,
      trialConversionRate: 47,
      monthlyNewTrials: 259,
    });
    expect(result.scenarios.length).toBe(3);
    const fixChurn = result.scenarios.find((s) => s.name === "Fix Churn");
    expect(fixChurn).toBeDefined();
    expect(fixChurn!.improvement.month12Delta).toBeGreaterThan(0);
  });

  it("identifies best scenario", () => {
    const result = runScenarios({
      currentMRR: 4558,
      monthlyChurn: 6.7,
      monthlyNewMRR: 270,
      trialConversionRate: 47,
      monthlyNewTrials: 259,
    });
    expect(result.bestScenario).toBeTruthy();
  });
});

// ========================================
// Analysis: Executive Summary
// ========================================
describe("Executive Summary", () => {
  const mockMetrics: MetricHealth[] = [
    { metricId: "mrr", name: "MRR", value: 4562, unit: "$", status: "green", trend: "stable", changePercent: 0.4, benchmark: 2000, benchmarkLabel: "SOSA" },
    { metricId: "churn", name: "Churn", value: 6.7, unit: "%", status: "yellow", trend: "stable", changePercent: -12, benchmark: 6, benchmarkLabel: "SOSA" },
  ];

  it("generates health score", () => {
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    expect(summary.healthScore).toBeGreaterThan(0);
    expect(summary.healthGrade).toBeTruthy();
    expect(renderHeadline(summary)).toBeTruthy();
    expect(summary.topAction.scenarioName).toBeTruthy();
  });

  it("includes key insights", () => {
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    expect(summary.keyInsights.length).toBeGreaterThan(0);
  });

  it("renders headline in Chinese", () => {
    setLocale("zh");
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    const headline = renderHeadline(summary, "zh");
    // 中文 headline 應包含中文字元
    expect(headline).toMatch(/[\u4e00-\u9fff]/);
    expect(headline).toContain("$4,562");
    setLocale("en");
  });

  it("renders headline in Japanese", () => {
    setLocale("ja");
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    const headline = renderHeadline(summary, "ja");
    // 日文 headline 應包含日文字元（平假名/片假名/漢字）
    expect(headline).toMatch(/[\u3000-\u9fff\u30a0-\u30ff]/);
    setLocale("en");
  });

  it("renders insights in Chinese", () => {
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    if (summary.keyInsights.length > 0) {
      const { title, detail } = renderInsight(summary.keyInsights[0]!, "zh");
      // 中文 insight 應包含中文字元
      expect(title).toMatch(/[\u4e00-\u9fff]/);
      expect(detail).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("renders flywheel level in Japanese", () => {
    const summary = generateExecutiveSummary({
      projectName: "Test",
      metrics: mockMetrics,
      anomalies: [],
    });
    const fw = renderFlywheelLevel(summary, "ja");
    // 日文飛輪層級
    expect(fw.label).toMatch(/[\u3000-\u9fff\u30a0-\u30ff]/);
    expect(fw.nextUnlock).toMatch(/[\u3000-\u9fff\u30a0-\u30ff]/);
  });
});

// ========================================
// i18n
// ========================================
describe("i18n", () => {
  it("defaults to English", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
    expect(t("section.overview")).toContain("Overview");
  });

  it("switches to Chinese", () => {
    setLocale("zh");
    expect(t("section.overview")).not.toBe("Overview (Last 28 days)");
    // 中文的概覽標題應該包含中文字
    const overview = t("section.overview");
    expect(overview.length).toBeGreaterThan(0);
  });

  it("switches to Japanese", () => {
    setLocale("ja");
    const overview = t("section.overview");
    expect(overview.length).toBeGreaterThan(0);
  });

  it("tMetric returns metric name", () => {
    setLocale("en");
    const name = tMetric("mrr", "fallback");
    expect(name).toBeTruthy();
    expect(name).not.toBe("fallback");
  });

  // 復原 locale
  it("resets to en", () => {
    setLocale("en");
    expect(getLocale()).toBe("en");
  });
});
