export interface CodeNode {
  id: string;
  projectId: string;
  filePath: string;
  functionName: string;
  type: 'function' | 'class' | 'method' | 'module';
  signature?: string;
  hash?: string;
}

export interface CodeEdge {
  source: string; // node id
  target: string; // node id
  type: 'calls' | 'imports' | 'extends' | 'implements' | 'depends_on';
  weight: number;
}

export interface DriftResult {
  baseNodeId: string;
  variantNodeId: string;
  basePath: string;
  variantPath: string;
  functionName: string;
  driftScore: number; // 0 = identical, 1 = completely different
  reason: string;
}

export interface UnsyncedChange {
  baseNodeId: string;
  basePath: string;
  functionName: string;
  variantId: string;
  variantPath?: string;
  reason: 'missing_in_variant' | 'outdated' | 'diverged';
  severity: 'low' | 'medium' | 'high';
}
