import { useCallback, useRef, useState, useEffect } from "react";
import { SuggestedOutput, SuggestedOutputBody } from "../../plate-ui/suggested-output";
import { useSettingsContext } from "@renderer/dashboard/contexts/SettingsContext";
import NoteTimeline from './NoteTimeline';
import debounce from 'lodash/debounce';

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

const profiles = {
  selfReflection: 'Self Reflection',
  projectManagement: 'Project Management',
  relationshipManagement: 'Relationship & Team Management'
}

type Ingredient = {
  type: 'tag' | 'link';
  name: string;
};

const RecipeBuilder: React.FC<{ currentView: string}> = ({ currentView }) => {
  // const editor = useCreateEditor();
  const { hasVaultInitialized } = useSettingsContext();
  
  // TODO figure out how to get the entire contents of the editor and not just the selection

  const [trendingData, setTrendingData] = useState<any>(null);
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntitiesMap>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('selfReflection');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEntity, setDraggedEntity] = useState<{type: 'tag' | 'link', name: string, element: HTMLElement} | null>(null);
  const [showNumber, setShowNumber] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);

  const DEFAULT_COUNT = 4;

  const dragCountRef = useRef<number>(0);

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

  const toggleEntity = (type: 'tag' | 'link', name: string) => {
    setSelectedEntities(prev => {
      const next = new Map(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.set(name, { type, count: DEFAULT_COUNT });
      }
      return next;
    });
  };

  const updateEntityCount = (type: 'tag' | 'link', name: string, count: number) => {
    setSelectedEntities(prev => {
      const next = new Map(prev);
      next.set(name, { type, count });
      return next;
    });
    
    // Timeline will automatically update since it depends on selectedEntities
    // which is used to fetch the timeline data in the useEffect
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

  const submitPrompt = useCallback(async () => {
    if (selectedEntities.size === 0) return;
    
    setIsGenerating(true);
    try {
      const query = Array.from(selectedEntities.keys()).join(' ');
      const context = await window.electron.ipcRenderer.invoke('get-context', query);

      const result = await window.electron.ipcRenderer.invoke('generate-suggested-output', { 
        context, 
        query,
        profileId: selectedProfile
      });

      const body: SuggestedOutputBody = {
        question: result.question,
        segments: result.segments.map((segment, index) => ({
          theme: segment.theme,
          synthesis: {
            id: index,
            prompt: segment.prompt,
            type: segment.type,
            analysis: segment.analysis
          },
          docs: segment.docs.map(doc => {
            const contextItem = context.find(result => result.file === doc);
            const adjoinedContents = contextItem ? contextItem.extractedContents.join('\n') : '';
            return {
              file: doc,
              content: adjoinedContents
            }
          })
        }))
      };

      setSuggestedOutputs([body]);
    } catch (error) {
      console.error('Error generating recipe:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedEntities]);

  const handleScheduleRecipe = async (frequency: 'weekly' | 'monthly', startDate: Date) => {
    try {
      if (!suggestedOutputs?.[0]) {
        throw new Error('No recipe generated yet');
      }

      // Create recipe with the full structure
      await window.electron.ipcRenderer.invoke('create-recipe', {
        frequency,
        startDate,
        entities: Array.from(selectedEntities.values()),
        recipe: {
          question: suggestedOutputs[0].question,
          segments: suggestedOutputs[0].segments.map(segment => ({
            theme: segment.theme,
            type: segment.synthesis.type,
            prompt: segment.synthesis.prompt
          }))
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

  // Add this function to handle drag end
  const handleDragEnd = useCallback(() => {
    if (draggedEntity && dragCountRef.current) {
      updateEntityCount(draggedEntity.type, draggedEntity.name, dragCountRef.current);
    }
    setIsDragging(false);
    setDraggedEntity(null);
    setShowNumber(null);
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

  return (
    <>
      <div
        className="space-y-6"
        onMouseMove={(e) => handleMouseMove(e, draggedEntity)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Header section */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-primary/90">Create a Recipe</h2>
          <p className="text-sm text-primary/70">
            Transform your notes into structured insights. Start by adding a few ingredients below - 
            they'll help surface relevant content from your knowledge base.
          </p>
        </div>

        {/* Recipe builder section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-primary/90">Ingredients</h3>
            <span className="text-xs text-primary/50">Add tags and links to explore connections</span>
          </div>
          
          {/* <DndProvider backend={HTML5Backend}>
            <Plate editor={editor}>
              <EditorContainer variant="demo" className="h-24">
                <Editor />
              </EditorContainer>
            </Plate>
          </DndProvider> */}
        </div>

        {/* Suggested ingredients section */}
        {trendingData && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-primary/70">Popular ingredients from your notes</h4>
            <div 
              className="flex flex-wrap gap-2 text-xs"
              onMouseUp={() => {
                if (draggedEntity && dragCountRef.current) {
                  updateEntityCount(draggedEntity.type, draggedEntity.name, dragCountRef.current);
                }
                setIsDragging(false);
                setDraggedEntity(null);
                setShowNumber(null);
                dragCountRef.current = 0;
              }}
              onMouseLeave={() => {
                if (draggedEntity && dragCountRef.current) {
                  updateEntityCount(draggedEntity.type, draggedEntity.name, dragCountRef.current);
                }
                setIsDragging(false);
                setDraggedEntity(null);
                setShowNumber(null);
                dragCountRef.current = 0;
              }}
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
                    onClick={() => !isDragging && toggleEntity(ingredient.type, ingredient.name)}
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
                            e.stopPropagation();
                            setIsDragging(true);
                            setDraggedEntity({ type: ingredient.type, name: ingredient.name, element: e.currentTarget });
                            setShowNumber(ingredient.name);
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

        <div className="flex justify-normal items-center space-y-2">
          {/* Add Profile selector */}
          <div className="space-y-2">
            <label htmlFor="profile-select" className="block text-sm font-medium text-primary/70">
              Recipe Profile
            </label>
            <select
              id="profile-select"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-3 py-2 bg-background/40 rounded-lg shadow-sm border border-primary/20 focus:outline-none focus:ring-2 focus:ring-brand/50"
            >
              {Object.entries(profiles).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <p className="text-xs text-primary/50">
              {profiles[selectedProfile].description}
            </p>
          </div>

          <button
            disabled={!hasVaultInitialized || selectedEntities.size === 0 || isGenerating}
            className="bg-brand/40 py-2 px-4 rounded-lg shadow-md cursor-pointer hover:bg-brand/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ml-4"
            onClick={submitPrompt}
          >
            Generate Recipe
          </button>
        </div>

        {/* Output section */}
        {(suggestedOutputs || isGenerating) && (
          <div className="mt-8 space-y-4">
            <div className="gap-4">
              {isGenerating ? (
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
              ) : (
                suggestedOutputs && suggestedOutputs.map((output, index) => (
                  <SuggestedOutput
                    key={index}
                    body={output}
                    onEditPrompt={updateSegmentPrompt}
                    onSchedule={handleScheduleRecipe}
                    onRetry={handleRetry}
                  />
                ))
              )}
            </div>
          </div>
        )}


        {/* <button
          className="mt-4 w-full bg-red-500/20 py-2 px-4 rounded-lg shadow-md cursor-pointer hover:bg-red-500/30 transition-colors font-medium"
          onClick={executeFirstPendingRecipe}
        >
          Test: Execute First Pending Recipe
        </button> */}
      </div>
    </>
  )
}

export default RecipeBuilder;