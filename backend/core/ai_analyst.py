import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

from google.generativeai import GenerativeModel
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from config import settings

logger = logging.getLogger(__name__)

# Mandatory disclaimer for all AI responses
MANDATORY_DISCLAIMER = """
⚠️ **IMPORTANT DISCLAIMER** ⚠️

This analysis is provided by an AI assistant for informational purposes only. It is NOT financial advice and should not be considered as such. The information presented:

- Is based on historical data and current market conditions
- May not reflect future performance
- Should not be used as the sole basis for investment decisions
- Does not constitute a recommendation to buy, sell, or hold any security

Always consult with a qualified financial advisor before making investment decisions. Past performance does not guarantee future results. Investing involves risk, including the potential loss of principal.
"""

class AIAnalyst:
    """AI Financial Analyst using Google Gemini for portfolio analysis"""
    
    def __init__(self):
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the Google AI model with safety settings"""
        try:
            if not settings.google_ai_api_key:
                raise ValueError("Google AI API key not configured")
            
            # Configure safety settings for financial analysis
            safety_settings = {
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            }
            
            self.model = GenerativeModel(
                model_name=settings.google_ai_model,
                safety_settings=safety_settings
            )
            logger.info(f"AI Analyst initialized with model: {settings.google_ai_model}")
            
        except Exception as e:
            logger.error(f"Failed to initialize AI model: {e}")
            raise
    
    def _format_portfolio_data(self, portfolio_data: Dict[str, Any]) -> str:
        """Format portfolio data for AI analysis"""
        try:
            formatted_data = {
                "portfolio_summary": {
                    "total_value": portfolio_data.get("total_value", 0),
                    "base_currency": portfolio_data.get("base_currency", "USD"),
                    "number_of_accounts": len(portfolio_data.get("accounts", [])),
                    "number_of_holdings": portfolio_data.get("total_holdings", 0)
                },
                "accounts": portfolio_data.get("accounts", []),
                "holdings_breakdown": portfolio_data.get("holdings_breakdown", []),
                "asset_allocation": portfolio_data.get("asset_allocation", []),
                "geographical_distribution": portfolio_data.get("geographical_distribution", []),
                "sector_distribution": portfolio_data.get("sector_distribution", [])
            }
            
            return json.dumps(formatted_data, indent=2)
            
        except Exception as e:
            logger.error(f"Error formatting portfolio data: {e}")
            return str(portfolio_data)
    
    def _create_analysis_prompt(self, portfolio_data: str) -> str:
        """Create a comprehensive analysis prompt for portfolio analysis"""
        return f"""
You are a professional financial analyst AI assistant. Analyze the following portfolio data and provide comprehensive insights.

PORTFOLIO DATA:
{portfolio_data}

Please provide a detailed analysis covering:

1. **Portfolio Overview**
   - Total portfolio value and composition
   - Key strengths and areas of concern

2. **Diversification Analysis**
   - Asset class distribution assessment
   - Sector concentration analysis
   - Geographical exposure evaluation
   - Concentration risk assessment

3. **Risk Assessment**
   - Portfolio risk profile
   - Potential risk factors
   - Diversification recommendations

4. **Observations & Insights**
   - Notable patterns or trends
   - Potential opportunities or concerns
   - General observations about portfolio structure

5. **Recommendations**
   - Areas for potential improvement
   - Diversification suggestions
   - Risk management considerations

IMPORTANT GUIDELINES:
- Provide factual, data-driven analysis
- Focus on observations and insights, not specific investment advice
- Be objective and balanced in your assessment
- Use clear, professional language
- Include specific data points from the portfolio
- Always include the mandatory disclaimer at the end

Format your response in clear sections with appropriate headings.
"""
    
    def _create_chat_prompt(self, portfolio_data: str, user_question: str, conversation_history: List[Dict[str, str]] = None) -> str:
        """Create a prompt for interactive chat with context"""
        history_context = ""
        if conversation_history:
            history_context = "\n\nCONVERSATION HISTORY:\n"
            for msg in conversation_history[-5:]:  # Last 5 messages for context
                history_context += f"{msg['role']}: {msg['content']}\n"
        
        return f"""
You are a professional financial analyst AI assistant. Answer the user's question about their portfolio based on the provided data.

PORTFOLIO DATA:
{portfolio_data}

{history_context}

USER QUESTION: {user_question}

IMPORTANT GUIDELINES:
- Provide helpful, informative responses based on the portfolio data
- Focus on factual analysis and observations
- Do not provide specific investment advice
- Be clear about limitations of the analysis
- Use professional, accessible language
- Always include the mandatory disclaimer at the end
- Keep responses concise but comprehensive
- If the question cannot be answered with available data, explain why

Format your response clearly and professionally.
"""
    
    async def analyze_portfolio(self, portfolio_data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive portfolio analysis"""
        try:
            if not self.model:
                raise ValueError("AI model not initialized")
            
            formatted_data = self._format_portfolio_data(portfolio_data)
            prompt = self._create_analysis_prompt(formatted_data)
            
            # Generate analysis
            response = await self.model.generate_content_async(prompt)
            
            # Add disclaimer
            full_response = response.text + "\n\n" + MANDATORY_DISCLAIMER
            
            return {
                "analysis": full_response,
                "timestamp": datetime.utcnow().isoformat(),
                "model_used": settings.google_ai_model,
                "portfolio_summary": {
                    "total_value": portfolio_data.get("total_value", 0),
                    "base_currency": portfolio_data.get("base_currency", "USD"),
                    "accounts_count": len(portfolio_data.get("accounts", [])),
                    "holdings_count": portfolio_data.get("total_holdings", 0)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in portfolio analysis: {e}")
            raise
    
    async def chat_with_analyst(self, portfolio_data: Dict[str, Any], user_question: str, conversation_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Interactive chat with AI analyst"""
        try:
            if not self.model:
                raise ValueError("AI model not initialized")
            
            formatted_data = self._format_portfolio_data(portfolio_data)
            prompt = self._create_chat_prompt(formatted_data, user_question, conversation_history)
            
            # Generate response
            response = await self.model.generate_content_async(prompt)
            
            # Add disclaimer
            full_response = response.text + "\n\n" + MANDATORY_DISCLAIMER
            
            return {
                "response": full_response,
                "timestamp": datetime.utcnow().isoformat(),
                "model_used": settings.google_ai_model,
                "question": user_question
            }
            
        except Exception as e:
            logger.error(f"Error in AI chat: {e}")
            raise

# Global AI analyst instance
ai_analyst = AIAnalyst() 