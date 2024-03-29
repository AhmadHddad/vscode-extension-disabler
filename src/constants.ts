import { getVsCodeRout } from "./utils";

export const CONFIG_KEY = "extensionDisabler";

export const CONFIG_PROFILES_KEY = "profiles";
export const CONFIG_STORAGE_KEY = "storage";

export const EDIT_OPTION_DELETE = 1;
export const EDIT_OPTION_ADD = 0;

export const EDIT_PROFILE_OPTIONS = [
  { label: "Add More Extensions", value: EDIT_OPTION_ADD },
  { label: "Delete Extensions", value: EDIT_OPTION_DELETE },
];

export const VSCODE_LATEST_VERSION = "1.55.0";

export const WORKSPACES_ROOT_FOLDER_ROUT = `${getVsCodeRout()}/User/workspaceStorage`;
