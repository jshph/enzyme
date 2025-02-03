import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface Settings {
  vaultPath: string;
  port?: number;
  includedPatterns?: string[];
  excludedPatterns?: string[];
  excludedTags?: string[];
  [key: string]: any;
}

export const useSettingsManager = () => {
  const [settings, setSettings] = useState<Settings>({});
  const [originalSettings, setOriginalSettings] = useState<Settings>({});
  const [hasVaultInitialized, setHasVaultInitialized] = useState<boolean>(false);

  const arrayFields = ['includedPatterns', 'excludedPatterns', 'excludedTags'];

  // Keep these utility methods for Settings.tsx
  const processArrayField = useCallback((value: string[] | string): string => {
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return value as string;
  }, []);

  const hasChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // Update vault path and initialize index
  const initializeVault = useCallback(async (vaultPath: string) => {
    console.log('initializeVault', new Error().stack);
    try {
      // Update vault path in store and get settings
      const savedSettings = await window.electron.ipcRenderer.invoke('update-vault-path', vaultPath);
      setSettings(savedSettings);
      setOriginalSettings(savedSettings);
      
      setHasVaultInitialized(false);
      const result = await window.electron.ipcRenderer.invoke('initialize-index', savedSettings);
      setHasVaultInitialized(result.success);
      
      return result;
    } catch (error) {
      console.error('Error initializing vault:', error);
      throw error;
    }
  }, []);

  // Load settings when vault path changes
  const refreshSettings = useCallback(async (vaultPath?: string) => {
    try {
      if (!vaultPath) {
        vaultPath = await window.electron.ipcRenderer.invoke('get-vault-path');
      }

      if (!vaultPath) {
        console.error('No vault path set', new Error().stack);
        return;
      }

      const newSettings = await window.electron.ipcRenderer.invoke('get-settings', {vaultPath});

      setSettings(newSettings);
      setOriginalSettings(newSettings);
      
      // If we have a vault path, initialize it
      if (newSettings.vaultPath) {
        await initializeVault(newSettings.vaultPath)
      }
      
      return newSettings;
    } catch (error) {
      console.error('Error refreshing settings:', error);
      throw error;
    }
  }, []);

  // Save settings to .enzyme.conf
  const saveSettings = useCallback(async () => {
    try {
      const preparedSettings = { ...settings };
      arrayFields.forEach(field => {
        if (typeof preparedSettings[field] === 'string') {
          preparedSettings[field] = preparedSettings[field].split('\n').filter(Boolean);
        }
      });

      // Save settings to .enzyme.conf
      const result = await window.electron.ipcRenderer.invoke('update-settings', preparedSettings);

      if (!result.success) {
        throw new Error('Failed to save settings');
      }

      await initializeVault(settings.vaultPath);

      // Update original settings after successful save
      setOriginalSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, [settings, arrayFields]);

  // Update a single setting
  const updateSetting = useCallback((key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);
  
  return {
    settings,
    updateSetting,
    saveSettings,
    refreshSettings,
    initializeVault,
    hasVaultInitialized,
    processArrayField,
    hasChanges
  };
}; 