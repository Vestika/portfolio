import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from core.database import db_manager

logger = logging.getLogger(__name__)

class ChatManager:
    """Manages chat sessions and conversation history using MongoDB"""
    
    def __init__(self):
        self.collection_name = "ai_chat_sessions"
    
    async def create_chat_session(self, user_id: str, portfolio_id: str) -> str:
        """Create a new chat session"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            session_data = {
                "user_id": user_id,
                "portfolio_id": portfolio_id,
                "created_at": datetime.utcnow(),
                "last_activity": datetime.utcnow(),
                "messages": [],
                "is_active": True
            }
            
            result = await collection.insert_one(session_data)
            session_id = str(result.inserted_id)
            
            logger.info(f"Created chat session {session_id} for user {user_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"Error creating chat session: {e}")
            raise
    
    async def get_chat_session(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a chat session by ID"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            session = await collection.find_one({
                "_id": ObjectId(session_id),
                "user_id": user_id,
                "is_active": True
            })
            
            if session:
                # Convert ObjectId to string for JSON serialization
                session["_id"] = str(session["_id"])
                return session
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting chat session: {e}")
            raise
    
    async def get_user_chat_sessions(self, user_id: str, portfolio_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all chat sessions for a user"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            query = {"user_id": user_id, "is_active": True}
            if portfolio_id:
                query["portfolio_id"] = portfolio_id
            
            cursor = collection.find(query).sort("last_activity", -1)
            sessions = []
            
            async for session in cursor:
                session["_id"] = str(session["_id"])
                sessions.append(session)
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting user chat sessions: {e}")
            raise
    
    async def add_message_to_session(self, session_id: str, user_id: str, role: str, content: str) -> bool:
        """Add a message to a chat session"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            message = {
                "role": role,  # "user" or "assistant"
                "content": content,
                "timestamp": datetime.utcnow()
            }
            
            result = await collection.update_one(
                {
                    "_id": ObjectId(session_id),
                    "user_id": user_id,
                    "is_active": True
                },
                {
                    "$push": {"messages": message},
                    "$set": {"last_activity": datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Added message to session {session_id}")
                return True
            else:
                logger.warning(f"Failed to add message to session {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error adding message to session: {e}")
            raise
    
    async def get_session_messages(self, session_id: str, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get messages from a chat session"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            session = await collection.find_one(
                {
                    "_id": ObjectId(session_id),
                    "user_id": user_id,
                    "is_active": True
                },
                {"messages": {"$slice": -limit}}  # Get last N messages
            )
            
            if session:
                return session.get("messages", [])
            
            return []
            
        except Exception as e:
            logger.error(f"Error getting session messages: {e}")
            raise
    
    async def close_chat_session(self, session_id: str, user_id: str) -> bool:
        """Close a chat session"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            result = await collection.update_one(
                {
                    "_id": ObjectId(session_id),
                    "user_id": user_id,
                    "is_active": True
                },
                {
                    "$set": {
                        "is_active": False,
                        "closed_at": datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"Closed chat session {session_id}")
                return True
            else:
                logger.warning(f"Failed to close session {session_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error closing chat session: {e}")
            raise
    
    async def cleanup_old_sessions(self, days_old: int = 30) -> int:
        """Clean up old inactive chat sessions"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            result = await collection.delete_many({
                "is_active": False,
                "closed_at": {"$lt": cutoff_date}
            })
            
            deleted_count = result.deleted_count
            logger.info(f"Cleaned up {deleted_count} old chat sessions")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old sessions: {e}")
            raise
    
    async def get_session_summary(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a summary of a chat session"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            session = await collection.find_one(
                {
                    "_id": ObjectId(session_id),
                    "user_id": user_id
                },
                {
                    "portfolio_id": 1,
                    "created_at": 1,
                    "last_activity": 1,
                    "messages": {"$size": "$messages"},
                    "is_active": 1
                }
            )
            
            if session:
                session["_id"] = str(session["_id"])
                return session
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting session summary: {e}")
            raise
    
    async def search_chat_history(self, user_id: str, query: str, portfolio_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search chat history for specific content"""
        try:
            collection = db_manager.get_collection(self.collection_name)
            
            # Build search query
            search_query = {
                "user_id": user_id,
                "messages.content": {"$regex": query, "$options": "i"}
            }
            
            if portfolio_id:
                search_query["portfolio_id"] = portfolio_id
            
            cursor = collection.find(search_query)
            results = []
            
            async for session in cursor:
                session["_id"] = str(session["_id"])
                results.append(session)
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching chat history: {e}")
            raise

# Global chat manager instance
chat_manager = ChatManager() 