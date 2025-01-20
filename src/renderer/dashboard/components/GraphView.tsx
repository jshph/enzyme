import * as d3 from "d3";

import React, {
  useRef,
  useEffect,
  forwardRef,
  useState,
  useCallback,
} from "react";

const ZOOM_THRESHOLD = 1.5; // Adjust this value to set when document text appears

export interface DocumentNode {
  id: string;
  name: string;
  type: 'document';
}

export interface MentionNode {
  id: string;
  type: 'mention';
  name: string;
}

interface GraphState {
  nodes: Map<string, DocumentNode | MentionNode>;
  edges: Set<string>; // Format: "sourceId->targetId"
  mentionToDocuments: Map<string, string[]>; // Ordered list of docs each mention connects to (to preserve order in index)
  documentToMentions: Map<string, Set<string>>; // Track which mentions each doc contains
  selectedMentionDocCounts: Map<string, number>; // Track which nodes are selected
}

function createEdgeId(sourceId: string, targetId: string): string {
  // Ensure consistent edge IDs regardless of direction
  return sourceId < targetId ? 
    `${sourceId}->${targetId}` : 
    `${targetId}->${sourceId}`;
}

function updateGraphState(
  state: GraphState,
  documents: DocumentNode[],
  mentions: MentionNode[],
  links: {source: string, target: string}[],
  selectedMentionDocCounts: Map<string, number>,
  removedMentionId?: string,
): GraphState {
  const newState = {
    nodes: new Map(state.nodes),
    edges: new Set(state.edges), // Keep existing edges initially
    mentionToDocuments: new Map(state.mentionToDocuments),
    documentToMentions: new Map(state.documentToMentions),
    selectedMentionDocCounts: new Map(selectedMentionDocCounts)
  };

  // Handle removal first if specified
  if (removedMentionId) {
    // Get docs connected to this mention
    const connectedDocs = newState.mentionToDocuments.get(removedMentionId) || new Set();
    
    // For each connected doc
    for (const docId of connectedDocs) {
      const docMentions = newState.documentToMentions.get(docId);
      if (docMentions) {
        docMentions.delete(removedMentionId);
        
        // Remove doc if it has no other mentions
        if (docMentions.size === 0) {
          newState.nodes.delete(docId);
          newState.documentToMentions.delete(docId);
        }
      }
    }

    // Remove mention and its tracking data
    newState.nodes.delete(removedMentionId);
    newState.mentionToDocuments.delete(removedMentionId);

    // Only remove edges connected to the removed mention
    newState.edges = new Set(
      Array.from(newState.edges).filter(edge => {
        const [source, target] = edge.split('->');
        return source !== removedMentionId && target !== removedMentionId;
      })
    );

    // Traverse graph and remove:
    // - mention nodes that are no longer connected to any docs of selected mentions
    // - document nodes that are no longer connected to any selected mentions
    // - edges that were connected to any of the removed nodes
    // Get all documents connected to selected mentions
    const validDocs = new Set<string>();
    for (const [mentionId, docs] of newState.mentionToDocuments.entries()) {
      if (state.selectedMentionDocCounts.has(mentionId)) {
        docs.forEach(doc => validDocs.add(doc));
      }
    }

    // Remove mentions that are no longer connected to valid docs
    for (const [mentionId, docs] of newState.mentionToDocuments.entries()) {
      if (!state.selectedMentionDocCounts.has(mentionId)) {
        const hasValidDoc = Array.from(docs).some(doc => validDocs.has(doc));
        if (!hasValidDoc) {
          newState.nodes.delete(mentionId);
          newState.mentionToDocuments.delete(mentionId);
        }
      }
    }

    // Remove documents not in validDocs
    for (const [docId] of newState.documentToMentions) {
      if (!validDocs.has(docId)) {
        newState.nodes.delete(docId);
        newState.documentToMentions.delete(docId);
      }
    }

    // Clean up edges connected to removed nodes
    newState.edges = new Set(
      Array.from(newState.edges).filter(edge => {
        const [source, target] = edge.split('->');
        return newState.nodes.has(source) && newState.nodes.has(target);
      })
    );
  }

  // Add new documents
  documents.forEach(doc => {
    if (!newState.nodes.has(doc.id)) {
      newState.nodes.set(doc.id, doc);
      newState.documentToMentions.set(doc.id, new Set());
    }
  });

  // Add new mentions
  mentions.forEach(mention => {
    if (!newState.nodes.has(mention.id)) {
      newState.nodes.set(mention.id, mention);
      newState.mentionToDocuments.set(mention.id, []);
    }
  });

  // Process links
  links.forEach(({source, target}) => {
    const edgeId = createEdgeId(source, target);
    newState.edges.add(edgeId);

    const sourceNode = newState.nodes.get(source);
    const targetNode = newState.nodes.get(target);

    if (sourceNode?.type === 'mention' && targetNode?.type === 'document') {
      const mentionDocs = newState.mentionToDocuments.get(source) || [];
      if (!mentionDocs.includes(target)) {
        mentionDocs.push(target);
        newState.mentionToDocuments.set(source, mentionDocs);
      }

      const docMentions = newState.documentToMentions.get(target) || new Set();
      docMentions.add(source);
      newState.documentToMentions.set(target, docMentions);
    } 
    else if (sourceNode?.type === 'document' && targetNode?.type === 'mention') {
      const mentionDocs = newState.mentionToDocuments.get(target) || [];
      if (!mentionDocs.includes(source)) {
        mentionDocs.push(source);
        newState.mentionToDocuments.set(target, mentionDocs);
      }

      const docMentions = newState.documentToMentions.get(source) || new Set();
      docMentions.add(target);
      newState.documentToMentions.set(source, docMentions);
    }
  });

  return newState;
}

