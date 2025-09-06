# 🚀 React Native with Expo & NativeWind - Quick Start Guide

## 📚 **Essential Concepts**

### **1. React Hooks Basics**

**useState - Managing Component State:**
```typescript
// Basic syntax
const [state, setState] = useState(initialValue);

// Example from login screen
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [isLoading, setIsLoading] = useState(false);

// Update state
const handleEmailChange = (text: string) => {
  setEmail(text); // Triggers re-render
  if (text.trim() === '') {
    setEmailError('Email is required');
  } else {
    setEmailError('');
  }
};
```

**useEffect - Side Effects:**
```typescript
// Run on mount
useEffect(() => {
  loadUserData();
}, []); // Empty array = run only once

// Run when dependencies change
useEffect(() => {
  if (user) {
    fetchUserAlarms(user.id);
  }
}, [user]); // Run when user changes
```

**useCallback - Memoize Functions:**
```typescript
const handleLogin = useCallback(async () => {
  setIsLoading(true);
  try {
    await login({ email, password });
  } catch (error) {
    setError('Login failed');
  } finally {
    setIsLoading(false);
  }
}, [email, password, login]);
```

### **2. React Context - Global State**

**Creating Context:**
```typescript
// Define context type
interface AuthContextProps {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

// Create context
const AuthContext = createContext<AuthContextProps | undefined>(undefined);
```

**Context Provider:**
```typescript
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (credentials: LoginCredentials) => {
    // Login logic
    const response = await axios.post('/api/auth/login', credentials);
    setUser(response.data.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Using Context:**
```typescript
// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// In components
function LoginScreen() {
  const { login, isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Dashboard />;
  }
  
  return <LoginForm onLogin={login} />;
}
```

### **3. NativeWind - Styling**

**Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
};
```

**Using Tailwind Classes:**
```typescript
// Instead of StyleSheet
<View className="flex-1 bg-gray-50 p-4">
  <Text className="text-2xl font-bold text-gray-900 mb-4">
    Welcome Back
  </Text>
  <TextInput 
    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
    placeholder="Email"
  />
  <TouchableOpacity className="bg-blue-500 p-3 rounded-lg mt-4">
    <Text className="text-white text-center font-semibold">
      Sign In
    </Text>
  </TouchableOpacity>
</View>
```

**Dark Mode Support:**
```typescript
const { isDarkMode } = useTheme();

<View className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
  <Text className={`text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
    Content
  </Text>
</View>
```

### **4. Expo Router - Navigation**

**File-Based Routing:**
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

**Navigation Functions:**
```typescript
import { router } from 'expo-router';

// Navigate
router.push('/dashboard');

// Replace (no back button)
router.replace('/dashboard');

// With parameters
router.push({
  pathname: '/dashboard/alarms/[id]',
  params: { id: '123' }
});

// Go back
router.back();
```

**Route Parameters:**
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

### **5. Data Fetching with React Query**

**Setup:**
```typescript
// _layout.tsx
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

**Custom Hook:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useAlarms = () => {
  const queryClient = useQueryClient();
  
  // Fetch data
  const { data: alarms, isLoading, error } = useQuery({
    queryKey: ['alarms'],
    queryFn: async () => {
      const response = await axios.get('/api/alarms');
      return response.data;
    },
  });
  
  // Update data
  const updateAlarm = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await axios.put(`/api/alarms/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      // Refetch data
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
  
  return { alarms, isLoading, error, updateAlarm };
};
```

**Using in Components:**
```typescript
function AlarmsScreen() {
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

### **6. State Management with Zustand**

**Creating Store:**
```typescript
import { create } from 'zustand';

interface AlarmStore {
  alarms: Alarm[];
  addAlarm: (alarm: Alarm) => void;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
}

export const useAlarmStore = create<AlarmStore>((set) => ({
  alarms: [],
  
  addAlarm: (alarm) => set((state) => ({
    alarms: [...state.alarms, alarm]
  })),
  
  updateAlarm: (id, updates) => set((state) => ({
    alarms: state.alarms.map(alarm =>
      alarm.id === id ? { ...alarm, ...updates } : alarm
    )
  })),
}));
```

**Using Store:**
```typescript
function AlarmsScreen() {
  const { alarms, addAlarm, updateAlarm } = useAlarmStore();
  
  const handleAddAlarm = () => {
    const newAlarm = {
      id: Date.now().toString(),
      title: 'New Alarm',
      severity: 'medium',
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

### **7. Performance Optimization**

**React.memo:**
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

**useMemo:**
```typescript
function AlarmsScreen() {
  const { alarms } = useAlarmStore();
  
  // Memoize expensive calculations
  const criticalAlarms = useMemo(() => {
    return alarms.filter(alarm => alarm.severity === 'critical');
  }, [alarms]);
  
  return (
    <View>
      <Text>Critical: {criticalAlarms.length}</Text>
      <FlatList data={alarms} renderItem={renderAlarm} />
    </View>
  );
}
```

**FlatList Optimization:**
```typescript
function AlarmsScreen() {
  const { alarms } = useAlarmStore();
  
  // Memoize render function
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
    />
  );
}
```

### **8. TypeScript Best Practices**

**Type Definitions:**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}
```

**Component Props:**
```typescript
interface AlarmCardProps {
  alarm: Alarm;
  onPress: (alarm: Alarm) => void;
  onUpdate: (updates: Partial<Alarm>) => void;
}

export function AlarmCard({ alarm, onPress, onUpdate }: AlarmCardProps) {
  // Component implementation
}
```

**Custom Hooks:**
```typescript
interface UseAlarmsReturn {
  alarms: Alarm[];
  isLoading: boolean;
  error: string | null;
  updateAlarm: (id: string, data: Partial<Alarm>) => void;
}

export const useAlarms = (): UseAlarmsReturn => {
  // Hook implementation
};
```

---

## 🎯 **Key Takeaways**

1. **useState** - For local component state
2. **useEffect** - For side effects and lifecycle
3. **useCallback** - For memoizing functions
4. **Context** - For global state that doesn't change often
5. **React Query** - For server state and API calls
6. **Zustand** - For complex client state
7. **NativeWind** - For styling with Tailwind classes
8. **Expo Router** - For file-based navigation
9. **TypeScript** - For type safety and better DX
10. **Performance** - Use memoization and optimization techniques

---

## 🚀 **Next Steps**

1. **Study the Eagle-Notifier codebase** - It's a great example of production-ready React Native code
2. **Build small features** - Start with simple components and gradually add complexity
3. **Experiment with different patterns** - Try different state management approaches
4. **Learn about testing** - Add unit and integration tests
5. **Explore advanced features** - Push notifications, offline support, etc.

The Eagle-Notifier project demonstrates all these concepts in a real-world application. Use it as a reference and learning resource!

Happy coding! 🚀 