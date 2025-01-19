import React, { useState } from 'react';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo
} from './types';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  Circle
} from 'lucide-react';
import PortfolioSelector from "./PortfolioSelector.tsx";

interface AccountSelectorProps {
  portfolioMetadata: PortfolioMetadata;
  onAccountsChange: (accountNames: string[]) => void;
  onToggleVisibility: () => void;
  availableFiles: PortfolioFile[];
  selectedFile: string;
  onFileChange: (filename: string) => void;
}

const AccountSelector: React.FC<AccountSelectorProps> = ({
  portfolioMetadata,
  onAccountsChange,
  onToggleVisibility,
  availableFiles = [], // Provide default empty array
  selectedFile,
  onFileChange
}) => {
  const [accounts, setAccounts] = useState<AccountInfo[]>(
    portfolioMetadata.accounts.map(account => ({
      ...account,
      isSelected: true
    }))
  );
  const [isValueVisible, setIsValueVisible] = useState(true);

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

  const selectedAccountsCount = accounts.filter(account => account.isSelected).length;

  return (
    <div className="sticky top-0 z-20 bg-gray-800 text-white pb-2 pt-4 px-4 border-b border-gray-700">
      <div className="container mx-auto flex justify-between items-start">
        <div>
          <PortfolioSelector
            files={availableFiles}
            selectedFile={selectedFile}
            onFileChange={onFileChange}
            userName={portfolioMetadata.user_name}
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
                    onClick={() => toggleAccountSelection(account.account_name)}
                    className={`
                  cursor-pointer flex items-center space-x-2 
                  pl-3 pr-4 py-2 rounded-lg 
                  ${account.isSelected
                        ? 'bg-sky-800 hover:bg-sky-600'
                        : 'bg-gray-700 hover:bg-gray-600'}
                `}
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
            ))}
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
    </div>
  );
};

export default AccountSelector;