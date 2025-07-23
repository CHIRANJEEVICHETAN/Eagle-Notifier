### Admin Dashboard UI Overhaul - {{date}}

**Objective:** Refactor the Admin Dashboard (`app/(dashboard)/admin/index.tsx`) to align its UI with the Operator Dashboard (`app/(dashboard)/operator/index.tsx`), displaying a comprehensive list of alarms (using sample data for now) categorized into Analog and Binary sections, rather than just active alarms.

**Implementation Details:**

1.  **UI Structure Change:**
    *   The existing single list of active alarms and `AlarmCountSummary` component were removed.
    *   Introduced two distinct sections: "Analog Alarms" and "Binary Alarms".
    *   Added summary cards at the top (Critical, Warning, Info counts), mimicking the operator dashboard's summary style. These counts are derived from the sample alarm data.

2.  **Data Source and Display:**
    *   Integrated `sampleAnalogAlarms` and `sampleBinaryAlarms` (arrays of `AlarmData` objects) directly into `AdminDashboard` to serve as the data source for the alarm lists. This fulfills the requirement to show "all listed alarms" (based on the sample).
    *   The `useActiveAlarms` hook is still utilized for overall page loading, error, and refresh control, but the alarm lists themselves are now populated from the static sample data.
    *   Each alarm is rendered as a `TouchableOpacity` styled to match the alarm cards in `operator/index.tsx`.

3.  **Styling and Helper Functions:**
    *   Copied and adapted styling (prefixed with `op` in `StyleSheet` where directly copied, e.g., `opSummaryCardItem`, `opAlarmCard`) and dynamic color helper functions (e.g., `getAnalogAlarmBackground`, `getBinaryTitleColor`) from `operator/index.tsx` to ensure visual consistency and theme-awareness for the new UI elements.
    *   Removed the direct usage of the generic `AlarmCard` component, opting for inline styled `TouchableOpacity` elements for alarm cards as per the operator dashboard's pattern.

4.  **Preserved Functionality:**
    *   **Header:** The original Admin Dashboard header (title, theme toggle, logout) remains unchanged.
    *   **Quick Actions:** Buttons for "Manage Users" and "System Settings" are preserved.
    *   **Alarm Details:**
        *   The `AlarmDetails` modal is still used to show details of a selected alarm.
        *   The `handleAlarmPress` callback was updated to take `AlarmData` (from sample arrays) and map its properties to the `Alarm` type expected by `AlarmDetails`. This mapping was carefully adjusted to include fields necessary for display (like `value`, `unit`, `setPoint`, `type`, `zone`) while ensuring compatibility with the `Alarm` type definition to avoid runtime or type errors. Fields like `timestamp` are correctly handled (string from `toISOString`), and numeric fields like `lowLimit`/`highLimit` are parsed.
        *   `handleAcknowledge` and `handleResolve` (and their modal counterparts `handleSelectedAcknowledge`/`handleSelectedResolve`) remain functional, interacting with `updateAlarmStatus` and updating the local `selectedAlarm` state for the modal.

5.  **Type Safety:**
    *   Introduced an `AlarmData` interface to type the sample alarm objects.
    *   Refined the mapping logic in `handleAlarmPress` to ensure that the object passed to `setSelectedAlarm` (and thus to `AlarmDetails`) is compatible with the `Alarm` type, addressing potential type mismatches between `AlarmData` and `Alarm`.

**Affected Components/Hooks:**

*   `app/(dashboard)/admin/index.tsx`: Major overhaul.
*   `app/context/ThemeContext.ts`: Used for dark/light mode styling.
*   `app/context/AuthContext.ts`: Used for logout.
*   `app/hooks/useAlarms.ts`: `useActiveAlarms` still used for loading/error/refresh; `useUpdateAlarmStatus` used for alarm actions.
*   `app/components/AlarmDetails.tsx`: Used to display selected alarm details.
*   `app/types/alarm.ts`: The `Alarm` and `AlarmSeverity` types are referenced.

**Styling/Navigation Changes:**

*   Significant styling changes within `app/(dashboard)/admin/index.tsx` to adopt the operator dashboard's alarm display look and feel.
*   Navigation to `/admin/users` and `/admin/setpoints` via quick action buttons remains unchanged.

**Performance Optimizations:**

*   The primary change is UI and data presentation. Using sample data is for UI structure; real data fetching performance would depend on the actual implementation of `useAllAlarms` (if that were to replace `useActiveAlarms` for fetching all alarms).
*   `useCallback` is maintained for event handlers.
*   RefreshControl is preserved for manual data refreshing.

**Future Considerations:**

*   Replace sample data with actual data fetching logic that retrieves *all* alarms (not just active ones) if this page is meant to be a comprehensive alarm list. This might involve a new hook (e.g., `useAllAlarms`) or modifying `useActiveAlarms`.
*   Ensure the `Alarm` type in `app/types/alarm.ts` fully supports all fields displayed in the `AlarmDetails` modal if they are sourced from the sample data's richer structure (e.g., `zone`, `unit`, specific alarm `type` string). The current mapping in `handleAlarmPress` attempts to include these but uses `as any` for some, which should be refined if strict typing for these is available in `Alarm`. 