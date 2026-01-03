"""
Test script to verify uvicorn access logs have timestamps
"""
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/test")
async def test():
    return {"message": "Test endpoint"}

if __name__ == "__main__":
    # Configure uvicorn logging with timestamps
    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)-8s | %(name)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
            "access": {
                "format": "%(asctime)s | %(levelname)-8s | %(client_addr)s - %(request_line)s %(status_code)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stderr",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO"},
            "uvicorn.error": {"level": "INFO"},
            "uvicorn.access": {"handlers": ["access"], "level": "INFO", "propagate": False},
        },
    }
    
    print("=" * 80)
    print("Starting test server with timestamped access logs...")
    print("Visit http://localhost:8888/test to see access logs with timestamps")
    print("Press Ctrl+C to stop")
    print("=" * 80)
    
    uvicorn.run(app, host="127.0.0.1", port=8888, log_config=log_config)

