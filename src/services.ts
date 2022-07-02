import * as vscode from "vscode";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import * as utils from "./utils";
import Config from "./config";
import {
  EDIT_PROFILE_OPTIONS,
  VSCODE_LATEST_VERSION,
  WORKSPACES_ROOT_FOLDER_ROUT,
} from "./constants";
import { IConformation } from "./interfaces";

const verbose = sqlite3.verbose();

export interface Extension {
  id: string;
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

type DBExtension = {
  id: string;
  uuid: string;
};

class Services {
  // deleteEnabled is to delete first then insert to the DB.
  saveDisabledExtensionsToDB = async (
    workspaceId: string,
    extensionsToDisable: Array<Extension>,
    deleteEnabled = true
  ) => {
    const mappedExtensionsToDisable = JSON.stringify(
      extensionsToDisable.map((ext) => ({
        id: ext.id.toLowerCase(),
        uuid: ext.uuid.toLowerCase(),
      }))
    );

    const vsCodeRout = utils.getVsCodeRout();
    const getAllEnabledExtensionsQuery = `SELECT "value" FROM "main"."ItemTable" WHERE "key" = "extensionsIdentifiers/enabled"`;

    // Future feature
    // const deleteFieldQuery = `DELETE FROM "main"."ItemTable" WHERE "key" = "extensionsIdentifiers/disabled"`;
    const insertQuery = `INSERT INTO "main"."ItemTable" ("key", "value") VALUES ('extensionsIdentifiers/disabled','${mappedExtensionsToDisable}')`;
    const dbRout = `${vsCodeRout}/User/workspaceStorage/${workspaceId}/state.vscdb`;
    let enabledExtensions: DBExtension[] = [];
    let initialEnabledExtensionCount = 0;

    // open the main database
    const mainDB = new verbose.Database(dbRout, sqlite3.OPEN_READWRITE, (err: any) => {
      if (err) {
        console.error(err.message);
      }
    });

    mainDB.serialize(() => {
      // mainDB.run(deleteFieldQuery, (err) => {
      //   if (err) {
      //     vscode.window.showErrorMessage(
      //       `Could not run delete field on state.vscdb (${err.message})`
      //     );
      //   }
      // });

      mainDB.get(getAllEnabledExtensionsQuery, (_: any, row: any) => {
        if (row?.value) {
          try {
            enabledExtensions = JSON.parse(row?.value);

            initialEnabledExtensionCount = enabledExtensions?.length;
          } catch (error) {
            console.error("Error parsing enabled extensions", error);
          }

          if (enabledExtensions?.length) {
            enabledExtensions = enabledExtensions.filter(
              (extension) =>
                extensionsToDisable.findIndex(
                  (ext) => ext.id.toLowerCase() === extension.id.toLowerCase()
                ) === -1
            );
          }
        }

        if (initialEnabledExtensionCount !== enabledExtensions?.length && deleteEnabled) {
          const enabledExtensionsToDisable = JSON.stringify(enabledExtensions);
          const insertQuery = `INSERT INTO "main"."ItemTable" ("key", "value") VALUES ('extensionsIdentifiers/enabled','${enabledExtensionsToDisable}')`;

          mainDB.run(insertQuery, (err) => {
            if (err) {
              vscode.window.showErrorMessage(
                `Failed to remove extension from enabled extensions field, will try my best! ${err?.message}`
              );
            }
          });
        }

        mainDB.run(insertQuery, async (err) => {
          if (!err) {
            await this.showSuccessMsgWithReloadAsync();

            vscode.ConfigurationTarget.Global;
          }
          if (err) {
            vscode.window.showErrorMessage(
              `Could not run query on state.vscdb(${err.message})`
            );
          }
        });
      });
    });

    // mainDB.run(insertQuery, (err) => {
    //   if (!err) {
    //     vscode.window.showInformationMessage(
    //       "Success!, Please restart workspace"
    //     );
    //     vscode.ConfigurationTarget.Global;
    //   }
    //   if (err) {
    //     vscode.window.showErrorMessage(
    //       `Could not run query on state.vscdb(${err.message})`
    //     );
    //   }
    // });

    // mainDB.close();
    return;
  };

  getWorkSpacesIds = (): Array<string> =>
    fs.readdirSync(WORKSPACES_ROOT_FOLDER_ROUT).map((file: string) => file);

  getWorkSpaceList = (): Array<WorkSpaceOptions> => {
    const stuff: Array<WorkSpaceOptions> = [];
    this.getWorkSpacesIds().forEach((workspaceId: string) => {
      const workspaceRout = `${WORKSPACES_ROOT_FOLDER_ROUT}/${workspaceId}`;
      try {
        const workspaceName = JSON.parse(
          fs.readFileSync(`${workspaceRout}/workspace.json`).toString()
        );
        stuff.push({
          configURIPath: Object.values(workspaceName)[0] as string,
          id: workspaceId,
        });
      } catch (error) {
        console.log("🚀 Error Could not read workspace file", error);
      }
    });

    return stuff;
  };

  getWorkSpaceForPick = (): Array<WorkSpaceForPick> => {
    return this.getWorkSpaceList().map((option) => {
      const splitPath = utils.getLastItem(
        option.configURIPath.split("/") as []
      ) as string;
      return {
        id: option.id,
        label: splitPath,
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

    let profile = await vscode.window.showQuickPick([...profiles, "New profile"], {
      placeHolder: "Select a profile",
    });

    if (!profile || profile === "New profile") {
      profile = await vscode.window.showInputBox({
        placeHolder: "Enter the profile name",
      });

      if (!profile) {
        return;
      }

      if (profiles.indexOf(profile) !== -1) {
        vscode.window.showErrorMessage("This profile name is already taken!");
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

  public getSelectedApplyProfileToWorkSpace = async (): Promise<IConformation> => {
    const conformation = await vscode.window.showInformationMessage(
      "Do you want to apply the updated profile to a workspace?",
      "Yes",
      "No"
    );

    return conformation as IConformation;
  };

  public updateWorkSpaceToNewExtensions = async (
    updatedExtensions: Extension[],
    deleteEnabled = true
  ) => {
    const conformation = await this.getSelectedApplyProfileToWorkSpace();

    if (conformation === "Yes") {
      await this.selectWorkSpaceAndSetDisabledExtensionsToDB(
        updatedExtensions,
        deleteEnabled
      );
    }
  };

  public selectWorkSpaceAndSetDisabledExtensionsToDB = async (
    updatedExtensions: Extension[],
    deleteEnabled = true
  ) => {
    const selectedWorkspace = await this.getSelectedWorkspace();

    if (!selectedWorkspace) {
      return;
    }

    try {
      await this.saveDisabledExtensionsToDB(
        selectedWorkspace.id,
        updatedExtensions,
        deleteEnabled
      );
    } catch (error: any) {
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

  showSuccessMsgWithReloadAsync = async () => {
    const successMsgConf = await vscode.window.showInformationMessage(
      "Success!, Please reload workspace",
      "Reload"
    );

    if (successMsgConf === "Reload") {
      await this.reloadWindowAsync();
    } else {
      return;
    }
  };

  reloadWindowAsync = async () => {
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  };
}

export default Services;
