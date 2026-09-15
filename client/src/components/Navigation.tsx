'use client';

import Link from 'next/link';
import { api } from '@/lib/api';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

export default function Navigation() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await api.logout();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed', error);
      setLoggingOut(false);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-lg font-bold text-gray-900">Codebase Intellisense</span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/repositories"
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Repositories
              </Link>
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
