'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function ConnectRepositoryPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    try {
      setLoading(true);
      setError(null);
      await api.connectRepository(url);
      router.push('/repositories');
    } catch (err: unknown) {
      const apiErr = err as import('@/lib/api').ApiError;
      if (apiErr.code === 'UNAUTHENTICATED') {
        router.push('/');
      } else {
        setError(apiErr.message || 'Failed to connect repository');
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:px-0">
      <div className="mb-6">
        <Link href="/repositories" className="text-sm text-gray-500 hover:text-gray-900 flex items-center">
          ← Back to repositories
        </Link>
      </div>

      <div className="bg-white shadow sm:rounded-lg border border-gray-200">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Connect Repository
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Provide the URL of a GitHub repository you have access to.</p>
          </div>
          <form className="mt-5" onSubmit={handleSubmit}>
            <div className="w-full sm:max-w-xs">
              <label htmlFor="url" className="sr-only">
                GitHub Repository URL
              </label>
              <input
                type="url"
                name="url"
                id="url"
                className="shadow-sm focus:ring-gray-500 focus:border-gray-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="https://github.com/owner/repository"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            
            {error && (
              <div className="mt-4 bg-red-50 p-4 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !url}
              className={`mt-4 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                loading || !url ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900'
              }`}
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
