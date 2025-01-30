import { ipcMain } from "electron";
import { getServerUrl, store, logger } from "./index.js";
import { getCurrentSession } from "./user.js";
import { MatchResult } from '../extract/index.js';
import { useContextServer } from "../server.js";
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
    const { email, access_token } = await getCurrentSession();
    const response = await fetch(`${SERVER_URL}/digest/usage?email=${encodeURIComponent(email)}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(access_token && { 'Authorization': `Bearer ${access_token}` })
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
    
    // Check for empty context
    if (context.length === 0) {
      throw new Error('No context found');
    }

    return context;
    
  });

  ipcMain.handle('open-in-obsidian', async (event: any, filePath: string) => {
    try {
      const localSettings = store.get('localSettings') || { vaultPath: '' };
      const relativePath = filePath.split(localSettings.vaultPath!)[1].split(path.sep).slice(1).join(path.sep);
      
      // Using Obsidian URI protocol to open the file
      const encodedPath = encodeURIComponent(relativePath);
      const obsidianUri = `obsidian://open?file=${encodedPath}`;
      
      // Open the URI using the system's default handler
      shell.openExternal(obsidianUri);
    } catch (error) {
      console.error('Error opening file in Obsidian:', error);
    }
  });
}