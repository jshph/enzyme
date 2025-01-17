import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ServerContext } from './server';
import { store, logger, setupIPC } from './ipc/index';

declare global {
  interface ImportMetaEnv {
    VITE_ELECTRON_RENDERER_URL: string
  }
}


let mainWindow: BrowserWindow | null = null;
const serverContext = new ServerContext();

// Add this helper at the top of your file
const getPlatform = () => {
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
    return 'darwin';
  }
  if (platform.hasWindowsFeatures || platform.fromProcess === 'win32' || 
      platform.isWindowsLike) {
    return 'win32';
  }
  if (platform.isUnixLike || platform.fromProcess === 'linux') {
    return 'linux';
  }
  
  // Default to the most restrictive platform
  return 'unknown';
};

// Helper function for dock operations using the robust platform detection
function handleDock(action: 'show' | 'hide'): Promise<void> {
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

console.log('Starting app in mode:', process.defaultApp ? 'development' : 'production');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('App already running');
  app.quit();
} else {
  initializeMain();
}

function initializeMain() {
  logger.info('App starting in mode:', process.defaultApp ? 'development' : 'production');
  logger.info('Command line arguments:', process.argv);

  
  app.on('before-quit', async () => {
    await serverContext.stopServer();
  });
  
  ipcMain.handle('select-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        message: 'Select or create your markdown vault folder',
        buttonLabel: 'Open'
      });
      
      if (!result.canceled) {
        // Save the selected path to local settings
        store.set('localSettings', { vaultPath: result.filePaths[0] });
        return result.filePaths[0];
      }
      return null;
    } catch (error) {
      console.error('Error selecting directory:', error);
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

  if (!app.isPackaged) {
    try {
      require('electron-debug')({ showDevTools: true });
    } catch (err) {
      logger.error('Failed to load electron-debug:', err);
    }
  }
}


function createWindow(): void {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  app.whenReady().then(async () => {
    await handleDock('show');

    // Determine preload path based on whether app is packaged
    const preloadPath = app.isPackaged
      ? path.join(process.resourcesPath, 'out', 'preload', 'index.mjs')
      : path.join(app.getAppPath(), 'out', 'preload', 'index.mjs');

    mainWindow = new BrowserWindow({
      width: 1400,
      height: 1080,
      minWidth: 1400,
      minHeight: 1080,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: preloadPath
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


    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    // if (is.dev && import.meta.env.VITE_ELECTRON_RENDERER_URL) {
    if (is.dev && import.meta.env.VITE_ELECTRON_RENDERER_URL) {
      mainWindow.loadURL(import.meta.env.VITE_ELECTRON_RENDERER_URL + '/dashboard.html')
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/dashboard.html'))
    }

    // Add this event handler
    mainWindow.on('closed', async () => {
      mainWindow = null;
      await handleDock('hide');
    });
  });
}


function setupDashboard() {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {

    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}