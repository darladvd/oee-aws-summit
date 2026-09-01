# Feasibility Study: Generative AI-Powered Analytics Insights Platform on AWS for OEE

## 1. Executive Summary

### Purpose of the Study

This feasibility study evaluates the technical, operational, and financial viability of implementing a Generative AI-powered analytics insights platform on AWS, starting with Overall Equipment Effectiveness (OEE) as the initial proof of concept. The study aims to provide decision-makers with a clear understanding of the proposed architecture, associated costs, risks, and expected outcomes to support an informed go/no-go decision.

### Project Overview

The project proposes adding an AI insights layer to IMI's existing manufacturing dashboards, enabling users to ask natural language questions about OEE performance and receive data-grounded explanations in real time. The system uses AWS Database Migration Service (DMS) to continuously replicate data from IMI's four database sources (Aurora, MySQL, MSSQL, Oracle) into a centralized data lake on Amazon S3. Amazon Athena serves as the serverless query engine, while AWS Lambda orchestrates the AI workflow — extracting user intent, querying the data lake, and calling Amazon Bedrock's generative AI models to produce structured, human-readable insights. The architecture is fully serverless, config-driven to support multiple dashboard domains in the future, and designed to establish a reusable data lake foundation for broader analytics and data engineering initiatives beyond the initial OEE use case.



## 2. Background and Problem Statement

### Current State

IMI (Integrated Micro-Electronics Inc.) currently operates an OEE Monitoring system within its i40 platform. The organization's data is distributed across four database sources (Aurora, MySQL, MSSQL, Oracle), serving different operational domains. OEE data specifically resides in MSSQL, capturing production records across multiple sites, lines, products, shifts, and process sides.

Engineers and executives access OEE data through a tabular dashboard that allows filtering by site, product, line, and date range. The current dashboard presents raw production records — individual entries showing date, site, product, line, SAP number, process side, shift, and model information. Users can filter, search, paginate, and export data (Copy, Excel, CSV). Additional tabs provide access to maintenance data and calculated OEE values.

Other manufacturing dashboards within the i40 platform include visual charts and graphs for different operational domains, with their respective data residing in the other database sources.

### Pain Points

While the existing dashboard provides access to data, it has limitations in supporting fast, insight-driven decision-making:

1. **Data without interpretation.** The dashboard shows what happened (raw records and calculated values) but does not explain why. When OEE drops, users must manually cross-reference data across filters, shifts, and time periods to identify root causes.

2. **Time-consuming analysis.** Engineers and executives must export data, apply their own analysis, and draw conclusions manually. There is no built-in mechanism to surface patterns, anomalies, or actionable recommendations from the data.

3. **No natural language interface.** Users cannot ask questions like "Why did Line NPM-L2 have low yield last week?" or "Which shift is performing worst this month?" — they must construct the answer themselves by navigating filters and scanning rows.

4. **Siloed data sources.** With data spread across four databases, getting a holistic view requires accessing multiple systems. There is no centralized, queryable layer that unifies all sources for cross-domain analysis.

5. **No centralized data lake.** The organization currently lacks a data lake, limiting the ability to perform advanced analytics, historical trend analysis, or future machine learning initiatives at scale.

### Opportunity

Generative AI, specifically large language models (LLMs) available through Amazon Bedrock, can bridge the gap between raw data and actionable insight. By adding an AI insights layer on top of the existing dashboard infrastructure, IMI can:

- Enable engineers and executives to ask natural language questions and receive data-grounded explanations with root cause analysis and recommended actions
- Reduce time-to-insight from hours of manual analysis to seconds
- Establish a centralized data lake that unifies all four data sources into a single queryable layer
- Create a reusable platform that can be extended to other manufacturing domains (maintenance, quality, supply chain) beyond the initial OEE use case
- Enhance decision-making quality by surfacing patterns and correlations that may not be immediately visible in tabular data

The POC will focus on OEE with yield data as the first domain, targeting engineers and executives as the primary users.

## 3. Project Objectives

### Primary Objectives

1. **Implement a Generative AI insights layer for the OEE dashboard.** Enable engineers and executives to ask natural language questions about OEE and yield performance and receive data-grounded explanations, root cause analysis, and actionable recommendations in real time.

