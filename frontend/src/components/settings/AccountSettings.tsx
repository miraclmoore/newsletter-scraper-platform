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

interface AccountSettingsProps {
  user: User;
  onUpdate: () => void;
}

const AccountSettings: React.FC<AccountSettingsProps> = ({ user, onUpdate }) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExportData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/users/export-data', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `newsletter-data-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setMessage({ type: 'success', text: 'Data exported successfully!' });
      } else {
        throw new Error('Failed to export data');
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to export data' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type "DELETE" to confirm account deletion' });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('/api/users/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Clear auth token and redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login?message=Account deleted successfully';
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete account');
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to delete account' 
      });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Export</h2>
        <p className="text-gray-600 mb-4">
          Download all your data including sources, newsletter items, and preferences. 
          This file will be in JSON format and can be used for backup or migration purposes.
        </p>
        
        {message && message.text.includes('export') && (
          <div className={`mb-4 p-3 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <Button 
          onClick={handleExportData}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? 'Exporting...' : 'Export My Data'}
        </Button>
      </Card>

      {/* Privacy & Security */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy & Security</h2>
        
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-xl">🔒</div>
            <div>
              <h3 className="font-medium text-gray-900">Data Encryption</h3>
              <p className="text-sm text-gray-600">
                All your data is encrypted at rest and in transit using industry-standard encryption.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 text-xl">🛡️</div>
            <div>
              <h3 className="font-medium text-gray-900">Privacy Policy</h3>
              <p className="text-sm text-gray-600">
                We never sell your data or share it with third parties without your consent.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="text-purple-500 text-xl">📊</div>
            <div>
              <h3 className="font-medium text-gray-900">Data Usage</h3>
              <p className="text-sm text-gray-600">
                Your newsletter data is only used to provide the service and improve your experience.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Deletion */}
      <Card className="p-6 border-red-200">
        <h2 className="text-xl font-semibold text-red-600 mb-4">Danger Zone</h2>
        
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="font-medium text-red-800 mb-2">Delete Account</h3>
            <p className="text-sm text-red-600 mb-4">
              Permanently delete your account and all associated data. This action cannot be undone.
              All your sources, newsletter items, preferences, and account information will be permanently removed.
            </p>
            
            {!showDeleteConfirm ? (
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-1">
                    Type "DELETE" to confirm account deletion:
                  </label>
                  <Input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="Type DELETE here"
                    className="w-full border-red-300 focus:border-red-500 focus:ring-red-500"
                  />
                </div>

                {message && message.text.includes('delete') && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700">
                    {message.text}
                  </div>
                )}

                <div className="flex space-x-3">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={loading || deleteConfirmation !== 'DELETE'}
                  >
                    {loading ? 'Deleting...' : 'Permanently Delete Account'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmation('');
                      setMessage(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Account Information */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
        
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-medium text-gray-700">Account ID:</span>
              <div className="font-mono text-xs text-gray-600 break-all">{user.id}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Email:</span>
              <div className="text-gray-600">{user.email}</div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Member Since:</span>
              <div className="text-gray-600">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Account Age:</span>
              <div className="text-gray-600">
                {Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AccountSettings;