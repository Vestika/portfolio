import React, { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { IconButton } from './IconButton';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className = "" }) => {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);


  // Format notification time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'welcome':
        return '👋';
      case 'rsu_vesting':
        return '📈';
      case 'rsu_grant':
        return '🎁';
      case 'options_vesting':
        return '⚡';
      case 'portfolio_update':
        return '📊';
      case 'system':
        return '🔧';
      case 'feature':
        return '✨';
      default:
        return '🔔';
    }
  };

  // Handle notification click - navigate if it has a link
  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (notification.status === 'unread') {
      markAsRead(notification._id);
    }

    // If it has a link, navigate to it
    if (notification.link_url) {
      if (notification.link_url.startsWith('http://') || notification.link_url.startsWith('https://')) {
        window.open(notification.link_url, '_blank');
      } else {
        window.location.href = notification.link_url;
      }
      setIsOpen(false);
    }
  };


  return (
    <div className={`relative ${className}`}>
      {/* Bell Icon */}
      <IconButton
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        ariaLabel="Notifications"
        className="relative"
      >
        {unreadCount > 0 ? (
          <BellRing size={18} className="text-yellow-400" />
        ) : (
          <Bell size={18} />
        )}
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </IconButton>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-700 rounded-md shadow-lg z-50 border border-gray-600">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400">
                <Bell size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`px-4 py-3 border-b border-gray-600 last:border-b-0 hover:bg-gray-600/50 transition-colors cursor-pointer ${
                    notification.status === 'unread' ? 'bg-gray-600/30' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </h4>
                        {notification.status === 'unread' && (
                          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 ml-2"></div>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
