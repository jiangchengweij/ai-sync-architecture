import * as vscode from 'vscode';
import { ApiClient } from './api-client';
import { ProjectGroupsProvider, SyncTasksProvider, ReviewsProvider } from './tree-providers';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  const api = new ApiClient();

  // Tree view providers
  const projectGroupsProvider = new ProjectGroupsProvider(api);
  const syncTasksProvider = new SyncTasksProvider();
  const reviewsProvider = new ReviewsProvider(api);

  vscode.window.registerTreeDataProvider('aiSync.projectGroups', projectGroupsProvider);
  vscode.window.registerTreeDataProvider('aiSync.syncTasks', syncTasksProvider);
  vscode.window.registerTreeDataProvider('aiSync.reviews', reviewsProvider);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.text = '$(sync) AI Sync';
  statusBarItem.command = 'aiSync.showStatus';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiSync.syncCurrentFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file to sync');
        return;
      }

      const groups = await api.getProjectGroups();
      if (groups.items.length === 0) {
        vscode.window.showWarningMessage('No project groups configured');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        groups.items.map((g: any) => ({ label: g.name, id: g.id })),
        { placeHolder: 'Select project group' },
      );
      if (!selected) return;

      const commitHash = await vscode.window.showInputBox({
        prompt: 'Enter commit hash to sync',
        placeHolder: 'e.g. abc1234',
      });
      if (!commitHash) return;

      try {
        statusBarItem.text = '$(sync~spin) Analyzing...';
        const result = await api.analyzeSync((selected as any).id, commitHash);
        statusBarItem.text = '$(check) AI Sync';
        vscode.window.showInformationMessage(
          `Sync analysis started: ${result.variants?.length || 0} variants`,
        );
        syncTasksProvider.setTasks([result]);
      } catch (e: any) {
        statusBarItem.text = '$(error) AI Sync';
        vscode.window.showErrorMessage(`Sync failed: ${e.message}`);
      }
    }),
    vscode.commands.registerCommand('aiSync.analyzeProject', async () => {
      const groups = await api.getProjectGroups();
      const selected = await vscode.window.showQuickPick(
        groups.items.map((g: any) => ({ label: g.name, id: g.id })),
        { placeHolder: 'Select project group to analyze' },
      );
      if (!selected) return;

      const commitHash = await vscode.window.showInputBox({
        prompt: 'Enter commit hash',
        placeHolder: 'HEAD or specific hash',
      });
      if (!commitHash) return;

      try {
        statusBarItem.text = '$(sync~spin) Analyzing...';
        const result = await api.analyzeSync((selected as any).id, commitHash);
        statusBarItem.text = '$(check) AI Sync';
        syncTasksProvider.setTasks([result]);
        vscode.window.showInformationMessage(`Analysis complete: ${result.syncId?.slice(0, 8)}`);
      } catch (e: any) {
        statusBarItem.text = '$(error) AI Sync';
        vscode.window.showErrorMessage(`Analysis failed: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand('aiSync.showStatus', async () => {
      const reviews = await api.getPendingReviews().catch(() => ({ items: [] }));
      vscode.window.showInformationMessage(
        `AI Sync: ${reviews.items.length} pending reviews`,
      );
      reviewsProvider.refresh();
    }),

    vscode.commands.registerCommand('aiSync.openDashboard', () => {
      const config = vscode.workspace.getConfiguration('aiSync');
      const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
      vscode.env.openExternal(vscode.Uri.parse(serverUrl));
    }),

    vscode.commands.registerCommand('aiSync.selectProjectGroup', (group: any) => {
      vscode.window.showInformationMessage(`Selected: ${group.name}`);
    }),

    vscode.commands.registerCommand('aiSync.openReview', async (review: any) => {
      const action = await vscode.window.showQuickPick(
        [
          { label: 'Approve', action: 'approve' },
          { label: 'Reject', action: 'reject' },
          { label: 'View in Dashboard', action: 'dashboard' },
        ],
        { placeHolder: `Review: ${review.variantName || review.id}` },
      );
      if (!action) return;

      if (action.action === 'approve') {
        await api.approveReview(review.id);
        vscode.window.showInformationMessage('Review approved');
        reviewsProvider.refresh();
      } else if (action.action === 'reject') {
        const reason = await vscode.window.showInputBox({ prompt: 'Rejection reason' });
        if (reason) {
          await api.rejectReview(review.id, reason);
          vscode.window.showInformationMessage('Review rejected');
          reviewsProvider.refresh();
        }
      } else {
        const config = vscode.workspace.getConfiguration('aiSync');
        const url = `${config.get('serverUrl')}/reviews/${review.id}`;
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
    }),
  );
}

export function deactivate() {
  statusBarItem?.dispose();
}
