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

// Add this function to check if MCP is configured in Claude Desktop
async function checkMcpStatus() {
  try {
    const claudeDesktopPath = path.join(app.getPath('home'), 'Library/Application Support/Claude/claude_desktop_config.json');
    const configStr = await fs.readFile(claudeDesktopPath, 'utf-8');
    const config = JSON.parse(configStr);
    
    // Check if enzyme MCP server is configured
    return {
      enabled: !!config.mcpServers?.enzyme,
      error: null
    };
  } catch (error) {
    logger.error('Error checking MCP status:', error);
    return {
      enabled: false,
      error: error instanceof Error ? error.message : 'Failed to check MCP status'
    };
  }
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
      ).then(() => {
        // Get initial trending data after initialization
        const trendingData = indexer.getTrendingData();

        // Format the data for the frontend
        const enrichedData = {
          tags: trendingData.items.tags.map(tag => ({
            ...tag,
            timeline: trendingData.timeline.tags.get(tag.name) || []
          })),
          links: trendingData.items.links.map(link => ({
            ...link,
            timeline: trendingData.timeline.links.get(link.name) || []
          }))
        };
        
        return { 
          success: true,
          trendingData: enrichedData // Include trending data in initialization response
        };
      });

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

  ipcMain.handle('trigger-trending-data-update', (_) => {
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
  })

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
  ipcMain.handle('configure-claude-mcp', async () => {
    try {
      // Check if npx is installed by trying to run npx --version
      try {
        await new Promise((resolve, reject) => {
          const npxCheck = require('child_process').exec('npx --version');
          npxCheck.on('exit', code => {
            if (code !== 0) reject(new Error('npx not found'));
            resolve(null);
          });
        });
      } catch (err) {
        logger.error('npx is not installed:', err);
        throw new Error('npx is not installed. Please install Node.js which includes npx.');
      }

      // Claude Desktop path from Application Support
      const claudeDesktopPath = path.join(app.getPath('home'), 'Library/Application Support/Claude/claude_desktop_config.json');
      const configStr = await fs.readFile(claudeDesktopPath, 'utf-8');
      const config = JSON.parse(configStr);

      // Add enzyme MCP server config if not already present
      if (!config.mcpServers?.enzyme) {
        config.mcpServers = {
          ...config.mcpServers,
          enzyme: {
            command: 'npx',
            args: ['-y', 'enzyme-mcp@1.1.3']
          }
        };
      }

      await fs.writeFile(claudeDesktopPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      logger.error('Error configuring Claude MCP:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to write configuration file');
    }
  });

  ipcMain.handle('check-mcp-status', async () => {
    return checkMcpStatus();
  });
}
