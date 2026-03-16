# RevenueCat 生態系 API 整合研究報告

> 研究日期：2026-03-17
> 研究目的：找出 RevenueCat 生態系所有可整合 API，設計跨維度賺錢能力和神器功能

---

## 一、RevenueCat 自有 API 完整清單

### 1.1 REST API v2（核心 API）

| 領域 | 端點 | 功能 | 權限 | Rate Limit |
|------|------|------|------|------------|
| **Projects** | `GET /v2/projects` | 列出所有專案 | `project_configuration:projects:read` | 60/min |
| **Apps** | `GET/POST/PUT/DELETE /v2/projects/{id}/apps` | 建立/管理/刪除 App | `project_configuration:apps:*` | 60/min |
| **Customers** | `GET /v2/projects/{id}/customers/{cid}` | 取得單一客戶詳細資料 | `customer_information:customers:read` | 60/min |
| **Customers** | `GET /v2/projects/{id}/customers` | 列出客戶清單 | `customer_information:customers:read` | 60/min |
| **Active Entitlements** | `GET /v2/projects/{id}/customers/{cid}/active_entitlements` | 客戶目前有效權益 | `customer_information:customers:read` | 60/min |
| **Subscriptions** | `GET /v2/projects/{id}/customers/{cid}/subscriptions` | 客戶訂閱狀態（全 Store） | `customer_information:subscriptions:read` | 60/min |
| **Purchases** | `GET /v2/projects/{id}/customers/{cid}/purchases` | 客戶購買紀錄 | `customer_information:purchases:read` | 60/min |
| **Invoices** | `GET /v2/projects/{id}/customers/{cid}/invoices` | 客戶發票 | `customer_information:invoices:read` | 60/min |
| **Products** | `GET/POST /v2/projects/{id}/products` | 列出/建立產品 | `project_configuration:products:*` | 60/min |
| **Entitlements** | `GET/POST/PUT/DELETE /v2/projects/{id}/entitlements` | 權益 CRUD + 產品掛載/卸載 | `project_configuration:entitlements:*` | 60/min |
| **Offerings** | `GET/POST/PUT /v2/projects/{id}/offerings` | 供應項目 CRUD | `project_configuration:offerings:*` | 60/min |
| **Packages** | `GET/POST /v2/projects/{id}/offerings/{oid}/packages` | 套餐 CRUD | `project_configuration:packages:*` | 60/min |
| **Overview Metrics** | `GET /v2/projects/{id}/metrics/overview` | 專案總覽指標（MRR、Active 等） | `charts_metrics:overview:read` | 15/min |
| **Charts** | `GET /v2/projects/{id}/metrics/charts/{chart_name}` | 時間序列圖表數據 | `charts_metrics:charts:read` | 15/min |
| **Chart Options** | `GET /v2/projects/{id}/metrics/charts/{chart_name}/options` | 圖表可用篩選/分段維度 | `charts_metrics:charts:read` | 15/min |

**認證方式**: Bearer Token（v2 Secret Key 或 OAuth 2.0）
**Base URL**: `https://api.revenuecat.com/v2`
**費用**: 免費（含在 RevenueCat 方案中）

### 1.2 Charts API 可用圖表

| 圖表名稱 | 說明 | 關鍵指標 |
|----------|------|----------|
| `revenue` | 營收 | 總營收、退款後營收 |
| `mrr` | 月經常性收入 | MRR 金額 |
| `mrr_movement` | MRR 變動 | 新增/流失/升級/降級 |
| `arr` | 年經常性收入 | ARR 金額 |
| `customers_active` | 活躍客戶 | 付費活躍用戶數 |
| `customers_new` | 新客戶 | 新註冊用戶數 |
| `actives` | 活躍訂閱 | 活躍訂閱數量 |
| `actives_movement` | 活躍訂閱變動 | 新增/流失分解 |
| `actives_new` | 新訂閱 | 新訂閱數量 |
| `churn` | 流失率 | 月/週流失百分比 |
| `trials` | 試用 | 活躍試用數 |
| `trials_movement` | 試用變動 | 開始/轉換/過期 |
| `trials_new` | 新試用 | 新開始試用數 |
| `trial_conversion_rate` | 試用轉換率 | 試用→付費百分比 |
| `conversion_to_paying` | 付費轉換率 | 整體轉換率 |
| `ltv_per_customer` | 每客戶 LTV | 實現 LTV |
| `ltv_per_paying_customer` | 每付費客戶 LTV | 付費用戶 LTV |
| `refund_rate` | 退款率 | 退款百分比 |
| `subscription_retention` | 訂閱留存 | 留存曲線 |
| `subscription_status` | 訂閱狀態 | 狀態分佈 |
| `cohort_explorer` | 群組分析 | 群組留存/LTV |

### 1.3 Webhooks（即時事件）

