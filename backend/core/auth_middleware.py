from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from firebase_admin import auth
from models.base_model import AuthType
from typing import Optional

security_bearer = HTTPBearer()
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_bearer_token(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Verify bearer token - implement your logic here"""
    token = credentials.credentials
    # Add your token verification logic
    if not token or token != "your-secret-token":  # Replace with real verification
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return token

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """Verify API key - implement your logic here"""
    # Add your API key verification logic
    if not api_key or api_key != "your-api-key":  # Replace with real verification
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return api_key

async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Verify Firebase ID token"""
    try:
        token = credentials.credentials
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No authentication token provided"
            )
        
        # Verify the Firebase ID token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired Firebase token"
        )
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Revoked Firebase token"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}"
        )

async def get_current_user(token: dict = Depends(verify_firebase_token)):
    """Get current user from Firebase token"""
    try:
        user_id = token.get('uid')
        email = token.get('email')
        name = token.get('name', '')
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user token"
            )
        
        return {
            "user_id": user_id,
            "email": email,
            "name": name,
            "token_data": token
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Failed to get user data: {str(e)}"
        )

def get_auth_dependency(auth_type: AuthType):
    """Get the appropriate auth dependency based on auth type"""
    if auth_type == AuthType.BEARER:
        return Depends(verify_bearer_token)
    elif auth_type == AuthType.API_KEY:
        return Depends(verify_api_key)
    elif auth_type == AuthType.FIREBASE:
        return Depends(verify_firebase_token)
    else:
        return None
