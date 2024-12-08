import { FileIndexer } from "./index.js";
import { BrowserWindow, Notification } from 'electron';

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
    new Notification({ title, body }).show();
  }
}

let instance: ElectronFileIndexer | null = null;

export function getFileIndexer(): ElectronFileIndexer {
  if (!instance) {
    instance = new ElectronFileIndexer();
  }
  return instance;
}