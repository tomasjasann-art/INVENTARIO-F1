"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Database,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  Layers3,
  LogOut,
  Mail,
  Menu,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Save,
  ShoppingCart,
  ShieldCheck,
  Users,
  Warehouse,
  Upload,
  X,
} from "lucide-react";
import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AuditView, { type AuditImportRow, type AuditRecord } from "./AuditView";
import { kardexDate, normalizeKardexDate } from "../lib/kardex-date";

type Product = {
  id: number;
  sku: string;
  description: string;
  category: string;
  unit: string;
  location: string;
  minStock: number;
  unitCostCents: number;
  stock: number;
  client: string;
  owner: string;
  defaultProject: string;
  costSource?: string;
};

type Movement = {
  id: number;
  productId: number;
  type: "entrada" | "salida" | "devolucion" | "traslado" | "regularizacion" | "baja" | "ajuste";
  quantity: number;
  movementDate: string;
  document: string;
  project: string;
  destinationSite: string;
  coordinator: string;
  coordinatorF1: string;
  serials: string;
  lotAssignment: string;
  sourceRow: string;
  originSite: string;
  stockLocation: string;
  unitMeasure: string;
  unitCostCents: number;
  productUnitCostCents: number;
  equipmentType: string;
  loadGr: string;
  grLink: string;
  orderNumber: string;
  ticket: string;
  equipmentStatus: string;
  condition: string;
  origin: string;
  owner: string;
  recordStatus: string;
  region: string;
  province: string;
  contractorDocument: string;
  contractor: string;
  consignee: string;
  requesterEmail: string;
  emailStatus: string;
  emailFlowStatus: string;
  dispatchId: string;
  emailSentAt: string;
  registeredBy: string;
  notes: string;
  sku: string;
  description: string;
  unit: string;
  costSource?: string;
};

type SourceRecord = {
  id: number;
  source: string;
  movementType: "entrada" | "salida";
  sku: string;
  seriesLot: string;
  quantity: number;
  movementDate: string;
  document: string;
  sourceStatus: string;
};

type Coordinator = {
  id: number;
  organization: "F1" | "ENTEL";
  name: string;
  email: string;
  active: boolean;
};

type Supplier = {
  id: number;
  documentType: "RUC" | "DNI";
  documentNumber: string;
  businessName: string;
  tradeName: string;
  source: string;
  active: boolean;
};

type InstallationValidation = {
  id: number;
  movementId: number;
  serial: string;
  evidenceSsnn: string;
  installedSite: string;
  managementDate: string;
  responsible: string;
  requestStatus: string;
  jiraRequestNumber: string;
  reviewer: string;
  entelReviewDate: string;
  year: string;
  oracleStatus: string;
  reportGrLink: string;
  observation: string;
  updatedAt: string;
};

type EquipmentRequest = {
  id: number;
  requestCode: string;
  coordinatorName: string;
  coordinatorEmail: string;
  orderNumber: string;
  project: string;
  site: string;
  warehouse: string;
  productId: number;
  quantity: number;
  seriesLot: string;
  contractorRuc: string;
  contractorBusinessName: string;
  pickupPersonDni: string;
  pickupPerson: string;
  pickupPerson2Dni: string;
  pickupPerson2: string;
  region: string;
  city: string;
  neededDate: string;
  status: "PENDIENTE" | "VALIDADA" | "DESPACHADA" | "EN_TRANSITO" | "LISTA_RECOJO" | "RECOGIDA" | "CERRADA" | "RECHAZADA";
  outboundGuide: string;
  outboundGuideLink: string;
  outboundGuidePhoto: string;
  outboundGuidePhotoStored?: string;
  shippingTicket: string;
  shippingTicketPhoto: string;
  shippingTicketPhotoStored?: string;
  shippingKey: string;
  sentDate: string;
  arrivalDate: string;
  pickupDate: string;
  logisticsNotes: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type UserRole = "ADMINISTRADOR" | "LOGISTICA" | "COORDINADOR" | "SOLO_LECTURA";

type AppUser = {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  invitationStatus: string;
  invitedAt: string;
};

type KardexData = {
  products: Product[];
  movements: Movement[];
  sourceRecords: SourceRecord[];
  coordinators: Coordinator[];
  suppliers: Supplier[];
  installationValidations: InstallationValidation[];
  auditImports: AuditImportRow[];
  auditRecords: AuditRecord[];
  auditHistoryRecords: AuditRecord[];
  equipmentRequests: EquipmentRequest[];
  appUsers: AppUser[];
  currentUser?: { email: string; displayName: string; role: UserRole; active: boolean };
};
type View = "resumen" | "movimientos" | "ingresos" | "salidas" | "stock" | "lotes" | "solicitudes" | "conciliacion" | "auditoria" | "coordinadores" | "proveedores" | "reportes" | "carga" | "configuracion";

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const number = new Intl.NumberFormat("es-PE");
const today = () => new Date().toISOString().slice(0, 10);
const REQUEST_UNTRACKED = "__SIN_SERIE_LOTE__";

const SALIDA_BULK_HEADERS = [
  "ITEM",
  "Fecha Salida",
  "Sku",
  "Descripción Sku",
  "NroGRSalida",
  "Link de GR",
  "CordEntelFinal",
  "SiteDestino",
  "Region",
  "Provincia",
  "ProyectoFinal",
  "CordF1",
  "RUC/DNI",
  "Consignatario",
  "Serie/Lote",
  "Cantidad",
  "UnidadMedida",
  "Tipo de Equipo",
  "N° Pedido",
  "CorreoSolicitante",
  "Estado Correo",
  "IDDespacho",
  "EstadoCorreo",
  "FechaEnvioCorreo",
  "Persona que Registra",
  "Cargar GR",
] as const;

function normalizeBulkHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function bulkRowValue(row: Record<string, unknown>, ...headers: string[]) {
  const wanted = new Set(headers.map(normalizeBulkHeader));
  const entry = Object.entries(row).find(([key]) => wanted.has(normalizeBulkHeader(key)));
  return String(entry?.[1] ?? "").trim();
}

function bulkNumberValue(row: Record<string, unknown>, ...headers: string[]) {
  const raw = bulkRowValue(row, ...headers).replace(/S\/?\.?/gi, "").replace(/\s/g, "");
  const normalized = raw.includes(",") && raw.includes(".")
    ? (raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, ""))
    : raw.replace(",", ".");
  return Number(normalized) || 0;
}

function parseDelimitedRows(text: string, limit = 2000) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const parseLine = (line: string) => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim());
    return values;
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1, limit + 1).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] || `columna_${index + 1}`, value])));
}

async function readTabularFile(file: File, limit = 2000) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseDelimitedRows(await file.text(), limit);
  if (extension !== "xlsx" && extension !== "xls") throw new Error("Usa un archivo Excel (.xlsx o .xls) o CSV.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return (XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false }) as Array<Record<string, unknown>>).slice(0, limit);
}

async function downloadTableTemplate(fileName: string, sheetName: string, row: Record<string, unknown>) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([row]), sheetName);
  XLSX.writeFile(workbook, fileName);
}

function automaticPreviewLotCode({ movementDate, orderNumber, sku, sourceRow }: { movementDate: string; orderNumber: string; sku: string; sourceRow: string }) {
  const part = (value: string, fallback: string) => value.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || fallback;
  return ["TRF", movementDate.replace(/\D/g, "").slice(0, 8) || "SINFECHA", part(orderNumber, "SINPEDIDO"), part(sku, "SINSKU"), part(sourceRow, "1")].join("-");
}

function movementEffect(type: Movement["type"]) {
  if (type === "salida" || type === "baja") return -1;
  if (type === "traslado") return 0;
  return 1;
}

function movementSeries(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function seriesQuantity(serials: string, quantity: number, token: string) {
  const tokens = movementSeries(serials);
  if (!tokens.includes(token)) return 0;
  return tokens.length > 1 ? 1 : quantity;
}

function isMeterMeasure(value: string) {
  const unit = value.trim().toUpperCase().replaceAll(".", "");
  return ["M", "MT", "MTS", "METRO", "METROS"].includes(unit);
}

function quantityByMeasure(rows: Movement[]) {
  return rows.reduce((summary, movement) => {
    if (isMeterMeasure(movement.unitMeasure || movement.unit)) summary.meters += movement.quantity;
    else summary.units += movement.quantity;
    return summary;
  }, { units: 0, meters: 0 });
}

function displayDate(value: string) {
  if (!value) return "—";
  const date = kardexDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function externalUrl(value: string) {
  const link = value.trim();
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  if (/^(www\.|[^/\s]+\.sharepoint\.com\/)/i.test(link)) return `https://${link}`;
  return "";
}

type KardexUser = {
  displayName: string;
  email: string;
};

function userInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "F1").toUpperCase();
}

