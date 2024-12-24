import { useCreateEditor } from "../components/editor/use-create-editor";
import { Editor } from "./plate-ui/editor";
import { useCallback, useState } from "react";
import { EditorContainer } from "./plate-ui/editor";
import { HTML5Backend } from "react-dnd-html5-backend";
import { SuggestedOutput, SuggestedOutputBody } from "./plate-ui/suggested-output";
import { Plate } from "@udecode/plate-common/react";
import { DndProvider } from "react-dnd";
import { useEffect } from "react";
import { MatchResult } from "./editor/use-chat";


const PromptBuilder: React.FC<{ currentView: string}> = ({ currentView }) => {
  const editor = useCreateEditor();
  
  // TODO figure out how to get the entire contents of the editor and not just the selection

  const [trendingData, setTrendingData] = useState<any>(null);

  const fetchTrendingData = async () => {
    const result = await window.electron.ipcRenderer.invoke('trending-data-update');
    setTrendingData(result);
  };

  useEffect(() => {
    fetchTrendingData();
  }, [currentView]);

  const [suggestedOutputs, setSuggestedOutputs] = useState<SuggestedOutputBody[]>();

  const submitPrompt = useCallback(async () => {
    // Get the entire editor contents
    const fragment = editor.children;

    const unwrapMentions = (nodes) => {
      let text = '';
      nodes.forEach(node => {
        if (node.type === 'mention' && node.value) {
          text += `${node.value}`;
        } else if (node.text) {
          text += node.text;
        } else if (node.children) {
          text += unwrapMentions(node.children);
        }
        text += ' ';
      });
      return text;
    }

    const unwrappedText = unwrapMentions(fragment);
    // fetch the context using the entities in the editor, returned as json
    const context: MatchResult[] = await window.electron.ipcRenderer.invoke('get-context', unwrappedText);

    // Context will contain urls in addition to the contents themselves.
    const result = await window.electron.ipcRenderer.invoke('suggested-output', { 
      context, 
      query: unwrappedText 
    });

    // Construct the body with the new segment structure
    const body: SuggestedOutputBody = {
      question: result.question,
      segments: result.segments.map(segment => ({
        theme: segment.theme,
        synthesis: {
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
  }, [editor]);

  const addEntityToEditor = (entity: string) => {
    editor.insertNodes([{
      type: 'mention',
      value: entity,
      children: [{ text: '' }]
    }]);
  }


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
          
          <DndProvider backend={HTML5Backend}>
            <Plate editor={editor}>
              <EditorContainer variant="demo" className="h-24"> {/* Reduced height */}
                <Editor />
              </EditorContainer>
            </Plate>
          </DndProvider>
        </div>

        {/* Suggested ingredients section */}
        {trendingData && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-primary/70">Popular ingredients from your notes</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {trendingData.tags.map((tag, index) => (
                <div 
                  key={index} 
                  className="bg-brand/30 px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-brand/70 transition-colors" 
                  title="Add to recipe" 
                  onClick={() => addEntityToEditor(`#${tag.name}`)}
                >{`#${tag.name}`}</div>
              ))}
              {trendingData.links.map((link, index) => (
                <div 
                  key={index} 
                  className="bg-brand/30 px-3 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-brand/70 transition-colors" 
                  title="Add to recipe" 
                  onClick={() => addEntityToEditor(`[[${link.name}]]`)}
                >{`[[${link.name}]]`}</div>
              ))}
            </div>
          </div>
        )}

        <button 
          className="w-full bg-brand/30 py-2 px-4 rounded-lg shadow-md cursor-pointer hover:bg-brand/70 transition-colors font-medium"
          onClick={submitPrompt}
        >
          Generate Recipe
        </button>

        {/* Output section */}
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-medium text-primary/90">Recipe Variations</h3>
          <p className="text-sm text-primary/70">
            Select the most relevant format for exploring your notes
          </p>
          <div className="gap-4">
            {suggestedOutputs && suggestedOutputs.map((output, index) => (
              <SuggestedOutput
                key={index}
                body={output}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default PromptBuilder;