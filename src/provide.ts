import * as vscode from 'vscode';

const prompt: { [key: string]: any } = {
	'name': '脚本名称',
	'description': '脚本描述',
	'namespace': '脚本命名空间',
	'version': '脚本版本',
	'author': '脚本作者',
	'background': '后台脚本',
};

// meta悬停提示
export function metaProvideHover() {
	return vscode.languages.registerHoverProvider('javascript', {
		provideHover(document, position, token) {
			const line = document.lineAt(position.line);

			let flag = /^\/\/\s*@(\w+?)(\s+(.*?)|)$/.exec(line.text);
			if (flag) {
				return {
					contents: [prompt[flag[1]]]
				};
			}
			// 匹配==UserScript==
			if (/==UserScript==/.test(line.text)) {
				return {
					contents: ['一个用户脚本'],
				};
			}
		}
	});
}
