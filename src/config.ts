import * as vscode from "vscode";
import {
  CONFIG_KEY,
  CONFIG_PROFILES_KEY,
  CONFIG_STORAGE_KEY,
} from "./constants";
import { Extension } from "./services";

export interface Settings {
  [key: string]:
    | number
    | string
    | boolean
    | object
    | Array<any>
    | ProfileExtensions;
}

export interface Storage {
  [key: string]: Settings;
}

type ProfileExtensions =
  | { selectedExtensionsForDisable: Array<Extension> }
  | undefined;

interface ALLProfileExtensions {
  [key: string]: object;
}

class Config {
  public constructor(private context?: vscode.ExtensionContext) {}

  private getConfig = () => {
    return vscode.workspace.getConfiguration(CONFIG_KEY);
  };

  public getProfiles = () => {
    let config = this.getConfig();

    return config.get<string[]>(CONFIG_PROFILES_KEY, []).sort();
  };

  public getProfileExtensions = (profile: string): ProfileExtensions => {
    return <ProfileExtensions>this.getStorage()[profile];
  };

  public getAllProfilesExtensions = (): ALLProfileExtensions => {
    return this.getStorage();
  };

  public getAllExtensionsNotInThisProfile = (
    allExtensions: Extension[],
    profile: string
  ): Extension[] => {
    const allProfileExtensions =
      this.getProfileExtensions(profile)?.selectedExtensionsForDisable || [];

    return (
      allExtensions.filter(
        (ext) =>
          !allProfileExtensions?.some(
            (e) => e.id.toLowerCase() === ext.id.toLowerCase()
          )
      ) || []
    );
  };

  private getStorage = () => {
    let config = this.getConfig();

    return config.get<Storage>(CONFIG_STORAGE_KEY, {});
  };

  public addProfile = (profile: string) => {
    let config = this.getConfig();

    let existingProfiles = this.getProfiles();

    return config.update(
      CONFIG_PROFILES_KEY,
      [...existingProfiles, profile],
      vscode.ConfigurationTarget.Global
    );
  };

  public removeProfile = (profile: string) => {
    let profiles = this.getProfiles();
    let newProfiles = profiles
      .slice(0, profiles.indexOf(profile))
      .concat(profiles.slice(profiles.indexOf(profile) + 1, profiles.length));

    let config = this.getConfig();

    return config.update(
      CONFIG_PROFILES_KEY,
      newProfiles,
      vscode.ConfigurationTarget.Global
    );
  };

  public removeAllProfileExtensions = (profile: string) => {
    let profiles = new Map(Object.entries(this.getAllProfilesExtensions()));
    let config = this.getConfig();

    profiles.delete(profile);

    return config.update(
      CONFIG_STORAGE_KEY,
      Object.fromEntries(profiles),
      vscode.ConfigurationTarget.Global
    );
  };

  public removeExtensionsFromProfile = (
    profile: string,
    extensionsToDelete: Extension[]
  ): Extension[] | undefined => {
    let profiles = new Map(Object.entries(this.getAllProfilesExtensions()));

    const profileExtensions = this.getProfileExtensions(profile);

    const updatedProfileExtensions =
      profileExtensions?.selectedExtensionsForDisable.filter(
        (ex) =>
          !extensionsToDelete.find(
            (e) => e.id.toLowerCase() === ex.id.toLowerCase()
          )
      );

    let config = this.getConfig();

    profiles.set(profile, {
      selectedExtensionsForDisable: updatedProfileExtensions,
    });

    try {
      config.update(
        CONFIG_STORAGE_KEY,
        Object.fromEntries(profiles),
        vscode.ConfigurationTarget.Global
      );

      return updatedProfileExtensions;
    } catch (error: any) {
      vscode.window.showErrorMessage("Could not save configuration", error);
    }
  };

  public addNewExtensionsToProfile = (
    profile: string,
    extensionsToAdd: Extension[]
  ): Extension[] | undefined => {
    let profiles = new Map(Object.entries(this.getAllProfilesExtensions()));

    const profileExtensions =
      this.getProfileExtensions(profile)?.selectedExtensionsForDisable || [];

    const updatedProfileExtensions = profileExtensions?.concat(extensionsToAdd);

    let config = this.getConfig();

    profiles.set(profile, {
      selectedExtensionsForDisable: updatedProfileExtensions,
    });

    try {
      config.update(
        CONFIG_STORAGE_KEY,
        Object.fromEntries(profiles),
        vscode.ConfigurationTarget.Global
      );

      return updatedProfileExtensions;
    } catch (error: any) {
      vscode.window.showErrorMessage("Could not save configuration", error);
    }
  };

  public addProfileExtensions = (profile: string, settings: Settings) => {
    const deleteSetting = (key: string) => {
      if (`${CONFIG_KEY}.${key}` in settings) {
        delete settings[`${CONFIG_KEY}.${key}`];
      }
    };

    deleteSetting(CONFIG_PROFILES_KEY);
    deleteSetting(CONFIG_STORAGE_KEY);

    let storage = this.getStorage();
    storage[profile] = settings;
    return this.updateStorage(storage);
  };

  private updateStorage = (storage: Storage) => {
    let config = this.getConfig();

    return config.update(
      CONFIG_STORAGE_KEY,
      storage,
      vscode.ConfigurationTarget.Global
    );
  };
}

export default Config;
