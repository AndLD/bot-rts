-- AlterEnum
ALTER TYPE "user_status" ADD VALUE 'moderator';
ALTER TYPE "user_status" ADD VALUE 'analyst';

-- CreateTable
CREATE TABLE "admin_two_factors" (
    "user_id" UUID NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "enabled_at" TIMESTAMPTZ(3),
    "last_used_step" BIGINT,
    "recovery_code_hashes" TEXT[],

    CONSTRAINT "admin_two_factors_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "admin_session_verifications" (
    "session_id" UUID NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_session_verifications_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,
    "actor_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "request_id" TEXT,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_log_at_idx" ON "admin_audit_log"("at");

-- CreateIndex
CREATE INDEX "admin_audit_log_actor_id_at_idx" ON "admin_audit_log"("actor_id", "at");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_at_idx" ON "admin_audit_log"("action", "at");

-- AddForeignKey
ALTER TABLE "admin_two_factors" ADD CONSTRAINT "admin_two_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_session_verifications" ADD CONSTRAINT "admin_session_verifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The audit trail is append-only: no update, delete or truncate, whoever asks
CREATE FUNCTION admin_audit_log_reject_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_audit_log_append_only
  BEFORE UPDATE OR DELETE ON "admin_audit_log"
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_reject_change();

CREATE TRIGGER admin_audit_log_no_truncate
  BEFORE TRUNCATE ON "admin_audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION admin_audit_log_reject_change();
