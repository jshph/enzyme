import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  quitApp: () => Promise<void>;
  promptCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, quitApp, promptCount }) => {
  const { isAuthenticated, email, handleLogout, hiddenFeaturesEnabled } = useAuth();

  return (
    <div className="w-64 bg-surface shadow-lg fixed h-screen overflow-y-auto">
      <nav className="mt-12">

          {isAuthenticated && hiddenFeaturesEnabled && (
            <a onClick={() => setCurrentView('spaces')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input ${
                  currentView === 'spaces' ? 'bg-brand/10 text-brand' : 'text-primary'
                }`}>
                <span className="ml-2">Spaces</span>
            </a>
          )}

          {isAuthenticated && (
            <a onClick={() => setCurrentView('prompts')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input ${
                  currentView === 'prompts' ? 'bg-brand/10 text-brand' : 'text-primary'
                }`}>
                <span className="ml-2">Recipe Home</span>
            </a>
          )}
          
          <a onClick={() => setCurrentView('settings')} 
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input ${
                currentView === 'settings' ? 'bg-brand/10 text-brand' : 'text-primary'
              }`}
          >
              <span className="ml-2">Settings</span>
          </a>

          {isAuthenticated && hiddenFeaturesEnabled && (
            <a onClick={() => setCurrentView('playground')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input ${
                  currentView === 'playground' ? 'bg-brand/10 text-brand' : 'text-primary'
              }`}>
              <span className="ml-2">Playground</span>
            </a>
          )}

          {!isAuthenticated && (
            <a onClick={() => setCurrentView('login')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input ${
                  currentView === 'login' ? 'bg-brand/10 text-brand' : 'text-primary'
                }`}>
                <span className="ml-2">Login</span>
            </a>
          )}
          
          {isAuthenticated && (
            <a onClick={handleLogout} 
                className="flex items-center px-4 py-3 cursor-pointer hover:bg-input text-red">
                <span className="ml-2">Logout</span>
            </a>
          )}

          <a onClick={quitApp} 
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-input text-red">
              <span className="ml-2">Quit Enzyme</span>
          </a>
      </nav>

      {isAuthenticated && (
        <div className="p-4 border-t border-input mt-4">
            <div className="text-sm text-secondary">
                Logged in as:
                <div className="font-medium text-primary">{email}</div>
            </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;