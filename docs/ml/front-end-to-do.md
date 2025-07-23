# Frontend Multi-Tenant & Role-Based Refactor — TODO

## 1. Authentication & Org Context
- [x] Update AuthContext to store `organizationId` and `role` from backend.
- [x] On login/register, save org context in state and secure storage.
- [ ] Update API hooks/services to always use org context (if not in JWT).

## 2. Role-Based Navigation
- [x] Refactor navigation logic in AuthContext to:
    - Route SUPER_ADMIN to super-admin dashboard.
    - Route ADMIN to admin dashboard.
    - Route OPERATOR to operator dashboard.
- [x] Add navigation guards to prevent unauthorized access to pages (SUPER_ADMIN).
- [ ] Update onboarding/landing to handle role/org context.

## 3. Super-Admin Features
- [x] Add `super-admin/` dashboard screen to layout.
- [x] Create `super-admin/` dashboard page UI/logic (theme-aware, consistent, with all major responsibilities as sections).
- [ ] Implement organization management UI (list, create, edit, delete orgs).
- [ ] Implement user management across orgs.
- [ ] Implement SCADA config/schema mapping UI per org.
- [ ] Add impersonation/switch context feature for super-admin.
- [ ] Add global search/view for alarms, notifications, reports across orgs.

## 4. UI/UX & State Management
- [x] Update AuthContext to expose org/role and provide helper hooks.
- [ ] Add OrgContext/provider if supporting multi-org users.
- [ ] Update all API calls to use org context.
- [ ] Refactor components to use new context and navigation logic.

## 5. Code/Folder Structure & Cleanup
- [ ] Organize files by feature (auth, admin, super-admin, operator).
- [ ] Rename/move files for consistency (camelCase for variables, PascalCase for components).
- [ ] Update imports and navigation to match new structure.
- [ ] Add/Update documentation for new features and structure.

## 6. Testing & Validation (to be done after implementation)
- [ ] Test login/register for all roles.
- [ ] Test role-based navigation and access control.
- [ ] Test super-admin features (org mgmt, impersonation, etc.).
- [ ] Test API calls for correct org context.
- [ ] Test UI/UX for clarity and usability.

---

## **Recommended Next Steps**

### **1. Super-admin dashboard skeleton is now implemented. ✅**
- The UI is consistent with operator, meter, and profile dashboards.
- Theme-aware and responsive.
- All major super-admin responsibilities are represented as section cards.
- Next: Implement organization management UI.

---

### **2. API Hooks/Services: Org Context**
- **Why:** All your API calls (user management, org management, etc.) must be org-aware for true multi-tenancy.
- **What:** Update your API hooks/services to always include `organizationId` (from context/JWT) in requests where needed.
- **Benefit:** Prevents cross-tenant data leaks and ensures all future features are built on a secure, scalable foundation.

---

### **3. Super-Admin Features (Iterative)**
- **Why:** The super-admin dashboard is the “control center” for org/user management.
- **What:** Build out features one by one:
  1. **Organization Management** (list, create, edit, delete orgs)
  2. **User Management Across Orgs**
  3. **SCADA Config/Schema Mapping UI**
  4. **Impersonation/Switch Context**
  5. **Global Search/View for Alarms, Notifications, Reports**
- **Benefit:** Each feature can be tested and validated independently, and you’ll have a working admin portal at every step.

---

### **4. UI/UX & State Management Enhancements**
- **Why:** Once the logic is in place, you can focus on making the experience smooth and robust.
- **What:** Refactor components, add helper hooks, and polish the UI for clarity and usability.

---

### **5. Testing & Validation**
- **Why:** Ensures your multi-tenant and role-based logic is secure and bug-free.
- **What:** Test all roles, navigation, and org-specific data access.

---

## **Summary Table**

| Step | Task | Why/Benefit |
|------|------|-------------|
| 1 | Super-Admin Dashboard Skeleton | Test navigation, unblock UI |
| 2 | API Hooks/Org Context | Secure, scalable backend/frontend |
| 3 | Super-Admin Features | Build core admin tools iteratively |
| 4 | UI/UX & State | Polish, refactor, improve usability |
| 5 | Testing | Ensure correctness and security |

---

**My recommendation:**  
**Start with the super-admin dashboard skeleton** (Step 1), then immediately update your API hooks/services for org context (Step 2).  
After that, build out super-admin features one by one (Step 3).

Would you like to proceed with the super-admin dashboard skeleton now?