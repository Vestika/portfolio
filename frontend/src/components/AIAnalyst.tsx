import React, { useState } from 'react';
import { Button } from './ui/button';
import { analyzePortfolio, AIAnalysisResponse } from '../utils/ai-api';

interface AIAnalystProps {
  portfolioId: string;
  portfolioName?: string;
}

const AIAnalyst: React.FC<AIAnalystProps> = ({ portfolioId, portfolioName = 'Portfolio' }) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await analyzePortfolio(portfolioId);
      setAnalysis(result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze portfolio';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Financial Analyst</h2>
          <p className="text-gray-600 mt-1">
            Get intelligent insights about your {portfolioName.toLowerCase()}
          </p>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium w-full sm:w-auto"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Analyzing...
            </div>
          ) : (
            'Analyze Portfolio'
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Portfolio Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Portfolio Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(analysis.portfolio_summary.total_value, analysis.portfolio_summary.base_currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Accounts</p>
                <p className="text-lg font-semibold text-gray-900">
                  {analysis.portfolio_summary.accounts_count}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Holdings</p>
                <p className="text-lg font-semibold text-gray-900">
                  {analysis.portfolio_summary.holdings_count}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Analysis Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(analysis.timestamp)}
                </p>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-blue-900">AI Analysis</h3>
                <p className="text-sm text-blue-700">Powered by {analysis.model_used}</p>
              </div>
            </div>
            
            <div className="prose prose-blue max-w-none">
              <div 
                className="text-gray-800 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: analysis.analysis.replace(/\n/g, '<br/>') 
                }}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important Disclaimer</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    This analysis is provided by an AI assistant for informational purposes only. 
                    It is NOT financial advice and should not be considered as such. Always consult 
                    with a qualified financial advisor before making investment decisions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!analysis && !isLoading && !error && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Analysis Yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Click "Analyze Portfolio" to get AI-powered insights about your portfolio.
          </p>
        </div>
      )}
    </div>
  );
};

export default AIAnalyst; 