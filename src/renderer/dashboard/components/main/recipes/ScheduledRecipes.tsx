import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

interface Recipe {
  id: string;
  recipe: {
    question: string;
    segments: any[];
  };
  next_run: string;
  frequency: 'weekly' | 'monthly';
  email: string;
}

const ScheduledRecipes: React.FC<{ currentView: string }> = ({ currentView }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [deletingInProgress, setDeletingInProgress] = useState<string | null>(null);

  const updateNextRun = async (recipeId: string, date: Date | null) => {
    try {
      await window.electron.ipcRenderer.invoke('update-recipe', {
        id: recipeId,
        next_run: date?.toISOString() || null
      });
      // Refresh recipes list after save
      await fetchRecipes();
    } catch (error) {
      console.error('Error updating next run:', error);
    }
  };

  const executeNow = async (recipeId: string) => {
    try {
      await window.electron.ipcRenderer.invoke('execute-recipe', recipeId);
      await fetchRecipes();
    } catch (error) {
      console.error('Error executing recipe:', error);
    }
  };

  const fetchRecipes = async () => {
    const { success, schedules, error } = await window.electron.ipcRenderer.invoke('get-all-recipes');
    if (success) {
      setRecipes(schedules.sort((a, b) => 
        new Date(a.next_run).getTime() - new Date(b.next_run).getTime()
      ));
    } else {
      console.error('Error fetching recipes:', error);
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      setDeletingInProgress(id);
      const result = await window.electron.ipcRenderer.invoke('delete-recipe', id);
      if (result.success) {
        await fetchRecipes();
      }
      setDeletingInProgress(null);
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  };

  useEffect(() => {
    if (currentView === 'recipes') {
      fetchRecipes();
    }
  }, [currentView]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-primary/90">Scheduled Recipes</h3>
      
      <div className="grid grid-cols-1 gap-4">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="bg-surface/50 p-4 rounded-sm shadow-card transition-opacity duration-300" style={{ opacity: deletingInProgress === recipe.id ? 0.5 : 1 }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-secondary/70 max-w-xl">
                  {recipe.recipe.question}
                </p>
                <div className="text-xs text-brand mt-2">
                  <div>
                    📅 Next Run: 
                    <DatePicker
                      selected={recipe.next_run ? new Date(recipe.next_run) : null}
                      onChange={(date) => updateNextRun(recipe.id, date)}
                      showTimeSelect
                      dateFormat="MMMM d, yyyy h:mm aa"
                      className="inline rounded-md input-base bg-input/50 ml-2 p-2 text-xs"
                      placeholderText="Select next run date"
                      isClearable
                      customInput={
                        <input 
                          className="rounded-md input-base bg-input/50 p-2 text-xs text-brand cursor-pointer"
                        />
                      }
                    />
                  </div>
                  <div className="mt-1">
                    🔄 Frequency: {recipe.frequency}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => executeNow(recipe.id)} 
                  className="text-brand text-sm mr-2 hover:text-brand/80"
                >
                  Run
                </button>
                <button 
                  onClick={() => deleteRecipe(recipe.id)} 
                  className="text-red text-sm mr-2 hover:text-red/80"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduledRecipes;