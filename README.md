# rc-insights

> AI-powered subscription health analysis for RevenueCat

## What it does

rc-insights connects to the RevenueCat Charts API v2, pulls your subscription metrics, and generates a full diagnostic report: health scores, trend detection, anomaly alerts, MRR forecasts, what-if scenarios, and AI-powered growth recommendations. Think of it as a doctor for your subscription business -- it reads the labs, makes a diagnosis, writes a prescription, and predicts the prognosis.

**Feature highlights:**

- 14 metrics analyzed against SOSA 2026 benchmarks
- Crystal Ball predictions (Quick Ratio, PMF Score, MRR Forecast, What-If Scenarios)
- Four-layer Flywheel insight engine
- LLM-powered recommendations with multi-provider fallback
- Continuous monitoring with anomaly alerting
- HTTP API server for programmatic access
- Trilingual output (English, Chinese, Japanese)

## Quick Start

```bash
# 1. Install dependencies
git clone https://github.com/sstklen/rc-insights.git
cd rc-insights
bun install

# 2. Run analysis
bun run src/index.ts analyze --api-key YOUR_REVENUECAT_V2_KEY

# 3. View your reports
#    Terminal output appears immediately.
#    HTML, Markdown, and JSON reports are saved to ./rc-insights-report/
```

**Getting your API key:** RevenueCat Dashboard > Project Settings > API Keys > V2 Secret Key (starts with `sk_`).

## Features

### Health Report

Analyzes 14 subscription metrics, each scored against industry benchmarks from the State of Subscription Apps 2026 report. Metrics are rated green (healthy), yellow (attention), or red (critical) with month-over-month trend detection and anomaly flagging.

| Metric | What It Measures |
|--------|-----------------|
| `mrr` | Monthly Recurring Revenue |
| `mrr_movement` | MRR breakdown: New / Churned / Expansion / Contraction |
| `arr` | Annual Recurring Revenue |
| `churn` | Monthly churn rate |
| `trial_conversion_rate` | Trial to paid conversion |
| `revenue` | Total revenue |
| `actives` | Active subscribers |
| `subscription_status` | Subscription state distribution |
| `customers_new` | New customers |
| `trials_new` | New trial starts |
| `refund_rate` | Refund rate |
| `ltv_per_customer` | Lifetime value per customer |
| `ltv_per_paying_customer` | LTV per paying customer |
| `conversion_to_paying` | Overall conversion to paying |

### Crystal Ball

Predictive analytics built from your own data:

- **Quick Ratio** -- (New + Resubscription + Expansion MRR) / (Churned + Contraction MRR). Tells you if your subscription base is growing or shrinking, graded from "leaking" to "excellent."
- **PMF Score** -- A 0-100 Product-Market Fit score combining trial conversion, churn, Quick Ratio, revenue growth, and LTV. Includes a decision matrix: Double Down / Optimize / Pivot / Harvest & Explore.
- **MRR Forecast** -- 6-month and 12-month projections with base, optimistic (+2%/mo), and pessimistic (-2%/mo) scenarios, adjusted for seasonality.
- **What-If Scenarios** -- Three simulations: Fix Churn (reduce to 4%), Scale Acquisition (50% more trials), Price Optimization (20% ARPU lift). Each shows projected MRR at 3/6/12 months.

### Flywheel Engine

Four-layer insight system that starts with what you have and shows what you could unlock:

| Layer | Name | Cost | Insights |
|-------|------|------|----------|
| 1 | Your Data | Free | Three-thinking framework: Vertical (dig into causes), Lateral (cross-metric comparison), Leap (reframe problems as opportunities) |
| 2 | Peer Comparison | $ | How apps with similar MRR outperform you |
| 3 | Category Intelligence | $ | Category-specific pricing, trial length, retention benchmarks |
| 4 | Market Opportunity | $ | Adjacent verticals, geographic expansion, bundling |

Each insight includes actionable descriptions, RevenueCat Dashboard deep links, MCP tool actions, and estimated revenue impact.

