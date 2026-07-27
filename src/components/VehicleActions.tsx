"use client";

import { useState } from "react";
import { XCircle, Truck, Camera } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Field, Input, Modal } from "@/components/form";
import { apiSend } from "@/lib/use-data";
import { formatDate } from "@/lib/utils";
import { compressImage } from "@/lib/image";

const BRANDING_OPTIONS = [
  { value: "", label: "Select branding…" },
  { value: "YELLOW_DHL", label: "Yellow DHL Branded" },
  { value: "WHITE", label: "White Non-Branded" },
];

const PHOTO_POSITIONS = ["Front", "Back", "Right Side", "Left Side"] as const;

const OFFBOARD_CHECKLIST = [
  "Remove all yellow DHL brand decals",
  "Remove DHL logos from both sides",
  "Remove rear DHL branding",
  "Clean adhesive residue from all surfaces",
  "Return fuel card and toll tag",
  "Disconnect Samsara camera",
  "Record final odometer reading",
  "Return keys and accessories",
];

type Props = {
  vehicleId: string;
  branding: string | null;
  offboardedDate: string | null;
  offboardReason: string | null;
  onboardedDate: string | null;
  onboardPhotos: string | null;
  status: string;
};

export function VehicleActions({ vehicleId, branding: initialBranding, offboardedDate, offboardReason, onboardPhotos: initialPhotos, status }: Props) {
  const [branding, setBranding] = useState(initialBranding ?? "");
  const [offboardModal, setOffboardModal] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [isOffboarded, setIsOffboarded] = useState(!!offboardedDate);
  const [checklist, setChecklist] = useState<boolean[]>(new Array(OFFBOARD_CHECKLIST.length).fill(false));
  const [offboardPhotos, setOffboardPhotos] = useState<string[]>(["", "", "", ""]);

  // Branding photos (4 positions: front, back, right, left)
  const [brandingPhotos, setBrandingPhotos] = useState<string[]>(() => {
    try {
      const parsed = initialPhotos ? JSON.parse(initialPhotos) : [];
      // Ensure 4 slots
      return [...parsed, "", "", "", ""].slice(0, 4);
    } catch { return ["", "", "", ""]; }
  });

  async function updateBranding(val: string) {
    setBranding(val);
    await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", { branding: val || null });
  }

  async function saveBrandingPhoto(index: number, url: string) {
    const newPhotos = [...brandingPhotos];
    newPhotos[index] = url;
    setBrandingPhotos(newPhotos);
    await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", {
      onboardPhotos: JSON.stringify(newPhotos),
    });
  }

  async function offboard() {
    setSaving(true);
    const res = await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", {
      status: "OUT_OF_SERVICE",
      offboardedDate: new Date().toISOString(),
      offboardReason: reason + "\n\nOffboard Photos:\n" + PHOTO_POSITIONS.map((pos, i) => `${pos}: ${offboardPhotos[i] || "(not provided)"}`).join("\n"),
    });
    setSaving(false);
    if (res.ok) {
      setOffboardModal(false);
      setIsOffboarded(true);
    }
  }

  const allChecked = checklist.every(Boolean);
  const allOffboardPhotos = offboardPhotos.every((p) => p.trim().length > 0);

  return (
    <div className="mt-6">
      <Card>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Vehicle Management</h3>
            {!isOffboarded && status !== "OUT_OF_SERVICE" && (
              <Button onClick={() => { setReason(""); setChecklist(new Array(OFFBOARD_CHECKLIST.length).fill(false)); setOffboardPhotos(["", "", "", ""]); setOffboardModal(true); }} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5">
                <XCircle size={14} /> Offboard Vehicle
              </Button>
            )}
          </div>

          {/* Branding */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Truck size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">Branding:</span>
              <select
                value={branding}
                onChange={(e) => updateBranding(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm"
              >
                {BRANDING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {branding === "YELLOW_DHL" && (
                <Badge bg="#fef3c7" fg="#92400e">Yellow DHL</Badge>
              )}
              {branding === "WHITE" && (
                <Badge bg="#f1f5f9" fg="#475569">White Non-Branded</Badge>
              )}
            </div>

            {/* 4 Branding Photos */}
            <div className="grid grid-cols-4 gap-3">
              {PHOTO_POSITIONS.map((pos, i) => (
                <div key={pos} className="space-y-1">
                  <p className="text-[10px] font-medium text-slate-500 text-center">{pos}</p>
                  <div className="relative aspect-square rounded-lg border-2 border-dashed border-[var(--color-border)] bg-slate-50 overflow-hidden flex items-center justify-center">
                    {brandingPhotos[i] ? (
                      <img src={brandingPhotos[i]} alt={`${pos} view`} className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={20} className="text-slate-300" />
                    )}
                  </div>
                  <label className="block w-full cursor-pointer rounded border border-dashed border-[var(--color-border)] px-2 py-1 text-[10px] text-center text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                    {brandingPhotos[i] ? "Change" : "Upload"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", await compressImage(file));
                      const res = await fetch("/api/uploads", { method: "POST", body: fd });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data as { url: string }).url) saveBrandingPhoto(i, (data as { url: string }).url);
                      e.target.value = "";
                    }} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Offboard status */}
          {(isOffboarded || status === "OUT_OF_SERVICE") && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">Vehicle Offboarded</p>
              {offboardedDate && <p className="text-xs text-red-600 mt-0.5">Date: {formatDate(offboardedDate)}</p>}
              {offboardReason && <p className="text-xs text-red-600 mt-0.5 whitespace-pre-line">Reason: {offboardReason}</p>}
            </div>
          )}
        </div>
      </Card>

      {/* Offboard Modal */}
      <Modal open={offboardModal} onClose={() => setOffboardModal(false)} title="Offboard Vehicle">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Reason for Offboarding">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Totaled, Lease ended, Sold, Mechanical failure…"
            />
          </Field>

          {/* Responsibilities Checklist */}
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Offboarding Responsibilities</p>
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
              {OFFBOARD_CHECKLIST.map((item, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklist[i]}
                    onChange={() => {
                      const next = [...checklist];
                      next[i] = !next[i];
                      setChecklist(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span className={`text-sm ${checklist[i] ? "text-slate-400 line-through" : "text-slate-700"}`}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4 Offboard Photos */}
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Offboard Photos (Required)</p>
            <p className="text-[10px] text-slate-400 mb-2">Proof that DHL brand decals have been removed</p>
            <div className="grid grid-cols-2 gap-3">
              {PHOTO_POSITIONS.map((pos, i) => (
                <div key={pos} className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">{pos}</p>
                  <div className="relative aspect-video rounded-lg border-2 border-dashed border-[var(--color-border)] bg-slate-50 overflow-hidden flex items-center justify-center">
                    {offboardPhotos[i] ? (
                      <img src={offboardPhotos[i]} alt={`Offboard ${pos}`} className="w-full h-full object-cover" />
                    ) : (
                      <Camera size={20} className="text-slate-300" />
                    )}
                  </div>
                  <label className="block w-full cursor-pointer rounded border border-dashed border-[var(--color-border)] px-2 py-1 text-xs text-center text-slate-500 hover:border-blue-400 hover:bg-blue-50">
                    {offboardPhotos[i] ? "Change" : "Upload"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", await compressImage(file));
                      const res = await fetch("/api/uploads", { method: "POST", body: fd });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data as { url: string }).url) {
                        const next = [...offboardPhotos];
                        next[i] = (data as { url: string }).url;
                        setOffboardPhotos(next);
                      }
                      e.target.value = "";
                    }} />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {!allChecked && <p className="text-xs text-amber-600">Complete all checklist items before offboarding.</p>}
          {!allOffboardPhotos && <p className="text-xs text-amber-600">All 4 photos are required.</p>}

          <Button
            onClick={offboard}
            disabled={saving || !reason || !allChecked || !allOffboardPhotos}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {saving ? "Processing…" : "Confirm Offboard"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
