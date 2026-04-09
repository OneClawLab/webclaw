import React from 'react'
import { withLogging } from '@lib/renderer/withLogging.js'
import { TreeView } from '@renderer/views/TreeView.js'
import { OutlineMADM } from '@renderer/dropdowns/OutlineMADM.js'
import { useAppDispatch, useAppSelector } from '@state/storeHolder.js'
import { LucideIcon } from '@lib/renderer/LucideIcon.js'
import { uiActions } from '@state/slices/ui/slice.js'

function RightActions(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const outlineWidth = useAppSelector(state => state.ui.layout.outlineWidth);

  const onClick = (direction) => { 
    if (direction === 'left')
      dispatch(uiActions.setOutlineWidth(Math.max(outlineWidth * 0.67, 200)));
    else
      dispatch(uiActions.setOutlineWidth(outlineWidth/ 0.67));
  };

  return (
    <div id='RightActions' className="flex items-center space-x-2 pr-0">
      <button className="p-1 hover:bg-gray-200 rounded">
        <LucideIcon name="ArrowLeftToLine" size={16} onClick={() => onClick('left')}/>
      </button>
      <button className="p-1 hover:bg-gray-200 rounded">
        <LucideIcon name="ArrowRightToLine" size={16} onClick={() => onClick('right')}/>
      </button>
      <OutlineMADM />
    </div>
  )
}

function OutlineHeader(): React.JSX.Element {
  return (
    <div id="OutlineHeader" className="flex items-center w-full">
      <div className="flex flex-row flex-1 items-center justify-start overflow-x-hidden min-w-0">
        <LucideIcon name='Library' size={14}/>
        <span className="Light">
          知识库
        </span>
      </div>
      <div className="flex-1"/>
      <div id="RightActionsWrapper" className="ml-auto flex justify-end">
        <RightActions />
      </div>
    </div>
  )
}

function OutlineViewBase(): React.JSX.Element {
  const trees = useAppSelector(state => state.tree.trees);

  return (
    <aside id="OutlineView" className="flex flex-col justify-items-center h-full w-full min-w-0 bg-gray-100 border-r border-gray-200 text-black">
      <OutlineHeader />
      {trees.map((tree) => (
        <TreeView key={tree.header.id} treeId={tree.header.id} />
      ))}
    </aside>
  )
}

export const OutlineView = withLogging(OutlineViewBase, { name: 'OutlineView' });
