import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsManager';

interface VaultContextType {
  initializeVault: (settings: any) => Promise<boolean>;
  hasVaultInitialized: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};

interface VaultProviderProps {
  children: React.ReactNode;
}

export const VaultProvider: React.FC<VaultProviderProps> = ({ children }) => {
  const [hasVaultInitialized, setHasVaultInitialized] = useState(false);

  const initializeVault = async (settings: any): Promise<boolean> => {
    if (!settings.vaultPath) {
      setHasVaultInitialized(true);
      return true;
    }

    try {
      setHasVaultInitialized(false);
      const response = await window.electron.ipcRenderer.invoke('initialize-index', settings);
      setHasVaultInitialized(true);
      return response.success;
    } catch (error) {
      console.error('Error initializing vault:', error);
      setHasVaultInitialized(false);
      return false;
    }
  };

  const value = {
    initializeVault,
    hasVaultInitialized
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
};

export default VaultProvider;
