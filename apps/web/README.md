# Web Week-1 smoke path

`FixtureProductService` is an in-memory replacement for the unapproved `/api/v1` service boundary. It has no Supabase client, credentials, or direct table access.

Manual smoke path: open the app, choose **Company setup**, submit a company, create an organization node, create a draft agent, then verify the agent on **Command center**. Verify loading, empty, error and unauthorized rendering with the exported screen-state helpers. Replace the fixture only after CTO approval of server-side API contracts.
