import { useCreateEditor } from '../../components/editor/use-create-editor';
import { Editor, EditorContainer } from '../../components/plate-ui/editor';
import { Plate } from '@udecode/plate-common/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';



export default function Playground() {
  const editor = useCreateEditor();

  return (
    <div className="space-y-6">
      <DndProvider backend={HTML5Backend}>
        <Plate editor={editor}>
          <EditorContainer variant="demo">
            <Editor />
          </EditorContainer>
        </Plate>
      </DndProvider>
    </div>
  );
}