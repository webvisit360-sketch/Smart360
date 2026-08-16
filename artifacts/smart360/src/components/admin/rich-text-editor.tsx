import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold, Italic, List, ListOrdered, Link2, Heading4, Undo2, Redo2,
  MoreHorizontal, Code2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "../ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * WYSIWYG editor for guest-facing rich text (spec: admin-urejevalnik-besedila.md).
 * Schema allowlist by construction: p, br, strong, em, ul, ol, li,
 * a[href,target,rel], h4 — nothing else can be typed, pasted or imported.
 * The server applies the same allowlist again on save.
 */

// ---------- paste cleanup ----------

/** True for Word's fake list paragraphs (MsoListParagraph / mso-list style). */
function isWordListParagraph(el: HTMLElement): boolean {
  return (
    /MsoListParagraph/i.test(el.className) ||
    /mso-list/i.test(el.getAttribute("style") || "")
  );
}

/** Does the Word list paragraph look numbered ("1." / "a)" …) or bulleted? */
function wordListIsOrdered(text: string): boolean {
  return /^\s*(\d+[.)]|[a-z][.)])\s/i.test(text);
}

/** Strip the literal bullet/number Word puts inside the paragraph text. */
function stripWordListMarker(el: HTMLElement) {
  // Word wraps the marker in a conditional span (mso-list:Ignore) — drop it.
  el.querySelectorAll("span").forEach((s) => {
    if (/mso-list:\s*ignore/i.test(s.getAttribute("style") || "")) s.remove();
  });
  const first = el.firstChild;
  if (first?.nodeType === Node.TEXT_NODE) {
    first.textContent = (first.textContent || "").replace(
      /^\s*([•·▪o–-]|\d+[.)]|[a-z][.)])\s+/i,
      "",
    );
  }
}

/**
 * Normalize pasted HTML from Word / websites / e-mail before Tiptap's schema
 * does the final allowlist pass: drop styling wrappers, map legacy tags,
 * rebuild real <ul>/<ol> out of Word's list paragraphs, collapse &nbsp;.
 */
export function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  // 1. Remove entirely (with content): scripts, styles, media, comments.
  body.querySelectorAll("script,style,iframe,img,video,audio,object,embed,head,meta,link,title,button,form,input,select,option,svg").forEach((n) => n.remove());
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  // 2. Word list paragraphs -> real <ul>/<ol> (before attributes are wiped).
  const paras = Array.from(body.querySelectorAll("p"));
  let listEl: HTMLElement | null = null;
  let listOrdered = false;
  for (const p of paras) {
    if (isWordListParagraph(p)) {
      const ordered = wordListIsOrdered(p.textContent || "");
      if (!listEl || listOrdered !== ordered) {
        listEl = doc.createElement(ordered ? "ol" : "ul");
        listOrdered = ordered;
        p.before(listEl);
      }
      stripWordListMarker(p);
      const li = doc.createElement("li");
      while (p.firstChild) li.appendChild(p.firstChild);
      listEl.appendChild(li);
      p.remove();
    } else {
      listEl = null;
    }
  }

  // 3. Map legacy/foreign tags onto the allowlist.
  const rename = (from: string, to: string) => {
    body.querySelectorAll(from).forEach((el) => {
      const repl = doc.createElement(to);
      while (el.firstChild) repl.appendChild(el.firstChild);
      el.replaceWith(repl);
    });
  };
  rename("b", "strong");
  rename("i", "em");
  ["h1", "h2", "h3", "h5", "h6"].forEach((h) => rename(h, "h4"));

  // 4. Unwrap wrappers, keeping their content.
  ["span", "font", "div", "table", "thead", "tbody", "tfoot", "tr", "td", "th",
   "section", "article", "figure", "figcaption", "u", "s", "strike", "small",
   "big", "center", "blockquote", "pre", "code", "mark", "sup", "sub"].forEach((tag) => {
    // repeat until stable: unwrapping can expose nested same-tag wrappers
    let els = body.querySelectorAll(tag);
    while (els.length) {
      els.forEach((el) => {
        while (el.firstChild) el.before(el.firstChild);
        el.remove();
      });
      els = body.querySelectorAll(tag);
    }
  });

  // 5. Strip every attribute except href/target/rel on <a>.
  body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const keep = el.tagName === "A" && ["href", "target", "rel"].includes(attr.name);
      if (!keep) el.removeAttribute(attr.name);
    }
  });

  // 6. Collapse &nbsp; runs into ordinary spaces.
  return body.innerHTML.replace(/(\u00a0|&nbsp;)+/g, " ");
}

// ---------- legacy value handling ----------

/**
 * Older seed data stores text bodies as a JSON array of paragraph strings.
 * The editor works in HTML, so convert on the way in; it is saved back as
 * plain HTML (the guest render path supports both).
 */
export function bodyToHtml(value: string): string {
  if (!value) return "";
  const t = value.trim();
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((p) => typeof p === "string")
          .map((p) => (/^\s*</.test(p) ? p : `<p>${p}</p>`))
          .join("");
      }
    } catch {
      /* not JSON — fall through */
    }
  }
  return value;
}

