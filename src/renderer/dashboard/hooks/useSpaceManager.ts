import { useState, useCallback } from 'react';
import { Space, NewSpace } from '../types';

export const useSpaceManager = () => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  const fetchSpaces = useCallback(async () => {
    try {
      const response = await window.electron.ipcRenderer.invoke('fetch-spaces');
      if (response.success) {
        setSpaces(response.spaces);
      }
    } catch (error) {
      console.error('Error fetching spaces:', error);
      setMessage('Failed to fetch spaces');
      setError(true);
    }
  }, []);

  const saveSpace = useCallback(async (spaceData: NewSpace, isEditing: boolean) => {
    try {
      const response = await window.electron.ipcRenderer.invoke(
        isEditing ? 'edit-space' : 'create-space',
        isEditing ? {
          spaceId: spaceData.id,
          updates: {
            name: spaceData.name,
            destinationFolder: spaceData.destinationFolder,
            enabledTags: [...spaceData.enabledTags]
          }
        } : {
          ...spaceData,
          enabledTags: [...spaceData.enabledTags]
        }
      );

      if (response.success) {
        await fetchSpaces();
        setMessage(`Space ${isEditing ? 'updated' : 'created'} successfully!`);
        setError(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving space:', error);
      setMessage(`Failed to ${isEditing ? 'update' : 'create'} space`);
      setError(true);
      return false;
    }
  }, [fetchSpaces]);

  // Add other space-related functions here...

  return {
    spaces,
    message,
    error,
    fetchSpaces,
    saveSpace,
    setMessage,
    setError
  };
}; 