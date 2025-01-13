import React from 'react'
import Settings from './Settings'
import Spaces from './Spaces'
import Recipes from './Recipes'
import Login from './Login'
import Playground from './Playground'
import { useAuth } from '@renderer/dashboard/contexts/AuthContext'

interface MainProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

const Main: React.FC<MainProps> = ({ currentView, setCurrentView }) => {

  // const hiddenFeatures = hiddenFeaturesEnabled ? (
  //   <>
  //     <div style={{ display: currentView === 'spaces' ? 'block' : 'none' }}>
  //       <Spaces currentView={currentView} />
  //     </div>
  //     <div style={{ display: currentView === 'playground' ? 'block' : 'none' }}>
  //       <Playground />
  //     </div>
  //   </>
  // ) : null;

  return (
    <div className="flex-1 ml-64 min-h-screen overflow-y-auto bg-surface/70">
      <div className="p-8 rounded-lg h-screen">
        <div style={{ display: currentView === 'settings' ? 'block' : 'none' }}>
          <Settings />
        </div>

        <div style={{ display: currentView === 'recipes' ? 'block' : 'none' }}>
          <Recipes currentView={currentView} />
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