import { app, shell, BrowserWindow, ipcMain, dialog, nativeImage, Notification } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { ServerContext } from './server.js';
import { store, logger, setupIPC } from './ipc/index.js';
// import os from 'os';
import { fileURLToPath } from 'url'
import appIcon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'
import { setupIpcUpdater } from './updater.js';

declare global {
  interface ImportMetaEnv {
    VITE_ELECTRON_RENDERER_URL: string
  }
}


let mainWindow: BrowserWindow | null = null;
const serverContext = new ServerContext();

// Add this helper at the top of your file
const getPlatform = () => {
  logger.debug('Detecting platform...', {
    processPlat: process?.platform,
    navPlat: typeof navigator !== 'undefined' ? navigator.platform : 'undefined',
    hasDock: Boolean(app.dock),
    hasWindowsFeatures: Boolean(app.setAppUserModelId)
  });

  // Try multiple ways to detect platform
  const platform = {
    // Primary checks
    fromProcess: process?.platform,
    fromNavigator: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    
    // Check for specific APIs
    hasDock: Boolean(app.dock),
    hasWindowsFeatures: Boolean(app.setAppUserModelId),
    
    // Check for specific paths
    isUnixLike: Boolean(process?.env?.HOME),
    isWindowsLike: Boolean(process?.env?.USERPROFILE)
  };

  // Determine platform using multiple signals
  if (platform.hasDock || platform.fromProcess === 'darwin' || 
      platform.fromNavigator?.includes('Mac')) {
    logger.debug(`Platform detected as: darwin`);
    return 'darwin';
  }
  if (platform.hasWindowsFeatures || platform.fromProcess === 'win32' || 
      platform.isWindowsLike) {
    logger.debug(`Platform detected as: win32`);
    return 'win32';
  }
  if (platform.isUnixLike || platform.fromProcess === 'linux') {
    logger.debug(`Platform detected as: linux`);
    return 'linux';
  }
  
  // Default to the most restrictive platform
  logger.debug(`Platform detected as: unknown`);
  return 'unknown';
};

// Helper function for dock operations using the robust platform detection
function handleDock(action: 'show' | 'hide'): Promise<void> {
  logger.debug(`Handling dock action: ${action}`);
  return new Promise<void>((resolve) => {
    const platform = getPlatform();
    
    if (platform === 'darwin' && app.dock) {
      action === 'show' ? app.dock.show() : app.dock.hide();
      resolve();
    } else {
      // Not on macOS or no dock API
      logger.debug(`Dock operation '${action}' skipped (platform: ${platform})`);
      resolve();
    }
  });
}

// Add startup logging
logger.info('Application starting', {
  defaultApp: process.defaultApp,
  mode: process.defaultApp ? 'development' : 'production',
  argv: process.argv
});

const gotTheLock = app.requestSingleInstanceLock();
logger.debug(`Single instance lock acquired: ${gotTheLock}`);

if (!gotTheLock) {
  logger.info('Another instance is running, quitting');
  app.quit();
} else {
  logger.info('Initializing main process');
  initializeMain();
}
function initializeMain() {
  logger.info('Main initialization started', {
    mode: process.defaultApp ? 'development' : 'production',
    argv: process.argv
  });

  logger.info('App starting in mode:', process.defaultApp ? 'development' : 'production');
  logger.info('Command line arguments:', process.argv);
  
  app.on('before-quit', async () => {
    logger.info('Application preparing to quit');
    await serverContext.stopServer();
    logger.info('Server stopped successfully');
  });
  
  ipcMain.handle('select-directory', async () => {
    logger.debug('Directory selection dialog requested');
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        message: 'Select or create your markdown vault folder',
        buttonLabel: 'Open'
      });
      
      logger.debug('Directory selection result', { 
        canceled: result.canceled,
        paths: result.filePaths 
      });
      
      if (!result.canceled) {
        store.set('localSettings', { vaultPath: result.filePaths[0] });
        return result.filePaths[0];
      }
      return null;
    } catch (error) {
      logger.error('Error in directory selection:', error);
      throw error;
    }
  });

  
  ipcMain.on('quit-app', () => {
    app.quit();
  });
  
  ipcMain.on('open-dashboard', () => {
    createWindow();
  });

  setupDashboard();
  setupIPC();
  logger.info('Main initialization completed');
}


function createWindow(): void {
  logger.debug('Creating main window', { 
    exists: Boolean(mainWindow) 
  });
  
  if (mainWindow) {
    logger.debug('Main window exists, focusing');
    mainWindow.focus();
    return;
  }

  app.whenReady().then(async () => {
    logger.debug('App ready, showing dock');
    await handleDock('show');

    // const resourcesPath = os.platform() === 'darwin'
    //     ? path.join(app.getAppPath(), '..', '..', 'Resources')
    //     : path.join(path.dirname(app.getPath('exe')), '..', 'resources');

    // Determine preload path based on whether app is packaged
    // const preloadPath = app.isPackaged
    //   ? path.join(resourcesPath, 'out', 'preload', 'index.mjs')
    //   : path.join(app.getAppPath(), 'out', 'preload', 'index.mjs');

    // logger.debug('Creating browser window', { 
    //   preloadPath,
    //   isPackaged: app.isPackaged 
    // });

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 1080,
      minWidth: 1400,
      minHeight: 1080,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: fileURLToPath(new URL("../preload/index.mjs", import.meta.url))
      },
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 15 },
      backgroundColor: '#202020',
      frame: false
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })


    // Load the remote URL for development or the local html file when packaged
    //   mainWindow.loadFile(fileURLToPath(new URL("../renderer/dashboard.html", import.meta.url)))
    mainWindow.loadURL(import.meta.env.VITE_ELECTRON_RENDERER_URL + '/dashboard.html')

    // Add this event handler
    mainWindow.on('closed', async () => {
      logger.debug('Main window closed');
      mainWindow = null;
      await handleDock('hide');
    });
  }).catch(error => {
    logger.error('Error in window creation:', error);
  });
}


function setupDashboard() {
  logger.debug('Setting up dashboard');
  
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    logger.info('App ready event triggered');

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')
    logger.debug('App user model ID set');

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      logger.debug('New browser window created');
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
      logger.debug('App activated', { 
        windowCount: BrowserWindow.getAllWindows().length 
      });
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    app.dock.setIcon(nativeImage.createFromPath(appIcon))

    // Add update setup
    if (!process.defaultApp) {
      setupIpcUpdater();
    }
  }).catch(error => {
    logger.error('Error in dashboard setup:', error);
  });

  // Add cleanup when app quits
  app.on('before-quit', () => {

  });

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    logger.debug('All windows closed');
    if (process.platform !== 'darwin') {
      logger.info('Quitting app (non-macOS platform)');
      app.quit()
    }
  })
}
