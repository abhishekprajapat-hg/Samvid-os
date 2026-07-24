import React, { useState } from "react";
import { motion as Motion } from "framer-motion";
import { ChevronRight, Lock, ScanFace } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";
import BrandLogo from "../common/BrandLogo";
import ToastNotice from "../ui/ToastNotice";

const Login = ({ onLogin, portal = "GENERAL", portalLabel = portal }) => {
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const submitLogin = (loginPortal) =>
      api.post("/auth/login", {
        email,
        password: passcode,
        portal: loginPortal,
      });

    try {
      let res;

      try {
        res = await submitLogin(portal);
      } catch (err) {
        const errorMessage = toErrorMessage(err, "Login failed");
        const shouldRetryAsAdmin =
          portal === "GENERAL"
          && err?.response?.status === 403
          && /admin must login via admin portal/i.test(errorMessage);

        if (!shouldRetryAsAdmin) {
          throw err;
        }

        res = await submitLogin("ADMIN");
      }

      const { token, refreshToken, user, tenant } = res.data;

      localStorage.setItem("token", token);
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      } else {
        localStorage.removeItem("refreshToken");
      }
      localStorage.setItem("role", user.role);
      localStorage.setItem("user", JSON.stringify(user));
      if (tenant) {
        localStorage.setItem("tenant", JSON.stringify(tenant));
      } else {
        localStorage.removeItem("tenant");
      }

      onLogin(user.role, { user, tenant });
    } catch (err) {
      setError(toErrorMessage(err, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-10 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-12 h-80 w-80 rounded-full bg-cyan-200/55 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-200/55 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50/70" />
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.35)] backdrop-blur-xl sm:p-8"
      >
        <div className="mb-6 text-center">
          <div className="brand-logo-frame mx-auto mb-4 flex h-24 w-64 max-w-full items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <BrandLogo className="h-full w-full" />
          </div>
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
            {portalLabel}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold text-slate-950">
            Secure Workspace Login
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            Command access for authorized users
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />

          <div className="relative">
            <Lock
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </div>

          <ToastNotice message={error} type="error" />

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-gradient-to-r from-cyan-500 to-sky-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <ScanFace className="animate-spin" size={16} />
                Verifying...
              </>
            ) : (
              <>
                Login <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-500">
          By continuing, you agree to our{" "}
          <Link
            to="/service-terms"
            className="font-semibold text-slate-800 hover:text-cyan-700"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            to="/data-use-notice"
            className="font-semibold text-slate-800 hover:text-cyan-700"
          >
            Privacy Policy
          </Link>
          .
        </div>
      </Motion.div>
    </div>
  );
};

export default Login;
