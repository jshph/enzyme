import { ipcMain } from "electron";
import { getServerUrl, store as configStore, logger } from "./index";
import { getCurrentSession } from "./user";
import { useContextServer } from "../server";
import { getFileIndexer } from "../indexer/electron";
import Store from 'electron-store';

const SERVER_URL = getServerUrl();
const contextServer = useContextServer();
const generationStore = new Store();
const MAX_UNAUTHENTICATED_GENERATIONS = 2; // Per day
const UNAUTHENTICATED_STORE_KEY = 'unauthenticatedGenerations';

// Initialize store with date tracking
if (!generationStore.has(UNAUTHENTICATED_STORE_KEY)) {
  generationStore.set(UNAUTHENTICATED_STORE_KEY, {
    count: 0,
    lastResetDate: new Date().toDateString()
  });
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
      const { access_token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/pending`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
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
      const { access_token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/delete/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${access_token}`
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
      const { access_token } = await getCurrentSession();
      
      // Only allow creation if authenticated
      if (!access_token) {
        return { success: false, error: 'Authentication required to save recipes' };
      }

      const response = await fetch(`${SERVER_URL}/recipe_schedules/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
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

  ipcMain.handle('check-generation-limits', async () => {
    try {
      const { access_token, email } = await getCurrentSession();
      
      // If authenticated, check weekly server-side limit
      if (access_token) {
        const response = await fetch(`${SERVER_URL}/digest/usage?email=${encodeURIComponent(email)}`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });
        const data = await response.json();
        return {
          allowed: data.remaining > 0,
          remaining: Math.max(0, data.remaining),
          authenticated: true
        };
      }

      // If not authenticated, check local daily limit
      const stored = generationStore.get(UNAUTHENTICATED_STORE_KEY) as {
        count: number;
        lastResetDate: string;
      };

      // Reset count if it's a new day
      const today = new Date().toDateString();
      if (stored.lastResetDate !== today) {
        generationStore.set(UNAUTHENTICATED_STORE_KEY, {
          count: 0,
          lastResetDate: today
        });
        return {
          allowed: true,
          remaining: MAX_UNAUTHENTICATED_GENERATIONS,
          authenticated: false
        };
      }

      const remaining = Math.max(0, MAX_UNAUTHENTICATED_GENERATIONS - stored.count);
      return {
        allowed: remaining > 0,
        remaining,
        authenticated: false
      };
    } catch (error) {
      logger.error('Failed to check generation limits:', error);
      return { allowed: false, remaining: 0, authenticated: false };
    }
  });

  ipcMain.handle('generate-suggested-output', async (event, { context, query, profileId, signal }) => {
    let abortController: AbortController | null = null;
    
    try {
      const { access_token } = await getCurrentSession();
      
      // Handle unauthenticated state
      if (!access_token) {
        const stored = generationStore.get(UNAUTHENTICATED_STORE_KEY) as {
          count: number;
          lastResetDate: string;
        };

        // Check if we need to reset for new day
        const today = new Date().toDateString();
        if (stored.lastResetDate !== today) {
          generationStore.set(UNAUTHENTICATED_STORE_KEY, {
            count: 1, // Start at 1 since we're generating now
            lastResetDate: today
          });
        } else {
          // Only increment count for unauthenticated users
          generationStore.set(UNAUTHENTICATED_STORE_KEY, {
            ...stored,
            count: stored.count + 1
          });
        }

        // Check if we've hit the limit
        const updatedStored = generationStore.get(UNAUTHENTICATED_STORE_KEY) as {
          count: number;
        };
        
        if (updatedStored.count > MAX_UNAUTHENTICATED_GENERATIONS) {
          return { 
            success: false, 
            error: 'Daily generation limit reached',
            remaining: 0
          };
        }
      }

      // Create AbortController for the fetch
      abortController = new AbortController();

      // Add signal listener
      if (signal) {
        signal.onabort = () => {
          logger.debug('Generation aborted by client');
          abortController?.abort();
          event.sender.send('suggested-output-chunk', { 
            error: 'Generation aborted by client', 
            done: true 
          });
        };
      }

      const response = await fetch(`${SERVER_URL}/digest/generate-suggested`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context, query, profileId }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      // Process the stream line by line
      const textDecoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (signal?.aborted || abortController.signal.aborted) {
          logger.debug('Aborting generation stream');
          reader.cancel();
          event.sender.send('suggested-output-chunk', { 
            error: 'Generation cancelled', 
            done: true 
          });
          break;
        }

        const { done: streamDone, value } = await reader.read();
        
        if (streamDone) {
          // Process any remaining buffer immediately
          if (buffer.trim()) {
            try {
              const chunk = JSON.parse(buffer);
              event.sender.send('suggested-output-chunk', { 
                chunk, 
                done: false 
              });
            } catch (e) {
              logger.error('Error parsing final chunk:', e);
            }
          }
          // Send done signal immediately
          event.sender.send('suggested-output-chunk', { chunk: null, done: true });
          break;
        }

        // Process incoming chunks immediately
        buffer += textDecoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              // Check if this is a done signal from the server
              if (chunk.done) {
                event.sender.send('suggested-output-chunk', { 
                  chunk: null, 
                  done: true 
                });
                continue;
              }
              event.sender.send('suggested-output-chunk', { 
                chunk, 
                done: false 
              });
            } catch (error) {
              logger.error('Error parsing chunk:', error);
              continue;
            }
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Generation error:', error);
      
      // Type guard the error before accessing name property
      if (error instanceof Error && error.name === 'AbortError') {
        event.sender.send('suggested-output-chunk', { 
          error: 'Generation cancelled', 
          done: true 
        });
        return { 
          success: false, 
          error: 'Generation cancelled'
        };
      }

      // Ensure we always send a done signal with any error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      event.sender.send('suggested-output-chunk', { 
        error: errorMessage, 
        done: true  // Make sure done:true is sent with errors
      });

      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      abortController = null;
    }
  });

  ipcMain.handle('execute-recipe', async (event, recipeId: string) => {
    try {
      const { access_token } = await getCurrentSession();
      // Get the recipe schedule
      const scheduleResponse = await fetch(`${SERVER_URL}/recipe_schedules/get/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
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
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipeId,
          context
        })
      });

      const result = await response.json();
      
      // Pass through the remaining executions count
      return {
        ...result,
        remaining: result.remaining
      };
    } catch (error) {
      logger.error('Failed to execute recipe:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('email-recipe-output', async (event, suggestedOutputs) => {
    try {
      const { access_token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/email-recipe-output`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
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
      const { access_token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/all`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
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
      const { access_token } = await getCurrentSession();
      const response = await fetch(`${SERVER_URL}/recipe_schedules/update/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${access_token}`,
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