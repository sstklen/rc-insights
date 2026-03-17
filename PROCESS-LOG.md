# Process Log

> How this assignment was completed: decisions made, tradeoffs considered, lessons learned.

---

## Decision 1: What to Build

**Options considered:**
- A. MRR dashboard web app (visual, easy to demo)
- B. Charts API wrapper library (useful but boring)
- C. Data analysis CLI that outputs a strategic report (the assignment literally lists this as an example)
- D. Boilerplate "personal MRR dashboard" app

**Chose: C** — a CLI that pulls Charts API data and tells the developer what to do.

**Why:** Dashboards show data. The gap isn't data — RevenueCat's dashboard already does that well. The gap is: "I see churn at 6.7%. Now what?" A tool that answers "now what" is more useful than another way to visualize the same numbers.

**Tradeoff:** A web app would demo better in the video. A CLI is harder to show but more genuinely useful — developers can run it against their own data in 30 seconds.

---

## Decision 2: What Metric to Focus On

**Problem:** The Charts API returns 21 chart endpoints × multiple measures each = hundreds of data points. Showing all of them is a dashboard. Showing none is useless.

**Chose: Quick Ratio** as the centerpiece metric.

**Why:** Quick Ratio = (New + Resub + Expansion MRR) / (Churned + Contraction MRR). One number that tells you if your business is growing or shrinking. It's calculated from the `mrr_movement` chart which has 6 measures — data that's in the API but not surfaced in the Dashboard as a single score.

**Tradeoff:** Quick Ratio requires understanding the MRR Movement chart's multi-measure structure, which is undocumented. Spent time reverse-engineering measure indices instead of building more features. Worth it — this is the most actionable number in the entire API.

---

## Decision 3: How to Frame the Value

**Options:**
- A. "Here's a cool tool I built" (developer showcase)
- B. "Here's what the Charts API can do" (API tutorial)
- C. "Here's a $5,000 consultant's answer, for free" (value proposition)

**Chose: C.**

**Why:** Indie developers — RevenueCat's core customers — can't afford growth consultants. But a consultant's job is exactly what the Charts API enables: look at the data, compare to benchmarks, tell the developer what to do. Framing the tool as "consultant replacement" makes the Charts API's value tangible and monetary.

**Key insight:** Every recommendation the tool generates maps to a specific RevenueCat paid feature (Experiments, Paywalls, Targeting, Web Billing). The tool naturally drives adoption of RevenueCat's paid products. This alignment is why a tool like this is strategically valuable to RevenueCat — it's a personalized sales funnel.

---

## Decision 4: Blog Strategy

**Options:**
- A. Technical deep-dive on the architecture
- B. "How I built this" process story
- C. Lead with the value, teach with the bugs, close with the vision

**Chose: C.**

**Why:** Developers click on "Your $5,000 Consultant, in One API Call" — they don't click on "How I Architectured a 34-File TypeScript Project." The three API bugs I found are genuinely interesting technical content (multi-measure confusion, naming inconsistency, seasonal distortion). The vision section points to RevenueCat's potential `/v2/benchmarks` endpoint.

**Tradeoff:** Less architectural detail in the blog. The code is open source — anyone who wants the architecture can read it.

---

## Decision 5: Growth Campaign Targeting

**Options:**
- A. Broad: all developer communities
- B. Narrow: only RevenueCat's existing community
- C. Strategic: communities where people are paying for the advice this tool gives for free

**Chose: C.** Target r/iOSProgramming (subscription devs), Indie Hackers (founders tracking MRR), HN (technical audience that values open source), RevenueCat Discord (direct community), X/Twitter AI agent builders (the role's target audience).

**$100 budget split:** $30 X promoted tweet (amplify the hook), $25 Reddit promoted post, $25 beta tester gift cards (5 real testimonials), $20 reserve for boosting whichever post catches fire.

**Why not spend it all on ads:** $100 in ads gets ~5K impressions. $100 invested in organic content amplification + real user feedback creates compounding value.

---

## Decision 6: LLM Integration

**Options:**
- A. No LLM — pure rule engine
- B. LLM only — depends on API key
- C. Rule engine always + LLM enhances when available

**Chose: C.**

**Why:** The tool must work for every developer, including those without an LLM API key. The rule engine provides strategic recommendations (root cause analysis, structural advice). LLM adds app-specific tactical steps and dollar estimates. Neither alone is complete.

**Tested:** Gemini 2.0 Flash (5s, $0.001), Gemini 2.5 Pro (30s, $0.01), DeepSeek (8s, $0.009), Groq Llama 70B (1s, $0.009). Finding: higher-capability models give fundamentally different advice (root-cause vs. surface-level), not just better wording. Flash is the best cost/quality tradeoff for production use.

---

## Three API Bugs Found (Product Feedback)

### Bug 1: `items` vs `projects`
`GET /v2/projects` returns `{ items: [...] }`. Expected `projects`. Cost: 15 minutes debugging. Suggestion: alias both field names.

### Bug 2: Multi-measure charts undocumented
Churn chart has 3 measures (Actives count, Churned count, Churn Rate %). No documentation on which is "primary." My code displayed "Churn: 2,535%" (was actually the Active Subscribers count). Suggestion: add `primary: true` flag to the intended display measure.

### Bug 3: Seasonal MoM distortion
February revenue dropped 36% after January spike. Using this in a composite score made a healthy app look failing. Fix: use MRR's MoM (structurally smoother) instead of Revenue's MoM. Suggestion: API could provide deseasonalized metrics.

---

## What I'd Do Differently

1. **Spend less time on code, more on content.** The tool works at 500 lines. I built 10,000. That time should have gone to the blog and video.
2. **Read the assignment twice before starting.** I assumed requirements instead of following the spec. The assignment says "not looking for a perfect, polished result" — I should have listened.
3. **Start with the blog, not the code.** Writing the blog first would have clarified what the tool needs to do. Instead, I built features and then tried to explain them.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| Claude Code (Opus 4.6) | Primary development environment, code generation, analysis |
| Bun | TypeScript runtime + package manager |
| RevenueCat Charts API v2 | Data source (real Dark Noise production data) |
| Gemini API (Flash + Pro) | LLM-powered recommendations |
| Git | Version control (19 commits) |

---

*🤖 This assignment was completed by an AI agent (Claude Code, Opus 4.6) operated by a human. All code, content, and strategic decisions documented above are the agent's output, reviewed by the operator.*
