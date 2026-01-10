/**
 * Consent Banner - Israeli Privacy Law Amendment 13 Compliance
 *
 * Shows cookie/analytics consent banner to users who haven't made a choice.
 * Complies with Section 11 (transparency) and Section 8 (lawful processing).
 *
 * Features:
 * - MongoDB-backed consent storage (synced across devices)
 * - Clear explanation of what data is collected
 * - Accept / Decline / Customize options
 * - Link to Privacy Policy
 * - Respects Do Not Track browser setting
 */

import React, { useState } from 'react';
import { X, Shield, Settings } from 'lucide-react';
import { useConsent } from '../contexts/ConsentContext';
import { Link } from 'react-router-dom';

interface ConsentBannerProps {
  onClose?: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onClose }) => {
  const { shouldShowBanner, acceptAll, declineAll, dismissBanner, updateConsent } = useConsent();
  const [showCustomize, setShowCustomize] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  if (!shouldShowBanner) {
    return null;
  }

  const handleAcceptAll = async () => {
    try {
      await acceptAll();
      onClose?.();
    } catch (error) {
      console.error('Failed to accept consent:', error);
    }
  };

  const handleDeclineAll = async () => {
    try {
      await declineAll();
      onClose?.();
    } catch (error) {
      console.error('Failed to decline consent:', error);
    }
  };

  const handleSaveCustom = async () => {
    try {
      await updateConsent(analyticsConsent, marketingConsent);
      onClose?.();
    } catch (error) {
      console.error('Failed to save custom consent:', error);
    }
  };

  const handleDismiss = () => {
    dismissBanner();
    onClose?.();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t-2 border-blue-500 dark:border-blue-400 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close consent banner"
        >
          <X className="w-5 h-5" />
        </button>

        {!showCustomize ? (
          // Simple view - Accept/Decline/Customize
          <div className="pr-12">
            <div className="flex items-start gap-3 mb-4">
              <Shield className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Your Privacy Matters
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  We use analytics to improve Vestika. We collect your email, name, and usage behavior.
                  We respect your privacy - your{' '}
                  <strong>financial data (symbols, prices, account names) is never sent to analytics</strong>.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Learn more in our{' '}
                  <Link
                    to="/privacy-policy"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={handleDeclineAll}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
              >
                Decline All
              </button>
              <button
                onClick={() => setShowCustomize(true)}
                className="px-6 py-2 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Customize
              </button>
            </div>
          </div>
        ) : (
          // Customization view - Granular consent options
          <div className="pr-12">
            <div className="flex items-start gap-3 mb-4">
              <Settings className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Customize Your Privacy Preferences
                </h3>

                {/* Analytics Consent */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analyticsConsent}
                      onChange={(e) => setAnalyticsConsent(e.target.checked)}
                      className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white mb-1">
                        Analytics & Performance
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Help us improve Vestika by allowing usage analytics. Your financial data
                        (symbols, prices, holdings) is never included.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Marketing Consent */}
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white mb-1">
                        Marketing Communications
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Receive updates about new features, tips, and Vestika news.
                      </div>
                    </div>
                  </label>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  You can change these preferences anytime in Settings. See our{' '}
                  <Link
                    to="/privacy-policy"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>{' '}
                  for details.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSaveCustom}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowCustomize(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
