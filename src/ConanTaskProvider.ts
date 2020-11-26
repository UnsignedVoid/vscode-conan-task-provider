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
	conanfile: string = "";
	commandArgs?: string[] = [];
	profile?: string = "";
	buildFolder?: string;
	installFolder?: string;

	constructor(conanfile: vscode.Uri){
		this.conanfile = conanfile.fsPath;
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

	private static getArgs(definition: ConanTaskDefinition) : string[]{
		switch (definition.command) {
			case "build":
				return [
					definition.command,
					definition.conanfile,
					 ...(definition.commandArgs ?? []),
					 definition.buildFolder ? `--build-folder=${definition.buildFolder}` : '', 
					];
			case "install":
				return [
					definition.command,
					definition.conanfile,
					...(definition.commandArgs ?? []),
					definition.profile ? `--profile=${definition.profile}` : '',
					definition.installFolder ? `--install-folder=${definition.installFolder}` : '',
				];
			case "create":
				return [
					definition.command,
					definition.conanfile,
					...(definition.commandArgs ?? []),
					definition.profile ? `--profile=${definition.profile}` : '',
					definition.buildFolder ? `--build-folder=${definition.buildFolder}` : '', 
					definition.installFolder ? `--install-folder=${definition.installFolder}` : '',
				];
			default:
				return [];
		}
	}

	private static generateShellExec(definition: ConanTaskDefinition){	
		return new vscode.ShellExecution("conan", ConanTaskProvider.getArgs(definition));
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