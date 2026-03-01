import { CodeNode, CodeEdge, DriftResult, UnsyncedChange } from './types';

export class KnowledgeGraph {
  private nodes = new Map<string, CodeNode>();
  private edges: CodeEdge[] = [];
  private adjacency = new Map<string, Set<string>>(); // node id -> set of target ids

  // --- Node operations ---

  addNode(node: CodeNode): void {
    this.nodes.set(node.id, node);
    this.ensureAdjacency(node.id);
  }

  getNode(id: string): CodeNode | undefined {
    return this.nodes.get(id);
  }

  getNodesByProject(projectId: string): CodeNode[] {
    return [...this.nodes.values()].filter((n) => n.projectId === projectId);
  }

  getNodesByFile(projectId: string, filePath: string): CodeNode[] {
    return [...this.nodes.values()].filter(
      (n) => n.projectId === projectId && n.filePath === filePath,
    );
  }

  // --- Edge operations ---

  addEdge(edge: CodeEdge): void {
    this.edges.push(edge);
    this.ensureAdjacency(edge.source);
    this.adjacency.get(edge.source)!.add(edge.target);
  }

  getEdgesFrom(nodeId: string): CodeEdge[] {
    return this.edges.filter((e) => e.source === nodeId);
  }

  getEdgesTo(nodeId: string): CodeEdge[] {
    return this.edges.filter((e) => e.target === nodeId);
  }

  getDependencies(nodeId: string): CodeNode[] {
    const targetIds = this.adjacency.get(nodeId) || new Set();
    return [...targetIds].map((id) => this.nodes.get(id)).filter(Boolean) as CodeNode[];
  }

  getDependents(nodeId: string): CodeNode[] {
    return this.edges
      .filter((e) => e.target === nodeId)
      .map((e) => this.nodes.get(e.source))
      .filter(Boolean) as CodeNode[];
  }
  // --- Call chain analysis ---

  getCallChain(nodeId: string, maxDepth = 5): CodeNode[] {
    const visited = new Set<string>();
    const chain: CodeNode[] = [];

    const traverse = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node) chain.push(node);
      const targets = this.adjacency.get(id) || new Set();
      for (const targetId of targets) {
        traverse(targetId, depth + 1);
      }
    };

    traverse(nodeId, 0);
    return chain;
  }

  getModuleDependencies(projectId: string, filePath: string): string[] {
    const fileNodes = this.getNodesByFile(projectId, filePath);
    const importedFiles = new Set<string>();

    for (const node of fileNodes) {
      const edges = this.getEdgesFrom(node.id).filter((e) => e.type === 'imports');
      for (const edge of edges) {
        const target = this.nodes.get(edge.target);
        if (target && target.filePath !== filePath) {
          importedFiles.add(target.filePath);
        }
      }
    }

    return [...importedFiles];
  }

  // --- Drift detection ---

  detectDrift(
    baseProjectId: string,
    variantProjectId: string,
    mappings: Array<{ baseNodeId: string; variantNodeId: string }>,
  ): DriftResult[] {
    const results: DriftResult[] = [];

    for (const mapping of mappings) {
      const baseNode = this.nodes.get(mapping.baseNodeId);
      const variantNode = this.nodes.get(mapping.variantNodeId);
      if (!baseNode || !variantNode) continue;

      let driftScore = 0;
      const reasons: string[] = [];

      // Compare signatures
      if (baseNode.signature !== variantNode.signature) {
        driftScore += 0.4;
        reasons.push('signature_mismatch');
      }

      // Compare structural hash
      if (baseNode.hash && variantNode.hash && baseNode.hash !== variantNode.hash) {
        driftScore += 0.3;
        reasons.push('structural_change');
      }

      // Compare dependency count
      const baseDeps = this.getDependencies(baseNode.id).length;
      const variantDeps = this.getDependencies(variantNode.id).length;
      if (Math.abs(baseDeps - variantDeps) > 2) {
        driftScore += 0.2;
        reasons.push('dependency_divergence');
      }

      // Compare call chain depth
      const baseChain = this.getCallChain(baseNode.id, 3).length;
      const variantChain = this.getCallChain(variantNode.id, 3).length;
      if (Math.abs(baseChain - variantChain) > 2) {
        driftScore += 0.1;
        reasons.push('call_chain_divergence');
      }

      driftScore = Math.min(driftScore, 1);

      if (driftScore > 0) {
        results.push({
          baseNodeId: baseNode.id,
          variantNodeId: variantNode.id,
          basePath: baseNode.filePath,
          variantPath: variantNode.filePath,
          functionName: baseNode.functionName,
          driftScore,
          reason: reasons.join(', '),
        });
      }
    }

    return results.sort((a, b) => b.driftScore - a.driftScore);
  }

  // --- Unsynced change discovery ---

  findUnsyncedChanges(
    baseProjectId: string,
    variantProjectId: string,
    mappings: Array<{ baseNodeId: string; variantNodeId: string }>,
  ): UnsyncedChange[] {
    const changes: UnsyncedChange[] = [];
    const mappedBaseIds = new Set(mappings.map((m) => m.baseNodeId));

    const baseNodes = this.getNodesByProject(baseProjectId);
    const variantNodes = this.getNodesByProject(variantProjectId);
    const variantByName = new Map<string, CodeNode>();
    for (const vn of variantNodes) {
      variantByName.set(`${vn.filePath}:${vn.functionName}`, vn);
    }

    for (const baseNode of baseNodes) {
      if (mappedBaseIds.has(baseNode.id)) continue;

      // Check if there's a name match in variant
      const key = `${baseNode.filePath}:${baseNode.functionName}`;
      const variantMatch = variantByName.get(key);

      if (!variantMatch) {
        changes.push({
          baseNodeId: baseNode.id,
          basePath: baseNode.filePath,
          functionName: baseNode.functionName,
          variantId: variantProjectId,
          reason: 'missing_in_variant',
          severity: this.assessSeverity(baseNode),
        });
      } else if (baseNode.hash && variantMatch.hash && baseNode.hash !== variantMatch.hash) {
        changes.push({
          baseNodeId: baseNode.id,
          basePath: baseNode.filePath,
          functionName: baseNode.functionName,
          variantId: variantProjectId,
          variantPath: variantMatch.filePath,
          reason: 'diverged',
          severity: 'medium',
        });
      }
    }

    return changes;
  }

  private assessSeverity(node: CodeNode): 'low' | 'medium' | 'high' {
    const dependents = this.getDependents(node.id).length;
    if (dependents > 5) return 'high';
    if (dependents > 2) return 'medium';
    return 'low';
  }

  // --- Stats ---

  get nodeCount(): number { return this.nodes.size; }
  get edgeCount(): number { return this.edges.length; }

  private ensureAdjacency(nodeId: string): void {
    if (!this.adjacency.has(nodeId)) {
      this.adjacency.set(nodeId, new Set());
    }
  }
}
