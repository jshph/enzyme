import React from 'react'
import Settings from './Settings.js'
import Recipes from './Recipes.js'
import Login from './Login.js'

interface MainProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isVaultInitialized?: boolean;
}

const Main: React.FC<MainProps> = ({ currentView, setCurrentView, isVaultInitialized }) => {
  return (
    <div className="flex-1 ml-64 min-h-screen overflow-y-auto bg-surface/70">
      <div className="p-8 rounded-lg h-screen">
        <div style={{ display: currentView === 'settings' ? 'block' : 'none' }}>
          <Settings />
        </div>

        <div style={{ display: currentView === 'recipes' ? 'block' : 'none' }}>
          <Recipes currentView={currentView} setCurrentView={setCurrentView} />
        </div>
        
        {/* {hiddenFeatures} */}
        <div style={{ display: currentView === 'login' ? 'block' : 'none' }}>
          <Login setCurrentView={setCurrentView}/>
        </div>
      </div>
    </div>
  )
}

export default Main