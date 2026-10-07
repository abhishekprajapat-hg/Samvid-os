import { useState } from "react";
import {
  COWORKING_CABIN_COUNTS,
  COWORKING_CABIN_SEAT_OPTIONS,
  COWORKING_TERM_MONTHS,
} from "../../../config/propertyRequirementConfig";

const CUSTOM = "CUSTOM";

/*
 * A term in months: the usual choices, and a number box when the answer is not
 * one of them.
 *
 * Declared at module scope, not inside the form. A component created during
 * render is a new type on every keystroke, so React unmounts and remounts it -
 * and the custom-months box would lose focus after a single digit.
 */
const MonthsField = ({ label, field, value, onChange, inputClass, labelClass }) => {
  const current = value[field];

  /*
   * Custom is a mode the user chose, not a shape read back off the number.
   *
   * Inferring it from the value meant the box vanished mid-word: every common
   * term - 12, 18, 24, 36, 60 - opens with a digit that is itself a preset, so
   * the moment the "1" of "12" landed the field decided 1 month was the answer
   * and unmounted the input. None of those terms could be typed at all. The
   * mode is still seeded from the value so an existing 24-month lock-in opens
   * showing 24 rather than snapping to the preset list.
   */
  const holdsCustomValue = current !== null
    && current !== undefined
    && !COWORKING_TERM_MONTHS.includes(Number(current));
  const [customMode, setCustomMode] = useState(holdsCustomValue);
  const showCustom = customMode || holdsCustomValue;

  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="flex gap-2">
        <select
          value={showCustom ? CUSTOM : (current ?? "")}
          onChange={(event) => {
            if (event.target.value === CUSTOM) {
              // Leave the number alone: switching to Custom is the start of
              // typing one, not an answer of zero months.
              setCustomMode(true);
              return;
            }
            setCustomMode(false);
            onChange({ [field]: event.target.value === "" ? null : Number(event.target.value) });
          }}
          className={inputClass}
        >
          <option value="">Not set</option>
          {COWORKING_TERM_MONTHS.map((months) => (
            <option key={months} value={months}>{months} month{months === 1 ? "" : "s"}</option>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
        {showCustom ? (
          <input
            type="number"
            min="0"
            value={current ?? ""}
            onChange={(event) => onChange({ [field]: event.target.value === "" ? null : Number(event.target.value) })}
            placeholder="Months"
            className={inputClass}
          />
        ) : null}
      </div>
    </label>
  );
};

/*
 * What a coworking client is actually asking for.
 *
 * Cabins are a list, one entry per cabin, because a client commonly takes
 * several of different sizes - one four-seater and one six-seater is a single
 * enquiry. Choosing "3 cabins" therefore grows the list to three seat pickers
 * rather than multiplying one size by three, which could not express the
 * common case.
 *
 * Workstations is suggested from the seats across those cabins and then left
 * editable. It is usually that number, but a client can ask for open desks
 * beyond the cabins, and a field that recomputed itself would keep erasing that.
 */
const CoworkingRequirementFields = ({ value = {}, onChange, inputClass, labelClass }) => {
  const cabins = Array.isArray(value.cabins) ? value.cabins : [];
  const seatTotal = cabins.reduce((total, cabin) => total + (Number(cabin?.seats) || 0), 0);

  const set = (patch) => onChange({ ...value, ...patch });

  const setCabinCount = (count) => {
    const next = Array.from({ length: count }, (_, index) => cabins[index] || { seats: COWORKING_CABIN_SEAT_OPTIONS[0] });
    set({ cabins: next });
  };

  const setCabinSeats = (index, seats) => {
    set({ cabins: cabins.map((cabin, position) => (position === index ? { seats } : cabin)) });
  };

  /*
   * Same mode-not-inference rule as the months fields. Picking "Custom" used to
   * return without touching state, so the select snapped straight back to the
   * count it already held and the number box never appeared - the server takes
   * up to 50 cabins but nothing above 8 could be entered.
   */
  const holdsCustomCabinCount = cabins.length > 0 && !COWORKING_CABIN_COUNTS.includes(cabins.length);
  const [customCabinMode, setCustomCabinMode] = useState(holdsCustomCabinCount);
  const showCustomCabinCount = customCabinMode || holdsCustomCabinCount;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Cabins</span>
          <div className="flex gap-2">
            <select
              value={showCustomCabinCount ? CUSTOM : cabins.length}
              onChange={(event) => {
                if (event.target.value === CUSTOM) {
                  setCustomCabinMode(true);
                  return;
                }
                setCustomCabinMode(false);
                setCabinCount(Number(event.target.value) || 0);
              }}
              className={inputClass}
            >
              <option value={0}>No cabins</option>
              {COWORKING_CABIN_COUNTS.map((count) => (
                <option key={count} value={count}>{count} cabin{count === 1 ? "" : "s"}</option>
              ))}
              <option value={CUSTOM}>Custom</option>
            </select>
            {showCustomCabinCount ? (
              <input
                type="number"
                min="1"
                max="50"
                value={cabins.length}
                onChange={(event) => setCabinCount(Math.max(0, Math.min(50, Number(event.target.value) || 0)))}
                className={inputClass}
              />
            ) : null}
          </div>
        </label>

        <label className="block">
          <span className={labelClass}>Workstations</span>
          <input
            type="number"
            min="0"
            value={value.workstations ?? ""}
            onChange={(event) => set({ workstations: event.target.value === "" ? null : Number(event.target.value) })}
            placeholder={seatTotal ? `${seatTotal} across the cabins` : "How many desks"}
            className={inputClass}
          />
        </label>
      </div>

      {cabins.length ? (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className={labelClass}>Seats per cabin</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {cabins.map((cabin, index) => (
              <label key={index} className="block">
                <span className="mb-1 block text-[10.5px] text-slate-400">Cabin {index + 1}</span>
                <select
                  value={cabin.seats}
                  onChange={(event) => setCabinSeats(index, Number(event.target.value))}
                  className={inputClass}
                >
                  {/* The server accepts 1-100 seats while this list offers five
                      sizes, so a cabin saved elsewhere can hold a count that is
                      not on it. Carrying that value as its own option shows the
                      real number instead of rendering an empty box. */}
                  {(COWORKING_CABIN_SEAT_OPTIONS.includes(Number(cabin.seats))
                    ? COWORKING_CABIN_SEAT_OPTIONS
                    : [...COWORKING_CABIN_SEAT_OPTIONS, Number(cabin.seats)].sort((a, b) => a - b)
                  ).map((seats) => (
                    <option key={seats} value={seats}>{seats} seater</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {seatTotal ? (
            <p className="mt-2 text-[11px] text-slate-400">
              {seatTotal} seat{seatTotal === 1 ? "" : "s"} across {cabins.length} cabin{cabins.length === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Agreed rent (monthly)</span>
          <input
            type="number"
            min="0"
            value={value.agreedRent ?? ""}
            onChange={(event) => set({ agreedRent: event.target.value === "" ? null : Number(event.target.value) })}
            placeholder="What was agreed"
            className={inputClass}
          />
        </label>
        <MonthsField label="Deposit" field="depositMonths" value={value} onChange={set} inputClass={inputClass} labelClass={labelClass} />
        <MonthsField label="Notice period" field="noticePeriodMonths" value={value} onChange={set} inputClass={inputClass} labelClass={labelClass} />
        <MonthsField label="Lock-in period" field="lockInMonths" value={value} onChange={set} inputClass={inputClass} labelClass={labelClass} />
      </div>
    </div>
  );
};

export default CoworkingRequirementFields;
