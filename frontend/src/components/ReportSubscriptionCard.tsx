import React, { useState, useEffect } from 'react';
import {
  Mail,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Send,
  Pause,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { usePortfolioData } from '../contexts/PortfolioDataContext';
import {
  ReportSubscription,
  ReportSections,
  ReportFrequency,
  ReportFormat,
  DEFAULT_SECTIONS,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  pauseSubscription,
  resumeSubscription,
  requestEmailVerification,
  sendReportNow,
  getFrequencyLabel,
  getDayLabel,
  formatNextReportDate,
} from '../utils/reports-api';

// Section labels for display
const SECTION_LABELS: Record<keyof ReportSections, { name: string; description: string }> = {
  portfolio_summary: { name: 'Portfolio Summary', description: 'Total value and overview' },
  asset_allocation: { name: 'Asset Allocation', description: 'Distribution by type' },
  holdings_table: { name: 'Top Holdings', description: 'Your largest positions' },
  performance_chart: { name: 'Performance Chart', description: 'Value over time' },
  sector_breakdown: { name: 'Sector Breakdown', description: 'Distribution by sector' },
  geographical_breakdown: { name: 'Geographic Distribution', description: 'By region' },
  concentration_analysis: { name: 'Concentration Analysis', description: 'Risk metrics' },
  options_vesting: { name: 'Options & RSU', description: 'Upcoming vesting events' },
  ai_insights: { name: 'AI Insights', description: 'AI-generated analysis' },
};

const ReportSubscriptionCard: React.FC = () => {
  const { allPortfoliosData } = usePortfolioData();
  const [subscription, setSubscription] = useState<ReportSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSections, setShowSections] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<ReportFrequency>('monthly');
  const [preferredDay, setPreferredDay] = useState(1);
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [selectedPortfolios, setSelectedPortfolios] = useState<string[]>([]);
  const [includeAllPortfolios, setIncludeAllPortfolios] = useState(true);
  const [sections, setSections] = useState<ReportSections>(DEFAULT_SECTIONS);
  const [format, setFormat] = useState<ReportFormat>('pdf');

  // Load subscription on mount
  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setIsLoading(true);
      const sub = await getSubscription();
      setSubscription(sub);
      if (sub) {
        setEmail(sub.email_address);
        setFrequency(sub.frequency);
        setPreferredDay(sub.preferred_day);
        setPreferredTime(sub.preferred_time_utc);
        setSelectedPortfolios(sub.portfolio_ids);
        setIncludeAllPortfolios(sub.include_all_portfolios);
        setSections(sub.sections);
        setFormat(sub.format);
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    if (!email) {
      showMessage('error', 'Please enter an email address');
      return;
    }

    try {
      setIsSaving(true);

      if (subscription) {
        // Update existing
        await updateSubscription({
          email_address: email,
          frequency,
          preferred_day: preferredDay,
          preferred_time_utc: preferredTime,
          portfolio_ids: selectedPortfolios,
          include_all_portfolios: includeAllPortfolios,
          sections,
          format,
        });
        showMessage('success', 'Subscription updated successfully');
      } else {
        // Create new
        await createSubscription({
          email_address: email,
          frequency,
          preferred_day: preferredDay,
          preferred_time_utc: preferredTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          portfolio_ids: selectedPortfolios,
          include_all_portfolios: includeAllPortfolios,
          sections,
          format,
          include_inline_html: true,
        });
        showMessage('success', 'Subscription created! Please verify your email.');
      }

      await loadSubscription();
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to save subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    try {
      setIsSaving(true);
      await requestEmailVerification(email);
      showMessage('success', 'Verification email sent! Check your inbox.');
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to send verification email');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePauseResume = async () => {
    if (!subscription) return;

    try {
      setIsSaving(true);
      if (subscription.is_active) {
        await pauseSubscription();
        showMessage('success', 'Subscription paused');
      } else {
        await resumeSubscription();
        showMessage('success', 'Subscription resumed');
      }
      await loadSubscription();
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to update subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your report subscription?')) return;

    try {
      setIsSaving(true);
      await deleteSubscription();
      setSubscription(null);
      setEmail('');
      setIsExpanded(false);
      showMessage('success', 'Subscription deleted');
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to delete subscription');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNow = async () => {
    try {
      setIsSaving(true);
      const result = await sendReportNow();
      showMessage('success', result.message);
    } catch (error: any) {
      showMessage('error', error.response?.data?.detail || 'Failed to send report');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Get portfolio list for selection
  const portfolioList = Object.entries(allPortfoliosData?.portfolios || {}).map(([id, data]: [string, any]) => ({
    id,
    name: data.portfolio_metadata?.portfolio_name || id,
  }));

  if (isLoading) {
    return (
      <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-green-500 mr-3" />
            <span className="text-gray-300">Loading report settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/40 backdrop-blur-xl border-gray-700/50 shadow-2xl">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl text-white flex items-center">
          <FileText size={24} className="mr-3 text-orange-400" />
          Portfolio Reports
        </CardTitle>
        <CardDescription className="text-gray-400 text-lg">
          Receive periodic portfolio reports via email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Banner */}
        {subscription && (
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            subscription.is_active && subscription.email_verified
              ? 'bg-green-500/10 border-green-500/30'
              : subscription.is_active && !subscription.email_verified
              ? 'bg-yellow-500/10 border-yellow-500/30'
              : 'bg-gray-700/30 border-gray-600/30'
          }`}>
            <div className="flex items-center space-x-3">
              {subscription.is_active && subscription.email_verified ? (
                <>
                  <CheckCircle size={20} className="text-green-400" />
                  <div>
                    <p className="text-green-300 font-medium">Reports Active</p>
                    <p className="text-gray-400 text-sm">
                      Next report: {formatNextReportDate(subscription.next_report_at)}
                    </p>
                  </div>
                </>
              ) : subscription.is_active && !subscription.email_verified ? (
                <>
                  <AlertCircle size={20} className="text-yellow-400" />
                  <div>
                    <p className="text-yellow-300 font-medium">Email Verification Required</p>
                    <p className="text-gray-400 text-sm">
                      Verify your email to start receiving reports
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Pause size={20} className="text-gray-400" />
                  <div>
                    <p className="text-gray-300 font-medium">Reports Paused</p>
                    <p className="text-gray-400 text-sm">Resume to continue receiving reports</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {subscription.is_active && !subscription.email_verified && (
                <Button
                  onClick={handleVerifyEmail}
                  disabled={isSaving}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Verify Email
                </Button>
              )}
              {subscription.email_verified && (
                <Button
                  onClick={handleSendNow}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Send size={16} className="mr-2" />
                  Send Now
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`flex items-center space-x-2 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          }`}>
            {message.type === 'success'
              ? <CheckCircle size={18} className="text-green-400" />
              : <AlertCircle size={18} className="text-red-400" />
            }
            <span className={message.type === 'success' ? 'text-green-300' : 'text-red-300'}>
              {message.text}
            </span>
          </div>
        )}

        {/* Toggle to show/hide form */}
        {!subscription && !isExpanded && (
          <Button
            onClick={() => setIsExpanded(true)}
            className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
          >
            <Mail size={18} className="mr-2" />
            Subscribe to Reports
          </Button>
        )}

        {/* Main Form */}
        {(subscription || isExpanded) && (
          <div className="space-y-6">
            {/* Email */}
            <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
              <Label className="text-gray-200 text-lg font-medium flex items-center mb-3">
                <Mail size={18} className="mr-2 text-gray-400" />
                Email Address
              </Label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              />
            </div>

            <Separator className="bg-gray-600/50" />

            {/* Frequency */}
            <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
              <Label className="text-gray-200 text-lg font-medium flex items-center mb-3">
                <Calendar size={18} className="mr-2 text-gray-400" />
                Frequency
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {(['weekly', 'monthly', 'quarterly'] as ReportFrequency[]).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setFrequency(freq)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      frequency === freq
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                    }`}
                  >
                    {getFrequencyLabel(freq)}
                  </button>
                ))}
              </div>

              {/* Day picker */}
              <div className="mt-4 flex items-center space-x-4">
                <Label className="text-gray-400">
                  {frequency === 'weekly' ? 'Day of week:' : 'Day of month:'}
                </Label>
                <select
                  value={preferredDay}
                  onChange={(e) => setPreferredDay(Number(e.target.value))}
                  className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  {frequency === 'weekly' ? (
                    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => (
                      <option key={i} value={i} className="bg-gray-700">{day}</option>
                    ))
                  ) : (
                    Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day} className="bg-gray-700">{getDayLabel(frequency, day)}</option>
                    ))
                  )}
                </select>

                <Label className="text-gray-400 ml-4">Time (UTC):</Label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  className="px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <Separator className="bg-gray-600/50" />

            {/* Portfolio Selection */}
            {portfolioList.length > 1 && (
              <>
                <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-gray-200 text-lg font-medium">Portfolios</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-400 text-sm">Include all</span>
                      <Switch
                        checked={includeAllPortfolios}
                        onCheckedChange={setIncludeAllPortfolios}
                      />
                    </div>
                  </div>

                  {!includeAllPortfolios && (
                    <div className="space-y-2 mt-3">
                      {portfolioList.map((portfolio) => (
                        <label
                          key={portfolio.id}
                          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-600/30 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPortfolios.includes(portfolio.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPortfolios([...selectedPortfolios, portfolio.id]);
                              } else {
                                setSelectedPortfolios(selectedPortfolios.filter(id => id !== portfolio.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-600 text-orange-500 focus:ring-orange-500"
                          />
                          <span className="text-gray-300">{portfolio.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <Separator className="bg-gray-600/50" />
              </>
            )}

            {/* Report Sections */}
            <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
              <button
                onClick={() => setShowSections(!showSections)}
                className="w-full flex items-center justify-between text-gray-200 text-lg font-medium"
              >
                <span>Report Sections</span>
                {showSections ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {showSections && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {(Object.keys(sections) as (keyof ReportSections)[]).map((key) => (
                    <label
                      key={key}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-gray-700/30 hover:bg-gray-600/30 cursor-pointer"
                    >
                      <Switch
                        checked={sections[key]}
                        onCheckedChange={() => toggleSection(key)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-gray-200 font-medium">{SECTION_LABELS[key].name}</p>
                        <p className="text-gray-500 text-sm">{SECTION_LABELS[key].description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Separator className="bg-gray-600/50" />

            {/* Format */}
            <div className="p-4 rounded-lg bg-gray-700/30 border border-gray-600/30">
              <Label className="text-gray-200 text-lg font-medium mb-3 block">Report Format</Label>
              <div className="flex space-x-4">
                {(['pdf', 'html'] as ReportFormat[]).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFormat(fmt)}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                      format === fmt
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-3">
                {subscription && (
                  <>
                    <Button
                      onClick={handlePauseResume}
                      disabled={isSaving}
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      {subscription.is_active ? (
                        <>
                          <Pause size={16} className="mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play size={16} className="mr-2" />
                          Resume
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={isSaving}
                      variant="outline"
                      className="border-red-600/50 text-red-400 hover:bg-red-600/20"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </Button>
                  </>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving || !email}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 px-8"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  subscription ? 'Update Subscription' : 'Create Subscription'
                )}
              </Button>
            </div>

            {/* Stats */}
            {subscription && subscription.total_reports_sent > 0 && (
              <div className="text-center text-gray-500 text-sm pt-2">
                {subscription.total_reports_sent} report{subscription.total_reports_sent !== 1 ? 's' : ''} sent
                {subscription.last_report_at && (
                  <> • Last sent: {new Date(subscription.last_report_at).toLocaleDateString()}</>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReportSubscriptionCard;
