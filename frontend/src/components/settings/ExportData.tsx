import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ExportDataProps {}

const ExportData: React.FC<ExportDataProps> = () => {
  const [exportStats, setExportStats] = useState<{
    total_sources: number;
    total_items: number;
    total_summaries: number;
    oldest_item: string;
    newest_item: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchExportStats();
  }, []);

  const fetchExportStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/users/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setExportStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch export stats:', err);
    }
  };

  const handleExport = async (format: 'json' | 'markdown' | 'csv') => {
    try {
      setLoading(true);
      setMessage(null);
      
      const token = localStorage.getItem('auth_token');
      let endpoint = '/api/users/export-data';
      let filename = `newsletter-data-${new Date().toISOString().split('T')[0]}`;
      
      if (format === 'markdown') {
        endpoint = '/api/exports/markdown';
        filename += '.md';
      } else if (format === 'csv') {
        endpoint = '/api/exports/csv';
        filename += '.csv';
      } else {
        filename += '.json';
      }

      const response = await fetch(endpoint, {
        method: format === 'json' ? 'GET' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        ...(format !== 'json' && {
          body: JSON.stringify({
            filters: {},
            options: {
              include_content: true,
              include_summaries: true,
              group_by_source: true
            }
          })
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setMessage({ type: 'success', text: `${format.toUpperCase()} export completed successfully!` });
      } else {
        throw new Error(`Failed to export ${format.toUpperCase()} data`);
      }
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()} data` 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Overview */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Your Data</h2>
        <p className="text-gray-600 mb-6">
          Download your newsletter data in different formats. All exports include your sources, 
          newsletter items, and AI-generated summaries.
        </p>

        {message && (
          <div className={`mb-4 p-3 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        {exportStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{exportStats.total_sources}</div>
              <div className="text-sm text-gray-500">Sources</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{exportStats.total_items}</div>
              <div className="text-sm text-gray-500">Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{exportStats.total_summaries}</div>
              <div className="text-sm text-gray-500">AI Summaries</div>
            </div>
          </div>
        )}
      </Card>

      {/* Export Formats */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* JSON Export */}
        <Card className="p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">📄</div>
            <h3 className="text-lg font-semibold text-gray-900">JSON Export</h3>
            <Badge variant="default" className="mt-2">Complete Backup</Badge>
          </div>
          
          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Complete account data</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>All metadata preserved</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Machine readable format</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>GDPR compliance ready</span>
            </div>
          </div>

          <Button 
            onClick={() => handleExport('json')}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Exporting...' : 'Export JSON'}
          </Button>

          <p className="text-xs text-gray-500 mt-2">
            Best for backup and data migration
          </p>
        </Card>

        {/* Markdown Export */}
        <Card className="p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">📝</div>
            <h3 className="text-lg font-semibold text-gray-900">Markdown Export</h3>
            <Badge variant="secondary" className="mt-2">Human Readable</Badge>
          </div>
          
          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Formatted content</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Table of contents</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>YAML front matter</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>GitHub/GitLab compatible</span>
            </div>
          </div>

          <Button 
            onClick={() => handleExport('markdown')}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? 'Exporting...' : 'Export Markdown'}
          </Button>

          <p className="text-xs text-gray-500 mt-2">
            Perfect for documentation and sharing
          </p>
        </Card>

        {/* CSV Export */}
        <Card className="p-6">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">📊</div>
            <h3 className="text-lg font-semibold text-gray-900">CSV Export</h3>
            <Badge variant="outline" className="mt-2">Spreadsheet Ready</Badge>
          </div>
          
          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Excel compatible</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Structured data format</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Easy data analysis</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span>Summary statistics</span>
            </div>
          </div>

          <Button 
            onClick={() => handleExport('csv')}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? 'Exporting...' : 'Export CSV'}
          </Button>

          <p className="text-xs text-gray-500 mt-2">
            Ideal for spreadsheet analysis
          </p>
        </Card>
      </div>

      {/* Export Information */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Information</h3>
        
        <div className="space-y-4 text-sm">
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 text-lg">ℹ️</div>
            <div>
              <h4 className="font-medium text-gray-900">What's Included</h4>
              <p className="text-gray-600">
                All exports include your newsletter sources, items, AI-generated summaries, 
                user preferences, and account metadata. Personal information is included 
                for GDPR compliance.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-lg">🔒</div>
            <div>
              <h4 className="font-medium text-gray-900">Privacy & Security</h4>
              <p className="text-gray-600">
                Exports are generated on-demand and not stored on our servers. 
                All data is transferred securely and the download link expires after use.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="text-purple-500 text-lg">⚡</div>
            <div>
              <h4 className="font-medium text-gray-900">Processing Time</h4>
              <p className="text-gray-600">
                Export processing time depends on the amount of data. Most exports complete 
                within a few seconds. Large datasets may take up to a minute.
              </p>
            </div>
          </div>

          {exportStats && exportStats.oldest_item && (
            <div className="flex items-start space-x-3">
              <div className="text-orange-500 text-lg">📅</div>
              <div>
                <h4 className="font-medium text-gray-900">Data Range</h4>
                <p className="text-gray-600">
                  Your newsletter data spans from{' '}
                  <span className="font-medium">
                    {new Date(exportStats.oldest_item).toLocaleDateString()}
                  </span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {new Date(exportStats.newest_item).toLocaleDateString()}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ExportData;