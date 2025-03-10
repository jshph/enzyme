import { ipcMain } from "electron";
import {  store, logger } from "./index.js";
import { getCurrentSession } from "./user.js";
import { getServerUrl, useContextServer } from "../server.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import { MatchResult } from "../extract/index.js";

const SERVER_URL = getServerUrl();
const contextServer = useContextServer();

export interface TagSummary {
  tag: string;
  summary: string;
}

export function setupTagSummaryIPCRoutes() {
  // Add a server status check handler
  ipcMain.handle('check-server-status', async () => {
    logger.info('Checking server status');
    try {
      // Get the server instance ID to verify it's a singleton
      const serverInstanceId = contextServer.getInstanceId ? contextServer.getInstanceId() : 'unknown';
      logger.info(`Server instance ID: ${serverInstanceId}`);
      
      // Check if the server is running
      const isRunning = contextServer.isRunning ? contextServer.isRunning() : false;
      logger.info(`Server is running: ${isRunning}`);
      
      return {
        success: true,
        instanceId: serverInstanceId,
        isRunning,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error checking server status:', error);
      return {
        success: false,
        error: 'Failed to check server status'
      };
    }
  });

  // Generate summaries for top tags
  ipcMain.handle('generate-top-tag-summaries', async (event, limit) => {
    logger.info(`Starting tag summary generation with limit: ${limit}`);
    try {
      // Get current session
      const { email, access_token } = await getCurrentSession();
      logger.debug(`User session retrieved: ${email ? 'authenticated' : 'unauthenticated'}`);
      
      // Get trending tags
      logger.debug('Fetching trending entities...');
      const trendingTags = await contextServer.getTrendingEntities({limitPerType: limit, type: 'tags'});
      logger.debug(`Retrieved ${trendingTags.length} trending entities`);

      logger.info(`Selected ${trendingTags.length} trending tags: ${trendingTags.join(', ')}`);
      
      if (trendingTags.length === 0) {
        logger.warn('No trending tags found, returning empty summaries');
        return { success: true, summaries: [] };
      }
      
      // Get context for each tag
      logger.debug('Fetching contexts for each tag...');
      const contexts: {tag: string, contexts: string[]}[] = [];
      for (const tag of trendingTags) {
        try {
          logger.debug(`Fetching context for tag: #${tag}`);
          const context = await contextServer.getContext(`#${tag}`, 'json') as MatchResult[];
          logger.debug(`Retrieved ${context.length} context items for tag #${tag}`);
          contexts.push({tag, contexts: context.map(c => c.extractedContents.join('\n'))});
        } catch (error) {
          logger.error(`Error getting context for tag #${tag}:`, error);
          contexts.push({tag, contexts: []}); // Push empty context if error
        }
      }
      
      // Send request to server to generate summaries
      logger.info(`Sending request to server to generate summaries for ${trendingTags.length} tags`);
      const response = await fetch(`${SERVER_URL}/tag-summary/generate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(access_token && { 'Authorization': `Bearer ${access_token}` })
        },
        body: JSON.stringify({
          tagsContexts: contexts,
          userId: email
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Server responded with error ${response.status}: ${errorText}`);
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      logger.info(`Successfully generated ${result.summaries?.length || 0} tag summaries`);
      
      // Store the full summaries in the local settings
      const localSettings = store.get('localSettings') || {};
      if (localSettings && localSettings.vaultPath) {
        logger.debug(`Storing ${result.summaries?.length || 0} summaries in local settings`);
        // Store the complete summaries, not just references
        localSettings.tagSummaries = result.summaries;
        store.set('localSettings', localSettings);
        
        // Load, update, and write to .enzyme.conf
        logger.debug(`Writing tag summaries to .enzyme.conf at ${localSettings.vaultPath}`);
        const config = await readConfigFile(localSettings.vaultPath);
        config.tagSummaries = result.summaries;
        await writeConfigFile(localSettings.vaultPath, config);
        logger.info('Successfully saved tag summaries to .enzyme.conf');
      } else {
        logger.warn('Could not save tag summaries: vault path not set');
      }
      
      return result;
    } catch (error) {
      logger.error('Error generating top tag summaries:', error);
      throw error;
    }
  });
  
  // Get tag summaries from local .enzyme.conf file only
  ipcMain.handle('get-tag-summaries', async () => {
    logger.info('Fetching tag summaries from local storage');
    try {
      const localSettings = store.get('localSettings') || {};
      if (!localSettings || !localSettings.vaultPath) {
        logger.warn('Vault path not set, cannot fetch tag summaries');
        return { success: false, error: 'Vault path not set' };
      }
      
      // Read from .enzyme.conf file
      logger.debug(`Reading .enzyme.conf from ${localSettings.vaultPath}`);
      const config = await readConfigFile(localSettings.vaultPath);
      const tagSummaries = config.tagSummaries || [];
      
      logger.info(`Retrieved ${tagSummaries.length} tag summaries from local storage`);
      if (tagSummaries.length > 0) {
        logger.debug(`Tags found: ${tagSummaries.map((s: TagSummary) => s.tag).join(', ')}`);
      }
      
      return { 
        success: true, 
        summaries: tagSummaries
      };
    } catch (error) {
      logger.error('Error fetching tag summaries:', error);
      throw error;
    }
  });
}

// Helper function to write config file
async function writeConfigFile(vaultPath: string, settings: any) {
  try {
    const configPath = path.join(vaultPath, '.enzyme.conf');
    logger.debug(`Writing config file to ${configPath}`);
    await fs.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');
    logger.debug('Config file written successfully');
  } catch (error) {
    logger.error(`Error writing config file to ${vaultPath}/.enzyme.conf:`, error);
    throw error;
  }
}

// Helper function to read config file
async function readConfigFile(vaultPath: string): Promise<any> {
  try {
    const configPath = path.join(vaultPath, '.enzyme.conf');
    logger.debug(`Reading config file from ${configPath}`);
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    logger.debug('Config file read successfully');
    return config;
  } catch (error) {
    // If file doesn't exist or is invalid, return empty object
    logger.error(`Error reading config file from ${vaultPath}/.enzyme.conf:`, error);
    return {};
  }
} 