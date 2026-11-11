"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Field, Input, Select, Modal } from "@/components/form";
import { apiSend } from "@/lib/use-data";
import { FLEET_GROUP_LABEL, IS_TROVA } from "@/lib/constants";

export type BulkRenewDoc = "insurance" | "dotInspection";
export type BulkRenewVehicle = { station: string | null; fleetGroup?: string | null };

const TITLE: Record<BulkRenewDoc, string> = {
  insurance: "Update fleet insurance",
  dotInspection: "Update DOT inspection for all trucks",
};

/** One form that renews a compliance document for every active vehicle
 *  (optionally one station / fleet), instead of vehicle by vehicle. */
export function BulkRenewButton({
  doc,
  vehicles,
  onDone,
}: {
  doc: BulkRenewDoc;
  vehicles: BulkRenewVehicle[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newExpiry, setNewExpiry] = useState("");
  const [renewedOn, setRenewedOn] = useState("");
  const [station, setStation] = useState("");
  const [fleetGroup, setFleetGroup] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stations = [...new Set(vehicles.map((v) => v.station).filter((s): s is string => !!s))].sort();
  const showFleet = doc === "insurance" && !IS_TROVA;
  const count = vehicles.filter(
    (v) => (!station || v.station === station) && (!fleetGroup || (v.fleetGroup ?? "REGULAR") === fleetGroup),
  ).length;

  function show() {
    setNewExpiry("");
    setRenewedOn(new Date().toISOString().slice(0, 10));
    setStation("");
    setFleetGroup("");
    setNote("");
    setError("");
    setOpen(true);
  }

  async function save() {
    if (!newExpiry) {
      setError("Enter the new expiry date");
      return;
    }
    setSaving(true);
    setError("");
    const res = await apiSend("/api/vehicles/bulk-renew", "POST", {
      doc,
      newExpiry,
      renewedOn: renewedOn || null,
      station: station || null,
      fleetGroup: fleetGroup || null,
      note: note || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save");
      return;
    }
    setOpen(false);
    onDone?.();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
      >
        <RefreshCw size={14} /> {doc === "insurance" ? "Update insurance for all" : "Update DOT for all trucks"}
      </button>
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={TITLE[doc]}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || count === 0}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : `Update ${count} vehicle${count === 1 ? "" : "s"}`}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="New expiry date" required>
            <Input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} autoFocus />
          </Field>
          <Field label={doc === "insurance" ? "Renewed on" : "Inspection date"}>
            <Input type="date" value={renewedOn} onChange={(e) => setRenewedOn(e.target.value)} />
          </Field>
          <Field label="Station">
            <Select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              options={[{ value: "", label: "All stations" }, ...stations.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          {showFleet && (
            <Field label="Fleet">
              <Select
                value={fleetGroup}
                onChange={(e) => setFleetGroup(e.target.value)}
                options={[{ value: "", label: "All fleets" }, ...Object.entries(FLEET_GROUP_LABEL).map(([value, label]) => ({ value, label }))]}
              />
            </Field>
          )}
          <Field label="Note (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Policy #, carrier…" />
          </Field>
          <p className="text-xs text-slate-500">
            Sets the new expiry on <strong>{count}</strong> active vehicle{count === 1 ? "" : "s"}
            {doc === "dotInspection" ? " (trucks)" : ""}. Out-of-service and off-boarded vehicles are skipped.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
