import * as React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  ArchitectureEdgeData,
  ArchitectureNodeData,
  ArchitectureOut,
  ComponentOut,
} from '../../lib/architecture/types';
import { mapPayloadToGraph } from '../../lib/architecture/mapper';
import { layoutArchitectureGraph } from '../../lib/architecture/layout';
import { ComponentNode } from './ComponentNode';
import { ComponentEdge } from './ComponentEdge';
import { ComponentDetailsPanel } from './ComponentDetailsPanel';

const nodeTypes = {
  componentNode: ComponentNode,
};

const edgeTypes = {
  componentEdge: ComponentEdge,
};

interface ComponentMapViewProps {
  payload: ArchitectureOut;
  repoId: string;
  highlightedComponentIds?: Set<string>;
  highlightedEdgeKeys?: Set<string>;
}

export function ComponentMapView({
  payload,
  repoId,
  highlightedComponentIds,
  highlightedEdgeKeys,
}: ComponentMapViewProps) {
  const [selectedComp, setSelectedComp] = React.useState<ComponentOut | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ArchitectureNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<ArchitectureEdgeData>>([]);
  const [isLayingOut, setIsLayingOut] = React.useState(true);

  // Compute graph & run layout
  React.useEffect(() => {
    let isMounted = true;

    async function computeLayout() {
      setIsLayingOut(true);
      const { nodes: rawNodes, edges: rawEdges } = mapPayloadToGraph(payload, {
        selectedComponentId: selectedComp?.id,
        highlightedComponentIds,
        highlightedEdgeKeys,
        onSelectComponent: (comp) => {
          setSelectedComp(comp);
        },
      });

      const laidOut = await layoutArchitectureGraph(rawNodes, rawEdges);
      if (isMounted) {
        setNodes(laidOut.nodes);
        setEdges(laidOut.edges);
        setIsLayingOut(false);
      }
    }

    computeLayout();

    return () => {
      isMounted = false;
    };
  }, [payload, selectedComp?.id, highlightedComponentIds, highlightedEdgeKeys, setNodes, setEdges]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    const comp = (node.data as ArchitectureNodeData)?.component;
    if (comp) {
      setSelectedComp(comp);
    }
  };

  const handlePaneClick = () => {
    setSelectedComp(null);
  };

  return (
    <div className="relative w-full h-[650px] min-h-[500px] rounded-xl border border-white/[0.08] bg-[#0F0F0E] overflow-hidden">
      {isLayingOut && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0F0F0E]/80 backdrop-blur-xs text-xs text-white/50">
          Calculating graph layout…
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onlyRenderVisibleElements={true}
        nodesFocusable={true}
        fitView={true}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.04)" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-[#161615] !border-white/[0.08] !text-white/70"
        />
        <MiniMap
          nodeColor="#1D1D1B"
          maskColor="rgba(15, 15, 14, 0.7)"
          className="!bg-[#161615] !border-white/[0.08] rounded-lg overflow-hidden"
        />
      </ReactFlow>

      {/* Right-hand details panel */}
      {selectedComp && (
        <ComponentDetailsPanel
          component={selectedComp}
          payload={payload}
          repoId={repoId}
          onClose={() => setSelectedComp(null)}
          onSelectComponent={(nextComp) => setSelectedComp(nextComp)}
        />
      )}
    </div>
  );
}

