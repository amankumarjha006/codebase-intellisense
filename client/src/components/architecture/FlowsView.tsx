import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ArchitectureOut } from '../../lib/architecture/types';
import { selectStepHighlight } from '../../lib/architecture/highlight';
import { ComponentMapView } from './ComponentMapView';
import { MaterialIcon } from '../ui/MaterialIcon';

interface FlowsViewProps {
  payload: ArchitectureOut;
  repoId: string;
}

export function FlowsView({ payload, repoId }: FlowsViewProps) {
  const navigate = useNavigate();
  const flows = payload.flows || [];
  const [selectedFlowId, setSelectedFlowId] = React.useState<string | null>(
    flows.length > 0 ? flows[0].id : null
  );
  const [selectedStepIdx, setSelectedStepIdx] = React.useState<number | null>(0);

  const activeFlow = flows.find((f) => f.id === selectedFlowId) || flows[0] || null;

  // Derive static highlights using pure selector
  const { highlightedComponentIds, highlightedEdgeKeys } = React.useMemo(() => {
    return selectStepHighlight(activeFlow, selectedStepIdx);
  }, [activeFlow, selectedStepIdx]);

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-white/[0.08] bg-[#161615]">
        <MaterialIcon
          name="alt_route"
          size={36}
          className="text-white/30 mb-3"
          aria-hidden="true"
        />
        <h3 className="text-sm font-medium text-white/80 mb-1">
          No route handlers detected
        </h3>
        <p className="text-xs text-white/40 max-w-sm">
          No HTTP route endpoints or traced flows were found in the analyzed source code.
        </p>
      </div>
    );
  }

  const compMap = new Map((payload.components || []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      {/* Flow Selection Tabs / Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {flows.map((flow) => {
          const isSelected = flow.id === activeFlow?.id;
          return (
            <button
              key={flow.id}
              onClick={() => {
                setSelectedFlowId(flow.id);
                setSelectedStepIdx(0);
              }}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap flex items-center gap-1.5
                ${
                  isSelected
                    ? 'bg-[#1D1D1B] border-white/40 text-white'
                    : 'bg-[#161615] border-white/[0.06] text-white/60 hover:text-white/80 hover:border-white/20'
                }
              `}
            >
              <span className="font-mono text-[10px] uppercase px-1 py-0.5 rounded bg-white/[0.06] text-white/50">
                {flow.entry.method}
              </span>
              <span className="truncate max-w-[220px]">{flow.entry.path}</span>
            </button>
          );
        })}
      </div>

      {activeFlow && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Step Sequence List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#161615] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-white/90 truncate">{activeFlow.title}</span>
                <span className="text-[10px] font-mono text-white/40">{activeFlow.steps.length} steps</span>
              </div>
              <div className="font-mono text-[11px] text-white/40 truncate">
                Entrypoint: {activeFlow.entry.file}:{activeFlow.entry.line}
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {activeFlow.steps.map((step, idx) => {
                const isStepActive = selectedStepIdx === idx;
                const comp = compMap.get(step.component_id);

                return (
                  <div
                    key={`${step.component_id}-${idx}`}
                    onClick={() => setSelectedStepIdx(idx)}
                    className={`
                      p-3 rounded-xl border transition-all cursor-pointer text-xs
                      ${
                        isStepActive
                          ? 'bg-[#1D1D1B] border-white/40 shadow-sm'
                          : 'bg-[#161615] border-white/[0.06] hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono bg-white/[0.06] text-white/70">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-white/90">
                          {comp ? comp.name : step.component_id}
                        </span>
                      </div>
                      {comp && (
                        <span className="text-[10px] font-mono text-white/40">
                          L{comp.layer}
                        </span>
                      )}
                    </div>

                    {/* Step caption */}
                    {step.caption && (
                      <p className="text-white/70 leading-relaxed text-[11px] mb-2 pl-7">
                        {step.caption}
                      </p>
                    )}

                    {/* Citations */}
                    {step.citations && step.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-7 mt-1.5">
                        {step.citations.map((cite, cIdx) => (
                          <button
                            key={`${cite.file_path}-${cIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(
                                `/repositories/${repoId}/files?path=${encodeURIComponent(
                                  cite.file_path
                                )}&line=${cite.start_line}`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#8AB4F8]/10 text-[#8AB4F8] border border-[#8AB4F8]/20 hover:bg-[#8AB4F8]/20 transition-colors"
                          >
                            <MaterialIcon name="code" size={12} className="shrink-0" aria-hidden="true" />
                            <span className="truncate max-w-[180px]">{cite.file_path}:{cite.start_line}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Flow Visualizer Canvas */}
          <div className="lg:col-span-7">
            <ComponentMapView
              payload={payload}
              repoId={repoId}
              highlightedComponentIds={highlightedComponentIds}
              highlightedEdgeKeys={highlightedEdgeKeys}
            />
          </div>
        </div>
      )}
    </div>
  );
}

