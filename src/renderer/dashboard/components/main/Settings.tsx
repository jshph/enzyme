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
  } = useSettingsContext();

  const { isAuthenticated } = useAuth();

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

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

  const handleCollectDebugLogs = async () => {
    try {
      setMessage('Collecting debug logs...');
      setError(false);
      
      const debugInfo = await window.electron.ipcRenderer.invoke('collect-debug-logs');
      
      // Format the debug info as text
      const formattedDebugInfo = JSON.stringify(debugInfo, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([formattedDebugInfo], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enzyme-debug-logs-${new Date().toISOString()}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage('Debug logs collected and downloaded successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(true);
      setMessage('Failed to collect debug logs. Please try again.');
      console.error('Error collecting debug logs:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {message && (
        <div className={`mt-4 p-4 rounded-md ${
          error ? 'bg-red/5 text-red/80' : 'bg-brand/5 text-brand/100'
        }`}>
          <p>{message}</p>
        </div>
      )}
      {/* Vault Configuration Tab */}
      <div className="space-y-6">
        <div className="bg-brand/5 p-4 rounded-lg">
          <p className="text-brand/80 text-sm">
              Set up your markdown vault settings here. This vault becomes your playground in Enzyme.
              You can choose an existing directory for your vault, or if you don't have one yet, a new vault will be created for you. (
              <a className="text-blue-300 hover:text-blue-400" href="https://obsidian.md" target="_blank" rel="noopener noreferrer">
                Obsidian
              </a> is a great way to work with your vault.)
            </p>
          </div>

          <div className="card space-y-4 bg-surface/50 p-8 rounded-sm">
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

      <div className="card space-y-4 bg-surface/50 p-8 rounded-sm">
        <h3 className="text-lg font-medium text-primary/90">Troubleshooting</h3>
        <div className="space-y-4">
          <div>
            <button
              onClick={handleCollectDebugLogs}
              className="bg-brand/80 text-primary/90 px-4 py-2 rounded-md hover:bg-brand/90 transition-colors duration-200"
            >
              Download Debug Logs
            </button>
            <p className="mt-2 text-sm text-secondary/70">
              Download debug logs to help troubleshoot issues. These logs contain technical information about the app's operation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;