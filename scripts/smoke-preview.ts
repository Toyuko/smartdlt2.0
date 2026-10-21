export {};

const base = process.argv[2]?.replace(/\/$/, "");
if (!base) {
  console.error("Usage: npm run smoke -- https://your-preview.vercel.app");
  process.exit(1);
}

const notice = "DEMONSTRATION SYSTEM — NOT AN OFFICIAL DLT SERVICE";
const home = await fetch(base);
const html = await home.text();
if (!home.ok || !html.includes(notice)) {
  console.error("Home page is missing the demonstration notice.");
  process.exit(1);
}

const about = await fetch(`${base}/about-demo`);
if (!about.ok) {
  console.error("About page failed.");
  process.exit(1);
}

const health = await fetch(`${base}/api/health`);
const healthBody = await health.json();
console.log("Health:", health.status, healthBody.database);

const rejected = await fetch(`${base}/api/bookings`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
if (rejected.status === 200 || rejected.status === 201) {
  console.error("Empty booking submission was accepted.");
  process.exit(1);
}

const staff = await fetch(`${base}/api/staff/summary`);
if (staff.status !== 401 && staff.status !== 403 && staff.status !== 503) {
  console.error(`Staff summary was not protected. Status ${staff.status}.`);
  process.exit(1);
}

console.log("Preview smoke checks passed.");
