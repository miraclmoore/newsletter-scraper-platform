import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewsletterFeed } from '../NewsletterFeed';

// Mock fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock child components
jest.mock('../NewsletterItem', () => ({
  NewsletterItem: ({ newsletter, onMarkAsRead }: any) => (
    <div data-testid={`newsletter-item-${newsletter.id}`}>
      <h3>{newsletter.title}</h3>
      <button
        onClick={() => onMarkAsRead(newsletter.id, !newsletter.isRead)}
        data-testid={`toggle-read-${newsletter.id}`}
      >
        {newsletter.isRead ? 'Mark as Unread' : 'Mark as Read'}
      </button>
    </div>
  )
}));

jest.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ message }: any) => (
    <div data-testid="loading-spinner">{message}</div>
  )
}));

jest.mock('../EmptyState', () => ({
  EmptyState: ({ searchTerm, selectedSource, showUnreadOnly }: any) => (
    <div data-testid="empty-state">
      <div data-testid="empty-search-term">{searchTerm}</div>
      <div data-testid="empty-selected-source">{selectedSource}</div>
      <div data-testid="empty-show-unread-only">{showUnreadOnly.toString()}</div>
    </div>
  )
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

const mockNewsletters = [
  {
    id: 'newsletter1',
    title: 'Test Newsletter 1',
    content: 'Content of newsletter 1',
    source: {
      id: 'source1',
      name: 'Test Source',
      type: 'gmail' as const
    },
    isRead: false,
    createdAt: '2024-01-01T10:00:00Z'
  },
  {
    id: 'newsletter2',
    title: 'Test Newsletter 2',
    content: 'Content of newsletter 2',
    source: {
      id: 'source2',
      name: 'Another Source',
      type: 'rss' as const
    },
    isRead: true,
    createdAt: '2024-01-02T10:00:00Z'
  }
];

describe('NewsletterFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('fake-token');
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockNewsletters,
        pagination: {
          hasMore: false
        }
      })
    });
  });

  it('shows loading spinner initially', () => {
    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading your newsletters...')).toBeInTheDocument();
  });

  it('renders newsletters after loading', async () => {
    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('newsletter-item-newsletter1')).toBeInTheDocument();
      expect(screen.getByTestId('newsletter-item-newsletter2')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Newsletter 1')).toBeInTheDocument();
    expect(screen.getByText('Test Newsletter 2')).toBeInTheDocument();
  });

  it('makes API call with correct parameters', async () => {
    render(
      <NewsletterFeed
        searchTerm="test search"
        selectedSource="gmail"
        showUnreadOnly={true}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items?limit=25&offset=0&search=test+search&sourceType=gmail&isRead=false',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  it('shows empty state when no newsletters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [],
        pagination: {
          hasMore: false
        }
      })
    });

    render(
      <NewsletterFeed
        searchTerm="no results"
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByTestId('empty-search-term')).toHaveTextContent('no results');
  });

  it('handles API errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Newsletters')).toBeInTheDocument();
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('handles read status changes', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockNewsletters,
          pagination: { hasMore: false }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('newsletter-item-newsletter1')).toBeInTheDocument();
    });

    const toggleButton = screen.getByTestId('toggle-read-newsletter1');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/items/newsletter1/read',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-token',
            'Content-Type': 'application/json'
          })
        })
      );
    });
  });

  it('shows load more button when hasMore is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockNewsletters,
        pagination: {
          hasMore: true
        }
      })
    });

    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });
  });

  it('loads more newsletters when load more button is clicked', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockNewsletters,
          pagination: { hasMore: true }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [mockNewsletters[0]], // Load more data
          pagination: { hasMore: false }
        })
      });

    render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/items?limit=25&offset=25',
        expect.any(Object)
      );
    });
  });

  it('shows results summary', async () => {
    render(
      <NewsletterFeed
        searchTerm="test"
        selectedSource="gmail"
        showUnreadOnly={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 newsletters matching "test" from gmail \(unread only\)/)).toBeInTheDocument();
    });
  });

  it('refetches data when props change', async () => {
    const { rerender } = render(
      <NewsletterFeed
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change props
    rerender(
      <NewsletterFeed
        searchTerm="new search"
        selectedSource="gmail"
        showUnreadOnly={true}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('search=new+search&sourceType=gmail&isRead=false'),
        expect.any(Object)
      );
    });
  });
});