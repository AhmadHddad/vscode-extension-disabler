import * as vscode from "vscode";
import Config from "./config";
import * as Commands from "./commands";
import Services from "./services";
import { EDIT_OPTION_ADD, EDIT_OPTION_DELETE } from "./constants";

export async function activate(context: vscode.ExtensionContext) {
  const config = new Config(context);
  const services = new Services();

  async function main() {
    const savedProfile = await services.saveProfile(config);

    if (!savedProfile) {
      return;
    }

    const profileExtensions = config.getProfileExtensions(savedProfile);

    if (
      !profileExtensions ||
      !profileExtensions?.selectedExtensionsForDisable.length
    ) {
      const selectedExtensionsForDisable = await services.getSelectExtensionsForDisable();
      if (selectedExtensionsForDisable.length) {
        await config.addProfileExtensions(savedProfile, {
          selectedExtensionsForDisable: selectedExtensionsForDisable,
        });

        await services.updateWorkSpaceToNewExtensions(
          selectedExtensionsForDisable
        );
      }
    } else {
      await services.updateWorkSpaceToNewExtensions(
        profileExtensions.selectedExtensionsForDisable
      );
    }

    return;
  }

  async function deleteProfile() {
    let profiles = config.getProfiles();

    if (profiles.length) {
      const selectedProfile = await vscode.window.showQuickPick(profiles, {
        placeHolder: "Select profile to delete",
      });

      if (selectedProfile) {
        await config.removeProfile(selectedProfile);
        await config.removeAllProfileExtensions(selectedProfile);

        await vscode.window.showInformationMessage(
          `Profile ${selectedProfile} has been deleted.`
        );
      } else {
        return;
      }
    } else {
      vscode.window.showInformationMessage(
        "You don't have any saved profiles!"
      );
    }
  }

  async function editProfile() {
    let profiles = config
      .getProfiles()
      .map((profileLabel) => ({ label: profileLabel }));

    const selectedProfile = await vscode.window.showQuickPick(profiles, {
      placeHolder: "Select Profile",
    });

    if (selectedProfile?.label) {
      // show edit options (delete or add);

      const selectedEditOption = await services.getSelectedEditOption();

      if (selectedEditOption?.value === EDIT_OPTION_DELETE) {
        const selectedExtensionsForDelete = await services.getSelectedExtensionsForDelete(
          config,
          selectedProfile.label
        );

        if (selectedExtensionsForDelete?.length) {
          const updatedProfileExtensions = config.removeExtensionsFromProfile(
            selectedProfile.label,
            selectedExtensionsForDelete
          );
          if (updatedProfileExtensions?.length) {
            await services.updateWorkSpaceToNewExtensions(
              updatedProfileExtensions
            );
          }
        }
      } else if (selectedEditOption?.value === EDIT_OPTION_ADD) {
        const extensionsToAdd = await services.getSelectedExtensionsForAdd(
          config,
          selectedProfile.label
        );

        if (extensionsToAdd?.length) {
          const updatedProfileExtensions = config.addNewExtensionsToProfile(
            selectedProfile.label,
            extensionsToAdd
          );

          if (updatedProfileExtensions?.length) {
            await services.updateWorkSpaceToNewExtensions(extensionsToAdd);
          }
        }
      }
    } else {
      return;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(Commands.default.EXTENSION_DISABLER, main)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.default.EXTENSION_DISABLER_EDIT_PROFILE,
      editProfile
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.default.EXTENSION_DISABLER_DELETE_PROFILE,
      deleteProfile
    )
  );
}
