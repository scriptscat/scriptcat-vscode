import { watchFile } from 'fs';
import * as vscode from 'vscode';
import { metaProvideHover } from './provide';
import { Synchronizer } from './sync';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(metaProvideHover());

	const watcher = vscode.workspace.createFileSystemWatcher("**/*.user.js", false, false, false);

	new Synchronizer(8642, watcher);
}

// this method is called when your extension is deactivated
export function deactivate() { }
