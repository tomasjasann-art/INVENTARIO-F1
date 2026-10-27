import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  appUsers,
  auditImports,
  auditRecords,
  coordinators,
  equipmentRequests,
  equipmentReturns,
  installationValidations,
  movements,
  productIdentifiers,
  products,
  sourceRecords,
  suppliers,
} from "../../../db/schema";
import { normalizeKardexDate } from "../../../lib/kardex-date";
import { createSupabaseAdminClient, internalAuthEmail, normalizeUsername, validUsername } from "../../../lib/supabase-auth";
import { resolveEvidenceImage, storeEvidenceImage } from "../../../lib/supabase-storage";
import { getAuthenticatedUser, isKardexAdminEmail } from "../../auth";
import { missingDeploymentConfig } from "../../deployment-config";

type ProductInput = {
  action?: "product";
  sku?: string;
  description?: string;
  category?: string;
  unit?: string;
  location?: string;
  minStock?: number;
  unitCost?: number;
  initialStock?: number;
  client?: string;
  owner?: string;
  defaultProject?: string;
};

type MovementInput = {
  action?: "movement";
  productId?: number;
  type?: "entrada" | "salida" | "devolucion" | "desinstalacion" | "traslado" | "regularizacion" | "baja" | "ajuste";
  quantity?: number;
  movementDate?: string;
  document?: string;
  project?: string;
  destinationSite?: string;
  coordinator?: string;
  coordinatorF1?: string;
  serials?: string;
  lotAssignment?: "ORIGINAL" | "MANUAL" | "AUTOMATICO";
  sourceRow?: string;
  originSite?: string;
  stockLocation?: string;
  unitMeasure?: string;
  unitCost?: number;
  equipmentType?: string;
  loadGr?: string;
  grLink?: string;
  orderNumber?: string;
  ticket?: string;
  equipmentStatus?: string;
  condition?: string;
  origin?: string;
  owner?: string;
  region?: string;
  province?: string;
  contractorDocument?: string;
  contractor?: string;
  consignee?: string;
  requesterEmail?: string;
  emailStatus?: string;
  emailFlowStatus?: string;
  dispatchId?: string;
  emailSentAt?: string;
  registeredBy?: string;
  notes?: string;
};

type BulkInput = {
  action?: "bulk";
  source?: string;
  movementType?: "entrada" | "salida" | "maestro";
  rows?: Array<Record<string, unknown>>;
};

type SupplierInput = {
  action?: "supplier";
  documentNumber?: string;
  businessName?: string;
  tradeName?: string;
  active?: boolean;
};

type SupplierBulkInput = {
  action?: "supplierBulk";
  rows?: Array<Record<string, unknown>>;
};

type CoordinatorBulkInput = {
  action?: "coordinatorBulk";
  rows?: Array<Record<string, unknown>>;
};

type CoordinatorInput = {
  action?: "coordinator";
  organization?: "F1" | "ENTEL";
  name?: string;
  email?: string;
};

type CoordinatorStatusInput = {
  action?: "coordinatorStatus";
  coordinatorId?: number;
  active?: boolean;
};

type ReconciliationInput = {
  action?: "reconciliation";
  movementId?: number;
  serial?: string;
  evidenceSsnn?: string;
  installedSite?: string;
  managementDate?: string;
  responsible?: string;
  requestStatus?: string;
  jiraRequestNumber?: string;
  reviewer?: string;
  entelReviewDate?: string;
  year?: string;
  oracleStatus?: string;
  reportGrLink?: string;
  observation?: string;
};

type AuditRecordInput = {
  sourceKey?: string;
  contractor?: string;
  sku?: string;
  description?: string;
  seriesLot?: string;
  quantity?: number;
  unitMeasure?: string;
  equipmentType?: string;
  subinventory?: string;
  projectCode?: string;
  project?: string;
  purchaseOrder?: string;
  task?: string;
  requester?: string;
  site?: string;
  totalCost?: number;
  warehouseEntryDate?: string;
  receiptDate?: string;
  orderNumber?: string;
  ageMonths?: number;
  ageBucket?: string;
  category?: string;
};

type AuditImportInput = {
  action?: "auditImport";
  source?: "ENTEL" | "ORACLE";
  fileName?: string;
  sheetName?: string;
  contractor?: string;
  cutoffDate?: string;
  rawRowCount?: number;
  rows?: AuditRecordInput[];
};

type EquipmentRequestInput = {
  action?: "request";
  coordinatorName?: string;
  coordinatorEmail?: string;
  coordinatorEntel?: string;
  orderNumber?: string;
  project?: string;
  site?: string;
  warehouse?: string;
  contractorRuc?: string;
  contractorBusinessName?: string;
  pickupPersonDni?: string;
  pickupPerson?: string;
  pickupPerson2Dni?: string;
  pickupPerson2?: string;
  region?: string;
  city?: string;
  deliveryAddress?: string;
  transport?: string;
  neededDate?: string;
  notes?: string;
  items?: Array<{ productId?: number; quantity?: number; seriesLot?: string }>;
};

type RequestStatusInput = {
  action?: "requestStatus";
  requestId?: number;
  status?: RequestStatus;
};

type RequestStatus = "PENDIENTE" | "VALIDADA" | "DESPACHADA" | "EN_TRANSITO" | "LISTA_RECOJO" | "RECOGIDA" | "CERRADA" | "RECHAZADA";

type RequestLogisticsInput = {
  action?: "requestLogistics";
  requestCode?: string;
  status?: RequestStatus;
  outboundGuide?: string;
  outboundGuideLink?: string;
  outboundGuidePhoto?: string;
  shippingTicket?: string;
  shippingTicketPhoto?: string;
  shippingKey?: string;
  sentDate?: string;
  arrivalDate?: string;
  pickupDate?: string;
  deliveryAddress?: string;
  transport?: string;
  logisticsNotes?: string;
};

type EquipmentReturnCreateInput = {
  action?: "equipmentReturnCreate";
  productId?: number;
  coordinatorF1?: string;
  orderNumber?: string;
  serial?: string;
  partNumber?: string;
  sourceMovementId?: number | null;
  matchMethod?: string;
  matchConfidence?: number;
  rawOcrText?: string;
  evidenceImage?: string;
  rememberIdentifier?: boolean;
  notes?: string;
};

type EquipmentReturnStatus = "PENDIENTE_APROBACION" | "OBSERVADA" | "APROBADA_PENDIENTE_RECEPCION" | "RECIBIDA_FISICA" | "RECHAZADA";

type EquipmentReturnStatusInput = {
  action?: "equipmentReturnStatus";
  returnId?: number;
  status?: EquipmentReturnStatus;
  notes?: string;
};

type EquipmentReturnBatchRowInput = {
  productId?: number;
  serial?: string;
  itemType?: "EQUIPO" | "LOTE";
  partNumber?: string;
  quantity?: number;
  networkComponent?: string;
  subProject?: string;
  sourceProject?: string;
  hardwareTask?: string;
  length?: string;
  condition?: string;
  volumeM3?: string;
  sourceMovementId?: number | null;
  matchMethod?: string;
  matchConfidence?: number;
  rawOcrText?: string;
  evidenceImage?: string;
  entelLabelImage?: string;
  modelImage?: string;
  panoramicImage?: string;
  rememberIdentifier?: boolean;
  notes?: string;
};

type EquipmentReturnEvidenceUploadInput = {
  action?: "equipmentReturnEvidenceUpload";
  evidenceImage?: string;
  folderKey?: string;
  kind?: string;
};

type EquipmentReturnBatchCreateInput = {
  action?: "equipmentReturnBatchCreate";
  coordinatorF1?: string;
  orderNumber?: string;
  returnDate?: string;
  site?: string;
  warehouse?: string;
  comments?: string;
  rows?: EquipmentReturnBatchRowInput[];
};

type EquipmentReturnReceiptInput = {
  returnId?: number;
  movementDate?: string;
  document?: string;
  grLink?: string;
  orderNumber?: string;
  project?: string;
  origin?: string;
  coordinatorEntel?: string;
  originSite?: string;
  stockLocation?: string;
  unitMeasure?: string;
  equipmentStatus?: string;
  condition?: string;
  unitCost?: number;
  notes?: string;
};

type EquipmentReturnBatchStatusInput = {
  action?: "equipmentReturnBatchStatus";
  batchCode?: string;
  status?: EquipmentReturnStatus;
  notes?: string;
  receipts?: EquipmentReturnReceiptInput[];
};

type UserRole = "ADMINISTRADOR" | "LOGISTICA" | "COORDINADOR" | "SOLO_LECTURA" | "CONDUCTOR" | "TECNICO";

type AppUserInput = {
  action?: "appUser";
  userId?: number;
  username?: string;
  displayName?: string;
  role?: UserRole;
  coordinatorId?: number;
  active?: boolean;
  temporaryPassword?: string;
};

type AppUserResetPasswordInput = {
  action?: "appUserResetPassword";
  userId?: number;
  temporaryPassword?: string;
};

type CleanupInput = {
  action?: "cleanup";
  scope?: "operations" | "all";
  confirmation?: string;
  backupConfirmed?: boolean;
};

function normalizeDocumentNumber(value: unknown) {
  return clean(value).replace(/\D/g, "");
}

function validSupplierDocument(value: string) {
  return /^\d{8}$|^\d{11}$/.test(value);
}

