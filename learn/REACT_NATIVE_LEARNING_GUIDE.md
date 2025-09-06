# 🚀 React Native with Expo & NativeWind Learning Guide
## Using Eagle-Notifier Project as Examples

---

## 📚 **Part 1: Project Setup & Basic Concepts**

### **1.1 What is React Native with Expo?**

React Native is a framework that lets you build mobile apps using JavaScript/TypeScript and React. Expo is a platform that simplifies React Native development by providing tools, services, and libraries.

**Key Benefits:**
- Write once, run on iOS and Android
- Hot reloading for fast development
- Access to native device features
- Simplified build process

### **1.2 Project Structure Overview**

```
Eagle-Notifier/
├── app/                    # Main app code (Expo Router)
│   ├── _layout.tsx        # Root layout with providers
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Main app routes
│   ├── context/           # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── components/        # Reusable components
│   └── types/             # TypeScript type definitions
├── assets/                # Images, fonts, sounds
├── backend/               # Node.js backend server
├── package.json           # Dependencies and scripts
├── app.json              # Expo configuration
├── tailwind.config.js    # NativeWind configuration
└── tsconfig.json         # TypeScript configuration
```

### **1.3 Key Dependencies in this Project**

From `package.json`, here are the main libraries:

- **`expo-router`**: File-based navigation (like Next.js)
- **`nativewind`**: Tailwind CSS for React Native
- **`zustand`**: Lightweight state management
- **`@tanstack/react-query`**: Data fetching and caching
- **`expo-notifications`**: Push notifications
- **`expo-secure-store`**: Secure storage for tokens

---

## 📚 **Part 2: React Hooks Fundamentals**

### **2.1 useState Hook**

The `useState` hook is the most basic React hook for managing component state.

**Basic Syntax:**
```typescript
const [state, setState] = useState(initialValue);
```

**Example from Login Screen:**
```typescript
// Form state
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [showPassword, setShowPassword] = useState(false);

// Error state
const [emailError, setEmailError] = useState('');
const [passwordError, setPasswordError] = useState('');
```

**How it works:**
1. `useState` returns an array with two elements
2. First element is the current state value
3. Second element is a function to update the state
4. When you call the setter function, React re-renders the component

**State Update Example:**
```typescript
// Update email when user types
const validateEmail = (text: string) => {
  setEmail(text); // This triggers a re-render
  if (text.trim() === '') {
    setEmailError('Email is required');
  } else if (!/\S+@\S+\.\S+/.test(text)) {
    setEmailError('Please enter a valid email address');
  } else {
    setEmailError('');
  }
};
```

### **2.2 useEffect Hook**

The `useEffect` hook lets you perform side effects in functional components.

**Basic Syntax:**
```typescript
useEffect(() => {
  // Side effect code
  return () => {
    // Cleanup code (optional)
  };
}, [dependencies]);
```

**Example from AuthContext:**
```typescript
// Load user from storage on mount
useEffect(() => {
  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
          errorType: 'error',
          organizationId: user.organizationId || null,
          role: user.role || null,
        });
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Failed to load user data',
        errorType: 'error',
        organizationId: null,
        role: null,
      });
    }
  };
  
  loadUser();
}, []); // Empty dependency array = run only on mount
```

**useEffect with Dependencies:**
```typescript
// Check auth routes when auth state changes
useEffect(() => {
  if (!authState.isLoading) {
    checkAuthRoute();
  }
}, [authState.isAuthenticated, authState.isLoading, checkAuthRoute]);
```

### **2.3 useCallback Hook**

`useCallback` memoizes functions to prevent unnecessary re-renders.

**Example from AuthContext:**
```typescript
// Memoize the updateUser function
const updateUser = useCallback((userData: Partial<User>) => {
  setAuthState(prev => ({
    ...prev,
    user: prev.user ? { ...prev.user, ...userData } : null,
  }));
}, []); // Empty dependency array = function never changes

// Memoize navigation helper
const navigateTo = useCallback((path: string) => {
  router.replace(path as any);
}, []); // Empty dependency array = function never changes
```

**Why use useCallback?**
- Prevents child components from re-rendering unnecessarily
- Optimizes performance in large applications
- Useful when passing functions as props

### **2.4 useRef Hook**

`useRef` creates a mutable reference that persists across re-renders.

**Example from Login Screen:**
```typescript
// Animation value that persists across re-renders
const fadeAnim = React.useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 800,
    useNativeDriver: true,
  }).start();
}, []);
```

