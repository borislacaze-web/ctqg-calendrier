-- ============================================================
-- CTQG Calendrier Général — Schéma Supabase PostgreSQL
-- À exécuter dans l'ordre dans l'éditeur SQL de Supabase
-- ============================================================

-- Extension UUID (activée par défaut sur Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. SAISONS
-- ============================================================
CREATE TABLE seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,              -- ex: "2026/2027"
  start_date  DATE NOT NULL,              -- toujours 01/07
  end_date    DATE NOT NULL,              -- toujours 30/06 année suivante
  is_active   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Une seule saison active à la fois
CREATE UNIQUE INDEX idx_seasons_active ON seasons (is_active) WHERE is_active = true;

-- ============================================================
-- 2. CATÉGORIES
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#3B82F6',   -- couleur hex
  icon        TEXT NOT NULL DEFAULT 'calendar',  -- nom icône lucide-react
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. SOUS-CATÉGORIES
-- ============================================================
CREATE TABLE subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- 4. ÉVÉNEMENTS
-- ============================================================
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id        UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  category_id      UUID NOT NULL REFERENCES categories(id),
  subcategory_id   UUID REFERENCES subcategories(id),
  title            TEXT NOT NULL,
  description      TEXT,
  location         TEXT,
  target_audience  TEXT,                 -- "Public concerné"
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  week_number      INTEGER,              -- calculé automatiquement
  sport_week_start DATE,                 -- lundi de la semaine sportive
  status           TEXT NOT NULL DEFAULT 'previsionnel'
                   CHECK (status IN ('previsionnel','confirme','annule','reporte')),
  color            TEXT,                 -- couleur personnalisée (optionnel)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_events_season    ON events(season_id);
CREATE INDEX idx_events_category  ON events(category_id);
CREATE INDEX idx_events_dates     ON events(start_date, end_date);
CREATE INDEX idx_events_week      ON events(week_number, season_id);

-- ============================================================
-- 5. DOCUMENTS JOINTS
-- ============================================================
CREATE TABLE event_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  file_url    TEXT NOT NULL,     -- URL Supabase Storage
  file_size   INTEGER,           -- en octets
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. PROFILS UTILISATEURS (extension de auth.users)
-- ============================================================
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'club'
             CHECK (role IN ('admin','club')),
  club_name  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. JOURNAL D'AUDIT
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE')),
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_data    JSONB,
  new_data    JSONB
);

CREATE INDEX idx_audit_record   ON audit_log(record_id);
CREATE INDEX idx_audit_changed  ON audit_log(changed_at DESC);

-- ============================================================
-- FONCTIONS & TRIGGERS
-- ============================================================

-- Calcul automatique de la semaine sportive
-- La semaine sportive commence le lundi.
-- Le numéro de semaine est celui de l'ISO 8601 (lundi = J1).
CREATE OR REPLACE FUNCTION compute_sport_week()
RETURNS TRIGGER AS $$
DECLARE
  monday DATE;
BEGIN
  -- Lundi de la semaine contenant start_date
  monday := NEW.start_date - (EXTRACT(ISODOW FROM NEW.start_date)::INTEGER - 1);
  NEW.sport_week_start := monday;
  NEW.week_number := EXTRACT(WEEK FROM NEW.start_date)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_sport_week
  BEFORE INSERT OR UPDATE OF start_date ON events
  FOR EACH ROW EXECUTE FUNCTION compute_sport_week();

-- Mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Rattachement automatique de l'événement à la bonne saison
CREATE OR REPLACE FUNCTION assign_season()
RETURNS TRIGGER AS $$
DECLARE
  matched_season UUID;
BEGIN
  SELECT id INTO matched_season
  FROM seasons
  WHERE NEW.start_date BETWEEN start_date AND end_date
  LIMIT 1;

  IF matched_season IS NOT NULL THEN
    NEW.season_id := matched_season;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_assign_season
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION assign_season();

