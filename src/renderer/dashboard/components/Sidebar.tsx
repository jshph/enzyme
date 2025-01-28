import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Info } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  quitApp: () => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, quitApp }) => {
  const { isAuthenticated, email, handleLogout } = useAuth();

  return (
    <div className="w-64 bg-surface shadow-lg fixed h-screen draggable">
      <nav className="mt-12 overflow-y-auto no-drag">
          <a onClick={() => setCurrentView('recipes')} 
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input text-sm ${
                currentView === 'recipes' ? 'bg-brand/10 text-brand' : 'text-primary'
              }`}>
              <span className="ml-2">Recipe Home</span>
          </a>

          <a onClick={() => setCurrentView('settings')} 
              className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input text-sm ${
                currentView === 'settings' ? 'bg-brand/10 text-brand' : 'text-primary'
              }`}
          >
              <span className="ml-2">Settings</span>
          </a>

          {!isAuthenticated && (
            <a onClick={() => setCurrentView('login')} 
                className={`flex items-center px-4 py-3 cursor-pointer hover:bg-input text-sm ${
                  currentView === 'login' ? 'bg-brand/10 text-brand' : 'text-primary'
                }`}>
                <span className="ml-2">Login</span>
            </a>
          )}
          
          {isAuthenticated && (
            <a onClick={handleLogout} 
                className="flex items-center px-4 py-3 cursor-pointer hover:bg-input text-red text-sm">
                <span className="ml-2">Logout</span>
            </a>
          )}

          <a onClick={quitApp} 
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-input text-red text-sm">
              <span className="ml-2">Quit Enzyme</span>
          </a>
      </nav>

      {isAuthenticated && (
        <div className="absolute bottom-[64px] left-0 w-full p-4 border-t border-input bg-surface no-drag">
            <div className="text-sm text-secondary/70">
                Logged in as:
                <div className="font-medium text-primary/70">{email}</div>
            </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 w-full p-4 border-t border-input bg-surface no-drag">
          <a href="https://enzyme.garden/support" 
             target="_blank" 
             rel="noopener noreferrer"
             className="font-medium flex items-center text-sm cursor-pointer group no-drag">
            <Info className="h-5 w-5 inline-block text-brand/90 group-hover:text-primary transition-colors duration-50" />
            <span className="ml-2 inline-block text-brand/90 group-hover:text-primary transition-colors duration-50">Get support</span>
          </a>
      </div>
    </div>
  );
}

export default Sidebar;