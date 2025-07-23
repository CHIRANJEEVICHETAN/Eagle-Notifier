# Predictive Maintenance Multi-Tenant TODOs

## Backend

1. **Prisma Schema & Migration**
   - [x] Add Organization model, orgId fields, and SUPER_ADMIN role
   - [x] Run migration and generate Prisma client

2. **Org Context Middleware**
   - [x] Extend authentication middleware to attach organizationId to req.user

3. **Org-Scoped Queries & Services**
   - [ ] Update all queries for User, Notification, Alarm, AlarmHistory, MeterReport, FurnaceReport, etc. to filter by organizationId
   - [ ] Ensure all new records set organizationId from user context
   - [ ] Update all relevant routes, controllers, and services

4. **Dynamic SCADA DB Connection**
   - [ ] Refactor SCADA DB connection logic to use org’s scadaDbConfig

5. **Admin APIs for Org Onboarding/Config**
   - [ ] Add endpoints for creating organizations, updating SCADA config, and managing org users

## Frontend

6. **Org Context in Auth & API**
   - [ ] Update AuthContext and API hooks to store and pass org context
   - [ ] Add org selection UI for multi-org users

7. **Alert UI/Features**
   - [ ] Update alert UI/hooks for org-specific features if needed

## ML Pipeline

8. **Per-Org Model Training & Deployment**
   - [ ] Update ML training pipeline to support per-org model training, conversion, and deployment
   - [ ] Implement weekly retraining and deployment for each org’s model

## Documentation

9. **Implementation Documentation**
   - [ ] Document all changes, affected files, and SQL/schema updates in cursorUpdates/predictive-maintenance-multitenant.md

---

*Update this file as you complete each step. This checklist ensures a robust, scalable, and maintainable multi-tenant predictive maintenance system for Eagle Notifier.* 