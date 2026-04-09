// logger and assert combined for easier import
// only for renderer process.
// Usage:
//  import { Logger, Assert } from '@lib/logast.js'
//  Logger.info('EditorUI', 'User clicked save');
//  Assert.notNull(view, 'Editor view should not be null');

import { Assert } from './assert.js'
import { Logger } from './logger.js'

export { Logger, Assert }
