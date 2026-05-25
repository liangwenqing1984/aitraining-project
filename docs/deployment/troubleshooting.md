# 部署故障排查手册

## 诊断命令速查

```bash
# 系统综合诊断（推荐首选）
curl http://localhost:3004/api/diagnostics | python3 -m json.tool

# 快速诊断（仅 DB + 系统信息）
curl http://localhost:3004/api/diagnostics?quick=1

# 检查所有容器状态
docker compose -f docker-compose.yml ps
# 离线版
docker compose -f docker-compose.offline.yml ps

# 查看某服务最近日志
docker compose logs --tail=50 backend
docker compose logs --tail=50 trainer
```

---

## 1. Ollama 连接问题

### 症状
- AI 配置页测试连接报错 `fetch failed`
- 日志显示 `baseUrl=http://localhost:11434`
- `Connection refused`

### 根因
Ollama 默认只监听 `127.0.0.1:11434`，Docker 容器内的 `localhost` 指向容器自身，无法访问宿主机的 Ollama。

### 诊断步骤

**Step 1：确认 Ollama 监听地址（宿主机执行）**

```bash
# Linux
ss -tlnp | grep 11434
# Windows
netstat -an | findstr 11434
```

如果输出是 `127.0.0.1:11434`，说明只监听本地，需要改。

**Step 2：让 Ollama 监听所有网卡（宿主机执行）**

```bash
# Linux
export OLLAMA_HOST=0.0.0.0
ollama serve

# Windows — 退出 Ollama 后设置系统环境变量 OLLAMA_HOST=0.0.0.0，重新启动
```

**Step 3：确认数据库配置**

```sql
-- 查当前激活的 Ollama 配置
SELECT id, provider, model_name, base_url, is_active FROM sp_llm_config WHERE provider = 'ollama';

-- 如果 base_url 是 localhost，更新为宿主机实际 IP
UPDATE sp_llm_config SET base_url = 'http://192.168.x.x:11434' WHERE provider = 'ollama' AND is_active = true;
```

**Step 4：验证连通性**

```bash
# 从宿主机测试
curl http://localhost:11434/api/tags

# 进入后端容器测试
docker exec aitrain-backend curl http://<宿主机IP>:11434/api/tags
```

### 环境变量兜底

如果数据库未配置 baseUrl，compose 文件中的 `OLLAMA_BASE_URL` 环境变量作为兜底：

```yaml
environment:
  OLLAMA_BASE_URL: "http://<宿主机IP>:11434"
```

---

## 2. 容器启动失败

### 症状
- `docker compose up -d` 后容器不断重启
- `docker compose ps` 显示 `Restarting`

### 诊断

```bash
# 查看容器日志
docker compose logs backend | tail -30
docker compose logs proxy-pool | tail -30

# 查看容器退出原因
docker inspect aitrain-backend --format '{{.State.Error}}'

# 进入容器交互调试（如果容器能短暂启动）
docker exec -it aitrain-backend bash
```

### 常见原因

| 错误信息 | 原因 | 解决 |
|---------|------|------|
| `exec: if: not found` | compose `command:` 不经过 shell 解析 | 用镜像默认 CMD，不要覆盖 command |
| `ECONNREFUSED postgres:5432` | 数据库未就绪 | 检查 depends_on + healthcheck 配置 |
| `Error: Cannot find module` | 镜像构建不完整 | rebuild: `docker compose build --no-cache backend` |
| `EACCES: permission denied` | 文件权限问题 | `chmod -R 755` 挂载目录 |

---

## 3. CORS 跨域问题

### 症状
浏览器控制台报错：`Access-Control-Allow-Origin` 相关

### 诊断

**Step 1：确认 CORS 配置**

```bash
docker exec aitrain-backend printenv CORS_ORIGIN
```

**Step 2：测试跨域响应头**

```bash
curl -I -H "Origin: http://你的IP:3000" http://localhost:3004/api/health
```

应看到：`Access-Control-Allow-Origin: http://你的IP:3000`

### 解决

```yaml
# compose 中添加或修改
environment:
  CORS_ORIGIN: "http://<实际访问IP>:3000,http://localhost:3000"
```

修改后 `docker compose restart backend`

---

## 4. 数据库连接问题

### 症状
- 后端日志 `ECONNREFUSED`、`getaddrinfo ENOTFOUND postgres`
- `/api/diagnostics` 返回 `database.ok: false`

### 诊断

