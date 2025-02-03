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
  const [settings, setSettings] = useState<Settings>({
    includedPatterns: [],
    excludedPatterns: [],
    excludedTags: [],
    vaultPath: ''
  });
  const [originalSettings, setOriginalSettings] = useState<Settings>({
    includedPatterns: [],
    excludedPatterns: [],
    excludedTags: [],
    vaultPath: ''
  });
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

  // Refresh settings and initialize vault
  const refreshSettings = useCallback(async (newVaultPath?: string) => {
    try {
      // Get the vault path - either the new one or latest from store
      const vaultPath = newVaultPath || await window.electron.ipcRenderer.invoke('get-vault-path');
      
      if (!vaultPath) {
        console.error('No vault path set', new Error().stack);
        return;
      }

      // First update vault path in store if it's new
      if (newVaultPath) {
        await window.electron.ipcRenderer.invoke('update-vault-path', newVaultPath);
      }

      // Get latest settings with the current vault path
      const newSettings = await window.electron.ipcRenderer.invoke('get-settings', {vaultPath});
      
      // Update settings state
      setSettings(newSettings);
      setOriginalSettings(newSettings);
      
      // Initialize vault with complete settings
      setHasVaultInitialized(false);
      const result = await window.electron.ipcRenderer.invoke('initialize-index', newSettings);
      setHasVaultInitialized(result.success);
      
      return { ...newSettings, ...result };
    } catch (error) {
      console.error('Error refreshing settings:', error);
      throw error;
    }
  }, []);

  // Update a single setting
  const updateSetting = useCallback(async (key: string, value: any) => {
    // Update local state immediately for responsiveness
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));

    // If updating vault path, refresh settings with new path
    if (key === 'vaultPath' && value) {
      try {
        await refreshSettings(value);
      } catch (error) {
        // Revert settings on error
        setSettings(prev => ({
          ...prev,
          [key]: prev[key]
        }));
        throw error;
      }
    }
  }, [refreshSettings]);

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

      // Refresh settings to ensure everything is in sync
      await refreshSettings();

      // Update original settings after successful save
      setOriginalSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, [settings, arrayFields, refreshSettings]);
  
  return {
    settings,
    updateSetting,
    saveSettings,
    refreshSettings,
    hasVaultInitialized,
    processArrayField,
    hasChanges
  };
}; 