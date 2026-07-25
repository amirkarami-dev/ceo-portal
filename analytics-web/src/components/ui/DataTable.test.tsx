import { render, screen } from "@testing-library/react";
import { DataTable } from "./DataTable";

it("shows empty state when no rows", () => {
  render(<DataTable rowKey="id" columns={[{ title: "نام", dataIndex: "name" }]} data={[]} />);
  expect(screen.getByText("موردی یافت نشد")).toBeInTheDocument();
});