export default function KardexApp({ user, signOutPath }: { user: KardexUser; signOutPath: string }) {
  const [data, setData] = useState<KardexData>({ products: [], movements: [], sourceRecords: [], coordinators: [], suppliers: [], installationValidations: [], auditImports: [], auditRecords: [], auditHistoryRecords: [], equipmentRequests: [], appUsers: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("resumen");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"movement" | "product" | null>(null);
  const [movementType, setMovementType] = useState<Movement["type"]>("entrada");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const warehouse = "MO Company";
  const role = data.currentUser?.role ?? "SOLO_LECTURA";
  const canOperate = role === "ADMINISTRADOR" || role === "LOGISTICA";
  const canRequest = canOperate || role === "COORDINADOR";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/kardex", { cache: "no-store" });
      const body = (await response.json()) as KardexData & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo cargar el Kardex.");
      setData({
        products: body.products ?? [],
        movements: body.movements ?? [],
        sourceRecords: body.sourceRecords ?? [],
        coordinators: body.coordinators ?? [],
        suppliers: body.suppliers ?? [],
        installationValidations: body.installationValidations ?? [],
        auditImports: body.auditImports ?? [],
        auditRecords: body.auditRecords ?? [],
        auditHistoryRecords: body.auditHistoryRecords ?? [],
        equipmentRequests: body.equipmentRequests ?? [],
        appUsers: body.appUsers ?? [],
        currentUser: body.currentUser,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el Kardex.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const metrics = useMemo(() => {
    const currentMonth = today().slice(0, 7);
    const stock = data.products.reduce((summary, product) => {
      if (isMeterMeasure(product.unit)) summary.meters += product.stock;
      else summary.units += product.stock;
      return summary;
    }, { units: 0, meters: 0 });
    const inventoryValue = data.products.reduce(
      (sum, product) => sum + product.stock * (product.unitCostCents / 100),
      0,
    );
    const entries = quantityByMeasure(data.movements.filter((movement) => movement.type === "entrada" && movement.movementDate.startsWith(currentMonth)));
    const exits = quantityByMeasure(data.movements.filter((movement) => movement.type === "salida" && movement.movementDate.startsWith(currentMonth)));
    const movedProductIds = new Set(data.movements.map((movement) => movement.productId));
    const traceControlledProductIds = new Set(data.movements
      .filter((movement) => movement.serials.trim())
      .map((movement) => movement.productId));
    const alertProducts = data.products.filter((product) => movedProductIds.has(product.id)
      && traceControlledProductIds.has(product.id)
      && product.stock <= product.minStock);
    return { stock, inventoryValue, entries, exits, alerts: alertProducts.length, alertProducts };
  }, [data]);

  const filteredMovements = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.movements;
    return data.movements.filter((movement) =>
      [movement.sku, movement.description, movement.serials, movement.orderNumber, movement.document, movement.project, movement.destinationSite, movement.originSite, movement.origin, movement.coordinator, movement.coordinatorF1, movement.region, movement.province, movement.contractorDocument, movement.contractor, movement.consignee, movement.dispatchId, movement.requesterEmail]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [data.movements, search]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.products;
    return data.products.filter((product) =>
      [product.sku, product.description, product.category, product.location].join(" ").toLowerCase().includes(query),
    );
  }, [data.products, search]);

  const exitSiteOptions = useMemo(() => [...new Set(
    data.movements
      .filter((movement) => movement.type === "salida" && movement.destinationSite.trim())
      .map((movement) => movement.destinationSite.trim()),
  )].sort((a, b) => a.localeCompare(b)), [data.movements]);

  const openMovement = (type: Movement["type"]) => {
    setMovementType(type);
    setModal("movement");
  };

  function exportCsv() {
    const header = ["Fecha", "Tipo", "SKU", "Descripción", "Serie/Lote", "Cantidad", "Unidad", "Costo unitario", "Costo total", "Fuente costo", "N° Pedido", "Documento", "Proyecto", "Site", "Coordinador", "Estado de Equipo", "Condición", "Región", "Provincia", "RUC/DNI", "Contrata", "Consignatario", "Correo solicitante", "Estado correo", "ID despacho", "Fecha envío correo", "Persona que registra"];
    const rows = filteredMovements.map((movement) => [
      movement.movementDate,
      movement.type,
      movement.sku,
      movement.description,
      movement.serials,
      String(movement.quantity),
      movement.unit,
      String((movement.unitCostCents || movement.productUnitCostCents || 0) / 100),
      String(((movement.unitCostCents || movement.productUnitCostCents || 0) * movement.quantity) / 100),
      movement.costSource || "KARDEX",
      movement.orderNumber,
      movement.document,
      movement.project,
      movement.destinationSite,
      movement.coordinator,
      movement.equipmentStatus,
      movement.condition,
      movement.region,
      movement.province,
      movement.contractorDocument,
      movement.contractor,
      movement.consignee,
      movement.requesterEmail,
      movement.emailStatus || movement.emailFlowStatus,
      movement.dispatchId,
      movement.emailSentAt,
      movement.registeredBy,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kardex-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function save(payload: Record<string, unknown>, success: string): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/kardex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        imported?: number;
        rejected?: number;
        rejectionDetails?: Array<{ row: number; sku: string; reason: string }>;
      };
      if (!response.ok) throw new Error(body.error || "No se pudo guardar.");
      setModal(null);
      setMessage(
        typeof body.imported === "number"
          ? `Carga procesada: ${body.imported} filas registradas${body.rejected ? ` y ${body.rejected} rechazadas` : ""}.`
          : success,
      );
      await loadData();
      if (body.rejected && body.rejectionDetails?.length) {
        const detail = body.rejectionDetails.slice(0, 4).map((item) => `Fila ${item.row}: ${item.reason}`).join(" · ");
        setError(`${body.rejected} filas no fueron cargadas. ${detail}`);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><span>F1</span></div>
          <div><strong>KARDEX</strong><small>CONTROL LOGÍSTICO</small></div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <div className="warehouse-pill warehouse-fixed"><Warehouse size={17} /><span><small>ALMACÉN F1</small><strong>{warehouse}</strong></span></div>
        <nav className="nav-list" aria-label="Navegación principal">
          <button className={view === "resumen" ? "active" : ""} onClick={() => { setView("resumen"); setSidebarOpen(false); }}><LayoutDashboard size={19} />Resumen</button>
          <button className={view === "ingresos" ? "active" : ""} onClick={() => { setView("ingresos"); setSidebarOpen(false); }}><ArrowDownLeft size={19} />Ingresos</button>
          <button className={view === "salidas" ? "active" : ""} onClick={() => { setView("salidas"); setSidebarOpen(false); }}><ArrowUpRight size={19} />Salidas</button>
          <button className={view === "stock" ? "active" : ""} onClick={() => { setView("stock"); setSidebarOpen(false); }}><Boxes size={19} />Stock actual</button>
          <button className={view === "lotes" ? "active" : ""} onClick={() => { setView("lotes"); setSidebarOpen(false); }}><Layers3 size={19} />Series y Lotes</button>
          <button className={view === "solicitudes" ? "active" : ""} onClick={() => { setView("solicitudes"); setSidebarOpen(false); }}><ShoppingCart size={19} />Solicitudes</button>
          {canOperate && <button className={view === "carga" ? "active" : ""} onClick={() => { setView("carga"); setSidebarOpen(false); }}><Upload size={19} />Carga masiva</button>}
          <button className={view === "conciliacion" ? "active" : ""} onClick={() => { setView("conciliacion"); setSidebarOpen(false); }}><Scale size={19} />Conciliación</button>
          <button className={view === "auditoria" ? "active" : ""} onClick={() => { setView("auditoria"); setSidebarOpen(false); }}><Database size={19} />Auditoría Entel</button>
          {canOperate && <button className={view === "coordinadores" ? "active" : ""} onClick={() => { setView("coordinadores"); setSidebarOpen(false); }}><Users size={19} />Coordinadores</button>}
          {canOperate && <button className={view === "proveedores" ? "active" : ""} onClick={() => { setView("proveedores"); setSidebarOpen(false); }}><Warehouse size={19} />Empresas y personas</button>}
          <button className={view === "movimientos" ? "active" : ""} onClick={() => { setView("movimientos"); setSidebarOpen(false); }}><ClipboardList size={19} />Historial</button>
          <button className={view === "reportes" ? "active" : ""} onClick={() => { setView("reportes"); setSidebarOpen(false); }}><BarChart3 size={19} />Reportes</button>
        </nav>
        <div className="sidebar-bottom">
          {role === "ADMINISTRADOR" && <button className={view === "configuracion" ? "active" : ""} onClick={() => { setView("configuracion"); setSidebarOpen(false); }}><Settings size={18} />Configuración</button>}
          <div className="user-card"><span>{userInitials(user.displayName)}</span><div><strong>{user.displayName}</strong><small>{role.replaceAll("_", " ")} · {user.email}</small></div><a href={signOutPath} target="_top" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></a></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
          <div className="search-box"><Search size={18} /><input list={view === "salidas" ? "exit-site-search-options" : undefined} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === "salidas" ? "Buscar site de salida por código o nombre..." : "Buscar SKU, equipo, guía, proyecto o site..."} />{view === "salidas" && <datalist id="exit-site-search-options">{exitSiteOptions.map((site) => <option value={site} key={site} />)}</datalist>}</div>
          <div className="top-actions">
            {!(["solicitudes", "configuracion", "ingresos", "salidas"] as View[]).includes(view) && <button className="secondary-button" onClick={exportCsv}><Download size={17} />Exportar</button>}
            {canOperate && view === "ingresos" && <button className="primary-button quick-movement" onClick={() => openMovement("entrada")}><ArrowDownLeft size={17} />Registrar ingreso unitario</button>}
            {canOperate && view === "salidas" && <button className="primary-button quick-movement" onClick={() => openMovement("salida")}><ArrowUpRight size={17} />Registrar salida unitaria</button>}
            {canOperate && view === "carga" && <button className="secondary-button product-button" onClick={() => setModal("product")}><PackagePlus size={17} />Nuevo SKU</button>}
          </div>
        </header>

        <div className="content">
          <section className="page-heading">
            <div><p className="eyebrow">SISTEMA INVENTARIO F1 · {new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date())}</p><h1>{view === "resumen" ? "Resumen del Kardex" : view === "ingresos" ? "Ingresos de equipos" : view === "salidas" ? "Salidas de equipos" : view === "movimientos" ? "Trazabilidad de movimientos" : view === "stock" ? "Stock y trazabilidad" : view === "lotes" ? "Series, lotes y pedidos" : view === "solicitudes" ? "Solicitudes de equipos" : view === "conciliacion" ? "Conciliación de instalación" : view === "auditoria" ? "Auditoría Entel y cruce Oracle" : view === "coordinadores" ? "Coordinadores F1 y Entel" : view === "proveedores" ? "Empresas y personas" : view === "reportes" ? "Reportes operativos" : view === "configuracion" ? "Puesta en producción" : "Carga masiva de información"}</h1><p>{view === "resumen" ? "Control centralizado por SKU, Serie/Lote, pedido y proyecto." : view === "ingresos" ? "Registro de equipos recibidos en el único almacén operativo: MO Company." : view === "salidas" ? "Despachos validados contra stock, serie, pedido, RUC y razón social." : view === "movimientos" ? "Historial independiente de ingresos, salidas, devoluciones y ajustes." : view === "stock" ? "Consulta movimientos por GR, serie/lote, proyecto/site, pedido o SKU." : view === "lotes" ? "Un pedido puede agrupar varias series, lotes y SKU distintos." : view === "solicitudes" ? "Los coordinadores F1 seleccionan equipos por pedido para que MO Company prepare la salida." : view === "conciliacion" ? "Compara el último corte con el historial y completa la validación de cada serie despachada." : view === "auditoria" ? "Cruza Stock Contrata Entel con Oracle y el Kardex interno, tomando únicamente F1." : view === "coordinadores" ? "Maestro manual o masivo para responsables F1 y Entel." : view === "proveedores" ? "Relaciona RUC de empresas y DNI de personas con sus nombres para autocompletar todo el Kardex." : view === "reportes" ? "Exportables valorizados por pedido, GR, SKU, coordinador y razón social." : view === "configuracion" ? "Administra accesos y limpia datos de prueba de forma controlada." : "Importa maestro de SKU, ingresos o salidas desde Excel o CSV."}</p></div>
            <button className="refresh-button" onClick={() => void loadData()} disabled={loading}><RefreshCw size={17} className={loading ? "spin" : ""} />Actualizar</button>
          </section>

          {error && <div className="error-banner"><AlertTriangle size={18} /><span>{error}</span><button onClick={() => setError("")}><X size={16} /></button></div>}

          {view === "resumen" && (
            <>
              <section className="metrics-grid">
                <Metric label="Stock total" value={`${number.format(metrics.stock.units)} UND`} meta={`${number.format(metrics.stock.meters)} MTS · ${data.products.length} SKU`} icon={<Boxes size={20} />} tone="dark" />
                <Metric label="Valor del inventario" value={money.format(metrics.inventoryValue)} meta="Costo referencial actual" icon={<CircleDollarSign size={20} />} tone="neutral" />
                <Metric label="Ingresos del mes" value={`${number.format(metrics.entries.units)} UND`} meta={`${number.format(metrics.entries.meters)} MTS recibidos`} icon={<ArrowDownLeft size={20} />} tone="green" />
                <Metric label="Salidas del mes" value={`${number.format(metrics.exits.units)} UND`} meta={`${number.format(metrics.exits.meters)} MTS despachados`} icon={<ArrowUpRight size={20} />} tone="orange" />
                <Metric label="Alertas de stock" value={number.format(metrics.alerts)} meta="SKU con series/lotes en mínimo" icon={<AlertTriangle size={20} />} tone="red" />
              </section>

              <section className="dashboard-grid">
                <div className="panel flow-panel">
                  <div className="panel-title"><div><h2>Flujo de inventario</h2><p>Últimos 7 días con movimientos</p></div><span className="legend"><i className="in" />Ingresos <i className="out" />Salidas</span></div>
                  <FlowChart movements={data.movements} />
                </div>
                <div className="panel alerts-panel">
                  <div className="panel-title"><div><h2>Atención requerida</h2><p>Series y lotes por SKU en nivel mínimo</p></div><span className="count-badge">{metrics.alerts}</span></div>
                  <StockAlerts products={metrics.alertProducts} hasMovements={data.movements.length > 0} />
                </div>
              </section>

              <section className="coordinator-summary-grid">
                <CoordinatorCostSummary organization="ENTEL" movements={data.movements} products={data.products} loading={loading} />
                <CoordinatorCostSummary organization="F1" movements={data.movements} products={data.products} loading={loading} />
              </section>

              <MovementTable movements={filteredMovements.slice(0, 7)} loading={loading} title="Movimientos recientes" subtitle="Últimas operaciones registradas" onViewAll={() => setView("movimientos")} />
            </>
          )}

          {view === "movimientos" && <MovementTable movements={filteredMovements} loading={loading} title="Todos los movimientos" subtitle={`${filteredMovements.length} operaciones encontradas`} />}
          {view === "ingresos" && <OperationalMovementTable mode="entrada" movements={filteredMovements.filter((movement) => ["entrada", "devolucion", "regularizacion"].includes(movement.type))} allMovements={data.movements} loading={loading} />}
          {view === "salidas" && <OperationalMovementTable mode="salida" movements={filteredMovements.filter((movement) => ["salida", "baja"].includes(movement.type))} allMovements={data.movements} loading={loading} />}
          {view === "stock" && <StockTable products={filteredProducts} movements={data.movements} loading={loading} />}
          {view === "lotes" && <LotView movements={filteredMovements} loading={loading} />}
          {view === "solicitudes" && <RequestView products={data.products} movements={data.movements} coordinators={data.coordinators} suppliers={data.suppliers} requests={data.equipmentRequests} warehouse={warehouse} loading={loading} saving={saving} canRequest={canRequest} canOperate={canOperate} onSave={save} />}
          {view === "conciliacion" && <ConciliationView movements={data.movements} validations={data.installationValidations} auditImports={data.auditImports} auditRecords={data.auditRecords} auditHistoryRecords={data.auditHistoryRecords} loading={loading} saving={saving} onSave={(payload) => void save(payload, "Validación de instalación guardada.")} onOpenAudit={() => setView("auditoria")} />}
          {view === "auditoria" && <AuditView imports={data.auditImports} records={data.auditRecords} movements={data.movements} loading={loading} saving={saving} onSave={save} />}
          {view === "coordinadores" && <CoordinatorView coordinators={data.coordinators} loading={loading} saving={saving} onSave={(payload) => save(payload, "Coordinador actualizado correctamente.")} />}
          {view === "proveedores" && <SupplierView suppliers={data.suppliers} loading={loading} saving={saving} onSave={(payload) => save(payload, "Proveedor actualizado correctamente.")} />}
          {view === "reportes" && <ReportsView products={data.products} movements={filteredMovements} requests={data.equipmentRequests} />}
          {view === "carga" && <BulkUpload products={data.products} movements={data.movements} suppliers={data.suppliers} saving={saving} onSave={(payload) => save(payload, "Carga procesada correctamente.")} />}
          {view === "configuracion" && role === "ADMINISTRADOR" && <SettingsView data={data} saving={saving} onSave={save} />}
        </div>
      </main>

      {modal === "movement" && <MovementModal products={data.products} coordinators={data.coordinators} suppliers={data.suppliers} initialType={movementType} warehouse={warehouse} saving={saving} onClose={() => setModal(null)} onSave={(payload) => void save(payload, "Movimiento registrado correctamente.")} onNewProduct={() => setModal("product")} />}
      {modal === "product" && <ProductModal products={data.products} saving={saving} onClose={() => setModal(null)} onSave={(payload) => void save(payload, "SKU guardado correctamente.")} />}
      {message && <div className="toast"><span>✓</span>{message}</div>}
      {sidebarOpen && <button className="overlay" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú" />}
    </div>
  );
}

function Metric({ label, value, meta, icon, tone }: { label: string; value: string; meta: string; icon: React.ReactNode; tone: string }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div><strong>{value}</strong><small>{meta}</small></article>;
}

function CoordinatorCostSummary({ organization, movements, products, loading }: { organization: "F1" | "ENTEL"; movements: Movement[]; products: Product[]; loading: boolean }) {
  const [query, setQuery] = useState("");
  const coordinatorLabel = organization === "F1" ? "Coordinador F1" : "Coordinador Entel";
  const productCost = useMemo(() => new Map(products.map((product) => [product.id, product.unitCostCents])), [products]);
  const rows = useMemo(() => {
    const grouped = new Map<string, { name: string; units: number; costCents: number; orders: Set<string>; guides: Set<string> }>();
    movements.filter((movement) => ["salida", "baja"].includes(movement.type)).forEach((movement) => {
      const name = (organization === "F1" ? movement.coordinatorF1 : movement.coordinator).trim() || `SIN ${coordinatorLabel.toUpperCase()}`;
      const key = name.toUpperCase();
      const group = grouped.get(key) ?? { name, units: 0, costCents: 0, orders: new Set<string>(), guides: new Set<string>() };
      const unitCostCents = movement.unitCostCents || movement.productUnitCostCents || productCost.get(movement.productId) || 0;
      group.units += movement.quantity;
      group.costCents += unitCostCents * movement.quantity;
      if (movement.orderNumber) group.orders.add(movement.orderNumber);
      if (movement.document) group.guides.add(movement.document);
      grouped.set(key, group);
    });
    const normalized = query.trim().toLowerCase();
    return [...grouped.values()]
      .filter((row) => !normalized || row.name.toLowerCase().includes(normalized))
      .sort((a, b) => b.costCents - a.costCents);
  }, [coordinatorLabel, movements, organization, productCost, query]);
  const totalCost = rows.reduce((sum, row) => sum + row.costCents, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);

  return <section className="panel coordinator-cost-panel">
    <div className="panel-title"><div><h2>Costo despachado por {coordinatorLabel}</h2><p>Valorización de salidas por responsable.</p></div><div className="coordinator-cost-total"><small>TOTAL FILTRADO</small><strong>{money.format(totalCost / 100)}</strong></div></div>
    <div className="coordinator-cost-filter"><label className="field"><span>Buscar {coordinatorLabel}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe el nombre..." /></label><div><strong>{number.format(totalUnits)} despachados</strong><small>{rows.length} coordinadores</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>{coordinatorLabel}</th><th>Pedidos</th><th>GR salida</th><th className="align-right">Cantidad</th><th className="align-right">Costo total</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}><Empty text="Calculando valorización por coordinador..." /></td></tr> : !rows.length ? <tr><td colSpan={5}><Empty text={`No hay salidas asociadas a ${coordinatorLabel}.`} /></td></tr> : rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong><small>{row.name.startsWith("SIN ") ? "Requiere regularización" : coordinatorLabel}</small></td><td><strong>{number.format(row.orders.size)}</strong><small>{[...row.orders].slice(0, 2).join(", ") || "Sin pedido"}</small></td><td><strong>{number.format(row.guides.size)}</strong><small>{[...row.guides].slice(0, 2).join(", ") || "Sin GR"}</small></td><td className="align-right"><strong>{number.format(row.units)}</strong><small>UND / MTS</small></td><td className="align-right"><strong>{money.format(row.costCents / 100)}</strong><small>cantidad × costo</small></td></tr>)}</tbody></table></div>
  </section>;
}

function MovementTable({ movements, loading, title, subtitle, onViewAll }: { movements: Movement[]; loading: boolean; title: string; subtitle: string; onViewAll?: () => void }) {
  return <section className="panel table-panel"><div className="panel-title"><div><h2>{title}</h2><p>{subtitle}</p></div>{onViewAll && <button className="text-button" onClick={onViewAll}>Ver todos →</button>}</div><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>SKU</th><th>Descripción Sku</th><th>Serie / Lote</th><th>N° Pedido / Guía</th><th>Proyecto / Site</th><th>Coordinadores</th><th>Región / Contrata</th><th>Estado / Condición</th><th className="align-right">Cantidad</th><th className="align-right">Costo total</th></tr></thead><tbody>{loading ? <tr><td colSpan={12}><Empty text="Cargando movimientos..." /></td></tr> : movements.length === 0 ? <tr><td colSpan={12}><Empty text="Aún no hay movimientos registrados." /></td></tr> : movements.map((movement) => { const negative = movement.type === "salida" || movement.type === "baja"; const unitCostCents = movement.unitCostCents || movement.productUnitCostCents || 0; return <tr key={movement.id}><td><span className="date-cell">{displayDate(movement.movementDate)}</span></td><td><span className={`type-badge type-${movement.type}`}>{movement.type === "entrada" ? <ArrowDownLeft size={14} /> : movement.type === "salida" ? <ArrowUpRight size={14} /> : <RefreshCw size={13} />}{movement.type}</span></td><td><strong>{movement.sku}</strong></td><td><strong>{movement.description}</strong><small>{movement.equipmentType || "Equipo"}</small></td><td><strong>{movement.serials || "SIN SERIE"}</strong><small>{movement.recordStatus}</small></td><td><strong>{movement.orderNumber || "—"}</strong><small>{movement.document || movement.ticket || "Sin documento"}</small><GrLinkCell link={movement.grLink} /></td><td><strong>{movement.project || "—"}</strong><small>{movement.destinationSite || movement.originSite || "Sin site"}</small></td><td><strong>{movement.coordinator || "Sin coordinador Entel"}</strong><small>F1: {movement.coordinatorF1 || "—"}</small></td><td><strong>{movement.region || "Sin región"}</strong><small>{movement.contractor || "Sin contrata"}</small></td><td><strong>{movement.equipmentStatus || "NUEVO"}</strong><small>{movement.condition || "OPERATIVO"}</small></td><td className="align-right"><strong className={negative ? "negative" : "positive"}>{negative ? "−" : "+"}{number.format(movement.quantity)}</strong><small>{movement.unitMeasure || movement.unit}</small></td><td className="align-right"><strong>{money.format((unitCostCents * movement.quantity) / 100)}</strong><small>{money.format(unitCostCents / 100)} c/u · {movement.costSource || "KARDEX"}</small></td></tr>; })}</tbody></table></div></section>;
}

function GrLinkCell({ link }: { link: string }) {
  const url = externalUrl(link);
  if (url) return <a className="data-link gr-link-cell" href={url} target="_blank" rel="noreferrer"><FileSpreadsheet size={13} />Abrir GR</a>;
  return <small className="gr-missing">{link ? `Archivo: ${link}` : "Sin vínculo"}</small>;
}

function relatedTrace(selected: Movement, movements: Movement[]) {
  const selectedSeries = new Set(movementSeries(selected.serials));
  return movements.filter((movement) => {
    if (movement.productId !== selected.productId) return false;
    if (selectedSeries.size) return movementSeries(movement.serials).some((serial) => selectedSeries.has(serial));
    if (selected.orderNumber) return movement.orderNumber.trim().toUpperCase() === selected.orderNumber.trim().toUpperCase();
    return true;
  }).sort((a, b) => a.movementDate.localeCompare(b.movementDate) || a.id - b.id);
}

function OperationalMovementTable({ mode, movements, allMovements, loading }: { mode: "entrada" | "salida"; movements: Movement[]; allMovements: Movement[]; loading: boolean }) {
  const [trace, setTrace] = useState<Movement | null>(null);
  const [filterBy, setFilterBy] = useState<"pedido" | "gr" | "site" | "serie">("pedido");
  const [filterQuery, setFilterQuery] = useState("");
  const entry = mode === "entrada";
  const columns = entry ? 17 : 18;
  const filterLabel = filterBy === "pedido" ? "N° Pedido/Cod. Oracle" : filterBy === "gr" ? "GR" : filterBy === "site" ? "Site" : "Serie/Lote";
  const filterOptions = useMemo(() => [...new Set(movements.flatMap((movement) => {
    const raw = filterBy === "pedido"
      ? movement.orderNumber
      : filterBy === "gr"
        ? movement.document
        : filterBy === "site"
          ? [movement.destinationSite, movement.originSite].filter(Boolean).join("|")
          : movement.serials.replace(/[;\n]/g, ",");
    return raw.split(/[|,]/).map((value) => value.trim()).filter(Boolean);
  }))].sort((a, b) => a.localeCompare(b)), [filterBy, movements]);
  const visibleMovements = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return movements;
    return movements.filter((movement) => {
      const value = filterBy === "pedido"
        ? movement.orderNumber
        : filterBy === "gr"
          ? movement.document
          : filterBy === "site"
            ? `${movement.destinationSite} ${movement.originSite}`
            : movement.serials;
      return value.toLowerCase().includes(query);
    });
  }, [filterBy, filterQuery, movements]);

  async function exportOperationalExcel() {
    const XLSX = await import("xlsx");
    const exportRows = visibleMovements.map((movement) => {
      const unitCost = (movement.unitCostCents || movement.productUnitCostCents || 0) / 100;
      const common = {
        SKU: movement.sku,
        "Descripción Sku": movement.description,
        "Serie/Lote": movement.serials,
        Cantidad: movement.quantity,
        "Unidad de Medida": movement.unitMeasure || movement.unit,
        "Tipo de Equipo": movement.equipmentType,
        "Costo unitario": unitCost,
        "Costo total": unitCost * movement.quantity,
        "Fuente de costo": movement.costSource || "KARDEX",
      };
      return entry ? {
        ...common,
        "Proceso de equipo": movement.type,
        "Estado de Equipo": movement.equipmentStatus,
        Condición: movement.condition,
        Proyecto: movement.project,
        "RUC origen": movement.contractorDocument,
        Proviene: movement.origin,
        "Fecha de Ingreso": movement.movementDate,
        "GR. de Ingreso": movement.document,
        "Link de GR. de Ingreso": movement.grLink,
        "N° Pedido/Cod. Oracle": movement.orderNumber,
        "Coordinador Entel": movement.coordinator,
        "Coordinador F1": movement.coordinatorF1,
        "Site Origen": movement.originSite,
        Ubicación: movement.stockLocation || "MO COMPANY",
        "Persona que registra": movement.registeredBy,
        Observación: movement.notes,
      } : {
        ...common,
        "Fecha Salida": movement.movementDate,
        "Nro. de GR de Salida": movement.document,
        "Link de GR": movement.grLink,
        "Cord. Entel Final": movement.coordinator,
        "Site Destino": movement.destinationSite,
        Región: movement.region,
        Provincia: movement.province,
        "Proyecto Final": movement.project,
        "Cord. F1": movement.coordinatorF1,
        "RUC/DNI": movement.contractorDocument,
        Contrata: movement.contractor,
        Consignatario: movement.consignee,
        "N° Pedido/Cod. Oracle": movement.orderNumber,
        "Correo Solicitante": movement.requesterEmail,
        "Estado Correo": movement.emailStatus,
        "Estado flujo correo": movement.emailFlowStatus,
        "ID Despacho": movement.dispatchId,
        "Fecha envío correo": movement.emailSentAt,
        "Persona que registra": movement.registeredBy,
        Observación: movement.notes,
      };
    });
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, entry ? "Ingresos" : "Salidas");
    const suffix = filterQuery.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 45) || "todos";
    XLSX.writeFile(workbook, `kardex_${mode}s_${filterBy}_${suffix}_${today()}.xlsx`);
  }
  return <>
    <section className="panel table-panel operational-panel">
      <div className="panel-title"><div><h2>{entry ? "Ingresos de equipos" : "Salidas de equipos"}</h2><p>{entry ? "Recepciones en MO Company con pedido, responsables y sustento." : "Despachos con destino, responsables, GR y trazabilidad completa."}</p></div><span className="count-badge">{visibleMovements.length}</span></div>
      <div className="operational-controls">
        <label className="field"><span>Filtrar por</span><select value={filterBy} onChange={(event) => { setFilterBy(event.target.value as typeof filterBy); setFilterQuery(""); }}><option value="pedido">N° Pedido / Cod. Oracle</option><option value="gr">GR</option><option value="site">Site</option><option value="serie">Serie / Lote</option></select></label>
        <label className="field operational-query"><span>{filterLabel}</span><input list={`operational-filter-${mode}`} value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} placeholder={`Escribe o selecciona ${filterLabel.toLowerCase()}...`} /><datalist id={`operational-filter-${mode}`}>{filterOptions.map((value) => <option value={value} key={value} />)}</datalist></label>
        <button type="button" className="secondary-button operational-export" disabled={!visibleMovements.length} onClick={() => void exportOperationalExcel()}><FileSpreadsheet size={15} />Exportar detalle Excel</button>
      </div>
      <div className="table-wrap"><table className={`operational-table ${entry ? "entry-table" : "exit-table"}`}><thead><tr>
        <th>SKU</th><th>Descripción Sku</th><th>Serie / Lote</th>
        {entry ? <><th>Proceso de equipo</th><th>Estado de Equipo</th><th>Condición</th><th>Proyecto</th><th>RUC origen</th><th>Proviene</th><th>Fecha de Ingreso</th><th>GR. de Ingreso</th><th>Link de GR. de Ingreso</th><th>N° Pedido/Cod. Oracle</th><th>Coordinador Entel</th><th>Site Origen</th></> : <><th>Fecha Salida</th><th>Nro. de GR de Salida</th><th>Link de GR</th><th>Cord. Entel Final</th><th>Site Destino</th><th>Región</th><th>Provincia</th><th>Proyecto Final</th><th>Cord. F1</th><th>RUC/DNI</th><th>Contrata</th><th>Consignatario</th><th>N° Pedido/Cod. Oracle</th></>}
        <th className="align-right">Costo</th><th>Trazabilidad</th>
      </tr></thead><tbody>
        {loading ? <tr><td colSpan={columns}><Empty text={`Cargando ${entry ? "ingresos" : "salidas"}...`} /></td></tr> : !visibleMovements.length ? <tr><td colSpan={columns}><Empty text={filterQuery ? "No se encontraron movimientos con este filtro." : `Aún no hay ${entry ? "ingresos" : "salidas"} registrados.`} /></td></tr> : visibleMovements.map((movement) => {
          const unitCostCents = movement.unitCostCents || movement.productUnitCostCents || 0;
          return <tr key={movement.id}>
            <td><strong>{movement.sku}</strong></td><td><strong>{movement.description}</strong><small>{movement.equipmentType || "Equipo"}</small></td>
            <td><strong>{movement.serials || "SIN SERIE"}</strong><small>{movement.quantity} {movement.unitMeasure || movement.unit}</small></td>
            {entry ? <>
              <td><span className={`type-badge type-${movement.type}`}>{movement.type}</span></td><td><strong>{movement.equipmentStatus || "NUEVO"}</strong></td><td><strong>{movement.condition || "OPERATIVO"}</strong></td><td><strong>{movement.project || "—"}</strong></td><td><strong>{movement.contractorDocument || "—"}</strong></td><td><strong>{movement.origin || "—"}</strong></td><td><span className="date-cell">{displayDate(movement.movementDate)}</span></td><td><strong>{movement.document || "SIN GR"}</strong></td><td><GrLinkCell link={movement.grLink} /></td><td><strong>{movement.orderNumber || "—"}</strong></td><td><strong>{movement.coordinator || "—"}</strong><small>{movement.coordinatorF1 ? `F1: ${movement.coordinatorF1}` : ""}</small></td><td><strong>{movement.originSite || "MO Company"}</strong></td>
            </> : <>
              <td><span className="date-cell">{displayDate(movement.movementDate)}</span></td><td><strong>{movement.document || "SIN GR"}</strong></td><td><GrLinkCell link={movement.grLink} /></td><td><strong>{movement.coordinator || "—"}</strong></td><td><strong>{movement.destinationSite || "—"}</strong></td><td><strong>{movement.region || "—"}</strong></td><td><strong>{movement.province || "—"}</strong></td><td><strong>{movement.project || "—"}</strong></td><td><strong>{movement.coordinatorF1 || "—"}</strong></td><td><strong>{movement.contractorDocument || "—"}</strong></td><td><strong>{movement.contractor || "—"}</strong></td><td><strong>{movement.consignee || "—"}</strong></td><td><strong>{movement.orderNumber || "—"}</strong></td>
            </>}
            <td className="align-right"><strong>{money.format((unitCostCents * movement.quantity) / 100)}</strong><small>{money.format(unitCostCents / 100)} c/u · {movement.costSource || "KARDEX"}</small></td>
            <td><button type="button" className="secondary-button trace-button" onClick={() => setTrace(movement)}><ClipboardList size={14} />Ver historial</button></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>
    {trace && <TraceHistoryModal selected={trace} movements={relatedTrace(trace, allMovements)} onClose={() => setTrace(null)} />}
  </>;
}

function TraceHistoryModal({ selected, movements, onClose }: { selected: Movement; movements: Movement[]; onClose: () => void }) {
  return <div className="modal-layer"><div className="modal-card trace-history-modal">
    <div className="modal-head"><div><span className="modal-kicker">TRAZABILIDAD DEL EQUIPO</span><h2>{selected.sku} · {selected.serials || selected.orderNumber || "Sin serie"}</h2><p>Historial cronológico desde el ingreso hasta la salida.</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <div className="trace-timeline">{movements.map((movement) => {
      const outgoing = movement.type === "salida" || movement.type === "baja";
      return <article key={movement.id} className={outgoing ? "outgoing" : "incoming"}><span>{outgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div><small>{displayDate(movement.movementDate)} · {movement.type.toUpperCase()}</small><strong>{movement.document || "Sin GR"} · Pedido de ingreso: {movement.orderNumber || "Sin pedido"}</strong><p>{outgoing ? `Destino: ${movement.destinationSite || "—"}` : `Origen: ${movement.originSite || movement.origin || "MO Company"}`} · Región: {movement.region || "—"} · Contrata: {movement.contractor || "—"} · RUC/DNI: {movement.contractorDocument || "—"}</p><p>Coordinador Entel: {movement.coordinator || "—"} · Coordinador F1: {movement.coordinatorF1 || "—"} · Cantidad {movement.quantity} {movement.unitMeasure || movement.unit}</p><GrLinkCell link={movement.grLink} /></div></article>;
    })}</div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cerrar trazabilidad</button></div>
  </div></div>;
}

function StockTable({ products, movements, loading }: { products: Product[]; movements: Movement[]; loading: boolean }) {
  const [scope, setScope] = useState<"gr" | "serie" | "proyecto" | "pedido" | "sku" | "coordinador">("pedido");
  const [traceQuery, setTraceQuery] = useState("");
  const traceStockByProduct = useMemo(() => {
    const map = new Map<number, { balances: Map<string, number>; untracked: number; hasTracking: boolean }>();
    movements.forEach((movement) => {
      const current = map.get(movement.productId) ?? { balances: new Map<string, number>(), untracked: 0, hasTracking: false };
      const effect = movementEffect(movement.type);
      const tokens = movementSeries(movement.serials);
      if (!tokens.length) {
        current.untracked += effect * movement.quantity;
      } else {
        current.hasTracking = true;
        tokens.forEach((token) => current.balances.set(token, (current.balances.get(token) ?? 0) + effect * seriesQuantity(movement.serials, movement.quantity, token)));
      }
      map.set(movement.productId, current);
    });
    return map;
  }, [movements]);
  const traceSummary = (productId: number) => {
    const data = traceStockByProduct.get(productId);
    const available = [...(data?.balances ?? new Map<string, number>())].filter(([, balance]) => balance > 0);
    return {
      tokens: available,
      series: available.filter(([, balance]) => balance === 1).length,
      lots: available.filter(([, balance]) => balance > 1).length,
      untracked: Math.max(0, data?.untracked ?? 0),
      hasTracking: data?.hasTracking ?? false,
    };
  };
  const traceAlerts = products.map((product) => ({ product, trace: traceSummary(product.id) }))
    .filter(({ product, trace }) => trace.hasTracking && product.stock <= product.minStock)
    .sort((a, b) => a.product.stock - b.product.stock || a.product.sku.localeCompare(b.product.sku));

  const traceRows = useMemo(() => {
    const query = traceQuery.trim().toLowerCase();
    const baseRows = scope === "gr" ? movements.filter((movement) => ["salida", "baja"].includes(movement.type)) : movements;
    const filtered = query
      ? baseRows.filter((movement) => {
          const value = scope === "gr"
            ? movement.document
            : scope === "serie"
              ? movement.serials
              : scope === "proyecto"
                ? `${movement.project} ${movement.destinationSite} ${movement.originSite}`
                : scope === "pedido"
                  ? movement.orderNumber
                  : scope === "coordinador"
                    ? movement.coordinator
                    : `${movement.sku} ${movement.description}`;
          return value.toLowerCase().includes(query);
        })
      : baseRows.slice(0, 100);
    return [...filtered].sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.id - a.id);
  }, [movements, scope, traceQuery]);

  const traceIncoming = traceRows.filter((row) => !["salida", "baja", "traslado"].includes(row.type)).reduce((sum, row) => sum + row.quantity, 0);
  const traceOutgoing = traceRows.filter((row) => ["salida", "baja"].includes(row.type)).reduce((sum, row) => sum + row.quantity, 0);
  const scopeLabel = scope === "gr" ? "GR de despacho" : scope === "serie" ? "Serie o lote" : scope === "proyecto" ? "Proyecto o site" : scope === "pedido" ? "N° de pedido" : scope === "coordinador" ? "Coordinador Entel" : "SKU";

  return <>
    <section className="panel trace-panel">
      <div className="panel-title"><div><h2>Consulta de stock y trazabilidad</h2><p>Busca principalmente por pedido, GR o Coordinador Entel.</p></div></div>
      <div className="stock-scope-tabs">
        <button className={scope === "pedido" ? "active" : ""} onClick={() => { setScope("pedido"); setTraceQuery(""); }}><ClipboardList size={17} /><span><strong>N° Pedido</strong><small>Todo lo asignado al pedido</small></span></button>
        <button className={scope === "gr" ? "active" : ""} onClick={() => { setScope("gr"); setTraceQuery(""); }}><FileSpreadsheet size={17} /><span><strong>GR de despacho</strong><small>Equipos incluidos en la guía</small></span></button>
        <button className={scope === "coordinador" ? "active" : ""} onClick={() => { setScope("coordinador"); setTraceQuery(""); }}><Users size={17} /><span><strong>Coordinador Entel</strong><small>Movimientos bajo su control</small></span></button>
      </div>
      <div className="trace-controls stock-trace-controls">
        <label className="field trace-query"><span>{scopeLabel}</span><input value={traceQuery} onChange={(event) => setTraceQuery(event.target.value)} placeholder={`Escribe ${scopeLabel.toLowerCase()}...`} /></label>
        <label className="field"><span>Otros criterios</span><select value={scope} onChange={(event) => { setScope(event.target.value as typeof scope); setTraceQuery(""); }}><option value="pedido">N° Pedido</option><option value="gr">GR de despacho</option><option value="coordinador">Coordinador Entel</option><option value="serie">Serie / Lote</option><option value="proyecto">Proyecto / Site</option><option value="sku">SKU</option></select></label>
        <div className="trace-summary"><span><b>{number.format(traceRows.length)}</b> movimientos</span><span className="positive"><b>+{number.format(traceIncoming)}</b> ingresos</span><span className="negative"><b>−{number.format(traceOutgoing)}</b> salidas</span></div>
      </div>
    </section>

    <section className="panel trace-stock-alert-panel">
      <div className="panel-title"><div><h2>Alertas de series y lotes por SKU</h2><p>Solo muestra SKU con trazabilidad y stock igual o menor al mínimo configurado.</p></div><span className="count-badge">{traceAlerts.length}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Alerta</th><th>SKU / Equipo</th><th className="align-right">Series disponibles</th><th className="align-right">Lotes disponibles</th><th className="align-right">Sin serie/lote</th><th className="align-right">Stock / Mínimo</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}><Empty text="Calculando alertas de trazabilidad..." /></td></tr> : !traceAlerts.length ? <tr><td colSpan={6}><Empty text="No hay SKU con series o lotes por debajo del mínimo." /></td></tr> : traceAlerts.map(({ product, trace }) => <tr key={product.id}><td><span className={`status-pill ${product.stock <= 0 ? "status-low" : "status-warning"}`}><i />{product.stock <= 0 ? "Sin stock" : "Stock mínimo"}</span></td><td><strong>{product.sku}</strong><small>{product.description}</small></td><td className="align-right"><strong>{trace.series}</strong><small>serie(s)</small></td><td className="align-right"><strong>{trace.lots}</strong><small>lote(s)</small></td><td className="align-right"><strong>{trace.untracked}</strong><small>{product.unit}</small></td><td className="align-right"><strong className="negative">{number.format(product.stock)}</strong><small>mín. {number.format(product.minStock)} {product.unit}</small></td></tr>)}</tbody></table></div>
    </section>

    <MovementTable movements={traceRows} loading={loading} title={`Historial por ${scopeLabel}`} subtitle={traceQuery ? `${traceRows.length} movimientos encontrados` : "Mostrando los últimos 100 movimientos"} />

    <section className="panel table-panel stock-current-panel"><div className="panel-title"><div><h2>Stock actual por SKU</h2><p>{products.length} SKU entre MO Company y F1 en tránsito</p></div></div><div className="table-wrap"><table><thead><tr><th>SKU</th><th>Descripción</th><th>Serie / Lote disponible</th><th>Proyecto / Propietario</th><th>Ubicación</th><th>Estado</th><th className="align-right">Stock actual</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}><Empty text="Cargando stock..." /></td></tr> : products.length === 0 ? <tr><td colSpan={7}><Empty text="Registra tu primer producto para comenzar." /></td></tr> : products.map((product) => { const low = product.stock <= product.minStock; const trace = traceSummary(product.id); return <tr key={product.id}><td><strong>{product.sku}</strong><small>{product.category}</small></td><td><strong>{product.description}</strong><small>{money.format(product.unitCostCents / 100)} c/u · {product.costSource || "KARDEX"}</small></td><td><strong>{trace.tokens.slice(0, 2).map(([token, balance]) => `${token} (${balance})`).join(", ") || (trace.untracked ? `${trace.untracked} sin serie/lote` : "Sin stock trazable")}</strong><small>{trace.series} series · {trace.lots} lotes disponibles</small></td><td><strong>{product.defaultProject || product.client}</strong><small>{product.owner}</small></td><td><strong>{product.location || "MO COMPANY"}</strong><small>{(product.location || "").includes("F1") ? "Tránsito temporal F1" : "Stock en almacén"}</small></td><td><span className={`status-pill ${low ? "status-low" : "status-ok"}`}><i />{low ? "Reponer" : "Disponible"}</span></td><td className="align-right"><strong className={low ? "negative" : ""}>{number.format(product.stock)}</strong><small>{product.unit} · mín. {product.minStock}</small></td></tr>; })}</tbody></table></div></section>
  </>;
}

