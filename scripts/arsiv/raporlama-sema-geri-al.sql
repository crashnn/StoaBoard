-- raporlama dalinin sema degisikligi — GERI AL
--
-- Hedef: Neon > ilgili dal > SQL Editor
-- Temel: prisma migrate diff (raporlama -> main), cevrimdisi uretildi.
-- BEGIN/COMMIT ve IF EXISTS eklendi: tek islem, tekrar calistirilabilir.
--
-- Sadece raporlama turunun ekledigi 3 tablo, 3 sutun ve 1 index'i kaldirir.
-- Mevcut uretim verisine dokunmaz. Silinen tek sey: bu tablolarda toplanan
-- gecis/sure/denetim kayitlari.

BEGIN;

DROP INDEX IF EXISTS "ix_task_completed_at";

ALTER TABLE "users"         DROP COLUMN IF EXISTS "email_notifications";
ALTER TABLE "board_columns" DROP COLUMN IF EXISTS "allowed_next";
ALTER TABLE "tasks"         DROP COLUMN IF EXISTS "completed_at";

DROP TABLE IF EXISTS "task_transitions";
DROP TABLE IF EXISTS "work_logs";
DROP TABLE IF EXISTS "audit_logs";

COMMIT;
