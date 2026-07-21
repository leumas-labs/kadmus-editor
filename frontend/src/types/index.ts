export type LeftId = "repo" | "search" | "debug" | "git" | "wiki" | "extensions";

export type DiffLine = { op: "+" | "-" | " "; text: string };

export type Block =
  | { kind: "ai";    time: string; role: "user" | "kadmus"; body: string; diff?: DiffLine[] }
  | { kind: "shell"; time: string; cmd: string; status: "ok" | "run" | "fail"; ms: number; output: string[] }
  | { kind: "git";   time: string; hash: string; msg: string; files: number }
  | { kind: "lsp";   time: string; severity: "warn" | "info"; file: string; line: number; msg: string }
  | { kind: "task";  time: string; title: string; state: "done" | "running" | "queued" };

export type SelenaSession = { id: string; name: string; blocks: Block[] };

export type OpenFile = { path: string; name: string; breadcrumb: string; ext: string };

export type Tok = { t: string; c: string };

export type CommandPaletteItem = {
  icon: string;
  label: string;
  hint: string;
  onSelect: () => void;
};
