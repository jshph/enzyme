import React from 'react'
import Settings from './Settings'
import Spaces from './Spaces'
import Prompts from './Prompts'
import Login from './Login'

const Main: React.FC<{ currentView: string, isAuthenticated: boolean }> = ({ currentView, isAuthenticated }) => {
  return (
    <div className="flex-1 ml-64 min-h-screen overflow-y-auto">
      <div className="p-8">
        {currentView === 'settings' && <Settings />}
        {currentView === 'spaces' && isAuthenticated && <Spaces />}
        {currentView === 'prompts' && isAuthenticated && <Prompts />}
        {currentView === 'login' && <Login />}
      </div>
    </div>
  )
}

export default Main