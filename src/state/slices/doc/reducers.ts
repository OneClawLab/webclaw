import { Logger } from '@lib/logast.js'
import type { PayloadAction } from '@reduxjs/toolkit'
import { Draft } from 'immer'
import { CtxUsage, Doc, DocState, LibraryDoc } from './types.js';
import { DocUtils } from './utils.js';

// 一般用于新建/打开一个文档时，向 state 中添加一个 doc
const addDoc = (state: Draft<DocState>, action: PayloadAction<{ doc: Doc }>) => {
  const { doc } = action.payload;
  const docId = DocUtils.docId(doc);
  Logger.debug('docSlice', `addDoc: ${docId}`);
  state.docs[docId] = doc;  
}

// 一般用于所有该文档对应的Tab被关闭时，会从 state 中移除该 doc
const removeDoc = (state: Draft<DocState>, action: PayloadAction<{ docId: string }>) => {
  const { docId } = action.payload;
  Logger.debug('docSlice', `removeDoc: ${docId}`);
  delete state.docs[docId];
}

// 一般用于更新某个已存在的文档信息时
// 尤其是 unsaved doc 被保存时 变为 library/external doc 时
const updateDoc = (state: Draft<DocState>, action: PayloadAction<{ docId: string, doc: Doc }>) => {
  const { docId, doc } = action.payload;
  const newDocId = DocUtils.docId(doc);
  Logger.debug('docSlice', `updateDoc: ${docId} -> ${newDocId}`);
  if (docId !== newDocId)
    delete state.docs[docId];
  state.docs[newDocId] = doc;
}

const setConversationId = (state: Draft<DocState>, action: PayloadAction<{ docId: string, conversationId: string }>) => {
  const { docId, conversationId } = action.payload;
  const doc = state.docs[docId];
  if (doc) {
    doc.conversationId = conversationId;
  }
}

const setAgentId = (state: Draft<DocState>, action: PayloadAction<{ docId: string, agentId: string }>) => {
  const { docId, agentId } = action.payload;
  const doc = state.docs[docId];
  if (doc) {
    doc.agentId = agentId;
  }
}

const lockAgent = (state: Draft<DocState>, action: PayloadAction<{ docId: string }>) => {
  const { docId } = action.payload;
  const doc = state.docs[docId];
  if (doc) {
    doc.agentLocked = true;
  }
}

// 按 conversationId 更新 ctxUsage（StatusBar 显示上下文用量）
const setCtxUsageByConversationId = (state: Draft<DocState>, action: PayloadAction<{ conversationId: string, ctxUsage: CtxUsage }>) => {
  const { conversationId, ctxUsage } = action.payload;
  for (const doc of Object.values(state.docs)) {
    if (doc.conversationId === conversationId) {
      doc.ctxUsage = ctxUsage;
      break;
    }
  }
}

export function buildReducers() {
  return {
    addDoc,
    removeDoc,
    updateDoc,
    setConversationId,
    setAgentId,
    lockAgent,
    setCtxUsageByConversationId,
  }
}
