-- Admin read scopes on API keys (design §25.2): granted from the admin console, with a reason and an optional address allowlist
ALTER TABLE "api_keys" ADD COLUMN "is_admin_key" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "grant_reason" TEXT,
ADD COLUMN "ip_allow_list" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- The audit trail records the key of a call made with one
ALTER TABLE "admin_audit_log" ADD COLUMN "api_key_id" UUID;
