# rc-insights

AI-powered subscription health report generator for [RevenueCat's Charts API v2](https://www.revenuecat.com/docs/api-v2).

Analyzes your RevenueCat subscription metrics, compares them against industry benchmarks (SOSA 2026), detects trends and anomalies, and generates actionable recommendations.

## Quick Start

```bash
# Run directly (requires Bun)
bunx rc-insights analyze --api-key YOUR_REVENUECAT_V2_KEY

# Or clone and run
git clone https://github.com/nicething/rc-insights.git
cd rc-insights
bun install
bun run src/index.ts analyze --api-key YOUR_KEY
```

## Features

- **Health Scoring**: Each metric rated as healthy (green), attention (yellow), or critical (red)
- **Benchmark Comparison**: Compares your metrics against RevenueCat's State of Subscription Apps 2026 data
- **Trend Detection**: Identifies growing, stable, or declining patterns
- **Anomaly Detection**: Flags sudden spikes or drops in your metrics
- **AI Recommendations**: Generates prioritized, actionable suggestions
- **Multiple Output Formats**: Terminal (pretty-printed), HTML (shareable), Markdown

## Usage

```bash
rc-insights analyze --api-key <key> [options]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--api-key <key>` | RevenueCat v2 API key (required) | — |
| `--project-id <id>` | Project ID (auto-detects if omitted) | First project |
| `--format <format>` | Output: `terminal`, `html`, `md`, `all` | `all` |
| `--output <dir>` | Output directory for report files | `./rc-insights-report/` |
| `--verbose` | Enable debug logging | `false` |

### Examples

```bash
# Auto-detect project, all formats
bun run src/index.ts analyze --api-key sk_xxxxx

# Specific project, HTML only
bun run src/index.ts analyze --api-key sk_xxxxx --project-id proj_abc123 --format html

# Terminal only, verbose
bun run src/index.ts analyze --api-key sk_xxxxx --format terminal --verbose
```

## Terminal Output Preview

```
┌──────────────────────────────────────────────┐
│  📊 My App — Subscription Health             │
│     Report by rc-insights                    │
└──────────────────────────────────────────────┘

Overview (Last 28 days)
────────────────────────────────────────────
🟢 MRR               $4,558  Stable (+0.4% MoM)
🟢 Active Subs        2,530  Growing (+2.4% MoM)
🟡 Churn Rate          6.1%  Stable (benchmark: 6.0%)
🟢 Trial → Paid       41.2%  Growing (benchmark: 35.0%)
🟢 Refund Rate         1.5%  Stable (benchmark: 3.0%)
🔴 LTV/Customer       $1.25  Declining (benchmark: $3.50)

💡 Key Insights & Recommendations
────────────────────────────────────────────
1. Trial conversion (41.2%) beats 65% of apps.   [HIGH]
   → Double down on trial acquisition.

2. Churn at 6.1% is slightly elevated.            [MEDIUM]
   → Consider a win-back offer at day 25.
```

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  RevenueCat  │────→│   Analysis   │────→│    Reports     │
│  Charts API  │     │   Engine     │     │                │
│              │     │              │     │  - Terminal     │
│  - Overview  │     │  - Benchmark │     │  - HTML         │
│  - Charts    │     │  - Trends    │     │  - Markdown     │
│  - Metrics   │     │  - Anomalies │     │  - JSON         │
│              │     │  - AI Recs   │     │                │
└─────────────┘     └──────────────┘     └────────────────┘
```

### Architecture

```
src/
├── index.ts              # CLI entry (Commander.js)
├── api/
│   ├── client.ts         # RevenueCat API v2 client (rate-limited)
│   └── types.ts          # TypeScript types
├── analysis/
│   ├── health-check.ts   # Core analysis orchestrator
│   ├── benchmarks.ts     # SOSA 2026 benchmark data
│   └── recommendations.ts # AI recommendation engine
├── reports/
│   ├── terminal.ts       # Terminal pretty-print (chalk)
│   ├── html.ts           # Standalone HTML report
│   └── markdown.ts       # Markdown report
└── utils/
    ├── formatting.ts     # Number/currency/date formatting
    └── logger.ts         # Logging utility
```

## API Reference

### Charts Analyzed

| Chart | What It Measures |
|-------|-----------------|
| `mrr` | Monthly Recurring Revenue |
| `arr` | Annual Recurring Revenue |
| `churn` | Monthly churn rate |
| `trial_conversion_rate` | Trial to paid conversion |
| `revenue` | Total revenue |
| `actives` | Active subscribers |
| `customers_new` | New customers |
| `trials_new` | New trial starts |
| `refund_rate` | Refund rate |
| `ltv_per_customer` | Lifetime value per customer |

### Benchmarks (SOSA 2026)

| Metric | Median | Top 25% | Bottom 25% |
|--------|-------:|--------:|-----------:|
| Trial Conversion | 35% | 55% | 20% |
| Monthly Churn | 6% | 3.5% | 8% |
| Refund Rate | 3% | 1.5% | 5% |
| MRR | $2,000 | $10,000 | $500 |

## Requirements

- [Bun](https://bun.sh/) v1.0+
- RevenueCat account with Charts API v2 access
- V2 Secret API Key (not V1 or Public Key)

## Getting Your API Key

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Navigate to **Project Settings** > **API Keys**
3. Copy your **V2 Secret Key** (starts with `sk_`)
4. Never commit this key to version control

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run src/index.ts analyze --api-key YOUR_KEY --verbose

# Build
bun run build

# Type check
bunx tsc --noEmit
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Disclosure

Built by an AI agent ([Claude Code](https://claude.com/claude-code)) operated by Dr. Claw.

---

*rc-insights is not affiliated with RevenueCat. RevenueCat is a trademark of RevenueCat, Inc.*
