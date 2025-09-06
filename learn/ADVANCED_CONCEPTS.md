# 🚀 React Native with Expo & NativeWind - Advanced Concepts

## 📚 **Part 5: Authentication System**

### **5.1 Authentication Flow**

The authentication system in this project follows this flow:

1. **App Launch**: Check for stored tokens
2. **Token Validation**: Verify if tokens are valid
3. **Login Process**: User enters credentials
4. **Token Storage**: Store tokens securely
5. **Route Protection**: Redirect based on auth state
6. **Token Refresh**: Automatically refresh expired tokens

### **5.2 Secure Token Storage**

**Using Expo SecureStore:**
```typescript
// Token storage keys
const AUTH_TOKEN_KEY = 'eagle_auth_token';
const REFRESH_TOKEN_KEY = 'eagle_refresh_token';
const USER_KEY = 'eagle_user';

// Save tokens
await Promise.all([
  SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
  SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
]);

// Load tokens
const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
const userJson = await SecureStore.getItemAsync(USER_KEY);
```

### **5.3 Login Process**

**Example from AuthContext:**
```typescript
const login = async (credentials: LoginCredentials) => {
  setAuthState(prev => ({
    ...prev,
    isLoading: true,
    error: null,
    errorType: 'error',
  }));
  
  try {
    // Make API call
    const response = await axios.post(`${apiConfig.apiUrl}/api/auth/login`, credentials);
    const { user, token, refreshToken } = response.data;
    
    // Set axios headers for future requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Save to secure storage
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    
    // Update auth state
    setAuthState({
      user,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      errorType: 'error',
      organizationId: user.organizationId || null,
      role: user.role || null,
    });
    
    // Navigate to onboarding
    router.replace('/onboarding');
    
  } catch (error: any) {
    // Handle errors...
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: errorMessage,
      errorType: errorType,
      organizationId: null,
      role: null,
    });
  }
};
```

### **5.4 Token Refresh System**

**Automatic Token Refresh:**
```typescript
const refreshAuthToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    
    if (!refreshToken) {
      return null;
    }

    // Call refresh token endpoint
    const response = await axios.post(`${apiConfig.apiUrl}/api/auth/refresh`, {
      refreshToken
    });

    const { token: newToken, refreshToken: newRefreshToken, user } = response.data;
    
    // Save new tokens
    await Promise.all([
      SecureStore.setItemAsync(AUTH_TOKEN_KEY, newToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefreshToken || refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
    ]);
    
    // Update auth state
    setAuthState(prev => ({
      ...prev,
      user,
      isAuthenticated: true,
      error: null,
      errorType: 'error'
    }));
    
    // Update axios headers
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    return newToken;
  } catch (error: any) {
    // Handle refresh failure
    await logout();
    return null;
  }
};
```

### **5.5 Route Protection**

**Auth Route Checking:**
```typescript
const checkAuthRoute = useCallback(() => {
  const { isAuthenticated, isLoading, role } = authState;
  if (isLoading) return;
  
  const inAuthGroup = segments[0] === '(auth)';
  const inDashboardGroup = segments[0] === '(dashboard)';
  const isOnboarding = segments[0] === 'onboarding';
  
  // If not authenticated, redirect to login
  if (!isAuthenticated && !inAuthGroup) {
    navigateTo('/');
    return;
  }
  
  // If authenticated but in auth group, go to onboarding
  if (isAuthenticated && inAuthGroup) {
    navigateTo('/onboarding');
    return;
  }
  
  // Handle super admin routing
  if (isAuthenticated && role === 'SUPER_ADMIN') {
    const isSuperAdminRoute = segments[0] === '(dashboard)' && segments[1] === 'superAdmin';
    const isProfileRoute = segments[0] === '(dashboard)' && segments[1] === 'profile';
    
    if (!isSuperAdminRoute && !isProfileRoute) {
      navigateTo('/(dashboard)/superAdmin');
      return;
    }
  }
}, [authState.isAuthenticated, authState.isLoading, authState.role, segments, navigateTo, selectedAppType]);
```

---

## 📚 **Part 6: Navigation with Expo Router**

### **6.1 File-Based Routing**

Expo Router uses file-based routing similar to Next.js:

```
app/
├── _layout.tsx           # Root layout
├── index.tsx            # Home route (/)
├── (auth)/
│   ├── _layout.tsx      # Auth layout
│   └── login.tsx        # Login route (/login)
├── (dashboard)/
│   ├── _layout.tsx      # Dashboard layout
│   ├── index.tsx        # Dashboard home (/dashboard)
│   ├── profile/
│   │   └── index.tsx    # Profile route (/dashboard/profile)
│   └── alarms/
│       ├── index.tsx    # Alarms list (/dashboard/alarms)
│       └── [id].tsx     # Dynamic route (/dashboard/alarms/123)
```

### **6.2 Navigation Functions**

**Using Expo Router:**
```typescript
import { router } from 'expo-router';

// Navigate to a route
router.push('/dashboard');

// Replace current route (no back button)
router.replace('/dashboard');

// Navigate with parameters
router.push({
  pathname: '/dashboard/alarms/[id]',
  params: { id: '123' }
});

// Go back
router.back();
```

