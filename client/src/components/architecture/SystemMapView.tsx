import * as React from 'react';
import type { ArchitectureOut } from '../../lib/architecture/types';
import { MaterialIcon } from '../ui/MaterialIcon';

interface SystemMapViewProps {
  payload: ArchitectureOut;
}

export function SystemMapView({ payload }: SystemMapViewProps) {
  const [extExpanded, setExtExpanded] = React.useState(false);
  const system = payload.system;
  const nodes = system?.nodes || [];
  const edges = system?.edges || [];

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-white/[0.08] bg-[#161615]">
        <MaterialIcon
          name="dns"
          size={36}
          className="text-white/30 mb-3"
          aria-hidden="true"
        />
        <h3 className="text-sm font-medium text-white/80 mb-1">
          No deployment manifests found
        </h3>
        <p className="text-xs text-white/40 max-w-sm">
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
              className="p-4 rounded-xl border border-white/[0.08] bg-[#161615] flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MaterialIcon
                      name={kindIcon}
                      size={16}
                      className="text-white/60 shrink-0"
                      aria-hidden="true"
                    />
                    <h4 className="font-medium text-xs text-white/90 truncate">
                      {node.name}
                    </h4>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-white/50">
                    {node.kind}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-white/40 truncate">
                  {node.source_file}:{node.line_number}
                </div>
              </div>

              {/* Node metadata summary */}
              {Object.keys(node.metadata || {}).length > 0 && (
                <div className="pt-2 border-t border-white/[0.04] text-[11px] text-white/60 space-y-1">
                  {Object.entries(node.metadata).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-white/40 font-mono text-[10px]">{key}</span>
                      <span className="font-mono text-[10px] text-white/80 truncate max-w-[180px]">
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
        <div className="p-4 rounded-xl border border-white/[0.08] bg-[#161615]">
          <h4 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-3">
            System Connections
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {edges.map((e, idx) => (
              <div
                key={`${e.source}-${e.target}-${idx}`}
                className="p-2.5 rounded-lg bg-[#1D1D1B] border border-white/[0.06] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="font-medium text-white/90 truncate">{e.source.replace(/^sys:/, '')}</span>
                  <span className="text-white/40">→</span>
                  <span className="font-medium text-white/90 truncate">{e.target.replace(/^sys:/, '')}</span>
                </div>
                {e.label && (
                  <span className="shrink-0 text-[10px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/[0.04]">
                    {e.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible External Dependencies Box */}
      {externalDepsNodes.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#161615] overflow-hidden">
          <button
            onClick={() => setExtExpanded(!extExpanded)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <MaterialIcon name="extension" size={16} className="text-white/50" aria-hidden="true" />
              <span className="text-xs font-medium text-white/80">
                External Package Dependencies ({externalDepsNodes.length})
              </span>
            </div>
            <MaterialIcon
              name={extExpanded ? 'expand_less' : 'expand_more'}
              size={18}
              className="text-white/40"
              aria-hidden="true"
            />
          </button>

          {extExpanded && (
            <div className="p-4 pt-0 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {externalDepsNodes.map((dep) => (
                <div
                  key={dep.id}
                  className="p-2 rounded bg-[#1D1D1B] border border-white/[0.04] flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-[11px] text-white/80 truncate">{dep.name}</span>
                  <span className="text-[10px] text-white/40 font-mono truncate">{dep.source_file}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

