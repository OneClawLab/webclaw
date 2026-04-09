import { Logger } from './logger.js'

function getCallerLocation(): string {
  const err = new Error()
  if (!err.stack) return ''
  const stackLines = err.stack.split('\n')
  const caller = stackLines[4] || stackLines[3] || stackLines[2] // 可能因为 inline 调用位置不同
  return caller?.trim() || ''
}

function fail(message: string): never {
  const location = getCallerLocation()
  Logger.error(`[Assert] ${message}\n→ at ${location}`)
  throw new Error(message)
}

export const Assert = {
  fail(message: string) {
    fail(message)
  },

  isNull(value: any, message = 'Expected value to be null or undefined') {
    if (value !== null && value !== undefined) {
      fail(message)
    }
  },
  
  notNull(value: any, message = 'Expected value to be non-null and non-undefined') {
    if (value === null || value === undefined) {
      fail(message)
    }
  },

  notEmpty(value: string | unknown[], message = 'Expected value to be non-empty') {
    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '')) {
      fail(message)
    }
  },

  isDefined(value: unknown, message = 'Expected value to be defined') {
    if (value === undefined) {
      fail(message)
    }
  },

  isFunction(value: unknown, message = 'Expected value to be a function') {
    if (typeof value !== 'function') {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isObject(value: unknown, message = 'Expected value to be an object') {
    if (typeof value !== 'object' || value === null) {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isString(value: unknown, message = 'Expected value to be a string') {
    if (typeof value !== 'string') {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isNumber(value: unknown, message = 'Expected value to be a number') {
    if (typeof value !== 'number' || isNaN(value)) {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isBoolean(value: unknown, message = 'Expected value to be a boolean') {
    if (typeof value !== 'boolean') {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isArray(value: unknown, message = 'Expected value to be an array') {
    if (!Array.isArray(value)) {
      fail(message + ': ' + JSON.stringify(value))
    }
  },

  isInstanceOf<T>(value: unknown, constructor: new (...args: any[]) => T, message?: string) {
    if (!(value instanceof constructor)) {
      fail(message || `Expected value to be an instance of ${constructor.name}: ` + JSON.stringify(value))
    }
  },

  isTrue(condition: unknown, message = 'Expected condition to be true') {
    if (!condition) {
      fail(message)
    }
  },

  isFalse(condition: unknown, message = 'Expected condition to be false') {
    if (condition) {
      fail(message)
    }
  },

  // check identify equality
  equal<T>(a: T, b: T, message?: string) {
    if (a !== b) {
      fail(message || `Expected ${a} === ${b}`)
    }
  },

  notEqual<T>(a: T, b: T, message?: string) {
    if (a === b) {
      fail(message || `Expected ${a} !== ${b}`)
    }
  },  

  // check value equality
  deepEqual<T>(a: T, b: T, message?: string) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      fail(message || `Expected ${JSON.stringify(a)} to deeply equal ${JSON.stringify(b)}`)
    }
  },

  notDeepEqual<T>(a: T, b: T, message?: string) {
    if (JSON.stringify(a) === JSON.stringify(b)) {
      fail(message || `Expected ${JSON.stringify(a)} to not deeply equal ${JSON.stringify(b)}`)
    }
  },

  never(x: never, message = 'Unexpected value') {
    fail(message + ': ' + JSON.stringify(x))
  },

  unreachable(message = 'Unreachable code reached') {
    fail(message)
  }
}

// 让使用者可以这样用 import assert from '...'
export default Assert;
