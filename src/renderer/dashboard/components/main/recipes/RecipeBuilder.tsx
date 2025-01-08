import { useCallback, useRef, useState, useEffect } from "react";
import { SuggestedOutput, SuggestedOutputBody } from "../../SuggestedOutput";
import { useSettingsContext } from "@renderer/dashboard/contexts/SettingsContext";
import NoteTimeline from './NoteTimeline';
import debounce from 'lodash/debounce';
import { useAuth } from '../../../contexts/AuthContext';
import { GraphView, GraphViewRef, DocumentNode, MentionNode } from "../../GraphView";
import path from 'path';
import * as d3 from 'd3';

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


  // TODO figure out how to get the entire contents of the editor and not just the selection

  const [trendingData, setTrendingData] = useState<any>(null);
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntitiesMap>(new Map());
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEntity, setDraggedEntity] = useState<{type: 'tag' | 'link', name: string, element: HTMLElement} | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);

  const DEFAULT_COUNT = 30;

  const dragCountRef = useRef<number>(0);
  const wasRecentlyDragging = useRef(false);

  const selectedIdsRef = useRef<Set<string>>(new Set());
  const contextDocsRef = useRef<Map<string, {contents: string, extractedContents: string[]}>>(new Map());


  // Add this helper function to keep selectedIdsRef in sync
  const updateSelectedEntity = useCallback((name: string, doAdd: boolean) => {
    setSelectedEntities(prev => {
      const next = new Map(prev);
      if (doAdd) {
        next.set(name, { 
          type: name.startsWith('#') ? 'tag' : 'link', 
          count: DEFAULT_COUNT 
        });
        selectedIdsRef.current.add(name);
      } else {
        next.delete(name);
        selectedIdsRef.current.delete(name);
        // Remove the deselected node and its connections from the graph
        graphViewRef.current?.removeNodesAndLinks(name);
      }
      return next;
    });
  }, []);

  // Add this function to process context into graph data
  const processContextForGraph = useCallback((context: any[], selectedEntities: SelectedEntitiesMap) => {
    if (!graphViewRef.current) return;

    const documents: DocumentNode[] = [];
    const mentions: MentionNode[] = [];
    const links: {source: string, target: string}[] = [];
    
    // Track all mentions found in docs
    const mentionsInDocs = new Set<string>();

    // Process each document from context
    context.forEach(({file, extractedContents}) => {
      // Store context for later reference
      contextDocsRef.current.set(file, {contents: '', extractedContents});
      
      // Create document node
      const docNode: DocumentNode = {
        id: file,
        summary: path.basename(file),
        links: [],
        type: 'document'
      };
      documents.push(docNode);

      // Process extracted contents for mentions
      extractedContents.forEach(content => {
        // Find tags
        const tagMatches = content.match(/#[\w-\/]+/g) || [];
        tagMatches.forEach(tag => {
          mentionsInDocs.add(tag);
          links.push({source: file, target: tag});
        });

        // // Find links
        // const linkMatches = content.match(/\[\[([^\]]+)\]\]/g) || [];
        // linkMatches.forEach(link => {
        //   const cleanLink = link.replace(/[\[\]]/g, '');
        //   mentionsInDocs.add(`[[${cleanLink}]]`);
        //   links.push({source: file, target: `[[${cleanLink}]]`});
        // });
      });
    });

    // Add nodes for selected entities that weren't found in docs
    // selectedEntities.forEach((entity, name) => {
    //   if (!mentionsInDocs.has(name)) {
    //     mentions.push({
    //       id: name,
    //       text: name
    //     });
    //   }
    // });

    // Add nodes for mentions found in docs
    mentionsInDocs.forEach(mention => {
      mentions.push({
        id: mention,
        text: mention,
        type: 'mention'
      });
    });

    // Update the graph
    graphViewRef.current.addToSimulation(links, documents, mentions);
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

      const query = Array.from(updatedEntities.entries())
        .map(([name, { count }]) => `${name}<${count}`)
        .join(' ');

      const context = await window.electron.ipcRenderer.invoke('get-context', query);
      const limitedContext = context.slice(0, 30);

      // Create graph data from context
      const documents = limitedContext.map(({file, extractedContents}) => ({
        id: file,
        summary: path.basename(file),
        links: [],
        type: 'document'
      }));

      const mentions = [{
        id: name,
        text: name,
        type: 'mention'
      }];

      const links = limitedContext.map(({file}) => ({
        source: name,
        target: file
      }));

      // Update graph with new data
      graphViewRef.current?.addToSimulation(links, documents, mentions);

      // Update the count of the entity
      updateEntityCount(type, name, 30);
    } else {
      // If removing, use removeNodesAndLinks
      graphViewRef.current?.removeNodesAndLinks(name);
    }
  }, [selectedEntities, updateSelectedEntity]);

  // Update updateEntityCount to handle graph updates
  const updateEntityCount = async (type: 'tag' | 'link', name: string, count: number) => {
    setSelectedEntities(prev => {
      const next = new Map(prev);
      next.set(name, { type, count });
      return next;
    });
    
    // Make sure the entity is in selectedIdsRef
    if (!selectedIdsRef.current.has(name)) {
      selectedIdsRef.current.add(name);
    }
    
    // Update node visibility with the new count
    graphViewRef.current?.updateNodesSelected([name], count);

    // Fetch new context with updated count
    const query = Array.from(selectedEntities.entries())
      .map(([entityName, entity]) => 
        `${entityName}<${entityName === name ? count : entity.count}`
      )
      .join(' ');

    const context = await window.electron.ipcRenderer.invoke('get-context', query);
    const limitedContext = context.slice(0, count);

    // Create graph data from context
    const documents = limitedContext.map(({file, extractedContents}) => ({
      id: file,
      summary: path.basename(file),
      links: [],
      type: 'document'
    }));

    // Update graph with new data - no new mentions needed since they already exist
    const links = limitedContext.map(({file}) => ({
      source: name,
      target: file
    }));

    graphViewRef.current?.addToSimulation(links, documents, []);
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

  // Check generation limits on mount and auth change
  useEffect(() => {
    window.electron.ipcRenderer.invoke('check-generation-limits')
      .then(({ remaining }) => {
        setGenerationsRemaining(Math.max(0, remaining));
      })
      .catch(() => {
        // If there's an error, set to 0 to maintain consistent type
        setGenerationsRemaining(0);
      });
  }, [isAuthenticated]);

  const submitPrompt = useCallback(async () => {
    if (selectedEntities.size === 0) return;
    
    setAwaitingFirstToken(true);

    try {
      const query = makeQuery();
      const context = await window.electron.ipcRenderer.invoke('get-context', query);

      // Process context for graph visualization
      processContextForGraph(context, selectedEntities);

      // Set up listener for chunks
      const handleChunk = ({chunk, done}: {chunk: any, done: boolean}) => {
        if (!chunk || !chunk.question || !chunk.segments) return;
        setAwaitingFirstToken(false);
        if (done) {
          window.electron.ipcRenderer.removeListener('suggested-output-chunk', handleChunk);
        }


        setSuggestedOutputs(_ => {
          const body: SuggestedOutputBody = {
            question: chunk.question,
            segments: chunk.segments?.map((segment, index) => ({
              theme: segment.theme,
              synthesis: {
                id: index,
                prompt: segment.prompt,
                type: segment.type,
                analysis: segment.analysis
              },
              docs: segment.docs?.map(doc => {
                const contextItem = context.find(result => result.file === doc);
                const adjoinedContents = contextItem ? contextItem.extractedContents.join('\n') : '';
                return {
                  file: doc,
                  content: adjoinedContents
                }
              }) || []
            })) || []
          };

          return [body];
        });
      };

      window.electron.ipcRenderer.on('suggested-output-chunk', handleChunk);

      window.electron.ipcRenderer.invoke('generate-suggested-output', { 
        context, 
        query,
        profileId: selectedProfile
      });
    } catch (error) {
      console.error('Error generating recipe:', error);
      new Notification('Error', {
        body: "Failed to generate recipe. Please try again."
      });
    }
  }, [selectedEntities, selectedProfile, processContextForGraph]);

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
    if (!isDragging || !draggedEntity) return;
    
    const numberElement = draggedEntity.element;
    if (!numberElement) return;
    
    const numberRect = numberElement.getBoundingClientRect();
    const pixelsPerUnit = 12;
    const centerX = numberRect.left + (numberRect.width / 2);
    const deltaX = e.clientX - centerX;
    
    const countDelta = Math.floor(deltaX / pixelsPerUnit);
    const newCount = Math.max(1, Math.min(30, DEFAULT_COUNT + countDelta));
    
    // Update ref for immediate visual feedback
    dragCountRef.current = newCount;
    numberElement.textContent = newCount.toString();
    
    // Use debounced update instead
    const updatedEntities = new Map(selectedEntities);
    updatedEntities.set(draggedEntity.name, { type: draggedEntity.type, count: newCount });
    updateTimelineDebounced(Array.from(updatedEntities.entries()));
  };

  // Create a single handler for ending drags
  const handleDragEnd = useCallback(() => {
    if (draggedEntity && dragCountRef.current) {
      updateEntityCount(draggedEntity.type, draggedEntity.name, dragCountRef.current);
      wasRecentlyDragging.current = true;
      
      // Reset the flag after a short delay
      setTimeout(() => {
        wasRecentlyDragging.current = false;
      }, 100);
    }
    setIsDragging(false);
    setDraggedEntity(null);
    dragCountRef.current = 0;
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

  return (
    <>
      <div
        className="space-y-6 py-4"
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
                
                return (
                  <div 
                    key={index}
                    className={`ingredient-pill group relative px-5 py-2 rounded-full shadow-sm transition-all select-none bg-brand/30
                      ${isSelected ? 'pl-2 pr-8 bg-brand/60' : ''}
                      ${isDragging && draggedEntity?.name === ingredient.name ? 'cursor-grabbing pl-2 pr-8' : ''}
                      ${isDragging && draggedEntity?.name !== ingredient.name ? 'opacity-80' : ''}
                      ${!isDragging ? 'hover:bg-brand/50 cursor-pointer' : ''}
                      `
                    }
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

        <div className="w-full h-full overflow-hidden relative">
          <div className="flex items-center flex-col relative">
            <div className="flex-grow relative h-[800px] w-[800px]">
              <GraphView
                ref={graphViewRef}
                width={800}
                height={800}
                selectedIdsRef={selectedIdsRef}
              />
            </div>
          </div>
        </div>

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
            disabled={!hasVaultInitialized || selectedEntities.size === 0 || awaitingFirstToken || generationsRemaining === 0}
            className="bg-brand/40 py-2.5 px-4 text-sm rounded-md shadow-md cursor-pointer hover:bg-brand/60 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            onClick={submitPrompt}
          >
            {awaitingFirstToken ? 'Generating...' : 
              generationsRemaining !== null ? 
                `Generate Recipe (${generationsRemaining} left ${isAuthenticated ? 'this week' : 'today'})` : 
                'Generate Recipe'}
          </button>
        </div>
        <p className="text-sm text-primary/50">Discover emerging themes and connections from selected ingredients. Creates a structured synthesis while preserving links to source notes.</p>


        {/* Output section */}
        {(suggestedOutputs?.[0]?.segments?.length || 0 > 0 || awaitingFirstToken) && (
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

        {awaitingFirstToken && (
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