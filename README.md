# iResume — AI 简历智评

> 上传简历 PDF，AI 自动生成深度面试评估报告，帮助面试官快速洞察候选人真实实力。

基于 **"DNA × 四层架构"评估框架**，从技术能力、项目经验、文化匹配度等多维度对候选人进行全方位剖析，自动生成结构化面试指南。

![首页](resume-analyzer/docs/images/首页.png)

---

## 核心功能

**10 大分析模块** — 一份简历，十个维度，全面透视候选人：

| 模块 | 说明 |
|------|------|
| 候选人画像 | 技术方向、经验年限、技术栈熟练度评估 |
| 四层架构评分 | UI 层 / Algorithm 层 / 算力层 / 经验层，0-5 分精准量化 |
| DNA 文化匹配 | 追求极致、相信技术、数据说话等 6 个维度 |
| 能力矩阵 | 自动匹配 JD 要求，标记匹配度与验证优先级 |
| 声明审计 | 反注水核查，自动识别模糊量化、角色不匹配等可疑信号 |
| 项目深度分析 | 逐个项目拆解，含矛盾点分析和面试决策树 |
| 评估框架 | 权重分配、核心优势与风险、优先验证点 |
| 技术问题库 | 20 道分级技术题（基础 / 进阶 / 专家），紧贴候选人技术栈 |
| 算法题库 | 9 道分级算法题（简单 / 中等 / 困难），含测试样例 |
| 综合评分卡 | 最终评分 0-100 + 录用建议（强烈推荐 / 推荐 / 待定 / 不推荐） |

![候选人档案](resume-analyzer/docs/images/候选人档案.png)

### 更多亮点

- **实时流式分析** — SSE 流式输出，分析过程实时可见
- **JD 智能匹配** — 可选上传岗位 JD，自动逐项匹配能力要求
- **收藏夹** — 一键收藏关键问题和分析要点，面试时快速回顾
- **面试录音** — 内置录音功能，录音自动挂载到对应简历
- **历史记录** — 所有分析报告持久化存储，随时回看

![技术问题](resume-analyzer/docs/images/技术问题.png)

![历史记录](resume-analyzer/docs/images/历史记录.png)

---

## 快速开始

### 环境要求

- **Node.js** 18+（推荐 20+）
- **npm**（随 Node.js 一起安装）
- 一个 **AiHubMix** API Key

### 第一步：获取 API Key

