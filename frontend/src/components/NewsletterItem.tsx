import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Mail, 
  MailOpen, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  ExternalLink,
  Rss,
  Forward
} from 'lucide-react';

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

interface NewsletterItemProps {
  newsletter: Newsletter;
  onMarkAsRead: (itemId: string, isRead: boolean) => void;
}

export const NewsletterItem: React.FC<NewsletterItemProps> = ({
  newsletter,
  onMarkAsRead
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get source icon and color
  const getSourceInfo = (type: string) => {
    switch (type) {
      case 'gmail':
        return { icon: Mail, color: 'bg-red-100 text-red-800', label: 'Gmail' };
      case 'outlook':
        return { icon: Mail, color: 'bg-blue-100 text-blue-800', label: 'Outlook' };
      case 'rss':
        return { icon: Rss, color: 'bg-orange-100 text-orange-800', label: 'RSS' };
      case 'forwarding':
        return { icon: Forward, color: 'bg-green-100 text-green-800', label: 'Forwarded' };
      default:
        return { icon: Mail, color: 'bg-gray-100 text-gray-800', label: type };
    }
  };

  const sourceInfo = getSourceInfo(newsletter.source.type);
  const SourceIcon = sourceInfo.icon;

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 3600);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Get preview text (first ~150 chars)
  const getPreviewText = (content: string) => {
    // Strip HTML tags for preview
    const textContent = content.replace(/<[^>]*>/g, '');
    return textContent.length > 150 ? textContent.substring(0, 150) + '...' : textContent;
  };

  // Toggle read status
  const toggleReadStatus = () => {
    onMarkAsRead(newsletter.id, !newsletter.isRead);
  };

  return (
    <Card className={`newsletter-item ${
      !newsletter.isRead ? 'border-l-4 border-l-indigo-500 bg-indigo-50/30' : 'bg-white'
    }`}>
      <CardHeader className="pb-3 px-3 sm:px-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
              <Badge variant="secondary" className={`${sourceInfo.color} flex items-center gap-1 text-xs`}>
                <SourceIcon className="h-3 w-3" />
                <span className="hidden sm:inline">{sourceInfo.label}</span>
              </Badge>
              <span className="text-xs sm:text-sm text-gray-500 truncate max-w-32 sm:max-w-none">
                {newsletter.source.name}
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Calendar className="h-3 w-3" />
                <span className="hidden sm:inline">{formatDate(newsletter.createdAt)}</span>
                <span className="sm:hidden">{formatDate(newsletter.createdAt).split(' ')[0]}</span>
              </div>
            </div>
            
            <h3 className={`text-base sm:text-lg font-semibold line-clamp-2 ${
              !newsletter.isRead ? 'text-gray-900' : 'text-gray-700'
            }`}>
              {newsletter.title || 'Untitled Newsletter'}
            </h3>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleReadStatus}
              className="text-gray-500 hover:text-gray-700 p-1 sm:p-2"
            >
              {newsletter.isRead ? (
                <MailOpen className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 p-1 sm:p-2"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 px-3 sm:px-6">
        {!isExpanded ? (
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
            {getPreviewText(newsletter.content)}
          </p>
        ) : (
          <div className="space-y-4">
            <div 
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed scrollbar-thin max-h-96 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: newsletter.content }}
            />
            
            {/* Action buttons when expanded */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-gray-100 gap-3 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleReadStatus}
                  className="text-xs px-2 sm:px-3"
                >
                  {newsletter.isRead ? 'Mark Unread' : 'Mark Read'}
                </Button>
                
                {/* TODO: Add share/export functionality */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500 px-2 sm:px-3"
                  disabled
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </div>

              <div className="text-xs text-gray-400 self-start sm:self-auto">
                ID: {newsletter.id.slice(0, 8)}...
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};