2. **Establish a centralized data lake on AWS.** Replicate OEE data from MSSQL into Amazon S3 via CDC (Change Data Capture), creating a queryable, scalable data foundation that decouples analytics from the production database.

### Secondary Objectives

3. **Validate the architecture for multi-domain expansion.** Design the system so that additional manufacturing dashboards (maintenance, quality, supply chain) can be onboarded by adding configuration — not rebuilding infrastructure.

4. **Lay the groundwork for a unified data lake across all sources.** While the POC focuses on MSSQL (OEE), the architecture should support future ingestion from Aurora, MySQL, and Oracle into the same data lake for cross-domain analytics and data engineering use cases.

5. **Evaluate Bedrock model options for cost and quality.** Test multiple generative AI models (Amazon Nova, Claude Haiku, Claude Sonnet) to determine the best balance of response quality, latency, and cost for IMI's use case.

## 4. Scope

### In Scope

- AI insights chatbot for OEE and yield data (natural language Q&A with data-grounded responses)
- Data lake setup on Amazon S3 using AWS managed services
- CDC replication from MSSQL (OEE/yield data) as the primary data source
- Integration of additional data sources (Aurora, MySQL, Oracle) if time permits
- Serverless AI pipeline: API Gateway + Lambda + Bedrock
- Query engine setup using Amazon Athena
- Data cataloging with AWS Glue
- Security implementation (IAM, KMS, Secrets Manager, read-only DB access)
- Model evaluation (Amazon Nova, Claude Haiku, Claude Sonnet) for cost and quality
- Integration with existing i40 OEE dashboard (frontend chatbot component)

### Out of Scope

- Migrating or replacing existing dashboards or BI tools
- Building new dashboards or visual analytics
- Real-time streaming analytics (near real-time CDC is sufficient)
- Machine learning model training or custom model fine-tuning
- User authentication system (will use existing i40 authentication)
- Mobile application development
- Data governance policies and compliance framework (future initiative)
- Production-scale deployment (this is a POC; production rollout is a separate phase)

## 5. Technical Feasibility

### 5.1 Proposed Architecture

#### AWS Services

| Category | AWS Service | Role |
|---|---|---|
| Data Ingestion | AWS DMS | CDC replication from source databases to S3 |
| Storage | Amazon S3 | Centralized data lake storage (Parquet format) |
| Catalog | AWS Glue Data Catalog | Metadata registry for table schemas and partitions |
| Catalog | AWS Glue Crawler | Auto-discovers new data and partitions in S3 |
| Query Engine | Amazon Athena | Serverless SQL queries over S3 data |
| AI Layer | Amazon Bedrock | LLM for intent extraction and natural language explanations |
| AI Layer | AWS Lambda | Orchestrator function (coordinates queries and AI calls) |
| AI Layer | Amazon API Gateway | HTTP endpoint for the AI chatbot |
| Security | AWS IAM | Roles and policies for service-to-service permissions |
| Security | AWS Secrets Manager | Stores database credentials for DMS connections |
| Security | AWS KMS | Encryption keys for S3, Secrets Manager, data at rest |
| Monitoring | Amazon CloudWatch | Logs, metrics, and alarms |
| Networking | Amazon VPC | Network isolation for DMS replication instance |
| Networking | AWS VPN / Direct Connect | Required if source databases are on-premises |

#### Architecture Diagram

*(See attached architecture diagram)*

The proposed architecture follows a layered, fully serverless design on AWS. Data flows from the bottom (source databases) upward through ingestion, storage, querying, and AI processing before reaching the end user.

**Data Sources** — IMI's four operational databases (MSSQL, Aurora, MySQL, Oracle) serve as the origin of all production data. For the POC, MSSQL is the primary source containing OEE and yield data.

**Data Ingestion Layer** — AWS DMS continuously replicates data from source databases to the data lake using Change Data Capture (CDC). Changes are captured in near real-time without impacting production database performance.

