"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";

export type RenewableDoc = "registration" | "insurance" | "dotInspection";

const LABEL: Record<RenewableDoc, string> = {
  registration: "Registration",
  insurance: "Insurance",
  dotInspection: "DOT Inspection",
};

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

/** One year on from the current expiry (or from today when the document is
 *  missing or already expired), which is the usual renewal term. */
function defaultNextExpiry(currentExpiry: string | null) {
  const today = isoToday();
  const base = currentExpiry && currentExpiry.slice(0, 10) > today ? currentExpiry.slice(0, 10) : today;
  const d = new Date(base + "T12:00:00Z");
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** "Renewed" pill that opens a small form to record a compliance document
 *  renewal: new expiry (pre-filled +1 year), renewal date, optional cost/note. */
export function RenewDocButton({
  vehicleId,
  doc,
  currentExpiry,
  size = "sm",
  onRenewed,
}: {
  vehicleId: string;
  doc: RenewableDoc;
  currentExpiry: string | null;
  size?: "sm" | "xs";
  onRenewed?: (newExpiryIso: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newExpiry, setNewExpiry] = useState("");
  const [renewedOn, setRenewedOn] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setNewExpiry(defaultNextExpiry(currentExpiry));
    setRenewedOn(isoToday());
    setCost("");
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!newExpiry) {
      setError("Enter the new expiry date");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc,
          newExpiry,
          renewedOn: renewedOn || undefined,
          cost: cost ? Number(cost) : null,
          note: note || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save renewal");
      setOpen(false);
      onRenewed?.(data.newExpiry);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save renewal");
    } finally {
      setSaving(false);
    }
  }

  const pill =
    size === "xs"
      ? "gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
      : "gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100";

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          show();
        }}
        className={`inline-flex items-center ${pill}`}
        title={`Mark ${LABEL[doc]} as renewed`}
      >
        <RefreshCw size={size === "xs" ? 10 : 12} /> Renewed
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{LABEL[doc]} renewed</h3>
                <p className="text-xs text-slate-500">
                  Current expiry:{" "}
                  {currentExpiry
                    ? new Date(currentExpiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "not set"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">New expiry date</span>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Renewed on</span>
                <input
                  type="date"
                  value={renewedOn}
                  onChange={(e) => setRenewedOn(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Cost (optional)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Sticker #, receipt…"
                    className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save renewal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
