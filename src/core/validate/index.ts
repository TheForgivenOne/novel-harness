import type { Bundle } from "../bundle/bundle.ts";
import { summarize, type ValidationResult } from "./diagnostics.ts";
import { validateContinuity } from "./continuity.ts";
import { validateOkf } from "./okf.ts";
import { validateFanfic, validateProfile } from "./profile.ts";
import { validateTimelineOrder } from "./timeline.ts";
import { validateWordCounts } from "./words.ts";

export function validateBundle(bundle: Bundle): ValidationResult {
  return summarize([
    ...validateOkf(bundle),
    ...validateProfile(bundle),
    ...validateFanfic(bundle),
    ...validateContinuity(bundle),
    ...validateWordCounts(bundle),
    ...validateTimelineOrder(bundle),
  ]);
}

export { formatDiagnostic, summarize } from "./diagnostics.ts";
export { keepDiagnostic, matchesOnly } from "./filter.ts";
export type { Diagnostic, Severity, ValidationResult } from "./diagnostics.ts";
