const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListOfferingsRequestSchema,
  GetServerInfoRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");
const { z } = require("zod");

// Create the server with proper metadata
const server = new McpServer({
  name: "enzyme-context-server",
  version: "1.1.0",
  description: "MCP server for retrieving and managing notes from Enzyme vault",
  publisher: "Enzyme",
  homepage: "https://github.com/jshph/enzyme",
  license: "MIT"
});

// Define tools using the server.tool method
server.tool(
  "retrieve_by_tag",
  {
    tag: z.string().describe("Tag to retrieve notes. Must start with #"),
    limit: z.number().optional().describe("Number of notes to retrieve, defaults to 10")
  },
  async ({ tag, limit = 10 }) => {
    return await retrieveByQuery(tag, limit);
  }
);

server.tool(
  "retrieve_by_link",
  {
    link: z.string().describe("Link to retrieve notes. Must start with [[ and end with ]]"),
    limit: z.number().optional().describe("Number of notes to retrieve, defaults to 10")
  },
  async ({ link, limit = 10 }) => {
    return await retrieveByQuery(link, limit);
  }
);

server.tool(
  "retrieve_by_folder",
  {
    folder: z.string().describe("Folder to retrieve notes. Must end with /"),
    limit: z.number().optional().describe("Number of notes to retrieve, defaults to 10")
  },
  async ({ folder, limit = 10 }) => {
    return await retrieveByQuery(folder, limit);
  }
);

// Define prompts using the server.prompt method
server.prompt(
  "enz",
  { 
    query: z.string().describe("Query to retrieve notes") 
  },
  async ({ query }) => {
    try {
      const response = await fetch(`http://localhost:3779/context?query=${encodeURIComponent(query)}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch context: ${response.status} ${response.statusText} - ${errorText}`);
      }

      let data;
      try {
        const responseText = await response.text();
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(`Invalid JSON response: ${jsonError.message}`);
      }

      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        return {
          messages: [{
            role: "user",
            content: {
              type: "text",
              text: "No notes found for the given query."
            }
          }]
        };
      }

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: data.content.map((c) => c.text).join('\n\n')
          }
        }]
      };
    } catch (error) {
      throw new Error(`Error executing prompt: ${error.message}`);
    }
  }
);

/**
 * Helper function to retrieve notes by query.
 * @param query The query string to search for
 * @param limit Optional limit on number of results
 * @returns The query results
 */
const retrieveByQuery = async (query, limit = 10) => {
  try {
    const queryParam = limit ? `${encodeURIComponent(query)}<${limit}` : encodeURIComponent(query);
    const response = await fetch(`http://localhost:3779/context?query=${queryParam}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Failed to fetch context: ${response.status} ${response.statusText} - ${errorText}`
          }
        ]
      };
    }
    
    let data;
    try {
      const responseText = await response.text();
      data = JSON.parse(responseText);
      
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No notes found for the given query."
            }
          ]
        };
      }
      
      return {
        content: data.content.map(c => ({
          type: "text",
          text: c.text
        }))
      };
    } catch (jsonError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Invalid JSON response: ${jsonError.message}`
          }
        ]
      };
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error retrieving by query: ${error.message}`
        }
      ]
    };
  }
};


// Initialize transport and connect
const transport = new StdioServerTransport();

async function main() {
  try {
    // Connect to the transport
    await server.connect(transport);
    // console.log("Enzyme MCP server started successfully");
  } catch (error) {
    // console.error("Failed to start Enzyme MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main();