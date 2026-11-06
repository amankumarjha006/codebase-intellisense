import * as React from 'react';
import type { ArchitectureOut } from '../../lib/architecture/types';
import { MaterialIcon } from '../ui/MaterialIcon';

interface SystemMapViewProps {
  payload: ArchitectureOut;
}

export function SystemMapView({ payload }: SystemMapViewProps) {
  const [extExpanded, setExtExpanded] = React.useState(false);
  const system = payload.system;
  const nodes = React.useMemo(() => system?.nodes || [], [system?.nodes]);
  const edges = system?.edges || [];

  const nodeNameMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nodes) {
      map.set(n.id, n.name);
    }
    return map;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-[var(--color-border)] bg-surface-raised">
        <MaterialIcon
          name="dns"
          size={36}
          className="text-text-tertiary mb-3"
          aria-hidden="true"
        />
        <h3 className="text-sm font-medium text-text-primary mb-1">
          No deployment manifests found
        </h3>
        <p className="text-xs text-text-secondary max-w-sm">
          No Dockerfile, docker-compose, or manifest files were detected in this repository.
        </p>
      </div>
    );
  }

  // Split external deps vs core system nodes
  const externalDepsNodes = nodes.filter((n) => n.kind === 'external_deps');
  const primaryNodes = nodes.filter((n) => n.kind !== 'external_deps');

  return (
    <div className="space-y-6">
      {/* Primary System Architecture Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {primaryNodes.map((node) => {
          let kindIcon = 'memory';
          if (node.kind === 'service') kindIcon = 'webhook';
          else if (node.kind === 'container') kindIcon = 'database';
          else if (node.kind === 'config') kindIcon = 'settings';
          else if (node.kind === 'runtime') kindIcon = 'terminal';

          return (
            <div
              key={node.id}
              className="p-4 rounded-lg border border-[var(--color-border)] bg-surface-raised flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <MaterialIcon
                      name={kindIcon}
                      size={16}
                      className="text-text-secondary shrink-0"
                      aria-hidden="true"
                    />
                    <h4 className="font-medium text-xs text-text-primary truncate">
                      {node.name}
                    </h4>
                  </div>
                  <span className="shrink-0 text-xs font-mono px-2 py-0.5 rounded bg-surface-overlay border border-[var(--color-border)] text-text-secondary">
                    {node.kind}
                  </span>
                </div>

                <div className="text-xs font-mono text-text-secondary truncate">
                  {node.source_file}:{node.line_number}
                </div>
              </div>

              {/* Node metadata summary */}
              {Object.keys(node.metadata || {}).length > 0 && (
                <div className="pt-2 border-t border-[var(--color-border)] text-xs text-text-secondary space-y-1">
                  {Object.entries(node.metadata).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-text-secondary font-mono text-xs">{key}</span>
                      <span className="font-mono text-xs text-text-primary truncate max-w-[180px]">
                        {Array.isArray(val) ? `${val.length} items` : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* System Dependency Connections */}
      {edges.length > 0 && (
        <div className="p-4 rounded-lg border border-[var(--color-border)] bg-surface-raised">
          <h4 className="text-xs font-medium text-text-secondary mb-3">
            System connections
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {edges.map((e, idx) => {
              const sourceLabel = nodeNameMap.get(e.source) || e.source.replace(/^sys:?/, '').replace(/^sys_/, '');
              const targetLabel = nodeNameMap.get(e.target) || e.target.replace(/^sys:?/, '').replace(/^sys_/, '');

              return (
                <div
                  key={`${e.source}-${e.target}-${idx}`}
                  className="p-2.5 rounded-lg bg-surface-overlay border border-[var(--color-border)] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-medium text-text-primary truncate">{sourceLabel}</span>
                    <span className="text-text-secondary">→</span>
                    <span className="font-medium text-text-primary truncate">{targetLabel}</span>
                  </div>
                  {e.label && (
                    <span className="shrink-0 text-xs font-mono text-text-secondary px-2 py-0.5 rounded bg-surface-overlay border border-[var(--color-border)]">
                      {e.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible External Dependencies Box */}
      {externalDepsNodes.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-surface-raised overflow-hidden">
          <button
            onClick={() => setExtExpanded(!extExpanded)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <div className="flex items-center gap-2">
              <MaterialIcon name="extension" size={16} className="text-text-secondary" aria-hidden="true" />
              <span className="text-xs font-medium text-text-primary">
                External package dependencies ({externalDepsNodes.length})
              </span>
            </div>
            <MaterialIcon
              name={extExpanded ? 'expand_less' : 'expand_more'}
              size={18}
              className="text-text-secondary"
              aria-hidden="true"
            />
          </button>

          {extExpanded && (
            <div className="p-4 pt-0 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {externalDepsNodes.map((dep) => (
                <div
                  key={dep.id}
                  className="p-2.5 rounded-lg bg-surface-overlay border border-[var(--color-border)] flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-xs text-text-primary truncate">{dep.name}</span>
                  <span className="text-xs text-text-secondary font-mono truncate">{dep.source_file}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
