(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "9d9eb836-dccf-46f6-9495-5fb176b58bb9", e._sentryDebugIdIdentifier = "sentry-dbid-9d9eb836-dccf-46f6-9495-5fb176b58bb9");
	} catch {}
})();
import { Button as e, LinkButton as t, Note as n, Progress as r, REPAIRS_KEY as i, RESULT_PANEL as a, RESULT_SECTION as o, SectionHeading as s, StatusLabel as c, apiSend as l, confirmModal as u, fetchRepairs as d, fmtSize as f, i2 as p, interfaceLanguage as m, localizeRepairs as h, queryClient as g, repairCenterPanelSkeleton as _, require_jsx_runtime as v, t as y, useAction as b, useQuery as x, withBackoff as S } from "./peach-app.js";
import { Page as C } from "./peach-app.page-QAncjzM1.js";
// src/react/settings/repair-center.tsx
var w = v(), T = {
	done: [y("settings:shared.completed"), "success"],
	succeeded: [y("settings:shared.completed"), "success"],
	complete: [y("settings:shared.completed"), "success"],
	running: [y("settings:shared.inProgress"), "progress"],
	pending: [y("settings:repairCenter.queued"), "neutral"],
	waiting: [y("settings:repairCenter.awaitingConfirmation"), "warning"],
	failed: [y("settings:repairCenter.needsRetry"), "error"],
	none: [y("settings:repairCenter.nothingToDo"), "neutral"]
}, E = {
	files: y("settings:repairCenter.groups.files"),
	catalog: y("settings:repairCenter.groups.catalog"),
	people: y("settings:repairCenter.groups.people"),
	follow: y("settings:repairCenter.groups.follow"),
	records: y("settings:repairCenter.groups.records")
}, D = (e) => e.reduce((e, t) => {
	let n = e[e.length - 1];
	return n && n[0] === t.group ? n[1].push(t) : e.push([t.group, [t]]), e;
}, []), O = (e = 0) => e.toLocaleString(), k = (e) => (/* @__PURE__ */ new Date(e * 1e3)).toLocaleString(m, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
}), A = (e) => y("settings:repairCenter.filesAndSize", {
	count: e.files || 0,
	size: f(e.bytes || 0)
}), j = (e) => e.state === "running" && !!e.total, M = (e) => !!e.estimating || e.state === "running", N = S((e) => e?.items.some(M) ? 2e3 : !1);
function P(e) {
	return e.estimating ? y("settings:repairCenter.estimating") : e.state === "failed" && e.error ? e.error : e.files ? y("settings:repairCenter.reclaimable", { size: f(e.bytes || 0) }) : e.state === "pending" && e.online ? y("settings:repairCenter.pendingChecks", { count: e.pending || 0 }) : e.state === "waiting" && e.backed_up ? y("settings:repairCenter.pendingFixes", { count: e.pending || 0 }) : e.state === "waiting" ? e.pending ? y("settings:repairCenter.pendingRecheck", { count: e.pending }) : "" : j(e) ? "" : e.total ? `${O(e.done)} / ${O(e.total)}` : e.mode === "confirm" ? "" : e.changed ? y("settings:repairCenter.changedCount", { count: e.changed }) : "";
}
function F({ title: e, description: t, progress: n, children: r }) {
	return /* @__PURE__ */ (0, w.jsxs)("div", {
		className: `${o} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`,
		children: [/* @__PURE__ */ (0, w.jsxs)("div", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [
				/* @__PURE__ */ (0, w.jsx)("span", {
					className: "text-body-medium text-text-primary",
					children: e
				}),
				/* @__PURE__ */ (0, w.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: t
				}),
				n ? /* @__PURE__ */ (0, w.jsx)("div", {
					className: "pt-2",
					children: n
				}) : null
			]
		}), /* @__PURE__ */ (0, w.jsx)("div", {
			className: "flex shrink-0 items-center gap-3",
			children: r
		})]
	});
}
function I({ item: e }) {
	return /* @__PURE__ */ (0, w.jsxs)("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ (0, w.jsx)("div", {
			className: "min-w-0 flex-1",
			children: /* @__PURE__ */ (0, w.jsx)(r, {
				label: y("settings:repairCenter.itemProgress", { title: e.title }),
				value: e.done || 0,
				max: e.total
			})
		}), /* @__PURE__ */ (0, w.jsxs)("span", {
			className: "shrink-0 text-caption-1-regular text-text-secondary tabular-nums",
			children: [
				O(e.done),
				" / ",
				O(e.total)
			]
		})]
	});
}
function L() {
	let r = x({
		queryKey: i,
		queryFn: ({ signal: e }) => d(e),
		refetchInterval: N
	}), o = r.data, f = b(), m = (e) => g.setQueryData(i, e), v = async (e, t) => h(await l(`/api/configuration/repairs/${e.id}`, {}, "POST", t)), S = (e) => e.backed_up ? void u({
		title: y("settings:repairCenter.applyTitle", { title: e.title }),
		body: y("settings:repairCenter.applyBody", { count: e.pending || 0 }),
		confirmLabel: y("settings:shared.start"),
		onConfirm: async () => m(await v(e))
	}) : e.files === void 0 ? void f.run(e.id, (t) => v(e, t), m) : void u({
		title: y("settings:repairCenter.deleteTitle", { title: e.title }),
		body: y("settings:repairCenter.deleteBody", { amount: A(e) }),
		confirmLabel: y("settings:repairCenter.deleteSnapshots"),
		danger: !0,
		onConfirm: async () => m(await v(e))
	}), O = (e) => e.backups.length ? e.backups.some((e) => e.exists) ? /* @__PURE__ */ (0, w.jsx)(t, {
		href: "/settings/maintenance#ledgerBackups",
		size: "small",
		trailingIcon: p,
		children: y("settings:repairCenter.preRepairBackup")
	}) : /* @__PURE__ */ (0, w.jsx)("span", {
		className: "text-body-2-regular text-text-tertiary",
		children: y("settings:repairCenter.backupCleaned")
	}) : null, M = f.error || (r.error ? r.error.message : "");
	return /* @__PURE__ */ (0, w.jsxs)(C, { children: [
		M ? /* @__PURE__ */ (0, w.jsx)(n, {
			tone: "error",
			children: M
		}) : null,
		o?.items.length ? D(o.items).map(([t, n]) => /* @__PURE__ */ (0, w.jsxs)("section", {
			"aria-labelledby": `repair-group-${t}`,
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, w.jsx)(s, {
				id: `repair-group-${t}`,
				children: E[t] || t
			}), /* @__PURE__ */ (0, w.jsx)("div", {
				className: a,
				children: n.map((t) => {
					let [n, r] = T[t.state] || T.none, i = P(t);
					return /* @__PURE__ */ (0, w.jsxs)(F, {
						title: t.title,
						description: t.summary,
						progress: j(t) ? /* @__PURE__ */ (0, w.jsx)(I, { item: t }) : null,
						children: [i ? /* @__PURE__ */ (0, w.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: i
						}) : null, t.mode === "confirm" && t.state === "waiting" ? /* @__PURE__ */ (0, w.jsx)(e, {
							size: "small",
							disabled: !o.available || !!f.busy || t.estimating,
							onClick: () => S(t),
							children: y("settings:shared.start")
						}) : /* @__PURE__ */ (0, w.jsx)(c, {
							tone: r,
							children: n
						})]
					}, t.id);
				})
			})]
		}, t)) : /* @__PURE__ */ (0, w.jsxs)("section", {
			"aria-labelledby": "repair-items",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, w.jsx)(s, {
				id: "repair-items",
				children: y("settings:repairCenter.itemsHeading")
			}), o ? /* @__PURE__ */ (0, w.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: y("settings:repairCenter.empty")
			}) : /* @__PURE__ */ (0, w.jsx)("div", {
				className: "contents",
				"data-skeleton": "",
				"aria-busy": "true",
				"aria-label": y("settings:repairCenter.loadingItems"),
				dangerouslySetInnerHTML: { __html: _() }
			})]
		}),
		o?.history.length ? /* @__PURE__ */ (0, w.jsxs)("section", {
			"aria-labelledby": "repair-history",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, w.jsx)(s, {
				id: "repair-history",
				children: y("settings:repairCenter.history")
			}), /* @__PURE__ */ (0, w.jsx)("div", {
				className: a,
				children: o.history.map((e) => /* @__PURE__ */ (0, w.jsx)(F, {
					title: e.title,
					description: `${k(e.at)} · ${e.changed ? y("settings:repairCenter.changedCount", { count: e.changed }) : y("settings:repairCenter.noChanges")}`,
					children: O(e)
				}, e.id))
			})]
		}) : null
	] });
}
export { L as RepairCenterPage, N as repairsInterval };

//# debugId=9d9eb836-dccf-46f6-9495-5fb176b58bb9