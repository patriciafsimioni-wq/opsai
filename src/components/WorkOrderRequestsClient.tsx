"use client";

import { useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Table,
  Th,
  Td,
  SortTh,
  EmptyState,
  StatCard,
} from "@/components/ui";
import { Field, Input, Select, Textarea, Modal } from "@/components/form";
import { useData, apiSend } from "@/lib/use-data";
import { useTableSort } from "@/lib/use-sort";
import type { WorkOrderRequestDTO, VehicleDTO, ServiceDTO } from "@/lib/types";
import {
  FORM_STATIONS,
  STATION_LABEL,
  WO_REQUEST_STATUS,
  PARTS_LIST,
} from "@/lib/constants";
import { formatCurrency, formatDate, todayInputDate } from "@/lib/utils";

function todayStr() {
  return todayInputDate();
}

function StatusBadge({ status }: { status: string }) {
  const s = WO_REQUEST_STATUS[status as keyof typeof WO_REQUEST_STATUS] ?? {
    label: status,
    bg: "#f1f5f9",
    fg: "#475569",
  };
  return (
    <Badge bg={s.bg} fg={s.fg}>
      {s.label}
    </Badge>
  );
}

export function WorkOrderRequestsClient({
  canManage,
}: {
  canManage: boolean;
}) {
  const {
    data: requests,
    loading,
    reload,
  } = useData<WorkOrderRequestDTO[]>("/api/work-order-requests");
  const { data: vehicles } = useData<VehicleDTO[]>("/api/vehicles?fleet=1");
  const { data: services } = useData<ServiceDTO[]>("/api/services");

  const [showForm, setShowForm] = useState(false);
  const [reviewModal, setReviewModal] = useState<WorkOrderRequestDTO | null>(
    null,
  );
  const [detailModal, setDetailModal] = useState<WorkOrderRequestDTO | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // --- Form state ---
  const [form, setForm] = useState({
    station: "IAH",
    vehicleId: "",
    vehicleOther: "",
    odometer: "",
    serviceId: "",
    partsNeeded: [] as string[],
    requestedDate: todayStr(),
    expectedCompletion: "",
    comments: "",
    serviceHours: "",
    vendorEstimate: "",
    requesterEmail: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // --- Review state ---
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">(
    "APPROVED",
  );
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const stationVehicles = useMemo(
    () =>
      (vehicles ?? []).filter(
        (v) => v.station === form.station,
      ),
    [vehicles, form.station],
  );

  const allServices = useMemo(
    () => (services ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    [services],
  );

  const sort = useTableSort<WorkOrderRequestDTO, "po" | "station" | "vehicle" | "service" | "requestedBy" | "submitted" | "serviceDate" | "estimate" | "status">(
    {
      po: (r) => (r.poNumber ?? "").toLowerCase(),
      station: (r) => r.station ?? "",
      vehicle: (r) => (r.vehicle ? `${r.vehicle.licensePlate} ${r.vehicle.name}` : r.vehicleOther ?? "").toLowerCase(),
      service: (r) => (r.service?.name ?? "").toLowerCase(),
      requestedBy: (r) => r.requestedBy.name.toLowerCase(),
      submitted: (r) => (r.createdAt ? new Date(r.createdAt).getTime() : null),
      serviceDate: (r) => (r.requestedDate ? new Date(r.requestedDate).getTime() : null),
      estimate: (r) => r.vendorEstimate ?? null,
      status: (r) => r.status,
    },
    "submitted",
    "desc",
  );

  const filtered = useMemo(() => {
    const list = requests ?? [];
    const result = filterStatus === "ALL" ? list : list.filter((r) => r.status === filterStatus);
    return sort.sortRows(result);
  }, [requests, filterStatus, sort]);

  const counts = useMemo(() => {
    const list = requests ?? [];
    return {
      total: list.length,
      pending: list.filter((r) => r.status === "PENDING").length,
      approved: list.filter((r) => r.status === "APPROVED").length,
      rejected: list.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  function onSelectVehicle(vehicleId: string) {
    if (vehicleId === "__other__") {
      setForm((f) => ({ ...f, vehicleId: "", vehicleOther: f.vehicleOther }));
      return;
    }
    const v = stationVehicles.find((x) => x.id === vehicleId);
    setForm((f) => ({
      ...f,
      vehicleId,
      vehicleOther: "",
      odometer: v ? String(v.odometer) : f.odometer,
    }));
  }

  function togglePart(part: string) {
    setForm((f) => ({
      ...f,
      partsNeeded: f.partsNeeded.includes(part)
        ? f.partsNeeded.filter((p) => p !== part)
        : [...f.partsNeeded, part],
    }));
  }

  const valid =
    form.station &&
    (form.vehicleId || form.vehicleOther.trim()) &&
    form.serviceId &&
    form.requestedDate &&
    form.requesterEmail.trim();

  async function submit() {
    setSaving(true);
    setError("");
    setSavedMsg("");

    let photoUrl: string | null = null;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/uploads", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setSaving(false);
        setError(
          (upData as { error?: string }).error ?? "Photo upload failed",
        );
        return;
      }
      photoUrl = (upData as { url: string }).url;
    }

    const payload = {
      station: form.station,
      vehicleId: form.vehicleId || null,
      vehicleOther: form.vehicleOther.trim() || null,
      odometer: form.odometer || null,
      serviceId: form.serviceId,
      partsNeeded: form.partsNeeded.join(", ") || null,
      requestedDate: form.requestedDate || null,
      expectedCompletion: form.expectedCompletion || null,
      comments: form.comments.trim() || null,
      photoUrl,
      serviceHours: form.serviceHours || null,
      vendorEstimate: form.vendorEstimate || null,
      requesterEmail: form.requesterEmail.trim() || null,
    };

    const res = await apiSend("/api/work-order-requests", "POST", payload);
    setSaving(false);
    if (res.ok) {
      setSavedMsg("Work order request submitted successfully!");
      setForm({
        station: "IAH",
        vehicleId: "",
        vehicleOther: "",
        odometer: "",
        serviceId: "",
        partsNeeded: [],
        requestedDate: todayStr(),
        expectedCompletion: "",
        comments: "",
        serviceHours: "",
        vendorEstimate: "",
        requesterEmail: "",
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      reload();
    } else {
      setError(res.error ?? "Failed to submit request");
    }
  }

  async function submitReview() {
    if (!reviewModal) return;
    setReviewing(true);
    const res = await apiSend(
      `/api/work-order-requests/${reviewModal.id}`,
      "PATCH",
      {
        status: reviewAction,
        reviewNote: reviewNote.trim() || null,
      },
    );
    setReviewing(false);
    if (res.ok) {
      setReviewModal(null);
      setReviewNote("");
      reload();
    }
  }

  const useOther = !form.vehicleId && form.vehicleOther !== undefined;
  const showOtherInput =
    useOther &&
    !stationVehicles.find((v) => v.id === form.vehicleId);

  const pendingFiltered = filtered.filter((r) => r.status === "PENDING");
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every((r) => selectedIds.has(r.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map((r) => r.id)));
    }
  }

  async function bulkUpdateStatus() {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    await Promise.all(
      ids.map((id) =>
        apiSend(`/api/work-order-requests/${id}`, "PATCH", {
          status: bulkAction,
          reviewNote: `Bulk ${bulkAction.toLowerCase()} (${ids.length} requests)`,
        }),
      ),
    );
    setBulkProcessing(false);
    setSelectedIds(new Set());
    reload();
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Requests"
          value={counts.total}
          icon={<ClipboardList size={20} />}
        />
        <StatCard
          label="Pending"
          value={counts.pending}
          icon={<ClipboardList size={20} />}
          accent="#d97706"
        />
        <StatCard
          label="Approved"
          value={counts.approved}
          icon={<Check size={20} />}
          accent="#16a34a"
        />
        <StatCard
          label="Rejected"
          value={counts.rejected}
          icon={<X size={20} />}
          accent="#dc2626"
        />
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "ALL" ? "All" : WO_REQUEST_STATUS[s as keyof typeof WO_REQUEST_STATUS]?.label ?? s}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm(true)}>
          <ClipboardList size={16} /> New Request
        </Button>
      </div>

      {/* Bulk actions */}
      {canManage && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value as "APPROVED" | "REJECTED")}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1 text-sm"
          >
            <option value="APPROVED">Approve</option>
            <option value="REJECTED">Reject</option>
          </select>
          <button
            onClick={bulkUpdateStatus}
            disabled={bulkProcessing}
            className={`rounded-lg px-3 py-1 text-sm font-medium text-white transition-colors ${
              bulkAction === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            } disabled:opacity-50`}
          >
            {bulkProcessing ? "Processing..." : `${bulkAction === "APPROVED" ? "Approve" : "Reject"} All`}
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Request list */}
      <Card>
        <CardHeader title="Work Order Requests" />
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={40} />}
            title="No requests found"
            description="Submit a work order request to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  {canManage && (
                    <Th>
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300"
                        title="Select all pending"
                      />
                    </Th>
                  )}
                  <SortTh label="PO#" col="po" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Station" col="station" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Vehicle" col="vehicle" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Service" col="service" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Requested By" col="requestedBy" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Date Submitted" col="submitted" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Service Date" col="serviceDate" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Estimate" col="estimate" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <SortTh label="Status" col="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggle} />
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <RequestRow
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    onToggle={() =>
                      setExpandedId(expandedId === r.id ? null : r.id)
                    }
                    canManage={canManage}
                    selected={selectedIds.has(r.id)}
                    onSelect={() => toggleSelect(r.id)}
                    onReview={() => {
                      setReviewModal(r);
                      setReviewAction("APPROVED");
                      setReviewNote("");
                    }}
                    onDetail={() => setDetailModal(r)}
                  />
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      {/* New request modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="New Work Order Request"
        wide
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || !valid}>
              {saving ? "Submitting..." : "Submit Request"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Section 1: Station */}
          <Field label="Station" required>
            <Select
              value={form.station}
              onChange={(e) =>
                setForm({ ...form, station: e.target.value, vehicleId: "", vehicleOther: "" })
              }
              options={FORM_STATIONS.map((s) => ({
                value: s,
                label: STATION_LABEL[s],
              }))}
            />
          </Field>

          {/* Section 2: Vehicle */}
          <Field label="DX Number / License Plate" required>
            <Select
              value={form.vehicleId || (showOtherInput ? "__other__" : "")}
              onChange={(e) => onSelectVehicle(e.target.value)}
              options={[
                { value: "", label: "Choose..." },
                ...stationVehicles.map((v) => ({
                  value: v.id,
                  label: `${v.licensePlate} - ${v.name}`,
                })),
                { value: "__other__", label: "Other (type below)" },
              ]}
            />
          </Field>

          {(showOtherInput || form.vehicleOther) && (
            <Field label="Vehicle (Other)" className="sm:col-span-2">
              <Input
                placeholder="Enter vehicle identifier"
                value={form.vehicleOther}
                onChange={(e) =>
                  setForm({ ...form, vehicleOther: e.target.value })
                }
              />
            </Field>
          )}

          {/* Section 3: Odometer */}
          <Field label="Mileage / Odometer">
            <Input
              type="number"
              min="0"
              value={form.odometer}
              onChange={(e) => setForm({ ...form, odometer: e.target.value })}
            />
          </Field>

          {/* Section 4: Service */}
          <Field label="Service Requested" required>
            <Select
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              options={[
                { value: "", label: "Choose..." },
                ...allServices.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.category})`,
                })),
              ]}
            />
          </Field>

          {/* Section 5: Parts needed */}
          <div className="sm:col-span-2">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Parts Needed
            </span>
            <div className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
              {PARTS_LIST.map((part) => (
                <button
                  key={part}
                  type="button"
                  onClick={() => togglePart(part)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    form.partsNeeded.includes(part)
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {part}
                </button>
              ))}
            </div>
            {form.partsNeeded.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Selected: {form.partsNeeded.join(", ")}
              </p>
            )}
          </div>

          {/* Section 6: Dates */}
          <Field label="Requested Service Date" required>
            <Input
              type="date"
              value={form.requestedDate}
              onChange={(e) =>
                setForm({ ...form, requestedDate: e.target.value })
              }
            />
          </Field>
          <Field label="Expected Completion Date">
            <Input
              type="date"
              value={form.expectedCompletion}
              onChange={(e) =>
                setForm({ ...form, expectedCompletion: e.target.value })
              }
            />
          </Field>

          {/* Section 7: Comments / Photo / Hours / Estimate */}
          <Field label="Comments" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              placeholder="Describe the issue or reason for the request"
            />
          </Field>

          <Field label="Service Hours (estimated)">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.serviceHours}
              onChange={(e) =>
                setForm({ ...form, serviceHours: e.target.value })
              }
            />
          </Field>

          <Field label="Vendor Estimate ($)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.vendorEstimate}
              onChange={(e) =>
                setForm({ ...form, vendorEstimate: e.target.value })
              }
            />
          </Field>

          <Field label="Email for Notifications *">
            <Input
              type="email"
              placeholder="email@example.com"
              value={form.requesterEmail}
              onChange={(e) =>
                setForm({ ...form, requesterEmail: e.target.value })
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Approval/rejection notifications will be sent to this email.
            </p>
          </Field>

          <div className="sm:col-span-2">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Photo Upload{" "}
              <span className="text-slate-400">(max 10 MB)</span>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {savedMsg && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {savedMsg}
          </p>
        )}
      </Modal>

      {/* Review modal */}
      <Modal
        open={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Review Work Order Request"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setReviewModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === "REJECTED" ? "danger" : "primary"}
              onClick={submitReview}
              disabled={reviewing}
            >
              {reviewing
                ? "Saving..."
                : reviewAction === "APPROVED"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </>
        }
      >
        {reviewModal && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              {reviewModal.poNumber && (
                <p>
                  <strong>PO#:</strong>{" "}
                  <span className="font-mono font-semibold">{reviewModal.poNumber}</span>
                </p>
              )}
              <p>
                <strong>Requester:</strong> {reviewModal.requestedBy.name}
              </p>
              <p>
                <strong>Station:</strong>{" "}
                {STATION_LABEL[reviewModal.station] ?? reviewModal.station}
              </p>
              <p>
                <strong>Vehicle:</strong>{" "}
                {reviewModal.vehicle
                  ? `${reviewModal.vehicle.licensePlate} - ${reviewModal.vehicle.name}`
                  : reviewModal.vehicleOther ?? "N/A"}
              </p>
              <p>
                <strong>Service:</strong>{" "}
                {reviewModal.service?.name ?? "N/A"}
              </p>
              {reviewModal.vendorEstimate != null && (
                <p>
                  <strong>Vendor Estimate:</strong>{" "}
                  {formatCurrency(reviewModal.vendorEstimate)}
                </p>
              )}
              {reviewModal.comments && (
                <p>
                  <strong>Comments:</strong> {reviewModal.comments}
                </p>
              )}
              {reviewModal.photoUrl && (
                <p>
                  <a
                    href={reviewModal.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <ImageIcon size={14} /> View attached photo
                  </a>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReviewAction("APPROVED")}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  reviewAction === "APPROVED"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <Check size={16} className="mr-1 inline" /> Approve
              </button>
              <button
                onClick={() => setReviewAction("REJECTED")}
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                  reviewAction === "REJECTED"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                <X size={16} className="mr-1 inline" /> Reject
              </button>
            </div>

            <Field label="Review Note (optional)">
              <Textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a note for the requester..."
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* Detail modal */}
      <Modal
        open={!!detailModal}
        onClose={() => setDetailModal(null)}
        title="Request Details"
        wide
      >
        {detailModal && <RequestDetail r={detailModal} />}
      </Modal>
    </div>
  );
}

function RequestRow({
  r,
  expanded,
  onToggle,
  canManage,
  selected,
  onSelect,
  onReview,
  onDetail,
}: {
  r: WorkOrderRequestDTO;
  expanded: boolean;
  onToggle: () => void;
  canManage: boolean;
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onDetail: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        {canManage && (
          <Td>
            {r.status === "PENDING" && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => { e.stopPropagation(); onSelect(); }}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 rounded border-slate-300"
              />
            )}
          </Td>
        )}
        <Td className="font-mono text-xs font-semibold text-slate-700">
          {r.poNumber ?? "—"}
        </Td>
        <Td>
          <Badge bg="#eef2ff" fg="#3730a3">
            {r.station}
          </Badge>
        </Td>
        <Td className="text-slate-600">
          {r.vehicle
            ? `${r.vehicle.licensePlate} - ${r.vehicle.name}`
            : r.vehicleOther ?? "—"}
        </Td>
        <Td>
          <p className="font-medium">{r.service?.name ?? "—"}</p>
        </Td>
        <Td className="text-slate-600">{r.requestedBy.name}</Td>
        <Td className="text-slate-600">{formatDate(r.createdAt)}</Td>
        <Td className="text-slate-600">{formatDate(r.requestedDate)}</Td>
        <Td className="font-semibold">
          {r.vendorEstimate != null ? formatCurrency(r.vendorEstimate) : "—"}
        </Td>
        <Td>
          <StatusBadge status={r.status} />
        </Td>
        <Td>
          <div className="flex items-center gap-1">
            {canManage && r.status === "PENDING" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onReview();
                }}
              >
                Review
              </Button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDetail();
              }}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={canManage ? 12 : 11} className="border-b border-[var(--color-border)] bg-slate-50 px-6 py-3">
            <RequestDetail r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function RequestDetail({ r }: { r: WorkOrderRequestDTO }) {
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className="text-xs font-medium text-slate-400">PO Number</p>
        <p className="font-mono font-semibold">{r.poNumber ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Station</p>
        <p>{STATION_LABEL[r.station] ?? r.station}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Vehicle</p>
        <p>
          {r.vehicle
            ? `${r.vehicle.licensePlate} - ${r.vehicle.name}`
            : r.vehicleOther ?? "—"}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Odometer</p>
        <p>{r.odometer != null ? r.odometer.toLocaleString() : "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Service</p>
        <p>{r.service?.name ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Parts Needed</p>
        <p>{r.partsNeeded || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Requested Date</p>
        <p>{formatDate(r.requestedDate)}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">
          Expected Completion
        </p>
        <p>{formatDate(r.expectedCompletion)}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Service Hours</p>
        <p>{r.serviceHours ?? "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Vendor Estimate</p>
        <p>
          {r.vendorEstimate != null ? formatCurrency(r.vendorEstimate) : "—"}
        </p>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <p className="text-xs font-medium text-slate-400">Comments</p>
        <p>{r.comments || "—"}</p>
      </div>
      {r.photoUrl && (
        <div>
          <p className="text-xs font-medium text-slate-400">Photo</p>
          <a
            href={r.photoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
          >
            <ImageIcon size={14} /> View photo
          </a>
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-slate-400">Requested By</p>
        <p>{r.requestedBy.name}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">Status</p>
        <StatusBadge status={r.status} />
      </div>
      {r.reviewedBy && (
        <>
          <div>
            <p className="text-xs font-medium text-slate-400">Reviewed By</p>
            <p>{r.reviewedBy.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-400">Reviewed At</p>
            <p>{formatDate(r.reviewedAt)}</p>
          </div>
          {r.reviewNote && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs font-medium text-slate-400">Review Note</p>
              <p>{r.reviewNote}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