```bash
# 检查 postgres 容器状态
docker compose ps postgres

# 从后端容器测试连接
docker exec aitrain-backend sh -c "echo '\conninfo' | psql -h postgres -U liangwenqing -d training_exercises"

# 检查 pgvector 扩展
docker exec pgvector-db psql -U liangwenqing -d training_exercises -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

### 数据迁移问题

源库与目标库列顺序不一致时，`pg_dump` 的默认 `VALUES` 格式会导入失败：

```bash
# 正确做法：用 --column-inserts 显式列名
pg_dump -h 源库IP -p 端口 -U 用户名 -d 库名 \
  --schema=liangwenqing -t sp_tasks -t sp_resumes \
  --column-inserts --data-only > dump.sql
```

---

## 5. 模型训练离线问题

### 症状
训练日志显示 `Pre-downloading model` 后失败或超时

### 根因
`pip install sentence-transformers` 只安装库代码，**模型权重文件（.safetensors）需运行时从 HuggingFace Hub 下载**。离线环境无法下载。

### 诊断

```bash
# 检查模型缓存目录
docker exec aitrain-trainer ls -la /hf_cache/hub/

# 检查离线环境变量
docker exec aitrain-trainer printenv HF_HUB_OFFLINE
docker exec aitrain-trainer printenv TRANSFORMERS_OFFLINE
```

### 解决

**联网环境预下载：**

```bash
# prepare-offline.sh 第 5 步会自动处理
# 也可手动执行
python3 scripts/download-hf-models.py --all
```

**确认离线 compose 配置：**

```yaml
trainer:
  volumes:
    - ./code/training/hf_cache:/hf_cache
  environment:
    HF_HOME: /hf_cache
    HF_HUB_OFFLINE: "1"
    TRANSFORMERS_OFFLINE: "1"
```

---

## 6. IP 代理池问题

### 症状
- 爬取任务代理失败
- `/api/diagnostics` 返回 `proxyPool.ok: false`

### 诊断

```bash
# 检查代理池容器
docker compose logs proxy-pool | tail -20

# 测试代理池接口
curl http://localhost:5010/all

# 检查 Redis 连通性
docker exec aitrain-redis redis-cli -a pwd PING
```

### 常见问题

**启动报错 `ImportError: cannot find 'BANNER'`**
→ entrypoint.sh 配置不完整，需包含 BANNER/VERSION/PROXY_FETCHER 等字段

**代理为空**
→ 免费代理源不稳定，连接超时。可在 `code/proxy-pool/repo/` 下添加自有代理获取器

---

## 7. 数据卷与文件权限

### 症状
- `ENOENT: no such file or directory, open '/app/data/csv/...'`
- 爬取日志写入失败

### 诊断

```bash
# 检查挂载目录
docker inspect aitrain-backend --format '{{json .Mounts}}' | python3 -m json.tool

# 进入容器查看目录
docker exec aitrain-backend ls -la /app/data/
```

### 解决

```bash
# 宿主机创建必要目录
mkdir -p code/backend/data/csv
mkdir -p code/backend/data/training

# 确认挂载正确（离线版用 bind mount，在线版用 named volume）
```

注意区分：
- `docker-compose.yml`（在线版）：使用 `backend_data` named volume
- `docker-compose.offline.yml`（离线版）：使用 `./code/backend/data` bind mount

---

## 8. 前端 Vite 代理问题

### 症状
- 前端页面能加载但 API 请求 404
- WebSocket 连接失败

### 根因
前端开发服务器（Vite）通过 proxy 转发 `/api` 和 `/socket.io` 到后端，需要正确配置。

### 检查

```bash
docker exec aitrain-frontend printenv VITE_API_TARGET
# 应为 http://backend:3004
```

### 解决

```yaml
frontend:
  environment:
    VITE_API_TARGET: http://backend:3004
```

---

## 9. Docker Socket 权限

### 症状
后端日志 `permission denied: /var/run/docker.sock`

### 解决

```bash
# 检查 docker.sock 权限
ls -la /var/run/docker.sock

# 如果容器内用户无权限，加入 docker 组
sudo usermod -aG docker $USER
# 或修改 sock 权限（不推荐生产环境）
sudo chmod 666 /var/run/docker.sock
```

---

## 10. 端口占用

### 症状
`bind: address already in use`

```bash
# 查端口占用
ss -tlnp | grep -E "3000|3004|5432|6379|5010"
# Windows
netstat -ano | findstr "3000 3004 5432 6379 5010"

# 批量停止所有容器
docker compose down
```

---

## 紧急恢复流程

```bash
# 1. 全停
docker compose -f docker-compose.yml down

# 2. 清理后重建（保留数据卷）
docker compose -f docker-compose.yml up -d --force-recreate

# 3. 彻底重置（⚠ 会删除数据卷！）
docker compose -f docker-compose.yml down -v
docker compose -f docker-compose.yml up -d

# 4. 逐个服务排查
docker compose start postgres    # 先启数据库
docker compose start redis       # 再启缓存
docker compose start backend     # 再启后端
# 确认 ok 后启其余服务
```
