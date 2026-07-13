<p align="center">
  <img src="https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f9e0.svg" width="80" alt="brain" />
</p>

<h1 align="center">Claude 记忆管理器</h1>

<p align="center">
  <strong>可视化浏览、编辑和管理 Claude Code 的跨会话记忆</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D16-brightgreen?style=flat&logo=nodedotjs" alt="Node" />
  <img src="https://img.shields.io/badge/express-4.x-000000?style=flat&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="License" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat" alt="Platform" />
</p>

---

## ✨ 功能

<table>
  <tr>
    <td width="50%">
      <h3>📋 多视图浏览</h3>
      <ul>
        <li><b>卡片网格</b> — 直观浏览所有记忆</li>
        <li><b>紧凑列表</b> — 高效扫描大量记忆</li>
        <li><b>关系图谱</b> — 可视化记忆间的 <code>[[wiki-link]]</code> 关联</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🔍 智能筛选</h3>
      <ul>
        <li>按类型筛选：项目 / 用户 / 反馈 / 参考</li>
        <li>按项目筛选：自动发现所有 Claude 项目</li>
        <li>全文搜索：搜索名称、描述和内容</li>
        <li>多种排序：修改时间 / 创建时间 / 名称</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h3>✏️ 编辑体验</h3>
      <ul>
        <li>Markdown 编辑器 + 实时预览</li>
        <li>Frontmatter 元数据管理</li>
        <li><code>Ctrl+N</code> 新建 / <code>Ctrl+S</code> 保存</li>
        <li>一键删除（含确认对话框）</li>
      </ul>
    </td>
    <td>
      <h3>🔗 链接解析</h3>
      <ul>
        <li>自动识别 <code>[[记忆名称]]</code> 格式的 Wiki 链接</li>
        <li>有效链接可点击跳转</li>
        <li>悬空链接以虚线高亮标记</li>
        <li>图谱视图展示记忆网络拓扑</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🌍 多项目支持</h3>
      <ul>
        <li>自动扫描 <code>~/.claude/projects/</code> 下所有项目</li>
        <li>从 session 文件解析真实项目路径</li>
        <li>跨项目记忆总览</li>
      </ul>
    </td>
    <td>
      <h3>🎨 暗色主题</h3>
      <ul>
        <li>专业深色 UI 设计</li>
        <li>类型彩色标签系统</li>
        <li>响应式布局（适配移动端）</li>
        <li>Toast 通知反馈</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/claude-memory-manager.git
cd claude-memory-manager

# 2. 安装依赖
npm install

# 3. 启动服务
npm start
```

打开浏览器访问 **http://localhost:3456**

> 💡 服务器会自动扫描当前用户 `~/.claude/projects/` 下的所有记忆文件。

---

## ⚙️ 配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `PORT` | 服务器端口 | `3456` |
| `PROJECTS_DIR` | 记忆存储目录 | `~/.claude/projects`（自动检测） |
| `DEFAULT_PROJECT` | 默认项目标识 | 当前工作目录的哈希（自动生成） |

---

## 📁 项目结构

```
claude-memory-manager/
├── server.js              # 应用入口
├── package.json
├── lib/
│   ├── memory-service.js  # 核心逻辑：读写记忆、图谱数据
│   └── routes.js          # RESTful API 路由
└── public/
    ├── index.html         # SPA 页面
    ├── css/
    │   └── style.css      # 暗色主题样式
    └── js/
        ├── api.js         # API 客户端
        ├── app.js         # 应用主控制器
        ├── components.js  # UI 组件 & 图谱渲染
        └── utils.js       # 工具函数
```

---

## 🔌 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/memories` | 获取所有记忆（支持 `?type=` `?project=` `?search=` `?sort=`） |
| `GET` | `/api/memories/:id` | 获取单条记忆详情 |
| `POST` | `/api/memories` | 创建新记忆 |
| `PUT` | `/api/memories/:id` | 更新记忆 |
| `DELETE` | `/api/memories/:id` | 删除记忆 |
| `GET` | `/api/graph` | 获取图谱数据（节点 + 边） |
| `GET` | `/api/types` | 获取类型统计 |
| `GET` | `/api/projects` | 获取项目列表 |
| `GET` | `/api/config` | 获取当前配置 |

---

## 🧩 技术栈

| 层 | 技术 |
|---|------|
| 后端 | **Express.js** — 轻量 HTTP 服务 |
| 前端 | **Vanilla JS** — 零框架依赖 |
| 解析 | **gray-matter** — Frontmatter 解析<br>**marked** — Markdown → HTML |
| 图谱 | **Canvas API** — 力导向布局，纯手写 |
| 样式 | **CSS Custom Properties** — 暗色主题变量系统 |

---

## 📝 记忆文件格式

每条记忆是一个带 YAML frontmatter 的 Markdown 文件：

```markdown
---
name: "部署指南"
description: "生产环境部署步骤"
metadata:
  type: project
---

# 部署步骤

1. 构建项目：`npm run build`
2. 推送到 [[服务器配置]] 中定义的服务器
3. 使用 [[健康检查]] 验证服务状态
```

使用 `[[记忆名称]]` 语法链接到其他记忆，形成知识网络。

---

## 📄 License

MIT © 2025

---

<p align="center">
  <sub>Built with ❤️ for the Claude Code community</sub>
</p>
