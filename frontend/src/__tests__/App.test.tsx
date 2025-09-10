import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Mock child components
jest.mock('../components/Dashboard', () => ({
  Dashboard: ({ user, onLogout }: any) => (
    <div data-testid="dashboard">
      <div data-testid="dashboard-user-email">{user.email}</div>
      <button onClick={onLogout} data-testid="dashboard-logout">
        Logout
      </button>
    </div>
  )
}));

jest.mock('../components/LoginForm', () => ({
  LoginForm: ({ onLogin }: any) => (
    <form
      data-testid="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        onLogin('test@example.com', 'password123');
      }}
    >
      <button type="submit">Login</button>
    </form>
  )
}));

jest.mock('../components/LoadingSpinner', () => ({
  LoadingSpinner: ({ message }: any) => (
    <div data-testid="loading-spinner">{message}</div>
  )
}));

// Mock fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('shows loading spinner initially', () => {
    render(<App />);
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading Newsletter Scraper...')).toBeInTheDocument();
  });

  it('shows login form when not authenticated', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Newsletter Scraper')).toBeInTheDocument();
      expect(screen.getByText('Aggregate and manage your newsletters in one place')).toBeInTheDocument();
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });
  });

  it('shows dashboard when user is authenticated from localStorage', async () => {
    const userData = { id: 'user123', email: 'stored@example.com' };
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'stored-token';
      if (key === 'userData') return JSON.stringify(userData);
      return null;
    });

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-user-email')).toHaveTextContent('stored@example.com');
    });
  });

  it('handles successful login', async () => {
    const loginResponse = {
      success: true,
      token: 'login-token',
      user: { id: 'user456', email: 'login@example.com' }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(loginResponse)
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    const loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: 'test@example.com', 
          password: 'password123' 
        }),
      });
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', 'login-token');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('userData', JSON.stringify(loginResponse.user));
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
  });

  it('handles login failure with error message', async () => {
    const errorResponse = {
      message: 'Invalid credentials'
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve(errorResponse)
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    const loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    });
  });

  it('handles network errors during login', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    const loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('handles logout', async () => {
    const userData = { id: 'user123', email: 'test@example.com' };
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'token';
      if (key === 'userData') return JSON.stringify(userData);
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    const logoutButton = screen.getByTestId('dashboard-logout');
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userData');
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    });
  });

  it('handles invalid stored user data', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'authToken') return 'token';
      if (key === 'userData') return 'invalid-json';
      return null;
    });

    render(<App />);

    await waitFor(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('userData');
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('handles invalid login response format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: false, // No token provided
      })
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    const loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(screen.getByText('Invalid response from server')).toBeInTheDocument();
    });
  });

  it('clears error message on successful login', async () => {
    // First, trigger an error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: 'Login failed' })
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    let loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });

    // Then, successful login should clear the error
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        token: 'token',
        user: { id: 'user', email: 'test@example.com' }
      })
    });

    loginForm = screen.getByTestId('login-form');
    fireEvent.submit(loginForm);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Login failed')).not.toBeInTheDocument();
    });
  });

  it('maintains proper page structure and headings', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Newsletter Scraper');
    });

    const description = screen.getByText('Aggregate and manage your newsletters in one place');
    expect(description).toBeInTheDocument();
  });
});