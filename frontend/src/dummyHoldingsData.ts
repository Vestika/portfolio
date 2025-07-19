import { HoldingsTableData } from './types';

export const dummyHoldingsData: HoldingsTableData = {
  base_currency: "USD",
  holdings: [
    {
      symbol: "AAPL",
      security_type: "stock",
      name: "Apple Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 150,
      original_price: 150.00,
      original_currency: "USD",
      value_per_unit: 175.50,
      total_value: 28500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 190.50 },
        { date: "2024-01-08", price: 168.20 },
        { date: "2024-01-01", price: 162.80 }
      ],
      account_breakdown: [
        {
          account_name: "Brokerage Account",
          account_type: "brokerage",
          units: 150,
          value: 28500.00,
          owners: ["John Doe"]
        }
      ]
    },
    {
      symbol: "MSFT",
      security_type: "stock",
      name: "Microsoft Corporation",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 80,
      original_price: 280.00,
      original_currency: "USD",
      value_per_unit: 320.75,
      total_value: 22500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 335.75 },
        { date: "2024-01-08", price: 315.40 },
        { date: "2024-01-01", price: 308.90 }
      ],
      account_breakdown: [
        {
          account_name: "Brokerage Account",
          account_type: "brokerage",
          units: 80,
          value: 22500.00,
          owners: ["John Doe"]
        }
      ]
    },
    {
      symbol: "GOOGL",
      security_type: "stock",
      name: "Alphabet Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 45,
      original_price: 120.00,
      original_currency: "USD",
      value_per_unit: 142.30,
      total_value: 8500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 148.30 },
        { date: "2024-01-08", price: 138.90 },
        { date: "2024-01-01", price: 135.20 }
      ],
      account_breakdown: [
        {
          account_name: "Brokerage Account",
          account_type: "brokerage",
          units: 45,
          value: 8500.00,
          owners: ["John Doe"]
        }
      ]
    },
    {
      symbol: "TSLA",
      security_type: "stock",
      name: "Tesla, Inc.",
      tags: {
        sector: "Automotive",
        market_cap: "Large Cap"
      },
      total_units: 60,
      original_price: 200.00,
      original_currency: "USD",
      value_per_unit: 185.20,
      total_value: 12500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 185.20 },
        { date: "2024-01-08", price: 192.50 },
        { date: "2024-01-01", price: 198.30 }
      ],
      account_breakdown: [
        {
          account_name: "Brokerage Account",
          account_type: "brokerage",
          units: 60,
          value: 12500.00,
          owners: ["John Doe"]
        }
      ]
    },
    {
      symbol: "AMZN",
      security_type: "stock",
      name: "Amazon.com, Inc.",
      tags: {
        sector: "Consumer Discretionary",
        market_cap: "Large Cap"
      },
      total_units: 35,
      original_price: 130.00,
      original_currency: "USD",
      value_per_unit: 155.80,
      total_value: 7200.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 155.80 },
        { date: "2024-01-08", price: 148.90 },
        { date: "2024-01-01", price: 142.60 }
      ]
    },
    {
      symbol: "NVDA",
      security_type: "stock",
      name: "NVIDIA Corporation",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 25,
      original_price: 400.00,
      original_currency: "USD",
      value_per_unit: 485.60,
      total_value: 15000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 450.60 },
        { date: "2024-01-08", price: 472.30 },
        { date: "2024-01-01", price: 458.90 }
      ]
    },
    {
      symbol: "META",
      security_type: "stock",
      name: "Meta Platforms, Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 40,
      original_price: 250.00,
      original_currency: "USD",
      value_per_unit: 298.40,
      total_value: 13500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 230.40 },
        { date: "2024-01-08", price: 285.70 },
        { date: "2024-01-01", price: 272.10 }
      ]
    },
    {
      symbol: "NFLX",
      security_type: "stock",
      name: "Netflix, Inc.",
      tags: {
        sector: "Communication Services",
        market_cap: "Large Cap"
      },
      total_units: 30,
      original_price: 350.00,
      original_currency: "USD",
      value_per_unit: 325.90,
      total_value: 11000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 333.90 },
        { date: "2024-01-08", price: 338.20 },
        { date: "2024-01-01", price: 345.60 }
      ]
    },
    {
      symbol: "JPM",
      security_type: "stock",
      name: "JPMorgan Chase & Co.",
      tags: {
        sector: "Financial Services",
        market_cap: "Large Cap"
      },
      total_units: 70,
      original_price: 140.00,
      original_currency: "USD",
      value_per_unit: 152.30,
      total_value: 11500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 152.30 },
        { date: "2024-01-08", price: 149.80 },
        { date: "2024-01-01", price: 147.20 }
      ]
    },
    {
      symbol: "JNJ",
      security_type: "stock",
      name: "Johnson & Johnson",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 55,
      original_price: 160.00,
      original_currency: "USD",
      value_per_unit: 168.90,
      total_value: 10500.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 168.90 },
        { date: "2024-01-08", price: 165.40 },
        { date: "2024-01-01", price: 162.80 }
      ]
    },
    {
      symbol: "V",
      security_type: "stock",
      name: "Visa Inc.",
      tags: {
        sector: "Financial Services",
        market_cap: "Large Cap"
      },
      total_units: 40,
      original_price: 220.00,
      original_currency: "USD",
      value_per_unit: 245.60,
      total_value: 12000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 245.60 },
        { date: "2024-01-08", price: 238.90 },
        { date: "2024-01-01", price: 232.40 }
      ]
    },
    {
      symbol: "WMT",
      security_type: "stock",
      name: "Walmart Inc.",
      tags: {
        sector: "Consumer Staples",
        market_cap: "Large Cap"
      },
      total_units: 65,
      original_price: 140.00,
      original_currency: "USD",
      value_per_unit: 158.30,
      total_value: 13000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 158.30 },
        { date: "2024-01-08", price: 152.80 },
        { date: "2024-01-01", price: 148.90 }
      ]
    },
    {
      symbol: "PG",
      security_type: "stock",
      name: "Procter & Gamble Co.",
      tags: {
        sector: "Consumer Staples",
        market_cap: "Large Cap"
      },
      total_units: 45,
      original_price: 150.00,
      original_currency: "USD",
      value_per_unit: 162.40,
      total_value: 9000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 162.40 },
        { date: "2024-01-08", price: 158.20 },
        { date: "2024-01-01", price: 155.60 }
      ]
    },
    {
      symbol: "UNH",
      security_type: "stock",
      name: "UnitedHealth Group Inc.",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 25,
      original_price: 480.00,
      original_currency: "USD",
      value_per_unit: 445.20,
      total_value: 14000.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 445.20 },
        { date: "2024-01-08", price: 462.80 },
        { date: "2024-01-01", price: 478.90 }
      ]
    },
    {
      symbol: "HD",
      security_type: "stock",
      name: "Home Depot Inc.",
      tags: {
        sector: "Consumer Discretionary",
        market_cap: "Large Cap"
      },
      total_units: 35,
      original_price: 320.00,
      original_currency: "USD",
      value_per_unit: 298.60,
      total_value: 10451.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 298.60 },
        { date: "2024-01-08", price: 312.40 },
        { date: "2024-01-01", price: 325.80 }
      ]
    },
    {
      symbol: "MA",
      security_type: "stock",
      name: "Mastercard Inc.",
      tags: {
        sector: "Financial Services",
        market_cap: "Large Cap"
      },
      total_units: 30,
      original_price: 380.00,
      original_currency: "USD",
      value_per_unit: 425.80,
      total_value: 12774.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 425.80 },
        { date: "2024-01-08", price: 412.30 },
        { date: "2024-01-01", price: 398.90 }
      ]
    },
    {
      symbol: "DIS",
      security_type: "stock",
      name: "Walt Disney Co.",
      tags: {
        sector: "Communication Services",
        market_cap: "Large Cap"
      },
      total_units: 80,
      original_price: 90.00,
      original_currency: "USD",
      value_per_unit: 78.40,
      total_value: 6272.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 78.40 },
        { date: "2024-01-08", price: 82.60 },
        { date: "2024-01-01", price: 85.20 }
      ]
    },
    {
      symbol: "PYPL",
      security_type: "stock",
      name: "PayPal Holdings Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 60,
      original_price: 180.00,
      original_currency: "USD",
      value_per_unit: 145.30,
      total_value: 8718.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 145.30 },
        { date: "2024-01-08", price: 158.90 },
        { date: "2024-01-01", price: 172.40 }
      ]
    },
    {
      symbol: "CRM",
      security_type: "stock",
      name: "Salesforce Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 40,
      original_price: 200.00,
      original_currency: "USD",
      value_per_unit: 235.60,
      total_value: 9424.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 235.60 },
        { date: "2024-01-08", price: 228.40 },
        { date: "2024-01-01", price: 218.90 }
      ]
    },
    {
      symbol: "ABT",
      security_type: "stock",
      name: "Abbott Laboratories",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 50,
      original_price: 110.00,
      original_currency: "USD",
      value_per_unit: 118.90,
      total_value: 5945.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 118.90 },
        { date: "2024-01-08", price: 115.60 },
        { date: "2024-01-01", price: 112.80 }
      ]
    },
    {
      symbol: "KO",
      security_type: "stock",
      name: "Coca-Cola Co.",
      tags: {
        sector: "Consumer Staples",
        market_cap: "Large Cap"
      },
      total_units: 70,
      original_price: 55.00,
      original_currency: "USD",
      value_per_unit: 58.40,
      total_value: 4088.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 58.40 },
        { date: "2024-01-08", price: 56.80 },
        { date: "2024-01-01", price: 55.20 }
      ]
    },
    {
      symbol: "PEP",
      security_type: "stock",
      name: "PepsiCo Inc.",
      tags: {
        sector: "Consumer Staples",
        market_cap: "Large Cap"
      },
      total_units: 45,
      original_price: 170.00,
      original_currency: "USD",
      value_per_unit: 182.30,
      total_value: 8203.50,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 182.30 },
        { date: "2024-01-08", price: 178.90 },
        { date: "2024-01-01", price: 175.60 }
      ]
    },
    {
      symbol: "TMO",
      security_type: "stock",
      name: "Thermo Fisher Scientific Inc.",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 20,
      original_price: 450.00,
      original_currency: "USD",
      value_per_unit: 485.60,
      total_value: 9712.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 485.60 },
        { date: "2024-01-08", price: 472.30 },
        { date: "2024-01-01", price: 458.90 }
      ]
    },
    {
      symbol: "COST",
      security_type: "stock",
      name: "Costco Wholesale Corp.",
      tags: {
        sector: "Consumer Staples",
        market_cap: "Large Cap"
      },
      total_units: 25,
      original_price: 480.00,
      original_currency: "USD",
      value_per_unit: 525.80,
      total_value: 13145.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 525.80 },
        { date: "2024-01-08", price: 512.40 },
        { date: "2024-01-01", price: 498.90 }
      ]
    },
    {
      symbol: "AVGO",
      security_type: "stock",
      name: "Broadcom Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 30,
      original_price: 600.00,
      original_currency: "USD",
      value_per_unit: 685.40,
      total_value: 20562.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 685.40 },
        { date: "2024-01-08", price: 672.80 },
        { date: "2024-01-01", price: 658.90 }
      ]
    },
    {
      symbol: "ACN",
      security_type: "stock",
      name: "Accenture PLC",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 35,
      original_price: 280.00,
      original_currency: "USD",
      value_per_unit: 298.60,
      total_value: 10451.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 298.60 },
        { date: "2024-01-08", price: 285.40 },
        { date: "2024-01-01", price: 272.80 }
      ]
    },
    {
      symbol: "DHR",
      security_type: "stock",
      name: "Danaher Corp.",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 25,
      original_price: 220.00,
      original_currency: "USD",
      value_per_unit: 198.40,
      total_value: 4960.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 198.40 },
        { date: "2024-01-08", price: 212.60 },
        { date: "2024-01-01", price: 225.80 }
      ]
    },
    {
      symbol: "LLY",
      security_type: "stock",
      name: "Eli Lilly and Co.",
      tags: {
        sector: "Healthcare",
        market_cap: "Large Cap"
      },
      total_units: 20,
      original_price: 400.00,
      original_currency: "USD",
      value_per_unit: 485.60,
      total_value: 9712.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 485.60 },
        { date: "2024-01-08", price: 472.30 },
        { date: "2024-01-01", price: 458.90 }
      ]
    },
    {
      symbol: "VZ",
      security_type: "stock",
      name: "Verizon Communications Inc.",
      tags: {
        sector: "Communication Services",
        market_cap: "Large Cap"
      },
      total_units: 120,
      original_price: 40.00,
      original_currency: "USD",
      value_per_unit: 35.80,
      total_value: 4296.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 35.80 },
        { date: "2024-01-08", price: 38.40 },
        { date: "2024-01-01", price: 41.20 }
      ]
    },
    {
      symbol: "CMCSA",
      security_type: "stock",
      name: "Comcast Corp.",
      tags: {
        sector: "Communication Services",
        market_cap: "Large Cap"
      },
      total_units: 80,
      original_price: 45.00,
      original_currency: "USD",
      value_per_unit: 42.30,
      total_value: 3384.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 42.30 },
        { date: "2024-01-08", price: 44.80 },
        { date: "2024-01-01", price: 47.20 }
      ]
    },
    {
      symbol: "ADBE",
      security_type: "stock",
      name: "Adobe Inc.",
      tags: {
        sector: "Technology",
        market_cap: "Large Cap"
      },
      total_units: 35,
      original_price: 380.00,
      original_currency: "USD",
      value_per_unit: 425.60,
      total_value: 14896.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 425.60 },
        { date: "2024-01-08", price: 412.30 },
        { date: "2024-01-01", price: 398.90 }
      ]
    },
    {
      symbol: "NKE",
      security_type: "stock",
      name: "Nike Inc.",
      tags: {
        sector: "Consumer Discretionary",
        market_cap: "Large Cap"
      },
      total_units: 60,
      original_price: 120.00,
      original_currency: "USD",
      value_per_unit: 108.40,
      total_value: 6504.00,
      currency: "USD",
      price_source: "yahoo",
      historical_prices: [
        { date: "2024-01-15", price: 108.40 },
        { date: "2024-01-08", price: 115.60 },
        { date: "2024-01-01", price: 122.80 }
      ]
    }
  ]
}; 