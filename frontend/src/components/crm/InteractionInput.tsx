import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import { api } from "../../services/api";
import { stripHtml } from "../../utils/htmlPreview";

type MentionItem = {
  id: string;
  label: string;
  hint?: string;
};

type MentionListHandle = {
  onKeyDown: (props: { event: { key: string } }) => boolean;
};

const MentionList = forwardRef<MentionListHandle, SuggestionProps<MentionItem>>(
  function MentionList(props, ref) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
      setIndex(0);
    }, [props.items]);

    const selectItem = useCallback(
      (i: number) => {
        const item = props.items[i];
        if (item) props.command({ id: item.id, label: item.label } as MentionItem);
      },
      [props],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setIndex((prev) => (prev + props.items.length - 1) % Math.max(props.items.length, 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setIndex((prev) => (prev + 1) % Math.max(props.items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(index);
          return true;
        }
        return false;
      },
    }));

    if (!props.items.length) {
      return (
        <div className="mention-list">
          <div className="mention-list-empty">No matches</div>
        </div>
      );
    }

    return (
      <div className="mention-list">
        {props.items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`mention-list-item${i === index ? " is-active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              selectItem(i);
            }}
          >
            <span>{item.label}</span>
            {item.hint ? <span className="mention-list-hint">{item.hint}</span> : null}
          </button>
        ))}
      </div>
    );
  },
);

function renderMentionSuggestions(): SuggestionOptions<MentionItem>["render"] {
  return () => {
    let component: ReactRenderer<MentionListHandle> | null = null;
    let unmount: (() => void) | undefined;

    return {
      onStart(props) {
        component = new ReactRenderer(MentionList, {
          editor: props.editor,
          props,
        });
        unmount = props.mount(component.element);
      },
      onUpdate(props) {
        component?.updateProps(props);
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          unmount?.();
          return true;
        }
        return component?.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        unmount?.();
        component?.destroy();
        component = null;
      },
    };
  };
}

type InteractionInputProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function InteractionInput({
  value,
  onChange,
  placeholder = "Type @ to tag a colleague or # to tag a product…",
  className = "",
  disabled = false,
}: InteractionInputProps) {
  const { chemicals } = useProductCatalog();
  const [colleagues, setColleagues] = useState<MentionItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ id: string; name: string; email?: string | null }[]>("/crm/colleagues")
      .then((res) => {
        if (cancelled) return;
        setColleagues(
          (res.data ?? []).map((row) => ({
            id: row.id || row.email || row.name,
            label: row.name || row.email || row.id,
            hint: row.email && row.email !== row.name ? row.email : undefined,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setColleagues([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const productItems: MentionItem[] = chemicals.map((c) => ({
    id: String(c.id),
    label: c.product_name || String(c.id),
    hint: c.vendor || c.product_category || undefined,
  }));

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: false }),
        Mention.configure({
          HTMLAttributes: { class: "crm-mention" },
          suggestions: [
            {
              char: "@",
              pluginKey: new PluginKey("colleagueMention"),
              items: ({ query }) => {
                const q = query.toLowerCase();
                return colleagues
                  .filter(
                    (item) =>
                      item.label.toLowerCase().includes(q) ||
                      (item.hint ?? "").toLowerCase().includes(q),
                  )
                  .slice(0, 8);
              },
              render: renderMentionSuggestions(),
            },
            {
              char: "#",
              pluginKey: new PluginKey("productMention"),
              items: ({ query }) => {
                const q = query.toLowerCase();
                return productItems
                  .filter(
                    (item) =>
                      item.label.toLowerCase().includes(q) ||
                      (item.hint ?? "").toLowerCase().includes(q),
                  )
                  .slice(0, 8);
              },
              render: renderMentionSuggestions(),
            },
          ],
        }),
      ],
      content: value || "",
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: `interaction-editor ProseMirror ${className}`.trim(),
          "data-placeholder": placeholder,
        },
      },
      onUpdate: ({ editor: next }) => {
        onChange(next.getHTML());
      },
    },
    [colleagues, productItems.length, disabled],
  );

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (!value && !editor.isEmpty) {
      editor.commands.clearContent();
      return;
    }
    if (value && value !== current && stripHtml(value) !== stripHtml(current)) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return <EditorContent editor={editor} />;
}

export function interactionHasText(html: string): boolean {
  return stripHtml(html).length > 0;
}
