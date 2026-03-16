// ========================================
// 日本語翻訳（ビジネス敬体）
// ========================================

import type { TranslationDict } from "./index.ts";

export const ja: TranslationDict = {
  // ── ヘッダー / フッター ──
  "header.subtitle": "サブスクリプション健全性",
  "header.report_by": "rc-insights によるレポート",
  "header.subscription_health_report": "サブスクリプション健全性レポート",
  "header.generated": "生成日時",
  "footer.generated_by": "rc-insights により生成 — AI によるサブスクリプション健全性分析",
  "footer.generated_by_html": "<a href=\"https://github.com/nicething/rc-insights\">rc-insights</a> により生成 — RevenueCat Charts API 向け AI 分析ツール",

  // ── セクションタイトル ──
  "section.overview": "概要（直近28日間）",
  "section.overview_md": "概要",
  "section.health_score_chart": "健全性スコアチャート",
  "section.metrics_overview": "指標の概要",
  "section.anomalies": "異常検出",
  "section.recommendations": "主要な洞察と提案",
  "section.recommendations_md": "提案",
  "section.crystal_ball": "クリスタルボール予測",
  "section.strategy": "戦略分析",
  "section.strategy_analysis": "戦略分析",
  "section.next_product_ideas": "新プロダクトのアイデア",
  "section.agent_plan": "AI エージェントアクションプラン",
  "section.benchmarks": "SOSA 2026 業界ベンチマーク",
  "section.benchmark_reference": "ベンチマーク参考",

  // ── トレンドラベル ──
  "trend.growing": "成長中",
  "trend.stable": "安定",
  "trend.declining": "下降中",
  "trend.unknown": "不明",

  // ── トレンドラベル（アイコン付き、Markdown用）──
  "trend.growing_icon": "📈 成長中",
  "trend.stable_icon": "➡️ 安定",
  "trend.declining_icon": "📉 下降中",

  // ── ステータスラベル ──
  "status.healthy": "良好",
  "status.attention": "要注意",
  "status.critical": "要対応",

  // ── 影響レベル ──
  "impact.high": "高",
  "impact.medium": "中",
  "impact.low": "低",

  // ── テーブルヘッダー ──
  "table.metric": "指標",
  "table.value": "値",
  "table.status": "状態",
  "table.trend": "トレンド",
  "table.mom_change": "前月比",
  "table.benchmark": "ベンチマーク",
  "table.date": "日付",
  "table.ratio": "比率",
  "table.inflow": "流入",
  "table.outflow": "流出",
  "table.factor": "要因",
  "table.raw_value": "原データ",
  "table.score": "スコア",
  "table.weight": "ウェイト",
  "table.weighted": "加重",
  "table.month": "月",
  "table.base": "ベース",
  "table.optimistic": "楽観",
  "table.pessimistic": "悲観",
  "table.scenario": "シナリオ",
  "table.description": "説明",
  "table.mrr_12m": "12ヶ月MRR増分",
  "table.delta_pct": "変動%",
  "table.keyword": "キーワード",
  "table.trials": "トライアル数",
  "table.revenue": "収益",
  "table.conversion": "コンバージョン",
  "table.efficiency": "効率",
  "table.offering": "プラン",
  "table.name": "名前",
  "table.performance": "パフォーマンス",
  "table.median": "中央値",
  "table.top_25": "上位25%",
  "table.bottom_25": "下位25%",
  "table.action_id": "#",
  "table.action": "アクション",
  "table.mcp_tool": "MCPツール",
  "table.priority": "優先度",
  "table.expected_impact": "期待効果",
  "table.12m_impact": "12ヶ月インパクト",
  "table.pct_change": "変動 %",

  // ── 指標表示名 ──
  "metric.mrr": "月次経常収益",
  "metric.arr": "年次経常収益",
  "metric.churn": "解約率",
  "metric.trial_conversion_rate": "トライアル→有料",
  "metric.revenue": "収益",
  "metric.actives": "アクティブ購読者",
  "metric.customers_new": "新規顧客",
  "metric.trials_new": "新規トライアル",
  "metric.refund_rate": "返金率",
  "metric.ltv_per_customer": "顧客あたりLTV",

  // ── Quick Ratio ──
  "qr.title": "Quick Ratio",
  "qr.grade.excellent": "優秀",
  "qr.grade.healthy": "良好",
  "qr.grade.concerning": "要注意",
  "qr.grade.leaking": "流出中",
  "qr.grade.excellent_icon": "🟢 優秀",
  "qr.grade.healthy_icon": "🟢 良好",
  "qr.grade.concerning_icon": "🟡 要注意",
  "qr.grade.leaking_icon": "🔴 流出中",

  // ── PMF Score ──
  "pmf.title": "PMFスコア",
  "pmf.grade.strong": "強いPMF",
  "pmf.grade.approaching": "PMFに接近中",
  "pmf.grade.pre": "PMF前段階",
  "pmf.grade.no_signal": "PMFシグナルなし",
  "pmf.grade.strong_icon": "🟢 強いPMF",
  "pmf.grade.approaching_icon": "🟢 PMFに接近中",
  "pmf.grade.pre_icon": "🟡 PMF前段階",
  "pmf.grade.no_signal_icon": "🔴 PMFシグナルなし",
  "pmf.diagnosis_label": "診断",
  "pmf.verdict_label": "判定",
  "pmf.decision_label": "判断",
  "pmf.reasoning_label": "理由",

  // ── MRR 予測 ──
  "forecast.title": "MRR予測",

  // ── シナリオ分析 ──
  "scenario.title": "What-ifシナリオ",
  "scenario.best": "最適シナリオ",
  "scenario.best_scenario": "最適シナリオ",
  "scenario.vs_baseline": "12ヶ月後のベースラインとの比較",

  // ── 戦略 ──
  "strategy.keyword_analysis": "キーワード分析",
  "strategy.keyword_attribution": "キーワードアトリビューション",
  "strategy.offering_analysis": "プラン分析",
  "strategy.offering_performance": "プランパフォーマンス",

  // ── 異常 ──
  "anomaly.none": "分析期間中に異常は検出されませんでした。",
  "anomaly.on": "",

  // ── 提案 ──
  "rec.related": "関連指標",
  "rec.impact": "影響度",
  "rec.related_metric": "関連指標",

  // ── 新プロダクト ──
  "product.complexity": "複雑度",
  "product.source": "データソース",
  "product.evidence": "エビデンス",
  "product.direction.vertical": "↕️ バリューチェーンの上下展開",
  "product.direction.horizontal": "↔️ 横方向の拡大",
  "product.direction.adjacent": "🔀 新市場への参入",

  // ── AI エージェントプラン ──
  "agent.estimated_impact": "推定インパクト",
  "agent.estimated_total_impact": "推定合計インパクト",

  // ── ベンチマーク参考 ──
  "benchmark.description": "RevenueCat の **State of Subscription Apps 2026**（SOSA 2026）に基づいています：",
  "benchmark.trial_conversion": "トライアルコンバージョン",
  "benchmark.monthly_churn": "月次解約率",
  "benchmark.refund_rate": "返金率",
  "benchmark.mrr": "MRR",
  "benchmark.ltv_per_customer": "顧客あたりLTV",

  // ── その他 ──
  "misc.benchmark_label": "ベンチマーク",
  "misc.mom": "前月比",
  "misc.na": "N/A",
};
