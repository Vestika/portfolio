import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  ArrowRight, 
  CheckCircle, 
  TrendingUp, 
  Building2, 
  Target,
  Wallet,
  GraduationCap,
  ChevronRight,
  X,
  Info
} from 'lucide-react';
import api from '../utils/api';
import logo from '../assets/logo.png';
import { SymbolAutocomplete } from "@/components/ui/autocomplete";

interface OnboardingFlowProps {
  user: User;
  onPortfolioCreated: (portfolioId: string) => Promise<void>;
}

type OnboardingStep = 'welcome' | 'create-portfolio' | 'create-account' | 'success';

interface AccountType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  popular?: boolean;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ user, onPortfolioCreated }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isCreating, setIsCreating] = useState(false);
  const [createdPortfolioId, setCreatedPortfolioId] = useState<string>('');
  const [newPortfolio, setNewPortfolio] = useState({
    portfolio_name: '',
    base_currency: 'USD'
  });
  const [newAccount, setNewAccount] = useState({
    account_name: '',
    account_type: 'investment-account',
    owners: ['me'],
    holdings: [{ symbol: '', units: '' }]
  });
  
  // Holdings management state
  const [editingSymbolIndex, setEditingSymbolIndex] = useState<number | null>(null);
  const holdingRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  
  // IBKR integration state
  const [ibkrAccessToken, setIbkrAccessToken] = useState<string>('');
  const [ibkrQueryId, setIbkrQueryId] = useState<string>('');
  const [ibkrTesting, setIbkrTesting] = useState<boolean>(false);
  const [saveIbkrCredentials, setSaveIbkrCredentials] = useState<boolean>(false);
  const [showIbkrHelp, setShowIbkrHelp] = useState<boolean>(false);

  const accountTypes: AccountType[] = [
    {
      id: 'investment-account',
      name: 'Investment Account',
      description: 'Brokerage, trading, and investment accounts',
      icon: <TrendingUp className="w-5 h-5" />,
      popular: true
    },
    {
      id: 'bank-account',
      name: 'Bank Account',
      description: 'Savings, checking, and cash accounts',
      icon: <Wallet className="w-5 h-5" />
    },
    {
      id: 'retirement-account',
      name: 'Retirement Account',
      description: '401(k), IRA, and pension accounts',
      icon: <Target className="w-5 h-5" />
    },
    {
      id: 'education-fund',
      name: 'Education Fund',
      description: '529 plans and education savings',
      icon: <GraduationCap className="w-5 h-5" />
    }
  ];

  const steps = [
    { id: 'welcome', title: 'Welcome', number: 1 },
    { id: 'create-portfolio', title: 'Create Portfolio', number: 2 },
    { id: 'create-account', title: 'Add Account', number: 3 },
    { id: 'success', title: 'Complete', number: 4 }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  const handleCreatePortfolio = async () => {
    if (!newPortfolio.portfolio_name.trim()) return;
    
    setIsCreating(true);
    try {
      const response = await api.post('/portfolio', newPortfolio);
      const result = response.data;
      setCreatedPortfolioId(result.portfolio_id);
      setCurrentStep('create-account');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error creating portfolio: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccount.account_name.trim()) return;
    
    setIsCreating(true);
    try {
      // Filter out empty holdings and convert units to numbers
      const validHoldings = newAccount.holdings
        .filter(holding => holding.symbol.trim() && holding.units.trim())
        .map(holding => ({
          symbol: holding.symbol.trim(),
          units: parseFloat(holding.units)
        }));

      const accountData: any = {
        ...newAccount,
        holdings: validHoldings
      };

      // If user opted to save IBKR credentials, include them
      if (newAccount.account_type === 'investment-account' && saveIbkrCredentials && ibkrAccessToken && ibkrQueryId) {
        accountData.ibkr_flex = { access_token: ibkrAccessToken, query_id: ibkrQueryId };
      }
      
      await api.post(`/portfolio/${createdPortfolioId}/accounts`, accountData);
      setCurrentStep('success');
      
      // Wait a moment to show success, then proceed
      setTimeout(async () => {
        await onPortfolioCreated(createdPortfolioId);
      }, 2000);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error creating account: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  const getPortfolioNameSuggestion = () => {
    const name = user.displayName || user.email?.split('@')[0] || 'My';
    return `${name}'s Portfolio`;
  };

  const getAccountNameSuggestion = () => {
    const selectedType = accountTypes.find(type => type.id === newAccount.account_type);
    return selectedType ? `My ${selectedType.name}` : 'My Account';
  };

  // Holdings management functions
  const updateHolding = (index: number, field: 'symbol' | 'units', value: string) => {
    const normalizedValue = field === 'symbol' ? value.toUpperCase() : value;
    const updatedHoldings = newAccount.holdings.map((holding, i) => 
      i === index ? { ...holding, [field]: normalizedValue } : holding
    );
    
    // Auto-remove empty rows (except if it would leave us with no rows)
    const filteredHoldings = updatedHoldings.filter((holding) => {
      if (holding.symbol.trim() || holding.units.trim()) return true;
      const nonEmptyCount = updatedHoldings.filter(h => h.symbol.trim() || h.units.trim()).length;
      return nonEmptyCount === 0;
    });
    
    // Ensure we always have at least one row
    const finalHoldings = filteredHoldings.length > 0 ? filteredHoldings : [{ symbol: '', units: '' }];
    
    setNewAccount({ ...newAccount, holdings: finalHoldings });
  };

  const removeHolding = (index: number) => {
    if (newAccount.holdings.length > 1) {
      setNewAccount({
        ...newAccount,
        holdings: newAccount.holdings.filter((_, i) => i !== index)
      });
    }
  };

  const addNewRowIfNeeded = (holdings: any[], index: number) => {
    if (index === holdings.length - 1) {
      const newHoldings = [...holdings, { symbol: '', units: '' }];
      setNewAccount({ ...newAccount, holdings: newHoldings });
      setTimeout(() => setEditingSymbolIndex(newHoldings.length - 1), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'symbol' | 'units') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      if (index < newAccount.holdings.length - 1) {
        const nextKey = field === 'symbol' ? `${index + 1}-symbol` : `${index + 1}-units`;
        holdingRefs.current[nextKey]?.focus();
      } else {
        const nextKey = field === 'symbol' ? `${index}-units` : `${index + 1}-symbol`;
        holdingRefs.current[nextKey]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        const prevKey = `${index - 1}-${field}`;
        holdingRefs.current[prevKey]?.focus();
      }
    }
  };

  // Handle clicks outside to exit symbol edit mode
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.symbol-autocomplete-container')) {
        setEditingSymbolIndex(null);
      }
    };

    if (editingSymbolIndex !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingSymbolIndex]);

  // Modern Step Indicator Component
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
                ${index <= currentStepIndex 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25' 
                  : 'bg-white/10 text-gray-400 border border-white/20'
                }
              `}>
                {index < currentStepIndex ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  step.number
                )}
              </div>
              <span className={`
                ml-2 text-sm font-medium transition-colors duration-300
                ${index <= currentStepIndex ? 'text-white' : 'text-gray-400'}
              `}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`
                w-8 h-0.5 transition-colors duration-300
                ${index < currentStepIndex ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-white/20'}
              `} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="max-w-4xl w-full relative z-10">
          <StepIndicator />
          
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-sm rounded-2xl mb-8 shadow-2xl border border-white/20">
              <img src={logo} alt="Vestika Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Welcome to Vestika
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Your personal investment portfolio tracker. Let's set up your first portfolio and account in just a few simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-white/5 backdrop-blur-md border-white/10 text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-lg shadow-blue-500/20">
                  <TrendingUp className="w-7 h-7 text-blue-300" />
                </div>
                <CardTitle className="text-xl font-semibold">Track Investments</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300 leading-relaxed">
                  Monitor stocks, bonds, ETFs, and other securities across all your accounts with real-time data
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md border-white/10 text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/20">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                  <Building2 className="w-7 h-7 text-emerald-300" />
                </div>
                <CardTitle className="text-xl font-semibold">Multiple Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300 leading-relaxed">
                  Connect bank accounts, brokerages, retirement funds, and company stock plans seamlessly
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md border-white/10 text-white hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20">
              <CardHeader className="text-center">
                <div className="w-14 h-14 bg-gradient-to-r from-purple-500/30 to-violet-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 border border-purple-500/30 shadow-lg shadow-purple-500/20">
                  <Target className="w-7 h-7 text-purple-300" />
                </div>
                <CardTitle className="text-xl font-semibold">Smart Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300 leading-relaxed">
                  Get AI-powered insights, performance tracking, and portfolio optimization recommendations
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              onClick={() => setCurrentStep('create-portfolio')}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-4 text-lg font-semibold rounded-xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
            >
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 'create-portfolio') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="max-w-2xl w-full relative z-10">
          <StepIndicator />
          
          <Card className="bg-white/5 backdrop-blur-md border-white/10 shadow-2xl shadow-emerald-500/10">
            <CardHeader className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20">
                <img src={logo} alt="Vestika Logo" className="w-12 h-12 object-contain opacity-80" />
              </div>
              <CardTitle className="text-3xl text-white font-bold">Create Your Portfolio</CardTitle>
              <CardDescription className="text-gray-300 text-lg">
                Let's set up your portfolio to start tracking your investments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="portfolio-name" className="text-white font-semibold text-lg">
                  Portfolio Name
                </Label>
                <Input
                  id="portfolio-name"
                  value={newPortfolio.portfolio_name}
                  onChange={(e) => setNewPortfolio({ ...newPortfolio, portfolio_name: e.target.value })}
                  placeholder={getPortfolioNameSuggestion()}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 h-12 text-lg rounded-xl"
                />
                <p className="text-sm text-gray-400">
                  This will be the main name for your investment portfolio
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="base-currency" className="text-white font-semibold text-lg">
                  Base Currency
                </Label>
                <Select 
                  value={newPortfolio.base_currency} 
                  onValueChange={(value) => setNewPortfolio({ ...newPortfolio, base_currency: value })}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white h-12 text-lg rounded-xl focus:ring-2 focus:ring-blue-400/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 rounded-xl">
                    <SelectItem value="USD" className="text-white hover:bg-gray-700 rounded-lg">USD - US Dollar</SelectItem>
                    <SelectItem value="ILS" className="text-white hover:bg-gray-700 rounded-lg">ILS - Israeli Shekel</SelectItem>
                    <SelectItem value="EUR" className="text-white hover:bg-gray-700 rounded-lg">EUR - Euro</SelectItem>
                    <SelectItem value="GBP" className="text-white hover:bg-gray-700 rounded-lg">GBP - British Pound</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-400">
                  All values will be converted to this currency for reporting
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
                <h4 className="text-blue-300 font-semibold mb-3 flex items-center">
                  <ChevronRight className="w-4 h-4 mr-2" />
                  What's Next?
                </h4>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-center"><span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>Add your first account</li>
                  <li className="flex items-center"><span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>Import holdings from Interactive Brokers (optional)</li>
                  <li className="flex items-center"><span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>Track stocks, bonds, ETFs, and more</li>
                  <li className="flex items-center"><span className="w-2 h-2 bg-blue-400 rounded-full mr-3"></span>Get AI-powered portfolio insights</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('welcome')}
                  className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10 h-12 rounded-xl font-semibold"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleCreatePortfolio}
                  disabled={!newPortfolio.portfolio_name.trim() || isCreating}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white h-12 rounded-xl font-semibold shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300"
                >
                  {isCreating ? 'Creating...' : 'Create Portfolio'}
                  {!isCreating && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === 'create-account') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="max-w-3xl w-full relative z-10">
          <StepIndicator />
          
          <Card className="bg-white/5 backdrop-blur-md border-white/10 shadow-2xl shadow-emerald-500/10">
            <CardHeader className="text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20">
                <img src={logo} alt="Vestika Logo" className="w-12 h-12 object-contain opacity-80" />
              </div>
              <CardTitle className="text-3xl text-white font-bold">Add Your First Account</CardTitle>
              <CardDescription className="text-gray-300 text-lg">
                Choose the type of account you'd like to add to your portfolio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-white font-semibold text-lg">Account Type</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accountTypes.map((type) => (
                    <div
                      key={type.id}
                      onClick={() => setNewAccount({ ...newAccount, account_type: type.id })}
                      className={`
                        p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105
                        ${newAccount.account_type === type.id
                          ? 'border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/25'
                          : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`
                          w-12 h-12 rounded-lg flex items-center justify-center
                          ${newAccount.account_type === type.id
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'bg-white/10 text-gray-400'
                          }
                        `}>
                          {type.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-white font-semibold">{type.name}</h3>
                            {type.popular && (
                              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="account-name" className="text-white font-semibold text-lg">
                  Account Name
                </Label>
                <Input
                  id="account-name"
                  value={newAccount.account_name}
                  onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                  placeholder={getAccountNameSuggestion()}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 h-12 text-lg rounded-xl"
                />
                <p className="text-sm text-gray-400">
                  Give your account a descriptive name
                </p>
              </div>

              {/* IBKR Integration for Investment Accounts */}
              {newAccount.account_type === 'investment-account' && (
                <div className="space-y-4 border border-white/20 rounded-xl p-4 bg-white/5">
                  <div className="flex items-center justify-between">
                    <Label className="text-white font-semibold">Link IBKR (Optional)</Label>
                    <div className="flex items-center text-xs text-gray-400">
                      <span>Import holdings automatically</span>
                      <div
                        className="relative group inline-block ml-2"
                      >
                        <button
                          type="button"
                          className="p-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                          onClick={() => setShowIbkrHelp(!showIbkrHelp)}
                        >
                          <Info className="h-4 w-4" />
                        </button>
                        {showIbkrHelp && (
                          <div className="absolute right-0 mt-2 z-50 w-80 max-w-[80vw] bg-gray-800 border border-gray-700 rounded-lg p-4 shadow-lg">
                            <div className="flex items-start justify-between mb-2">
                              <p className="text-sm font-semibold text-white">IBKR Flex Setup</p>
                              <button
                                type="button"
                                className="text-gray-400 hover:text-white"
                                onClick={() => setShowIbkrHelp(false)}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-200">
                              <li>Go to IBKR Client Portal → Reports → Flex Queries</li>
                              <li>Create Activity Statement query with "Open Positions"</li>
                              <li>Copy Query ID and generate Access Token</li>
                              <li>Paste both here to import holdings</li>
                            </ol>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ibkr-token" className="text-sm text-gray-300">Access Token</Label>
                      <Input
                        id="ibkr-token"
                        value={ibkrAccessToken}
                        onChange={(e) => setIbkrAccessToken(e.target.value)}
                        placeholder="Paste IBKR Access Token"
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 h-10 text-sm rounded-lg"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ibkr-query" className="text-sm text-gray-300">Query ID</Label>
                      <Input
                        id="ibkr-query"
                        value={ibkrQueryId}
                        onChange={(e) => setIbkrQueryId(e.target.value)}
                        placeholder="Enter Flex Query ID"
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 h-10 text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!ibkrAccessToken || !ibkrQueryId || ibkrTesting}
                      onClick={async () => {
                        try {
                          setIbkrTesting(true);
                          const res = await api.post(`/ibkr/flex/preview`, {
                            access_token: ibkrAccessToken,
                            query_id: ibkrQueryId,
                          });
                          const holdings = res.data?.holdings ?? [];
                          setNewAccount({
                            ...newAccount,
                            holdings: [...holdings.map((h: {symbol: string; units: number}) => ({ symbol: h.symbol, units: String(h.units) })), { symbol: '', units: '' }]
                          });
                        } catch {
                          alert('IBKR import failed. Please verify your credentials.');
                        } finally {
                          setIbkrTesting(false);
                        }
                      }}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      {ibkrTesting ? 'Importing...' : 'Import from IBKR'}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <input
                        id="save-ibkr"
                        type="checkbox"
                        className="rounded border-white/20 bg-white/10"
                        checked={saveIbkrCredentials}
                        onChange={(e) => setSaveIbkrCredentials(e.target.checked)}
                      />
                      <Label htmlFor="save-ibkr" className="text-xs text-gray-300">
                        Save for auto-sync
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Holdings Table */}
              <div className="space-y-3">
                <Label className="text-white font-semibold text-lg">Holdings</Label>
                <div className="rounded-lg border border-white/20 bg-white/5 overflow-hidden">
                  {/* Table Header */}
                  <div className="flex items-center border-b border-white/20 bg-white/10 px-0">
                    <div className="flex-1 px-3 py-3 text-sm font-medium text-white">Symbol</div>
                    <div className="w-28 px-3 py-3 text-sm font-medium text-white">Units</div>
                    <div className="w-12 px-3 py-3"></div>
                  </div>

                  {/* Table Body */}
                  <div className="max-h-48 overflow-y-auto">
                    {newAccount.holdings.map((holding, index) => (
                      <div key={index} className="flex items-center border-b border-white/10 last:border-b-0 hover:bg-white/5">
                        <div className="flex-1 p-0">
                          {editingSymbolIndex === index ? (
                            <div className="symbol-autocomplete-container">
                              <SymbolAutocomplete
                                placeholder="e.g., AAPL"
                                value={holding.symbol}
                                onChange={(value) => updateHolding(index, 'symbol', value)}
                                onSelection={(value) => {
                                  updateHolding(index, 'symbol', value);
                                  if (index === newAccount.holdings.length - 1) {
                                    setTimeout(() => addNewRowIfNeeded(newAccount.holdings, index), 10);
                                  }
                                  setEditingSymbolIndex(null);
                                }}
                                className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto"
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingSymbolIndex(null);
                                  } else if (e.key === 'Tab' || e.key === 'Enter') {
                                    if (holding.symbol.trim() && index === newAccount.holdings.length - 1) {
                                      setTimeout(() => addNewRowIfNeeded(newAccount.holdings, index), 10);
                                    }
                                    setEditingSymbolIndex(null);
                                    handleKeyDown(e, index, 'symbol');
                                  } else {
                                    handleKeyDown(e, index, 'symbol');
                                  }
                                }}
                                onBlur={(e) => {
                                  const value = e.target.value.trim();
                                  if (value && index === newAccount.holdings.length - 1) {
                                    setTimeout(() => addNewRowIfNeeded(newAccount.holdings, index), 10);
                                  }
                                  setEditingSymbolIndex(null);
                                }}
                                ref={(el) => {
                                  holdingRefs.current[`${index}-symbol`] = el;
                                  if (el) setTimeout(() => el.focus(), 10);
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-white/10 px-3 py-3 min-h-[48px] flex items-center"
                              onClick={() => {
                                setEditingSymbolIndex(index);
                                if (!holding.symbol.trim()) {
                                  setTimeout(() => {
                                    const input = holdingRefs.current[`${index}-symbol`];
                                    if (input) input.focus();
                                  }, 50);
                                }
                              }}
                            >
                              {holding.symbol ? (
                                <span className="text-white font-medium">{holding.symbol}</span>
                              ) : (
                                <span className="text-gray-400 text-sm">Click to add symbol...</span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-28 p-0">
                          <Input
                            placeholder="0"
                            type="number"
                            step="1"
                            value={holding.units}
                            onChange={(e) => updateHolding(index, 'units', e.target.value)}
                            className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto text-white placeholder:text-gray-400"
                            onKeyDown={(e) => handleKeyDown(e, index, 'units')}
                            ref={(el) => holdingRefs.current[`${index}-units`] = el}
                          />
                        </div>
                        <div className="w-12 flex justify-center py-2">
                          {newAccount.holdings.length > 1 && (holding.symbol || holding.units) && (
                            <Button
                              type="button"
                              onClick={() => removeHolding(index)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  💡 Rows are added automatically when typing and removed when cleared
                </p>
              </div>

              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl p-6">
                <h4 className="text-violet-300 font-semibold mb-3 flex items-center">
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Almost Done!
                </h4>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-center"><span className="w-2 h-2 bg-violet-400 rounded-full mr-3"></span>Add your holdings and investments</li>
                  <li className="flex items-center"><span className="w-2 h-2 bg-violet-400 rounded-full mr-3"></span>Connect to Interactive Brokers (optional)</li>
                  <li className="flex items-center"><span className="w-2 h-2 bg-violet-400 rounded-full mr-3"></span>Start tracking your portfolio performance</li>
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('create-portfolio')}
                  className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10 h-12 rounded-xl font-semibold"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleCreateAccount}
                  disabled={!newAccount.account_name.trim() || isCreating}
                  className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white h-12 rounded-xl font-semibold shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300"
                >
                  {isCreating ? 'Creating...' : 'Create Account'}
                  {!isCreating && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (currentStep === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="max-w-2xl w-full text-center relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6 shadow-xl border border-white/20">
            <img src={logo} alt="Vestika Logo" className="w-12 h-12 object-contain opacity-80" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Portfolio Created Successfully! 🎉
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Your portfolio "{newPortfolio.portfolio_name}" is ready. 
            Now let's add your first account to start tracking your investments.
          </p>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-300 mt-4">Setting up your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OnboardingFlow;
