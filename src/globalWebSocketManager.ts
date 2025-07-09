import * as vscode from "vscode";
import { WebSocketServer } from "ws";
import * as net from "net";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * 全局WebSocket管理器
 * 使用文件锁确保跨VS Code窗口只有一个WebSocket服务器
 */
class GlobalWebSocketManager {
  private static instance: GlobalWebSocketManager;
  private wss?: WebSocketServer;
  private port: number = 8642;
  private isStarted: boolean = false;
  private clients: Set<(message: any) => void> = new Set();
  private lockFilePath: string;
  private portFilePath: string;
  private sharedDir: string;
  private fileWatcher?: vscode.FileSystemWatcher;

  private constructor() {
    // 使用系统临时目录存储锁文件
    const tempDir = os.tmpdir();
    this.lockFilePath = path.join(tempDir, 'scriptcat-vscode-websocket.lock');
    this.portFilePath = path.join(tempDir, 'scriptcat-vscode-websocket.port');
    this.sharedDir = path.join(tempDir, 'scriptcat-vscode');
    
    // 确保共享目录存在
    if (!fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true });
    }
  }

  public static getInstance(): GlobalWebSocketManager {
    if (!GlobalWebSocketManager.instance) {
      GlobalWebSocketManager.instance = new GlobalWebSocketManager();
    }
    return GlobalWebSocketManager.instance;
  }

  /**
   * 检查是否已有其他窗口启动了WebSocket服务器
   */
  private async checkExistingServer(): Promise<number | null> {
    try {
      // 检查端口文件是否存在
      if (fs.existsSync(this.portFilePath)) {
        const portStr = fs.readFileSync(this.portFilePath, 'utf8').trim();
        const port = parseInt(portStr);
        
        if (!isNaN(port)) {
          // 尝试连接到这个端口，检查是否真的有服务在运行
          const isPortInUse = await this.isPortInUse(port);
          if (isPortInUse) {
            return port;
          } else {
            // 端口文件存在但端口未被使用，清理文件
            fs.unlinkSync(this.portFilePath);
          }
        }
      }
    } catch (error) {
      // 忽略错误，继续尝试启动新服务器
    }
    return null;
  }

  /**
   * 检查端口是否被使用
   */
  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      server.once('listening', () => {
        server.close();
        resolve(false);
      });

      server.listen(port);
    });
  }

  /**
   * 启动WebSocket服务器
   */
  public async start(): Promise<number> {
    // 首先检查是否已有其他窗口启动了服务器
    const existingPort = await this.checkExistingServer();
    if (existingPort) {
      vscode.window.showInformationMessage(
        `ScriptCat WebSocket服务已在其他窗口启动，端口: ${existingPort}`
      );
      return existingPort;
    }

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
          // 写入端口文件，标记服务器已启动
          try {
            fs.writeFileSync(this.portFilePath, this.port.toString());
          } catch (err) {
            console.warn('无法写入端口文件:', err);
          }
          
          // 启动文件监听，处理其他窗口发送的消息
          this.setupFileWatcher();
          
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
   */
  public stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
      this.isStarted = false;
      this.clients.clear();
      
      // 关闭文件监听
      if (this.fileWatcher) {
        this.fileWatcher.dispose();
        this.fileWatcher = undefined;
      }
      
      // 清理端口文件
      try {
        if (fs.existsSync(this.portFilePath)) {
          fs.unlinkSync(this.portFilePath);
        }
      } catch (err) {
        console.warn('无法删除端口文件:', err);
      }
    }
  }

  /**
   * 设置文件监听，处理其他窗口发送的消息
   */
  private setupFileWatcher(): void {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      path.join(this.sharedDir, 'message-*.json')
    );

    this.fileWatcher.onDidCreate((uri) => {
      try {
        // 读取消息文件
        const messageContent = fs.readFileSync(uri.fsPath, 'utf8');
        const message = JSON.parse(messageContent);
        
        // 广播消息到WebSocket客户端
        this.broadcast(message);
        
        // 删除已处理的消息文件
        fs.unlinkSync(uri.fsPath);
      } catch (error) {
        console.warn('处理消息文件时出错:', error);
      }
    });
  }
}

export default GlobalWebSocketManager;
