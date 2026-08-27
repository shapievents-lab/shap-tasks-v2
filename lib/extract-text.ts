import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";

/** Extracts plain text from a document buffer, based on its file extension. */
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

  if (ext === "pptx") {
    return extractPptxText(buffer);
  }

  if (ext === "xlsx") {
    return extractXlsxText(buffer);
  }

  if (ext === "txt" || ext === "csv") {
    return buffer.toString("utf-8");
  }

  throw new Error(`סוג קובץ לא נתמך: .${ext}.`);
}

function unescapeXml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Best-effort PPTX text extraction: a .pptx is a zip of slide XML files, with visible
 * text runs inside <a:t> tags. We don't attempt to reconstruct layout — just pull
 * every text run per slide, in slide order, which is sufficient for search indexing.
 */
async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const slides: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => unescapeXml(m[1]));
    const slideText = texts.join(" ").trim();
    if (slideText) slides.push(slideText);
  }

  return slides.map((s, i) => `שקופית ${i + 1}:\n${s}`).join("\n\n");
}

/**
 * Best-effort XLSX text extraction: reads the shared string table and every
 * worksheet's cells (resolving shared-string indices), row by row. Doesn't resolve
 * real sheet names or formulas — good enough for making spreadsheet content
 * searchable, not for reproducing the spreadsheet.
 */
async function extractXlsxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const sharedStrings: string[] = [];
  const sharedStringsFile = zip.files["xl/sharedStrings.xml"];
  if (sharedStringsFile) {
    const xml = await sharedStringsFile.async("text");
    for (const siMatch of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const texts = [...siMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
        unescapeXml(m[1])
      );
      sharedStrings.push(texts.join(""));
    }
  }

  const sheetFiles = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/sheet(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/sheet(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const sheets: string[] = [];
  for (let sheetIndex = 0; sheetIndex < sheetFiles.length; sheetIndex++) {
    const xml = await zip.files[sheetFiles[sheetIndex]].async("text");
    const rowLines: string[] = [];

    for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cellValues: string[] = [];
      const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        const attrs = cellMatch[1];
        const content = cellMatch[2];
        if (!content) continue;
        const type = attrs.match(/\bt="([^"]*)"/)?.[1];

        let value = "";
        if (type === "inlineStr") {
          value = unescapeXml(content.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
        } else {
          const raw = content.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
          value = type === "s" ? (sharedStrings[Number(raw)] ?? "") : unescapeXml(raw);
        }
        if (value.trim()) cellValues.push(value.trim());
      }
      if (cellValues.length) rowLines.push(cellValues.join(" | "));
    }

    if (rowLines.length) sheets.push(`גיליון ${sheetIndex + 1}:\n${rowLines.join("\n")}`);
  }

  return sheets.join("\n\n");
}
