import React from 'react';
import { Mail, Search, Filter } from 'lucide-react';

interface EmptyStateProps {
  searchTerm: string;
  selectedSource: string;
  showUnreadOnly: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  searchTerm,
  selectedSource,
  showUnreadOnly
}) => {
  const hasFilters = searchTerm || selectedSource !== 'all' || showUnreadOnly;

  if (hasFilters) {
    return (
      <div className="text-center py-16">
        <Search className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No newsletters found</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          No newsletters match your current filters. Try adjusting your search terms or filters.
        </p>
        <div className="space-y-2 text-sm text-gray-500">
          {searchTerm && (
            <div className="flex items-center justify-center gap-1">
              <Search className="h-4 w-4" />
              Searching for: "{searchTerm}"
            </div>
          )}
          {selectedSource !== 'all' && (
            <div className="flex items-center justify-center gap-1">
              <Filter className="h-4 w-4" />
              Source: {selectedSource}
            </div>
          )}
          {showUnreadOnly && (
            <div className="flex items-center justify-center gap-1">
              <Mail className="h-4 w-4" />
              Showing unread only
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <Mail className="mx-auto h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No newsletters yet</h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Your newsletter feed will appear here once you start receiving newsletters from your connected sources.
      </p>
      <div className="space-y-3">
        <div className="text-sm text-gray-500">
          Get started by:
        </div>
        <div className="space-y-1 text-sm text-gray-600">
          <div>• Connecting your Gmail or Outlook account</div>
          <div>• Adding RSS feeds to follow</div>
          <div>• Setting up email forwarding</div>
        </div>
      </div>
    </div>
  );
};