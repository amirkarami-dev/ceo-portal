import { render, screen } from "@testing-library/react";
import { SectionCard } from "./SectionCard";

it("renders card with title and children", () => {
  render(<SectionCard title="بخش اول"><span>محتوای کارت</span></SectionCard>);
  expect(screen.getByText("بخش اول")).toBeInTheDocument();
  expect(screen.getByText("محتوای کارت")).toBeInTheDocument();
});
