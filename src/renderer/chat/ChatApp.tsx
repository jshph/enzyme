import React, { useState, useEffect } from 'react';
import { useChat } from 'ai/react';
import './ChatApp.css';

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

interface OllamaModelsResponse {
  models: OllamaModel[];
}

export function ChatApp() {
  const [apiUrl, setApiUrl] = useState('/api/chat');
  const [selectedModel, setSelectedModel] = useState('default');
  const [port, setPort] = useState(5174);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [ollamaMessages, setOllamaMessages] = useState<Array<{role: string, content: string, id: string}>>([]);
  const [isOllamaLoading, setIsOllamaLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  // Set up the API URL based on development or production mode
  useEffect(() => {
    // In development or production, we can use relative URLs
    // since the server is running on the same port as the UI
    setApiUrl('/api/chat');
    
    // Get the current port from the window location
    const currentPort = window.location.port;
    if (currentPort) {
      setPort(Number(currentPort));
    }
  }, []);
  
  // Fetch available models from Ollama API
  const fetchModels = async () => {
    setIsLoadingModels(true);
    setModelError(null);
    
    try {
      // Connect directly to Ollama API
      const response = await fetch('http://localhost:11434/api/tags');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.models) {
        setAvailableModels(data.models);
      } else {
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelError(error instanceof Error ? error.message : 'Failed to fetch models');
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };
  
  // Fetch models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Use Vercel AI SDK for local processing
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel === 'default' ? undefined : selectedModel
    }
  });

  // Handle input change for both modes
  const handleInputValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (selectedModel === 'default') {
      handleInputChange(e);
    }
  };

  // Custom submit handler for Ollama
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (selectedModel !== 'default') {
      // For Ollama, we need to format the request differently
      if (!inputValue.trim()) return;
      
      // Add user message to UI
      const userMessage = { id: Date.now().toString(), role: 'user', content: inputValue };
      setOllamaMessages(prev => [...prev, userMessage]);
      
      // Set loading state
      setIsOllamaLoading(true);
      
      // Call Ollama API directly
      fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: inputValue,
          stream: false
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Ollama response:', data);
        // Add assistant message to UI
        const assistantMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: data.response || "No response from model" 
        };
        setOllamaMessages(prev => [...prev, assistantMessage]);
        
        // Clear the input
        setInputValue('');
      })
      .catch(error => {
        console.error('Error calling Ollama API:', error);
        setModelError(`Error calling Ollama API: ${error.message}`);
        
        // Add error message to UI
        const errorMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `Error: ${error.message}` 
        };
        setOllamaMessages(prev => [...prev, errorMessage]);
      })
      .finally(() => {
        setIsOllamaLoading(false);
      });
    } else {
      // Use the default Vercel AI SDK handler for local processing
      handleSubmit(e);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    
    // Check if we need to clear messages
    if ((newModel === 'default' && ollamaMessages.length > 0) || 
        (newModel !== 'default' && messages.length > 0)) {
      if (confirm('Changing models will clear your current conversation. Continue?')) {
        // Clear the appropriate message array
        if (newModel === 'default') {
          setOllamaMessages([]);
        }
        // Note: We can't directly clear the messages array from useChat,
        // but switching models will effectively start a new conversation
        setSelectedModel(newModel);
      }
    } else {
      // No messages to clear, just switch the model
      setSelectedModel(newModel);
    }
  };
  
  const handleRefreshModels = () => {
    fetchModels();
  };
  
  const checkServerConnection = async () => {
    try {
      // Try connecting directly to Ollama
      const response = await fetch('http://localhost:11434/api/tags');
      
      if (response.ok) {
        const data = await response.json();
        setServerStatus(`Ollama API is available with ${data.models?.length || 0} models`);
      } else {
        throw new Error(`Ollama API check failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Server connection error:', error);
      setServerStatus(`Error: ${error instanceof Error ? error.message : 'Failed to connect to server'}`);
    }
  };

  const checkOllamaConnection = async () => {
    try {
      console.log('Testing direct connection to Ollama API');
      const response = await fetch('http://localhost:11434/api/tags');
      
      if (!response.ok) {
        throw new Error(`Ollama API check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Ollama API response:', data);
      
      if (data.models && data.models.length > 0) {
        setServerStatus(`Ollama API is available with ${data.models.length} models`);
      } else {
        setServerStatus('Ollama API is available but no models found');
      }
    } catch (error) {
      console.error('Ollama API connection error:', error);
      setServerStatus(`Ollama Error: ${error instanceof Error ? error.message : 'Failed to connect to Ollama API'}`);
    }
  };

  // Determine which messages to display based on selected model
  const displayMessages = selectedModel === 'default' ? messages : ollamaMessages;
  const isCurrentlyLoading = selectedModel === 'default' ? isLoading : isOllamaLoading;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Enzyme Chat</h1>
        <p>Ask questions about your notes and documents</p>
        
        <div className="model-selector">
          <label htmlFor="model-select">Model:</label>
          <select 
            id="model-select" 
            value={selectedModel} 
            onChange={handleModelChange}
            className="model-select"
            disabled={isCurrentlyLoading}
          >
            <option value="default">Default (Local Processing)</option>
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
            className="refresh-button"
            disabled={isLoadingModels || isCurrentlyLoading}
            title="Refresh models list"
          >
            ↻
          </button>
          
          <label htmlFor="port-input" className="ml-4">Port:</label>
          <input
            id="port-input"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="port-input"
            min="1"
            max="65535"
            disabled={isCurrentlyLoading}
          />
        </div>
        
        {modelError && (
          <div className="model-error">
            {modelError}
          </div>
        )}
        
        {serverStatus && (
          <div className={serverStatus.includes('Error') ? 'model-error' : 'server-status'}>
            {serverStatus}
            <button 
              onClick={() => setServerStatus(null)} 
              className="close-button"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        
        <div className="debug-controls">
          <button 
            onClick={checkServerConnection} 
            className="debug-button"
            title="Check server connection"
          >
            Check Server
          </button>
          <button 
            onClick={checkOllamaConnection} 
            className="debug-button"
            title="Check Ollama connection"
          >
            Check Ollama
          </button>
        </div>
      </div>
      
      <div className="messages-container">
        {displayMessages.length === 0 ? (
          <div className="empty-state">
            <p>Start a conversation by typing a message below.</p>
            <p className="text-xs mt-2 text-gray-500">
              {selectedModel !== 'default' 
                ? `Using model: ${selectedModel} via direct connection to Ollama` 
                : 'Using default local processing'}
            </p>
            {availableModels.length > 0 && (
              <div className="available-models">
                <p className="text-xs mt-2 font-medium">Available models:</p>
                <ul className="model-list">
                  {availableModels.map(model => (
                    <li key={model.digest} className="model-item">
                      <span className="model-name">{model.name}</span>
                      <span className="model-size">{formatSize(model.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          displayMessages.map(message => (
            <div 
              key={message.id} 
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >  
              <div className="message-content">
                {message.content}
              </div>
            </div>
          ))
        )}
        {isCurrentlyLoading && (
          <div className="message assistant-message">
            <div className="message-content loading">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleFormSubmit} className="input-form">
        <input
          className="chat-input"
          value={selectedModel === 'default' ? input : inputValue}
          onChange={handleInputValueChange}
          placeholder="Ask a question about your notes..."
          disabled={isCurrentlyLoading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isCurrentlyLoading || (selectedModel === 'default' ? !input.trim() : !inputValue.trim())}
        >
          Send
        </button>
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