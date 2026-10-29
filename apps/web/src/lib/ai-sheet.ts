/** Pure view state of the AI helper side sheet. No React, no fetch. */

export type AiFailure = 'disabled' | 'limit' | 'forbidden' | 'unavailable'

export type AiRow = { id: number; question: string; answer: string }

export type AiState = {
  rows: AiRow[]
  streaming: boolean
  failure: AiFailure | null
}

export type AiAction =
  | { type: 'ask'; question: string }
  | { type: 'chunk'; text: string }
  | { type: 'done' }
  | { type: 'stop' }
  | { type: 'fail'; failure: AiFailure }

export const initialAi: AiState = { rows: [], streaming: false, failure: null }

export function reduceAi(state: AiState, action: AiAction): AiState {
  switch (action.type) {
    case 'ask': {
      const question = action.question.trim()
      if (state.streaming || question === '') return state
      const id = (state.rows.at(-1)?.id ?? 0) + 1
      return {
        rows: [...state.rows, { id, question, answer: '' }],
        streaming: true,
        failure: null,
      }
    }
    case 'chunk': {
      const last = state.rows.at(-1)
      if (!state.streaming || !last) return state
      return {
        ...state,
        rows: [
          ...state.rows.slice(0, -1),
          { ...last, answer: last.answer + action.text },
        ],
      }
    }
    case 'done':
    case 'stop':
      return { ...state, streaming: false }
    case 'fail': {
      const last = state.rows.at(-1)
      // An empty answer row would be a dangling question: drop it.
      const rows =
        state.streaming && last && last.answer === ''
          ? state.rows.slice(0, -1)
          : state.rows
      return { rows, streaming: false, failure: action.failure }
    }
  }
}

export function failureForStatus(status: number): AiFailure {
  if (status === 503) return 'disabled'
  if (status === 429) return 'limit'
  if (status === 401 || status === 403 || status === 404) return 'forbidden'
  return 'unavailable'
}
