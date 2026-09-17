import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import api from "../../../services/api";

/*
 * Warns while the number is still being typed, because a broker number is
 * refused on save. Finding that out at submit time - after filling in the rest
 * of the form - is the version of this that wastes someone's afternoon.
 *
 * The result is held against the number it was fetched for, so an in-flight
 * reply for an earlier number cannot label the current one.
 */
const BrokerPhoneHint = ({ phone }) => {
  const [match, setMatch] = useState(null);

  useEffect(() => {
    const current = String(phone || "");
    let active = true;

    // Clearing happens in the timer rather than here: setting state straight
    // from an effect body cascades renders, and the guard below already hides
    // a result belonging to a number that has since been edited.
    const timer = setTimeout(() => {
      if (current.replace(/\D/g, "").length < 7) {
        if (active) setMatch(null);
        return;
      }
      api.get("/contacts/identify", { params: { phone: current } })
        .then(({ data }) => {
          if (active) setMatch(data.isBroker ? { phone: current, name: data.name || "This number" } : null);
        })
        .catch(() => { if (active) setMatch(null); });
    }, 350);

    return () => { active = false; clearTimeout(timer); };
  }, [phone]);

  if (!match || match.phone !== String(phone || "")) return null;

  return (
    <p role="status" className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-amber-700">
      <ShieldAlert size={13} className="mt-px shrink-0" />
      <span>{match.name} is in the Broker Database, so this number cannot be saved as a lead.</span>
    </p>
  );
};

export default BrokerPhoneHint;
