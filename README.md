# iResume · 面试前准备工作台

给即将开始面试的面试官：上传简历或粘贴文字，快速获得候选人速览、重点经历、待核实点和有价值的问题。每道问题包含验证目标、听取重点、追问方向与原文依据。

## 功能

- PDF、DOCX、DOC、TXT、Markdown、RTF、PNG、JPEG、WebP；扫描 PDF 和图片使用本地中英文 OCR。
- 简历加可选 JD，一次启动快速简报；需要时再生成深入准备。
- 原文依据、复制问题、打印简报、历史检索与分页。
- CometAPI、OpenAI 兼容接口、AWS Bedrock（Runtime / Converse 与 Mantle / Responses 自动路由，区域与 inference profile、AWS 默认凭据链或 Bearer API key）。
- 持久化任务、并发去重、失败保留原结果；不再提供语音录制或面试中功能。
- 生产访问口令、HTTP-only 会话、设置密钥加密存储。模型凭据不会返回浏览器。

## 本地运行

需要 Node.js 22.13+。

```sh
npm ci
npm run setup:ocr
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

在模型设置中配置连接，也可以使用环境变量。已有通过旧版 `db push` 创建的数据库应先备份，再按实际已有表结构建立 migration baseline，不能直接重跑新增列迁移；不要 reset 数据库。

## 环境变量

- `DATABASE_URL`：SQLite 文件地址。
- `AI_PROVIDER`：`CometAPI` / `OpenAI-compatible` / `Bedrock`。
- `AI_MODEL`：默认模型 ID；Bedrock 也可填 inference profile ID/ARN。
- `COMETAPI_API_KEY` / `OPENAI_API_KEY`：对应兼容服务凭据。
- `AI_BASE_URL`：兼容接口地址，默认按服务商选择。
- `AWS_REGION` / `AWS_BEARER_TOKEN_BEDROCK`：Bedrock 区域和可选 API key；也支持标准 AWS 凭据链。裸 `openai.*` 模型 ID 自动走 Mantle / Responses，需要 API key；`us.` / `global.` 推理配置或 ARN 保留 Runtime / Converse。
- `APP_SECRET`：至少 32 字符的随机密钥，保护会话和已存模型密钥；务必备份，切勿随意轮换。
- `APP_PASSWORD`：生产访问口令；生产环境缺失时拒绝访问。
- `APP_ORIGIN`：浏览器访问的完整 origin，例如 `https://resume.example.com`。
- `OCR_LANG_PATH`：本地 OCR 语言包目录，默认 `./tessdata`。

数据库中保存的设置优先于环境默认值。留空密钥表示保持原值，清空操作应使用显式 clear 字段。切换服务商时不会携带输入中的密钥草稿。

## 输入限制与任务行为

单文件 10MB；文本 120,000 字符，JD 16,000 字符；PDF 最多 30 页，其中最多 10 页 OCR。DOCX 解压单项 20MB、合计 40MB、最多 2,000 项。超过限制给出明确提示，不静默截断。OCR 使用固定版本、校验过 SHA256 的 Tesseract 中英文数据，不将图片发送给外部 OCR 服务。

简报任务总时限 90 秒，结构或引用不合格最多重新生成一次。刷新后读取数据库状态；服务中断遗留任务在 120 秒后标记失败，已有简报保留。单实例部署，不依赖临时浏览器连接继续运行。

## 部署

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3001
```

`deploy/iresume.service.template` 提供 systemd 用户服务模板；`deploy/Caddyfile` 提供 HTTPS 反向代理。运行数据、环境凭据放在仓库外，备份 SQLite 和 APP_SECRET。也提供 Docker Compose 单实例部署配置。

## 验证

```sh
npm test
npm run typecheck
npm run build
```

测试覆盖输入解析、OCR、JSON/证据校验、任务并发和访问保护。模型结果属于面试准备建议，未提供的信息以待核实事项呈现，最终判断由面试官完成。