**Data Lake Layer** — Amazon S3 stores all replicated data in Parquet format, optimized for analytical queries. The data is organized into three layers: Raw (exact copy from DMS), Curated (transformed and aggregated by Glue ETL jobs), and Serving (final merged datasets ready for consumption). AWS Glue Crawler periodically scans S3 to discover new data files, infer their schemas (column names, types), detect partition structures, and register this metadata in the AWS Glue Data Catalog. AWS Glue ETL Jobs read data from the Raw layer, apply transformations (aggregation, joins, computed fields), and write results to the Curated and Serving layers.

**Query Layer** — Amazon Athena provides serverless SQL query capabilities over the data lake. These four services work together as follows: when Athena receives a query, it first consults the Glue Data Catalog to understand what tables exist, what columns they contain, and where the corresponding Parquet files are located in S3. It then reads the actual data files directly from S3 to execute the query and return results. Without the Catalog, Athena would not know how to interpret the files in S3. Without S3, there would be no data to query. The Glue Crawler is what keeps the Catalog in sync with the actual data in S3 — whenever new files appear (from DMS or ETL jobs), the Crawler updates the Catalog so Athena can find them.

**AI Insights Layer** — This is the core of the solution. Amazon API Gateway receives user questions from the i40 dashboard. AWS Lambda orchestrates the AI workflow: it calls Amazon Bedrock to extract intent from the question, builds a parameterized SQL query, executes it via Athena, then calls Bedrock again to generate a natural language explanation grounded in the query results. The structured insight is returned to the user.

**Supporting Services** — AWS IAM manages permissions across all services. AWS Secrets Manager securely stores database credentials used by DMS. AWS KMS provides encryption keys for data at rest in S3 and Secrets Manager. Amazon CloudWatch handles logging, metrics, and alerting. Amazon VPC provides network isolation for the DMS replication instance, with AWS VPN or AWS Direct Connect providing secure connectivity to on-premises source databases where applicable.

#### Request Flow

1. User types a natural language question in the OEE dashboard chatbot
2. Frontend sends POST request to API Gateway
3. API Gateway invokes the Lambda orchestrator
4. Lambda calls Bedrock to extract structured intent (KPI, entity, time range)
5. Lambda builds a parameterized SQL query based on the extracted intent
6. Lambda executes the query via Athena against the data lake
7. Lambda passes the query results + original question to Bedrock for explanation
8. Bedrock returns a structured response (summary, root causes, recommended actions)
9. Lambda returns the response to the frontend
10. Dashboard displays the AI insight to the user

Estimated end-to-end response time: 4–6 seconds.

### 5.2 Security Architecture

The system is designed with defense-in-depth — multiple layers of security ensuring that no single point of failure can compromise data.

#### Security Principles

| Principle | Implementation |
|---|---|
| Least privilege | Each service has only the minimum IAM permissions required |
| Encryption at rest | S3 (SSE-S3 or KMS), Secrets Manager (KMS), Athena results (encrypted) |
| Encryption in transit | All API calls over HTTPS/TLS |
| Read-only data access | DMS and Athena use read-only database credentials |
| No direct user access to data | Users interact only through the chatbot; they never see raw data or SQL |
| Credential isolation | DB passwords stored in Secrets Manager, never hardcoded |
| AI data privacy | Bedrock does not store prompts/responses, does not use data for training |

#### Access Control Matrix

| Actor | Can Access | Cannot Access |
|---|---|---|
| End user (engineer/executive) | Chatbot interface only | Databases, S3, Lambda, Athena, raw data |
| Lambda function | Athena, Bedrock, Secrets Manager | Source databases directly |
| DMS | Source databases (read-only), S3 (write) | Bedrock, Lambda |
| Athena | S3 data lake (read-only) | Source databases, Bedrock |
| Bedrock | Text input from Lambda only | Databases, S3, network, credentials |

#### Network Security

| Layer | Control |
|---|---|
| DMS replication instance | Runs in private VPC subnet, security group allows only outbound to source DB port |
| Lambda | Runs in AWS-managed network (or VPC if needed), no public IP |
| API Gateway | HTTPS only, can add API keys or IAM auth for access control |
| S3 bucket | Private (no public access), bucket policy restricts to specific IAM roles |
| Source databases | Security group allows inbound only from DMS security group |

#### Data Privacy with Amazon Bedrock

