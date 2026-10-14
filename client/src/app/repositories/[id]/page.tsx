'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, RepositoryDetailOut, ApiError } from '@/lib/api';
import { mapErrorToCopy } from '@/lib/errors';
import { Copy } from 'lucide-react';

export default function RepositoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [repository, setRepository] = useState<RepositoryDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ copy: string; requestId?: string } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Guard with current-user endpoint
        const [, repoData] = await Promise.all([
          api.getCurrentUser(),
          api.getRepositoryDetail(id)
        ]);
        setRepository(repoData);

        // Update recent repositories in localStorage
        try {
          const stored = localStorage.getItem('recent_repositories');
          let recent = stored ? JSON.parse(stored) : [];
          recent = [id, ...recent.filter((r: string) => r !== id)].slice(0, 5);
          localStorage.setItem('recent_repositories', JSON.stringify(recent));
        } catch {
          // ignore
        }
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        if (apiErr.code === 'UNAUTHENTICATED' || apiErr.status === 401) {
          router.push('/?error=session_expired');
          return;
        }
        const copy = mapErrorToCopy(apiErr);
        if (copy === null) {
          router.push('/?error=session_expired');
          return;
        }
        setError({ copy, requestId: apiErr.requestId });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-0">
        <div className="text-center py-12 text-gray-500">Loading repository...</div>
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-0">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 flex items-center">
            ← Dashboard / Repository
          </Link>
        </div>
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-700">{error?.copy || "We couldn't find that."}</p>
          {error?.requestId && (
            <span className="text-[11px] text-red-500/70 font-mono flex items-center gap-1 mt-2 select-all">
              Reference: {error.requestId}
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(error.requestId!)}
                className="hover:text-red-700 transition-colors"
                aria-label="Copy reference ID"
              >
                <Copy size={11} />
              </button>
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-0">
      <div className="mb-6">
        <nav className="flex text-sm text-muted-foreground">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/dashboard" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
            </li>
            <li>/</li>
            <li className="font-medium text-foreground">
              {repository.owner}/{repository.name}
            </li>
          </ol>
        </nav>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {repository.owner} / {repository.name}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              ID: {repository.id}
            </p>
          </div>
          <span className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full border ${repository.is_private ? 'bg-surface border-border text-muted' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}>
            {repository.is_private ? 'Private' : 'Public'}
          </span>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500">Active Version</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {repository.active_version === null ? (
                  <span className="text-gray-500 italic">Not indexed yet</span>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <p><span className="font-semibold">Commit SHA:</span> {repository.active_version.commit_sha}</p>
                    <p className="mt-2"><span className="font-semibold">Status:</span> {repository.active_version.status}</p>
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
