import { SuggestedOutput, SuggestedOutputBody } from "../../SuggestedOutput.js";
import { useSettingsContext } from "@renderer/dashboard/contexts/SettingsContext.js";
import NoteTimeline from './NoteTimeline.js';
import debounce from 'lodash/debounce';
import { useAuth } from '../../../contexts/AuthContext.js';
import { GraphView, GraphViewRef } from "../../GraphView.js";
import path from 'path';
import { useState, useRef, useEffect, useCallback } from 'react';

interface SelectedEntity {
  type: 'tag' | 'link';
  count: number;
}

type SelectedEntitiesMap = Map<string, SelectedEntity>;

interface TimelineItem {
  date: Date;
  type: 'tag' | 'link';
  name: string;
}

type Ingredient = {
  type: 'tag' | 'link';
  name: string;
};

const GENERATION_TIMEOUT_MS = 30000; // 30 seconds
const FIRST_TOKEN_TIMEOUT_MS = 30000; // 30 seconds for first token

type GenerationState = 
  | { status: 'idle' }
  | { status: 'awaiting_first_token' }
  | { status: 'generating' }
  | { status: 'error'; error: string }
  | { status: 'completed' };

const RecipeBuilder: React.FC<{ currentView: string}> = ({ currentView }) => {
  // const editor = useCreateEditor();
  const { hasVaultInitialized } = useSettingsContext();
  const { isAuthenticated } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([{ id: 'selfReflection', name: 'Self Reflection', description: 'Focus on personal growth and insight development' }]);
  const [selectedProfile, setSelectedProfile] = useState('selfReflection');
  const [selectedProfileTypes, setSelectedProfileTypes] = useState<any[]>([]);
  const graphViewRef = useRef<GraphViewRef>(null);

  useEffect(() => {
    window.electron.ipcRenderer.invoke('get-profiles')
      .then(profiles => {
        setProfiles(profiles);
        setSelectedProfileTypes(profiles.find(profile => profile.id === selectedProfile)?.types || []);
      });
  }, []);

  const [trendingData, setTrendingData] = useState<any>(null);
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntitiesMap>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEntity, setDraggedEntity] = useState<{type: 'tag' | 'link', name: string, element: HTMLElement} | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);

  const DEFAULT_COUNT = 10;
  const DEFAULT_CONTEXT_RECALL = 30;

  const dragCountRef = useRef<number>(0);
  const wasRecentlyDragging = useRef(false);

  const [selectedMentionDocCounts, setSelectedMentionDocCounts] = useState<Map<string, number>>(new Map());

  const [dragHaloProps, setDragHaloProps] = useState<{
    intensity: number;
    direction: 'left' | 'right' | null;
  } | null>(null);

  // Add this helper function to keep selectedIdsRef in sync
  const updateSelectedEntity = useCallback((name: string, doAdd: boolean) => {
    setSelectedEntities(prev => {
      const next = new Map(prev);
      if (doAdd) {
        next.set(name, { 
          type: name.startsWith('#') ? 'tag' : 'link', 
          count: DEFAULT_COUNT 
        });
        initializeDocCountForMention(name);
      } else {
        next.delete(name);
        updateDocCountForMention(name, 0);
        graphViewRef.current?.removeNodesAndLinks(name);
      }
      return next;
    });
  }, []);

  const fetchTrendingData = async () => {
    const result = await window.electron.ipcRenderer.invoke('trending-data-update');
    // Format the tags and links with the # and [[ ]]
    const formattedTags = result.tags.map(tag => ({ 
      type: 'tag', 
      name: `#${tag.name}`,
      timeline: tag.timeline 
    }));
    const formattedLinks = result.links.map(link => ({ 
      type: 'link', 
      name: `[[${link.name}]]`,
      timeline: link.timeline 
    }));
    setTrendingData({ tags: formattedTags, links: formattedLinks });
  };

  useEffect(() => {
    if (hasVaultInitialized && currentView === 'recipes') {
      fetchTrendingData();
    }
  }, [currentView, hasVaultInitialized]);

  const [suggestedOutputs, setSuggestedOutputs] = useState<SuggestedOutputBody[]>();

  // Update toggleEntity to use the helper and handle context updates
  const toggleEntity = useCallback(async (type: 'tag' | 'link', name: string) => {
    const isAdding = !selectedEntities.has(name);
    updateSelectedEntity(name, isAdding);

    // Only fetch new context if we're adding an entity
    if (isAdding) {
      const updatedEntities = new Map(selectedEntities);
      updatedEntities.set(name, { type, count: DEFAULT_COUNT });

      // const query = Array.from(updatedEntities.keys())
      //   .map(name => `${name}<${DEFAULT_CONTEXT_RECALL}`)
      //   .join(' ');

      const query = `${name}<${DEFAULT_CONTEXT_RECALL}`;

      const context = await window.electron.ipcRenderer.invoke('get-context', query);

      if (context.length === 0) {
        console.error('No context found');
        return;
      }

      // Create graph data from context
      const documents = context.map(({file}) => ({
        id: file,
        type: 'document',
        name: path.basename(file)
      }));

      // Add the current entity as a mention node first
      const mentions = [{
        id: name,
        type: 'mention',
        name: name
      }, ...context.flatMap(({tags, links}) => 
        [
          ...tags.map(tag => ({
            id: tag,
            type: 'mention',
            name: tag
          })),
          // ...links.map(link => ({
          //   id: link,
          //   type: 'mention',
          //   name: link
          // }))
        ]
      )];

      const links = context.flatMap(({file, tags, links}) => {
        const tagLinks = tags.map(tag => ({
          source: file,
          target: tag
        }));

        // const linkLinks = links.map(link => ({
        //   source: file,
        //   target: link
        // }));

        return [{
          source: name,
          target: file
        }, ...tagLinks];
        // ...linkLinks];
      });
      
      // Update graph with new data
      graphViewRef.current?.addToSimulation(
        links, 
        documents,
        mentions
      );

      // Update the count of the entity
      initializeDocCountForMention(name);
    } else {
      // If removing, use removeNodesAndLinks
      graphViewRef.current?.removeNodesAndLinks(name);
      // and remove it from selectedEntities
      setSelectedEntities(prev => {
        const next = new Map(prev);
        next.delete(name);
        return next;
      });
      setSelectedMentionDocCounts(prev => {
        const next = new Map(prev);
        next.delete(name);
        return next;
      });
    }
  }, [selectedEntities, updateSelectedEntity]);

  const initializeDocCountForMention = (mention: string) => {
    updateDocCountForMention(mention, DEFAULT_COUNT);
  }

  // Update updateEntityCount to handle graph updates
  const updateDocCountForMention = async (mention: string, count: number) => {
    setSelectedMentionDocCounts(prev => {
      const next = new Map(prev);
      next.set(mention, count);
      return next;
    });
    
    // TODO not neeeded?
    // // Update node visibility with the new count
    // graphViewRef.current?.updateDocCountForMention(mention, count);
  };

  const updateSegmentPrompt = (id: number, prompt: string) => {
    if (!suggestedOutputs || !suggestedOutputs.length) return;
    setSuggestedOutputs(prev => {
      if (!prev) return suggestedOutputs;
      
      const newOutputs = prev.map(output => ({
        ...output,
        segments: output.segments.map((segment, index) => index === id ? { ...segment, prompt } : segment)
      }));
      return newOutputs;
    });
  };
  
  const makeQuery = () => {
    return Array.from(selectedEntities.entries()).map(([name, { count }]) => `${name}<${count}`).join(' ');
  }

  const [generationsRemaining, setGenerationsRemaining] = useState(0);
  const [generationState, setGenerationState] = useState<GenerationState>({ status: 'idle' });


  // Check generation limits on mount and auth change
  const checkGenerationLimits = useCallback(() => {
    window.electron.ipcRenderer.invoke('check-generation-limits')
      .then(({ remaining }) => {
        setGenerationsRemaining(Math.max(0, remaining));
      })
      .catch(() => {
        // If there's an error, set to 0 to maintain consistent type
        setGenerationsRemaining(0);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    checkGenerationLimits();
  }, [checkGenerationLimits, isAuthenticated, generationState]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const generationContextRef = useRef<any[]>([]);

  // Add a timeout effect to reset stuck states
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (generationState.status === 'generating' || generationState.status === 'awaiting_first_token') {
      timeoutId = setTimeout(() => {
        setGenerationState({ 
          status: 'error', 
          error: 'Generation timed out. Please try again.' 
        });
      }, GENERATION_TIMEOUT_MS);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [generationState.status]);

  // Update handleGenerationChunk to be more defensive and immediate with state changes
  const handleGenerationChunk = useCallback(({chunk, done, error}: {chunk: any, done?: boolean, error?: string}) => {
    if (error) {
      console.error('Generation error:', error);
      setGenerationState({ status: 'error', error });
      return;
    }

    if (done) {
      console.log('Generation completed');
      setGenerationState({ status: 'completed' });
      return;
    }

    // Only process chunk if we have valid data and context
    if (chunk?.question || chunk?.segments) {
      setGenerationState({ status: 'generating' });
      setSuggestedOutputs(prev => {
        const body: SuggestedOutputBody = {
          title: chunk.title,
          question: chunk.question,
          segments: chunk.segments?.map((segment, index) => ({
            theme: segment.theme,
            emoji: segment.emoji,
            synthesis: {
              id: index,
              prompt: segment.prompt,
              type: segment.type,
              analysis: segment.analysis
            },
            docs: segment.docs?.map(doc => {
              const contextItem = generationContextRef.current.find(result => result.file === doc);
              if (!contextItem) {
                console.warn(`No context found for file: ${doc}`);
                return {
                  file: doc,
                  content: ''
                };
              }
              return {
                file: doc,
                content: contextItem.extractedContents.join('\n')
              };
            }) || []
          })) || []
        };
        return [body];
      });
    }
  }, []);

  const submitPrompt = useCallback(async () => {
    if (selectedEntities.size === 0) return;

    // Reset states
    setGenerationState({ status: 'awaiting_first_token' });
    setSuggestedOutputs(undefined);
    generationContextRef.current = [];

    // Create new AbortController
    abortControllerRef.current = new AbortController();

    try {
      const query = makeQuery();
      const context = await window.electron.ipcRenderer.invoke('get-context', query);

      if (context.length === 0) {
        console.error('No context found');
        return;
      }

      generationContextRef.current = context;

      // Only set up first token timeout
      const firstTokenTimeout = setTimeout(() => {
        if (generationState.status === 'awaiting_first_token') {
          abortControllerRef.current?.abort('First token timeout');
          setGenerationState({ 
            status: 'error', 
            error: 'Generation failed to start after 30 seconds' 
          });
          cleanup();
          console.warn('Recipe generation failed to produce first token after 30 seconds');
        }
      }, FIRST_TOKEN_TIMEOUT_MS);

      // Cleanup function
      const cleanup = () => {
        window.electron.ipcRenderer.removeAllListeners('suggested-output-chunk');
        clearTimeout(firstTokenTimeout);
        setGenerationState({ status: 'idle' });
      };

      window.electron.ipcRenderer.on('suggested-output-chunk', handleGenerationChunk);

      // Make the generation request with abort signal
      await window.electron.ipcRenderer.invoke('generate-suggested-output', { 
        context, 
        query,
        profileId: selectedProfile,
        signal: abortControllerRef.current.signal
      });

    } catch (error) {
      console.error('Error generating recipe:', error);
      setGenerationState({ 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      new Notification('Error', {
        body: "Failed to generate recipe. Please try again."
      });
    }
  }, [selectedEntities, selectedProfile, generationState, handleGenerationChunk, makeQuery]);

  const handleEmailRecipeOutput = async () => {
    await window.electron.ipcRenderer.invoke('email-recipe-output', suggestedOutputs);
  }

  const handleScheduleRecipe = async (frequency: 'weekly' | 'monthly', startDate: Date) => {
    try {
      if (!suggestedOutputs?.[0]) {
        throw new Error('No recipe generated yet');
      }

      // Create recipe with the full structure
      await window.electron.ipcRenderer.invoke('create-recipe', {
        frequency,
        startDate,
        entities: makeQuery(),
        profile: selectedProfile,
        recipe: {
          question: suggestedOutputs[0].question,
          segments: suggestedOutputs[0].segments.map(segment => ({
            theme: segment.theme,
            type: segment.synthesis.type,
            prompt: segment.synthesis.prompt
          })),
        }
      });

      // Show success notification
      // TODO: Add notification system
    } catch (error) {
      console.error('Error scheduling recipe:', error);
      // Show error notification
      // TODO: Add notification system
    }
  };

  const handleRetry = useCallback(async () => {
    await submitPrompt();
  }, [submitPrompt]);

  // Create debounced timeline update function
  const updateTimelineDebounced = useCallback(
    debounce((entities: Array<[string, { type: 'tag' | 'link'; count: number }]>) => {
      window.electron.ipcRenderer.invoke('get-entity-timeline', entities)
        .then(newTimelineData => {
          setTimelineData(newTimelineData);
        });
    }, 50),
    []
  );

  const handleMouseMove = (
    e: React.MouseEvent,
    draggedEntity: {type: 'tag' | 'link', name: string, element: HTMLElement} | null
  ) => {
    if (!isDragging || !draggedEntity) {
      setDragHaloProps(null);
      return;
    }
    
    const numberElement = draggedEntity.element;
    if (!numberElement) return;
    
    const numberRect = numberElement.getBoundingClientRect();
    const pixelsPerUnit = 5;
    const centerX = numberRect.left + (numberRect.width / 2);
    const deltaX = e.clientX - centerX;
    
    const countDelta = Math.floor(deltaX / pixelsPerUnit);
    const newCount = Math.max(1, Math.min(30, DEFAULT_COUNT + countDelta));
    
    // Update ref for immediate visual feedback
    dragCountRef.current = newCount;
    numberElement.textContent = newCount.toString();

    // Calculate halo properties
    const intensity = Math.min(Math.abs(deltaX) / 100, 0.3);
    setDragHaloProps({
      intensity,
      direction: deltaX < 0 ? 'left' : 'right'
    });
    
    // Use debounced update instead
    const updatedEntities = new Map(selectedEntities);
    updatedEntities.set(draggedEntity.name, { type: draggedEntity.type, count: newCount });
    updateTimelineDebounced(Array.from(updatedEntities.entries()));
  };

  // Create a single handler for ending drags
  const handleDragEnd = useCallback(() => {
    if (draggedEntity && dragCountRef.current) {
      updateDocCountForMention(draggedEntity.name, dragCountRef.current);
      wasRecentlyDragging.current = true;
      
      setTimeout(() => {
        wasRecentlyDragging.current = false;
      }, 100);
    }
    setIsDragging(false);
    setDraggedEntity(null);
    dragCountRef.current = 0;
    setDragHaloProps(null);
  }, [draggedEntity]);

  // Update timeline when entities change
  useEffect(() => {
    if (selectedEntities.size === 0) {
      setTimelineData([]);
      return;
    }

    window.electron.ipcRenderer.invoke('get-entity-timeline', 
      Array.from(selectedEntities.entries())
    ).then(newTimelineData => {
      setTimelineData(newTimelineData);
    });
  }, [selectedEntities]);

  const handleProfileChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProfileId = e.target.value;
    setSelectedProfile(newProfileId);
    const newProfile = profiles.find(profile => profile.id === newProfileId);
    setSelectedProfileTypes(newProfile?.types || []);
  }, [profiles]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <>
      <div
        className="space-y-6 py-4 relative"
        onMouseMove={(e) => handleMouseMove(e, draggedEntity)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Header section */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-primary/90">Create a recipe</h2>
          <p className="text-sm text-primary/50">Discover patterns in your vault through lightweight, customizable recipes.<br/>Select ingredients below to define your recipe's scope and surface relevant connections.</p>
        </div>

        {/* Recipe builder section */}
        <div className="space-y-4">
          <div className="justify-between">
            <h3 className="text-lg font-semibold text-primary/90">Ingredients</h3>
          </div>
        </div>

        {/* Suggested ingredients section */}
        {trendingData && (
          <div className="space-y-3">
            <div 
              className="flex flex-wrap gap-2 text-xs"
            >
              {[...trendingData.tags, ...trendingData.links].map((ingredient: Ingredient, index) => {
                const selectedEntity = selectedEntities.get(ingredient.name);
                const isSelected = !!selectedEntity;
                const isBeingDragged = isDragging && draggedEntity?.name === ingredient.name;
                
                // Calculate gradient for halo effect
                let gradientStyle = '';
                if (isBeingDragged && dragHaloProps) {
                  const { intensity, direction } = dragHaloProps;
                  
                  if (direction === 'right') {
                    gradientStyle = `linear-gradient(90deg, rgb(54, 62, 89) 0%, rgb(112, 127, 179) ${intensity * 300}%)`;
                  } else {
                    gradientStyle = `linear-gradient(270deg, rgb(54, 62, 89) 0%, rgb(112, 127, 179) ${intensity * 300}%)`;
                  }
                }
                
                return (
                  <div 
                    key={index}
                    className={`ingredient-pill group relative px-5 py-2 rounded-full shadow-sm transition-all select-none bg-brand/30
                      ${isSelected ? 'pl-2 pr-8 bg-brand/60' : ''}
                      ${isBeingDragged ? 'cursor-grabbing pl-2 pr-8' : ''}
                      ${isDragging && !isBeingDragged ? 'opacity-80' : ''}
                      ${!isDragging ? 'hover:bg-brand/50 cursor-pointer' : ''}
                    `}
                    style={{
                      background: isBeingDragged && gradientStyle ? gradientStyle : undefined,
                    }}
                    onMouseDown={(e) => {
                      // Prevent text selection during dragging
                      e.preventDefault();
                    }}
                    onClick={(e) => {
                      // Check the ref instead of the state
                      if (!wasRecentlyDragging.current) {
                        toggleEntity(ingredient.type, ingredient.name);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>
                        {ingredient.name}
                      </span>
                        <div 
                          className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center
                            min-w-[24px] h-6 rounded-full
                            cursor-grab active:cursor-grabbing opacity-0 px-1.5 py-0.25 bg-background/5 border border-brand/50
                            ${isSelected ? 'opacity-100' : ''}
                          `
                          }
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            wasRecentlyDragging.current = false;
                            setDraggedEntity({ 
                              type: ingredient.type, 
                              name: ingredient.name, 
                              element: e.currentTarget 
                            });
                            setIsDragging(true);
                          }}
                        >
                          <span>
                            {selectedEntity?.count || DEFAULT_COUNT}
                          </span>
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <NoteTimeline timelineData={timelineData} />

        {selectedEntities.size > 0 && (
          <div className="w-full h-full overflow-hidden relative">
            <div className="flex items-center flex-col relative">
              <div className="flex-grow relative h-[650px] w-[800px]">
              <GraphView
                ref={graphViewRef}
                width={800}
                height={600}
                selectedMentionDocCounts={selectedMentionDocCounts}
              />
            </div>
            </div>
          </div>
        )}

        <div className="flex justify-normal items-center space-y-2">
          {/* Add Profile selector */}
          <div className="space-y-2">
            <label htmlFor="profile-select" className="block text-lg font-semibold text-primary/90">
              Choose a recipe profile
            </label>
            <select
              id="profile-select"
              value={selectedProfile}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 bg-background/40 rounded-lg shadow-sm border border-primary/20 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <button
            disabled={!hasVaultInitialized || 
              selectedEntities.size === 0 || 
              generationState.status === 'generating' || 
              generationState.status === 'awaiting_first_token' || 
              generationsRemaining === 0}
            className={`
              bg-brand/40 py-2.5 px-4 text-sm rounded-md shadow-md 
              cursor-pointer hover:bg-brand/60 transition-colors font-medium 
              disabled:opacity-50 disabled:cursor-not-allowed ml-4
              ${generationState.status === 'generating' || generationState.status === 'awaiting_first_token' ? 'animate-pulse' : ''}
            `}
            onClick={submitPrompt}
          >
            {generationState.status === 'generating' || generationState.status === 'awaiting_first_token' ? 'Generating...' : 
              generationsRemaining !== null ? 
                `Generate Recipe (${generationsRemaining} left ${isAuthenticated ? 'this week' : 'today'})` : 
                'Generate Recipe'}
          </button>
        </div>
        <p className="text-sm text-primary/50">Discover emerging themes and connections from selected ingredients. Creates a structured synthesis while preserving links to source notes.</p>


        {/* Output section */}
        {((suggestedOutputs?.[0]?.segments?.length || 0 > 0 || 
           generationState.status === 'generating') && 
           generationState.status !== 'awaiting_first_token') && (
          <div className="mt-8 space-y-4">
            <div className="gap-4">
              <SuggestedOutput
                body={suggestedOutputs?.[0]}
                onEditPrompt={updateSegmentPrompt}
                onSchedule={handleScheduleRecipe}
                onRetry={handleRetry}
                onEmailButtonClick={handleEmailRecipeOutput}
                profileTypes={selectedProfileTypes}
              />
            </div>
          </div>
        )}

        {generationState.status === 'error' && (
          <p className="text-red-500 text-sm mt-2">{generationState.error}</p>
        )}

        {generationState.status === 'awaiting_first_token' && (
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
            </div>
          </div>
        )}

        {suggestedOutputs && !isAuthenticated && (
          <div className="mt-4 p-4 bg-brand/10 rounded-lg">
            <p className="text-sm text-primary/70">
              Log in to save recipes and schedule automated insights from your notes.
            </p>
          </div>
        )}
      </div>
    </>
  )
}

export default RecipeBuilder;