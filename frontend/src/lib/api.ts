export interface Asset {
  symbol: string;
  shares: number;
}

export interface Portfolio {
  id: string;
  name: string;
  assets: Asset[];
  createdAt: string;
  updatedAt: string;
}

export async function listPortfolios(): Promise<Portfolio[]> {
  const res = await fetch(`/portfolios`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch portfolios');
  return res.json();
}

export async function getPortfolio(portfolioId: string): Promise<Portfolio> {
  const res = await fetch(`/portfolios/${portfolioId}`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch portfolio');
  return res.json();
}

export async function createPortfolio(data: Omit<Portfolio, 'id'>): Promise<Portfolio> {
  const res = await fetch(`/portfolios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create portfolio');
  return res.json();
}

export async function updatePortfolio(portfolioId: string, data: Partial<Omit<Portfolio, 'id'>>): Promise<Portfolio> {
  const res = await fetch(`/portfolios/${portfolioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update portfolio');
  return res.json();
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
  const res = await fetch(`/portfolios/${portfolioId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete portfolio');
} 