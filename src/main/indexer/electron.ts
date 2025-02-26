import { FileIndexer } from "./index.js";
import { BrowserWindow, Notification, app } from 'electron';

export class ElectronFileIndexer extends FileIndexer {
  constructor() {
    super();
  }

  override async emit(event: string, data: any) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      window.webContents.send(event, data);
    });
  }

  override async notify(title: string, body: string) {
    // Only create notification if app is ready
    if (app.isReady()) {
      new Notification({ title, body }).show();
    } else {
      // Log the notification instead
      console.log(`Notification (app not ready): ${title} - ${body}`);
      // Optionally queue the notification to show when app is ready
      app.whenReady().then(() => {
        new Notification({ title, body }).show();
      });
    }
  }
}

let instance: ElectronFileIndexer | null = null;

export function getFileIndexer(): ElectronFileIndexer {
  if (!instance) {
    instance = new ElectronFileIndexer();
  }
  return instance;
}