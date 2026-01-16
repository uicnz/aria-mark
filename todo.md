
# Aria Mark - Future Features

## Short URL Service (yoyo.io)

**Status:** Planned

**Requirements:**

- Backend service to store URL mappings
- Database to persist short code -> full URL hash mappings
- API endpoint: `POST /api/shorten` - accepts full URL, returns short code
- API endpoint: `GET /:code` - redirects to full URL with hash
- Domain: yoyo.io

**Implementation considerations:**

- Short codes should be URL-safe (base62 or similar)
- Consider TTL/expiration for links or keep them permanent
- Rate limiting to prevent abuse
- Optional: analytics (click counts, referrers)

**Frontend changes needed:**

- Add "Shorten" button next to share button
- Show shortened URL in a copy-able format
- Toast notification with shortened link

**Tech stack options:**

- Cloudflare Workers + KV (serverless, fast, cheap)
- Vercel Edge Functions + database
- Simple Node/Bun server + SQLite/Postgres
