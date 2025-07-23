# Technology Stack

## Frontend (Mobile App)
- **Framework**: React Native with Expo (~52.0)
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand + TanStack Query
- **UI Components**: Custom components with Expo Vector Icons
- **Notifications**: Expo Notifications
- **Data Fetching**: Axios with TanStack Query
- **Charts**: React Native Gifted Charts
- **File Handling**: ExcelJS for report generation

## Backend (API Server)
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with bcryptjs
- **File Processing**: ExcelJS, PDFKit
- **Scheduling**: node-schedule for SCADA polling
- **Testing**: Jest with ts-jest
- **Containerization**: Docker

## Development Tools
- **Package Manager**: npm (backend), yarn (frontend)
- **Linting**: ESLint with Expo config
- **Formatting**: Prettier
- **Build System**: TypeScript compiler, Expo CLI
- **Testing**: Jest for backend unit tests

## Common Commands

### Frontend Development
```bash
# Start development server
npm start
# or
npx expo start

# Platform-specific development
npx expo start --android
npx expo start --ios
npx expo start --web

# Build for production
eas build -p android --profile production
eas build -p ios --profile production
```

### Backend Development
```bash
# Start development server
npm run dev

# Build and serve
npm run build
npm run serve

# Database operations
npm run migrate
npx prisma generate
npx prisma db seed

# Testing
npm test
npm run test:watch
```

### Project Setup
```bash
# Install all dependencies
npm install  # root directory
cd backend && npm install

# Environment setup
cp .env.example .env  # configure variables
cp backend/.env.example backend/.env
```

## Architecture Patterns
- **Multi-tenant**: Organization-based data isolation
- **RESTful API**: Express routes with middleware
- **Repository Pattern**: Prisma ORM for data access
- **Service Layer**: Business logic separation
- **Middleware**: Authentication, error handling, rate limiting
- **Real-time Polling**: Scheduled SCADA data collection