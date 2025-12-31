"""
Analytics event names and property builders.

Event Naming Convention:
- Use Title Case (e.g., "Portfolio Created")
- Use past tense for completed actions
- Use noun + verb structure
- Be specific but concise

Property Naming Convention:
- Use snake_case (e.g., "portfolio_id")
- Include IDs for all entities
- Include counts for collections
- Include relevant metadata
"""

from typing import Dict, Any, Optional
from urllib.parse import urlparse


# ============================================================================
# EVENT NAME CONSTANTS
# ============================================================================

# Portfolio Operations
EVENT_PORTFOLIO_CREATED = "Portfolio Created"
EVENT_PORTFOLIO_DELETED = "Portfolio Deleted"
EVENT_PORTFOLIO_UPDATED = "Portfolio Updated"
EVENT_PORTFOLIO_VIEWED = "Portfolio Viewed"
EVENT_PORTFOLIO_DOWNLOADED = "Portfolio Downloaded"
EVENT_PORTFOLIO_UPLOADED = "Portfolio Uploaded"

# Account Operations
EVENT_ACCOUNT_CREATED = "Account Created"
EVENT_ACCOUNT_UPDATED = "Account Updated"
EVENT_ACCOUNT_DELETED = "Account Deleted"

# Holdings Import (CRITICAL)
EVENT_HOLDINGS_IMPORT_STARTED = "Holdings Import Started"
EVENT_HOLDINGS_IMPORT_COMPLETED = "Holdings Import Completed"
EVENT_HOLDINGS_IMPORT_FAILED = "Holdings Import Failed"
EVENT_HOLDINGS_EXTRACTION_STARTED = "Holdings Extraction Started"
EVENT_HOLDINGS_EXTRACTION_COMPLETED = "Holdings Extraction Completed"
EVENT_HOLDINGS_EXTRACTION_FAILED = "Holdings Extraction Failed"
EVENT_FILE_UPLOADED = "File Uploaded"

# IBKR Integration
EVENT_IBKR_PREVIEW_SUCCESS = "IBKR Preview Success"
EVENT_IBKR_PREVIEW_FAILED = "IBKR Preview Failed"
EVENT_IBKR_IMPORT_COMPLETED = "IBKR Import Completed"

# Tag Operations
EVENT_TAG_CREATED = "Tag Created"
EVENT_TAG_DELETED = "Tag Deleted"
EVENT_TAG_ADOPTED = "Template Tag Adopted"
EVENT_HOLDING_TAGGED = "Holding Tagged"
EVENT_HOLDING_UNTAGGED = "Holding Untagged"

# Custom Charts
EVENT_CHART_CREATED = "Custom Chart Created"
EVENT_CHART_UPDATED = "Custom Chart Updated"
EVENT_CHART_DELETED = "Custom Chart Deleted"
EVENT_CHART_TYPE_CHANGED = "Custom Chart Type Changed"

# AI Chat
EVENT_AI_ANALYSIS_REQUESTED = "AI Analysis Requested"
EVENT_AI_ANALYSIS_COMPLETED = "AI Analysis Completed"
EVENT_AI_CHAT_SENT = "AI Chat Message Sent"
EVENT_AI_CHAT_SESSION_DELETED = "AI Chat Session Deleted"

# User Operations
EVENT_USER_REGISTERED = "User Registered"
EVENT_USER_PROFILE_UPDATED = "User Profile Updated"
EVENT_USER_SETTINGS_UPDATED = "User Settings Updated"
EVENT_DEFAULT_PORTFOLIO_SET = "Default Portfolio Set"

# Tool Usage
EVENT_TOOL_TAX_PLANNER_USED = "Tool: Tax Planner Used"
EVENT_TOOL_COMPOUND_INTEREST_USED = "Tool: Compound Interest Calculator Used"
EVENT_TOOL_FIRE_CALC_USED = "Tool: FIRE Calculator Used"
EVENT_TOOL_CASH_FLOW_USED = "Tool: Cash Flow Calculator Used"
EVENT_TOOL_MORTGAGE_VS_INVEST_USED = "Tool: Mortgage vs Invest Used"
EVENT_TOOL_BUY_OR_RENT_USED = "Tool: Buy or Rent Used"