**Example from AuthContext:**
```typescript
// Track navigation state to prevent infinite loops
const isNavigatingRef = useRef(false);
```

---

## 📚 **Part 3: React Context & State Management**

### **3.1 What is React Context?**

React Context provides a way to pass data through the component tree without having to pass props down manually at every level.

**Context Structure:**
1. **Context**: Created with `createContext()`
2. **Provider**: Wraps components and provides data
3. **Consumer**: Components that use the context data

### **3.2 Creating a Context**

**Example from AuthContext:**
```typescript
// Define the context type
interface AuthContextProps {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
  checkAuthRoute: () => void;
  hasSeenOnboarding: boolean | null;
  refreshAuthToken: () => Promise<string | null>;
  selectedAppType: string | null;
  setSelectedAppType: (type: string) => Promise<void>;
  organizationId: string | null;
  role: string | null;
}

// Create the context
const AuthContext = createContext<AuthContextProps | undefined>(undefined);
```

### **3.3 Context Provider**

**Example from AuthContext:**
```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State management
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
    errorType: 'error',
    organizationId: null,
    role: null,
  });
  
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [selectedAppType, setSelectedAppTypeState] = useState<string | null>(null);

  // Functions and logic here...

  return (
    <AuthContext.Provider value={{ 
      authState, 
      login, 
      logout, 
      clearError, 
      updateUser, 
      checkAuthRoute, 
      hasSeenOnboarding, 
      refreshAuthToken,
      selectedAppType,
      setSelectedAppType,
      organizationId: authState.organizationId,
      role: authState.role,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### **3.4 Using Context with Custom Hook**

**Example from AuthContext:**
```typescript
export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

**Using the Context in Components:**
```typescript
// In login.tsx
export default function LoginScreen() {
  const { login, authState } = useAuth(); // Get context data
  const { isDarkMode } = useTheme(); // Another context
  
  // Use the context data
  const handleLogin = async () => {
    await login({ email, password } as LoginCredentials);
  };
  
  // Access auth state
  if (authState.isLoading) {
    return <LoadingSpinner />;
  }
}
```

### **3.5 Provider Hierarchy**

**Example from _layout.tsx:**
```typescript
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <MaintenanceProvider>
              <NotificationProvider>
                <AuthRouteChecker>
                  <RootLayoutNav />
                </AuthRouteChecker>
              </NotificationProvider>
            </MaintenanceProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

**Provider Order Matters:**
1. **QueryClientProvider**: Data fetching and caching
2. **SafeAreaProvider**: Safe area handling
3. **ThemeProvider**: Theme context
4. **AuthProvider**: Authentication state
5. **MaintenanceProvider**: Maintenance state
6. **NotificationProvider**: Push notifications

---

## 📚 **Part 4: Authentication System**

### **4.1 Authentication Flow**

The authentication system in this project follows this flow:

1. **App Launch**: Check for stored tokens
2. **Token Validation**: Verify if tokens are valid
3. **Login Process**: User enters credentials
4. **Token Storage**: Store tokens securely
5. **Route Protection**: Redirect based on auth state
6. **Token Refresh**: Automatically refresh expired tokens

### **4.2 Secure Token Storage**

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

### **4.3 Login Process**

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

### **4.4 Token Refresh System**

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

### **4.5 Route Protection**

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

## 📚 **Part 5: NativeWind (Tailwind CSS for React Native)**

### **5.1 What is NativeWind?**

NativeWind allows you to use Tailwind CSS classes in React Native components, providing a familiar styling approach for web developers.

### **5.2 Configuration**

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './App.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### **5.3 Using NativeWind Classes**

**Example from Login Screen:**
```typescript
// Instead of StyleSheet.create, use className
<View className="flex-1 bg-gray-50 dark:bg-gray-900">
  <Text className="text-2xl font-bold text-gray-900 dark:text-white">
    Welcome Back
  </Text>
  <TextInput 
    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
    placeholder="Email"
  />
</View>
```

**Combining with StyleSheet:**
```typescript
// You can mix NativeWind with StyleSheet
<View 
  className="flex-1 bg-gray-50 dark:bg-gray-900"
  style={styles.container}
>
  <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
    Welcome Back
  </Text>
</View>
```

### **5.4 Dark Mode Support**

**Theme Context Example:**
```typescript
// In ThemeContext
const { isDarkMode } = useTheme();

