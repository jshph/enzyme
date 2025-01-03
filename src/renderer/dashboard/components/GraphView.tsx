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
    .force("charge", d3.forceManyBody().strength(-100)) //forceParams.charge))
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
    .style("opacity", (d: any) => d.type === 'document' ? (d.selected ? 0.7 : 0.3) : 0.7)
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
        .style("font-size", "12px");
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
    .on("click", eventHandlers.click);

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
  selectNodeHandler: (node: { id: string; text: string; type: string }, doAdd: boolean) => void;
  handleSetHoveredNode: (node: { id: string; text: string; type: string } | null) => void;
};

export type GraphViewRef = {
  updateNodeSelected: (nodeId: string, selected: boolean) => void;
  addToSimulation: (
    links: { source: string; target: string }[],
    documents: any[],
    mentions: any[]
  ) => void;
  removeNodesAndLinks: (mentionId: string) => void;
};

export const GraphView = forwardRef<GraphViewRef, GraphViewProps>(
  (props, ref) => {
    const {
      width = 800,
      height = 600,
      selectedIdsRef,
      selectNodeHandler,
      handleSetHoveredNode
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

    const handleMouseOver = (event: d3.D3Event, d: any) => {
      // if (!mainNode.current || !mainLink.current) return;
      handleSetHoveredNode(d);

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
      handleSetHoveredNode(null);
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

    function handleClick(this: SVGGElement, event: d3.D3Event, d: any) {
      if (selectedIdsRef.current.has(d.id)) {
        updateNodeSelected(d.id, false);
        selectedIdsRef.current.delete(d.id);
        selectNodeHandler(d, false);
      } else {
        updateNodeSelected(d.id, true);
        selectedIdsRef.current.add(d.id);
        selectNodeHandler(d, true);
      }
    }

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

    const handleForceParamChange =
      (param: keyof typeof forceParams) =>
      (event: Event, newValue: number | number[]) => {
        setForceParams((prev) => ({ ...prev, [param]: newValue as number }));
      };

    const updateNodeSelected = (nodeId: string, selected: boolean) => {
      if (svgRef.current) {
        // Update font weight
        document.documentElement.style.setProperty(
          `--node-font-weight-${idToSuffix(nodeId)}`,
          selected ? "600" : "400"
        );
        
        // Update node visibility
        d3.select(svgRef.current)
          .selectAll(".main-node")
          .filter((d: any) => d.id === nodeId)
          .style("opacity", selected ? 0.7 : 0.3);
      }
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

    // Update addToSimulation to use updateAdjacencyList
    const addToSimulation = (
      links: { source: string; target: string }[],
      documents: any[],
      mentions: any[]
    ) => {
      const simulation = simulationRef.current;
      if (!simulation) return;
      console.log("adding to simulation", documents, mentions);

      // Process links
      const adjList = adjacencyListRef.current;
      links.forEach((link) => {
        if (!adjList.has(link.source)) adjList.set(link.source, new Set());
        if (!adjList.has(link.target)) adjList.set(link.target, new Set());
        adjList.get(link.source)!.add(link.target);
        adjList.get(link.target)!.add(link.source);
      });

      // Create new nodes
      const newDocumentNodes = createNodes(
        documents,
        "document",
        (d) => ({ text: d.summary, links: d.links }),
        (d) => d.id
      );
      const newMentionNodes = createNodes(
        mentions,
        "mention",
        (d) => ({ text: d.text }),
        (d) => d.id
      );
      const newNodes = [...newDocumentNodes, ...newMentionNodes];

      // Get current simulation state
      const currentNodes = simulation.nodes();
      const nodePositions = new Map(
        currentNodes.map((d) => [d.id, { x: d.x, y: d.y }])
      );

      // Position new nodes around their neighbors
      newNodes.forEach((node: any) => {
        const neighbors = Array.from(adjList.get(node.id) || []);
        if (neighbors.length > 0) {
          const neighborPositions = neighbors
            .map((id) => nodePositions.get(id))
            .filter(
              (pos): pos is { x: number; y: number } => pos !== undefined
            );

          if (neighborPositions.length > 0) {
            const avgX = d3.mean(neighborPositions, (d) => d.x);
            const avgY = d3.mean(neighborPositions, (d) => d.y);
            node.x = avgX! + (Math.random() - 0.5) * 50;
            node.y = avgY! + (Math.random() - 0.5) * 50;
          } else {
            node.x = Math.random() * 100;
            node.y = Math.random() * 100;
          }
        } else {
          node.x = Math.random() * 100;
          node.y = Math.random() * 100;
        }
      });

      // Update simulation data
      const updatedNodes = [...currentNodes, ...newNodes];
      const updatedLinks = [...simulation.force("link").links(), ...links];

      simulation.nodes(updatedNodes);
      simulation.force("link", createForceLinks(updatedLinks, forceParams));

      // Restore node positions
      simulation.nodes().forEach((node) => {
        const pos = nodePositions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      });

      // Render new elements
      renderLinks(graphRef.current, links, "main-link", {
        stroke: "#999",
        strokeOpacity: 0.4,
      });

      renderNodes(
        graphRef.current,
        newNodes,
        "main-node",
        {
          radius: 3,
          fill: (d: any) =>
            d.type === "document" ? "steelblue" : "lightgreen",
        },
        {
          mouseover: handleMouseOver,
          mouseout: handleMouseOut,
          click: handleClick,
        }
      );

      // Reset alpha and restart simulation
      simulation.alpha(0.1).restart();
      simulation.alpha(0.1).restart();

      // Set up tick function only once
      if (!simulation.on("tick")) {
        simulation.on("tick", () => {
          updatePositions(
            d3.selectAll(".main-link"),
            d3.selectAll(".main-node")
          );
        });
      }

      // Update adjacency list with new links
      updateAdjacencyList(updatedLinks);
    };

    // Update removeNodesAndLinks to maintain adjacency list
    const removeNodesAndLinks = (mentionId: string) => {
      const simulation = simulationRef.current;
      if (!simulation) return;

      // Get current state
      const currentLinks = simulation.force("link")?.links() || [];
      const currentNodes = simulation.nodes();
      
      // Track different node types and states
      const selectedEntities = new Set(Array.from(selectedIdsRef.current));
      const oneHopMentions = new Set<string>();
      const mentionToDocuments = new Map<string, Set<string>>();
      const documentToMentions = new Map<string, Set<string>>();

      // Build relationship maps
      currentLinks.forEach(link => {
        const sourceId = link.source.id;
        const targetId = link.target.id;
        const sourceType = link.source.type;
        const targetType = link.target.type;

        if (sourceType === 'mention' && targetType === 'document') {
          if (!mentionToDocuments.has(sourceId)) mentionToDocuments.set(sourceId, new Set());
          if (!documentToMentions.has(targetId)) documentToMentions.set(targetId, new Set());
          mentionToDocuments.get(sourceId)!.add(targetId);
          documentToMentions.get(targetId)!.add(sourceId);
          
          // Track one-hop mentions (mentions found in documents)
          if (!selectedEntities.has(sourceId)) {
            oneHopMentions.add(sourceId);
          }
        } else if (sourceType === 'document' && targetType === 'mention') {
          if (!mentionToDocuments.has(targetId)) mentionToDocuments.set(targetId, new Set());
          if (!documentToMentions.has(sourceId)) documentToMentions.set(sourceId, new Set());
          mentionToDocuments.get(targetId)!.add(sourceId);
          documentToMentions.get(sourceId)!.add(targetId);
          
          // Track one-hop mentions
          if (!selectedEntities.has(targetId)) {
            oneHopMentions.add(targetId);
          }
        }
      });

      // Determine which nodes to keep
      const mentionsToKeep = new Set<string>();
      const documentsToKeep = new Set<string>();

      // Keep selected entities (except the one being removed)
      selectedEntities.forEach(entityId => {
        if (entityId !== mentionId) {
          mentionsToKeep.add(entityId);
          // Keep documents connected to kept entities
          mentionToDocuments.get(entityId)?.forEach(docId => documentsToKeep.add(docId));
        }
      });

      // For each document we're keeping, check its one-hop mentions
      documentsToKeep.forEach(docId => {
        documentToMentions.get(docId)?.forEach(mentionId => {
          if (oneHopMentions.has(mentionId)) {
            // Only keep one-hop mentions that are connected to documents
            // that are connected to remaining selected entities
            mentionsToKeep.add(mentionId);
          }
        });
      });

      // Filter links
      const updatedLinks = currentLinks.filter(link => {
        const sourceId = link.source.id;
        const targetId = link.target.id;
        const sourceType = link.source.type;
        const targetType = link.target.type;

        if (sourceType === 'mention') {
          if (!mentionsToKeep.has(sourceId)) return false;
          return targetType === 'document' ? documentsToKeep.has(targetId) : true;
        } else if (targetType === 'mention') {
          if (!mentionsToKeep.has(targetId)) return false;
          return sourceType === 'document' ? documentsToKeep.has(sourceId) : true;
        }
        return true;
      });

      // Filter nodes
      const updatedNodes = currentNodes.filter(node => {
        if (node.type === 'mention') {
          return mentionsToKeep.has(node.id);
        } else if (node.type === 'document') {
          return documentsToKeep.has(node.id);
        }
        return false;
      });

      // Update simulation data
      simulation.nodes(updatedNodes);
      simulation.force("link", createForceLinks(updatedLinks, forceParams));

      // Update adjacency list with remaining links
      updateAdjacencyList(updatedLinks, mentionId);

      // Update DOM
      graphRef.current?.selectAll(".main-link")
        .data(updatedLinks, (d: any) => `${d.source.id}-${d.target.id}`)
        .exit()
        .remove();

      graphRef.current?.selectAll(".main-node")
        .data(updatedNodes, (d: any) => d.id)
        .exit()
        .remove();

      simulation.alpha(0.1).restart();
    };

    // Update useImperativeHandle
    React.useImperativeHandle(ref, () => ({
      updateNodeSelected,
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

/**
 * 
 * 
        {/* <div style={{ padding: "20px" }}>
          <div>
            <label htmlFor="collision-radius-slider">Collision Radius</label>
            <Slider
              value={forceParams.collisionRadius}
              onChange={handleForceParamChange("collisionRadius")}
              min={5}
              max={50}
              step={1}
              aria-labelledby="collision-radius-slider"
              id="collision-radius-slider"
            />
          </div>
          <div>
            <label htmlFor="link-distance-slider">Link Distance</label>
            <Slider
              value={forceParams.linkDistance}
              onChange={handleForceParamChange("linkDistance")}
              min={10}
              max={1000}
              step={5}
              aria-labelledby="link-distance-slider"
              id="link-distance-slider"
            />
          </div>
          <div>
            <label htmlFor="link-strength-slider">Link Strength</label>
            <Slider
              value={forceParams.linkStrength}
              onChange={handleForceParamChange("linkStrength")}
              min={0}
              max={1}
              step={0.1}
              aria-labelledby="link-strength-slider"
              id="link-strength-slider"
            />
          </div>
          <div>
            <label htmlFor="mention-link-distance-ratio-slider">
              Mention Link Distance Ratio
            </label>
            <Slider
              value={forceParams.mentionLinkDistanceRatio}
              onChange={handleForceParamChange("mentionLinkDistanceRatio")}
              min={1}
              max={5}
              step={0.1}
              aria-labelledby="mention-link-distance-ratio-slider"
              id="mention-link-distance-ratio-slider"
            />
          </div>
          <div>
            <label htmlFor="mention-link-strength-ratio-slider">
              Mention Link Strength Ratio
            </label>
            <Slider
              value={forceParams.mentionLinkStrengthRatio}
              onChange={handleForceParamChange("mentionLinkStrengthRatio")}
              min={0.01}
              max={1}
              step={0.01}
              aria-labelledby="mention-link-strength-ratio-slider"
              id="mention-link-strength-ratio-slider"
            />
          </div>
        </div>
 */
