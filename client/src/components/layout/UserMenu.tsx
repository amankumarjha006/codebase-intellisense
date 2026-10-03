'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserMenu({ collapsed }: { collapsed?: boolean }) {
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
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      title={collapsed ? "Logout" : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        collapsed && "justify-center px-0"
      )}
    >
      <LogOut size={18} className="flex-shrink-0" />
      {!collapsed && <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>}
    </button>
  );
}
