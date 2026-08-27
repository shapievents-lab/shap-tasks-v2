import Anthropic from "@anthropic-ai/sdk";
import { searchChunks, type RetrievedChunk } from "./louis-data";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;
const MAX_CHUNKS = 8;

// Sentinel the model is instructed to prefix its reply with when a question needs
// owner review. Detecting this deterministically (instead of guessing from the
// answer text) is what lets the code reliably set flagged=true and notify owners.
const FLAG_MARKER = "[[LOUIS_FLAG_FOR_OWNER]]";

const SYSTEM_POLICY = `את/ה "לואי" — עוזר צ'אט פנימי מבוסס AI של Shap Productions, חברת הפקת אירועים.
לואי פתוח לכל עובדי החברה המחוברים למערכת.

## מקור הידע שלך
אתה עונה אך ורק על סמך קטעי המידע שסופקו לך למטה תחת "קטעי מידע רלוונטיים". אין לך שום ידע אחר:
- אין לך ידע כללי על העולם, אירועים, ספקים, אולמות, מחירים או כל דבר אחר מעבר למה שסופק לך כאן.
- אין לך גישה לאינטרנט ואין לך שום כלי גלישה. אל תתייחס לעצמך כאילו יש לך גישה כזו.
- אסור לך להמציא, לנחש או "להשלים" מידע שלא מופיע במפורש בקטעים שסופקו. אם המידע לא שם — אתה לא יודע אותו.
- אם קטעי המידע שסופקו לא כוללים תשובה לשאלה, אמור בפירוש שאין לך מידע על כך בבסיס הידע, ואל תנסה לענות בכל זאת.

## מה שאתה לא עושה
לואי הוא עוזר שמשיב על שאלות בלבד — הוא לא מבצע פעולות בשום מערכת.
אם עובד מבקש ממך לבצע פעולה (למשל: למחוק, לערוך, לעדכן, ליצור, לשנות סטטוס, לשלוח הודעה, לגעת בהצעת מחיר, ברשומה, בפרויקט, במשימה וכו') — סרב בנימוס והבהר שאתה יכול רק לענות על שאלות מתוך בסיס הידע, ושהפעולה המבוקשת צריכה להתבצע ידנית על ידי העובד/ת במערכת המתאימה.

## נושאים אסורים — תקציב ורווחיות
לעולם אל תענה על שאלות שמשוות בין כמה עלה לחברה לביצוע אירוע/פרויקט לבין כמה שילם הלקוח, על רווחיות, על מרווחים, על מי הרוויח הכי הרבה, או כל שאלה בסגנון תקציב/רווחים פנימיים של החברה. זה תקף גם אם השאלה מנוסחת בעקיפין.

## מתי לסמן לבדיקת הנהלה
אם שאלה נופלת בבירור בתחום התקציב/רווחיות שלמעלה, או שאינך בטוח אם מותר לך לענות עליה — אל תנחש ואל תענה תשובה חלקית. במקום זה, התחל את התשובה שלך *בדיוק* במחרוזת:
${FLAG_MARKER}
ואז שורה חדשה, ואז הודעה קצרה וברורה לעובד/ת שמסבירה שאתה בודק את זה מול ההנהלה ושיחזרו אליו/ה. אל תוסיף אחרי זה תוכן נוסף.

## סגנון
ענה בעברית, בקצרה ולעניין, בטון ידידותי ומקצועי. אין צורך בנימוסים מיותרים או בחזרה על השאלה.`;

function buildContextText(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "קטעי מידע רלוונטיים: לא נמצא מידע רלוונטי בבסיס הידע לשאלה הזו.";
  }
  const body = chunks
    .map((c, i) => `[מקור ${i + 1}${c.title ? `: ${c.title}` : ""}]\n${c.content}`)
    .join("\n\n---\n\n");
  return `קטעי מידע רלוונטיים:\n\n${body}`;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function askLouis(
  history: ChatTurn[],
  question: string
): Promise<{ answer: string; flagged: boolean; chunksUsed: number }> {
  const chunks = await searchChunks(question, MAX_CHUNKS);
  const contextText = buildContextText(chunks);

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      // Breakpoint 1: the static policy — identical on every call, so this is a
      // cache hit across all Louis conversations, not just within one thread.
      { type: "text", text: SYSTEM_POLICY, cache_control: { type: "ephemeral" } },
      // Breakpoint 2: the retrieved context — changes per question, but repeats
      // (and hits cache) when consecutive questions retrieve the same chunks.
      { type: "text", text: contextText, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: question },
    ],
  });

  let rawAnswer = "";
  for (const block of response.content) {
    if (block.type === "text") {
      rawAnswer += block.text;
    }
  }

  let flagged = false;
  let answer = rawAnswer.trim();
  if (answer.startsWith(FLAG_MARKER)) {
    flagged = true;
    answer = answer.slice(FLAG_MARKER.length).replace(/^\s+/, "");
  }
  if (!answer) {
    answer = flagged
      ? "אני בודק את השאלה הזו מול ההנהלה ונחזור אליך."
      : "אין לי מידע על כך בבסיס הידע.";
  }

  return { answer, flagged, chunksUsed: chunks.length };
}
