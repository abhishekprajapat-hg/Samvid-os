import { useEffect, useState } from "react";
import api from "../../../../services/api";
const upcomingBirthdays = (clients, today = new Date()) => {
 const current = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
 const anchor = new Date(`${current}T12:00:00Z`);
 const days = Array.from({ length: 8 }, (_, i) => new Date(anchor.getTime() + i * 86400000).toISOString().slice(5, 10));
 return clients.map(client => { const dob = client.dateOfBirth || client.documents?.find(doc => doc.extractedDateOfBirth)?.extractedDateOfBirth || ""; return { ...client, daysUntil: days.indexOf(String(dob).slice(5, 10)) }; }).filter(client => client.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
};
export default function BirthdayReminders({ clients = [] }) {
 const [remote, setRemote] = useState([]), [now, setNow] = useState(() => new Date());
 useEffect(() => { let active = true; const load = () => { setNow(new Date()); api.get("/coworking/clients/birthdays").then(({ data }) => { if (active) setRemote(data.clients || []); }).catch(() => {}); }; load(); const timer = setInterval(load, 60000); return () => { active = false; clearInterval(timer); }; }, []);
 const unique = [...new Map([...remote, ...clients].map(client => [client._id || client.id || client.phone || client.name, client])).values()];
 const upcoming = upcomingBirthdays(unique, now);
 if (!upcoming.length) return null;
 return <section role="status" aria-label="Birthday reminders" className="my-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-900"><h3 className="text-sm font-semibold">Birthday reminders</h3>{upcoming.map(client => <p key={client._id || client.id || client.name} className="mt-1 text-sm">{client.contactPerson || client.name || client.companyName}: {client.daysUntil === 0 ? "Birthday today" : `in ${client.daysUntil} days`}</p>)}</section>;
}