| 事件類型 | 觸發時機 | 應用場景 |
|----------|----------|----------|
| `INITIAL_PURCHASE` | 首次購買 | 歡迎流程、歸因追蹤 |
| `RENEWAL` | 訂閱續訂 | 營收追蹤、客戶健康 |
| `CANCELLATION` | 取消訂閱 | 流失預警、挽回流程 |
| `UNCANCELLATION` | 取消後恢復 | 挽回成功追蹤 |
| `BILLING_ISSUE` | 帳單問題 | 自動催繳、風險警報 |
| `PRODUCT_CHANGE` | 產品變更（升/降級） | 升降級分析 |
| `NON_RENEWING_PURCHASE` | 一次性購買 | 購買追蹤 |
| `SUBSCRIPTION_PAUSED` | 訂閱暫停 | 暫停分析 |
| `SUBSCRIPTION_EXTENDED` | 訂閱延長 | 補償/促銷追蹤 |
| `EXPIRATION` | 訂閱到期 | 流失確認 |
| `TEMPORARY_ENTITLEMENT_GRANT` | Store 當機時臨時授權 | 容錯處理 |
| `VIRTUAL_CURRENCY_TRANSACTION` | 虛擬貨幣交易 | 消費追蹤 |
| `TEST` | 測試事件 | 整合測試 |

**延遲**: 大多數 5-60 秒，取消事件約 2 小時
**重試**: 失敗後重試最多 5 次
**費用**: Pro 方案以上
**2025 新增**: Webhook 現在包含 `experiments` 陣列，顯示用戶參與的實驗

### 1.4 MCP Server（AI Agent 操作）

| 工具類別 | 工具數量 | 可執行操作 |
|----------|----------|------------|
| **App 管理** | 6 | 列出/查看/建立/更新/刪除 App、列出 API Key |
| **Product 管理** | 2 | 列出/建立產品 |
| **Entitlement 管理** | 6 | 列出/查看/建立/更新/刪除權益、掛載/卸載產品 |
| **Offering 管理** | 3 | 列出/建立/更新供應項目 |
| **Package 管理** | 2 | 列出/建立套餐 |
| **Customer 管理** | 4+ | 查詢客戶、訂閱狀態、權益 |
| **Metrics** | 3+ | Overview 指標、圖表數據、圖表選項 |

**總計**: 26 個工具
**支援 IDE**: VS Code、Cursor、IntelliJ
**認證**: OAuth 自動流程
**費用**: 免費（Public Beta）

### 1.5 SDK（客戶端）

| 平台 | 語言/框架 | 支援 Store |
|------|-----------|------------|
| iOS | Swift/Obj-C | App Store |
| Android | Kotlin/Java | Google Play |
| Flutter | Dart | App Store + Google Play + Web |
| React Native | JavaScript/TypeScript | App Store + Google Play + Web |
| Web | JavaScript/TypeScript | Stripe / Paddle |
| Unity | C# | App Store + Google Play |
| Capacitor | TypeScript | App Store + Google Play |
| Cordova | JavaScript | App Store + Google Play |
| macOS | Swift | Mac App Store |
| Amazon | Kotlin | Amazon Appstore |
| Roku | BrightScript | Roku Channel Store |

### 1.6 Experiments（A/B 測試）

| 功能 | 說明 |
|------|------|
| A/B 測試 | 兩個 Offering 對比測試 |
| 多變量測試 | A/B/C/D 同時測試 |
| 全生命週期分析 | 試用→付費→續訂→LTV 完整追蹤 |
| Webhook 整合 | 事件包含實驗歸屬資訊 |
| 統計顯著性 | 自動計算信賴區間 |

**費用**: Pro & Enterprise

### 1.7 Targeting & Paywalls

| 功能 | 說明 |
|------|------|
| Paywalls | 遠端配置付費牆 UI，免更新 App |
| Offerings | 產品分組，動態展示 |
| Placements | 按 App 內位置分配不同 Offering |
| Targeting | 按自訂屬性定義受眾，投放個人化 Offering |
| Customer Attributes | 最多 50 個自訂屬性（40 字 key / 500 字 value） |

### 1.8 Customer Attributes API

| 端點 | 功能 |
|------|------|
| `POST /v1/subscribers/{id}/attributes` | 設定/更新/刪除客戶屬性 |
| SDK `setAttributes()` | 客戶端設定屬性 |
| Webhook 中自動帶入 | 事件攜帶客戶屬性 |
| 用於 Targeting | 基於屬性投放不同 Offering |
| 傳送至第三方 | Amplitude、Mixpanel、Segment 等 |

---

## 二、可對接第三方 API（按價值排序）

### 2.1 完整 API 清單

