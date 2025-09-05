"""
RSU vesting calculator for runtime portfolio calculations.
This module provides helper functions to calculate RSU vesting values
without persisting results to the database.
"""
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Any, Optional
import math
from services.closing_price.service import get_global_service
from portfolio_calculator import PortfolioCalculator
from models.portfolio import Portfolio


class RSUCalculator:
    """Calculator for RSU vesting schedules and valuations."""
    
    def __init__(self, portfolio: Portfolio, calculator: PortfolioCalculator):
        self.portfolio = portfolio
        self.calculator = calculator
        self.closing_price_service = get_global_service()
    
    def calculate_rsu_vesting_for_account(self, account: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate RSU vesting for an account and return vesting data.
        This function does NOT update the database.
        
        Args:
            account: Account dictionary containing RSU plans
            
        Returns:
            Dictionary with RSU vesting calculations and virtual holdings
        """
        rsu_plans = account.get("rsu_plans", [])
        if not rsu_plans:
            return {
                "vesting_data": [],
                "virtual_holdings": []
            }
        
        now = datetime.now().date()
        vesting_data = []
        symbol_to_vested = {}
        
        for plan in rsu_plans:
            plan_result = self._calculate_single_rsu_plan(plan, now)
            vesting_data.append(plan_result)
            
            # Aggregate vested units by symbol
            symbol = plan_result["symbol"]
            vested = plan_result["vested_units"]
            symbol_to_vested[symbol] = symbol_to_vested.get(symbol, 0) + math.ceil(vested)
        
        # Create virtual holdings from vested RSUs (no value calculations)
        virtual_holdings = []
        for symbol, units in symbol_to_vested.items():
            if symbol in self.portfolio.securities:
                security = self.portfolio.securities[symbol]
                virtual_holdings.append({
                    "symbol": symbol,
                    "units": units,
                    "currency": self.portfolio.base_currency.value,
                    "name": security.name
                })
            else:
                # Fallback if security not found
                virtual_holdings.append({
                    "symbol": symbol,
                    "units": units,
                    "currency": self.portfolio.base_currency.value,
                    "name": symbol
                })
        
        return {
            "vesting_data": vesting_data,
            "virtual_holdings": virtual_holdings
        }
    
    def _calculate_single_rsu_plan(self, plan: Dict[str, Any], current_date: date) -> Dict[str, Any]:
        """
        Calculate vesting for a single RSU plan.
        
        Args:
            plan: RSU plan dictionary
            current_date: Current date for vesting calculation
            
        Returns:
            Dictionary with vesting calculations
        """
        grant_date = datetime.strptime(plan["grant_date"], "%Y-%m-%d").date()
        
        # Handle early departure
        if plan.get('left_company'):
            left_company_date = datetime.strptime(plan["left_company_date"], "%Y-%m-%d").date()
        else:
            left_company_date = None
        
        cliff_months = plan.get("cliff_duration_months") if plan.get("has_cliff") else 0
        vesting_years = plan["vesting_period_years"]
        vesting_frequency = plan["vesting_frequency"]
        total_units = plan["units"]
        
        # Calculate periods
        if vesting_frequency == "monthly":
            period_months = 1
        elif vesting_frequency == "quarterly":
            period_months = 3
        elif vesting_frequency == "annually":
            period_months = 12
        else:
            period_months = 1
            
        periods = vesting_years * (12 // period_months)
        delta = relativedelta(months=period_months)
        cliff_periods = cliff_months // period_months if period_months else 0
        units_per_period = total_units / periods
        
        # Calculate vesting
        vested_units = 0
        next_vest_date = None
        next_vest_units = 0
        schedule = []
        cliff_date = grant_date + relativedelta(months=cliff_months) if cliff_months else grant_date
        
        # Handle cliff vesting
        periods_vested = 0
        for i in range(periods):
            vest_date = grant_date + delta * i
            if vest_date < cliff_date:
                continue  # skip periods before cliff
            if cliff_months and vest_date == cliff_date:
                # Lump sum for all periods in cliff
                cliff_units = units_per_period * cliff_periods
                schedule.append({"date": vest_date.isoformat(), "units": cliff_units})
                if vest_date <= current_date:
                    vested_units += cliff_units
                elif not next_vest_date:
                    next_vest_date = vest_date
                    next_vest_units = cliff_units
                periods_vested = cliff_periods
                break
        
        # Continue with regular vesting after cliff
        for i in range(periods_vested + 1, periods):
            vest_date = cliff_date + delta * (i - periods_vested)
            if left_company_date and vest_date > left_company_date:
                total_units = vested_units
                break
            schedule.append({"date": vest_date.isoformat(), "units": units_per_period})
            if vest_date <= current_date:
                vested_units += units_per_period
            elif not next_vest_date:
                next_vest_date = vest_date
                next_vest_units = units_per_period
        
        # Clamp vested units to total
        vested_units = min(vested_units, total_units)
        
        symbol = plan["symbol"]
        
        # Get currency from security if available
        security = self.portfolio.securities.get(symbol)
        price_currency = security.currency.value if security else 'USD'
        
        return {
            "id": plan["id"],
            "symbol": symbol,
            "total_units": total_units,
            "vested_units": round(vested_units, 2),
            "next_vest_date": next_vest_date.isoformat() if next_vest_date else None,
            "next_vest_units": round(next_vest_units, 2) if next_vest_units else 0,
            "schedule": schedule,
            "grant_date": plan["grant_date"],
            "cliff_months": cliff_months,
            "vesting_period_years": vesting_years,
            "vesting_frequency": vesting_frequency,
            "price_currency": price_currency
        }
    
    def get_rsu_holdings_for_portfolio_calculation(self) -> List[Dict[str, Any]]:
        """
        Get all RSU holdings across all accounts for portfolio calculation.
        This returns virtual holdings that should be included in portfolio calculations.
        
        Returns:
            List of virtual holdings from RSU vesting
        """
        all_virtual_holdings = []
        
        for account in self.portfolio.accounts:
            # Check if account has RSU plans
            if hasattr(account, 'rsu_plans') and account.rsu_plans:
                account_dict = {
                    "name": account.name,
                    "rsu_plans": account.rsu_plans
                }
                rsu_result = self.calculate_rsu_vesting_for_account(account_dict)
                all_virtual_holdings.extend(rsu_result["virtual_holdings"])
        
        return all_virtual_holdings


def create_rsu_calculator(portfolio: Portfolio, calculator: PortfolioCalculator) -> RSUCalculator:
    """
    Factory function to create an RSU calculator instance.
    
    Args:
        portfolio: Portfolio instance
        calculator: PortfolioCalculator instance
        
    Returns:
        RSUCalculator instance
    """
    return RSUCalculator(portfolio, calculator)
