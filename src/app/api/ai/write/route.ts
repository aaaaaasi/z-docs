import { NextRequest, NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/ai/write { prompt, title? }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string; title?: string }
    const prompt = body.prompt?.trim()
    if (!prompt) {
      return NextResponse.json({ error: "A prompt is required" }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: "Prompt is too long (max 1000 characters)" }, { status: 400 })
    }

    const title = body.title?.trim().slice(0, 150) || "Untitled document"

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            "You are the \"Help me write\" assistant inside Z-Docs, a collaborative document editor. " +
            "Write clear, well-structured draft content in plain text. Use short paragraphs separated by blank lines, " +
            "and use ALL-CAPS-free natural headings on their own lines when it helps. " +
            "Match the requested tone and length. Output ONLY the draft text — no preamble, no explanations, no markdown fences.",
        },
        {
          role: "user",
          content: `The document is titled "${title}".\n\nWrite the following:\n${prompt}`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const text = completion.choices[0]?.message?.content?.trim()
    if (!text) {
      return NextResponse.json({ error: "The AI returned an empty draft — try rephrasing." }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch (e) {
    console.error("POST /api/ai/write failed:", e)
    return NextResponse.json(
      { error: "The AI service is unavailable right now. Please try again." },
      { status: 502 }
    )
  }
}
