# Eagle Notifier

<div align="center">
  <img src="./assets/images/Eagle-Logo.png" alt="Eagle Notifier Logo" width="200" />
  <h3>Industrial Alarm Monitoring Made Simple</h3>
  <p>Real-time monitoring, instant notifications, and comprehensive alarm management for industrial SCADA systems</p>
</div>

## Table of Contents
- [Overview](#overview)
- [Business Value](#business-value)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Technologies Used](#technologies-used)
- [User Workflows](#user-workflows)
- [Getting Started](#getting-started)
- [SCADA Integration](#scada-integration)
- [User Roles](#user-roles)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Mobile App Build](#mobile-app-build)
- [License](#license)
- [Support](#support)

## Overview

Eagle Notifier is a comprehensive industrial alarm monitoring and notification system designed specifically for industrial environments with SCADA (Supervisory Control and Data Acquisition) systems. It bridges the gap between traditional industrial control systems and modern mobile technology, enabling operators and administrators to receive critical alerts, monitor system parameters, and manage alarms from anywhere.

The system continuously monitors industrial equipment parameters (temperatures, levels, pressures, equipment statuses) by connecting directly to SCADA databases. It processes this data in real-time to detect anomalies, trigger alarms, and send push notifications to responsible personnel based on configurable thresholds and business rules.

### Core Functionalities

- **24/7 Equipment Monitoring**: Continuous polling of SCADA data to detect deviations from setpoints
- **Intelligent Alarm Processing**: Categorization of alarms based on severity (critical, warning, info)
- **Multi-zone Monitoring**: Support for different zones and equipment types with specific thresholds
- **Complete Alarm Lifecycle**: From detection through acknowledgment to resolution with audit trail
- **Historical Data Analysis**: Tracking and reporting on past alarms and resolutions
- **Mobile-first Design**: Full functionality accessible via intuitive mobile interface
- **Role-based Permissions**: Differentiated experiences for operators vs. administrators

## Business Value

Eagle Notifier delivers significant value to industrial operations by:

- **Reducing Downtime**: Immediate notification of critical issues leads to faster response times
- **Preventing Equipment Damage**: Early warning of abnormal conditions helps prevent catastrophic failures
- **Improving Operational Efficiency**: Mobile access eliminates the need for constant physical monitoring
- **Enhancing Accountability**: Complete audit trail of who acknowledged and resolved which alarms
- **Supporting Compliance**: Documentation of all alarms and resolutions for regulatory requirements
- **Enabling Data-Driven Decisions**: Historical reporting identifies recurring issues and improvement opportunities
- **Lowering Operational Costs**: Reduced need for continuous on-site monitoring staff

## Key Features

- **Real-time Alarm Monitoring**: Monitor analog and binary alarms from industrial equipment
- **Push Notifications**: Receive instant alerts for critical system events on mobile devices
- **Role-based Access Control**: Different interfaces and permissions for operators and administrators
- **Alarm Management Workflow**: Acknowledge and resolve alarms with resolution tracking
- **Historical Reporting**: Generate reports on past alarms and system performance
- **Setpoint Configuration**: Customize alarm thresholds for different equipment
- **Modern Mobile UI**: User-friendly interface with light/dark mode support
- **Multi-zone Support**: Different monitoring zones with specific configurations
- **Offline Capabilities**: View previously loaded alarms even without network connectivity
- **Analytics Dashboard**: Visualize alarm trends and performance metrics
- **Resolution Documentation**: Track troubleshooting steps and resolution methods

## System Architecture

Eagle Notifier follows a modern client-server architecture optimized for reliability and real-time data processing.

### High-Level Architecture Diagram

```
┌─────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│                     │      │                    │      │                    │
│  Mobile Application ├──────►   Backend Server   ├──────►  PostgreSQL        │
│  (React Native)     │      │   (Node.js/Express)│      │  Database          │
│                     │      │                    │      │                    │
└─────────────────────┘      └────────────┬───────┘      └────────────────────┘
                                          │
                                          │
                                          ▼
                              ┌────────────────────┐
                              │                    │
                              │  SCADA Database    │
                              │                    │
                              └────────────────────┘
```

### Detailed System Architecture

```mermaid
flowchart TD
    subgraph "Mobile Clients"
        A[Operator App] 
        B[Admin App]
    end

    subgraph "Backend Services"
        C[API Gateway]
        D[Authentication Service]
        E[Alarm Processing Service]
        F[Notification Service]
        G[Reporting Service]
        H[User Management Service]
    end

    subgraph "Databases"
        I[(Application DB)]
        J[(SCADA DB)]
    end

    subgraph "External Services"
        K[Push Notification Service]
        L[Email Service]
    end

    A <--> C
    B <--> C
    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    D <--> I
    E <--> I
    F <--> I
    G <--> I
    H <--> I
    E <--> J
    F --> K
    F --> L
```

### Component Descriptions

1. **Mobile Clients**:
   - React Native application with different views for operators and administrators
   - Built with Expo framework for cross-platform compatibility

2. **API Gateway**:
   - Express.js server handling all client requests
   - Routes requests to appropriate services
   - Implements request validation and rate limiting

3. **Authentication Service**:
   - JWT-based authentication system
   - Role-based access control
   - Secure token storage and refresh mechanism

4. **Alarm Processing Service**:
   - Polls SCADA database at configurable intervals
   - Processes raw data against configurable thresholds
   - Generates appropriate alarms based on business rules
   - Updates alarm statuses in application database

5. **Notification Service**:
   - Sends push notifications to mobile devices
   - Manages notification preferences
   - Handles notification delivery status tracking

6. **Reporting Service**:
   - Generates historical alarm reports
   - Provides analytics on alarm frequency and resolution times
   - Exports data in various formats (PDF, CSV)

7. **User Management Service**:
   - Handles user creation, updates, and deletion
   - Manages user roles and permissions
   - Provides user profile functionality

8. **Databases**:
   - Application DB: PostgreSQL database storing application data, user information, and alarm history
   - SCADA DB: External database containing real-time industrial equipment data

9. **External Services**:
   - Push Notification Service: Expo Push Notification Service
   - Email Service: For sending reports and critical notifications

## Data Flow

The following diagram illustrates how data flows through the Eagle Notifier system:

```mermaid
sequenceDiagram
    participant SCADA as SCADA System
    participant Server as Backend Server
    participant DB as Application Database
    participant Mobile as Mobile App
    participant User as User/Operator

    SCADA->>Server: Real-time equipment data (polled)
    Server->>Server: Process data against thresholds
    Server->>DB: Store processed alarms
    Server->>Mobile: Push notifications for critical alarms
    Mobile->>User: Display notification
    User->>Mobile: Acknowledge alarm
    Mobile->>Server: Send acknowledgment
    Server->>DB: Update alarm status
    User->>Mobile: Enter resolution details
    Mobile->>Server: Send resolution data
    Server->>DB: Update alarm as resolved
    Server->>DB: Record resolution details
    User->>Mobile: Request report
    Mobile->>Server: Send report request
    Server->>DB: Query historical data
    DB->>Server: Return matching records
    Server->>Mobile: Send formatted report
    Mobile->>User: Display report
```

### Alarm Processing Flow

```mermaid
flowchart TD
    A[SCADA Data] --> B{Process Data}
    B -->|Within Limits| C[Normal Status]
    B -->|Warning Level| D[Warning Alarm]
    B -->|Critical Level| E[Critical Alarm]
    D --> F{Requires Action?}
    E --> F
    F -->|Yes| G[Generate Notification]
    G --> H[Push to Mobile]
    F -->|No| I[Log Only]
    H --> J[Await Acknowledgment]
    J --> K{Acknowledged?}
    K -->|Yes| L[Update Status]
    K -->|No| M[Escalate After Timeout]
    L --> N[Await Resolution]
    N --> O{Resolved?}
    O -->|Yes| P[Record Resolution]
    O -->|No| Q[Generate Reminder]
    P --> R[Update History]
    Q --> N
    M --> N
```

### Database Schema Overview

```mermaid
erDiagram
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ ALARM : "acknowledges"
    USER ||--o{ ALARM : "resolves"
    USER ||--o{ NOTIFICATION_SETTINGS : "configures"
    ALARM ||--o{ ALARM_HISTORY : "creates"
    SCADA_DB ||--o{ ALARM : "generates"
    SETPOINT ||--o{ ALARM : "configures"

    USER {
        string id PK
        string email
        string password
        string name
        enum role
        string avatar
        datetime createdAt
        datetime updatedAt
        string pushToken
    }
    
    ALARM {
        string id PK
        string description
        enum type
        enum zone
        enum severity
        enum status
        string value
        string setPoint
        string unit
        float lowLimit
        float highLimit
        string notes
        datetime timestamp
        string acknowledgedById FK
        datetime acknowledgedAt
        string resolvedById FK
        datetime resolvedAt
        string resolutionMessage
    }
    
    ALARM_HISTORY {
        string id PK
        string alarmId FK
        string description
        enum type
        enum severity
        enum status
        string value
        string setPoint
        datetime timestamp
        string acknowledgedById FK
        datetime acknowledgedAt
        string resolvedById FK
        datetime resolvedAt
        string resolutionMessage
    }
    
    NOTIFICATION {
        string id PK
        string userId FK
        string title
        string body
        enum type
        enum priority
        boolean isRead
        json metadata
        datetime createdAt
        datetime readAt
    }
    
    NOTIFICATION_SETTINGS {
        string id PK
        string userId FK
        boolean pushEnabled
        boolean emailEnabled
        boolean criticalOnly
        int muteFrom
        int muteTo
        datetime createdAt
        datetime updatedAt
    }
    
    SETPOINT {
        string id PK
        string name
        string type
        string zone
        string scadaField
        float lowDeviation
        float highDeviation
        datetime createdAt
        datetime updatedAt
    }
```

## Technologies Used

### Frontend
- **React Native / Expo**: Core framework for cross-platform mobile development
- **TypeScript**: Type-safe JavaScript for improved developer experience and code quality
- **NativeWind**: Tailwind CSS for React Native providing utility-first styling
- **Expo Router**: File-based navigation system for seamless screen transitions
- **TanStack Query**: Data fetching, caching, and state synchronization
- **Zustand**: Lightweight state management solution
- **Expo Notifications**: Push notification handling for real-time alerts
- **React Native Reanimated**: Advanced animations for fluid user experience

### Backend
- **Node.js with Express**: Server-side JavaScript runtime and API framework
- **TypeScript**: Type-safe backend development
- **Prisma ORM**: Type-safe database access and migrations
- **PostgreSQL**: Reliable relational database for data persistence
- **Docker**: Containerization for consistent deployment
- **JWT**: JSON Web Tokens for secure authentication
- **Winston**: Logging infrastructure for debugging and monitoring
- **Jest**: Testing framework for unit and integration tests

### DevOps
- **GitHub Actions**: CI/CD automation
- **Docker**: Containerization for deployment consistency
- **Azure App Service**: Cloud hosting platform
- **Azure Database**: Managed PostgreSQL service
- **Sentry**: Error tracking and monitoring

## User Workflows

### Operator Workflow

```mermaid
flowchart TD
    A[Start] --> B[Login]
    B --> C[Dashboard]
    C --> D[View Active Alarms]
    C --> E[View Notifications]
    C --> F[Generate Reports]
    D --> G[Acknowledge Alarm]
    D --> H[View Alarm Details]
    H --> G
    G --> I[Resolve Alarm]
    I --> J[Enter Resolution Details]
    J --> K[End]
    E --> L[Mark as Read]
    L --> K
    F --> M[Select Parameters]
    M --> N[View Report]
    N --> O[Export Report]
    O --> K
```

### Administrator Workflow

```mermaid
flowchart TD
    A[Start] --> B[Login]
    B --> C[Admin Dashboard]
    C --> D[Manage Users]
    C --> E[Configure Setpoints]
    C --> F[View System Stats]
    C --> G[Operator Functions]
    
    D --> H[Add User]
    D --> I[Edit User]
    D --> J[Delete User]
    H --> K[End]
    I --> K
    J --> K
    
    E --> L[Add Setpoint]
    E --> M[Modify Setpoint]
    L --> K
    M --> K
    
    F --> N[Analyze Performance]
    F --> P[View Logs]
    N --> Q[Export Stats]
    Q --> K
    P --> R[Filter Logs]
    R --> K
    
    G --> S[View Active Alarms]
    G --> T[Generate Reports]
    S --> K
    T --> K
```

### App Screens and Navigation Flow

```mermaid
flowchart TD
    A[Onboarding Screen] --> B{Authentication}
    B -->|Login Success| C[Dashboard]
    B -->|Login Failed| B
    
    C --> D[Alarm List]
    C --> E[Notifications]
    C --> F[Reports]
    C --> G[Settings]
    
    D --> H[Alarm Details]
    H --> I[Resolution Form]
    
    E --> J[Notification Details]
    
    F --> K[Report Generator]
    K --> L[Report Preview]
    L --> M[Export Report]
    
    G --> N[User Profile]
    G --> O[Theme Settings]
    G --> P[Notification Settings]
    
    subgraph Admin Only
    G --> Q[User Management]
    G --> R[System Settings]
    Q --> S[User Form]
    R --> T[Setpoint Config]
    end
```

## Getting Started

### Prerequisites

- Node.js v16+ with npm
- PostgreSQL database (v14+ recommended)
- SCADA system with accessible database
- Expo CLI (`npm install -g expo-cli`)
- Docker (optional, for containerized deployment)
- Azure account (optional, for cloud deployment)

### Environment Setup

1. **Clone the repository:**
```bash
git clone https://github.com/loginwaresofttech/eagle-notifier.git
cd eagle-notifier
```

2. **Install dependencies:**
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ..
npm install
```

3. **Configure environment variables:**
   - Create `.env` file in the backend directory based on `.env.example`
   - Configure the following variables:
     - `DATABASE_URL`: PostgreSQL connection string
     - `JWT_SECRET`: Secret for JWT token generation
     - `JWT_EXPIRE`: Token expiration time (e.g., "24h")
     - `REFRESH_TOKEN_EXPIRE`: Refresh token expiration (e.g., "7d")
     - `SCADA_POLL_INTERVAL`: Interval (ms) to poll SCADA data (default: 120000)
   - Create `.env` file in the root directory for Expo configuration:
     - `EXPO_PUBLIC_API_URL`: Backend API URL
     - `EXPO_PUBLIC_PROJECT_ID`: Expo project ID for push notifications

4. **Setup the database:**
```bash
cd backend
npx prisma migrate deploy
npx prisma db seed # Optional: Seed initial data
```

5. **Update configuration files:**
   - Verify API endpoints in `app/api/config.ts`
   - Check push notification settings in `app.json`

### Running the Application

#### Backend Development
```bash
cd backend
npm run dev
```

#### Mobile App Development
```bash
# Start Expo development server
npx expo start

# For specific platforms
npx expo start --android
npx expo start --ios
npx expo start --web
```

## SCADA Integration

Eagle Notifier connects directly to SCADA systems through a PostgreSQL database connection. The system polls the SCADA database at configurable intervals (default: 2 minutes) and processes the data to generate alarms.

### SCADA Data Structure

The application expects a SCADA table called `jk2` with the following fields:

#### Analog Values
- `hz1sv`, `hz1pv`: Hardening Zone 1 temperature setpoint and actual values
- `hz2sv`, `hz2pv`: Hardening Zone 2 temperature setpoint and actual values
- `cpsv`, `cppv`: Carbon potential setpoint and actual values
- `tz1sv`, `tz1pv`: Tempering Zone 1 temperature setpoint and actual values
- `tz2sv`, `tz2pv`: Tempering Zone 2 temperature setpoint and actual values
- `oilpv`: Oil temperature value

#### Binary Values
- Equipment status signals (boolean fields):
  - `oiltemphigh`, `oillevelhigh`, `oillevellow`
  - `hz1hfail`, `hz2hfail` (heater failures)
  - `hz1fanfail`, `hz2fanfail`, `tz1fanfail`, `tz2fanfail` (fan failures)
  - Various other equipment status indicators

### Data Processing Pipeline

1. **Data Polling**: The SCADA database is queried at regular intervals
2. **Setpoint Configuration**: The system fetches configurable thresholds from the database
3. **Alarm Severity Calculation**:
   - For analog values, severity is determined by comparing current values to setpoints with deviation bands
   - For binary values, severity is determined by the status (e.g., failure = critical)
4. **Notification Generation**: Alarms trigger notifications to be sent to users

### Setpoint Configuration

Administrators can configure alarm thresholds through the setpoint management interface. Each setpoint includes:

- **Name**: Descriptive name of the monitoring point
- **Type**: Equipment type (e.g., temperature, level, carbon, fan)
- **Zone**: Optional zone designation (e.g., zone1, zone2)
- **SCADA Field**: The field name in the SCADA database to monitor
- **Low Deviation**: Lower threshold limit (negative value)
- **High Deviation**: Upper threshold limit (positive value)

These configurations are stored in the `Setpoint` table and used by the alarm processing service to determine when to generate alarms.

## User Roles

The system implements a role-based access control system with two primary roles:

### Operator
- View active and historical alarms
- Acknowledge alarms to indicate they're being addressed
- Resolve alarms with detailed resolution notes
- Generate reports on alarm history
- Receive and manage notifications
- Update personal profile and notification preferences

### Administrator
- All operator capabilities
- Manage users:
  - Create new user accounts
  - Update existing user details
  - Delete user accounts
  - Reset user passwords
- Configure system setpoints for each equipment type and zone
- Access system dashboards with performance metrics
- View audit logs of system activities
- Configure global system settings

## API Endpoints

The backend provides a comprehensive REST API:

### Authentication
- `POST /api/auth/login`: User login
- `POST /api/auth/refresh-token`: Refresh authentication token
- `POST /api/auth/logout`: Invalidate current tokens
- `GET /api/auth/profile`: Get current user profile

### Alarms
- `GET /api/alarms`: Get active alarms
- `GET /api/alarms/:id`: Get a specific alarm details
- `PATCH /api/alarms/:id`: Update alarm status (acknowledge/resolve)
- `GET /api/alarms/history`: Get historical alarms
- `GET /api/alarms/stats`: Get alarm statistics

### Notifications
- `GET /api/notifications`: Get user notifications
- `GET /api/notifications/:id`: Get a specific notification
- `PATCH /api/notifications/:id/read`: Mark notification as read
- `PATCH /api/notifications/mark-all-read`: Mark all notifications as read
- `DELETE /api/notifications/:id`: Delete notification
- `PUT /api/notifications/push-token`: Update push notification token

### Operator Routes
- `GET /api/operator/dashboard`: Get operator dashboard data
- `GET /api/operator/reports`: Generate operator reports

### Admin Routes
- `GET /api/admin/users`: Get all users
- `POST /api/admin/users`: Create a new user
- `PUT /api/admin/users/:id`: Update user details
- `DELETE /api/admin/users/:id`: Delete a user
- `GET /api/admin/dashboard`: Get admin dashboard statistics
- `GET /api/admin/setpoints`: Get all setpoints
- `POST /api/admin/setpoints`: Create a new setpoint
- `PUT /api/admin/setpoints/:id`: Update a setpoint

### SCADA Routes
- `GET /api/scada/health`: Check SCADA database connection health
- `GET /api/scada/latest`: Get latest SCADA data

## Deployment

### Docker Deployment

The backend can be containerized and deployed using Docker:

```bash
cd backend
docker build -t eagle-notifier-app:latest .
docker run -p 8080:8080 --env-file .env eagle-notifier-app:latest
```

### Azure Deployment

The project includes a GitHub Actions workflow for continuous integration and deployment to Azure App Service.

## Mobile App Build

### Build Commands

To build the mobile app for production:

```bash
# For Android
eas build -p android --profile production

# For iOS
eas build -p ios --profile production

# For internal testing
eas build -p android --profile preview
```

### App Submission

After building:

1. For Google Play Store:
   - Download the AAB file from EAS
   - Upload to Google Play Console
   - Complete store listing and release to testing or production

2. For Apple App Store:
   - Build will be available in App Store Connect
   - Complete app review information
   - Submit for review

## License

This project is proprietary software developed by TecoSoft Digital Solutions.

## Support

For support or questions, please contact support@tecosoft.ai
