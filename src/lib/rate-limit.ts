import { type RateLimits } from '../config'

const STORAGE_KEY = 'quickchat:ratelimits'

interface PeriodCounter {
  count: number
  resetAt: number // unix ms
}

interface RateLimitState {
  day: PeriodCounter
  week: PeriodCounter
  month: PeriodCounter
}

function getResetTime(period: 'day' | 'week' | 'month'): number {
  const now = new Date()
  switch (period) {
    case 'day': {
      const tomorrow = new Date(now)
      tomorrow.setHours(24, 0, 0, 0)
      return tomorrow.getTime()
    }
    case 'week': {
      const nextWeek = new Date(now)
      nextWeek.setDate(now.getDate() + (7 - now.getDay()))
      nextWeek.setHours(0, 0, 0, 0)
      return nextWeek.getTime()
    }
    case 'month': {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return nextMonth.getTime()
    }
  }
}

function freshCounter(period: 'day' | 'week' | 'month'): PeriodCounter {
  return { count: 0, resetAt: getResetTime(period) }
}

function loadState(): RateLimitState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { day: freshCounter('day'), week: freshCounter('week'), month: freshCounter('month') }
  }
  const state = JSON.parse(raw) as RateLimitState
  const now = Date.now()
  // Reset expired counters
  if (now >= state.day.resetAt) state.day = freshCounter('day')
  if (now >= state.week.resetAt) state.week = freshCounter('week')
  if (now >= state.month.resetAt) state.month = freshCounter('month')
  return state
}

function saveState(state: RateLimitState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export interface RateLimitInfo {
  canSend: boolean
  dayCount: number
  dayLimit: number
  weekCount: number
  weekLimit: number
  monthCount: number
  monthLimit: number
  resetIn: string // human-readable time until next reset
  limitReached: 'day' | 'week' | 'month' | null
}

function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function checkRateLimit(limits: RateLimits): RateLimitInfo {
  const state = loadState()
  const now = Date.now()

  let limitReached: 'day' | 'week' | 'month' | null = null
  let resetIn = ''

  if (state.day.count >= limits.messagesPerDay) {
    limitReached = 'day'
    resetIn = formatDuration(state.day.resetAt - now)
  } else if (state.week.count >= limits.messagesPerWeek) {
    limitReached = 'week'
    resetIn = formatDuration(state.week.resetAt - now)
  } else if (state.month.count >= limits.messagesPerMonth) {
    limitReached = 'month'
    resetIn = formatDuration(state.month.resetAt - now)
  }

  return {
    canSend: limitReached === null,
    dayCount: state.day.count,
    dayLimit: limits.messagesPerDay,
    weekCount: state.week.count,
    weekLimit: limits.messagesPerWeek,
    monthCount: state.month.count,
    monthLimit: limits.messagesPerMonth,
    resetIn,
    limitReached
  }
}

export function recordMessage(): void {
  const state = loadState()
  state.day.count++
  state.week.count++
  state.month.count++
  saveState(state)
}

export function clearRateLimits(): void {
  localStorage.removeItem(STORAGE_KEY)
}
