// 删除不需要的 Electron默认包含的语言包，减小安装包体积
// 注: 这只是 Electron包含的chromium的语言包，和我们的App的语言包无关

import fs from 'fs'
import path from 'path'

/**
 * 保留的语言包，根据需要增删。
 * en-US 是 Electron 默认 fallback，推荐保留。
 * zh-CN 是你可能使用的中文包。
 */
const keepLocales = ['en-US.pak', 'zh-CN.pak']

export default async function removeLocales(context) {
  const appPath = context.appOutDir
  const localesPath = path.join(appPath, 'locales')

  if (!fs.existsSync(localesPath)) {
    console.warn('No locales folder found.')
    return
  }

  const allFiles = fs.readdirSync(localesPath)
  let removed = 0

  for (const file of allFiles) {
    if (!keepLocales.includes(file)) {
      fs.unlinkSync(path.join(localesPath, file))
      removed++
    }
  }

  console.log(`Removed ${removed} unused locale files. Kept: ${keepLocales.join(', ')}`)
}
