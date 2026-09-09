import type { WorkOrderDTO } from "./types";

export type WorkOrderLine = {
  order: WorkOrderDTO;
  /** 1-based position within the work order (1 of N). */
  index: number;
  count: number;
  service: string;
  category: string;
  description: string;
  materialCost: number;
  laborCost: number;
  total: number;
};

/**
 * Flatten a work order into one row per service performed. Multi-service
 * orders yield one line per item (each with its own description and cost);
 * single-service orders yield a single line built from the order itself.
 */
export function workOrderLines(orders: WorkOrderDTO[]): WorkOrderLine[] {
  const out: WorkOrderLine[] = [];
  for (const o of orders) {
    const items = o.items ?? [];
    if (items.length > 1) {
      items.forEach((it, i) => {
        out.push({
          order: o,
          index: i + 1,
          count: items.length,
          service: it.service?.name ?? it.title,
          category: it.service?.category ?? o.service?.category ?? "",
          description: it.description ?? "",
          materialCost: it.materialCost,
          laborCost: it.laborCost,
          total: it.materialCost + it.laborCost,
        });
      });
    } else {
      const it = items[0];
      out.push({
        order: o,
        index: 1,
        count: 1,
        service: it?.service?.name ?? o.service?.name ?? it?.title ?? o.title,
        category: it?.service?.category ?? o.service?.category ?? "",
        description: it?.description ?? o.description ?? "",
        materialCost: o.materialCost,
        laborCost: o.laborCost,
        total: o.cost,
      });
    }
  }
  return out;
}
