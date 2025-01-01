import { ipcMain } from "electron";
import { getServerUrl, store, logger } from "./index";
import { getCurrentSession } from "./user";
import { MatchResult } from '../extract/index';
import { useContextServer } from "../server";
import { shell } from "electron";
import path from 'path';

interface DigestUsage {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
}

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
  ipcMain.handle('get-context', async (event: any, query: string) => {
    const context: MatchResult[] = await contextServer.getContext(query, 'json') as MatchResult[];
    return context;
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