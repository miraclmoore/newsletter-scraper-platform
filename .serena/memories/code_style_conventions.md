# Code Style & Conventions

## JavaScript/Node.js Style
- ES6+ features and async/await patterns
- CommonJS modules (`require`/`module.exports`)
- Consistent error handling with try/catch blocks
- Descriptive variable and function names

## File Organization
- Services in `/src/services/` organized by domain
- Routes in `/src/routes/` with clear naming
- Models in `/src/models/` for database entities
- Workers in `/src/workers/` for background jobs
- Utilities in `/src/utils/` for shared functions

## Testing Conventions
- Test files in `__tests__/` directories or `.test.js` suffix
- Jest testing framework with Supertest for API testing
- Setup files in `/tests/setup.js`
- Mock external services and APIs

## Security Patterns
- All OAuth tokens encrypted before storage
- JWT authentication for API endpoints
- Rate limiting on public endpoints
- Input validation and sanitization
- Helmet middleware for security headers

## Database Patterns
- Supabase client for database operations
- Row Level Security (RLS) policies
- Consistent model structure with timestamps
- Proper indexing for performance