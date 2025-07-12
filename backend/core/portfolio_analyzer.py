import logging
from typing import Dict, Any, List, Optional
from decimal import Decimal
from collections import defaultdict

from models.portfolio import Portfolio
from models.security_type import SecurityType
from portfolio_calculator import PortfolioCalculator
from services.closing_price.service import get_global_service

logger = logging.getLogger(__name__)

class PortfolioAnalyzer:
    """Portfolio data preprocessing and analysis for AI integration"""
    
    def __init__(self):
        self.closing_price_service = get_global_service()
    
    def analyze_portfolio_for_ai(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> Dict[str, Any]:
        """Comprehensive portfolio analysis for AI consumption"""
        try:
            # Calculate total portfolio value
            total_value = self._calculate_total_portfolio_value(portfolio, calculator)
            
            # Get detailed account analysis
            accounts_analysis = self._analyze_accounts(portfolio, calculator)
            
            # Get holdings breakdown
            holdings_breakdown = self._analyze_holdings(portfolio, calculator)
            
            # Get asset allocation
            asset_allocation = self._analyze_asset_allocation(portfolio, calculator)
            
            # Get geographical distribution
            geographical_distribution = self._analyze_geographical_distribution(portfolio, calculator)
            
            # Get sector distribution
            sector_distribution = self._analyze_sector_distribution(portfolio, calculator)
            
            # Calculate risk metrics
            risk_metrics = self._calculate_risk_metrics(portfolio, calculator)
            
            # Get concentration analysis
            concentration_analysis = self._analyze_concentration(portfolio, calculator)
            
            return {
                "total_value": total_value,
                "base_currency": portfolio.base_currency.value,
                "accounts": accounts_analysis,
                "holdings_breakdown": holdings_breakdown,
                "asset_allocation": asset_allocation,
                "geographical_distribution": geographical_distribution,
                "sector_distribution": sector_distribution,
                "risk_metrics": risk_metrics,
                "concentration_analysis": concentration_analysis,
                "total_holdings": len(portfolio.securities),
                "total_accounts": len(portfolio.accounts)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing portfolio for AI: {e}")
            raise
    
    def _calculate_total_portfolio_value(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> float:
        """Calculate total portfolio value across all accounts"""
        total_value = 0.0
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
        
        return round(total_value, 2)
    
    def _analyze_accounts(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> List[Dict[str, Any]]:
        """Analyze each account in the portfolio"""
        accounts_analysis = []
        
        for account in portfolio.accounts:
            account_value = 0.0
            account_holdings = []
            
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    account_value += holding_value["total"]
                    
                    account_holdings.append({
                        "symbol": holding.symbol,
                        "units": holding.units,
                        "value": holding_value["total"],
                        "security_name": security.name,
                        "security_type": security.security_type.value
                    })
            
            accounts_analysis.append({
                "account_name": account.name,
                "account_value": round(account_value, 2),
                "holdings_count": len(account_holdings),
                "holdings": account_holdings,
                "account_type": account.properties.get("type", "bank-account"),
                "owners": account.properties.get("owners", ["me"])
            })
        
        return accounts_analysis
    
    def _analyze_holdings(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> List[Dict[str, Any]]:
        """Analyze individual holdings across the portfolio"""
        holdings_aggregated = defaultdict(lambda: {"units": 0, "value": 0.0})
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    
                    holdings_aggregated[holding.symbol]["units"] += holding.units
                    holdings_aggregated[holding.symbol]["value"] += holding_value["total"]
                    holdings_aggregated[holding.symbol]["security"] = security
        
        holdings_breakdown = []
        for symbol, data in holdings_aggregated.items():
            holdings_breakdown.append({
                "symbol": symbol,
                "units": data["units"],
                "value": round(data["value"], 2),
                "security_name": data["security"].name,
                "security_type": data["security"].security_type.value,
                "tags": data["security"].tags or {}
            })
        
        # Sort by value descending
        holdings_breakdown.sort(key=lambda x: x["value"], reverse=True)
        return holdings_breakdown
    
    def _analyze_asset_allocation(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> List[Dict[str, Any]]:
        """Analyze asset allocation by security type"""
        asset_allocation = defaultdict(lambda: {"value": 0.0, "holdings": []})
        total_value = 0.0
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
                    
                    asset_type = security.security_type.value
                    asset_allocation[asset_type]["value"] += holding_value["total"]
                    asset_allocation[asset_type]["holdings"].append({
                        "symbol": holding.symbol,
                        "value": holding_value["total"]
                    })
        
        # Convert to list format with percentages
        allocation_list = []
        for asset_type, data in asset_allocation.items():
            percentage = (data["value"] / total_value * 100) if total_value > 0 else 0
            allocation_list.append({
                "asset_type": asset_type,
                "value": round(data["value"], 2),
                "percentage": round(percentage, 2),
                "holdings_count": len(data["holdings"])
            })
        
        # Sort by value descending
        allocation_list.sort(key=lambda x: x["value"], reverse=True)
        return allocation_list
    
    def _analyze_geographical_distribution(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> List[Dict[str, Any]]:
        """Analyze geographical distribution based on security tags"""
        geographical_distribution = defaultdict(lambda: {"value": 0.0, "holdings": []})
        total_value = 0.0
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
                    
                    # Extract geographical information from tags
                    geo_tag = security.tags.get("geographical", "Unknown") if security.tags else "Unknown"
                    geographical_distribution[geo_tag]["value"] += holding_value["total"]
                    geographical_distribution[geo_tag]["holdings"].append({
                        "symbol": holding.symbol,
                        "value": holding_value["total"]
                    })
        
        # Convert to list format with percentages
        geo_list = []
        for geo, data in geographical_distribution.items():
            percentage = (data["value"] / total_value * 100) if total_value > 0 else 0
            geo_list.append({
                "geographical_region": geo,
                "value": round(data["value"], 2),
                "percentage": round(percentage, 2),
                "holdings_count": len(data["holdings"])
            })
        
        # Sort by value descending
        geo_list.sort(key=lambda x: x["value"], reverse=True)
        return geo_list
    
    def _analyze_sector_distribution(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> List[Dict[str, Any]]:
        """Analyze sector distribution based on security tags"""
        sector_distribution = defaultdict(lambda: {"value": 0.0, "holdings": []})
        total_value = 0.0
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
                    
                    # Extract sector information from tags
                    sector_tag = security.tags.get("sector", "Unknown") if security.tags else "Unknown"
                    sector_distribution[sector_tag]["value"] += holding_value["total"]
                    sector_distribution[sector_tag]["holdings"].append({
                        "symbol": holding.symbol,
                        "value": holding_value["total"]
                    })
        
        # Convert to list format with percentages
        sector_list = []
        for sector, data in sector_distribution.items():
            percentage = (data["value"] / total_value * 100) if total_value > 0 else 0
            sector_list.append({
                "sector": sector,
                "value": round(data["value"], 2),
                "percentage": round(percentage, 2),
                "holdings_count": len(data["holdings"])
            })
        
        # Sort by value descending
        sector_list.sort(key=lambda x: x["value"], reverse=True)
        return sector_list
    
    def _calculate_risk_metrics(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> Dict[str, Any]:
        """Calculate basic risk metrics"""
        total_value = 0.0
        holding_values = []
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
                    holding_values.append(holding_value["total"])
        
        # Calculate concentration metrics
        if holding_values:
            max_holding_value = max(holding_values)
            concentration_ratio = (max_holding_value / total_value * 100) if total_value > 0 else 0
            
            # Count holdings by value ranges
            large_holdings = sum(1 for v in holding_values if v > total_value * 0.05)  # >5%
            medium_holdings = sum(1 for v in holding_values if total_value * 0.01 < v <= total_value * 0.05)  # 1-5%
            small_holdings = sum(1 for v in holding_values if v <= total_value * 0.01)  # ≤1%
            
            return {
                "total_value": round(total_value, 2),
                "holdings_count": len(holding_values),
                "largest_holding_value": round(max_holding_value, 2),
                "concentration_ratio": round(concentration_ratio, 2),
                "large_holdings_count": large_holdings,
                "medium_holdings_count": medium_holdings,
                "small_holdings_count": small_holdings,
                "average_holding_value": round(total_value / len(holding_values), 2) if holding_values else 0
            }
        
        return {
            "total_value": 0,
            "holdings_count": 0,
            "largest_holding_value": 0,
            "concentration_ratio": 0,
            "large_holdings_count": 0,
            "medium_holdings_count": 0,
            "small_holdings_count": 0,
            "average_holding_value": 0
        }
    
    def _analyze_concentration(self, portfolio: Portfolio, calculator: PortfolioCalculator) -> Dict[str, Any]:
        """Analyze portfolio concentration risks"""
        total_value = 0.0
        symbol_values = defaultdict(float)
        
        for account in portfolio.accounts:
            for holding in account.holdings:
                if holding.symbol in portfolio.securities:
                    security = portfolio.securities[holding.symbol]
                    holding_value = calculator.calc_holding_value(security, holding.units)
                    total_value += holding_value["total"]
                    symbol_values[holding.symbol] += holding_value["total"]
        
        # Calculate concentration metrics
        if symbol_values:
            # Top holdings by value
            sorted_symbols = sorted(symbol_values.items(), key=lambda x: x[1], reverse=True)
            top_holdings = []
            
            for symbol, value in sorted_symbols[:10]:  # Top 10 holdings
                percentage = (value / total_value * 100) if total_value > 0 else 0
                top_holdings.append({
                    "symbol": symbol,
                    "value": round(value, 2),
                    "percentage": round(percentage, 2)
                })
            
            # Concentration risk assessment
            top_5_percentage = sum(h["percentage"] for h in top_holdings[:5])
            top_10_percentage = sum(h["percentage"] for h in top_holdings[:10])
            
            concentration_risk = "Low"
            if top_5_percentage > 70:
                concentration_risk = "High"
            elif top_5_percentage > 50:
                concentration_risk = "Medium"
            
            return {
                "top_holdings": top_holdings,
                "top_5_percentage": round(top_5_percentage, 2),
                "top_10_percentage": round(top_10_percentage, 2),
                "concentration_risk": concentration_risk,
                "total_unique_symbols": len(symbol_values)
            }
        
        return {
            "top_holdings": [],
            "top_5_percentage": 0,
            "top_10_percentage": 0,
            "concentration_risk": "Unknown",
            "total_unique_symbols": 0
        }

# Global portfolio analyzer instance
portfolio_analyzer = PortfolioAnalyzer() 