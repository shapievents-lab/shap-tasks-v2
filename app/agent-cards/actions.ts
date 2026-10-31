"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import {
  applyCard,
  getAgentCard,
  isReviewer,
  rejectAgentCard,
  type Card,
  type SegmentTarget,
} from "@/lib/agent";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** Rebuilds the card from the review form: only what the reviewer kept, with her edits. */
function cardFromForm(proposed: Card, fd: FormData): { card: Card; targets: SegmentTarget[] } {
  const targets: SegmentTarget[] = [];
  const segments = proposed.segments.map((seg, i) => {
    const choice = str(fd, `seg${i}_project`);
    targets.push({
      projectId: choice && !choice.startsWith("__") ? choice : null,
      newProjectName: choice === "__new__" ? str(fd, `seg${i}_newname`) || null : null,
    });
    return {
      ...seg,
      task_changes: (seg.task_changes ?? [])
        .map((tc, j) => {
          if (!fd.get(`seg${i}_tc${j}_on`)) return null;
          return {
            ...tc,
            title: str(fd, `seg${i}_tc${j}_title`) || tc.title,
            items: tc.items.map((it, k) => ({ ...it, text: str(fd, `seg${i}_tc${j}_it${k}`) })),
          };
        })
        .filter((tc) => tc !== null),
      event_details: (seg.event_details ?? [])
        .map((d, k) => (fd.get(`seg${i}_ed${k}_on`) ? { ...d, value: str(fd, `seg${i}_ed${k}_value`) } : null))
        .filter((d) => d !== null),
      contacts: (seg.contacts ?? [])
        .map((c, k) =>
          fd.get(`seg${i}_ct${k}_on`)
            ? {
                name: str(fd, `seg${i}_ct${k}_name`),
                phone: str(fd, `seg${i}_ct${k}_phone`) || null,
                role: str(fd, `seg${i}_ct${k}_role`) || null,
              }
            : null
        )
        .filter((c) => c !== null),
    };
  });
  return { card: { ...proposed, segments }, targets };
}

export async function approveAgentCardAction(cardId: string, formData: FormData) {
  const me = await getCurrentEmployee();
  if (!me || !isReviewer(me)) redirect("/projects");
  const row = await getAgentCard(cardId);
  if (!row?.proposed_card || row.status !== "pending") redirect("/agent-cards");

  const { card, targets } = cardFromForm(row.proposed_card, formData);
  await applyCard(cardId, card, targets, me.id);
  revalidatePath("/agent-cards");
  revalidatePath("/projects");
  redirect(`/agent-cards/${cardId}`);
}

export async function rejectAgentCardAction(cardId: string) {
  const me = await getCurrentEmployee();
  if (!me || !isReviewer(me)) redirect("/projects");
  await rejectAgentCard(cardId, me.id);
  revalidatePath("/agent-cards");
  redirect("/agent-cards");
}
