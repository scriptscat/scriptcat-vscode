import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import { WebSocket, WebSocketServer } from 'ws';

export class Synchronizer {

	protected wss: WebSocketServer;

	constructor(serverPort: number, watcher: vscode.FileSystemWatcher) {
		watcher.onDidChange((ev) => { this.onChange(ev); });
		watcher.onDidCreate((ev) => { this.onChange(ev); });

		// 建立ws服务
		this.wss = new WebSocketServer({
			port: serverPort,
		});

		this.wss.on('connection', ws => {
			ws.send('{"action":"hello"}');
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

}
