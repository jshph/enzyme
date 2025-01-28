const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

// Read port from environment variable or use default

const server = new Server(
  {
    name: "enzyme-context-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {
        retrieve_by_tag: {
          description: "Retrieve the latest notes from the user's vault by tag, i.e. when the syntax #tag is used in the prompt or when the user asks to gather the latest thoughts for a tag",
        },
        retrieve_by_link: {
          description: "Retrieve the latest notes from the user's vault by link, i.e. when the syntax [[link]] is used in the prompt or when the user asks to gather the latest thoughts for a link",
        },
        retrieve_by_folder: {
          description: "Retrieve the latest notes from the user's vault by folder, i.e. when the syntax folder/ is used in the prompt or when the user asks to gather the latest thoughts for a folder",
        }
      },
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "retrieve_by_tag",
        description: "Retrieve the latest notes from the user's vault by tag, i.e. when the syntax #tag is used in the query",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "Tag to retrieve notes. Must start with #"
            },
            limit: {
              type: "number",
              description: "Number of notes to retrieve, defaults to 10"
            }
          },
          required: ["tag"]
        }
      },
      {
        name: "retrieve_by_link",
        description: "Retrieve the latest notes from the user's vault by link, i.e. when the syntax [[link]] is used in the query",
        inputSchema: {
          type: "object",
          properties: {
            link: {
              type: "string",
              description: "Link to retrieve notes. Must start with [[ and end with ]]"
            },
            limit: {
              type: "number",
              description: "Number of notes to retrieve, defaults to 10"
            }
          },
          required: ["link"]
        }
      },
      {
        name: "retrieve_by_folder",
        description: "Retrieve the latest notes from the user's vault by folder, i.e. when the syntax folder/ is used in the query or when the user explicitly asks for a folder",
        inputSchema: {
          type: "object",
          properties: {
            folder: {
              type: "string",
            description: "Folder to retrieve notes. Must end with /"
            },
            limit: {
              type: "number",
              description: "Number of notes to retrieve, defaults to 10"
            }
          },
          required: ["folder"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  if (request.params.name === "retrieve_by_tag") {
    return await retrieveByQuery(request.params.arguments.tag, request.params.arguments.limit);
  }
  if (request.params.name === "retrieve_by_link") {
    return await retrieveByQuery(request.params.arguments.link, request.params.arguments.limit);
  }
  if (request.params.name === "retrieve_by_folder") {
    return await retrieveByQuery(request.params.arguments.folder, request.params.arguments.limit);
  }
});

const retrieveByQuery = async (query: string, limit: number) => {
  const response = await fetch(`http://localhost:3779/context?query=${encodeURIComponent(query)}<${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch context: ${response.statusText} ${await response.text()}`);
  }
  const data = await response.json();
  return data;
};

server.setRequestHandler(GetPromptRequestSchema, async (request: any) => {
  if (request.params.name !== "enz") {
    throw new Error("Unknown prompt");
  }

  const query = request.params.arguments?.query;

  if (!query) {
    throw new Error("Query is required");
  }

  const response = await fetch(`http://localhost:3779/context?query=${encodeURIComponent(query)}`);

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

async function main() {
  await server.connect(transport);
}

main();