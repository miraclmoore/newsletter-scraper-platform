import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceFilter } from '../SourceFilter';

const mockOnChange = jest.fn();

describe('SourceFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with all source options', () => {
    render(<SourceFilter value="all" onChange={mockOnChange} />);
    
    const select = screen.getByLabelText('Filter by Source');
    expect(select).toBeInTheDocument();
    
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
    
    expect(screen.getByRole('option', { name: 'All Sources' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gmail' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Outlook' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'RSS Feeds' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Email Forwarding' })).toBeInTheDocument();
  });

  it('displays the current selected value', () => {
    render(<SourceFilter value="gmail" onChange={mockOnChange} />);
    
    const select = screen.getByDisplayValue('Gmail');
    expect(select).toBeInTheDocument();
  });

  it('calls onChange when selection changes', () => {
    render(<SourceFilter value="all" onChange={mockOnChange} />);
    
    const select = screen.getByLabelText('Filter by Source');
    fireEvent.change(select, { target: { value: 'outlook' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('outlook');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('has proper accessibility attributes', () => {
    render(<SourceFilter value="all" onChange={mockOnChange} />);
    
    const select = screen.getByLabelText('Filter by Source');
    expect(select).toHaveAttribute('id', 'sourceFilter');
    
    const label = screen.getByText('Filter by Source');
    expect(label).toHaveAttribute('for', 'sourceFilter');
  });

  it('handles all source types correctly', () => {
    const sourceTypes = ['all', 'gmail', 'outlook', 'rss', 'forwarding'];
    
    sourceTypes.forEach(sourceType => {
      const { unmount } = render(<SourceFilter value={sourceType} onChange={mockOnChange} />);
      
      const select = screen.getByLabelText('Filter by Source');
      expect(select).toHaveValue(sourceType);
      
      unmount();
    });
  });

  it('has proper styling classes', () => {
    render(<SourceFilter value="all" onChange={mockOnChange} />);
    
    const select = screen.getByLabelText('Filter by Source');
    expect(select).toHaveClass('w-full');
    expect(select).toHaveClass('px-3');
    expect(select).toHaveClass('py-2');
    expect(select).toHaveClass('border');
    expect(select).toHaveClass('rounded-md');
  });

  it('supports keyboard navigation', () => {
    render(<SourceFilter value="all" onChange={mockOnChange} />);
    
    const select = screen.getByLabelText('Filter by Source');
    select.focus();
    
    expect(select).toHaveFocus();
    
    // Test arrow key navigation
    fireEvent.keyDown(select, { key: 'ArrowDown' });
    // Browser handles the actual option selection, we just test that it's focusable
  });
});