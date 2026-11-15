(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "8abf3753-f097-4c2c-9a51-c9a5e212022f", e._sentryDebugIdIdentifier = "sentry-dbid-8abf3753-f097-4c2c-9a51-c9a5e212022f");
	} catch {}
})();
import { ApiError as e, Button as t, ButtonLink as n, Chip as r, DIAGNOSTICS_KEY as i, Disclosure as a, EmptyState as o, Fact as s, FactList as c, Fieldset as l, FieldsetTitle as u, Input as d, ItemLibrary as f, LOC as p, LinkButton as m, Note as h, Section as g, SettingsCard as _, SettingsSectionLabel as v, Stack as y, TaskProgress as ee, __toESM as b, activityKind as x, apiGet as S, apiSend as C, busyProps as w, checkText$1 as te, codedText as T, configurationSection as ne, cx as E, diagnosticHeaders as re, diagnosticsSkeleton as D, errorMessage as O, fetchDiagnostics as k, fmtDur as A, fmtSize as ie, interfaceLanguage as ae, queryClient as oe, require_jsx_runtime as se, require_react as j, settingsPath as M, stageText as N, t as P, tl as F, useAction as I, useLibraryTints as L, useQuery as R, withBackoff as z } from "./peach-app.js";
import { ErrorExcerpt as B } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { SiteMark as V } from "./peach-app.site-mark-D_VlIyJz.js";
import { DataTable as H } from "./peach-app.data-table-DYj6ojEJ.js";
// src/react/diagnostics/health-list.tsx
var U = /* @__PURE__ */ b(j(), 1), W = se(), G = (e) => e.title || e.name || e.code || P("manage:healthList.videoFallback", { id: e.id }), ce = (e, t) => [[
	P("manage:shared.video"),
	P("manage:shared.code"),
	P("manage:shared.fileName"),
	P("manage:shared.library"),
	P("manage:shared.path"),
	P("manage:healthList.durationSeconds"),
	P("manage:healthList.sizeBytes")
], ...e.map((e) => [
	G(e),
	e.code ?? "",
	e.name,
	t(e),
	e.path,
	e.duration ?? "",
	e.size ?? ""
])].map((e) => e.map((e) => String(e ?? "").replace(/[\t\r\n]+/g, " ")).join("	")).join("\n");
function le({ group: e, openItem: n, receipt: r }) {
	let i = I(), s = T(e, "label"), [c, l] = (0, U.useState)([]), u = L({ names: !0 }), d = (e) => u.get(e.library_id || "")?.name || p[e.location] || e.location, g = (e) => void i.run("copy", () => navigator.clipboard.writeText(ce(e, d)), () => r(P("manage:healthList.copied"))), _ = [
		{
			id: "title",
			label: P("manage:shared.video"),
			value: G,
			render: (e) => /* @__PURE__ */ (0, W.jsxs)("span", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, W.jsx)(m, {
					variant: "primary",
					title: G(e),
					"data-health-title": "",
					className: "max-w-full justify-start whitespace-normal text-left",
					onClick: () => n(e.id),
					children: /* @__PURE__ */ (0, W.jsx)("span", {
						className: "line-clamp-2 wrap-anywhere",
						children: G(e)
					})
				}), e.name && e.name !== G(e) ? /* @__PURE__ */ (0, W.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.name,
					className: "block min-w-0 text-caption-1-regular text-text-secondary",
					children: e.name
				}) : null]
			})
		},
		{
			id: "code",
			label: P("manage:shared.code"),
			width: 144,
			value: (e) => e.code || "",
			render: (e) => /* @__PURE__ */ (0, W.jsx)("span", {
				className: "whitespace-nowrap",
				children: e.code || P("manage:shared.unrecognized")
			})
		},
		{
			id: "location",
			label: P("manage:shared.library"),
			width: 160,
			value: d,
			render: (e) => /* @__PURE__ */ (0, W.jsx)(f, {
				libraryId: e.library_id,
				location: e.location,
				fallback: P("manage:shared.notFound")
			})
		},
		{
			id: "path",
			label: P("manage:healthList.filePath"),
			width: 320,
			min: 180,
			value: (e) => e.path,
			render: (e) => /* @__PURE__ */ (0, W.jsx)("span", {
				"data-middle-truncate": !0,
				title: e.path,
				className: "block min-w-0 w-full text-body-2-regular text-text-secondary",
				children: e.path || P("manage:shared.notFound")
			})
		},
		{
			id: "duration",
			label: P("manage:shared.duration"),
			width: 112,
			value: (e) => e.duration ?? 0,
			render: (e) => e.duration && e.duration > 0 ? A(e.duration) : P("manage:shared.notFound")
		},
		{
			id: "size",
			label: P("manage:shared.size"),
			width: 112,
			value: (e) => e.size ?? 0,
			render: (e) => e.size === null ? P("manage:shared.notFound") : ie(e.size)
		}
	];
	return /* @__PURE__ */ (0, W.jsx)(a, {
		summary: e.count === null ? `${s} · ${P("manage:shared.notFound")}` : P("manage:healthList.groupSummary", {
			label: s,
			count: e.count
		}),
		children: e.count === null ? /* @__PURE__ */ (0, W.jsx)(h, {
			tone: "neutral",
			children: P("manage:healthList.listNotFound")
		}) : e.items.length ? /* @__PURE__ */ (0, W.jsxs)(y, { children: [
			/* @__PURE__ */ (0, W.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [e.truncated ? /* @__PURE__ */ (0, W.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: P("manage:healthList.loadedCount", {
						loaded: e.items.length,
						count: e.count
					})
				}) : null, /* @__PURE__ */ (0, W.jsx)(t, {
					size: "small",
					variant: "secondary",
					...w(i.busy === "copy"),
					onClick: () => g(e.items),
					children: P("manage:healthList.copyList")
				})]
			}),
			i.error ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: i.error
			}) : null,
			/* @__PURE__ */ (0, W.jsx)(H, {
				label: s,
				title: P("manage:healthList.tableTitle"),
				unit: P("manage:healthList.tableUnit"),
				panel: !1,
				items: e.items,
				columns: _,
				rowId: (e) => String(e.id),
				rowLabel: G,
				selected: c,
				onSelected: l,
				actions: () => [],
				controls: (e) => /* @__PURE__ */ (0, W.jsx)(t, {
					size: "small",
					variant: "secondary",
					...w(i.busy === "copy"),
					onClick: () => g(e),
					children: P("manage:healthList.copySelected")
				})
			})
		] }) : /* @__PURE__ */ (0, W.jsx)(o, {
			icon: F,
			title: P("manage:healthList.emptyTitle"),
			size: "compact",
			children: P("manage:healthList.emptyBody")
		})
	});
}
// src/react/diagnostics/scraping-export.tsx
var K = "/api/diagnostics/exports", q = ["diagnostic-export"], J = z((e) => ["running", "cancelling"].includes(e?.status || "") ? 1e3 : !1);
function Y({ kind: r, codes: i = "", children: a }) {
	let o = I(), s = R({
		queryKey: q,
		queryFn: ({ signal: e }) => S(K, e),
		refetchInterval: J
	}), c = s.data, l = c?.kind === r, u = c?.status === "running" || c?.status === "cancelling", d = P(r === "support" ? "manage:diagnosticsExport.downloadReport" : "manage:diagnosticsExport.exportFetchLog"), f = (e) => {
		oe.setQueryData(q, e);
	}, p = () => void o.run("start", async (t) => {
		let n = await fetch(K, {
			method: "POST",
			signal: t,
			credentials: "same-origin",
			headers: {
				...await re(),
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				kind: r,
				codes: i
			})
		}), a = await n.json().catch(() => null);
		if (!n.ok) throw new e(a?.detail || a?.error || P("manage:diagnosticsExport.startFailed"), n.status, a);
		if (!a || !a.job_id) throw Error(P("manage:diagnosticsExport.statusNotFound"));
		return a;
	}, f), m = () => void o.run("cancel", (e) => C(`${K}/${c.job_id}/cancel`, {}, "POST", e), f);
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, W.jsxs)("div", {
				className: r === "support" ? "flex flex-wrap justify-end gap-2" : "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, W.jsx)(t, {
						type: "button",
						variant: "secondary",
						disabled: u,
						...w(o.busy === "start"),
						onClick: p,
						children: d
					}),
					l && u ? /* @__PURE__ */ (0, W.jsx)(t, {
						type: "button",
						variant: "secondary",
						disabled: c.status === "cancelling",
						...w(o.busy === "cancel"),
						onClick: m,
						children: P("manage:diagnosticsExport.cancelExport")
					}) : null,
					l && c.status === "complete" && c.download_url ? /* @__PURE__ */ (0, W.jsx)(n, {
						variant: "secondary",
						href: c.download_url,
						children: P("manage:diagnosticsExport.downloadFile")
					}) : null,
					a
				]
			}),
			l && u ? /* @__PURE__ */ (0, W.jsx)(ee, {
				embedded: r === "scraping",
				kind: x("diagnostic-export", c.stage_code),
				value: c.done || 0,
				total: c.total,
				label: c.total ? P("manage:diagnosticsExport.progress", {
					stage: N(c),
					done: c.done || 0,
					count: c.total
				}) : [
					N(c) || P("manage:diagnosticsExport.preparing"),
					c.rows ? P("manage:diagnosticsExport.candidateCount", { count: c.rows }) : "",
					c.files ? P("manage:diagnosticsExport.fileCount", { count: c.files }) : ""
				].filter(Boolean).join(" · ")
			}) : null,
			l && c.status === "complete" ? /* @__PURE__ */ (0, W.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-secondary",
				children: P("manage:diagnosticsExport.completedSize", { size: ((c.bytes || 0) / 1024 / 1024).toFixed(2) })
			}) : null,
			l && c.status === "cancelled" ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "neutral",
				children: P("manage:diagnosticsExport.canceled")
			}) : null,
			s.isError ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				action: /* @__PURE__ */ (0, W.jsx)(t, {
					type: "button",
					variant: "secondary",
					...w(s.isFetching),
					onClick: () => {
						s.refetch();
					},
					children: P("manage:diagnosticsExport.reload")
				}),
				children: P("manage:diagnosticsExport.progressNotFound")
			}) : null,
			o.error || l && c.status === "failed" ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: o.error || c?.error
			}) : null
		]
	});
}
function X() {
	let [e, t] = (0, U.useState)("");
	return /* @__PURE__ */ (0, W.jsx)(l, {
		layout: "stack",
		labelledBy: "scraping-export-title",
		footer: /* @__PURE__ */ (0, W.jsx)(Y, {
			kind: "scraping",
			codes: e
		}),
		children: /* @__PURE__ */ (0, W.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			"aria-label": P("manage:diagnosticsExport.exportFetchLog"),
			children: [
				/* @__PURE__ */ (0, W.jsx)(u, {
					id: "scraping-export-title",
					children: P("manage:diagnosticsExport.fetchLogTitle")
				}),
				/* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: P("manage:diagnosticsExport.fetchLogHint")
				}),
				/* @__PURE__ */ (0, W.jsx)(d, {
					label: P("manage:diagnosticsExport.codesLabel"),
					name: "scraping-codes",
					value: e,
					onChange: t,
					autoComplete: "off",
					spellCheck: "false",
					maxLength: 1300,
					placeholder: P("manage:diagnosticsExport.codesPlaceholder"),
					hint: P("manage:diagnosticsExport.codesHint")
				})
			]
		})
	});
}
// src/react/diagnostics/diagnostics-page.tsx
var ue = {
	ok: P("manage:diagnostics.statusOk"),
	warning: P("manage:diagnostics.statusWarning"),
	failed: P("manage:diagnostics.statusFailed"),
	unknown: P("manage:shared.notFound"),
	disabled: P("manage:diagnostics.statusDisabled"),
	stale: P("manage:diagnostics.statusStale"),
	unchecked: P("manage:diagnostics.statusUnchecked")
}, de = { "/tasks": P("manage:diagnostics.viewTasks") }, fe = [
	[P("manage:diagnostics.groupLibraries"), ["media_mounts", "data_root"]],
	[P("manage:diagnostics.groupDatabase"), ["database", "schema"]],
	[P("manage:diagnostics.groupTools"), ["ffmpeg"]],
	[P("manage:diagnostics.groupConfig"), [
		"configured",
		"security",
		"port",
		"version"
	]],
	[P("manage:diagnostics.groupTasks"), ["tasks"]]
], Z = (e) => new Date(e).toLocaleString(ae);
function Q({ status: e }) {
	return /* @__PURE__ */ (0, W.jsx)(r, {
		variant: "caption",
		"data-diagnostic-status": e,
		color: e === "failed" ? "rose" : e === "ok" ? "lime" : e === "warning" || e === "stale" ? "yellow" : "neutral",
		children: ue[e] ?? P("manage:shared.notFound")
	});
}
function pe() {
	return /* @__PURE__ */ (0, W.jsx)(Y, { kind: "support" });
}
function $({ name: e, check: t, compact: r = !1 }) {
	let i = t.target === "/settings/library" && (e === "security" || e === "port") ? M("network") : t.target, a = r ? "h4" : "h3", o = te(t);
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		"data-diagnostic-check": e,
		className: E("flex flex-col gap-4 border-b border-separator-border pr-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", r ? "py-3" : "py-5"),
		children: [/* @__PURE__ */ (0, W.jsxs)("div", {
			className: E("flex min-w-0 flex-1 flex-col", r ? "gap-1" : "gap-2"),
			children: [
				/* @__PURE__ */ (0, W.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, W.jsx)(a, {
						className: E("text-text-primary", r ? "text-body-2-medium" : "text-body-medium"),
						children: o.label
					}), /* @__PURE__ */ (0, W.jsx)(Q, { status: t.status })]
				}),
				/* @__PURE__ */ (0, W.jsx)("p", {
					"data-check-reason": !0,
					className: E("text-body-2-regular break-words", r ? "text-text-secondary" : "text-text-primary"),
					children: o.reason
				}),
				o.action ? /* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: P("manage:diagnostics.suggestedFixText", { action: o.action })
				}) : null
			]
		}), i ? /* @__PURE__ */ (0, W.jsx)("div", {
			className: "shrink-0 self-end sm:self-auto",
			children: /* @__PURE__ */ (0, W.jsx)(n, {
				size: "small",
				variant: "secondary",
				href: i,
				children: i.startsWith("/settings/") ? P("manage:diagnostics.openSection", { section: ne(i) }) : de[i] ?? P("manage:diagnostics.openRelated")
			})
		}) : null]
	});
}
function me(e) {
	let r = R({
		queryKey: i,
		queryFn: ({ signal: e }) => k(e),
		staleTime: 1e4
	}), o = I(), [l, u] = (0, U.useState)(""), d = () => void o.run("refresh", async () => {
		let e = await r.refetch();
		if (e.error) throw e.error;
		return e.data;
	}, () => u(""), (e) => u(O(e))), f = r.data;
	if (!f && r.isPending) return /* @__PURE__ */ (0, W.jsx)("div", {
		role: "status",
		"aria-label": P("manage:diagnostics.loading"),
		dangerouslySetInnerHTML: { __html: D() }
	});
	if (!f) return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "ui-configpage",
		children: [
			/* @__PURE__ */ (0, W.jsx)(pe, {}),
			/* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				title: P("manage:diagnostics.loadFailed"),
				action: /* @__PURE__ */ (0, W.jsx)(t, {
					variant: "secondary",
					onClick: d,
					...w(o.busy === "refresh"),
					children: P("manage:diagnostics.checkAgain")
				}),
				children: r.error ? O(r.error) : P("manage:diagnostics.reportNotFound")
			}),
			/* @__PURE__ */ (0, W.jsx)(X, {})
		]
	});
	let p = Object.entries(f.checks).filter(([, e]) => [
		"warning",
		"failed",
		"unknown"
	].includes(e.status)), m = Object.entries(f.checks).filter(([, e]) => ![
		"warning",
		"failed",
		"unknown"
	].includes(e.status));
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, W.jsx)("div", {
				"data-guide-target": "report",
				children: /* @__PURE__ */ (0, W.jsx)(Y, {
					kind: "support",
					children: /* @__PURE__ */ (0, W.jsx)(t, {
						variant: "secondary",
						onClick: d,
						...w(o.busy === "refresh"),
						children: P("manage:diagnostics.checkAgain")
					})
				})
			}),
			l ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: l
			}) : null,
			p.length ? /* @__PURE__ */ (0, W.jsx)(g, {
				guide: "attention",
				title: P("manage:diagnostics.attentionTitle", { count: p.length }),
				children: p.map(([e, t]) => /* @__PURE__ */ (0, W.jsx)($, {
					name: e,
					check: t
				}, e))
			}) : null,
			/* @__PURE__ */ (0, W.jsx)(g, {
				guide: "health",
				title: P("manage:diagnostics.collectionHealth"),
				children: /* @__PURE__ */ (0, W.jsxs)(y, { children: [f.library.issue_at ? /* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: P("manage:diagnostics.healthRecordedAtTime", { time: Z(f.library.issue_at) })
				}) : null, Object.entries(f.library.groups).map(([t, n]) => /* @__PURE__ */ (0, W.jsx)(le, {
					group: n,
					...e
				}, t))] })
			}),
			m.length ? /* @__PURE__ */ (0, W.jsx)("section", {
				"aria-label": P("manage:diagnostics.systemChecks"),
				children: /* @__PURE__ */ (0, W.jsx)(a, {
					summary: P("manage:diagnostics.otherChecks", { count: m.length }),
					contentClassName: "gap-5",
					children: fe.map(([e, t]) => {
						let n = m.filter(([e]) => t.some((t) => t === e));
						return n.length ? /* @__PURE__ */ (0, W.jsxs)("section", {
							"aria-label": e,
							"data-diagnostic-group": "",
							className: "flex min-w-0 flex-col gap-2",
							children: [/* @__PURE__ */ (0, W.jsxs)("h3", {
								className: "flex items-center gap-2 px-3 text-body-medium text-text-primary",
								children: [e, /* @__PURE__ */ (0, W.jsx)("span", {
									className: "text-caption-1-regular text-text-secondary",
									children: P("manage:diagnostics.groupCount", { count: n.length })
								})]
							}), /* @__PURE__ */ (0, W.jsx)(_, { children: n.map(([e, t]) => /* @__PURE__ */ (0, W.jsx)($, {
								name: e,
								check: t,
								compact: !0
							}, e)) })]
						}, e) : null;
					})
				})
			}) : null,
			/* @__PURE__ */ (0, W.jsx)(X, {}),
			/* @__PURE__ */ (0, W.jsxs)("section", {
				"data-guide-target": "sessions",
				"aria-label": P("manage:diagnostics.sourceSessions"),
				className: "flex min-w-0 flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, W.jsx)(v, { children: P("manage:diagnostics.sourceSessions") }),
					f.sources.map((e) => /* @__PURE__ */ (0, W.jsx)("article", {
						"data-diagnostic-source": e.source,
						children: /* @__PURE__ */ (0, W.jsx)(_, { children: /* @__PURE__ */ (0, W.jsxs)(y, { children: [
							/* @__PURE__ */ (0, W.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, W.jsxs)("h3", {
									className: "flex min-w-0 items-center gap-2 text-body-medium text-text-primary",
									children: [/* @__PURE__ */ (0, W.jsx)(V, { source: e.source }), e.label]
								}), /* @__PURE__ */ (0, W.jsx)(Q, { status: e.status })]
							}),
							/* @__PURE__ */ (0, W.jsx)(B, {
								text: T(e, "reason"),
								className: "text-body-regular text-text-primary"
							}),
							/* @__PURE__ */ (0, W.jsxs)(c, { children: [
								/* @__PURE__ */ (0, W.jsx)(s, {
									term: P("manage:diagnostics.lastSuccess"),
									children: e.last_success_at ? Z(e.last_success_at) : P("manage:diagnostics.noSuccessYet")
								}),
								e.last_check_at ? /* @__PURE__ */ (0, W.jsxs)(s, {
									term: P("manage:diagnostics.lastChecked"),
									children: [Z(e.last_check_at), e.elapsed_s !== void 0 && e.elapsed_s !== null ? P("manage:diagnostics.checkDuration", { seconds: e.elapsed_s.toFixed(2) }) : ""]
								}) : null,
								/* @__PURE__ */ (0, W.jsx)(s, {
									term: P("manage:diagnostics.pausedUntil"),
									children: e.cooldown_until ? Z(e.cooldown_until) : P("manage:diagnostics.notPaused")
								})
							] })
						] }) })
					}, e.source)),
					/* @__PURE__ */ (0, W.jsx)("div", { children: /* @__PURE__ */ (0, W.jsx)(n, {
						size: "small",
						variant: "secondary",
						href: "/sources",
						children: P("manage:diagnostics.openSources")
					}) })
				]
			})
		]
	});
}
export { me as DiagnosticsPage };

//# debugId=8abf3753-f097-4c2c-9a51-c9a5e212022f