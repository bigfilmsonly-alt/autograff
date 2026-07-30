# AUTOGRAFF Studio — Complete Reference

A browser beat-maker + vocal booth built entirely on the **Web Audio API** (no libraries).
Everything below is for improving it / discussing it with Claude.

- **All code lives in one file:** `src/photo-contest-app.jsx`
- **The Studio is one React component:** `StudioPage`
- **Shared audio helpers live above it** (module scope): `noiseBuffer`, `env`, `tone`,
  `noise`, `playSound`, `fxImpulse`, `fxDistCurve`, `buildMicFx`, `silentWavUrl`.

---

## 1. The audio engine

- One `AudioContext` per Studio session: `ctxRef.current`, created lazily in `unlock()`.
- **Master bus:** `ctx._master` (a GainNode) → `ctx.destination`. **Every sound routes
  through `_master`**, which is what lets us *tap the whole mix* for recording. See
  `playSound`: `const out = ctx._master || ctx.destination;`
- **`unlock()`** (called on the first tap / on Play / on any first pointerdown) does the
  iOS dance: create context, create `_master`, `ctx.resume()`, play a 1-sample silent
  buffer, and start a looping **silent `<audio>` element** (`silentWavUrl()`) so audio
  plays even with the iPhone **ring/silent switch on**.

## 2. The sequencer

- **16 steps** (one bar of 16th notes). State: `patterns` = `{ [trackId]: bool[16] }`.
- **14 voices** (`TRACK_DEFS`), each `{ id, name, sound, freq, decay, vol, color }`:
  KICK, 808, SNARE, CLAP, HI-HAT, OPEN HAT, BASS, SYNTH, LEAD, PERC, TOM, RIM, COWBELL, CRASH.
- **Transport:** `bpm` (60–200), `swing` (0–80%), `muted`, `solo`, `volumes` (per track).
  Live values are mirrored into refs (`bpmRef`, `patRef`, etc.) so the scheduler always
  reads the latest without restarting.
- **Scheduler** (inside `start()`): a **look-ahead** loop. `setTimeout(schedule, 20)` runs
  every ~20ms; it schedules any steps whose time is within `ctx.currentTime + 0.1`s using
  precise `AudioContext` timing. Per step:
  - `stepDuration = (60 / bpm) / 4` seconds (a 16th note)
  - swing pushes odd steps later by `swing% × stepDuration × 0.5`
  - for each track whose `pattern[step]` is on (and not muted / respecting solo), call
    `playSound(ctx, track, time, vol)`.
  - `stepRef` wraps `% 16` → **the loop repeats forever** until `stop()`.

## 3. Sound synthesis (`playSound` + helpers)

Everything is synthesized live (no samples):
- `env(ctx, dest, time, attack, decay, peak)` → an ADSR-ish gain envelope.
- `tone(...)` → an oscillator (sine/square/saw/tri) through an envelope, with optional
  pitch glide.
- `noise(...)` → white noise (`noiseBuffer`) through a filter + envelope.
- `playSound` switches on `track.sound`: e.g. **kick** = sine pitch-drop + click; **808** =
  sub sine with a pitch drop; **snare** = tone body + highpass noise; **clap** = 4 noise
  bursts; **hats** = highpass noise; **synth/lead** = stacked oscillators; etc.

## 4. Presets

`PRESETS` = 15 genres, each `{ bpm, swing, patterns }`:
**TRAP, DRILL, PHONK, HIP HOP, BOOM BAP, REGGAETON, AMAPIANO, AFROBEAT, HOUSE BEAT,
DANCE POP, TECHNO, UK GARAGE, DNB, JERSEY CLUB, LOFI.**
`loadPreset(name)` sets the pattern + BPM + swing, syncs the refs, and **auto-plays**
(the tap is the user gesture that unlocks audio).

## 5. Recording a beat

- `startRecord()` creates a `MediaStreamAudioDestinationNode`; `_master.connect(dest)`
  taps the full mix; a `MediaRecorder(dest.stream)` records it (codec picked from
  `audio/webm;opus` → `audio/mp4` fallback for Safari).
- `stopRecord()` → `onstop` builds a `Blob` → object URL + `FileReader` → **data URL**.
- The **BEAT CAPTURED** panel: preview `<audio>`, **ADD TO BEAT** / **SAVE** / **DISCARD**.
- `saveBeat()` pushes `{ id, name, bpm, audio: dataURL, ts }` into `localStorage`
  key **`autograff_beats`** (capped at 40). The **YOU** tab (`ProfilePage`) reads that key
  and renders **MY BEATS** with `<audio controls>` + delete.

