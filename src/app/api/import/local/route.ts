import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { guardRoute, sanitizeDocHtml } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/import/local — guest → cloud sync.
 * When a guest signs in (or creates an account), the browser uploads its
 * localStorage workspace snapshot here and we recreate every item owned by
 * the freshly authenticated user. This is the whole point of having an
 * account: sync + cloud storage, while guest mode keeps everything local.
 *
 * Input: the `readGuestSnapshot()` payload (documents/folders/tags/sheets/
 * decks/forms). Output: { imported: { documents, folders, tags, sheets,
 * decks, forms } }.
 */

const MAX_ITEMS = 200
const MAX_STRING = 1_000_000 // 1 MB per text field
const FOLDER_COLORS = ["#0b6b62", "#9a6b2f", "#a15c48", "#5e7050", "#8d5a74", "#a04b3c", "#6e6259"]
const TAG_COLORS = ["#0b6b62", "#d93025", "#f9ab00", "#1e8e3e", "#a142f4", "#5f6368"]

function str(v: unknown, max = MAX_STRING): string {
  return typeof v === "string" ? v.slice(0, max) : ""
}

function bool(v: unknown): boolean {
  return v === true
}

export async function POST(req: NextRequest) {
  const guard = await guardRoute(req, { mutating: true, limit: 30, windowMs: 60_000 })
  if (!guard.ok) return guard.response
  const me = guard.user

  try {
    const body = (await req.json().catch(() => ({}))) as {
      documents?: unknown
      folders?: unknown
      sheets?: unknown
      decks?: unknown
      forms?: unknown
    }

    const imported = { documents: 0, folders: 0, tags: 0, sheets: 0, decks: 0, forms: 0 }

    /* ---- folders (local id → new cloud id map) ---- */
    const folderIdMap = new Map<string, string>()
    const rawFolders = Array.isArray(body.folders) ? body.folders.slice(0, MAX_ITEMS) : []
    for (const f of rawFolders) {
      const name = str((f as { name?: unknown }).name, 80).trim()
      const localId = str((f as { id?: unknown }).id, 64)
      if (!name) continue
      const color = str((f as { color?: unknown }).color, 7)
      const existing = await db.folder.findFirst({ where: { name, ownerId: me.id }, select: { id: true } })
      const folder = existing
        ? existing
        : await db.folder.create({
            data: {
              name,
              color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : FOLDER_COLORS[imported.folders % FOLDER_COLORS.length],
              ownerId: me.id,
            },
          })
      if (localId) folderIdMap.set(localId, folder.id)
      else folderIdMap.set(name, folder.id) // legacy snapshots keyed by name
      imported.folders += 1
    }

    /* ---- tags (name → new id map, per user) ---- */
    const tagIdMap = new Map<string, string>()
    const ensureTag = async (name: string) => {
      const key = name.toLowerCase()
      const known = tagIdMap.get(key)
      if (known) return known
      const existing = await db.tag.findFirst({ where: { name, ownerId: me.id }, select: { id: true } })
      const tag = existing ?? (await db.tag.create({ data: { name, color: TAG_COLORS[tagIdMap.size % TAG_COLORS.length], ownerId: me.id } }))
      tagIdMap.set(key, tag.id)
      imported.tags += existing ? 0 : 1
      return tag.id
    }

    /* ---- documents ---- */
    const rawDocs = Array.isArray(body.documents) ? body.documents.slice(0, MAX_ITEMS) : []
    for (const d of rawDocs) {
      const doc = d as {
        title?: unknown
        content?: unknown
        starred?: unknown
        trashed?: unknown
        folderId?: unknown
        stats?: unknown
        tags?: unknown
      }
      const title = str(doc.title, 200).trim() || "Untitled document"
      const content = sanitizeDocHtml(str(doc.content))
      const folderRef = typeof doc.folderId === "string" ? doc.folderId : ""
      const folderId = folderIdMap.get(folderRef) ?? null
      let stats = ""
      if (doc.stats && typeof doc.stats === "object") {
        stats = JSON.stringify(doc.stats).slice(0, 20_000)
      } else if (typeof doc.stats === "string") {
        stats = doc.stats.slice(0, 20_000)
      }
      const created = await db.document.create({
        data: { title, content, starred: bool(doc.starred), trashed: bool(doc.trashed), folderId, stats, ownerId: me.id },
        select: { id: true },
      })
      const tagNames = Array.isArray(doc.tags)
        ? doc.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).slice(0, 20)
        : []
      for (const tn of tagNames) {
        const tagId = await ensureTag(tn.trim().slice(0, 24))
        await db.documentTag.upsert({
          where: { docId_tagId: { docId: created.id, tagId } },
          create: { docId: created.id, tagId },
          update: {},
        }).catch(() => {})
      }
      imported.documents += 1
    }

    /* ---- sheets / decks / forms ---- */
    const rawSheets = Array.isArray(body.sheets) ? body.sheets.slice(0, MAX_ITEMS) : []
    for (const s of rawSheets) {
      await db.sheet.create({
        data: {
          title: str((s as { title?: unknown }).title, 200).trim() || "Untitled spreadsheet",
          data: str((s as { data?: unknown }).data, MAX_STRING) || "{}",
          starred: bool((s as { starred?: unknown }).starred),
          trashed: bool((s as { trashed?: unknown }).trashed),
          ownerId: me.id,
        },
      })
      imported.sheets += 1
    }
    const rawDecks = Array.isArray(body.decks) ? body.decks.slice(0, MAX_ITEMS) : []
    for (const d of rawDecks) {
      await db.slideDeck.create({
        data: {
          title: str((d as { title?: unknown }).title, 200).trim() || "Untitled presentation",
          data: str((d as { data?: unknown }).data, MAX_STRING) || "[]",
          starred: bool((d as { starred?: unknown }).starred),
          trashed: bool((d as { trashed?: unknown }).trashed),
          ownerId: me.id,
        },
      })
      imported.decks += 1
    }
    const rawForms = Array.isArray(body.forms) ? body.forms.slice(0, MAX_ITEMS) : []
    for (const f of rawForms) {
      await db.form.create({
        data: {
          title: str((f as { title?: unknown }).title, 200).trim() || "Untitled form",
          description: str((f as { description?: unknown }).description, 2000),
          data: str((f as { data?: unknown }).data, MAX_STRING) || "[]",
          starred: bool((f as { starred?: unknown }).starred),
          trashed: bool((f as { trashed?: unknown }).trashed),
          ownerId: me.id,
        },
      })
      imported.forms += 1
    }

    return Response.json({ imported })
  } catch (e) {
    console.error("POST /api/import/local failed:", e)
    return Response.json({ error: "同步本地数据失败" }, { status: 500 })
  }
}
