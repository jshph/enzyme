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

export async function getSettings() {
  try {
    const { access_token, email } = await getCurrentSession();
    if (!access_token || !email) {
      throw new Error('No authenticated session');
    }

    const localSettings = store.get('localSettings') || { vaultPath: '' };

    // Get settings from server using the fresh access token
    const response = await fetch(`${SERVER_URL}/user/config?email=${email}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
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
    // console.error('Error fetching settings:', error);
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
      const { access_token, email } = await getCurrentSession();
      
      if (!access_token || !email) {
        throw new Error('No authenticated session');
      }

      // Update settings on server
      const response = await fetch(`${SERVER_URL}/user/update-config?email=${email}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`
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