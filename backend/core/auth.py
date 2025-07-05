from fastapi import Depends, HTTPException, Request
from pymongo.asynchronous.database import AsyncDatabase
from models import User
from .database import get_db


async def get_current_user(
    request: Request,
    db: AsyncDatabase = Depends(get_db)
) -> User:
    # Get Firebase user from request state (set by FirebaseAuthMiddlewareMiddleware)
    try:
        firebase_user = request.state.user
    except AttributeError:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if not firebase_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get user from database
    user = await db.users.find_one({"email": firebase_user.get("email")})
    if not user:
        # Create new user if doesn't exist
        new_user = User(
            name=firebase_user.get("name"),
            email=firebase_user.get("email"),
        )
        result = await db.users.insert_one(new_user.dict(exclude={'id'}))
        new_user.id = str(result.inserted_id)
        return new_user

    # Convert MongoDB document to User model
    user["id"] = str(user.pop("_id"))
    return User(**user)

async def get_current_user_or_anonymous(
    request: Request,
    db: AsyncDatabase = Depends(get_db)
) -> User:
    try:
        return await get_current_user(request, db)
    except HTTPException as e:
        if e.status_code == 401:
            # If not authenticated, return an anonymous user
            return User(
                email="",
                name="Anonymous",
            )
