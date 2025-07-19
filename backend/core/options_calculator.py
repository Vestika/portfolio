"""
Options vesting calculator and valuation logic for private company stock options.
"""
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Any, Optional
import math


class OptionsCalculator:
    """Calculator for options vesting schedules and valuations."""
    
    @staticmethod
    def calculate_vesting_schedule(
        grant_date: str,
        total_units: float,
        vesting_period_years: int,
        vesting_frequency: str,
        has_cliff: bool = False,
        cliff_months: int = 0,
        left_company: bool = False,
        left_company_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate the vesting schedule for options.
        
        Args:
            grant_date: Grant date in YYYY-MM-DD format
            total_units: Total number of options granted
            vesting_period_years: Vesting period in years
            vesting_frequency: 'monthly', 'quarterly', or 'annually'
            has_cliff: Whether there's a cliff period
            cliff_months: Cliff duration in months
            left_company: Whether the employee left the company
            left_company_date: Date when employee left (if applicable)
            
        Returns:
            Dictionary with vesting schedule and calculations
        """
        grant_dt = datetime.strptime(grant_date, "%Y-%m-%d").date()
        now = datetime.now().date()
        
        # Calculate period duration
        if vesting_frequency == "monthly":
            period_months = 1
        elif vesting_frequency == "quarterly":
            period_months = 3
        elif vesting_frequency == "annually":
            period_months = 12
        else:
            period_months = 1
            
        # Calculate total periods
        periods = vesting_period_years * (12 // period_months)
        delta = relativedelta(months=period_months)
        
        # Calculate cliff periods
        cliff_periods = cliff_months // period_months if period_months else 0
        units_per_period = total_units / periods
        
        # Initialize variables
        vested_units = 0
        next_vest_date = None
        next_vest_units = 0
        schedule = []
        
        # Calculate cliff date
        cliff_date = grant_dt + relativedelta(months=cliff_months) if cliff_months else grant_dt
        
        # Handle left company scenario
        if left_company and left_company_date:
            left_dt = datetime.strptime(left_company_date, "%Y-%m-%d").date()
        else:
            left_dt = None
            
        # Calculate vesting schedule
        periods_vested = 0
        
        # Handle cliff period
        for i in range(periods):
            vest_date = grant_dt + delta * i
            if vest_date < cliff_date:
                continue  # Skip periods before cliff
                
            if cliff_months and vest_date == cliff_date:
                # Lump sum for all periods in cliff
                cliff_units = units_per_period * cliff_periods
                schedule.append({"date": vest_date.isoformat(), "units": cliff_units})
                
                if vest_date <= now:
                    vested_units += cliff_units
                elif not next_vest_date:
                    next_vest_date = vest_date
                    next_vest_units = cliff_units
                    
                periods_vested = cliff_periods
                break
                
        # Continue with regular vesting after cliff
        for i in range(periods_vested + 1, periods):
            vest_date = cliff_date + delta * (i - periods_vested)
            
            # Check if employee left before this vest date
            if left_dt and vest_date > left_dt:
                total_units = vested_units
                break
                
            schedule.append({"date": vest_date.isoformat(), "units": units_per_period})
            
            if vest_date <= now:
                vested_units += units_per_period
            elif not next_vest_date:
                next_vest_date = vest_date
                next_vest_units = units_per_period
                
        # Clamp vested units to total
        vested_units = min(vested_units, total_units)
        
        return {
            "vested_units": round(vested_units, 2),
            "next_vest_date": next_vest_date.isoformat() if next_vest_date else None,
            "next_vest_units": round(next_vest_units, 2) if next_vest_units else 0,
            "schedule": schedule,
            "cliff_months": cliff_months,
            "vesting_period_years": vesting_period_years,
            "vesting_frequency": vesting_frequency
        }
    
    @staticmethod
    def calculate_options_value(
        vested_units: float,
        exercise_price: float,
        strike_price: float,
        current_valuation: Optional[float] = None,
        company_valuation: Optional[float] = None,
        option_type: str = "iso"
    ) -> Dict[str, float]:
        """
        Calculate the value of options.
        
        Args:
            vested_units: Number of vested options
            exercise_price: Price to exercise the options
            strike_price: Strike price of the options
            current_valuation: Current company valuation per share
            company_valuation: Total company valuation
            option_type: Type of option ('iso', 'nso', etc.)
            
        Returns:
            Dictionary with various value calculations
        """
        # For private companies, we need to estimate the current share value
        # This is a simplified model - in reality, this would be more complex
        
        if current_valuation is None and company_valuation is not None:
            # Estimate per-share value based on company valuation
            # This is a rough estimate - actual calculation would depend on cap table
            current_valuation = company_valuation / 1000000  # Assume 1M shares for simplicity
            
        if current_valuation is None:
            # Default to strike price if no valuation available
            current_valuation = strike_price
            
        # Calculate intrinsic value (current value - exercise price)
        intrinsic_value_per_share = max(0, current_valuation - exercise_price)
        total_intrinsic_value = vested_units * intrinsic_value_per_share
        
        # Calculate time value (simplified - in reality this would use Black-Scholes)
        # For private company options, time value is typically minimal
        time_value_per_share = max(0, (current_valuation - strike_price) * 0.1)  # 10% of intrinsic value
        total_time_value = vested_units * time_value_per_share
        
        # Total value
        total_value = total_intrinsic_value + total_time_value
        
        return {
            "intrinsic_value_per_share": round(intrinsic_value_per_share, 4),
            "total_intrinsic_value": round(total_intrinsic_value, 2),
            "time_value_per_share": round(time_value_per_share, 4),
            "total_time_value": round(total_time_value, 2),
            "total_value": round(total_value, 2),
            "current_valuation_per_share": round(current_valuation, 4)
        }
    
    @staticmethod
    def calculate_black_scholes_value(
        current_price: float,
        strike_price: float,
        time_to_expiry: float,
        risk_free_rate: float = 0.02,
        volatility: float = 0.3
    ) -> float:
        """
        Calculate Black-Scholes option value (simplified).
        This is a basic implementation for educational purposes.
        
        Args:
            current_price: Current stock price
            strike_price: Strike price
            time_to_expiry: Time to expiry in years
            risk_free_rate: Risk-free interest rate
            volatility: Stock volatility
            
        Returns:
            Option value per share
        """
        if time_to_expiry <= 0:
            return max(0, current_price - strike_price)
            
        # Simplified Black-Scholes calculation
        # In practice, you'd want to use a proper options pricing library
        
        # Calculate d1 and d2
        d1 = (math.log(current_price / strike_price) + 
              (risk_free_rate + 0.5 * volatility**2) * time_to_expiry) / (volatility * math.sqrt(time_to_expiry))
        d2 = d1 - volatility * math.sqrt(time_to_expiry)
        
        # Calculate option value using normal distribution approximation
        # This is a simplified version - real implementation would use proper CDF
        def normal_cdf(x):
            return 0.5 * (1 + math.erf(x / math.sqrt(2)))
            
        option_value = (current_price * normal_cdf(d1) - 
                       strike_price * math.exp(-risk_free_rate * time_to_expiry) * normal_cdf(d2))
        
        return max(0, option_value) 