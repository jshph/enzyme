import * as d3 from "d3";

import React, {
  useRef,
  useEffect,
  MutableRefObject,
  forwardRef,
  useState,
  useCallback,
} from "react";

const ZOOM_THRESHOLD = 1.5; // Adjust this value to set when document text appears

export interface DocumentNode {
  id: string;
  summary: string;
  type: 'document';
  links: string[];
}

export interface MentionNode {
  id: string;
  text: string;
  type: 'mention';
}


function createGraph(
  width: number,
  height: number,
  ref: React.RefObject<SVGSVGElement>
): {
  g: d3.Selection<SVGGElement, unknown, null, undefined>;
  overlay: d3.Selection<SVGRectElement, unknown, null, undefined>;
} {
  const svg = d3
    .select(ref.current)
    .attr("width", width)
    .attr("height", height)
    .classed("bg-background/20", true)
    .style("border", "1px solid black");
  // Clear previous content
  svg.selectAll("*").remove();

  // Create a container group for zooming and panning
  const g = svg.append("g");

  // Create an overlay group that won't be affected by zoom
  const overlay = g
    .append("rect")
    .attr("width", width * 10)
    .attr("height", height * 10)
    .attr("x", -width * 4.5) // Center horizontally
    .attr("y", -height * 4.5) // Center vertically
    .classed("bg-background/10", true)
    .attr("opacity", 0)
    .style("pointer-events", "none");

  // Add zoom behavior
  const zoom = d3
    .zoom()
    .scaleExtent([0.1, 4])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", event.transform);

      // Update text properties based on zoom scale
      updateTextProperties(g, event.transform.k);
    });

  svg.call(zoom as any);

  return { g, overlay };
}

function updateTextProperties(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  zoomScale: number
) {
  const fontSize = `${12 / zoomScale}px`;
  const showDocumentText = zoomScale > ZOOM_THRESHOLD;

  g.selectAll(".main-node").each(function (d: any) {
    const node = d3.select(this);
    const text = node.select("text");

    text.style("font-size", fontSize);

    if (d.type !== "mention") {
      text.style("display", showDocumentText ? "inline" : "none");
    }
  });
}
function createNodes(
  data: any[],
  nodeType: string,
  getNodeProps: (d: any) => any,
  getNodeId: (d: any) => string
) {
  return data.map((d) => ({
    id: getNodeId(d),
    type: nodeType,
    ...getNodeProps(d),
  }));
}

function createForceLinks(links: any[], forceParams: any) {
  return d3
    .forceLink(links)
    .id((d: any) => d.id)
    .distance((d: any) =>
      d.source.type === "mention" || d.target.type === "mention"
        ? forceParams.linkDistance * forceParams.mentionLinkDistanceRatio
        : forceParams.linkDistance
    )
    .strength((d: any) =>
      d.source.type === "mention" || d.target.type === "mention"
        ? forceParams.linkStrength * forceParams.mentionLinkStrengthRatio
        : forceParams.linkStrength
    );
}

function createSimulation(
  // nodes: any[],
  // links: any[],
  width: number,
  height: number,
  forceParams: any
) {
  return d3
    .forceSimulation([])
    .force("charge", d3.forceManyBody().strength(-100))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(forceParams.collisionRadius))
    .force("link", createForceLinks([], forceParams));
}

// Render functions (simplified for brevity)
function renderLinks(g: any, links: any, className: string, style: any) {
  const linkSelection = g
    .selectAll(`.${className}`)
    .data(links, (d: any) => `${d.source.id}-${d.target.id}`);

  // Enter new links
  const linkEnter = linkSelection
    .enter()
    .append("line")
    .attr("class", className)
    .style("stroke", style.stroke)
    .style("stroke-opacity", style.strokeOpacity)
    .style("stroke-dasharray", style.dotted ? "3, 3" : "none");

  // Merge enter and update selections
  return linkSelection.merge(linkEnter);
  // .style("transition", "opacity 0.25s ease");
}

