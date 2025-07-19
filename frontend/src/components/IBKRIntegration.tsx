import React, { useState, useEffect } from 'react';
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
import { Badge } from "@/components/ui/badge";
import { Link, Wifi, WifiOff, RefreshCw, Unlink } from 'lucide-react';
import api from '../utils/api';

interface IBKRAccount {
  id: string;
  accountId: string;
  displayName: string;
  currency: string;
  type: string;
}

interface ConnectionStatus {
  success: boolean;
  authenticated: boolean;
  accounts_accessible: boolean;
  accounts_found?: number;
  error?: string;
}

interface IBKRIntegrationProps {
  portfolioId: string;
  accountName: string;
  currentConnection?: {
    provider: string;
    account_id?: string;
    username?: string;
    last_sync?: string;
    sync_enabled: boolean;
  };
  onConnectionChange: () => void;
}

const IBKRIntegration: React.FC<IBKRIntegrationProps> = ({
  portfolioId,
  accountName,
  currentConnection,
  onConnectionChange
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<IBKRAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isConnected = currentConnection?.provider === 'interactive_brokers';

  useEffect(() => {
    if (showModal) {
      testConnection();
    }
  }, [showModal]);

  const testConnection = async () => {
    try {
      const response = await api.get('/ibkr/test-connection');
      setConnectionStatus(response.data.connection_test);
      
      if (response.data.connection_test.authenticated) {
        await loadAvailableAccounts();
      }
    } catch (err) {
      console.error('Failed to test IBKR connection:', err);
      setConnectionStatus({
        success: false,
        authenticated: false,
        accounts_accessible: false,
        error: 'Failed to connect to Interactive Brokers API'
      });
    }
  };

  const loadAvailableAccounts = async () => {
    try {
      const response = await api.get('/ibkr/accounts');
      setAvailableAccounts(response.data.accounts || []);
    } catch (err) {
      console.error('Failed to load IBKR accounts:', err);
      setError('Failed to load available accounts');
    }
  };

  const handleConnect = async () => {
    if (!selectedAccountId) {
      setError('Please select an Interactive Brokers account');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const connectionData = {
        account_id: selectedAccountId,
        username: username.trim() || undefined,
        sync_enabled: true
      };

      await api.post(
        `/portfolio/${portfolioId}/accounts/${encodeURIComponent(accountName)}/connect/ibkr`,
        connectionData
      );

      setShowModal(false);
      onConnectionChange();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to connect account';
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);

    try {
      await api.post(
        `/portfolio/${portfolioId}/accounts/${encodeURIComponent(accountName)}/sync`
      );
      onConnectionChange();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to sync holdings';
      setError(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post(
        `/portfolio/${portfolioId}/accounts/${encodeURIComponent(accountName)}/disconnect`
      );
      onConnectionChange();
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to disconnect account';
      setError(errorMessage);
    }
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    return new Date(lastSync).toLocaleString();
  };

  return (
    <>
      {/* Connection Status and Actions */}
      <div className="flex items-center space-x-2">
        {isConnected ? (
          <>
            <Badge variant="default" className="bg-green-500/20 text-green-200 border-green-400/30">
              <Wifi className="w-3 h-3 mr-1" />
              IBKR Connected
            </Badge>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              size="sm"
              variant="ghost"
              className="text-blue-400 hover:text-blue-300"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button
              onClick={handleDisconnect}
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
            >
              <Unlink className="w-4 h-4 mr-1" />
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            variant="ghost"
            className="text-green-400 hover:text-green-300"
          >
            <Link className="w-4 h-4 mr-1" />
            Connect to IBKR
          </Button>
        )}
      </div>

      {/* Connection Details */}
      {isConnected && currentConnection && (
        <div className="text-xs text-gray-400 mt-1">
          Account: {currentConnection.account_id} | 
          Last sync: {formatLastSync(currentConnection.last_sync)}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-xs text-red-400 mt-1">
          {error}
        </div>
      )}

      {/* Connection Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Link className="mr-2 h-5 w-5 text-blue-500" />
              Connect to Interactive Brokers
            </DialogTitle>
            <DialogDescription>
              Link your Interactive Brokers account to automatically sync holdings for "{accountName}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Connection Status */}
            <div className="p-4 border rounded-md">
              <h4 className="font-medium mb-2">Connection Status</h4>
              {connectionStatus ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {connectionStatus.authenticated ? (
                      <Wifi className="w-4 h-4 text-green-500" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm">
                      Authentication: {connectionStatus.authenticated ? 'Connected' : 'Not authenticated'}
                    </span>
                  </div>
                  {connectionStatus.authenticated && (
                    <div className="text-sm text-gray-600">
                      Found {connectionStatus.accounts_found || 0} available accounts
                    </div>
                  )}
                  {connectionStatus.error && (
                    <div className="text-sm text-red-500">
                      Error: {connectionStatus.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500">Testing connection...</div>
              )}
            </div>

            {/* Setup Instructions */}
            {!connectionStatus?.authenticated && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h4 className="font-medium text-yellow-800 mb-2">Setup Required</h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>1. Download and install Interactive Brokers Client Portal Gateway</p>
                  <p>2. Run the gateway and navigate to <code>https://localhost:5000</code></p>
                  <p>3. Log in with your IBKR credentials</p>
                  <p>4. Return here to complete the connection</p>
                </div>
                <Button
                  onClick={testConnection}
                  size="sm"
                  className="mt-2"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry Connection
                </Button>
              </div>
            )}

            {/* Account Selection */}
            {connectionStatus?.authenticated && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="ibkr-account">Select IBKR Account</Label>
                  <select
                    id="ibkr-account"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                  >
                    <option value="">Select an account...</option>
                    {availableAccounts.map((account) => (
                      <option key={account.id} value={account.accountId}>
                        {account.displayName} ({account.accountId}) - {account.currency}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="ibkr-username">Username (Optional)</Label>
                  <Input
                    id="ibkr-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="IBKR username (if using secondary account)"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Only needed if using a secondary username for API access
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowModal(false)} variant="outline">
              Cancel
            </Button>
            {connectionStatus?.authenticated && (
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !selectedAccountId}
              >
                {isConnecting ? 'Connecting...' : 'Connect Account'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IBKRIntegration; 