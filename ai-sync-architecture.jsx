import { useState } from "react";

const sections = [
  "overview",
  "core-arch",
  "modules",
  "data-flow",
  "ai-engine",
  "tech-stack",
  "api",
  "deploy",
  "roadmap",
];

const sectionLabels = {
  overview: "架构总览",
  "core-arch": "核心架构",
  modules: "模块设计",
  "data-flow": "数据流",
  "ai-engine": "AI 引擎",
  "tech-stack": "技术选型",
  api: "API 设计",
  deploy: "部署方案",
  roadmap: "实施路线",
};

// Architecture Diagram Component
function ArchDiagram() {
  const [hoveredNode, setHoveredNode] = useState(null);

  const nodes = [
    { id: "cli", label: "CLI 工具", x: 100, y: 60, w: 100, h: 40, color: "#6366f1", group: "client" },
    { id: "web", label: "Web Dashboard", x: 260, y: 60, w: 120, h: 40, color: "#6366f1", group: "client" },
    { id: "vscode", label: "IDE 插件", x: 440, y: 60, w: 100, h: 40, color: "#6366f1", group: "client" },

    { id: "gateway", label: "API Gateway", x: 260, y: 160, w: 120, h: 40, color: "#f59e0b", group: "gateway" },

    { id: "project", label: "项目管理服务", x: 60, y: 260, w: 120, h: 40, color: "#10b981", group: "service" },
    { id: "diff", label: "Diff 分析服务", x: 230, y: 260, w: 120, h: 40, color: "#10b981", group: "service" },
    { id: "sync", label: "同步执行服务", x: 400, y: 260, w: 120, h: 40, color: "#10b981", group: "service" },
    { id: "review", label: "审核服务", x: 560, y: 260, w: 100, h: 40, color: "#10b981", group: "service" },

    { id: "ai", label: "AI 引擎", x: 260, y: 370, w: 120, h: 50, color: "#ec4899", group: "ai" },
    { id: "ast", label: "AST 解析器", x: 100, y: 380, w: 110, h: 36, color: "#ec4899", group: "ai" },
    { id: "embed", label: "代码嵌入", x: 440, y: 380, w: 100, h: 36, color: "#ec4899", group: "ai" },

    { id: "db", label: "PostgreSQL", x: 100, y: 480, w: 110, h: 36, color: "#3b82f6", group: "data" },
    { id: "redis", label: "Redis", x: 260, y: 480, w: 100, h: 36, color: "#3b82f6", group: "data" },
    { id: "git", label: "Git 仓库", x: 420, y: 480, w: 100, h: 36, color: "#3b82f6", group: "data" },
    { id: "vector", label: "向量数据库", x: 570, y: 480, w: 110, h: 36, color: "#3b82f6", group: "data" },
  ];

  const edges = [
    ["cli", "gateway"], ["web", "gateway"], ["vscode", "gateway"],
    ["gateway", "project"], ["gateway", "diff"], ["gateway", "sync"], ["gateway", "review"],
    ["diff", "ai"], ["sync", "ai"], ["diff", "ast"], ["sync", "embed"],
    ["project", "db"], ["diff", "redis"], ["sync", "git"], ["embed", "vector"],
  ];

  return (
    <svg viewBox="0 0 700 540" style={{ width: "100%", height: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 3.5 L 0 7 z" fill="#475569" />
        </marker>
      </defs>

      {/* Background labels */}
      <text x="20" y="48" fill="#94a3b8" fontSize="11" fontWeight="600" opacity="0.6">客户端层</text>
      <text x="20" y="148" fill="#94a3b8" fontSize="11" fontWeight="600" opacity="0.6">网关层</text>
      <text x="20" y="248" fill="#94a3b8" fontSize="11" fontWeight="600" opacity="0.6">服务层</text>
      <text x="20" y="358" fill="#94a3b8" fontSize="11" fontWeight="600" opacity="0.6">AI 层</text>
      <text x="20" y="468" fill="#94a3b8" fontSize="11" fontWeight="600" opacity="0.6">数据层</text>

      {/* Dividers */}
      {[110, 210, 340, 450].map((y, i) => (
        <line key={i} x1="15" y1={y} x2="685" y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      ))}

      {/* Edges */}
      {edges.map(([from, to], i) => {
        const f = nodes.find(n => n.id === from);
        const t = nodes.find(n => n.id === to);
        const fx = f.x + f.w / 2, fy = f.y + f.h;
        const tx = t.x + t.w / 2, ty = t.y;
        const isHighlighted = hoveredNode === from || hoveredNode === to;
        return (
          <line key={i} x1={fx} y1={fy} x2={tx} y2={ty}
            stroke={isHighlighted ? "#818cf8" : "#475569"} strokeWidth={isHighlighted ? 2 : 1}
            markerEnd="url(#arrow)" opacity={isHighlighted ? 1 : 0.5}
            style={{ transition: "all 0.2s" }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(n => {
        const isHovered = hoveredNode === n.id;
        return (
          <g key={n.id}
            onMouseEnter={() => setHoveredNode(n.id)}
            onMouseLeave={() => setHoveredNode(null)}
            style={{ cursor: "pointer" }}
          >
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="6"
              fill={isHovered ? n.color : `${n.color}22`}
              stroke={n.color} strokeWidth={isHovered ? 2 : 1.5}
              filter={isHovered ? "url(#glow)" : undefined}
              style={{ transition: "all 0.2s" }}
            />
            <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              fill={isHovered ? "#fff" : "#e2e8f0"} fontSize="11" fontWeight="500"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Data Flow Diagram
function DataFlowDiagram() {
  const steps = [
    { label: "1. 检测改动", desc: "Git Hook / Watch", icon: "🔍", color: "#6366f1" },
    { label: "2. 语义分析", desc: "AST + AI 理解意图", icon: "🧠", color: "#8b5cf6" },
    { label: "3. 映射定位", desc: "在变体项目中定位", icon: "📍", color: "#ec4899" },
    { label: "4. 适配生成", desc: "AI 生成适配代码", icon: "⚡", color: "#f59e0b" },
    { label: "5. 审核确认", desc: "人工 Review", icon: "✅", color: "#10b981" },
    { label: "6. 应用同步", desc: "批量提交", icon: "🚀", color: "#3b82f6" },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", overflowX: "auto", padding: "16px 0" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            background: `${s.color}15`, border: `1.5px solid ${s.color}`,
            borderRadius: "12px", padding: "14px 16px", minWidth: "120px", textAlign: "center",
          }}>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
            <div style={{ fontSize: "12px", fontWeight: "600", color: s.color }}>{s.label}</div>
            <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>{s.desc}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ color: "#475569", fontSize: "18px", margin: "0 2px" }}>→</div>
          )}
        </div>
      ))}
    </div>
  );
}

// Module Card
function ModuleCard({ title, items, color, icon }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#0f172a", border: `1px solid ${color}33`, borderRadius: "12px",
      padding: "20px", cursor: "pointer", transition: "all 0.2s",
      borderLeft: `3px solid ${color}`,
    }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>{icon}</span>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#f1f5f9" }}>{title}</span>
        </div>
        <span style={{ color: "#64748b", fontSize: "12px", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </div>
      {expanded && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item, i) => (
            <div key={i} style={{
              display: "flex", gap: "10px", padding: "10px 12px",
              background: "#1e293b", borderRadius: "8px", alignItems: "flex-start"
            }}>
              <span style={{ color, fontSize: "14px", marginTop: "1px", flexShrink: 0 }}>•</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: "#e2e8f0" }}>{item.name}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState("overview");

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div>
            <h2 style={styles.h2}>系统定位</h2>
            <p style={styles.p}>
              <strong>AI Project Sync</strong> 是一款面向外包团队和多项目管理场景的 AI 辅助代码同步工具。
              它解决的核心问题是：当一个基础项目衍生出多个定制化变体项目后，如何在变更共享代码时，
              智能地将改动同步到所有变体项目中。
            </p>

            <h2 style={styles.h2}>设计原则</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
              {[
                { title: "AI 辅助，人工兜底", desc: "AI 负责分析和生成，人工负责审核确认。任何同步操作都必须经过确认才能应用。", icon: "🤝" },
                { title: "渐进式信任", desc: "根据历史准确率动态调整审核粒度。高置信度改动可批量确认，低置信度需逐行审核。", icon: "📈" },
                { title: "最小侵入", desc: "不要求改变现有开发工作流。通过 Git Hook、CLI、IDE 插件等方式无缝接入。", icon: "🔌" },
                { title: "可回滚安全", desc: "所有同步操作都生成独立的 Git 分支和 PR，出问题随时回滚。", icon: "🛡️" },
              ].map((p, i) => (
                <div key={i} style={{
                  background: "#0f172a", border: "1px solid #1e293b", borderRadius: "10px", padding: "16px",
                }}>
                  <div style={{ fontSize: "22px", marginBottom: "8px" }}>{p.icon}</div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#f1f5f9", marginBottom: "6px" }}>{p.title}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6" }}>{p.desc}</div>
                </div>
              ))}
            </div>

            <h2 style={styles.h2}>适用场景</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {[
                "外包团队为不同客户定制的同源项目",
                "SaaS 产品的多租户私有化部署版本",
                "白标产品的多品牌变体",
                "多地区/多语言版本的应用",
              ].map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                  background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b",
                }}>
                  <span style={{ color: "#10b981" }}>✓</span>
                  <span style={{ fontSize: "13px", color: "#cbd5e1" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "core-arch":
        return (
          <div>
            <h2 style={styles.h2}>系统架构图</h2>
            <p style={styles.p}>悬停节点查看关联关系。系统采用分层微服务架构，AI 引擎作为独立层提供智能分析能力。</p>
            <div style={{
              background: "#0f172a", borderRadius: "12px", padding: "20px",
              border: "1px solid #1e293b", marginTop: "12px",
            }}>
              <ArchDiagram />
            </div>

            <h2 style={styles.h2}>架构分层说明</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {[
                { layer: "客户端层", desc: "提供 CLI、Web Dashboard 和 IDE 插件三种接入方式，覆盖不同使用偏好", color: "#6366f1" },
                { layer: "网关层", desc: "统一认证、限流、路由。支持 WebSocket 推送同步状态", color: "#f59e0b" },
                { layer: "服务层", desc: "四大核心服务解耦部署：项目管理、Diff 分析、同步执行、审核管理", color: "#10b981" },
                { layer: "AI 层", desc: "LLM 引擎 + AST 解析器 + 代码向量嵌入，提供语义级代码理解能力", color: "#ec4899" },
                { layer: "数据层", desc: "PostgreSQL 存储元数据，Redis 缓存热数据，Git 管理代码，向量库存储代码嵌入", color: "#3b82f6" },
              ].map((l, i) => (
                <div key={i} style={{
                  display: "flex", gap: "14px", padding: "14px 16px",
                  background: "#0f172a", borderRadius: "10px", borderLeft: `3px solid ${l.color}`,
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: l.color }}>{l.layer}</div>
                    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{l.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "modules":
        return (
          <div>
            <h2 style={styles.h2}>核心模块详细设计</h2>
            <p style={styles.p}>点击模块卡片展开详细功能说明</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              <ModuleCard title="项目注册中心" icon="📦" color="#6366f1" items={[
                { name: "项目组管理", desc: "创建项目组，将基础项目与其所有变体项目关联在一起" },
                { name: "差异标注", desc: "每个变体项目标注其与基础项目的差异区域（自动检测 + 手动标注）" },
                { name: "同步策略配置", desc: "为每个变体项目配置同步策略：自动/半自动/手动，按文件/目录粒度" },
                { name: "项目指纹", desc: "生成并维护每个项目的代码结构指纹，用于快速匹配定位" },
              ]} />

              <ModuleCard title="智能 Diff 引擎" icon="🔬" color="#ec4899" items={[
                { name: "语义 Diff", desc: "不仅比较文本差异，还理解代码改动的语义意图（Bug Fix / Feature / Refactor）" },
                { name: "影响范围分析", desc: "自动分析一次改动会影响哪些变体项目的哪些文件" },
                { name: "冲突预测", desc: "在实际同步前预测可能的冲突点，评估同步难度和风险等级" },
                { name: "改动分类", desc: "将改动分为：通用改动（适用所有变体）、条件改动（部分适用）、专属改动（仅当前项目）" },
              ]} />

              <ModuleCard title="同步执行器" icon="⚡" color="#f59e0b" items={[
                { name: "代码映射", desc: "在变体项目中定位与基础项目改动对应的代码位置（即使结构不同）" },
                { name: "适配生成", desc: "根据变体项目的上下文，AI 生成适配后的代码改动" },
                { name: "批量执行", desc: "支持一次改动同步到多个变体项目，并行处理提升效率" },
                { name: "原子提交", desc: "每个变体的同步作为独立 Git 分支提交，确保可回滚" },
              ]} />

              <ModuleCard title="审核系统" icon="✅" color="#10b981" items={[
                { name: "分级审核", desc: "根据 AI 置信度和改动复杂度，自动决定审核粒度（文件级 / 行级）" },
                { name: "对比视图", desc: "类 GitHub PR 的对比界面，清晰展示原始改动 vs 适配后改动" },
                { name: "批量操作", desc: "高置信度改动支持一键批量确认，低置信度逐个审核" },
                { name: "反馈学习", desc: "审核结果（接受/修改/拒绝）作为训练数据持续优化 AI 准确率" },
              ]} />

              <ModuleCard title="知识图谱" icon="🧠" color="#8b5cf6" items={[
                { name: "代码关系图", desc: "构建并维护项目间的代码对应关系图谱" },
                { name: "历史学习", desc: "从历史同步记录中学习各变体项目的定制模式" },
                { name: "智能建议", desc: "主动发现尚未同步的改动并推送建议" },
                { name: "异常检测", desc: "发现项目间不应该存在的差异（如某个 Bug Fix 遗漏了某个变体）" },
              ]} />
            </div>
          </div>
        );

      case "data-flow":
        return (
          <div>
            <h2 style={styles.h2}>核心数据流</h2>
            <p style={styles.p}>一次同步操作的完整数据流转路径</p>
            <div style={{
              background: "#0f172a", borderRadius: "12px", padding: "20px",
              border: "1px solid #1e293b", marginTop: "12px", overflowX: "auto",
            }}>
              <DataFlowDiagram />
            </div>

            <h2 style={styles.h2}>详细流程说明</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              {[
                {
                  phase: "Phase 1 · 变更检测",
                  desc: "通过 Git Hook（post-commit）或文件 Watch 检测到基础项目的代码变更。提取 commit message、diff patch、affected files 等元数据。",
                  color: "#6366f1"
                },
                {
                  phase: "Phase 2 · 语义分析",
                  desc: "AST 解析器将 diff 转换为结构化表示（函数级、类级改动）。AI 引擎分析改动意图，输出：改动类型、影响范围、适用性评估。",
                  color: "#8b5cf6"
                },
                {
                  phase: "Phase 3 · 映射定位",
                  desc: "利用代码嵌入向量在每个变体项目中找到语义对应的代码位置。结合 AST 结构比对和历史映射记录，输出精确的文件 + 行号定位。",
                  color: "#ec4899"
                },
                {
                  phase: "Phase 4 · 适配生成",
                  desc: "AI 引擎根据变体项目的上下文（命名规范、本地变量、业务逻辑差异），生成适配后的代码改动。每个改动附带置信度评分。",
                  color: "#f59e0b"
                },
                {
                  phase: "Phase 5 · 人工审核",
                  desc: "生成类似 PR 的审核视图。开发者可以接受、修改或拒绝每项改动。高置信度改动（>95%）可批量确认。审核结果回写到反馈数据库。",
                  color: "#10b981"
                },
                {
                  phase: "Phase 6 · 批量提交",
                  desc: "为每个变体项目创建独立的 sync/* 分支，提交适配后的改动。可配置自动合并或等待 CI 通过后手动合并。",
                  color: "#3b82f6"
                },
              ].map((p, i) => (
                <div key={i} style={{
                  padding: "14px 16px", background: "#0f172a", borderRadius: "10px",
                  borderLeft: `3px solid ${p.color}`,
                }}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: p.color }}>{p.phase}</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", lineHeight: "1.7" }}>{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "ai-engine":
        return (
          <div>
            <h2 style={styles.h2}>AI 引擎架构</h2>
            <p style={styles.p}>AI 引擎是系统的核心智能单元，由三个子系统协同工作。</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              {/* LLM */}
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #ec489933" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "22px" }}>🤖</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#ec4899" }}>LLM 代码理解引擎</span>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  <strong style={{ color: "#e2e8f0" }}>模型选择：</strong>Claude API（推荐）或 GPT-4 作为主模型，开源模型（如 DeepSeek Coder）作为快速预筛层。<br />
                  <strong style={{ color: "#e2e8f0" }}>Prompt 策略：</strong>采用多轮 Chain-of-Thought，将复杂任务分解为：意图理解 → 上下文收集 → 代码生成 → 自检验证。<br />
                  <strong style={{ color: "#e2e8f0" }}>上下文管理：</strong>动态组装上下文窗口——基础项目改动 + 变体项目对应区域 + 项目元数据 + 历史同步记录。<br />
                  <strong style={{ color: "#e2e8f0" }}>输出格式：</strong>结构化 JSON 格式，包含 patch、置信度、变更说明、潜在风险提示。
                </div>
              </div>

              {/* AST */}
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #8b5cf633" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "22px" }}>🌳</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#8b5cf6" }}>AST 结构分析器</span>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  <strong style={{ color: "#e2e8f0" }}>工具链：</strong>Tree-sitter（多语言支持）+ 语言特定解析器（如 TypeScript Compiler API）。<br />
                  <strong style={{ color: "#e2e8f0" }}>结构化 Diff：</strong>将文本 diff 提升为 AST 级 diff——区分"函数签名变更"和"函数体变更"，"新增方法"和"修改已有方法"。<br />
                  <strong style={{ color: "#e2e8f0" }}>代码指纹：</strong>为每个函数/类/模块生成结构化指纹，用于跨项目快速匹配。<br />
                  <strong style={{ color: "#e2e8f0" }}>依赖图：</strong>构建文件间的 import/export 依赖图，辅助影响范围分析。
                </div>
              </div>

              {/* Embedding */}
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #3b82f633" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <span style={{ fontSize: "22px" }}>🧬</span>
                  <span style={{ fontSize: "16px", fontWeight: "700", color: "#3b82f6" }}>代码向量嵌入系统</span>
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  <strong style={{ color: "#e2e8f0" }}>嵌入模型：</strong>使用代码专用嵌入模型（如 Voyage Code 或 OpenAI Code Embeddings）。<br />
                  <strong style={{ color: "#e2e8f0" }}>粒度策略：</strong>按函数/方法级别做嵌入，而非整文件，提升匹配精度。<br />
                  <strong style={{ color: "#e2e8f0" }}>增量更新：</strong>Git commit 触发增量嵌入更新，而非全量重建。<br />
                  <strong style={{ color: "#e2e8f0" }}>相似度搜索：</strong>通过向量相似度在变体项目中快速定位语义对应的代码，作为 AST 匹配的补充。
                </div>
              </div>
            </div>

            <h2 style={styles.h2}>AI 调用链示例</h2>
            <div style={{
              background: "#0f172a", borderRadius: "12px", padding: "16px",
              border: "1px solid #1e293b", marginTop: "12px", fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px", color: "#94a3b8", lineHeight: "1.8", overflowX: "auto",
            }}>
              <div><span style={{ color: "#6366f1" }}>Step 1</span> <span style={{ color: "#475569" }}>│</span> AST 解析 base diff → 提取 changed_functions[]</div>
              <div><span style={{ color: "#8b5cf6" }}>Step 2</span> <span style={{ color: "#475569" }}>│</span> 向量搜索 → 在 variant_project 中匹配 similar_functions[]</div>
              <div><span style={{ color: "#ec4899" }}>Step 3</span> <span style={{ color: "#475569" }}>│</span> AST 比对 → 确认 matched_locations[] + diff_context</div>
              <div><span style={{ color: "#f59e0b" }}>Step 4</span> <span style={{ color: "#475569" }}>│</span> LLM.generate(base_diff + variant_context + history) → adapted_patch</div>
              <div><span style={{ color: "#10b981" }}>Step 5</span> <span style={{ color: "#475569" }}>│</span> LLM.verify(adapted_patch + variant_code) → confidence_score</div>
              <div><span style={{ color: "#3b82f6" }}>Step 6</span> <span style={{ color: "#475569" }}>│</span> 输出 {`{ patch, confidence, risks, explanation }`}</div>
            </div>
          </div>
        );

      case "tech-stack":
        return (
          <div>
            <h2 style={styles.h2}>技术选型</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              {[
                {
                  category: "后端核心", items: [
                    { name: "Node.js / TypeScript", reason: "与前端技术栈统一，AST 工具链生态好" },
                    { name: "NestJS", reason: "企业级框架，模块化架构，依赖注入" },
                    { name: "Bull / BullMQ", reason: "任务队列，处理异步同步任务" },
                  ]
                },
                {
                  category: "AI & 分析", items: [
                    { name: "Claude API / OpenAI API", reason: "代码理解和生成的主力 LLM" },
                    { name: "Tree-sitter", reason: "多语言 AST 解析，WASM 版可嵌入 Node.js" },
                    { name: "Voyage AI / OpenAI Embeddings", reason: "代码嵌入向量生成" },
                  ]
                },
                {
                  category: "数据存储", items: [
                    { name: "PostgreSQL", reason: "项目元数据、映射关系、审核记录" },
                    { name: "Redis", reason: "任务队列、缓存、实时状态" },
                    { name: "Qdrant / Pinecone", reason: "代码向量存储和相似度搜索" },
                    { name: "Git (libgit2 / isomorphic-git)", reason: "直接操作 Git 仓库" },
                  ]
                },
                {
                  category: "前端 & 客户端", items: [
                    { name: "React + Vite", reason: "Web Dashboard，审核界面" },
                    { name: "Monaco Editor", reason: "代码对比视图，类 VS Code 体验" },
                    { name: "Commander.js / Ink", reason: "CLI 工具" },
                    { name: "VS Code Extension API", reason: "IDE 内直接操作" },
                  ]
                },
                {
                  category: "基础设施", items: [
                    { name: "Docker + K8s", reason: "容器化部署，服务编排" },
                    { name: "GitHub/GitLab Webhooks", reason: "集成现有 Git 平台" },
                    { name: "Prometheus + Grafana", reason: "监控同步成功率、AI 准确率等指标" },
                  ]
                },
              ].map((cat, i) => (
                <div key={i}>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#f1f5f9", marginBottom: "8px" }}>{cat.category}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {cat.items.map((item, j) => (
                      <div key={j} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", background: "#0f172a", borderRadius: "8px",
                        border: "1px solid #1e293b",
                      }}>
                        <span style={{ fontSize: "13px", fontWeight: "500", color: "#6366f1", minWidth: "200px" }}>{item.name}</span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "api":
        return (
          <div>
            <h2 style={styles.h2}>核心 API 设计</h2>
            <p style={styles.p}>RESTful API + WebSocket 实时通知</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              {[
                { method: "POST", path: "/api/v1/project-groups", desc: "创建项目组（基础项目 + 变体列表）" },
                { method: "POST", path: "/api/v1/project-groups/:id/variants", desc: "向项目组添加变体项目" },
                { method: "GET", path: "/api/v1/project-groups/:id/mapping", desc: "获取项目间代码映射关系" },
                { method: "POST", path: "/api/v1/sync/analyze", desc: "分析一次 commit 的同步可能性和影响范围" },
                { method: "POST", path: "/api/v1/sync/generate", desc: "生成适配后的同步补丁" },
                { method: "POST", path: "/api/v1/sync/execute", desc: "执行已审核的同步操作" },
                { method: "GET", path: "/api/v1/sync/:id/status", desc: "查询同步任务状态" },
                { method: "GET", path: "/api/v1/reviews/pending", desc: "获取待审核的同步改动列表" },
                { method: "POST", path: "/api/v1/reviews/:id/approve", desc: "批准同步改动" },
                { method: "POST", path: "/api/v1/reviews/:id/reject", desc: "拒绝同步改动（含原因反馈）" },
                { method: "WS", path: "/ws/sync-events", desc: "实时推送同步状态更新" },
              ].map((api, i) => {
                const methodColors = { POST: "#f59e0b", GET: "#10b981", WS: "#8b5cf6" };
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "12px 14px", background: "#0f172a", borderRadius: "8px",
                    border: "1px solid #1e293b", fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{
                      fontSize: "10px", fontWeight: "700", color: methodColors[api.method] || "#94a3b8",
                      background: `${methodColors[api.method] || "#94a3b8"}15`,
                      padding: "3px 8px", borderRadius: "4px", minWidth: "40px", textAlign: "center",
                    }}>{api.method}</span>
                    <span style={{ fontSize: "12px", color: "#e2e8f0", minWidth: "300px" }}>{api.path}</span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{api.desc}</span>
                  </div>
                );
              })}
            </div>

            <h2 style={styles.h2}>同步分析响应示例</h2>
            <div style={{
              background: "#0f172a", borderRadius: "12px", padding: "16px",
              border: "1px solid #1e293b", marginTop: "12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
              color: "#94a3b8", lineHeight: "1.7", whiteSpace: "pre", overflowX: "auto",
            }}>
{`{
  "sync_id": "sync_abc123",
  "base_commit": "a1b2c3d",
  "change_summary": "修复用户列表分页 Bug",
  "change_type": "bug_fix",
  "variants": [
    {
      "project": "client-alpha",
      "status": "ready",
      "confidence": 0.96,
      "affected_files": ["src/api/users.ts"],
      "risk_level": "low"
    },
    {
      "project": "client-beta",
      "status": "needs_review",
      "confidence": 0.72,
      "affected_files": ["src/services/user.service.ts"],
      "risk_level": "medium",
      "warnings": ["函数签名有差异，需确认参数映射"]
    }
  ]
}`}
            </div>
          </div>
        );

      case "deploy":
        return (
          <div>
            <h2 style={styles.h2}>部署方案</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #6366f133" }}>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#6366f1", marginBottom: "12px" }}>🏠 方案一：自托管（推荐中小团队）</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  单机 Docker Compose 部署，适合 5-20 个变体项目的规模。
                  所有服务打包在一起，PostgreSQL + Redis 本地运行。
                  AI 调用外部 API（Claude/GPT），无需本地 GPU。
                  最低配置：4C8G 云服务器，预估成本 ¥200-500/月 + AI API 费用。
                </div>
              </div>

              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #10b98133" }}>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#10b981", marginBottom: "12px" }}>☁️ 方案二：云原生（推荐中大团队）</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  Kubernetes 部署，各服务独立扩缩。Sync Worker 可水平扩展以应对大批量同步。
                  托管数据库（如 RDS + ElastiCache）。向量数据库使用 Qdrant Cloud 或 Pinecone。
                  适合 20+ 变体项目，团队 10+ 人使用。
                </div>
              </div>

              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px", border: "1px solid #f59e0b33" }}>
                <div style={{ fontSize: "15px", fontWeight: "600", color: "#f59e0b", marginBottom: "12px" }}>💡 MVP 快速验证方案</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.8" }}>
                  <strong style={{ color: "#e2e8f0" }}>最小可行产品只需：</strong><br />
                  • 一个 CLI 工具（Node.js）<br />
                  • 一个 Claude API Key<br />
                  • Git 本地操作（无需服务端）<br /><br />
                  流程：CLI 读取 base commit diff → 构造 prompt → 调用 Claude → 输出 patch → 用户确认 → 应用到变体项目。
                  无需数据库、无需服务器。先验证核心价值，再逐步加功能。
                </div>
              </div>
            </div>
          </div>
        );

      case "roadmap":
        return (
          <div>
            <h2 style={styles.h2}>实施路线图</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              {[
                {
                  phase: "Phase 0 · 验证期",
                  duration: "2-3 周",
                  color: "#f59e0b",
                  tasks: [
                    "搭建 CLI 原型，实现单文件级别的 diff → AI 适配 → patch 生成",
                    "测试不同类型改动的 AI 准确率（Bug Fix / Feature / Refactor）",
                    "在 2-3 个真实项目组上做端到端验证",
                    "确定 AI 模型选择和 Prompt 策略",
                  ],
                  milestone: "验收标准：简单 Bug Fix 同步准确率 > 80%"
                },
                {
                  phase: "Phase 1 · 核心功能",
                  duration: "4-6 周",
                  color: "#6366f1",
                  tasks: [
                    "实现 AST 解析器，支持 TS/JS/Python 等主流语言",
                    "构建代码嵌入系统和向量搜索",
                    "实现多文件级别的同步和冲突处理",
                    "开发基础 Web 审核界面",
                  ],
                  milestone: "验收标准：多文件改动同步准确率 > 70%，支持 3+ 语言"
                },
                {
                  phase: "Phase 2 · 产品化",
                  duration: "4-6 周",
                  color: "#10b981",
                  tasks: [
                    "完整的项目组管理和配置系统",
                    "Git 平台集成（GitHub/GitLab Webhook）",
                    "审核工作流完善（分级审核、批量操作）",
                    "VS Code 插件开发",
                    "监控和统计面板",
                  ],
                  milestone: "验收标准：可供 5+ 人团队日常使用"
                },
                {
                  phase: "Phase 3 · 智能化",
                  duration: "持续迭代",
                  color: "#ec4899",
                  tasks: [
                    "知识图谱构建，自动发现未同步改动",
                    "基于反馈数据的模型微调",
                    "智能冲突解决和自动分类",
                    "跨项目代码质量分析和一致性检查",
                  ],
                  milestone: "验收标准：同步准确率 > 90%，50% 以上改动可自动确认"
                },
              ].map((p, i) => (
                <div key={i} style={{
                  background: "#0f172a", borderRadius: "12px", padding: "20px",
                  border: `1px solid ${p.color}33`, borderLeft: `4px solid ${p.color}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "15px", fontWeight: "700", color: p.color }}>{p.phase}</span>
                    <span style={{
                      fontSize: "11px", color: p.color, background: `${p.color}15`,
                      padding: "3px 10px", borderRadius: "12px",
                    }}>{p.duration}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {p.tasks.map((t, j) => (
                      <div key={j} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                        <span style={{ color: "#475569", fontSize: "12px", marginTop: "1px" }}>→</span>
                        <span style={{ fontSize: "12px", color: "#cbd5e1" }}>{t}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    fontSize: "11px", color: "#64748b", padding: "8px 12px",
                    background: "#1e293b", borderRadius: "6px", fontStyle: "italic",
                  }}>
                    {p.milestone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#020617", color: "#e2e8f0",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "24px 28px", borderBottom: "1px solid #1e293b",
        background: "linear-gradient(135deg, #020617 0%, #0f172a 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #ec4899)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>⚡</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", letterSpacing: "-0.5px" }}>AI Project Sync</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>技术架构设计文档 v1.0</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <div style={{
          width: "200px", minHeight: "calc(100vh - 85px)", borderRight: "1px solid #1e293b",
          padding: "16px 10px", flexShrink: 0,
        }}>
          {sections.map(s => (
            <div key={s}
              onClick={() => setActiveSection(s)}
              style={{
                padding: "10px 14px", borderRadius: "8px", cursor: "pointer",
                fontSize: "13px", marginBottom: "4px", transition: "all 0.15s",
                background: activeSection === s ? "#6366f115" : "transparent",
                color: activeSection === s ? "#818cf8" : "#94a3b8",
                fontWeight: activeSection === s ? "600" : "400",
                borderLeft: activeSection === s ? "2px solid #6366f1" : "2px solid transparent",
              }}
            >
              {sectionLabels[s]}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "24px 32px", maxWidth: "900px" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  h2: {
    fontSize: "16px", fontWeight: "700", color: "#f1f5f9",
    marginTop: "24px", marginBottom: "8px", letterSpacing: "-0.3px",
  },
  p: {
    fontSize: "13px", color: "#94a3b8", lineHeight: "1.7", marginBottom: "4px",
  },
};
