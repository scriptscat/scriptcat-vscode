import * as vscode from "vscode";

const SEMANTIC_HIGHLIGHTING_CONFIG_KEY = "editor.semanticHighlighting.enabled";
const PROMPT_CONFIG_KEY = "scriptcat.promptSemanticHighlighting";

/**
 * 检查语义高亮是否启用，如果未启用则提示用户
 */
export async function checkAndPromptSemanticHighlighting(): Promise<void> {
  const config = vscode.workspace.getConfiguration();
  const semanticHighlighting = config.get(SEMANTIC_HIGHLIGHTING_CONFIG_KEY);
  const shouldPrompt = config.get<boolean>(PROMPT_CONFIG_KEY, true);

  // 如果用户在设置中禁用了提示，则直接返回
  if (!shouldPrompt) {
    return;
  }

  // 如果已经启用，则直接返回
  if (semanticHighlighting === true) {
    return;
  }

  // 提示用户启用语义高亮
  const action = await vscode.window.showInformationMessage(
    "ScriptCat 建议启用语义高亮以获得更好的 UserScript 元数据高亮体验",
    "立即启用",
    "不再提示"
  );

  if (action === "立即启用") {
    await config.update(SEMANTIC_HIGHLIGHTING_CONFIG_KEY, true, true);
    vscode.window.showInformationMessage("语义高亮已启用！");
  } else if (action === "不再提示") {
    await config.update(PROMPT_CONFIG_KEY, false, true);
    vscode.window.showInformationMessage(
      "您可以随时在设置中搜索 Semantic Highlighting 为 true 来开启语义高亮功能。"
    );
  }
}
