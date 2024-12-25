'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@udecode/cn';
import { Calendar, RefreshCw } from 'lucide-react';

interface SuggestedOutputProps {
  body: SuggestedOutputBody;
  className?: string;
  onEditPrompt: (id: number, prompt: string) => void;
  onSchedule?: (frequency: 'weekly' | 'monthly', startDate: Date) => void;
  onRetry?: () => void;
}

interface OutputSection {
  type: 'docs' | 'question' | 'synthesis' | 'theme';
  title: string;
  content: React.ReactNode;
}

export interface BaseSegment {
  theme: string;
  synthesis: {
    type: 'dive' | 'gap';
    prompt: string;
    analysis: string;
  };
  docs: {
    file: string;
    content: string;
  }[];
}

export interface SuggestedOutputBody {
  question: string;
  segments: BaseSegment[];
}

export const SuggestedOutput = React.forwardRef<
  HTMLDivElement,
  SuggestedOutputProps
>(({ body, className, onEditPrompt, onSchedule, onRetry }, ref) => {
  const [sections, setSections] = useState<OutputSection[]>([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState<Date>(new Date());

  const openInObsidian = async (filePath: string) => {
    await window.electron.ipcRenderer.invoke('open-in-obsidian', filePath);
  };

  useEffect(() => {
    const parseAndSetSections = async () => {
      try {
        const newSections: OutputSection[] = [];

        // Recipe Question - Persistent
        newSections.push({
          type: 'question',
          title: 'Question',
          content: (
            <div className="bg-secondary/20  p-4 rounded-lg shadow-sm">
              <p className="font-medium text-primary">{body.question}</p>
            </div>
          )
        });

        body.segments.forEach((segment, index) => {
          // Theme - Persistent
          newSections.push({
            type: 'theme',
            title: `Prompt: ${segment.theme}`,
            content: (
              <div className="bg-background border-2 border-primary/80 p-4 rounded-lg shadow-sm">
                <p className="font-medium text-primary">{segment.synthesis.prompt}</p>
              </div>
            )
          });

          // Exploration - Dynamic
          newSections.push({
            type: 'synthesis',
            title: 'Generated: ' + (segment.synthesis.type === 'dive' ? 'Deep Dive' : 'Gap Analysis'),
            content: (
              <div className="bg-secondary/5 border border-dashed rounded-md border-secondary/20 p-4 animate-[pulse_2s_ease-in-out_infinite] hover:border-opacity-100">
                <p>{segment.synthesis.analysis}</p>
              </div>
            )
          });

          // Sources - Dynamic
          newSections.push({
            type: 'docs',
            title: 'Related Notes',
            content: (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {segment.docs.map((doc, idx) => (
                  <div 
                    key={idx} 
                    className="bg-secondary/5 border border-dashed rounded-md cursor-pointer border-secondary/20 animate-[pulse_2s_ease-in-out_infinite] hover:border-opacity-100"
                    onClick={() => openInObsidian(doc.file)}
                  >
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-secondary/30">{doc.file}</span>
                        <button 
                          className="text-xs opacity-50 hover:opacity-100"
                        >
                          Open
                        </button>
                      </div>
                      <p className="text-xs line-clamp-3 text-primary/50">
                        {doc.content.length > 300 
                          ? `${doc.content.slice(0, 300)}...` 
                          : doc.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          });
        });

        setSections(newSections);
      } catch (error) {
        console.error('Error parsing structure:', error);
        setSections([{
          type: 'synthesis',
          title: 'Error',
          content: <p>Error parsing content</p>
        }]);
      }
    };

    parseAndSetSections();
  }, [body]);

  const ScheduleDialog = () => (
    <div className="absolute bottom-16 right-0 bg-background border border-primary/20 rounded-lg p-4 shadow-lg w-72">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">Frequency</label>
          <select 
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'weekly' | 'monthly')}
            className="w-full bg-secondary/5 border border-primary/20 rounded-md p-2 text-sm"
          >
            <option value="weekly">Once a week</option>
            <option value="monthly">Once a month</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">Start Date</label>
          <input 
            type="date"
            value={startDate.toISOString().split('T')[0]}
            onChange={(e) => setStartDate(new Date(e.target.value))}
            className="w-full bg-secondary/5 border border-primary/20 rounded-md p-2 text-sm"
          />
        </div>
        <div className="flex justify-end space-x-2">
          <button 
            onClick={() => setShowScheduler(false)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-secondary/10"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSchedule?.(frequency, startDate);
              setShowScheduler(false);
            }}
            className="px-3 py-1.5 text-sm bg-brand/70 hover:bg-brand/80 rounded-md"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );

  if (sections.length === 0) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-primary/20 bg-background/60 p-6 space-y-6',
        className
      )}
    >
      {sections.map((section, index) => (
        <div key={index}>
          <h3 className="text-sm font-medium mb-3">{section.title}</h3>
          <div className="prose prose-sm dark:prose-invert">
            {section.content}
          </div>
        </div>
      ))}
      <div className="relative flex justify-end mt-4 space-x-2">
        <button
          onClick={onRetry}
          className="flex items-center space-x-2 px-4 py-2 text-sm bg-secondary/20 hover:bg-secondary/30 rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
        <button
          onClick={() => setShowScheduler(!showScheduler)}
          className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand/70 hover:bg-brand/80 rounded-md transition-colors"
        >
          <Calendar className="w-4 h-4" />
          <span>Schedule Recipe</span>
        </button>
        {showScheduler && <ScheduleDialog />}
      </div>
    </div>
  );
});

SuggestedOutput.displayName = 'SuggestedOutput'; 