### Strategy Analysis

- **Keyword Attribution** -- Segments revenue, trials, and conversion rates by Apple Search Ads keyword. Classifies each keyword as high/medium/low efficiency with recommendations.
- **Offering A/B Analysis** -- Compares different Offerings (paywalls/packages) by revenue, conversion rate, and trial performance.

### Next Product Suggestions

Three thinking modes for growth ideas:

- **Vertical** -- Go deeper into what you already do
- **Lateral** -- What adjacent problems can you solve
- **Leap** -- Non-linear moves (new markets, new business models)

### AI Agent

When an LLM API key is provided (Gemini, Anthropic, or OpenAI), the tool generates:

- Enhanced recommendations with specific action steps, expected impact, and timelines
- Next Product suggestions using the three-thinking framework
- Agent Action Plans with MCP tool mappings for automated execution

Supports multi-provider fallback: Gemini (priority) > Anthropic > OpenAI. Falls back to a rule engine when no LLM key is available.

### Monitor

Continuous subscription health monitoring with anomaly alerting:

```bash
bun run src/index.ts monitor --api-key YOUR_KEY --interval 6h --alert terminal
```

Tracks MRR, churn, Quick Ratio, and anomaly count over time. Stores snapshots in SQLite (`~/.rc-insights/monitor.db`). Alerts on significant changes: MRR swing >5%, churn spike >1pp, Quick Ratio dropping below 1.0.

Alert channels: terminal (built-in), slack (placeholder), email (placeholder).

### API Server

HTTP API mode for programmatic access:

```bash
bun run src/index.ts serve --port 3100
```

### Trilingual Output

Reports are generated in English (`en`), Chinese (`zh`), or Japanese (`ja`):

```bash
bun run src/index.ts analyze --api-key YOUR_KEY --lang ja
```

## CLI Reference

### `analyze` -- Run full analysis

```bash
bun run src/index.ts analyze --api-key <key> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key <key>` | RevenueCat v2 API key (required) | -- |
| `--project-id <id>` | Project ID (auto-detects if omitted) | First project |
| `--format <format>` | Output: `terminal`, `html`, `md`, `all` | `all` |
| `--output <dir>` | Output directory for report files | `./rc-insights-report/` |
| `--llm-key <key>` | Gemini/Anthropic/OpenAI API key for AI insights | -- |
| `--llm-model <model>` | LLM model override | Auto-detect by provider |
| `--lang <lang>` | Report language: `en`, `zh`, `ja` | `en` |
| `--verbose` | Enable debug logging | `false` |

### `monitor` -- Continuous monitoring

```bash
bun run src/index.ts monitor --api-key <key> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key <key>` | RevenueCat v2 API key (required) | -- |
| `--project-id <id>` | Project ID (auto-detects if omitted) | First project |
| `--interval <interval>` | Check interval: `30m`, `6h`, `1d` | `6h` |
| `--alert <channel>` | Alert channel: `terminal`, `slack`, `email` | `terminal` |
| `--verbose` | Enable debug logging | `false` |

### `serve` (alias: `api`) -- HTTP API server

```bash
bun run src/index.ts serve --port <port>
```

| Option | Description | Default |
|--------|-------------|---------|
| `--port <port>` | Server port | `3100` |

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check (returns `{ status: "ok" }`) |
| `POST` | `/analyze` | Full analysis -- send `{ apiKey, projectId?, lang? }` |
| `GET` | `/analyze?api_key=...` | Full analysis via query string |
| `POST` | `/predict` | Crystal Ball only (Quick Ratio, PMF, MRR Forecast, Scenarios) |
| `POST` | `/flywheel` | Flywheel analysis only |
| `GET` | `/report/html?api_key=...` | HTML report (rendered) |
| `GET` | `/report/md?api_key=...` | Markdown report |

All endpoints support CORS and return JSON (except `/report/html` and `/report/md`).

## Architecture

