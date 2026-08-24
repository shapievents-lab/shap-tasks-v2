import { loginAction } from "@/app/actions";
import { getCurrentEmployee } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const me = await getCurrentEmployee();
  if (me) redirect(me.role === "owner" ? "/owner" : "/projects");

  const hasError = searchParams?.error;

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-indigo-600">Shap Tasks</h1>
        <p className="text-slate-500 mt-1">מערכת ניהול המשימות של הצוות</p>
      </div>
      <form action={loginAction} className="card flex flex-col gap-4">
        <label className="text-sm font-medium">
          קוד כניסה אישי
          <input
            name="code"
            autoFocus
            className="input mt-1"
            placeholder="הקלד/י את הקוד שלך"
          />
        </label>
        {hasError && (
          <p className="text-red-600 text-sm">קוד לא נמצא, נסה/נסי שוב.</p>
        )}
        <button className="btn btn-primary justify-center" type="submit">
          כניסה
        </button>
      </form>
    </div>
  );
}
