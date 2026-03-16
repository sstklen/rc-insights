# rc-insights — Process Log

> This document records the real development journey: what we built, what broke, what we learned.
> Written for RevenueCat's hiring team to see how we think, debug, and iterate.

---

## Phase 0: Research & Strategy (21:00 - 23:00 JST)

- Read the full job description and identified the core thesis: RevenueCat needs someone who deeply understands both the API and the developer experience
- Studied the Charts API v2 documentation, noted the REST patterns and rate limiting (15 req/min for charts, 60/min for REST)
- Read the SOSA 2026 report to extract benchmark data (trial conversion, churn, MRR thresholds)
- Decided on the tool concept: an automated subscription health analyzer that benchmarks against SOSA 2026 data
- Key insight: Building a real tool against the real API would surface genuine product feedback — much more valuable than theoretical suggestions

**4-AI Research Squad deployed:**
- Claude: Deep API type analysis and architecture design
- Gemini: Community sentiment, competitor landscape (Adapty, Superwall, Qonversion)
- Grok: RevenueCat CEO vision research → discovered "Part 2" strategy: subscription API → app revenue OS
- Codex: Rapid prototyping of API client

---

## Phase 1: Tool Foundation (23:00 - 00:30 JST)

### 1.1 Project Scaffolding
- TypeScript CLI with Commander.js + Chalk + Ora
- RevenueCat API client with rate limiting (15 req/min) and automatic retry on 429
- Three output formats: Terminal, HTML (standalone with embedded CSS), Markdown, JSON

### 1.2 Bug 1: `projects` vs `items`
- **Expected:** `response.projects[]`
- **Got:** `response.items[]`
- **Fix:** 5 minutes, but the lesson: always test API responses before writing types
- **Their issue:** Response uses `items` (generic list pattern) but the resource name is "projects"

