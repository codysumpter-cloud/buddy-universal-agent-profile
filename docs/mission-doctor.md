# BUAP Mission Doctor — diagnosis and paired checkpoints

The optional \`@prismtek/buap-mission-control\` package now includes read-only Mission Doctor operations:

- \`inspectMission(mission)\`: explain exactly which steps are ready, blocked by dependencies, missing verified capabilities, awaiting approval, out of budget, paused, or already in progress
- \`renderMissionReport(report)\`: concise status Markdown suitable for a host console, review or GitHub comment
- \`captureMissionCheckpoint(mission, {revision})\`: pair the existing Agent Profile and Mission Control snapshots in one checksummed document
- \`verifyMissionCheckpoint(checkpoint, {minimumRevision, profileHash, missionHash})\`: check checksum, monotonic revision and provenance before host rehydration

## Correct host lifecycle

1. Use the active repo instructions and capability detection before starting a mission.
2. Call Mission Doctor without granting any permissions or running tools.
3. Surface approval requests in the **real host's** permission UI. A diagnostic report cannot grant approval.
4. Use a host-backed atomic write or database transaction to save each paired checkpoint; the library computes the envelope but does not persist it.
5. The host stores the expected monotonic revision **outside the snapshot**. On restore, reject a lower revision, then restore \`AgentProfileRuntime\` first and \`MissionControl\` second.
6. If any step was \`in_progress\`, reconcile external side effects via stable service operation IDs before any retry. The Doctor deliberately reports \`requires_reconciliation\`, never auto-retries.
7. Send only scrubbed status reports to public issue trackers; source refs, task descriptions and evidence may contain sensitive details. Keep complete checkpoints in an access-controlled host store.

\`\`\`js
import { inspectMission, renderMissionReport,
  captureMissionCheckpoint, verifyMissionCheckpoint
} from "@prismtek/buap-mission-control/doctor";

const result = inspectMission(mission);
console.log(renderMissionReport(result));

// Host must save this atomically and keep authoritative revision separately.
const pair = captureMissionCheckpoint(mission, { revision: 4 });
// On restart, the host reads the previously committed checkpoint:
const snapshots = verifyMissionCheckpoint(pair, {
  minimumRevision: 4,
  profileHash: agent.profileHash,
  missionHash: mission.manifestHash,
});
// Rehydrate AgentProfileRuntime(snapshots.agent) before MissionControl(snapshots.mission)
\`\`\`

Security: checksums are integrity hints within trusted storage, **not signatures or authentication**. An adversary able to rewrite both checkpoint and hash can forge the pair. Host attestation, storage ACL, true durable event journals, concurrency/CAS locks and external operation idempotency are independent requirements.

## Runtime boundaries

A Mission Doctor report is an explanation, not proof the inferred host is live. All tools, worker execution, cross-agent transport, actual money quotas and background scheduling remain controlled by the host. Avoid sending full internal checkpoint JSON to a public report.
