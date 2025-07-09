import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import * as vscode from "vscode";
import GlobalWebSocketManager from "./globalWebSocketManager";
import * as path from "path";
import * as os from "os";

export class Synchronizer {
  protected watcher: vscode.FileSystemWatcher;
  protected context: vscode.ExtensionContext;
  private wsManager: GlobalWebSocketManager;
  private messageHandler: (message: any) => void;
  private isWebSocketOwner: boolean = false;
  private sharedDir: string;

  constructor(
    watcher: vscode.FileSystemWatcher,
    context: vscode.ExtensionContext
  ) {
    this.watcher = watcher;
    this.context = context;
    this.wsManager = GlobalWebSocketManager.getInstance();
    
    // 创建共享目录用于窗口间通信
    this.sharedDir = path.join(os.tmpdir(), 'scriptcat-vscode');
    if (!existsSync(this.sharedDir)) {
      mkdirSync(this.sharedDir, { recursive: true });
    }
    
    // 创建消息处理器
    this.messageHandler = (message: any) => {
      // 如果需要处理来自WebSocket的消息，可以在这里添加逻辑
    };
    
    this.updateFileWatcher();
    this.initializeWebSocket();
  }

  private async initializeWebSocket(): Promise<void> {
    try {
      const port = await this.wsManager.start();
      // 如果返回的端口等于8642，说明当前窗口成功启动了WebSocket服务器
      this.isWebSocketOwner = (port === 8642 && this.wsManager.isRunning());
      this.wsManager.addMessageHandler(this.messageHandler);
    } catch (error: any) {
      if (error.message.includes('EADDRINUSE')) {
        // 端口被占用，说明其他窗口已经启动了WebSocket服务器
        this.isWebSocketOwner = false;
        vscode.window.showInformationMessage(
          `ScriptCat WebSocket服务已在其他窗口运行，当前窗口将使用文件通信模式`
        );
      } else {
        vscode.window.showErrorMessage(
          `无法启动WebSocket服务: ${error.message}`
        );
      }
    }
  }

  // 文件变动后发送ws消息通知ScriptCat更新脚本
  protected onChange(e: vscode.Uri) {
    if (e.scheme !== "file") {
      return;
    }

    let code = readFileSync(e.fsPath).toString();
    const message = {
      action: "onchange",
      data: { script: code, uri: e.toString() },
    };

    if (this.isWebSocketOwner && this.wsManager.isRunning()) {
      // 当前窗口拥有WebSocket服务器，直接广播
      this.wsManager.broadcast(message);
    } else {
      // 其他窗口拥有WebSocket服务器，通过文件通信
      this.sendMessageViaFile(message);
    }
  }

  // 通过文件方式向WebSocket服务器发送消息
  private sendMessageViaFile(message: any): void {
    try {
      const messageFile = path.join(this.sharedDir, `message-${Date.now()}-${Math.random()}.json`);
      writeFileSync(messageFile, JSON.stringify(message));
      
      // 设置定时器删除文件，避免积累太多文件
      setTimeout(() => {
        try {
          if (existsSync(messageFile)) {
            require('fs').unlinkSync(messageFile);
          }
        } catch (err) {
          // 忽略删除错误
        }
      }, 5000);
    } catch (error) {
      console.warn('无法通过文件发送消息:', error);
    }
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
