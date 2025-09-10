# Development Commands

## Package Management
```bash
npm install                    # Install dependencies
npm run dev                   # Development with nodemon
npm start                     # Production mode
```

## Testing
```bash
npm test                      # Run all tests
npm run test:watch           # Watch mode for tests
npm run test:coverage        # Generate coverage report
```

## Git Operations
```bash
git status                    # Check working directory status
git add .                     # Stage all changes
git commit -m "message"       # Commit changes
git push origin main          # Push to main branch
```

## Database
- Supabase web interface for schema management
- SQL files in `supabase/` directory
- `create-tables.js` for local setup

## Environment
- `.env.example` template available
- `.env.test` for test environment
- Supabase keys and OAuth credentials required

## Development Workflow
1. Feature branches from main
2. Jest tests required for new features
3. Follow existing code patterns and conventions