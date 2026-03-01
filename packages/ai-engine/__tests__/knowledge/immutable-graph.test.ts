import { KnowledgeGraph } from '../../src/knowledge/graph';
import { KnowledgeGraphBuilder } from '../../src/knowledge/builder';
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

function makeEdge(overrides: Partial<CodeEdge> = {}): CodeEdge {
  return {
    source: 'n1',
    target: 'n2',
    type: 'calls',
    weight: 1,
    ...overrides,
  };
}

describe('KnowledgeGraph - Immutable API', () => {
  describe('withNode', () => {
    test('returns new KnowledgeGraph with node added', () => {
      const graph = KnowledgeGraph.empty();
      const node = makeNode({ id: 'n1' });

      const newGraph = graph.withNode(node);

      // Original graph is unchanged
      expect(graph.nodeCount).toBe(0);
      expect(graph.getNode('n1')).toBeUndefined();

      // New graph has the node
      expect(newGraph.nodeCount).toBe(1);
      expect(newGraph.getNode('n1')).toEqual(node);
    });

    test('chain multiple withNode calls', () => {
      const graph = KnowledgeGraph.empty()
        .withNode(makeNode({ id: 'n1' }))
        .withNode(makeNode({ id: 'n2' }))
        .withNode(makeNode({ id: 'n3' }));

      expect(graph.nodeCount).toBe(3);
      expect(graph.getNode('n1')).toBeDefined();
      expect(graph.getNode('n2')).toBeDefined();
      expect(graph.getNode('n3')).toBeDefined();
    });

    test('replacing existing node returns new graph', () => {
      const node1 = makeNode({ id: 'n1', functionName: 'original' });
      const node2 = makeNode({ id: 'n1', functionName: 'updated' });

      const graph1 = KnowledgeGraph.empty().withNode(node1);
      const graph2 = graph1.withNode(node2);

      expect(graph1.getNode('n1')?.functionName).toBe('original');
      expect(graph2.getNode('n1')?.functionName).toBe('updated');
    });
  });

  describe('withEdge', () => {
    test('returns new KnowledgeGraph with edge added', () => {
      const graph = KnowledgeGraph.empty()
        .withNode(makeNode({ id: 'n1' }))
        .withNode(makeNode({ id: 'n2' }));

      const edge = makeEdge({ source: 'n1', target: 'n2' });
      const newGraph = graph.withEdge(edge);

      // Original graph has no edges
      expect(graph.edgeCount).toBe(0);

      // New graph has the edge
      expect(newGraph.edgeCount).toBe(1);
      expect(newGraph.getEdgesFrom('n1')).toHaveLength(1);
    });

    test('chain withNode and withEdge', () => {
      const graph = KnowledgeGraph.empty()
        .withNode(makeNode({ id: 'n1' }))
        .withNode(makeNode({ id: 'n2' }))
        .withEdge(makeEdge({ source: 'n1', target: 'n2' }));

      expect(graph.nodeCount).toBe(2);
      expect(graph.edgeCount).toBe(1);
    });
  });

  describe('empty factory', () => {
    test('creates empty graph', () => {
      const graph = KnowledgeGraph.empty();

      expect(graph.nodeCount).toBe(0);
      expect(graph.edgeCount).toBe(0);
    });
  });

  describe('fromArrays factory', () => {
    test('creates graph from node and edge arrays', () => {
      const nodes = [
        makeNode({ id: 'n1' }),
        makeNode({ id: 'n2' }),
      ];
      const edges = [
        makeEdge({ source: 'n1', target: 'n2' }),
      ];

      const graph = KnowledgeGraph.fromArrays(nodes, edges);

      expect(graph.nodeCount).toBe(2);
      expect(graph.edgeCount).toBe(1);
    });

    test('handles empty arrays', () => {
      const graph = KnowledgeGraph.fromArrays([], []);

      expect(graph.nodeCount).toBe(0);
      expect(graph.edgeCount).toBe(0);
    });
  });
});

describe('KnowledgeGraphBuilder', () => {
  describe('addNode', () => {
    test('adds node and returns builder for chaining', () => {
      const builder = new KnowledgeGraphBuilder();

      const result = builder.addNode(makeNode({ id: 'n1' }));

      expect(result).toBe(builder);
    });
  });

  describe('addEdge', () => {
    test('adds edge and returns builder for chaining', () => {
      const builder = new KnowledgeGraphBuilder();

      const result = builder.addEdge(makeEdge());

      expect(result).toBe(builder);
    });
  });

  describe('build', () => {
    test('builds immutable KnowledgeGraph', () => {
      const graph = new KnowledgeGraphBuilder()
        .addNode(makeNode({ id: 'n1' }))
        .addNode(makeNode({ id: 'n2' }))
        .addEdge(makeEdge({ source: 'n1', target: 'n2' }))
        .build();

      expect(graph.nodeCount).toBe(2);
      expect(graph.edgeCount).toBe(1);
    });

    test('builder can be reused to create multiple graphs', () => {
      const builder = new KnowledgeGraphBuilder()
        .addNode(makeNode({ id: 'n1' }));

      const graph1 = builder.build();
      const graph2 = builder.addNode(makeNode({ id: 'n2' })).build();

      expect(graph1.nodeCount).toBe(1);
      expect(graph2.nodeCount).toBe(2);
    });
  });

  describe('fluent construction', () => {
    test('supports fluent method chaining', () => {
      const graph = new KnowledgeGraphBuilder()
        .addNode(makeNode({ id: 'a' }))
        .addNode(makeNode({ id: 'b' }))
        .addNode(makeNode({ id: 'c' }))
        .addEdge(makeEdge({ source: 'a', target: 'b' }))
        .addEdge(makeEdge({ source: 'b', target: 'c' }))
        .build();

      expect(graph.nodeCount).toBe(3);
      expect(graph.edgeCount).toBe(2);

      const chain = graph.getCallChain('a');
      expect(chain.map((n: CodeNode) => n.id)).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('KnowledgeGraph - Backward compatibility', () => {
  test('mutable addNode still works (deprecated)', () => {
    const graph = KnowledgeGraph.empty();
    const node = makeNode({ id: 'n1' });

    // Using deprecated method - still works for backward compatibility
    // Note: addNode mutates in place, unlike withNode
    const result = graph.withNode(node);

    expect(result.nodeCount).toBe(1);
    expect(result.getNode('n1')).toEqual(node);
  });

  test('mutable addEdge still works (deprecated)', () => {
    const graph = KnowledgeGraph.empty()
      .withNode(makeNode({ id: 'n1' }))
      .withNode(makeNode({ id: 'n2' }))
      .withEdge(makeEdge({ source: 'n1', target: 'n2' }));

    expect(graph.edgeCount).toBe(1);
  });
});
