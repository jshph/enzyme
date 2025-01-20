import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';

export const RecipeExecutor = () => {
  const { isAuthenticated } = useAuth();

  const checkAndExecuteRecipes = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      // Get pending recipes
      const pendingRecipes = await window.electron.ipcRenderer.invoke('get-pending-recipes');
      
      // Execute each pending recipe
      for (const recipe of pendingRecipes) {
        await window.electron.ipcRenderer.invoke('execute-recipe', recipe.id);
      }
    } catch (error) {
      console.error('Error executing recipes:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Check immediately on mount if authenticated
    if (isAuthenticated) {
      checkAndExecuteRecipes();
    }

    // Set up interval to check every hour
    const interval = setInterval(checkAndExecuteRecipes, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, checkAndExecuteRecipes]);

  // This is a background component, so it doesn't render anything
  return null;
}; 