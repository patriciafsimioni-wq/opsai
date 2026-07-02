"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Modal, Field, Input, Select } from "@/components/form";
import { formatCurrency, formatDate } from "@/lib/utils";

type ActiveVehicle = {
  id: string;
  name: string;
  dxNumber: string | null;
  year: number;
  make: string | null;
  model: string | null;
  odometer: number;
  station: string;
  branding: string | null;
  leasingCompany: string | null;
  leaseEndDate: Date | string | null;
  monthsLeftPayoff: number | null;
  monthlyPayment: number | null;
  totalRentPerMonth: number | null;
  paidOff: boolean;
};

type InProgressVehicle = ActiveVehicle & {
  offboardReason: string | null;
  offboardStatus: string | null;
  offboardMileage: number | null;
  offboardBrandingRemoved: boolean;
  offboardCameraRemoved: boolean;
  offboardPickupRequested: boolean;
  offboardPickupDate: Date | string | null;
  offboardSoldAmount: number | null;
  offboardedDate: Date | string | null;
  hasSamsaraCamera: boolean;
  totalInvestment: number;
};

type CompletedVehicle = {
  id: string;
  name: string;
  dxNumber: string | null;
  year: number;
  make: string | null;
  model: string | null;
  offboardReason: string | null;
  offboardMileage: number | null;
  offboardSoldAmount: number | null;
  offboardedDate: Date | string | null;
  offboardPickupDate: Date | string | null;
  station: string;
};

const REASONS = [
  { value: "", label: "Select reason..." },
  { value: "End of Lease", label: "End of Lease" },
  { value: "High Mileage", label: "High Mileage" },
  { value: "Age Compliance", label: "Age Compliance (4yr van / 7yr truck)" },
  { value: "Total Loss", label: "Total Loss / Accident" },
  { value: "Excessive Repairs", label: "Excessive Repair Costs" },
  { value: "Downsizing Fleet", label: "Downsizing Fleet" },
  { value: "Vehicle Sold", label: "Vehicle Sold" },
  { value: "Other", label: "Other" },
];

