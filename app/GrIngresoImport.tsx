"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, FileSearch, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { DragEvent, FormEvent, useMemo, useState } from "react";
import { normalizeSkuKey, parseGrIngresoRecognition, resolveKnownSku, type GrLayoutPage } from "../lib/gr-ingreso";

type GrProduct = {
  id: number;
  sku: string;
  description: string;
  category: string;
  unit: string;
  unitCostCents: number;
};

type GrCoordinator = {
  id: number;
  organization: "F1" | "ENTEL";
  name: string;
  email: string;
  active: boolean;
};

type GrSupplier = {
  id: number;
  documentType: "RUC" | "DNI";
  documentNumber: string;
  businessName: string;
  active: boolean;
};

type EditableRow = {
  key: string;
  sku: string;
  description: string;
  quantity: number;
  seriesLot: string;
  lotMode: "ORIGINAL" | "MANUAL" | "AUTOMATICO";
  unit: string;
  unitCost: string;
  equipmentType: "EQUIPO" | "LOTE";
};

type Props = {
  products: GrProduct[];
  coordinators: GrCoordinator[];
  suppliers: GrSupplier[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
};

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canvasFromImage(file: File) {
  return createImageBitmap(file).then((bitmap) => {
    const maxWidth = 2200;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  });
}

async function canvasesFromPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: Array<{ canvas: HTMLCanvasElement; text: string }> = [];
  const pageCount = Math.min(pdf.numPages, 4);
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) throw new Error("No se pudo preparar la vista de la GR.");
    await page.render({ canvas, canvasContext, viewport }).promise;
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push({ canvas, text });
  }
  return pages;
}

function emptyRow(products: GrProduct[], shared?: Partial<EditableRow>): EditableRow {
  const resolvedSku = shared?.sku ? resolveKnownSku(shared.sku, products.map((item) => item.sku)) || shared.sku : "";
  const product = resolvedSku ? products.find((item) => normalizeSkuKey(item.sku) === normalizeSkuKey(resolvedSku)) : undefined;
  return {
    key: newKey(),
    sku: product?.sku ?? resolvedSku,
    description: product?.description ?? shared?.description ?? "",
    quantity: Math.max(1, shared?.quantity ?? 1),
    seriesLot: shared?.seriesLot ?? "",
    lotMode: shared?.lotMode ?? (shared?.seriesLot ? "MANUAL" : "ORIGINAL"),
    unit: product?.unit || shared?.unit || "UND",
    unitCost: shared?.unitCost ?? (product?.unitCostCents ? String(product.unitCostCents / 100) : ""),
    equipmentType: product?.category?.toUpperCase().includes("LOTE") ? "LOTE" : shared?.equipmentType ?? "EQUIPO",
  };
}

