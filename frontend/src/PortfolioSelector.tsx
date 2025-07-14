import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Download, Star } from 'lucide-react';
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
import yaml from 'js-yaml';
import api from './utils/api';

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  portfolios = [],
  selectedPortfolioId,
  onPortfolioChange,
  userName,
  onPortfolioCreated,
  onPortfolioDeleted,
  onDefaultPortfolioSet,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<string>('');
  const [newPortfolio, setNewPortfolio] = useState({
    portfolio_name: '',
    base_currency: 'ILS'
  });
  const [uploadedYaml, setUploadedYaml] = useState<unknown | null>(null);
  const [defaultPortfolioId, setDefaultPortfolioId] = useState<string | null>(null);

  // Fetch default portfolio from backend
  useEffect(() => {
    const fetchDefaultPortfolio = async () => {
      try {
        const response = await api.get(`/default-portfolio`);
        setDefaultPortfolioId(response.data.default_portfolio_id);
      } catch (error) {
        console.error('Failed to fetch default portfolio:', error);
      }
    };

    fetchDefaultPortfolio();
  }, []);

  const handleSetDefault = async (portfolioId: string) => {
    try {
      await api.post(`/default-portfolio`, {
        portfolio_id: portfolioId,
      });

      setDefaultPortfolioId(portfolioId);
      if (onDefaultPortfolioSet) {
        onDefaultPortfolioSet(portfolioId);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error setting default portfolio: ${errorMessage}`);
    }
  };

  const handleCreatePortfolio = async () => {
    try {
      const response = await api.post('/portfolio', newPortfolio);
      const result = response.data;
      setShowCreateModal(false);
      setNewPortfolio({ portfolio_name: '', base_currency: 'ILS' });
      
      // Use callback to refresh files and switch to new portfolio
      await onPortfolioCreated(result.portfolio_id);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error creating portfolio: ${errorMessage}`);
    }
  };

  const handleDeletePortfolio = async () => {
    try {
      await api.delete(`/portfolio/${portfolioToDelete}`);
      setShowDeleteModal(false);
      setPortfolioToDelete('');
      
      // Use callback to refresh files and handle portfolio switch
      await onPortfolioDeleted(portfolioToDelete);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting portfolio: ${errorMessage}`);
    }
  };

  const confirmDeletePortfolio = (portfolio_id: string) => {
    setPortfolioToDelete(portfolio_id);
    setShowDeleteModal(true);
  };

  const handleDownloadPortfolio = async (portfolio_id: string, portfolio_name: string) => {
    try {
      const response = await api.get(`/portfolio/raw?portfolio_id=${portfolio_id}`, {
        responseType: 'text'
      });
      const yamlStr = response.data;
      const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${portfolio_name || 'portfolio'}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert('Error downloading portfolio: ' + errorMessage);
    }
  };

  const handleUploadPortfolio = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let yamlObj: unknown;
      try {
        yamlObj = yaml.load(text);
      } catch {
        alert('Invalid YAML file.');
        return;
      }
      setUploadedYaml(yamlObj);
      // Optionally, set the portfolio name input to the uploaded name
      if (yamlObj && typeof yamlObj === 'object' && yamlObj !== null && 'portfolio_name' in yamlObj) {
        const portfolioName = (yamlObj as { portfolio_name?: string }).portfolio_name;
        if (portfolioName) {
          setNewPortfolio((prev) => ({ ...prev, portfolio_name: portfolioName }));
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert('Error reading YAML: ' + errorMessage);
    }
  };

  const handleCreatePortfolioFromYaml = async () => {
    if (!uploadedYaml) return;
    try {
      // Clone and modify the YAML object
      const yamlToUpload = { ...uploadedYaml } as Record<string, unknown>;
      delete yamlToUpload._id;
      yamlToUpload.portfolio_name = newPortfolio.portfolio_name;
      if (yamlToUpload.config && typeof yamlToUpload.config === 'object' && yamlToUpload.config !== null) {
        (yamlToUpload.config as Record<string, unknown>).user_name = newPortfolio.portfolio_name;
        (yamlToUpload.config as Record<string, unknown>).base_currency = newPortfolio.base_currency;
      }
      // Remove user_name at top level if present
      delete yamlToUpload.user_name;
      // Convert to YAML string
      const yamlStr = yaml.dump(yamlToUpload);
      const blob = new Blob([yamlStr], { type: 'application/x-yaml' });
      const formData = new FormData();
      formData.append('file', new File([blob], 'portfolio.yaml', { type: 'application/x-yaml' }));
      const response = await api.post('/portfolio/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const result = response.data;
      setShowCreateModal(false);
      setNewPortfolio({ portfolio_name: '', base_currency: 'ILS' });
      setUploadedYaml(null);
      await onPortfolioCreated(result.portfolio_id);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert('Error creating portfolio: ' + errorMessage);
    }
  };

  // Check if we should show empty state after all functions are defined
  const showEmptyState = !portfolios || portfolios.length === 0;

  if (showEmptyState) {
    return (
      <div className="relative">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="p-0 h-auto bg-gray-900 text-white hover:bg-gray-800 hover:text-blue-400 cursor-pointer">
              <h1 className="text-2xl font-bold flex items-center">
                {userName}'s Portfolio
                <ChevronDown
                  size={16}
                  className="ml-1 mb-1 opacity-40 transition-all duration-200 hover:opacity-80"
                />
              </h1>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-96 bg-white dark:bg-gray-900 border shadow-lg">
            <div className="p-3 text-center text-gray-500">
              <p>No portfolios yet</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onSelect={() => setShowCreateModal(true)}
              className="cursor-pointer hover:bg-green-50 hover:dark:bg-green-950 hover:text-green-900 hover:dark:text-green-100 p-3 transition-colors"
            >
              <Plus className="mr-3 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Create Your First Portfolio</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Create Portfolio Modal - needs to be here even when no portfolios */}
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
              <Button type="submit" onClick={handleCreatePortfolio}>
                Create Portfolio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="p-0 h-auto bg-gray-900 text-white hover:bg-gray-800 hover:text-blue-400 cursor-pointer">
            <h1 className="text-2xl font-bold flex items-center">
              {userName}'s Portfolio
              <ChevronDown
                size={16}
                className="ml-1 mb-1 opacity-40 transition-all duration-200 hover:opacity-80"
              />
            </h1>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-96 bg-white dark:bg-gray-900 border shadow-lg">
          {portfolios.map((portfolio) => (
            <DropdownMenuItem
              key={portfolio.portfolio_id}
              className={`flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-blue-50 hover:dark:bg-blue-950 hover:text-blue-900 hover:dark:text-blue-100 ${
                selectedPortfolioId === portfolio.portfolio_id ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' : ''
              }`}
              onSelect={() => onPortfolioChange(portfolio.portfolio_id)}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  selectedPortfolioId === portfolio.portfolio_id ? 'bg-primary' : 'bg-muted-foreground'
                }`} />
                <div className="flex flex-col">
                  <span className={selectedPortfolioId === portfolio.portfolio_id ? 'font-semibold' : 'font-medium'}>
                    {portfolio.display_name}
                  </span>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    {selectedPortfolioId === portfolio.portfolio_id && (
                      <span>• Active</span>
                    )}
                    {defaultPortfolioId === portfolio.portfolio_id && (
                      <span>• Default</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  onClick={e => {
                    e.stopPropagation();
                    handleSetDefault(portfolio.portfolio_id);
                  }}
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 border border-transparent bg-gray-900 text-white hover:text-yellow-500 hover:bg-gray-800 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors ${
                    defaultPortfolioId === portfolio.portfolio_id ? 'text-yellow-500' : ''
                  }`}
                  title={defaultPortfolioId === portfolio.portfolio_id ? 'Default portfolio' : 'Set as default'}
                  disabled={defaultPortfolioId === portfolio.portfolio_id}
                >
                  <Star className={`h-4 w-4 ${defaultPortfolioId === portfolio.portfolio_id ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  onClick={e => {
                    e.stopPropagation();
                    handleDownloadPortfolio(portfolio.portfolio_id, portfolio.portfolio_name);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 border border-transparent bg-gray-900 text-white hover:text-blue-500 hover:bg-gray-800 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors"
                  title="Download portfolio"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {portfolios.length > 1 && (
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      confirmDeletePortfolio(portfolio.portfolio_id);
                    }}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 border border-transparent bg-gray-900 text-white hover:text-red-500 hover:bg-gray-800 hover:border-red-700 focus:ring-0 focus:outline-none focus:border-transparent cursor-pointer transition-colors"
                    title="Delete portfolio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
            <div className="grid gap-2">
              <Label htmlFor="portfolio-upload">Upload Portfolio (YAML)</Label>
              <Input
                id="portfolio-upload"
                type="file"
                accept=".yaml,application/x-yaml,text/yaml"
                onChange={handleUploadPortfolio}
              />
            </div>
            {uploadedYaml !== null && (
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded border mt-2">
                <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">YAML loaded. You can now edit the portfolio name and click Create.</div>
                <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">{yaml.dump(uploadedYaml as Record<string, unknown>)}</pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="bg-gray-900 text-white hover:bg-gray-800">
              Cancel
            </Button>
            <Button
              onClick={uploadedYaml ? handleCreatePortfolioFromYaml : handleCreatePortfolio}
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
                {portfolios.find(f => f.portfolio_id === portfolioToDelete)?.display_name}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="bg-gray-900 text-white hover:bg-gray-800">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePortfolio} className="bg-red-700 text-white hover:bg-red-800">
              Delete Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioSelector;
