#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// Read port from environment variable or use default
const port = parseInt(process.env.PORT || '3779');

const server = new Server(
  {
    name: "enzyme-context-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {
        enz: {
          description: "Retrieve notes from the Enzyme context server",
          arguments: [
            {
              name: "query",
              type: "string",
              description: "Query to retrieve notes"
            }
          ]
        }
      },
    },
  }
);

/**
 * Handler that lists available prompts.
 * Exposes a single "summarize_notes" prompt that summarizes all notes.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "enz",
        description: "Retrieve notes from the Enzyme context server",
        arguments: [
          {
            name: "query",
            type: "string",
            description: "Query to retrieve notes"
          }
        ]
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
  if (request.params.name !== "enz") {
    throw new Error("Unknown prompt");
  }

  const query = request.params.arguments?.query;

  if (!query) {
    throw new Error("Query is required");
  }

  const response = await fetch(`http://localhost:${port}/context?query=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch context: ${response.statusText} ${await response.text()}`);
  }

  const data = await response.json();

  return {
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: data.content.map((c: any) => c.text).join('\n\n')
      }
    }]
  };
});

const transport = new StdioServerTransport();

console.log(`Enzyme context server running on port ${port}`);

async function main() {
  await server.connect(transport);
}

main();