import { render, screen } from "@testing-library/react";
import { PageHeader } from "./PageHeader";

it("renders title and actions", () => {
  render(<PageHeader title="گزارش‌ها" actions={<button>جدید</button>} />);
  expect(screen.getByText("گزارش‌ها")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "جدید" })).toBeInTheDocument();
});

it("renders subtitle when provided", () => {
  render(<PageHeader title="داشبورد" subtitle="خلاصه وضعیت" />);
  expect(screen.getByText("خلاصه وضعیت")).toBeInTheDocument();
});