-- Journal d'audit automatique sur les événements
CREATE OR REPLACE FUNCTION log_event_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, changed_by, new_data)
    VALUES ('events', NEW.id, 'CREATE', auth.uid(), to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, changed_by, old_data, new_data)
    VALUES ('events', NEW.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, changed_by, old_data)
    VALUES ('events', OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_events_audit
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION log_event_changes();

-- Création automatique du profil utilisateur après inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (NEW.id, 'club');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_new_user_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE seasons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- Lecture publique (calendrier accessible sans connexion)
CREATE POLICY "public_read_seasons"     ON seasons         FOR SELECT USING (true);
CREATE POLICY "public_read_categories"  ON categories      FOR SELECT USING (true);
CREATE POLICY "public_read_subcats"     ON subcategories   FOR SELECT USING (true);
CREATE POLICY "public_read_events"      ON events          FOR SELECT USING (true);
CREATE POLICY "public_read_documents"   ON event_documents FOR SELECT USING (true);

-- Écriture réservée aux admins
CREATE POLICY "admin_all_seasons"     ON seasons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_categories"  ON categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_subcats"     ON subcategories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_events"      ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_all_documents"   ON event_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Profil : lecture par le propriétaire, admins voient tout
CREATE POLICY "own_profile_read" ON user_profiles
  FOR SELECT USING (id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_manage_profiles" ON user_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Audit log : admins uniquement
CREATE POLICY "admin_read_audit" ON audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Saison 2026/2027
INSERT INTO seasons (name, start_date, end_date, is_active)
VALUES ('2026/2027', '2026-07-01', '2027-06-30', true);

-- Catégories (dans l'ordre d'affichage des colonnes du planning)
INSERT INTO categories (name, color, icon, sort_order) VALUES
  ('Compétitions Jeunes',     '#3B82F6', 'trophy',      1),
  ('Compétitions Seniors',    '#8B5CF6', 'medal',       2),
  ('Mini-Basket',             '#F59E0B', 'circle',      3),
  ('Loisirs',                 '#10B981', 'heart',       4),
  ('Réunions',                '#6B7280', 'users',       5),
  ('Formation du Joueur',     '#EF4444', 'graduation',  6),
  ('Formation des Cadres',    '#EC4899', 'book-open',   7),
  ('Commission des Officiels','#14B8A6', 'scale',       8),
  ('Événements ponctuels',    '#F97316', 'star',        9);

-- Sous-catégories — Compétitions Jeunes
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('5c5',  1),
  ('3x3',  2),
  ('U11',  3)
) AS sub(name, ord)
WHERE categories.name = 'Compétitions Jeunes';

-- Sous-catégories — Compétitions Seniors
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('PRF',             1),
  ('PRM',             2),
  ('Coupe Féminine',  3),
  ('Coupe Masculine', 4),
  ('Trophée MPT',     5),
  ('Trophée CM',      6),
  ('Loisirs',         7),
  ('3x3',             8),
  ('3x3 entreprises', 9)
) AS sub(name, ord)
WHERE categories.name = 'Compétitions Seniors';

-- Sous-catégories — Mini-Basket
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('Plateaux U7',          1),
  ('Plateaux U9',          2),
  ('Fête du Mini U7/U9',   3),
  ('Fête du Micro Basket', 4)
) AS sub(name, ord)
WHERE categories.name = 'Mini-Basket';

-- Sous-catégories — Formation du Joueur
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('PPF U11', 1),
  ('PPF U12', 2),
  ('CET',     3)
) AS sub(name, ord)
WHERE categories.name = 'Formation du Joueur';

-- Sous-catégories — Formation des Cadres
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('BF',          1),
  ('Dirigeants',  2)
) AS sub(name, ord)
WHERE categories.name = 'Formation des Cadres';

-- Sous-catégories — Réunions
INSERT INTO subcategories (category_id, name, sort_order)
SELECT id, sub.name, sub.ord FROM categories, (VALUES
  ('Forum de rentrée des clubs',    1),
  ('Bureau Directeur',              2),
  ('Comité Directeur',              3),
  ('Réunion Technique / Mini Basket', 4),
  ('Assemblée Générale',            5)
) AS sub(name, ord)
WHERE categories.name = 'Réunions';
