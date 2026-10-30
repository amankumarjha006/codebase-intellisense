import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ArchitectureGraphNode, ArchitectureGraphRelationship } from '../../lib/types';

interface LayoutNode extends ArchitectureGraphNode {
  x: number;
  y: number;
  width: number;
  height: number;
  incomingCount: number;
  outgoingCount: number;
}

interface ArchitectureGraphCanvasProps {
  nodes: ArchitectureGraphNode[];
  relationships: ArchitectureGraphRelationship[];
  selectedNodeId: string | null;
  searchQuery: string;
  repoId: string;
  onSelectNode: (nodeId: string | null) => void;
}

export function ArchitectureGraphCanvas({
  nodes,
  relationships,
  selectedNodeId,
  searchQuery,
  repoId,
  onSelectNode,
}: ArchitectureGraphCanvasProps) {
  const navigate = useNavigate();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  // Pan and Zoom transform state
  const [transform, setTransform] = React.useState({ x: 60, y: 40, scale: 0.95 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = React.useState(true);

  // Compute incoming and outgoing ID sets for the selected node
  const { incomingIds, outgoingIds } = React.useMemo(() => {
    if (!selectedNodeId) return { incomingIds: new Set<string>(), outgoingIds: new Set<string>() };
    const inc = new Set<string>();
    const out = new Set<string>();
    for (const r of relationships) {
      if (r.target === selectedNodeId) inc.add(r.source);
      if (r.source === selectedNodeId) out.add(r.target);
    }
    return { incomingIds: inc, outgoingIds: out };
  }, [selectedNodeId, relationships]);

  // Compute search match set
  const searchMatchIds = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const matches = new Set<string>();
    for (const n of nodes) {
      const name = (n.name || n.label || '').toLowerCase();
      const path = (n.path || n.sublabel || '').toLowerCase();
      if (name.includes(q) || path.includes(q) || (n.language && n.language.toLowerCase().includes(q))) {
        matches.add(n.id);
      }
    }
    return matches;
  }, [nodes, searchQuery]);

  // Deterministic Layered / Column Graph Layout
  const layoutNodes = React.useMemo(() => {
    if (nodes.length === 0) return [];

    const CARD_WIDTH = 250;
    const CARD_HEIGHT = 84;
    const COL_GAP = 130;
    const ROW_GAP = 28;

    // Calculate in/out counts for each node
    const inCounts = new Map<string, number>();
    const outCounts = new Map<string, number>();
    for (const r of relationships) {
      outCounts.set(r.source, (outCounts.get(r.source) || 0) + 1);
      inCounts.set(r.target, (inCounts.get(r.target) || 0) + 1);
    }

    // Classify nodes into structural layers / columns
    const columns: ArchitectureGraphNode[][] = [[], [], [], []];

    // Check if nodes are mostly pipeline stages
    const isPipeline = nodes.every((n) => n.type === 'pipeline' || !n.path);

    if (isPipeline) {
      // Linear or multi-column pipeline layout
      const perCol = Math.max(2, Math.ceil(nodes.length / 3));
      nodes.forEach((n, idx) => {
        const colIdx = Math.min(2, Math.floor(idx / perCol));
        if (!columns[colIdx]) columns[colIdx] = [];
        columns[colIdx].push(n);
      });
    } else {
      for (const n of nodes) {
        const path = n.path || '';
        if (path.startsWith('client/') || n.type === 'pipeline') {
          columns[0].push(n);
        } else if (path.includes('/api/') || path.endsWith('main.py')) {
          columns[1].push(n);
        } else if (path.includes('/services/') || path.includes('/parser/') || path.includes('/chunking/')) {
          columns[2].push(n);
        } else {
          columns[3].push(n);
        }
      }
    }

    // Filter out empty columns and compute positions
    const activeColumns = columns.filter((col) => col.length > 0);
    const maxColumnHeight = Math.max(...activeColumns.map((col) => col.length * (CARD_HEIGHT + ROW_GAP)));

    const result: LayoutNode[] = [];

    activeColumns.forEach((col, colIdx) => {
      const colX = colIdx * (CARD_WIDTH + COL_GAP);
      const colHeight = col.length * (CARD_HEIGHT + ROW_GAP) - ROW_GAP;
      const startY = (maxColumnHeight - colHeight) / 2;

      col.forEach((node, rowIdx) => {
        const nodeY = startY + rowIdx * (CARD_HEIGHT + ROW_GAP);
        result.push({
          ...node,
          x: colX,
          y: nodeY,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          incomingCount: inCounts.get(node.id) || 0,
          outgoingCount: outCounts.get(node.id) || 0,
        });
      });
    });

    return result;
  }, [nodes, relationships]);

  // Layout node map for fast lookup
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of layoutNodes) {
      map.set(n.id, n);
    }
    return map;
  }, [layoutNodes]);

  // Fit view helper
  const fitView = React.useCallback(() => {
    if (!containerRef.current || layoutNodes.length === 0) return;
    const container = containerRef.current.getBoundingClientRect();
    if (container.width === 0 || container.height === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of layoutNodes) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    }

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const padding = 70;

    const scaleX = (container.width - padding * 2) / Math.max(1, graphWidth);
    const scaleY = (container.height - padding * 2) / Math.max(1, graphHeight);
    const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.15);

    const x = (container.width - graphWidth * scale) / 2 - minX * scale;
    const y = (container.height - graphHeight * scale) / 2 - minY * scale;

    setTransform({ x, y, scale });
  }, [layoutNodes]);

  // Auto fit-view on first render
  React.useEffect(() => {
    const timer = setTimeout(fitView, 50);
    return () => clearTimeout(timer);
  }, [fitView]);

  // Pan event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with left mouse button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | SVGElement;
    // Don't drag if clicking directly on a button or link
    if (target.closest('button') || target.closest('a')) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(transform.scale * zoomFactor, 0.25), 2.5);

    // Zoom toward mouse pointer
    const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
    const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);

    setTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleZoomIn = () => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, 2.5),
    }));
  };

  const handleZoomOut = () => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(prev.scale * 0.8, 0.25),
    }));
  };

  const handleResetZoom = () => {
    setTransform((prev) => ({
      ...prev,
      scale: 1.0,
    }));
  };

  // Keyboard navigation across layout nodes
  const handleNodeKeyDown = (e: React.KeyboardEvent, nodeId: string, currentIndex: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectNode(selectedNodeId === nodeId ? null : nodeId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onSelectNode(null);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextNode = layoutNodes[(currentIndex + 1) % layoutNodes.length];
      if (nextNode) {
        const el = document.getElementById(`graph-node-${nextNode.id}`);
        el?.focus();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevNode = layoutNodes[(currentIndex - 1 + layoutNodes.length) % layoutNodes.length];
      if (prevNode) {
        const el = document.getElementById(`graph-node-${prevNode.id}`);
        el?.focus();
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`relative flex-1 h-full w-full bg-[var(--color-page)] overflow-hidden select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <svg
        ref={svgRef}
        className="w-full h-full pointer-events-auto"
        onClick={(e) => {
          if (e.target === svgRef.current || (e.target as Element).tagName === 'svg') {
            onSelectNode(null);
          }
        }}
      >
        <defs>
          {/* Subtle Canvas Dot Grid Pattern */}
          <pattern id="arch-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.06)" />
          </pattern>

          {/* Arrowhead Markers */}
          <marker
            id="arrow-neutral"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255,255,255,0.22)" />
          </marker>

          <marker
            id="arrow-mint"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#B9E4D0" />
          </marker>

          <marker
            id="arrow-cyan"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#5EEAD4" />
          </marker>
        </defs>

        {/* Background Dot Grid */}
        <rect width="100%" height="100%" fill="url(#arch-grid)" />

        {/* Scaled & Translated Graph Layer */}
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges Layer */}
          <g className="edges-layer">
            {relationships.map((rel, idx) => {
              const source = nodeMap.get(rel.source);
              const target = nodeMap.get(rel.target);
              if (!source || !target) return null;

              const isOutgoing = selectedNodeId === rel.source;
              const isIncoming = selectedNodeId === rel.target;
              const isSelectedRel = isOutgoing || isIncoming;
              const isDimmed = selectedNodeId && !isSelectedRel;

              // Calculate anchor points
              const x1 = source.x + source.width;
              const y1 = source.y + source.height / 2;
              const x2 = target.x;
              const y2 = target.y + target.height / 2;

              let d = '';
              if (x2 > x1) {
                // Forward cubic Bézier curve
                const dx = (x2 - x1) * 0.5;
                d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              } else {
                // Backward loop-around curve
                const offset = 40;
                d = `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
              }

              let strokeColor = 'rgba(255,255,255,0.14)';
              let strokeWidth = 1.5;
              let markerEnd = 'url(#arrow-neutral)';

              if (isOutgoing) {
                strokeColor = '#B9E4D0';
                strokeWidth = 2.5;
                markerEnd = 'url(#arrow-mint)';
              } else if (isIncoming) {
                strokeColor = '#5EEAD4';
                strokeWidth = 2.5;
                markerEnd = 'url(#arrow-cyan)';
              }

              return (
                <path
                  key={`${rel.source}->${rel.target}-${idx}`}
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={rel.type === 'FLOWS_TO' ? '4 3' : undefined}
                  markerEnd={markerEnd}
                  opacity={isDimmed ? 0.12 : 1}
                  className="transition-opacity duration-200"
                />
              );
            })}
          </g>

          {/* Nodes Layer */}
          <g className="nodes-layer">
            {layoutNodes.map((node, nodeIdx) => {
              const isSelected = selectedNodeId === node.id;
              const isIncoming = incomingIds.has(node.id);
              const isOutgoing = outgoingIds.has(node.id);
              const isConnected = isSelected || isIncoming || isOutgoing;

              // Search filtering
              const isSearchMatch = searchMatchIds ? searchMatchIds.has(node.id) : null;
              const isDimmed = (selectedNodeId && !isConnected) || (searchMatchIds && !isSearchMatch);

              let borderClass = 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]';
              let bgClass = 'bg-[var(--color-surface)]';
              let ringClass = '';

              if (isSelected) {
                borderClass = 'border-[var(--color-mint-accent,#B9E4D0)]';
                bgClass = 'bg-[var(--color-mint-selected-bg,#253A32)]';
                ringClass = 'ring-2 ring-[var(--color-mint-accent,#B9E4D0)]/40 shadow-lg';
              } else if (isIncoming) {
                borderClass = 'border-[#5EEAD4]';
                bgClass = 'bg-[var(--color-raised)]';
                ringClass = 'ring-1 ring-[#5EEAD4]/30';
              } else if (isOutgoing) {
                borderClass = 'border-[var(--color-mint-accent,#B9E4D0)]/70';
                bgClass = 'bg-[var(--color-raised)]';
                ringClass = 'ring-1 ring-[var(--color-mint-accent,#B9E4D0)]/20';
              } else if (isSearchMatch) {
                borderClass = 'border-[var(--color-mint-accent,#B9E4D0)]';
                ringClass = 'ring-2 ring-[var(--color-mint-accent,#B9E4D0)]/50';
              }

              return (
                <foreignObject
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  className={`overflow-visible transition-opacity duration-200 ${isDimmed ? 'opacity-25' : 'opacity-100'}`}
                >
                  <div
                    id={`graph-node-${node.id}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Node ${node.name || node.label || node.id}, type: ${node.type || 'module'}. Press Enter to inspect, Arrow keys to navigate.`}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => handleNodeKeyDown(e, node.id, nodeIdx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNode(node.id);
                    }}
                    className={`w-full h-full rounded-[var(--radius-panel)] border ${borderClass} ${bgClass} ${ringClass} p-2.5 flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-md select-none group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-mint-accent,#B9E4D0)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-page)]`}
                  >
                    {/* Header Row: Icon, Title, Badge */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MaterialIcon
                          name={node.type === 'file' ? 'description' : node.type === 'pipeline' ? 'account_tree' : 'code'}
                          size={16}
                          fill={isSelected ? 1 : 0}
                          className={isSelected ? 'text-[var(--color-mint-accent,#B9E4D0)] shrink-0' : 'text-[var(--color-muted)] shrink-0 group-hover:text-[var(--color-text)]'}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-[var(--color-text)] truncate">
                          {node.name || node.label || node.id}
                        </span>
                      </div>

                      {/* Open Source Button (Direct Jump) */}
                      {node.path && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(node.path || '')}`);
                          }}
                          title="Open source file"
                          aria-label={`Open source file ${node.path}`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-mint-accent,#B9E4D0)] transition shrink-0"
                        >
                          <MaterialIcon name="open_in_new" size={13} fill={0} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {/* Path / Sublabel */}
                    <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                      {node.path || node.sublabel || 'module'}
                    </div>

                    {/* Footer Row: Metadata Badges */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-[var(--color-muted)]">
                      <div className="flex items-center gap-1">
                        {node.language && (
                          <span className="px-1 py-0.2 rounded bg-[var(--color-page)]/80 text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                            {node.language}
                          </span>
                        )}
                        <span className="capitalize">{node.type || 'node'}</span>
                      </div>

                      {(node.incomingCount > 0 || node.outgoingCount > 0) && (
                        <div className="flex items-center gap-1.5">
                          {node.incomingCount > 0 && (
                            <span className="text-[#5EEAD4]">{node.incomingCount} in</span>
                          )}
                          {node.outgoingCount > 0 && (
                            <span className="text-[var(--color-mint-accent,#B9E4D0)]">{node.outgoingCount} out</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </foreignObject>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Floating Canvas Controls Overlay (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 p-1 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-raised)]/90 backdrop-blur shadow-xl">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomIn}
              aria-label="Zoom in"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <MaterialIcon name="add" size={18} fill={0} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleZoomOut}
              aria-label="Zoom out"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <MaterialIcon name="remove" size={18} fill={0} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Zoom Out</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-[var(--color-border)] mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={fitView}
              aria-label="Fit to screen"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)]"
            >
              <MaterialIcon name="fit_screen" size={18} fill={0} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Fit to Screen</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleResetZoom}
              aria-label="Reset zoom 100%"
              className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <MaterialIcon name="restart_alt" size={18} fill={0} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Reset View (100%)</TooltipContent>
        </Tooltip>

        <span className="text-[10px] font-mono text-[var(--color-muted)] px-1.5 select-none">
          {Math.round(transform.scale * 100)}%
        </span>

        <div className="h-4 w-px bg-[var(--color-border)] mx-0.5 hidden md:block" />

        <div className="hidden md:flex items-center gap-1.5 px-2 text-[10px] text-[var(--color-muted)] font-mono">
          <MaterialIcon name="keyboard" size={13} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
          <span>Arrows / Enter to navigate</span>
        </div>
      </div>

      {/* Floating Graph Legend Widget (Bottom-Right or Collapsible) */}
      <div className="absolute bottom-4 right-4 z-10">
        {showLegend ? (
          <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/95 backdrop-blur shadow-2xl space-y-2 text-xs select-none max-w-xs">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5">
              <span className="text-[11px] font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                <MaterialIcon name="info" size={14} fill={1} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                <span>Graph Legend</span>
              </span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition p-0.5"
                aria-label="Hide legend"
              >
                <MaterialIcon name="close" size={14} fill={0} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-1.5 text-[11px] text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded bg-[var(--color-mint-selected-bg,#253A32)] border border-[var(--color-mint-accent,#B9E4D0)]" />
                <span>Selected Module (Focus)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4 bg-[var(--color-mint-accent,#B9E4D0)]" />
                <span>Outgoing Edge (Depends On)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4 bg-[#5EEAD4]" />
                <span>Incoming Edge (Used By)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-4 bg-white/20 border-t border-dashed" />
                <span>Data Flow / Execution Pipeline</span>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLegend(true)}
            className="h-7 text-xs gap-1.5 bg-[var(--color-raised)]/90 border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] shadow-lg"
          >
            <MaterialIcon name="info" size={14} fill={0} aria-hidden="true" />
            <span>Legend</span>
          </Button>
        )}
      </div>
    </div>
  );
}