| # | API 名稱 | 類別 | 免費/付費 | 對接價值 | 與 RC 交叉洞見 |
|---|----------|------|-----------|----------|----------------|
| 1 | **Apple Search Ads API** | 廣告歸因 | 免費 | ★★★★★ | 關鍵字→訂閱→LTV 全鏈路 |
| 2 | **App Store Connect API** | Store 數據 | 免費 | ★★★★★ | 下載→試用→付費漏斗 + 審核數據 |
| 3 | **Google Play Console API** | Store 數據 | 免費 | ★★★★★ | RTDN + 報表 + 訂閱分析 |
| 4 | **Stripe API** | 支付 | 按交易量 | ★★★★★ | Web 訂閱 + 退款 + 催收分析 |
| 5 | **AppsFlyer API** | 歸因 | 付費（$0.05+/歸因） | ★★★★★ | 多管道歸因→LTV→ROAS |
| 6 | **Adjust API** | 歸因 | 付費 | ★★★★☆ | 廣告歸因→訂閱成本效益 |
| 7 | **Meta Ads API** | 廣告 | 免費 | ★★★★★ | 廣告花費→訂閱營收→ROAS |
| 8 | **Google Ads API** | 廣告 | 免費 | ★★★★★ | 搜尋廣告→訂閱→真實 ROAS |
| 9 | **Amplitude API** | 用戶分析 | 免費方案有限 | ★★★★☆ | 行為群組→訂閱轉換相關性 |
| 10 | **Mixpanel API** | 用戶分析 | 免費方案有限 | ★★★★☆ | 功能使用→付費意願預測 |
| 11 | **PostHog API** | 用戶分析 | 開源免費 | ★★★★☆ | Session Replay + 轉換漏斗 |
| 12 | **Segment CDP** | 數據平台 | 付費 | ★★★★☆ | 統一客戶資料管線 |
| 13 | **Firebase** | 分析/後端 | 免費 | ★★★★☆ | A/B Test + Analytics + 推播 |
| 14 | **Braze** | 客戶互動 | 付費（企業級） | ★★★★☆ | 訂閱狀態→個人化訊息觸發 |
| 15 | **Sensor Tower API** | 市場研究 | 付費（$25K+/年） | ★★★★★ | 競品訂閱數據 + 市場規模 |
| 16 | **Gemini API** | AI/LLM | 付費（按 token） | ★★★★★ | 智慧洞見生成 + 預測 |
| 17 | **Claude API** | AI/LLM | 付費（按 token） | ★★★★★ | 深度分析 + 報告生成 |
| 18 | **OpenAI API** | AI/LLM | 付費（按 token） | ★★★★☆ | 分析 + 文案生成 |
| 19 | **Slack API** | 通知 | 免費 | ★★★☆☆ | 即時營收警報 + 流失通知 |
| 20 | **Discord Webhooks** | 通知 | 免費 | ★★★☆☆ | 團隊警報 |
| 21 | **SendGrid API** | Email | 免費方案有限 | ★★★★☆ | 催繳信 + 挽回信 + 升級引導 |
| 22 | **Resend API** | Email | 免費 3K/月 | ★★★★☆ | 現代化 email 通知 |
| 23 | **Airship** | 推播 | 付費 | ★★★☆☆ | 推播→訂閱轉換 |
| 24 | **OneSignal** | 推播 | 免費方案有 | ★★★☆☆ | 推播→訂閱轉換 |
| 25 | **Zendesk API** | 客服 | 付費 | ★★★☆☆ | 客訴→流失相關性 |
| 26 | **Intercom API** | 客服 | 付費 | ★★★☆☆ | 對話→訂閱狀態 |
| 27 | **App Store Reviews** | 反饋 | 免費(API) / 付費(工具) | ★★★★☆ | 評論情感→流失預測 |
| 28 | **Chargebee API** | 計費 | 付費 | ★★★☆☆ | Web 訂閱對帳 |
| 29 | **mParticle** | CDP | 付費 | ★★★☆☆ | 事件路由 + 身份解析 |
| 30 | **CleverTap** | 用戶互動 | 付費 | ★★★☆☆ | 行為觸發→訂閱推動 |
| 31 | **AppFollow / Appbot** | 評論分析 | 付費 | ★★★★☆ | 評論情感 AI 分析 |
| 32 | **SimilarWeb API** | 市場研究 | 付費（企業級） | ★★★☆☆ | 競品流量數據 |
| 33 | **Paddle API** | 支付 | 按交易量 | ★★★☆☆ | Web 訂閱替代方案 |

### 2.2 RevenueCat 官方已支援的第三方整合

RevenueCat Dashboard 內建整合（事件自動轉發）：

| 類別 | 平台 | 費用層級 |
|------|------|----------|
| **歸因** | Adjust, AppsFlyer, Apple Search Ads, Meta, Tenjin | Pro+ |
| **分析** | Amplitude, Mixpanel, Firebase, Segment, mParticle | 部分免費 |
| **客戶互動** | Braze, Airship, OneSignal, CleverTap, Iterable | Pro+/Enterprise |
| **Webhook** | 自訂 URL | Pro+ |
| **支付** | Stripe, Paddle | 免費 |

