import { ipcMain } from "electron";
import { getServerUrl, logger } from "./index";
import { getCurrentSession } from "./user";
import { useContextServer } from "../server";
import { getFileIndexer } from "../indexer/electron";
import Store from 'electron-store';

const SERVER_URL = getServerUrl();
const contextServer = useContextServer();
const store = new Store();
const MAX_UNAUTHENTICATED_EXECUTIONS = 2;

// Initialize counter if not exists
if (!store.has('unauthenticatedExecutions')) {
  store.set('unauthenticatedExecutions', 0);
}

export function setupRecipeRoutes() {
  ipcMain.handle('get-profiles', async () => {
    try {
      const response = await fetch(`${SERVER_URL}/recipe_schedules/profiles`);
      const { profiles } = await response.json();
      return profiles;
    } catch (error) {
      logger.error('Failed to get profiles:', error);
      return [];
    }
  });

  ipcMain.handle('get-pending-recipes', async () => {
    try {
      const { token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const { schedules } = await response.json();
      return schedules;
    } catch (error) {
      logger.error('Failed to get pending recipes:', error);
      return [];
    }
  });

  ipcMain.handle('delete-recipe', async (event, id: string) => {
    try {
      const { token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.json();
    } catch (error) {
      logger.error('Failed to delete recipe:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('create-recipe', async (event, { frequency, startDate, entities, recipe, profile }) => {
    try {
      const { token } = await getCurrentSession();
      
      // Only allow creation if authenticated
      if (!token) {
        return { success: false, error: 'Authentication required to save recipes' };
      }

      const response = await fetch(`${SERVER_URL}/recipe_schedules/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          frequency,
          next_run: startDate,
          entities,
          recipe,
          profile
        })
      });

      return response.json();
    } catch (error) {
      logger.error('Failed to create recipe:', error);
      throw error;
    }
  });

  ipcMain.handle('check-recipe-execution-allowed', async () => {
    try {
      const { token } = await getCurrentSession();
      if (token) return { allowed: true };

      const count = store.get('unauthenticatedExecutions', 0) as number;
      return { 
        allowed: count < MAX_UNAUTHENTICATED_EXECUTIONS,
        remainingExecutions: MAX_UNAUTHENTICATED_EXECUTIONS - count
      };
    } catch (error) {
      return { allowed: false, error: 'Failed to check execution limits' };
    }
  });

  ipcMain.handle('execute-recipe', async (event, recipeId: string) => {
    try {
      const { token } = await getCurrentSession();
      
      if (!token) {
        const count = store.get('unauthenticatedExecutions', 0) as number;
        if (count >= MAX_UNAUTHENTICATED_EXECUTIONS) {
          return { 
            success: false, 
            error: 'Free execution limit reached. Please log in to continue.' 
          };
        }
        store.set('unauthenticatedExecutions', count + 1);
      }

      // Get the recipe schedule
      const scheduleResponse = await fetch(`${SERVER_URL}/recipe_schedules/get/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { schedule } = await scheduleResponse.json();

      // Get context for the recipe's entities
      const query = schedule.entities
      const context = await contextServer.getContext(query, 'json');

      // Execute the recipe with context
      const response = await fetch(`${SERVER_URL}/recipe_schedules/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipeId,
          context
        })
      });

      return response.json();
    } catch (error) {
      logger.error('Failed to execute recipe:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('email-recipe-output', async (event, suggestedOutputs) => {
    try {
      const { token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/email-recipe-output`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suggestedOutputs })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to email recipe output:', error);
      throw error; // Let the renderer handle the error
    }
  });

  ipcMain.handle('get-all-recipes', async () => {
    try {
      const { token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { schedules } = await response.json();
      return { success: true, schedules: schedules || [] };
    } catch (error) {
      logger.error('Error fetching recipes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('update-recipe', async (_, { id, next_run }) => {
    try {
      const { token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/update/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ next_run })
      });
      return await response.json();
    } catch (error) {
      logger.error('Error updating recipe:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('get-entity-timeline', async (_, entities) => {
    const indexer = getFileIndexer();
    const timeline = indexer.getEntityTimeline(entities);
    return timeline;
  });
} 