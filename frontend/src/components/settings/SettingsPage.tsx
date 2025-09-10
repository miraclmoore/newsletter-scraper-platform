import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingSpinner } from '../LoadingSpinner';
import ProfileSettings from './ProfileSettings';
import SourceManagement from './SourceManagement';
import AccountSettings from './AccountSettings';
import ExportData from './ExportData';

interface User {
  id: string;
  email: string;
  name?: string;
  created_at: string;
  preferences: {
    email_notifications: boolean;
    digest_frequency: 'daily' | 'weekly' | 'disabled';
    theme: 'light' | 'dark' | 'auto';
  };
}

interface UserStats {
  total_sources: number;
  total_items: number;
  items_this_month: number;
  summaries_generated: number;
  account_age_days: number;
}

const SettingsPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch user profile
      const profileResponse = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profileData = await profileResponse.json();
      setUser(profileData.user);

      // Fetch user stats
      const statsResponse = await fetch('/api/users/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'sources', label: 'Sources', icon: '📡' },
    { id: 'account', label: 'Account', icon: '⚙️' },
    { id: 'export', label: 'Export Data', icon: '📦' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Settings</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchUserData}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No User Data</h2>
            <p className="text-gray-600">Unable to load user information.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account settings and preferences</p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total_sources}</div>
            <div className="text-sm text-gray-500">Sources</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.total_items}</div>
            <div className="text-sm text-gray-500">Total Items</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.items_this_month}</div>
            <div className="text-sm text-gray-500">This Month</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.summaries_generated}</div>
            <div className="text-sm text-gray-500">AI Summaries</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.account_age_days}</div>
            <div className="text-sm text-gray-500">Days Active</div>
          </Card>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:w-1/4">
          <Card className="p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:w-3/4">
          {activeTab === 'profile' && (
            <ProfileSettings 
              user={user} 
              onUpdate={setUser}
            />
          )}
          
          {activeTab === 'sources' && (
            <SourceManagement />
          )}
          
          {activeTab === 'account' && (
            <AccountSettings 
              user={user}
              onUpdate={fetchUserData}
            />
          )}
          
          {activeTab === 'export' && (
            <ExportData />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;