---

## 三、飛輪四層對應

### Layer 1: 數據採集層（Data Ingestion）

> 目標：把所有訂閱相關數據統一收進來

| 數據源 | API | 收什麼 | 頻率 |
|--------|-----|--------|------|
| RevenueCat Charts API | Charts v2 | MRR/Churn/LTV/Revenue 等 21 張圖表 | 每日/每小時 |
| RevenueCat REST API v2 | REST v2 | 客戶/訂閱/購買/權益 | 即時 |
| RevenueCat Webhooks | Webhooks | 13 種訂閱生命週期事件 | 即時 |
| App Store Connect API | ASC API | 下載量/營收/評論/訂閱報表 | 每日 |
| Google Play Console API | GP API | 安裝/營收/RTDN/訂閱報表 | 即時+每日 |
| Apple Search Ads API | ASA API | 廣告花費/關鍵字/歸因 | 每日 |
| Stripe API | Stripe | Web 訂閱/支付/退款/催收 | 即時 |

**這層產出**: 統一數據湖，所有訂閱維度的原始數據
**可收費**: 數據接入費（SaaS 基礎費用）

### Layer 2: 洞見引擎層（Insight Engine）

> 目標：交叉數據產生別人看不到的洞見

| 交叉維度 | 用到的 API | 產出洞見 | 價值 |
|----------|------------|----------|------|
| 歸因 × 訂閱 | ASA + Meta/Google Ads + RC Charts | 每個廣告管道的真實 LTV，不是 D7 ROAS 而是 D365 LTV | 每月幫客戶省 $10K+ 廣告費 |
| 行為 × 留存 | Amplitude/Mixpanel + RC Webhooks | 哪些功能使用行為預測續訂/流失 | 流失率降低 5-15% |
| 評論情感 × 流失 | App Store Reviews + RC Churn | 負面評論爆發 → 流失率預警 | 提前 2-4 週預警 |
| 競品 × 定價 | Sensor Tower + RC Revenue | 競品定價變動 vs 自己的 MRR 影響 | 定價決策依據 |
| A/B 測試 × LTV | RC Experiments + RC LTV Charts | 不只看試用轉換，看 12 個月 LTV | A/B 測試真實ROI |
| Store 數據 × 轉換 | ASC/GP API + RC Conversion Charts | 下載→開啟→試用→付費完整漏斗 | 找出漏斗斷點 |
| 帳單問題 × 催收 | RC BILLING_ISSUE Webhook + SendGrid | 自動催繳 email → 挽回率 | 營收多回收 3-8% |

**這層產出**: 跨維度洞見報告、異常預警、趨勢預測
**可收費**: 洞見訂閱費（月費 $99-$499）

### Layer 3: 行動引擎層（Action Engine）

> 目標：洞見自動轉化為行動

| 觸發條件 | 行動 | 用到的 API | 效果 |
|----------|------|------------|------|
| 偵測到流失風險高 | 觸發個人化挽回 Offering | RC Targeting + Paywalls | 降低流失 |
| BILLING_ISSUE 事件 | 寄催繳信 + 推播 | RC Webhook + SendGrid + OneSignal | 恢復訂閱 |
| 試用即將到期 | 推播轉換提醒 | RC Webhook + Braze/Airship | 提高轉換率 |
| 競品降價 | 建議調整定價/Offering | Sensor Tower + RC MCP | 維持競爭力 |
| A/B 測試達顯著 | 自動推送勝出方案 | RC Experiments + RC REST API | 加速迭代 |
| LTV 預測高價值用戶 | 推送升級 Offering | AI API + RC Targeting | 提高 ARPU |
| 負面評論爆發 | Slack 警報 + 自動分析根因 | App Reviews + Gemini API + Slack | 快速回應 |

**這層產出**: 自動化工作流、智慧推薦、即時警報
**可收費**: 自動化費（月費 $199-$999 按動作量）

### Layer 4: 智慧顧問層（AI Advisory）

> 目標：AI 做「訂閱經濟顧問」

| 顧問功能 | 用到的 API | 產出 | 價值 |
|----------|------------|------|------|
| 定價策略顧問 | RC Charts + Sensor Tower + Claude/Gemini API | 個人化定價建議 + 模擬 | 取代 $10K+ 顧問費 |
| 流失預測模型 | RC Webhooks + Amplitude + AI API | 30 天內流失概率排名 | 精準挽回 |
| 營收預測 | RC Charts（歷史）+ AI API | 3/6/12 月營收預測 | 投資/融資依據 |
| 自動週報 | 所有 Layer 1-3 數據 + Claude API | 人話寫的營收分析週報 | 省 PM 每週 4-8 小時 |
| 上架策略 | ASC API + GP API + Sensor Tower + AI API | App Store 最佳化建議 | ASO 專家費 $5K+/月 |
| 付費牆優化 | RC Experiments + 用戶行為 + AI API | AI 設計 A/B 測試方案 | 轉換率提升 15-30% |

