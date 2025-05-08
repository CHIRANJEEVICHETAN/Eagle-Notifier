export type UserRole = 'operator' | 'maintenance' | 'admin' | 'compliance' | 'iot-manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface RegisterData extends LoginCredentials {
  name: string;
  role: UserRole;
} 