function LotView({ movements, loading }: { movements: Movement[]; loading: boolean }) {
  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      orderNumber: string;
      coordinator: string;
      coordinatorF1: string;
      skus: Map<string, string>;
      series: Set<string>;
      projects: Set<string>;
      documents: Set<string>;
      incoming: number;
      outgoing: number;
      balance: number;
      lastDate: string;
    }>();

    movements.forEach((movement) => {
      const orderNumber = movement.orderNumber.trim() || "SIN PEDIDO";
      const coordinator = movement.coordinator.trim() || "SIN COORDINADOR";
      const key = `${orderNumber.toUpperCase()}::${coordinator.toUpperCase()}`;
      const group = map.get(key) ?? {
        key,
        orderNumber,
        coordinator,
        coordinatorF1: movement.coordinatorF1,
        skus: new Map<string, string>(),
        series: new Set<string>(),
        projects: new Set<string>(),
        documents: new Set<string>(),
        incoming: 0,
        outgoing: 0,
        balance: 0,
        lastDate: movement.movementDate,
      };
      const effect = movement.type === "salida" || movement.type === "baja" ? -1 : movement.type === "traslado" ? 0 : 1;
      group.skus.set(movement.sku, movement.description);
      movement.serials.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).forEach((item) => group.series.add(item));
      if (movement.project) group.projects.add(movement.project);
      if (movement.document) group.documents.add(movement.document);
      if (effect > 0) group.incoming += movement.quantity;
      if (effect < 0) group.outgoing += movement.quantity;
      group.balance += movement.quantity * effect;
      if (movement.movementDate > group.lastDate) group.lastDate = movement.movementDate;
      if (!group.coordinatorF1 && movement.coordinatorF1) group.coordinatorF1 = movement.coordinatorF1;
      map.set(key, group);
    });

    return [...map.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [movements]);

  const multiSku = groups.filter((group) => group.skus.size > 1).length;
  const totalSkus = new Set(groups.flatMap((group) => [...group.skus.keys()])).size;
  const available = groups.reduce((sum, group) => sum + Math.max(0, group.balance), 0);

  return <>
    <section className="lot-metrics">
      <article><span><Layers3 size={20} /></span><div><small>LOTES / PEDIDOS</small><strong>{number.format(groups.length)}</strong></div></article>
      <article><span><Boxes size={20} /></span><div><small>LOTES MULTI-SKU</small><strong>{number.format(multiSku)}</strong></div></article>
      <article><span><ClipboardList size={20} /></span><div><small>SKU CONTROLADOS</small><strong>{number.format(totalSkus)}</strong></div></article>
      <article><span><CheckCircle2 size={20} /></span><div><small>SALDO EN LOTES</small><strong>{number.format(available)}</strong></div></article>
    </section>

    <section className="mail-rules-card">
      <div className="mail-rules-head">
        <span><Mail size={21} /></span>
        <div><strong>Reglas de notificación confirmadas</strong><p>Un correo consolidado por pedido y guía, incluyendo todos los SKU del lote.</p></div>
        <b>PENDIENTE DE POWER AUTOMATE</b>
      </div>
      <div className="mail-rules-grid">
        <article><span className="entry"><ArrowDownLeft size={17} /></span><div><small>INGRESO</small><strong>Coordinador F1</strong><p>Se identifica con el campo “Coordinador F1” del ingreso.</p></div></article>
        <article><span className="exit"><ArrowUpRight size={17} /></span><div><small>SALIDA</small><strong>Tabla de Coordinadores</strong><p>El correo se buscará usando el Coordinador Entel registrado.</p></div></article>
      </div>
    </section>

    <section className="panel table-panel">
      <div className="panel-title"><div><h2>Control conjunto de series y lotes</h2><p>Llave de control: N° Pedido + Coordinador Entel; cada pedido muestra todos sus SKU.</p></div></div>
      <div className="table-wrap"><table className="lots-table"><thead><tr><th>N° Pedido</th><th>Coordinador Entel</th><th>SKU incluidos</th><th>Series / Lotes</th><th>Proyecto / GR</th><th className="align-right">Ingresos</th><th className="align-right">Salidas</th><th className="align-right">Saldo</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8}><Empty text="Agrupando lotes..." /></td></tr> : !groups.length ? <tr><td colSpan={8}><Empty text="Los lotes aparecerán al registrar movimientos con pedido y coordinador." /></td></tr> : groups.map((group) => <tr key={group.key}>
          <td><strong>{group.orderNumber}</strong><small>Último mov. {displayDate(group.lastDate)}</small></td>
          <td><strong>{group.coordinator}</strong><small>{group.coordinatorF1 ? `F1: ${group.coordinatorF1}` : "Sin coordinador F1"}</small></td>
          <td><div className="sku-stack">{[...group.skus.entries()].map(([sku, description]) => <span key={sku}><b>{sku}</b><em>{description}</em></span>)}</div></td>
          <td><strong>{[...group.series].slice(0, 2).join(", ") || "Control por cantidad"}</strong><small>{group.series.size} series/lotes registrados</small></td>
          <td><strong>{[...group.projects].join(", ") || "—"}</strong><small>{[...group.documents].slice(0, 2).join(", ") || "Sin GR"}</small></td>
          <td className="align-right"><strong className="positive">+{number.format(group.incoming)}</strong></td>
          <td className="align-right"><strong className="negative">−{number.format(group.outgoing)}</strong></td>
          <td className="align-right"><strong>{number.format(group.balance)}</strong><small>unidades</small></td>
        </tr>)}
      </tbody></table></div>
    </section>
  </>;
}

type DispatchTracking = { code: "current" | "warning" | "critical" | "done"; label: string; days: number };
type GrPreview = { kind: "Ingreso" | "Despacho"; document: string; url: string; date: string };

function validationCompleted(validation?: InstallationValidation) {
  return Boolean(validation && (validation.evidenceSsnn || validation.installedSite || validation.requestStatus !== "PENDIENTE"));
}

function dispatchTracking(movementDate: string, validation?: InstallationValidation): DispatchTracking {
  const date = kardexDate(movementDate);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  if (date) date.setHours(12, 0, 0, 0);
  const days = date ? Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000)) : 0;
  if (validationCompleted(validation)) return { code: "done", label: "Sustentado", days };
  if (days <= 7) return { code: "current", label: "Al día", days };
  if (days <= 14) return { code: "warning", label: "Atención", days };
  return { code: "critical", label: "Crítico", days };
}

function normalizedAgeBucket(value?: string) {
  if (value === "Mayor a 2 años") return "Mayor a 1 año";
  return value || "Sin KPI";
}

