(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "cf858ebd-e797-4996-98a4-cf194e1faa49", e._sentryDebugIdIdentifier = "sentry-dbid-cf858ebd-e797-4996-98a4-cf194e1faa49");
	} catch {}
})();
import { BATCH_DELETE_TEXT as e, BC as t, Button as n, CLEANUP_ENTRY as r, CLEANUP_ENTRY_GRID as i, CLEANUP_HASH_REDIRECTS as a, CLEANUP_TOOLS as o, Chip as s, ColumnFilterAvatar as c, DIRECTORY_TEMPLATE_ERROR as l, DUPLICATES_KEY as u, Fieldset as d, FieldsetTitle as f, IDLE_REPAIR as p, IconButton as m, IndexSearch as h, Input as g, JUNK_KEY as _, LEGACY_AVATAR_IMG as v, LINKS_KEY as ee, LINK_CHECK_KEY as y, LINK_KINDS as b, LINK_PRUNE_KEY as te, LOC as x, LibraryLabel as S, LibraryProcessingCard as C, M6 as w, MEDIA_REPAIR_KEY as T, MEDIA_REPAIR_URL as E, MEDIA_SOURCES_KEY as D, MEDIA_SOURCE_ICONS as ne, Note as O, ORGANIZE_KEY as re, ORGANIZE_PARAMETER_HINT as k, ORGANIZE_SCOPE_HINT as ie, ORGANIZE_TEXT as ae, ORPHAN_RECORDS_KEY as A, ORPHAN_RECORDS_TEXT as oe, PERFORMER_DELETE_KEY as j, PLAIN_STAT_STRIP as se, PlainStat as M, Progress as N, QUALITY_GOALS_KEY as P, RECORD_LABELS as F, REPAIR_CARD_TEXT as ce, REPAIR_LIBRARIES_KEY as le, RESOURCE_APPLY_KEY as I, RESOURCE_SCAN_KEY as ue, RESOURCE_SYNC_TEXT as de, RESULT_PANEL as fe, RESULT_SECTION as pe, REVIEW_COUNTS_KEY as me, SOURCE_LABELS as he, SectionHeading as ge, Select as _e, SelectItem as ve, SiteMark as L, SourceLabel as ye, SourceMark as be, StatusLabel as R, TRASH_KEY as z, TaskProgress as B, Wt as xe, __toESM as Se, activityKind as V, apiSend as Ce, applyConfirmText as we, applyLeftovers as Te, applyPlanText as Ee, applyText as De, attachOrphan as Oe, baseName as ke, busyProps as H, candidateText as Ae, checkLine as je, cleanupToolSkeletonHtml as Me, codedText as Ne, confirmModal as Pe, cx as Fe, dZ as Ie, deletePerformerVideos as Le, entityDisplayName as Re, entityFaceImg as ze, entityPath as Be, errorMessage as U, esc as Ve, fetchDeletePerformers as He, fetchDeletePlan as Ue, fetchDuplicates as We, fetchJunkSummary as Ge, fetchLinkCheck as Ke, fetchLinkPrune as qe, fetchLinkStats as Je, fetchMediaRepair as Ye, fetchMediaSources as Xe, fetchOrganize as Ze, fetchOrganizeExample as Qe, fetchOrphanRecords as $e, fetchQualityGoals as et, fetchRepairLibraries as tt, fetchResourceApply as nt, fetchResourceScan as rt, fetchReviewCounts as it, fetchTrashSummary as at, firstGrapheme as ot, fmtSize as W, hasChanges as st, hasResourceRoots as ct, jobText as G, junkBreakdown as lt, ks as ut, linkLabel as dt, missingToolText as ft, organizeOutcome as pt, peachHistory$1 as mt, pickOrganizeFolder as ht, plainStatClass as K, planSummary as gt, previewOrganize as _t, pruneText as vt, purgeCount as yt, purgeOrphan as bt, queryClient as q, recordsText as xt, rememberTemplates as St, require_jsx_runtime as Ct, require_react as wt, reviewSummary as Tt, runBulkAction as Et, scanLine as Dt, serverLabel as Ot, sourceMeta as kt, spriteGlyph as J, stageText as At, startLinkCheck as jt, startLinkPrune as Mt, startOrganize as Nt, startResourceApply as Pt, startResourceScan as Ft, statusLine as It, t as Y, useAction as Lt, useBackgroundJob as X, useEntityNames as Rt, useMutation as zt, useOrderedLibraries as Bt, useQuery as Z, withOrganizeJob as Vt } from "./peach-app.js";
import { Page as Ht } from "./peach-app.page-QAncjzM1.js";
import { ErrorExcerpt as Ut } from "./peach-app.error-excerpt-Ugft6I5o.js";
import { DataTable as Wt } from "./peach-app.data-table-CYTfz3fV.js";
import { FolderSearchIcon as Gt } from "./peach-app.folder-rows-C3hhF_90.js";
import { ConnectionStatus as Kt } from "./peach-app.connection-status-BrXhLGSm.js";
// src/react/data-cleanup/cleanup-entry-card.tsx
var Q = /* @__PURE__ */ Se(wt(), 1), $ = Ct(), qt = J("chevron-right");
function Jt({ label: e, icon: t, summary: n, detail: i, state: a, attributes: o, onOpen: s }) {
	return /* @__PURE__ */ (0, $.jsxs)("button", {
		type: "button",
		...o,
		className: r.face,
		onClick: s,
		"data-entry-state": a,
		"aria-busy": a === "loading" || void 0,
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", {
				"aria-hidden": !0,
				className: r.icon,
				children: /* @__PURE__ */ (0, $.jsx)(t, {
					"aria-hidden": !0,
					className: "size-5"
				})
			}),
			/* @__PURE__ */ (0, $.jsxs)("span", {
				className: r.body,
				children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: r.title,
						children: e
					}),
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: Fe(r.summary, a === "error" && "text-text-error-primary"),
						children: n
					}),
					i ? /* @__PURE__ */ (0, $.jsx)("span", {
						className: r.detail,
						children: i
					}) : null
				]
			}),
			/* @__PURE__ */ (0, $.jsx)(qt, {
				"aria-hidden": !0,
				className: r.arrow
			})
		]
	});
}
// src/react/media-repair/media-repair-card.tsx
var Yt = (e) => ne[e] || e, Xt = (e) => q.setQueryData(T, e);
function Zt({ toast: e = () => {} }) {
	let t = X({
		queryKey: T,
		queryFn: ({ signal: e }) => Ye(e),
		start: (e) => Ce(E, {
			library: e,
			restart: !0
		}),
		onFinish: (t) => {
			t.status === "complete" && !t.failed && !t.missing_tool && e(t.repaired ? Y("cleanup:mediaRepair.repaired", { count: t.repaired }) : Y("cleanup:mediaRepair.nothingToRepair"));
		}
	}), r = Z({
		queryKey: le,
		queryFn: ({ signal: e }) => tt(e)
	}), [i, a] = (0, Q.useState)(""), o = Lt(), s = t.job ?? p, c = Bt(r.data ?? [], (e) => e.id), l = s.status === "running", u = c.find((e) => e.id === (l ? s.library : i)) ?? c.find((e) => e.id === s.library) ?? c[0], m = () => {
		u && Pe({
			title: Y("cleanup:mediaRepair.confirmTitle", { name: u.name }),
			body: [Y("cleanup:mediaRepair.body"), ...u.metered ? [Y("cleanup:mediaRepair.meteredWarning")] : []].join(Y("cleanup:shared.sentenceGap")),
			confirmLabel: Y("cleanup:mediaRepair.confirm"),
			onConfirm: async () => {
				await t.start.mutateAsync(u.id);
			}
		});
	}, h = () => void o.run("stop", (e) => Ce(E, { stop: !0 }, "POST", e), Xt), g = t.outcome, _ = It(l ? s : g ?? p), v = o.error || G(g, "error") || (t.query.error ? Y("cleanup:mediaRepair.statusUnavailable") : "");
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsx)(d, {
			layout: "split",
			label: Y("cleanup:tools.mediaRepair"),
			footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(_e, {
				"aria-label": Y("cleanup:mediaRepair.library"),
				prefix: Y("cleanup:mediaRepair.library"),
				className: "w-48",
				selectedKey: u?.id ?? null,
				isDisabled: l || !c.length,
				"aria-busy": r.isPending || void 0,
				onSelectionChange: (e) => {
					e !== null && a(String(e));
				},
				children: c.map((e) => /* @__PURE__ */ (0, $.jsx)(ve, {
					id: e.id,
					textValue: e.name,
					children: /* @__PURE__ */ (0, $.jsx)(S, { library: {
						id: e.id,
						name: e.name,
						icon: Yt(e.icon)
					} })
				}, e.id))
			}), l ? /* @__PURE__ */ (0, $.jsx)(n, {
				onClick: h,
				...H(o.busy === "stop"),
				children: Y("cleanup:shared.stop")
			}) : /* @__PURE__ */ (0, $.jsx)(n, {
				onClick: m,
				disabled: !u,
				children: Y("cleanup:mediaRepair.start")
			})] }),
			children: /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, $.jsx)(f, { children: Y("cleanup:tools.mediaRepair") }),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: ce
					}),
					l && s.total ? /* @__PURE__ */ (0, $.jsx)(N, {
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
				g?.status === "complete" && g.missing_tool ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "warning",
					title: Y("cleanup:mediaRepair.missingTool"),
					action: /* @__PURE__ */ (0, $.jsx)(n, {
						variant: "ghost",
						size: "small",
						onClick: t.dismiss,
						children: Y("cleanup:mediaRepair.dismiss")
					}),
					children: ft(g)
				}) : null,
				r.isError ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					children: Y("cleanup:mediaRepair.librariesUnavailable")
				}) : null,
				v ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					children: v
				}) : null
			]
		})]
	});
}
// src/react/data-cleanup/link-check-icon.tsx
function Qt({ className: e }) {
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
var $t = J("rotate-cw"), en = Y("cleanup:links.goneHint"), tn = Y("cleanup:links.unclearHint"), nn = Y("cleanup:links.pruneHint"), rn = Y("cleanup:shared.reconnecting"), an = (e) => Number(e || 0).toLocaleString();
function on({ label: e, value: t, note: n }) {
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
function sn({ title: e, items: n, hint: r, picked: i, onPick: a, actions: o, controls: s, retry: l, retrying: u, footer: d, confirmed: f = !1 }) {
	if (!n.length) return null;
	let p = [
		{
			id: "entity",
			label: Y("cleanup:links.columnEntry"),
			width: 180,
			min: 128,
			value: (e) => e.entity,
			filter: {
				values: (e) => e.entity,
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(c, {
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
				href: e.entity_id && e.entity_kind ? Be(e.entity_kind, e.entity, e.entity_id) : void 0,
				"data-link-identity": "",
				children: [/* @__PURE__ */ (0, $.jsx)("span", {
					"data-link-avatar": "",
					className: `relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-primary ${v}`,
					"aria-hidden": !0,
					dangerouslySetInnerHTML: { __html: `<span>${Ve(ot(e.entity))}</span>` + ze({
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
			value: (e) => b[e.link_kind] || e.link_kind,
			filter: {
				values: (e) => e.link_kind,
				option: (e) => ({ label: b[e] || e })
			},
			render: (e) => b[e.link_kind] || e.link_kind
		},
		{
			id: "label",
			label: Y("cleanup:links.columnName"),
			min: 128,
			value: (e) => dt(e.label),
			filter: {
				values: (e) => dt(e.label) || new URL(e.url).hostname,
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(L, { linkId: t.id }) })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "flex min-w-24 items-center gap-2",
				"data-link-name": "",
				children: /* @__PURE__ */ (0, $.jsx)("span", {
					className: "min-w-0 wrap-anywhere",
					children: dt(e.label) || new URL(e.url).hostname
				})
			})
		},
		{
			id: "note",
			label: Y("cleanup:links.columnResult"),
			width: 320,
			min: 192,
			value: (e) => e.note,
			filter: { values: (e) => Ot(e.note_code ?? "", e.note, e.note_params) },
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "min-w-0 w-full",
				"data-link-result": f ? "gone" : "unclear",
				children: [/^(?:HTTP\s+)?[1-5]\d{2}$/.test(e.note.trim()) ? /* @__PURE__ */ (0, $.jsx)(R, {
					tone: f || /^(?:HTTP\s+)?5\d{2}$/.test(e.note.trim()) ? "error" : "warning",
					"data-link-code": "",
					children: e.note.trim()
				}) : /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex flex-col items-start gap-1",
					children: [/* @__PURE__ */ (0, $.jsx)(R, {
						tone: f ? "error" : "warning",
						children: Y(f ? "cleanup:links.dead" : "cleanup:links.inconclusive")
					}), /* @__PURE__ */ (0, $.jsx)(Ut, {
						text: Ot(e.note_code ?? "", e.note, e.note_params),
						className: "tabular-nums text-text-secondary"
					})]
				}), !f && e.temporary && e.attempts ? /* @__PURE__ */ (0, $.jsx)("span", {
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
				option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, $.jsx)(L, { linkId: t.id }) })
			},
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
					/* @__PURE__ */ (0, $.jsx)(xe, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})
				]
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("div", {
		className: pe,
		"data-link-results": f ? "gone" : "unclear",
		children: /* @__PURE__ */ (0, $.jsx)(Wt, {
			label: e,
			items: n,
			columns: p,
			rowId: (e) => String(e.id),
			description: r,
			unit: Y("cleanup:links.unit"),
			panel: !1,
			footerActions: d,
			rowLabel: (e) => Y("cleanup:links.rowLabel", {
				entity: e.entity,
				link: dt(e.label) || e.url
			}),
			selected: i.map(String),
			onSelected: (e) => a(e.map(Number)),
			contextOperations: (e) => [{
				id: "copy",
				label: Y("cleanup:links.copyLink"),
				icon: t,
				run: () => navigator.clipboard.writeText(e.url)
			}, ...l ? [{
				id: "retry",
				label: Y("manage:shared.retryNow"),
				icon: Ie,
				disabled: u,
				run: () => l(e.id)
			}] : []],
			actions: (e) => o?.(e) ?? [],
			controls: () => s
		})
	});
}
function cn() {
	let e = Z({
		queryKey: ee,
		queryFn: ({ signal: e }) => Je(e)
	}), [t, r] = (0, Q.useState)([]), [i, a] = (0, Q.useState)([]), o = X({
		queryKey: te,
		queryFn: ({ signal: e }) => qe(e),
		start: Mt,
		onFinish: () => {
			q.invalidateQueries({
				queryKey: ee,
				exact: !0
			}), q.invalidateQueries({
				queryKey: y,
				exact: !0
			});
		}
	}), c = X({
		queryKey: y,
		queryFn: ({ signal: e }) => Ke(e),
		start: jt,
		onStarted: () => {
			o.dismiss(), r([]), a([]);
		}
	}), l = c.job, u = l?.check_id ?? "";
	(0, Q.useEffect)(() => {
		r([]), a([]);
	}, [u]);
	let p = c.running || c.start.isPending, m = o.running || o.start.isPending, h = !!c.job && !!o.job, g = l?.status === "complete", _ = l?.gone ?? [], v = l?.unclear ?? [], x = g ? v : [], S = x.filter((e) => t.includes(e.id)).map((e) => e.id), C = e.data, T = (C?.top_hosts ?? []).slice(0, 3), E = (e) => {
		!h || p || e && !e.length || c.start.mutate(e ? {
			retry: e,
			checkId: u
		} : {});
	}, D = (e, t = !1) => ({
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
			await o.start.mutateAsync({
				checkId: u,
				ids: t ? void 0 : e.map((e) => e.id)
			});
		},
		receipt: () => ""
	}), ne = { receipt: () => {} }, re = () => {
		h && !m && _.length && Et(D(Y("cleanup:links.deleteDead"), !0), _, ne);
	}, k = o.outcome, ie = c.start.error ?? o.start.error, ae = null, A = null;
	if (k?.status === "failed") A = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:links.pruneIncomplete"),
		children: G(k, "error") || Y("cleanup:links.checkTaskLog")
	});
	else if (k && !_.length && !v.length) A = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "success",
		title: Y("cleanup:links.pruneDone"),
		children: vt(k)
	});
	else if (ie) A = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:links.checkFailed"),
		children: U(ie)
	});
	else if (c.query.isError && l) A = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "neutral",
		title: Y("cleanup:shared.taskStatus"),
		children: rn
	});
	else if (l?.status === "failed") A = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:links.checkFailed"),
		children: G(l, "error") || Y("cleanup:links.checkFailed")
	});
	else if (l && l.status !== "idle") {
		ae = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [l.status === "running" ? /* @__PURE__ */ (0, $.jsx)(B, {
			embedded: !0,
			kind: V("link-check"),
			label: je(l),
			value: Math.min(l.checked || 0, l.total || 0),
			total: l.total
		}) : null, m ? /* @__PURE__ */ (0, $.jsx)(B, {
			embedded: !0,
			kind: V("link-prune"),
			label: G(o.job) || Y("cleanup:links.pruning"),
			value: Math.min(o.job?.checked || 0, o.job?.total || 0),
			total: o.job?.total
		}) : null] });
		let e = Y("cleanup:links.retrySelected", { count: S.length });
		A = g || _.length || v.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
			className: fe,
			children: [
				k?.status === "complete" ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "success",
					title: Y("cleanup:links.pruneDone"),
					children: vt(k)
				}) : null,
				/* @__PURE__ */ (0, $.jsx)(sn, {
					title: Y("cleanup:links.dead"),
					items: _,
					hint: en,
					picked: i,
					onPick: a,
					confirmed: !0,
					footer: g && _.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("p", {
						className: "mr-auto min-w-0 text-caption-1-regular text-text-secondary",
						children: nn
					}), /* @__PURE__ */ (0, $.jsx)(n, {
						variant: "danger",
						...H(m),
						onClick: re,
						children: Y("cleanup:links.deleteDeadCount", { count: _.length })
					})] }) : null,
					actions: (e) => [{
						action: D(Y("cleanup:links.deleteSelected", { count: e.length })),
						items: e,
						host: ne,
						disabled: !g || m,
						rowAction: {
							label: Y("cleanup:links.deleteDead"),
							icon: w
						}
					}]
				}),
				/* @__PURE__ */ (0, $.jsx)(sn, {
					title: Y("cleanup:links.unreached"),
					items: v,
					hint: tn,
					picked: t,
					onPick: r,
					retry: g ? (e) => E([e]) : void 0,
					retrying: p,
					footer: x.length ? /* @__PURE__ */ (0, $.jsx)(n, {
						variant: "primary",
						leadingIcon: $t,
						...H(p),
						onClick: () => E(x.map((e) => e.id)),
						children: Y("cleanup:links.retryAll", { count: x.length })
					}) : null,
					controls: x.length ? /* @__PURE__ */ (0, $.jsx)(n, {
						variant: "secondary",
						leadingIcon: $t,
						disabled: !S.length,
						...H(p),
						onClick: () => E(S),
						children: e
					}) : null
				}),
				g && !_.length && !v.length ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: `${pe} text-body-regular text-notification-success-foreground`,
					children: Y("cleanup:links.allReachable")
				}) : null
			]
		}) : null;
	}
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "link-manager",
		"aria-labelledby": "link-manager-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(d, {
			layout: "stack",
			labelledBy: "link-manager-title",
			footer: /* @__PURE__ */ (0, $.jsx)(n, {
				"data-link-check": "",
				leadingIcon: Qt,
				disabled: !h,
				...H(p),
				onClick: () => E(),
				children: Y(p ? "cleanup:links.checking" : g ? "cleanup:links.checkAgain" : "cleanup:links.checkLinks")
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(f, {
					id: "link-manager-title",
					gap: "small",
					children: Y("cleanup:tools.links")
				}),
				e.isError ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					title: Y("cleanup:links.statsLoadFailed"),
					children: U(e.error)
				}) : C ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("div", {
					className: "link-stat-grid mt-4 gap-x-8 gap-y-3",
					children: [/* @__PURE__ */ (0, $.jsx)(on, {
						label: Y("cleanup:links.totalLinks"),
						value: an(C.total),
						note: Y("cleanup:links.entitySpread", { count: Number(C.entities || 0) })
					}), Object.entries(C.by_kind ?? {}).map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(on, {
						label: b[e] || e,
						value: an(t)
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
									/* @__PURE__ */ (0, $.jsx)(L, { linkId: C.top_host_link_ids?.[e] }),
									/* @__PURE__ */ (0, $.jsx)("span", {
										className: "min-w-0 wrap-anywhere",
										children: e
									}),
									/* @__PURE__ */ (0, $.jsx)(xe, {
										"aria-hidden": !0,
										className: "size-(--icon-inline) shrink-0"
									})
								]
							}), /* @__PURE__ */ (0, $.jsx)(s, {
								variant: "caption",
								color: "neutral",
								children: /* @__PURE__ */ (0, $.jsx)("span", {
									className: "tabular-nums",
									children: an(t)
								})
							})]
						}, e))
					})]
				}) : null] }) : null,
				/* @__PURE__ */ (0, $.jsx)("div", {
					"aria-live": "polite",
					className: "mt-4 flex flex-col gap-3 empty:hidden",
					children: ae
				})
			]
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			"aria-live": "polite",
			className: "empty:hidden",
			children: A
		})]
	});
}
// src/react/data-cleanup/organize-card.tsx
var ln = (e, t) => t ? Y("cleanup:organize.applyBodyPath", {
	name: e,
	path: t
}) : Y("cleanup:organize.applyBodyAll", { name: e }), un = Y("cleanup:organize.rollbackBody"), dn = 8;
function fn({ plan: e }) {
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("ol", {
		className: "mt-2 flex min-w-0 flex-col gap-1",
		children: e.rows.slice(0, dn).map((e) => /* @__PURE__ */ (0, $.jsxs)("li", {
			className: "flex min-w-0 items-center gap-2 text-caption-1-regular text-text-secondary",
			children: [
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.current_path,
					className: "min-w-0 truncate",
					children: ke(e.current_path)
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"aria-hidden": !0,
					children: "→"
				}),
				/* @__PURE__ */ (0, $.jsx)("span", {
					"data-middle-truncate": !0,
					title: e.target_path,
					className: "min-w-0 truncate text-text-primary",
					children: ke(e.target_path)
				})
			]
		}, e.current_path))
	}), e.truncated || e.rows.length > dn ? /* @__PURE__ */ (0, $.jsx)("p", {
		className: "text-caption-1-regular text-text-secondary",
		children: Y("cleanup:organize.planTruncated")
	}) : null] });
}
function pn({ toast: e, failure: t }) {
	let r = Z({
		queryKey: re,
		queryFn: ({ signal: e }) => Ze(e)
	}), i = r.data, a = i?.locations ?? [], [o, s] = (0, Q.useState)(""), c = a.some((e) => e.location === o) ? o : a[0]?.location ?? "", u = i?.templates?.[c], [p, h] = (0, Q.useState)(null), _ = p?.location === c ? p : {
		location: c,
		file: u?.file ?? "",
		dir: u?.dir ?? ""
	}, v = (e) => {
		h({
			..._,
			...e
		}), N.reset();
	}, [ee, y] = (0, Q.useState)({
		location: "",
		path: ""
	}), b = ee.location === c ? ee.path : "", te = (0, Q.useRef)({
		location: c,
		path: b
	});
	te.current = {
		location: c,
		path: b
	};
	let [S, C] = (0, Q.useState)(null), w = (0, Q.useRef)(null), T = (0, Q.useRef)(null), E = (0, Q.useRef)(null), D = Z({
		queryKey: [
			"organize-example",
			_.file,
			_.dir
		],
		queryFn: ({ signal: e }) => Qe(_.file, _.dir, e),
		enabled: !!i
	}), [A, oe] = (0, Q.useState)("file"), j = (0, Q.useRef)(!1), se = (0, Q.useRef)(null);
	(0, Q.useLayoutEffect)(() => {
		let e = se.current;
		if (!e) return;
		se.current = null;
		let t = (e.field === "file" ? w : T).current;
		t?.focus(), t?.setSelectionRange(e.caret, e.caret);
	});
	let M = () => ({
		location: c,
		path: b.trim(),
		file_template: _.file.trim(),
		dir_template: _.dir.trim()
	}), N = zt({
		mutationFn: _t,
		onError: (e) => {
			let t = /整理路径/.test(U(e)) ? "path" : l.test(U(e)) ? "dir" : "file";
			C(t), (t === "path" ? E : t === "dir" ? T : w).current?.focus();
		}
	}), P = zt({
		mutationFn: ({ initial: e }) => ht(e),
		onSuccess: (e, t) => {
			e.path && t.location === te.current.location && t.path === te.current.path && (y({
				location: t.location,
				path: e.path
			}), C(null), N.reset(), E.current?.focus());
		}
	}), F = X({
		queryKey: re,
		queryFn: ({ signal: e }) => Ze(e),
		start: Nt,
		jobOf: (e) => e,
		withJob: Vt,
		onStarted: () => N.reset(),
		onFinish: (n) => {
			if (q.invalidateQueries({
				queryKey: re,
				exact: !0
			}), n.status !== "complete") return;
			let { text: r, failed: i } = pt(n);
			i ? t(Y("cleanup:tools.organize"), Error(Y("cleanup:organize.rowsFailed", { count: i }))) : e(r.replace(/。$/, ""));
		}
	}), ce = F.running || F.start.isPending, le = JSON.stringify(N.variables) === JSON.stringify(M()), I = le ? N.data : void 0, ue = Number(I?.counts?.change || 0), de = x[c] || c, fe = (e) => {
		v(e), C(null), N.reset();
	}, pe = (e) => {
		let t = (A === "file" ? w : T).current, n = _[A], r = j.current ? t?.selectionStart ?? n.length : n.length, i = j.current ? t?.selectionEnd ?? r : r, a = `{${e}}`;
		se.current = {
			field: A,
			caret: r + a.length
		}, fe({ [A]: n.slice(0, r) + a + n.slice(i) });
	}, me = () => {
		N.isPending || ce || !c || (F.dismiss(), F.start.reset(), C(null), N.mutate(M()));
	}, he = () => {
		let e = N.variables;
		e && I && ue && Pe({
			title: Y("cleanup:tools.organize"),
			body: ln(de, e.path),
			confirmLabel: Y("cleanup:tools.organize"),
			onConfirm: async () => {
				await F.start.mutateAsync({
					kind: "apply",
					request: e
				}), St({
					...i?.templates ?? {},
					[e.location]: {
						file: e.file_template,
						dir: e.dir_template
					}
				});
			}
		});
	}, ge = () => void Pe({
		title: Y("cleanup:organize.rollbackTitle"),
		body: un,
		confirmLabel: Y("cleanup:organize.rollbackConfirm"),
		onConfirm: () => F.start.mutateAsync({ kind: "rollback" })
	}), L = null, ye = !!ue && !ce && !F.outcome, R = F.job, z = F.outcome;
	if (R?.status === "running") {
		let e = G(R) || At(R) || Y("cleanup:organize.running");
		L = /* @__PURE__ */ (0, $.jsx)(B, {
			embedded: !0,
			kind: V("organize", R.stage_code),
			label: e,
			value: Math.min(R.checked || 0, R.total || 0),
			total: R.total
		});
	} else if (z?.status === "failed") L = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:organize.incomplete"),
		children: G(z, "error") || Y("cleanup:shared.checkTaskLogFiles")
	});
	else if (z) {
		let { text: e, failed: t } = pt(z);
		L = /* @__PURE__ */ (0, $.jsx)(O, {
			tone: t ? "warning" : "success",
			title: Y(t ? "cleanup:shared.partiallyCompleted" : "cleanup:organize.result"),
			children: e
		});
	} else F.start.isError ? L = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:organize.failed"),
		children: U(F.start.error)
	}) : N.isPending ? L = /* @__PURE__ */ (0, $.jsx)(B, {
		embedded: !0,
		kind: V("organize", "organize.checkingPlan"),
		label: Y("cleanup:organize.checkingPlan")
	}) : N.isError && le ? L = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:organize.previewFailed"),
		children: U(N.error)
	}) : I && (L = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(O, {
		tone: "neutral",
		title: Y("cleanup:organize.previewResult"),
		children: gt(I)
	}), ue ? /* @__PURE__ */ (0, $.jsx)(fn, { plan: I }) : null] }));
	return /* @__PURE__ */ (0, $.jsxs)(d, {
		layout: "stack",
		id: "organize",
		labelledBy: "cleanup-organize-title",
		attributes: { "data-cleanup-organize": "" },
		footer: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
			i?.last_batch ? /* @__PURE__ */ (0, $.jsx)(n, {
				variant: "secondary",
				...H(ce),
				onClick: ge,
				children: Y("cleanup:organize.rollbackLastBatch")
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(n, {
				variant: ye ? "secondary" : "primary",
				disabled: !a.length || ce,
				...H(N.isPending),
				onClick: me,
				children: Y("cleanup:organize.preview")
			}),
			ye ? /* @__PURE__ */ (0, $.jsx)(n, {
				variant: "primary",
				onClick: he,
				children: Y("cleanup:organize.apply")
			}) : null
		] }),
		children: [
			/* @__PURE__ */ (0, $.jsx)(f, {
				id: "cleanup-organize-title",
				gap: "medium",
				children: Y("cleanup:organize.title")
			}),
			/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-regular text-text-secondary",
				children: ae
			}),
			r.isError ? /* @__PURE__ */ (0, $.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, $.jsx)(O, {
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
						children: [a.length ? /* @__PURE__ */ (0, $.jsx)(_e, {
							"aria-label": Y("cleanup:organize.storageLabel"),
							prefix: Y("cleanup:organize.storagePrefix"),
							className: "w-fit min-w-25",
							selectedKey: c || null,
							onSelectionChange: (e) => {
								e !== null && (s(String(e)), y({
									location: String(e),
									path: ""
								}), C(null), N.reset(), P.reset(), j.current = !1);
							},
							children: a.map((e) => /* @__PURE__ */ (0, $.jsxs)(ve, {
								id: e.location,
								textValue: x[e.location] || e.location,
								children: [/* @__PURE__ */ (0, $.jsx)(be, { mark: ne[e.location] || "database" }), x[e.location] || e.location]
							}, e.location))
						}) : null, /* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex min-w-0 basis-64 flex-1 items-start gap-2",
							children: [/* @__PURE__ */ (0, $.jsx)(g, {
								"aria-label": Y("cleanup:organize.pathLabel"),
								className: "min-w-0 flex-1",
								placeholder: Y("cleanup:organize.pathPlaceholder"),
								name: "organize-path",
								autoComplete: "off",
								spellCheck: "false",
								value: b,
								ref: E,
								isInvalid: S === "path",
								onChange: (e) => {
									y({
										location: c,
										path: e
									}), C(null), N.reset(), P.reset();
								}
							}), /* @__PURE__ */ (0, $.jsx)(m, {
								icon: Gt,
								"aria-label": Y("cleanup:organize.choosePath"),
								...H(P.isPending),
								onClick: () => P.mutate({
									initial: b || a.find((e) => e.location === c)?.roots[0] || "",
									location: c,
									path: b
								})
							})]
						})]
					}),
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-caption-1-regular text-text-secondary",
						children: ie
					}),
					P.isError ? /* @__PURE__ */ (0, $.jsxs)(O, {
						tone: "error",
						title: Y("cleanup:organize.pickerFailed"),
						children: [U(P.error), Y("cleanup:organize.pickerFallback")]
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(g, {
						label: Y("cleanup:organize.fileTemplate"),
						placeholder: "{code}[ {title}]",
						value: _.file,
						ref: w,
						spellCheck: "false",
						isInvalid: S === "file",
						onFocus: () => {
							oe("file"), j.current = !0;
						},
						onChange: (e) => fe({ file: e })
					}),
					/* @__PURE__ */ (0, $.jsx)(g, {
						label: Y("cleanup:organize.dirTemplate"),
						placeholder: Y("cleanup:organize.dirTemplatePlaceholder"),
						value: _.dir,
						ref: T,
						spellCheck: "false",
						isInvalid: S === "dir",
						onFocus: () => {
							oe("dir"), j.current = !0;
						},
						onChange: (e) => fe({ dir: e })
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
								let t = Ne(e, "label");
								return /* @__PURE__ */ (0, $.jsx)(n, {
									variant: "secondary",
									size: "small",
									title: e.example || t,
									className: "max-w-full [&>span]:min-w-0 [&>span]:shrink",
									onClick: () => {
										fe({
											file: e.file,
											dir: e.dir
										}), j.current = !1;
									},
									children: /* @__PURE__ */ (0, $.jsx)("span", {
										className: "truncate",
										children: t
									})
								}, e.id || e.label);
							})
						})]
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("p", {
						"aria-live": "polite",
						"aria-busy": D.isFetching,
						"data-organize-example": "",
						className: "text-caption-1-regular text-text-secondary",
						children: [Y("cleanup:organize.examplePath"), /* @__PURE__ */ (0, $.jsx)("code", {
							className: "wrap-anywhere",
							children: D.data?.example || D.data?.error || (D.isError ? U(D.error) : Y("cleanup:organize.previewLoading"))
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
							}), Y("cleanup:organize.insertTarget", { target: Y(A === "file" ? "cleanup:organize.fileTemplate" : "cleanup:organize.dirTemplate") })]
						}), /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: i.placeholders.map((e) => {
								let t = Ot(`labels.organizeTemplates.placeholder.${e.key}`, e.label);
								return /* @__PURE__ */ (0, $.jsx)(n, {
									variant: "ghost",
									size: "small",
									"aria-label": `${t} {${e.key}}`,
									onClick: () => pe(e.key),
									children: /* @__PURE__ */ (0, $.jsxs)("span", {
										className: "inline-flex flex-wrap items-center gap-x-1.5",
										children: [/* @__PURE__ */ (0, $.jsx)("code", { children: `{${e.key}}` }), /* @__PURE__ */ (0, $.jsx)("span", {
											className: "text-text-secondary",
											children: t
										})]
									})
								}, e.key);
							})
						})]
					}) : null,
					/* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-caption-1-regular leading-4.5 text-text-secondary",
						children: k
					})
				]
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"aria-live": "polite",
				className: "mt-3 flex flex-col gap-2 empty:hidden",
				children: L
			})
		]
	});
}
// src/react/data-cleanup/orphan-records-card.tsx
var mn = J("play"), hn = Object.fromEntries([
	...F,
	["rating", Y("catalog:shared.rating")],
	["play_count", Y("catalog:catalogList.plays")],
	["last_played", Y("catalog:catalogList.lastWatched")],
	["o_count", Y("catalog:catalogList.climaxCount")]
]), gn = () => q.invalidateQueries({
	queryKey: A,
	exact: !0
});
function _n(e, t) {
	return Pe({
		title: Y("cleanup:orphans.deleteRecord"),
		holdToConfirm: !0,
		body: xt(e.records) ? Y("cleanup:orphans.deleteBodyWithActivity", {
			name: e.name,
			records: xt(e.records)
		}) : Y("cleanup:orphans.deleteBody", { name: e.name }),
		confirmLabel: Y("cleanup:orphans.deleteRecord"),
		danger: !0,
		onConfirm: t
	});
}
async function vn(e, t) {
	t((await bt(e.id)).blocked.length ? Y("cleanup:orphans.fileRestored", { name: e.name }) : Y("cleanup:orphans.recordDeleted", { name: e.name })), gn();
}
function yn({ item: e, toast: t }) {
	let [r, i] = (0, Q.useState)(e.candidates[0]?.id ?? null), a = zt({
		mutationFn: () => Oe(e.id, Number(r)),
		onSuccess: () => {
			let n = e.candidates.find((e) => e.id === r);
			t(Y("cleanup:orphans.attached", {
				name: e.name,
				target: n?.name ?? Y("cleanup:orphans.selectedFile")
			})), gn();
		},
		onError: (e) => t(U(e))
	}), o = zt({ mutationFn: () => vn(e, t) }), s = () => {
		_n(e, () => o.mutateAsync());
	}, c = a.isPending || o.isPending;
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, $.jsx)(n, {
				variant: "danger",
				size: "small",
				...H(c),
				onClick: s,
				children: Y("cleanup:orphans.deleteRecord")
			}),
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(_e, {
				"data-orphan-target": "",
				"aria-label": Y("cleanup:orphans.targetLabel", { name: e.name }),
				prefix: Y("cleanup:orphans.targetPrefix"),
				className: "w-52",
				selectedKey: r,
				onSelectionChange: (e) => {
					e !== null && i(Number(e));
				},
				children: e.candidates.map((e) => /* @__PURE__ */ (0, $.jsx)(ve, {
					id: e.id,
					textValue: Ae(e),
					children: Ae(e)
				}, e.id))
			}) : null,
			e.candidates.length ? /* @__PURE__ */ (0, $.jsx)(n, {
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
function bn({ item: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			className: "relative inline-grid aspect-16/10 w-24 flex-none place-items-center max-cleanup-tight:hidden overflow-hidden rounded-lg border border-separator-border bg-media-placeholder text-text-tertiary",
			children: [/* @__PURE__ */ (0, $.jsx)(mn, {
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
					e.location ? /* @__PURE__ */ (0, $.jsx)(ye, {
						source: e.location,
						label: x[e.location] || e.location
					}) : null
				]
			})]
		})]
	});
}
function xn({ toast: e }) {
	let [t, n] = (0, Q.useState)([]), r = Z({
		queryKey: A,
		queryFn: ({ signal: e }) => $e(e)
	}), i = r.data?.items ?? [], a = { receipt: e }, o = (t) => {
		let n = [{
			id: "delete",
			label: Y("cleanup:orphans.deleteRecord"),
			icon: w,
			danger: !0,
			run: () => {
				_n(t, () => vn(t, e));
			}
		}];
		return t.candidates.length && n.unshift({
			id: "target",
			label: Y("cleanup:orphans.targetLabel", { name: t.name }),
			icon: ut,
			run: (e) => {
				e.querySelector("[data-orphan-target] button")?.click();
			}
		}), n;
	}, s = (e) => {
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
				t = await bt(e.map((e) => e.id));
			},
			receipt: () => t ? Y("cleanup:orphans.purged", { count: t.purged }) + (t.blocked.length ? Y("cleanup:orphans.purgedBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, c = [
		{
			id: "item",
			label: Y("cleanup:shared.video"),
			width: 480,
			min: 320,
			value: (e) => e.name,
			render: (e) => /* @__PURE__ */ (0, $.jsx)(bn, { item: e })
		},
		{
			id: "records",
			label: Y("cleanup:orphans.columnActivity"),
			width: 176,
			min: 144,
			value: (e) => xt(e.records),
			filter: {
				values: (e) => Object.keys(e.records).filter((t) => e.records[t]),
				option: (e) => ({ label: hn[e] || e })
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)("span", {
				className: "block min-w-0 whitespace-normal wrap-anywhere",
				children: xt(e.records) || Y("cleanup:shared.none")
			})
		},
		{
			id: "target",
			label: Y("cleanup:shared.actions"),
			width: i.some((e) => e.candidates.length) ? 360 : 128,
			min: 128,
			value: (e) => e.candidates.length,
			render: (t) => /* @__PURE__ */ (0, $.jsx)(yn, {
				item: t,
				toast: e
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsx)("section", {
		id: "orphan-records",
		"aria-labelledby": "orphan-records-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: r.isError ? /* @__PURE__ */ (0, $.jsxs)(d, {
			layout: "stack",
			labelledBy: "orphan-records-title",
			children: [/* @__PURE__ */ (0, $.jsx)(f, {
				id: "orphan-records-title",
				children: Y("cleanup:tools.orphanRecords")
			}), /* @__PURE__ */ (0, $.jsx)(O, {
				tone: "error",
				title: Y("cleanup:orphans.loadFailed"),
				children: U(r.error)
			})]
		}) : /* @__PURE__ */ (0, $.jsx)(Wt, {
			label: Y("cleanup:orphans.tableLabel"),
			items: i,
			columns: c,
			contextOperations: o,
			title: Y("cleanup:tools.orphanRecords"),
			titleId: "orphan-records-title",
			unit: Y("cleanup:orphans.unit"),
			description: oe,
			rowId: (e) => String(e.id),
			rowLabel: (e) => e.name,
			selected: t,
			onSelected: n,
			actions: (e) => [{
				items: e,
				host: a,
				action: s(e.length),
				done: () => {
					n([]), gn();
				}
			}]
		})
	});
}
// src/react/data-cleanup/performer-delete-card.tsx
function Sn({ person: e }) {
	let t = Re("performer", e.k, e.entity_id);
	return /* @__PURE__ */ (0, $.jsxs)("a", {
		href: Be("performer", e.k, e.entity_id),
		title: t,
		className: "flex min-w-0 items-center gap-3 text-text-primary",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			"aria-hidden": !0,
			className: Fe("relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium", v),
			dangerouslySetInnerHTML: { __html: `<span>${Ve(ot(t))}</span>` + ze({
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
function Cn(e, t, n) {
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
function wn({ toast: t }) {
	Rt();
	let r = Z({
		queryKey: j,
		queryFn: ({ signal: e }) => He(e)
	}), [i, a] = (0, Q.useState)([]), [o, s] = (0, Q.useState)(""), [l, u] = (0, Q.useState)(null), [p, m] = (0, Q.useState)(""), g = {
		receipt: t,
		failure: (e) => m(U(e))
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
					label: Re("performer", e, t?.entity_id),
					searchTerms: t?.aliases,
					leading: t && /* @__PURE__ */ (0, $.jsx)(c, { person: {
						...t,
						id: t.entity_id,
						name: e
					} })
				})
			},
			render: (e) => /* @__PURE__ */ (0, $.jsx)(Sn, { person: e })
		},
		{
			id: "works",
			label: Y("cleanup:shared.videos"),
			width: 104,
			min: 80,
			value: (e) => e.n,
			filter: {
				range: "count",
				value: (e) => e.n
			},
			render: (e) => Y("cleanup:performerDelete.videoCount", { count: e.n })
		},
		{
			id: "files",
			label: Y("cleanup:shared.files"),
			width: 104,
			min: 80,
			value: (e) => e.file_count,
			filter: {
				range: "count",
				value: (e) => e.file_count
			},
			render: (e) => Y("cleanup:performerDelete.fileCount", { count: e.file_count })
		},
		{
			id: "bytes",
			label: Y("cleanup:performerDelete.columnSize"),
			width: 136,
			min: 104,
			value: (e) => e.bytes,
			filter: {
				range: "size",
				value: (e) => e.bytes
			},
			render: (e) => W(e.bytes)
		}
	], []), v = o.toLocaleLowerCase(), ee = (r.data?.items || []).filter((e) => !v || [
		e.k,
		Re("performer", e.k, e.entity_id),
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
				m("");
				let n = await Ue(t.map((e) => e.entity_id));
				if (!n.total) throw Error(Y("cleanup:performerDelete.nothingToDelete"));
				e = n;
				let r = n.performers.map((e) => Re("performer", e.name, e.id)), i = [...new Set(n.items.map((e) => e.code || e.name || `#${e.id}`))];
				return {
					title: Y("cleanup:performerDelete.confirmTitle"),
					confirmLabel: Y("cleanup:performerDelete.confirm"),
					danger: !0,
					body: Cn(r, i, n)
				};
			},
			run: async () => {
				t = await Le(e), u(t), await Promise.all([q.invalidateQueries({
					queryKey: j,
					exact: !0
				}), q.invalidateQueries({
					queryKey: z,
					exact: !0
				})]);
			},
			receipt: () => t ? Y("cleanup:performerDelete.purged", { count: t.purged }) + (t.blocked.length ? Y("cleanup:performerDelete.doneBlocked", { count: t.blocked.length }) : "") : ""
		};
	}, b = l ? [
		...l.blocked.map((e) => ({
			path: e.path,
			reason: Ot(e.reason_code ?? "", e.reason, e.reason_params)
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
			r.isPending ? /* @__PURE__ */ (0, $.jsx)("div", { dangerouslySetInnerHTML: { __html: Me("batch-delete") } }) : r.isError ? /* @__PURE__ */ (0, $.jsxs)(d, {
				layout: "stack",
				labelledBy: "batch-delete-title",
				children: [/* @__PURE__ */ (0, $.jsx)(f, {
					id: "batch-delete-title",
					children: Y("cleanup:tools.bulkDelete")
				}), /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					title: Y("cleanup:performerDelete.loadFailed"),
					action: /* @__PURE__ */ (0, $.jsx)(n, {
						variant: "secondary",
						size: "small",
						onClick: () => void r.refetch(),
						children: Y("cleanup:shared.retry")
					}),
					children: U(r.error)
				})]
			}) : /* @__PURE__ */ (0, $.jsx)(Wt, {
				label: Y("cleanup:performerDelete.tableLabel"),
				title: Y("cleanup:tools.bulkDelete"),
				titleId: "batch-delete-title",
				unit: Y("cleanup:performerDelete.unit"),
				description: e,
				items: ee,
				columns: _,
				rowId: (e) => String(e.entity_id),
				rowLabel: (e) => Re("performer", e.k, e.entity_id),
				selected: i,
				onSelected: a,
				toolbarActions: /* @__PURE__ */ (0, $.jsx)(h, {
					label: Y("cleanup:performerDelete.search"),
					value: o,
					onQuery: (e) => {
						s(e), a([]);
					}
				}),
				actions: (e, t) => [{
					action: y(),
					items: e,
					host: g,
					done: t,
					rowAction: {
						label: Y("cleanup:performerDelete.deleteVideosForRow"),
						icon: w
					}
				}]
			}),
			p ? /* @__PURE__ */ (0, $.jsx)(O, {
				tone: "error",
				title: Y("cleanup:performerDelete.planFailed"),
				children: p
			}) : null,
			l ? /* @__PURE__ */ (0, $.jsx)(O, {
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
var Tn = J("git-compare"), En = J("rotate-cw"), Dn = Y("cleanup:shared.reconnecting"), On = Y("cleanup:resourceSync.cleanUpDead"), kn = "inline-grid w-full grid-flow-col auto-cols-fr gap-4 max-plain-stat-pair:grid-flow-row max-plain-stat-pair:grid-cols-2 max-plain-stat-single:grid-cols-1", An = (e) => Number(e || 0).toLocaleString();
function jn({ scan: e, partial: t = !1 }) {
	let n = e.cache ?? {
		files: 0,
		bytes: 0
	};
	return /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("div", {
		className: kn,
		children: (e.sources ?? []).map((e) => /* @__PURE__ */ (0, $.jsxs)("article", {
			className: K(),
			children: [/* @__PURE__ */ (0, $.jsx)(M, {
				label: he[e.location] || Y("cleanup:resourceSync.storageFallback"),
				mark: /* @__PURE__ */ (0, $.jsx)(be, { mark: ne[e.location] ?? "database" }),
				aside: /* @__PURE__ */ (0, $.jsx)(Kt, {
					online: e.online,
					children: e.online ? Y("cleanup:resourceSync.online") : Y("cleanup:resourceSync.offline")
				}),
				figure: e.online ? Y("cleanup:resourceSync.missingCount", { count: Number(e.missing || 0) }) : "—",
				meta: e.online ? kt(e) : Y("cleanup:resourceSync.skipped", { summary: kt(e) }),
				wrapMeta: !0
			}), e.online && e.unreadable > 0 ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, $.jsxs)(R, {
					tone: "warning",
					children: [
						An(e.unreadable),
						" ",
						Y("cleanup:resourceSync.unreadableDirs")
					]
				})
			}) : null]
		}, e.location))
	}), !t && /* @__PURE__ */ (0, $.jsxs)("div", {
		className: kn,
		children: [
			/* @__PURE__ */ (0, $.jsx)("article", {
				className: K(),
				children: /* @__PURE__ */ (0, $.jsx)(M, {
					label: Y("cleanup:resourceSync.toPurge"),
					figure: Y("cleanup:resourceSync.purgeCount", { count: Number(yt(e) || 0) }),
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
function Mn({ toast: e }) {
	let t = X({
		queryKey: I,
		queryFn: ({ signal: e }) => nt(e),
		start: Pt,
		onFinish: (t) => {
			if (q.invalidateQueries({
				queryKey: z,
				exact: !0
			}), q.invalidateQueries({
				queryKey: ue,
				exact: !0
			}), t.status !== "complete") return;
			let { done: n, left: r } = Te(t);
			r ? e(Y("cleanup:resourceSync.applyLeftovers", {
				done: An(n),
				count: Number(r || 0)
			}), { warning: !0 }) : e(Y("cleanup:resourceSync.cleaned"));
		}
	}), r = X({
		queryKey: ue,
		queryFn: ({ signal: e }) => rt(e),
		start: Ft,
		onStarted: () => t.dismiss()
	}), i = r.job, a = r.running || r.start.isPending, o = t.running || t.start.isPending, s = !!r.job && !!t.job, c = i?.status === "complete" || i?.status === "failed", l = Y(a ? "cleanup:resourceSync.scanning" : c ? "cleanup:resourceSync.scanAgain" : "cleanup:resourceSync.checkFiles"), u = (e) => void Pe({
		holdToConfirm: !0,
		title: On,
		body: we(e),
		confirmLabel: On,
		danger: !0,
		onConfirm: () => t.start.mutateAsync(e.scan_id || "")
	}), p = t.outcome, m = (e) => {
		let t = Te(e).left > 0;
		return /* @__PURE__ */ (0, $.jsx)(O, {
			tone: t ? "warning" : "success",
			title: Y(t ? "cleanup:shared.partiallyCompleted" : "cleanup:resourceSync.cleanupResult"),
			children: De(e, W)
		});
	}, h = null, g = null;
	if (p?.status === "failed") g = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:resourceSync.cleanupIncomplete"),
		children: G(p, "error") || Y("cleanup:shared.checkTaskLogFiles")
	});
	else if (p) g = m(p);
	else if (t.running) h = /* @__PURE__ */ (0, $.jsx)(B, {
		embedded: !0,
		kind: V("resource-apply"),
		label: G(t.job) || Y("cleanup:resourceSync.applying")
	});
	else if (r.start.isError) g = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:resourceSync.scanFailed"),
		children: U(r.start.error)
	});
	else if (r.query.isError && i) g = /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "neutral",
		title: Y("cleanup:shared.taskStatus"),
		children: Dn
	});
	else if (i?.status === "running") {
		let e = Dt(i);
		h = /* @__PURE__ */ (0, $.jsx)(B, {
			embedded: !0,
			kind: V("resource-scan"),
			label: e,
			value: i.completed_sources,
			total: i.total_sources
		}), i.sources?.length && (g = /* @__PURE__ */ (0, $.jsx)(jn, {
			scan: i,
			partial: !0
		}));
	} else if (i?.status === "failed") g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [i.sources?.length ? /* @__PURE__ */ (0, $.jsx)(jn, {
		scan: i,
		partial: !0
	}) : null, /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:resourceSync.scanFailed"),
		children: G(i, "error") || Y("cleanup:resourceSync.backgroundScanFailed")
	})] });
	else if (i?.status === "complete" && i.applied) g = t.job?.status === "complete" ? m(t.job) : /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "neutral",
		title: Y("cleanup:resourceSync.cleanupResult"),
		children: Y("cleanup:resourceSync.alreadyCleaned")
	});
	else if (i?.status === "complete") {
		let e = st(i);
		g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(jn, { scan: i }), e ? /* @__PURE__ */ (0, $.jsx)(O, {
			tone: "neutral",
			title: Y("cleanup:resourceSync.toClean"),
			action: /* @__PURE__ */ (0, $.jsx)(n, {
				variant: "danger",
				disabled: !s,
				...H(o),
				onClick: () => {
					s && u(i);
				},
				children: o ? Y("cleanup:resourceSync.applyingButton") : On
			}),
			children: Ee(i)
		}) : /* @__PURE__ */ (0, $.jsx)("p", {
			className: "mr-auto text-body-regular text-notification-success-foreground",
			children: Y("cleanup:resourceSync.nothingToClean")
		})] });
	}
	return t.start.isError && !p && (g = /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [g, /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:resourceSync.cleanupFailed"),
		children: U(t.start.error)
	})] })), /* @__PURE__ */ (0, $.jsxs)("section", {
		id: "resource-sync",
		"aria-labelledby": "resource-sync-title",
		className: "flex scroll-mt-20 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsxs)(d, {
			layout: "split",
			labelledBy: "resource-sync-title",
			footer: /* @__PURE__ */ (0, $.jsx)(n, {
				"data-resource-scan": !0,
				leadingIcon: c && !a ? En : Tn,
				disabled: !s,
				...H(a),
				onClick: () => {
					s && !a && r.start.mutate();
				},
				children: l
			}),
			children: [
				/* @__PURE__ */ (0, $.jsx)(f, {
					id: "resource-sync-title",
					gap: "small",
					children: Y("cleanup:tools.resourceSync")
				}),
				r.query.isPending || t.query.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
					role: "status",
					"aria-label": Y("cleanup:resourceSync.statusLoading"),
					"data-skeleton": "",
					className: "skeleton-sheen h-6 rounded-md"
				}) : null,
				!r.job && r.query.isError ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					children: Y("cleanup:resourceSync.scanStatusUnavailable")
				}) : null,
				!t.job && t.query.isError ? /* @__PURE__ */ (0, $.jsx)(O, {
					tone: "error",
					children: Y("cleanup:resourceSync.applyStatusUnavailable")
				}) : null,
				/* @__PURE__ */ (0, $.jsx)("p", {
					className: "max-w-190 text-body-2-regular leading-5 text-text-secondary",
					children: de
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
function Nn({ toast: e }) {
	let t = Z({
		queryKey: D,
		queryFn: ({ signal: e }) => Xe(e)
	});
	return t.isError ? /* @__PURE__ */ (0, $.jsx)(O, {
		tone: "error",
		title: Y("cleanup:resourceSync.storageLoadFailed"),
		children: U(t.error)
	}) : t.isPending ? /* @__PURE__ */ (0, $.jsx)("p", {
		role: "status",
		children: Y("cleanup:resourceSync.storageLoading")
	}) : ct(t.data) ? /* @__PURE__ */ (0, $.jsx)(Mn, { toast: e }) : /* @__PURE__ */ (0, $.jsxs)(d, {
		layout: "stack",
		label: Y("cleanup:tools.resourceSync"),
		children: [
			/* @__PURE__ */ (0, $.jsx)(f, { children: Y("cleanup:tools.resourceSync") }),
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
function Pn({ tool: e, toast: t, failure: n }) {
	let r = (e) => t(e), i;
	switch (e) {
		case "organize":
			i = /* @__PURE__ */ (0, $.jsx)(pn, {
				toast: r,
				failure: n
			});
			break;
		case "resource-sync":
			i = /* @__PURE__ */ (0, $.jsx)(Nn, { toast: t });
			break;
		case "orphan-records":
			i = /* @__PURE__ */ (0, $.jsx)(xn, { toast: r });
			break;
		case "media-repair":
			i = /* @__PURE__ */ (0, $.jsx)(Zt, { toast: r });
			break;
		case "links":
			i = /* @__PURE__ */ (0, $.jsx)(cn, {});
			break;
		case "batch-delete": i = /* @__PURE__ */ (0, $.jsx)(wn, { toast: r });
	}
	return /* @__PURE__ */ (0, $.jsx)(Ht, { children: i });
}
// src/react/data-cleanup/data-cleanup-page.tsx
function Fn(e, t) {
	return e.data === void 0 ? e.isError ? {
		figure: Y("cleanup:overview.loadFailed"),
		state: "error"
	} : {
		figure: Y("cleanup:overview.loading"),
		state: "loading"
	} : t(e.data);
}
function In({ section: e, label: t, icon: n, value: r, open: i }) {
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
function Ln({ tool: e, navigate: t }) {
	let n = J(e.icon);
	return /* @__PURE__ */ (0, $.jsx)(Jt, {
		label: e.title,
		icon: n,
		summary: e.description,
		attributes: { "data-cleanup-tool": e.key },
		onOpen: () => t(e.path + location.search)
	});
}
var Rn = J("square-check-big"), zn = J("sparkles"), Bn = J("file-stack"), Vn = J("file-archive"), Hn = J("trash"), Un = () => {
	for (let e of [
		me,
		P,
		u,
		_
	]) q.invalidateQueries({
		queryKey: e,
		exact: !0
	});
};
function Wn({ toast: e, open: t, navigate: n }) {
	let r = Z({
		queryKey: me,
		queryFn: ({ signal: e }) => it(e)
	}), s = Z({
		queryKey: P,
		queryFn: ({ signal: e }) => et(e)
	}), c = Z({
		queryKey: u,
		queryFn: ({ signal: e }) => We(e)
	}), l = Z({
		queryKey: _,
		queryFn: ({ signal: e }) => Ge(e)
	}), d = Z({
		queryKey: z,
		queryFn: ({ signal: e }) => at(e)
	});
	return (0, Q.useEffect)(() => {
		let e = a[location.hash];
		e && mt.replace(e + location.search);
	}, []), /* @__PURE__ */ (0, $.jsxs)(Ht, { children: [
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-pending",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(ge, {
				id: "cleanup-pending",
				children: Y("cleanup:overview.needsAttention")
			}), /* @__PURE__ */ (0, $.jsxs)("div", {
				className: se,
				children: [
					/* @__PURE__ */ (0, $.jsx)(In, {
						section: "review",
						label: Y("cleanup:overview.review"),
						icon: Rn,
						open: t,
						value: Fn(r, Tt)
					}),
					/* @__PURE__ */ (0, $.jsx)(In, {
						section: "duplicates",
						label: Y("cleanup:overview.duplicates"),
						icon: Bn,
						open: t,
						value: Fn(c, (e) => Number(e.total || 0) ? {
							figure: Y("cleanup:overview.duplicateGroups", {
								count: Number(e.total),
								files: Number(e.files || 0).toLocaleString()
							}),
							meta: Y("cleanup:overview.reclaimable", { size: W(e.reclaimable || 0) })
						} : { figure: Y("cleanup:overview.noDuplicates") })
					}),
					/* @__PURE__ */ (0, $.jsx)(In, {
						section: "ads",
						label: Y("cleanup:overview.junkFiles"),
						icon: Vn,
						open: t,
						value: Fn(l, (e) => ({
							figure: Y("cleanup:overview.junkUndecided", { count: Number(e.pending_total || 0) }),
							meta: lt(e)
						}))
					}),
					/* @__PURE__ */ (0, $.jsx)(In, {
						section: "quality",
						label: Y("cleanup:overview.hdUpgrades"),
						icon: zn,
						open: t,
						value: Fn(s, (e) => ({ figure: Y("cleanup:overview.upgradesPending", { count: Number(e.total || 0) }) }))
					}),
					/* @__PURE__ */ (0, $.jsx)(In, {
						section: "trash",
						label: Y("cleanup:overview.trash"),
						icon: Hn,
						open: t,
						value: Fn(d, (e) => ({
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
			children: /* @__PURE__ */ (0, $.jsx)(C, {
				toast: (t) => e(t),
				onComplete: Un
			})
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-maintenance",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(ge, {
				id: "cleanup-maintenance",
				children: Y("cleanup:overview.maintenanceSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: i,
				children: o.filter((e) => e.key !== "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(Ln, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		}),
		/* @__PURE__ */ (0, $.jsxs)("section", {
			"aria-labelledby": "cleanup-deletion",
			className: "flex flex-col gap-4",
			children: [/* @__PURE__ */ (0, $.jsx)(ge, {
				id: "cleanup-deletion",
				children: Y("cleanup:overview.deletionSection")
			}), /* @__PURE__ */ (0, $.jsx)("div", {
				className: i,
				children: o.filter((e) => e.key === "batch-delete").map((e) => /* @__PURE__ */ (0, $.jsx)(Ln, {
					tool: e,
					navigate: n
				}, e.key))
			})]
		})
	] });
}
export { Wn as DataCleanupPage, Pn as DataCleanupToolPage };

//# debugId=cf858ebd-e797-4996-98a4-cf194e1faa49