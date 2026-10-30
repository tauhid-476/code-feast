import { redirect } from "next/navigation";

export default async function SubmissionsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/events/${id}/review`);
}
