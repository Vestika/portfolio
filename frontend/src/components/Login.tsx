import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithGoogle } from '../firebase';
import { Shield, Info } from 'lucide-react';

const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Welcome to Vestika
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Sign in to access your portfolio
          </p>
        </div>

        {/* Section 11 Privacy Notice - Amendment 13 Compliance */}
        {showPrivacyNotice && (
          <div className="bg-blue-900/20 border-2 border-blue-500/50 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  Data Collection Notice
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">Section 11 Compliance</span>
                </h3>

                <div className="space-y-4 text-sm text-gray-300">
                  {/* What We Collect */}
                  <div>
                    <p className="font-semibold text-white mb-1">📋 What data we collect:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Name and email address (from your Google account)</li>
                      <li>Profile picture (optional, from Google)</li>
                      <li>Unique user identifier for authentication</li>
                    </ul>
                  </div>

                  {/* Why We Collect */}
                  <div>
                    <p className="font-semibold text-white mb-1">🎯 Purpose:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Authenticate your identity and secure your account</li>
                      <li>Provide portfolio management and analysis services</li>
                      <li>Personalize your experience</li>
                    </ul>
                  </div>

                  {/* Required or Voluntary */}
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="font-semibold text-white mb-1">✅ Is providing data required?</p>
                    <p className="mb-2">
                      <strong className="text-blue-400">Yes, required</strong> - Email and name are necessary to create your Vestika account.
                    </p>
                    <p className="text-yellow-300">
                      ⚠️ <strong>Consequence of not providing:</strong> You cannot use Vestika without authentication.
                    </p>
                  </div>

                  {/* Who Receives Data */}
                  <div>
                    <p className="font-semibold text-white mb-1">🔗 Who receives your data:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Firebase (Google):</strong> Stores your authentication and account data</li>
                      <li><strong>Mixpanel:</strong> Usage analytics (only if you consent)</li>
                      <li><strong>Google Gemini:</strong> AI analysis (only when you request it)</li>
                    </ul>
                    <p className="mt-2 text-green-300">
                      ✓ <strong>Privacy Protection:</strong> Your financial data (symbols, prices, account names) is never sent to analytics.
                    </p>
                  </div>

                  {/* User Rights */}
                  <div>
                    <p className="font-semibold text-white mb-1">⚖️ Your rights:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Access:</strong> View all your data anytime</li>
                      <li><strong>Correction:</strong> Edit your profile and portfolio data</li>
                      <li><strong>Deletion:</strong> Delete your account permanently</li>
                      <li><strong>Export:</strong> Download all your data in JSON format</li>
                      <li><strong>Consent:</strong> Control analytics tracking preferences</li>
                    </ul>
                  </div>

                  {/* Privacy Policy Link */}
                  <div className="bg-gray-800 rounded-lg p-3 mt-4">
                    <p className="text-center">
                      <Info className="w-4 h-4 inline mr-2" />
                      Read our full{' '}
                      <Link
                        to="/privacy-policy"
                        className="text-blue-400 hover:text-blue-300 font-semibold underline"
                      >
                        Privacy Policy
                      </Link>{' '}
                      for complete details.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPrivacyNotice(false)}
                  className="mt-4 text-xs text-gray-400 hover:text-gray-300 underline"
                >
                  Hide this notice
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <div>
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </div>
              )}
            </button>
          </div>
          
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login; 