function renderNodes(
  g: any,
  nodes: any,
  className: string,
  style: any,
  selectedIdsRef: MutableRefObject<Set<string>>,
  eventHandlers: { [key: string]: (event: d3.D3Event, d: any) => void },
  doRenderText = true
) {
  const nodeSelection = g
    .selectAll(`.${className}`)
    .data(nodes, (d: any) => d.id);

  // Enter new nodes
  const nodeEnter = nodeSelection
    .enter()
    .append("g")
    .attr("class", className)
    .style("cursor", "pointer")
    .style("opacity", (d: any) => {
      const isSelected = selectedIdsRef.current.has(d.id);
      return isSelected ? 0.7 : 0.3;
    })
    .style(
      "font-weight",
      (d: any) => `var(--node-font-weight-${idToSuffix(d.id)}, 400)`
    );

  nodeEnter.append("circle").attr("r", style.radius).style("fill", style.fill);

  if (doRenderText) {
    nodeEnter.each(function (d: any) {
      const textElement = d3
        .select(this)
        .append("text")
        .attr("dy", "0.35em")
        .style("fill", d => d.type === 'mention' ? 'rgba(144, 238, 144, 0.6)' : '#e4e6eb')
        .style("font-size", "12px")
        .style("opacity", d => {
          return d.type === 'mention' && selectedIdsRef.current.has(d.id) ? 1 : 0.3;
        });

      const words = d.text.split(" ");
      const lines: string[] = [];

      for (let i = 0; i < words.length; i += 4) {
        lines.push(words.slice(i, i + 4).join(" "));
      }

      const lineHeight = 1.1; // ems

      textElement.text(null);

      lines.forEach((line, i) => {
        textElement
          .append("tspan")
          .attr("x", 8)
          .attr("y", 0)
          .attr(
            "dy",
            `${i * lineHeight - ((lines.length - 1) * lineHeight) / 2}em`
          )
          .text(line);
      });
    });
  }
  nodeEnter
    .on("mouseover", eventHandlers.mouseover)
    .on("mouseout", eventHandlers.mouseout)

  return nodeSelection.merge(nodeEnter);
}

function updatePositions(link: any, node: any) {
  link
    .attr("x1", (d: any) => d.source.x)
    .attr("y1", (d: any) => d.source.y)
    .attr("x2", (d: any) => d.target.x)
    .attr("y2", (d: any) => d.target.y);

  node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
}

export type GraphViewProps = {
  width?: number;
  height?: number;
  selectedIdsRef: MutableRefObject<Set<string>>;
};

export type GraphViewRef = {
  updateNodesSelected: (nodeIds: string[], count: number) => void;
  addToSimulation: (
    links: { source: string; target: string }[],
    documents: any[],
    mentions: any[],
  ) => void;
  removeNodesAndLinks: (mentionId: string) => void;
};

