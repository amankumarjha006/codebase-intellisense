'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, RepositoryDetailOut } from '@/lib/api';

export default function RepositoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  
  const [repository, setRepository] = useState<RepositoryDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRepository = async () => {
      try {
        setLoading(true);
        const data = await api.getRepositoryDetail(id);
        setRepository(data);
      } catch (err: unknown) {
        const apiErr = err as import('@/lib/api').ApiError;
        if (apiErr.code === 'UNAUTHENTICATED') {
          router.push('/');
        } else if (apiErr.code === 'REPOSITORY_NOT_FOUND') {
          setError('Repository not found or you do not have access.');
        } else {
          setError(apiErr.message || 'Failed to load repository');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRepository();
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
          <Link href="/repositories" className="text-sm text-gray-500 hover:text-gray-900 flex items-center">
            ← Back to repositories
          </Link>
        </div>
        <div className="bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-700">{error || 'Repository not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-0">
      <div className="mb-6">
        <Link href="/repositories" className="text-sm text-gray-500 hover:text-gray-900 flex items-center">
          ← Back to repositories
        </Link>
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
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${repository.is_private ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
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
