import React from "react";
import { useAuth } from '../../contexts/AuthContext';
import RecipeBuilder from "./recipes/RecipeBuilder";
import ScheduledRecipes from "./recipes/ScheduledRecipes";

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