### 1.3 Bug 2: Multi-Measure Confusion (Churn showed 2535%)
- Churn chart has 3 measures: Actives (#), Churned (#), Churn Rate (%)
- Initially pulled measure=0 (Actives count) → displayed "Churn: 2535%"
- **Fix:** Created `getPrimaryMeasureIndex()` — finds `chartable=true && unit="%"` measures
- **Their issue:** No documentation on which measure is "primary" in multi-measure charts

### 1.4 Bug 3: Seasonal MoM Distortion
- Revenue MoM showed -36.2% (Jan→Feb drop after holiday spike)
- PMF Score used this → scored 0/100 for Revenue Growth → total dragged to 42/100
- **Fix:** Used MRR's MoM (+0.4%) instead of Revenue's MoM — MRR is structurally more stable
- **Lesson:** Seasonal artifacts can poison composite scores

### 1.5 Product Feedback Discovered
1. **Chart endpoint naming:** Docs say `active_subscriptions`, API uses `actives`
2. **Multi-measure ambiguity:** No clear indication of "primary" visualization metric
3. **Projects field naming:** Response uses `items`, resource is "projects"
4. **No benchmark API:** SOSA 2026 data published in reports but not queryable via API

---

## Phase 2: Crystal Ball — From Data to Predictions (00:30 - 03:00 JST)

### What We Built
- **Quick Ratio:** (New + Resub + Expansion) / (Churned + Contraction) → Dark Noise = 1.05 (treading water)
- **PMF Score:** 5-factor weighted score (0-100) → 49.9/100 (Pre-PMF)
- **MRR Forecast:** 6-month projection with seasonality + 3 scenarios
- **What-If Scenarios:** Fix Churn (+26.5%) / Scale Acquisition (+27%) / Price Optimization (+20%)
- **Executive Summary:** Distilled top-of-report insights with health score

### The "Three Directions" Framework
Every app can grow in three directions — this idea came directly from the operator:
1. **Vertical (↕️):** Go deeper (premium tier / SDK / hardware)
2. **Horizontal (↔️):** Add adjacent features (meditation / focus timer)
3. **Adjacent (🔀):** Jump to new market (baby sleep app)

### Decision Matrix
| PMF Score | Quick Ratio | Verdict |
|-----------|-------------|---------|
| ≥60 | >1.3 | 🚀 Double Down |
| ≥60 | 0.9-1.3 | 🔧 Optimize |
| <60 | >1.3 | 🔧 Fix Leaks |
| <60 | 0.9-1.3 | 🔄 Pivot |
| Any | <0.9 | 🚪 Harvest |

---

## Phase 3: Systems Integration — The Full Stack (03:00 - 06:00 JST)

### Multi-Agent Parallel Construction
Deployed 7+ specialized agents working in parallel:

| Agent | Task | Files | Lines |
|-------|------|-------|-------|
| CARD-01 | Quick Ratio + PMF Score | 3 files | 628 |
| CARD-02 | MRR Forecast + Scenarios | 2 files | 565 |
| CARD-03 | Keyword + Offering Analysis | 2 files | 512 |
| CARD-04 | LLM Intelligence Layer | 3 files | 813 |
| Flywheel | 4-layer insight engine | 1 file | 600 |
| Monitor | Scheduled analysis + SQLite | 1 file | 450 |
| API Server | HTTP API (Bun.serve) | 1 file | 300 |
| i18n | EN/ZH/JA translations | 4 files | 600 |
| Report Renderers | Crystal Ball + Flywheel display | 3 files | ~800 |

### LLM Integration
- Three providers: Gemini (cheapest, primary) → Anthropic → OpenAI
- Auto-fallback to rule engine when all LLM providers fail
- JSON mode for structured output (Gemini `responseMimeType: 'application/json'`)
- Agent Plan Mode: generates MCP Server action plans without executing (read-only API key)

### The Flywheel: Four Layers of Insight

```
Layer 1 (Free)  → Your own data + Three-Direction thinking
Layer 2 ($)     → How do similar apps perform? (Peer benchmarks)
Layer 3 ($)     → What's your competitive landscape? (Category intel)
Layer 4 ($)     → Where are the blue oceans? (Market opportunities)
```

Each layer uses more API calls, generates more value, justifies higher pricing.

**The "Gold Data" concept:** Internal data × External data = directly monetizable insights. Not just "your churn is high" but "auto-detect → auto-push half-price Offering → user renews → +$317/month MRR."

---

## Phase 4: The Vision — External Data as Keys

### 5 Killer Cross-API Integrations Identified

1. **ROAS Truth Engine:** Ad spend (ASA/Meta/Google) × Long-term LTV (RevenueCat) = Real D365 ROAS
2. **Churn Prediction + Auto-Rescue:** Behavior data (Mixpanel) + Subscription lifecycle (RC Webhooks) → Predict → Auto-trigger win-back Offering (MCP Server)
3. **Competitive Intelligence:** Sensor Tower market data × RC pricing data = positioning strategy
4. **AI Revenue Copilot:** Natural language → Data query → MCP execution = See + Do in one step
5. **Subscription Benchmark:** Your metrics vs 115K app distribution (only RC has this data)

### Why This Matters for RevenueCat
RevenueCat charges by MTR (Monthly Tracked Revenue). Tools that help customers grow their revenue = RevenueCat grows too. This is a **positive-sum flywheel**, not a zero-sum game. Every dollar of MRR our tool helps recover or create = RevenueCat's revenue grows proportionally.

---

## Final Statistics

| Metric | Value |
|--------|-------|
| TypeScript Files | 29 |
| Lines of Code | 9,024 |
| TSC Errors | 0 |
| API Calls per Run | 24 |
| Output Formats | 4 (Terminal + HTML + MD + JSON) |
| Languages | 3 (EN / 繁體中文 / 日本語) |
| CLI Commands | 3 (analyze, monitor, serve) |
| Chart Endpoints Used | 14/21 |
| Segment Dimensions | attribution_keyword, offering_identifier |
| LLM Providers | 3 (Gemini, Anthropic, OpenAI) |
| Flywheel Layers | 4 |
| Parallel Agents | 7+ |
