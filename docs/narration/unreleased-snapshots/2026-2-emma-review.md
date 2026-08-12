# Unreleased Emma review snapshot

This repository preserves a complete, portable review snapshot of narration edition `2026.2` so that editorial work can continue from another machine.

- Release candidate: `2026-2-cb97d27e0f3b22ea3bd4a42b7cdccc474f212c1778e852cad40ebd86d424e9b9`
- Voice: Kokoro `bf_emma`
- Passages: 625
- Duration: 12,903.154 seconds
- Candidate manifest SHA-256: `29c79d236878ea854b3fd3888d27f42d27b1e541e9873f2b54885675b4891a22`
- Review manifest SHA-256: `0fbdf41a86c6b4aaf7b83c0d5cb02df5f7e34d7e43eda563f738e2a456abfe87`

This is **not a released narration edition**. The candidate manifest deliberately remains `approved: false` with `approval: null`, no full-listen receipt exists, and no public narration pointer or versioned release manifest is included. The application must therefore continue to reject it as production narration.

The snapshot includes the exact 625 candidate MP3 files, resumable generation state, representative-pilot records and approval, and the checksum-bound full-listen review package. It excludes superseded takes, rejected earlier pilots, duplicated auditions, OS metadata, and the reproducible local model cache.

After cloning on another machine:

```bash
npm ci
npm ci --prefix tools/narration
npm run narration:verify-candidate
npm run dev
```

Then open `http://127.0.0.1:5173/?narration-review=1`. The player must show `UNRELEASED REVIEW · AI-generated`. Any eventual publication still requires a complete in-order human listen, the device-continuity checks, a bound full-listen receipt, explicit approval, release verification, and manifest-derived staging.
