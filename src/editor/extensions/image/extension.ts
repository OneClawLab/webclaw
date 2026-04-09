import { Assert, Logger } from "@lib/logast.js"
import { keymap } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"
import { rafChain } from "@editor/RafChain.js"
import { ViewPlugin, Decoration, DecorationSet, EditorView, WidgetType, ViewUpdate } from "@codemirror/view"
import { RangeSetBuilder, Extension, StateEffect, StateField } from "@codemirror/state"
import { syntaxTree, ensureSyntaxTree, syntaxTreeAvailable } from "@codemirror/language"

/* =========================
 * Types
 * ========================= */

type ImageKey = string
type ImageStatus = "raw" | "rendered"
type ImageStatusMap = Map<ImageKey, ImageStatus>

type ImageEntry = {
  key: ImageKey
  from: number
  to: number
  src: string
  alt: string
  height: number // 图片高度（px）
  attributeEnd: number // 属性结束位置（包含 {height=...}）
}

type ImageIndex = {
  images: ImageEntry[]
}

function makeImageKey(from: number, to: number): ImageKey {
  return `${from}-${to}`
}

/* =========================
 * Image src resolver
 * ========================= */

function resolveImageSrc(raw: string): string | null {
  if (!raw) return null

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw
  }

  if (raw.startsWith("rs://")) {
    return `/__rs_proxy__/${raw.slice(5)}`
  }

  if (raw.startsWith("@")) {
    return `/__at_proxy__/${raw.slice(1)}`
  }

  return raw
}

/**
 * 解析图片高度属性
 * 支持格式：{height=100px} 或 {height=100}
 * 返回：{ height: number, matchLength: number }
 */
function parseImageHeight(text: string): { height: number; matchLength: number } {
  // 匹配 {height=数字} 或 {height=数字px}
  const match = text.match(/\{height=(\d+)(?:px)?\}/i)
  if (match) {
    const height = parseInt(match[1], 10)
    const matchLength = match[0].length
    // Logger.debug(`Parsed height: ${height} (length: ${matchLength}) from text: "${text.substring(0, 100)}"`)
    return { height, matchLength }
  }
  // Logger.debug(`No height found in text: "${text.substring(0, 100)}", using default 100`)
  return { height: 100, matchLength: 0 } // 默认高度 100px，无额外长度
}

/* =========================
 * Build Image Index
 * ========================= */

function buildImageIndex(view: EditorView): ImageIndex {
  const { state } = view
  const doc = state.doc

  const images: ImageEntry[] = []

  // 只扫描 viewport 附近，避免全文遍历
  const marginChars = 2000
  const from = Math.max(0, view.viewport.from - marginChars)
  const to = Math.min(doc.length, view.viewport.to + marginChars)

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      if (node.name !== "Image") return

      const imageFrom = node.from
      const imageTo = node.to

      let alt = ""
      let url = ""

      // 先尝试直接从文本中提取 alt（![alt](url) 格式）
      const imageText = doc.sliceString(imageFrom, imageTo)
      // Logger.debug(`Image node text: "${imageText}"`)
      
      // 匹配 ![alt](url) 格式
      const match = imageText.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
      if (match) {
        alt = match[1] || ""
        url = match[2] || ""
        // Logger.debug(`Regex extracted - alt: "${alt}", url: "${url}"`)
      } else {
        // 如果正则匹配失败，尝试遍历子节点
        const cur = (node.node as SyntaxNode).cursor()
        cur.iterate((n) => {
          // Logger.debug(`  Child node: ${n.name} [${n.from}, ${n.to}] = "${doc.sliceString(n.from, n.to)}"`)
          if (n.name === "ImageAlt") {
            const rawAlt = doc.sliceString(n.from, n.to)
            alt = rawAlt.replace(/^\[|\]$/g, '')
            // Logger.debug(`  ImageAlt raw: "${rawAlt}" cleaned: "${alt}"`)
          } else if (n.name === "URL") {
            url = doc.sliceString(n.from, n.to)
            Logger.debug(`  URL: "${url}"`)
          }
        })
      }

      const src = resolveImageSrc(url)
      if (!src) return

      // 获取图片后面可能的属性文本（向后查找最多50个字符）
      const afterImageEnd = Math.min(imageTo + 50, doc.length)
      const fullText = doc.sliceString(imageTo, afterImageEnd)
      const { height, matchLength } = parseImageHeight(fullText)
      
      // 计算实际结束位置（包含属性）
      const attributeEnd = imageTo + matchLength

      // Logger.debug(`Image found: [${imageFrom}, ${imageTo}] attributeEnd=${attributeEnd} height=${height} alt="${alt}"`)

      images.push({
        key: makeImageKey(imageFrom, attributeEnd),
        from: imageFrom,
        to: imageTo,
        src,
        alt,
        height,
        attributeEnd
      })
    }
  })

  images.sort((a, b) => a.from - b.from)
  return { images }
}

