import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';

interface Source {
  id: string;
  name: string;
  type: 'rss' | 'email';
  url?: string;
  email_address?: string;
  is_active: boolean;
  created_at: string;
  last_polled_at?: string;
  last_item_at?: string;
  item_count: number;
}

const SourceManagement: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', url: '', email_address: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/sources', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSources(data.sources || []);
      } else {
        throw new Error('Failed to fetch sources');
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
      setMessage({ type: 'error', text: 'Failed to load sources' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceStatus = async (sourceId: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/users/sources/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !isActive })
      });

      if (response.ok) {
        setSources(prev => prev.map(source => 
          source.id === sourceId 
            ? { ...source, is_active: !isActive }
            : source
        ));
        setMessage({ 
          type: 'success', 
          text: `Source ${!isActive ? 'enabled' : 'disabled'} successfully` 
        });
      } else {
        throw new Error('Failed to update source');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update source status' });
    }
  };

  const startEditing = (source: Source) => {
    setEditingSource(source.id);
    setEditForm({
      name: source.name,
      url: source.url || '',
      email_address: source.email_address || ''
    });
  };

  const cancelEditing = () => {
    setEditingSource(null);
    setEditForm({ name: '', url: '', email_address: '' });
  };

  const saveSource = async (sourceId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/users/sources/${sourceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const data = await response.json();
        setSources(prev => prev.map(source => 
          source.id === sourceId ? data.source : source
        ));
        setEditingSource(null);
        setMessage({ type: 'success', text: 'Source updated successfully' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update source');
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : 'Failed to update source' 
      });
    }
  };

  const deleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Are you sure you want to delete "${sourceName}"? This action cannot be undone and will remove all associated newsletter items.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/users/sources/${sourceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSources(prev => prev.filter(source => source.id !== sourceId));
        setMessage({ type: 'success', text: 'Source deleted successfully' });
      } else {
        throw new Error('Failed to delete source');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete source' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Source Management</h2>
          <Button onClick={() => window.location.href = '/sources'}>
            Add New Source
          </Button>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {sources.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-5xl mb-4">📡</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Sources Yet</h3>
            <p className="text-gray-500 mb-4">
              Add your first newsletter source to start collecting content
            </p>
            <Button onClick={() => window.location.href = '/sources'}>
              Add Source
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <Card key={source.id} className="p-4 border">
                {editingSource === source.id ? (
                  // Edit form
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <Input
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Source name"
                      />
                    </div>
                    
                    {source.type === 'rss' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          RSS URL
                        </label>
                        <Input
                          value={editForm.url}
                          onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                          placeholder="https://example.com/feed.xml"
                        />
                      </div>
                    )}
                    
                    {source.type === 'email' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <Input
                          value={editForm.email_address}
                          onChange={(e) => setEditForm(prev => ({ ...prev, email_address: e.target.value }))}
                          placeholder="newsletter@example.com"
                        />
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button onClick={() => saveSource(source.id)}>
                        Save
                      </Button>
                      <Button variant="outline" onClick={cancelEditing}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Display view
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-medium text-gray-900">{source.name}</h3>
                        <Badge variant={source.type === 'rss' ? 'default' : 'secondary'}>
                          {source.type.toUpperCase()}
                        </Badge>
                        <Badge variant={source.is_active ? 'success' : 'destructive'}>
                          {source.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        {source.url && (
                          <div>
                            <span className="font-medium">URL:</span> {source.url}
                          </div>
                        )}
                        {source.email_address && (
                          <div>
                            <span className="font-medium">Email:</span> {source.email_address}
                          </div>
                        )}
                        <div className="flex space-x-4">
                          <span>
                            <span className="font-medium">Items:</span> {source.item_count}
                          </span>
                          {source.last_item_at && (
                            <span>
                              <span className="font-medium">Last item:</span>{' '}
                              {new Date(source.last_item_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSourceStatus(source.id, source.is_active)}
                      >
                        {source.is_active ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditing(source)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteSource(source.id, source.name)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Source Statistics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{sources.length}</div>
            <div className="text-sm text-gray-500">Total Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {sources.filter(s => s.is_active).length}
            </div>
            <div className="text-sm text-gray-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {sources.filter(s => s.type === 'rss').length}
            </div>
            <div className="text-sm text-gray-500">RSS Feeds</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {sources.filter(s => s.type === 'email').length}
            </div>
            <div className="text-sm text-gray-500">Email Sources</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SourceManagement;