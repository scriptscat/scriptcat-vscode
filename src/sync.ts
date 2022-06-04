import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import { WebSocket, WebSocketServer } from 'ws';

export class Synchronizer {

	protected wss: WebSocketServer;
	protected watcher: vscode.FileSystemWatcher

	constructor(serverPort: number, watcher: vscode.FileSystemWatcher) {
		this.watcher = watcher
		this.updateFileWatcher()

		// 建立ws服务
		this.wss = new WebSocketServer({
			port: serverPort,
		});

		this.wss.on('connection', ws => {
			ws.send('{"action":"hello"}');
		});

		this.wss.on('error', (error) => {
			vscode.window.showWarningMessage("ScriptCat start failed:" + error.message);
		});

		setInterval(() => {
			this.wss.clients.forEach(val => {
				val.ping();
			});
		}, 6e4);
	}

	protected onChange(e: vscode.Uri) {
		if (e.scheme !== 'file') {
			return;
		}
		let code = readFileSync(e.fsPath).toString();
		this.wss.clients.forEach((val, key) => {
			val.send(JSON.stringify({ "action": "onchange", "data": { "script": code, "uri": e.toString() } }));
		});
	}

	private updateFileWatcher() {
		this.watcher.onDidChange((ev) => {
			vscode.window.showInformationMessage(ev.path+'更改已同步')
			this.onChange(ev);
		});
		this.watcher.onDidCreate((ev) => { this.onChange(ev); });
	}
	public changeTargetScript(newWatcher: vscode.FileSystemWatcher) {
		this.watcher.dispose()
		this.watcher = newWatcher
		this.updateFileWatcher()
	}
}
