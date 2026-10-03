'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { LayoutDashboard, MessageSquare, Search, Code2, GitBranch, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './UserMenu';

const navItems = [
  { name: 'Overview', href: '/repositories', icon: LayoutDashboard }, // Placeholder link mapping
  { name: 'Chat', href: '/repositories/chat', icon: MessageSquare },
  { name: 'Search', href: '/repositories/search', icon: Search },
  { name: 'Code', href: '/repositories/code', icon: Code2 },
  { name: 'Architecture', href: '/repositories/architecture', icon: GitBranch },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="hidden md:flex flex-col h-full border-r border-border bg-card z-20 flex-shrink-0"
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Codebase Intelligence</span>
            <span className="text-sm font-medium text-foreground truncate flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.5)] flex-shrink-0" />
              owner/repository
            </span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={cn("p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0", collapsed && "mx-auto")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          // For now, treat exact match or startsWith depending on routing structure.
          // Since it's a placeholder shell, strict exact matching is fine.
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground font-medium",
                collapsed && "justify-center px-0"
              )}
            >
              <item.icon size={18} className={cn("flex-shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </div>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith('/settings')
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0"
          )}
        >
          <Settings size={18} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <UserMenu collapsed={collapsed} />
      </div>
    </motion.aside>
  );
}
