import * as vscode from "vscode";
import Config from "./config";
import * as Commands from "./commands";
import Services from "./services";

export async function activate(context: vscode.ExtensionContext) {
  const config = new Config(context);
  const services = new Services();

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.default.EXTENSION_DISABLER,
      async () => {
        const selectedWorkspace = await services.getSelectedWorkspace();

        if (!selectedWorkspace) {
          return;
        }

        const savedProfile = await services.saveProfile(config);

        if (!savedProfile) {
          return;
        }

        const profileExtensions = config.getProfileExtensions(savedProfile);

        if (
          !profileExtensions ||
          !profileExtensions?.selectedExtensionsForDisable.length
        ) {
          const selectedExtensionsForDisable = await services.selectExtensionsForDisable();
          if (selectedExtensionsForDisable.length) {
            await config.addProfileExtensions(savedProfile, {
              selectedExtensionsForDisable: selectedExtensionsForDisable,
            });
            try {
              await services.saveDisabledExtensionsToDB(
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
          services.saveDisabledExtensionsToDB(
            selectedWorkspace.id,
            profileExtensions.selectedExtensionsForDisable
          );
        }

        return;
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      Commands.default.EXTENSION_DISABLER_DELETE_PROFILE,
      async () => {
        let profiles = config.getProfiles();

        if (profiles.length) {
          const selectedProfile = await vscode.window.showQuickPick(profiles, {
            placeHolder: "Select extensions to disable",
          });

          if (selectedProfile) {
            await config.removeProfile(selectedProfile);
            await config.removeProfileExtensions(selectedProfile);

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
    )
  );
}
