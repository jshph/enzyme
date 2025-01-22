import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { dialog } from 'electron';
import { logger } from './ipc/index.js';

export function setupIpcUpdater() {
  logger.debug('Setting up auto-updater');

  // Configure auto updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = logger;

  // Handle update errors
  autoUpdater.on('error', (err) => {
    const errorMessage = err.stack || err.message || String(err);
    logger.error('AutoUpdater error:', errorMessage);
    
    // More detailed error dialog
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: 'An error occurred while updating the application.',
      detail: `Error details: ${errorMessage}\n\nPlease check your internet connection and try again later.`,
      buttons: ['OK']
    });
  });

  autoUpdater.on('checking-for-update', () => {
    logger.debug('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available.`,
      detail: 'The update will be downloaded in the background.',
      buttons: ['OK']
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    logger.debug('Download progress:', {
      percent: progressObj.percent,
      speed: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded:', info);
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded and will be installed on quit.`,
      detail: 'Would you like to install the update now?',
      buttons: ['Install and Restart', 'Later'],
      defaultId: 0,
      cancelId: 1
    }).then((buttonIndex) => {
      if (buttonIndex.response === 0) {
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
      }
    });
  });
}

export async function checkForUpdates(ghToken?: string) {
  try {
    // Set up auth headers if token is provided
    if (ghToken) {
      autoUpdater.requestHeaders = {
        'Authorization': `token ${ghToken}`
      };
    }

    logger.debug('Checking for updates...');
    const result = await autoUpdater.checkForUpdatesAndNotify({
      title: 'Update Available',
      body: 'A new version of Enzyme is available. Click to download.'
    });
    logger.debug('Update check result:', result);
  } catch (error) {
    logger.error('Error checking for updates:', error);
  }
} 