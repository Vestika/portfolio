# Controlled loopback redirect probes

These routes issue redirects to one synthetic HTTP fixture operated by the researcher in their own sandbox. They do not fetch the destination, read files, or relay response bodies. They are disabled unless the deployment operator supplies `PROBE_LOOPBACK_FIXTURE`.

## Configure a fresh test window

1. Deploy the code with the new routes disabled. No deployment settings are changed by this PR.
2. Start a temporary server in the test sandbox, bound only to `127.0.0.1` on an OS-selected unprivileged port. Serve only a synthetic marker at a randomly generated `/probe-<32 lowercase hex digits>` path, return 404 elsewhere, log received requests, and stop automatically after ten minutes. Do not serve a directory or existing private files.
3. Set the deployment environment variable `PROBE_LOOPBACK_FIXTURE` to a JSON object containing exactly `port` (integer 1024–65535), `path` (the generated path), and `expires_at` (positive integer UTC Unix seconds). Set the expiry no later than the fixture's shutdown time. Never reuse an expired fixture without checking that the same controlled server is running.

Example shape, deliberately expired and therefore not an active configuration:

```json
{"port":35397,"path":"/probe-daaeea2253fc7e049892e350bd45c7c1","expires_at":1793969339}
```

Coordinate configuration rollout with the fixture lifetime. The original November 6 test fixture expires at 12:48:59 UTC and cannot be presumed available after that. Environment configuration requires an operator; no `.env` file is modified by this feature.

## Run the comparison

The only accepted host choices are:

```text
https://api.vestika.io/probe/loopback/127.0.0.1/<fresh-marker>.gif
https://api.vestika.io/probe/loopback/localhost/<different-fresh-marker>.gif
```

Use a distinct marker for each attempt, including any local preflight. A no-follow HTTP client can verify the issued status and `Location` first. Do not follow the loopback redirect from your own Mac: that would target your Mac, not the image fetcher.

The destination is fixed by server configuration; request query parameters cannot choose a port, path, scheme, or additional host. Missing configuration returns 404, malformed configuration returns 503, expired configuration returns 410, and other host choices fail route validation. Successful responses return 302 with cache prevention headers.

Disclose the loopback destination when asking a renderer to display either test URL. If it refuses or requires approval, record that outcome; do not disguise the destination or self-approve. Do not click the image link yourself. After the attempt, inspect the synthetic server's own request log and correlate its path and timestamps with the first-hop probe logs. A separate direct health check needs a distinguishable user agent and timestamp so it cannot be confused with image-proxy traffic.

## Interpret the evidence

- `event: redirect_issued` means this service received the first request and issued a redirect. It does not confirm that the client followed it.
- A correlated request in the controlled destination's log establishes arrival at that fixture. Attribute the caller cautiously: a user-agent string alone does not authenticate it.
- Absence of a destination log is inconclusive: a proxy may block loopback, run in a different network namespace, resolve localhost differently, or encounter an expired fixture.
- Displaying a synthetic response is distinct from retrieving arbitrary local files. The redirect service cannot copy a downstream response into a callback URL.
- Existing `/probe/rt/canary-<marker>.gif` handles the official Meta canary separately. A first-hop canary redirect log is not a canary alert.

Remove `PROBE_LOOPBACK_FIXTURE` after the test. Expiry also prevents new redirects while cleanup or deployment catches up. These routes do not establish where the image proxy runs, whether it is shared, or whether a bounty-eligible boundary was crossed.
