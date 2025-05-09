# Product Requirements Document (PRD)

## Project Title: Eagle Mobile Alarm Monitoring App

---

## TL;DR

Industrial alarm monitoring is plagued by delays and manual processes, risking unplanned downtime and compliance gaps. **Eagle** is a mobile-first industrial IoT application designed to provide **real-time alarm monitoring**, **analytics**, and **compliance reporting** via mobile devices. The app empowers plant operators, maintenance engineers, admins, compliance staff, and IT managers to take immediate and informed action using live notifications, interactive dashboards, and PDF reports. Built on a scalable, secure architecture with modern tools (Expo, React Native, TypeScript, Zustand, TanStack Query, MS-SQL, and PostgreSQL), Eagle streamlines safety, reduces operational delays, and simplifies audit compliance.

---

## 1. Goals

### Business Goals

* Digitize and streamline industrial safety monitoring with a mobile-first approach.
* Reduce response time to alarm events via real-time alerts.
* Facilitate digital compliance with audit-friendly, on-demand PDF reports.
* Centralize configuration of alarm thresholds, roles, and access.
* Expand TecoSoft Digital Solutions’ SaaS adoption in manufacturing and IIoT sectors.

### User Goals

* Receive immediate, actionable alerts on mobile for machinery alarms.
* Access historical and real-time alarm data via intuitive UI.
* Download and share compliance reports instantly.
* Manage alarm thresholds and user roles from mobile.
* Visualize trends and performance metrics to improve plant health.

### Non-Goals

* No desktop or web client in the MVP phase.
* No physical actuation or direct machine control.
* No integration with legacy, non-IoT alarm systems.

---

## 2. Personas & User Stories

### 1. Industrial Plant Operator

* Receive immediate mobile alerts when machinery alarms trigger.
* View a dashboard listing current alarms categorized by severity and time.

### 2. Maintenance Engineer

* Get alerts on anomalous sensor readings.
* Review historical alarms and trends to prevent equipment failure.

### 3. Operations Admin

* Manage and assign user roles and permissions.
* Update alarm thresholds in real-time from mobile.

### 4. Compliance Team Member

* Export alarm logs as timestamped PDFs.
* Get alerts for violations of compliance thresholds.

### 5. Factory IT/IoT Manager

* Ensure seamless connectivity and health of alarm systems.
* Validate and audit user activities and configuration logs.

---

## 3. Functional Requirements

### 1. Real-Time Alarm Monitoring

* Live polling (\~5 min) of analog alarms.
* Instant binary state monitoring (e.g., motor on/off, E-stop triggered).
* Color-coded alarm dashboard (e.g., red-critical, yellow-warning).
* Action buttons: acknowledge, silence, view details.

### 2. Analytics & Visualization

* Trend charts with severity and time filters.
* Spike/event highlighting.
* Time series and category analytics.
* Role-based data visibility.

### 3. Compliance Reporting

* On-demand PDF report builder.
* Timeframe and category filters.
* Timestamps and analytics embedded in reports.
* Share/download from device.

### 4. Role-Based Access Control (RBAC)

* Roles: Operator, Maintenance, Admin, Compliance, IoT Manager.
* Admins can create/edit/deactivate users.
* Permissions configured per role.

### 5. Push Notifications

* Expo push integration (Android/iOS).
* Threshold-based trigger system.
* In-app notification history.
* Persistent alerts for unresolved issues.

### 6. UI/UX & Theming

* Light/Dark/Auto themes synced with OS.
* High-contrast alert displays.
* Large tap targets for gloved usability.
* Responsive layouts using Tailwind.
* Screen reader support.

### 7. Cross-Platform Compatibility

* Expo/React Native for Android & iOS.
* Offline-ready with local caching.
* Quick startup & resilient data fetching.

### 8. Integration & Data Layer

* MS-SQL for live plant alarm & sensor data.
* PostgreSQL for RBAC, thresholds, audit logs.
* Zustand for local state; TanStack Query for remote data.

---

## 4. User Experience Design

### Onboarding Flow

* Secure login with role-based redirection.
* First-time role-specific guide: Operator, Maintenance, etc.
* Optional Quick Tour of main features.

