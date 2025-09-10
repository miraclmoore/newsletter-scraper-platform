import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('shows filtered empty state when filters are applied', () => {
    render(
      <EmptyState
        searchTerm="test search"
        selectedSource="gmail"
        showUnreadOnly={true}
      />
    );

    expect(screen.getByText('No newsletters found')).toBeInTheDocument();
    expect(screen.getByText(/No newsletters match your current filters/)).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search terms or filters/)).toBeInTheDocument();
  });

  it('shows search term in filter summary', () => {
    render(
      <EmptyState
        searchTerm="my search"
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('Searching for: "my search"')).toBeInTheDocument();
  });

  it('shows source filter in summary', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="outlook"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('Source: outlook')).toBeInTheDocument();
  });

  it('shows unread only filter in summary', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={true}
      />
    );

    expect(screen.getByText('Showing unread only')).toBeInTheDocument();
  });

  it('shows multiple filters in summary', () => {
    render(
      <EmptyState
        searchTerm="newsletter"
        selectedSource="rss"
        showUnreadOnly={true}
      />
    );

    expect(screen.getByText('Searching for: "newsletter"')).toBeInTheDocument();
    expect(screen.getByText('Source: rss')).toBeInTheDocument();
    expect(screen.getByText('Showing unread only')).toBeInTheDocument();
  });

  it('shows onboarding empty state when no filters applied', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('No newsletters yet')).toBeInTheDocument();
    expect(screen.getByText(/Your newsletter feed will appear here once you start receiving/)).toBeInTheDocument();
    expect(screen.getByText('Get started by:')).toBeInTheDocument();
  });

  it('shows getting started instructions in onboarding state', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('• Connecting your Gmail or Outlook account')).toBeInTheDocument();
    expect(screen.getByText('• Adding RSS feeds to follow')).toBeInTheDocument();
    expect(screen.getByText('• Setting up email forwarding')).toBeInTheDocument();
  });

  it('shows search icon in filtered state', () => {
    render(
      <EmptyState
        searchTerm="test"
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    // Look for SVG element (search icon)
    const icon = document.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('shows mail icon in onboarding state', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    // Look for SVG element (mail icon)
    const icon = document.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('detects filters correctly - search term only', () => {
    render(
      <EmptyState
        searchTerm="search"
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('No newsletters found')).toBeInTheDocument();
  });

  it('detects filters correctly - source filter only', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="gmail"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('No newsletters found')).toBeInTheDocument();
  });

  it('detects filters correctly - unread only', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={true}
      />
    );

    expect(screen.getByText('No newsletters found')).toBeInTheDocument();
  });

  it('shows onboarding when no filters active', () => {
    render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    expect(screen.getByText('No newsletters yet')).toBeInTheDocument();
    expect(screen.queryByText('No newsletters found')).not.toBeInTheDocument();
  });

  it('has proper text styling and spacing', () => {
    const { container } = render(
      <EmptyState
        searchTerm=""
        selectedSource="all"
        showUnreadOnly={false}
      />
    );

    const mainHeading = screen.getByText('No newsletters yet');
    expect(mainHeading).toHaveClass('text-lg', 'font-medium', 'text-gray-900');

    const description = screen.getByText(/Your newsletter feed will appear here/);
    expect(description).toHaveClass('text-gray-600');
  });
});