import type { FieldState, Field, ImageItem } from './types'

const STORAGE_KEY = 'fieldv1.state'
const STORAGE_SCHEMA = 'field_v1'
const STORAGE_VERSION = 1
const SAVE_DEBOUNCE_MS = 250

type StoredState = {
  schema: string
  version: number
  state: FieldState
}

type LegacyStoredState = {
  version: number
  state: FieldState
}

let saveTimeout: number | undefined
let pendingState: FieldState | null = null

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isField = (value: unknown): value is Field =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.createdAt === 'number' &&
  isStringArray(value.imageIds)

const isImageItem = (value: unknown): value is ImageItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.fieldId === 'string' &&
  typeof value.src === 'string' &&
  typeof value.createdAt === 'number' &&
  (value.note === undefined || typeof value.note === 'string')

const isFieldState = (value: unknown): value is FieldState =>
  isRecord(value) &&
  Array.isArray(value.fields) &&
  Array.isArray(value.images) &&
  value.fields.every(isField) &&
  value.images.every(isImageItem)

export const storageSchema = STORAGE_SCHEMA
export const storageVersion = STORAGE_VERSION

export function loadState(): FieldState | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredState | LegacyStoredState
    if (!isRecord(parsed)) {
      return null
    }

    const schema = 'schema' in parsed ? parsed.schema : STORAGE_SCHEMA
    const version = parsed.version
    const state = parsed.state

    if ('schema' in parsed && typeof schema !== 'string') {
      return null
    }

    if (typeof version !== 'number') {
      return null
    }

    if (schema !== STORAGE_SCHEMA || version !== STORAGE_VERSION) {
      return null
    }

    if (!isFieldState(state)) {
      return null
    }

    return state
  } catch {
    return null
  }
}

export function saveState(state: FieldState) {
  if (typeof window === 'undefined') {
    return
  }

  pendingState = state
  if (saveTimeout) {
    window.clearTimeout(saveTimeout)
  }

  saveTimeout = window.setTimeout(() => {
    if (!pendingState) {
      return
    }
    const payload: StoredState = {
      schema: STORAGE_SCHEMA,
      version: STORAGE_VERSION,
      state: pendingState,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore quota or serialization errors.
    } finally {
      pendingState = null
    }
  }, SAVE_DEBOUNCE_MS)
}

export function clearState() {
  if (typeof window === 'undefined') {
    return
  }
  if (saveTimeout) {
    window.clearTimeout(saveTimeout)
    saveTimeout = undefined
  }
  pendingState = null
  window.localStorage.removeItem(STORAGE_KEY)
}
