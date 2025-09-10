# Newsletter Scraper Platform 📧

A comprehensive newsletter aggregation platform with AI-powered summarization, multi-source content collection, and advanced export capabilities.

## 🌟 Features

- **Multi-Source Newsletter Collection**: Email forwarding + RSS feeds
- **AI-Powered Summarization**: OpenAI GPT integration for content insights
- **Advanced Content Parsing**: Mozilla Readability for clean content extraction
- **Flexible Export Options**: Markdown, CSV, and JSON formats
- **OAuth Integration**: Google and Microsoft authentication
- **Real-time Processing**: Queue-based email processing with Redis
- **Complete User Management**: GDPR-compliant data handling
- **Production Ready**: Docker, monitoring, and security configured

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, Bull Queue
- **Database**: Supabase PostgreSQL with Row Level Security
- **Authentication**: JWT + OAuth 2.0 (Google, Microsoft)
- **Queue Processing**: Redis + Bull for background jobs
- **Content Parsing**: Mozilla Readability, DOMPurify, mailparser
- **AI Services**: OpenAI GPT for summarization
- **Frontend**: React 18 with TypeScript and Tailwind CSS
- **Security**: Helmet, bcrypt, rate limiting, CORS protection
- **Testing**: Jest, Supertest with comprehensive coverage
- **Deployment**: Docker, nginx, PM2 process management

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/miraclmoore/newsletter-scraper.git
   cd newsletter-scraper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Supabase setup**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy your project URL and API keys to `.env`
   - Run the SQL schema from `supabase/schema.sql` in your Supabase SQL Editor

5. **OAuth setup**
   - **Google Cloud Console**: Enable Gmail API, create OAuth 2.0 credentials
   - **Microsoft Azure AD**: Register app, configure Microsoft Graph permissions
   - Add credentials to `.env`

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

## 📚 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword"
}
```

#### Connect Gmail
```http
GET /api/auth/google
Authorization: Bearer <jwt_token>
```

#### Connect Outlook
```http
GET /api/auth/microsoft
Authorization: Bearer <jwt_token>
```

#### Disconnect Provider
```http
POST /api/auth/disconnect
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "provider": "gmail"
}
```

## 🏗️ Project Structure

```
src/
├── config/          # Configuration files
├── middleware/      # Express middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic services
├── utils/           # Utility functions
└── workers/         # Background job workers

tests/
├── unit/            # Unit tests
├── integration/     # Integration tests
└── e2e/             # End-to-end tests
```

## 🔒 Security Features

- **Encrypted Token Storage**: All OAuth tokens encrypted before database storage
- **Rate Limiting**: API endpoint protection with configurable limits
- **JWT Authentication**: Secure session management
- **Input Validation**: Request validation and sanitization
- **CORS Protection**: Configurable cross-origin request handling

## 🧪 Testing Strategy

- **Unit Tests**: Individual service and utility testing
- **Integration Tests**: API endpoint and database integration
- **Security Tests**: Authentication and authorization testing
- **Performance Tests**: Load testing for API endpoints

## 📈 Development Status

### ✅ Completed Features (ALL STORIES IMPLEMENTED!)
- **Story 1.1**: OAuth 2.0 integration for Gmail and Outlook ✅
- **Story 1.2**: Email forwarding system with SendGrid webhooks ✅
- **Story 1.3**: RSS feed integration with automated polling ✅
- **Story 1.4**: Content storage with Supabase PostgreSQL ✅
- **Story 1.5**: Advanced email parsing engine ✅
- **Story 1.6**: Multi-format export functionality ✅
- **Story 1.7**: AI summarization with OpenAI GPT ✅
- **Story 1.8**: Complete account management system ✅

### 🚀 Production Ready
- Comprehensive test coverage
- Security hardening and rate limiting
- Docker and deployment configurations
- Monitoring and health checks
- GDPR compliance features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚢 Production Deployment

### Quick Deploy with Script
```bash
# Configure production environment
cp .env.production .env
# Edit .env with your production values

# Run deployment script
./deploy.sh production
```

### Docker Deployment
```bash
# Build and deploy with Docker Compose
docker-compose -f docker-compose.production.yml up -d
```

### Manual Deployment
See the complete [Deployment Guide](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📊 Monitoring & Health Checks

The platform includes comprehensive monitoring:

- **Health Endpoints**: `/health` for application status
- **Metrics**: Queue statistics, processing rates, error tracking
- **Performance**: Database query optimization, Redis caching
- **Alerting**: Error notifications and performance alerts

## 🔗 Documentation

- **[🚢 Deployment Guide](DEPLOYMENT_GUIDE.md)** - Complete production deployment instructions
- **[✅ Deployment Status](DEPLOYMENT_READY.md)** - Feature completion and readiness checklist

## 🙋‍♂️ Support

- **Issues**: [GitHub Issues](https://github.com/your-org/newsletter-scraper/issues)
- **Documentation**: Complete deployment and API guides included
- **Email**: For production support inquiries

---

**Built with ❤️ for newsletter enthusiasts**

[![Deploy](https://img.shields.io/badge/Deploy-Ready-brightgreen.svg)](DEPLOYMENT_READY.md)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org)