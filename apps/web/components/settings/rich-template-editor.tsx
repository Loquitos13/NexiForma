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
  AlignJustify,
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
  mmToCssPx,
  pageDimensionsMm,
  parseDocumentPages,
  plainTextToEditorHtml,
  sanitizeDocumentEditorHtml,
  serializeDocumentPages,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
} from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";
import { DocumentPageNav } from "@/components/settings/document-page-nav";
import {
  rebalanceDocumentPages,
  selectionIsAtEditorEnd,
} from "@/lib/ui/document-page-split.util";

const FONT_FAMILIES = [
  { label: "Georgia (documento)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, Arial, sans-serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
];

const FONT_SIZES = ["10px", "11px", "12px", "13px", "14px", "16px", "18px", "24px", "32px"];

const BLOCK_OPTIONS = [
  { value: "p", label: "Parágrafo" },
  { value: "h1", label: "Título 1" },
  { value: "h2", label: "Título 2" },
  { value: "h3", label: "Título 3" },
];

type EditorMode = "visual" | "html";

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  justifyLeft: boolean;
  justifyCenter: boolean;
  justifyRight: boolean;
  justifyFull: boolean;
  fontFamily: string;
  fontSize: string;
  blockTag: string;
};

const DEFAULT_FORMAT: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  justifyLeft: true,
  justifyCenter: false,
  justifyRight: false,
  justifyFull: false,
  fontFamily: FONT_FAMILIES[0]!.value,
  fontSize: "13px",
  blockTag: "p",
};

export type RichTemplateEditorHandle = {
  insertToken: (token: string) => void;
  focus: () => void;
  /** Conteúdo actual do editor (mesmo formato que onChange). */
  getContent: () => string;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
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

/** Sem selecção activa → aplica formatação a todo o conteúdo do editor. */
function resolveRangeForFormatting(editorEl: HTMLDivElement, range: Range | null): Range {
  if (range && !range.collapsed && editorEl.contains(range.commonAncestorContainer)) {
    return range.cloneRange();
  }
  const sel = window.getSelection();
  if (!range && sel && sel.rangeCount > 0) {
    const live = sel.getRangeAt(0);
    if (!live.collapsed && editorEl.contains(live.commonAncestorContainer)) {
      return live.cloneRange();
    }
  }
  const all = document.createRange();
  all.selectNodeContents(editorEl);
  return all;
}

function rangeCoversEditor(editorEl: HTMLDivElement, range: Range): boolean {
  const all = document.createRange();
  all.selectNodeContents(editorEl);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, all) <= 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, all) >= 0
  );
}

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "div", "li"]);

