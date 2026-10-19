import { requireStaff } from "@/lib/context";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { person, current, perms, isAdmin, yptBlocked } = await requireStaff();
  return (
    <AdminLayoutClient person={person} org={current.org} role={current.role} perms={perms} isAdmin={isAdmin} yptBlocked={yptBlocked}>
      {children}
    </AdminLayoutClient>
  );
}
