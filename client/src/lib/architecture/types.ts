/* Architecture V2 TypeScript domain types */

export interface SystemNode {
  id: string;
  name: string;
  kind: 'service' | 'container' | 'runtime' | 'external_deps' | 'config' | string;
  metadata: Record<string, unknown>;
  source_file: string;
  line_number: number;
}

export interface SystemEdge {
  source: string;
  target: string;
  label?: string | null;
}

export interface SystemMapOut {
  nodes: SystemNode[];
  edges: SystemEdge[];
}

export interface ComponentOut {
  id: string;
  name: string;
  path_prefix: string;
  file_count: number;
  language_mix: Record<string, number>;
  layer: number;
  summary?: string | null;
}

export interface EvidenceItem {
  source_path: string;
  target_path: string;
  line: number;
}

export interface GraphEdgeOut {
  source: string;
  target: string;
  weight: number;
  kind: string;
  cycle: boolean;
  evidence: EvidenceItem[];
}

export interface FlowCitation {
  file_path: string;
  start_line: number;
  end_line: number;
}

export interface FlowStep {
  component_id: string;
  caption?: string | null;
  citations: FlowCitation[];
}

export interface FlowEntry {
  kind: 'http_route' | 'cli' | 'event' | string;
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface DataFlowOut {
  id: string;
  title: string;
  entry: FlowEntry;
  steps: FlowStep[];
}

export interface CoverageUnanalyzedLanguage {
  language: string;
  files: number;
}

export interface CoverageOut {
  internal_imports_total: number;
  resolved: number;
  ratio: number;
  languages_analyzed: string[];
  languages_not_analyzed: CoverageUnanalyzedLanguage[];
}

export interface LimitsOut {
  truncated: boolean;
  max_components: number;
}

export interface ArchitectureOut {
  schema_version: number;
  status: 'ready' | 'partial' | 'failed';
  system: SystemMapOut;
  components: ComponentOut[];
  edges: GraphEdgeOut[];
  flows: DataFlowOut[];
  coverage: CoverageOut;
  limits: LimitsOut;
  error?: string | null;
}

export interface ComponentFileItem {
  path: string;
  language: string;
  size_bytes: number;
}

export interface ComponentFilesOut {
  component_id: string;
  total: number;
  page: number;
  limit: number;
  files: ComponentFileItem[];
}

export interface ArchitectureNodeData extends Record<string, unknown> {
  component: ComponentOut;
  isHighlighted?: boolean;
  isSelected?: boolean;
  onSelect?: (component: ComponentOut) => void;
}

export interface ArchitectureEdgeData extends Record<string, unknown> {
  edge: GraphEdgeOut;
  isHighlighted?: boolean;
}

