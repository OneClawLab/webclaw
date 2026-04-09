import { Logger, Assert } from '@lib/logast.js'
import { uniqueid } from '@lib/id.js'

import type { LibMeta, LibModel } from './types.js'
import { path } from '@lib/path.js'

// LibraryId 生成函数，TODO 目前为了方便调试，暂定长度为5
export const uniqueLibraryId = () => uniqueid(5);

export class LibraryFactory {
  static async create(libPath: string): Promise<LibModel> {
    try {
      const meta: LibMeta = {
        id: uniqueLibraryId(),
        name: path.basename(libPath),
        description: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await this.save(meta, libPath);
      return { path: libPath, meta };
    } catch (err) {
      Logger.error('library', 'create library failed: ', err);
      throw err
    }
  }

  static async load(libPath: string): Promise<LibModel> {
    try {   
      const libFilePath = path.join(libPath, '.library.json');
      const jsonStr = await window.fs.readText(libFilePath)
      const json = JSON.parse(jsonStr)

      return {
        path: libPath,      // 把路径存起来
        meta: json as LibMeta,
      }
    } catch (err) {
      Logger.error('library', 'load library failed: ', err);
      throw err
    }
  }

  static async save(libMeta: LibMeta, libPath: string): Promise<void> {
    try {
      // 更新修改时间
      libMeta.updatedAt = Date.now()
      const jsonStr = JSON.stringify(libMeta, null, 2)

      Logger.info('LibraryFactory', `Saving library: ${libMeta.id} to ${libPath}`);

      const libFilePath = path.join(libPath, '.library.json');
      await window.fs.writeText(libFilePath, jsonStr)
    } catch (err) {
      Logger.error('library', 'save library failed: ', err);
      throw err
    }
  }
}
