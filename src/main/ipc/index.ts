import { Settings, app, ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import winston from 'winston';
import { SpaceInfo } from "./space";
import { setupAuthIPCRoutes } from './auth';
import { setupDigestIPCRoutes } from './digest';
import { setupVaultIPCRoutes } from './vault';
import { setupSpaceRoutes } from './space';
import { setupRecipeRoutes } from './recipe';
import { setupUserIPCRoutes } from "./user";

interface Auth {
  email: string;
  access_token: string;
  refresh_token: string;
}

export interface LocalSettings {
  vaultPath: string;
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

function createLogger() {
  // Now initialize logger with environment variables available
  const logPath = path.join(app.getPath('userData'), 'logs');
  const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ filename: path.join(logPath, 'error_main.log'), level: 'error' }),
      new winston.transports.File({ filename: path.join(logPath, 'combined_main.log') })
    ]
  });
  
  // Log important environment variables (but not sensitive ones)
  // logger.info('Environment configuration:', {
  //   NODE_ENV: import.meta.env.VITE_NODE_ENV,
  //   SERVER_URL: getServerUrl(),
  //   // Add other non-sensitive variables as needed
  // });

  return logger;
}

export const logger = createLogger();

export function getServerUrl() {
  return "https://enzyme-server-production.up.railway.app/";
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

  setupAuthIPCRoutes();
  setupDigestIPCRoutes();
  setupVaultIPCRoutes();
  setupUserIPCRoutes();
  setupSpaceRoutes();
  setupRecipeRoutes();
}