// Add this function to convert graph state to simulation data
function prepareSimulationData(state: GraphState) {
  const nodes = Array.from(state.nodes.values());
  const links = Array.from(state.edges).map(edge => {
    const [source, target] = edge.split('->');
    return { source, target };
  });
  return { nodes, links };
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
  width: number,
  height: number,
  forceParams: any
) {
  const simulation = d3
    .forceSimulation([])
    .force("charge", d3.forceManyBody().strength(-20))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(forceParams.collisionRadius))
    .force("link", createForceLinks([], forceParams));

  // Set up tick function once during simulation creation
  simulation.on("tick", () => {
    updatePositions(
      d3.selectAll(".main-link"),
      d3.selectAll(".main-node")
    );
  });

  return simulation;
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
  selectedMentionDocCounts: Map<string, number>,
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
      if (d.type === 'mention') {
        return selectedMentionDocCounts.has(d.id) ? 1 : 0.3;
      }
      // For documents, start with low opacity - will be updated when connected to selected mentions
      return 0.05;
    });

  nodeEnter.append("circle").attr("r", style.radius).style("fill", style.fill);

  if (doRenderText) {
    nodeEnter.each(function (d: any) {
      const text = d3
        .select(this)
        .append("text")
        .attr("dx", "0.6em")
        .style("fill", d => d.type === 'mention' ? 'rgba(144, 238, 144, 0.6)' : '#e4e6eb')
        .style("font-size", "12px")
        .style("opacity", d => {
          if (d.type === 'mention') {
            return selectedMentionDocCounts.has(d.id) ? 1 : 0.3;
          }
          // Text opacity will be updated in updateDocCountForMention
          return 0.05;
        });

      const words = d.name.split(' ');
      if (words.length > 7) {
        // Split into chunks of 5 words
        const chunkSize = 7;
        const chunks = [];
        for (let i = 0; i < words.length; i += chunkSize) {
          chunks.push(words.slice(i, i + chunkSize).join(' '));
        }
        
        chunks.forEach((chunk, i) => {
          text.append('tspan')
            .attr('x', 0)
            .attr('dy', i === 0 ? '-0.35em' : '1.2em')
            .attr('dx', '0.6em')
            .text(chunk);
        });
      } else {
        text.attr("dy", "0.35em")
            .text(d.name);
      }
    });
  }

  // Update existing nodes
  const allNodes = nodeSelection.merge(nodeEnter);
  
  // Update opacity for all nodes (both new and existing)
  allNodes
    .style("opacity", (d: any) => {
      if (d.type === 'mention') {
        return selectedMentionDocCounts.has(d.id) ? 1 : 0.3;
      }
      return 0.05;
    })
    // Add back the event handlers
    .on("mouseover", eventHandlers.mouseover)
    .on("mouseout", eventHandlers.mouseout);

  return allNodes;
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
  selectedMentionDocCounts: Map<string, number>;
};

export type GraphViewRef = {
  updateDocCountForMention: (mention: string, count: number) => void;
  addToSimulation: (
    links: { source: string; target: string }[],
    documents: any[],
    mentions: any[]
  ) => void;
  removeNodesAndLinks: (mentionId: string) => void;
};

