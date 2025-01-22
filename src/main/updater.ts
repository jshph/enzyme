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
      logger.debug("Setting up Github updater with authentication")
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'jshph',
        repo: 'enzyme',
        private: true,
        token: ghToken,
        releaseType: 'release'
      });
    }

    // Add configuration for update preferences
    autoUpdater.channel = 'latest';
    autoUpdater.allowPrerelease = false;
    // Specify which file format to look for
    autoUpdater.forceDevUpdateConfig = false;
    
    logger.info('Checking for update');
    const result = await autoUpdater.checkForUpdatesAndNotify({
      title: 'Update Available',
      body: 'A new version of Enzyme is available. Click to download.'
    });
    logger.debug('Update check result:', result);
    return result;
  } catch (error) {
    logger.error('Error:', error);
    throw error;
  }
} 