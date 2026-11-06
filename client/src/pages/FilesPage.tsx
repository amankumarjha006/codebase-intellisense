import * as React from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api, getCachedRepository } from '../lib/api';
import type { Repository, FileTreeNode, FileContent } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { FileTree } from '../components/files/FileTree';
import { SourceViewer } from '../components/files/SourceViewer';
import { toast } from '../components/ui/sonner';

export function FilesPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const { data: repository = null } = useQuery<Repository | null>({
    queryKey: ['repository', repoId],
    queryFn: () => (repoId ? api.getRepository(repoId) : Promise.resolve(null)),
    enabled: Boolean(repoId),
    initialData: () => (repoId ? getCachedRepository(repoId) : null),
  });

  // Active file path from URL or empty default
  const urlPath = searchParams.get('path');
  const [activeFilePath, setActiveFilePath] = React.useState<string>(urlPath || '');

  // Target lines from query params or URL hash #L10 or #L10-L20
  const urlStartLine = searchParams.get('start_line') || searchParams.get('line');
  const urlEndLine = searchParams.get('end_line') || searchParams.get('line');
  const hashMatch = location.hash.match(/^#L(\d+)(?:-L?(\d+))?$/);

  const targetStartLine = urlStartLine
    ? parseInt(urlStartLine, 10)
    : hashMatch
    ? parseInt(hashMatch[1], 10)
    : null;

  const targetEndLine = urlEndLine
    ? parseInt(urlEndLine, 10)
    : hashMatch && hashMatch[2]
    ? parseInt(hashMatch[2], 10)
    : targetStartLine;

  const [a11yStatus, setA11yStatus] = React.useState('');
  const [filterQuery, setFilterQuery] = React.useState('');
  const [isTreeCollapsed, setIsTreeCollapsed] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<'tree' | 'source'>('source');

  // Expanded directory map
  const [expandedDirs, setExpandedDirs] = React.useState<Record<string, boolean>>({
    fastapi: true,
    'fastapi/dependencies': true,
    server: true,
    'server/app': true,
    client: true,
    'client/src': true,
  });

  // Automatically expand parent directories of the active file
  const expandParentDirectories = React.useCallback((filePath: string) => {
    const parts = filePath.split('/');
    if (parts.length <= 1) return;
    setExpandedDirs((prev) => {
      const next = { ...prev };
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current = current ? `${current}/${parts[i]}` : parts[i];
        next[current] = true;
      }
      return next;
    });
  }, []);

  // Query: Cached file tree per version
  const { data: fileTree, isLoading: loadingTree } = useQuery<FileTreeNode>({
    queryKey: ['file-tree', repoId, repository?.active_version_short_sha ?? 'latest'],
    queryFn: () => api.getFileTree(repoId!),
    enabled: Boolean(repoId),
    staleTime: 60_000,
  });

  // Automatically select the first file when tree loads and no file is active
  React.useEffect(() => {
    if (fileTree && !activeFilePath) {
      const findFirstFile = (node: FileTreeNode): string | null => {
        if (node.type === 'file') return node.path;
        if (node.children && node.children.length > 0) {
          const readme = node.children.find((c) => c.type === 'file' && /readme/i.test(c.name));
          if (readme) return readme.path;
          for (const child of node.children) {
            const found = findFirstFile(child);
            if (found) return found;
          }
        }
        return null;
      };

      const defaultFile = findFirstFile(fileTree);
      if (defaultFile) {
        setActiveFilePath(defaultFile);
        expandParentDirectories(defaultFile);
      }
    }
  }, [fileTree, activeFilePath, expandParentDirectories]);

  // Query: Cached file content for the active path
  const {
    data: fileContent,
    isLoading: loadingContent,
    error: contentError,
  } = useQuery<FileContent>({
    queryKey: ['file-content', repoId, activeFilePath],
    queryFn: () => api.getFileContent(repoId!, activeFilePath),
    enabled: Boolean(repoId && activeFilePath),
    staleTime: 60_000,
  });

  // Sync state when urlPath changes
  React.useEffect(() => {
    if (urlPath && urlPath !== activeFilePath) {
      setActiveFilePath(urlPath);
      expandParentDirectories(urlPath);
    }
  }, [urlPath, activeFilePath, expandParentDirectories]);

  const handleSelectFile = (path: string) => {
    setActiveFilePath(path);
    expandParentDirectories(path);
    setMobileView('source');
    setA11yStatus(`Loaded file ${path}`);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('path', path);
    nextParams.delete('start_line');
    nextParams.delete('end_line');
    nextParams.delete('line');
    setSearchParams(nextParams);
  };

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCollapseAll = () => {
    setExpandedDirs({});
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(activeFilePath);
    toast.success(`Copied path: ${activeFilePath}`);
  };

  const handleCopyCode = () => {
    if (fileContent?.content) {
      navigator.clipboard.writeText(fileContent.content);
      toast.success('File contents copied to clipboard');
    }
  };

  const handleClearTarget = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('start_line');
    nextParams.delete('end_line');
    nextParams.delete('line');
    setSearchParams(nextParams);
  };

  const handleReindex = React.useCallback(async () => {
    if (!repoId) return;
    await api.reindexRepository(repoId);
  }, [repoId]);

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="p-8 text-center text-xs text-text-secondary font-mono"
      >
        Loading repository files…
      </div>
    );
  }

  const pathSegments = activeFilePath ? activeFilePath.split('/') : [];

  return (
    <AnimatedPage className="flex flex-col min-h-screen bg-surface-base text-text-primary font-sans">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} onReindex={handleReindex} />

      {/* Mobile view toggle */}
      <div className="sm:hidden flex items-center justify-between p-2 border-b border-white/10 bg-surface-raised">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-overlay border border-white/10">
          <button
            onClick={() => setMobileView('tree')}
            className={`px-3 py-1 rounded text-xs font-medium ${
              mobileView === 'tree' ? 'bg-surface-raised text-white' : 'text-text-secondary'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setMobileView('source')}
            className={`px-3 py-1 rounded text-xs font-medium ${
              mobileView === 'source' ? 'bg-surface-raised text-white' : 'text-text-secondary'
            }`}
          >
            Code
          </button>
        </div>
        <span className="text-xs font-mono text-text-secondary truncate max-w-[180px]">
          {pathSegments[pathSegments.length - 1]}
        </span>
      </div>

      {/* Main Files Workspace Split Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Virtualized File Tree Browser */}
        <AnimatePresence>
          {!isTreeCollapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              aria-label="Repository file tree"
              className={`
                w-full sm:w-72 lg:w-80 border-r border-white/10 bg-surface-raised flex flex-col shrink-0 overflow-hidden select-none z-10
                ${mobileView === 'source' ? 'hidden sm:flex' : 'flex'}
              `}
            >
              {/* Tree Top Bar */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-surface-raised">
              <div className="flex items-center gap-2 min-w-0">
                <MaterialIcon name="folder" size={16} className="text-accent shrink-0" aria-hidden="true" />
                <span className="text-xs font-medium text-text-primary truncate">
                  Files
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  aria-label="Collapse all directories"
                  className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition"
                  title="Collapse all"
                >
                  <MaterialIcon name="unfold_less" size={16} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsTreeCollapsed(true)}
                  aria-label="Collapse file tree panel"
                  className="hidden sm:inline-flex p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition"
                  title="Hide tree"
                >
                  <MaterialIcon name="chevron_left" size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Tree Filter Search Input */}
            <div className="p-2 border-b border-white/10 bg-surface-raised">
              <div className="relative">
                <MaterialIcon
                  name="search"
                  size={15}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter files… (/)"
                  aria-label="Filter files in repository tree"
                  className="h-8 pl-8 pr-7 text-xs bg-surface-overlay border-white/10 focus-visible:border-accent text-text-primary placeholder:text-text-tertiary"
                />
                {filterQuery && (
                  <button
                    type="button"
                    onClick={() => setFilterQuery('')}
                    aria-label="Clear file filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-0.5"
                  >
                    <MaterialIcon name="close" size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Virtualized Tree Component */}
            {loadingTree ? (
              <div className="p-4 text-center text-xs text-text-secondary font-mono animate-pulse">
                Loading file tree…
              </div>
            ) : (
              <FileTree
                tree={fileTree || null}
                activeFilePath={activeFilePath}
                expandedDirs={expandedDirs}
                filterQuery={filterQuery}
                onSelectFile={handleSelectFile}
                onToggleDir={toggleDir}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

        {/* Right: Code Viewer Container */}
        <div
          className={`
            flex-1 flex flex-col min-w-0 bg-surface-base
            ${mobileView === 'tree' ? 'hidden sm:flex' : 'flex'}
          `}
        >
          {/* Viewer Top Action Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-surface-raised gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isTreeCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsTreeCollapsed(false)}
                  aria-label="Show file tree"
                  className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition mr-1"
                  title="Show tree"
                >
                  <MaterialIcon name="chevron_right" size={18} aria-hidden="true" />
                </button>
              )}

              {/* Breadcrumb path */}
              <nav aria-label="File path" className="flex items-center gap-1.5 min-w-0 text-xs font-mono">
                {pathSegments.map((seg, idx) => (
                  <React.Fragment key={`${seg}-${idx}`}>
                    {idx > 0 && <span className="text-text-tertiary">/</span>}
                    <span
                      className={`truncate ${
                        idx === pathSegments.length - 1
                          ? 'font-medium text-text-primary'
                          : 'text-text-secondary'
                      }`}
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
              </nav>

              {fileContent && (
                <span className="hidden md:inline-flex shrink-0 text-xs text-text-secondary font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 ml-2">
                  {fileContent.line_count} lines · {Math.round(fileContent.size_bytes / 1024)} KB
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPath}
                className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary border-white/10"
                aria-label="Copy file path"
              >
                <MaterialIcon name="content_copy" size={14} />
                <span className="hidden md:inline ml-1.5">Copy path</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyCode}
                className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary border-white/10"
                aria-label="Copy file code"
              >
                <MaterialIcon name="code" size={14} />
                <span className="hidden md:inline ml-1.5">Copy code</span>
              </Button>
            </div>
          </div>

          {/* Viewer Code Body */}
          <div className="flex-1 overflow-hidden relative">
            {!activeFilePath ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-text-secondary font-mono space-y-2">
                <MaterialIcon name="folder_open" size={28} className="text-text-tertiary" />
                <p>Select a file from the tree to view source code.</p>
              </div>
            ) : loadingContent ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-text-secondary font-mono space-y-2">
                <MaterialIcon name="sync" size={20} className="animate-spin text-text-tertiary" />
                <p>Loading file content…</p>
              </div>
            ) : contentError ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-2">
                <MaterialIcon name="error_outline" size={24} className="text-status-failed" />
                <p className="text-xs text-status-failed">{contentError instanceof Error ? contentError.message : String(contentError)}</p>
              </div>
            ) : fileContent ? (
              <motion.div
                key={fileContent.path}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="h-full w-full overflow-hidden"
              >
                <SourceViewer
                  code={fileContent.content}
                  language={fileContent.language}
                  filePath={fileContent.path}
                  targetStartLine={targetStartLine}
                  targetEndLine={targetEndLine}
                  onClearTarget={handleClearTarget}
                />
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-xs text-text-secondary font-mono">
                Select a file to inspect source code.
              </div>
            )}
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
