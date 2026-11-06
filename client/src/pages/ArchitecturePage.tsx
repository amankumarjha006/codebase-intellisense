import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

type TabKey = 'modules' | 'flows' | 'entrypoints' | 'list';

// Version-pinned in-memory cache: key = `${repoId}:${versionId}`
const architectureCache = new Map<string, ArchitectureOut>();

export function ArchitecturePage() {
  const { id: repoId } = useParams<{ id: string }>();

  const { data: repository = null } = useQuery<Repository | null>({
    queryKey: ['repository', repoId],
    queryFn: () => (repoId ? api.getRepository(repoId) : Promise.resolve(null)),
    enabled: Boolean(repoId),
    initialData: () => (repoId ? getCachedRepository(repoId) : null),
  });

  const handleReindex = React.useCallback(async () => {
    if (!repoId) return;
    await api.reindexRepository(repoId);
  }, [repoId]);

  // Default to 'list' on mobile viewports (< 768px), otherwise 'modules'
  const [activeTab, setActiveTab] = React.useState<TabKey>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'list';
    }
    return 'modules';
  });

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
    <AnimatedPage className="min-h-screen bg-surface-base text-text-primary flex flex-col font-sans">
      {repository ? (
        <RepositoryHeader repository={repository} onReindex={handleReindex} />
      ) : repoId ? (
        <RepositoryHeader
          repository={{ id: repoId, owner: 'Repository', name: 'Architecture' }}
          onReindex={handleReindex}
        />
      ) : null}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 pb-16 space-y-6">
        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-border)]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-medium text-text-primary tracking-tight">
                Architecture
              </h1>
              {payload?.status === 'ready' && (
                <div className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-2 h-2 rounded-full bg-status-ready" aria-hidden="true" />
                  <span>Ready</span>
                </div>
              )}
              {payload?.status === 'partial' && (
                <div className="inline-flex items-center gap-1.5 text-xs text-status-indexing">
                  <span className="w-2 h-2 rounded-full bg-status-indexing" aria-hidden="true" />
                  <span>Partial</span>
                </div>
              )}
              {payload?.limits?.truncated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-surface-raised text-text-secondary border border-[var(--color-border)]">
                  Edge cap (400)
                </span>
              )}
            </div>

            {/* Coverage line */}
            <p className="text-xs text-text-secondary mt-1 font-mono">
              {loading ? 'Evaluating architecture…' : formatCoverageLine(payload?.coverage)}
            </p>
          </div>

          {/* Segmented Tab Controls */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-raised border border-[var(--color-border)] self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('modules')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                ${
                  activeTab === 'modules'
                    ? 'bg-surface-overlay text-text-primary font-semibold shadow-xs border border-[var(--color-border-strong)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/50'
                }
              `}
            >
              <MaterialIcon name="category" size={16} aria-hidden="true" />
              <span>Modules</span>
            </button>

            <button
              onClick={() => setActiveTab('flows')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                ${
                  activeTab === 'flows'
                    ? 'bg-surface-overlay text-text-primary font-semibold shadow-xs border border-[var(--color-border-strong)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/50'
                }
              `}
            >
              <MaterialIcon name="alt_route" size={16} aria-hidden="true" />
              <span>Flows</span>
            </button>

            <button
              onClick={() => setActiveTab('entrypoints')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                ${
                  activeTab === 'entrypoints'
                    ? 'bg-surface-overlay text-text-primary font-semibold shadow-xs border border-[var(--color-border-strong)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/50'
                }
              `}
            >
              <MaterialIcon name="dns" size={16} aria-hidden="true" />
              <span>Entry points</span>
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent
                ${
                  activeTab === 'list'
                    ? 'bg-surface-overlay text-text-primary font-semibold shadow-xs border border-[var(--color-border-strong)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay/50'
                }
              `}
            >
              <MaterialIcon name="view_list" size={16} aria-hidden="true" />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Informative Disclaimer Notice */}
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-raised border border-[var(--color-border)] text-xs text-text-secondary">
          <MaterialIcon name="info" size={16} className="text-text-tertiary shrink-0" aria-hidden="true" />
          <span>Components are directory-based approximations derived from static analysis evidence.</span>
        </div>

        {/* Main Body States */}
        {loading ? (
          <div className="w-full h-96 rounded-lg border border-[var(--color-border)] bg-surface-raised flex flex-col items-center justify-center p-8 space-y-3">
            <MaterialIcon name="sync" size={24} className="text-text-tertiary animate-spin" aria-hidden="true" />
            <p className="text-xs text-text-secondary font-mono">Loading architecture model…</p>
          </div>
        ) : errorCopy ? (
          <div className="w-full p-8 rounded-lg border border-[var(--color-border)] bg-surface-raised flex flex-col items-center justify-center text-center space-y-3">
            <div className="flex items-center gap-2 text-status-failed">
              <MaterialIcon name="error_outline" size={20} aria-hidden="true" />
              <span className="text-sm font-medium">{errorCopy}</span>
            </div>
            {requestId && (
              <button
                onClick={handleCopyRequestId}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-text-secondary bg-surface-overlay border border-[var(--color-border)] hover:bg-surface-base transition-colors"
              >
                <span>Reference: {requestId}</span>
                <MaterialIcon
                  name={copiedReqId ? 'check' : 'content_copy'}
                  size={14}
                  className="text-text-secondary"
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        ) : !payload ? (
          <div className="w-full p-8 rounded-lg border border-[var(--color-border)] bg-surface-raised text-center text-xs text-text-secondary">
            No architecture data available for this repository.
          </div>
        ) : (
          <div>
            {activeTab === 'modules' && (
              <ComponentMapView payload={payload} repoId={repoId!} />
            )}

            {activeTab === 'entrypoints' && (
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
