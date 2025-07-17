
```
Eagle-Notifier
├─ .easignore
├─ app
│  ├─ (auth)
│  │  ├─ login.tsx
│  │  └─ _layout.tsx
│  ├─ (dashboard)
│  │  ├─ alarms
│  │  │  ├─ history.tsx
│  │  │  └─ [id].tsx
│  │  ├─ analytics
│  │  │  └─ index.tsx
│  │  ├─ meter-readings
│  │  │  ├─ History.tsx
│  │  │  ├─ index.tsx
│  │  │  └─ Reports.tsx
│  │  ├─ notifications
│  │  │  ├─ index.tsx
│  │  │  └─ settings.tsx
│  │  ├─ operator
│  │  │  └─ index.tsx
│  │  ├─ profile
│  │  │  └─ index.tsx
│  │  ├─ reports
│  │  │  └─ index.tsx
│  │  ├─ screens
│  │  │  └─ admin
│  │  │     ├─ meter-limits
│  │  │     │  ├─ index.tsx
│  │  │     │  └─ [id].tsx
│  │  │     ├─ setpoints
│  │  │     │  └─ index.tsx
│  │  │     └─ users
│  │  │        └─ index.tsx
│  │  ├─ superAdmin
│  │  │  ├─ index.tsx
│  │  │  └─ _layout.tsx
│  │  └─ _layout.tsx
│  ├─ +not-found.tsx
│  ├─ api
│  │  ├─ auth.ts
│  │  ├─ config.ts
│  │  ├─ meterApi.ts
│  │  ├─ notificationsApi.ts
│  │  └─ reportsApi.ts
│  ├─ components
│  │  ├─ AlarmCard.tsx
│  │  ├─ AlarmCountSummary.tsx
│  │  ├─ AlarmDetails.tsx
│  │  ├─ ErrorBoundary.tsx
│  │  ├─ MeterReportGenerator.tsx
│  │  ├─ NotificationBadge.tsx
│  │  ├─ OrganizationManagement.tsx
│  │  ├─ ReportGenerator.tsx
│  │  ├─ ResolutionModal.tsx
│  │  ├─ SetpointConfigModal.tsx
│  │  ├─ TimeRangePicker.tsx
│  │  └─ UpdateModal.tsx
│  ├─ context
│  │  ├─ AuthContext.tsx
│  │  ├─ MaintenanceContext.tsx
│  │  └─ ThemeContext.tsx
│  ├─ hooks
│  │  ├─ useAlarmReportData.ts
│  │  ├─ useAlarms.ts
│  │  ├─ useFurnaceReports.ts
│  │  ├─ useMeterReadings.ts
│  │  ├─ useMeterReports.ts
│  │  ├─ useNotifications.ts
│  │  ├─ useReportGenerator.ts
│  │  └─ useSetpoints.ts
│  ├─ index.tsx
│  ├─ NotificationProvider.tsx
│  ├─ onboarding.tsx
│  ├─ services
│  │  └─ ExcelReportService.ts
│  ├─ store
│  │  ├─ useAlarmStore.ts
│  │  └─ useMeterReportStore.ts
│  ├─ types
│  │  ├─ alarm.ts
│  │  ├─ auth.ts
│  │  └─ notification.ts
│  ├─ utils
│  │  ├─ errorHandling.ts
│  │  ├─ pdfGenerator.ts
│  │  ├─ reportService.ts
│  │  └─ timezoneUtils.ts
│  └─ _layout.tsx
├─ app-env.d.ts
├─ app.json
├─ assets
│  ├─ fonts
│  │  └─ SpaceMono-Regular.ttf
│  ├─ images
│  │  ├─ adaptive-icon.png
│  │  ├─ Eagle-Logo.png
│  │  ├─ favicon.png
│  │  ├─ icon.png
│  │  ├─ notification-icon.png
│  │  └─ splash-icon.png
│  └─ sounds
│     └─ notification.wav
├─ babel.config.js
├─ backend
│  ├─ .dockerignore
│  ├─ Dockerfile
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ password.js
│  ├─ prisma
│  │  ├─ schema.prisma
│  │  └─ seed.ts
│  ├─ server.ts
│  ├─ src
│  │  ├─ config
│  │  │  ├─ db.ts
│  │  │  └─ scadaDb.ts
│  │  ├─ controllers
│  │  │  └─ maintenanceController.ts
│  │  ├─ generated
│  │  ├─ meter_readings
│  │  │  └─ main.ino
│  │  ├─ middleware
│  │  │  ├─ auth.ts
│  │  │  ├─ authMiddleware.ts
│  │  │  └─ errorHandler.ts
│  │  ├─ migrations
│  │  │  └─ Table_Description
│  │  │     └─ meter_readings.md
│  │  ├─ routes
│  │  │  ├─ adminRoutes.ts
│  │  │  ├─ alarmRoutes.ts
│  │  │  ├─ alarms.ts
│  │  │  ├─ authRoutes.ts
│  │  │  ├─ maintenanceRoutes.ts
│  │  │  ├─ meterRoutes.ts
│  │  │  ├─ notifications.ts
│  │  │  ├─ operatorRoutes.ts
│  │  │  ├─ reportRoutes.ts
│  │  │  └─ scadaRoutes.ts
│  │  ├─ services
│  │  │  ├─ notificationService.ts
│  │  │  └─ scadaService.ts
│  │  ├─ types
│  │  │  └─ prisma.ts
│  │  └─ utils
│  │     └─ logger.ts
│  ├─ structure.md
│  └─ tsconfig.json
├─ cesconfig.json
├─ database
│  └─ Main-Schema
│     ├─ jk1.md
│     └─ jk2.md
├─ eas.json
├─ eslint.config.js
├─ global.css
├─ metro.config.js
├─ ml
├─ nativewind-env.d.ts
├─ package.json
├─ prettier.config.js
├─ README.md
├─ tailwind.config.js
├─ tsconfig.json
└─ yarn.lock

```