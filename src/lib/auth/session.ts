import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const client = await createSupabaseServerClient();
  if (!client) return { client: null, user: null };
  const { data, error } = await client.auth.getUser();
  return {
    client,
    user: error ? null : data.user,
  };
}