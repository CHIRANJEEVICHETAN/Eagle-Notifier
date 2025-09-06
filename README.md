# Eagle Notifier

<div align="center">
  <img src="./assets/images/Eagle-Logo.png" alt="Eagle Notifier Logo" width="200" />
  <h3>Industrial Alarm Monitoring Made Simple</h3>
  <p>Real-time monitoring, instant notifications, and comprehensive alarm management for industrial SCADA systems</p>
</div>

[![CI/CD for Eagle-Notifier IIS Deployment](https://github.com/CHIRANJEEVICHETAN/Eagle-Notifier/actions/workflows/main_eagle-notifier.yml/badge.svg?branch=main&event=workflow_run)](https://github.com/CHIRANJEEVICHETAN/Eagle-Notifier/actions/workflows/main_eagle-notifier.yml)

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
- [Meter Readings Feature](#meter-readings-feature)
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
- **Meter Readings Analysis**: Real-time and historical electrical parameter monitoring with report generation
- **Multi-Organization Support**: Scalable architecture supporting multiple companies with complete isolation
- **AI-Powered Configuration**: Gemini AI integration for automatic schema configuration and validation
- **Advanced User Management**: Comprehensive user management across all organizations

## Business Value

Eagle Notifier delivers significant value to industrial operations by:

- **Reducing Downtime**: Immediate notification of critical issues leads to faster response times
- **Preventing Equipment Damage**: Early warning of abnormal conditions helps prevent catastrophic failures
- **Improving Operational Efficiency**: Mobile access eliminates the need for constant physical monitoring
- **Enhancing Accountability**: Complete audit trail of who acknowledged and resolved which alarms
- **Supporting Compliance**: Documentation of all alarms and resolutions for regulatory requirements
- **Enabling Data-Driven Decisions**: Historical reporting identifies recurring issues and improvement opportunities
- **Lowering Operational Costs**: Reduced need for continuous on-site monitoring staff
- **Optimizing Energy Usage**: Meter readings help identify inefficiencies and optimize energy consumption
- **Scaling Operations**: Multi-organization support enables growth without system limitations
- **Automating Configuration**: AI-powered setup reduces implementation time and errors

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
- **Meter Readings**: Monitor electrical parameters with historical data and custom reports
- **Excel Report Generation**: Create customizable reports with selected parameters and date ranges
- **Time-based Filtering**: View historical data based on customizable time ranges
- **Multi-Organization Management**: Centralized control of multiple companies with complete data isolation
- **AI-Powered Configuration**: Automatic schema detection and configuration using Gemini AI
- **Advanced User Management**: Create, edit, and manage users across all organizations
- **SCADA Integration**: Flexible database connections for various SCADA systems
- **Organization Status Management**: Enable/disable organizations as needed
- **Comprehensive Schema Mapping**: Custom column configurations for different industrial systems

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
        C[Super Admin App]
    end

    subgraph "Backend Services"
        D[API Gateway]
        E[Authentication Service]
        F[Alarm Processing Service]
        G[Notification Service]
        H[Reporting Service]
        I[User Management Service]
        J[Meter Reading Service]
        K[Organization Management Service]
        L[SCADA Integration Service]
    end

    subgraph "Databases"
        M[(Application DB)]
        N[(SCADA DB)]
    end

    subgraph "External Services"
        O[Push Notification Service]
        P[Email Service]
        Q[Gemini AI Service]
    end

    A <--> D
    B <--> D
    C <--> D
    D --> E
    D --> F
    D --> G
    D --> H
    D --> I
    D --> J
    D --> K
    D --> L
    E <--> M
    F <--> M
    G <--> M
    H <--> M
    I <--> M
    J <--> M
    K <--> M
    L <--> N
    F <--> N
    G --> O
    G --> P
    K --> Q
    L --> Q
```

### Component Descriptions

1. **Mobile Clients**:
   - React Native application with different views for operators, administrators, and super administrators
   - Built with Expo framework for cross-platform compatibility
   - Role-specific dashboards and interfaces

2. **API Gateway**:
   - Express.js server handling all client requests
   - Routes requests to appropriate services
   - Implements request validation and rate limiting
   - Multi-tenant support with organization isolation

3. **Authentication Service**:
   - JWT-based authentication system
   - Role-based access control (SUPER_ADMIN, ADMIN, OPERATOR)
   - Secure token storage and refresh mechanism
   - Organization-based user isolation

4. **Alarm Processing Service**:
   - Polls SCADA database at configurable intervals
   - Processes raw data against configurable thresholds
   - Generates appropriate alarms based on business rules
   - Updates alarm statuses in application database
   - Multi-organization alarm processing

5. **Notification Service**:
   - Sends push notifications to mobile devices
   - Manages notification preferences
   - Handles notification delivery status tracking
   - Supports priority-based alerts and muting schedules
   - Organization-specific notification routing

6. **Reporting Service**:
   - Generates historical alarm reports
   - Provides analytics on alarm frequency and resolution times
   - Exports data in various formats (PDF, Excel)
   - Multi-organization report generation

7. **User Management Service**:
   - Handles user creation, updates, and deletion
   - Manages user roles and permissions
   - Provides user profile functionality
   - Organization-based user management
   - Cross-organization user administration for SUPER_ADMIN

8. **Meter Reading Service**:
   - Monitors electrical parameters (voltage, current, frequency, etc.)
   - Processes readings against configurable thresholds
   - Generates reports with customizable parameters
   - Provides historical data visualization and analysis
   - Organization-specific meter monitoring

9. **Organization Management Service**:
   - Creates and manages multiple organizations
   - Configures SCADA connections per organization
   - Manages organization status (enabled/disabled)
   - Handles schema mapping and configuration
   - AI-powered automatic configuration

10. **SCADA Integration Service**:
    - Connects to various SCADA database types
    - Manages database connections and pooling
    - Handles data polling and processing
    - Supports multiple database schemas
    - Organization-specific SCADA configurations

11. **Databases**:
    - Application DB: PostgreSQL database storing application data, user information, alarm history, meter reports, and organization data
    - SCADA DB: External database containing real-time industrial equipment data and meter readings

12. **External Services**:
    - Push Notification Service: Expo Push Notification Service
    - Email Service: For sending reports and critical notifications
    - Gemini AI Service: AI-powered configuration and validation

## Data Flow

The following diagram illustrates how data flows through the Eagle Notifier system:

```mermaid
sequenceDiagram
    participant SCADA as SCADA System
    participant Server as Backend Server
    participant DB as Application Database
    participant Mobile as Mobile App
    participant User as User/Operator
    participant AI as Gemini AI

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
    SCADA->>Server: Meter readings data (polled)
    Server->>Server: Process readings against limits
    Server->>DB: Store processed meter readings
    Server->>Mobile: Push notifications for limit violations
    User->>Mobile: Request meter report
    Mobile->>Server: Send meter report parameters
    Server->>SCADA: Query meter history
    SCADA->>Server: Return meter readings data
    Server->>Server: Generate Excel report
    Server->>DB: Store report file
    Server->>Mobile: Send report metadata
    Mobile->>Server: Download report file
    Mobile->>User: Display/share report
    User->>Mobile: Configure organization
    Mobile->>Server: Send organization config
    Server->>AI: Validate configuration
    AI->>Server: Return validation result
    Server->>DB: Store organization config
    Server->>Mobile: Confirm configuration
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

### Meter Reading Flow

```mermaid
flowchart TD
    A[Meter Readings] --> B[Store in Database]
    B --> C{Check Against Limits}
    C -->|Within Limits| D[Normal Status]
    C -->|Exceeds Limits| E[Generate Alert]
    E --> F[Push Notification]
    B --> G[Historical Storage]
    G --> H{User Request}
    H -->|View History| I[Display Readings]
    H -->|Generate Report| J[Select Parameters]
    J --> K[Date Range Selection]
    K --> L[Create Excel Report]
    L --> M[Store Report]
    M --> N[Download/Share]
```

### Organization Management Flow

```mermaid
flowchart TD
    A[Create Organization] --> B[Configure SCADA Connection]
    B --> C[Set Database Parameters]
    C --> D[Configure Schema Mapping]
    D --> E{Use AI Auto-Config?}
    E -->|Yes| F[Gemini AI Analysis]
    E -->|No| G[Manual Configuration]
    F --> H[Validate Configuration]
    G --> H
    H --> I{Valid?}
    I -->|No| J[Show Errors]
    I -->|Yes| K[Save Configuration]
    J --> D
    K --> L[Create Users]
    L --> M[Set Permissions]
    M --> N[Enable Organization]
    N --> O[Start Monitoring]
```

### Database Schema Overview

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : "contains"
    ORGANIZATION ||--o{ ALARM : "generates"
    ORGANIZATION ||--o{ METER_READINGS : "generates"
    ORGANIZATION ||--o{ SCADA_CONFIG : "configures"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ ALARM : "acknowledges"
    USER ||--o{ ALARM : "resolves"
    USER ||--o{ NOTIFICATION_SETTINGS : "configures"
    USER ||--o{ METER_REPORT : "generates"
    ALARM ||--o{ ALARM_HISTORY : "creates"
    SCADA_DB ||--o{ ALARM : "generates"
    SCADA_DB ||--o{ METER_READINGS : "generates"
    METER_LIMIT ||--o{ METER_READINGS : "configures"
    SETPOINT ||--o{ ALARM : "configures"

    ORGANIZATION {
        string id PK
        string name
        json scadaDbConfig
        json schemaConfig
        boolean isEnabled
        datetime createdAt
        datetime updatedAt
    }

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
        string organizationId FK
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
        string organizationId FK
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
        string organizationId FK
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
        string organizationId FK
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
        string organizationId FK
    }
    
    METER_READINGS {
        int meter_id PK
        float voltage
        float current
        float frequency
        float pf
        float energy
        float power
        datetime created_at
        string organizationId FK
    }
    
    METER_LIMIT {
        string id PK
        string parameter
        string description
        string unit
        float highLimit
        float lowLimit
        datetime createdAt
        datetime updatedAt
        string organizationId FK
    }
    
    METER_REPORT {
        string id PK
        string userId FK
        string title
        string format
        bytes fileContent
        string fileName
        int fileSize
        datetime startDate
        datetime endDate
        string[] parameters
        datetime createdAt
        json metadata
        string organizationId FK
    }

    SCADA_CONFIG {
        string id PK
        string organizationId FK
        string host
        int port
        string user
        string password
        string database
        string sslmode
        string table
        json schemaMapping
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
- **FlashList**: High-performance list component for optimized rendering
- **ExcelJS**: Excel report generation and manipulation

### Backend
- **Node.js with Express**: Server-side JavaScript runtime and API framework
- **TypeScript**: Type-safe backend development
- **Prisma ORM**: Type-safe database access and migrations
- **PostgreSQL**: Reliable relational database for data persistence
- **Docker**: Containerization for consistent deployment
- **JWT**: JSON Web Tokens for secure authentication
monitoring
- **ExcelJS**: Server-side Excel report generation
- **Jest**: Testing framework for unit and integration tests
- **Gemini AI**: Google's AI service for intelligent configuration

### DevOps
- **GitHub Actions**: CI/CD automation
- **Docker**: Containerization for deployment consistency
- **Azure App Service**: Cloud hosting platform
- **Azure Database**: Managed PostgreSQL service
- **Sentry**: Error tracking and monitoring

## User Workflows

### Super Administrator Workflow

```mermaid
flowchart TD
    A[Start] --> B[Login as Super Admin]
    B --> C[Super Admin Dashboard]
    C --> D[Organization Management]
    C --> E[User Management]
    C --> F[System Analytics]
    
    D --> G[Create Organization]
    D --> H[Configure SCADA Connection]
    D --> I[Set Schema Mapping]
    D --> J[Enable/Disable Organization]
    
    G --> K[Set Organization Details]
    K --> L[Configure Database Connection]
    L --> M[Set Schema Configuration]
    M --> N[Test Connection]
    N --> O[Save Configuration]
    
    E --> P[View All Users]
    E --> Q[Create New User]
    E --> R[Edit User Details]
    E --> S[Assign Roles & Organizations]
    
    F --> T[View System Metrics]
    F --> U[Monitor Organization Status]
    F --> V[Generate System Reports]
    
    O --> W[End]
    S --> W
    V --> W
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
    C --> X[Configure Meter Limits]
    
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
    
    X --> Y[Set Parameter Limits]
    Y --> Z[Update Threshold Values]
    Z --> K
```

### Operator Workflow

```mermaid
flowchart TD
    A[Start] --> B[Login]
    B --> C[Dashboard]
    C --> D[View Active Alarms]
    C --> E[View Notifications]
    C --> F[Generate Reports]
    C --> P[View Meter Readings]
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
    P --> Q[View Live Readings]
    P --> R[View Reading History]
    P --> S[Generate Meter Report]
    Q --> K
    R --> K
    S --> T[Select Date Range]
    T --> U[Select Parameters]
    U --> V[Download Report]
    V --> K
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
    C --> Q[Meter Readings]
    
    D --> H[Alarm Details]
    H --> I[Resolution Form]
    
    E --> J[Notification Details]
    
    F --> K[Report Generator]
    K --> L[Report Preview]
    L --> M[Export Report]
    
    G --> N[User Profile]
    G --> O[Theme Settings]
    G --> P[Notification Settings]
    
    Q --> R[Live Readings]
    Q --> S[Readings History]
    Q --> T[Reports]
    S --> U[Time-based Filtering]
    T --> V[Report Generator]
    V --> W[Report Preview]
    
    subgraph Admin Only
    G --> X[User Management]
    G --> Y[System Settings]
    X --> Z[User Form]
    Y --> AA[Setpoint Config]
    Y --> AB[Meter Limit Config]
    end

    subgraph Super Admin Only
    C --> AC[Organization Management]
    C --> AD[Super Admin Dashboard]
    AC --> AE[Organization Form]
    AC --> AF[SCADA Configuration]
    AC --> AG[Schema Mapping]
    AD --> AH[System Analytics]
    AD --> AI[Cross-Organization Users]
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
- Gemini AI API key (for AI-powered configuration)

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
     - `GEMINI_API_KEY`: Google Gemini AI API key for intelligent configuration
   - Create `.env` file in the root directory for Expo configuration:
     - `EXPO_PUBLIC_API_URL`: Backend API URL
     - `EXPO_PUBLIC_PROJECT_ID`: Expo project ID for push notifications
     - `EXPO_PUBLIC_PUSH_NOTIFICATION_ENDPOINT`: Expo push token endpoint

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

### Multi-Organization SCADA Configuration

Each organization can have its own SCADA configuration:

```typescript
interface ScadaDbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslmode: string;
  table: string;
}

interface SchemaConfig {
  columns: string[];
  columnConfigs: {
    [columnName: string]: {
      name: string;
      type: string;
      zone?: string;
      unit?: string;
      isAnalog: boolean;
      isBinary: boolean;
      lowDeviation?: number;
      highDeviation?: number;
    };
  };
}
```

### AI-Powered Configuration

The system uses Gemini AI to automatically detect and configure columns:

1. **Pattern Recognition**: Automatically identifies temperature zones, equipment types, and sensor patterns
2. **Smart Defaults**: Generates appropriate configurations based on column naming conventions
3. **Validation**: Checks configuration syntax and provides error correction
4. **Learning**: Improves accuracy over time with usage patterns

### Data Processing Pipeline

1. **Data Polling**: The SCADA database is queried at regular intervals per organization
2. **Setpoint Configuration**: The system fetches configurable thresholds from the database
3. **Alarm Severity Calculation**:
   - For analog values, severity is determined by comparing current values to setpoints with deviation bands
   - For binary values, severity is determined by the status (e.g., failure = critical)
4. **Notification Generation**: Alarms trigger notifications to be sent to users within the organization

### Setpoint Configuration

Administrators can configure alarm thresholds through the setpoint management interface. Each setpoint includes:

- **Name**: Descriptive name of the monitoring point
- **Type**: Equipment type (e.g., temperature, level, carbon, fan)
- **Zone**: Optional zone designation (e.g., zone1, zone2)
- **SCADA Field**: The field name in the SCADA database to monitor
- **Low Deviation**: Lower threshold limit (negative value)
- **High Deviation**: Upper threshold limit (positive value)

These configurations are stored in the `Setpoint` table and used by the alarm processing service to determine when to generate alarms.

## Meter Readings Feature

The meter readings functionality allows monitoring and analysis of electrical parameters from connected equipment. This feature provides real-time and historical data visualization, along with comprehensive reporting capabilities.

### Meter Reading Parameters

The system monitors and records the following electrical parameters:
- **Voltage** (V): Supply voltage measurements
- **Current** (A): Current consumption measurements
- **Frequency** (Hz): Power frequency measurements
- **Power Factor**: Ratio of real power to apparent power
- **Energy** (kWh): Energy consumption measurements
- **Power** (kW): Real power consumption measurements

### Data Collection

Meter readings are collected from the SCADA system and stored in a dedicated `meter_readings` table with the following structure:
- `meter_id`: Unique identifier for each reading
- `voltage`, `current`, `frequency`, `pf`, `energy`, `power`: Electrical parameters
- `created_at`: Timestamp when the reading was recorded

### User Interface Components

The meter readings feature includes several user interface components:

1. **Live Readings**: Real-time display of current electrical parameters
2. **Historical View**: Browsing past readings with customizable time filters:
   - Predefined filters (24h, 3d, 7d, 30d)
   - Custom date range selection
3. **Report Generation**: Creating Excel reports with:
   - Customizable date ranges
   - Parameter selection
   - Custom report titles
   - Downloadable Excel files

### Threshold Monitoring

The system allows administrators to configure limits for each electrical parameter:
- **High Limits**: Upper thresholds that trigger alerts when exceeded
- **Low Limits**: Lower thresholds that trigger alerts when values fall below them

When a parameter exceeds its configured limits, the system automatically generates notifications to alert operators.

### Report Generation

The meter report generation feature allows users to:
1. Select a date range for the report
2. Choose which parameters to include
3. Customize the report title
4. Generate and download an Excel file containing the selected data
5. Access previously generated reports

Reports are stored in the database and can be downloaded or shared directly from the mobile application.

### Mobile Experience

The meter readings feature is fully integrated into the mobile application with:
- Responsive design for various screen sizes
- Dark/light theme support
- Pull-to-refresh functionality
- Infinite scrolling for history browsing
- Interactive date pickers for custom ranges
- Optimized performance with virtualized lists

## User Roles

The system implements a comprehensive role-based access control system with three primary roles:

### Super Administrator (SUPER_ADMIN)
- **Organization Management**:
  - Create, edit, and delete organizations
  - Configure SCADA database connections
  - Set up schema mappings and configurations
  - Enable/disable organizations
  - Monitor organization status and health
- **User Management**:
  - Create, edit, and delete users across all organizations
  - Assign roles and organization memberships
  - Reset passwords and manage user accounts
  - View all users in the system
- **System Administration**:
  - Access system-wide analytics and metrics
  - Monitor cross-organization performance
  - Generate system-level reports
  - Configure global system settings
- **AI Configuration**:
  - Use Gemini AI for automatic schema configuration
  - Validate and correct configuration files
  - Import/export organization configurations

### Administrator (ADMIN)
- **User Management**:
  - Create new user accounts within their organization
  - Update existing user details
  - Delete user accounts
  - Reset user passwords
  - Assign roles and permissions
- **System Configuration**:
  - Configure system setpoints for each equipment type and zone
  - Configure meter reading limits and thresholds
  - Set up alarm thresholds and deviation limits
  - Manage notification preferences
- **System Monitoring**:
  - Access organization dashboard with performance metrics
  - View audit logs of system activities
  - Monitor alarm trends and patterns
  - Generate organization-specific reports
- **Operator Functions**:
  - All operator capabilities
  - View active alarms and manage resolution
  - Generate comprehensive reports

### Operator (OPERATOR)
- **Alarm Management**:
  - View active and historical alarms
  - Acknowledge alarms to indicate they're being addressed
  - Resolve alarms with detailed resolution notes
  - Track alarm resolution progress
- **Monitoring**:
  - Real-time equipment parameter monitoring
  - View meter readings and electrical parameters
  - Monitor system status and health
  - Receive push notifications for critical events
- **Reporting**:
  - Generate reports on alarm history
  - Create meter reading reports with custom parameters
  - Export data in various formats
  - Access historical data with filtering
- **User Functions**:
  - Update personal profile and preferences
  - Configure notification settings
  - Manage theme preferences (light/dark mode)
  - View personal activity history

## API Endpoints

The backend provides a comprehensive REST API with multi-tenant support:

### Authentication
- `POST /api/auth/login`: User login
- `POST /api/auth/refresh-token`: Refresh authentication token
- `POST /api/auth/logout`: Invalidate current tokens
- `GET /api/auth/profile`: Get current user profile

### Alarms
- `GET /api/alarms`: Get active alarms for organization
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

### Meter Readings
- `POST /api/meter`: Submit new meter readings
- `GET /api/meter/latest`: Get latest meter readings
- `GET /api/meter/history`: Get historical meter readings with pagination and filtering
- `GET /api/meter/limits`: Get all meter parameter limits
- `PUT /api/meter/limits/:id`: Update meter parameter limits

### Meter Reports
- `POST /api/meter/reports`: Generate a meter readings report
- `GET /api/meter/reports`: Get all reports for the current user
- `GET /api/meter/reports/:id`: Download a specific report

### Operator Routes
- `GET /api/operator/dashboard`: Get operator dashboard data
- `GET /api/operator/reports`: Generate operator reports

### Admin Routes
- `GET /api/admin/users`: Get all users in organization
- `POST /api/admin/users`: Create a new user
- `PUT /api/admin/users/:id`: Update user details
- `DELETE /api/admin/users/:id`: Delete a user
- `GET /api/admin/dashboard`: Get admin dashboard statistics
- `GET /api/admin/setpoints`: Get all setpoints
- `POST /api/admin/setpoints`: Create a new setpoint
- `PUT /api/admin/setpoints/:id`: Update a setpoint

### Super Admin Routes
- `GET /api/super-admin/organizations`: Get all organizations
- `POST /api/super-admin/organizations`: Create a new organization
- `PUT /api/super-admin/organizations/:id`: Update organization
- `DELETE /api/super-admin/organizations/:id`: Delete organization
- `GET /api/super-admin/users`: Get all users across organizations
- `POST /api/super-admin/users`: Create user in any organization
- `PUT /api/super-admin/users/:id`: Update user details
- `DELETE /api/super-admin/users/:id`: Delete user
- `GET /api/super-admin/metrics`: Get system-wide metrics
- `POST /api/super-admin/organizations/:id/toggle-status`: Enable/disable organization

### SCADA Routes
- `GET /api/scada/health`: Check SCADA database connection health
- `GET /api/scada/latest`: Get latest SCADA data
- `POST /api/scada/test-connection`: Test SCADA database connection
- `POST /api/scada/validate-schema`: Validate schema configuration

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

### Multi-Organization Deployment

For multi-organization deployments:

1. **Database Setup**:
   - Ensure PostgreSQL supports multiple schemas or use organization-based table prefixes
   - Configure connection pooling for multiple SCADA databases
   - Set up proper indexing for organization-based queries

2. **Network Configuration**:
   - Configure firewall rules for multiple SCADA systems
   - Set up VPN connections if required
   - Ensure proper network segmentation

3. **Monitoring and Scaling**:
   - Monitor database connections per organization
   - Scale resources based on organization count and data volume
   - Implement proper logging and alerting

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

### Multi-Platform Support

The mobile app supports:
- **Android**: Native Android with Material Design components
- **iOS**: Native iOS with Human Interface Guidelines
- **Cross-Platform**: Consistent experience across platforms
- **Responsive Design**: Optimized for various screen sizes and orientations

## License

This project is proprietary software developed by TecoSoft Digital Solutions.

## Support

For support or questions, please contact support@tecosoft.ai

---

**Eagle-Notifier** transforms industrial monitoring from reactive to proactive, ensuring your operations run smoothly with real-time visibility and instant alerts. Our multi-tenant architecture scales with your business, while our AI-powered configuration system makes setup simple and intelligent.
