import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PieChart from './PieChart';
import AccountSelector from './AccountSelector';
import PortfolioSummary from './PortfolioSummary';
import LoadingScreen from './LoadingScreen';
import HoldingsTable from './HoldingsTable';
import {
  PortfolioMetadata,
  PortfolioFile,
  AccountInfo,
  PortfolioData,
  HoldingsTableData,
} from './types';

const apiUrl = import.meta.env.VITE_API_URL;

const App: React.FC = () => {
  const [portfolioMetadata, setPortfolioMetadata] = useState<PortfolioMetadata | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValueVisible, setIsValueVisible] = useState(true);
  const [availableFiles, setAvailableFiles] = useState<PortfolioFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("demo.yaml");
  const [holdingsData, setHoldingsData] = useState<HoldingsTableData | null>(null);

  const fetchAvailableFiles = async () => {
    try {
      const response = await axios.get(`${apiUrl}/portfolio/files`);
      setAvailableFiles(response.data || []); // Ensure we always set an array
    } catch (err) {
      console.error('Failed to fetch available portfolio files:', err);
      setAvailableFiles([]); // Set empty array on error
      setError('Failed to fetch available portfolio files');
    }
  };

  const fetchPortfolioMetadata = async () => {
    try {
      const metadata = await axios.get(`${apiUrl}/portfolio?file=${selectedFile}`);
      setPortfolioMetadata(metadata.data);
      setSelectedAccounts(metadata.data.accounts.map((acc: AccountInfo) => acc.account_name));
      return metadata.data;
    } catch (err) {
      setError('Failed to fetch portfolio metadata');
      throw err;
    }
  };

  const fetchPortfolioBreakdown = async (accountNames: string[] | null = null) => {
    try {
      const params = new URLSearchParams();
      params.append('file', selectedFile);
      if (accountNames) {
        accountNames.forEach(name => params.append('account_names', name));
      }

      const breakdown = await axios.get(`${apiUrl}/portfolio/breakdown?${params}`);
      setPortfolioData(breakdown.data);

      // Fetch holdings data along with breakdown
      const holdingsParams = new URLSearchParams();
      holdingsParams.append('file', selectedFile);
      if (accountNames) {
        accountNames.forEach(name => holdingsParams.append('account_names', name));
      }

      const holdings = await axios.get(`${apiUrl}/portfolio/holdings?${holdingsParams}`);
      setHoldingsData(holdings.data);

      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch portfolio breakdown');
      setTimeout(() => { setIsLoading(false); }, 300);
    }
  };

  useEffect(() => {
    fetchAvailableFiles();
  }, []);

  useEffect(() => {
    const initializePortfolio = async () => {
      try {
        setIsLoading(true);
        await fetchPortfolioMetadata();
        await fetchPortfolioBreakdown(null);
      } catch (err) {
        console.error(err);
      }
    };

    if (selectedFile) {
      initializePortfolio();
    }
  }, [selectedFile]);

  const handleAccountsChange = (accountNames: string[]) => {
    setSelectedAccounts(accountNames);
    fetchPortfolioBreakdown(accountNames);
  };

  const handleToggleVisibility = () => {
    setIsValueVisible(!isValueVisible);
  };

  const handlePortfolioCreated = async (newFilename: string) => {
    // Refresh available files
    await fetchAvailableFiles();
    // Switch to the new file
    setSelectedFile(newFilename);
  };

  const handleAccountAdded = async () => {
    // Refresh the current portfolio metadata and data
    try {
      setIsLoading(true);
      await fetchPortfolioMetadata();
      await fetchPortfolioBreakdown(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePortfolioDeleted = async (deletedFilename: string) => {
    // Refresh available files
    await fetchAvailableFiles();
    
    // If the deleted portfolio was the selected one, switch to the first available
    if (deletedFilename === selectedFile) {
      const remainingFiles = availableFiles.filter(file => file.filename !== deletedFilename);
      if (remainingFiles.length > 0) {
        setSelectedFile(remainingFiles[0].filename);
      }
    }
  };

  const handleAccountDeleted = async () => {
    // Refresh the current portfolio metadata and data
    try {
      setIsLoading(true);
      await fetchPortfolioMetadata();
      await fetchPortfolioBreakdown(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error) return <div>{error}</div>;
  if (!portfolioMetadata || !portfolioData) return null;

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <AccountSelector
        portfolioMetadata={portfolioMetadata}
        onAccountsChange={handleAccountsChange}
        onToggleVisibility={handleToggleVisibility}
        availableFiles={availableFiles}
        selectedFile={selectedFile}
        onFileChange={setSelectedFile}
        onPortfolioCreated={handlePortfolioCreated}
        onAccountAdded={handleAccountAdded}
        onPortfolioDeleted={handlePortfolioDeleted}
        onAccountDeleted={handleAccountDeleted}
      />
      <PortfolioSummary
        accounts={portfolioMetadata.accounts}
        selectedAccountNames={selectedAccounts}
        baseCurrency={portfolioMetadata.base_currency}
        isValueVisible={isValueVisible}
      />
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {portfolioData.map(chart => (
            <PieChart
              key={chart.chart_title}
              title={`<b>${chart.chart_title}</b>${
                  isValueVisible
                    ? ` <span class="text-xs text-gray-400 ml-1">
                        ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
                          chart.chart_total
                        )}
                        (${portfolioMetadata.base_currency})
                        </span>`
                    : ''
              }`}
              data={chart.chart_data}
              total={chart.chart_total}
              baseCurrency={portfolioMetadata.base_currency}
              hideValues={!isValueVisible}
            />
          ))}
        </div>
        {holdingsData && (
          <div className="mt-8">
            <HoldingsTable
              data={holdingsData}
              isValueVisible={isValueVisible}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;