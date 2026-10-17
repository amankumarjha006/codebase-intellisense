import * as React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Folder,
  FolderOpen,
  FileCode,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import { Repository, FileTreeNode, FileContent } from '../lib/types';
import { RepositoryHeader } from '../components/repository/RepositoryHeader';
import { Button } from '../components/ui/button';
import { shortSha } from '../lib/utils';

export function FilesPage() {
  const { id: repoId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [repository, setRepository] = React.useState<Repository | null>(null);
  const [fileTree, setFileTree] = React.useState<FileTreeNode | null>(null);
  const [activeFilePath, setActiveFilePath] = React.useState<string>(
    searchParams.get('path') || 'server/app/services/indexing/ast_chunker.py'
  );
  const [fileContent, setFileContent] = React.useState<FileContent | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [expandedDirs, setExpandedDirs] = React.useState<Record<string, boolean>>({
    server: true,
    'server/app': true,
    'server/app/services': true,
    'server/app/services/indexing': true,
  });

  React.useEffect(() => {
    if (!repoId) return;
    api.getRepository(repoId).then(setRepository);
    api.getFileTree(repoId).then(setFileTree);
  }, [repoId]);

  React.useEffect(() => {
    if (!repoId || !activeFilePath) return;
    api.getFileContent(repoId, activeFilePath).then(setFileContent);
  }, [repoId, activeFilePath]);

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const selectFile = (path: string) => {
    setActiveFilePath(path);
    setSearchParams({ path });
  };

  const handleCopy = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!repository) {
    return <div className="p-8 text-center text-xs text-[var(--color-muted)]">Loading repository...</div>;
  }

  // Recursive tree node renderer
  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    if (node.type === 'directory') {
      const isExpanded = !!expandedDirs[node.path];
      return (
        <div key={node.path || node.name} className="select-none">
          {node.path && (
            <button
              onClick={() => toggleDir(node.path)}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60 text-left transition"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {isExpanded ? (
                <FolderOpen size={14} className="text-[var(--color-accent)] shrink-0" />
              ) : (
                <Folder size={14} className="text-[var(--color-muted)] shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
          )}

          {(!node.path || isExpanded) && node.children && (
            <div>
              {node.children.map((child: FileTreeNode) => renderTreeNode(child, node.path ? depth + 1 : depth))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = activeFilePath === node.path;
    return (
      <button
        key={node.path}
        onClick={() => selectFile(node.path)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs text-left transition select-none truncate ${
          isSelected
            ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium border-l-2 border-[var(--color-accent)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)]/60'
        }`}
        style={{ paddingLeft: `${depth * 12 + 18}px` }}
      >
        <FileCode size={13} className="shrink-0 text-[var(--color-muted)]" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  };

  const codeLines = (fileContent?.content || '').split('\n');

  return (
    <div className="flex flex-col h-full bg-[var(--color-page)]">
      <RepositoryHeader repository={repository} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Tree Browser */}
        <div className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col shrink-0 overflow-y-auto p-2 no-scrollbar">
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)] flex items-center justify-between">
            <span>Repository Files</span>
            <span className="font-mono text-[10px] text-[var(--color-accent)]">
              {shortSha(repository.indexed_commit || '3a8f1c2')}
            </span>
          </div>
          <div className="mt-1 space-y-0.5">{fileTree && renderTreeNode(fileTree)}</div>
        </div>

        {/* Right: Code Viewer */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-page)]">
          {/* Metadata bar */}
          <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[var(--color-muted)]">path:</span>
              <span className="font-semibold text-[var(--color-text)]">{activeFilePath}</span>
              <span className="hidden sm:inline text-[var(--color-muted)]">•</span>
              <span className="hidden sm:inline text-[var(--color-muted)]">
                {fileContent ? `${fileContent.line_count} lines (${Math.round(fileContent.size_bytes / 1024)} KB)` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[var(--color-accent-tint)] text-[var(--color-accent)] border border-[var(--color-accent-border)] font-medium">
                <ShieldCheck size={12} />
                <span>Tree-sitter AST Anchor</span>
              </div>

              <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy file content">
                {copied ? <Check size={14} className="text-[var(--color-accent)]" /> : <Copy size={14} />}
              </Button>

              <a
                href={`https://github.com/${repository.owner}/${repository.name}/blob/${repository.default_branch}/${activeFilePath}`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-raised)] transition"
                title="View on GitHub"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Full Code lines */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-6 bg-[var(--color-page)] select-text">
            <table className="w-full border-collapse">
              <tbody>
                {codeLines.map((line, idx) => {
                  const lineNum = idx + 1;
                  return (
                    <tr key={lineNum} className="hover:bg-[var(--color-raised)]/40 transition-colors">
                      <td className="w-12 select-none pr-4 pl-2 text-right text-[11px] text-[var(--color-muted)] border-r border-[var(--color-border)]/40">
                        {lineNum}
                      </td>
                      <td className="pl-4 text-[var(--color-text)] whitespace-pre overflow-x-auto">
                        {line || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Status Bar */}
          <div className="p-2.5 px-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between text-[11px] text-[var(--color-muted)] font-mono">
            <div className="flex items-center gap-4">
              <span>UTF-8</span>
              <span>LF</span>
              <span className="capitalize">{fileContent?.language || 'Text'}</span>
            </div>
            <div>Grounded in git commit {shortSha(repository.indexed_commit || '3a8f1c2')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
