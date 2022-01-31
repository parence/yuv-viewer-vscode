import * as vscode from "vscode";
import { getNonce } from "./util";
import { Disposable } from "./dispose";
import { read as readYuv } from 'yuvjs';

/**
 * Define the document (the data model) used for YUV files.
 */
class YuvDocument extends Disposable implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
  ): Promise<YuvDocument | PromiseLike<YuvDocument>> {
    return new YuvDocument(uri);
  }

  private readonly _uri: vscode.Uri;

  private constructor(uri: vscode.Uri) {
    super();
    this._uri = uri;
  }

  public get uri() {
    return this._uri;
  }

  public getFrame(idx: number, cfg: any) {
    return readYuv(this.uri.path, [cfg.height, cfg.width], { 
      idx: idx, format: cfg.format 
    });
  }

  private readonly _onDidDispose = this._register(
    new vscode.EventEmitter<void>()
  );
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
 * Provider for Yuv editors.
 */
export class YuvEditorProvider
  implements vscode.CustomReadonlyEditorProvider<YuvDocument>
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      YuvEditorProvider.viewType,
      new YuvEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private static readonly viewType = "yuv-viewer.view";

  /**
   * Tracks all known webviews
   */
  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext: {},
    _token: vscode.CancellationToken
  ): Promise<YuvDocument> {
    let state = this._context.workspaceState.get(uri.path);
    if (!state) {
      state = {active: true, cfg: { width: 1280, height: 720, format: '444' }};
    }
    (state as Record<string, any>).active = true;
    this._context.workspaceState.update(uri.path, state);
    const document: YuvDocument = await YuvDocument.create(uri);

    return document;
  }

  async resolveCustomEditor(
    document: YuvDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel, this._context);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage(async (e) => {
      switch (e.type) {
        case "load": {
          const cfg = (this._context.workspaceState.get(document.uri.path) as Record<string, any>).cfg;
          this.postMessage(webviewPanel, `load-${e.idx}`, {
            value: (await document.getFrame(e.idx, cfg)).asRGBA(),
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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "webview/dist", "webview.iife.js")
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "webview/dist", "style.css")
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				-->

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleMainUri}" rel="stylesheet" />

				<title>Yuv-viewer</title>
			</head>
			<body>
        <div id="app"></div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    type: string,
    body: any
  ): void {
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
  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      const state = context.workspaceState.get(uri.path) as Record<string, any>;
      context.workspaceState.update(uri.path, {...state, ...{active: false}});
      this._webviews.delete(entry);
    });
  }
}
