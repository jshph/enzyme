import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface Settings {
  vaultPath?: string;
  port?: number;
  includedPatterns?: string[];
  excludedPatterns?: string[];
  excludedTags?: string[];
  [key: string]: any;
}

export const useSettingsManager = (providedInitialSettings: Settings = {}) => {
  const [settings, setSettings] = useState<Settings>(providedInitialSettings);
  const [originalSettings, setOriginalSettings] = useState<Settings>(providedInitialSettings);
  const [hasVaultInitialized, setHasVaultInitialized] = useState<boolean>(false);
  const { isAuthenticated } = useAuth();

  const arrayFields = ['includedPatterns', 'excludedPatterns', 'excludedTags'];

  const saveLocalSettings = useCallback(async () => {
    if (settings.vaultPath) {
      await window.electron.ipcRenderer.invoke('update-local-settings', {
        vaultPath: settings.vaultPath
      });
    } else {
      console.log('No vault path provided');
    }
  }, [settings]);

  const processArrayField = useCallback((value: string[] | string): string => {
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return value as string;
  }, []);

  const prepareArrayField = useCallback((value: string): string[] => {
    return value.split('\n').filter(Boolean);
  }, []);

  const updateSetting = useCallback((key: string, value: any) => {
    setSettings(prevSettings => ({
      ...prevSettings,
      [key]: value
    }));
  }, [setSettings]);

  const hasChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const resetSettings = useCallback(() => {
    setSettings(originalSettings);
  }, [setSettings, originalSettings]);

  const refreshSettings = async () => {
    try {
      const newSettings = await window.electron.ipcRenderer.invoke
      ('get-settings');
      setSettings(newSettings);
    } catch (error) {
      console.error('Error refreshing settings:', error);
    }
  };

  const initializeVault = async (): Promise<boolean> => {
    try {
      const savedSettings = await window.electron.ipcRenderer.invoke('get-settings');
      
      setHasVaultInitialized(false);
      const result = await window.electron.ipcRenderer.invoke('initialize-index', savedSettings);
      setHasVaultInitialized(result.success);
      return result.success;
    } catch (error) {
      console.error('Error initializing vault:', error);
      throw error;
    }
  }

  const saveSettings = useCallback(async () => {
    try {
      const preparedSettings = { ...settings };
      arrayFields.forEach(field => {
        if (typeof preparedSettings[field] === 'string') {
          let values = prepareArrayField(preparedSettings[field] as string);
          preparedSettings[field] = values;
        }
      });

      // Save vault path to electron store
      await saveLocalSettings();

      // Save other settings to .enzyme.conf
      const { vaultPath, ...fileSettings } = preparedSettings;
      const result = await window.electron.ipcRenderer.invoke('update-settings', fileSettings);

      if (result.success) {
        setOriginalSettings(settings);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, [settings, arrayFields, prepareArrayField, saveLocalSettings]);

  // Refresh settings when the page is visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await refreshSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Also refresh settings when authentication changes
  useEffect(() => {
    refreshSettings();
    initializeVault();
  }, [isAuthenticated]);

  return {
    settings,
    originalSettings,
    updateSetting,
    hasChanges,
    saveSettings,
    resetSettings,
    processArrayField,
    prepareArrayField,
    refreshSettings,
    initializeVault,
    hasVaultInitialized
  };
}; 