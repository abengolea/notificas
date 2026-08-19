import { redirect } from "next/navigation";

/** Alias legible de /verify?id= para contadores y abogados. */
export default async function VerificarIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/verify?id=${encodeURIComponent(id || "")}`);
}