### Alarm Dashboard

* Sorted list of active alarms.
* Timestamps, type, severity, source unit.
* Acknowledge/silence options if permitted.
* Visual alarm history timeline.

### Analytics Dashboard

* Graphs for analog/binary trends.
* Adjustable date range.
* Filters: device, alarm type, severity.

### Report Generation

* Choose timeframe and alarm category.
* Generate downloadable/shareable PDF.
* Export history stored in user profile.

### Admin Panel

* User creation/deletion/edit.
* Setpoint/threshold configuration.
* Role-based permissions matrix.
* Audit logs for config changes.

### Additional UX Enhancements

* Offline indicators and fallback cache.
* Empty states with guidance.
* Descriptive error messages.
* Adaptive layouts and font scaling.

---

## 5. Narrative Scenario

At 3:15 AM, an overpressure alarm triggers in Unit 12. Rajesh, the night Plant Operator, receives a push alert on Eagle. He opens the app to see a red alert: "Compressor Overpressure."

By tapping the alert, he checks a trend chart showing this happened twice last week. He generates a PDF report and forwards it to the Maintenance Chief, who also received an alert and begins preparations.

The Admin logs in remotely to adjust thresholds slightly to avoid recurring false positives. Meanwhile, the compliance officer downloads a full report, already updated with the night's events. The entire sequence, from alert to audit, happens within minutes, without a single call or delay.

---

## 6. Success Metrics

### User Metrics

* 85%+ of users respond to alarms within 2 minutes.
* 80% user engagement (3+ uses per week).
* 90% satisfaction in post-incident survey.

### Business Metrics

* Reduce average incident response time by 50%.
* Generate 500+ compliance PDFs in 90 days.
* Sign up 5+ factories within 6 months.

### Technical Metrics

* ≥99% app uptime.
* <10s push latency for 95% of alerts.
* <2% failed sync rate.
* <2s dashboard load time.

### Tracking Events

* Alarm view, notification open, report export, login success/failure, admin changes.

---

## 7. Technical Architecture

### Stack & Tools

* **Frontend**: React Native + Expo + Tailwind
* **Backend**: PostgreSQL (RBAC, logs), MS-SQL (plant data)
* **State**: Zustand (local), TanStack Query (remote)
* **Notifications**: Expo Push Notifications
* **PDF**: Expo-Print
* **Auth**: JWT or Firebase Authentication (Optional)

### Data Privacy & Security

* Secure access-controlled PostgreSQL backend.
* Local caching with auto-sync on reconnection.
* RBAC-restricted data access.
* Audit trails of config changes.
* Compliance with regional industrial data laws.

### Performance & Scalability

* Deployable across 1000+ users and dozens of factories.
* Low-latency alarms and push.
* Modular backend for role/user/scenario expansion.

### Challenges & Risks

* Legacy network latency with MS-SQL.
* Restricted push delivery in low-signal zones.
* Handling offline states robustly.
* Battery impact of background refresh.
* Securing config/audit APIs from misuse.

---

## 8. Milestones & Timeline

### MVP (4–6 Weeks)

* Core features: Login, Alarm Dashboard, PDF Reports, Push Alerts, Admin Role Config
* Team: 2–3 (Product/Engineer/QA)

### Full Release (8–12 Weeks)

* Feature-complete version: advanced analytics, theming, offline handling, RBAC
* Team: 3–4 (Product, Backend, Mobile, Design)

### Post-Launch Iterations

* Client feedback-based changes
* UI/UX enhancements
* Sector-specific custom modules

---

## Appendix

* **Design Guidelines**: Material Design + Industrial Accessibility Best Practices
* **Demo Factory Setup**: Virtual alarm triggers for user testing
* **Compliance Standards Supported**: ISO 45001, OSHA logs
* **Data Sources**: MS-SQL-based simulated IoT sensor suite

---

## Final Statement

**Eagle** turns industrial alarm chaos into an organized, real-time workflow accessible from every operator’s and engineer’s phone. With a smart, role-aware design, it improves plant visibility, speeds response, and guarantees compliance from the palm of your hand.

\--- END ---
