import { render, screen } from "@testing-library/react";
import { KpiTile } from "./KpiTile";

it("renders label and value", () => {
  render(<KpiTile label="کل پروژه‌ها" value="۱۷۱٬۰۶۸" />);
  expect(screen.getByText("کل پروژه‌ها")).toBeInTheDocument();
  expect(screen.getByText("۱۷۱٬۰۶۸")).toBeInTheDocument();
});
