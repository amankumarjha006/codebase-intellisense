import * as React from 'react';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Button } from '../components/ui/button';
import { ConnectDrawer } from '../components/repository/ConnectDrawer';
import { ContinueHero } from '../components/dashboard/ContinueHero';
import { RepoCardGrid } from '../components/dashboard/RepoCardGrid';
import {
  RecentConversationsList,
  type RecentConversationItem,
} from '../components/dashboard/RecentConversationsList';
import { ActivityTimeline } from '../components/dashboard/ActivityTimeline';
import { useRepositoryPolling } from '../lib/useRepositoryPolling';
import { useAuth } from '../lib/AuthContext';
import { realApi, type ConversationOut } from '../lib/api';
import {
  selectHeroRepository,
  getLastOpenedRepoId,
  type ConversationDateMap,
} from '../lib/repositoryTableUtils';
import { toast } from '../components/ui/sonner';

export function DashboardPage() {
  const { user, markSessionExpired } = useAuth();
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [recentConversations, setRecentConversations] = React.useState<RecentConversationItem[]>([]);
  const [loadingConversations, setLoadingConversations] = React.useState(false);
  const [lastConversationsByRepo, setLastConversationsByRepo] = React.useState<
    Record<string, ConversationOut>
  >({});

  const {
    repositories,
    total,
    loading: loadingRepos,
    refetch,
    triggerIndex,
  } = useRepositoryPolling({
    page: 1,
    limit: 50,
    onSessionExpired: markSessionExpired,
  });

  // Fetch recent conversations for top repositories
  React.useEffect(() => {
    if (!repositories || repositories.length === 0) return;

    let isCancelled = false;
    const fetchTopConversations = async () => {
      setLoadingConversations(true);
      try {
        const topRepos = repositories.slice(0, 5);
        const results = await Promise.all(
          topRepos.map(async (repo) => {
            try {
              const res = await realApi.listConversations(repo.id, 1, 5);
              return { repo, conversations: res.items || [] };
            } catch {
              return { repo, conversations: [] };
            }
          })
        );

        if (isCancelled) return;

        const allItems: RecentConversationItem[] = [];
        const byRepoMap: Record<string, ConversationOut> = {};

        for (const { repo, conversations } of results) {
          if (conversations.length > 0) {
            byRepoMap[repo.id] = conversations[0];
            for (const conv of conversations) {
              allItems.push({
                id: conv.id,
                repoId: repo.id,
                repoName: `${repo.owner}/${repo.name}`,
                title: conv.title || 'Untitled conversation',
                updatedAt: conv.created_at,
              });
            }
          }
        }

        allItems.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setRecentConversations(allItems.slice(0, 8));
        setLastConversationsByRepo(byRepoMap);
      } finally {
        if (!isCancelled) {
          setLoadingConversations(false);
        }
      }
    };

    fetchTopConversations();

    return () => {
      isCancelled = true;
    };
  }, [repositories]);

  // Determine hero repository
  const heroRepo = React.useMemo(() => {
    const lastOpenedId = getLastOpenedRepoId(user?.id);
    const dateMap: ConversationDateMap = {};
    for (const [repoId, conv] of Object.entries(lastConversationsByRepo)) {
      dateMap[repoId] = conv.created_at;
    }
    return selectHeroRepository(repositories, lastOpenedId, dateMap);
  }, [repositories, user?.id, lastConversationsByRepo]);

  const heroConversation = heroRepo ? lastConversationsByRepo[heroRepo.id] : null;

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

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Repository intelligence and code search
          </p>
        </div>

        {total > 0 && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <MaterialIcon name="add" size={16} />
            Connect repository
          </Button>
        )}
      </div>

      {!loadingRepos && total === 0 ? (
        /* First-run Empty State */
        <div className="rounded-lg border border-white/10 bg-surface-raised p-12 text-center space-y-4 max-w-md mx-auto my-12">
          <div className="w-12 h-12 rounded-full bg-surface-overlay flex items-center justify-center mx-auto text-accent">
            <MaterialIcon name="source" size={24} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-text-primary">
              Connect your first repository
            </h2>
            <p className="text-xs text-text-secondary">
              Index your GitHub repositories for semantic search, architecture mapping, and cited code Q&amp;A.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setConnectOpen(true)}
            className="gap-1.5 text-xs font-medium"
          >
            <MaterialIcon name="add" size={16} />
            Connect repository
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Continue Hero */}
          <ContinueHero repository={heroRepo} lastConversation={heroConversation} />

          {/* Grid of connected repositories */}
          <RepoCardGrid repositories={repositories} />

          {/* Recent Conversations */}
          <RecentConversationsList
            conversations={recentConversations}
            loading={loadingConversations}
          />

          {/* Activity Timeline (collapsed by default) */}
          <ActivityTimeline
            repositories={repositories}
            onTriggerIndex={handleTriggerIndex}
          />
        </div>
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
export default DashboardPage;
