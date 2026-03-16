# LLM Model Comparison Report

> rc-insights 使用同一份 Dark Noise 真實數據，比較三種引擎的建議品質
> Date: 2026-03-17

## Test Setup

- Data: Dark Noise (MRR $4,562, Churn 6.7%, Trial Conv 47.4%, QR 1.05)
- Same prompt (SYSTEM_PROMPT + buildAnalysisPrompt)
- Same RevenueCat API data

---

## Results Summary

| | Gemini 2.0 Flash | Gemini 2.5 Pro | Rule Engine |
|---|---|---|---|
| **延遲** | 5.6 秒 | 30.6 秒 | <1 毫秒 |
| **Token** | 1,159 | 1,241 | 0 |
| **建議數** | 3 | 3 | 5 |
| **成本** | ~$0.001 | ~$0.01 | $0 |
| **App-specific** | ✅ 是 | ✅ 是 | ❌ 通用模板 |
| **有數字** | ✅ 有預估 MRR | ✅ 有預估 MRR | ❌ 無 |
| **戰略深度** | 中 | 高 | 高（手寫） |

---

## Top Recommendations Comparison

### #1 Priority Recommendation

| Model | Title | Impact |
|-------|-------|--------|
| **Flash** | Address February Revenue Drop | Recover -$1,650 MRR within 1 month |
| **Pro** | Reduce Churn with a Cancellation Flow | +$300-500 MRR within 4 months |
| **Rule** | Unusual drop in Revenue | (no $ estimate) |

**分析**: Flash 注意到了 Revenue 下跌（季節性），給了具體挽回數字。Pro 跳過季節性問題，直接打長期策略（cancellation flow）。Rule Engine 也偵測到異常但沒有深度。

### #2 Priority

| Model | Title | Impact |
|-------|-------|--------|
| **Flash** | Improve Quick Ratio by Reducing Churn | +$300-600 MRR / 3 months |
| **Pro** | Improve Annual Renewals | +$250-450 MRR / 6 months |
| **Rule** | Churn elevated — retention actions | (strategy: shift to annual pricing) |

**分析**: 三個模型都指向 churn 是核心問題。但切入角度不同：Flash 直球「降流失」，Pro 更精準「年費續約」，Rule Engine 的手寫戰略最深（「月費用戶每月重新決定，改年費繞過 11 個決策點」）。

### #3 Priority

| Model | Title | Impact |
|-------|-------|--------|
| **Flash** | Optimize Annual Subscription Promotion | +$200-400 MRR / 3 months |
| **Pro** | Increase Annual Plan Adoption on Paywall | +$200-350 MRR / 6 months |
| **Rule** | Strong trial conversion — invest in acquisition | (strategy: expand market 10x) |

**分析**: Flash 和 Pro 不約而同推年費方案。Rule Engine 走不同路——利用已驗證的轉換率去擴大市場。

---

## Key Findings

### 1. LLM 比 Rule Engine 好在哪
- **App-specific**: LLM 知道這是 Dark Noise（音頻 App），能建議「Premium Soundscape Packs」
- **有數字**: 每個建議附預估 MRR 影響（$300-600/月），Rule Engine 沒有
- **有步驟**: 附 action steps（1-2-3-4），Rule Engine 的戰術步驟比較死板

### 2. Rule Engine 比 LLM 好在哪
- **速度**: <1ms vs 5-30 秒
- **成本**: $0 vs $0.001-0.01/次
- **可靠**: 100% 一致，不會幻覺
- **戰略深度**: 手寫的根因分析比 LLM 更深（「月費用戶每月重新做決定」vs LLM 只說「reduce churn」）
- **可離線**: 不需要網路

### 3. Pro vs Flash
- Pro 延遲 6 倍（30s vs 5s），但建議品質只略好
- Pro 更注重長期（6 個月 horizon），Flash 偏短期（1-3 個月）
- 對這個 use case，**Flash 的性價比更好**

### 4. 最佳組合
**Rule Engine 做戰略 + LLM 做戰術** = 最強組合

Rule Engine 的手寫根因分析（「為什麼會有這個問題」）+ LLM 的 app-specific 數字和步驟（「具體做什麼、預計多少錢」）= 兩全其美。

這正是 rc-insights 目前的架構：Rule Engine 永遠跑、LLM 有 key 時增強。

---

## Cost Analysis

| 使用頻率 | Flash 月費 | Pro 月費 |
|---------|-----------|---------|
| 1 次/天 | ~$0.03/月 | ~$0.30/月 |
| 1 次/週 | ~$0.004/月 | ~$0.04/月 |
| 100 次/天（SaaS） | ~$3/月 | ~$30/月 |

**結論**: Flash 的成本可以忽略不計。即使大規模使用也低於 $5/月。

---

## Opus 4.6 Direct Analysis (Benchmark)

Claude Opus 4.6 不走 API，直接用推理能力分析 Dark Noise 數據。作為最高品質基準。

| # | Title | Impact | Confidence |
|---|-------|--------|------------|
| 1 | **Shift to Annual-First Pricing** | +$800-1,200/月 / 6 months | high |
| 2 | **Build Cumulative Value (Sleep Data)** | +$400-700/月 / 9 months | medium |
| 3 | **Enter Baby Sleep Market** | +$1,500-3,000/月 / 12 months | medium |
| 4 | **Fix Involuntary Churn** | +$150-300/月 / 1 month | high |
| 5 | **Seasonal Campaign Strategy** | +$500-1,000/年 | medium |

### Opus vs Gemini 的關鍵差異

| 維度 | Gemini Flash/Pro | Opus |
|------|-----------------|------|
| **根因分析** | 表面（「reduce churn」） | 結構性（「月費用戶每月重新決定，App Day 1 就用完了」） |
| **行動等級** | 戰術（「A/B test paywall」） | 戰略（「改定價架構」「建累積價值」「進新市場」） |
| **數字精度** | 有但保守（$300-600） | 有且有推理過程（「2,537 subs × 30% 轉年費 → 有效 churn 從 6.7% 降到 4.2%」） |
| **App-specific** | 中（知道是音頻 App） | 高（知道白噪音 Day 1 用完、嬰兒市場 ARPU 3x） |
| **商業模式思考** | 無 | 有（「年費繞過 11 個月度決策點」「累積數據 = 轉換成本」） |

### 結論

**Opus 的分析品質明顯高於 Gemini**，但 Opus 的「成本」是不可量化的（它是直接推理，不是 API call）。

最佳實務：
1. **生產環境用 Gemini Flash**（$0.001/次，5 秒，品質夠用）
2. **關鍵決策用 Opus 思維**（寫進規則引擎的戰略模板）
3. **Rule Engine 永遠兜底**（零成本、零延遲、零依賴）

也就是說：**Opus 的智慧已經固化在規則引擎的 strategy 欄位裡了**。每次 Gemini 生成建議時，規則引擎的戰略分析已經在旁邊提供根因分析。兩者互補。
