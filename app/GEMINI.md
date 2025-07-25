# Gemini Code Assistant Configuration - Frontend

This file provides context to the Gemini code assistant for the Eagle-Notifier frontend application.

## Frontend Technology Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Routing**: Expo Router
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand
- **Data Fetching**: React Query (`@tanstack/react-query`) and Axios
- **Charting**: `react-native-gifted-charts` and `react-native-chart-kit`
- **Linting**: ESLint (`eslint-config-expo`)
- **Formatting**: Prettier (`prettier-plugin-tailwindcss`)

## Project Structure

- **Entry Point**: `expo-router/entry` is the main entry point. The root layout is in `app/_layout.tsx`.
- **Routing**: Expo Router uses a directory-based routing system. Key route groups are:
    - `app/(auth)`: Authentication screens like `login.tsx`.
    - `app/(dashboard)`: The main application dashboard and its nested screens.
        - `alarms`: Screens for viewing alarm history and details.
        - `analytics`: Analytics dashboard.
        - `meter-readings`: Screens for meter readings, history, and reports.
        - `notifications`: Notification center and settings.
        - `operator`: Operator-specific views.
        - `profile`: User profile screen.
        - `reports`: General reporting section.
        - `screens/admin`: Admin-specific screens for managing users, setpoints, and meter limits.
        - `screens/superAdmin`: Super-admin screens for organization and user management.
- **Components**: Reusable UI components are in `app/components`. Examples include `AlarmCard.tsx`, `ReportGenerator.tsx`, and various modals.
- **API**: API-related concerns are handled in `app/api`, with files like `auth.ts`, `meterApi.ts`, etc., for making requests to the backend.
- **Context**: React Context providers for managing global state like authentication (`AuthContext.tsx`), theme (`ThemeContext.tsx`), and maintenance status are in `app/context`.
- **Hooks**: Custom React hooks for managing component logic and data fetching are in `app/hooks`. Examples include `useAlarms.ts` and `useMeterReadings.ts`.
- **Services**: Contains services for specific functionalities, like `ExcelReportService.ts`.
- **State Management**: Global state is managed with Zustand. Store definitions are in `app/store`.
- **Types**: TypeScript type definitions are located in `app/types`.
- **Utils**: Utility functions for tasks like PDF generation (`pdfGenerator.ts`) and error handling (`errorHandling.ts`) are in `app/utils`.

## Development Workflow

- **Run Development Server**: Use `npm start` or `expo start`.
- **Linting and Formatting**: Run `npm run lint` and `npm run format` before committing changes.
- **Adding Dependencies**: Use `npm install` or `yarn add`.
- **Code Style**: Adhere to the existing coding style, which emphasizes functional components with hooks. All new components should be typed using TypeScript.
- **File Naming**: Use PascalCase for component files (e.g., `MyComponent.tsx`).