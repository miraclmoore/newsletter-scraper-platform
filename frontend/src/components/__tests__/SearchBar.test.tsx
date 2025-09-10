import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchBar } from '../SearchBar';

const mockOnChange = jest.fn();

describe('SearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default placeholder', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('Search...');
    expect(input).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(
      <SearchBar
        value=""
        onChange={mockOnChange}
        placeholder="Search newsletters..."
      />
    );
    
    const input = screen.getByPlaceholderText('Search newsletters...');
    expect(input).toBeInTheDocument();
  });

  it('displays the provided value', () => {
    render(<SearchBar value="test search" onChange={mockOnChange} />);
    
    const input = screen.getByDisplayValue('test search');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange when input value changes', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new search term' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('new search term');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('renders search icon', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    // The search icon should be present (look for SVG with search-related path)
    const searchIcon = document.querySelector('svg');
    expect(searchIcon).toBeInTheDocument();
  });

  it('has proper input styling classes', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('pl-10'); // Left padding for icon
    expect(input).toHaveClass('w-full');
  });

  it('is accessible with proper input type', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'text');
  });

  it('handles empty string values', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
    
    fireEvent.change(input, { target: { value: '' } });
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('handles special characters in search', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    const specialText = 'search @#$%^&*()[]{}';
    
    fireEvent.change(input, { target: { value: specialText } });
    expect(mockOnChange).toHaveBeenCalledWith(specialText);
  });

  it('maintains focus state properly', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    
    const input = screen.getByRole('textbox');
    input.focus();
    
    expect(input).toHaveFocus();
  });
});