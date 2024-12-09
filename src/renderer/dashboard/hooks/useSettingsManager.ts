import { useState, useCallback, useEffect, useRef } from 'react';

export interface Settings {
  vaultPath?: string;
  port?: number;
  includedPatterns?: string[];
  excludedPatterns?: string[];
  excludedTags?: string[];
  [key: string]: any;
}

export const useSettingsManager = (initialSettings: Settings = {}) => {
  const settingsRef = useRef<Settings>({});
  const [originalSettings, setOriginalSettings] = useState<Settings>(initialSettings);

  const arrayFields = ['includedPatterns', 'excludedPatterns', 'excludedTags'];

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
    settingsRef.current = {
      ...settingsRef.current,
      [key]: value
    };
  }, []);

  const hasChanges = useCallback(() => {
    return JSON.stringify(settingsRef.current) !== JSON.stringify(originalSettings);
  }, [settingsRef, originalSettings]);

  const resetSettings = useCallback(() => {
    settingsRef.current = originalSettings;
  }, [originalSettings]);

  const refreshSettings = async () => {
    const savedSettings = await window.electron.ipcRenderer.invoke('get-settings');
    settingsRef.current = savedSettings;
    setOriginalSettings(savedSettings);
  };

  const saveSettings = useCallback(async () => {
    try {
      const preparedSettings = { ...settingsRef.current };
      arrayFields.forEach(field => {
        if (typeof preparedSettings[field] === 'string') {
          preparedSettings[field] = prepareArrayField(preparedSettings[field] as string);
        }
      });

      const localSettings = {
        vaultPath: preparedSettings.vaultPath || ''
      };
      await window.electron.ipcRenderer.invoke('update-local-settings', localSettings);

      const { vaultPath, ...serverSettings } = preparedSettings;
      const result = await window.electron.ipcRenderer.invoke('update-settings', serverSettings);

      if (result.success) {
        setOriginalSettings(settingsRef.current);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, [settingsRef, arrayFields, prepareArrayField]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('refreshing settings')
        refreshSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    settings: settingsRef.current,
    originalSettings,
    updateSetting,
    hasChanges,
    saveSettings,
    resetSettings,
    processArrayField,
    prepareArrayField,
    refreshSettings
  };
}; 