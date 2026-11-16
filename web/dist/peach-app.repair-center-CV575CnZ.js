(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "da7ef82d-97c8-4b97-8a6d-24dfeda3c8c0", e._sentryDebugIdIdentifier = "sentry-dbid-da7ef82d-97c8-4b97-8a6d-24dfeda3c8c0");
	} catch {}
})();
import { Button as e, LinkButton as t, Note as n, Progress as r, REPAIRS_KEY as i, RESULT_PANEL as a, RESULT_SECTION as o, SectionHeading as s, StatusLabel as c, apiSend as l, confirmModal as u, fetchRepairs as d, fmtSize as f, i2 as p, interfaceLanguage as m, localizeRepairs as h, queryClient as g, quoted as _, repairCenterPanelSkeleton as v, require_jsx_runtime as y, t as b, useAction as x, useQuery as S, withBackoff as C } from "./peach-app.js";
import { Page as w } from "./peach-app.page-QAncjzM1.js";
// src/react/settings/repair-center.tsx
var T = y(), E = {
	done: [b("settings:shared.completed"), "success"],
	succeeded: [b("settings:shared.completed"), "success"],
	complete: [b("settings:shared.completed"), "success"],
	running: [b("settings:shared.inProgress"), "progress"],
	pending: [b("settings:repairCenter.queued"), "neutral"],
	waiting: [b("settings:repairCenter.awaitingConfirmation"), "warning"],
	deferred: [b("settings:repairCenter.deferred"), "neutral"],
	failed: [b("settings:repairCenter.needsRetry"), "error"],
	none: [b("settings:repairCenter.nothingToDo"), "neutral"]
}, D = {
	files: b("settings:repairCenter.groups.files"),
	catalog: b("settings:repairCenter.groups.catalog"),
	people: b("settings:repairCenter.groups.people"),
	follow: b("settings:repairCenter.groups.follow"),
	records: b("settings:repairCenter.groups.records")
}, O = (e) => e.reduce((e, t) => {
	let n = e[e.length - 1];
	return n && n[0] === t.group ? n[1].push(t) : e.push([t.group, [t]]), e;
}, []), k = (e = 0) => e.toLocaleString(), A = (e) => (/* @__PURE__ */ new Date(e * 1e3)).toLocaleString(m, {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
}), j = (e) => b("settings:repairCenter.filesAndSize", {
	count: e.files || 0,
	size: f(e.bytes || 0)
}), M = (e) => e.state === "running" && !!e.total, N = (e) => !!e.estimating || e.state === "running", P = C((e) => e?.items.some(N) ? 2e3 : !1), F = /* @__PURE__ */ new Set([
	"mount",
	"cooldown",
	"cost"
]), I = (e) => b(`settings:repairCenter.deferReasons.${F.has(e) ? e : "retry"}`);
function L(e) {
	let t = Object.entries(e.deferred || {}).filter(([, e]) => e > 0), n = t.reduce((e, [, t]) => e + t, 0), r = [];
	if (n) {
		let e = t.length === 1 ? I(t[0][0]) : t.map(([e, t]) => b("settings:repairCenter.deferReasonCount", {
			reason: I(e),
			count: t
		})).join(b("shell:format.clauseSeparator"));
		r.push(b("settings:repairCenter.deferredNote", {
			count: n,
			reason: e
		}));
	}
	return e.failed && r.push(b("settings:repairCenter.failedNote", {
		count: e.failed,
		place: _(b("settings:upgradeRepairs.title"))
	})), r.length ? /* @__PURE__ */ (0, T.jsx)("span", {
		className: "text-caption-1-regular text-text-secondary",
		children: r.join(b("shell:format.semicolonSeparator"))
	}) : null;
}
function R(e) {
	return e.estimating ? b("settings:repairCenter.estimating") : e.state === "failed" && e.error ? e.error : e.files ? b("settings:repairCenter.reclaimable", { size: f(e.bytes || 0) }) : e.state === "pending" && e.online ? b("settings:repairCenter.pendingChecks", { count: e.pending || 0 }) : e.state === "waiting" && e.backed_up ? b("settings:repairCenter.pendingFixes", { count: e.pending || 0 }) : e.covers ? b("settings:repairCenter.pendingCovers", { count: e.covers }) : e.state === "waiting" ? e.pending ? b("settings:repairCenter.pendingRecheck", { count: e.pending }) : "" : M(e) ? "" : e.total ? `${k(e.done)} / ${k(e.total)}` : e.changed ? b("settings:repairCenter.changedCount", { count: e.changed }) : "";
}
function z({ title: e, description: t, progress: n, children: r }) {
	return /* @__PURE__ */ (0, T.jsxs)("div", {
		className: `${o} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`,
		children: [/* @__PURE__ */ (0, T.jsxs)("div", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [
				/* @__PURE__ */ (0, T.jsx)("span", {
					className: "text-body-medium text-text-primary",
					children: e
				}),
				/* @__PURE__ */ (0, T.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: t
				}),
				n ? /* @__PURE__ */ (0, T.jsx)("div", {
					className: "pt-2",
					children: n
				}) : null
			]
		}), /* @__PURE__ */ (0, T.jsx)("div", {
			className: "flex shrink-0 items-center gap-3",
			children: r
		})]
	});
}
function B({ item: e }) {
	return /* @__PURE__ */ (0, T.jsxs)("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ (0, T.jsx)("div", {
			className: "min-w-0 flex-1",
			children: /* @__PURE__ */ (0, T.jsx)(r, {
				label: b("settings:repairCenter.itemProgress", { title: e.title }),
				value: e.done || 0,
				max: e.total
			})
		}), /* @__PURE__ */ (0, T.jsxs)("span", {
			className: "shrink-0 text-caption-1-regular text-text-secondary tabular-nums",
			children: [
				k(e.done),
				" / ",
				k(e.total)
			]
		})]
	});
}
function V(e) {
	let t = L(e);
	return M(e) ? t ? /* @__PURE__ */ (0, T.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [/* @__PURE__ */ (0, T.jsx)(B, { item: e }), t]
	}) : /* @__PURE__ */ (0, T.jsx)(B, { item: e }) : t;
}
function H() {
	let r = S({
		queryKey: i,
		queryFn: ({ signal: e }) => d(e),
		refetchInterval: P
	}), o = r.data, f = x(), m = (e) => g.setQueryData(i, e), _ = async (e, t) => h(await l(`/api/configuration/repairs/${e.id}`, {}, "POST", t)), y = (e) => e.backed_up ? void u({
		title: b("settings:repairCenter.applyTitle", { title: e.title }),
		body: b("settings:repairCenter.applyBody", { count: e.pending || 0 }),
		confirmLabel: b("settings:shared.start"),
		onConfirm: async () => m(await _(e))
	}) : e.files === void 0 ? void f.run(e.id, (t) => _(e, t), m) : void u({
		title: b("settings:repairCenter.deleteTitle", { title: e.title }),
		body: b("settings:repairCenter.deleteBody", { amount: j(e) }),
		confirmLabel: b("settings:repairCenter.deleteSnapshots"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: async () => m(await _(e))
	}), C = (e) => e.filter((e) => e.mode === "confirm" && e.state === "waiting" && !e.estimating), k = (e, t) => void u({
		title: t,
		body: e.some((e) => e.files !== void 0) ? b("settings:repairCenter.startManyBodyDelete") : b("settings:repairCenter.startManyBody"),
		items: e.map((e) => b("settings:repairCenter.startManyItem", {
			title: e.title,
			amount: e.files === void 0 ? R(e) : j(e)
		})),
		confirmLabel: b("settings:shared.start"),
		danger: e.some((e) => e.files !== void 0),
		holdToConfirm: e.some((e) => e.files !== void 0),
		onConfirm: async () => {
			for (let t of e) m(await _(t));
		}
	}), M = (e) => e.backups.length ? e.backups.some((e) => e.exists) ? /* @__PURE__ */ (0, T.jsx)(t, {
		href: "/settings/maintenance#ledgerBackups",
		size: "small",
		trailingIcon: p,
		children: b("settings:repairCenter.preRepairBackup")
	}) : /* @__PURE__ */ (0, T.jsx)("span", {
		className: "text-body-2-regular text-text-tertiary",
		children: b("settings:repairCenter.backupCleaned")
	}) : null, N = f.error || (r.error ? r.error.message : ""), F = o ? C(o.items) : [], I = new Set(F.map((e) => e.group)).size;
	return /* @__PURE__ */ (0, T.jsxs)(w, { children: [
		N ? /* @__PURE__ */ (0, T.jsx)(n, {
			tone: "error",
			children: N
		}) : null,
		o && I > 1 ? /* @__PURE__ */ (0, T.jsx)(n, {
			tone: "info",
			action: /* @__PURE__ */ (0, T.jsx)(e, {
				size: "small",
				disabled: !o.available || !!f.busy,
				onClick: () => k(F, b("settings:repairCenter.startAllTitle")),
				children: b("settings:repairCenter.startAll")
			}),
			children: b("settings:repairCenter.waitingCount", { count: F.length })
		}) : null,
		o?.items.length ? O(o.items).map(([t, n]) => /* @__PURE__ */ (0, T.jsxs)("section", {
			"aria-labelledby": `repair-group-${t}`,
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, T.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, T.jsx)(s, {
					id: `repair-group-${t}`,
					children: D[t] || t
				}), C(n).length > 1 ? /* @__PURE__ */ (0, T.jsx)(e, {
					size: "small",
					disabled: !o.available || !!f.busy,
					onClick: () => k(C(n), b("settings:repairCenter.startGroupTitle", { group: D[t] || t })),
					children: b("settings:repairCenter.startGroup")
				}) : null]
			}), /* @__PURE__ */ (0, T.jsx)("div", {
				className: a,
				children: n.map((t) => {
					let [n, r] = E[t.state] || E.none, i = R(t);
					return /* @__PURE__ */ (0, T.jsxs)(z, {
						title: t.title,
						description: t.summary,
						progress: V(t),
						children: [i ? /* @__PURE__ */ (0, T.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: i
						}) : null, t.mode === "confirm" && t.state === "waiting" ? /* @__PURE__ */ (0, T.jsx)(e, {
							size: "small",
							disabled: !o.available || !!f.busy || t.estimating,
							onClick: () => y(t),
							children: b("settings:shared.start")
						}) : /* @__PURE__ */ (0, T.jsx)(c, {
							tone: r,
							children: n
						})]
					}, t.id);
				})
			})]
		}, t)) : /* @__PURE__ */ (0, T.jsxs)("section", {
			"aria-labelledby": "repair-items",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, T.jsx)(s, {
				id: "repair-items",
				children: b("settings:repairCenter.itemsHeading")
			}), o ? /* @__PURE__ */ (0, T.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: b("settings:repairCenter.empty")
			}) : /* @__PURE__ */ (0, T.jsx)("div", {
				className: "contents",
				"data-skeleton": "",
				"aria-busy": "true",
				"aria-label": b("settings:repairCenter.loadingItems"),
				dangerouslySetInnerHTML: { __html: v() }
			})]
		}),
		o?.history.length ? /* @__PURE__ */ (0, T.jsxs)("section", {
			"aria-labelledby": "repair-history",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, T.jsx)(s, {
				id: "repair-history",
				children: b("settings:repairCenter.history")
			}), /* @__PURE__ */ (0, T.jsx)("div", {
				className: a,
				children: o.history.map((e) => /* @__PURE__ */ (0, T.jsx)(z, {
					title: e.title,
					description: `${A(e.at)} · ${e.changed ? b("settings:repairCenter.changedCount", { count: e.changed }) : b("settings:repairCenter.noChanges")}`,
					children: M(e)
				}, e.id))
			})]
		}) : null
	] });
}
export { H as RepairCenterPage, P as repairsInterval };

//# debugId=da7ef82d-97c8-4b97-8a6d-24dfeda3c8c0