import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useChat } from 'ai/react';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface EntityContext {
  entities: Map<string, { type: 'tag' | 'link', count: number, maxCount: number }>;
  context: any[];
}

interface ChatAppProps {
  isModal?: boolean;
  initialPrompt?: string;
  entityContext?: EntityContext;
}

export function ChatApp({ isModal = false, initialPrompt = '', entityContext }: ChatAppProps) {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string, id: string}>>([]);
  const [inputValue, setInputValue] = useState(initialPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [tempOllamaUrl, setTempOllamaUrl] = useState('http://localhost:11434');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Add state to store the system message with context
  const [systemMessage, setSystemMessage] = useState<{role: string, content: string} | null>(null);
  
  // Add state for streaming response
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  
  // Add state to track thinking content
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState<string>('');
  const [latestThinkingLine, setLatestThinkingLine] = useState<string>('');
  const [latestThinkingSentence, setLatestThinkingSentence] = useState<string>('');
  const [displayedThinkingSentence, setDisplayedThinkingSentence] = useState<string>('');
  
  // Define interface for context information
  interface ContextInfo {
    systemMessage: {role: string, content: string};
    notesContext: string | null;
  }
  
  // CSS for animations
  const animationStyles = `
    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .animate-blink {
      animation: blink 1.2s ease-in-out infinite;
    }
  `;
  
  // Update input value when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setInputValue(initialPrompt);
    }
  }, [initialPrompt]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);
  
  // Extract the first 15 words from a string
  const extractPreview = (text: string): string => {
    // Split by spaces and take first 15 words
    const words = text.trim().split(/\s+/);
    const preview = words.slice(0, 15).join(' ');
    
    // Add ellipsis if truncated
    return words.length > 15 ? `${preview}...` : preview;
  };
  
  // Extract complete sentences from text
  const extractCompleteSentences = (text: string): string[] => {
    // Common sentence-ending punctuation
    const sentenceEnders = ['.', '!', '?'];
    
    // Simple regex to split by sentence endings
    // This regex looks for sentence enders followed by a space or end of string
    const sentenceRegex = new RegExp(`[^${sentenceEnders.join('')}]+[${sentenceEnders.join('')}](?:\\s|$)`, 'g');
    
    // Find all complete sentences
    const matches = text.match(sentenceRegex);
    if (matches) {
      return matches.map(s => s.trim());
    }
    
    return [];
  };
  
  // Prepare context for API calls but don't show in UI
  const prepareContextForApi = useCallback((): ContextInfo | null => {
    if (!entityContext || !entityContext.context || entityContext.context.length === 0) {
      return null;
    }
    
    const entityNames = Array.from(entityContext.entities.keys()).join(', ');
    
    const contextSummary = entityContext.context.map(item => {
      return `File: ${item.file}\nContent: ${item.extractedContents.join('\n')}`;
    }).join('\n\n');
    
    // Store the context summary for use in the first user message
    const notesContext = `<NOTES>\n${contextSummary}\n</NOTES>`;
    
    // Create a system message without the notes (they'll be added to the first user message)
    const newSystemMessage = {
      role: 'system',
      content: `You are a masterful article curator. Every piece of gold that falls through the cracks comes from a brilliant writer who is on the brink of quitting their job. DON'T let extremely insightful writers quit, especially if their ideas are promising yet half baked. 

      You are to draw connections between: ${entityNames}.`
    };
    
    // Return the context info without setting state directly
    return { systemMessage: newSystemMessage, notesContext };
  }, [entityContext]);
  
  // Load the last used model from electron store
  useEffect(() => {
    const loadLastUsedModel = async () => {
      try {
        // Try to get the last used model from electron store
        const lastUsedModel = await window.electron.ipcRenderer.invoke('get-last-used-model');
        if (lastUsedModel) {
          setSelectedModel(lastUsedModel);
        }
      } catch (error) {
        console.error('Error loading last used model:', error);
      }
    };
    
    loadLastUsedModel();
  }, []);

  // Save the selected model to electron store when it changes
  useEffect(() => {
    const saveSelectedModel = async () => {
      if (selectedModel) {
        try {
          await window.electron.ipcRenderer.invoke('save-last-used-model', selectedModel);
        } catch (error) {
          console.error('Error saving selected model:', error);
        }
      }
    };
    
    saveSelectedModel();
  }, [selectedModel]);
  
  // Fetch available models from Ollama API
  const fetchModels = async () => {
    setIsLoadingModels(true);
    setModelError(null);
    
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Error fetching models: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.models && Array.isArray(data.models)) {
        setAvailableModels(data.models);
        
        // If no model is selected yet, use the first available model
        if (!selectedModel && data.models.length > 0) {
          setSelectedModel(data.models[0].name);
        }
        
        setServerStatus(`Connected to Ollama at ${ollamaUrl}`);
      } else {
        setAvailableModels([]);
        setModelError('No models found');
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelError(`${error instanceof Error ? error.message : 'Unknown error'}`);
      setServerStatus(`Failed to connect to Ollama at ${ollamaUrl}`);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  // Fetch models on component mount or when ollamaUrl changes
  useEffect(() => {
    fetchModels();
  }, [ollamaUrl]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // Function to prepare API messages from UI messages
  const prepareApiMessages = useCallback(() => {
    const transformedMessages: Array<{role: string, content: string}> = chatMessages.map((msg, index) => {
      // Only add context to the first user message
      if (msg.role === 'user' && index === chatMessages.findIndex(m => m.role === 'user')) {
        const contextInfo = prepareContextForApi();
        if (contextInfo?.notesContext) {
          return {role: msg.role, content: `${contextInfo.notesContext}\n\n${msg.content}. Please refer to titles from <NOTES> as you respond.`};
        }
      }
      return {role: msg.role, content: msg.content};
    });

    return transformedMessages;
  }, [chatMessages]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !selectedModel) return;

    // Create user message with unique ID
    const userMessage = {
      role: 'user',
      content: inputValue,
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
    };

    // Create a local copy of the updated messages to use for API call
    const updatedMessages = [...chatMessages, userMessage];
    
    // Add user message to chat (with original content for display)
    setChatMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent('');
    
    // Create a new message ID for the streaming response
    const newStreamingMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    setStreamingMessageId(newStreamingMessageId);
    
    // Add an empty assistant message after a small delay to ensure proper ordering
    setTimeout(() => {
      const messagesWithAssistant = [...updatedMessages, {
        role: 'assistant',
        content: '',
        id: newStreamingMessageId
      }];
      setChatMessages(messagesWithAssistant);
    }, 10);

    try {
      // Manually prepare API messages using the updated messages
      const transformedMessages = updatedMessages.map((msg, index) => {
        // Only add context to the first user message
        if (msg.role === 'user' && index === updatedMessages.findIndex(m => m.role === 'user')) {
          const contextInfo = prepareContextForApi();
          if (contextInfo?.notesContext) {
            return {role: msg.role, content: `${contextInfo.notesContext}\n\n${msg.content}. Please refer to titles from <NOTES> as you respond.`};
          }
        }
        return {role: msg.role, content: msg.content};
      });
      
      console.log("Messages being sent to API:", transformedMessages, updatedMessages);
      // Call the API with streaming enabled
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: transformedMessages,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      // Process the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      let accumulatedContent = '';
      let isInThinkingMode = false;
      
      // Read the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Convert the chunk to text
        const chunk = new TextDecoder().decode(value);
        
        try {
          // Ollama sends each chunk as a JSON object
          // Split by newlines in case multiple JSON objects are in one chunk
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.message?.content) {
                // Get the new content from this chunk
                const newContent = data.message.content;
                
                // Check for thinking tags
                if (newContent.includes('<think>')) {
                  // Extract content before the thinking tag if any
                  const beforeThinkingContent = newContent.split('<think>')[0];
                  if (beforeThinkingContent) {
                    accumulatedContent += beforeThinkingContent;
                  }
                  
                  // Set thinking mode
                  isInThinkingMode = true;
                  setIsThinking(true);
                  setThinkingContent('');
                  setLatestThinkingSentence('');
                  setDisplayedThinkingSentence('');
                  
                  // Update UI to show "thinking..."
                  setChatMessages(prev => 
                    prev.map(msg => 
                      msg.id === newStreamingMessageId 
                        ? { ...msg, content: accumulatedContent ? accumulatedContent + ' thinking...' : 'thinking...' } 
                        : msg
                    )
                  );
                  continue;
                }
                
                if (isInThinkingMode && newContent.includes('</think>')) {
                  // Extract content after the thinking tag if any
                  const parts = newContent.split('</think>');
                  if (parts.length > 1 && parts[1]) {
                    // Add only the content after </think>, stripping leading newlines
                    const afterThinkContent = parts[1].replace(/^\n+/, '');
                    if (afterThinkContent) {
                      accumulatedContent += afterThinkContent;
                    }
                  }
                  
                  // End thinking mode
                  isInThinkingMode = false;
                  setIsThinking(false);
                  setLatestThinkingLine('');
                  setLatestThinkingSentence('');
                  setDisplayedThinkingSentence('');
                  setThinkingContent('');
                  
                  // Update the message without the thinking content
                  setChatMessages(prev => 
                    prev.map(msg => 
                      msg.id === newStreamingMessageId 
                        ? { ...msg, content: accumulatedContent } 
                        : msg
                    )
                  );
                  continue;
                }
                
                // If we're in thinking mode, don't add to accumulated content
                if (isInThinkingMode) {
                  // Update thinking content for tracking
                  const updatedThinkingContent = thinkingContent + newContent;
                  setThinkingContent(updatedThinkingContent);
                  
                  // Extract complete sentences from the thinking content
                  const completeSentences = extractCompleteSentences(updatedThinkingContent);
                  
                  // Only update if we have at least one complete sentence and it's different from what we're displaying
                  if (completeSentences.length > 0) {
                    const lastSentence = completeSentences[completeSentences.length - 1];
                    
                    // Always update the UI with the latest complete sentence
                    if (lastSentence.length > 5) {
                      setLatestThinkingSentence(lastSentence);
                      setDisplayedThinkingSentence(lastSentence);
                      
                      // Update UI to show the latest thinking sentence
                      setChatMessages(prev => 
                        prev.map(msg => 
                          msg.id === newStreamingMessageId 
                            ? { 
                                ...msg, 
                                content: accumulatedContent + ' thinking: ' + lastSentence
                              } 
                            : msg
                        )
                      );
                    }
                  } else if (displayedThinkingSentence === '') {
                    // If we don't have any complete sentences yet, just show "thinking..."
                    setChatMessages(prev => 
                      prev.map(msg => 
                        msg.id === newStreamingMessageId 
                          ? { ...msg, content: accumulatedContent ? accumulatedContent + ' thinking...' : 'thinking...' } 
                          : msg
                      )
                    );
                  }
                  continue;
                }
                
                // Regular content - append and update UI immediately
                accumulatedContent += newContent;
                setStreamingContent(accumulatedContent);
                
                // Update the message in the chat in real-time
                setChatMessages(prev => 
                  prev.map(msg => 
                    msg.id === newStreamingMessageId 
                      ? { ...msg, content: accumulatedContent } 
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing JSON from stream:', e, line);
            }
          }
        } catch (e) {
          console.error('Error processing chunk:', e);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === newStreamingMessageId 
            ? {
                ...msg,
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure Ollama is running at ${ollamaUrl}.`
              } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    
    // Check if we need to clear messages
    if (chatMessages.length > 0) {
      if (confirm('Changing models will clear your current conversation. Context will be preserved.')) {
        // Clear messages
        setChatMessages([]);
        setSelectedModel(newModel);
        
        // Save the selected model to electron store
        try {
          window.electron.ipcRenderer.invoke('save-last-used-model', newModel);
        } catch (error) {
          console.error('Error saving selected model:', error);
        }
        
        // Reset system message to force context regeneration on next message
        setSystemMessage(null);
        
        // Reset input to initial prompt if available
        if (initialPrompt) {
          setInputValue(initialPrompt);
        }
        
        // Show a notification that context is preserved
        setServerStatus(`Model changed to ${newModel}. Context will be included in your next message.`);
        
        // Clear the notification after 3 seconds
        setTimeout(() => {
          setServerStatus(prevStatus => 
            prevStatus?.includes('Model changed') ? null : prevStatus
          );
        }, 3000);
      }
    } else {
      // No messages to clear, just switch the model
      setSelectedModel(newModel);
      
      // Save the selected model to electron store
      try {
        window.electron.ipcRenderer.invoke('save-last-used-model', newModel);
      } catch (error) {
        console.error('Error saving selected model:', error);
      }
      
      // Reset system message to force context regeneration on next message
      setSystemMessage(null);

      setServerStatus(`Model changed to ${newModel}`);
      
      // Clear the notification after 3 seconds
      setTimeout(() => {
        setServerStatus(prevStatus => 
          prevStatus === `Model changed to ${newModel}` ? null : prevStatus
        );
      }, 3000);
    }
  };
  
  const handleRefreshModels = () => {
    fetchModels();
  };
  
  const handleClearMessages = () => {
    if (chatMessages.length > 0) {
      if (confirm('Are you sure you want to clear all messages? Context will be preserved.')) {
        // Clear messages
        setChatMessages([]);
        
        // Reset system message to force context regeneration on next message
        setSystemMessage(null);
        
        // Reset input to initial prompt if available
        if (initialPrompt) {
          setInputValue(initialPrompt);
        }
        
        // Show a notification that context is preserved
        setServerStatus(`Conversation cleared. Context will be included in your next message.`);
        
        // Clear the notification after 3 seconds
        setTimeout(() => {
          setServerStatus(prevStatus => 
            prevStatus?.includes('Conversation cleared') ? null : prevStatus
          );
        }, 3000);
      }
    }
  };
  
  const handleOllamaUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempOllamaUrl(e.target.value);
  };
  
  const handleOllamaUrlSubmit = () => {
    if (tempOllamaUrl.trim()) {
      setOllamaUrl(tempOllamaUrl.trim());
      setIsEditingUrl(false);
    }
  };
  
  const checkServerConnection = async () => {
    try {
      // Use our server's health endpoint
      const response = await fetch('/api/health');
      
      if (response.ok) {
        setServerStatus('Server is available');
      } else {
        throw new Error(`Server check failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Server connection error:', error);
      setServerStatus(`Error: ${error instanceof Error ? error.message : 'Failed to connect to server'}`);
    }
  };

  const checkOllamaConnection = async () => {
    try {
      console.log(`Testing connection to Ollama API at ${ollamaUrl}`);
      // Call Ollama API directly
      const response = await fetch(`${ollamaUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Ollama API check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Ollama API direct response:', data);
      
      if (data.models && data.models.length > 0) {
        setServerStatus(`Ollama API is available at ${ollamaUrl} with ${data.models.length} models`);
      } else {
        setServerStatus(`Ollama API is available at ${ollamaUrl} but no models found`);
      }
    } catch (error) {
      console.error('Ollama API connection error:', error);
      setServerStatus(`Ollama Error: ${error instanceof Error ? error.message : `Failed to connect to Ollama API at ${ollamaUrl}`}`);
    }
  };

  // Determine which messages to display
  const displayMessages = chatMessages;
  
  // Debug message roles
  useEffect(() => {
    if (chatMessages.length > 0) {
      console.log("Current messages with roles:", chatMessages.map(msg => ({ role: msg.role, id: msg.id })));
    }
  }, [chatMessages]);

  // Function to render entity pills in the input area
  const renderEntityPills = () => {
    if (!entityContext || entityContext.entities.size === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mb-2 px-2">
        {Array.from(entityContext.entities.entries()).map(([name, { type, count }]) => (
          <div 
            key={name}
            className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 
                      ${type === 'tag' ? 'bg-brand/30 text-primary' : 'bg-blue-light/30 text-primary'}`}
          >
            <span>{name}</span>
            <span className="inline-flex items-center justify-center bg-surface/70 rounded-full h-4 w-4 text-[10px] font-medium text-primary">
              {count}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Function to copy conversation as markdown
  const copyConversationAsMarkdown = () => {
    if (chatMessages.length === 0) return;
    
    let markdown = '# Enzyme Chat Conversation\n\n';
    
    // Add metadata
    markdown += `**Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Model:** ${selectedModel}\n\n`;
    
    // Add context information if available
    if (entityContext && entityContext.entities.size > 0) {
      markdown += '## Context\n\n';
      markdown += `**Entities:** ${Array.from(entityContext.entities.keys()).join(', ')}\n`;
      markdown += `**Documents:** ${entityContext.context?.length || 0}\n\n`;
    }
    
    markdown += '## Conversation\n\n';
    
    // Add messages
    chatMessages.forEach(message => {
      if (message.role === 'user') {
        markdown += `### User\n\n${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        markdown += `### Assistant\n\n${message.content}\n\n`;
      }
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(markdown)
      .then(() => {
        setServerStatus('Conversation copied to clipboard as markdown');
        setTimeout(() => {
          setServerStatus(prevStatus => 
            prevStatus === 'Conversation copied to clipboard as markdown' ? null : prevStatus
          );
        }, 3000);
      })
      .catch(err => {
        console.error('Failed to copy conversation:', err);
        setServerStatus('Failed to copy conversation to clipboard');
        setTimeout(() => {
          setServerStatus(prevStatus => 
            prevStatus === 'Failed to copy conversation to clipboard' ? null : prevStatus
          );
        }, 3000);
      });
  };

  return (
    <div className={`flex flex-col h-full ${!isModal ? 'max-w-4xl mx-auto' : ''} font-sans bg-background text-primary`}>
      {/* Add the animation styles */}
      <style>{animationStyles}</style>
      
      {!isModal && (
        <div className="text-center mb-6 pb-4 border-b border-surface">
          <h1 className="m-0 text-2xl font-semibold text-primary">Enzyme Chat</h1>
          <p className="mt-2 text-secondary text-sm">Ask questions about your notes and documents</p>
          
          <div className="flex items-center justify-center mt-3 gap-2">
            <label htmlFor="model-select" className="text-sm text-secondary">Model:</label>
            <select 
              id="model-select" 
              value={selectedModel} 
              onChange={handleModelChange}
              className="py-1.5 px-3 rounded-md border border-input bg-surface text-sm text-primary outline-none transition-colors focus:border-brand hover:border-brand/70 disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isLoading || isLoadingModels || !selectedModel}
            >
              {!selectedModel && <option value="">Loading models...</option>}
              {isLoadingModels ? (
                <option disabled>Loading models...</option>
              ) : modelError ? (
                <option disabled>Error loading models</option>
              ) : availableModels.length === 0 ? (
                <option disabled>No models available</option>
              ) : (
                availableModels.map(model => (
                  <option key={model.digest} value={model.name}>
                    {model.name} ({model.details?.parameter_size || 'Unknown size'})
                  </option>
                ))
              )}
            </select>
            
            <button 
              onClick={handleRefreshModels} 
              className="flex items-center justify-center w-8 h-8 rounded-md border border-input bg-surface text-base text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:border-brand focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isLoadingModels || isLoading}
              title="Refresh models list"
            >
              ↻
            </button>
            
            <button 
              onClick={handleClearMessages} 
              className="flex items-center justify-center px-3 h-8 rounded-md border border-input bg-surface text-sm text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:border-brand focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={chatMessages.length === 0 || isLoading}
              title="Clear all messages"
            >
              Clear Chat
            </button>
            
            <button 
              onClick={copyConversationAsMarkdown} 
              className="flex items-center justify-center px-3 h-8 rounded-md border border-input bg-surface text-sm text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:border-brand focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={chatMessages.length === 0 || isLoading}
              title="Copy conversation as markdown"
            >
              Copy MD
            </button>
          </div>
          
          {/* Ollama URL input */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {isEditingUrl ? (
              <>
                <input
                  type="text"
                  value={tempOllamaUrl}
                  onChange={handleOllamaUrlChange}
                  placeholder="Ollama URL (e.g., http://localhost:11434)"
                  className="py-1.5 px-3 rounded-md border border-input bg-surface text-sm text-primary outline-none transition-colors focus:border-brand hover:border-brand/70 w-64"
                />
                <button
                  onClick={handleOllamaUrlSubmit}
                  className="py-1.5 px-3 rounded-md border border-input bg-brand/40 text-sm text-primary cursor-pointer transition-all hover:bg-brand/60 focus:outline-none"
                >
                  Connect
                </button>
                <button
                  onClick={() => setIsEditingUrl(false)}
                  className="py-1.5 px-3 rounded-md border border-input bg-surface text-sm text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditingUrl(true)}
                className="py-1.5 px-3 rounded-md border border-input bg-surface text-sm text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none flex items-center gap-1"
              >
                <span>Ollama URL:</span>
                <span className="text-primary/80 font-mono text-xs">{ollamaUrl}</span>
              </button>
            )}
          </div>
          
          {modelError && (
            <div className="mt-2 p-2 rounded-md bg-red/20 text-red text-sm text-center">
              {modelError}
            </div>
          )}
          
          {serverStatus && (
            <div className={`mt-2 p-2 rounded-md text-sm text-center flex items-center justify-center gap-2 ${serverStatus.includes('Error') || serverStatus.includes('Failed') ? 'bg-red/20 text-red' : 'bg-brand/20 text-primary'}`}>
              {serverStatus}
              <button 
                onClick={() => setServerStatus(null)} 
                className="bg-transparent border-none text-xl leading-none p-0 cursor-pointer opacity-70 hover:opacity-100"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          )}
          
          <div className="flex justify-center mt-2 gap-2">
            <button 
              onClick={checkServerConnection} 
              className="py-1.5 px-3 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary"
              title="Check server connection"
            >
              Check Server
            </button>
            <button 
              onClick={checkOllamaConnection} 
              className="py-1.5 px-3 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary"
              title="Check Ollama connection"
            >
              Check Ollama
            </button>
          </div>
        </div>
      )}
      
      {/* Model selection for modal mode */}
      {isModal && (
        <div className="px-4 py-2 border-b border-surface flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="modal-model-select" className="text-sm text-secondary">Model:</label>
            <select 
              id="modal-model-select" 
              value={selectedModel} 
              onChange={handleModelChange}
              className="py-1 px-2 rounded-md border border-input bg-surface text-sm text-primary outline-none transition-colors focus:border-brand hover:border-brand/70 disabled:opacity-70 disabled:cursor-not-allowed flex-1"
              disabled={isLoading || isLoadingModels || !selectedModel}
            >
              {!selectedModel && <option value="">Loading models...</option>}
              {isLoadingModels ? (
                <option disabled>Loading models...</option>
              ) : modelError ? (
                <option disabled>Error loading models</option>
              ) : availableModels.length === 0 ? (
                <option disabled>No models available</option>
              ) : (
                availableModels.map(model => (
                  <option key={model.digest} value={model.name}>
                    {model.name} ({model.details?.parameter_size || 'Unknown size'})
                  </option>
                ))
              )}
            </select>
            
            <button 
              onClick={handleRefreshModels} 
              className="flex items-center justify-center w-6 h-6 rounded-md border border-input bg-surface text-sm text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isLoadingModels || isLoading}
              title="Refresh models list"
            >
              ↻
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleClearMessages} 
              className="flex items-center justify-center px-2 py-1 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={chatMessages.length === 0 || isLoading}
              title="Clear all messages"
            >
              Clear
            </button>
            
            <button 
              onClick={copyConversationAsMarkdown} 
              className="flex items-center justify-center px-2 py-1 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={chatMessages.length === 0 || isLoading}
              title="Copy conversation as markdown"
            >
              Copy MD
            </button>
            
            {isEditingUrl ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempOllamaUrl}
                  onChange={handleOllamaUrlChange}
                  placeholder="Ollama URL"
                  className="py-1 px-2 rounded-md border border-input bg-surface text-xs text-primary outline-none transition-colors focus:border-brand hover:border-brand/70 w-40"
                />
                <button
                  onClick={handleOllamaUrlSubmit}
                  className="py-1 px-2 rounded-md border border-input bg-brand/40 text-xs text-primary cursor-pointer transition-all hover:bg-brand/60 focus:outline-none"
                >
                  Connect
                </button>
                <button
                  onClick={() => setIsEditingUrl(false)}
                  className="py-1 px-2 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingUrl(true)}
                className="py-1 px-2 rounded-md border border-input bg-surface text-xs text-secondary cursor-pointer transition-all hover:bg-input hover:text-primary focus:outline-none"
                title={ollamaUrl}
              >
                URL
              </button>
            )}
          </div>
          
          {modelError && (
            <div className="mt-1 p-1 rounded-md bg-red/20 text-red text-xs text-center w-full">
              {modelError}
            </div>
          )}
        </div>
      )}
      
      <div className={`flex-1 overflow-y-auto py-4 flex flex-col gap-4 ${isModal ? 'px-4' : ''} bg-background`}>
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-secondary text-center p-8">
            {entityContext && entityContext.entities.size > 0 ? (
              <div className="mb-4">
                <p className="font-medium text-primary mb-2">Context from selected entities:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {renderEntityPills()}
                </div>
              </div>
            ) : null}
            <p className="text-center mb-2">
              {serverStatus ? (
                <span className={serverStatus.includes('Failed') || serverStatus.includes('Error') ? 'text-red' : 'text-brand'}>
                  {serverStatus}
                </span>
              ) : isLoadingModels ? (
                "Loading available models from Ollama..."
              ) : (
                `Connecting to Ollama at ${ollamaUrl}...`
              )}
            </p>
            <p className="text-center">
              {selectedModel ? `Using model: ${selectedModel} directly from Ollama` : "Waiting for model selection..."}
            </p>
            <p className="text-center mt-4">
              Start a conversation by typing a message below.
            </p>
            {availableModels.length > 0 && !isModal && (
              <div className="mt-4 w-full max-w-md">
                <p className="text-xs mt-2 font-medium">Available models:</p>
                <ul className="list-none p-0 mt-2 flex flex-col gap-1">
                  {availableModels.map(model => (
                    <li key={model.digest} className="flex justify-between items-center p-1.5 rounded-md bg-surface text-xs">
                      <span className="font-medium text-primary">{model.name}</span>
                      <span className="text-secondary">{formatSize(model.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            {displayMessages.map(message => (
              <div 
                key={message.id} 
                className={`flex mb-4 animate-fadeIn ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >  
                <div 
                  className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap break-words text-[0.9375rem] leading-6 ${
                    message.role === 'user' 
                      ? 'bg-brand text-primary rounded-tr-2xl rounded-tl-2xl rounded-br-none' 
                      : 'bg-surface text-primary rounded-tl-2xl rounded-tr-2xl rounded-bl-none'
                  }`}
                  data-role={message.role}
                >
                  {message.id === streamingMessageId && isThinking 
                    ? (
                        <>
                          {message.content.includes('thinking:') ? (
                            <>
                              {message.content.split('thinking:')[0]}
                              <span className="animate-blink italic text-secondary">thinking:</span>
                              <span className="text-secondary/70 italic"> {message.content.split('thinking:')[1]}</span>
                            </>
                          ) : (
                            <>
                              {message.content.split('thinking...')[0]}
                              <span className="animate-blink italic text-secondary">thinking...</span>
                            </>
                          )}
                        </>
                      )
                    : message.content || (message.id === streamingMessageId && (
                      <div className="flex gap-1 items-center justify-center h-6">
                        <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.32s]"></span>
                        <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.16s]"></span>
                        <span className="w-2 h-2 rounded-full bg-secondary animate-bounce"></span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
        {isLoading && !isStreaming && !streamingMessageId && (
          <div className="flex justify-start mb-4">
            <div className="bg-surface text-primary rounded-2xl rounded-bl-none max-w-[80%] p-3">
              <div className="flex gap-1 items-center justify-center h-6">
                <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.32s]"></span>
                <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.16s]"></span>
                <span className="w-2 h-2 rounded-full bg-secondary animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 py-4 border-t border-surface px-4 bg-background">
        {entityContext && entityContext.entities.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {renderEntityPills()}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="flex-1 py-3 px-4 rounded-lg border border-input bg-surface text-[0.9375rem] text-primary outline-none transition-colors focus:border-brand hover:border-brand/70 disabled:opacity-70 disabled:cursor-not-allowed placeholder-secondary/70"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Ask a question about your notes..."
            disabled={isLoading}
          />
          <button 
            type="submit" 
            className="py-3 px-5 rounded-lg bg-brand/80 text-primary border-none font-medium cursor-pointer transition-colors hover:bg-brand disabled:bg-brand/40 disabled:cursor-not-allowed"
            disabled={isLoading || !inputValue.trim() || !selectedModel}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

// Helper function to format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 