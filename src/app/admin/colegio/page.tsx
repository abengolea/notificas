import { redirect } from "next/navigation";

/** La gestión del colegio está en /admin/plans. */
export default function AdminColegioRedirectPage() {
  redirect("/admin/plans");
}
