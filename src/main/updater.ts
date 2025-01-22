import { autoUpdater } from 'electron-updater';
import { dialog } from 'electron';
import { logger } from './ipc/index.js';

export function setupIpcUpdater() {
  logger.debug('Setting up auto-updater');

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    logger.error('AutoUpdater error:', err);
  });

  autoUpdater.on('checking-for-update', () => {
    logger.debug('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available:', info);
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
      message: `Version ${info.version} has been downloaded and will be installed on quit. Install now?`,
      buttons: ['Install and Restart', 'Later']
    }).then((buttonIndex) => {
      if (buttonIndex.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // Check for updates immediately
  try {
    autoUpdater.checkForUpdatesAndNotify({
      title: 'Update Available',
      body: 'A new version of Enzyme is available. Click to download.'
    });
  } catch (error) {
    logger.error('Error checking for updates:', error);
  }

  // Check for updates every hour
  setInterval(() => {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (error) {
      logger.error('Error in periodic update check:', error);
    }
  }, 60 * 60 * 1000);
} 