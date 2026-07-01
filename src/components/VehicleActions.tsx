"use client";

import { useState } from "react";
import { Upload, XCircle, Truck } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";
import { Field, Input, Select, Modal } from "@/components/form";
import { apiSend } from "@/lib/use-data";
import { formatDate } from "@/lib/utils";

const BRANDING_OPTIONS = [
  { value: "", label: "Select branding…" },
  { value: "YELLOW_DHL", label: "Yellow DHL Branded" },
  { value: "WHITE", label: "White Non-Branded" },
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

export function VehicleActions({ vehicleId, branding: initialBranding, offboardedDate, offboardReason, onboardedDate, onboardPhotos: initialPhotos, status }: Props) {
  const [branding, setBranding] = useState(initialBranding ?? "");
  const [offboardModal, setOffboardModal] = useState(false);
  const [onboardModal, setOnboardModal] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<string[]>(() => {
    try { return initialPhotos ? JSON.parse(initialPhotos) : []; } catch { return []; }
  });
  const [photoUrls, setPhotoUrls] = useState("");
  const [isOffboarded, setIsOffboarded] = useState(!!offboardedDate);

  async function updateBranding(val: string) {
    setBranding(val);
    await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", { branding: val || null });
  }

  async function offboard() {
    setSaving(true);
    const res = await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", {
      status: "OUT_OF_SERVICE",
      offboardedDate: new Date().toISOString(),
      offboardReason: reason,
    });
    setSaving(false);
    if (res.ok) {
      setOffboardModal(false);
      setIsOffboarded(true);
    }
  }

  async function onboard() {
    setSaving(true);
    const urls = photoUrls.split("\n").map(u => u.trim()).filter(Boolean);
    const allPhotos = [...photos, ...urls];
    const res = await apiSend(`/api/vehicles/${vehicleId}`, "PATCH", {
      status: "ACTIVE",
      onboardedDate: new Date().toISOString(),
      onboardPhotos: JSON.stringify(allPhotos),
      offboardedDate: null,
      offboardReason: null,
    });
    setSaving(false);
    if (res.ok) {
      setOnboardModal(false);
      setPhotos(allPhotos);
      setIsOffboarded(false);
    }
  }

  return (
    <div className="mt-6">
      <Card>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Vehicle Management</h3>
            <div className="flex items-center gap-2">
              {!isOffboarded && (
                <Button onClick={() => { setReason(""); setOffboardModal(true); }} className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5">
                  <XCircle size={14} /> Offboard
                </Button>
              )}
              <Button onClick={() => { setPhotoUrls(""); setOnboardModal(true); }} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5">
                <Upload size={14} /> Onboard
              </Button>
            </div>
          </div>

          {/* Branding */}
          <div className="flex items-center gap-3">
            <Truck size={16} className="text-slate-400" />
            <span className="text-sm text-slate-600 w-20">Branding:</span>
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

          {/* Offboard status */}
          {isOffboarded && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">Vehicle Offboarded</p>
              {offboardedDate && <p className="text-xs text-red-600 mt-0.5">Date: {formatDate(offboardedDate)}</p>}
              {offboardReason && <p className="text-xs text-red-600 mt-0.5">Reason: {offboardReason}</p>}
            </div>
          )}

          {/* Onboard photos */}
          {photos.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Onboard Photos ({photos.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-lg bg-slate-100 border border-[var(--color-border)] overflow-hidden">
                    <img src={url} alt={`Onboard ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Offboard Modal */}
      <Modal open={offboardModal} onClose={() => setOffboardModal(false)} title="Offboard Vehicle">
        <div className="space-y-4">
          <Field label="Reason for Offboarding">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Totaled, Lease ended, Sold, Mechanical failure…"
            />
          </Field>
          <p className="text-xs text-slate-500">This will set the vehicle to Out of Service and record the offboard date and reason.</p>
          <Button onClick={offboard} disabled={saving || !reason} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {saving ? "Processing…" : "Confirm Offboard"}
          </Button>
        </div>
      </Modal>

      {/* Onboard Modal */}
      <Modal open={onboardModal} onClose={() => setOnboardModal(false)} title="Onboard Vehicle">
        <div className="space-y-4">
          <Field label="Photo URLs (one per line)">
            <textarea
              value={photoUrls}
              onChange={(e) => setPhotoUrls(e.target.value)}
              placeholder="Paste photo URLs here, one per line&#10;e.g. https://..."
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm min-h-[100px]"
            />
          </Field>
          <p className="text-xs text-slate-500">This will set the vehicle to Active, record onboard date, and save photos.</p>
          <Button onClick={onboard} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {saving ? "Processing…" : "Confirm Onboard"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
