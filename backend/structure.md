```
backend
├──prisma
│   ├──migrations
│   │   ├──20250509092917_init
│   │   │   └──migration.sql
│   │   ├──20250509093819_add_notes_to_alarm
│   │   │   └──migration.sql
│   │   └──migration_lock.toml
│   └──schema.prisma
├──src
│   ├──config
│   │   └──db.ts
│   ├──generated
│   │   └──prisma-client
│   │   │   ├──runtime
│   │   │   │   ├──edge-esm.js
│   │   │   │   ├──edge.js
│   │   │   │   ├──index-browser.d.ts
│   │   │   │   ├──index-browser.js
│   │   │   │   ├──library.d.ts
│   │   │   │   ├──library.js
│   │   │   │   ├──react-native.js
│   │   │   │   └──wasm.js
│   │   │   ├──client.d.ts
│   │   │   ├──client.js
│   │   │   ├──default.d.ts
│   │   │   ├──default.js
│   │   │   ├──edge.d.ts
│   │   │   ├──edge.js
│   │   │   ├──index-browser.js
│   │   │   ├──index.d.ts
│   │   │   ├──index.js
│   │   │   ├──package.json
│   │   │   ├──query_engine-windows.dll.node
│   │   │   ├──schema.prisma
│   │   │   ├──wasm.d.ts
│   │   │   └──wasm.js
│   ├──middleware
│   │   ├──auth.ts
│   │   ├──authMiddleware.ts
│   │   └──errorHandler.ts
│   ├──routes
│   │   ├──adminRoutes.ts
│   │   ├──alarmRoutes.ts
│   │   ├──alarms.ts
│   │   ├──authRoutes.ts
│   │   ├──notifications.ts
│   │   └──operatorRoutes.ts
│   ├──services
│   │   └──notificationService.ts
│   └──types
│   │   └──prisma.ts
├──package-lock.json
├──package.json
├──server.ts
├──tsconfig.json
└──.env.example
```