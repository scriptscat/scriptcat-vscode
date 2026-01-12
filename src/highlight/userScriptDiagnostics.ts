import * as vscode from "vscode";

/**
 * UserScript 元数据诊断提供器
 * 用于检测无效的元数据键名并提供修复建议
 */

// 标准 UserScript 元数据键名白名单
const VALID_META_KEYS = new Set([
  // 核心元数据
  "name",
  "namespace",
  "version",
  "description",
  "license",

  // 脚本关联
  "icon",
  "iconURL",
  "icon64",
  "icon64URL",
  "updateURL",
  "downloadURL",
  "supportURL",
  "homepageURL",
  "contributionURL",

  // 兼容性
  "include",
  "match",
  "exclude",
  "require",
  "require-css",
  "resource",
  "grant",
  "noframes",
  "connect",
  "run-at",
  "run-in",
  "inject-into",
  "unwrap",

  // 其他常见键名
  "author",
  "copyright",
  "compatible",
  "incompatible",
  "antifeature",
  "note",

  // ScriptCat 特有键名
  "early-start",
  "background",
  "crontab",
  "storageName",
]);

// 诊断键名
const DIAGNOSTIC_SOURCE = "UserScript";
const INVALID_META_KEY_CODE = "invalid.meta.key";

/**
 * 计算两个字符串的编辑距离（用于拼写建议）
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 查找最相似的键名（用于拼写建议）
 */
function findSimilarKeys(invalidKey: string): string[] {
  const suggestions: Array<{ key: string; distance: number }> = [];

  for (const validKey of VALID_META_KEYS) {
    const distance = levenshteinDistance(invalidKey.toLowerCase(), validKey.toLowerCase());
    // 只保留编辑距离较小的建议（最多 3 个字符差异）
    if (distance <= 3 && distance > 0) {
      suggestions.push({ key: validKey, distance });
    }
  }

  // 按编辑距离排序，返回最相似的前 3 个
  return suggestions
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map((s) => s.key);
}

/**
 * UserScript 诊断提供器
 */
class UserScriptDiagnosticsProvider implements vscode.CodeActionProvider {
  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== DIAGNOSTIC_SOURCE) {
        continue;
      }

      if (diagnostic.code === INVALID_META_KEY_CODE) {
        // 从诊断消息中提取建议的键名（去掉 @ 符号）
        const suggestedKeysMatch = diagnostic.message.match(/建议: (.+)/);
        if (suggestedKeysMatch) {
          // 提取键名并去掉 @ 符号
          const suggestedKeys = suggestedKeysMatch[1]
            .split(", ")
            .map((key) => key.replace(/^@/, ""));
          const line = document.lineAt(diagnostic.range.start.line);
          const trimmedLine = line.text.trim();
          const metaMatch = trimmedLine.match(/^\/\/\s+@(\w+)/);

          if (metaMatch) {
            const invalidKey = metaMatch[1];
            const atIndex = line.text.indexOf("@");
            const keyStart = atIndex + 1;
            const keyEnd = keyStart + invalidKey.length;
            const keyRange = new vscode.Range(
              new vscode.Position(diagnostic.range.start.line, keyStart),
              new vscode.Position(diagnostic.range.start.line, keyEnd)
            );

            // 为每个建议键名创建快速修复
            for (const suggestedKey of suggestedKeys) {
              const action = new vscode.CodeAction(
                `修正为 @${suggestedKey}`,
                vscode.CodeActionKind.QuickFix
              );
              action.diagnostics = [diagnostic];
              action.isPreferred = suggestedKeys[0] === suggestedKey;
              action.edit = new vscode.WorkspaceEdit();
              action.edit.replace(document.uri, keyRange, suggestedKey);
              actions.push(action);
            }
          }
        }
      }
    }

    return actions;
  }
}

/**
 * 诊断集合管理器
 */
class DiagnosticsManager {
  private collection = vscode.languages.createDiagnosticCollection("UserScript");

  /**
   * 更新文档的诊断信息
   */
  updateDiagnostics(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();

    // 检查是否包含 UserScript 元数据块
    if (!text.includes("// ==UserScript==")) {
      this.collection.set(document.uri, diagnostics);
      return;
    }

    const lines = text.split(/\r?\n/);
    let inMetadata = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检测 UserScript 元数据块开始
      if (trimmedLine === "// ==UserScript==") {
        inMetadata = true;
        continue;
      }

      // 检测元数据块结束
      if (trimmedLine === "// ==/UserScript==") {
        inMetadata = false;
        continue;
      }

      // 处理元数据块内的内容
      if (inMetadata) {
        const metaMatch = trimmedLine.match(/^\/\/\s+@(\w+)(?:\s+(.*?))?$/);
        if (metaMatch) {
          const key = metaMatch[1];

          // 检查键名是否有效
          if (!VALID_META_KEYS.has(key)) {
            const atIndex = line.indexOf("@");
            const keyStart = atIndex + 1;
            const keyEnd = keyStart + key.length;
            const range = new vscode.Range(
              new vscode.Position(i, keyStart),
              new vscode.Position(i, keyEnd)
            );

            // 查找相似键名作为建议
            const similarKeys = findSimilarKeys(key);

            let message = `无效的元数据键名: @${key}`;
            if (similarKeys.length > 0) {
              message += `\n建议: ${similarKeys.map((k) => `@${k}`).join(", ")}`;
            }

            const diagnostic = new vscode.Diagnostic(
              range,
              message,
              vscode.DiagnosticSeverity.Warning
            );
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = INVALID_META_KEY_CODE;
            diagnostics.push(diagnostic);
          }
        }
      }
    }

    this.collection.set(document.uri, diagnostics.length > 0 ? diagnostics : undefined);
  }

  /**
   * 清理诊断信息
   */
  dispose(): void {
    this.collection.dispose();
  }
}

const diagnosticsManager = new DiagnosticsManager();

/**
 * 监听文档变化并更新诊断
 */
function updateDiagnosticsOnDocumentChange(document: vscode.TextDocument): void {
  // 只处理 JavaScript 文件
  if (document.languageId !== "javascript") {
    return;
  }
  diagnosticsManager.updateDiagnostics(document);
}

/**
 * 注册 UserScript 诊断功能
 */
export function registerUserScriptDiagnostics(): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];

  // 注册代码动作提供器（快速修复）
  const codeActionProvider = new UserScriptDiagnosticsProvider();
  subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "javascript", scheme: "file" },
      codeActionProvider,
      {
        providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
      }
    )
  );

  // 监听文档打开事件
  subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      updateDiagnosticsOnDocumentChange(document);
    })
  );

  // 监听文档保存事件
  subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      updateDiagnosticsOnDocumentChange(document);
    })
  );

  // 监听文档内容变化
  subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      updateDiagnosticsOnDocumentChange(event.document);
    })
  );

  // 初始化时检查所有已打开的文档
  for (const document of vscode.workspace.textDocuments) {
    updateDiagnosticsOnDocumentChange(document);
  }

  // 添加诊断管理器的清理
  subscriptions.push({
    dispose: () => diagnosticsManager.dispose(),
  });

  return subscriptions;
}
