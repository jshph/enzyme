import { ipcMain } from 'electron';
import { store } from './index.js';

export function setupChatIPCRoutes() {
  // Get the last used Ollama model
  ipcMain.handle('get-last-used-model', () => {
    const lastUsedModel = store.get('chatSettings.lastUsedModel');
    return lastUsedModel || null;
  });

  // Save the last used Ollama model
  ipcMain.handle('save-last-used-model', (_, model: string) => {
    store.set('chatSettings.lastUsedModel', model);
    return true;
  });
} 