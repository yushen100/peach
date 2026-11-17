(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "e7069e5f-3a16-4d1a-9919-904d46225a61", e._sentryDebugIdIdentifier = "sentry-dbid-e7069e5f-3a16-4d1a-9919-904d46225a61");
	} catch {}
})();
import { $ea3928288112382f$export$439d29a4e110a164 as e, $fe21c36db05242bb$export$a98f0dcb43a68a25 as t, $fe21c36db05242bb$export$d7b12c4107be0d61 as n, Button as r, ButtonLink as i, Checkbox as a, CheckboxGlyph as o, Chip as s, CollapseChevron as c, CollapseRegion as l, DEFAULT_CATEGORY as u, DataTableFooter as d, ENTITY_REVIEW_KINDS as ee, Ea as te, EmptyState as f, ExternalLink as p, FIELDSET_FOOT as ne, FilterGlassRows as m, Gg as h, InputBase as g, LEGACY_AVATAR_IMG as _, LinkButton as v, Note as y, REVIEW_CATEGORIES as b, REVIEW_DECISION_LABELS as re, REVIEW_KEY as x, REVIEW_LABELS as S, REVIEW_QUEUES as ie, REVIEW_QUEUE_LABELS as C, Select as w, SelectItem as T, SelectionActions as E, SelectionDock as D, SortableBoardTabs as ae, TextField as O, Wt as k, __toESM as A, apiGet as j, apiSend as M, avatarInner as oe, busyProps as N, canApprove as se, cardClass as ce, codedText as P, commonReviewSources as le, composingKey as F, currentReviewRow as ue, cx as I, decisionPayload as de, decisionReceipt as fe, defaultChoice as pe, enterPageSelection as me, errorMessage as L, exitPageSelection as he, fetchReview as ge, filterReviewRows as _e, groupReviewRows as ve, isReviewCategory as ye, joinList as be, l7 as xe, localTime as Se, m7 as Ce, mirrorText as we, pendingGenres as Te, queryClient as Ee, quoted as R, recordGenre as De, reloadReview as Oe, require_jsx_runtime as ke, require_react as z, reviewGroupingOptions as Ae, reviewQueueData as je, reviewQueueOf as Me, reviewWindow as Ne, rowEvidence as B, rowFieldName as V, rowSubject as Pe, rowTags as Fe, rowTitle as H, selectReviewRange as Ie, serverLabel as Le, serverLabelList as U, settleReviewRows as Re, submitDecision as ze, t as W, useMutation as Be, useNavigationOrder as Ve, useOverlayScrollbar as He, usePageSelection as Ue, useQuery as We, useViewGlide as Ge } from "./peach-app.js";
import { Page as Ke } from "./peach-app.page-QAncjzM1.js";
import { DataTable as G } from "./peach-app.data-table-PbQqv_VV.js";
import { ComparisonText as K } from "./peach-app.comparison-text-d2N41j2E.js";
// src/react/review/auto-landings.ts
var q = /* @__PURE__ */ A(z(), 1), qe = "/api/review/auto-landings", Je = "/api/review/auto-landings/revert", Ye = ["review", "auto-landings"], J = (e) => Le(e.field_code ?? "", e.field), Y = (e) => Le(e.label_code ?? "", e.label), Xe = (e) => j(qe, e), Ze = (e) => j(`${qe}?items=${encodeURIComponent(e.join("\n"))}`), Qe = (e, t) => M(Je, {
	items: e,
	token: t
}), $e = (e) => e.at === null ? "" : Se((/* @__PURE__ */ new Date(e.at * 1e3)).toISOString()), X = (e) => e.code || e.name || (e.asset_id ? `#${e.asset_id}` : W("manage:autoLandings.unknownVideo")), Z = (e) => e ? R(e) : W("manage:autoLandings.emptyValue"), Q = (e) => e.tags.length ? be(e.tags) : e.value, et = (e) => e.tags.length ? W("manage:autoLandings.existingTagsKept") : W("manage:autoLandings.previousValue", { value: e.previous.length ? be(e.previous.map(Z)) : W("manage:autoLandings.emptyValue") });
function tt(e) {
	return [
		...e.restores.map((e) => W("manage:autoLandings.previewRestore", {
			video: X(e),
			field: J(e),
			current: Z(e.current),
			previous: Z(e.previous)
		})),
		...e.tags.map((e) => W("manage:autoLandings.previewRemoveTag", {
			video: X(e),
			tag: e.tag
		})),
		...e.changed.map((e) => e.gone ? W("manage:autoLandings.previewGone", {
			video: X(e),
			field: J(e)
		}) : W("manage:autoLandings.previewEdited", {
			video: X(e),
			field: J(e)
		}))
	];
}
function nt(e) {
	let t = [e.restores.length ? W("manage:autoLandings.previewRestoreCount", { count: e.restores.length }) : "", e.tags.length ? W("manage:autoLandings.previewRemoveTags", { count: e.tags.length }) : ""].filter(Boolean);
	return [
		t.length ? W("manage:autoLandings.previewRevert", {
			count: e.decisions,
			details: t.join(W("shell:format.clauseSeparator"))
		}) : W("manage:autoLandings.previewRevertNothing", { count: e.decisions }),
		e.changed.length ? W("manage:autoLandings.previewUnchanged", { count: e.changed.length }) : "",
		W("manage:autoLandings.revertBackupNote")
	].filter(Boolean).join(W("shell:format.sentenceGap"));
}
function rt(e) {
	let t = [e.restored ? W("manage:autoLandings.resultRestoreCount", { count: e.restored }) : "", e.removed_tags ? W("manage:autoLandings.resultRemovedTags", { count: e.removed_tags }) : ""].filter(Boolean);
	return t.length ? W("manage:autoLandings.resultSummaryDetails", {
		count: e.decisions,
		details: t.join(W("shell:format.clauseSeparator"))
	}) : W("manage:autoLandings.resultSummary", { count: e.decisions });
}
// src/react/review/auto-landings-card.tsx
var $ = ke(), it = W("manage:autoLandings.description");
function at({ item: t, openItem: n }) {
	let r = t.asset_id && !t.gone ? () => n(t.asset_id) : void 0;
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsxs)("button", {
			type: "button",
			disabled: !r,
			onClick: r,
			className: "flex aspect-card-cover w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-media-placeholder outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default",
			children: [t.preview_url ? /* @__PURE__ */ (0, $.jsx)("img", {
				src: t.preview_url,
				alt: "",
				loading: "lazy",
				className: "size-full object-cover"
			}) : /* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-caption-1-regular text-text-secondary",
				children: W("manage:shared.noCover")
			}), /* @__PURE__ */ (0, $.jsx)(e, { children: W("manage:autoLandings.openVideo", { name: X(t) }) })]
		}), /* @__PURE__ */ (0, $.jsxs)("span", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, $.jsxs)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: [X(t), t.assets > 1 ? /* @__PURE__ */ (0, $.jsx)("small", {
					className: "ml-1 text-caption-1-regular text-text-secondary",
					children: W("manage:autoLandings.fileCount", { count: t.assets })
				}) : null]
			}), /* @__PURE__ */ (0, $.jsx)("small", {
				title: t.name,
				className: "truncate text-caption-1-regular text-text-secondary",
				children: t.gone ? W("manage:autoLandings.videoGone") : t.name
			})]
		})]
	});
}
function ot({ item: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-0.5",
		children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			title: Q(e),
			className: "truncate text-body-regular text-text-primary",
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-text-secondary",
				children: W("shell:format.labelPrefix", { label: J(e) })
			}), Q(e)]
		}), /* @__PURE__ */ (0, $.jsx)("small", {
			title: et(e),
			className: "truncate text-caption-1-regular text-text-secondary",
			children: et(e)
		})]
	});
}
function st({ locked: e, openItem: t, toast: n }) {
	let [r, i] = (0, q.useState)([]), [a, o] = (0, q.useState)(null), s = We({
		queryKey: Ye,
		queryFn: ({ signal: e }) => Xe(e)
	}), c = s.data?.items ?? [], l = (e) => {
		let t = null, n = null;
		return {
			key: "revert",
			label: W("manage:autoLandings.revertSelected", { count: e }),
			reversal: "irreversible",
			confirm: async (e) => (t = await Ze(e.map((e) => e.item_key)), {
				title: W("manage:autoLandings.revertTitle"),
				body: nt(t),
				items: tt(t),
				confirmLabel: W("manage:shared.revert")
			}),
			run: async () => {
				n = await Qe(t.items, t.token), o(n), Ee.invalidateQueries({ queryKey: x });
			},
			receipt: () => n ? rt(n) : ""
		};
	}, u = {
		receipt: n,
		failure: (e) => n(L(e))
	};
	if (!c.length && !a && !s.isError) return null;
	let d = [
		{
			id: "work",
			label: W("manage:shared.video"),
			width: 300,
			min: 240,
			value: (e) => X(e),
			render: (e) => /* @__PURE__ */ (0, $.jsx)(at, {
				item: e,
				openItem: t
			})
		},
		{
			id: "written",
			label: W("manage:autoLandings.columnWritten"),
			width: 320,
			min: 220,
			value: (e) => `${J(e)}${Q(e)}`,
			filter: { values: J },
			render: (e) => /* @__PURE__ */ (0, $.jsx)(ot, { item: e })
		},
		{
			id: "rule",
			label: W("manage:autoLandings.columnRuleTime"),
			width: 176,
			min: 144,
			value: (e) => e.at ?? 0,
			filter: { values: Y },
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("span", {
				title: e.batch,
				className: "flex min-w-0 flex-col gap-0.5 text-text-secondary",
				children: [/* @__PURE__ */ (0, $.jsx)("span", {
					className: "truncate text-body-2-regular",
					children: Y(e)
				}), /* @__PURE__ */ (0, $.jsx)("small", {
					className: "tabular-nums text-caption-1-regular",
					children: $e(e) || W("manage:autoLandings.timeUnknown")
				})]
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-labelledby": "auto-landings-title",
		className: "flex flex-col gap-4",
		children: [a ? /* @__PURE__ */ (0, $.jsxs)(y, {
			tone: "success",
			title: rt(a),
			children: [/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-2-regular",
				children: W("manage:autoLandings.backupDone", { path: a.backup })
			}), a.changed.length ? /* @__PURE__ */ (0, $.jsxs)("p", {
				className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-2-regular",
				children: [W("manage:autoLandings.leftUnchanged", { count: a.changed.length }), a.changed.map((e) => e.gone ? /* @__PURE__ */ (0, $.jsx)("span", {
					className: "text-text-secondary",
					children: W("manage:autoLandings.deletedAsset", { id: e.asset_id })
				}, `${e.asset_id}:${e.field}`) : /* @__PURE__ */ (0, $.jsx)(v, {
					size: "small",
					onClick: () => t(e.asset_id),
					children: X(e)
				}, `${e.asset_id}:${e.field}`))]
			}) : null]
		}) : null, s.isError ? /* @__PURE__ */ (0, $.jsx)(y, {
			tone: "error",
			title: W("manage:autoLandings.loadFailed"),
			children: L(s.error)
		}) : c.length ? /* @__PURE__ */ (0, $.jsx)(G, {
			label: W("manage:autoLandings.title"),
			items: c,
			columns: d,
			title: W("manage:autoLandings.title"),
			titleId: "auto-landings-title",
			unit: W("manage:autoLandings.unit"),
			description: it,
			rowId: (e) => e.item_key,
			rowLabel: (e) => `${X(e)} ${J(e)}`,
			selected: r,
			onSelected: i,
			actions: (t) => [{
				action: l(t.length),
				items: t,
				host: u,
				disabled: e,
				done: () => i([])
			}]
		}) : null]
	});
}
// src/react/review/bulk-toolbar.tsx
function ct(e) {
	let { groupOptions: t, groupBy: n, onGroupBy: i, groups: a, filter: o, onFilter: s, pageKeys: c, allKeys: l = c, selected: u, onSelected: d, selectedRows: ee, metadata: te, busy: f, feedback: p, onUnifySource: ne, actions: h, queueView: g = "pending", queueCounts: _, onQueueChange: v, locked: y, fields: b, fieldFilter: re, onFieldFilter: x } = e, S = c.filter((e) => u.has(e)), E = S.length > 0 && S.length === c.length, ae = l.length > c.length && l.every((e) => u.has(e)), O = le(ee), k = te && ee.some((e) => (e.candidates?.length || 0) > 1), A = O.length ? W("manage:reviewToolbar.sourceForAll") : W("manage:reviewToolbar.noCommonSource"), j = (0, q.useRef)(null), M = (0, q.useRef)(null), oe = (0, q.useRef)(null), [N, se] = (0, q.useState)(!1), ce = Ge(j, M, "[data-entity-state][aria-pressed=\"true\"]", g);
	return (0, q.useLayoutEffect)(() => {
		let e = M.current, t = oe.current, n = e?.parentElement, r = e?.closest("[data-review-filter]");
		if (!e || !t || !n || !r) return;
		let i = () => se(t.offsetHeight > 0 && Math.abs(n.getBoundingClientRect().top - t.getBoundingClientRect().top) < 1), a = new ResizeObserver(i);
		for (let n of [
			r,
			e,
			t
		]) a.observe(n);
		return i(), () => a.disconnect();
	}, []), /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(m, {
		label: W("manage:reviewToolbar.filters"),
		topLabel: W("manage:reviewToolbar.processingStatus"),
		attrs: { "data-review-filter": "" },
		className: "mb-0 flex-row flex-wrap",
		topClassName: "max-w-full flex-none",
		bottomClassName: c.length ? "min-h-12 max-w-full flex-none flex-wrap" : "hidden",
		bottomRef: oe,
		panes: /* @__PURE__ */ (0, $.jsx)("span", {
			ref: j,
			"data-view-glide": "",
			"aria-hidden": "true"
		}),
		top: /* @__PURE__ */ (0, $.jsxs)("div", {
			ref: M,
			role: "group",
			"aria-label": W("manage:reviewToolbar.reviewStatus"),
			"data-entity-states": "",
			onPointerLeave: ce.leave,
			children: [ie.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
				type: "button",
				"data-entity-state": e,
				"data-entity-press": "",
				disabled: f,
				"aria-pressed": g === e,
				onPointerEnter: ce.hover,
				onClick: () => {
					e !== g && v(e);
				},
				children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-copy-key": `review.queue.${e}`,
						children: C[e]
					}),
					" ",
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: "ms-1.5 tabular-nums text-caption-1-medium text-text-secondary",
						children: _ ? _[e].toLocaleString() : "…"
					})
				]
			}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
				"data-entity-sep": "",
				"aria-hidden": "true",
				className: N ? void 0 : "invisible"
			})]
		}),
		bottom: c.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
			te && b.length ? /* @__PURE__ */ (0, $.jsxs)(w, {
				"aria-label": W("manage:reviewToolbar.filterField"),
				size: "sm",
				prefix: /* @__PURE__ */ (0, $.jsx)("span", {
					"data-copy-key": "review.filter.field",
					className: "pointer-events-auto",
					children: W("manage:reviewToolbar.field")
				}),
				selectedKey: re || "*",
				isDisabled: f,
				onSelectionChange: (e) => {
					e !== null && x(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, $.jsx)(T, {
					id: "*",
					children: W("manage:shared.all")
				}), b.map((e) => /* @__PURE__ */ (0, $.jsx)(T, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(w, {
				"aria-label": W("manage:reviewToolbar.groupBy"),
				size: "sm",
				selectedKey: n,
				onSelectionChange: (e) => {
					e !== null && i(String(e));
				},
				children: t.map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(T, {
					id: e,
					children: t
				}, e))
			}),
			a.length > 1 ? /* @__PURE__ */ (0, $.jsxs)(w, {
				"aria-label": W(n === "field" ? "manage:reviewToolbar.filterFieldGroup" : "manage:reviewToolbar.filterGroup"),
				size: "sm",
				prefix: W("manage:reviewToolbar.group"),
				selectedKey: o || "*",
				onSelectionChange: (e) => {
					e !== null && s(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, $.jsx)(T, {
					id: "*",
					children: W("manage:shared.all")
				}), a.map((e) => /* @__PURE__ */ (0, $.jsx)(T, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			y ? null : /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: xe,
				"aria-pressed": E,
				disabled: f,
				onClick: () => {
					let e = new Set(u);
					for (let t of c) E ? e.delete(t) : e.add(t);
					d(e);
				},
				children: W(E ? "manage:reviewToolbar.clearSelection" : o ? "manage:reviewToolbar.selectGroup" : "manage:reviewToolbar.selectPage")
			}),
			y || l.length <= c.length || ae ? null : /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: f,
				onClick: () => d(/* @__PURE__ */ new Set([...u, ...l])),
				children: W("manage:reviewToolbar.selectAll", { count: l.length })
			})
		] }) : null
	}), /* @__PURE__ */ (0, $.jsxs)(D, {
		label: W("manage:reviewToolbar.selectedDock"),
		visible: !y && u.size > 0,
		count: W("manage:reviewToolbar.selectedCount", { count: u.size }),
		actions: h,
		leading: k && g !== "ignored" ? /* @__PURE__ */ (0, $.jsxs)(w, {
			"aria-label": W("manage:reviewToolbar.sourceForAll"),
			size: "sm",
			selectedKey: "",
			isDisabled: f || !O.length,
			onSelectionChange: (e) => {
				e !== null && e !== "" && ne(String(e));
			},
			children: [/* @__PURE__ */ (0, $.jsx)(T, {
				id: "",
				children: A
			}), O.map((e) => /* @__PURE__ */ (0, $.jsx)(T, {
				id: e,
				children: e
			}, e))]
		}) : null,
		children: [/* @__PURE__ */ (0, $.jsx)(r, {
			variant: "ghost",
			size: "small",
			disabled: f,
			onClick: he,
			children: W("manage:reviewToolbar.deselect")
		}), p ? /* @__PURE__ */ (0, $.jsx)("p", {
			role: "status",
			className: "w-full text-body-2-regular text-text-secondary",
			children: p
		}) : null]
	})] });
}
// src/react/boardui/components/base/radio/radio.tsx
var lt = {
	sm: {
		dot: "size-3.5",
		inner: "size-[5px]",
		selected: "bg-gradient-to-b from-accent-500 to-accent-600 shadow-[inset_0px_0px_0px_0.875px_var(--color-accent-500),inset_0px_1.75px_0px_0px_rgba(255,255,255,0.25)]",
		border: "border-[0.875px]",
		gap: "gap-2",
		label: "text-body-2-medium"
	},
	md: {
		dot: "size-4",
		inner: "size-1.5",
		selected: "bg-gradient-to-b from-accent-500 to-accent-600 shadow-[inset_0px_0px_0px_1px_var(--color-accent-500),inset_0px_2px_0px_0px_rgba(255,255,255,0.25)]",
		border: "border",
		gap: "gap-2",
		label: "text-body-medium"
	}
};
function ut({ selected: e = !1, size: t = "sm", focusVisible: n = !1, className: r }) {
	let i = lt[t];
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		"aria-hidden": !0,
		className: I("relative flex shrink-0 items-center justify-center rounded-full", i.dot, n && "ring-2 ring-border-focus-ring ring-offset-2", r),
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", { className: I("absolute inset-0 rounded-full border-border-checkbox-default bg-background-primary-default shadow-xs", "transition-opacity duration-200 ease", i.border, e && "opacity-0") }),
			/* @__PURE__ */ (0, $.jsx)("span", { className: I("absolute inset-0 rounded-full", "transition-opacity duration-200 ease", i.selected, !e && "opacity-0") }),
			/* @__PURE__ */ (0, $.jsx)("span", { className: I("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-control-indicator-background", "transition-[scale,opacity] duration-200 ease", i.inner, e ? "scale-100 opacity-100" : "scale-0 opacity-0") })
		]
	});
}
function dt({ className: e, children: n, ref: r, ...i }) {
	return /* @__PURE__ */ (0, $.jsx)(t, {
		ref: r,
		...i,
		className: (t) => I("flex flex-col gap-2", typeof e == "function" ? e(t) : e),
		children: n
	});
}
// src/react/boardui/components/base/radio/radio-card.tsx
function ft({ className: e, title: t, description: r, ref: i, ...a }) {
	return /* @__PURE__ */ (0, $.jsx)(n, {
		ref: i,
		...a,
		className: (t) => I("group flex w-full items-center justify-between gap-3 rounded-2lg border border-border-button-default py-3 pe-5 ps-4 select-none", "transition-colors duration-150 ease", t.isHovered && !t.isDisabled ? "bg-background-primary-hover" : "bg-background-primary-default", t.isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", typeof e == "function" ? e(t) : e),
		children: (e) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			className: "flex min-w-0 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: t
			}), r != null && /* @__PURE__ */ (0, $.jsx)("span", {
				className: "truncate text-body-regular text-text-secondary",
				children: r
			})]
		}), /* @__PURE__ */ (0, $.jsx)("span", {
			className: "flex shrink-0 items-center py-1",
			children: /* @__PURE__ */ (0, $.jsx)(ut, {
				size: "md",
				selected: e.isSelected,
				focusVisible: e.isFocusVisible
			})
		})] })
	});
}
// src/react/review/candidate-form.tsx
var pt = {
	title: W("manage:shared.title"),
	original_title: W("manage:reviewCandidate.originalTitle"),
	runtime: W("manage:reviewCandidate.sourceRuntime"),
	director: W("manage:reviewCandidate.director"),
	label: "Label",
	poster_url: W("manage:reviewCandidate.poster"),
	cover_url: W("manage:shared.cover"),
	screenshot_urls: W("manage:reviewCandidate.screenshots"),
	trailer_url: W("manage:reviewCandidate.trailer")
}, mt = "reviewgenretags";
function ht({ tags: e }) {
	return e.length ? /* @__PURE__ */ (0, $.jsx)("datalist", {
		id: mt,
		children: e.map((e) => /* @__PURE__ */ (0, $.jsx)("option", { value: e }, e))
	}) : null;
}
function gt({ candidate: e, row: t }) {
	let [n, i] = (0, q.useState)(!1), a = (0, q.useId)(), o = Object.entries(e.catalog_evidence || {}).filter(([, e]) => e && e.display_value);
	return o.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, $.jsxs)(r, {
			variant: "secondary",
			size: "small",
			leadingIcon: c,
			"aria-expanded": n,
			"aria-controls": a,
			"aria-label": W(n ? "manage:reviewCandidate.collapseEvidence" : "manage:reviewCandidate.expandEvidence", { source: e.source || W("manage:reviewCandidate.thisSource") }),
			onClick: () => i(!n),
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				"data-copy-key": "review.card.source_evidence",
				children: W("manage:reviewCandidate.sourceEvidence")
			}), ` · ${o.length}`]
		}), /* @__PURE__ */ (0, $.jsx)(l, {
			id: a,
			open: n,
			children: /* @__PURE__ */ (0, $.jsx)("dl", {
				className: "flex min-w-0 flex-col gap-2 px-3 pt-2 pb-1",
				children: o.map(([n, r]) => /* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex min-w-0 flex-wrap gap-x-2",
					children: [
						/* @__PURE__ */ (0, $.jsx)("dt", {
							className: "text-caption-1-regular text-text-tertiary",
							children: pt[n] || n
						}),
						/* @__PURE__ */ (0, $.jsx)("dd", {
							className: "min-w-0 text-body-2-regular break-words text-text-primary",
							children: /* @__PURE__ */ (0, $.jsx)(K, {
								value: P(r, "display_value"),
								reference: n === t.field && t.current_value ? t.current_value : P(t.candidates?.find((t) => t.candidate_key !== e.candidate_key && t.catalog_evidence?.[n]?.display_value)?.catalog_evidence?.[n], "display_value")
							})
						}),
						U(r.warnings, r.warning_codes, r.warning_params).map((e) => /* @__PURE__ */ (0, $.jsx)("small", {
							className: "w-full text-caption-1-regular text-status-yellow-text",
							children: e
						}, e))
					]
				}, n))
			})
		})]
	}) : null;
}
function _t(e) {
	let t = e.content_id || e.provider_id;
	return `${e.source || W("manage:reviewQueue.unspecifiedSource")}${e.official ? ` · ${W("manage:reviewCandidate.officialFirst")}` : ""}${t ? ` · ID ${t}` : ""}`;
}
function vt({ candidate: e, reference: t }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-2 whitespace-normal wrap-anywhere",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-regular text-text-primary",
			children: /* @__PURE__ */ (0, $.jsx)(K, {
				value: e.display_value || "",
				reference: t
			})
		}), U(e.warnings, e.warning_codes, e.warning_params).map((e) => /* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-2-regular text-status-yellow-text",
			children: e
		}, e))]
	});
}
function yt({ row: e, fieldName: t, value: n, onChange: r, locked: i }) {
	let a = e.candidates || [];
	return a.length ? a.length === 1 ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-2",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-2 rounded-2lg bg-background-primary-default px-4 py-3",
			children: [/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-medium text-text-primary",
				children: _t(a[0])
			}), /* @__PURE__ */ (0, $.jsx)(vt, {
				candidate: a[0],
				reference: e.current_value || void 0
			})]
		}), /* @__PURE__ */ (0, $.jsx)(gt, {
			candidate: a[0],
			row: e
		})]
	}) : /* @__PURE__ */ (0, $.jsx)(dt, {
		"aria-label": W("manage:reviewCandidate.sourceFor", { field: t || W("manage:scanFetch.slowWhatMetadata") }),
		value: n,
		isDisabled: i,
		onChange: r,
		children: /* @__PURE__ */ (0, $.jsx)("div", {
			className: "flex min-w-0 flex-col gap-3",
			children: a.map((t) => /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, $.jsx)(ft, {
					value: t.candidate_key,
					className: "relative items-start",
					title: /* @__PURE__ */ (0, $.jsx)("span", {
						title: _t(t),
						children: _t(t)
					}),
					description: /* @__PURE__ */ (0, $.jsx)(vt, {
						candidate: t,
						reference: e.current_value || a.find((e) => e.candidate_key !== t.candidate_key)?.display_value
					})
				}), /* @__PURE__ */ (0, $.jsx)(gt, {
					candidate: t,
					row: e
				})]
			}, t.candidate_key))
		})
	}) : null;
}
function bt({ genre: e, tags: t, locked: n, toast: i }) {
	let [a, o] = (0, q.useState)(""), [s, c] = (0, q.useState)(""), l = Be({
		mutationFn: (t) => De(e, t),
		onSuccess: async (t, n) => {
			t.ok ? (i(n ? W("manage:reviewCandidate.mapped", {
				genre: e,
				tag: n
			}) : W("manage:reviewCandidate.markedNonContent", { genre: e })), await Oe()) : c(t.error || W("manage:reviewCandidate.mapRejected"));
		},
		onError: (e) => c(L(e))
	}), u = () => {
		let e = a.trim();
		e ? (c(""), l.mutate(e)) : c(W("manage:reviewCandidate.tagRequired"));
	};
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, $.jsx)("b", {
				lang: "ja",
				className: "text-body-medium text-text-primary",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsx)(O, {
				"aria-label": W("manage:reviewCandidate.tagFor", { genre: e }),
				value: a,
				onChange: o,
				maxLength: 40,
				isDisabled: n || l.isPending,
				className: "min-w-40 flex-1",
				children: /* @__PURE__ */ (0, $.jsx)(g, {
					size: "small",
					list: t.length ? mt : void 0,
					autoComplete: "off",
					placeholder: W("manage:reviewCandidate.tagPlaceholder"),
					onKeyDown: (e) => {
						e.key !== "Enter" || F(e.nativeEvent) || (e.preventDefault(), u());
					}
				})
			}),
			/* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: u,
				children: W("manage:reviewCandidate.map")
			}),
			/* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: () => {
					c(""), l.mutate("");
				},
				children: W("manage:reviewCandidate.notContent")
			}),
			s ? /* @__PURE__ */ (0, $.jsx)("p", {
				role: "status",
				className: "w-full text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function xt({ row: e, tags: t, locked: n, toast: r }) {
	let i = Te(e);
	return i.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
		role: "group",
		"aria-label": W("manage:reviewCandidate.unmappedGenres"),
		className: "flex flex-col gap-2 border-t border-separator-border pt-4",
		children: [/* @__PURE__ */ (0, $.jsx)("h5", {
			className: "text-body-2-medium text-text-secondary",
			children: W("manage:reviewCandidate.unmappedGenresCount", { count: i.length })
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			role: "list",
			className: "flex flex-col",
			children: i.map((e, i) => /* @__PURE__ */ (0, $.jsx)("div", {
				role: "listitem",
				className: `py-3 first:pt-0 last:pb-0 ${i ? "border-t border-separator-border" : ""}`,
				children: /* @__PURE__ */ (0, $.jsx)(bt, {
					genre: e,
					tags: t,
					locked: n,
					toast: r
				})
			}, e))
		})]
	}) : null;
}
// src/react/review/review-evidence.tsx
var St = (e = "") => /^https?:\/\//i.test(e) ? e : "", Ct = (e = "") => St(e) || (e.startsWith("/") && !e.startsWith("//") ? e : "");
function wt({ url: e }) {
	let t = Ct(e || "");
	return /* @__PURE__ */ (0, $.jsx)(Tt, { source: t }, t);
}
function Tt({ source: e }) {
	let [t, n] = (0, q.useState)("idle");
	return (0, q.useEffect)(() => {
		if (t !== "loading") return;
		let e = setTimeout(() => n("failed"), 3e4);
		return () => clearTimeout(e);
	}, [t]), /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "relative flex h-review-image items-center justify-center overflow-hidden rounded-surface bg-background-secondary-default",
		children: [t === "loading" ? /* @__PURE__ */ (0, $.jsx)("span", {
			role: "status",
			"aria-busy": "true",
			"aria-label": W("manage:reviewEvidence.loadingImage"),
			"data-skeleton": "",
			className: "absolute inset-0 skeleton-sheen"
		}) : null, e && (t === "loading" || t === "ready") ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: e,
			alt: W("manage:reviewEvidence.candidateImageAlt"),
			referrerPolicy: "no-referrer",
			decoding: "async",
			className: `size-full object-contain ${t === "loading" ? "invisible" : ""}`,
			onLoad: () => n("ready"),
			onError: () => n("failed")
		}) : e ? /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex flex-col items-center gap-2",
			children: [t === "failed" ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-body-2-regular text-text-secondary",
				children: W("manage:reviewEvidence.imageNotFound")
			}) : null, /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				"aria-label": t === "failed" ? W("manage:reviewEvidence.retryImage") : void 0,
				onClick: () => n("loading"),
				children: W(t === "failed" ? "manage:shared.retryNow" : "manage:reviewEvidence.viewImage")
			})]
		}) : /* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-2-regular text-text-secondary",
			children: W("manage:reviewEvidence.imageNotFound")
		})]
	});
}
function Et({ asset: t, openItem: n }) {
	let i = t.name || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsxs)("button", {
			type: "button",
			onClick: () => n(t.id),
			className: "flex aspect-card-cover w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2lg bg-media-placeholder outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
			children: [t.preview_url ? /* @__PURE__ */ (0, $.jsx)("img", {
				src: t.preview_url,
				alt: "",
				loading: "lazy",
				className: "size-full object-cover"
			}) : /* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-caption-1-regular text-text-secondary",
				children: W("manage:shared.noCover")
			}), /* @__PURE__ */ (0, $.jsx)(e, { children: W("manage:reviewEvidence.openOriginalNamed", { name: i }) })]
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start gap-1",
			children: [/* @__PURE__ */ (0, $.jsx)("b", {
				title: i,
				className: "w-full truncate text-body-medium text-text-primary",
				children: t.code || i || W("manage:reviewEvidence.originalVideo")
			}), /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: h,
				onClick: () => n(t.id),
				children: W("manage:reviewEvidence.openOriginal")
			})]
		})]
	});
}
function Dt({ kind: e, name: t, works: n, avatar: r, openEntity: i }) {
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsx)("button", {
			type: "button",
			"aria-label": W("manage:reviewEvidence.openCreator", { name: t }),
			onClick: () => i(e, t),
			className: `relative inline-grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring ${_}`,
			dangerouslySetInnerHTML: { __html: r }
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start",
			children: [/* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				onClick: () => i(e, t),
				className: "max-w-full cursor-pointer truncate text-body-medium text-text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring",
				children: t
			}), n ? /* @__PURE__ */ (0, $.jsx)("small", {
				className: "tabular-nums text-body-2-regular text-text-secondary",
				children: W("manage:reviewEvidence.videoCount", { count: n })
			}) : null]
		})]
	});
}
function Ot({ row: e, openItem: t, openEntity: n, onReveal: a, revealing: o, note: s }) {
	let c = St(e.profile_url || ""), l = (e.preview_assets || []).slice(0, 6), u = Math.max(0, Number(e.video_count || e.videos || 0));
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, $.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: W("manage:reviewEvidence.pendingPerson", { name: e.babepedia_name || W("manage:reviewEvidence.unlabeled") })
			}),
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [c ? /* @__PURE__ */ (0, $.jsx)(i, {
					variant: "secondary",
					size: "small",
					trailingIcon: k,
					href: c,
					target: "_blank",
					rel: "noopener noreferrer",
					children: W("manage:reviewEvidence.sourceProfile")
				}) : null, /* @__PURE__ */ (0, $.jsx)(r, {
					variant: "secondary",
					size: "small",
					onClick: () => n("creator", e.creator || ""),
					children: W("manage:reviewEvidence.viewAllVideos", { count: u })
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(wt, { url: e.preview_url }),
			l.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: W("manage:reviewEvidence.localSamples")
			}), /* @__PURE__ */ (0, $.jsx)("ul", {
				className: "flex flex-col gap-1",
				children: l.map((e) => /* @__PURE__ */ (0, $.jsxs)("li", {
					className: "flex min-w-0 items-center gap-2",
					children: [/* @__PURE__ */ (0, $.jsx)(r, {
						variant: "ghost",
						size: "small",
						className: "min-w-0",
						onClick: () => t(e.id),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							title: e.name,
							className: "block max-w-full truncate",
							children: e.name
						})
					}), /* @__PURE__ */ (0, $.jsx)(r, {
						variant: "ghost",
						size: "small",
						"aria-label": W("manage:reviewEvidence.revealNamed", { name: e.name }),
						...N(o === e.id),
						onClick: () => a(e.id),
						children: W("manage:reviewEvidence.fileLocation")
					})]
				}, e.id))
			})] }) : /* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: W("manage:reviewEvidence.noLocalSamples")
			}),
			s ? /* @__PURE__ */ (0, $.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function kt({ assets: t, picked: n, onPicked: r, locked: i }) {
	let [a, s] = (0, q.useState)(null), c = new Set(n), l = (e, n) => {
		if (i) return;
		let o = new Set(c);
		if (n && a !== null) {
			let [n, r] = [Math.min(a, e), Math.max(a, e)];
			for (let e = n; e <= r; e++) o.add(t[e].id);
		} else {
			let n = t[e].id;
			o.has(n) ? o.delete(n) : o.add(n);
		}
		s(e), r(t.filter((e) => o.has(e.id)).map((e) => e.id));
	};
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, $.jsx)(E, {
			prefix: /* @__PURE__ */ (0, $.jsx)("span", {
				className: "tabular-nums text-body-2-regular text-text-secondary",
				children: W("manage:reviewEvidence.selectedOfTotal", {
					count: c.size,
					total: t.length
				})
			}),
			actions: [{
				label: W("manage:shared.selectAll"),
				disabled: i,
				onPress: () => r(t.map((e) => e.id))
			}, {
				label: W("manage:reviewEvidence.clearSelection"),
				disabled: i,
				onPress: () => r([])
			}]
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			className: "review-asset-grid gap-1.5",
			children: t.map((t, n) => {
				let r = c.has(t.id);
				return /* @__PURE__ */ (0, $.jsxs)("button", {
					type: "button",
					"aria-pressed": r,
					title: t.name,
					onClick: (e) => l(n, e.shiftKey),
					className: `relative aspect-card-cover cursor-pointer overflow-hidden rounded-surface bg-media-placeholder outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-border-focus-ring ${r ? "opacity-100 ring-2 ring-border-button-active ring-inset" : "opacity-50"}`,
					children: [
						/* @__PURE__ */ (0, $.jsx)("img", {
							src: `/poster?id=${t.id}&c=4`,
							alt: "",
							loading: "lazy",
							className: "size-full object-cover"
						}),
						/* @__PURE__ */ (0, $.jsx)("span", {
							className: "absolute top-1 right-1",
							children: /* @__PURE__ */ (0, $.jsx)(o, {
								size: "sm",
								state: {
									isSelected: r,
									isIndeterminate: !1,
									isFocusVisible: !1,
									isDisabled: i,
									isHovered: !1
								}
							})
						}),
						/* @__PURE__ */ (0, $.jsx)(e, { children: W(r ? "manage:reviewEvidence.assetSelected" : "manage:reviewEvidence.assetUnselected", { name: t.name || t.id }) })
					]
				}, t.id);
			})
		})]
	});
}
// src/react/review/review-card.tsx
var At = ce({
	variant: "filled",
	padding: "none",
	className: "flex flex-col overflow-hidden"
}), jt = "flex min-h-6 min-w-0 items-center", Mt = 2, Nt = (e) => e === "western_identity" ? "h-review-card-tall" : "h-review-card";
function Pt(e) {
	let { category: t, row: n, choice: i, onChoice: o, selected: c, onSelect: l, locked: u, busy: d, problem: p, genreTags: m, onDecide: h, handlers: g, queueView: _ = "pending" } = e, y = (0, q.useRef)(!1), b = He(), x = t === "metadata_fields", S = ee[t] || "", ie = String(n.creator || "").trim(), C = !!S && !!ie, w = H(t, n), T = V(t, n), E = Pe(t, n), D = B(n), ae = Fe(n), O = se(t, n), k = n.comparison_assets || [], A = n.preview_assets || [], j = re[n.decision || ""], M = k.length > 1 ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [k.slice(0, Mt).map((e) => /* @__PURE__ */ (0, $.jsx)(Et, {
			asset: e,
			openItem: g.openItem
		}, e.id)), k.length > Mt ? /* @__PURE__ */ (0, $.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: W("manage:reviewCard.moreComparison", { count: k.length - Mt })
		}) : null]
	}) : C ? /* @__PURE__ */ (0, $.jsx)(Dt, {
		kind: S,
		name: ie,
		works: Number(n.video_count || n.videos || 0),
		openEntity: g.openEntity,
		avatar: oe(ie, n.entity_id ? {
			id: n.entity_id,
			has_image: !!n.has_image,
			image_version: n.image_version,
			avatar_focus: n.avatar_focus
		} : null, null, S)
	}) : n.asset_id ? /* @__PURE__ */ (0, $.jsx)(Et, {
		openItem: g.openItem,
		asset: {
			id: n.asset_id,
			name: n.asset_name,
			code: n.code,
			preview_url: n.asset_preview_url
		}
	}) : null, ce = x ? /* @__PURE__ */ (0, $.jsx)(yt, {
		row: n,
		fieldName: T,
		value: i.candidateKey,
		onChange: (e) => o({
			...i,
			candidateKey: e
		}),
		locked: u
	}) : t === "creator_tags" ? A.length ? /* @__PURE__ */ (0, $.jsx)(kt, {
		assets: A,
		picked: i.assets,
		locked: u,
		onPicked: (e) => o({
			...i,
			assets: e
		})
	}) : /* @__PURE__ */ (0, $.jsx)(f, {
		size: "compact",
		icon: te,
		title: W("manage:reviewCard.noFramesTitle"),
		children: n.video_count ? W("manage:reviewCard.noFramesBody", { count: n.video_count }) : W("manage:reviewCard.noFramesBodyUncounted")
	}) : t === "fc2_similarity" ? null : t === "western_identity" ? /* @__PURE__ */ (0, $.jsx)(Ot, {
		row: n,
		openItem: g.openItem,
		openEntity: g.openEntity,
		onReveal: g.onReveal,
		revealing: g.revealing,
		note: g.revealNote
	}) : /* @__PURE__ */ (0, $.jsx)(wt, { url: n.preview_url }), P = C ? M : T ? /* @__PURE__ */ (0, $.jsxs)("h4", {
		className: I(jt, "flex-wrap gap-2"),
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			title: T,
			className: "flex max-w-full min-w-0 overflow-hidden rounded-md",
			children: /* @__PURE__ */ (0, $.jsx)(s, {
				variant: "caption",
				color: "neutral",
				children: T
			})
		}), /* @__PURE__ */ (0, $.jsx)("span", {
			title: E,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: E
		})]
	}) : /* @__PURE__ */ (0, $.jsx)("h4", {
		className: jt,
		children: /* @__PURE__ */ (0, $.jsx)("span", {
			title: w,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: w
		})
	});
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-label": w,
		"data-review-key": n.item_key,
		className: I(At, Nt(t)),
		children: [
			/* @__PURE__ */ (0, $.jsxs)("header", {
				className: "flex min-w-0 shrink-0 items-center gap-2 border-b border-separator-border px-5 py-4",
				children: [
					u ? null : /* @__PURE__ */ (0, $.jsx)("span", {
						className: I(jt, "shrink-0"),
						onPointerDownCapture: (e) => {
							y.current = e.shiftKey;
						},
						onKeyDownCapture: (e) => {
							y.current = e.shiftKey;
						},
						children: /* @__PURE__ */ (0, $.jsx)(a, {
							isSelected: c,
							"aria-label": W("manage:reviewCard.selectItem", { title: w }),
							onChange: (e) => l(y.current, e)
						})
					}),
					/* @__PURE__ */ (0, $.jsx)("div", {
						className: "min-w-0 flex-1",
						children: P
					}),
					j ? /* @__PURE__ */ (0, $.jsx)(s, {
						variant: "caption",
						color: "neutral",
						children: j
					}) : null
				]
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				className: "relative mx-5 flex min-w-0 min-h-0 flex-1 flex-col",
				children: /* @__PURE__ */ (0, $.jsxs)("div", {
					ref: b,
					className: "flex min-w-0 min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4",
					children: [
						n.source_name ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: W("manage:reviewCard.sourceSpelling", { name: n.source_name })
						}) : null,
						!C && (n.board || n.assets) ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: W("manage:reviewCard.comparisonFiles", { count: Number(n.video_count || n.assets || 0) })
						}) : null,
						!C && M ? M : null,
						x && (D || n.current_value !== void 0) ? /* @__PURE__ */ (0, $.jsxs)("div", {
							role: "region",
							"aria-label": W("manage:reviewCard.currentInfo"),
							className: "flex min-w-0 flex-col gap-1 border-b border-separator-border pb-4",
							children: [
								/* @__PURE__ */ (0, $.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, $.jsx)("h5", {
										"data-copy-key": "review.card.current_value",
										className: "text-caption-1-medium text-text-secondary",
										children: W("manage:reviewCard.currentValue")
									}), n.current_owner?.startsWith("user:") || n.current_owner?.startsWith("review:") ? /* @__PURE__ */ (0, $.jsx)(s, {
										variant: "caption",
										color: "neutral",
										children: W("manage:reviewCard.manuallyConfirmed")
									}) : null]
								}),
								/* @__PURE__ */ (0, $.jsx)("p", {
									className: "text-body-2-regular text-text-primary wrap-anywhere",
									children: n.current_value === void 0 ? D : n.current_value ? /* @__PURE__ */ (0, $.jsx)(K, {
										value: n.current_value,
										reference: (n.candidates?.find((e) => e.candidate_key === i.candidateKey) || n.candidates?.[0])?.display_value
									}) : W("manage:reviewCard.noMetadata")
								}),
								n.videos === void 0 ? null : /* @__PURE__ */ (0, $.jsx)("p", {
									className: "text-caption-1-regular text-text-secondary",
									children: W(n.asset_path ? "manage:reviewCard.matchingFiles" : "manage:reviewCard.sameCodeFiles", { count: Number(n.videos) })
								})
							]
						}) : null,
						ae.length || t === "creator_tags" ? /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: ae.length ? ae.map((e) => /* @__PURE__ */ (0, $.jsx)(s, {
								variant: "caption",
								color: "soft",
								children: e
							}, e)) : /* @__PURE__ */ (0, $.jsx)("small", {
								className: "text-body-2-regular text-text-secondary",
								children: W("manage:reviewCard.noPendingTags")
							})
						}) : null,
						x ? /* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, $.jsxs)("h5", {
								className: "text-caption-1-medium text-text-secondary",
								children: [/* @__PURE__ */ (0, $.jsx)("span", {
									"data-copy-key": "review.card.candidate_sources",
									children: W("manage:reviewCard.candidateSources")
								}), ` · ${n.candidates?.length || 0}`]
							}), n.current_value || (n.candidates?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-copy-key": n.current_value ? "review.card.compare_current" : "review.card.compare_sources",
								className: "text-caption-1-regular text-text-tertiary",
								children: n.current_value ? W("manage:reviewCard.comparedToCurrent") : W("manage:reviewCard.sourceDifferences")
							}) : null]
						}) : null,
						ce,
						/* @__PURE__ */ (0, $.jsx)(xt, {
							row: n,
							tags: m,
							locked: u,
							toast: g.toast
						}),
						!x && D ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary wrap-anywhere",
							children: D
						}) : null
					]
				})
			}),
			/* @__PURE__ */ (0, $.jsxs)("footer", {
				className: I(ne.stack, "shrink-0"),
				children: [
					_ === "ignored" ? null : /* @__PURE__ */ (0, $.jsx)(v, {
						variant: "secondary",
						size: "small",
						className: "me-auto",
						disabled: u,
						...N(d),
						onClick: () => h("rejected"),
						children: W("manage:shared.ignore")
					}),
					_ === "pending" ? /* @__PURE__ */ (0, $.jsx)(r, {
						variant: "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => h("skipped"),
						children: W("manage:reviewDecision.later")
					}) : /* @__PURE__ */ (0, $.jsx)(r, {
						variant: _ === "ignored" ? "primary" : "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => h("restore"),
						children: W("manage:reviewDecision.moveToPending")
					}),
					_ === "ignored" ? null : /* @__PURE__ */ (0, $.jsx)(r, {
						variant: "primary",
						size: "small",
						disabled: u || !O,
						...N(d),
						title: O ? void 0 : W("manage:reviewCard.cannotApproveHint"),
						onClick: () => h("approved"),
						children: W(O ? "manage:reviewDecision.approve" : "manage:reviewCard.cannotApprove")
					}),
					p ? /* @__PURE__ */ (0, $.jsx)("p", {
						role: "status",
						className: "w-full text-body-2-regular text-text-error-primary",
						children: p
					}) : null
				]
			})
		]
	});
}
// src/react/review/review-page.tsx
var Ft = "flex cursor-pointer items-center justify-between gap-2";
function It(e) {
	let t = Ve("review").keys.filter(ye), [n, i] = (0, q.useState)(() => matchMedia("(max-width:900px)").matches);
	(0, q.useEffect)(() => {
		let e = matchMedia("(max-width:900px)"), t = () => i(e.matches);
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let { route: a, openItem: o, openEntity: s, revealSource: c, toast: l, readOnly: ee, readOnlyMessage: te, writerUrl: ne } = e, [m, h] = (0, q.useState)(ye(e.category) ? e.category : u), [g, _] = (0, q.useState)(() => Me(e.queue)), [v, re] = (0, q.useState)("candidates"), [C, w] = (0, q.useState)(""), [T, E] = (0, q.useState)(""), [D, O] = (0, q.useState)(1), [k, A] = (0, q.useState)(20), [j, M] = (0, q.useState)(/* @__PURE__ */ new Set());
	Ue(() => M(/* @__PURE__ */ new Set())), (0, q.useEffect)(() => {
		j.size && me();
	}, [j]);
	let [oe, N] = (0, q.useState)(/* @__PURE__ */ new Map()), [ce, P] = (0, q.useState)(/* @__PURE__ */ new Map()), [le, F] = (0, q.useState)(""), I = (0, q.useRef)(null), [he, be] = (0, q.useState)(0), [xe, Se] = (0, q.useState)(""), Te = (0, q.useRef)(!0);
	(0, q.useEffect)(() => () => {
		Te.current = !1;
	}, []);
	let R = We({
		queryKey: x,
		queryFn: ({ signal: e }) => ge(e)
	}), De = R.data || {
		sections: {},
		counts: {},
		queues: {
			later: {
				sections: {},
				counts: {}
			},
			ignored: {
				sections: {},
				counts: {}
			}
		}
	}, Oe = je(De, g), ke = R.data ? Object.fromEntries(ie.map((e) => [e, b.reduce((t, n) => t + Number(je(De, e).counts[n] || 0), 0)])) : void 0, z = Oe.sections[m] || [], B = m === "metadata_fields", V = ee;
	(0, q.useEffect)(() => {
		let e = new Set(z.map((e) => e.item_key));
		M((t) => {
			let n = [...t].filter((t) => e.has(t));
			return n.length === t.size ? t : new Set(n);
		}), N((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		}), P((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		});
	}, [z]);
	let Pe = (0, q.useMemo)(() => B ? ve(z, "field") : [], [z, B]), Fe = Pe.some((e) => e.key === T) ? T : "", H = (0, q.useMemo)(() => B ? _e(z, "field", Fe) : z, [
		z,
		B,
		Fe
	]), Le = (0, q.useMemo)(() => Ae(H, B), [H, B]), U = Le.some(([e]) => e === v) ? v : "candidates", He = (0, q.useMemo)(() => ve(H, U), [H, U]), Ge = He.some((e) => e.key === C) ? C : "", G = (0, q.useMemo)(() => _e(H, U, Ge), [
		H,
		U,
		Ge
	]), K = (0, q.useMemo)(() => Ne(G, D, k), [
		G,
		D,
		k
	]), qe = K.rows.map((e) => e.item_key), Je = new Set(qe), Ye = He.map((e) => ({
		...e,
		rows: e.rows.filter((e) => Je.has(e.item_key))
	})).filter((e) => e.rows.length), J = (e) => oe.get(e.item_key) || pe(e), Y = (0, q.useMemo)(() => z.filter((e) => j.has(e.item_key)), [z, j]), Xe = (e) => {
		let t = new Set(e);
		M((e) => new Set([...e].filter((e) => !t.has(e)))), N((e) => new Map([...e].filter(([e]) => !t.has(e)))), P((e) => new Map([...e].filter(([e]) => !t.has(e))));
	}, Ze = (e, t) => P((n) => new Map(n).set(e, t)), Qe = () => {
		re("candidates"), w(""), E(""), O(1), M(/* @__PURE__ */ new Set()), N(/* @__PURE__ */ new Map()), P(/* @__PURE__ */ new Map()), F(""), I.current = null;
	}, $e = (e) => {
		h(e), Qe(), a({
			category: e === "metadata_fields" ? "" : e,
			queue: g === "pending" ? "" : g
		});
	}, X = (e) => {
		_(e), Qe(), a({
			category: m === "metadata_fields" ? "" : m,
			queue: e === "pending" ? "" : e
		});
	}, Z = Be({
		mutationFn: ({ row: e, status: t, category: n }) => ze(de(n, ue(n, e), t, J(e))),
		onSuccess: (e, { row: t, status: n, category: r }) => {
			e.ok ? (Re(r, [t.item_key], n), Xe([t.item_key]), l(fe(n))) : Ze(t.item_key, e.error || W("manage:reviewPage.decisionRejected"));
		},
		onError: (e, { row: t }) => Ze(t.item_key, L(e))
	}), Q = Be({
		mutationFn: async ({ status: e, category: t, rows: n }) => {
			let r = [], i = [];
			for (let [a, o] of n.entries()) {
				if (!Te.current) break;
				F(W("manage:reviewPage.processingProgress", {
					current: a,
					total: n.length
				}));
				try {
					let n = await ze(de(t, ue(t, o), e, J(o)));
					if (!n.ok) throw Error(n.error || W("manage:reviewPage.itemNotAccepted"));
					r.push(o.item_key);
				} catch (e) {
					i.push([o.item_key, L(e)]);
				}
			}
			return {
				status: e,
				category: t,
				done: r,
				failures: i
			};
		},
		onSuccess: ({ status: e, category: t, done: n, failures: r }) => {
			Re(t, n, e), Xe(n), r.forEach(([e, t]) => Ze(e, t)), F("");
		},
		onError: (e) => {
			F(L(e));
		}
	}), et = {
		receipt: l,
		failure: (e) => F(L(e))
	}, tt = {
		ignored: "rejected",
		later: "skipped"
	}, nt = (e, t) => {
		let n = {
			done: [],
			failures: []
		};
		return {
			key: e,
			label: t,
			reversal: e === "approved" ? "irreversible" : "undo",
			danger: !1,
			confirm: (n) => {
				if (e === "approved" && B && n.some((e) => !J(e).candidateKey)) throw Error(W("manage:reviewPage.chooseSourceFirst"));
				return F(""), {
					title: t,
					body: W(`manage:reviewPage.confirm.${e}`, { count: n.length })
				};
			},
			run: async (t) => {
				n = await Q.mutateAsync({
					status: e,
					category: m,
					rows: [...t]
				});
				let { done: r } = n;
				if (e === "approved") return;
				let i = m, a = t.filter((e) => r.includes(e.item_key)), o = e === "restore" ? tt[g] : "restore";
				return async () => {
					for (let e of a) await ze(de(i, ue(i, e), o, J(e)));
					await Ee.invalidateQueries({ queryKey: x });
				};
			},
			receipt: () => W({
				approved: "manage:reviewPage.approvedCount",
				rejected: "manage:reviewPage.ignoredCount",
				skipped: "manage:reviewPage.laterCount",
				restore: "manage:reviewPage.pendingCount"
			}[e], { count: n.done.length }) + (n.failures.length ? W("manage:reviewPage.notCompletedSuffix", { count: n.failures.length }) : "")
		};
	}, rt = Y.every((e) => se(m, e)), it = [
		...g === "ignored" ? [] : [nt("rejected", W("manage:reviewToolbar.ignoreSelected"))],
		g === "pending" ? nt("skipped", W("manage:reviewToolbar.laterSelected")) : nt("restore", W("manage:reviewToolbar.restoreSelected")),
		...g === "ignored" ? [] : [nt("approved", W("manage:reviewToolbar.approveSelected"))]
	].map((e) => ({
		action: e,
		items: Y,
		host: et,
		disabled: Q.isPending || Z.isPending || e.key === "approved" && !rt
	})), at = (e) => {
		N((t) => {
			let n = new Map(t);
			for (let t of Y) {
				let r = t.candidates?.find((t) => t.source === e);
				r && n.set(t.item_key, {
					...J(t),
					candidateKey: r.candidate_key
				});
			}
			return n;
		}), F(W("manage:reviewPage.sourceChosen", { source: e }));
	}, ot = async (e) => {
		if (he) return;
		be(e), Se("");
		let t = await c(e);
		Te.current && (be(0), Se(t));
	}, lt = we(De.mirror, te), ut = De.genre_tags || [], dt = {
		openItem: o,
		openEntity: s,
		onReveal: ot,
		revealing: he,
		revealNote: xe,
		toast: l
	};
	return /* @__PURE__ */ (0, $.jsx)(Ke, { children: /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-5 pb-10",
		children: [
			V ? /* @__PURE__ */ (0, $.jsx)(y, {
				tone: "warning",
				title: W("manage:reviewPage.readOnly"),
				extra: ne ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: "text-body-2-regular",
					children: /* @__PURE__ */ (0, $.jsx)(p, {
						href: ne,
						children: W("manage:reviewPage.goToPrimary")
					})
				}) : void 0,
				children: lt
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(ht, { tags: ut }),
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-col gap-5 review-split:flex-row review-split:items-start review-split:gap-6",
				children: [/* @__PURE__ */ (0, $.jsxs)("div", {
					"data-section-nav": !0,
					className: "w-full min-w-0 review-split:sticky review-split:top-topbar review-split:w-review-tabs review-split:shrink-0",
					children: [/* @__PURE__ */ (0, $.jsx)("h2", {
						id: "reviewcategories",
						children: W("manage:reviewPage.categories")
					}), /* @__PURE__ */ (0, $.jsx)(ae, {
						group: "review",
						label: W("manage:reviewPage.categories"),
						value: m,
						onChange: $e,
						orientation: n ? "horizontal" : "vertical",
						panelPrefix: "review",
						sectionItems: !0,
						className: "",
						itemClassName: Ft,
						disabled: Z.isPending || Q.isPending,
						tabs: b.map((e) => {
							let t = Number(Oe.counts[e] || 0);
							return {
								value: e,
								label: S[e],
								badge: t ? /* @__PURE__ */ (0, $.jsx)("span", {
									className: "tabular-nums text-caption-1-medium text-text-secondary",
									children: t.toLocaleString()
								}) : null
							};
						})
					})]
				}), /* @__PURE__ */ (0, $.jsxs)("div", {
					role: "tabpanel",
					id: `review-panel-${m}`,
					"aria-labelledby": `review-tab-${m}`,
					className: "flex min-w-0 flex-1 flex-col gap-5",
					children: [
						/* @__PURE__ */ (0, $.jsx)(ct, {
							queueView: g,
							queueCounts: ke,
							onQueueChange: X,
							locked: V,
							fields: Pe,
							fieldFilter: Fe,
							onFieldFilter: (e) => {
								E(e), w(""), O(1);
							},
							groupOptions: Le,
							groupBy: U,
							onGroupBy: (e) => {
								re(e), w(""), O(1);
							},
							groups: He,
							filter: Ge,
							onFilter: (e) => {
								w(e), O(1);
							},
							pageKeys: qe,
							allKeys: G.map((e) => e.item_key),
							selected: j,
							onSelected: M,
							selectedRows: Y,
							metadata: B,
							busy: Q.isPending || Z.isPending,
							feedback: le,
							onUnifySource: at,
							actions: it
						}),
						K.rows.length ? Ye.map((e) => /* @__PURE__ */ (0, $.jsxs)("section", {
							className: "flex flex-col gap-3",
							children: [Ye.length > 1 || U !== "candidates" ? /* @__PURE__ */ (0, $.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, $.jsx)("h3", {
									className: "text-body-medium text-text-primary",
									children: `${e.title} · ${e.rows.length}`
								}), V ? null : /* @__PURE__ */ (0, $.jsx)(r, {
									variant: "ghost",
									size: "small",
									onClick: () => {
										let t = e.rows.map((e) => e.item_key), n = t.every((e) => j.has(e)), r = new Set(j);
										for (let e of t) n ? r.delete(e) : r.add(e);
										M(r);
									},
									children: e.rows.every((e) => j.has(e.item_key)) ? W("manage:reviewPage.clearGroup") : W("manage:reviewPage.selectGroup")
								})]
							}) : null, /* @__PURE__ */ (0, $.jsx)("div", {
								className: "review-grid gap-5",
								children: e.rows.map((e) => /* @__PURE__ */ (0, $.jsx)(Pt, {
									category: m,
									row: e,
									queueView: g,
									choice: J(e),
									onChoice: (t) => N((n) => new Map(n).set(e.item_key, t)),
									selected: j.has(e.item_key),
									onSelect: (t, n) => M((r) => {
										let i = new Set(r);
										return I.current = Ie(i, qe, I.current, e.item_key, t, n), i;
									}),
									locked: V,
									busy: Q.isPending || Z.isPending && Z.variables?.row.item_key === e.item_key,
									problem: ce.get(e.item_key) || "",
									genreTags: ut,
									onDecide: (t) => {
										Z.isPending || Q.isPending || (P((t) => new Map([...t].filter(([t]) => t !== e.item_key))), Z.mutate({
											row: e,
											status: t,
											category: m
										}));
									},
									handlers: dt
								}, e.item_key))
							})]
						}, e.key)) : R.isError && !R.data ? /* @__PURE__ */ (0, $.jsx)(y, {
							tone: "error",
							title: W("manage:reviewPage.queueLoadFailed"),
							action: /* @__PURE__ */ (0, $.jsx)(r, {
								variant: "secondary",
								size: "small",
								disabled: R.isFetching,
								onClick: () => void R.refetch(),
								children: W("manage:shared.retryNow")
							}),
							children: L(R.error)
						}) : /* @__PURE__ */ (0, $.jsx)(f, {
							icon: Ce,
							title: W({
								pending: "manage:reviewPage.emptyPending",
								later: "manage:reviewPage.emptyLater",
								ignored: "manage:reviewPage.emptyIgnored"
							}[g]),
							actions: b.some((e) => e !== m && Number(Oe.counts[e] || 0) > 0) ? /* @__PURE__ */ (0, $.jsx)(r, {
								size: "small",
								onClick: () => {
									let e = t.find((e) => e !== m && Number(Oe.counts[e] || 0) > 0);
									e && $e(e);
								},
								children: W("manage:reviewPage.viewOtherCategories")
							}) : void 0,
							children: W(g === "pending" ? "manage:reviewPage.switchCategoryHint" : g === "later" ? "manage:reviewPage.laterKeptHint" : "manage:reviewPage.ignoredKeptHint")
						}),
						G.length ? /* @__PURE__ */ (0, $.jsx)(d, {
							label: W("manage:reviewPage.footerLabel"),
							total: G.length,
							pagination: {
								pageIndex: K.page - 1,
								pageSize: k
							},
							onChange: (e) => {
								O(e.pageIndex + 1), A(e.pageSize);
							}
						}) : null,
						B && g === "pending" ? /* @__PURE__ */ (0, $.jsx)(st, {
							locked: V,
							openItem: o,
							toast: l
						}) : null
					]
				})]
			})
		]
	}) });
}
export { It as ReviewPage };

//# debugId=e7069e5f-3a16-4d1a-9919-904d46225a61