'use client';

import React, { useState, useEffect } from 'react';
import { cn, withRef } from '@udecode/cn';
import { getMentionOnSelectItem } from '@udecode/plate-mention';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';
import { PlateElement } from './plate-element';

interface MentionItem {
  key: string;
  text: string;
  type: 'tag' | 'link';
}

const onSelectItem = (editor: any, item: MentionItem, search: string) => {
  const cleanText = item.text.replace(/^#|\[\[|\]\]$/g, '');
  
  const displayText = item.type === 'tag' ? `#${cleanText}` : `[[${cleanText}]]`;
  
  getMentionOnSelectItem()(editor, {
    ...item,
    text: displayText
  }, search);
};

export const MentionInputElement = withRef<typeof PlateElement>(
  ({ className, ...props }, ref) => {
    const { children, editor, element } = props;
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<MentionItem[]>([]);

    useEffect(() => {
      const loadMentionItems = async () => {
        try {
          // Get trending items when no search query
          if (!search) {
            const trending = await window.electron.ipcRenderer.invoke('trending-data-update');
            const trendingItems: MentionItem[] = [
              // Add trending tags first
              ...trending.tags.map((tag: { name: string; count: number }, index: number) => ({
                key: `tag-${index}`,
                text: tag.name,
                type: 'tag' as const
              })),
              // Then add trending links
              ...trending.links.map((link: { name: string; count: number }, index: number) => ({
                key: `link-${index}`,
                text: link.name,
                type: 'link' as const
              }))
            ];
            setItems(trendingItems);
          } else {
            // Get all tags and links that match the search
            const results = await window.electron.ipcRenderer.invoke('query-for-links-and-tags', search);
            const searchItems: MentionItem[] = [
              ...results.tags.map((tag: string, index: number) => ({
                key: `tag-${index}`,
                text: tag,
                type: 'tag' as const
              })),
              ...results.links.map((link: string, index: number) => ({
                key: `link-${index}`,
                text: link,
                type: 'link' as const
              }))
            ];
            setItems(searchItems);
          }
        } catch (error) {
          console.error('Error loading mention items:', error);
          setItems([]);
        }
      };

      loadMentionItems();
    }, [search]);

    return (
      <PlateElement
        ref={ref}
        as="span"
        data-slate-value={element.value}
        {...props}
      >
        <InlineCombobox
          value={search}
          element={element}
          setValue={setSearch}
          showTrigger={false}
          trigger="@"
        >
          <span
            className={cn(
              'inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2',
              className
            )}
          >
            <InlineComboboxInput />
          </span>

          <InlineComboboxContent className="my-1.5">
            <InlineComboboxEmpty>No results</InlineComboboxEmpty>

            <InlineComboboxGroup>
              {items.map((item) => (
                <InlineComboboxItem
                  key={item.key}
                  value={item.text}
                  onClick={() => onSelectItem(editor, item, search)}
                >
                  {item.type === 'tag' ? '#' : '[['}
                  {item.text}
                  {item.type === 'tag' ? '' : ']]'}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          </InlineComboboxContent>
        </InlineCombobox>

        {children}
      </PlateElement>
    );
  }
);
