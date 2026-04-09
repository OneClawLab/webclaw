
export interface Selection {
  from: number;
  to: number;
  total: number;
};

export interface CursorPosition {
  line: number; // 1-based
  col: number;   // 1-based
}

// runtime slice 的状态
export interface RuntimeState {
  selection: Selection;
  cursor: CursorPosition;
  scrollTop: number;
}

export const initialState: RuntimeState = {
  selection: {
    from: 0,
    to: 0,
    total: 0,
  },
  cursor: {
    line: 1,
    col: 1,
  },
  scrollTop: 0,
};

export function isEqualRuntimeState(a: RuntimeState, b: RuntimeState): boolean {
  return (
    a.selection.from === b.selection.from &&
    a.selection.to === b.selection.to &&
    a.selection.total === b.selection.total &&
    a.cursor.line === b.cursor.line &&
    a.cursor.col === b.cursor.col && 
    a.scrollTop === b.scrollTop
  );
}