# Cash Flow Operations
EVENT_CASH_FLOW_CREATED = "Cash Flow Created"
EVENT_CASH_FLOW_UPDATED = "Cash Flow Updated"
EVENT_CASH_FLOW_DELETED = "Cash Flow Deleted"
EVENT_CASH_FLOW_SCENARIO_CREATED = "Cash Flow Scenario Created"
EVENT_CASH_FLOW_SCENARIO_DELETED = "Cash Flow Scenario Deleted"

# Tax Planning Operations
EVENT_TAX_SCENARIO_CREATED = "Tax Scenario Created"
EVENT_TAX_SCENARIO_DELETED = "Tax Scenario Deleted"

# Feedback & Notifications
EVENT_FEEDBACK_SUBMITTED = "Feedback Submitted"
EVENT_NOTIFICATION_DISMISSED = "Notification Dismissed"


# ============================================================================
# PROPERTY BUILDERS
# ============================================================================

def build_portfolio_properties(
    portfolio_id: str,
    portfolio_name: Optional[str] = None,
    base_currency: Optional[str] = None,
    accounts_count: Optional[int] = None,
    holdings_count: Optional[int] = None,
    total_value: Optional[float] = None
) -> Dict[str, Any]:
    """Build standard properties for portfolio events."""
    props = {"portfolio_id": portfolio_id}

    if portfolio_name:
        props["portfolio_name"] = portfolio_name
    if base_currency:
        props["base_currency"] = base_currency
    if accounts_count is not None:
        props["accounts_count"] = accounts_count
    if holdings_count is not None:
        props["holdings_count"] = holdings_count
    if total_value is not None:
        props["total_value_usd"] = total_value

    return props


def build_account_properties(
    portfolio_id: str,
    account_name: str,
    account_type: Optional[str] = None,
    holdings_count: Optional[int] = None
) -> Dict[str, Any]:
    """Build standard properties for account events."""
    props = {
        "portfolio_id": portfolio_id,
        "account_name": account_name
    }

    if account_type:
        props["account_type"] = account_type
    if holdings_count is not None:
        props["holdings_count"] = holdings_count

    return props


