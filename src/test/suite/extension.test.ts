import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { isValidMetaKey, parseMetaKeyFromLine } from '../../highlight/userScriptDiagnostics';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('应当允许 @homepage 元数据键名', () => {
		assert.strictEqual(isValidMetaKey('homepage'), true);
	});

	test('应当允许 Tampermonkey 文档中的元数据键名', () => {
		const supportedKeys = [
			'antifeature',
			'connect',
			'copyright',
			'defaulticon',
			'homepageURL',
			'run-in',
			'sandbox',
			'source',
			'tag',
			'webRequest',
			'website',
			'unwrap',
		];

		for (const key of supportedKeys) {
			assert.strictEqual(isValidMetaKey(key), true, key);
		}
	});

	test('应当允许 ScriptCat 自有元数据键名', () => {
		const supportedKeys = [
			'background',
			'crontab',
			'early-start',
			'inject-into',
			'require-css',
			'storageName',
		];

		for (const key of supportedKeys) {
			assert.strictEqual(isValidMetaKey(key), true, key);
		}
	});

	test('应当允许本地化元数据键名', () => {
		assert.strictEqual(isValidMetaKey('name:zh-CN'), true);
		assert.strictEqual(isValidMetaKey('description:ja'), true);
		assert.strictEqual(isValidMetaKey('antifeature:en'), true);
	});

	test('应当解析带连字符与冒号的完整元数据键名', () => {
		assert.strictEqual(parseMetaKeyFromLine('// @require-css  https://example.com/style.css'), 'require-css');
		assert.strictEqual(parseMetaKeyFromLine('// @early-start'), 'early-start');
		assert.strictEqual(parseMetaKeyFromLine('// @name:zh-CN  测试脚本'), 'name:zh-CN');
	});

	test('应当拒绝未知元数据键名', () => {
		assert.strictEqual(isValidMetaKey('domain'), false);
		assert.strictEqual(isValidMetaKey('exclude-match'), false);
		assert.strictEqual(isValidMetaKey('notAUserScriptKey'), false);
		assert.strictEqual(isValidMetaKey('oujs:author'), false);
		assert.strictEqual(isValidMetaKey('uso:script'), false);
		assert.strictEqual(isValidMetaKey('unknown:locale'), false);
	});
});
