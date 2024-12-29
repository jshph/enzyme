import { ipcMain } from "electron";
import { getServerUrl, logger } from "./index";
import { getCurrentSession } from "./user";
import { useContextServer } from "../server";
import { getFileIndexer } from "../indexer/electron";

const SERVER_URL = getServerUrl();
const contextServer = useContextServer();

export function setupRecipeRoutes() {
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

  ipcMain.handle('create-recipe', async (event, { frequency, startDate, entities, recipe }) => {
    try {
      const { token } = await getCurrentSession();
      
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
          recipe // Contains question and segments structure
        })
      });

      return response.json();
    } catch (error) {
      logger.error('Failed to create recipe:', error);
      throw error;
    }
  });

  ipcMain.handle('execute-recipe', async (event, recipeId: string) => {
    try {
      const { token } = await getCurrentSession();
      
      // Get the recipe schedule
      const scheduleResponse = await fetch(`${SERVER_URL}/recipe_schedules/get/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const { schedule } = await scheduleResponse.json();

      // Get context for the recipe's entities
      const query = schedule.entities.map(entity => entity.name).join(' ');
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