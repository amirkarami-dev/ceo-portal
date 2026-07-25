// Dev-only harness for the Jalali date/time fields (route: /dev/pickers).
// Lets the pickers be exercised without the OIDC login; excluded from prod.
import { useState } from "react";
import { Card, Form, Space, Typography } from "antd";
import { JalaliDateField, TimeField } from "@/components/ui";

export function PickerHarness() {
  const [date, setDate] = useState("1405/05/01");
  const [time, setTime] = useState("08:00");
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <Card title="Jalali pickers (dev)">
        <Form layout="vertical">
          <Form.Item label="تاریخ (شمسی)">
            <JalaliDateField value={date} onChange={setDate} />
          </Form.Item>
          <Form.Item label="ساعت">
            <TimeField value={time} onChange={setTime} />
          </Form.Item>
        </Form>
        <Space direction="vertical">
          <Typography.Text data-testid="date-value">date: {date}</Typography.Text>
          <Typography.Text data-testid="time-value">time: {time}</Typography.Text>
        </Space>
      </Card>
    </div>
  );
}
