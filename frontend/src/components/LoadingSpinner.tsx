import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading...', 
  size = 'medium' 
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Loader2 className={`animate-spin text-indigo-600 ${sizeClasses[size]}`} />
      {message && (
        <p className="text-gray-600 text-sm">{message}</p>
      )}
    </div>
  );
};