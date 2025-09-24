import React from 'react';
import { UnifiedPopup } from './UnifiedPopup';
import { usePopupManager } from '../hooks/usePopupManager';

export const PopupManager: React.FC = () => {
  const { currentPopup, closeCurrentPopup, userName } = usePopupManager();

  return (
    <UnifiedPopup
      popupType={currentPopup?.type || null}
      popupData={currentPopup?.data}
      userName={userName}
      onClose={closeCurrentPopup}
    />
  );
};
