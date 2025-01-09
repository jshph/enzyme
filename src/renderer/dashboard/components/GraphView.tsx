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
  mentionToDocuments: Map<string, Set<string>>; // Track which docs each mention connects to
  documentToMentions: Map<string, Set<string>>; // Track which mentions each doc contains
  selectedMentionIds: Set<string>; // Track which nodes are selected
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
  selectedMentionIds: Set<string>,
  removedMentionId?: string,
): GraphState {
  const newState = {
    nodes: new Map(state.nodes),
    edges: new Set(state.edges),
    mentionToDocuments: new Map(state.mentionToDocuments),
    documentToMentions: new Map(state.documentToMentions),
    selectedMentionIds: new Set(selectedMentionIds)
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

    // Remove affected edges
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
      if (state.selectedMentionIds.has(mentionId)) {
        docs.forEach(doc => validDocs.add(doc));
      }
    }

    // Remove mentions that are no longer connected to valid docs
    for (const [mentionId, docs] of newState.mentionToDocuments.entries()) {
      if (!state.selectedMentionIds.has(mentionId)) {
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
      newState.mentionToDocuments.set(mention.id, new Set());
    }
  });

  // Process links
  links.forEach(({source, target}) => {
    const edgeId = createEdgeId(source, target);
    newState.edges.add(edgeId);

    // Update tracking maps based on node types
    const sourceNode = newState.nodes.get(source);
    const targetNode = newState.nodes.get(target);

    if (sourceNode?.type === 'mention' && targetNode?.type === 'document') {
      const mentionDocs = newState.mentionToDocuments.get(source) || new Set();
      mentionDocs.add(target);
      newState.mentionToDocuments.set(source, mentionDocs);

      const docMentions = newState.documentToMentions.get(target) || new Set();
      docMentions.add(source);
      newState.documentToMentions.set(target, docMentions);
    } 
    else if (sourceNode?.type === 'document' && targetNode?.type === 'mention') {
      const mentionDocs = newState.mentionToDocuments.get(target) || new Set();
      mentionDocs.add(source);
      newState.mentionToDocuments.set(target, mentionDocs);

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
  width: number,
  height: number,
  forceParams: any
) {
  const simulation = d3
    .forceSimulation([])
    .force("charge", d3.forceManyBody().strength(-100))
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
  selectedMentionIdsRef: MutableRefObject<Set<string>>,
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
      if (d.type === 'document') {
        return 0.3; // Default document opacity
      }
      // For mentions, high opacity if selected, low if one-hop
      return selectedMentionIdsRef.current.has(d.id) ? 0.7 : 0.3;
    })
    .style(
      "font-weight",
      (d: any) => `var(--node-font-weight-${idToSuffix(d.id)}, 400)`
    );

  nodeEnter.append("circle").attr("r", style.radius).style("fill", style.fill);

  if (doRenderText) {
    nodeEnter.each(function (d: any) {
      d3
        .select(this)
        .append("text")
        .attr("dy", "0.35em")
        .style("fill", d => d.type === 'mention' ? 'rgba(144, 238, 144, 0.6)' : '#e4e6eb')
        .style("font-size", "12px")
        .style("opacity", d => {
          return d.type === 'mention' && selectedMentionIdsRef.current.has(d.id) ? 1 : 0.3;
        })
        .text(d => d.name);
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
  selectedMentionIdsRef: MutableRefObject<Set<string>>;
};

export type GraphViewRef = {
  updateNodesSelected: (nodeIds: string[], count: number) => void;
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
      selectedMentionIdsRef
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

    // Add new state
    const [graphState, setGraphState] = useState<GraphState>({
      nodes: new Map(),
      edges: new Set(),
      mentionToDocuments: new Map(),
      documentToMentions: new Map(),
      selectedMentionIds: new Set()
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
        selectedMentionIdsRef.current
      );
      setGraphState(newState);

      // Convert to simulation data
      const { nodes, links: simulationLinks } = prepareSimulationData(newState);

      // Store current positions
      const nodePositions = new Map(
        simulationRef.current.nodes().map(d => [d.id, { x: d.x, y: d.y }])
      );

      // Update simulation
      simulationRef.current.nodes(nodes);
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

      // Render links
      renderLinks(graphRef.current, simulationLinks, "main-link", {
        stroke: "#999",
        strokeOpacity: 0.2
      });

      // Render nodes
      renderNodes(
        graphRef.current,
        nodes,
        "main-node",
        {
          radius: 3,
          fill: (d: any) => d.type === "document" ? "steelblue" : "lightgreen",
        },
        selectedMentionIdsRef,
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
        selectedMentionIdsRef.current,
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
        strokeOpacity: 0.2
      });

      renderNodes(
        graphRef.current,
        nodes,
        "main-node",
        {
          radius: 3,
          fill: (d: any) => d.type === "document" ? "steelblue" : "lightgreen",
        },
        selectedMentionIdsRef,
        {
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
        }
      );

      simulationRef.current.alpha(0.1).restart();

    }, [graphState, forceParams, handleMouseOver, handleMouseOut]);

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