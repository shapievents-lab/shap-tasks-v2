import { cookies } from "next/headers";
import { query } from "./db";

export type Employee = {
  id: string;
  name: string;
  code: string;
  role: "employee" | "owner";
};

const COOKIE_NAME = "shap_employee_id";

export async function getCurrentEmployee(): Promise<Employee | null> {
  const store = await cookies();
  const empId = store.get(COOKIE_NAME)?.value;
  if (!empId) return null;
  const { rows } = await query<Employee>(
    "SELECT id, name, code, role FROM employees WHERE id = $1",
    [empId]
  );
  return rows[0] ?? null;
}

export async function setCurrentEmployee(employeeId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, employeeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCurrentEmployee() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function findEmployeeByCode(code: string): Promise<Employee | null> {
  const { rows } = await query<Employee>(
    "SELECT id, name, code, role FROM employees WHERE code = $1",
    [code.trim()]
  );
  return rows[0] ?? null;
}

export async function listEmployees(): Promise<Employee[]> {
  const { rows } = await query<Employee>(
    "SELECT id, name, code, role FROM employees ORDER BY role DESC, name"
  );
  return rows;
}