/* =========================
 * Caret Hit Detection
 * ========================= */

/**
 * 判断 caret 是否"在 image 内部或相邻行"
 */
function caretHitsOrTouchesImage(view: EditorView, pos: number, image: ImageEntry): boolean {
  const doc = view.state.doc
  
  // 检查光标是否在图片范围内
  if (pos >= image.from && pos <= image.attributeEnd) return true
  
  // 检查光标是否在图片的上一行或下一行
  const cursorLine = doc.lineAt(pos).number
  const startLine = doc.lineAt(image.from).number
  const endLine = doc.lineAt(image.attributeEnd).number
  
  return cursorLine === startLine - 1 || cursorLine === endLine + 1
}

/**
 * 找到"caret 命中或紧贴"的 image（优先最近）
 */
function findNearestHitOrTouchImage(view: EditorView, pos: number, index: ImageIndex): ImageEntry | null {
  Assert.notNull(view)
  let best: ImageEntry | null = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const img of index.images) {
    if (!caretHitsOrTouchesImage(view, pos, img)) continue

    const dist = pos < img.from ? (img.from - pos) : (pos > img.to ? (pos - img.to) : 0)
    if (dist < bestDist || (dist === bestDist && best && img.from < best.from)) {
      best = img
      bestDist = dist
    }
  }
  return best
}

/* =========================
 * Keyboard Navigation
 * ========================= */

/**
 * 处理向下箭头键：在 raw 模式下，如果光标在图片 markdown 语法行，跳过图片 widget
 */
function handleArrowDown(view: EditorView): boolean {
  const index = view.state.field(imageIndexField)
  const statusMap = view.state.field(imageStatusField)
  const selection = view.state.selection.main
  const cursorPos = selection.head
  const doc = view.state.doc

  for (const img of index.images) {
    const st = statusMap.get(img.key) ?? "rendered"
    
    // 只处理 raw 模式的图片
    if (st !== "raw") continue

    // 检查光标是否在图片的 markdown 语法行
    const imgLine = doc.lineAt(img.from)
    const cursorLine = doc.lineAt(cursorPos)
    
    if (cursorLine.number === imgLine.number) {
      // 光标在图片语法行，向下移动应该跳过图片 widget，到下一行
      const nextLineNumber = imgLine.number + 1
      if (nextLineNumber <= doc.lines) {
        const nextLine = doc.line(nextLineNumber)
        view.dispatch({
          selection: { anchor: nextLine.from },
          scrollIntoView: true
        })
        return true
      }
    }
  }

  return false
}

/**
 * 处理向上箭头键：在 raw 模式下，如果光标在图片下一行，跳到图片语法行
 */
function handleArrowUp(view: EditorView): boolean {
  const index = view.state.field(imageIndexField)
  const statusMap = view.state.field(imageStatusField)
  const selection = view.state.selection.main
  const cursorPos = selection.head
  const doc = view.state.doc

  for (const img of index.images) {
    const st = statusMap.get(img.key) ?? "rendered"
    
    // 只处理 raw 模式的图片
    if (st !== "raw") continue

    // 检查光标是否在图片的下一行
    const imgLine = doc.lineAt(img.from)
    const cursorLine = doc.lineAt(cursorPos)
    
    if (cursorLine.number === imgLine.number + 1) {
      // 光标在图片下一行，向上移动应该到图片语法行的末尾
      view.dispatch({
        selection: { anchor: imgLine.to },
        scrollIntoView: true
      })
      return true
    }
  }

  return false
}

const imageNavigationKeymap = keymap.of([
  {
    key: "ArrowDown",
    run: handleArrowDown
  },
  {
    key: "ArrowUp",
    run: handleArrowUp
  }
])

