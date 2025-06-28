#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display help
show_help() {
    echo -e "${BLUE}Usage: ./docker.sh [command]${NC}"
    echo ""
    echo "Commands:"
    echo "  build     - Build the Docker image"
    echo "  run       - Run the Docker container"
    echo "  stop      - Stop the running container"
    echo "  clean     - Remove the Docker image and container"
    echo "  help      - Show this help message"
}

# Function to build the Docker image
build() {
    echo -e "${GREEN}Building Docker image...${NC}"
    docker build --no-cache -t vestika-backend .
    echo -e "${GREEN}Build complete!${NC}"
}

# Function to run the Docker container
run() {
    echo -e "${GREEN}Running Docker container...${NC}"
    docker run -d -p 8080:8080 --name vestika-backend vestika-backend
    echo -e "${GREEN}Container is running!${NC}"
    echo -e "${BLUE}Access the API at http://localhost:8080${NC}"
}

# Function to stop the Docker container
stop() {
    echo -e "${GREEN}Stopping Docker container...${NC}"
    docker stop vestika-backend
    docker rm vestika-backend
    echo -e "${GREEN}Container stopped and removed!${NC}"
}

# Function to clean up Docker resources
clean() {
    echo -e "${GREEN}Cleaning up Docker resources...${NC}"
    docker stop vestika-backend 2>/dev/null || true
    docker rm vestika-backend 2>/dev/null || true
    docker rmi vestika-backend 2>/dev/null || true
    echo -e "${GREEN}Cleanup complete!${NC}"
}

# Main script logic
case "$1" in
    build)
        build
        ;;
    run)
        run
        ;;
    stop)
        stop
        ;;
    clean)
        clean
        ;;
    help|*)
        show_help
        ;;
esac 