import React from "react";

import RecipeBuilder from "./recipes/RecipeBuilder";
import ScheduledRecipes from "./recipes/ScheduledRecipes";

const Recipes: React.FC<{ currentView: string }> = ({ currentView }) => {

  return (
    <div className="space-y-6">
      <RecipeBuilder currentView={currentView} />

      {/* Prompt List */}
      <ScheduledRecipes currentView={currentView} />
      
    </div>
  );
}

export default Recipes;