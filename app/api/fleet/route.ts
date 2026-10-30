import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { appUsers, coordinators, fleetVehicles as vehicles, fleetAssignments as assignments, fleetDocuments as documents, fleetExpenses as expenses, fleetInvoices as invoices, fleetPayments as payments, fleetIdle as idle, fleetStations as stations } from "../../../db/schema";
import { fleetAccess, fleetFailure, FleetError, sameOrigin, verifyAttachment, verifyPhotos } from "../../../lib/fleet-server";
import { historicalIdentity, historicalValues, isHistorical, fleetRecordVersion, DOCUMENT_KINDS, expenseIdentity, matchingAssignments, odometerReview, isAdministrative, journeyWork, limaDate, minutesFromTime, normalizedPlate, type Expense, type ImportChange } from "../../../lib/fleet";
import { fuelImportChanges, fuelImportPatch, fuelImportValues } from "../../../lib/fleet-sync";
import { resolveEvidenceImage } from "../../../lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const text = z.string().trim().max(2000).default("");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(`${s}T12:00:00Z`); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; }, "Fecha inválida");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = z.coerce.number().int().positive();
const optionalId = z.preprocess(v => v === "" || v === undefined || v === null ? null : Number(v), id.nullable());
const positive = z.coerce.number().positive().max(10_000_000);
const amount = z.coerce.number().positive().max(10_000_000).transform(v => Math.round(v * 100));
const km = z.coerce.number().min(0).max(10_000_000);
const optionalKm = z.preprocess(v => v === "" || v === undefined || v === null ? null : Number(v), km.nullable());
const vehicleSchema = z.object({ id: optionalId, plate: z.string().transform(normalizedPlate).refine(v => /^[A-Z0-9]{5,10}$/.test(v), "Placa inválida"), ceco: text, usage: z.enum(["ADMINISTRACION", "OPERACIONES"]), tenure: z.enum(["PROPIO", "ALQUILADO"]), category: text, type: text, brand: text, model: text, engine: text, chassis: text, color: text, titleDate: z.union([date, z.literal("")]).default(""), year: z.preprocess(v => v === "" || v == null ? null : Number(v), z.number().int().min(1950).max(2100).nullable()), status: z.enum(["OPERATIVO", "MANTENIMIENTO", "FUERA_SERVICIO"]), target: positive, initialKm: km, notes: text });
const assignmentSchema = z.object({ id: optionalId, vehicleId: id, driverId: optionalId, responsibleName: text, serviceDate: date, endDate: date.optional(), expectedStart: z.union([clock, z.literal("")]).default(""), expectedEnd: z.union([clock, z.literal("")]).default(""), coordinator: text, ceco: text, site: text, finalZone: text, notes: text, planStatus: z.enum(["CONFIRMADA", "POR_CONFIRMAR", "NO_SALIO", "CANCELADA"]).default("CONFIRMADA"), reason: text });
const sourceSchema = z.object({ format: z.enum(["FUEL_ATIO", "TOLL_REPORT"]), transactionId: z.string().trim().max(200).default(""), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/), station: z.string().trim().min(1).max(300), lane: z.string().trim().max(100).default(""), voucher: z.string().trim().max(200).default(""), voucherDate: z.union([date, z.literal("")]).default(""), file: z.string().max(200), sheet: z.string().max(100), row: z.number().int().positive() });
const expenseSchema = z.object({ vehicleId: id, assignmentId: optionalId, date, kind: z.enum(["COMBUSTIBLE", "PEAJE", "MANTENIMIENTO"]), amount: amount, quantity: z.coerce.number().min(0).max(1_000_000).default(0), unit: z.enum(["GAL", "L", "M3"]).default("GAL"), fuel: text, unitPrice: z.coerce.number().min(0).max(1_000_000).default(0), odometer: optionalKm, provider: text, collector: text, reference: z.string().trim().min(1, "Ingresa el número de servicio o comprobante").max(200), invoiceId: optionalId, maintenanceType: text, nextKm: optionalKm, attachment: text, notes: text, source: sourceSchema.nullable().default(null) });
const stationSchema = z.object({ id: optionalId, name: z.string().trim().min(1).max(200), provider: text, address: z.string().trim().min(1).max(500), district: text, city: text, region: text, fuels: text, hours: text, restrictions: text, latitude: z.preprocess(v => v === "" || v == null ? null : Number(v), z.number().min(-90).max(90).nullable()), longitude: z.preprocess(v => v === "" || v == null ? null : Number(v), z.number().min(-180).max(180).nullable()), verified: z.boolean(), active: z.boolean().default(true) });
const historySourceSchema = z.object({ format: z.literal("HISTORICO"), formId: z.string().trim().max(200).default(""), formStarted: text, formEnded: text, monthLabel: text, collector: text, reportedKm: km.nullable().default(null), file: z.string().min(1).max(200), sheet: z.string().min(1).max(100), row: z.number().int().positive() });
const historyKm = z.preprocess(v => v === null || v === undefined || v === "" ? undefined : v, km);
const historySchema = z.object({ vehicleId: id, serviceDate: date.refine(d => d < limaDate(), "El histórico debe ser anterior a hoy"), responsibleName: z.string().trim().min(1).max(200), initialKm: historyKm, finalKm: historyKm, coordinator: text, ceco: text, site: text, notes: text, source: historySourceSchema }).superRefine((a, ctx) => {
  if (a.finalKm < a.initialKm) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "El kilometraje final es menor que el inicial" });
  if (a.source.reportedKm !== null && Math.abs(a.finalKm - a.initialKm - a.source.reportedKm) > .1) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Km recorridos no coincide con Final menos Inicial" });
});
const importVersion = (e: Expense) => createHash("sha256").update(JSON.stringify([e.id, fuelImportValues(e), e.assignmentId, e.invoiceId, e.attachment, e.notes, e.source?.corrections?.length || 0])).digest("hex");

