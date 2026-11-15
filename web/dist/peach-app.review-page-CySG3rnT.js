(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "f5412ec5-4ed9-4669-bfc4-a9b1c8863a8a", e._sentryDebugIdIdentifier = "sentry-dbid-f5412ec5-4ed9-4669-bfc4-a9b1c8863a8a");
	} catch {}
})();
import { $ea3928288112382f$export$439d29a4e110a164 as e, $fe21c36db05242bb$export$a98f0dcb43a68a25 as t, $fe21c36db05242bb$export$d7b12c4107be0d61 as n, Button as r, ButtonLink as i, Checkbox as a, CheckboxGlyph as o, Chip as s, CollapseChevron as c, CollapseRegion as l, DEFAULT_CATEGORY as u, DataTableFooter as d, ENTITY_REVIEW_KINDS as f, Ea as p, EmptyState as m, ExternalLink as h, FIELDSET_FOOT as ee, FilterGlassRows as g, Gg as _, InputBase as v, LinkButton as te, Note as y, REVIEW_CATEGORIES as b, REVIEW_DECISION_LABELS as ne, REVIEW_KEY as re, REVIEW_LABELS as x, REVIEW_QUEUES as ie, REVIEW_QUEUE_LABELS as S, Select as C, SelectItem as w, SelectionActions as T, SelectionDock as ae, SortableBoardTabs as E, TextField as D, Wt as O, __toESM as k, apiGet as A, apiSend as j, avatarInner as M, busyProps as N, canApprove as oe, cardClass as P, codedText as se, commonReviewSources as F, composingKey as ce, currentReviewRow as le, cx as I, decisionPayload as ue, decisionReceipt as de, defaultChoice as fe, enterPageSelection as pe, errorMessage as L, exitPageSelection as me, fetchReview as he, filterReviewRows as ge, groupReviewRows as _e, isReviewCategory as ve, joinList as ye, l7 as be, localTime as xe, m7 as Se, mirrorText as Ce, pendingGenres as we, queryClient as Te, quoted as Ee, recordGenre as R, reloadReview as De, require_jsx_runtime as Oe, require_react as ke, reviewGroupingOptions as Ae, reviewQueueData as je, reviewQueueOf as Me, reviewWindow as Ne, rowEvidence as z, rowFieldName as B, rowSubject as V, rowTags as Pe, rowTitle as Fe, selectReviewRange as Ie, serverLabel as H, serverLabelList as Le, settleReviewRows as Re, submitDecision as ze, t as U, useMutation as Be, useNavigationOrder as Ve, useOverlayScrollbar as W, usePageSelection as He, useQuery as Ue, useViewGlide as We } from "./peach-app.js";
import { Page as Ge } from "./peach-app.page-QAncjzM1.js";
import { DataTable as Ke } from "./peach-app.data-table-DYj6ojEJ.js";
import { LEGACY_AVATAR_IMG as qe } from "./peach-app.legacy-avatar-NSITxLRS.js";
// src/react/review/auto-landings.ts
var G = /* @__PURE__ */ k(ke(), 1), Je = "/api/review/auto-landings", Ye = "/api/review/auto-landings/revert", Xe = ["review", "auto-landings"], K = (e) => H(e.field_code ?? "", e.field), q = (e) => H(e.label_code ?? "", e.label), Ze = (e) => A(Je, e), Qe = (e) => A(`${Je}?items=${encodeURIComponent(e.join("\n"))}`), $e = (e, t) => j(Ye, {
	items: e,
	token: t
}), et = (e) => e.at === null ? "" : xe((/* @__PURE__ */ new Date(e.at * 1e3)).toISOString()), J = (e) => e.code || e.name || (e.asset_id ? `#${e.asset_id}` : U("manage:autoLandings.unknownVideo")), tt = (e) => e ? Ee(e) : U("manage:autoLandings.emptyValue"), Y = (e) => e.tags.length ? ye(e.tags) : e.value, X = (e) => e.tags.length ? U("manage:autoLandings.existingTagsKept") : U("manage:autoLandings.previousValue", { value: e.previous.length ? ye(e.previous.map(tt)) : U("manage:autoLandings.emptyValue") });
function nt(e) {
	return [
		...e.restores.map((e) => U("manage:autoLandings.previewRestore", {
			video: J(e),
			field: K(e),
			current: tt(e.current),
			previous: tt(e.previous)
		})),
		...e.tags.map((e) => U("manage:autoLandings.previewRemoveTag", {
			video: J(e),
			tag: e.tag
		})),
		...e.changed.map((e) => e.gone ? U("manage:autoLandings.previewGone", {
			video: J(e),
			field: K(e)
		}) : U("manage:autoLandings.previewEdited", {
			video: J(e),
			field: K(e)
		}))
	];
}
function rt(e) {
	let t = [e.restores.length ? U("manage:autoLandings.previewRestoreCount", { count: e.restores.length }) : "", e.tags.length ? U("manage:autoLandings.previewRemoveTags", { count: e.tags.length }) : ""].filter(Boolean);
	return [
		t.length ? U("manage:autoLandings.previewRevert", {
			count: e.decisions,
			details: t.join(U("shell:format.clauseSeparator"))
		}) : U("manage:autoLandings.previewRevertNothing", { count: e.decisions }),
		e.changed.length ? U("manage:autoLandings.previewUnchanged", { count: e.changed.length }) : "",
		U("manage:autoLandings.revertBackupNote")
	].filter(Boolean).join(U("shell:format.sentenceGap"));
}
function Z(e) {
	let t = [e.restored ? U("manage:autoLandings.resultRestoreCount", { count: e.restored }) : "", e.removed_tags ? U("manage:autoLandings.resultRemovedTags", { count: e.removed_tags }) : ""].filter(Boolean);
	return t.length ? U("manage:autoLandings.resultSummaryDetails", {
		count: e.decisions,
		details: t.join(U("shell:format.clauseSeparator"))
	}) : U("manage:autoLandings.resultSummary", { count: e.decisions });
}
// src/react/review/auto-landings-card.tsx
var Q = Oe(), it = U("manage:autoLandings.description");
function at({ item: t, openItem: n }) {
	let r = t.asset_id && !t.gone ? () => n(t.asset_id) : void 0;
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, Q.jsxs)("button", {
			type: "button",
			disabled: !r,
			onClick: r,
			className: "flex aspect-card-cover w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-media-placeholder outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default",
			children: [t.preview_url ? /* @__PURE__ */ (0, Q.jsx)("img", {
				src: t.preview_url,
				alt: "",
				loading: "lazy",
				className: "size-full object-cover"
			}) : /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-caption-1-regular text-text-secondary",
				children: U("manage:shared.noCover")
			}), /* @__PURE__ */ (0, Q.jsx)(e, { children: U("manage:autoLandings.openVideo", { name: J(t) }) })]
		}), /* @__PURE__ */ (0, Q.jsxs)("span", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: [J(t), t.assets > 1 ? /* @__PURE__ */ (0, Q.jsx)("small", {
					className: "ml-1 text-caption-1-regular text-text-secondary",
					children: U("manage:autoLandings.fileCount", { count: t.assets })
				}) : null]
			}), /* @__PURE__ */ (0, Q.jsx)("small", {
				title: t.name,
				className: "truncate text-caption-1-regular text-text-secondary",
				children: t.gone ? U("manage:autoLandings.videoGone") : t.name
			})]
		})]
	});
}
function ot({ item: e }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-0.5",
		children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
			title: Y(e),
			className: "truncate text-body-regular text-text-primary",
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-text-secondary",
				children: U("shell:format.labelPrefix", { label: K(e) })
			}), Y(e)]
		}), /* @__PURE__ */ (0, Q.jsx)("small", {
			title: X(e),
			className: "truncate text-caption-1-regular text-text-secondary",
			children: X(e)
		})]
	});
}
function st({ locked: e, openItem: t, toast: n }) {
	let [r, i] = (0, G.useState)([]), [a, o] = (0, G.useState)(null), s = Ue({
		queryKey: Xe,
		queryFn: ({ signal: e }) => Ze(e)
	}), c = s.data?.items ?? [], l = (e) => {
		let t = null, n = null;
		return {
			key: "revert",
			label: U("manage:autoLandings.revertSelected", { count: e }),
			reversal: "irreversible",
			confirm: async (e) => (t = await Qe(e.map((e) => e.item_key)), {
				title: U("manage:autoLandings.revertTitle"),
				body: rt(t),
				items: nt(t),
				confirmLabel: U("manage:shared.revert")
			}),
			run: async () => {
				n = await $e(t.items, t.token), o(n), Te.invalidateQueries({ queryKey: re });
			},
			receipt: () => n ? Z(n) : ""
		};
	}, u = {
		receipt: n,
		failure: (e) => n(L(e))
	};
	if (!c.length && !a && !s.isError) return null;
	let d = [
		{
			id: "work",
			label: U("manage:shared.video"),
			width: 300,
			min: 240,
			value: (e) => J(e),
			render: (e) => /* @__PURE__ */ (0, Q.jsx)(at, {
				item: e,
				openItem: t
			})
		},
		{
			id: "written",
			label: U("manage:autoLandings.columnWritten"),
			width: 320,
			min: 220,
			value: (e) => `${K(e)}${Y(e)}`,
			render: (e) => /* @__PURE__ */ (0, Q.jsx)(ot, { item: e })
		},
		{
			id: "rule",
			label: U("manage:autoLandings.columnRuleTime"),
			width: 176,
			min: 144,
			value: (e) => e.at ?? 0,
			render: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
				title: e.batch,
				className: "flex min-w-0 flex-col gap-0.5 text-text-secondary",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "truncate text-body-2-regular",
					children: q(e)
				}), /* @__PURE__ */ (0, Q.jsx)("small", {
					className: "tabular-nums text-caption-1-regular",
					children: et(e) || U("manage:autoLandings.timeUnknown")
				})]
			})
		}
	];
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-labelledby": "auto-landings-title",
		className: "flex flex-col gap-4",
		children: [a ? /* @__PURE__ */ (0, Q.jsxs)(y, {
			tone: "success",
			title: Z(a),
			children: [/* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular",
				children: U("manage:autoLandings.backupDone", { path: a.backup })
			}), a.changed.length ? /* @__PURE__ */ (0, Q.jsxs)("p", {
				className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-2-regular",
				children: [U("manage:autoLandings.leftUnchanged", { count: a.changed.length }), a.changed.map((e) => e.gone ? /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-text-secondary",
					children: U("manage:autoLandings.deletedAsset", { id: e.asset_id })
				}, `${e.asset_id}:${e.field}`) : /* @__PURE__ */ (0, Q.jsx)(te, {
					size: "small",
					onClick: () => t(e.asset_id),
					children: J(e)
				}, `${e.asset_id}:${e.field}`))]
			}) : null]
		}) : null, s.isError ? /* @__PURE__ */ (0, Q.jsx)(y, {
			tone: "error",
			title: U("manage:autoLandings.loadFailed"),
			children: L(s.error)
		}) : c.length ? /* @__PURE__ */ (0, Q.jsx)(Ke, {
			label: U("manage:autoLandings.title"),
			items: c,
			columns: d,
			title: U("manage:autoLandings.title"),
			titleId: "auto-landings-title",
			unit: U("manage:autoLandings.unit"),
			description: it,
			rowId: (e) => e.item_key,
			rowLabel: (e) => `${J(e)} ${K(e)}`,
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
	let { groupOptions: t, groupBy: n, onGroupBy: i, groups: a, filter: o, onFilter: s, pageKeys: c, selected: l, onSelected: u, selectedRows: d, metadata: f, busy: p, feedback: m, onUnifySource: h, actions: ee, queueView: _ = "pending", queueCounts: v, onQueueChange: te, locked: y, fields: b, fieldFilter: ne, onFieldFilter: re } = e, x = c.filter((e) => l.has(e)), T = x.length > 0 && x.length === c.length, E = F(d), D = f && d.some((e) => (e.candidates?.length || 0) > 1), O = E.length ? U("manage:reviewToolbar.sourceForAll") : U("manage:reviewToolbar.noCommonSource"), k = (0, G.useRef)(null), A = (0, G.useRef)(null), j = (0, G.useRef)(null), [M, N] = (0, G.useState)(!1), oe = We(k, A, "[data-entity-state][aria-pressed=\"true\"]", _);
	return (0, G.useLayoutEffect)(() => {
		let e = A.current, t = j.current, n = e?.parentElement, r = e?.closest("[data-review-filter]");
		if (!e || !t || !n || !r) return;
		let i = () => N(t.offsetHeight > 0 && Math.abs(n.getBoundingClientRect().top - t.getBoundingClientRect().top) < 1), a = new ResizeObserver(i);
		for (let n of [
			r,
			e,
			t
		]) a.observe(n);
		return i(), () => a.disconnect();
	}, []), /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(g, {
		label: U("manage:reviewToolbar.filters"),
		topLabel: U("manage:reviewToolbar.processingStatus"),
		attrs: { "data-review-filter": "" },
		className: "mb-0 flex-row flex-wrap",
		topClassName: "max-w-full flex-none",
		bottomClassName: c.length ? "min-h-12 max-w-full flex-none flex-wrap" : "hidden",
		bottomRef: j,
		panes: /* @__PURE__ */ (0, Q.jsx)("span", {
			ref: k,
			"data-view-glide": "",
			"aria-hidden": "true"
		}),
		top: /* @__PURE__ */ (0, Q.jsxs)("div", {
			ref: A,
			role: "group",
			"aria-label": U("manage:reviewToolbar.reviewStatus"),
			"data-entity-states": "",
			onPointerLeave: oe.leave,
			children: [ie.map((e) => /* @__PURE__ */ (0, Q.jsxs)("button", {
				type: "button",
				"data-entity-state": e,
				"data-entity-press": "",
				disabled: p,
				"aria-pressed": _ === e,
				onPointerEnter: oe.hover,
				onClick: () => {
					e !== _ && te(e);
				},
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						"data-copy-key": `review.queue.${e}`,
						children: S[e]
					}),
					" ",
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "ms-1.5 tabular-nums text-caption-1-medium text-text-secondary",
						children: v ? v[e].toLocaleString() : "…"
					})
				]
			}, e)), /* @__PURE__ */ (0, Q.jsx)("span", {
				"data-entity-sep": "",
				"aria-hidden": "true",
				className: M ? void 0 : "invisible"
			})]
		}),
		bottom: c.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
			f && b.length ? /* @__PURE__ */ (0, Q.jsxs)(C, {
				"aria-label": U("manage:reviewToolbar.filterField"),
				size: "sm",
				prefix: /* @__PURE__ */ (0, Q.jsx)("span", {
					"data-copy-key": "review.filter.field",
					className: "pointer-events-auto",
					children: U("manage:reviewToolbar.field")
				}),
				selectedKey: ne || "*",
				isDisabled: p,
				onSelectionChange: (e) => {
					e !== null && re(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, Q.jsx)(w, {
					id: "*",
					children: U("manage:shared.all")
				}), b.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(C, {
				"aria-label": U("manage:reviewToolbar.groupBy"),
				size: "sm",
				selectedKey: n,
				onSelectionChange: (e) => {
					e !== null && i(String(e));
				},
				children: t.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e,
					children: t
				}, e))
			}),
			a.length > 1 ? /* @__PURE__ */ (0, Q.jsxs)(C, {
				"aria-label": U(n === "field" ? "manage:reviewToolbar.filterFieldGroup" : "manage:reviewToolbar.filterGroup"),
				size: "sm",
				prefix: U("manage:reviewToolbar.group"),
				selectedKey: o || "*",
				onSelectionChange: (e) => {
					e !== null && s(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, Q.jsx)(w, {
					id: "*",
					children: U("manage:shared.all")
				}), a.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			y ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: be,
				"aria-pressed": T,
				disabled: p,
				onClick: () => {
					let e = new Set(l);
					for (let t of c) T ? e.delete(t) : e.add(t);
					u(e);
				},
				children: U(T ? "manage:reviewToolbar.clearSelection" : o ? "manage:reviewToolbar.selectGroup" : "manage:reviewToolbar.selectPage")
			})
		] }) : null
	}), /* @__PURE__ */ (0, Q.jsxs)(ae, {
		label: U("manage:reviewToolbar.selectedDock"),
		visible: !y && l.size > 0,
		count: U("manage:reviewToolbar.selectedCount", { count: l.size }),
		actions: ee,
		leading: D && _ !== "ignored" ? /* @__PURE__ */ (0, Q.jsxs)(C, {
			"aria-label": U("manage:reviewToolbar.sourceForAll"),
			size: "sm",
			selectedKey: "",
			isDisabled: p || !E.length,
			onSelectionChange: (e) => {
				e !== null && e !== "" && h(String(e));
			},
			children: [/* @__PURE__ */ (0, Q.jsx)(w, {
				id: "",
				children: O
			}), E.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
				id: e,
				children: e
			}, e))]
		}) : null,
		children: [/* @__PURE__ */ (0, Q.jsx)(r, {
			variant: "ghost",
			size: "small",
			disabled: p,
			onClick: me,
			children: U("manage:reviewToolbar.deselect")
		}), m ? /* @__PURE__ */ (0, Q.jsx)("p", {
			role: "status",
			className: "w-full text-body-2-regular text-text-secondary",
			children: m
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
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		"aria-hidden": !0,
		className: I("relative flex shrink-0 items-center justify-center rounded-full", i.dot, n && "ring-2 ring-border-focus-ring ring-offset-2", r),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("span", { className: I("absolute inset-0 rounded-full border-border-checkbox-default bg-background-primary-default shadow-xs", "transition-opacity duration-200 ease", i.border, e && "opacity-0") }),
			/* @__PURE__ */ (0, Q.jsx)("span", { className: I("absolute inset-0 rounded-full", "transition-opacity duration-200 ease", i.selected, !e && "opacity-0") }),
			/* @__PURE__ */ (0, Q.jsx)("span", { className: I("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-control-indicator-background", "transition-[scale,opacity] duration-200 ease", i.inner, e ? "scale-100 opacity-100" : "scale-0 opacity-0") })
		]
	});
}
function dt({ className: e, children: n, ref: r, ...i }) {
	return /* @__PURE__ */ (0, Q.jsx)(t, {
		ref: r,
		...i,
		className: (t) => I("flex flex-col gap-2", typeof e == "function" ? e(t) : e),
		children: n
	});
}
// src/react/boardui/components/base/radio/radio-card.tsx
function ft({ className: e, title: t, description: r, ref: i, ...a }) {
	return /* @__PURE__ */ (0, Q.jsx)(n, {
		ref: i,
		...a,
		className: (t) => I("group flex w-full items-center justify-between gap-3 rounded-2lg border border-border-button-default py-3 pe-5 ps-4 select-none", "transition-colors duration-150 ease", t.isHovered && !t.isDisabled ? "bg-background-primary-hover" : "bg-background-primary-default", t.isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", typeof e == "function" ? e(t) : e),
		children: (e) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
			className: "flex min-w-0 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: t
			}), r != null && /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "truncate text-body-regular text-text-secondary",
				children: r
			})]
		}), /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "flex shrink-0 items-center py-1",
			children: /* @__PURE__ */ (0, Q.jsx)(ut, {
				size: "md",
				selected: e.isSelected,
				focusVisible: e.isFocusVisible
			})
		})] })
	});
}
// node_modules/diff/libesm/diff/base.js
var $ = class {
	diff(e, t, n = {}) {
		let r;
		typeof n == "function" ? (r = n, n = {}) : "callback" in n && (r = n.callback);
		let i = this.castInput(e, n), a = this.castInput(t, n), o = this.removeEmpty(this.tokenize(i, n)), s = this.removeEmpty(this.tokenize(a, n));
		return this.diffWithOptionsObj(o, s, n, r);
	}
	diffWithOptionsObj(e, t, n, r) {
		let i = (e) => {
			if (e = this.postProcess(e, n), r) setTimeout(function() {
				r(e);
			}, 0);
			else return e;
		}, a = t.length, o = e.length, s = 1, c = a + o;
		n.maxEditLength != null && (c = Math.min(c, n.maxEditLength));
		let l = n.timeout ?? Infinity, u = Date.now() + l, d = [{
			oldPos: -1,
			lastComponent: void 0
		}], f = this.extractCommon(d[0], t, e, 0, n);
		if (d[0].oldPos + 1 >= o && f + 1 >= a) return i(this.buildValues(d[0].lastComponent, t, e));
		let p = -Infinity, m = Infinity, h = () => {
			for (let r = Math.max(p, -s); r <= Math.min(m, s); r += 2) {
				let s, c = d[r - 1], l = d[r + 1];
				c && (d[r - 1] = void 0);
				let u = !1;
				if (l) {
					let e = l.oldPos - r;
					u = l && 0 <= e && e < a;
				}
				let h = c && c.oldPos + 1 < o;
				if (!u && !h) d[r] = void 0;
				else {
					if (s = !h || u && c.oldPos < l.oldPos ? this.addToPath(l, !0, !1, 0, n) : this.addToPath(c, !1, !0, 1, n), f = this.extractCommon(s, t, e, r, n), s.oldPos + 1 >= o && f + 1 >= a) return i(this.buildValues(s.lastComponent, t, e)) || !0;
					d[r] = s, s.oldPos + 1 >= o && (m = Math.min(m, r - 1)), f + 1 >= a && (p = Math.max(p, r + 1));
				}
			}
			s++;
		};
		if (r) (function e() {
			setTimeout(function() {
				if (s > c || Date.now() > u) return r(void 0);
				h() || e();
			}, 0);
		})();
		else for (; s <= c && Date.now() <= u;) {
			let e = h();
			if (e) return e;
		}
	}
	addToPath(e, t, n, r, i) {
		let a = e.lastComponent;
		return a && !i.oneChangePerToken && a.added === t && a.removed === n ? {
			oldPos: e.oldPos + r,
			lastComponent: {
				count: a.count + 1,
				added: t,
				removed: n,
				previousComponent: a.previousComponent
			}
		} : {
			oldPos: e.oldPos + r,
			lastComponent: {
				count: 1,
				added: t,
				removed: n,
				previousComponent: a
			}
		};
	}
	extractCommon(e, t, n, r, i) {
		let a = t.length, o = n.length, s = e.oldPos, c = s - r, l = 0;
		for (; c + 1 < a && s + 1 < o && this.equals(n[s + 1], t[c + 1], i);) c++, s++, l++, i.oneChangePerToken && (e.lastComponent = {
			count: 1,
			previousComponent: e.lastComponent,
			added: !1,
			removed: !1
		});
		return l && !i.oneChangePerToken && (e.lastComponent = {
			count: l,
			previousComponent: e.lastComponent,
			added: !1,
			removed: !1
		}), e.oldPos = s, c;
	}
	equals(e, t, n) {
		return n.comparator ? n.comparator(e, t) : e === t || !!n.ignoreCase && e.toLowerCase() === t.toLowerCase();
	}
	removeEmpty(e) {
		let t = [];
		for (let n = 0; n < e.length; n++) e[n] && t.push(e[n]);
		return t;
	}
	castInput(e, t) {
		return e;
	}
	tokenize(e, t) {
		return Array.from(e);
	}
	join(e) {
		return e.join("");
	}
	postProcess(e, t) {
		return e;
	}
	get useLongestToken() {
		return !1;
	}
	buildValues(e, t, n) {
		let r = [], i;
		for (; e;) r.push(e), i = e.previousComponent, delete e.previousComponent, e = i;
		r.reverse();
		let a = r.length, o = 0, s = 0, c = 0;
		for (; o < a; o++) {
			let e = r[o];
			if (e.removed) e.value = this.join(n.slice(c, c + e.count)), c += e.count;
			else {
				if (!e.added && this.useLongestToken) {
					let r = t.slice(s, s + e.count);
					r = r.map(function(e, t) {
						let r = n[c + t];
						return r.length > e.length ? r : e;
					}), e.value = this.join(r);
				} else e.value = this.join(t.slice(s, s + e.count));
				s += e.count, e.added || (c += e.count);
			}
		}
		return r;
	}
}, pt = new class extends $ {}();
function mt(e, t, n) {
	return pt.diff(e, t, n);
}
// node_modules/diff/libesm/util/string.js
function ht(e, t) {
	let n = 0;
	for (; n < e.length && n < t.length; n++) if (e[n] != t[n]) return e.slice(0, n);
	return e.slice(0, n);
}
function gt(e, t) {
	let n;
	if (!e || !t || e[e.length - 1] != t[t.length - 1]) return "";
	for (n = 0; n < e.length && n < t.length; n++) if (e[e.length - (n + 1)] != t[t.length - (n + 1)]) return e.slice(-n);
	return e.slice(-n);
}
function _t(e, t, n) {
	if (e.slice(0, t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't start with prefix ${JSON.stringify(t)}; this is a bug`);
	return n + e.slice(t.length);
}
function vt(e, t, n) {
	if (!t) return e + n;
	if (e.slice(-t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't end with suffix ${JSON.stringify(t)}; this is a bug`);
	return e.slice(0, -t.length) + n;
}
function yt(e, t) {
	return _t(e, t, "");
}
function bt(e, t) {
	return vt(e, t, "");
}
function xt(e, t) {
	return t.slice(0, St(e, t));
}
function St(e, t) {
	let n = 0;
	e.length > t.length && (n = e.length - t.length);
	let r = t.length;
	e.length < t.length && (r = e.length);
	let i = Array(r), a = 0;
	i[0] = 0;
	for (let e = 1; e < r; e++) {
		for (t[e] == t[a] ? i[e] = i[a] : i[e] = a; a > 0 && t[e] != t[a];) a = i[a];
		t[e] == t[a] && a++;
	}
	a = 0;
	for (let r = n; r < e.length; r++) {
		for (; a > 0 && e[r] != t[a];) a = i[a];
		e[r] == t[a] && a++;
	}
	return a;
}
function Ct(e, t) {
	let n = [];
	for (let r of Array.from(t.segment(e))) {
		let e = r.segment;
		n.length && /\s/.test(n[n.length - 1]) && /\s/.test(e) ? n[n.length - 1] += e : n.push(e);
	}
	return n;
}
function wt(e, t) {
	if (t) return Et(e, t)[1];
	let n;
	for (n = e.length - 1; n >= 0 && e[n].match(/\s/); n--);
	return e.substring(n + 1);
}
function Tt(e, t) {
	if (t) return Et(e, t)[0];
	let n = e.match(/^\s*/);
	return n ? n[0] : "";
}
function Et(e, t) {
	if (!t) return [Tt(e), wt(e)];
	if (t.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
	let n = Ct(e, t), r = n[0], i = n[n.length - 1];
	return [/\s/.test(r) ? r : "", /\s/.test(i) ? i : ""];
}
// node_modules/diff/libesm/diff/word.js
var Dt = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}", Ot = RegExp(`[${Dt}]+|\\s+|[^${Dt}]`, "ug");
new class extends $ {
	equals(e, t, n) {
		return n.ignoreCase && (e = e.toLowerCase(), t = t.toLowerCase()), e.trim() === t.trim();
	}
	tokenize(e, t = {}) {
		let n;
		if (t.intlSegmenter) {
			let r = t.intlSegmenter;
			if (r.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
			n = Ct(e, r);
		} else n = e.match(Ot) || [];
		let r = [], i = null;
		return n.forEach((e) => {
			/\s/.test(e) ? i == null ? r.push(e) : r.push(r.pop() + e) : i != null && /\s/.test(i) ? r[r.length - 1] == i ? r.push(r.pop() + e) : r.push(i + e) : r.push(e), i = e;
		}), r;
	}
	join(e) {
		return e.map((e, t) => t == 0 ? e : e.replace(/^\s+/, "")).join("");
	}
	postProcess(e, t) {
		if (!e || t.oneChangePerToken) return e;
		let n = null, r = null, i = null;
		return e.forEach((e) => {
			e.added ? r = e : e.removed ? i = e : ((r || i) && kt(n, i, r, e, t.intlSegmenter), n = e, r = null, i = null);
		}), (r || i) && kt(n, i, r, null, t.intlSegmenter), e;
	}
}();
function kt(e, t, n, r, i) {
	if (t && n) {
		let [a, o] = Et(t.value, i), [s, c] = Et(n.value, i);
		if (e) {
			let r = ht(a, s);
			e.value = vt(e.value, s, r), t.value = yt(t.value, r), n.value = yt(n.value, r);
		}
		if (r) {
			let e = gt(o, c);
			r.value = _t(r.value, c, e), t.value = bt(t.value, e), n.value = bt(n.value, e);
		}
	} else if (n) {
		if (e) {
			let e = Tt(n.value, i);
			n.value = n.value.substring(e.length);
		}
		if (r) {
			let e = Tt(r.value, i);
			r.value = r.value.substring(e.length);
		}
	} else if (e && r) {
		let n = Tt(r.value, i), [a, o] = Et(t.value, i), s = ht(n, a);
		t.value = yt(t.value, s);
		let c = gt(yt(n, s), o);
		t.value = bt(t.value, c), r.value = _t(r.value, n, c), e.value = vt(e.value, n, n.slice(0, n.length - c.length));
	} else if (r) {
		let e = Tt(r.value, i), n = xt(wt(t.value, i), e);
		t.value = bt(t.value, n);
	} else if (e) {
		let n = xt(wt(e.value, i), Tt(t.value, i));
		t.value = yt(t.value, n);
	}
}
new class extends $ {
	tokenize(e) {
		let t = RegExp(`(\\r?\\n)|[${Dt}]+|[^\\S\\n\\r]+|[^${Dt}]`, "ug");
		return e.match(t) || [];
	}
}(), new class extends $ {
	constructor() {
		super(...arguments), this.tokenize = At;
	}
	equals(e, t, n) {
		return n.ignoreWhitespace ? (n.newlineIsToken && e.includes("\n") || (e = e.trim()), n.newlineIsToken && t.includes("\n") || (t = t.trim())) : n.ignoreNewlineAtEof && !n.newlineIsToken && (e.endsWith("\n") && (e = e.slice(0, -1)), t.endsWith("\n") && (t = t.slice(0, -1))), super.equals(e, t, n);
	}
}();
function At(e, t) {
	t.stripTrailingCr && (e = e.replace(/\r\n/g, "\n"));
	let n = [], r = e.split(/(\n|\r\n)/);
	r[r.length - 1] || r.pop();
	for (let e = 0; e < r.length; e++) {
		let i = r[e];
		e % 2 && !t.newlineIsToken ? n[n.length - 1] += i : n.push(i);
	}
	return n;
}
// node_modules/diff/libesm/diff/sentence.js
function jt(e) {
	return e == "." || e == "!" || e == "?";
}
new class extends $ {
	tokenize(e) {
		let t = [], n = 0;
		for (let r = 0; r < e.length; r++) {
			if (r == e.length - 1) {
				t.push(e.slice(n));
				break;
			}
			if (jt(e[r]) && e[r + 1].match(/\s/)) {
				for (t.push(e.slice(n, r + 1)), r = n = r + 1; e[r + 1]?.match(/\s/);) r++;
				t.push(e.slice(n, r + 1)), n = r + 1;
			}
		}
		return t;
	}
}(), new class extends $ {
	tokenize(e) {
		return e.split(/([{}:;,]|\s+)/);
	}
}(), new class extends $ {
	constructor() {
		super(...arguments), this.tokenize = At;
	}
	get useLongestToken() {
		return !0;
	}
	castInput(e, t) {
		let { undefinedReplacement: n, stringifyReplacer: r = (e, t) => t === void 0 ? n : t } = t;
		return typeof e == "string" ? e : JSON.stringify(Mt(e, null, null, r), null, "  ");
	}
	equals(e, t, n) {
		return super.equals(e.replace(/,([\r\n])/g, "$1"), t.replace(/,([\r\n])/g, "$1"), n);
	}
}();
function Mt(e, t, n, r, i) {
	t ||= [], n ||= [], r && (e = r(i === void 0 ? "" : i, e));
	let a = 0;
	for (; a < t.length; a += 1) if (t[a] === e) return n[a];
	let o;
	if (Object.prototype.toString.call(e) === "[object Array]") {
		for (t.push(e), o = Array(e.length), n.push(o), a = 0; a < e.length; a += 1) o[a] = Mt(e[a], t, n, r, String(a));
		return t.pop(), n.pop(), o;
	}
	if (e && e.toJSON && (e = e.toJSON()), typeof e == "object" && e) {
		t.push(e), o = {}, n.push(o);
		let i = [], s;
		for (s in e)
 /* istanbul ignore else */
		Object.prototype.hasOwnProperty.call(e, s) && i.push(s);
		for (i.sort(), a = 0; a < i.length; a += 1) s = i[a], o[s] = Mt(e[s], t, n, r, s);
		t.pop(), n.pop();
	} else o = e;
	return o;
}
new class extends $ {
	tokenize(e) {
		return e.slice();
	}
	join(e) {
		return e;
	}
	removeEmpty(e) {
		return e;
	}
}();
// src/react/review/comparison-text.tsx
function Nt({ value: e, reference: t }) {
	let n = (0, G.useMemo)(() => t ? mt(t, e).filter((e) => !e.removed) : [{
		value: e,
		added: !1
	}], [e, t]);
	return /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: n.map((e, t) => e.added ? /* @__PURE__ */ (0, Q.jsx)("mark", {
		"data-review-difference": "",
		className: "rounded-sm bg-status-yellow-background text-status-yellow-text",
		children: e.value
	}, t) : /* @__PURE__ */ (0, Q.jsx)("span", { children: e.value }, t)) });
}
// src/react/review/candidate-form.tsx
var Pt = {
	title: U("manage:shared.title"),
	original_title: U("manage:reviewCandidate.originalTitle"),
	runtime: U("manage:reviewCandidate.sourceRuntime"),
	director: U("manage:reviewCandidate.director"),
	label: "Label",
	poster_url: U("manage:reviewCandidate.poster"),
	cover_url: U("manage:shared.cover"),
	screenshot_urls: U("manage:reviewCandidate.screenshots"),
	trailer_url: U("manage:reviewCandidate.trailer")
}, Ft = "reviewgenretags";
function It({ tags: e }) {
	return e.length ? /* @__PURE__ */ (0, Q.jsx)("datalist", {
		id: Ft,
		children: e.map((e) => /* @__PURE__ */ (0, Q.jsx)("option", { value: e }, e))
	}) : null;
}
function Lt({ candidate: e, row: t }) {
	let [n, i] = (0, G.useState)(!1), a = (0, G.useId)(), o = Object.entries(e.catalog_evidence || {}).filter(([, e]) => e && e.display_value);
	return o.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, Q.jsxs)(r, {
			variant: "secondary",
			size: "small",
			leadingIcon: c,
			"aria-expanded": n,
			"aria-controls": a,
			"aria-label": U(n ? "manage:reviewCandidate.collapseEvidence" : "manage:reviewCandidate.expandEvidence", { source: e.source || U("manage:reviewCandidate.thisSource") }),
			onClick: () => i(!n),
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				"data-copy-key": "review.card.source_evidence",
				children: U("manage:reviewCandidate.sourceEvidence")
			}), ` · ${o.length}`]
		}), /* @__PURE__ */ (0, Q.jsx)(l, {
			id: a,
			open: n,
			children: /* @__PURE__ */ (0, Q.jsx)("dl", {
				className: "flex min-w-0 flex-col gap-2 px-3 pt-2 pb-1",
				children: o.map(([n, r]) => /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex min-w-0 flex-wrap gap-x-2",
					children: [
						/* @__PURE__ */ (0, Q.jsx)("dt", {
							className: "text-caption-1-regular text-text-tertiary",
							children: Pt[n] || n
						}),
						/* @__PURE__ */ (0, Q.jsx)("dd", {
							className: "min-w-0 text-body-2-regular break-words text-text-primary",
							children: /* @__PURE__ */ (0, Q.jsx)(Nt, {
								value: se(r, "display_value"),
								reference: n === t.field && t.current_value ? t.current_value : se(t.candidates?.find((t) => t.candidate_key !== e.candidate_key && t.catalog_evidence?.[n]?.display_value)?.catalog_evidence?.[n], "display_value")
							})
						}),
						Le(r.warnings, r.warning_codes, r.warning_params).map((e) => /* @__PURE__ */ (0, Q.jsx)("small", {
							className: "w-full text-caption-1-regular text-status-yellow-text",
							children: e
						}, e))
					]
				}, n))
			})
		})]
	}) : null;
}
function Rt(e) {
	let t = e.content_id || e.provider_id;
	return `${e.source || U("manage:reviewQueue.unspecifiedSource")}${e.official ? ` · ${U("manage:reviewCandidate.officialFirst")}` : ""}${t ? ` · ID ${t}` : ""}`;
}
function zt({ candidate: e, reference: t }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-2 whitespace-normal wrap-anywhere",
		children: [/* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-regular text-text-primary",
			children: /* @__PURE__ */ (0, Q.jsx)(Nt, {
				value: e.display_value || "",
				reference: t
			})
		}), Le(e.warnings, e.warning_codes, e.warning_params).map((e) => /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-2-regular text-status-yellow-text",
			children: e
		}, e))]
	});
}
function Bt({ row: e, fieldName: t, value: n, onChange: r, locked: i }) {
	let a = e.candidates || [];
	return a.length ? a.length === 1 ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-2 rounded-2lg bg-background-primary-default px-4 py-3",
			children: [/* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-medium text-text-primary",
				children: Rt(a[0])
			}), /* @__PURE__ */ (0, Q.jsx)(zt, {
				candidate: a[0],
				reference: e.current_value || void 0
			})]
		}), /* @__PURE__ */ (0, Q.jsx)(Lt, {
			candidate: a[0],
			row: e
		})]
	}) : /* @__PURE__ */ (0, Q.jsx)(dt, {
		"aria-label": U("manage:reviewCandidate.sourceFor", { field: t || U("manage:scanFetch.slowWhatMetadata") }),
		value: n,
		isDisabled: i,
		onChange: r,
		children: /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "flex min-w-0 flex-col gap-3",
			children: a.map((t) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, Q.jsx)(ft, {
					value: t.candidate_key,
					className: "relative items-start",
					title: /* @__PURE__ */ (0, Q.jsx)("span", {
						title: Rt(t),
						children: Rt(t)
					}),
					description: /* @__PURE__ */ (0, Q.jsx)(zt, {
						candidate: t,
						reference: e.current_value || a.find((e) => e.candidate_key !== t.candidate_key)?.display_value
					})
				}), /* @__PURE__ */ (0, Q.jsx)(Lt, {
					candidate: t,
					row: e
				})]
			}, t.candidate_key))
		})
	}) : null;
}
function Vt({ genre: e, tags: t, locked: n, toast: i }) {
	let [a, o] = (0, G.useState)(""), [s, c] = (0, G.useState)(""), l = Be({
		mutationFn: (t) => R(e, t),
		onSuccess: async (t, n) => {
			t.ok ? (i(n ? U("manage:reviewCandidate.mapped", {
				genre: e,
				tag: n
			}) : U("manage:reviewCandidate.markedNonContent", { genre: e })), await De()) : c(t.error || U("manage:reviewCandidate.mapRejected"));
		},
		onError: (e) => c(L(e))
	}), u = () => {
		let e = a.trim();
		e ? (c(""), l.mutate(e)) : c(U("manage:reviewCandidate.tagRequired"));
	};
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, Q.jsx)("b", {
				lang: "ja",
				className: "text-body-medium text-text-primary",
				children: e
			}),
			/* @__PURE__ */ (0, Q.jsx)(D, {
				"aria-label": U("manage:reviewCandidate.tagFor", { genre: e }),
				value: a,
				onChange: o,
				maxLength: 40,
				isDisabled: n || l.isPending,
				className: "min-w-40 flex-1",
				children: /* @__PURE__ */ (0, Q.jsx)(v, {
					size: "small",
					list: t.length ? Ft : void 0,
					autoComplete: "off",
					placeholder: U("manage:reviewCandidate.tagPlaceholder"),
					onKeyDown: (e) => {
						e.key !== "Enter" || ce(e.nativeEvent) || (e.preventDefault(), u());
					}
				})
			}),
			/* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: u,
				children: U("manage:reviewCandidate.map")
			}),
			/* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: () => {
					c(""), l.mutate("");
				},
				children: U("manage:reviewCandidate.notContent")
			}),
			s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				role: "status",
				className: "w-full text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function Ht({ row: e, tags: t, locked: n, toast: r }) {
	let i = we(e);
	return i.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		role: "group",
		"aria-label": U("manage:reviewCandidate.unmappedGenres"),
		className: "flex flex-col gap-2 border-t border-separator-border pt-4",
		children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
			className: "text-body-2-medium text-text-secondary",
			children: U("manage:reviewCandidate.unmappedGenresCount", { count: i.length })
		}), /* @__PURE__ */ (0, Q.jsx)("div", {
			role: "list",
			className: "flex flex-col",
			children: i.map((e, i) => /* @__PURE__ */ (0, Q.jsx)("div", {
				role: "listitem",
				className: `py-3 first:pt-0 last:pb-0 ${i ? "border-t border-separator-border" : ""}`,
				children: /* @__PURE__ */ (0, Q.jsx)(Vt, {
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
var Ut = (e = "") => /^https?:\/\//i.test(e) ? e : "", Wt = (e = "") => Ut(e) || (e.startsWith("/") && !e.startsWith("//") ? e : "");
function Gt({ url: e }) {
	let t = Wt(e || "");
	return /* @__PURE__ */ (0, Q.jsx)(Kt, { source: t }, t);
}
function Kt({ source: e }) {
	let [t, n] = (0, G.useState)("idle");
	return (0, G.useEffect)(() => {
		if (t !== "loading") return;
		let e = setTimeout(() => n("failed"), 3e4);
		return () => clearTimeout(e);
	}, [t]), /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "relative flex h-review-image items-center justify-center overflow-hidden rounded-surface bg-background-secondary-default",
		children: [t === "loading" ? /* @__PURE__ */ (0, Q.jsx)("span", {
			role: "status",
			"aria-busy": "true",
			"aria-label": U("manage:reviewEvidence.loadingImage"),
			"data-skeleton": "",
			className: "absolute inset-0 skeleton-sheen"
		}) : null, e && (t === "loading" || t === "ready") ? /* @__PURE__ */ (0, Q.jsx)("img", {
			src: e,
			alt: U("manage:reviewEvidence.candidateImageAlt"),
			referrerPolicy: "no-referrer",
			decoding: "async",
			className: `size-full object-contain ${t === "loading" ? "invisible" : ""}`,
			onLoad: () => n("ready"),
			onError: () => n("failed")
		}) : e ? /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex flex-col items-center gap-2",
			children: [t === "failed" ? /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-body-2-regular text-text-secondary",
				children: U("manage:reviewEvidence.imageNotFound")
			}) : null, /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				"aria-label": t === "failed" ? U("manage:reviewEvidence.retryImage") : void 0,
				onClick: () => n("loading"),
				children: U(t === "failed" ? "manage:shared.retryNow" : "manage:reviewEvidence.viewImage")
			})]
		}) : /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-2-regular text-text-secondary",
			children: U("manage:reviewEvidence.imageNotFound")
		})]
	});
}
function qt({ asset: t, openItem: n }) {
	let i = t.name || "";
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, Q.jsxs)("button", {
			type: "button",
			onClick: () => n(t.id),
			className: "flex aspect-card-cover w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2lg bg-media-placeholder outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
			children: [t.preview_url ? /* @__PURE__ */ (0, Q.jsx)("img", {
				src: t.preview_url,
				alt: "",
				loading: "lazy",
				className: "size-full object-cover"
			}) : /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-caption-1-regular text-text-secondary",
				children: U("manage:shared.noCover")
			}), /* @__PURE__ */ (0, Q.jsx)(e, { children: U("manage:reviewEvidence.openOriginalNamed", { name: i }) })]
		}), /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start gap-1",
			children: [/* @__PURE__ */ (0, Q.jsx)("b", {
				title: i,
				className: "w-full truncate text-body-medium text-text-primary",
				children: t.code || i || U("manage:reviewEvidence.originalVideo")
			}), /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: _,
				onClick: () => n(t.id),
				children: U("manage:reviewEvidence.openOriginal")
			})]
		})]
	});
}
function Jt({ kind: e, name: t, works: n, avatar: r, openEntity: i }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, Q.jsx)("button", {
			type: "button",
			"aria-label": U("manage:reviewEvidence.openCreator", { name: t }),
			onClick: () => i(e, t),
			className: `relative inline-grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring ${qe}`,
			dangerouslySetInnerHTML: { __html: r }
		}), /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start",
			children: [/* @__PURE__ */ (0, Q.jsx)("button", {
				type: "button",
				onClick: () => i(e, t),
				className: "max-w-full cursor-pointer truncate text-body-medium text-text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring",
				children: t
			}), n ? /* @__PURE__ */ (0, Q.jsx)("small", {
				className: "tabular-nums text-body-2-regular text-text-secondary",
				children: U("manage:reviewEvidence.videoCount", { count: n })
			}) : null]
		})]
	});
}
function Yt({ row: e, openItem: t, openEntity: n, onReveal: a, revealing: o, note: s }) {
	let c = Ut(e.profile_url || ""), l = (e.preview_assets || []).slice(0, 6), u = Math.max(0, Number(e.video_count || e.videos || 0));
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: U("manage:reviewEvidence.pendingPerson", { name: e.babepedia_name || U("manage:reviewEvidence.unlabeled") })
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [c ? /* @__PURE__ */ (0, Q.jsx)(i, {
					variant: "secondary",
					size: "small",
					trailingIcon: O,
					href: c,
					target: "_blank",
					rel: "noopener noreferrer",
					children: U("manage:reviewEvidence.sourceProfile")
				}) : null, /* @__PURE__ */ (0, Q.jsx)(r, {
					variant: "secondary",
					size: "small",
					onClick: () => n("creator", e.creator || ""),
					children: U("manage:reviewEvidence.viewAllVideos", { count: u })
				})]
			}),
			/* @__PURE__ */ (0, Q.jsx)(Gt, { url: e.preview_url }),
			l.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: U("manage:reviewEvidence.localSamples")
			}), /* @__PURE__ */ (0, Q.jsx)("ul", {
				className: "flex flex-col gap-1",
				children: l.map((e) => /* @__PURE__ */ (0, Q.jsxs)("li", {
					className: "flex min-w-0 items-center gap-2",
					children: [/* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "ghost",
						size: "small",
						className: "min-w-0",
						onClick: () => t(e.id),
						children: /* @__PURE__ */ (0, Q.jsx)("span", {
							title: e.name,
							className: "block max-w-full truncate",
							children: e.name
						})
					}), /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "ghost",
						size: "small",
						"aria-label": U("manage:reviewEvidence.revealNamed", { name: e.name }),
						...N(o === e.id),
						onClick: () => a(e.id),
						children: U("manage:reviewEvidence.fileLocation")
					})]
				}, e.id))
			})] }) : /* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: U("manage:reviewEvidence.noLocalSamples")
			}),
			s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function Xt({ assets: t, picked: n, onPicked: r, locked: i }) {
	let [a, s] = (0, G.useState)(null), c = new Set(n), l = (e, n) => {
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
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)(T, {
			prefix: /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "tabular-nums text-body-2-regular text-text-secondary",
				children: U("manage:reviewEvidence.selectedOfTotal", {
					count: c.size,
					total: t.length
				})
			}),
			actions: [{
				label: U("manage:shared.selectAll"),
				disabled: i,
				onPress: () => r(t.map((e) => e.id))
			}, {
				label: U("manage:reviewEvidence.clearSelection"),
				disabled: i,
				onPress: () => r([])
			}]
		}), /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "review-asset-grid gap-1.5",
			children: t.map((t, n) => {
				let r = c.has(t.id);
				return /* @__PURE__ */ (0, Q.jsxs)("button", {
					type: "button",
					"aria-pressed": r,
					title: t.name,
					onClick: (e) => l(n, e.shiftKey),
					className: `relative aspect-card-cover cursor-pointer overflow-hidden rounded-surface bg-media-placeholder outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-border-focus-ring ${r ? "opacity-100 ring-2 ring-border-button-active ring-inset" : "opacity-50"}`,
					children: [
						/* @__PURE__ */ (0, Q.jsx)("img", {
							src: `/poster?id=${t.id}&c=4`,
							alt: "",
							loading: "lazy",
							className: "size-full object-cover"
						}),
						/* @__PURE__ */ (0, Q.jsx)("span", {
							className: "absolute top-1 right-1",
							children: /* @__PURE__ */ (0, Q.jsx)(o, {
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
						/* @__PURE__ */ (0, Q.jsx)(e, { children: U(r ? "manage:reviewEvidence.assetSelected" : "manage:reviewEvidence.assetUnselected", { name: t.name || t.id }) })
					]
				}, t.id);
			})
		})]
	});
}
// src/react/review/review-card.tsx
var Zt = P({
	variant: "filled",
	padding: "none",
	className: "flex flex-col overflow-hidden"
}), Qt = "flex min-h-6 min-w-0 items-center", $t = 2, en = (e) => e === "western_identity" ? "h-review-card-tall" : "h-review-card";
function tn(e) {
	let { category: t, row: n, choice: i, onChoice: o, selected: c, onSelect: l, locked: u, busy: d, problem: h, genreTags: g, onDecide: _, handlers: v, queueView: y = "pending" } = e, b = (0, G.useRef)(!1), re = W(), x = t === "metadata_fields", ie = f[t] || "", S = String(n.creator || "").trim(), C = !!ie && !!S, w = Fe(t, n), T = B(t, n), ae = V(t, n), E = z(n), D = Pe(n), O = oe(t, n), k = n.comparison_assets || [], A = n.preview_assets || [], j = ne[n.decision || ""], P = k.length > 1 ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [k.slice(0, $t).map((e) => /* @__PURE__ */ (0, Q.jsx)(qt, {
			asset: e,
			openItem: v.openItem
		}, e.id)), k.length > $t ? /* @__PURE__ */ (0, Q.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: U("manage:reviewCard.moreComparison", { count: k.length - $t })
		}) : null]
	}) : C ? /* @__PURE__ */ (0, Q.jsx)(Jt, {
		kind: ie,
		name: S,
		works: Number(n.video_count || n.videos || 0),
		openEntity: v.openEntity,
		avatar: M(S, n.entity_id ? {
			id: n.entity_id,
			has_image: !!n.has_image,
			image_version: n.image_version,
			avatar_focus: n.avatar_focus
		} : null, null, ie)
	}) : n.asset_id ? /* @__PURE__ */ (0, Q.jsx)(qt, {
		openItem: v.openItem,
		asset: {
			id: n.asset_id,
			name: n.asset_name,
			code: n.code,
			preview_url: n.asset_preview_url
		}
	}) : null, se = x ? /* @__PURE__ */ (0, Q.jsx)(Bt, {
		row: n,
		fieldName: T,
		value: i.candidateKey,
		onChange: (e) => o({
			...i,
			candidateKey: e
		}),
		locked: u
	}) : t === "creator_tags" ? A.length ? /* @__PURE__ */ (0, Q.jsx)(Xt, {
		assets: A,
		picked: i.assets,
		locked: u,
		onPicked: (e) => o({
			...i,
			assets: e
		})
	}) : /* @__PURE__ */ (0, Q.jsx)(m, {
		size: "compact",
		icon: p,
		title: U("manage:reviewCard.noFramesTitle"),
		children: n.video_count ? U("manage:reviewCard.noFramesBody", { count: n.video_count }) : U("manage:reviewCard.noFramesBodyUncounted")
	}) : t === "fc2_similarity" ? null : t === "western_identity" ? /* @__PURE__ */ (0, Q.jsx)(Yt, {
		row: n,
		openItem: v.openItem,
		openEntity: v.openEntity,
		onReveal: v.onReveal,
		revealing: v.revealing,
		note: v.revealNote
	}) : /* @__PURE__ */ (0, Q.jsx)(Gt, { url: n.preview_url }), F = C ? P : T ? /* @__PURE__ */ (0, Q.jsxs)("h4", {
		className: I(Qt, "flex-wrap gap-2"),
		children: [/* @__PURE__ */ (0, Q.jsx)("span", {
			title: T,
			className: "flex max-w-full min-w-0 overflow-hidden rounded-md",
			children: /* @__PURE__ */ (0, Q.jsx)(s, {
				variant: "caption",
				color: "neutral",
				children: T
			})
		}), /* @__PURE__ */ (0, Q.jsx)("span", {
			title: ae,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: ae
		})]
	}) : /* @__PURE__ */ (0, Q.jsx)("h4", {
		className: Qt,
		children: /* @__PURE__ */ (0, Q.jsx)("span", {
			title: w,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: w
		})
	});
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": w,
		"data-review-key": n.item_key,
		className: I(Zt, en(t)),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)("header", {
				className: "flex min-w-0 shrink-0 items-center gap-2 border-b border-separator-border px-5 py-4",
				children: [
					u ? null : /* @__PURE__ */ (0, Q.jsx)("span", {
						className: I(Qt, "shrink-0"),
						onPointerDownCapture: (e) => {
							b.current = e.shiftKey;
						},
						onKeyDownCapture: (e) => {
							b.current = e.shiftKey;
						},
						children: /* @__PURE__ */ (0, Q.jsx)(a, {
							isSelected: c,
							"aria-label": U("manage:reviewCard.selectItem", { title: w }),
							onChange: (e) => l(b.current, e)
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)("div", {
						className: "min-w-0 flex-1",
						children: F
					}),
					j ? /* @__PURE__ */ (0, Q.jsx)(s, {
						variant: "caption",
						color: "neutral",
						children: j
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)("div", {
				className: "relative mx-5 flex min-w-0 min-h-0 flex-1 flex-col",
				children: /* @__PURE__ */ (0, Q.jsxs)("div", {
					ref: re,
					className: "flex min-w-0 min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4",
					children: [
						n.source_name ? /* @__PURE__ */ (0, Q.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: U("manage:reviewCard.sourceSpelling", { name: n.source_name })
						}) : null,
						!C && (n.board || n.assets) ? /* @__PURE__ */ (0, Q.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: U("manage:reviewCard.comparisonFiles", { count: Number(n.video_count || n.assets || 0) })
						}) : null,
						!C && P ? P : null,
						x && (E || n.current_value !== void 0) ? /* @__PURE__ */ (0, Q.jsxs)("div", {
							role: "region",
							"aria-label": U("manage:reviewCard.currentInfo"),
							className: "flex min-w-0 flex-col gap-1 border-b border-separator-border pb-4",
							children: [
								/* @__PURE__ */ (0, Q.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
										"data-copy-key": "review.card.current_value",
										className: "text-caption-1-medium text-text-secondary",
										children: U("manage:reviewCard.currentValue")
									}), n.current_owner?.startsWith("user:") || n.current_owner?.startsWith("review:") ? /* @__PURE__ */ (0, Q.jsx)(s, {
										variant: "caption",
										color: "neutral",
										children: U("manage:reviewCard.manuallyConfirmed")
									}) : null]
								}),
								/* @__PURE__ */ (0, Q.jsx)("p", {
									className: "text-body-2-regular text-text-primary wrap-anywhere",
									children: n.current_value === void 0 ? E : n.current_value ? /* @__PURE__ */ (0, Q.jsx)(Nt, {
										value: n.current_value,
										reference: (n.candidates?.find((e) => e.candidate_key === i.candidateKey) || n.candidates?.[0])?.display_value
									}) : U("manage:reviewCard.noMetadata")
								}),
								n.videos === void 0 ? null : /* @__PURE__ */ (0, Q.jsx)("p", {
									className: "text-caption-1-regular text-text-secondary",
									children: U(n.asset_path ? "manage:reviewCard.matchingFiles" : "manage:reviewCard.sameCodeFiles", { count: Number(n.videos) })
								})
							]
						}) : null,
						D.length || t === "creator_tags" ? /* @__PURE__ */ (0, Q.jsx)("div", {
							className: "flex flex-wrap gap-1",
							children: D.length ? D.map((e) => /* @__PURE__ */ (0, Q.jsx)(s, {
								variant: "caption",
								color: "soft",
								children: e
							}, e)) : /* @__PURE__ */ (0, Q.jsx)("small", {
								className: "text-body-2-regular text-text-secondary",
								children: U("manage:reviewCard.noPendingTags")
							})
						}) : null,
						x ? /* @__PURE__ */ (0, Q.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, Q.jsxs)("h5", {
								className: "text-caption-1-medium text-text-secondary",
								children: [/* @__PURE__ */ (0, Q.jsx)("span", {
									"data-copy-key": "review.card.candidate_sources",
									children: U("manage:reviewCard.candidateSources")
								}), ` · ${n.candidates?.length || 0}`]
							}), n.current_value || (n.candidates?.length || 0) > 1 ? /* @__PURE__ */ (0, Q.jsx)("span", {
								"data-copy-key": n.current_value ? "review.card.compare_current" : "review.card.compare_sources",
								className: "text-caption-1-regular text-text-tertiary",
								children: n.current_value ? U("manage:reviewCard.comparedToCurrent") : U("manage:reviewCard.sourceDifferences")
							}) : null]
						}) : null,
						se,
						/* @__PURE__ */ (0, Q.jsx)(Ht, {
							row: n,
							tags: g,
							locked: u,
							toast: v.toast
						}),
						!x && E ? /* @__PURE__ */ (0, Q.jsx)("p", {
							className: "text-body-2-regular text-text-secondary wrap-anywhere",
							children: E
						}) : null
					]
				})
			}),
			/* @__PURE__ */ (0, Q.jsxs)("footer", {
				className: I(ee.stack, "shrink-0"),
				children: [
					y === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(te, {
						variant: "secondary",
						size: "small",
						className: "me-auto",
						disabled: u,
						...N(d),
						onClick: () => _("rejected"),
						children: U("manage:shared.ignore")
					}),
					y === "pending" ? /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => _("skipped"),
						children: U("manage:reviewDecision.later")
					}) : /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: y === "ignored" ? "primary" : "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => _("restore"),
						children: U("manage:reviewDecision.moveToPending")
					}),
					y === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "primary",
						size: "small",
						disabled: u || !O,
						...N(d),
						title: O ? void 0 : U("manage:reviewCard.cannotApproveHint"),
						onClick: () => _("approved"),
						children: U(O ? "manage:reviewDecision.approve" : "manage:reviewCard.cannotApprove")
					}),
					h ? /* @__PURE__ */ (0, Q.jsx)("p", {
						role: "status",
						className: "w-full text-body-2-regular text-text-error-primary",
						children: h
					}) : null
				]
			})
		]
	});
}
// src/react/review/review-page.tsx
var nn = "flex cursor-pointer items-center justify-between gap-2";
function rn(e) {
	let t = Ve("review").keys.filter(ve), [n, i] = (0, G.useState)(() => matchMedia("(max-width:900px)").matches);
	(0, G.useEffect)(() => {
		let e = matchMedia("(max-width:900px)"), t = () => i(e.matches);
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let { route: a, openItem: o, openEntity: s, revealSource: c, toast: l, readOnly: f, readOnlyMessage: p, writerUrl: ee } = e, [g, _] = (0, G.useState)(ve(e.category) ? e.category : u), [v, te] = (0, G.useState)(() => Me(e.queue)), [ne, S] = (0, G.useState)("candidates"), [C, w] = (0, G.useState)(""), [T, ae] = (0, G.useState)(""), [D, O] = (0, G.useState)(1), [k, A] = (0, G.useState)(20), [j, M] = (0, G.useState)(/* @__PURE__ */ new Set());
	He(() => M(/* @__PURE__ */ new Set())), (0, G.useEffect)(() => {
		j.size && pe();
	}, [j]);
	let [N, P] = (0, G.useState)(/* @__PURE__ */ new Map()), [se, F] = (0, G.useState)(/* @__PURE__ */ new Map()), [ce, I] = (0, G.useState)(""), me = (0, G.useRef)(null), [ye, be] = (0, G.useState)(0), [xe, we] = (0, G.useState)(""), Ee = (0, G.useRef)(!0);
	(0, G.useEffect)(() => () => {
		Ee.current = !1;
	}, []);
	let R = Ue({
		queryKey: re,
		queryFn: ({ signal: e }) => he(e)
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
	}, Oe = je(De, v), ke = R.data ? Object.fromEntries(ie.map((e) => [e, b.reduce((t, n) => t + Number(je(De, e).counts[n] || 0), 0)])) : void 0, z = Oe.sections[g] || [], B = g === "metadata_fields", V = f;
	(0, G.useEffect)(() => {
		let e = new Set(z.map((e) => e.item_key));
		M((t) => {
			let n = [...t].filter((t) => e.has(t));
			return n.length === t.size ? t : new Set(n);
		}), P((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		}), F((t) => {
			let n = [...t].filter(([t]) => e.has(t));
			return n.length === t.size ? t : new Map(n);
		});
	}, [z]);
	let Pe = (0, G.useMemo)(() => B ? _e(z, "field") : [], [z, B]), Fe = Pe.some((e) => e.key === T) ? T : "", H = (0, G.useMemo)(() => B ? ge(z, "field", Fe) : z, [
		z,
		B,
		Fe
	]), Le = (0, G.useMemo)(() => Ae(H, B), [H, B]), W = Le.some(([e]) => e === ne) ? ne : "candidates", We = (0, G.useMemo)(() => _e(H, W), [H, W]), Ke = We.some((e) => e.key === C) ? C : "", qe = (0, G.useMemo)(() => ge(H, W, Ke), [
		H,
		W,
		Ke
	]), Je = (0, G.useMemo)(() => Ne(qe, D, k), [
		qe,
		D,
		k
	]), Ye = Je.rows.map((e) => e.item_key), Xe = new Set(Ye), K = We.map((e) => ({
		...e,
		rows: e.rows.filter((e) => Xe.has(e.item_key))
	})).filter((e) => e.rows.length), q = (e) => N.get(e.item_key) || fe(e), Ze = (0, G.useMemo)(() => z.filter((e) => j.has(e.item_key)), [z, j]), Qe = (e) => {
		let t = new Set(e);
		M((e) => new Set([...e].filter((e) => !t.has(e)))), P((e) => new Map([...e].filter(([e]) => !t.has(e)))), F((e) => new Map([...e].filter(([e]) => !t.has(e))));
	}, $e = (e, t) => F((n) => new Map(n).set(e, t)), et = () => {
		S("candidates"), w(""), ae(""), O(1), M(/* @__PURE__ */ new Set()), P(/* @__PURE__ */ new Map()), F(/* @__PURE__ */ new Map()), I(""), me.current = null;
	}, J = (e) => {
		_(e), et(), a({
			category: e === "metadata_fields" ? "" : e,
			queue: v === "pending" ? "" : v
		});
	}, tt = (e) => {
		te(e), et(), a({
			category: g === "metadata_fields" ? "" : g,
			queue: e === "pending" ? "" : e
		});
	}, Y = Be({
		mutationFn: ({ row: e, status: t, category: n }) => ze(ue(n, le(n, e), t, q(e))),
		onSuccess: (e, { row: t, status: n, category: r }) => {
			e.ok ? (Re(r, [t.item_key], n), Qe([t.item_key]), l(de(n))) : $e(t.item_key, e.error || U("manage:reviewPage.decisionRejected"));
		},
		onError: (e, { row: t }) => $e(t.item_key, L(e))
	}), X = Be({
		mutationFn: async ({ status: e, category: t, rows: n }) => {
			let r = [], i = [];
			for (let [a, o] of n.entries()) {
				if (!Ee.current) break;
				I(U("manage:reviewPage.processingProgress", {
					current: a,
					total: n.length
				}));
				try {
					let n = await ze(ue(t, le(t, o), e, q(o)));
					if (!n.ok) throw Error(n.error || U("manage:reviewPage.itemNotAccepted"));
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
			Re(t, n, e), Qe(n), r.forEach(([e, t]) => $e(e, t)), I("");
		},
		onError: (e) => {
			I(L(e));
		}
	}), nt = {
		receipt: l,
		failure: (e) => I(L(e))
	}, rt = {
		ignored: "rejected",
		later: "skipped"
	}, Z = (e, t) => {
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
				if (e === "approved" && B && n.some((e) => !q(e).candidateKey)) throw Error(U("manage:reviewPage.chooseSourceFirst"));
				return I(""), {
					title: t,
					body: U(`manage:reviewPage.confirm.${e}`, { count: n.length })
				};
			},
			run: async (t) => {
				n = await X.mutateAsync({
					status: e,
					category: g,
					rows: [...t]
				});
				let { done: r } = n;
				if (e === "approved") return;
				let i = g, a = t.filter((e) => r.includes(e.item_key)), o = e === "restore" ? rt[v] : "restore";
				return async () => {
					for (let e of a) await ze(ue(i, le(i, e), o, q(e)));
					await Te.invalidateQueries({ queryKey: re });
				};
			},
			receipt: () => U({
				approved: "manage:reviewPage.approvedCount",
				rejected: "manage:reviewPage.ignoredCount",
				skipped: "manage:reviewPage.laterCount",
				restore: "manage:reviewPage.pendingCount"
			}[e], { count: n.done.length }) + (n.failures.length ? U("manage:reviewPage.notCompletedSuffix", { count: n.failures.length }) : "")
		};
	}, it = Ze.every((e) => oe(g, e)), at = [
		...v === "ignored" ? [] : [Z("rejected", U("manage:reviewToolbar.ignoreSelected"))],
		v === "pending" ? Z("skipped", U("manage:reviewToolbar.laterSelected")) : Z("restore", U("manage:reviewToolbar.restoreSelected")),
		...v === "ignored" ? [] : [Z("approved", U("manage:reviewToolbar.approveSelected"))]
	].map((e) => ({
		action: e,
		items: Ze,
		host: nt,
		disabled: X.isPending || Y.isPending || e.key === "approved" && !it
	})), ot = (e) => {
		P((t) => {
			let n = new Map(t);
			for (let t of Ze) {
				let r = t.candidates?.find((t) => t.source === e);
				r && n.set(t.item_key, {
					...q(t),
					candidateKey: r.candidate_key
				});
			}
			return n;
		}), I(U("manage:reviewPage.sourceChosen", { source: e }));
	}, lt = async (e) => {
		if (ye) return;
		be(e), we("");
		let t = await c(e);
		Ee.current && (be(0), we(t));
	}, ut = Ce(De.mirror, p), dt = De.genre_tags || [], ft = {
		openItem: o,
		openEntity: s,
		onReveal: lt,
		revealing: ye,
		revealNote: xe,
		toast: l
	};
	return /* @__PURE__ */ (0, Q.jsx)(Ge, { children: /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-5 pb-10",
		children: [
			V ? /* @__PURE__ */ (0, Q.jsx)(y, {
				tone: "warning",
				title: U("manage:reviewPage.readOnly"),
				extra: ee ? /* @__PURE__ */ (0, Q.jsx)("p", {
					className: "text-body-2-regular",
					children: /* @__PURE__ */ (0, Q.jsx)(h, {
						href: ee,
						children: U("manage:reviewPage.goToPrimary")
					})
				}) : void 0,
				children: ut
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(It, { tags: dt }),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-5 review-split:flex-row review-split:items-start review-split:gap-6",
				children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-section-nav": !0,
					className: "w-full min-w-0 review-split:sticky review-split:top-topbar review-split:w-review-tabs review-split:shrink-0",
					children: [/* @__PURE__ */ (0, Q.jsx)("h2", {
						id: "reviewcategories",
						children: U("manage:reviewPage.categories")
					}), /* @__PURE__ */ (0, Q.jsx)(E, {
						group: "review",
						label: U("manage:reviewPage.categories"),
						value: g,
						onChange: J,
						orientation: n ? "horizontal" : "vertical",
						panelPrefix: "review",
						sectionItems: !0,
						className: "",
						itemClassName: nn,
						disabled: Y.isPending || X.isPending,
						tabs: b.map((e) => {
							let t = Number(Oe.counts[e] || 0);
							return {
								value: e,
								label: x[e],
								badge: t ? /* @__PURE__ */ (0, Q.jsx)("span", {
									className: "tabular-nums text-caption-1-medium text-text-secondary",
									children: t.toLocaleString()
								}) : null
							};
						})
					})]
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					role: "tabpanel",
					id: `review-panel-${g}`,
					"aria-labelledby": `review-tab-${g}`,
					className: "flex min-w-0 flex-1 flex-col gap-5",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(ct, {
							queueView: v,
							queueCounts: ke,
							onQueueChange: tt,
							locked: V,
							fields: Pe,
							fieldFilter: Fe,
							onFieldFilter: (e) => {
								ae(e), w(""), O(1);
							},
							groupOptions: Le,
							groupBy: W,
							onGroupBy: (e) => {
								S(e), w(""), O(1);
							},
							groups: We,
							filter: Ke,
							onFilter: (e) => {
								w(e), O(1);
							},
							pageKeys: Ye,
							selected: j,
							onSelected: M,
							selectedRows: Ze,
							metadata: B,
							busy: X.isPending || Y.isPending,
							feedback: ce,
							onUnifySource: ot,
							actions: at
						}),
						Je.rows.length ? K.map((e) => /* @__PURE__ */ (0, Q.jsxs)("section", {
							className: "flex flex-col gap-3",
							children: [K.length > 1 || W !== "candidates" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
									className: "text-body-medium text-text-primary",
									children: `${e.title} · ${e.rows.length}`
								}), V ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
									variant: "ghost",
									size: "small",
									onClick: () => {
										let t = e.rows.map((e) => e.item_key), n = t.every((e) => j.has(e)), r = new Set(j);
										for (let e of t) n ? r.delete(e) : r.add(e);
										M(r);
									},
									children: e.rows.every((e) => j.has(e.item_key)) ? U("manage:reviewPage.clearGroup") : U("manage:reviewPage.selectGroup")
								})]
							}) : null, /* @__PURE__ */ (0, Q.jsx)("div", {
								className: "review-grid gap-5",
								children: e.rows.map((e) => /* @__PURE__ */ (0, Q.jsx)(tn, {
									category: g,
									row: e,
									queueView: v,
									choice: q(e),
									onChoice: (t) => P((n) => new Map(n).set(e.item_key, t)),
									selected: j.has(e.item_key),
									onSelect: (t, n) => M((r) => {
										let i = new Set(r);
										return me.current = Ie(i, Ye, me.current, e.item_key, t, n), i;
									}),
									locked: V,
									busy: X.isPending || Y.isPending && Y.variables?.row.item_key === e.item_key,
									problem: se.get(e.item_key) || "",
									genreTags: dt,
									onDecide: (t) => {
										Y.isPending || X.isPending || (F((t) => new Map([...t].filter(([t]) => t !== e.item_key))), Y.mutate({
											row: e,
											status: t,
											category: g
										}));
									},
									handlers: ft
								}, e.item_key))
							})]
						}, e.key)) : R.isError && !R.data ? /* @__PURE__ */ (0, Q.jsx)(y, {
							tone: "error",
							title: U("manage:reviewPage.queueLoadFailed"),
							action: /* @__PURE__ */ (0, Q.jsx)(r, {
								variant: "secondary",
								size: "small",
								disabled: R.isFetching,
								onClick: () => void R.refetch(),
								children: U("manage:shared.retryNow")
							}),
							children: L(R.error)
						}) : /* @__PURE__ */ (0, Q.jsx)(m, {
							icon: Se,
							title: U({
								pending: "manage:reviewPage.emptyPending",
								later: "manage:reviewPage.emptyLater",
								ignored: "manage:reviewPage.emptyIgnored"
							}[v]),
							actions: b.some((e) => e !== g && Number(Oe.counts[e] || 0) > 0) ? /* @__PURE__ */ (0, Q.jsx)(r, {
								size: "small",
								onClick: () => {
									let e = t.find((e) => e !== g && Number(Oe.counts[e] || 0) > 0);
									e && J(e);
								},
								children: U("manage:reviewPage.viewOtherCategories")
							}) : void 0,
							children: U(v === "pending" ? "manage:reviewPage.switchCategoryHint" : v === "later" ? "manage:reviewPage.laterKeptHint" : "manage:reviewPage.ignoredKeptHint")
						}),
						qe.length ? /* @__PURE__ */ (0, Q.jsx)(d, {
							label: U("manage:reviewPage.footerLabel"),
							total: qe.length,
							pagination: {
								pageIndex: Je.page - 1,
								pageSize: k
							},
							onChange: (e) => {
								O(e.pageIndex + 1), A(e.pageSize);
							}
						}) : null,
						B && v === "pending" ? /* @__PURE__ */ (0, Q.jsx)(st, {
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
export { rn as ReviewPage };

//# debugId=f5412ec5-4ed9-4669-bfc4-a9b1c8863a8a