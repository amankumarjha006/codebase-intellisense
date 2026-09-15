'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await api.getCurrentUser();
        // If successful, redirect to repositories
        router.push('/repositories');
      } catch (err: unknown) {
        const apiErr = err as import('@/lib/api').ApiError;
        if (apiErr.code === 'UNAUTHENTICATED') {
          // Expected, user needs to login
          setLoading(false);
        } else {
          // Unexpected error
          setError(apiErr.message || 'An error occurred while checking authentication.');
          setLoading(false);
        }
      }
    };

    checkAuth();
  }, [router]);

  const handleLogin = () => {
    // Redirect to the actual backend OAuth endpoint
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/github`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-lg shadow-sm">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Codebase Intellisense
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Connect your GitHub account to continue.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <button
            onClick={handleLogin}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          >
            Connect GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
