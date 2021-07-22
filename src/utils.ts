export function getVsCodeRout(): String {
  const route =
    process.env.APPDATA ||
    (process.platform == "darwin"
      ? process.env.HOME + "/Library/Application Support"
      : process.env.HOME + "/.config");

  return `${route}/Code`;
}

export function getLastItem(arr: []): any | undefined {
  return arr[arr.length - 1];
}
