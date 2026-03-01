import { CodeNode, CodeEdge } from './types';
import { KnowledgeGraph } from './graph';

/**
 * Fluent builder for constructing KnowledgeGraph instances.
 * Allows incremental construction with method chaining.
 */
export class KnowledgeGraphBuilder {
  private nodes: CodeNode[] = [];
  private edges: CodeEdge[] = [];

  /**
   * Adds a node to the builder.
   * @returns this builder for method chaining
   */
  addNode(node: CodeNode): this {
    this.nodes.push(node);
    return this;
  }

  /**
   * Adds multiple nodes to the builder.
   * @returns this builder for method chaining
   */
  addNodes(nodes: CodeNode[]): this {
    this.nodes.push(...nodes);
    return this;
  }

  /**
   * Adds an edge to the builder.
   * @returns this builder for method chaining
   */
  addEdge(edge: CodeEdge): this {
    this.edges.push(edge);
    return this;
  }

  /**
   * Adds multiple edges to the builder.
   * @returns this builder for method chaining
   */
  addEdges(edges: CodeEdge[]): this {
    this.edges.push(...edges);
    return this;
  }

  /**
   * Builds and returns an immutable KnowledgeGraph.
   * The builder can be reused after calling build().
   */
  build(): KnowledgeGraph {
    return KnowledgeGraph.fromArrays(this.nodes, this.edges);
  }

  /**
   * Resets the builder to empty state.
   * @returns this builder for method chaining
   */
  reset(): this {
    this.nodes = [];
    this.edges = [];
    return this;
  }
}
