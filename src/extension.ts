import * as vscode from "vscode";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import * as utils from "./utils";
import Config from "./config";
import * as Commands from "./commands";

const verbose = sqlite3.verbose();

interface Extension {
  id: number;
  uuid: string;
  label: string;
}

interface WorkSpaceOptions {
  id: string;
  configURIPath: string;
}

interface WorkSpaceForPick {
  id: string;
  label: string;
}

type SavedProfile = void | string;

type SelectedWorkspace = WorkSpaceForPick | undefined;

async function saveDisabledExtensionsToDB(
  workspaceId: string,
  extensionsToDisable: Array<Extension>
) {
  if (!extensionsToDisable.length) {
    return;
  }
  let mappedExtensionsToDisable = JSON.stringify(
    extensionsToDisable.map((ext) => ({
      id: ext.id,
      uuid: ext.uuid,
    }))
  );

  const vsCodeRout = utils.getVsCodeRout();
  const query = `INSERT INTO "main"."ItemTable" ("key", "value") VALUES ('extensionsIdentifiers/disabled','${mappedExtensionsToDisable}')`;
  const dbRout = `${vsCodeRout}/User/workspaceStorage/${workspaceId}/state.vscdb`;

  // open the database
  let db = new verbose.Database(dbRout, sqlite3.OPEN_READWRITE, (err: any) => {
    if (err) {
      console.error(err.message);
    }
  });

  await db.run(query, (err) => {
    if (!err) {
      vscode.window.showInformationMessage(
        "Success!, Please restart workspace"
      );
      vscode.ConfigurationTarget.Global;
    }
  });

  return;
}

function getWorkSpaceList(): Array<WorkSpaceOptions> {
  const vsCodeRout = utils.getVsCodeRout();
  let file = new Buffer("");

  try {
    file = fs.readFileSync(`${vsCodeRout}/storage.json`);
  } catch (error) {
    vscode.window.showErrorMessage("There are no workspaces registered!");
    return [];
  }
  const workspaces3 = JSON.parse(file.toString()).openedPathsList.workspaces3;

  return workspaces3.filter((opt: Object | String) => typeof opt === "object");
}

function getWorkSpaceForPick(): Array<WorkSpaceForPick> {
  return getWorkSpaceList().map((option) => {
    const splitPath = option.configURIPath.split("/");
    return {
      id: option.id,
      label: splitPath[splitPath.length - 1],
    };
  });
}

function getAllExtensions(): Array<Extension> {
  return vscode.extensions.all
    .filter((ext) => !!ext.packageJSON.uuid)
    .map((ext) => ({
      id: ext.packageJSON.id,
      uuid: ext.packageJSON.uuid,
      label: ext.packageJSON.name,
    }));
}

async function saveProfile(config: Config): Promise<SavedProfile> {
  let profiles = config.getProfiles();

  let profile = await vscode.window.showQuickPick(
    [...profiles, "New profile"],
    {
      placeHolder: "Select a profile",
    }
  );

  if (!profile || profile === "New profile") {
    profile = await vscode.window.showInputBox({
      placeHolder: "Enter the profile name",
    });

    if (!profile) {
      return;
    }

    if (!profiles.length || profiles.indexOf(profile) === -1) {
      await config.addProfile(profile);
    }
  }

  return profile;
}

async function getSelectedWorkspace(): Promise<SelectedWorkspace> {
  const workSpacesForList = getWorkSpaceForPick();

  if (!workSpacesForList.length) {
    vscode.window.showInformationMessage("Please add a workspace first");
    return;
  }

  return await vscode.window.showQuickPick(workSpacesForList, {
    placeHolder: "Select workspace",
  });
}

async function selectExtensionsForDisable(): Promise<Array<Extension>> {
  const allExtensions = getAllExtensions();

  return (
    (await vscode.window.showQuickPick(allExtensions, {
      canPickMany: true,
      placeHolder: "Select extensions to disable",
    })) || []
  );
}

export async function activate(context: vscode.ExtensionContext) {
  let config = new Config(context);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.default.EXTENSION_DISABLER,
      async () => {
        const selectedWorkspace = await getSelectedWorkspace();

        if (!selectedWorkspace) {
          return;
        }

        const savedProfile = await saveProfile(config);

        if (!savedProfile) {
          return;
        }

        const profileExtensions = await config.getProfileExtensions(
          savedProfile
        );

        if (
          !profileExtensions ||
          !profileExtensions?.selectedExtensionsForDisable.length
        ) {
          const selectedExtensionsForDisable = await selectExtensionsForDisable();
          if (selectedExtensionsForDisable.length) {
            await config.addProfileExtensions(savedProfile, {
              selectedExtensionsForDisable: selectedExtensionsForDisable,
            });
            try {
              await saveDisabledExtensionsToDB(
                selectedWorkspace.id,
                selectedExtensionsForDisable
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                `Could not write On Db - ${error?.message || error}`
              );
            }
          }
        } else {
          saveDisabledExtensionsToDB(
            selectedWorkspace.id,
            profileExtensions.selectedExtensionsForDisable
          );
        }

        return;
      }
    )
  );
}
