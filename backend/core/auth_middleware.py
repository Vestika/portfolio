from fastapi import HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from models.base_model import AuthType
from .auth import get_current_user

security_bearer = HTTPBearer()
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_bearer_token(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Verify Firebase bearer token"""
    # This function is now a wrapper around get_current_user for compatibility
    # The actual Firebase verification is handled by the middleware
    pass

async def verify_api_key(api_key: str = Depends(api_key_header)):
    """Verify API key - implement your logic here"""
    # Add your API key verification logic
    if not api_key or api_key != "your-api-key":  # Replace with real verification
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return api_key

def get_auth_dependency(auth_type: AuthType):
    """Get the appropriate auth dependency based on auth type"""
    if auth_type == AuthType.BEARER:
        return Depends(get_current_user)
    elif auth_type == AuthType.API_KEY:
        return Depends(verify_api_key)
    else:
        return None
