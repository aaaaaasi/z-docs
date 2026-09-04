import type { Lang } from "@/lib/i18n"

export interface DocTemplate {
  id: string
  name: string
  description: string
  icon: string // lucide icon key mapped in the gallery component
  accent: string // tailwind text color class for the icon
  title: string
  content: string
  // Chinese variants (rendered when the UI language is zh)
  nameZh: string
  descriptionZh: string
  titleZh: string
  contentZh: string
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const TEMPLATES: DocTemplate[] = [
  {
    id: "blank",
    name: "Blank document",
    description: "Start from a clean page",
    icon: "FileText",
    accent: "text-foreground",
    title: "Untitled document",
    content: "",
    nameZh: "空白文档",
    descriptionZh: "从空白页面开始",
    titleZh: "无标题文档",
    contentZh: "",
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Capture agenda & action items",
    icon: "NotebookPen",
    accent: "text-emerald-700",
    title: "Meeting notes — " + today(),
    content: `<h1>Meeting notes</h1>
<p><em>${today()} · Attendees: @you, @teammate</em></p>
<hr>
<h2>Agenda</h2>
<ol><li>Review last week's progress</li><li>Discuss open blockers</li><li>Plan next steps</li></ol>
<h2>Discussion</h2>
<p>Key points discussed during the meeting…</p>
<h2>Action items</h2>
<ul><li><strong>@you</strong> — draft the project timeline (due Friday)</li><li><strong>@teammate</strong> — share the design review doc</li><li>Follow up on budget approval</li></ul>
<h2>Next meeting</h2>
<p>Same time next week.</p>`,
    nameZh: "会议记录",
    descriptionZh: "记录议程与行动项",
    titleZh: "会议记录 — " + today(),
    contentZh: `<h1>会议记录</h1>
<p><em>${today()} · 参会人：@you、@teammate</em></p>
<hr>
<h2>议程</h2>
<ol><li>回顾上周进展</li><li>讨论未解决的阻碍</li><li>规划后续步骤</li></ol>
<h2>讨论</h2>
<p>会议中讨论的要点…</p>
<h2>行动项</h2>
<ul><li><strong>@you</strong> — 起草项目时间线（周五截止）</li><li><strong>@teammate</strong> — 分享设计评审文档</li><li>跟进预算审批</li></ul>
<h2>下次会议</h2>
<p>下周同一时间。</p>`,
  },
  {
    id: "project-proposal",
    name: "Project proposal",
    description: "Pitch an idea with impact",
    icon: "Lightbulb",
    accent: "text-amber-600",
    title: "Project proposal",
    content: `<h1>Project proposal</h1>
<p><strong>Project name:</strong> …&nbsp;&nbsp;<strong>Author:</strong> …&nbsp;&nbsp;<strong>Date:</strong> ${today()}</p>
<hr>
<h2>Summary</h2>
<p>Two or three sentences that describe the problem, the solution, and the expected outcome.</p>
<h2>Background</h2>
<p>Why does this project matter now? Include relevant context, data, or user feedback.</p>
<h2>Proposal</h2>
<p>Describe the solution in detail. What will be built or changed?</p>
<h3>Goals</h3>
<ul><li>Goal 1 — measurable outcome</li><li>Goal 2 — measurable outcome</li></ul>
<h3>Non-goals</h3>
<ul><li>Explicitly out of scope</li></ul>
<h2>Timeline &amp; resources</h2>
<p>Phases, milestones, and the people needed to deliver them.</p>
<h2>Risks &amp; open questions</h2>
<blockquote>What could go wrong, and how do we mitigate it?</blockquote>`,
    nameZh: "项目提案",
    descriptionZh: "有说服力地呈现创意",
    titleZh: "项目提案",
    contentZh: `<h1>项目提案</h1>
<p><strong>项目名称：</strong>…&nbsp;&nbsp;<strong>撰写人：</strong>…&nbsp;&nbsp;<strong>日期：</strong>${today()}</p>
<hr>
<h2>摘要</h2>
<p>用两三句话描述问题、解决方案和预期成果。</p>
<h2>背景</h2>
<p>为什么这个项目现在很重要？请附上相关背景、数据或用户反馈。</p>
<h2>提案</h2>
<p>详细描述解决方案。将要构建或改变什么？</p>
<h3>目标</h3>
<ul><li>目标 1 — 可衡量的成果</li><li>目标 2 — 可衡量的成果</li></ul>
<h3>非目标</h3>
<ul><li>明确不在范围内的事项</li></ul>
<h2>时间线与资源</h2>
<p>阶段、里程碑以及交付所需的人员。</p>
<h2>风险与待解决问题</h2>
<blockquote>可能出现什么问题？我们如何规避？</blockquote>`,
  },
  {
    id: "letter",
    name: "Letter",
    description: "Classic formal letter",
    icon: "Mail",
    accent: "text-rose-600",
    title: "Letter",
    content: `<p style="text-align:right">${today()}</p>
<p style="text-align:left">Recipient Name<br>Company / Address Line 1<br>City, State ZIP</p>
<p>Dear Recipient,</p>
<p>I am writing to introduce the purpose of this letter in one clear sentence. The following paragraphs expand on the context, the request, and the supporting details.</p>
<p>Please let me know if you need any additional information. I look forward to hearing from you.</p>
<p>Sincerely,</p>
<p>Your Name<br>Your Title</p>`,
    nameZh: "信函",
    descriptionZh: "经典正式信函",
    titleZh: "信函",
    contentZh: `<p style="text-align:right">${today()}</p>
<p style="text-align:left">收件人姓名<br>公司 / 地址第一行<br>城市、州、邮编</p>
<p>尊敬的收件人：</p>
<p>我写这封信是为了用一句话清晰地说明写信目的。以下几段将展开介绍背景、请求及相关细节。</p>
<p>如需更多信息，请随时告知。期待您的回音。</p>
<p>此致，</p>
<p>你的姓名<br>你的职位</p>`,
  },
  {
    id: "resume",
    name: "Resume",
    description: "Clean single-page layout",
    icon: "FileUser",
    accent: "text-teal-700",
    title: "Resume — Your Name",
    content: `<p style="text-align:center"><span style="font-size:18pt">Your Name</span></p>
<p style="text-align:center">City, ST · (555) 010-1234 · you@example.com</p>
<hr>
<h2>Experience</h2>
<p><strong>Senior Product Designer</strong> — Acme Corp<br><em>2022 – Present</em></p>
<ul><li>Led redesign of the core experience, lifting activation by 18%.</li><li>Built and maintained the design system used by 40+ engineers.</li></ul>
<p><strong>Product Designer</strong> — Startup Inc<br><em>2019 – 2022</em></p>
<ul><li>Shipped 12 features end-to-end across web and mobile.</li></ul>
<h2>Education</h2>
<p><strong>B.A. Interaction Design</strong> — State University, 2019</p>
<h2>Skills</h2>
<p>Design systems · Prototyping · User research · HTML/CSS · Facilitation</p>`,
    nameZh: "简历",
    descriptionZh: "简洁的单页版式",
    titleZh: "简历 — 你的姓名",
    contentZh: `<p style="text-align:center"><span style="font-size:18pt">你的姓名</span></p>
<p style="text-align:center">城市、省份 · (555) 010-1234 · you@example.com</p>
<hr>
<h2>工作经历</h2>
<p><strong>高级产品设计师</strong> — Acme Corp<br><em>2022 – 至今</em></p>
<ul><li>主导核心体验的重设计，将激活率提升 18%。</li><li>搭建并维护供 40 多位工程师使用的设计系统。</li></ul>
<p><strong>产品设计师</strong> — Startup Inc<br><em>2019 – 2022</em></p>
<ul><li>端到端交付了 12 个功能，覆盖 Web 与移动端。</li></ul>
<h2>教育背景</h2>
<p><strong>交互设计学士</strong> — 州立大学，2019</p>
<h2>技能</h2>
<p>设计系统 · 原型设计 · 用户研究 · HTML/CSS · 引导协作</p>`,
  },
  {
    id: "report",
    name: "Report",
    description: "Structured with headings",
    icon: "BookOpen",
    accent: "text-violet-600",
    title: "Report",
    content: `<h1>Report title</h1>
<p><em>Prepared by … · ${today()}</em></p>
<hr>
<h2>1. Executive summary</h2>
<p>A concise overview of findings and recommendations for busy readers.</p>
<h2>2. Methodology</h2>
<p>How the data was collected and analyzed, with caveats.</p>
<h2>3. Findings</h2>
<h3>3.1 First finding</h3>
<p>Detail, charts, and evidence…</p>
<h3>3.2 Second finding</h3>
<p>Detail, charts, and evidence…</p>
<h2>4. Recommendations</h2>
<ol><li>Recommendation one</li><li>Recommendation two</li></ol>
<h2>Appendix</h2>
<p>Raw data, interview notes, and references.</p>`,
    nameZh: "报告",
    descriptionZh: "结构化的标题层级",
    titleZh: "报告",
    contentZh: `<h1>报告标题</h1>
<p><em>撰写人 … · ${today()}</em></p>
<hr>
<h2>一、执行摘要</h2>
<p>为忙碌的读者提供发现与建议的简明概述。</p>
<h2>二、方法</h2>
<p>数据是如何收集与分析的，以及相关注意事项。</p>
<h2>三、发现</h2>
<h3>3.1 第一个发现</h3>
<p>细节、图表与证据…</p>
<h3>3.2 第二个发现</h3>
<p>细节、图表与证据…</p>
<h2>四、建议</h2>
<ol><li>建议一</li><li>建议二</li></ol>
<h2>附录</h2>
<p>原始数据、访谈记录与参考资料。</p>`,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Announce updates in style",
    icon: "Newspaper",
    accent: "text-orange-600",
    title: "Newsletter — Issue #1",
    content: `<h1 style="text-align:center">The Weekly Brief</h1>
<p style="text-align:center"><em>Issue #1 · ${today()}</em></p>
<hr>
<h2>Top story</h2>
<p>The single most important thing that happened this week, explained in three sentences.</p>
<h2>Quick hits</h2>
<ul><li><strong>Item 1</strong> — a one-line summary with a link.</li><li><strong>Item 2</strong> — a one-line summary with a link.</li><li><strong>Item 3</strong> — a one-line summary with a link.</li></ul>
<h2>Quote of the week</h2>
<blockquote>“Something worth remembering.” — Someone</blockquote>
<h2>What we're watching</h2>
<p>A short teaser for next week's issue.</p>
<p style="text-align:center"><em>Thanks for reading! Reply to share feedback.</em></p>`,
    nameZh: "简报",
    descriptionZh: "以有格调的方式发布动态",
    titleZh: "简报 — 第 1 期",
    contentZh: `<h1 style="text-align:center">每周简报</h1>
<p style="text-align:center"><em>第 1 期 · ${today()}</em></p>
<hr>
<h2>头条</h2>
<p>本周最重要的一件事，用三句话讲清楚。</p>
<h2>快速浏览</h2>
<ul><li><strong>条目 1</strong> — 一句话摘要加链接。</li><li><strong>条目 2</strong> — 一句话摘要加链接。</li><li><strong>条目 3</strong> — 一句话摘要加链接。</li></ul>
<h2>本周语录</h2>
<blockquote>“值得记住的一句话。” — 某人</blockquote>
<h2>我们在关注什么</h2>
<p>下期简报的简短预告。</p>
<p style="text-align:center"><em>感谢阅读！欢迎回复分享反馈。</em></p>`,
  },
]

export function getTemplate(id: string): DocTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

/** Locale-aware view of a template: zh uses the Chinese fields, en uses the English ones. */
export function localizedTemplate(
  tpl: DocTemplate,
  lang: Lang
): { name: string; description: string; title: string; content: string } {
  return lang === "zh"
    ? { name: tpl.nameZh, description: tpl.descriptionZh, title: tpl.titleZh, content: tpl.contentZh }
    : { name: tpl.name, description: tpl.description, title: tpl.title, content: tpl.content }
}