**這層產出**: AI 生成的策略建議、預測報告、自動化決策
**可收費**: AI 顧問費（月費 $499-$2999）

---

## 四、神器功能設計

### 神器 1: ROAS Truth Engine（真實 ROAS 引擎）

**用了哪些 API**:
- Apple Search Ads API（廣告花費 + 關鍵字歸因）
- Meta Ads API（FB/IG 廣告花費）
- Google Ads API（搜尋/UAC 廣告花費）
- AppsFlyer / Adjust API（多管道歸因）
- RevenueCat Charts API（LTV、Revenue、Cohort）
- RevenueCat Webhooks（即時事件流）
- Gemini/Claude API（分析 + 報告生成）

**產出什麼**:
- 每個廣告管道、每個 Campaign、每個關鍵字的 **真實 ROAS**
- 不是 D7 ROAS（大多數工具只能做到這裡），而是 D30 / D90 / D180 / D365 的長期 ROAS
- 實時更新：每天都能看到過去投的廣告，到今天為止的真實回報
- AI 自動建議：砍掉哪些 Campaign、加碼哪些關鍵字

**為什麼是神器**:
- **別人沒有**: 目前市面上沒有工具能把「廣告花費」和「長期訂閱 LTV」直接串起來。MMP（AppsFlyer/Adjust）只看安裝歸因，不追蹤 12 個月後的續訂。RevenueCat 有 LTV 但沒有廣告花費。只有把兩者合起來才有真實 ROAS。
- **做不到**: 需要同時接入廣告 API + 訂閱 API + 歸因 API，三條數據線在同一個用戶身上對齊，技術門檻極高。
- **市場痛點**: State of Subscription Apps 2026 報告顯示，App 數量暴增到每月 15,000 個新訂閱 App，廣告成本持續升高。知道真實 ROAS 的人才能活下來。

**商業價值**:
- 可以收費 $299-$999/月
- 對 RevenueCat 的價值：成為「訂閱經濟的 Google Analytics」，用戶不會離開

**實作複雜度**: High（多 API 歸因對齊是最難的部分）

---

### 神器 2: Churn Prediction + Auto-Rescue（流失預測 + 自動搶救）

**用了哪些 API**:
- RevenueCat Webhooks（BILLING_ISSUE, CANCELLATION 事件）
- RevenueCat Charts API（Churn, Retention 數據）
- RevenueCat REST API v2（客戶屬性 + 訂閱狀態）
- RevenueCat Targeting + Paywalls（動態付費牆）
- Amplitude / Mixpanel API（用戶行為數據）
- App Store Reviews（情感分析信號）
- SendGrid / Resend API（催繳 + 挽回信）
- OneSignal / Airship（推播通知）
- Claude / Gemini API（預測模型 + 個人化訊息）

**產出什麼**:
- **流失風險分數**: 每個用戶 0-100 的流失概率，提前 14-30 天預測
- **流失原因分類**: 價格太高 / 找到替代品 / 功能不滿足 / 忘記取消 / 帳單問題
- **自動搶救流程**:
  - 帳單問題 → 自動催繳信（3 封漸進式）
  - 價格敏感 → 推送折扣 Offering（via Targeting）
  - 功能不滿 → 推播新功能提醒
  - 即將到期 → 推送年度方案優惠
- **效果追蹤**: 每個搶救動作的成功率和 ROI

**為什麼是神器**:
- **別人沒有**: Adapty/Superwall 只做 Paywall A/B，不做預測。Braze 做互動但不懂訂閱數據。只有同時擁有訂閱數據 + 行為數據 + 行動能力的工具才做得到。
- **直接省錢**: 流失率降低 5% = 營收增加 25-30%（複利效應）。對一個月營收 $100K 的 App，這是每月 $25K-$30K 的價值。
- **AI 加持**: 不是規則引擎，是 AI 學習「什麼樣的人在什麼時候流失」，越用越準。

**商業價值**:
- 按挽回營收的 5-10% 收費（績效定價），或月費 $199-$799
- 對 RevenueCat 的價值：讓客戶的 MRR 持續成長 = RevenueCat 的 MTR 抽成也跟著成長

**實作複雜度**: Medium-High

---

### 神器 3: Market Intelligence Dashboard（市場情報看板）

