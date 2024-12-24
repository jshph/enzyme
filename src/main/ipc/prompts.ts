import { ipcMain } from 'electron';
import { getFileIndexer } from '../indexer/electron';
import { getServerUrl, store } from './index';
import { getCurrentSession } from './user';

const indexer = getFileIndexer();

const SERVER_URL = getServerUrl();

export function setupPromptRoutes() {
  ipcMain.handle('get-prompts', async () => {
    try {
      const { token } = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/prompts/get`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error('Error fetching prompts:', error);
      throw error;
    }
  });

  ipcMain.handle('search-vault-items', async (_, query: string) => {
    const allTags = indexer.getTags();
    const allLinks = indexer.getLinks();

    if (!query) {
      return { success: true, items: [] };
    }

    // Find matches for tags or links
    if (query.startsWith('#')) {
      const tagQuery = query.slice(1);
      if (tagQuery.length === 0) {
        return { success: true, items: [] };
      }

      const matches = Array.from(allTags).filter(tag => tag.toLowerCase().startsWith(tagQuery.toLowerCase())).map(tag => ({
        type: 'tag',
        name: tag
      }));
      return { success: true, items: matches };
    } else if (query.startsWith('[[')) {
      const linkQuery = query.slice(2);
      if (linkQuery.length === 0) {
        return { success: true, items: [] };
      }

      const matches = Array.from(allLinks).filter(link => link.toLowerCase().startsWith(linkQuery.toLowerCase())).map(link => ({
        type: 'link',
        name: link
      }));

      return { success: true, items: matches };
    } else {
      return { success: true, items: [] };
    }
  });

  ipcMain.handle('create-prompt', async (_, { prompt, created_at, reminder_date }) => {
    try {
      const { token, email } = await getCurrentSession();
      if (!email || !token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/prompts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, email: auth.email, created_at, reminder_date })
      });
      return await response.json();
    } catch (error) {
      console.error('Error creating prompt:', error);
      throw error;
    }
  });

  ipcMain.handle('update-prompt', async (_, { id, prompt, name, reminder_date }) => {
    try {
      const { token } = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/prompts/update/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, name, reminder_date })
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating prompt:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-prompt', async (_, id) => {
    try {
      const { token } = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/prompts/delete/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      throw error;
    }
  });
}

