import React from "react";
import { useAuth } from '../../contexts/AuthContext.js';
import RecipeBuilder from "./recipes/RecipeBuilder.js";
import ScheduledRecipes from "./recipes/ScheduledRecipes.js";

const Recipes: React.FC<{ currentView: string }> = ({ currentView }) => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-6">
      <RecipeBuilder currentView={currentView} />

      {/* Only show scheduled recipes for authenticated users */}
      {isAuthenticated && <ScheduledRecipes currentView={currentView} />}
    </div>
  );
}

export default Recipes;