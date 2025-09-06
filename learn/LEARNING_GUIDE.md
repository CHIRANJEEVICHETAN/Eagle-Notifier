# 🚀 React Native with Expo & NativeWind Learning Guide

## 📚 **Part 1: Basic Concepts**

### **1.1 Project Structure**
```
Eagle-Notifier/
├── app/                    # Main app code (Expo Router)
│   ├── _layout.tsx        # Root layout with providers
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Main app routes
│   ├── context/           # React Context providers
│   ├── hooks/             # Custom React hooks
│   └── components/        # Reusable components
├── assets/                # Images, fonts, sounds
├── package.json           # Dependencies and scripts
├── app.json              # Expo configuration
└── tailwind.config.js    # NativeWind configuration
```

### **1.2 Key Dependencies**
- **`expo-router`**: File-based navigation
- **`nativewind`**: Tailwind CSS for React Native
- **`zustand`**: Lightweight state management
- **`@tanstack/react-query`**: Data fetching and caching
- **`expo-notifications`**: Push notifications
- **`expo-secure-store`**: Secure storage for tokens

---

## 📚 **Part 2: React Hooks Fundamentals**

### **2.1 useState Hook**
```typescript
// Basic syntax
const [state, setState] = useState(initialValue);

// Example from login screen
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [showPassword, setShowPassword] = useState(false);

// Update state
const validateEmail = (text: string) => {
  setEmail(text); // Triggers re-render
  if (text.trim() === '') {
    setEmailError('Email is required');
  } else {
    setEmailError('');
  }
};
```

### **2.2 useEffect Hook**
```typescript
// Basic syntax
useEffect(() => {
  // Side effect code
  return () => {
    // Cleanup code (optional)
  };
}, [dependencies]);

// Example: Load user on mount
useEffect(() => {
  const loadUser = async () => {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    if (token) {
      setAuthState({ isAuthenticated: true, user: userData });
    }
  };
  loadUser();
}, []); // Empty array = run only on mount

// Example: Check auth routes when auth state changes
useEffect(() => {
  if (!authState.isLoading) {
    checkAuthRoute();
  }
}, [authState.isAuthenticated, authState.isLoading]);
```

### **2.3 useCallback Hook**
```typescript
// Memoize functions to prevent unnecessary re-renders
const updateUser = useCallback((userData: Partial<User>) => {
  setAuthState(prev => ({
    ...prev,
    user: prev.user ? { ...prev.user, ...userData } : null,
  }));
}, []); // Empty dependency array = function never changes
```

---

## 📚 **Part 3: React Context & State Management**

### **3.1 Creating Context**
```typescript
// Define context type
interface AuthContextProps {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextProps | undefined>(undefined);
```

### **3.2 Context Provider**
```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const login = async (credentials: LoginCredentials) => {
    // Login logic here
  };

  const logout = async () => {
    // Logout logic here
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### **3.3 Using Context**
```typescript
// Custom hook
export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// In components
export default function LoginScreen() {
  const { login, authState } = useAuth();
  
  const handleLogin = async () => {
    await login({ email, password });
  };
}
```

---

## 📚 **Part 4: Authentication System**

### **4.1 Authentication Flow**
1. **App Launch**: Check for stored tokens
2. **Token Validation**: Verify if tokens are valid
3. **Login Process**: User enters credentials
4. **Token Storage**: Store tokens securely
5. **Route Protection**: Redirect based on auth state
6. **Token Refresh**: Automatically refresh expired tokens

### **4.2 Secure Token Storage**
```typescript
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
```typescript
const login = async (credentials: LoginCredentials) => {
  setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
  
  try {
    const response = await axios.post('/api/auth/login', credentials);
    const { user, token, refreshToken } = response.data;
    
    // Set axios headers
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
    });
    
    // Navigate
    router.replace('/onboarding');
    
  } catch (error: any) {
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: 'Login failed',
    });
  }
};
```

### **4.4 Route Protection**
```typescript
const checkAuthRoute = useCallback(() => {
  const { isAuthenticated, isLoading, role } = authState;
  if (isLoading) return;
  
  const inAuthGroup = segments[0] === '(auth)';
  
  // If not authenticated, redirect to login
  if (!isAuthenticated && !inAuthGroup) {
    navigateTo('/');
    return;
  }
  
  // If authenticated but in auth group, go to dashboard
  if (isAuthenticated && inAuthGroup) {
    navigateTo('/onboarding');
    return;
  }
}, [authState.isAuthenticated, authState.isLoading, segments]);
```

---

## 📚 **Part 5: NativeWind (Tailwind CSS)**

### **5.1 Configuration**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

### **5.2 Using NativeWind Classes**
```typescript
// Instead of StyleSheet.create, use className
<View className="flex-1 bg-gray-50 dark:bg-gray-900">
  <Text className="text-2xl font-bold text-gray-900 dark:text-white">
    Welcome Back
  </Text>
  <TextInput 
    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white dark:bg-gray-800"
    placeholder="Email"
  />
</View>

// Combining with StyleSheet
<View 
  className="flex-1 bg-gray-50 dark:bg-gray-900"
  style={styles.container}
>
  <Text style={[styles.title, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
    Welcome Back
  </Text>
</View>
```

---

## 📚 **Part 6: Navigation with Expo Router**

### **6.1 File-Based Routing**
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
│   └── profile/
│       └── index.tsx    # Profile route (/dashboard/profile)
```

### **6.2 Navigation Functions**
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

---

## 📚 **Part 7: Data Fetching with React Query**

### **7.1 Setup**
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

### **7.2 Custom Hooks**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
  
  return { alarms, isLoading, error, refetch, updateAlarm };
};
```

### **7.3 Using the Hook**
```typescript
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

### **8.1 Creating a Store**
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
}

export const useAlarmStore = create<AlarmStore>()(
  persist(
    (set) => ({
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
    }),
    { name: 'alarm-store' }
  )
);
```

### **8.2 Using the Store**
```typescript
export default function AlarmsScreen() {
  const { alarms, addAlarm, updateAlarm } = useAlarmStore();
  
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
}

export interface LoginCredentials {
  email: string;
  password: string;
}
```

### **9.2 Component Props**
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

---

## 📚 **Part 10: Performance Optimization**

### **10.1 React.memo**
```typescript
export const AlarmCard = React.memo<AlarmCardProps>(({ alarm, onPress }) => {
  return (
    <TouchableOpacity onPress={() => onPress(alarm)}>
      <Text>{alarm.title}</Text>
      <Text>{alarm.severity}</Text>
    </TouchableOpacity>
  );
});
```

### **10.2 useMemo**
```typescript
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
```typescript
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
```typescript
const login = async (credentials: LoginCredentials) => {
  try {
    const response = await axios.post('/api/auth/login', credentials);
    // Handle success
  } catch (error: any) {
    let errorMessage = 'An error occurred';
    
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
    }
    
    setAuthState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: errorMessage,
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
3. **Bundle Size**: Monitor and optimize bundle size

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