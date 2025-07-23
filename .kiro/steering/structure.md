# Project Structure

## Root Directory Organization
```
Eagle-Notifier/
├── app/                    # React Native mobile app (Expo Router)
├── backend/                # Node.js API server
├── assets/                 # Static assets (images, fonts, sounds)
├── constants/              # Configuration files (Firebase, etc.)
├── cursorUpdates/          # Development documentation
├── database/               # Database schema documentation
├── ml/                     # Machine learning components
└── .kiro/                  # Kiro configuration and steering
```

## Mobile App Structure (`app/`)
- **File-based routing** with Expo Router
- **(auth)/** - Authentication screens (login)
- **(dashboard)/** - Main application screens
  - **alarms/** - Alarm management screens
  - **meter-readings/** - Electrical parameter monitoring
  - **notifications/** - Push notification management
  - **reports/** - Report generation and viewing
  - **screens/admin/** - Administrator-only screens
- **api/** - API client configuration and services
- **components/** - Reusable UI components
- **context/** - React context providers (Auth, Theme, Maintenance)
- **hooks/** - Custom React hooks for data fetching
- **services/** - Business logic and utilities
- **store/** - Zustand state management
- **types/** - TypeScript type definitions
- **utils/** - Helper functions and utilities

## Backend Structure (`backend/`)
```
backend/
├── src/
│   ├── config/             # Database and external service configs
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Express middleware (auth, error handling)
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic layer
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Helper functions
├── prisma/                 # Database schema and migrations
└── server.ts               # Application entry point
```

## Key Conventions

### File Naming
- **React Native**: PascalCase for components (`AlarmCard.tsx`)
- **Backend**: camelCase for services (`alarmService.ts`)
- **Routes**: kebab-case for API endpoints (`/api/meter-readings`)
- **Database**: snake_case for table/column names

### Directory Patterns
- **Screens**: Organized by feature area (alarms, notifications, reports)
- **Components**: Shared UI components in `/components`
- **Services**: Business logic separated from UI components
- **Types**: Centralized TypeScript definitions per domain
- **Tests**: Co-located with source files (`__tests__/` directories)

### Multi-tenant Architecture
- **Organization-based isolation**: All data scoped to organization ID
- **Configurable SCADA connections**: Per-organization database configs
- **Role-based access**: User roles determine available features
- **Shared services**: Common functionality across organizations

### API Structure
- **RESTful endpoints**: Standard HTTP methods and status codes
- **Route grouping**: Organized by feature (auth, alarms, admin)
- **Middleware chain**: Authentication → validation → business logic
- **Error handling**: Centralized error middleware with logging

### Database Schema
- **Prisma ORM**: Type-safe database access
- **Multi-tenant**: Organization foreign keys on all entities
- **Audit trails**: Created/updated timestamps on all models
- **Enums**: Strongly typed status and role definitions