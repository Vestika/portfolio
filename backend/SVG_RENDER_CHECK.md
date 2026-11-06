# SVG rendering check through the probe API

These routes must be deployed before using their public URLs. Local tests do not establish that api.vestika.io is running this version.

- `/probe/svg-control/{marker}` serves a 480×120 SVG displaying `NOT_EXECUTED`.
- `/probe/svg-script/{marker}` serves the identical SVG with one fixed script that changes its own text to `SCRIPT_EXECUTED`.
- Both return `image/svg+xml`, disable caching, and log the fetch under their respective case names. Markers are not reflected into the SVG. The script has no callbacks, file operations, or credential access.
- The existing `/probe/svg/{marker}` still serves its original tiny static image.

## Check the deployment

Use a separate preflight marker so your manual requests cannot be mistaken for Muse traffic:

```sh
curl --fail --silent --show-error --dump-header - https://api.vestika.io/probe/svg-control/preflight-20261106-a.svg
curl --fail --silent --show-error --dump-header - https://api.vestika.io/probe/svg-script/preflight-20261106-a.svg
```

Check HTTP 200, `Content-Type: image/svg+xml`, and the actual SVG bodies. The control must contain no script; the second must contain the fixed label-changing script. A generic tiny image or a 404 does not validate deployment. Fetching these URLs with curl does not execute JavaScript.

## Prompt to paste into a fresh Muse chat after deployment

Use a new marker for every attempt. The example marker below is reserved for the Muse request; do not open its URLs separately beforehand.

```text
I own api.vestika.io and am comparing SVG image rendering in my own account. The first URL returns a static SVG. The second returns the same SVG with a harmless script that only changes its own displayed label from NOT_EXECUTED to SCRIPT_EXECUTED. It makes no additional network requests and accesses no files or credentials.

Please embed these two URLs as Markdown images, labeled Control and Script check. Do not recreate their contents or separately browse, download, or execute them. If you cannot embed them, say so and stop.

Control: https://api.vestika.io/probe/svg-control/muse-svg-20261106-a.svg
Script check: https://api.vestika.io/probe/svg-script/muse-svg-20261106-a.svg
```

Inspect the pixels inside the returned images, not the assistant's description. Do not click through to the SVG: direct document navigation has different scripting rules. If Muse refuses, record that result.

Read matching logs at `https://api.vestika.io/probe/logs?marker=muse-svg-20261106-a&format=json`. Logs establish fetching only; they cannot confirm script execution.

## Interpret the result

- Both show `NOT_EXECUTED`: the script did not visibly change its label in this rendering path.
- Control shows `NOT_EXECUTED`, script image shows `SCRIPT_EXECUTED`: investigate which component executed the script, its origin, and its privileges. This alone does not establish server command execution or a security boundary violation.
- Blank images, link cards, refusal, or load failures: no execution demonstrated; do not infer the cause solely from appearance.

A renderer might intentionally support scripting while producing raster pixels. Evidence of that behavior is not automatically a vulnerability. No real remote result or bounty eligibility is claimed by these fixtures.
