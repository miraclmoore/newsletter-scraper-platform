import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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

interface ProfileSettingsProps {
  user: User;
  onUpdate: (user: User) => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email_notifications: user.preferences.email_notifications,
    digest_frequency: user.preferences.digest_frequency,
    theme: user.preferences.theme
  });
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        onUpdate(data.user);
      } else {
        throw new Error(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/users/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      } else {
        throw new Error(data.message || 'Failed to update password');
      }
    } catch (err) {
      setPasswordMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to update password' 
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
        
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <Input
              type="email"
              value={user.email}
              disabled
              className="w-full bg-gray-50 cursor-not-allowed"
            />
            <p className="text-sm text-gray-500 mt-1">
              Email address cannot be changed. Contact support if needed.
            </p>
          </div>

          {message && (
            <div className={`p-3 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </Card>

      {/* Preferences */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Notifications
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="email_notifications"
                checked={formData.email_notifications}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  email_notifications: e.target.checked 
                }))}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="email_notifications" className="text-sm text-gray-700">
                Receive email notifications about new newsletters
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Digest Frequency
            </label>
            <select
              value={formData.digest_frequency}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                digest_frequency: e.target.value as 'daily' | 'weekly' | 'disabled'
              }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="disabled">Disabled</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              How often you want to receive digest emails
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme
            </label>
            <select
              value={formData.theme}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                theme: e.target.value as 'light' | 'dark' | 'auto'
              }))}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
        
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <Input
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData(prev => ({ 
                ...prev, 
                current_password: e.target.value 
              }))}
              placeholder="Enter your current password"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <Input
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData(prev => ({ 
                ...prev, 
                new_password: e.target.value 
              }))}
              placeholder="Enter your new password"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData(prev => ({ 
                ...prev, 
                confirm_password: e.target.value 
              }))}
              placeholder="Confirm your new password"
              className="w-full"
            />
          </div>

          {passwordMessage && (
            <div className={`p-3 rounded-md ${
              passwordMessage.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          <Button 
            type="submit" 
            disabled={passwordLoading || !passwordData.current_password || !passwordData.new_password}
            className="w-full sm:w-auto"
          >
            {passwordLoading ? 'Updating...' : 'Change Password'}
          </Button>
        </form>
      </Card>

      {/* Account Info */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Account ID:</span>
            <span className="font-mono text-gray-900">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since:</span>
            <span className="text-gray-900">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProfileSettings;