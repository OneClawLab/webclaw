import { Dispatch, Middleware } from "@reduxjs/toolkit";
import type { RootState } from '@state/types.js'

// 一个 Redux Middleware 是一个三层高阶函数。
// 用于包裹 dispatch 流程，拦截或增强 dispatch(action) 的行为。
//
// Example Usage:
//  import { AppMiddleware } from "@state/types/middleware";
//
//  @param api - The Redux API object containing `getState`.
//  @param next - The next middleware in the chain.
//  @param action - The action being dispatched.
//  @returns A function that takes the next middleware in the chain.
//
//  const exampleMiddleware: AppMiddleware = (api) => (next) => (action) => {
//    // Middleware logic here
//    return next(action);
//  }
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type AppMiddleware<S = RootState, D extends Dispatch = Dispatch> = Middleware<{}, S, D>;

export type { AppMiddleware };
