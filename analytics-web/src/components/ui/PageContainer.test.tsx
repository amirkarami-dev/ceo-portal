import { render, screen } from "@testing-library/react";
import { PageContainer } from "./PageContainer";

it("renders children inside container", () => {
  render(<PageContainer><span>محتوا</span></PageContainer>);
  expect(screen.getByText("محتوا")).toBeInTheDocument();
});
