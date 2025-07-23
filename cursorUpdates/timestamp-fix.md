# IST Timestamp Fix for Alarm History Screens

## Summary
- Fixed incorrect IST time display in alarm history and detail screens.
- Replaced manual UTC +5:30 offset logic with a reliable, locale-based approach using `toLocaleString` and `Asia/Kolkata` timezone.
- Ensures timestamps are always shown in correct IST, regardless of device timezone or build environment.

## Implementation Details
- Updated the `formatTimestamp` function in both `app/(dashboard)/alarms/[id].tsx` and `app/(dashboard)/alarms/history.tsx`.
- Removed manual UTC offset calculation.
- Now uses:
  ```ts
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };
  ```
- This guarantees correct IST display in all environments.

## Affected Components/Hooks
- `app/(dashboard)/alarms/[id].tsx` (Alarm detail/history page)
- `app/(dashboard)/alarms/history.tsx` (Alarm history summary page)

## Styling/Navigation Changes
- No UI or navigation changes; only timestamp formatting logic updated.

## Performance Optimizations
- No performance impact; function is now simpler and more robust.

## User Impact
- Users will always see alarm times in correct IST, regardless of their device timezone or app build type.
- Fixes previous issue where times could be +5:30 hours ahead in production or on IST devices.

--- 