import { ipcMain } from "electron";
import { LocalSettings, store, logger, getServerUrl } from "./index";

export interface Settings {
  port: number;
  includedPatterns: string[];
  excludedPatterns: string[];
  doCache: boolean;
  defaultPatternLimit: number;
  excludedTags: string[];
}
  
const DEFAULT_SETTINGS: Settings = {
  port: 3779,
  includedPatterns: ['**/*.md'],
  excludedPatterns: [],
  doCache: false,
  defaultPatternLimit: 10,
  excludedTags: [],
};

const SERVER_URL = getServerUrl();

// Add a helper function to get the current session token
export async function getCurrentSession() {
  const auth = store.get('auth');
  return auth?.token;
}
  
export function validateSettings(settings: any) {
  // check if settings has all the fields that DEFAULT_SETTINGS has
  const missingFields = Object.keys(DEFAULT_SETTINGS).filter(key => !(key in settings));
  if (missingFields.length > 0) {
    logger.warn(`Missing fields in settings: ${missingFields.join(', ')}`);
  }

  // add any missing fields to settings with default values
  missingFields.forEach(field => {
    settings[field] = (DEFAULT_SETTINGS as any)[field];
  });

  // remove any fields that are not in DEFAULT_SETTINGS
  Object.keys(settings).forEach(key => {
    if (!(key in DEFAULT_SETTINGS)) {
      delete settings[key];
    }
  });

  if (missingFields.length > 0) {
    store.set('settings', settings);
    logger.info(`Validated settings: ${JSON.stringify(settings)}`);
  }

  return settings;
}

export async function getSettings() {
  try {
    const token = await getCurrentSession();
    const auth = store.get('auth');
    const localSettings = store.get('localSettings') || { vaultPath: '' };

    // Get settings from server
    const response = await fetch(`${SERVER_URL}/user/config?email=${auth?.email || ''}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch settings:', await response.text());
      return { ...DEFAULT_SETTINGS, vaultPath: localSettings.vaultPath };
    }

    const serverSettings = await response.json();
    
    // Merge server settings with local vault path
    return {
      ...serverSettings,
      vaultPath: localSettings.vaultPath
    };
  } catch (error) {
    console.error('Error fetching settings:', error);
    const localSettings = store.get('localSettings') || { vaultPath: '' };
    return { ...DEFAULT_SETTINGS, vaultPath: localSettings.vaultPath };
  }

}

export async function clearSession() {
  store.delete('auth');
  store.delete('spaces');

  // Don't clear local settings, we want to keep the vault path

  // But do clear the settings and reset
  store.delete('settings');
  await validateSettings(DEFAULT_SETTINGS);
}

export function setupUserIPCRoutes() {
  ipcMain.handle('get-settings', async (_) => {
    return await getSettings();
  });

  ipcMain.handle('update-settings', async (_, newSettings) => {
    try {
      const token = await getCurrentSession();
      const auth = store.get('auth');
      
      if (!token || !auth?.email) {
        throw new Error('No authenticated session');
      }

      // Update settings on server
      const response = await fetch(`${SERVER_URL}/update-config?email=${auth.email}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });

      if (!response.ok) {
        throw new Error(`Failed to update settings: ${await response.text()}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  });


  ipcMain.handle('update-local-settings', async (_, newLocalSettings: LocalSettings) => {
    try {
      store.set('localSettings', newLocalSettings);
      return { success: true };
    } catch (error) {
      console.error('Error saving local settings:', error);
      throw error;
    }
  });
}