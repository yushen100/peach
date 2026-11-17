(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "136d9afd-c52e-4498-b5c7-31eb64ee6831", e._sentryDebugIdIdentifier = "sentry-dbid-136d9afd-c52e-4498-b5c7-31eb64ee6831");
	} catch {}
})();
import { BATCH_DELETE_TEXT as e, Button as t, CLEANUP_ENTRY as n, CLEANUP_ENTRY_GRID as r, CLEANUP_HASH_REDIRECTS as i, CLEANUP_TOOLS as a, Chip as o, ColumnFilterAvatar as s, DIRECTORY_TEMPLATE_ERROR as c, DUPLICATES_KEY as l, Fieldset as u, FieldsetTitle as d, IDLE_REPAIR as f, IconButton as p, IndexSearch as m, Input as h, JUNK_KEY as g, LEGACY_AVATAR_IMG as _, LINKS_KEY as v, LINK_CHECK_KEY as ee, LINK_KINDS as y, LINK_PRUNE_KEY as b, LOC as x, LibraryLabel as S, LibraryProcessingCard as te, MEDIA_REPAIR_KEY as C, MEDIA_REPAIR_URL as w, MEDIA_SOURCES_KEY as T, MEDIA_SOURCE_ICONS as E, Note as D, ORGANIZE_KEY as ne, ORGANIZE_PARAMETER_HINT as re, ORGANIZE_SCOPE_HINT as ie, ORGANIZE_TEXT as O, ORPHAN_RECORDS_KEY as k, ORPHAN_RECORDS_TEXT as A, PERFORMER_DELETE_KEY as j, PLAIN_STAT_STRIP as ae, PlainStat as M, Progress as oe, QUALITY_GOALS_KEY as se, RECORD_LABELS as N, REPAIR_CARD_TEXT as P, REPAIR_LIBRARIES_KEY as F, RESOURCE_APPLY_KEY as ce, RESOURCE_SCAN_KEY as le, RESOURCE_SYNC_TEXT as I, RESULT_PANEL as ue, RESULT_SECTION as de, REVIEW_COUNTS_KEY as L, SOURCE_LABELS as fe, SectionHeading as pe, Select as me, SelectItem as he, SiteMark as ge, SourceLabel as _e, SourceMark as ve, StatusLabel as R, TRASH_KEY as ye, TaskProgress as z, Wt as B, __toESM as be, activityKind as V, apiSend as xe, applyConfirmText as Se, applyLeftovers as Ce, applyPlanText as we, applyText as Te, attachOrphan as Ee, baseName as De, busyProps as H, candidateText as Oe, checkLine as ke, cleanupToolSkeletonHtml as Ae, codedText as je, confirmModal as Me, cx as Ne, deletePerformerVideos as Pe, entityDisplayName as Fe, entityFaceImg as Ie, entityPath as Le, errorMessage as U, esc as Re, fetchDeletePerformers as ze, fetchDeletePlan as Be, fetchDuplicates as Ve, fetchJunkSummary as He, fetchLinkCheck as Ue, fetchLinkPrune as We, fetchLinkStats as Ge, fetchMediaRepair as Ke, fetchMediaSources as qe, fetchOrganize as Je, fetchOrganizeExample as Ye, fetchOrphanRecords as Xe, fetchQualityGoals as Ze, fetchRepairLibraries as Qe, fetchResourceApply as $e, fetchResourceScan as et, fetchReviewCounts as tt, fetchTrashSummary as nt, firstGrapheme as rt, fmtSize as W, hasChanges as it, hasResourceRoots as at, jobText as G, junkBreakdown as ot, linkLabel as st, missingToolText as ct, organizeOutcome as lt, peachHistory$1 as ut, pickOrganizeFolder as dt, plainStatClass as K, planSummary as ft, previewOrganize as pt, pruneText as mt, purgeCount as ht, purgeOrphan as gt, queryClient as q, recordsText as _t, rememberTemplates as vt, require_jsx_runtime as yt, require_react as bt, reviewSummary as xt, runBulkAction as St, scanLine as Ct, serverLabel as wt, sourceMeta as Tt, spriteGlyph as J, stageText as Et, startLinkCheck as Dt, startLinkPrune as Ot, startOrganize as kt, startResourceApply as At, startResourceScan as jt, statusLine as Mt, t as Y, useAction as Nt, useBackgroundJob as X, useEntityNames as Pt, useMutation as Ft, useOrderedLibraries as It, useQuery as Z, withOrganizeJob as Lt } from "./peach-app.js";
import { Page as Rt } from "./peach-app.page-QAncjzM1.js";
import { ErrorExcerpt as zt } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as Bt } from "./peach-app.data-table-PbQqv_VV.js";
import { FolderSearchIcon as Vt } from "./peach-app.folder-rows-C3hhF_90.js";
import { ConnectionStatus as Ht } from "./peach-app.connection-status-BrXhLGSm.js";
// src/react/data-cleanup/cleanup-entry-card.tsx
var Q = /* @__PURE__ */ be(bt(), 1), $ = yt(), Ut = J("chevron-right");
function Wt({ label: e, icon: t, summary: r, detail: i, state: a, attributes: o, onOpen: s }) {
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
						className: Ne(n.summary, a === "error" && "text-text-error-primary"),
						children: r
					}),
					i ? /* @__PURE__ */ (0, $.jsx)("span", {
						className: n.detail,
						children: i
					}) : null
				]
			}),
			/* @__PURE__ */ (0, $.jsx)(Ut, {
				"aria-hidden": !0,
				className: n.arrow
			})
		]
	});
}
// src/react/media-repair/media-repair-card.tsx
var Gt = (e) => E[e] || e, Kt = (e) => q.setQueryData(C, e);
function qt({ toast: e = () => {} }) {
	let n = X({
		queryKey: C,
		queryFn: ({ signal: e }) => Ke(e),
		start: (e) => xe(w, {
			library: e,
			restart: !0
		}),
		onFinish: (t) => {
			t.status === "complete" && !t.failed && !t.missing_tool && e(t.repaired ? Y("cleanup:mediaRepair.repaired", { count: t.repaired }) : Y("cleanup:mediaRepair.nothingToRepair"));
		}
	}), r = Z({
		queryKey: F,
		queryFn: ({ signal: e }) => Qe(e)
	}), [i, a] = (0, Q.useState)(""), o = Nt(), s = n.job ?? f, c = It(r.data ?? [], (e) => e.id), l = s.status === "running", p = c.find((e) => e.id === (l ? s.library : i)) ?? c.find((e) => e.id === s.library) ?? c[0], m = () => {
		p && Me({
			title: Y("cleanup:mediaRepair.confirmTitle", { name: p.name }),
			body: [Y("cleanup:mediaRepair.body"), ...p.metered ? [Y("cleanup:mediaRepair.meteredWarning")] : []].join(Y("cleanup:shared.sentenceGap")),
			confirmLabel: Y("cleanup:mediaRepair.confirm"),
			onConfirm: async () => {
				await n.start.mutateAsync(p.id);
			}
		});
	}, h = () => void o.run("stop", (e) => xe(w, { stop: !0 }, "POST", e), Kt), g = n.outcome, _ = Mt(l ? s : g ?? f), v = o.error || G(g, "error") || (n.query.error ? Y("cleanup:mediaRepair.statusUnavailable") : "");
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsx)(u, {
			layout: "split",
			label: Y("cleanup:tools.mediaRepair"),
			footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(me, {
				"aria-label": Y("cleanup:mediaRepair.library"),
				prefix: Y("cleanup:mediaRepair.library"),
				className: "w-48",
				selectedKey: p?.id ?? null,
				isDisabled: l || !c.length,
				"aria-busy": r.isPending || void 0,
				onSelectionChange: (e) => {
					e !== null && a(String(e));
				},
				children: c.map((e) => /* @__PURE__ */ (0, $.jsx)(he, {
					id: e.id,
					textValue: e.name,
					children: /* @__PURE__ */ (0, $.jsx)(S, { library: {
						id: e.id,
						name: e.name,
						icon: Gt(e.icon)
					} })
				}, e.id))
			}), l ? /* @__PURE__ */ (0, $.jsx)(t, {
				onClick: h,
				...H(o.busy === "stop"),
				children: Y("cleanup:shared.stop")
			}) : /* @__PURE__ */ (0, $.jsx)(t, {
				onClick: m,
				disabled: !p,
				children: Y("cleanup:mediaRepair.start")
			})] }),
			children: /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, $.jsx)(d, { children: Y("cleanup:tools.mediaRepair") }),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: P
					}),
					l && s.total ? /* @__PURE__ */ (0, $.jsx)(oe, {
						label: Y("cleanup:mediaRepair.progress"),
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
				g?.status === "complete" && g.missing_tool ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "warning",
					title: Y("cleanup:mediaRepair.missingTool"),
					action: /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "ghost",
						size: "small",
						onClick: n.dismiss,
						children: Y("cleanup:mediaRepair.dismiss")
					}),
					children: ct(g)
				}) : null,
				r.isError ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					children: Y("cleanup:mediaRepair.librariesUnavailable")
				}) : null,
				v ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					children: v
				}) : null
			]
		})]
	});
}
// src/react/data-cleanup/link-check-icon.tsx
function Jt({ className: e }) {
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
var Yt = J("rotate-cw"), Xt = Y("cleanup:links.goneHint"), Zt = Y("cleanup:links.unclearHint"), Qt = Y("cleanup:links.pruneHint"), $t = Y("cleanup:shared.reconnecting"), en = (e) => Number(e || 0).toLocaleString();
function tn({ label: e, value: t, note: n }) {
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
function nn({ title: e, items: t, hint: n, picked: r, onPick: i, actions: a, controls: o, footer: c, confirmed: l = !1 }) {
	if (!t.length) return null;
	let u = [
		{
			id: "entity",
			label: Y("cleanup:links.columnEntry"),
			width: 180,
			min: 128,
			value: (e) => e.entity,
			filter: {
				values: (e) => e.entity,
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(s, {
					person: {
						...t.face,
						id: t.entity_id,
						name: e
					},
					kind: t.entity_kind,
					markId: t.entity_kind === "studio" || t.entity_kind === "agency" ? t.id : null
				}) })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("a", {
				className: "flex min-w-24 items-center gap-2 text-text-secondary hover:text-text-primary hover:underline",
				href: e.entity_id && e.entity_kind ? Le(e.entity_kind, e.entity, e.entity_id) : void 0,
				"data-link-identity": "",
				children: [/* @__PURE__ */ (0, $.jsx)("span", {
					"data-link-avatar": "",
					className: `relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-primary ${_}`,
					"aria-hidden": !0,
					dangerouslySetInnerHTML: { __html: `<span>${Re(rt(e.entity))}</span>` + Ie({
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
			label: Y("cleanup:shared.type"),
			width: 128,
			value: (e) => y[e.link_kind] || e.link_kind,
			filter: {
				values: (e) => e.link_kind,
				option: (e) => ({ label: y[e] || e })
			},
			render: (e) => y[e.link_kind] || e.link_kind
		},
		{
			id: "label",
			label: Y("cleanup:links.columnName"),
			min: 128,
			value: (e) => st(e.label),
			filter: {
				values: (e) => st(e.label) || new URL(e.url).hostname,
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(ge, { linkId: t.id }) })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "flex min-w-24 items-center gap-2",
				"data-link-name": "",
				children: /* @__PURE__ */ (0, $.jsx)("span", {
					className: "min-w-0 wrap-anywhere",
					children: st(e.label) || new URL(e.url).hostname
				})
			})
		},
		{
			id: "note",
			label: Y("cleanup:links.columnResult"),
			width: 320,
			min: 192,
			value: (e) => e.note,
			filter: { values: (e) => wt(e.note_code ?? "", e.note, e.note_params) },
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0 w-full",
				"data-link-result": l ? "gone" : "unclear",
				children: [/^(?:HTTP\s+)?[1-5]\d{2}$/.test(e.note.trim()) ? /* @__PURE__ */ (0, $.jsx)(R, {
					tone: l || /^(?:HTTP\s+)?5\d{2}$/.test(e.note.trim()) ? "error" : "warning",
					"data-link-code": "",
					children: e.note.trim()
				}) : /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex flex-col items-start gap-1",
					children: [/* @__PURE__ */ (0, $.jsx)(R, {
						tone: l ? "error" : "warning",
						children: Y(l ? "cleanup:links.dead" : "cleanup:links.inconclusive")
					}), /* @__PURE__ */ (0, $.jsx)(zt, {
						text: wt(e.note_code ?? "", e.note, e.note_params),
						className: "tabular-nums text-text-secondary"
					})]
				}), !l && e.temporary && e.attempts ? /* @__PURE__ */ (0, $.jsx)("span", {
					"data-link-rechecked": "",
					className: "mt-1 block text-body-2-regular text-text-secondary",
					children: Y("cleanup:links.rechecked", { count: e.attempts })
				}) : null]
			})
		},
		{
			id: "url",
			label: Y("cleanup:links.columnUrl"),
			width: 360,
			min: 180,
			value: (e) => e.url,
			filter: {
				values: (e) => new URL(e.url).hostname,
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(ge, { linkId: t.id }) })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("a", {
				href: e.url,
				target: "_blank",
				rel: "noopener noreferrer",
				title: e.url,
				"data-link-address": "",
				className: "flex min-w-0 items-center gap-1 text-text-secondary hover:text-text-primary",
				children: [
					/* @__PURE__ */ (0, $.jsx)(ge, { linkId: e.id }),
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-middle-truncate": !0,
						className: "min-w-0 truncate",
						children: e.url
					}),
					/* @__PURE__ */ (0, $.jsx)(B, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})
				]
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("div", {
		className: de,
		"data-link-results": l ? "gone" : "unclear",
		children: /* @__PURE__ */ (0, $.jsx)(Bt, {
			label: e,
			items: t,
			columns: u,
			rowId: (e) => String(e.id),
			description: n,
			unit: Y("cleanup:links.unit"),
			panel: !1,
			footerActions: c,
			rowLabel: (e) => Y("cleanup:links.rowLabel", {
				entity: e.entity,
				link: st(e.label) || e.url
			}),
			selected: r.map(String),
			onSelected: (e) => i(e.map(Number)),
			actions: (e) => a?.(e) ?? [],
			controls: () => o
		})
	});
}
function rn() {
	let e = Z({
		queryKey: v,
		queryFn: ({ signal: e }) => Ge(e)
	}), [n, r] = (0, Q.useState)([]), [i, a] = (0, Q.useState)([]), s = X({
		queryKey: b,
		queryFn: ({ signal: e }) => We(e),
		start: Ot,
		onFinish: () => {
			q.invalidateQueries({
				queryKey: v,
				exact: !0
			}), q.invalidateQueries({
				queryKey: ee,
				exact: !0
			});
		}
	}), c = X({
		queryKey: ee,
		queryFn: ({ signal: e }) => Ue(e),
		start: Dt,
		onStarted: () => {
			s.dismiss(), r([]), a([]);
		}
	}), l = c.job, f = l?.check_id ?? "";
	(0, Q.useEffect)(() => {
		r([]), a([]);
	}, [f]);
	let p = c.running || c.start.isPending, m = s.running || s.start.isPending, h = !!c.job && !!s.job, g = l?.status === "complete", _ = l?.gone ?? [], x = l?.unclear ?? [], S = g ? x : [], te = _.filter((e) => i.includes(e.id)).map((e) => e.id), C = S.filter((e) => n.includes(e.id)).map((e) => e.id), w = e.data, T = (w?.top_hosts ?? []).slice(0, 3), E = (e) => {
		!h || p || e && !e.length || c.start.mutate(e ? {
			retry: e,
			checkId: f
		} : {});
	}, ne = (e, t = !1) => ({
		key: t ? "prune-all" : "prune",
		label: e,
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: Y("cleanup:links.deleteDead"),
			danger: !0,
			body: Y("cleanup:links.deleteDeadBody", { count: e.length })
		}),
		run: async (e) => {
			await s.start.mutateAsync({
				checkId: f,
				ids: t ? void 0 : e.map((e) => e.id)
			});
		},
		receipt: () => ""
	}), re = { receipt: () => {} }, ie = () => {
		h && !m && _.length && St(ne(Y("cleanup:links.deleteDead"), !0), _, re);
	}, O = s.outcome, k = c.start.error ?? s.start.error, A = null, j = null;
	if (O?.status === "failed") j = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:links.pruneIncomplete"),
		children: G(O, "error") || Y("cleanup:links.checkTaskLog")
	});
	else if (O && !_.length && !x.length) j = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "success",
		title: Y("cleanup:links.pruneDone"),
		children: mt(O)
	});
	else if (k) j = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:links.checkFailed"),
		children: U(k)
	});
	else if (c.query.isError && l) j = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "neutral",
		title: Y("cleanup:shared.taskStatus"),
		children: $t
	});
	else if (l?.status === "failed") j = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:links.checkFailed"),
		children: G(l, "error") || Y("cleanup:links.checkFailed")
	});
	else if (l && l.status !== "idle") {
		A = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [l.status === "running" ? /* @__PURE__ */ (0, $.jsx)(z, {
			embedded: !0,
			kind: V("link-check"),
			label: ke(l),
			value: Math.min(l.checked || 0, l.total || 0),
			total: l.total
		}) : null, m ? /* @__PURE__ */ (0, $.jsx)(z, {
			embedded: !0,
			kind: V("link-prune"),
			label: G(s.job) || Y("cleanup:links.pruning"),
			value: Math.min(s.job?.checked || 0, s.job?.total || 0),
			total: s.job?.total
		}) : null] });
		let e = Y("cleanup:links.retrySelected", { count: C.length });
		j = g || _.length || x.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
			className: ue,
			children: [
				O?.status === "complete" ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "success",
					title: Y("cleanup:links.pruneDone"),
					children: mt(O)
				}) : null,
				/* @__PURE__ */ (0, $.jsx)(nn, {
					title: Y("cleanup:links.dead"),
					items: _,
					hint: Xt,
					picked: i,
					onPick: a,
					confirmed: !0,
					footer: g && _.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mr-auto min-w-0 text-caption-1-regular text-text-secondary",
						children: Qt
					}), /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "danger",
						...H(m),
						onClick: ie,
						children: Y("cleanup:links.deleteDeadCount", { count: _.length })
					})] }) : null,
					actions: (e) => [{
						action: ne(Y("cleanup:links.deleteSelected", { count: te.length })),
						items: e,
						host: re,
						disabled: !g || m
					}]
				}),
				/* @__PURE__ */ (0, $.jsx)(nn, {
					title: Y("cleanup:links.unreached"),
					items: x,
					hint: Zt,
					picked: n,
					onPick: r,
					footer: S.length ? /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "primary",
						leadingIcon: Yt,
						...H(p),
						onClick: () => E(S.map((e) => e.id)),
						children: Y("cleanup:links.retryAll", { count: S.length })
					}) : null,
					controls: S.length ? /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "secondary",
						leadingIcon: Yt,
						disabled: !C.length,
						...H(p),
						onClick: () => E(C),
						children: e
					}) : null
				}),
				g && !_.length && !x.length ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `${de} text-body-regular text-notification-success-foreground`,
					children: Y("cleanup:links.allReachable")
				}) : null
			]
		}) : null;
	}
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "link-manager",
		"aria-labelledby": "link-manager-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(u, {
			layout: "stack",
			labelledBy: "link-manager-title",
			footer: /* @__PURE__ */ (0, $.jsx)(t, {
				"data-link-check": "",
				leadingIcon: Jt,
				disabled: !h,
				...H(p),
				onClick: () => E(),
				children: Y(p ? "cleanup:links.checking" : g ? "cleanup:links.checkAgain" : "cleanup:links.checkLinks")
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(d, {
					id: "link-manager-title",
					gap: "small",
					children: Y("cleanup:tools.links")
				}),
				e.isError ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					title: Y("cleanup:links.statsLoadFailed"),
					children: U(e.error)
				}) : w ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("div", {
					className: "link-stat-grid mt-4 gap-x-8 gap-y-3",
					children: [/* @__PURE__ */ (0, $.jsx)(tn, {
						label: Y("cleanup:links.totalLinks"),
						value: en(w.total),
						note: Y("cleanup:links.entitySpread", { count: Number(w.entities || 0) })
					}), Object.entries(w.by_kind ?? {}).map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(tn, {
						label: y[e] || e,
						value: en(t)
					}, e))]
				}), T.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "mt-4 flex min-w-0 flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, $.jsx)("span", {
						className: "text-caption-1-regular text-text-secondary",
						children: Y("cleanup:links.topSites")
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						className: "flex min-w-0 flex-wrap gap-x-5 gap-y-2",
						children: T.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)("span", {
							"data-top-host": "",
							className: "inline-flex min-w-0 max-w-full items-center gap-1.5",
							children: [/* @__PURE__ */ (0, $.jsxs)("a", {
								href: `https://${e}`,
								target: "_blank",
								rel: "noopener noreferrer",
								className: "inline-flex min-w-0 items-center gap-1.5 text-body-2-medium text-text-primary",
								children: [
									/* @__PURE__ */ (0, $.jsx)(ge, { linkId: w.top_host_link_ids?.[e] }),
									/* @__PURE__ */ (0, $.jsx)("span", {
										className: "min-w-0 wrap-anywhere",
										children: e
									}),
									/* @__PURE__ */ (0, $.jsx)(B, {
										"aria-hidden": !0,
										className: "size-(--icon-inline) shrink-0"
									})
								]
							}), /* @__PURE__ */ (0, $.jsx)(o, {
								variant: "caption",
								color: "neutral",
								children: /* @__PURE__ */ (0, $.jsx)("span", {
									className: "tabular-nums",
									children: en(t)
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
var an = (e, t) => t ? Y("cleanup:organize.applyBodyPath", {
	name: e,
	path: t
}) : Y("cleanup:organize.applyBodyAll", { name: e }), on = Y("cleanup:organize.rollbackBody"), sn = 8;
function cn({ plan: e }) {
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("ol", {
		className: "mt-2 flex min-w-0 flex-col gap-1",
		children: e.rows.slice(0, sn).map((e) => /* @__PURE__ */ (0, $.jsxs)("li", {
			className: "flex min-w-0 items-center gap-2 text-caption-1-regular text-text-secondary",
			children: [
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.current_path,
					className: "min-w-0 truncate",
					children: De(e.current_path)
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"aria-hidden": !0,
					children: "→"
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.target_path,
					className: "min-w-0 truncate text-text-primary",
					children: De(e.target_path)
				})
			]
		}, e.current_path))
	}), e.truncated || e.rows.length > sn ? /* @__PURE__ */ (0, $.jsx)("p", {
		className: "text-caption-1-regular text-text-secondary",
		children: Y("cleanup:organize.planTruncated")
	}) : null] });
}
function ln({ toast: e, failure: n }) {
	let r = Z({
		queryKey: ne,
		queryFn: ({ signal: e }) => Je(e)
	}), i = r.data, a = i?.locations ?? [], [o, s] = (0, Q.useState)(""), l = a.some((e) => e.location === o) ? o : a[0]?.location ?? "", f = i?.templates?.[l], [m, g] = (0, Q.useState)(null), _ = m?.location === l ? m : {
		location: l,
		file: f?.file ?? "",
		dir: f?.dir ?? ""
	}, v = (e) => {
		g({
			..._,
			...e
		}), N.reset();
	}, [ee, y] = (0, Q.useState)({
		location: "",
		path: ""
	}), b = ee.location === l ? ee.path : "", S = (0, Q.useRef)({
		location: l,
		path: b
	});
	S.current = {
		location: l,
		path: b
	};
	let [te, C] = (0, Q.useState)(null), w = (0, Q.useRef)(null), T = (0, Q.useRef)(null), k = (0, Q.useRef)(null), A = Z({
		queryKey: [
			"organize-example",
			_.file,
			_.dir
		],
		queryFn: ({ signal: e }) => Ye(_.file, _.dir, e),
		enabled: !!i
	}), [j, ae] = (0, Q.useState)("file"), M = (0, Q.useRef)(!1), oe = (0, Q.useRef)(null);
	(0, Q.useLayoutEffect)(() => {
		let e = oe.current;
		if (!e) return;
		oe.current = null;
		let t = (e.field === "file" ? w : T).current;
		t?.focus(), t?.setSelectionRange(e.caret, e.caret);
	});
	let se = () => ({
		location: l,
		path: b.trim(),
		file_template: _.file.trim(),
		dir_template: _.dir.trim()
	}), N = Ft({
		mutationFn: pt,
		onError: (e) => {
			let t = /整理路径/.test(U(e)) ? "path" : c.test(U(e)) ? "dir" : "file";
			C(t), (t === "path" ? k : t === "dir" ? T : w).current?.focus();
		}
	}), P = Ft({
		mutationFn: ({ initial: e }) => dt(e),
		onSuccess: (e, t) => {
			e.path && t.location === S.current.location && t.path === S.current.path && (y({
				location: t.location,
				path: e.path
			}), C(null), N.reset(), k.current?.focus());
		}
	}), F = X({
		queryKey: ne,
		queryFn: ({ signal: e }) => Je(e),
		start: kt,
		jobOf: (e) => e,
		withJob: Lt,
		onStarted: () => N.reset(),
		onFinish: (t) => {
			if (q.invalidateQueries({
				queryKey: ne,
				exact: !0
			}), t.status !== "complete") return;
			let { text: r, failed: i } = lt(t);
			i ? n(Y("cleanup:tools.organize"), Error(Y("cleanup:organize.rowsFailed", { count: i }))) : e(r.replace(/。$/, ""));
		}
	}), ce = F.running || F.start.isPending, le = JSON.stringify(N.variables) === JSON.stringify(se()), I = le ? N.data : void 0, ue = Number(I?.counts?.change || 0), de = x[l] || l, L = (e) => {
		v(e), C(null), N.reset();
	}, fe = (e) => {
		let t = (j === "file" ? w : T).current, n = _[j], r = M.current ? t?.selectionStart ?? n.length : n.length, i = M.current ? t?.selectionEnd ?? r : r, a = `{${e}}`;
		oe.current = {
			field: j,
			caret: r + a.length
		}, L({ [j]: n.slice(0, r) + a + n.slice(i) });
	}, pe = () => {
		N.isPending || ce || !l || (F.dismiss(), F.start.reset(), C(null), N.mutate(se()));
	}, ge = () => {
		let e = N.variables;
		e && I && ue && Me({
			title: Y("cleanup:tools.organize"),
			body: an(de, e.path),
			confirmLabel: Y("cleanup:tools.organize"),
			onConfirm: async () => {
				await F.start.mutateAsync({
					kind: "apply",
					request: e
				}), vt({
					...i?.templates ?? {},
					[e.location]: {
						file: e.file_template,
						dir: e.dir_template
					}
				});
			}
		});
	}, _e = () => void Me({
		title: Y("cleanup:organize.rollbackTitle"),
		body: on,
		confirmLabel: Y("cleanup:organize.rollbackConfirm"),
		onConfirm: () => F.start.mutateAsync({ kind: "rollback" })
	}), R = null, ye = !!ue && !ce && !F.outcome, B = F.job, be = F.outcome;
	if (B?.status === "running") {
		let e = G(B) || Et(B) || Y("cleanup:organize.running");
		R = /* @__PURE__ */ (0, $.jsx)(z, {
			embedded: !0,
			kind: V("organize", B.stage_code),
			label: e,
			value: Math.min(B.checked || 0, B.total || 0),
			total: B.total
		});
	} else if (be?.status === "failed") R = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:organize.incomplete"),
		children: G(be, "error") || Y("cleanup:shared.checkTaskLogFiles")
	});
	else if (be) {
		let { text: e, failed: t } = lt(be);
		R = /* @__PURE__ */ (0, $.jsx)(D, {
			tone: t ? "warning" : "success",
			title: Y(t ? "cleanup:shared.partiallyCompleted" : "cleanup:organize.result"),
			children: e
		});
	} else F.start.isError ? R = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:organize.failed"),
		children: U(F.start.error)
	}) : N.isPending ? R = /* @__PURE__ */ (0, $.jsx)(z, {
		embedded: !0,
		kind: V("organize", "organize.checkingPlan"),
		label: Y("cleanup:organize.checkingPlan")
	}) : N.isError && le ? R = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:organize.previewFailed"),
		children: U(N.error)
	}) : I && (R = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(D, {
		tone: "neutral",
		title: Y("cleanup:organize.previewResult"),
		children: ft(I)
	}), ue ? /* @__PURE__ */ (0, $.jsx)(cn, { plan: I }) : null] }));
	return /* @__PURE__ */ (0, $.jsxs)(u, {
		layout: "stack",
		id: "organize",
		labelledBy: "cleanup-organize-title",
		attributes: { "data-cleanup-organize": "" },
		footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
			i?.last_batch ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "secondary",
				...H(ce),
				onClick: _e,
				children: Y("cleanup:organize.rollbackLastBatch")
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(t, {
				variant: ye ? "secondary" : "primary",
				disabled: !a.length || ce,
				...H(N.isPending),
				onClick: pe,
				children: Y("cleanup:organize.preview")
			}),
			ye ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "primary",
				onClick: ge,
				children: Y("cleanup:organize.apply")
			}) : null
		] }),
		children: [
			/* @__PURE__ */ (0, $.jsx)(d, {
				id: "cleanup-organize-title",
				gap: "medium",
				children: Y("cleanup:organize.title")
			}),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-regular text-text-secondary",
				children: O
			}),
			r.isError ? /* @__PURE__ */ (0, $.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					title: Y("cleanup:organize.settingsLoadFailed"),
					children: U(r.error)
				})
			}) : null,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "mt-3 flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-organize-scope": !0,
						className: "flex min-w-0 flex-wrap items-start gap-2",
						children: [a.length ? /* @__PURE__ */ (0, $.jsx)(me, {
							"aria-label": Y("cleanup:organize.storageLabel"),
							prefix: Y("cleanup:organize.storagePrefix"),
							className: "w-fit min-w-25",
							selectedKey: l || null,
							onSelectionChange: (e) => {
								e !== null && (s(String(e)), y({
									location: String(e),
									path: ""
								}), C(null), N.reset(), P.reset(), M.current = !1);
							},
							children: a.map((e) => /* @__PURE__ */ (0, $.jsxs)(he, {
								id: e.location,
								textValue: x[e.location] || e.location,
								children: [/* @__PURE__ */ (0, $.jsx)(ve, { mark: E[e.location] || "database" }), x[e.location] || e.location]
							}, e.location))
						}) : null, /* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex min-w-0 basis-64 flex-1 items-start gap-2",
							children: [/* @__PURE__ */ (0, $.jsx)(h, {
								"aria-label": Y("cleanup:organize.pathLabel"),
								className: "min-w-0 flex-1",
								placeholder: Y("cleanup:organize.pathPlaceholder"),
								name: "organize-path",
								autoComplete: "off",
								spellCheck: "false",
								value: b,
								ref: k,
								isInvalid: te === "path",
								onChange: (e) => {
									y({
										location: l,
										path: e
									}), C(null), N.reset(), P.reset();
								}
							}), /* @__PURE__ */ (0, $.jsx)(p, {
								icon: Vt,
								"aria-label": Y("cleanup:organize.choosePath"),
								...H(P.isPending),
								onClick: () => P.mutate({
									initial: b || a.find((e) => e.location === l)?.roots[0] || "",
									location: l,
									path: b
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-caption-1-regular text-text-secondary",
						children: ie
					}),
					P.isError ? /* @__PURE__ */ (0, $.jsxs)(D, {
						tone: "error",
						title: Y("cleanup:organize.pickerFailed"),
						children: [U(P.error), Y("cleanup:organize.pickerFallback")]
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(h, {
						label: Y("cleanup:organize.fileTemplate"),
						placeholder: "{code}[ {title}]",
						value: _.file,
						ref: w,
						spellCheck: "false",
						isInvalid: te === "file",
						onFocus: () => {
							ae("file"), M.current = !0;
						},
						onChange: (e) => L({ file: e })
					}),
					/* @__PURE__ */ (0, $.jsx)(h, {
						label: Y("cleanup:organize.dirTemplate"),
						placeholder: Y("cleanup:organize.dirTemplatePlaceholder"),
						value: _.dir,
						ref: T,
						spellCheck: "false",
						isInvalid: te === "dir",
						onFocus: () => {
							ae("dir"), M.current = !0;
						},
						onChange: (e) => L({ dir: e })
					}),
					i?.presets?.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-col gap-2",
						role: "group",
						"aria-label": Y("cleanup:organize.applyPreset"),
						children: [/* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-caption-1-medium text-text-secondary",
							children: Y("cleanup:organize.applyPreset")
						}), /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-2",
							children: i.presets.map((e) => {
								let n = je(e, "label");
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
						children: [Y("cleanup:organize.examplePath"), /* @__PURE__ */ (0, $.jsx)("code", {
							className: "wrap-anywhere",
							children: A.data?.example || A.data?.error || (A.isError ? U(A.error) : Y("cleanup:organize.previewLoading"))
						})]
					}),
					i?.placeholders?.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-col gap-2",
						role: "group",
						"aria-label": Y("cleanup:organize.insertParameter"),
						children: [/* @__PURE__ */ (0, $.jsxs)("p", {
							className: "text-caption-1-regular text-text-secondary",
							"aria-live": "polite",
							children: [/* @__PURE__ */ (0, $.jsx)("strong", {
								className: "text-caption-1-semibold text-text-primary",
								children: Y("cleanup:organize.insertParameter")
							}), Y("cleanup:organize.insertTarget", { target: Y(j === "file" ? "cleanup:organize.fileTemplate" : "cleanup:organize.dirTemplate") })]
						}), /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: i.placeholders.map((e) => {
								let n = wt(`labels.organizeTemplates.placeholder.${e.key}`, e.label);
								return /* @__PURE__ */ (0, $.jsx)(t, {
									variant: "ghost",
									size: "small",
									"aria-label": `${n} {${e.key}}`,
									onClick: () => fe(e.key),
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
						children: re
					})
				]
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"aria-live": "polite",
				className: "mt-3 flex flex-col gap-2 empty:hidden",
				children: R
			})
		]
	});
}
// src/react/data-cleanup/orphan-records-card.tsx
var un = J("play"), dn = Object.fromEntries([
	...N,
	["rating", Y("catalog:shared.rating")],
	["play_count", Y("catalog:catalogList.plays")],
	["last_played", Y("catalog:catalogList.lastWatched")],
	["o_count", Y("catalog:catalogList.climaxCount")]
]), fn = () => q.invalidateQueries({
	queryKey: k,
	exact: !0
});
function pn({ item: e, toast: n }) {
	let [r, i] = (0, Q.useState)(e.candidates[0]?.id ?? null), a = Ft({
		mutationFn: () => Ee(e.id, Number(r)),
		onSuccess: () => {
			let t = e.candidates.find((e) => e.id === r);
			n(Y("cleanup:orphans.attached", {
				name: e.name,
				target: t?.name ?? Y("cleanup:orphans.selectedFile")
			})), fn();
		},
		onError: (e) => n(U(e))
	}), o = Ft({
		mutationFn: () => gt(e.id),
		onSuccess: (t) => {
			n(t.blocked.length ? Y("cleanup:orphans.fileRestored", { name: e.name }) : Y("cleanup:orphans.recordDeleted", { name: e.name })), fn();
		}
	}), s = () => {
		Me({
			title: Y("cleanup:orphans.deleteRecord"),
			holdToConfirm: !0,
			body: _t(e.records) ? Y("cleanup:orphans.deleteBodyWithActivity", {
				name: e.name,
				records: _t(e.records)
			}) : Y("cleanup:orphans.deleteBody", { name: e.name }),
			confirmLabel: Y("cleanup:orphans.deleteRecord"),
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
				...H(c),
				onClick: s,
				children: Y("cleanup:orphans.deleteRecord")
			}),
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(me, {
				"aria-label": Y("cleanup:orphans.targetLabel", { name: e.name }),
				prefix: Y("cleanup:orphans.targetPrefix"),
				className: "w-52",
				selectedKey: r,
				onSelectionChange: (e) => {
					e !== null && i(Number(e));
				},
				children: e.candidates.map((e) => /* @__PURE__ */ (0, $.jsx)(he, {
					id: e.id,
					textValue: Oe(e),
					children: Oe(e)
				}, e.id))
			}) : null,
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "primary",
				size: "small",
				disabled: r === null,
				...H(c),
				onClick: () => a.mutate(),
				children: Y("cleanup:orphans.moveActivity")
			}) : null
		]
	});
}
function mn({ item: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			className: "relative inline-grid aspect-16/10 w-24 flex-none place-items-center max-cleanup-tight:hidden overflow-hidden rounded-lg border border-separator-border bg-media-placeholder text-text-tertiary",
			children: [/* @__PURE__ */ (0, $.jsx)(un, {
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
					e.location ? /* @__PURE__ */ (0, $.jsx)(_e, {
						source: e.location,
						label: x[e.location] || e.location
					}) : null
				]
			})]
		})]
	});
}
function hn({ toast: e }) {
	let [t, n] = (0, Q.useState)([]), r = Z({
		queryKey: k,
		queryFn: ({ signal: e }) => Xe(e)
	}), i = r.data?.items ?? [], a = { receipt: e }, o = (e) => {
		let t = null;
		return {
			key: "purge",
			label: Y("cleanup:orphans.deleteSelectedCount", { count: e }),
			reversal: "irreversible",
			danger: !0,
			holdToConfirm: !0,
			confirm: (e) => ({
				title: Y("cleanup:orphans.deleteSelectedTitle"),
				danger: !0,
				body: Y("cleanup:orphans.deleteSelectedBody", { count: e.length }),
				items: e.map((e) => e.name)
			}),
			run: async (e) => {
				t = await gt(e.map((e) => e.id));
			},
			receipt: () => t ? Y("cleanup:orphans.purged", { count: t.purged }) + (t.blocked.length ? Y("cleanup:orphans.purgedBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, s = [
		{
			id: "item",
			label: Y("cleanup:shared.video"),
			width: 480,
			min: 320,
			value: (e) => e.name,
			render: (e) => /* @__PURE__ */ (0, $.jsx)(mn, { item: e })
		},
		{
			id: "records",
			label: Y("cleanup:orphans.columnActivity"),
			width: 176,
			min: 144,
			value: (e) => _t(e.records),
			filter: {
				values: (e) => Object.keys(e.records).filter((t) => e.records[t]),
				option: (e) => ({ label: dn[e] || e })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "block min-w-0 whitespace-normal wrap-anywhere",
				children: _t(e.records) || Y("cleanup:shared.none")
			})
		},
		{
			id: "target",
			label: Y("cleanup:shared.actions"),
			width: i.some((e) => e.candidates.length) ? 360 : 128,
			min: 128,
			value: (e) => e.candidates.length,
			render: (t) => /* @__PURE__ */ (0, $.jsx)(pn, {
				item: t,
				toast: e
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("section", {
		id: "orphan-records",
		"aria-labelledby": "orphan-records-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: r.isError ? /* @__PURE__ */ (0, $.jsxs)(u, {
			layout: "stack",
			labelledBy: "orphan-records-title",
			children: [/* @__PURE__ */ (0, $.jsx)(d, {
				id: "orphan-records-title",
				children: Y("cleanup:tools.orphanRecords")
			}), /* @__PURE__ */ (0, $.jsx)(D, {
				tone: "error",
				title: Y("cleanup:orphans.loadFailed"),
				children: U(r.error)
			})]
		}) : /* @__PURE__ */ (0, $.jsx)(Bt, {
			label: Y("cleanup:orphans.tableLabel"),
			items: i,
			columns: s,
			title: Y("cleanup:tools.orphanRecords"),
			titleId: "orphan-records-title",
			unit: Y("cleanup:orphans.unit"),
			description: A,
			rowId: (e) => String(e.id),
			rowLabel: (e) => e.name,
			selected: t,
			onSelected: n,
			actions: (e) => [{
				items: e,
				host: a,
				action: o(e.length),
				done: () => {
					n([]), fn();
				}
			}]
		})
	});
}
// src/react/data-cleanup/performer-delete-card.tsx
function gn({ person: e }) {
	let t = Fe("performer", e.k, e.entity_id);
	return /* @__PURE__ */ (0, $.jsxs)("a", {
		href: Le("performer", e.k, e.entity_id),
		title: t,
		className: "flex min-w-0 items-center gap-3 text-text-primary",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			"aria-hidden": !0,
			className: Ne("relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium", _),
			dangerouslySetInnerHTML: { __html: `<span>${Re(rt(t))}</span>` + Ie({
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
function _n(e, t, n) {
	let r = (e) => e.slice(0, 5).join(Y("cleanup:shared.listSeparator")), i = e.length > 5 ? Y("cleanup:performerDelete.moreNames", {
		names: r(e),
		total: e.length
	}) : r(e), a = t.length > 5 ? Y("cleanup:performerDelete.moreExamples", {
		examples: r(t),
		total: t.length
	}) : r(t);
	return [
		Y("cleanup:performerDelete.bodyScope", {
			names: i,
			count: n.total,
			size: W(n.bytes)
		}),
		Y("cleanup:performerDelete.bodyWarning"),
		...n.shared ? [Y("cleanup:performerDelete.sharedFiles", { count: n.shared })] : [],
		Y("cleanup:performerDelete.bodyExamples", { examples: a })
	].join(Y("cleanup:shared.sentenceGap"));
}
function vn({ toast: n }) {
	Pt();
	let r = Z({
		queryKey: j,
		queryFn: ({ signal: e }) => ze(e)
	}), [i, a] = (0, Q.useState)([]), [o, c] = (0, Q.useState)(""), [l, f] = (0, Q.useState)(null), [p, h] = (0, Q.useState)(""), g = {
		receipt: n,
		failure: (e) => h(U(e))
	}, _ = (0, Q.useMemo)(() => [
		{
			id: "name",
			label: Y("cleanup:shared.actress"),
			width: 280,
			min: 160,
			value: (e) => e.k,
			filter: {
				values: (e) => e.k,
				option: (e, t) => ({
					label: Fe("performer", e, t?.entity_id),
					searchTerms: t?.aliases,
					leading: t && /* @__PURE__ */ (0, $.jsx)(s, { person: {
						...t,
						id: t.entity_id,
						name: e
					} })
				})
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)(gn, { person: e })
		},
		{
			id: "works",
			label: Y("cleanup:shared.videos"),
			width: 104,
			min: 80,
			value: (e) => e.n,
			render: (e) => Y("cleanup:performerDelete.videoCount", { count: e.n })
		},
		{
			id: "files",
			label: Y("cleanup:shared.files"),
			width: 104,
			min: 80,
			value: (e) => e.file_count,
			render: (e) => Y("cleanup:performerDelete.fileCount", { count: e.file_count })
		},
		{
			id: "bytes",
			label: Y("cleanup:performerDelete.columnSize"),
			width: 136,
			min: 104,
			value: (e) => e.bytes,
			render: (e) => W(e.bytes)
		}
	], []), v = o.toLocaleLowerCase(), ee = (r.data?.items || []).filter((e) => !v || [
		e.k,
		Fe("performer", e.k, e.entity_id),
		...e.aliases
	].some((e) => e.toLocaleLowerCase().includes(v))), y = () => {
		let e = null, t = null;
		return {
			key: "performer-delete",
			label: Y("cleanup:performerDelete.deleteSelected"),
			reversal: "irreversible",
			danger: !0,
			holdToConfirm: !0,
			confirm: async (t) => {
				h("");
				let n = await Be(t.map((e) => e.entity_id));
				if (!n.total) throw Error(Y("cleanup:performerDelete.nothingToDelete"));
				e = n;
				let r = n.performers.map((e) => Fe("performer", e.name, e.id)), i = [...new Set(n.items.map((e) => e.code || e.name || `#${e.id}`))];
				return {
					title: Y("cleanup:performerDelete.confirmTitle"),
					confirmLabel: Y("cleanup:performerDelete.confirm"),
					danger: !0,
					body: _n(r, i, n)
				};
			},
			run: async () => {
				t = await Pe(e), f(t), await Promise.all([q.invalidateQueries({
					queryKey: j,
					exact: !0
				}), q.invalidateQueries({
					queryKey: ye,
					exact: !0
				})]);
			},
			receipt: () => t ? Y("cleanup:performerDelete.purged", { count: t.purged }) + (t.blocked.length ? Y("cleanup:performerDelete.doneBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, b = l ? [
		...l.blocked.map((e) => ({
			path: e.path,
			reason: wt(e.reason_code ?? "", e.reason, e.reason_params)
		})),
		...l.cleanup_pending,
		...l.cache_blocked.map((e) => ({
			path: e.name,
			reason: e.reason
		}))
	] : [];
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "batch-delete",
		className: "flex min-w-0 scroll-mt-20 flex-col gap-3",
		"aria-label": Y("cleanup:tools.bulkDelete"),
		children: [
			r.isPending ? /* @__PURE__ */ (0, $.jsx)("div", { dangerouslySetInnerHTML: { __html: Ae("batch-delete") } }) : r.isError ? /* @__PURE__ */ (0, $.jsxs)(u, {
				layout: "stack",
				labelledBy: "batch-delete-title",
				children: [/* @__PURE__ */ (0, $.jsx)(d, {
					id: "batch-delete-title",
					children: Y("cleanup:tools.bulkDelete")
				}), /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					title: Y("cleanup:performerDelete.loadFailed"),
					action: /* @__PURE__ */ (0, $.jsx)(t, {
						variant: "secondary",
						size: "small",
						onClick: () => void r.refetch(),
						children: Y("cleanup:shared.retry")
					}),
					children: U(r.error)
				})]
			}) : /* @__PURE__ */ (0, $.jsx)(Bt, {
				label: Y("cleanup:performerDelete.tableLabel"),
				title: Y("cleanup:tools.bulkDelete"),
				titleId: "batch-delete-title",
				unit: Y("cleanup:performerDelete.unit"),
				description: e,
				items: ee,
				columns: _,
				rowId: (e) => String(e.entity_id),
				rowLabel: (e) => Fe("performer", e.k, e.entity_id),
				selected: i,
				onSelected: a,
				toolbarActions: /* @__PURE__ */ (0, $.jsx)(m, {
					label: Y("cleanup:performerDelete.search"),
					value: o,
					onQuery: (e) => {
						c(e), a([]);
					}
				}),
				actions: (e, t) => [{
					action: y(),
					items: e,
					host: g,
					done: t
				}]
			}),
			p ? /* @__PURE__ */ (0, $.jsx)(D, {
				tone: "error",
				title: Y("cleanup:performerDelete.planFailed"),
				children: p
			}) : null,
			l ? /* @__PURE__ */ (0, $.jsx)(D, {
				tone: b.length ? "warning" : "info",
				title: Y("cleanup:performerDelete.purged", { count: l.purged }),
				extra: b.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					className: "flex flex-col gap-2 text-body-2-regular wrap-anywhere",
					children: b.slice(0, 5).map((e, t) => /* @__PURE__ */ (0, $.jsx)("p", { children: Y("shell:format.withNote", {
						text: e.path,
						note: e.reason
					}) }, t))
				}) : null,
				children: b.length ? Y("cleanup:performerDelete.partialFailure", {
					count: l.blocked.length,
					quarantined: l.cleanup_pending.length,
					cacheFiles: l.cache_blocked.length
				}) : Y("cleanup:performerDelete.done")
			}) : null
		]
	});
}
// src/react/data-cleanup/resource-sync-card.tsx
var yn = J("git-compare"), bn = J("rotate-cw"), xn = Y("cleanup:shared.reconnecting"), Sn = Y("cleanup:resourceSync.cleanUpDead"), Cn = "inline-grid w-full grid-flow-col auto-cols-fr gap-4 max-plain-stat-pair:grid-flow-row max-plain-stat-pair:grid-cols-2 max-plain-stat-single:grid-cols-1", wn = (e) => Number(e || 0).toLocaleString();
function Tn({ scan: e, partial: t = !1 }) {
	let n = e.cache ?? {
		files: 0,
		bytes: 0
	};
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("div", {
		className: Cn,
		children: (e.sources ?? []).map((e) => /* @__PURE__ */ (0, $.jsxs)("article", {
			className: K(),
			children: [/* @__PURE__ */ (0, $.jsx)(M, {
				label: fe[e.location] || Y("cleanup:resourceSync.storageFallback"),
				mark: /* @__PURE__ */ (0, $.jsx)(ve, { mark: E[e.location] ?? "database" }),
				aside: /* @__PURE__ */ (0, $.jsx)(Ht, {
					online: e.online,
					children: e.online ? Y("cleanup:resourceSync.online") : Y("cleanup:resourceSync.offline")
				}),
				figure: e.online ? Y("cleanup:resourceSync.missingCount", { count: Number(e.missing || 0) }) : "—",
				meta: e.online ? Tt(e) : Y("cleanup:resourceSync.skipped", { summary: Tt(e) }),
				wrapMeta: !0
			}), e.online && e.unreadable > 0 ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, $.jsxs)(R, {
					tone: "warning",
					children: [
						wn(e.unreadable),
						" ",
						Y("cleanup:resourceSync.unreadableDirs")
					]
				})
			}) : null]
		}, e.location))
	}), !t && /* @__PURE__ */ (0, $.jsxs)("div", {
		className: Cn,
		children: [
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: K(),
				children: /* @__PURE__ */ (0, $.jsx)(M, {
					label: Y("cleanup:resourceSync.toPurge"),
					figure: Y("cleanup:resourceSync.purgeCount", { count: Number(ht(e) || 0) }),
					meta: Y("cleanup:resourceSync.purgeHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: K(),
				children: /* @__PURE__ */ (0, $.jsx)(M, {
					label: Y("cleanup:resourceSync.toVanish"),
					figure: Y("cleanup:resourceSync.vanishCount", { count: Number(e.vanish || 0) }),
					meta: Y("cleanup:resourceSync.vanishHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: K(),
				children: /* @__PURE__ */ (0, $.jsx)(M, {
					label: Y("cleanup:resourceSync.emptyDirs"),
					figure: Y("cleanup:resourceSync.emptyDirCount", { count: Number(e.empty || 0) }),
					meta: Y("cleanup:resourceSync.emptyDirsHint")
				})
			}),
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: K(),
				children: /* @__PURE__ */ (0, $.jsx)(M, {
					label: Y("cleanup:resourceSync.cache"),
					figure: Y("cleanup:resourceSync.cacheCount", { count: Number(n.files || 0) }),
					meta: n.files ? W(n.bytes) : ""
				})
			})
		]
	})] });
}
function En({ toast: e }) {
	let n = X({
		queryKey: ce,
		queryFn: ({ signal: e }) => $e(e),
		start: At,
		onFinish: (t) => {
			if (q.invalidateQueries({
				queryKey: ye,
				exact: !0
			}), q.invalidateQueries({
				queryKey: le,
				exact: !0
			}), t.status !== "complete") return;
			let { done: n, left: r } = Ce(t);
			r ? e(Y("cleanup:resourceSync.applyLeftovers", {
				done: wn(n),
				count: Number(r || 0)
			}), { warning: !0 }) : e(Y("cleanup:resourceSync.cleaned"));
		}
	}), r = X({
		queryKey: le,
		queryFn: ({ signal: e }) => et(e),
		start: jt,
		onStarted: () => n.dismiss()
	}), i = r.job, a = r.running || r.start.isPending, o = n.running || n.start.isPending, s = !!r.job && !!n.job, c = i?.status === "complete" || i?.status === "failed", l = Y(a ? "cleanup:resourceSync.scanning" : c ? "cleanup:resourceSync.scanAgain" : "cleanup:resourceSync.checkFiles"), f = (e) => void Me({
		holdToConfirm: !0,
		title: Sn,
		body: Se(e),
		confirmLabel: Sn,
		danger: !0,
		onConfirm: () => n.start.mutateAsync(e.scan_id || "")
	}), p = n.outcome, m = (e) => {
		let t = Ce(e).left > 0;
		return /* @__PURE__ */ (0, $.jsx)(D, {
			tone: t ? "warning" : "success",
			title: Y(t ? "cleanup:shared.partiallyCompleted" : "cleanup:resourceSync.cleanupResult"),
			children: Te(e, W)
		});
	}, h = null, g = null;
	if (p?.status === "failed") g = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:resourceSync.cleanupIncomplete"),
		children: G(p, "error") || Y("cleanup:shared.checkTaskLogFiles")
	});
	else if (p) g = m(p);
	else if (n.running) h = /* @__PURE__ */ (0, $.jsx)(z, {
		embedded: !0,
		kind: V("resource-apply"),
		label: G(n.job) || Y("cleanup:resourceSync.applying")
	});
	else if (r.start.isError) g = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:resourceSync.scanFailed"),
		children: U(r.start.error)
	});
	else if (r.query.isError && i) g = /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "neutral",
		title: Y("cleanup:shared.taskStatus"),
		children: xn
	});
	else if (i?.status === "running") {
		let e = Ct(i);
		h = /* @__PURE__ */ (0, $.jsx)(z, {
			embedded: !0,
			kind: V("resource-scan"),
			label: e,
			value: i.completed_sources,
			total: i.total_sources
		}), i.sources?.length && (g = /* @__PURE__ */ (0, $.jsx)(Tn, {
			scan: i,
			partial: !0
		}));
	} else if (i?.status === "failed") g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [i.sources?.length ? /* @__PURE__ */ (0, $.jsx)(Tn, {
		scan: i,
		partial: !0
	}) : null, /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:resourceSync.scanFailed"),
		children: G(i, "error") || Y("cleanup:resourceSync.backgroundScanFailed")
	})] });
	else if (i?.status === "complete" && i.applied) g = n.job?.status === "complete" ? m(n.job) : /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "neutral",
		title: Y("cleanup:resourceSync.cleanupResult"),
		children: Y("cleanup:resourceSync.alreadyCleaned")
	});
	else if (i?.status === "complete") {
		let e = it(i);
		g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(Tn, { scan: i }), e ? /* @__PURE__ */ (0, $.jsx)(D, {
			tone: "neutral",
			title: Y("cleanup:resourceSync.toClean"),
			action: /* @__PURE__ */ (0, $.jsx)(t, {
				variant: "danger",
				disabled: !s,
				...H(o),
				onClick: () => {
					s && f(i);
				},
				children: o ? Y("cleanup:resourceSync.applyingButton") : Sn
			}),
			children: we(i)
		}) : /* @__PURE__ */ (0, $.jsx)("p", {
			className: "mr-auto text-body-regular text-notification-success-foreground",
			children: Y("cleanup:resourceSync.nothingToClean")
		})] });
	}
	return n.start.isError && !p && (g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [g, /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:resourceSync.cleanupFailed"),
		children: U(n.start.error)
	})] })), /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "resource-sync",
		"aria-labelledby": "resource-sync-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(u, {
			layout: "split",
			labelledBy: "resource-sync-title",
			footer: /* @__PURE__ */ (0, $.jsx)(t, {
				"data-resource-scan": !0,
				leadingIcon: c && !a ? bn : yn,
				disabled: !s,
				...H(a),
				onClick: () => {
					s && !a && r.start.mutate();
				},
				children: l
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(d, {
					id: "resource-sync-title",
					gap: "small",
					children: Y("cleanup:tools.resourceSync")
				}),
				r.query.isPending || n.query.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
					role: "status",
					"aria-label": Y("cleanup:resourceSync.statusLoading"),
					"data-skeleton": "",
					className: "skeleton-sheen h-6 rounded-md"
				}) : null,
				!r.job && r.query.isError ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					children: Y("cleanup:resourceSync.scanStatusUnavailable")
				}) : null,
				!n.job && n.query.isError ? /* @__PURE__ */ (0, $.jsx)(D, {
					tone: "error",
					children: Y("cleanup:resourceSync.applyStatusUnavailable")
				}) : null,
				/* @__PURE__ */ (0, $.jsx)("p", {
					className: "max-w-190 text-body-2-regular leading-5 text-text-secondary",
					children: I
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
function Dn({ toast: e }) {
	let t = Z({
		queryKey: T,
		queryFn: ({ signal: e }) => qe(e)
	});
	return t.isError ? /* @__PURE__ */ (0, $.jsx)(D, {
		tone: "error",
		title: Y("cleanup:resourceSync.storageLoadFailed"),
		children: U(t.error)
	}) : t.isPending ? /* @__PURE__ */ (0, $.jsx)("p", {
		role: "status",
		children: Y("cleanup:resourceSync.storageLoading")
	}) : at(t.data) ? /* @__PURE__ */ (0, $.jsx)(En, { toast: e }) : /* @__PURE__ */ (0, $.jsxs)(u, {
		layout: "stack",
		label: Y("cleanup:tools.resourceSync"),
		children: [
			/* @__PURE__ */ (0, $.jsx)(d, { children: Y("cleanup:tools.resourceSync") }),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-regular text-text-secondary",
				children: Y("cleanup:resourceSync.noDirectories")
			}),
			/* @__PURE__ */ (0, $.jsx)("a", {
				href: "/settings/library",
				className: "text-body-medium text-accent-600 underline",
				children: Y("cleanup:resourceSync.setUpLibrary")
			})
		]
	});
}
function On({ tool: e, toast: t, failure: n }) {
	let r = (e) => t(e), i;
	switch (e) {
		case "organize":
			i = /* @__PURE__ */ (0, $.jsx)(ln, {
				toast: r,
				failure: n
			});
			break;
		case "resource-sync":
			i = /* @__PURE__ */ (0, $.jsx)(Dn, { toast: t });
			break;
		case "orphan-records":
			i = /* @__PURE__ */ (0, $.jsx)(hn, { toast: r });
			break;
		case "media-repair":
			i = /* @__PURE__ */ (0, $.jsx)(qt, { toast: r });
			break;
		case "links":
			i = /* @__PURE__ */ (0, $.jsx)(rn, {});
			break;
		case "batch-delete": i = /* @__PURE__ */ (0, $.jsx)(vn, { toast: r });
	}
	return /* @__PURE__ */ (0, $.jsx)(Rt, { children: i });
}
// src/react/data-cleanup/data-cleanup-page.tsx
function kn(e, t) {
	return e.data === void 0 ? e.isError ? {
		figure: Y("cleanup:overview.loadFailed"),
		state: "error"
	} : {
		figure: Y("cleanup:overview.loading"),
		state: "loading"
	} : t(e.data);
}
function An({ section: e, label: t, icon: n, value: r, open: i }) {
	return /* @__PURE__ */ (0, $.jsx)("button", {
		type: "button",
		className: K({ interactive: !0 }),
		"data-cleanup-go": e,
		"data-entry-state": r.state,
		"aria-busy": r.state === "loading" || void 0,
		onClick: () => i(e),
		children: /* @__PURE__ */ (0, $.jsx)(M, {
			label: t,
			icon: n,
			figure: r.figure,
			meta: r.meta
		})
	});
}
function jn({ tool: e, navigate: t }) {
	let n = J(e.icon);
	return /* @__PURE__ */ (0, $.jsx)(Wt, {
		label: e.title,
		icon: n,
		summary: e.description,
		attributes: { "data-cleanup-tool": e.key },
		onOpen: () => t(e.path + location.search)
	});
}
var Mn = J("square-check-big"), Nn = J("sparkles"), Pn = J("file-stack"), Fn = J("file-archive"), In = J("trash"), Ln = () => {
	for (let e of [
		L,
		se,
		l,
		g
	]) q.invalidateQueries({
		queryKey: e,
		exact: !0
	});
};
function Rn({ toast: e, open: t, navigate: n }) {
	let o = Z({
		queryKey: L,
		queryFn: ({ signal: e }) => tt(e)
	}), s = Z({
		queryKey: se,
		queryFn: ({ signal: e }) => Ze(e)
	}), c = Z({
		queryKey: l,
		queryFn: ({ signal: e }) => Ve(e)
	}), u = Z({
		queryKey: g,
		queryFn: ({ signal: e }) => He(e)
	}), d = Z({
		queryKey: ye,
		queryFn: ({ signal: e }) => nt(e)
	});
	return (0, Q.useEffect)(() => {
		let e = i[location.hash];
		e && ut.replace(e + location.search);
	}, []), /* @__PURE__ */ (0, $.jsxs)(Rt, { children: [
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-pending",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(pe, {
				id: "cleanup-pending",
				children: Y("cleanup:overview.needsAttention")
			}), /* @__PURE__ */ (0, $.jsxs)("div", {
				className: ae,
				children: [
					/* @__PURE__ */ (0, $.jsx)(An, {
						section: "review",
						label: Y("cleanup:overview.review"),
						icon: Mn,
						open: t,
						value: kn(o, xt)
					}),
					/* @__PURE__ */ (0, $.jsx)(An, {
						section: "duplicates",
						label: Y("cleanup:overview.duplicates"),
						icon: Pn,
						open: t,
						value: kn(c, (e) => Number(e.total || 0) ? {
							figure: Y("cleanup:overview.duplicateGroups", {
								count: Number(e.total),
								files: Number(e.files || 0).toLocaleString()
							}),
							meta: Y("cleanup:overview.reclaimable", { size: W(e.reclaimable || 0) })
						} : { figure: Y("cleanup:overview.noDuplicates") })
					}),
					/* @__PURE__ */ (0, $.jsx)(An, {
						section: "ads",
						label: Y("cleanup:overview.junkFiles"),
						icon: Fn,
						open: t,
						value: kn(u, (e) => ({
							figure: Y("cleanup:overview.junkUndecided", { count: Number(e.pending_total || 0) }),
							meta: ot(e)
						}))
					}),
					/* @__PURE__ */ (0, $.jsx)(An, {
						section: "quality",
						label: Y("cleanup:overview.hdUpgrades"),
						icon: Nn,
						open: t,
						value: kn(s, (e) => ({ figure: Y("cleanup:overview.upgradesPending", { count: Number(e.total || 0) }) }))
					}),
					/* @__PURE__ */ (0, $.jsx)(An, {
						section: "trash",
						label: Y("cleanup:overview.trash"),
						icon: In,
						open: t,
						value: kn(d, (e) => ({
							figure: Y("cleanup:overview.trashCount", { count: Number(e.total || 0) }),
							meta: e.total ? Y("cleanup:overview.trashSize", { size: W(e.bytes || 0) }) : Y("cleanup:overview.trashEmptyHint")
						}))
					})
				]
			})]
		}),
		/* @__PURE__ */ (0, $.jsx)("div", {
			id: "libraryProcessing",
			className: "scroll-mt-20",
			children: /* @__PURE__ */ (0, $.jsx)(te, {
				toast: (t) => e(t),
				onComplete: Ln
			})
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-maintenance",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(pe, {
				id: "cleanup-maintenance",
				children: Y("cleanup:overview.maintenanceSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: r,
				children: a.filter((e) => e.key !== "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(jn, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-deletion",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(pe, {
				id: "cleanup-deletion",
				children: Y("cleanup:overview.deletionSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: r,
				children: a.filter((e) => e.key === "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(jn, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		})
	] });
}
export { Rn as DataCleanupPage, On as DataCleanupToolPage };

//# debugId=136d9afd-c52e-4498-b5c7-31eb64ee6831