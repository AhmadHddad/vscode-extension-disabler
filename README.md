## **vscode-extension-disabler**

**Description:**

A handy extension for those who work on different projects on Vscode, some extensions are not used and sometimes can be no ideal to be enabled on other projects, so instead of going around the currently installed extensions and disabling those which are not in use, you can simply use this extension to easily select extensions to be disabled, also will be saved as a profile in settings.json file, so it is easier to auto-disable same extensions on similar other projects.

## HOW TO USE

1.  CTRL + P or Command + P, type Extension disabler on command panel, and hit enter.
2.  If you have registered workspaces, you will see the list of registered workspaces, if not you will be asked to register ( save ) a workspace first.
3.  After selecting the required workspace, you will see a list of available profiles, or select new.
4.  If you select a new profile with the required name, you will see a list of installed extensions.
5.  Select the required extensions to be disabled on the selected workspace and be saved as a profile on the selected profile.
6.  If a success message pop up, hit enter and then restart Vscode

In Settings.json file under `extensionDisabler.profiles` you can see all available profiles,
also `extension disabled.storage` you can see all extensions that are disabled with profile name as a key.
**so when you sync your settings throw devices you can still sync your profiles and use this extension to disable the same extensions in other projects**

## Credits

This is the first time I develop an extension, so a huge credit for:

- VS Code team's [in depth guide to extensions](https://code.visualstudio.com/api/get-started/your-first-extension?wt.mc_id=profileswitcher-github-aapowell).
- Profile Switcher extension, from Arron Powell, that helped me with some source code [vscode-profile-switcher](https://github.com/aaronpowell/vscode-profile-switcher).
- Many videos and tutorials on youtube 😀!.
- Stack overflow community.

If you have any ideas you can send a tweet to me at [Ahmd_NA_Hddad](https://twitter.com/Ahmad_Na_Hddad), I would be very grateful.
