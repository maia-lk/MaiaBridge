// MaiaBridge Project
// Working hours helper — determines if MyPOS is expected to be online.
// Supports separate hours for weekdays and weekends.

require('dotenv').config();

const WEEKDAY_START = process.env.MYPOS_WEEKDAY_START || '08:30';
const WEEKDAY_END = process.env.MYPOS_WEEKDAY_END || '19:00';
const WEEKEND_START = process.env.MYPOS_WEEKEND_START || '10:00';
const WEEKEND_END = process.env.MYPOS_WEEKEND_END || '19:00';
const TIMEZONE = process.env.MYPOS_TIMEZONE || 'Asia/Colombo';

function getNowInTZ() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const weekday = parts.find(p => p.type === 'weekday').value; // Mon, Tue, ...
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return { weekday, minutes: hour * 60 + minute };
}

function parseHHMM(str) {
  const [h, m] = str.split(':').map(n => parseInt(n, 10));
  return h * 60 + (m || 0);
}

function isWeekend(weekday) {
  return weekday === 'Sat' || weekday === 'Sun';
}

function isWithinWorkingHours() {
  const { weekday, minutes } = getNowInTZ();
  const start = parseHHMM(isWeekend(weekday) ? WEEKEND_START : WEEKDAY_START);
  const end = parseHHMM(isWeekend(weekday) ? WEEKEND_END : WEEKDAY_END);
  if (start <= end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function describeHours() {
  return `weekdays ${WEEKDAY_START}-${WEEKDAY_END}, weekends ${WEEKEND_START}-${WEEKEND_END} ${TIMEZONE}`;
}

module.exports = {
  isWithinWorkingHours,
  describeHours,
  TIMEZONE
};
