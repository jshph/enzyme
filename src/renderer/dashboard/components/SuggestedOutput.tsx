'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, Mail, RefreshCw, ChevronRight, Check, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useSettingsManager } from '../hooks/useSettingsManager.js';

interface SuggestedOutputProps {
  body: SuggestedOutputBody;
  className?: string;
  onEditPrompt: (id: number, prompt: string) => void;
  onSchedule?: (frequency: 'weekly' | 'monthly', startDate: Date) => void;
  onRetry?: () => void;
  onEmailButtonClick?: () => void;
  profileTypes?: { type: string; name: string }[];
}

interface OutputSection {
  type: 'docs' | 'question' | 'synthesis' | 'theme';
  title: React.ReactNode;
  content: React.ReactNode;
}

export interface BaseSegment {
  emoji: string;
  theme: string;
  synthesis: {
    type: string;
    prompt: string;
    analysis: string;
  };
  docs: {
    file: string;
    content: string;
  }[];
}

export interface SuggestedOutputBody {
  title: string;
  question: string;
  segments: BaseSegment[];
}

interface ButtonState {
  isLoading: boolean;
  isSuccess: boolean;
  message: string;
}

const InfoTooltip = ({ content }: { content: string }) => (
  <Tooltip.Provider delayDuration={200}>
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="inline-flex items-center ml-1 text-secondary/50 hover:text-secondary">
          <Info className="w-3.5 h-3.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className="max-w-xs bg-surface text-white px-3 py-2 rounded text-xs"
          sideOffset={5}
          side="right"
        >
          {content}
          <Tooltip.Arrow className="fill-surface" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);

export const SuggestedOutput = React.forwardRef<
  HTMLDivElement,
  SuggestedOutputProps
