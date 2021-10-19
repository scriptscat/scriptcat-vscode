import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import { WebSocket, WebSocketServer } from 'ws';

export class Synchronizer {

	protected wss: WebSocketServer;
	protected clients = new Map<string, WebSocket>();

	constructor(serverPort: number, watcher: vscode.FileSystemWatcher) {
		watcher.onDidChange((ev) => { this.onChange(ev); });
		watcher.onDidCreate((ev) => { this.onChange(ev); });

		// 建立ws服务
		this.wss = new WebSocketServer({
			port: serverPort,
		}, () => {
			console.log(this.wss);
		});

		this.wss.on('connection', ws => {
			ws.send('hello');
		});
	}

	protected onChange(e: vscode.Uri) {
		if (e.scheme !== 'file') {
			return;
		}
		let code = readFileSync(e.fsPath).toString();
		this.wss.clients.forEach((val, key) => {
			val.send(JSON.stringify({ "action": "onchange", "data": { "script": code } }));
		});
	}

}
