(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "169cf156-1abc-436e-9a3f-19d99a001a4d", e._sentryDebugIdIdentifier = "sentry-dbid-169cf156-1abc-436e-9a3f-19d99a001a4d");
	} catch {}
})();
import { $ea3928288112382f$export$439d29a4e110a164 as e, $fe21c36db05242bb$export$a98f0dcb43a68a25 as t, $fe21c36db05242bb$export$d7b12c4107be0d61 as n, Button as r, ButtonLink as i, Checkbox as a, CheckboxGlyph as o, Chip as s, CollapseChevron as c, CollapseRegion as l, DEFAULT_CATEGORY as u, DataTableFooter as d, ENTITY_REVIEW_KINDS as f, Ea as p, EmptyState as m, ExternalLink as h, FIELDSET_FOOT as ee, FilterGlassRows as g, Gg as _, InputBase as v, LinkButton as te, Note as y, REVIEW_CATEGORIES as b, REVIEW_DECISION_LABELS as ne, REVIEW_KEY as re, REVIEW_LABELS as x, REVIEW_QUEUES as ie, REVIEW_QUEUE_LABELS as S, Select as C, SelectItem as w, SelectionActions as T, SelectionDock as ae, SortableBoardTabs as E, TextField as D, Wt as O, __toESM as k, apiGet as A, apiSend as j, avatarInner as M, busyProps as N, canApprove as oe, cardClass as P, codedText as se, commonReviewSources as F, composingKey as ce, confirmModal as I, currentReviewRow as le, cx as L, decisionPayload as ue, decisionReceipt as de, defaultChoice as fe, errorMessage as R, fetchReview as pe, filterReviewRows as me, groupReviewRows as he, isReviewCategory as ge, joinList as _e, l7 as ve, localTime as ye, m7 as be, mirrorText as xe, pendingGenres as Se, queryClient as Ce, quoted as z, recordGenre as we, reloadReview as Te, require_jsx_runtime as Ee, require_react as B, reviewGroupingOptions as De, reviewQueueData as Oe, reviewQueueOf as ke, reviewWindow as Ae, rowEvidence as V, rowFieldName as H, rowSubject as je, rowTags as Me, rowTitle as U, selectReviewRange as Ne, serverLabel as Pe, serverLabelList as W, settleReviewRows as Fe, submitDecision as Ie, t as G, useMutation as Le, useNavigationOrder as Re, useOverlayScrollbar as ze, useQuery as Be, useViewGlide as Ve } from "./peach-app.js";
import { Page as He } from "./peach-app.page-QAncjzM1.js";
import { DataTable as Ue } from "./peach-app.data-table-C4egVbd2.js";
import { LEGACY_AVATAR_IMG as We } from "./peach-app.legacy-avatar-NSITxLRS.js";
// src/react/review/auto-landings.ts
var K = /* @__PURE__ */ k(B(), 1), Ge = "/api/review/auto-landings", Ke = "/api/review/auto-landings/revert", qe = ["review", "auto-landings"], q = (e) => Pe(e.field_code ?? "", e.field), J = (e) => Pe(e.label_code ?? "", e.label), Je = (e) => A(Ge, e), Ye = (e) => A(`${Ge}?items=${encodeURIComponent(e.join("\n"))}`), Xe = (e, t) => j(Ke, {
	items: e,
	token: t
}), Ze = (e) => e.at === null ? "" : ye((/* @__PURE__ */ new Date(e.at * 1e3)).toISOString()), Y = (e) => e.code || e.name || (e.asset_id ? `#${e.asset_id}` : G("manage:autoLandings.unknownVideo")), X = (e) => e ? z(e) : G("manage:autoLandings.emptyValue"), Z = (e) => e.tags.length ? _e(e.tags) : e.value, Qe = (e) => e.tags.length ? G("manage:autoLandings.existingTagsKept") : G("manage:autoLandings.previousValue", { value: e.previous.length ? _e(e.previous.map(X)) : G("manage:autoLandings.emptyValue") });
function $e(e) {
	return [
		...e.restores.map((e) => G("manage:autoLandings.previewRestore", {
			video: Y(e),
			field: q(e),
			current: X(e.current),
			previous: X(e.previous)
		})),
		...e.tags.map((e) => G("manage:autoLandings.previewRemoveTag", {
			video: Y(e),
			tag: e.tag
		})),
		...e.changed.map((e) => e.gone ? G("manage:autoLandings.previewGone", {
			video: Y(e),
			field: q(e)
		}) : G("manage:autoLandings.previewEdited", {
			video: Y(e),
			field: q(e)
		}))
	];
}
function et(e) {
	let t = [e.restores.length ? G("manage:autoLandings.previewRestoreCount", { count: e.restores.length }) : "", e.tags.length ? G("manage:autoLandings.previewRemoveTags", { count: e.tags.length }) : ""].filter(Boolean);
	return [
		t.length ? G("manage:autoLandings.previewRevert", {
			count: e.decisions,
			details: t.join(G("shell:format.clauseSeparator"))
		}) : G("manage:autoLandings.previewRevertNothing", { count: e.decisions }),
		e.changed.length ? G("manage:autoLandings.previewUnchanged", { count: e.changed.length }) : "",
		G("manage:autoLandings.revertBackupNote")
	].filter(Boolean).join(G("shell:format.sentenceGap"));
}
function tt(e) {
	let t = [e.restored ? G("manage:autoLandings.resultRestoreCount", { count: e.restored }) : "", e.removed_tags ? G("manage:autoLandings.resultRemovedTags", { count: e.removed_tags }) : ""].filter(Boolean);
	return t.length ? G("manage:autoLandings.resultSummaryDetails", {
		count: e.decisions,
		details: t.join(G("shell:format.clauseSeparator"))
	}) : G("manage:autoLandings.resultSummary", { count: e.decisions });
}
// src/react/review/auto-landings-card.tsx
var Q = Ee(), nt = G("manage:autoLandings.description");
function rt({ item: t, openItem: n }) {
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
				children: G("manage:shared.noCover")
			}), /* @__PURE__ */ (0, Q.jsx)(e, { children: G("manage:autoLandings.openVideo", { name: Y(t) }) })]
		}), /* @__PURE__ */ (0, Q.jsxs)("span", {
			className: "flex min-w-0 flex-1 flex-col gap-0.5",
			children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "truncate text-body-medium text-text-primary",
				children: [Y(t), t.assets > 1 ? /* @__PURE__ */ (0, Q.jsx)("small", {
					className: "ml-1 text-caption-1-regular text-text-secondary",
					children: G("manage:autoLandings.fileCount", { count: t.assets })
				}) : null]
			}), /* @__PURE__ */ (0, Q.jsx)("small", {
				title: t.name,
				className: "truncate text-caption-1-regular text-text-secondary",
				children: t.gone ? G("manage:autoLandings.videoGone") : t.name
			})]
		})]
	});
}
function it({ item: e }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-0.5",
		children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
			title: Z(e),
			className: "truncate text-body-regular text-text-primary",
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-text-secondary",
				children: G("shell:format.labelPrefix", { label: q(e) })
			}), Z(e)]
		}), /* @__PURE__ */ (0, Q.jsx)("small", {
			title: Qe(e),
			className: "truncate text-caption-1-regular text-text-secondary",
			children: Qe(e)
		})]
	});
}
function at({ locked: e, openItem: t, toast: n }) {
	let [i, a] = (0, K.useState)([]), [o, s] = (0, K.useState)(null), c = Be({
		queryKey: qe,
		queryFn: ({ signal: e }) => Je(e)
	}), l = c.data?.items ?? [], u = Le({
		mutationFn: async (e) => {
			let t = await Ye(e), { confirmed: n, result: r } = await I({
				title: G("manage:autoLandings.revertTitle"),
				body: et(t),
				items: $e(t),
				confirmLabel: G("manage:shared.revert"),
				onConfirm: () => Xe(t.items, t.token)
			});
			return n ? r : null;
		},
		onSuccess: (e) => {
			e && (s(e), a([]), n(tt(e)), Ce.invalidateQueries({ queryKey: re }));
		},
		onError: (e) => n(R(e))
	});
	if (!l.length && !o && !c.isError) return null;
	let d = [
		{
			id: "work",
			label: G("manage:shared.video"),
			width: 300,
			min: 240,
			value: (e) => Y(e),
			render: (e) => /* @__PURE__ */ (0, Q.jsx)(rt, {
				item: e,
				openItem: t
			})
		},
		{
			id: "written",
			label: G("manage:autoLandings.columnWritten"),
			width: 320,
			min: 220,
			value: (e) => `${q(e)}${Z(e)}`,
			render: (e) => /* @__PURE__ */ (0, Q.jsx)(it, { item: e })
		},
		{
			id: "rule",
			label: G("manage:autoLandings.columnRuleTime"),
			width: 176,
			min: 144,
			value: (e) => e.at ?? 0,
			render: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
				title: e.batch,
				className: "flex min-w-0 flex-col gap-0.5 text-text-secondary",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "truncate text-body-2-regular",
					children: J(e)
				}), /* @__PURE__ */ (0, Q.jsx)("small", {
					className: "tabular-nums text-caption-1-regular",
					children: Ze(e) || G("manage:autoLandings.timeUnknown")
				})]
			})
		}
	];
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-labelledby": "auto-landings-title",
		className: "flex flex-col gap-4",
		children: [o ? /* @__PURE__ */ (0, Q.jsxs)(y, {
			tone: "success",
			title: tt(o),
			children: [/* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular",
				children: G("manage:autoLandings.backupDone", { path: o.backup })
			}), o.changed.length ? /* @__PURE__ */ (0, Q.jsxs)("p", {
				className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-body-2-regular",
				children: [G("manage:autoLandings.leftUnchanged", { count: o.changed.length }), o.changed.map((e) => e.gone ? /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-text-secondary",
					children: G("manage:autoLandings.deletedAsset", { id: e.asset_id })
				}, `${e.asset_id}:${e.field}`) : /* @__PURE__ */ (0, Q.jsx)(te, {
					size: "small",
					onClick: () => t(e.asset_id),
					children: Y(e)
				}, `${e.asset_id}:${e.field}`))]
			}) : null]
		}) : null, c.isError ? /* @__PURE__ */ (0, Q.jsx)(y, {
			tone: "error",
			title: G("manage:autoLandings.loadFailed"),
			children: R(c.error)
		}) : l.length ? /* @__PURE__ */ (0, Q.jsx)(Ue, {
			label: G("manage:autoLandings.title"),
			items: l,
			columns: d,
			title: G("manage:autoLandings.title"),
			titleId: "auto-landings-title",
			unit: G("manage:autoLandings.unit"),
			description: nt,
			rowId: (e) => e.item_key,
			rowLabel: (e) => `${Y(e)} ${q(e)}`,
			selected: i,
			onSelected: a,
			actions: (t) => /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: e || !t.length,
				...N(u.isPending),
				onClick: () => u.mutate(t.map((e) => e.item_key)),
				children: G("manage:autoLandings.revertSelected", { count: t.length })
			})
		}) : null]
	});
}
// src/react/review/bulk-toolbar.tsx
function ot(e) {
	let { groupOptions: t, groupBy: n, onGroupBy: i, groups: a, filter: o, onFilter: s, pageKeys: c, selected: l, onSelected: u, selectedRows: d, metadata: f, approvable: p, busy: m, feedback: h, onUnifySource: ee, onRun: _, queueView: v = "pending", queueCounts: te, onQueueChange: y, locked: b, fields: ne, fieldFilter: re, onFieldFilter: x } = e, T = c.filter((e) => l.has(e)), E = T.length > 0 && T.length === c.length, D = F(d), O = f && d.some((e) => (e.candidates?.length || 0) > 1), k = D.length ? G("manage:reviewToolbar.sourceForAll") : G("manage:reviewToolbar.noCommonSource"), A = (0, K.useRef)(null), j = (0, K.useRef)(null), M = (0, K.useRef)(null), [N, oe] = (0, K.useState)(!1), P = Ve(A, j, "[data-entity-state][aria-pressed=\"true\"]", v);
	return (0, K.useLayoutEffect)(() => {
		let e = j.current, t = M.current, n = e?.parentElement, r = e?.closest("[data-review-filter]");
		if (!e || !t || !n || !r) return;
		let i = () => oe(t.offsetHeight > 0 && Math.abs(n.getBoundingClientRect().top - t.getBoundingClientRect().top) < 1), a = new ResizeObserver(i);
		for (let n of [
			r,
			e,
			t
		]) a.observe(n);
		return i(), () => a.disconnect();
	}, []), /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(g, {
		label: G("manage:reviewToolbar.filters"),
		topLabel: G("manage:reviewToolbar.processingStatus"),
		attrs: { "data-review-filter": "" },
		className: "mb-0 flex-row flex-wrap",
		topClassName: "max-w-full flex-none",
		bottomClassName: c.length ? "min-h-12 max-w-full flex-none flex-wrap" : "hidden",
		bottomRef: M,
		panes: /* @__PURE__ */ (0, Q.jsx)("span", {
			ref: A,
			"data-view-glide": "",
			"aria-hidden": "true"
		}),
		top: /* @__PURE__ */ (0, Q.jsxs)("div", {
			ref: j,
			role: "group",
			"aria-label": G("manage:reviewToolbar.reviewStatus"),
			"data-entity-states": "",
			onPointerLeave: P.leave,
			children: [ie.map((e) => /* @__PURE__ */ (0, Q.jsxs)("button", {
				type: "button",
				"data-entity-state": e,
				"data-entity-press": "",
				disabled: m,
				"aria-pressed": v === e,
				onPointerEnter: P.hover,
				onClick: () => {
					e !== v && y(e);
				},
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						"data-copy-key": `review.queue.${e}`,
						children: S[e]
					}),
					" ",
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "ms-1.5 tabular-nums text-caption-1-medium text-text-secondary",
						children: te ? te[e].toLocaleString() : "…"
					})
				]
			}, e)), /* @__PURE__ */ (0, Q.jsx)("span", {
				"data-entity-sep": "",
				"aria-hidden": "true",
				className: N ? void 0 : "invisible"
			})]
		}),
		bottom: c.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
			f && ne.length ? /* @__PURE__ */ (0, Q.jsxs)(C, {
				"aria-label": G("manage:reviewToolbar.filterField"),
				size: "sm",
				prefix: /* @__PURE__ */ (0, Q.jsx)("span", {
					"data-copy-key": "review.filter.field",
					className: "pointer-events-auto",
					children: G("manage:reviewToolbar.field")
				}),
				selectedKey: re || "*",
				isDisabled: m,
				onSelectionChange: (e) => {
					e !== null && x(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, Q.jsx)(w, {
					id: "*",
					children: G("manage:shared.all")
				}), ne.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(C, {
				"aria-label": G("manage:reviewToolbar.groupBy"),
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
				"aria-label": G(n === "field" ? "manage:reviewToolbar.filterFieldGroup" : "manage:reviewToolbar.filterGroup"),
				size: "sm",
				prefix: G("manage:reviewToolbar.group"),
				selectedKey: o || "*",
				onSelectionChange: (e) => {
					e !== null && s(String(e) === "*" ? "" : String(e));
				},
				children: [/* @__PURE__ */ (0, Q.jsx)(w, {
					id: "*",
					children: G("manage:shared.all")
				}), a.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e.key,
					children: `${e.title} · ${e.rows.length}`
				}, e.key))]
			}) : null,
			b ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: ve,
				"aria-pressed": E,
				disabled: m,
				onClick: () => {
					let e = new Set(l);
					for (let t of c) E ? e.delete(t) : e.add(t);
					u(e);
				},
				children: G(E ? "manage:reviewToolbar.clearSelection" : o ? "manage:reviewToolbar.selectGroup" : "manage:reviewToolbar.selectPage")
			})
		] }) : null
	}), /* @__PURE__ */ (0, Q.jsxs)(ae, {
		label: G("manage:reviewToolbar.selectedDock"),
		visible: !b && l.size > 0,
		count: G("manage:reviewToolbar.selectedCount", { count: l.size }),
		children: [
			O && v !== "ignored" ? /* @__PURE__ */ (0, Q.jsxs)(C, {
				"aria-label": G("manage:reviewToolbar.sourceForAll"),
				size: "sm",
				selectedKey: "",
				isDisabled: m || !D.length,
				onSelectionChange: (e) => {
					e !== null && e !== "" && ee(String(e));
				},
				children: [/* @__PURE__ */ (0, Q.jsx)(w, {
					id: "",
					children: k
				}), D.map((e) => /* @__PURE__ */ (0, Q.jsx)(w, {
					id: e,
					children: e
				}, e))]
			}) : null,
			v === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "ghost",
				size: "small",
				disabled: m || !l.size,
				onClick: () => _("rejected"),
				children: G("manage:reviewToolbar.ignoreSelected")
			}),
			v === "pending" ? /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: m || !l.size,
				onClick: () => _("skipped"),
				children: G("manage:reviewToolbar.laterSelected")
			}) : /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: v === "ignored" ? "primary" : "secondary",
				size: "small",
				disabled: m || !l.size,
				onClick: () => _("restore"),
				children: G("manage:reviewToolbar.restoreSelected")
			}),
			v === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "primary",
				size: "small",
				disabled: m || !l.size || !p,
				onClick: () => _("approved"),
				children: G("manage:reviewToolbar.approveSelected")
			}),
			/* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "ghost",
				size: "small",
				disabled: m,
				onClick: () => u(/* @__PURE__ */ new Set()),
				children: G("manage:reviewToolbar.deselect")
			}),
			h ? /* @__PURE__ */ (0, Q.jsx)("p", {
				role: "status",
				className: "w-full text-body-2-regular text-text-secondary",
				children: h
			}) : null
		]
	})] });
}
// src/react/boardui/components/base/radio/radio.tsx
var st = {
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
function ct({ selected: e = !1, size: t = "sm", focusVisible: n = !1, className: r }) {
	let i = st[t];
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		"aria-hidden": !0,
		className: L("relative flex shrink-0 items-center justify-center rounded-full", i.dot, n && "ring-2 ring-border-focus-ring ring-offset-2", r),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("span", { className: L("absolute inset-0 rounded-full border-border-checkbox-default bg-background-primary-default shadow-xs", "transition-opacity duration-200 ease", i.border, e && "opacity-0") }),
			/* @__PURE__ */ (0, Q.jsx)("span", { className: L("absolute inset-0 rounded-full", "transition-opacity duration-200 ease", i.selected, !e && "opacity-0") }),
			/* @__PURE__ */ (0, Q.jsx)("span", { className: L("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-control-indicator-background", "transition-[scale,opacity] duration-200 ease", i.inner, e ? "scale-100 opacity-100" : "scale-0 opacity-0") })
		]
	});
}
function lt({ className: e, children: n, ref: r, ...i }) {
	return /* @__PURE__ */ (0, Q.jsx)(t, {
		ref: r,
		...i,
		className: (t) => L("flex flex-col gap-2", typeof e == "function" ? e(t) : e),
		children: n
	});
}
// src/react/boardui/components/base/radio/radio-card.tsx
function ut({ className: e, title: t, description: r, ref: i, ...a }) {
	return /* @__PURE__ */ (0, Q.jsx)(n, {
		ref: i,
		...a,
		className: (t) => L("group flex w-full items-center justify-between gap-3 rounded-2lg border border-border-button-default py-3 pe-5 ps-4 select-none", "transition-colors duration-150 ease", t.isHovered && !t.isDisabled ? "bg-background-primary-hover" : "bg-background-primary-default", t.isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer", typeof e == "function" ? e(t) : e),
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
			children: /* @__PURE__ */ (0, Q.jsx)(ct, {
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
}, dt = new class extends $ {}();
function ft(e, t, n) {
	return dt.diff(e, t, n);
}
// node_modules/diff/libesm/util/string.js
function pt(e, t) {
	let n = 0;
	for (; n < e.length && n < t.length; n++) if (e[n] != t[n]) return e.slice(0, n);
	return e.slice(0, n);
}
function mt(e, t) {
	let n;
	if (!e || !t || e[e.length - 1] != t[t.length - 1]) return "";
	for (n = 0; n < e.length && n < t.length; n++) if (e[e.length - (n + 1)] != t[t.length - (n + 1)]) return e.slice(-n);
	return e.slice(-n);
}
function ht(e, t, n) {
	if (e.slice(0, t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't start with prefix ${JSON.stringify(t)}; this is a bug`);
	return n + e.slice(t.length);
}
function gt(e, t, n) {
	if (!t) return e + n;
	if (e.slice(-t.length) != t) throw Error(`string ${JSON.stringify(e)} doesn't end with suffix ${JSON.stringify(t)}; this is a bug`);
	return e.slice(0, -t.length) + n;
}
function _t(e, t) {
	return ht(e, t, "");
}
function vt(e, t) {
	return gt(e, t, "");
}
function yt(e, t) {
	return t.slice(0, bt(e, t));
}
function bt(e, t) {
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
function xt(e, t) {
	let n = [];
	for (let r of Array.from(t.segment(e))) {
		let e = r.segment;
		n.length && /\s/.test(n[n.length - 1]) && /\s/.test(e) ? n[n.length - 1] += e : n.push(e);
	}
	return n;
}
function St(e, t) {
	if (t) return wt(e, t)[1];
	let n;
	for (n = e.length - 1; n >= 0 && e[n].match(/\s/); n--);
	return e.substring(n + 1);
}
function Ct(e, t) {
	if (t) return wt(e, t)[0];
	let n = e.match(/^\s*/);
	return n ? n[0] : "";
}
function wt(e, t) {
	if (!t) return [Ct(e), St(e)];
	if (t.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
	let n = xt(e, t), r = n[0], i = n[n.length - 1];
	return [/\s/.test(r) ? r : "", /\s/.test(i) ? i : ""];
}
// node_modules/diff/libesm/diff/word.js
var Tt = "a-zA-Z0-9_\\u{AD}\\u{C0}-\\u{D6}\\u{D8}-\\u{F6}\\u{F8}-\\u{2C6}\\u{2C8}-\\u{2D7}\\u{2DE}-\\u{2FF}\\u{1E00}-\\u{1EFF}", Et = RegExp(`[${Tt}]+|\\s+|[^${Tt}]`, "ug");
new class extends $ {
	equals(e, t, n) {
		return n.ignoreCase && (e = e.toLowerCase(), t = t.toLowerCase()), e.trim() === t.trim();
	}
	tokenize(e, t = {}) {
		let n;
		if (t.intlSegmenter) {
			let r = t.intlSegmenter;
			if (r.resolvedOptions().granularity != "word") throw Error("The segmenter passed must have a granularity of \"word\"");
			n = xt(e, r);
		} else n = e.match(Et) || [];
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
			e.added ? r = e : e.removed ? i = e : ((r || i) && Dt(n, i, r, e, t.intlSegmenter), n = e, r = null, i = null);
		}), (r || i) && Dt(n, i, r, null, t.intlSegmenter), e;
	}
}();
function Dt(e, t, n, r, i) {
	if (t && n) {
		let [a, o] = wt(t.value, i), [s, c] = wt(n.value, i);
		if (e) {
			let r = pt(a, s);
			e.value = gt(e.value, s, r), t.value = _t(t.value, r), n.value = _t(n.value, r);
		}
		if (r) {
			let e = mt(o, c);
			r.value = ht(r.value, c, e), t.value = vt(t.value, e), n.value = vt(n.value, e);
		}
	} else if (n) {
		if (e) {
			let e = Ct(n.value, i);
			n.value = n.value.substring(e.length);
		}
		if (r) {
			let e = Ct(r.value, i);
			r.value = r.value.substring(e.length);
		}
	} else if (e && r) {
		let n = Ct(r.value, i), [a, o] = wt(t.value, i), s = pt(n, a);
		t.value = _t(t.value, s);
		let c = mt(_t(n, s), o);
		t.value = vt(t.value, c), r.value = ht(r.value, n, c), e.value = gt(e.value, n, n.slice(0, n.length - c.length));
	} else if (r) {
		let e = Ct(r.value, i), n = yt(St(t.value, i), e);
		t.value = vt(t.value, n);
	} else if (e) {
		let n = yt(St(e.value, i), Ct(t.value, i));
		t.value = _t(t.value, n);
	}
}
new class extends $ {
	tokenize(e) {
		let t = RegExp(`(\\r?\\n)|[${Tt}]+|[^\\S\\n\\r]+|[^${Tt}]`, "ug");
		return e.match(t) || [];
	}
}(), new class extends $ {
	constructor() {
		super(...arguments), this.tokenize = Ot;
	}
	equals(e, t, n) {
		return n.ignoreWhitespace ? (n.newlineIsToken && e.includes("\n") || (e = e.trim()), n.newlineIsToken && t.includes("\n") || (t = t.trim())) : n.ignoreNewlineAtEof && !n.newlineIsToken && (e.endsWith("\n") && (e = e.slice(0, -1)), t.endsWith("\n") && (t = t.slice(0, -1))), super.equals(e, t, n);
	}
}();
function Ot(e, t) {
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
function kt(e) {
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
			if (kt(e[r]) && e[r + 1].match(/\s/)) {
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
		super(...arguments), this.tokenize = Ot;
	}
	get useLongestToken() {
		return !0;
	}
	castInput(e, t) {
		let { undefinedReplacement: n, stringifyReplacer: r = (e, t) => t === void 0 ? n : t } = t;
		return typeof e == "string" ? e : JSON.stringify(At(e, null, null, r), null, "  ");
	}
	equals(e, t, n) {
		return super.equals(e.replace(/,([\r\n])/g, "$1"), t.replace(/,([\r\n])/g, "$1"), n);
	}
}();
function At(e, t, n, r, i) {
	t ||= [], n ||= [], r && (e = r(i === void 0 ? "" : i, e));
	let a = 0;
	for (; a < t.length; a += 1) if (t[a] === e) return n[a];
	let o;
	if (Object.prototype.toString.call(e) === "[object Array]") {
		for (t.push(e), o = Array(e.length), n.push(o), a = 0; a < e.length; a += 1) o[a] = At(e[a], t, n, r, String(a));
		return t.pop(), n.pop(), o;
	}
	if (e && e.toJSON && (e = e.toJSON()), typeof e == "object" && e) {
		t.push(e), o = {}, n.push(o);
		let i = [], s;
		for (s in e)
 /* istanbul ignore else */
		Object.prototype.hasOwnProperty.call(e, s) && i.push(s);
		for (i.sort(), a = 0; a < i.length; a += 1) s = i[a], o[s] = At(e[s], t, n, r, s);
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
function jt({ value: e, reference: t }) {
	let n = (0, K.useMemo)(() => t ? ft(t, e).filter((e) => !e.removed) : [{
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
var Mt = {
	title: G("manage:shared.title"),
	original_title: G("manage:reviewCandidate.originalTitle"),
	runtime: G("manage:reviewCandidate.sourceRuntime"),
	director: G("manage:reviewCandidate.director"),
	label: "Label",
	poster_url: G("manage:reviewCandidate.poster"),
	cover_url: G("manage:shared.cover"),
	screenshot_urls: G("manage:reviewCandidate.screenshots"),
	trailer_url: G("manage:reviewCandidate.trailer")
}, Nt = "reviewgenretags";
function Pt({ tags: e }) {
	return e.length ? /* @__PURE__ */ (0, Q.jsx)("datalist", {
		id: Nt,
		children: e.map((e) => /* @__PURE__ */ (0, Q.jsx)("option", { value: e }, e))
	}) : null;
}
function Ft({ candidate: e, row: t }) {
	let [n, i] = (0, K.useState)(!1), a = (0, K.useId)(), o = Object.entries(e.catalog_evidence || {}).filter(([, e]) => e && e.display_value);
	return o.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "min-w-0",
		children: [/* @__PURE__ */ (0, Q.jsxs)(r, {
			variant: "secondary",
			size: "small",
			leadingIcon: c,
			"aria-expanded": n,
			"aria-controls": a,
			"aria-label": G(n ? "manage:reviewCandidate.collapseEvidence" : "manage:reviewCandidate.expandEvidence", { source: e.source || G("manage:reviewCandidate.thisSource") }),
			onClick: () => i(!n),
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				"data-copy-key": "review.card.source_evidence",
				children: G("manage:reviewCandidate.sourceEvidence")
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
							children: Mt[n] || n
						}),
						/* @__PURE__ */ (0, Q.jsx)("dd", {
							className: "min-w-0 text-body-2-regular break-words text-text-primary",
							children: /* @__PURE__ */ (0, Q.jsx)(jt, {
								value: se(r, "display_value"),
								reference: n === t.field && t.current_value ? t.current_value : se(t.candidates?.find((t) => t.candidate_key !== e.candidate_key && t.catalog_evidence?.[n]?.display_value)?.catalog_evidence?.[n], "display_value")
							})
						}),
						W(r.warnings, r.warning_codes, r.warning_params).map((e) => /* @__PURE__ */ (0, Q.jsx)("small", {
							className: "w-full text-caption-1-regular text-status-yellow-text",
							children: e
						}, e))
					]
				}, n))
			})
		})]
	}) : null;
}
function It(e) {
	let t = e.content_id || e.provider_id;
	return `${e.source || G("manage:reviewQueue.unspecifiedSource")}${e.official ? ` · ${G("manage:reviewCandidate.officialFirst")}` : ""}${t ? ` · ID ${t}` : ""}`;
}
function Lt({ candidate: e, reference: t }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 flex-col gap-2 whitespace-normal wrap-anywhere",
		children: [/* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-regular text-text-primary",
			children: /* @__PURE__ */ (0, Q.jsx)(jt, {
				value: e.display_value || "",
				reference: t
			})
		}), W(e.warnings, e.warning_codes, e.warning_params).map((e) => /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-2-regular text-status-yellow-text",
			children: e
		}, e))]
	});
}
function Rt({ row: e, fieldName: t, value: n, onChange: r, locked: i }) {
	let a = e.candidates || [];
	return a.length ? a.length === 1 ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-2 rounded-2lg bg-background-primary-default px-4 py-3",
			children: [/* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-medium text-text-primary",
				children: It(a[0])
			}), /* @__PURE__ */ (0, Q.jsx)(Lt, {
				candidate: a[0],
				reference: e.current_value || void 0
			})]
		}), /* @__PURE__ */ (0, Q.jsx)(Ft, {
			candidate: a[0],
			row: e
		})]
	}) : /* @__PURE__ */ (0, Q.jsx)(lt, {
		"aria-label": G("manage:reviewCandidate.sourceFor", { field: t || G("manage:scanFetch.slowWhatMetadata") }),
		value: n,
		isDisabled: i,
		onChange: r,
		children: /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "flex min-w-0 flex-col gap-3",
			children: a.map((t) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-1",
				children: [/* @__PURE__ */ (0, Q.jsx)(ut, {
					value: t.candidate_key,
					className: "relative items-start",
					title: /* @__PURE__ */ (0, Q.jsx)("span", {
						title: It(t),
						children: It(t)
					}),
					description: /* @__PURE__ */ (0, Q.jsx)(Lt, {
						candidate: t,
						reference: e.current_value || a.find((e) => e.candidate_key !== t.candidate_key)?.display_value
					})
				}), /* @__PURE__ */ (0, Q.jsx)(Ft, {
					candidate: t,
					row: e
				})]
			}, t.candidate_key))
		})
	}) : null;
}
function zt({ genre: e, tags: t, locked: n, toast: i }) {
	let [a, o] = (0, K.useState)(""), [s, c] = (0, K.useState)(""), l = Le({
		mutationFn: (t) => we(e, t),
		onSuccess: async (t, n) => {
			t.ok ? (i(n ? G("manage:reviewCandidate.mapped", {
				genre: e,
				tag: n
			}) : G("manage:reviewCandidate.markedNonContent", { genre: e })), await Te()) : c(t.error || G("manage:reviewCandidate.mapRejected"));
		},
		onError: (e) => c(R(e))
	}), u = () => {
		let e = a.trim();
		e ? (c(""), l.mutate(e)) : c(G("manage:reviewCandidate.tagRequired"));
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
				"aria-label": G("manage:reviewCandidate.tagFor", { genre: e }),
				value: a,
				onChange: o,
				maxLength: 40,
				isDisabled: n || l.isPending,
				className: "min-w-40 flex-1",
				children: /* @__PURE__ */ (0, Q.jsx)(v, {
					size: "small",
					list: t.length ? Nt : void 0,
					autoComplete: "off",
					placeholder: G("manage:reviewCandidate.tagPlaceholder"),
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
				children: G("manage:reviewCandidate.map")
			}),
			/* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				disabled: n || l.isPending,
				onClick: () => {
					c(""), l.mutate("");
				},
				children: G("manage:reviewCandidate.notContent")
			}),
			s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				role: "status",
				className: "w-full text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function Bt({ row: e, tags: t, locked: n, toast: r }) {
	let i = Se(e);
	return i.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		role: "group",
		"aria-label": G("manage:reviewCandidate.unmappedGenres"),
		className: "flex flex-col gap-2 border-t border-separator-border pt-4",
		children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
			className: "text-body-2-medium text-text-secondary",
			children: G("manage:reviewCandidate.unmappedGenresCount", { count: i.length })
		}), /* @__PURE__ */ (0, Q.jsx)("div", {
			role: "list",
			className: "flex flex-col",
			children: i.map((e, i) => /* @__PURE__ */ (0, Q.jsx)("div", {
				role: "listitem",
				className: `py-3 first:pt-0 last:pb-0 ${i ? "border-t border-separator-border" : ""}`,
				children: /* @__PURE__ */ (0, Q.jsx)(zt, {
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
var Vt = (e = "") => /^https?:\/\//i.test(e) ? e : "", Ht = (e = "") => Vt(e) || (e.startsWith("/") && !e.startsWith("//") ? e : "");
function Ut({ url: e }) {
	let t = Ht(e || "");
	return /* @__PURE__ */ (0, Q.jsx)(Wt, { source: t }, t);
}
function Wt({ source: e }) {
	let [t, n] = (0, K.useState)("idle");
	return (0, K.useEffect)(() => {
		if (t !== "loading") return;
		let e = setTimeout(() => n("failed"), 3e4);
		return () => clearTimeout(e);
	}, [t]), /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "relative flex h-review-image items-center justify-center overflow-hidden rounded-surface bg-background-secondary-default",
		children: [t === "loading" ? /* @__PURE__ */ (0, Q.jsx)("span", {
			role: "status",
			"aria-busy": "true",
			"aria-label": G("manage:reviewEvidence.loadingImage"),
			"data-skeleton": "",
			className: "absolute inset-0 skeleton-sheen"
		}) : null, e && (t === "loading" || t === "ready") ? /* @__PURE__ */ (0, Q.jsx)("img", {
			src: e,
			alt: G("manage:reviewEvidence.candidateImageAlt"),
			referrerPolicy: "no-referrer",
			decoding: "async",
			className: `size-full object-contain ${t === "loading" ? "invisible" : ""}`,
			onLoad: () => n("ready"),
			onError: () => n("failed")
		}) : e ? /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex flex-col items-center gap-2",
			children: [t === "failed" ? /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "text-body-2-regular text-text-secondary",
				children: G("manage:reviewEvidence.imageNotFound")
			}) : null, /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				"aria-label": t === "failed" ? G("manage:reviewEvidence.retryImage") : void 0,
				onClick: () => n("loading"),
				children: G(t === "failed" ? "manage:shared.retryNow" : "manage:reviewEvidence.viewImage")
			})]
		}) : /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-2-regular text-text-secondary",
			children: G("manage:reviewEvidence.imageNotFound")
		})]
	});
}
function Gt({ asset: t, openItem: n }) {
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
				children: G("manage:shared.noCover")
			}), /* @__PURE__ */ (0, Q.jsx)(e, { children: G("manage:reviewEvidence.openOriginalNamed", { name: i }) })]
		}), /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col items-start gap-1",
			children: [/* @__PURE__ */ (0, Q.jsx)("b", {
				title: i,
				className: "w-full truncate text-body-medium text-text-primary",
				children: t.code || i || G("manage:reviewEvidence.originalVideo")
			}), /* @__PURE__ */ (0, Q.jsx)(r, {
				variant: "secondary",
				size: "small",
				leadingIcon: _,
				onClick: () => n(t.id),
				children: G("manage:reviewEvidence.openOriginal")
			})]
		})]
	});
}
function Kt({ kind: e, name: t, works: n, avatar: r, openEntity: i }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 items-center gap-3",
		children: [/* @__PURE__ */ (0, Q.jsx)("button", {
			type: "button",
			"aria-label": G("manage:reviewEvidence.openCreator", { name: t }),
			onClick: () => i(e, t),
			className: `relative inline-grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring ${We}`,
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
				children: G("manage:reviewEvidence.videoCount", { count: n })
			}) : null]
		})]
	});
}
function qt({ row: e, openItem: t, openEntity: n, onReveal: a, revealing: o, note: s }) {
	let c = Vt(e.profile_url || ""), l = (e.preview_assets || []).slice(0, 6), u = Math.max(0, Number(e.video_count || e.videos || 0));
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: G("manage:reviewEvidence.pendingPerson", { name: e.babepedia_name || G("manage:reviewEvidence.unlabeled") })
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
					children: G("manage:reviewEvidence.sourceProfile")
				}) : null, /* @__PURE__ */ (0, Q.jsx)(r, {
					variant: "secondary",
					size: "small",
					onClick: () => n("creator", e.creator || ""),
					children: G("manage:reviewEvidence.viewAllVideos", { count: u })
				})]
			}),
			/* @__PURE__ */ (0, Q.jsx)(Ut, { url: e.preview_url }),
			l.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
				className: "text-body-medium text-text-primary",
				children: G("manage:reviewEvidence.localSamples")
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
						"aria-label": G("manage:reviewEvidence.revealNamed", { name: e.name }),
						...N(o === e.id),
						onClick: () => a(e.id),
						children: G("manage:reviewEvidence.fileLocation")
					})]
				}, e.id))
			})] }) : /* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: G("manage:reviewEvidence.noLocalSamples")
			}),
			s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				role: "status",
				className: "text-body-2-regular text-text-error-primary",
				children: s
			}) : null
		]
	});
}
function Jt({ assets: t, picked: n, onPicked: r, locked: i }) {
	let [a, s] = (0, K.useState)(null), c = new Set(n), l = (e, n) => {
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
				children: G("manage:reviewEvidence.selectedOfTotal", {
					count: c.size,
					total: t.length
				})
			}),
			actions: [{
				label: G("manage:shared.selectAll"),
				disabled: i,
				onPress: () => r(t.map((e) => e.id))
			}, {
				label: G("manage:reviewEvidence.clearSelection"),
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
						/* @__PURE__ */ (0, Q.jsx)(e, { children: G(r ? "manage:reviewEvidence.assetSelected" : "manage:reviewEvidence.assetUnselected", { name: t.name || t.id }) })
					]
				}, t.id);
			})
		})]
	});
}
// src/react/review/review-card.tsx
var Yt = P({
	variant: "filled",
	padding: "none",
	className: "flex flex-col overflow-hidden"
}), Xt = "flex min-h-6 min-w-0 items-center", Zt = 2, Qt = (e) => e === "western_identity" ? "h-review-card-tall" : "h-review-card";
function $t(e) {
	let { category: t, row: n, choice: i, onChoice: o, selected: c, onSelect: l, locked: u, busy: d, problem: h, genreTags: g, onDecide: _, handlers: v, queueView: y = "pending" } = e, b = (0, K.useRef)(!1), re = ze(), x = t === "metadata_fields", ie = f[t] || "", S = String(n.creator || "").trim(), C = !!ie && !!S, w = U(t, n), T = H(t, n), ae = je(t, n), E = V(n), D = Me(n), O = oe(t, n), k = n.comparison_assets || [], A = n.preview_assets || [], j = ne[n.decision || ""], P = k.length > 1 ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [k.slice(0, Zt).map((e) => /* @__PURE__ */ (0, Q.jsx)(Gt, {
			asset: e,
			openItem: v.openItem
		}, e.id)), k.length > Zt ? /* @__PURE__ */ (0, Q.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: G("manage:reviewCard.moreComparison", { count: k.length - Zt })
		}) : null]
	}) : C ? /* @__PURE__ */ (0, Q.jsx)(Kt, {
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
	}) : n.asset_id ? /* @__PURE__ */ (0, Q.jsx)(Gt, {
		openItem: v.openItem,
		asset: {
			id: n.asset_id,
			name: n.asset_name,
			code: n.code,
			preview_url: n.asset_preview_url
		}
	}) : null, se = x ? /* @__PURE__ */ (0, Q.jsx)(Rt, {
		row: n,
		fieldName: T,
		value: i.candidateKey,
		onChange: (e) => o({
			...i,
			candidateKey: e
		}),
		locked: u
	}) : t === "creator_tags" ? A.length ? /* @__PURE__ */ (0, Q.jsx)(Jt, {
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
		title: G("manage:reviewCard.noFramesTitle"),
		children: n.video_count ? G("manage:reviewCard.noFramesBody", { count: n.video_count }) : G("manage:reviewCard.noFramesBodyUncounted")
	}) : t === "fc2_similarity" ? null : t === "western_identity" ? /* @__PURE__ */ (0, Q.jsx)(qt, {
		row: n,
		openItem: v.openItem,
		openEntity: v.openEntity,
		onReveal: v.onReveal,
		revealing: v.revealing,
		note: v.revealNote
	}) : /* @__PURE__ */ (0, Q.jsx)(Ut, { url: n.preview_url }), F = C ? P : T ? /* @__PURE__ */ (0, Q.jsxs)("h4", {
		className: L(Xt, "flex-wrap gap-2"),
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
		className: Xt,
		children: /* @__PURE__ */ (0, Q.jsx)("span", {
			title: w,
			className: "min-w-0 truncate text-body-medium text-text-primary",
			children: w
		})
	});
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": w,
		"data-review-key": n.item_key,
		className: L(Yt, Qt(t)),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)("header", {
				className: "flex min-w-0 shrink-0 items-center gap-2 border-b border-separator-border px-5 py-4",
				children: [
					u ? null : /* @__PURE__ */ (0, Q.jsx)("span", {
						className: L(Xt, "shrink-0"),
						onPointerDownCapture: (e) => {
							b.current = e.shiftKey;
						},
						onKeyDownCapture: (e) => {
							b.current = e.shiftKey;
						},
						children: /* @__PURE__ */ (0, Q.jsx)(a, {
							isSelected: c,
							"aria-label": G("manage:reviewCard.selectItem", { title: w }),
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
							children: G("manage:reviewCard.sourceSpelling", { name: n.source_name })
						}) : null,
						!C && (n.board || n.assets) ? /* @__PURE__ */ (0, Q.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: G("manage:reviewCard.comparisonFiles", { count: Number(n.video_count || n.assets || 0) })
						}) : null,
						!C && P ? P : null,
						x && (E || n.current_value !== void 0) ? /* @__PURE__ */ (0, Q.jsxs)("div", {
							role: "region",
							"aria-label": G("manage:reviewCard.currentInfo"),
							className: "flex min-w-0 flex-col gap-1 border-b border-separator-border pb-4",
							children: [
								/* @__PURE__ */ (0, Q.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, Q.jsx)("h5", {
										"data-copy-key": "review.card.current_value",
										className: "text-caption-1-medium text-text-secondary",
										children: G("manage:reviewCard.currentValue")
									}), n.current_owner?.startsWith("user:") || n.current_owner?.startsWith("review:") ? /* @__PURE__ */ (0, Q.jsx)(s, {
										variant: "caption",
										color: "neutral",
										children: G("manage:reviewCard.manuallyConfirmed")
									}) : null]
								}),
								/* @__PURE__ */ (0, Q.jsx)("p", {
									className: "text-body-2-regular text-text-primary wrap-anywhere",
									children: n.current_value === void 0 ? E : n.current_value ? /* @__PURE__ */ (0, Q.jsx)(jt, {
										value: n.current_value,
										reference: (n.candidates?.find((e) => e.candidate_key === i.candidateKey) || n.candidates?.[0])?.display_value
									}) : G("manage:reviewCard.noMetadata")
								}),
								n.videos === void 0 ? null : /* @__PURE__ */ (0, Q.jsx)("p", {
									className: "text-caption-1-regular text-text-secondary",
									children: G(n.asset_path ? "manage:reviewCard.matchingFiles" : "manage:reviewCard.sameCodeFiles", { count: Number(n.videos) })
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
								children: G("manage:reviewCard.noPendingTags")
							})
						}) : null,
						x ? /* @__PURE__ */ (0, Q.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, Q.jsxs)("h5", {
								className: "text-caption-1-medium text-text-secondary",
								children: [/* @__PURE__ */ (0, Q.jsx)("span", {
									"data-copy-key": "review.card.candidate_sources",
									children: G("manage:reviewCard.candidateSources")
								}), ` · ${n.candidates?.length || 0}`]
							}), n.current_value || (n.candidates?.length || 0) > 1 ? /* @__PURE__ */ (0, Q.jsx)("span", {
								"data-copy-key": n.current_value ? "review.card.compare_current" : "review.card.compare_sources",
								className: "text-caption-1-regular text-text-tertiary",
								children: n.current_value ? G("manage:reviewCard.comparedToCurrent") : G("manage:reviewCard.sourceDifferences")
							}) : null]
						}) : null,
						se,
						/* @__PURE__ */ (0, Q.jsx)(Bt, {
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
				className: L(ee.stack, "shrink-0"),
				children: [
					y === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(te, {
						variant: "secondary",
						size: "small",
						className: "me-auto",
						disabled: u,
						...N(d),
						onClick: () => _("rejected"),
						children: G("manage:shared.ignore")
					}),
					y === "pending" ? /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => _("skipped"),
						children: G("manage:reviewDecision.later")
					}) : /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: y === "ignored" ? "primary" : "secondary",
						size: "small",
						disabled: u,
						...N(d),
						onClick: () => _("restore"),
						children: G("manage:reviewDecision.moveToPending")
					}),
					y === "ignored" ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
						variant: "primary",
						size: "small",
						disabled: u || !O,
						...N(d),
						title: O ? void 0 : G("manage:reviewCard.cannotApproveHint"),
						onClick: () => _("approved"),
						children: G(O ? "manage:reviewDecision.approve" : "manage:reviewCard.cannotApprove")
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
var en = "flex cursor-pointer items-center justify-between gap-2";
function tn(e) {
	let t = Re("review").keys.filter(ge), [n, i] = (0, K.useState)(() => matchMedia("(max-width:900px)").matches);
	(0, K.useEffect)(() => {
		let e = matchMedia("(max-width:900px)"), t = () => i(e.matches);
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let { route: a, openItem: o, openEntity: s, revealSource: c, toast: l, readOnly: f, readOnlyMessage: p, writerUrl: ee } = e, [g, _] = (0, K.useState)(ge(e.category) ? e.category : u), [v, te] = (0, K.useState)(() => ke(e.queue)), [ne, S] = (0, K.useState)("candidates"), [C, w] = (0, K.useState)(""), [T, ae] = (0, K.useState)(""), [D, O] = (0, K.useState)(1), [k, A] = (0, K.useState)(20), [j, M] = (0, K.useState)(/* @__PURE__ */ new Set()), [N, P] = (0, K.useState)(/* @__PURE__ */ new Map()), [se, F] = (0, K.useState)(/* @__PURE__ */ new Map()), [ce, I] = (0, K.useState)(""), L = (0, K.useRef)(null), [_e, ve] = (0, K.useState)(0), [ye, Se] = (0, K.useState)(""), Ce = (0, K.useRef)(!0);
	(0, K.useEffect)(() => () => {
		Ce.current = !1;
	}, []);
	let z = Be({
		queryKey: re,
		queryFn: ({ signal: e }) => pe(e)
	}), we = z.data || {
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
	}, Te = Oe(we, v), Ee = z.data ? Object.fromEntries(ie.map((e) => [e, b.reduce((t, n) => t + Number(Oe(we, e).counts[n] || 0), 0)])) : void 0, B = Te.sections[g] || [], V = g === "metadata_fields", H = f;
	(0, K.useEffect)(() => {
		let e = new Set(B.map((e) => e.item_key));
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
	}, [B]);
	let je = (0, K.useMemo)(() => V ? he(B, "field") : [], [B, V]), Me = je.some((e) => e.key === T) ? T : "", U = (0, K.useMemo)(() => V ? me(B, "field", Me) : B, [
		B,
		V,
		Me
	]), Pe = (0, K.useMemo)(() => De(U, V), [U, V]), W = Pe.some(([e]) => e === ne) ? ne : "candidates", ze = (0, K.useMemo)(() => he(U, W), [U, W]), Ve = ze.some((e) => e.key === C) ? C : "", Ue = (0, K.useMemo)(() => me(U, W, Ve), [
		U,
		W,
		Ve
	]), We = (0, K.useMemo)(() => Ae(Ue, D, k), [
		Ue,
		D,
		k
	]), Ge = We.rows.map((e) => e.item_key), Ke = new Set(Ge), qe = ze.map((e) => ({
		...e,
		rows: e.rows.filter((e) => Ke.has(e.item_key))
	})).filter((e) => e.rows.length), q = (e) => N.get(e.item_key) || fe(e), J = (0, K.useMemo)(() => B.filter((e) => j.has(e.item_key)), [B, j]), Je = (e) => {
		let t = new Set(e);
		M((e) => new Set([...e].filter((e) => !t.has(e)))), P((e) => new Map([...e].filter(([e]) => !t.has(e)))), F((e) => new Map([...e].filter(([e]) => !t.has(e))));
	}, Ye = (e, t) => F((n) => new Map(n).set(e, t)), Xe = () => {
		S("candidates"), w(""), ae(""), O(1), M(/* @__PURE__ */ new Set()), P(/* @__PURE__ */ new Map()), F(/* @__PURE__ */ new Map()), I(""), L.current = null;
	}, Ze = (e) => {
		_(e), Xe(), a({
			category: e === "metadata_fields" ? "" : e,
			queue: v === "pending" ? "" : v
		});
	}, Y = (e) => {
		te(e), Xe(), a({
			category: g === "metadata_fields" ? "" : g,
			queue: e === "pending" ? "" : e
		});
	}, X = Le({
		mutationFn: ({ row: e, status: t, category: n }) => Ie(ue(n, le(n, e), t, q(e))),
		onSuccess: (e, { row: t, status: n, category: r }) => {
			e.ok ? (Fe(r, [t.item_key], n), Je([t.item_key]), l(de(n))) : Ye(t.item_key, e.error || G("manage:reviewPage.decisionRejected"));
		},
		onError: (e, { row: t }) => Ye(t.item_key, R(e))
	}), Z = Le({
		mutationFn: async ({ status: e, category: t, rows: n }) => {
			let r = [], i = [];
			for (let [a, o] of n.entries()) {
				if (!Ce.current) break;
				I(G("manage:reviewPage.processingProgress", {
					current: a,
					total: n.length
				}));
				try {
					let n = await Ie(ue(t, le(t, o), e, q(o)));
					if (!n.ok) throw Error(n.error || G("manage:reviewPage.itemNotAccepted"));
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
			Fe(t, n, e), Je(n), r.forEach(([e, t]) => Ye(e, t)), I("");
			let i = {
				approved: "manage:reviewPage.approvedCount",
				rejected: "manage:reviewPage.ignoredCount",
				skipped: "manage:reviewPage.laterCount",
				restore: "manage:reviewPage.pendingCount"
			}[e];
			l(G(i, { count: n.length }) + (r.length ? G("manage:reviewPage.notCompletedSuffix", { count: r.length }) : ""));
		},
		onError: (e) => {
			I(R(e));
		}
	}), Qe = (e) => {
		!Z.isPending && J.length && (e === "approved" && V && J.some((e) => !q(e).candidateKey) ? I(G("manage:reviewPage.chooseSourceFirst")) : (I(""), Z.mutate({
			status: e,
			category: g,
			rows: J
		})));
	}, $e = (e) => {
		P((t) => {
			let n = new Map(t);
			for (let t of J) {
				let r = t.candidates?.find((t) => t.source === e);
				r && n.set(t.item_key, {
					...q(t),
					candidateKey: r.candidate_key
				});
			}
			return n;
		}), I(G("manage:reviewPage.sourceChosen", { source: e }));
	}, et = async (e) => {
		if (_e) return;
		ve(e), Se("");
		let t = await c(e);
		Ce.current && (ve(0), Se(t));
	}, tt = xe(we.mirror, p), nt = we.genre_tags || [], rt = {
		openItem: o,
		openEntity: s,
		onReveal: et,
		revealing: _e,
		revealNote: ye,
		toast: l
	};
	return /* @__PURE__ */ (0, Q.jsx)(He, { children: /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-5 pb-10",
		children: [
			H ? /* @__PURE__ */ (0, Q.jsx)(y, {
				tone: "warning",
				title: G("manage:reviewPage.readOnly"),
				extra: ee ? /* @__PURE__ */ (0, Q.jsx)("p", {
					className: "text-body-2-regular",
					children: /* @__PURE__ */ (0, Q.jsx)(h, {
						href: ee,
						children: G("manage:reviewPage.goToPrimary")
					})
				}) : void 0,
				children: tt
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(Pt, { tags: nt }),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-5 review-split:flex-row review-split:items-start review-split:gap-6",
				children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-section-nav": !0,
					className: "w-full min-w-0 review-split:sticky review-split:top-topbar review-split:w-review-tabs review-split:shrink-0",
					children: [/* @__PURE__ */ (0, Q.jsx)("h2", {
						id: "reviewcategories",
						children: G("manage:reviewPage.categories")
					}), /* @__PURE__ */ (0, Q.jsx)(E, {
						group: "review",
						label: G("manage:reviewPage.categories"),
						value: g,
						onChange: Ze,
						orientation: n ? "horizontal" : "vertical",
						panelPrefix: "review",
						sectionItems: !0,
						className: "",
						itemClassName: en,
						disabled: X.isPending || Z.isPending,
						tabs: b.map((e) => {
							let t = Number(Te.counts[e] || 0);
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
						/* @__PURE__ */ (0, Q.jsx)(ot, {
							queueView: v,
							queueCounts: Ee,
							onQueueChange: Y,
							locked: H,
							fields: je,
							fieldFilter: Me,
							onFieldFilter: (e) => {
								ae(e), w(""), O(1);
							},
							groupOptions: Pe,
							groupBy: W,
							onGroupBy: (e) => {
								S(e), w(""), O(1);
							},
							groups: ze,
							filter: Ve,
							onFilter: (e) => {
								w(e), O(1);
							},
							pageKeys: Ge,
							selected: j,
							onSelected: M,
							selectedRows: J,
							metadata: V,
							approvable: J.every((e) => oe(g, e)),
							busy: Z.isPending || X.isPending,
							feedback: ce,
							onUnifySource: $e,
							onRun: Qe
						}),
						We.rows.length ? qe.map((e) => /* @__PURE__ */ (0, Q.jsxs)("section", {
							className: "flex flex-col gap-3",
							children: [qe.length > 1 || W !== "candidates" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
									className: "text-body-medium text-text-primary",
									children: `${e.title} · ${e.rows.length}`
								}), H ? null : /* @__PURE__ */ (0, Q.jsx)(r, {
									variant: "ghost",
									size: "small",
									onClick: () => {
										let t = e.rows.map((e) => e.item_key), n = t.every((e) => j.has(e)), r = new Set(j);
										for (let e of t) n ? r.delete(e) : r.add(e);
										M(r);
									},
									children: e.rows.every((e) => j.has(e.item_key)) ? G("manage:reviewPage.clearGroup") : G("manage:reviewPage.selectGroup")
								})]
							}) : null, /* @__PURE__ */ (0, Q.jsx)("div", {
								className: "review-grid gap-5",
								children: e.rows.map((e) => /* @__PURE__ */ (0, Q.jsx)($t, {
									category: g,
									row: e,
									queueView: v,
									choice: q(e),
									onChoice: (t) => P((n) => new Map(n).set(e.item_key, t)),
									selected: j.has(e.item_key),
									onSelect: (t, n) => M((r) => {
										let i = new Set(r);
										return L.current = Ne(i, Ge, L.current, e.item_key, t, n), i;
									}),
									locked: H,
									busy: Z.isPending || X.isPending && X.variables?.row.item_key === e.item_key,
									problem: se.get(e.item_key) || "",
									genreTags: nt,
									onDecide: (t) => {
										X.isPending || Z.isPending || (F((t) => new Map([...t].filter(([t]) => t !== e.item_key))), X.mutate({
											row: e,
											status: t,
											category: g
										}));
									},
									handlers: rt
								}, e.item_key))
							})]
						}, e.key)) : z.isError && !z.data ? /* @__PURE__ */ (0, Q.jsx)(y, {
							tone: "error",
							title: G("manage:reviewPage.queueLoadFailed"),
							action: /* @__PURE__ */ (0, Q.jsx)(r, {
								variant: "secondary",
								size: "small",
								disabled: z.isFetching,
								onClick: () => void z.refetch(),
								children: G("manage:shared.retryNow")
							}),
							children: R(z.error)
						}) : /* @__PURE__ */ (0, Q.jsx)(m, {
							icon: be,
							title: G({
								pending: "manage:reviewPage.emptyPending",
								later: "manage:reviewPage.emptyLater",
								ignored: "manage:reviewPage.emptyIgnored"
							}[v]),
							actions: b.some((e) => e !== g && Number(Te.counts[e] || 0) > 0) ? /* @__PURE__ */ (0, Q.jsx)(r, {
								size: "small",
								onClick: () => {
									let e = t.find((e) => e !== g && Number(Te.counts[e] || 0) > 0);
									e && Ze(e);
								},
								children: G("manage:reviewPage.viewOtherCategories")
							}) : void 0,
							children: G(v === "pending" ? "manage:reviewPage.switchCategoryHint" : v === "later" ? "manage:reviewPage.laterKeptHint" : "manage:reviewPage.ignoredKeptHint")
						}),
						Ue.length ? /* @__PURE__ */ (0, Q.jsx)(d, {
							label: G("manage:reviewPage.footerLabel"),
							total: Ue.length,
							pagination: {
								pageIndex: We.page - 1,
								pageSize: k
							},
							onChange: (e) => {
								O(e.pageIndex + 1), A(e.pageSize);
							}
						}) : null,
						V && v === "pending" ? /* @__PURE__ */ (0, Q.jsx)(at, {
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
export { tn as ReviewPage };

//# debugId=169cf156-1abc-436e-9a3f-19d99a001a4d