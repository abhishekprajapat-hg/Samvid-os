import React, { useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Calendar,
  CheckCircle,
  Heart,
  MapPin,
  Maximize,
  Share2,
  Shield,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PROPERTY = {
  title: "Skyline Lux Penthouse",
  price: "INR 3.5 Cr",
  location: "Green Avenue, Sector 42",
  specs: { beds: 4, baths: 5, area: "3,200 sq.ft" },
  desc: "Experience refined city living with a private terrace, marble finish, full-height glazing, and premium automation. Located in a secure gated cluster with concierge support and fast arterial access.",
  images: [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&q=80&w=1400",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&q=80&w=900",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=900",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=900",
  ],
};

const AMENITIES = [
  "Power Backup",
  "Gated Security",
  "Swimming Pool",
  "Gymnasium",
  "Private Terrace",
  "Smart Home",
];

const TRUST_POINTS = [
  "Verified title and records before handover",
  "End-to-end legal and agreement support",
  "Transparent milestone-based closure workflow",
];

const ClientListing = () => {
  const navigate = useNavigate();
  const [booked, setBooked] = useState(false);

  return (
    <div className="ui-page-shell min-h-screen text-slate-900">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="ui-hero-card flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button
            onClick={() => navigate("/portal")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
          >
            <ArrowLeft size={14} />
            Back To Search
          </button>

          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-slate-300 bg-white/80 p-2 text-slate-500 hover:border-rose-300 hover:text-rose-600">
              <Heart size={18} />
            </button>
            <button className="rounded-xl border border-slate-300 bg-white/80 p-2 text-slate-500 hover:border-cyan-400 hover:text-cyan-700">
              <Share2 size={18} />
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="ui-soft-panel overflow-hidden rounded-3xl p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="relative overflow-hidden rounded-2xl sm:col-span-2">
                <img
                  src={PROPERTY.images[0]}
                  alt={PROPERTY.title}
                  className="h-[260px] w-full object-cover sm:h-[380px]"
                />
                <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  <Star size={11} /> Premium Asset
                </div>
              </div>
              <img
                src={PROPERTY.images[1]}
                alt="Interior"
                className="h-[170px] w-full rounded-2xl object-cover sm:h-[190px]"
              />
              <img
                src={PROPERTY.images[2]}
                alt="Living area"
                className="h-[170px] w-full rounded-2xl object-cover sm:h-[190px]"
              />
            </div>
          </div>

          <aside className="ui-soft-panel rounded-3xl p-5 sm:p-6 xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700">Asking Price</p>
                <p className="mt-1 font-display text-3xl text-slate-900">{PROPERTY.price}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700">
                Available
              </span>
            </div>

            {!booked ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Schedule A Tour</p>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <button className="rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold hover:border-cyan-400 hover:text-cyan-700">
                      Today
                    </button>
                    <button className="rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold hover:border-cyan-400 hover:text-cyan-700">
                      Tomorrow
                    </button>
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Select Date"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 text-xs font-semibold outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setBooked(true)}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-cyan-700"
                >
                  Request Site Visit
                </button>

                <p className="inline-flex w-full items-center justify-center gap-1 text-[10px] text-slate-500">
                  <Shield size={11} /> Zero-Spam Guarantee
                </p>
              </div>
            ) : (
              <Motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle size={28} />
                </div>
                <h3 className="font-display text-xl text-slate-900">Request Sent</h3>
                <p className="mt-1 text-xs text-slate-600">Your relationship manager will confirm the visit slot shortly.</p>
                <button
                  onClick={() => setBooked(false)}
                  className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700 hover:text-cyan-800"
                >
                  Book Another
                </button>
              </Motion.div>
            )}
          </aside>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_0.9fr]">
          <div className="ui-soft-panel rounded-3xl p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">Lead Property</p>
            <h1 className="mt-2 font-display text-3xl text-slate-900 sm:text-4xl">{PROPERTY.title}</h1>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
              <MapPin size={15} /> {PROPERTY.location}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">Bedrooms</p>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <BedDouble size={15} /> {PROPERTY.specs.beds}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">Bathrooms</p>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Bath size={15} /> {PROPERTY.specs.baths}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">Super Area</p>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Maximize size={15} /> {PROPERTY.specs.area}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">About This Home</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{PROPERTY.desc}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="ui-soft-panel rounded-3xl p-5 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Amenities</h3>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {AMENITIES.map((amenity) => (
                  <div key={amenity} className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle size={14} className="text-emerald-600" />
                    {amenity}
                  </div>
                ))}
              </div>
            </div>

            <div className="ui-soft-panel rounded-3xl p-5 sm:p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Why Clients Choose Us</h3>
              <div className="mt-3 space-y-2">
                {TRUST_POINTS.map((point) => (
                  <p key={point} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {point}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="ui-soft-panel mt-1 flex flex-col gap-3 rounded-2xl px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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

export default ClientListing;
