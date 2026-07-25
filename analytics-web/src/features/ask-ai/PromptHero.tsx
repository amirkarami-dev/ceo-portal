// report-web/src/features/ask-ai/PromptHero.tsx
import { Button, Flex, Input, Select, Tag, Typography } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EXAMPLE_PROMPTS } from "@/ai/examples";
import { listSemanticModels } from "@/semantic/registry";

interface Props {
  /** Compact = two-pane top bar; non-compact = centered hero. */
  compact: boolean;
  datasetKey: string;
  onDataset: (key: string) => void;
  onSubmit: (prompt: string) => void;
}

export function PromptHero({ compact, datasetKey, onDataset, onSubmit }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState("");

  const send = () => {
    const v = text.trim();
    if (v) {
      onSubmit(v);
      setText("");
    }
  };

  return (
    <motion.div
      layout
      className={compact ? "ask-hero ask-hero--compact" : "ask-hero"}
      style={compact ? undefined : { maxWidth: 720, margin: "0 auto", paddingTop: 24 }}
    >
      {!compact && (
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 16, fontSize: 14 }}
        >
          {t("ask.sqlReassurance")}
        </Typography.Text>
      )}

      <Flex gap={8} align="flex-start" className="ask-hero__row" wrap>
        <Select
          data-testid="dataset-picker"
          value={datasetKey}
          onChange={onDataset}
          options={listSemanticModels().map((m) => ({ value: m.key, label: m.label }))}
          style={{ minWidth: 160 }}
        />
        <Input.TextArea
          aria-label={t("ask.promptLabel")}
          autoSize={{ minRows: 1, maxRows: 5 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") send();
          }}
          placeholder={t("ask.promptPlaceholder")}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={send}
          aria-label={t("ask.send")}
        >
          {t("ask.send")}
        </Button>
      </Flex>

      {!compact && (
        <div className="ask-hero__chips" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLE_PROMPTS.map((ex) => (
            <Tag.CheckableTag
              key={ex.id}
              data-testid="example-chip"
              checked={false}
              onChange={() => {
                onDataset(ex.datasetKey);
                onSubmit(ex.prompt);
              }}
              style={{ cursor: "pointer", borderRadius: 20, padding: "2px 12px" }}
            >
              {ex.label}
            </Tag.CheckableTag>
          ))}
        </div>
      )}
    </motion.div>
  );
}
