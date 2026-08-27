"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendLouisMessageAction, type SendLouisMessageState } from "@/app/louis/actions";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  flagged: boolean;
};

export default function LouisChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const boundAction = sendLouisMessageAction.bind(null, conversationId);
  const [state, formAction, isPending] = useActionState<SendLouisMessageState, FormData>(
    boundAction,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {initialMessages.length === 0 && (
          <p className="text-sm text-slate-500">שאל/י את לואי כל שאלה מתוך בסיס הידע.</p>
        )}
        {initialMessages.map((m) => (
          <div
            key={m.id}
            className={`card max-w-[85%] ${
              m.role === "user" ? "self-end bg-indigo-50" : "self-start"
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            {m.flagged && (
              <div className="text-xs text-amber-600 mt-1">⚠ הועבר לבדיקת הנהלה</div>
            )}
          </div>
        ))}
      </div>

      <form ref={formRef} action={formAction} className="flex gap-2">
        <input
          name="message"
          className="input"
          placeholder="שאל/י את לואי..."
          required
          disabled={isPending}
        />
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "שולח..." : "שלח"}
        </button>
      </form>
      {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
    </div>
  );
}
