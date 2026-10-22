import type { OrderTab } from "../schemas/order-list.schema";
import type { OrderList } from "../schemas/order-list.schema";

export type OrderTabDefinition = {
  id: OrderTab;
  label: string;
  countKey: keyof OrderList["tabCounts"];
};

export const orderTabs: OrderTabDefinition[] = [
  { id: "all", label: "All parcels", countKey: "all" },
  { id: "needs_pickup", label: "Needs pickup", countKey: "needsPickup" },
  { id: "exceptions", label: "Exceptions", countKey: "exceptions" },
];
