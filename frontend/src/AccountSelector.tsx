import React, { useState, useRef, useEffect } from 'react';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo,
  RSUPlan,
  ESPPPlan,
  OptionsPlan
} from './types';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  X,
  Edit,
  User,
  
  Settings,
  LogOut,
  Info
} from 'lucide-react';
import PortfolioSelector from "./PortfolioSelector.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SymbolAutocomplete } from "@/components/ui/autocomplete";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import HamburgerMenu from "@/components/ui/HamburgerMenu";


import RSUPlanConfig from './components/RSUPlanConfig';
import ESPPPlanConfig from './components/ESPPPlanConfig';
import OptionsPlanConfig from './components/OptionsPlanConfig';
import api from './utils/api';

interface AccountSelectorProps {
  portfolioMetadata: PortfolioMetadata;
  onAccountsChange: (accountNames: string[]) => void;
  onToggleVisibility: () => void;
  availableFiles: PortfolioFile[];
  selectedFile: string;
  onPortfolioChange: (portfolio_id: string) => void;
  onPortfolioCreated: (newPortfolioId: string) => Promise<void>;
  onAccountAdded: () => Promise<void>;
  onPortfolioDeleted: (deletedPortfolioId: string) => Promise<void>;
  onAccountDeleted: () => Promise<void>;
  onDefaultPortfolioSet?: (portfolioId: string) => void;
  anchorEl: null | HTMLElement;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onSignOutClick: () => Promise<void>;
  globalPrices: Record<string, any>;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  portfolioMetadata,
  onAccountsChange,
  onToggleVisibility,
  availableFiles = [], // Provide default empty array
  selectedFile,
  onPortfolioChange,
  onPortfolioCreated,
  onAccountAdded,
  onPortfolioDeleted,
  onAccountDeleted,
  onDefaultPortfolioSet,
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onProfileClick,
  onSettingsClick,
  onSignOutClick,
  globalPrices
}) => {
  const [accounts, setAccounts] = useState<AccountInfo[]>(
    portfolioMetadata.accounts.map(account => ({
      ...account,
      isSelected: true
    }))
  );
  const [isValueVisible, setIsValueVisible] = useState(true);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string>('');
  const [accountToEdit, setAccountToEdit] = useState<string>('');
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<{
    account_name: string;
    account_type: string;
    owners: string[];
    holdings: { symbol: string; units: string }[];
    rsu_plans: RSUPlan[];
    espp_plans: ESPPPlan[];
    options_plans: OptionsPlan[];
  }>({
    account_name: '',
    account_type: 'bank-account',
    owners: ['me'],
    holdings: [{ symbol: '', units: '' }],
    rsu_plans: [],
    espp_plans: [],
    options_plans: []
  });
  const [editAccount, setEditAccount] = useState<{
    account_name: string;
    account_type: string;
    owners: string[];
    holdings: { symbol: string; units: string }[];
    rsu_plans: RSUPlan[];
    espp_plans: ESPPPlan[];
    options_plans: OptionsPlan[];
  }>({
    account_name: '',
    account_type: 'bank-account',
    owners: ['me'],
    holdings: [{ symbol: '', units: '' }],
    rsu_plans: [],
    espp_plans: [],
    options_plans: []
  });
  const [collapsedRSUPlans, setCollapsedRSUPlans] = useState<Set<string>>(new Set());
  const [collapsedESPPPlans, setCollapsedESPPPlans] = useState<Set<string>>(new Set());
  const [collapsedOptionsPlans, setCollapsedOptionsPlans] = useState<Set<string>>(new Set());
  const [editCollapsedRSUPlans, setEditCollapsedRSUPlans] = useState<Set<string>>(new Set());
  const [editCollapsedESPPPlans, setEditCollapsedESPPPlans] = useState<Set<string>>(new Set());
  const holdingRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const editHoldingRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // IBKR Flex (Add modal)
  const [ibkrAccessToken, setIbkrAccessToken] = useState<string>('');
  const [ibkrQueryId, setIbkrQueryId] = useState<string>('');
  const [ibkrTesting, setIbkrTesting] = useState<boolean>(false);

  // IBKR Flex (Edit modal)
  const [editIbkrAccessToken, setEditIbkrAccessToken] = useState<string>('');
  const [editIbkrQueryId, setEditIbkrQueryId] = useState<string>('');
  const [editIbkrTesting, setEditIbkrTesting] = useState<boolean>(false);
  const [saveIbkrCredentials, setSaveIbkrCredentials] = useState<boolean>(false);
  const [editSaveIbkrCredentials, setEditSaveIbkrCredentials] = useState<boolean>(false);
  const [showIbkrHelp, setShowIbkrHelp] = useState<boolean>(false);
  const [showEditIbkrHelp, setShowEditIbkrHelp] = useState<boolean>(false);
  const [suppressIbkrHover, setSuppressIbkrHover] = useState<boolean>(false);
  const [suppressEditIbkrHover, setSuppressEditIbkrHover] = useState<boolean>(false);

  useEffect(() => {
    console.log('🔄 [ACCOUNT SELECTOR] Syncing accounts with portfolio metadata:', portfolioMetadata.accounts.map(a => ({ name: a.account_name, isSelected: a.isSelected })));
    setAccounts(
      portfolioMetadata.accounts.map(account => ({
        ...account,
        // Use the isSelected value from the parent (derived from context)
        isSelected: account.isSelected ?? true
      }))
    );
  }, [portfolioMetadata.accounts]);

  const toggleAccountSelection = (accountName: string) => {
    console.log('🎯 [ACCOUNT SELECTOR] Account clicked:', accountName);
    
    const updatedAccounts = accounts.map(account =>
      account.account_name === accountName
        ? { ...account, isSelected: !account.isSelected }
        : account
    );

    // Count selected accounts after potential deselection
    const selectedAccounts = updatedAccounts.filter(account => account.isSelected);

    console.log('🔍 [ACCOUNT SELECTOR] After toggle:', {
      clicked: accountName,
      selectedCount: selectedAccounts.length,
      selectedNames: selectedAccounts.map(a => a.account_name)
    });

    // If attempting to deselect the last selected account, prevent deselection
    if (selectedAccounts.length === 0) {
      console.log('⚠️ [ACCOUNT SELECTOR] Preventing deselection of last account');
      return; // Do nothing if trying to deselect the last account
    }

    setAccounts(updatedAccounts);

    // Get selected account names
    const selectedAccountNames = updatedAccounts
      .filter(account => account.isSelected)
      .map(account => account.account_name);

    console.log('📤 [ACCOUNT SELECTOR] Calling onAccountsChange with:', selectedAccountNames);
    onAccountsChange(selectedAccountNames);
  };

  const toggleValueVisibility = () => {
    setIsValueVisible(!isValueVisible);
    onToggleVisibility();
  };

  const removeHolding = (index: number) => {
    if (newAccount.holdings.length > 1) {
      setNewAccount({
        ...newAccount,
        holdings: newAccount.holdings.filter((_, i) => i !== index)
      });
    }
  };

  const updateHolding = (index: number, field: 'symbol' | 'units', value: string) => {
    // Normalize symbol to uppercase for consistency
    const normalizedValue = field === 'symbol' ? value.toUpperCase() : value;
    const updatedHoldings = newAccount.holdings.map((holding, i) => 
      i === index ? { ...holding, [field]: normalizedValue } : holding
    );
    
    // Auto-add new row if this is the last row and either field has content
    if (index === updatedHoldings.length - 1 && value.trim()) {
      updatedHoldings.push({ symbol: '', units: '' });
    }
    
    // Auto-remove empty rows (except if it would leave us with no rows)
    const filteredHoldings = updatedHoldings.filter((holding, i) => {
      // Keep the row if it has content in either field
      if (holding.symbol.trim() || holding.units.trim()) return true;
      // Keep at least one empty row
      const nonEmptyCount = updatedHoldings.filter(h => h.symbol.trim() || h.units.trim()).length;
      return nonEmptyCount === 0 || i === updatedHoldings.length - 1;
    });
    
    // Ensure we always have at least one row
    const finalHoldings = filteredHoldings.length > 0 ? filteredHoldings : [{ symbol: '', units: '' }];
    
    setNewAccount({
      ...newAccount,
      holdings: finalHoldings
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'symbol' | 'units') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      if (index < newAccount.holdings.length - 1) {
        // Navigate to next row
        const nextKey = field === 'symbol' ? `${index + 1}-symbol` : `${index + 1}-units`;
        holdingRefs.current[nextKey]?.focus();
      } else {
        // Navigate to next field in same row
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

  const handleAddAccount = async () => {
    try {
      let validHoldings;
      // If company-custodian-account, generate holdings from plan symbols
      if (newAccount.account_type === 'company-custodian-account') {
        // Collect all unique symbols from RSU, ESPP, and Options plans
        const planSymbols = [
          ...newAccount.rsu_plans.map(plan => plan.symbol.trim()),
          ...newAccount.espp_plans.map(plan => plan.symbol.trim()),
          ...newAccount.options_plans.map(plan => plan.symbol.trim())
        ].filter(s => s);
        const uniqueSymbols = Array.from(new Set(planSymbols));
        validHoldings = uniqueSymbols.map(symbol => ({ symbol, units: 0 }));
      } else {
        // Filter out empty holdings and convert units to numbers
        validHoldings = newAccount.holdings
          .filter(holding => holding.symbol.trim() && holding.units.trim())
          .map(holding => ({
            symbol: holding.symbol.trim(),
            units: parseFloat(holding.units)
          }));
      }

      // Filter out empty RSU, ESPP, and Options plans
      const validRSUPlans = newAccount.rsu_plans
        .filter(plan => plan.symbol.trim() && plan.units > 0);

      const validESPPPlans = newAccount.espp_plans
        .filter(plan => plan.symbol.trim() && plan.units > 0);

      const validOptionsPlans = newAccount.options_plans
        .filter(plan => plan.symbol.trim() && plan.units > 0);

      const accountData = {
        ...newAccount,
        holdings: validHoldings,
        rsu_plans: validRSUPlans,
        espp_plans: validESPPPlans,
        options_plans: validOptionsPlans
      };

      await api.post(`/portfolio/${selectedFile}/accounts`, accountData);

      setShowAddAccountModal(false);
      setNewAccount({ account_name: '', account_type: 'bank-account', owners: ['me'], holdings: [{ symbol: '', units: '' }], rsu_plans: [], espp_plans: [], options_plans: [] } );
      holdingRefs.current = {}; // Clear refs
      
      // Trigger refresh to reload the portfolio with new account
      await onAccountAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error adding account';
      alert(`Error adding account: ${errorMessage}`);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete(`/portfolio/${selectedFile}/accounts/${encodeURIComponent(accountToDelete)}`);

      setShowDeleteAccountModal(false);
      setAccountToDelete('');
      
      // Trigger refresh to reload the portfolio without the deleted account
      await onAccountDeleted();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error deleting account';
      alert(`Error deleting account: ${errorMessage}`);
    }
  };

  const confirmDeleteAccount = (accountName: string) => {
    setAccountToDelete(accountName);
    setShowDeleteAccountModal(true);
    setHoveredAccount(null);
  };

  const confirmEditAccount = (accountName: string) => {
    const account = portfolioMetadata.accounts.find(acc => acc.account_name === accountName);
    
    if (account) {
      setAccountToEdit(accountName);
      
      // Handle different possible holdings structures
      let mappedHoldings = [{ symbol: '', units: '' }]; // Default empty holding
      
      if (account.holdings && Array.isArray(account.holdings) && account.holdings.length > 0) {
        mappedHoldings = account.holdings.map(h => ({
          symbol: h.symbol || '',
          units: (h.units || 0).toString()
        }));
      }
      
      // Ensure there's always at least one empty row available for typing
      const hasEmptyRow = mappedHoldings.some(h => !h.symbol.trim() && !h.units.trim());
      if (!hasEmptyRow) {
        mappedHoldings.push({ symbol: '', units: '' });
      }
      
      setEditAccount({
        account_name: account.account_name,
        account_type: account.account_type || 'bank-account',
        owners: account.owners || ['me'],
        holdings: mappedHoldings,
        rsu_plans: account.rsu_plans || [],
        espp_plans: account.espp_plans || [],
        options_plans: account.options_plans || []
      });
      
      // Collapse all loaded plans by default
      setEditCollapsedRSUPlans(new Set((account.rsu_plans || []).map(plan => plan.id)));
      setEditCollapsedESPPPlans(new Set((account.espp_plans || []).map(plan => plan.id)));
      
      setShowEditAccountModal(true);
      setHoveredAccount(null);
    }
  };

  const removeEditHolding = (index: number) => {
    if (editAccount.holdings.length > 1) {
      setEditAccount({
        ...editAccount,
        holdings: editAccount.holdings.filter((_, i) => i !== index)
      });
    }
  };

  const updateEditHolding = (index: number, field: 'symbol' | 'units', value: string) => {
    // Normalize symbol to uppercase for consistency
    const normalizedValue = field === 'symbol' ? value.toUpperCase() : value;
    const updatedHoldings = editAccount.holdings.map((holding, i) => 
      i === index ? { ...holding, [field]: normalizedValue } : holding
    );
    
    // Auto-add new row if this is the last row and either field has content
    if (index === updatedHoldings.length - 1 && value.trim()) {
      updatedHoldings.push({ symbol: '', units: '' });
    }
    
    // Auto-remove empty rows (except if it would leave us with no rows)
    const filteredHoldings = updatedHoldings.filter((holding, i) => {
      // Keep the row if it has content in either field
      if (holding.symbol.trim() || holding.units.trim()) return true;
      // Keep at least one empty row
      const nonEmptyCount = updatedHoldings.filter(h => h.symbol.trim() || h.units.trim()).length;
      return nonEmptyCount === 0 || i === updatedHoldings.length - 1;
    });
    
    // Ensure we always have at least one row
    const finalHoldings = filteredHoldings.length > 0 ? filteredHoldings : [{ symbol: '', units: '' }];
    
    setEditAccount({
      ...editAccount,
      holdings: finalHoldings
    });
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, field: 'symbol' | 'units') => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      if (index < editAccount.holdings.length - 1) {
        // Navigate to next row
        const nextKey = field === 'symbol' ? `edit-${index + 1}-symbol` : `edit-${index + 1}-units`;
        editHoldingRefs.current[nextKey]?.focus();
      } else {
        // Navigate to next field in same row
        const nextKey = field === 'symbol' ? `edit-${index}-units` : `edit-${index + 1}-symbol`;
        editHoldingRefs.current[nextKey]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        const prevKey = `edit-${index - 1}-${field}`;
        editHoldingRefs.current[prevKey]?.focus();
      }
    }
  };

  const handleEditAccount = async () => {
    try {
      let validHoldings;
      // If company-custodian-account, generate holdings from plan symbols
      if (editAccount.account_type === 'company-custodian-account') {
        // Collect all unique symbols from RSU, ESPP, and Options plans
        const planSymbols = [
          ...editAccount.rsu_plans.map(plan => plan.symbol.trim()),
          ...editAccount.espp_plans.map(plan => plan.stock_symbol.trim()),
          ...editAccount.options_plans.map(plan => plan.symbol.trim())
        ].filter(s => s);
        const uniqueSymbols = Array.from(new Set(planSymbols));
        validHoldings = uniqueSymbols.map(symbol => ({ symbol, units: 0 }));
      } else {
        // Filter out empty holdings and convert units to numbers
        validHoldings = editAccount.holdings
          .filter(holding => holding.symbol.trim() && holding.units.trim())
          .map(holding => ({
            symbol: holding.symbol.trim(),
            units: parseFloat(holding.units)
          }));
      }

      // Filter out empty RSU, ESPP, and Options plans
      const validRSUPlans = editAccount.rsu_plans
        .filter(plan => plan.symbol.trim() && plan.units > 0);

      const validESPPPlans = editAccount.espp_plans
        .filter(plan => plan.stock_symbol.trim() && plan.units > 0);

      const validOptionsPlans = editAccount.options_plans
        .filter(plan => plan.symbol.trim() && plan.units > 0);

      const accountData = {
        ...editAccount,
        holdings: validHoldings,
        rsu_plans: validRSUPlans,
        espp_plans: validESPPPlans,
        options_plans: validOptionsPlans
      };

      await api.put(`/portfolio/${selectedFile}/accounts/${encodeURIComponent(accountToEdit)}`, accountData);

      setShowEditAccountModal(false);
      setAccountToEdit('');
      setEditAccount({ account_name: '', account_type: 'bank-account', owners: ['me'], holdings: [{ symbol: '', units: '' }], rsu_plans: [], espp_plans: [], options_plans: [] });
      editHoldingRefs.current = {}; // Clear refs
      
      // Trigger refresh to reload the portfolio with updated account
      await onAccountAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error updating account';
      alert(`Error updating account: ${errorMessage}`);
    }
  };

  const toggleRSUPlanCollapse = (planId: string) => {
    setCollapsedRSUPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const toggleESPPPlanCollapse = (planId: string) => {
    setCollapsedESPPPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const toggleEditRSUPlanCollapse = (planId: string) => {
    setEditCollapsedRSUPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const toggleEditESPPPlanCollapse = (planId: string) => {
    setEditCollapsedESPPPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const toggleOptionsPlanCollapse = (planId: string) => {
    setCollapsedOptionsPlans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  // Helper function to calculate account total dynamically
  const calculateAccountTotal = (account: AccountInfo): number => {
    return (account.holdings || []).reduce((sum, holding) => {
      const priceData = globalPrices[holding.symbol];
      if (!priceData) return sum;
      return sum + (holding.units * priceData.price);
    }, 0);
  };

  const selectedAccountsCount = accounts.filter(account => account.isSelected).length;

  return (
    <div className="sticky top-0 z-20 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700">
      <div className="container mx-auto flex justify-between items-start">
        <div className="flex-1">
          <PortfolioSelector
            portfolios={availableFiles}
            selectedPortfolioId={selectedFile}
            onPortfolioChange={onPortfolioChange}
            userName={portfolioMetadata.user_name}
            onPortfolioCreated={onPortfolioCreated}
            onPortfolioDeleted={onPortfolioDeleted}
            onDefaultPortfolioSet={onDefaultPortfolioSet}
          />
          <p className="text-sm text-gray-400 mt-0">
            Showing {selectedAccountsCount} of {accounts.length} accounts
          </p>
        </div>

        {/* Hamburger Menu for Mobile */}
        <div className="md:hidden">
          <HamburgerMenu
            accounts={accounts}
            toggleAccountSelection={toggleAccountSelection}
            isValueVisible={isValueVisible}
            toggleValueVisibility={toggleValueVisibility}
            setShowAddAccountModal={setShowAddAccountModal}
            onMenuOpen={onMenuOpen}
            onProfileClick={onProfileClick}
            onSettingsClick={onSettingsClick}
            onSignOutClick={onSignOutClick}
            anchorEl={anchorEl}
            onMenuClose={onMenuClose}
          />
        </div>

        {/* Full Header for Desktop */}
        <div className="hidden md:flex items-center space-x-4">
          <div className="flex space-x-2">
            {accounts.map(account => (
                <div
                    key={account.account_name}
                    className="relative"
                    onMouseEnter={() => setHoveredAccount(account.account_name)}
                    onMouseLeave={() => setHoveredAccount(null)}
                >
                  {/* Account Card */}
                  <div
                    className={`
                  group cursor-pointer flex items-center space-x-2 
                  pl-3 pr-4 py-2 rounded-md transition-all duration-300 transform hover:scale-105
                  ${account.isSelected
                        ? 'bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 shadow-blue-500/10'
                        : 'bg-gray-500/10 backdrop-blur-sm border border-gray-400/20 shadow-gray-500/5 hover:bg-gray-400/15 hover:border-gray-300/30'}
                `}
                    onClick={() => toggleAccountSelection(account.account_name)}
                  >
                    {account.isSelected ? (
                        <CheckCircle2 size={16}/>
                    ) : (
                        <Circle size={16}/>
                    )}
                    <div>
                      <p className="text-xs font-medium">{account.account_name}</p>
                      {isValueVisible ? (
                          <p className="text-xs text-gray-300">
                            {new Intl.NumberFormat('en-US', {
                              maximumFractionDigits: 0
                            }).format(calculateAccountTotal(account))} {' '}
                            {portfolioMetadata.base_currency}
                          </p>
                      ) : (
                          <p className="text-xs text-gray-300 flex items-center">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1"></span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1"></span>
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1"></span>
                            {portfolioMetadata.base_currency}
                          </p>
                      )}
                    </div>
                  </div>

                  {/* Action Icons - appear below on hover */}
                  {hoveredAccount === account.account_name && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 pt-1 z-10">
                      <div className="flex space-x-1">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmEditAccount(account.account_name);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 border border-transparent bg-blue-500/20 backdrop-blur-sm text-blue-200 hover:text-blue-100 hover:bg-blue-500/30 hover:border-blue-400/20 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors rounded-md"
                          title="Edit account"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDeleteAccount(account.account_name);
                          }}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 border border-transparent bg-red-500/20 backdrop-blur-sm text-red-200 hover:text-red-100 hover:bg-red-500/30 hover:border-red-400/20 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors rounded-md"
                          title="Delete account"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
            ))}
            
            {/* Add New Account Button */}
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="flex items-center space-x-2 pl-3 pr-4 py-2 rounded-md bg-emerald-500/20 backdrop-blur-sm text-white hover:bg-emerald-500/30 transition-all duration-300 transform hover:scale-105 shadow-emerald-500/10 hover:shadow-emerald-500/20 border border-emerald-400/30 hover:border-emerald-300/40 group"
            >
              <Plus size={16} className="text-emerald-200 group-hover:text-emerald-100" />
              <span className="text-xs font-medium text-emerald-100">Add Account</span>
            </button>
          </div>

          {/* Visibility Toggle */}
          <button
              onClick={toggleValueVisibility}
              className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors"
          >
            {isValueVisible ? <EyeOff size={20}/> : <Eye size={20}/>}
          </button>

          

          {/* Person Icon Dropdown */}
          <div className="relative">
            <button
              onClick={onMenuOpen}
              className="p-2 rounded-full bg-gray-600/80 backdrop-blur-md text-white hover:bg-gray-600 transition-colors"
            >
              <User size={20} />
            </button>

            {Boolean(anchorEl) && (
              <div
                className="absolute right-0 top-full mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-50"
                onMouseLeave={onMenuClose}
              >
                <div className="py-1">
                  <button
                    onClick={onProfileClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
                  >
                    <User size={16} className="mr-3" />
                    Profile
                  </button>
                  <button
                    onClick={onSettingsClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
                  >
                    <Settings size={16} className="mr-3" />
                    Settings
                  </button>
                  <button
                    onClick={onSignOutClick}
                    className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-gray-600 transition-colors"
                  >
                    <LogOut size={16} className="mr-3" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Add Account Modal */}
      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5 text-green-500" />
              Add New Account
            </DialogTitle>
            <DialogDescription>
              Create a new account to manage your investments and assets.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="flex gap-6 py-4 min-h-[400px]">
              {/* Left Column - Form Fields */}
              <div className="flex-1 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="account-name">Account Name</Label>
                  <Input
                    id="account-name"
                    value={newAccount.account_name}
                    onChange={(e) => setNewAccount({ ...newAccount, account_name: e.target.value })}
                    placeholder="Enter account name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="account-type">Account Type</Label>
                  <Select value={newAccount.account_type} onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank-account">Bank Account</SelectItem>
                      <SelectItem value="investment-account">Investment Account</SelectItem>
                      <SelectItem value="education-fund">Education Fund</SelectItem>
                      <SelectItem value="retirement-account">Retirement Account</SelectItem>
                      <SelectItem value="company-custodian-account">Company Custodian Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newAccount.account_type === 'investment-account' && (
                  <div className="grid gap-3 border rounded-md p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Link IBKR (Flex Web Service)</Label>
                      <div className="flex items-center text-xs text-gray-400">
                        <span>Optional</span>
                        <div
                          className="relative group inline-block ml-2"
                          onMouseLeave={() => {
                            setSuppressIbkrHover(false);
                          }}
                        >
                          <button
                            type="button"
                            aria-label="How to get IBKR Flex Query ID and Access Token"
                            className="p-1 rounded-full hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                            onClick={() => setShowIbkrHelp((v) => !v)}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                          <div
                            className={`absolute right-0 mt-2 z-50 w-[360px] max-w-[80vw] ${showIbkrHelp ? 'block' : 'hidden'} ${!suppressIbkrHover ? 'group-hover:block' : ''}`}
                          >
                            <div className="rounded-md border border-gray-700 bg-gray-800 text-white shadow-lg p-4 max-h-[70vh] overflow-y-auto">
                              <div className="flex items-start justify-between mb-1">
                                <p className="text-sm font-semibold">IBKR Flex setup guide</p>
                                <button
                                  type="button"
                                  className="text-gray-400 hover:text-white"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowIbkrHelp(false);
                                    setSuppressIbkrHover(true);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="text-sm font-semibold mb-2">IBKR Flex setup guide</p>
                              <ol className="list-decimal list-inside space-y-2 text-xs text-gray-200">
                                <li>
                                  In IBKR Client Portal, go to <span className="font-medium">Reports</span> → <span className="font-medium">Flex Queries</span>.
                                </li>
                                <li>
                                  Create a new <span className="font-medium">Activity Statement</span> Flex Query:
                                  <ul className="list-disc list-inside mt-1 space-y-1 ml-4">
                                    <li>Date range: <span className="font-medium">Last Business Day</span> (recommended)</li>
                                    <li>Include section: <span className="font-medium">Open Positions</span></li>
                                    <li>Save the query</li>
                                  </ul>
                                </li>
                                <li>
                                  In the Flex Queries list, copy the <span className="font-medium">Query ID</span> for the query you just saved.
                                </li>
                                <li>
                                  Go to <span className="font-medium">Reports</span> → <span className="font-medium">Flex Web Service</span> and generate an <span className="font-medium">Access Token</span> (or copy your existing token).
                                </li>
                                <li>
                                  Paste the <span className="font-medium">Access Token</span> and <span className="font-medium">Query ID</span> here, then click <span className="font-medium">Import from IBKR Flex</span> to preview holdings.
                                </li>
                              </ol>
                              <div className="mt-3 text-[11px] text-gray-400 space-y-1">
                                <p>We only use IBKR Flex Web Service (Generate + Retrieve). No IBKR Web API is used.</p>
                                <p>See local guide: INTERACTIVE_BROKERS_INTEGRATION.md for screenshots and details.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ibkr-token">Access Token</Label>
                      <Input id="ibkr-token" value={ibkrAccessToken} onChange={(e) => setIbkrAccessToken(e.target.value)} placeholder="Paste your IBKR Flex Access Token" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ibkr-query">Flex Query ID</Label>
                      <Input id="ibkr-query" value={ibkrQueryId} onChange={(e) => setIbkrQueryId(e.target.value)} placeholder="Enter Flex Query ID (Activity Statement)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
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
                            alert('IBKR Flex import failed. Please verify Access Token and Query ID.');
                          } finally {
                            setIbkrTesting(false);
                          }
                        }}
                      >
                        {ibkrTesting ? 'Importing…' : 'Import from IBKR Flex'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="save-ibkr" type="checkbox" className="rounded border-border bg-background" checked={saveIbkrCredentials} onChange={(e) => setSaveIbkrCredentials(e.target.checked)} />
                      <Label htmlFor="save-ibkr" className="text-xs">Save IBKR Access Token + Flex Query for auto-sync (optional)</Label>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>
                        Create an Activity Statement Flex Query for "Last Business Day" and include the
                        "Open Positions" section. Copy the Flex Access Token and Flex Query ID from Client Portal.
                      </p>
                      <p>We only use IBKR Flex Web Service (Generate + Retrieve). No IBKR Web API is used.</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Owners</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="owner-me"
                        checked={newAccount.owners.includes('me')}
                        onChange={(e) => {
                          const owners = e.target.checked
                            ? [...new Set([...newAccount.owners, 'me'])]
                            : newAccount.owners.filter(o => o !== 'me');
                          setNewAccount({ ...newAccount, owners });
                        }}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="owner-me" className="text-sm font-normal">Me</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="owner-wife"
                        checked={newAccount.owners.includes('wife')}
                        onChange={(e) => {
                          const owners = e.target.checked
                            ? [...new Set([...newAccount.owners, 'wife'])]
                            : newAccount.owners.filter(o => o !== 'wife');
                          setNewAccount({ ...newAccount, owners });
                        }}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="owner-wife" className="text-sm font-normal">Wife</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Holdings Table */}
              <div className="flex-1 flex flex-col">
                {newAccount.account_type === 'company-custodian-account' ? (
                  <div className="space-y-4">
                    <Label className="mb-3">Company Plans</Label>

                    {/* RSU Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">RSU Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newRSUPlan: RSUPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              grant_date: new Date().toISOString().split('T')[0],
                              has_cliff: false,
                              vesting_period_years: 4,
                              vesting_frequency: 'quarterly'
                            };
                            setNewAccount({
                              ...newAccount,
                              rsu_plans: [...newAccount.rsu_plans, newRSUPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add RSU Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {newAccount.rsu_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                RSU Plan - {plan.symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = newAccount.rsu_plans.filter((_, i) => i !== index);
                                  setNewAccount({ ...newAccount, rsu_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <RSUPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = newAccount.rsu_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setNewAccount({ ...newAccount, rsu_plans: updatedPlans });
                              }}
                              isCollapsed={collapsedRSUPlans.has(plan.id)}
                              onToggleCollapse={() => toggleRSUPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ESPP Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">ESPP Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newESPPPlan: ESPPPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              income_percentage: 15,
                              buying_periods: [{
                                start_date: new Date().toISOString().split('T')[0],
                                end_date: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                              }],
                              stock_discount_percentage: 15,
                              base_stock_price: 100
                            };
                            setNewAccount({
                              ...newAccount,
                              espp_plans: [...newAccount.espp_plans, newESPPPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add ESPP Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {newAccount.espp_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                ESPP Plan - {plan.symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = newAccount.espp_plans.filter((_, i) => i !== index);
                                  setNewAccount({ ...newAccount, espp_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <ESPPPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = newAccount.espp_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setNewAccount({ ...newAccount, espp_plans: updatedPlans });
                              }}
                              isCollapsed={collapsedESPPPlans.has(plan.id)}
                              onToggleCollapse={() => toggleESPPPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Options Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Options Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newOptionsPlan: OptionsPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              grant_date: new Date().toISOString().split('T')[0],
                              exercise_price: 0.10,
                              strike_price: 0.10,
                              expiration_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              has_cliff: false,
                              vesting_period_years: 4,
                              vesting_frequency: 'quarterly',
                              option_type: 'iso'
                            };
                            setNewAccount({
                              ...newAccount,
                              options_plans: [...newAccount.options_plans, newOptionsPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Options Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {newAccount.options_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                Options Plan - {plan.symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = newAccount.options_plans.filter((_, i) => i !== index);
                                  setNewAccount({ ...newAccount, options_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <OptionsPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = newAccount.options_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setNewAccount({ ...newAccount, options_plans: updatedPlans });
                              }}
                              isCollapsed={collapsedOptionsPlans.has(plan.id)}
                              onToggleCollapse={() => toggleOptionsPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Label className="mb-3">Holdings</Label>
                    <div className="rounded-md border flex-1 flex flex-col">
                      {/* Table Header */}
                      <div className="flex items-center border-b bg-muted/50 px-0">
                        <div className="flex-1 px-3 py-3 text-sm font-medium">Symbol</div>
                        <div className="w-28 px-3 py-3 text-sm font-medium">Units</div>
                        <div className="w-12 px-3 py-3"></div>
                      </div>

                      {/* Table Body */}
                      <div className="flex-1 overflow-y-auto">
                        {newAccount.holdings.map((holding, index) => (
                          <div key={index} className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
                            <div className="flex-1 p-0">
                              <SymbolAutocomplete
                                placeholder="e.g., AAPL"
                                value={holding.symbol}
                                onChange={(value) => {
                                  updateHolding(index, 'symbol', value);
                                }}
                                className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto"
                                onKeyDown={(e) => handleKeyDown(e, index, 'symbol')}
                                ref={(el) => holdingRefs.current[`${index}-symbol`] = el}
                              />
                            </div>
                            <div className="w-28 p-0">
                              <Input
                                placeholder="0"
                                type="number"
                                step="1"
                                value={holding.units}
                                onChange={(e) => {
                                  updateHolding(index, 'units', e.target.value);
                                }}
                                className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto"
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
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Rows are added automatically when typing and removed when cleared
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                // If user opted to save credentials, include them in the account payload
                if (newAccount.account_type === 'investment-account' && saveIbkrCredentials && ibkrAccessToken && ibkrQueryId) {
                  // Build payload matching backend schema
                  const payload = {
                    account_name: newAccount.account_name,
                    account_type: newAccount.account_type,
                    owners: newAccount.owners,
                    holdings: newAccount.holdings
                      .filter(h => (h.symbol?.trim() && h.units?.toString().trim()))
                      .map(h => ({ symbol: h.symbol.trim(), units: parseFloat(String(h.units)) })),
                    rsu_plans: newAccount.rsu_plans,
                    espp_plans: newAccount.espp_plans,
                    options_plans: newAccount.options_plans,
                    ibkr_flex: { access_token: ibkrAccessToken, query_id: ibkrQueryId },
                  };
                  try {
                    await api.post(`/portfolio/${selectedFile}/accounts`, payload);
                    setShowAddAccountModal(false);
                    setNewAccount({ account_name: '', account_type: 'bank-account', owners: ['me'], holdings: [{ symbol: '', units: '' }], rsu_plans: [], espp_plans: [], options_plans: [] } );
                    setIbkrAccessToken('');
                    setIbkrQueryId('');
                    await onAccountAdded();
                    return;
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Error adding account';
                    alert(msg);
                    return;
                  }
                }
                await handleAddAccount();
              }}
              disabled={!newAccount.account_name || newAccount.owners.length === 0}
            >
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Account Modal */}
      <Dialog open={showEditAccountModal} onOpenChange={setShowEditAccountModal}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="mr-2 h-5 w-5 text-blue-500" />
              Edit Account
            </DialogTitle>
            <DialogDescription>
              Update the account details and holdings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="flex gap-6 py-4 min-h-[400px]">
              {/* Left Column - Form Fields */}
              <div className="flex-1 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-account-name">Account Name</Label>
                  <Input
                    id="edit-account-name"
                    value={editAccount.account_name}
                    onChange={(e) => setEditAccount({ ...editAccount, account_name: e.target.value })}
                    placeholder="Enter account name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-account-type">Account Type</Label>
                  <Select value={editAccount.account_type} onValueChange={(value) => setEditAccount({ ...editAccount, account_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank-account">Bank Account</SelectItem>
                      <SelectItem value="investment-account">Investment Account</SelectItem>
                      <SelectItem value="education-fund">Education Fund</SelectItem>
                      <SelectItem value="retirement-account">Retirement Account</SelectItem>
                      <SelectItem value="company-custodian-account">Company Custodian Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {editAccount.account_type === 'investment-account' && (
                  <div className="grid gap-3 border rounded-md p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Link IBKR (Flex Web Service)</Label>
                      <div className="flex items-center text-xs text-gray-400">
                        <span>Optional</span>
                        <div
                          className="relative group inline-block ml-2"
                          onMouseLeave={() => {
                            setSuppressEditIbkrHover(false);
                          }}
                        >
                          <button
                            type="button"
                            aria-label="How to get IBKR Flex Query ID and Access Token"
                            className="p-1 rounded-full hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                            onClick={() => setShowEditIbkrHelp((v) => !v)}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                          <div
                            className={`absolute right-0 mt-2 z-50 w-[360px] max-w-[80vw] ${showEditIbkrHelp ? 'block' : 'hidden'} ${!suppressEditIbkrHover ? 'group-hover:block' : ''}`}
                          >
                            <div className="rounded-md border border-gray-700 bg-gray-800 text-white shadow-lg p-4 max-h-[70vh] overflow-y-auto">
                              <div className="flex items-start justify-between mb-1">
                                <p className="text-sm font-semibold">IBKR Flex setup guide</p>
                                <button
                                  type="button"
                                  className="text-gray-400 hover:text-white"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowEditIbkrHelp(false);
                                    setSuppressEditIbkrHover(true);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="text-sm font-semibold mb-2">IBKR Flex setup guide</p>
                              <ol className="list-decimal list-inside space-y-2 text-xs text-gray-200">
                                <li>
                                  In IBKR Client Portal, go to <span className="font-medium">Reports</span> → <span className="font-medium">Flex Queries</span>.
                                </li>
                                <li>
                                  Create a new <span className="font-medium">Activity Statement</span> Flex Query:
                                  <ul className="list-disc list-inside mt-1 space-y-1 ml-4">
                                    <li>Date range: <span className="font-medium">Last Business Day</span> (recommended)</li>
                                    <li>Include section: <span className="font-medium">Open Positions</span></li>
                                    <li>Save the query</li>
                                  </ul>
                                </li>
                                <li>
                                  In the Flex Queries list, copy the <span className="font-medium">Query ID</span> for the query you just saved.
                                </li>
                                <li>
                                  Go to <span className="font-medium">Reports</span> → <span className="font-medium">Flex Web Service</span> and generate an <span className="font-medium">Access Token</span> (or copy your existing token).
                                </li>
                                <li>
                                  Paste the <span className="font-medium">Access Token</span> and <span className="font-medium">Query ID</span> here, then click <span className="font-medium">Import from IBKR Flex</span> to preview holdings.
                                </li>
                              </ol>
                              <div className="mt-3 text-[11px] text-gray-400 space-y-1">
                                <p>We only use IBKR Flex Web Service (Generate + Retrieve). No IBKR Web API is used.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-ibkr-token">Access Token</Label>
                      <Input id="edit-ibkr-token" value={editIbkrAccessToken} onChange={(e) => setEditIbkrAccessToken(e.target.value)} placeholder="Paste your IBKR Flex Access Token" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit-ibkr-query">Flex Query ID</Label>
                      <Input id="edit-ibkr-query" value={editIbkrQueryId} onChange={(e) => setEditIbkrQueryId(e.target.value)} placeholder="Enter Flex Query ID (Activity Statement)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!editIbkrAccessToken || !editIbkrQueryId || editIbkrTesting}
                        onClick={async () => {
                          try {
                            setEditIbkrTesting(true);
                            const res = await api.post(`/ibkr/flex/preview`, {
                              access_token: editIbkrAccessToken,
                              query_id: editIbkrQueryId,
                            });
                            const holdings = res.data?.holdings ?? [];
                            setEditAccount({
                              ...editAccount,
                              holdings: [...holdings.map((h: {symbol: string; units: number}) => ({ symbol: h.symbol, units: String(h.units) })), { symbol: '', units: '' }]
                            });
                          } catch {
                            alert('IBKR Flex import failed. Please verify Access Token and Query ID.');
                          } finally {
                            setEditIbkrTesting(false);
                          }
                        }}
                      >
                        {editIbkrTesting ? 'Importing…' : 'Import from IBKR Flex'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="edit-save-ibkr" type="checkbox" className="rounded border-border bg-background" checked={editSaveIbkrCredentials} onChange={(e) => setEditSaveIbkrCredentials(e.target.checked)} />
                      <Label htmlFor="edit-save-ibkr" className="text-xs">Save IBKR Access Token + Flex Query for auto-sync (optional)</Label>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>
                        Create an Activity Statement Flex Query for "Last Business Day" and include the
                        "Open Positions" section. Copy the Flex Access Token and Flex Query ID from Client Portal.
                      </p>
                      <p>
                        We only use IBKR Flex Web Service (Generate + Retrieve). No IBKR Web API is used.
                      </p>
                    </div>
                    
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Owners</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-owner-me"
                        checked={editAccount.owners.includes('me')}
                        onChange={(e) => {
                          const owners = e.target.checked
                            ? [...new Set([...editAccount.owners, 'me'])]
                            : editAccount.owners.filter(o => o !== 'me');
                          setEditAccount({ ...editAccount, owners });
                        }}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="edit-owner-me" className="text-sm font-normal">Me</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-owner-wife"
                        checked={editAccount.owners.includes('wife')}
                        onChange={(e) => {
                          const owners = e.target.checked
                            ? [...new Set([...editAccount.owners, 'wife'])]
                            : editAccount.owners.filter(o => o !== 'wife');
                          setEditAccount({ ...editAccount, owners });
                        }}
                        className="rounded border-border bg-background"
                      />
                      <Label htmlFor="edit-owner-wife" className="text-sm font-normal">Wife</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Holdings Table */}
              <div className="flex-1 flex flex-col">
                {editAccount.account_type === 'company-custodian-account' ? (
                  <div className="space-y-4">
                    <Label className="mb-3">Company Plans</Label>

                    {/* RSU Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">RSU Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newRSUPlan: RSUPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              grant_date: new Date().toISOString().split('T')[0],
                              has_cliff: false,
                              vesting_period_years: 4,
                              vesting_frequency: 'quarterly'
                            };
                            setEditAccount({
                              ...editAccount,
                              rsu_plans: [...editAccount.rsu_plans, newRSUPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add RSU Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {editAccount.rsu_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                RSU Plan - {plan.symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = editAccount.rsu_plans.filter((_, i) => i !== index);
                                  setEditAccount({ ...editAccount, rsu_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <RSUPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = editAccount.rsu_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setEditAccount({ ...editAccount, rsu_plans: updatedPlans });
                              }}
                              isCollapsed={editCollapsedRSUPlans.has(plan.id)}
                              onToggleCollapse={() => toggleEditRSUPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ESPP Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">ESPP Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newESPPPlan: ESPPPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              income_percentage: 15,
                              buying_periods: [{
                                start_date: new Date().toISOString().split('T')[0],
                                end_date: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                              }],
                              stock_discount_percentage: 15,
                              base_stock_price: 100
                            };
                            setEditAccount({
                              ...editAccount,
                              espp_plans: [...editAccount.espp_plans, newESPPPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add ESPP Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {editAccount.espp_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                ESPP Plan - {plan.stock_symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = editAccount.espp_plans.filter((_, i) => i !== index);
                                  setEditAccount({ ...editAccount, espp_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <ESPPPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = editAccount.espp_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setEditAccount({ ...editAccount, espp_plans: updatedPlans });
                              }}
                              isCollapsed={editCollapsedESPPPlans.has(plan.id)}
                              onToggleCollapse={() => toggleEditESPPPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Options Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Options Plans</Label>
                        <Button
                          type="button"
                          onClick={() => {
                            const newOptionsPlan: OptionsPlan = {
                              id: Date.now().toString(),
                              symbol: '',
                              units: 0,
                              grant_date: new Date().toISOString().split('T')[0],
                              exercise_price: 0.10,
                              strike_price: 0.10,
                              expiration_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              has_cliff: false,
                              vesting_period_years: 4,
                              vesting_frequency: 'quarterly',
                              option_type: 'iso'
                            };
                            setEditAccount({
                              ...editAccount,
                              options_plans: [...editAccount.options_plans, newOptionsPlan]
                            });
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Options Plan
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {editAccount.options_plans.map((plan, index) => (
                          <div key={plan.id} className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium">
                                Options Plan - {plan.symbol || 'New Plan'}
                              </Label>
                              <Button
                                type="button"
                                onClick={() => {
                                  const updatedPlans = editAccount.options_plans.filter((_, i) => i !== index);
                                  setEditAccount({ ...editAccount, options_plans: updatedPlans });
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <OptionsPlanConfig
                              plan={plan}
                              onChange={(updatedPlan) => {
                                const updatedPlans = editAccount.options_plans.map((p, i) =>
                                  i === index ? updatedPlan : p
                                );
                                setEditAccount({ ...editAccount, options_plans: updatedPlans });
                              }}
                              isCollapsed={collapsedOptionsPlans.has(plan.id)}
                              onToggleCollapse={() => toggleOptionsPlanCollapse(plan.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Label className="mb-3">Holdings</Label>
                    <div className="rounded-md border flex-1 flex flex-col">
                      {/* Table Header */}
                      <div className="flex items-center border-b bg-muted/50 px-0">
                        <div className="flex-1 px-3 py-3 text-sm font-medium">Symbol</div>
                        <div className="w-28 px-3 py-3 text-sm font-medium">Units</div>
                        <div className="w-12 px-3 py-3"></div>
                      </div>

                      {/* Table Body */}
                      <div className="flex-1 overflow-y-auto">
                        {editAccount.holdings.map((holding, index) => (
                          <div key={index} className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
                            <div className="flex-1 p-0">
                              <SymbolAutocomplete
                                placeholder="e.g., AAPL"
                                value={holding.symbol}
                                onChange={(value) => {
                                  updateEditHolding(index, 'symbol', value);
                                }}
                                className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto"
                                onKeyDown={(e) => handleEditKeyDown(e, index, 'symbol')}
                                ref={(el) => editHoldingRefs.current[`edit-${index}-symbol`] = el}
                              />
                            </div>
                            <div className="w-28 p-0">
                              <Input
                                placeholder="0"
                                type="number"
                                step="1"
                                value={holding.units}
                                onChange={(e) => {
                                  updateEditHolding(index, 'units', e.target.value);
                                }}
                                className="border-0 rounded-none shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-3 h-auto"
                                onKeyDown={(e) => handleEditKeyDown(e, index, 'units')}
                                ref={(el) => editHoldingRefs.current[`edit-${index}-units`] = el}
                              />
                            </div>
                            <div className="w-12 flex justify-center py-2">
                              {editAccount.holdings.length > 1 && (holding.symbol || holding.units) && (
                                <Button
                                  type="button"
                                  onClick={() => removeEditHolding(index)}
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
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Rows are added automatically when typing and removed when cleared
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAccountModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditAccount}
              disabled={!editAccount.account_name || editAccount.owners.length === 0}
            >
              Update Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Account Confirmation Modal */}
      <Dialog open={showDeleteAccountModal} onOpenChange={setShowDeleteAccountModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <Trash2 className="mr-2 h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The account and all its holdings will be permanently removed from the portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Are you sure you want to delete the account:
            </p>
            <div className="p-3 bg-muted rounded-lg border">
              <p className="font-medium text-center">
                {accountToDelete}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAccountModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccountSelector;