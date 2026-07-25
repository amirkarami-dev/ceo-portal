// report-web/src/features/ask-ai/DefinitionPanel.tsx
import { Button, Collapse, Tooltip, message, theme } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { ReportDefinition } from "@/contracts";

interface Props {
  def: ReportDefinition;
}

export function DefinitionPanel({ def }: Props) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const json = JSON.stringify(def, null, 2);
  const lines = json.split("\n");

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    void message.success(t("ask.copied"));
  };

  return (
    <div data-testid="definition-panel">
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: "def",
            label: (
              <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                {t("ask.definitionTitle")}
              </span>
            ),
            extra: (
              <Tooltip title={t("ask.copyJson")}>
                <Button
                  size="small"
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copy();
                  }}
                />
              </Tooltip>
            ),
            children: (
              <motion.pre
                className="ask-def__code"
                initial="hidden"
                animate="show"
                variants={{
                  show: { transition: { staggerChildren: 0.012 } },
                }}
                style={{
                  maxHeight: 320,
                  overflow: "auto",
                  fontSize: 12,
                  direction: "ltr",
                  textAlign: "left",
                  background: token.colorFillQuaternary,
                  borderRadius: token.borderRadiusSM,
                  padding: "8px 12px",
                  margin: 0,
                  fontFamily: "monospace",
                  color: token.colorText,
                }}
              >
                {lines.map((ln, i) => (
                  <motion.div
                    key={i}
                    variants={{
                      hidden: { opacity: 0, y: 4 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    {ln || " "}
                  </motion.div>
                ))}
              </motion.pre>
            ),
          },
        ]}
      />
    </div>
  );
}
