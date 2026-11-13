# Spike Results — Phase 0

> **Status:** Template — fill in after running spikes on the target PC.

---

## S1 — TalkingHead + HeadAudio integration

**Task:** Load TalkingHead with a sample GLB, play a VoiceStudio WAV through the speech path, confirm mouth moves.

| Question | Answer |
|----------|--------|
| Does `speakAudio(AudioBuffer)` work without text? | _VERIFY_ |
| Does HeadAudio drive visemes from audio stream? | _VERIFY_ |
| Is queue ordering preserved? | _VERIFY_ |
| Recommended `speakAudio` or `streamStart/streamAudio`? | _VERIFY_ |

**Result:** _To be filled in._

---

## S2 — VoiceStudio API latency

**Task:** `curl` the VoiceStudio API and measure latency.

| Measurement | Result |
|-------------|--------|
| Short TTS (< 10 words), English | _ms_ |
| Long TTS (100 words), English | _ms_ |
| STT, short utterance | _ms_ |
| Does `/v1/audio/speech` stream? | _VERIFY_ |
| Hindi TTS quality | _VERIFY_ |
| Marathi TTS quality | _VERIFY_ |

**Result:** _To be filled in._

---

## S3 — HeadAudio Hindi/Marathi lip-sync quality

**Task:** Compare viseme quality on English vs Hindi/Marathi audio through HeadAudio.

| Language | Viseme accuracy (subjective) | Decision |
|----------|------------------------------|----------|
| English | _Good/Fair/Poor_ | — |
| Hindi | _Good/Fair/Poor_ | Use HeadAudio or fallback |
| Marathi | _Good/Fair/Poor_ | Use HeadAudio or fallback |

**Decision:** _To be filled in. If poor: enable RmsJawLipSync fallback._

---

## S4 — Barge-in method

**Task:** Find working TalkingHead stop method and measure stop latency.

| Method | Works? | Stop latency |
|--------|--------|--------------|
| `head.stopSpeaking()` | _VERIFY_ | _ms_ |
| `head.streamInterrupt()` | _VERIFY_ | _ms_ |

**Decision:** _To be filled in._

---

## S5 — MCP TypeScript SDK

**Task:** Check SDK version, supported spec revisions, hello-world Streamable HTTP tool.

| Question | Answer |
|----------|--------|
| Installed SDK version | _VERIFY_ |
| Supported spec revision | _VERIFY_ |
| Hello-world tool works? | _VERIFY_ |

**Decision:** _To be filled in. ADR if spec revision differs from latest._

