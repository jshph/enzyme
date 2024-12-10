import { Toaster } from 'sonner';
import { PlateEditor } from '@/components/editor/plate-editor';
import { SettingsProvider } from '@/components/editor/settings';

export default function Playground() {

  const documents = [
    {
      id: '1',
      url: 'https://platejs.org/docs/plugin-components',
      content: 'This is a test content'
    },
    {
      id: '2',
      url: 'https://platejs.org/docs/plugin-components',
      content: 'This is a test content'
    },
    {
      id: '3',
      url: 'https://platejs.org/docs/plugin-components',
      content: 'This is a test content'
    },
  ];

  return (
    <div className="h-screen w-full" data-registry="plate">
      <SettingsProvider>
        <PlateEditor />
      </SettingsProvider>
      <Toaster />
    </div>
  );
}