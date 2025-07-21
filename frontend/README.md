# Portfolio Frontend

A React TypeScript frontend for the portfolio management system with modern UI components, real-time data visualization, and AI-powered insights.

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (recommended: 20.x)
- **pnpm** for package management
- **Backend API** running on `http://localhost:8080`

### Local Development Setup

#### 1. Install pnpm

```bash
# Install pnpm globally using npm
npm install -g pnpm

# Or using Homebrew (macOS)
brew install pnpm

# Or using other package managers
# Windows (using PowerShell)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# Linux/macOS (using curl)
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

#### 2. Install Dependencies

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install
```

#### 3. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
# See Environment Variables section below
```

#### 4. Start Development Server

```bash
# Start development server with hot reload
pnpm dev

# The application will be available at http://localhost:5173
```

## 🔧 Environment Variables

Create a `.env` file in the frontend directory:

```bash
# Backend API URL
VITE_API_URL=http://localhost:8080

# GrowthBook Configuration
VITE_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
VITE_GROWTHBOOK_CLIENT_KEY=sdk-JCSC6ZrWMHjBLLPA
```

### Environment Variable Details

- **VITE_API_URL**: URL of the backend API server
- **VITE_GROWTHBOOK_API_HOST**: GrowthBook CDN host for feature flags
- **VITE_GROWTHBOOK_CLIENT_KEY**: GrowthBook client key for feature management

## 🏗️ Project Structure

```
frontend/
├── src/                    # Source code
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components
│   │   ├── AIAnalyst.tsx  # AI analysis component
│   │   ├── Login.tsx      # Authentication component
│   │   └── ...            # Other components
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.tsx # Authentication context
│   │   └── GrowthBookProvider.tsx # Feature flags
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── utils/             # Utility functions
│   ├── types.ts           # TypeScript type definitions
│   ├── App.tsx            # Main application component
│   └── main.tsx           # Application entry point
├── public/                # Static assets
├── package.json           # Dependencies and scripts
├── pnpm-lock.yaml        # Locked dependencies
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
└── env.example           # Environment template
```

## 📦 Available Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm preview          # Preview production build
pnpm lint             # Run ESLint
pnpm type-check       # Run TypeScript type checking

# Package management
pnpm install          # Install dependencies
pnpm add <package>    # Add new dependency
pnpm remove <package> # Remove dependency
pnpm update           # Update dependencies
```

## 🎨 UI Framework

The application uses a modern UI stack:

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Material-UI** for additional components
- **Highcharts** for data visualization
- **Lucide React** for icons

## 🔐 Authentication

The frontend integrates with Firebase Authentication:

- Google Sign-In
- Email/Password authentication
- Protected routes
- User context management

## 📊 Features

### Portfolio Management
- Real-time portfolio tracking
- Interactive charts and visualizations
- Performance analytics
- Asset allocation breakdown

### AI-Powered Analysis
- Portfolio insights and recommendations
- Risk assessment
- Market analysis
- Investment suggestions

### Tagging System
- Custom portfolio tagging
- Categorization and filtering
- Tag-based analytics
- Flexible organization

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts
- Touch-optimized interactions
- Cross-device compatibility

## 🧪 Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## 🔍 Development Tools

### Code Quality

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type checking
pnpm type-check

# Format code (if Prettier is configured)
pnpm format
```

### Build and Deployment

```bash
# Development build
pnpm build:dev

# Production build
pnpm build

# Preview production build
pnpm preview

# Analyze bundle size
pnpm build:analyze
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# From project root
docker-compose up --build
```

### Manual Docker Build

```bash
# Build the image
docker build -t portfolio-frontend .

# Run the container
docker run -p 3000:80 portfolio-frontend
```

## 📱 Mobile Support

The application is fully responsive and optimized for mobile devices:

- Touch-friendly interface
- Adaptive navigation
- Optimized charts for small screens
- Progressive Web App (PWA) features

## 🔧 Configuration Files

### Vite Configuration (`vite.config.ts`)
- React plugin configuration
- Development server settings
- Build optimization
- Environment variable handling

### Tailwind Configuration (`tailwind.config.js`)
- Custom color palette
- Component styling
- Responsive breakpoints
- Animation configurations

### TypeScript Configuration (`tsconfig.json`)
- Compiler options
- Path mappings
- Strict type checking
- Module resolution

## 📦 Key Dependencies

### Core Dependencies
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework

### UI Components
- **Radix UI**: Accessible component primitives
- **Material-UI**: React component library
- **Lucide React**: Icon library
- **Highcharts**: Data visualization

### State Management
- **React Context**: Built-in state management
- **GrowthBook**: Feature flag management

### HTTP Client
- **Axios**: HTTP client for API calls

### Development Tools
- **ESLint**: Code linting
- **TypeScript**: Type checking
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## 🤝 Contributing

1. Set up the development environment
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and type checking
6. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Use functional components with hooks
- Implement proper error boundaries
- Write accessible components
- Add proper TypeScript types
- Follow the established code style

## 📄 License

This project is licensed under the MIT License.
