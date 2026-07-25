import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

it("shows description", () => {
  render(<EmptyState description="موردی یافت نشد" />);
  expect(screen.getByText("موردی یافت نشد")).toBeInTheDocument();
});

it("shows default description when none provided", () => {
  render(<EmptyState />);
  expect(screen.getByText("موردی یافت نشد")).toBeInTheDocument();
});
