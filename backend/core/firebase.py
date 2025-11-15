import firebase_admin
import json
from firebase_admin import credentials, auth
from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings

# Global variable to track if Firebase has been initialized
_firebase_initialized = False

def _initialize_firebase():
    """Initialize Firebase lazily, only when actually needed"""
    global _firebase_initialized
    
    if _firebase_initialized:
        return
    
    try:
        # Initialize Firebase credentials from environment variable or file
        if settings.firebase_credentials:
            # Use credentials from environment variable
            cred_dict = json.loads(settings.firebase_credentials)
            cred = credentials.Certificate(cred_dict)
        else:
            # Use credentials from file
            cred = credentials.Certificate(settings.firebase_file_path)

        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
    except Exception as e:
        raise e


class FirebaseAuthMiddleware(BaseHTTPMiddleware):
    """Middleware to apply Firebase authentication to all endpoints"""
    
    def __init__(self, app, exclude_paths: list[str] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/docs", "/openapi.json", "/redoc"]
    
    async def dispatch(self, request: Request, call_next):
        
        # Initialize Firebase if not already done (only in production)
        _initialize_firebase()
        
        # Skip authentication for excluded paths (use startswith for pattern matching)
        for excluded_path in self.exclude_paths:
            if request.url.path.startswith(excluded_path):
                return await call_next(request)
        
        # Check for Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            # For now, let the endpoint handle authentication
            # This allows endpoints to use get_current_user dependency
            return await call_next(request)
        
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        token = auth_header.split(" ")[1]
        
        try:
            # Verify the Firebase ID token
            decoded_token = auth.verify_id_token(token)
            request.state.user = decoded_token
        except Exception as e:
            raise HTTPException(status_code=401, detail="Invalid token or expired token")
        
        return await call_next(request) 