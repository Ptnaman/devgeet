import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import { RichEditor, RichToolbar, actions } from "react-native-pell-rich-editor";

import { COLORS, RADIUS, SPACING } from "@/constants/theme";

export type RichTextEditorValue = {
  html: string;
  plainText: string;
};

type RichTextEditorProps = {
  initialHtml: string;
  onChange: (value: RichTextEditorValue) => void;
  placeholder?: string;
  readOnly?: boolean;
};

const extractPlainText = (value: string) =>
  value
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u200B/g, "")
    .replace(/\s+/g, " ")
    .trim();

export default function RichTextEditor({
  initialHtml,
  onChange,
  placeholder = "Start writing your post...",
  readOnly,
}: RichTextEditorProps) {
  const editorRef = useRef<RichEditor>(null);

  return (
    <View style={styles.container}>
      {!readOnly ? (
        <RichToolbar
          editor={editorRef}
          actions={[
            actions.undo,
            actions.redo,
            actions.setBold,
            actions.setItalic,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.blockquote,
            actions.heading1,
            actions.heading2,
            actions.alignLeft,
            actions.alignCenter,
            actions.alignRight,
            actions.removeFormat,
          ]}
          iconTint={COLORS.text}
          selectedIconTint={COLORS.primary}
          style={styles.toolbar}
        />
      ) : null}
      <RichEditor
        ref={editorRef}
        initialContentHTML={initialHtml}
        placeholder={placeholder}
        style={styles.editor}
        disabled={readOnly}
        useContainer={false}
        onChange={(html) => {
          onChange({
            html,
            plainText: extractPlainText(html),
          });
        }}
        editorStyle={{
          backgroundColor: COLORS.surface,
          color: COLORS.text,
          placeholderColor: COLORS.mutedText,
          contentCSSText: "font-size: 16px; line-height: 1.55; min-height: 220px;",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },
  toolbar: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },
  editor: {
    minHeight: 240,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
