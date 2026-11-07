# Browser-task tool-response probe

`/probe/browser-task/{marker}` serves a fixed, benign JSON body shaped like the task report a browsing tool returns to an agent: top-level `browser_task_id`, `outcome`, `ran`, `duration`, and a `report` object with `status`, `title`, `main_text`, `final_url`, `links_clicked`, `signed_in`, `data_entered`. A linked fetcher therefore receives content in its own native tool-response format.

The report content is fixed RFC 2606 example-domain text; nothing in the body instructs a reader to act. Task ids are deterministic per marker (a version-5 UUID derived from the marker); the `ran` range is generated per request in US Eastern time.

## Use

Serve it as the landing for a link you control. Directly in an event or message:

```text
https://api.vestika.io/probe/browser-task/<marker>
```

Or as the second stage of the calendar-invite follow probe: set `PROBE_FOLLOW_TARGET` to a fresh window and point its `url` at this route with a distinct marker, so the chain is a `follow` hit (redirect issued) followed by a `browser-task` hit (tool-shaped body served):

```json
{"url":"https://api.vestika.io/probe/browser-task/cal-tool-001","expires_at":1793969339}
```

The example is deliberately expired and therefore not an active configuration. Use a distinct marker for each invite or recipient so hits stay attributable.

## Interpret the evidence

- A `browser-task` log entry proves a fetcher retrieved the tool-shaped body. Whether a linked assistant ingested `main_text` — or acted on it — is not observable from this service.
- The response executes nothing and contains no instructions; it tests schema acceptance, not injection effects.
- A user-agent string alone does not authenticate the caller; sync engines and prefetchers fetch links without any assistant deciding anything. Correlate timestamps with invite delivery before attributing a hit.
- If the follow chain is used, a `follow` hit without a `browser-task` hit means the redirect was issued but this route was not reached; the reverse (only `browser-task`) means the link was reached directly without the redirect.

Use only with calendars, messages, and accounts you own or have explicit permission to test. Disclose the probe when asked; do not disguise it.
