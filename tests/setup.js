// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';

// Mock console.log in tests to reduce noise
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn((message) => {
    // Only show error logs in test output if they contain "Test Error"
    if (message && message.includes && message.includes('Test Error')) {
      originalError(message);
    }
  });
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});