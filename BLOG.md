# From Data to Gold: An AI Growth Engine for RevenueCat

---

## The Gap

RevenueCat's dashboard shows MRR, churn, trial conversion. The numbers are there. The problem is what happens next.

A developer sees churn at 6.7% and thinks: *"Is that bad? What do I do?"* Then closes the tab because there are bugs to ship.

**The gap is not data. The gap is diagnosis.**

rc-insights fills that gap. One command, 30 seconds, complete diagnosis:

```bash
bun run rc-insights analyze --api-key sk_xxxxx
```

Not a dashboard. A doctor — reads the labs, diagnoses, prescribes, predicts.

---

## The Crystal Ball

### Quick Ratio — One Number to Rule Them All

```
Quick Ratio = (New + Resub + Expansion MRR) / (Churned + Contraction MRR)
```

Above 1.0 = growing. Below 1.0 = shrinking. Dark Noise scored **1.00** — treading water. That single number told a clearer story than 14 separate metrics.

### PMF Score — Is Your Product Working?

Five factors, weighted, compressed to 0-100. Crossed with Quick Ratio to produce a verdict: **Double Down / Optimize / Pivot / Harvest.** Dark Noise: 55/100, verdict = Optimize.

### What-If Scenarios

Three simulations: Fix Churn → +26% MRR. Scale Acquisition → +27%. Raise Prices → +20%. Each projected month-by-month for 12 months against a do-nothing baseline.

---

## The Data Flywheel

The core thesis: **the most valuable insights come from combining data sources nobody else combines.**

| Layer | What | Cost |
|-------|------|------|
| 1 | Your data → diagnosis + prediction | Free |
| 2 | Peer comparison → "apps like you do X" | $ |
| 3 | Category intelligence → pricing, retention | $$ |
| 4 | Market opportunity → adjacent verticals | $$$ |

Each layer uses more API, generates more value, justifies higher pricing.

---

## Gold Data

Most tools stop at insights. We go further:

```
Data      = "Your churn rate is 6.7%"
Insights  = "Your churn is 12% higher than peers, fixable with dunning"
Gold Data = AI Agent auto-detects 50 at-risk users
            → auto-creates win-back Offering via MCP
            → 30 renew → +$90/month MRR
            → repeats, improves each cycle
```

> **Gold Data is not data. It's revenue an AI agent earns autonomously.**

This isn't theoretical. Stripe recovered **$6.5B** with smart dunning in 2024. ChurnZero reports **40% retention improvement**. Botsi maximizes LTV per-user with RevenueCat integration, charging only on uplift.

The formula: **Internal Data × External Data × Autonomous Action = Revenue.**

---

## AI Agents Are Customers

Gartner: by 2028, **90% of B2B purchases handled by AI agents, $15 trillion.** The customer is not always human anymore.

rc-insights is built for this:

| Layer | Customer | Interface | Revenue |
|-------|----------|-----------|---------|
| 1 | Human developer | CLI + HTML | Free |
| 2 | Other AI agents | MCP Server (7 tools) | $0.10/call |
| 3 | Autonomous agents | A2A + MCP + auto-execute | 5-10% of recovered MRR |

We built an **MCP Server** with 7 discoverable tools. Any AI agent can call `analyze_subscription_health` and receive structured insights + executable MCP actions pointing at RevenueCat's MCP Server. Zero humans involved.

We publish an **A2A Agent Card** at `/.well-known/agent.json`. We serve **WebMCP** endpoints. The full 2026 protocol stack: MCP (tools) + A2A (agents) + WebMCP (web).

**This is not a tool with AI features. This is AI infrastructure that serves other AI agents.**

---

## What I Learned Building Against the Real API

**Bug 1:** API returns `items`, not `projects`. 15 minutes of debugging at 11pm.

**Bug 2:** Churn chart has 3 measures — our code grabbed measure 0 (Active Subscribers count) and displayed "Churn: 2,535%". Fix: read `chartable: true` flag. **Product feedback:** a `primary: true` flag on measures would save every developer.

**Bug 3:** Seasonal revenue drop (-36%) poisoned the PMF Score. Fix: use MRR's MoM (structurally smoother) instead of Revenue's MoM.

**Biggest missing API:** `/v2/benchmarks` — anonymized aggregate data by category, price tier, MRR band. RevenueCat has 115K apps and $16B+ in tracked revenue. That data, exposed via API, would be the most valuable endpoint in the subscription economy.

---

## The Thesis

The subscription economy adds 15,000 new apps per month. The gap between winners (+80% YoY) and losers (-33% YoY) is widening.

The winners won't be staring at dashboards. They'll have AI agents optimizing subscriptions 24/7.

**The future of subscription analytics is not showing developers their data. It's building AI agents that use the data to make money while they sleep.**

---

*Built against RevenueCat Charts API v2 with real data from [Dark Noise](https://darknoise.app/). 32 TypeScript files, 9,800+ lines, zero errors, 3 languages, 7 MCP tools. [Open source](https://github.com/nicething/rc-insights).*
