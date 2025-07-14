from fastapi import HTTPException, Request, Depends
from pymongo.asynchronous.database import AsyncDatabase
from models.user_model import User
from core.database import get_db



async def create_demo_portfolio(db: AsyncDatabase, user_id: str):
    """Create a demo portfolio for a new user"""
    try:
        from pathlib import Path
        import yaml
        
        # Read the demo portfolio YAML file
        demo_file = Path(__file__).parent.parent / "demo.yaml"
        
        if demo_file.exists():
            with open(demo_file, 'r') as f:
                demo_data = yaml.safe_load(f)
            
            # Prepare the portfolio for the new user
            portfolio_data = {
                "portfolio_name": "Demo Portfolio",
                "user_id": user_id,
                "config": demo_data["config"],
                "securities": demo_data["securities"],
                "accounts": demo_data["accounts"]
            }
            
            # Insert into database
            collection = db.portfolios
            await collection.insert_one(portfolio_data)
            print(f"Created demo portfolio for user {user_id}")
        else:
            # Fallback: create a minimal portfolio if demo.yaml doesn't exist
            portfolio_data = {
                "portfolio_name": "My First Portfolio",
                "user_id": user_id,
                "config": {
                    "user_name": "Demo User",
                    "base_currency": "USD",
                    "exchange_rates": {
                        "USD": 1.0,
                        "ILS": 3.5,
                        "EUR": 1.1
                    },
                    "unit_prices": {
                        "USD": 1.0,
                        "ILS": 1.0
                    }
                },
                "securities": {
                    "USD": {
                        "name": "USD",
                        "type": "cash",
                        "currency": "USD"
                    }
                },
                "accounts": [
                    {
                        "name": "Cash Account",
                        "properties": {
                            "owners": ["me"],
                            "type": "bank-account"
                        },
                        "holdings": [
                            {
                                "symbol": "USD",
                                "units": 1000
                            }
                        ]
                    }
                ]
            }
            
            collection = db.portfolios
            await collection.insert_one(portfolio_data)
            print(f"Created minimal starter portfolio for user {user_id}")
            
    except Exception as e:
        print(f"Failed to create demo portfolio for user {user_id}: {e}")
        # Don't raise - let the user continue without a demo portfolio


async def get_current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
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
            firebase_uid=firebase_user.get("uid"),
        )
        result = await db.users.insert_one(new_user.dict(exclude={'id'}))
        new_user.id = str(result.inserted_id)
        # Note: No longer automatically creating demo portfolio
        # Users will create their own portfolios manually

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
