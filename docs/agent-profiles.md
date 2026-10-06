# BUAP Agent Profiles

BUAP Agent Profiles turn a Buddy from "a prompt with a personality" into a portable,
persistent agent contract.

## What a profile owns

A `prismtek-agent-profile-v1` profile carries:

- stable identity and relationship role;
- mission, goals, and responsibilities;
- memory namespace and Agent Life binding;
- preferred execution targets;
- required / optional / denied capabilities;
- autonomy boundaries;
- action and approval rules;
- communication channels;
- standing schedules.

Mutable state is stored separately and includes capability bindings, pause state, task
queues, scheduled work, active work, completion history, and recent activity.

## Always-on agent feature mapping

| Agent capability | BUAP representation | Who actually provides it |
|---|---|---|
| Stable named agent | Agent Profile identity | Any host |
| Ongoing responsibility | Mission + goals + responsibilities | Agent Profile |
| Memory | Namespace + shared/write scopes | Host memory store / Knowledge Vault |
| Learning over time | Agent Life profile/state | `@prismtek/buap-agent-life` + host persistence |
| Connected apps/tools | Capability declarations + verified bindings | Plugins, MCP, APIs, host tools |
| Own computer | Preferred execution target | Host cloud/local computer |
| Background work | `background_allowed` + autonomy | Host daemon/Work/agent service |
| Proactive research | `proactive_research` | Host background runner |
| Scheduled tasks | Profile schedules + runtime scheduled tasks | Host scheduler |
| Approval rules | Action rules | Runtime + host policy |
| Pause/resume | Runtime lifecycle state | `@prismtek/buap-agent-profile` |
| Activity view | Runtime task/activity state | Host UI |
| Specialist agents | `kind: specialist` | Multi-agent host |
| Avatar/pet | Identity references | Host UI / Codex pet / Prismtek app |

## Compiler usage

Add `agentProfiles` to `buap.config.json`:

```json
{
  "agentProfiles": [
    {
      "id": "atlas",
      "displayName": "Atlas",
      "nameSource": "self",
      "relationshipRole": "buddy",
      "kind": "primary",
      "policyProfile": "coding",
      "mission": "Steward important work for the user and return verified results.",
      "goals": ["Keep important work moving"],
      "responsibilities": ["Plan", "Execute", "Verify", "Report"],
      "memory": {
        "namespace": "agents/atlas",
        "shared_context": ["user", "repository"],
        "write_scopes": ["agents/atlas"],
        "proactive_learning": true,
        "life_profile_ref": ".buddy/life-profile.json"
      },
      "execution": {
        "preferred_targets": ["work", "local_computer", "codex_cloud"],
        "background_allowed": true,
        "max_concurrent_tasks": 3
      },
      "capabilities": {
        "required": ["memory"],
        "optional": ["github", "web", "calendar"],
        "denied": []
      },
      "autonomy": {
        "proactive_research": true,
        "create_tasks": true,
        "schedule_tasks": true
      },
      "actionRules": [
        { "match": "repo.read", "behavior": "allow" },
        { "match": "repo.write", "behavior": "preapproved" },
        { "match": "external.*", "behavior": "ask" },
        { "match": "account.*", "behavior": "handoff" },
        { "match": "*", "behavior": "ask" }
      ],
      "channels": ["chat", "app", "ide"],
      "schedules": []
    }
  ]
}
```

The compiler emits:

```text
.buddy/agents/atlas/profile.json
.buddy/agents/index.json
```

The generated agent profile includes the selected policy profile and compiled permission
snapshot, so an identity cannot silently escape the repository's permission contract.

## Runtime usage

```js
import { AgentProfileRuntime } from "@prismtek/buap-agent-profile";

const agent = new AgentProfileRuntime(profile);
agent.bindCapability("memory", { evidence_ref: "knowledge-vault:connected" });
agent.bindCapability("github", { evidence_ref: "connector:github" });

agent.enqueueTask({
  id: "health-check",
  title: "Review repository health",
  action: "repo.read"
});

const start = agent.startTask("health-check");
```

The host persists `agent.snapshot()` and provides actual tools, scheduling, and memory.

## Specialist profile example

A specialist uses the exact same contract but narrows its mission and permissions:

```json
{
  "id": "verifier",
  "displayName": "NEPTR",
  "relationshipRole": "specialist",
  "kind": "specialist",
  "mission": "Verify claims and attach evidence before work is reported complete."
}
```

The compiler requires the full profile fields; the abbreviated example above only shows
the identity difference.

## Boundary

BUAP can provide the agent object, policy, state machine, and portable adapters. It
cannot create a vendor-native cloud computer, account entitlement, messaging identity,
or background service by declaration alone. Those become real only when a host binds
and verifies them.
