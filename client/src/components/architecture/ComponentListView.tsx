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
      <div className="p-8 text-center text-xs text-text-secondary italic rounded-lg border border-[var(--color-border)] bg-surface-raised">
        No components detected in this repository.
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-[var(--color-border)] bg-surface-raised overflow-x-auto">
      <table className="w-full text-left text-xs text-text-primary border-collapse">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-surface-overlay text-xs font-medium text-text-secondary">
            <th scope="col" className="py-3 px-4">Component</th>
            <th scope="col" className="py-3 px-4">Path prefix</th>
            <th scope="col" className="py-3 px-4">Layer</th>
            <th scope="col" className="py-3 px-4">Files</th>
            <th scope="col" className="py-3 px-4">Languages</th>
            <th scope="col" className="py-3 px-4">Dependencies (approx.)</th>
            <th scope="col" className="py-3 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {components.map((comp) => {
            const outCount = outgoingCounts.get(comp.id) || 0;
            const inCount = incomingCounts.get(comp.id) || 0;
            const langs = Object.keys(comp.language_mix || {}).join(', ') || 'None';

            return (
              <tr
                key={comp.id}
                onClick={() => onSelectComponent(comp)}
                className="hover:bg-surface-overlay/50 transition-colors cursor-pointer group"
              >
                <td className="py-3 px-4 font-medium text-text-primary">
                  <div className="flex items-center gap-2">
                    <MaterialIcon name="folder" size={16} className="text-text-secondary shrink-0" aria-hidden="true" />
                    <span>{comp.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                  {comp.path_prefix || './'}
                </td>
                <td className="py-3 px-4 font-mono text-xs text-text-secondary">
                  L{comp.layer}
                </td>
                <td className="py-3 px-4 text-text-secondary font-mono">
                  {comp.file_count}
                </td>
                <td className="py-3 px-4 text-text-secondary truncate max-w-[150px]">
                  {langs}
                </td>
                <td className="py-3 px-4 text-xs text-text-secondary font-mono">
                  {outCount} out / {inCount} in
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(comp);
                    }}
                    className="px-2.5 py-1 rounded text-xs font-medium bg-surface-overlay border border-[var(--color-border)] hover:bg-surface-base text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
