import type { createStore } from './store.js'
export type { RootState } from './reducers.js'

export type AppStore = ReturnType<typeof createStore>
export type AppDispatch = AppStore['dispatch']