>(({ body, className, onEditPrompt, onSchedule, onRetry, onEmailButtonClick, profileTypes }, ref) => {
  const { isAuthenticated } = useAuth();
  const [sections, setSections] = useState<OutputSection[]>([]);
  const [showScheduler, setShowScheduler] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [expandedPrompts, setExpandedPrompts] = useState<number[]>([]);
  const [scheduleButtonState, setScheduleButtonState] = useState<ButtonState>({
    isLoading: false,
    isSuccess: false,
    message: 'Schedule Recipe'
  });
  const [emailButtonState, setEmailButtonState] = useState<ButtonState>({
    isLoading: false,
    isSuccess: false,
    message: 'Email me a copy'
  });
  const { settings } = useSettingsManager();
  
  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const openInObsidian = async (filePath: string) => {
    await window.electron.ipcRenderer.invoke('open-in-obsidian', filePath);
  };

  useEffect(() => {
    const parseAndSetSections = async () => {
      try {
        const newSections: OutputSection[] = [];

        if (!body || !body.segments) {
          console.warn('SuggestedOutput: Missing body or segments data', { body });
          setSections([]);
          return;
        }

        const trimVaultPath = (filePath: string) => {
          if (!settings.vaultPath) {
            console.warn('vaultPath is undefined in trimVaultPath');
            return filePath;
          }
          return filePath.replace(settings.vaultPath, '').replace(/^\/+/, '');
        };

        if (body.question) {
          newSections.push({
            type: 'question',
            title: 'Question',
            content: (
              <div className="bg-secondary/20 p-4 rounded-md shadow-sm">
                <p className="font-medium text-primary">{body.question}</p>
              </div>
            )
          });
        }

        body.segments.forEach((segment, index) => {
          if (!segment) {
            console.warn(`SuggestedOutput: Invalid segment at index ${index}`, segment);
            return;
          }

          if (segment.theme && segment.emoji) {
            newSections.push({
              type: 'theme',
              title: (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => togglePrompt(index)}
                    className="p-1 rounded hover:bg-secondary/10"
                  >
                    <ChevronRight 
                      className={`
                        w-4 h-4 transition-transform
                        ${expandedPrompts.includes(index) ? 'transform rotate-90' : ''}
                      `} 
                    />
                  </button>
                  <span className="text-md font-bold">
                    Topic: 
                    <span className="ml-2 px-3 py-1.5 rounded-full bg-brand/10 text-white">{segment.emoji} {segment.theme}</span>
                  </span>
                </div>
              ),
              content: (
                <div className="space-y-2">
                  {expandedPrompts.includes(index) && (
                    <div className="mt-2 border-l-2 ml-3 border-secondary/20 pl-4">
                      <div className="bg-secondary/5 p-4 rounded-md">
                        <h4 className="text-xs font-medium mb-2 text-secondary flex items-center">
                          Personalized Analysis Recipe
                          <InfoTooltip content="This is the prompt used to analyze your notes. It helps generate insights and connections between your ideas." />
                        </h4>
                        <p className="text-sm text-secondary/80">{segment.synthesis.prompt}</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            });
          }

          if (segment.synthesis?.type && segment.synthesis?.analysis) {
            newSections.push({
              type: 'synthesis',
              title: (
                <div className="flex items-center">
                  {profileTypes?.find(type => type.type === segment.synthesis.type)?.name || 'Analysis'}
                  <InfoTooltip content="Analysis generated by the engine from your most recent notes that mention the entities you selected." />
                </div>
              ),
              content: (
                <div className="bg-secondary/5 border border-dashed rounded-md border-secondary/20 p-4 hover:border-opacity-100 text-sm">
                  <p>{segment.synthesis.analysis}</p>
                </div>
              )
            });
          }

          if (segment.docs && segment.docs.length > 0) {
            newSections.push({
              type: 'docs',
              title: (
                <div className="flex items-center">
                  Related Notes
                  <InfoTooltip content="Click on any note to open it directly in Obsidian. These notes are related to the current topic and may provide additional context." />
                </div>
              ),
              content: (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {segment.docs.map((doc, idx) => (
                    <div 
                      key={idx} 
                      className="bg-secondary/5 border border-dashed rounded-md cursor-pointer border-secondary/20 hover:border-opacity-100"
                      onClick={() => openInObsidian(doc.file)}
                    >
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-secondary/30">{trimVaultPath(doc.file)}</span>
                          <button 
                            className="text-xs opacity-50 hover:opacity-100 flex items-center gap-1"
                          >
                            Open
                            <InfoTooltip content="Opens this note in your Obsidian vault. Make sure Obsidian is running and the vault is open." />
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
          }
        });

        if (newSections.length > 0) {
          setSections(newSections);
        } else {
          console.warn('SuggestedOutput: No valid sections generated', { body });
        }

      } catch (error) {
        console.error('Error parsing structure:', error);
        setSections([]);
      }
    };

    parseAndSetSections();
  }, [body, expandedPrompts, profileTypes, settings.vaultPath]);

  const showTemporarySuccess = (
    setState: (state: ButtonState) => void,
    successMessage: string,
    defaultMessage: string
  ) => {
    setState({ isLoading: false, isSuccess: true, message: successMessage });
    setTimeout(() => {
      setState({ isLoading: false, isSuccess: false, message: defaultMessage });
    }, 2000);
  };

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
            disabled={scheduleButtonState.isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              setScheduleButtonState({ isLoading: true, isSuccess: false, message: 'Scheduling...' });
              try {
                await onSchedule?.(frequency, startDate);
                showTemporarySuccess(
                  setScheduleButtonState,
                  'Scheduled!',
                  'Schedule Recipe'
                );
                setShowScheduler(false);
              } catch (error) {
                setScheduleButtonState({ 
                  isLoading: false, 
                  isSuccess: false, 
                  message: 'Failed to schedule' 
                });
                setTimeout(() => {
                  setScheduleButtonState({ 
                    isLoading: false, 
                    isSuccess: false, 
                    message: 'Schedule Recipe' 
                  });
                }, 2000);
              }
            }}
            disabled={scheduleButtonState.isLoading || scheduleButtonState.isSuccess}
            className={`
              px-3 py-1.5 text-sm rounded-md flex items-center gap-2
              ${scheduleButtonState.isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-brand/70 hover:bg-brand/80"}
              ${scheduleButtonState.isLoading && "opacity-50 cursor-wait"}
            `}
          >
            {scheduleButtonState.isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : scheduleButtonState.isSuccess ? (
              <Check className="w-4 h-4" />
            ) : null}
            <span>{scheduleButtonState.message}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (sections.length === 0) return null;

  return (
    <div
      ref={ref}
      className={`
        rounded-lg border border-primary/20 bg-background/60 p-6 space-y-6
        ${className || ''}
      `}
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
          disabled={!isAuthenticated || scheduleButtonState.isLoading || scheduleButtonState.isSuccess}
          className={`
            flex items-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors
            ${scheduleButtonState.isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-brand/70 hover:bg-brand/80"}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {scheduleButtonState.isSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
          <span>{scheduleButtonState.message}</span>
        </button>
        {showScheduler && <ScheduleDialog />}
        
        <button
          disabled={!isAuthenticated || emailButtonState.isLoading || emailButtonState.isSuccess}
          onClick={async () => {
            setEmailButtonState({ isLoading: true, isSuccess: false, message: 'Sending...' });
            try {
              await onEmailButtonClick?.();
              showTemporarySuccess(
                setEmailButtonState,
                'Email sent!',
                'Email me a copy'
              );
            } catch (error) {
              setEmailButtonState({ 
                isLoading: false, 
                isSuccess: false, 
                message: 'Failed to send' 
              });
              setTimeout(() => {
                setEmailButtonState({ 
                  isLoading: false, 
                  isSuccess: false, 
                  message: 'Email me a copy' 
                });
              }, 2000);
            }
          }}
          className={`
            flex items-center space-x-2 px-4 py-2 text-sm rounded-md transition-colors
            ${emailButtonState.isSuccess ? "bg-green-600 hover:bg-green-700" : "bg-secondary/20 hover:bg-secondary/30"}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {emailButtonState.isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : emailButtonState.isSuccess ? (
            <Check className="w-4 h-4" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
          <span>{emailButtonState.message}</span>
        </button>
      </div>
    </div>
  );
});

SuggestedOutput.displayName = 'SuggestedOutput'; 