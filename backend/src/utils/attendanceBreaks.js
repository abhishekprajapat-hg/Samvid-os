const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

// Validate the entire timeline so corrections cannot double-count break time.
const validateBreakTimeline = ({ sessions, checkInAt, checkOutAt, now = new Date() }) => {
  const start = new Date(checkInAt).getTime();
  const limit = Math.min(checkOutAt ? new Date(checkOutAt).getTime() : now.getTime(), now.getTime());
  if (!checkInAt || !Number.isFinite(start)) invalid("Check-in is required before adding a break");
  const windows = sessions.map((session) => {
    const from = new Date(session.startAt).getTime();
    const to = session.endAt ? new Date(session.endAt).getTime() : limit;
    if (!session.startAt || !Number.isFinite(from) || !Number.isFinite(to)) invalid("Enter valid break start and end times");
    if (from < start || from > limit || to > limit) invalid("Break times must fall between check-in and check-out (or now)");
    if (session.endAt && to <= from) invalid("Break end must be after its start");
    if (!session.endAt && checkOutAt) invalid("A checked-out attendance record requires a break end time");
    return { from, to, open: !session.endAt };
  }).sort((a, b) => a.from - b.from);
  for (let i = 1; i < windows.length; i += 1) {
    if (windows[i - 1].open || windows[i].from < windows[i - 1].to) invalid("Break sessions cannot overlap");
  }
};

module.exports = { validateBreakTimeline };
