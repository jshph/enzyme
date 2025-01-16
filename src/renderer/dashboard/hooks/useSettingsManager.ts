import { useState, useCallback, useEffect } from 'react';

export interface Settings {
  vaultPath?: string;
  port?: number;
  includedPatterns?: string[];
  excludedPatterns?: string[];
  excludedTags?: string[];
  [key: string]: any;
}

export const useSettingsManager = (initialSettings: Settings = {}) => {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [originalSettings, setOriginalSettings] = useState<Settings>(initialSettings);
  const [hasVaultInitialized, setHasVaultInitialized] = useState<boolean>(false);

  const arrayFields = ['includedPatterns', 'excludedPatterns', 'excludedTags'];

  const saveLocalSettings = async (settings: Settings) => {
    if (settings.vaultPath) {
      await window.electron.ipcRenderer.invoke('update-local-settings', {
        vaultPath: settings.vaultPath
      });
    } else {
      console.log('No vault path provided');
    }
  }

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
    setSettings(currentSettings => ({
      ...currentSettings,
      [key]: value
    }));
  }, []);

  const hasChanges = useCallback(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  const resetSettings = useCallback(() => {
    setSettings(originalSettings);
  }, [originalSettings]);

  const refreshSettings = async (): Promise<Settings> => {
    const savedSettings = await window.electron.ipcRenderer.invoke('get-settings');

    await saveLocalSettings(savedSettings);

    setSettings(savedSettings);
    setOriginalSettings(savedSettings);
    return savedSettings;
  };

  const initializeVault = async (): Promise<boolean> => {
    try {
      const savedSettings = await window.electron.ipcRenderer.invoke('get-settings');
      
      // Ensure .obsidian is in excluded patterns
      if (!savedSettings.excludedPatterns) {
        savedSettings.excludedPatterns = [];
      }
      if (!savedSettings.excludedPatterns.includes('.obsidian*/**/*')) {
        savedSettings.excludedPatterns.push('.obsidian*/**/*');
      }
      
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
          
          // Ensure .obsidian is in excluded patterns
          if (field === 'excludedPatterns' && !values.includes('.obsidian/**/*')) {
            values.push('.obsidian/**/*');
          }
          
          preparedSettings[field] = values;
        }
      });

      await saveLocalSettings(preparedSettings);

      const { vaultPath, ...serverSettings } = preparedSettings;
      const result = await window.electron.ipcRenderer.invoke('update-settings', serverSettings);

      if (result.success) {
        setOriginalSettings(settings);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }, [settings, arrayFields, prepareArrayField]);

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