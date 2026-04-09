// 非 Node.js 或 Node.js 环境下都能运行的简易 path 模块
// 简化的 POSIX 风格 path 模块
//  - 仅支持 "/" 分隔符
//  - 不支持 对 . 和 ..的处理 （即不支持相对路径）

// 关于路径分隔符：
//  绝大多数情况下，Windows 都支持 Posix 风格的 "/" 分隔符。
//  因此我们内部统一使用 "/" 分隔符，参数传入的Windows风格路径会被转换为Posix风格，
//  输出的路径全部都是Posix风格，以减少混淆。

const SEP = "/";
// 把连续的多个/转成一个/，但不影响协议头的://
const REGEX_SLASHES = /(?<!:)\/{2,}/g;

const PathUtils = {
  toWindowsPath(p: string): string { return p.replace(REGEX_SLASHES, "\\"); },
  toPosixPath(p: string): string { return p.replace(/\\+/g, SEP); },

  // 规范化路径，处理 "." 和 ".."
  normalize(path: string): string {
    path = this.toPosixPath(path);
    const isAbsolute = this.isAbsolute(path);
    const isDir = path.endsWith(SEP);
    const parts = path.split(SEP);
    const normalizedParts: string[] = [];

    for (const part of parts) {
      if (part === "" || part === ".")  // 忽略空部分和当前目录标识
        continue;
      else if (part === "..") { // 上级目录标识，弹出上一个部分(如有)
        if (normalizedParts.length > 0) normalizedParts.pop();
      } else 
        normalizedParts.push(part);
    }

    let normalizedPath = normalizedParts.join(SEP);
    // 如果是绝对路径，Posix路径确保以斜杠开头，Windows路径确保以盘符开头
    const isWindowsAbs = /^[A-Za-z]:/.test(normalizedPath);
    if (isAbsolute && !isWindowsAbs)
      normalizedPath = SEP + normalizedPath;
    // 特殊情况：如果结果是空字符串且是绝对路径，则返回根目录 "/"
    if (normalizedPath === "" && isAbsolute)
      normalizedPath = SEP;
    if (isDir && normalizedPath !== "" && !normalizedPath.endsWith(SEP))
      normalizedPath += SEP;
    return normalizedPath;
  },

  join(...parts: string[]): string {
    parts = parts.map(p => this.toPosixPath(p));
    let result = "";
    for (const part of parts) {
      if (!part) continue;
      // 如果是绝对路径，直接覆盖
      if (this.isAbsolute(part))
        result = part;
      else {
        if (!result || result.endsWith(SEP))
          result += part;
        else
          result += SEP + part;
      }
    }
    return this.normalize(result);
  },

  // 判断是否为绝对路径，支持 Posix 和 Windows 风格 (不检查path合法性/存在性等)
  isAbsolute(path: string): boolean {
    return path.startsWith('/') || (path.length >= 2 && path[1] === ':');
  },

  // 返回 childPath 相对于 basePath 的相对路径
  // 两者均应为绝对路径  
  relative(basePath: string, childPath: string): string {
    basePath = PathUtils.toPosixPath(basePath);
    childPath = PathUtils.toPosixPath(childPath);

    basePath = basePath.replace(REGEX_SLASHES, SEP);
    childPath = childPath.replace(REGEX_SLASHES, SEP);

    // 去掉末尾斜杠
    if (basePath.length > 1 && basePath.endsWith(SEP)) basePath = basePath.slice(0, -1);
    if (childPath.length > 1 && childPath.endsWith(SEP)) childPath = childPath.slice(0, -1);

    // 分割路径，不处理 "." 和 ".."
    const baseParts = basePath.split(SEP).filter(p => p);
    const childParts = childPath.split(SEP).filter(p => p);

    // 找到公共前缀
    let i = 0;
    while (i < baseParts.length && i < childParts.length 
      && baseParts[i] === childParts[i]) {
      i++;
    }

    // 直接拼接剩余部分
    return childParts.slice(i).join(SEP);
  },

  // 返回路径的最后一部分（可选去掉扩展名）
  basename(path: string, ext?: string): string {
    path = PathUtils.toPosixPath(path);
    path = path.replace(REGEX_SLASHES, SEP);

    // 去掉末尾斜杠（如果不是根目录）
    if (path.length > 1 && path.endsWith(SEP))
      path = path.slice(0, -1);

    // 提取最后一段
    const lastPart = path.substring(path.lastIndexOf(SEP) + 1);

    // 如果指定了扩展名，尝试去掉
    if (ext && lastPart.endsWith(ext))
      return lastPart.slice(0, -ext.length);

    return lastPart;
  },

  // 返回路径的目录部分 
  dirname(path: string): string {
    path = PathUtils.toPosixPath(path);
    path = path.replace(REGEX_SLASHES, SEP);

    // 去掉末尾斜杠（如果不是根目录）
    if (path.length > 1 && path.endsWith(SEP))
      path = path.slice(0, -1);

    const lastSepIdx = path.lastIndexOf(SEP);
    if (lastSepIdx === -1)
      return ""; // 没有斜杠，返回空字符串

    if (lastSepIdx === 0)
      return SEP; // 根目录

    return path.slice(0, lastSepIdx);
  },

  extname(path: string): string {
    // 提取最后一个路径段
    const base = this.basename(path);
    // 找到最后一个点
    const i = base.lastIndexOf(".");
    if (i <= 0) return ""; // 无扩展，或隐藏文件如 .gitignore
    return base.slice(i);
  },

};

export const path = PathUtils;
