import type { FleetData } from "./fleet";

const collections = ["vehicles", "assignments", "expenses", "documents", "invoices", "payments", "idle", "stations", "drivers", "coordinators"] as const;

// Bound both the HTTP request and body download, including reconnects and retries.
export async function fetchFleetData({ signal, timeoutMs = 25000 }: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<FleetData> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch("/api/fleet", { cache: "no-store", signal: controller.signal });
    if (response.status === 401) throw new Error("Tu sesión venció. Vuelve a iniciar sesión para cargar los vehículos.");
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("El servidor no pudo responder. Reintenta la carga de vehículos.");
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "No se pudieron cargar los vehículos.");
    if (!body.user || typeof body.user.role !== "string" || !collections.every(key => Array.isArray(body[key]))) {
      throw new Error("La respuesta de vehículos está incompleta. Reintenta la carga.");
    }
    return body as FleetData;
  } catch (error) {
    if (timedOut) throw new Error("La conexión tardó demasiado. Pulsa Reintentar para cargar los vehículos.");
    if (error instanceof TypeError) throw new Error("No se pudo conectar. Revisa tu conexión y pulsa Reintentar.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
