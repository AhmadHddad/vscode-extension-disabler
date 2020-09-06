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

class Config {
  public constructor(private context?: vscode.ExtensionContext) {}

  private getConfig() {
    return vscode.workspace.getConfiguration(ConfigKey);
  }

  public getProfiles() {
    let config = this.getConfig();

    return config.get<string[]>(ConfigProfilesKey, []).sort();
  }

  public getProfileExtensions(profile: string): ProfileExtensions {
    return <ProfileExtensions>this.getStorage()[profile];
  }

  private getStorage() {
    let config = this.getConfig();

    return config.get<Storage>(ConfigStorageKey, {});
  }

  public addProfile(profile: string) {
    let config = this.getConfig();

    let existingProfiles = this.getProfiles();

    return config.update(
      ConfigProfilesKey,
      [...existingProfiles, profile],
      vscode.ConfigurationTarget.Global
    );
  }

  public addProfileExtensions(profile: string, settings: Settings) {
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
  }

  private updateStorage(storage: Storage) {
    let config = this.getConfig();

    return config.update(
      ConfigStorageKey,
      storage,
      vscode.ConfigurationTarget.Global
    );
  }
}

export default Config;
