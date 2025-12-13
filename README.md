[![Netlify Status](https://api.netlify.com/api/v1/badges/5564771f-4622-4d5b-adff-4f98832bbf0e/deploy-status)](https://app.netlify.com/projects/vestika/deploys)

# Portfolio Management System

A comprehensive portfolio management system with AI-powered analysis, real-time stock tracking, and interactive dashboards.

🌐 **Live Application**: [https://app.vestika.io](https://app.vestika.io)

## 🚀 Quick Start

### Prerequisites

- **Python 3.12+** (recommended: 3.13.3)
- **Node.js 18+** and **pnpm**
- **Docker** (optional, for containerized deployment)
- **MongoDB** and **Redis** (for backend services)

### Local Development Setup

#### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies using Poetry
poetry install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Start the backend server
poetry run uvicorn app.main:app --reload --port 8080
```

#### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies using pnpm
pnpm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration (see Environment Variables section)

# Start the development server
pnpm dev
```

The frontend will be available at `http://localhost:5173` and the backend API at `http://localhost:8080`.

### Docker Deployment

#### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

#### Manual Docker Build

```bash
# Build the backend image
docker build -t portfolio-backend .

# Run the backend container
docker run -p 8080:8080 --env-file backend/.env portfolio-backend
```

## 🔧 Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=closing_price_service

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# Finnhub API Configuration (required for US stocks)
# Get your free API key from https://finnhub.io/
FINNHUB_API_KEY=your_finnhub_api_key_here
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# Cache Configuration
CACHE_TTL_SECONDS=86400
TRACKING_EXPIRY_DAYS=7

# Logging
LOG_LEVEL=INFO

# Firebase Configuration
FIREBASE_FILE_PATH=firebase_credentials.json
FIREBASE_CREDENTIALS={}

# Google AI Configuration
# Get your API key from https://aistudio.google.com/apikey
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GOOGLE_AI_MODEL=gemini-2.5-flash
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```bash
# Backend API URL
VITE_API_URL=http://localhost:8080

# GrowthBook Configuration
VITE_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
VITE_GROWTHBOOK_CLIENT_KEY=sdk-JCSC6ZrWMHjBLLPA
```

## 📋 Detailed Setup Instructions

### Backend Setup (Detailed)

#### 1. Python Environment Setup

**Option A: Using pyenv (Recommended)**
```bash
# Install pyenv and pyenv-virtualenv
brew install pyenv pyenv-virtualenv

# Install Python 3.13.3
pyenv install 3.13.3
pyenv local 3.13.3

# Create virtual environment
pyenv virtualenv 3.13.3 portfolio
pyenv activate portfolio
pyenv local portfolio

# Add to ~/.zshrc:
eval "$(pyenv init -)"
eval "$(pyenv virtualenv-init -)"
```

**Option B: Using venv**
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### 2. Install Poetry and Dependencies

```bash
# Install Poetry (if not already installed)
curl -sSL https://install.python-poetry.org | python3 -

# Install project dependencies
poetry install

# Or install without dev dependencies for production
poetry install --no-dev
```

#### 3. Database Setup

**Using Docker (Recommended)**
```bash
# Start MongoDB and Redis
docker run -d --name mongodb -p 27017:27017 mongo:latest
docker run -d --name redis -p 6379:6379 redis:alpine
```

**Using Local Installation**
- Install MongoDB: https://docs.mongodb.com/manual/installation/
- Install Redis: https://redis.io/download

#### 4. API Keys Setup

1. **Finnhub API Key**: Get a free API key from [Finnhub](https://finnhub.io/) for US stock prices
2. **Google AI API Key**: Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) for AI features
3. **Firebase Credentials**: Set up Firebase project and download credentials file

### Frontend Setup (Detailed)

#### 1. Install pnpm

```bash
# Install pnpm globally
npm install -g pnpm

# Or using Homebrew (macOS)
brew install pnpm
```

#### 2. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install
```

#### 3. Development Server

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🏗️ Project Structure

```
portfolio/
├── backend/                 # Python FastAPI backend
│   ├── app/                # FastAPI application
│   ├── core/               # Core business logic
│   ├── models/             # Data models
│   ├── services/           # External services
│   ├── pyproject.toml      # Poetry configuration
│   └── env.example         # Environment variables template
├── frontend/               # React TypeScript frontend
│   ├── src/                # Source code
│   ├── components/         # React components
│   ├── package.json        # Node.js dependencies
│   └── env.example         # Environment variables template
├── Dockerfile              # Backend Docker configuration
└── docker-compose.yml      # Multi-service Docker setup
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
poetry run pytest
```

### Frontend Testing
```bash
cd frontend
pnpm test
```

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8080/docs
- **ReDoc**: http://localhost:8080/redoc

## 📢 Notification Templates (Admin)

The system supports a generic notification template system for announcing features, events, and updates to users.

### Creating a Notification Template

**Endpoint**: `POST /notifications/templates` (Admin only)

```bash
curl -X POST https://api.vestika.io/notifications/templates \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "feature_new_charts",
    "notification_type": "feature",
    "title_template": "New Charts Feature!",
    "message_template": "Hi {user_name}! Check out our new interactive charts.",
    "distribution_type": "push",
    "display_type": "both",
    "dismissal_type": "once",
    "link_url": "/portfolio",
    "link_text": "View Charts"
  }'
```

### Template Options

| Field | Options | Description |
|-------|---------|-------------|
| `notification_type` | `feature`, `welcome`, `rsu_vesting`, `system` | Type of notification |
| `distribution_type` | `push`, `pull`, `trigger` | How to distribute (see below) |
| `display_type` | `popup`, `bell`, `both` | Where notification appears |
| `dismissal_type` | `once`, `until_clicked`, `auto_expire` | When to stop showing |

### Distribution Types

- **`push`**: Immediately sends to targeted users (runs in background)
- **`pull`**: Users receive notification on next login/fetch
- **`trigger`**: Only created by event handlers (RSU vesting, etc.)

### Targeting (Optional)

Target specific users or groups instead of all users:

| Field | Type | Description |
|-------|------|-------------|
| `target_user_ids` | `string[]` | Specific Firebase UIDs to target |
| `target_filter` | `object` | Filter criteria (see below) |

**Filter Options:**
- `has_holding`: User has a holding with this symbol (e.g., `"AAPL"`)
- `has_account_type`: User has account of this type (e.g., `"401k"`, `"company-custodian-account"`)
- `has_portfolio`: User has at least one portfolio (`true`)

**Examples:**

```json
// Target specific users
{
  "target_user_ids": ["firebase_uid_1", "firebase_uid_2"]
}

// Target users who hold AAPL
{
  "target_filter": {"has_holding": "AAPL"}
}

// Target users with 401k accounts
{
  "target_filter": {"has_account_type": "401k"}
}
```

If neither `target_user_ids` nor `target_filter` is specified, the notification goes to all users.

### Variable Substitution

Templates support `{variable}` placeholders:
- `{user_name}` - User's display name (always available)
- `{symbol}` - Stock symbol (for RSU notifications)
- `{units}` - Number of units (for RSU notifications)
- `{account_name}` - Account name (for RSU notifications)

### Example: Feature Announcement

```json
{
  "template_id": "feature_tax_planner_v1",
  "notification_type": "feature",
  "title_template": "New Tax Planner Tool!",
  "message_template": "Hi {user_name}! Plan your tax scenarios with our new Tax Planner tool.",
  "distribution_type": "pull",
  "display_type": "both",
  "dismissal_type": "once",
  "link_url": "/tools",
  "link_text": "Try it now"
}
```

### Admin
Only Admins can create/manage templates:

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


