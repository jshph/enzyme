'use client';

import { useChat as useBaseChat } from 'ai/react';
import { useSettings } from '@/components/editor/settings';

export interface MatchResult {
  file: string;
  tags: string[];
  extractedContents: string[];
  lastModified: number;
  createdAt: Date;
}


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistory {
  messages: ChatMessage[];
  system: string;
}

const TEMPLATE_RESULT = `## File: {file}
* Folder: {folder}
* Tags: {tags}
* Last modified: {lastModified}
* Created: {createdAt}


### Contents
\`\`\`
{contents}
\`\`\`
`;

export const useChat = () => {
  const { keys, model } = useSettings();

  return useBaseChat({
    id: 'editor',
    api: '/api/ai/command',
    body: {
      // !!! DEMO ONLY: don't use API keys client-side
      apiKey: keys.openai,
      model: model.value,
    },
    fetch: async (input, init) => {

      let reqBody = JSON.parse(init?.body as string);
      let systemPrompt = reqBody.system;

      let allDocs: MatchResult[] = [];

      // Format the user messages that are json
      reqBody.messages = reqBody.messages.map(message => {
        if (message.role === 'user') {
          // Extract from inside <RelevantDocs>
          let docs = message.content.match(/<RelevantDocs>\n(.*?)\n<\/RelevantDocs>/s)?.[1];

          let content = message.content;
          if (docs) {
            docs = JSON.parse(docs);
            allDocs.push(...docs);

            const formattedContext = docs.map(doc =>
              TEMPLATE_RESULT
                .replace('{file}', doc.file)
                .replace('{folder}', doc.file.split("/").slice(0, -1).join("/"))
                .replace('{tags}', doc.tags.join(', '))
                .replace('{lastModified}', doc.lastModified.toString())
                .replace('{createdAt}', doc.createdAt.toString())
                .replace('{contents}', doc.extractedContents.join('\n'))
            );

            content = content.replace(/<RelevantDocs>\n(.*?)\n<\/RelevantDocs>/s, `<RelevantDocs>\n${formattedContext}\n</RelevantDocs>`);
          } else {
            content = message.content;
          }

          return {
            ...message,
            content: content
          }
        }
        return message;
      });

      let messages = [{ role: 'system', content: systemPrompt }, ...reqBody.messages];
      let response;
      try {
        response = await window.electron.ipcRenderer.invoke('relevant-docs', messages);
      } catch (error) {
        console.error(error);
      }

      // Look up the docs from response
      const selectedDocs = response.docs.map(doc => {
        const match = allDocs.find(m => m.file === doc);
        return match;
      });

      let formattedResponseMd = response.question + '\n';
      selectedDocs.forEach(doc => {
        if (doc) {
          formattedResponseMd += `\n\n> ${doc.extractedContents.map(content => content.replace(/\n/g, ' ')).join('\n> ')}\n\n[link](${doc.file})`;
        }
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const text = formattedResponseMd;
          // Wrap response in the expected format for the AI chat component
          controller.enqueue(encoder.encode('0:' + JSON.stringify(text) + '\n'));
          
          // Add completion message
          controller.enqueue(
            encoder.encode(
              `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":${text.length}}}\n`
            )
          );
          
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
          'Cache-Control': 'no-cache',
        },
      });
    }
  });
};