🎙️ Obsidian Voice Dictation Plugin: Project Context

A custom Obsidian plugin to dictate notes by voice, refine them in a draft view, and link them to other notes, built primarily as a learning project for developing AI products.

Repo: C:\Users\victo\source\repos\obsidian-text-to-voice-plugin
Test vault: D:\Obsidian\Plugin voz
Environment: Windows · Git Bash (MINGW64) · VS Code · Node v24.19.0

Table of contents
Project idea
Architecture decisions
Technologies
Progress so far
Current difficulty (unresolved)
Work to do
1. Project idea

Build an Obsidian plugin that lets the user dictate text by voice and turn it into vault entries, with a review step before saving and suggestions for links to other existing notes.

Main goal: learn how to build AI products. The functionality partly exists already through community plugins, but building a custom plugin means working on the parts that are real engineering challenges.

Desired functionality
#	Stage	What happens
1	Dictation and cleanup	The user dictates; the audio is transcribed and cleaned of filler words, stutters and repetitions (via LLM).
2	Iterative voice editing	The cleaned text appears in a draft state (not yet in the vault). The user keeps modifying it by voice: add, replace or delete text, and apply Markdown (headings, bold, lists…). Repeatable as many times as needed.
3	Connections (optional)	Once finalized, the plugin suggests links to other vault notes based on content similarity / keywords. The user chooses which to accept.
4	Saving	Only on confirmation, the final text (with accepted links) is written to the vault.
2. Architecture decisions
Core principles
Existing plugins are not used as black boxes (Whisper, Smart Connections) for the key parts, because the goal is to learn by building. They serve as references or occasional supporting pieces.
Custom plugin in TypeScript with its own pipeline: audio capture → transcription → cleanup → iterative editing → connections → saving
Nothing is written to the vault until the final step. Every earlier stage lives in memory only.
Flow state machine
[1. RECORDING] → [2. DRAFT / EDITING] → [3. CONNECTIONS] → [4. SAVED]
Key decisions
Topic	Decision
Smart Connections	Used as a reference / data source. Its embeddings are stored as JSON in the vault's .smart-env/ folder, so candidate similar notes can be read directly without reimplementing embeddings. A more tightly coupled mode via its public API (app.plugins.plugins['smart-connections']) exists but is not explored yet.
editInterpreter.ts	Handled entirely by the LLM for now (it receives the current text + the spoken instruction and returns the result). Optimization with custom rules is explicitly postponed.
Possible future improvement	Have the LLM return structured operations like {action, find, with} instead of rewriting the whole text each time. To be evaluated while iterating on the project.
Planned folder structure
your-plugin/
├── main.ts
├── manifest.json
├── src/
│   ├── audio/
│   │   ├── recorder.ts            # audio capture (MediaRecorder)
│   │   └── transcriber.ts         # Whisper API call
│   ├── llm/
│   │   ├── cleaner.ts             # initial cleanup (filler words, etc.)
│   │   └── editInterpreter.ts     # voice editing instructions (LLM-based for now)
│   ├── ui/
│   │   └── DraftView.ts           # view with text + controls + suggestions
│   ├── connections/
│   │   └── smartEnvReader.ts      # reads .smart-env/ to suggest links
│   └── vault/
│       └── writer.ts              # only called on confirmation
└── state/
    └── draftStore.ts              # in-memory state of the current draft
3. Technologies
Area	Technology	Purpose
Language / API	TypeScript + Obsidian API	Plugin, Vault, ItemView/Modal, Editor, Settings tab
Build	Node.js / npm, esbuild	Configured in esbuild.config.mjs; npm run dev runs watch mode (main.ts → main.js)
Audio capture	MediaRecorder API	Native to the browser/Electron; no external libraries needed
Transcription	Whisper API	OpenAI / Groq / Azure, or local via Ollama / local server
LLM	Claude API	Text cleanup, voice-edit interpretation, and (later) relationship-type classification between notes
Version control	Git / GitHub	Forked from obsidian-sample-plugin (official template)
Reference	Smart Connections plugin	Open source; embeddings/similarity via .smart-env/
4. Progress so far
#	Step	Status
1	obsidian-sample-plugin forked locally	✅
2	Test vault created and moved to D:\Obsidian\Plugin voz (moved from D:\Program Files\Plugin voz over a suspected antivirus/permissions conflict, later ruled out as root cause)	✅
3	Symlink created between project folder and <vault>/.obsidian/plugins/obsidian-text-to-voice-plugin	⚠️ partial
4	Node.js v24.19.0 installed; npm install ran successfully	✅
5	npm run dev runs; esbuild watch compiles ([watch] build finished, watching for changes...)	✅
6	main.js is generated correctly in the project root	✅
7	Plugin is listed in Obsidian (Settings → Community plugins) as "Sample Plugin"	✅
About the symlink (step 3)
Created with ln -s from Git Bash, run as administrator, with Windows Developer Mode enabled.
By all indications it is a Windows junction, not a pure Unix symlink: ls -la and stat show it as a normal directory, without the l or the -> arrow.
Normal files (manifest.json, prueba.txt, etc.) propagate correctly in both directions: create, read and delete all work.
Exception: main.js (see next section).
5. Current difficulty (unresolved)
❌ main.js is not accessible through the symlink/junction

The rest of the project files are, but main.js is not.

Observed behavior

Check	Result
main.js in the project root	✅ exists
ls -la / stat on the vault side	❌ main.js not listed
cat / wc -l on the vault path	❌ "No such file or directory"
Temporary files from esbuild (.tmp, etc.)	✅ none, so a rename problem is ruled out
Create / read / delete of other files through the link	✅ works in both directions

Why it blocks the plugin

Obsidian reads manifest.json (so the plugin appears in the list), but when the user tries to enable it, Obsidian must load and execute main.js. It cannot read it through the link, so activation fails silently and no clear error appears in the DevTools console.

Unconfirmed hypothesis

It may be related to how Windows handles the file descriptors esbuild leaves open when writing over a junction, or to a behavior difference between mklink /J (junction) and mklink /D (directory symlink). Not explored yet, because ln -s from Git Bash does not let you choose which of the two it creates.

Alternative already identified (not implemented)

Modify esbuild.config.mjs so it automatically copies main.js, manifest.json and styles.css to the vault folder after each build, instead of relying on Obsidian reading them through the link.

The user prefers to keep investigating the symlink before resorting to the copy approach.

6. Work to do
🔧 Environment setup
[ ] Resolve main.js not being accessible through the symlink/junction (or migrate to the automatic copy script in esbuild.config.mjs)
[ ] Get the sample plugin enabled in Obsidian and validate the basic end-to-end flow (ribbon icon, command palette command, sample modal)
[ ] Edit manifest.json with the final id, name and description
[ ] Install the Hot Reload plugin to speed up the development cycle
🧩 Core pipeline
[ ] recorder.ts: audio capture via MediaRecorder
[ ] transcriber.ts: Whisper API call
[ ] cleaner.ts: filler word/stutter cleanup via LLM
[ ] DraftView.ts: editable draft view
[ ] editInterpreter.ts: voice editing instructions via LLM (no custom-rule optimization for now)
[ ] smartEnvReader.ts: read .smart-env/ for related-note suggestions
[ ] writer.ts: final write to the vault
[ ] Settings tab to configure API keys (Whisper, Claude) without hardcoding them
🔗 Relationship features (later)
[ ] Define the taxonomy of relationship types between notes (cause-effect, contradiction, example, etc.). This is an additional feature on top of Smart Connections' suggestions.
[ ] Decide the format for storing typed relationships in notes (YAML frontmatter vs. a separate file)