import { createHash } from "node:crypto";
import { query, id as newId } from "./db";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

/** Splits text into overlapping character chunks for full-text search retrieval. */
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export type IngestDocumentInput = {
  source: string;
  sourceId: string;
  title?: string | null;
  path?: string | null;
  content: string;
  sensitivity?: string;
};

export type IngestResult = { documentId: string; chunkCount: number; skipped: boolean };

/**
 * Ingests (or re-ingests) a single document: upserts it into `documents` by
 * source_id, then replaces its rows in `document_chunks`. Skips re-chunking when
 * the content is byte-identical to the last ingest (via content_hash).
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestResult> {
  const contentHash = createHash("sha256").update(input.content).digest("hex");
  const sensitivity = input.sensitivity ?? "normal";

  const existing = await query<{ id: string; content_hash: string | null }>(
    `SELECT id, content_hash FROM documents WHERE source_id = $1`,
    [input.sourceId]
  );

  let documentId: string;
  if (existing.rows.length > 0) {
    documentId = existing.rows[0].id;
    if (existing.rows[0].content_hash === contentHash) {
      return { documentId, chunkCount: 0, skipped: true };
    }
    await query(
      `UPDATE documents SET title = $2, path = $3, content_hash = $4, updated_at = now()
       WHERE id = $1`,
      [documentId, input.title ?? null, input.path ?? null, contentHash]
    );
  } else {
    documentId = newId();
    await query(
      `INSERT INTO documents (id, source, source_id, title, path, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [documentId, input.source, input.sourceId, input.title ?? null, input.path ?? null, contentHash]
    );
  }

  await query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

  const chunks = chunkText(input.content);
  for (let i = 0; i < chunks.length; i++) {
    await query(
      `INSERT INTO document_chunks (id, document_id, chunk_index, content, sensitivity)
       VALUES ($1, $2, $3, $4, $5)`,
      [newId(), documentId, i, chunks[i], sensitivity]
    );
  }

  return { documentId, chunkCount: chunks.length, skipped: false };
}

/**
 * TODO(sari): live sync from the "SHAP - מסמכים מעודכן" Google Drive folder isn't
 * built yet — it needs a Google service account credential that doesn't exist yet.
 * Once available, this should: list files in the target Drive folder, extract text
 * per file type (Docs export, PDF/DOCX text extraction, etc.), and call
 * ingestDocument({ source: "gdrive", sourceId: driveFileId, ... }) for each file.
 * Until then, use POST /api/admin/ingest to load sample documents by hand.
 */
export async function ingestDriveFolder(_folderId: string): Promise<never> {
  throw new Error(
    "ingestDriveFolder() is not implemented yet — needs a Google Drive service account. " +
      "Use POST /api/admin/ingest to add documents manually in the meantime."
  );
}

/**
 * TODO(sari): the "בונה הצעות מחיר - SHAP" Claude artifact (supplier list, service
 * catalog, saved proposals) has no API to read from — needs a decision on
 * integration approach (ask Sari) before this can be built. Not implemented.
 */
export async function ingestProposalBuilder(): Promise<never> {
  throw new Error("ingestProposalBuilder() is not implemented — integration approach pending, ask Sari.");
}

/**
 * TODO(sari): Canva search requires a Canva API connection that doesn't exist yet.
 * Not implemented.
 */
export async function searchCanva(_query: string): Promise<never> {
  throw new Error("searchCanva() is not implemented — needs a Canva API connection.");
}
