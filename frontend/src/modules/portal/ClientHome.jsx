import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Heart,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const FEATURED_PROPERTIES = [
  {
    id: 1,
    title: "Skyline Penthouse",
    location: "Sector 42, Noida",
    price: "INR 3.5 Cr",
    type: "SALE",
    beds: 4,
    baths: 4,
    area: "4200 sq.ft",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=900",
  },
  {
    id: 2,
    title: "Urban Loft",
    location: "Cyber Hub, Gurgaon",
    price: "INR 85k/mo",
    type: "RENT",
    beds: 2,
    baths: 2,
    area: "1450 sq.ft",
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=900",
  },
  {
    id: 3,
    title: "Grand Villa",
    location: "North Ridge, Delhi",
    price: "INR 8.0 Cr",
    type: "SALE",
    beds: 5,
    baths: 6,
    area: "6400 sq.ft",
    image:
      "https://images.unsplash.com/photo-1600596542815-2495db9dc2c3?auto=format&fit=crop&q=80&w=900",
  },
  {
    id: 4,
    title: "Lakeview Residence",
    location: "Golf Course Road, Gurgaon",
    price: "INR 1.4 L/mo",
    type: "RENT",
    beds: 3,
    baths: 3,
    area: "2300 sq.ft",
    image:
      "https://images.unsplash.com/photo-1613977257362-ae8a7f7f4f77?auto=format&fit=crop&q=80&w=900",
  },
];

const TRUST_POINTS = [
  {
    title: "Verified Inventory",
    text: "Every listing is cross-checked before publishing.",
    icon: BadgeCheck,
  },
  {
    title: "Legal Safety",
    text: "Transaction process with document-level assistance.",
    icon: ShieldCheck,
  },
  {
    title: "Closure Support",
    text: "Dedicated support from visit to final handover.",
    icon: KeyRound,
  },
];

const ClientHome = () => {
  const [mode, setMode] = useState("buy");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const filteredProperties = useMemo(() => {
    const selectedType = mode === "buy" ? "SALE" : "RENT";
    const normalized = query.trim().toLowerCase();

    return FEATURED_PROPERTIES.filter((property) => {
      if (property.type !== selectedType) return false;
      if (!normalized) return true;

      return (
        property.title.toLowerCase().includes(normalized)
        || property.location.toLowerCase().includes(normalized)
      );
    });
  }, [mode, query]);

  return (
    <div className="ui-page-shell min-h-screen text-slate-900">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="ui-hero-card flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button className="flex items-center gap-3" onClick={() => navigate("/portal")}> 
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300 bg-cyan-100 font-display text-sm text-cyan-700">
              S
            </div>
            <div className="text-left">
              <p className="font-display text-base tracking-wide text-slate-900">THE OFFICE ON RENT</p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-700">Estates</p>
            </div>
          </button>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setMode("buy")}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                mode === "buy"
                  ? "border-cyan-300 bg-cyan-100 text-cyan-800"
                  : "border-slate-300 bg-white text-slate-600 hover:border-cyan-200"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setMode("rent")}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                mode === "rent"
                  ? "border-cyan-300 bg-cyan-100 text-cyan-800"
                  : "border-slate-300 bg-white text-slate-600 hover:border-cyan-200"
              }`}
            >
              Rent
            </button>
            <button
              onClick={() => navigate("/portal/listing")}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 hover:border-cyan-300 hover:text-cyan-700"
            >
              Listings
            </button>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 hover:border-cyan-300 hover:text-cyan-700"
          >
            Client Login
          </button>
        </header>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="ui-soft-panel rounded-3xl p-5 sm:p-6">
            <p className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Premium Discovery Desk
            </p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
              No chaos. Just the right property.
            </h1>
            <p className="mt-4 max-w-xl text-sm text-slate-600 sm:text-base">
              Search verified homes with transparent pricing, clear ownership, and
              faster closure support from our advisory team.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-3 grid grid-cols-2 gap-2 md:hidden">
                <button
                  onClick={() => setMode("buy")}
                  className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                    mode === "buy"
                      ? "bg-cyan-100 text-cyan-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setMode("rent")}
                  className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                    mode === "rent"
                      ? "bg-cyan-100 text-cyan-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Rent
                </button>
              </div>

              <div className="relative">
                <MapPin
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by city, locality, or project"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-cyan-600 p-2 text-white hover:bg-cyan-500">
                  <Search size={16} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-display text-2xl text-cyan-700">600+</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Verified Homes</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-display text-2xl text-cyan-700">48h</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Site Visit Setup</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-display text-2xl text-cyan-700">99%</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Deal Transparency</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => navigate("/portal/listing")}
              className="ui-soft-panel group overflow-hidden rounded-3xl text-left"
            >
              <div className="aspect-[4/3] w-full overflow-hidden rounded-t-3xl">
                <img
                  src="https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&q=80&w=1200"
                  alt="Featured premium residence"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-700">Signature Listing</p>
                  <h3 className="mt-1 font-display text-xl text-slate-900">The Onyx Tower</h3>
                  <p className="mt-1 text-sm text-slate-500">Starting INR 2.5 Cr</p>
                </div>
                <ArrowRight className="text-cyan-700" size={20} />
              </div>
            </button>

            <div className="grid grid-cols-1 gap-3">
              {TRUST_POINTS.map((point) => (
                <div key={point.title} className="ui-soft-panel rounded-2xl p-4">
                  <div className="mb-3 inline-flex rounded-lg bg-cyan-50 p-2 text-cyan-700">
                    <point.icon size={16} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900">{point.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{point.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ui-soft-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Curated Inventory</p>
              <h2 className="mt-1 font-display text-3xl text-slate-900">
                {mode === "buy" ? "Buy Opportunities" : "Rental Opportunities"}
              </h2>
            </div>
            <button
              onClick={() => navigate("/portal/listing")}
              className="hidden items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 hover:border-cyan-300 hover:text-cyan-700 sm:inline-flex"
            >
              Explore All
              <ArrowRight size={14} />
            </button>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-slate-600">No matching properties found. Try another keyword.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredProperties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => navigate("/portal/listing")}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition-colors hover:border-cyan-300"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-cyan-700">
                      {property.type}
                    </div>
                    <div className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-500">
                      <Heart size={14} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">{property.title}</h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} />
                          {property.location}
                        </p>
                      </div>
                      <p className="font-display text-lg text-cyan-700">{property.price}</p>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.15em] text-slate-500">
                      {property.beds} Bed | {property.baths} Bath | {property.area}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <footer className="ui-soft-panel flex flex-col items-start justify-between gap-3 rounded-2xl px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <p>Samvid OS Legal Center</p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/privacy-policy")}
              className="font-semibold text-slate-600 hover:text-cyan-700"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => navigate("/terms-and-conditions")}
              className="font-semibold text-slate-600 hover:text-cyan-700"
            >
              Terms & Conditions
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ClientHome;
