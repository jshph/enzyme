import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { ServerContext } from './server';
import { store, logger } from './ipc/index';
import { Menubar, menubar } from 'menubar';
import { nativeImage } from 'electron';
import { getSettings, validateSettings, setupUserIPCRoutes } from './ipc/user';
import { setupAuthIPCRoutes } from './ipc/auth';
import { setupVaultIPCRoutes } from './ipc/vault';
import { setupDigestIPCRoutes } from './ipc/digest';
import { setupSpaceRoutes } from './ipc/space';
import { setupPromptRoutes } from './ipc/prompts';

let mainWindow: BrowserWindow | null = null;
const serverContext = new ServerContext();


const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
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

  setupMenubar();
  setupDashboard();

  setupUserIPCRoutes();
  setupAuthIPCRoutes();
  setupVaultIPCRoutes();
  setupDigestIPCRoutes();
  setupSpaceRoutes();
  setupPromptRoutes();
  // Handle uncaught exceptions

  // process.on('uncaughtException', (error) => {
  //   logger.error('Uncaught exception:', error);
  // });

  // process.on('unhandledRejection', (reason, promise) => {
  //   logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  // });

  if (!app.isPackaged) {
    try {
      require('electron-debug')({ showDevTools: true });
    } catch (err) {
      logger.error('Failed to load electron-debug:', err);
    }
  }

  // Hide the dock icon initially if on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
}


function setupMenubar() {

  function getMenubarIcon() {
    try {
      let iconPath;
      if (app.isPackaged) {
        iconPath = `${process.resourcesPath}/IconTemplate.png`;
      } else {
        iconPath = `${process.resourcesPath}/IconTemplate.png`;
      }
      
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        logger.error('Failed to load menubar icon');
        return nativeImage.createEmpty();
      }
      return icon;
    } catch (error) {
      logger.error('Error creating menubar icon:', error);
      return nativeImage.createEmpty();
    }
  }

  const mb: Menubar = menubar({
    index: `${app.getAppPath()}/src/renderer/menubar`,
    icon: getMenubarIcon(),
    browserWindow: {
      width: 400,
      height: 800,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        preload: `${app.getAppPath()}/src/preload/index.ts`
      },
      vibrancy: 'tooltip',
    }
  });
  
  mb.on('after-create-window', () => {
    logger.info('Menubar window created');
  });
  
  mb.on('after-show', () => {
    logger.info('Menubar window shown');
  });
  
  mb.on('after-hide', () => {
    logger.info('Menubar window hidden');
  });
  
  mb.on('focus-lost', () => {
    logger.info('Menubar window lost focus');
  });
  
  // if (process.env.NODE_ENV === 'development') {
  //   const watchPath = path.join(app.getAppPath(), 'src', 'renderer', '**/*');
  //   chokidar.watch(watchPath, {
  //     ignored: /(^|[\/\\])\../,
  //     persistent: true
  //   }).on('change', (path) => {
  //     logger.info('Renderer file changed:', path);
  //     if (mb.window) {
  //       mb.window.reload();
  //     }
  //   });
  // }
  
  mb.on('ready', async () => {
    let settings = await getSettings();

    // Validate settings
    settings = validateSettings(settings);
  
    await serverContext.startServer(settings);
    logger.info('Menubar app is ready');
  });
}



function createWindow(): void {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }

  // Show dock icon when dashboard opens
  if (process.platform === 'darwin') {
    app.dock.show();
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1024,
    minWidth: 1280,
    minHeight: 1024,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // preload: `${app.getAppPath()}/src/preload/index.ts`
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#202020',
    frame: false
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Hide dock icon when dashboard closes
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && import.meta.env.VITE_ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(import.meta.env.VITE_ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'src/renderer/index.html'))
  }
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

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

