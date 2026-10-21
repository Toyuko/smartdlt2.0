import { connection } from "next/server";
import { route } from "@/lib/api";
import { getCatalog } from "@/lib/data/store";
import { json } from "@/lib/http";

export const GET = route(async () => {
  await connection();
  return json(await getCatalog());
});
