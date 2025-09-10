#!/bin/bash

# Newsletter Scraper Platform - Automated Deployment Commands
# Run this after creating your GitHub repository

echo "🚀 Newsletter Scraper Platform - Automated Git Setup"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "src/server.js" ]; then
    echo "❌ Error: Please run this from the newsletter-scraper directory"
    echo "Usage: cd /Users/chanmoore/dev/newsletter-scraper && ./deploy-commands.sh"
    exit 1
fi

# Get GitHub username
echo "📝 Please enter your GitHub username:"
read -p "GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ GitHub username is required"
    exit 1
fi

echo ""
echo "🔧 Setting up git repository..."

# Initialize git if not already done
if [ ! -d ".git" ]; then
    git init
    echo "✅ Git repository initialized"
else
    echo "ℹ️  Git repository already exists"
fi

# Add all files
git add .
echo "✅ Files added to git"

# Commit
git commit -m "🚀 Newsletter Scraper Platform - Production Ready

- All 8 stories implemented and tested
- Railway deployment configuration ready
- Production environment variables configured
- Health checks and monitoring enabled
- API documentation included
- Security middleware active

Ready for immediate deployment to Railway!"

echo "✅ Files committed"

# Set main branch
git branch -M main
echo "✅ Main branch set"

# Add remote origin
REPO_URL="https://github.com/$GITHUB_USERNAME/newsletter-scraper-platform.git"
git remote remove origin 2>/dev/null || true
git remote add origin $REPO_URL
echo "✅ Remote origin added: $REPO_URL"

# Push to GitHub
echo ""
echo "🚀 Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 SUCCESS! Your code is now on GitHub"
    echo "📁 Repository: $REPO_URL"
    echo ""
    echo "🚄 Next steps:"
    echo "1. Go to https://railway.app"
    echo "2. Click 'Deploy from GitHub repo'"
    echo "3. Select 'newsletter-scraper-platform'"
    echo "4. Add environment variables from DEPLOY_NOW.md"
    echo "5. Your app will be live in ~5 minutes!"
    echo ""
    echo "📖 Full instructions: Check DEPLOY_NOW.md file"
else
    echo "❌ Push failed. Please check:"
    echo "1. GitHub repository exists: $REPO_URL"
    echo "2. You have push permissions"
    echo "3. Repository name is correct"
    echo ""
    echo "💡 You can also push manually:"
    echo "git remote set-url origin $REPO_URL"
    echo "git push -u origin main"
fi

echo ""
echo "🌟 Your Newsletter Scraper Platform is ready for Railway deployment!"