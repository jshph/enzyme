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
          type: segment.synthesis.type,
          exploration: segment.synthesis.exploration
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
      {/*  Showing the top tags and entities to help create a prompt */}
      {trendingData && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary/90">Trending</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {trendingData.tags.map((tag, index) => (
              <div key={index} className="bg-brand/30 p-2 rounded-full shadow-md cursor-pointer hover:bg-brand/70 mr-2" title="Add to prompt" onClick={() => addEntityToEditor(`#${tag.name}`)}>{`#${tag.name}`}</div>
            ))}
            {trendingData.links.map((link, index) => (
              <div key={index} className="bg-brand/30 p-2 rounded-full shadow-md cursor-pointer hover:bg-brand/70 mr-2" title="Add to prompt" onClick={() => addEntityToEditor(`[[${link.name}]]`)}>{`[[${link.name}]]`}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Playground to create a prompt */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-primary/90">Builder</h3>
        <DndProvider backend={HTML5Backend}>
          <Plate editor={editor}>
            <EditorContainer variant="demo">
            <Editor />
            </EditorContainer>
          </Plate>
        </DndProvider>
        <button className="bg-brand/30 p-2 rounded-full shadow-md cursor-pointer hover:bg-brand/70" onClick={submitPrompt}>Submit Prompt</button>
      </div>

      <div className="mt-4 space-y-4">
        <h3 className="text-lg font-medium text-primary/90">Suggested Outputs</h3>
        <div className="gap-4">
          {suggestedOutputs && suggestedOutputs.map((output, index) => (
            <SuggestedOutput
              key={index}
              body={output}
            />
          ))}
        </div>
      </div>
    </>
  )
}

export default PromptBuilder;