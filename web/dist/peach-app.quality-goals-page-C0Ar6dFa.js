(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "be80fa36-f9ec-414c-b227-81ec8a8d2500", e._sentryDebugIdIdentifier = "sentry-dbid-be80fa36-f9ec-414c-b227-81ec8a8d2500");
	} catch {}
})();
import { Button as e, CardTags as t, CatalogViewToggle as n, CloudDownloadDialog as r, EmptyState as i, FilterGlassRows as a, Icon as o, LOC as s, ListLibrary as c, Note as l, OA as u, QUALITY_GOALS_KEY as d, QueueIdentity as f, QueuePicture as p, QueueTable as m, SelectAllButton as h, SelectionDock as g, SortKeys as _, __toESM as v, enterPageSelection as y, errorMessage as b, exitPageSelection as ee, fetchQualityGoals as te, fmtDur as x, fmtSize as S, previewUrl as C, providerIcon as w, queueContentSkeletonHtml as T, require_jsx_runtime as E, require_react as D, t as O, useCatalogView as ne, useDense as k, useLibraryTints as A, usePageSelection as j, useQuery as M, useQueueSort as N } from "./peach-app.js";
import { Page as P } from "./peach-app.page-QAncjzM1.js";
import { JavBatchResources as F } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
// src/react/quality-goals/quality-goals-page.tsx
var I = /* @__PURE__ */ v(D(), 1), L = E(), R = (e) => (e || "").split(/\s*\/\s*/).map((e) => e.trim()).filter(Boolean);
function z({ item: n, openItem: r, searchResources: i, javTitleHtml: a, javDisplayName: l, srcBadge: u, picked: d, onPick: f, selecting: p }) {
	let m = k(), [h, g] = (0, I.useState)(!1), _ = () => r(n.id), v = l(n), y = A(), b = n.library_id && y.get(n.library_id)?.color ? n.library_id : void 0;
	return /* @__PURE__ */ (0, L.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-queue-card": "",
		"data-goal-id": n.id,
		"data-library": b,
		"data-selected": d ? "" : void 0,
		onClickCapture: (e) => {
			(p || e.shiftKey || e.ctrlKey || e.metaKey) && (e.preventDefault(), e.stopPropagation(), f(!d));
		},
		children: [
			/* @__PURE__ */ (0, L.jsxs)("button", {
				type: "button",
				"data-media-pic": "",
				onClick: _,
				"aria-label": O("manage:hdUpgrades.openVideo", { title: v }),
				style: { "--card-ratio": "1.7777777777777777" },
				children: [
					h ? /* @__PURE__ */ (0, L.jsx)("span", {
						"data-media-nopic": "",
						children: O("manage:hdUpgrades.noPreview")
					}) : /* @__PURE__ */ (0, L.jsx)("span", {
						"data-media-art": "thumb",
						children: /* @__PURE__ */ (0, L.jsx)("img", {
							className: "absolute inset-0 size-full object-contain",
							src: C(n),
							alt: "",
							loading: "lazy",
							"data-goal-cover": "",
							onError: () => g(!0)
						})
					}),
					/* @__PURE__ */ (0, L.jsx)("span", {
						"data-media-badge": "",
						dangerouslySetInnerHTML: { __html: u(n.location, n.cost) }
					}),
					Number(n.duration) > 0 ? /* @__PURE__ */ (0, L.jsx)("span", {
						"data-media-duration": "",
						children: x(n.duration)
					}) : null,
					/* @__PURE__ */ (0, L.jsx)("span", {
						"data-media-check": "",
						children: /* @__PURE__ */ (0, L.jsx)(o, { name: "check" })
					})
				]
			}),
			/* @__PURE__ */ (0, L.jsx)("div", {
				"data-media-meta": "",
				children: /* @__PURE__ */ (0, L.jsxs)("div", {
					"data-media-text": "",
					children: [
						/* @__PURE__ */ (0, L.jsx)("button", {
							type: "button",
							"data-media-title": "",
							onClick: _,
							title: v,
							dangerouslySetInnerHTML: { __html: a(n) }
						}),
						/* @__PURE__ */ (0, L.jsxs)("div", {
							"data-media-byline": "",
							children: [/* @__PURE__ */ (0, L.jsx)("span", {
								"data-media-who": "",
								children: n.library_id ? /* @__PURE__ */ (0, L.jsx)(c, { item: n }) : s[n.location] ?? n.location
							}), /* @__PURE__ */ (0, L.jsx)("span", {
								"data-media-facts": "",
								children: /* @__PURE__ */ (0, L.jsxs)("span", {
									"data-media-size": "",
									children: [/* @__PURE__ */ (0, L.jsx)(o, { name: "hard-drive" }), Number(n.size) > 0 ? S(Number(n.size)) : O("manage:hdUpgrades.unknownSize")]
								})
							})]
						}),
						/* @__PURE__ */ (0, L.jsx)(t, {
							tags: R(n.reason),
							label: (e) => e,
							readOnly: !0,
							title: n.reason || void 0
						})
					]
				})
			}),
			/* @__PURE__ */ (0, L.jsxs)("div", {
				"data-jav-actions": "",
				className: "flex flex-wrap gap-2",
				children: [n.code ? /* @__PURE__ */ (0, L.jsx)(e, {
					variant: "secondary",
					size: m ? "small" : "medium",
					onClick: () => i({
						code: n.code,
						title: v,
						origin: `asset:${n.id}`,
						searchReason: n.reason || "",
						duration: n.duration,
						cover: C(n)
					}),
					children: O("manage:resourceSearch.searchTorrents")
				}) : null, /* @__PURE__ */ (0, L.jsx)(e, {
					variant: "secondary",
					size: m ? "small" : "medium",
					onClick: _,
					children: O("manage:hdUpgrades.viewEditions")
				})]
			})
		]
	});
}
function B({ toast: t, ...o }) {
	let [v, E] = (0, I.useState)(null), [D, k] = (0, I.useState)(/* @__PURE__ */ new Map()), A = j(() => k(/* @__PURE__ */ new Map())), [B, V] = (0, I.useState)(null), H = ne(), [U, re] = (0, I.useState)({}), W = H === "list" ? U : {}, G = JSON.stringify(W), K = M({
		queryKey: G === "{}" ? d : [...d, G],
		queryFn: ({ signal: e }) => te(e, G === "{}" ? void 0 : W),
		placeholderData: (e) => e
	}), q = N("quality-goals", {
		size: (e) => Number(e.size || 0),
		dur: (e) => Number(e.duration || 0),
		new: (e) => e.id
	}), J = K.data;
	if (K.isPending) return /* @__PURE__ */ (0, L.jsx)(P, { children: /* @__PURE__ */ (0, L.jsx)("div", { dangerouslySetInnerHTML: { __html: T("quality-goals", O("shell:spinner.loading"), ["w-20", "w-24"]) } }) });
	if (!J) return /* @__PURE__ */ (0, L.jsx)(P, { children: /* @__PURE__ */ (0, L.jsx)(l, {
		tone: "error",
		title: O("manage:hdUpgrades.loadFailed"),
		children: K.error ? b(K.error) : O("manage:hdUpgrades.notFound")
	}) });
	let Y = q.sort(J.items || []);
	if (!Y.length && H !== "list") return /* @__PURE__ */ (0, L.jsx)(P, { children: /* @__PURE__ */ (0, L.jsx)(i, {
		icon: u,
		title: O("manage:hdUpgrades.emptyTitle"),
		children: O("manage:hdUpgrades.emptyBody")
	}) });
	let X = [...D.values()], Z = X.filter((e) => e.code), Q = (e) => {
		K.isFetching || K.isError || (e && y(), k((t) => {
			let n = new Map(t);
			for (let t of Y) e ? n.set(t.id, t) : n.delete(t.id);
			return n;
		}));
	}, $ = (e, t) => {
		t && y(), k((n) => {
			let r = new Map(n), i = Y.find((t) => t.id === e);
			return t && i ? r.set(e, i) : r.delete(e), r;
		});
	};
	return /* @__PURE__ */ (0, L.jsxs)("div", {
		"data-quality-goals": "",
		className: "mx-auto w-full max-w-board",
		children: [
			/* @__PURE__ */ (0, L.jsx)(a, {
				label: O("manage:hdUpgrades.summaryLabel"),
				topLabel: O("manage:hdUpgrades.summaryLabel"),
				top: null,
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": ""
				},
				bottomClassName: "min-h-12",
				bottom: /* @__PURE__ */ (0, L.jsxs)(L.Fragment, { children: [/* @__PURE__ */ (0, L.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, L.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							O("manage:hdUpgrades.summaryLabel"),
							" · ",
							O("manage:hdUpgrades.videoCount", { count: Number(J.total || 0) })
						]
					}), /* @__PURE__ */ (0, L.jsx)(h, {
						label: O("manage:hdUpgrades.selectAll"),
						picked: Y.filter((e) => D.has(e.id)).length,
						total: Y.length,
						onChange: Q
					})]
				}), /* @__PURE__ */ (0, L.jsxs)("span", {
					"data-entity-sorts": "",
					children: [/* @__PURE__ */ (0, L.jsx)(n, {}), /* @__PURE__ */ (0, L.jsx)(_, {
						sorts: q.sorts,
						onSort: q.onSort
					})]
				})] })
			}),
			H === "list" ? /* @__PURE__ */ (0, L.jsx)(m, {
				table: "quality-goals",
				label: O("manage:hdUpgrades.summaryLabel"),
				items: Y,
				selected: new Set(D.keys()),
				selecting: A,
				busy: K.isFetching,
				filters: {
					values: W,
					facets: J.column_facets ?? {},
					onChange: re
				},
				filterColumns: {
					source: {
						values: (e) => e.location,
						option: (e) => {
							let t = w(e);
							return {
								label: s[e] || e,
								leading: /* @__PURE__ */ (0, L.jsx)(t, {})
							};
						}
					},
					reason: {
						values: (e) => R(e.reason),
						option: (e) => ({ label: e === "none" ? O("cleanup:shared.none") : e })
					}
				},
				sort: {
					options: q.sorts.map(({ key: e, label: t }) => ({
						id: e,
						label: t
					})),
					sorting: q.sorting,
					onChange: q.setSorting
				},
				rowLabel: (e) => O("manage:hdUpgrades.selectVideo", { title: o.javDisplayName(e) }),
				onPick: (e, t) => $(e.id, t),
				onPickAll: Q,
				cells: {
					name: (e) => /* @__PURE__ */ (0, L.jsx)(f, {
						name: o.javDisplayName(e),
						onOpen: () => o.openItem(e.id),
						picture: /* @__PURE__ */ (0, L.jsx)(p, {
							src: C(e),
							glyph: "film"
						})
					}),
					library: (e) => /* @__PURE__ */ (0, L.jsx)(c, { item: e }),
					source: (e) => /* @__PURE__ */ (0, L.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, L.jsx)("span", {
							className: "contents",
							dangerouslySetInnerHTML: { __html: o.srcBadge(e.location, e.cost) }
						}), s[e.location] ?? e.location]
					}),
					dur: (e) => x(e.duration) || "—",
					size: (e) => Number(e.size) > 0 ? S(Number(e.size)) : "—",
					reason: (e) => e.reason || "—",
					actions: (t) => /* @__PURE__ */ (0, L.jsxs)("span", {
						className: "flex gap-2",
						children: [t.code ? /* @__PURE__ */ (0, L.jsx)(e, {
							variant: "secondary",
							size: "small",
							onClick: () => E({
								code: t.code,
								title: o.javDisplayName(t),
								origin: `asset:${t.id}`,
								searchReason: t.reason || "",
								duration: t.duration,
								cover: C(t)
							}),
							children: O("manage:resourceSearch.searchTorrents")
						}) : null, /* @__PURE__ */ (0, L.jsx)(e, {
							variant: "secondary",
							size: "small",
							onClick: () => o.openItem(t.id),
							children: O("manage:hdUpgrades.viewEditions")
						})]
					})
				}
			}) : /* @__PURE__ */ (0, L.jsx)("div", {
				"data-media-grid": "",
				"data-select-mode": A ? "" : void 0,
				children: Y.map((e) => /* @__PURE__ */ (0, L.jsx)(z, {
					item: e,
					...o,
					searchResources: E,
					picked: D.has(e.id),
					onPick: (t) => $(e.id, t),
					selecting: A
				}, e.id))
			}),
			/* @__PURE__ */ (0, L.jsxs)(g, {
				visible: X.length > 0,
				label: O("manage:hdUpgrades.dockLabel"),
				count: O("manage:hdUpgrades.selectedCount", { count: X.length }),
				actions: [],
				children: [/* @__PURE__ */ (0, L.jsx)(e, {
					size: "small",
					variant: "secondary",
					disabled: !Z.length,
					onClick: () => V(Z.map((e) => ({
						id: e.id,
						code: e.code,
						title: o.javDisplayName(e),
						release_date: void 0
					}))),
					children: O("manage:resourceSearch.searchTorrents")
				}), /* @__PURE__ */ (0, L.jsx)(e, {
					size: "small",
					variant: "ghost",
					onClick: ee,
					children: O("manage:hdUpgrades.clearSelection")
				})]
			}),
			/* @__PURE__ */ (0, L.jsx)(F, {
				items: B,
				close: () => V(null),
				readOnly: !1,
				receipt: t
			}),
			K.isError ? /* @__PURE__ */ (0, L.jsx)(l, {
				tone: "error",
				children: b(K.error)
			}) : null,
			Number(J.total || 0) > Y.length ? /* @__PURE__ */ (0, L.jsx)("p", {
				className: "mt-6 text-center text-caption-1-regular text-text-secondary",
				children: O("manage:hdUpgrades.showingFirst", {
					shown: Y.length.toLocaleString(),
					count: Number(J.total)
				})
			}) : null,
			/* @__PURE__ */ (0, L.jsx)(r, {
				prefill: v,
				close: () => E(null),
				receipt: t
			})
		]
	});
}
export { B as QualityGoalsPage };

//# debugId=be80fa36-f9ec-414c-b227-81ec8a8d2500