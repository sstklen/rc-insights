// ========================================
// 繁體中文翻譯（台灣用語）
// ========================================

import type { TranslationDict } from "./index.ts";

export const zh: TranslationDict = {
  // ── 標題 / 頁尾 ──
  "header.subtitle": "訂閱健康狀況",
  "header.report_by": "由 rc-insights 產生",
  "header.subscription_health_report": "訂閱健康報告",
  "header.generated": "產生時間",
  "footer.generated_by": "由 rc-insights 產生 — AI 驅動的訂閱健康分析工具",
  "footer.generated_by_html": "由 <a href=\"https://github.com/nicething/rc-insights\">rc-insights</a> 產生 — RevenueCat Charts API 的 AI 分析工具",

  // ── 區塊標題 ──
  "section.overview": "總覽（近 28 天）",
  "section.overview_md": "總覽",
  "section.health_score_chart": "健康分數圖表",
  "section.metrics_overview": "指標總覽",
  "section.anomalies": "異常偵測",
  "section.recommendations": "關鍵洞察與建議",
  "section.recommendations_md": "建議",
  "section.crystal_ball": "水晶球預測",
  "section.strategy": "策略分析",
  "section.strategy_analysis": "策略分析",
  "section.next_product_ideas": "新產品方向",
  "section.agent_plan": "AI 代理行動計畫",
  "section.benchmarks": "SOSA 2026 產業基準",
  "section.benchmark_reference": "基準參考",

  // ── 趨勢標籤 ──
  "trend.growing": "成長中",
  "trend.stable": "穩定",
  "trend.declining": "下滑中",
  "trend.unknown": "未知",

  // ── 趨勢標籤（帶圖示，用於 Markdown）──
  "trend.growing_icon": "📈 成長中",
  "trend.stable_icon": "➡️ 穩定",
  "trend.declining_icon": "📉 下滑中",

  // ── 狀態標籤 ──
  "status.healthy": "健康",
  "status.attention": "需關注",
  "status.critical": "警告",

  // ── 影響等級 ──
  "impact.high": "高",
  "impact.medium": "中",
  "impact.low": "低",

  // ── 表頭 ──
  "table.metric": "指標",
  "table.value": "數值",
  "table.status": "狀態",
  "table.trend": "趨勢",
  "table.mom_change": "月環比",
  "table.benchmark": "基準值",
  "table.date": "日期",
  "table.ratio": "比率",
  "table.inflow": "流入",
  "table.outflow": "流出",
  "table.factor": "因子",
  "table.raw_value": "原始值",
  "table.score": "得分",
  "table.weight": "權重",
  "table.weighted": "加權",
  "table.month": "月份",
  "table.base": "基準",
  "table.optimistic": "樂觀",
  "table.pessimistic": "悲觀",
  "table.scenario": "情境",
  "table.description": "說明",
  "table.mrr_12m": "12個月MRR增量",
  "table.delta_pct": "變動%",
  "table.keyword": "關鍵字",
  "table.trials": "試用數",
  "table.revenue": "營收",
  "table.conversion": "轉換率",
  "table.efficiency": "效率",
  "table.offering": "產品方案",
  "table.name": "名稱",
  "table.performance": "表現",
  "table.median": "中位數",
  "table.top_25": "前 25%",
  "table.bottom_25": "後 25%",
  "table.action_id": "#",
  "table.action": "行動",
  "table.mcp_tool": "MCP 工具",
  "table.priority": "優先度",
  "table.expected_impact": "預期影響",
  "table.12m_impact": "12 個月影響",
  "table.pct_change": "變動 %",

  // ── 指標顯示名稱 ──
  "metric.mrr": "月經常性收入",
  "metric.arr": "年經常性收入",
  "metric.churn": "流失率",
  "metric.trial_conversion_rate": "試用轉付費",
  "metric.revenue": "營收",
  "metric.actives": "活躍訂閱者",
  "metric.customers_new": "新客戶",
  "metric.trials_new": "新試用",
  "metric.refund_rate": "退款率",
  "metric.ltv_per_customer": "客戶終身價值",

  // ── Quick Ratio ──
  "qr.title": "Quick Ratio",
  "qr.grade.excellent": "優秀",
  "qr.grade.healthy": "健康",
  "qr.grade.concerning": "需關注",
  "qr.grade.leaking": "流失中",
  "qr.grade.excellent_icon": "🟢 優秀",
  "qr.grade.healthy_icon": "🟢 健康",
  "qr.grade.concerning_icon": "🟡 需關注",
  "qr.grade.leaking_icon": "🔴 流失中",

  // ── PMF Score ──
  "pmf.title": "PMF 分數",
  "pmf.grade.strong": "強 PMF",
  "pmf.grade.approaching": "接近 PMF",
  "pmf.grade.pre": "前期 PMF",
  "pmf.grade.no_signal": "無 PMF 訊號",
  "pmf.grade.strong_icon": "🟢 強 PMF",
  "pmf.grade.approaching_icon": "🟢 接近 PMF",
  "pmf.grade.pre_icon": "🟡 前期 PMF",
  "pmf.grade.no_signal_icon": "🔴 無 PMF 訊號",
  "pmf.diagnosis_label": "診斷",
  "pmf.verdict_label": "結論",
  "pmf.decision_label": "決策",
  "pmf.reasoning_label": "推理",

  // ── MRR 預測 ──
  "forecast.title": "MRR 預測",

  // ── 情境分析 ──
  "scenario.title": "假設情境分析",
  "scenario.best": "最佳情境",
  "scenario.best_scenario": "最佳情境",
  "scenario.vs_baseline": "與基準相比（12個月後）",

  // ── 策略 ──
  "strategy.keyword_analysis": "關鍵字分析",
  "strategy.keyword_attribution": "關鍵字歸因",
  "strategy.offering_analysis": "產品方案分析",
  "strategy.offering_performance": "產品方案表現",

  // ── 異常 ──
  "anomaly.none": "分析期間內未偵測到異常。",
  "anomaly.on": "於",

  // ── 建議 ──
  "rec.related": "相關指標",
  "rec.impact": "影響",
  "rec.related_metric": "相關指標",

  // ── 新產品方向 ──
  "product.complexity": "複雜度",
  "product.source": "資料來源",
  "product.evidence": "證據",
  "product.direction.vertical": "↕️ 價值鏈上下延伸",
  "product.direction.horizontal": "↔️ 橫向擴展",
  "product.direction.adjacent": "🔀 跳入新市場",

  // ── AI 代理計畫 ──
  "agent.estimated_impact": "預估影響",
  "agent.estimated_total_impact": "預估總影響",

  // ── 基準參考 ──
  "benchmark.description": "基於 RevenueCat 的 **State of Subscription Apps 2026**（SOSA 2026）：",
  "benchmark.trial_conversion": "試用轉換率",
  "benchmark.monthly_churn": "月流失率",
  "benchmark.refund_rate": "退款率",
  "benchmark.mrr": "MRR",
  "benchmark.ltv_per_customer": "客戶終身價值",

  // ── 其他 ──
  "misc.benchmark_label": "基準",
  "misc.mom": "月環比",
  "misc.na": "N/A",

  // ── 執行摘要 ──
  "es.headline.excellent": "$MRR MRR 強勢成長中 — 加碼投入獲客。",
  "es.headline.good": "$MRR MRR 基本面穩健 — 優化以解鎖成長。",
  "es.headline.fair": "$MRR MRR 訊號混合 — 聚焦你的優勢。",
  "es.headline.at_risk": "$MRR MRR 指標下滑 — 需要立即行動。",
  "es.insight.qr_strong.title": "強勁成長：QR $qrx",
  "es.insight.qr_strong.detail": "MRR $mrr，Quick Ratio $qr — 營收流入遠超流失。",
  "es.insight.qr_treading.title": "原地踏步：QR $qrx",
  "es.insight.qr_treading.detail": "MRR $mrr 穩定但沒成長 — 新營收約等於流失（進 $inflow vs 出 $outflow）。",
  "es.insight.qr_leaking.title": "營收流失中：QR $qrx",
  "es.insight.qr_leaking.detail": "MRR $mrr 正在萎縮 — 每月流失多於進帳。",
  "es.insight.top_strength.title": "最大優勢：$metricName",
  "es.insight.top_strength.detail": "$metricName 達 $value，超過基準 $benchmark。",
  "es.insight.critical.title": "需關注：$metricName",
  "es.insight.critical.detail": "$metricName 目前 $value，需要立即改善。",
  "es.insight.forecast.title": "6 個月展望：$projectedMRR",
  "es.insight.forecast.detail": "MRR 預計從 $currentMRR 變為 $projectedMRR（$delta）。",
  "es.insight.best_lever.title": "最佳槓桿：$name",
  "es.insight.best_lever.detail": "$description 可在 12 個月內增加 $delta/月（+$deltaPercent%）。",
  "es.action.grow_funnel": "擴大獲客漏斗",
  "es.flywheel.layer1": "你的數據",
  "es.flywheel.layer2": "同儕比較",
  "es.flywheel.layer3": "品類情報",
  "es.flywheel.layer4": "市場機會",
  "es.flywheel.unlock2": "解鎖同儕基準，看看類似 App 的表現",
  "es.flywheel.unlock3": "解鎖品類情報，看看競爭格局",
  "es.flywheel.unlock4": "解鎖市場機會，找到下一步大動作",
  "es.flywheel.unlocked": "你已解鎖所有洞見層級！",
};
