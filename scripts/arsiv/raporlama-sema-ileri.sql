-- raporlama dalinin sema degisikligi — ILERI (uygula)
--
-- Hedef: Neon > production dali > SQL Editor (HTTPS, 5432 gerekmez)
-- Temel: prisma migrate diff (main -> raporlama), cevrimdisi uretildi.
--
-- Prisma'nin ham ciktisina iki sey eklendi:
--   1. BEGIN/COMMIT — tek islem. Bir ifade patlarsa hicbiri uygulanmaz,
--      yarim kalmis sema olusmaz. (PostgreSQL'de DDL islem icinde calisir.)
--   2. IF NOT EXISTS — tekrar calistirilabilir. Ikinci kez calistirmak zarasiz.
--
-- Tamami ekleyici: hicbir DROP yok, mevcut sutun daraltilmiyor,
-- eklenen uc sutunun ucu de nullable. Mevcut veriye dokunmaz.

BEGIN;

-- Yeni sutunlar (ucu de nullable)
ALTER TABLE "users"         ADD COLUMN IF NOT EXISTS "email_notifications" BOOLEAN DEFAULT true;
ALTER TABLE "board_columns" ADD COLUMN IF NOT EXISTS "allowed_next"        JSON;
ALTER TABLE "tasks"         ADD COLUMN IF NOT EXISTS "completed_at"        TIMESTAMP(6);

-- Kartin her kolon gecisi. Raporlamanin temeli.
CREATE TABLE IF NOT EXISTS "task_transitions" (
    "id"             SERIAL       NOT NULL,
    "project_id"     INTEGER,
    "task_id"        INTEGER,
    "task_title"     VARCHAR(500) NOT NULL,
    "user_id"        INTEGER,
    "user_name"      VARCHAR(200),
    "from_column_id" INTEGER,
    "from_title"     VARCHAR(100),
    "to_column_id"   INTEGER,
    "to_title"       VARCHAR(100),
    "to_is_done"     BOOLEAN,
    "at"             TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_transitions_pkey" PRIMARY KEY ("id")
);

-- Bir kisinin bir goreve harcadigi sure (manuel giris).
CREATE TABLE IF NOT EXISTS "work_logs" (
    "id"         SERIAL       NOT NULL,
    "project_id" INTEGER,
    "task_id"    INTEGER,
    "task_title" VARCHAR(500) NOT NULL,
    "user_id"    INTEGER,
    "user_name"  VARCHAR(200),
    "minutes"    INTEGER      NOT NULL,
    "spent_on"   DATE         NOT NULL,
    "note"       VARCHAR(500),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- Guvenlik denetim kaydi: kim, ne zaman, neyi yapti.
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"           SERIAL      NOT NULL,
    "workspace_id" INTEGER,
    "user_id"      INTEGER,
    "user_name"    VARCHAR(200),
    "action"       VARCHAR(60) NOT NULL,
    "detail"       JSON,
    "ip"           VARCHAR(60),
    "user_agent"   VARCHAR(300),
    "at"           TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Not: bu uc tablo bilerek yabanci anahtar kullanmaz ve denormalize alanlar
-- tasir. Gorev, proje ya da kullanici silinse de kayit yasamali; cop kutusu
-- 30 gunde kalici sildigi icin aksi halde alti aylik rapor delik cikardi.

CREATE INDEX IF NOT EXISTS "ix_tt_project_at"      ON "task_transitions"("project_id", "at");
CREATE INDEX IF NOT EXISTS "ix_tt_task"            ON "task_transitions"("task_id");
CREATE INDEX IF NOT EXISTS "ix_tt_user_at"         ON "task_transitions"("user_id", "at");
CREATE INDEX IF NOT EXISTS "ix_wl_project_spent"   ON "work_logs"("project_id", "spent_on");
CREATE INDEX IF NOT EXISTS "ix_wl_task"            ON "work_logs"("task_id");
CREATE INDEX IF NOT EXISTS "ix_wl_user_spent"      ON "work_logs"("user_id", "spent_on");
CREATE INDEX IF NOT EXISTS "ix_audit_ws_at"        ON "audit_logs"("workspace_id", "at");
CREATE INDEX IF NOT EXISTS "ix_audit_action_at"    ON "audit_logs"("action", "at");
CREATE INDEX IF NOT EXISTS "ix_audit_user_at"      ON "audit_logs"("user_id", "at");
CREATE INDEX IF NOT EXISTS "ix_task_completed_at"  ON "tasks"("completed_at");

COMMIT;