- Prompts and responses are not stored by Bedrock after processing
- Data is not used to train or improve foundation models
- All data stays within the AWS account and selected region
- Bedrock has no network access to databases or S3 — it only processes text that Lambda explicitly sends to it
- CloudWatch logging can be enabled to audit every Bedrock invocation

### 5.3 Scalability Considerations

The fully serverless architecture scales automatically with usage:

| Component | Scaling Behavior | Limit | Mitigation |
|---|---|---|---|
| API Gateway | Auto-scales to thousands of concurrent requests | 10,000 requests/sec (default) | Request limit increase via AWS support |
| Lambda | Auto-scales concurrent executions | 1,000 concurrent (default) | Request limit increase; unlikely to hit at POC scale |
| Bedrock | Auto-scales with request volume | Model-specific throttling limits | Request quota increase; use multiple models as fallback |
| Athena | Auto-scales query execution | 20 concurrent queries (default) | Increase via workgroup settings; queries are fast (<3s) |
| S3 | Virtually unlimited storage | None practical | N/A |
| DMS | Fixed instance size; upgrade if needed | Instance capacity | Upgrade to larger instance or use DMS Serverless |

#### Growth Scenarios

| Scenario | Users | Queries/Month | Estimated Monthly Cost |
|---|---|---|---|
| POC | 10 | 6,000 | $45–$57 |
| Department rollout | 50 | 30,000 | $90–$150 |
| Enterprise scale | 200 | 120,000 | $250–$500 |

Costs scale linearly with query volume. The primary cost driver at scale is Bedrock token usage. Infrastructure costs (DMS, S3, Glue) remain relatively fixed regardless of query volume.

#### Multi-Chatbot Scalability

The architecture supports multiple chatbot domains (OEE, maintenance, quality, etc.) through configuration — not additional infrastructure. Adding a new chatbot requires:

1. Define the domain config (tables, KPIs, dimensions, system prompt)
2. Test with sample questions
3. Embed chatbot component in the target dashboard

No additional Lambda functions, API Gateway endpoints, or Athena configurations are needed. The same infrastructure serves all domains.


### 5.4 AI Model Selection Criteria

The system uses Amazon Bedrock to access foundation models. The architecture supports swapping models via environment variable — no code change required. The specific models to be evaluated have not yet been finalized; this section will be updated once model candidates are selected and tested.

#### Evaluation Criteria

| Criteria | Weight | Description |
|---|---|---|
| Response quality | High | Accuracy and relevance of generated insights against known OEE scenarios |
| Structured output compliance | High | Ability to consistently return valid JSON in the expected format |
| Latency | Medium | Time from prompt submission to response (target: <3 seconds per call) |
| Cost per query | Medium | Token usage and associated cost at projected query volumes |
| Edge case handling | Medium | Graceful handling of ambiguous questions, missing data, or out-of-scope queries |
| Context window size | Low | Maximum input size supported (relevant for large data payloads) |

#### Model Candidates

To be determined. Potential candidates include models from the Amazon Nova family and Anthropic Claude family available through Amazon Bedrock. This document will be updated with a model comparison table and recommendation once evaluation is complete.


## 6. Operational Feasibility

### 6.1 Team Skills and Readiness

| Skill Area | Required For | Current Readiness | Gap Mitigation |
|---|---|---|---|
| AWS services (IAM, S3, Lambda) | Infrastructure setup and configuration | To be assessed | AWS training, documentation, or partner support |
| SQL (query writing, schema design) | Parameterized query builder, Athena queries | Likely available (existing DB team) | Minimal gap expected |
| Python or Node.js | Lambda function development | To be assessed | Leverage existing codebase as reference |
| Prompt engineering | System prompts, intent extraction tuning | New skill | Iterative testing with sample questions |
| DMS configuration | CDC setup from MSSQL to S3 | To be assessed | AWS documentation, guided setup |
| Frontend integration | Embedding chatbot component in i40 dashboard | Likely available (existing i40 dev team) | Minimal gap expected |

The fully managed AWS approach minimizes the need for deep infrastructure expertise. The primary development effort is in Lambda function logic and prompt engineering — not in managing servers, clusters, or pipelines.

### 6.2 Maintenance and Monitoring Requirements

#### Ongoing Maintenance

