import * as vscode from "vscode";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import * as utils from "./utils";
import Config from "./config";

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

class Services {
  saveDisabledExtensionsToDB = async (
    workspaceId: string,
    extensionsToDisable: Array<Extension>
  ) => {
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
    let db = new verbose.Database(
      dbRout,
      sqlite3.OPEN_READWRITE,
      (err: any) => {
        if (err) {
          console.error(err.message);
        }
      }
    );

    await db.run(query, (err) => {
      if (!err) {
        vscode.window.showInformationMessage(
          "Success!, Please restart workspace"
        );
        vscode.ConfigurationTarget.Global;
      }
    });

    return;
  };

  getWorkSpaceList = (): Array<WorkSpaceOptions> => {
    const vsCodeRout = utils.getVsCodeRout();
    let file = null;

    try {
      file = fs.readFileSync(`${vsCodeRout}/storage.json`);
    } catch (error) {
      vscode.window.showErrorMessage("There are no workspaces registered!");
      return [];
    }
    const workspaces3 = JSON.parse(file.toString()).openedPathsList.workspaces3;

    return workspaces3.filter(
      (opt: Object | String) => typeof opt === "object"
    );
  };

  getWorkSpaceForPick = (): Array<WorkSpaceForPick> => {
    return this.getWorkSpaceList().map((option) => {
      const splitPath = option.configURIPath.split("/");
      return {
        id: option.id,
        label: splitPath[splitPath.length - 1],
      };
    });
  };

  getAllExtensions = (): Array<Extension> => {
    return vscode.extensions.all
      .filter((ext) => !!ext.packageJSON.uuid)
      .map((ext) => ({
        id: ext.packageJSON.id,
        uuid: ext.packageJSON.uuid,
        label: ext.packageJSON.name,
      }));
  };

  saveProfile = async (config: Config): Promise<SavedProfile> => {
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
  };

  getSelectedWorkspace = async (): Promise<SelectedWorkspace> => {
    const workSpacesForList = this.getWorkSpaceForPick();

    if (!workSpacesForList.length) {
      vscode.window.showInformationMessage("Please add a workspace first");
      return;
    }

    return await vscode.window.showQuickPick(workSpacesForList, {
      placeHolder: "Select workspace",
    });
  };

  selectExtensionsForDisable = async (): Promise<Array<Extension>> => {
    const allExtensions = this.getAllExtensions();

    return (
      (await vscode.window.showQuickPick(allExtensions, {
        canPickMany: true,
        placeHolder: "Select extensions to disable",
      })) || []
    );
  };
}

export default Services;
