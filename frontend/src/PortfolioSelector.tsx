import React, { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
  PortfolioSelectorProps,
} from './types';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const apiUrl = import.meta.env.VITE_API_URL;

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  files = [],
  selectedFile,
  onFileChange,
  userName,
  onPortfolioCreated,
  onPortfolioDeleted,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<string>('');
  const [newPortfolio, setNewPortfolio] = useState({
    portfolio_name: '',
    base_currency: 'ILS'
  });

  if (!files || files.length === 0) {
    return <h1 className="text-2xl font-bold text-white">{userName}'s Portfolio</h1>;
  }

  const handleCreatePortfolio = async () => {
    try {
      const response = await fetch(`${apiUrl}/portfolio/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPortfolio),
      });

      if (response.ok) {
        const result = await response.json();
        setShowCreateModal(false);
        setNewPortfolio({ portfolio_name: '', base_currency: 'ILS' });
        
        // Use callback to refresh files and switch to new portfolio
        await onPortfolioCreated(result.filename);
      } else {
        const error = await response.json();
        alert(`Error creating portfolio: ${error.detail}`);
      }
    } catch (error) {
      alert(`Error creating portfolio: ${error}`);
    }
  };

  const handleDeletePortfolio = async () => {
    try {
      const response = await fetch(`${apiUrl}/portfolio/${portfolioToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowDeleteModal(false);
        setPortfolioToDelete('');
        
        // Use callback to refresh files and handle portfolio switch
        await onPortfolioDeleted(portfolioToDelete);
      } else {
        const error = await response.json();
        alert(`Error deleting portfolio: ${error.detail}`);
      }
    } catch (error) {
      alert(`Error deleting portfolio: ${error}`);
    }
  };

  const confirmDeletePortfolio = (filename: string) => {
    setPortfolioToDelete(filename);
    setShowDeleteModal(true);
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto hover:bg-transparent cursor-pointer">
            <h1 className="text-2xl font-bold flex items-center">
              {userName}'s Portfolio
              <ChevronDown
                size={16}
                className="ml-1 mb-1 opacity-40 transition-all duration-200 hover:opacity-80"
              />
            </h1>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 bg-white dark:bg-gray-900 border shadow-lg">
          {files.map((file) => (
            <DropdownMenuItem
              key={file.filename}
              className={`flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-blue-50 hover:dark:bg-blue-950 hover:text-blue-900 hover:dark:text-blue-100 ${
                selectedFile === file.filename ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' : ''
              }`}
              onSelect={() => onFileChange(file.filename)}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  selectedFile === file.filename ? 'bg-primary' : 'bg-muted-foreground'
                }`} />
                <span className={selectedFile === file.filename ? 'font-semibold' : 'font-medium'}>
                  {file.display_name}
                </span>
                {selectedFile === file.filename && (
                  <span className="text-xs text-muted-foreground">• Active</span>
                )}
              </div>
              {files.length > 1 && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDeletePortfolio(file.filename);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 border border-transparent hover:text-red-500 hover:border-red-700 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors"
                  title="Delete portfolio"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onSelect={() => setShowCreateModal(true)}
            className="cursor-pointer hover:bg-green-50 hover:dark:bg-green-950 hover:text-green-900 hover:dark:text-green-100 p-3 transition-colors"
          >
            <Plus className="mr-3 h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Add New Portfolio</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Portfolio Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5 text-green-500" />
              Create New Portfolio
            </DialogTitle>
            <DialogDescription>
              Create a new portfolio to manage your investments and assets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-name">Portfolio Name</Label>
              <Input
                id="portfolio-name"
                value={newPortfolio.portfolio_name}
                onChange={(e) => setNewPortfolio({ ...newPortfolio, portfolio_name: e.target.value })}
                placeholder="Enter portfolio name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="base-currency">Base Currency</Label>
              <Select value={newPortfolio.base_currency} onValueChange={(value) => setNewPortfolio({ ...newPortfolio, base_currency: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">ILS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePortfolio}
              disabled={!newPortfolio.portfolio_name}
            >
              Create Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Portfolio Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <Trash2 className="mr-2 h-5 w-5" />
              Delete Portfolio
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The entire portfolio file will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Are you sure you want to delete the portfolio:
            </p>
            <div className="p-3 bg-muted rounded-lg border">
              <p className="font-medium text-center">
                {files.find(f => f.filename === portfolioToDelete)?.display_name}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePortfolio}>
              Delete Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioSelector;