import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";

export default async function Home() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  redirect(me.role === "owner" ? "/owner" : "/projects");
}
