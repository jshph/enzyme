import React from "react";

import PromptBuilder from "./recipes/PromptBuilder";
import ScheduledRecipes from "./recipes/ScheduledRecipes";

const Recipes: React.FC<{ currentView: string }> = ({ currentView }) => {

  return (
    <div className="space-y-6">
      <PromptBuilder currentView={currentView} />

      {/* Prompt List */}
      <ScheduledRecipes currentView={currentView} />
      
    </div>
  );
}

export default Recipes;