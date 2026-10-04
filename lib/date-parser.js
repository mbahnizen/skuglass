/**
 * Explicit parser for Skulytics date strings formatted as "M/D/YYYY h:mm AM|PM"
 * Does NOT use Date.parse or new Date(string) due to engine parsing variations.
 */
export function parseSkulyticsDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
  const match = dateStr.trim().match(regex);

  if (!match) {
    return dateStr; // Return raw string if non-standard format encountered
  }

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  let hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const ampm = match[6].toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const dateObj = new Date(year, month - 1, day, hours, minutes);

  // Month names for clean display
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonth = months[dateObj.getMonth()];
  const displayDay = String(dateObj.getDate()).padStart(2, '0');
  const displayYear = dateObj.getFullYear();
  const displayHours = dateObj.getHours() % 12 || 12;
  const displayMinutes = String(dateObj.getMinutes()).padStart(2, '0');
  const displayAmPm = dateObj.getHours() >= 12 ? 'PM' : 'AM';

  return `${formattedMonth} ${displayDay}, ${displayYear} ${displayHours}:${displayMinutes} ${displayAmPm}`;
}
