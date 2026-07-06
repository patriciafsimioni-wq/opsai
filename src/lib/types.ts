import type {
  Vehicle,
  Driver,
  Trip,
  WorkOrder,
  WorkOrderRequest,
  FuelLog,
  Geofence,
  Alert,
  Service,
  User,
} from "@prisma/client";

// JSON-serialized variants (Dates become strings over the wire).
type Json<T> = {
  [K in keyof T]: T[K] extends Date | null
    ? string | null
    : T[K] extends Date
      ? string
      : T[K];
};

export type VehicleDTO = Json<Vehicle> & {
  assignedDriver?: Json<Driver> | null;
};

export type DriverDTO = Json<Driver> & {
  vehicles?: Json<Vehicle>[];
  _count?: { trips: number };
};

export type TripDTO = Json<Trip> & {
  vehicle: Json<Vehicle>;
  driver: Json<Driver> | null;
};

export type WorkOrderDTO = Json<WorkOrder> & {
  vehicle: Json<Vehicle>;
  service?: Json<Service> | null;
};

export type ServiceDTO = Json<Service> & {
  _count?: { workOrders: number };
};

export type FuelLogDTO = Json<FuelLog> & {
  vehicle: Json<Vehicle>;
  driver: Json<Driver> | null;
};

export type GeofenceDTO = Json<Geofence>;

export type AlertDTO = Json<Alert> & {
  vehicle: Json<Vehicle> | null;
  driver: Json<Driver> | null;
};

export type UserSummary = Pick<Json<User>, "id" | "name" | "email" | "role">;

export type WorkOrderRequestDTO = Json<WorkOrderRequest> & {
  vehicle: Json<Vehicle> | null;
  service: Json<Service> | null;
  requestedBy: UserSummary;
  reviewedBy: UserSummary | null;
};

export type PositionDTO = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  status: string;
  fuelLevel: number;
  type: string;
  make: string;
  model: string;
  station: string | null;
  assignedDriver: { firstName: string; lastName: string } | null;
};
