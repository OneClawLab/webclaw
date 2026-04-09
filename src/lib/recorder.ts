import { MarkdownBuilder, SaveFileAsync } from "@lib/mdbuilder.js";
import { path } from "@lib/path.js";
import { ELECTRON_CONTEXT } from "@lib/env.js";
import { PATH_KB_SYSTEM_LOGS } from "@lib/paths.js";
import { safeFileName } from "@lib/utils.js";

let saveFileAsync: SaveFileAsync | undefined;

if (ELECTRON_CONTEXT === "main") {
  (async () => {
    const fs = 'Xf'.substring(1) + 'Xs'.substring(1); // 防止被打包工具静态分析到
    const { promises: fsa } = await import(/* @vite-ignore */ fs);
    saveFileAsync = async (fullPath: string, content: string) => {
      await fsa.mkdir(path.dirname(fullPath), { recursive: true });
      await fsa.writeFile(fullPath, content, "utf-8");
    };
  })();
} else {
  saveFileAsync = async (fullPath: string, content: string) => {
    await window.fs.writeText(fullPath, content);
  };
}

// 系统运行日志记录器
// 用于创建和管理系统运行日志文档
// 在 main 进程和 renderer 进程均可使用
export class Recorder {
  // 创建一个新的日志文档(MarkdownBuilder)
  // category: 日志类别（子目录），根路径下的相对路径(不含文件名)
  // title: 日志标题，将用作文件名
  // timestamped: 是否在文件名后添加时间戳，默认为 true
  static doc(category: string, title: string, timestamped: boolean = true): MarkdownBuilder {
    const ts = timestamped ? new Date().toLocaleString() : "";
    const filename = timestamped ? `${title}-${ts}.md` : `${title}.md`;
    const fullPath = path.join(PATH_KB_SYSTEM_LOGS(), category, safeFileName(filename));
    const root = { level: 0, title, children: [] };
    return new MarkdownBuilder(fullPath, root, root, saveFileAsync!);
  }
}
