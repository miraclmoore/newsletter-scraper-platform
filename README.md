# Newsletter Scraper

A modern newsletter aggregation and parsing platform that helps you consolidate newsletters from multiple sources into one clean feed.

## 🚀 Features

- **OAuth Integration**: Connect Gmail and Outlook accounts securely
- **Email Forwarding**: Get unique forwarding addresses for newsletters
- **RSS Support**: Subscribe to RSS/Atom feeds from platforms like Substack
- **Smart Parsing**: Clean newsletter content with AI-powered extraction
- **Export Options**: Export to Markdown, CSV, and Notion
- **AI Summaries**: Generate headlines and bullet-point summaries
- **Search & Filter**: Find content across all your newsletters

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: JWT, OAuth 2.0 (Google, Microsoft), Supabase Auth
- **APIs**: Gmail API, Microsoft Graph API, OpenAI API
- **Security**: Helmet, bcrypt, encrypted token storage, Row Level Security
- **Testing**: Jest, Supertest

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

### ✅ Completed Features (Story 1.1)
- OAuth 2.0 integration for Gmail and Outlook
- Secure token storage with encryption
- User registration and authentication
- Rate limiting and security middleware
- Comprehensive test coverage

### 🚧 In Development
- Email forwarding system
- RSS feed integration
- Newsletter parsing engine
- Web dashboard
- Export functionality
- AI summarization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For questions and support, please open an issue on the GitHub repository.