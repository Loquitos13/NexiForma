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
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Bold,
  Code,
  Eye,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import {
  documentPageEditorCss,
  editorHtmlToPlainText,
  pageDimensionsMm,
  plainTextToEditorHtml,
  sanitizeDocumentEditorHtml,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
} from "@nexiforma/shared";
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
  /** Indicador do formato guardado (texto vs HTML)  não alterna modo de edição. */
  formato?: "texto" | "html";
  pageLayout?: "a4" | "fluid";
  orientacao?: DocumentOrientacao;
  verticalAlign?: DocumentVerticalAlign;
  onVerticalAlignChange?: (align: DocumentVerticalAlign) => void;
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

function applyInlineStyle(
  editorEl: HTMLDivElement,
  styles: Record<string, string>,
  range: Range | null,
) {
  editorEl.focus();
  restoreSelection(range ?? saveSelection(editorEl));
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const r = sel.getRangeAt(0);
  const span = document.createElement("span");
  for (const [key, val] of Object.entries(styles)) {
    span.style.setProperty(key, val);
  }

  if (r.collapsed) {
    span.appendChild(document.createTextNode("\u200B"));
    r.insertNode(span);
    const caret = document.createRange();
    caret.setStart(span.firstChild!, 1);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    return;
  }

  try {
    r.surroundContents(span);
  } catch {
    document.execCommand("styleWithCSS", false, "true");
    const css = Object.entries(styles)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
      .join(";");
    document.execCommand(
      "insertHTML",
      false,
      `<span style="${css}">${r.toString()}</span>`,
    );
  }
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
      pageLayout = "a4",
      orientacao = "portrait",
      verticalAlign = "top",
      onVerticalAlignChange,
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

    const pageMm = pageDimensionsMm(orientacao);
    const editorCss = documentPageEditorCss(orientacao);

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

    const runExec = useCallback(
      (cmd: string, val?: string) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        restoreSelection(savedRangeRef.current);
        document.execCommand(cmd, false, val);
        emitChange(el.innerHTML);
        captureSelection();
      },
      [captureSelection, emitChange],
    );

    const applyFont = useCallback(
      (fontFamily: string) => {
        const el = editorRef.current;
        if (!el) return;
        applyInlineStyle(el, { "font-family": fontFamily }, savedRangeRef.current);
        emitChange(el.innerHTML);
        captureSelection();
      },
      [captureSelection, emitChange],
    );

    const applySize = useCallback(
      (fontSize: string) => {
        const el = editorRef.current;
        if (!el) return;
        applyInlineStyle(el, { "font-size": fontSize }, savedRangeRef.current);
        emitChange(el.innerHTML);
        captureSelection();
      },
      [captureSelection, emitChange],
    );

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

    useLayoutEffect(() => {
      hydratedRef.current = false;
    }, [formato, orientacao]);

    useLayoutEffect(() => {
      if (mode !== "visual") return;
      const el = editorRef.current;
      if (!el || hydratedRef.current) return;
      el.innerHTML = valueToEditorHtml(value, formato);
      lastEmittedValueRef.current = value;
      hydratedRef.current = true;
    }, [formato, mode, orientacao, value]);

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
      el.addEventListener("focusin", onSelectionChange);
      document.addEventListener("selectionchange", onSelectionChange);
      return () => {
        el.removeEventListener("focusin", onSelectionChange);
        document.removeEventListener("selectionchange", onSelectionChange);
      };
    }, [captureSelection, mode]);

    function switchMode(next: EditorMode) {
      if (next === mode) return;
      if (next === "html") {
        setHtmlSource(editorRef.current?.innerHTML ?? htmlSource);
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

    const editorSurface = (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="ltr"
        lang="pt"
        spellCheck
        data-placeholder={placeholder}
        className={cn(
          "doc-content-layer rich-template-editor outline-none text-slate-900",
          pageLayout === "a4"
            ? "w-full"
            : "min-h-[360px] w-full rounded-lg px-4 py-3 text-[13px]",
          pageLayout !== "a4" &&
            "rounded-lg border border-slate-600/60 bg-white leading-relaxed font-[Georgia,'Times_New_Roman',serif]",
          "[&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)]",
        )}
        onBlur={captureSelection}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onInput={emitFromVisualEditor}
      />
    );

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-950/80 p-1.5">
          <ToolbarBtn title="Negrito" onClick={() => runExec("bold")} disabled={mode === "html"}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Itálico" onClick={() => runExec("italic")} disabled={mode === "html"}>
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Sublinhado" onClick={() => runExec("underline")} disabled={mode === "html"}>
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Rasurado" onClick={() => runExec("strikeThrough")} disabled={mode === "html"}>
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarBtn title="Alinhar à esquerda" onClick={() => runExec("justifyLeft")} disabled={mode === "html"}>
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Centrar horizontalmente" onClick={() => runExec("justifyCenter")} disabled={mode === "html"}>
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Alinhar à direita" onClick={() => runExec("justifyRight")} disabled={mode === "html"}>
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>
          {onVerticalAlignChange ? (
            <>
              <span className="mx-1 h-5 w-px bg-slate-700" />
              <ToolbarBtn
                title="Alinhar ao topo da página"
                active={verticalAlign === "top"}
                onClick={() => onVerticalAlignChange("top")}
                disabled={mode === "html"}
              >
                <AlignVerticalJustifyStart className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Centrar verticalmente na página"
                active={verticalAlign === "middle"}
                onClick={() => onVerticalAlignChange("middle")}
                disabled={mode === "html"}
              >
                <AlignVerticalJustifyCenter className="h-3.5 w-3.5" />
              </ToolbarBtn>
              <ToolbarBtn
                title="Alinhar ao fundo da página"
                active={verticalAlign === "bottom"}
                onClick={() => onVerticalAlignChange("bottom")}
                disabled={mode === "html"}
              >
                <AlignVerticalJustifyEnd className="h-3.5 w-3.5" />
              </ToolbarBtn>
            </>
          ) : null}
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarSelect
            disabled={mode === "html"}
            onOpen={captureSelection}
            onPick={(v) => applyFont(v)}
            placeholder="Fonte…"
            options={FONT_FAMILIES.map((f) => ({ value: f.value, label: f.label }))}
          />
          <ToolbarSelect
            disabled={mode === "html"}
            onOpen={captureSelection}
            onPick={(v) => applySize(v)}
            placeholder="Tamanho…"
            options={FONT_SIZES.map((s) => ({ value: s, label: s }))}
            className="w-[4.5rem]"
          />
          <ToolbarSelect
            disabled={mode === "html"}
            onOpen={captureSelection}
            onPick={(v) => runExec("formatBlock", v)}
            placeholder="Bloco…"
            options={[
              { value: "p", label: "Parágrafo" },
              { value: "h1", label: "Título 1" },
              { value: "h2", label: "Título 2" },
              { value: "h3", label: "Título 3" },
            ]}
            className="max-w-[6rem]"
          />
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarBtn title="Modo visual" active={mode === "visual"} onClick={() => switchMode("visual")}>
            <Eye className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Código HTML" active={mode === "html"} onClick={() => switchMode("html")}>
            <Code className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <span
            title={formato === "html" ? "Formato de armazenamento: HTML" : "Formato de armazenamento: texto simples"}
            className={cn(
              "cursor-default rounded-full px-2 py-0.5 text-[10px] font-medium",
              formato === "html" ? "bg-blue-950/50 text-blue-200" : "bg-slate-800 text-slate-400",
            )}
          >
            {formato === "html" ? "HTML" : "Texto"}
          </span>
        </div>

        {mode === "visual" ? (
          pageLayout === "a4" ? (
            <div className="doc-editor-root overflow-x-auto rounded-lg border border-slate-700/40 bg-slate-800/30 p-3">
              <style>{editorCss}</style>
              <div
                className="doc-page-shell mx-auto shadow-md"
                style={{ width: `${pageMm.width}mm`, maxWidth: "100%" }}
              >
                <div className="doc-page-body" data-v-align={verticalAlign}>
                  {editorSurface}
                </div>
              </div>
            </div>
          ) : (
            editorSurface
          )
        ) : pageLayout === "a4" ? (
          <div className="overflow-x-auto rounded-lg border border-slate-700/40 bg-slate-800/30 p-3">
            <textarea
              ref={textareaRef}
              rows={22}
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
              className="mx-auto block w-full max-w-full rounded border border-slate-600/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 leading-relaxed"
              style={{
                width: `${pageMm.width}mm`,
                maxWidth: "100%",
                maxHeight: "70vh",
              }}
              spellCheck={false}
            />
          </div>
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

function ToolbarSelect({
  disabled,
  onOpen,
  onPick,
  placeholder,
  options,
  className,
}: {
  disabled?: boolean;
  onOpen: () => void;
  onPick: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <select
      disabled={disabled}
      className={cn(
        "h-7 max-w-[9rem] rounded border border-slate-600/60 bg-slate-900 px-1.5 text-[10px] text-slate-200",
        className,
      )}
      defaultValue=""
      onMouseDown={() => onOpen()}
      onChange={(e) => {
        const v = e.target.value;
        if (v) onPick(v);
        e.target.value = "";
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** @deprecated Use ref insertToken no RichTemplateEditor */
export function insertIntoRichEditor(editorEl: HTMLDivElement | null, token: string) {
  insertAtCursor(editorEl, token, saveSelection(editorEl), () => {
    editorEl?.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
}