```
src/
├── index.ts                    # CLI entry point (Commander.js)
├── api/
│   ├── client.ts               # RevenueCat API v2 client (rate-limited, retries)
│   └── types.ts                # TypeScript type definitions
├── analysis/
│   ├── health-check.ts         # Core orchestrator (14 steps)
│   ├── benchmarks.ts           # SOSA 2026 benchmark data
│   ├── recommendations.ts      # Rule-based recommendation engine
│   ├── quick-ratio.ts          # Quick Ratio calculator
│   ├── pmf-score.ts            # PMF Score (5-factor weighted)
│   ├── mrr-forecast.ts         # MRR forecast (trend + seasonality)
│   ├── scenario-engine.ts      # What-if scenario simulator
│   ├── keyword-analysis.ts     # Keyword attribution analysis
│   ├── offering-analysis.ts    # Offering A/B analysis
│   ├── executive-summary.ts    # Executive summary generator
│   └── flywheel.ts             # Four-layer flywheel engine
├── intelligence/
│   ├── llm-client.ts           # Multi-provider LLM client (Gemini/Anthropic/OpenAI)
│   ├── prompts.ts              # LLM prompt templates
│   └── fallback.ts             # Rule engine fallback when no LLM
├── commands/
│   ├── monitor.ts              # Continuous monitoring with SQLite
│   └── serve.ts                # HTTP API server (Bun.serve)
├── i18n/
│   ├── index.ts                # i18n framework
│   ├── en.ts                   # English
│   ├── zh.ts                   # Chinese
│   └── ja.ts                   # Japanese
├── reports/
│   ├── terminal.ts             # Terminal output (Chalk)
│   ├── html.ts                 # Standalone HTML report
│   └── markdown.ts             # Markdown report
└── utils/
    ├── formatting.ts           # Number/currency/date formatting
    ├── logger.ts               # Logging utility
    └── math.ts                 # Math helpers (interpolation, regression)
```

**Data flow:**

```
RevenueCat Charts API v2
        │
        ▼
   API Client (rate-limited, retried)
        │
        ▼
   Health Check Orchestrator (14 steps)
   ├── Overview metrics
   ├── 14 chart endpoints (90-day, monthly)
   ├── 12-month history (for forecasting)
   ├── Keyword segments (attribution_keyword)
   ├── Offering segments (offering_identifier)
   └── LLM analysis (optional)
        │
        ▼
   Analysis Engines
   ├── Benchmark comparison (SOSA 2026)
   ├── Trend detection (3-point slope)
   ├── Anomaly detection (>30% swing)
   ├── Quick Ratio (MRR Movement)
   ├── PMF Score (5-factor composite)
   ├── MRR Forecast (trend × seasonality)
   ├── What-If Scenarios (3 simulations)
   ├── Flywheel (4-layer insights)
   └── Executive Summary
        │
        ▼
   Output
   ├── Terminal (pretty-printed with Chalk/Ora)
   ├── HTML (standalone, shareable)
   ├── Markdown
   └── JSON (raw data for further analysis)
```

## Sample Output