### **6.3 Route Parameters**

**Dynamic Routes:**
```typescript
// app/(dashboard)/alarms/[id].tsx
import { useLocalSearchParams } from 'expo-router';

export default function AlarmDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  
  return (
    <View>
      <Text>Alarm ID: {id}</Text>
    </View>
  );
}
```

### **6.4 Layouts and Groups**

**Group Layout Example:**
```typescript
// app/(dashboard)/_layout.tsx
import { Stack } from 'expo-router';

export default function DashboardLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="alarms" options={{ title: 'Alarms' }} />
    </Stack>
  );
}
```

---

## 📚 **Part 7: Data Fetching with React Query**

### **7.1 What is React Query?**

React Query is a powerful library for managing server state, caching, and data synchronization.

### **7.2 Setup**

**QueryClient Setup:**
```typescript
// In _layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```

### **7.3 Custom Hooks for Data Fetching**

**Example from useAlarms.ts:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export const useAlarms = () => {
  const queryClient = useQueryClient();
  
  // Fetch alarms
  const { data: alarms, isLoading, error, refetch } = useQuery({
    queryKey: ['alarms'],
    queryFn: async () => {
      const response = await axios.get('/api/alarms');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Update alarm
  const updateAlarm = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axios.put(`/api/alarms/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch alarms
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
  
  return {
    alarms,
    isLoading,
    error,
    refetch,
    updateAlarm,
  };
};
```

### **7.4 Using the Hook**

**In Components:**
```typescript
import { useAlarms } from '../hooks/useAlarms';

export default function AlarmsScreen() {
  const { alarms, isLoading, error, updateAlarm } = useAlarms();
  
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <FlatList
      data={alarms}
      renderItem={({ item }) => (
        <AlarmCard 
          alarm={item}
          onUpdate={(data) => updateAlarm.mutate({ id: item.id, data })}
        />
      )}
    />
  );
}
```

---

## 📚 **Part 8: State Management with Zustand**

### **8.1 What is Zustand?**

Zustand is a lightweight state management library that's simpler than Redux but powerful enough for most applications.

### **8.2 Creating a Store**

**Example from useAlarmStore.ts:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AlarmStore {
  alarms: Alarm[];
  isLoading: boolean;
  error: string | null;
  setAlarms: (alarms: Alarm[]) => void;
  addAlarm: (alarm: Alarm) => void;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
  deleteAlarm: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAlarmStore = create<AlarmStore>()(
  persist(
    (set, get) => ({
      alarms: [],
      isLoading: false,
      error: null,
      
      setAlarms: (alarms) => set({ alarms }),
      
      addAlarm: (alarm) => set((state) => ({
        alarms: [...state.alarms, alarm]
      })),
      
      updateAlarm: (id, updates) => set((state) => ({
        alarms: state.alarms.map(alarm =>
          alarm.id === id ? { ...alarm, ...updates } : alarm
        )
      })),
      
      deleteAlarm: (id) => set((state) => ({
        alarms: state.alarms.filter(alarm => alarm.id !== id)
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'alarm-store', // Storage key
    }
  )
);
```

### **8.3 Using the Store**

**In Components:**
```typescript
import { useAlarmStore } from '../store/useAlarmStore';

export default function AlarmsScreen() {
  const { alarms, isLoading, addAlarm, updateAlarm } = useAlarmStore();
  
  const handleAddAlarm = () => {
    const newAlarm = {
      id: Date.now().toString(),
      title: 'New Alarm',
      severity: 'medium',
      timestamp: new Date().toISOString(),
    };
    addAlarm(newAlarm);
  };
  
  return (
    <View>
      <FlatList
        data={alarms}
        renderItem={({ item }) => (
          <AlarmCard 
            alarm={item}
            onUpdate={(updates) => updateAlarm(item.id, updates)}
          />
        )}
      />
      <Button title="Add Alarm" onPress={handleAddAlarm} />
    </View>
  );
}
```

---

## 📚 **Part 9: TypeScript in React Native**

### **9.1 Type Definitions**

**Example from auth.ts:**
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  organizationId: string;
  pushToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  errorType: 'error' | 'warning' | 'info';
  organizationId: string | null;
  role: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}
```

### **9.2 Component Props**

**Example from UpdateModal.tsx:**
```typescript
interface UpdateModalProps {
  visible: boolean;
  isDownloading: boolean;
  onUpdate: () => void;
  onCancel: () => void;
}

export function UpdateModal({ 
  visible, 
  isDownloading, 
  onUpdate, 
  onCancel 
}: UpdateModalProps) {
  // Component implementation
}
```

### **9.3 Custom Hooks with Types**

**Example from useAlarms.ts:**
```typescript
interface UseAlarmsReturn {
  alarms: Alarm[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateAlarm: (id: string, data: Partial<Alarm>) => void;
}

export const useAlarms = (): UseAlarmsReturn => {
  // Hook implementation
};
```

---

## 📚 **Part 10: Performance Optimization**

### **10.1 React.memo for Component Memoization**

**Example:**
```typescript
import React from 'react';

interface AlarmCardProps {
  alarm: Alarm;
  onPress: (alarm: Alarm) => void;
}

export const AlarmCard = React.memo<AlarmCardProps>(({ alarm, onPress }) => {
  return (
    <TouchableOpacity onPress={() => onPress(alarm)}>
      <Text>{alarm.title}</Text>
      <Text>{alarm.severity}</Text>
    </TouchableOpacity>
  );
});
```

### **10.2 useMemo for Expensive Calculations**

**Example:**
```typescript
import { useMemo } from 'react';

export default function AlarmsScreen() {
  const { alarms } = useAlarmStore();
  
  // Memoize filtered alarms
  const criticalAlarms = useMemo(() => {
    return alarms.filter(alarm => alarm.severity === 'critical');
  }, [alarms]);
  
  // Memoize sorted alarms
  const sortedAlarms = useMemo(() => {
    return [...alarms].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [alarms]);
  
  return (
    <View>
      <Text>Critical Alarms: {criticalAlarms.length}</Text>
      <FlatList data={sortedAlarms} renderItem={renderAlarm} />
    </View>
  );
}
```

### **10.3 FlatList Optimization**

**Example:**
```typescript
export default function AlarmsScreen() {
  const { alarms } = useAlarmStore();
  
  // Memoize render item function
  const renderAlarm = useCallback(({ item }: { item: Alarm }) => (
    <AlarmCard alarm={item} onPress={handleAlarmPress} />
  ), [handleAlarmPress]);
  
  // Memoize key extractor
  const keyExtractor = useCallback((item: Alarm) => item.id, []);
  
  return (
    <FlatList
      data={alarms}
      renderItem={renderAlarm}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={10}
    />
  );
}
```

---

## 📚 **Part 11: Error Handling**

### **11.1 Error Boundaries**

**Example from ErrorBoundary.tsx:**
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
```

### **11.2 API Error Handling**

**Example from AuthContext:**
```typescript
const login = async (credentials: LoginCredentials) => {
  try {
    const response = await axios.post('/api/auth/login', credentials);
    // Handle success
  } catch (error: any) {
    // Handle different error types
    if (error.response) {
      const status = error.response.status;
      
      switch (status) {
        case 400:
          errorMessage = 'Please check your login details';
          break;
        case 401:
          errorMessage = 'Invalid credentials';
          break;
        case 403:
          errorMessage = 'Access denied';
          break;
        case 500:
          errorMessage = 'Server error';
          break;
        default:
          errorMessage = 'An error occurred';
      }
    } else if (error.request) {
      errorMessage = 'Network error';
    } else {
      errorMessage = 'Unexpected error';
    }
    
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: errorMessage,
      errorType: 'error',
      organizationId: null,
      role: null,
    });
  }
};
```

---

## 📚 **Part 12: Best Practices Summary**

### **12.1 Code Organization**
1. **File Structure**: Organize by feature, not by type
2. **Component Naming**: Use PascalCase for components
3. **Hook Naming**: Use camelCase and prefix with 'use'
4. **Type Definitions**: Keep types close to where they're used

### **12.2 Performance**
1. **Memoization**: Use React.memo, useMemo, and useCallback appropriately
2. **FlatList Optimization**: Implement proper key extractors and render optimizations
3. **Image Optimization**: Use react-native-fast-image for better performance
4. **Bundle Size**: Monitor and optimize bundle size

### **12.3 State Management**
1. **Local State**: Use useState for component-specific state
2. **Global State**: Use Context for app-wide state, Zustand for complex state
3. **Server State**: Use React Query for API data
4. **Persistence**: Use SecureStore for sensitive data

### **12.4 Security**
1. **Token Storage**: Always use SecureStore for tokens
2. **API Security**: Implement proper authentication and authorization
3. **Input Validation**: Validate all user inputs
4. **Error Handling**: Don't expose sensitive information in errors

### **12.5 User Experience**
1. **Loading States**: Always show loading indicators
2. **Error States**: Provide clear error messages
3. **Offline Support**: Handle network errors gracefully
4. **Accessibility**: Implement proper accessibility features

---

## 🎯 **Conclusion**

This guide has covered the advanced concepts of React Native development with Expo and NativeWind using the Eagle-Notifier project as practical examples.

**Key Takeaways:**
- Authentication systems require careful token management and refresh logic
- Navigation with Expo Router provides a powerful file-based routing system
- React Query simplifies data fetching and caching
- Zustand offers a lightweight alternative to Redux
- Performance optimization is crucial for mobile apps
- Proper error handling improves user experience

**Next Steps:**
1. Practice building authentication flows
2. Experiment with different navigation patterns
3. Learn about testing strategies
4. Explore advanced React Native features
5. Contribute to open source projects

The Eagle-Notifier project demonstrates production-ready patterns that you can apply to your own applications. Study the code, experiment with it, and build your own features to solidify your understanding!

Happy coding! 🚀 