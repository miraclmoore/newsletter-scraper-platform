const OpenAI = require('openai');
const { encoding_for_model } = require('tiktoken');

/**
 * AI Summary Service
 * Generates newsletter summaries using OpenAI GPT models
 */
class SummaryService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Configuration
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = 200; // For summary output
    this.maxInputTokens = 8000; // For input content (leave room for prompt)
    this.temperature = 0.1; // Low temperature for consistent summaries
    
    // Usage limits per user per month
    this.monthlyLimits = {
      free: { requests: 50, tokens: 50000 },
      pro: { requests: 500, tokens: 500000 },
      premium: { requests: 2000, tokens: 2000000 }
    };
    
    // Initialize tokenizer for the model
    try {
      this.encoder = encoding_for_model(this.model);
    } catch (error) {
      console.warn('Failed to load tokenizer, using approximate counting:', error.message);
      this.encoder = null;
    }
    
    // Summary prompt template
    this.promptTemplate = `You are an expert at summarizing newsletter content. Create a concise, informative summary with:

1. A compelling headline (max 80 characters)
2. Exactly 3 bullet points highlighting key insights

Format your response as JSON:
{
  "headline": "Your compelling headline here",
  "bullets": [
    "First key point or insight",
    "Second important takeaway", 
    "Third significant highlight"
  ]
}

Newsletter content:
---
{content}
---

Remember: Keep it concise, actionable, and focus on the most valuable information for the reader.`;
  }

  /**
   * Generate summary for newsletter content
   * @param {string} content - Newsletter content (text or HTML)
   * @param {Object} options - Generation options
   * @returns {Object} Generated summary
   */
  async generateSummary(content, options = {}) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      if (!content || content.trim().length < 50) {
        throw new Error('Content too short for meaningful summarization');
      }

      // Extract text content if HTML
      const textContent = this.extractTextFromContent(content);
      
      // Check and truncate content if too long
      const processedContent = this.prepareContentForSummarization(textContent);
      
      // Count input tokens
      const inputTokens = this.countTokens(processedContent);
      
      // Generate summary using OpenAI
      const startTime = Date.now();
      const summary = await this.callOpenAI(processedContent, options);
      const processingTime = Date.now() - startTime;
      
      // Validate summary format
      const validatedSummary = this.validateSummaryFormat(summary);
      
      // Count output tokens
      const outputTokens = this.countTokens(JSON.stringify(validatedSummary));
      
      return {
        ...validatedSummary,
        metadata: {
          model: this.model,
          tokensUsed: inputTokens + outputTokens,
          inputTokens,
          outputTokens,
          processingTime,
          generatedAt: new Date().toISOString(),
          contentLength: textContent.length,
          success: true
        }
      };

    } catch (error) {
      console.error('Summary generation failed:', error);
      
      return {
        headline: 'Summary Generation Failed',
        bullets: [
          'Unable to generate AI summary at this time',
          'Please try again later or contact support',
          'The full newsletter content is still available'
        ],
        metadata: {
          model: this.model,
          tokensUsed: 0,
          inputTokens: 0,
          outputTokens: 0,
          processingTime: 0,
          generatedAt: new Date().toISOString(),
          contentLength: content.length,
          success: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Call OpenAI API with retry logic
   * @param {string} content - Processed content
   * @param {Object} options - Options
   * @returns {Object} API response
   */
  async callOpenAI(content, options = {}) {
    const prompt = this.promptTemplate.replace('{content}', content);
    
    const requestOptions = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant specialized in summarizing newsletter content.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || this.maxTokens,
      temperature: options.temperature || this.temperature,
      response_format: { type: 'json_object' }
    };

    // Retry logic for API failures
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.openai.chat.completions.create(requestOptions);
        
        if (!response.choices || response.choices.length === 0) {
          throw new Error('No response choices returned from OpenAI');
        }
        
        const content = response.choices[0].message.content;
        return JSON.parse(content);
        
      } catch (error) {
        lastError = error;
        
        // Handle specific error types
        if (error.status === 429) {
          // Rate limit - wait longer between retries
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited, waiting ${waitTime}ms before retry ${attempt}/3`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (error.status >= 500) {
          // Server error - retry
          console.log(`Server error ${error.status}, retrying ${attempt}/3`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Client error or other - don't retry
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Extract plain text from content (HTML or text)
   * @param {string} content - Raw content
   * @returns {string} Plain text
   */
  extractTextFromContent(content) {
    if (!content) return '';
    
    // If content looks like HTML, strip tags
    if (content.includes('<') && content.includes('>')) {
      return content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    return content.trim();
  }

  /**
   * Prepare content for summarization (chunking if needed)
   * @param {string} content - Text content
   * @returns {string} Processed content
   */
  prepareContentForSummarization(content) {
    const tokens = this.countTokens(content);
    
    if (tokens <= this.maxInputTokens) {
      return content;
    }
    
    // Content too long - need to chunk/truncate
    console.log(`Content too long (${tokens} tokens), truncating to ${this.maxInputTokens} tokens`);
    
    // Simple truncation - keep first part of content
    // TODO: Implement smarter chunking (e.g., by paragraphs, sentences)
    const words = content.split(' ');
    const estimatedWordsPerToken = 0.75; // Rough estimate
    const maxWords = Math.floor(this.maxInputTokens * estimatedWordsPerToken);
    
    if (words.length > maxWords) {
      return words.slice(0, maxWords).join(' ') + '...';
    }
    
    return content;
  }

  /**
   * Count tokens in text
   * @param {string} text - Text to count
   * @returns {number} Token count
   */
  countTokens(text) {
    if (!text) return 0;
    
    if (this.encoder) {
      try {
        const tokens = this.encoder.encode(text);
        return tokens.length;
      } catch (error) {
        console.warn('Token counting failed, using approximation:', error.message);
      }
    }
    
    // Fallback: approximate token count (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate and fix summary format
   * @param {Object} summary - Raw summary from AI
   * @returns {Object} Validated summary
   */
  validateSummaryFormat(summary) {
    const validated = {
      headline: '',
      bullets: []
    };

    // Validate headline
    if (summary.headline && typeof summary.headline === 'string') {
      validated.headline = summary.headline.trim();
      
      // Truncate if too long
      if (validated.headline.length > 120) {
        validated.headline = validated.headline.substring(0, 117) + '...';
      }
    } else {
      validated.headline = 'Newsletter Summary';
    }

    // Validate bullets
    if (Array.isArray(summary.bullets)) {
      validated.bullets = summary.bullets
        .filter(bullet => bullet && typeof bullet === 'string')
        .map(bullet => bullet.trim())
        .slice(0, 3); // Ensure exactly 3 bullets
    }

    // Ensure we have exactly 3 bullets
    while (validated.bullets.length < 3) {
      validated.bullets.push('Key insights available in full content');
    }

    // Truncate long bullets
    validated.bullets = validated.bullets.map(bullet => {
      if (bullet.length > 150) {
        return bullet.substring(0, 147) + '...';
      }
      return bullet;
    });

    return validated;
  }

  /**
   * Check if user can generate summary (usage limits)
   * @param {string} userId - User ID
   * @param {string} userTier - User tier (free, pro, premium)
   * @param {number} estimatedTokens - Estimated tokens for this request
   * @returns {Object} Usage check result
   */
  async checkUsageLimits(userId, userTier = 'free', estimatedTokens = 500) {
    try {
      const limits = this.monthlyLimits[userTier] || this.monthlyLimits.free;
      const currentUsage = await this.getCurrentUsage(userId);
      
      const canMakeRequest = currentUsage.requests < limits.requests;
      const canUseTokens = (currentUsage.tokens + estimatedTokens) <= limits.tokens;
      
      return {
        allowed: canMakeRequest && canUseTokens,
        limits,
        currentUsage,
        estimatedTokens,
        reason: !canMakeRequest 
          ? `Monthly request limit reached (${limits.requests})`
          : !canUseTokens 
            ? `Monthly token limit would be exceeded (${limits.tokens})`
            : null
      };
    } catch (error) {
      console.error('Usage limit check failed:', error);
      return {
        allowed: false,
        reason: 'Unable to check usage limits'
      };
    }
  }

  /**
   * Get current usage for user (placeholder - needs database implementation)
   * @param {string} userId - User ID
   * @returns {Object} Current usage
   */
  async getCurrentUsage(userId) {
    // TODO: Implement actual database query
    // This would query a usage tracking table
    return {
      requests: 0,
      tokens: 0,
      month: new Date().getMonth(),
      year: new Date().getFullYear()
    };
  }

  /**
   * Track usage for billing/limits (placeholder)
   * @param {string} userId - User ID
   * @param {number} tokensUsed - Tokens consumed
   * @returns {Promise} Tracking result
   */
  async trackUsage(userId, tokensUsed) {
    // TODO: Implement usage tracking
    console.log(`Usage tracked for user ${userId}: ${tokensUsed} tokens`);
  }

  /**
   * Get health status of AI service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          status: 'unhealthy',
          message: 'OpenAI API key not configured',
          timestamp: new Date().toISOString()
        };
      }

      // Test with a minimal request
      const testContent = 'This is a test newsletter with some basic content to verify the AI service is working.';
      const startTime = Date.now();
      
      await this.generateSummary(testContent, { maxTokens: 50 });
      
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        model: this.model,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new SummaryService();