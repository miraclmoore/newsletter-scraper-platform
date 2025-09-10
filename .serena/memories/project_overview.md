# Newsletter Scraper Project Overview

## Purpose
Newsletter aggregation and parsing platform that consolidates newsletters from multiple sources (email, RSS) into a clean, unified feed with AI-powered features.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT, OAuth 2.0 (Google, Microsoft), Supabase Auth
- **APIs**: Gmail API, Microsoft Graph API, OpenAI API
- **Background Jobs**: Bull Queue with Redis
- **Security**: Helmet, bcrypt, encrypted token storage
- **Testing**: Jest, Supertest

## Project Structure
```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware  
├── models/          # Database models (Supabase)
├── routes/          # API routes
├── services/        # Business logic services
├── utils/           # Utility functions
└── workers/         # Background job workers

docs/
├── stories/         # Feature stories (1.1-1.8)
├── architecture/    # Technical architecture docs
└── prd/             # Product requirements

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── e2e/             # End-to-end tests
```

## Development Status
- ✅ **Story 1.1**: OAuth Integration (Gmail/Outlook) - COMPLETED
- ✅ **Story 1.2**: Email Forwarding Integration - COMPLETED  
- 🚧 **Story 1.3**: RSS Integration - NEXT TO RESUME
- 📋 **Stories 1.4-1.8**: Newsletter Dashboard, Parsing Engine, Export, AI Summarization, Account Management