// ---------- link popover ----------

function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [newTab, setNewTab] = useState(false);

  const openPopover = (next: boolean) => {
    if (next) {
      const attrs = editor.getAttributes("link");
      setUrl(attrs.href || "");
      setNewTab(attrs.target === "_blank");
    }
    setOpen(next);
  };

  const apply = () => {
    const href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink(
          newTab
            ? { href, target: "_blank", rel: "noopener noreferrer" }
            : { href, target: null, rel: null },
        )
        .run();
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={openPopover}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="ghost" size="sm" disabled={disabled}
          className={`h-8 w-8 p-0 ${editor.isActive("link") ? "bg-accent" : ""}`}
          title="Povezava" aria-label="Povezava"
        >
          <Link2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <Label htmlFor="rte-link-url">Povezava (URL)</Label>
          <Input
            id="rte-link-url" value={url} placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="rte-link-blank" checked={newTab} onCheckedChange={(v) => setNewTab(v === true)} />
          <Label htmlFor="rte-link-blank" className="font-normal">Odpri v novem oknu</Label>
        </div>
        <div className="flex justify-end gap-2">
          {editor.isActive("link") && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setUrl(""); apply(); }}>
              Odstrani
            </Button>
          )}
          <Button type="button" size="sm" onClick={apply}>V redu</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- the editor ----------

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function RichTextEditor({ value, onChange, placeholder, disabled }: Props) {
  const [htmlMode, setHtmlMode] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState("");
  // Track what the editor itself emitted, so external value changes
  // (draft restore, reset) update the editor without feedback loops.
  const lastEmitted = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [4] },
        blockquote: false,
        codeBlock: false,
        code: false,
        strike: false,
        horizontalRule: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https", "mailto", "tel"],
      }),
    ],
    content: bodyToHtml(value),
    editable: !disabled,
    editorProps: {
      transformPastedHTML: cleanPastedHtml,
      attributes: {
        class: "rte-content focus:outline-none",
        ...(placeholder ? { "data-placeholder": placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // External value change (e.g. restored draft) -> load into the editor.
  useEffect(() => {
    if (!editor || htmlMode) return;
    if (value === lastEmitted.current) return;
    const incoming = bodyToHtml(value);
    if (incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    lastEmitted.current = value;
  }, [value, editor, htmlMode]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const toggleHtmlMode = (next: boolean) => {
    if (!editor) return;
    if (next) {
      setHtmlDraft(editor.isEmpty ? "" : editor.getHTML());
    } else {
      // Round-trip through the same schema: whatever the textarea holds is
      // loaded into Tiptap, which strips anything outside the allowlist.
      editor.commands.setContent(bodyToHtml(htmlDraft), { emitUpdate: false });
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    }
    setHtmlMode(next);
  };

  if (!editor) return null;

  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    icon: React.ReactNode,
    enabled = true,
  ) => (
    <Button
      type="button" variant="ghost" size="sm"
      className={`h-8 w-8 p-0 ${active ? "bg-accent" : ""}`}
      onClick={onClick} disabled={disabled || htmlMode || !enabled}
      title={title} aria-label={title}
    >
      {icon}
    </Button>
  );

  return (
    <div className={`rounded-xl border-2 border-border bg-background ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1 flex-wrap">
        {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Krepko", <Bold className="w-4 h-4" />)}
        {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Ležeče", <Italic className="w-4 h-4" />)}
        {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Alineje", <List className="w-4 h-4" />)}
        {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Oštevilčen seznam", <ListOrdered className="w-4 h-4" />)}
        <LinkButton editor={editor} disabled={disabled || htmlMode} />
        {btn(editor.isActive("heading", { level: 4 }), () => editor.chain().focus().toggleHeading({ level: 4 }).run(), "Podnaslov", <Heading4 className="w-4 h-4" />)}
        <div className="w-px h-5 bg-border mx-1" />
        {btn(false, () => editor.chain().focus().undo().run(), "Razveljavi", <Undo2 className="w-4 h-4" />, editor.can().undo())}
        {btn(false, () => editor.chain().focus().redo().run(), "Uveljavi", <Redo2 className="w-4 h-4" />, editor.can().redo())}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={disabled} title="Več možnosti" aria-label="Več možnosti">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem checked={htmlMode} onCheckedChange={toggleHtmlMode}>
                <Code2 className="w-4 h-4 mr-2" /> HTML
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {htmlMode ? (
        <textarea
          className="w-full min-h-28 px-4 py-3 text-sm font-mono bg-transparent focus:outline-none resize-y"
          value={htmlDraft}
          onChange={(e) => { setHtmlDraft(e.target.value); onChange(e.target.value); }}
          disabled={disabled}
          spellCheck={false}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
        Prilepljeno besedilo se samodejno počisti (Word, splet). Ctrl/Cmd+Shift+V prilepi kot golo besedilo.
      </p>
    </div>
  );
}