本项目通过 [AiHubMix](https://aihubmix.com) 调用大模型 API（OpenAI 兼容协议），支持 Gemini、Claude、GPT 等多种模型。

1. 打开 [https://aihubmix.com](https://aihubmix.com)，注册账号
2. 登录后进入控制台，找到 **API Key** 页面
3. 点击 **创建新的 Key**，复制生成的 Key（以 `sk-` 开头）
4. 保存好这个 Key，后面要用

**支持的模型：**
| 模型 | 说明 |
|------|------|
| `gemini-3.1-pro-preview` | Google Gemini（默认，性价比高） |
| `claude-sonnet-4-5` | Anthropic Claude |
| `gpt-5.4` | OpenAI GPT |

> **想使用其他 API 提供商？** 本项目目前仅内置 AiHubMix 支持。如需接入其他提供商（如 OpenRouter、自建代理等），可自行修改 `src/lib/openai.ts` 中的 `baseURL` 和认证逻辑，只要兼容 OpenAI API 协议即可。

### 第二步：克隆项目

```bash
git clone git@github.com:Becoues/iResume.git
cd iResume
```

### 第三步：安装依赖

```bash
npm install
```

这一步会自动安装所有依赖并生成 Prisma 客户端。

### 第四步：配置 API Key

有两种方式，任选其一：

#### 方式 A：通过环境变量配置

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```env
AIHUBMIX_API_KEY=sk-你的Key粘贴到这里
```

#### 方式 B：通过界面配置（推荐）

启动项目后，点击页面右下角的 **齿轮按钮**，在设置面板中：

1. 填写 **API Key**（从 AiHubMix 获取的 `sk-` 开头的 Key）
2. 选择 **模型**
3. 点击 **测试连接** 验证配置是否正确
4. 点击 **应用** 保存

![API 配置](resume-analyzer/docs/images/api配置.png)

> 界面配置的优先级高于环境变量。配置保存在本地数据库中，重启后依然有效。已保存的 Key 仅显示首尾 4 位。

### 第五步：初始化数据库

```bash
npx prisma db push
```

自动创建 SQLite 数据库文件，无需安装任何数据库软件。

### 第六步：启动项目

```bash
npm run dev
```

看到以下输出就说明启动成功了：

```
▲ Next.js 14.x.x
- Local:    http://localhost:3000
```

打开浏览器访问 **http://localhost:3000**，开始使用！

---

## 使用方法

1. **上传简历** — 在首页拖拽或点击上传 PDF 格式的简历
2. **填写 JD**（可选） — 粘贴岗位描述，AI 会自动匹配能力要求
3. **开始分析** — 点击分析按钮，实时观看 AI 生成评估报告
4. **查看报告** — 左侧导航切换 10 个分析模块，右侧面板管理收藏
5. **收藏要点** — 点击星标收藏关键问题和分析条目
6. **录制面试** — 点击右上角麦克风按钮录制面试音频
7. **历史回顾** — 顶部导航栏进入历史记录，查看所有分析报告

---

## 技术栈

| 技术 | 说明 |
|------|------|
| [Next.js 14](https://nextjs.org) | React 全栈框架（App Router） |
| [Tailwind CSS 3](https://tailwindcss.com) | 原子化 CSS 样式 |
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
│   └── schema.prisma           # 数据库模型（Resume, Recording, Settings）
├── docs/images/                # 文档截图
├── src/
│   ├── app/
│   │   ├── page.tsx            # 首页（上传 + 设置入口）
│   │   ├── layout.tsx          # 全局布局（顶部导航）
│   │   ├── resumes/
│   │   │   ├── page.tsx        # 历史记录列表
│   │   │   └── [id]/page.tsx   # 分析详情页（10 模块）
│   │   └── api/
│   │       ├── resumes/        # 简历 CRUD + 录音管理
│   │       ├── analyze/[id]/   # LLM 流式分析（SSE）
│   │       └── settings/       # API 设置 + 连接测试
│   ├── components/
│   │   ├── settings-dialog.tsx # 设置弹窗组件
│   │   └── ui/                 # shadcn 风格 UI 组件
│   └── lib/
│       ├── openai.ts           # OpenAI SDK 客户端（AiHubMix）
│       ├── prompt.ts           # DNA × 四层架构评估 Prompt
│       ├── types.ts            # ResumeAnalysis 类型定义
│       ├── pdf.ts              # PDF 文本提取
│       └── db.ts               # Prisma 单例
├── .env.example                # 环境变量模板
└── package.json
```

---

## 自定义 API 提供商

默认使用 AiHubMix 作为 API 代理。如需替换为其他 OpenAI 兼容的 API 提供商，只需修改 `src/lib/openai.ts`：

```typescript
const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: "https://your-api-provider.com/v1",  // 改这里
});
```

只要目标服务兼容 OpenAI Chat Completions API（`/v1/chat/completions`），即可无缝替换。

---

## 常见问题

### Q: 分析速度比较慢？

分析一份简历大约需要 30-90 秒，取决于简历长度、模型响应速度和网络状况。分析过程是流式的，你可以实时看到输出内容。

### Q: 测试连接失败？

- 检查 Key 是否以 `sk-` 开头
- 确认 AiHubMix 账户余额充足
- 确保网络可以访问 `https://aihubmix.com`

### Q: 支持哪些格式的简历？

目前仅支持 **PDF** 格式。建议上传文本型 PDF（非扫描件），以获得最佳文本提取效果。

### Q: 数据存在哪里？安全吗？

所有数据存储在本地 SQLite 数据库（`prisma/dev.db`），不会上传到任何外部服务器。简历内容仅在分析时发送给 AI 接口。API Key 在界面中仅显示首尾 4 位。

---

## License

MIT
