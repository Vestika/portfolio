"""
Authentication functionality using Firebase and MongoDB
"""
from fastapi import Depends, HTTPException, Request
from pymongo.asynchronous.database import AsyncDatabase
from models.user_model import User
from services.telegram.service import get_telegram_service
from core.database import get_db

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
        # Create new user if doesn't exist
        new_user = User(
            name=firebase_user.get("name", "Unknown"),
            email=firebase_email,
            firebase_uid=firebase_user.get("uid"),
        )
        result = await db.users.insert_one(new_user.dict(exclude={'id'}))
        new_user.id = str(result.inserted_id)

        # Best-effort Telegram notification for new user creation
        try:
            telegram_service = get_telegram_service()
            await telegram_service.send_text(
                f"👤 New user created\nName: {new_user.name}\nEmail: {new_user.email}\nUID: {new_user.firebase_uid}"
            )
        except Exception as e:
            print(f"⚠️ [AUTH] Failed to send Telegram new-user notification: {e}")
        return new_user

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