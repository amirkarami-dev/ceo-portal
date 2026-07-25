import { useEffect } from "react";
import { Button, Divider, Space, Tooltip, theme } from "antd";
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ItalicOutlined,
  LinkOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";

export interface RichTextEditorProps {
  /** HTML. Older articles hold plain text with blank-line paragraphs — see `toHtml`. */
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  minHeight?: number;
  placeholder?: string;
}

/** True when the stored body already looks like HTML rather than typed plain text. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?(p|div|br|h[1-6]|ul|ol|li|strong|em|u|s|a|blockquote)\b/i.test(value);
}

/**
 * Existing articles were written in a plain <textarea> with paragraphs split by a blank line.
 * Feeding that straight into Tiptap would collapse it to one block, so convert on the way in.
 */
function toHtml(value: string): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  if (looksLikeHtml(text)) return text;
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />").replace(/</g, "&lt;").replace(/&lt;br \/&gt;/g, "<br />")}</p>`)
    .join("");
}

function ToolbarButton({
  editor,
  title,
  icon,
  active,
  onClick,
  disabled,
}: {
  editor: Editor | null;
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip title={title}>
      <Button
        type={active ? "primary" : "text"}
        size="small"
        aria-label={title}
        aria-pressed={!!active}
        icon={icon}
        disabled={disabled || !editor}
        // Keep the selection: mousedown would blur the editor before the command runs.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      />
    </Tooltip>
  );
}

/**
 * Tiptap wrapped to behave like an AntD form control: `value`/`onChange` are HTML strings, so it
 * drops straight into `<Form.Item name="body">`.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
  minHeight = 320,
  placeholder = "متن خبر…",
}: RichTextEditorProps) {
  const { token } = theme.useToken();

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // v3's StarterKit already bundles Link and Underline — registering them again throws.
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: toHtml(value ?? ""),
    onUpdate: ({ editor: e }) => {
      // Tiptap reports "<p></p>" for an empty doc; report "" so `required` validation still fires.
      onChange?.(e.isEmpty ? "" : e.getHTML());
    },
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "tiptap-body",
        style: `min-height:${minHeight}px;padding:12px 14px;outline:none;`,
      },
    },
    immediatelyRender: false,
  });

  // Re-sync when the drawer is reused for a different article.
  useEffect(() => {
    if (!editor) return;
    const incoming = toHtml(value ?? "");
    if (incoming !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("نشانی پیوند:", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        overflow: "hidden",
        background: token.colorBgContainer,
      }}
    >
      <Space
        wrap
        size={2}
        style={{
          padding: 6,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <ToolbarButton editor={editor} title="درشت" icon={<BoldOutlined />} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="کج" icon={<ItalicOutlined />} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="زیرخط" icon={<UnderlineOutlined />} active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="خط‌خورده" icon={<StrikethroughOutlined />} active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={disabled} />
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        <ToolbarButton editor={editor} title="عنوان" icon={<b style={{ fontSize: 12 }}>H2</b>} active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="فهرست نشانه‌دار" icon={<UnorderedListOutlined />} active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="فهرست شماره‌دار" icon={<OrderedListOutlined />} active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={disabled} />
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        <ToolbarButton editor={editor} title="راست‌چین" icon={<AlignRightOutlined />} active={editor?.isActive({ textAlign: "right" })} onClick={() => editor?.chain().focus().setTextAlign("right").run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="وسط‌چین" icon={<AlignCenterOutlined />} active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="چپ‌چین" icon={<AlignLeftOutlined />} active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} disabled={disabled} />
        <Divider type="vertical" style={{ margin: "0 4px" }} />
        <ToolbarButton editor={editor} title="پیوند" icon={<LinkOutlined />} active={editor?.isActive("link")} onClick={setLink} disabled={disabled} />
        <ToolbarButton editor={editor} title="واگرد" icon={<UndoOutlined />} onClick={() => editor?.chain().focus().undo().run()} disabled={disabled} />
        <ToolbarButton editor={editor} title="ازنو" icon={<RedoOutlined />} onClick={() => editor?.chain().focus().redo().run()} disabled={disabled} />
      </Space>

      <EditorContent editor={editor} data-placeholder={placeholder} />
    </div>
  );
}
