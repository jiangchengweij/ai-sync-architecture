import { CodeNode, CodeEdge, DriftResult, UnsyncedChange } from './types';

/**
 * Internal state for KnowledgeGraph.
 * Stored as a single immutable object for efficient copying.
 */
interface GraphState {
  nodes: Map<string, CodeNode>;
  edges: CodeEdge[];
  adjacency: Map<string, Set<string>>;
}

/**
 * Knowledge graph for tracking code relationships.
 * Supports both mutable (deprecated) and immutable APIs.
 *
 * @example Immutable API (recommended)
 * ```ts
 * const graph = KnowledgeGraph.empty()
 *   .withNode(node1)
 *   .withNode(node2)
 *   .withEdge(edge);
 * ```
 *
 * @example Builder API (recommended for many operations)
 * ```ts
 * const graph = new KnowledgeGraphBuilder()
 *   .addNode(node1)
 *   .addNode(node2)
 *   .addEdge(edge)
 *   .build();
 * ```
 */
export class KnowledgeGraph {
  private readonly state: GraphState;
  private readonly mutable: boolean;

  /**
   * Creates a new KnowledgeGraph.
   * @param state - Internal state (used for cloning)
   * @param mutable - Whether to allow mutations (for backward compatibility)
   */
  constructor(state?: GraphState, mutable = true) {
    this.mutable = mutable;
    if (state) {
      this.state = state;
    } else {
      this.state = {
        nodes: new Map(),
        edges: [],
        adjacency: new Map(),
      };
    }
  }

  // --- Factory methods ---

  /**
   * Creates an empty immutable knowledge graph.
   */
  static empty(): KnowledgeGraph {
    return new KnowledgeGraph({
      nodes: new Map(),
      edges: [],
      adjacency: new Map(),
    }, false);
  }

  /**
   * Creates a knowledge graph from arrays of nodes and edges.
   */
  static fromArrays(
    nodes: CodeNode[],
    edges: CodeEdge[] = [],
  ): KnowledgeGraph {
    const nodeMap = new Map<string, CodeNode>();
    const adjacency = new Map<string, Set<string>>();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (!adjacency.has(node.id)) {
        adjacency.set(node.id, new Set());
      }
    }

    for (const edge of edges) {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set());
      }
      adjacency.get(edge.source)!.add(edge.target);
    }

    return new KnowledgeGraph({
      nodes: nodeMap,
      edges: [...edges],
      adjacency,
    }, false);
  }

  // --- Immutable node operations ---

  /**
   * Returns a new KnowledgeGraph with the node added.
   * Does not modify the original graph.
   */
  withNode(node: CodeNode): KnowledgeGraph {
    const newNodes = new Map(this.state.nodes);
    newNodes.set(node.id, node);

    const newAdjacency = new Map(this.state.adjacency);
    if (!newAdjacency.has(node.id)) {
      newAdjacency.set(node.id, new Set());
    }

    return new KnowledgeGraph({
      nodes: newNodes,
      edges: this.state.edges,
      adjacency: newAdjacency,
    }, false);
  }

  // --- Immutable edge operations ---

  /**
   * Returns a new KnowledgeGraph with the edge added.
   * Does not modify the original graph.
   */
  withEdge(edge: CodeEdge): KnowledgeGraph {
    const newEdges = [...this.state.edges, edge];

    const newAdjacency = new Map(this.state.adjacency);
    if (!newAdjacency.has(edge.source)) {
      newAdjacency.set(edge.source, new Set());
    }
    newAdjacency.get(edge.source)!.add(edge.target);

    return new KnowledgeGraph({
      nodes: this.state.nodes,
      edges: newEdges,
      adjacency: newAdjacency,
    }, false);
  }

  // --- Mutable operations (deprecated, for backward compatibility) ---

  /**
   * Adds a node to the graph (mutates in place).
   * @deprecated Use `withNode()` for immutable operations or `KnowledgeGraphBuilder`
   */
  addNode(node: CodeNode): void {
    this.state.nodes.set(node.id, node);
    this.ensureAdjacency(node.id);
  }

  /**
   * Adds an edge to the graph (mutates in place).
   * @deprecated Use `withEdge()` for immutable operations or `KnowledgeGraphBuilder`
   */
  addEdge(edge: CodeEdge): void {
    this.state.edges.push(edge);
    this.ensureAdjacency(edge.source);
    this.state.adjacency.get(edge.source)!.add(edge.target);
  }

  private ensureAdjacency(nodeId: string): void {
    if (!this.state.adjacency.has(nodeId)) {
      this.state.adjacency.set(nodeId, new Set());
    }
  }

  // --- Node queries ---

  getNode(id: string): CodeNode | undefined {
    return this.state.nodes.get(id);
  }

  getNodesByProject(projectId: string): CodeNode[] {
    return [...this.state.nodes.values()].filter((n) => n.projectId === projectId);
  }

  getNodesByFile(projectId: string, filePath: string): CodeNode[] {
    return [...this.state.nodes.values()].filter(
      (n) => n.projectId === projectId && n.filePath === filePath,
    );
  }

  // --- Edge queries ---

  getEdgesFrom(nodeId: string): CodeEdge[] {
    return this.state.edges.filter((e) => e.source === nodeId);
  }

  getEdgesTo(nodeId: string): CodeEdge[] {
    return this.state.edges.filter((e) => e.target === nodeId);
  }

  getDependencies(nodeId: string): CodeNode[] {
    const targetIds = this.state.adjacency.get(nodeId) || new Set();
    return [...targetIds].map((id) => this.state.nodes.get(id)).filter(Boolean) as CodeNode[];
  }

  getDependents(nodeId: string): CodeNode[] {
    return this.state.edges
      .filter((e) => e.target === nodeId)
      .map((e) => this.state.nodes.get(e.source))
      .filter(Boolean) as CodeNode[];
  }

  // --- Call chain analysis ---

  getCallChain(nodeId: string, maxDepth = 5): CodeNode[] {
    const visited = new Set<string>();
    const chain: CodeNode[] = [];

    const traverse = (id: string, depth: number) => {
      if (depth > maxDepth || visited.has(id)) return;
      visited.add(id);
      const node = this.state.nodes.get(id);
      if (node) chain.push(node);
      const targets = this.state.adjacency.get(id) || new Set();
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
        const target = this.state.nodes.get(edge.target);
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
      const baseNode = this.state.nodes.get(mapping.baseNodeId);
      const variantNode = this.state.nodes.get(mapping.variantNodeId);
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

  get nodeCount(): number {
    return this.state.nodes.size;
  }

  get edgeCount(): number {
    return this.state.edges.length;
  }
}
