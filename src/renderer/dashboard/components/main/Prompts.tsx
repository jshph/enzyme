import React, { useState } from "react";

const Prompts: React.FC = () => {
  const [editingPrompt, setEditingPrompt] = useState({ id: null, name: '', prompt: '' });
  const [userPrompts, setUserPrompts] = useState([]);

  const resetPromptForm = () => {
    setEditingPrompt({ id: null, name: '', prompt: '' });
  };

  const savePrompt = () => {
    // Logic to save the prompt
  };

  const editPrompt = (prompt) => {
    setEditingPrompt(prompt);
  };

  const deletePrompt = (id) => {
    // Logic to delete the prompt
  };

  return (
    <>
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-gray-800">Prompts</h2>
        
        {/* Create/Edit Prompt Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          <h3 className="text-xl font-semibold text-gray-800">{editingPrompt.id ? 'Edit Custom Prompt' : 'Create Custom Prompt'}</h3>
          <p className="text-sm text-gray-500 mt-2">You can use your saved prompts directly from the menubar, in addition to the preset options available.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input 
              type="text" 
              value={editingPrompt.name} 
              onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })} 
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Prompt</label>
            <div 
              data-prompt-editor
              className="prose prose-sm max-w-none min-h-[200px] p-4 rounded-md border border-gray-300 bg-gray-700"
            >
              {/* Logic for prompt editor goes here */}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Enter a prompt to digest your content. Mentioning a <span className="font-mono text-slate-300">#tag</span> or <span className="font-mono text-slate-300">[[entity]]</span> will query their latest mentions to digest. You can specify a <span className="text-amber-200">count limit</span> like so: <span className="font-mono"><span className="text-slate-300">#tag</span><span className="text-amber-200">&lt;30</span></span>. By default, the 5 latest mentions are retrieved.
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button onClick={resetPromptForm} className="px-4 py-2 border rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={savePrompt} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Save
            </button>
          </div>
        </div>
        
        {/* Prompt List */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Your Prompts</h3>
          
          <div className="grid grid-cols-1 gap-4">
            {userPrompts.map((prompt) => (
              <div key={prompt.id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{prompt.name}</h4>
                    <p className="text-sm text-gray-500">{prompt.prompt}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => editPrompt(prompt)} className="text-blue-600 hover:text-blue-800">
                      Edit
                    </button>
                    <button onClick={() => deletePrompt(prompt.id)} className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Prompts;