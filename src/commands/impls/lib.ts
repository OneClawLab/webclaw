import { Logger, Assert } from '@lib/logast.js'

import { defineCommand, defineCommandGroup } from '@commands/registry.js';
import { getAppDispatch, getState } from '@state/storeHolder.js';

defineCommandGroup({
  id: 'library',
  title: 'Library Commands',
  commands: []
});

// Define commands for library operations

