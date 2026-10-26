import type { BriefRunInfo, PrepResume } from "../../lib/prep-contract";

export function successfulBriefRun(
  resume: Pick<PrepResume, "briefRun" | "briefResultRun">,
): BriefRunInfo | null {
  return (
    resume.briefResultRun ??
    (resume.briefRun?.status === "completed" ? resume.briefRun : null)
  );
}
