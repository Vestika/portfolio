"""
Authentication functionality using Firebase and MongoDB
"""
from fastapi import Depends, HTTPException, Request
from pymongo.asynchronous.database import AsyncDatabase
from models.user_model import User
from core.database import get_db

async def get_current_user(
    request: Request,
    db: AsyncDatabase = Depends(get_db)
) -> User:
    """Get current authenticated user from Firebase token and database"""
    # Get Firebase user from request state (set by FirebaseAuthMiddleware)
    try:
        firebase_user = request.state.user
        print(f"🔐 [AUTH] Firebase user from request.state: {firebase_user}")
    except AttributeError as e:
        print(f"❌ [AUTH] AttributeError getting user from request.state: {e}")
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not firebase_user:
        print(f"❌ [AUTH] No firebase_user found")
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get user from database
    firebase_email = firebase_user.get("email") if firebase_user else None
    if not firebase_email:
        print(f"❌ [AUTH] No email found in Firebase user")
        raise HTTPException(status_code=401, detail="No email found in Firebase user")
    
    print(f"🔍 [AUTH] Looking for user with email: {firebase_email}")
    user = await db.users.find_one({"email": firebase_email})
    
    if not user:
        # Create new user if doesn't exist
        print(f"➕ [AUTH] Creating new user for email: {firebase_email}")
        new_user = User(
            name=firebase_user.get("name", "Unknown"),
            email=firebase_email,
            firebase_uid=firebase_user.get("uid"),
        )
        result = await db.users.insert_one(new_user.dict(exclude={'id'}))
        new_user.id = str(result.inserted_id)
        print(f"✅ [AUTH] Created new user with ID: {new_user.id}")
        return new_user

    # Convert MongoDB document to User model
    user["id"] = str(user.pop("_id"))
    user_obj = User(**user)
    print(f"✅ [AUTH] Found existing user with ID: {user_obj.id}")
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