**用了哪些 API**:
- Sensor Tower API / data.ai（競品下載量、營收估算、關鍵字排名）
- App Store Connect API（自己的下載量、營收、訂閱數據）
- Google Play Console API（自己的 Android 數據）
- RevenueCat Charts API（自己的 MRR、Churn、LTV）
- App Store Reviews API + AppFollow/Appbot（競品評論情感）
- Claude / Gemini API（分析 + 報告生成）

**產出什麼**:
- **競品訂閱追蹤器**: 追蹤同類別 Top 20 App 的訂閱定價變化
- **市場份額儀表板**: 自己 vs 競品的下載量/營收/評分趨勢
- **定價情報**: 競品改價格時即時通知 + AI 分析影響
- **評論情感對比**: 自己 vs 競品的用戶滿意度趨勢
- **AI 週報**: 每週自動生成市場情報摘要

**為什麼是神器**:
- **獨家組合**: Sensor Tower 有市場數據但要 $25K+/年，而且沒有你自己的真實訂閱數據。RevenueCat 有你的數據但沒有市場數據。合在一起 = 完整圖景。
- **決策加速器**: 競品降價→你要跟嗎？不用猜，看數據。
- **差異化壁壘**: 一般開發者用不起 Sensor Tower，但如果我們把關鍵數據包裝成 $99/月的服務，門檻大降。

**商業價值**:
- 月費 $99-$499（比直接買 Sensor Tower 便宜 90%）
- 對 RevenueCat 的價值：增加黏著度，用戶生態系統鎖定

**實作複雜度**: Medium（Sensor Tower API 是最大成本瓶頸）

---

### 神器 4: AI Revenue Copilot（AI 營收副駕駛）

**用了哪些 API**:
- RevenueCat MCP Server（26 個操作工具）
- RevenueCat Charts API（所有指標）
- RevenueCat REST API v2（客戶/訂閱管理）
- RevenueCat Experiments（A/B 測試）
- Claude / Gemini API（推理 + 生成）
- Slack API（報告推送）

**產出什麼**:
- **自然語言查詢**: 「上個月日本市場的年度訂閱轉換率比美國低多少？」→ AI 自動查數據回答
- **自動診斷**: 「為什麼這週 MRR 掉了 5%？」→ AI 分析所有維度找根因
- **策略建議**: 「我應該把年度方案從 $49.99 改到 $59.99 嗎？」→ AI 模擬影響
- **自動執行**: 「幫我建一個 A/B 測試，試試看 7 天試用 vs 14 天試用」→ AI 通過 MCP 自動設定
- **晨報/週報**: 每天早上 Slack 推送昨日關鍵指標 + AI 解讀

**為什麼是神器**:
- **MCP 是關鍵**: RevenueCat 自己推出了 MCP Server，意味著 AI Agent 可以直接操作 RevenueCat。我們是第一個把「讀數據」和「做操作」串在一起的工具。
- **不只看，還能做**: 其他分析工具只能看圖表。我們的 AI 看完圖表後，可以直接建 A/B 測試、改 Offering、調 Targeting。
- **越用越聰明**: AI 會學習這個 App 的模式，建議越來越精準。

**商業價值**:
- 月費 $299-$999（取代一個初級數據分析師 $5K/月）
- 對 RevenueCat 的價值：MCP 的殺手級應用場景，幫 RC 推 MCP 生態

**實作複雜度**: Medium（MCP 已存在，主要是 prompt engineering + 流程設計）

---

### 神器 5: Subscription Economy Benchmark（訂閱經濟基準線）

**用了哪些 API**:
- RevenueCat Charts API（匿名化聚合數據）
- RevenueCat State of Subscription Apps 報告數據
- App Store Connect API（類別排名）
- Sensor Tower API（市場基準）
- Claude / Gemini API（分析 + 報告）

**產出什麼**:
- **你在哪裡**: 你的 App 的每個指標 vs 同類別 P25/P50/P75/P90
  - 你的流失率 8% → 同類別中位數 6.5%，你在 P60，偏高
  - 你的試用轉換率 12% → 同類別中位數 8.5%，你在 P75，不錯
- **改進優先序**: AI 排出「改哪個指標 ROI 最高」
- **趨勢追蹤**: 每月更新，看自己是進步還是退步
- **目標設定**: AI 建議合理的 3/6/12 月目標

**為什麼是神器**:
- **只有 RevenueCat 做得到**: RC 處理 115,000+ 個 App 的 $16B+ 營收，擁有全球最大的訂閱數據池。State of Subscription Apps 2026 報告已經證明了他們的數據能力。
- **開發者渴望**: 「我的流失率 8% 算高嗎？」這是每個開發者最想知道但找不到答案的問題。
- **網路效應**: 越多 App 加入，基準線越準，吸引更多 App 加入。

**商業價值**:
- 基礎版免費（吸引用戶），進階版 $49-$199/月
- 對 RevenueCat 的價值：最強獲客工具 + 數據護城河

**實作複雜度**: Low-Medium（數據 RC 已有，需要匿名化 + UI）

