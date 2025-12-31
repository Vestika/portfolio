"""AI and chat endpoints"""
import logging
import time
from typing import Any, Optional
from datetime import datetime
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_current_user
from core.database import db_manager
from core.ai_analyst import ai_analyst
from core.portfolio_analyzer import portfolio_analyzer
from core.chat_manager import chat_manager
from core.analytics import get_analytics_service
from core.analytics_events import EVENT_AI_CHAT_SENT, build_ai_properties
from models.portfolio import Portfolio
from .portfolio import get_or_create_calculator

# Create router for this module
router = APIRouter()

logger = logging.Logger(__name__)

# Request/Response models
class ChatMessageRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    tagged_entities: Optional[list[dict[str, Any]]] = None

@router.post("/portfolio/{portfolio_id}/analyze")
async def analyze_portfolio_ai(portfolio_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Perform comprehensive AI analysis of a portfolio.
    """
    try:
        # Check if AI service is available
        if not ai_analyst.is_available:
            raise HTTPException(
                status_code=503, 
                detail=f"AI analysis service is currently unavailable: {ai_analyst.error_message}"
            )
        
        # Get portfolio data
        collection = db_manager.get_collection("portfolios")
        doc = await collection.find_one({"_id": ObjectId(portfolio_id), "user_id": user.id})
        if not doc:
            raise HTTPException(status_code=404, detail=f"Portfolio {portfolio_id} not found")
        
        portfolio = Portfolio.from_dict(doc)
        calculator = get_or_create_calculator(portfolio_id, portfolio)
        
        # Analyze portfolio for AI
        portfolio_data = portfolio_analyzer.analyze_portfolio_for_ai(portfolio, calculator)
        
        # Perform AI analysis
        analysis_result = await ai_analyst.analyze_portfolio(portfolio_data)
        
        return {
            "portfolio_id": portfolio_id,
            "analysis": analysis_result["analysis"],
            "timestamp": analysis_result["timestamp"],
            "model_used": analysis_result["model_used"],
            "portfolio_summary": analysis_result["portfolio_summary"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI portfolio analysis: {e}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@router.post("/chat")
async def chat_with_ai_analyst(request: ChatMessageRequest, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Interactive chat with AI financial analyst about portfolios.
    """
    start_time = time.time()

    try:
        # Check if AI service is available
        if not ai_analyst.is_available:
            raise HTTPException(
                status_code=503, 
                detail=f"AI chat service is currently unavailable: {ai_analyst.error_message}"
            )
        
        # Get user's portfolios for context
        collection = db_manager.get_collection("portfolios")
        user_portfolios = []
        all_portfolio_data = {}
        
        async for doc in collection.find({"user_id": user.id}):
            portfolio = Portfolio.from_dict(doc)
            portfolio_id = str(doc["_id"])
            
            # Create portfolio data for AI analysis
            calculator = get_or_create_calculator(portfolio_id, portfolio)
            portfolio_data = portfolio_analyzer.analyze_portfolio_for_ai(portfolio, calculator)
            
            user_portfolios.append({
                "id": portfolio_id,
                "name": portfolio.portfolio_name,
                "data": portfolio_data
            })
            
            # Store portfolio data for tag validation
            all_portfolio_data[portfolio_id] = {
                "config": {"portfolio_name": portfolio.portfolio_name},
                "accounts": [{"name": acc.name} for acc in portfolio.accounts],
                "securities": portfolio.securities
            }
        
        if not user_portfolios:
            raise HTTPException(status_code=404, detail="No portfolios found for user")
        
        # Determine portfolio context from tagged entities or use default
        portfolio_context = None
        if request.tagged_entities:
            # Extract portfolio IDs from tagged entities
            portfolio_ids = set()
            for entity in request.tagged_entities:
                if entity.get('type') == 'portfolio':
                    portfolio_ids.add(entity['id'])
                elif entity.get('type') == 'account':
                    # Account tag: portfolio_id:account_name
                    portfolio_ids.add(entity['id'].split(':')[0])
            
            # Use tagged portfolios as context
            portfolio_context = [p for p in user_portfolios if p["id"] in portfolio_ids]
        
        # If no tagged portfolios, use default (first portfolio)
        if not portfolio_context:
            portfolio_context = [user_portfolios[0]]
        
        # Convert tagged entities to TaggedEntity objects for AI
        validated_tags = []
        if request.tagged_entities:
            for entity in request.tagged_entities:
                from core.tag_parser import TaggedEntity
                tag = TaggedEntity(
                    tag_type='@' if entity['type'] in ['portfolio', 'account'] else '$',
                    tag_value=entity['name'],
                    start_pos=0,  # Not needed for backend processing
                    end_pos=0,    # Not needed for backend processing
                    entity_id=entity['id'],
                    entity_name=entity['name']
                )
                validated_tags.append(tag)
        
        # Handle chat session (use first portfolio as session context)
        session_id = request.session_id
        conversation_history = []
        session_portfolio_id = portfolio_context[0]["id"]
        
        if session_id:
            # Get existing session
            session = await chat_manager.get_chat_session(session_id, user.id)
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found")
            
            # Get conversation history
            conversation_history = await chat_manager.get_session_messages(session_id, user.id)
        else:
            # Create new session
            session_id = await chat_manager.create_chat_session(user.id, session_portfolio_id)
        
        # Add user message to session
        await chat_manager.add_message_to_session(session_id, user.id, "user", request.message)
        
        # Get AI response with enhanced context from tags and multiple portfolios
        ai_response = await ai_analyst.chat_with_analyst_multi_portfolio(
            portfolio_context, 
            request.message, 
            conversation_history, 
            validated_tags
        )
        
        # Add AI response to session
        await chat_manager.add_message_to_session(session_id, user.id, "assistant", ai_response["response"])

        # Track AI chat event
        duration_ms = (time.time() - start_time) * 1000
        analytics = get_analytics_service()
        analytics.track_event(
            user=user,
            event_name=EVENT_AI_CHAT_SENT,
            properties=build_ai_properties(
                portfolio_id=portfolio_context[0]["id"] if portfolio_context else None,
                message_length=len(request.message),
                session_id=session_id,
                tagged_entities_count=len(request.tagged_entities) if request.tagged_entities else 0,
                model_used=ai_response["model_used"],
                duration_ms=duration_ms
            )
        )

        return {
            "session_id": session_id,
            "response": ai_response["response"],
            "timestamp": ai_response["timestamp"],
            "model_used": ai_response["model_used"],
            "question": ai_response["question"],
            "portfolio_context": [p["id"] for p in portfolio_context]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI chat: {e}")
        raise HTTPException(status_code=500, detail=f"AI chat failed: {str(e)}")

@router.get("/chat/sessions")
async def get_chat_sessions(user=Depends(get_current_user)) -> list[dict[str, Any]]:
    """
    Get all chat sessions for a user.
    """
    try:
        sessions = await chat_manager.get_user_chat_sessions(user.id)
        return sessions
    except Exception as e:
        logger.error(f"Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat sessions: {str(e)}")

@router.get("/chat/sessions/{session_id}")
async def get_chat_session_messages(session_id: str, user=Depends(get_current_user)) -> dict[str, Any]:
    """
    Get messages from a specific chat session.
    """
    try:
        session = await chat_manager.get_chat_session(session_id, user.id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        messages = await chat_manager.get_session_messages(session_id, user.id)
        
        return {
            "session_id": session_id,
            "portfolio_id": session.get("portfolio_id", "unknown"),
            "messages": messages,
            "created_at": session["created_at"],
            "last_activity": session["last_activity"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat session messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get chat session messages: {str(e)}")

@router.delete("/chat/sessions/{session_id}")
async def close_chat_session(session_id: str, user=Depends(get_current_user)) -> dict[str, str]:
    """
    Close a chat session.
    """
    try:
        success = await chat_manager.close_chat_session(session_id, user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        return {"message": "Chat session closed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to close chat session: {str(e)}")

@router.get("/chat/search")
async def search_chat_history(query: str = Query(..., description="Search query"), user=Depends(get_current_user)) -> list[dict[str, Any]]:
    """
    Search chat history for a user.
    """
    try:
        results = await chat_manager.search_chat_history(user.id, query)
        return results
    except Exception as e:
        logger.error(f"Error searching chat history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search chat history: {str(e)}")

@router.get("/chat/autocomplete")
async def get_chat_autocomplete(
    query: str = Query(..., description="Autocomplete query"), 
    tag_type: str = Query(..., description="Tag type (@ or $)"),
    user=Depends(get_current_user)
) -> list[dict[str, Any]]:
    """
    Get autocomplete suggestions for chat tags across all user portfolios.
    """
    try:
        if tag_type == '@':
            # Get all user portfolios and accounts for @ tags
            collection = db_manager.get_collection("portfolios")
            suggestions = []
            
            async for doc in collection.find({"user_id": user.id}):
                portfolio = Portfolio.from_dict(doc)
                portfolio_name = portfolio.portfolio_name
                portfolio_id = str(doc["_id"])
                
                # Add portfolio suggestion if it matches query
                if query.lower() in portfolio_name.lower():
                    suggestions.append({
                        "id": portfolio_id,
                        "name": portfolio_name,
                        "type": "portfolio",
                        "symbol": None
                    })
                
                # Add account suggestions if they match query
                for i, account in enumerate(portfolio.accounts):
                    account_name = account.name
                    if query.lower() in account_name.lower():
                        # Check if there are multiple accounts with same name
                        same_name_accounts = [acc for acc in portfolio.accounts if acc.name == account_name]
                        if len(same_name_accounts) > 1:
                            # Add indexed version
                            suggestions.append({
                                "id": f"{portfolio_id}:{account_name}[{i}]",
                                "name": f"{portfolio_name}({account_name}[{i}])",
                                "type": "account",
                                "symbol": None
                            })
                        else:
                            # Add simple version
                            suggestions.append({
                                "id": f"{portfolio_id}:{account_name}",
                                "name": f"{portfolio_name}({account_name})",
                                "type": "account",
                                "symbol": None
                            })
            
            return suggestions[:20]  # Limit to 20 suggestions
            
        elif tag_type == '$':
            # Get all symbols across all user portfolios for $ tags
            collection = db_manager.get_collection("portfolios")
            all_symbols = set()
            
            async for doc in collection.find({"user_id": user.id}):
                portfolio = Portfolio.from_dict(doc)
                for symbol in portfolio.securities.keys():
                    if query.upper() in symbol.upper():
                        all_symbols.add(symbol)
            
            suggestions = []
            for symbol in sorted(all_symbols):
                suggestions.append({
                    "id": symbol,
                    "name": symbol,
                    "type": "symbol",
                    "symbol": symbol
                })
            
            return suggestions[:20]  # Limit to 20 suggestions
        
        return []
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting chat autocomplete: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get autocomplete suggestions: {str(e)}")