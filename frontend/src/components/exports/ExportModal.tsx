import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { 
  Download, 
  FileText, 
  Table, 
  X, 
  Calendar,
  Filter,
  Info
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: string[];
  onExport: (format: string, options: any) => Promise<void>;
}

interface ExportPreview {
  totalItems: number;
  previewItems: number;
  dateRange: {
    start: string;
    end: string;
  };
  sources: Array<{
    id: string;
    name: string;
    type: string;
    count: number;
  }>;
  estimatedSizes: {
    markdown: {
      estimatedKB: number;
      estimatedMB: number;
    };
    csv: {
      estimatedKB: number;
      estimatedMB: number;
    };
  };
  sampleData: Array<{
    id: string;
    title: string;
    source: string;
    publishedAt: string;
    wordCount: number;
    excerpt: string;
  }>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  onExport
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'csv'>('markdown');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [options, setOptions] = useState({
    // Markdown options
    groupBySource: false,
    includeIndex: true,
    // CSV options
    includeContent: true,
    includeSummary: false,
    dateFormat: 'iso' as 'iso' | 'date' | 'readable',
    // Common options
    filename: ''
  });

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      loadPreview();
    }
  }, [isOpen, selectedItems]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/exports/preview?itemIds=${selectedItems.join(',')}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load export preview');
      }

      const data = await response.json();
      setPreview(data.data);
    } catch (error) {
      console.error('Failed to load export preview:', error);
      // Show preview anyway with limited data
      setPreview({
        totalItems: selectedItems.length,
        previewItems: selectedItems.length,
        dateRange: { start: '', end: '' },
        sources: [],
        estimatedSizes: {
          markdown: { estimatedKB: 0, estimatedMB: 0 },
          csv: { estimatedKB: 0, estimatedMB: 0 }
        },
        sampleData: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      const exportOptions = selectedFormat === 'markdown' 
        ? {
            groupBySource: options.groupBySource,
            includeIndex: options.includeIndex,
            filename: options.filename
          }
        : {
            includeContent: options.includeContent,
            includeSummary: options.includeSummary,
            dateFormat: options.dateFormat,
            filename: options.filename
          };

      await onExport(selectedFormat, {
        itemIds: selectedItems,
        options: exportOptions
      });

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      // Error handling is done in parent component
    } finally {
      setExporting(false);
    }
  };

  const formatFileSize = (kb: number) => {
    if (kb < 1024) {
      return `${kb} KB`;
    }
    return `${Math.round(kb / 1024 * 10) / 10} MB`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Export Newsletters</h2>
            <p className="text-gray-600 mt-1">
              {selectedItems.length} newsletter{selectedItems.length === 1 ? '' : 's'} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            disabled={exporting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row max-h-[calc(90vh-140px)]">
          {/* Format Selection Sidebar */}
          <div className="w-full lg:w-80 p-6 border-r border-gray-200 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Export Format</h3>
            
            {/* Format Options */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setSelectedFormat('markdown')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedFormat === 'markdown'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Markdown</span>
                  <Badge variant="secondary" className="ml-auto">
                    {preview ? formatFileSize(preview.estimatedSizes.markdown.estimatedKB) : '...'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Structured text format ideal for documentation and note-taking apps
                </p>
              </button>

              <button
                onClick={() => setSelectedFormat('csv')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedFormat === 'csv'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Table className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">CSV</span>
                  <Badge variant="secondary" className="ml-auto">
                    {preview ? formatFileSize(preview.estimatedSizes.csv.estimatedKB) : '...'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Spreadsheet format for data analysis and Excel compatibility
                </p>
              </button>
            </div>

            {/* Format-specific Options */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Options</h4>
              
              {selectedFormat === 'markdown' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.groupBySource}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        groupBySource: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Group by source</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.includeIndex}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        includeIndex: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Include table of contents</span>
                  </label>
                </div>
              )}

              {selectedFormat === 'csv' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.includeContent}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        includeContent: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Include full content</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.includeSummary}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        includeSummary: e.target.checked 
                      }))}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Include summary statistics</span>
                  </label>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Format
                    </label>
                    <select
                      value={options.dateFormat}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        dateFormat: e.target.value as any
                      }))}
                      className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="iso">ISO (2024-01-15T10:30:00Z)</option>
                      <option value="date">Date only (2024-01-15)</option>
                      <option value="readable">Readable (1/15/2024)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Filename (optional)
                </label>
                <input
                  type="text"
                  value={options.filename}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    filename: e.target.value 
                  }))}
                  placeholder={`newsletter-export.${selectedFormat}`}
                  className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Export Preview</h3>

            {loading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner message="Loading preview..." />
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-indigo-600">
                        {preview.totalItems}
                      </div>
                      <div className="text-sm text-gray-600">Total Items</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-2xl font-bold text-green-600">
                        {preview.sources.length}
                      </div>
                      <div className="text-sm text-gray-600">Sources</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Date Range */}
                {preview.dateRange.start && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Date Range
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="text-sm text-gray-600">
                        {formatDate(preview.dateRange.start)} - {formatDate(preview.dateRange.end)}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sources */}
                {preview.sources.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Sources
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {preview.sources.map((source) => (
                          <Badge key={source.id} variant="secondary">
                            {source.name} ({source.count})
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sample Data */}
                {preview.sampleData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Sample Items
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {preview.sampleData.map((item) => (
                          <div key={item.id} className="border-l-2 border-gray-200 pl-3 py-1">
                            <div className="font-medium text-sm">{item.title}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span>{item.source}</span>
                              <span>•</span>
                              <span>{formatDate(item.publishedAt)}</span>
                              {item.wordCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{item.wordCount} words</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Failed to load preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {preview && (
              <span>
                Estimated size: {formatFileSize(
                  selectedFormat === 'markdown' 
                    ? preview.estimatedSizes.markdown.estimatedKB
                    : preview.estimatedSizes.csv.estimatedKB
                )}
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={exporting}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleExport}
              disabled={exporting || !preview}
              className="flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <LoadingSpinner size="small" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};