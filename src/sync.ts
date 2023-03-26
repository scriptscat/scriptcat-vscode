import { readFileSync } from "fs";
import * as vscode from "vscode";
import { WebSocketServer } from "ws";

export class Synchronizer {
  protected wss: WebSocketServer;
  protected watcher: vscode.FileSystemWatcher;
  protected context: vscode.ExtensionContext;

  constructor(
    serverPort: number,
    watcher: vscode.FileSystemWatcher,
    context: vscode.ExtensionContext
  ) {
    this.watcher = watcher;
    this.context = context;
    this.updateFileWatcher();

    // 建立ws服务
    this.wss = new WebSocketServer({
      port: serverPort,
    });

    // 建立连接
    this.wss.on("connection", (ws, req) => {
      ws.send('{"action":"hello"}');
      vscode.window.showInformationMessage(req.socket.remoteAddress + "已连接");
      ws.on("close", () => {
        vscode.window.showInformationMessage(
          req.socket.remoteAddress + "已断开"
        );
      });
    });

    this.wss.on("error", (error) => {
      vscode.window.showWarningMessage(
        "ScriptCat start failed:" + error.message
      );
    });

    setInterval(() => {
      this.wss.clients.forEach((val) => {
        val.ping();
      });
    }, 6e4);
  }

  // 文件变动后发送ws消息通知ScriptCat更新脚本
  protected onChange(e: vscode.Uri) {
    if (e.scheme !== "file") {
      return;
    }
    let code = readFileSync(e.fsPath).toString();
    this.wss.clients.forEach((val, key) => {
      val.send(
        JSON.stringify({
          action: "onchange",
          data: { script: code, uri: e.toString() },
        })
      );
    });
  }

  // 监听文件变动
  private updateFileWatcher() {
    this.watcher.onDidChange((ev) => {
      this.onChange(ev);
      if (this.context.workspaceState.get("ignore_msg_" + ev.path)) {
        return;
      }
      vscode.window
        .showInformationMessage(ev.path + "更改已同步", "不再提示该文件")
        .then((result) => {
          if (result === "不再提示该文件") {
            this.context.workspaceState.update("ignore_msg_" + ev.path, true);
          }
        });
    });
    this.watcher.onDidCreate((ev) => {
      this.onChange(ev);
    });
  }

  public changeTargetScript(newWatcher: vscode.FileSystemWatcher) {
    this.watcher.dispose();
    this.watcher = newWatcher;
    this.updateFileWatcher();
  }
}
