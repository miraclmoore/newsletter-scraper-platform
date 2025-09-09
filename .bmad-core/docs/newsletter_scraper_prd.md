# Newsletter Scraper Product Requirements Document (PRD)

---

## 1. 📖 Problem Statement
Email newsletters are valuable sources of insight, but they quickly overwhelm inboxes. Users have no simple way to:
- Aggregate multiple newsletters into one clean feed.
- Remove noise (headers, ads, duplicate content).
- Summarize content quickly for decision-making.
- Export to tools they already use (Notion, Slack, Markdown).

Existing tools (Mailbrew, Readwise, Meco) are either too broad, too expensive, or not focused on simplicity + affordability.

---

## 2. 🎯 Goals & Success Metrics
- Deliver a working MVP that aggregates newsletters in < 6 weeks.
- Achieve **20 paying users within 60 days** of beta.
- Maintain **DAU/WAU > 40%**.
- Keep **churn < 10%** in the first 3 months.

---

## 3. 👥 Target Users
- **Content marketers** tracking industry-specific newsletters.
- **VCs/analysts** consolidating deal flow and market updates.
- **Recruiters** sourcing via niche newsletters.
- **Founders/operators** wanting lightweight digests without inbox clutter.

---

## 4. 📌 User Stories (MVP)

### Input & Integration
- As a user, I can connect Gmail/Outlook via OAuth so my newsletters are auto-imported.
- As a user, I can forward newsletters to a unique address so they appear in my dashboard.
- As a user, I can subscribe to an RSS feed (Substack, Medium) and see it in my dashboard.

### Scraping & Normalization
- As a user, I want email bodies parsed cleanly (no headers/footers/ads) so I only see content.
- As a user, I want duplicate issues removed so my feed is concise.

### Aggregation & Export
- As a user, I can see all newsletters in a web dashboard.
- As a user, I can search/filter by source.
- As a user, I can export items to Markdown, Notion, or CSV.

### AI Summarization
- As a user, I can toggle AI summaries (headline + 3 bullets) for each issue.

### Account Management
- As a user, I can sign up via email or Google.
- As a user, I can manage my connected sources in settings.

---

## 5. 📦 Functional Requirements
- **Ingestion**: Gmail/Outlook API, IMAP, RSS, forwarding inbox.
- **Scraping Engine**: HTML parsing, formatting cleanup, deduplication.
- **Aggregator Dashboard**: React web app with filters, feed view.
- **Exports**: Markdown, Notion API, CSV.
- **Summarization**: OpenAI GPT integration.
- **Billing**: Stripe subscriptions.

---

## 6. 🔒 Non-Functional Requirements
- **Security**: OAuth for inbox connections, encrypted storage for tokens.
- **Performance**: Parse < 2s per email on average.
- **Scalability**: Handle 10k+ newsletters per user/month.
- **Compliance**: Respect Gmail/Outlook API quotas, transparent privacy policy.

---

## 7. 💵 Pricing & Packaging
- Free Tier: 3 sources, 1 export option.
- Pro ($9/mo): 10 sources, AI summaries, unlimited exports.
- Team (later): $49/mo with shared feeds + Slack integration.

---

## 8. 🔌 Integrations Roadmap
**Phase 1 (MVP):** Gmail, Outlook, RSS, forwarding inbox, Markdown export.  
**Phase 2:** Notion export, Slack digest, Zapier webhook.  
**Phase 3:** Discord digest bot, Google Drive sync, Chrome extension.

---

## 9. ⏳ Build Plan
- **Week 1–2:** Gmail/Outlook + forwarding inbox integration.
- **Week 3–4:** Scraper engine + aggregator dashboard.
- **Week 5:** AI summaries + export (Notion/Markdown).
- **Week 6:** Stripe billing + beta launch.

---

## 10. ⚠️ Risks & Assumptions
- Gmail API limits heavy use.
- HTML parsing inconsistent across newsletters.
- Privacy concerns around inbox permissions.
- Competition may move down-market (Mailbrew, Readwise).

---

## ✅ MVP Success Definition
A user can:
1. Connect inbox or forward newsletters.
2. See aggregated issues in a dashboard.
3. Export or summarize them.
4. Pay $9/mo for convenience.
