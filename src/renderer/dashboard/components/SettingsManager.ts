export default class SettingsManager {
  original = {};
  current = {};
  arrayFields = ['includedPatterns', 'excludedPatterns', 'excludedTags'];
  
  constructor(initialSettings = {}) {
    this.original = this.processSettings(initialSettings);
    this.current = this.processSettings(initialSettings);
  }

  // Convert arrays to newline-delimited strings for display
  processSettings(settings) {
    const processed = { ...settings };
    this.arrayFields.forEach(field => {
      if (Array.isArray(processed[field])) {
        processed[field] = processed[field].join('\n');
      }
    });
    return processed;
  }

  // Convert strings back to arrays for saving
  prepareForSave() {
    const prepared = { ...this.current };
    this.arrayFields.forEach(field => {
      if (typeof prepared[field] === 'string') {
        prepared[field] = prepared[field].split('\n').filter(Boolean);
      }
    });
    
    // Remove vaultPath from server settings
    const { vaultPath, ...serverSettings } = prepared;
    return serverSettings;
  }

  // Update a setting value
  set(key, value) {
    this.current[key] = value;
  }

  // Get a setting value
  get(key) {
    return this.current[key];
  }

  // Get all current settings
  getAll() {
    return { ...this.current };
  }

  // Get settings ready for saving
  getSavePayload() {
    return this.prepareForSave();
  }

  // Check if settings have changed
  hasChanges() {
    return JSON.stringify(this.current) !== JSON.stringify(this.original);
  }

  // Reset settings to last saved state
  reset() {
    this.current = { ...this.original };
  }

  // Update original settings after successful save
  commitChanges() {
    this.original = { ...this.current };
  }

  // Add method to get local settings
  getLocalSettings() {
    return {
      vaultPath: this.current.vaultPath || ''
    };
  }

  async saveSettings() {
    // Save local settings first
    await ipcRenderer.invoke('update-local-settings', this.getLocalSettings());
    
    // Then save server settings
    return await ipcRenderer.invoke('update-settings', this.prepareForSave());
  }
}