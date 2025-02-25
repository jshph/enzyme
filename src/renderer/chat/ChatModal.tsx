import React, { useState, useEffect, useMemo } from 'react';
import { ChatApp } from './ChatApp';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntities: Map<string, { type: 'tag' | 'link', count: number, maxCount: number }>;
  context?: any[];
}

export const ChatModal: React.FC<ChatModalProps> = ({ 
  isOpen, 
  onClose, 
  selectedEntities,
  context = []
}) => {
  const [initialPrompt, setInitialPrompt] = useState<string>('');

  // Generate initial prompt based on selected entities
  useEffect(() => {
    if (isOpen && selectedEntities.size > 0) {
      const entityNames = Array.from(selectedEntities.keys())
        .map(name => name)
        .join(', ');
      
      // Create a simple prompt that doesn't expose the context
      setInitialPrompt(`I'd like to recap some major questions from my included notes, particularly around mentions of ${entityNames}`);
    } else if (isOpen) {
      setInitialPrompt('How can I help you with your notes today?');
    }
  }, [isOpen, selectedEntities]);

  // If the modal isn't open, don't render anything to save resources
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col relative border border-surface/70">
        <div className="flex justify-between items-center p-4 border-b border-surface bg-surface/30 backdrop-blur-sm rounded-t-lg">
          <div>
            <h3 className="text-xl font-semibold text-primary">
              Chat with Your Notes
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary focus:outline-none transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <ChatApp 
            isModal={true}
            initialPrompt={initialPrompt} 
            entityContext={{
              entities: selectedEntities,
              context: context
            }} 
          />
        </div>
      </div>
    </div>
  );
}; 