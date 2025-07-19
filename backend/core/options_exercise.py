"""
Options exercise functionality for managing option exercises and conversions.
"""
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from decimal import Decimal


class OptionsExercise:
    """Handles options exercise calculations and operations."""
    
    @staticmethod
    def calculate_exercise_cost(
        units_to_exercise: float,
        exercise_price: float,
        current_valuation: Optional[float] = None,
        company_valuation: Optional[float] = None
    ) -> Dict[str, float]:
        """
        Calculate the cost to exercise options.
        
        Args:
            units_to_exercise: Number of options to exercise
            exercise_price: Price per option to exercise
            current_valuation: Current company valuation per share
            company_valuation: Total company valuation
            
        Returns:
            Dictionary with exercise cost calculations
        """
        # Calculate total exercise cost
        total_exercise_cost = units_to_exercise * exercise_price
        
        # Calculate potential value if we have valuation data
        if current_valuation is None and company_valuation is not None:
            # Estimate per-share value based on company valuation
            current_valuation = company_valuation / 1000000  # Assume 1M shares for simplicity
            
        potential_value = 0.0
        if current_valuation is not None:
            potential_value = units_to_exercise * current_valuation
            
        # Calculate net gain/loss
        net_gain = potential_value - total_exercise_cost
        
        return {
            "units_to_exercise": units_to_exercise,
            "exercise_price_per_unit": exercise_price,
            "total_exercise_cost": round(total_exercise_cost, 2),
            "current_valuation_per_share": current_valuation or 0.0,
            "potential_value": round(potential_value, 2),
            "net_gain": round(net_gain, 2),
            "roi_percentage": round((net_gain / total_exercise_cost * 100) if total_exercise_cost > 0 else 0, 2)
        }
    
    @staticmethod
    def calculate_tax_implications(
        units_to_exercise: float,
        exercise_price: float,
        current_valuation: float,
        option_type: str = "iso",
        holding_period_years: float = 0.0
    ) -> Dict[str, float]:
        """
        Calculate tax implications of exercising options.
        
        Args:
            units_to_exercise: Number of options to exercise
            exercise_price: Price per option to exercise
            current_valuation: Current company valuation per share
            option_type: Type of option ('iso', 'nso', etc.)
            holding_period_years: How long the options have been held
            
        Returns:
            Dictionary with tax calculations
        """
        # Calculate spread (difference between current value and exercise price)
        spread_per_unit = current_valuation - exercise_price
        total_spread = units_to_exercise * spread_per_unit
        
        # Tax calculations depend on option type and holding period
        if option_type.lower() == "iso":
            # Incentive Stock Options have special tax treatment
            if holding_period_years >= 2:
                # Qualifying disposition - capital gains treatment
                capital_gains_tax_rate = 0.15  # Simplified - actual rate depends on income
                capital_gains_tax = total_spread * capital_gains_tax_rate
                ordinary_income_tax = 0.0
            else:
                # Disqualifying disposition - ordinary income treatment
                ordinary_income_tax_rate = 0.22  # Simplified - actual rate depends on income
                ordinary_income_tax = total_spread * ordinary_income_tax_rate
                capital_gains_tax = 0.0
        else:
            # Non-qualified Stock Options - always ordinary income
            ordinary_income_tax_rate = 0.22  # Simplified - actual rate depends on income
            ordinary_income_tax = total_spread * ordinary_income_tax_rate
            capital_gains_tax = 0.0
        
        total_tax = ordinary_income_tax + capital_gains_tax
        after_tax_value = total_spread - total_tax
        
        return {
            "spread_per_unit": round(spread_per_unit, 4),
            "total_spread": round(total_spread, 2),
            "ordinary_income_tax": round(ordinary_income_tax, 2),
            "capital_gains_tax": round(capital_gains_tax, 2),
            "total_tax": round(total_tax, 2),
            "after_tax_value": round(after_tax_value, 2),
            "effective_tax_rate": round((total_tax / total_spread * 100) if total_spread > 0 else 0, 2)
        }
    
    @staticmethod
    def create_exercise_plan(
        options_plan: Dict[str, Any],
        units_to_exercise: float,
        exercise_date: str,
        current_valuation: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Create a comprehensive exercise plan for options.
        
        Args:
            options_plan: The options plan to exercise from
            units_to_exercise: Number of options to exercise
            exercise_date: Date of exercise (YYYY-MM-DD)
            current_valuation: Current company valuation per share
            
        Returns:
            Dictionary with complete exercise plan
        """
        # Validate exercise amount
        if units_to_exercise > options_plan["units"]:
            raise ValueError(f"Cannot exercise {units_to_exercise} units from plan with {options_plan['units']} total units")
        
        # Calculate exercise cost
        exercise_cost = OptionsExercise.calculate_exercise_cost(
            units_to_exercise=units_to_exercise,
            exercise_price=options_plan["exercise_price"],
            current_valuation=current_valuation,
            company_valuation=options_plan.get("company_valuation")
        )
        
        # Calculate tax implications
        tax_implications = OptionsExercise.calculate_tax_implications(
            units_to_exercise=units_to_exercise,
            exercise_price=options_plan["exercise_price"],
            current_valuation=exercise_cost["current_valuation_per_share"],
            option_type=options_plan.get("option_type", "iso"),
            holding_period_years=0.0  # Would need to calculate from grant date
        )
        
        # Calculate remaining options
        remaining_units = options_plan["units"] - units_to_exercise
        
        return {
            "exercise_date": exercise_date,
            "options_plan_id": options_plan["id"],
            "symbol": options_plan["symbol"],
            "units_exercised": units_to_exercise,
            "remaining_units": remaining_units,
            "exercise_cost": exercise_cost,
            "tax_implications": tax_implications,
            "total_cash_outlay": exercise_cost["total_exercise_cost"],
            "net_after_tax_value": tax_implications["after_tax_value"],
            "exercise_roi": exercise_cost["roi_percentage"]
        }
    
    @staticmethod
    def calculate_optimal_exercise_strategy(
        options_plan: Dict[str, Any],
        available_cash: float,
        risk_tolerance: str = "moderate"
    ) -> Dict[str, Any]:
        """
        Calculate optimal exercise strategy based on available cash and risk tolerance.
        
        Args:
            options_plan: The options plan to analyze
            available_cash: Available cash for exercise
            risk_tolerance: Risk tolerance level ('conservative', 'moderate', 'aggressive')
            
        Returns:
            Dictionary with exercise strategy recommendations
        """
        vested_units = options_plan.get("vested_units", 0)
        exercise_price = options_plan["exercise_price"]
        
        # Calculate maximum units that can be exercised with available cash
        max_affordable_units = available_cash / exercise_price if exercise_price > 0 else 0
        
        # Calculate exercise amounts based on risk tolerance
        if risk_tolerance == "conservative":
            # Exercise 25% of vested units or max affordable, whichever is less
            recommended_units = min(vested_units * 0.25, max_affordable_units)
        elif risk_tolerance == "moderate":
            # Exercise 50% of vested units or max affordable, whichever is less
            recommended_units = min(vested_units * 0.5, max_affordable_units)
        else:  # aggressive
            # Exercise 75% of vested units or max affordable, whichever is less
            recommended_units = min(vested_units * 0.75, max_affordable_units)
        
        # Ensure we don't exceed vested units
        recommended_units = min(recommended_units, vested_units)
        
        # Calculate exercise plan
        exercise_plan = OptionsExercise.create_exercise_plan(
            options_plan=options_plan,
            units_to_exercise=recommended_units,
            exercise_date=datetime.now().strftime("%Y-%m-%d")
        )
        
        return {
            "risk_tolerance": risk_tolerance,
            "available_cash": available_cash,
            "vested_units": vested_units,
            "max_affordable_units": round(max_affordable_units, 2),
            "recommended_units": round(recommended_units, 2),
            "recommended_exercise_plan": exercise_plan,
            "cash_remaining": round(available_cash - exercise_plan["total_cash_outlay"], 2),
            "unvested_units": options_plan["units"] - vested_units
        } 