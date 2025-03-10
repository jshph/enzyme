import { Settings, app, ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { SpaceInfo } from "./space.js";
import { setupAuthIPCRoutes } from './auth.js';
import { setupDigestIPCRoutes } from './digest.js';
import { setupVaultIPCRoutes } from './vault.js';
import { setupSpaceRoutes } from './space.js';
import { setupRecipeRoutes } from './recipe.js';
import { setupUserIPCRoutes } from "./user.js";
import { setupChatIPCRoutes } from "./chat.js";
import { setupTagSummaryIPCRoutes } from "./tagSummary.js";
import nodeMachineId from 'node-machine-id';
import { initializeLogger } from '../utils/logger.js';

interface Auth {
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface LocalSettings {
  vaultPath: string;
  tagSummaries?: any[];
}

export const store = new Store<{
  settings: Settings, 
  auth: Auth,
  localSettings: LocalSettings,
  spaces: SpaceInfo[]
}>();

// Track app initialization state
let isAppReady = false;
let isVaultInitialized = false;

function broadcastAppState() {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send('app-state-update', {
        isAppReady,
        isVaultInitialized
      });
    }
  });
}

// Listen for when Electron has finished initialization
app.whenReady().then(() => {
  isAppReady = true;
  broadcastAppState();
});

function loadEnvironment() {
  try {
    const envFile = app.isPackaged ? '.env.production' : '.env.development';
    let envPath;

    if (app.isPackaged) {
      // In packaged app, env files should be in resources directory
      // macOS: Contents/Resources
      // Windows/Linux: resources
      const resourcesPath = os.platform() === 'darwin'
        ? path.join(app.getAppPath(), '..', '..', 'Resources')
        : path.join(path.dirname(app.getPath('exe')), '..', 'resources');
      envPath = path.join(resourcesPath, envFile);
    } else {
      // In development, use the app directory
      envPath = path.resolve(app.getAppPath(), envFile);
    }

    // Configure dotenv with override option to ensure variables are set
    const result = dotenv.config({ 
      path: envPath,
      override: true
    });
    
    if (result.error) {
      console.error(`Error loading ${envFile}:`, result.error);
      // If we can't load the env file in production, that's a problem
      if (app.isPackaged) {
        throw result.error;
      }
      // In development, we'll continue with process.env as-is
      console.warn('Continuing with existing environment variables');
    } else {
      console.log(`Loaded environment variables from ${envPath}`);
    }
  } catch (error) {
    console.error('Error in loadEnvironment:', error);
    if (app.isPackaged) {
      throw error;
    }
  }
}

// Load environment variables first, do any process.env loading after this
// loadEnvironment();

export const logger = initializeLogger('main');

export function getServerUrl() {
  return "http://localhost:3129";
  // return "https://enzyme-server-production.up.railway.app";
}

// Add a new function to check if vault is configured
function isVaultConfigured() {
  const localSettings = store.get('localSettings');
  return localSettings?.vaultPath && localSettings.vaultPath.length > 0;
}

export function setupIPC() {
  // Get current app state
  ipcMain.handle('get-app-state', () => ({
    isAppReady,
    isVaultInitialized
  }));

  // Update vault state
  ipcMain.handle('set-vault-initialized', (_, initialized: boolean) => {
    isVaultInitialized = initialized;
    broadcastAppState();
    return isVaultInitialized;
  });

  // Add a new IPC handler to check vault status
  ipcMain.handle('check-vault-status', () => {
    return isVaultConfigured();
  });

  ipcMain.handle('get-device-id', async () => {
    try {
      // Get unique and consistent machine ID
      const machineId = await nodeMachineId.machineId();
      return machineId;
    } catch (error) {
      console.error('Error getting machine ID:', error);
      // Fallback to a combination of app-specific identifiers
      const fallbackId = `${app.getName()}-${app.getPath('userData')}`;
      return fallbackId;
    }
  });
  
  setupAuthIPCRoutes();
  setupDigestIPCRoutes();
  setupVaultIPCRoutes();
  setupSpaceRoutes();
  setupRecipeRoutes();
  setupUserIPCRoutes();
  setupChatIPCRoutes();
  setupTagSummaryIPCRoutes();
}