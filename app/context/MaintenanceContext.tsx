import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { apiConfig } from '../api/config';
import { getAuthHeader } from '../api/auth';

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  checkMaintenanceStatus: () => Promise<void>;
  toggleMaintenanceMode: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const { authState } = useAuth();

  const checkMaintenanceStatus = async () => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.get(
        `${apiConfig.apiUrl}/api/maintenance/status`,
        { headers }
      );
      setIsMaintenanceMode(response.data.maintenanceMode);
    } catch (error) {
      console.error('Error checking maintenance status:', error);
    }
  };

  const toggleMaintenanceMode = async () => {
    try {
      const headers = await getAuthHeader();
      const response = await axios.post(
        `${apiConfig.apiUrl}/api/maintenance/toggle`,
        {},
        { headers }
      );
      setIsMaintenanceMode(response.data.maintenanceMode);
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      throw error;
    }
  };

  // Check maintenance status on mount and when auth state changes
  useEffect(() => {
    if (authState.isAuthenticated) {
      checkMaintenanceStatus();
    }
  }, [authState.isAuthenticated]);

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode,
        checkMaintenanceStatus,
        toggleMaintenanceMode,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
};

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext);
  if (context === undefined) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
}; 