## 6. Vocals

- **ADD VOCALS** (`toggleMic`) = `getUserMedia({audio})` with echo-cancellation.
- When the mic is on, `startRecord()` **does NOT tap `_master`** — it records only the
  mic (through the FX chain), so the take is an **isolated vocal**. You still *hear* the
  beat (it plays out `_master` → speakers) for timing.
- The mic also monitors to `ctx.destination` (use **headphones** to avoid feedback).

## 7. Voice FX (`buildMicFx(ctx, effect)` → `{input, output, cleanup}`)

Real Web-Audio chains inserted between the mic and the recorder:
- **REVERB** — `ConvolverNode` with a generated impulse (`fxImpulse`) + wet/dry.
- **ECHO** — `DelayNode` (0.28s) + feedback gain.
- **ROBOT** — ring modulation (a 52Hz square oscillator drives a gain node the mic passes
  through).
- **PHONE** — bandpass (1.5kHz, Q6) + `WaveShaper` drive.
- **AUTO-TUNE** — high-shelf brightness + a chorus (LFO-modulated delay) + light verb.
  **This is the produced/electronic vocal *character* (T-Pain-ish), not scale-correcting
  pitch tuning** — true autotune needs pitch detection + a formant-preserving pitch
  shifter (a WASM lib), see the roadmap.

---

## 8. Vocal LAYERS + how to make them LOOP  ← the important part

### How layers work today
- `vocalLayersRef.current` = an array of decoded **`AudioBuffer`s**.
- `addToBeat()`: takes the captured vocal blob → `blob.arrayBuffer()` →
  `ctx.decodeAudioData(...)` → pushes the `AudioBuffer` into `vocalLayersRef`.
- In `start()`, when the beat begins, each layer is played:
  ```js
  vocalLayersRef.current.forEach(buf => {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(ctx._master);          // so it's heard AND recordable in a full-mix pass
    s.start(nextTimeRef.current);    // aligned to the beat's downbeat
    layerSrcRef.current.push(s);     // tracked so stop() can kill them
  });
  ```
- **They play ONCE** (`s.loop` is not set). Over a looping beat, the vocal runs once from
  the top, then the beat keeps going without it.

### The one-line "loop" — and why it isn't enough
Setting `s.loop = true` makes the buffer repeat. **But it repeats at the vocal's own
length, which almost never equals the beat's bar length**, so it drifts out of time after
the first pass.

**The timing math** (this is the whole problem):
- `stepDuration = (60 / bpm) / 4`
- one bar (16 steps) = `16 × stepDuration = 240 / bpm` seconds
  (e.g. **120 BPM → 2.0s per bar**, 140 BPM → ~1.714s)
- A raw take might be 5.3s — not a clean multiple of 2.0s → naive `loop=true` = drift.

### Four ways to actually make it loop cleanly (pick one)

**A. Loop to a bar-aligned end point (simplest good fix).**
Loop only the first N whole bars of the take, ignoring the ragged tail:
```js
const barLen = 240 / bpmRef.current;                 // seconds per bar (uses live BPM)
const bars   = Math.max(1, Math.round(buf.duration / barLen));
s.loop = true;
s.loopStart = 0;
s.loopEnd = bars * barLen;                            // snap the loop to whole bars
s.start(nextTimeRef.current);
```
Cheap, no re-recording. Weakness: if your take wasn't performed on-grid, the loop point
can clip a word.

**B. Record exactly N bars (best result).** Add a **count-in + metronome**, then
**auto-stop recording on a bar boundary** so `buf.duration` is exactly `bars × barLen`.
Then `s.loop = true` just works. This is the "real studio" answer and pairs with the
metronome roadmap item.

**C. Re-trigger every bar in the scheduler** (good for ≤1-bar phrases / ad-libs). Instead
of `loop`, start a fresh source at each bar downbeat inside the scheduler so it re-syncs
every loop and can never drift:
```js
// in the scheduler, when step === 0:
vocalLayersRef.current.forEach(buf => {
  const s = ctx.createBufferSource(); s.buffer = buf;
  s.connect(ctx._master); s.start(time);             // 'time' = this bar's downbeat
});
```

**D. Trim the AudioBuffer to N bars once, on add.** In `addToBeat()`, copy the decoded
buffer into a new `AudioBuffer` of length `bars × barLen × sampleRate` and store that;
then plain `loop=true` is sample-accurate.

