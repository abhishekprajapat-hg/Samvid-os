import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { getPlacesApiKey, loadPlaces, fetchPlacePredictions, geocodePlaceId } from "../../utils/googlePlaces";

/*
 * A location box backed by Google Places.
 *
 * Typing is always allowed. The suggestions are an aid, not a gate: without an
 * API key, offline, or for a building Google has never heard of, whatever was
 * typed is still the answer. A field that refuses free text would make the CRM
 * unusable the day the key expires.
 *
 * Coordinates come back only when a suggestion is picked, which is why onSelect
 * carries them separately from onChange - a typed name has no lat/lng and
 * pretending otherwise would put a wrong pin on a map.
 */
/*
 * The part of the box a suggestion applies to.
 *
 * A multi-value field holds "Vijay Nagar, Palasia, Sch 54" and only the piece
 * after the last comma is what someone is currently typing. Looking up the
 * whole string would search for all three at once and match nothing.
 */
const tailSegment = (raw, multiValue) => {
  const text = String(raw || "");
  if (!multiValue) return text;
  const cut = text.lastIndexOf(",");
  return cut === -1 ? text : text.slice(cut + 1);
};

const PlaceAutocompleteInput = ({
  value,
  onChange,
  onSelect,
  placeholder = "Search a locality",
  className = "",
  country = "in",
  multiValue = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef(null);
  const boxRef = useRef(null);
  // The text a pick just wrote, so the lookup below can tell it apart from
  // something typed and not reopen the list over an answered field.
  const justChoseRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!getPlacesApiKey()) return undefined;
    loadPlaces()
      .then((google) => { if (active) serviceRef.current = new google.maps.places.AutocompleteService(); })
      .catch(() => { serviceRef.current = null; });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const query = tailSegment(value, multiValue).trim();
    let active = true;

    if (justChoseRef.current !== null && justChoseRef.current === String(value || "")) {
      /*
       * This is the text the pick just wrote. Looking it up again would find
       * the very suggestion that was chosen and drop the list back open over
       * the field the moment it was dismissed. `choose` has already emptied
       * the list, so there is nothing to clear here - and clearing it from an
       * effect body would cascade a render, which is what the debounce below
       * exists to avoid.
       */
      justChoseRef.current = null;
      return undefined;
    }

    /*
     * Both the clear and the fetch happen inside the timer. Setting state
     * straight from an effect body cascades renders, and the debounce is wanted
     * either way - clearing the list the instant a character is deleted makes
     * the box flicker while someone is still typing.
     */
    const timer = setTimeout(() => {
      if (!serviceRef.current || query.length < 3) {
        if (active) { setSuggestions([]); setOpen(false); }
        return;
      }
      if (active) setLoading(true);
      fetchPlacePredictions(serviceRef.current, query, country)
        .then((rows) => { if (active) { setSuggestions(rows); setOpen(rows.length > 0); } })
        .finally(() => { if (active) setLoading(false); });
    }, 300);

    return () => { active = false; clearTimeout(timer); };
  }, [value, country, multiValue]);

  const choose = async (suggestion) => {
    /*
     * A pick replaces the piece being typed, not the whole box. Overwriting
     * everything threw away every locality already entered, on a field whose
     * own placeholder invites a comma-separated list of them.
     */
    const text = String(value || "");
    const cut = text.lastIndexOf(",");
    const head = multiValue && cut !== -1 ? `${text.slice(0, cut + 1)} ` : "";
    const next = `${head}${suggestion.label}`;

    justChoseRef.current = next;
    setOpen(false);
    setSuggestions([]);
    onChange?.(next);
    const coordinates = await geocodePlaceId(suggestion.placeId);
    onSelect?.({ label: suggestion.label, ...(coordinates || {}) });
  };

  return (
    <div ref={boxRef} className="relative">
      <MapPin size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={(event) => {
          // Let a click on a suggestion land before the list closes.
          if (!boxRef.current?.contains(event.relatedTarget)) setTimeout(() => setOpen(false), 120);
        }}
        placeholder={placeholder}
        className={`pl-9 ${className}`}
      />
      {loading ? <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" /> : null}

      {open && suggestions.length ? (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId || suggestion.label}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default PlaceAutocompleteInput;
