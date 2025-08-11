-- Add arsivli flag to gorevler if missing, plus index (idempotent)
ALTER TABLE IF EXISTS public.gorevler
  ADD COLUMN IF NOT EXISTS arsivli boolean NOT NULL DEFAULT false;

-- Helpful index for filtering
CREATE INDEX IF NOT EXISTS gorevler_arsivli_idx ON public.gorevler(arsivli);