### The BPM gotcha (must-know)
A recorded vocal is fixed in real time. If you **change the BPM after recording**, the beat's
bar length changes but the vocal's doesn't → they no longer line up, and staying in sync
would require **time-stretching** the vocal (hard, needs a library). Practical rule:
**set your tempo first, record vocals last**, or disable BPM changes once a layer exists.

### Minimal change to ship looping now
In `start()`, replace the layer-playback block with **Option A** (loopEnd snapped to
whole bars). Add a small **LOOP** toggle in the vocal-layers row so the user chooses
one-shot vs loop. ~15 lines. Everything else (record, add, clear, full-mix save) already
works.

---

## 9. Storage & where beats show up
- Beats/takes are **data URLs in `localStorage.autograff_beats`** — **per device, not
  shared, not permanent-across-devices.** They render in the **YOU** tab → **MY BEATS**.
- Making them real (shareable, persistent, on the Board/gallery) = upload the audio to
  **Vercel Blob** + store metadata tied to a **logged-in account** (the Supabase/login step).

## 10. Current limitations (candidates to improve)
1. Vocal layers **play once** (looping = section 8).
2. **No metronome / count-in** before recording.
3. **No per-layer controls** (volume, mute, solo, delete-one, FX-per-layer) — it's all-or-CLEAR.
4. **AUTO-TUNE is a character, not pitch-correction.**
5. **One 16-step bar** only — no song arrangement (verse/chorus), no longer patterns.
6. **Local-only** storage; no export to WAV/MP3 download; no sharing.
7. **No undo**, no waveform/trim UI, no quantize-vocal.
8. `MediaRecorder` codec differs by browser (webm vs mp4); fine, but not a standard .wav.
9. BPM changes desync existing vocal layers (section 8 gotcha).

## 11. Roadmap ideas (rough effort)
- **Looping vocal layers** — S (Option A) to M (Option B + metronome).
- **Count-in + metronome** — S/M.
- **Per-layer mixer** (vol/mute/delete/FX) — M.
- **Real autotune** (pitch-correct to a scale) — L; needs a WASM pitch shifter
  (e.g. soundtouchjs / a phase-vocoder) + pitch detection + a key/scale selector.
- **Song mode** — multiple 16-step patterns chained into an arrangement — M/L.
- **WAV/MP3 export + download** — S/M (render via OfflineAudioContext or encode the blob).
- **Backend persistence + sharing** — M; upload audio to Blob, tie to login, publish to
  the Board/gallery. Unlocks "post to win" for beats.
- **Sample import** (drop your own one-shots) — M.
- **Beat-track FX** (reverb/delay on drum voices, not just vocals) — S/M.

## 12. Code map (all in `src/photo-contest-app.jsx`)
- `TRACK_DEFS`, `PRESETS` — voice + genre data.
- `noiseBuffer / env / tone / noise / playSound` — synthesis.
- `fxImpulse / fxDistCurve / buildMicFx` — vocal FX chains.
- `silentWavUrl` — iOS unlock audio.
- `StudioPage`:
  - state/refs: `patterns, bpm, swing, playing, currentStep, muted, solo, volumes,
    activePreset, recording, recBeat, recName, savedMsg, micOn, fx, layerCount`;
    refs `ctxRef, timerRef, stepRef, nextTimeRef, *Ref` mirrors, `recRef, chunksRef,
    recDestRef, micStreamRef, micSrcRef, micFxRef, vocalLayersRef, layerSrcRef, audioElRef`.
  - `unlock, start, stop, loadPreset, clearAll, toggleMic, startRecord, stopRecord,
    saveBeat, addToBeat, clearLayers` — behavior.
  - render: header (CLEAR / REC / PLAY), record+layers panel, transport (BPM/SWING/ADD
    VOCALS), VOICE FX row, GENRE PRESETS, the 16-step grid.

## 13. Direction: Suno-*style*, self-contained (no Suno integration)
The goal is a Suno-like **feel** — one-tap genre presets, instant playback, a clean
"studio in your pocket" — built **entirely in-house on the Web Audio engine above**. No
outbound links to Suno and no dependency on their API. The synthesis, presets, recording,
vocals, and FX are all ours. Future AI-assisted generation (if wanted) should be its own
in-app feature, not a hand-off to a third party.
- `ProfilePage` → **MY BEATS** reads `localStorage.autograff_beats`.
