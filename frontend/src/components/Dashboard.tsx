import React, { useState, useEffect } from 'react';
import { NewsletterFeed } from './NewsletterFeed';
import { SearchBar } from './SearchBar';
import { SourceFilter } from './SourceFilter';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface DashboardProps {
  user: {
    id: string;
    email: string;
  };
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              Newsletter Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600 truncate">
              Welcome back, {user.email}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="ml-4 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus-ring flex-shrink-0"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Mobile Filter Toggle */}
          <div className="lg:hidden">
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {/* Sidebar - Filters */}
          <div className={`w-full lg:w-80 flex-shrink-0 space-y-4 lg:space-y-6 ${
            showMobileFilters ? 'block' : 'hidden lg:block'
          }`}>
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-base sm:text-lg">Search & Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search newsletters..."
                />
                
                <SourceFilter
                  value={selectedSource}
                  onChange={setSelectedSource}
                />

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="unreadOnly"
                    checked={showUnreadOnly}
                    onChange={(e) => setShowUnreadOnly(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded focus-ring"
                  />
                  <label htmlFor="unreadOnly" className="text-sm text-gray-700 cursor-pointer">
                    Show unread only
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            <NewsletterFeed
              searchTerm={searchTerm}
              selectedSource={selectedSource}
              showUnreadOnly={showUnreadOnly}
            />
          </div>
        </div>
      </main>
    </div>
  );
};