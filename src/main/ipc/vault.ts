import { ipcMain } from "electron";
import { store, logger } from "./index";
import { getFileIndexer } from "../indexer/electron";
import { Settings } from "./user";

interface InitializeResult {
  success: boolean;
  error?: string;
  details?: string;
}

export interface Digest {
  text: string;
  files: string[];
}

const indexer = getFileIndexer();


export function setupVaultIPCRoutes() {
  ipcMain.handle('initialize-index', async (_, settings: Settings): Promise<InitializeResult> => {
    try {
      await indexer.stop();
      const localSettings = store.get('localSettings') || { vaultPath: '' };
      
      // Create a promise that rejects after 10 seconds
      const timeoutPromise = new Promise<InitializeResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Indexing timed out after 10 seconds'));
        }, 10000);
      });

      // Create the initialization promise
      const initPromise = indexer.initialize(
        localSettings.vaultPath,
        settings.includedPatterns || ['**/*.md'],
        settings.excludedPatterns || [],
        settings.excludedTags || [],
        false
      ).then(() => ({ success: true }));

      // Race between timeout and initialization
      const result = await Promise.race([initPromise, timeoutPromise]);
      return result;

    } catch (error) {
      logger.error('Error initializing index:', error);
      return {
        success: false,
        error: 'Failed to initialize vault',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  
  ipcMain.on('reindex-directory', async (_, settings: Settings) => {
    await indexer.stop();
    const localSettings = store.get('localSettings') || { vaultPath: '' };
    
    await indexer.initialize(
      localSettings.vaultPath,
      settings.includedPatterns || ['**/*.md'],
      settings.excludedPatterns || [],
      settings.excludedTags || [],
      false
    );
  });
  
  ipcMain.handle('trending-data-update', (event) => {
    return indexer.getTrendingItems();
  });
  
}