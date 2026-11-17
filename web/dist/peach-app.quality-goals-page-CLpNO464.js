(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "84ed5508-e91c-4fcc-8fe6-fceb811fac33", e._sentryDebugIdIdentifier = "sentry-dbid-84ed5508-e91c-4fcc-8fe6-fceb811fac33");
	} catch {}
})();
import { Button as e, CardTags as t, CatalogViewToggle as n, CloudDownloadDialog as r, EmptyState as i, FilterGlassRows as a, Icon as o, LOC as s, ListLibrary as c, Note as l, OA as u, QUALITY_GOALS_KEY as d, QueueIdentity as f, QueuePicture as p, QueueTable as m, SelectAllButton as h, SelectionDock as g, SortKeys as _, __toESM as v, enterPageSelection as y, errorMessage as b, exitPageSelection as x, fetchQualityGoals as S, fmtDur as C, fmtSize as w, previewUrl as T, require_jsx_runtime as E, require_react as D, t as O, useCatalogView as k, useDense as A, useLibraryTints as j, usePageSelection as M, useQuery as N, useQueueSort as P } from "./peach-app.js";
import { Page as F } from "./peach-app.page-QAncjzM1.js";
import { JavBatchResources as I } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
// src/react/quality-goals/quality-goals-page.tsx
var L = /* @__PURE__ */ v(D(), 1), R = E(), z = (e) => (e || "").split(/\s*\/\s*/).map((e) => e.trim()).filter(Boolean);
function B({ item: n, openItem: r, searchResources: i, javTitleHtml: a, javDisplayName: l, srcBadge: u, picked: d, onPick: f, selecting: p }) {
	let m = A(), [h, g] = (0, L.useState)(!1), _ = () => r(n.id), v = l(n), y = j(), b = n.library_id && y.get(n.library_id)?.color ? n.library_id : void 0;
	return /* @__PURE__ */ (0, R.jsxs)("article", {
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
			/* @__PURE__ */ (0, R.jsxs)("button", {
				type: "button",
				"data-media-pic": "",
				onClick: _,
				"aria-label": O("manage:hdUpgrades.openVideo", { title: v }),
				style: { "--card-ratio": "1.7777777777777777" },
				children: [
					h ? /* @__PURE__ */ (0, R.jsx)("span", {
						"data-media-nopic": "",
						children: O("manage:hdUpgrades.noPreview")
					}) : /* @__PURE__ */ (0, R.jsx)("span", {
						"data-media-art": "thumb",
						children: /* @__PURE__ */ (0, R.jsx)("img", {
							className: "absolute inset-0 size-full object-contain",
							src: T(n),
							alt: "",
							loading: "lazy",
							"data-goal-cover": "",
							onError: () => g(!0)
						})
					}),
					/* @__PURE__ */ (0, R.jsx)("span", {
						"data-media-badge": "",
						dangerouslySetInnerHTML: { __html: u(n.location, n.cost) }
					}),
					Number(n.duration) > 0 ? /* @__PURE__ */ (0, R.jsx)("span", {
						"data-media-duration": "",
						children: C(n.duration)
					}) : null,
					/* @__PURE__ */ (0, R.jsx)("span", {
						"data-media-check": "",
						children: /* @__PURE__ */ (0, R.jsx)(o, { name: "check" })
					})
				]
			}),
			/* @__PURE__ */ (0, R.jsx)("div", {
				"data-media-meta": "",
				children: /* @__PURE__ */ (0, R.jsxs)("div", {
					"data-media-text": "",
					children: [
						/* @__PURE__ */ (0, R.jsx)("button", {
							type: "button",
							"data-media-title": "",
							onClick: _,
							title: v,
							dangerouslySetInnerHTML: { __html: a(n) }
						}),
						/* @__PURE__ */ (0, R.jsxs)("div", {
							"data-media-byline": "",
							children: [/* @__PURE__ */ (0, R.jsx)("span", {
								"data-media-who": "",
								children: n.library_id ? /* @__PURE__ */ (0, R.jsx)(c, { item: n }) : s[n.location] ?? n.location
							}), /* @__PURE__ */ (0, R.jsx)("span", {
								"data-media-facts": "",
								children: /* @__PURE__ */ (0, R.jsxs)("span", {
									"data-media-size": "",
									children: [/* @__PURE__ */ (0, R.jsx)(o, { name: "hard-drive" }), Number(n.size) > 0 ? w(Number(n.size)) : O("manage:hdUpgrades.unknownSize")]
								})
							})]
						}),
						/* @__PURE__ */ (0, R.jsx)(t, {
							tags: z(n.reason),
							label: (e) => e,
							readOnly: !0,
							title: n.reason || void 0
						})
					]
				})
			}),
			/* @__PURE__ */ (0, R.jsxs)("div", {
				"data-jav-actions": "",
				className: "flex flex-wrap gap-2",
				children: [n.code ? /* @__PURE__ */ (0, R.jsx)(e, {
					variant: "secondary",
					size: m ? "small" : "medium",
					onClick: () => i({
						code: n.code,
						title: v,
						origin: `asset:${n.id}`,
						searchReason: n.reason || "",
						duration: n.duration,
						cover: T(n)
					}),
					children: O("manage:resourceSearch.searchTorrents")
				}) : null, /* @__PURE__ */ (0, R.jsx)(e, {
					variant: "secondary",
					size: m ? "small" : "medium",
					onClick: _,
					children: O("manage:hdUpgrades.viewEditions")
				})]
			})
		]
	});
}
function V({ toast: t, ...o }) {
	let [v, E] = (0, L.useState)(null), [D, A] = (0, L.useState)(/* @__PURE__ */ new Set()), j = M(() => A(/* @__PURE__ */ new Set())), [z, V] = (0, L.useState)(null), H = N({
		queryKey: d,
		queryFn: ({ signal: e }) => S(e)
	}), U = k(), W = P("quality-goals", {
		size: (e) => Number(e.size || 0),
		dur: (e) => Number(e.duration || 0),
		new: (e) => e.id
	}), G = H.data;
	if (!G) return /* @__PURE__ */ (0, R.jsx)(F, { children: /* @__PURE__ */ (0, R.jsx)(l, {
		tone: "error",
		title: O("manage:hdUpgrades.loadFailed"),
		children: H.error ? b(H.error) : O("manage:hdUpgrades.notFound")
	}) });
	let K = W.sort(G.items || []);
	if (!K.length) return /* @__PURE__ */ (0, R.jsx)(F, { children: /* @__PURE__ */ (0, R.jsx)(i, {
		icon: u,
		title: O("manage:hdUpgrades.emptyTitle"),
		children: O("manage:hdUpgrades.emptyBody")
	}) });
	let q = K.filter((e) => D.has(e.id)), J = q.filter((e) => e.code), Y = (e) => {
		e && y(), A(e ? new Set(K.map((e) => e.id)) : /* @__PURE__ */ new Set());
	}, X = (e, t) => {
		t && y(), A((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	};
	return /* @__PURE__ */ (0, R.jsxs)("div", {
		"data-quality-goals": "",
		className: "mx-auto w-full max-w-board",
		children: [
			/* @__PURE__ */ (0, R.jsx)(a, {
				label: O("manage:hdUpgrades.summaryLabel"),
				topLabel: O("manage:hdUpgrades.summaryLabel"),
				top: null,
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": ""
				},
				bottomClassName: "min-h-12",
				bottom: /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [/* @__PURE__ */ (0, R.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, R.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							O("manage:hdUpgrades.summaryLabel"),
							" · ",
							O("manage:hdUpgrades.videoCount", { count: Number(G.total || 0) })
						]
					}), /* @__PURE__ */ (0, R.jsx)(h, {
						label: O("manage:hdUpgrades.selectAll"),
						picked: q.length,
						total: K.length,
						onChange: Y
					})]
				}), /* @__PURE__ */ (0, R.jsxs)("span", {
					"data-entity-sorts": "",
					children: [/* @__PURE__ */ (0, R.jsx)(n, {}), /* @__PURE__ */ (0, R.jsx)(_, {
						sorts: W.sorts,
						onSort: W.onSort
					})]
				})] })
			}),
			U === "list" ? /* @__PURE__ */ (0, R.jsx)(m, {
				table: "quality-goals",
				label: O("manage:hdUpgrades.summaryLabel"),
				items: K,
				selected: D,
				selecting: j,
				sort: {
					options: W.sorts.map(({ key: e, label: t }) => ({
						id: e,
						label: t
					})),
					sorting: W.sorting,
					onChange: W.setSorting
				},
				rowLabel: (e) => O("manage:hdUpgrades.selectVideo", { title: o.javDisplayName(e) }),
				onPick: (e, t) => X(e.id, t),
				onPickAll: Y,
				cells: {
					name: (e) => /* @__PURE__ */ (0, R.jsx)(f, {
						name: o.javDisplayName(e),
						onOpen: () => o.openItem(e.id),
						picture: /* @__PURE__ */ (0, R.jsx)(p, {
							src: T(e),
							glyph: "film"
						})
					}),
					library: (e) => /* @__PURE__ */ (0, R.jsx)(c, { item: e }),
					source: (e) => /* @__PURE__ */ (0, R.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, R.jsx)("span", {
							className: "contents",
							dangerouslySetInnerHTML: { __html: o.srcBadge(e.location, e.cost) }
						}), s[e.location] ?? e.location]
					}),
					dur: (e) => C(e.duration) || "—",
					size: (e) => Number(e.size) > 0 ? w(Number(e.size)) : "—",
					reason: (e) => e.reason || "—",
					actions: (t) => /* @__PURE__ */ (0, R.jsxs)("span", {
						className: "flex gap-2",
						children: [t.code ? /* @__PURE__ */ (0, R.jsx)(e, {
							variant: "secondary",
							size: "small",
							onClick: () => E({
								code: t.code,
								title: o.javDisplayName(t),
								origin: `asset:${t.id}`,
								searchReason: t.reason || "",
								duration: t.duration,
								cover: T(t)
							}),
							children: O("manage:resourceSearch.searchTorrents")
						}) : null, /* @__PURE__ */ (0, R.jsx)(e, {
							variant: "secondary",
							size: "small",
							onClick: () => o.openItem(t.id),
							children: O("manage:hdUpgrades.viewEditions")
						})]
					})
				}
			}) : /* @__PURE__ */ (0, R.jsx)("div", {
				"data-media-grid": "",
				"data-select-mode": j ? "" : void 0,
				children: K.map((e) => /* @__PURE__ */ (0, R.jsx)(B, {
					item: e,
					...o,
					searchResources: E,
					picked: D.has(e.id),
					onPick: (t) => X(e.id, t),
					selecting: j
				}, e.id))
			}),
			/* @__PURE__ */ (0, R.jsxs)(g, {
				visible: q.length > 0,
				label: O("manage:hdUpgrades.dockLabel"),
				count: O("manage:hdUpgrades.selectedCount", { count: q.length }),
				actions: [],
				children: [/* @__PURE__ */ (0, R.jsx)(e, {
					size: "small",
					variant: "secondary",
					disabled: !J.length,
					onClick: () => V(J.map((e) => ({
						id: e.id,
						code: e.code,
						title: o.javDisplayName(e),
						release_date: void 0
					}))),
					children: O("manage:resourceSearch.searchTorrents")
				}), /* @__PURE__ */ (0, R.jsx)(e, {
					size: "small",
					variant: "ghost",
					onClick: x,
					children: O("manage:hdUpgrades.clearSelection")
				})]
			}),
			/* @__PURE__ */ (0, R.jsx)(I, {
				items: z,
				close: () => V(null),
				readOnly: !1,
				receipt: t
			}),
			Number(G.total || 0) > K.length ? /* @__PURE__ */ (0, R.jsx)("p", {
				className: "mt-6 text-center text-caption-1-regular text-text-secondary",
				children: O("manage:hdUpgrades.showingFirst", {
					shown: K.length.toLocaleString(),
					count: Number(G.total)
				})
			}) : null,
			/* @__PURE__ */ (0, R.jsx)(r, {
				prefill: v,
				close: () => E(null),
				receipt: t
			})
		]
	});
}
export { V as QualityGoalsPage };

//# debugId=84ed5508-e91c-4fcc-8fe6-fceb811fac33