---

## 五、RevenueCat 商業論述

### 5.1 為什麼這個工具能幫 RevenueCat 賺更多錢

**RevenueCat 的商業模式**: 按 MTR（Monthly Tracked Revenue）抽成 0.8%-1%

這意味著：**客戶的營收成長 = RevenueCat 的營收成長**

| 論述維度 | 說明 | 量化影響 |
|----------|------|----------|
| **客戶營收成長** | ROAS Truth Engine 讓客戶把廣告預算花在真正賺錢的管道 → MRR 成長 | MTR↑ = RC 抽成↑ |
| **降低流失** | Churn Prediction 幫客戶留住訂閱者 → MRR 不掉 | 流失率降 5% ≈ 營收多 25% |
| **提高轉換** | AI Copilot 幫客戶優化 Paywall/Offering → 試用→付費轉換率↑ | 轉換率↑10% = MRR↑10% |
| **增加黏著** | Market Intelligence + Benchmark 讓客戶離不開 | Churn of RC itself ↓ |
| **生態鎖定** | 越多 API 整合，遷移成本越高 | 護城河加深 |
| **推動升級** | 進階功能需要 Pro/Enterprise 方案 | ARPU↑ |

### 5.2 市場背景（State of Subscription Apps 2026）

| 指標 | 數據 | 含義 |
|------|------|------|
| 新訂閱 App 數量 | 15,000/月（vs 2022 年 2,000/月） | 競爭爆炸，工具價值↑ |
| Top 25% 成長率 | +80% YoY | 贏家通吃，好工具幫你進 Top 25% |
| Bottom 25% | -33% YoY | 沒工具的會被淘汰 |
| AI App 轉換率 | 比非 AI 高 52% | AI App 浪潮帶來更多客戶 |
| AI App 留存 | 年訂閱取消快 30% | AI App 更需要流失防護 |
| Paywall vs Freemium | Paywall 轉換率高 6x | Paywall 工具需求↑ |
| 2020 前 App 營收佔比 | 69% | 老 App 是主要營收來源，需要優化工具 |

### 5.3 競爭護城河

| 我們有的 | 競品沒有的 | 護城河深度 |
|----------|------------|------------|
| RevenueCat 全 API 整合 | Adapty/Superwall 只有自己的數據 | ★★★★★ |
| MCP Server 操作能力 | 其他工具只能看不能做 | ★★★★★ |
| 跨廣告管道 ROAS | MMP 不追蹤長期 LTV | ★★★★☆ |
| AI 驅動自動化 | 大多數工具還是手動看圖表 | ★★★★☆ |
| 匿名化基準數據 | 只有 RC 有 115K+ App 數據池 | ★★★★★ |
| 端到端（數據→洞見→行動→AI顧問）| 其他都是單點工具 | ★★★★★ |

### 5.4 實作優先序建議

| 優先序 | 功能 | 理由 | 所需時間 |
|--------|------|------|----------|
| P0 | Layer 1 數據採集 + Charts API 整合 | 基礎，其他都依賴它 | 2-4 週 |
| P1 | AI Revenue Copilot（基礎版） | MCP 是現成的，最快有 wow factor | 3-6 週 |
| P2 | Churn Prediction + Auto-Rescue | 直接省錢，客戶感受最強 | 6-10 週 |
| P3 | ROAS Truth Engine | 價值最高但複雜度也最高 | 8-12 週 |
| P4 | Subscription Benchmark | 獲客利器，可以先做免費版 | 4-6 週 |
| P5 | Market Intelligence | Sensor Tower API 成本高，可後做 | 6-8 週 |

---

## 六、附錄：API 整合技術細節

### 6.1 認證方式一覽

| API | 認證方式 | 取得方式 |
|-----|----------|----------|
| RevenueCat REST API v2 | Bearer Token (API Key / OAuth) | RC Dashboard |
| RevenueCat Webhooks | Webhook URL + 簽名驗證 | RC Dashboard |
| App Store Connect API | JWT (ES256) | Apple Developer Portal |
| Google Play Console API | Service Account (OAuth 2.0) | Google Cloud Console |
| Apple Search Ads API | OAuth 2.0 | Apple Search Ads Console |
| Meta Ads API | OAuth 2.0 + Access Token | Meta for Developers |
| Google Ads API | OAuth 2.0 + Developer Token | Google Ads API Center |
| Stripe API | API Key (sk_live_xxx) | Stripe Dashboard |
| Amplitude API | API Key + Secret Key | Amplitude Dashboard |
| Mixpanel API | Service Account + Project Token | Mixpanel Settings |
| Sensor Tower API | API Key | Sensor Tower (需商務聯繫) |
| Slack API | Bot Token / Webhook URL | Slack API Dashboard |
| SendGrid API | API Key | SendGrid Dashboard |
| Claude API | API Key | Anthropic Console |
| Gemini API | API Key | Google AI Studio |

