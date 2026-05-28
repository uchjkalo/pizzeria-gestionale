"use client";

import { useState } from "react";
import { login } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (e) {
      setError("Email o password errati");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Header con accento */}
          <div className="h-1 bg-gradient-to-r from-red-600 to-red-800"></div>
          
          {/* Contenuto */}
          <div className="p-8 sm:p-10">
            {/* Logo / Titolo */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-300 rounded-full mb-4">
                <span className="text-4xl">🍕</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Al Cjanton</h1>
              <p className="text-gray-700 text-sm mt-2 font-medium">Gestionale interno</p>
            </div>

            {/* Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@pizzeria.it"
                  className="w-full px-4 py-3 bg-gray-300 border border-gray-400 rounded-lg text-gray-900 placeholder-gray-600 transition-all focus-ring text-sm"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  className="w-full px-4 py-3 bg-gray-300 border border-gray-400 rounded-lg text-gray-900 placeholder-gray-600 transition-all focus-ring text-sm"
                  required
                />
              </div>

              {/* Messaggio Errore */}
              {error && (
                <div className="p-4 bg-red-900/40 border border-red-600 rounded-lg">
                  <p className="text-red-300 text-sm font-medium">{error}</p>
                </div>
              )}

              {/* Bottone Login */}
              <button
                onClick={handleLogin}
                disabled={loading}
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 text-base mt-6 shadow-md hover:shadow-lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Accesso in corso...
                  </span>
                ) : (
                  "Accedi"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-gray-700 text-xs mt-8 font-medium">
          Sistema gestionale pizzeria • Versione 1.0
        </p>
      </div>
    </div>
  );
}
