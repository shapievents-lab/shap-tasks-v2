"use client";

import { useState } from "react";
import type { Contact } from "@/lib/data";

export default function ContactRow({
  contact,
  updateAction,
  deleteAction,
}: {
  contact: Contact;
  updateAction: (contactId: string, formData: FormData) => Promise<void> | void;
  deleteAction: (contactId: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const saveThis = updateAction.bind(null, contact.id);
  const deleteThis = deleteAction.bind(null, contact.id);

  if (editing) {
    return (
      <form
        action={async (formData) => {
          await saveThis(formData);
          setEditing(false);
        }}
        className="grid sm:grid-cols-4 gap-2 border-b last:border-0 py-2"
      >
        <input name="name" defaultValue={contact.name} placeholder="שם" className="input input-sm" required />
        <input name="phone" defaultValue={contact.phone ?? ""} placeholder="טלפון" className="input input-sm" dir="ltr" />
        <input name="role" defaultValue={contact.role ?? ""} placeholder="תפקיד (ספק/לקוח/אחר)" className="input input-sm" />
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" type="submit">
            שמור
          </button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={() => setEditing(false)}>
            ביטול
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b last:border-0 py-1 text-sm">
      <span className="font-medium">{contact.name}</span>
      <span className="text-slate-500">{contact.role}</span>
      <span dir="ltr" className="text-slate-500">
        {contact.phone}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button className="text-xs text-indigo-600" type="button" onClick={() => setEditing(true)}>
          ערוך
        </button>
        {confirmingDelete ? (
          <>
            <span className="text-xs text-red-600">למחוק?</span>
            <form action={deleteThis}>
              <button className="text-xs text-red-600 font-semibold" type="submit">
                כן, מחק
              </button>
            </form>
            <button className="text-xs text-slate-500" type="button" onClick={() => setConfirmingDelete(false)}>
              ביטול
            </button>
          </>
        ) : (
          <button className="text-xs text-red-600" type="button" onClick={() => setConfirmingDelete(true)}>
            מחק
          </button>
        )}
      </div>
    </div>
  );
}