function applyBlockTagToAll(editorEl: HTMLDivElement, tag: string) {
  for (const child of Array.from(editorEl.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const name = el.tagName.toLowerCase();
    if (!BLOCK_TAGS.has(name) || name === tag) continue;
    const next = document.createElement(tag);
    next.innerHTML = el.innerHTML;
    const style = el.getAttribute("style");
    if (style) next.setAttribute("style", style);
    el.replaceWith(next);
  }
}

function setSelectionRange(range: Range) {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function normalizeFontFamily(raw: string): string {
  const needle = raw.replace(/["']/g, "").toLowerCase();
  for (const f of FONT_FAMILIES) {
    const val = f.value.replace(/["']/g, "").toLowerCase();
    if (needle.includes(val.split(",")[0]!.trim()) || val.includes(needle.split(",")[0]!.trim())) {
      return f.value;
    }
  }
  return FONT_FAMILIES[0]!.value;
}

function normalizeFontSize(raw: string): string {
  const pxMatch = raw.match(/^(\d+(?:\.\d+)?)px$/);
  if (pxMatch) {
    const rounded = `${Math.round(Number(pxMatch[1]))}px`;
    if (FONT_SIZES.includes(rounded)) return rounded;
    const nearest = FONT_SIZES.reduce((best, s) => {
      const d = Math.abs(Number(s) - Number(rounded));
      const bd = Math.abs(Number(best) - Number(rounded));
      return d < bd ? s : best;
    }, FONT_SIZES[0]!);
    return nearest;
  }
  return FONT_SIZES.includes(raw) ? raw : "13px";
}

function blockTagFromNode(node: Node | null, editorEl: HTMLDivElement): string {
  let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  while (el && el !== editorEl) {
    const tag = el.tagName?.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "p") return tag;
    el = el.parentElement;
  }
  return "p";
}

function readFormatState(editorEl: HTMLDivElement): FormatState {
  const sel = window.getSelection();
  const anchor = sel?.anchorNode;
  if (!anchor || !editorEl.contains(anchor)) return DEFAULT_FORMAT;

  let el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement);
  const block = blockTagFromNode(anchor, editorEl);

  let fontFamily = "";
  let fontSize = "";
  let bold = false;
  let italic = false;
  let underline = false;
  let strikeThrough = false;
  let textAlign = "left";

  while (el && el !== editorEl) {
    const style = window.getComputedStyle(el);
    if (!fontFamily && style.fontFamily) fontFamily = normalizeFontFamily(style.fontFamily);
    if (!fontSize && style.fontSize) fontSize = normalizeFontSize(style.fontSize);
    if (!bold && (style.fontWeight === "bold" || Number(style.fontWeight) >= 600)) bold = true;
    if (!italic && style.fontStyle === "italic") italic = true;
    if (!underline && style.textDecorationLine.includes("underline")) underline = true;
    if (!strikeThrough && style.textDecorationLine.includes("line-through")) strikeThrough = true;
    const tag = el.tagName?.toLowerCase();
    if (["p", "h1", "h2", "h3", "div", "li"].includes(tag ?? "")) {
      textAlign = style.textAlign || textAlign;
    }
    el = el.parentElement;
  }

  return {
    bold,
    italic,
    underline,
    strikeThrough,
    justifyLeft: textAlign === "left" || textAlign === "start",
    justifyCenter: textAlign === "center",
    justifyRight: textAlign === "right" || textAlign === "end",
    justifyFull: textAlign === "justify",
    fontFamily: fontFamily || DEFAULT_FORMAT.fontFamily,
    fontSize: fontSize || DEFAULT_FORMAT.fontSize,
    blockTag: block,
  };
}

function applyStyleToElement(el: HTMLElement, styles: Record<string, string>) {
  for (const [key, val] of Object.entries(styles)) {
    el.style.setProperty(key, val);
  }
}

/** Fonte/tamanho em todo o documento  estilos nos blocos (herdam ao texto). */
function applyInlineStyleToAllBlocks(editorEl: HTMLDivElement, styles: Record<string, string>) {
  for (const child of Array.from(editorEl.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (BLOCK_TAGS.has(tag) || tag === "table") {
      applyStyleToElement(el, styles);
    }
  }
}

function applyInlineStyle(
  editorEl: HTMLDivElement,
  styles: Record<string, string>,
  range: Range | null,
) {
  editorEl.focus();
  const r = resolveRangeForFormatting(editorEl, range ?? saveSelection(editorEl));

  if (rangeCoversEditor(editorEl, r)) {
    applyInlineStyleToAllBlocks(editorEl, styles);
    return;
  }

  setSelectionRange(r);

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
    setSelectionRange(caret);
    return;
  }

  try {
    const fragment = r.extractContents();
    span.appendChild(fragment);
    r.insertNode(span);
    const wrapped = document.createRange();
    wrapped.selectNodeContents(span);
    setSelectionRange(wrapped);
  } catch {
    const css = Object.entries(styles)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
      .join(";");
    document.execCommand("insertHTML", false, `<span style="${css}">${r.toString()}</span>`);
  }
}

const BLOCK_INLINE_STYLES: Record<string, Record<string, string>> = {
  h1: { "font-size": "1.6em", "font-weight": "700", display: "inline" },
  h2: { "font-size": "1.35em", "font-weight": "700", display: "inline" },
  h3: { "font-size": "1.15em", "font-weight": "600", display: "inline" },
  p: { "font-size": "13px", "font-weight": "400", display: "inline" },
};

function blockElementForRange(editorEl: HTMLDivElement, range: Range): HTMLElement | null {
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node && node !== editorEl) {
    const tag = (node as HTMLElement).tagName?.toLowerCase();
    if (tag === "p" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "div" || tag === "li") {
      return node as HTMLElement;
    }
    node = node.parentElement;
  }
  return null;
}

function selectionCoversBlock(editorEl: HTMLDivElement, range: Range, block: HTMLElement): boolean {
  const blockRange = document.createRange();
  blockRange.selectNodeContents(block);
  const startsBeforeOrAt =
    range.compareBoundaryPoints(Range.START_TO_START, blockRange) <= 0;
  const endsAfterOrAt = range.compareBoundaryPoints(Range.END_TO_END, blockRange) >= 0;
  return startsBeforeOrAt && endsAfterOrAt;
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
    const [format, setFormat] = useState<FormatState>(DEFAULT_FORMAT);
    const [pageScale, setPageScale] = useState(1);
    const multiPage = pageLayout === "a4";
    const [pages, setPages] = useState<string[]>(() =>
      multiPage
        ? parseDocumentPages(valueToEditorHtml(value, formato))
        : [valueToEditorHtml(value, formato)],
    );
    const [activePageIndex, setActivePageIndex] = useState(0);
    const editorRef = useRef<HTMLDivElement>(null);
    const pageWrapRef = useRef<HTMLDivElement>(null);
    const pageCanvasRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const savedRangeRef = useRef<Range | null>(null);
    const textareaSelRef = useRef<{ start: number; end: number } | null>(null);
    const lastEmittedValueRef = useRef<string | null>(null);
    const hydratedRef = useRef(false);
    const pagesRef = useRef(pages);
    const activePageRef = useRef(activePageIndex);

    pagesRef.current = pages;
    activePageRef.current = activePageIndex;

    const pageMm = pageDimensionsMm(orientacao);
    const editorCss = documentPageEditorCss(orientacao);
    const pageWidthPx = mmToCssPx(pageMm.width);
    const pageHeightPx = mmToCssPx(pageMm.height);

    const refreshFormatState = useCallback(() => {
      const el = editorRef.current;
      if (!el || mode !== "visual") return;
      setFormat(readFormatState(el));
    }, [mode]);

    const emitChange = useCallback(
      (nextHtml: string) => {
        const clean = sanitizeDocumentEditorHtml(nextHtml);
        const out = formato === "texto" ? editorHtmlToPlainText(clean) : clean;
        lastEmittedValueRef.current = out;
        onChange(out);
      },
      [formato, onChange],
    );

    const syncPagesAndEmit = useCallback(
      (nextPages: string[], nextActive?: number) => {
        setPages(nextPages);
        pagesRef.current = nextPages;
        if (nextActive !== undefined) {
          setActivePageIndex(nextActive);
          activePageRef.current = nextActive;
        }
        emitChange(serializeDocumentPages(nextPages));
      },
      [emitChange],
    );

    const emitFromVisualEditor = useCallback(() => {
      const el = editorRef.current;
      if (!el) return;

      if (!multiPage) {
        emitChange(el.innerHTML);
        refreshFormatState();
        return;
      }

      const atEnd = selectionIsAtEditorEnd(el);
      const beforeHtml = el.innerHTML;
      const previousActive = activePageRef.current;
      const updated = [...pagesRef.current];
      updated[previousActive] = beforeHtml;
      const balanced = rebalanceDocumentPages(updated, previousActive, {
        orientacao,
        editorCss,
      });

      let nextActive = previousActive;
      const pageWasSplit =
        balanced.length > updated.length ||
        (balanced[previousActive] ?? "") !== beforeHtml;
      if (atEnd && pageWasSplit && previousActive + 1 < balanced.length) {
        nextActive = previousActive + 1;
      }

      syncPagesAndEmit(balanced, nextActive);

      const displayHtml = balanced[nextActive] ?? "<p><br></p>";
      if (nextActive !== previousActive || el.innerHTML !== displayHtml) {
        requestAnimationFrame(() => {
          const live = editorRef.current;
          if (!live) return;
          live.innerHTML = displayHtml;
          if (nextActive !== previousActive) {
            live.focus();
            const range = document.createRange();
            range.selectNodeContents(live);
            range.collapse(true);
            restoreSelection(range);
          }
          refreshFormatState();
        });
        return;
      }

      refreshFormatState();
    }, [editorCss, emitChange, multiPage, orientacao, refreshFormatState, syncPagesAndEmit]);

    const selectPage = useCallback(
      (index: number) => {
        if (!multiPage || index === activePageRef.current) return;
        const el = editorRef.current;
        const updated = [...pagesRef.current];
        if (el) updated[activePageRef.current] = el.innerHTML;
        pagesRef.current = updated;
        setPages(updated);
        setActivePageIndex(index);
        activePageRef.current = index;
        requestAnimationFrame(() => {
          const live = editorRef.current;
          if (!live) return;
          live.innerHTML = updated[index] ?? "<p><br></p>";
          live.focus();
          refreshFormatState();
        });
      },
      [multiPage, refreshFormatState],
    );

    const captureSelection = useCallback(() => {
      savedRangeRef.current = saveSelection(editorRef.current);
      refreshFormatState();
    }, [refreshFormatState]);

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
        const range = resolveRangeForFormatting(el, savedRangeRef.current);
        setSelectionRange(range);
        document.execCommand(cmd, false, val);
        emitFromVisualEditor();
        savedRangeRef.current = saveSelection(el);
        refreshFormatState();
      },
      [emitFromVisualEditor, refreshFormatState],
    );

    const applyFont = useCallback(
      (fontFamily: string) => {
        const el = editorRef.current;
        if (!el) return;
        applyInlineStyle(el, { "font-family": fontFamily }, savedRangeRef.current);
        emitFromVisualEditor();
        savedRangeRef.current = saveSelection(el);
        refreshFormatState();
      },
      [emitFromVisualEditor, refreshFormatState],
    );

    const applySize = useCallback(
      (fontSize: string) => {
        const el = editorRef.current;
        if (!el) return;
        applyInlineStyle(el, { "font-size": fontSize }, savedRangeRef.current);
        emitFromVisualEditor();
        savedRangeRef.current = saveSelection(el);
        refreshFormatState();
      },
      [emitFromVisualEditor, refreshFormatState],
    );

    const applyBlock = useCallback(
      (tag: string) => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        const range = resolveRangeForFormatting(el, savedRangeRef.current);
        if (rangeCoversEditor(el, range)) {
          applyBlockTagToAll(el, tag);
        } else {
          setSelectionRange(range);
          const block = blockElementForRange(el, range);
          const inlineStyles = BLOCK_INLINE_STYLES[tag];
          if (inlineStyles && block && !selectionCoversBlock(el, range, block)) {
            applyInlineStyle(el, inlineStyles, range);
          } else {
            document.execCommand("formatBlock", false, `<${tag}>`);
          }
        }
        emitFromVisualEditor();
        savedRangeRef.current = saveSelection(el);
        refreshFormatState();
      },
      [emitFromVisualEditor, refreshFormatState],
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

    const readContent = useCallback((): string => {
      const raw =
        mode === "html"
          ? (textareaRef.current?.value ?? htmlSource)
          : multiPage
            ? (() => {
                const updated = [...pagesRef.current];
                if (editorRef.current) {
                  updated[activePageRef.current] = editorRef.current.innerHTML;
                }
                return serializeDocumentPages(updated);
              })()
            : (editorRef.current?.innerHTML ?? htmlSource);
      const clean = sanitizeDocumentEditorHtml(raw);
      return formato === "texto" ? editorHtmlToPlainText(clean) : clean;
    }, [formato, htmlSource, mode, multiPage]);

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
        getContent() {
          return readContent();
        },
      }),
      [captureSelection, emitFromVisualEditor, insertInTextarea, mode, readContent],
    );

    useLayoutEffect(() => {
      hydratedRef.current = false;
      setActivePageIndex(0);
      activePageRef.current = 0;
    }, [formato, orientacao]);

    useLayoutEffect(() => {
      if (mode !== "visual") return;
      const el = editorRef.current;
      if (!el || hydratedRef.current) return;
      const html = valueToEditorHtml(value, formato);
      if (multiPage) {
        const parsed = parseDocumentPages(html);
        setPages(parsed);
        pagesRef.current = parsed;
        el.innerHTML = parsed[0] ?? "<p><br></p>";
      } else {
        el.innerHTML = html;
      }
      lastEmittedValueRef.current = value;
      hydratedRef.current = true;
      refreshFormatState();
    }, [formato, mode, multiPage, orientacao, refreshFormatState, value]);

    useEffect(() => {
      if (mode !== "visual") return;
      const el = editorRef.current;
      if (!el) return;
      if (document.activeElement === el) return;
      if (value === lastEmittedValueRef.current) return;
      lastEmittedValueRef.current = value;
      const html = valueToEditorHtml(value, formato);
      setHtmlSource(html);
      if (multiPage) {
        const parsed = parseDocumentPages(html);
        setPages(parsed);
        pagesRef.current = parsed;
        const idx = Math.min(activePageRef.current, Math.max(parsed.length - 1, 0));
        setActivePageIndex(idx);
        activePageRef.current = idx;
        el.innerHTML = parsed[idx] ?? "<p><br></p>";
      } else {
        el.innerHTML = html;
      }
      hydratedRef.current = true;
      refreshFormatState();
    }, [value, formato, mode, multiPage, refreshFormatState]);

    useLayoutEffect(() => {
      if (pageLayout !== "a4") return;
      const canvas = pageCanvasRef.current;
      if (!canvas) return;
      const update = () => {
        const avail = canvas.clientWidth;
        setPageScale(Math.min(1, avail / pageWidthPx));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [pageLayout, pageWidthPx, orientacao]);

    useEffect(() => {
      const el = editorRef.current;
      if (!el || mode !== "visual") return;
      function onSelectionChange() {
        if (!el) return;
        const sel = window.getSelection();
        if (sel && el.contains(sel.anchorNode)) refreshFormatState();
      }
      document.addEventListener("selectionchange", onSelectionChange);
      el.addEventListener("keyup", onSelectionChange);
      el.addEventListener("mouseup", onSelectionChange);
      return () => {
        document.removeEventListener("selectionchange", onSelectionChange);
        el.removeEventListener("keyup", onSelectionChange);
        el.removeEventListener("mouseup", onSelectionChange);
      };
    }, [mode, refreshFormatState]);

    function switchMode(next: EditorMode) {
      if (next === mode) return;
      if (next === "html") {
        let html = editorRef.current?.innerHTML ?? htmlSource;
        if (multiPage && editorRef.current) {
          const updated = [...pagesRef.current];
          updated[activePageRef.current] = editorRef.current.innerHTML;
          setPages(updated);
          pagesRef.current = updated;
          html = serializeDocumentPages(updated);
        }
        setHtmlSource(html);
        lastEmittedValueRef.current = formato === "texto" ? editorHtmlToPlainText(html) : html;
        setMode("html");
        return;
      }
      const html = htmlSource.trim() || "<p><br></p>";
      setHtmlSource(html);
      setMode("visual");
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        if (multiPage) {
          const parsed = parseDocumentPages(html);
          setPages(parsed);
          pagesRef.current = parsed;
          setActivePageIndex(0);
          activePageRef.current = 0;
          editorRef.current.innerHTML = parsed[0] ?? "<p><br></p>";
        } else {
          editorRef.current.innerHTML = html;
        }
        lastEmittedValueRef.current = value;
        hydratedRef.current = true;
        emitChange(multiPage ? serializeDocumentPages(parseDocumentPages(html)) : html);
        refreshFormatState();
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

    const a4PageCanvas = (
      <div
        ref={pageWrapRef}
        className="doc-editor-root flex gap-5 overflow-hidden rounded-lg border border-slate-700/40 bg-slate-800/30"
        style={{ maxHeight: "min(85vh, 920px)" }}
      >
        <style>{editorCss}</style>
        {multiPage && pages.length > 0 ? (
          <DocumentPageNav
            pages={pages}
            activeIndex={activePageIndex}
            orientacao={orientacao}
            verticalAlign={verticalAlign}
            editorCss={editorCss}
            onSelect={selectPage}
          />
        ) : null}
        <div ref={pageCanvasRef} className="flex min-h-0 min-w-0 flex-1 justify-center overflow-x-hidden overflow-y-auto py-3 pr-3">
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: pageWidthPx * pageScale,
              height: pageHeightPx * pageScale,
            }}
          >
            <div
              className="doc-page-shell origin-top-left shadow-md"
              style={{
                width: `${pageMm.width}mm`,
                height: `${pageMm.height}mm`,
                transform: `scale(${pageScale})`,
              }}
            >
              <div className="doc-page-body" data-v-align={verticalAlign}>
                {editorSurface}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-950/80 p-1.5">
          <ToolbarBtn
            title="Negrito"
            active={format.bold}
            onClick={() => runExec("bold")}
            disabled={mode === "html"}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Itálico"
            active={format.italic}
            onClick={() => runExec("italic")}
            disabled={mode === "html"}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Sublinhado"
            active={format.underline}
            onClick={() => runExec("underline")}
            disabled={mode === "html"}
          >
            <Underline className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Rasurado"
            active={format.strikeThrough}
            onClick={() => runExec("strikeThrough")}
            disabled={mode === "html"}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <span className="mx-1 h-5 w-px bg-slate-700" />
          <ToolbarBtn
            title="Alinhar à esquerda"
            active={format.justifyLeft}
            onClick={() => runExec("justifyLeft")}
            disabled={mode === "html"}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Centrar horizontalmente"
            active={format.justifyCenter}
            onClick={() => runExec("justifyCenter")}
            disabled={mode === "html"}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Alinhar à direita"
            active={format.justifyRight}
            onClick={() => runExec("justifyRight")}
            disabled={mode === "html"}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Justificar"
            active={format.justifyFull}
            onClick={() => runExec("justifyFull")}
            disabled={mode === "html"}
          >
            <AlignJustify className="h-3.5 w-3.5" />
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
            value={format.fontFamily}
            onOpen={captureSelection}
            onPick={applyFont}
            placeholder="Fonte…"
            options={FONT_FAMILIES.map((f) => ({ value: f.value, label: f.label }))}
          />
          <ToolbarSelect
            disabled={mode === "html"}
            value={format.fontSize}
            onOpen={captureSelection}
            onPick={applySize}
            placeholder="Tamanho…"
            options={FONT_SIZES.map((s) => ({ value: s, label: s }))}
            className="w-[4.5rem]"
          />
          <ToolbarSelect
            disabled={mode === "html"}
            value={format.blockTag}
            onOpen={captureSelection}
            onPick={applyBlock}
            placeholder="Bloco…"
            options={BLOCK_OPTIONS}
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
            a4PageCanvas
          ) : (
            editorSurface
          )
        ) : pageLayout === "a4" ? (
          <div className="overflow-x-hidden rounded-lg border border-slate-700/40 bg-slate-800/30">
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
                minHeight: `${pageMm.height}mm`,
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
  value,
  onOpen,
  onPick,
  placeholder,
  options,
  className,
}: {
  disabled?: boolean;
  value: string;
  onOpen: () => void;
  onPick: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const matched = options.some((o) => o.value === value);
  return (
    <select
      disabled={disabled}
      value={matched ? value : ""}
      className={cn(
        "h-7 max-w-[9rem] rounded border border-slate-600/60 bg-slate-900 px-1.5 text-[10px] text-slate-200",
        className,
      )}
      onPointerDown={() => onOpen()}
      onFocus={() => onOpen()}
      onChange={(e) => {
        const v = e.target.value;
        if (v) onPick(v);
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