export function OffboardingClient({
  activeVehicles,
  inProgress,
  completed,
}: {
  activeVehicles: ActiveVehicle[];
  inProgress: InProgressVehicle[];
  completed: CompletedVehicle[];
}) {
  const [tab, setTab] = useState<"active" | "in_progress" | "completed">("in_progress");
  const [selected, setSelected] = useState<string[]>([]);
  const [startModal, setStartModal] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function startOffboarding() {
    if (!reason || selected.length === 0) return;
    setSaving(true);
    await fetch("/api/offboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", vehicleIds: selected, reason }),
    });
    setSaving(false);
    setStartModal(false);
    setSelected([]);
    setReason("");
    window.location.reload();
  }

  async function updateStep(vehicleId: string, data: Record<string, unknown>) {
    await fetch("/api/offboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", vehicleId, ...data }),
    });
    window.location.reload();
  }

  async function completeOffboard(vehicleId: string) {
    await fetch("/api/offboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", vehicleId }),
    });
    window.location.reload();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const tabs = [
    { key: "in_progress", label: `In Progress (${inProgress.length})` },
    { key: "active", label: `Start Offboard (${activeVehicles.length})` },
    { key: "completed", label: `Completed (${completed.length})` },
  ] as const;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Start Offboard tab — select vehicles */}
      {tab === "active" && (
        <div>
          {selected.length > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-blue-700">{selected.length} vehicle(s) selected</span>
              <Button onClick={() => setStartModal(true)} className="ml-auto">
                Start Offboarding
              </Button>
            </div>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-4 py-2 text-left w-8">
                      <input
                        type="checkbox"
                        checked={selected.length === activeVehicles.length && activeVehicles.length > 0}
                        onChange={() =>
                          setSelected(selected.length === activeVehicles.length ? [] : activeVehicles.map((v) => v.id))
                        }
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Vehicle</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Station</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Odometer</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Branding</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Lease</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {activeVehicles.map((v) => (
                    <tr key={v.id} className={`hover:bg-slate-50 ${selected.includes(v.id) ? "bg-blue-50" : ""}`}>
                      <td className="px-4 py-2">
                        <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggleSelect(v.id)} />
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{v.dxNumber ?? v.name}</p>
                        <p className="text-xs text-slate-400">{v.year} {v.make} {v.model}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{v.station}</td>
                      <td className="px-4 py-2 text-slate-600">{v.odometer > 0 ? `${v.odometer.toLocaleString()} mi` : "—"}</td>
                      <td className="px-4 py-2">
                        {v.branding === "YELLOW_DHL" ? (
                          <Badge bg="bg-yellow-100" fg="text-yellow-800">Yellow DHL</Badge>
                        ) : (
                          <Badge bg="bg-slate-100" fg="text-slate-600">White</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {v.paidOff ? "Paid Off" : v.leasingCompany ? `${v.leasingCompany} · ${v.monthsLeftPayoff ?? "?"}mo left` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* In Progress tab — track steps */}
      {tab === "in_progress" && (
        <div className="space-y-4">
          {inProgress.length === 0 && (
            <Card>
              <p className="p-8 text-center text-sm text-slate-400">No vehicles currently being offboarded. Go to &quot;Start Offboard&quot; tab to begin.</p>
            </Card>
          )}
          {inProgress.map((v) => {
            const leaseEnd = v.leaseEndDate ? new Date(v.leaseEndDate) : null;
            const monthsLeft = leaseEnd ? Math.max(0, Math.round((leaseEnd.getTime() - Date.now()) / (30 * 86400000))) : v.monthsLeftPayoff;
            const steps = [
              { label: "Reason", done: !!v.offboardReason, value: v.offboardReason },
              { label: "Mileage", done: !!(v.offboardMileage && v.offboardMileage > 0), value: v.offboardMileage ? `${v.offboardMileage.toLocaleString()} mi` : null },
              { label: "Total Investment", done: true, value: formatCurrency(v.totalInvestment) },
              { label: "Lease Schedule", done: true, value: v.paidOff ? "Paid Off" : `${monthsLeft ?? "?"}mo left · ${formatCurrency((v.monthlyPayment ?? v.totalRentPerMonth ?? 0))}/mo` },
              { label: "Remove DHL Branding", done: v.offboardBrandingRemoved, value: v.offboardBrandingRemoved ? "Done" : "Pending" },
              { label: "Remove Samsara Camera", done: v.offboardCameraRemoved, value: v.offboardCameraRemoved ? "Done" : "Pending" },
              { label: "Request Leasing Pickup", done: v.offboardPickupRequested, value: v.offboardPickupRequested ? "Requested" : "Not yet" },
              { label: "Pickup Date", done: !!v.offboardPickupDate, value: v.offboardPickupDate ? formatDate(new Date(v.offboardPickupDate)) : "Not set" },
              { label: "Vehicle Sold Amount", done: v.offboardSoldAmount != null && v.offboardSoldAmount > 0, value: v.offboardSoldAmount ? formatCurrency(v.offboardSoldAmount) : "Not set" },
            ];
            const completedSteps = steps.filter((s) => s.done).length;
            const allDone = completedSteps >= 7; // At least 7/9 steps done (mileage + branding + camera + pickup request + pickup date or sold amount)

            return (
              <Card key={v.id}>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{v.dxNumber ?? v.name}</h3>
                      <p className="text-sm text-slate-500">{v.year} {v.make} {v.model} · {v.station}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge bg="bg-orange-100" fg="text-orange-700">Offboarding</Badge>
                      <span className="text-xs text-slate-400">{completedSteps}/{steps.length} steps</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${(completedSteps / steps.length) * 100}%` }}
                    />
                  </div>

                  {/* Steps checklist */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {steps.map((step, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                          step.done ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          step.done ? "bg-green-600 text-white" : "bg-slate-200 text-slate-500"
                        }`}>
                          {step.done ? "✓" : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700">{step.label}</p>
                          <p className="text-[10px] text-slate-500 truncate">{step.value ?? "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons for incomplete steps */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <EditOffboardButton vehicle={v} onSave={updateStep} />
                    {!v.offboardMileage && (
                      <MileageButton vehicleId={v.id} currentOdo={v.odometer} onSave={updateStep} />
                    )}
                    {!v.offboardBrandingRemoved && (
                      <Button
                        onClick={() => updateStep(v.id, { offboardBrandingRemoved: true })}
                        className="text-xs"
                      >
                        Mark Branding Removed
                      </Button>
                    )}
                    {!v.offboardCameraRemoved && (
                      <Button
                        onClick={() => updateStep(v.id, { offboardCameraRemoved: true })}
                        className="text-xs"
                      >
                        Mark Camera Removed
                      </Button>
                    )}
                    {!v.offboardPickupRequested && (
                      <Button
                        onClick={() => updateStep(v.id, { offboardPickupRequested: true })}
                        className="text-xs"
                      >
                        Mark Pickup Requested
                      </Button>
                    )}
                    {v.offboardPickupRequested && !v.offboardPickupDate && (
                      <PickupDateButton vehicleId={v.id} onSave={updateStep} />
                    )}
                    {!v.offboardSoldAmount && (
                      <SoldAmountButton vehicleId={v.id} onSave={updateStep} />
                    )}
                    {allDone && (
                      <Button
                        onClick={() => completeOffboard(v.id)}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white ml-auto"
                      >
                        Complete Offboarding
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed tab */}
      {tab === "completed" && (
        <Card>
          {completed.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-400">No completed offboardings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Vehicle</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Reason</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Mileage</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Sold Amount</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Pickup Date</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Offboarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {completed.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2">
                        <p className="font-medium">{v.dxNumber ?? v.name}</p>
                        <p className="text-xs text-slate-400">{v.year} {v.make} {v.model}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{v.offboardReason ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.offboardMileage ? `${v.offboardMileage.toLocaleString()} mi` : "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.offboardSoldAmount ? formatCurrency(v.offboardSoldAmount) : "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.offboardPickupDate ? formatDate(new Date(v.offboardPickupDate)) : "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{v.offboardedDate ? formatDate(new Date(v.offboardedDate)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Start Offboarding Modal */}
      <Modal open={startModal} onClose={() => setStartModal(false)} title="Start Offboarding">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            You are offboarding <strong>{selected.length} vehicle(s)</strong>. Select a reason:
          </p>
          <Field label="Reason for Offboarding">
            <Select value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS} />
          </Field>
          <Button onClick={startOffboarding} disabled={saving || !reason} className="w-full">
            {saving ? "Starting..." : "Start Offboarding Process"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// Inline mini-components for step actions
function MileageButton({ vehicleId, currentOdo, onSave }: { vehicleId: string; currentOdo: number; onSave: (id: string, data: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState(currentOdo > 0 ? String(currentOdo) : "");
  return (
    <>
      <Button onClick={() => setShow(true)} className="text-xs">Record Mileage</Button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium mb-2">Offboard Mileage</p>
            <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Enter mileage" type="number" />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => { onSave(vehicleId, { offboardMileage: Number(val) }); setShow(false); }} className="flex-1">Save</Button>
              <Button onClick={() => setShow(false)} className="flex-1 bg-slate-100 text-slate-700">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PickupDateButton({ vehicleId, onSave }: { vehicleId: string; onSave: (id: string, data: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState("");
  return (
    <>
      <Button onClick={() => setShow(true)} className="text-xs">Set Pickup Date</Button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium mb-2">Vehicle Pickup Date</p>
            <Input value={val} onChange={(e) => setVal(e.target.value)} type="date" />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => { onSave(vehicleId, { offboardPickupDate: val }); setShow(false); }} className="flex-1">Save</Button>
              <Button onClick={() => setShow(false)} className="flex-1 bg-slate-100 text-slate-700">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EditOffboardButton({ vehicle, onSave }: { vehicle: InProgressVehicle; onSave: (id: string, data: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState(vehicle.offboardReason || "");
  const [mileage, setMileage] = useState(vehicle.offboardMileage ? String(vehicle.offboardMileage) : "");
  const [soldAmount, setSoldAmount] = useState(vehicle.offboardSoldAmount ? String(vehicle.offboardSoldAmount) : "");
  const [pickupDate, setPickupDate] = useState(vehicle.offboardPickupDate ? new Date(vehicle.offboardPickupDate).toISOString().slice(0, 10) : "");
  return (
    <>
      <Button onClick={() => setShow(true)} className="text-xs" variant="secondary">
        <Pencil size={13} /> Edit
      </Button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-5 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold mb-3">Edit Offboarding — {vehicle.dxNumber ?? vehicle.name}</p>
            <div className="space-y-3">
              <Field label="Reason">
                <Select value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS} />
              </Field>
              <Field label="Mileage">
                <Input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Enter mileage" type="number" />
              </Field>
              <Field label="Pickup Date">
                <Input value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} type="date" />
              </Field>
              <Field label="Sold Amount">
                <Input value={soldAmount} onChange={(e) => setSoldAmount(e.target.value)} placeholder="$0.00" type="number" />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => {
                  const data: Record<string, unknown> = {};
                  if (reason && reason !== vehicle.offboardReason) data.offboardReason = reason;
                  if (mileage) data.offboardMileage = Number(mileage);
                  if (pickupDate) data.offboardPickupDate = pickupDate;
                  if (soldAmount) data.offboardSoldAmount = Number(soldAmount);
                  if (Object.keys(data).length > 0) onSave(vehicle.id, data);
                  setShow(false);
                }}
                className="flex-1"
              >
                Save Changes
              </Button>
              <Button onClick={() => setShow(false)} className="flex-1 bg-slate-100 text-slate-700">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SoldAmountButton({ vehicleId, onSave }: { vehicleId: string; onSave: (id: string, data: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState("");
  return (
    <>
      <Button onClick={() => setShow(true)} className="text-xs">Set Sold Amount</Button>
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShow(false)}>
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium mb-2">Vehicle Sold Amount</p>
            <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="$0.00" type="number" />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => { onSave(vehicleId, { offboardSoldAmount: Number(val) }); setShow(false); }} className="flex-1">Save</Button>
              <Button onClick={() => setShow(false)} className="flex-1 bg-slate-100 text-slate-700">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
