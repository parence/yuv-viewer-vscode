import * as vscode from 'vscode';
import { getNonce } from './util';
import { Disposable } from './dispose';

/**
 * Define the document (the data model) used for YUV files.
 */
class PawDrawDocument extends Disposable implements vscode.CustomDocument {

	static async create(
		uri: vscode.Uri
	): Promise<PawDrawDocument | PromiseLike<PawDrawDocument>> {
		return new PawDrawDocument(uri);
	}

	private readonly _uri: vscode.Uri;

	private constructor(
		uri: vscode.Uri
	) {
		super();
		this._uri = uri;
	}

	public get uri() { return this._uri; }

	public getFrame(idx: number) { 
		return new Uint8Array(1280 * 720).fill(0);
	}

	private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
	/**
	 * Fired when the document is disposed of.
	 */
	public readonly onDidDispose = this._onDidDispose.event;

	/**
	 * Called by VS Code when there are no more references to the document.
	 *
	 * This happens when all editors for it have been closed.
	 */
	dispose(): void {
		this._onDidDispose.fire();
		super.dispose();
	}
}

/**
 * Provider for paw draw editors.
 *
 * Paw draw editors are used for `.pawDraw` files, which are just `.png` files with a different file extension.
 *
 * This provider demonstrates:
 *
 * - How to implement a custom editor for binary files.
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Communication between VS Code and the custom editor.
 * - Using CustomDocuments to store information that is shared between multiple custom editors.
 * - Implementing save, undo, redo, and revert.
 * - Backing up a custom editor.
 */
export class PawDrawEditorProvider implements vscode.CustomReadonlyEditorProvider<PawDrawDocument> {

	// private static newPawDrawFileId = 1;

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		return vscode.window.registerCustomEditorProvider(
			PawDrawEditorProvider.viewType,
			new PawDrawEditorProvider(context),
			{
				// For this demo extension, we enable `retainContextWhenHidden` which keeps the
				// webview alive even when it is not visible. You should avoid using this setting
				// unless is absolutely required as it does have memory overhead.
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			});
	}

	private static readonly viewType = 'yuv-viewer.view';

	/**
	 * Tracks all known webviews
	 */
	private readonly webviews = new WebviewCollection();

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	//#region CustomEditorProvider

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: {},
		_token: vscode.CancellationToken
	): Promise<PawDrawDocument> {
		const document: PawDrawDocument = await PawDrawDocument.create(uri);//, openContext.backupId);

		return document;
	}

	async resolveCustomEditor(
		document: PawDrawDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Add the webview to our internal set of active webviews
		this.webviews.add(document.uri, webviewPanel);

		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		// Wait for the webview to be properly ready before we init
		webviewPanel.webview.onDidReceiveMessage(async e => {
			switch (e.type) {
				case 'ready':
				{
					this.postMessage(webviewPanel, 'init', {
						value: (await document.getFrame(50))
						// document.documentData,
						// editable,
					});
				}
				case 'update':
				{
					this.postMessage(webviewPanel, 'init', {
						value: (await document.getFrame(e.idx))
					});
					
				}
			}
		});
	}


	/**
	 * Get the static HTML used for in our editor's webviews.
	 */
	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'yuview.js'));

		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'vscode.css'));

		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'pawDraw.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<!--
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				-->

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<!--
				<link href="${styleResetUri}" rel="stylesheet" />
				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />
				-->

				<title>Paw Draw</title>
			</head>
			<body>
				<input 
					type='text' id='frameidx' value='0' 
					onclick='postMessage({type: "update"})'
				></input>
				<div class="drawing-canvas"></div>

				<div class="drawing-controls">
					<button data-color="black" class="black active" title="Black"></button>
					<button data-color="white" class="white" title="White"></button>
					<button data-color="red" class="red" title="Red"></button>
					<button data-color="green" class="green" title="Green"></button>
					<button data-color="blue" class="blue" title="Blue"></button>
				</div>

			</body>
			</html>`;
	}

	private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
		panel.webview.postMessage({ type, body });
	}
}

/**
 * Tracks all webviews.
 */
class WebviewCollection {

	private readonly _webviews = new Set<{
		readonly resource: string;
		readonly webviewPanel: vscode.WebviewPanel;
	}>();

	/**
	 * Get all known webviews for a given uri.
	 */
	public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
		const key = uri.toString();
		for (const entry of this._webviews) {
			if (entry.resource === key) {
				yield entry.webviewPanel;
			}
		}
	}

	/**
	 * Add a new webview to the collection.
	 */
	public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
		const entry = { resource: uri.toString(), webviewPanel };
		this._webviews.add(entry);

		webviewPanel.onDidDispose(() => {
			this._webviews.delete(entry);
		});
	}
}