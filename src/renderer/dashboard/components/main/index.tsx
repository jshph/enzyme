import React from 'react'
import Settings from './Settings'
import Spaces from './Spaces'
import Prompts from './Prompts'
import Login from './Login'

interface MainProps {
  currentView: string;
  init: () => Promise<void>;
  setCurrentView: (view: string) => void;
}

const Main: React.FC<MainProps> = ({ currentView, init, setCurrentView }) => {
  return (
    <div className="flex-1 ml-64 min-h-screen overflow-y-auto">
      <div className="p-8">
        {currentView === 'settings' && <Settings />}
        {currentView === 'spaces' && <Spaces />}
        {currentView === 'prompts' && <Prompts />}
        {currentView === 'login' && <Login init={init} setCurrentView={setCurrentView}/>}
      </div>
    </div>
  )
}

export default Main