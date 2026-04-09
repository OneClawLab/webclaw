import { app } from "electron/main";
import path from "path";
import fs, { existsSync, readFileSync } from 'fs';
import { FORCE_DISABLE_OSEXEC } from "@lib/caps.js";

// 初始化可写的资源子目录（如 kb、workos），如果用户数据目录下不存在该子目录，则从只读副本复制过去
// 不存在时将忽略错误
function init_writable_resources_subdir(path_app: string, path_user: string, subdir: string, nonExistIgnore: boolean = false) {
  const path_dir = path.join(path_user, subdir);
  if (!fs.existsSync(path_dir)) {
    // 取得安装的只读副本路径 (extraResources 里定义的位置)
    const path_dir_readonly = app.isPackaged ? path.join(process.resourcesPath, subdir) : path.join(path_app, subdir);

    // 检查只读副本是否存在，不存在根据指示忽略
    if (!fs.existsSync(path_dir_readonly) && nonExistIgnore)
      return;

    // 复制只读副本到用户数据目录
    try {
      console.log('init resources subdir directory from source:', path_dir_readonly);
      fs.cpSync(path_dir_readonly, path_dir, { recursive: true });
      console.log('Resources subdir directory inited under userData at:', path_dir);
    } catch (error) {
      console.error('Failed to init resources subdir directory:', (error as Error).message);
    }
  }
}

// 初始化应用路径和用户数据路径，返回对象 { path_app, path_user }
// 也会初始化 内部使用的子目录（如 kb 和 workos 目录），确保其可被正常访问
export function init_PATHS(): { path_app: string; path_user: string } {
  const isPackaged = app.isPackaged;
  const path_app = isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath();
  const path_user = isPackaged ? path.join(app.getPath('documents'), 'WebClaw') : path_app;

  // 初始化 kb 目录
  init_writable_resources_subdir(path_app, path_user, 'kb', false);

  // 初始化 workos 目录 (忽略错误)
  if (!FORCE_DISABLE_OSEXEC)
    init_writable_resources_subdir(path_app, path_user, 'workos', true);

  return { path_app, path_user };
}

// 简单的解析 .env 文件内容，返回键值对对象
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  const lines = content.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // 去掉 export / export const 
    if (line.startsWith('export ') || line.startsWith('export const ')) {
      line = line.slice(7).trim();
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // 去掉引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

// 加载环境变量，从 .env 或 webclaw.env 文件加载
// 返回键值对对象，加载失败或文件不存在时返回 null
export function initEnvVars(isDev: boolean, path_app: string, path_user: string): Record<string, string> | null {
  try{
    // 开发模式下 期望 .env 或 webclaw.env 放在 path_app 根目录
    // 生产模式下 期望 .env 或 webclaw.env 放在 path_user 根目录
    let envFilePath = isDev ? path.join(path_app, '.env') : path.join(path_user, '.env');
    if (!existsSync(envFilePath)) {
      envFilePath = isDev ? path.join(path_app, 'webclaw.env') : path.join(path_user, 'webclaw.env');
      if (!existsSync(envFilePath)) {
        console.warn(`@@@3 Main scrpit starting (env file): Env file not found at ${envFilePath}`);
        return null;
      }
    }
    console.info(`@@@3 Main scrpit starting (env file): try to load env vars from ${envFilePath}`);
    const envFileContent = readFileSync(envFilePath, { encoding: 'utf-8' });
    const envVars: Record<string, string> = parseEnvFile(envFileContent);
    // 打印加载的 env 变量，开发模式下打印全部值，生产模式下只打印 key 列表
    console.info(`@@@3 Main scrpit starting (env file): Loaded env vars from ${envFilePath}:`, isDev ? envVars : Object.keys(envVars));
    return envVars;
  } catch(err) {
    console.error('@@@3 Main scrpit starting (env file): Failed to load env vars:', err);
    return null;
  }
}
