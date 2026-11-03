import * as React from 'react';
import type { ArchitectureOut, ComponentOut } from '../../lib/architecture/types';
import { MaterialIcon } from '../ui/MaterialIcon';

interface ComponentListViewProps {
  payload: ArchitectureOut;
  onSelectComponent: (comp: ComponentOut) => void;
}

export function ComponentListView({
  payload,
  onSelectComponent,
}: ComponentListViewProps) {
  const components = payload.components || [];

  // Index edges
  const outgoingCounts = new Map<string, number>();
  const incomingCounts = new Map<string, number>();

  for (const edge of payload.edges || []) {
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) || 0) + 1);
    incomingCounts.set(edge.target, (incomingCounts.get(edge.target) || 0) + 1);
  }

  if (components.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-white/40 italic rounded-xl border border-white/[0.08] bg-[#161615]">
        No components detected in this repository.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-[#161615] overflow-x-auto">
      <table className="w-full text-left text-xs text-white/80 border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08] bg-[#1D1D1B] text-[11px] font-medium text-white/50 uppercase tracking-wider">
            <th scope="col" className="py-3 px-4">Component</th>
            <th scope="col" className="py-3 px-4">Path Prefix</th>
            <th scope="col" className="py-3 px-4">Layer</th>
            <th scope="col" className="py-3 px-4">Files</th>
            <th scope="col" className="py-3 px-4">Languages</th>
            <th scope="col" className="py-3 px-4">Dependencies</th>
            <th scope="col" className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {components.map((comp) => {
            const outCount = outgoingCounts.get(comp.id) || 0;
            const inCount = incomingCounts.get(comp.id) || 0;
            const langs = Object.keys(comp.language_mix || {}).join(', ') || 'None';

            return (
              <tr
                key={comp.id}
                onClick={() => onSelectComponent(comp)}
                className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
              >
                <td className="py-3 px-4 font-medium text-white/90">
                  <div className="flex items-center gap-1.5">
                    <MaterialIcon name="folder" size={16} className="text-white/40 shrink-0" aria-hidden="true" />
                    <span>{comp.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-white/60">
                  {comp.path_prefix || './'}
                </td>
                <td className="py-3 px-4 font-mono text-[11px] text-white/50">
                  L{comp.layer}
                </td>
                <td className="py-3 px-4 text-white/70">
                  {comp.file_count}
                </td>
                <td className="py-3 px-4 text-white/60 truncate max-w-[150px]">
                  {langs}
                </td>
                <td className="py-3 px-4 text-[11px] text-white/50 font-mono">
                  {outCount} out / {inCount} in
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(comp);
                    }}
                    className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/80 transition-colors"
                  >
                    View details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

