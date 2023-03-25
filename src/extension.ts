import * as vscode from "vscode";
import { metaProvideHover } from "./provide";
import { Synchronizer } from "./sync";
import { existsSync, fstat } from "fs";
import "fs";

export function activate(context: vscode.ExtensionContext) {
  let watcher = null;

  const signatureFileCommand = "scriptcat.target";
  const config = context.workspaceState.get<string>("target");

  // 如果事先在当前工作区指定过目标脚本，则不再扫描目录下是否存在符合约定的脚本
  if (config && existsSync(config)) {
    vscode.window.showInformationMessage(
      "工作区已选定脚本：" +
        config +
        "，如果需要更改，请使用命令" +
        signatureFileCommand +
        "重新选择"
    );
    watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(config, "*"),
      false,
      false,
      false
    );
  } else {
    context.subscriptions.push(metaProvideHover());
    watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.user.js",
      false,
      false,
      false
    );
  }

  const mSync = new Synchronizer(8642, watcher, context);

  context.subscriptions.push(
    vscode.commands.registerCommand(signatureFileCommand, () => {
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        title: "选择调试脚本",
        openLabel: "选择脚本",
        filters: {
          用户脚本: ["js"],
        },
      };
      vscode.window.showOpenDialog(options).then((filePath) => {
        if (filePath) {
          const scriptPath = filePath[0].fsPath;
          context.workspaceState.update("target", scriptPath);
          vscode.window.showInformationMessage("已选择脚本：" + scriptPath);
          mSync.changeTargetScript(
            vscode.workspace.createFileSystemWatcher(
              new vscode.RelativePattern(scriptPath, "*")
            )
          );
        }
      });
    }),
    vscode.languages.registerDocumentFormattingEditProvider(["javascript"], {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): vscode.TextEdit[] | undefined {
        const firstLine = document.lineAt(0);
        console.log(firstLine);
        if (firstLine.text !== "42") {
          return [vscode.TextEdit.insert(firstLine.range.start, "42\n")];
        }
      },
    })
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
