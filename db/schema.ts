import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Equipos"),
  unit: text("unit").notNull().default("UND"),
  location: text("location").notNull().default("Almacén principal"),
  minStock: integer("min_stock").notNull().default(0),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  client: text("client").notNull().default("ENTEL"),
  owner: text("owner").notNull().default("F1 SERVICES"),
  defaultProject: text("default_project").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  type: text("type", {
    enum: ["entrada", "salida", "devolucion", "traslado", "regularizacion", "baja", "ajuste"],
  }).notNull(),
  quantity: integer("quantity").notNull(),
  movementDate: text("movement_date").notNull(),
  document: text("document").notNull().default(""),
  project: text("project").notNull().default(""),
  destinationSite: text("destination_site").notNull().default(""),
  coordinator: text("coordinator").notNull().default(""),
  coordinatorF1: text("coordinator_f1").notNull().default(""),
  serials: text("serials").notNull().default(""),
  lotAssignment: text("lot_assignment").notNull().default("ORIGINAL"),
  sourceRow: text("source_row").notNull().default(""),
  originSite: text("origin_site").notNull().default(""),
  stockLocation: text("stock_location").notNull().default("MO COMPANY"),
  unitMeasure: text("unit_measure").notNull().default("UND"),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  equipmentType: text("equipment_type").notNull().default(""),
  loadGr: text("load_gr").notNull().default(""),
  grLink: text("gr_link").notNull().default(""),
  orderNumber: text("order_number").notNull().default(""),
  ticket: text("ticket").notNull().default(""),
  equipmentStatus: text("equipment_status").notNull().default("NUEVO"),
  condition: text("condition").notNull().default("OPERATIVO"),
  origin: text("origin").notNull().default(""),
  owner: text("owner").notNull().default("F1 SERVICES"),
  recordStatus: text("record_status").notNull().default("Disponible"),
  region: text("region").notNull().default(""),
  province: text("province").notNull().default(""),
  contractor: text("contractor").notNull().default(""),
  consignee: text("consignee").notNull().default(""),
  requesterEmail: text("requester_email").notNull().default(""),
  emailStatus: text("email_status").notNull().default(""),
  emailFlowStatus: text("email_flow_status").notNull().default(""),
  dispatchId: text("dispatch_id").notNull().default(""),
  emailSentAt: text("email_sent_at").notNull().default(""),
  registeredBy: text("registered_by").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sourceRecords = pgTable("source_records", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  movementType: text("movement_type").notNull().default("entrada"),
  sku: text("sku").notNull(),
  seriesLot: text("series_lot").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),
  movementDate: text("movement_date").notNull().default(""),
  document: text("document").notNull().default(""),
  sourceStatus: text("source_status").notNull().default(""),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const coordinators = pgTable(
  "coordinators",
  {
    id: serial("id").primaryKey(),
    organization: text("organization", { enum: ["F1", "ENTEL"] }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("coordinators_organization_name_unique").on(table.organization, table.name),
  ],
);

export const installationValidations = pgTable(
  "installation_validations",
  {
    id: serial("id").primaryKey(),
    movementId: integer("movement_id")
      .notNull()
      .references(() => movements.id),
    serial: text("serial").notNull().default(""),
    evidenceSsnn: text("evidence_ssnn").notNull().default(""),
    installedSite: text("installed_site").notNull().default(""),
    managementDate: text("management_date").notNull().default(""),
    responsible: text("responsible").notNull().default(""),
    requestStatus: text("request_status").notNull().default("PENDIENTE"),
    jiraRequestNumber: text("jira_request_number").notNull().default(""),
    reviewer: text("reviewer").notNull().default(""),
    entelReviewDate: text("entel_review_date").notNull().default(""),
    year: text("year").notNull().default(""),
    oracleStatus: text("oracle_status").notNull().default("PENDIENTE"),
    reportGrLink: text("report_gr_link").notNull().default(""),
    email: text("email").notNull().default(""),
    observation: text("observation").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("installation_validations_movement_serial_unique").on(table.movementId, table.serial),
  ],
);

export const auditImports = pgTable(
  "audit_imports",
  {
    id: serial("id").primaryKey(),
    source: text("source", { enum: ["ENTEL", "ORACLE"] }).notNull(),
    fileName: text("file_name").notNull(),
    sheetName: text("sheet_name").notNull().default(""),
    contractor: text("contractor").notNull().default("F1 SERVICES"),
    cutoffDate: text("cutoff_date").notNull().default(""),
    rawRowCount: integer("raw_row_count").notNull().default(0),
    normalizedRowCount: integer("normalized_row_count").notNull().default(0),
    totalQuantity: integer("total_quantity").notNull().default(0),
    totalCostCents: integer("total_cost_cents").notNull().default(0),
    status: text("status", { enum: ["PROCESSING", "READY", "FAILED"] }).notNull().default("PROCESSING"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("audit_imports_source_status_idx").on(table.source, table.status, table.id)],
);

export const auditRecords = pgTable(
  "audit_records",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => auditImports.id),
    source: text("source", { enum: ["ENTEL", "ORACLE"] }).notNull(),
    sourceKey: text("source_key").notNull(),
    contractor: text("contractor").notNull().default("F1 SERVICES"),
    sku: text("sku").notNull(),
    description: text("description").notNull().default(""),
    seriesLot: text("series_lot").notNull(),
    quantity: integer("quantity").notNull().default(0),
    unitMeasure: text("unit_measure").notNull().default("UND"),
    equipmentType: text("equipment_type").notNull().default(""),
    subinventory: text("subinventory").notNull().default(""),
    projectCode: text("project_code").notNull().default(""),
    project: text("project").notNull().default(""),
    purchaseOrder: text("purchase_order").notNull().default(""),
    task: text("task").notNull().default(""),
    requester: text("requester").notNull().default(""),
    site: text("site").notNull().default(""),
    totalCostCents: integer("total_cost_cents").notNull().default(0),
    warehouseEntryDate: text("warehouse_entry_date").notNull().default(""),
    receiptDate: text("receipt_date").notNull().default(""),
    orderNumber: text("order_number").notNull().default(""),
    ageMonths: integer("age_months").notNull().default(0),
    ageBucket: text("age_bucket").notNull().default("Sin antigüedad"),
    category: text("category").notNull().default("Sin categoría"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("audit_records_import_key_unique").on(table.importId, table.sourceKey),
    index("audit_records_import_source_idx").on(table.importId, table.source),
  ],
);

export const equipmentRequests = pgTable(
  "equipment_requests",
  {
    id: serial("id").primaryKey(),
    requestCode: text("request_code").notNull(),
    coordinatorName: text("coordinator_name").notNull(),
    coordinatorEmail: text("coordinator_email").notNull().default(""),
    orderNumber: text("order_number").notNull(),
    project: text("project").notNull().default(""),
    site: text("site").notNull().default(""),
    warehouse: text("warehouse").notNull().default("Almacén principal"),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull().default(1),
    seriesLot: text("series_lot").notNull().default(""),
    contractorRuc: text("contractor_ruc").notNull().default(""),
    contractorBusinessName: text("contractor_business_name").notNull().default(""),
    pickupPerson: text("pickup_person").notNull().default(""),
    region: text("region").notNull().default(""),
    city: text("city").notNull().default(""),
    neededDate: text("needed_date").notNull().default(""),
    status: text("status", { enum: ["PENDIENTE", "VALIDADA", "DESPACHADA", "EN_TRANSITO", "LISTA_RECOJO", "RECOGIDA", "CERRADA", "RECHAZADA"] }).notNull().default("PENDIENTE"),
    outboundGuide: text("outbound_guide").notNull().default(""),
    outboundGuideLink: text("outbound_guide_link").notNull().default(""),
    outboundGuidePhoto: text("outbound_guide_photo").notNull().default(""),
    shippingTicket: text("shipping_ticket").notNull().default(""),
    shippingTicketPhoto: text("shipping_ticket_photo").notNull().default(""),
    shippingKey: text("shipping_key").notNull().default(""),
    sentDate: text("sent_date").notNull().default(""),
    arrivalDate: text("arrival_date").notNull().default(""),
    pickupDate: text("pickup_date").notNull().default(""),
    logisticsNotes: text("logistics_notes").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("equipment_requests_code_idx").on(table.requestCode),
    index("equipment_requests_status_idx").on(table.status, table.id),
  ],
);

export const appUsers = pgTable(
  "app_users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: text("role", { enum: ["ADMINISTRADOR", "LOGISTICA", "COORDINADOR", "SOLO_LECTURA"] }).notNull().default("SOLO_LECTURA"),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("app_users_email_unique").on(table.email)],
);
