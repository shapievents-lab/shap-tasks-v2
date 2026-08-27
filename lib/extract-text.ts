import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/** Extracts plain text from an uploaded document buffer, based on its file extension. */
export async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`סוג קובץ לא נתמך: .${ext}. נתמכים כרגע: PDF, DOCX, TXT.`);
}
