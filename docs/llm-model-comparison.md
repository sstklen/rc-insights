# LLM Model Comparison Report

> rc-insights tested 5 LLM engines + 1 rule engine against the same Dark Noise subscription data.
> Purpose: determine the optimal engine configuration for subscription growth recommendations.

---

## Test Setup

- **Data**: Dark Noise (white noise app, MRR $4,562, Churn 6.7%, Trial Conv 47.4%, QR 1.05)
- **Same prompt**: SYSTEM_PROMPT + structured context with all metrics
- **Real RevenueCat Charts API data** (not synthetic)

---

## Results at a Glance

| Engine | Latency | Cost/call | Recs | App-Specific | $ Estimates | Strategy Depth |
|--------|---------|-----------|------|-------------|-------------|---------------|
| **Groq Llama 3.3 70B** | 1.0s | $0.009 | 3 | ✅ Medium | ✅ +$542 | Shallow |
| **Gemini 2.0 Flash** | 5.6s | ~$0.001 | 3 | ✅ Good | ✅ +$300-600 | Medium |
| **DeepSeek Chat** | 8.0s | $0.009 | 3 | ✅ Good | ✅ +$150-600 | Medium |
| **Gemini 2.5 Pro** | 30.6s | ~$0.01 | 3 | ✅ Good | ✅ +$250-500 | Medium+ |
| **Claude Opus 4.6** | direct | $0* | 5 | ✅ Deep | ✅ +$150-3,000 | **Strategic** |
| **Rule Engine** | <1ms | $0 | 5 | ❌ Template | ❌ None | **Strategic** |

*Opus ran as direct reasoning within Claude Code, not as an API call.

---

## Top Recommendation from Each Engine

| Engine | #1 Recommendation | Expected Impact |
|--------|-------------------|-----------------|
| **Groq** | Optimize Trial Experience | +$542 MRR |
| **Flash** | Address February Revenue Drop | Recover $1,650 MRR |
| **DeepSeek** | Win-Back Campaign for Recent Churns | +$150-300 MRR |
| **Pro** | Reduce Churn with Cancellation Flow | +$300-500 MRR/4mo |
| **Opus** | Shift to Annual-First Pricing | +$800-1,200 MRR/6mo |
| **Rule** | Unusual drop in Revenue | (no estimate) |

### Analysis

- **Groq** and **Flash** focused on immediate tactical wins (trial optimization, revenue recovery)
- **DeepSeek** recommended a specific retention tactic (win-back campaign)
- **Pro** went deeper on churn mechanics (cancellation flow)
- **Opus** identified the structural root cause: monthly subscribers re-evaluate every 30 days, and a white noise app delivers 100% of value on Day 1. Annual-first pricing bypasses 11 monthly churn decision points.
- **Rule Engine** flagged the anomaly but had no dollar estimate

**Takeaway**: Higher-capability models produce fundamentally different advice — not just better wording of the same idea, but different strategic framing entirely.

---

## Depth Comparison: Churn Recommendations

All engines recommended addressing churn. Here's how they differed:

| Engine | What they said | Depth |
|--------|---------------|-------|
| **Groq** | "Add ASMR tracks and Sound of the Month to reduce churn to 5.5%" | Feature-level |
| **Flash** | "Improve Quick Ratio by reducing churn" | Metric-level |
| **DeepSeek** | "Win-back campaign with discount for recent churns" | Tactic-level |
| **Pro** | "Implement cancellation flow + proactive annual renewal comms" | Process-level |
| **Opus** | "Monthly subs re-evaluate every 30 days. Product delivers all value Day 1. Shift to annual-first pricing + build cumulative value (sleep data = switching costs)" | **Root-cause structural** |
| **Rule** | "Monthly subs re-evaluate. Shift to annual-first. Build cumulative value." | **Root-cause structural** |

**Key insight**: Only Opus and the hand-crafted Rule Engine identified the root cause (pricing architecture problem, not a retention tactic problem). All other models prescribed symptoms-level fixes.

---

## Cost-Effectiveness Analysis

| Scenario | Best Engine | Why |
|----------|------------|-----|
| **Daily monitoring** (automated) | Gemini Flash | $0.03/month, fast, good enough |
| **Weekly deep analysis** | Gemini 2.5 Pro | $0.04/month, better strategic framing |
| **Strategic pivots** | Claude Opus | Identifies root causes, not symptoms |
| **Offline / no API** | Rule Engine | Zero cost, zero latency, always available |
| **Budget-constrained** | Groq Llama | $0.009/call, 1 second, decent quality |
| **Multi-model consensus** | All engines | Run 3+ models, compare, find agreement |

---

## Architecture Recommendation for rc-insights

```
┌─────────────────────────────────────────────────────────┐
│ Always running: Rule Engine (strategy layer)            │
│ - Root cause analysis                                   │
│ - Strategic recommendations (Opus-level, hand-crafted)  │
│ - Zero cost, zero latency, zero dependency              │
├─────────────────────────────────────────────────────────┤
│ When LLM available: Gemini Flash (tactical layer)       │
│ - App-specific action steps                             │
│ - Dollar estimates                                      │
│ - $0.001/call, 5 seconds                                │
├─────────────────────────────────────────────────────────┤
│ Fallback chain: Gemini → DeepSeek → Groq → Rule Engine  │
│ - If primary fails, try next provider                   │
│ - If all fail, rule engine always works                 │
└─────────────────────────────────────────────────────────┘
```

**Strategy (rule engine) + Tactics (LLM) = Complete recommendation.**

Neither layer alone is sufficient:
- LLM without strategy = "A/B test your paywall" (everyone says this)
- Strategy without LLM = "Shift to annual pricing" (no specific steps or dollar estimates)
- Both together = "Shift to annual pricing because monthly users re-evaluate every 30 days. Specifically: make annual the default on paywall, create upgrade Offering via MCP, price monthly as the expensive option. Expected: +$800-1,200 MRR in 6 months."

---

## For RevenueCat's Consideration

This comparison reveals an opportunity for RevenueCat's platform:

1. **Benchmark-powered recommendations**: If RevenueCat exposed anonymized aggregate data via API (category medians, price tier distributions, retention curves by app type), tools like rc-insights could generate much more specific recommendations. "Your churn is 6.7%" becomes "Your churn is 6.7% — Sound/Sleep apps in the $4K-6K MRR band average 4.2%. Here's what the top 10% do differently."

2. **Multi-model LLM support**: The quality difference between models is significant. RevenueCat's MCP Server + a tool that supports multiple LLM providers = the most powerful growth engine for indie developers. The developer picks their preferred LLM, the tool provides the data, RevenueCat benefits from increased platform engagement.

3. **The Rule Engine as moat**: The hand-crafted strategy layer (built from SOSA 2026 data and subscription economics principles) provides value even without any LLM. This means the tool works for every developer, regardless of whether they have an LLM API key. Free tier = rule engine. Paid tier = rule engine + LLM. Premium = rule engine + LLM + RevenueCat benchmark data.

---

*Tested 2026-03-17. All engines used the same prompt and the same real RevenueCat data from Dark Noise.*
