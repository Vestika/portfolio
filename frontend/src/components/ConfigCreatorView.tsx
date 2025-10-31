import React, { useState } from 'react';
import api from '../utils/api';
import { Button } from '@/components/ui/button';

interface ConfigCreatorViewProps {
  onSuccess?: () => void;
  initialSourceUrl?: string;
}

export const ConfigCreatorView: React.FC<ConfigCreatorViewProps> = ({ onSuccess, initialSourceUrl }) => {
  const [siteName, setSiteName] = useState('');
  const [urlPattern, setUrlPattern] = useState('');
  const [fullPage, setFullPage] = useState(true);
  const [selector, setSelector] = useState('');
  const [isPublic, setIsPublic] = useState(true); // Default to public to help community
  const [testUrl, setTestUrl] = useState(initialSourceUrl || '');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');

  async function handleTestPattern() {
    setError(null);
    setTestResult(null);

    if (!urlPattern || !testUrl) {
      setError('Please provide both URL pattern and test URL');
      return;
    }

    try {
      const regex = new RegExp(urlPattern);
      const matches = regex.test(testUrl);

      if (matches) {
        setTestResult(`✓ URL matches pattern! The URL "${testUrl}" will be detected by this config.`);
      } else {
        setTestResult(`✗ URL does not match. The URL "${testUrl}" will NOT be detected by this config.`);
      }
    } catch (err: any) {
      setError(`Invalid regex pattern: ${err.message}`);
    }
  }

  async function handleViewHtml() {
    setError(null);
    setPreviewHtml('');
    setShowHtmlPreview(true);

    try {
      // Check if extension is available
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        setPreviewHtml('⚠️ Extension not detected. Please use the Vestika extension to view extracted HTML.\n\nTo view HTML:\n1. Install the Vestika Chrome extension\n2. Navigate to the target website\n3. Return to this page and click "View Extracted HTML" again');
        return;
      }

      // Request HTML extraction from extension
      const result = await chrome.runtime.sendMessage({
        type: 'EXTRACT_HTML',
        payload: {
          selector: fullPage ? undefined : selector,
          fullPage: fullPage
        }
      });

      if (result.error) {
        setPreviewHtml(`❌ Error: ${result.error}\n\nMake sure you're on the correct website and try again.`);
      } else if (result.html) {
        setPreviewHtml(result.html);
      } else {
        setPreviewHtml('❌ No HTML received from extension.');
      }
    } catch (err: any) {
      setPreviewHtml(`❌ Error communicating with extension: ${err.message}\n\nMake sure the Vestika extension is installed and you're on the target website.`);
    }
  }

  async function handleCreate() {
    setError(null);
    setSuccess(null);
    setCreating(true);

    // Validation
    if (!siteName || !urlPattern) {
      setError('Site name and URL pattern are required');
      setCreating(false);
      return;
    }

    if (!fullPage && !selector) {
      setError('Selector is required when not using full page extraction');
      setCreating(false);
      return;
    }

    try {
      // Test regex
      new RegExp(urlPattern);

      await api.post('/api/import/configs', {
        site_name: siteName,
        url_pattern: urlPattern,
        full_page: fullPage,
        selector: fullPage ? undefined : selector,
        is_public: isPublic,
        verified: false,
        status: 'active',
        enabled_users_count: 0,
        successful_imports_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      setSuccess('Configuration created successfully!');
      setCreating(false);

      // Reset form
      setSiteName('');
      setUrlPattern('');
      setFullPage(true);
      setSelector('');
      setIsPublic(false);
      setTestUrl('');
      setTestResult(null);

      // Call success callback if provided
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1500); // Wait a bit to show success message
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create configuration');
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Configuration</h1>
          <p className="text-gray-400">
            Create a new extraction configuration for a financial site
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-4 mb-6">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-6">Configuration Details</h2>

          <div className="space-y-6">
            {/* Site Name */}
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Site Name *
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g., Robinhood, Coinbase, Vanguard"
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-500 text-xs mt-1">Human-readable name for the financial site</p>
            </div>

            {/* URL Pattern */}
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">
                URL Pattern (Regex) *
              </label>
              <input
                type="text"
                value={urlPattern}
                onChange={(e) => setUrlPattern(e.target.value)}
                placeholder="e.g., ^https://(www\.)?robinhood\.com/(account|portfolio)"
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-gray-500 text-xs mt-1">
                Regular expression to match URLs where this config should be used
              </p>
            </div>

            {/* Test URL */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <label className="block text-gray-400 text-sm font-medium mb-2">
                Test Your Pattern
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="e.g., https://robinhood.com/account"
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                />
                <Button onClick={handleTestPattern} variant="secondary" size="sm">
                  Test
                </Button>
              </div>
              {testResult && (
                <div className={`text-sm p-3 rounded ${
                  testResult.startsWith('✓')
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-yellow-900/30 text-yellow-400'
                }`}>
                  {testResult}
                </div>
              )}
            </div>

            {/* Full Page vs Selector */}
            <div>
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={fullPage}
                  onChange={(e) => setFullPage(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Extract full page HTML</span>
              </label>

              {!fullPage && (
                <div>
                  <label className="block text-gray-400 text-sm font-medium mb-2">
                    CSS Selector
                  </label>
                  <input
                    type="text"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder="e.g., table.holdings, #portfolio-table"
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-500 focus:border-blue-500 focus:outline-none font-mono text-sm"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    CSS selector to target specific element containing holdings
                  </p>
                </div>
              )}
            </div>

            {/* Public/Private */}
            <div>
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Share with community (Public)</span>
              </label>
              <p className="text-gray-500 text-xs mt-1 ml-6">
                {isPublic
                  ? '✓ This config will appear in the gallery and help other Vestika users'
                  : 'This config will be private - only you can use it'}
              </p>
            </div>

            {/* View Extracted HTML Button */}
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-gray-200 font-medium">Preview Extracted HTML</h3>
                  <p className="text-gray-400 text-xs mt-1">
                    View what HTML will be sent to AI for extraction. Use this to debug your config.
                  </p>
                </div>
              </div>
              <Button
                onClick={handleViewHtml}
                variant="secondary"
                size="sm"
                className="w-full mt-2"
              >
                View Extracted HTML
              </Button>
            </div>
          </div>
        </div>

        {/* HTML Preview Modal */}
        {showHtmlPreview && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">Extracted HTML Preview</h2>
                <button
                  onClick={() => setShowHtmlPreview(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1">
                <pre className="text-gray-300 text-xs bg-gray-900 p-4 rounded overflow-x-auto whitespace-pre-wrap break-words font-mono">
                  {previewHtml || 'Loading...'}
                </pre>
              </div>
              <div className="p-4 border-t border-gray-700 flex justify-between items-center">
                <p className="text-gray-400 text-sm">
                  {previewHtml && `${Math.round(previewHtml.length / 1024)} KB`}
                </p>
                <Button
                  onClick={() => setShowHtmlPreview(false)}
                  variant="secondary"
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 mb-6">
          <h3 className="text-blue-300 font-semibold mb-2">Tips for Creating Configs</h3>
          <ul className="text-gray-300 text-sm space-y-1 list-disc list-inside">
            <li>Test your URL pattern with multiple URLs from the target site</li>
            <li>Use full page extraction when possible for better AI accuracy</li>
            <li>Only use selectors when the site has too much irrelevant content</li>
            <li>Keep configs private until you've verified they work correctly</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Configuration'}
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="secondary"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
