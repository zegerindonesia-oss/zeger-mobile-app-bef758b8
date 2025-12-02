/**
 * Date utilities for Asia/Jakarta timezone
 */

/**
 * Get today's date in Asia/Jakarta timezone in YYYY-MM-DD format
 * This function ensures proper timezone handling without UTC conversion issues
 */
export const getTodayJakarta = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

/**
 * Get current date and time in Asia/Jakarta timezone
 */
export const getNowJakarta = (): Date => {
  const now = new Date();
  const jakartaTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);
  
  const year = jakartaTime.find(part => part.type === 'year')?.value || '2025';
  const month = jakartaTime.find(part => part.type === 'month')?.value || '01';
  const day = jakartaTime.find(part => part.type === 'day')?.value || '01';
  const hour = jakartaTime.find(part => part.type === 'hour')?.value || '00';
  const minute = jakartaTime.find(part => part.type === 'minute')?.value || '00';
  const second = jakartaTime.find(part => part.type === 'second')?.value || '00';
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`);
};

/**
 * Get Jakarta timezone date range for queries
 * This ensures consistent timezone handling across all date-based queries
 */
export const getJakartaDateRange = (date: string) => ({
  start: `${date}T00:00:00+07:00`,
  end: `${date}T23:59:59+07:00`
});