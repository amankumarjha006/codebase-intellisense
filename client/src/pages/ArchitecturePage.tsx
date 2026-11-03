import * as React from 'react';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { getCachedRepository } from '../lib/api';
import { Repository } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { AnimatedPage } from '../components/ui/AnimatedPage';

export function ArchitecturePage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [repository] = React.useState<Repository | null>(() => (repoId ? getCachedRepository(repoId) : null));

  return (
    <AnimatedPage className="min-h-screen bg-[#0F0F0E] text-[#E6E6E6] flex flex-col">
      {repository && <RepositoryHeader repository={repository} />}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-[#161615] border border-[rgba(255,255,255,0.08)] rounded-xl p-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-lg bg-[#1D1D1B] border border-[rgba(255,255,255,0.08)] flex items-center justify-center mb-4 text-[#9E9E9E]">
            <MaterialIcon name="account_tree" size={24} />
          </div>
          <h1 className="text-lg font-medium text-[#E6E6E6] mb-2 font-['Google_Sans_Flex']">
            Architecture is being rebuilt
          </h1>
          <p className="text-sm text-[#9E9E9E] leading-relaxed">
            The architecture analysis system is being upgraded to an evidence-based engine featuring System maps, Component maps, and Data flows.
          </p>
        </div>
      </main>
    </AnimatedPage>
  );
}
