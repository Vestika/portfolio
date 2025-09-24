import React from 'react';
import { X, TrendingUp, Calendar, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RSUPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notification: {
    _id: string;
    title: string;
    message: string;
    metadata?: {
      symbol: string;
      units: number;
      vest_date: string;
      account_name: string;
    };
  };
}

export const RSUPopup: React.FC<RSUPopupProps> = ({ isOpen, onClose, notification }) => {
  if (!isOpen || !notification.metadata) return null;

  const { symbol, units, vest_date, account_name } = notification.metadata;
  
  // Format the vest date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp size={20} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                RSU Vesting Event
              </h1>
              <p className="text-gray-400 text-sm">
                {symbol} units have vested
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {units.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">units</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-medium text-white">{symbol}</div>
                <div className="text-xs text-green-400">Vested</div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Building2 size={14} />
                <span>Account</span>
              </div>
              <span className="text-white">{account_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar size={14} />
                <span>Vest Date</span>
              </div>
              <span className="text-white">{formatDate(vest_date)}</span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
};
