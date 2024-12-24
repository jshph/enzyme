import React, { createContext, ReactNode, useContext } from 'react';
import { useSettingsManager, Settings } from '../hooks/useSettingsManager';


interface SettingsContextType {
  settings: Settings;
  refreshSettings: () => Promise<void>;
  updateSetting: (key: string, value: any) => void;
  hasChanges: () => boolean;
  resetSettings: () => void;
  saveSettings: () => Promise<void>;
  processArrayField: (value: string[] | string) => string;
  prepareArrayField: (value: string) => string[]; 
  initializeVault: () => Promise<boolean>;
  hasVaultInitialized: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const settingsManager = useSettingsManager();

  return (
    <SettingsContext.Provider value={settingsManager}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};
