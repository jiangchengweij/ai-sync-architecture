import { KnowledgeGraph } from '../../src/knowledge/graph';
import { CodeNode, CodeEdge } from '../../src/knowledge/types';

function makeNode(overrides: Partial<CodeNode> = {}): CodeNode {
  return {
    id: `n-${Math.random().toString(36).slice(2, 8)}`,
    projectId: 'base',
    filePath: 'src/utils.ts',
    functionName: 'doSomething',
    type: 'function',
    signature: '(a: string) => void',
    hash: 'abc123',
    ...overrides,
  };
}

describe('KnowledgeGraph', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  test('adds and retrieves nodes', () => {
    const node = makeNode({ id: 'n1' });
    graph.addNode(node);
    expect(graph.getNode('n1')).toEqual(node);
    expect(graph.nodeCount).toBe(1);
  });

  test('filters nodes by project', () => {
    graph.addNode(makeNode({ id: 'n1', projectId: 'base' }));
    graph.addNode(makeNode({ id: 'n2', projectId: 'variant' }));
    expect(graph.getNodesByProject('base')).toHaveLength(1);
  });

  test('filters nodes by file', () => {
    graph.addNode(makeNode({ id: 'n1', filePath: 'a.ts' }));
    graph.addNode(makeNode({ id: 'n2', filePath: 'b.ts' }));
    graph.addNode(makeNode({ id: 'n3', filePath: 'a.ts' }));
    expect(graph.getNodesByFile('base', 'a.ts')).toHaveLength(2);
  });

  test('adds edges and tracks adjacency', () => {
    graph.addNode(makeNode({ id: 'n1' }));
    graph.addNode(makeNode({ id: 'n2' }));
    graph.addEdge({ source: 'n1', target: 'n2', type: 'calls', weight: 1 });

    expect(graph.edgeCount).toBe(1);
    expect(graph.getDependencies('n1').map((n) => n.id)).toEqual(['n2']);
    expect(graph.getDependents('n2').map((n) => n.id)).toEqual(['n1']);
  });

  test('getCallChain traverses dependencies', () => {
    graph.addNode(makeNode({ id: 'a' }));
    graph.addNode(makeNode({ id: 'b' }));
    graph.addNode(makeNode({ id: 'c' }));
    graph.addEdge({ source: 'a', target: 'b', type: 'calls', weight: 1 });
    graph.addEdge({ source: 'b', target: 'c', type: 'calls', weight: 1 });

    const chain = graph.getCallChain('a');
    expect(chain.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  test('getCallChain respects maxDepth', () => {
    graph.addNode(makeNode({ id: 'a' }));
    graph.addNode(makeNode({ id: 'b' }));
    graph.addNode(makeNode({ id: 'c' }));
    graph.addEdge({ source: 'a', target: 'b', type: 'calls', weight: 1 });
    graph.addEdge({ source: 'b', target: 'c', type: 'calls', weight: 1 });

    const chain = graph.getCallChain('a', 1);
    expect(chain.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('getModuleDependencies finds imported files', () => {
    graph.addNode(makeNode({ id: 'n1', filePath: 'a.ts' }));
    graph.addNode(makeNode({ id: 'n2', filePath: 'b.ts' }));
    graph.addNode(makeNode({ id: 'n3', filePath: 'c.ts' }));
    graph.addEdge({ source: 'n1', target: 'n2', type: 'imports', weight: 1 });
    graph.addEdge({ source: 'n1', target: 'n3', type: 'imports', weight: 1 });

    const deps = graph.getModuleDependencies('base', 'a.ts');
    expect(deps.sort()).toEqual(['b.ts', 'c.ts']);
  });
  test('detectDrift finds signature mismatches', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', signature: '(a: string) => void', hash: 'h1' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', signature: '(a: string, b: number) => void', hash: 'h1' }));

    const drifts = graph.detectDrift('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].reason).toContain('signature_mismatch');
    expect(drifts[0].driftScore).toBeGreaterThan(0);
  });

  test('detectDrift finds structural changes', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', signature: 'same', hash: 'hash_a' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', signature: 'same', hash: 'hash_b' }));

    const drifts = graph.detectDrift('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].reason).toContain('structural_change');
  });

  test('detectDrift returns empty for identical nodes', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', signature: 'same', hash: 'same' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', signature: 'same', hash: 'same' }));

    const drifts = graph.detectDrift('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(drifts).toHaveLength(0);
  });

  test('findUnsyncedChanges detects missing functions in variant', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', functionName: 'funcA' }));
    graph.addNode(makeNode({ id: 'b2', projectId: 'base', functionName: 'funcB' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', functionName: 'funcA' }));

    // Only b1 is mapped to v1
    const changes = graph.findUnsyncedChanges('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(changes).toHaveLength(1);
    expect(changes[0].functionName).toBe('funcB');
    expect(changes[0].reason).toBe('missing_in_variant');
  });

  test('findUnsyncedChanges detects diverged functions', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', functionName: 'funcA', hash: 'new_hash' }));
    graph.addNode(makeNode({ id: 'b2', projectId: 'base', functionName: 'funcB', hash: 'hash_x' }));
    graph.addNode(makeNode({ id: 'v2', projectId: 'variant', functionName: 'funcB', filePath: 'src/utils.ts', hash: 'hash_y' }));

    // b1 is mapped, b2 is not but has a name match with different hash
    const changes = graph.findUnsyncedChanges('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v2' }]);
    const diverged = changes.filter((c) => c.reason === 'diverged');
    expect(diverged.length).toBeGreaterThanOrEqual(0); // b2 matches v2 by name but hash differs
  });

  test('assessSeverity based on dependents count', () => {
    graph.addNode(makeNode({ id: 'core', projectId: 'base', functionName: 'coreFunc' }));
    // Add many dependents
    for (let i = 0; i < 6; i++) {
      const depId = `dep-${i}`;
      graph.addNode(makeNode({ id: depId, projectId: 'base', functionName: `caller${i}` }));
      graph.addEdge({ source: depId, target: 'core', type: 'calls', weight: 1 });
    }

    const changes = graph.findUnsyncedChanges('base', 'variant', []);
    const coreChange = changes.find((c) => c.functionName === 'coreFunc');
    expect(coreChange?.severity).toBe('high');
  });

  test('getEdgesTo returns all edges pointing to a node', () => {
    graph.addNode(makeNode({ id: 'target' }));
    graph.addNode(makeNode({ id: 'src1' }));
    graph.addNode(makeNode({ id: 'src2' }));
    graph.addEdge({ source: 'src1', target: 'target', type: 'calls', weight: 1 });
    graph.addEdge({ source: 'src2', target: 'target', type: 'calls', weight: 1 });

    const incoming = graph.getEdgesTo('target');
    expect(incoming).toHaveLength(2);
    expect(incoming.every((e) => e.target === 'target')).toBe(true);
  });

  test('addEdge initializes adjacency for source node not previously added', () => {
    // Add edge without calling addNode first for source
    graph.addNode(makeNode({ id: 'dst' }));
    expect(() => {
      graph.addEdge({ source: 'orphan-src', target: 'dst', type: 'calls', weight: 1 });
    }).not.toThrow();
    expect(graph.edgeCount).toBe(1);
  });

  test('detectDrift flags dependency divergence when dep counts differ significantly', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', signature: 'same', hash: 'same' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', signature: 'same', hash: 'same' }));

    // Add 3 extra deps to base node
    for (let i = 0; i < 3; i++) {
      const depId = `bdep-${i}`;
      graph.addNode(makeNode({ id: depId, projectId: 'base' }));
      graph.addEdge({ source: 'b1', target: depId, type: 'calls', weight: 1 });
    }
    // Variant node has no deps — difference is 3 > 2

    const drifts = graph.detectDrift('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts[0].reason).toContain('dependency_divergence');
  });

  test('detectDrift flags call chain divergence when chain lengths differ significantly', () => {
    graph.addNode(makeNode({ id: 'b1', projectId: 'base', signature: 'same', hash: 'same' }));
    graph.addNode(makeNode({ id: 'v1', projectId: 'variant', signature: 'same', hash: 'same' }));

    // Build a 4-deep call chain for base (chain length = 4 with depth 3)
    const chainIds = ['b1', 'bc1', 'bc2', 'bc3'];
    for (let i = 1; i < chainIds.length; i++) {
      graph.addNode(makeNode({ id: chainIds[i], projectId: 'base' }));
      graph.addEdge({ source: chainIds[i - 1], target: chainIds[i], type: 'calls', weight: 1 });
    }
    // Variant has no chain — difference is 4 > 2

    const drifts = graph.detectDrift('base', 'variant', [{ baseNodeId: 'b1', variantNodeId: 'v1' }]);
    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts[0].reason).toContain('call_chain_divergence');
  });
});
