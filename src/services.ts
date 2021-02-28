import * as vscode from "vscode";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import * as utils from "./utils";
import Config from "./config";
import { EDIT_PROFILE_OPTIONS } from "./constants";

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
    const deleteFieldQuery = `DELETE FROM "main"."ItemTable" WHERE "key" = "extensionsIdentifiers/disabled"`;
    const insertQuery = `INSERT INTO "main"."ItemTable" ("key", "value") VALUES ('extensionsIdentifiers/disabled','${mappedExtensionsToDisable}')`;
    const dbRout = `${vsCodeRout}/User/workspaceStorage/${workspaceId}/state.vscdb`;

    // open the main database
    let mainDB = new verbose.Database(
      dbRout,
      sqlite3.OPEN_READWRITE,
      (err: any) => {
        if (err) {
          console.error(err.message);
        }
      }
    );

    mainDB.run(deleteFieldQuery, (err) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Could not run delete field on state.vscdb (${err.message})`
        );
      }
    });

    mainDB.run(insertQuery, (err) => {
      if (!err) {
        vscode.window.showInformationMessage(
          "Success!, Please restart workspace"
        );
        vscode.ConfigurationTarget.Global;
      }
      if (err) {
        vscode.window.showErrorMessage(
          `Could not run query on state.vscdb(${err.message})`
        );
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
      .filter(
        (ext) =>
          Boolean(ext.packageJSON.uuid) &&
          ext.packageJSON?.publisher !== "vscode" &&
          ext.packageJSON?.publisher !== "ms-vscode"
      )
      .map((ext) => ({
        id: ext.packageJSON.id,
        uuid: ext.packageJSON.uuid,
        label: ext.packageJSON.displayName || ext.packageJSON.name,
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

  public getSelectedEditOption = async () => {
    return await vscode.window.showQuickPick(EDIT_PROFILE_OPTIONS, {
      placeHolder: `Select Edit Option`,
    });
  };

  public getSelectedExtensionsForDelete = async (
    config: Config,
    profile: string
  ): Promise<Extension[] | undefined> => {
    const profileExtensions = config.getProfileExtensions(profile);

    if (profileExtensions?.selectedExtensionsForDisable?.length) {
      return await vscode.window.showQuickPick(
        profileExtensions.selectedExtensionsForDisable,
        {
          canPickMany: true,
          placeHolder: `Select Extensions To Delete From "${profile}" Profile (will be enabled)`,
        }
      );
    }
  };

  public getSelectedApplyProfileToWorkSpace = async (): Promise<
    "Yes" | "No" | undefined
  > => {
    const conformation = await vscode.window.showInformationMessage(
      "Do you want to apply the updated profile to a workspace?",
      "Yes",
      "No"
    );

    return conformation as "Yes" | "No" | undefined;
  };

  public updateWorkSpaceToNewExtensions = async (
    updatedExtensions: Extension[]
  ) => {
    const conformation = await this.getSelectedApplyProfileToWorkSpace();

    if (conformation === "Yes") {
      this.selectWorkSpaceAndSetDisabledExtensionsToDB(updatedExtensions);
    }
  };

  public selectWorkSpaceAndSetDisabledExtensionsToDB = async (
    updatedExtensions: Extension[]
  ) => {
    const selectedWorkspace = await this.getSelectedWorkspace();

    if (!selectedWorkspace) {
      return;
    }

    try {
      await this.saveDisabledExtensionsToDB(
        selectedWorkspace.id,
        updatedExtensions
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Could not write On Db - ${error?.message || error}`
      );
    }
  };

  public getSelectedExtensionsForAdd = async (
    config: Config,
    profile: string
  ): Promise<Extension[] | undefined> => {
    const allExtensionsNotInThisProfile = config.getAllExtensionsNotInThisProfile(
      this.getAllExtensions(),
      profile
    );
    if (allExtensionsNotInThisProfile?.length) {
      return await vscode.window.showQuickPick(allExtensionsNotInThisProfile, {
        canPickMany: true,
        placeHolder: `Select Extensions To Add To ${profile} Profile (will be disabled)`,
      });
    }
  };

  getSelectExtensionsForDisable = async (): Promise<Array<Extension>> => {
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