function ConciliationView({ movements, validations, auditImports, auditRecords, auditHistoryRecords, loading, saving, onSave, onOpenAudit }: { movements: Movement[]; validations: InstallationValidation[]; auditImports: AuditImportRow[]; auditRecords: AuditRecord[]; auditHistoryRecords: AuditRecord[]; loading: boolean; saving: boolean; onSave: (payload: Record<string, unknown>) => void; onOpenAudit: () => void }) {
  const [grFilter, setGrFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
  const [trafficFilter, setTrafficFilter] = useState("all");
  const [kpiFilter, setKpiFilter] = useState("all");
  const [grPreview, setGrPreview] = useState<GrPreview | null>(null);

  const validationMap = useMemo(() => new Map(
    validations.map((validation) => [`${validation.movementId}::${validation.serial.toUpperCase()}`, validation]),
  ), [validations]);
  const auditMap = useMemo(() => new Map(auditRecords.map((record) => [`${record.source}::${record.sourceKey.toUpperCase()}`, record])), [auditRecords]);
  const auditHistoryMap = useMemo(() => new Map(auditHistoryRecords.map((record) => [`${record.source}::${record.sourceKey.toUpperCase()}`, record])), [auditHistoryRecords]);
  const auditImportMap = useMemo(() => new Map(auditImports.map((item) => [item.id, item])), [auditImports]);
  const entriesBySeries = useMemo(() => {
    const map = new Map<string, Movement[]>();
    movements.filter((movement) => ["entrada", "devolucion"].includes(movement.type)).forEach((movement) => {
      const series = movement.serials.split(/[,;\n]/).map((item) => item.trim().toUpperCase()).filter(Boolean);
      (series.length ? series : [""]).forEach((serial) => {
        const key = `${movement.productId}::${serial}`;
        map.set(key, [...(map.get(key) ?? []), movement]);
      });
    });
    map.forEach((items) => items.sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.id - a.id));
    return map;
  }, [movements]);

  const rows = useMemo(() => movements
    .filter((movement) => movement.type === "salida")
    .flatMap((movement) => {
      const series = movement.serials.split(/[,;\n]/).map((item) => item.trim().toUpperCase()).filter(Boolean);
      return (series.length ? series : [""]).map((serial) => {
        const validation = validationMap.get(`${movement.id}::${serial}`);
        const candidates = entriesBySeries.get(`${movement.productId}::${serial}`) ?? [];
        const entryMovement = candidates.find((entry) => entry.orderNumber === movement.orderNumber && entry.movementDate <= movement.movementDate)
          ?? candidates.find((entry) => entry.movementDate <= movement.movementDate)
          ?? candidates.find((entry) => entry.orderNumber === movement.orderNumber)
          ?? candidates[0];
        const sourceKey = `${movement.sku.toUpperCase()}::${serial}`;
        const entelAudit = auditMap.get(`ENTEL::${sourceKey}`);
        const oracleAudit = auditMap.get(`ORACLE::${sourceKey}`);
        const entelHistory = auditHistoryMap.get(`ENTEL::${sourceKey}`);
        const oracleHistory = auditHistoryMap.get(`ORACLE::${sourceKey}`);
        const entelSnapshot = entelAudit ?? entelHistory;
        return { movement, serial, validation, entryMovement, entelAudit, oracleAudit, entelHistory, oracleHistory, entelSnapshot, tracking: dispatchTracking(movement.movementDate, validation) };
      });
    })
    .sort((a, b) => b.movement.movementDate.localeCompare(a.movement.movementDate) || b.movement.id - a.movement.id), [movements, validationMap, entriesBySeries, auditMap, auditHistoryMap]);

  const normalizedGrFilter = grFilter.trim().toLowerCase();
  const normalizedSiteFilter = siteFilter.trim().toLowerCase();
  const normalizedCoordinatorFilter = coordinatorFilter.trim().toLowerCase();
  const filteredRows = rows.filter(({ movement, tracking, entelSnapshot }) => (
    (!normalizedGrFilter || movement.document.toLowerCase().includes(normalizedGrFilter))
    && (!normalizedSiteFilter || movement.destinationSite.toLowerCase().includes(normalizedSiteFilter))
    && (!normalizedCoordinatorFilter || `${movement.coordinator} ${movement.coordinatorF1}`.toLowerCase().includes(normalizedCoordinatorFilter))
    && (trafficFilter === "all" || tracking.code === trafficFilter)
    && (kpiFilter === "all" || normalizedAgeBucket(entelSnapshot?.ageBucket) === kpiFilter)
  ));
  const grOptions = [...new Set(rows.map(({ movement }) => movement.document).filter(Boolean))].sort();
  const siteOptions = [...new Set(rows.map(({ movement }) => movement.destinationSite.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const coordinatorOptions = [...new Set(rows.flatMap(({ movement }) => [movement.coordinatorF1.trim(), movement.coordinator.trim()]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const completed = rows.filter(({ validation }) => validationCompleted(validation)).length;
  const trafficCounts = {
    current: rows.filter((row) => row.tracking.code === "current").length,
    warning: rows.filter((row) => row.tracking.code === "warning").length,
    critical: rows.filter((row) => row.tracking.code === "critical").length,
  };
  const coordinatorAlerts = useMemo(() => {
    const grouped = new Map<string, { name: string; entel: string; warning: number; critical: number; oldest: number; costCents: number; keys: Set<string> }>();
    rows.filter((row) => ["warning", "critical"].includes(row.tracking.code)).forEach((row) => {
      const name = row.movement.coordinatorF1.trim() || row.movement.coordinator.trim() || "SIN COORDINADOR";
      const key = name.toUpperCase();
      const group = grouped.get(key) ?? { name, entel: row.movement.coordinator, warning: 0, critical: 0, oldest: 0, costCents: 0, keys: new Set<string>() };
      if (row.tracking.code === "warning") group.warning += 1;
      if (row.tracking.code === "critical") group.critical += 1;
      group.oldest = Math.max(group.oldest, row.tracking.days);
      if (row.entelSnapshot && !group.keys.has(row.entelSnapshot.sourceKey)) {
        group.costCents += row.entelSnapshot.totalCostCents;
        group.keys.add(row.entelSnapshot.sourceKey);
      }
      grouped.set(key, group);
    });
    return [...grouped.values()].sort((a, b) => b.critical - a.critical || b.warning - a.warning || b.costCents - a.costCents);
  }, [rows]);
  const hasFilters = Boolean(grFilter || siteFilter || coordinatorFilter || trafficFilter !== "all" || kpiFilter !== "all");

  async function exportCriticals(coordinatorName: string) {
    const selected = rows.filter((row) => {
      const responsible = row.movement.coordinatorF1.trim() || row.movement.coordinator.trim() || "SIN COORDINADOR";
      return responsible.toUpperCase() === coordinatorName.toUpperCase() && row.tracking.code === "critical";
    });
    if (!selected.length) return;
    const XLSX = await import("xlsx");
    const detail = [
      ["Semáforo", "Días", "Coordinador F1", "Coordinador Entel", "Fecha salida", "GR despacho", "Link GR despacho", "GR ingreso", "Link GR ingreso", "N° Pedido", "SKU", "Descripción", "Serie/Lote", "Cantidad", "Site", "Proyecto", "Auditoría Entel", "Oracle", "Costo Entel", "KPI"],
      ...selected.map((row) => [
        "CRÍTICO",
        row.tracking.days,
        row.movement.coordinatorF1,
        row.movement.coordinator,
        row.movement.movementDate,
        row.movement.document,
        row.movement.grLink,
        row.entryMovement?.document ?? "",
        row.entryMovement?.grLink ?? "",
        row.movement.orderNumber,
        row.movement.sku,
        row.movement.description,
        row.serial,
        movementSeries(row.movement.serials).length > 1 ? 1 : row.movement.quantity,
        row.movement.destinationSite,
        row.movement.project,
        row.entelAudit ? "Vigente" : row.entelHistory ? "Retirado del último corte" : "Nunca encontrado",
        row.oracleAudit ? "Vigente" : row.oracleHistory ? "Retirado del último corte" : "Nunca encontrado",
        (row.entelSnapshot?.totalCostCents ?? 0) / 100,
        normalizedAgeBucket(row.entelSnapshot?.ageBucket),
      ]),
    ];
    const detailSheet = XLSX.utils.aoa_to_sheet(detail);
    selected.forEach((row, index) => {
      const dispatchCell = detailSheet[XLSX.utils.encode_cell({ r: index + 1, c: 6 })];
      if (dispatchCell && row.movement.grLink) dispatchCell.l = { Target: row.movement.grLink, Tooltip: `Abrir ${row.movement.document}` };
      const entryCell = detailSheet[XLSX.utils.encode_cell({ r: index + 1, c: 8 })];
      if (entryCell && row.entryMovement?.grLink) entryCell.l = { Target: row.entryMovement.grLink, Tooltip: `Abrir ${row.entryMovement.document}` };
    });
    detailSheet["!cols"] = detail[0].map((_, index) => ({ wch: [12, 8, 23, 23, 13, 18, 34, 18, 34, 17, 17, 34, 22, 10, 24, 20, 24, 24, 15, 20][index] }));
    const guideMap = new Map<string, [string, string, string, string]>();
    selected.forEach((row) => {
      if (row.movement.document || row.movement.grLink) guideMap.set(`D::${row.movement.document}::${row.movement.grLink}`, ["DESPACHO", row.movement.document, row.movement.grLink, row.movement.movementDate]);
      if (row.entryMovement?.document || row.entryMovement?.grLink) guideMap.set(`I::${row.entryMovement.document}::${row.entryMovement.grLink}`, ["INGRESO", row.entryMovement.document, row.entryMovement.grLink, row.entryMovement.movementDate]);
    });
    const guides = [["Tipo", "GR", "Link para descargar/adjuntar", "Fecha"], ...guideMap.values()];
    const guideSheet = XLSX.utils.aoa_to_sheet(guides);
    [...guideMap.values()].forEach((guide, index) => {
      const cell = guideSheet[XLSX.utils.encode_cell({ r: index + 1, c: 2 })];
      if (cell && guide[2]) cell.l = { Target: guide[2], Tooltip: `Abrir ${guide[1]}` };
    });
    guideSheet["!cols"] = [{ wch: 14 }, { wch: 22 }, { wch: 48 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Críticos");
    XLSX.utils.book_append_sheet(workbook, guideSheet, "GR para adjuntar");
    const safeName = coordinatorName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    XLSX.writeFile(workbook, `criticos-${safeName}-${today()}.xlsx`, { compression: true });
  }

  return <>
    <section className="reconcile-metrics">
      <article><span><ClipboardList size={20} /></span><div><small>GR DE DESPACHO</small><strong>{number.format(grOptions.length)}</strong></div></article>
      <article><span><Layers3 size={20} /></span><div><small>SERIES / LOTES</small><strong>{number.format(rows.length)}</strong></div></article>
      <article><span><CheckCircle2 size={20} /></span><div><small>CON SUSTENTO</small><strong>{number.format(completed)}</strong></div></article>
      <article><span><AlertTriangle size={20} /></span><div><small>PENDIENTES</small><strong>{number.format(Math.max(0, rows.length - completed))}</strong></div></article>
    </section>

    <section className="dispatch-semaphore-summary">
      <article className="current"><i /><div><small>AL DÍA · 0 A 7 DÍAS</small><strong>{number.format(trafficCounts.current)}</strong></div></article>
      <article className="warning"><i /><div><small>ATENCIÓN · 8 A 14 DÍAS</small><strong>{number.format(trafficCounts.warning)}</strong></div></article>
      <article className="critical"><i /><div><small>CRÍTICO · MÁS DE 14 DÍAS</small><strong>{number.format(trafficCounts.critical)}</strong></div></article>
      <div><strong>Semáforo de conciliación</strong><small>Los equipos sustentados quedan cerrados en verde.</small></div>
    </section>

    {!auditRecords.length && <section className="audit-link-banner"><Database size={20} /><div><strong>Falta cargar la auditoría Entel y Oracle</strong><span>Cuando cargues ambos cortes, esta conciliación mostrará costo, KPI y presencia en cada fuente.</span></div><button className="secondary-button" onClick={onOpenAudit}>Ir a Auditoría Entel</button></section>}

    {coordinatorAlerts.length > 0 && <section className="panel coordinator-alert-panel">
      <div className="panel-title"><div><h2>Despachos vencidos por coordinador</h2><p>Pendientes con más de una semana. El Excel incluye otra hoja con las GR para descargar y adjuntar al correo.</p></div><span className="count-badge">{coordinatorAlerts.length}</span></div>
      <div className="table-wrap"><table><thead><tr><th>Coordinador responsable</th><th>Coordinador Entel</th><th className="align-right">8–14 días</th><th className="align-right">Más de 14 días</th><th className="align-right">Mayor atraso</th><th className="align-right">Costo Entel pendiente</th><th>Reporte</th></tr></thead><tbody>{coordinatorAlerts.slice(0, 12).map((row) => <tr key={row.name}><td><strong>{row.name}</strong><small>{row.name === "SIN COORDINADOR" ? "Requiere asignación" : "Coordinador F1 / responsable"}</small></td><td><strong>{row.entel || "—"}</strong></td><td className="align-right"><span className="traffic-count warning">{number.format(row.warning)}</span></td><td className="align-right"><span className="traffic-count critical">{number.format(row.critical)}</span></td><td className="align-right"><strong>{number.format(row.oldest)} días</strong></td><td className="align-right"><strong>{money.format(row.costCents / 100)}</strong></td><td><button className="secondary-button critical-export" disabled={!row.critical} onClick={() => void exportCriticals(row.name)}><Download size={14} />Descargar críticos</button></td></tr>)}</tbody></table></div>
    </section>}

    <section className="panel reconcile-filter-panel reconcile-filter-expanded">
      <label className="field"><span>GR de despacho</span><input list="dispatch-gr-options" value={grFilter} onChange={(event) => setGrFilter(event.target.value)} placeholder="Escribe o selecciona..." /><datalist id="dispatch-gr-options">{grOptions.map((gr) => <option value={gr} key={gr} />)}</datalist></label>
      <label className="field"><span>Site de salida</span><input list="dispatch-site-options" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} placeholder="Código o nombre..." /><datalist id="dispatch-site-options">{siteOptions.map((site) => <option value={site} key={site} />)}</datalist></label>
      <label className="field"><span>Coordinador F1 o Entel</span><input list="dispatch-coordinator-options" value={coordinatorFilter} onChange={(event) => setCoordinatorFilter(event.target.value)} placeholder="Nombre del coordinador..." /><datalist id="dispatch-coordinator-options">{coordinatorOptions.map((coordinator) => <option value={coordinator} key={coordinator} />)}</datalist></label>
      <label className="field"><span>Semáforo</span><select value={trafficFilter} onChange={(event) => setTrafficFilter(event.target.value)}><option value="all">Todos</option><option value="current">Al día · 0 a 7 días</option><option value="warning">Atención · 8 a 14 días</option><option value="critical">Crítico · más de 14 días</option><option value="done">Sustentados</option></select></label>
      <label className="field"><span>KPI Entel</span><select value={kpiFilter} onChange={(event) => setKpiFilter(event.target.value)}><option value="all">Todos los KPI</option><option>Menor a 6 meses</option><option>Mayor a 6 meses</option><option>Mayor a 1 año</option><option>Sin KPI</option></select></label>
      <div><strong>{number.format(filteredRows.length)} series</strong><small>Resultado de los filtros.</small></div>
      {hasFilters && <button className="secondary-button" onClick={() => { setGrFilter(""); setSiteFilter(""); setCoordinatorFilter(""); setTrafficFilter("all"); setKpiFilter("all"); }}>Limpiar</button>}
    </section>

    <section className="panel table-panel">
      <div className="panel-title"><div><h2>Validación por serie única</h2><p>Incluye auditoría Entel, Oracle, costo, KPI, semáforo y ambas GR.</p></div></div>
      <div className="table-wrap"><table className="conciliation-table"><thead><tr><th>Seguimiento</th><th>GR ingreso</th><th>GR despacho</th><th>SKU</th><th>Serie / Lote</th><th>Pedido / Coordinadores</th><th>Proyecto / Site</th><th>Auditoría Entel</th><th>Oracle</th><th>Costos</th><th>KPI antigüedad</th><th>Sustento SSNN</th><th>Site instalado</th><th>Fecha gestión</th><th>Responsable</th><th>Status solicitud</th><th>Nro solicitud Jira</th><th>Revisor</th><th>Fecha revisión Entel</th><th>Año</th><th>Validación Oracle</th><th>Informe / GR</th><th>Observación</th><th>Acción</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={24}><Empty text="Cargando salidas para conciliación..." /></td></tr> : !filteredRows.length ? <tr><td colSpan={24}><Empty text="No hay salidas que coincidan con los filtros indicados." /></td></tr> : filteredRows.map((row) => <ReconciliationRow key={`${row.movement.id}-${row.serial || "sin-serie"}`} {...row} auditImportMap={auditImportMap} saving={saving} onSave={onSave} onPreview={setGrPreview} />)}
      </tbody></table></div>
    </section>

    {grPreview && <div className="modal-layer"><div className="modal-card gr-preview-modal"><div className="modal-head"><div><span className="modal-kicker">GR DE {grPreview.kind.toUpperCase()}</span><h2>{grPreview.document || "Documento sin número"}</h2><p>{displayDate(grPreview.date)}</p></div><button className="icon-button" onClick={() => setGrPreview(null)} aria-label="Cerrar"><X size={19} /></button></div><div className="gr-preview-body"><iframe src={grPreview.url} title={`GR de ${grPreview.kind}`} /><div className="gr-preview-fallback"><span>Si el proveedor del archivo no permite la vista previa, ábrelo en una pestaña nueva.</span><a className="secondary-button" href={grPreview.url} target="_blank" rel="noreferrer">Abrir documento completo</a></div></div></div></div>}
  </>;
}

function GrDocumentCell({ movement, kind, onPreview }: { movement?: Movement; kind: "Ingreso" | "Despacho"; onPreview: (preview: GrPreview) => void }) {
  const previewUrl = externalUrl(movement?.grLink ?? "");
  return <><strong>{movement?.document || `SIN GR ${kind.toUpperCase()}`}</strong><small>{movement ? displayDate(movement.movementDate) : "No se encontró el ingreso"}</small>{previewUrl ? <button type="button" className="gr-view-button" onClick={() => onPreview({ kind, document: movement?.document ?? "", url: previewUrl, date: movement?.movementDate ?? "" })}><FileSpreadsheet size={13} />Visualizar GR</button> : <small className="gr-missing">Sin archivo adjunto</small>}</>;
}

function ReconciliationRow({ movement, serial, validation, entryMovement, entelAudit, oracleAudit, entelHistory, oracleHistory, entelSnapshot, auditImportMap, tracking, saving, onSave, onPreview }: { movement: Movement; serial: string; validation?: InstallationValidation; entryMovement?: Movement; entelAudit?: AuditRecord; oracleAudit?: AuditRecord; entelHistory?: AuditRecord; oracleHistory?: AuditRecord; entelSnapshot?: AuditRecord; auditImportMap: Map<number, AuditImportRow>; tracking: DispatchTracking; saving: boolean; onSave: (payload: Record<string, unknown>) => void; onPreview: (preview: GrPreview) => void }) {
  const formId = `reconcile-${movement.id}-${(serial || "sin-serie").replace(/[^a-zA-Z0-9]/g, "").slice(-18)}`;
  const [editing, setEditing] = useState(!validation);
  const locked = Boolean(validation) && !editing;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(Object.fromEntries(new FormData(event.currentTarget).entries()));
    setEditing(false);
  }
  const input = (name: keyof InstallationValidation, placeholder = "") => <input form={formId} name={name} defaultValue={String(validation?.[name] ?? "")} placeholder={placeholder} disabled={locked} />;
  const lineQuantity = movementSeries(movement.serials).length > 1 ? 1 : movement.quantity;
  const f1UnitCostCents = movement.unitCostCents || movement.productUnitCostCents || 0;
  const oracleMatch = Boolean(oracleAudit && entelAudit && oracleAudit.quantity === entelAudit.quantity);
  const entelLastSeen = entelHistory ? auditImportMap.get(entelHistory.importId) : undefined;
  const oracleLastSeen = oracleHistory ? auditImportMap.get(oracleHistory.importId) : undefined;
  const kpi = normalizedAgeBucket(entelSnapshot?.ageBucket);

  return <tr className={locked ? "reconciliation-locked" : ""}>
    <td><form id={formId} onSubmit={submit}><input type="hidden" name="action" value="reconciliation" /><input type="hidden" name="movementId" value={movement.id} /><input type="hidden" name="serial" value={serial} /></form><span className={`dispatch-light ${tracking.code}`}><i />{tracking.label}</span><small>{number.format(tracking.days)} días desde salida</small></td>
    <td><GrDocumentCell movement={entryMovement} kind="Ingreso" onPreview={onPreview} /></td>
    <td><GrDocumentCell movement={movement} kind="Despacho" onPreview={onPreview} /></td>
    <td><strong>{movement.sku}</strong><small>{movement.description}</small></td>
    <td><strong>{serial || "SIN SERIE"}</strong><small>{movement.equipmentStatus}</small></td>
    <td><strong>{movement.orderNumber || "—"}</strong><small>Entel: {movement.coordinator || "—"}</small><small>F1: {movement.coordinatorF1 || "—"}</small></td>
    <td><strong>{movement.project || "—"}</strong><small>{movement.destinationSite || "Sin site destino"}</small></td>
    <td>{entelAudit ? <><span className="reconcile-status match">VIGENTE EN CORTE</span><strong>{number.format(entelAudit.quantity)} {entelAudit.unitMeasure}</strong><small>{entelAudit.category}</small></> : entelHistory ? <><span className="reconcile-status retired">RETIRADO DEL ÚLTIMO CORTE</span><strong>Último: {number.format(entelHistory.quantity)} {entelHistory.unitMeasure}</strong><small>{displayDate(entelLastSeen?.cutoffDate || entelLastSeen?.createdAt || "")}</small></> : <><span className="reconcile-status missing">NUNCA ENCONTRADO</span><small>No existe en los cortes Entel conservados</small></>}</td>
    <td>{oracleAudit ? <><span className={`reconcile-status ${oracleMatch ? "match" : entelAudit ? "surplus" : "match"}`}>{oracleMatch ? "COINCIDE" : entelAudit ? "DIFERENCIA" : "VIGENTE EN ORACLE"}</span><strong>{number.format(oracleAudit.quantity)} {oracleAudit.unitMeasure}</strong><small>{oracleAudit.project || oracleAudit.requester || "Stock Oracle"}</small></> : oracleHistory ? <><span className="reconcile-status retired">RETIRADO DEL ÚLTIMO CORTE</span><strong>Último: {number.format(oracleHistory.quantity)} {oracleHistory.unitMeasure}</strong><small>{displayDate(oracleLastSeen?.cutoffDate || oracleLastSeen?.createdAt || "")}</small></> : <><span className="reconcile-status missing">NUNCA ENCONTRADO</span><small>No existe en los cortes Oracle conservados</small></>}</td>
    <td><strong>{money.format((entelSnapshot?.totalCostCents ?? 0) / 100)}</strong><small>{entelAudit ? "Costo Entel del último corte" : entelHistory ? "Último costo conocido Entel" : "Sin costo Entel"}</small><strong>{money.format((f1UnitCostCents * lineQuantity) / 100)}</strong><small>Costo Kardex F1</small></td>
    <td><span className={`age-kpi ${kpi === "Mayor a 1 año" ? "danger" : kpi === "Mayor a 6 meses" ? "warning" : "current"}`}>{kpi.toUpperCase()}</span><small>{entelSnapshot?.ageMonths ? `${entelSnapshot.ageMonths} meses en contrata${entelHistory && !entelAudit ? " · último dato" : ""}` : "Sin antigüedad Entel"}</small></td>
    <td><select form={formId} name="evidenceSsnn" defaultValue={validation?.evidenceSsnn || ""} disabled={locked}><option value="" disabled>Selecciona sustento</option><option>Instalación Site</option><option>Fisico en PDV</option><option>Devuelto por LI</option><option>Facturar a SSNN</option><option>Transferencia entre Contratas</option><option>Sin Sustento</option></select></td>
    <td><input form={formId} list="dispatch-site-options" name="installedSite" defaultValue={validation?.installedSite ?? movement.destinationSite} placeholder="Código o nombre del site" disabled={locked} /></td>
    <td><input form={formId} name="managementDate" type="date" defaultValue={validation?.managementDate ?? ""} disabled={locked} /></td>
    <td>{input("responsible", "Responsable")}</td>
    <td><select form={formId} name="requestStatus" defaultValue={validation?.requestStatus || "PENDIENTE"} disabled={locked}><option>PENDIENTE</option><option>EN GESTIÓN</option><option>SOLICITADO</option><option>REVISADO</option><option>INSTALADO</option><option>OBSERVADO</option><option>CERRADO</option></select></td>
    <td>{input("jiraRequestNumber", "JIRA")}</td>
    <td>{input("reviewer", "Revisor")}</td>
    <td><input form={formId} name="entelReviewDate" type="date" defaultValue={validation?.entelReviewDate ?? ""} disabled={locked} /></td>
    <td><input form={formId} name="year" inputMode="numeric" defaultValue={validation?.year || String(new Date().getFullYear())} disabled={locked} /></td>
    <td><select form={formId} name="oracleStatus" defaultValue={validation?.oracleStatus || "PENDIENTE"} disabled={locked}><option>PENDIENTE</option><option>EN ORACLE</option><option>INSTALADO</option><option>NO APLICA</option><option>OBSERVADO</option></select></td>
    <td>{input("reportGrLink", "https://...")}</td>
    <td><textarea form={formId} name="observation" defaultValue={validation?.observation ?? ""} rows={2} placeholder="Observación" disabled={locked} /></td>
    <td>{locked ? <button type="button" className="secondary-button inline-edit" onClick={() => setEditing(true)}><Pencil size={14} />Editar</button> : <button form={formId} type="submit" className="primary-button inline-save" disabled={saving}><Save size={15} />Guardar</button>}</td>
  </tr>;
}

function RequestView({ products, movements, coordinators, suppliers, requests, warehouse, loading, saving, canRequest, canOperate, onSave }: { products: Product[]; movements: Movement[]; coordinators: Coordinator[]; suppliers: Supplier[]; requests: EquipmentRequest[]; warehouse: string; loading: boolean; saving: boolean; canRequest: boolean; canOperate: boolean; onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [selectedCoordinator, setSelectedCoordinator] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedSeriesLot, setSelectedSeriesLot] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [contractorDocument, setContractorDocument] = useState("");
  const [contractorBusinessName, setContractorBusinessName] = useState("");
  const [pickupPersonDni, setPickupPersonDni] = useState("");
  const [pickupPerson2Dni, setPickupPerson2Dni] = useState("");
  const [items, setItems] = useState<Array<{ productId: number; quantity: number; seriesLot: string }>>([]);
  const [tracking, setTracking] = useState<EquipmentRequest | null>(null);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const activeCoordinators = coordinators.filter((coordinator) => coordinator.active && coordinator.organization === "F1").sort((a, b) => a.name.localeCompare(b.name));
  const coordinator = activeCoordinators.find((item) => item.name === selectedCoordinator);
  const supplier = suppliers.find((item) => item.active && item.documentNumber === contractorDocument.trim());
  const pickupPerson = suppliers.find((item) => item.active && item.documentType === "DNI" && item.documentNumber === pickupPersonDni);
  const pickupPerson2 = suppliers.find((item) => item.active && item.documentType === "DNI" && item.documentNumber === pickupPerson2Dni);
  const orderStock = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    movements.filter((movement) => movement.orderNumber.trim()).forEach((movement) => {
      const order = movement.orderNumber.trim();
      const productsInOrder = map.get(order) ?? new Map<number, number>();
      productsInOrder.set(movement.productId, (productsInOrder.get(movement.productId) ?? 0) + movementEffect(movement.type) * movement.quantity);
      map.set(order, productsInOrder);
    });
    return map;
  }, [movements]);
  const orderOptions = useMemo(() => [...orderStock]
    .filter(([, balances]) => [...balances.values()].some((balance) => balance > 0))
    .map(([order]) => order)
    .sort((a, b) => a.localeCompare(b)), [orderStock]);
  const orderTraceStock = useMemo(() => {
    const map = new Map<string, Map<number, Map<string, number>>>();
    movements.filter((movement) => movement.orderNumber.trim()).forEach((movement) => {
      const order = movement.orderNumber.trim();
      const productsInOrder = map.get(order) ?? new Map<number, Map<string, number>>();
      const traces = productsInOrder.get(movement.productId) ?? new Map<string, number>();
      const tokens = movementSeries(movement.serials);
      if (!tokens.length) {
        traces.set("", (traces.get("") ?? 0) + movementEffect(movement.type) * movement.quantity);
      } else {
        tokens.forEach((token) => traces.set(token, (traces.get(token) ?? 0) + movementEffect(movement.type) * seriesQuantity(movement.serials, movement.quantity, token)));
      }
      productsInOrder.set(movement.productId, traces);
      map.set(order, productsInOrder);
    });
    return map;
  }, [movements]);
  const availableProducts = useMemo(() => products.filter((product) => (orderStock.get(selectedOrder)?.get(product.id) ?? 0) > 0), [orderStock, products, selectedOrder]);
  const selectedProduct = availableProducts.find((product) => {
    const label = `${product.sku} — ${product.description}`;
    return label.toUpperCase() === productQuery.trim().toUpperCase() || product.sku.toUpperCase() === productQuery.trim().toUpperCase();
  });
  const selectedTraceOptions = selectedProduct
    ? [...(orderTraceStock.get(selectedOrder)?.get(selectedProduct.id) ?? new Map<string, number>())]
      .filter(([, balance]) => balance > 0)
      .map(([seriesLot, balance]) => ({ seriesLot, selectionValue: seriesLot || REQUEST_UNTRACKED, balance }))
      .sort((a, b) => a.seriesLot.localeCompare(b.seriesLot))
    : [];
  const selectedTrace = selectedTraceOptions.find((item) => item.selectionValue === selectedSeriesLot);
  const selectedInCart = items.find((item) => item.productId === selectedProduct?.id && item.seriesLot === selectedTrace?.seriesLot)?.quantity ?? 0;
  const selectedAvailable = selectedTrace ? Math.max(0, selectedTrace.balance - selectedInCart) : 0;
  const groupedRequests = useMemo(() => {
    const groups = new Map<string, EquipmentRequest[]>();
    requests.forEach((request) => groups.set(request.requestCode, [...(groups.get(request.requestCode) ?? []), request]));
    return [...groups.values()].sort((a, b) => Math.max(...b.map((row) => row.id)) - Math.max(...a.map((row) => row.id)));
  }, [requests]);

  function pendingDays(request: EquipmentRequest) {
    const start = request.arrivalDate || request.sentDate || request.createdAt;
    const end = request.pickupDate || (request.status === "CERRADA" || request.status === "RECOGIDA" ? request.updatedAt : today());
    const startDate = kardexDate(start);
    const endDate = kardexDate(end);
    return startDate && endDate ? Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000)) : 0;
  }
  const pendingGroups = groupedRequests.filter((group) => !["CERRADA", "RECOGIDA", "RECHAZADA"].includes(group[0].status));
  const delayedGroups = pendingGroups.filter((group) => pendingDays(group[0]) > 7);

  function addItem() {
    const productId = selectedProduct?.id;
    if (!productId || !selectedOrder || !selectedTrace || selectedAvailable <= 0 || quantity > selectedAvailable) return;
    setItems((current) => {
      const existing = current.find((item) => item.productId === productId && item.seriesLot === selectedTrace.seriesLot);
      return existing
        ? current.map((item) => item.productId === productId && item.seriesLot === selectedTrace.seriesLot ? { ...item, quantity: item.quantity + Math.min(selectedAvailable, Math.max(1, quantity)) } : item)
        : [...current, { productId, quantity: Math.max(1, quantity), seriesLot: selectedTrace.seriesLot }];
    });
    setProductQuery("");
    setSelectedSeriesLot("");
    setQuantity(1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const ok = await onSave({ ...values, action: "request", coordinatorEmail: coordinator?.email ?? "", items }, "Solicitud registrada para preparación de despacho.");
    if (ok) {
      form.reset();
      setSelectedCoordinator("");
      setSelectedOrder("");
      setProductQuery("");
      setSelectedSeriesLot("");
      setContractorDocument("");
      setContractorBusinessName("");
      setPickupPersonDni("");
      setPickupPerson2Dni("");
      setItems([]);
    }
  }

  return <>
    <section className="request-alert-strip">
      <article><small>SOLICITUDES ABIERTAS</small><strong>{number.format(pendingGroups.length)}</strong><span>No mueven stock del Kardex</span></article>
      <article className={delayedGroups.length ? "danger" : "ok"}><small>PENDIENTES +7 DÍAS</small><strong>{number.format(delayedGroups.length)}</strong><span>{delayedGroups.length ? "Requieren seguimiento logístico" : "Sin recojos vencidos"}</span></article>
      <article><small>PEDIDOS CON STOCK</small><strong>{number.format(orderOptions.length)}</strong><span>Disponibles para solicitar</span></article>
    </section>
    <section className="request-layout">
      <form className="panel request-form" onSubmit={submit}>
        <div className="panel-title"><div><h2>Nueva solicitud independiente</h2><p>Reserva de atención logística; no crea salidas, ingresos ni modifica stock.</p></div><span><ShoppingCart size={20} /></span></div>
        <div className="request-form-body">
          <div className="form-grid">
            <label className="field"><span>Coordinador F1 *</span><select name="coordinatorName" required value={selectedCoordinator} onChange={(event) => setSelectedCoordinator(event.target.value)}><option value="" disabled>Selecciona un coordinador F1</option>{activeCoordinators.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
            <label className="field"><span>N° Pedido con ingreso *</span><select name="orderNumber" required value={selectedOrder} onChange={(event) => { setSelectedOrder(event.target.value); setItems([]); setProductQuery(""); setSelectedSeriesLot(""); }}><option value="" disabled>Selecciona un pedido ingresado</option>{orderOptions.map((order) => <option value={order} key={order}>{order}</option>)}</select><small>Solo aparecen pedidos con saldo disponible.</small></label>
            <label className="field"><span>Proyecto</span><input name="project" placeholder="Rollout, PEXT, PINT..." /></label>
            <label className="field"><span>Site destino</span><input name="site" placeholder="Código o nombre del site" /></label>
            <label className="field"><span>RUC de la contrata *</span><input name="contractorRuc" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} required value={contractorDocument} onChange={(event) => { const value = event.target.value.replace(/\D/g, "").slice(0, 11); setContractorDocument(value); const match = suppliers.find((item) => item.active && item.documentType === "RUC" && item.documentNumber === value); setContractorBusinessName(match?.businessName ?? ""); }} placeholder="11 dígitos" /><small>{supplier?.documentType === "RUC" ? `Empresa: ${supplier.businessName}` : contractorDocument.length === 11 ? "RUC no registrado; agrégalo primero en Empresas y personas." : "La razón social se completará automáticamente."}</small></label>
            <label className="field"><span>Razón social</span><input name="contractorBusinessName" value={contractorBusinessName} readOnly placeholder="Automático desde el RUC" /></label>
            <label className="field"><span>DNI de persona que recoge *</span><input name="pickupPersonDni" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={pickupPersonDni} onChange={(event) => setPickupPersonDni(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="8 dígitos" /><small>{pickupPerson ? pickupPerson.businessName : pickupPersonDni.length === 8 ? "DNI no registrado; agrégalo en Proveedores/Personas." : "El nombre aparecerá automáticamente."}</small></label>
            <label className="field"><span>Nombre de persona que recoge</span><input value={pickupPerson?.businessName ?? ""} readOnly placeholder="Automático desde el DNI" /></label>
            <label className="field"><span>DNI de segunda persona</span><input name="pickupPerson2Dni" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={pickupPerson2Dni} onChange={(event) => setPickupPerson2Dni(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Opcional · 8 dígitos" /><small>{pickupPerson2 ? pickupPerson2.businessName : pickupPerson2Dni.length === 8 ? "DNI no registrado." : "Opcional."}</small></label>
            <label className="field"><span>Nombre de segunda persona</span><input value={pickupPerson2?.businessName ?? ""} readOnly placeholder="Automático desde el DNI" /></label>
            <label className="field"><span>Región de envío *</span><input name="region" required placeholder="Ej. Lima" /></label>
            <label className="field"><span>Ciudad de envío *</span><input name="city" required placeholder="Ej. Lima / Arequipa" /></label>
            <label className="field"><span>Almacén que atenderá</span><input name="warehouse" value={warehouse} readOnly /></label>
            <label className="field"><span>Fecha requerida</span><input name="neededDate" type="date" min={today()} /></label>
          </div>
          <div className="request-item-builder">
            <label className="field product-search-field"><span>Buscar SKU o descripción</span><input list="request-product-options" value={productQuery} onChange={(event) => { setProductQuery(event.target.value); setSelectedSeriesLot(""); }} placeholder={selectedOrder ? "Escribe parte del SKU o nombre..." : "Primero selecciona el pedido"} disabled={!selectedOrder} /><datalist id="request-product-options">{availableProducts.map((product) => <option key={product.id} value={`${product.sku} — ${product.description}`}>Disponible en pedido: {orderStock.get(selectedOrder)?.get(product.id) ?? 0}</option>)}</datalist><small>{productQuery && !selectedProduct ? "Este SKU no pertenece al pedido o ya no tiene stock." : selectedProduct ? `${selectedTraceOptions.length} serie(s)/lote(s) con saldo · ${orderStock.get(selectedOrder)?.get(selectedProduct.id) ?? 0} ${selectedProduct.unit} en total.` : selectedOrder ? `${availableProducts.length} SKU con saldo en el pedido.` : "El pedido limita los equipos que puedes elegir."}</small></label>
            <label className="field trace-stock-select"><span>Serie / Lote disponible</span><select value={selectedSeriesLot} onChange={(event) => { setSelectedSeriesLot(event.target.value); setQuantity(1); }} disabled={!selectedProduct} required><option value="" disabled>{selectedProduct ? "Selecciona stock" : "Primero elige un SKU"}</option>{selectedTraceOptions.map((item) => <option key={item.selectionValue} value={item.selectionValue}>{item.seriesLot || "Sin serie/lote registrado"} · {item.balance} disponible{item.balance === 1 ? " · Serie" : " · Lote"}</option>)}</select><small>{selectedTrace ? `Puedes solicitar hasta ${selectedAvailable} de ${selectedTrace.seriesLot || "stock sin serie/lote"}.` : "El stock se muestra por serie o lote real del pedido."}</small></label>
            <label className="field"><span>Cantidad</span><input type="number" min="1" max={selectedAvailable || undefined} step="1" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} /></label>
            <button type="button" className="secondary-button" onClick={addItem} disabled={!selectedProduct || !selectedTrace || selectedAvailable <= 0 || quantity > selectedAvailable}><Plus size={15} />Agregar</button>
          </div>
          <div className="request-cart">{!items.length ? <p>Agrega uno o varios SKU seleccionando la serie o lote disponible.</p> : items.map((item) => { const product = productMap.get(item.productId); const itemKey = `${item.productId}::${item.seriesLot}`; return <div key={itemKey}><span><strong>{product?.sku}</strong><small>{product?.description} · {item.seriesLot || "Sin serie/lote"}</small></span><b>{item.quantity} {product?.unit}</b><button type="button" className="icon-button" onClick={() => setItems((current) => current.filter((row) => `${row.productId}::${row.seriesLot}` !== itemKey))} aria-label="Quitar"><X size={15} /></button></div>; })}</div>
          <label className="field"><span>Observación</span><textarea name="notes" rows={2} placeholder="Detalle para Logística" /></label>
          <button className="primary-button request-submit" type="submit" disabled={saving || !items.length || !canRequest || supplier?.documentType !== "RUC" || !pickupPerson || Boolean(pickupPerson2Dni && !pickupPerson2)}>{saving ? "Registrando..." : canRequest ? `Registrar solicitud · ${items.length} SKU` : "Perfil de solo lectura"}</button>
        </div>
      </form>

      <section className="panel request-guide">
        <div className="panel-title"><div><h2>Flujo de atención</h2><p>Seguimiento manual sin alterar inventario.</p></div></div>
        <ol><li><b>1</b><span><strong>Coordinador F1 solicita</strong><small>Elige un pedido real y únicamente SKU con saldo.</small></span></li><li><b>2</b><span><strong>Logística valida</strong><small>Registra GR de salida, ticket de envío y clave.</small></span></li><li><b>3</b><span><strong>Envío y llegada</strong><small>Completa fechas para activar el contador de pendientes.</small></span></li><li><b>4</b><span><strong>Recojo y cierre</strong><small>Al recoger se registra la fecha y se cierra la solicitud.</small></span></li></ol>
      </section>
    </section>

    <section className="panel request-history">
      <div className="panel-title"><div><h2>Solicitudes registradas</h2><p>{number.format(groupedRequests.length)} solicitudes; seguimiento separado del Kardex.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Solicitud</th><th>Coordinador F1</th><th>Pedido / Destino</th><th>Contrata / Recojo</th><th>Equipos solicitados</th><th>GR / Ticket / Fotos</th><th>Envío / Llegada</th><th>Días pendientes</th><th>Estado</th><th>Seguimiento</th></tr></thead><tbody>{loading ? <tr><td colSpan={10}><Empty text="Cargando solicitudes..." /></td></tr> : !groupedRequests.length ? <tr><td colSpan={10}><Empty text="Las solicitudes de los coordinadores F1 aparecerán aquí." /></td></tr> : groupedRequests.map((group) => { const request = group[0]; const days = pendingDays(request); const closed = ["CERRADA", "RECOGIDA", "RECHAZADA"].includes(request.status); return <tr key={request.requestCode}><td><strong>{request.requestCode}</strong><small>{displayDate(request.createdAt)}</small></td><td><strong>{request.coordinatorName}</strong><small>{request.coordinatorEmail || "Sin correo"}</small></td><td><strong>{request.orderNumber}</strong><small>{request.site || request.project || "Sin site"}</small><small>{[request.region, request.city].filter(Boolean).join(" · ") || "Sin región/ciudad"}</small></td><td><strong>{request.contractorBusinessName || "Sin razón social"}</strong><small>RUC: {request.contractorRuc || "—"}</small><small>Recoge 1: {request.pickupPerson || "—"} · DNI {request.pickupPersonDni || "—"}</small>{request.pickupPerson2 && <small>Recoge 2: {request.pickupPerson2} · DNI {request.pickupPerson2Dni || "—"}</small>}</td><td>{group.map((row) => { const product = productMap.get(row.productId); return <span className="request-line" key={row.id}><strong>{product?.sku || `Producto ${row.productId}`}</strong><small>{row.quantity} {product?.unit || "UND"} · {product?.description}</small><small>Serie/Lote: {row.seriesLot || "Sin registro"}</small></span>; })}</td><td><strong>{request.outboundGuide || "Sin GR"}</strong><small>{request.shippingTicket ? `Ticket: ${request.shippingTicket}` : "Sin ticket de envío"}</small><GrLinkCell link={request.outboundGuideLink} /><span className="evidence-links">{request.outboundGuidePhoto && <a href={request.outboundGuidePhoto} target="_blank" rel="noreferrer">Foto GR</a>}{request.shippingTicketPhoto && <a href={request.shippingTicketPhoto} target="_blank" rel="noreferrer">Foto ticket</a>}</span></td><td><strong>{request.sentDate ? displayDate(request.sentDate) : "Sin fecha de envío"}</strong><small>{request.arrivalDate ? `Llegó: ${displayDate(request.arrivalDate)}` : "Llegada pendiente"}</small></td><td><span className={`pending-days ${!closed && days > 7 ? "danger" : !closed && days >= 3 ? "warning" : "ok"}`}>{closed ? "Cerrada" : `${days} días`}</span><small>{request.pickupDate ? `Recogido: ${displayDate(request.pickupDate)}` : "Pendiente de recojo"}</small></td><td><span className={`request-status ${request.status.toLowerCase()}`}>{request.status.replaceAll("_", " ")}</span></td><td><button className="secondary-button trace-button" disabled={!canOperate} onClick={() => setTracking(request)}><ClipboardList size={14} />Actualizar</button></td></tr>; })}</tbody></table></div>
    </section>
    {tracking && <RequestTrackingModal request={tracking} saving={saving} onClose={() => setTracking(null)} onSave={async (payload) => { const ok = await onSave(payload, "Seguimiento logístico actualizado."); if (ok) setTracking(null); }} />}
  </>;
}

async function compressEvidencePhoto(file: File) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Usa una foto JPG, PNG o WEBP.");
  if (file.size > 8_000_000) throw new Error("La foto original supera 8 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("No se pudo procesar la foto."));
    element.src = source;
  });
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  const compressed = canvas.toDataURL("image/jpeg", 0.78);
  if (compressed.length > 2_500_000) throw new Error("La foto sigue siendo muy pesada. Toma otra con menor resolución.");
  return compressed;
}

function RequestTrackingModal({ request, saving, onClose, onSave }: { request: EquipmentRequest; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [outboundGuidePhoto, setOutboundGuidePhoto] = useState(request.outboundGuidePhotoStored || request.outboundGuidePhoto || "");
  const [shippingTicketPhoto, setShippingTicketPhoto] = useState(request.shippingTicketPhotoStored || request.shippingTicketPhoto || "");
  const [photoError, setPhotoError] = useState("");
  const [compressing, setCompressing] = useState(false);
  const outboundGuidePhotoPreview = outboundGuidePhoto.startsWith("supabase://") ? request.outboundGuidePhoto : outboundGuidePhoto;
  const shippingTicketPhotoPreview = shippingTicketPhoto.startsWith("supabase://") ? request.shippingTicketPhoto : shippingTicketPhoto;

  async function loadPhoto(file: File | undefined, setter: (value: string) => void) {
    if (!file) return;
    setPhotoError("");
    setCompressing(true);
    try {
      setter(await compressEvidencePhoto(file));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "No se pudo procesar la foto.");
    } finally {
      setCompressing(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({ ...Object.fromEntries(new FormData(event.currentTarget).entries()), outboundGuidePhoto, shippingTicketPhoto });
  }
  return <div className="modal-layer"><div className="modal-card modal-small"><div className="modal-head"><div><span className="modal-kicker">SEGUIMIENTO LOGÍSTICO</span><h2>{request.requestCode}</h2><p>Estos datos no modifican stock ni crean movimientos.</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><input type="hidden" name="action" value="requestLogistics" /><input type="hidden" name="requestCode" value={request.requestCode} /><div className="form-grid"><label className="field"><span>Estado *</span><select name="status" defaultValue={request.status}><option>PENDIENTE</option><option>VALIDADA</option><option>DESPACHADA</option><option>EN_TRANSITO</option><option>LISTA_RECOJO</option><option>RECOGIDA</option><option>CERRADA</option><option>RECHAZADA</option></select></label><label className="field"><span>Nro. GR de salida</span><input name="outboundGuide" defaultValue={request.outboundGuide} /></label><label className="field field-wide"><span>Link GR de salida</span><input name="outboundGuideLink" defaultValue={request.outboundGuideLink} placeholder="Vínculo SharePoint o nombre del archivo" /></label><label className="field"><span>Foto de la GR de despacho</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void loadPhoto(event.target.files?.[0], setOutboundGuidePhoto)} /><small>{outboundGuidePhoto ? "Foto lista y comprimida." : "JPG, PNG o WEBP."}</small>{outboundGuidePhotoPreview && <span className="photo-actions"><a href={outboundGuidePhotoPreview} target="_blank" rel="noreferrer">Ver foto</a><button type="button" onClick={() => setOutboundGuidePhoto("")}>Quitar</button></span>}</label><label className="field"><span>Ticket de envío</span><input name="shippingTicket" defaultValue={request.shippingTicket} /></label><label className="field"><span>Foto del ticket de envío</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void loadPhoto(event.target.files?.[0], setShippingTicketPhoto)} /><small>{shippingTicketPhoto ? "Foto lista y comprimida." : "JPG, PNG o WEBP."}</small>{shippingTicketPhotoPreview && <span className="photo-actions"><a href={shippingTicketPhotoPreview} target="_blank" rel="noreferrer">Ver foto</a><button type="button" onClick={() => setShippingTicketPhoto("")}>Quitar</button></span>}</label><label className="field"><span>Clave</span><input name="shippingKey" defaultValue={request.shippingKey} /></label><label className="field"><span>Fecha de envío</span><input name="sentDate" type="date" defaultValue={request.sentDate} /></label><label className="field"><span>Fecha de llegada</span><input name="arrivalDate" type="date" defaultValue={request.arrivalDate} /></label><label className="field"><span>Fecha de recojo</span><input name="pickupDate" type="date" defaultValue={request.pickupDate} /></label><label className="field field-wide"><span>Notas de seguimiento</span><textarea name="logisticsNotes" rows={3} defaultValue={request.logisticsNotes} placeholder="Incidencias, contacto, recordatorio..." /></label></div>{photoError && <div className="inline-error">{photoError}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || compressing}>{compressing ? "Procesando fotos..." : saving ? "Guardando..." : "Guardar seguimiento"}</button></div></form></div></div>;
}

function SettingsView({ data, saving, onSave }: { data: KardexData; saving: boolean; onSave: (payload: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [scope, setScope] = useState<"operations" | "all">("operations");
  const [confirmation, setConfirmation] = useState("");
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const phrase = scope === "all" ? "BORRAR TODO" : "LIMPIAR PRUEBAS";

  async function downloadBackup() {
    const response = await fetch("/api/kardex?backup=1", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo generar el respaldo.");
    const backup = await response.json() as Record<string, Array<Record<string, unknown>>>;
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheets: Array<[string, string]> = [["products", "Maestro SKU"], ["movements", "Movimientos"], ["sourceRecords", "Fuentes externas"], ["coordinators", "Coordinadores"], ["suppliers", "Proveedores"], ["installationValidations", "Conciliaciones"], ["auditImports", "Cortes auditoría"], ["auditRecords", "Detalle auditoría"], ["equipmentRequests", "Solicitudes"]];
    sheets.forEach(([key, name]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(backup[key] ?? []), name));
    XLSX.writeFile(workbook, `respaldo-kardex-f1-${today()}.xlsx`, { compression: true });
    setBackupDownloaded(true);
  }

  async function cleanup() {
    const ok = await onSave({ action: "cleanup", scope, confirmation }, scope === "all" ? "Reinicio total completado." : "Datos de prueba eliminados; maestros, proveedores y coordinadores conservados.");
    if (ok) { setConfirmation(""); setBackupDownloaded(false); }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const ok = await onSave({ ...values, action: "appUser", active: true }, "Usuario y permisos guardados.");
    if (ok) form.reset();
  }

  return <section className="settings-grid">
    <article className="panel backup-card"><span><Download size={23} /></span><div><small>RESPALDO · OPCIONAL Y RECOMENDADO</small><h2>Descargar respaldo completo</h2><p>Genera un Excel con maestro, movimientos, conciliaciones, auditorías, proveedores, coordinadores y solicitudes antes de limpiar.</p><button className="secondary-button" onClick={() => void downloadBackup()}><Download size={16} />{backupDownloaded ? "Respaldo descargado" : "Descargar respaldo Excel"}</button></div></article>
    <article className="panel cleanup-card"><div className="cleanup-head"><span><ShieldCheck size={23} /></span><div><small>PASO 2 · LIMPIEZA PROTEGIDA</small><h2>Preparar la carga real</h2><p>Selecciona exactamente qué deseas borrar.</p></div></div>
      <div className="cleanup-options"><label className={scope === "operations" ? "selected" : ""}><input type="radio" checked={scope === "operations"} onChange={() => { setScope("operations"); setConfirmation(""); }} /><strong>Limpiar operaciones de prueba</strong><span>Borra movimientos, conciliaciones, auditorías y solicitudes. Conserva maestro SKU y coordinadores.</span></label><label className={scope === "all" ? "selected danger" : "danger"}><input type="radio" checked={scope === "all"} onChange={() => { setScope("all"); setConfirmation(""); }} /><strong>Reinicio total</strong><span>También borra el maestro SKU y los coordinadores. El sistema quedará completamente vacío.</span></label></div>
      <div className="cleanup-confirm"><label className="field"><span>Escribe <b>{phrase}</b> para confirmar</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={phrase} /></label><button className="danger-button cleanup-action" disabled={saving || confirmation.trim().toUpperCase() !== phrase} onClick={() => void cleanup()}>{saving ? "Limpiando..." : "Ejecutar limpieza"}</button></div>
      <p className="cleanup-note">Estado actual: {number.format(data.movements.length)} movimientos · {number.format(data.installationValidations.length)} conciliaciones · {number.format(data.auditImports.length)} cortes · {number.format(data.equipmentRequests.length)} solicitudes.</p>
    </article>
    <article className="panel access-card"><div className="panel-title"><div><h2>Usuarios y permisos</h2><p>Crea o actualiza usuarios corporativos @f1.services. Al registrar uno nuevo se envía una invitación segura para que defina su acceso.</p></div><ShieldCheck size={21} /></div><form className="access-form" onSubmit={saveUser}><label className="field"><span>Nombre</span><input name="displayName" placeholder="Nombre del colaborador" /></label><label className="field"><span>Correo corporativo *</span><input name="email" type="email" autoComplete="email" required placeholder="nombre@f1.services" pattern=".+@f1\\.services" /></label><label className="field"><span>Rol *</span><select name="role" defaultValue="SOLO_LECTURA"><option value="ADMINISTRADOR">Administrador</option><option value="LOGISTICA">Logística</option><option value="COORDINADOR">Coordinador</option><option value="SOLO_LECTURA">Solo lectura</option></select></label><button className="primary-button" type="submit" disabled={saving}><Plus size={15} />Invitar usuario</button></form><div className="role-guide"><span><b>Administrador</b> configura usuarios y limpia datos.</span><span><b>Logística</b> registra y carga operaciones.</span><span><b>Coordinador</b> crea solicitudes.</span><span><b>Solo lectura</b> consulta sin editar.</span></div><div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo de acceso</th><th>Rol</th><th>Estado</th><th>Invitación</th></tr></thead><tbody>{!data.appUsers.length ? <tr><td colSpan={5}><Empty text="Agrega el correo @f1.services de cada integrante para enviarle su invitación." /></td></tr> : data.appUsers.map((appUser) => <tr key={appUser.id}><td><strong>{appUser.displayName || "Sin nombre"}</strong></td><td>{appUser.email}</td><td><select value={appUser.role} disabled={saving} onChange={(event) => void onSave({ action: "appUser", email: appUser.email, displayName: appUser.displayName, role: event.target.value, active: appUser.active }, "Rol actualizado.")}><option value="ADMINISTRADOR">Administrador</option><option value="LOGISTICA">Logística</option><option value="COORDINADOR">Coordinador</option><option value="SOLO_LECTURA">Solo lectura</option></select></td><td><select value={appUser.active ? "ACTIVO" : "INACTIVO"} disabled={saving} onChange={(event) => void onSave({ action: "appUser", email: appUser.email, displayName: appUser.displayName, role: appUser.role, active: event.target.value === "ACTIVO" }, "Estado del usuario actualizado.")}><option>ACTIVO</option><option>INACTIVO</option></select></td><td><small>{appUser.invitationStatus || (appUser.invitedAt ? "ENVIADA" : "PENDIENTE")}</small></td></tr>)}</tbody></table></div></article>
  </section>;
}

function CoordinatorView({ coordinators, loading, saving, onSave }: { coordinators: Coordinator[]; loading: boolean; saving: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [fileStatus, setFileStatus] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await onSave(Object.fromEntries(new FormData(form).entries()));
    if (ok) form.reset();
  }

  async function upload(file?: File) {
    if (!file) return;
    setFileStatus("Leyendo archivo...");
    try {
      const rows = await readTabularFile(file);
      if (!rows.length) throw new Error("El archivo no contiene coordinadores.");
      const ok = await onSave({ action: "coordinatorBulk", rows });
      setFileStatus(ok ? `${rows.length} filas procesadas.` : "No se pudo completar la carga.");
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    }
  }

  return <div className="coordinator-layout">
    <section className="panel coordinator-form-panel">
      <div className="panel-title"><div><h2>Agregar coordinador</h2><p>Si el nombre ya existe, se actualizará su correo.</p></div></div>
      <form onSubmit={submit}>
        <input type="hidden" name="action" value="coordinator" />
        <label className="field"><span>Empresa *</span><select name="organization" defaultValue="ENTEL"><option value="ENTEL">Entel</option><option value="F1">F1 Services</option></select></label>
        <label className="field"><span>Nombre completo *</span><input name="name" required placeholder="Ej. JOSE ARROYO" /></label>
        <label className="field"><span>Correo</span><input name="email" type="email" placeholder="coordinador@empresa.com" /></label>
        <button className="primary-button" type="submit" disabled={saving}><Plus size={16} />{saving ? "Guardando..." : "Guardar coordinador"}</button>
      </form>
      <div className="bulk-master-box"><strong>Recuperar lista anterior</strong><p>Carga un Excel o CSV con Empresa, Nombre, Correo y Estado.</p><label className="secondary-button"><Upload size={15} />Seleccionar archivo<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(event) => void upload(event.target.files?.[0])} /></label><button type="button" className="secondary-button" onClick={() => void downloadTableTemplate("plantilla_coordinadores_f1.xlsx", "Coordinadores", { Empresa: "F1", Nombre: "NOMBRE DEL COORDINADOR", Correo: "nombre@f1.services", Estado: "ACTIVO" })}><Download size={15} />Descargar plantilla</button>{fileStatus && <small>{fileStatus}</small>}</div>
    </section>
    <section className="panel table-panel coordinator-table-panel">
      <div className="panel-title"><div><h2>Tabla de coordinadores</h2><p>{coordinators.length} responsables disponibles para ingresos, salidas y correos.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Coordinador</th><th>Correo</th><th>Estado manual</th></tr></thead><tbody>{loading ? <tr><td colSpan={4}><Empty text="Cargando coordinadores..." /></td></tr> : !coordinators.length ? <tr><td colSpan={4}><Empty text="Agrega los coordinadores F1 y Entel que usarás en el Kardex." /></td></tr> : coordinators.map((coordinator) => <tr key={coordinator.id}><td><span className="source-badge">{coordinator.organization}</span></td><td><strong>{coordinator.name}</strong></td><td>{coordinator.email || "Sin correo"}</td><td><select className={`coordinator-status ${coordinator.active ? "active" : "inactive"}`} value={coordinator.active ? "ACTIVO" : "INACTIVO"} disabled={saving} onChange={(event) => void onSave({ action: "coordinatorStatus", coordinatorId: coordinator.id, active: event.target.value === "ACTIVO" })}><option>ACTIVO</option><option>INACTIVO</option></select></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function SupplierView({ suppliers, loading, saving, onSave }: { suppliers: Supplier[]; loading: boolean; saving: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const [fileStatus, setFileStatus] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await onSave({ action: "supplier", ...Object.fromEntries(new FormData(form).entries()), active: true });
    if (ok) form.reset();
  }

  async function upload(file?: File) {
    if (!file) return;
    setFileStatus("Leyendo archivo...");
    try {
      const rows = await readTabularFile(file);
      if (!rows.length) throw new Error("El archivo no contiene proveedores.");
      const ok = await onSave({ action: "supplierBulk", rows });
      setFileStatus(ok ? `${rows.length} filas procesadas.` : "No se pudo completar la carga.");
    } catch (error) {
      setFileStatus(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    }
  }

  return <div className="coordinator-layout">
    <section className="panel coordinator-form-panel">
      <div className="panel-title"><div><h2>Empresa o persona</h2><p>Registra una vez el RUC de la empresa o el DNI de la persona; después el nombre se completa automáticamente.</p></div></div>
      <form onSubmit={submit}>
        <input type="hidden" name="source" value="MANUAL" />
        <label className="field"><span>Tipo de documento *</span><select name="documentType" defaultValue="RUC"><option value="RUC">RUC</option><option value="DNI">DNI</option></select></label>
        <label className="field"><span>RUC o DNI *</span><input name="documentNumber" required inputMode="numeric" pattern="[0-9]{8}|[0-9]{11}" placeholder="8 u 11 dígitos" /></label>
        <label className="field"><span>Razón social / nombre completo *</span><input name="businessName" required placeholder="Nombre legal o nombre completo" /></label>
        <label className="field"><span>Nombre comercial</span><input name="tradeName" placeholder="Opcional" /></label>
        <button className="primary-button" type="submit" disabled={saving}><Plus size={16} />Guardar registro</button>
      </form>
      <div className="bulk-master-box"><strong>Carga masiva</strong><p>Columnas: RUC/DNI, Razón Social o Nombre Completo, y Nombre Comercial opcional.</p><label className="secondary-button"><Upload size={15} />Seleccionar Excel o CSV<input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(event) => void upload(event.target.files?.[0])} /></label><button type="button" className="secondary-button" onClick={() => void downloadTableTemplate("plantilla_empresas_personas_f1.xlsx", "Empresas y Personas", { "RUC/DNI": "20123456789", "Razón Social o Nombre Completo": "CONTRATA EJEMPLO S.A.C.", "Nombre Comercial": "CONTRATA EJEMPLO" })}><Download size={15} />Descargar plantilla</button>{fileStatus && <small>{fileStatus}</small>}</div>
    </section>
    <section className="panel table-panel coordinator-table-panel">
      <div className="panel-title"><div><h2>Maestro de empresas y personas</h2><p>{suppliers.length} registros disponibles. SUNAT podrá activarse para validar RUC cuando se configuren credenciales oficiales.</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>Documento</th><th>Razón social</th><th>Nombre comercial</th><th>Fuente</th><th>Estado</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}><Empty text="Cargando proveedores..." /></td></tr> : !suppliers.length ? <tr><td colSpan={5}><Empty text="Carga tu base de proveedores o registra el primer RUC/DNI." /></td></tr> : suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.documentNumber}</strong><small>{supplier.documentType}</small></td><td><strong>{supplier.businessName}</strong></td><td>{supplier.tradeName || "—"}</td><td>{supplier.source}</td><td><span className={`source-badge ${supplier.active ? "" : "inactive"}`}>{supplier.active ? "ACTIVO" : "INACTIVO"}</span></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function ReportsView({ products, movements, requests }: { products: Product[]; movements: Movement[]; requests: EquipmentRequest[] }) {
  const reportRows = useMemo(() => movements.map((movement) => ({
    Fecha: movement.movementDate,
    Tipo: movement.type.toUpperCase(),
    SKU: movement.sku,
    Descripción: movement.description,
    "Serie/Lote": movement.serials,
    Cantidad: movement.quantity,
    Unidad: movement.unitMeasure || movement.unit,
    "Costo unitario": (movement.unitCostCents || movement.productUnitCostCents || 0) / 100,
    "Costo total": ((movement.unitCostCents || movement.productUnitCostCents || 0) * movement.quantity) / 100,
    "N° Pedido": movement.orderNumber,
    GR: movement.document,
    "RUC/DNI": movement.contractorDocument,
    "Razón social": movement.contractor,
    "Coordinador Entel": movement.coordinator,
    "Coordinador F1": movement.coordinatorF1,
    Proyecto: movement.project,
    Site: movement.destinationSite || movement.originSite,
    Región: movement.region,
    Provincia: movement.province,
  })), [movements]);
  const grouped = useMemo(() => {
    const map = new Map<string, { lines: number; quantity: number; cost: number }>();
    movements.forEach((movement) => {
      const key = movement.coordinatorF1 || "SIN COORDINADOR F1";
      const current = map.get(key) ?? { lines: 0, quantity: 0, cost: 0 };
      current.lines += 1;
      current.quantity += movement.quantity;
      current.cost += (movement.unitCostCents || movement.productUnitCostCents || 0) * movement.quantity;
      map.set(key, current);
    });
    return [...map].sort((a, b) => b[1].cost - a[1].cost);
  }, [movements]);

  async function exportReport() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(reportRows), "Movimientos");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(products), "Stock actual");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(requests), "Solicitudes");
    XLSX.writeFile(workbook, `reporte-kardex-f1-${today()}.xlsx`, { compression: true });
  }

  const entries = movements.filter((movement) => movement.type === "entrada");
  const exits = movements.filter((movement) => movement.type === "salida");
  const value = exits.reduce((sum, movement) => sum + (movement.unitCostCents || movement.productUnitCostCents || 0) * movement.quantity, 0);
  return <>
    <section className="request-alert-strip"><article><small>INGRESOS</small><strong>{number.format(entries.length)}</strong><span>Líneas registradas</span></article><article><small>SALIDAS</small><strong>{number.format(exits.length)}</strong><span>Líneas despachadas</span></article><article><small>COSTO DESPACHADO</small><strong>{money.format(value / 100)}</strong><span>Según el filtro actual</span></article></section>
    <section className="panel table-panel"><div className="panel-title"><div><h2>Despacho valorizado por Coordinador F1</h2><p>El buscador superior filtra el detalle antes de exportar.</p></div><button className="primary-button" onClick={() => void exportReport()}><Download size={16} />Descargar Excel completo</button></div><div className="table-wrap"><table><thead><tr><th>Coordinador F1</th><th>Líneas</th><th>Cantidad</th><th className="align-right">Costo total</th></tr></thead><tbody>{!grouped.length ? <tr><td colSpan={4}><Empty text="Los reportes se habilitan al registrar movimientos." /></td></tr> : grouped.map(([name, summary]) => <tr key={name}><td><strong>{name}</strong></td><td>{number.format(summary.lines)}</td><td>{number.format(summary.quantity)}</td><td className="align-right"><strong>{money.format(summary.cost / 100)}</strong></td></tr>)}</tbody></table></div></section>
  </>;
}

function BulkUpload({ products, movements, suppliers, saving, onSave }: { products: Product[]; movements: Movement[]; suppliers: Supplier[]; saving: boolean; onSave: (payload: Record<string, unknown>) => Promise<boolean> }) {
  const source = "F1";
  const [movementType, setMovementType] = useState<"entrada" | "salida" | "maestro">("entrada");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [fileError, setFileError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);

  const detectedGroups = useMemo(() => {
    const keys = new Set(rows.map((row) => `${bulkRowValue(row, "N° Pedido").toUpperCase()}::${bulkRowValue(row, "Coordinador Entel", "CordEntelFinal").toUpperCase()}`));
    keys.delete("::");
    return keys.size;
  }, [rows]);

  const previewRows = useMemo(() => {
    const productsBySku = new Map(products.map((product) => [product.sku.toUpperCase(), product]));
    const availableByGroup = new Map<string, number>();
    const seriesByGroup = new Map<string, Map<string, number>>();

    return rows.map((row, index) => {
      const sku = bulkRowValue(row, "Sku", "SKU").toUpperCase();
      const description = bulkRowValue(row, "Descripción Sku", "Descripción");
      const equipmentType = bulkRowValue(row, "Tipo de Equipo", "Categoría");
      const orderNumber = bulkRowValue(row, "N° Pedido", "Pedido");
      const coordinator = bulkRowValue(row, "Coordinador Entel", "CordEntelFinal");
      const coordinatorF1 = bulkRowValue(row, "Coordinador F1", "CordF1");
      const contractorDocument = bulkRowValue(row, "RUC", "RUC/DNI", "Documento").replace(/\D/g, "");
      const supplier = suppliers.find((item) => item.active && item.documentNumber === contractorDocument);
      let serials = bulkRowValue(row, "Serie/Lote", "Serie").toUpperCase();
      const document = bulkRowValue(row, movementType === "entrada" ? "GR. de Ingreso" : "NroGRSalida", "GR. de Salida").toUpperCase();
      const sourceRow = bulkRowValue(row, "ITEM", "Fila").toUpperCase();
      const requestedLotMode = bulkRowValue(row, "Modo de Lote", "Modo Lote", "Asignación de Lote", "Asignacion de Lote").toUpperCase();
      const movementDate = normalizeKardexDate(bulkRowValue(row, movementType === "entrada" ? "Fecha de Ingreso" : "Fecha Salida", "Fecha de Salida", "Fecha"), today());
      const quantity = Math.max(1, bulkNumberValue(row, "Cantidad") || 1);
      const product = productsBySku.get(sku);
      const rowUnitCostCents = Math.max(0, Math.round(bulkNumberValue(row, "Costo") * 100));
      const unitCostCents = rowUnitCostCents || product?.unitCostCents || 0;
      const rowNumber = bulkRowValue(row, "ITEM", "Fila") || String(index + 2);
      let reason = "";
      let autoLotGenerated = false;

      if (movementType === "entrada" && !serials && requestedLotMode.includes("MANUAL")) {
        reason = "Elegiste lote manual, pero falta Serie/Lote.";
      } else if (movementType === "entrada" && !serials && requestedLotMode.includes("AUTO")) {
        serials = automaticPreviewLotCode({ movementDate, orderNumber, sku, sourceRow: sourceRow || rowNumber });
        autoLotGenerated = true;
      }

      if (!reason && !sku) reason = "Falta el SKU.";
      else if (movementType === "maestro" && !description) reason = "Falta la descripción del SKU.";
      else if (movementType === "maestro" && !equipmentType) reason = "Falta el tipo de equipo.";
      else if (movementType !== "maestro" && !document) reason = "Falta la GR de ingreso o salida.";
      else if (movementType !== "maestro" && (!orderNumber || !coordinator)) reason = "Faltan N° Pedido o Coordinador Entel.";
      else if ((movementType === "entrada" || movementType === "salida") && !coordinatorF1) reason = "Falta Coordinador F1.";
      else if (movementType === "entrada" && (!/^\d{11}$/.test(contractorDocument) || supplier?.documentType !== "RUC")) reason = "El RUC de la empresa de origen no existe o está inactivo en el maestro.";
      else if (movementType === "salida" && (!/^(\d{8}|\d{11})$/.test(contractorDocument) || !supplier)) reason = "El RUC/DNI de destino no existe o está inactivo en el maestro.";

      if (!reason && movementType === "maestro" && product
        && product.description.trim().toUpperCase() === description.trim().toUpperCase()
        && product.category.trim().toUpperCase() === equipmentType.trim().toUpperCase()) {
        reason = "Este SKU ya está cargado y no tiene cambios.";
      }

      if (!reason && movementType !== "maestro" && product) {
        const party = contractorDocument.trim().toUpperCase();
        const duplicate = movements.some((movement) => movement.type === movementType
          && movement.document.trim().toUpperCase() === document
          && movement.orderNumber.trim().toUpperCase() === orderNumber.trim().toUpperCase()
          && movement.contractorDocument.trim().toUpperCase() === party);
        if (duplicate) reason = "La misma GR y pedido ya fueron cargados para esta razón social.";
      }

      if (!reason && movementType === "entrada" && product && serials) {
        const duplicate = movementSeries(serials).find((serial) => movements
          .filter((movement) => movement.productId === product.id)
          .reduce((balance, movement) => balance + movementEffect(movement.type) * seriesQuantity(movement.serials, movement.quantity, serial), 0) > 0);
        if (duplicate) reason = `Serie ya disponible: ${duplicate}.`;
      }

      if (!reason && movementType === "salida") {
        if (!product) {
          reason = "El SKU no existe en el maestro.";
        } else {
          const groupKey = `${product.id}::${orderNumber.trim().toUpperCase()}::${coordinator.trim().toUpperCase()}`;
          const controlled = movements.filter((movement) => movement.productId === product.id
            && movement.orderNumber.trim().toUpperCase() === orderNumber.trim().toUpperCase()
            && movement.coordinator.trim().toUpperCase() === coordinator.trim().toUpperCase());
          if (!availableByGroup.has(groupKey)) {
            availableByGroup.set(groupKey, controlled.reduce((balance, movement) => balance + movementEffect(movement.type) * movement.quantity, 0));
            const balances = new Map<string, number>();
            controlled.forEach((movement) => movementSeries(movement.serials).forEach((serial) => balances.set(serial, (balances.get(serial) ?? 0) + movementEffect(movement.type) * seriesQuantity(movement.serials, movement.quantity, serial))));
            seriesByGroup.set(groupKey, balances);
          }
          const available = availableByGroup.get(groupKey) ?? 0;
          if (quantity > available) {
            reason = `Stock insuficiente. Disponible: ${available}.`;
          } else if (serials) {
            const requested = movementSeries(serials);
            const balances = seriesByGroup.get(groupKey) ?? new Map<string, number>();
            const unavailable = requested.find((serial) => (balances.get(serial) ?? 0) < (requested.length > 1 ? 1 : quantity));
            if (unavailable) reason = `Serie/Lote no disponible: ${unavailable}.`;
          }
          if (!reason) {
            availableByGroup.set(groupKey, available - quantity);
            const requested = movementSeries(serials);
            const balances = seriesByGroup.get(groupKey);
            requested.forEach((serial) => balances?.set(serial, (balances.get(serial) ?? 0) - (requested.length > 1 ? 1 : quantity)));
          }
        }
      }

      return {
        row,
        rowNumber,
        sku: sku || "—",
        masterName: movementType === "maestro" ? description || "—" : product?.description || description || "—",
        masterType: movementType === "maestro" ? equipmentType || "—" : product?.category || equipmentType || "—",
        orderNumber: orderNumber || "—",
        coordinator: coordinator || "—",
        serials: serials || "SIN SERIE",
        quantity,
        totalCostCents: movementType === "maestro" ? 0 : unitCostCents * quantity,
        accepted: !reason,
        reason: reason || (autoLotGenerated ? "Lote automático de transferencia; se generará al confirmar." : "Lista para cargar"),
      };
    });
  }, [movements, movementType, products, rows, suppliers]);

  const acceptedPreviewRows = previewRows.filter((row) => row.accepted);
  const rejectedPreviewRows = previewRows.filter((row) => !row.accepted);
  const previewCostCents = acceptedPreviewRows.reduce((sum, row) => sum + row.totalCostCents, 0);

  function clearFile() {
    setFileName("");
    setRows([]);
    setFileError("");
    setDragActive(false);
    setLoadComplete(false);
  }

  function parseCsv(text: string) {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) return [];
    const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const parseLine = (line: string) => {
      const values: string[] = [];
      let value = "";
      let quoted = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"') { value += '"'; index += 1; }
        else if (char === '"') quoted = !quoted;
        else if (char === delimiter && !quoted) { values.push(value.trim()); value = ""; }
        else value += char;
      }
      values.push(value.trim());
      return values;
    };
    const headers = parseLine(lines[0]);
    return lines.slice(1, 501).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] || `columna_${index + 1}`, value])));
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    clearFile();
    setFileName(file.name);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let parsed: Array<Record<string, unknown>> = [];
      if (extension === "xlsx" || extension === "xls") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: true }).slice(0, 500) as Array<Record<string, unknown>>;
        const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: true }) as unknown[][];
        const headers = (matrix[0] ?? []).map((value) => String(value ?? "").trim());
        parsed = rawRows.map((row, rowIndex) => {
          const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? normalizeKardexDate(value) : value]));
          headers.forEach((header, columnIndex) => {
            const normalizedHeader = header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            if (!normalizedHeader.includes("link") || !normalizedHeader.includes("gr")) return;
            const cell = firstSheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex })] as { l?: { Target?: string }; f?: string } | undefined;
            const formulaLink = cell?.f?.match(/HYPERLINK\("([^"]+)"/i)?.[1];
            const target = cell?.l?.Target || formulaLink;
            if (target) normalized[header] = target;
          });
          return normalized;
        });
      } else if (extension === "csv") {
        parsed = parseCsv(await file.text());
      } else {
        throw new Error("Formato no admitido. Usa Excel (.xlsx o .xls) o CSV.");
      }
      if (!parsed.length) throw new Error("El archivo no contiene registros debajo de los encabezados.");
      const first = parsed[0];
      const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
      const availableHeaders = new Set(Object.keys(first).map(normalize));
      if (!availableHeaders.has(normalize("Sku"))) throw new Error("No se encontró la columna Sku en la primera hoja.");
      if (source === "F1" && movementType === "entrada") {
        const requiredHeaders = ["Fila", "Sku", "Descripción Sku", "Estado de Equipo", "Condición", "Proyecto", "RUC", "Fecha de Ingreso", "GR. de Ingreso", "N° Pedido", "Coordinador Entel", "Coordinador F1", "Site Origen", "Serie/Lote", "Unidad de Medida", "Cantidad", "Tipo de Equipo", "Cargar Gr"];
        const missing = requiredHeaders.filter((header) => !availableHeaders.has(normalize(header)));
        if (!availableHeaders.has(normalize("Link de GR")) && !availableHeaders.has(normalize("Link de GR. de Ingreso"))) missing.push("Link de GR. de Ingreso");
        if (missing.length) throw new Error(`Faltan columnas de ingreso: ${missing.join(", ")}.`);
      }
      if (source === "F1" && movementType === "salida") {
        const requiredHeaders = [...SALIDA_BULK_HEADERS];
        const missing = requiredHeaders.filter((header) => !availableHeaders.has(normalize(header)));
        if (missing.length) throw new Error(`Tu archivo de salidas no coincide con la plantilla. Faltan: ${missing.join(", ")}.`);
      }
      if (movementType === "maestro") {
        const requiredHeaders = ["Sku", "Descripción Sku", "Tipo de Equipo"];
        const missing = requiredHeaders.filter((header) => !availableHeaders.has(normalize(header)));
        if (missing.length) throw new Error(`Faltan columnas del maestro SKU: ${missing.join(", ")}.`);
      }
      if (source === "F1" && movementType === "entrada") {
        const seriesCounts = new Map<string, { count: number; series: string }>();
        parsed.forEach((row) => {
          const sku = bulkRowValue(row, "Sku").toUpperCase();
          const series = bulkRowValue(row, "Serie/Lote").toUpperCase();
          const quantity = Number(bulkRowValue(row, "Cantidad").replace(",", ".")) || 0;
          const equipmentType = bulkRowValue(row, "Tipo de Equipo").toUpperCase();
          if (!sku || !series || quantity !== 1 || !equipmentType.includes("EQUIPO")) return;
          const key = `${sku}::${series}`;
          const current = seriesCounts.get(key) ?? { count: 0, series };
          current.count += 1;
          seriesCounts.set(key, current);
        });
        const duplicated = [...seriesCounts.values()].filter((item) => item.count > 1);
        if (duplicated.length) {
          const extraRows = duplicated.reduce((sum, item) => sum + item.count - 1, 0);
          const examples = duplicated.slice(0, 3).map((item) => item.series).join(", ");
          throw new Error(`Carga bloqueada: ${duplicated.length} series están repetidas en ${extraRows} filas adicionales. Ejemplos: ${examples}. Corrige el Excel antes de cargarlo.`);
        }
      }
      setRows(parsed);
    } catch (error) {
      setRows([]);
      setFileError(error instanceof Error ? error.message : "No se pudo leer el archivo.");
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const row = movementType === "entrada" ? {
      Fila: 1, Sku: "ENT960000001", "Descripción Sku": "EQUIPO DE EJEMPLO", "Estado de Equipo": "NUEVO", Condición: "OPERATIVO", Proyecto: "ENTEL", RUC: "20123456789", "Fecha de Ingreso": today(), "GR. de Ingreso": "GR-ING-001", "Link de GR. de Ingreso": "https://ejemplo.com/gr-ingreso.pdf", "N° Pedido": "PED-001", "Coordinador Entel": "COORDINADOR ENTEL", "Coordinador F1": "COORDINADOR F1", "Site Origen": "MO COMPANY", Ubicación: "MO COMPANY", "Serie/Lote": "SERIE001", "Modo de Lote": "MANUAL", "Unidad de Medida": "UND", Cantidad: 1, Costo: 100, "Tipo de Equipo": "EQUIPO", "Cargar Gr": "SI",
    } : movementType === "salida" ? {
      ITEM: 1,
      "Fecha Salida": today(),
      Sku: "ENT960000001",
      "Descripción Sku": "EQUIPO DE EJEMPLO",
      NroGRSalida: "GR-SAL-001",
      "Link de GR": "https://ejemplo.com/gr-salida.pdf",
      CordEntelFinal: "COORDINADOR ENTEL",
      SiteDestino: "SITE-001",
      Region: "LIMA",
      Provincia: "LIMA",
      ProyectoFinal: "ENTEL",
      CordF1: "COORDINADOR F1",
      "RUC/DNI": "20123456789",
      Consignatario: "RESPONSABLE DE RECEPCIÓN",
      "Serie/Lote": "SERIE001",
      Cantidad: 1,
      UnidadMedida: "UND",
      "Tipo de Equipo": "EQUIPO",
      "N° Pedido": "PED-001",
      CorreoSolicitante: "solicitante@empresa.com",
      "Estado Correo": "PENDIENTE",
      IDDespacho: "DESP-001",
      EstadoCorreo: "PENDIENTE",
      FechaEnvioCorreo: "",
      "Persona que Registra": "USUARIO F1",
      "Cargar GR": "SI",
    } : {
      Sku: "ENT960000001", "Descripción Sku": "EQUIPO DE EJEMPLO", "Tipo de Equipo": "EQUIPO",
    };
    const sheet = XLSX.utils.json_to_sheet([row]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, movementType === "entrada" ? "Ingresos" : movementType === "salida" ? "Salidas" : "Maestro SKU");
    XLSX.writeFile(workbook, movementType === "maestro" ? "plantilla_maestro_sku_f1.xlsx" : `plantilla_carga_${movementType}s_f1.xlsx`);
  }

  function dragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }

  function dragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    void chooseFile(event.dataTransfer.files?.[0]);
  }

  async function submitBulk() {
    if (loadComplete || !acceptedPreviewRows.length) return;
    const ok = await onSave({ action: "bulk", source, movementType, rows: acceptedPreviewRows.map((item) => item.row) });
    if (ok) setLoadComplete(true);
  }

  const operationLabel = movementType === "entrada" ? "ingresos" : movementType === "salida" ? "salidas" : "maestro SKU";
  return <section className="upload-layout">
    <div className="panel upload-panel">
      <div className="upload-heading"><span><FileSpreadsheet size={24} /></span><div><h2>Carga masiva F1</h2><p>Archivos Excel (.xlsx, .xls) o CSV · máximo 500 registros.</p></div></div>
      <div className="bulk-step"><span>1</span><div><strong>Selecciona qué vas a cargar</strong><small>El maestro crea SKU; ingresos suman stock y salidas lo descuentan.</small></div></div>
      <div className="bulk-operation-selector three-options">
        <button className={movementType === "maestro" ? "active master" : ""} onClick={() => { setMovementType("maestro"); clearFile(); }}><Boxes size={21} /><span><strong>Maestro de SKU</strong><small>Crea o actualiza productos</small></span></button>
        <button className={movementType === "entrada" ? "active entry" : ""} onClick={() => { setMovementType("entrada"); clearFile(); }}><ArrowDownLeft size={21} /><span><strong>Carga de ingresos</strong><small>Suma equipos al stock</small></span></button>
        <button className={movementType === "salida" ? "active exit" : ""} onClick={() => { setMovementType("salida"); clearFile(); }}><ArrowUpRight size={21} /><span><strong>Carga de salidas</strong><small>Valida y descuenta stock</small></span></button>
      </div>
      <div className="bulk-step"><span>2</span><div><strong>Carga el archivo</strong><small>Arrástralo al recuadro o haz clic para seleccionarlo.</small></div></div>
      <label
        className={`drop-zone ${fileError ? "drop-error" : ""} ${dragActive ? "drag-active" : ""}`}
        onDragEnter={dragOver}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={dropFile}
      >
        <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} />
        <Upload size={30} />
        <strong>{fileName || (dragActive ? "Suelta el archivo aquí" : "Arrastra tu Excel aquí o haz clic para buscarlo")}</strong>
        <span>{fileError || (rows.length ? `${rows.length} filas listas para cargar como ${operationLabel}` : "Formatos permitidos: .xlsx, .xls y .csv")}</span>
        <div className="format-badges"><b>XLSX</b><b>XLS</b><b>CSV</b></div>
      </label>
      {rows.length > 0 && movementType !== "maestro" && <div className="bulk-detected"><Layers3 size={18} /><div><strong>{detectedGroups} lotes/pedidos detectados</strong><span>Las filas se agruparán por N° Pedido + Coordinador Entel, aunque contengan varios SKU.</span></div></div>}
      {loadComplete && <div className="bulk-complete"><CheckCircle2 size={19} /><div><strong>Carga completada</strong><span>Este archivo ya fue procesado. Selecciona otro archivo para una nueva carga.</span></div></div>}
      {rows.length > 0 && <section className="bulk-preview">
        <div className="bulk-preview-head"><div><strong>Previsualización antes de cargar</strong><small>{movementType === "maestro" ? "Valida los tres campos oficiales del maestro." : "Descripción y tipo se normalizan con el maestro según el SKU."}</small></div><div className="bulk-preview-metrics"><span className="accepted"><b>{acceptedPreviewRows.length}</b> cargarán</span><span className="rejected"><b>{rejectedPreviewRows.length}</b> no cargarán</span><span><b>{money.format(previewCostCents / 100)}</b> valor aprobado</span></div></div>
        <div className="bulk-preview-table"><table><thead><tr><th>Fila</th><th>SKU</th><th>Nombre / Tipo maestro</th><th>Pedido / Coordinador</th><th>Serie / Lote</th><th className="align-right">Cantidad</th><th className="align-right">Costo total</th><th>Resultado</th></tr></thead><tbody>{previewRows.map((item, index) => <tr key={`${item.rowNumber}-${item.sku}-${index}`} className={item.accepted ? "preview-accepted" : "preview-rejected"}><td>{item.rowNumber}</td><td><strong>{item.sku}</strong></td><td><strong>{item.masterName}</strong><small>{item.masterType}</small></td><td><strong>{item.orderNumber}</strong><small>{item.coordinator}</small></td><td>{item.serials}</td><td className="align-right">{number.format(item.quantity)}</td><td className="align-right">{money.format(item.totalCostCents / 100)}</td><td><span className={`preview-status ${item.accepted ? "accepted" : "rejected"}`}>{item.accepted ? "SE CARGARÁ" : "NO SE CARGARÁ"}</span><small>{item.reason}</small></td></tr>)}</tbody></table></div>
        <p className="bulk-preview-note">La validación se repetirá al confirmar para proteger el stock si otro usuario registra movimientos al mismo tiempo.</p>
      </section>}
      <div className="upload-actions"><button className="secondary-button" onClick={() => void downloadTemplate()}><Download size={16} />Plantilla de {operationLabel}</button><button className={`primary-button ${movementType === "salida" ? "danger-button" : ""} ${loadComplete ? "load-complete-button" : ""}`} disabled={!acceptedPreviewRows.length || saving || loadComplete} onClick={() => void submitBulk()}>{saving ? "Procesando..." : loadComplete ? "✓ Carga completada" : `Cargar ${acceptedPreviewRows.length || ""} líneas aprobadas`}</button></div>
    </div>
    <aside className="panel mapping-panel">
      <div className="panel-title"><div><h2>{movementType === "entrada" ? "Campos de ingresos" : movementType === "salida" ? "Campos de salidas" : "3 campos del maestro"}</h2><p>Plantilla diferenciada por proceso</p></div></div>
      <div className={`operation-summary ${movementType}`}><span>{movementType === "entrada" ? <ArrowDownLeft size={19} /> : movementType === "salida" ? <ArrowUpRight size={19} /> : <Boxes size={19} />}</span><div><strong>{movementType === "entrada" ? "Ingreso al inventario" : movementType === "salida" ? "Salida del inventario" : "Maestro de productos"}</strong><small>{movementType === "entrada" ? "Los SKU existentes conservan el nombre y tipo oficiales del maestro." : movementType === "salida" ? "Acepta exactamente la estructura de tu Excel de despachos." : "Carga SKU, descripción oficial y tipo de equipo."}</small></div></div>
      <ul>{movementType === "entrada" ? <>
        <li><b>Identificación</b><span>Fila, Sku, Descripción Sku y Tipo de Equipo</span></li><li><b>Estado y asignación</b><span>Estado de Equipo, Condición y Proyecto</span></li><li><b>Recepción</b><span>RUC, Fecha de Ingreso y GR. de Ingreso; Proviene se completa desde el maestro</span></li><li><b>Responsables</b><span>Coordinador Entel y Coordinador F1</span></li><li><b>Trazabilidad</b><span>N° Pedido, Site Origen, Serie/Lote y Modo de Lote opcional</span></li><li><b>Transferencias</b><span>Si no recibes Serie/Lote, usa Modo de Lote = AUTOMATICO para generar un código TRF.</span></li><li><b>Valorización</b><span>Unidad de Medida, Cantidad y costo opcional; si falta, usa Stock Contrata Entel</span></li><li><b>Evidencia</b><span>Cargar Gr y Link de GR. de Ingreso</span></li>
      </> : movementType === "salida" ? <>
        <li><b>Despacho</b><span>ITEM, Fecha Salida, NroGRSalida, IDDespacho y Link de GR</span></li>
        <li><b>Equipo</b><span>Sku, Descripción Sku, Serie/Lote, Cantidad, UnidadMedida y Tipo de Equipo</span></li>
        <li><b>Destino</b><span>RUC/DNI, SiteDestino, Region, Provincia, ProyectoFinal y Consignatario; el nombre se completa desde el maestro</span></li>
        <li><b>Responsables</b><span>CordEntelFinal, CordF1, N° Pedido y Persona que Registra</span></li>
        <li><b>Control de correo</b><span>CorreoSolicitante, Estado Correo, EstadoCorreo y FechaEnvioCorreo</span></li>
        <li><b>Sin Ticket/JIRA</b><span>JIRA se completa únicamente en Conciliación.</span></li>
      </> : <>
        <li><b>Campos obligatorios</b><span>Sku, Descripción Sku y Tipo de Equipo</span></li><li><b>Fuente oficial</b><span>Ingresos y salidas se relacionan por SKU y muestran estos nombres.</span></li><li><b>Correcciones</b><span>Al actualizar el maestro, el nuevo nombre se refleja en todo el historial.</span></li>
      </>}</ul>
      {movementType !== "maestro" && <div className="mapping-note"><ShieldCheck size={17} /><span><b>Control de duplicados:</b> una GR y pedido pueden contener varias líneas dentro de la primera carga. Se bloquea volver a cargar la misma GR + pedido para la misma razón social; otra razón social sí se admite.</span></div>}
      <div className="storage-note"><Database size={18} /><div><strong>¿Dónde se almacena?</strong><span>Maestro SKU en Productos; ingresos y salidas en el Historial de movimientos.</span></div></div>
      <div className="mapping-note"><AlertTriangle size={17} /><span>{movementType === "entrada" ? "Los ingresos suman stock y agrupan todos los SKU del mismo pedido/coordinador. Si el SKU ya existe, el Excel no reemplaza su descripción ni su tipo." : movementType === "salida" ? "Las salidas validan SKU + N° Pedido + CordEntelFinal + Serie/Lote antes de descontar." : "Usa esta plantilla como catálogo oficial. Los SKU faltantes todavía pueden crearse desde un ingreso y luego corregirse en el maestro."}</span></div>
    </aside>
  </section>;
}

