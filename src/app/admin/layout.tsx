import { requireLeader } from "@/lib/context";
import AdminLayoutClient from "./AdminLayoutClient";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { person, current } = await requireLeader();
  return (
    <AdminLayoutClient person={person} org={current.org} role={current.role}>
      {children}
    </AdminLayoutClient>
  );
}
