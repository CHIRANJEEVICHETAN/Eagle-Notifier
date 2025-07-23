**Project Title:** Eagle – Mobile Alarm Monitoring & Analytics

**1. Overview**
Build a cross-platform mobile app (React Native + Expo) called **Eagle**, that connects via a Node.js/Express backend to an MS-SQL database for real-time alarm monitoring, plus a PostgreSQL store for user/role management. The app must:

* Fetch and display live analog values (temperatures & carbon potential)
* Fetch and display binary statuses (conveyor running, heater failure, etc.)
* Provide per-alarm analytics with threshold (SETPOINT) comparisons
* Trigger push notifications on threshold breaches or status changes
* Offer role-based access control (RBAC) with admin/user views
* Allow admins to manage users and adjust SETPOINTs on the fly
* Support report-downloading (PDF/Excel) of all alarms and events

---

**2. Data & Alarms**

* **Analog alarms** (numeric, fetch current value in ms-SQL):

  1. Hardening Zone 1 Temperature
  2. Hardening Zone 2 Temperature
  3. Carbon Potential (CP %)
  4. Oil Temperature
  5. Tempering Zone 1 Temperature
  6. Tempering Zone 2 Temperature

  * Each has a user-configurable **SETPOINT** with ± deviation bands.

* **Digital alarms** (binary, 0/1 in ms-SQL):

  1. Oil Level
  2. Hardening Heater Failure (Zone 1/Zone 2)
  3. Hardening Conveyor (Not Rotating)
  4. Oil Quench Conveyor (Not Rotating)
  5. Hardening Fan Motor Not Running
  6. Tempering Conveyor (Not Rotating)
  7. Tempering Fan Motor Not Running

  Show each as “Normal”/“Alarm” with custom background color.

---

**3. Backend (Node.js + Express)**

* **Database connections**:

  * MS-SQL for all alarm values
  * PostgreSQL for user credentials, roles, and SETPOINT overrides
* **APIs**:

  * `GET /alarms/current` – returns all analog values + binaries
  * `GET /alarms/analytics?since=<timestamp>` – time-series data for graphs
  * `POST /users` / `PUT /users/:id` / `DELETE /users/:id` – admin only
  * `PUT /alarms/:alarmId/setpoint` – admin only
  * `GET /reports?from=<>&to=<>` – generates downloadable PDF/Excel
* **Polling**: internal scheduler to query DB every **318 000 ms** and cache results for front-end
* **Notifications**:

  * On analog breach (value > SETPOINT + deviation or < SETPOINT – deviation)
  * On binary change (0 → 1 or 1 → 0)
  * Push via Expo Notifications to all logged-in devices

---

**4. Front-End (React Native + Expo)**

* **Stack**: Expo SDK, React Navigation, Redux (or Context), Axios for API calls
* **Authentication**:

  * Onboarding screen with Eagle logo (attached) & “Get Started” button (“powered by loginware.ai”)
  * On “Get Started” ask notification permissions (with error handling)
  * Login screen: email/password or SSO (admin vs user flows)
  * RBAC: load admin or user routes after login
* **Screens**:

  1. **Dashboard**

     * Real-time cards for all analog + binary alarms, color coded
     * Pull-to-refresh & auto-update every 318 s
  2. **Analytics**

     * **Graph 1**: line chart of all analog alarms vs. their SETPOINT bands
     * **Graph 2**: bar/spike chart of binary signals (0/1 events) over time
     * Custom legends & color per alarm
     * Date-range picker + “Download Report” button
  3. **Admin Panel**

     * User management UI (create/edit/delete)
     * SETPOINT management per alarm
* **UI/UX**: modern, clean, responsive. Use the Eagle shield logo colors (navy, teal gradients).

---

**5. Third-Party & Extras**

* **Expo Notifications** for push
* **loginware.ai** for onboarding & auth boost
* **PDF/Excel**: generate server-side (e.g. pdfkit + exceljs) and serve download link
* **Performance**: debounce UI updates, cache results, paginate analytics

---

**6. Deliverables**

1. **Backend** repo: Express app with well-documented endpoints & scheduler
2. **Mobile** repo: Expo project with all screens, state management, navigation
3. **Database schemas**: MS-SQL table definitions for alarm data; PostgreSQL for auth
4. **Deployment scripts**: Dockerfiles or Azure/AWS CI pipelines
5. **README**: setup, env vars, how-to-run, architecture diagram

---