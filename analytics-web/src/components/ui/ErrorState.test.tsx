import { render, screen } from "@testing-library/react";
import { ErrorState } from "./ErrorState";

it("renders default error title", () => {
  render(<ErrorState />);
  expect(screen.getByText("خطایی رخ داد")).toBeInTheDocument();
});

it("renders retry button when onRetry provided", () => {
  render(<ErrorState onRetry={() => undefined} />);
  expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
});
