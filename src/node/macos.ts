/////////////// macOS 原生菜单构建 ///////////////
import { mac_acc, t } from '@lib/i18n.js';
import { app } from 'electron';
import { Menu, MenuItemConstructorOptions } from 'electron/main';
type MenuItemClickHandler = (appCommandId: string) => void;

export function buildMacAppMenu(handler: MenuItemClickHandler = () => {}): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'WebClaw',
      submenu: [ 
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: t('ui.menus.app.library.title'),
      submenu: [
        { label: t('ui.menus.app.library.createLibrary'), 
          accelerator: mac_acc(t('ui.menus.app.library.createLibraryShortcut')), 
          click: () => handler('workspace/createLibrary') },
        { label: t('ui.menus.app.library.addLibrary'), 
          accelerator: mac_acc(t('ui.menus.app.library.addLibraryShortcut')), 
          click: () => handler('workspace/addLibrary') },
        { type: 'separator' },
        { label: t('ui.menus.app.library.saveLibrary'), 
          accelerator: mac_acc(t('ui.menus.app.library.saveLibraryShortcut')), 
          click: () => handler('workspace/saveLibrary') },
        { label: t('ui.menus.app.library.removeLibrary'), 
          accelerator: mac_acc(t('ui.menus.app.library.removeLibraryShortcut')), 
          click: () => handler('workspace/removeLibrary') },
      ]
    },
    {
      label: t('ui.menus.app.document.title'),
      submenu: [
        { label: t('ui.menus.app.document.newDocument'), 
          accelerator: mac_acc(t('ui.menus.app.document.newDocumentShortcut')), 
          click: () => handler('tab/new') },
        { label: t('ui.menus.app.document.openDocument'), 
          accelerator: mac_acc(t('ui.menus.app.document.openDocumentShortcut')), 
          click: () => handler('document/open') },
        { label: t('ui.menus.app.document.saveDocument'), 
          accelerator: mac_acc(t('ui.menus.app.document.saveDocumentShortcut')), 
          click: () => handler('tab/save') },
        { label: t('ui.menus.app.document.closeDocument'),
          accelerator: mac_acc(t('ui.menus.app.document.closeDocumentShortcut')),
          click: () => handler('tab/close') },
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }  
  ];
  return Menu.buildFromTemplate(template);
}

export function setMacAboutDialog() {
  app.setAboutPanelOptions({
    applicationName: 'WebClaw',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 WebClaw',
    credits: 'Built with Electron',
    website: 'https://eidux.app/'
  });  
}