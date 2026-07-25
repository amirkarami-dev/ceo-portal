import { Tag } from "antd";
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { LOG_STATUS_LABEL, RUN_STATUS_LABEL } from "../lib/types";
import type { MunLogStatus, MunRunStatus } from "../lib/types";

/** Run status → colored tag. "Running" shows a spinning icon as a live indicator. */
export function RunStatusTag({ status }: { status: MunRunStatus }) {
  if (status === "Running")
    return (
      <Tag icon={<SyncOutlined spin />} color="processing" style={{ marginInlineEnd: 0 }}>
        {RUN_STATUS_LABEL[status]}
      </Tag>
    );
  if (status === "Completed")
    return (
      <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginInlineEnd: 0 }}>
        {RUN_STATUS_LABEL[status]}
      </Tag>
    );
  return (
    <Tag icon={<CloseCircleOutlined />} color="error" style={{ marginInlineEnd: 0 }}>
      {RUN_STATUS_LABEL[status]}
    </Tag>
  );
}

/** Per-attempt log status → colored tag. */
export function LogStatusTag({ status }: { status: MunLogStatus }) {
  return status === "Success" ? (
    <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginInlineEnd: 0 }}>
      {LOG_STATUS_LABEL[status]}
    </Tag>
  ) : (
    <Tag icon={<CloseCircleOutlined />} color="error" style={{ marginInlineEnd: 0 }}>
      {LOG_STATUS_LABEL[status]}
    </Tag>
  );
}
