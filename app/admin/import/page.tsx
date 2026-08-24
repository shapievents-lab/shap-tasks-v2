import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/auth";
import ImportForm from "@/components/ImportForm";

export default async function AdminImportPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "owner") redirect("/projects");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">ייבוא נתונים (חד-פעמי)</h1>
      <p className="text-sm text-slate-500">
        הדבקת JSON בפורמט {"{ projects: [...] }"} ליצירת פרויקטים, אנשי קשר ומשימות בבת אחת.
      </p>
      <ImportForm />
    </div>
  );
}
