import { uniqueid } from '@lib/id.js'
import { Tab } from './types.js';
import { t } from '@lib/i18n.js'

export const TabUtils = {
  // TabId 生成函数，目前为了方便调试，暂定长度为3
  uniqueTabId() { return uniqueid(3) },

  // 工具函数：构造 Tab（带默认值）
  createTab(partial: Partial<Tab>): Tab {
    return {
      id: partial.id ?? TabUtils.uniqueTabId(),
      viewType: partial.viewType ?? 'default',
      docId: partial.docId ?? '',
      _refresh: partial._refresh ?? 0,
      title: partial.title ?? t('defaults.untitled'),
      ignoreDirty: partial.ignoreDirty ?? false,
      _dirty: partial._dirty ?? false,
      status: partial.status ?? 'normal',
      _autoScroll: partial._autoScroll ?? false,
      _editing: partial._editing ?? false,
      pinned: partial.pinned ?? false,
      closable: partial.closable ?? true,
      icon: partial.icon ?? 'NotepadText', // TODO Tab 缺省图标在这里
      meta: partial.meta ?? {},
    };
  },
}
