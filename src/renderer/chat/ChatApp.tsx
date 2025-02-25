import React, { useState, useEffect } from 'react';
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
    <div className="flex flex-col h-screen max-w-4xl mx-auto font-sans">
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="m-0 text-2xl font-semibold text-gray-900">Enzyme Chat</h1>
        <p className="mt-2 text-gray-500 text-sm">Ask questions about your notes and documents</p>
        
        <div className="flex items-center justify-center mt-3 gap-2">
          <label htmlFor="model-select" className="text-sm text-gray-500">Model:</label>
          <select 
            id="model-select" 
            value={selectedModel} 
            onChange={handleModelChange}
            className="py-1.5 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 outline-none transition-colors focus:border-blue-600 focus:shadow-outline-blue disabled:opacity-70 disabled:cursor-not-allowed"
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
            className="flex items-center justify-center w-8 h-8 rounded-md border border-gray-300 bg-white text-base text-gray-500 cursor-pointer transition-all hover:bg-gray-100 hover:text-blue-600 focus:border-blue-600 focus:shadow-outline-blue focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={isLoadingModels || isCurrentlyLoading}
            title="Refresh models list"
          >
            ↻
          </button>
          
          <label htmlFor="port-input" className="ml-4 text-sm text-gray-500">Port:</label>
          <input
            id="port-input"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-20 py-1.5 px-2 rounded-md border border-gray-300 bg-white text-sm text-gray-900 text-center outline-none transition-colors focus:border-blue-600 focus:shadow-outline-blue disabled:opacity-70 disabled:cursor-not-allowed"
            min="1"
            max="65535"
            disabled={isCurrentlyLoading}
          />
        </div>
        
        {modelError && (
          <div className="mt-2 p-2 rounded-md bg-red-100 text-red-700 text-sm text-center">
            {modelError}
          </div>
        )}
        
        {serverStatus && (
          <div className={`mt-2 p-2 rounded-md text-sm text-center flex items-center justify-center gap-2 ${serverStatus.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
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
            className="py-1.5 px-3 rounded-md border border-gray-300 bg-gray-100 text-xs text-gray-600 cursor-pointer transition-all hover:bg-gray-200 hover:text-gray-900"
            title="Check server connection"
          >
            Check Server
          </button>
          <button 
            onClick={checkOllamaConnection} 
            className="py-1.5 px-3 rounded-md border border-gray-300 bg-gray-100 text-xs text-gray-600 cursor-pointer transition-all hover:bg-gray-200 hover:text-gray-900"
            title="Check Ollama connection"
          >
            Check Ollama
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center p-8">
            <p>Start a conversation by typing a message below.</p>
            <p className="text-xs mt-2 text-gray-500">
              {selectedModel !== 'default' 
                ? `Using model: ${selectedModel} via direct connection to Ollama` 
                : 'Using default local processing'}
            </p>
            {availableModels.length > 0 && (
              <div className="mt-4 w-full max-w-md">
                <p className="text-xs mt-2 font-medium">Available models:</p>
                <ul className="list-none p-0 mt-2 flex flex-col gap-1">
                  {availableModels.map(model => (
                    <li key={model.digest} className="flex justify-between items-center p-1.5 rounded-md bg-gray-100 text-xs">
                      <span className="font-medium text-gray-900">{model.name}</span>
                      <span className="text-gray-500">{formatSize(model.size)}</span>
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
              className={`flex mb-4 animate-fadeIn ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >  
              <div 
                className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap break-words text-[0.9375rem] leading-6 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-2xl rounded-tl-2xl rounded-bl-none' 
                    : 'bg-gray-100 text-gray-900 rounded-tl-2xl rounded-tr-2xl rounded-br-none'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
        {isCurrentlyLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-none max-w-[80%] p-3">
              <div className="flex gap-1 items-center justify-center h-6">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.32s]"></span>
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.16s]"></span>
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleFormSubmit} className="flex gap-2 py-4 border-t border-gray-200">
        <input
          className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-[0.9375rem] outline-none transition-colors focus:border-blue-600 focus:shadow-outline-blue disabled:opacity-70 disabled:cursor-not-allowed"
          value={selectedModel === 'default' ? input : inputValue}
          onChange={handleInputValueChange}
          placeholder="Ask a question about your notes..."
          disabled={isCurrentlyLoading}
        />
        <button 
          type="submit" 
          className="py-3 px-5 rounded-lg bg-blue-600 text-white border-none font-medium cursor-pointer transition-colors hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
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