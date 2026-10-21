import { createClient } from "@supabase/supabase-js";

if (process.env.ALLOW_STAFF_BOOTSTRAP !== "true" || !process.argv.includes("--confirm")) {
  console.error("Refusing to bootstrap. Set ALLOW_STAFF_BOOTSTRAP=true and pass --confirm.");
  process.exit(1);
}

const secret = process.env.STAFF_BOOTSTRAP_SECRET ?? "";
if (secret.length < 24) {
  console.error("STAFF_BOOTSTRAP_SECRET must be set to at least 24 characters.");
  process.exit(1);
}

const email = process.env.STAFF_EMAIL ?? "";
const password = process.env.STAFF_PASSWORD ?? "";
const displayName = process.env.STAFF_DISPLAY_NAME ?? "Demo staff";
if (!email.includes("@") || password.length < 12) {
  console.error("Set STAFF_EMAIL and a STAFF_PASSWORD of at least 12 characters. The password is not stored in source control.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing Supabase URL or service role key.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const created = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role: "staff" },
});

let userId = created.data.user?.id;
if (created.error) {
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  userId = listed.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id;
  if (!userId) {
    console.error("Could not create or find the staff user.");
    process.exit(1);
  }
  if (process.env.STAFF_RESET_PASSWORD === "true") {
    await supabase.auth.admin.updateUserById(userId, { password, app_metadata: { role: "staff" } });
  } else {
    await supabase.auth.admin.updateUserById(userId, { app_metadata: { role: "staff" } });
  }
}

const profile = await supabase.from("staff_profiles").upsert({ user_id: userId, display_name: displayName, role: "admin" }, { onConflict: "user_id" });
if (profile.error) {
  console.error("Could not save the staff profile.");
  process.exit(1);
}

console.log("Staff profile is ready. The password was not printed.");
