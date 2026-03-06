# 简历智评 - AI Resume Analyzer

> 上传简历 PDF，AI 自动生成深度面试评估报告，帮助面试官快速洞察候选人真实实力。

基于 **"DNA x 四层架构"评估框架**，从技术能力、项目经验、文化匹配度等多维度对候选人进行全方位剖析，自动生成结构化面试指南。

![上传与分析](docs/images/screenshot-upload.png)

## 核心功能

**10 大分析模块** — 一份简历，十个维度，全面透视候选人：

| 模块 | 说明 |
|------|------|
| 候选人画像 | 技术方向、经验年限、技术栈熟练度评估 |
| 四层架构评分 | UI层/Algorithm层/算力层/经验层，0-5 分精准量化 |
| DNA 文化匹配 | 追求极致、相信技术、数据说话等 6 个维度 |
| 能力矩阵 | 自动匹配 JD 要求，标记匹配度与验证优先级 |
| 声明审计 | 反注水核查，自动识别模糊量化、角色不匹配等可疑信号 |
| 项目深度分析 | 逐个项目拆解，含矛盾点分析和面试决策树 |
| 评估框架 | 权重分配、核心优势与风险、优先验证点 |
| 技术问题库 | 20 道分级技术题（基础/进阶/专家），紧贴候选人技术栈 |
| 算法题库 | 9 道分级算法题（简单/中等/困难），含测试样例 |
| 综合评分卡 | 最终评分 0-100 + 录用建议（强烈推荐/推荐/待定/不推荐） |

![分析结果 - 雷达图与评分](docs/images/screenshot-analysis.png)

### 更多亮点

- **实时流式分析** — SSE 流式输出，分析过程实时可见
- **JD 智能匹配** — 可选上传岗位 JD，自动逐项匹配能力要求
- **收藏夹** — 一键收藏关键问题和分析要点，面试时快速回顾
- **面试录音** — 内置录音功能，录音自动挂载到对应简历
- **历史记录** — 所有分析报告持久化存储，随时回看

![声明审计与项目分析](docs/images/screenshot-audit.png)

![技术问题库](docs/images/screenshot-questions.png)

---

## 快速开始

### 环境要求

- **Node.js** 18+（推荐 20+）
- **npm**（随 Node.js 一起安装）
- 一个 **AiHubMix API Key**（下面会教你怎么获取）

### 第一步：获取 API Key

本项目使用 [AiHubMix](https://aihubmix.com) 作为 AI 接口代理，支持多种大模型。

1. 打开 [https://aihubmix.com](https://aihubmix.com)，注册一个账号
2. 登录后进入控制台，找到 **API Key** 页面
3. 点击 **创建新的 Key**，复制生成的 Key（以 `sk-` 开头）
4. 保存好这个 Key，下一步要用到

### 第二步：克隆项目

```bash
git clone git@github.com:Becoues/-.git
cd '-'
```

### 第三步：安装依赖

```bash
npm install
```

这一步会自动安装所有依赖并生成 Prisma 客户端。

### 第四步：配置 API Key

```bash
# 复制环境变量模板
cp .env.example .env.local

# 用你喜欢的编辑器打开，把 sk-xxx 替换成你的真实 Key
# macOS:
open .env.local
# 或者用 VS Code:
code .env.local
```

打开 `.env.local` 后，你会看到：

```
AIHUBMIX_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL="file:./prisma/dev.db"
```

把 `sk-xxxx...` 替换成你在第一步获取的 API Key，保存文件。

> **注意**: `DATABASE_URL` 不需要修改，保持默认即可。

### 第五步：初始化数据库

```bash
npx prisma db push
```

这会自动创建 SQLite 数据库文件，无需安装任何数据库软件。

### 第六步：启动项目

```bash
npm run dev
```

看到类似输出就说明启动成功了：

```
▲ Next.js 14.x.x
- Local:    http://localhost:3000
```

打开浏览器访问 **http://localhost:3000**，开始使用！

---

## 使用方法

1. **上传简历** — 在首页点击上传区域，选择 PDF 格式的简历文件
2. **填写 JD**（可选） — 在文本框中粘贴岗位描述，AI 会自动匹配能力要求
3. **开始分析** — 点击分析按钮，等待 AI 生成评估报告（实时流式输出）
4. **查看报告** — 左侧导航切换 10 个分析模块，右侧面板管理收藏
5. **收藏要点** — 点击任意问题或分析条目右上角的星标进行收藏
6. **录制面试** — 点击右上角麦克风按钮录制面试音频
7. **历史回顾** — 在首页查看所有历史分析记录

---

## 技术栈

| 技术 | 说明 |
|------|------|
| [Next.js 14](https://nextjs.org) | React 全栈框架，App Router |
| [Tailwind CSS 3](https://tailwindcss.com) | 原子化 CSS |
| [Prisma 5](https://www.prisma.io) | 数据库 ORM |
| [SQLite](https://www.sqlite.org) | 轻量级本地数据库，零配置 |
| [OpenAI SDK](https://github.com/openai/openai-node) | LLM 接口调用（通过 AiHubMix 代理） |
| [pdfjs-dist](https://github.com/nickolasg/pdfjs-dist) | PDF 文本提取 |
| [Recharts](https://recharts.org) | 雷达图等数据可视化 |
| [Lucide React](https://lucide.dev) | 图标库 |

---

## 项目结构

```
resume-analyzer/
├── prisma/
│   ├── schema.prisma      # 数据库模型定义
│   └── migrations/        # 数据库迁移
├── src/
│   ├── app/
│   │   ├── page.tsx               # 首页（上传 + 历史）
│   │   ├── resumes/[id]/page.tsx  # 分析详情页
│   │   └── api/                   # API 路由
│   │       ├── resumes/           # 简历 CRUD + 录音
│   │       └── analyze/[id]/      # LLM 流式分析
│   ├── components/ui/     # UI 组件
│   └── lib/
│       ├── openai.ts      # AI 客户端配置
│       ├── prompt.ts      # 评估框架 Prompt
│       ├── types.ts       # TypeScript 类型定义
│       ├── pdf.ts         # PDF 文本提取
│       └── db.ts          # Prisma 客户端
├── .env.example           # 环境变量模板
└── package.json
```

---

## 常见问题

### Q: 分析速度比较慢？

分析一份简历大约需要 30-90 秒，这取决于：
- 简历内容的长度
- AI 模型的响应速度
- 网络状况

分析过程是流式的，你可以实时看到输出内容。

### Q: 支持哪些格式的简历？

目前仅支持 **PDF** 格式。建议上传文本型 PDF（非扫描件），以获得最佳提取效果。

### Q: 数据存在哪里？

所有数据都存储在本地的 SQLite 数据库中（`prisma/dev.db`），不会上传到任何外部服务器。简历内容仅在分析时发送给 AI 接口。

### Q: 可以换其他 AI 模型吗？

可以。修改 `src/lib/openai.ts` 中的 `MODEL` 常量即可。AiHubMix 支持多种模型，包括 GPT、Claude、Gemini 等。

---

## License

MIT
