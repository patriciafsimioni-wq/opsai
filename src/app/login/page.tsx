"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, ShieldCheck, MapPin, Wrench } from "lucide-react";
import { Button } from "@/components/ui";
import { Input } from "@/components/form";
import { BRAND } from "@/lib/brand";

const DEMO = [
  { role: "Admin", email: "admin@livefleet.ai", password: "admin123" },
  { role: "Manager", email: "manager@livefleet.ai", password: "manager123" },
  { role: "Driver", email: "driver@livefleet.ai", password: "driver123" },
];

// Demo quick-fill accounts are a convenience for the SYNCTX demo only. They are
// hidden (and credentials are not pre-filled) on TROVA, which is a live portal.
const SHOW_DEMO = BRAND !== "TROVA";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(SHOW_DEMO ? "admin@livefleet.ai" : "");
  const [password, setPassword] = useState(SHOW_DEMO ? "admin123" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-2 text-xl font-bold">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Truck size={22} />
          </div>
          {BRAND}
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            The complete platform to run your entire fleet.
          </h1>
          <p className="max-w-md text-blue-100">
            Real-time GPS tracking, predictive maintenance, driver safety,
            dispatch, fuel and cost analytics — all in one place.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {[
              { icon: MapPin, label: "Live GPS tracking" },
              { icon: Wrench, label: "Maintenance & work orders" },
              { icon: ShieldCheck, label: "Driver safety scores" },
              { icon: Truck, label: "Fleet utilization" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-blue-50">
                <Icon size={16} className="text-blue-200" />
                {label}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-blue-200">© {new Date().getFullYear()} {BRAND}. Built with Next.js.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-[var(--color-bg)] p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-lg font-bold lg:hidden">
            <Truck size={22} className="text-blue-600" /> {BRAND}
          </div>
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Welcome back. Enter your credentials to continue.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {SHOW_DEMO && (
            <div className="mt-6">
              <p className="mb-2 text-center text-xs text-[var(--color-muted)]">
                Demo accounts — click to fill
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO.map((d) => (
                  <button
                    key={d.role}
                    onClick={() => {
                      setEmail(d.email);
                      setPassword(d.password);
                    }}
                    className="rounded-lg border border-[var(--color-border)] bg-white px-2 py-2 text-xs font-medium hover:border-blue-400 hover:bg-blue-50"
                  >
                    {d.role}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
