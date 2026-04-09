import { path } from "@lib/path.js";

////////////////////////////////////////////////////
//// 本地路径定义区域, 代码按目录层级缩进，便于查看 ////
////////////////////////////////////////////////////

////////////////////////////////////////////////////
/// (只读) App 目录定义区域 /////////////////////////
////////////////////////////////////////////////////

let path_app: string | null = null;

export function set_PATH_APP(customPath: string) {
  path_app = customPath;
}

// app 的根目录
// 开发环境下 == workspace 的根目录
// 发布环境下 == 安装后的可执行文件所在目录
export function PATH_APP() : string {
  if (!path_app)
    throw new Error('PATH_APP not set yet!');
  return path_app;
}

// app 代码 使用的 资源，如图标/图片等
export function PATH_ASSETS() : string {
  return path.join(PATH_APP(), 'assets');
}

////////////////////////////////////////////////////
/// (可写) User 目录定义区域 ////////////////////////
////////////////////////////////////////////////////

// user 的根目录
// 开发环境下 == appPath (亦即workspace根目录)
// 发布环境下 == 用户数据目录 (目前为documents/Eidux)

let path_user: string | null = null;

export function set_PATH_USER(customPath: string) {
  path_user = customPath;
}

export function PATH_USER() : string {
  if (!path_user)
    throw new Error('PATH_USER not set yet!');
  return path_user;
}

  // window.storage 接口对应的根目录
  export function PATH_WINDOW_STORAGE() : string {
    return path.join(PATH_USER(), '.webclaw');
  }

  export function PATH_LOGS() : string {
    return path.join(PATH_USER(), 'logs');
  }

  // 综合性数据目录, 存放app运行期间的用户数据等，下设各子目录
  export function PATH_DATA() {
    return path.join(PATH_USER(), 'data');
  }

  // 各内置知识库的根目录
  export function PATH_KBS() {
    return path.join(PATH_USER(), 'kb');
  }

    // kb/system 知识库根目录
    export function PATH_KB_SYSTEM() {
      return path.join(PATH_KBS(), "system");
    }

      // SystemRecorder: 系统运行日志，记录高级别的运行信息，输出到知识库 @kb/system/logs/下。
      export function PATH_KB_SYSTEM_LOGS() {
        return path.join(PATH_KB_SYSTEM(), "logs");
      }

      export function PATH_PROMPTS() {
        return path.join(PATH_KB_SYSTEM(), 'prompts');
      }

      export function PATH_SLASH_COMMANDS() {
        return path.join(PATH_KB_SYSTEM(), 'slash-commands');
      }

      export function PATH_SKILLS() {
        return path.join(PATH_KB_SYSTEM(), 'skills');
      }

    // kb/example 知识库根目录
    export function PATH_KB_EXAMPLE() {
      return path.join(PATH_KBS(), "example");
    }
