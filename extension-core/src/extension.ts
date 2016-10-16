'use strict';

import * as path from 'path';
import {spawn} from 'child_process';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('extension.solutionmanager.showOpenProjects', () => {

        // source
        //var command = './node_modules/.bin/electron.cmd';
        var command = "electron";
        var cwd = path.join(__dirname, '../../../extension-ui/');
        
        command = command.replace(/\//g, path.sep);
        cwd = cwd.replace(/\//g, path.sep);
        
        console.log(process.env);
        
        var spawn_env = JSON.parse(JSON.stringify(process.env));
        
        // remove those env vars
        delete spawn_env.ATOM_SHELL_INTERNAL_RUN_AS_NODE;
        delete spawn_env.ELECTRON_RUN_AS_NODE;

        var sp = spawn(command, ['.'], {cwd: cwd, env: spawn_env});
        //sp.unref();
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {
}
