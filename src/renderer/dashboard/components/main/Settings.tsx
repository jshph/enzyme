import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useSettingsContext } from '../../contexts/SettingsContext.js';
const Settings: React.FC = () => {
  const { 
    settings,
    updateSetting, 
    hasChanges, 
    saveSettings,
    processArrayField,
    initializeVault,
    hasVaultInitialized
  } = useSettingsContext();

  const { isAuthenticated } = useAuth();

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const { verifySession } = useAuth();

  const browseVaultDirectory = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('select-directory');
      if (result) {
        updateSetting('vaultPath', result);
        
        try {
          setError(false);

          // Initialize vault
          await initializeVault();
          await verifySession();

          setError(false);
          
          setTimeout(() => {
            if (!error) {
              setMessage('');
            }
          }, 3000);
          
        } catch (err: any) {
          setMessage(err.message);
          if (err.message?.includes('access')) {
            setMessage('Permission denied. Please grant access to the selected folder in System Preferences > Security & Privacy > Files and Folders.');
          } else if (err.message?.includes('timeout')) {
            setMessage('Indexing timed out. Please try selecting a folder with fewer files or check system resources.');
          } else if (err.message?.includes('No markdown files')) {
            setMessage('No markdown files found in the selected directory. Please select your markdown vault folder.');
          } else if (err.message?.includes('Too many files')) {
            setMessage('Too many files in the selected directory. Please select a more specific folder.');
          }
          setError(true);
          updateSetting('vaultPath', '');
        }
      }
    } catch (err) {
      setMessage('Failed to select directory. Please try again.');
      setError(true);
      console.error('Error selecting directory:', err);
    }
  };

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await saveSettings();
      setSaveState('saved');
      setMessage('Settings saved successfully');
      setError(false);
      
      setTimeout(() => {
        if (saveState === 'saved') {
          setSaveState('idle');
        }
      }, 2000);
    } catch (err) {
      setSaveState('error');
      setMessage('Failed to save settings');
      setError(true);
      console.error('Error saving settings:', err);
      
      setTimeout(() => {
        if (saveState === 'error') {
          setSaveState('idle');
        }
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {message && (
        <div className={`mt-4 p-4 rounded-md ${
          error ? 'bg-red/5 text-red/80' : 'bg-brand/5 text-brand/80'
        }`}>
          <p>{message}</p>
        </div>
      )}
      {/* Vault Configuration Tab */}
      <div className="space-y-6">
        <div className="bg-brand/5 p-4 rounded-lg">
          <p className="text-brand/80 text-sm">
              Set up your markdown vault settings here. This vault is where Enzyme will analyze your knowledge. 
              You can choose an existing directory for your vault, or if you don't have one yet, a new vault will be created for you. (
              <a className="text-blue-300 hover:text-blue-400" href="https://obsidian.md" target="_blank" rel="noopener noreferrer">
                Obsidian
              </a> is a great way to work with your vault.)
            </p>
          </div>

          <div className="card space-y-4 bg-surface/50 p-8 rounded-sm">
            <div>
              <label className="block text-sm font-medium text-primary/80">Markdown Vault Location</label>
              <div className="mt-4 flex">
                <input 
                  type="text" 
                  value={settings.vaultPath || ''} 
                  className="flex-1 rounded-l-md input-base bg-input/50 p-4 text-sm" 
                  readOnly 
                />
                <button 
                  onClick={browseVaultDirectory} 
                  className="bg-brand/80 text-primary/90 px-4 py-2 rounded-r-md hover:bg-brand/90 text-sm"
                >
                  Browse
                </button>
              </div>
              <p className="mt-2 text-sm text-secondary/70">Select the root folder for your markdown vault</p>
              {!hasVaultInitialized && settings.vaultPath && (
                <div className="mt-4 flex items-center text-sm text-gray-600">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initializing vault...
                </div>
              )}
            </div>

            <div className="mt-4 bg-brand/5 border-l-4 border-brand/10 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-brand/60" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-secondary/80">
                  The vault path is stored locally on this machine. If you use Enzyme on multiple computers, you'll need to set the vault path on each one.
                  </p>
                  <p className="mt-2 text-sm text-secondary/40">
                    Note: You may need to grant permission in System Preferences &gt; Security & Privacy &gt; Files and Folders for Enzyme to access your vault folder.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary/80">Server Port</label>
              <input 
                type="number" 
                value={settings.port || 3779}
                onChange={(e) => updateSetting('port', Number(e.target.value))}
                className="mt-1 block w-full p-2 rounded-md input-base bg-input/50 text-sm" 
              />
              <p className="mt-2 text-sm text-secondary/70">
              The port number Enzyme will use. Only change this if you have port conflicts.
              Server URL: <span>{`http://localhost:${settings.port || 3779}`}</span>
              </p>
            </div>

            <div className={`space-y-6 border-t border-input/30 pt-6 mt-6 ${isAuthenticated ? '' : 'opacity-50'}`}>
              <h3 className="text-lg font-medium text-primary/90">
                Advanced Settings 
                <span className="text-secondary/70">{isAuthenticated ? '' : ' (login to configure)'}</span>
              </h3>
            
            <div>
              <label className="block text-sm font-medium text-primary/80">Files to Include</label>
              <textarea 
                value={processArrayField(settings.includedPatterns || [])}
                onChange={(e) => updateSetting('includedPatterns', e.target.value)}
                className="mt-1 block w-full rounded-md border border-input/50 px-3 py-2 bg-input/20 text-sm"
                disabled={!isAuthenticated}
              />
              <p className="text-secondary/70 text-sm">Example: *.md to include all markdown files</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-primary/80">Files to Exclude</label>
              <textarea 
                value={processArrayField(settings.excludedPatterns || [])}
                onChange={(e) => updateSetting('excludedPatterns', e.target.value)}
                className="mt-1 block w-full rounded-md border border-input/50 px-3 py-2 bg-input/20 text-sm"
                disabled={!isAuthenticated}
              />
              <p className="text-secondary/70 text-sm">Example: private/*, templates/* to exclude private and template folders</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary/80">Tags to Exclude</label>
              <textarea 
                value={processArrayField(settings.excludedTags || [])}
                onChange={(e) => updateSetting('excludedTags', e.target.value)}
                className="mt-1 block w-full rounded-md border border-input/50 px-3 py-2 bg-input/50 text-sm"
                disabled={!isAuthenticated}
              />
              <p className="text-secondary/70 text-sm">Tags to ignore when analyzing your vault (comma-separated)</p>
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button 
              onClick={handleSave}
              className={`bg-brand/80 text-primary/90 px-4 py-2 rounded-md hover:bg-brand/90 transition-colors duration-200 ${
                !hasChanges() || saveState === 'saving' ? 'opacity-30 cursor-not-allowed' : ''
              }`}
              disabled={!hasChanges() || saveState === 'saving'}
            >
              <span>
                {!hasChanges() ? 'No changes to save' :
                saveState === 'saving' ? 'Saving...' : 
                saveState === 'saved' ? 'Saved!' :
                saveState === 'error' ? 'Error!' :
                'Save Settings'}
              </span>
            </button>
          </div>
          </div>
      </div>
    </div>
  );
}

export default Settings;