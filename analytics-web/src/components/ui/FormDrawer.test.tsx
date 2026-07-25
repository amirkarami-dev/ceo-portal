import { render, screen } from "@testing-library/react";
import { FormDrawer } from "./FormDrawer";
// Initialize i18n so useTranslation resolves keys (defaults to "fa" in test env)
import { i18n } from "../../i18n";

function noop() {}

describe("FormDrawer", () => {
  it("renders both Cancel and Save buttons by default", () => {
    render(
      <FormDrawer open title="تست" onClose={noop} onSubmit={noop}>
        <p>محتوا</p>
      </FormDrawer>,
    );
    expect(screen.getByRole("button", { name: i18n.t("common.cancel") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeInTheDocument();
  });

  it("renders only the Cancel button when hideSubmit is true", () => {
    render(
      <FormDrawer open title="تست" onClose={noop} hideSubmit>
        <p>محتوا</p>
      </FormDrawer>,
    );
    expect(screen.getByRole("button", { name: i18n.t("common.cancel") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: i18n.t("common.save") })).not.toBeInTheDocument();
  });

  it("does not render the Save button when hideSubmit is false (explicit false = normal)", () => {
    render(
      <FormDrawer open title="تست" onClose={noop} onSubmit={noop} hideSubmit={false}>
        <p>محتوا</p>
      </FormDrawer>,
    );
    expect(screen.getByRole("button", { name: i18n.t("common.save") })).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(
      <FormDrawer open title="تست" onClose={noop} onSubmit={noop}>
        <p data-testid="inner">درون‌مایه</p>
      </FormDrawer>,
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });
});
