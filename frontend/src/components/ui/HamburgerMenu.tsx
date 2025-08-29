import React from 'react';
import { Menu, CheckCircle2, Circle, Plus, Eye, EyeOff, User, Settings, LogOut } from 'lucide-react';
import { AccountInfo } from '@/types';
import { Button } from "@/components/ui/button";

interface HamburgerMenuProps {
  accounts: AccountInfo[];
  toggleAccountSelection: (accountName: string) => void;
  isValueVisible: boolean;
  toggleValueVisibility: () => void;
  setShowAddAccountModal: (show: boolean) => void;
  anchorEl: null | HTMLElement;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onMenuClose: () => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onSignOutClick: () => Promise<void>;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  accounts,
  toggleAccountSelection,
  isValueVisible,
  toggleValueVisibility,
  setShowAddAccountModal,
  anchorEl,
  onMenuOpen,
  onMenuClose,
  onProfileClick,
  onSettingsClick,
  onSignOutClick
}) => {
  const isOpen = Boolean(anchorEl);

  return (
    <div className="md:hidden">
      <button
        onClick={isOpen ? onMenuClose : onMenuOpen}
        className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
      >
        <Menu size={24} />
      </button>
      {isOpen && (
        <div className="absolute top-16 right-4 bg-gray-800 rounded-md shadow-lg p-4 w-64 z-50">
          <div className="space-y-2">
            <h3 className="font-bold text-white">Accounts</h3>
            {accounts.map(account => (
              <div
                key={account.account_name}
                onClick={() => toggleAccountSelection(account.account_name)}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700 cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  {account.isSelected ? <CheckCircle2 size={16} className="text-blue-400" /> : <Circle size={16} />}
                  <span className="text-sm">{account.account_name}</span>
                </div>
              </div>
            ))}
            <Button
              onClick={() => setShowAddAccountModal(true)}
              className="w-full flex items-center justify-center space-x-2 bg-emerald-500/20 text-white hover:bg-emerald-500/30"
            >
              <Plus size={16} />
              <span className="text-xs font-medium">Add Account</span>
            </Button>
            <Button
              onClick={toggleValueVisibility}
              className="w-full flex items-center justify-center space-x-2 bg-gray-700 text-white hover:bg-gray-600"
            >
              {isValueVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="text-xs font-medium">{isValueVisible ? 'Hide' : 'Show'} Values</span>
            </Button>
            <div className="border-t border-gray-700 my-2" />
            <Button
              onClick={onProfileClick}
              className="w-full flex items-center justify-center space-x-2 bg-gray-700 text-white hover:bg-gray-600"
            >
              <User size={16} />
              <span className="text-xs font-medium">Profile</span>
            </Button>
            <Button
              onClick={onSettingsClick}
              className="w-full flex items-center justify-center space-x-2 bg-gray-700 text-white hover:bg-gray-600"
            >
              <Settings size={16} />
              <span className="text-xs font-medium">Settings</span>
            </Button>
            <Button
              onClick={() => { onSignOutClick(); onMenuClose(); }}
              className="w-full flex items-center justify-center space-x-2 bg-red-500/20 text-white hover:bg-red-500/30"
            >
              <LogOut size={16} />
              <span className="text-xs font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu; 