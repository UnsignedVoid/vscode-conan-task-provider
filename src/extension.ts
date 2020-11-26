import * as vscode from 'vscode';
import {ConanTaskProvider} from "./ConanTaskProvider";

let conanTaskProvider : vscode.Disposable | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
	conanTaskProvider = vscode.tasks.registerTaskProvider("conan", new ConanTaskProvider());
}

export function deactivate() {
	conanTaskProvider?.dispose();
}
