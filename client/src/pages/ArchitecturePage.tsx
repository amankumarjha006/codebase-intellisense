import * as React from 'react';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { api, getCachedRepository, ApiError } from '../lib/api';
import { mapErrorToCopy } from '../lib/errors';
import type { Repository } from '../lib/types';
import type { ArchitectureOut, ComponentOut } from '../lib/architecture/types';
import { formatCoverageLine } from '../lib/architecture/formatter';
import { ComponentMapView } from '../components/architecture/ComponentMapView';
import { SystemMapView } from '../components/architecture/SystemMapView';
import { FlowsView } from '../components/architecture/FlowsView';
import { ComponentListView } from '../components/architecture/ComponentListView';
import { ComponentDetailsPanel } from '../components/architecture/ComponentDetailsPanel';

type TabKey = 'system' | 'components' | 'flows' | 'list';

// Version-pinned in-memory cache: key = `${repoId}:${versionId}`
const architectureCache = new Map<string, ArchitectureOut>();

export function ArchitecturePage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [repository] = React.useState<Repository | null>(() =>
    repoId ? getCachedRepository(repoId) : null
  );
  const [activeTab, setActiveTab] = React.useState<TabKey>('components');
  const [payload, setPayload] = React.useState<ArchitectureOut | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorCopy, setErrorCopy] = React.useState<string | null>(null);
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [copiedReqId, setCopiedReqId] = React.useState(false);
  const [inspectComp, setInspectComp] = React.useState<ComponentOut | null>(null);

  // Fetch repository & architecture payload pinned to version
  React.useEffect(() => {
    if (!repoId) return;

    let isMounted = true;
    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      setErrorCopy(null);
      setRequestId(null);

      try {
        let versionId = 'latest';
        try {
          const activeVer = await api.getRepositoryActiveVersion(repoId!, { signal: controller.signal });
          if (activeVer) {
            versionId = activeVer.commit_sha ? activeVer.commit_sha.slice(0, 7) : activeVer.id;
          }
        } catch {
          // Fall back to latest version
        }

        const cacheKey = `${repoId}:${versionId}`;

        // Check in-memory cache first
        if (architectureCache.has(cacheKey)) {
          setPayload(architectureCache.get(cacheKey)!);
          setLoading(false);
          return;
        }

        // Fetch architecture payload
        const archPayload = await api.getRepositoryArchitecture(repoId!, {
          signal: controller.signal,
        });

        if (isMounted) {
          if (archPayload.status === 'failed') {
            setErrorCopy('Architecture analysis failed to complete.');
            setRequestId(null);
          } else {
            architectureCache.set(cacheKey, archPayload);
            setPayload(archPayload);
          }
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted && isMounted) {
          const apiErr = err as Partial<ApiError>;
          const userCopy = mapErrorToCopy(err) || 'Could not load architecture analysis.';
          setErrorCopy(userCopy);
          if (apiErr?.requestId) {
            setRequestId(apiErr.requestId);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [repoId]);

  const handleCopyRequestId = () => {
    if (requestId) {
      navigator.clipboard.writeText(requestId);
      setCopiedReqId(true);
      setTimeout(() => setCopiedReqId(false), 2000);
    }
  };

  const handleSelectFromList = (comp: ComponentOut) => {
    setInspectComp(comp);
  };

  return (
    <AnimatedPage className="min-h-screen bg-[#0B0D10] text-[var(--color-text)] flex flex-col font-sans">
      {repository && <RepositoryHeader repository={repository} />}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-medium text-white tracking-tight">
                Architecture
              </h1>
              {payload?.status === 'ready' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#8AB4F8]/10 text-[#8AB4F8] border border-[#8AB4F8]/20">
                  <MaterialIcon name="check_circle" size={12} className="text-[#8AB4F8]" fill={1} />
                  <span>Ready</span>
                </span>
              )}
              {payload?.status === 'partial' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <MaterialIcon name="warning" size={12} className="text-amber-400" />
                  <span>Partial</span>
                </span>
              )}
              {payload?.limits?.truncated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.04] text-white/60 border border-white/[0.08]">
                  Edge cap (400)
                </span>
              )}
            </div>

            {/* Coverage line */}
            <p className="text-xs text-white/60 mt-1 font-mono">
              {loading ? 'Evaluating architecture…' : formatCoverageLine(payload?.coverage)}
            </p>
          </div>

          {/* Navigation Tabs (icon + text) */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#161615] border border-white/[0.08] self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('components')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${
                  activeTab === 'components'
                    ? 'bg-[#1D1D1B] text-white shadow-xs'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }
              `}
            >
              <MaterialIcon name="category" size={16} aria-hidden="true" />
              <span>Components</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${
                  activeTab === 'system'
                    ? 'bg-[#1D1D1B] text-white shadow-xs'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }
              `}
            >
              <MaterialIcon name="dns" size={16} aria-hidden="true" />
              <span>System</span>
            </button>

            <button
              onClick={() => setActiveTab('flows')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${
                  activeTab === 'flows'
                    ? 'bg-[#1D1D1B] text-white shadow-xs'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }
              `}
            >
              <MaterialIcon name="alt_route" size={16} aria-hidden="true" />
              <span>Flows</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${
                  activeTab === 'list'
                    ? 'bg-[#1D1D1B] text-white shadow-xs'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.03]'
                }
              `}
            >
              <MaterialIcon name="view_list" size={16} aria-hidden="true" />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Informative Disclaimer Notice */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#161615] border border-white/[0.06] text-xs text-white/50">
          <MaterialIcon name="info" size={16} className="text-white/40 shrink-0" aria-hidden="true" />
          <span>Components are directory-based approximations derived from static analysis evidence.</span>
        </div>

        {/* Main Body States */}
        {loading ? (
          <div className="w-full h-96 rounded-xl border border-white/[0.08] bg-[#161615] flex flex-col items-center justify-center p-8 space-y-3">
            <MaterialIcon name="sync" size={24} className="text-white/40 animate-spin" aria-hidden="true" />
            <p className="text-xs text-white/50">Loading architecture model…</p>
          </div>
        ) : errorCopy ? (
          <div className="w-full p-8 rounded-xl border border-white/[0.08] bg-[#161615] flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <MaterialIcon name="error_outline" size={20} aria-hidden="true" />
              <span className="text-sm font-medium">{errorCopy}</span>
            </div>
            {requestId && (
              <button
                onClick={handleCopyRequestId}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-white/60 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
              >
                <span>Reference: {requestId}</span>
                <MaterialIcon
                  name={copiedReqId ? 'check' : 'content_copy'}
                  size={14}
                  className="text-white/40"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        ) : !payload ? (
          <div className="w-full p-8 rounded-xl border border-white/[0.08] bg-[#161615] text-center text-xs text-white/40">
            No architecture data available for this repository.
          </div>
        ) : (
          <div>
            {activeTab === 'components' && (
              <ComponentMapView payload={payload} repoId={repoId!} />
            )}

            {activeTab === 'system' && (
              <SystemMapView payload={payload} />
            )}

            {activeTab === 'flows' && (
              <FlowsView payload={payload} repoId={repoId!} />
            )}

            {activeTab === 'list' && (
              <ComponentListView
                payload={payload}
                onSelectComponent={handleSelectFromList}
              />
            )}
          </div>
        )}

        {/* Global Component Details Panel if selected from List view */}
        {inspectComp && payload && (
          <ComponentDetailsPanel
            component={inspectComp}
            payload={payload}
            repoId={repoId!}
            onClose={() => setInspectComp(null)}
            onSelectComponent={(nextComp) => setInspectComp(nextComp)}
          />
        )}
      </main>
    </AnimatedPage>
  );
}
