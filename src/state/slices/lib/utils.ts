import { getState } from "@state/storeHolder.js";
import { Library } from "./types.js";

export const LibUtils = {

  // 根据文件路径查找所属的库
  findOwningLib(filePath: string): Library | null {
    const state = getState();
    const libs = state.lib.libs;

    for (const libId in libs) {
      const lib = libs[libId];
      if (filePath.startsWith(lib.libPath!))
        return lib;
    }
    return null;
  }
}


