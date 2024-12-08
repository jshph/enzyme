import { ipcMain } from "electron";
import { getServerUrl, store } from "./index";
import { getFileIndexer } from "../indexer/electron";
import { getCurrentSession } from './user';

const SERVER_URL = getServerUrl();

export interface SpaceInfo {
  id: string;
  name: string;
  destinationFolder: string;
  enabledTags: string[];
  pendingSubmissions: number;
}

// Helper to get/set space mappings from store
function getSpaces(): SpaceInfo[] {
  return store.get('spaces') || [];
}

function setSpaces(mappings: SpaceInfo[]) {
  store.set('spaces', mappings);
}

// Add this function to clear space mappings
function clearSpaces() {
  store.delete('spaces');
}

export function setupSpaceRoutes() {
  const fileIndexer = getFileIndexer();

  // Add handler to clear spaces
  ipcMain.handle('clear-spaces', async () => {
    clearSpaces();
    return { success: true };
  });

  ipcMain.handle('create-space', async (event, spaceData) => {
    try {
      const auth = store.get('auth');
      const token = await getCurrentSession();
      if (!auth?.email || !token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/space/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...spaceData, email: auth.email })
      });
      const result = await responseon();
      
      if (result.success) {
        // Update local mappings
        const mappings = getSpaces();
        mappings.push({
          id: result.space.id,
          name: result.space.name,
          destinationFolder: spaceData.destinationFolder,
          enabledTags: spaceData.enabledTags,
          pendingSubmissions: 0
        });
        setSpaces(mappings);
      }

      return result;
    } catch (error) {
      console.error('Error creating space:', error);
      throw error;
    }
  });

  ipcMain.handle('submit-to-space', async (event, { spaceName, submission }) => {
    try {
      const token = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const mappings = getSpaces();
      const spaceInfo = mappings[spaceName];
      
      if (!spaceInfo) {
        throw new Error(`Space "${spaceName}" not found in local mappings`);
      }

      const response = await fetch(`${SERVER_URL}/space/${spaceInfo.id}/submit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ submission })
      });
      return await response.json();
    } catch (error) {
      console.error('Error submitting to space:', error);
      throw error;
    }
  });

  ipcMain.handle('fetch-spaces', async (event) => {
    try {
      const auth = store.get('auth');
      const token = await getCurrentSession();
      if (!auth?.email || !token) {
        throw new Error('Not authenticated');
      }

      // Get spaces from server and fallback to local store

      let spaces = getSpaces();
      try {      
        // If no spaces, fetch all spaces
        const response = await fetch(`${SERVER_URL}/space/fetch/${auth.email}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
        });
        
        const data = await response.json();
        spaces = data.spaces;
      } catch (error) {
        console.error(`Error fetching spaces; falling back to local store: ${error}`);
      }

      // Fetch latest data for each space
      const response = await fetch(`${SERVER_URL}/space/fetch-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ spaceIds: spaces.map(s => s.id) })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      // Update pending submissions for each space
      for (const space of data.spaces) {
        // Lookup space by id
        const spaceInfo = spaces.find(s => s.id === space.id);
        if (spaceInfo) {
          spaceInfo.pendingSubmissions = space.pendingSubmissions;
        }
      }

      // Update local store with latest data
      setSpaces(spaces);
      
      return { success: true, spaces };
    } catch (error) {
      console.error('Error fetching spaces:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('fetch-space-submissions', async (event, spaceId) => {
    try {
      const token = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const mappings = getSpaces();
      const spaceInfo = mappings.find(s => s.id === spaceId);
      
      if (!spaceInfo) {
        throw new Error(`Space "${spaceId}" not found in local mappings`);
      }

      const response = await fetch(
        `${SERVER_URL}/space/${spaceInfo.id}/submissions`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();

      if (data.success && data.submissions) {
        // Process each submission and create markdown files
        for (const submission of data.submissions) {
          try {
            await fileIndexer.createSpaceSubmission(spaceInfo.destinationFolder, submission);
          } catch (error) {
            console.error('Error creating submission file:', error);
          }
        }
      }

      return data;
    } catch (error) {
      console.error('Error fetching space submissions:', error);
      throw error;
    }
  });

  ipcMain.handle('search-vault-tags', async (event, query?: string) => {
    try {
      const allTags = fileIndexer.getTags();
      
      if (!query) {
        // Return trending tags when no query
        const trendingItems = fileIndexer.getTrendingItems();
        const trendingTags = trendingItems.tags.slice(0, 10).map(tag => tag.name.replace(/^#/, ''));
        return { tags: trendingTags };
      }

      // Return prefix matches when there's a query
      const matchingTags = Array.from(allTags).filter(tag => 
        tag.toLowerCase().startsWith(query.toLowerCase())
      ).slice(0, 10); // Limit to top 10 matches
      
      return { tags: matchingTags };
    } catch (error) {
      console.error('Error searching tags:', error);
      throw error;
    }
  });

  ipcMain.handle('delete-space', async (event, spaceId) => {
    try {
      const token = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/space/${spaceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();

      if (result.success) {
        // Remove from local store
        const spaces = getSpaces();
        setSpaces(spaces.filter(s => s.id !== spaceId));
      }

      return result;
    } catch (error) {
      console.error('Error deleting space:', error);
      throw error;
    }
  });

  ipcMain.handle('edit-space', async (event, { spaceId, updates }) => {
    try {
      const token = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/space/${spaceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const result = await response.json();

      if (result.success) {
        // Update local store
        const spaces = getSpaces();
        const spaceIndex = spaces.findIndex(s => s.id === spaceId);
        if (spaceIndex !== -1) {
          spaces[spaceIndex] = {
            ...spaces[spaceIndex],
            ...updates
          };
          setSpaces(spaces);
        }
      }

      return result;
    } catch (error) {
      console.error('Error editing space:', error);
      throw error;
    }
  });

  ipcMain.handle('refresh-space', async (event, spaceId) => {
    try {
      const token = await getCurrentSession();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_URL}/space/${spaceId}/refresh`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await response.json();

      if (result.success) {
        // Update local store
        const spaces = getSpaces();
        const spaceIndex = spaces.findIndex(s => s.id === spaceId);
        if (spaceIndex !== -1) {
          spaces[spaceIndex] = {
            ...spaces[spaceIndex],
            pendingSubmissions: result.space.pendingSubmissions
          };
          setSpaces(spaces);
        }
      }

      return result;
    } catch (error) {
      console.error('Error refreshing space:', error);
      throw error;
    }
  });
}