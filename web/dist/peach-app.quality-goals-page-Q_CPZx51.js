(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "4af5157a-d8bf-4fb0-b3ef-8f9de3d8005a", e._sentryDebugIdIdentifier = "sentry-dbid-4af5157a-d8bf-4fb0-b3ef-8f9de3d8005a");
	} catch {}
})();
import { Button as e, Checkbox as t, CloudDownloadDialog as n, CollectionSummary as r, EmptyState as i, LOC as a, Note as o, OA as s, QUALITY_GOALS_KEY as c, SelectionDock as l, __toESM as u, cardClass as d, enterPageSelection as f, errorMessage as p, exitPageSelection as m, fetchQualityGoals as h, fmtDur as g, fmtSize as _, previewUrl as v, require_jsx_runtime as y, require_react as b, t as x, usePageSelection as S, useQuery as C } from "./peach-app.js";
import { Page as w } from "./peach-app.page-QAncjzM1.js";
import { JavBatchResources as T } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
// src/react/quality-goals/quality-goals-page.tsx
var E = /* @__PURE__ */ u(b(), 1), D = y();
function O({ item: n, openItem: r, searchResources: i, javTitleHtml: o, javDisplayName: s, srcBadge: c, picked: l, onPick: u }) {
	let f = () => r(n.id);
	return /* @__PURE__ */ (0, D.jsxs)("li", {
		"data-goal-id": n.id,
		"data-board-selected": l || void 0,
		className: d({
			padding: "none",
			className: "flex flex-col gap-3 p-3"
		}),
		children: [/* @__PURE__ */ (0, D.jsxs)("div", {
			className: "flex min-w-0 gap-4",
			children: [/* @__PURE__ */ (0, D.jsxs)("button", {
				type: "button",
				onClick: f,
				"aria-label": x("manage:hdUpgrades.openVideo", { title: s(n) }),
				className: "relative inline-grid w-card-cover shrink-0 self-start aspect-card-cover cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder",
				children: [/* @__PURE__ */ (0, D.jsx)("span", {
					className: "text-caption-1-regular text-text-secondary",
					children: x("manage:hdUpgrades.noPreview")
				}), /* @__PURE__ */ (0, D.jsx)("img", {
					src: v(n),
					alt: "",
					loading: "lazy",
					onError: (e) => e.currentTarget.remove(),
					className: "absolute inset-0 size-full object-contain"
				})]
			}), /* @__PURE__ */ (0, D.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-1.5",
				children: [
					/* @__PURE__ */ (0, D.jsx)("h3", {
						className: "text-headline-medium text-text-primary",
						children: /* @__PURE__ */ (0, D.jsx)("button", {
							type: "button",
							onClick: f,
							title: s(n),
							className: "line-clamp-2 w-full cursor-pointer text-left wrap-anywhere",
							dangerouslySetInnerHTML: { __html: o(n) }
						})
					}),
					/* @__PURE__ */ (0, D.jsxs)("p", {
						className: "flex flex-wrap items-center gap-2 text-body-2-regular text-text-secondary",
						children: [
							/* @__PURE__ */ (0, D.jsx)("span", {
								className: "contents",
								dangerouslySetInnerHTML: { __html: c(n.location, n.cost) }
							}),
							/* @__PURE__ */ (0, D.jsx)("span", { children: a[n.location] ?? n.location }),
							/* @__PURE__ */ (0, D.jsx)("span", { children: g(n.duration) }),
							/* @__PURE__ */ (0, D.jsx)("span", { children: Number(n.size) > 0 ? _(Number(n.size)) : x("manage:hdUpgrades.unknownSize") })
						]
					}),
					n.reason ? /* @__PURE__ */ (0, D.jsx)("p", {
						className: "border-t border-separator-border pt-3 text-body-2-regular text-text-secondary wrap-anywhere",
						children: n.reason
					}) : null
				]
			})]
		}), /* @__PURE__ */ (0, D.jsxs)("footer", {
			className: "flex flex-wrap items-center justify-end gap-2",
			children: [
				n.code ? /* @__PURE__ */ (0, D.jsx)(t, {
					slot: null,
					className: "mr-auto",
					"aria-label": x("manage:hdUpgrades.selectVideo", { title: s(n) }),
					isSelected: l,
					onChange: u
				}) : null,
				n.code ? /* @__PURE__ */ (0, D.jsx)(e, {
					variant: "secondary",
					size: "small",
					onClick: () => i({
						code: n.code,
						title: s(n),
						origin: `asset:${n.id}`,
						searchReason: n.reason || "",
						duration: n.duration,
						cover: v(n)
					}),
					children: x("manage:resourceSearch.searchTorrents")
				}) : null,
				/* @__PURE__ */ (0, D.jsx)(e, {
					variant: "secondary",
					size: "small",
					onClick: f,
					children: x("manage:hdUpgrades.viewEditions")
				})
			]
		})]
	});
}
function k({ toast: a, ...u }) {
	let [d, g] = (0, E.useState)(null), [_, v] = (0, E.useState)(/* @__PURE__ */ new Set());
	S(() => v(/* @__PURE__ */ new Set()));
	let [y, b] = (0, E.useState)(null), k = C({
		queryKey: c,
		queryFn: ({ signal: e }) => h(e)
	}), A = k.data;
	if (!A) return /* @__PURE__ */ (0, D.jsx)(w, { children: /* @__PURE__ */ (0, D.jsx)(o, {
		tone: "error",
		title: x("manage:hdUpgrades.loadFailed"),
		children: k.error ? p(k.error) : x("manage:hdUpgrades.notFound")
	}) });
	let j = A.items || [];
	if (!j.length) return /* @__PURE__ */ (0, D.jsx)(w, { children: /* @__PURE__ */ (0, D.jsx)(i, {
		icon: s,
		title: x("manage:hdUpgrades.emptyTitle"),
		children: x("manage:hdUpgrades.emptyBody")
	}) });
	let M = j.filter((e) => e.code), N = M.filter((e) => _.has(e.id)), P = M.length > 0 && N.length === M.length, F = (e, t) => {
		t && f(), v((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	};
	return /* @__PURE__ */ (0, D.jsxs)(w, { children: [
		/* @__PURE__ */ (0, D.jsx)(r, {
			label: x("manage:hdUpgrades.summaryLabel"),
			figure: x("manage:hdUpgrades.videoCount", { count: Number(A.total || 0) }),
			flush: !0
		}),
		M.length ? /* @__PURE__ */ (0, D.jsx)("div", {
			className: "mb-4",
			children: /* @__PURE__ */ (0, D.jsx)(t, {
				size: "sm",
				isSelected: P,
				isIndeterminate: N.length > 0 && !P,
				onChange: (e) => {
					e && f(), v(e ? new Set(M.map((e) => e.id)) : /* @__PURE__ */ new Set());
				},
				children: x("manage:hdUpgrades.selectAll")
			})
		}) : null,
		/* @__PURE__ */ (0, D.jsx)("ul", {
			className: "card-grid-cover gap-5",
			children: j.map((e) => /* @__PURE__ */ (0, D.jsx)(O, {
				item: e,
				...u,
				searchResources: g,
				picked: _.has(e.id),
				onPick: (t) => F(e.id, t)
			}, e.id))
		}),
		/* @__PURE__ */ (0, D.jsxs)(l, {
			visible: N.length > 0,
			label: x("manage:hdUpgrades.dockLabel"),
			count: x("manage:hdUpgrades.selectedCount", { count: N.length }),
			actions: [],
			children: [/* @__PURE__ */ (0, D.jsx)(e, {
				size: "small",
				variant: "secondary",
				onClick: () => b(N.map((e) => ({
					id: e.id,
					code: e.code,
					title: u.javDisplayName(e),
					release_date: void 0
				}))),
				children: x("manage:resourceSearch.searchTorrents")
			}), /* @__PURE__ */ (0, D.jsx)(e, {
				size: "small",
				variant: "ghost",
				onClick: m,
				children: x("manage:hdUpgrades.clearSelection")
			})]
		}),
		/* @__PURE__ */ (0, D.jsx)(T, {
			items: y,
			close: () => b(null),
			readOnly: !1,
			receipt: a
		}),
		Number(A.total || 0) > j.length ? /* @__PURE__ */ (0, D.jsx)("p", {
			className: "mt-6 text-center text-caption-1-regular text-text-secondary",
			children: x("manage:hdUpgrades.showingFirst", {
				shown: j.length.toLocaleString(),
				count: Number(A.total)
			})
		}) : null,
		/* @__PURE__ */ (0, D.jsx)(n, {
			prefill: d,
			close: () => g(null),
			receipt: a
		})
	] });
}
export { k as QualityGoalsPage };

//# debugId=4af5157a-d8bf-4fb0-b3ef-8f9de3d8005a