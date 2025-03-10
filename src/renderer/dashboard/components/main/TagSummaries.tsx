import React, { useState, useEffect } from 'react';
import { useSettingsManager } from '../../hooks/useSettingsManager';
import { useAuth } from '../../contexts/AuthContext.js';

interface TagSummary {
  tag: string;
  summary: string;
}

const TagSummaries: React.FC = () => {
  const [summaries, setSummaries] = useState<TagSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);
  const { isAuthenticated } = useAuth();
  
  const fetchSummaries = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // First try to get existing summaries from local storage
      const result = await window.electron.ipcRenderer.invoke('get-tag-summaries');
      
      if (result.success && result.summaries && result.summaries.length > 0) {
        setSummaries(result.summaries);
      } else {
        // If no summaries exist, show a message but don't automatically generate
        setError('No tag summaries found. Click "Generate Summaries" to create them.');
      }
    } catch (error) {
      setError('Failed to fetch tag summaries');
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateSummaries = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await window.electron.ipcRenderer.invoke('generate-top-tag-summaries', limit);
      
      if (result.success) {
        setSummaries(result.summaries);
      } else {
        setError(result.error || 'Failed to generate tag summaries');
      }
    } catch (error) {
      setError('Failed to generate tag summaries');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSummaries();
  }, []);
  
  // Render loading visualization
  const renderLoadingState = () => {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-brand/20 rounded-lg w-3/4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-brand/20 rounded w-1/2"></div>
          <div className="h-4 bg-brand/20 rounded w-full"></div>
          <div className="h-4 bg-brand/20 rounded w-3/4"></div>
        </div>
        <div className="space-y-2">
          <div className="h-20 bg-brand/10 rounded-lg"></div>
          <div className="h-20 bg-brand/10 rounded-lg"></div>
          <div className="h-20 bg-brand/10 rounded-lg"></div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="card space-y-4 bg-surface/50 p-8 rounded-sm">
      <h3 className="text-lg font-medium text-primary/90">Tag Summaries</h3>
      
      <div className="flex items-center space-x-4 mb-4">
        <label className="text-sm font-medium text-primary/80">
          Number of tags:
          <input
            type="number"
            value={limit}
            onChange={(e) => {
              const newLimit = Number(e.target.value);
              setLimit(newLimit);
            }}
            className="ml-2 p-1 rounded-md input-base bg-input/50 text-sm w-16"
            min={10}
            max={30}
          />
        </label>
        
        <button
          onClick={() => {
            generateSummaries();
          }}
          disabled={isLoading || !isAuthenticated}
          className={`
            px-4 py-2 bg-brand/80 text-white rounded-md disabled:opacity-50
            ${isLoading ? 'animate-pulse' : ''}
          `}
        >
          {isLoading ? 'Generating...' : 'Generate Summaries'}
        </button>
      </div>
      
      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}
      
      {isLoading ? (
        renderLoadingState()
      ) : summaries.length === 0 ? (
        <div className="text-secondary/70">
          No tag summaries available. Click "Generate Summaries" to create them.
        </div>
      ) : (
        <div className="space-y-6">
          {summaries.map((summary) => (
            <div key={summary.tag} className="border border-surface-variant p-4 rounded-md">
              <h4 className="text-md font-medium text-primary/90 mb-2">#{summary.tag}</h4>
              <p className="text-sm text-secondary/80 whitespace-pre-wrap">{summary.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagSummaries; 