// In components
<View className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
  <Text className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
    Content
  </Text>
</View>
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

## 📚 **Part 12: Push Notifications**

### **12.1 Setup**

**app.json Configuration:**
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#2563EB",
          "sounds": ["./assets/sounds/notification.wav"]
        }
      ]
    ]
  }
}
```

### **12.2 Notification Provider**

**Example from NotificationProvider.tsx:**
```typescript
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Request permissions
    registerForPushNotificationsAsync();

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Listen for notification responses
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return <>{children}</>;
}
```

### **12.3 Registering Push Tokens**

**Example from AuthContext:**
```typescript
const registerPushToken = async (token: string) => {
  try {
    await axios.put(
      `${apiConfig.apiUrl}/api/notifications/push-token`,
      { pushToken: token },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('Push token registered successfully');
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
};
```

---

## 📚 **Part 13: Testing and Debugging**

### **13.1 Console Logging**

**Best Practices:**
```typescript
// Use descriptive log messages
console.log('User login attempt:', { email, timestamp: new Date() });

// Log errors with context
console.error('API call failed:', {
  endpoint: '/api/auth/login',
  status: error.response?.status,
  message: error.response?.data?.message,
  timestamp: new Date()
});

// Use console.warn for warnings
console.warn('Token refresh failed, user will be logged out');
```

### **13.2 React Native Debugger**

**Setup:**
1. Install React Native Debugger
2. Enable debugging in your app
3. Use Chrome DevTools for debugging

### **13.3 Performance Monitoring**

**Example:**
```typescript
import { PerformanceObserver } from 'react-native';

// Monitor component render times
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
  });
});

observer.observe({ entryTypes: ['measure'] });
```

---

## 📚 **Part 14: Deployment and Build**

### **14.1 EAS Build Configuration**

**eas.json:**
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### **14.2 Environment Configuration**

**app.config.js:**
```javascript
export default {
  expo: {
    name: "Eagle Notifier",
    slug: "eagle-notifier",
    version: "1.2.6",
    extra: {
      apiUrl: process.env.API_URL || "https://api.eaglenotifier.com",
      projectId: process.env.PROJECT_ID,
    },
  },
};
```

---

## 📚 **Part 15: Best Practices Summary**

### **15.1 Code Organization**

1. **File Structure**: Organize by feature, not by type
2. **Component Naming**: Use PascalCase for components
3. **Hook Naming**: Use camelCase and prefix with 'use'
4. **Type Definitions**: Keep types close to where they're used

### **15.2 Performance**

1. **Memoization**: Use React.memo, useMemo, and useCallback appropriately
2. **FlatList Optimization**: Implement proper key extractors and render optimizations
3. **Image Optimization**: Use react-native-fast-image for better performance
4. **Bundle Size**: Monitor and optimize bundle size

### **15.3 State Management**

1. **Local State**: Use useState for component-specific state
2. **Global State**: Use Context for app-wide state, Zustand for complex state
3. **Server State**: Use React Query for API data
4. **Persistence**: Use SecureStore for sensitive data

### **15.4 Security**

1. **Token Storage**: Always use SecureStore for tokens
2. **API Security**: Implement proper authentication and authorization
3. **Input Validation**: Validate all user inputs
4. **Error Handling**: Don't expose sensitive information in errors

### **15.5 User Experience**

1. **Loading States**: Always show loading indicators
2. **Error States**: Provide clear error messages
3. **Offline Support**: Handle network errors gracefully
4. **Accessibility**: Implement proper accessibility features

---

## 🎯 **Conclusion**

This guide has covered the fundamental concepts of React Native development with Expo and NativeWind using the Eagle-Notifier project as practical examples. 

**Key Takeaways:**
- React Native with Expo provides a powerful platform for cross-platform mobile development
- TypeScript adds type safety and better developer experience
- NativeWind brings familiar CSS styling to React Native
- Proper state management and data fetching are crucial for app performance
- Authentication and security should be implemented carefully
- Performance optimization should be considered from the start

**Next Steps:**
1. Practice building small components
2. Experiment with different state management approaches
3. Learn about testing strategies
4. Explore advanced React Native features
5. Contribute to open source projects

Remember, the best way to learn is by building real applications and experimenting with different approaches. The Eagle-Notifier project provides excellent examples of production-ready React Native code that you can study and learn from.

Happy coding! 🚀 