import * as React from 'react';
import { useParams, useSearchParams, useLocation } from 'react-router-dom';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { api, getCachedRepository } from '../lib/api';
import { Repository, FileTreeNode, FileContent } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { shortSha } from '../lib/utils';
import { AnimatedPage } from '../components/ui/AnimatedPage';
import { LiveRegion } from '../components/ui/A11y';
import { FileTree, getFileIcon } from '../components/files/FileTree';
import { SourceViewer } from '../components/files/SourceViewer';

export function FilesPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [repository, setRepository] = React.useState<Repository | null>(() => (repoId ? getCachedRepository(repoId) : null));
  const [fileTree, setFileTree] = React.useState<FileTreeNode | null>(null);
  const [loadingTree, setLoadingTree] = React.useState(true);

  // Active file path
  const urlPath = searchParams.get('path');
  const [activeFilePath, setActiveFilePath] = React.useState<string>(
    urlPath || 'server/app/main.py'
  );

  // Target lines for citation / search highlight
  const urlStartLine = searchParams.get('start_line') || searchParams.get('line');
  const urlEndLine = searchParams.get('end_line') || searchParams.get('line');

  // Parse hash #L10 or #L10-L20 if present
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

  // File content & states
  const [fileContent, setFileContent] = React.useState<FileContent | null>(null);
  const [loadingContent, setLoadingContent] = React.useState(false);
  const [contentError, setContentError] = React.useState<string | null>(null);

  // UI state
  const [copiedPath, setCopiedPath] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);
  const [a11yStatus, setA11yStatus] = React.useState('');
  const [filterQuery, setFilterQuery] = React.useState('');
  const [isTreeCollapsed, setIsTreeCollapsed] = React.useState(false);

  // Recently viewed files history
  const [recentFiles, setRecentFiles] = React.useState<string[]>([
    urlPath || 'server/app/main.py',
  ]);

  // Expanded directory map
  const [expandedDirs, setExpandedDirs] = React.useState<Record<string, boolean>>({
    server: true,
    'server/app': true,
    'server/app/services': true,
    'server/app/services/indexing': true,
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

  // Initial load
  React.useEffect(() => {
    if (!repoId) return;
    setLoadingTree(true);
    Promise.all([api.getRepository(repoId), api.getFileTree(repoId)])
      .then(([repo, tree]) => {
        setRepository(repo);
        setFileTree(tree);
      })
      .catch((err) => {
        setContentError(err?.message || 'Failed to load repository files');
      })
      .finally(() => {
        setLoadingTree(false);
      });
  }, [repoId]);

  // Sync with searchParams
  React.useEffect(() => {
    if (urlPath && urlPath !== activeFilePath) {
      setActiveFilePath(urlPath);
      expandParentDirectories(urlPath);
      setRecentFiles((prev) => {
        if (!prev.includes(urlPath)) {
          return [...prev.slice(-7), urlPath];
        }
        return prev;
      });
    }
  }, [urlPath, activeFilePath, expandParentDirectories]);

  // Load active file content
  const loadFileContent = React.useCallback(async (path: string) => {
    if (!repoId || !path) return;
    setLoadingContent(true);
    setContentError(null);
    try {
      const content = await api.getFileContent(repoId, path);
      setFileContent(content);
      setA11yStatus(`Viewing file ${path}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFileContent(null);
      setContentError(errorMsg || `File '${path}' could not be loaded.`);
      setA11yStatus(`Error loading file ${path}`);
    } finally {
      setLoadingContent(false);
    }
  }, [repoId]);

  React.useEffect(() => {
    loadFileContent(activeFilePath);
  }, [activeFilePath, loadFileContent]);

  const handleSelectFile = (path: string) => {
    setActiveFilePath(path);
    expandParentDirectories(path);
    setRecentFiles((prev) => {
      if (!prev.includes(path)) {
        return [...prev.slice(-7), path];
      }
      return prev;
    });

    // Update URL params
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('path', path);
    // Clear targeted lines when user manually clicks another file in tree
    nextParams.delete('start_line');
    nextParams.delete('end_line');
    nextParams.delete('line');
    setSearchParams(nextParams);
  };

  const handleCloseRecent = (pathToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = recentFiles.filter((p) => p !== pathToRemove);
    setRecentFiles(remaining);
    if (activeFilePath === pathToRemove && remaining.length > 0) {
      handleSelectFile(remaining[remaining.length - 1]);
    }
  };

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleCollapseAll = () => {
    setExpandedDirs({});
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(activeFilePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyCode = () => {
    if (fileContent?.content) {
      navigator.clipboard.writeText(fileContent.content);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleClearTarget = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('start_line');
    nextParams.delete('end_line');
    nextParams.delete('line');
    setSearchParams(nextParams);
  };

  if (!repository) {
    return (
      <div
        role="status"
        aria-label="Loading repository"
        className="p-8 text-center text-xs text-[var(--color-muted)]"
      >
        Loading repository files...
      </div>
    );
  }

  // Path breadcrumb segments
  const pathSegments = activeFilePath.split('/');

  return (
    <AnimatedPage className="flex flex-col h-full bg-[var(--color-page)] overflow-hidden">
      <LiveRegion message={a11yStatus} />
      <RepositoryHeader repository={repository} />

      {/* Main Files Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left: File Tree Browser */}
        {!isTreeCollapsed ? (
          <aside
            aria-label="Repository file tree"
            className="w-64 sm:w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 overflow-hidden select-none z-10 shadow-sm"
          >
            {/* Tree Header */}
            <div className="px-3 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between gap-2 shrink-0 bg-[var(--color-raised)]/40">
              <div className="flex items-center gap-1.5 min-w-0">
                <MaterialIcon name="folder" size={16} fill={1} className="text-[var(--color-mint-accent,#B9E4D0)] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text)] truncate">
                  Repository Files
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCollapseAll}
                      aria-label="Collapse all directories"
                      className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
                    >
                      <MaterialIcon name="unfold_less" size={16} fill={0} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Collapse All</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsTreeCollapsed(true)}
                      aria-label="Collapse file tree panel"
                      className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
                    >
                      <MaterialIcon name="chevron_left" size={18} fill={0} aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Hide File Tree</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Tree Filter Search Input */}
            <div className="p-2 border-b border-[var(--color-border)]/60 bg-[var(--color-surface)]">
              <div className="relative">
                <MaterialIcon
                  name="search"
                  size={15}
                  fill={0}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter files..."
                  aria-label="Filter files in repository tree"
                  className="h-7 pl-7 pr-7 text-xs bg-[var(--color-raised)]/60 border-[var(--color-border)] focus:border-[var(--color-mint-accent,#B9E4D0)]"
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery('')}
                    aria-label="Clear file filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] p-0.5"
                  >
                    <MaterialIcon name="close" size={13} fill={0} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Content / Skeletons */}
            <ScrollArea className="flex-1 p-2">
              {loadingTree ? (
                <div className="space-y-2 p-2" aria-label="Loading file tree">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <FileTree
                  tree={fileTree}
                  activeFilePath={activeFilePath}
                  expandedDirs={expandedDirs}
                  filterQuery={filterQuery}
                  onSelectFile={handleSelectFile}
                  onToggleDir={toggleDir}
                />
              )}
            </ScrollArea>

            {/* Tree Footer Commit Indicator */}
            <div className="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between text-[10px] text-[var(--color-muted)] font-mono">
              <span>Commit {shortSha(repository.indexed_commit || '3a8f1c2')}</span>
              <span className="text-[var(--color-mint-accent,#B9E4D0)] font-semibold">Indexed</span>
            </div>
          </aside>
        ) : (
          /* Collapsed File Tree Strip */
          <div className="border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center py-2.5 px-1 shrink-0 select-none">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsTreeCollapsed(false)}
                  aria-label="Expand repository file tree"
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  <MaterialIcon name="chevron_right" size={20} fill={0} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Show File Tree</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Right: Main Source Viewer Panel */}
        <main
          id="main-content"
          aria-label="Source code viewer"
          className="flex-1 flex flex-col overflow-hidden bg-[var(--color-page)]"
        >
          {/* Recently Viewed Files Tabs */}
          {recentFiles.length > 0 && (
            <div
              role="tablist"
              aria-label="Recently viewed files"
              className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto no-scrollbar shrink-0 select-none"
            >
              {recentFiles.map((path) => {
                const isTabActive = activeFilePath === path;
                const tabFileName = path.split('/').pop() || path;
                const iconName = getFileIcon(tabFileName);

                return (
                  <div
                    key={path}
                    role="tab"
                    aria-selected={isTabActive}
                    onClick={() => handleSelectFile(path)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs border-r border-[var(--color-border)] cursor-pointer transition shrink-0 group ${
                      isTabActive
                        ? 'bg-[var(--color-page)] text-[var(--color-text)] font-medium border-t-2 border-t-[var(--color-mint-accent,#B9E4D0)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/50 border-t-2 border-t-transparent'
                    }`}
                  >
                    <MaterialIcon
                      name={iconName}
                      size={14}
                      fill={isTabActive ? 1 : 0}
                      className={isTabActive ? 'text-[var(--color-mint-accent,#B9E4D0)]' : 'text-[var(--color-muted)]'}
                      aria-hidden="true"
                    />
                    <span className="truncate max-w-[140px]">{tabFileName}</span>

                    {recentFiles.length > 1 && (
                      <button
                        onClick={(e) => handleCloseRecent(path, e)}
                        aria-label={`Close tab for ${tabFileName}`}
                        className="opacity-0 group-hover:opacity-100 hover:text-[var(--color-mint-accent,#B9E4D0)] transition p-0.5"
                      >
                        <MaterialIcon name="close" size={12} fill={0} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Breadcrumb & Code Action Toolbar */}
          <div className="p-2.5 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
            {/* Breadcrumb Path */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-mono text-xs text-[var(--color-muted)] truncate min-w-0">
              <MaterialIcon name="terminal" size={15} fill={0} className="text-[var(--color-mint-accent,#B9E4D0)] shrink-0" aria-hidden="true" />
              {pathSegments.map((segment, idx) => {
                const isLast = idx === pathSegments.length - 1;
                const subPath = pathSegments.slice(0, idx + 1).join('/');

                return (
                  <React.Fragment key={subPath}>
                    {idx > 0 && <span className="text-[var(--color-border)]">/</span>}
                    {isLast ? (
                      <span className="font-semibold text-[var(--color-text)] truncate">{segment}</span>
                    ) : (
                      <button
                        onClick={() => {
                          setExpandedDirs((prev) => ({ ...prev, [subPath]: true }));
                          setIsTreeCollapsed(false);
                        }}
                        className="hover:text-[var(--color-text)] transition truncate"
                      >
                        {segment}
                      </button>
                    )}
                  </React.Fragment>
                );
              })}

              {/* File Stats */}
              {fileContent && (
                <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-[var(--color-border)] text-[11px] text-[var(--color-muted)]">
                  <span>{fileContent.line_count} lines</span>
                  <span aria-hidden="true">•</span>
                  <span>{Math.round(fileContent.size_bytes / 1024)} KB</span>
                  <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 bg-[var(--color-raised)] text-[var(--color-text-secondary)] font-mono">
                    {fileContent.language || 'text'}
                  </Badge>
                </div>
              )}
            </nav>

            {/* Code Actions (Copy Path, Copy Code, GitHub Link) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopyPath}
                    aria-label="Copy file path"
                    className="h-7 w-7 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    <MaterialIcon
                      name={copiedPath ? 'check' : 'link'}
                      size={15}
                      fill={copiedPath ? 1 : 0}
                      className={copiedPath ? 'text-[var(--color-mint-accent,#B9E4D0)]' : ''}
                      aria-hidden="true"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {copiedPath ? 'Path Copied!' : 'Copy Relative Path'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleCopyCode}
                    aria-label="Copy entire file code"
                    className="h-7 w-7 text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    <MaterialIcon
                      name={copiedCode ? 'check' : 'content_copy'}
                      size={15}
                      fill={copiedCode ? 1 : 0}
                      className={copiedCode ? 'text-[var(--color-mint-accent,#B9E4D0)]' : ''}
                      aria-hidden="true"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {copiedCode ? 'Code Copied!' : 'Copy Code Content'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://github.com/${repository.owner}/${repository.name}/blob/${repository.default_branch}/${activeFilePath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="h-7 w-7 rounded flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-mint-accent,#B9E4D0)] hover:bg-[var(--color-raised)] transition"
                    title="View original on GitHub"
                    aria-label="View original file on GitHub"
                  >
                    <MaterialIcon name="open_in_new" size={15} fill={0} aria-hidden="true" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">View on GitHub</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Main Code View Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {loadingContent ? (
              /* Loading Skeleton */
              <div className="p-6 space-y-3 font-mono" aria-label="Loading source code">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : contentError ? (
              /* Error / Missing File State */
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="max-w-md text-center space-y-4 p-6 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-raised)]/50">
                  <div className="h-12 w-12 rounded-xl bg-[var(--color-page)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-warning)] mx-auto">
                    <MaterialIcon name="error_outline" size={24} fill={1} aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">
                      File Unavailable
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      {contentError}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => loadFileContent(activeFilePath)}
                    className="gap-1.5 text-xs"
                    aria-label="Retry loading file"
                  >
                    <MaterialIcon name="refresh" size={14} fill={0} aria-hidden="true" />
                    <span>Retry Loading</span>
                  </Button>
                </div>
              </div>
            ) : fileContent ? (
              /* Rich Syntax-Highlighted Code Viewer */
              <SourceViewer
                code={fileContent.content}
                language={fileContent.language}
                filePath={activeFilePath}
                targetStartLine={targetStartLine}
                targetEndLine={targetEndLine}
                onClearTarget={handleClearTarget}
              />
            ) : null}
          </div>

          {/* Footer Status Bar */}
          <div className="p-2 px-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between text-[11px] text-[var(--color-muted)] font-mono shrink-0 select-none">
            <div className="flex items-center gap-4">
              <span>UTF-8</span>
              <span>LF</span>
              <span className="capitalize">{fileContent?.language || 'Text'}</span>
              {fileContent && <span>{fileContent.line_count} lines</span>}
            </div>
            <div className="hidden sm:inline">
              Grounded in git revision {shortSha(repository.indexed_commit || '3a8f1c2')}
            </div>
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}
