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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground animate-pulse">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Brand/Logo Placeholder could go here */}
      <div className="mb-8 w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </div>

      <div className="max-w-md w-full space-y-6 bg-card p-10 rounded-xl border border-border shadow-sm">
        <div>
          <h2 className="mt-2 text-center text-3xl font-semibold tracking-tight text-foreground">
            Codebase Intellisense
          </h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Connect your GitHub account to continue.
          </p>
        </div>
        
        {error && (
          <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20">
            <p className="text-sm text-destructive font-medium text-center">{error}</p>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={handleLogin}
            className="group relative w-full flex justify-center items-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-background transition-colors"
          >
            Connect GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