def build_import_properties(
    portfolio_id: str,
    account_name: str,
    holdings_count: int,
    file_type: Optional[str] = None,
    source_url: Optional[str] = None,
    config_id: Optional[str] = None,
    is_auto_import: bool = False,
    duration_ms: Optional[float] = None,
    error_message: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for holdings import events."""
    props = {
        "portfolio_id": portfolio_id,
        "account_name": account_name,
        "holdings_count": holdings_count,
        "is_auto_import": is_auto_import
    }

    if file_type:
        props["file_type"] = file_type
    if source_url:
        # Extract domain from URL for privacy
        try:
            props["source_domain"] = urlparse(source_url).netloc
        except Exception:
            pass
    if config_id:
        props["config_id"] = config_id
    if duration_ms is not None:
        props["duration_ms"] = duration_ms
    if error_message:
        props["error_message"] = error_message[:200]  # Truncate long errors

    return props


def build_extraction_properties(
    session_id: str,
    file_type: Optional[str] = None,
    extraction_method: Optional[str] = None,
    holdings_count: Optional[int] = None,
    duration_ms: Optional[float] = None,
    error_message: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for holdings extraction events."""
    props = {"session_id": session_id}

    if file_type:
        props["file_type"] = file_type
    if extraction_method:
        props["extraction_method"] = extraction_method
    if holdings_count is not None:
        props["holdings_count"] = holdings_count
    if duration_ms is not None:
        props["duration_ms"] = duration_ms
    if error_message:
        props["error_message"] = error_message[:200]

    return props


def build_tag_properties(
    tag_name: str,
    tag_type: Optional[str] = None,
    symbol: Optional[str] = None,
    is_template: bool = False
) -> Dict[str, Any]:
    """Build properties for tag events."""
    props = {
        "tag_name": tag_name,
        "is_template": is_template
    }

    if tag_type:
        props["tag_type"] = tag_type
    if symbol:
        props["symbol"] = symbol

    return props


def build_chart_properties(
    chart_id: str,
    chart_title: Optional[str] = None,
    tag_name: Optional[str] = None,
    chart_type: Optional[str] = None,
    portfolio_id: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for custom chart events."""
    props = {"chart_id": chart_id}

    if chart_title:
        props["chart_title"] = chart_title
    if tag_name:
        props["tag_name"] = tag_name
    if chart_type:
        props["chart_type"] = chart_type
    if portfolio_id:
        props["portfolio_id"] = portfolio_id

    return props


def build_ai_properties(
    portfolio_id: Optional[str] = None,
    message_length: Optional[int] = None,
    session_id: Optional[str] = None,
    tagged_entities_count: Optional[int] = None,
    model_used: Optional[str] = None,
    duration_ms: Optional[float] = None
) -> Dict[str, Any]:
    """Build properties for AI events."""
    props = {}

    if portfolio_id:
        props["portfolio_id"] = portfolio_id
    if message_length is not None:
        props["message_length"] = message_length
    if session_id:
        props["session_id"] = session_id
    if tagged_entities_count is not None:
        props["tagged_entities_count"] = tagged_entities_count
    if model_used:
        props["model_used"] = model_used
    if duration_ms is not None:
        props["duration_ms"] = duration_ms

    return props


def build_error_properties(
    error_type: str,
    error_message: str,
    operation: str,
    stack_trace: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for error tracking."""
    props = {
        "error_type": error_type,
        "error_message": error_message[:200],  # Truncate
        "operation": operation
    }

    if stack_trace:
        props["stack_trace"] = stack_trace[:500]  # Truncate

    return props


def build_tool_properties(
    tool_name: str,
    inputs: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[float] = None
) -> Dict[str, Any]:
    """Build properties for tool usage events."""
    props = {"tool_name": tool_name}

    if inputs:
        # Include sanitized inputs (avoid PII/sensitive data)
        props["input_count"] = len(inputs)
    if duration_ms is not None:
        props["duration_ms"] = duration_ms

    return props


def build_cash_flow_properties(
    cash_flow_id: str,
    scenario_id: Optional[str] = None,
    flow_type: Optional[str] = None,
    time_period: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for cash flow events."""
    props = {"cash_flow_id": cash_flow_id}

    if scenario_id:
        props["scenario_id"] = scenario_id
    if flow_type:
        props["flow_type"] = flow_type
    if time_period:
        props["time_period"] = time_period

    return props


def build_ibkr_properties(
    holdings_count: int,
    token_valid: bool = True,
    query_id: Optional[str] = None,
    error_message: Optional[str] = None
) -> Dict[str, Any]:
    """Build properties for IBKR events."""
    props = {
        "holdings_count": holdings_count,
        "token_valid": token_valid
    }

    if query_id:
        props["query_id"] = query_id
    if error_message:
        props["error_message"] = error_message[:200]

    return props


def build_tax_properties(
    scenario_id: str,
    scenario_name: Optional[str] = None,
    entries_count: Optional[int] = None,
    total_gain: Optional[float] = None,
    total_tax: Optional[float] = None
) -> Dict[str, Any]:
    """Build properties for tax scenario events."""
    props = {"scenario_id": scenario_id}

    if scenario_name:
        props["scenario_name"] = scenario_name
    if entries_count is not None:
        props["entries_count"] = entries_count
    if total_gain is not None:
        props["total_gain"] = total_gain
    if total_tax is not None:
        props["total_tax"] = total_tax

    return props