function FlowChart({ movements }: { movements: Movement[] }) {
  const days = useMemo(() => {
    const unique = [...new Set(movements.map((movement) => movement.movementDate))].sort().slice(-7);
    const fallback = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return date.toISOString().slice(0, 10); });
    return (unique.length ? unique : fallback).map((date) => ({
      date,
      incoming: movements.filter((movement) => movement.movementDate === date && movement.type === "entrada").reduce((sum, movement) => sum + movement.quantity, 0),
      outgoing: movements.filter((movement) => movement.movementDate === date && movement.type === "salida").reduce((sum, movement) => sum + movement.quantity, 0),
    }));
  }, [movements]);
  const max = Math.max(1, ...days.flatMap((day) => [day.incoming, day.outgoing]));
  return <div className="chart"><div className="chart-grid"><span /><span /><span /><span /></div>{days.map((day) => { const date = kardexDate(day.date); const label = date ? new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "2-digit" }).format(date).replace(".", "") : day.date; return <div className="chart-day" key={day.date}><div className="bars"><i className="bar-in" style={{ height: `${Math.max(day.incoming ? 10 : 2, (day.incoming / max) * 100)}%` }} title={`Ingresos: ${day.incoming}`} /><i className="bar-out" style={{ height: `${Math.max(day.outgoing ? 10 : 2, (day.outgoing / max) * 100)}%` }} title={`Salidas: ${day.outgoing}`} /></div><span>{label}</span></div>; })}</div>;
}

