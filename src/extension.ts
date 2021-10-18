import * as vscode from 'vscode';
import { ProviderResult } from 'vscode';
import { ScriptCatDebugSession } from './mockDebug';
import { FileAccessor } from './mockRuntime';
import { metaProvideHover } from './provide';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(metaProvideHover());

	// 注册调试器
	const factory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('scriptcat', factory));
}

// this method is called when your extension is deactivated
export function deactivate() { }


class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new ScriptCatDebugSession());
	}
}
