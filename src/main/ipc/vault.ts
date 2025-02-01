import { ipcMain } from "electron";
import { store, logger } from "./index.js";
import { getFileIndexer } from "../indexer/electron.js";
import { Settings } from "./user.js";
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';

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

interface TrendingDataWithTimeline {
  tags: { name: string; count: number; timeline: TimelineItem[] }[];
  links: { name: string; count: number; timeline: TimelineItem[] }[];
}

interface TimelineItem {
  date: Date;
  type: 'tag' | 'link';
  name: string;
}

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
  
  ipcMain.handle('trending-data-update', (_) => {
    const indexer = getFileIndexer();
    const { items: trendingItems, timeline } = indexer.getTrendingData();
    
    // Format the data for the frontend
    const enrichedData = {
      tags: trendingItems.tags.map(tag => ({
        ...tag,
        timeline: timeline.tags.get(tag.name) || []
      })),
      links: trendingItems.links.map(link => ({
        ...link,
        timeline: timeline.links.get(link.name) || []
      }))
    };

    return enrichedData;
  });

  ipcMain.handle('query-for-links-and-tags', (_, query: string) => {
    return indexer.queryForTagsAndLinks(query)
  });

  // Update the check-indexer-status handler to be simpler
  ipcMain.handle('check-indexer-status', async () => {
    const indexer = getFileIndexer();
    return {
      ready: !indexer.isIndexing,
      isIndexing: indexer.isIndexing
    };
  });

  ipcMain.handle('collect-debug-logs', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const logsPath = path.join(userDataPath, 'logs');
      
      // Read all files in the logs directory
      const files = await fs.readdir(logsPath);
      const logContents: { [filename: string]: string } = {};
      
      // Collect contents of each log file
      for (const file of files) {
        if (file.endsWith('.log')) {
          const content = await fs.readFile(path.join(logsPath, file), 'utf-8');
          logContents[file] = content;
        }
      }

      // Get app version and other relevant info
      const appInfo = {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
      };

      // Format the debug information
      const debugInfo = {
        timestamp: new Date().toISOString(),
        appInfo,
        logs: logContents,
      };

      return debugInfo;

    } catch (error) {
      logger.error('Error collecting debug logs:', error);
      throw new Error('Failed to collect debug logs');
    }
  });
}
