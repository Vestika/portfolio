/**
 * Privacy Policy Page - Israeli Privacy Law Amendment 13 Compliance
 *
 * Comprehensive privacy policy covering:
 * - Section 11: Notice requirements when collecting data
 * - Section 8: Lawful processing basis
 * - User rights: Access, correction, deletion, portability
 * - Third-party disclosures
 * - Data retention and security
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Lock, Eye, Download, Trash2, Mail, AlertCircle, Globe } from 'lucide-react';

type Language = 'en' | 'he';

export const PrivacyPolicy: React.FC = () => {
  const [language, setLanguage] = useState<Language>('en');

  return (
    <div className={`min-h-screen bg-gray-900 text-gray-100 py-12 px-4 sm:px-6 lg:px-8 ${language === 'he' ? 'rtl' : ''}`}>
      <div className="max-w-4xl mx-auto">
        {/* Language Toggle */}
        <div className="flex justify-end mb-6">
          <div className="bg-gray-800 rounded-lg p-1 flex gap-1">
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                language === 'en'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              English
            </button>
            <button
              onClick={() => setLanguage('he')}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                language === 'he'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              עברית
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-12">
          <div className={`flex items-center gap-3 mb-4 ${language === 'he' ? 'flex-row-reverse' : ''}`}>
            <Shield className="w-10 h-10 text-blue-500" />
            <h1 className="text-4xl font-bold text-white">
              {language === 'en' ? 'Privacy Policy' : 'מדיניות פרטיות'}
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            {language === 'en' ? 'Effective Date: January 10, 2026' : 'תאריך תחילה: 10 בינואר 2026'}
          </p>
          <p className="text-gray-400 text-sm mt-2">
            {language === 'en'
              ? 'This policy complies with the Israeli Privacy Protection Law, Amendment No. 13 (תיקון 13)'
              : 'מדיניות זו עומדת בדרישות חוק הגנת הפרטיות, תיקון מס\' 13'}
          </p>
        </div>

        {/* Hebrew Translation Notice */}
        {language === 'he' && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-6 mb-8">
            <p className="text-yellow-300 text-center">
              <strong>שימו לב:</strong> התרגום העברי המלא נמצא בהכנה. בינתיים, אנא עיינו בגרסה האנגלית.
              <br />
              <button
                onClick={() => setLanguage('en')}
                className="text-blue-400 hover:text-blue-300 underline mt-2"
              >
                לחץ כאן למעבר לאנגלית
              </button>
            </p>
            <p className="text-yellow-200 text-sm text-center mt-3">
              <strong>Notice:</strong> Full Hebrew translation is in preparation. Please refer to the English version.
            </p>
          </div>
        )}

        {/* Quick Links */}
        {language === 'en' && (
          <nav className="bg-gray-800 rounded-lg p-6 mb-12">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Navigation</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <li><a href="#what-we-collect" className="text-blue-400 hover:text-blue-300">What We Collect</a></li>
              <li><a href="#why-we-collect" className="text-blue-400 hover:text-blue-300">Why We Collect</a></li>
              <li><a href="#your-rights" className="text-blue-400 hover:text-blue-300">Your Rights</a></li>
              <li><a href="#third-parties" className="text-blue-400 hover:text-blue-300">Third-Party Services</a></li>
              <li><a href="#data-retention" className="text-blue-400 hover:text-blue-300">Data Retention</a></li>
              <li><a href="#security" className="text-blue-400 hover:text-blue-300">Security Measures</a></li>
              <li><a href="#cookies" className="text-blue-400 hover:text-blue-300">Cookies & Tracking</a></li>
              <li><a href="#contact" className="text-blue-400 hover:text-blue-300">Contact Us</a></li>
            </ul>
          </nav>
        )}

        {/* Main Content */}
        <div className="space-y-12">

          {/* Section 1: Data Controller */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-500" />
              1. Data Controller Information
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-3">
              <p className="text-gray-300">
                <strong className="text-white">Service Name:</strong> Vestika
              </p>
              <p className="text-gray-300">
                <strong className="text-white">Website:</strong>{' '}
                <a href="https://app.vestika.io" className="text-blue-400 hover:text-blue-300">
                  app.vestika.io
                </a>
              </p>
              <p className="text-gray-300">
                <strong className="text-white">Support Contact:</strong>{' '}
                <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  support@vestika.io
                </a>
              </p>
              <p className="text-gray-300 text-sm mt-4">
                Vestika is the data controller responsible for your personal information collected through our portfolio management platform.
              </p>
            </div>
          </section>

          {/* Section 2: What We Collect */}
          <section id="what-we-collect">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-blue-500" />
              2. What Data We Collect
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Account Information</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Name and email address</strong> (from your Google account)</li>
                  <li><strong className="text-white">Profile picture</strong> (optional, from Google)</li>
                  <li><strong className="text-white">Firebase user ID</strong> (unique identifier)</li>
                  <li><strong className="text-white">Timezone</strong> (for accurate date/time display)</li>
                  <li><strong className="text-white">User preferences</strong> (display settings, consent preferences)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Portfolio Data (Voluntary)</h3>
                <p className="text-gray-300 mb-3">
                  You choose what portfolio data to upload. This may include:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">Holdings:</strong> Stock symbols, quantities, cost basis</li>
                  <li><strong className="text-white">Accounts:</strong> Account names, types (401k, IRA, taxable, etc.)</li>
                  <li><strong className="text-white">Transactions:</strong> Buy/sell history, dividend records</li>
                  <li><strong className="text-white">Tags:</strong> Custom metadata you create for holdings</li>
                  <li><strong className="text-white">AI Chat History:</strong> Conversations with our AI analyst</li>
                  <li><strong className="text-white">IBKR Statements:</strong> HTML files uploaded for transaction extraction (deleted immediately after processing)</li>
                </ul>
                <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mt-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Important:</strong> Portfolio data is <strong>voluntary</strong>. You decide what to upload.
                    Not providing portfolio data means you cannot use portfolio analysis features.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Analytics Data (With Your Consent)</h3>
                <p className="text-gray-300 mb-3">
                  If you consent to analytics, we share with Mixpanel:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><strong className="text-white">User identification:</strong> Email address, display name, Firebase user ID</li>
                  <li><strong className="text-white">Usage events:</strong> Page views, feature usage, clicks</li>
                  <li><strong className="text-white">Session data:</strong> Session ID, duration, viewport size</li>
                  <li><strong className="text-white">Device information:</strong> Browser type, operating system, screen resolution</li>
                </ul>
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 mt-4">
                  <p className="text-green-300 text-sm">
                    <strong>Privacy Protection:</strong> Your <strong>financial data (stock symbols, prices, holdings, account names) is never sent to analytics</strong>.
                    We use a privacy sanitizer that strips sensitive financial information before any analytics tracking.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Why We Collect */}
          <section id="why-we-collect">
            <h2 className="text-2xl font-bold text-white mb-4">
              3. Purpose of Processing (Section 11 Compliance)
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Portfolio Management & Analysis</h3>
                <p className="text-gray-300">
                  We process your portfolio data to provide portfolio tracking, performance analysis,
                  AI-powered insights, tax planning tools, and cash flow projections.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  <strong>Legal Basis:</strong> Contract performance (providing the service you signed up for)
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">User Authentication & Security</h3>
                <p className="text-gray-300">
                  We use your email and Firebase ID to authenticate you and protect your account from unauthorized access.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  <strong>Legal Basis:</strong> Legitimate interest (security and fraud prevention)
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Service Improvement (Analytics)</h3>
                <p className="text-gray-300">
                  With your explicit consent, we use analytics to understand how you use Vestika,
                  identify bugs, and improve features.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  <strong>Legal Basis:</strong> User consent (opt-in required)
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">AI-Powered Analysis</h3>
                <p className="text-gray-300">
                  When you use our AI analyst, we send your portfolio data to Google Gemini API for analysis.
                  This happens only when you explicitly request AI insights.
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  <strong>Legal Basis:</strong> User consent (you initiate AI analysis)
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Your Rights */}
          <section id="your-rights">
            <h2 className="text-2xl font-bold text-white mb-4">
              4. Your Rights (Sections 13-14 Compliance)
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <p className="text-gray-300">
                Under Israeli Privacy Protection Law, you have the following rights:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Eye className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Right to Access</h3>
                    <p className="text-gray-300 mb-2">
                      You can view all your personal data at any time by navigating through Vestika:
                    </p>
                    <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 text-sm mb-2">
                      <li>Profile information: Profile → Settings</li>
                      <li>Portfolio data: Portfolio view</li>
                      <li>Holdings: Portfolio → Holdings table</li>
                      <li>Tags: Tags view</li>
                      <li>AI chat history: Analyst view</li>
                      <li>Consent preferences: Profile → Settings</li>
                    </ul>
                    <p className="text-sm text-gray-400">
                      <strong>Need help?</strong> Contact{' '}
                      <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300">
                        support@vestika.io
                      </a>{' '}
                      if you need assistance accessing your data.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1 flex items-center justify-center">
                    ✏️
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Right to Correction</h3>
                    <p className="text-gray-300 mb-2">
                      You can edit your profile information, portfolios, accounts, and holdings directly in the app at any time.
                    </p>
                    <p className="text-sm text-gray-400">
                      <strong>How to exercise:</strong> Edit directly in the app. Need help? Contact{' '}
                      <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300">
                        support@vestika.io
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Trash2 className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Right to Deletion</h3>
                    <p className="text-gray-300 mb-2">
                      You can delete your account and all associated data at any time. Deletion is permanent and irreversible.
                    </p>
                    <p className="text-sm text-gray-400 mb-2">
                      <strong>How to exercise:</strong> Profile → Settings → Danger Zone → Delete Account
                    </p>
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mt-3">
                      <p className="text-red-300 text-sm">
                        <strong>What gets deleted:</strong> All portfolios, holdings, accounts, tags, AI chat history,
                        preferences, and user profile.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Right to Withdraw Consent</h3>
                    <p className="text-gray-300 mb-2">
                      You can withdraw your analytics consent at any time. This stops all tracking immediately.
                    </p>
                    <p className="text-sm text-gray-400">
                      <strong>How to exercise:</strong> Profile → Settings → Privacy Preferences → Manage Consent
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mt-6">
                <p className="text-blue-300 text-sm">
                  <strong>Need Help?</strong> Contact{' '}
                  <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300 font-medium">
                    support@vestika.io
                  </a>{' '}
                  for assistance accessing or managing your data.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Third Parties */}
          <section id="third-parties">
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Data Sharing & Third-Party Services
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <p className="text-gray-300">
                We share your data with the following third-party services to provide Vestika's functionality:
              </p>

              <div className="space-y-6">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Firebase (Google Cloud)</h3>
                  <p className="text-gray-300 mb-2">
                    <strong>Purpose:</strong> User authentication and data storage
                  </p>
                  <p className="text-gray-300 mb-2">
                    <strong>Data Shared:</strong> Email, name, user ID, all portfolio data
                  </p>
                  <p className="text-sm text-gray-400">
                    <strong>Data Processing Agreement:</strong>{' '}
                    <a
                      href="https://cloud.google.com/terms/data-processing-addendum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Google Cloud DPA
                    </a>
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Mixpanel</h3>
                  <p className="text-gray-300 mb-2">
                    <strong>Purpose:</strong> Usage analytics (only with your consent)
                  </p>
                  <p className="text-gray-300 mb-2">
                    <strong>Data Shared:</strong> Email, name, Firebase user ID, usage events, browser/device info, viewport size
                  </p>
                  <p className="text-green-300 text-sm mb-2">
                    ✓ <strong>Privacy Protection:</strong> Financial data (stock symbols, prices, holdings, account names) is never sent
                  </p>
                  <p className="text-sm text-gray-400">
                    <strong>Data Processing Agreement:</strong>{' '}
                    <a
                      href="https://mixpanel.com/legal/dpa/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Mixpanel DPA
                    </a>
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Google Gemini (AI API)</h3>
                  <p className="text-gray-300 mb-2">
                    <strong>Purpose:</strong> AI-powered portfolio analysis (only when you request it)
                  </p>
                  <p className="text-gray-300 mb-2">
                    <strong>Data Shared:</strong> Portfolio holdings and context for analysis
                  </p>
                  <p className="text-green-300 text-sm mb-2">
                    ✓ <strong>Privacy Note:</strong> Google does not use your data to train AI models (per Google Cloud AI terms)
                  </p>
                  <p className="text-sm text-gray-400">
                    <strong>Data Processing Agreement:</strong>{' '}
                    <a
                      href="https://cloud.google.com/terms/data-processing-addendum"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Google Cloud DPA
                    </a>
                  </p>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4 mt-6">
                <p className="text-gray-300 text-sm">
                  <strong>Data Location:</strong> Your data is processed and stored on servers managed by Google Cloud (Firebase).
                  Israel has an adequacy decision from the EU, meaning data transfers comply with GDPR standards.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Data Retention */}
          <section id="data-retention">
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Data Retention Policy
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-300 mb-4">
                We retain your data for the following periods:
              </p>
              <div className="space-y-4">
                <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">Account Data</p>
                    <p className="text-sm text-gray-400">Profile, portfolios, holdings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">Active account duration</p>
                    <p className="text-sm text-gray-400">Deleted when you delete account</p>
                  </div>
                </div>

                <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">Deleted Account Data</p>
                    <p className="text-sm text-gray-400">Personal data after deletion</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">30 days in backups</p>
                    <p className="text-sm text-gray-400">Then permanently purged</p>
                  </div>
                </div>

                <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">AI Chat History</p>
                    <p className="text-sm text-gray-400">Conversations with AI analyst</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">Until you delete</p>
                    <p className="text-sm text-gray-400">Manual deletion available</p>
                  </div>
                </div>

                <div className="flex justify-between items-start border-b border-gray-700 pb-3">
                  <div className="flex-1">
                    <p className="text-white font-medium">Analytics Data</p>
                    <p className="text-sm text-gray-400">Mixpanel events</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">60 months</p>
                    <p className="text-sm text-gray-400">Mixpanel retention policy</p>
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white font-medium">IBKR HTML Uploads</p>
                    <p className="text-sm text-gray-400">Statement files</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">Immediate deletion</p>
                    <p className="text-sm text-gray-400">Deleted after extraction</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7: Security */}
          <section id="security">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-blue-500" />
              7. Data Security Measures
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <p className="text-gray-300">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li><strong className="text-white">Firebase Authentication:</strong> All API requests require valid authentication tokens</li>
                <li><strong className="text-white">User Isolation:</strong> MongoDB queries are scoped to your user ID - you can only access your own data</li>
                <li><strong className="text-white">HTTPS Encryption:</strong> All data transmitted between your browser and our servers is encrypted</li>
                <li><strong className="text-white">Privacy Sanitizer:</strong> Removes sensitive financial data before analytics tracking</li>
                <li><strong className="text-white">Do Not Track:</strong> We respect browser DNT settings</li>
                <li><strong className="text-white">Regular Security Updates:</strong> Dependencies are regularly updated to patch vulnerabilities</li>
              </ul>

              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 mt-4">
                <p className="text-yellow-300 text-sm">
                  <strong>Security Breach Notification:</strong> In the unlikely event of a data breach affecting your information,
                  we will notify you and the Israeli Privacy Protection Authority without unreasonable delay.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8: Cookies */}
          <section id="cookies">
            <h2 className="text-2xl font-bold text-white mb-4">
              8. Cookies and Tracking Technologies
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <p className="text-gray-300">
                We use the following cookies and tracking technologies:
              </p>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Essential Cookies (Required)</h3>
                <p className="text-gray-300 mb-2">
                  These cookies are necessary for Vestika to function:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li><strong className="text-white">Authentication tokens:</strong> Keep you logged in</li>
                  <li><strong className="text-white">Session cookies:</strong> Maintain your session state</li>
                  <li><strong className="text-white">Consent preferences:</strong> Remember your privacy choices</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Analytics Cookies (Optional)</h3>
                <p className="text-gray-300 mb-2">
                  These cookies require your consent:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li><strong className="text-white">Mixpanel tracking:</strong> Understand how you use Vestika</li>
                  <li><strong className="text-white">Session analytics:</strong> Track user flows and feature usage</li>
                </ul>
                <p className="text-sm text-gray-400 mt-2">
                  You can withdraw consent at any time in Settings → Privacy Preferences.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Do Not Track</h3>
                <p className="text-gray-300">
                  We respect the Do Not Track (DNT) browser setting. If DNT is enabled, we will not initialize analytics tracking
                  even if you previously consented.
                </p>
              </div>
            </div>
          </section>

          {/* Section 9: International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              9. International Data Transfers
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-300 mb-4">
                Your data is stored on Google Cloud (Firebase) servers. Google Cloud operates data centers worldwide.
              </p>
              <p className="text-gray-300 mb-4">
                <strong className="text-white">Israeli Adequacy Decision:</strong> Israel has been granted an adequacy decision
                by the European Union, meaning data transfers from Israel to the EU (and vice versa) comply with GDPR standards.
              </p>
              <p className="text-gray-300">
                <strong className="text-white">Data Processing Agreements:</strong> We have Data Processing Agreements (DPAs) in place
                with all third-party processors (Google Cloud, Mixpanel) to ensure your data is protected wherever it's processed.
              </p>
            </div>
          </section>

          {/* Section 10: Changes to Policy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              10. Changes to This Privacy Policy
            </h2>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-300 mb-4">
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology,
                legal requirements, or other factors.
              </p>
              <p className="text-gray-300 mb-4">
                <strong className="text-white">How We Notify You:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>We will update the "Effective Date" at the top of this page</li>
                <li>For significant changes, we will send an in-app notification</li>
                <li>For major changes affecting your rights, we will send an email notification</li>
              </ul>
              <p className="text-gray-300 mt-4">
                We encourage you to review this Privacy Policy periodically to stay informed about how we protect your information.
              </p>
            </div>
          </section>

          {/* Section 11: Contact */}
          <section id="contact">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-blue-500" />
              11. Contact Us
            </h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Contact Vestika</h3>
                <p className="text-gray-300 mb-3">
                  If you have questions about this Privacy Policy or want to exercise your rights:
                </p>
                <div className="bg-gray-700 rounded-lg p-4">
                  <p className="text-white font-medium mb-2">Support Team</p>
                  <p className="text-gray-300">
                    Email:{' '}
                    <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      support@vestika.io
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-700 pt-8 text-center">
            <p className="text-gray-400 text-sm mb-4">
              This Privacy Policy was last updated on January 10, 2026.
            </p>
            <p className="text-gray-400 text-sm mb-4">
              It complies with the Israeli Privacy Protection Law (התקנות הגנת הפרטיות, התשמ״א-1981)
              and Amendment No. 13 (תיקון 13, effective August 14, 2025).
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <Link to="/portfolio" className="text-blue-400 hover:text-blue-300">
                Back to Portfolio
              </Link>
              <a href="mailto:support@vestika.io" className="text-blue-400 hover:text-blue-300">
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