| Task | Frequency | Effort | Owner |
|---|---|---|---|
| Monitor DMS replication health | Daily (automated alerts) | Low | DevOps / Cloud team |
| Review CloudWatch alarms | As triggered | Low | DevOps / Cloud team |
| Glue Crawler schedule verification | Weekly | Low | Data team |
| Prompt tuning (improve AI response quality) | As needed | Medium | Development team |
| Model evaluation (test newer models as released) | Quarterly | Low | Development team |
| AWS service updates and patches | Automatic (managed services) | None | AWS |
| Security credential rotation | Quarterly | Low | Security / DevOps |

#### Monitoring Setup

| What to Monitor | Service | Alert Condition |
|---|---|---|
| DMS replication lag | CloudWatch | Lag exceeds 5 minutes |
| Lambda errors | CloudWatch | Error rate exceeds 5% |
| Lambda duration | CloudWatch | Average duration exceeds 10 seconds |
| Athena query failures | CloudWatch | Any failed query |
| Bedrock throttling | CloudWatch | Throttled requests detected |
| S3 storage growth | CloudWatch / S3 metrics | Unexpected growth spike |
| API Gateway 4xx/5xx errors | CloudWatch | Error rate exceeds 2% |

### 6.3 Deployment Strategy (Phased Rollout)

| Phase | Scope | Duration | Deliverable |
|---|---|---|---|
| Phase 1 | Data lake setup — DMS replication from MSSQL to S3, Glue Catalog, Athena tables verified | 3 weeks | OEE data queryable in Athena |
| Phase 2 | AI insights MVP — Lambda + Bedrock + API Gateway, single OEE chatbot functional | 3 weeks | Working chatbot returning AI insights for OEE questions |
| Phase 3 | Integration and testing — Embed chatbot in i40 OEE dashboard, user testing, prompt tuning | 2 weeks | End-to-end POC live and demo-ready |

Total estimated POC timeline: 8 weeks (target completion: July 27, 2026).

### 6.4 Risk Assessment and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| DMS CDC incompatibility with MSSQL version or config | Low–Medium | High | Validate MSSQL version and CDC support early; test with a single table first |
| AI response quality insufficient for decision-making | Medium | Medium | Iterative prompt tuning; test multiple models; set clear quality benchmarks |
| Latency exceeds acceptable threshold (>10s) | Low | Medium | Optimize query scope; use smaller/faster models; add caching for common questions |
| Source database performance impact from DMS | Low | High | DMS reads from transaction logs (minimal impact); monitor source DB during initial full load |
| Team lacks AWS expertise to complete setup | Medium | Medium | Leverage AWS documentation, partner support, or training; architecture is straightforward |
| Cost overrun from unexpected Bedrock usage | Low | Low | Set budget alerts in AWS; implement rate limiting on API Gateway |
| Security misconfiguration exposes data | Low | High | Follow least-privilege IAM; use infrastructure-as-code for repeatable, auditable setup |
| Scope creep (adding sources/features during POC) | Medium | Medium | Strict POC scope definition; defer additional sources to post-POC phase |

## 7. Financial Feasibility (Cost Analysis)

### 7.1 AWS Services Cost Breakdown

Based on POC scale: 10 users, 20 questions/day, 6,000 AI queries/month, MSSQL as single source.

| # | Service | Pricing Model | Monthly Cost (USD) | Monthly Cost (PHP ≈₱58) |
|---|---|---|---|---|
| 1 | AWS DMS (dms.t3.small, 24/7) | ~$0.036/hr | $26.28 | ₱1,524 |
| 2 | Amazon S3 (storage) | $0.023/GB | $0.23–$1.15 | ₱13–₱67 |
| 3 | Amazon S3 (requests) | $0.005/1K PUTs, $0.0004/1K GETs | $0.52 | ₱30 |
| 4 | AWS Glue Data Catalog | $1/100K objects | $1.00 | ₱58 |
| 5 | AWS Glue Crawler | $0.44/DPU-hour | $1.76 | ₱102 |
| 6 | Amazon Athena | $5/TB scanned | $0.15 | ₱9 |
| 7 | Amazon Bedrock (model TBD) | Per token (varies by model) | $14–$99 | ₱812–₱5,742 |
| 8 | AWS Lambda | $0.20/1M requests + compute | $0.60 | ₱35 |
| 9 | Amazon API Gateway (HTTP) | $1/million requests | <$0.01 | <₱1 |
| 10 | AWS Secrets Manager | $0.40/secret/month | $0.40 | ₱23 |
| 11 | AWS KMS | $1/key/month | $1.00 | ₱58 |
| 12 | Amazon CloudWatch | $0.50/GB logs | $0.50 | ₱29 |

