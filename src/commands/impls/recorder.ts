import { k18 } from '@lib/i18n.js';
import { defineCommand, defineCommandGroup, dispatchAppCommand } from '@commands/registry.js'
import { Recorder } from '@lib/recorder.js';
import { getState } from '@state/storeHolder.js';
import { theFocusManager, theViewManager } from '@view/index.js';

defineCommandGroup({
  id: 'recorder',
  title: k18('commands.recorder.title'),
  commands: []
});

//------------------------------------------------------------------

defineCommand({
  id: 'recorder/exportAppState',
  group: 'recorder',
  title: k18('commands.recorder.commands.exportAppState'),
  icon: 'Info',
  run(args) {
    const state = getState();
    const md = Recorder.doc('state', 'default', true);

    const redux = md.heading('Redux State');
      const workspace = redux.heading('workspace');
      const ui = redux.heading('ui');
      const lib = redux.heading('lib');
      const doc = redux.heading('doc');
      const tab = redux.heading('tab');
      const tree = redux.heading('tree');
      const dialog = redux.heading('dialog');
      const runtime = redux.heading('runtime');

      workspace.text(`id = ${state.workspace.id}`);
      workspace.text(`userId = ${state.user.userId}`);
      workspace.heading('libPaths').list(state.workspace.libPaths);

      // TODO 让AI来写

    const views = md.heading('Views');
    views.heading('View List').list(theViewManager.getAllViews().map((value) => 
      `type = ${value.type}, id = ${value.id}, methods = ${Object.keys(value.methods).join('/')}`
    ));
    views.heading('Focus Stack').list(theFocusManager._getFocusStack());
    md.save();
  }
});
