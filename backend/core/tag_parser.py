import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class TaggedEntity:
    """Represents a tagged entity found in a message"""
    tag_type: str  # '@' for portfolios/accounts, '$' for symbols
    tag_value: str  # The actual tag value (e.g., "My Portfolio", "VTI")
    start_pos: int  # Start position in the original message
    end_pos: int    # End position in the original message
    entity_id: Optional[str] = None  # ID of the entity (for @ tags)
    entity_name: Optional[str] = None  # Display name of the entity

@dataclass
class AutocompleteSuggestion:
    """Represents an autocomplete suggestion"""
    id: str
    name: str
    type: str  # 'portfolio', 'account', 'symbol'
    symbol: Optional[str] = None  # For symbols

class TagParser:
    """Parses and manages tagging functionality for AI chat"""
    
    def __init__(self):
        # Regex patterns for different tag types
        # @portfolio_name or @portfolio_name(account_name) or @portfolio_name(account_name[index])
        self.portfolio_account_pattern = r'@([a-zA-Z0-9_\s]+(?:\([a-zA-Z0-9_\s]+(?:\[\d+\])?\))?)'
        self.symbol_pattern = r'\$([A-Z]{1,5})'
    
    def extract_tags(self, message: str) -> List[TaggedEntity]:
        """Extract all tags from a message"""
        tags = []
        
        # Extract @ tags (portfolios/accounts)
        for match in re.finditer(self.portfolio_account_pattern, message):
            tag_value = match.group(1).strip()
            tags.append(TaggedEntity(
                tag_type='@',
                tag_value=tag_value,
                start_pos=match.start(),
                end_pos=match.end()
            ))
        
        # Extract $ tags (symbols)
        for match in re.finditer(self.symbol_pattern, message):
            tag_value = match.group(1).strip()
            tags.append(TaggedEntity(
                tag_type='$',
                tag_value=tag_value,
                start_pos=match.start(),
                end_pos=match.end()
            ))
        
        return tags
    
    def get_autocomplete_suggestions(
        self, 
        query: str, 
        tag_type: str,
        portfolio_data: Dict[str, Any]
    ) -> List[AutocompleteSuggestion]:
        """Get autocomplete suggestions based on query and tag type"""
        suggestions = []
        
        if tag_type == '@':
            # Suggest portfolios and accounts
            suggestions.extend(self._get_portfolio_suggestions(query, portfolio_data))
            suggestions.extend(self._get_account_suggestions(query, portfolio_data))
        elif tag_type == '$':
            # Suggest symbols
            suggestions.extend(self._get_symbol_suggestions(query, portfolio_data))
        
        return suggestions
    
    def _get_portfolio_suggestions(self, query: str, portfolio_data: Dict[str, Any]) -> List[AutocompleteSuggestion]:
        """Get portfolio suggestions"""
        suggestions = []
        
        # For now, we'll suggest the current portfolio if it matches
        portfolio_name = portfolio_data.get('config', {}).get('portfolio_name', 'Portfolio')
        if query.lower() in portfolio_name.lower():
            suggestions.append(AutocompleteSuggestion(
                id=portfolio_data.get('config', {}).get('portfolio_id', 'current'),
                name=portfolio_name,
                type='portfolio'
            ))
        
        return suggestions
    
    def _get_account_suggestions(self, query: str, portfolio_data: Dict[str, Any]) -> List[AutocompleteSuggestion]:
        """Get account suggestions"""
        suggestions = []
        
        accounts = portfolio_data.get('accounts', [])
        for account in accounts:
            account_name = account.get('name', '')
            if query.lower() in account_name.lower():
                suggestions.append(AutocompleteSuggestion(
                    id=account_name,  # Using name as ID for now
                    name=account_name,
                    type='account'
                ))
        
        return suggestions
    
    def _get_symbol_suggestions(self, query: str, portfolio_data: Dict[str, Any]) -> List[AutocompleteSuggestion]:
        """Get symbol suggestions"""
        suggestions = []
        
        securities = portfolio_data.get('securities', {})
        for symbol, security_data in securities.items():
            if query.upper() in symbol.upper():
                security_name = security_data.get('name', symbol)
                suggestions.append(AutocompleteSuggestion(
                    id=symbol,
                    name=security_name,
                    type='symbol',
                    symbol=symbol
                ))
        
        return suggestions
    
    def validate_tags(self, tags: List[TaggedEntity], portfolio_data: Dict[str, Any]) -> List[TaggedEntity]:
        """Validate tags against available entities and add entity information"""
        validated_tags = []
        
        for tag in tags:
            if tag.tag_type == '@':
                # Validate portfolio/account tags
                entity_info = self._find_portfolio_account_entity(tag.tag_value, portfolio_data)
                if entity_info:
                    tag.entity_id = entity_info['id']
                    tag.entity_name = entity_info['name']
                    validated_tags.append(tag)
                else:
                    logger.warning(f"Invalid @ tag: {tag.tag_value}")
            
            elif tag.tag_type == '$':
                # Validate symbol tags
                entity_info = self._find_symbol_entity(tag.tag_value, portfolio_data)
                if entity_info:
                    tag.entity_id = entity_info['id']
                    tag.entity_name = entity_info['name']
                    validated_tags.append(tag)
                else:
                    logger.warning(f"Invalid $ tag: {tag.tag_value}")
        
        return validated_tags
    
    def validate_tags_global(self, tags: List[TaggedEntity], all_portfolio_data: Dict[str, Dict[str, Any]]) -> List[TaggedEntity]:
        """Validate tags against all user portfolios and add entity information"""
        validated_tags = []
        
        for tag in tags:
            if tag.tag_type == '@':
                # Validate portfolio/account tags across all portfolios
                entity_info = self._find_portfolio_account_entity_global(tag.tag_value, all_portfolio_data)
                if entity_info:
                    tag.entity_id = entity_info['id']
                    tag.entity_name = entity_info['name']
                    validated_tags.append(tag)
                else:
                    logger.warning(f"Invalid @ tag: {tag.tag_value}")
            
            elif tag.tag_type == '$':
                # Validate symbol tags across all portfolios
                entity_info = self._find_symbol_entity_global(tag.tag_value, all_portfolio_data)
                if entity_info:
                    tag.entity_id = entity_info['id']
                    tag.entity_name = entity_info['name']
                    validated_tags.append(tag)
                else:
                    logger.warning(f"Invalid $ tag: {tag.tag_value}")
        
        return validated_tags
    
    def _find_portfolio_account_entity(self, tag_value: str, portfolio_data: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Find portfolio or account entity by name"""
        # Check if it's the portfolio name
        portfolio_name = portfolio_data.get('config', {}).get('portfolio_name', 'Portfolio')
        if tag_value.lower() == portfolio_name.lower():
            return {
                'id': portfolio_data.get('config', {}).get('portfolio_id', 'current'),
                'name': portfolio_name
            }
        
        # Check if it's an account name
        accounts = portfolio_data.get('accounts', [])
        for account in accounts:
            account_name = account.get('name', '')
            if tag_value.lower() == account_name.lower():
                return {
                    'id': account_name,
                    'name': account_name
                }
        
        return None
    
    def _find_symbol_entity(self, tag_value: str, portfolio_data: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Find symbol entity by symbol"""
        securities = portfolio_data.get('securities', {})
        symbol_upper = tag_value.upper()
        
        if symbol_upper in securities:
            security_data = securities[symbol_upper]
            return {
                'id': symbol_upper,
                'name': security_data.get('name', symbol_upper)
            }
        
        return None
    
    def _find_portfolio_account_entity_global(self, tag_value: str, all_portfolio_data: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, str]]:
        """Find portfolio or account entity by name across all portfolios"""
        # Parse the tag value to extract portfolio and account info
        import re
        
        # Check if it's just a portfolio name
        if '(' not in tag_value:
            # Simple portfolio name - search by name to find portfolio ID
            for portfolio_id, portfolio_data in all_portfolio_data.items():
                portfolio_name = portfolio_data.get('config', {}).get('portfolio_name', 'Portfolio')
                if tag_value.lower() == portfolio_name.lower():
                    return {
                        'id': portfolio_id,
                        'name': portfolio_name
                    }
        else:
            # Format: portfolio_name(account_name[index])
            match = re.match(r'^([a-zA-Z0-9_\s]+)\(([a-zA-Z0-9_\s]+)(?:\[(\d+)\])?\)$', tag_value)
            if match:
                portfolio_name = match.group(1).strip()
                account_name = match.group(2).strip()
                index = match.group(3)
                
                for portfolio_id, portfolio_data in all_portfolio_data.items():
                    current_portfolio_name = portfolio_data.get('config', {}).get('portfolio_name', 'Portfolio')
                    if current_portfolio_name.lower() == portfolio_name.lower():
                        accounts = portfolio_data.get('accounts', [])
                        
                        if index:
                            # Indexed account
                            try:
                                account_index = int(index)
                                if 0 <= account_index < len(accounts):
                                    account = accounts[account_index]
                                    if account.get('name', '').lower() == account_name.lower():
                                        return {
                                            'id': f"{portfolio_id}:{account_name}[{index}]",
                                            'name': f"{current_portfolio_name}({account_name}[{index}])"
                                        }
                            except ValueError:
                                pass
                        else:
                            # Simple account name
                            for account in accounts:
                                if account.get('name', '').lower() == account_name.lower():
                                    return {
                                        'id': f"{portfolio_id}:{account_name}",
                                        'name': f"{current_portfolio_name}({account_name})"
                                    }
        
        return None
    
    def _find_symbol_entity_global(self, tag_value: str, all_portfolio_data: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, str]]:
        """Find symbol entity by symbol across all portfolios"""
        symbol_upper = tag_value.upper()
        
        # Check all portfolios for the symbol
        for portfolio_id, portfolio_data in all_portfolio_data.items():
            securities = portfolio_data.get('securities', {})
            if symbol_upper in securities:
                security_data = securities[symbol_upper]
                portfolio_name = portfolio_data.get('config', {}).get('portfolio_name', 'Portfolio')
                return {
                    'id': symbol_upper,
                    'name': f"{security_data.get('name', symbol_upper)} ({portfolio_name})"
                }
        
        return None
    
    def format_message_with_tags(self, message: str, tags: List[TaggedEntity]) -> str:
        """Format message to highlight tags with visual indicators"""
        # Sort tags by position in reverse order to avoid index shifting
        sorted_tags = sorted(tags, key=lambda x: x.start_pos, reverse=True)
        
        formatted_message = message
        for tag in sorted_tags:
            # Add visual indicators around tags
            if tag.entity_id:
                # Valid tag - add success indicator
                indicator = f"✅{tag.tag_type}{tag.tag_value}✅"
            else:
                # Invalid tag - add warning indicator
                indicator = f"⚠️{tag.tag_type}{tag.tag_value}⚠️"
            
            formatted_message = (
                formatted_message[:tag.start_pos] + 
                indicator + 
                formatted_message[tag.end_pos:]
            )
        
        return formatted_message

# Global tag parser instance
tag_parser = TagParser() 