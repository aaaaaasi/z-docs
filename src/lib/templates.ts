export interface DocTemplate {
  id: string
  name: string
  description: string
  icon: string // lucide icon key mapped in the gallery component
  accent: string // tailwind text color class for the icon
  title: string
  content: string
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
  },
]

export function getTemplate(id: string): DocTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
