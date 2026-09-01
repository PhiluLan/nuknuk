# Dev C Presentation Contract — `awaiting_authority`

## Required visual semantics

An `awaiting_authority` runtime output is an Intelligence proposal, not a Decision, Task, Action, Approval, or execution result.

| Runtime item            | Required presentation                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| `verified_fact`         | Show as verified only with linked manifest evidence.                              |
| `human_input`           | Label as human-provided, not independently verified.                              |
| `external_information`  | Label source/external and show freshness.                                         |
| `agent_inference`       | Label as inference; never style as settled fact.                                  |
| `insufficient_evidence` | Show uncertainty and absence of a conclusion.                                     |
| recommendation          | Render as a recommendation/proposal, not a Decision.                              |
| proposed task           | Render as a draft work proposal with no persisted Task ID.                        |
| proposed action         | Render as an intent only; never as authorized, approved, dispatched, or executed. |

## Safety requirements

Show confidence as informational calibration only. Do not use it to enable controls or imply authority. Every evidence link must resolve only through the server-composed, tenant-scoped view model. Never expose credentials, execution tokens, service-role information, or raw integration payloads.
