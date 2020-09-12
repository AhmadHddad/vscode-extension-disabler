import * as vscode from "vscode";
import { ConfigKey, ConfigProfilesKey, ConfigStorageKey } from "./constants";

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

interface Extension {
  id: number;
  uuid: string;
  label: string;
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
    return vscode.workspace.getConfiguration(ConfigKey);
  };

  public getProfiles = () => {
    let config = this.getConfig();

    return config.get<string[]>(ConfigProfilesKey, []).sort();
  };

  public getProfileExtensions = (profile: string): ProfileExtensions => {
    return <ProfileExtensions>this.getStorage()[profile];
  };

  public getAllProfilesExtensions = (): ALLProfileExtensions => {
    return this.getStorage();
  };

  private getStorage = () => {
    let config = this.getConfig();

    return config.get<Storage>(ConfigStorageKey, {});
  };

  public addProfile = (profile: string) => {
    let config = this.getConfig();

    let existingProfiles = this.getProfiles();

    return config.update(
      ConfigProfilesKey,
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
      ConfigProfilesKey,
      newProfiles,
      vscode.ConfigurationTarget.Global
    );
  };

  public removeProfileExtensions = (profile: string) => {
    let profiles = new Map(Object.entries(this.getAllProfilesExtensions()));
    let config = this.getConfig();

    profiles.delete(profile);

    return config.update(
      ConfigStorageKey,
      Object.fromEntries(profiles),
      vscode.ConfigurationTarget.Global
    );
  };

  public addProfileExtensions = (profile: string, settings: Settings) => {
    const deleteSetting = (key: string) => {
      if (`${ConfigKey}.${key}` in settings) {
        delete settings[`${ConfigKey}.${key}`];
      }
    };

    deleteSetting(ConfigProfilesKey);
    deleteSetting(ConfigStorageKey);

    let storage = this.getStorage();
    storage[profile] = settings;
    return this.updateStorage(storage);
  };

  private updateStorage = (storage: Storage) => {
    let config = this.getConfig();

    return config.update(
      ConfigStorageKey,
      storage,
      vscode.ConfigurationTarget.Global
    );
  };
}

export default Config;
