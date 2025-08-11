-- GPS Sefer Takip Uygulaması - Supabase Backend Kurulumu
-- Bu SQL komutlarını Supabase SQL Editor'da sırayla çalıştırın

-- 1) Gerekli eklentiler
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2) Sefer durumu enum'u
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sefer_durumu') THEN
    CREATE TYPE sefer_durumu AS ENUM ('atanmamis','beklemede','aktif','tamamlandı','iptal');
  END IF;
END $$;

-- 3) Görevler tablosu
CREATE TABLE IF NOT EXISTS public.gorevler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ilan_no TEXT NOT NULL,
  sofor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sefer_durumu sefer_durumu NOT NULL DEFAULT 'beklemede',
  konum_verisi JSONB NOT NULL DEFAULT '[]'::jsonb,
  varis_konum GEOGRAPHY(Point,4326),
  baslama_zamani TIMESTAMPTZ,
  bitis_zamani TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Tamamlandı'dan geri dönüşü engelle
  CONSTRAINT sefer_durumu_final_immutable CHECK (
    NOT (sefer_durumu <> 'tamamlandı' AND bitis_zamani IS NOT NULL)
  )
);

-- 4) İndeksler
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(sefer_durumu);
CREATE INDEX IF NOT EXISTS idx_gorevler_varis_gix ON public.gorevler USING GIST (varis_konum);

-- 5) updated_at tetikleyici
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gorevler_updated_at ON public.gorevler;
CREATE TRIGGER trg_gorevler_updated_at
  BEFORE UPDATE ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) RLS (Row Level Security) politikaları
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;

-- Sadece kendi kayıtlarını görebilsin
CREATE POLICY IF NOT EXISTS gorevler_select_own
  ON public.gorevler
  FOR SELECT
  TO authenticated
  USING (sofor_id = auth.uid());

-- Kendi kaydını güncelle; tamamlandı ise artık güncelleyemesin
CREATE POLICY IF NOT EXISTS gorevler_update_own_active
  ON public.gorevler
  FOR UPDATE
  TO authenticated
  USING (sofor_id = auth.uid() AND sefer_durumu <> 'tamamlandı')
  WITH CHECK (sofor_id = auth.uid());

-- Test için kendi kaydını ekleyebilsin (üretimde kaldırın)
CREATE POLICY IF NOT EXISTS gorevler_insert_own
  ON public.gorevler
  FOR INSERT
  TO authenticated
  WITH CHECK (sofor_id = auth.uid());

-- 7) Sefer durumu geçiş kontrolü
CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.sefer_durumu = 'tamamlandı' AND NEW.sefer_durumu <> 'tamamlandı') THEN
    RAISE EXCEPTION 'Tamamlanan sefer tekrar aktif edilemez';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gorevler_status_guard ON public.gorevler;
CREATE TRIGGER trg_gorevler_status_guard
  BEFORE UPDATE ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_transition();

-- 8) RPC: Sefer başlat
CREATE OR REPLACE FUNCTION public.start_sefer(g_id UUID)
RETURNS public.gorevler
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.gorevler g
     SET sefer_durumu = 'aktif',
         baslama_zamani = COALESCE(g.baslama_zamani, NOW())
   WHERE g.id = g_id
     AND g.sofor_id = auth.uid()
     AND g.sefer_durumu = 'beklemede'
  RETURNING *;
$$;

-- 9) RPC: Sefer sonlandır
CREATE OR REPLACE FUNCTION public.stop_sefer(g_id UUID)
RETURNS public.gorevler
LANGUAGE sql
SECURITY INVOKER
AS $$
  UPDATE public.gorevler g
     SET sefer_durumu = 'tamamlandı',
         bitis_zamani = NOW()
   WHERE g.id = g_id
     AND g.sofor_id = auth.uid()
     AND g.sefer_durumu <> 'tamamlandı'
  RETURNING *;
$$;

-- 10) RPC: Konum güncelle ve varış kontrolü
CREATE OR REPLACE FUNCTION public.update_konum(
  g_id UUID,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  speed DOUBLE PRECISION DEFAULT NULL,
  accuracy DOUBLE PRECISION DEFAULT NULL,
  bearing DOUBLE PRECISION DEFAULT NULL,
  ts TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  sefer_durumu_result sefer_durumu,
  auto_completed BOOLEAN,
  bitis_zamani TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  reached BOOLEAN := FALSE;
BEGIN
  -- Sadece sahibinin ve aktif/beklemede seferlerde çalışsın
  PERFORM 1 FROM public.gorevler
   WHERE gorevler.id = g_id 
     AND sofor_id = auth.uid() 
     AND sefer_durumu IN ('aktif','beklemede');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Yetki yok veya sefer aktif/beklemede değil';
  END IF;

  -- Varış kontrolü (varis_konum doluysa ve 50m içiyse)
  IF EXISTS (
    SELECT 1 FROM public.gorevler
     WHERE gorevler.id = g_id
       AND varis_konum IS NOT NULL
       AND ST_DWithin(
             varis_konum,
             ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
             50
           )
  ) THEN
    reached := TRUE;
  END IF;

  IF reached THEN
    -- Hedefe ulaştı, seferi otomatik bitir
    UPDATE public.gorevler g
       SET sefer_durumu = 'tamamlandı',
           bitis_zamani = NOW(),
           konum_verisi = COALESCE(g.konum_verisi, '[]'::jsonb) ||
                          jsonb_build_array(
                            jsonb_build_object(
                              'lat', lat, 'lon', lon,
                              'speed', speed, 'accuracy', accuracy,
                              'bearing', bearing, 'ts', ts
                            )
                          )
     WHERE g.id = g_id AND g.sofor_id = auth.uid()
    RETURNING g.id, g.sefer_durumu, TRUE, g.bitis_zamani
    INTO update_konum.id, update_konum.sefer_durumu_result, update_konum.auto_completed, update_konum.bitis_zamani;
  ELSE
    -- Normal konum güncellemesi
    UPDATE public.gorevler g
       SET konum_verisi = COALESCE(g.konum_verisi, '[]'::jsonb) ||
                          jsonb_build_array(
                            jsonb_build_object(
                              'lat', lat, 'lon', lon,
                              'speed', speed, 'accuracy', accuracy,
                              'bearing', bearing, 'ts', ts
                            )
                          ),
           -- Beklemede ise ilk konumla otomatik aktif yap
           sefer_durumu = CASE WHEN g.sefer_durumu = 'beklemede' THEN 'aktif'::sefer_durumu ELSE g.sefer_durumu END,
           baslama_zamani = CASE WHEN g.sefer_durumu = 'beklemede' THEN COALESCE(g.baslama_zamani, NOW()) ELSE g.baslama_zamani END
     WHERE g.id = g_id AND g.sofor_id = auth.uid()
    RETURNING g.id, g.sefer_durumu, FALSE, g.bitis_zamani
    INTO update_konum.id, update_konum.sefer_durumu_result, update_konum.auto_completed, update_konum.bitis_zamani;
  END IF;

  RETURN NEXT;
END $$;

-- 11) RPC: Aktif görevleri getir
CREATE OR REPLACE FUNCTION public.get_active_gorevler()
RETURNS SETOF public.gorevler
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT *
    FROM public.gorevler
   WHERE sofor_id = auth.uid()
     AND sefer_durumu IN ('beklemede','aktif')
   ORDER BY created_at DESC;
$$;

-- 12) Realtime için tablo yayınına ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.gorevler;

-- İşlem tamamlandı!
SELECT 'Supabase backend kurulumu tamamlandı!' as status;