// Update the GraphView component to use the new unified function
export const GraphView = forwardRef<GraphViewRef, GraphViewProps>(
  (props, ref) => {
    const {
      width = 800,
      height = 600,
      selectedMentionDocCounts
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
      mentionLinkDistanceRatio: 4, // 90 / 40
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

    const [graphState, setGraphState] = useState<GraphState>({
      nodes: new Map(),
      edges: new Set(),
      mentionToDocuments: new Map(),
      documentToMentions: new Map(),
      selectedMentionDocCounts: new Map()
    });

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

    useEffect(() => {
      updateDocCountForMention();
    }, [selectedMentionDocCounts]);

    const updateDocCountForMention = async () => {
      if (!svgRef.current) return;

      // Get all selected mentions and their doc counts
      const selectedMentions = Array.from(selectedMentionDocCounts.entries());
      
      // Get valid docs for each selected mention
      const validDocsPerMention = new Map<string, string[]>();
      selectedMentions.forEach(([mentionId, count]) => {
        const mentionDocs = graphState.mentionToDocuments.get(mentionId) || [];
        validDocsPerMention.set(mentionId, mentionDocs.slice(0, count));
      });

      // Update node and text opacity
      d3.select(svgRef.current)
        .selectAll(".main-node")
        .each(function(d: any) {
          const node = d3.select(this);
          const nodeData = d;
          
          if (nodeData.type === 'mention') {
            // Update mention opacity based on selection
            const opacity = selectedMentionDocCounts.has(nodeData.id) ? 1 : 0.3;
            node.style("opacity", opacity);
            node.select("text").style("opacity", opacity);
          } 
          else if (nodeData.type === 'document') {
            // Check if this doc is valid for any selected mention
            let isValidForAnyMention = false;
            for (const [mentionId, validDocs] of validDocsPerMention) {
              if (validDocs.includes(nodeData.id)) {
                isValidForAnyMention = true;
                break;
              }
            }
            
            const opacity = isValidForAnyMention ? 0.8 : 0.05;
            node.transition()
              .duration(200)
              .style("opacity", opacity);
            node.select("text").transition()
              .duration(200)
              .style("opacity", opacity);
          }
        });

      // Update edge opacity
      d3.select(svgRef.current)
        .selectAll(".main-link")
        .transition()
        .duration(200)
        .style("stroke-opacity", (d: any) => {
          const sourceId = d.source.id || d.source;
          const targetId = d.target.id || d.target;
          
          // Check if this edge connects a selected mention to one of its valid docs
          for (const [mentionId, validDocs] of validDocsPerMention) {
            if ((sourceId === mentionId && validDocs.includes(targetId)) ||
                (targetId === mentionId && validDocs.includes(sourceId))) {
              return 0.4;
            }
          }
          return 0.05;
        });
    };

    // Update addToSimulation
    const addToSimulation = useCallback((
      links: { source: string; target: string }[],
      documents: DocumentNode[],
      mentions: MentionNode[],
    ) => {
      if (!simulationRef.current || !graphRef.current) return;

      // Update graph state
      const newState = updateGraphState(
        graphState,
        documents,
        mentions,
        links,
        selectedMentionDocCounts
      );
      setGraphState(newState);

      // Convert to simulation data, ensuring unique nodes
      const uniqueNodes = Array.from(newState.nodes.values());
      const simulationLinks = Array.from(newState.edges).map(edge => {
        const [source, target] = edge.split('->');
        return { 
          source: newState.nodes.get(source),
          target: newState.nodes.get(target)
        };
      });

      // Store current positions
      const nodePositions = new Map(
        simulationRef.current.nodes().map(d => [d.id, { x: d.x, y: d.y }])
      );

      // Update simulation with unique nodes
      simulationRef.current.nodes(uniqueNodes);
      simulationRef.current.force("link", createForceLinks(simulationLinks, forceParams));

      // Restore positions for existing nodes
      simulationRef.current.nodes().forEach(node => {
        const pos = nodePositions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      });

      // Clear and re-render
      graphRef.current.selectAll(".main-node").remove();
      graphRef.current.selectAll(".main-link").remove();

      // Render links with unique nodes
      renderLinks(graphRef.current, simulationLinks, "main-link", {
        stroke: "#999",
        strokeOpacity: 0.05
      });

      // Render nodes
      renderNodes(
        graphRef.current,
        uniqueNodes,
        "main-node",
        {
          radius: 3,
          fill: (d: any) => d.type === "document" ? "steelblue" : "lightgreen",
        },
        selectedMentionDocCounts,
        {
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
        }
      );

      simulationRef.current.alpha(0.1).restart();

    }, [graphState, forceParams, handleMouseOver, handleMouseOut]);

    // Update removeNodesAndLinks
    const removeNodesAndLinks = useCallback((mentionId: string) => {
      if (!simulationRef.current || !graphRef.current) return;

      const newState = updateGraphState(
        graphState,
        [],
        [],
        [],
        selectedMentionDocCounts,
        mentionId
      );
      setGraphState(newState);

      const { nodes, links } = prepareSimulationData(newState);

      simulationRef.current.nodes(nodes);
      simulationRef.current.force("link", createForceLinks(links, forceParams));

      // Re-render with same pattern as addToSimulation
      graphRef.current.selectAll(".main-node").remove();
      graphRef.current.selectAll(".main-link").remove();

      renderLinks(graphRef.current, links, "main-link", {
        stroke: "#999",
        strokeOpacity: 0.05
      });

      renderNodes(
        graphRef.current,
        nodes,
        "main-node",
        {
          radius: 3,
          fill: (d: any) => d.type === "document" ? "steelblue" : "lightgreen",
        },
        selectedMentionDocCounts,
        {
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
        }
      );

      simulationRef.current.alpha(0.5).restart();

    }, [graphState, forceParams, handleMouseOver, handleMouseOut]);

    // Update useImperativeHandle
    React.useImperativeHandle(ref, () => ({
      updateDocCountForMention,
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