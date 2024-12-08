import React, { useState } from 'react';

const Settings: React.FC = () => {
  const [settingsTab, setSettingsTab] = useState('vault');
  const [vaultPath, setVaultPath] = useState('');
  const [port, setPort] = useState(8080); // Default port
  const [includedPatterns, setIncludedPatterns] = useState('');
  const [excludedPatterns, setExcludedPatterns] = useState('');
  const [excludedTags, setExcludedTags] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [saveState, setSaveState] = useState(''); // 'saving', 'saved', 'error', etc.
  const hasVaultInitialized = false; // Replace with actual logic

  const browseVaultDirectory = () => {
    // Implement browse functionality
  };

  const saveSettings = () => {
    // Implement save functionality
  };

  return (
    <>
      <h2 className="text-3xl font-bold text-gray-800">Enzyme Settings</h2>

      {/* Settings Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button onClick={() => setSettingsTab('vault')}
                  className={`py-4 px-1 text-sm font-medium ${settingsTab === 'vault' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}>
            Vault Configuration
          </button>
        </nav>
      </div>

      {/* Vault Configuration Tab */}
      {settingsTab === 'vault' && (
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-blue-800">
              Set up your markdown vault settings here. This vault is where Enzyme will analyze your knowledge. 
              You can choose an existing directory for your vault, or if you don't have one yet, a new vault will be created for you. (<a className="text-blue-300 hover:text-blue-400" href="https://obsidian.md" target="_blank" rel="noopener noreferrer">Obsidian</a> is a great way to work with your vault.)
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Markdown Vault Location</label>
              <div className="mt-1 flex">
                <input type="text" value={vaultPath} 
                      className="flex-1 rounded-l-md border border-gray-300 px-3 py-2" readOnly />
                <button onClick={browseVaultDirectory} 
                        className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700">
                  Browse
                </button>
              </div>
              {!hasVaultInitialized && vaultPath && (
                <div className="mt-2 flex items-center text-sm text-gray-600">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Initializing vault...
                </div>
              )}
              <p className="mt-2 text-sm text-gray-500">Select the root folder for your markdown vault</p>
            </div>

            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    The vault path is stored locally on this machine. If you use Enzyme on multiple computers, you'll need to set the vault path on each one.
                  </p>
                  <p className="mt-2 text-sm text-yellow-700">
                    Note: You may need to grant permission in System Preferences &gt; Security &amp; Privacy &gt; Files and Folders for Enzyme to access your vault folder.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Server Port</label>
              <input type="number" value={port} 
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              <p className="mt-2 text-sm text-gray-500">
                The port number Enzyme will use. Only change this if you have port conflicts.
                Server URL: <span>{`http://localhost:${port}`}</span>
              </p>
            </div>

            <div className={`space-y-6 border-t pt-6 mt-6 ${!isAuthenticated ? 'opacity-50' : ''}`}>
              <h3 className="text-lg font-medium text-gray-900">Advanced Settings <span>{isAuthenticated ? '' : '(login to configure)'}</span></h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Files to Include</label>
                <textarea value={includedPatterns}
                          onChange={(e) => setIncludedPatterns(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" 
                          disabled={!isAuthenticated}>
                </textarea>
                <p className="text-gray-500 text-sm">Example: *.md to include all markdown files</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Files to Exclude</label>
                <textarea value={excludedPatterns}
                          onChange={(e) => setExcludedPatterns(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" 
                          disabled={!isAuthenticated}>
                </textarea>
                <p className="text-gray-500 text-sm">Example: private/*, templates/* to exclude private and template folders</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tags to Exclude</label>
                <textarea value={excludedTags}
                          onChange={(e) => setExcludedTags(e.target.value)}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" 
                          disabled={!isAuthenticated}>
                </textarea>
                <p className="text-gray-500 text-sm">Tags to ignore when analyzing your vault (comma-separated)</p>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button onClick={saveSettings} 
                      className={`bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors duration-200 ${!isAuthenticated || !hasChanges() || saveState === 'saving' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={!isAuthenticated || !hasChanges() || saveState === 'saving'}>
                <span>
                  {!isAuthenticated ? 'Please login to save settings' :
                    !hasChanges() ? 'No changes to save' :
                    saveState === 'saving' ? 'Saving...' : 
                    saveState === 'saved' ? 'Saved!' :
                    saveState === 'error' ? 'Error!' :
                    'Save Settings'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Settings;