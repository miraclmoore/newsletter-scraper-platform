# Core Components
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