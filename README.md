Project context: Custom AI for dictating notes into Obsidian
1. Project idea

Build an Obsidian plugin that lets the user dictate text by voice and turn it into vault entries, with a review step before saving and suggestions for links to other existing notes.

Main goal of the project: to learn how to build AI products, not just to obtain the functionality (which partly exists already through community plugins). That is why the decision was made to build a custom plugin instead of relying only on existing solutions, prioritizing the parts that represent a real engineering challenge.

Desired full functionality
Dictation and cleanup: the user dictates text by voice; it is transcribed and cleaned of filler words, stutters and repetitions (via LLM).
Iterative voice editing: the cleaned text is shown on screen in a "draft" state (not yet saved to the vault). The user can keep modifying it by voice: add, replace or delete text, and apply Markdown formatting (headings, bold, lists, etc.) through spoken commands. This loop can be repeated as many times as the user wants.
Connections with other notes (optional): once the text is finalized, link suggestions with other vault entries are offered based on content similarity / keywords. The user decides which ones to accept.
Saving: only on confirmation is the final text (with the accepted links) written to the vault.
2. Architecture decisions made
Existing plugins (Whisper, Smart Connections) will not be used as black boxes for the key parts, precisely because the goal is to learn by building. They are used as references or as occasional supporting pieces, not as a central dependency.
A custom Obsidian plugin is built in TypeScript, with its own pipeline: audio capture → transcription → cleanup → iterative editing → connections → saving. No step writes to the vault until the final step (state 4).
Smart Connections as a reference / data source: its embeddings are stored as JSON in the vault's .smart-env/ folder, which can be read directly. That folder can be read to obtain candidate similar notes without having to reimplement embeddings from scratch. Optionally, there is also a more tightly coupled mode that accesses its exposed public API (app.plugins.plugins['smart-connections']), not yet explored.
editInterpreter.ts (the piece that interprets voice editing instructions and applies them to the draft): for now it is handled entirely by the LLM (it receives the current text + the spoken instruction and returns the result). It was explicitly decided NOT to optimize this yet with custom rules/algorithms. Later, while iterating on the project, it will be evaluated whether to replace part of the logic with something more deterministic (for example, having the LLM return structured operations like {action, find, with} instead of rewriting the whole text each time).
Planned folder structure
your-plugin/
├── main.ts
├── manifest.json
├── src/
│   ├── audio/
│   │   ├── recorder.ts
│   │   └── transcriber.ts        # Whisper API call
│   ├── llm/
│   │   ├── cleaner.ts             # initial cleanup (filler words, etc.)
│   │   └── editInterpreter.ts     # interprets voice editing instructions (LLM-based for now)
│   ├── ui/
│   │   └── DraftView.ts           # view with the text + controls + suggestions
│   ├── connections/
│   │   └── smartEnvReader.ts      # reads .smart-env/ to suggest links
│   └── vault/
│       └── writer.ts              # only called on confirmation (saving state)
└── state/
    └── draftStore.ts               # in-memory state of the current draft
