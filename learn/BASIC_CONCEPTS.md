# 🚀 React Native with Expo & NativeWind - Basic Concepts

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
│   └── components/        # Reusable components
├── assets/                # Images, fonts, sounds
├── package.json           # Dependencies and scripts
├── app.json              # Expo configuration
└── tailwind.config.js    # NativeWind configuration
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

## 📚 **Part 4: NativeWind (Tailwind CSS for React Native)**

### **4.1 What is NativeWind?**

NativeWind allows you to use Tailwind CSS classes in React Native components, providing a familiar styling approach for web developers.

### **4.2 Configuration**

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

### **4.3 Using NativeWind Classes**

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

### **4.4 Dark Mode Support**

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

## 🎯 **Next Steps**

This covers the basic concepts of React Native with Expo and NativeWind. In the next part, we'll explore:

1. **Authentication System**: How login/logout works
2. **Navigation**: File-based routing with Expo Router
3. **Data Fetching**: Using React Query for API calls
4. **State Management**: Zustand for complex state
5. **Performance Optimization**: Best practices for mobile apps

The Eagle-Notifier project provides excellent examples of all these concepts in action. Study the code, experiment with it, and build your own features to solidify your understanding!

Happy coding! 🚀 