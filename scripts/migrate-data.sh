#!/bin/bash
# ============================================================================
# 数据迁移脚本：将 10.1.1.113 的数据迁移到 192.168.137.20
# 用法：bash scripts/migrate-data.sh
# ============================================================================
set -e

SOURCE_HOST="10.1.1.113"
SOURCE_PORT="7300"
SOURCE_USER="liangwenqing"
SOURCE_DB="training_exercises"

TARGET_HOST="192.168.137.20"
TARGET_PORT="5432"
TARGET_USER="liangwenqing"
TARGET_DB="training_exercises"

# 导出密码（如果两台机器密码不同，请修改）
export PGPASSWORD="liangwenqing"
SOURCE_PGPASSWORD="${SOURCE_PGPASSWORD:-liangwenqing}"
TARGET_PGPASSWORD="${TARGET_PGPASSWORD:-liangwenqing}"

DUMP_DIR="/tmp/db_migration_$(date +%Y%m%d_%H%M%S)"

echo "============================================"
echo "  数据迁移"
echo "  源: ${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
echo "  目标: ${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}"
echo "============================================"

mkdir -p "$DUMP_DIR"

# ---- 第一步：导出源库 schema + 数据 ----
echo ""
echo "[1/4] 导出源库 schema..."
PGPASSWORD="$SOURCE_PGPASSWORD" pg_dump \
  -h "$SOURCE_HOST" -p "$SOURCE_PORT" \
  -U "$SOURCE_USER" -d "$SOURCE_DB" \
  --schema-only \
  --no-owner --no-privileges \
  -f "$DUMP_DIR/schema.sql"
echo "  完成: $DUMP_DIR/schema.sql"

echo ""
echo "[2/4] 导出源库数据（INSERT 格式）..."
PGPASSWORD="$SOURCE_PGPASSWORD" pg_dump \
  -h "$SOURCE_HOST" -p "$SOURCE_PORT" \
  -U "$SOURCE_USER" -d "$SOURCE_DB" \
  --data-only \
  --inserts \
  --no-owner --no-privileges \
  --rows-per-insert=50 \
  -f "$DUMP_DIR/data.sql"
echo "  完成: $DUMP_DIR/data.sql ($(wc -c < "$DUMP_DIR/data.sql") 字节)"

# ---- 第二步：在目标库创建 schema（先建 schema + vector 扩展） ----
echo ""
echo "[3/4] 在目标库创建 schema 和 pgvector 扩展..."
PGPASSWORD="$TARGET_PGPASSWORD" psql \
  -h "$TARGET_HOST" -p "$TARGET_PORT" \
  -U "$TARGET_USER" -d "$TARGET_DB" \
  -c "CREATE SCHEMA IF NOT EXISTS AUTHORIZATION $TARGET_USER;"
PGPASSWORD="$TARGET_PGPASSWORD" psql \
  -h "$TARGET_HOST" -p "$TARGET_PORT" \
  -U "$TARGET_USER" -d "$TARGET_DB" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo "  完成"

# 导入 schema
echo ""
echo "[3/4] 导入表结构..."
PGPASSWORD="$TARGET_PGPASSWORD" psql \
  -h "$TARGET_HOST" -p "$TARGET_PORT" \
  -U "$TARGET_USER" -d "$TARGET_DB" \
  -f "$DUMP_DIR/schema.sql" \
  2>&1 | tail -5
echo "  表结构导入完成"

# ---- 第三步：导入数据 ----
echo ""
echo "[4/4] 导入数据（可能需要几分钟）..."
PGPASSWORD="$TARGET_PGPASSWORD" psql \
  -h "$TARGET_HOST" -p "$TARGET_PORT" \
  -U "$TARGET_USER" -d "$TARGET_DB" \
  -f "$DUMP_DIR/data.sql" \
  2>&1 | tail -10
echo "  数据导入完成"

# ---- 第四步：验证 ----
echo ""
echo "============================================"
echo "  迁移完成，验证数据行数..."
echo "============================================"

TABLES=(
  "sp_tasks" "sp_csv_files" "sp_jobs" "sp_llm_config"
  "sp_job_enrichments" "sp_market_reports" "sp_saved_queries"
  "sp_job_embeddings" "sp_resumes" "sp_internal_jobs"
  "sp_screening_results" "sp_users" "sp_roles" "sp_permissions"
  "sp_menus" "sp_user_roles" "sp_role_permissions" "sp_role_menus"
  "sp_prompts" "sp_doc_embeddings" "sp_training_jobs"
  "sp_chat_sessions" "sp_chat_messages"
)

for table in "${TABLES[@]}"; do
  SOURCE_COUNT=$(PGPASSWORD="$SOURCE_PGPASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "N/A")
  TARGET_COUNT=$(PGPASSWORD="$TARGET_PGPASSWORD" psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$TARGET_DB" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "N/A")
  if [ "$SOURCE_COUNT" = "$TARGET_COUNT" ]; then
    STATUS="✓"
  else
    STATUS="✗"
  fi
  printf "  %-28s  源: %6s  目标: %6s  %s\n" "$table" "$SOURCE_COUNT" "$TARGET_COUNT" "$STATUS"
done

echo ""
echo "迁移文件保存在: $DUMP_DIR"
echo "如确认数据无误，可删除: rm -rf $DUMP_DIR"
