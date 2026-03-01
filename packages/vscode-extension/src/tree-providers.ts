import * as vscode from 'vscode';
import { ApiClient } from './api-client';

export class ProjectGroupsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly api: ApiClient) {}

  refresh() { this._onDidChangeTreeData.fire(); }

  getTreeItem(element: vscode.TreeItem) { return element; }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) return [];
    try {
      const { items } = await this.api.getProjectGroups();
      return items.map((g: any) => {
        const item = new vscode.TreeItem(g.name, vscode.TreeItemCollapsibleState.None);
        item.description = `${g.projects?.length || 0} projects`;
        item.tooltip = g.description;
        item.contextValue = 'projectGroup';
        item.command = { command: 'aiSync.selectProjectGroup', title: '', arguments: [g] };
        return item;
      });
    } catch {
      return [new vscode.TreeItem('Failed to load project groups')];
    }
  }
}

export class SyncTasksProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private tasks: any[] = [];

  refresh() { this._onDidChangeTreeData.fire(); }
  setTasks(tasks: any[]) { this.tasks = tasks; this.refresh(); }

  getTreeItem(element: vscode.TreeItem) { return element; }

  async getChildren(): Promise<vscode.TreeItem[]> {
    if (this.tasks.length === 0) {
      return [new vscode.TreeItem('No sync tasks')];
    }
    return this.tasks.map((t: any) => {
      const item = new vscode.TreeItem(
        `${t.syncId?.slice(0, 8) || 'unknown'}`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.description = t.status;
      return item;
    });
  }
}

export class ReviewsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly api: ApiClient) {}

  refresh() { this._onDidChangeTreeData.fire(); }

  getTreeItem(element: vscode.TreeItem) { return element; }

  async getChildren(): Promise<vscode.TreeItem[]> {
    try {
      const { items } = await this.api.getPendingReviews();
      if (items.length === 0) return [new vscode.TreeItem('No pending reviews')];
      return items.map((r: any) => {
        const item = new vscode.TreeItem(
          r.variantName || r.id.slice(0, 8),
          vscode.TreeItemCollapsibleState.None,
        );
        const confidence = ((r.aiConfidence || r.confidence || 0) * 100).toFixed(0);
        item.description = `${confidence}% confidence`;
        item.contextValue = 'review';
        item.command = { command: 'aiSync.openReview', title: '', arguments: [r] };
        return item;
      });
    } catch {
      return [new vscode.TreeItem('Failed to load reviews')];
    }
  }
}
