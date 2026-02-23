import React, { useState } from "react";
import { motion } from "framer-motion";
import { Hexagon, ChevronRight, Lock, ScanFace } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { toErrorMessage } from "../../utils/errorMessage";

const Login = ({ onLogin, portal = "GENERAL" }) => {
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email,
        password: passcode,
        portal,
      });

      const { token, refreshToken, user } = res.data;

      localStorage.setItem("token", token);
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      } else {
        localStorage.removeItem("refreshToken");
      }
      localStorage.setItem("role", user.role);
      localStorage.setItem("user", JSON.stringify(user));

      onLogin(user.role);
    } catch (err) {
      setError(toErrorMessage(err, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full min-h-screen px-4 flex items-center justify-center bg-slate-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white border shadow-xl rounded-3xl p-6 sm:p-8"
      >
        <div className="text-center mb-6">
          <Hexagon size={32} className="mx-auto mb-3" />
          <h1 className="text-xl font-bold">{portal} LOGIN</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl p-3"
          />

          <div className="relative">
            <Lock
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="password"
              required
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Password"
              className="w-full border rounded-xl py-3 pl-9"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-black text-white py-3 rounded-xl flex justify-center gap-2"
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
            className="font-semibold text-slate-700 hover:text-cyan-700"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            to="/data-use-notice"
            className="font-semibold text-slate-700 hover:text-cyan-700"
          >
            Privacy Policy
          </Link>
          .
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
