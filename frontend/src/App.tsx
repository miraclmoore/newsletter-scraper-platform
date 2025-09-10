import React from 'react';
import { LoginForm } from './components/LoginForm';

function App() {
  const handleLogin = (email: string, password: string) => {
    console.log('Login attempt:', { email, password });
    // TODO: Implement actual login logic with backend API
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Scraper</h1>
          <p className="text-muted-foreground mt-2">
            Aggregate and manage your newsletters in one place
          </p>
        </div>
        <LoginForm onLogin={handleLogin} />
      </div>
    </div>
  );
}

export default App;