#### Monthly Total (POC)

| Model Scenario | Monthly USD | Monthly PHP | Annual USD | Annual PHP |
|---|---|---|---|---|
| Cost-optimized (e.g., Claude Haiku) | ~$47 | ~₱2,726 | ~$564 | ~₱32,712 |
| Mid-range (e.g., Nova 2 Lite) | ~$55 | ~₱3,190 | ~$660 | ~₱38,280 |
| Premium (e.g., Claude Sonnet) | ~$132 | ~₱7,656 | ~$1,584 | ~₱91,872 |

### 7.2 Usage Scenarios

| Scenario | Users | Questions/Day | Queries/Month | Est. Monthly Cost (USD) | Est. Monthly Cost (PHP) |
|---|---|---|---|---|---|
| POC (small group) | 10 | 20 | 6,000 | $47–$132 | ₱2,726–₱7,656 |
| Department rollout | 50 | 20 | 30,000 | $90–$350 | ₱5,220–₱20,300 |
| Enterprise scale | 200 | 20 | 120,000 | $250–$1,000 | ₱14,500–₱58,000 |

Note: DMS, S3, Glue, and Athena costs remain relatively fixed across scenarios. The primary cost driver at scale is Bedrock token usage.

### 7.3 Cost Optimization Strategies

| Strategy | Potential Savings | Implementation |
|---|---|---|
| Use cost-optimized model (Haiku or Nova Lite) | 50–85% reduction in Bedrock cost | Environment variable change |
| Cache frequent/repeated questions | 20–40% reduction in Bedrock calls | Add caching layer in Lambda |
| Parquet compression (Snappy/ZSTD) | Reduce S3 storage and Athena scan costs | DMS output configuration |
| Partition data by date | Reduce Athena scan per query | S3 folder structure + Glue partitioning |
| DMS Serverless (instead of fixed instance) | Save ~$10–$15/mo if CDC volume is low | Switch DMS deployment mode |
| API Gateway rate limiting | Prevent cost spikes from excessive usage | Configure throttling per user |

### 7.4 Total Cost of Ownership Summary

| Cost Category | POC (Monthly) | Notes |
|---|---|---|
| AWS infrastructure | $32–$33 | DMS + S3 + Glue + Athena + supporting services (fixed) |
| AI layer (variable) | $15–$100 | Bedrock + Lambda (scales with usage and model choice) |
| Development effort | One-time | 7–12 weeks of team effort for POC build |
| Ongoing maintenance | Minimal | Managed services; primarily prompt tuning and monitoring |
| **Total recurring** | **$47–$132/month** | |

*Pricing sources: AWS DMS, S3, Athena, Lambda, Bedrock, API Gateway, Secrets Manager, KMS pricing pages (as of May 2026). Exchange rate: ₱58 = $1 USD. All estimates are approximate and may vary by region and actual usage patterns.*


## 8. Conclusion

This feasibility study confirms that implementing a Generative AI-powered analytics insights platform for OEE is technically viable, operationally manageable, and financially practical using a fully managed AWS serverless architecture.

The proposed system addresses a clear gap in IMI's current analytics capability — transforming static, tabular OEE data into an interactive, natural language interface that delivers data-grounded insights to engineers and executives in seconds. The estimated monthly cost of $47–$132 (₱2,700–₱7,700) for the POC is minimal relative to the potential value in faster decision-making and reduced manual analysis effort.

Beyond the immediate AI insights use case, the data lake established in this project creates a reusable foundation for future analytics, reporting, and data engineering initiatives across the organization.

The recommended next step is to proceed with Phase 1 (data lake setup from MSSQL) and validate the end-to-end flow within the 8-week POC timeline.
