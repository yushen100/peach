(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "1087dcde-8dae-43c4-abc6-908a04cf9868", e._sentryDebugIdIdentifier = "sentry-dbid-1087dcde-8dae-43c4-abc6-908a04cf9868");
	} catch {}
})();
import { ApiError as e, Button as t, ButtonLink as n, Chip as r, DIAGNOSTICS_KEY as i, Disclosure as a, EmptyState as o, Fact as s, FactList as c, Fieldset as l, FieldsetTitle as u, Input as d, ItemLibrary as f, LOC as p, LinkButton as m, Note as h, Section as g, SettingsCard as _, SettingsSectionLabel as v, SiteMark as ee, Stack as y, TaskProgress as b, __toESM as x, activityKind as S, apiGet as C, apiSend as w, busyProps as T, checkText$1 as te, codedText as E, configurationSection as ne, cx as D, diagnosticHeaders as O, diagnosticsSkeleton as k, errorMessage as A, fetchDiagnostics as j, fmtDur as re, fmtSize as ie, interfaceLanguage as ae, queryClient as oe, require_jsx_runtime as M, require_react as N, settingsPath as P, stageText as F, t as I, tl as L, useAction as R, useLibraryTints as z, useQuery as B, withBackoff as V } from "./peach-app.js";
import { ErrorExcerpt as H } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as U } from "./peach-app.data-table-DYj6ojEJ.js";
// src/react/diagnostics/health-list.tsx
var W = /* @__PURE__ */ x(N(), 1), G = M(), K = (e) => e.title || e.name || e.code || I("manage:healthList.videoFallback", { id: e.id }), se = (e, t) => [[
	I("manage:shared.video"),
	I("manage:shared.code"),
	I("manage:shared.fileName"),
	I("manage:shared.library"),
	I("manage:shared.path"),
	I("manage:healthList.durationSeconds"),
	I("manage:healthList.sizeBytes")
], ...e.map((e) => [
	K(e),
	e.code ?? "",
	e.name,
	t(e),
	e.path,
	e.duration ?? "",
	e.size ?? ""
])].map((e) => e.map((e) => String(e ?? "").replace(/[\t\r\n]+/g, " ")).join("	")).join("\n");
function ce({ group: e, openItem: n, receipt: r }) {
	let i = R(), s = E(e, "label"), [c, l] = (0, W.useState)([]), u = z({ names: !0 }), d = (e) => u.get(e.library_id || "")?.name || p[e.location] || e.location, g = (e) => void i.run("copy", () => navigator.clipboard.writeText(se(e, d)), () => r(I("manage:healthList.copied"))), _ = [
		{
			id: "title",
			label: I("manage:shared.video"),
			value: K,
			render: (e) => /* @__PURE__ */ (0, G.jsxs)("span", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, G.jsx)(m, {
					variant: "primary",
					title: K(e),
					"data-health-title": "",
					className: "max-w-full justify-start whitespace-normal text-left",
					onClick: () => n(e.id),
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
			label: I("manage:shared.code"),
			width: 144,
			value: (e) => e.code || "",
			render: (e) => /* @__PURE__ */ (0, G.jsx)("span", {
				className: "whitespace-nowrap",
				children: e.code || I("manage:shared.unrecognized")
			})
		},
		{
			id: "location",
			label: I("manage:shared.library"),
			width: 160,
			value: d,
			render: (e) => /* @__PURE__ */ (0, G.jsx)(f, {
				libraryId: e.library_id,
				location: e.location,
				fallback: I("manage:shared.notFound")
			})
		},
		{
			id: "path",
			label: I("manage:healthList.filePath"),
			width: 320,
			min: 180,
			value: (e) => e.path,
			render: (e) => /* @__PURE__ */ (0, G.jsx)("span", {
				"data-middle-truncate": !0,
				title: e.path,
				className: "block min-w-0 w-full text-body-2-regular text-text-secondary",
				children: e.path || I("manage:shared.notFound")
			})
		},
		{
			id: "duration",
			label: I("manage:shared.duration"),
			width: 112,
			value: (e) => e.duration ?? 0,
			render: (e) => e.duration && e.duration > 0 ? re(e.duration) : I("manage:shared.notFound")
		},
		{
			id: "size",
			label: I("manage:shared.size"),
			width: 112,
			value: (e) => e.size ?? 0,
			render: (e) => e.size === null ? I("manage:shared.notFound") : ie(e.size)
		}
	];
	return /* @__PURE__ */ (0, G.jsx)(a, {
		summary: e.count === null ? `${s} · ${I("manage:shared.notFound")}` : I("manage:healthList.groupSummary", {
			label: s,
			count: e.count
		}),
		children: e.count === null ? /* @__PURE__ */ (0, G.jsx)(h, {
			tone: "neutral",
			children: I("manage:healthList.listNotFound")
		}) : e.items.length ? /* @__PURE__ */ (0, G.jsxs)(y, { children: [
			/* @__PURE__ */ (0, G.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [e.truncated ? /* @__PURE__ */ (0, G.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: I("manage:healthList.loadedCount", {
						loaded: e.items.length,
						count: e.count
					})
				}) : null, /* @__PURE__ */ (0, G.jsx)(t, {
					size: "small",
					variant: "secondary",
					...T(i.busy === "copy"),
					onClick: () => g(e.items),
					children: I("manage:healthList.copyList")
				})]
			}),
			i.error ? /* @__PURE__ */ (0, G.jsx)(h, {
				tone: "error",
				children: i.error
			}) : null,
			/* @__PURE__ */ (0, G.jsx)(U, {
				label: s,
				title: I("manage:healthList.tableTitle"),
				unit: I("manage:healthList.tableUnit"),
				panel: !1,
				items: e.items,
				columns: _,
				rowId: (e) => String(e.id),
				rowLabel: K,
				selected: c,
				onSelected: l,
				actions: () => [],
				controls: (e) => /* @__PURE__ */ (0, G.jsx)(t, {
					size: "small",
					variant: "secondary",
					...T(i.busy === "copy"),
					onClick: () => g(e),
					children: I("manage:healthList.copySelected")
				})
			})
		] }) : /* @__PURE__ */ (0, G.jsx)(o, {
			icon: L,
			title: I("manage:healthList.emptyTitle"),
			size: "compact",
			children: I("manage:healthList.emptyBody")
		})
	});
}
// src/react/diagnostics/scraping-export.tsx
var q = "/api/diagnostics/exports", J = ["diagnostic-export"], le = V((e) => ["running", "cancelling"].includes(e?.status || "") ? 1e3 : !1);
function Y({ kind: r, codes: i = "", children: a }) {
	let o = R(), s = B({
		queryKey: J,
		queryFn: ({ signal: e }) => C(q, e),
		refetchInterval: le
	}), c = s.data, l = c?.kind === r, u = c?.status === "running" || c?.status === "cancelling", d = I(r === "support" ? "manage:diagnosticsExport.downloadReport" : "manage:diagnosticsExport.exportFetchLog"), f = (e) => {
		oe.setQueryData(J, e);
	}, p = () => void o.run("start", async (t) => {
		let n = await fetch(q, {
			method: "POST",
			signal: t,
			credentials: "same-origin",
			headers: {
				...await O(),
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				kind: r,
				codes: i
			})
		}), a = await n.json().catch(() => null);
		if (!n.ok) throw new e(a?.detail || a?.error || I("manage:diagnosticsExport.startFailed"), n.status, a);
		if (!a || !a.job_id) throw Error(I("manage:diagnosticsExport.statusNotFound"));
		return a;
	}, f), m = () => void o.run("cancel", (e) => w(`${q}/${c.job_id}/cancel`, {}, "POST", e), f);
	return /* @__PURE__ */ (0, G.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, G.jsxs)("div", {
				className: r === "support" ? "flex flex-wrap justify-end gap-2" : "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, G.jsx)(t, {
						type: "button",
						variant: "secondary",
						disabled: u,
						...T(o.busy === "start"),
						onClick: p,
						children: d
					}),
					l && u ? /* @__PURE__ */ (0, G.jsx)(t, {
						type: "button",
						variant: "secondary",
						disabled: c.status === "cancelling",
						...T(o.busy === "cancel"),
						onClick: m,
						children: I("manage:diagnosticsExport.cancelExport")
					}) : null,
					l && c.status === "complete" && c.download_url ? /* @__PURE__ */ (0, G.jsx)(n, {
						variant: "secondary",
						href: c.download_url,
						children: I("manage:diagnosticsExport.downloadFile")
					}) : null,
					a
				]
			}),
			l && u ? /* @__PURE__ */ (0, G.jsx)(b, {
				embedded: r === "scraping",
				kind: S("diagnostic-export", c.stage_code),
				value: c.done || 0,
				total: c.total,
				label: c.total ? I("manage:diagnosticsExport.progress", {
					stage: F(c),
					done: c.done || 0,
					count: c.total
				}) : [
					F(c) || I("manage:diagnosticsExport.preparing"),
					c.rows ? I("manage:diagnosticsExport.candidateCount", { count: c.rows }) : "",
					c.files ? I("manage:diagnosticsExport.fileCount", { count: c.files }) : ""
				].filter(Boolean).join(" · ")
			}) : null,
			l && c.status === "complete" ? /* @__PURE__ */ (0, G.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-secondary",
				children: I("manage:diagnosticsExport.completedSize", { size: ((c.bytes || 0) / 1024 / 1024).toFixed(2) })
			}) : null,
			l && c.status === "cancelled" ? /* @__PURE__ */ (0, G.jsx)(h, {
				tone: "neutral",
				children: I("manage:diagnosticsExport.canceled")
			}) : null,
			s.isError ? /* @__PURE__ */ (0, G.jsx)(h, {
				tone: "error",
				action: /* @__PURE__ */ (0, G.jsx)(t, {
					type: "button",
					variant: "secondary",
					...T(s.isFetching),
					onClick: () => {
						s.refetch();
					},
					children: I("manage:diagnosticsExport.reload")
				}),
				children: I("manage:diagnosticsExport.progressNotFound")
			}) : null,
			o.error || l && c.status === "failed" ? /* @__PURE__ */ (0, G.jsx)(h, {
				tone: "error",
				children: o.error || c?.error
			}) : null
		]
	});
}
function X() {
	let [e, t] = (0, W.useState)("");
	return /* @__PURE__ */ (0, G.jsx)(l, {
		layout: "stack",
		labelledBy: "scraping-export-title",
		footer: /* @__PURE__ */ (0, G.jsx)(Y, {
			kind: "scraping",
			codes: e
		}),
		children: /* @__PURE__ */ (0, G.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			"aria-label": I("manage:diagnosticsExport.exportFetchLog"),
			children: [
				/* @__PURE__ */ (0, G.jsx)(u, {
					id: "scraping-export-title",
					children: I("manage:diagnosticsExport.fetchLogTitle")
				}),
				/* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: I("manage:diagnosticsExport.fetchLogHint")
				}),
				/* @__PURE__ */ (0, G.jsx)(d, {
					label: I("manage:diagnosticsExport.codesLabel"),
					name: "scraping-codes",
					value: e,
					onChange: t,
					autoComplete: "off",
					spellCheck: "false",
					maxLength: 1300,
					placeholder: I("manage:diagnosticsExport.codesPlaceholder"),
					hint: I("manage:diagnosticsExport.codesHint")
				})
			]
		})
	});
}
// src/react/diagnostics/diagnostics-page.tsx
var ue = {
	ok: I("manage:diagnostics.statusOk"),
	warning: I("manage:diagnostics.statusWarning"),
	failed: I("manage:diagnostics.statusFailed"),
	unknown: I("manage:shared.notFound"),
	disabled: I("manage:diagnostics.statusDisabled"),
	stale: I("manage:diagnostics.statusStale"),
	unchecked: I("manage:diagnostics.statusUnchecked")
}, de = { "/tasks": I("manage:diagnostics.viewTasks") }, fe = [
	[I("manage:diagnostics.groupLibraries"), ["media_mounts", "data_root"]],
	[I("manage:diagnostics.groupDatabase"), ["database", "schema"]],
	[I("manage:diagnostics.groupTools"), ["ffmpeg"]],
	[I("manage:diagnostics.groupConfig"), [
		"configured",
		"security",
		"port",
		"version"
	]],
	[I("manage:diagnostics.groupTasks"), ["tasks"]]
], Z = (e) => new Date(e).toLocaleString(ae);
function Q({ status: e }) {
	return /* @__PURE__ */ (0, G.jsx)(r, {
		variant: "caption",
		"data-diagnostic-status": e,
		color: e === "failed" ? "rose" : e === "ok" ? "lime" : e === "warning" || e === "stale" ? "yellow" : "neutral",
		children: ue[e] ?? I("manage:shared.notFound")
	});
}
function pe() {
	return /* @__PURE__ */ (0, G.jsx)(Y, { kind: "support" });
}
function $({ name: e, check: t, compact: r = !1 }) {
	let i = t.target === "/settings/library" && (e === "security" || e === "port") ? P("network") : t.target, a = r ? "h4" : "h3", o = te(t);
	return /* @__PURE__ */ (0, G.jsxs)("div", {
		"data-diagnostic-check": e,
		className: D("flex flex-col gap-4 border-b border-separator-border pr-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", r ? "py-3" : "py-5"),
		children: [/* @__PURE__ */ (0, G.jsxs)("div", {
			className: D("flex min-w-0 flex-1 flex-col", r ? "gap-1" : "gap-2"),
			children: [
				/* @__PURE__ */ (0, G.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, G.jsx)(a, {
						className: D("text-text-primary", r ? "text-body-2-medium" : "text-body-medium"),
						children: o.label
					}), /* @__PURE__ */ (0, G.jsx)(Q, { status: t.status })]
				}),
				/* @__PURE__ */ (0, G.jsx)("p", {
					"data-check-reason": !0,
					className: D("text-body-2-regular break-words", r ? "text-text-secondary" : "text-text-primary"),
					children: o.reason
				}),
				o.action ? /* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: I("manage:diagnostics.suggestedFixText", { action: o.action })
				}) : null
			]
		}), i ? /* @__PURE__ */ (0, G.jsx)("div", {
			className: "shrink-0 self-end sm:self-auto",
			children: /* @__PURE__ */ (0, G.jsx)(n, {
				size: "small",
				variant: "secondary",
				href: i,
				children: i.startsWith("/settings/") ? I("manage:diagnostics.openSection", { section: ne(i) }) : de[i] ?? I("manage:diagnostics.openRelated")
			})
		}) : null]
	});
}
function me(e) {
	let r = B({
		queryKey: i,
		queryFn: ({ signal: e }) => j(e),
		staleTime: 1e4
	}), o = R(), [l, u] = (0, W.useState)(""), d = () => void o.run("refresh", async () => {
		let e = await r.refetch();
		if (e.error) throw e.error;
		return e.data;
	}, () => u(""), (e) => u(A(e))), f = r.data;
	if (!f && r.isPending) return /* @__PURE__ */ (0, G.jsx)("div", {
		role: "status",
		"aria-label": I("manage:diagnostics.loading"),
		dangerouslySetInnerHTML: { __html: k() }
	});
	if (!f) return /* @__PURE__ */ (0, G.jsxs)("div", {
		className: "ui-configpage",
		children: [
			/* @__PURE__ */ (0, G.jsx)(pe, {}),
			/* @__PURE__ */ (0, G.jsx)(h, {
				tone: "error",
				title: I("manage:diagnostics.loadFailed"),
				action: /* @__PURE__ */ (0, G.jsx)(t, {
					variant: "secondary",
					onClick: d,
					...T(o.busy === "refresh"),
					children: I("manage:diagnostics.checkAgain")
				}),
				children: r.error ? A(r.error) : I("manage:diagnostics.reportNotFound")
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
					children: /* @__PURE__ */ (0, G.jsx)(t, {
						variant: "secondary",
						onClick: d,
						...T(o.busy === "refresh"),
						children: I("manage:diagnostics.checkAgain")
					})
				})
			}),
			l ? /* @__PURE__ */ (0, G.jsx)(h, {
				tone: "error",
				children: l
			}) : null,
			p.length ? /* @__PURE__ */ (0, G.jsx)(g, {
				guide: "attention",
				title: I("manage:diagnostics.attentionTitle", { count: p.length }),
				children: p.map(([e, t]) => /* @__PURE__ */ (0, G.jsx)($, {
					name: e,
					check: t
				}, e))
			}) : null,
			/* @__PURE__ */ (0, G.jsx)(g, {
				guide: "health",
				title: I("manage:diagnostics.collectionHealth"),
				children: /* @__PURE__ */ (0, G.jsxs)(y, { children: [f.library.issue_at ? /* @__PURE__ */ (0, G.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: I("manage:diagnostics.healthRecordedAtTime", { time: Z(f.library.issue_at) })
				}) : null, Object.entries(f.library.groups).map(([t, n]) => /* @__PURE__ */ (0, G.jsx)(ce, {
					group: n,
					...e
				}, t))] })
			}),
			m.length ? /* @__PURE__ */ (0, G.jsx)("section", {
				"aria-label": I("manage:diagnostics.systemChecks"),
				children: /* @__PURE__ */ (0, G.jsx)(a, {
					summary: I("manage:diagnostics.otherChecks", { count: m.length }),
					contentClassName: "gap-5",
					children: fe.map(([e, t]) => {
						let n = m.filter(([e]) => t.some((t) => t === e));
						return n.length ? /* @__PURE__ */ (0, G.jsxs)("section", {
							"aria-label": e,
							"data-diagnostic-group": "",
							className: "flex min-w-0 flex-col gap-2",
							children: [/* @__PURE__ */ (0, G.jsxs)("h3", {
								className: "flex items-center gap-2 px-3 text-body-medium text-text-primary",
								children: [e, /* @__PURE__ */ (0, G.jsx)("span", {
									className: "text-caption-1-regular text-text-secondary",
									children: I("manage:diagnostics.groupCount", { count: n.length })
								})]
							}), /* @__PURE__ */ (0, G.jsx)(_, { children: n.map(([e, t]) => /* @__PURE__ */ (0, G.jsx)($, {
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
				"aria-label": I("manage:diagnostics.sourceSessions"),
				className: "flex min-w-0 flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, G.jsx)(v, { children: I("manage:diagnostics.sourceSessions") }),
					f.sources.map((e) => /* @__PURE__ */ (0, G.jsx)("article", {
						"data-diagnostic-source": e.source,
						children: /* @__PURE__ */ (0, G.jsx)(_, { children: /* @__PURE__ */ (0, G.jsxs)(y, { children: [
							/* @__PURE__ */ (0, G.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, G.jsxs)("h3", {
									className: "flex min-w-0 items-center gap-2 text-body-medium text-text-primary",
									children: [/* @__PURE__ */ (0, G.jsx)(ee, { source: e.source }), e.label]
								}), /* @__PURE__ */ (0, G.jsx)(Q, { status: e.status })]
							}),
							/* @__PURE__ */ (0, G.jsx)(H, {
								text: E(e, "reason"),
								className: "text-body-regular text-text-primary"
							}),
							/* @__PURE__ */ (0, G.jsxs)(c, { children: [
								/* @__PURE__ */ (0, G.jsx)(s, {
									term: I("manage:diagnostics.lastSuccess"),
									children: e.last_success_at ? Z(e.last_success_at) : I("manage:diagnostics.noSuccessYet")
								}),
								e.last_check_at ? /* @__PURE__ */ (0, G.jsxs)(s, {
									term: I("manage:diagnostics.lastChecked"),
									children: [Z(e.last_check_at), e.elapsed_s !== void 0 && e.elapsed_s !== null ? I("manage:diagnostics.checkDuration", { seconds: e.elapsed_s.toFixed(2) }) : ""]
								}) : null,
								/* @__PURE__ */ (0, G.jsx)(s, {
									term: I("manage:diagnostics.pausedUntil"),
									children: e.cooldown_until ? Z(e.cooldown_until) : I("manage:diagnostics.notPaused")
								})
							] })
						] }) })
					}, e.source)),
					/* @__PURE__ */ (0, G.jsx)("div", { children: /* @__PURE__ */ (0, G.jsx)(n, {
						size: "small",
						variant: "secondary",
						href: "/sources",
						children: I("manage:diagnostics.openSources")
					}) })
				]
			})
		]
	});
}
export { me as DiagnosticsPage };

//# debugId=1087dcde-8dae-43c4-abc6-908a04cf9868