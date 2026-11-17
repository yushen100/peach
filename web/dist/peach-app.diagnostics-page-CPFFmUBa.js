(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "d0681971-11b1-48a3-8bb3-5c483fe7d47f", e._sentryDebugIdIdentifier = "sentry-dbid-d0681971-11b1-48a3-8bb3-5c483fe7d47f");
	} catch {}
})();
import { ApiError as e, Button as t, ButtonLink as n, Chip as r, DIAGNOSTICS_KEY as i, Disclosure as a, EmptyState as o, Fact as s, FactList as c, Fieldset as l, FieldsetTitle as u, Input as d, ItemLibrary as f, LOC as p, LinkButton as m, Note as h, Section as g, SettingsCard as _, SettingsSectionLabel as v, SiteMark as y, Stack as b, TaskProgress as x, __toESM as S, activityKind as C, apiGet as w, apiSend as T, busyProps as E, checkText$1 as D, codedText as O, configurationSection as ee, cx as k, diagnosticHeaders as te, diagnosticsSkeleton as ne, errorMessage as A, fetchDiagnostics as j, fmtDur as M, fmtSize as N, interfaceLanguage as re, queryClient as ie, require_jsx_runtime as ae, require_react as oe, settingsPath as se, stageText as P, t as F, tl as ce, useAction as I, useLibraryFilterOptions as L, useLibraryTints as R, useQuery as z, withBackoff as B } from "./peach-app.js";
import { ErrorExcerpt as V } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as H } from "./peach-app.data-table-PbQqv_VV.js";
// src/react/diagnostics/health-list.tsx
var U = /* @__PURE__ */ S(oe(), 1), W = ae(), G = (e) => e.title || e.name || e.code || F("manage:healthList.videoFallback", { id: e.id }), le = (e, t) => [[
	F("manage:shared.video"),
	F("manage:shared.code"),
	F("manage:shared.fileName"),
	F("manage:shared.library"),
	F("manage:shared.path"),
	F("manage:healthList.durationSeconds"),
	F("manage:healthList.sizeBytes")
], ...e.map((e) => [
	G(e),
	e.code ?? "",
	e.name,
	t(e),
	e.path,
	e.duration ?? "",
	e.size ?? ""
])].map((e) => e.map((e) => String(e ?? "").replace(/[\t\r\n]+/g, " ")).join("	")).join("\n");
function ue({ group: e, groupKey: n, openItem: r, receipt: i }) {
	let [s, c] = (0, U.useState)({}), l = JSON.stringify(s), u = z({
		queryKey: [
			"diagnostics-library",
			n,
			l,
			e
		],
		enabled: l !== "{}",
		queryFn: ({ signal: e }) => w(`/api/diagnostics/library?${new URLSearchParams({
			group: n,
			column_filters: l
		})}`, e),
		placeholderData: (e) => e
	}), d = l === "{}" ? e : u.data ?? e, g = L(), _ = I(), v = O(d, "label"), [y, x] = (0, U.useState)([]), S = R({ names: !0 }), C = (e) => S.get(e.library_id || "")?.name || p[e.location] || e.location, T = (e) => void _.run("copy", () => navigator.clipboard.writeText(le(e, C)), () => i(F("manage:healthList.copied"))), D = [
		{
			id: "title",
			label: F("manage:shared.video"),
			value: G,
			render: (e) => /* @__PURE__ */ (0, W.jsxs)("span", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, W.jsx)(m, {
					variant: "primary",
					title: G(e),
					"data-health-title": "",
					className: "max-w-full justify-start whitespace-normal text-left",
					onClick: () => r(e.id),
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
			label: F("manage:shared.code"),
			width: 144,
			value: (e) => e.code || "",
			render: (e) => /* @__PURE__ */ (0, W.jsx)("span", {
				className: "whitespace-nowrap",
				children: e.code || F("manage:shared.unrecognized")
			})
		},
		{
			id: "location",
			label: F("manage:shared.library"),
			width: 160,
			value: C,
			filter: {
				values: (e) => e.library_id || "none",
				option: (e) => g.get(e) ?? { label: e === "none" ? F("cleanup:shared.none") : e }
			},
			render: (e) => /* @__PURE__ */ (0, W.jsx)(f, {
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
			render: (e) => /* @__PURE__ */ (0, W.jsx)("span", {
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
			render: (e) => e.duration && e.duration > 0 ? M(e.duration) : F("manage:shared.notFound")
		},
		{
			id: "size",
			label: F("manage:shared.size"),
			width: 112,
			value: (e) => e.size ?? 0,
			render: (e) => e.size === null ? F("manage:shared.notFound") : N(e.size)
		}
	];
	return /* @__PURE__ */ (0, W.jsx)(a, {
		summary: d.count === null ? `${v} · ${F("manage:shared.notFound")}` : F("manage:healthList.groupSummary", {
			label: v,
			count: d.count
		}),
		children: d.count === null ? /* @__PURE__ */ (0, W.jsx)(h, {
			tone: "neutral",
			children: F("manage:healthList.listNotFound")
		}) : e.items.length ? /* @__PURE__ */ (0, W.jsxs)(b, { children: [
			/* @__PURE__ */ (0, W.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [d.truncated ? /* @__PURE__ */ (0, W.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:healthList.loadedCount", {
						loaded: d.items.length,
						count: d.count
					})
				}) : null, /* @__PURE__ */ (0, W.jsx)(t, {
					size: "small",
					variant: "secondary",
					...E(_.busy === "copy"),
					onClick: () => T(d.items),
					children: F("manage:healthList.copyList")
				})]
			}),
			_.error ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: _.error
			}) : null,
			u.isError ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: String(u.error)
			}) : null,
			/* @__PURE__ */ (0, W.jsx)(H, {
				label: v,
				title: F("manage:healthList.tableTitle"),
				unit: F("manage:healthList.tableUnit"),
				panel: !1,
				busy: u.isFetching,
				filters: {
					values: s,
					facets: d.column_facets ?? {},
					onChange: c
				},
				items: d.items,
				columns: D,
				rowId: (e) => String(e.id),
				rowLabel: G,
				selected: y,
				onSelected: x,
				actions: () => [],
				controls: (e) => /* @__PURE__ */ (0, W.jsx)(t, {
					size: "small",
					variant: "secondary",
					...E(_.busy === "copy"),
					onClick: () => T(e),
					children: F("manage:healthList.copySelected")
				})
			})
		] }) : /* @__PURE__ */ (0, W.jsx)(o, {
			icon: ce,
			title: F("manage:healthList.emptyTitle"),
			size: "compact",
			children: F("manage:healthList.emptyBody")
		})
	});
}
// src/react/diagnostics/scraping-export.tsx
var K = "/api/diagnostics/exports", q = ["diagnostic-export"], de = B((e) => ["running", "cancelling"].includes(e?.status || "") ? 1e3 : !1);
function J({ kind: r, codes: i = "", children: a }) {
	let o = I(), s = z({
		queryKey: q,
		queryFn: ({ signal: e }) => w(K, e),
		refetchInterval: de
	}), c = s.data, l = c?.kind === r, u = c?.status === "running" || c?.status === "cancelling", d = F(r === "support" ? "manage:diagnosticsExport.downloadReport" : "manage:diagnosticsExport.exportFetchLog"), f = (e) => {
		ie.setQueryData(q, e);
	}, p = () => void o.run("start", async (t) => {
		let n = await fetch(K, {
			method: "POST",
			signal: t,
			credentials: "same-origin",
			headers: {
				...await te(),
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				kind: r,
				codes: i
			})
		}), a = await n.json().catch(() => null);
		if (!n.ok) throw new e(a?.detail || a?.error || F("manage:diagnosticsExport.startFailed"), n.status, a);
		if (!a || !a.job_id) throw Error(F("manage:diagnosticsExport.statusNotFound"));
		return a;
	}, f), m = () => void o.run("cancel", (e) => T(`${K}/${c.job_id}/cancel`, {}, "POST", e), f);
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
						...E(o.busy === "start"),
						onClick: p,
						children: d
					}),
					l && u ? /* @__PURE__ */ (0, W.jsx)(t, {
						type: "button",
						variant: "secondary",
						disabled: c.status === "cancelling",
						...E(o.busy === "cancel"),
						onClick: m,
						children: F("manage:diagnosticsExport.cancelExport")
					}) : null,
					l && c.status === "complete" && c.download_url ? /* @__PURE__ */ (0, W.jsx)(n, {
						variant: "secondary",
						href: c.download_url,
						children: F("manage:diagnosticsExport.downloadFile")
					}) : null,
					a
				]
			}),
			l && u ? /* @__PURE__ */ (0, W.jsx)(x, {
				embedded: r === "scraping",
				kind: C("diagnostic-export", c.stage_code),
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
			l && c.status === "complete" ? /* @__PURE__ */ (0, W.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-secondary",
				children: F("manage:diagnosticsExport.completedSize", { size: ((c.bytes || 0) / 1024 / 1024).toFixed(2) })
			}) : null,
			l && c.status === "cancelled" ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "neutral",
				children: F("manage:diagnosticsExport.canceled")
			}) : null,
			s.isError ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				action: /* @__PURE__ */ (0, W.jsx)(t, {
					type: "button",
					variant: "secondary",
					...E(s.isFetching),
					onClick: () => {
						s.refetch();
					},
					children: F("manage:diagnosticsExport.reload")
				}),
				children: F("manage:diagnosticsExport.progressNotFound")
			}) : null,
			o.error || l && c.status === "failed" ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: o.error || c?.error
			}) : null
		]
	});
}
function Y() {
	let [e, t] = (0, U.useState)("");
	return /* @__PURE__ */ (0, W.jsx)(l, {
		layout: "stack",
		labelledBy: "scraping-export-title",
		footer: /* @__PURE__ */ (0, W.jsx)(J, {
			kind: "scraping",
			codes: e
		}),
		children: /* @__PURE__ */ (0, W.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			"aria-label": F("manage:diagnosticsExport.exportFetchLog"),
			children: [
				/* @__PURE__ */ (0, W.jsx)(u, {
					id: "scraping-export-title",
					children: F("manage:diagnosticsExport.fetchLogTitle")
				}),
				/* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnosticsExport.fetchLogHint")
				}),
				/* @__PURE__ */ (0, W.jsx)(d, {
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
var fe = {
	ok: F("manage:diagnostics.statusOk"),
	warning: F("manage:diagnostics.statusWarning"),
	failed: F("manage:diagnostics.statusFailed"),
	unknown: F("manage:shared.notFound"),
	disabled: F("manage:diagnostics.statusDisabled"),
	stale: F("manage:diagnostics.statusStale"),
	unchecked: F("manage:diagnostics.statusUnchecked")
}, X = { "/tasks": F("manage:diagnostics.viewTasks") }, pe = [
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
], Z = (e) => new Date(e).toLocaleString(re);
function Q({ status: e }) {
	return /* @__PURE__ */ (0, W.jsx)(r, {
		variant: "caption",
		"data-diagnostic-status": e,
		color: e === "failed" ? "rose" : e === "ok" ? "lime" : e === "warning" || e === "stale" ? "yellow" : "neutral",
		children: fe[e] ?? F("manage:shared.notFound")
	});
}
function me() {
	return /* @__PURE__ */ (0, W.jsx)(J, { kind: "support" });
}
function $({ name: e, check: t, compact: r = !1 }) {
	let i = t.target === "/settings/library" && (e === "security" || e === "port") ? se("network") : t.target, a = r ? "h4" : "h3", o = D(t);
	return /* @__PURE__ */ (0, W.jsxs)("div", {
		"data-diagnostic-check": e,
		className: k("flex flex-col gap-4 border-b border-separator-border pr-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between", r ? "py-3" : "py-5"),
		children: [/* @__PURE__ */ (0, W.jsxs)("div", {
			className: k("flex min-w-0 flex-1 flex-col", r ? "gap-1" : "gap-2"),
			children: [
				/* @__PURE__ */ (0, W.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, W.jsx)(a, {
						className: k("text-text-primary", r ? "text-body-2-medium" : "text-body-medium"),
						children: o.label
					}), /* @__PURE__ */ (0, W.jsx)(Q, { status: t.status })]
				}),
				/* @__PURE__ */ (0, W.jsx)("p", {
					"data-check-reason": !0,
					className: k("text-body-2-regular break-words", r ? "text-text-secondary" : "text-text-primary"),
					children: o.reason
				}),
				o.action ? /* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnostics.suggestedFixText", { action: o.action })
				}) : null
			]
		}), i ? /* @__PURE__ */ (0, W.jsx)("div", {
			className: "shrink-0 self-end sm:self-auto",
			children: /* @__PURE__ */ (0, W.jsx)(n, {
				size: "small",
				variant: "secondary",
				href: i,
				children: i.startsWith("/settings/") ? F("manage:diagnostics.openSection", { section: ee(i) }) : X[i] ?? F("manage:diagnostics.openRelated")
			})
		}) : null]
	});
}
function he(e) {
	let r = z({
		queryKey: i,
		queryFn: ({ signal: e }) => j(e),
		staleTime: 1e4
	}), o = I(), [l, u] = (0, U.useState)(""), d = () => void o.run("refresh", async () => {
		let e = await r.refetch();
		if (e.error) throw e.error;
		return e.data;
	}, () => u(""), (e) => u(A(e))), f = r.data;
	if (!f && r.isPending) return /* @__PURE__ */ (0, W.jsx)("div", {
		role: "status",
		"aria-label": F("manage:diagnostics.loading"),
		dangerouslySetInnerHTML: { __html: ne() }
	});
	if (!f) return /* @__PURE__ */ (0, W.jsxs)("div", {
		className: "ui-configpage",
		children: [
			/* @__PURE__ */ (0, W.jsx)(me, {}),
			/* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				title: F("manage:diagnostics.loadFailed"),
				action: /* @__PURE__ */ (0, W.jsx)(t, {
					variant: "secondary",
					onClick: d,
					...E(o.busy === "refresh"),
					children: F("manage:diagnostics.checkAgain")
				}),
				children: r.error ? A(r.error) : F("manage:diagnostics.reportNotFound")
			}),
			/* @__PURE__ */ (0, W.jsx)(Y, {})
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
				children: /* @__PURE__ */ (0, W.jsx)(J, {
					kind: "support",
					children: /* @__PURE__ */ (0, W.jsx)(t, {
						variant: "secondary",
						onClick: d,
						...E(o.busy === "refresh"),
						children: F("manage:diagnostics.checkAgain")
					})
				})
			}),
			l ? /* @__PURE__ */ (0, W.jsx)(h, {
				tone: "error",
				children: l
			}) : null,
			p.length ? /* @__PURE__ */ (0, W.jsx)(g, {
				guide: "attention",
				title: F("manage:diagnostics.attentionTitle", { count: p.length }),
				children: p.map(([e, t]) => /* @__PURE__ */ (0, W.jsx)($, {
					name: e,
					check: t
				}, e))
			}) : null,
			/* @__PURE__ */ (0, W.jsx)(g, {
				guide: "health",
				title: F("manage:diagnostics.collectionHealth"),
				children: /* @__PURE__ */ (0, W.jsxs)(b, { children: [f.library.issue_at ? /* @__PURE__ */ (0, W.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: F("manage:diagnostics.healthRecordedAtTime", { time: Z(f.library.issue_at) })
				}) : null, Object.entries(f.library.groups).map(([t, n]) => /* @__PURE__ */ (0, W.jsx)(ue, {
					groupKey: t,
					group: n,
					...e
				}, t))] })
			}),
			m.length ? /* @__PURE__ */ (0, W.jsx)("section", {
				"aria-label": F("manage:diagnostics.systemChecks"),
				children: /* @__PURE__ */ (0, W.jsx)(a, {
					summary: F("manage:diagnostics.otherChecks", { count: m.length }),
					contentClassName: "gap-5",
					children: pe.map(([e, t]) => {
						let n = m.filter(([e]) => t.some((t) => t === e));
						return n.length ? /* @__PURE__ */ (0, W.jsxs)("section", {
							"aria-label": e,
							"data-diagnostic-group": "",
							className: "flex min-w-0 flex-col gap-2",
							children: [/* @__PURE__ */ (0, W.jsxs)("h3", {
								className: "flex items-center gap-2 px-3 text-body-medium text-text-primary",
								children: [e, /* @__PURE__ */ (0, W.jsx)("span", {
									className: "text-caption-1-regular text-text-secondary",
									children: F("manage:diagnostics.groupCount", { count: n.length })
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
			/* @__PURE__ */ (0, W.jsx)(Y, {}),
			/* @__PURE__ */ (0, W.jsxs)("section", {
				"data-guide-target": "sessions",
				"aria-label": F("manage:diagnostics.sourceSessions"),
				className: "flex min-w-0 flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, W.jsx)(v, { children: F("manage:diagnostics.sourceSessions") }),
					f.sources.map((e) => /* @__PURE__ */ (0, W.jsx)("article", {
						"data-diagnostic-source": e.source,
						children: /* @__PURE__ */ (0, W.jsx)(_, { children: /* @__PURE__ */ (0, W.jsxs)(b, { children: [
							/* @__PURE__ */ (0, W.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, W.jsxs)("h3", {
									className: "flex min-w-0 items-center gap-2 text-body-medium text-text-primary",
									children: [/* @__PURE__ */ (0, W.jsx)(y, { source: e.source }), e.label]
								}), /* @__PURE__ */ (0, W.jsx)(Q, { status: e.status })]
							}),
							/* @__PURE__ */ (0, W.jsx)(V, {
								text: O(e, "reason"),
								className: "text-body-regular text-text-primary"
							}),
							/* @__PURE__ */ (0, W.jsxs)(c, { children: [
								/* @__PURE__ */ (0, W.jsx)(s, {
									term: F("manage:diagnostics.lastSuccess"),
									children: e.last_success_at ? Z(e.last_success_at) : F("manage:diagnostics.noSuccessYet")
								}),
								e.last_check_at ? /* @__PURE__ */ (0, W.jsxs)(s, {
									term: F("manage:diagnostics.lastChecked"),
									children: [Z(e.last_check_at), e.elapsed_s !== void 0 && e.elapsed_s !== null ? F("manage:diagnostics.checkDuration", { seconds: e.elapsed_s.toFixed(2) }) : ""]
								}) : null,
								/* @__PURE__ */ (0, W.jsx)(s, {
									term: F("manage:diagnostics.pausedUntil"),
									children: e.cooldown_until ? Z(e.cooldown_until) : F("manage:diagnostics.notPaused")
								})
							] })
						] }) })
					}, e.source)),
					/* @__PURE__ */ (0, W.jsx)("div", { children: /* @__PURE__ */ (0, W.jsx)(n, {
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
export { he as DiagnosticsPage };

//# debugId=d0681971-11b1-48a3-8bb3-5c483fe7d47f