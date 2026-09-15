'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, RepositoryOut } from '@/lib/api';

export default function RepositoriesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositoryOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  const loadRepositories = useCallback(async (currentPage: number, currentSearch: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listRepositories(currentPage, limit, currentSearch);
      setRepositories(data.items);
      setHasMore(data.has_more);
    } catch (err: unknown) {
      const apiErr = err as import('@/lib/api').ApiError;
      if (apiErr.code === 'UNAUTHENTICATED') {
        router.push('/');
      } else {
        setError(apiErr.message || 'Failed to load repositories');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRepositories(page, search);
  }, [page, search, loadRepositories]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSearch(formData.get('search') as string);
    setPage(1); // Reset to first page on new search
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Repositories</h1>
        <Link
          href="/repositories/connect"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          Connect Repository
        </Link>
      </div>

      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search repositories..."
            defaultValue={search}
            className="shadow-sm focus:ring-gray-500 focus:border-gray-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
          />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading repositories...</div>
      ) : repositories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No repositories</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search ? 'No repositories match your search.' : 'No repositories connected yet.'}
          </p>
          {!search && (
            <div className="mt-6">
              <Link
                href="/repositories/connect"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800"
              >
                Connect Repository
              </Link>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white shadow-sm overflow-hidden sm:rounded-md border border-gray-200">
            <ul className="divide-y divide-gray-200">
              {repositories.map((repo) => (
                <li key={repo.id}>
                  <Link href={`/repositories/${repo.id}`} className="block hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                      <div className="text-sm font-medium text-blue-600 truncate">
                        {repo.owner} / {repo.name}
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${repo.is_private ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                          {repo.is_private ? 'Private' : 'Public'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 border rounded-md text-sm font-medium ${
                page === 1 
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className={`px-4 py-2 border rounded-md text-sm font-medium ${
                !hasMore 
                  ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
              }`}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
