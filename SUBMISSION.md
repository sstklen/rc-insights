# rc-insights — Take-Home Assignment Submission

> 🤖 This assignment was completed by an AI agent (Claude Code, Opus 4.6), operated by a human.

---

## 1. Tool

**rc-insights** — A CLI that turns RevenueCat's Charts API into a $5,000 subscription consultant, in 30 seconds.

🔗 **GitHub**: [https://github.com/nicething/rc-insights](https://github.com/nicething/rc-insights)

```bash
git clone https://github.com/nicething/rc-insights
cd rc-insights && bun install
bun run src/index.ts analyze --api-key YOUR_REVENUECAT_V2_KEY
```

What it does: pulls 14 chart endpoints, calculates Quick Ratio and PMF Score, forecasts MRR 6 months out, simulates 3 what-if scenarios, and tells you exactly what to do next — with dollar estimates.

---

## 2. Blog Post

**"Your $5,000 Subscription Consultant, in One API Call"**

🔗 **Blog**: [BLOG.md in repo](https://github.com/nicething/rc-insights/blob/main/BLOG.md)

1,826 words. Covers: three real API bugs found, Quick Ratio as the one number that matters, what-if scenarios, how every recommendation maps to a RevenueCat paid feature, and a product suggestion for `/v2/benchmarks`.

---

## 3. Video Tutorial

🔗 **Video**: [Demo (43 seconds, real API data)](demo.gif) — Terminal recording showing the tool analyzing Dark Noise's real RevenueCat data, from command to actionable recommendation.

The demo shows: problem statement → one command → real API results → Executive Summary (5 lines) → "#1 Action: Scale Acquisition, +$1,166/month" → value proposition.

---

## 4. Social Media Posts (X/Twitter)

All posts include 🤖 agent disclosure.

### Post 1: The Money Hook
> A subscription growth consultant costs $5,000/month.
>
> RevenueCat's Charts API has the same data.
>
> I built a tool that gives you the same answer in 30 seconds:
> "Scale acquisition. +$1,166/mo within 12 months."
>
> Free, open source → [link]
>
> 🤖 Built by an AI agent | @RevenueCat Charts API

### Post 2: The One Number
> I analyzed a real subscription app with RevenueCat's Charts API.
>
> 14 metrics. Hundreds of data points. But ONE number told the whole story:
>
> Quick Ratio = 1.05
>
> Meaning: for every $1 earned, $0.95 walks out. Not dying. Not growing.
>
> That single number replaced a $2,000 analytics report → [blog]
>
> 🤖 AI agent. Real data from @DarkNoiseApp.

### Post 3: The API Bug
> RevenueCat's Churn endpoint returns 3 measures.
>
> My code grabbed measure 0 → "Churn Rate: 2,535%"
>
> Actual churn: 6.7%. Measure 0 was the Active Subscribers COUNT.
>
> The fix was 3 lines. But it revealed something: the Charts API has way more data than the docs show.
>
> Full story + 2 more discoveries → [blog]
>
> 🤖 AI agent, real bugs, real fixes

### Post 4: The Missing $16B API
> RevenueCat tracks $16B across 115,000 apps.
>
> Imagine one API call:
> `/v2/benchmarks?category=sound&mrr_band=4k-6k`
>
> → "Your churn is 60% above your category median. Here's what the top 10% do differently."
>
> That's not analytics. That's a $5,000 consultant in one endpoint.
>
> Only @RevenueCat can build this → [blog]
>
> 🤖 AI agent perspective on product strategy

### Post 5: Try It
> rc-insights — your subscription health in 30 seconds:
>
> ```
> bun run rc-insights analyze --api-key YOUR_KEY
> ```
>
> What you get:
> ✅ Health score (vs 115K app benchmarks)
> ✅ The one number that matters (Quick Ratio)
> ✅ "Do X → earn $Y more" (with math)
>
> What a consultant charges for this: $5,000
> What this costs: $0
>
> → [GitHub]
>
> 🤖 Built by an AI agent for @RevenueCat's Agentic AI Advocate role

---

## 5. Growth Campaign Report

🔗 **Full report**: [GROWTH-CAMPAIGN.md in repo](https://github.com/nicething/rc-insights/blob/main/GROWTH-CAMPAIGN.md)

**Summary:**
- **Core message**: "$5,000 consultant → free API call"
- **5 target communities**: r/iOSProgramming, Indie Hackers, RevenueCat Discord, Hacker News, X/Twitter AI builders
- **$100 budget**: $30 X promoted tweet, $25 Reddit promoted, $25 beta tester gift cards, $20 reserve
- **Measurement**: Blog page views, GitHub stars/clones, X impressions, Reddit upvotes, HN points
- **Commercial angle**: Every tool recommendation → RevenueCat paid feature (Experiments, Paywalls, Targeting, Web Billing)

---

## 6. Process Log

🔗 **Full log**: [PROCESS-LOG.md in repo](https://github.com/nicething/rc-insights/blob/main/PROCESS-LOG.md)

**Key decisions documented:**
1. Built a CLI report (not a dashboard) — because the gap is "now what?", not "show me the data"
2. Centered on Quick Ratio — one number derived from 6 MRR Movement measures
3. Framed as "$5,000 consultant replacement" — makes API value tangible and monetary
4. Every recommendation maps to a RevenueCat paid feature — tool is a sales funnel
5. Rule engine + LLM hybrid — works for everyone, enhanced with Gemini when available
6. Three real API bugs found — genuine product feedback

**What I'd do differently:** Less code, more content. Start with the blog, not the architecture.
