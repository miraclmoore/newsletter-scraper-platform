import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from '../Dashboard';

// Mock child components
jest.mock('../NewsletterFeed', () => ({
  NewsletterFeed: ({ searchTerm, selectedSource, showUnreadOnly }: any) => (
    <div data-testid="newsletter-feed">
      <div data-testid="search-term">{searchTerm}</div>
      <div data-testid="selected-source">{selectedSource}</div>
      <div data-testid="show-unread-only">{showUnreadOnly.toString()}</div>
    </div>
  )
}));

jest.mock('../SearchBar', () => ({
  SearchBar: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}));

jest.mock('../SourceFilter', () => ({
  SourceFilter: ({ value, onChange }: any) => (
    <select
      data-testid="source-filter"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="all">All Sources</option>
      <option value="gmail">Gmail</option>
      <option value="outlook">Outlook</option>
      <option value="rss">RSS</option>
      <option value="forwarding">Forwarding</option>
    </select>
  )
}));

const mockUser = {
  id: 'user123',
  email: 'test@example.com'
};

const mockOnLogout = jest.fn();

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard with user email', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('Newsletter Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome back, test@example.com')).toBeInTheDocument();
  });

  it('renders logout button and calls onLogout when clicked', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const logoutButton = screen.getByRole('button', { name: /logout/i });
    expect(logoutButton).toBeInTheDocument();
    
    fireEvent.click(logoutButton);
    expect(mockOnLogout).toHaveBeenCalledTimes(1);
  });

  it('renders search and filter components', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByText('Search & Filters')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('source-filter')).toBeInTheDocument();
    expect(screen.getByLabelText(/show unread only/i)).toBeInTheDocument();
  });

  it('passes correct props to NewsletterFeed initially', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    expect(screen.getByTestId('search-term')).toHaveTextContent('');
    expect(screen.getByTestId('selected-source')).toHaveTextContent('all');
    expect(screen.getByTestId('show-unread-only')).toHaveTextContent('false');
  });

  it('updates search term and passes it to NewsletterFeed', async () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const searchInput = screen.getByTestId('search-bar');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('search-term')).toHaveTextContent('test search');
    });
  });

  it('updates source filter and passes it to NewsletterFeed', async () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const sourceSelect = screen.getByTestId('source-filter');
    fireEvent.change(sourceSelect, { target: { value: 'gmail' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('selected-source')).toHaveTextContent('gmail');
    });
  });

  it('updates unread only filter and passes it to NewsletterFeed', async () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const unreadCheckbox = screen.getByLabelText(/show unread only/i);
    fireEvent.click(unreadCheckbox);
    
    await waitFor(() => {
      expect(screen.getByTestId('show-unread-only')).toHaveTextContent('true');
    });
  });

  it('shows mobile filter toggle on small screens', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const filterToggle = screen.getByRole('button', { name: /show filters/i });
    expect(filterToggle).toBeInTheDocument();
  });

  it('toggles mobile filters when button is clicked', async () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const filterToggle = screen.getByRole('button', { name: /show filters/i });
    fireEvent.click(filterToggle);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hide filters/i })).toBeInTheDocument();
    });
    
    const hideToggle = screen.getByRole('button', { name: /hide filters/i });
    fireEvent.click(hideToggle);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show filters/i })).toBeInTheDocument();
    });
  });

  it('has proper accessibility attributes', () => {
    render(<Dashboard user={mockUser} onLogout={mockOnLogout} />);
    
    const unreadCheckbox = screen.getByLabelText(/show unread only/i);
    expect(unreadCheckbox).toHaveAttribute('type', 'checkbox');
    
    const searchInput = screen.getByTestId('search-bar');
    expect(searchInput).toHaveAttribute('placeholder', 'Search newsletters...');
  });

  it('truncates long email addresses on mobile', () => {
    const longEmailUser = {
      id: 'user123',
      email: 'very.long.email.address@example-domain.com'
    };
    
    render(<Dashboard user={longEmailUser} onLogout={mockOnLogout} />);
    
    const emailElement = screen.getByText(/Welcome back, very.long.email.address@example-domain.com/);
    expect(emailElement).toHaveClass('truncate');
  });
});