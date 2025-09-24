import React from 'react';
import { X, Sparkles, TrendingUp, Shield, BarChart3, Bot, Calculator, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export const WelcomePopup: React.FC<WelcomePopupProps> = ({ isOpen, onClose, userName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 max-w-md w-full mx-4 transform transition-all">
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-pink-500/20 rounded-lg">
              <Sparkles size={20} className="text-pink-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">
                Welcome to Vestika
              </h1>
              <p className="text-gray-400 text-sm">
                Hi <span className="text-white font-medium">{userName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <p className="text-gray-300 mb-4 text-sm leading-relaxed">
            Your intelligent portfolio management platform is ready. Track investments, analyze performance, 
            and make informed decisions with AI-powered insights and advanced financial tools.
          </p>

          {/* Features */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 text-sm">
              <TrendingUp size={14} className="text-green-400 flex-shrink-0" />
              <span className="text-gray-300">Real-time Portfolio Analytics</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BarChart3 size={14} className="text-blue-400 flex-shrink-0" />
              <span className="text-gray-300">RSU & Options Vesting Management</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Bot size={14} className="text-purple-400 flex-shrink-0" />
              <span className="text-gray-300">AI Financial Analyst & Insights</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Calculator size={14} className="text-orange-400 flex-shrink-0" />
              <span className="text-gray-300">Advanced Financial Calculators</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Wrench size={14} className="text-cyan-400 flex-shrink-0" />
              <span className="text-gray-300">Investment Tools & Utilities</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield size={14} className="text-gray-400 flex-shrink-0" />
              <span className="text-gray-300">Secure & Private</span>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};