Analysis of [Dark Noise](https://darknoise.app/) (a white noise app with ~2,500 active subscribers):

```
  rc-insights v1.0.0
  AI-powered subscription health analysis

✔ Using project: Dark Noise (proj_xxx)
✔ Fetched 7 overview metrics
✔ Fetched 14/14 charts
✔ Analysis complete: 14 metrics, 2 anomalies
✔ Generated 5 recommendations
✔ Quick Ratio: 1.00 (concerning)
✔ PMF Score: 55.2/100 (Approaching PMF)
✔ MRR forecast: 6 months | Scenarios: 3 (best: Price Optimization)
✔ Keyword analysis: 3 keywords found
✔ Offering analysis: 2 offerings found

══════════════════════════════════════════════════
  EXECUTIVE SUMMARY
══════════════════════════════════════════════════

  Health Score: 62/100 (Good)
  "Dark Noise is stable but not growing."

  Key Insights:
  [!] Quick Ratio at 1.00 — treading water
  [✓] Trial conversion 47.4% beats 65% of apps
  [!] Churn 6.7% slightly above benchmark
  [→] Price Optimization could add $912/mo in 12 months

══════════════════════════════════════════════════
  CRYSTAL BALL
══════════════════════════════════════════════════

  Quick Ratio:  1.00 (Concerning — barely replacing losses)
  PMF Score:    55.2/100 (Approaching PMF)
  MRR Forecast: $4,562 → $4,673 in 6 months (base)
                         $5,199 (optimistic)
                         $4,187 (pessimistic)

  What-If Scenarios:
  ┌──────────────────────┬──────────┬──────────┬──────────┐
  │ Scenario             │ 3 months │ 6 months │ 12 months│
  ├──────────────────────┼──────────┼──────────┼──────────┤
  │ Fix Churn (→4%)      │ $4,665   │ $4,778   │ $5,018   │
  │ Scale Acquisition    │ $4,751   │ $4,953   │ $5,381   │
  │ Price Optimization   │ $5,481   │ $5,614   │ $5,896   │
  └──────────────────────┴──────────┴──────────┴──────────┘

══════════════════════════════════════════════════
  FLYWHEEL INSIGHTS (Layer 1 — Your Data)
══════════════════════════════════════════════════

  [1] Quick Ratio below 1.0 — you're shrinking
      Revenue inflow barely matches outflow.
      → Check MRR Movement chart for root cause.

  [2] Churn is elevated — separate voluntary vs involuntary
      Check Subscription Status for "Billing Issue" count.
      → Involuntary churn is often 20-40% of total and fixable.

  🔒 Unlock Layer 2: See how apps with similar MRR outperform you.
```

## The Data Flywheel

The core philosophy behind rc-insights is the **Data Flywheel** -- a four-layer system where each layer makes the next one more valuable:

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: Market Opportunity ($$$)                  │
│  Where are the best markets?                        │
│  Adjacent verticals, geographic expansion, bundling │
├─────────────────────────────────────────────────────┤
│  Layer 3: Category Intelligence ($$)                │
│  What works in your vertical?                       │
│  Pricing, trial length, retention benchmarks        │
├─────────────────────────────────────────────────────┤
│  Layer 2: Peer Comparison ($)                       │
│  How do similar apps perform?                       │
│  MRR-band strategies, churn playbooks               │
├─────────────────────────────────────────────────────┤
│  Layer 1: Your Data (Free)                          │
│  What does YOUR data tell you?                      │
│  Health, predictions, anomalies, flywheel insights  │
└─────────────────────────────────────────────────────┘
```

The formula: **Internal Data x External Data = Gold Data** -- insights that directly translate to revenue decisions.

## Built for RevenueCat

This tool was built as a take-home assignment to demonstrate how RevenueCat's APIs can power developer tooling that goes beyond dashboards. Key points:

- **Real API integration** -- Built against the real Charts API v2, not mock data. Every bug we hit became product feedback (see [PROCESS-LOG.md](PROCESS-LOG.md)).
- **MCP-ready** -- Flywheel insights include `mcpAction` fields mapping to RevenueCat MCP Server tools, enabling AI agents to not just analyze but act.
- **Aligned incentive** -- When rc-insights helps an app grow its MRR, RevenueCat's MTR-based revenue grows too. The tool pays for itself.
- **SOSA 2026 benchmarks** -- Hardcoded benchmark data from RevenueCat's own State of Subscription Apps report, making the analysis grounded in real industry data.
- **115K Apps, $16B+ revenue** -- RevenueCat's aggregate data pool is the ultimate moat. An `/v2/benchmarks` API endpoint could turn that moat into a product.

## Requirements

- [Bun](https://bun.sh/) v1.0+
- RevenueCat account with Charts API v2 access
- V2 Secret API Key (not V1 or Public Key)

## License

MIT

## Disclosure

Built by an AI agent ([Claude Code](https://claude.com/claude-code)) operated by Dr. Claw.

---

*rc-insights is not affiliated with RevenueCat. RevenueCat is a trademark of RevenueCat, Inc.*
