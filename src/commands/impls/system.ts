import { k18, t } from '@lib/i18n.js';
import { defineCommand, defineCommandGroup } from '@commands/registry.js'
import { Logger } from '@lib/logast.js';
import { notification } from '@lib/renderer/dialog.js';
import { isFeatureEnabled, VERSION_CHECK_FOR_UPDATES } from '@state/slices/settings/types.js';
import { getState } from '@state/storeHolder.js';

defineCommandGroup({
  id: 'system',
  title: k18('commands.system.title'),
  commands: []
});

//------------------------------------------------------------------

defineCommand({
  id: 'system/showInExplorer',
  group: 'system',
  title: k18('commands.system.commands.showInExplorer'),
  description: k18('commands.system.commands.showInExplorerDesc'),
  icon: 'FolderOpen',
  async run(args: { fullPath: string }) {
    const { fullPath } = args;
    await window.ui.showInExplorer(fullPath);
  }
});

defineCommand({
  id: 'system/openInBrowser',
  group: 'system',
  title: k18('commands.system.commands.openInBrowser'),
  description: k18('commands.system.commands.openInBrowserDesc'),
  icon: 'ExternalLink',
  async run(args: { link: string }) {
    const { link } = args;

    if (!link || typeof link !== 'string') return;

    // Basic safety/validation: only allow http/https
    try {
      const u = new URL(link);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;

      await window.ui.openExternal(u.toString());
    } catch {
      // ignore invalid URL
    }
  }
});

defineCommand({
  id: 'system/updateReady',
  group: 'system',
  title: k18('commands.system.commands.updateReady'),
  icon: 'Update',
  run(args: any) {
    const { version, releaseName, releaseDate, releaseNotes } = args;
    Logger.debug('system/updateReady command called with args:', args);

    const checkForUpdates = isFeatureEnabled(getState().settings.checkForUpdates, VERSION_CHECK_FOR_UPDATES);
    checkForUpdates && notification.show({
      type: 'info',
      title: t('ui.components.notifications.updateReadyTitle'),
      msg: t('ui.components.notifications.updateReadyMessage', { version, releaseName, releaseDate, releaseNotes }),
      actions: [
        {
          label: t('ui.components.notifications.updateReadyActionLabel'),
          command: 'system/quitAndInstallUpdate',
        },
      ],
    });
  }
});

defineCommand({
  id: 'system/quitAndInstallUpdate',
  group: 'system',
  title: 'Quit and Install Update',
  icon: 'Restart',
  run() {
    window.ui.quitAndInstallUpdate();
  }
});
