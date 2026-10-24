import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../ui/MaterialIcon';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ArchitectureGraphNode, ArchitectureGraphRelationship } from '../../lib/types';

interface ArchitectureDetailsPanelProps {
  selectedNode: ArchitectureGraphNode | null;
  allNodes: ArchitectureGraphNode[];
  relationships: ArchitectureGraphRelationship[];
  repoId: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectNode: (nodeId: string) => void;
  onDeselect: () => void;
}

export function ArchitectureDetailsPanel({
  selectedNode,
  allNodes,
  relationships,
  repoId,
  isOpen,
  onToggleOpen,
  onSelectNode,
  onDeselect,
}: ArchitectureDetailsPanelProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  // Compute incoming and outgoing dependencies for selected node
  const incomingRels = React.useMemo(() => {
    if (!selectedNode) return [];
    return relationships
      .filter((r) => r.target === selectedNode.id)
      .map((r) => {
        const sourceNode = allNodes.find((n) => n.id === r.source);
        return {
          rel: r,
          node: sourceNode,
        };
      })
      .filter((item): item is { rel: ArchitectureGraphRelationship; node: ArchitectureGraphNode } => Boolean(item.node));
  }, [selectedNode, relationships, allNodes]);

  const outgoingRels = React.useMemo(() => {
    if (!selectedNode) return [];
    return relationships
      .filter((r) => r.source === selectedNode.id)
      .map((r) => {
        const targetNode = allNodes.find((n) => n.id === r.target);
        return {
          rel: r,
          node: targetNode,
        };
      })
      .filter((item): item is { rel: ArchitectureGraphRelationship; node: ArchitectureGraphNode } => Boolean(item.node));
  }, [selectedNode, relationships, allNodes]);

  // Contained symbols (if symbol nodes have file_id pointing to this node)
  const containedSymbols = React.useMemo(() => {
    if (!selectedNode) return [];
    return allNodes.filter(
      (n) => n.type === 'symbol' && (n.file_id === selectedNode.id || n.path === selectedNode.path)
    );
  }, [selectedNode, allNodes]);

  // Top connected hub nodes for empty state
  const topHubs = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of relationships) {
      counts.set(r.source, (counts.get(r.source) || 0) + 1);
      counts.set(r.target, (counts.get(r.target) || 0) + 1);
    }
    return [...allNodes]
      .filter((n) => n.type !== 'symbol')
      .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
      .slice(0, 5)
      .map((node) => ({
        node,
        connectionCount: counts.get(node.id) || 0,
      }));
  }, [allNodes, relationships]);

  const handleCopyPath = () => {
    const path = selectedNode?.path || selectedNode?.name || '';
    if (!path) return;
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSource = () => {
    if (!selectedNode?.path) return;
    navigate(`/repositories/${repoId}/files?path=${encodeURIComponent(selectedNode.path)}`);
  };

  if (!isOpen) {
    return (
      <div className="border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center py-3 px-1.5 shrink-0 select-none">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleOpen}
              aria-label="Expand module inspector"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              <MaterialIcon name="chevron_left" size={20} fill={0} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Open Details Panel</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <aside
      aria-label="Module & Node Inspector"
      className="w-80 md:w-96 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 overflow-hidden shadow-xl"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-raised)]/50 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MaterialIcon
            name={selectedNode ? 'layers' : 'hub'}
            size={18}
            fill={1}
            className="text-[var(--color-mint-accent,#B9E4D0)] shrink-0"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text)] truncate">
            {selectedNode ? 'Module Inspector' : 'System Overview'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {selectedNode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onDeselect}
                  aria-label="Deselect node"
                  className="h-7 w-7 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  <MaterialIcon name="close" size={16} fill={0} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear Selection</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleOpen}
                aria-label="Collapse inspector"
                className="h-7 w-7 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              >
                <MaterialIcon name="chevron_right" size={18} fill={0} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Collapse Inspector</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 space-y-5">
        {!selectedNode ? (
          /* Empty Selection State */
          <div className="space-y-6">
            <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-raised)]/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text)]">
                <MaterialIcon name="touch_app" size={16} className="text-[var(--color-mint-accent,#B9E4D0)]" aria-hidden="true" />
                <span>Interactive Exploration</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Click any node in the architecture graph to inspect its incoming/outgoing dependencies, language metadata, symbols, and jump directly to implementation source.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Graph Topology
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/60">
                  <div className="text-[11px] text-[var(--color-muted)]">Total Modules</div>
                  <div className="text-lg font-bold text-[var(--color-text)]">{allNodes.length}</div>
                </div>
                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/60">
                  <div className="text-[11px] text-[var(--color-muted)]">Relationships</div>
                  <div className="text-lg font-bold text-[var(--color-text)]">{relationships.length}</div>
                </div>
              </div>
            </div>

            {/* Top Connected Hubs */}
            {topHubs.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Core Architecture Hubs
                </span>
                <div className="space-y-1.5">
                  {topHubs.map(({ node, connectionCount }) => (
                    <button
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className="w-full text-left p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/40 hover:bg-[var(--color-raised)] hover:border-[rgba(185,228,208,0.3)] transition group flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition">
                          {node.name || node.label || node.path?.split('/').pop() || node.id}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                          {node.path || node.sublabel || 'pipeline component'}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] bg-[var(--color-page)] font-mono">
                        {connectionCount} edges
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Active Node Details */
          <div className="space-y-5">
            {/* Node Title & Badges */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-[var(--color-mint-selected-bg,#253A32)] border border-[rgba(185,228,208,0.3)] flex items-center justify-center shrink-0">
                    <MaterialIcon
                      name={selectedNode.type === 'file' ? 'description' : selectedNode.type === 'pipeline' ? 'account_tree' : 'code'}
                      size={18}
                      fill={1}
                      className="text-[var(--color-mint-accent,#B9E4D0)]"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text)] truncate">
                      {selectedNode.name || selectedNode.label || selectedNode.id}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 bg-[var(--color-raised)] text-[var(--color-text-secondary)]">
                        {selectedNode.type || 'module'}
                      </Badge>
                      {selectedNode.language && (
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-[var(--color-raised)] text-[var(--color-text-secondary)]">
                          {selectedNode.language}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Source Path with Copy & Tooltip */}
              {selectedNode.path && (
                <div className="p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
                    <span>Source Location</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleCopyPath}
                          className="inline-flex items-center gap-1 text-[10px] font-mono hover:text-[var(--color-mint-accent,#B9E4D0)] transition"
                          aria-label="Copy source path"
                        >
                          <MaterialIcon
                            name={copied ? 'check' : 'content_copy'}
                            size={13}
                            fill={copied ? 1 : 0}
                            className={copied ? 'text-[var(--color-mint-accent,#B9E4D0)]' : ''}
                            aria-hidden="true"
                          />
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy relative path</TooltipContent>
                    </Tooltip>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-xs font-mono text-[var(--color-text)] truncate select-all cursor-pointer">
                        {selectedNode.path}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs break-all font-mono text-[11px]">
                      {selectedNode.path}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Description or Sublabel */}
              {(selectedNode.description || selectedNode.sublabel) && (
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed pt-1">
                  {selectedNode.description || selectedNode.sublabel}
                </p>
              )}

              {/* Open in File Viewer Action */}
              {selectedNode.path && (
                <Button
                  onClick={handleOpenSource}
                  className="w-full gap-2 text-xs h-8 bg-[var(--color-mint-selected-bg,#253A32)] text-[var(--color-mint-accent,#B9E4D0)] border border-[rgba(185,228,208,0.3)] hover:bg-[var(--color-mint-accent)]/20 transition"
                >
                  <MaterialIcon name="code" size={16} fill={1} aria-hidden="true" />
                  <span>Open in Source Viewer</span>
                </Button>
              )}
            </div>

            <Separator className="bg-[var(--color-border)]" />

            {/* Incoming Dependencies (Used By) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#5EEAD4]" />
                  <span>Incoming Dependencies ({incomingRels.length})</span>
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">Used By</span>
              </div>

              {incomingRels.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-muted)] bg-[var(--color-raised)]/30 rounded-lg border border-[var(--color-border)]">
                  No incoming dependencies to this node
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {incomingRels.map(({ rel, node }) => (
                    <button
                      key={`${rel.source}-${rel.type}`}
                      onClick={() => onSelectNode(node.id)}
                      className="w-full text-left p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/40 hover:bg-[var(--color-raised)] hover:border-[#5EEAD4] transition flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-[var(--color-text)] truncate group-hover:text-[#5EEAD4] transition">
                          {node.name || node.label || node.path?.split('/').pop() || node.id}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                          {node.path || node.sublabel || node.type}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[9px] font-mono uppercase px-1.5 py-0 border-[#5EEAD4]/40 text-[#5EEAD4] bg-[#5EEAD4]/10"
                      >
                        {rel.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Dependencies (Depends On) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-mint-accent,#B9E4D0)]" />
                  <span>Outgoing Dependencies ({outgoingRels.length})</span>
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">Depends On</span>
              </div>

              {outgoingRels.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-muted)] bg-[var(--color-raised)]/30 rounded-lg border border-[var(--color-border)]">
                  No outgoing dependencies from this node
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {outgoingRels.map(({ rel, node }) => (
                    <button
                      key={`${rel.target}-${rel.type}`}
                      onClick={() => onSelectNode(node.id)}
                      className="w-full text-left p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-raised)]/40 hover:bg-[var(--color-raised)] hover:border-[var(--color-mint-accent,#B9E4D0)] transition flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-medium text-[var(--color-text)] truncate group-hover:text-[var(--color-mint-accent,#B9E4D0)] transition">
                          {node.name || node.label || node.path?.split('/').pop() || node.id}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)] font-mono truncate">
                          {node.path || node.sublabel || node.type}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[9px] font-mono uppercase px-1.5 py-0 border-[var(--color-mint-accent,#B9E4D0)]/40 text-[var(--color-mint-accent,#B9E4D0)] bg-[var(--color-mint-accent,#B9E4D0)]/10"
                      >
                        {rel.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Contained Symbols */}
            {containedSymbols.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Extracted Symbols ({containedSymbols.length})
                </span>
                <div className="space-y-1">
                  {containedSymbols.map((sym) => (
                    <div
                      key={sym.id}
                      className="p-1.5 rounded border border-[var(--color-border)] bg-[var(--color-raised)]/30 flex items-center justify-between text-xs font-mono"
                    >
                      <span className="text-[var(--color-text)] truncate">{sym.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-[var(--color-muted)]">
                        {sym.symbol_type || 'symbol'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
