(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "36547764-abe9-49aa-a88f-b1c76daa263e", e._sentryDebugIdIdentifier = "sentry-dbid-36547764-abe9-49aa-a88f-b1c76daa263e");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, Button as a, Checkbox as o, ChevronSortDown as ee, DataTableFooter as s, DataTableFrame as c, DataTableSort as l, SelectionDock as u, Table as d, TableColumnControls as f, TableColumnResizer as p, TableSelectionHeader as m, __toESM as h, cardClass as g, columnVisibilityFeature as _, createColumnHelper as v, flexRender as y, require_jsx_runtime as b, require_react as x, rowPaginationFeature as S, rowSelectionFeature as C, rowSortingFeature as w, t as T, tableFeatures as E, useTable as D, useTablePreferences as O } from "./peach-app.js";
import { createPaginatedRowModel as k, createSortedRowModel as A, useTableSelection as j } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/components/data-table.tsx
var M = /* @__PURE__ */ h(x(), 1), N = b(), P = E({
	rowSortingFeature: w,
	rowSelectionFeature: C,
	rowPaginationFeature: S,
	columnVisibilityFeature: _,
	sortedRowModel: A(),
	paginatedRowModel: k()
});
function F({ label: h, items: _, columns: b, rowId: x, rowLabel: S, selected: C, onSelected: w, actions: E, controls: k, title: A = h, titleId: F, description: I, footerActions: L, toolbarActions: R, panel: z = !0, unit: B = T("shell:dataTable.recordUnit") }) {
	let [V, H] = (0, M.useState)([]), U = (0, M.useMemo)(() => [{
		id: "select",
		label: T("shell:dataTable.selectColumn"),
		width: 48,
		min: 48,
		max: 48,
		required: !0
	}, ...b.map((e, t) => ({
		...e,
		width: e.width ?? (t === 0 ? 320 : 160),
		min: e.min ?? (t === 0 ? 320 : 96),
		flex: e.flex ?? t === 0,
		required: t === 0
	}))], [b]), W = O(`data:${h}`, U), [G, K] = (0, M.useState)({
		pageIndex: 0,
		pageSize: 20
	}), q = j(() => w([])), J = Math.max(1, Math.ceil(_.length / G.pageSize)), Y = Math.min(G.pageIndex, J - 1), X = Object.fromEntries(C.map((e) => [e, !0])), Z = (0, M.useMemo)(() => {
		let e = v();
		return e.columns([e.display({
			id: "select",
			header: ({ table: e }) => /* @__PURE__ */ (0, N.jsx)(m, {
				table: e,
				label: T("shell:dataTable.selectAll", { label: h })
			}),
			cell: ({ row: e }) => /* @__PURE__ */ (0, N.jsx)(o, {
				slot: null,
				"aria-label": T("shell:dataTable.selectRow", { name: S(e.original) }),
				isSelected: e.getIsSelected(),
				onChange: (t) => e.toggleSelected(t)
			})
		}), ...b.map((t) => e.accessor((e) => t.value?.(e) ?? "", {
			id: t.id,
			header: t.label,
			enableSorting: !!t.value,
			sortFn: (e, n) => {
				let r = t.value(e.original), i = t.value(n.original);
				return typeof r == "number" && typeof i == "number" ? r - i : String(r).localeCompare(String(i), "zh-CN", { numeric: !0 });
			},
			cell: ({ row: e }) => t.render(e.original)
		}))]);
	}, [
		b,
		h,
		S
	]), Q = D({
		features: P,
		data: _,
		columns: Z,
		getRowId: x,
		state: {
			sorting: V,
			rowSelection: X,
			pagination: {
				...G,
				pageIndex: Y
			},
			columnVisibility: W.visibility
		},
		onColumnVisibilityChange: W.change,
		onSortingChange: (e) => {
			H(e), K((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: K,
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(X) : e;
			Object.values(t).some(Boolean) && q(), w(_.filter((e) => t[x(e)]).map(x));
		}
	}), $ = Q.getSelectedRowModel().rows.map((e) => e.original);
	return /* @__PURE__ */ (0, N.jsxs)("div", {
		"data-data-table-panel": z || void 0,
		className: z ? g({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}) : "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, N.jsxs)("div", {
				"data-responsive-toolbar": "",
				role: "toolbar",
				"aria-label": T("shell:dataTable.toolbar", { label: h }),
				children: [/* @__PURE__ */ (0, N.jsxs)("div", {
					"data-toolbar-heading": "",
					children: [/* @__PURE__ */ (0, N.jsx)("h3", {
						id: F,
						className: "text-title-2-medium text-text-primary",
						children: A
					}), /* @__PURE__ */ (0, N.jsx)("span", {
						className: "text-body-2-regular tabular-nums text-text-secondary",
						children: `${_.length.toLocaleString()} ${B}`
					})]
				}), /* @__PURE__ */ (0, N.jsxs)("div", {
					"data-toolbar-actions": "",
					children: [
						R,
						/* @__PURE__ */ (0, N.jsx)(f, {
							preferences: W,
							label: h
						}),
						/* @__PURE__ */ (0, N.jsx)(l, {
							label: h,
							options: b.filter((e) => e.value).map((e) => ({
								id: e.id,
								label: e.label
							})),
							sorting: V,
							onChange: (e) => {
								H(e), K((e) => ({
									...e,
									pageIndex: 0
								}));
							}
						})
					]
				})]
			}),
			I ? /* @__PURE__ */ (0, N.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: I
			}) : null,
			/* @__PURE__ */ (0, N.jsxs)(u, {
				label: T("shell:dataTable.bulkActions", { label: h }),
				visible: $.length > 0,
				count: T("shell:dataTable.selectedCount", {
					count: $.length,
					unit: B
				}),
				actions: E($, () => w([])),
				children: [k?.($, () => w([])), /* @__PURE__ */ (0, N.jsx)(a, {
					variant: "ghost",
					size: "small",
					onClick: () => w([]),
					children: T("shell:dataTable.clearSelection")
				})]
			}),
			/* @__PURE__ */ (0, N.jsx)(c, {
				follow: !0,
				preferences: W,
				onRowClick: (e) => Q.getRow(e)?.toggleSelected(),
				children: /* @__PURE__ */ (0, N.jsxs)(d, {
					"aria-label": h,
					size: "sm",
					sortDescriptor: V[0] ? {
						column: V[0].id,
						direction: V[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => Q.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
					children: [/* @__PURE__ */ (0, N.jsxs)(i, { children: [Q.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, N.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === b[0].id,
						allowsSorting: e.column.getCanSort(),
						...W.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [/* @__PURE__ */ (0, N.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [y(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, N.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, N.jsx)(ee, {})
							}) : null]
						}), /* @__PURE__ */ (0, N.jsx)(p, {
							preferences: W,
							id: e.id
						})] })
					}, e.id)), /* @__PURE__ */ (0, N.jsx)(t, {
						id: "remaining-space",
						"aria-label": T("shell:dataTable.spacerColumn"),
						"data-table-space": "",
						width: W.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, N.jsx)(e, {
						renderEmptyState: () => T("shell:dataTable.empty"),
						children: Q.getRowModel().rows.map((e) => /* @__PURE__ */ (0, N.jsxs)(n, {
							id: e.id,
							"data-board-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, N.jsx)(r, { children: y(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, N.jsx)(r, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}),
			/* @__PURE__ */ (0, N.jsx)(s, {
				label: h,
				total: _.length,
				pagination: {
					...G,
					pageIndex: Y
				},
				onChange: K,
				unit: B
			}),
			L ? /* @__PURE__ */ (0, N.jsx)("div", {
				className: "flex flex-wrap items-center justify-end gap-2 border-t border-separator-border pt-4",
				children: L
			}) : null
		]
	});
}
export { F as DataTable };

//# debugId=36547764-abe9-49aa-a88f-b1c76daa263e