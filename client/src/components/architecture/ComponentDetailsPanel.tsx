import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ArchitectureOut,
  ComponentFileItem,
  ComponentOut,
} from '../../lib/architecture/types';
import { getComponentFiles } from '../../lib/api';
import { MaterialIcon } from '../ui/MaterialIcon';

interface ComponentDetailsPanelProps {
  component: ComponentOut | null;
  payload: ArchitectureOut;
  repoId: string;
  onClose: () => void;
  onSelectComponent: (comp: ComponentOut) => void;
}

export function ComponentDetailsPanel({
  component,
  payload,
  repoId,
  onClose,
  onSelectComponent,
}: ComponentDetailsPanelProps) {
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [loadingFiles, setLoadingFiles] = React.useState(false);
  const [files, setFiles] = React.useState<ComponentFileItem[]>([]);
  const [totalFiles, setTotalFiles] = React.useState(0);
  const pageSize = 20;

  // Reset page when component changes
  React.useEffect(() => {
    setPage(1);
  }, [component?.id]);

  // Fetch paginated files
  React.useEffect(() => {
    if (!component) return;

    let isMounted = true;
    const controller = new AbortController();

    async function loadFiles() {
      if (!component) return;
      setLoadingFiles(true);
      try {
        const res = await getComponentFiles(repoId, component.id, page, pageSize, controller.signal);
        if (isMounted) {
          setFiles(res.files || []);
          setTotalFiles(res.total || 0);
        }
      } catch (_err: unknown) {
        if (!controller.signal.aborted) {
          setFiles([]);
          setTotalFiles(0);
        }
      } finally {
        if (isMounted) {
          setLoadingFiles(false);
        }
      }
    }

    loadFiles();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [component, page, repoId]);

  if (!component) return null;

  // Find incoming (Used by) and outgoing (Depends on) edges
  const dependsOnEdges = (payload.edges || []).filter((e) => e.source === component.id);
  const usedByEdges = (payload.edges || []).filter((e) => e.target === component.id);

  const compMap = new Map((payload.components || []).map((c) => [c.id, c]));

  const totalPages = Math.max(1, Math.ceil(totalFiles / pageSize));

  return (
    <aside
      aria-label={`Details for ${component.name}`}
      className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-[#161615] border-l border-white/[0.08] z-30 flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-[#161615]">
        <div className="flex items-center gap-2 min-w-0">
          <MaterialIcon name="category" size={18} className="text-white/60 shrink-0" aria-hidden="true" />
          <h2 className="font-medium text-sm text-white/90 truncate">{component.name}</h2>
          <span className="shrink-0 text-[10px] text-white/40 font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
            L{component.layer}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
        >
          <MaterialIcon name="close" size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-white/80">
        {/* Path prefix & files count */}
        <div className="p-3 rounded-lg bg-[#1D1D1B] border border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-white/50">
            <span>Path prefix</span>
            <span>{component.file_count} {component.file_count === 1 ? 'file' : 'files'}</span>
          </div>
          <div className="font-mono text-xs text-white/90 break-all select-all">
            {component.path_prefix || './'}
          </div>
        </div>

        {/* Generated Summary (if available) */}
        {component.summary && (
          <div className="p-3 rounded-lg bg-[#1D1D1B] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-medium">
              <MaterialIcon name="auto_awesome" size={12} className="text-white/40 shrink-0" aria-hidden="true" />
              <span>Generated — verify in sources</span>
            </div>
            <p className="text-white/70 leading-relaxed text-xs">
              {component.summary}
            </p>
          </div>
        )}

        {/* Depends on */}
        <div>
          <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2">
            Depends on ({dependsOnEdges.length})
          </h3>
          {dependsOnEdges.length === 0 ? (
            <p className="text-white/40 text-[11px] italic">No outgoing dependencies</p>
          ) : (
            <div className="space-y-1.5">
              {dependsOnEdges.map((e) => {
                const targetComp = compMap.get(e.target);
                if (!targetComp) return null;
                return (
                  <div
                    key={e.target}
                    className="p-2 rounded bg-[#1D1D1B] border border-white/[0.06] flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => onSelectComponent(targetComp)}
                      className="text-left font-medium text-white/90 hover:underline truncate"
                    >
                      {targetComp.name}
                    </button>
                    <span className="text-[10px] text-white/40 font-mono shrink-0">
                      {e.weight} {e.weight === 1 ? 'import' : 'imports'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Used by */}
        <div>
          <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2">
            Used by ({usedByEdges.length})
          </h3>
          {usedByEdges.length === 0 ? (
            <p className="text-white/40 text-[11px] italic">No incoming dependents</p>
          ) : (
            <div className="space-y-1.5">
              {usedByEdges.map((e) => {
                const srcComp = compMap.get(e.source);
                if (!srcComp) return null;
                return (
                  <div
                    key={e.source}
                    className="p-2 rounded bg-[#1D1D1B] border border-white/[0.06] flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => onSelectComponent(srcComp)}
                      className="text-left font-medium text-white/90 hover:underline truncate"
                    >
                      {srcComp.name}
                    </button>
                    <span className="text-[10px] text-white/40 font-mono shrink-0">
                      {e.weight} {e.weight === 1 ? 'import' : 'imports'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Citation Evidence */}
        {dependsOnEdges.some((e) => e.evidence && e.evidence.length > 0) && (
          <div>
            <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider mb-2">
              Import Evidence
            </h3>
            <div className="space-y-1.5">
              {dependsOnEdges.flatMap((e) =>
                (e.evidence || []).map((ev, idx) => (
                  <button
                    key={`${ev.source_path}-${idx}`}
                    onClick={() =>
                      navigate(
                        `/repositories/${repoId}/files?path=${encodeURIComponent(ev.source_path)}&line=${ev.line}`
                      )
                    }
                    className="w-full text-left p-2 rounded bg-[#1D1D1B] border border-white/[0.06] hover:border-white/20 transition-colors group flex items-start gap-2"
                  >
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#8AB4F8]/10 text-[#8AB4F8] border border-[#8AB4F8]/20">
                      L{ev.line}
                    </span>
                    <span className="font-mono text-[11px] text-white/70 group-hover:text-white truncate">
                      {ev.source_path} → {ev.target_path}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Paged Files List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-medium text-white/50 uppercase tracking-wider">
              Files ({totalFiles})
            </h3>
            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-[10px] text-white/50">
                <button
                  disabled={page <= 1 || loadingFiles}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span>{page}/{totalPages}</span>
                <button
                  disabled={page >= totalPages || loadingFiles}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {loadingFiles ? (
            <div className="p-3 text-center text-white/40 text-[11px] animate-pulse">
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <p className="text-white/40 text-[11px] italic">No files found for this component</p>
          ) : (
            <div className="space-y-1">
              {files.map((file) => (
                <button
                  key={file.path}
                  onClick={() =>
                    navigate(
                      `/repositories/${repoId}/files?path=${encodeURIComponent(file.path)}`
                    )
                  }
                  className="w-full text-left p-1.5 rounded hover:bg-white/[0.04] transition-colors flex items-center justify-between gap-2 group"
                >
                  <span className="font-mono text-[11px] text-white/70 group-hover:text-white truncate">
                    {file.path}
                  </span>
                  <span className="text-[10px] text-white/30 font-mono shrink-0">
                    {Math.round(file.size_bytes / 1024)} KB
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

