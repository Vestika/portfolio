import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ExternalLink, 
  TestTube, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Info,
  AlertCircle,
  Settings,
  FileText,
  Database,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { 
  testIBKRConnection, 
  IBKRTestConnectionRequest,
  IBKRTestConnectionResponse,
  IBKRSyncStatusResponse,
  syncIBKRHoldings,
  getIBKRSyncStatus,
  configureIBKRPeriodicSync,
  disconnectIBKRAccount
} from '../utils/ibkr-api';

interface IBKRConfigProps {
  flexQueryToken: string;
  flexQueryId: string;
  onConfigChange: (token: string, queryId: string) => void;
  onTestConnection: (result: IBKRTestConnectionResponse) => void;
  isTesting?: boolean;
  testResult?: IBKRTestConnectionResponse;
  portfolioId?: string;
  accountName?: string;
  onSyncComplete?: (holdings: unknown[]) => void;
}

const IBKRConfig: React.FC<IBKRConfigProps> = ({
  flexQueryToken,
  flexQueryId,
  onConfigChange,
  onTestConnection,
  isTesting = false,
  testResult,
  portfolioId,
  accountName,
  onSyncComplete
}) => {
  const [localToken, setLocalToken] = useState(flexQueryToken);
  const [localQueryId, setLocalQueryId] = useState(flexQueryId);
  
  // Update parent config whenever local values change (if both are filled)
  useEffect(() => {
    if (localToken.trim() && localQueryId.trim()) {
      console.log('IBKRConfig: Updating parent config with token and query ID');
      onConfigChange(localToken.trim(), localQueryId.trim());
    }
  }, [localToken, localQueryId, onConfigChange]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [syncStatusData, setSyncStatusData] = useState<IBKRSyncStatusResponse | null>(null);
  const [periodicSyncEnabled, setPeriodicSyncEnabled] = useState(false);
  const [periodicSyncInterval, setPeriodicSyncInterval] = useState(60);

  // Load sync status on component mount
  useEffect(() => {
    if (portfolioId && accountName) {
      loadSyncStatus();
    }
  }, [portfolioId, accountName]);

  const loadSyncStatus = async () => {
    try {
      const status = await getIBKRSyncStatus(portfolioId!, accountName!);
      setSyncStatusData(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!localToken.trim() || !localQueryId.trim()) {
      onTestConnection({
        success: false,
        error: 'Please enter both Flex Query Token and Query ID'
      });
      return;
    }

    setIsConnecting(true);
    try {
      const request: IBKRTestConnectionRequest = {
        flex_query_token: localToken.trim(),
        flex_query_id: localQueryId.trim()
      };
      
      const result = await testIBKRConnection(request);
      onTestConnection(result);
    } catch {
      onTestConnection({
        success: false,
        error: 'Failed to test connection'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleManualSync = async () => {
    if (!portfolioId || !accountName) {
      return;
    }

    setIsSyncing(true);
    try {
      // For new accounts, we need to create the account first before syncing
      if (!syncStatusData) {
        // This is a new account, so we'll just test the connection and show a message
        const testResult = await testIBKRConnection({
          flex_query_token: localToken,
          flex_query_id: localQueryId
        });
        
        if (testResult.success) {
          alert(`✅ Connection successful! Please save the account first, then you can sync holdings.`);
        } else {
          alert(`❌ Connection failed: ${testResult.error}`);
        }
        return;
      }

      // For existing accounts, proceed with normal sync
      const result = await syncIBKRHoldings(portfolioId, accountName, {
        flex_query_token: localToken,
        flex_query_id: localQueryId
      });
      
      if (result.success) {
        // Reload sync status
        await loadSyncStatus();
        
        // Notify parent of sync completion
        if (onSyncComplete && result.holdings) {
          onSyncComplete(result.holdings);
        }
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePeriodicSyncToggle = async () => {
    if (!portfolioId || !accountName) {
      return;
    }

    // For new accounts, show a message to save first
    if (!syncStatusData) {
      alert('Please save the account first before configuring periodic sync.');
      return;
    }

    try {
      const result = await configureIBKRPeriodicSync(portfolioId, accountName, {
        interval_minutes: periodicSyncInterval,
        enable: !periodicSyncEnabled
      });
      
      if (result.success) {
        setPeriodicSyncEnabled(!periodicSyncEnabled);
        await loadSyncStatus();
      }
    } catch (error) {
      console.error('Failed to toggle periodic sync:', error);
    }
  };

  const handleDisconnect = async () => {
    if (!portfolioId || !accountName) {
      return;
    }

    // For new accounts, just clear the configuration
    if (!syncStatusData) {
      if (confirm('Clear IBKR configuration?')) {
        setLocalToken('');
        setLocalQueryId('');
        onConfigChange('', '');
      }
      return;
    }

    if (!confirm('Are you sure you want to disconnect this IBKR account? This will remove all IBKR configuration.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const result = await disconnectIBKRAccount(portfolioId, accountName, {
        confirm: true
      });
      
      if (result.success) {
        // Clear local configuration
        setLocalToken('');
        setLocalQueryId('');
        setSyncStatusData(null);
        setPeriodicSyncEnabled(false);
        
        // Notify parent
        onConfigChange('', '');
      }
    } catch (error) {
      console.error('Failed to disconnect account:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getStatusBadge = () => {
    const status = syncStatusData?.sync_status || 'idle';
    switch (status) {
      case 'syncing':
        return <Badge variant="secondary" className="flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Syncing</Badge>;
      case 'success':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Synced</Badge>;
      case 'error':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline">Not Synced</Badge>;
    }
  };

  const formatLastSync = (timestamp: string | undefined) => {
    if (!timestamp) return 'Never';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Interactive Brokers Flex Web Service
        </CardTitle>
        <CardDescription>
          Connect your IBKR account using Flex Web Service for automatic holdings synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="flex-token">Flex Query Token</Label>
            <Input
              id="flex-token"
              type="password"
              placeholder="Enter your Flex Query Token"
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Found in IBKR Account Management → Settings → Flex Web Service
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="flex-query-id">Flex Query ID</Label>
            <Input
              id="flex-query-id"
              placeholder="Enter your Flex Query ID"
              value={localQueryId}
              onChange={(e) => setLocalQueryId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Found in IBKR Account Management → Reports → Flex Queries
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleTestConnection}
            disabled={isConnecting || isTesting}
            variant="outline"
            size="sm"
          >
            <TestTube className="h-4 w-4 mr-2" />
            {isConnecting ? 'Testing...' : 'Test Connection'}
          </Button>
          
          {portfolioId && accountName && (
            <>
              <Button
                onClick={handleManualSync}
                disabled={isSyncing || !localToken || !localQueryId}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : syncStatusData ? 'Sync Now' : 'Test & Save First'}
              </Button>
              
              <Button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDisconnecting ? 'Disconnecting...' : syncStatusData ? 'Disconnect' : 'Clear Config'}
              </Button>
            </>
          )}
        </div>

        {/* Sync Status */}
        {syncStatusData && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Sync Status</h4>
              {getStatusBadge()}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Last Sync:</span>
                <p>{formatLastSync(syncStatusData.last_sync)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Holdings:</span>
                <p>{syncStatusData.holdings_count || 0} positions</p>
              </div>
              {syncStatusData.account_id && (
                <div>
                  <span className="text-muted-foreground">IBKR Account:</span>
                  <p>{syncStatusData.account_id}</p>
                </div>
              )}
              {syncStatusData.account_name_ibkr && (
                <div>
                  <span className="text-muted-foreground">Account Name:</span>
                  <p>{syncStatusData.account_name_ibkr}</p>
                </div>
              )}
            </div>
            
            {syncStatusData.sync_error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Sync error: {syncStatusData.sync_error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Periodic Sync Configuration */}
        {portfolioId && accountName && (
          <div className="space-y-3 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Periodic Sync</h4>
              {syncStatusData ? (
                <Button
                  onClick={handlePeriodicSyncToggle}
                  variant={periodicSyncEnabled ? "destructive" : "default"}
                  size="sm"
                >
                  {periodicSyncEnabled ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Enable
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Save account first to enable periodic sync"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Save First
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Label htmlFor="sync-interval" className="text-sm">Interval:</Label>
              <Input
                id="sync-interval"
                type="number"
                min="15"
                max="1440"
                value={periodicSyncInterval}
                onChange={(e) => setPeriodicSyncInterval(parseInt(e.target.value) || 60)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {syncStatusData 
                ? `Automatically sync holdings every ${periodicSyncInterval} minutes`
                : 'Save the account first to enable periodic sync'
              }
            </p>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5" />
              )}
              <AlertDescription>
                {testResult.success ? (
                  <div>
                    <p className="font-medium">{testResult.message}</p>
                    {testResult.accounts_found && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Found {testResult.accounts_found} account(s) with {testResult.total_positions} position(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <p>{testResult.error}</p>
                )}
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Setup Guide */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-4">
              <div>
                <p className="font-medium mb-2">Setup Instructions:</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Settings className="h-4 w-4 mt-0.5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">1. Enable Flex Web Service</p>
                      <p className="text-xs text-muted-foreground">
                        Log in to IBKR Account Management → Settings → Account Settings → Flex Web Service → Enable Flex Web Service
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">2. Create Flex Query</p>
                      <p className="text-xs text-muted-foreground">
                        Go to Reports → Flex Queries → Create New Flex Query
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Database className="h-4 w-4 mt-0.5 text-purple-500" />
                    <div>
                      <p className="font-medium text-sm">3. Configure Query Settings</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 mt-1">
                        <li>Query Type: <strong>Portfolio</strong></li>
                        <li>Include: <strong>Open Positions</strong></li>
                        <li>Format: <strong>XML</strong></li>
                        <li>Save the query and note the Query ID</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <ExternalLink className="h-4 w-4 mt-0.5 text-orange-500" />
                    <div>
                      <p className="font-medium text-sm">4. Get Your Credentials</p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 mt-1">
                        <li>Flex Query Token: From Settings → Flex Web Service</li>
                        <li>Flex Query ID: From Reports → Flex Queries (after creating)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> The Flex Web Service provides read-only access to your account data. 
                  No trading permissions are required, and your account remains secure.
                </p>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default IBKRConfig; 