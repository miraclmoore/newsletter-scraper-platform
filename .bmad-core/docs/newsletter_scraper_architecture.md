# Newsletter Scraper Architecture Blueprint

---

## High-Level Architecture

```
+-----------------------+        +--------------------+        +-------------------+
|  Web App (React)      | <----> |  REST API (Node)   | <----> |  Postgres (RDS)    |
|  Auth, Dashboard      |        |  Services Layer    |        |  Users/Sources/... |
+----------+------------+        +----+-----------+---+        +---------+---------+
           |                         |           |                        |
           v                         v           v                        v
   +---------------+       +----------------+  +-----------------+  +------------------+
   | OAuth Brokers |       | Ingestion Jobs |  | Parse/Normalize |  | Summarize (LLM) |
   | Gmail/Outlook |       | (Queue workers)|  | HTML→Clean Text |  | Headline+Bullets|
   +-------+-------+       +-------+--------+  +---------+-------+  +---------+--------+
           |                       |                     |                    |
           v                       v                     v                    v
   +---------------+       +---------------+     +--------------+      +-------------+
   | Provider APIs |  -->  | Object Store  | <-- |  Dedupe      | ---> | Exporters   |
   | (IMAP/REST)   |       | (S3/GCS: raw) |     |  (hash/sim)  |      | Notion/CSV  |
   +---------------+       +---------------+     +--------------+      +-------------+

Observability: OpenTelemetry → Grafana/Prometheus; Logging: JSON logs → CloudWatch/Stackdriver
Queue: SQS / Cloud Tasks / Redis RQ
```

---

## Core Components
1. **Web App (React/Tailwind)**: Auth, feed, settings, exports.
2. **API (Node/Express)**: CRUD for sources, items, exports; auth; Stripe billing.
3. **Ingestion Layer**: Gmail/Outlook APIs, IMAP, RSS, Forwarding inbox.
4. **Parsing/Normalization**: Extract main text, remove ads, canonicalize links.
5. **Deduplication**: Hash + SimHash/MinHash for near-duplicate detection.
6. **Summarization**: GPT-based headline + 3-bullet summary.
7. **Exporters**: Markdown/CSV (sync), Notion/Slack (async jobs).
8. **Storage**: Postgres (structured), S3/GCS (raw), Redis (cache/queue).
9. **Background Jobs**: Queue-based workers for ingest/parse/summarize/export.
10. **Observability**: Metrics, logging, alerts, tracing.

---

## Data Model (simplified)
- Users, OAuth credentials, Sources, Items, Summaries, Exports, Jobs.
- Indexes on user_id, source_id, normalized_hash, tsvector for search.

---

## Ingestion Strategies
- Gmail/Outlook via REST APIs with cursors/historyId or delta queries.
- IMAP fallback (Newsletter folder).
- RSS polling with ETag/Last-Modified.
- Forward-to-inbox via SES/SendGrid aliases.

---

## Parsing & Normalization
- MIME decode → select HTML part → sanitize → Readability extract.
- Remove footers/unsubscribe/ads; normalize links.
- Generate hash + fingerprint for dedupe.

---

## Deduplication
- Exact dupe: normalized_hash unique.
- Near dupes: SimHash/MinHash on shingles.
- UI: collapse duplicates.

---

## Summarization
- Async jobs, prompt for title + 3 bullets.
- Chunk long content, cache by hash+model.
- Cap tokens and requests per user.

---

## Exports
- Markdown/CSV sync.
- Notion API async.
- Slack digest in Phase 2.

---

## Security & Compliance
- OAuth least-privilege, encrypted tokens.
- Encrypt data at rest, GDPR-style deletion.
- Rate limit per-user and per-IP.

---

## Performance & Scaling
- Stateless API, autoscale workers.
- Object storage for raw payloads.
- Postgres search, later Meilisearch/Elastic.

---

## Deployment
- AWS/GCP: Cloud Run/ECS, RDS, S3, SQS, Redis.
- CI/CD via GitHub Actions.
- TLS + WAF.

---

## Cost Estimate
- $300–600/mo pre-scale (infra + LLM).

---

## API Examples
- `POST /sources`, `GET /feed`, `POST /exports`, `POST /items/:id/summarize`.

---

## Rollout Phases
- Phase 1 (MVP): Gmail/Outlook/RSS/Forwarding → Feed → Markdown/CSV → Summaries.
- Phase 2: Notion/Slack, digests, better search.
- Phase 3: Teams, Chrome clipper, enterprise Outlook.