/* =========================
 * Image Widget
 * ========================= */

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly from: number,
    readonly to: number,
    readonly height: number,
    readonly isInline: boolean = false, // 是否是行内 widget（raw 模式）
    readonly view?: EditorView // 用于计算高度
  ) {
    super()
  }

  // 报告 widget 的估计高度
  get estimatedHeight(): number {
    if (this.isInline) {
      // raw模式下caption高度为0
      return this.height
    }
    // rendered模式下计算caption的实际高度
    const captionHeight = this.alt && this.alt.trim() ? 19.59 : 0
    return this.height + captionHeight
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div")
    wrap.className = "cm-md-image-wrapper"
    wrap.setAttribute("contenteditable", "false")
    
    if (this.isInline) {
      // raw 模式：使用 inline-block，避免额外的行高
      wrap.style.display = "inline-block"
      wrap.style.width = "100%"
      wrap.style.margin = "0"
      wrap.style.padding = "0"
      wrap.style.lineHeight = "0"
      wrap.style.verticalAlign = "top" // 防止基线对齐导致的额外空间
      wrap.style.cursor = "default"
    } else {
      // rendered 模式：使用 block 布局
      wrap.style.display = "block"
      wrap.style.width = "100%"
      wrap.style.margin = "0"
      wrap.style.padding = "0"
      wrap.style.lineHeight = "0"
      wrap.style.cursor = "pointer"
    }

    // 图片容器
    const imgContainer = document.createElement("div")
    imgContainer.style.display = "block"
    imgContainer.style.width = "100%"
    imgContainer.style.margin = "0"
    imgContainer.style.padding = "0"
    imgContainer.style.lineHeight = "0" // 消除容器的行高

    const img = document.createElement("img")
    img.src = this.src
    img.alt = this.alt
    img.loading = "lazy"
    img.style.maxWidth = "100%"
    img.style.height = `${this.height}px`
    img.style.objectFit = "contain"
    img.style.display = "block"
    img.style.margin = "0 auto" // 图片居中
    img.style.padding = "0"
    img.style.border = "none"

    imgContainer.appendChild(img)

    // 在两种模式下都显示caption，保持高度一致
    if (this.alt && this.alt.trim()) {
      const caption = document.createElement("div")
      caption.className = "cm-md-image-caption"
      caption.textContent = this.alt
      caption.style.textAlign = "center"
      caption.style.fontSize = "13px" // 固定字体大小
      caption.style.color = "var(--vscode-descriptionForeground, #888)"
      caption.style.margin = "0"
      caption.style.padding = "0"
      caption.style.fontStyle = "italic"
      caption.style.width = "100%" // 确保占据整行宽度
      caption.style.display = "block" // 确保是块级元素
      caption.style.overflow = "hidden" // 防止内容溢出
      caption.style.whiteSpace = "nowrap" // 单行显示
      caption.style.textOverflow = "ellipsis" // 超出显示省略号
      
      if (this.isInline) {
        // raw模式下让caption高度为0，不占据空间
        caption.style.height = "0"
        caption.style.lineHeight = "0"
        caption.style.visibility = "hidden"
      } else {
        // rendered模式下正常显示
        caption.style.height = "19.59px"
        caption.style.lineHeight = "19.59px"
      }
      
      imgContainer.appendChild(caption)
    }

    wrap.appendChild(imgContainer)

    // 只在 rendered 模式下添加点击事件
    if (!this.isInline) {
      wrap.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return
        e.preventDefault()

        const key = makeImageKey(this.from, this.to)
        
        // 切换到 raw 模式，并将光标放在图片开始位置
        view.dispatch({
          effects: setImageStatusEffect.of({ key, status: "raw" }),
          selection: { anchor: this.from }
        })
      })
    }

    return wrap
  }

  eq(other: ImageWidget) {
    return (
      this.src === other.src &&
      this.alt === other.alt &&
      this.from === other.from &&
      this.to === other.to &&
      this.height === other.height &&
      this.isInline === other.isInline
    )
  }

  ignoreEvent(_event: Event): boolean {
    return false
  }
}

/* =========================
 * Compute Decorations
 * ========================= */

function computeImageDecorationsFromIndex(
  view: EditorView,
  index: ImageIndex,
  statusMap: ImageStatusMap
): DecorationSet {
  Assert.notNull(view)
  const builder = new RangeSetBuilder<Decoration>()

  const vpFrom = view.viewport.from
  const vpTo = view.viewport.to

  // 只对 viewport 内的 images produce decorations
  for (const img of index.images) {
    if (img.attributeEnd < vpFrom || img.from > vpTo) continue

    const st = statusMap.get(img.key) ?? "rendered"
    
    if (st === "rendered") {
      // rendered 模式：使用 replace 装饰，隐藏原始文本，只显示图片 + alt
      builder.add(
        img.from,
        img.attributeEnd,
        Decoration.replace({
          widget: new ImageWidget(img.src, img.alt, img.from, img.attributeEnd, img.height, false, view)
        })
      )
    } else {
      // raw 模式：在原始文本后面添加图片 widget，保持原始文本可编辑
      builder.add(
        img.attributeEnd,
        img.attributeEnd,
        Decoration.widget({
          widget: new ImageWidget(img.src, img.alt, img.from, img.attributeEnd, img.height, true, view),
          side: 1 // 放在文本后面
          // 不设置 block: true，让它成为 inline widget，避免额外的行高
        })
      )
    }
  }

  return builder.finish()
}

