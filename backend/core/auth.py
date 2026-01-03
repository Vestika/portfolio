"""
Authentication functionality using Firebase and MongoDB
"""
from fastapi import Depends, HTTPException, Request
from pymongo.asynchronous.database import AsyncDatabase
from loguru import logger
from models.user_model import User
from services.telegram.service import get_telegram_service
from core.database import get_db
from core.analytics import get_analytics_service
from core.analytics_events import EVENT_USER_REGISTERED

async def get_current_user(
    request: Request,
    db: AsyncDatabase = Depends(get_db)
) -> User:
    """Get current authenticated user from Firebase token and database"""
    # Get Firebase user from request state (set by FirebaseAuthMiddleware)
    try:
        firebase_user = request.state.user
    except AttributeError as e:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not firebase_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get user from database
    firebase_email = firebase_user.get("email") if firebase_user else None
    if not firebase_email:
        raise HTTPException(status_code=401, detail="No email found in Firebase user")

    user = await db.users.find_one({"email": firebase_email})

    if not user:
        # Use update_one with upsert to atomically create user (prevents race condition)
        new_user_data = {
            "name": firebase_user.get("name", "Unknown"),
            "email": firebase_email,
            "firebase_uid": firebase_user.get("uid"),
        }

        result = await db.users.update_one(
            {"email": firebase_email},  # Filter
            {"$setOnInsert": new_user_data},  # Only set these fields if inserting
            upsert=True  # Create if doesn't exist
        )

        # Only send notifications if we actually inserted a new user (not if another request beat us)
        is_new_user = result.upserted_id is not None

        if is_new_user:
            # Fetch the newly created user
            user = await db.users.find_one({"email": firebase_email})
            if user:
                user["id"] = str(user.pop("_id"))
                new_user = User(**user)

                # Track user registration (start of onboarding funnel)
                try:
                    analytics = get_analytics_service()
                    analytics.track_event(
                        user=new_user,
                        event_name=EVENT_USER_REGISTERED,
                        properties={
                            "registration_method": "firebase",
                            "has_name": bool(firebase_user.get("name"))
                        }
                    )
                    # Also identify the user in Mixpanel
                    analytics.identify_user(new_user)
                except Exception as e:
                    logger.warning(f"⚠️ [AUTH] Failed to track user registration: {e}")

                # Best-effort Telegram notification for new user creation
                try:
                    telegram_service = get_telegram_service()
                    await telegram_service.send_text(
                        f"👤 New user created\nName: {new_user.name}\nEmail: {new_user.email}\nUID: {new_user.firebase_uid}"
                    )
                except Exception as e:
                    logger.warning(f"⚠️ [AUTH] Failed to send Telegram new-user notification: {e}")
                return new_user
        else:
            # Another request created the user, just fetch and return it
            user = await db.users.find_one({"email": firebase_email})

    # Convert MongoDB document to User model
    user["id"] = str(user.pop("_id"))
    user_obj = User(**user)
    return user_obj

async def get_current_user_or_anonymous(
    request: Request,
    db: AsyncDatabase = Depends(get_db)
) -> User | None:
    """Get current user or return None if not authenticated"""
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None