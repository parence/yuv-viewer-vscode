import * as vscode from 'vscode';

export class YuvSettingsProvider implements vscode.TreeDataProvider<YuvCfgItem> {
  public static register(context: vscode.ExtensionContext) {
    const yuvSettings = new YuvSettingsProvider(context);
	vscode.window.registerTreeDataProvider(
		'yuvViewer', yuvSettings
	);
    vscode.commands.registerCommand('yuv-viewer.refresh', () =>
        yuvSettings.refresh()
    );
 }

  constructor(private readonly _context: vscode.ExtensionContext) {}
  
  private _onDidChangeTreeData: vscode.EventEmitter<YuvCfgItem | undefined | null | void> = new vscode.EventEmitter<YuvCfgItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<YuvCfgItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: YuvCfgItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: YuvCfgItem): Thenable<YuvCfgItem[]> {
    if (element) {
      return Promise.resolve(
        this.getYuvCfgItems(
            element.key
        )
      );
    } else {
        const yuvFiles = this._context.workspaceState.keys().filter((yuvFile) => {
            return (this._context.workspaceState.get(yuvFile) as Record<string, any>).active;
        });
        return Promise.resolve(
            yuvFiles.map(yuvFile => new YuvCfgItem(yuvFile, '', vscode.TreeItemCollapsibleState.Expanded))
        );
    }
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private getYuvCfgItems(yuvFile: string): YuvCfgItem[] {
        const yuvCfgItems: YuvCfgItem[] = [];
        const yuvFileCfg: Record<string, any> | undefined = this._context.workspaceState.get(yuvFile);
        if (yuvFileCfg) {
            for (const key in yuvFileCfg.cfg) {
                if (Object.prototype.hasOwnProperty.call(yuvFileCfg.cfg, key)) {
                    const value = yuvFileCfg.cfg[key];
                    yuvCfgItems.push(new YuvCfgItem(key, value.toString(), vscode.TreeItemCollapsibleState.None));
                    
                }
            }
        }
        return yuvCfgItems;
  }


}

class YuvCfgItem extends vscode.TreeItem {
  constructor(
    public readonly key: string,
    private value: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(
        vscode.workspace.asRelativePath(vscode.Uri.parse(key)),
        collapsibleState
    );
    const label = typeof this.label === 'string' ? this.label : this.label!.label;
    this.label = label[0] === '/' ? label.slice(1) : label;
    this.tooltip = `${this.key}: ${this.value}`;
    this.description = this.value;
  }

}
