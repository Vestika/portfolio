# Feedback & NPS Collection

A lightweight feedback channel for users to submit comments/suggestions. Messages are stored in MongoDB and forwarded to Telegram.

## Completed Tasks

- [x] Backend config/env for Telegram
- [x] Add `python-telegram-bot` dependency
- [x] Telegram service for sending messages
- [x] Feedback model and Mongo persistence
- [x] FastAPI `POST /feedback` endpoint (auth optional)
- [x] Router wiring in `backend/app/main.py`
- [x] Frontend floating `FeedbackWidget` with NPS
- [x] Integrate widget globally in `frontend/src/App.tsx`

## In Progress Tasks

- [ ] Add rate limiting (IP/user) to prevent abuse
- [ ] Admin view for feedback list (future)

## Future Tasks

- [ ] Add optional contact email field in UI
- [ ] NPS-only micro prompt variant
- [ ] Anonymous mode toggles/config
- [ ] Slack/Email destinations (optional)

## Implementation Plan

- Backend: FastAPI endpoint saves a `Feedback` document and best-effort forwards to Telegram using `python-telegram-bot`.
- Frontend: Floating button opens a small popup with textarea and NPS selector. Sends to `/feedback`.

### Relevant Files

- backend/config.py — Telegram settings (`telegram_bot_token`, `telegram_chat_id`) ✅
- backend/pyproject.toml — `python-telegram-bot` dependency ✅
- backend/services/telegram/service.py — Telegram sending logic ✅
- backend/models/feedback.py — Pydantic model for feedback ✅
- backend/app/endpoints/feedback.py — `POST /feedback` endpoint ✅
- backend/app/main.py — Router include ✅
- frontend/src/components/topbar/FeedbackWidget.tsx — Floating popup UI ✅
- frontend/src/components/topbar/FeedbackModal.tsx — Modal UI (currently used) ✅
- frontend/src/App.tsx — Widget integration ✅

## Notes

- Endpoint requires authentication (no anonymous submissions).
- Telegram sending is best-effort; failures do not block successful API response.
- Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in backend `.env`.


