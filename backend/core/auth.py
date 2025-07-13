from fastapi import HTTPException, Request, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from models.user_model import User
from core.database import get_db
from config import settings

# Development mode default user
DEV_USER = User(
    id="dev-user-123",
    name="Development User",
    email="dev@example.com",
    firebase_uid="dev-user-123"
)

async def create_demo_portfolio(db: AsyncIOMotorDatabase, user_id: str):
    """Create a demo portfolio for a new user"""
    # Implementation for creating demo portfolio
    pass


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
) -> User:
    # If in development mode, return mock user
    if settings.development_mode:
        return DEV_USER
    
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
            firebase_uid=firebase_user.get("uid"),
        )
        result = await db.users.insert_one(new_user.dict(exclude={'id'}))
        new_user.id = str(result.inserted_id)
        await create_demo_portfolio(db, new_user.id)

        return new_user

    # Convert MongoDB document to User model
    user["id"] = str(user.pop("_id"))
    return User(**user)

async def get_current_user_or_anonymous(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
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
        raise
