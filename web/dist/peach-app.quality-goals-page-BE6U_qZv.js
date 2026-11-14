(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "1816f2b4-e0c1-4d73-8e80-0c79ce14d90d", e._sentryDebugIdIdentifier = "sentry-dbid-1816f2b4-e0c1-4d73-8e80-0c79ce14d90d");
	} catch {}
})();
import { Button as e, Checkbox as t, CloudDownloadDialog as n, CollectionSummary as r, EmptyState as i, LOC as a, Note as o, OA as s, QUALITY_GOALS_KEY as c, SelectionDock as l, __toESM as u, cardClass as d, errorMessage as f, fetchQualityGoals as p, fmtDur as m, fmtSize as h, previewUrl as g, require_jsx_runtime as _, require_react as v, t as y, useQuery as b } from "./peach-app.js";
import { Page as x } from "./peach-app.page-QAncjzM1.js";
import { JavBatchResources as S } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
// src/react/quality-goals/quality-goals-page.tsx
var C = /* @__PURE__ */ u(v(), 1), w = _();
function T({ item: n, openItem: r, searchResources: i, javTitleHtml: o, javDisplayName: s, srcBadge: c, picked: l, onPick: u }) {
	let f = () => r(n.id);
	return /* @__PURE__ */ (0, w.jsxs)("li", {
		"data-goal-id": n.id,
		"data-board-selected": l || void 0,
		className: d({
			padding: "none",
			className: "flex flex-col gap-3 p-3"
		}),
		children: [/* @__PURE__ */ (0, w.jsxs)("div", {
			className: "flex min-w-0 gap-4",
			children: [
				n.code ? /* @__PURE__ */ (0, w.jsx)(t, {
					slot: null,
					className: "mt-1 shrink-0",
					"aria-label": y("manage:hdUpgrades.selectVideo", { title: s(n) }),
					isSelected: l,
					onChange: u
				}) : null,
				/* @__PURE__ */ (0, w.jsxs)("button", {
					type: "button",
					onClick: f,
					"aria-label": y("manage:hdUpgrades.openVideo", { title: s(n) }),
					className: "relative inline-grid w-card-cover shrink-0 self-start aspect-card-cover cursor-pointer place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default",
					children: [/* @__PURE__ */ (0, w.jsx)("span", {
						className: "text-caption-1-regular text-text-secondary",
						children: y("manage:hdUpgrades.noPreview")
					}), /* @__PURE__ */ (0, w.jsx)("img", {
						src: g(n),
						alt: "",
						loading: "lazy",
						onError: (e) => e.currentTarget.remove(),
						className: "absolute inset-0 size-full object-contain"
					})]
				}),
				/* @__PURE__ */ (0, w.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-1.5",
					children: [
						/* @__PURE__ */ (0, w.jsx)("h3", {
							className: "text-headline-medium text-text-primary",
							children: /* @__PURE__ */ (0, w.jsx)("button", {
								type: "button",
								onClick: f,
								title: s(n),
								className: "line-clamp-2 w-full cursor-pointer text-left wrap-anywhere",
								dangerouslySetInnerHTML: { __html: o(n) }
							})
						}),
						/* @__PURE__ */ (0, w.jsxs)("p", {
							className: "flex flex-wrap items-center gap-2 text-body-2-regular text-text-secondary",
							children: [
								/* @__PURE__ */ (0, w.jsx)("span", {
									className: "contents",
									dangerouslySetInnerHTML: { __html: c(n.location, n.cost) }
								}),
								/* @__PURE__ */ (0, w.jsx)("span", { children: a[n.location] ?? n.location }),
								/* @__PURE__ */ (0, w.jsx)("span", { children: m(n.duration) }),
								/* @__PURE__ */ (0, w.jsx)("span", { children: Number(n.size) > 0 ? h(Number(n.size)) : y("manage:hdUpgrades.unknownSize") })
							]
						}),
						n.reason ? /* @__PURE__ */ (0, w.jsx)("p", {
							className: "border-t border-separator-border pt-3 text-body-2-regular text-text-secondary wrap-anywhere",
							children: n.reason
						}) : null
					]
				})
			]
		}), /* @__PURE__ */ (0, w.jsxs)("footer", {
			className: "flex flex-wrap justify-end gap-2",
			children: [n.code ? /* @__PURE__ */ (0, w.jsx)(e, {
				variant: "secondary",
				size: "small",
				onClick: () => i({
					code: n.code,
					title: s(n),
					origin: `asset:${n.id}`,
					searchReason: n.reason || "",
					duration: n.duration,
					cover: g(n)
				}),
				children: y("manage:resourceSearch.searchTorrents")
			}) : null, /* @__PURE__ */ (0, w.jsx)(e, {
				variant: "secondary",
				size: "small",
				onClick: f,
				children: y("manage:hdUpgrades.viewEditions")
			})]
		})]
	});
}
function E({ toast: a, ...u }) {
	let [d, m] = (0, C.useState)(null), [h, g] = (0, C.useState)(/* @__PURE__ */ new Set()), [_, v] = (0, C.useState)(null), E = b({
		queryKey: c,
		queryFn: ({ signal: e }) => p(e)
	}), D = E.data;
	if (!D) return /* @__PURE__ */ (0, w.jsx)(x, { children: /* @__PURE__ */ (0, w.jsx)(o, {
		tone: "error",
		title: y("manage:hdUpgrades.loadFailed"),
		children: E.error ? f(E.error) : y("manage:hdUpgrades.notFound")
	}) });
	let O = D.items || [];
	if (!O.length) return /* @__PURE__ */ (0, w.jsx)(x, { children: /* @__PURE__ */ (0, w.jsx)(i, {
		icon: s,
		title: y("manage:hdUpgrades.emptyTitle"),
		children: y("manage:hdUpgrades.emptyBody")
	}) });
	let k = O.filter((e) => e.code), A = k.filter((e) => h.has(e.id)), j = k.length > 0 && A.length === k.length, M = (e, t) => g((n) => {
		let r = new Set(n);
		return t ? r.add(e) : r.delete(e), r;
	});
	return /* @__PURE__ */ (0, w.jsxs)(x, { children: [
		/* @__PURE__ */ (0, w.jsx)(r, {
			label: y("manage:hdUpgrades.summaryLabel"),
			figure: y("manage:hdUpgrades.videoCount", { count: Number(D.total || 0) }),
			flush: !0
		}),
		k.length ? /* @__PURE__ */ (0, w.jsx)("div", {
			className: "mb-4",
			children: /* @__PURE__ */ (0, w.jsx)(t, {
				size: "sm",
				isSelected: j,
				isIndeterminate: A.length > 0 && !j,
				onChange: (e) => g(e ? new Set(k.map((e) => e.id)) : /* @__PURE__ */ new Set()),
				children: y("manage:hdUpgrades.selectAll")
			})
		}) : null,
		/* @__PURE__ */ (0, w.jsx)("ul", {
			className: "card-grid-cover gap-5",
			children: O.map((e) => /* @__PURE__ */ (0, w.jsx)(T, {
				item: e,
				...u,
				searchResources: m,
				picked: h.has(e.id),
				onPick: (t) => M(e.id, t)
			}, e.id))
		}),
		/* @__PURE__ */ (0, w.jsxs)(l, {
			visible: A.length > 0,
			label: y("manage:hdUpgrades.dockLabel"),
			count: y("manage:hdUpgrades.selectedCount", { count: A.length }),
			actions: [],
			children: [/* @__PURE__ */ (0, w.jsx)(e, {
				size: "small",
				variant: "secondary",
				onClick: () => v(A.map((e) => ({
					id: e.id,
					code: e.code,
					title: u.javDisplayName(e),
					release_date: void 0
				}))),
				children: y("manage:resourceSearch.searchTorrents")
			}), /* @__PURE__ */ (0, w.jsx)(e, {
				size: "small",
				variant: "ghost",
				onClick: () => g(/* @__PURE__ */ new Set()),
				children: y("manage:hdUpgrades.clearSelection")
			})]
		}),
		/* @__PURE__ */ (0, w.jsx)(S, {
			items: _,
			close: () => v(null),
			readOnly: !1,
			receipt: a
		}),
		Number(D.total || 0) > O.length ? /* @__PURE__ */ (0, w.jsx)("p", {
			className: "mt-6 text-center text-caption-1-regular text-text-secondary",
			children: y("manage:hdUpgrades.showingFirst", {
				shown: O.length.toLocaleString(),
				count: Number(D.total)
			})
		}) : null,
		/* @__PURE__ */ (0, w.jsx)(n, {
			prefill: d,
			close: () => m(null),
			receipt: a
		})
	] });
}
export { E as QualityGoalsPage };

//# debugId=1816f2b4-e0c1-4d73-8e80-0c79ce14d90d