import * as vscode from 'vscode';
import * as path from 'path';

export class YuvSettingsProvider implements vscode.TreeDataProvider<YuvCfgItem> {
  public static register(context: vscode.ExtensionContext) {
	vscode.window.registerTreeDataProvider(
		'yuvViewer',
		new YuvSettingsProvider(context)
	);
 }

  constructor(private readonly _context: vscode.ExtensionContext) {}

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
    super(key, collapsibleState);
    this.tooltip = `${this.key}: ${this.value}`;
    this.description = this.value;
  }

  iconPath = {
    light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
    dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  };
}