// Always return a JSON error before the platform or browser times out.
export async function GET(request: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readFleet(request),
      new Promise<Response>((_, reject) => { timer = setTimeout(() => reject(new FleetError("La base de datos tardó demasiado. Pulsa Reintentar para volver a cargar.", 504)), 20000); }),
    ]);
  } catch (e) { return fleetFailure(e); }
  finally { clearTimeout(timer); }
}

async function readFleet(request: Request) {
  try {
    const user = await fleetAccess(), db = getDb(), params = new URL(request.url).searchParams;
    if (params.has("evidence")) {
      const [a] = await db.select().from(assignments).where(and(eq(assignments.id, Number(params.get("evidence")) || 0), ...(user.role === "CONDUCTOR" ? [eq(assignments.driverId, user.id)] : []))).limit(1);
      if (!a) throw new FleetError("Registro no disponible.", 404);
      const sign = (photos: typeof a.startPhotos) => Promise.all(photos.map(async p => ({ ...p, url: await resolveEvidenceImage(p.path) })));
      return Response.json({ startPhotos: await sign(a.startPhotos), endPhotos: await sign(a.endPhotos) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (params.has("attachment")) {
      if (user.role === "CONDUCTOR") throw new FleetError("Acceso restringido.", 403);
      const table = ({ document: documents, expense: expenses, invoice: invoices, payment: payments } as const)[params.get("attachment") as "document"];
      if (!table) throw new FleetError("Documento inválido.");
      // Every file is resolved only after an authorized, persisted record lookup.
      const rows = await db.select({ attachment: table.attachment }).from(table).where(eq(table.id, Number(params.get("id")) || 0)).limit(1);
      if (!rows[0]?.attachment) throw new FleetError("Este registro no tiene archivo adjunto.", 404);
      return Response.json({ url: await resolveEvidenceImage(rows[0].attachment) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const driver = user.role === "CONDUCTOR";
    const assignmentRows = await db.select().from(assignments).where(driver ? and(eq(assignments.driverId, user.id), eq(assignments.trackingMode, "OPERATIVO")) : undefined).orderBy(desc(assignments.serviceDate), desc(assignments.id));
    const vehicleIds = [...new Set(assignmentRows.map(a => a.vehicleId))];
    const vehicleRows = driver && !vehicleIds.length ? [] : await db.select().from(vehicles).where(driver ? inArray(vehicles.id, vehicleIds) : undefined).orderBy(vehicles.plate);
    const stationRows = await db.select().from(stations).where(driver ? eq(stations.active, true) : undefined).orderBy(stations.name);
    const driverRows = await db.select({ id: appUsers.id, displayName: appUsers.displayName, role: appUsers.role, username: appUsers.username, active: appUsers.active }).from(appUsers).where(driver ? eq(appUsers.id, user.id) : inArray(appUsers.role, ["CONDUCTOR", "LOGISTICA", "ADMINISTRADOR"]));
    const expenseRows = driver ? [] : await db.select().from(expenses).orderBy(desc(expenses.date), desc(expenses.id));
    const documentRows = driver ? [] : await db.select().from(documents).orderBy(desc(documents.expiryDate));
    const invoiceRows = driver ? [] : await db.select().from(invoices).orderBy(desc(invoices.issueDate));
    const paymentRows = driver ? [] : await db.select().from(payments).orderBy(desc(payments.date));
    const idleRows = driver ? [] : await db.select().from(idle).orderBy(desc(idle.date));
    const coordinatorRows = await db.select({ name: coordinators.name }).from(coordinators).where(and(eq(coordinators.active, true), eq(coordinators.organization, "F1")));
    return Response.json({ user: { id: user.id, displayName: user.displayName, role: user.role, username: user.username }, vehicles: vehicleRows, assignments: assignmentRows, expenses: expenseRows, documents: documentRows, invoices: invoiceRows, payments: paymentRows, idle: idleRows, stations: stationRows, drivers: driverRows, coordinators: coordinatorRows.map(c => c.name) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fleetFailure(e); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await fleetAccess(), db = getDb();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action !== "record" && !user.manager) throw new FleetError("Solo Logística o Administración pueden modificar este control.", 403);
    const checkVersion = (kind: "assignment" | "document" | "invoice", record: Record<string, unknown>) => {
      if (body._version !== fleetRecordVersion(kind, record)) throw new FleetError("El registro cambió. Actualiza la pantalla y vuelve a abrirlo antes de guardar o eliminar.", 409);
    };
    if (action === "historyPreview" || action === "historyImport") {
      const inputs = z.array(z.record(z.unknown())).min(1).max(5000).parse(body.rows);
      const run = async (tx: Pick<typeof db, "select" | "insert" | "execute">, persist: boolean) => {
        if (persist) await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const known = await tx.select().from(vehicles), previous = await tx.select().from(assignments);
        const keys = new Map<string, string>(), additions: Array<typeof assignments.$inferInsert> = [];
        const preview: Array<{ row: number; input: Record<string, unknown>; plate: string; operation?: string; warning?: string; error?: string }> = [];
        let unchanged = 0, duplicates = 0;
        for (const input of inputs) {
          const item: (typeof preview)[number] = { row: Number(input._row || (input.source as { row?: number })?.row), input, plate: known.find(v => v.id === Number(input.vehicleId))?.plate || String(input._plate || "") };
          try {
            if (input._error) throw new FleetError(String(input._error));
            const a = historySchema.parse(input);
            if (!known.some(v => v.id === a.vehicleId)) throw new FleetError("La placa no está registrada.");
            const key = createHash("sha256").update(JSON.stringify(historicalIdentity(a))).digest("hex"), values = JSON.stringify(historicalValues(a));
            if (keys.has(key)) {
              if (keys.get(key) !== values) throw new FleetError("El mismo formulario aparece con datos diferentes. Revisa ambas filas.");
              item.operation = "REPETIDO"; duplicates++;
            } else {
              keys.set(key, values);
              const old = previous.find(p => p.importKey === key);
              if (old) {
                if (JSON.stringify(historicalValues(old)) !== values) throw new FleetError("Este formulario ya se cargó con otros datos. Corrige el registro desde Seguimiento diario.");
                item.operation = "SIN_CAMBIOS"; unchanged++;
              } else {
                if (previous.some(p => !isHistorical(p) && p.vehicleId === a.vehicleId && p.serviceDate <= a.serviceDate && p.endDate >= a.serviceDate)) throw new FleetError("Este día ya tiene una asignación del sistema. Revisa el seguimiento para evitar contarlo dos veces.");
                item.operation = "NUEVO";
                additions.push({ ...a, importKey: key, driverId: null, trackingMode: "HISTORICO", endDate: a.serviceDate, expectedStart: "", expectedEnd: "", planStatus: "CONFIRMADA", reason: "", finalZone: "", startedAt: "", endedAt: "", startPhotos: [], endPhotos: [], createdBy: user.actor, updatedAt: new Date().toISOString() });
              }
            }
            if (!a.coordinator || !a.ceco || !a.site) item.warning = "El archivo tiene datos de trabajo incompletos; se conservan en blanco.";
            item.input = { ...a, _row: item.row, _plate: item.plate };
          } catch (err) { item.error = err instanceof z.ZodError ? err.issues.map(i => i.message).join(" · ") : (err as Error).message; }
          preview.push(item);
        }
        if (persist) {
          if (preview.some(p => p.error)) throw new FleetError("La carga contiene observaciones. Vuelve a validar y corrige las filas observadas antes de importar.");
          for (let index = 0; index < additions.length; index += 200) await tx.insert(assignments).values(additions.slice(index, index + 200));
        }
        return { rows: preview, import: { inserted: additions.length, updated: 0, unchanged, duplicates } };
      };
      if (action === "historyPreview") return Response.json(await run(db, false));
      return Response.json({ ok: true, ...(await db.transaction(tx => run(tx, true))) });
    } else if (action === "historyAssignment") {
      const aId = id.parse(body.id);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const [old] = await tx.select().from(assignments).where(eq(assignments.id, aId)).for("update").limit(1);
        if (!old || !isHistorical(old) || !old.source) throw new FleetError("Seguimiento histórico no encontrado.", 404);
        checkVersion("assignment", old);
        const a = historySchema.parse({ ...body, source: { ...old.source, collector: text.parse(body.collector), reportedKm: null } });
        const [v] = await tx.select().from(vehicles).where(eq(vehicles.id, a.vehicleId)).limit(1);
        if (!v) throw new FleetError("Placa no registrada.");
        const linked = await tx.select().from(expenses).where(eq(expenses.assignmentId, aId));
        if (linked.some(e => e.vehicleId !== a.vehicleId || e.date !== a.serviceDate)) throw new FleetError("La corrección no corresponde a la placa y fecha de los gastos vinculados.");
        await tx.update(assignments).set({ ...a, source: { ...old.source, collector: a.source.collector }, endDate: a.serviceDate, updatedAt: new Date().toISOString() }).where(eq(assignments.id, aId));
      });
    } else if (action === "deleteRecord") {
      const { entity, id: recordId } = z.object({ entity: z.enum(["assignment", "document", "invoice"]), id, confirmed: z.literal(true) }).parse(body);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const table = { assignment: assignments, document: documents, invoice: invoices }[entity];
        const [old] = await tx.select().from(table).where(eq(table.id, recordId)).for("update").limit(1);
        if (!old) throw new FleetError("El registro ya no existe. Actualiza la pantalla.", 404);
        checkVersion(entity, old);
        if (entity === "assignment") {
          if ("startedAt" in old && old.startedAt) throw new FleetError("No se puede eliminar una asignación con jornada iniciada. Puedes corregir sus datos de trabajo.");
          const linked = await tx.select().from(expenses).where(eq(expenses.assignmentId, recordId)).limit(1);
          if (linked.length) throw new FleetError("No se puede eliminar una asignación con gastos vinculados.");
        }
        if (entity === "invoice") {
          const linked = await tx.select().from(expenses).where(eq(expenses.invoiceId, recordId)).limit(1);
          const paid = await tx.select().from(payments).where(eq(payments.invoiceId, recordId)).limit(1);
          if (linked.length || paid.length) throw new FleetError("No se puede eliminar una factura con pagos o abastecimientos vinculados.");
        }
        await tx.delete(table).where(eq(table.id, recordId));
      });
    } else if (action === "vehicle") {
      const { id: vehicleId, ...v } = vehicleSchema.parse(body);
      if (vehicleId) {
        const [old] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
        if (!old) throw new FleetError("Vehículo no encontrado.", 404);
        if (old.plate !== v.plate) {
          const [used] = await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.vehicleId, vehicleId)).limit(1);
          const [spent] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.vehicleId, vehicleId)).limit(1);
          if (used || spent) throw new FleetError("La placa tiene historial. Conserva su identidad y registra otra unidad si corresponde.");
        }
        await db.update(vehicles).set(v).where(eq(vehicles.id, vehicleId));
      } else await db.insert(vehicles).values(v);
    } else if (action === "assignment") {
      const { id: assignmentId, ...input } = assignmentSchema.parse(body);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        await tx.execute(sql`select pg_advisory_xact_lock(7610, ${input.vehicleId})`);
        // The vehicle master determines the mode; a posted mode cannot bypass driver evidence.
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).for("share").limit(1);
        if (!vehicle) throw new FleetError("Selecciona un vehículo registrado.");
        const administrative = vehicle.usage === "ADMINISTRACION";
        const a = { ...input, endDate: administrative ? input.serviceDate : input.endDate || input.serviceDate, driverId: administrative ? null : input.driverId, trackingMode: administrative ? "ADMINISTRATIVO" : "OPERATIVO", responsibleName: administrative ? input.responsibleName : "", expectedStart: administrative ? "" : input.expectedStart, expectedEnd: administrative ? "" : input.expectedEnd, planStatus: administrative ? "CONFIRMADA" : input.planStatus, reason: administrative ? "" : input.reason };
        const [existing] = assignmentId ? await tx.select().from(assignments).where(eq(assignments.id, assignmentId)).for("update").limit(1) : [];
        if (assignmentId && !existing) throw new FleetError("Asignación no encontrada.", 404);
        if (existing) checkVersion("assignment", existing);
        if (existing && isHistorical(existing)) throw new FleetError("Usa el formulario de edición de seguimiento histórico.");
        if (!administrative && !existing?.startedAt) {
          if (!a.driverId) throw new FleetError("Selecciona una cuenta activa de conductor.");
          const [driver] = await tx.select().from(appUsers).where(and(eq(appUsers.id, a.driverId), eq(appUsers.active, true), eq(appUsers.role, "CONDUCTOR"))).limit(1);
          if (!driver) throw new FleetError("La cuenta debe estar activa y tener el rol CONDUCTOR.");
          if (!a.expectedStart || !a.expectedEnd || `${a.endDate}T${a.expectedEnd}` <= `${a.serviceDate}T${a.expectedStart}`) throw new FleetError("La hora de Final debe ser posterior al Inicio. Para viajes, indica la fecha de retorno.");
          if (["NO_SALIO", "CANCELADA"].includes(a.planStatus) && !a.reason) throw new FleetError("Indica el motivo y confirma el estado del vehículo.");
          if (vehicle.status !== "OPERATIVO" && ["CONFIRMADA", "POR_CONFIRMAR"].includes(a.planStatus)) throw new FleetError("El vehículo está en mantenimiento o fuera de servicio.");
        }
        if (assignmentId) {
          if (!existing) throw new FleetError("Asignación no encontrada.", 404);
          if (existing.startedAt) {
            const locked = ["vehicleId", "driverId", "trackingMode", "responsibleName", "serviceDate", "endDate", "expectedStart", "expectedEnd", "planStatus", "reason"] as const;
            if (locked.some(key => a[key] !== existing[key])) throw new FleetError("La jornada ya comenzó. Solo puedes corregir coordinador, CECO, site, zona final y observaciones.");
            if (!a.coordinator || !a.ceco) throw new FleetError("Indica el coordinador y el CECO del trabajo.");
            await tx.update(assignments).set({ coordinator: a.coordinator, ceco: a.ceco, site: a.site, finalZone: a.finalZone, notes: a.notes, updatedAt: new Date().toISOString() }).where(eq(assignments.id, assignmentId));
          } else {
            const linked = await tx.select().from(expenses).where(eq(expenses.assignmentId, assignmentId));
            if (linked.some(e => e.vehicleId !== a.vehicleId || e.date < a.serviceDate || e.date > a.endDate) || (linked.length && ["NO_SALIO", "CANCELADA"].includes(a.planStatus))) throw new FleetError("La corrección no es compatible con los gastos vinculados a esta asignación.");
            await tx.update(assignments).set({ ...a, updatedAt: new Date().toISOString() }).where(eq(assignments.id, assignmentId));
          }
        } else await tx.insert(assignments).values({ ...a, createdBy: user.actor, updatedAt: new Date().toISOString() });
      });
    } else if (action === "correctJourneyKm") {
      if (user.role !== "ADMINISTRADOR") throw new FleetError("Solo los administradores pueden corregir el kilometraje de una jornada.", 403);
      const reading = z.number().finite().min(0).max(10_000_000);
      const correction = z.object({ id, initialKm: reading, finalKm: reading.nullable() }).parse(body);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const [snapshot] = await tx.select().from(assignments).where(eq(assignments.id, correction.id)).limit(1);
        if (!snapshot) throw new FleetError("Jornada no encontrada.", 404);
        // Use the same vehicle lock as Inicio/Final before locking the row.
        await tx.execute(sql`select pg_advisory_xact_lock(7610, ${snapshot.vehicleId})`);
        const [current] = await tx.select().from(assignments).where(eq(assignments.id, correction.id)).for("update").limit(1);
        if (!current) throw new FleetError("Jornada no encontrada.", 404);
        checkVersion("assignment", current);
        if (current.trackingMode !== "OPERATIVO" || !current.startedAt || current.initialKm === null) throw new FleetError("Esta opción solo corrige kilometrajes de jornadas operativas con Inicio registrado.");
        if (current.endedAt) {
          if (correction.finalKm === null) throw new FleetError("Ingresa el kilometraje final de la jornada cerrada.");
          if (correction.finalKm < correction.initialKm) throw new FleetError("El kilometraje final no puede ser menor al inicial.");
        } else if (correction.finalKm !== null) throw new FleetError("La jornada no tiene Final. Solo puedes corregir su kilometraje inicial.");
        await tx.update(assignments).set({ initialKm: correction.initialKm, finalKm: correction.finalKm, updatedAt: new Date().toISOString() }).where(eq(assignments.id, correction.id));
      });
    } else if (action === "record") {
      if (!user.manager && user.role !== "CONDUCTOR") throw new FleetError("Tu perfil es de consulta.", 403);
      const aId = id.parse(body.assignmentId), phase = z.enum(["INICIO", "FINAL"]).parse(body.phase), odometer = km.parse(body.odometer);
      const [a] = await db.select().from(assignments).where(eq(assignments.id, aId)).limit(1);
      if (!a || (!user.manager && a.driverId !== user.id)) throw new FleetError("Esta asignación no te corresponde.", 403);
      if (isHistorical(a)) throw new FleetError("El histórico no registra Inicio, Final ni fotos desde la app.");
      if (isAdministrative(a) || !a.driverId) throw new FleetError("El registro administrativo no requiere Inicio, Final ni fotografías.");
      const photos = await verifyPhotos(body.photos, `fleet/${user.id}/assignment-${aId}/${phase}/`);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7612, ${a.driverId})`);
        await tx.execute(sql`select pg_advisory_xact_lock(7610, ${a.vehicleId})`);
        const [current] = await tx.select().from(assignments).where(eq(assignments.id, aId)).for("update").limit(1);
        if (!current || current.planStatus !== "CONFIRMADA") throw new FleetError("La asignación debe estar confirmada para registrar la jornada.");
        if (isAdministrative(current) || !current.driverId || current.driverId !== a.driverId || current.vehicleId !== a.vehicleId) throw new FleetError("La asignación cambió. Actualiza antes de registrar.", 409);
        let work: { coordinator: string; ceco: string };
        try { work = journeyWork(current, phase, { coordinator: text.parse(body.coordinator), ceco: text.parse(body.ceco) }); }
        catch (err) { if (err instanceof z.ZodError) throw err; throw new FleetError((err as Error).message); }
        const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, current.vehicleId)).limit(1);
        if (phase === "INICIO") {
          if (current.startedAt) throw new FleetError("El Inicio ya fue registrado.", 409);
          if (current.serviceDate !== limaDate()) throw new FleetError("El Inicio solo se registra en la fecha programada.");
          if (!vehicle || vehicle.status !== "OPERATIVO") throw new FleetError("El vehículo no está disponible para iniciar.");
          const [otherJourney] = await tx.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.trackingMode, "OPERATIVO"), eq(assignments.driverId, current.driverId), sql`${assignments.startedAt} <> ''`, eq(assignments.endedAt, ""))).limit(1);
          if (otherJourney) throw new FleetError("El conductor tiene otra jornada pendiente de cierre.");
          const previous = await tx.select().from(assignments).where(eq(assignments.vehicleId, current.vehicleId)).orderBy(desc(assignments.id));
          if (previous.some(p => !isAdministrative(p) && p.id !== aId && p.startedAt && !p.endedAt)) throw new FleetError("Existe una jornada anterior pendiente de cierre para esta placa.");
          const lastKm = Math.max(vehicle.initialKm, ...previous.filter(p => p.endedAt).map(p => p.finalKm || 0));
          if (odometer < lastKm) throw new FleetError(`El kilometraje debe ser igual o mayor al último cierre (${lastKm} km).`);
          await tx.update(assignments).set({ ...work, initialKm: odometer, startedAt: new Date().toISOString(), startPhotos: photos, startRegisteredBy: user.actor, startNotes: text.parse(body.notes), updatedAt: new Date().toISOString() }).where(eq(assignments.id, aId));
        } else {
          if (!current.startedAt || current.initialKm === null) throw new FleetError("Primero registra el Inicio.");
          if (current.endedAt) throw new FleetError("El Final ya fue registrado.", 409);
          if (odometer < current.initialKm) throw new FleetError("El kilometraje final no puede ser menor al inicial.");
          await tx.update(assignments).set({ ...work, finalKm: odometer, endedAt: new Date().toISOString(), endPhotos: photos, endRegisteredBy: user.actor, endNotes: text.parse(body.notes), updatedAt: new Date().toISOString() }).where(eq(assignments.id, aId));
        }
      });
    } else if (action === "idle") {
      const vehicleId = id.parse(body.vehicleId), day = date.parse(body.date), minutes = minutesFromTime(String(body.time || ""));
      if (minutes > 1440) throw new FleetError("El ralentí de un día no puede superar 24 horas.");
      await db.insert(idle).values({ vehicleId, date: day, minutes, notes: text.parse(body.notes) }).onConflictDoUpdate({ target: [idle.vehicleId, idle.date], set: { minutes, notes: text.parse(body.notes) } });
    } else if (action === "document") {
      const { id: documentId, ...d } = z.object({ id: optionalId, vehicleId: id, kind: z.enum(DOCUMENT_KINDS), provider: text, reference: z.string().trim().min(1).max(200), startDate: date, expiryDate: z.union([date, z.literal("")]).default(""), attachment: text, notes: text }).parse(body);
      if (d.kind === "TARJETA_PROPIEDAD") d.expiryDate = "";
      else if (!d.expiryDate || d.expiryDate < d.startDate) throw new FleetError("Indica un vencimiento posterior o igual al inicio de vigencia.");
      await db.transaction(async tx => {
        const [old] = documentId ? await tx.select().from(documents).where(eq(documents.id, documentId)).for("update").limit(1) : [];
        if (documentId && !old) throw new FleetError("Documento no encontrado.", 404);
        if (old) checkVersion("document", old);
        if (old && body.attachment === undefined) d.attachment = old.attachment;
        if (!old || d.attachment !== old.attachment) d.attachment = await verifyAttachment(d.attachment, `fleet/${user.id}/document/`);
        if (documentId) await tx.update(documents).set(d).where(eq(documents.id, documentId));
        else await tx.insert(documents).values(d);
      });
    } else if (action === "expense" || action === "bulkExpense" || action === "bulkPreview") {
      const inputRows = action === "expense" ? [body] : z.array(z.record(z.unknown())).min(1).max(5000).parse(body.rows);
      const rows: Array<Omit<Expense, "id">> = [];
      const preview: Array<{ row: number; input: Record<string, unknown>; plate: string; amount: unknown; reference: string; error?: string; warning?: string; assignmentId?: number | null; operation?: "NUEVO" | "ACTUALIZAR" | "SIN_CAMBIOS"; changes?: ImportChange[] }> = [];
      const nativeFuel = inputRows.some(r => (r.source as { format?: string } | null)?.format === "FUEL_ATIO");
      const knownVehicles = await db.select({ id: vehicles.id, plate: vehicles.plate }).from(vehicles);
      let assignmentRows = nativeFuel || inputRows.some(r => r.assignmentId || r.autoAssign) ? await db.select().from(assignments) : [];
      let invoiceRows = nativeFuel || inputRows.some(r => r.invoiceId) ? await db.select().from(invoices) : [];
      const fingerprints = new Set<string>();
      for (const [rowIndex, input] of inputRows.entries()) {
        const item: (typeof preview)[number] = { row: Number(input._row) || rowIndex + 2, input, plate: knownVehicles.find(v => v.id === Number(input.vehicleId))?.plate || String(input._plate || "Desconocida"), amount: input.amount, reference: String(input.reference || "") };
        try {
        if (input._error) throw new FleetError(String(input._error));
        if (!knownVehicles.some(v => v.id === Number(input.vehicleId))) throw new FleetError("La placa no está registrada en el maestro de vehículos.");
        const { amount: amountCents, ...e } = expenseSchema.parse(input);
        if (e.source?.format === "FUEL_ATIO" && (e.kind !== "COMBUSTIBLE" || !e.source.transactionId)) throw new FleetError("El reporte de combustible requiere un Id Transaccion válido.");
        if (e.source?.format === "TOLL_REPORT" && e.kind !== "PEAJE") throw new FleetError("El reporte de peajes debe cargarse como PEAJE.");
        if (e.source && !e.provider) throw new FleetError("Indica el proveedor del reporte.");
        if (!knownVehicles.some(v => v.id === e.vehicleId)) throw new FleetError("La placa no está registrada en el maestro de vehículos.");
        if (e.kind === "COMBUSTIBLE" && (!e.quantity || !e.fuel || !e.provider || e.odometer === null)) throw new FleetError("Combustible requiere volumen, combustible, proveedor y odómetro.");
        if (e.kind === "COMBUSTIBLE" && ((e.fuel.toUpperCase().includes("GNV") && e.unit !== "M3") || (e.unit === "M3" && !e.fuel.toUpperCase().includes("GNV")))) throw new FleetError("El GNV se registra en M3; gasolina, diésel y GLP en GAL o L.");
        if (e.kind === "COMBUSTIBLE" && e.unitPrice && Math.abs(e.quantity * e.unitPrice - amountCents / 100) > Math.max(0.1, amountCents / 10000)) throw new FleetError("El importe no coincide con volumen × precio unitario.");
        if (e.kind === "MANTENIMIENTO" && (!e.maintenanceType || e.odometer === null)) throw new FleetError("Indica tipo y kilometraje del mantenimiento.");
        if (e.kind !== "COMBUSTIBLE" && e.invoiceId) throw new FleetError("Las facturas de combustible solo se vinculan a abastecimientos.");
        if (input.autoAssign === true && e.source && !e.assignmentId) {
          const candidates = matchingAssignments(e, assignmentRows);
          if (candidates.length === 1) e.assignmentId = candidates[0].id;
          else item.warning = candidates.length ? "Varias jornadas coinciden; vincula manualmente." : "Sin jornada coincidente; pendiente de atribución.";
        }
        if (e.assignmentId) {
          const a = assignmentRows.find(a => a.id === e.assignmentId);
          if (!a || a.vehicleId !== e.vehicleId || e.date < a.serviceDate || e.date > a.endDate) throw new FleetError("La jornada vinculada no corresponde a la placa o fecha del gasto.");
        }
        if (e.invoiceId) {
          const i = invoiceRows.find(i => i.id === e.invoiceId);
          if (!i || i.provider.toUpperCase() !== e.provider.toUpperCase()) throw new FleetError("La factura debe corresponder al mismo proveedor del abastecimiento.");
        }
        e.attachment = await verifyAttachment(e.attachment, `fleet/${user.id}/expense/`);
        const fingerprint = createHash("sha256").update(JSON.stringify(expenseIdentity(e))).digest("hex");
        if (fingerprints.has(fingerprint)) throw new FleetError("Referencia duplicada dentro del archivo.");
        fingerprints.add(fingerprint);
        const review = odometerReview(e, assignmentRows.find(a => a.id === e.assignmentId));
        if (review.startsWith("Revisar:")) item.warning = review;
        item.assignmentId = e.assignmentId;
        item.input = { ...input, ...e, amount: amountCents / 100, autoAssign: false };
        preview.push(item);
        rows.push({ ...e, amountCents, unitPrice: e.kind === "COMBUSTIBLE" ? e.unitPrice || amountCents / 100 / e.quantity : 0, fingerprint, createdBy: user.actor });
        } catch (err) {
          if (action !== "bulkPreview") throw err;
          preview.push({ ...item, error: err instanceof z.ZodError ? err.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" · ") : (err as Error).message });
        }
      }
      const synchronize = async (connection: Pick<typeof db, "select" | "insert" | "execute">, persist: boolean) => {
        if (persist) {
          await connection.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
          assignmentRows = await connection.select().from(assignments);
          invoiceRows = await connection.select().from(invoices);
          for (const row of rows) {
            if (row.assignmentId) {
              const a = assignmentRows.find(a => a.id === row.assignmentId);
              if (!a || a.vehicleId !== row.vehicleId || row.date < a.serviceDate || row.date > a.endDate) throw new FleetError("La asignación cambió. Vuelve a validar la carga.", 409);
            }
            if (row.invoiceId) {
              const i = invoiceRows.find(i => i.id === row.invoiceId);
              if (!i || i.provider.toUpperCase() !== row.provider.toUpperCase()) throw new FleetError("La factura cambió. Vuelve a validar la carga.", 409);
            }
          }
        }
        const query = connection.select().from(expenses).where(inArray(expenses.fingerprint, rows.map(r => r.fingerprint))).orderBy(expenses.id);
        const existing = rows.length ? await (persist ? query.for("update") : query) : [];
        const byFingerprint = new Map(existing.map(e => [e.fingerprint, e]));
        const acceptedPreview = preview.filter(p => !p.error);
        const added: typeof rows = [], updated: Array<typeof expenses.$inferInsert> = [];
        let unchanged = 0;
        for (const [i, row] of rows.entries()) {
          const item = acceptedPreview[i], old = byFingerprint.get(row.fingerprint);
          try {
            const supportsUpdate = action !== "expense" && row.kind === "COMBUSTIBLE" && row.source?.format === "FUEL_ATIO";
            if (old && (!supportsUpdate || old.kind !== "COMBUSTIBLE" || old.source?.format !== "FUEL_ATIO")) throw new FleetError("Este movimiento ya fue cargado. La actualización por Id Transaccion corresponde al reporte original de combustible.", 409);
            if (!old) {
              if (persist && item.input._expectedVersion) throw new FleetError("El movimiento cambió después de la vista previa. Vuelve a validar el archivo.", 409);
              item.operation = "NUEVO";
              item.input = { ...item.input, _expectedVersion: null };
              added.push(row);
              continue;
            }
            const changes = fuelImportChanges(old, row);
            if (persist && changes.length && item.input._expectedVersion !== importVersion(old)) throw new FleetError("Un movimiento cambió después de la vista previa. Vuelve a validar el archivo antes de guardar.", 409);
            if (changes.length && old.assignmentId) {
              const a = assignmentRows.find(a => a.id === old.assignmentId);
              if (!a || a.vehicleId !== row.vehicleId || row.date < a.serviceDate || row.date > a.endDate) throw new FleetError("La corrección de placa o fecha no corresponde a la jornada vinculada. Revisa esa vinculación antes de actualizar.");
            }
            if (changes.length && old.invoiceId) {
              const invoice = invoiceRows.find(invoice => invoice.id === old.invoiceId);
              if (!invoice || invoice.provider.trim().toUpperCase() !== row.provider.trim().toUpperCase()) throw new FleetError("El proveedor corregido no corresponde a la factura vinculada. Revisa la factura antes de actualizar.");
            }
            item.operation = changes.length ? "ACTUALIZAR" : "SIN_CAMBIOS";
            item.changes = changes;
            item.assignmentId = old.assignmentId;
            item.input = { ...item.input, assignmentId: old.assignmentId, invoiceId: old.invoiceId, _expectedVersion: importVersion(old) };
            const review = odometerReview(row, assignmentRows.find(a => a.id === old.assignmentId));
            item.warning = review.startsWith("Revisar:") ? review : undefined;
            if (changes.length) updated.push({ ...old, ...fuelImportPatch(old, row, user.actor, new Date().toISOString()), id: undefined });
            else unchanged++;
          } catch (err) {
            if (persist) throw err;
            item.error = (err as Error).message;
          }
        }
        if (persist) {
          // Lock, revalidate and write in one transaction. Internal links and evidence are never overwritten by a report.
          for (let offset = 0; offset < added.length; offset += 200) await connection.insert(expenses).values(added.slice(offset, offset + 200));
          for (let offset = 0; offset < updated.length; offset += 200) await connection.insert(expenses).values(updated.slice(offset, offset + 200)).onConflictDoUpdate({ target: expenses.fingerprint, set: { vehicleId: sql`excluded.vehicle_id`, date: sql`excluded.date`, amountCents: sql`excluded.amount_cents`, quantity: sql`excluded.quantity`, unit: sql`excluded.unit`, fuel: sql`excluded.fuel`, unitPrice: sql`excluded.unit_price`, odometer: sql`excluded.odometer`, provider: sql`excluded.provider`, reference: sql`excluded.reference`, source: sql`excluded.source` } });
        }
        return { inserted: added.length, updated: updated.length, unchanged };
      };
      if (action === "bulkPreview") { await synchronize(db, false); return Response.json({ rows: preview }); }
      const result = await db.transaction(tx => synchronize(tx, true));
      return Response.json({ ok: true, import: result });
    } else if (action === "invoice") {
      const { id: invoiceId, amount: totalCents, ...i } = z.object({ id: optionalId, provider: z.string().trim().min(1).max(200).transform(s => s.toUpperCase()), number: z.string().trim().min(1).max(100).transform(s => s.toUpperCase()), issueDate: date, dueDate: date, amount, attachment: text, notes: text }).parse(body);
      if (i.dueDate < i.issueDate) throw new FleetError("El vencimiento no puede ser anterior a la emisión.");
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const [old] = invoiceId ? await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update").limit(1) : [];
        if (invoiceId && !old) throw new FleetError("Factura no encontrada.", 404);
        if (old) {
          checkVersion("invoice", old);
          const paid = await tx.select().from(payments).where(eq(payments.invoiceId, invoiceId!));
          if (paid.reduce((sum, p) => sum + p.amountCents, 0) > totalCents) throw new FleetError("El total corregido no puede ser menor que los pagos registrados.");
          const linked = await tx.select().from(expenses).where(eq(expenses.invoiceId, invoiceId!));
          if (linked.some(e => e.provider.toUpperCase() !== i.provider.toUpperCase())) throw new FleetError("El proveedor debe coincidir con los abastecimientos vinculados.");
          if (body.attachment === undefined) i.attachment = old.attachment;
        }
        if (!old || i.attachment !== old.attachment) i.attachment = await verifyAttachment(i.attachment, `fleet/${user.id}/invoice/`);
        if (invoiceId) await tx.update(invoices).set({ ...i, totalCents }).where(eq(invoices.id, invoiceId));
        else await tx.insert(invoices).values({ ...i, totalCents });
      });
    } else if (action === "payment") {
      const { amount: amountCents, ...p } = z.object({ invoiceId: id, date, amount, reference: z.string().trim().min(1).max(200), attachment: text }).parse(body);
      p.attachment = await verifyAttachment(p.attachment, `fleet/${user.id}/payment/`, true);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        await tx.execute(sql`select pg_advisory_xact_lock(7611, ${p.invoiceId})`);
        const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, p.invoiceId)).limit(1);
        if (!invoice) throw new FleetError("Factura no encontrada.", 404);
        const existing = await tx.select().from(payments).where(eq(payments.invoiceId, p.invoiceId));
        if (existing.reduce((s, v) => s + v.amountCents, 0) + amountCents > invoice.totalCents) throw new FleetError("El pago supera el saldo pendiente de la factura.");
        await tx.insert(payments).values({ ...p, amountCents, createdBy: user.actor });
      });
    } else if (action === "linkAssignment") {
      const expenseId = id.parse(body.expenseId), assignmentId = id.parse(body.assignmentId);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).for("update").limit(1);
        const [assignment] = await tx.select().from(assignments).where(eq(assignments.id, assignmentId)).limit(1);
        if (!expense || !assignment || assignment.vehicleId !== expense.vehicleId || expense.date < assignment.serviceDate || expense.date > assignment.endDate) throw new FleetError("Selecciona una jornada correspondiente a la placa y fecha del gasto.");
        if (expense.assignmentId) throw new FleetError("El gasto ya está vinculado a una jornada.");
        await tx.update(expenses).set({ assignmentId }).where(eq(expenses.id, expenseId));
      });
    } else if (action === "linkInvoice") {
      const expenseId = id.parse(body.expenseId), invoiceId = id.parse(body.invoiceId);
      await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(7614, 1)`);
        const [expense] = await tx.select().from(expenses).where(eq(expenses.id, expenseId)).for("update").limit(1);
        const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
        if (!expense || expense.kind !== "COMBUSTIBLE" || !invoice || invoice.provider.toUpperCase() !== expense.provider.toUpperCase()) throw new FleetError("Selecciona una factura del mismo proveedor del combustible.");
        if (expense.invoiceId) throw new FleetError("Este despacho ya está vinculado a una factura.");
        await tx.update(expenses).set({ invoiceId }).where(eq(expenses.id, expenseId));
      });
    } else if (action === "station") {
      const { id: stationId, ...s } = stationSchema.parse(body);
      if (s.verified && (s.latitude === null || s.longitude === null)) throw new FleetError("Para confirmar el punto, registra latitud y longitud verificadas.");
      if (stationId) await db.update(stations).set(s).where(eq(stations.id, stationId)); else await db.insert(stations).values(s);
    } else throw new FleetError("Operación no reconocida.");
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: e.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 4).join(" · ") }, { status: 400 });
    if (e instanceof Error && e.message.startsWith("Ingresa el ralentí")) return Response.json({ error: e.message }, { status: 400 });
    return fleetFailure(e);
  }
}
