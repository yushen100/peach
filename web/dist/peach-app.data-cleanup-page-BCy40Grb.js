(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "71061f87-5a6e-4082-9552-6ef962fd6b6c", e._sentryDebugIdIdentifier = "sentry-dbid-71061f87-5a6e-4082-9552-6ef962fd6b6c");
	} catch {}
})();
import { BATCH_DELETE_TEXT as e, Button as t, CLEANUP_ENTRY as n, CLEANUP_ENTRY_GRID as r, CLEANUP_HASH_REDIRECTS as i, CLEANUP_TOOLS as a, Chip as o, DIRECTORY_TEMPLATE_ERROR as s, DUPLICATES_KEY as c, Fieldset as l, FieldsetTitle as u, IDLE_REPAIR as d, IconButton as f, IndexSearch as p, Input as m, JUNK_KEY as h, LINKS_KEY as g, LINK_CHECK_KEY as _, LINK_KINDS as v, LINK_PRUNE_KEY as ee, LOC as y, LibraryLabel as b, LibraryProcessingCard as x, MEDIA_REPAIR_KEY as S, MEDIA_REPAIR_URL as C, MEDIA_SOURCES_KEY as w, MEDIA_SOURCE_ICONS as T, Note as E, ORGANIZE_KEY as te, ORGANIZE_PARAMETER_HINT as ne, ORGANIZE_SCOPE_HINT as re, ORGANIZE_TEXT as ie, ORPHAN_RECORDS_KEY as D, ORPHAN_RECORDS_TEXT as O, PERFORMER_DELETE_KEY as k, PLAIN_STAT_STRIP as A, PlainStat as j, Progress as ae, QUALITY_GOALS_KEY as M, REPAIR_CARD_TEXT as oe, REPAIR_LIBRARIES_KEY as se, RESOURCE_APPLY_KEY as N, RESOURCE_SCAN_KEY as P, RESOURCE_SYNC_TEXT as F, RESULT_PANEL as ce, RESULT_SECTION as le, REVIEW_COUNTS_KEY as I, SOURCE_LABELS as ue, SectionHeading as de, Select as fe, SelectItem as pe, SiteMark as L, SourceLabel as me, SourceMark as he, StatusLabel as ge, TRASH_KEY as _e, TaskProgress as R, Wt as ve, __toESM as z, activityKind as B, apiSend as ye, applyConfirmText as V, applyLeftovers as H, applyPlanText as be, applyText as xe, attachOrphan as Se, baseName as Ce, busyProps as U, candidateText as we, checkLine as Te, codedText as Ee, confirmModal as De, cx as Oe, deletePerformerVideos as ke, entityDisplayName as Ae, entityFaceImg as je, entityPath as Me, errorMessage as W, esc as Ne, fetchDeletePerformers as Pe, fetchDeletePlan as Fe, fetchDuplicates as Ie, fetchJunkSummary as Le, fetchLinkCheck as Re, fetchLinkPrune as ze, fetchLinkStats as Be, fetchMediaRepair as Ve, fetchMediaSources as He, fetchOrganize as Ue, fetchOrganizeExample as We, fetchOrphanRecords as Ge, fetchQualityGoals as Ke, fetchRepairLibraries as qe, fetchResourceApply as Je, fetchResourceScan as Ye, fetchReviewCounts as Xe, fetchTrashSummary as Ze, firstGrapheme as Qe, fmtSize as G, hasChanges as $e, hasResourceRoots as et, jobText as K, junkBreakdown as tt, linkLabel as nt, missingToolText as rt, organizeOutcome as it, peachHistory$1 as at, pickOrganizeFolder as ot, plainStatClass as q, planSummary as st, previewOrganize as ct, pruneText as lt, purgeCount as ut, purgeOrphan as dt, queryClient as J, recordsText as ft, rememberTemplates as pt, require_jsx_runtime as mt, require_react as ht, reviewSummary as gt, runBulkAction as _t, scanLine as vt, serverLabel as yt, sourceMeta as bt, spriteGlyph as Y, stageText as xt, startLinkCheck as St, startLinkPrune as Ct, startOrganize as wt, startResourceApply as Tt, startResourceScan as Et, statusLine as Dt, t as X, useAction as Ot, useBackgroundJob as kt, useEntityNames as At, useMutation as jt, useOrderedLibraries as Mt, useQuery as Z, withOrganizeJob as Nt } from "./peach-app.js";
import { Page as Pt } from "./peach-app.page-QAncjzM1.js";
import { ErrorExcerpt as Ft } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as It } from "./peach-app.data-table-DYj6ojEJ.js";
import { LEGACY_AVATAR_IMG as Lt } from "./peach-app.legacy-avatar-NSITxLRS.js";
import { FolderSearchIcon as Rt } from "./peach-app.folder-rows-C3hhF_90.js";
import { ConnectionStatus as zt } from "./peach-app.connection-status-BrXhLGSm.js";
// src/react/data-cleanup/cleanup-entry-card.tsx
var Q = /* @__PURE__ */ z(ht(), 1), $ = mt(), Bt = Y("chevron-right");
function Vt({ label: e, icon: t, summary: r, detail: i, state: a, attributes: o, onOpen: s }) {
	return /* @__PURE__ */ (0, $.jsxs)("button", {
		type: "button",
		...o,
		className: n.face,
		onClick: s,
		"data-entry-state": a,
		"aria-busy": a === "loading" || void 0,
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", {
				"aria-hidden": !0,
				className: n.icon,
				children: /* @__PURE__ */ (0, $.jsx)(t, {
					"aria-hidden": !0,
					className: "size-5"
				})
			}),
			/* @__PURE__ */ (0, $.jsxs)("span", {
				className: n.body,
				children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: n.title,
						children: e
					}),
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: Oe(n.summary, a === "error" && "text-text-error-primary"),
						children: r
					}),
					i ? /* @__PURE__ */ (0, $.jsx)("span", {
						className: n.detail,
						children: i
					}) : null
				]
			}),
			/* @__PURE__ */ (0, $.jsx)(Bt, {
				"aria-hidden": !0,
				className: n.arrow
			})
		]
	});
}
// src/react/media-repair/media-repair-card.tsx
var Ht = (e) => T[e] || e, Ut = (e) => J.setQueryData(S, e);
function Wt({ toast: e = () => {} }) {
	let n = kt({
		queryKey: S,
		queryFn: ({ signal: e }) => Ve(e),
		start: (e) => ye(C, {
			library: e,
			restart: !0
		}),
		onFinish: (t) => {
			t.status === "complete" && !t.failed && !t.missing_tool && e(t.repaired ? X("cleanup:mediaRepair.repaired", { count: t.repaired }) : X("cleanup:mediaRepair.nothingToRepair"));
		}
	}), r = Z({
		queryKey: se,
		queryFn: ({ signal: e }) => qe(e)
	}), [i, a] = (0, Q.useState)(""), o = Ot(), s = n.job ?? d, c = Mt(r.data ?? [], (e) => e.id), f = s.status === "running", p = c.find((e) => e.id === (f ? s.library : i)) ?? c.find((e) => e.id === s.library) ?? c[0], m = () => {
		p && De({
			title: X("cleanup:mediaRepair.confirmTitle", { name: p.name }),
			body: [X("cleanup:mediaRepair.body"), ...p.metered ? [X("cleanup:mediaRepair.meteredWarning")] : []].join(X("cleanup:shared.sentenceGap")),
			confirmLabel: X("cleanup:mediaRepair.confirm"),
			onConfirm: async () => {
				await n.start.mutateAsync(p.id);
			}
		});
	}, h = () => void o.run("stop", (e) => ye(C, { stop: !0 }, "POST", e), Ut), g = n.outcome, _ = Dt(f ? s : g ?? d), v = o.error || K(g, "error") || (n.query.error ? X("cleanup:mediaRepair.statusUnavailable") : "");
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsx)(l, {
			layout: "split",
			label: X("cleanup:tools.mediaRepair"),
			footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(fe, {
				"aria-label": X("cleanup:mediaRepair.library"),
				prefix: X("cleanup:mediaRepair.library"),
				className: "w-48",
				selectedKey: p?.id ?? null,
				isDisabled: f || !c.length,
				"aria-busy": r.isPending || void 0,
				onSelectionChange: (e) => {
					e !== null && a(String(e));
				},
				children: c.map((e) => /* @__PURE__ */ (0, $.jsx)(pe, {
					id: e.id,
					textValue: e.name,
					children: /* @__PURE__ */ (0, $.jsx)(b, { library: {
						id: e.id,
						name: e.name,
						icon: Ht(e.icon)
					} })
				}, e.id))
			}), f ? /* @__PURE__ */ (0, $.jsx)(t, {
				onClick: h,
				...U(o.busy === "stop"),
				children: X("cleanup:shared.stop")
			}) : /* @__PURE__ */ (0, $.jsx)(t, {
				onClick: m,
				disabled: !p,
				children: X("cleanup:mediaRepair.start")
			})] }),
			children: /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, $.jsx)(u, { children: X("cleanup:tools.mediaRepair") }),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: oe
					}),
					f && s.total ? /* @__PURE__ */ (0, $.jsx)(ae, {
						label: X("cleanup:mediaRepair.progress"),
						value: s.checked,
						max: s.total
					}) : null,
					_ ? /* @__PURE__ */ (0, $.jsx)("p", {
						role: "status",
						className: "text-caption-1-regular text-text-secondary",
						children: _
					}) : null
				]
			})
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			"aria-live": "polite",
			className: "flex flex-col gap-4 empty:hidden",
			children: [
				g?.status === "complete" && g.missing_tool ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "warning",
					title: X("cleanup:mediaRepair.missingTool"),
					action: /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "ghost",
						size: "small",
						onClick: n.dismiss,
						children: X("cleanup:mediaRepair.dismiss")
					}),
					children: rt(g)
				}) : null,
				r.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					children: X("cleanup:mediaRepair.librariesUnavailable")
				}) : null,
				v ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					children: v
				}) : null
			]
		})]
	});
}
// src/react/data-cleanup/link-check-icon.tsx
function Gt({ className: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("svg", {
		"aria-hidden": !0,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: e,
		"data-link-check-icon": "",
		children: [
			/* @__PURE__ */ (0, $.jsx)("path", { d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" }),
			/* @__PURE__ */ (0, $.jsx)("path", { d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" }),
			/* @__PURE__ */ (0, $.jsxs)("g", {
				"data-link-check-rays": "",
				children: [
					/* @__PURE__ */ (0, $.jsx)("path", { d: "M8 2v3" }),
					/* @__PURE__ */ (0, $.jsx)("path", { d: "M2 8h3" }),
					/* @__PURE__ */ (0, $.jsx)("path", { d: "M16 19v3" }),
					/* @__PURE__ */ (0, $.jsx)("path", { d: "M19 16h3" })
				]
			})
		]
	});
}
// src/react/data-cleanup/link-manager.tsx
var Kt = Y("rotate-cw"), qt = X("cleanup:links.goneHint"), Jt = X("cleanup:links.unclearHint"), Yt = X("cleanup:links.pruneHint"), Xt = X("cleanup:shared.reconnecting"), Zt = (e) => Number(e || 0).toLocaleString();
function Qt({ label: e, value: t, note: n }) {
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-0.5",
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-caption-1-regular leading-5 text-text-secondary",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsx)("b", {
				className: "text-title-2-semibold font-bold leading-5 tabular-nums text-text-primary",
				children: t
			}),
			n ? /* @__PURE__ */ (0, $.jsx)("small", {
				className: "text-caption-1-regular leading-5 text-text-secondary",
				children: n
			}) : null
		]
	});
}
function $t({ title: e, items: t, hint: n, picked: r, onPick: i, actions: a, controls: o, footer: s, confirmed: c = !1 }) {
	if (!t.length) return null;
	let l = [
		{
			id: "entity",
			label: X("cleanup:links.columnEntry"),
			width: 180,
			min: 128,
			value: (e) => e.entity,
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("a", {
				className: "flex min-w-24 items-center gap-2 text-text-secondary hover:text-text-primary hover:underline",
				href: e.entity_id && e.entity_kind ? Me(e.entity_kind, e.entity, e.entity_id) : void 0,
				"data-link-identity": "",
				children: [/* @__PURE__ */ (0, $.jsx)("span", {
					"data-link-avatar": "",
					className: `relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-primary ${Lt}`,
					"aria-hidden": !0,
					dangerouslySetInnerHTML: { __html: `<span>${Ne(Qe(e.entity))}</span>` + je({
						kind: e.entity_kind,
						id: e.entity_id,
						hasImage: e.face?.has_image,
						version: e.face?.image_version,
						focus: e.face?.avatar_focus,
						thumb: !0,
						mark: e.entity_kind === "studio" || e.entity_kind === "agency" ? e.id : null
					}) }
				}), /* @__PURE__ */ (0, $.jsx)("span", {
					className: "min-w-0 wrap-anywhere",
					children: e.entity
				})]
			})
		},
		{
			id: "kind",
			label: X("cleanup:shared.type"),
			width: 128,
			value: (e) => v[e.link_kind] || e.link_kind,
			render: (e) => v[e.link_kind] || e.link_kind
		},
		{
			id: "label",
			label: X("cleanup:links.columnName"),
			min: 128,
			value: (e) => nt(e.label),
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "flex min-w-24 items-center gap-2",
				"data-link-name": "",
				children: /* @__PURE__ */ (0, $.jsx)("span", {
					className: "min-w-0 wrap-anywhere",
					children: nt(e.label) || new URL(e.url).hostname
				})
			})
		},
		{
			id: "note",
			label: X("cleanup:links.columnResult"),
			width: 320,
			min: 192,
			value: (e) => e.note,
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0 w-full",
				"data-link-result": c ? "gone" : "unclear",
				children: [/^(?:HTTP\s+)?[1-5]\d{2}$/.test(e.note.trim()) ? /* @__PURE__ */ (0, $.jsx)(ge, {
					tone: c || /^(?:HTTP\s+)?5\d{2}$/.test(e.note.trim()) ? "error" : "warning",
					"data-link-code": "",
					children: e.note.trim()
				}) : /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex flex-col items-start gap-1",
					children: [/* @__PURE__ */ (0, $.jsx)(ge, {
						tone: c ? "error" : "warning",
						children: X(c ? "cleanup:links.dead" : "cleanup:links.inconclusive")
					}), /* @__PURE__ */ (0, $.jsx)(Ft, {
						text: yt(e.note_code ?? "", e.note, e.note_params),
						className: "tabular-nums text-text-secondary"
					})]
				}), !c && e.temporary && e.attempts ? /* @__PURE__ */ (0, $.jsx)("span", {
					"data-link-rechecked": "",
					className: "mt-1 block text-body-2-regular text-text-secondary",
					children: X("cleanup:links.rechecked", { count: e.attempts })
				}) : null]
			})
		},
		{
			id: "url",
			label: X("cleanup:links.columnUrl"),
			width: 360,
			min: 180,
			value: (e) => e.url,
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("a", {
				href: e.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: e.url,
				"data-link-address": "",
				className: "flex min-w-0 items-center gap-1 text-text-secondary hover:text-text-primary",
				children: [
					/* @__PURE__ */ (0, $.jsx)(L, { linkId: e.id }),
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-middle-truncate": !0,
						className: "min-w-0 truncate",
						children: e.url
					}),
					/* @__PURE__ */ (0, $.jsx)(ve, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})
				]
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("div", {
		className: le,
		"data-link-results": c ? "gone" : "unclear",
		children: /* @__PURE__ */ (0, $.jsx)(It, {
			label: e,
			items: t,
			columns: l,
			rowId: (e) => String(e.id),
			description: n,
			unit: X("cleanup:links.unit"),
			panel: !1,
			footerActions: s,
			rowLabel: (e) => X("cleanup:links.rowLabel", {
				entity: e.entity,
				link: nt(e.label) || e.url
			}),
			selected: r.map(String),
			onSelected: (e) => i(e.map(Number)),
			actions: (e) => a?.(e) ?? [],
			controls: () => o
		})
	});
}
function en() {
	let e = Z({
		queryKey: g,
		queryFn: ({ signal: e }) => Be(e)
	}), [n, r] = (0, Q.useState)([]), [i, a] = (0, Q.useState)([]), s = kt({
		queryKey: ee,
		queryFn: ({ signal: e }) => ze(e),
		start: Ct,
		onFinish: () => {
			J.invalidateQueries({
				queryKey: g,
				exact: !0
			}), J.invalidateQueries({
				queryKey: _,
				exact: !0
			});
		}
	}), c = kt({
		queryKey: _,
		queryFn: ({ signal: e }) => Re(e),
		start: St,
		onStarted: () => {
			s.dismiss(), r([]), a([]);
		}
	}), d = c.job, f = d?.check_id ?? "";
	(0, Q.useEffect)(() => {
		r([]), a([]);
	}, [f]);
	let p = c.running || c.start.isPending, m = s.running || s.start.isPending, h = !!c.job && !!s.job, y = d?.status === "complete", b = d?.gone ?? [], x = d?.unclear ?? [], S = y ? x : [], C = b.filter((e) => i.includes(e.id)).map((e) => e.id), w = S.filter((e) => n.includes(e.id)).map((e) => e.id), T = e.data, te = (T?.top_hosts ?? []).slice(0, 3), ne = (e) => {
		!h || p || e && !e.length || c.start.mutate(e ? {
			retry: e,
			checkId: f
		} : {});
	}, re = (e, t = !1) => ({
		key: t ? "prune-all" : "prune",
		label: e,
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: X("cleanup:links.deleteDead"),
			danger: !0,
			body: X("cleanup:links.deleteDeadBody", { count: e.length })
		}),
		run: async (e) => {
			await s.start.mutateAsync({
				checkId: f,
				ids: t ? void 0 : e.map((e) => e.id)
			});
		},
		receipt: () => ""
	}), ie = { receipt: () => {} }, D = () => {
		h && !m && b.length && _t(re(X("cleanup:links.deleteDead"), !0), b, ie);
	}, O = s.outcome, k = c.start.error ?? s.start.error, A = null, j = null;
	if (O?.status === "failed") j = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:links.pruneIncomplete"),
		children: K(O, "error") || X("cleanup:links.checkTaskLog")
	});
	else if (O && !b.length && !x.length) j = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "success",
		title: X("cleanup:links.pruneDone"),
		children: lt(O)
	});
	else if (k) j = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:links.checkFailed"),
		children: W(k)
	});
	else if (c.query.isError && d) j = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "neutral",
		title: X("cleanup:shared.taskStatus"),
		children: Xt
	});
	else if (d?.status === "failed") j = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:links.checkFailed"),
		children: K(d, "error") || X("cleanup:links.checkFailed")
	});
	else if (d && d.status !== "idle") {
		A = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [d.status === "running" ? /* @__PURE__ */ (0, $.jsx)(R, {
			embedded: !0,
			kind: B("link-check"),
			label: Te(d),
			value: Math.min(d.checked || 0, d.total || 0),
			total: d.total
		}) : null, m ? /* @__PURE__ */ (0, $.jsx)(R, {
			embedded: !0,
			kind: B("link-prune"),
			label: K(s.job) || X("cleanup:links.pruning"),
			value: Math.min(s.job?.checked || 0, s.job?.total || 0),
			total: s.job?.total
		}) : null] });
		let e = X("cleanup:links.retrySelected", { count: w.length });
		j = y || b.length || x.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
			className: ce,
			children: [
				O?.status === "complete" ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "success",
					title: X("cleanup:links.pruneDone"),
					children: lt(O)
				}) : null,
				/* @__PURE__ */ (0, $.jsx)($t, {
					title: X("cleanup:links.dead"),
					items: b,
					hint: qt,
					picked: i,
					onPick: a,
					confirmed: !0,
					footer: y && b.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mr-auto min-w-0 text-caption-1-regular text-text-secondary",
						children: Yt
					}), /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "danger",
						...U(m),
						onClick: D,
						children: X("cleanup:links.deleteDeadCount", { count: b.length })
					})] }) : null,
					actions: (e) => [{
						action: re(X("cleanup:links.deleteSelected", { count: C.length })),
						items: e,
						host: ie,
						disabled: !y || m
					}]
				}),
				/* @__PURE__ */ (0, $.jsx)($t, {
					title: X("cleanup:links.unreached"),
					items: x,
					hint: Jt,
					picked: n,
					onPick: r,
					footer: S.length ? /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "primary",
						leadingIcon: Kt,
						...U(p),
						onClick: () => ne(S.map((e) => e.id)),
						children: X("cleanup:links.retryAll", { count: S.length })
					}) : null,
					controls: S.length ? /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "secondary",
						leadingIcon: Kt,
						disabled: !w.length,
						...U(p),
						onClick: () => ne(w),
						children: e
					}) : null
				}),
				y && !b.length && !x.length ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `${le} text-body-regular text-notification-success-foreground`,
					children: X("cleanup:links.allReachable")
				}) : null
			]
		}) : null;
	}
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "link-manager",
		"aria-labelledby": "link-manager-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(l, {
			layout: "stack",
			labelledBy: "link-manager-title",
			footer: /* @__PURE__ */ (0, $.jsx)(t, {
				"data-link-check": "",
				leadingIcon: Gt,
				disabled: !h,
				...U(p),
				onClick: () => ne(),
				children: X(p ? "cleanup:links.checking" : y ? "cleanup:links.checkAgain" : "cleanup:links.checkLinks")
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(u, {
					id: "link-manager-title",
					gap: "small",
					children: X("cleanup:tools.links")
				}),
				e.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					title: X("cleanup:links.statsLoadFailed"),
					children: W(e.error)
				}) : T ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("div", {
					className: "link-stat-grid mt-4 gap-x-8 gap-y-3",
					children: [/* @__PURE__ */ (0, $.jsx)(Qt, {
						label: X("cleanup:links.totalLinks"),
						value: Zt(T.total),
						note: X("cleanup:links.entitySpread", { count: Number(T.entities || 0) })
					}), Object.entries(T.by_kind ?? {}).map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(Qt, {
						label: v[e] || e,
						value: Zt(t)
					}, e))]
				}), te.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "mt-4 flex min-w-0 flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, $.jsx)("span", {
						className: "text-caption-1-regular text-text-secondary",
						children: X("cleanup:links.topSites")
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						className: "flex min-w-0 flex-wrap gap-x-5 gap-y-2",
						children: te.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)("span", {
							"data-top-host": "",
							className: "inline-flex min-w-0 max-w-full items-center gap-1.5",
							children: [/* @__PURE__ */ (0, $.jsxs)("a", {
								href: `https://${e}`,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "inline-flex min-w-0 items-center gap-1.5 text-body-2-medium text-text-primary",
								children: [
									/* @__PURE__ */ (0, $.jsx)(L, { linkId: T.top_host_link_ids?.[e] }),
									/* @__PURE__ */ (0, $.jsx)("span", {
										className: "min-w-0 wrap-anywhere",
										children: e
									}),
									/* @__PURE__ */ (0, $.jsx)(ve, {
										"aria-hidden": !0,
										className: "size-(--icon-inline) shrink-0"
									})
								]
							}), /* @__PURE__ */ (0, $.jsx)(o, {
								variant: "caption",
								color: "neutral",
								children: /* @__PURE__ */ (0, $.jsx)("span", {
									className: "tabular-nums",
									children: Zt(t)
								})
							})]
						}, e))
					})]
				}) : null] }) : null,
				/* @__PURE__ */ (0, $.jsx)("div", {
					"aria-live": "polite",
					className: "mt-4 flex flex-col gap-3 empty:hidden",
					children: A
				})
			]
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			"aria-live": "polite",
			className: "empty:hidden",
			children: j
		})]
	});
}
// src/react/data-cleanup/organize-card.tsx
var tn = (e, t) => t ? X("cleanup:organize.applyBodyPath", {
	name: e,
	path: t
}) : X("cleanup:organize.applyBodyAll", { name: e }), nn = X("cleanup:organize.rollbackBody"), rn = 8;
function an({ plan: e }) {
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("ol", {
		className: "mt-2 flex min-w-0 flex-col gap-1",
		children: e.rows.slice(0, rn).map((e) => /* @__PURE__ */ (0, $.jsxs)("li", {
			className: "flex min-w-0 items-center gap-2 text-caption-1-regular text-text-secondary",
			children: [
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.current_path,
					className: "min-w-0 truncate",
					children: Ce(e.current_path)
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"aria-hidden": !0,
					children: "→"
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.target_path,
					className: "min-w-0 truncate text-text-primary",
					children: Ce(e.target_path)
				})
			]
		}, e.current_path))
	}), e.truncated || e.rows.length > rn ? /* @__PURE__ */ (0, $.jsx)("p", {
		className: "text-caption-1-regular text-text-secondary",
		children: X("cleanup:organize.planTruncated")
	}) : null] });
}
function on({ toast: e, failure: n }) {
	let r = Z({
		queryKey: te,
		queryFn: ({ signal: e }) => Ue(e)
	}), i = r.data, a = i?.locations ?? [], [o, c] = (0, Q.useState)(""), d = a.some((e) => e.location === o) ? o : a[0]?.location ?? "", p = i?.templates?.[d], [h, g] = (0, Q.useState)(null), _ = h?.location === d ? h : {
		location: d,
		file: p?.file ?? "",
		dir: p?.dir ?? ""
	}, v = (e) => {
		g({
			..._,
			...e
		}), N.reset();
	}, [ee, b] = (0, Q.useState)({
		location: "",
		path: ""
	}), x = ee.location === d ? ee.path : "", S = (0, Q.useRef)({
		location: d,
		path: x
	});
	S.current = {
		location: d,
		path: x
	};
	let [C, w] = (0, Q.useState)(null), D = (0, Q.useRef)(null), O = (0, Q.useRef)(null), k = (0, Q.useRef)(null), A = Z({
		queryKey: [
			"organize-example",
			_.file,
			_.dir
		],
		queryFn: ({ signal: e }) => We(_.file, _.dir, e),
		enabled: !!i
	}), [j, ae] = (0, Q.useState)("file"), M = (0, Q.useRef)(!1), oe = (0, Q.useRef)(null);
	(0, Q.useLayoutEffect)(() => {
		let e = oe.current;
		if (!e) return;
		oe.current = null;
		let t = (e.field === "file" ? D : O).current;
		t?.focus(), t?.setSelectionRange(e.caret, e.caret);
	});
	let se = () => ({
		location: d,
		path: x.trim(),
		file_template: _.file.trim(),
		dir_template: _.dir.trim()
	}), N = jt({
		mutationFn: ct,
		onError: (e) => {
			let t = /整理路径/.test(W(e)) ? "path" : s.test(W(e)) ? "dir" : "file";
			w(t), (t === "path" ? k : t === "dir" ? O : D).current?.focus();
		}
	}), P = jt({
		mutationFn: ({ initial: e }) => ot(e),
		onSuccess: (e, t) => {
			e.path && t.location === S.current.location && t.path === S.current.path && (b({
				location: t.location,
				path: e.path
			}), w(null), N.reset(), k.current?.focus());
		}
	}), F = kt({
		queryKey: te,
		queryFn: ({ signal: e }) => Ue(e),
		start: wt,
		jobOf: (e) => e,
		withJob: Nt,
		onStarted: () => N.reset(),
		onFinish: (t) => {
			if (J.invalidateQueries({
				queryKey: te,
				exact: !0
			}), t.status !== "complete") return;
			let { text: r, failed: i } = it(t);
			i ? n(X("cleanup:tools.organize"), Error(X("cleanup:organize.rowsFailed", { count: i }))) : e(r.replace(/。$/, ""));
		}
	}), ce = F.running || F.start.isPending, le = JSON.stringify(N.variables) === JSON.stringify(se()), I = le ? N.data : void 0, ue = Number(I?.counts?.change || 0), de = y[d] || d, L = (e) => {
		v(e), w(null), N.reset();
	}, me = (e) => {
		let t = (j === "file" ? D : O).current, n = _[j], r = M.current ? t?.selectionStart ?? n.length : n.length, i = M.current ? t?.selectionEnd ?? r : r, a = `{${e}}`;
		oe.current = {
			field: j,
			caret: r + a.length
		}, L({ [j]: n.slice(0, r) + a + n.slice(i) });
	}, ge = () => {
		N.isPending || ce || !d || (F.dismiss(), F.start.reset(), w(null), N.mutate(se()));
	}, _e = () => {
		let e = N.variables;
		e && I && ue && De({
			title: X("cleanup:tools.organize"),
			body: tn(de, e.path),
			confirmLabel: X("cleanup:tools.organize"),
			onConfirm: async () => {
				await F.start.mutateAsync({
					kind: "apply",
					request: e
				}), pt({
					...i?.templates ?? {},
					[e.location]: {
						file: e.file_template,
						dir: e.dir_template
					}
				});
			}
		});
	}, ve = () => void De({
		title: X("cleanup:organize.rollbackTitle"),
		body: nn,
		confirmLabel: X("cleanup:organize.rollbackConfirm"),
		onConfirm: () => F.start.mutateAsync({ kind: "rollback" })
	}), z = null, ye = !!ue && !ce && !F.outcome, V = F.job, H = F.outcome;
	if (V?.status === "running") {
		let e = K(V) || xt(V) || X("cleanup:organize.running");
		z = /* @__PURE__ */ (0, $.jsx)(R, {
			embedded: !0,
			kind: B("organize", V.stage_code),
			label: e,
			value: Math.min(V.checked || 0, V.total || 0),
			total: V.total
		});
	} else if (H?.status === "failed") z = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:organize.incomplete"),
		children: K(H, "error") || X("cleanup:shared.checkTaskLogFiles")
	});
	else if (H) {
		let { text: e, failed: t } = it(H);
		z = /* @__PURE__ */ (0, $.jsx)(E, {
			tone: t ? "warning" : "success",
			title: X(t ? "cleanup:shared.partiallyCompleted" : "cleanup:organize.result"),
			children: e
		});
	} else F.start.isError ? z = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:organize.failed"),
		children: W(F.start.error)
	}) : N.isPending ? z = /* @__PURE__ */ (0, $.jsx)(R, {
		embedded: !0,
		kind: B("organize", "organize.checkingPlan"),
		label: X("cleanup:organize.checkingPlan")
	}) : N.isError && le ? z = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:organize.previewFailed"),
		children: W(N.error)
	}) : I && (z = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(E, {
		tone: "neutral",
		title: X("cleanup:organize.previewResult"),
		children: st(I)
	}), ue ? /* @__PURE__ */ (0, $.jsx)(an, { plan: I }) : null] }));
	return /* @__PURE__ */ (0, $.jsxs)(l, {
		layout: "stack",
		id: "organize",
		labelledBy: "cleanup-organize-title",
		attributes: { "data-cleanup-organize": "" },
		footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
			i?.last_batch ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "secondary",
				...U(ce),
				onClick: ve,
				children: X("cleanup:organize.rollbackLastBatch")
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(t, {
				variant: ye ? "secondary" : "primary",
				disabled: !a.length || ce,
				...U(N.isPending),
				onClick: ge,
				children: X("cleanup:organize.preview")
			}),
			ye ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "primary",
				onClick: _e,
				children: X("cleanup:organize.apply")
			}) : null
		] }),
		children: [
			/* @__PURE__ */ (0, $.jsx)(u, {
				id: "cleanup-organize-title",
				gap: "medium",
				children: X("cleanup:organize.title")
			}),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-regular text-text-secondary",
				children: ie
			}),
			r.isError ? /* @__PURE__ */ (0, $.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					title: X("cleanup:organize.settingsLoadFailed"),
					children: W(r.error)
				})
			}) : null,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "mt-3 flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-organize-scope": !0,
						className: "flex min-w-0 flex-wrap items-start gap-2",
						children: [a.length ? /* @__PURE__ */ (0, $.jsx)(fe, {
							"aria-label": X("cleanup:organize.storageLabel"),
							prefix: X("cleanup:organize.storagePrefix"),
							className: "w-fit min-w-25",
							selectedKey: d || null,
							onSelectionChange: (e) => {
								e !== null && (c(String(e)), b({
									location: String(e),
									path: ""
								}), w(null), N.reset(), P.reset(), M.current = !1);
							},
							children: a.map((e) => /* @__PURE__ */ (0, $.jsxs)(pe, {
								id: e.location,
								textValue: y[e.location] || e.location,
								children: [/* @__PURE__ */ (0, $.jsx)(he, { mark: T[e.location] || "database" }), y[e.location] || e.location]
							}, e.location))
						}) : null, /* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex min-w-0 basis-64 flex-1 items-start gap-2",
							children: [/* @__PURE__ */ (0, $.jsx)(m, {
								"aria-label": X("cleanup:organize.pathLabel"),
								className: "min-w-0 flex-1",
								placeholder: X("cleanup:organize.pathPlaceholder"),
								name: "organize-path",
								autoComplete: "off",
								spellCheck: "false",
								value: x,
								ref: k,
								isInvalid: C === "path",
								onChange: (e) => {
									b({
										location: d,
										path: e
									}), w(null), N.reset(), P.reset();
								}
							}), /* @__PURE__ */ (0, $.jsx)(f, {
								icon: Rt,
								"aria-label": X("cleanup:organize.choosePath"),
								...U(P.isPending),
								onClick: () => P.mutate({
									initial: x || a.find((e) => e.location === d)?.roots[0] || "",
									location: d,
									path: x
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-caption-1-regular text-text-secondary",
						children: re
					}),
					P.isError ? /* @__PURE__ */ (0, $.jsxs)(E, {
						tone: "error",
						title: X("cleanup:organize.pickerFailed"),
						children: [W(P.error), X("cleanup:organize.pickerFallback")]
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(m, {
						label: X("cleanup:organize.fileTemplate"),
						placeholder: "{code}[ {title}]",
						value: _.file,
						ref: D,
						spellCheck: "false",
						isInvalid: C === "file",
						onFocus: () => {
							ae("file"), M.current = !0;
						},
						onChange: (e) => L({ file: e })
					}),
					/* @__PURE__ */ (0, $.jsx)(m, {
						label: X("cleanup:organize.dirTemplate"),
						placeholder: X("cleanup:organize.dirTemplatePlaceholder"),
						value: _.dir,
						ref: O,
						spellCheck: "false",
						isInvalid: C === "dir",
						onFocus: () => {
							ae("dir"), M.current = !0;
						},
						onChange: (e) => L({ dir: e })
					}),
					i?.presets?.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-col gap-2",
						role: "group",
						"aria-label": X("cleanup:organize.applyPreset"),
						children: [/* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-caption-1-medium text-text-secondary",
							children: X("cleanup:organize.applyPreset")
						}), /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: i.presets.map((e) => {
								let n = Ee(e, "label");
								return /* @__PURE__ */ (0, $.jsx)(t, {
									variant: "secondary",
									size: "small",
									title: e.example || n,
									className: "max-w-full [&>span]:min-w-0 [&>span]:shrink",
									onClick: () => {
										L({
											file: e.file,
											dir: e.dir
										}), M.current = !1;
									},
									children: /* @__PURE__ */ (0, $.jsx)("span", {
										className: "truncate",
										children: n
									})
								}, e.id || e.label);
							})
						})]
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("p", {
						"aria-live": "polite",
						"aria-busy": A.isFetching,
						"data-organize-example": "",
						className: "text-caption-1-regular text-text-secondary",
						children: [X("cleanup:organize.examplePath"), /* @__PURE__ */ (0, $.jsx)("code", {
							className: "wrap-anywhere",
							children: A.data?.example || A.data?.error || (A.isError ? W(A.error) : X("cleanup:organize.previewLoading"))
						})]
					}),
					i?.placeholders?.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-col gap-2",
						role: "group",
						"aria-label": X("cleanup:organize.insertParameter"),
						children: [/* @__PURE__ */ (0, $.jsxs)("p", {
							className: "text-caption-1-regular text-text-secondary",
							"aria-live": "polite",
							children: [/* @__PURE__ */ (0, $.jsx)("strong", {
								className: "text-caption-1-semibold text-text-primary",
								children: X("cleanup:organize.insertParameter")
							}), X("cleanup:organize.insertTarget", { target: X(j === "file" ? "cleanup:organize.fileTemplate" : "cleanup:organize.dirTemplate") })]
						}), /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: i.placeholders.map((e) => {
								let n = yt(`labels.organizeTemplates.placeholder.${e.key}`, e.label);
								return /* @__PURE__ */ (0, $.jsx)(t, {
									variant: "ghost",
									size: "small",
									"aria-label": `${n} {${e.key}}`,
									onClick: () => me(e.key),
									children: /* @__PURE__ */ (0, $.jsxs)("span", {
										className: "inline-flex flex-wrap items-center gap-x-1.5",
										children: [/* @__PURE__ */ (0, $.jsx)("code", { children: `{${e.key}}` }), /* @__PURE__ */ (0, $.jsx)("span", {
											className: "text-text-secondary",
											children: n
										})]
									})
								}, e.key);
							})
						})]
					}) : null,
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-caption-1-regular leading-4.5 text-text-secondary",
						children: ne
					})
				]
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"aria-live": "polite",
				className: "mt-3 flex flex-col gap-2 empty:hidden",
				children: z
			})
		]
	});
}
// src/react/data-cleanup/orphan-records-card.tsx
var sn = Y("play"), cn = () => J.invalidateQueries({
	queryKey: D,
	exact: !0
});
function ln({ item: e, toast: n }) {
	let [r, i] = (0, Q.useState)(e.candidates[0]?.id ?? null), a = jt({
		mutationFn: () => Se(e.id, Number(r)),
		onSuccess: () => {
			let t = e.candidates.find((e) => e.id === r);
			n(X("cleanup:orphans.attached", {
				name: e.name,
				target: t?.name ?? X("cleanup:orphans.selectedFile")
			})), cn();
		},
		onError: (e) => n(W(e))
	}), o = jt({
		mutationFn: () => dt(e.id),
		onSuccess: (t) => {
			n(t.blocked.length ? X("cleanup:orphans.fileRestored", { name: e.name }) : X("cleanup:orphans.recordDeleted", { name: e.name })), cn();
		}
	}), s = () => {
		De({
			title: X("cleanup:orphans.deleteRecord"),
			holdToConfirm: !0,
			body: ft(e.records) ? X("cleanup:orphans.deleteBodyWithActivity", {
				name: e.name,
				records: ft(e.records)
			}) : X("cleanup:orphans.deleteBody", { name: e.name }),
			confirmLabel: X("cleanup:orphans.deleteRecord"),
			danger: !0,
			onConfirm: () => o.mutateAsync()
		});
	}, c = a.isPending || o.isPending;
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, $.jsx)(t, {
				variant: "danger",
				size: "small",
				...U(c),
				onClick: s,
				children: X("cleanup:orphans.deleteRecord")
			}),
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(fe, {
				"aria-label": X("cleanup:orphans.targetLabel", { name: e.name }),
				prefix: X("cleanup:orphans.targetPrefix"),
				className: "w-52",
				selectedKey: r,
				onSelectionChange: (e) => {
					e !== null && i(Number(e));
				},
				children: e.candidates.map((e) => /* @__PURE__ */ (0, $.jsx)(pe, {
					id: e.id,
					textValue: we(e),
					children: we(e)
				}, e.id))
			}) : null,
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "primary",
				size: "small",
				disabled: r === null,
				...U(c),
				onClick: () => a.mutate(),
				children: X("cleanup:orphans.moveActivity")
			}) : null
		]
	});
}
function un({ item: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			className: "relative inline-grid aspect-16/10 w-24 flex-none place-items-center max-cleanup-tight:hidden overflow-hidden rounded-lg border border-separator-border bg-media-placeholder text-text-tertiary",
			children: [/* @__PURE__ */ (0, $.jsx)(sn, {
				"aria-hidden": !0,
				className: "size-5"
			}), e.has_thumb ? /* @__PURE__ */ (0, $.jsx)("img", {
				src: `/thumb?id=${e.id}&c=4`,
				alt: "",
				loading: "lazy",
				onError: (e) => e.currentTarget.remove(),
				className: "absolute inset-0 size-full object-contain"
			}) : null]
		}), /* @__PURE__ */ (0, $.jsxs)("span", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				title: e.name,
				className: "truncate text-body-regular text-text-primary",
				children: e.name
			}), /* @__PURE__ */ (0, $.jsxs)("small", {
				className: "flex min-w-0 items-center gap-1.5 text-caption-1-regular text-text-secondary",
				children: [
					e.code ? /* @__PURE__ */ (0, $.jsx)("span", {
						className: "shrink-0",
						children: e.code
					}) : null,
					e.code && e.location ? /* @__PURE__ */ (0, $.jsx)("span", {
						"aria-hidden": "true",
						children: "·"
					}) : null,
					e.location ? /* @__PURE__ */ (0, $.jsx)(me, {
						source: e.location,
						label: y[e.location] || e.location
					}) : null
				]
			})]
		})]
	});
}
function dn({ toast: e }) {
	let [t, n] = (0, Q.useState)([]), r = Z({
		queryKey: D,
		queryFn: ({ signal: e }) => Ge(e)
	}), i = r.data?.items ?? [], a = { receipt: e }, o = (e) => {
		let t = null;
		return {
			key: "purge",
			label: X("cleanup:orphans.deleteSelectedCount", { count: e }),
			reversal: "irreversible",
			danger: !0,
			holdToConfirm: !0,
			confirm: (e) => ({
				title: X("cleanup:orphans.deleteSelectedTitle"),
				danger: !0,
				body: X("cleanup:orphans.deleteSelectedBody", { count: e.length }),
				items: e.map((e) => e.name)
			}),
			run: async (e) => {
				t = await dt(e.map((e) => e.id));
			},
			receipt: () => t ? X("cleanup:orphans.purged", { count: t.purged }) + (t.blocked.length ? X("cleanup:orphans.purgedBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, s = [
		{
			id: "item",
			label: X("cleanup:shared.video"),
			width: 480,
			min: 320,
			value: (e) => e.name,
			render: (e) => /* @__PURE__ */ (0, $.jsx)(un, { item: e })
		},
		{
			id: "records",
			label: X("cleanup:orphans.columnActivity"),
			width: 176,
			min: 144,
			value: (e) => ft(e.records),
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "block min-w-0 whitespace-normal wrap-anywhere",
				children: ft(e.records) || X("cleanup:shared.none")
			})
		},
		{
			id: "target",
			label: X("cleanup:shared.actions"),
			width: i.some((e) => e.candidates.length) ? 360 : 128,
			min: 128,
			value: (e) => e.candidates.length,
			render: (t) => /* @__PURE__ */ (0, $.jsx)(ln, {
				item: t,
				toast: e
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("section", {
		id: "orphan-records",
		"aria-labelledby": "orphan-records-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: r.isError ? /* @__PURE__ */ (0, $.jsxs)(l, {
			layout: "stack",
			labelledBy: "orphan-records-title",
			children: [/* @__PURE__ */ (0, $.jsx)(u, {
				id: "orphan-records-title",
				children: X("cleanup:tools.orphanRecords")
			}), /* @__PURE__ */ (0, $.jsx)(E, {
				tone: "error",
				title: X("cleanup:orphans.loadFailed"),
				children: W(r.error)
			})]
		}) : /* @__PURE__ */ (0, $.jsx)(It, {
			label: X("cleanup:orphans.tableLabel"),
			items: i,
			columns: s,
			title: X("cleanup:tools.orphanRecords"),
			titleId: "orphan-records-title",
			unit: X("cleanup:orphans.unit"),
			description: O,
			rowId: (e) => String(e.id),
			rowLabel: (e) => e.name,
			selected: t,
			onSelected: n,
			actions: (e) => [{
				items: e,
				host: a,
				action: o(e.length),
				done: () => {
					n([]), cn();
				}
			}]
		})
	});
}
// src/react/data-cleanup/performer-delete-card.tsx
function fn({ person: e }) {
	let t = Ae("performer", e.k, e.entity_id);
	return /* @__PURE__ */ (0, $.jsxs)("a", {
		href: Me("performer", e.k, e.entity_id),
		title: t,
		className: "flex min-w-0 items-center gap-3 text-text-primary",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			"aria-hidden": !0,
			className: Oe("relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium", Lt),
			dangerouslySetInnerHTML: { __html: `<span>${Ne(Qe(t))}</span>` + je({
				kind: "performer",
				id: e.entity_id,
				hasImage: e.has_image,
				version: e.image_version,
				focus: e.avatar_focus,
				thumb: !0
			}) }
		}), /* @__PURE__ */ (0, $.jsx)("span", {
			className: "min-w-0 wrap-anywhere",
			children: t
		})]
	});
}
function pn(e, t, n) {
	let r = (e) => e.slice(0, 5).join(X("cleanup:shared.listSeparator")), i = e.length > 5 ? X("cleanup:performerDelete.moreNames", {
		names: r(e),
		total: e.length
	}) : r(e), a = t.length > 5 ? X("cleanup:performerDelete.moreExamples", {
		examples: r(t),
		total: t.length
	}) : r(t);
	return [
		X("cleanup:performerDelete.bodyScope", {
			names: i,
			count: n.total,
			size: G(n.bytes)
		}),
		X("cleanup:performerDelete.bodyWarning"),
		...n.shared ? [X("cleanup:performerDelete.sharedFiles", { count: n.shared })] : [],
		X("cleanup:performerDelete.bodyExamples", { examples: a })
	].join(X("cleanup:shared.sentenceGap"));
}
function mn({ toast: n }) {
	At();
	let r = Z({
		queryKey: k,
		queryFn: ({ signal: e }) => Pe(e)
	}), [i, a] = (0, Q.useState)([]), [o, s] = (0, Q.useState)(""), [c, d] = (0, Q.useState)(null), [f, m] = (0, Q.useState)(""), h = {
		receipt: n,
		failure: (e) => m(W(e))
	}, g = (0, Q.useMemo)(() => [
		{
			id: "name",
			label: X("cleanup:shared.actress"),
			width: 280,
			min: 160,
			value: (e) => e.k,
			render: (e) => /* @__PURE__ */ (0, $.jsx)(fn, { person: e })
		},
		{
			id: "works",
			label: X("cleanup:shared.videos"),
			width: 104,
			min: 80,
			value: (e) => e.n,
			render: (e) => X("cleanup:performerDelete.videoCount", { count: e.n })
		},
		{
			id: "files",
			label: X("cleanup:shared.files"),
			width: 104,
			min: 80,
			value: (e) => e.file_count,
			render: (e) => X("cleanup:performerDelete.fileCount", { count: e.file_count })
		},
		{
			id: "bytes",
			label: X("cleanup:performerDelete.columnSize"),
			width: 136,
			min: 104,
			value: (e) => e.bytes,
			render: (e) => G(e.bytes)
		}
	], []), _ = o.toLocaleLowerCase(), v = (r.data?.items || []).filter((e) => !_ || [
		e.k,
		Ae("performer", e.k, e.entity_id),
		...e.aliases
	].some((e) => e.toLocaleLowerCase().includes(_))), ee = () => {
		let e = null, t = null;
		return {
			key: "performer-delete",
			label: X("cleanup:performerDelete.deleteSelected"),
			reversal: "irreversible",
			danger: !0,
			holdToConfirm: !0,
			confirm: async (t) => {
				m("");
				let n = await Fe(t.map((e) => e.entity_id));
				if (!n.total) throw Error(X("cleanup:performerDelete.nothingToDelete"));
				e = n;
				let r = n.performers.map((e) => Ae("performer", e.name, e.id)), i = [...new Set(n.items.map((e) => e.code || e.name || `#${e.id}`))];
				return {
					title: X("cleanup:performerDelete.confirmTitle"),
					confirmLabel: X("cleanup:performerDelete.confirm"),
					danger: !0,
					body: pn(r, i, n)
				};
			},
			run: async () => {
				t = await ke(e), d(t), await Promise.all([J.invalidateQueries({
					queryKey: k,
					exact: !0
				}), J.invalidateQueries({
					queryKey: _e,
					exact: !0
				})]);
			},
			receipt: () => t ? X("cleanup:performerDelete.purged", { count: t.purged }) + (t.blocked.length ? X("cleanup:performerDelete.doneBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, y = c ? [
		...c.blocked.map((e) => ({
			path: e.path,
			reason: yt(e.reason_code ?? "", e.reason, e.reason_params)
		})),
		...c.cleanup_pending,
		...c.cache_blocked.map((e) => ({
			path: e.name,
			reason: e.reason
		}))
	] : [];
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "batch-delete",
		className: "flex min-w-0 scroll-mt-20 flex-col gap-3",
		"aria-label": X("cleanup:tools.bulkDelete"),
		children: [
			r.isPending || r.isError ? /* @__PURE__ */ (0, $.jsxs)(l, {
				layout: "stack",
				labelledBy: "batch-delete-title",
				children: [/* @__PURE__ */ (0, $.jsx)(u, {
					id: "batch-delete-title",
					children: X("cleanup:tools.bulkDelete")
				}), r.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					title: X("cleanup:performerDelete.loadFailed"),
					action: /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "secondary",
						size: "small",
						onClick: () => void r.refetch(),
						children: X("cleanup:shared.retry")
					}),
					children: W(r.error)
				}) : /* @__PURE__ */ (0, $.jsx)("p", {
					role: "status",
					className: "text-body-regular text-text-secondary",
					children: X("cleanup:performerDelete.loading")
				})]
			}) : /* @__PURE__ */ (0, $.jsx)(It, {
				label: X("cleanup:performerDelete.tableLabel"),
				title: X("cleanup:tools.bulkDelete"),
				titleId: "batch-delete-title",
				unit: X("cleanup:performerDelete.unit"),
				description: e,
				items: v,
				columns: g,
				rowId: (e) => String(e.entity_id),
				rowLabel: (e) => Ae("performer", e.k, e.entity_id),
				selected: i,
				onSelected: a,
				toolbarActions: /* @__PURE__ */ (0, $.jsx)(p, {
					label: X("cleanup:performerDelete.search"),
					value: o,
					onQuery: (e) => {
						s(e), a([]);
					}
				}),
				actions: (e, t) => [{
					action: ee(),
					items: e,
					host: h,
					done: t
				}]
			}),
			f ? /* @__PURE__ */ (0, $.jsx)(E, {
				tone: "error",
				title: X("cleanup:performerDelete.planFailed"),
				children: f
			}) : null,
			c ? /* @__PURE__ */ (0, $.jsx)(E, {
				tone: y.length ? "warning" : "info",
				title: X("cleanup:performerDelete.purged", { count: c.purged }),
				extra: y.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					className: "flex flex-col gap-2 text-body-2-regular wrap-anywhere",
					children: y.slice(0, 5).map((e, t) => /* @__PURE__ */ (0, $.jsx)("p", { children: X("shell:format.withNote", {
						text: e.path,
						note: e.reason
					}) }, t))
				}) : null,
				children: y.length ? X("cleanup:performerDelete.partialFailure", {
					count: c.blocked.length,
					quarantined: c.cleanup_pending.length,
					cacheFiles: c.cache_blocked.length
				}) : X("cleanup:performerDelete.done")
			}) : null
		]
	});
}
// src/react/data-cleanup/resource-sync-card.tsx
var hn = Y("git-compare"), gn = Y("rotate-cw"), _n = X("cleanup:shared.reconnecting"), vn = X("cleanup:resourceSync.cleanUpDead"), yn = "inline-grid w-full grid-flow-col auto-cols-fr gap-4 max-plain-stat-pair:grid-flow-row max-plain-stat-pair:grid-cols-2 max-plain-stat-single:grid-cols-1", bn = (e) => Number(e || 0).toLocaleString();
function xn({ scan: e, partial: t = !1 }) {
	let n = e.cache ?? {
		files: 0,
		bytes: 0
	};
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("div", {
		className: yn,
		children: (e.sources ?? []).map((e) => /* @__PURE__ */ (0, $.jsxs)("article", {
			className: q(),
			children: [/* @__PURE__ */ (0, $.jsx)(j, {
				label: ue[e.location] || X("cleanup:resourceSync.storageFallback"),
				mark: /* @__PURE__ */ (0, $.jsx)(he, { mark: T[e.location] ?? "database" }),
				aside: /* @__PURE__ */ (0, $.jsx)(zt, {
					online: e.online,
					children: e.online ? X("cleanup:resourceSync.online") : X("cleanup:resourceSync.offline")
				}),
				figure: e.online ? X("cleanup:resourceSync.missingCount", { count: Number(e.missing || 0) }) : "—",
				meta: e.online ? bt(e) : X("cleanup:resourceSync.skipped", { summary: bt(e) }),
				wrapMeta: !0
			}), e.online && e.unreadable > 0 ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, $.jsxs)(ge, {
					tone: "warning",
					children: [
						bn(e.unreadable),
						" ",
						X("cleanup:resourceSync.unreadableDirs")
					]
				})
			}) : null]
		}, e.location))
	}), !t && /* @__PURE__ */ (0, $.jsxs)("div", {
		className: yn,
		children: [
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: q(),
				children: /* @__PURE__ */ (0, $.jsx)(j, {
					label: X("cleanup:resourceSync.toPurge"),
					figure: X("cleanup:resourceSync.purgeCount", { count: Number(ut(e) || 0) }),
					meta: X("cleanup:resourceSync.purgeHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: q(),
				children: /* @__PURE__ */ (0, $.jsx)(j, {
					label: X("cleanup:resourceSync.toVanish"),
					figure: X("cleanup:resourceSync.vanishCount", { count: Number(e.vanish || 0) }),
					meta: X("cleanup:resourceSync.vanishHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: q(),
				children: /* @__PURE__ */ (0, $.jsx)(j, {
					label: X("cleanup:resourceSync.emptyDirs"),
					figure: X("cleanup:resourceSync.emptyDirCount", { count: Number(e.empty || 0) }),
					meta: X("cleanup:resourceSync.emptyDirsHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: q(),
				children: /* @__PURE__ */ (0, $.jsx)(j, {
					label: X("cleanup:resourceSync.cache"),
					figure: X("cleanup:resourceSync.cacheCount", { count: Number(n.files || 0) }),
					meta: n.files ? G(n.bytes) : ""
				})
			})
		]
	})] });
}
function Sn({ toast: e }) {
	let n = kt({
		queryKey: N,
		queryFn: ({ signal: e }) => Je(e),
		start: Tt,
		onFinish: (t) => {
			if (J.invalidateQueries({
				queryKey: _e,
				exact: !0
			}), J.invalidateQueries({
				queryKey: P,
				exact: !0
			}), t.status !== "complete") return;
			let { done: n, left: r } = H(t);
			r ? e(X("cleanup:resourceSync.applyLeftovers", {
				done: bn(n),
				count: Number(r || 0)
			}), { warning: !0 }) : e(X("cleanup:resourceSync.cleaned"));
		}
	}), r = kt({
		queryKey: P,
		queryFn: ({ signal: e }) => Ye(e),
		start: Et,
		onStarted: () => n.dismiss()
	}), i = r.job, a = r.running || r.start.isPending, o = n.running || n.start.isPending, s = !!r.job && !!n.job, c = i?.status === "complete" || i?.status === "failed", d = X(a ? "cleanup:resourceSync.scanning" : c ? "cleanup:resourceSync.scanAgain" : "cleanup:resourceSync.checkFiles"), f = (e) => void De({
		holdToConfirm: !0,
		title: vn,
		body: V(e),
		confirmLabel: vn,
		danger: !0,
		onConfirm: () => n.start.mutateAsync(e.scan_id || "")
	}), p = n.outcome, m = (e) => {
		let t = H(e).left > 0;
		return /* @__PURE__ */ (0, $.jsx)(E, {
			tone: t ? "warning" : "success",
			title: X(t ? "cleanup:shared.partiallyCompleted" : "cleanup:resourceSync.cleanupResult"),
			children: xe(e, G)
		});
	}, h = null, g = null;
	if (p?.status === "failed") g = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:resourceSync.cleanupIncomplete"),
		children: K(p, "error") || X("cleanup:shared.checkTaskLogFiles")
	});
	else if (p) g = m(p);
	else if (n.running) h = /* @__PURE__ */ (0, $.jsx)(R, {
		embedded: !0,
		kind: B("resource-apply"),
		label: K(n.job) || X("cleanup:resourceSync.applying")
	});
	else if (r.start.isError) g = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:resourceSync.scanFailed"),
		children: W(r.start.error)
	});
	else if (r.query.isError && i) g = /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "neutral",
		title: X("cleanup:shared.taskStatus"),
		children: _n
	});
	else if (i?.status === "running") {
		let e = vt(i);
		h = /* @__PURE__ */ (0, $.jsx)(R, {
			embedded: !0,
			kind: B("resource-scan"),
			label: e,
			value: i.completed_sources,
			total: i.total_sources
		}), i.sources?.length && (g = /* @__PURE__ */ (0, $.jsx)(xn, {
			scan: i,
			partial: !0
		}));
	} else if (i?.status === "failed") g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [i.sources?.length ? /* @__PURE__ */ (0, $.jsx)(xn, {
		scan: i,
		partial: !0
	}) : null, /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:resourceSync.scanFailed"),
		children: K(i, "error") || X("cleanup:resourceSync.backgroundScanFailed")
	})] });
	else if (i?.status === "complete" && i.applied) g = n.job?.status === "complete" ? m(n.job) : /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "neutral",
		title: X("cleanup:resourceSync.cleanupResult"),
		children: X("cleanup:resourceSync.alreadyCleaned")
	});
	else if (i?.status === "complete") {
		let e = $e(i);
		g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(xn, { scan: i }), e ? /* @__PURE__ */ (0, $.jsx)(E, {
			tone: "neutral",
			title: X("cleanup:resourceSync.toClean"),
			action: /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "danger",
				disabled: !s,
				...U(o),
				onClick: () => {
					s && f(i);
				},
				children: o ? X("cleanup:resourceSync.applyingButton") : vn
			}),
			children: be(i)
		}) : /* @__PURE__ */ (0, $.jsx)("p", {
			className: "mr-auto text-body-regular text-notification-success-foreground",
			children: X("cleanup:resourceSync.nothingToClean")
		})] });
	}
	return n.start.isError && !p && (g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [g, /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:resourceSync.cleanupFailed"),
		children: W(n.start.error)
	})] })), /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "resource-sync",
		"aria-labelledby": "resource-sync-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(l, {
			layout: "split",
			labelledBy: "resource-sync-title",
			footer: /* @__PURE__ */ (0, $.jsx)(t, {
				"data-resource-scan": !0,
				leadingIcon: c && !a ? gn : hn,
				disabled: !s,
				...U(a),
				onClick: () => {
					s && !a && r.start.mutate();
				},
				children: d
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(u, {
					id: "resource-sync-title",
					gap: "small",
					children: X("cleanup:tools.resourceSync")
				}),
				r.query.isPending || n.query.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
					role: "status",
					"aria-label": X("cleanup:resourceSync.statusLoading"),
					"data-skeleton": "",
					className: "skeleton-sheen h-6 rounded-md"
				}) : null,
				!r.job && r.query.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					children: X("cleanup:resourceSync.scanStatusUnavailable")
				}) : null,
				!n.job && n.query.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
					tone: "error",
					children: X("cleanup:resourceSync.applyStatusUnavailable")
				}) : null,
				/* @__PURE__ */ (0, $.jsx)("p", {
					className: "max-w-190 text-body-2-regular leading-5 text-text-secondary",
					children: F
				}),
				/* @__PURE__ */ (0, $.jsx)("div", {
					"aria-live": "polite",
					className: "mt-4 empty:hidden",
					children: h
				})
			]
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			"aria-live": "polite",
			className: "flex flex-col gap-4 empty:hidden",
			children: g
		})]
	});
}
// src/react/data-cleanup/data-cleanup-tool-page.tsx
function Cn({ toast: e }) {
	let t = Z({
		queryKey: w,
		queryFn: ({ signal: e }) => He(e)
	});
	return t.isError ? /* @__PURE__ */ (0, $.jsx)(E, {
		tone: "error",
		title: X("cleanup:resourceSync.storageLoadFailed"),
		children: W(t.error)
	}) : t.isPending ? /* @__PURE__ */ (0, $.jsx)("p", {
		role: "status",
		children: X("cleanup:resourceSync.storageLoading")
	}) : et(t.data) ? /* @__PURE__ */ (0, $.jsx)(Sn, { toast: e }) : /* @__PURE__ */ (0, $.jsxs)(l, {
		layout: "stack",
		label: X("cleanup:tools.resourceSync"),
		children: [
			/* @__PURE__ */ (0, $.jsx)(u, { children: X("cleanup:tools.resourceSync") }),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-regular text-text-secondary",
				children: X("cleanup:resourceSync.noDirectories")
			}),
			/* @__PURE__ */ (0, $.jsx)("a", {
				href: "/settings/library",
				className: "text-body-medium text-accent-600 underline",
				children: X("cleanup:resourceSync.setUpLibrary")
			})
		]
	});
}
function wn({ tool: e, toast: t, failure: n }) {
	let r = (e) => t(e), i;
	switch (e) {
		case "organize":
			i = /* @__PURE__ */ (0, $.jsx)(on, {
				toast: r,
				failure: n
			});
			break;
		case "resource-sync":
			i = /* @__PURE__ */ (0, $.jsx)(Cn, { toast: t });
			break;
		case "orphan-records":
			i = /* @__PURE__ */ (0, $.jsx)(dn, { toast: r });
			break;
		case "media-repair":
			i = /* @__PURE__ */ (0, $.jsx)(Wt, { toast: r });
			break;
		case "links":
			i = /* @__PURE__ */ (0, $.jsx)(en, {});
			break;
		case "batch-delete": i = /* @__PURE__ */ (0, $.jsx)(mn, { toast: r });
	}
	return /* @__PURE__ */ (0, $.jsx)(Pt, { children: i });
}
// src/react/data-cleanup/data-cleanup-page.tsx
function Tn(e, t) {
	return e.data === void 0 ? e.isError ? {
		figure: X("cleanup:overview.loadFailed"),
		state: "error"
	} : {
		figure: X("cleanup:overview.loading"),
		state: "loading"
	} : t(e.data);
}
function En({ section: e, label: t, icon: n, value: r, open: i }) {
	return /* @__PURE__ */ (0, $.jsx)("button", {
		type: "button",
		className: q({ interactive: !0 }),
		"data-cleanup-go": e,
		"data-entry-state": r.state,
		"aria-busy": r.state === "loading" || void 0,
		onClick: () => i(e),
		children: /* @__PURE__ */ (0, $.jsx)(j, {
			label: t,
			icon: n,
			figure: r.figure,
			meta: r.meta
		})
	});
}
function Dn({ tool: e, navigate: t }) {
	let n = Y(e.icon);
	return /* @__PURE__ */ (0, $.jsx)(Vt, {
		label: e.title,
		icon: n,
		summary: e.description,
		attributes: { "data-cleanup-tool": e.key },
		onOpen: () => t(e.path + location.search)
	});
}
var On = Y("square-check-big"), kn = Y("sparkles"), An = Y("file-stack"), jn = Y("file-archive"), Mn = Y("trash"), Nn = () => {
	for (let e of [
		I,
		M,
		c,
		h
	]) J.invalidateQueries({
		queryKey: e,
		exact: !0
	});
};
function Pn({ toast: e, open: t, navigate: n }) {
	let o = Z({
		queryKey: I,
		queryFn: ({ signal: e }) => Xe(e)
	}), s = Z({
		queryKey: M,
		queryFn: ({ signal: e }) => Ke(e)
	}), l = Z({
		queryKey: c,
		queryFn: ({ signal: e }) => Ie(e)
	}), u = Z({
		queryKey: h,
		queryFn: ({ signal: e }) => Le(e)
	}), d = Z({
		queryKey: _e,
		queryFn: ({ signal: e }) => Ze(e)
	});
	return (0, Q.useEffect)(() => {
		let e = i[location.hash];
		e && at.replace(e + location.search);
	}, []), /* @__PURE__ */ (0, $.jsxs)(Pt, { children: [
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-pending",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(de, {
				id: "cleanup-pending",
				children: X("cleanup:overview.needsAttention")
			}), /* @__PURE__ */ (0, $.jsxs)("div", {
				className: A,
				children: [
					/* @__PURE__ */ (0, $.jsx)(En, {
						section: "review",
						label: X("cleanup:overview.review"),
						icon: On,
						open: t,
						value: Tn(o, gt)
					}),
					/* @__PURE__ */ (0, $.jsx)(En, {
						section: "duplicates",
						label: X("cleanup:overview.duplicates"),
						icon: An,
						open: t,
						value: Tn(l, (e) => Number(e.total || 0) ? {
							figure: X("cleanup:overview.duplicateGroups", {
								count: Number(e.total),
								files: Number(e.files || 0).toLocaleString()
							}),
							meta: X("cleanup:overview.reclaimable", { size: G(e.reclaimable || 0) })
						} : { figure: X("cleanup:overview.noDuplicates") })
					}),
					/* @__PURE__ */ (0, $.jsx)(En, {
						section: "ads",
						label: X("cleanup:overview.junkFiles"),
						icon: jn,
						open: t,
						value: Tn(u, (e) => ({
							figure: X("cleanup:overview.junkUndecided", { count: Number(e.pending_total || 0) }),
							meta: tt(e)
						}))
					}),
					/* @__PURE__ */ (0, $.jsx)(En, {
						section: "quality",
						label: X("cleanup:overview.hdUpgrades"),
						icon: kn,
						open: t,
						value: Tn(s, (e) => ({ figure: X("cleanup:overview.upgradesPending", { count: Number(e.total || 0) }) }))
					}),
					/* @__PURE__ */ (0, $.jsx)(En, {
						section: "trash",
						label: X("cleanup:overview.trash"),
						icon: Mn,
						open: t,
						value: Tn(d, (e) => ({
							figure: X("cleanup:overview.trashCount", { count: Number(e.total || 0) }),
							meta: e.total ? X("cleanup:overview.trashSize", { size: G(e.bytes || 0) }) : X("cleanup:overview.trashEmptyHint")
						}))
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, $.jsx)("div", {
			id: "libraryProcessing",
			className: "scroll-mt-20",
			children: /* @__PURE__ */ (0, $.jsx)(x, {
				toast: (t) => e(t),
				onComplete: Nn
			})
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-maintenance",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(de, {
				id: "cleanup-maintenance",
				children: X("cleanup:overview.maintenanceSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: r,
				children: a.filter((e) => e.key !== "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(Dn, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-deletion",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(de, {
				id: "cleanup-deletion",
				children: X("cleanup:overview.deletionSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: r,
				children: a.filter((e) => e.key === "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(Dn, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		})
	] });
}
export { Pn as DataCleanupPage, wn as DataCleanupToolPage };

//# debugId=71061f87-5a6e-4082-9552-6ef962fd6b6c