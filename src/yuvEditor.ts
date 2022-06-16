import * as vscode from "vscode";
import { getNonce } from "./util";
import { Disposable } from "./dispose";
import { FrameCfg, Reader, YuvFormat } from 'yuvjs';
import { Worker } from 'worker_threads';
import { resolve as path_resolve } from 'path';

interface YuvState {
  active: boolean;
  visible: boolean;
  cfg: FrameCfg;
};

/**
 * Define the document (the data model) used for YUV files.
 */
class YuvDocument extends Disposable implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri, cfg: FrameCfg
  ): Promise<YuvDocument | PromiseLike<YuvDocument>> {
    return new YuvDocument(uri, cfg);
  }

  private readonly _uri: vscode.Uri;
  private readonly _reader: Reader;

  private constructor(uri: vscode.Uri, cfg: FrameCfg) {
    super();
    this._uri = uri;
    this._reader = new Reader(uri.path, cfg);
  }

  public get uri() {
    return this._uri;
  }

  public get nrFrames() {
    return this._reader.length;
  }

  public get width() {
    return this._reader.width;
  }

  public async getFrame(idx: number) {
    const worker = new Worker(
      path_resolve(__dirname, 'worker.js'), {
        workerData: {
          cfg: {...this._reader.cfg, ...{idx: idx}},
          path: this.uri.path
        }
      }
    );

    return new Promise<Uint8ClampedArray>((resolve) => {
      worker.on('message', message => resolve(message.frame));
      worker.postMessage('load');  
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
    const yuvEditor = new YuvEditorProvider(context);
    /* TODO only for dev */
    vscode.commands.registerCommand('yuv-viewer.deleteCache', () => {
      context.workspaceState.keys().forEach(key => {
        context.workspaceState.update(key, undefined);
      });
    });

    const getCurrentYuv = () => {
      const yuvFiles = context.workspaceState.keys().filter((key) => {
        const state = context.workspaceState.get(key);
        return (state as Record<string, any>).active === true;
      });
      if (yuvFiles.length) {
        return yuvFiles[0];
      }
      // TODO throw ?
    };

    const addCfgCommand = async (
      name: string, setCfgItem: (cfg: FrameCfg) => Promise<FrameCfg>
    ) => {
      vscode.commands.registerCommand(name, async () => {
        const yuvFile = getCurrentYuv();
        if (yuvFile) {
          const state: YuvState = context.workspaceState.get(yuvFile)!;
          state.cfg = await setCfgItem(state.cfg);
          context.workspaceState.update(yuvFile, state);
          yuvEditor.postMessage(vscode.Uri.parse(yuvFile), 'refresh', {
            width: state.cfg.width
          });
          vscode.commands.executeCommand('yuv-viewer.refresh');
        }
      });
    };

    addCfgCommand('yuv-viewer.setSubsampling', async (cfg) => {
      const format = await vscode.window.showQuickPick(
        Object.keys(YuvFormat), { canPickMany: false }
      );
      if (format !== undefined) {
        cfg.format = YuvFormat[<keyof typeof YuvFormat>format];
      }
      return cfg;
    });

    addCfgCommand('yuv-viewer.setWidth', async (cfg) => {
      const width = await vscode.window.showInputBox();
      if (width) {
        cfg.width = parseInt(width);
      }
      return cfg;
    });

    addCfgCommand('yuv-viewer.setHeight', async (cfg) => {
      const height = await vscode.window.showInputBox();
      if (height) {
        cfg.height = parseInt(height);
      }
      return cfg;
    });

    addCfgCommand('yuv-viewer.setBitdepth', async (cfg) => {
      const bits = await vscode.window.showInputBox();
      if (bits) {
        cfg.bits = parseInt(bits);
      }
      return cfg;
    });

    addCfgCommand('yuv-viewer.setResolution', async (cfg) => {
      const extCfg = vscode.workspace.getConfiguration('yuv-viewer');
      const res = await vscode.window.showQuickPick(
        extCfg.resolutions, { canPickMany: false }
      );
      if (res !== undefined) {
        let [_width, _height] = res.split('x');
        // let [width, height] = [parseInt(_width), parseInt(_height)];
        // if (isNaN(width) || isNaN(height)) {
        //   // TODO show error message
        //   return cfg;
        // }
        cfg.width = parseInt(_width);
        cfg.height = parseInt(_height);
      }
      return cfg;
    });

    return vscode.window.registerCustomEditorProvider(
      YuvEditorProvider.viewType,
      yuvEditor,
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
    let state: YuvState | undefined = this._context.workspaceState.get(uri.toString());
    if (!state) {
      state = {
        active: true,
        visible: true,
        cfg: {
          ...{
            width: 1280, height: 720, format: YuvFormat.YUV444
          },
          ...vscode.workspace.getConfiguration('yuv-viewer').defaultFrameConfig
        }
      };
    } else {
      state.active = true;
      state.visible = true;
    }
    this._context.workspaceState.update(uri.toString(), state);
    const document: YuvDocument = await YuvDocument.create(uri, state!.cfg);

    vscode.commands.executeCommand('yuv-viewer.refresh');
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
        case 'init':
          this.postMessage(webviewPanel, 'updateFrameCount', {nrFrames: document.nrFrames});
          this.postMessage(webviewPanel, 'updateWidth', {width: document.width});
        case 'load':
          this.postMessage(webviewPanel, `load-${e.idx}`, {
            value: await document.getFrame(e.idx),
          });
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

  postMessage(uri: vscode.Uri, type: string, body: any): void;
  postMessage(panel: vscode.WebviewPanel, type: string, body: any): void;
  postMessage(uriOrPanel: vscode.Uri | vscode.WebviewPanel, type: string, body: any)
  {
    const isUri = uriOrPanel instanceof vscode.Uri;
    const panels = isUri ? this.webviews.get(uriOrPanel) : [uriOrPanel];
    for (const panel of panels) {
      panel.webview.postMessage({ type, body });
    }
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
      const state = context.workspaceState.get(uri.toString()) as YuvState;
      state.active = false;
      state.visible = false;
      context.workspaceState.update(uri.toString(), state);
      this._webviews.delete(entry);
      vscode.commands.executeCommand('yuv-viewer.refresh');
    });

    webviewPanel.onDidChangeViewState((event) => {
      const state = context.workspaceState.get(uri.toString()) as YuvState;
      state.active = event.webviewPanel.active;
      state.visible = event.webviewPanel.visible;
      context.workspaceState.update(uri.toString(), state);
      vscode.commands.executeCommand('yuv-viewer.refresh');
    });
  }
}
