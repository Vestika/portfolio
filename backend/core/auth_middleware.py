from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
from models.base_model import AuthType

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

def get_auth_dependency(auth_type: AuthType):
    """Get the appropriate auth dependency based on auth type"""
    if auth_type == AuthType.BEARER:
        return Depends(verify_bearer_token)
    elif auth_type == AuthType.API_KEY:
        return Depends(verify_api_key)
    else:
        return None