export default function GrIngresoImport({ products, coordinators, suppliers, saving, onClose, onSave }: Props) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [movementDate, setMovementDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [ruc, setRuc] = useState("");
  const [coordinatorEntel, setCoordinatorEntel] = useState("");
  const [coordinatorF1, setCoordinatorF1] = useState("");
  const [project, setProject] = useState("ENTEL");
  const [originSite, setOriginSite] = useState("MO Company");
  const [stockLocation, setStockLocation] = useState("MO COMPANY");
  const [equipmentStatus, setEquipmentStatus] = useState("NUEVO");
  const [condition, setCondition] = useState("OPERATIVO");
  const [owner, setOwner] = useState("F1 SERVICES");
  const [grLink, setGrLink] = useState("");

  const productsBySku = useMemo(() => new Map(products.map((product) => [normalizeSkuKey(product.sku), product])), [products]);
  const supplier = suppliers.find((item) => item.active && item.documentType === "RUC" && item.documentNumber === ruc);
  const entelCoordinators = coordinators.filter((item) => item.active && item.organization === "ENTEL");
  const f1Coordinators = coordinators.filter((item) => item.active && item.organization === "F1");
  const rowErrors = rows.map((row) => {
    const issues: string[] = [];
    if (!row.sku.trim()) issues.push("SKU");
    if (!row.description.trim()) issues.push("descripción");
    if (!Number.isFinite(row.quantity) || row.quantity < 1) issues.push("cantidad");
    if (row.lotMode === "MANUAL" && !row.seriesLot.trim()) issues.push("serie/lote");
    else if (row.equipmentType === "EQUIPO" && row.lotMode !== "AUTOMATICO" && !row.seriesLot.trim()) issues.push("serie");
    return issues;
  });
  const sharedReady = Boolean(movementDate && documentNumber.trim() && orderNumber.trim() && supplier && coordinatorEntel.trim() && coordinatorF1.trim());
  const ready = rows.length > 0 && rowErrors.every((issues) => issues.length === 0) && sharedReady;

  function replaceFileUrl(file: File) {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(file));
  }

  async function recognizeFile(file?: File) {
    if (!file || processing) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!file.type.startsWith("image/") && extension !== "pdf") {
      setError("Usa una GR en PDF, JPG, PNG o WEBP.");
      return;
    }
    setProcessing(true);
    setProgress(2);
    setStatusText("Preparando la GR...");
    setError("");
    setWarnings([]);
    setFileName(file.name);
    replaceFileUrl(file);

    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    try {
      const pages = extension === "pdf"
        ? await canvasesFromPdf(file)
        : [{ canvas: await canvasFromImage(file), text: "" }];
      const fullTexts: string[] = pages.map((page) => page.text);
      const headerTexts: string[] = [];
      const quantityTexts: string[] = [];
      const layoutPages: GrLayoutPage[] = [];

      const { createWorker, PSM } = await import("tesseract.js");
      setStatusText("Iniciando reconocimiento por columnas...");
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") setProgress((value) => Math.max(value, Math.round(12 + message.progress * 78)));
        },
      });

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        setStatusText(`Leyendo columnas y líneas de la página ${index + 1} de ${pages.length}...`);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
        const fullResult = await worker.recognize(page.canvas);
        fullTexts[index] = `${page.text}\n${fullResult.data.text}`;

        if (index === 0) {
          await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
          const headerResult = await worker.recognize(page.canvas, {
            rectangle: {
              left: Math.round(page.canvas.width * 0.52),
              top: 0,
              width: Math.round(page.canvas.width * 0.48),
              height: Math.round(page.canvas.height * 0.34),
            },
          });
          headerTexts.push(headerResult.data.text);
        }

        const tableTop = Math.round(page.canvas.height * 0.31);
        const tableHeight = Math.round(page.canvas.height * 0.56);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
        const tableResult = await worker.recognize(page.canvas, {
          rectangle: { left: 0, top: tableTop, width: page.canvas.width, height: tableHeight },
        }, { text: true, tsv: true });
        quantityTexts.push(tableResult.data.text);
        layoutPages.push({ tsv: tableResult.data.tsv ?? "", width: page.canvas.width, height: tableHeight });
      }

      const result = parseGrIngresoRecognition({
        fullText: fullTexts.join("\n"),
        headerText: headerTexts.join("\n"),
        quantityText: quantityTexts.join("\n"),
        fileName: file.name,
        layoutPages,
        knownProducts: products.map((product) => ({ sku: product.sku, category: product.category })),
      });
      setRows(result.rows.map((row) => emptyRow(products, {
        sku: row.sku,
        quantity: row.quantity,
        seriesLot: row.seriesLot,
      })));
      setMovementDate(result.movementDate);
      setDocumentNumber(result.document);
      setOrderNumber(result.orderNumber);
      setWarnings(result.warnings);
      setProgress(100);
      setStatusText("Lectura terminada. Revisa y corrige antes de cargar.");
    } catch (recognitionError) {
      setMovementDate(currentDate());
      setRows([emptyRow(products)]);
      setWarnings(["La lectura automática no terminó. El formato manual quedó disponible para completar la GR."]);
      setError(recognitionError instanceof Error ? recognitionError.message : "No se pudo leer la GR.");
    } finally {
      await worker?.terminate();
      setProcessing(false);
    }
  }

  function startManual() {
    setMovementDate(currentDate());
    setDocumentNumber("");
    setOrderNumber("");
    setRows([emptyRow(products)]);
    setWarnings(["Modo manual: completa todos los campos y confirma al final."]);
    setError("");
    setStatusText("Formato manual listo.");
  }

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (patch.sku === undefined) return { ...row, ...patch };
      const typedSku = patch.sku.toUpperCase();
      const resolvedSku = resolveKnownSku(typedSku, products.map((product) => product.sku));
      const product = productsBySku.get(normalizeSkuKey(resolvedSku || typedSku));
      return {
        ...row,
        ...patch,
        sku: product?.sku ?? typedSku,
        description: product?.description ?? (normalizeSkuKey(typedSku) === normalizeSkuKey(row.sku) ? row.description : ""),
        unit: product?.unit || row.unit || "UND",
        unitCost: product?.unitCostCents ? String(product.unitCostCents / 100) : row.unitCost,
        equipmentType: product?.category?.toUpperCase().includes("LOTE") ? "LOTE" : row.equipmentType,
      };
    }));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow(products)]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    await onSave({
      action: "bulk",
      source: "F1",
      movementType: "entrada",
      rows: rows.map((row, index) => ({
        Fila: index + 1,
        Sku: row.sku.trim().toUpperCase(),
        "Descripción Sku": row.description.trim(),
        "Estado de Equipo": equipmentStatus,
        Condición: condition,
        Proyecto: project,
        RUC: ruc,
        "Fecha de Ingreso": movementDate,
        "GR. de Ingreso": documentNumber.trim(),
        "Link de GR. de Ingreso": grLink,
        "N° Pedido": orderNumber.trim(),
        "Coordinador Entel": coordinatorEntel,
        "Coordinador F1": coordinatorF1,
        "Site Origen": originSite,
        Ubicación: stockLocation,
        "Serie/Lote": row.seriesLot,
        "Modo de Lote": row.lotMode,
        "Unidad de Medida": row.unit,
        Cantidad: row.quantity,
        Costo: row.unitCost,
        "Tipo de Equipo": row.equipmentType,
        Propietario: owner,
      })),
    });
  }

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    void recognizeFile(event.dataTransfer.files?.[0]);
  }

  return <div className="modal-layer"><div className="modal-card gr-import-modal">
    <div className="modal-head"><div><span className="modal-kicker">INGRESO DESDE GUÍA DE REMISIÓN</span><h2>Leer GR y revisar en tabla</h2><p>Relaciona SKU, cantidad y Serie/Lote por línea. La descripción siempre se consulta en Maestro SKU.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
    {rows.length === 0 ? <div className="gr-import-start">
      <div className="gr-read-fields"><span>Se leerá</span><b>Fecha de Ingreso</b><b>SKU</b><b>GR. de Ingreso</b><b>N° Pedido</b><b>Cantidad por SKU</b><b>Serie/Lote</b></div>
      <label className={`gr-import-drop ${dragActive ? "drag-active" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }} onDrop={dropFile}>
        <input type="file" accept=".pdf,image/jpeg,image/png,image/webp,application/pdf" disabled={processing} onChange={(event) => void recognizeFile(event.target.files?.[0])} />
        {processing ? <LoaderCircle className="spin" size={34} /> : <FileSearch size={34} />}
        <strong>{processing ? statusText : "Arrastra aquí la GR o haz clic para buscarla"}</strong>
        <span>{processing ? `${progress}% procesado` : "PDF, JPG, PNG o WEBP · se leen hasta 4 páginas"}</span>
        {processing ? <div className="gr-progress"><i style={{ width: `${progress}%` }} /></div> : <div className="format-badges"><b>PDF</b><b>JPG</b><b>PNG</b></div>}
      </label>
      {error ? <div className="inline-error">{error}</div> : null}
      <div className="gr-manual-choice"><div><strong>¿La GR tiene otro formato?</strong><span>Puedes abrir directamente el formato completo y llenarlo sin reconocimiento automático.</span></div><button type="button" className="secondary-button" disabled={processing} onClick={startManual}>Completar manualmente</button></div>
    </div> : <form onSubmit={submit}>
      <div className="gr-review-bar"><div><CheckCircle2 size={18} /><span><strong>Vista previa editable</strong><small>Nada se guardará hasta que pulses “Cargar ingreso”.</small></span></div>{fileName ? <div className="gr-file-actions"><span>{fileName}</span>{fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Ver GR</a> : null}</div> : null}</div>
      {warnings.length ? <div className="gr-warning"><AlertTriangle size={17} /><div><strong>Revisión requerida</strong>{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></div> : null}

      <section className="gr-section"><div className="gr-section-head"><div><span>DATOS GENERALES</span><strong>Información que se aplicará a todas las líneas</strong></div><small>Se llena una sola vez para toda la GR.</small></div>
        <div className="form-grid">
          <label className="field"><span>Fecha de Ingreso *</span><input type="date" required value={movementDate} onChange={(event) => setMovementDate(event.target.value)} /></label>
          <label className="field"><span>GR. de Ingreso *</span><input required value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value.toUpperCase())} placeholder="T217-00047707" /></label>
          <label className="field"><span>N° Pedido/Cod. Oracle *</span><input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value.toUpperCase())} /></label>
          <label className="field"><span>RUC de empresa de origen *</span><input inputMode="numeric" pattern="[0-9]{11}" required value={ruc} onChange={(event) => setRuc(event.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="11 dígitos" /><small>{supplier ? `Proviene: ${supplier.businessName}` : ruc.length === 11 ? "RUC no registrado o inactivo en Empresas y personas." : "El nombre se completa desde el maestro."}</small></label>
          <label className="field"><span>Proviene</span><input value={supplier?.businessName ?? ""} readOnly placeholder="Automático según RUC" /></label>
          <label className="field"><span>Coordinador Entel *</span><input required list="gr-entel-coordinators" value={coordinatorEntel} onChange={(event) => setCoordinatorEntel(event.target.value)} /><datalist id="gr-entel-coordinators">{entelCoordinators.map((item) => <option key={item.id} value={item.name}>{item.email}</option>)}</datalist></label>
          <label className="field"><span>Coordinador F1 *</span><input required list="gr-f1-coordinators" value={coordinatorF1} onChange={(event) => setCoordinatorF1(event.target.value)} /><datalist id="gr-f1-coordinators">{f1Coordinators.map((item) => <option key={item.id} value={item.name}>{item.email}</option>)}</datalist></label>
          <label className="field"><span>Proyecto</span><input value={project} onChange={(event) => setProject(event.target.value)} /></label>
          <label className="field"><span>Site Origen</span><input value={originSite} onChange={(event) => setOriginSite(event.target.value)} /></label>
          <label className="field"><span>Ubicación del stock</span><select value={stockLocation} onChange={(event) => setStockLocation(event.target.value)}><option value="MO COMPANY">MO Company</option><option value="F1 - TRÁNSITO">F1 - tránsito</option></select></label>
          <label className="field"><span>Estado de Equipo</span><select value={equipmentStatus} onChange={(event) => setEquipmentStatus(event.target.value)}><option>NUEVO</option><option>USADO</option><option>REPARADO</option></select></label>
          <label className="field"><span>Condición</span><select value={condition} onChange={(event) => setCondition(event.target.value)}><option>OPERATIVO</option><option>OBSERVADO</option><option>INOPERATIVO</option></select></label>
          <label className="field"><span>Propietario</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option>F1 SERVICES</option><option>ENTEL</option><option>WIN</option><option>PRONATEL</option></select></label>
          <label className="field field-wide"><span>Link de GR. de Ingreso</span><input value={grLink} onChange={(event) => setGrLink(event.target.value)} placeholder="Vínculo SharePoint, con o sin https://" /></label>
        </div>
      </section>

      <section className="gr-section gr-table-section"><div className="gr-section-head"><div><span>DETALLE DE LA GR</span><strong>Tabla editable de SKU, series/lotes y cantidades</strong></div><button type="button" className="secondary-button" onClick={addRow}><Plus size={15} />Agregar línea</button></div>
        <datalist id="gr-sku-options">{products.map((product) => <option key={product.id} value={product.sku}>{product.description}</option>)}</datalist>
        <div className="gr-edit-table-wrap"><table className="gr-edit-table"><thead><tr><th>#</th><th>SKU *</th><th>Descripción SKU *</th><th>Serie / Lote *</th><th>Cantidad *</th><th>Unidad</th><th>Control</th><th>Costo unitario</th><th>Resultado</th><th /></tr></thead><tbody>{rows.map((row, index) => {
          const knownProduct = productsBySku.get(normalizeSkuKey(row.sku));
          return <tr className={rowErrors[index].length ? "has-errors" : ""} key={row.key}>
            <td><strong>{index + 1}</strong></td>
            <td><input required list="gr-sku-options" value={row.sku} onChange={(event) => updateRow(index, { sku: event.target.value })} placeholder="ENT..." aria-label={`SKU línea ${index + 1}`} /></td>
            <td><input required readOnly={Boolean(knownProduct)} value={row.description} onChange={(event) => updateRow(index, { description: event.target.value })} placeholder={knownProduct ? "Descripción del maestro" : "SKU nuevo: escribir descripción"} aria-label={`Descripción línea ${index + 1}`} /></td>
            <td><input value={row.seriesLot} onChange={(event) => updateRow(index, { seriesLot: event.target.value.toUpperCase(), lotMode: event.target.value ? "MANUAL" : row.lotMode })} placeholder={row.equipmentType === "EQUIPO" ? "Una serie por línea" : "Lote"} aria-label={`Serie o lote línea ${index + 1}`} /></td>
            <td><input type="number" min="1" step="1" required value={row.quantity} readOnly={row.equipmentType === "EQUIPO" && Boolean(row.seriesLot)} onChange={(event) => updateRow(index, { quantity: Math.max(0, Number(event.target.value)) })} aria-label={`Cantidad línea ${index + 1}`} /></td>
            <td><input value={row.unit} onChange={(event) => updateRow(index, { unit: event.target.value.toUpperCase() })} aria-label={`Unidad línea ${index + 1}`} /></td>
            <td><select value={row.lotMode} onChange={(event) => updateRow(index, { lotMode: event.target.value as EditableRow["lotMode"] })} aria-label={`Control de serie o lote línea ${index + 1}`}><option value="ORIGINAL">Original</option><option value="MANUAL">Manual</option><option value="AUTOMATICO">Automático</option></select><small>{row.equipmentType}</small></td>
            <td><input type="number" min="0" step="0.01" value={row.unitCost} onChange={(event) => updateRow(index, { unitCost: event.target.value })} placeholder="Costo Entel" aria-label={`Costo línea ${index + 1}`} /></td>
            <td><span className={`gr-row-status ${rowErrors[index].length ? "review" : "ready"}`}>{rowErrors[index].length ? `Revisar ${rowErrors[index].join(", ")}` : knownProduct ? "Maestro OK" : "SKU nuevo"}</span></td>
            <td>{rows.length > 1 ? <button type="button" className="icon-button" onClick={() => removeRow(index)} aria-label={`Eliminar línea ${index + 1}`}><Trash2 size={16} /></button> : null}</td>
          </tr>;
        })}</tbody></table></div>
        <div className="gr-table-help"><span><b>Equipo seriado:</b> una fila por serie, cantidad 1 y SKU asociado.</span><span><b>Lote:</b> una fila con su cantidad total.</span><span><b>Descripción:</b> se completa desde Maestro SKU.</span></div>
      </section>

      {!sharedReady ? <div className="gr-submit-note"><AlertTriangle size={16} /><span>Para cargar necesitas un RUC activo, Coordinador Entel y Coordinador F1.</span></div> : null}
      {error ? <div className="inline-error">{error}</div> : null}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={!ready || saving}>{saving ? "Cargando ingreso..." : `Cargar ingreso (${rows.length} línea${rows.length === 1 ? "" : "s"})`}</button></div>
    </form>}
  </div></div>;
}
