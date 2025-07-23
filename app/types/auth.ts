export type UserRole = 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  avatar?: string;
  pushToken?: string | null;
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
}

export interface RegisterData extends LoginCredentials {
  name: string;
  role: UserRole;
} 