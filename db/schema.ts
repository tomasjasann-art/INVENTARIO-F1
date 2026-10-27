import { sql } from "drizzle-orm";
import { boolean, doublePrecision, jsonb, index, integer, pgSequence, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";

export const equipmentRequestCodeSequence = pgSequence("equipment_request_code_seq", {
  startWith: 1,
  increment: 1,
});

export const equipmentReturnCodeSequence = pgSequence("equipment_return_code_seq", {
  startWith: 1,
  increment: 1,
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Equipos"),
  unit: text("unit").notNull().default("UND"),
  location: text("location").notNull().default(""),
  minStock: integer("min_stock").notNull().default(0),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  client: text("client").notNull().default(""),
  owner: text("owner").notNull().default(""),
  defaultProject: text("default_project").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const movements = pgTable(
  "movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    type: text("type", {
      enum: ["entrada", "salida", "devolucion", "desinstalacion", "traslado", "regularizacion", "baja", "ajuste"],
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
    contractorDocument: text("contractor_document").notNull().default(""),
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
  },
  (table) => [index("movements_product_id_idx").on(table.productId)],
);

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

export const suppliers = pgTable(
  "suppliers",
  {
    id: serial("id").primaryKey(),
    documentType: text("document_type", { enum: ["RUC", "DNI"] }).notNull().default("RUC"),
    documentNumber: text("document_number").notNull(),
    businessName: text("business_name").notNull(),
    tradeName: text("trade_name").notNull().default(""),
    source: text("source").notNull().default("MANUAL"),
    active: boolean("active").notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("suppliers_document_number_unique").on(table.documentNumber),
    index("suppliers_business_name_idx").on(table.businessName),
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
    coordinatorId: integer("coordinator_id").references(() => coordinators.id, { onDelete: "set null" }),
    coordinatorName: text("coordinator_name").notNull(),
    coordinatorEmail: text("coordinator_email").notNull().default(""),
    coordinatorEntel: text("coordinator_entel").notNull().default(""),
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
    pickupPersonDni: text("pickup_person_dni").notNull().default(""),
    pickupPerson: text("pickup_person").notNull().default(""),
    pickupPerson2Dni: text("pickup_person_2_dni").notNull().default(""),
    pickupPerson2: text("pickup_person_2").notNull().default(""),
    region: text("region").notNull().default(""),
    city: text("city").notNull().default(""),
    deliveryAddress: text("delivery_address").notNull().default(""),
    transport: text("transport").notNull().default(""),
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
    closedAt: text("closed_at").notNull().default(""),
    logisticsNotes: text("logistics_notes").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("equipment_requests_code_idx").on(table.requestCode),
    index("equipment_requests_status_idx").on(table.status, table.id),
    index("equipment_requests_product_id_idx").on(table.productId),
    index("equipment_requests_coordinator_id_idx").on(table.coordinatorId),
    index("equipment_requests_contractor_ruc_idx").on(table.contractorRuc),
    index("equipment_requests_pickup_dni_idx").on(table.pickupPersonDni),
  ],
);

export const appUsers = pgTable(
  "app_users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull().default(""),
    authUserId: text("auth_user_id").notNull().default(""),
    displayName: text("display_name").notNull().default(""),
    role: text("role", { enum: ["ADMINISTRADOR", "LOGISTICA", "COORDINADOR", "SOLO_LECTURA", "CONDUCTOR", "TECNICO"] }).notNull().default("SOLO_LECTURA"),
    coordinatorId: integer("coordinator_id").references(() => coordinators.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    passwordUpdatedAt: text("password_updated_at").notNull().default(""),
    lastLoginAt: text("last_login_at").notNull().default(""),
    invitationStatus: text("invitation_status").notNull().default("PENDIENTE"),
    invitedAt: text("invited_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("app_users_email_unique").on(table.email),
    uniqueIndex("app_users_username_unique").on(table.username).where(sql`${table.username} <> ''`),
    uniqueIndex("app_users_auth_user_id_unique").on(table.authUserId).where(sql`${table.authUserId} <> ''`),
    index("app_users_coordinator_id_idx").on(table.coordinatorId),
  ],
);

export const productIdentifiers = pgTable(
  "product_identifiers",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    identifier: text("identifier").notNull(),
    normalizedIdentifier: text("normalized_identifier").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("product_identifiers_normalized_unique").on(table.normalizedIdentifier),
    index("product_identifiers_product_id_idx").on(table.productId),
  ],
);

export const equipmentReturns = pgTable(
  "equipment_returns",
  {
    id: serial("id").primaryKey(),
    returnCode: text("return_code").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    coordinatorId: integer("coordinator_id").references(() => coordinators.id, { onDelete: "set null" }),
    sourceMovementId: integer("source_movement_id").references(() => movements.id, { onDelete: "set null" }),
    stockMovementId: integer("stock_movement_id").references(() => movements.id, { onDelete: "set null" }),
    batchCode: text("batch_code").notNull().default(""),
    batchItem: integer("batch_item").notNull().default(1),
    coordinatorF1: text("coordinator_f1").notNull(),
    dismantlingContractorDocument: text("dismantling_contractor_document").notNull().default(""),
    dismantlingContractorName: text("dismantling_contractor_name").notNull().default(""),
    orderNumber: text("order_number").notNull().default(""),
    site: text("site").notNull().default(""),
    warehouse: text("warehouse").notNull().default("RED"),
    batchComments: text("batch_comments").notNull().default(""),
    entryDate: text("return_date").notNull().default(""),
    networkComponent: text("network_component").notNull().default(""),
    subProject: text("sub_project").notNull().default(""),
    sourceProject: text("source_project").notNull().default(""),
    hardwareTask: text("hardware_task").notNull().default(""),
    serial: text("serial").notNull(),
    serialKey: text("serial_key").notNull(),
    itemType: text("item_type", { enum: ["EQUIPO", "LOTE"] }).notNull().default("EQUIPO"),
    quantity: integer("quantity").notNull().default(1),
    length: text("length").notNull().default(""),
    condition: text("condition").notNull().default("USADO OPERATIVO"),
    volumeM3: text("volume_m3").notNull().default(""),
    detectedPartNumber: text("detected_part_number").notNull().default(""),
    skuSnapshot: text("sku_snapshot").notNull(),
    descriptionSnapshot: text("description_snapshot").notNull(),
    matchMethod: text("match_method").notNull().default("MANUAL"),
    matchConfidence: integer("match_confidence").notNull().default(0),
    rawOcrText: text("raw_ocr_text").notNull().default(""),
    evidenceImage: text("evidence_image").notNull().default(""),
    entelLabelImage: text("entel_label_image").notNull().default(""),
    modelImage: text("model_image").notNull().default(""),
    panoramicImage: text("panoramic_image").notNull().default(""),
    status: text("status", {
      enum: ["PENDIENTE_APROBACION", "OBSERVADA", "APROBADA_PENDIENTE_RECEPCION", "RECIBIDA_FISICA", "RECHAZADA"],
    }).notNull().default("PENDIENTE_APROBACION"),
    logicalRegisteredAt: text("logical_registered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    approvedAt: text("approved_at").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    physicallyReceivedAt: text("physically_received_at").notNull().default(""),
    receivedBy: text("received_by").notNull().default(""),
    receiptMovementDate: text("receipt_movement_date").notNull().default(""),
    receiptDocument: text("receipt_document").notNull().default(""),
    receiptGrLink: text("receipt_gr_link").notNull().default(""),
    receiptProject: text("receipt_project").notNull().default(""),
    receiptOrigin: text("receipt_origin").notNull().default("DESINSTALACIÓN DE SITIO"),
    receiptCoordinatorEntel: text("receipt_coordinator_entel").notNull().default(""),
    receiptOriginSite: text("receipt_origin_site").notNull().default(""),
    receiptStockLocation: text("receipt_stock_location").notNull().default("MO COMPANY"),
    receiptUnitMeasure: text("receipt_unit_measure").notNull().default("UND"),
    receiptEquipmentStatus: text("receipt_equipment_status").notNull().default("USADO"),
    receiptCondition: text("receipt_condition").notNull().default("OPERATIVO"),
    receiptUnitCostCents: integer("receipt_unit_cost_cents").notNull().default(0),
    createdBy: text("created_by").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("equipment_returns_active_equipment_unique")
      .on(table.serialKey)
      .where(sql`${table.status} NOT IN ('RECIBIDA_FISICA', 'RECHAZADA') AND ${table.itemType} = 'EQUIPO'`),
    uniqueIndex("equipment_returns_active_lot_site_sku_unique")
      .on(table.serialKey, table.site, table.productId)
      .where(sql`${table.status} NOT IN ('RECIBIDA_FISICA', 'RECHAZADA') AND ${table.itemType} = 'LOTE'`),
    uniqueIndex("equipment_returns_return_code_unique").on(table.returnCode),
    index("equipment_returns_batch_code_idx").on(table.batchCode, table.batchItem),
    index("equipment_returns_site_idx").on(table.site),
    index("equipment_returns_status_idx").on(table.status, table.id),
    index("equipment_returns_product_id_idx").on(table.productId),
    index("equipment_returns_coordinator_id_idx").on(table.coordinatorId),
    index("equipment_returns_source_movement_id_idx").on(table.sourceMovementId),
    index("equipment_returns_stock_movement_id_idx").on(table.stockMovementId),
  ],
);

// Vehículos: datos separados del inventario ENTEL y protegidos por la API.
export const fleetVehicles = pgTable("fleet_vehicles", {
  id: serial("id").primaryKey(), plate: text("plate").notNull().unique(),
  ceco: text("ceco").notNull().default(""), usage: text("usage").notNull().default("OPERACIONES"), tenure: text("tenure").notNull().default("PROPIO"),
  category: text("category").notNull().default(""), type: text("type").notNull().default(""), brand: text("brand").notNull().default(""), model: text("model").notNull().default(""),
  engine: text("engine").notNull().default(""), chassis: text("chassis").notNull().default(""), color: text("color").notNull().default(""), titleDate: text("title_date").notNull().default(""), year: integer("year"),
  status: text("status").notNull().default("OPERATIVO"), target: doublePrecision("target").notNull().default(30), initialKm: doublePrecision("initial_km").notNull().default(0), notes: text("notes").notNull().default(""),
}).enableRLS();
export const fleetAssignments = pgTable("fleet_assignments", {
  id: serial("id").primaryKey(), vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id), driverId: integer("driver_id").references(() => appUsers.id),
  importKey: text("import_key").unique(), source: jsonb("source").$type<import("../lib/fleet").HistoricalSource | null>(),
  trackingMode: text("tracking_mode").notNull().default("OPERATIVO"), responsibleName: text("responsible_name").notNull().default(""),
  serviceDate: text("service_date").notNull(), endDate: text("end_date").notNull(), expectedStart: text("expected_start").notNull(), expectedEnd: text("expected_end").notNull(),
  coordinator: text("coordinator").notNull().default(""), ceco: text("ceco").notNull().default(""), site: text("site").notNull().default(""), finalZone: text("final_zone").notNull().default(""), notes: text("notes").notNull().default(""),
  planStatus: text("plan_status").notNull().default("CONFIRMADA"), reason: text("reason").notNull().default(""),
  initialKm: doublePrecision("initial_km"), finalKm: doublePrecision("final_km"), startedAt: text("started_at").notNull().default(""), endedAt: text("ended_at").notNull().default(""),
  startPhotos: jsonb("start_photos").$type<import("../lib/fleet").FleetPhoto[]>().notNull().default([]), endPhotos: jsonb("end_photos").$type<import("../lib/fleet").FleetPhoto[]>().notNull().default([]),
  startRegisteredBy: text("start_registered_by").notNull().default(""), endRegisteredBy: text("end_registered_by").notNull().default(""), startNotes: text("start_notes").notNull().default(""), endNotes: text("end_notes").notNull().default(""), createdBy: text("created_by").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("fleet_vehicle_daily_assignment").on(t.vehicleId, t.serviceDate).where(sql`${t.trackingMode} <> 'HISTORICO'`), index("fleet_assignment_driver_date").on(t.driverId, t.serviceDate)]).enableRLS();
export const fleetInvoices = pgTable("fleet_invoices", {
  id: serial("id").primaryKey(), provider: text("provider").notNull(), number: text("number").notNull(), issueDate: text("issue_date").notNull(), dueDate: text("due_date").notNull(), totalCents: integer("total_cents").notNull(), attachment: text("attachment").notNull().default(""), notes: text("notes").notNull().default(""),
}, t => [uniqueIndex("fleet_invoice_provider_number").on(t.provider, t.number)]).enableRLS();
export const fleetExpenses = pgTable("fleet_expenses", {
  id: serial("id").primaryKey(), vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id), assignmentId: integer("assignment_id").references(() => fleetAssignments.id), date: text("date").notNull(), kind: text("kind").notNull(), amountCents: integer("amount_cents").notNull(),
  quantity: doublePrecision("quantity").notNull().default(0), unit: text("unit").notNull().default("GAL"), fuel: text("fuel").notNull().default(""), unitPrice: doublePrecision("unit_price").notNull().default(0), odometer: doublePrecision("odometer"), provider: text("provider").notNull().default(""), reference: text("reference").notNull(), collector: text("collector").notNull().default(""),
  invoiceId: integer("invoice_id").references(() => fleetInvoices.id), maintenanceType: text("maintenance_type").notNull().default(""), nextKm: doublePrecision("next_km"), attachment: text("attachment").notNull().default(""), notes: text("notes").notNull().default(""), fingerprint: text("fingerprint").notNull().unique(), source: jsonb("source").$type<import("../lib/fleet").ExpenseSource | null>(), createdBy: text("created_by").notNull(),
}, t => [index("fleet_expense_vehicle_date").on(t.vehicleId, t.date), index("fleet_expense_invoice").on(t.invoiceId), index("fleet_expense_assignment").on(t.assignmentId)]).enableRLS();
export const fleetDocuments = pgTable("fleet_documents", {
  id: serial("id").primaryKey(), vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id), kind: text("kind").notNull(), provider: text("provider").notNull().default(""), reference: text("reference").notNull(), startDate: text("start_date").notNull(), expiryDate: text("expiry_date").notNull(), attachment: text("attachment").notNull().default(""), notes: text("notes").notNull().default(""),
}, t => [uniqueIndex("fleet_document_renewal").on(t.vehicleId, t.kind, t.reference, t.expiryDate), index("fleet_document_vehicle_expiry").on(t.vehicleId, t.expiryDate)]).enableRLS();
export const fleetPayments = pgTable("fleet_payments", {
  id: serial("id").primaryKey(), invoiceId: integer("invoice_id").notNull().references(() => fleetInvoices.id), date: text("date").notNull(), amountCents: integer("amount_cents").notNull(), reference: text("reference").notNull(), attachment: text("attachment").notNull().default(""), createdBy: text("created_by").notNull(),
}, t => [uniqueIndex("fleet_payment_reference").on(t.invoiceId, t.reference)]).enableRLS();
export const fleetIdle = pgTable("fleet_idle", {
  id: serial("id").primaryKey(), vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id), date: text("date").notNull(), minutes: integer("minutes").notNull(), notes: text("notes").notNull().default(""),
}, t => [uniqueIndex("fleet_idle_vehicle_date").on(t.vehicleId, t.date)]).enableRLS();
export const fleetStations = pgTable("fleet_stations", {
  id: serial("id").primaryKey(), name: text("name").notNull(), provider: text("provider").notNull().default(""), address: text("address").notNull(), district: text("district").notNull().default(""), city: text("city").notNull().default(""), region: text("region").notNull().default(""), fuels: text("fuels").notNull().default(""), hours: text("hours").notNull().default(""), restrictions: text("restrictions").notNull().default(""), latitude: doublePrecision("latitude"), longitude: doublePrecision("longitude"), verified: boolean("verified").notNull().default(false), active: boolean("active").notNull().default(true),
  importKey: text("import_key").unique(), source: jsonb("source").$type<import("../lib/fleet").StationSource | null>(),
}).enableRLS();

