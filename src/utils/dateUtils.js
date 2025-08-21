/**
 * Date Utility Functions
 * Helper functions for date handling and quota reset calculations
 */

/**
 * Get current date in YYYY-MM-DD format
 */
export function getTodayString() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
export function getYesterdayString() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

/**
 * Get next midnight as ISO string
 */
export function getNextMidnight() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toISOString()
}

/**
 * Get current midnight as ISO string
 */
export function getCurrentMidnight() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.toISOString()
}

/**
 * Check if a date string is today
 */
export function isToday(dateString) {
  return dateString === getTodayString()
}

/**
 * Check if a date string is yesterday
 */
export function isYesterday(dateString) {
  return dateString === getYesterdayString()
}

/**
 * Get time until next midnight in milliseconds
 */
export function getTimeUntilMidnight() {
  const now = new Date()
  const midnight = new Date()
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)
  
  return midnight.getTime() - now.getTime()
}

/**
 * Get hours until next midnight
 */
export function getHoursUntilMidnight() {
  const msUntilMidnight = getTimeUntilMidnight()
  return Math.ceil(msUntilMidnight / (1000 * 60 * 60))
}

/**
 * Get minutes until next midnight
 */
export function getMinutesUntilMidnight() {
  const msUntilMidnight = getTimeUntilMidnight()
  return Math.ceil(msUntilMidnight / (1000 * 60))
}

/**
 * Format time until reset for display
 */
export function formatTimeUntilReset() {
  const hours = getHoursUntilMidnight()
  const minutes = getMinutesUntilMidnight() % 60
  
  if (hours > 1) {
    return `${hours} hours`
  } else if (hours === 1) {
    return `1 hour ${minutes} minutes`
  } else {
    return `${minutes} minutes`
  }
}

/**
 * Check if we've crossed midnight since a given timestamp
 */
export function hasCrossedMidnight(timestamp) {
  const given = new Date(timestamp)
  const now = new Date()
  
  // Get midnight of the day the timestamp was created
  const midnightAfterGiven = new Date(given)
  midnightAfterGiven.setDate(midnightAfterGiven.getDate() + 1)
  midnightAfterGiven.setHours(0, 0, 0, 0)
  
  return now >= midnightAfterGiven
}

/**
 * Get date range for the last N days
 */
export function getDateRange(days) {
  const dates = []
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
}

/**
 * Format date for display
 */
export function formatDateForDisplay(dateString) {
  const date = new Date(dateString)
  const today = getTodayString()
  const yesterday = getYesterdayString()
  
  if (dateString === today) {
    return 'Today'
  } else if (dateString === yesterday) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }
}

/**
 * Format timestamp for display
 */
export function formatTimestampForDisplay(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}

/**
 * Get start and end of day for a date string
 */
export function getDayBounds(dateString) {
  const start = new Date(dateString + 'T00:00:00.000Z')
  const end = new Date(dateString + 'T23:59:59.999Z')
  
  return {
    start: start.toISOString(),
    end: end.toISOString()
  }
}

/**
 * Check if a timestamp is within today
 */
export function isTimestampToday(timestamp) {
  const date = new Date(timestamp)
  const today = new Date()
  
  return date.toDateString() === today.toDateString()
}

/**
 * Get week start (Monday) for a given date
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  
  return d.toISOString().split('T')[0]
}

/**
 * Get month start for a given date
 */
export function getMonthStart(date = new Date()) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  
  return d.toISOString().split('T')[0]
}

/**
 * Validate date string format (YYYY-MM-DD)
 */
export function isValidDateString(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date.toISOString().split('T')[0] === dateString
}

/**
 * Get timezone offset in hours
 */
export function getTimezoneOffset() {
  return new Date().getTimezoneOffset() / -60
}