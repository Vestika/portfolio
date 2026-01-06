import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Detect iOS Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

  useEffect(() => {
    // Check PWA readiness
    console.log('📱 [PWA] Install button mounted', {
      isIOS,
      isInStandaloneMode,
      hasServiceWorker: 'serviceWorker' in navigator,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
    });

    // Don't show button if already installed
    if (isInStandaloneMode || window.matchMedia('(display-mode: standalone)').matches) {
      console.log('✅ [PWA] App already installed');
      setIsInstallable(false);
      return;
    }

    // iOS Safari doesn't support beforeinstallprompt, so show iOS instructions
    if (isIOS) {
      console.log('🍎 [PWA] iOS detected - showing manual install instructions');
      setIsInstallable(true);
      return;
    }

    // Listen for the beforeinstallprompt event (Android/Chrome/Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🎉 [PWA] beforeinstallprompt event fired - app is installable!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      console.log('✅ [PWA] App installed successfully');
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Log if event hasn't fired after 3 seconds (for debugging)
    const debugTimer = setTimeout(() => {
      console.log('⏰ [PWA] beforeinstallprompt not fired yet. This is normal if:', [
        '1. App is already installed',
        '2. Not served over HTTPS',
        '3. Service worker not registered yet',
        '4. Not enough user engagement'
      ]);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(debugTimer);
    };
  }, [isIOS, isInStandaloneMode]);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Show iOS instructions modal
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      console.warn('⚠️ [PWA] No deferred prompt available');
      return;
    }

    console.log('🚀 [PWA] Showing install prompt');

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`👤 [PWA] User response: ${outcome}`);

    if (outcome === 'accepted') {
      console.log('✅ [PWA] User accepted the install prompt');
    } else {
      console.log('❌ [PWA] User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
  };

  // Don't render if not installable
  if (!isInstallable) {
    return null;
  }

  return (
    <>
      {/* Install Button */}
      <button
        onClick={handleInstallClick}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 lg:hidden"
        title="Install Vestika App"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
            {/* Close button */}
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Download className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Install Vestika</h3>
              </div>

              <p className="text-gray-300 text-sm">
                To install Vestika on your iPhone or iPad:
              </p>

              <ol className="space-y-3 text-sm text-gray-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                    1
                  </span>
                  <span>
                    Tap the <strong className="text-white">Share</strong> button{' '}
                    <span className="inline-block px-2 py-0.5 bg-gray-700 rounded text-xs">
                      <svg className="inline-block h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                      </svg>
                    </span>{' '}
                    in Safari
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                    2
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <strong className="text-white">"Add to Home Screen"</strong>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                    3
                  </span>
                  <span>
                    Tap <strong className="text-white">"Add"</strong> to install
                  </span>
                </li>
              </ol>

              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowIOSInstructions(false)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
