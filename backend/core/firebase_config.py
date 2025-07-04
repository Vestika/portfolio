import firebase_admin
from firebase_admin import credentials
import os
from typing import Optional

# Initialize Firebase Admin SDK
_firebase_app: Optional[firebase_admin.App] = None

def initialize_firebase():
    """Initialize Firebase Admin SDK with service account credentials"""
    global _firebase_app
    
    if _firebase_app is not None:
        return _firebase_app
    
    try:
        # Check if we have service account credentials
        service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        
        if service_account_path and os.path.exists(service_account_path):
            # Use service account file
            cred = credentials.Certificate(service_account_path)
            _firebase_app = firebase_admin.initialize_app(cred)
        else:
            # Use default credentials (for development)
            _firebase_app = firebase_admin.initialize_app()
            
        print("Firebase Admin SDK initialized successfully")
        return _firebase_app
        
    except Exception as e:
        print(f"Failed to initialize Firebase Admin SDK: {e}")
        return None

def get_firebase_app() -> Optional[firebase_admin.App]:
    """Get the Firebase app instance"""
    if _firebase_app is None:
        return initialize_firebase()
    return _firebase_app

def log_event(event_name: str, parameters: dict = None):
    """Log a custom event to Firebase Analytics"""
    try:
        app = get_firebase_app()
        if app:
            # Note: Firebase Admin SDK doesn't directly support analytics events
            # This is a placeholder for future implementation
            print(f"Firebase Event: {event_name} - {parameters}")
    except Exception as e:
        print(f"Failed to log Firebase event: {e}")

def log_error(error_type: str, error_message: str, additional_data: dict = None):
    """Log an error event to Firebase"""
    try:
        log_event(f"{error_type}_error", {
            "error_message": error_message,
            **(additional_data or {})
        })
    except Exception as e:
        print(f"Failed to log Firebase error: {e}") 