# High-Level Architecture

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