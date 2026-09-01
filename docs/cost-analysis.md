# Cost Analysis: Serverless Analytics GenAI Dashboard

## 1. Executive Summary

### Purpose of This Document

This document provides a comprehensive cost analysis for implementing the Serverless Analytics GenAI Dashboard within the organization. It is intended to help decision-makers understand the financial implications of adopting this solution, including per-service cost breakdowns, usage-based projections across different scale scenarios, and optimization strategies to manage spend over time.

The goal is to equip stakeholders with the information needed to evaluate feasibility, plan budgets, and make an informed go/no-go decision.

### System Overview

The Serverless Analytics GenAI Dashboard is an AI-augmented analytics platform built entirely on AWS serverless services. It combines embedded business intelligence with generative AI to deliver interactive dashboards and natural language insights to end users — without requiring them to leave the application.

The system is composed of three core layers:

**Serverless Analytics Layer** — Raw operational data is stored in Amazon S3, cataloged via AWS Glue Data Catalog, and queried on demand through Amazon Athena. This provides a cost-efficient, schema-on-read analytics foundation with no infrastructure to manage.

**Embedded BI Layer** — Amazon QuickSight dashboards and the QuickSight Q natural language query bar are embedded directly into the application via the QuickSight Embedding SDK. A dedicated Lambda function generates secure, scoped embed URLs through API Gateway, enabling seamless, role-based access to visual analytics.

**Generative AI Layer** — An AI Orchestrator Lambda receives user questions through an API Gateway endpoint, retrieves relevant data context from Athena, and passes it to Amazon Bedrock's generative AI engine. The result is a structured, data-grounded explanation returned to the user — combining the reasoning capabilities of large language models with real-time business data.

The frontend is a React application served via Vite, providing a unified interface where users can view dashboards, ask natural language questions via QuickSight Q, or request AI-generated insights — all within a single experience.

This architecture is fully serverless, meaning costs scale directly with usage rather than requiring upfront provisioning. There are no idle servers, no fixed infrastructure fees, and no long-term capacity commitments required to get started.

### Total Estimated Monthly/Annual Cost Range

The following table compares four implementation scenarios, assuming a baseline of 10 users making 20 AI queries per day (6,000 queries/month). Costs are estimated using current AWS pricing (as of May 2026) and an exchange rate of approximately ₱58 = $1 USD.

**Assumptions for all scenarios:**
- 10 active users, 20 questions/day each = 6,000 AI queries/month
- Bedrock model: Claude 3.5 Sonnet ($3/M input tokens, $15/M output tokens)
- Average per query: ~2,000 input tokens (system prompt + data context), ~500 output tokens
- 2 Bedrock calls per query (intent extraction + explanation) = 12,000 Bedrock invocations/month
- Lambda: 256MB memory, ~3s average duration per invocation
- Aurora is existing infrastructure (no new cost attributed)
- Frontend hosting is existing infrastructure for Scenarios 2–4

---

#### Scenario Comparison Table

| # | Scenario | Monthly (USD) | Monthly (PHP) | Annual (USD) | Annual (PHP) | Remarks |
|---|----------|---------------|---------------|--------------|--------------|---------|
| 1 | Full stack (QuickSight + Q + Bedrock + S3/Glue/Athena + Amplify hosting) | ~$380–$520 | ~₱22,000–₱30,200 | ~$4,560–$6,240 | ~₱264,500–₱361,900 | Highest cost due to QuickSight per-user fees + Q enablement + full data pipeline. Best if you have no existing BI or data layer. |
| 2 | QuickSight + Q + Bedrock (no Amplify, use existing hosting) | ~$340–$470 | ~₱19,700–₱27,300 | ~$4,080–$5,640 | ~₱236,600–₱327,100 | Saves ~$40/mo on hosting. Still carries QuickSight/Q user costs. Good if you want embedded BI + AI. |
| 3 | AI Insights only (Bedrock + Lambda, no QuickSight/Q, no Aurora) | ~$25–$50 | ~₱1,450–₱2,900 | ~$300–$600 | ~₱17,400–₱34,800 | Cheapest if you already have dashboards and a queryable data source. Pure AI add-on. |
| 4 | AI Insights + Aurora (Bedrock + Lambda + existing Aurora) | ~$25–$50 | ~₱1,450–₱2,900 | ~$300–$600 | ~₱17,400–₱34,800 | Same as Scenario 3 — Aurora is already paid for. Lambda queries Aurora directly for context. |

---

#### Cost Breakdown Per Scenario

