import { useCallback, useState } from "react";
import { SuggestedOutput, SuggestedOutputBody } from "../../plate-ui/suggested-output";
import { useEffect } from "react";
import { MatchResult } from "../../editor/use-chat";
import { useSettingsContext } from "@renderer/dashboard/contexts/SettingsContext";

interface SelectedEntity {
  type: 'tag' | 'link';
  name: string;
}

const PromptBuilder: React.FC<{ currentView: string}> = ({ currentView }) => {
  // const editor = useCreateEditor();
  const { hasVaultInitialized } = useSettingsContext();
  
  // TODO figure out how to get the entire contents of the editor and not just the selection

  const [trendingData, setTrendingData] = useState<any>(null);
  const [selectedEntities, setSelectedEntities] = useState<SelectedEntity[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchTrendingData = async () => {
    const result = await window.electron.ipcRenderer.invoke('trending-data-update');
    // Format the tags and links with the # and [[ ]]
    const formattedTags = result.tags.map(tag => ({ type: 'tag', name: `#${tag.name}` }));
    const formattedLinks = result.links.map(link => ({ type: 'link', name: `[[${link.name}]]` }));
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
      const exists = prev.some(entity => entity.type === type && entity.name === name);
      if (exists) {
        return prev.filter(entity => !(entity.type === type && entity.name === name));
      } else {
        return [...prev, { type, name }];
      }
    });
  };

  const updateSegmentPrompt = (id: number, prompt: string) => {
    if (!suggestedOutputs || !suggestedOutputs.length) return;
    setSuggestedOutputs(prev => {
      const newOutputs = prev.map(output => ({
        ...output,
        segments: output.segments.map((segment, index) => index === id ? { ...segment, prompt } : segment)
      }));
      return newOutputs;
    });
  };

  const submitPrompt = useCallback(async () => {
    if (selectedEntities.length === 0) return;
    
    setIsGenerating(true);
    try {
      // Convert selected entities to query string
      const query = selectedEntities.map(entity => entity.name).join(' ');

      // fetch the context using the entities
      const context: MatchResult[] = await window.electron.ipcRenderer.invoke('get-context', query);

      // Get suggested output
      const result = await window.electron.ipcRenderer.invoke('suggested-output', { 
        context, 
        query 
      });

      // Construct the body
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
      // Optionally add error handling UI here
    } finally {
      setIsGenerating(false);
    }
  }, [selectedEntities]);

  const handleScheduleRecipe = async (frequency: 'weekly' | 'monthly', startDate: Date) => {
    try {
      await window.electron.ipcRenderer.invoke('schedule-recipe', {
        frequency,
        startDate,
        recipe: suggestedOutputs?.[0], // Assuming we're scheduling the first recipe
        entities: selectedEntities
      });
      // Optionally show a success toast/notification here
    } catch (error) {
      console.error('Error scheduling recipe:', error);
      // Optionally show an error toast/notification here
    }
  };

  const handleRetry = useCallback(async () => {
    await submitPrompt();
  }, [submitPrompt]);

  return (
    <>
      <div className="space-y-6">
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
            <div className="flex flex-wrap gap-2 text-xs">
              {trendingData.tags.map((tag, index) => (
                <div 
                  key={index} 
                  className={`px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors ${
                    selectedEntities.some(e => e.type === 'tag' && e.name === tag.name)
                      ? 'bg-brand/70'
                      : 'bg-brand/30 hover:bg-brand/50'
                  }`}
                  onClick={() => toggleEntity('tag', tag.name)}
                >{tag.name}</div>
              ))}
              {trendingData.links.map((link, index) => (
                <div 
                  key={index} 
                  className={`px-3 py-1.5 rounded-full shadow-sm cursor-pointer transition-colors ${
                    selectedEntities.some(e => e.type === 'link' && e.name === link.name)
                      ? 'bg-brand/70'
                      : 'bg-brand/30 hover:bg-brand/50'
                  }`}
                  onClick={() => toggleEntity('link', link.name)}
                >{link.name}</div>
              ))}
            </div>
          </div>
        )}

        <button
          disabled={!hasVaultInitialized || selectedEntities.length === 0 || isGenerating}
          className="w-full bg-background/40 py-2 px-4 rounded-lg shadow-md cursor-pointer hover:bg-background/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={submitPrompt}
        >
          Generate Recipe
        </button>

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
      </div>
    </>
  )
}

export default PromptBuilder;