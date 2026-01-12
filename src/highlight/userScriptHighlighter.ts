import * as vscode from "vscode";

// Token 类型定义
enum TokenTypes {
  metadata = "metadata", // UserScript 元数据块整体
  metaKey = "metaKey", // @name, @namespace 等键名
  metaValue = "metaValue", // 键值
}

// Token 修饰符
enum TokenModifiers {
  default = "",
}

// 图例配置
const legend = new vscode.SemanticTokensLegend(
  [TokenTypes.metadata, TokenTypes.metaKey, TokenTypes.metaValue],
  [TokenModifiers.default]
);

/**
 * UserScript 语义高亮提供器
 * 用于高亮 UserScript 元数据头部
 */
class UserScriptHighlighter implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const text = document.getText();

    // 检查是否包含 UserScript 元数据块
    if (!text.includes("// ==UserScript==")) {
      return builder.build();
    }

    const lines = text.split(/\r?\n/);
    let inMetadata = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 检测 UserScript 元数据块开始
      if (trimmedLine === "// ==UserScript==") {
        inMetadata = true;
        // 高亮整行作为元数据标记
        const startPos = new vscode.Position(i, 0);
        const endPos = new vscode.Position(i, line.length);
        const range = new vscode.Range(startPos, endPos);
        builder.push(range, TokenTypes.metadata, [TokenModifiers.default]);
        continue;
      }

      // 检测元数据块结束
      if (trimmedLine === "// ==/UserScript==") {
        inMetadata = false;
        const startPos = new vscode.Position(i, 0);
        const endPos = new vscode.Position(i, line.length);
        const range = new vscode.Range(startPos, endPos);
        builder.push(range, TokenTypes.metadata, [TokenModifiers.default]);
        continue;
      }

      // 处理元数据块内的内容
      if (inMetadata) {
        // 匹配 @key value 格式，支持空值的情况
        const metaMatch = trimmedLine.match(/^\/\/\s+@([\w-]+)(?:\s+(.*?))?$/);
        if (metaMatch) {
          const key = metaMatch[1];
          const value = metaMatch[2] || "";

          // 计算在行中的位置
          const atSymbolIndex = line.indexOf("@");
          const keyStartIndex = atSymbolIndex + 1; // 跳过 @ 符号
          const keyEndIndex = keyStartIndex + key.length;

          // 高亮键名 (如 name, namespace)
          if (key.length > 0) {
            const keyRange = new vscode.Range(
              new vscode.Position(i, keyStartIndex),
              new vscode.Position(i, keyEndIndex)
            );
            builder.push(keyRange, TokenTypes.metaKey, [
              TokenModifiers.default,
            ]);
          }

          // 高亮键值（如果存在）
          if (value.length > 0) {
            const valueStartIndex = line.indexOf(value, keyEndIndex);
            if (valueStartIndex >= 0) {
              const valueEndIndex = valueStartIndex + value.length;
              const valueRange = new vscode.Range(
                new vscode.Position(i, valueStartIndex),
                new vscode.Position(i, valueEndIndex)
              );
              builder.push(valueRange, TokenTypes.metaValue, [
                TokenModifiers.default,
              ]);
            }
          }
        }
      }
    }

    return builder.build();
  }
}

/**
 * 注册 UserScript 语法高亮
 */
export function registerUserScriptHighlighter(): vscode.Disposable {
  const highlighter = new UserScriptHighlighter();
  return vscode.languages.registerDocumentSemanticTokensProvider(
    { language: "javascript", scheme: "file" },
    highlighter,
    legend
  );
}

/**
 * 获取语义图例配置
 * 用于在 package.json 中配置主题颜色
 */
export function getLegend() {
  return legend;
}