/* =========================
 * State Fields
 * ========================= */

// 1) imageIndexField：只在 docChanged 时重建
const imageIndexField = StateField.define<ImageIndex>({
  create(state) {
    return { images: [] }
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setImageIndexEffect)) return e.value
    }
    return value
  }
})

const setImageIndexEffect = StateEffect.define<ImageIndex>()

// 2) imageStatusField：保存每个 image key 的 raw/rendered 状态
const imageStatusField = StateField.define<ImageStatusMap>({
  create() {
    return new Map()
  },
  update(value, tr) {
    let next = value

    // docChanged 后，旧 key 集合可能失效；做一次清理
    let newIndex: ImageIndex | null = null
    for (const e of tr.effects) {
      if (e.is(setImageIndexEffect)) newIndex = e.value
    }
    if (newIndex) {
      const alive = new Set(newIndex.images.map(img => img.key))
      let changed = false
      for (const k of next.keys()) {
        if (!alive.has(k)) {
          if (!changed) next = new Map(next)
          changed = true
          next.delete(k)
        }
      }
    }

    for (const e of tr.effects) {
      if (e.is(setImageStatusEffect)) {
        const { key, status } = e.value
        const cur = next.get(key)
        if (cur === status) continue
        if (next === value) next = new Map(next)
        next.set(key, status)
      } else if (e.is(setManyImageStatusEffect)) {
        if (next === value) next = new Map(next)
        for (const { key, status } of e.value) next.set(key, status)
      }
    }
    return next
  }
})

const setImageStatusEffect = StateEffect.define<{ key: ImageKey; status: ImageStatus }>()
const setManyImageStatusEffect = StateEffect.define<Array<{ key: ImageKey; status: ImageStatus }>>()

// 3) decorations field
const setImageDecosEffect = StateEffect.define<DecorationSet>()

const imageDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(deco: DecorationSet, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setImageDecosEffect)) return e.value
    }
    return deco
  },
  provide: f => EditorView.decorations.from(f)
})

/* =========================
 * ViewPlugin
 * ========================= */

const imageVP = ViewPlugin.fromClass(
  class {
    initialized = false
    view: EditorView
    updating = false
    lastSyntaxTreeReady = false

    constructor(view: EditorView) {
      this.view = view
    }

    update(update: ViewUpdate) {
      Assert.notNull(update.view)
      this.view = update.view

      if (this.updating) return

      rafChain().then(() => {
        try {
          this.updating = true

          const effects: StateEffect<any>[] = []
          let index = this.view.state.field(imageIndexField)
          let statusMap = this.view.state.field(imageStatusField)

          // 重建 ImageIndex 的时机
          const needRebuildIndex =
            !this.initialized ||
            update.docChanged ||
            update.viewportChanged ||
            !this.lastSyntaxTreeReady
          if (needRebuildIndex) {
            this.initialized = true
            ensureSyntaxTree(this.view.state, this.view.viewport.to, 50)
            this.lastSyntaxTreeReady = syntaxTreeAvailable(this.view.state, this.view.viewport.to)
            index = buildImageIndex(this.view)
            effects.push(setImageIndexEffect.of(index))
          }

          // 更新 ImageStatus 的时机
          const needUpdateStatus = needRebuildIndex || update.selectionSet || update.docChanged
          if (needUpdateStatus) {
            const caret = this.view.state.selection.main.head
            const hit = findNearestHitOrTouchImage(this.view, caret, index)
            if (hit) {
              Logger.debug(`ImageVP: caret at ${caret} hits/touches image [${hit.from},${hit.to}]`)
            }

            // 规则：只让"当前命中/紧贴"的 image 为 raw，其它一律恢复 rendered
            const nextStatusMap = new Map<ImageKey, ImageStatus>()
            if (hit) nextStatusMap.set(hit.key, "raw")

            statusMap = nextStatusMap
            effects.push(
              setManyImageStatusEffect.of(
                Array.from(statusMap.entries()).map(([key, status]) => ({ key, status }))
              )
            )
          }

          const needRebuildDecos = needRebuildIndex || needUpdateStatus || update.viewportChanged
          if (needRebuildDecos) {
            const deco = computeImageDecorationsFromIndex(this.view, index, statusMap)
            effects.push(setImageDecosEffect.of(deco))
          }

          if (effects.length) this.view.dispatch({ effects })
        } finally {
          this.updating = false
        }
      })
    }
  }
)

/* =========================
 * 导出
 * ========================= */

export const imageExtension: Extension = [
  imageIndexField,
  imageStatusField,
  imageDecoField,
  imageNavigationKeymap,
  imageVP
]
