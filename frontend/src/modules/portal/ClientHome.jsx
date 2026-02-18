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
        property.title.toLowerCase().includes(normalized) ||
        property.location.toLowerCase().includes(normalized)
      );
    });
  }, [mode, query]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060b19] text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute top-48 right-[8%] h-80 w-80 rounded-full bg-emerald-500/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:54px_54px]" />
      </div>

      <nav className="sticky top-0 z-30 border-b border-slate-700/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            className="flex items-center gap-3"
            onClick={() => navigate("/portal")}
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 font-display text-sm text-cyan-200">
              S
            </div>
            <div className="text-left">
              <p className="font-display text-base tracking-wider text-white">
                SAMVID
              </p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">
                Estates
              </p>
            </div>
          </button>

          <div className="hidden items-center gap-8 text-xs font-bold uppercase tracking-[0.26em] text-slate-300 md:flex">
            <button onClick={() => setMode("buy")} className="hover:text-cyan-300">
              Buy
            </button>
            <button onClick={() => setMode("rent")} className="hover:text-cyan-300">
              Rent
            </button>
            <button onClick={() => navigate("/portal/listing")} className="hover:text-cyan-300">
              Listings
            </button>
          </div>

          <button
            onClick={() => navigate("/login")}
            className="rounded-xl border border-cyan-400/45 bg-cyan-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:bg-cyan-400/20"
          >
            Client Login
          </button>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-4 pb-14 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
        <div>
          <p className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100">
            Premium Discovery Desk
          </p>
          <h1 className="mt-5 max-w-xl font-display text-4xl leading-tight text-white sm:text-5xl">
            No chaos. Just the right property.
          </h1>
          <p className="mt-5 max-w-xl text-slate-300">
            Search verified homes with clean pricing, clear ownership, and faster
            closure support from our core advisory team.
          </p>

          <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 shadow-[0_10px_40px_rgba(2,6,23,0.45)]">
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-950/70 p-1">
              <button
                onClick={() => setMode("buy")}
                className={`rounded-lg py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                  mode === "buy"
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Buy
              </button>
              <button
                onClick={() => setMode("rent")}
                className={`rounded-lg py-2 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                  mode === "rent"
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-slate-400 hover:text-slate-200"
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
                className="w-full rounded-xl border border-slate-700 bg-slate-950/60 py-3 pl-11 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-cyan-500 p-2 text-white hover:bg-cyan-400">
                <Search size={16} />
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="font-display text-2xl text-cyan-200">600+</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Verified Homes
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="font-display text-2xl text-cyan-200">48h</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Site Visit Setup
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
              <p className="font-display text-2xl text-cyan-200">99%</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Deal Transparency
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/portal/listing")}
            className="group overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/80 text-left"
          >
            <div className="aspect-[4/3] w-full overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&q=80&w=1200"
                alt="Featured premium residence"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex items-center justify-between p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-300">
                  Signature Listing
                </p>
                <h3 className="mt-1 font-display text-xl text-white">
                  The Onyx Tower
                </h3>
                <p className="mt-1 text-sm text-slate-400">Starting INR 2.5 Cr</p>
              </div>
              <ArrowRight className="text-cyan-300" size={20} />
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3">
            {TRUST_POINTS.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-slate-700 bg-slate-900/75 p-4 first:col-span-2"
              >
                <div className="mb-3 inline-flex rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
                  <point.icon size={16} />
                </div>
                <h4 className="text-sm font-semibold text-slate-100">{point.title}</h4>
                <p className="mt-1 text-xs text-slate-400">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-slate-700/60 bg-slate-950/70 py-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Curated Inventory
              </p>
              <h2 className="mt-2 font-display text-3xl text-white">
                {mode === "buy" ? "Buy Opportunities" : "Rental Opportunities"}
              </h2>
            </div>
            <button
              onClick={() => navigate("/portal/listing")}
              className="hidden items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200 sm:inline-flex"
            >
              Explore All
              <ArrowRight size={14} />
            </button>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-8 text-center">
              <p className="text-slate-300">
                No matching properties found. Try another keyword.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {filteredProperties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => navigate("/portal/listing")}
                  className="group overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/85 text-left transition-colors hover:border-cyan-400/60"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-bold tracking-[0.15em] text-cyan-200">
                      {property.type}
                    </div>
                    <div className="absolute right-3 top-3 rounded-full bg-slate-950/80 p-2 text-slate-200">
                      <Heart size={14} />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-white">{property.title}</h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <MapPin size={12} />
                          {property.location}
                        </p>
                      </div>
                      <p className="font-display text-lg text-cyan-200">{property.price}</p>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.17em] text-slate-400">
                      {property.beds} Bed | {property.baths} Bath | {property.area}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ClientHome;
