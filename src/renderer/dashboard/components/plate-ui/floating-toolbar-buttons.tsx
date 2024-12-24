'use client';

import React, { useCallback } from 'react';

import {
  BoldPlugin,
  CodePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@udecode/plate-basic-marks/react';
import { useEditorReadOnly, useSelectionFragment } from '@udecode/plate-common/react';
import { useEditorSelection } from '@udecode/plate-core/react';
import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  WandSparklesIcon,
} from 'lucide-react';

import { AIToolbarButton } from './ai-toolbar-button';
import { LinkToolbarButton } from './link-toolbar-button';
import { MarkToolbarButton } from './mark-toolbar-button';
import { ToolbarGroup } from './toolbar';
import { TurnIntoDropdownMenu } from './turn-into-dropdown-menu';
import { ToolbarButton } from './toolbar';
export function FloatingToolbarButtons() {
  const readOnly = useEditorReadOnly();
  const selection = useEditorSelection();
  const fragment = useSelectionFragment();
  
  // const extractMentionsFromEditor = useCallback((): string[] => {

  //   const _extract = (nodes: any[]): string[] => {
  //     const result: string[] = [];
      
  //     for (const node of nodes) {
  //       if (node.type === 'mention' && node.value) {
  //         const value = node.value;
  //         result.push(value);
  //       } else if (node.type === 'text' && node.value) {
  //         result.push(node.value);
  //       } else if (node.children) {
  //         result.push(..._extract(node.children));
  //       }
  //     }
      
  //     return result;
  //   }

  //   return _extract(fragment);
  // }, [fragment]);
  

  return (
    <>
      {!readOnly && (
        <>
          <ToolbarGroup>
            <AIToolbarButton tooltip="AI commands">
              <WandSparklesIcon />
              Ask AI
            </AIToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <ToolbarButton onClick={() => {
              // TODO create a prompt not with the mentions, but with the whole editor content
              const unwrapMentions = (nodes) => {
                let text = '';
                nodes.forEach(node => {
                  if (node.type === 'mention' && node.value) {
                    text += `<span>${node.value}</span>`;
                  } else if (node.text) {
                    text += node.text;
                  } else if (node.children) {
                    text += unwrapMentions(node.children);
                  }
                });
                return text;
              };

              const unwrappedText = unwrapMentions(fragment);
              console.log('Unwrapped Text:', unwrappedText);

              // Create prompt using ipc
              window.electron.ipcRenderer.invoke('create-prompt', {
                prompt: unwrappedText,
                created_at: new Date().toISOString(),
                reminder_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              });
            }} tooltip="Create Prompt">
              Create Prompt
            </ToolbarButton>
          </ToolbarGroup>
          {/* <ToolbarGroup>
            <ToolbarButton onClick={() => {
              // Create a digest using the tags and links present
              const mentions = extractMentionsFromEditor();
              console.log('Mentions:', mentions);
            }} tooltip="Help me create a prompt">
              Generate a prompt with these tags and links
            </ToolbarButton>
          </ToolbarGroup> */}
          <ToolbarGroup>
            <TurnIntoDropdownMenu />

            <MarkToolbarButton nodeType={BoldPlugin.key} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={ItalicPlugin.key}
              tooltip="Italic (⌘+I)"
            >
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={UnderlinePlugin.key}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={StrikethroughPlugin.key}
              tooltip="Strikethrough (⌘+⇧+M)"
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={CodePlugin.key} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>

            <LinkToolbarButton />
          </ToolbarGroup>
        </>
      )}
    </>
  );
}
