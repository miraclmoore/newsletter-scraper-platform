import React, { useState, useEffect } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { LoadingSpinner } from './components/LoadingSpinner';

interface User {
  id: string;
  email: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing authentication on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // TODO: Validate token with backend
      // For now, we'll assume token is valid and extract user info
      try {
        // This is a placeholder - in reality, you'd validate the token with your backend
        const userData = localStorage.getItem('userData');
        if (userData) {
          setUser(JSON.parse(userData));
        }
      } catch (err) {
        console.error('Error parsing user data:', err);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      // TODO: Implement actual login logic with backend API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      
      if (data.success && data.token) {
        // Store auth token and user data
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setUser(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner message="Loading Newsletter Scraper..." />
      </div>
    );
  }

  // Show dashboard if user is authenticated
  if (user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  // Show login form if not authenticated
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Scraper</h1>
          <p className="text-muted-foreground mt-2">
            Aggregate and manage your newsletters in one place
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        
        <LoginForm onLogin={handleLogin} />
      </div>
    </div>
  );
}

export default App;