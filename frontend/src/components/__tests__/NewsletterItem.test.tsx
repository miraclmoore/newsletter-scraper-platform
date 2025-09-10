import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewsletterItem } from '../NewsletterItem';

const mockNewsletter = {
  id: 'newsletter123',
  title: 'Test Newsletter Title',
  content: '<p>This is the <strong>newsletter content</strong> with <a href="http://example.com">links</a>.</p>',
  source: {
    id: 'source1',
    name: 'Test Gmail Source',
    type: 'gmail' as const
  },
  isRead: false,
  createdAt: '2024-01-01T10:30:00Z'
};

const mockOnMarkAsRead = jest.fn();

describe('NewsletterItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders newsletter title and source info', () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    expect(screen.getByText('Test Newsletter Title')).toBeInTheDocument();
    expect(screen.getByText('Test Gmail Source')).toBeInTheDocument();
    expect(screen.getByText('Gmail')).toBeInTheDocument();
  });

  it('shows preview text when collapsed', () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    expect(screen.getByText(/This is the newsletter content with links\./)).toBeInTheDocument();
    expect(screen.queryByText('Mark Read')).not.toBeInTheDocument(); // Expanded actions not visible
  });

  it('shows full content when expanded', async () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const expandButton = screen.getByRole('button', { name: '' }); // Expand button (chevron)
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Mark Read')).toBeInTheDocument();
    });

    // Check that HTML content is rendered
    expect(screen.getByText('newsletter content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'links' })).toBeInTheDocument();
  });

  it('displays correct read/unread status', () => {
    const unreadNewsletter = { ...mockNewsletter, isRead: false };
    const { rerender } = render(
      <NewsletterItem
        newsletter={unreadNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    // Unread newsletter should have Mail icon (closed envelope)
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();

    const readNewsletter = { ...mockNewsletter, isRead: true };
    rerender(
      <NewsletterItem
        newsletter={readNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    // Read newsletter should have MailOpen icon (open envelope)
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('calls onMarkAsRead when read status button is clicked', () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const readButton = screen.getAllByRole('button')[0]; // First button is read/unread toggle
    fireEvent.click(readButton);

    expect(mockOnMarkAsRead).toHaveBeenCalledWith('newsletter123', true); // Should mark as read
  });

  it('shows correct badge color for different source types', () => {
    const sources = [
      { type: 'gmail' as const, expectedClass: 'bg-red-100 text-red-800' },
      { type: 'outlook' as const, expectedClass: 'bg-blue-100 text-blue-800' },
      { type: 'rss' as const, expectedClass: 'bg-orange-100 text-orange-800' },
      { type: 'forwarding' as const, expectedClass: 'bg-green-100 text-green-800' }
    ];

    sources.forEach(({ type, expectedClass }) => {
      const testNewsletter = {
        ...mockNewsletter,
        source: { ...mockNewsletter.source, type }
      };

      const { unmount } = render(
        <NewsletterItem
          newsletter={testNewsletter}
          onMarkAsRead={mockOnMarkAsRead}
        />
      );

      const badge = screen.getByText(type === 'forwarding' ? 'Forwarded' : type.charAt(0).toUpperCase() + type.slice(1));
      expect(badge.closest('[class*="bg-"]')).toHaveClass(expectedClass.split(' ')[0]);

      unmount();
    });
  });

  it('formats dates correctly', () => {
    // Test recent date (should show time)
    const recentNewsletter = {
      ...mockNewsletter,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    };

    const { rerender } = render(
      <NewsletterItem
        newsletter={recentNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument(); // Time format

    // Test old date (should show full date)
    const oldNewsletter = {
      ...mockNewsletter,
      createdAt: '2023-06-15T10:30:00Z'
    };

    rerender(
      <NewsletterItem
        newsletter={oldNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    expect(screen.getByText(/Jun \d{1,2}, 2023/)).toBeInTheDocument();
  });

  it('handles untitled newsletters', () => {
    const untitledNewsletter = { ...mockNewsletter, title: '' };
    render(
      <NewsletterItem
        newsletter={untitledNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    expect(screen.getByText('Untitled Newsletter')).toBeInTheDocument();
  });

  it('shows newsletter ID in expanded view', async () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const expandButton = screen.getAllByRole('button')[1]; // Second button is expand/collapse
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('ID: newslett...')).toBeInTheDocument();
    });
  });

  it('has proper visual styling for unread newsletters', () => {
    const unreadNewsletter = { ...mockNewsletter, isRead: false };
    const { container } = render(
      <NewsletterItem
        newsletter={unreadNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const card = container.querySelector('[class*="border-l-4"]');
    expect(card).toHaveClass('border-l-indigo-500');
    expect(card).toHaveClass('bg-indigo-50/30');
  });

  it('has proper visual styling for read newsletters', () => {
    const readNewsletter = { ...mockNewsletter, isRead: true };
    const { container } = render(
      <NewsletterItem
        newsletter={readNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const card = container.querySelector('[class*="bg-white"]');
    expect(card).toHaveClass('bg-white');
    expect(card).not.toHaveClass('border-l-4');
  });

  it('truncates preview text correctly', () => {
    const longContentNewsletter = {
      ...mockNewsletter,
      content: '<p>' + 'A'.repeat(200) + '</p>'
    };

    render(
      <NewsletterItem
        newsletter={longContentNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const previewText = screen.getByText(/A{100,}/); // Look for long text
    expect(previewText.textContent?.endsWith('...')).toBe(true);
    expect(previewText.textContent?.length).toBeLessThanOrEqual(153); // 150 chars + "..."
  });

  it('strips HTML tags from preview text', () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    // Preview should not contain HTML tags
    expect(screen.getByText(/This is the newsletter content with links\./)).toBeInTheDocument();
    expect(screen.queryByText(/<[^>]*>/)).not.toBeInTheDocument();
  });

  it('toggles between expanded and collapsed states', async () => {
    render(
      <NewsletterItem
        newsletter={mockNewsletter}
        onMarkAsRead={mockOnMarkAsRead}
      />
    );

    const expandButton = screen.getAllByRole('button')[1];
    
    // Initially collapsed
    expect(screen.queryByText('Mark Read')).not.toBeInTheDocument();
    
    // Expand
    fireEvent.click(expandButton);
    await waitFor(() => {
      expect(screen.getByText('Mark Read')).toBeInTheDocument();
    });

    // Collapse again
    fireEvent.click(expandButton);
    await waitFor(() => {
      expect(screen.queryByText('Mark Read')).not.toBeInTheDocument();
    });
  });
});