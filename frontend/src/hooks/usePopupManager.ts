import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';

export type PopupType = 'welcome' | 'rsu' | 'feature';

interface PopupData {
  type: PopupType;
  data?: any;
}

export const usePopupManager = () => {
  const { user } = useAuth();
  const { notifications, markAsRead, createWelcomeNotification, refreshNotifications } = useNotifications();
  const [currentPopup, setCurrentPopup] = useState<PopupData | null>(null);
  const [processedPopups, setProcessedPopups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setCurrentPopup(null);
      setProcessedPopups(new Set());
      return;
    }

    // Find welcome notification
    const welcomeNotification = notifications.find(
      notif => notif.type === 'welcome'
    );

    // Find RSU notifications
    const rsuNotifications = notifications.filter(
      notif => (notif.type === 'rsu_vesting' || notif.type === 'rsu_grant') && notif.status === 'unread'
    );

    // Find feature notifications that should show as popups
    const featureNotifications = notifications.filter(
      notif => notif.type === 'feature' &&
               notif.status === 'unread' &&
               (notif.display_type === 'popup' || notif.display_type === 'both')
    );

    // Priority 1: Welcome notification (if no welcome notification exists or it's unread)
    if (welcomeNotification) {
      if (welcomeNotification.status === 'unread' && !processedPopups.has('welcome')) {
        setCurrentPopup({ type: 'welcome' });
        return;
      }
    } else if (!processedPopups.has('welcome')) {
      // Create welcome notification and show popup
      createWelcomeNotification().then(async () => {
        await refreshNotifications();
        setCurrentPopup({ type: 'welcome' });
      });
      return;
    }

    // Priority 2: Feature notifications (newest first)
    if (featureNotifications.length > 0) {
      // Filter out already processed feature notifications
      const unprocessedFeatures = featureNotifications.filter(
        notif => !processedPopups.has(`feature_${notif._id}`)
      );

      if (unprocessedFeatures.length > 0) {
        // Show the newest unprocessed feature notification
        const selectedFeature = unprocessedFeatures[0];

        setCurrentPopup({
          type: 'feature',
          data: selectedFeature
        });
        return;
      }
    }

    // Priority 3: RSU notifications (random order)
    if (rsuNotifications.length > 0) {
      // Filter out already processed RSU notifications
      const unprocessedRSU = rsuNotifications.filter(
        notif => !processedPopups.has(`rsu_${notif._id}`)
      );

      if (unprocessedRSU.length > 0) {
        // Randomly select one RSU notification
        const randomIndex = Math.floor(Math.random() * unprocessedRSU.length);
        const selectedRSU = unprocessedRSU[randomIndex];

        setCurrentPopup({
          type: 'rsu',
          data: selectedRSU
        });
        return;
      }
    }

    // No more popups to show
    setCurrentPopup(null);
  }, [user, notifications, processedPopups, createWelcomeNotification, refreshNotifications]);

  const closeCurrentPopup = async () => {
    if (!currentPopup) return;

    if (currentPopup.type === 'welcome') {
      // Mark welcome notification as read
      const welcomeNotification = notifications.find(
        notif => notif.type === 'welcome'
      );
      if (welcomeNotification && welcomeNotification.status === 'unread') {
        await markAsRead(welcomeNotification._id);
      }
      setProcessedPopups(prev => new Set([...prev, 'welcome']));
    } else if (currentPopup.type === 'rsu' && currentPopup.data) {
      // Mark RSU notification as read
      await markAsRead(currentPopup.data._id);
      setProcessedPopups(prev => new Set([...prev, `rsu_${currentPopup.data._id}`]));
    } else if (currentPopup.type === 'feature' && currentPopup.data) {
      // Mark feature notification as read based on dismissal_type
      const notification = currentPopup.data;

      // For 'once' and 'until_clicked', mark as read when dismissed
      if (notification.dismissal_type !== 'auto_expire') {
        await markAsRead(notification._id);
      }

      setProcessedPopups(prev => new Set([...prev, `feature_${notification._id}`]));
    }

    setCurrentPopup(null);
  };

  const resetPopupManager = () => {
    setCurrentPopup(null);
    setProcessedPopups(new Set());
  };

  return {
    currentPopup,
    closeCurrentPopup,
    resetPopupManager,
    userName: user?.displayName || user?.email?.split('@')[0] || 'User'
  };
};