function normalizeParty(value: unknown) {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function normalizeEquipmentIdentifier(value: unknown) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function clean(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function rowValue(row: Record<string, unknown>, ...names: string[]) {
  const wanted = new Set(names.map(normalizeHeader));
  const match = Object.entries(row).find(([key]) => wanted.has(normalizeHeader(key)));
  return match?.[1];
}

function numeric(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = clean(value).replace(/S\/?\.?/gi, "").replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  return Number(text) || 0;
}

function normalizeGrLink(value: unknown) {
  const link = clean(value);
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  if (/^(www\.|[^/\s]+\.sharepoint\.com\/)/i.test(link)) return `https://${link}`;
  return link;
}

function normalizeEvidenceImage(value: unknown) {
  const image = clean(value);
  if (!image) return "";
  if (image.startsWith("supabase://") || /^https?:\/\//i.test(image)) return image;
  if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(image)) {
    throw new Error("La evidencia debe ser una foto JPG, PNG o WEBP.");
  }
  if (image.length > 2_500_000) {
    throw new Error("La foto supera el tamaño permitido. Usa una imagen menor a 2 MB.");
  }
  return image;
}

function lotTokenPart(value: unknown, fallback: string) {
  return clean(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || fallback;
}

function automaticLotCode({ movementDate, orderNumber, sku, sourceRow }: { movementDate: string; orderNumber: string; sku: string; sourceRow: string }) {
  return [
    "TRF",
    movementDate.replace(/\D/g, "").slice(0, 8) || "SINFECHA",
    lotTokenPart(orderNumber, "SINPEDIDO"),
    lotTokenPart(sku, "SINSKU"),
    lotTokenPart(sourceRow, "1"),
  ].join("-");
}

function auditUnitCosts(rows: Array<{ source: string; sku: string; quantity: number; totalCostCents: number }>) {
  const totals = new Map<string, { quantity: number; costCents: number }>();
  rows.filter((row) => row.source === "ENTEL" && row.quantity > 0 && row.totalCostCents > 0).forEach((row) => {
    const sku = row.sku.trim().toUpperCase();
    const current = totals.get(sku) ?? { quantity: 0, costCents: 0 };
    current.quantity += row.quantity;
    current.costCents += row.totalCostCents;
    totals.set(sku, current);
  });
  return new Map([...totals].map(([sku, total]) => [sku, Math.round(total.costCents / total.quantity)]));
}

async function latestEntelUnitCosts(db: ReturnType<typeof getDb>) {
  const [latest] = await db.select().from(auditImports)
    .where(and(eq(auditImports.source, "ENTEL"), eq(auditImports.status, "READY")))
    .orderBy(desc(auditImports.id))
    .limit(1);
  if (!latest) return new Map<string, number>();
  return auditUnitCosts(await db.select().from(auditRecords).where(eq(auditRecords.importId, latest.id)));
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado";
  if (message.includes("UNIQUE constraint failed") || message.includes("duplicate key value violates unique constraint")) return "El registro ya existe.";
  if (message.includes("no such table") || message.includes("relation") && message.includes("does not exist")) return "La base de datos todavía no está inicializada. Ejecuta las migraciones de Supabase.";
  return message;
}

function stockEffect(type: string) {
  if (type === "salida" || type === "baja") return -1;
  if (type === "traslado") return 0;
  return 1;
}

function isLotControlled(category: string, quantity = 1) {
  return normalizeParty(category).includes("LOTE") || quantity > 1;
}

function splitSeries(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function sameControlGroup(
  movement: { orderNumber: string; coordinator: string },
  orderNumber: string,
  coordinator: string,
) {
  return clean(movement.orderNumber).toUpperCase() === orderNumber.toUpperCase()
    && clean(movement.coordinator).toUpperCase() === coordinator.toUpperCase();
}

function movementParty(movement: { contractorDocument?: string; contractor?: string; origin?: string }) {
  return normalizeDocumentNumber(movement.contractorDocument)
    || normalizeParty(movement.contractor)
    || normalizeParty(movement.origin);
}

function duplicatesOperationalDocument(
  movement: { type: string; document: string; orderNumber: string; contractorDocument?: string; contractor?: string; origin?: string },
  incoming: { type: string; document: string; orderNumber: string; contractorDocument?: string; contractor?: string; origin?: string },
) {
  const document = normalizeParty(incoming.document);
  const orderNumber = normalizeParty(incoming.orderNumber);
  const party = movementParty(incoming);
  if (!document || !orderNumber || !party) return false;
  return movement.type === incoming.type
    && normalizeParty(movement.document) === document
    && normalizeParty(movement.orderNumber) === orderNumber
    && movementParty(movement) === party;
}

async function supplierFromDocument(db: ReturnType<typeof getDb>, value: unknown) {
  const documentNumber = normalizeDocumentNumber(value);
  if (!validSupplierDocument(documentNumber)) return null;
  const [supplier] = await db.select().from(suppliers)
    .where(and(eq(suppliers.documentNumber, documentNumber), eq(suppliers.active, true)))
    .limit(1);
  return supplier ?? null;
}

function trackedSeriesQuantity(serials: string, quantity: number, token: string) {
  const tokens = splitSeries(serials);
  if (!tokens.includes(token)) return 0;
  return tokens.length > 1 ? 1 : quantity;
}

async function currentAccess(db: ReturnType<typeof getDb>, user: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  if (!user) return null;
  const normalized = user.email.trim().toLowerCase();
  if (user.authProvider === "clerk" && isKardexAdminEmail(normalized)) return { email: normalized, displayName: "Administrador", role: "ADMINISTRADOR" as UserRole, active: true };
  const [record] = await db.select().from(appUsers).where(user.authProvider === "supabase"
    ? eq(appUsers.authUserId, user.userId)
    : eq(appUsers.email, normalized)).limit(1);
  return record ?? null;
}

function mayOperate(role: UserRole) {
  return role === "ADMINISTRADOR" || role === "LOGISTICA";
}

function normalizeStockLocation(value: unknown) {
  const location = clean(value).toUpperCase();
  return location.includes("F1") || location.includes("TRANS") ? "F1 - TRÁNSITO" : "MO COMPANY";
}

export async function GET(request: Request) {
  try {
    const missingConfig = missingDeploymentConfig();
    if (missingConfig.length) return Response.json({ error: `Configuración pendiente: ${missingConfig.join(", ")}.` }, { status: 503 });
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: "Debes iniciar sesión para acceder a Logística F1." }, { status: 401 });
    const db = getDb();
    const access = await currentAccess(db, user);
    if (!access?.active) return Response.json({ error: "Tu usuario no está registrado o se encuentra inactivo. Comunícate con un administrador." }, { status: 403 });
    if (access.role === "TECNICO") return Response.json({ error: "Tu acceso corresponde a Activos F1." }, { status: 403 });
    if (access.role === "CONDUCTOR") return Response.json({ error: "Tu acceso corresponde al módulo de vehículos." }, { status: 403 });
    const [assignedCoordinator] = access.role === "COORDINADOR" && "coordinatorId" in access && access.coordinatorId
      ? await db.select().from(coordinators).where(and(
        eq(coordinators.id, access.coordinatorId),
        eq(coordinators.organization, "F1"),
        eq(coordinators.active, true),
      )).limit(1)
      : [];
    if (access.role === "COORDINADOR" && !assignedCoordinator) {
      return Response.json({ error: "Tu cuenta de Coordinador aún no está vinculada a un Coordinador F1 activo. Solicita la vinculación al administrador." }, { status: 403 });
    }
    if (new URL(request.url).searchParams.get("backup") === "1") {
      if (!mayOperate(access.role)) return Response.json({ error: "Tu perfil no puede descargar respaldos operativos." }, { status: 403 });
      const [productRows, movementRows, sourceRows, coordinatorRows, supplierRows, validationRows, importRows, recordRows, requestRows, returnRows, identifierRows, userRows] = await Promise.all([
        db.select().from(products),
        db.select().from(movements),
        db.select().from(sourceRecords),
        db.select().from(coordinators),
        db.select().from(suppliers),
        db.select().from(installationValidations),
        db.select().from(auditImports),
        db.select().from(auditRecords),
        db.select().from(equipmentRequests),
        db.select().from(equipmentReturns),
        db.select().from(productIdentifiers),
        db.select().from(appUsers),
      ]);
      return Response.json({ products: productRows, movements: movementRows, sourceRecords: sourceRows, coordinators: coordinatorRows, suppliers: supplierRows, installationValidations: validationRows, auditImports: importRows, auditRecords: recordRows, equipmentRequests: requestRows, equipmentReturns: returnRows, productIdentifiers: identifierRows, appUsers: userRows });
    }
    const productRows = await db.select().from(products).orderBy(products.description);
    const sourceRows = await db.select().from(sourceRecords).orderBy(desc(sourceRecords.id)).limit(3000);
    const coordinatorRows = await db.select().from(coordinators).orderBy(coordinators.organization, coordinators.name);
    const supplierRows = await db.select().from(suppliers).orderBy(suppliers.businessName);
    const validationRows = await db.select().from(installationValidations).orderBy(desc(installationValidations.id));
    const requestRows = await db.select().from(equipmentRequests).orderBy(desc(equipmentRequests.id)).limit(1200);
    const returnRows = access.role === "COORDINADOR" ? [] : await db.select().from(equipmentReturns).orderBy(desc(equipmentReturns.id)).limit(1200);
    const identifierRows = access.role === "COORDINADOR" ? [] : await db.select().from(productIdentifiers).orderBy(desc(productIdentifiers.id));
    const userRows = access.role === "ADMINISTRADOR" ? await db.select().from(appUsers).orderBy(appUsers.displayName, appUsers.email) : [];
    const [auditHistory, latestEntelRows, latestOracleRows] = await Promise.all([
      db.select().from(auditImports).where(eq(auditImports.status, "READY")).orderBy(desc(auditImports.id)).limit(12),
      db.select().from(auditImports).where(eq(auditImports.source, "ENTEL")).orderBy(desc(auditImports.id)).limit(12),
      db.select().from(auditImports).where(eq(auditImports.source, "ORACLE")).orderBy(desc(auditImports.id)).limit(12),
    ]);
    const latestEntelImport = latestEntelRows.find((row) => row.status === "READY");
    const latestOracleImport = latestOracleRows.find((row) => row.status === "READY");
    const auditImportRows = [latestEntelImport, latestOracleImport, ...auditHistory]
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)
      .sort((a, b) => b.id - a.id)
      .slice(0, 12);
    const auditRecordRows = (
      await Promise.all(
        [latestEntelImport, latestOracleImport]
          .filter((row): row is NonNullable<typeof row> => Boolean(row))
          .map((row) => db.select().from(auditRecords).where(eq(auditRecords.importId, row.id))),
      )
    ).flat();
    const entelCostBySku = auditUnitCosts(auditRecordRows);
    const resolvedProductCostById = new Map(productRows.map((product) => [
      product.id,
      product.unitCostCents || entelCostBySku.get(product.sku.toUpperCase()) || 0,
    ]));
    const currentAuditKeys = new Set(auditRecordRows.map((row) => `${row.source}::${row.sourceKey.toUpperCase()}`));
    const previousImports = auditImportRows.filter((row) => row.id !== latestEntelImport?.id && row.id !== latestOracleImport?.id);
    const historicalRecordBatches = await Promise.all(
      previousImports.map((row) => db.select().from(auditRecords).where(eq(auditRecords.importId, row.id))),
    );
    const historicalAuditMap = new Map<string, typeof auditRecordRows[number]>();
    historicalRecordBatches.forEach((rows) => rows.forEach((row) => {
      const key = `${row.source}::${row.sourceKey.toUpperCase()}`;
      if (!currentAuditKeys.has(key) && !historicalAuditMap.has(key)) historicalAuditMap.set(key, row);
    }));
    const movementRows = await db
      .select({
        id: movements.id,
        productId: movements.productId,
        type: movements.type,
        quantity: movements.quantity,
        movementDate: movements.movementDate,
        document: movements.document,
        project: movements.project,
        destinationSite: movements.destinationSite,
        coordinator: movements.coordinator,
        coordinatorF1: movements.coordinatorF1,
        serials: movements.serials,
        lotAssignment: movements.lotAssignment,
        sourceRow: movements.sourceRow,
        originSite: movements.originSite,
        stockLocation: movements.stockLocation,
        unitMeasure: movements.unitMeasure,
        unitCostCents: movements.unitCostCents,
        productUnitCostCents: products.unitCostCents,
        equipmentType: movements.equipmentType,
        loadGr: movements.loadGr,
        grLink: movements.grLink,
        orderNumber: movements.orderNumber,
        ticket: movements.ticket,
        equipmentStatus: movements.equipmentStatus,
        condition: movements.condition,
        origin: movements.origin,
        owner: movements.owner,
        recordStatus: movements.recordStatus,
        region: movements.region,
        province: movements.province,
        contractorDocument: movements.contractorDocument,
        contractor: movements.contractor,
        consignee: movements.consignee,
        requesterEmail: movements.requesterEmail,
        emailStatus: movements.emailStatus,
        emailFlowStatus: movements.emailFlowStatus,
        dispatchId: movements.dispatchId,
        emailSentAt: movements.emailSentAt,
        registeredBy: movements.registeredBy,
        notes: movements.notes,
        createdAt: movements.createdAt,
        sku: products.sku,
        description: products.description,
        unit: products.unit,
      })
      .from(movements)
      .innerJoin(products, eq(movements.productId, products.id))
      .orderBy(desc(movements.movementDate), desc(movements.id))
      .limit(1500);

    const stock = new Map<number, number>();
    for (const movement of movementRows) {
      const sign = stockEffect(movement.type);
      stock.set(movement.productId, (stock.get(movement.productId) ?? 0) + movement.quantity * sign);
    }

    const isCoordinator = access.role === "COORDINADOR";
    const assignedCoordinatorName = normalizeParty(assignedCoordinator?.name);
    const ownMovementRows = isCoordinator
      ? movementRows.filter((movement) => ["salida", "baja"].includes(movement.type)
        && normalizeParty(movement.coordinatorF1) === assignedCoordinatorName)
      : movementRows;
    const ownRequestRows = isCoordinator
      ? requestRows.filter((row) => row.coordinatorId === assignedCoordinator?.id
        || (!row.coordinatorId && normalizeParty(row.coordinatorName) === assignedCoordinatorName))
      : requestRows;
    const visibleCoordinatorRows = isCoordinator
      ? coordinatorRows.filter((row) => row.active && (row.organization === "ENTEL" || row.id === assignedCoordinator?.id))
      : coordinatorRows;
    const resolvedMovements = ownMovementRows.map((movement) => ({
      ...movement,
      unitCostCents: movement.unitCostCents || resolvedProductCostById.get(movement.productId) || 0,
      productUnitCostCents: resolvedProductCostById.get(movement.productId) || movement.productUnitCostCents,
      costSource: movement.unitCostCents > 0 ? "MOVIMIENTO" : (resolvedProductCostById.get(movement.productId) ?? 0) > 0 ? "STOCK CONTRATA ENTEL / MAESTRO" : "SIN COSTO",
      movementDate: normalizeKardexDate(movement.movementDate, movement.movementDate),
    }));
    const coordinatorRequestGroups = new Map<string, typeof ownRequestRows>();
    ownRequestRows.forEach((row) => coordinatorRequestGroups.set(row.requestCode, [...(coordinatorRequestGroups.get(row.requestCode) ?? []), row]));
    const pendingCoordinatorGroups = [...coordinatorRequestGroups.values()].filter((group) => !["CERRADA", "RECHAZADA"].includes(group[0]?.status ?? ""));
    const coordinatorSummary = isCoordinator ? {
      dispatchedCostCents: resolvedMovements.reduce((sum, movement) => sum + (movement.unitCostCents || movement.productUnitCostCents || 0) * movement.quantity, 0),
      dispatches: new Set(resolvedMovements.map((movement) => movement.document || `MOV-${movement.id}`)).size,
      pendingSites: new Set(pendingCoordinatorGroups.map((group) => group[0]?.site.trim()).filter(Boolean)).size,
      pendingGuides: new Set(pendingCoordinatorGroups.map((group) => group[0]?.outboundGuide.trim()).filter(Boolean)).size,
      pendingWithoutGuide: pendingCoordinatorGroups.filter((group) => !group[0]?.outboundGuide.trim()).length,
    } : null;

    return Response.json({
      products: productRows.map((product) => ({
        ...product,
        unitCostCents: isCoordinator ? 0 : resolvedProductCostById.get(product.id) ?? product.unitCostCents,
        costSource: isCoordinator ? "RESTRINGIDO" : product.unitCostCents > 0 ? "KARDEX" : entelCostBySku.has(product.sku.toUpperCase()) ? "STOCK CONTRATA ENTEL" : "SIN COSTO",
        stock: stock.get(product.id) ?? 0,
      })),
      movements: resolvedMovements,
      stockMovements: movementRows.map((movement) => ({
        id: movement.id,
        productId: movement.productId,
        type: movement.type,
        quantity: movement.quantity,
        orderNumber: movement.orderNumber,
        serials: movement.serials,
        coordinator: isCoordinator ? "" : movement.coordinator,
      })),
      stockReservations: requestRows
        .filter((row) => ["PENDIENTE", "VALIDADA"].includes(row.status))
        .map((row) => ({ productId: row.productId, orderNumber: row.orderNumber, seriesLot: row.seriesLot, quantity: row.quantity })),
      sourceRecords: isCoordinator ? [] : sourceRows.map((record) => ({
        ...record,
        movementDate: normalizeKardexDate(record.movementDate, record.movementDate),
      })),
      coordinators: visibleCoordinatorRows,
      suppliers: isCoordinator ? supplierRows.filter((row) => row.active) : supplierRows,
      installationValidations: isCoordinator ? [] : validationRows.map((validation) => ({
        ...validation,
        managementDate: normalizeKardexDate(validation.managementDate, validation.managementDate),
        entelReviewDate: normalizeKardexDate(validation.entelReviewDate, validation.entelReviewDate),
      })),
      auditImports: isCoordinator ? [] : auditImportRows,
      auditRecords: isCoordinator ? [] : auditRecordRows,
      auditHistoryRecords: isCoordinator ? [] : [...historicalAuditMap.values()],
      equipmentRequests: await Promise.all(ownRequestRows.map(async (row) => ({
        ...row,
        outboundGuidePhotoStored: row.outboundGuidePhoto,
        shippingTicketPhotoStored: row.shippingTicketPhoto,
        outboundGuidePhoto: await resolveEvidenceImage(row.outboundGuidePhoto),
        shippingTicketPhoto: await resolveEvidenceImage(row.shippingTicketPhoto),
      }))),
      equipmentReturns: await Promise.all(returnRows.map(async (row) => ({
        ...row,
        evidenceImageStored: row.evidenceImage,
        entelLabelImageStored: row.entelLabelImage,
        modelImageStored: row.modelImage,
        panoramicImageStored: row.panoramicImage,
        evidenceImage: await resolveEvidenceImage(row.evidenceImage),
        entelLabelImage: await resolveEvidenceImage(row.entelLabelImage),
        modelImage: await resolveEvidenceImage(row.modelImage),
        panoramicImage: await resolveEvidenceImage(row.panoramicImage),
      }))),
      productIdentifiers: identifierRows,
      appUsers: userRows,
      coordinatorSummary,
      currentUser: { email: user.email.toLowerCase(), displayName: user.displayName, role: access.role, active: access.active, authProvider: user.authProvider, mustChangePassword: "mustChangePassword" in access ? access.mustChangePassword : false, coordinatorId: assignedCoordinator?.id ?? null, coordinatorName: assignedCoordinator?.name ?? "" },
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const missingConfig = missingDeploymentConfig();
    if (missingConfig.length) return Response.json({ error: `Configuración pendiente: ${missingConfig.join(", ")}.` }, { status: 503 });
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: "Debes iniciar sesión para modificar Logística F1." }, { status: 401 });
    const db = getDb();
    const access = await currentAccess(db, user);
    if (!access) return Response.json({ error: "Tu usuario no está registrado. Pide a un administrador que cree o habilite tu cuenta." }, { status: 403 });
    if (access.role === "TECNICO") return Response.json({ error: "Tu acceso corresponde a Activos F1." }, { status: 403 });
    if (access.role === "CONDUCTOR") return Response.json({ error: "Tu acceso corresponde al módulo de vehículos." }, { status: 403 });
    const [assignedCoordinator] = access.role === "COORDINADOR" && "coordinatorId" in access && access.coordinatorId
      ? await db.select().from(coordinators).where(and(
        eq(coordinators.id, access.coordinatorId),
        eq(coordinators.organization, "F1"),
        eq(coordinators.active, true),
      )).limit(1)
      : [];
    const payload = (await request.json()) as ProductInput | MovementInput | BulkInput | SupplierInput | SupplierBulkInput | CoordinatorInput | CoordinatorBulkInput | CoordinatorStatusInput | ReconciliationInput | AuditImportInput | EquipmentRequestInput | RequestStatusInput | RequestLogisticsInput | EquipmentReturnCreateInput | EquipmentReturnStatusInput | EquipmentReturnEvidenceUploadInput | EquipmentReturnBatchCreateInput | EquipmentReturnBatchStatusInput | AppUserInput | AppUserResetPasswordInput | CleanupInput;
    const action = clean(payload.action);
    if (!access.active) return Response.json({ error: "Tu usuario está inactivo. Comunícate con un administrador." }, { status: 403 });
    if (access.role === "COORDINADOR" && !assignedCoordinator) return Response.json({ error: "Tu cuenta no está vinculada a un Coordinador F1 activo." }, { status: 403 });
    if ((action === "appUser" || action === "appUserResetPassword") && access.role !== "ADMINISTRADOR") return Response.json({ error: "Solo un Administrador puede cambiar permisos." }, { status: 403 });
    if (action === "cleanup" && access.role !== "ADMINISTRADOR") return Response.json({ error: "Solo un Administrador puede limpiar la base." }, { status: 403 });
    if (action === "request" && !mayOperate(access.role) && access.role !== "COORDINADOR") return Response.json({ error: "Tu perfil es de solo lectura." }, { status: 403 });
    if (action !== "request" && action !== "appUser" && action !== "appUserResetPassword" && action !== "cleanup" && !mayOperate(access.role)) return Response.json({ error: "Tu perfil no puede modificar datos operativos." }, { status: 403 });

    if (payload.action === "appUser") {
      const userPayload = payload as AppUserInput;
      const username = normalizeUsername(userPayload.username);
      const displayName = clean(userPayload.displayName);
      const temporaryPassword = String(userPayload.temporaryPassword ?? "");
      const roles: UserRole[] = ["ADMINISTRADOR", "LOGISTICA", "COORDINADOR", "SOLO_LECTURA", "CONDUCTOR", "TECNICO"];
      const role = roles.includes(userPayload.role as UserRole) ? userPayload.role as UserRole : "SOLO_LECTURA";
      const coordinatorId = Number(userPayload.coordinatorId) || null;
      const [linkedCoordinator] = coordinatorId
        ? await db.select().from(coordinators).where(and(
          eq(coordinators.id, coordinatorId),
          eq(coordinators.organization, "F1"),
          eq(coordinators.active, true),
        )).limit(1)
        : [];
      if (role === "COORDINADOR" && !linkedCoordinator) {
        return Response.json({ error: "Selecciona un Coordinador F1 activo para este usuario." }, { status: 400 });
      }
      const requestedUserId = Number(userPayload.userId);
      const isUpdate = Number.isInteger(requestedUserId) && requestedUserId > 0;
      const [existingUser] = isUpdate
        ? await db.select().from(appUsers).where(eq(appUsers.id, requestedUserId)).limit(1)
        : [];
      if (isUpdate && !existingUser) return Response.json({ error: "El usuario que intentas actualizar ya no existe." }, { status: 404 });
      if (!existingUser && !validUsername(username)) return Response.json({ error: "El usuario debe tener entre 4 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo." }, { status: 400 });
      if (!displayName) return Response.json({ error: "Ingresa el nombre del colaborador." }, { status: 400 });
      if (!existingUser && temporaryPassword.length < 10) {
        return Response.json({ error: "La contraseña temporal debe tener al menos 10 caracteres." }, { status: 400 });
      }
      if (!existingUser) {
        const [duplicate] = await db.select({ id: appUsers.id }).from(appUsers).where(eq(appUsers.username, username)).limit(1);
        if (duplicate) return Response.json({ error: "Ese nombre de usuario ya está registrado." }, { status: 409 });
      }

      const active = userPayload.active !== false;
      const admin = createSupabaseAdminClient();
      if (existingUser) {
        const storedUsername = existingUser.username || username;
        if (existingUser.authUserId) {
          const { error } = await admin.auth.admin.updateUserById(existingUser.authUserId, {
            app_metadata: { application: "LOGISTICA_F1", username: storedUsername, role, active, coordinator_id: coordinatorId },
            user_metadata: { display_name: displayName },
          });
          if (error) return Response.json({ error: `No se pudo actualizar la cuenta: ${error.message}` }, { status: 400 });
        }
        const [savedUser] = await db.update(appUsers).set({ displayName, role, coordinatorId, active, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appUsers.id, existingUser.id)).returning();
        return Response.json({ ok: true, user: savedUser, accountStatus: active ? "ACTIVA" : "INACTIVA" });
      }

      const email = internalAuthEmail(username);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        app_metadata: { application: "LOGISTICA_F1", username, role, active, coordinator_id: coordinatorId },
        user_metadata: { display_name: displayName },
      });
      if (createError || !created.user) return Response.json({ error: `No se pudo crear la cuenta: ${createError?.message || "respuesta inválida de Supabase"}` }, { status: 400 });
      try {
        const now = new Date().toISOString();
        const [savedUser] = await db.insert(appUsers).values({
          email,
          username,
          authUserId: created.user.id,
          displayName,
          role,
          coordinatorId,
          active,
          mustChangePassword: true,
          invitationStatus: "CUENTA_CREADA",
          invitedAt: now,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        }).returning();
        return Response.json({ ok: true, user: savedUser, accountStatus: "CUENTA_CREADA" });
      } catch (databaseError) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined);
        throw databaseError;
      }
    }

    if (payload.action === "appUserResetPassword") {
      const resetPayload = payload as AppUserResetPasswordInput;
      const userId = Number(resetPayload.userId);
      const temporaryPassword = String(resetPayload.temporaryPassword ?? "");
      if (!Number.isInteger(userId) || userId <= 0) return Response.json({ error: "Usuario inválido." }, { status: 400 });
      if (temporaryPassword.length < 10) return Response.json({ error: "La contraseña temporal debe tener al menos 10 caracteres." }, { status: 400 });
      const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
      if (!targetUser?.authUserId) return Response.json({ error: "Esta cuenta todavía pertenece al acceso anterior y no tiene contraseña interna." }, { status: 400 });
      const admin = createSupabaseAdminClient();
      const { error } = await admin.auth.admin.updateUserById(targetUser.authUserId, { password: temporaryPassword });
      if (error) return Response.json({ error: `No se pudo restablecer la contraseña: ${error.message}` }, { status: 400 });
      await db.update(appUsers).set({ mustChangePassword: true, passwordUpdatedAt: "", updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(appUsers.id, userId));
      return Response.json({ ok: true, accountStatus: "CLAVE_TEMPORAL" });
    }

    if (payload.action === "cleanup") {
      const cleanupPayload = payload as CleanupInput;
      const scope = cleanupPayload.scope === "all" ? "all" : "operations";
      const requiredPhrase = scope === "all" ? "BORRAR TODO" : "LIMPIAR PRUEBAS";
      if (clean(cleanupPayload.confirmation).toUpperCase() !== requiredPhrase) {
        return Response.json({ error: `Escribe ${requiredPhrase} para confirmar.` }, { status: 400 });
      }
      await db.transaction(async (tx) => {
        await tx.delete(installationValidations);
        await tx.delete(equipmentRequests);
        await tx.delete(equipmentReturns);
        await tx.delete(movements);
        await tx.delete(sourceRecords);
        await tx.delete(auditRecords);
        await tx.delete(auditImports);
        if (scope === "all") {
          await tx.delete(productIdentifiers);
          await tx.delete(products);
          await tx.delete(coordinators);
          await tx.delete(suppliers);
        }
      });
      return Response.json({ ok: true, scope, cleaned: true });
    }

    if (payload.action === "supplier") {
      const supplierPayload = payload as SupplierInput;
      const documentNumber = normalizeDocumentNumber(supplierPayload.documentNumber);
      const businessName = normalizeParty(supplierPayload.businessName);
      if (!validSupplierDocument(documentNumber)) {
        return Response.json({ error: "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos." }, { status: 400 });
      }
      if (!businessName) return Response.json({ error: "La razón social o nombre completo es obligatorio." }, { status: 400 });
      const values = {
        documentType: documentNumber.length === 11 ? "RUC" as const : "DNI" as const,
        documentNumber,
        businessName,
        tradeName: normalizeParty(supplierPayload.tradeName),
        source: "MANUAL",
        active: supplierPayload.active !== false,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      const [supplier] = await db.insert(suppliers).values(values)
        .onConflictDoUpdate({ target: suppliers.documentNumber, set: values })
        .returning();
      return Response.json({ ok: true, supplier }, { status: 201 });
    }

    if (payload.action === "supplierBulk") {
      const rows = Array.isArray((payload as SupplierBulkInput).rows) ? (payload as SupplierBulkInput).rows!.slice(0, 1000) : [];
      let imported = 0;
      const rejected: Array<{ row: number; sku: string; reason: string }> = [];
      for (const [index, row] of rows.entries()) {
        const documentNumber = normalizeDocumentNumber(rowValue(row, "RUC", "DNI", "RUC/DNI", "Documento", "N° Documento", "Numero Documento"));
        const businessName = normalizeParty(rowValue(row, "Razón Social o Nombre Completo", "Razón Social", "Razon Social", "Nombre Completo", "Nombre", "Proveedor", "Contrata"));
        if (!validSupplierDocument(documentNumber) || !businessName) {
          rejected.push({ row: index + 2, sku: documentNumber || "—", reason: "Falta RUC/DNI válido o razón social." });
          continue;
        }
        const values = {
          documentType: documentNumber.length === 11 ? "RUC" as const : "DNI" as const,
          documentNumber,
          businessName,
          tradeName: normalizeParty(rowValue(row, "Nombre Comercial", "Nombre de Fantasía")),
          source: "CARGA_MASIVA",
          active: true,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        };
        await db.insert(suppliers).values(values).onConflictDoUpdate({ target: suppliers.documentNumber, set: values });
        imported += 1;
      }
      return Response.json({ ok: true, imported, rejected: rejected.length, rejectionDetails: rejected.slice(0, 25) }, { status: 201 });
    }

    if (payload.action === "coordinatorBulk") {
      const rows = Array.isArray((payload as CoordinatorBulkInput).rows) ? (payload as CoordinatorBulkInput).rows!.slice(0, 1000) : [];
      let imported = 0;
      const rejected: Array<{ row: number; sku: string; reason: string }> = [];
      for (const [index, row] of rows.entries()) {
        const organization = normalizeParty(rowValue(row, "Empresa", "Organización", "Organizacion")).includes("F1") ? "F1" as const : "ENTEL" as const;
        const name = normalizeParty(rowValue(row, "Nombre", "Coordinador", "Nombre completo"));
        const email = clean(rowValue(row, "Correo", "Email")).toLowerCase();
        const status = normalizeParty(rowValue(row, "Estado", "Activo"));
        if (!name) {
          rejected.push({ row: index + 2, sku: "—", reason: "Falta el nombre del coordinador." });
          continue;
        }
        const values = { organization, name, email, active: !["INACTIVO", "NO", "0", "FALSE"].includes(status) };
        await db.insert(coordinators).values(values)
          .onConflictDoUpdate({ target: [coordinators.organization, coordinators.name], set: { email, active: values.active } });
        imported += 1;
      }
      return Response.json({ ok: true, imported, rejected: rejected.length, rejectionDetails: rejected.slice(0, 25) }, { status: 201 });
    }

    if (payload.action === "equipmentReturnEvidenceUpload") {
      const uploadPayload = payload as EquipmentReturnEvidenceUploadInput;
      const evidence = normalizeEvidenceImage(uploadPayload.evidenceImage);
      if (!evidence) return Response.json({ error: "Selecciona una fotografía válida." }, { status: 400 });
      const folderKey = normalizeEquipmentIdentifier(uploadPayload.folderKey).slice(0, 60) || crypto.randomUUID();
      const kind = lotTokenPart(uploadPayload.kind, "evidencia").toLowerCase();
      const storedImage = await storeEvidenceImage(evidence, `devoluciones/temporales/${folderKey}/${kind}`);
      return Response.json({ ok: true, storedImage, imageUrl: await resolveEvidenceImage(storedImage) }, { status: 201 });
    }

    if (payload.action === "equipmentReturnBatchCreate") {
      const batchPayload = payload as EquipmentReturnBatchCreateInput;
      const coordinatorF1 = normalizeParty(batchPayload.coordinatorF1);
      const orderNumber = clean(batchPayload.orderNumber).toUpperCase();
      const returnDate = normalizeKardexDate(batchPayload.returnDate);
      const site = normalizeParty(batchPayload.site);
      const warehouse = normalizeParty(batchPayload.warehouse) || "RED";
      const comments = clean(batchPayload.comments);
      const requestedRows = Array.isArray(batchPayload.rows) ? batchPayload.rows : [];
      if (requestedRows.length > 100) {
        return Response.json({ error: `La carga contiene ${requestedRows.length} filas. El máximo permitido por site es 100.` }, { status: 400 });
      }
      const batchRows = requestedRows;
      if (!coordinatorF1 || !returnDate || !site || !batchRows.length) {
        return Response.json({ error: "Selecciona Coordinador F1, fecha de devolución, site y agrega al menos una fila." }, { status: 400 });
      }
      const [coordinator] = await db.select().from(coordinators).where(and(
        eq(coordinators.organization, "F1"),
        eq(coordinators.name, coordinatorF1),
        eq(coordinators.active, true),
      )).limit(1);
      if (!coordinator) return Response.json({ error: "Selecciona un Coordinador F1 activo." }, { status: 400 });

      const normalizedRows = batchRows.map((row, index) => ({
        input: row,
        item: index + 1,
        productId: Number(row.productId),
        serial: clean(row.serial).toUpperCase(),
        serialKey: normalizeEquipmentIdentifier(row.serial),
        itemType: normalizeParty(row.itemType),
        partNumber: clean(row.partNumber).toUpperCase(),
        normalizedPartNumber: normalizeEquipmentIdentifier(row.partNumber),
        quantity: Math.max(1, Math.min(100_000, Math.round(Number(row.quantity) || 1))),
      }));
      const repeatedSerials = new Set<string>();
      const seenSerials = new Set<string>();
      normalizedRows.forEach((row) => {
        if (seenSerials.has(row.serialKey)) repeatedSerials.add(row.serialKey);
        seenSerials.add(row.serialKey);
      });
      const invalidRow = normalizedRows.find((row) => !row.productId || row.serialKey.length < 5 || repeatedSerials.has(row.serialKey));
      if (invalidRow) {
        const reason = repeatedSerials.has(invalidRow.serialKey) ? "la serie/lote está repetida en esta carga" : "falta SKU o Serie/Lote válido";
        return Response.json({ error: `Fila ${invalidRow.item}: ${reason}.` }, { status: 400 });
      }
      const invalidTypeRow = normalizedRows.find((row) => !["EQUIPO", "LOTE"].includes(row.itemType));
      if (invalidTypeRow) return Response.json({ error: `Fila ${invalidTypeRow.item}: selecciona si corresponde a EQUIPO o LOTE.` }, { status: 400 });
      const invalidEquipmentQuantity = normalizedRows.find((row) => row.itemType === "EQUIPO" && row.quantity !== 1);
      if (invalidEquipmentQuantity) return Response.json({ error: `Fila ${invalidEquipmentQuantity.item}: un equipo seriado debe tener cantidad 1. Usa LOTE si la identificación agrupa varias unidades.` }, { status: 400 });

      const productIds = [...new Set(normalizedRows.map((row) => row.productId))];
      const productRows = await db.select().from(products).where(inArray(products.id, productIds));
      const productById = new Map(productRows.map((product) => [product.id, product]));
      const missingProduct = normalizedRows.find((row) => !productById.has(row.productId));
      if (missingProduct) return Response.json({ error: `Fila ${missingProduct.item}: el SKU seleccionado ya no existe.` }, { status: 404 });

      const activeReturnRows = await db.select().from(equipmentReturns).where(inArray(equipmentReturns.serialKey, normalizedRows.map((row) => row.serialKey)));
      const activeReturn = activeReturnRows.find((row) => !["RECIBIDA_FISICA", "RECHAZADA"].includes(row.status));
      if (activeReturn) return Response.json({ error: `La serie/lote ${activeReturn.serial} ya tiene una devolución activa.` }, { status: 409 });

      const historicalMovements = await Promise.all(normalizedRows.map(async (row) => {
        const candidates = await db.select().from(movements)
          .where(sql`regexp_replace(upper(${movements.serials}), '[^A-Z0-9]', '', 'g') LIKE ${`%${row.serialKey}%`}`)
          .orderBy(desc(movements.id))
          .limit(100);
        const exact = candidates.filter((movement) => splitSeries(movement.serials).some((token) => normalizeEquipmentIdentifier(token) === row.serialKey));
        return exact.find((movement) => ["salida", "baja"].includes(movement.type)) ?? exact[0] ?? null;
      }));
      for (const [index, historical] of historicalMovements.entries()) {
        if (historical && historical.productId !== normalizedRows[index].productId) {
          const historicalProduct = productById.get(historical.productId)
            ?? (await db.select().from(products).where(eq(products.id, historical.productId)).limit(1))[0];
          return Response.json({ error: `Fila ${index + 1}: la serie pertenece históricamente al SKU ${historicalProduct?.sku || historical.productId}.` }, { status: 409 });
        }
      }

      for (const row of normalizedRows) {
        if (!row.input.rememberIdentifier || row.normalizedPartNumber.length < 5) continue;
        const [existingIdentifier] = await db.select().from(productIdentifiers)
          .where(eq(productIdentifiers.normalizedIdentifier, row.normalizedPartNumber)).limit(1);
        if (existingIdentifier && existingIdentifier.productId !== row.productId) {
          const mappedProduct = productById.get(existingIdentifier.productId)
            ?? (await db.select().from(products).where(eq(products.id, existingIdentifier.productId)).limit(1))[0];
          return Response.json({ error: `Fila ${row.item}: el part number ${row.partNumber} ya está relacionado con ${mappedProduct?.sku || "otro SKU"}.` }, { status: 409 });
        }
      }

      const sequenceRows = await db.execute<{ returnSequence: string }>(sql`select nextval('equipment_return_code_seq')::text as "returnSequence"`);
      const returnSequence = Number(sequenceRows[0]?.returnSequence);
      if (!Number.isFinite(returnSequence)) return Response.json({ error: "No se pudo generar el número F1 de devolución." }, { status: 500 });
      const returnCodeDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()).replaceAll("-", "");
      const batchCode = `DEV-F1-${returnCodeDate}-${String(returnSequence).padStart(6, "0")}`;
      const createdBy = access.displayName || user.displayName || user.email;
      const matchMethods = ["HISTORIAL_SERIE", "PART_NUMBER_GUARDADO", "PART_NUMBER_DESCRIPCION", "SKU_VISIBLE", "MANUAL"];

      const preparedRows = await Promise.all(normalizedRows.map(async (row, index) => {
        const input = row.input;
        const product = productById.get(row.productId)!;
        const imageFolder = `devoluciones/${batchCode}/${String(row.item).padStart(3, "0")}`;
        const [evidenceImage, entelLabelImage, modelImage, panoramicImage] = await Promise.all([
          storeEvidenceImage(normalizeEvidenceImage(input.evidenceImage), `${imageFolder}/serie`),
          storeEvidenceImage(normalizeEvidenceImage(input.entelLabelImage), `${imageFolder}/etiqueta-entel`),
          storeEvidenceImage(normalizeEvidenceImage(input.modelImage), `${imageFolder}/modelo`),
          storeEvidenceImage(normalizeEvidenceImage(input.panoramicImage), `${imageFolder}/panoramica`),
        ]);
        const historical = historicalMovements[index];
        return {
          returnCode: `${batchCode}-${String(row.item).padStart(3, "0")}`,
          batchCode,
          batchItem: row.item,
          productId: product.id,
          coordinatorId: coordinator.id,
          sourceMovementId: historical?.id || Number(input.sourceMovementId) || null,
          coordinatorF1: coordinator.name,
          orderNumber: orderNumber || historical?.orderNumber || "",
          returnDate,
          site,
          warehouse,
          batchComments: comments,
          networkComponent: clean(input.networkComponent),
          subProject: clean(input.subProject),
          sourceProject: clean(input.sourceProject),
          hardwareTask: clean(input.hardwareTask),
          serial: row.serial,
          serialKey: row.serialKey,
          itemType: row.itemType as "EQUIPO" | "LOTE",
          quantity: row.quantity,
          length: clean(input.length),
          condition: normalizeParty(input.condition) || "USADO OPERATIVO",
          volumeM3: clean(input.volumeM3),
          detectedPartNumber: row.partNumber,
          skuSnapshot: product.sku,
          descriptionSnapshot: product.description,
          matchMethod: historical ? "HISTORIAL_SERIE" : matchMethods.includes(clean(input.matchMethod)) ? clean(input.matchMethod) : "MANUAL",
          matchConfidence: historical ? 100 : Math.min(100, Math.max(0, Math.round(Number(input.matchConfidence) || 0))),
          rawOcrText: clean(input.rawOcrText).slice(0, 12_000),
          evidenceImage,
          entelLabelImage,
          modelImage,
          panoramicImage,
          status: "PENDIENTE_APROBACION" as const,
          createdBy,
          notes: clean(input.notes),
        };
      }));

      const created = await db.transaction(async (tx) => {
        const inserted = await tx.insert(equipmentReturns).values(preparedRows).returning();
        for (const row of normalizedRows) {
          if (!row.input.rememberIdentifier || row.normalizedPartNumber.length < 5) continue;
          await tx.insert(productIdentifiers).values({
            productId: row.productId,
            identifier: row.partNumber,
            normalizedIdentifier: row.normalizedPartNumber,
            active: true,
            createdBy,
          }).onConflictDoUpdate({
            target: productIdentifiers.normalizedIdentifier,
            set: { identifier: row.partNumber, active: true, updatedAt: sql`CURRENT_TIMESTAMP` },
          });
        }
        return inserted;
      });
      return Response.json({ ok: true, batchCode, rows: created.length }, { status: 201 });
    }

    if (payload.action === "equipmentReturnBatchStatus") {
      const statusPayload = payload as EquipmentReturnBatchStatusInput;
      const batchCode = clean(statusPayload.batchCode).toUpperCase();
      const allowed: EquipmentReturnStatus[] = ["PENDIENTE_APROBACION", "OBSERVADA", "APROBADA_PENDIENTE_RECEPCION", "RECIBIDA_FISICA", "RECHAZADA"];
      const status = allowed.includes(statusPayload.status as EquipmentReturnStatus) ? statusPayload.status as EquipmentReturnStatus : undefined;
      if (!batchCode || !status) return Response.json({ error: "Carga de sitio o estado inválido." }, { status: 400 });
      const records = await db.select().from(equipmentReturns).where(eq(equipmentReturns.batchCode, batchCode)).orderBy(equipmentReturns.batchItem);
      if (!records.length) return Response.json({ error: "La carga de sitio ya no existe." }, { status: 404 });
      const notes = clean(statusPayload.notes);
      if (status === "OBSERVADA" && !notes) return Response.json({ error: "Escribe la observación que debe corregirse." }, { status: 400 });
      const operator = access.displayName || user.displayName || user.email;

      if (status === "RECIBIDA_FISICA") {
        if (records.some((record) => record.status !== "APROBADA_PENDIENTE_RECEPCION")) {
          return Response.json({ error: "Primero debes aprobar todas las filas de la carga del sitio." }, { status: 409 });
        }
        const receipts = Array.isArray(statusPayload.receipts) ? statusPayload.receipts : [];
        const receiptById = new Map(receipts.map((receipt) => [Number(receipt.returnId), receipt]));
        const missingReceipt = records.find((record) => !receiptById.has(record.id));
        if (missingReceipt) return Response.json({ error: `Falta completar el ingreso de la fila ${missingReceipt.batchItem}.` }, { status: 400 });
        const productIds = [...new Set(records.map((record) => record.productId))];
        const [productRows, existingMovements, entelCosts] = await Promise.all([
          db.select().from(products).where(inArray(products.id, productIds)),
          db.select().from(movements).where(inArray(movements.productId, productIds)),
          latestEntelUnitCosts(db),
        ]);
        const productById = new Map(productRows.map((product) => [product.id, product]));
        for (const record of records) {
          const product = productById.get(record.productId);
          if (!product) return Response.json({ error: `El SKU ${record.skuSnapshot} ya no existe.` }, { status: 404 });
          const serialBalance = existingMovements.reduce((total, movement) => {
            if (movement.productId !== record.productId) return total;
            const contains = splitSeries(movement.serials).some((token) => normalizeEquipmentIdentifier(token) === record.serialKey);
            return contains ? total + stockEffect(movement.type) * (splitSeries(movement.serials).length > 1 ? 1 : movement.quantity) : total;
          }, 0);
          if (serialBalance > 0) return Response.json({ error: `La serie/lote ${record.serial} ya figura disponible en stock.` }, { status: 409 });
        }

        const movementDateFallback = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
        await db.transaction(async (tx) => {
          for (const record of records) {
            const receipt = receiptById.get(record.id)!;
            const product = productById.get(record.productId)!;
            const movementDate = normalizeKardexDate(receipt.movementDate, movementDateFallback);
            const document = clean(receipt.document).toUpperCase() || batchCode;
            const receiptOrderNumber = clean(receipt.orderNumber).toUpperCase() || record.orderNumber;
            const project = clean(receipt.project).toUpperCase() || product.defaultProject;
            const origin = clean(receipt.origin).toUpperCase() || "DESINSTALACIÓN DE SITIO";
            const coordinatorEntel = clean(receipt.coordinatorEntel).toUpperCase();
            const originSite = clean(receipt.originSite).toUpperCase() || record.site;
            const stockLocation = normalizeStockLocation(receipt.stockLocation);
            const unitMeasure = clean(receipt.unitMeasure).toUpperCase() || product.unit || "UND";
            const equipmentStatus = clean(receipt.equipmentStatus).toUpperCase() || "USADO";
            const condition = clean(receipt.condition).toUpperCase() || record.condition || "OPERATIVO";
            const requestedCostCents = Math.max(0, Math.round(Number(receipt.unitCost) * 100 || 0));
            const unitCostCents = requestedCostCents || product.unitCostCents || entelCosts.get(product.sku.toUpperCase()) || 0;
            const [stockMovement] = await tx.insert(movements).values({
              productId: product.id,
              type: "desinstalacion",
              quantity: record.quantity,
              movementDate,
              document,
              project,
              coordinator: coordinatorEntel,
              coordinatorF1: record.coordinatorF1,
              serials: record.serial,
              lotAssignment: "ORIGINAL",
              sourceRow: record.returnCode,
              originSite,
              stockLocation,
              unitMeasure,
              unitCostCents,
              equipmentType: record.itemType || product.category,
              loadGr: document,
              grLink: normalizeGrLink(receipt.grLink),
              orderNumber: receiptOrderNumber,
              equipmentStatus,
              condition,
              origin,
              owner: product.owner,
              recordStatus: "Disponible",
              registeredBy: operator,
              notes: `Desinstalación recibida desde ${record.returnCode}${clean(receipt.notes) ? ` · ${clean(receipt.notes)}` : ""}`,
            }).returning();
            await tx.update(equipmentReturns).set({
              status: "RECIBIDA_FISICA",
              stockMovementId: stockMovement.id,
              physicallyReceivedAt: sql`CURRENT_TIMESTAMP`,
              receivedBy: operator,
              receiptMovementDate: movementDate,
              receiptDocument: document,
              receiptGrLink: normalizeGrLink(receipt.grLink),
              receiptProject: project,
              receiptOrigin: origin,
              receiptCoordinatorEntel: coordinatorEntel,
              receiptOriginSite: originSite,
              receiptStockLocation: stockLocation,
              receiptUnitMeasure: unitMeasure,
              receiptEquipmentStatus: equipmentStatus,
              receiptCondition: condition,
              receiptUnitCostCents: unitCostCents,
              notes: clean(receipt.notes) || record.notes,
              updatedAt: sql`CURRENT_TIMESTAMP`,
            }).where(eq(equipmentReturns.id, record.id));
          }
        });
        return Response.json({ ok: true, batchCode, received: records.length, stockUpdated: true });
      }

      const transitionAllowed = status === "RECHAZADA"
        || status === "OBSERVADA"
        || (status === "APROBADA_PENDIENTE_RECEPCION" && records.every((record) => ["PENDIENTE_APROBACION", "OBSERVADA"].includes(record.status)));
      if (!transitionAllowed) return Response.json({ error: "Ese cambio de estado no corresponde al flujo de la carga del sitio." }, { status: 409 });
      await db.update(equipmentReturns).set({
        status,
        approvedAt: status === "APROBADA_PENDIENTE_RECEPCION" ? sql`CURRENT_TIMESTAMP` : records[0].approvedAt,
        approvedBy: status === "APROBADA_PENDIENTE_RECEPCION" ? operator : records[0].approvedBy,
        notes: notes || records[0].notes,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(equipmentReturns.batchCode, batchCode));
      return Response.json({ ok: true, batchCode, updated: records.length });
    }

    if (payload.action === "equipmentReturnCreate") {
      const returnPayload = payload as EquipmentReturnCreateInput;
      const productId = Number(returnPayload.productId);
      const serial = clean(returnPayload.serial).toUpperCase();
      const serialKey = normalizeEquipmentIdentifier(serial);
      const partNumber = clean(returnPayload.partNumber).toUpperCase();
      const normalizedPartNumber = normalizeEquipmentIdentifier(partNumber);
      const coordinatorF1 = normalizeParty(returnPayload.coordinatorF1);
      const orderNumber = clean(returnPayload.orderNumber).toUpperCase();
      const evidence = normalizeEvidenceImage(returnPayload.evidenceImage);
      if (!productId || serialKey.length < 5 || !coordinatorF1 || !evidence) {
        return Response.json({ error: "Foto, serie, SKU y Coordinador F1 son obligatorios para la carga lógica." }, { status: 400 });
      }
      const [[product], [coordinator], activeReturns, serialMovementCandidates] = await Promise.all([
        db.select().from(products).where(eq(products.id, productId)).limit(1),
        db.select().from(coordinators).where(and(eq(coordinators.organization, "F1"), eq(coordinators.name, coordinatorF1), eq(coordinators.active, true))).limit(1),
        db.select().from(equipmentReturns).where(eq(equipmentReturns.serialKey, serialKey)),
        db.select().from(movements).where(sql`regexp_replace(upper(${movements.serials}), '[^A-Z0-9]', '', 'g') LIKE ${`%${serialKey}%`}`).orderBy(desc(movements.id)).limit(100),
      ]);
      if (!product) return Response.json({ error: "El SKU seleccionado ya no existe." }, { status: 404 });
      if (!coordinator) return Response.json({ error: "Selecciona un Coordinador F1 activo." }, { status: 400 });
      if (activeReturns.some((row) => !["RECIBIDA_FISICA", "RECHAZADA"].includes(row.status))) {
        return Response.json({ error: `La serie ${serial} ya tiene una devolución activa.` }, { status: 409 });
      }
      const exactHistoricalMovements = serialMovementCandidates.filter((movement) => splitSeries(movement.serials).some((token) => normalizeEquipmentIdentifier(token) === serialKey));
      const historicalMovement = exactHistoricalMovements.find((movement) => ["salida", "baja"].includes(movement.type)) ?? exactHistoricalMovements[0];
      if (historicalMovement && historicalMovement.productId !== product.id) {
        const [historicalProduct] = await db.select().from(products).where(eq(products.id, historicalMovement.productId)).limit(1);
        return Response.json({ error: `La serie ${serial} pertenece históricamente al SKU ${historicalProduct?.sku || historicalMovement.productId}. Revisa la selección.` }, { status: 409 });
      }
      if (returnPayload.rememberIdentifier && normalizedPartNumber.length >= 5) {
        const [existingIdentifier] = await db.select().from(productIdentifiers).where(eq(productIdentifiers.normalizedIdentifier, normalizedPartNumber)).limit(1);
        if (existingIdentifier && existingIdentifier.productId !== product.id) {
          const [mappedProduct] = await db.select().from(products).where(eq(products.id, existingIdentifier.productId)).limit(1);
          return Response.json({ error: `El part number ${partNumber} ya está relacionado con ${mappedProduct?.sku || "otro SKU"}. Desmarca “Recordar relación” o corrige el dato.` }, { status: 409 });
        }
      }
      const sequenceRows = await db.execute<{ returnSequence: string }>(sql`select nextval('equipment_return_code_seq')::text as "returnSequence"`);
      const returnSequence = Number(sequenceRows[0]?.returnSequence);
      if (!Number.isFinite(returnSequence)) return Response.json({ error: "No se pudo generar el código de devolución." }, { status: 500 });
      const returnDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()).replaceAll("-", "");
      const returnCode = `DEV-F1-${returnDate}-${String(returnSequence).padStart(6, "0")}`;
      const storedEvidence = await storeEvidenceImage(evidence, `devoluciones/${returnCode}/etiqueta`);
      const createdBy = access.displayName || user.displayName || user.email;
      const matchMethods = ["HISTORIAL_SERIE", "PART_NUMBER_GUARDADO", "PART_NUMBER_DESCRIPCION", "SKU_VISIBLE", "MANUAL"];
      const [created] = await db.transaction(async (tx) => {
        const rows = await tx.insert(equipmentReturns).values({
          returnCode,
          productId: product.id,
          coordinatorId: coordinator.id,
          sourceMovementId: historicalMovement?.id || Number(returnPayload.sourceMovementId) || null,
          coordinatorF1: coordinator.name,
          orderNumber: orderNumber || historicalMovement?.orderNumber || "",
          serial,
          serialKey,
          detectedPartNumber: partNumber,
          skuSnapshot: product.sku,
          descriptionSnapshot: product.description,
          matchMethod: historicalMovement ? "HISTORIAL_SERIE" : matchMethods.includes(clean(returnPayload.matchMethod)) ? clean(returnPayload.matchMethod) : "MANUAL",
          matchConfidence: historicalMovement ? 100 : Math.min(100, Math.max(0, Math.round(Number(returnPayload.matchConfidence) || 0))),
          rawOcrText: clean(returnPayload.rawOcrText).slice(0, 12_000),
          evidenceImage: storedEvidence,
          status: "PENDIENTE_APROBACION",
          createdBy,
          notes: clean(returnPayload.notes),
        }).returning();
        if (returnPayload.rememberIdentifier && normalizedPartNumber.length >= 5) {
          await tx.insert(productIdentifiers).values({
            productId: product.id,
            identifier: partNumber,
            normalizedIdentifier: normalizedPartNumber,
            active: true,
            createdBy,
          }).onConflictDoUpdate({
            target: productIdentifiers.normalizedIdentifier,
            set: { identifier: partNumber, active: true, updatedAt: sql`CURRENT_TIMESTAMP` },
          });
        }
        return rows;
      });
      return Response.json({ ok: true, returnCode, equipmentReturn: created }, { status: 201 });
    }

    if (payload.action === "equipmentReturnStatus") {
      const statusPayload = payload as EquipmentReturnStatusInput;
      const returnId = Number(statusPayload.returnId);
      const allowed: EquipmentReturnStatus[] = ["PENDIENTE_APROBACION", "OBSERVADA", "APROBADA_PENDIENTE_RECEPCION", "RECIBIDA_FISICA", "RECHAZADA"];
      const status = allowed.includes(statusPayload.status as EquipmentReturnStatus) ? statusPayload.status as EquipmentReturnStatus : undefined;
      if (!returnId || !status) return Response.json({ error: "Devolución o estado inválido." }, { status: 400 });
      const [record] = await db.select().from(equipmentReturns).where(eq(equipmentReturns.id, returnId)).limit(1);
      if (!record) return Response.json({ error: "La devolución ya no existe." }, { status: 404 });
      if (record.status === "RECIBIDA_FISICA") return Response.json({ error: "La recepción física ya fue confirmada y no puede repetirse." }, { status: 409 });
      const notes = clean(statusPayload.notes);
      if (status === "OBSERVADA" && !notes) return Response.json({ error: "Escribe la observación que debe corregirse." }, { status: 400 });
      const operator = access.displayName || user.displayName || user.email;
      if (status === "RECIBIDA_FISICA") {
        if (record.status !== "APROBADA_PENDIENTE_RECEPCION") return Response.json({ error: "Primero debes aprobar la carga lógica." }, { status: 409 });
        const [product] = await db.select().from(products).where(eq(products.id, record.productId)).limit(1);
        if (!product) return Response.json({ error: "El SKU relacionado ya no existe." }, { status: 404 });
        const existing = await db.select().from(movements).where(eq(movements.productId, product.id));
        const serialBalance = existing.reduce((total, movement) => {
          const contains = splitSeries(movement.serials).some((token) => normalizeEquipmentIdentifier(token) === record.serialKey);
          if (!contains) return total;
          return total + stockEffect(movement.type) * (splitSeries(movement.serials).length > 1 ? 1 : movement.quantity);
        }, 0);
        if (serialBalance > 0) return Response.json({ error: `La serie ${record.serial} ya figura disponible en el stock. No se duplicó el ingreso.` }, { status: 409 });
        const entelCostCents = (await latestEntelUnitCosts(db)).get(product.sku.toUpperCase()) || 0;
        const movementDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
        const updated = await db.transaction(async (tx) => {
          const [stockMovement] = await tx.insert(movements).values({
            productId: product.id,
            type: "devolucion",
            quantity: 1,
            movementDate,
            document: record.returnCode,
            project: product.defaultProject,
            coordinatorF1: record.coordinatorF1,
            serials: record.serial,
            lotAssignment: "ORIGINAL",
            stockLocation: "MO COMPANY",
            unitMeasure: product.unit,
            unitCostCents: product.unitCostCents || entelCostCents,
            equipmentType: product.category,
            orderNumber: record.orderNumber,
            equipmentStatus: "DEVOLUCIÓN",
            condition: "OPERATIVO",
            origin: "CAMPO / COORDINADOR F1",
            owner: product.owner,
            recordStatus: "Disponible",
            registeredBy: operator,
            notes: `Recepción física desde ${record.returnCode}${notes ? ` · ${notes}` : ""}`,
          }).returning();
          const [returnRecord] = await tx.update(equipmentReturns).set({
            status: "RECIBIDA_FISICA",
            stockMovementId: stockMovement.id,
            physicallyReceivedAt: sql`CURRENT_TIMESTAMP`,
            receivedBy: operator,
            notes,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          }).where(eq(equipmentReturns.id, record.id)).returning();
          return returnRecord;
        });
        return Response.json({ ok: true, equipmentReturn: updated, stockUpdated: true });
      }
      const transitionAllowed = status === "RECHAZADA"
        || status === "OBSERVADA"
        || (status === "APROBADA_PENDIENTE_RECEPCION" && ["PENDIENTE_APROBACION", "OBSERVADA"].includes(record.status));
      if (!transitionAllowed) return Response.json({ error: "Ese cambio de estado no corresponde al flujo de devolución." }, { status: 409 });
      const [updated] = await db.update(equipmentReturns).set({
        status,
        approvedAt: status === "APROBADA_PENDIENTE_RECEPCION" ? sql`CURRENT_TIMESTAMP` : record.approvedAt,
        approvedBy: status === "APROBADA_PENDIENTE_RECEPCION" ? operator : record.approvedBy,
        notes,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(equipmentReturns.id, record.id)).returning();
      return Response.json({ ok: true, equipmentReturn: updated });
    }

    if (payload.action === "request") {
      const requestPayload = payload as EquipmentRequestInput;
      const coordinatorName = access.role === "COORDINADOR"
        ? normalizeParty(assignedCoordinator?.name)
        : clean(requestPayload.coordinatorName).toUpperCase();
      const coordinatorEntel = clean(requestPayload.coordinatorEntel).toUpperCase();
      const orderNumber = clean(requestPayload.orderNumber);
      const contractorRuc = clean(requestPayload.contractorRuc).replace(/\D/g, "");
      const contractorMatch = await supplierFromDocument(db, contractorRuc);
      const contractorBusinessName = contractorMatch?.businessName || "";
      const pickupPersonDni = normalizeDocumentNumber(requestPayload.pickupPersonDni);
      const pickupPersonMatch = await supplierFromDocument(db, pickupPersonDni);
      const pickupPerson = pickupPersonMatch?.businessName || "";
      const pickupPerson2Dni = normalizeDocumentNumber(requestPayload.pickupPerson2Dni);
      const pickupPerson2Match = pickupPerson2Dni ? await supplierFromDocument(db, pickupPerson2Dni) : null;
      const pickupPerson2 = pickupPerson2Match?.businessName || "";
      const region = clean(requestPayload.region).toUpperCase();
      const city = clean(requestPayload.city).toUpperCase();
      const deliveryAddress = clean(requestPayload.deliveryAddress).toUpperCase();
      const transport = clean(requestPayload.transport).toUpperCase();
      const neededDate = normalizeKardexDate(requestPayload.neededDate);
      const items = Array.isArray(requestPayload.items) ? requestPayload.items.slice(0, 30) : [];
      if (!coordinatorName || !coordinatorEntel || !orderNumber || !items.length) {
        return Response.json({ error: "Coordinador F1, Coordinador Entel, N° Pedido y al menos un equipo son obligatorios." }, { status: 400 });
      }
      if (!/^\d{11}$/.test(contractorRuc) || !contractorMatch || contractorMatch.documentType !== "RUC") {
        return Response.json({ error: "El RUC de la contrata debe existir y estar activo en el maestro de Proveedores." }, { status: 400 });
      }
      if (!/^\d{8}$/.test(pickupPersonDni) || !pickupPersonMatch || pickupPersonMatch.documentType !== "DNI") {
        return Response.json({ error: "El DNI de la primera persona que recoge debe existir y estar activo en el maestro." }, { status: 400 });
      }
      if (pickupPerson2Dni && (!/^\d{8}$/.test(pickupPerson2Dni) || !pickupPerson2Match || pickupPerson2Match.documentType !== "DNI")) {
        return Response.json({ error: "El DNI de la segunda persona debe existir y estar activo en el maestro." }, { status: 400 });
      }
      if (!region || !city || !deliveryAddress || !transport || !neededDate) {
        return Response.json({ error: "Completa región, ciudad, dirección, transporte y fecha programada de despacho." }, { status: 400 });
      }
      const normalizedItems = items.map((item) => ({
        productId: Number(item.productId),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        seriesLot: clean(item.seriesLot).toUpperCase(),
      })).filter((item) => item.productId > 0);
      if (!normalizedItems.length) return Response.json({ error: "No se encontraron equipos válidos en la solicitud." }, { status: 400 });
      const requestedByControl = new Map<string, { productId: number; seriesLot: string; quantity: number }>();
      normalizedItems.forEach((item) => {
        const key = `${item.productId}::${item.seriesLot}`;
        const current = requestedByControl.get(key);
        requestedByControl.set(key, { ...item, quantity: (current?.quantity ?? 0) + item.quantity });
      });
      const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];
      const availableProducts = await Promise.all(uniqueProductIds.map((id) => db.select().from(products).where(eq(products.id, id)).limit(1)));
      if (availableProducts.some((rows) => !rows[0])) return Response.json({ error: "Uno de los SKU solicitados ya no existe." }, { status: 404 });
      const coordinatorMatch = access.role === "COORDINADOR" ? assignedCoordinator : (await db.select().from(coordinators).where(and(
        eq(coordinators.name, coordinatorName),
        eq(coordinators.organization, "F1"),
        eq(coordinators.active, true),
      )).limit(1))[0];
      if (!coordinatorMatch) {
        return Response.json({ error: "Selecciona un Coordinador F1 activo." }, { status: 400 });
      }
      const coordinatorEntelMatch = (await db.select().from(coordinators).where(and(
        eq(coordinators.name, coordinatorEntel),
        eq(coordinators.organization, "ENTEL"),
        eq(coordinators.active, true),
      )).limit(1))[0];
      if (!coordinatorEntelMatch) {
        return Response.json({ error: "Selecciona un Coordinador Entel activo." }, { status: 400 });
      }
      const movementRows = await db.select().from(movements);
      const reservationRows = (await db.select({
        productId: equipmentRequests.productId,
        orderNumber: equipmentRequests.orderNumber,
        seriesLot: equipmentRequests.seriesLot,
        quantity: equipmentRequests.quantity,
        status: equipmentRequests.status,
      }).from(equipmentRequests)).filter((row) => ["PENDIENTE", "VALIDADA"].includes(row.status));
      const normalizedOrder = orderNumber.toUpperCase();
      for (const item of requestedByControl.values()) {
        const { productId, requestedQuantity, seriesLot } = { productId: item.productId, requestedQuantity: item.quantity, seriesLot: item.seriesLot };
        const orderRows = movementRows.filter((row) => row.productId === productId && clean(row.orderNumber).toUpperCase() === normalizedOrder);
        const hasIngreso = orderRows.some((row) => ["entrada", "devolucion", "desinstalacion", "regularizacion"].includes(row.type));
        const physicalAvailable = seriesLot
          ? orderRows.reduce((total, row) => total + stockEffect(row.type) * trackedSeriesQuantity(row.serials, row.quantity, seriesLot), 0)
          : orderRows.filter((row) => !splitSeries(row.serials).length).reduce((total, row) => total + stockEffect(row.type) * row.quantity, 0);
        const reserved = reservationRows
          .filter((row) => row.productId === productId
            && normalizeParty(row.orderNumber) === normalizedOrder
            && normalizeParty(row.seriesLot) === normalizeParty(seriesLot))
          .reduce((total, row) => total + row.quantity, 0);
        const available = Math.max(0, physicalAvailable - reserved);
        if (!hasIngreso) return Response.json({ error: `El SKU seleccionado no tiene un ingreso asociado al pedido ${orderNumber}.` }, { status: 409 });
        if (requestedQuantity > available) return Response.json({ error: `Stock insuficiente para ${seriesLot || "stock sin serie/lote"} del pedido ${orderNumber}. Disponible: ${Math.max(0, available)}.` }, { status: 409 });
      }
      const sequenceRows = await db.execute<{ requestSequence: string }>(sql`select nextval('equipment_request_code_seq')::text as "requestSequence"`);
      const requestSequence = Number(sequenceRows[0]?.requestSequence);
      if (!Number.isFinite(requestSequence)) return Response.json({ error: "No se pudo generar el código del Pedido F1." }, { status: 500 });
      const requestDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date()).replaceAll("-", "");
      const requestCode = `PED-F1-${requestDate}-${String(requestSequence).padStart(6, "0")}`;
      const created = await db.insert(equipmentRequests).values([...requestedByControl.values()].map(({ productId, quantity, seriesLot }) => ({
        requestCode,
        coordinatorId: coordinatorMatch?.id ?? null,
        coordinatorName,
        coordinatorEmail: access.role === "COORDINADOR" ? coordinatorMatch?.email || "" : clean(requestPayload.coordinatorEmail).toLowerCase() || coordinatorMatch?.email || "",
        coordinatorEntel,
        orderNumber,
        project: clean(requestPayload.project),
        site: clean(requestPayload.site),
        warehouse: "MO Company",
        productId,
        quantity,
        seriesLot,
        contractorRuc,
        contractorBusinessName,
        pickupPersonDni,
        pickupPerson,
        pickupPerson2Dni,
        pickupPerson2,
        region,
        city,
        deliveryAddress,
        transport,
        neededDate,
        notes: clean(requestPayload.notes),
      }))).returning();
      return Response.json({ ok: true, requestCode, requested: created.length }, { status: 201 });
    }

    if (payload.action === "requestStatus") {
      const statusPayload = payload as RequestStatusInput;
      const requestId = Number(statusPayload.requestId);
      const allowed = ["PENDIENTE", "VALIDADA", "DESPACHADA", "EN_TRANSITO", "LISTA_RECOJO", "RECOGIDA", "CERRADA", "RECHAZADA"] as const;
      const status = allowed.includes(statusPayload.status as typeof allowed[number]) ? statusPayload.status : undefined;
      if (!requestId || !status) return Response.json({ error: "Solicitud o estado inválido." }, { status: 400 });
      const [updated] = await db.update(equipmentRequests).set({
        status,
        closedAt: status === "CERRADA" ? sql`COALESCE(NULLIF(${equipmentRequests.closedAt}, ''), CURRENT_TIMESTAMP::text)` : "",
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(equipmentRequests.id, requestId)).returning();
      if (!updated) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      return Response.json({ ok: true, request: updated });
    }

    if (payload.action === "requestLogistics") {
      const logisticsPayload = payload as RequestLogisticsInput;
      const requestCode = clean(logisticsPayload.requestCode);
      const allowed: RequestStatus[] = ["PENDIENTE", "VALIDADA", "DESPACHADA", "EN_TRANSITO", "LISTA_RECOJO", "RECOGIDA", "CERRADA", "RECHAZADA"];
      const status = allowed.includes(logisticsPayload.status as RequestStatus) ? logisticsPayload.status as RequestStatus : "PENDIENTE";
      if (!requestCode) return Response.json({ error: "La solicitud es obligatoria." }, { status: 400 });
      const outboundGuidePhoto = logisticsPayload.outboundGuidePhoto === undefined
        ? undefined
        : await storeEvidenceImage(normalizeEvidenceImage(logisticsPayload.outboundGuidePhoto), `${requestCode}/gr-despacho`);
      const shippingTicketPhoto = logisticsPayload.shippingTicketPhoto === undefined
        ? undefined
        : await storeEvidenceImage(normalizeEvidenceImage(logisticsPayload.shippingTicketPhoto), `${requestCode}/ticket-envio`);
      const updated = await db.update(equipmentRequests).set({
        status,
        outboundGuide: clean(logisticsPayload.outboundGuide),
        outboundGuideLink: normalizeGrLink(logisticsPayload.outboundGuideLink),
        outboundGuidePhoto,
        shippingTicket: clean(logisticsPayload.shippingTicket),
        shippingTicketPhoto,
        shippingKey: clean(logisticsPayload.shippingKey),
        sentDate: normalizeKardexDate(logisticsPayload.sentDate),
        arrivalDate: normalizeKardexDate(logisticsPayload.arrivalDate),
        pickupDate: normalizeKardexDate(logisticsPayload.pickupDate),
        deliveryAddress: logisticsPayload.deliveryAddress === undefined ? undefined : clean(logisticsPayload.deliveryAddress).toUpperCase(),
        transport: logisticsPayload.transport === undefined ? undefined : clean(logisticsPayload.transport).toUpperCase(),
        closedAt: status === "CERRADA" ? sql`COALESCE(NULLIF(${equipmentRequests.closedAt}, ''), CURRENT_TIMESTAMP::text)` : "",
        logisticsNotes: clean(logisticsPayload.logisticsNotes),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(equipmentRequests.requestCode, requestCode)).returning();
      if (!updated.length) return Response.json({ error: "Solicitud no encontrada." }, { status: 404 });
      return Response.json({ ok: true, updated: updated.length });
    }

    if (payload.action === "auditImport") {
      const auditPayload = payload as AuditImportInput;
      const source = auditPayload.source === "ORACLE" ? "ORACLE" : "ENTEL";
      const fileName = clean(auditPayload.fileName);
      const contractor = clean(auditPayload.contractor) || "F1 SERVICES";
      const rows = Array.isArray(auditPayload.rows) ? auditPayload.rows.slice(0, 3000) : [];
      if (!fileName || !rows.length) {
        return Response.json({ error: "El archivo de auditoría no contiene filas F1 válidas." }, { status: 400 });
      }

      const normalized = rows
        .map((row) => {
          const sku = clean(row.sku).toUpperCase();
          const seriesLot = clean(row.seriesLot).toUpperCase();
          const sourceKey = clean(row.sourceKey).toUpperCase() || `${sku}::${seriesLot}`;
          return {
            source: source as "ENTEL" | "ORACLE",
            sourceKey,
            contractor: clean(row.contractor) || contractor,
            sku,
            description: clean(row.description),
            seriesLot,
            quantity: Math.max(0, Math.round(Number(row.quantity) || 0)),
            unitMeasure: clean(row.unitMeasure).toUpperCase() || "UND",
            equipmentType: clean(row.equipmentType).toUpperCase(),
            subinventory: clean(row.subinventory),
            projectCode: clean(row.projectCode),
            project: clean(row.project),
            purchaseOrder: clean(row.purchaseOrder),
            task: clean(row.task),
            requester: clean(row.requester),
            site: clean(row.site),
            totalCostCents: Math.max(0, Math.round((Number(row.totalCost) || 0) * 100)),
            warehouseEntryDate: normalizeKardexDate(row.warehouseEntryDate),
            receiptDate: normalizeKardexDate(row.receiptDate),
            orderNumber: clean(row.orderNumber),
            ageMonths: Math.max(0, Math.round(Number(row.ageMonths) || 0)),
            ageBucket: clean(row.ageBucket) || "Sin antigüedad",
            category: clean(row.category) || "Sin categoría",
          };
        })
        .filter((row) => row.sku && row.seriesLot && row.quantity >= 0);

      if (!normalized.length) {
        return Response.json({ error: "No se encontraron combinaciones válidas de SKU y Serie/Lote para F1." }, { status: 400 });
      }

      const totalQuantity = normalized.reduce((sum, row) => sum + row.quantity, 0);
      const totalCostCents = normalized.reduce((sum, row) => sum + row.totalCostCents, 0);
      const [auditImport] = await db.insert(auditImports).values({
        source,
        fileName,
        sheetName: clean(auditPayload.sheetName),
        contractor,
        cutoffDate: normalizeKardexDate(auditPayload.cutoffDate),
        rawRowCount: Math.max(0, Math.round(Number(auditPayload.rawRowCount) || normalized.length)),
        normalizedRowCount: normalized.length,
        totalQuantity,
        totalCostCents,
        status: "PROCESSING",
      }).returning();

      const statementGroups: Array<typeof normalized> = [];
      for (let index = 0; index < normalized.length; index += 3) {
        statementGroups.push(normalized.slice(index, index + 3));
      }
      for (let index = 0; index < statementGroups.length; index += 80) {
        const statements = statementGroups.slice(index, index + 80).map((group) =>
          db.insert(auditRecords).values(group.map((row) => ({ ...row, importId: auditImport.id }))),
        );
        for (const statement of statements) await statement;
      }
      await db.update(auditImports).set({ status: "READY" }).where(eq(auditImports.id, auditImport.id));

      if (source === "ENTEL") {
        const costs = auditUnitCosts(normalized);
        const updates = [];
        for (const [sku, unitCostCents] of costs) {
          const [product] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
          if (!product) continue;
          updates.push(db.update(products)
            .set({ unitCostCents })
            .where(and(eq(products.id, product.id), eq(products.unitCostCents, 0))));
          updates.push(db.update(movements)
            .set({ unitCostCents })
            .where(and(eq(movements.productId, product.id), eq(movements.unitCostCents, 0))));
        }
        for (const update of updates) await update;
      }

      return Response.json({
        ok: true,
        imported: normalized.length,
        rawRows: auditImport.rawRowCount,
        totalQuantity,
        totalCost: totalCostCents / 100,
        source,
      }, { status: 201 });
    }

    if (payload.action === "coordinator") {
      const coordinatorPayload = payload as CoordinatorInput;
      const organization = coordinatorPayload.organization === "F1" ? "F1" : "ENTEL";
      const name = clean(coordinatorPayload.name).toUpperCase();
      const email = clean(coordinatorPayload.email).toLowerCase();
      if (!name) {
        return Response.json({ error: "El nombre del coordinador es obligatorio." }, { status: 400 });
      }

      const [coordinator] = await db
        .insert(coordinators)
        .values({ organization, name, email })
        .onConflictDoUpdate({
          target: [coordinators.organization, coordinators.name],
          set: { email },
        })
        .returning();
      return Response.json({ ok: true, coordinator }, { status: 201 });
    }

    if (payload.action === "coordinatorStatus") {
      const statusPayload = payload as CoordinatorStatusInput;
      const coordinatorId = Number(statusPayload.coordinatorId);
      if (!coordinatorId || typeof statusPayload.active !== "boolean") {
        return Response.json({ error: "Coordinador o estado inválido." }, { status: 400 });
      }
      const [coordinator] = await db.update(coordinators)
        .set({ active: statusPayload.active })
        .where(eq(coordinators.id, coordinatorId))
        .returning();
      if (!coordinator) return Response.json({ error: "Coordinador no encontrado." }, { status: 404 });
      return Response.json({ ok: true, coordinator });
    }

    if (payload.action === "reconciliation") {
      const validationPayload = payload as ReconciliationInput;
      const movementId = Number(validationPayload.movementId);
      const serial = clean(validationPayload.serial).toUpperCase();
      if (!movementId) {
        return Response.json({ error: "No se encontró el movimiento de salida." }, { status: 400 });
      }

      const [movement] = await db.select().from(movements).where(eq(movements.id, movementId)).limit(1);
      if (!movement || movement.type !== "salida") {
        return Response.json({ error: "La conciliación solo se registra sobre una salida." }, { status: 400 });
      }

      const managementDate = normalizeKardexDate(validationPayload.managementDate);
      const entelReviewDate = normalizeKardexDate(validationPayload.entelReviewDate);
      const year = clean(validationPayload.year)
        || (managementDate || entelReviewDate || normalizeKardexDate(movement.movementDate)).slice(0, 4);
      const values = {
        movementId,
        serial,
        evidenceSsnn: clean(validationPayload.evidenceSsnn),
        installedSite: clean(validationPayload.installedSite),
        managementDate,
        responsible: clean(validationPayload.responsible),
        requestStatus: clean(validationPayload.requestStatus).toUpperCase() || "PENDIENTE",
        jiraRequestNumber: clean(validationPayload.jiraRequestNumber),
        reviewer: clean(validationPayload.reviewer),
        entelReviewDate,
        year,
        oracleStatus: clean(validationPayload.oracleStatus).toUpperCase() || "PENDIENTE",
        reportGrLink: clean(validationPayload.reportGrLink),
        observation: clean(validationPayload.observation),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      const [validation] = await db
        .insert(installationValidations)
        .values(values)
        .onConflictDoUpdate({
          target: [installationValidations.movementId, installationValidations.serial],
          set: values,
        })
        .returning();
      return Response.json({ ok: true, validation }, { status: 201 });
    }

    if (payload.action === "product") {
      const productPayload = payload as ProductInput;
      const sku = clean(productPayload.sku).toUpperCase();
      const description = clean(productPayload.description);
      if (!sku || !description) {
        return Response.json({ error: "SKU y descripción son obligatorios." }, { status: 400 });
      }
      const [existingProduct] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
      const requestedCostCents = Math.max(0, Math.round((Number(productPayload.unitCost) || 0) * 100));
      const entelCostCents = requestedCostCents ? 0 : (await latestEntelUnitCosts(db)).get(sku) || 0;
      const category = normalizeParty(productPayload.category).includes("LOTE") ? "LOTE" : "EQUIPO";

      const [product] = await db
        .insert(products)
        .values({
          sku,
          description,
          category,
          unit: clean(productPayload.unit).toUpperCase() || "UND",
          location: clean(productPayload.location),
          minStock: Math.max(0, Number(productPayload.minStock) || 0),
          unitCostCents: requestedCostCents || entelCostCents,
          client: clean(productPayload.client),
          owner: clean(productPayload.owner),
          defaultProject: clean(productPayload.defaultProject),
        })
        .onConflictDoUpdate({
          target: products.sku,
          set: {
            description,
            category,
            unit: clean(productPayload.unit).toUpperCase() || existingProduct?.unit || "UND",
            location: clean(productPayload.location) || existingProduct?.location || "",
            minStock: Math.max(0, Number(productPayload.minStock) || existingProduct?.minStock || 0),
            unitCostCents: requestedCostCents || existingProduct?.unitCostCents || entelCostCents,
            client: clean(productPayload.client) || existingProduct?.client || "",
            owner: clean(productPayload.owner) || existingProduct?.owner || "",
            defaultProject: clean(productPayload.defaultProject) || existingProduct?.defaultProject || "",
          },
        })
        .returning();

      const initialStock = Math.max(0, Number(productPayload.initialStock) || 0);
      if (!existingProduct && initialStock > 0) {
        await db.insert(movements).values({
          productId: product.id,
          type: "entrada",
          quantity: initialStock,
          movementDate: new Date().toISOString().slice(0, 10),
          document: "SALDO INICIAL",
          stockLocation: normalizeStockLocation(productPayload.location),
          notes: "Stock inicial al registrar el producto",
        });
      }
      return Response.json({ ok: true, product }, { status: 201 });
    }

    if (payload.action === "bulk") {
      const bulkPayload = payload as BulkInput;
      const source = clean(bulkPayload.source).toUpperCase() || "F1";
      const movementType = bulkPayload.movementType === "salida"
        ? "salida"
        : bulkPayload.movementType === "maestro"
          ? "maestro"
          : "entrada";
      const rows = Array.isArray(bulkPayload.rows) ? bulkPayload.rows.slice(0, 500) : [];
      if (!rows.length) return Response.json({ error: "El archivo no contiene filas válidas." }, { status: 400 });
      const [entelCostBySku, existingBeforeImport, supplierRows] = await Promise.all([
        latestEntelUnitCosts(db),
        db.select().from(movements),
        db.select().from(suppliers).where(eq(suppliers.active, true)),
      ]);
      const suppliersByDocument = new Map(supplierRows.map((row) => [row.documentNumber, row]));

      let imported = 0;
      const rejected: Array<{ row: number; sku: string; reason: string }> = [];
      for (const [rowIndex, row] of rows.entries()) {
        const sku = clean(rowValue(row, "Sku", "SKU")).toUpperCase();
        let seriesLot = clean(rowValue(row, "Serie/Lote", "Serie", "seriesLot")).toUpperCase();
        const description = clean(rowValue(row, "Descripción Sku", "Descripción", "description"));
        const quantity = Math.max(1, numeric(rowValue(row, "Cantidad", "quantity")) || 1);
        const unitMeasure = clean(rowValue(row, "Unidad de Medida", "UnidadMedida", "Unidad", "unit")) || "UND";
        const unitCost = Math.max(0, numeric(rowValue(row, "Costo Unitario", "Costo unitario", "Costo", "Cost", "unitCost")));
        const equipmentTypeFromFile = clean(rowValue(row, "Tipo de Equipo", "Categoría", "category"));
        const equipmentType = normalizeParty(equipmentTypeFromFile).includes("LOTE") ? "LOTE" : "EQUIPO";
        const project = clean(rowValue(row, "Proyecto", "ProyectoFinal", "project"));
        const requestedLotMode = clean(rowValue(row, "Modo de Lote", "Modo Lote", "Asignación de Lote", "Asignacion de Lote")).toUpperCase();
        const originSite = clean(rowValue(row, "Site Origen", "originSite"));
        const stockLocation = normalizeStockLocation(rowValue(row, "Ubicación", "Ubicacion", "Almacén", "Almacen", "stockLocation"));
        const orderNumber = clean(rowValue(row, "N° Pedido", "N Pedido", "Pedido", "orderNumber"));
        const coordinator = clean(rowValue(row, "Coordinador Entel", "CordEntelFinal", "coordinator"));
        const coordinatorF1 = clean(rowValue(row, "Coordinador F1", "CordF1"));
        const movementDate = normalizeKardexDate(
          rowValue(row, movementType === "entrada" ? "Fecha de Ingreso" : "Fecha Salida", "Fecha de Salida", "Fecha", "movementDate"),
          new Date().toISOString().slice(0, 10),
        );
        const document = clean(rowValue(row, movementType === "entrada" ? "GR. de Ingreso" : "NroGRSalida", "GR. de Salida", "GR Ingreso", "GR Salida", "Guía", "document"));
        const contractorDocument = normalizeDocumentNumber(rowValue(row, "RUC", "DNI", "RUC/DNI", "Documento Contrata", "Documento Proveedor"));
        const supplierMatch = suppliersByDocument.get(contractorDocument);
        const origin = movementType === "entrada" ? supplierMatch?.businessName || "" : "MO COMPANY";
        const contractor = movementType === "salida" ? supplierMatch?.businessName || "" : "";
        const sourceRow = clean(rowValue(row, "Fila", "ITEM"));
        let lotAssignment = "ORIGINAL";
        if (movementType === "entrada" && !seriesLot && requestedLotMode.includes("MANUAL")) {
          rejected.push({ row: rowIndex + 2, sku: sku || "—", reason: "Elegiste lote manual, pero falta Serie/Lote." });
          continue;
        }
        if (movementType === "entrada" && !seriesLot && (requestedLotMode.includes("AUTO") || origin.toUpperCase().includes("TRANSFER"))) {
          seriesLot = automaticLotCode({ movementDate, orderNumber, sku, sourceRow: sourceRow || String(rowIndex + 2) });
          lotAssignment = "AUTOMATICO";
        } else if (seriesLot && requestedLotMode.includes("MANUAL")) {
          lotAssignment = "MANUAL";
        }
        const grLink = normalizeGrLink(rowValue(row, "Link de GR", "Link GR", "Link de GR. de Ingreso"));
        const fileCostCents = Math.round(unitCost * 100);
        const entelCostCents = entelCostBySku.get(sku) || 0;
        if (!sku) {
          rejected.push({ row: rowIndex + 2, sku: "—", reason: "Falta el SKU." });
          continue;
        }

        if (movementType === "maestro") {
          if (!description) {
            rejected.push({ row: rowIndex + 2, sku, reason: "Falta la Descripción Sku." });
            continue;
          }
          if (!equipmentTypeFromFile) {
            rejected.push({ row: rowIndex + 2, sku, reason: "Falta el Tipo de Equipo." });
            continue;
          }
          await db.insert(products).values({
            sku,
            description,
            category: equipmentType,
            unit: unitMeasure.toUpperCase(),
            location: "",
            minStock: Math.max(0, numeric(rowValue(row, "Stock Mínimo", "Stock Minimo", "minStock"))),
            unitCostCents: fileCostCents || entelCostCents,
            client: "",
            owner: "",
            defaultProject: "",
          }).onConflictDoUpdate({
            target: products.sku,
            set: {
              description,
              category: equipmentType,
              unitCostCents: fileCostCents > 0
                ? fileCostCents
                : sql`CASE WHEN ${products.unitCostCents} = 0 THEN ${entelCostCents} ELSE ${products.unitCostCents} END`,
            },
          });
          imported += 1;
          continue;
        }

        if (source === "F1" && (!orderNumber || !coordinator)) {
          rejected.push({ row: rowIndex + 2, sku, reason: "Faltan N° Pedido o Coordinador Entel." });
          continue;
        }

        if (source === "F1" && !document) {
          rejected.push({ row: rowIndex + 2, sku, reason: movementType === "entrada" ? "Falta la GR. de Ingreso." : "Falta el Nro. de GR de Salida." });
          continue;
        }

        if (source === "F1" && movementType === "entrada" && (!/^\d{11}$/.test(contractorDocument) || !supplierMatch || supplierMatch.documentType !== "RUC")) {
          rejected.push({ row: rowIndex + 2, sku, reason: "El RUC de la empresa de origen no existe o está inactivo en el maestro." });
          continue;
        }

        if (source === "F1" && movementType === "salida" && (!validSupplierDocument(contractorDocument) || !supplierMatch)) {
          rejected.push({ row: rowIndex + 2, sku, reason: "El RUC/DNI de la salida no existe o está inactivo en el maestro." });
          continue;
        }

        const duplicatedDocument = source === "F1" && existingBeforeImport.some((movement) => duplicatesOperationalDocument(movement, {
          type: movementType,
          document,
          orderNumber,
          contractorDocument,
          contractor,
          origin,
        }));
        if (duplicatedDocument) {
          rejected.push({ row: rowIndex + 2, sku, reason: `La GR ${document} y el pedido ${orderNumber} ya fueron cargados para ${contractor || origin}. Solo se admite si pertenecen a otra razón social.` });
          continue;
        }

        if (source === "F1" && (movementType === "entrada" || movementType === "salida") && !coordinatorF1) {
          rejected.push({ row: rowIndex + 2, sku, reason: "Falta Coordinador F1." });
          continue;
        }

        if (source === "F1") {
          let [product] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
          if (!product && movementType === "entrada") {
            [product] = await db.insert(products).values({
              sku,
              description: description || sku,
              category: equipmentType,
              unit: unitMeasure,
              location: stockLocation,
              unitCostCents: fileCostCents || entelCostCents,
              defaultProject: project,
            }).returning();
          } else if (product && movementType === "entrada") {
            [product] = await db.update(products).set({
              unit: unitMeasure || product.unit,
              location: stockLocation || product.location,
              unitCostCents: fileCostCents || product.unitCostCents || entelCostCents,
              defaultProject: project || product.defaultProject,
            }).where(eq(products.id, product.id)).returning();
          }
          if (!product) {
            rejected.push({ row: rowIndex + 2, sku, reason: "El SKU no existe en el maestro." });
            continue;
          }
          const existing = await db.select().from(movements).where(eq(movements.productId, product.id));
          const duplicateRow = existing.some((movement) => movement.type === movementType
            && sameControlGroup(movement, orderNumber, coordinator)
            && (!document || clean(movement.document).toUpperCase() === document.toUpperCase())
            && (seriesLot
              ? clean(movement.serials).toUpperCase() === seriesLot
              : Boolean(sourceRow) && clean(movement.sourceRow).toUpperCase() === sourceRow.toUpperCase()));
          if (duplicateRow) {
            rejected.push({ row: rowIndex + 2, sku, reason: "Esta línea ya fue cargada anteriormente." });
            continue;
          }

          const serializedEquipment = movementType === "entrada"
            && !isLotControlled(product.category || equipmentType, quantity)
            && Boolean(seriesLot);
          if (serializedEquipment) {
            const duplicated = splitSeries(seriesLot).filter((token) => {
              const balance = existing.reduce(
                (total, movement) => total + stockEffect(movement.type) * trackedSeriesQuantity(movement.serials, movement.quantity, token),
                0,
              );
              return balance > 0;
            });
            if (duplicated.length) {
              rejected.push({ row: rowIndex + 2, sku, reason: `Serie ya registrada y disponible: ${duplicated.join(", ")}.` });
              continue;
            }
          }

          if (movementType === "salida") {
            const controlled = existing.filter((movement) => sameControlGroup(movement, orderNumber, coordinator));
            const available = controlled.reduce((total, movement) => total + stockEffect(movement.type) * movement.quantity, 0);
            if (quantity > available) {
              rejected.push({ row: rowIndex + 2, sku, reason: `Stock insuficiente para el pedido ${orderNumber} y coordinador ${coordinator}. Disponible: ${available}.` });
              continue;
            }

            if (seriesLot) {
              const requested = splitSeries(seriesLot);
              const unavailable = requested.filter((token) => {
                const balance = controlled.reduce(
                  (total, movement) => total + stockEffect(movement.type) * trackedSeriesQuantity(movement.serials, movement.quantity, token),
                  0,
                );
                const required = requested.length > 1 ? 1 : quantity;
                return balance < required;
              });
              if (unavailable.length) {
                rejected.push({ row: rowIndex + 2, sku, reason: `Serie/Lote no disponible en este pedido: ${unavailable.join(", ")}.` });
                continue;
              }
            }
          }
          await db.insert(movements).values({
            productId: product.id,
            type: movementType,
            quantity,
            movementDate,
            document,
            project,
            destinationSite: clean(rowValue(row, "Site Destino", "SiteDestino", "destinationSite")),
            coordinator,
            coordinatorF1,
            serials: seriesLot,
            lotAssignment,
            sourceRow,
            originSite,
            stockLocation,
            unitMeasure,
            unitCostCents: fileCostCents || product.unitCostCents || entelCostCents,
            equipmentType: product.category || equipmentType,
            loadGr: movementType === "entrada" ? (grLink ? "SI" : "") : clean(rowValue(row, "Cargar Gr", "Cargar GR")),
            grLink,
            orderNumber,
            ticket: clean(rowValue(row, "Ticket/JIRA", "Ticket", "JIRA")),
            equipmentStatus: clean(rowValue(row, "Estado de Equipo", "Estado")) || "NUEVO",
            condition: clean(rowValue(row, "Condición", "Condicion")) || "OPERATIVO",
            origin,
            owner: clean(rowValue(row, "Propietario F1", "Propietario")) || "F1 SERVICES",
            recordStatus: movementType === "salida" ? "Despachado" : "Disponible",
            region: clean(rowValue(row, "Region", "Región")),
            province: clean(rowValue(row, "Provincia")),
            contractorDocument,
            contractor,
            consignee: clean(rowValue(row, "Consignatario")),
            requesterEmail: clean(rowValue(row, "CorreoSolicitante", "Correo Solicitante")).toLowerCase(),
            emailStatus: clean(rowValue(row, "Estado Correo")),
            emailFlowStatus: clean(rowValue(row, "EstadoCorreo")),
            dispatchId: clean(rowValue(row, "IDDespacho", "ID Despacho")),
            emailSentAt: clean(rowValue(row, "FechaEnvioCorreo", "Fecha Envío Correo")),
            registeredBy: clean(rowValue(row, "Persona que Registra")) || user.displayName,
            notes: `Carga masiva F1 - ${movementType}`,
          });
        } else {
          await db.insert(sourceRecords).values({
            source,
            movementType,
            sku,
            seriesLot,
            quantity,
            movementDate: normalizeKardexDate(
              rowValue(row, movementType === "entrada" ? "Fecha de Ingreso" : "Fecha Salida", "Fecha de Salida", "Fecha", "movementDate"),
            ),
            document: clean(rowValue(row, movementType === "entrada" ? "GR. de Ingreso" : "NroGRSalida", "GR. de Salida", "Guía", "document")),
            sourceStatus: clean(rowValue(row, "Estado de Equipo", "Estado", "sourceStatus")),
          });
        }
        imported += 1;
      }
      return Response.json({ ok: true, imported, rejected: rejected.length, rejectionDetails: rejected.slice(0, 25) }, { status: 201 });
    }

    const movementPayload = payload as MovementInput;
    const productId = Number(movementPayload.productId);
    const quantity = Math.max(0, Number(movementPayload.quantity) || 0);
    const type = movementPayload.type;
    const validTypes = ["entrada", "salida", "devolucion", "desinstalacion", "traslado", "regularizacion", "baja", "ajuste"];
    if (!productId || !quantity || !type || !validTypes.includes(type)) {
      return Response.json({ error: "Producto, tipo y cantidad son obligatorios." }, { status: 400 });
    }

    const orderNumber = clean(movementPayload.orderNumber);
    const coordinator = clean(movementPayload.coordinator);
    const coordinatorF1 = clean(movementPayload.coordinatorF1);
    if ((type === "entrada" || type === "salida") && (!orderNumber || !coordinator)) {
      return Response.json(
        { error: "N° Pedido y Coordinador Entel son obligatorios para controlar el lote." },
        { status: 400 },
      );
    }
    if ((type === "entrada" || type === "salida") && !coordinatorF1) {
      return Response.json(
        { error: "Coordinador F1 es obligatorio para ingresos y salidas." },
        { status: 400 },
      );
    }

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return Response.json({ error: "Producto no encontrado." }, { status: 404 });

    const allMovements = await db.select().from(movements);
    const productMovements = allMovements.filter((row) => row.productId === productId);
    const movementDate = normalizeKardexDate(movementPayload.movementDate, new Date().toISOString().slice(0, 10));
    const document = clean(movementPayload.document);
    const contractorDocument = normalizeDocumentNumber(movementPayload.contractorDocument);
    const supplierMatch = await supplierFromDocument(db, contractorDocument);
    const origin = type === "entrada" ? supplierMatch?.businessName || "" : "MO COMPANY";
    const contractor = type === "salida" ? supplierMatch?.businessName || "" : "";
    if ((type === "entrada" || type === "salida") && !document) {
      return Response.json({ error: type === "entrada" ? "La GR. de Ingreso es obligatoria." : "El Nro. de GR de Salida es obligatorio." }, { status: 400 });
    }
    if (type === "entrada" && (!/^\d{11}$/.test(contractorDocument) || !supplierMatch || supplierMatch.documentType !== "RUC")) {
      return Response.json({ error: "El RUC de la empresa de origen debe existir y estar activo en el maestro." }, { status: 400 });
    }
    if (type === "salida" && (!validSupplierDocument(contractorDocument) || !supplierMatch)) {
      return Response.json({ error: "El RUC o DNI de la salida debe existir y estar activo en el maestro." }, { status: 400 });
    }
    if ((type === "entrada" || type === "salida") && allMovements.some((row) => duplicatesOperationalDocument(row, {
      type,
      document,
      orderNumber,
      contractorDocument,
      contractor,
      origin,
    }))) {
      return Response.json({ error: `La GR ${document} y el pedido ${orderNumber} ya fueron registrados para ${contractor || origin}. Solo se admite si corresponden a otra razón social.` }, { status: 409 });
    }
    const sourceRow = clean(movementPayload.sourceRow);
    let serials = clean(movementPayload.serials).toUpperCase();
    let lotAssignment = clean(movementPayload.lotAssignment).toUpperCase();
    if (type === "entrada" && !serials && lotAssignment === "MANUAL") {
      return Response.json({ error: "Ingresa el número de lote manual o cambia la asignación a automática." }, { status: 400 });
    }
    if (type === "entrada" && !serials && (lotAssignment === "AUTOMATICO" || origin.toUpperCase().includes("TRANSFER"))) {
      serials = automaticLotCode({ movementDate, orderNumber, sku: product.sku, sourceRow: sourceRow || "1" });
      lotAssignment = "AUTOMATICO";
    } else if (serials && lotAssignment === "MANUAL") {
      lotAssignment = "MANUAL";
    } else {
      lotAssignment = "ORIGINAL";
    }
    const duplicateMovement = productMovements.some((row) => row.type === type
      && sameControlGroup(row, orderNumber, coordinator)
      && (!document || clean(row.document).toUpperCase() === document.toUpperCase())
      && (serials
        ? clean(row.serials).toUpperCase() === serials
        : !clean(row.serials) && row.quantity === quantity && row.movementDate === movementDate));
    if (duplicateMovement) {
      return Response.json({ error: "Este movimiento ya fue registrado para la misma serie, pedido y GR." }, { status: 409 });
    }

    const controlledMovements = productMovements.filter((row) => sameControlGroup(row, orderNumber, coordinator));
    const currentStock = controlledMovements.reduce(
      (total, row) => total + stockEffect(row.type) * row.quantity,
      0,
    );
    if (type === "salida" && quantity > currentStock) {
      return Response.json(
        { error: `Stock insuficiente. Disponible: ${currentStock} ${product.unit}.` },
        { status: 409 },
      );
    }

    if (type === "salida" && clean(movementPayload.serials)) {
      const balances = new Map<string, number>();
      for (const row of controlledMovements) {
        const tokens = splitSeries(row.serials);
        for (const token of tokens) {
          balances.set(
            token,
            (balances.get(token) ?? 0) + stockEffect(row.type) * trackedSeriesQuantity(row.serials, row.quantity, token),
          );
        }
      }
      const requested = splitSeries(clean(movementPayload.serials));
      const unavailable = requested.filter((serial) => (balances.get(serial) ?? 0) < (requested.length > 1 ? 1 : quantity));
      if (unavailable.length) {
        return Response.json({ error: `Serie/Lote no disponible: ${unavailable.join(", ")}.` }, { status: 409 });
      }
    }

    if (type === "entrada" && serials && !isLotControlled(product.category, quantity)) {
      const duplicated = splitSeries(serials).filter((token) => productMovements.reduce(
        (total, row) => total + stockEffect(row.type) * trackedSeriesQuantity(row.serials, row.quantity, token),
        0,
      ) > 0);
      if (duplicated.length) {
        return Response.json({ error: `Serie/Lote ya disponible: ${duplicated.join(", ")}.` }, { status: 409 });
      }
    }

    const requestedCostCents = Math.max(0, Math.round((Number(movementPayload.unitCost) || 0) * 100));
    const entelCostCents = (requestedCostCents || product.unitCostCents) ? 0 : (await latestEntelUnitCosts(db)).get(product.sku.toUpperCase()) || 0;
    const resolvedUnitCostCents = requestedCostCents || product.unitCostCents || entelCostCents;
    if (!product.unitCostCents && entelCostCents) {
      await db.update(products).set({ unitCostCents: entelCostCents }).where(eq(products.id, product.id));
    }

    const stockLocation = normalizeStockLocation(movementPayload.stockLocation);
    if (type === "entrada") {
      await db.update(products).set({ location: stockLocation }).where(eq(products.id, product.id));
    }

    const [movement] = await db
      .insert(movements)
      .values({
        productId,
        type,
        quantity,
        movementDate,
        document,
        project: clean(movementPayload.project),
        destinationSite: clean(movementPayload.destinationSite),
        coordinator,
        coordinatorF1,
        serials,
        lotAssignment,
        sourceRow,
        originSite: clean(movementPayload.originSite),
        stockLocation,
        unitMeasure: clean(movementPayload.unitMeasure) || product.unit,
        unitCostCents: resolvedUnitCostCents,
        equipmentType: product.category || clean(movementPayload.equipmentType),
        loadGr: clean(movementPayload.loadGr),
        grLink: normalizeGrLink(movementPayload.grLink),
        orderNumber,
        ticket: clean(movementPayload.ticket),
        equipmentStatus: clean(movementPayload.equipmentStatus) || "NUEVO",
        condition: clean(movementPayload.condition) || "OPERATIVO",
        origin,
        owner: clean(movementPayload.owner) || "F1 SERVICES",
        recordStatus: type === "salida" ? "Despachado" : type === "baja" ? "Baja" : "Disponible",
        region: clean(movementPayload.region),
        province: clean(movementPayload.province),
        contractorDocument,
        contractor,
        consignee: clean(movementPayload.consignee),
        requesterEmail: clean(movementPayload.requesterEmail).toLowerCase(),
        emailStatus: clean(movementPayload.emailStatus),
        emailFlowStatus: clean(movementPayload.emailFlowStatus),
        dispatchId: clean(movementPayload.dispatchId),
        emailSentAt: clean(movementPayload.emailSentAt),
        registeredBy: clean(movementPayload.registeredBy) || user.displayName,
        notes: clean(movementPayload.notes),
      })
      .returning();

    return Response.json({ ok: true, movement }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
