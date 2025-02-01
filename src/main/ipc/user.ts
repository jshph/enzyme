import { ipcMain } from "electron";
import { store, logger } from "./index.js";
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Settings {
  vaultPath: string;
  port: number;
  includedPatterns: string[];
  excludedPatterns: string[];
  doCache: boolean;
  defaultPatternLimit: number;
  excludedTags: string[];
}
  
const DEFAULT_SETTINGS: Settings = {
  vaultPath: '',
  port: 3779,
  includedPatterns: ['**/*.md'],
  excludedPatterns: ['**/.obsidian*/**/*', "**/.trash"],
  doCache: false,
  defaultPatternLimit: 10,
  excludedTags: [],
};


// Modify getCurrentSession to handle token refresh
export async function getCurrentSession(): Promise<{ access_token: string; email: string; refresh_token: string }> {
  const auth = store.get('auth');
  if (!auth) return { access_token: '', email: '', refresh_token: '' };

  try {
    // Try to verify/refresh the session
    const response = await fetch(`${SERVER_URL}/auth/verify-session`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(auth.access_token && { 'Authorization': `Bearer ${auth.access_token}` })
      },
      body: JSON.stringify({
        refresh_token: auth.refresh_token
      })
    });

    const data = await response.json();
    
    if (data.isAuthenticated) {
      // Update stored tokens if we got new ones
      if (data.access_token) {
        store.set('auth', {
          email: data.user.email,
          access_token: data.access_token,
          refresh_token: data.refresh_token || auth.refresh_token
        });
        return {
          email: data.user.email,
          access_token: data.access_token,
          refresh_token: data.refresh_token || auth.refresh_token
        };
      }
    }
    
    // If verification failed, clear auth
    store.delete('auth');
    return { access_token: '', email: '', refresh_token: '' };
  } catch (error) {
    // console.error('Error refreshing session:', error);
    return { access_token: '', email: '', refresh_token: '' };
  }
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


async function readConfigFile(vaultPath: string): Promise<Partial<Settings>> {
  try {
    const configPath = path.join(vaultPath, '.enzyme.conf');
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    // If file doesn't exist or is invalid, return empty object
    return {};
  }
}

async function writeConfigFile(vaultPath: string, settings: Partial<Settings>) {
  try {
    const configPath = path.join(vaultPath, '.enzyme.conf');
    await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Error writing config file:', error);
    throw error;
  }
}

export async function getSettings() {
  try {
    const localSettings = store.get('localSettings') || { vaultPath: '' };
    
    // Start with default settings
    let mergedSettings = {
      ...DEFAULT_SETTINGS,
      vaultPath: localSettings.vaultPath
    };

    // If we have a vault path, try to read the config file
    if (localSettings.vaultPath) {
      const fileSettings = await readConfigFile(localSettings.vaultPath);
      mergedSettings = {
        ...mergedSettings,
        ...fileSettings,
        vaultPath: localSettings.vaultPath // Always preserve vault path
      };
    }

    return mergedSettings;
  } catch (error) {
    logger.error('Error getting settings:', error);
    const localSettings = store.get('localSettings') || { vaultPath: '' };
    return {
      ...DEFAULT_SETTINGS,
      vaultPath: localSettings.vaultPath
    };
  }
}

export async function clearSession() {
  const localSettings = store.get('localSettings') || { vaultPath: '' };
  
  store.delete('auth');
  store.delete('spaces');
  store.delete('settings');

  // Preserve vaultPath in localSettings
  store.set('localSettings', { vaultPath: localSettings.vaultPath });
  
  // Reset settings while keeping vaultPath
  const defaultWithVaultPath = {
    ...DEFAULT_SETTINGS,
    vaultPath: localSettings.vaultPath
  };
  await validateSettings(defaultWithVaultPath);
}

export function setupUserIPCRoutes() {
  ipcMain.handle('get-settings', async () => {
    return await getSettings();
  });

  ipcMain.handle('update-settings', async (_, newSettings) => {
    try {
      const localSettings = store.get('localSettings') || { vaultPath: '' };
      if (!localSettings.vaultPath) {
        throw new Error('No vault path set');
      }

      // Write settings to config file
      await writeConfigFile(localSettings.vaultPath, newSettings);
      return { success: true };
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw error;
    }
  });

  ipcMain.handle('update-local-settings', async (_, newLocalSettings) => {
    try {
      store.set('localSettings', newLocalSettings);
      return { success: true };
    } catch (error) {
      logger.error('Error saving local settings:', error);
      throw error;
    }
  });
}