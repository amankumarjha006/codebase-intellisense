import * as React from 'react';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Button } from '../components/ui/button';
import { ConnectDrawer } from '../components/repository/ConnectDrawer';
import { RepositoriesTable } from '../components/repository/RepositoriesTable';
import { useRepositoryPolling } from '../lib/useRepositoryPolling';
import { useAuth } from '../lib/AuthContext';
import { toast } from '../components/ui/sonner';

export function RepositoriesPage() {
  const { markSessionExpired } = useAuth();
  const [connectOpen, setConnectOpen] = React.useState(false);

  const {
    repositories,
    total,
    loading,
    error,
    refetch,
    triggerIndex,
    deleteRepository,
  } = useRepositoryPolling({
    page: 1,
    limit: 100,
    onSessionExpired: markSessionExpired,
  });

  const handleTriggerIndex = async (repoId: string) => {
    try {
      await triggerIndex(repoId);
      toast.success('Indexing job started');
    } catch (err) {
      toast.error('Failed to trigger indexing', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleDeleteRepository = async (repoId: string) => {
    try {
      await deleteRepository(repoId);
      toast.success('Repository disconnected');
    } catch (err) {
      toast.error('Failed to disconnect repository', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Repositories
          </h1>
          {!loading && (
            <span className="text-xs text-text-tertiary tabular-nums font-mono">
              {total}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      {error && (
        <div className="p-3 rounded-lg border border-status-red/20 bg-status-red/5 flex items-center justify-between text-xs text-status-red">
          <div className="flex items-center gap-2">
            <MaterialIcon name="error" size={16} />
            <span>Failed to load repositories: {error.message}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-xs text-status-red hover:bg-status-red/10"
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && total === 0 ? (
        <div className="rounded-lg border border-white/10 bg-surface-raised p-12 text-center space-y-4 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center mx-auto text-text-secondary">
            <MaterialIcon name="source" size={20} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-text-primary">No repositories connected</h2>
            <p className="text-xs text-text-secondary">
              Connect a GitHub repository to get started with code search, architecture mapping, and cited Q&amp;A.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <MaterialIcon name="add" size={16} />
            Connect your first repository
          </Button>
        </div>
      ) : (
        <RepositoriesTable
          repositories={repositories}
          loading={loading}
          onTriggerIndex={handleTriggerIndex}
          onDeleteRepository={handleDeleteRepository}
          onOpenConnect={() => setConnectOpen(true)}
        />
      )}

      {/* Connect Drawer */}
      <ConnectDrawer
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => refetch()}
      />
    </div>
  );
}
export default RepositoriesPage;
