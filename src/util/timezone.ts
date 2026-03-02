/**
 * Detect system timezone for Graph API calendar queries.
 */

import { readlinkSync, existsSync } from "fs";
import { execSync } from "child_process";
import { log } from "../logging.js";

export function detectTimezone(): string {
  const envTz = process.env.GRAPH_TIMEZONE;
  if (envTz) return envTz;

  try {
    if (process.platform === "win32") {
      // Windows: use tzutil
      const raw = execSync("tzutil /g", { encoding: "utf-8" }).trim();
      if (raw) return raw;
    } else {
      // macOS / Linux: read /etc/localtime symlink
      if (existsSync("/etc/localtime")) {
        const target = readlinkSync("/etc/localtime");
        const idx = target.indexOf("zoneinfo/");
        if (idx !== -1) {
          return target.slice(idx + "zoneinfo/".length);
        }
      }
    }
  } catch (e) {
    log.warn(`Timezone detection failed: ${e}`);
  }

  return "UTC";
}
