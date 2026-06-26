-- ============================================================
-- CTQG — Configuration Supabase Storage
-- À exécuter APRÈS supabase_schema.sql
-- ============================================================

-- Créer le bucket pour les documents des événements
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-documents', 'event-documents', true);

-- Lecture publique des fichiers
CREATE POLICY "public_read_event_docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-documents');

-- Upload réservé aux admins
CREATE POLICY "admin_upload_event_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'event-documents' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Suppression réservée aux admins
CREATE POLICY "admin_delete_event_docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'event-documents' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
