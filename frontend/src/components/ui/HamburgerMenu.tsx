import React from 'react';
import { Menu, CheckCircle2, Circle, Plus, Eye, EyeOff } from 'lucide-react';
import { AccountInfo } from '@/types';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HamburgerMenuProps {
  accounts: AccountInfo[];
  toggleAccountSelection: (accountName: string) => void;
  isValueVisible: boolean;
  toggleValueVisibility: () => void;
  setShowAddAccountModal: (show: boolean) => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  accounts,
  toggleAccountSelection,
  isValueVisible,
  toggleValueVisibility,
  setShowAddAccountModal
}) => {
  return (
    <div className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <Menu size={24} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-64 bg-gray-800/95 backdrop-blur-md border-gray-700 shadow-xl"
          sideOffset={8}
        >
          <div className="p-2">
            <h3 className="font-bold text-white mb-2">Accounts</h3>
            <div className="space-y-1">
              {accounts.map(account => (
                <DropdownMenuItem
                  key={account.account_name}
                  onClick={() => toggleAccountSelection(account.account_name)}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-gray-700/80 focus:bg-gray-700/80 cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    {account.isSelected ? <CheckCircle2 size={16} className="text-blue-400" /> : <Circle size={16} />}
                    <span className="text-sm text-gray-100">{account.account_name}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
            
            <div className="mt-3 space-y-2">
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
            </div>
            
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default HamburgerMenu; 