import React, { useState, useEffect } from "react";
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import PromptBuilder from "../PromptBuilder";


interface Prompt {
  id: string;
  prompt: string;
  name: string;
  created_at: string;
  reminder_date: string;
}

const Prompts: React.FC<{ currentView: string, setPromptCount: (count: number) => void }> = ({ currentView, setPromptCount }) => {

  const [userPrompts, setUserPrompts] = useState<Prompt[]>([]);
  
  const fetchPrompts = async () => {
    const result = await window.electron.ipcRenderer.invoke('get-prompts');
    if (result.success) {
      setUserPrompts(result.prompts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }
    setPromptCount(result.prompts.length);
  };

  const deletePrompt = async (id) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('delete-prompt', id);
      if (result.success) {
        await fetchPrompts();
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  };

  useEffect(() => {
    if (currentView === 'prompts') {
      fetchPrompts();
    }
  }, [currentView]);

  const updateReminder = async (promptId, date) => {
    try {
      const promptToUpdate = userPrompts.find(p => p.id === promptId);
      if (!promptToUpdate) return;

      await window.electron.ipcRenderer.invoke('update-prompt', {
        id: promptId,
        prompt: promptToUpdate.prompt,
        name: promptToUpdate.name,
        reminder_date: date?.toISOString() || null
      });
      // Refresh prompts list after save
      await fetchPrompts();
    } catch (error) {
      console.error('Error updating reminder:', error);
    }
  };

  return (
    <div className="space-y-6">
      <PromptBuilder currentView={currentView} />

      {/* Prompt List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-primary/90">Prompts</h3>
        
        <div className="grid grid-cols-1 gap-4">
          {userPrompts.map((prompt) => (
            <div key={prompt.id} className="bg-surface/50 p-4 rounded-sm shadow-card">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-secondary/70 max-w-xl">{prompt.prompt}</p>
                  <div 
                      className="text-xs text-brand mt-2 cursor-pointer hover:text-brand/80"
                    >
                      {prompt.reminder_date ? (
                        <div>
                          📅 Scheduled for: <span className="mt-2">
                            <DatePicker
                            selected={prompt.reminder_date ? new Date(prompt.reminder_date) : null}
                            onChange={(date) => updateReminder(prompt.id, date)}
                            showTimeSelect
                            dateFormat="MMMM d, yyyy h:mm aa"
                            className="block w-full mr-12 rounded-md input-base bg-input/50 p-2 text-xs"
                            placeholderText="Select a date and time"
                            isClearable
                            customInput={
                              <input 
                                className="w-full rounded-md input-base bg-input/50 p-2 text-xs text-brand cursor-pointer"
                              />
                            }
                          />
                        </span>
                      </div>
                      ) : (
                        <div>
                          📅 <DatePicker
                            selected={null}
                            onChange={(date) => updateReminder(prompt.id, date)}
                            showTimeSelect
                            dateFormat="MMMM d, yyyy h:mm aa"
                            className="inline rounded-md input-base bg-input/50 ml-2 p-2 text-xs"
                            placeholderText="Add reminder"
                            isClearable
                            customInput={
                              <input 
                                className="rounded-md input-base bg-input/50 p-2 text-xs text-brand cursor-pointer"
                              />
                            }
                          />
                        </div>
                      )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => makeSpace(prompt)} 
                    className="text-brand hover:text-brand/80"
                  >
                    New Space
                  </button>
                  <button 
                    onClick={() => deletePrompt(prompt.id)} 
                    className="text-red hover:text-red/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Prompts;