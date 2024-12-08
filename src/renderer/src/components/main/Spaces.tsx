import React, { useState } from 'react';

const Spaces: React.FC = () => {
  const [newSpace, setNewSpace] = useState({ name: '', destinationFolder: '', enabledTags: [] });
  const [editingSpace, setEditingSpace] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [spaces, setSpaces] = useState([]);
  const isAuthenticated = true; // Replace with actual authentication logic
  const currentView = 'spaces'; // Replace with actual view logic
  const settingsManager = { get: (key) => '/path/to/vault' }; // Replace with actual settings manager
  const enzymeBaseUrl = 'http://example.com'; // Replace with actual base URL

  const updateDestinationFolder = (value) => {
    setNewSpace((prev) => ({ ...prev, destinationFolder: value }));
  };

  const handleDestinationFolderInput = (event) => {
    // Handle input logic
  };

  const searchTags = () => {
    // Search tags logic
  };

  const addCurrentTag = () => {
    // Add tag logic
  };

  const removeTag = (tag) => {
    setNewSpace((prev) => ({
      ...prev,
      enabledTags: prev.enabledTags.filter((t) => t !== tag),
    }));
  };

  const resetSpaceForm = () => {
    setNewSpace({ name: '', destinationFolder: '', enabledTags: [] });
    setEditingSpace(false);
  };

  const saveSpace = () => {
    // Save space logic
  };

  const editSpace = (space) => {
    setNewSpace(space);
    setEditingSpace(true);
  };

  const deleteSpace = (id) => {
    // Delete space logic
  };

  const copySpaceUrl = (id) => {
    // Copy URL logic
  };

  const refreshSpace = (id) => {
    // Refresh space logic
  };

  const fetchSubmissions = (id) => {
    // Fetch submissions logic
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Spaces</h2>
        
        {/* Create/Edit Space Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">{editingSpace ? 'Edit Space' : 'Create New Space'}</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Space Name</label>
            <input type="text" 
                    value={newSpace.name} 
                    onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                    onInput={(e) => updateDestinationFolder(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Destination Folder</label>
            <div className="destination-folder-input mt-1">
              <span className="destination-folder-prefix">{settingsManager.get('vaultPath') + '/enzyme-spaces/'}</span>
              <input type="text" 
                      value={newSpace.destinationFolder}
                      onChange={(e) => setNewSpace({ ...newSpace, destinationFolder: e.target.value })}
                      placeholder={generateFolderName(newSpace.name)} />
            </div>
            <p className="mt-1 text-sm text-gray-500">Location where submissions will be saved</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Enabled Tags</label>
            <div className="mt-1 flex flex-wrap gap-2 p-2 min-h-[42px] rounded-md border border-gray-300 bg-gray-700">
              {/* Selected tag pills */}
              {newSpace.enabledTags.map((tag) => (
                <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200">
                    <span className="sr-only">Remove tag</span>
                    ×
                  </button>
                </span>
              ))}
              
              {/* Tag input */}
              <div className="tag-input-container">
                <input type="text" 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onInput={searchTags}
                        placeholder="Add tags..." />
              </div>
            </div>
            
            {/* Tag suggestions dropdown */}
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <div className="absolute mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                <div className="p-2 text-xs text-gray-400">
                  <span>{!tagInput ? 'Trending tags:' : 'Matching tags:'}</span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {tagSuggestions.map((tag, index) => (
                    <div key={tag} onClick={() => selectTag(tag)} className="px-3 py-2 cursor-pointer hover:bg-gray-600">
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button onClick={resetSpaceForm} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancel</button>
            <button onClick={saveSpace} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
          </div>
        </div>
        
        {/* Existing Spaces */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {spaces.map((space) => (
            <div key={space.id} className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-800">{space.name}</h3>
                <div className="flex space-x-2">
                  <button onClick={() => editSpace(space)} className="p-2 hover:bg-gray-600 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => deleteSpace(space.id)} className="p-2 hover:bg-gray-600 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 mt-2">
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-mono">{`${settingsManager.get('vaultPath')}/enzyme-spaces/${space.destinationFolder}`}</span>
                </span>
              </p>
              
              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-2">
                {space.enabledTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">{tag}</span>
                ))}
              </div>
              
              {/* Share URL with copy button */}
              <div className="mt-4 flex items-center gap-2">
                <input type="text" 
                        readOnly 
                        value={`${enzymeBaseUrl}/space/${space.id}`}
                        className="flex-1 rounded-l-md border border-gray-300 px-3 py-2 bg-gray-50" />
                <button onClick={() => copySpaceUrl(space.id)} className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition-colors">Copy</button>
              </div>
              
              {/* Submission count and actions */}
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-600">{`${space.pendingSubmissions || 0} pending submissions`}</span>
                <div className="flex items-center space-x-2">
                  <button onClick={() => refreshSpace(space.id)} className="p-2 hover:bg-gray-600 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button onClick={() => fetchSubmissions(space.id)} className="p-2 hover:bg-gray-600 rounded-full transition-colors" disabled={space.isDownloading || !space.pendingSubmissions}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${space.pendingSubmissions ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default Spaces;