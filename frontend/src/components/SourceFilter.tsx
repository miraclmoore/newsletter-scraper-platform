import React from 'react';

interface SourceFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'gmail', label: 'Gmail' },
  { value: 'outlook', label: 'Outlook' },
  { value: 'rss', label: 'RSS Feeds' },
  { value: 'forwarding', label: 'Email Forwarding' }
];

export const SourceFilter: React.FC<SourceFilterProps> = ({ value, onChange }) => {
  return (
    <div>
      <label htmlFor="sourceFilter" className="block text-sm font-medium text-gray-700 mb-2">
        Filter by Source
      </label>
      <select
        id="sourceFilter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        {SOURCE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};