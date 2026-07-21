import { Block, Tok } from "../types";
import { SYN } from "../styles/theme";

export const STREAM: Block[] = [
  { kind: "task", time: "09:12", title: "Implement Signal.subscribe cleanup path", state: "done" },
  { kind: "git",  time: "09:14", hash: "a3f8c21", msg: "feat(core): add cleanup return on subscribe", files: 2 },
  { kind: "ai",   time: "09:22", role: "user",
    body: "The subscribe method leaks handlers when the effect owner unmounts. Fix it and add a test." },
  { kind: "ai",   time: "09:22", role: "kadmus",
    body: "The leak comes from missing disposal wiring in `signal.ts:19`. I'll return an unsubscribe function that removes the handler from the Set, and add a test in `signal.test.ts` that asserts cleanup runs.",
    diff: [
      { op: " ", text: "    subscribe(fn: () => void) {" },
      { op: " ", text: "      subscribers.add(fn)" },
      { op: "-", text: "    }," },
      { op: "+", text: "      return () => subscribers.delete(fn)" },
      { op: "+", text: "    }," },
    ]},
  { kind: "shell", time: "09:24", cmd: "pnpm test signal", status: "ok", ms: 842,
    output: [
      "  ✓ signal › initial value is returned                  (2 ms)",
      "  ✓ signal › set triggers subscribers                   (3 ms)",
      "  ✓ signal › subscribe returns disposer                 (1 ms)",
      "",
      "  Tests  3 passed (3)",
      "  Duration 842 ms",
    ]},
  { kind: "lsp",  time: "09:25", severity: "warn", file: "queue.ts", line: 8,
    msg: "'flush' is declared but never used" },
];

const k = (t: string): Tok => ({ t, get c() { return SYN.kw; } });
const y = (t: string): Tok => ({ t, get c() { return SYN.ty; } });
const f = (t: string): Tok => ({ t, get c() { return SYN.fn; } });
const s = (t: string): Tok => ({ t, get c() { return SYN.st; } });
const cm= (t: string): Tok => ({ t, get c() { return SYN.cm; } });
const x = (t: string): Tok => ({ t, get c() { return SYN.tx; } });

export type CL = Tok[];

export const CODE: CL[] = [
  [cm("// signal.ts — reactive primitives")],
  [k("import "), x("{ "), y("Effect"), x(", "), y("Signal"), x(" } "), k("from "), s("'./core'")],
  [x("")],
  [k("export function "), f("signal"), x("<"), y("T"), x(">(initial: "), y("T"), x("): "), y("Signal"), x("<"), y("T"), x("> {")],
  [x("  "), k("let"), x(" value = initial")],
  [x("  "), k("const"), x(" subscribers = "), k("new "), y("Set"), x("<() => "), y("void"), x(">()")],
  [x("")],
  [x("  "), k("return "), x("{")],
  [x("    "), k("get"), x(" "), f("value"), x("() { "), k("return "), x("value },")],
  [x("    "), f("set"), x("("), f("next"), x(": "), y("T"), x(") {")],
  [x("      "), k("if"), x(" ("), y("Object"), x("."), f("is"), x("(value, next)) "), k("return")],
  [x("      "), x("value = next")],
  [x("      "), x("subscribers."), f("forEach"), x("(("), f("fn"), x(") => "), f("fn"), x("())")],
  [x("    },")],
  [x("    "), f("subscribe"), x("("), f("fn"), x(": () => "), y("void"), x(") {")],
  [x("      "), x("subscribers."), f("add"), x("(fn)")],
  [x("      "), k("return "), x("() => subscribers."), f("delete"), x("(fn)")],
  [x("    },")],
  [x("  }")],
  [x("}")],
  [x("")],
  [cm("// effect.ts — auto track dependencies")],
  [k("export function "), f("effect"), x("("), f("fn"), x(": () => "), y("void"), x("): "), y("Effect"), x(" {")],
  [x("  "), k("const"), x(" cleanup = "), f("track"), x("(fn)")],
  [x("  "), k("return "), x("{ dispose: cleanup }")],
  [x("}")],
];
