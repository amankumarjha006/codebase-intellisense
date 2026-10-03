'use client';

import { Menu } from 'lucide-react';

export function AppHeader() {
  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-border bg-background z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger - will hook into a sheet later */}
        <button className="md:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:bg-secondary transition-colors" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <span>owner/repository</span>
          <span className="text-border">/</span>
          <span className="text-foreground">Overview</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Future actions will go here */}
      </div>
    </header>
  );
}
