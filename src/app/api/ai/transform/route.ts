import { NextRequest, NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** One-click AI transformations for selected text or the whole document. */
export type AiAction = "summarize" | "improve" | "proofread" | "shorten" | "lengthen" | "simplify"

const ACTION_PROMPTS: Record<AiAction, string> = {
  summarize:
    "Summarize the user's text into a tight digest. Start with a one-sentence overview, then 3–5 terse bullet lines (each starting with \"• \") covering the key points, decisions and open questions. Keep all names, dates and numbers.",
  improve:
    "Rewrite the user's text to be clearer, better structured and more polished while preserving its full meaning and every fact. Improve flow, word choice and sentence structure. Do not add new information. Keep the original language.",
  proofread:
    "Fix grammar, spelling, punctuation and obvious typos in the user's text. Return the corrected text only — no commentary, no list of changes. Preserve meaning, tone, formatting and the original language exactly.",
  shorten:
    "Cut the user's text to roughly half its length while keeping every key point and fact. Prefer tighter sentences and remove filler, repetition and redundancy. Keep the original language and tone.",
  lengthen:
    "Expand the user's text to roughly 1.5–2× its length with relevant detail, natural transitions and concrete phrasing. Stay consistent with the existing tone and do not invent facts that contradict the source. Keep the original language.",
  simplify:
    "Rewrite the user's text in plain, simple language a busy general reader understands immediately. Short sentences, common words, no jargon (or briefly explain it). Preserve meaning and keep the original language.",
}

const MAX_INPUT = 12_000

// POST /api/ai/transform { text, action, title?, lang? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      text?: string
      action?: string
      title?: string
      lang?: string
    }
    const text = body.text?.trim()
    const action = body.action as AiAction | undefined

    if (!text) {
      return NextResponse.json({ error: "Some text is required" }, { status: 400 })
    }
    if (text.length > MAX_INPUT) {
      return NextResponse.json({ error: `Text is too long (max ${MAX_INPUT.toLocaleString()} characters)` }, { status: 400 })
    }
    const instruction = action ? ACTION_PROMPTS[action as AiAction] : undefined
    if (!instruction) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
    // UI language is Chinese → every transformation responds in Simplified Chinese
    const finalInstruction =
      body.lang === "zh" ? instruction + " Respond in Simplified Chinese (简体中文)." : instruction

    const title = body.title?.trim().slice(0, 150) || "Untitled document"

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "You are the AI editing assistant inside Z-Docs, a collaborative document editor. " +
            "You transform the user's text exactly as instructed. " +
            "Output ONLY the transformed text — no preamble, no explanations, no markdown fences. " +
            "Preserve paragraph breaks (blank lines between paragraphs) where it reads naturally.",
        },
        {
          role: "user",
          content: `The document is titled "${title}".\n\n${finalInstruction}\n\n----- TEXT START -----\n${text}\n----- TEXT END -----`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const out = completion.choices[0]?.message?.content?.trim()
    if (!out) {
      return NextResponse.json({ error: "The AI returned an empty result — try again." }, { status: 502 })
    }

    return NextResponse.json({ text: out })
  } catch (e) {
    console.error("POST /api/ai/transform failed:", e)
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 }
    )
  }
}
