import { query, id as newId } from "./db";

export type LouisConversation = {
  id: string;
  employee_id: string;
  title: string | null;
  started_at: Date;
};

export type LouisConversationWithEmployee = LouisConversation & {
  employee_name: string;
};

export type LouisMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  flagged: boolean;
  created_at: Date;
};

export type RetrievedChunk = {
  id: string;
  document_id: string;
  content: string;
  title: string | null;
  path: string | null;
};

export type DocumentSummary = {
  id: string;
  source: string;
  title: string | null;
  path: string | null;
  updated_at: Date;
  chunk_count: number;
};

export type DocumentDetail = {
  id: string;
  source: string;
  title: string | null;
  path: string | null;
  updated_at: Date;
};

export type DocumentChunkRow = {
  id: string;
  chunk_index: number;
  content: string;
  sensitivity: string;
};

/** Owner-only debugging view: what's actually been ingested so far. */
export async function listDocuments() {
  const { rows } = await query<DocumentSummary>(
    `SELECT d.id, d.source, d.title, d.path, d.updated_at, count(dc.id)::int as chunk_count
     FROM documents d
     LEFT JOIN document_chunks dc ON dc.document_id = d.id
     GROUP BY d.id, d.source, d.title, d.path, d.updated_at
     ORDER BY d.updated_at DESC`
  );
  return rows;
}

export async function getDocument(documentId: string) {
  const { rows } = await query<DocumentDetail>(
    `SELECT id, source, title, path, updated_at FROM documents WHERE id = $1`,
    [documentId]
  );
  return rows[0] ?? null;
}

/** Owner-only debugging view: the exact extracted text stored for one document, chunk by chunk. */
export async function getDocumentChunks(documentId: string) {
  const { rows } = await query<DocumentChunkRow>(
    `SELECT id, chunk_index, content, sensitivity FROM document_chunks
     WHERE document_id = $1 ORDER BY chunk_index ASC`,
    [documentId]
  );
  return rows;
}

export async function createConversation(employeeId: string, title: string | null) {
  const id = newId();
  await query(`INSERT INTO louis_conversations (id, employee_id, title) VALUES ($1, $2, $3)`, [
    id,
    employeeId,
    title,
  ]);
  return id;
}

export async function setConversationTitleIfEmpty(conversationId: string, title: string) {
  await query(
    `UPDATE louis_conversations SET title = $2 WHERE id = $1 AND title IS NULL`,
    [conversationId, title]
  );
}

export async function getConversation(conversationId: string) {
  const { rows } = await query<LouisConversation>(
    `SELECT id, employee_id, title, started_at FROM louis_conversations WHERE id = $1`,
    [conversationId]
  );
  return rows[0] ?? null;
}

export async function getConversationWithEmployee(conversationId: string) {
  const { rows } = await query<LouisConversationWithEmployee>(
    `SELECT c.id, c.employee_id, c.title, c.started_at, e.name as employee_name
     FROM louis_conversations c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.id = $1`,
    [conversationId]
  );
  return rows[0] ?? null;
}

export async function listConversationsForEmployee(employeeId: string) {
  const { rows } = await query<LouisConversation>(
    `SELECT id, employee_id, title, started_at FROM louis_conversations
     WHERE employee_id = $1 ORDER BY started_at DESC`,
    [employeeId]
  );
  return rows;
}

/** Owner-only: every employee's conversations, for read-only oversight. */
export async function listAllConversations() {
  const { rows } = await query<LouisConversationWithEmployee>(
    `SELECT c.id, c.employee_id, c.title, c.started_at, e.name as employee_name
     FROM louis_conversations c
     JOIN employees e ON e.id = c.employee_id
     ORDER BY c.started_at DESC`
  );
  return rows;
}

export async function listMessages(conversationId: string) {
  const { rows } = await query<LouisMessage>(
    `SELECT id, conversation_id, role, content, flagged, created_at
     FROM louis_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  flagged = false
) {
  const id = newId();
  await query(
    `INSERT INTO louis_messages (id, conversation_id, role, content, flagged)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, conversationId, role, content, flagged]
  );
  return id;
}

/**
 * Full-text search over document_chunks for retrieval-augmented answers. The
 * sensitivity filter is enforced here in SQL — never relaxed to a prompt-only
 * instruction — so restricted chunks can never reach the model.
 */
export async function searchChunks(questionText: string, limit = 8) {
  const { rows } = await query<RetrievedChunk>(
    `SELECT dc.id, dc.document_id, dc.content, d.title, d.path
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE dc.sensitivity = 'normal'
       AND dc.tsv @@ websearch_to_tsquery('simple', $1)
     ORDER BY ts_rank(dc.tsv, websearch_to_tsquery('simple', $1)) DESC
     LIMIT $2`,
    [questionText, limit]
  );
  return rows;
}