**Scenario 1 — Full Stack**
| Service | Monthly Cost (USD) | Notes |
|---------|-------------------|-------|
| QuickSight Authors (2) | $48 | $24/user/month |
| QuickSight Readers (8) | $24 | $3/user/month |
| Amazon Q enablement | $250 | Per-account fee for Q topics |
| Bedrock (Claude 3.5 Sonnet) | $27–$45 | 12K calls × ~2.5K tokens avg |
| Lambda | $0.50–$1 | 12K invocations, 256MB, 3s |
| API Gateway | $0.01 | 6K requests (negligible) |
| S3 (data storage) | $1–$5 | Depends on data volume |
| Glue Data Catalog | $1 | Minimal objects |
| Athena | $5–$25 | ~50MB scanned/query × 12K queries |
| Amplify/hosting | $15–$30 | Static site + build minutes |
| **Total** | **~$380–$520** | |

**Scenario 2 — QuickSight + Q + Bedrock (existing hosting)**
| Service | Monthly Cost (USD) | Notes |
|---------|-------------------|-------|
| QuickSight Authors (2) | $48 | $24/user/month |
| QuickSight Readers (8) | $24 | $3/user/month |
| Amazon Q enablement | $250 | Per-account fee |
| Bedrock (Claude 3.5 Sonnet) | $27–$45 | Same as Scenario 1 |
| Lambda | $0.50–$1 | Same |
| API Gateway | $0.01 | Same |
| S3 + Glue + Athena | $7–$31 | Still needed for QuickSight data source |
| **Total** | **~$340–$470** | |

**Scenario 3 — AI Insights Only (Bedrock + Lambda)**
| Service | Monthly Cost (USD) | Notes |
|---------|-------------------|-------|
| Bedrock (Claude 3.5 Sonnet) | $27–$45 | 12K invocations/month |
| Lambda | $0.50–$1 | 12K invocations, 256MB, 3s |
| API Gateway | $0.01 | 6K requests |
| **Total** | **~$25–$50** | Assumes existing data source for context |

**Scenario 4 — AI Insights + Aurora (existing)**
| Service | Monthly Cost (USD) | Notes |
|---------|-------------------|-------|
| Bedrock (Claude 3.5 Sonnet) | $27–$45 | Same token usage |
| Lambda | $0.50–$1 | Same compute |
| API Gateway | $0.01 | Same |
| Aurora | $0 (existing) | Already running, no incremental cost |
| **Total** | **~$25–$50** | Lambda queries Aurora for AI context |

---

#### Bedrock Token Cost Calculation (Detail)

For the baseline scenario (10 users × 20 questions × 30 days = 6,000 user queries):

| Item | Calculation | Cost |
|------|-------------|------|
| Intent extraction calls | 6,000 calls × ~500 input tokens × $3/M | $9.00 input |
| Intent extraction output | 6,000 calls × ~100 output tokens × $15/M | $9.00 output |
| Explanation calls | 6,000 calls × ~2,000 input tokens × $3/M | $36.00 input |
| Explanation output | 6,000 calls × ~500 output tokens × $15/M | $45.00 output |
| **Total Bedrock** | | **~$99/month** |

> Note: The above is a conservative upper estimate. In practice, prompt caching, shorter prompts, and using a cheaper model (e.g., Claude Haiku at $0.25/$1.25 per M tokens) can reduce this by 80–90%.

**With Claude 3 Haiku instead (cost-optimized):**

| Item | Calculation | Cost |
|------|-------------|------|
| All calls combined | 12,000 calls, same token volumes | |
| Input cost | ~30M tokens × $0.25/M | $7.50 |
| Output cost | ~3.6M tokens × $1.25/M | $4.50 |
| **Total Bedrock (Haiku)** | | **~$12/month** |

---

#### Opinion / Recommendation

Para sa scenario niyo — existing dashboards na kayo, existing Aurora, ang kailangan lang talaga is yung AI insights feature — **Scenario 4 ang pinaka-practical at cost-effective.**

Breakdown ng actual cost sa scenario niyo:
- 10 users × 20 questions/day = 200 queries/day × 30 days = **6,000 queries/month**
- Using Claude Haiku (good enough for structured Q&A): **~₱700/month ($12)**
- Using Claude Sonnet (better reasoning): **~₱5,700/month ($99)**
- Lambda + API Gateway: **~₱30–₱60/month ($0.50–$1)**

**Total realistic cost: ₱750–₱5,800/month ($13–$100)** depending on model choice.

Kung gusto niyo ng balance between quality and cost, start with Haiku then upgrade to Sonnet only if the answer quality isn't sufficient. The architecture supports swapping models via environment variable — no code change needed.

The QuickSight + Q route (Scenarios 1–2) only makes sense if you don't have existing dashboards and need to build BI from scratch. The $250/month Q enablement fee alone is more expensive than the entire AI insights feature.

---

*Pricing sources: [AWS QuickSight Pricing](https://aws.amazon.com/quicksight/pricing/), [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/), [API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/). Exchange rate: ~₱58 = $1 USD (May 2026). All estimates are approximate and may vary by region and actual usage patterns.*
