/**
 * API utilities for Report Subscription endpoints
 */

import api from './api';

// Types
export interface ReportSections {
  portfolio_summary: boolean;
  asset_allocation: boolean;
  holdings_table: boolean;
  performance_chart: boolean;
  sector_breakdown: boolean;
  geographical_breakdown: boolean;
  concentration_analysis: boolean;
  options_vesting: boolean;
  ai_insights: boolean;
}

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'pdf' | 'html';

export interface ReportSubscription {
  id: string;
  email_address: string;
  email_verified: boolean;
  frequency: ReportFrequency;
  preferred_day: number;
  preferred_time_utc: string;
  timezone: string;
  portfolio_ids: string[];
  include_all_portfolios: boolean;
  sections: ReportSections;
  format: ReportFormat;
  include_inline_html: boolean;
  is_active: boolean;
  next_report_at: string | null;
  last_report_at: string | null;
  total_reports_sent: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionRequest {
  email_address: string;
  frequency: ReportFrequency;
  preferred_day: number;
  preferred_time_utc: string;
  timezone: string;
  portfolio_ids: string[];
  include_all_portfolios: boolean;
  sections: ReportSections;
  format: ReportFormat;
  include_inline_html: boolean;
}

export interface UpdateSubscriptionRequest {
  email_address?: string;
  frequency?: ReportFrequency;
  preferred_day?: number;
  preferred_time_utc?: string;
  timezone?: string;
  portfolio_ids?: string[];
  include_all_portfolios?: boolean;
  sections?: ReportSections;
  format?: ReportFormat;
  include_inline_html?: boolean;
}

export interface ReportHistoryItem {
  id: string;
  report_period_start: string;
  report_period_end: string;
  frequency: ReportFrequency;
  status: 'pending' | 'generating' | 'sent' | 'failed';
  email_address: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ReportSectionInfo {
  key: string;
  name: string;
  description: string;
  requires_data?: string;
}

// Default sections configuration
export const DEFAULT_SECTIONS: ReportSections = {
  portfolio_summary: true,
  asset_allocation: true,
  holdings_table: true,
  performance_chart: false,
  sector_breakdown: false,
  geographical_breakdown: false,
  concentration_analysis: false,
  options_vesting: false,
  ai_insights: false,
};

// API Functions

/**
 * Get user's report subscription
 */
export async function getSubscription(): Promise<ReportSubscription | null> {
  const response = await api.get('/reports/subscription');
  return response.data;
}

/**
 * Create a new report subscription
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<{ success: boolean; subscription_id: string; message: string }> {
  const response = await api.post('/reports/subscription', request);
  return response.data;
}

/**
 * Update subscription settings
 */
export async function updateSubscription(
  request: UpdateSubscriptionRequest
): Promise<{ success: boolean }> {
  const response = await api.put('/reports/subscription', request);
  return response.data;
}

/**
 * Delete subscription
 */
export async function deleteSubscription(): Promise<{ success: boolean }> {
  const response = await api.delete('/reports/subscription');
  return response.data;
}

/**
 * Pause subscription
 */
export async function pauseSubscription(): Promise<{ success: boolean }> {
  const response = await api.post('/reports/subscription/pause');
  return response.data;
}

/**
 * Resume subscription
 */
export async function resumeSubscription(): Promise<{ success: boolean }> {
  const response = await api.post('/reports/subscription/resume');
  return response.data;
}

/**
 * Request email verification
 */
export async function requestEmailVerification(
  email_address: string
): Promise<{ message: string }> {
  const response = await api.post('/reports/verify-email', { email_address });
  return response.data;
}

/**
 * Get report history
 */
export async function getReportHistory(
  limit: number = 20
): Promise<ReportHistoryItem[]> {
  const response = await api.get('/reports/history', { params: { limit } });
  return response.data;
}

/**
 * Get available report sections
 */
export async function getAvailableSections(): Promise<ReportSectionInfo[]> {
  const response = await api.get('/reports/available-sections');
  return response.data;
}

/**
 * Trigger manual report send
 */
export async function sendReportNow(): Promise<{ message: string; email: string }> {
  const response = await api.post('/reports/send-now');
  return response.data;
}

/**
 * Helper: Get frequency display label
 */
export function getFrequencyLabel(frequency: ReportFrequency): string {
  const labels: Record<ReportFrequency, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
  };
  return labels[frequency] || frequency;
}

/**
 * Helper: Get day label based on frequency
 */
export function getDayLabel(frequency: ReportFrequency, day: number): string {
  if (frequency === 'weekly') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day] || `Day ${day}`;
  }
  // Monthly/Quarterly
  const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

/**
 * Helper: Format next report date
 */
export function formatNextReportDate(dateString: string | null): string {
  if (!dateString) return 'Not scheduled';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