function StockAlerts({ products, hasMovements }: { products: Product[]; hasMovements: boolean }) {
  const alerts = products.slice(0, 4);
  if (!alerts.length) return <Empty text={hasMovements ? "No hay SKU con series o lotes en su nivel mínimo." : "Las alertas se activarán después de registrar ingresos y salidas."} compact />;
  return <div className="alert-list">{alerts.map((product) => <div className="alert-item" key={product.id}><span className="alert-icon"><AlertTriangle size={17} /></span><div><strong>{product.description}</strong><small>{product.sku} · Serie/Lote · Mínimo {product.minStock}</small></div><b>{product.stock} {product.unit}</b></div>)}</div>;
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}><Boxes size={compact ? 24 : 30} /><span>{text}</span></div>;
}

function MovementModal({ products, coordinators, suppliers, initialType, warehouse, saving, onClose, onSave, onNewProduct }: { products: Product[]; coordinators: Coordinator[]; suppliers: Supplier[]; initialType: Movement["type"]; warehouse: string; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void; onNewProduct: () => void }) {
  const type = initialType;
  const [lotAssignment, setLotAssignment] = useState<"MANUAL" | "AUTOMATICO">("MANUAL");
  const [productId, setProductId] = useState("");
  const [contractorDocument, setContractorDocument] = useState("");
  const [contractor, setContractor] = useState("");
  const singleUnit = type === "entrada" || type === "salida";
  const entelCoordinators = coordinators.filter((coordinator) => coordinator.organization === "ENTEL" && coordinator.active);
  const f1Coordinators = coordinators.filter((coordinator) => coordinator.organization === "F1" && coordinator.active);
  const selectedProduct = products.find((product) => String(product.id) === productId);
  const selectedSupplier = suppliers.find((supplier) => supplier.active && supplier.documentNumber === contractorDocument);
  const validDocumentMatch = type === "entrada" ? selectedSupplier?.documentType === "RUC" : Boolean(selectedSupplier);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(Object.fromEntries(form.entries()));
  }
  return <div className="modal-layer"><div className="modal-card">
    <div className="modal-head"><div><span className="modal-kicker">SISTEMA INVENTARIO F1</span><h2>{type === "salida" ? "Registrar salida" : type === "entrada" ? "Registrar ingreso" : "Regularizar movimiento"}</h2><p>Control por SKU, Serie/Lote, pedido y documento de sustento.</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div>
    <form onSubmit={submit}>
      <input type="hidden" name="action" value="movement" />
      <input type="hidden" name="type" value={type} />
      <div className={`operation-summary ${type}`}><span>{type === "salida" ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}</span><div><strong>{type === "salida" ? "Salida unitaria" : "Ingreso unitario"}</strong><small>Este formulario solo registra el proceso seleccionado. Para varias líneas usa Carga masiva.</small></div></div>
      {products.length === 0 ? <div className="no-products"><PackagePlus size={24} /><div><strong>Primero registra un SKU</strong><p>Necesitas un producto en Maestro_Equipos para crear movimientos.</p></div><button type="button" className="secondary-button" onClick={onNewProduct}>Crear producto</button></div> : <>
        <div className="form-grid">
          <label className="field field-wide"><span>SKU / Producto *</span><select name="productId" required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="" disabled>Selecciona un SKU</option>{products.map((product) => <option value={product.id} key={product.id}>{product.sku} — {product.description} (Disponible: {product.stock})</option>)}</select></label>
          <label className="field field-wide"><span>Descripción del equipo</span><input value={selectedProduct?.description ?? ""} readOnly placeholder="Se completa al seleccionar el SKU" /><small>{selectedProduct ? `${selectedProduct.category} · ${selectedProduct.unit}` : "La descripción oficial proviene del Maestro SKU."}</small></label>
          {type === "entrada" && <label className="field"><span>Asignación de Serie/Lote</span><select name="lotAssignment" value={lotAssignment} onChange={(event) => setLotAssignment(event.target.value as "MANUAL" | "AUTOMATICO")}><option value="MANUAL">Manual</option><option value="AUTOMATICO">Automática para transferencia</option></select><small>Automática genera un código TRF repetible para detectar duplicados.</small></label>}
          <label className="field"><span>Serie / Lote {type === "entrada" && lotAssignment === "MANUAL" ? "*" : ""}</span><input name="serials" required={type === "entrada" && lotAssignment === "MANUAL"} disabled={type === "entrada" && lotAssignment === "AUTOMATICO"} placeholder={type === "entrada" && lotAssignment === "AUTOMATICO" ? "Se generará al guardar" : "Serie única o lote"} /></label>
          <label className="field"><span>Cantidad *</span><input name="quantity" type="number" min="1" max={singleUnit ? 1 : undefined} step="1" required readOnly={singleUnit} defaultValue={1} /><small>{singleUnit ? "Registro unitario; para varias líneas usa Carga masiva." : "Cantidad solicitada."}</small></label>
          <label className="field"><span>Fecha *</span><input name="movementDate" type="date" required defaultValue={today()} /></label>
          <label className="field"><span>N° Pedido/Cod. Oracle {type === "entrada" || type === "salida" ? "*" : ""}</span><input name="orderNumber" required={type === "entrada" || type === "salida"} placeholder="Pedido Entel / código Oracle" /></label>
          <label className="field"><span>{type === "salida" ? "Nro. de GR de Salida" : "GR. de Ingreso"} *</span><input name="document" required placeholder="GR-001-000123" /></label>
          <label className="field field-wide"><span>{type === "salida" ? "Link de GR" : "Link de GR. de Ingreso"}</span><input name="grLink" placeholder="Pega el vínculo de SharePoint, con o sin https://" /></label>
          <label className="field"><span>{type === "salida" ? "Proyecto Final" : "Proyecto"}</span><input name="project" defaultValue="ENTEL" placeholder="Proyecto" /></label>
          <label className="field"><span>{type === "salida" ? "Cord. Entel Final" : "Coordinador Entel"} {type === "entrada" || type === "salida" ? "*" : ""}</span><input name="coordinator" list="entel-coordinators" required={type === "entrada" || type === "salida"} placeholder="Responsable Entel del pedido" /><datalist id="entel-coordinators">{entelCoordinators.map((coordinator) => <option value={coordinator.name} label={coordinator.email} key={coordinator.id} />)}</datalist></label>
          <label className="field"><span>Coordinador F1 {type === "entrada" || type === "salida" ? "*" : ""}</span><input name="coordinatorF1" list="f1-coordinators" required={type === "entrada" || type === "salida"} placeholder="Responsable interno F1" /><datalist id="f1-coordinators">{f1Coordinators.map((coordinator) => <option value={coordinator.name} label={coordinator.email} key={coordinator.id} />)}</datalist></label>
          <label className="field"><span>{type === "entrada" ? "RUC de empresa de origen" : "RUC/DNI de destino"} *</span><input name="contractorDocument" inputMode="numeric" pattern={type === "entrada" ? "[0-9]{11}" : "[0-9]{8}|[0-9]{11}"} required value={contractorDocument} onChange={(event) => { const value = event.target.value.replace(/\D/g, "").slice(0, 11); setContractorDocument(value); const match = suppliers.find((supplier) => supplier.active && supplier.documentNumber === value && (type !== "entrada" || supplier.documentType === "RUC")); setContractor(match?.businessName ?? ""); }} placeholder={type === "entrada" ? "11 dígitos" : "8 u 11 dígitos"} /><small>{validDocumentMatch ? `Registrado: ${selectedSupplier?.businessName}` : contractorDocument.length >= 8 ? "Documento no registrado o inactivo; agrégalo en Empresas y personas." : "El nombre se completará desde el maestro."}</small></label>
          <label className="field"><span>{type === "entrada" ? "Proviene (automático)" : "Razón social / nombre (automático)"}</span><input name="contractor" value={contractor} readOnly placeholder="Se completa al ingresar el documento" /></label>
          {type === "salida" ? <>
            <label className="field"><span>Site Destino</span><input name="destinationSite" placeholder="Código o nombre del site" /></label>
            <label className="field"><span>Región</span><input name="region" placeholder="Ej. Lima" /></label>
            <label className="field"><span>Provincia</span><input name="province" placeholder="Ej. Lima" /></label>
            <label className="field"><span>Consignatario</span><input name="consignee" placeholder="Persona que recibe" /></label>
          </> : <>
            <label className="field"><span>Site Origen</span><input name="originSite" defaultValue={warehouse} /></label>
            <label className="field"><span>Ubicación del stock</span><select name="stockLocation" defaultValue="MO COMPANY"><option value="MO COMPANY">MO Company</option><option value="F1 - TRÁNSITO">F1 - tránsito</option></select></label>
          </>}
          <label className="field"><span>Costo unitario (opcional)</span><input name="unitCost" type="number" min="0" step="0.01" placeholder="Se tomará de Stock Contrata si está vacío" /></label>
          <label className="field"><span>Estado de Equipo</span><select name="equipmentStatus" defaultValue="NUEVO"><option>NUEVO</option><option>USADO</option><option>REPARADO</option></select></label>
          <label className="field"><span>Condición</span><select name="condition" defaultValue="OPERATIVO"><option>OPERATIVO</option><option>OBSERVADO</option><option>INOPERATIVO</option></select></label>
          <label className="field"><span>Propietario</span><select name="owner" defaultValue="F1 SERVICES"><option>F1 SERVICES</option><option>ENTEL</option><option>WIN</option><option>PRONATEL</option></select></label>
          <label className="field field-wide"><span>Observación</span><textarea name="notes" rows={2} placeholder="Detalle adicional del movimiento" /></label>
        </div>
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || !validDocumentMatch}>{saving ? "Guardando..." : type === "salida" ? "Confirmar salida" : "Guardar ingreso"}</button></div>
      </>}
    </form>
  </div></div>;
}

