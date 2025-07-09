import * as vscode from "vscode";
import { WebSocketServer } from "ws";

/**
 * 全局WebSocket管理器
 * 确保整个VS Code实例中只有一个WebSocket服务器
 */
class GlobalWebSocketManager {
  private static instance: GlobalWebSocketManager;
  private wss?: WebSocketServer;
  private port: number = 8642;
  private isStarted: boolean = false;
  private clients: Set<(message: any) => void> = new Set();

  private constructor() {}

  public static getInstance(): GlobalWebSocketManager {
    if (!GlobalWebSocketManager.instance) {
      GlobalWebSocketManager.instance = new GlobalWebSocketManager();
    }
    return GlobalWebSocketManager.instance;
  }

  /**
   * 启动WebSocket服务器（如果尚未启动）
   */
  public async start(): Promise<number> {
    if (this.isStarted && this.wss) {
      return this.port;
    }

    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.port,
        });

        this.wss.on("connection", (ws, req) => {
          ws.send('{"action":"hello"}');
          vscode.window.showInformationMessage(
            `${req.socket.remoteAddress}已连接 (端口: ${this.port})`
          );
          
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
          reject(error);
        });

        this.wss.on("listening", () => {
          this.isStarted = true;
          vscode.window.showInformationMessage(
            `ScriptCat WebSocket服务已启动，端口: ${this.port}`
          );
          resolve(this.port);
        });

        // 心跳检测
        setInterval(() => {
          if (this.wss) {
            this.wss.clients.forEach((val) => {
              val.ping();
            });
          }
        }, 60000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 广播消息给所有WebSocket客户端
   */
  public broadcast(message: any): void {
    if (!this.wss) {
      return;
    }

    const messageStr = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * 注册消息处理器
   */
  public addMessageHandler(handler: (message: any) => void): void {
    this.clients.add(handler);
  }

  /**
   * 移除消息处理器
   */
  public removeMessageHandler(handler: (message: any) => void): void {
    this.clients.delete(handler);
  }

  /**
   * 获取当前端口
   */
  public getPort(): number {
    return this.port;
  }

  /**
   * 获取服务器状态
   */
  public isRunning(): boolean {
    return this.isStarted && !!this.wss;
  }

  /**
   * 关闭WebSocket服务器
   * 注意：这会影响所有使用该服务器的窗口
   */
  public stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
      this.isStarted = false;
      this.clients.clear();
    }
  }
}

export default GlobalWebSocketManager;