Flow state machine
[1. RECORDING] → [2. DRAFT / EDITING] → [3. CONNECTIONS] → [4. SAVED]
3. Technologies
TypeScript + Obsidian API (Plugin, Vault, ItemView/Modal, Editor, Settings tab).
Node.js / npm for building (esbuild, configured in esbuild.config.mjs); Node v24.19.0 already installed.
esbuild in watch mode (npm run dev) to automatically recompile main.ts → main.js.
MediaRecorder API (native to the browser/Electron) for audio capture, no external libraries needed.
Whisper API (OpenAI/Groq/Azure, or local via Ollama/local server) for speech-to-text transcription.
Claude API (LLM) for: cleaning dictated text, interpreting voice editing instructions, and (later) classifying the type of relationship between notes.
Git / GitHub: project forked from obsidian-sample-plugin (the official Obsidian plugin template repo).
External reference: the Smart Connections plugin (open source) for reading embeddings/similarity via .smart-env/.
Development environment: Windows, Git Bash (MINGW64), VS Code.
4. Progress so far
obsidian-sample-plugin repository forked at: C:\Users\victo\source\repos\obsidian-text-to-voice-plugin.
Test vault created and moved to: D:\Obsidian\Plugin voz (moved from D:\Program Files\Plugin voz due to a suspected antivirus/permissions conflict, later ruled out as the root cause).
Symlink created (ln -s from Git Bash, run as administrator, with Windows Developer Mode enabled) between the project folder and <vault>/.obsidian/plugins/obsidian-text-to-voice-plugin.
The symlink turned out, by all indications, to be a Windows junction (not a pure Unix symlink): ls -la and stat show it as a normal directory, without the l or the usual -> arrow.
Verified that it partially works: files created/read/deleted from either side (real project ↔ vault folder) propagate correctly for "normal" files (manifest.json, prueba.txt, etc.).
Node.js v24.19.0 installed and working; npm install ran successfully (generated node_modules/).
npm run dev runs correctly, esbuild in watch mode, successful compilation confirmed ([watch] build finished, watching for changes...).
Confirmed that main.js is generated correctly in the root of the real project (/c/Users/victo/source/repos/obsidian-text-to-voice-plugin/main.js), with no strange temporary files associated.
The plugin appears listed in Obsidian (Settings → Community plugins) under the name "Sample Plugin", confirming that manifest.json is read correctly through the symlink/junction.
5. Current difficulty (unresolved)

The main.js file specifically is not accessible through the symlink/junction, although the rest of the project files are:

ls -la and stat do not show main.js in the listing on the vault side.
cat and wc -l on the vault path return "No such file or directory" for main.js specifically.
There are no temporary files (.tmp, etc.) associated with esbuild's writes that would explain a rename problem.
The remaining operations (creating, reading, deleting test files) work normally in both directions through the link.
Because of this, the toggle to enable the plugin in Obsidian does not respond: Obsidian reads manifest.json (which is why the plugin is listed), but when trying to enable it, it needs to load and execute main.js, which it cannot read through the link. Hence the activation fails silently without a clear error in the DevTools console.

Unconfirmed hypothesis: it could be related to how Windows handles the file descriptors that esbuild leaves open when writing over a junction, or to a behavior difference between mklink /J (junction) and mklink /D (directory symlink). Not explored yet, since ln -s from Git Bash does not let you explicitly choose which of the two it creates.

Alternative already identified but not implemented (the user prefers to keep investigating the symlink before resorting to it): modify esbuild.config.mjs so that it automatically copies main.js, manifest.json and styles.css to the vault folder after each build, instead of relying on Obsidian reading them through the link.

6. Work to do
[ ] Resolve the problem of main.js not being accessible through the symlink/junction (or decide to migrate to the automatic copy solution via a script in esbuild.config.mjs).
[ ] Get the sample plugin enabled in Obsidian and validate the basic end-to-end flow (ribbon icon, command palette command, sample modal).
[ ] Edit manifest.json with the project's final id, name and description.
[ ] Implement recorder.ts (audio capture via MediaRecorder).
[ ] Implement transcriber.ts (Whisper API call).
[ ] Implement cleaner.ts (filler word/stutter cleanup via LLM).
[ ] Implement DraftView.ts (editable draft view).
[ ] Implement editInterpreter.ts (interpretation of voice editing instructions via LLM, without optimization through custom rules for now).
[ ] Implement smartEnvReader.ts (reading .smart-env/ for related-note suggestions).
[ ] Implement writer.ts (final write to the vault).
[ ] Define the taxonomy of relationship types between notes (cause-effect, contradiction, example, etc.). Pending for later; it is an additional feature on top of Smart Connections' suggestions.
[ ] Define the exact format in which typed relationships are stored in notes (YAML frontmatter vs. a separate file). Still to be decided.
[ ] Plugin Settings tab to configure API keys (Whisper, Claude) without hardcoding them.
[ ] Install the "Hot Reload" plugin to speed up the development cycle.
 
