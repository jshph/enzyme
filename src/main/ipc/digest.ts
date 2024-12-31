import { Notification, ipcMain } from "electron";
import { getServerUrl, store, logger } from "./index";
import { getCurrentSession } from "./user";
import { QueryPattern, MatchType, extractPatterns, MatchResult } from '../extract/index';
import { getFileIndexer } from "../indexer/electron";
import { useContextServer } from "../server";
import { shell } from "electron";
import path from 'path';

interface DigestUsage {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}

const indexer = getFileIndexer();
const SERVER_URL = getServerUrl();
const contextServer = useContextServer();

export async function getDigestUsage(): Promise<DigestUsage | null> {
  try {
    const { email, token } = await getCurrentSession();
    const response = await fetch(`${SERVER_URL}/digest/usage?email=${encodeURIComponent(email)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch digest usage');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching digest usage:', error);
    return null;
  }
}


export function setupDigestIPCRoutes() {
  ipcMain.handle('get-prompt-templates', async () => {
    try {
      const { token } = await getCurrentSession();
      
      const response = await fetch(`${SERVER_URL}/digest/prompt-templates`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch prompt templates');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      // Return default templates as fallback
      return [
        { id: 'questions', label: 'Reflection Questions' },
        { id: 'actions', label: 'Followup Actions' },
        { id: 'themes', label: 'Key Themes' }
      ];
    }
  });


  ipcMain.handle('get-context', async (event: any, query: string) => {
    const context: MatchResult[] = await contextServer.getContext(query, 'json') as MatchResult[];
    return context;
  });

  ipcMain.handle('analyze-vault', async (event: any, templateId: string | null, userPrompt: string | null) => {
    // Verify session
    const { token } = await getCurrentSession();
    const response = await fetch(`${SERVER_URL}/auth/verify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!data.isAuthenticated) {
      new Notification({
        title: 'Digest Error',
        body: 'Try checking your login status in the dashboard.'
      }).show();
      return null;
    }


    try {
      // Check usage limits first
      const usage = await getDigestUsage();
      if (usage) {
        if (usage.remaining <= 0) {
          new Notification({
            title: 'Weekly Limit Reached',
            body: `You've reached your limit of ${usage.limit} digests per week. Resets on ${new Date(usage.resetDate).toLocaleDateString()}.`
          }).show();
          return { error: 'limit_reached', usage };
        } else if (usage.remaining <= 2) {
          // Add notification for low remaining digests
          new Notification({
            title: 'Running Low on Digests',
            body: `You have ${usage.remaining} digest${usage.remaining === 1 ? '' : 's'} remaining this week. Limit resets on ${new Date(usage.resetDate).toLocaleDateString()}.`
          }).show();
        }
      }

      const vaultTrendingData = await indexer.getTrendingItems();
      const auth = store.get('auth');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
  
      if (auth) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      }
  
      const patterns: QueryPattern[] = [
        ...vaultTrendingData.tags.map(tag => ({ 
          type: MatchType.Tag, 
          value: tag.name, 
          modifier: '<5' 
        })),
        ...vaultTrendingData.links.map(link => ({ 
          type: MatchType.MarkdownLink, 
          value: link.name, 
          modifier: '<5' 
        }))
      ];
  
      let vaultContents = await extractPatterns(patterns);
      const localSettings = store.get('localSettings') || { vaultPath: '' };
      
      // TODO maybe get patterns from prompt if they exist, otherwise get top trending

      vaultContents = await Promise.all(vaultContents.map(async (content) => {
        return {
          ...content,
          file: content.file.replace(localSettings.vaultPath, '').replace(/^\//, '')
        };
      }));

      logger.debug(`Analyzing ${vaultContents.length} vault contents`);

      const url = auth 
        ? `${SERVER_URL}/digest/generate?email=${encodeURIComponent(auth.email)}`
        : `${SERVER_URL}/digest/generate`;

      if (vaultContents.length === 0) {
        new Notification({
          title: 'Error',
          body: 'Couldn\'t load any content to analyze.'
        }).show();
        return null;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth?.token && { 'Authorization': `Bearer ${auth.token}` })
        },
        body: JSON.stringify({
          vaultContents,
          templateId,
          userPrompt
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        new Notification({
          title: error.error || 'Error',
          body: error.message || 'Failed to get digest from server'
        }).show();
        return null;
      }
  
      const digests = await response.json();
      if (!digests || digests.length === 0) {
        new Notification({
          title: 'No Results',
          body: 'No insights could be generated from the current content.'
        }).show();
        return null;
      }

      return digests;
  
    } catch (error) {
      logger.error('Error analyzing vault:', error);
      new Notification({
        title: 'Error',
        body: 'Failed to get digest from server'
      }).show();
      return null;
    }
  });

  ipcMain.handle('open-in-obsidian', async (event: any, filePath: string) => {
    try {
      const localSettings = store.get('localSettings') || { vaultPath: '' };
      const fullPath = path.join(localSettings.vaultPath, filePath);
      
      // Using Obsidian URI protocol to open the file
      const encodedPath = encodeURIComponent(fullPath);
      const obsidianUri = `obsidian://open?path=${encodedPath}`;
      
      // Open the URI using the system's default handler
      shell.openExternal(obsidianUri);
    } catch (error) {
      console.error('Error opening file in Obsidian:', error);
    }
  });

  ipcMain.handle('generate-suggested-output', async (event, { context, query, profileId }) => {
    try {
      const { token } = await getCurrentSession();
      
      const response = await fetch(`${SERVER_URL}/digest/generate-suggested`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context, query, profileId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggested output');
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to generate suggested output:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}