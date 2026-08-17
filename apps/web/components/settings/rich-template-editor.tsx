"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** legado: texto simples vs html rico */
  formato?: "texto" | "html";
  onFormatoChange?: (formato: "texto" | "html") => void;
  minHeight?: number;
  placeholder?: string;
};

export function RichTemplateEditor({
  value,
  onChange,
  formato = "html",
  onFormatoChange,
  minHeight = 360,
  placeholder = "Escreva o conteúdo do documento…",
}: Props) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [htmlSource, setHtmlSource] = useState(value);
  const editorRef = useRef<HTMLDivElement>(null);

  const syncFromProp = useCallback(
    (raw: string) => {
      const html =
        formato === "texto" && raw && !/<[a-z][\s\S]*>/i.test(raw)
          ? plainTextToEditorHtml(raw)
          : raw || "<p></p>";
      setHtmlSource(html);
      if (editorRef.current && mode === "visual") {
        editorRef.current.innerHTML = html;
      }
    },
    [formato, mode],
  );

  useEffect(() => {
    syncFromProp(value);
  }, [value, syncFromProp]);

  function emitChange(nextHtml: string) {
    const clean = sanitizeDocumentEditorHtml(nextHtml);
    onChange(formato === "texto" ? editorHtmlToPlainText(clean) : clean);
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) emitChange(editorRef.current.innerHTML);
  }

  function switchMode(next: EditorMode) {
    if (next === mode) return;
    if (next === "html") {
      const current = editorRef.current?.innerHTML ?? htmlSource;
      setHtmlSource(current);
      setMode("html");
      return;
    }
    const html = htmlSource.trim() || "<p></p>";
    setHtmlSource(html);
    setMode("visual");
    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = html;
    });
  }

  function toggleFormato() {
    const next = formato === "html" ? "texto" : "html";
    if (next === "texto" && editorRef.current) {
      const plain = editorHtmlToPlainText(editorRef.current.innerHTML);
      onChange(plain);
    } else if (next === "html") {
      onChange(plainTextToEditorHtml(value || ""));
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
          data-placeholder={placeholder}
          className={cn(
            "rich-template-editor w-full rounded-lg border border-slate-600/60 bg-white px-4 py-3",
            "text-[13px] leading-relaxed text-slate-900 outline-none",
            "min-h-[var(--editor-min-h)] font-[Georgia,'Times_New_Roman',serif]",
            "[&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)]",
          )}
          style={{ "--editor-min-h": `${minHeight}px` } as React.CSSProperties}
          onInput={() => {
            if (editorRef.current) emitChange(editorRef.current.innerHTML);
          }}
        />
        </>
      ) : (
        <textarea
          rows={18}
          value={htmlSource}
          onChange={(e) => {
            setHtmlSource(e.target.value);
            emitChange(e.target.value);
          }}
          className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 leading-relaxed"
          spellCheck={false}
        />
      )}
    </div>
  );
}

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

/** Insere token na posição actual do cursor no editor visual. */
export function insertIntoRichEditor(editorEl: HTMLDivElement | null, token: string) {
  if (!editorEl) return;
  editorEl.focus();
  document.execCommand("insertText", false, token);
}
