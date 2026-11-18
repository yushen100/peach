(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "8111fe38-88b5-4d80-bcad-4cc16c15b945", e._sentryDebugIdIdentifier = "sentry-dbid-8111fe38-88b5-4d80-bcad-4cc16c15b945");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, ActivityStatus as a, Button as ee, Checkbox as o, ChevronSortDown as te, DataTableFooter as s, DataTableFrame as c, DataTableSort as ne, SelectionDock as l, Table as u, TableColumnControls as d, TableColumnResizer as re, TableSelectionHeader as ie, __toESM as f, cardClass as ae, columnVisibilityFeature as p, createColumnHelper as oe, enterPageSelection as se, exitPageSelection as m, flexRender as h, require_jsx_runtime as g, require_react as _, rowPaginationFeature as v, rowSelectionFeature as y, rowSelectionOperation as b, rowSortingFeature as x, runBulkAction as S, t as C, tableFeatures as w, usePageSelection as T, useRowWorkContext as ce, useTable as le, useTableFilters as ue, useTablePreferences as de } from "./peach-app.js";
import { createPaginatedRowModel as E, createSortedRowModel as D, useTableSelection as fe } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/components/data-table.tsx
var O = /* @__PURE__ */ f(_(), 1), k = g(), A = w({
	rowSortingFeature: x,
	rowSelectionFeature: y,
	rowPaginationFeature: v,
	columnVisibilityFeature: p,
	sortedRowModel: D(),
	paginatedRowModel: E()
});
function j({ label: f, items: p, columns: g, rowId: _, rowLabel: v, selected: y, onSelected: x, actions: w, controls: E, title: D = f, titleId: j, description: M, footerActions: N, toolbarActions: P, panel: F = !0, unit: I = C("shell:dataTable.recordUnit"), filters: L, busy: R, contextOperations: z }) {
	let [B, V] = (0, O.useState)([]), pe = (0, O.useMemo)(() => [{
		id: "select",
		label: C("shell:dataTable.selectColumn"),
		width: 48,
		min: 48,
		max: 48,
		required: !0
	}, ...g.map((e, t) => ({
		...e,
		width: e.width ?? (t === 0 ? 320 : 160),
		min: e.min ?? (t === 0 ? 320 : 96),
		flex: e.flex ?? t === 0,
		required: t === 0
	}))], [g]), H = de(`data:${f}`, pe), [U, W] = (0, O.useState)({
		pageIndex: 0,
		pageSize: 20
	}), G = ue(p, Object.fromEntries(g.filter((e) => e.filter).map((e) => [e.id, e.filter])), () => W((e) => ({
		...e,
		pageIndex: 0
	})), L), [K, me] = (0, O.useState)([]), q = new Map((L ? [...K, ...p] : p).map((e) => [_(e), e])), J = fe(() => x([]));
	T(() => x([])), (0, O.useEffect)(() => {
		y.length && se();
	}, [y.length]);
	let he = Math.max(1, Math.ceil(G.items.length / U.pageSize)), Y = Math.min(U.pageIndex, he - 1), X = Object.fromEntries(y.map((e) => [e, !0])), ge = (0, O.useMemo)(() => {
		let e = oe();
		return e.columns([e.display({
			id: "select",
			header: ({ table: e }) => /* @__PURE__ */ (0, k.jsx)(ie, {
				table: e,
				label: C("shell:dataTable.selectAll", { label: f }),
				disabled: R
			}),
			cell: ({ row: e }) => /* @__PURE__ */ (0, k.jsx)(o, {
				slot: null,
				"aria-label": C("shell:dataTable.selectRow", { name: v(e.original) }),
				isSelected: e.getIsSelected(),
				onChange: (t) => e.toggleSelected(t)
			})
		}), ...g.map((t) => e.accessor((e) => t.value?.(e) ?? "", {
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
		g,
		f,
		v,
		R
	]), Z = le({
		features: A,
		data: G.items,
		columns: ge,
		getRowId: _,
		state: {
			sorting: B,
			rowSelection: X,
			pagination: {
				...U,
				pageIndex: Y
			},
			columnVisibility: H.visibility
		},
		onColumnVisibilityChange: H.change,
		onSortingChange: (e) => {
			V(e), W((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: W,
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(X) : e;
			Object.values(t).some(Boolean) && J(), x([...q.values()].filter((e) => t[_(e)]).map(_));
		}
	}), Q = ce((e) => q.get(e), R ? void 0 : (e) => {
		let t = _(e), n = w([e], () => Z.setRowSelection(({ [t]: e, ...n }) => n)).flatMap(({ rowAction: e, action: t, host: n, items: r, disabled: i, done: a }) => e && r.length ? [{
			...e,
			id: t.key,
			danger: t.danger,
			disabled: i,
			run: async () => {
				await S(t, r, n) && a?.();
			}
		}] : []);
		return [
			...z?.(e) ?? [],
			b(!!X[t], () => Z.getRow(t)?.toggleSelected()),
			...n
		];
	}), $ = y.flatMap((e) => {
		let t = q.get(e);
		return t ? [t] : [];
	});
	return (0, O.useEffect)(() => {
		(K.length !== $.length || K.some((e, t) => e !== $[t])) && me($);
	}, [$, K]), /* @__PURE__ */ (0, k.jsxs)("div", {
		"data-data-table-panel": F || void 0,
		"aria-busy": R || void 0,
		className: F ? ae({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}) : "flex min-w-0 flex-col gap-4",
		onKeyDown: Q.onKeyDown,
		children: [
			Q.menu,
			/* @__PURE__ */ (0, k.jsxs)("div", {
				"data-responsive-toolbar": "",
				role: "toolbar",
				"aria-label": C("shell:dataTable.toolbar", { label: f }),
				children: [/* @__PURE__ */ (0, k.jsxs)("div", {
					"data-toolbar-heading": "",
					children: [/* @__PURE__ */ (0, k.jsx)("h3", {
						id: j,
						className: "text-title-2-medium text-text-primary",
						children: D
					}), /* @__PURE__ */ (0, k.jsx)("span", {
						className: "text-body-2-regular tabular-nums text-text-secondary",
						children: `${G.items.length.toLocaleString()} ${I}`
					})]
				}), /* @__PURE__ */ (0, k.jsxs)("div", {
					"data-toolbar-actions": "",
					children: [
						P,
						/* @__PURE__ */ (0, k.jsx)(d, {
							preferences: H,
							label: f
						}),
						/* @__PURE__ */ (0, k.jsx)(ne, {
							label: f,
							options: g.filter((e) => e.value).map((e) => ({
								id: e.id,
								label: e.label
							})),
							sorting: B,
							onChange: (e) => {
								V(e), W((e) => ({
									...e,
									pageIndex: 0
								}));
							}
						})
					]
				})]
			}),
			M ? /* @__PURE__ */ (0, k.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: M
			}) : null,
			/* @__PURE__ */ (0, k.jsxs)(l, {
				label: C("shell:dataTable.bulkActions", { label: f }),
				visible: $.length > 0,
				count: C("shell:dataTable.selectedCount", {
					count: $.length,
					unit: I
				}),
				actions: w($, () => x([])),
				children: [E?.($, () => x([])), /* @__PURE__ */ (0, k.jsx)(ee, {
					variant: "ghost",
					size: "small",
					onClick: () => {
						x([]), m();
					},
					children: C("shell:dataTable.clearSelection")
				})]
			}),
			/* @__PURE__ */ (0, k.jsx)(c, {
				follow: !0,
				preferences: H,
				onRowClick: (e) => Z.getRow(e)?.toggleSelected(),
				children: /* @__PURE__ */ (0, k.jsxs)(u, {
					"aria-label": f,
					size: "sm",
					sortDescriptor: B[0] ? {
						column: B[0].id,
						direction: B[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => Z.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
					children: [/* @__PURE__ */ (0, k.jsxs)(i, { children: [Z.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, k.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === g[0].id,
						allowsSorting: e.column.getCanSort(),
						...H.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, k.jsxs)(k.Fragment, { children: [/* @__PURE__ */ (0, k.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [G.header(e.id, String(e.column.columnDef.header)) ?? h(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, k.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, k.jsx)(te, {})
							}) : null]
						}), /* @__PURE__ */ (0, k.jsx)(re, {
							preferences: H,
							id: e.id
						})] })
					}, e.id)), /* @__PURE__ */ (0, k.jsx)(t, {
						id: "remaining-space",
						"aria-label": C("shell:dataTable.spacerColumn"),
						"data-table-space": "",
						width: H.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, k.jsx)(e, {
						renderEmptyState: () => R ? null : C("shell:dataTable.empty"),
						children: (R ? [] : Z.getRowModel().rows).map((e) => /* @__PURE__ */ (0, k.jsxs)(n, {
							id: e.id,
							"data-board-selected": e.getIsSelected() || void 0,
							"data-work-context-row": e.id,
							onContextMenu: Q.onContextMenu ? (t) => Q.onContextMenu?.(t, e.original, e.id) : void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, k.jsx)(r, { children: h(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, k.jsx)(r, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}),
			R ? /* @__PURE__ */ (0, k.jsx)(a, {
				kind: "linear-dots",
				label: C("shell:spinner.loading")
			}) : null,
			/* @__PURE__ */ (0, k.jsx)(s, {
				label: f,
				total: G.items.length,
				pagination: {
					...U,
					pageIndex: Y
				},
				onChange: W,
				unit: I
			}),
			N ? /* @__PURE__ */ (0, k.jsx)("div", {
				className: "flex flex-wrap items-center justify-end gap-2 border-t border-separator-border pt-4",
				children: N
			}) : null
		]
	});
}
export { j as DataTable };

//# debugId=8111fe38-88b5-4d80-bcad-4cc16c15b945