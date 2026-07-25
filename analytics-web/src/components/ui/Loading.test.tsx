import { render } from "@testing-library/react";
import { Loading } from "./Loading";

it("renders skeleton by default", () => {
  const { container } = render(<Loading />);
  // antd Skeleton renders elements with class ant-skeleton
  expect(container.querySelector(".ant-skeleton")).toBeInTheDocument();
});

it("renders spin when mode is spin", () => {
  const { container } = render(<Loading mode="spin" />);
  // antd Spin renders elements with class ant-spin
  expect(container.querySelector(".ant-spin")).toBeInTheDocument();
});
