(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "5ab8ce5a-87ff-400d-80b8-0912ee9080fb", e._sentryDebugIdIdentifier = "sentry-dbid-5ab8ce5a-87ff-400d-80b8-0912ee9080fb");
	} catch {}
})();
import { $ea3928288112382f$export$439d29a4e110a164 as e, $fe21c36db05242bb$export$a98f0dcb43a68a25 as t, $fe21c36db05242bb$export$d7b12c4107be0d61 as n, Button as r, ButtonLink as i, Checkbox as a, CheckboxGlyph as o, Chip as s, CollapseChevron as c, CollapseRegion as l, DEFAULT_CATEGORY as u, DataTableFooter as d, ENTITY_REVIEW_KINDS as ee, Ea as te, EmptyState as f, ExternalLink as ne, FIELDSET_FOOT as re, FilterGlassRows as p, Gg as ie, InputBase as m, LEGACY_AVATAR_IMG as h, LinkButton as ae, Note as g, REVIEW_CATEGORIES as _, REVIEW_DECISION_LABELS as oe, REVIEW_KEY as se, REVIEW_LABELS as v, REVIEW_QUEUES as y, REVIEW_QUEUE_LABELS as b, Select as x, SelectItem as S, SelectionActions as C, SelectionDock as ce, SortableBoardTabs as w, TextField as T, Wt as E, Xf as le, Yt as D, __toESM as O, apiGet as k, apiSend as A, avatarInner as ue, b1 as j, busyProps as M, canApprove as de, cardClass as N, codedText as P, commonReviewSources as fe, composingKey as F, currentReviewRow as I, cx as L, decisionPayload as pe, decisionReceipt as me, defaultChoice as he, enterPageSelection as ge, errorMessage as R, exitPageSelection as _e, fetchReview as ve, filterReviewRows as ye, gB as be, groupReviewRows as xe, isReviewCategory as Se, joinList as z, l7 as Ce, localTime as we, m7 as Te, mirrorText as Ee, pendingGenres as De, queryClient as Oe, quoted as B, recordGenre as V, reloadReview as H, require_jsx_runtime as ke, require_react as Ae, reviewGroupingOptions as je, reviewQueueData as Me, reviewQueueOf as Ne, reviewWindow as Pe, rowEvidence as U, rowFieldName as Fe, rowSelectionOperation as W, rowSubject as Ie, rowTags as Le, rowTitle as G, s7 as Re, selectReviewRange as ze, serverLabel as Be, serverLabelList as Ve, settleReviewRows as He, submitDecision as Ue, t as K, useMutation as We, useNavigationOrder as Ge, useOverlayScrollbar as Ke, usePageSelection as qe, useQuery as Je, useViewGlide as q, useWorkContextMenu as Ye } from "./peach-app.js";
import { Page as Xe } from "./peach-app.page-QAncjzM1.js";
import { DataTable as Ze } from "./peach-app.data-table-CYTfz3fV.js";
import { ComparisonText as J } from "./peach-app.comparison-text-d2N41j2E.js";
// src/react/review/auto-landings.ts
var Y = /* @__PURE__ */ O(Ae(), 1), Qe = "/api/review/auto-landings", $e = "/api/review/auto-landings/revert", et = ["review", "auto-landings"], X = (e) => Be(e.field_code ?? "", e.field), Z = (e) => Be(e.label_code ?? "", e.label), tt = (e) => k(Qe, e), nt = (e) => k(`${Qe}?items=${encodeURIComponent(e.join("\n"))}`), rt = (e, t) => A($e, {
	items: e,
	token: t
}), it = (e) => e.at === null ? "" : we((/* @__PURE__ */ new Date(e.at * 1e3)).toISOString()), Q = (e) => e.code || e.name || (e.asset_id ? `#${e.asset_id}` : K("manage:autoLandings.unknownVideo")), at = (e) => e ? B(e) : K("manage:autoLandings.emptyValue"), ot = (e) => e.tags.length ? z(e.tags) : e.value, st = (e) => e.tags.length ? K("manage:autoLandings.existingTagsKept") : K("manage:autoLandings.previousValue", { value: e.previous.length ? z(e.previous.map(at)) : K("manage:autoLandings.emptyValue") });
function ct(e) {
	return [
		...e.restores.map((e) => K("manage:autoLandings.previewRestore", {
			video: Q(e),
			field: X(e),
			current: at(e.current),
			previous: at(e.previous)
		})),
		...e.tags.map((e) => K("manage:autoLandings.previewRemoveTag", {
			video: Q(e),
			tag: e.tag
		})),
		...e.changed.map((e) => e.gone ? K("manage:autoLandings.previewGone", {
			video: Q(e),
			field: X(e)
		}) : K("manage:autoLandings.previewEdited", {
			video: Q(e),
			field: X(e)
		}))
	];
}
function lt(e) {
	let t = [e.restores.length ? K("manage:autoLandings.previewRestoreCount", { count: e.restores.length }) : "", e.tags.length ? K("manage:autoLandings.previewRemoveTags", { count: e.tags.length }) : ""].filter(Boolean);
	return [
		t.length ? K("manage:autoLandings.previewRevert", {
			count: e.decisions,
			details: t.join(K("shell:format.clauseSeparator"))
		}) : K("manage:autoLandings.previewRevertNothing", { count: e.decisions }),
		e.changed.length ? K("manage:autoLandings.previewUnchanged", { count: e.changed.length }) : "",
		K("manage:autoLandings.revertBackupNote")
	].filter(Boolean).join(K("shell:format.sentenceGap"));
}
function ut(e) {
	let t = [e.restored ? K("manage:autoLandings.resultRestoreCount", { count: e.restored }) : "", e.removed_tags ? K("manage:autoLandings.resultRemovedTags", { count: e.removed_tags }) : ""].filter(Boolean);
	return t.length ? K("manage:autoLandings.resultSummaryDetails", {
		count: e.decisions,
		details: t.join(K("shell:format.clauseSeparator"))
	}) : K("manage:autoLandings.resultSummary", { count: e.decisions });
}
// src/react/review/auto-landings-card.tsx
var $ = ke(), dt = K("manage:autoLandings.description");
function ft({ item: t, openItem: n }) {
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
				children: K("manage:shared.noCover")
			}), /* @__PURE__ */ (0, $.jsx)(e, { children: K("manage:autoLandings.openVideo", { name: Q(t) }) })]
		}), /* @__PURE__ */ (0, $.jsxs)("span", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, $.jsxs)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: [Q(t), t.assets > 1 ? /* @__PURE__ */ (0, $.jsx)("small", {
					className: "ml-1 text-caption-1-regular text-text-secondary",
					children: K("manage:autoLandings.fileCount", { count: t.assets })
				}) : null]
			}), /* @__PURE__ */ (0, $.jsx)("small", {
				title: t.name,
				className: "truncate text-caption-1-regular text-text-secondary",
				children: t.gone ? K("manage:autoLandings.videoGone") : t.name
			})]
		})]
	});
}
function pt({ item: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-0.5",
		children: [/* @__PURE__ */ (0, $.jsxs)("span", {
			title: ot(e),
			className: "truncate text-body-regular text-text-primary",
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-text-secondary",
				children: K("shell:format.labelPrefix", { label: X(e) })
			}), ot(e)]
		}), /* @__PURE__ */ (0, $.jsx)("small", {
			title: st(e),
			className: "truncate text-caption-1-regular text-text-secondary",
			children: st(e)
		})]
	});
}
function mt({ locked: e, openItem: t, toast: n }) {
	let [r, i] = (0, Y.useState)([]), [a, o] = (0, Y.useState)(null), s = Je({
		queryKey: et,
		queryFn: ({ signal: e }) => tt(e)
	}), c = s.data?.items ?? [], l = (e) => {
		let t = null, n = null;
		return {
			key: "revert",
			label: K("manage:autoLandings.revertSelected", { count: e }),
			reversal: "irreversible",
			confirm: async (e) => (t = await nt(e.map((e) => e.item_key)), {
				title: K("manage:autoLandings.revertTitle"),
				body: lt(t),
				items: ct(t),
				confirmLabel: K("manage:shared.revert")
			}),
			run: async () => {
				n = await rt(t.items, t.token), o(n), Oe.invalidateQueries({ queryKey: se });
			},
			receipt: () => n ? ut(n) : ""
		};
	}, u = {
		receipt: n,
		failure: (e) => n(R(e))
	};
	if (!c.length && !a && !s.isError) return null;
	let d = [
		{
			id: "work",
			label: K("manage:shared.video"),
			width: 300,
			min: 240,
			value: (e) => Q(e),
			render: (e) => /* @__PURE__ */ (0, $.jsx)(ft, {
				item: e,
				openItem: t
			})
		},
		{
			id: "written",
			label: K("manage:autoLandings.columnWritten"),
			width: 320,
			min: 220,
			value: (e) => `${X(e)}${ot(e)}`,
			filter: { values: X },
			render: (e) => /* @__PURE__ */ (0, $.jsx)(pt, { item: e })
		},
		{
			id: "rule",
			label: K("manage:autoLandings.columnRuleTime"),
			width: 176,
			min: 144,
			value: (e) => e.at ?? 0,
			filter: { values: Z },
			render: (e) => /* @__PURE__ */ (0, $.jsxs)("span", {
				title: e.batch,
				className: "flex min-w-0 flex-col gap-0.5 text-text-secondary",
				children: [/* @__PURE__ */ (0, $.jsx)("span", {
					className: "truncate text-body-2-regular",
					children: Z(e)
				}), /* @__PURE__ */ (0, $.jsx)("small", {
					className: "tabular-nums text-caption-1-regular",
					children: it(e) || K("manage:autoLandings.timeUnknown")
				})]
			})
		}
	];
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-labelledby": "auto-landings-title",
		className: "flex flex-col gap-4",
		children: [a ? /* @__PURE__ */ (0, $.jsxs)(g, {
			tone: "success",
			title: ut(a),
			children: [/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-2-regular",
				children: K("manage:autoLandings.backupDone", { path: a.backup })
			}), a.changed.length ? /* @__PURE__ */ (0, $.jsxs)("p", {
				className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-2-regular",
				children: [K("manage:autoLandings.leftUnchanged", { count: a.changed.length }), a.changed.map((e) => e.gone ? /* @__PURE__ */ (0, $.jsx)("span", {
					className: "text-text-secondary",
					children: K("manage:autoLandings.deletedAsset", { id: e.asset_id })
				}, `${e.asset_id}:${e.field}`) : /* @__PURE__ */ (0, $.jsx)(ae, {
					size: "small",
					onClick: () => t(e.asset_id),
					children: Q(e)
				}, `${e.asset_id}:${e.field}`))]
			}) : null]
		}) : null, s.isError ? /* @__PURE__ */ (0, $.jsx)(g, {
			tone: "error",
			title: K("manage:autoLandings.loadFailed"),
			children: R(s.error)
		}) : c.length ? /* @__PURE__ */ (0, $.jsx)(Ze, {
			label: K("manage:autoLandings.title"),
			items: c,
			columns: d,
			title: K("manage:autoLandings.title"),
			titleId: "auto-landings-title",
			unit: K("manage:autoLandings.unit"),
			description: dt,
			rowId: (e) => e.item_key,
			rowLabel: (e) => `${Q(e)} ${X(e)}`,
			selected: r,
			onSelected: i,
			contextOperations: ({ asset_id: e, gone: n }) => e && !n ? [{
				id: "open",
				label: K("catalog:mediaActions.open"),
				icon: ie,
				run: () => t(e)
			}] : [],
			actions: (t, n) => [{
				action: l(t.length),
				items: t,
				host: u,
				disabled: e,
				done: n,
				rowAction: {
					label: K("manage:shared.revert"),
					icon: j
				}
			}]
		}) : null]
	});
}
// src/react/review/bulk-toolbar.tsx
function ht(e) {
	let { groupOptions: t, groupBy: n, onGroupBy: i, groups: a, filter: o, onFilter: s, pageKeys: c, allKeys: l = c, selected: u, onSelected: d, selectedRows: ee, metadata: te, busy: f, feedback: ne, onUnifySource: re, actions: ie, queueView: m = "pending", queueCounts: h, onQueueChange: ae, locked: g, fields: _, fieldFilter: oe, onFieldFilter: se } = e, v = c.filter((e) => u.has(e)), C = v.length > 0 && v.length === c.length, w = l.length > c.length && l.every((e) => u.has(e)), T = fe(ee), E = te && ee.some((e) => (e.candidates?.length || 0) > 1), le = T.length ? K("manage:reviewToolbar.sourceForAll") : K("manage:reviewToolbar.noCommonSource"), D = (0, Y.useRef)(null), O = (0, Y.useRef)(null), k = (0, Y.useRef)(null), [A, ue] = (0, Y.useState)(!1), j = q(D, O, "[data-entity-state][aria-pressed=\"true\"]", m);
	return (0, Y.useLayoutEffect)(() => {
		let e = O.current, t = k.current, n = e?.parentElement, r = e?.closest("[data-review-filter]");
		if (!e || !t || !n || !r) return;
		let i = () => ue(t.offsetHeight > 0 && Math.abs(n.getBoundingClientRect().top - t.getBoundingClientRect().top) < 1), a = new ResizeObserver(i);
		for (let n of [
			r,
			e,
			t
		]) a.observe(n);
		return i(), () => a.disconnect();
	}, []), /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(p, {
		label: K("manage:reviewToolbar.filters"),
		topLabel: K("manage:reviewToolbar.processingStatus"),
		attrs: { "data-review-filter": "" },
		className: "mb-0 flex-row flex-wrap",
		topClassName: "max-w-full flex-none",
		bottomClassName: c.length ? "min-h-12 max-w-full flex-none flex-wrap" : "hidden",
		bottomRef: k,
		panes: /* @__PURE__ */ (0, $.jsx)("span", {
			ref: D,
			"data-view-glide": "",
			"aria-hidden": "true"
		}),
		top: /* @__PURE__ */ (0, $.jsxs)("div", {
			ref: O,
			role: "group",
			"aria-label": K("manage:reviewToolbar.reviewStatus"),
			"data-entity-states": "",
			onPointerLeave: j.leave,
			children: [y.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
				type: "button",
				"data-entity-state": e,
				"data-entity-press": "",
				disabled: f,
				"aria-pressed": m === e,
				onPointerEnter: j.hover,
				onClick: () => {
					e !== m && ae(e);
				},
				children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-copy-key": `review.queue.${e}`,
						children: b[e]
					}),
					" ",
					/* @__PURE__ */ (0, $.jsx)("span", {
						className: "ms-1.5 tabular-nums text-caption-1-medium text-text-secondary",
						children: h ? h[e].toLocaleString() : "…"
					})
				]
			}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
				"data-entity-sep": "",
				"aria-hidden": "true",
				className: A ? void 0 : "invisible"
			})]
		}),
		bottom: c.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
			te && _.length ? /* @__PURE__ */ (0, $.jsxs)(x, {
				"aria-label": K("manage:reviewToolbar.filterField"),
				size: "sm",
				prefix: /* @__PURE__ */ (0, $.jsx)("span", {
					"data-copy-key": "review.filter.field",
					className: "pointer-events-auto",
					children: K("manage:reviewToolbar.field")
				}),
				selectedKey: oe || "*",
				isDisabled: f,
				onSelectionChange: (e) => {
					e !== null && se(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, $.jsx)(S, {
					id: "*",
					children: K("manage:shared.all")
				}), _.map((e) => /* @__PURE__ */ (0, $.jsx)(S, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(x, {
				"aria-label": K("manage:reviewToolbar.groupBy"),
				size: "sm",
				selectedKey: n,
				onSelectionChange: (e) => {
					e !== null && i(String(e));
				},
				children: t.map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(S, {
					id: e,
					children: t
				}, e))
			}),
			a.length > 1 ? /* @__PURE__ */ (0, $.jsxs)(x, {
				"aria-label": K(n === "field" ? "manage:reviewToolbar.filterFieldGroup" : "manage:reviewToolbar.filterGroup"),
				size: "sm",
				prefix: K("manage:reviewToolbar.group"),
				selectedKey: o || "*",
				onSelectionChange: (e) => {
					e !== null && s(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, $.jsx)(S, {
					id: "*",
					children: K("manage:shared.all")
				}), a.map((e) => /* @__PURE__ */ (0, $.jsx)(S, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			g ? null : /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: Ce,
				"aria-pressed": C,
				disabled: f,
				onClick: () => {
					let e = new Set(u);
					for (let t of c) C ? e.delete(t) : e.add(t);
					d(e);
				},
				children: K(C ? "manage:reviewToolbar.clearSelection" : o ? "manage:reviewToolbar.selectGroup" : "manage:reviewToolbar.selectPage")
			}),
			g || l.length <= c.length || w ? null : /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: f,
				onClick: () => d(/* @__PURE__ */ new Set([...u, ...l])),
				children: K("manage:reviewToolbar.selectAll", { count: l.length })
			})
		] }) : null
	}), /* @__PURE__ */ (0, $.jsxs)(ce, {
		label: K("manage:reviewToolbar.selectedDock"),
		visible: !g && u.size > 0,
		count: K("manage:reviewToolbar.selectedCount", { count: u.size }),
		actions: ie,
		leading: E && m !== "ignored" ? /* @__PURE__ */ (0, $.jsxs)(x, {
			"aria-label": K("manage:reviewToolbar.sourceForAll"),
			size: "sm",
			selectedKey: "",
			isDisabled: f || !T.length,
			onSelectionChange: (e) => {
				e !== null && e !== "" && re(String(e));
			},
			children: [/* @__PURE__ */ (0, $.jsx)(S, {
				id: "",
				children: le
			}), T.map((e) => /* @__PURE__ */ (0, $.jsx)(S, {
				id: e,
				children: e
			}, e))]
		}) : null,
		children: [/* @__PURE__ */ (0, $.jsx)(r, {
			variant: "ghost",
			size: "small",
			disabled: f,
			onClick: _e,
			children: K("manage:reviewToolbar.deselect")
		}), ne ? /* @__PURE__ */ (0, $.jsx)("p", {
			role: "status",
			className: "w-full text-body-2-regular text-text-secondary",
			children: ne
		}) : null]
	})] });
}
// src/react/boardui/components/base/radio/radio.tsx
var gt = {
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
function _t({ selected: e = !1, size: t = "sm", focusVisible: n = !1, className: r }) {
	let i = gt[t];
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		"aria-hidden": !0,
		className: L("relative flex shrink-0 items-center justify-center rounded-full", i.dot, n && "ring-2 ring-border-focus-ring ring-offset-2", r),
		children: [
			/* @__PURE__ */ (0, $.jsx)("span", { className: L("absolute inset-0 rounded-full border-border-checkbox-default bg-background-primary-default shadow-xs", "transition-opacity duration-200 ease", i.border, e && "opacity-0") }),
			/* @__PURE__ */ (0, $.jsx)("span", { className: L("absolute inset-0 rounded-full", "transition-opacity duration-200 ease", i.selected, !e && "opacity-0") }),
			/* @__PURE__ */ (0, $.jsx)("span", { className: L("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-control-indicator-background", "transition-[scale,opacity] duration-200 ease", i.inner, e ? "scale-100 opacity-100" : "scale-0 opacity-0") })
		]
	});
}
function vt({ className: e, children: n, ref: r, ...i }) {
	return /* @__PURE__ */ (0, $.jsx)(t, {
		ref: r,
		...i,
		className: (t) => L("flex flex-col gap-2", typeof e == "function" ? e(t) : e),
		children: n
	});
}
// src/react/boardui/components/base/radio/radio-card.tsx
function yt({ className: e, title: t, description: r, ref: i, ...a }) {
	return /* @__PURE__ */ (0, $.jsx)(n, {
		ref: i,
		...a,
		className: (t) => L("group flex w-full items-center justify-between gap-3 rounded-2lg border border-border-button-default py-3 pe-5 ps-4 select-none", "transition-colors duration-150 ease", t.isHovered && !t.isDisabled ? "bg-background-primary-hover" : "bg-background-primary-default", t.isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", typeof e == "function" ? e(t) : e),
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
			children: /* @__PURE__ */ (0, $.jsx)(_t, {
				size: "md",
				selected: e.isSelected,
				focusVisible: e.isFocusVisible
			})
		})] })
	});
}
// src/react/review/candidate-form.tsx
var bt = {
	title: K("manage:shared.title"),
	original_title: K("manage:reviewCandidate.originalTitle"),
	runtime: K("manage:reviewCandidate.sourceRuntime"),
	director: K("manage:reviewCandidate.director"),
	label: "Label",
	poster_url: K("manage:reviewCandidate.poster"),
	cover_url: K("manage:shared.cover"),
	screenshot_urls: K("manage:reviewCandidate.screenshots"),
	trailer_url: K("manage:reviewCandidate.trailer")
}, xt = "reviewgenretags";
function St({ tags: e }) {
	return e.length ? /* @__PURE__ */ (0, $.jsx)("datalist", {
		id: xt,
		children: e.map((e) => /* @__PURE__ */ (0, $.jsx)("option", { value: e }, e))
	}) : null;
}
function Ct({ candidate: e, row: t }) {
	let [n, i] = (0, Y.useState)(!1), a = (0, Y.useId)(), o = Object.entries(e.catalog_evidence || {}).filter(([, e]) => e && e.display_value);
	return o.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, $.jsxs)(r, {
			variant: "secondary",
			size: "small",
			leadingIcon: c,
			"aria-expanded": n,
			"aria-controls": a,
			"aria-label": K(n ? "manage:reviewCandidate.collapseEvidence" : "manage:reviewCandidate.expandEvidence", { source: e.source || K("manage:reviewCandidate.thisSource") }),
			onClick: () => i(!n),
			children: [/* @__PURE__ */ (0, $.jsx)("span", {
				"data-copy-key": "review.card.source_evidence",
				children: K("manage:reviewCandidate.sourceEvidence")
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
							children: bt[n] || n
						}),
						/* @__PURE__ */ (0, $.jsx)("dd", {
							className: "min-w-0 text-body-2-regular break-words text-text-primary",
							children: /* @__PURE__ */ (0, $.jsx)(J, {
								value: P(r, "display_value"),
								reference: n === t.field && t.current_value ? t.current_value : P(t.candidates?.find((t) => t.candidate_key !== e.candidate_key && t.catalog_evidence?.[n]?.display_value)?.catalog_evidence?.[n], "display_value")
							})
						}),
						Ve(r.warnings, r.warning_codes, r.warning_params).map((e) => /* @__PURE__ */ (0, $.jsx)("small", {
							className: "w-full text-caption-1-regular text-status-yellow-text",
							children: e
						}, e))
					]
				}, n))
			})
		})]
	}) : null;
}
function wt(e) {
	let t = e.content_id || e.provider_id;
	return `${e.source || K("manage:reviewQueue.unspecifiedSource")}${e.official ? ` · ${K("manage:reviewCandidate.officialFirst")}` : ""}${t ? ` · ID ${t}` : ""}`;
}
function Tt({ candidate: e, reference: t }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-2 whitespace-normal wrap-anywhere",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-regular text-text-primary",
			children: /* @__PURE__ */ (0, $.jsx)(J, {
				value: e.display_value || "",
				reference: t
			})
		}), Ve(e.warnings, e.warning_codes, e.warning_params).map((e) => /* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-2-regular text-status-yellow-text",
			children: e
		}, e))]
	});
}
function Et({ row: e, fieldName: t, value: n, onChange: r, locked: i }) {
	let a = e.candidates || [];
	return a.length ? a.length === 1 ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-2",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-2 rounded-2lg bg-background-primary-default px-4 py-3",
			children: [/* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-medium text-text-primary",
				children: wt(a[0])
			}), /* @__PURE__ */ (0, $.jsx)(Tt, {
				candidate: a[0],
				reference: e.current_value || void 0
			})]
		}), /* @__PURE__ */ (0, $.jsx)(Ct, {
			candidate: a[0],
			row: e
		})]
	}) : /* @__PURE__ */ (0, $.jsx)(vt, {
		"aria-label": K("manage:reviewCandidate.sourceFor", { field: t || K("manage:scanFetch.slowWhatMetadata") }),
		value: n,
		isDisabled: i,
		onChange: r,
		children: /* @__PURE__ */ (0, $.jsx)("div", {
			className: "flex min-w-0 flex-col gap-3",
			children: a.map((t) => /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, $.jsx)(yt, {
					value: t.candidate_key,
					className: "relative items-start",
					title: /* @__PURE__ */ (0, $.jsx)("span", {
						title: wt(t),
						children: wt(t)
					}),
					description: /* @__PURE__ */ (0, $.jsx)(Tt, {
						candidate: t,
						reference: e.current_value || a.find((e) => e.candidate_key !== t.candidate_key)?.display_value
					})
				}), /* @__PURE__ */ (0, $.jsx)(Ct, {
					candidate: t,
					row: e
				})]
			}, t.candidate_key))
		})
	}) : null;
}
function Dt({ genre: e, tags: t, locked: n, toast: i }) {
	let [a, o] = (0, Y.useState)(""), [s, c] = (0, Y.useState)(""), l = We({
		mutationFn: (t) => V(e, t),
		onSuccess: async (t, n) => {
			t.ok ? (i(n ? K("manage:reviewCandidate.mapped", {
				genre: e,
				tag: n
			}) : K("manage:reviewCandidate.markedNonContent", { genre: e })), await H()) : c(t.error || K("manage:reviewCandidate.mapRejected"));
		},
		onError: (e) => c(R(e))
	}), u = () => {
		let e = a.trim();
		e ? (c(""), l.mutate(e)) : c(K("manage:reviewCandidate.tagRequired"));
	};
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, $.jsx)("b", {
				lang: "ja",
				className: "text-body-medium text-text-primary",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsx)(T, {
				"aria-label": K("manage:reviewCandidate.tagFor", { genre: e }),
				value: a,
				onChange: o,
				maxLength: 40,
				isDisabled: n || l.isPending,
				className: "min-w-40 flex-1",
				children: /* @__PURE__ */ (0, $.jsx)(m, {
					size: "small",
					list: t.length ? xt : void 0,
					autoComplete: "off",
					placeholder: K("manage:reviewCandidate.tagPlaceholder"),
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
				children: K("manage:reviewCandidate.map")
			}),
			/* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: () => {
					c(""), l.mutate("");
				},
				children: K("manage:reviewCandidate.notContent")
			}),
			s ? /* @__PURE__ */ (0, $.jsx)("p", {
				role: "status",
				className: "w-full text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function Ot({ row: e, tags: t, locked: n, toast: r }) {
	let i = De(e);
	return i.length ? /* @__PURE__ */ (0, $.jsxs)("div", {
		role: "group",
		"aria-label": K("manage:reviewCandidate.unmappedGenres"),
		className: "flex flex-col gap-2 border-t border-separator-border pt-4",
		children: [/* @__PURE__ */ (0, $.jsx)("h5", {
			className: "text-body-2-medium text-text-secondary",
			children: K("manage:reviewCandidate.unmappedGenresCount", { count: i.length })
		}), /* @__PURE__ */ (0, $.jsx)("div", {
			role: "list",
			className: "flex flex-col",
			children: i.map((e, i) => /* @__PURE__ */ (0, $.jsx)("div", {
				role: "listitem",
				className: `py-3 first:pt-0 last:pb-0 ${i ? "border-t border-separator-border" : ""}`,
				children: /* @__PURE__ */ (0, $.jsx)(Dt, {
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
var kt = (e = "") => /^https?:\/\//i.test(e) ? e : "", At = (e = "") => kt(e) || (e.startsWith("/") && !e.startsWith("//") ? e : "");
function jt({ url: e }) {
	let t = At(e || "");
	return /* @__PURE__ */ (0, $.jsx)(Mt, { source: t }, t);
}
function Mt({ source: e }) {
	let [t, n] = (0, Y.useState)("idle");
	return (0, Y.useEffect)(() => {
		if (t !== "loading") return;
		let e = setTimeout(() => n("failed"), 3e4);
		return () => clearTimeout(e);
	}, [t]), /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "relative flex h-review-image items-center justify-center overflow-hidden rounded-surface bg-background-secondary-default",
		children: [t === "loading" ? /* @__PURE__ */ (0, $.jsx)("span", {
			role: "status",
			"aria-busy": "true",
			"aria-label": K("manage:reviewEvidence.loadingImage"),
			"data-skeleton": "",
			className: "absolute inset-0 skeleton-sheen"
		}) : null, e && (t === "loading" || t === "ready") ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: e,
			alt: K("manage:reviewEvidence.candidateImageAlt"),
			referrerPolicy: "no-referrer",
			decoding: "async",
			className: `size-full object-contain ${t === "loading" ? "invisible" : ""}`,
			onLoad: () => n("ready"),
			onError: () => n("failed")
		}) : e ? /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex flex-col items-center gap-2",
			children: [t === "failed" ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "text-body-2-regular text-text-secondary",
				children: K("manage:reviewEvidence.imageNotFound")
			}) : null, /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				"aria-label": t === "failed" ? K("manage:reviewEvidence.retryImage") : void 0,
				onClick: () => n("loading"),
				children: K(t === "failed" ? "manage:shared.retryNow" : "manage:reviewEvidence.viewImage")
			})]
		}) : /* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-body-2-regular text-text-secondary",
			children: K("manage:reviewEvidence.imageNotFound")
		})]
	});
}
function Nt({ asset: t, openItem: n }) {
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
				children: K("manage:shared.noCover")
			}), /* @__PURE__ */ (0, $.jsx)(e, { children: K("manage:reviewEvidence.openOriginalNamed", { name: i }) })]
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start gap-1",
			children: [/* @__PURE__ */ (0, $.jsx)("b", {
				title: i,
				className: "w-full truncate text-body-medium text-text-primary",
				children: t.code || i || K("manage:reviewEvidence.originalVideo")
			}), /* @__PURE__ */ (0, $.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: ie,
				onClick: () => n(t.id),
				children: K("manage:reviewEvidence.openOriginal")
			})]
		})]
	});
}
function Pt({ kind: e, name: t, works: n, avatar: r, openEntity: i }) {
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, $.jsx)("button", {
			type: "button",
			"aria-label": K("manage:reviewEvidence.openCreator", { name: t }),
			onClick: () => i(e, t),
			className: `relative inline-grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring ${h}`,
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
				children: K("manage:reviewEvidence.videoCount", { count: n })
			}) : null]
		})]
	});
}
function Ft({ row: e, openItem: t, openEntity: n, onReveal: a, revealing: o, note: s }) {
	let c = kt(e.profile_url || ""), l = (e.preview_assets || []).slice(0, 6), u = Math.max(0, Number(e.video_count || e.videos || 0));
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, $.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: K("manage:reviewEvidence.pendingPerson", { name: e.babepedia_name || K("manage:reviewEvidence.unlabeled") })
			}),
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [c ? /* @__PURE__ */ (0, $.jsx)(i, {
					variant: "secondary",
					size: "small",
					trailingIcon: E,
					href: c,
					target: "_blank",
					rel: "noopener noreferrer",
					children: K("manage:reviewEvidence.sourceProfile")
				}) : null, /* @__PURE__ */ (0, $.jsx)(r, {
					variant: "secondary",
					size: "small",
					onClick: () => n("creator", e.creator || ""),
					children: K("manage:reviewEvidence.viewAllVideos", { count: u })
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(jt, { url: e.preview_url }),
			l.length ? /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: K("manage:reviewEvidence.localSamples")
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
						"aria-label": K("manage:reviewEvidence.revealNamed", { name: e.name }),
						...M(o === e.id),
						onClick: () => a(e.id),
						children: K("manage:reviewEvidence.fileLocation")
					})]
				}, e.id))
			})] }) : /* @__PURE__ */ (0, $.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: K("manage:reviewEvidence.noLocalSamples")
			}),
			s ? /* @__PURE__ */ (0, $.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function It({ assets: t, picked: n, onPicked: r, locked: i }) {
	let [a, s] = (0, Y.useState)(null), c = new Set(n), l = (e, n) => {
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
		children: [/* @__PURE__ */ (0, $.jsx)(C, {
			prefix: /* @__PURE__ */ (0, $.jsx)("span", {
				className: "tabular-nums text-body-2-regular text-text-secondary",
				children: K("manage:reviewEvidence.selectedOfTotal", {
					count: c.size,
					total: t.length
				})
			}),
			actions: [{
				label: K("manage:shared.selectAll"),
				disabled: i,
				onPress: () => r(t.map((e) => e.id))
			}, {
				label: K("manage:reviewEvidence.clearSelection"),
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
						/* @__PURE__ */ (0, $.jsx)(e, { children: K(r ? "manage:reviewEvidence.assetSelected" : "manage:reviewEvidence.assetUnselected", { name: t.name || t.id }) })
					]
				}, t.id);
			})
		})]
	});
}
// src/react/review/review-card.tsx
var Lt = N({
	variant: "filled",
	padding: "none",
	className: "flex flex-col overflow-hidden"
}), Rt = "flex min-h-6 min-w-0 items-center", zt = 2, Bt = (e) => e === "western_identity" ? "h-review-card-tall" : "h-review-card";
function Vt(e) {
	let { category: t, row: n, choice: i, onChoice: o, selected: c, onSelect: l, locked: u, busy: d, problem: ne, genreTags: p, onDecide: m, handlers: h, queueView: g = "pending" } = e, _ = (0, Y.useRef)(!1), se = Ke(), v = t === "metadata_fields", y = ee[t] || "", b = String(n.creator || "").trim(), x = !!y && !!b, S = G(t, n), C = Fe(t, n), ce = Ie(t, n), w = U(n), T = Le(n), E = de(t, n), O = n.comparison_assets || [], k = n.preview_assets || [], A = oe[n.decision || ""], N = O.length > 1 ? /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [O.slice(0, zt).map((e) => /* @__PURE__ */ (0, $.jsx)(Nt, {
			asset: e,
			openItem: h.openItem
		}, e.id)), O.length > zt ? /* @__PURE__ */ (0, $.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: K("manage:reviewCard.moreComparison", { count: O.length - zt })
		}) : null]
	}) : x ? /* @__PURE__ */ (0, $.jsx)(Pt, {
		kind: y,
		name: b,
		works: Number(n.video_count || n.videos || 0),
		openEntity: h.openEntity,
		avatar: ue(b, n.entity_id ? {
			id: n.entity_id,
			has_image: !!n.has_image,
			image_version: n.image_version,
			avatar_focus: n.avatar_focus
		} : null, null, y)
	}) : n.asset_id ? /* @__PURE__ */ (0, $.jsx)(Nt, {
		openItem: h.openItem,
		asset: {
			id: n.asset_id,
			name: n.asset_name,
			code: n.code,
			preview_url: n.asset_preview_url
		}
	}) : null, P = v ? /* @__PURE__ */ (0, $.jsx)(Et, {
		row: n,
		fieldName: C,
		value: i.candidateKey,
		onChange: (e) => o({
			...i,
			candidateKey: e
		}),
		locked: u
	}) : t === "creator_tags" ? k.length ? /* @__PURE__ */ (0, $.jsx)(It, {
		assets: k,
		picked: i.assets,
		locked: u,
		onPicked: (e) => o({
			...i,
			assets: e
		})
	}) : /* @__PURE__ */ (0, $.jsx)(f, {
		size: "compact",
		icon: te,
		title: K("manage:reviewCard.noFramesTitle"),
		children: n.video_count ? K("manage:reviewCard.noFramesBody", { count: n.video_count }) : K("manage:reviewCard.noFramesBodyUncounted")
	}) : t === "fc2_similarity" ? null : t === "western_identity" ? /* @__PURE__ */ (0, $.jsx)(Ft, {
		row: n,
		openItem: h.openItem,
		openEntity: h.openEntity,
		onReveal: h.onReveal,
		revealing: h.revealing,
		note: h.revealNote
	}) : /* @__PURE__ */ (0, $.jsx)(jt, { url: n.preview_url }), fe = x ? N : C ? /* @__PURE__ */ (0, $.jsxs)("h4", {
		className: L(Rt, "flex-wrap gap-2"),
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			title: C,
			className: "flex max-w-full min-w-0 overflow-hidden rounded-md",
			children: /* @__PURE__ */ (0, $.jsx)(s, {
				variant: "caption",
				color: "neutral",
				children: C
			})
		}), /* @__PURE__ */ (0, $.jsx)("span", {
			title: ce,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: ce
		})]
	}) : /* @__PURE__ */ (0, $.jsx)("h4", {
		className: Rt,
		children: /* @__PURE__ */ (0, $.jsx)("span", {
			title: S,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: S
		})
	}), F = Ye(), I = [];
	if (O.length <= 1) {
		if (x) I.push({
			id: "entity",
			label: b,
			icon: le,
			run: () => h.openEntity(y, b)
		});
		else if (n.asset_id) {
			let e = n.asset_id;
			I.push({
				id: "open",
				label: K("catalog:mediaActions.open"),
				icon: ie,
				run: () => h.openItem(e)
			});
		}
	}
	u || (I.push(W(c, () => l(!1, !c))), g !== "ignored" && I.push({
		id: "approve",
		label: K("manage:reviewDecision.approve"),
		icon: Re,
		disabled: d || !E,
		run: () => m("approved")
	}), I.push(g === "pending" ? {
		id: "later",
		label: K("manage:reviewDecision.later"),
		icon: be,
		disabled: d,
		run: () => m("skipped")
	} : {
		id: "restore",
		label: K("manage:reviewDecision.moveToPending"),
		icon: j,
		disabled: d,
		run: () => m("restore")
	}), g !== "ignored" && I.push({
		id: "ignore",
		label: K("manage:shared.ignore"),
		icon: D,
		disabled: d,
		run: () => m("rejected")
	}));
	let pe = {
		key: n.item_key,
		operations: I
	};
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-label": S,
		"data-review-key": n.item_key,
		className: L(Lt, Bt(t)),
		onContextMenu: (e) => {
			e.target.closest("input, textarea, select, [contenteditable]") || F.onContextMenu(e, pe);
		},
		onKeyDown: (e) => {
			e.target.closest("input, textarea, select, [contenteditable]") || F.onKeyDown(e, pe);
		},
		children: [
			F.menu,
			/* @__PURE__ */ (0, $.jsxs)("header", {
				className: "flex min-w-0 shrink-0 items-center gap-2 border-b border-separator-border px-5 py-4",
				children: [
					u ? null : /* @__PURE__ */ (0, $.jsx)("span", {
						className: L(Rt, "shrink-0"),
						onPointerDownCapture: (e) => {
							_.current = e.shiftKey;
						},
						onKeyDownCapture: (e) => {
							_.current = e.shiftKey;
						},
						children: /* @__PURE__ */ (0, $.jsx)(a, {
							isSelected: c,
							"aria-label": K("manage:reviewCard.selectItem", { title: S }),
							onChange: (e) => l(_.current, e)
						})
					}),
					/* @__PURE__ */ (0, $.jsx)("div", {
						className: "min-w-0 flex-1",
						children: fe
					}),
					A ? /* @__PURE__ */ (0, $.jsx)(s, {
						variant: "caption",
						color: "neutral",
						children: A
					}) : null
				]
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				className: "relative mx-5 flex min-w-0 min-h-0 flex-1 flex-col",
				children: /* @__PURE__ */ (0, $.jsxs)("div", {
					ref: se,
					className: "flex min-w-0 min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4",
					children: [
						n.source_name ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: K("manage:reviewCard.sourceSpelling", { name: n.source_name })
						}) : null,
						!x && (n.board || n.assets) ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: K("manage:reviewCard.comparisonFiles", { count: Number(n.video_count || n.assets || 0) })
						}) : null,
						!x && N ? N : null,
						v && (w || n.current_value !== void 0) ? /* @__PURE__ */ (0, $.jsxs)("div", {
							role: "region",
							"aria-label": K("manage:reviewCard.currentInfo"),
							className: "flex min-w-0 flex-col gap-1 border-b border-separator-border pb-4",
							children: [
								/* @__PURE__ */ (0, $.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, $.jsx)("h5", {
										"data-copy-key": "review.card.current_value",
										className: "text-caption-1-medium text-text-secondary",
										children: K("manage:reviewCard.currentValue")
									}), n.current_owner?.startsWith("user:") || n.current_owner?.startsWith("review:") ? /* @__PURE__ */ (0, $.jsx)(s, {
										variant: "caption",
										color: "neutral",
										children: K("manage:reviewCard.manuallyConfirmed")
									}) : null]
								}),
								/* @__PURE__ */ (0, $.jsx)("p", {
									className: "text-body-2-regular text-text-primary wrap-anywhere",
									children: n.current_value === void 0 ? w : n.current_value ? /* @__PURE__ */ (0, $.jsx)(J, {
										value: n.current_value,
										reference: (n.candidates?.find((e) => e.candidate_key === i.candidateKey) || n.candidates?.[0])?.display_value
									}) : K("manage:reviewCard.noMetadata")
								}),
								n.videos === void 0 ? null : /* @__PURE__ */ (0, $.jsx)("p", {
									className: "text-caption-1-regular text-text-secondary",
									children: K(n.asset_path ? "manage:reviewCard.matchingFiles" : "manage:reviewCard.sameCodeFiles", { count: Number(n.videos) })
								})
							]
						}) : null,
						T.length || t === "creator_tags" ? /* @__PURE__ */ (0, $.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: T.length ? T.map((e) => /* @__PURE__ */ (0, $.jsx)(s, {
								variant: "caption",
								color: "soft",
								children: e
							}, e)) : /* @__PURE__ */ (0, $.jsx)("small", {
								className: "text-body-2-regular text-text-secondary",
								children: K("manage:reviewCard.noPendingTags")
							})
						}) : null,
						v ? /* @__PURE__ */ (0, $.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, $.jsxs)("h5", {
								className: "text-caption-1-medium text-text-secondary",
								children: [/* @__PURE__ */ (0, $.jsx)("span", {
									"data-copy-key": "review.card.candidate_sources",
									children: K("manage:reviewCard.candidateSources")
								}), ` · ${n.candidates?.length || 0}`]
							}), n.current_value || (n.candidates?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-copy-key": n.current_value ? "review.card.compare_current" : "review.card.compare_sources",
								className: "text-caption-1-regular text-text-tertiary",
								children: n.current_value ? K("manage:reviewCard.comparedToCurrent") : K("manage:reviewCard.sourceDifferences")
							}) : null]
						}) : null,
						P,
						/* @__PURE__ */ (0, $.jsx)(Ot, {
							row: n,
							tags: p,
							locked: u,
							toast: h.toast
						}),
						!v && w ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary wrap-anywhere",
							children: w
						}) : null
					]
				})
			}),
			/* @__PURE__ */ (0, $.jsxs)("footer", {
				className: L(re.stack, "shrink-0"),
				children: [
					g === "ignored" ? null : /* @__PURE__ */ (0, $.jsx)(ae, {
						variant: "secondary",
						size: "small",
						className: "me-auto",
						disabled: u,
						...M(d),
						onClick: () => m("rejected"),
						children: K("manage:shared.ignore")
					}),
					g === "pending" ? /* @__PURE__ */ (0, $.jsx)(r, {
						variant: "secondary",
						size: "small",
						disabled: u,
						...M(d),
						onClick: () => m("skipped"),
						children: K("manage:reviewDecision.later")
					}) : /* @__PURE__ */ (0, $.jsx)(r, {
						variant: g === "ignored" ? "primary" : "secondary",
						size: "small",
						disabled: u,
						...M(d),
						onClick: () => m("restore"),
						children: K("manage:reviewDecision.moveToPending")
					}),
					g === "ignored" ? null : /* @__PURE__ */ (0, $.jsx)(r, {
						variant: "primary",
						size: "small",
						disabled: u || !E,
						...M(d),
						title: E ? void 0 : K("manage:reviewCard.cannotApproveHint"),
						onClick: () => m("approved"),
						children: K(E ? "manage:reviewDecision.approve" : "manage:reviewCard.cannotApprove")
					}),
					ne ? /* @__PURE__ */ (0, $.jsx)("p", {
						role: "status",
						className: "w-full text-body-2-regular text-text-error-primary",
						children: ne
					}) : null
				]
			})
		]
	});
}
// src/react/review/review-page.tsx
var Ht = "flex cursor-pointer items-center justify-between gap-2";
function Ut(e) {
	let t = Ge("review").keys.filter(Se), [n, i] = (0, Y.useState)(() => matchMedia("(max-width:900px)").matches);
	(0, Y.useEffect)(() => {
		let e = matchMedia("(max-width:900px)"), t = () => i(e.matches);
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let { route: a, openItem: o, openEntity: s, revealSource: c, toast: l, readOnly: ee, readOnlyMessage: te, writerUrl: re } = e, [p, ie] = (0, Y.useState)(Se(e.category) ? e.category : u), [m, h] = (0, Y.useState)(() => Ne(e.queue)), [ae, oe] = (0, Y.useState)("candidates"), [b, x] = (0, Y.useState)(""), [S, C] = (0, Y.useState)(""), [ce, T] = (0, Y.useState)(1), [E, le] = (0, Y.useState)(20), [D, O] = (0, Y.useState)(/* @__PURE__ */ new Set());
	qe(() => O(/* @__PURE__ */ new Set())), (0, Y.useEffect)(() => {
		D.size && ge();
	}, [D]);
	let [k, A] = (0, Y.useState)(/* @__PURE__ */ new Map()), [ue, j] = (0, Y.useState)(/* @__PURE__ */ new Map()), [M, N] = (0, Y.useState)(""), P = (0, Y.useRef)(null), [fe, F] = (0, Y.useState)(0), [L, _e] = (0, Y.useState)(""), be = (0, Y.useRef)(!0);
	(0, Y.useEffect)(() => () => {
		be.current = !1;
	}, []);
	let z = Je({
		queryKey: se,
		queryFn: ({ signal: e }) => ve(e)
	}), Ce = z.data || {
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
	}, we = Me(Ce, m), De = z.data ? Object.fromEntries(y.map((e) => [e, _.reduce((t, n) => t + Number(Me(Ce, e).counts[n] || 0), 0)])) : void 0, B = we.sections[p] || [], V = p === "metadata_fields", H = ee;
	(0, Y.useEffect)(() => {
		let e = new Set(B.map((e) => e.item_key));
		O((t) => {
			let n = [...t].filter((t) => e.has(t));
			return n.length === t.size ? t : new Set(n);
		}), A((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		}), j((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		});
	}, [B]);
	let ke = (0, Y.useMemo)(() => V ? xe(B, "field") : [], [B, V]), Ae = ke.some((e) => e.key === S) ? S : "", U = (0, Y.useMemo)(() => V ? ye(B, "field", Ae) : B, [
		B,
		V,
		Ae
	]), Fe = (0, Y.useMemo)(() => je(U, V), [U, V]), W = Fe.some(([e]) => e === ae) ? ae : "candidates", Ie = (0, Y.useMemo)(() => xe(U, W), [U, W]), Le = Ie.some((e) => e.key === b) ? b : "", G = (0, Y.useMemo)(() => ye(U, W, Le), [
		U,
		W,
		Le
	]), Re = (0, Y.useMemo)(() => Pe(G, ce, E), [
		G,
		ce,
		E
	]), Be = Re.rows.map((e) => e.item_key), Ve = new Set(Be), Ke = Ie.map((e) => ({
		...e,
		rows: e.rows.filter((e) => Ve.has(e.item_key))
	})).filter((e) => e.rows.length), q = (e) => k.get(e.item_key) || he(e), Ye = (0, Y.useMemo)(() => B.filter((e) => D.has(e.item_key)), [B, D]), Ze = (e) => {
		let t = new Set(e);
		O((e) => new Set([...e].filter((e) => !t.has(e)))), A((e) => new Map([...e].filter(([e]) => !t.has(e)))), j((e) => new Map([...e].filter(([e]) => !t.has(e))));
	}, J = (e, t) => j((n) => new Map(n).set(e, t)), Qe = () => {
		oe("candidates"), x(""), C(""), T(1), O(/* @__PURE__ */ new Set()), A(/* @__PURE__ */ new Map()), j(/* @__PURE__ */ new Map()), N(""), P.current = null;
	}, $e = (e) => {
		ie(e), Qe(), a({
			category: e === "metadata_fields" ? "" : e,
			queue: m === "pending" ? "" : m
		});
	}, et = (e) => {
		h(e), Qe(), a({
			category: p === "metadata_fields" ? "" : p,
			queue: e === "pending" ? "" : e
		});
	}, X = We({
		mutationFn: ({ row: e, status: t, category: n }) => Ue(pe(n, I(n, e), t, q(e))),
		onSuccess: (e, { row: t, status: n, category: r }) => {
			e.ok ? (He(r, [t.item_key], n), Ze([t.item_key]), l(me(n))) : J(t.item_key, e.error || K("manage:reviewPage.decisionRejected"));
		},
		onError: (e, { row: t }) => J(t.item_key, R(e))
	}), Z = We({
		mutationFn: async ({ status: e, category: t, rows: n }) => {
			let r = [], i = [];
			for (let [a, o] of n.entries()) {
				if (!be.current) break;
				N(K("manage:reviewPage.processingProgress", {
					current: a,
					total: n.length
				}));
				try {
					let n = await Ue(pe(t, I(t, o), e, q(o)));
					if (!n.ok) throw Error(n.error || K("manage:reviewPage.itemNotAccepted"));
					r.push(o.item_key);
				} catch (e) {
					i.push([o.item_key, R(e)]);
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
			He(t, n, e), Ze(n), r.forEach(([e, t]) => J(e, t)), N("");
		},
		onError: (e) => {
			N(R(e));
		}
	}), tt = {
		receipt: l,
		failure: (e) => N(R(e))
	}, nt = {
		ignored: "rejected",
		later: "skipped"
	}, rt = (e, t) => {
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
				if (e === "approved" && V && n.some((e) => !q(e).candidateKey)) throw Error(K("manage:reviewPage.chooseSourceFirst"));
				return N(""), {
					title: t,
					body: K(`manage:reviewPage.confirm.${e}`, { count: n.length })
				};
			},
			run: async (t) => {
				n = await Z.mutateAsync({
					status: e,
					category: p,
					rows: [...t]
				});
				let { done: r } = n;
				if (e === "approved") return;
				let i = p, a = t.filter((e) => r.includes(e.item_key)), o = e === "restore" ? nt[m] : "restore";
				return async () => {
					for (let e of a) await Ue(pe(i, I(i, e), o, q(e)));
					await Oe.invalidateQueries({ queryKey: se });
				};
			},
			receipt: () => K({
				approved: "manage:reviewPage.approvedCount",
				rejected: "manage:reviewPage.ignoredCount",
				skipped: "manage:reviewPage.laterCount",
				restore: "manage:reviewPage.pendingCount"
			}[e], { count: n.done.length }) + (n.failures.length ? K("manage:reviewPage.notCompletedSuffix", { count: n.failures.length }) : "")
		};
	}, it = Ye.every((e) => de(p, e)), Q = [
		...m === "ignored" ? [] : [rt("rejected", K("manage:reviewToolbar.ignoreSelected"))],
		m === "pending" ? rt("skipped", K("manage:reviewToolbar.laterSelected")) : rt("restore", K("manage:reviewToolbar.restoreSelected")),
		...m === "ignored" ? [] : [rt("approved", K("manage:reviewToolbar.approveSelected"))]
	].map((e) => ({
		action: e,
		items: Ye,
		host: tt,
		disabled: Z.isPending || X.isPending || e.key === "approved" && !it
	})), at = (e) => {
		A((t) => {
			let n = new Map(t);
			for (let t of Ye) {
				let r = t.candidates?.find((t) => t.source === e);
				r && n.set(t.item_key, {
					...q(t),
					candidateKey: r.candidate_key
				});
			}
			return n;
		}), N(K("manage:reviewPage.sourceChosen", { source: e }));
	}, ot = async (e) => {
		if (fe) return;
		F(e), _e("");
		let t = await c(e);
		be.current && (F(0), _e(t));
	}, st = Ee(Ce.mirror, te), ct = Ce.genre_tags || [], lt = {
		openItem: o,
		openEntity: s,
		onReveal: ot,
		revealing: fe,
		revealNote: L,
		toast: l
	};
	return /* @__PURE__ */ (0, $.jsx)(Xe, { children: /* @__PURE__ */ (0, $.jsxs)("div", {
		className: "flex flex-col gap-5 pb-10",
		children: [
			H ? /* @__PURE__ */ (0, $.jsx)(g, {
				tone: "warning",
				title: K("manage:reviewPage.readOnly"),
				extra: re ? /* @__PURE__ */ (0, $.jsx)("p", {
					className: "text-body-2-regular",
					children: /* @__PURE__ */ (0, $.jsx)(ne, {
						href: re,
						children: K("manage:reviewPage.goToPrimary")
					})
				}) : void 0,
				children: st
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(St, { tags: ct }),
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-col gap-5 review-split:flex-row review-split:items-start review-split:gap-6",
				children: [/* @__PURE__ */ (0, $.jsxs)("div", {
					"data-section-nav": !0,
					className: "w-full min-w-0 review-split:sticky review-split:top-topbar review-split:w-review-tabs review-split:shrink-0",
					children: [/* @__PURE__ */ (0, $.jsx)("h2", {
						id: "reviewcategories",
						children: K("manage:reviewPage.categories")
					}), /* @__PURE__ */ (0, $.jsx)(w, {
						group: "review",
						label: K("manage:reviewPage.categories"),
						value: p,
						onChange: $e,
						orientation: n ? "horizontal" : "vertical",
						panelPrefix: "review",
						sectionItems: !0,
						className: "",
						itemClassName: Ht,
						disabled: X.isPending || Z.isPending,
						tabs: _.map((e) => {
							let t = Number(we.counts[e] || 0);
							return {
								value: e,
								label: v[e],
								badge: t ? /* @__PURE__ */ (0, $.jsx)("span", {
									className: "tabular-nums text-caption-1-medium text-text-secondary",
									children: t.toLocaleString()
								}) : null
							};
						})
					})]
				}), /* @__PURE__ */ (0, $.jsxs)("div", {
					role: "tabpanel",
					id: `review-panel-${p}`,
					"aria-labelledby": `review-tab-${p}`,
					className: "flex min-w-0 flex-1 flex-col gap-5",
					children: [
						/* @__PURE__ */ (0, $.jsx)(ht, {
							queueView: m,
							queueCounts: De,
							onQueueChange: et,
							locked: H,
							fields: ke,
							fieldFilter: Ae,
							onFieldFilter: (e) => {
								C(e), x(""), T(1);
							},
							groupOptions: Fe,
							groupBy: W,
							onGroupBy: (e) => {
								oe(e), x(""), T(1);
							},
							groups: Ie,
							filter: Le,
							onFilter: (e) => {
								x(e), T(1);
							},
							pageKeys: Be,
							allKeys: G.map((e) => e.item_key),
							selected: D,
							onSelected: O,
							selectedRows: Ye,
							metadata: V,
							busy: Z.isPending || X.isPending,
							feedback: M,
							onUnifySource: at,
							actions: Q
						}),
						Re.rows.length ? Ke.map((e) => /* @__PURE__ */ (0, $.jsxs)("section", {
							className: "flex flex-col gap-3",
							children: [Ke.length > 1 || W !== "candidates" ? /* @__PURE__ */ (0, $.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, $.jsx)("h3", {
									className: "text-body-medium text-text-primary",
									children: `${e.title} · ${e.rows.length}`
								}), H ? null : /* @__PURE__ */ (0, $.jsx)(r, {
									variant: "ghost",
									size: "small",
									onClick: () => {
										let t = e.rows.map((e) => e.item_key), n = t.every((e) => D.has(e)), r = new Set(D);
										for (let e of t) n ? r.delete(e) : r.add(e);
										O(r);
									},
									children: e.rows.every((e) => D.has(e.item_key)) ? K("manage:reviewPage.clearGroup") : K("manage:reviewPage.selectGroup")
								})]
							}) : null, /* @__PURE__ */ (0, $.jsx)("div", {
								className: "review-grid gap-5",
								children: e.rows.map((e) => /* @__PURE__ */ (0, $.jsx)(Vt, {
									category: p,
									row: e,
									queueView: m,
									choice: q(e),
									onChoice: (t) => A((n) => new Map(n).set(e.item_key, t)),
									selected: D.has(e.item_key),
									onSelect: (t, n) => O((r) => {
										let i = new Set(r);
										return P.current = ze(i, Be, P.current, e.item_key, t, n), i;
									}),
									locked: H,
									busy: Z.isPending || X.isPending && X.variables?.row.item_key === e.item_key,
									problem: ue.get(e.item_key) || "",
									genreTags: ct,
									onDecide: (t) => {
										X.isPending || Z.isPending || (j((t) => new Map([...t].filter(([t]) => t !== e.item_key))), X.mutate({
											row: e,
											status: t,
											category: p
										}));
									},
									handlers: lt
								}, e.item_key))
							})]
						}, e.key)) : z.isError && !z.data ? /* @__PURE__ */ (0, $.jsx)(g, {
							tone: "error",
							title: K("manage:reviewPage.queueLoadFailed"),
							action: /* @__PURE__ */ (0, $.jsx)(r, {
								variant: "secondary",
								size: "small",
								disabled: z.isFetching,
								onClick: () => void z.refetch(),
								children: K("manage:shared.retryNow")
							}),
							children: R(z.error)
						}) : /* @__PURE__ */ (0, $.jsx)(f, {
							icon: Te,
							title: K({
								pending: "manage:reviewPage.emptyPending",
								later: "manage:reviewPage.emptyLater",
								ignored: "manage:reviewPage.emptyIgnored"
							}[m]),
							actions: _.some((e) => e !== p && Number(we.counts[e] || 0) > 0) ? /* @__PURE__ */ (0, $.jsx)(r, {
								size: "small",
								onClick: () => {
									let e = t.find((e) => e !== p && Number(we.counts[e] || 0) > 0);
									e && $e(e);
								},
								children: K("manage:reviewPage.viewOtherCategories")
							}) : void 0,
							children: K(m === "pending" ? "manage:reviewPage.switchCategoryHint" : m === "later" ? "manage:reviewPage.laterKeptHint" : "manage:reviewPage.ignoredKeptHint")
						}),
						G.length ? /* @__PURE__ */ (0, $.jsx)(d, {
							label: K("manage:reviewPage.footerLabel"),
							total: G.length,
							pagination: {
								pageIndex: Re.page - 1,
								pageSize: E
							},
							onChange: (e) => {
								T(e.pageIndex + 1), le(e.pageSize);
							}
						}) : null,
						V && m === "pending" ? /* @__PURE__ */ (0, $.jsx)(mt, {
							locked: H,
							openItem: o,
							toast: l
						}) : null
					]
				})]
			})
		]
	}) });
}
export { Ut as ReviewPage };

//# debugId=5ab8ce5a-87ff-400d-80b8-0912ee9080fb