// Update the GraphView component to use the new unified function
export const GraphView = forwardRef<GraphViewRef, GraphViewProps>(
  (props, ref) => {
    const {
      width = 800,
      height = 600,
      selectedIdsRef
    } = props;

    const svgRef = useRef<SVGSVGElement | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize graph on mount
    useEffect(() => {
      if (!svgRef.current || isInitialized) return;

      const { g, overlay } = createGraph(width, height, svgRef);
      graphRef.current = g;
      opacityLayerRef.current = overlay.node();
      
      const mainSimulation = createSimulation(width, height, forceParams);
      simulationRef.current = mainSimulation;
      mainSimulation.alpha(0.1).restart();

      setIsInitialized(true);
    }, [width, height]);

    const adjacencyListRef = useRef(new Map<string, Set<string>>());
    const [forceParams, setForceParams] = useState({
      charge: -100,
      collisionRadius: 15,
      linkDistance: 40,
      linkStrength: 0.8,
      mentionLinkDistanceRatio: 2.25, // 90 / 40
      mentionLinkStrengthRatio: 0.125, // 0.1 / 0.8
    });
    const simulationRef = useRef<d3.Simulation<any, undefined> | null>(null);
    const graphRef =
      useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown>>();
    const mainNode =
      useRef<d3.Selection<SVGGElement, any, SVGGElement, unknown>>();
    const mainLink =
      useRef<d3.Selection<SVGLineElement, any, SVGGElement, unknown>>();

    const opacityLayerRef = useRef<SVGRectElement | null>(null);
    const [highlights, setHighlights] = useState<any[]>([]);

    // const entityDocumentsRef = useRef<Map<string, Set<string>>>(new Map());
    const entityDocumentRankingsRef = useRef<Map<string, Map<string, number>>>(new Map());

    // Track which entities are selecting each document and their rankings
    const documentSelectionsRef = useRef<Map<string, Map<string, number>>>(new Map());

    const handleMouseOver = (event: d3.D3Event, d: any) => {
      // if (!mainNode.current || !mainLink.current) return;
      const neighbors = adjacencyListRef.current.get(d.id) || new Set<string>();

      // Highlight the hovered node and its neighbors
      const highlightedNodes = d3
        .selectAll(".main-node")
        .filter((node: any) => node.id === d.id || neighbors.has(node.id));

      const highlightedLinks = d3
        .selectAll(".main-link")
        .filter(
          (link: any) => link.source.id === d.id || link.target.id === d.id
        );

      // Fade in the opacity layer
      d3.select(opacityLayerRef.current)
        .raise()
        .transition()
        .duration(100)
        .attr("opacity", 0.4);

      highlightedLinks.raise();
      highlightedNodes.raise();

      setHighlights([...highlightedNodes.nodes(), ...highlightedLinks.nodes()]);
    };

    const resetHighlights = () => {
      if (!mainNode.current || !mainLink.current) return;

      // Clear the highlight group
      highlights.forEach((element) => {
        d3.select(element).lower();
      });

      setHighlights([]);
    };

    const handleMouseOut = () => {
      const opacityLayer = d3.select(opacityLayerRef.current);

      resetHighlights();

      // Fade out the opacity layer
      opacityLayer
        .transition()
        .duration(100)
        .attr("opacity", 0)
        .on("end", () => {
          opacityLayer.lower();
          // Reset all highlights
        });
    };
    // New effect to update force parameters
    useEffect(() => {
      if (!simulationRef.current) return;

      simulationRef.current
        .force("charge", d3.forceManyBody().strength(forceParams.charge))
        .force(
          "collision",
          d3.forceCollide().radius(forceParams.collisionRadius)
        )
        .force(
          "link",
          d3
            .forceLink(simulationRef.current.force("link").links())
            .id((d: any) => d.id)
            .distance((d: any) =>
              d.source.type === "mention" || d.target.type === "mention"
                ? forceParams.linkDistance *
                  forceParams.mentionLinkDistanceRatio
                : forceParams.linkDistance
            )
            .strength((d: any) =>
              d.source.type === "mention" || d.target.type === "mention"
                ? forceParams.linkStrength *
                  forceParams.mentionLinkStrengthRatio
                : forceParams.linkStrength
            )
        );
      simulationRef.current.alpha(0.8).restart();
    }, [forceParams]);

    const updateNodesSelected = (nodeIds: string[], count: number) => {
      if (!svgRef.current) return;

      // Update document weights based on all active selections
      documentSelectionsRef.current.forEach((entityRankings, docId) => {
        let shouldBeBold = false;
        
        // Check if any selecting entity ranks this document within their count
        entityRankings.forEach((rank, entityId) => {
          if (selectedIdsRef.current.has(entityId)) {
            const entityCount = count; // You might want to store individual counts per entity
            if (rank <= entityCount) {
              shouldBeBold = true;
            }
          }
        });

        // Update the font weight
        document.documentElement.style.setProperty(
          `--node-font-weight-${idToSuffix(docId)}`,
          shouldBeBold ? "600" : "400"
        );
      });

      // Update node and text opacity based on selections
      const nodeSelection = d3.select(svgRef.current)
        .selectAll(".main-node")
        .filter((d: any) => {
          if (d.type === 'mention') {
            return nodeIds.includes(d.id);
          } else if (d.type === 'document') {
            return documentSelectionsRef.current.has(d.id);
          }
          return false;
        });
      
      nodeSelection.each(function(d: any) {
        const node = d3.select(this);
        let opacity;
        
        if (d.type === 'mention') {
          opacity = 1;
          node.select("text").style("opacity", 1);
        } else if (d.type === 'document') {
          // Document is highlighted if any entity is selecting it
          opacity = documentSelectionsRef.current.has(d.id) ? 0.7 : 0.3;
        }
        
        node.style("opacity", opacity);
      });
    };

    // Add this helper function to update adjacency list
    const updateAdjacencyList = (
      links: any[],
      removedNodeId?: string
    ) => {
      // Clear existing adjacency list if no removedNodeId provided
      if (!removedNodeId) {
        adjacencyListRef.current.clear();
      }

      // Process each link
      links.forEach(link => {
        const sourceId = link.source.id;
        const targetId = link.target.id;

        // Skip links connected to removed node
        if (removedNodeId && (sourceId === removedNodeId || targetId === removedNodeId)) {
          return;
        }

        // Update adjacency list
        if (!adjacencyListRef.current.has(sourceId)) {
          adjacencyListRef.current.set(sourceId, new Set());
        }
        if (!adjacencyListRef.current.has(targetId)) {
          adjacencyListRef.current.set(targetId, new Set());
        }
        adjacencyListRef.current.get(sourceId)!.add(targetId);
        adjacencyListRef.current.get(targetId)!.add(sourceId);
      });
    };

    // Add this helper function to clean up simulation links
    const cleanupSimulationLinks = (simulation: d3.Simulation<any, undefined>) => {
      const links = simulation.force("link")?.links() || [];
      const nodes = new Set(simulation.nodes().map(n => n.id));
      
      // Filter out any links where either end is missing from nodes
      const validLinks = links.filter(link => 
        nodes.has(link.source.id) && nodes.has(link.target.id)
      );

      // Deduplicate links between the same node pairs
      const uniqueLinks = new Map();
      validLinks.forEach(link => {
        const linkId = link.source.id < link.target.id ? 
          `${link.source.id}-${link.target.id}` : 
          `${link.target.id}-${link.source.id}`;
        uniqueLinks.set(linkId, link);
      });

      return Array.from(uniqueLinks.values());
    };

    // Add this helper to validate a link between two nodes
    const isValidLink = (
      sourceNode: any, 
      targetNode: any,
      validDocuments: Set<string>,
      selectedEntities: Set<string>,
      validOneHopMentions: Set<string>,
      simulationNodes: Set<string>
    ): boolean => {
      // First verify both nodes exist in simulation
      if (!simulationNodes.has(sourceNode.id) || !simulationNodes.has(targetNode.id)) {
        return false;
      }

      // Rest of the validation remains the same
      if (sourceNode.id === targetNode.id) return false;

      const isMentionToDocument = 
        (sourceNode.type === 'mention' && targetNode.type === 'document') ||
        (sourceNode.type === 'document' && targetNode.type === 'mention');
      if (!isMentionToDocument) return false;

      const [mention, document] = sourceNode.type === 'mention' ?
        [sourceNode, targetNode] : [targetNode, sourceNode];

      if (!validDocuments.has(document.id)) return false;

      return selectedEntities.has(mention.id) || validOneHopMentions.has(mention.id);
    };

    // Add this helper at the top level
    const getUniqueNodes = (nodes: any[]): any[] => {
      const uniqueNodes = new Map();
      nodes.forEach(node => {
        uniqueNodes.set(node.id, node);
      });
      return Array.from(uniqueNodes.values());
    };


    // Add this helper function to process and validate nodes/links
    function processGraphData(
      currentNodes: any[],
      currentLinks: any[],
      selectedEntities: Set<string>,
      validDocuments: Set<string>,
      connectionMap: Map<string, Set<string>>
    ) {
      // 1. Identify valid one-hop mentions (connected to valid documents)
      const validOneHopMentions = new Set<string>();
      currentNodes.forEach(node => {
        if (node.type === 'mention' && !selectedEntities.has(node.id)) {
          const connections = connectionMap.get(node.id) || new Set();
          if (Array.from(connections).some(docId => validDocuments.has(docId))) {
            validOneHopMentions.add(node.id);
          }
        }
      });

      // 2. Filter nodes based on validity
      const shouldKeepNode = (node: any): boolean => {
        if (node.type === 'mention') {
          return selectedEntities.has(node.id) || validOneHopMentions.has(node.id);
        }
        if (node.type === 'document') {
          return validDocuments.has(node.id);
        }
        return false;
      };

      // 3. Filter and deduplicate nodes
      const updatedNodes = getUniqueNodes(currentNodes.filter(shouldKeepNode));
      const simulationNodeIds = new Set(updatedNodes.map(n => n.id));

      // 4. Filter and deduplicate links
      const validLinks = currentLinks.filter(link => {
        if (!simulationNodeIds.has(link.source.id) || !simulationNodeIds.has(link.target.id)) {
          return false;
        }

        const sourceNode = updatedNodes.find(n => n.id === link.source.id);
        const targetNode = updatedNodes.find(n => n.id === link.target.id);
        
        if (!sourceNode || !targetNode) return false;

        return isValidLink(
          sourceNode,
          targetNode,
          validDocuments,
          selectedEntities,
          validOneHopMentions,
          simulationNodeIds
        );
      });

      const uniqueLinks = new Map();
      validLinks.forEach(link => {
        const linkId = link.source.id < link.target.id ? 
          `${link.source.id}-${link.target.id}` : 
          `${link.target.id}-${link.source.id}`;
        uniqueLinks.set(linkId, link);
      });

      return {
        nodes: updatedNodes,
        links: Array.from(uniqueLinks.values())
      };
    }

    // Add this unified update function
    function updateGraphWithMention(
      simulation: d3.Simulation<any, undefined>,
      graphRef: React.MutableRefObject<d3.Selection<SVGGElement, any, SVGGElement, unknown> | undefined>,
      forceParams: any,
      documents: DocumentNode[],
      mentions: MentionNode[],
      links: {source: string, target: string}[],
      selectedEntities: Set<string>,
      removedMentionId?: string
    ) {
      // 1. Build connection map from current and new links
      const connectionMap = new Map<string, Set<string>>();
      const currentLinks = simulation.force("link")?.links() || [];
      [...currentLinks, ...links].forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        
        if (!connectionMap.has(sourceId)) {
          connectionMap.set(sourceId, new Set());
        }
        if (!connectionMap.has(targetId)) {
          connectionMap.set(targetId, new Set());
        }
        
        connectionMap.get(sourceId)!.add(targetId);
        connectionMap.get(targetId)!.add(sourceId);
      });

      // 2. Identify valid documents (connected to selected mentions)
      const validDocuments = new Set<string>();
      const currentNodes = simulation.nodes();
      [...currentNodes, ...documents].forEach(node => {
        if (node.type === 'document') {
          const connections = connectionMap.get(node.id) || new Set();
          if (Array.from(connections).some(connectedId => 
            selectedEntities.has(connectedId) && connectedId !== removedMentionId
          )) {
            validDocuments.add(node.id);
          }
        }
      });

      // 3. Process and validate graph data
      const { nodes: updatedNodes, links: updatedLinks } = processGraphData(
        [...currentNodes, ...documents, ...mentions],
        [...currentLinks, ...links],
        selectedEntities,
        validDocuments,
        connectionMap
      );

      // 4. Update simulation with new data
      simulation.nodes(updatedNodes);
      simulation.force("link", createForceLinks(updatedLinks, forceParams));

      // 5. Update DOM elements
      if (graphRef.current) {
        // Remove all existing nodes and links
        graphRef.current.selectAll(".main-node").remove();
        graphRef.current.selectAll(".main-link").remove();

        // Render new elements
        renderLinks(graphRef.current, updatedLinks, "main-link", {
          stroke: "#999",
          strokeOpacity: 0.2
        });

        renderNodes(
          graphRef.current,
          updatedNodes,
          "main-node",
          {
            radius: 3,
            fill: (d: any) => d.type === "document" ? "steelblue" : "lightgreen",
          },
          selectedIdsRef,
          {
            mouseover: handleMouseOver,
            mouseout: handleMouseOut,
          }
        );
      }

      // 6. Restart simulation
      simulation.alpha(0.5).restart();

      return updatedNodes;
    }


    // Replace addToSimulation with updateGraphWithMention
    const addToSimulation = useCallback((
      links: { source: string; target: string }[],
      documents: any[],
      mentions: any[],
    ) => {
      if (!simulationRef.current) return;
      
      updateGraphWithMention(
        simulationRef.current,
        graphRef,
        forceParams,
        documents,
        mentions,
        links,
        selectedIdsRef.current
      );
    }, [forceParams]);

    // Replace removeNodesAndLinks with updateGraphWithMention
    const removeNodesAndLinks = useCallback((mentionId: string) => {
      if (!simulationRef.current) return;

      updateGraphWithMention(
        simulationRef.current,
        graphRef,
        forceParams,
        [], // No new documents
        [], // No new mentions
        [], // No new links
        selectedIdsRef.current,
        mentionId
      );
    }, [forceParams]);

    // Update useImperativeHandle
    React.useImperativeHandle(ref, () => ({
      updateNodesSelected,
      addToSimulation,
      removeNodesAndLinks
    }));

    return (
      <div className="w-full h-full relative">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="absolute inset-0"
        />
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-primary/50">
              Initializing graph...
            </div>
          </div>
        )}
      </div>
    );
  }
);

function idToSuffix(id: string) {
  // Convert the id to a hyphenated, lowercase, sanitized version
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
}