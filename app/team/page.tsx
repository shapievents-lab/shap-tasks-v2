import { redirect } from "next/navigation";
import { getCurrentEmployee, listEmployees, type Employee } from "@/lib/auth";
import { listAllOpenTasks, type TaskWithProject } from "@/lib/data";
import TeamTaskRow from "@/components/TeamTaskRow";

export default async function TeamPage() {
  const me = await getCurrentEmployee();
  if (!me) redirect("/login");

  const [employees, tasks] = await Promise.all([listEmployees(), listAllOpenTasks()]);
  const teamMembers = employees.filter((e) => e.role === "employee");

  const unassigned = tasks.filter((t) => !t.owner_employee_id && t.status !== "done");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-bold">משימות הצוות</h1>
      <p className="text-sm text-slate-500 -mt-4">
        כל המשימות הפתוחות מכל הפרויקטים, לפי איש/אשת צוות. אפשר לשנות שיוך ישירות מכאן.
      </p>

      {unassigned.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="badge badge-stuck">{unassigned.length}</span>
            משימות שטרם שויכו
          </h2>
          <div className="flex flex-col gap-2">
            {unassigned.map((t) => (
              <TeamTaskRow key={t.id} task={t} employees={teamMembers} />
            ))}
          </div>
        </section>
      )}

      {teamMembers.map((emp) => (
        <EmployeeSection key={emp.id} employee={emp} tasks={tasks} employees={teamMembers} />
      ))}
    </div>
  );
}

function EmployeeSection({
  employee,
  tasks,
  employees,
}: {
  employee: Employee;
  tasks: TaskWithProject[];
  employees: Employee[];
}) {
  const mine = tasks.filter((t) => t.owner_employee_id === employee.id);
  const high = mine.filter((t) => t.urgency === "high" && t.status !== "done");
  const low = mine.filter((t) => t.urgency === "low" && t.status !== "done");
  const done = mine.filter((t) => t.status === "done");

  return (
    <section className="card">
      <h2 className="font-bold text-lg mb-3">{employee.name}</h2>
      {mine.length === 0 && <p className="text-sm text-slate-500">אין כרגע משימות משויכות.</p>}

      <TaskGroup title="דחיפות גבוהה" accent="high" tasks={high} employees={employees} />
      <TaskGroup title="דחיפות נמוכה" accent="low" tasks={low} employees={employees} />
      <TaskGroup title="הושלמו" accent="done" tasks={done} employees={employees} />
    </section>
  );
}

function TaskGroup({
  title,
  accent,
  tasks,
  employees,
}: {
  title: string;
  accent: "high" | "low" | "done";
  tasks: TaskWithProject[];
  employees: Employee[];
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <span className={`badge badge-${accent}`}>{tasks.length}</span>
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TeamTaskRow key={t.id} task={t} employees={employees} />
        ))}
      </div>
    </div>
  );
}
