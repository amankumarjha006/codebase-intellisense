'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

// Define the nodes for the abstract visualization
const nodes = [
  { id: 'repo', label: 'Repository', x: 50, y: 15, delay: 0 },
  { id: 'dir1', label: 'client/', x: 30, y: 40, delay: 0.2 },
  { id: 'dir2', label: 'server/', x: 70, y: 40, delay: 0.3 },
  { id: 'file1', label: 'page.tsx', x: 15, y: 65, delay: 0.4 },
  { id: 'file2', label: 'utils.ts', x: 40, y: 65, delay: 0.5 },
  { id: 'file3', label: 'api.py', x: 60, y: 65, delay: 0.6 },
  { id: 'file4', label: 'models.py', x: 85, y: 65, delay: 0.7 },
  { id: 'ai', label: 'semantic search', x: 50, y: 90, delay: 1.0, isSpecial: true },
];

const edges = [
  { source: 'repo', target: 'dir1' },
  { source: 'repo', target: 'dir2' },
  { source: 'dir1', target: 'file1' },
  { source: 'dir1', target: 'file2' },
  { source: 'dir2', target: 'file3' },
  { source: 'dir2', target: 'file4' },
  { source: 'file1', target: 'ai', isDashed: true },
  { source: 'file2', target: 'ai', isDashed: true },
  { source: 'file3', target: 'ai', isDashed: true },
  { source: 'file4', target: 'ai', isDashed: true },
];

export function RepositoryVisualization() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-full w-full opacity-0" />;

  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto select-none pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
        {/* Draw edges */}
        {edges.map((edge, idx) => {
          const sourceNode = nodes.find(n => n.id === edge.source)!;
          const targetNode = nodes.find(n => n.id === edge.target)!;

          return (
            <motion.line
              key={`edge-${idx}`}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke="currentColor"
              strokeWidth="0.5"
              className={edge.isDashed ? "text-primary/30" : "text-border/60"}
              strokeDasharray={edge.isDashed ? "1,1" : "none"}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 1.5,
                delay: Math.max(sourceNode.delay, targetNode.delay) + 0.2,
                ease: "easeInOut"
              }}
            />
          );
        })}

        {/* Draw nodes */}
        {nodes.map((node) => (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: node.delay, ease: "easeOut" }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.isSpecial ? "3" : "1.5"}
              className={node.isSpecial ? "fill-primary/20 stroke-primary/50" : "fill-background stroke-border"}
              strokeWidth={node.isSpecial ? "0.5" : "1"}
            />
            {node.isSpecial && (
              <motion.circle
                cx={node.x}
                cy={node.y}
                r="3"
                className="fill-none stroke-primary/30"
                strokeWidth="0.5"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: node.delay + 0.5 }}
              />
            )}
            <text
              x={node.x}
              y={node.y + (node.isSpecial ? 7 : 5)}
              fontSize="2.5"
              textAnchor="middle"
              className={`font-mono ${node.isSpecial ? "fill-primary" : "fill-muted-foreground"}`}
            >
              {node.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}
