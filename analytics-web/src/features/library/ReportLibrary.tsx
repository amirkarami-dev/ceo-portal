// report-web/src/features/library/ReportLibrary.tsx
import { Button, Dropdown, Grid, Input, Pagination, Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/presentation/format";
import { labelLocaleOf, resolveReportTitle } from "@/presentation/labels";
import { Link, useNavigate } from "react-router-dom";
import type { SavedReport } from "@/api/queries";
import { useDeleteReport, useReports } from "@/api/queries";
import { useAuth } from "@/auth/useAuth";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  PageContainer,
  PageHeader,
  Toolbar,
} from "@/components/ui";
import { reportOwnerLabel } from "./report-display";
import "./reports.css";

/** The table and the card list must agree, or one of them silently drops rows. */
const PAGE_SIZE = 12;

export function ReportLibrary() {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === "rtl";
  const navigate = useNavigate();
  const { roles, user } = useAuth();
  const { data, isLoading, isError, refetch } = useReports();
  const del = useDeleteReport();
  const [q, setQ] = useState("");
  const [model, setModel] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const screens = Grid.useBreakpoint();

  const canManage =
    roles.includes("ReportDesigner") ||
    roles.includes("TenantAdmin") ||
    roles.includes("SuperAdmin");

  /**
   * The title a reader sees, which is not always `definition.name`.
   *
   * Renaming a report in the viewer writes `titleOverrides[locale]` and deliberately leaves `name`
   * alone — `name` is the neutral original the server keeps in its own column, and overwriting it
   * would push one language's wording onto every reader. The consequence nobody noticed: this list
   * read `name` directly, so a report renamed on its own page kept its old title here.
   */
  const locale = labelLocaleOf(i18n.language);
  const titleOf = useCallback(
    (r: SavedReport) => resolveReportTitle(r.definition, locale),
    [locale],
  );

  const rows = useMemo(() => {
    const all = data ?? [];
    const needle = q.trim().toLowerCase();
    return all.filter((r) => {
      const d = r.definition;
      // Searching matches what is on screen. Filtering on `name` while showing the override meant
      // typing the title you could see returned nothing.
      const shown = resolveReportTitle(d, locale).toLowerCase();
      if (needle && !shown.includes(needle) && !(d.description ?? "").toLowerCase().includes(needle))
        return false;
      if (model && d.dataset !== model) return false;
      if (tag && !(d.tags ?? []).includes(tag)) return false;
      return true;
    });
  }, [data, q, model, tag, locale]);

  const allModels = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.definition.dataset))),
    [data],
  );
  const allTags = useMemo(
    () => Array.from(new Set((data ?? []).flatMap((r) => r.definition.tags ?? []))),
    [data],
  );

  // One definition for the ⋮ menu. The table column and the card both open it, and a
  // menu that means "what you can do with this report" should not be able to say two
  // different things depending on how wide the window is.
  const actionsFor = (r: SavedReport): MenuProps["items"] => [
    { key: "run", label: t("library.run"), onClick: () => navigate(`/reports/${r.id}`) },
    ...(canManage
      ? [
          {
            key: "edit",
            label: t("library.edit"),
            onClick: () => navigate(`/ask?from=${r.id}`),
          },
          { type: "divider" as const },
          {
            key: "delete",
            label: t("library.delete"),
            danger: true,
            onClick: () => void del.mutate(r.id),
          },
        ]
      : []),
  ];

  const columns: ColumnsType<SavedReport> = [
    {
      title: t("library.colName"),
      dataIndex: ["definition", "name"],
      // Sorted by what is displayed, so the order matches the column a reader is looking at.
      sorter: (a, b) => titleOf(a).localeCompare(titleOf(b)),
      render: (_v, r) => <Link to={`/reports/${r.id}`}>{titleOf(r)}</Link>,
    },
    {
      title: t("library.colOwner"),
      dataIndex: "ownerName",
      render: (owner: string | undefined) =>
        reportOwnerLabel(owner, user, t("library.organizationUser")),
    },
    { title: t("library.colModel"), dataIndex: ["definition", "dataset"] },
    {
      title: t("library.colTags"),
      dataIndex: ["definition", "tags"],
      render: (tags: string[] = []) => tags.map((x) => <Tag key={x}>{x}</Tag>),
    },
    {
      title: t("library.colVisibility"),
      dataIndex: "visibility",
      render: (v: string) => (
        <Tag color={v === "tenant" ? "blue" : "default"}>{t(`library.vis.${v}`)}</Tag>
      ),
    },
    {
      title: t("library.colLastRun"),
      dataIndex: "lastRunAt",
      sorter: (a, b) => (a.lastRunAt ?? "").localeCompare(b.lastRunAt ?? ""),
      render: (v?: string) => (v ? formatDateTime(v, rtl ? "rtl" : "ltr") : "—"),
    },
    {
      title: "",
      key: "actions",
      width: 56,
      render: (_v, r) => (
        <Dropdown trigger={["click"]} menu={{ items: actionsFor(r) }}>
          <Button type="text" icon={<MoreOutlined />} aria-label={t("library.actions")} />
        </Dropdown>
      ),
    },
  ];

  if (isLoading) return <Loading rows={6} />;
  if (isError)
    return (
      <ErrorState
        title={t("library.loadError")}
        onRetry={() => void refetch()}
      />
    );

  const toolbar = (
    <Toolbar>
      {/* On a phone each of these lands on its own row anyway, so a fixed 160px just
          leaves half the row empty — they take the width they are given instead. */}
      <div className="reports-toolbar">
        <Input.Search
          allowClear
          // antd's own 16px input. Below that iOS zooms the page on tap and does not
          // zoom back; the CSS route loses to antd's injected rules.
          size="large"
          placeholder={t("library.searchPlaceholder")}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          allowClear
          size="large"
          placeholder={t("library.filterModel")}
          value={model}
          onChange={setModel}
          options={allModels.map((m) => ({ value: m, label: m }))}
        />
        <Select
          allowClear
          size="large"
          placeholder={t("library.filterTag")}
          value={tag}
          onChange={setTag}
          options={allTags.map((x) => ({ value: x, label: x }))}
        />
      </div>
    </Toolbar>
  );

  const emptyNode = (
    <EmptyState
      description={t("library.empty")}
      action={
        <Button type="primary" onClick={() => navigate("/ask")}>
          {t("library.askFirst")}
        </Button>
      }
    />
  );

  // A card per report on a phone. Six attributes across a 375px screen gives every
  // column a sliver — the name, the one thing every row is really about, was getting
  // 67px while an empty tags column took 73. A card gives the name the whole width and
  // simply omits the fields that have no value.
  //
  // `=== false` rather than `!screens.md`: useBreakpoint answers {} on the first render,
  // and `!undefined` is true, which would flash the card list on a desktop load.
  const phone = screens.md === false;

  // Clamped, not reset. Filter down to one match while on page 3 and the slice was
  // empty — no cards, no empty state, just a blank page. Deleting the last report on
  // the final page does the same thing, so the guard belongs on the page number rather
  // than on a filter-changed effect that would only cover one of the two causes.
  const lastPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, lastPage);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cardList = (
    <>
      {toolbar}
      {rows.length === 0 ? (
        emptyNode
      ) : (
        <>
          <ul className="report-cards">
            {paged.map((r) => (
              <li key={r.id} className="report-card" data-testid="report-row" data-id={r.id}>
                <span className="report-card__accent" aria-hidden />
                <Link to={`/reports/${r.id}`} className="report-card__open">
                  <span className="report-card__name">{titleOf(r)}</span>
                  <span className="report-card__meta">
                    {reportOwnerLabel(r.ownerName, user, t("library.organizationUser"))}
                    {" · "}
                    {r.definition.dataset}
                  </span>
                  <span className="report-card__tags">
                    <Tag color={r.visibility === "tenant" ? "blue" : "default"}>
                      {t(`library.vis.${r.visibility}`)}
                    </Tag>
                    {(r.definition.tags ?? []).map((x: string) => (
                      <Tag key={x}>{x}</Tag>
                    ))}
                    {r.lastRunAt && (
                      <span className="report-card__run">
                        {t("library.colLastRun")}: {formatDateTime(r.lastRunAt, rtl ? "rtl" : "ltr")}
                      </span>
                    )}
                  </span>
                </Link>
                {/* A sibling, not a child of the Link — a button inside an anchor is
                    invalid and the whole card would become one confused target. */}
                <Dropdown trigger={["click"]} menu={{ items: actionsFor(r) }}>
                  <Button
                    type="text"
                    className="report-card__menu"
                    icon={<MoreOutlined />}
                    aria-label={t("library.actions")}
                  />
                </Dropdown>
              </li>
            ))}
          </ul>
          {/* The table pages at 12; the cards must too, or a long list silently stops. */}
          {rows.length > PAGE_SIZE && (
            <Pagination
              className="report-cards__pager"
              current={safePage}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onChange={setPage}
              showSizeChanger={false}
              align="center"
            />
          )}
        </>
      )}
    </>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t("reports.title")}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/ask")}
          >
            {t("library.newReport")}
          </Button>
        }
      />
      {phone ? (
        cardList
      ) : (
        <DataTable<SavedReport>
          rowKey="id"
          columns={columns}
          data={rows}
          toolbar={toolbar}
          empty={emptyNode}
          pageSize={PAGE_SIZE}
          onRow={(r) => ({ "data-testid": "report-row", "data-id": r.id })}
        />
      )}
    </PageContainer>
  );
}
