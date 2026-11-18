(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "a9c7afbb-439b-4fa3-bcc5-54ceec099419", e._sentryDebugIdIdentifier = "sentry-dbid-a9c7afbb-439b-4fa3-bcc5-54ceec099419");
	} catch {}
})();
import { ApiError as e, BC as t, Button as n, ButtonLink as r, Chip as i, DIAGNOSTICS_KEY as a, Disclosure as o, EmptyState as s, Fact as c, FactList as l, Fieldset as u, FieldsetTitle as d, Gg as f, Input as p, ItemLibrary as m, LOC as ee, LinkButton as h, Note as g, Section as _, SettingsCard as v, SettingsSectionLabel as y, SiteMark as b, Stack as x, TaskProgress as S, __toESM as C, activityKind as w, apiGet as T, apiSend as E, busyProps as D, checkText$1 as O, codedText as k, configurationSection as A, cx as j, diagnosticHeaders as te, diagnosticsSkeleton as ne, errorMessage as M, fetchDiagnostics as re, fmtDur as ie, fmtSize as N, interfaceLanguage as ae, queryClient as oe, require_jsx_runtime as se, require_react as ce, settingsPath as le, stageText as P, t as F, tl as I, useAction as L, useLibraryFilterOptions as R, useLibraryTints as z, useQuery as B, withBackoff as V } from "./peach-app.js";
import { ErrorExcerpt as H } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as U } from "./peach-app.data-table-CYTfz3fV.js";
// src/react/diagnostics/health-list.tsx
var W = /* @__PURE__ */ C(ce(), 1), G = se(), K = (e) => e.title || e.name || e.code || F("manage:healthList.videoFallback", { id: e.id }), ue = (e, t) => [[
	F("manage:shared.video"),
	F("manage:shared.code"),
	F("manage:shared.fileName"),
	F("manage:shared.library"),
	F("manage:shared.path"),
	F("manage:healthList.durationSeconds"),
	F("manage:healthList.sizeBytes")
], ...e.map((e) => [
	K(e),
	e.code ?? "",
	e.name,
	t(e),
	e.path,
	e.duration ?? "",
	e.size ?? ""
])].map((e) => e.map((e) => String(e ?? "").replace(/[\t\r\n]+/g, " ")).join("	")).join("\n");
function de({ group: e, groupKey: r, openItem: i, receipt: a }) {
	let [c, l] = (0, W.useState)({}), u = JSON.stringify(c), d = B({
		queryKey: [
			"diagnostics-library",
			r,
			u,
			e
		],
		enabled: u !== "{}",
		queryFn: ({ signal: e }) => T(`/api/diagnostics/library?${new URLSearchParams({
			group: r,
			column_filters: u
		})}`, e),
		placeholderData: (e) => e
	}), p = u === "{}" ? e : d.data ?? e, _ = R(), v = L(), y = k(p, "label"), [b, S] = (0, W.useState)([]), C = z({ names: !0 }), w = (e) => C.get(e.library_id || "")?.name || ee[e.location] || e.location, E = (e) => void v.run("copy", () => navigator.clipboard.writeText(ue(e, w)), () => a(F("manage:healthList.copied"))), O = [
		{
			id: "title",
			label: F("manage:shared.video"),
			value: K,
			render: (e) => /* @__PURE__ */ (0, G.jsxs)("span", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, G.jsx)(h, {
					variant: "primary",
					title: K(e),
					"data-health-title": "",
					className: "max-w-full justify-start whitespace-normal text-left",
					onClick: () => i(e.id),
					children: /* @__PURE__ */ (0, G.jsx)("span", {
						className: "line-clamp-2 wrap-anywhere",
						children: K(e)
					})
				}), e.name && e.name !== K(e) ? /* @__PURE__ */ (0, G.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.name,
					className: "block min-w-0 text-caption-1-regular text-text-secondary",
					children: e.name
				}) : null]
			})
		},
		{
			id: "code",
			label: F("manage:shared.code"),
			width: 144,
			value: (e) => e.code || "",
			render: (e) => /* @__PURE__ */ (0, G.jsx)("span", {
				className: "whitespace-nowrap",
				children: e.code || F("manage:shared.unrecognized")
			})
		},
		{
			id: "location",
			label: F("manage:shared.library"),
			width: 160,
			value: w,
			filter: {
				values: (e) => e.library_id || "none",
				option: (e) => _.get(e) ?? { label: e === "none" ? F("cleanup:shared.none") : e }
			},
			render: (e) => /* @__PURE__ */ (0, G.jsx)(m, {
				libraryId: e.library_id,
				location: e.location,
				fallback: F("manage:shared.notFound")
			})
		},
		{
			id: "path",
			label: F("manage:healthList.filePath"),
			width: 320,
			min: 180,
			value: (e) => e.path,
			render: (e) => /* @__PURE__ */ (0, G.jsx)("span", {
				"data-middle-truncate": !0,
				title: e.path,
				className: "block min-w-0 w-full text-body-2-regular text-text-secondary",
				children: e.path || F("manage:shared.notFound")
			})
		},
		{
			id: "duration",
			label: F("manage:shared.duration"),
			width: 112,
			value: (e) => e.duration ?? 0,
			filter: {
				range: "duration",
				value: (e) => e.duration || null
			},
			render: (e) => e.duration && e.duration > 0 ? ie(e.duration) : F("manage:shared.notFound")
		},
		{
			id: "size",
			label: F("manage:shared.size"),
			width: 112,
			value: (e) => e.size ?? 0,
			filter: {
				range: "size",
				value: (e) => e.size
			},
			render: (e) => e.size === null ? F("manage:shared.notFound") : N(e.size)
		}
	];
	return /* @__PURE__ */ (0, G.jsx)(o, {
		summary: p.count === null ? `${y} · ${F("manage:shared.notFound")}` : F("manage:healthList.groupSummary", {
			label: y,
			count: p.count
		}),
		children: p.count === null ? /* @__PURE__ */ (0, G.jsx)(g, {
			tone: "neutral",
			children: F("manage:healthList.listNotFound")
		}) : e.items.length ? /* @__PURE__ */ (0, G.jsxs)(x, { children: [
			/* @__PURE__ */ (0, G.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [p.truncated ? /* @__PURE__ */ (0, G.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:healthList.loadedCount", {
						loaded: p.items.length,
						count: p.count
					})
				}) : null, /* @__PURE__ */ (0, G.jsx)(n, {
					size: "small",
					variant: "secondary",
					...D(v.busy === "copy"),
					onClick: () => E(p.items),
					children: F("manage:healthList.copyList")
				})]
			}),
			v.error ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				children: v.error
			}) : null,
			d.isError ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				children: String(d.error)
			}) : null,
			/* @__PURE__ */ (0, G.jsx)(U, {
				label: y,
				title: F("manage:healthList.tableTitle"),
				unit: F("manage:healthList.tableUnit"),
				panel: !1,
				busy: d.isFetching,
				filters: {
					values: c,
					facets: p.column_facets ?? {},
					onChange: l
				},
				items: p.items,
				columns: O,
				rowId: (e) => String(e.id),
				rowLabel: K,
				selected: b,
				onSelected: S,
				contextOperations: (e) => [{
					id: "open",
					label: F("catalog:mediaActions.open"),
					icon: f,
					run: () => i(e.id)
				}, {
					id: "copy",
					label: F("manage:healthList.copyRow"),
					icon: t,
					disabled: v.busy === "copy",
					run: () => E([e])
				}],
				actions: () => [],
				controls: (e) => /* @__PURE__ */ (0, G.jsx)(n, {
					size: "small",
					variant: "secondary",
					...D(v.busy === "copy"),
					onClick: () => E(e),
					children: F("manage:healthList.copySelected")
				})
			})
		] }) : /* @__PURE__ */ (0, G.jsx)(s, {
			icon: I,
			title: F("manage:healthList.emptyTitle"),
			size: "compact",
			children: F("manage:healthList.emptyBody")
		})
	});
}
// src/react/diagnostics/scraping-export.tsx
var q = "/api/diagnostics/exports", J = ["diagnostic-export"], fe = V((e) => ["running", "cancelling"].includes(e?.status || "") ? 1e3 : !1);
function Y({ kind: t, codes: i = "", children: a }) {
	let o = L(), s = B({
		queryKey: J,
		queryFn: ({ signal: e }) => T(q, e),
		refetchInterval: fe
	}), c = s.data, l = c?.kind === t, u = c?.status === "running" || c?.status === "cancelling", d = F(t === "support" ? "manage:diagnosticsExport.downloadReport" : "manage:diagnosticsExport.exportFetchLog"), f = (e) => {
		oe.setQueryData(J, e);
	}, p = () => void o.run("start", async (n) => {
		let r = await fetch(q, {
			method: "POST",
			signal: n,
			credentials: "same-origin",
			headers: {
				...await te(),
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				kind: t,
				codes: i
			})
		}), a = await r.json().catch(() => null);
		if (!r.ok) throw new e(a?.detail || a?.error || F("manage:diagnosticsExport.startFailed"), r.status, a);
		if (!a || !a.job_id) throw Error(F("manage:diagnosticsExport.statusNotFound"));
		return a;
	}, f), m = () => void o.run("cancel", (e) => E(`${q}/${c.job_id}/cancel`, {}, "POST", e), f);
	return /* @__PURE__ */ (0, G.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, G.jsxs)("div", {
				className: t === "support" ? "flex flex-wrap justify-end gap-2" : "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, G.jsx)(n, {
						type: "button",
						variant: "secondary",
						disabled: u,
						...D(o.busy === "start"),
						onClick: p,
						children: d
					}),
					l && u ? /* @__PURE__ */ (0, G.jsx)(n, {
						type: "button",
						variant: "secondary",
						disabled: c.status === "cancelling",
						...D(o.busy === "cancel"),
						onClick: m,
						children: F("manage:diagnosticsExport.cancelExport")
					}) : null,
					l && c.status === "complete" && c.download_url ? /* @__PURE__ */ (0, G.jsx)(r, {
						variant: "secondary",
						href: c.download_url,
						children: F("manage:diagnosticsExport.downloadFile")
					}) : null,
					a
				]
			}),
			l && u ? /* @__PURE__ */ (0, G.jsx)(S, {
				embedded: t === "scraping",
				kind: w("diagnostic-export", c.stage_code),
				value: c.done || 0,
				total: c.total,
				label: c.total ? F("manage:diagnosticsExport.progress", {
					stage: P(c),
					done: c.done || 0,
					count: c.total
				}) : [
					P(c) || F("manage:diagnosticsExport.preparing"),
					c.rows ? F("manage:diagnosticsExport.candidateCount", { count: c.rows }) : "",
					c.files ? F("manage:diagnosticsExport.fileCount", { count: c.files }) : ""
				].filter(Boolean).join(" · ")
			}) : null,
			l && c.status === "complete" ? /* @__PURE__ */ (0, G.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-secondary",
				children: F("manage:diagnosticsExport.completedSize", { size: ((c.bytes || 0) / 1024 / 1024).toFixed(2) })
			}) : null,
			l && c.status === "cancelled" ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "neutral",
				children: F("manage:diagnosticsExport.canceled")
			}) : null,
			s.isError ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				action: /* @__PURE__ */ (0, G.jsx)(n, {
					type: "button",
					variant: "secondary",
					...D(s.isFetching),
					onClick: () => {
						s.refetch();
					},
					children: F("manage:diagnosticsExport.reload")
				}),
				children: F("manage:diagnosticsExport.progressNotFound")
			}) : null,
			o.error || l && c.status === "failed" ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				children: o.error || c?.error
			}) : null
		]
	});
}
function X() {
	let [e, t] = (0, W.useState)("");
	return /* @__PURE__ */ (0, G.jsx)(u, {
		layout: "stack",
		labelledBy: "scraping-export-title",
		footer: /* @__PURE__ */ (0, G.jsx)(Y, {
			kind: "scraping",
			codes: e
		}),
		children: /* @__PURE__ */ (0, G.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			"aria-label": F("manage:diagnosticsExport.exportFetchLog"),
			children: [
				/* @__PURE__ */ (0, G.jsx)(d, {
					id: "scraping-export-title",
					children: F("manage:diagnosticsExport.fetchLogTitle")
				}),
				/* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnosticsExport.fetchLogHint")
				}),
				/* @__PURE__ */ (0, G.jsx)(p, {
					label: F("manage:diagnosticsExport.codesLabel"),
					name: "scraping-codes",
					value: e,
					onChange: t,
					autoComplete: "off",
					spellCheck: "false",
					maxLength: 1300,
					placeholder: F("manage:diagnosticsExport.codesPlaceholder"),
					hint: F("manage:diagnosticsExport.codesHint")
				})
			]
		})
	});
}
// src/react/diagnostics/diagnostics-page.tsx
var pe = {
	ok: F("manage:diagnostics.statusOk"),
	warning: F("manage:diagnostics.statusWarning"),
	failed: F("manage:diagnostics.statusFailed"),
	unknown: F("manage:shared.notFound"),
	disabled: F("manage:diagnostics.statusDisabled"),
	stale: F("manage:diagnostics.statusStale"),
	unchecked: F("manage:diagnostics.statusUnchecked")
}, me = { "/tasks": F("manage:diagnostics.viewTasks") }, he = [
	[F("manage:diagnostics.groupLibraries"), ["media_mounts", "data_root"]],
	[F("manage:diagnostics.groupDatabase"), ["database", "schema"]],
	[F("manage:diagnostics.groupTools"), ["ffmpeg"]],
	[F("manage:diagnostics.groupConfig"), [
		"configured",
		"security",
		"port",
		"version"
	]],
	[F("manage:diagnostics.groupTasks"), ["tasks"]]
], Z = (e) => new Date(e).toLocaleString(ae);
function Q({ status: e }) {
	return /* @__PURE__ */ (0, G.jsx)(i, {
		variant: "caption",
		"data-diagnostic-status": e,
		color: e === "failed" ? "rose" : e === "ok" ? "lime" : e === "warning" || e === "stale" ? "yellow" : "neutral",
		children: pe[e] ?? F("manage:shared.notFound")
	});
}
function ge() {
	return /* @__PURE__ */ (0, G.jsx)(Y, { kind: "support" });
}
function $({ name: e, check: t, compact: n = !1 }) {
	let i = t.target === "/settings/library" && (e === "security" || e === "port") ? le("network") : t.target, a = n ? "h4" : "h3", o = O(t);
	return /* @__PURE__ */ (0, G.jsxs)("div", {
		"data-diagnostic-check": e,
		className: j("flex flex-col gap-4 border-b border-separator-border pr-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", n ? "py-3" : "py-5"),
		children: [/* @__PURE__ */ (0, G.jsxs)("div", {
			className: j("flex min-w-0 flex-1 flex-col", n ? "gap-1" : "gap-2"),
			children: [
				/* @__PURE__ */ (0, G.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, G.jsx)(a, {
						className: j("text-text-primary", n ? "text-body-2-medium" : "text-body-medium"),
						children: o.label
					}), /* @__PURE__ */ (0, G.jsx)(Q, { status: t.status })]
				}),
				/* @__PURE__ */ (0, G.jsx)("p", {
					"data-check-reason": !0,
					className: j("text-body-2-regular break-words", n ? "text-text-secondary" : "text-text-primary"),
					children: o.reason
				}),
				o.action ? /* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnostics.suggestedFixText", { action: o.action })
				}) : null
			]
		}), i ? /* @__PURE__ */ (0, G.jsx)("div", {
			className: "shrink-0 self-end sm:self-auto",
			children: /* @__PURE__ */ (0, G.jsx)(r, {
				size: "small",
				variant: "secondary",
				href: i,
				children: i.startsWith("/settings/") ? F("manage:diagnostics.openSection", { section: A(i) }) : me[i] ?? F("manage:diagnostics.openRelated")
			})
		}) : null]
	});
}
function _e(e) {
	let t = B({
		queryKey: a,
		queryFn: ({ signal: e }) => re(e),
		staleTime: 1e4
	}), i = L(), [s, u] = (0, W.useState)(""), d = () => void i.run("refresh", async () => {
		let e = await t.refetch();
		if (e.error) throw e.error;
		return e.data;
	}, () => u(""), (e) => u(M(e))), f = t.data;
	if (!f && t.isPending) return /* @__PURE__ */ (0, G.jsx)("div", {
		role: "status",
		"aria-label": F("manage:diagnostics.loading"),
		dangerouslySetInnerHTML: { __html: ne() }
	});
	if (!f) return /* @__PURE__ */ (0, G.jsxs)("div", {
		className: "ui-configpage",
		children: [
			/* @__PURE__ */ (0, G.jsx)(ge, {}),
			/* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				title: F("manage:diagnostics.loadFailed"),
				action: /* @__PURE__ */ (0, G.jsx)(n, {
					variant: "secondary",
					onClick: d,
					...D(i.busy === "refresh"),
					children: F("manage:diagnostics.checkAgain")
				}),
				children: t.error ? M(t.error) : F("manage:diagnostics.reportNotFound")
			}),
			/* @__PURE__ */ (0, G.jsx)(X, {})
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
	return /* @__PURE__ */ (0, G.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-6",
		children: [
			/* @__PURE__ */ (0, G.jsx)("div", {
				"data-guide-target": "report",
				children: /* @__PURE__ */ (0, G.jsx)(Y, {
					kind: "support",
					children: /* @__PURE__ */ (0, G.jsx)(n, {
						variant: "secondary",
						onClick: d,
						...D(i.busy === "refresh"),
						children: F("manage:diagnostics.checkAgain")
					})
				})
			}),
			s ? /* @__PURE__ */ (0, G.jsx)(g, {
				tone: "error",
				children: s
			}) : null,
			p.length ? /* @__PURE__ */ (0, G.jsx)(_, {
				guide: "attention",
				title: F("manage:diagnostics.attentionTitle", { count: p.length }),
				children: p.map(([e, t]) => /* @__PURE__ */ (0, G.jsx)($, {
					name: e,
					check: t
				}, e))
			}) : null,
			/* @__PURE__ */ (0, G.jsx)(_, {
				guide: "health",
				title: F("manage:diagnostics.collectionHealth"),
				children: /* @__PURE__ */ (0, G.jsxs)(x, { children: [f.library.issue_at ? /* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnostics.healthRecordedAtTime", { time: Z(f.library.issue_at) })
				}) : null, Object.entries(f.library.groups).map(([t, n]) => /* @__PURE__ */ (0, G.jsx)(de, {
					groupKey: t,
					group: n,
					...e
				}, t))] })
			}),
			m.length ? /* @__PURE__ */ (0, G.jsx)("section", {
				"aria-label": F("manage:diagnostics.systemChecks"),
				children: /* @__PURE__ */ (0, G.jsx)(o, {
					summary: F("manage:diagnostics.otherChecks", { count: m.length }),
					contentClassName: "gap-5",
					children: he.map(([e, t]) => {
						let n = m.filter(([e]) => t.some((t) => t === e));
						return n.length ? /* @__PURE__ */ (0, G.jsxs)("section", {
							"aria-label": e,
							"data-diagnostic-group": "",
							className: "flex min-w-0 flex-col gap-2",
							children: [/* @__PURE__ */ (0, G.jsxs)("h3", {
								className: "flex items-center gap-2 px-3 text-body-medium text-text-primary",
								children: [e, /* @__PURE__ */ (0, G.jsx)("span", {
									className: "text-caption-1-regular text-text-secondary",
									children: F("manage:diagnostics.groupCount", { count: n.length })
								})]
							}), /* @__PURE__ */ (0, G.jsx)(v, { children: n.map(([e, t]) => /* @__PURE__ */ (0, G.jsx)($, {
								name: e,
								check: t,
								compact: !0
							}, e)) })]
						}, e) : null;
					})
				})
			}) : null,
			/* @__PURE__ */ (0, G.jsx)(X, {}),
			/* @__PURE__ */ (0, G.jsxs)("section", {
				"data-guide-target": "sessions",
				"aria-label": F("manage:diagnostics.sourceSessions"),
				className: "flex min-w-0 flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, G.jsx)(y, { children: F("manage:diagnostics.sourceSessions") }),
					f.sources.map((e) => /* @__PURE__ */ (0, G.jsx)("article", {
						"data-diagnostic-source": e.source,
						children: /* @__PURE__ */ (0, G.jsx)(v, { children: /* @__PURE__ */ (0, G.jsxs)(x, { children: [
							/* @__PURE__ */ (0, G.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, G.jsxs)("h3", {
									className: "flex min-w-0 items-center gap-2 text-body-medium text-text-primary",
									children: [/* @__PURE__ */ (0, G.jsx)(b, { source: e.source }), e.label]
								}), /* @__PURE__ */ (0, G.jsx)(Q, { status: e.status })]
							}),
							/* @__PURE__ */ (0, G.jsx)(H, {
								text: k(e, "reason"),
								className: "text-body-regular text-text-primary"
							}),
							/* @__PURE__ */ (0, G.jsxs)(l, { children: [
								/* @__PURE__ */ (0, G.jsx)(c, {
									term: F("manage:diagnostics.lastSuccess"),
									children: e.last_success_at ? Z(e.last_success_at) : F("manage:diagnostics.noSuccessYet")
								}),
								e.last_check_at ? /* @__PURE__ */ (0, G.jsxs)(c, {
									term: F("manage:diagnostics.lastChecked"),
									children: [Z(e.last_check_at), e.elapsed_s !== void 0 && e.elapsed_s !== null ? F("manage:diagnostics.checkDuration", { seconds: e.elapsed_s.toFixed(2) }) : ""]
								}) : null,
								/* @__PURE__ */ (0, G.jsx)(c, {
									term: F("manage:diagnostics.pausedUntil"),
									children: e.cooldown_until ? Z(e.cooldown_until) : F("manage:diagnostics.notPaused")
								})
							] })
						] }) })
					}, e.source)),
					/* @__PURE__ */ (0, G.jsx)("div", { children: /* @__PURE__ */ (0, G.jsx)(r, {
						size: "small",
						variant: "secondary",
						href: "/sources",
						children: F("manage:diagnostics.openSources")
					}) })
				]
			})
		]
	});
}
export { _e as DiagnosticsPage };

//# debugId=a9c7afbb-439b-4fa3-bcc5-54ceec099419