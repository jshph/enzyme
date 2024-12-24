'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@udecode/cn';

interface SuggestedOutputProps {
  body: SuggestedOutputBody;
  className?: string;
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
>(({ body, className }, ref) => {
  const [sections, setSections] = useState<OutputSection[]>([]);

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
            <div className="bg-background border-2 border-primary/20 p-4 rounded-lg shadow-sm">
              <p className="font-medium text-primary">{body.question}</p>
            </div>
          )
        });

        body.segments.forEach((segment) => {
          // Theme - Persistent
          newSections.push({
            type: 'theme',
            title: segment.theme,
            content: (
              <div className="bg-background border-2 border-primary/20 p-4 rounded-lg shadow-sm">
                <p className="font-medium text-primary">{segment.theme}</p>
              </div>
            )
          });

          // Exploration - Dynamic
          newSections.push({
            type: 'synthesis',
            title: segment.synthesis.type === 'dive' ? 'Deep Dive' : 'Gap Analysis',
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
                        <span className="text-xs text-muted-foreground">{doc.file}</span>
                        <button 
                          className="text-xs opacity-50 hover:opacity-100"
                        >
                          Open
                        </button>
                      </div>
                      <p className="text-sm line-clamp-3">
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

  if (sections.length === 0) return null;

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-background p-6 space-y-6',
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
    </div>
  );
});

SuggestedOutput.displayName = 'SuggestedOutput'; 