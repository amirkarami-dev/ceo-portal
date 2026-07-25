import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { i18n } from "../../i18n";
import { SemanticModelList } from "./SemanticModelList";
// Read real models from registry — assertions use the actual field ids/types/roles.
import { salesModel, projectModel, financeModel } from "../../semantic/registry";

vi.mock("../../auth/useAuth", () => ({
  useAuth: () => ({
    roles: ["TenantAdmin"],
    isAdmin: true,
    ready: true,
    user: { id: "u", name: "Admin", email: "a@x.ir", tenantId: "global", roles: ["TenantAdmin"] },
    login() {},
    logout() {},
    can: () => true,
  }),
}));

// Mock useSemanticModels to return the 3 bundled models.
// The factory must not reference non-hoisted variables, so we
// inline the model objects via their IDs and let the SemanticModel
// type be satisfied by matching the registry shape.
vi.mock("../../api/queries", () => ({
  useSemanticModels: () => ({
    data: [
      {
        id: "model-sales",
        tenantId: "global",
        version: 1,
        defaultLocale: "fa-IR",
        name: { "fa-IR": "فروش", "en-US": "Sales" },
        entities: [
          {
            id: "sales",
            source: "sales",
            name: { "fa-IR": "سفارش فروش", "en-US": "Sales Order" },
            fields: [
              { id: "province", column: "province", type: "string", role: "dimension",
                label: { "fa-IR": "استان", "en-US": "Province" } },
              { id: "amount", column: "amount", type: "number", role: "measure",
                label: { "fa-IR": "درآمد", "en-US": "Revenue" }, defaultAggregation: "sum" },
              { id: "orderDate", column: "orderDate", type: "date", role: "date",
                label: { "fa-IR": "تاریخ سفارش", "en-US": "Order Date" } },
            ],
          },
        ],
      },
      {
        id: "model-project",
        tenantId: "global",
        version: 1,
        defaultLocale: "fa-IR",
        name: { "fa-IR": "پروژه‌ها", "en-US": "Projects" },
        entities: [
          {
            id: "project",
            source: "projects",
            name: { "fa-IR": "پروژه", "en-US": "Project" },
            fields: [
              { id: "name", column: "name", type: "string", role: "dimension",
                label: { "fa-IR": "نام پروژه", "en-US": "Project Name" } },
            ],
          },
        ],
      },
      {
        id: "model-finance",
        tenantId: "global",
        version: 1,
        defaultLocale: "fa-IR",
        name: { "fa-IR": "مالی", "en-US": "Finance" },
        entities: [
          {
            id: "finance",
            source: "finance",
            name: { "fa-IR": "تراکنش مالی", "en-US": "Financial Transaction" },
            fields: [
              { id: "amount", column: "amount", type: "number", role: "measure",
                label: { "fa-IR": "مبلغ", "en-US": "Amount" }, defaultAggregation: "sum" },
            ],
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

function wrap(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </MemoryRouter>,
  );
}

describe("SemanticModelList", () => {
  it("lists all 3 semantic models by their Persian names", () => {
    wrap(<SemanticModelList />);
    expect(screen.getByText("فروش")).toBeInTheDocument();      // Sales
    expect(screen.getByText("پروژه‌ها")).toBeInTheDocument(); // Projects
    expect(screen.getByText("مالی")).toBeInTheDocument();      // Finance
  });

  it("shows model ids as a column", () => {
    wrap(<SemanticModelList />);
    expect(screen.getByText("model-sales")).toBeInTheDocument();
    expect(screen.getByText("model-project")).toBeInTheDocument();
    expect(screen.getByText("model-finance")).toBeInTheDocument();
  });

  it("expands a model row and shows fields with measure/dimension tags", async () => {
    const user = userEvent.setup();
    wrap(<SemanticModelList />);

    // Expand the first row (Sales model)
    const expandBtns = screen.getAllByRole("button", { name: /expand row/i });
    await user.click(expandBtns[0]);

    // The sales model in our mock has fields: province (dimension), amount (measure), orderDate (date)
    // Assert measure tag for `amount` using the test-id pattern entityId.fieldId
    const amountKind = screen.getByTestId("field-kind-sales.amount");
    expect(amountKind).toHaveTextContent(/measure|اندازه/i);

    // Assert dimension tag for `province`
    const provinceKind = screen.getByTestId("field-kind-sales.province");
    expect(provinceKind).toHaveTextContent(/dimension|بُعد/i);

    // Verify the mocked data aligns with the real registry
    // (the registry's sales entity also has amount as measure and province as dimension)
    const realSalesEntity = salesModel.entities[0];
    expect(realSalesEntity.fields.find((f) => f.id === "amount")?.role).toBe("measure");
    expect(realSalesEntity.fields.find((f) => f.id === "province")?.role).toBe("dimension");
  });

  it("shows Revenue label (from the Sales entity)", async () => {
    const user = userEvent.setup();
    wrap(<SemanticModelList />);

    const expandBtns = screen.getAllByRole("button", { name: /expand row/i });
    await user.click(expandBtns[0]);

    // The mock field labels use the fa-IR name for amount = "درآمد"
    expect(screen.getByText("درآمد")).toBeInTheDocument();
  });
});

// Verify registry integrity (not a UI test — just ensures the models we reference are real).
describe("Registry integrity checks (task 20)", () => {
  it("salesModel has amount as measure and province as dimension", () => {
    const entity = salesModel.entities[0];
    expect(entity.fields.find((f) => f.id === "amount")?.role).toBe("measure");
    expect(entity.fields.find((f) => f.id === "province")?.role).toBe("dimension");
  });

  it("projectModel and financeModel are loaded from the registry", () => {
    expect(projectModel.id).toBe("model-project");
    expect(financeModel.id).toBe("model-finance");
  });
});
