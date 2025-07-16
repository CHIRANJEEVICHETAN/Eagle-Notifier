import { Stack } from "expo-router";

export default function SuperAdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="org-management" />
      <Stack.Screen name="user-management" />
      <Stack.Screen name="scada-config" />
      <Stack.Screen name="impersonation" />
      <Stack.Screen name="global-search" />
    </Stack>
  );
}