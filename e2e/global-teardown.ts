import { rm } from "node:fs/promises";

export default async function globalTeardown() {
  await Promise.all([
    process.env.EUCHRE_LOCAL_EVENT_STORE_PATH ? rm(process.env.EUCHRE_LOCAL_EVENT_STORE_PATH, { force: true }) : Promise.resolve(),
    process.env.EUCHRE_E2E_FIXTURE_PATH ? rm(process.env.EUCHRE_E2E_FIXTURE_PATH, { force: true }) : Promise.resolve()
  ]);
}
