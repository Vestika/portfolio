import React from 'react';
import { WelcomePopup } from './WelcomePopup';
import { RSUPopup } from './RSUPopup';
import { PopupType } from '../hooks/usePopupManager';

interface UnifiedPopupProps {
  popupType: PopupType | null;
  popupData?: any;
  userName: string;
  onClose: () => void;
}

export const UnifiedPopup: React.FC<UnifiedPopupProps> = ({ 
  popupType, 
  popupData, 
  userName, 
  onClose 
}) => {
  if (!popupType) return null;

  switch (popupType) {
    case 'welcome':
      return (
        <WelcomePopup
          isOpen={true}
          onClose={onClose}
          userName={userName}
        />
      );
    case 'rsu':
      return (
        <RSUPopup
          isOpen={true}
          onClose={onClose}
          notification={popupData}
        />
      );
    default:
      return null;
  }
};
