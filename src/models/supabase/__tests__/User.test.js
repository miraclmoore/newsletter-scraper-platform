const UserModel = require('../User');

// Mock Supabase client
jest.mock('../../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis()
  }
}));

const { supabaseAdmin } = require('../../../config/supabase');

describe('UserModel (Supabase)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        preferences: { aiSummaries: false },
        is_email_verified: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      };

      supabaseAdmin.single.mockResolvedValueOnce({
        data: mockUser,
        error: null
      });

      const userData = {
        email: 'test@example.com',
        password: 'testPassword',
        firstName: 'John',
        lastName: 'Doe'
      };

      const result = await UserModel.create(userData);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(supabaseAdmin.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe',
          password_hash: expect.any(String)
        })
      ]);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        forwardingAddress: undefined,
        preferences: { aiSummaries: false },
        isEmailVerified: false,
        lastLoginAt: undefined,
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      });
    });

    test('should handle creation errors', async () => {
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      await expect(UserModel.create({
        email: 'test@example.com',
        password: 'testPassword'
      })).rejects.toThrow('Database error');
    });
  });

  describe('findByEmail', () => {
    test('should find user by email', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe'
      };

      supabaseAdmin.single.mockResolvedValueOnce({
        data: mockUser,
        error: null
      });

      const result = await UserModel.findByEmail('test@example.com');

      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(supabaseAdmin.eq).toHaveBeenCalledWith('email', 'test@example.com');
      expect(result.email).toBe('test@example.com');
    });

    test('should return null for non-existent user', async () => {
      supabaseAdmin.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const result = await UserModel.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('validatePassword', () => {
    test('should validate correct password', async () => {
      // Mock bcrypt.compare
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true);

      const result = await UserModel.validatePassword('password', 'hashedPassword');
      expect(result).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false);

      const result = await UserModel.validatePassword('wrong', 'hashedPassword');
      expect(result).toBe(false);
    });

    test('should return false for empty password hash', async () => {
      const result = await UserModel.validatePassword('password', null);
      expect(result).toBe(false);
    });
  });

  describe('generateForwardingAddress', () => {
    test('should generate unique forwarding address', () => {
      const userId = 'user-12345678';
      const address = UserModel.generateForwardingAddress(userId);
      
      expect(address).toMatch(/12345678-[a-z0-9]+@newsletters\.app/);
    });
  });

  describe('formatUser', () => {
    test('should format user data correctly', () => {
      const userData = {
        id: 'user-123',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        forwarding_address: 'test@newsletters.app',
        preferences: { theme: 'dark' },
        is_email_verified: true,
        last_login_at: '2023-01-01T00:00:00Z',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        password_hash: 'should-not-be-included'
      };

      const formatted = UserModel.formatUser(userData);

      expect(formatted).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        forwardingAddress: 'test@newsletters.app',
        preferences: { theme: 'dark' },
        isEmailVerified: true,
        lastLoginAt: '2023-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      });

      // Ensure password hash is not included
      expect(formatted.passwordHash).toBeUndefined();
    });

    test('should return null for null input', () => {
      const result = UserModel.formatUser(null);
      expect(result).toBeNull();
    });
  });
});