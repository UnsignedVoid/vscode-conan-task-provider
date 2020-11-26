import { posix } from 'path';
import * as vscode from 'vscode';

interface ConanTaskDefinitionCtor {
	new(conanfile: vscode.Uri) : any;
}

interface ConanTaskDefinition extends vscode.TaskDefinition {
	command: string;
	conanfile: string;
	profile?: string;
	commandArgs?: string[];
	buildFolder?: string;
	installFolder?: string;
}

class ConanCommandDefinition implements ConanTaskDefinition {
	type: string = "conan";
	command: string = "";
	conanfile: string = "conanfile.py";
	private _commandArgs?: string[];
	private _profile?: string;
	private _buildFolder?: string;
	private _installFolder?: string;

	public static fromInterface(definition: ConanTaskDefinition): ConanCommandDefinition {
		let res = new ConanCommandDefinition(vscode.Uri.file(definition.conanfile));
		res.buildFolder = definition.buildFolder ?? "";
		res.installFolder = definition.installFolder ?? "";
		res.command = definition.command;
		res.profile = definition.profile ?? "";
		res.commandArgs = definition.commandArgs ?? [];
		return res;
	}

	constructor(conanfile: vscode.Uri){
		this.conanfile = conanfile.fsPath;
	}

	private get buildFolderPrefix(){
		return vscode.Uri.file(`build/${this.profile}`).path;
	}

	public get commandArgs() : string[]{
		return this._commandArgs ?? [];
	}

	public set commandArgs(val: string[]){
		if(val.length == 0) return;
		this._commandArgs = val;
	}

	public get installFolder(){
		return this._installFolder ?? this.buildFolder;
	}

	public set installFolder(val: string){
		if(val.length == 0) return;
		this._installFolder = val;
	}

	public get buildFolder() {
		return this._buildFolder ?? this.buildFolderPrefix;
	}

	public set buildFolder(val: string){
		if(val.length == 0) return;
		this._buildFolder = val;
	}

	public get profile(){
		return this._profile ?? "default";
	}

	public set profile(val: string){
		if(val.length == 0) return;
		this._profile = val
	}

}

class ConanBuildDefinition extends ConanCommandDefinition {
	command:string = "build"
};

class ConanInstallDefinition extends ConanCommandDefinition {
	command:string = "install"
}

class ConanCreateDefinition extends ConanCommandDefinition {
	command:string = "create"
}

const ConanInstallDefinitionCtor: ConanTaskDefinitionCtor = ConanInstallDefinition;
const ConanBuildDefinitionCtor: ConanTaskDefinitionCtor = ConanBuildDefinition;
const ConanCreateDefinitionCtor: ConanTaskDefinitionCtor = ConanCreateDefinition;

export class ConanTaskProvider implements vscode.TaskProvider{

	private static commandDefs: ConanTaskDefinitionCtor[] = [ConanInstallDefinitionCtor, ConanBuildDefinitionCtor, ConanCreateDefinitionCtor];

	private static getArgs(definition: ConanCommandDefinition) : string[]{
		switch (definition.command) {
			case "build":
				return [
					definition.command,
					definition.conanfile,
					...definition.commandArgs,
					`--build-folder=${definition.buildFolder}`, 
					];
			case "install":
				return [
					definition.command,
					definition.conanfile,
					...definition.commandArgs,
					`--profile=${definition.profile}`,
					`--install-folder=${definition.installFolder}`,
				];
			case "create":
				return [
					definition.command,
					definition.conanfile,
					...definition.commandArgs,
					`--profile=${definition.profile}`,
					`--build-folder=${definition.buildFolder}`, 
					`--install-folder=${definition.installFolder}`,
				];
			default:
				return [];
		}
	}

	private static generateShellExec(definition: ConanTaskDefinition){	
		return new vscode.ShellExecution("conan", ConanTaskProvider.getArgs(ConanCommandDefinition.fromInterface(definition)));
	}

	private static generateTask(definition: ConanTaskDefinition){
		return new vscode.Task(definition, vscode.TaskScope.Workspace, `Conan ${definition.command} for ${definition.conanfile}`, "Conan", ConanTaskProvider.generateShellExec(definition));
	}

	generateTasks(conanfile: vscode.Uri) : vscode.Task[] {
		return ConanTaskProvider.commandDefs.map( x => ConanTaskProvider.generateTask(new x(conanfile)));
	}

	async getTasks(token: vscode.CancellationToken){
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const result: vscode.Task[] = [];

		if (!workspaceFolders || workspaceFolders.length === 0) {
			return result;
		}

		const conanfiles_py = await vscode.workspace.findFiles("**/conanfile.py", undefined, undefined, token);
		const conanfiles_txt = await vscode.workspace.findFiles("**/conanfile.txt", undefined, undefined, token);
		for(const conanfile of [...conanfiles_py, ...conanfiles_txt]) {
			result.push(...this.generateTasks(conanfile));
		}

		return result;
	}

	provideTasks(token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
		return this.getTasks(token);
	}

	resolveTask(task: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {
		let res_task: vscode.Task | undefined = undefined;
		try {
			res_task = ConanTaskProvider.generateTask(<ConanCommandDefinition>task.definition);
		} catch (e) {
			vscode.window.showErrorMessage((e as Error).message);
		}
		return res_task;
	}

}