CREATE TABLE IF NOT EXISTS public.f1_os_requests (
  id uuid PRIMARY KEY,
  owner_email text NOT NULL,
  coordinator text NOT NULL,
  collector text NOT NULL,
  site text NOT NULL,
  description text NOT NULL,
  cost numeric(14,2) NOT NULL CHECK (cost > 0),
  lpu numeric(14,2) NOT NULL CHECK (lpu >= 0),
  reference text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE public.f1_os_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.f1_os_requests FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS f1_os_requests_owner_idx ON public.f1_os_requests (owner_email, created_at DESC);