function ProductModal({ products, saving, onClose, onSave }: { products: Product[]; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("EQUIPO");
  const matchedProduct = products.find((product) => product.sku.trim().toUpperCase() === sku.trim().toUpperCase());

  function selectSku(value: string) {
    setSku(value);
    const match = products.find((product) => product.sku.trim().toUpperCase() === value.trim().toUpperCase());
    if (match) {
      setDescription(match.description);
      setCategory(match.category.toUpperCase().includes("LOT") ? "LOTE" : "EQUIPO");
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }
  return <div className="modal-layer"><div className="modal-card modal-small"><div className="modal-head"><div><span className="modal-kicker">MAESTRO SKU</span><h2>Registrar o actualizar SKU</h2><p>El maestro solo define SKU, descripción oficial y si se controla como Equipo o Lote.</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><form onSubmit={submit}><input type="hidden" name="action" value="product" /><div className="form-grid"><label className="field"><span>SKU *</span><input name="sku" list="master-sku-options" required value={sku} onChange={(event) => selectSku(event.target.value)} placeholder="ENT960051349" /><datalist id="master-sku-options">{products.map((product) => <option key={product.id} value={product.sku}>{product.description}</option>)}</datalist><small>{matchedProduct ? "SKU existente: puedes corregir su descripción o tipo." : "Si no existe, se creará como nuevo SKU."}</small></label><label className="field field-wide"><span>Descripción SKU *</span><input name="description" required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción oficial del equipo" /></label><label className="field"><span>Tipo de control *</span><select name="category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="EQUIPO">Equipo (serie única)</option><option value="LOTE">Lote (cantidad)</option></select></label></div><div className="mapping-note"><Database size={17} /><span>GR, fecha de ingreso, proviene, estado, condición, link y coordinadores se completan al registrar el ingreso o salida; no pertenecen al Maestro SKU.</span></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : matchedProduct ? "Actualizar SKU" : "Crear SKU"}</button></div></form></div></div>;
}
