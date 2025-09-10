import React, { useState, useEffect, useCallback } from 'react';
import { NewsletterItem } from './NewsletterItem';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

interface Newsletter {
  id: string;
  title: string;
  content: string;
  source: {
    id: string;
    name: string;
    type: 'gmail' | 'outlook' | 'rss' | 'forwarding';
  };
  isRead: boolean;
  createdAt: string;
  normalizedHash?: string;
}

interface NewsletterFeedProps {
  searchTerm: string;
  selectedSource: string;
  showUnreadOnly: boolean;
}

export const NewsletterFeed: React.FC<NewsletterFeedProps> = ({
  searchTerm,
  selectedSource,
  showUnreadOnly
}) => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const ITEMS_PER_PAGE = 25;

  // Fetch newsletters from API
  const fetchNewsletters = useCallback(async (isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isLoadMore ? offset : 0;
      
      // Build query parameters
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: currentOffset.toString()
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (selectedSource !== 'all') {
        // Map UI source names to backend source IDs/types
        params.append('sourceType', selectedSource);
      }

      if (showUnreadOnly) {
        params.append('isRead', 'false');
      }

      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/items?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const newItems = data.data || [];
        
        if (isLoadMore) {
          setNewsletters(prev => [...prev, ...newItems]);
          setOffset(prev => prev + ITEMS_PER_PAGE);
        } else {
          setNewsletters(newItems);
          setOffset(ITEMS_PER_PAGE);
        }

        setHasMore(data.pagination?.hasMore || newItems.length === ITEMS_PER_PAGE);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to fetch newsletters');
      }
    } catch (err) {
      console.error('Error fetching newsletters:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch newsletters');
      if (!isLoadMore) {
        setNewsletters([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchTerm, selectedSource, showUnreadOnly, offset]);

  // Load initial data and refresh when filters change
  useEffect(() => {
    fetchNewsletters(false);
  }, [searchTerm, selectedSource, showUnreadOnly]);

  // Handle read status changes
  const handleMarkAsRead = async (itemId: string, isRead: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      const endpoint = isRead ? `/api/items/${itemId}/read` : `/api/items/${itemId}/unread`;
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update read status');
      }

      // Update local state
      setNewsletters(prev => 
        prev.map(item => 
          item.id === itemId ? { ...item, isRead } : item
        )
      );
    } catch (err) {
      console.error('Error updating read status:', err);
      // You might want to show a toast notification here
    }
  };

  // Load more items
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNewsletters(true);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading your newsletters..." />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 text-lg font-medium mb-2">Error Loading Newsletters</div>
        <div className="text-gray-600 mb-4">{error}</div>
        <button
          onClick={() => fetchNewsletters(false)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (newsletters.length === 0) {
    return (
      <EmptyState
        searchTerm={searchTerm}
        selectedSource={selectedSource}
        showUnreadOnly={showUnreadOnly}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {newsletters.length} newsletter{newsletters.length === 1 ? '' : 's'}
          {searchTerm && ` matching "${searchTerm}"`}
          {selectedSource !== 'all' && ` from ${selectedSource}`}
          {showUnreadOnly && ' (unread only)'}
        </div>
        
        {newsletters.some(n => !n.isRead) && (
          <button
            onClick={() => {
              // TODO: Implement mark all as read
              console.log('Mark all as read');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Newsletter Items */}
      <div className="space-y-4">
        {newsletters.map((newsletter) => (
          <NewsletterItem
            key={newsletter.id}
            newsletter={newsletter}
            onMarkAsRead={handleMarkAsRead}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="text-center py-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!hasMore && newsletters.length > 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">
          You've reached the end of your newsletters
        </div>
      )}
    </div>
  );
};