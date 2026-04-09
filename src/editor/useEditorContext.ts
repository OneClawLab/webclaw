import { createContext, useContext } from 'react'
import type { EditorView } from '@codemirror/view'

// 用于将当前focus的Editor的相关信息同步到EditorToolbar
export interface EditorContextValue {
  docId: string;
  viewId: string;

  view: EditorView | null;

  runCommand: <TArgs = void>(id: string, args: TArgs extends void ? void : TArgs) => void;
  isCommandActive: (id: string) => boolean;
  isCommandEnabled: (id: string) => boolean;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used within <ChatEditor>');
  return ctx;
};

export { EditorContext };