### 6.2 Rate Limit 注意事項

| API | Rate Limit | 應對策略 |
|-----|------------|----------|
| RevenueCat Charts | 15/min | 快取 + 排程批次 |
| RevenueCat REST | ~60/min | 排隊 + 指數退避 |
| App Store Connect | 不公開（約 20/min） | 快取 + 每日批次 |
| Meta Ads | 按帳號級別（200-5000/hr） | 批次查詢 + 快取 |
| Google Ads | 15,000/day | 日批次足夠 |
| Sensor Tower | 按方案 | 日批次 + 快取 |
| Claude API | 按方案（40-4000 RPM） | 排隊 + 降級策略 |

### 6.3 成本估算

| 項目 | 月費估算 | 備註 |
|------|----------|------|
| RevenueCat（Pro） | $0-$500+ | 按 MTR 0.8-1% |
| Sensor Tower API | $2,000-$3,000/月 | 企業級最低 |
| Claude API | $50-$500/月 | 按使用量 |
| Gemini API | $30-$300/月 | 按使用量 |
| SendGrid | $0-$89/月 | 免費方案 100/day |
| AppsFlyer | $0-$500+/月 | 按歸因量 |
| PostHog | $0-$200/月 | 開源可自架 |
| **總計基礎** | **$100-$500/月** | 不含 Sensor Tower |
| **總計進階** | **$2,500-$5,000/月** | 含 Sensor Tower |

---

## 七、研究來源

- [RevenueCat Developer API v2](https://www.revenuecat.com/docs/api-v2)
- [RevenueCat Charts Overview](https://www.revenuecat.com/docs/dashboard-and-metrics/charts)
- [RevenueCat Webhooks - Event Types and Fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
- [RevenueCat MCP Server](https://www.revenuecat.com/docs/tools/mcp)
- [RevenueCat MCP Tools Reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference)
- [Introducing RevenueCat MCP](https://www.revenuecat.com/blog/company/introducing-revenuecat-mcp/)
- [RevenueCat Experiments](https://www.revenuecat.com/docs/tools/experiments-v1)
- [RevenueCat Third Party Integrations](https://www.revenuecat.com/docs/integrations/third-party-integrations)
- [RevenueCat Targeting](https://www.revenuecat.com/docs/tools/targeting)
- [RevenueCat Paywalls](https://www.revenuecat.com/docs/tools/paywalls)
- [RevenueCat Customer Attributes](https://www.revenuecat.com/docs/customers/customer-attributes)
- [RevenueCat Pricing](https://www.revenuecat.com/pricing/)
- [State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps/)
- [State of Subscription Apps 2026 Business](https://www.revenuecat.com/state-of-subscription-apps-2026-business/)
- [What you can do with RevenueCat's new REST API](https://www.revenuecat.com/blog/engineering/were-rebuilding-our-rest-apis/)
- [RevenueCat REST API v2 - New Functionality](https://www.revenuecat.com/release/new-rest-api-v2-functionality-app-management-overview-metrics-2023-11-02)
- [Apple Search Ads Attribution API](https://searchads.apple.com/help/reporting/0028-apple-ads-attribution-api)
- [Apple Search Ads & RevenueCat Integration](https://www.revenuecat.com/docs/integrations/attribution/apple-search-ads)
- [App Store Connect API Overview](https://developer.apple.com/app-store-connect/api/)
- [App Store Connect - Optimize your monetization (WWDC25)](https://developer.apple.com/videos/play/wwdc2025/252/)
- [Google Play Developer APIs](https://developer.android.com/google/play/developer-api)
- [Google Real-Time Developer Notifications](https://developer.android.com/google/play/billing/rtdn-reference)
- [Sensor Tower - API Integrations](https://sensortower.com/product/connect)
- [Sensor Tower acquires data.ai](https://sensortower.com/blog/data-ai-joins-sensor-tower)
- [Stripe Billing Analytics](https://docs.stripe.com/billing/subscriptions/analytics)
- [AppsFlyer & RevenueCat Integration](https://www.revenuecat.com/docs/integrations/attribution/appsflyer)
- [RevenueCat & Segment Integration](https://www.revenuecat.com/docs/integrations/third-party-integrations/segment)
- [PostHog - GitHub](https://github.com/PostHog/posthog)
- [SaaStr - Top 10 Learnings from State of Subscription Apps](https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth/)
- [RevenueCat MCP on X/Twitter](https://x.com/RevenueCat/status/1973027335801623015)
- [Apptweak - App Review Sentiment Analysis](https://www.apptweak.com/en/aso-blog/use-app-review-sentiment-analysis-to-make-product-decisions)
- [SendGrid API Reference](https://www.twilio.com/docs/sendgrid/api-reference)
