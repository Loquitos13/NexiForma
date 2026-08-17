"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eye,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  editorHtmlToPlainText,
  plainTextToEditorHtml,
  sanitizeDocumentEditorHtml,
} from "@nexiforma/shared";
import { Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

const FONT_FAMILIES = [
  { label: "Georgia (documento)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const FONT_SIZES = ["10px", "11px", "12px", "14px", "16px", "18px", "24px", "32px"];

type EditorMode = "visual" | "html";

export type RichTemplateEditorHandle = {
  insertToken: (token: string) => void;
  focus: () => void;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  formato?: "texto" | "html";
  onFormatoChange?: (formato: "texto" | "html") => void;
  minHeight?: number;
  placeholder?: string;
};

function valueToEditorHtml(raw: string, formato: "texto" | "html"): string {
  if (formato === "texto" && raw && !/<[a-z][\s\S]*>/i.test(raw)) {
    return plainTextToEditorHtml(raw);
  }
  return raw?.trim() ? raw : "<p><br></p>";
}

function saveSelection(editorEl: HTMLDivElement | null): Range | null {
  if (!editorEl) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!editorEl.contains(range.commonAncestorContainer)) return null;
  return range.cloneRange();
}

function restoreSelection(range: Range | null) {
  if (!range) return;
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertAtCursor(
  editorEl: HTMLDivElement | null,
  token: string,
  range: Range | null,
  onUpdated: () => void,
) {
  if (!editorEl) return;
  editorEl.focus();
  const liveRange = saveSelection(editorEl) ?? range;
  if (!liveRange) {
    const end = document.createRange();
    end.selectNodeContents(editorEl);
    end.collapse(false);
    restoreSelection(end);
  } else {
    restoreSelection(liveRange);
  }
  document.execCommand("insertText", false, token);
  onUpdated();
}

export const RichTemplateEditor = forwardRef<RichTemplateEditorHandle, Props>(
  function RichTemplateEditor(
    {
      value,
      onChange,
      formato = "html",
      onFormatoChange,
      minHeight = 360,
      placeholder = "Escreva o conteúdo do documento…",
    },
    ref,
  ) {
    const [mode, setMode] = useState<EditorMode>("visual");
    const [htmlSource, setHtmlSource] = useState(() => valueToEditorHtml(value, formato));
    const editorRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const textareaSelRef = useRef<{ start: number; end: number } | null>(null);
    const lastEmittedValueRef = useRef<string | null>(null);
    const hydratedRef = useRef(false);

    const emitChange = useCallback(
      (nextHtml: string) => {
        const clean = sanitizeDocumentEditorHtml(nextHtml);
        const out = formato === "texto" ? editorHtmlToPlainText(clean) : clean;
        lastEmittedValueRef.current = out;
        onChange(out);
      },
      [formato, onChange],
    );

    const emitFromVisualEditor = useCallback(() => {
      if (editorRef.current) emitChange(editorRef.current.innerHTML);
    }, [emitChange]);

    const captureSelection = useCallback(() => {
      savedRangeRef.current = saveSelection(editorRef.current);
    }, []);

    const captureTextareaSelection = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      textareaSelRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
    }, []);

    const insertInTextarea = useCallback(
      (token: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.focus();
        const sel = textareaSelRef.current;
        const start = sel?.start ?? ta.selectionStart;
        const end = sel?.end ?? ta.selectionEnd;
        const current = ta.value;
        const next = current.slice(0, start) + token + current.slice(end);
        setHtmlSource(next);
        emitChange(next);
        const caret = start + token.length;
        requestAnimationFrame(() => {
          ta.setSelectionRange(caret, caret);
          textareaSelRef.current = { start: caret, end: caret };
        });
      },
      [emitChange],
    );

    useImperativeHandle(
      ref,
      () => ({
        insertToken(token: string) {
          if (mode === "html") {
            insertInTextarea(token);
            return;
          }
          insertAtCursor(editorRef.current, token, savedRangeRef.current, emitFromVisualEditor);
          captureSelection();
        },
        focus() {
          if (mode === "html") textareaRef.current?.focus();
          else editorRef.current?.focus();
        },
      }),
      [captureSelection, emitFromVisualEditor, insertInTextarea, mode],
    );

    // Hidrata o DOM uma vez por montagem (evita contentEditable vazio no 1.º frame)
    useLayoutEffect(() => {
      hydratedRef.current = false;
    }, [formato]);

    useLayoutEffect(() => {
      if (mode !== "visual") return;
      const el = editorRef.current;
      if (!el || hydratedRef.current) return;
      const html = valueToEditorHtml(value, formato);
      el.innerHTML = html;
      lastEmittedValueRef.current = value;
      hydratedRef.current = true;
    }, [formato, mode, value]);

    // Só repõe o DOM quando o valor muda externamente e o editor não está activo
    useEffect(() => {
      if (mode !== "visual") return;
      const el = editorRef.current;
      if (!el) return;
      if (document.activeElement === el) return;
      if (value === lastEmittedValueRef.current) return;

      lastEmittedValueRef.current = value;
      const html = valueToEditorHtml(value, formato);
      setHtmlSource(html);
      el.innerHTML = html;
      hydratedRef.current = true;
    }, [value, formato, mode]);

    useEffect(() => {
      const el = editorRef.current;
      if (!el || mode !== "visual") return;

      function onSelectionChange() {
        if (document.activeElement === el) captureSelection();
      }

      document.addEventListener("selectionchange", onSelectionChange);
      return () => document.removeEventListener("selectionchange", onSelectionChange);
    }, [captureSelection, mode]);

    function exec(cmd: string, val?: string) {
      editorRef.current?.focus();
      document.execCommand(cmd, false, val);
      if (editorRef.current) emitChange(editorRef.current.innerHTML);
      captureSelection();
    }

    function switchMode(next: EditorMode) {
      if (next === mode) return;
      if (next === "html") {
        const current = editorRef.current?.innerHTML ?? htmlSource;
        setHtmlSource(current);
        setMode("html");
        return;
      }
      const html = htmlSource.trim() || "<p><br></p>";
      setHtmlSource(html);
      setMode("visual");
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = html;
          lastEmittedValueRef.current = value;
          hydratedRef.current = true;
        }
      });
    }

    function toggleFormato() {
      const next = formato === "html" ? "texto" : "html";
      if (next === "texto" && editorRef.current) {
        const plain = editorHtmlToPlainText(editorRef.current.innerHTML);
        lastEmittedValueRef.current = plain;
        onChange(plain);
      } else if (next === "html") {
        const html = plainTextToEditorHtml(value || "");
        lastEmittedValueRef.current = value;
        onChange(html);
      }
      onFormatoChange?.(next);
    }

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-950/80 p-1.5">
          <ToolbarBtn title="Negrito" onClick={() => exec("bold")} disabled={mode === "html"}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Itálico" onClick={() => exec("italic")} disabled={mode === "html"}>
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Sublinhado" onClick={() => exec("underline")} disabled={mode === "html"}>
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Rasurado" onClick={() => exec("strikeThrough")} disabled={mode === "html"}>
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarBtn title="Alinhar à esquerda" onClick={() => exec("justifyLeft")} disabled={mode === "html"}>
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Centrar" onClick={() => exec("justifyCenter")} disabled={mode === "html"}>
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Alinhar à direita" onClick={() => exec("justifyRight")} disabled={mode === "html"}>
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <select
            disabled={mode === "html"}
            className="h-7 max-w-[9rem] rounded border border-slate-600/60 bg-slate-900 px-1.5 text-[10px] text-slate-200"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) exec("fontName", e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Fonte…</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            disabled={mode === "html"}
            className="h-7 w-[4.5rem] rounded border border-slate-600/60 bg-slate-900 px-1.5 text-[10px] text-slate-200"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) exec("fontSize", e.target.value.replace("px", ""));
              e.target.value = "";
            }}
          >
            <option value="">Tamanho…</option>
            {FONT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            disabled={mode === "html"}
            className="h-7 max-w-[6rem] rounded border border-slate-600/60 bg-slate-900 px-1.5 text-[10px] text-slate-200"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) exec("formatBlock", v);
              e.target.value = "";
            }}
          >
            <option value="">Bloco…</option>
            <option value="p">Parágrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
            <option value="h3">Título 3</option>
          </select>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarBtn
            title="Modo visual"
            active={mode === "visual"}
            onClick={() => switchMode("visual")}
          >
            <Eye className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Código HTML" active={mode === "html"} onClick={() => switchMode("html")}>
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {onFormatoChange ? (
            <>
              <span className="mx-1 h-5 w-px bg-slate-700" />
              <button
                type="button"
                role="switch"
                aria-checked={formato === "html"}
                title={formato === "html" ? "Formato HTML" : "Texto simples"}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                  formato === "html"
                    ? "bg-blue-950/50 text-blue-200"
                    : "bg-slate-800 text-slate-400",
                )}
                onClick={toggleFormato}
              >
                {formato === "html" ? "HTML" : "Texto"}
              </button>
            </>
          ) : null}
        </div>

        {mode === "visual" ? (
          <>
            <style>{`
              .rich-template-editor h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; }
              .rich-template-editor h2 { font-size: 1.35em; font-weight: 700; margin: 0.5em 0 0.25em; }
              .rich-template-editor h3 { font-size: 1.15em; font-weight: 600; margin: 0.45em 0 0.2em; }
              .rich-template-editor p { margin: 0 0 0.65em; }
              .rich-template-editor ul, .rich-template-editor ol { margin: 0 0 0.65em 1.25em; }
            `}</style>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              dir="ltr"
              lang="pt"
              spellCheck
              data-placeholder={placeholder}
              className={cn(
                "rich-template-editor w-full rounded-lg border border-slate-600/60 bg-white px-4 py-3",
                "text-[13px] leading-relaxed text-slate-900 outline-none",
                "min-h-[var(--editor-min-h)] font-[Georgia,'Times_New_Roman',serif]",
                "[&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)]",
              )}
              style={{ "--editor-min-h": `${minHeight}px` } as React.CSSProperties}
              onBlur={captureSelection}
              onKeyUp={captureSelection}
              onMouseUp={captureSelection}
              onInput={emitFromVisualEditor}
            />
          </>
        ) : (
          <textarea
            ref={textareaRef}
            rows={18}
            dir="ltr"
            lang="pt"
            value={htmlSource}
            onSelect={captureTextareaSelection}
            onKeyUp={captureTextareaSelection}
            onMouseUp={captureTextareaSelection}
            onBlur={captureTextareaSelection}
            onChange={(e) => {
              setHtmlSource(e.target.value);
              emitChange(e.target.value);
              captureTextareaSelection();
            }}
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
    );
  },
);

function ToolbarBtn({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40",
        active && "bg-blue-950/50 text-blue-200",
      )}
    >
      {children}
    </button>
  );
}

/** @deprecated Use ref insertToken no RichTemplateEditor */
export function insertIntoRichEditor(editorEl: HTMLDivElement | null, token: string) {
  insertAtCursor(editorEl, token, saveSelection(editorEl), () => {
    if (editorEl) {
      editorEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
  });
}
