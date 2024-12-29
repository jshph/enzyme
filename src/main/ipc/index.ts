import { Settings, app } from "electron";
import Store from "electron-store";
import dotenv from 'dotenv';
import path from 'path';
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
  token: string;
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


function loadEnvironment() {
  try {
    const envFile = app.isPackaged ? '.env.production' : '.env.development';
    let envPath;

    if (app.isPackaged) {
      // In packaged app, env files should be in resources directory
      envPath = path.join(process.resourcesPath, envFile);
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
loadEnvironment();

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
  logger.info('Environment configuration:', {
    NODE_ENV: import.meta.env.VITE_NODE_ENV,
    SERVER_URL: getServerUrl(),
    // Add other non-sensitive variables as needed
  });

  return logger;
}

export const logger = createLogger();

export function getServerUrl() {
  return import.meta.env.VITE_SERVER_URL as string;
}

export function setupIPC() {
  setupAuthIPCRoutes();
  setupDigestIPCRoutes();
  setupVaultIPCRoutes();
  setupUserIPCRoutes();
  setupSpaceRoutes();
  setupRecipeRoutes();
}