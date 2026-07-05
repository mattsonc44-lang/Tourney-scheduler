import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jeyajrahofdpohsaslpx.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpleWFqcmFob2ZkcG9oc2FzbHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTI3MTIsImV4cCI6MjA5ODgyODcxMn0.-hJ51OZpsodSGFpqIaei64KcLs3A5v3T-ssSZLRUeX8";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ─────────────────────────────────────────────────────────────
export const signUp = (email, password) =>
  sb.auth.signUp({ email, password });

export const signIn = (email, password) =>
  sb.auth.signInWithPassword({ email, password });

export const signOut = () => sb.auth.signOut();

export const getSession = () => sb.auth.getSession();

// ── Tournament CRUD ──────────────────────────────────────────────────────────
export async function fetchMyTournaments(userId) {
  // Tournaments I own
  const { data: owned } = await sb
    .from("tournaments")
    .select("id, name, updated_at, owner_id")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  // Tournaments I'm a member of
  const { data: memberships } = await sb
    .from("tournament_members")
    .select("tournament_id, role, tournaments(id, name, updated_at, owner_id)")
    .eq("user_id", userId);

  const sharedIds = new Set((owned||[]).map(t => t.id));
  const shared = (memberships||[])
    .filter(m => m.tournaments && !sharedIds.has(m.tournament_id))
    .map(m => ({ ...m.tournaments, myRole: m.role }));

  return [
    ...(owned||[]).map(t => ({ ...t, myRole: "owner" })),
    ...shared,
  ];
}

export async function loadTournamentFromDB(id) {
  const { data, error } = await sb
    .from("tournaments")
    .select("id, name, data, owner_id")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function saveTournamentToDB(id, name, data, userId) {
  if (id) {
    // Update existing
    const { data: updated, error } = await sb
      .from("tournaments")
      .update({ name, data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, name")
      .single();
    if (error) throw error;
    return updated;
  } else {
    // Insert new
    const { data: inserted, error } = await sb
      .from("tournaments")
      .insert({ name, data, owner_id: userId })
      .select("id, name")
      .single();
    if (error) throw error;
    return inserted;
  }
}

export async function deleteTournamentFromDB(id) {
  const { error } = await sb.from("tournaments").delete().eq("id", id);
  if (error) throw error;
}

// ── Sharing / Members ────────────────────────────────────────────────────────
export async function getMembers(tournamentId) {
  const { data } = await sb
    .from("tournament_members")
    .select("id, email, role, user_id, invited_at")
    .eq("tournament_id", tournamentId)
    .order("invited_at");
  return data || [];
}

export async function inviteMember(tournamentId, email) {
  // Check if user exists by trying to look up via members
  // We insert with email; user_id gets linked when they log in (via a trigger or on login)
  const { data, error } = await sb
    .from("tournament_members")
    .insert({ tournament_id: tournamentId, email: email.toLowerCase(), role: "editor" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeMember(memberId) {
  const { error } = await sb
    .from("tournament_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}

// Link user_id to any pending invites for their email on login
export async function linkUserToInvites(userId, email) {
  await sb
    .from("tournament_members")
    .update({ user_id: userId })
    .eq("email", email.toLowerCase())
    .is("user_id", null);
}

// ── Real-time subscription ───────────────────────────────────────────────────
export function subscribeTournament(id, callback) {
  return sb
    .channel(`tournament:${id}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "tournaments",
      filter: `id=eq.${id}`,
    }, payload => callback(payload.new))
    .subscribe();
}
