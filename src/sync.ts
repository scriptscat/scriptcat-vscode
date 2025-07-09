import { readFileSync } from "fs";
import * as vscode from "vscode";
import GlobalWebSocketManager from "./globalWebSocketManager";

export class Synchronizer {
  protected watcher: vscode.FileSystemWatcher;
  protected context: vscode.ExtensionContext;
  private wsManager: GlobalWebSocketManager;
  private messageHandler: (message: any) => void;

  constructor(
    watcher: vscode.FileSystemWatcher,
    context: vscode.ExtensionContext
  ) {
    this.watcher = watcher;
    this.context = context;
    this.wsManager = GlobalWebSocketManager.getInstance();
    
    // 创建消息处理器
    this.messageHandler = (message: any) => {
      // 如果需要处理来自WebSocket的消息，可以在这里添加逻辑
    };
    
    this.updateFileWatcher();
    this.initializeWebSocket();
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      await this.wsManager.start();
      this.wsManager.addMessageHandler(this.messageHandler);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `无法启动WebSocket服务: ${error.message}`
      );
    }
  }

  // 文件变动后发送ws消息通知ScriptCat更新脚本
  protected onChange(e: vscode.Uri) {
    if (e.scheme !== "file") {
      return;
    }
    if (!this.wsManager.isRunning()) {
      return;
    }
    let code = readFileSync(e.fsPath).toString();
    this.wsManager.broadcast({
      action: "onchange",
      data: { script: code, uri: e.toString() },
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

  // 获取实际使用的端口号
  public getActualPort(): number {
    return this.wsManager.getPort();
  }

  // 关闭资源（移除消息处理器）
  public close(): void {
    this.wsManager.removeMessageHandler(this.messageHandler);
  }
}
