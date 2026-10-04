-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'BANNED');

-- CreateEnum
CREATE TYPE "ChallengeState" AS ENUM ('VISIBLE', 'HIDDEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('STATIC', 'REGEX', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'INSANE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('CORRECT', 'WRONG', 'DUPLICATE', 'RATE_LIMITED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('JEOPARDY', 'AWD', 'MIXED');

-- CreateEnum
CREATE TYPE "CompetitionState" AS ENUM ('DRAFT', 'PUBLISHED', 'RUNNING', 'FROZEN', 'ENDED');

-- CreateEnum
CREATE TYPE "TeamMode" AS ENUM ('SOLO', 'TEAM', 'BOTH');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('CREATING', 'RUNNING', 'STOPPED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AwxRoundState" AS ENUM ('PENDING', 'RUNNING', 'FINISHED', 'SETTLED');

-- CreateEnum
CREATE TYPE "WriteupState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "email" VARCHAR(128),
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(48),
    "avatar" VARCHAR(512),
    "bio" VARCHAR(512),
    "website" VARCHAR(128),
    "country" VARCHAR(64),
    "organization" VARCHAR(64),
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" VARCHAR(64),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" VARCHAR(255),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(64),
    "locale" VARCHAR(8) NOT NULL DEFAULT 'zh-CN',
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "affiliation" VARCHAR(32),
    "description" VARCHAR(1000),
    "avatar" VARCHAR(512),
    "website" VARCHAR(128),
    "invite_code" VARCHAR(32),
    "open_join" BOOLEAN NOT NULL DEFAULT true,
    "score" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "captain_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" BIGSERIAL NOT NULL,
    "team_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "captain" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" BIGSERIAL NOT NULL,
    "team_id" BIGINT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "target_user_id" BIGINT,
    "created_by" BIGINT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "used_by" BIGINT,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "description" VARCHAR(255),
    "icon" VARCHAR(32),
    "color" VARCHAR(16),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "hint_preview" TEXT,
    "category_id" BIGINT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'EASY',
    "state" "ChallengeState" NOT NULL DEFAULT 'VISIBLE',
    "scoring_type" "ScoringType" NOT NULL DEFAULT 'STATIC',
    "score" INTEGER NOT NULL DEFAULT 100,
    "min_score" INTEGER NOT NULL DEFAULT 20,
    "decay" INTEGER NOT NULL DEFAULT 30,
    "author_id" BIGINT,
    "solve_count" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 0,
    "requires_container" BOOLEAN NOT NULL DEFAULT false,
    "docker_image" VARCHAR(255),
    "container_port" INTEGER,
    "connection_type" VARCHAR(16) NOT NULL DEFAULT 'tcp',
    "connection_info" TEXT,
    "cpu_limit" VARCHAR(16) NOT NULL DEFAULT '0.5',
    "memory_limit_mb" INTEGER NOT NULL DEFAULT 256,
    "instance_ttl_seconds" INTEGER NOT NULL DEFAULT 3600,
    "allow_download" BOOLEAN NOT NULL DEFAULT true,
    "allow_writeup" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_flags" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "flag" VARCHAR(512) NOT NULL,
    "type" "FlagType" NOT NULL DEFAULT 'STATIC',
    "case_sensitive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "challenge_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_files" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "sha256" VARCHAR(64),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hints" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "deduct_from_challenge" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_unlocks" (
    "id" BIGSERIAL NOT NULL,
    "hint_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(48) NOT NULL,
    "color" VARCHAR(16),
    "usage_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_tags" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    CONSTRAINT "challenge_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT,
    "competition_id" BIGINT,
    "flag" VARCHAR(512) NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solves" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT,
    "competition_id" BIGINT NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL,
    "first_blood" BOOLEAN NOT NULL DEFAULT false,
    "second_blood" BOOLEAN NOT NULL DEFAULT false,
    "third_blood" BOOLEAN NOT NULL DEFAULT false,
    "solve_seconds" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "subtitle" VARCHAR(255),
    "slug" VARCHAR(16) NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "banner" VARCHAR(512),
    "type" "CompetitionType" NOT NULL DEFAULT 'JEOPARDY',
    "state" "CompetitionState" NOT NULL DEFAULT 'DRAFT',
    "team_mode" "TeamMode" NOT NULL DEFAULT 'BOTH',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "freeze_at" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "join_password" VARCHAR(64),
    "max_participants" INTEGER NOT NULL DEFAULT 0,
    "min_team_size" INTEGER NOT NULL DEFAULT 1,
    "max_team_size" INTEGER NOT NULL DEFAULT 4,
    "need_approval" BOOLEAN NOT NULL DEFAULT false,
    "hide_scoreboard" BOOLEAN NOT NULL DEFAULT false,
    "hide_challenges" BOOLEAN NOT NULL DEFAULT false,
    "practice_after" BOOLEAN NOT NULL DEFAULT true,
    "awd_round_seconds" INTEGER NOT NULL DEFAULT 300,
    "awd_attack_score" INTEGER NOT NULL DEFAULT 50,
    "awd_defense_penalty" INTEGER NOT NULL DEFAULT 50,
    "awd_base_score" INTEGER NOT NULL DEFAULT 20,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_challenges" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "custom_score" INTEGER,

    CONSTRAINT "competition_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_participants" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'APPROVED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "last_solve_at" TIMESTAMP(3),
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_announcements" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_instances" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "team_id" BIGINT,
    "competition_id" BIGINT NOT NULL DEFAULT 0,
    "container_id" VARCHAR(128),
    "host" VARCHAR(128),
    "port" INTEGER,
    "status" "InstanceStatus" NOT NULL DEFAULT 'CREATING',
    "error_message" VARCHAR(500),
    "instance_flag" VARCHAR(512),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_rounds" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "round_no" INTEGER NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "state" "AwxRoundState" NOT NULL DEFAULT 'PENDING',
    "settled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "awx_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_services" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "challenge_id" BIGINT,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "docker_image" VARCHAR(255) NOT NULL,
    "internal_port" INTEGER NOT NULL,
    "protocol" VARCHAR(16) NOT NULL DEFAULT 'tcp',
    "reset_command" VARCHAR(512),
    "flag_env" VARCHAR(64) NOT NULL DEFAULT 'FLAG',
    "flag_file" VARCHAR(255),
    "flag_template" VARCHAR(255) NOT NULL DEFAULT 'flag{{{random}}}',
    "check_path" VARCHAR(255),
    "checker_script" TEXT,
    "base_score" INTEGER NOT NULL DEFAULT 0,
    "cpu_limit" VARCHAR(16) NOT NULL DEFAULT '1',
    "memory_limit_mb" INTEGER NOT NULL DEFAULT 512,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "awx_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_targets" (
    "id" BIGSERIAL NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "awx_service_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "container_id" VARCHAR(128),
    "host" VARCHAR(128),
    "port" INTEGER,
    "status" "InstanceStatus" NOT NULL DEFAULT 'CREATING',
    "error_message" VARCHAR(500),
    "current_flag" VARCHAR(512),
    "fail_streak" INTEGER NOT NULL DEFAULT 0,
    "alive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awx_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_flags" (
    "id" BIGSERIAL NOT NULL,
    "round_id" BIGINT NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "flag" VARCHAR(512) NOT NULL,
    "captured_count" INTEGER NOT NULL DEFAULT 0,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awx_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_checks" (
    "id" BIGSERIAL NOT NULL,
    "round_id" BIGINT NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "awx_service_id" BIGINT NOT NULL,
    "team_id" BIGINT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "delta" INTEGER NOT NULL DEFAULT 0,
    "message" VARCHAR(500),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awx_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awx_attacks" (
    "id" BIGSERIAL NOT NULL,
    "round_id" BIGINT NOT NULL,
    "competition_id" BIGINT NOT NULL,
    "attacker_team_id" BIGINT NOT NULL,
    "attacker_user_id" BIGINT,
    "victim_target_id" BIGINT NOT NULL,
    "victim_team_id" BIGINT NOT NULL,
    "awx_service_id" BIGINT NOT NULL,
    "flag" VARCHAR(512) NOT NULL,
    "attacker_delta" INTEGER NOT NULL,
    "victim_delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awx_attacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writeups" (
    "id" BIGSERIAL NOT NULL,
    "challenge_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT,
    "url" VARCHAR(512),
    "state" "WriteupState" NOT NULL DEFAULT 'PENDING',
    "reject_reason" VARCHAR(255),
    "likes" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writeups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "level" VARCHAR(16) NOT NULL DEFAULT 'INFO',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "type" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(1000),
    "link" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" BIGSERIAL NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "category" VARCHAR(32) NOT NULL DEFAULT 'OTHER',
    "priority" VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "user_id" BIGINT NOT NULL,
    "assignee_id" BIGINT,
    "ref_type" VARCHAR(32),
    "ref_id" BIGINT,
    "last_reply_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "content" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" BIGINT,
    "actor_name" VARCHAR(64),
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32),
    "target_id" TEXT,
    "detail" VARCHAR(1000),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "prefix" VARCHAR(16),
    "scopes" VARCHAR(255),
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "ref_type" VARCHAR(32),
    "ref_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" BIGSERIAL NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "content_type" VARCHAR(128),
    "size" BIGINT NOT NULL DEFAULT 0,
    "sha256" VARCHAR(64),
    "user_id" BIGINT,
    "scope" VARCHAR(32) NOT NULL DEFAULT 'other',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "username" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_score_idx" ON "users"("score");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teams_invite_code_key" ON "teams"("invite_code");

-- CreateIndex
CREATE INDEX "teams_score_idx" ON "teams"("score");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_user_id_key" ON "team_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_code_key" ON "team_invites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "challenges_category_id_idx" ON "challenges"("category_id");

-- CreateIndex
CREATE INDEX "challenges_state_idx" ON "challenges"("state");

-- CreateIndex
CREATE UNIQUE INDEX "hint_unlocks_hint_id_user_id_key" ON "hint_unlocks"("hint_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_tags_challenge_id_tag_id_key" ON "challenge_tags"("challenge_id", "tag_id");

-- CreateIndex
CREATE INDEX "submissions_user_id_id_idx" ON "submissions"("user_id", "id");

-- CreateIndex
CREATE INDEX "submissions_challenge_id_id_idx" ON "submissions"("challenge_id", "id");

-- CreateIndex
CREATE INDEX "submissions_competition_id_id_idx" ON "submissions"("competition_id", "id");

-- CreateIndex
CREATE INDEX "solves_challenge_id_idx" ON "solves"("challenge_id");

-- CreateIndex
CREATE INDEX "solves_competition_id_idx" ON "solves"("competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "solves_user_id_challenge_id_competition_id_key" ON "solves"("user_id", "challenge_id", "competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");

-- CreateIndex
CREATE INDEX "competitions_start_at_end_at_idx" ON "competitions"("start_at", "end_at");

-- CreateIndex
CREATE UNIQUE INDEX "competition_challenges_competition_id_challenge_id_key" ON "competition_challenges"("competition_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "competition_participants_competition_id_user_id_key" ON "competition_participants"("competition_id", "user_id");

-- CreateIndex
CREATE INDEX "challenge_instances_user_id_challenge_id_idx" ON "challenge_instances"("user_id", "challenge_id");

-- CreateIndex
CREATE INDEX "challenge_instances_status_idx" ON "challenge_instances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "awx_rounds_competition_id_round_no_key" ON "awx_rounds"("competition_id", "round_no");

-- CreateIndex
CREATE UNIQUE INDEX "awx_targets_awx_service_id_team_id_key" ON "awx_targets"("awx_service_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "awx_flags_flag_key" ON "awx_flags"("flag");

-- CreateIndex
CREATE INDEX "awx_flags_flag_idx" ON "awx_flags"("flag");

-- CreateIndex
CREATE INDEX "awx_flags_round_id_idx" ON "awx_flags"("round_id");

-- CreateIndex
CREATE INDEX "awx_checks_round_id_team_id_idx" ON "awx_checks"("round_id", "team_id");

-- CreateIndex
CREATE INDEX "awx_attacks_round_id_idx" ON "awx_attacks"("round_id");

-- CreateIndex
CREATE INDEX "awx_attacks_competition_id_idx" ON "awx_attacks"("competition_id");

-- CreateIndex
CREATE INDEX "writeups_challenge_id_idx" ON "writeups"("challenge_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_id_idx" ON "notifications"("user_id", "is_read", "id");

-- CreateIndex
CREATE INDEX "tickets_status_id_idx" ON "tickets"("status", "id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_id_idx" ON "ticket_messages"("ticket_id", "id");

-- CreateIndex
CREATE INDEX "audit_logs_id_idx" ON "audit_logs"("id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_token_hash_idx" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "point_logs_user_id_id_idx" ON "point_logs"("user_id", "id");

-- CreateIndex
CREATE INDEX "login_logs_user_id_id_idx" ON "login_logs"("user_id", "id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_flags" ADD CONSTRAINT "challenge_flags_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_files" ADD CONSTRAINT "challenge_files_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_hint_id_fkey" FOREIGN KEY ("hint_id") REFERENCES "hints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tags" ADD CONSTRAINT "challenge_tags_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tags" ADD CONSTRAINT "challenge_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solves" ADD CONSTRAINT "solves_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solves" ADD CONSTRAINT "solves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solves" ADD CONSTRAINT "solves_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_challenges" ADD CONSTRAINT "competition_challenges_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_challenges" ADD CONSTRAINT "competition_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_announcements" ADD CONSTRAINT "competition_announcements_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_instances" ADD CONSTRAINT "challenge_instances_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_rounds" ADD CONSTRAINT "awx_rounds_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_services" ADD CONSTRAINT "awx_services_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_services" ADD CONSTRAINT "awx_services_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_targets" ADD CONSTRAINT "awx_targets_awx_service_id_fkey" FOREIGN KEY ("awx_service_id") REFERENCES "awx_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_targets" ADD CONSTRAINT "awx_targets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_flags" ADD CONSTRAINT "awx_flags_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "awx_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_flags" ADD CONSTRAINT "awx_flags_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "awx_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_flags" ADD CONSTRAINT "awx_flags_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_checks" ADD CONSTRAINT "awx_checks_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "awx_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_checks" ADD CONSTRAINT "awx_checks_awx_service_id_fkey" FOREIGN KEY ("awx_service_id") REFERENCES "awx_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_checks" ADD CONSTRAINT "awx_checks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_attacks" ADD CONSTRAINT "awx_attacks_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "awx_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_attacks" ADD CONSTRAINT "awx_attacks_awx_service_id_fkey" FOREIGN KEY ("awx_service_id") REFERENCES "awx_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_attacks" ADD CONSTRAINT "awx_attacks_victim_target_id_fkey" FOREIGN KEY ("victim_target_id") REFERENCES "awx_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awx_attacks" ADD CONSTRAINT "awx_attacks_attacker_user_id_fkey" FOREIGN KEY ("attacker_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writeups" ADD CONSTRAINT "writeups_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writeups" ADD CONSTRAINT "writeups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_logs" ADD CONSTRAINT "point_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
