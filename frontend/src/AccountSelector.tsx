import React, { useState, useRef, useEffect } from 'react';
import { analytics } from './lib/firebase';
import { logEvent } from 'firebase/analytics';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo
} from './types';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  X,
  Edit
} from 'lucide-react';
import PortfolioSelector from "./PortfolioSelector.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const apiUrl = import.meta.env.VITE_API_URL;

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
  onAccountDeleted
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
  const [newAccount, setNewAccount] = useState({
    account_name: '',
    account_type: 'bank-account',
    owners: ['me'],
    holdings: [{ symbol: '', units: '' }]
  });
  const [editAccount, setEditAccount] = useState({
    account_name: '',
    account_type: 'bank-account',
    owners: ['me'],
    holdings: [{ symbol: '', units: '' }]
  });
  const holdingRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const editHoldingRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    setAccounts(
      portfolioMetadata.accounts.map(account => ({
        ...account,
        isSelected: true
      }))
    );
  }, [portfolioMetadata.accounts]);

  const toggleAccountSelection = (accountName: string) => {
    const updatedAccounts = accounts.map(account =>
      account.account_name === accountName
        ? { ...account, isSelected: !account.isSelected }
        : account
    );

    // Count selected accounts after potential deselection
    const selectedAccounts = updatedAccounts.filter(account => account.isSelected);

    // If attempting to deselect the last selected account, prevent deselection
    if (selectedAccounts.length === 0) {
      return; // Do nothing if trying to deselect the last account
    }

    setAccounts(updatedAccounts);

    // Get selected account names
    const selectedAccountNames = updatedAccounts
      .filter(account => account.isSelected)
      .map(account => account.account_name);

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
    const updatedHoldings = newAccount.holdings.map((holding, i) => 
      i === index ? { ...holding, [field]: value } : holding
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
      // Filter out empty holdings and convert units to numbers
      const validHoldings = newAccount.holdings
        .filter(holding => holding.symbol.trim() && holding.units.trim())
        .map(holding => ({
          symbol: holding.symbol.trim(),
          units: parseFloat(holding.units)
        }));

      const accountData = {
        ...newAccount,
        holdings: validHoldings
      };

      const response = await fetch(`${apiUrl}/portfolio/${selectedFile}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (response.ok) {
        setShowAddAccountModal(false);
        setNewAccount({ account_name: '', account_type: 'bank-account', owners: ['me'], holdings: [{ symbol: '', units: '' }] } );
        holdingRefs.current = {}; // Clear refs
        
        // Track account creation event
        logEvent(analytics, 'account_created', {
          account_name: newAccount.account_name,
          account_type: newAccount.account_type,
          holdings_count: validHoldings.length
        });
        
        // Trigger refresh to reload the portfolio with new account
        await onAccountAdded();
      } else {
        const error = await response.json();
        alert(`Error adding account: ${error.detail}`);
        
        // Track error event
        logEvent(analytics, 'account_creation_error', {
          error_detail: error.detail
        });
      }
    } catch (error) {
      alert(`Error adding account: ${error}`);
      
      // Track error event
      logEvent(analytics, 'account_creation_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch(`${apiUrl}/portfolio/${selectedFile}/accounts/${encodeURIComponent(accountToDelete)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowDeleteAccountModal(false);
        setAccountToDelete('');
        
        // Track account deletion event
        logEvent(analytics, 'account_deleted', {
          account_name: accountToDelete
        });
        
        // Trigger refresh to reload the portfolio without the deleted account
        await onAccountDeleted();
      } else {
        const error = await response.json();
        alert(`Error deleting account: ${error.detail}`);
        
        // Track error event
        logEvent(analytics, 'account_deletion_error', {
          error_detail: error.detail
        });
      }
    } catch (error) {
      alert(`Error deleting account: ${error}`);
      
      // Track error event
      logEvent(analytics, 'account_deletion_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
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
        holdings: mappedHoldings
      });
      
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
    const updatedHoldings = editAccount.holdings.map((holding, i) => 
      i === index ? { ...holding, [field]: value } : holding
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
      // Filter out empty holdings and convert units to numbers
      const validHoldings = editAccount.holdings
        .filter(holding => holding.symbol.trim() && holding.units.trim())
        .map(holding => ({
          symbol: holding.symbol.trim(),
          units: parseFloat(holding.units)
        }));

      const accountData = {
        ...editAccount,
        holdings: validHoldings
      };

      const response = await fetch(`${apiUrl}/portfolio/${selectedFile}/accounts/${encodeURIComponent(accountToEdit)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(accountData),
      });

      if (response.ok) {
        setShowEditAccountModal(false);
        setAccountToEdit('');
        setEditAccount({ account_name: '', account_type: 'bank-account', owners: ['me'], holdings: [{ symbol: '', units: '' }] });
        editHoldingRefs.current = {}; // Clear refs
        
        // Track account update event
        logEvent(analytics, 'account_updated', {
          account_name: editAccount.account_name,
          account_type: editAccount.account_type,
          holdings_count: validHoldings.length
        });
        
        // Trigger refresh to reload the portfolio with updated account
        await onAccountAdded();
      } else {
        const error = await response.json();
        alert(`Error updating account: ${error.detail}`);
        
        // Track error event
        logEvent(analytics, 'account_update_error', {
          error_detail: error.detail
        });
      }
    } catch (error) {
      alert(`Error updating account: ${error}`);
      
      // Track error event
      logEvent(analytics, 'account_update_error', {
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const selectedAccountsCount = accounts.filter(account => account.isSelected).length;

  return (
    <div className="sticky top-0 z-20 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700">
      <div className="container mx-auto flex justify-between items-start">
        <div>
          <PortfolioSelector
            portfolios={availableFiles}
            selectedPortfolioId={selectedFile}
            onPortfolioChange={onPortfolioChange}
            userName={portfolioMetadata.user_name}
            onPortfolioCreated={onPortfolioCreated}
            onPortfolioDeleted={onPortfolioDeleted}
          />
          <p className="text-sm text-gray-400 mt-0">
            Showing {selectedAccountsCount} of {accounts.length} accounts
          </p>
        </div>

        <div className="flex items-center space-x-4">
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
                  pl-3 pr-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 
                  ${account.isSelected
                        ? 'bg-gradient-to-br from-sky-600 to-sky-800 border border-sky-500/50 shadow-sky-500/25' 
                        : 'bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600/50 shadow-gray-700/25 hover:from-gray-600 hover:to-gray-700'}
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
                            }).format(account.account_total)} {' '}
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
                          className="h-8 w-8 border border-transparent hover:text-blue-500 hover:border-blue-700 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors"
                          title="Edit account"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {accounts.length > 1 && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDeleteAccount(account.account_name);
                            }}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 border border-transparent hover:text-red-500 hover:border-red-700 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors"
                            title="Delete account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            ))}
            
            {/* Add New Account Button */}
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="flex items-center space-x-2 pl-3 pr-4 py-2 rounded-lg bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border border-green-500/50 group"
            >
              <Plus size={16} className="text-green-100 group-hover:text-white" />
              <span className="text-xs font-medium">Add Account</span>
            </button>
          </div>

          {/* Visibility Toggle */}
          <button
              onClick={toggleValueVisibility}
              className="p-2 rounded-full hover:bg-gray-700"
          >
            {isValueVisible ? <EyeOff size={20}/> : <Eye size={20}/>}
          </button>
        </div>
      </div>
      
      {/* Add Account Modal */}
      <Dialog open={showAddAccountModal} onOpenChange={setShowAddAccountModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5 text-green-500" />
              Add New Account
            </DialogTitle>
            <DialogDescription>
              Create a new account to manage your investments and assets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                </SelectContent>
              </Select>
            </div>
            
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

            <div className="grid gap-2">
              <Label>Holdings</Label>
              <div className="rounded-md border">
                {/* Table Header */}
                <div className="flex items-center border-b bg-muted/50 px-0">
                  <div className="flex-1 px-3 py-3 text-sm font-medium">Symbol</div>
                  <div className="w-28 px-3 py-3 text-sm font-medium">Units</div>
                  <div className="w-12 px-3 py-3"></div>
                </div>
                
                {/* Table Body */}
                <div className="max-h-40 overflow-y-auto">
                  {newAccount.holdings.map((holding, index) => (
                    <div key={index} className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
                      <div className="flex-1 p-0">
                        <Input
                          placeholder="e.g., AAPL"
                          value={holding.symbol}
                          onChange={(e) => {
                            updateHolding(index, 'symbol', e.target.value);
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
              <p className="text-xs text-muted-foreground">
                💡 Rows are added automatically when typing and removed when cleared
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccountModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddAccount}
              disabled={!newAccount.account_name || newAccount.owners.length === 0}
            >
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Account Modal */}
      <Dialog open={showEditAccountModal} onOpenChange={setShowEditAccountModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Edit className="mr-2 h-5 w-5 text-blue-500" />
              Edit Account
            </DialogTitle>
            <DialogDescription>
              Update the account details and holdings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                </SelectContent>
              </Select>
            </div>
            
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

            <div className="grid gap-2">
              <Label>Holdings</Label>
              <div className="rounded-md border">
                {/* Table Header */}
                <div className="flex items-center border-b bg-muted/50 px-0">
                  <div className="flex-1 px-3 py-3 text-sm font-medium">Symbol</div>
                  <div className="w-28 px-3 py-3 text-sm font-medium">Units</div>
                  <div className="w-12 px-3 py-3"></div>
                </div>
                
                {/* Table Body */}
                <div className="max-h-40 overflow-y-auto">
                  {editAccount.holdings.map((holding, index) => (
                    <div key={index} className="flex items-center border-b last:border-b-0 hover:bg-muted/50">
                      <div className="flex-1 p-0">
                        <Input
                          placeholder="e.g., AAPL"
                          value={holding.symbol}
                          onChange={(e) => {
                            updateEditHolding(index, 'symbol', e.target.value);
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
              <p className="text-xs text-muted-foreground">
                💡 Rows are added automatically when typing and removed when cleared
              </p>
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