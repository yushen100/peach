(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "5e750824-d70b-431a-8300-32e10f5a6e6f", e._sentryDebugIdIdentifier = "sentry-dbid-5e750824-d70b-431a-8300-32e10f5a6e6f");
	} catch {}
})();
import { Button as e, Bx as t, Chip as n, DataTableFooter as r, Disclosure as i, DownloadsPanel as a, EmptyState as o, Gg as s, HN as c, IssueRow as l, LinkButton as u, Lo as d, Ma as f, NameLink as p, Note as m, OV as h, Pf as g, ProcessingMode as _, RB as v, RUNNING_POLL_MS as y, Rk as b, Su as x, TASKS_KEY as S, TRIGGER_LABELS as C, TaskProgress as w, Xl as T, __toESM as E, activityKind as D, apiGet as O, apiSend as ee, busyProps as k, cardClass as A, codedText as j, confirmModal as te, controlTask as ne, cx as re, elapsedText as ie, errorMessage as M, fetchTasks as ae, fmtSize as oe, foldByKind as se, foldRoutine as ce, followupDetail as le, followupTally as N, groupFollowups as ue, hasResultProblems as P, i2 as F, interfaceLanguage as de, isActive as I, isRoutine as fe, latestOfKind as pe, momentText as L, notifyManager as me, oe as he, pollInterval as ge, problemDestination as _e, progressLabel as ve, progressText as ye, readableErrorHeadline as be, replaceEqualDeep as xe, require_jsx_runtime as Se, require_react as Ce, runError as R, setTaskSpeed as we, statusLabel as Te, summaryItems as Ee, t as z, taskIssues as De, taskName as B, taskSubject as Oe, um as ke, uo as Ae, useMutation as V, useQuery as H, useQueryClient as U, vl as je, withBackoff as W } from "./peach-app.js";
import { CodeBlock as Me } from "./peach-app.code-block-CXu10nIP.js";
import { Page as Ne } from "./peach-app.page-QAncjzM1.js";
import { ErrorDetails as G, ErrorExcerpt as Pe } from "./peach-app.error-excerpt-Ugft6I5o.js";
// node_modules/@tanstack/react-query/build/modern/useMutationState.js
var K = /* @__PURE__ */ E(Ce(), 1);
function Fe() {
	let e;
	return (t, n) => {
		let r = [], i;
		return () => {
			let a = t.findAll(n.filters), o = a.flatMap((e) => [e, e.state]);
			return (!i || o.length !== r.length || o.some((e, t) => !Object.is(e, r[t]))) && (r = o, i = xe(e, a.map((e) => n.select ? n.select(e) : e.state)), e = i), i;
		};
	};
}
function Ie(e = {}, t) {
	let n = U(t).getMutationCache(), [r] = K.useState(() => Fe()), i = r(n, e);
	return K.useSyncExternalStore(K.useCallback((e) => n.subscribe(me.batchCalls(e)), [n]), i, i);
}
// src/react/activity/background-issues.tsx
var q = Se(), Le = ["background-issues"], Re = W(() => 3e4);
function ze() {
	let e = (0, K.useId)(), t = H({
		queryKey: Le,
		queryFn: ({ signal: e }) => O("/api/background-issues", e),
		refetchInterval: Re
	}).data?.issues || [];
	return t.length ? /* @__PURE__ */ (0, q.jsxs)("section", {
		"aria-labelledby": e,
		className: "flex min-w-0 flex-col gap-3",
		children: [/* @__PURE__ */ (0, q.jsx)("h3", {
			id: e,
			className: "text-title-2-medium text-text-primary",
			children: z("manage:backgroundIssues.title")
		}), /* @__PURE__ */ (0, q.jsx)("ul", {
			className: "flex min-w-0 flex-col gap-3",
			children: t.map((e) => /* @__PURE__ */ (0, q.jsx)("li", { children: /* @__PURE__ */ (0, q.jsx)(Be, { issue: e }) }, e.key))
		})]
	}) : null;
}
function Be({ issue: t }) {
	let n = U(), r = V({
		mutationFn: () => ee(t.retry, {}),
		onSuccess: () => {
			n.invalidateQueries({ queryKey: Le });
		}
	}), i = t.since ? z("manage:backgroundIssues.since", { time: L(t.since) }) : z("manage:backgroundIssues.detectedAt", { time: L(t.noticed_at) });
	return /* @__PURE__ */ (0, q.jsx)(m, {
		tone: "error",
		title: j(t, "title"),
		action: /* @__PURE__ */ (0, q.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [/* @__PURE__ */ (0, q.jsx)(u, {
				href: t.href,
				size: "small",
				trailingIcon: F,
				children: j(t, "link_label")
			}), t.retry ? /* @__PURE__ */ (0, q.jsx)(e, {
				variant: "secondary",
				size: "small",
				disabled: !t.retry_available,
				...k(r.isPending),
				onClick: () => r.mutate(),
				children: z("manage:shared.retryNow")
			}) : null]
		}),
		children: r.error ? z("manage:backgroundIssues.retryFailed", {
			moment: i,
			error: M(r.error)
		}) : i
	});
}
// src/react/activity/task-controls.tsx
var J = ["task-control"], Ve = {
	pause: h,
	resume: s,
	cancel: c
}, He = {
	pause: z("manage:shared.pause"),
	resume: z("manage:shared.resume"),
	cancel: z("manage:taskControls.cancelTask")
}, Ue = {
	pause: z("manage:taskControls.pauseFollowups"),
	resume: z("manage:taskControls.resumeFollowups"),
	cancel: z("manage:taskControls.cancelFollowups")
};
function We() {
	let e = Ie({
		filters: { mutationKey: J },
		select: (e) => ({
			id: e.mutationId,
			command: e.state.variables,
			status: e.state.status,
			error: e.state.error
		})
	}), t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = n.command;
		if (!e) continue;
		let r = t.get(e.id);
		(!r || r.id < n.id) && t.set(e.id, {
			...n,
			command: e
		});
	}
	let n = [...t.values()].filter((e) => e.status === "error");
	return n.length ? /* @__PURE__ */ (0, q.jsx)("div", {
		"data-task-control-feedback": "",
		className: "flex min-w-0 flex-col gap-2",
		children: n.map(({ command: e, error: t }) => /* @__PURE__ */ (0, q.jsx)(m, {
			tone: "error",
			title: z("manage:taskControls.actionFailed", {
				task: e.label,
				action: (e.followups ? Ue : He)[e.action]
			}),
			children: M(t)
		}, e.id))
	}) : null;
}
function Ge({ run: t, runs: n = [t] }) {
	let r = U(), i = (0, K.useRef)({
		change: !1,
		cancel: !1,
		confirmation: !1
	}), a = () => {
		r.invalidateQueries({ queryKey: S });
	}, o = async (e) => {
		let t = null;
		for (let r of n) try {
			await ne(r.id, e.action);
		} catch (e) {
			t ??= e;
		}
		if (t !== null) throw t;
	}, s = V({
		mutationKey: [
			...J,
			t.id,
			"change"
		],
		mutationFn: o,
		onSettled: () => {
			i.current.change = !1, a();
		}
	}), c = V({
		mutationKey: [
			...J,
			t.id,
			"cancel"
		],
		mutationFn: o,
		onSettled: () => {
			i.current.cancel = !1, a();
		}
	}), l = V({
		mutationFn: async (e) => {
			let t = (await Promise.allSettled(n.map((t) => we(t.id, e)))).find((e) => e.status === "rejected");
			if (t?.status === "rejected") throw t.reason;
		},
		onSettled: a
	}), u = (t.control?.actions || []).filter((e) => e !== "set_speed"), d = !!(t.control?.actions.includes("set_speed") && t.control.speed_mode), f = !I(t), p = c.isPending || c.isSuccess;
	if (!u.length && !d) return null;
	let h = (e) => {
		let r = {
			id: t.id,
			label: B(t),
			action: e,
			followups: f
		};
		if (e === "cancel") {
			if (i.current.cancel || i.current.confirmation || c.isSuccess) return;
			i.current.confirmation = !0, te({
				title: z(f ? "manage:taskControls.cancelFollowupsTitle" : "manage:taskControls.cancelTaskTitle", { task: B(t) }),
				body: f ? n.length > 1 ? z("manage:taskControls.cancelBatchFollowupsBody", { count: n.length }) : z("manage:taskControls.cancelFollowupsBody") : z("manage:taskControls.cancelTaskBody"),
				confirmLabel: z(f ? "manage:taskControls.cancelFollowups" : "manage:shared.cancelTask"),
				danger: !0,
				onConfirm: async () => (i.current.cancel = !0, await c.mutateAsync(r))
			}).finally(() => {
				i.current.confirmation = !1;
			});
		} else {
			if (i.current.change || i.current.cancel || p) return;
			i.current.change = !0, s.mutate(r);
		}
	};
	return /* @__PURE__ */ (0, q.jsxs)("div", {
		className: "ml-auto min-w-0",
		"data-task-controls": t.id,
		children: [/* @__PURE__ */ (0, q.jsxs)("div", {
			role: "group",
			"aria-label": z(f ? "manage:taskControls.followupsGroupLabel" : "manage:taskControls.groupLabel", { task: B(t) }),
			className: "flex flex-wrap items-center justify-end gap-2",
			children: [d ? /* @__PURE__ */ (0, q.jsx)(_, {
				value: t.control.speed_mode,
				busy: l.isPending || p,
				animate: t.control?.state === "running",
				onChange: (e) => l.mutate(e)
			}) : null, u.map((t) => {
				let n = (f ? Ue : He)[t], r = t === "cancel" ? c.isPending : s.isPending && s.variables?.action === t, i = t === "cancel" ? p : s.isPending || p;
				return /* @__PURE__ */ (0, q.jsx)(e, {
					type: "button",
					variant: "secondary",
					size: "small",
					iconOnly: !0,
					leadingIcon: Ve[t],
					"aria-label": n,
					title: n,
					...k(r),
					"aria-disabled": i || void 0,
					onClick: () => h(t),
					"data-tooltip-copy-key": `tasks.control.action.${f ? "followups." : ""}${t}`
				}, t);
			})]
		}), l.error ? /* @__PURE__ */ (0, q.jsx)(m, {
			tone: "error",
			children: M(l.error)
		}) : null]
	});
}
// src/react/activity/task-icon.tsx
var Ke = new Map([
	[t, [
		"follow-check",
		"follow-resolve",
		"follow-creator",
		"follow-evidence-reclaim",
		"follow-backfill",
		"feed-check",
		"feed-scrape",
		"feed-cover"
	]],
	[b, [
		"library-processing",
		"organize",
		"batch",
		"resource-scan",
		"resource-apply",
		"seed-import"
	]],
	[je, [
		"scrape-codes",
		"jav-discovery-metadata",
		"want-scrape",
		"upgrade-library"
	]],
	[f, [
		"scraping-cover",
		"jav-covers",
		"code-samples",
		"timeline-thumbnails",
		"entity-avatar",
		"cover-artwork-repair"
	]],
	[g, [
		"performer-profile",
		"performer-alias",
		"creator-identity",
		"studio-mark"
	]],
	[T, ["media-repair", "mp4-header-repair"]],
	[ke, [
		"link-check",
		"link-prune",
		"source-check"
	]],
	[he, ["download-postprocess", "want-search"]],
	[d, ["taste-refresh"]],
	[v, [
		"upgrade-repairs",
		"diagnostic-export",
		"amane-bridge",
		"face-models",
		"ledger-backup",
		"ledger-restore"
	]]
].flatMap(([e, t]) => t.map((t) => [t, e])));
function qe({ taskKey: e, className: t }) {
	let n = Ke.get(e) ?? x;
	return /* @__PURE__ */ (0, q.jsx)(n, {
		className: t,
		"aria-hidden": !0
	});
}
// src/react/activity/resource-chip.tsx
var Je = {
	blue: "bg-status-blue-text text-background-primary-default",
	purple: "bg-status-purple-text text-background-primary-default",
	cyan: "bg-status-cyan-text text-background-primary-default"
};
function Ye({ color: e, high: t, ...r }) {
	return t ? /* @__PURE__ */ (0, q.jsx)("span", {
		...r,
		className: re("inline-flex items-center justify-center rounded-md px-1.5 py-1 whitespace-nowrap text-caption-1-medium", Je[e])
	}) : /* @__PURE__ */ (0, q.jsx)(n, {
		variant: "caption",
		color: e,
		...r
	});
}
// src/react/activity/task-resources.tsx
var Xe = {
	cpu: {
		name: "CPU",
		color: "blue"
	},
	gpu: {
		name: "GPU",
		color: "purple"
	},
	network: {
		name: z("manage:taskResources.network"),
		color: "cyan"
	}
};
function Ze(e) {
	return e.state === "sampling" ? z("manage:taskResources.sampling") : e.via === "cloud" ? z("manage:taskResources.viaCloudDrive") : z("manage:taskResources.unavailable");
}
function Qe(e, t) {
	return t === 0 ? z("manage:taskResources.idle") : e === "network" ? `${oe(t)}/s` : `${t.toLocaleString(de, { maximumFractionDigits: 1 })}%`;
}
function Y({ run: e, active: t = I(e) || !!e.control }) {
	if (!t || !e.resources) return null;
	let n = e.resources;
	return /* @__PURE__ */ (0, q.jsx)("div", {
		"data-task-resources": e.id,
		className: "flex min-w-0 flex-wrap items-center gap-2",
		children: [
			"cpu",
			"gpu",
			"network"
		].map((e) => {
			let t = n[e], r = Xe[e], i = e === "network" ? n.network.bytes_per_second : n[e].percent, a = t.state === "ready" && i !== null, o = a && t.high, s = a ? Qe(e, i) : Ze(t), c = [t.reason ? j(t, "reason") : "", o ? z("manage:taskResources.highUsage") : ""].filter(Boolean).join("\n");
			return /* @__PURE__ */ (0, q.jsxs)(Ye, {
				color: r.color,
				high: o,
				tabIndex: c ? 0 : void 0,
				title: c || void 0,
				"data-task-resource": e,
				"data-resource-state": t.state,
				"data-resource-via": t.via,
				"data-resource-high": o || void 0,
				"data-resource-idle": a && i === 0 || void 0,
				"data-copy-ignore": "",
				children: [
					r.name,
					" ",
					s
				]
			}, e);
		})
	});
}
// src/react/activity/activity-page.tsx
var $e = W(ge), et = (e) => W(() => e ? y : !1), tt = /* @__PURE__ */ new Set(["upgrade-repairs"]), nt = /* @__PURE__ */ new Set(["asset_id", "name"]), rt = {
	succeeded: "lime",
	failed: "rose",
	cancelled: "rose",
	interrupted: "yellow",
	running: "blue",
	pending: "neutral"
}, it = {
	running: z("manage:taskStatus.running"),
	pausing: z("manage:taskStatus.pausing"),
	paused: z("manage:taskStatus.paused"),
	cancelling: z("manage:taskStatus.canceling")
};
function X({ run: e }) {
	let t = e.control?.state;
	if (t && (t !== "running" || !I(e))) return /* @__PURE__ */ (0, q.jsx)(n, {
		color: t === "running" ? "blue" : "neutral",
		children: /* @__PURE__ */ (0, q.jsx)("span", {
			"data-copy-key": `tasks.control.state.${t}`,
			children: it[t]
		})
	});
	let r = e.status === "failed" && e.task_key === "library-processing" && e.result_summary?.outcome === "partial", i = r || e.status === "succeeded" && P(e);
	return /* @__PURE__ */ (0, q.jsx)(n, {
		color: i ? "yellow" : rt[e.status] ?? "neutral",
		children: r ? z("manage:taskStatus.partial") : i ? z("manage:taskStatus.issuesFound") : Te(e.status)
	});
}
function at({ rows: e }) {
	let [t, n] = (0, K.useState)({
		pageIndex: 0,
		pageSize: 20
	}), { pageSize: a } = t, o = Math.min(t.pageIndex, Math.max(0, Math.ceil(e.length / a) - 1));
	return /* @__PURE__ */ (0, q.jsxs)(q.Fragment, { children: [/* @__PURE__ */ (0, q.jsx)("ul", {
		className: "-mr-5 flex min-w-0 flex-col",
		children: e.slice(o * a, (o + 1) * a).map((e) => {
			let t = le(e);
			return /* @__PURE__ */ (0, q.jsxs)("li", {
				"data-status": e.status,
				"data-followup-key": e.followup_key,
				className: "flex min-w-0 flex-col gap-1 border-t border-separator-border py-2.5 pr-10 pl-5",
				children: [
					/* @__PURE__ */ (0, q.jsxs)("div", {
						className: "flex min-w-0 flex-wrap items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, q.jsxs)("div", {
							className: "flex min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-2 gap-y-1",
							children: [
								/* @__PURE__ */ (0, q.jsx)(qe, {
									taskKey: e.task_key,
									className: "size-4 shrink-0 text-text-secondary"
								}),
								/* @__PURE__ */ (0, q.jsx)("span", {
									className: "min-w-0 break-words text-caption-1-regular text-text-primary",
									children: B(e)
								}),
								/* @__PURE__ */ (0, q.jsx)(X, { run: e }),
								t ? /* @__PURE__ */ (0, q.jsx)("span", {
									className: "min-w-0 break-words text-caption-1-regular text-text-secondary",
									children: t
								}) : null
							]
						}), /* @__PURE__ */ (0, q.jsx)(Ge, { run: e })]
					}),
					/* @__PURE__ */ (0, q.jsx)(Y, { run: e }),
					Object.keys(e.result_summary || {}).length ? /* @__PURE__ */ (0, q.jsx)("div", {
						className: "w-full min-w-0",
						children: /* @__PURE__ */ (0, q.jsx)(i, {
							summary: z("manage:taskCenter.technicalDetails"),
							contentClassName: "pb-2.5",
							children: /* @__PURE__ */ (0, q.jsx)(Me, {
								code: JSON.stringify(e.result_summary, null, 2),
								language: "json",
								label: z("manage:taskCenter.taskTechnicalDetails", { task: B(e) })
							})
						})
					}) : null
				]
			}, e.id);
		})
	}), /* @__PURE__ */ (0, q.jsx)(r, {
		label: z("manage:taskCenter.taskDetails"),
		total: e.length,
		pagination: {
			...t,
			pageIndex: o
		},
		onChange: n
	})] });
}
function Z({ run: e, meta: t, children: n, error: r, issues: a, followups: o, followupTotal: s = 0, badge: c, resourceActive: l, controlled: u }) {
	let [d, f] = (0, K.useState)(!!o?.some(I)), h = (u || [e]).map((e) => e.id), g = s > (o?.length || 0), _ = H({
		queryKey: [
			...S,
			"followups",
			h
		],
		enabled: d && g,
		queryFn: async ({ signal: e }) => (await Promise.all(h.map((t) => O(`/api/tasks/${t}`, e)))).flatMap((e) => e.followups),
		refetchInterval: et(l)
	}), v = (e) => e.status === "running" ? 3 : e.status === "pending" ? 2 : +(e.status === "failed" || e.status === "interrupted"), y = [...(g ? _.data : void 0) || o || []].sort((e, t) => v(t) - v(e) || t.id - e.id), b = y.length, x = Math.max(o?.length || 0, s), C = Oe(e), w = String(r || "").trim(), T = be(w);
	return /* @__PURE__ */ (0, q.jsxs)("li", {
		id: `run-${e.id}`,
		"data-status": e.status,
		"data-task-key": e.task_key,
		"data-run-id": e.id,
		className: A({
			padding: "none",
			bordered: e.status === "failed" ? "error" : void 0,
			className: "flex flex-col"
		}),
		children: [
			/* @__PURE__ */ (0, q.jsxs)("div", {
				className: "flex flex-col gap-2 px-5 py-4",
				children: [
					/* @__PURE__ */ (0, q.jsxs)("div", {
						className: "flex min-w-0 flex-wrap items-start justify-between gap-3",
						children: [/* @__PURE__ */ (0, q.jsxs)("div", {
							className: "flex min-w-0 flex-1 basis-48 flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, q.jsx)(qe, {
									taskKey: e.task_key,
									className: "size-5 shrink-0 text-text-secondary"
								}),
								/* @__PURE__ */ (0, q.jsx)("strong", {
									className: "min-w-0 break-words text-title-3-medium text-text-primary",
									children: B(e)
								}),
								c ?? /* @__PURE__ */ (0, q.jsx)(X, { run: e })
							]
						}), /* @__PURE__ */ (0, q.jsx)(Ge, {
							run: e,
							runs: u
						})]
					}),
					/* @__PURE__ */ (0, q.jsx)("p", {
						className: "text-caption-1-regular text-text-secondary",
						children: t
					}),
					/* @__PURE__ */ (0, q.jsx)(Y, {
						run: e,
						active: l
					}),
					C ? /* @__PURE__ */ (0, q.jsx)(p, {
						href: C.href,
						"data-task-subject": e.id,
						title: C.label,
						className: "min-w-0 max-w-full self-start truncate text-text-primary",
						children: C.label
					}) : null,
					T ? /* @__PURE__ */ (0, q.jsx)("p", {
						"data-task-error": "",
						className: "text-caption-1-regular text-text-secondary wrap-anywhere",
						children: T
					}) : null,
					n
				]
			}),
			a ? /* @__PURE__ */ (0, q.jsx)("div", {
				className: "border-t border-separator-border",
				children: a
			}) : null,
			T && w !== T ? /* @__PURE__ */ (0, q.jsx)("div", {
				className: "border-t border-separator-border",
				children: /* @__PURE__ */ (0, q.jsx)(i, {
					row: !0,
					summary: z("manage:taskCenter.errorDetails"),
					contentClassName: "pb-5",
					children: /* @__PURE__ */ (0, q.jsx)(G, {
						label: z("manage:taskCenter.taskErrorDetails", { task: B(e) }),
						children: w
					})
				})
			}) : null,
			x ? /* @__PURE__ */ (0, q.jsx)("div", {
				className: "border-t border-separator-border",
				children: /* @__PURE__ */ (0, q.jsxs)(i, {
					row: !0,
					summary: z("manage:taskCenter.taskDetailsCount", { count: x }),
					contentClassName: "pb-5",
					isOpen: d,
					onOpenChange: f,
					children: [
						_.error ? /* @__PURE__ */ (0, q.jsx)(m, {
							tone: "error",
							children: M(_.error)
						}) : null,
						b < x ? /* @__PURE__ */ (0, q.jsx)("p", {
							className: "text-caption-1-regular text-text-secondary",
							children: z("manage:taskCenter.showingCount", { count: b })
						}) : null,
						/* @__PURE__ */ (0, q.jsx)(at, { rows: y })
					]
				})
			}) : null,
			Object.keys(e.result_summary || {}).some((e) => !(C && nt.has(e))) ? /* @__PURE__ */ (0, q.jsx)("div", {
				className: "border-t border-separator-border",
				children: /* @__PURE__ */ (0, q.jsx)(i, {
					row: !0,
					summary: z("manage:taskCenter.technicalDetails"),
					contentClassName: "pb-5",
					children: /* @__PURE__ */ (0, q.jsx)(Me, {
						code: JSON.stringify(e.result_summary, null, 2),
						language: "json",
						label: z("manage:taskCenter.taskTechnicalDetails", { task: B(e) })
					})
				})
			}) : null
		]
	});
}
function ot({ run: e, followups: t, followupTotal: n }) {
	let r = e.progress_total || 0, i = e.progress_current || 0, a = e.control?.state, o = a && a !== "running", s = o ? it[a] : ve(e) || z("manage:taskCenter.inProgress"), c = ie(e.elapsed_seconds), l = [C[e.trigger] || e.trigger, c && z("manage:taskCenter.runningFor", { elapsed: c })].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, q.jsx)(Z, {
		run: e,
		meta: l,
		followups: t,
		followupTotal: n,
		children: o && !(r > 0) ? /* @__PURE__ */ (0, q.jsx)("p", {
			"data-copy-key": `tasks.control.state.${a}`,
			className: "text-caption-1-regular text-text-secondary",
			children: s
		}) : /* @__PURE__ */ (0, q.jsx)(w, {
			embedded: !0,
			kind: D(e.task_key, String(e.progress_params?.stage || "") || null),
			label: r > 0 ? `${s} · ${z("manage:taskCenter.progressItems", { progress: ye(i, r) })}` : s,
			value: Math.min(i, r),
			total: r
		})
	});
}
function st({ run: e, followups: t, runs: r, latest: a, followupTotal: o, followupFailed: s = 0, followupCancelled: c = 0 }) {
	let d = !!(r && r.length > 1 && o), f = d ? [z("manage:taskCenter.processedTotal", { count: o }), s ? z("manage:taskCenter.failedCount", { count: s }) : ""].filter(Boolean) : Ee(Oe(e) ? {
		...e.result_summary,
		name: ""
	} : e.result_summary).filter((t) => t !== R(e) && t !== be(R(e))), p = De(e), m = _e(e, a), h = ie(e.elapsed_seconds), g = r && r.length > 1 ? r[r.length - 1] : void 0, _ = (g ? [
		C[e.trigger] || e.trigger,
		z("manage:taskCenter.lastRuns", { count: r.length }),
		`${L(g.finished_at)} – ${L(e.finished_at)}`
	] : [
		C[e.trigger] || e.trigger,
		L(e.finished_at),
		h && z("manage:taskCenter.took", { elapsed: h })
	]).filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, q.jsxs)(Z, {
		run: e,
		meta: _,
		error: R(e),
		followups: t,
		followupTotal: o,
		controlled: r,
		issues: p.length ? /* @__PURE__ */ (0, q.jsx)(i, {
			row: !0,
			summary: z("manage:taskCenter.issueDetailsCount", { count: p.length }),
			contentClassName: "pb-5",
			children: /* @__PURE__ */ (0, q.jsx)(G, {
				label: z("manage:taskCenter.issueDetails"),
				children: /* @__PURE__ */ (0, q.jsx)("ul", {
					className: "flex min-w-0 flex-col whitespace-normal",
					"data-task-issues": "",
					children: p.map((e, t) => /* @__PURE__ */ (0, q.jsx)(l, {
						title: /* @__PURE__ */ (0, q.jsxs)(q.Fragment, { children: [e.label, e.provider || e.kind ? /* @__PURE__ */ (0, q.jsxs)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: [" · ", [e.provider, e.kind].filter(Boolean).join(" · ")]
						}) : null] }),
						children: /* @__PURE__ */ (0, q.jsx)(Pe, {
							text: e.error,
							className: "text-caption-1-regular text-text-secondary"
						})
					}, `${e.source}-${t}`))
				})
			})
		}) : void 0,
		badge: c && e.status === "succeeded" ? /* @__PURE__ */ (0, q.jsx)(n, {
			color: "rose",
			children: /* @__PURE__ */ (0, q.jsx)("span", {
				"data-copy-key": `tasks.followups.cancelled.${c === o ? "all" : "partial"}`,
				children: z(c === o ? "manage:taskCenter.followupsCanceled" : "manage:taskCenter.someFollowupsCanceled")
			})
		}) : d && s ? /* @__PURE__ */ (0, q.jsx)(n, {
			color: "yellow",
			children: z("manage:taskStatus.issuesFound")
		}) : void 0,
		children: [
			c ? /* @__PURE__ */ (0, q.jsx)("p", {
				className: "text-caption-1-regular text-text-secondary",
				children: z("manage:taskCenter.followupsCanceledCount", { count: c })
			}) : null,
			f.length === 1 ? /* @__PURE__ */ (0, q.jsx)("p", {
				className: "text-caption-1-regular text-text-secondary wrap-anywhere",
				children: f[0]
			}) : f.length ? /* @__PURE__ */ (0, q.jsx)("ul", {
				className: "flex list-disc flex-col gap-1 pl-5 text-caption-1-regular text-text-secondary wrap-anywhere",
				children: f.map((e, t) => /* @__PURE__ */ (0, q.jsx)("li", { children: e }, t))
			}) : null,
			!p.length && P(e) && ["follow-check", "feed-check"].includes(e.task_key) ? /* @__PURE__ */ (0, q.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: z("manage:taskCenter.noIssueDetails")
			}) : null,
			m ? /* @__PURE__ */ (0, q.jsx)(u, {
				href: m.href,
				size: "small",
				trailingIcon: F,
				className: "self-start",
				children: m.label
			}) : null
		]
	});
}
function ct({ runs: e, followups: t, counts: r }) {
	let i = e[0], a = e[e.length - 1], o = N(r, e), s = Math.max(o.total, t.length), c = o.total ? o.settled : t.filter((e) => !I(e)).length, l = o.total ? o.failed : t.filter((e) => e.status === "failed" || e.status === "interrupted").length, u = [
		C[i.trigger] || i.trigger,
		e.length > 1 ? z("manage:taskCenter.batches", { count: e.length }) : "",
		z("manage:taskCenter.startedAt", { time: L(a.started_at || a.finished_at) })
	].filter(Boolean).join(" · ");
	return /* @__PURE__ */ (0, q.jsx)(Z, {
		run: i,
		meta: u,
		followups: t,
		followupTotal: s,
		resourceActive: !0,
		controlled: e,
		badge: i.control ? /* @__PURE__ */ (0, q.jsx)(X, { run: i }) : /* @__PURE__ */ (0, q.jsx)(n, {
			color: "blue",
			children: z("manage:taskStatus.running")
		}),
		children: /* @__PURE__ */ (0, q.jsx)(w, {
			embedded: !0,
			kind: D(i.task_key),
			value: c,
			total: s,
			label: `${z("manage:taskCenter.processedProgress", { progress: ye(c, s) })}${l ? z("manage:taskCenter.failedSuffix", { count: l }) : ""}`
		})
	});
}
function Q({ title: e, children: t }) {
	let n = (0, K.useId)();
	return /* @__PURE__ */ (0, q.jsxs)("section", {
		"aria-labelledby": n,
		className: "flex min-w-0 flex-col gap-3",
		children: [/* @__PURE__ */ (0, q.jsx)("h3", {
			id: n,
			className: "text-title-2-medium text-text-primary",
			children: e
		}), t]
	});
}
function $({ live: e = !1, paginate: t = !0, children: n }) {
	let [i, a] = (0, K.useState)({
		pageIndex: 0,
		pageSize: 20
	}), o = K.Children.toArray(n), { pageSize: s } = i, c = Math.min(i.pageIndex, Math.max(0, Math.ceil(o.length / s) - 1));
	return /* @__PURE__ */ (0, q.jsxs)(q.Fragment, { children: [/* @__PURE__ */ (0, q.jsx)("ul", {
		"aria-live": e ? "polite" : void 0,
		className: "flex min-w-0 flex-col gap-3",
		children: t ? o.slice(c * s, (c + 1) * s) : o
	}), t ? /* @__PURE__ */ (0, q.jsx)(r, {
		label: z("manage:taskCenter.taskList"),
		total: o.length,
		pagination: {
			...i,
			pageIndex: c
		},
		onChange: a
	}) : null] });
}
function lt() {
	let [e, t] = (0, K.useState)(1), [n, i] = (0, K.useState)(20), s = H({
		queryKey: e === 1 && n === 20 ? S : [
			...S,
			"page",
			e,
			n
		],
		queryFn: ({ signal: t }) => ae(t, e, n),
		refetchInterval: $e,
		placeholderData: (e) => e
	}), [c, l] = (0, K.useState)(s.data);
	s.data && s.data !== c && l(s.data);
	let u = s.data || c, d = s.error ? M(s.error) : "";
	if (!u) return /* @__PURE__ */ (0, q.jsx)(Ne, { children: /* @__PURE__ */ (0, q.jsx)(m, {
		tone: "error",
		children: d || z("manage:taskCenter.loadFailed")
	}) });
	let f = u.finished || [], p = u.working_parents || [], h = [
		...u.running || [],
		...u.skipped || [],
		...f,
		...p
	], g = ue(h), _ = new Set(h.map((e) => e.id)), v = (e) => e.filter((e) => !(e.followup_key && e.parent_run_id != null && _.has(e.parent_run_id))), y = v(f), b = u.followup_counts || {}, x = (e) => e.flatMap((e) => g.get(e.id) || []), C = [...y, ...v(p)].filter((e) => N(b, [e]).active > 0 || g.get(e.id)?.some(I)).sort((e, t) => t.id - e.id), w = v(u.running || []), T = v(u.skipped || []), E = y.filter((e) => !C.includes(e) && !T.some((t) => t.id === e.id)), D = (e) => (g.get(e.id) || []).every((e) => e.status === "succeeded" && !P(e)) && N(b, [e]).failed === 0, O = ce(E, (e) => fe(e) && (D(e) || tt.has(e.task_key))), ee = se(C, (e) => e.control?.state || "").sort((e, t) => t.run.id - e.run.id), k = pe(h), A = !w.length && !C.length && !T.length && !E.length;
	return /* @__PURE__ */ (0, q.jsxs)(Ne, { children: [
		d ? /* @__PURE__ */ (0, q.jsx)(m, {
			tone: "error",
			children: d
		}) : null,
		/* @__PURE__ */ (0, q.jsx)(We, {}),
		u.available === !1 ? /* @__PURE__ */ (0, q.jsx)(m, {
			tone: "warning",
			children: u.message || z("manage:taskCenter.tableNotReady")
		}) : null,
		/* @__PURE__ */ (0, q.jsx)(ze, {}),
		A ? /* @__PURE__ */ (0, q.jsx)(o, {
			icon: Ae,
			title: z("manage:taskCenter.emptyTitle"),
			children: z("manage:taskCenter.emptyText")
		}) : /* @__PURE__ */ (0, q.jsxs)(q.Fragment, { children: [
			/* @__PURE__ */ (0, q.jsx)(Q, {
				title: z("manage:taskCenter.inProgress"),
				children: w.length || C.length ? /* @__PURE__ */ (0, q.jsxs)($, {
					live: !0,
					children: [w.map((e) => /* @__PURE__ */ (0, q.jsx)(ot, {
						run: e,
						followups: g.get(e.id),
						followupTotal: N(b, [e]).total
					}, e.id)), ee.map(({ run: e, runs: t }) => /* @__PURE__ */ (0, q.jsx)(ct, {
						runs: t,
						followups: x(t),
						counts: b
					}, e.id))]
				}) : /* @__PURE__ */ (0, q.jsx)(m, {
					tone: "neutral",
					children: z("manage:taskCenter.noneRunning")
				})
			}),
			T.length ? /* @__PURE__ */ (0, q.jsx)(Q, {
				title: z("manage:taskCenter.skipped"),
				children: /* @__PURE__ */ (0, q.jsx)($, { children: T.map((e) => /* @__PURE__ */ (0, q.jsx)(st, {
					run: e,
					latest: k.has(e.id),
					followups: g.get(e.id)
				}, e.id)) })
			}) : null,
			E.length || u.finished_total ? /* @__PURE__ */ (0, q.jsxs)(Q, {
				title: z("manage:taskCenter.recentlyCompleted"),
				children: [E.length ? /* @__PURE__ */ (0, q.jsx)($, {
					paginate: !1,
					children: O.map(({ run: e, runs: t }) => {
						let n = N(b, t);
						return /* @__PURE__ */ (0, q.jsx)(st, {
							run: e,
							runs: t,
							latest: k.has(e.id),
							followups: x(t),
							followupTotal: n.total,
							followupFailed: n.failed,
							followupCancelled: n.cancelled
						}, e.id);
					})
				}) : null, /* @__PURE__ */ (0, q.jsx)(r, {
					label: z("manage:taskCenter.recentlyCompleted"),
					total: u.finished_total ?? y.length,
					unit: z("manage:taskCenter.footerUnit"),
					pageUnit: z("manage:taskCenter.footerPageUnit"),
					pagination: {
						pageIndex: (u.finished_page || e) - 1,
						pageSize: n
					},
					onChange: (r) => {
						r.pageIndex + 1 === e && r.pageSize === n ? s.refetch() : (t(r.pageIndex + 1), i(r.pageSize));
					}
				})]
			}) : null
		] }),
		/* @__PURE__ */ (0, q.jsx)(a, {})
	] });
}
export { lt as ActivityPage };

//# debugId=5e750824-d70b-431a-8300-32e10f5a6e6f