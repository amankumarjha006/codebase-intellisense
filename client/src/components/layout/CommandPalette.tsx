import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '../ui/command';
import { MaterialIcon } from '../ui/MaterialIcon';
import { useIndexingStatus } from '../../lib/useIndexingStatus';
import { isInputFocused } from '../../lib/keyboard';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenConnect: () => void;
}

export function CommandPalette({ open, onOpenChange, onOpenConnect }: CommandPaletteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { repositories } = useIndexingStatus();

  // Extract repo ID if inside a repo view
  const match = location.pathname.match(/\/repositories\/([a-zA-Z0-9_-]+)/);
  const currentRepoId = match ? match[1] : null;

  // Global keyboard shortcut ⌘K / Ctrl+K with shortcut guard
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === '/' && !isInputFocused(e)) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const handleSelect = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, jump to repo, or search..." />
      <CommandList>
        <CommandEmpty>No matching commands or repositories found.</CommandEmpty>

        {/* Current Repository Navigation */}
        {currentRepoId && (
          <CommandGroup heading="Current Repository">
            <CommandItem
              onSelect={() => handleSelect(() => navigate(`/repositories/${currentRepoId}`))}
              className="cursor-pointer"
            >
              <MaterialIcon name="description" size={16} className="mr-2" />
              <span>Overview</span>
              <CommandShortcut>1</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate(`/repositories/${currentRepoId}/chat`))}
              className="cursor-pointer"
            >
              <MaterialIcon name="chat" size={16} className="mr-2" />
              <span>Cited Q&A Chat</span>
              <CommandShortcut>2</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate(`/repositories/${currentRepoId}/architecture`))}
              className="cursor-pointer"
            >
              <MaterialIcon name="account_tree" size={16} className="mr-2" />
              <span>Architecture Map</span>
              <CommandShortcut>3</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate(`/repositories/${currentRepoId}/search`))}
              className="cursor-pointer"
            >
              <MaterialIcon name="search" size={16} className="mr-2" />
              <span>Search Code</span>
              <CommandShortcut>4</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => navigate(`/repositories/${currentRepoId}/files`))}
              className="cursor-pointer"
            >
              <MaterialIcon name="folder" size={16} className="mr-2" />
              <span>Files Browser</span>
              <CommandShortcut>5</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Global Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect(() => navigate('/dashboard'))} className="cursor-pointer">
            <MaterialIcon name="home" size={16} className="mr-2" />
            <span>Go to Home</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/repositories'))} className="cursor-pointer">
            <MaterialIcon name="folder" size={16} className="mr-2" />
            <span>Repositories Catalog</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                onOpenConnect();
              })
            }
            className="cursor-pointer"
          >
            <MaterialIcon name="add" size={16} className="mr-2" />
            <span>Connect a new repository</span>
          </CommandItem>
        </CommandGroup>

        {/* Repositories Quick Jump */}
        {repositories.length > 0 && (
          <CommandGroup heading="Repositories">
            {repositories.map((repo) => (
              <CommandItem
                key={repo.id}
                onSelect={() => handleSelect(() => navigate(`/repositories/${repo.id}`))}
                className="cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <MaterialIcon name="folder" size={16} className="text-[var(--color-text-secondary)]" />
                  <span>
                    {repo.owner}/{repo.name}
                  </span>
                </div>
                {repo.latest_job_status && repo.latest_job_status !== 'READY' && (
                  <span className="text-[10px] font-mono text-[#FDD663]">{repo.latest_job_status.toLowerCase()}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

