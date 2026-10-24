import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import "../memo.css";

/**
 * Rich-text memo body. The toolbar is limited to what the backend keeps
 * (App\Support\Memos\MemoHtml) and what converts cleanly to PDF and Word:
 * bold, italic, underline, strike, alignment, lists and tables. Nested
 * numbered lists print as 1. / a. / (1) / (a), like the memo template.
 */
export const MemoEditor = ({ value, onChange }: { value: string; onChange: (html: string) => void }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
      TextAlign.configure({ types: ["paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "1. The Comd is respectfully req to…" }),
    ],
    content: value,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Load content that arrives after mount (editing an existing memo).
  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML() && !(value === "" && editor.isEmpty)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className="memo-editor rounded-lg border border-[#0A4D66]/60 overflow-hidden">
      {editor && <Toolbar editor={editor} />}
      <div className="bg-white">
        <EditorContent editor={editor} className="memo-body" />
      </div>
    </div>
  );
};

const ToolButton = ({
  icon,
  title,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      "w-8 h-8 rounded flex items-center justify-center text-gray-300 hover:bg-[#0A4D66]/40 disabled:opacity-30 disabled:hover:bg-transparent",
      active && "bg-[#0A4D66] text-white",
    )}
  >
    <Icon icon={icon} className="w-4 h-4" />
  </button>
);

const Divider = () => <span className="w-px h-6 bg-[#0A4D66]/60 mx-1" />;

const Toolbar = ({ editor }: { editor: Editor }) => {
  const chain = () => editor.chain().focus();
  const inTable = editor.isActive("table");

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[#001825] border-b border-[#0A4D66]/60">
      <ToolButton icon="mdi:format-bold" title="Bold" active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon="mdi:format-italic" title="Italic" active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon="mdi:format-underline" title="Underline" active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
      <ToolButton icon="mdi:format-strikethrough" title="Strikethrough" active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
      <Divider />
      <ToolButton icon="mdi:format-align-left" title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()} />
      <ToolButton icon="mdi:format-align-center" title="Align centre" active={editor.isActive({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()} />
      <ToolButton icon="mdi:format-align-right" title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()} />
      <ToolButton icon="mdi:format-align-justify" title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()} />
      <Divider />
      <ToolButton icon="mdi:format-list-numbered" title="Numbered paragraphs (1. a. (1))" active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon="mdi:format-list-bulleted" title="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon="mdi:format-indent-increase" title="Sub-paragraph (indent)" disabled={!editor.can().sinkListItem("listItem")} onClick={() => chain().sinkListItem("listItem").run()} />
      <ToolButton icon="mdi:format-indent-decrease" title="Outdent" disabled={!editor.can().liftListItem("listItem")} onClick={() => chain().liftListItem("listItem").run()} />
      <Divider />
      <ToolButton icon="mdi:table-plus" title="Insert table" disabled={inTable} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      {inTable && (
        <>
          <ToolButton icon="mdi:table-row-plus-after" title="Add row" onClick={() => chain().addRowAfter().run()} />
          <ToolButton icon="mdi:table-row-remove" title="Delete row" onClick={() => chain().deleteRow().run()} />
          <ToolButton icon="mdi:table-column-plus-after" title="Add column" onClick={() => chain().addColumnAfter().run()} />
          <ToolButton icon="mdi:table-column-remove" title="Delete column" onClick={() => chain().deleteColumn().run()} />
          <ToolButton icon="mdi:table-merge-cells" title="Merge / split cells" onClick={() => chain().mergeOrSplit().run()} />
          <ToolButton icon="mdi:table-remove" title="Delete table" onClick={() => chain().deleteTable().run()} />
        </>
      )}
      <Divider />
      <ToolButton icon="mdi:undo" title="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()} />
      <ToolButton icon="mdi:redo" title="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()} />
    </div>
  );
};
