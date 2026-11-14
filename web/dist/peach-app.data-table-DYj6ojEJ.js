(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "bd0b9919-f2c5-4495-beeb-0fbd327743fa", e._sentryDebugIdIdentifier = "sentry-dbid-bd0b9919-f2c5-4495-beeb-0fbd327743fa");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, Button as a, Checkbox as o, ChevronSortDown as s, DataTableFooter as ee, DataTableFrame as c, DataTableSort as l, SelectionDock as u, Table as d, TableColumnControls as f, TableColumnResizer as p, TableSelectionHeader as m, __toESM as h, cardClass as te, columnVisibilityFeature as g, createColumnHelper as _, enterPageSelection as v, exitPageSelection as y, flexRender as b, require_jsx_runtime as x, require_react as S, rowPaginationFeature as C, rowSelectionFeature as w, rowSortingFeature as T, t as E, tableFeatures as D, usePageSelection as O, useTable as k, useTablePreferences as ne } from "./peach-app.js";
import { createPaginatedRowModel as A, createSortedRowModel as j, useTableSelection as M } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/components/data-table.tsx
var N = /* @__PURE__ */ h(S(), 1), P = x(), F = D({
	rowSortingFeature: T,
	rowSelectionFeature: w,
	rowPaginationFeature: C,
	columnVisibilityFeature: g,
	sortedRowModel: j(),
	paginatedRowModel: A()
});
function I({ label: h, items: g, columns: x, rowId: S, rowLabel: C, selected: w, onSelected: T, actions: D, controls: A, title: j = h, titleId: I, description: L, footerActions: R, toolbarActions: z, panel: B = !0, unit: V = E("shell:dataTable.recordUnit") }) {
	let [H, U] = (0, N.useState)([]), W = (0, N.useMemo)(() => [{
		id: "select",
		label: E("shell:dataTable.selectColumn"),
		width: 48,
		min: 48,
		max: 48,
		required: !0
	}, ...x.map((e, t) => ({
		...e,
		width: e.width ?? (t === 0 ? 320 : 160),
		min: e.min ?? (t === 0 ? 320 : 96),
		flex: e.flex ?? t === 0,
		required: t === 0
	}))], [x]), G = ne(`data:${h}`, W), [K, q] = (0, N.useState)({
		pageIndex: 0,
		pageSize: 20
	}), J = M(() => T([]));
	O(() => T([])), (0, N.useEffect)(() => {
		w.length && v();
	}, [w.length]);
	let Y = Math.max(1, Math.ceil(g.length / K.pageSize)), X = Math.min(K.pageIndex, Y - 1), Z = Object.fromEntries(w.map((e) => [e, !0])), re = (0, N.useMemo)(() => {
		let e = _();
		return e.columns([e.display({
			id: "select",
			header: ({ table: e }) => /* @__PURE__ */ (0, P.jsx)(m, {
				table: e,
				label: E("shell:dataTable.selectAll", { label: h })
			}),
			cell: ({ row: e }) => /* @__PURE__ */ (0, P.jsx)(o, {
				slot: null,
				"aria-label": E("shell:dataTable.selectRow", { name: C(e.original) }),
				isSelected: e.getIsSelected(),
				onChange: (t) => e.toggleSelected(t)
			})
		}), ...x.map((t) => e.accessor((e) => t.value?.(e) ?? "", {
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
		x,
		h,
		C
	]), Q = k({
		features: F,
		data: g,
		columns: re,
		getRowId: S,
		state: {
			sorting: H,
			rowSelection: Z,
			pagination: {
				...K,
				pageIndex: X
			},
			columnVisibility: G.visibility
		},
		onColumnVisibilityChange: G.change,
		onSortingChange: (e) => {
			U(e), q((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: q,
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(Z) : e;
			Object.values(t).some(Boolean) && J(), T(g.filter((e) => t[S(e)]).map(S));
		}
	}), $ = Q.getSelectedRowModel().rows.map((e) => e.original);
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		"data-data-table-panel": B || void 0,
		className: B ? te({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}) : "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, P.jsxs)("div", {
				"data-responsive-toolbar": "",
				role: "toolbar",
				"aria-label": E("shell:dataTable.toolbar", { label: h }),
				children: [/* @__PURE__ */ (0, P.jsxs)("div", {
					"data-toolbar-heading": "",
					children: [/* @__PURE__ */ (0, P.jsx)("h3", {
						id: I,
						className: "text-title-2-medium text-text-primary",
						children: j
					}), /* @__PURE__ */ (0, P.jsx)("span", {
						className: "text-body-2-regular tabular-nums text-text-secondary",
						children: `${g.length.toLocaleString()} ${V}`
					})]
				}), /* @__PURE__ */ (0, P.jsxs)("div", {
					"data-toolbar-actions": "",
					children: [
						z,
						/* @__PURE__ */ (0, P.jsx)(f, {
							preferences: G,
							label: h
						}),
						/* @__PURE__ */ (0, P.jsx)(l, {
							label: h,
							options: x.filter((e) => e.value).map((e) => ({
								id: e.id,
								label: e.label
							})),
							sorting: H,
							onChange: (e) => {
								U(e), q((e) => ({
									...e,
									pageIndex: 0
								}));
							}
						})
					]
				})]
			}),
			L ? /* @__PURE__ */ (0, P.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: L
			}) : null,
			/* @__PURE__ */ (0, P.jsxs)(u, {
				label: E("shell:dataTable.bulkActions", { label: h }),
				visible: $.length > 0,
				count: E("shell:dataTable.selectedCount", {
					count: $.length,
					unit: V
				}),
				actions: D($, () => T([])),
				children: [A?.($, () => T([])), /* @__PURE__ */ (0, P.jsx)(a, {
					variant: "ghost",
					size: "small",
					onClick: () => {
						T([]), y();
					},
					children: E("shell:dataTable.clearSelection")
				})]
			}),
			/* @__PURE__ */ (0, P.jsx)(c, {
				follow: !0,
				preferences: G,
				onRowClick: (e) => Q.getRow(e)?.toggleSelected(),
				children: /* @__PURE__ */ (0, P.jsxs)(d, {
					"aria-label": h,
					size: "sm",
					sortDescriptor: H[0] ? {
						column: H[0].id,
						direction: H[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => Q.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
					children: [/* @__PURE__ */ (0, P.jsxs)(i, { children: [Q.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, P.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === x[0].id,
						allowsSorting: e.column.getCanSort(),
						...G.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [/* @__PURE__ */ (0, P.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [b(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, P.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, P.jsx)(s, {})
							}) : null]
						}), /* @__PURE__ */ (0, P.jsx)(p, {
							preferences: G,
							id: e.id
						})] })
					}, e.id)), /* @__PURE__ */ (0, P.jsx)(t, {
						id: "remaining-space",
						"aria-label": E("shell:dataTable.spacerColumn"),
						"data-table-space": "",
						width: G.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, P.jsx)(e, {
						renderEmptyState: () => E("shell:dataTable.empty"),
						children: Q.getRowModel().rows.map((e) => /* @__PURE__ */ (0, P.jsxs)(n, {
							id: e.id,
							"data-board-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, P.jsx)(r, { children: b(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, P.jsx)(r, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}),
			/* @__PURE__ */ (0, P.jsx)(ee, {
				label: h,
				total: g.length,
				pagination: {
					...K,
					pageIndex: X
				},
				onChange: q,
				unit: V
			}),
			R ? /* @__PURE__ */ (0, P.jsx)("div", {
				className: "flex flex-wrap items-center justify-end gap-2 border-t border-separator-border pt-4",
				children: R
			}) : null
		]
	});
}
export { I as DataTable };

//# debugId=bd0b9919-f2c5-4495-beeb-0fbd327743fa