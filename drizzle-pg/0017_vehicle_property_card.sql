-- Preserve existing renewals and allow property cards without an artificial expiry date.
ALTER TABLE public.fleet_documents
  DROP CONSTRAINT fleet_document_dates,
  ADD CONSTRAINT fleet_document_dates CHECK (
    (kind = 'TARJETA_PROPIEDAD' AND expiry_date = '')
    OR
    (kind IN ('SOAT', 'REVISION_TECNICA', 'SEGURO') AND expiry_date <> '' AND expiry_date >= start_date)
  );
