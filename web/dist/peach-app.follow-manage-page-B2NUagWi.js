(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "06aab636-612c-42ca-b61c-8e8a34cb241e", e._sentryDebugIdIdentifier = "sentry-dbid-06aab636-612c-42ca-b61c-8e8a34cb241e");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, DataTableFooter as y, DataTableFrame as ee, DataTableSort as b, EmptyFocusButton as x, EmptyState as S, ErrorText as C, ExternalLink as w, FEEDS_KEY as T, FOLLOW_CHECK_KEY as E, FOLLOW_CHECK_TASK as D, FOLLOW_CREDENTIALS_KEY as O, FOLLOW_MANAGE_KEY as k, FOLLOW_MANAGE_NAV as A, FOLLOW_RESOLVE_KEY as j, FieldLabel as M, Help as N, Input as P, LAYOUTS as F, M6 as I, MENU_ITEM as L, MENU_ITEM_INTERACTIVE as R, MENU_POPOVER_SURFACE as z, ModalFrame as te, Note as B, P7 as ne, SORT_DEFAULT_DIR as V, SORT_OPTIONS as re, STAT_STRIP_SIX as H, Select as ie, SelectItem as ae, SelectionDock as oe, SelectionPopover as U, SiteLabel as W, SortDirectionIcon as se, SortableBoardTabs as ce, Switch as le, Table as ue, TableColumnControls as de, TableColumnResizer as fe, TableSelectionHeader as pe, TagManager as me, TaskProgress as he, Un as G, Wt as ge, Xf as _e, __toESM as ve, activityKind as ye, addAlias as be, addSource as xe, authorGroups as Se, authorName as Ce, avatarInner as we, busyProps as K, cardClass as Te, checkEvidenceGap as Ee, checkFailures as De, checkFeeds as Oe, checkReceipt as ke, checkSummary as Ae, checkedText as je, clickedBlank as Me, codedText as Ne, columnVisibilityFeature as Pe, composingKey as Fe, confirmModal as Ie, createColumnHelper as Le, credentialDone as Re, cx as ze, dZ as Be, dropSources as Ve, du as He, enterPageSelection as Ue, errorHeadline as We, errorMessage as q, exitPageSelection as Ge, feedIntervalText as Ke, fetchCheckJob as qe, fetchCredentials as Je, fetchFeeds as Ye, fetchFollow as Xe, fetchResolveJob as Ze, fetchSuggestions as Qe, flexRender as $e, followFeedByName as et, followFeedEntity as tt, followSuggestKey as nt, groupByAuthor as rt, isBroken as it, isLayout as at, jobText as ot, joinList as st, keepSelected as ct, l7 as lt, localTime as ut, lookupFeedActor as dt, mapLimit as ft, markAllPending as pt, pageSizeOf as mt, pageWindow as ht, patchSource as gt, pv as _t, queryClient as vt, quoted as yt, reloadFollowManage as J, removeAlias as bt, removeFeed as xt, removeSource as St, renameAliasGroup as Ct, require_jsx_runtime as wt, require_react as Tt, resolveFollowSort as Et, rowPaginationFeature as Dt, rowSelectionFeature as Ot, rowSortingFeature as kt, runBulkAction as At, selectionState as jt, serverLabel as Mt, setFeedEnabled as Nt, setSourceEnabled as Pt, sortLabel as Ft, startCheck as It, startResolve as Lt, t as Y, tableFeatures as Rt, tableRows as zt, toggleGroup as Bt, unmarkItems as Vt, useAction as Ht, useBackgroundJob as Ut, useMutation as Wt, usePageSelection as Gt, useQuery as Kt, useTable as qt, useTablePreferences as Jt } from "./peach-app.js";
import { Page as Yt } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as Xt, ErrorLine as Zt, SourceIcon as Qt, SourceLink as $t, StatusBadge as en } from "./peach-app.source-view-B-2OVj4g.js";
import { createPaginatedRowModel as tn, createSortedRowModel as nn, useTableSelection as rn } from "./peach-app.use-table-selection-CnuGRvGn.js";
import { LEGACY_AVATAR_IMG as an } from "./peach-app.legacy-avatar-NSITxLRS.js";
// src/react/follow-manage/add-source.tsx
var X = /* @__PURE__ */ ve(Tt(), 1), Z = wt(), on = ze(L, R, "text-body-2-medium"), sn = Y("follow:addCreatorSource.placeholder"), cn = Y("follow:addCreatorSource.title"), ln = Y("follow:addCreatorSource.searchingByName"), un = Y("follow:addCreatorSource.recognizing"), dn = Y("follow:addCreatorSource.noSourceFound"), fn = "/settings/subscriptions", pn = (e, t) => `${e}:${t.url}`;
function mn({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
	return (0, X.useEffect)(() => {
		n.current?.querySelector("[aria-current=\"true\"]")?.scrollIntoView({ block: "nearest" });
	}, [n, i]), /* @__PURE__ */ (0, Z.jsxs)(t, {
		ref: n,
		triggerRef: e,
		isOpen: !0,
		isNonModal: !0,
		shouldFlip: !1,
		onOpenChange: (e) => {
			e || s();
		},
		placement: "bottom start",
		offset: 4,
		"aria-label": Y("follow:addCreatorSource.suggestions"),
		className: ze(z, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
		children: [a && !r.length ? /* @__PURE__ */ (0, Z.jsx)("div", {
			className: "px-2 py-1.5",
			children: /* @__PURE__ */ (0, Z.jsx)(l, {
				kind: "radar",
				label: Y("follow:addCreatorSource.findingSuggestions")
			})
		}) : null, r.map((e, t) => /* @__PURE__ */ (0, Z.jsxs)(X.Fragment, { children: [e.group === r[t - 1]?.group ? null : /* @__PURE__ */ (0, Z.jsx)("div", {
			className: "px-2 pt-1 text-caption-1-regular text-text-tertiary",
			children: e.group
		}), /* @__PURE__ */ (0, Z.jsxs)("button", {
			type: "button",
			"aria-current": t === i ? "true" : void 0,
			className: t === i ? ze(on, "bg-background-secondary-default") : on,
			onMouseDown: (e) => e.preventDefault(),
			onClick: () => o(e.value),
			children: [
				/* @__PURE__ */ (0, Z.jsx)("span", {
					className: "min-w-0 grow truncate text-left",
					children: e.value
				}),
				e.matched ? /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "shrink-0 text-caption-1-regular text-text-tertiary",
					children: e.matched
				}) : null,
				e.n ? /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "shrink-0 text-caption-1-regular tabular-nums text-text-tertiary",
					children: e.n.toLocaleString()
				}) : null
			]
		})] }, `${e.group}-${e.value}`))]
	});
}
function hn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? Y("follow:addCreatorSource.allSources") : Y("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Z.jsx)(U, {
		label: Y("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: Y("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Z.jsx)(Qt, { provider: e.provider }), e.provider_label]
			})
		})),
		onChange: (e, r) => {
			let i = new Set(t);
			r ? i.delete(e) : i.add(e), n(i);
		},
		actions: [
			{
				label: Y("follow:shared.selectAll"),
				disabled: !r.length,
				onPress: () => n(/* @__PURE__ */ new Set())
			},
			{
				label: Y("follow:shared.selectNone"),
				disabled: !r.length,
				onPress: () => n(new Set(r.map((e) => e.provider_label)))
			},
			{
				label: Y("follow:addCreatorSource.credentialSettings"),
				href: fn
			}
		]
	});
}
function gn({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Z.jsx)(B, {
		tone: "error",
		title: e.line,
		children: ot(e, "error") || Y("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Te({
			variant: "outlined",
			padding: "none",
			className: "flex flex-col gap-2 p-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("b", {
				className: "text-body-medium text-text-primary",
				children: e.line
			}),
			a.length ? a.map((e) => {
				let n = pn(t, e);
				return /* @__PURE__ */ (0, Z.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(Qt, { provider: e.provider }),
							/* @__PURE__ */ (0, Z.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "min-w-0 break-words",
								children: Ne(e, "label")
							}),
							/* @__PURE__ */ (0, Z.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? Y("follow:addCreatorSource.alreadyFollowing") : Ne(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Z.jsx)(N, { children: dn }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: Ne(e, "evidence")
				}), /* @__PURE__ */ (0, Z.jsx)(w, {
					href: e.url,
					children: Y("follow:shared.labeled", {
						label: Ne(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Z.jsx)(N, { children: st(o.map(([t, n]) => Y("follow:shared.labeled", {
				label: t,
				value: Mt(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function _n({ data: e, credentials: t, readOnly: n, toast: r }) {
	let [i, a] = (0, X.useState)(""), [o, s] = (0, X.useState)(!1), [c, l] = (0, X.useState)(""), [d, f] = (0, X.useState)(""), [p, m] = (0, X.useState)(!1), [h, g] = (0, X.useState)(null), [_, v] = (0, X.useState)(-1), y = (0, X.useRef)(null), ee = (0, X.useRef)(null), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, X.useState)(/* @__PURE__ */ new Set()), [w, T] = (0, X.useState)(""), [E, D] = (0, X.useState)(0);
	(0, X.useEffect)(() => {
		let e = i.trim();
		if (o || !e || e.includes("/")) {
			f("");
			return;
		}
		let t = setTimeout(() => f(e), 250);
		return () => clearTimeout(t);
	}, [i, o]);
	let O = Kt({
		queryKey: nt(d),
		queryFn: ({ signal: e }) => Qe(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), k = (0, X.useMemo)(() => (O.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: Mt(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: Mt(e.label_code ?? "", e.label)
	}))), [O.data]), { job: A, running: N, outcome: F, start: I, dismiss: L } = Ut({
		queryKey: j,
		queryFn: ({ signal: e }) => Ze(e),
		start: (e) => Lt([e]),
		onStarted: () => C(/* @__PURE__ */ new Set()),
		onError: (e) => T(q(e)),
		onFinish: (e) => {
			e.status === "failed" && T(ot(e, "error") || Y("follow:addCreatorSource.searchFailed"));
		}
	}), R = (e) => {
		let t = e.trim();
		!t || n || o || N || I.isPending || (T(""), v(-1), l(t), a(t), f(""), g(t), I.mutate(t));
	}, z = O.isFetching, te = p && !o && h !== i && (k.length > 0 || z), ne = () => {
		v(-1), g(i);
	}, V = (e) => {
		if (!(o || Fe(e.nativeEvent))) {
			if (e.key === "Escape" && te) ne();
			else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!k.length) return;
				if (e.preventDefault(), !te) {
					g(null);
					return;
				}
				let t = e.key === "ArrowDown" ? 1 : -1;
				v((e) => {
					let n = e + t;
					return n < 0 ? k.length - 1 : n >= k.length ? 0 : n;
				});
			} else e.key === "Enter" && (e.preventDefault(), R(k[_]?.value || i));
		}
	}, re = F?.results || [], H = re.flatMap((e, t) => (e.candidates || []).filter((e) => !e.known && !b.has(e.provider_label || "")).map((e) => ({
		candidate: e,
		key: pn(t, e)
	})).filter((e) => !S.has(e.key))), ie = Wt({
		mutationFn: async (e) => {
			let t = [], n = [];
			D(0);
			for (let r of e) {
				try {
					let e = await xe(r.candidate);
					n.push(e.source);
				} catch (e) {
					t.push(Y("follow:shared.labeled", {
						label: r.candidate.label,
						value: q(e)
					}));
				}
				D((e) => e + 1);
			}
			if (n.length) try {
				await It(n);
			} catch (e) {
				t.push(q(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			J(), e.failures.length ? T(st(e.failures)) : (T(""), L(), r(Y("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => T(q(e))
	}), ae = e.suggestions || [], oe = !c.includes("/");
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": cn,
		className: Te({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: cn
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						ref: y,
						className: "min-w-64 grow",
						onFocus: () => m(!0),
						onBlur: (e) => {
							let t = e.relatedTarget;
							!e.currentTarget.contains(t) && !ee.current?.contains(t) && m(!1);
						},
						children: [/* @__PURE__ */ (0, Z.jsx)(P, {
							"aria-label": Y("follow:addCreatorSource.inputLabel"),
							placeholder: sn,
							value: i,
							leadingIcon: _t,
							enterKeyHint: "search",
							isDisabled: n,
							onChange: a,
							onCompositionStart: () => {
								s(!0), v(-1);
							},
							onCompositionEnd: (e) => {
								s(!1), a(e.currentTarget.value);
							},
							onKeyDown: V
						}), te ? /* @__PURE__ */ (0, Z.jsx)(mn, {
							field: y,
							menu: ee,
							options: k,
							active: _,
							busy: z,
							onPick: R,
							onClose: ne
						}) : null]
					}),
					/* @__PURE__ */ (0, Z.jsx)(hn, {
						credentials: t,
						hidden: b,
						onHidden: x
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...K(N || I.isPending),
						onClick: () => R(i),
						children: Y("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [N || I.isPending ? /* @__PURE__ */ (0, Z.jsx)(he, {
					embedded: !0,
					kind: ye("follow-resolve"),
					label: ot(A) || (A?.total ? Y("follow:addCreatorSource.searchProgress", {
						checked: A.checked || 0,
						count: A.total
					}) : oe ? ln : un),
					value: A?.checked,
					total: A?.total
				}) : null, w ? /* @__PURE__ */ (0, Z.jsx)(B, {
					tone: "error",
					title: Y("follow:addJavFeed.notCompleted"),
					children: w
				}) : null]
			}),
			re.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:addCreatorSource.results") }),
					re.map((e, t) => /* @__PURE__ */ (0, Z.jsx)(gn, {
						row: e,
						at: t,
						hidden: b,
						unpicked: S,
						onPick: (e, t) => {
							let n = new Set(S);
							t ? n.delete(e) : n.add(e), C(n);
						}
					}, `${e.line}-${t}`)),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "secondary",
								size: "small",
								onClick: () => L(),
								children: Y("follow:shared.close")
							}),
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: n || !H.length,
								...K(ie.isPending),
								onClick: () => ie.mutate(H),
								children: Y("follow:addCreatorSource.addSelected", { count: H.length })
							}),
							ie.isPending ? /* @__PURE__ */ (0, Z.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:addCreatorSource.addingProgress", {
									added: E,
									count: H.length
								})
							}) : null
						]
					})
				]
			}) : null,
			ae.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: Y("follow:addCreatorSource.suggested")
				}), ae.map((e) => /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: n,
					title: e.origin ? Y("follow:addCreatorSource.historyVisitsFrom", {
						count: e.visits,
						origin: e.origin
					}) : Y("follow:addCreatorSource.historyVisits", { count: e.visits }),
					onClick: () => R(e.name),
					children: e.name
				}, e.name))]
			}) : null
		]
	});
}
// src/react/follow-manage/add-feed.tsx
var vn = Y("follow:addJavFeed.placeholder"), yn = Y("follow:addJavFeed.title");
function bn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: Y("follow:addJavFeed.cardsSplitAcrossPeople", { names: st([...n.values()]) }),
		blocked: !0
	};
	let [r] = n.values();
	return r ? {
		text: Y("follow:addJavFeed.willAddUnder", { name: r }),
		blocked: !1
	} : e.known ? {
		text: Y("follow:addJavFeed.willAddUnderKnown", { name: e.known.name }),
		blocked: !1
	} : {
		text: Y("follow:addJavFeed.willCreate", { name: e.q }),
		blocked: !1
	};
}
function xn({ card: e, picked: t, onPick: n }) {
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [/* @__PURE__ */ (0, Z.jsx)(m, {
			isSelected: t,
			onChange: n,
			children: /* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 flex-wrap items-center gap-1.5",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "min-w-0 break-words",
						children: st(e.names)
					}),
					e.record ? /* @__PURE__ */ (0, Z.jsx)(g, {
						variant: "caption",
						color: "neutral",
						children: e.record
					}) : null,
					e.held_by ? /* @__PURE__ */ (0, Z.jsx)("small", {
						className: "text-caption-1-regular text-text-secondary",
						children: Y("follow:addJavFeed.alreadyUnder", { name: e.held_by.name })
					}) : null
				]
			})
		}), /* @__PURE__ */ (0, Z.jsx)(w, {
			href: e.url,
			children: e.id
		})]
	});
}
function Sn({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, X.useState)(""), [a, o] = (0, X.useState)(null), [s, c] = (0, X.useState)(/* @__PURE__ */ new Set()), l = Ht(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => dt(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !Fe(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => et(a.q, [...s], e), (e) => {
			t(e.created ? Y("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : Y("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => tt(e.id, t), () => {
			t(Y("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? bn(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": yn,
		className: Te({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: yn
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Z.jsx)(P, {
						"aria-label": Y("follow:addJavFeed.actressName"),
						placeholder: vn,
						value: r,
						leadingIcon: _t,
						enterKeyHint: "search",
						isDisabled: e,
						onChange: i,
						onKeyDown: f
					})
				}), /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "primary",
					disabled: e || !r.trim(),
					...K(l.busy === "lookup"),
					onClick: d,
					children: Y("follow:shared.search")
				})]
			}),
			l.error ? /* @__PURE__ */ (0, Z.jsx)(B, {
				tone: "error",
				title: Y("follow:addJavFeed.notCompleted"),
				children: l.error
			}) : null,
			a ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					a.unavailable ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "warning",
						title: Y("follow:addJavFeed.javdbSearchFailed"),
						children: Mt(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Z.jsx)(xn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Z.jsx)(N, { children: a.unavailable ? Y("follow:addJavFeed.noCardsThisTime") : Y("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Z.jsx)(N, {
						role: "status",
						children: s.size ? g.text : Y("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Z.jsx)(N, {
						role: "status",
						children: _.following ? Y("follow:addJavFeed.alreadySubscribed", { name: _.name }) : Y("follow:addJavFeed.canSubscribeDirectly", { name: _.name })
					}) : null,
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "secondary",
								size: "small",
								onClick: p,
								children: Y("follow:shared.close")
							}),
							a.candidates.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: e || !s.size || g.blocked,
								...K(l.busy === "follow"),
								onClick: m,
								children: Y("follow:addJavFeed.subscribePicked", { count: s.size })
							}) : null,
							_ && !_.following ? /* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: e,
								...K(l.busy === "known"),
								onClick: h,
								children: Y("follow:addJavFeed.subscribeTo", { name: _.name })
							}) : null
						]
					})
				]
			}) : null
		]
	});
}
// src/react/follow-manage/alias-rename-dialog.tsx
function Cn({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Z.jsx)(te, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: Y("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Z.jsx)(wn, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function wn({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, X.useState)(t.canonical_name), o = Ht();
	return /* @__PURE__ */ (0, Z.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => Ct(t.canonical_key, i.trim(), e), () => {
				J(), r(Y("follow:creatorAliases.renamed", { name: i.trim() })), n();
			});
		},
		className: "flex min-h-0 flex-col gap-4 p-5",
		children: [
			/* @__PURE__ */ (0, Z.jsx)(e, {
				slot: "title",
				className: "text-title-2-semibold text-text-primary",
				children: Y("follow:creatorAliases.rename")
			}),
			/* @__PURE__ */ (0, Z.jsxs)("p", {
				className: "text-body-2-regular wrap-anywhere text-text-secondary",
				children: [Y("follow:creatorAliases.currentName"), t.canonical_name]
			}),
			/* @__PURE__ */ (0, Z.jsx)(P, {
				"aria-label": Y("follow:creatorAliases.displayName"),
				autoFocus: !0,
				value: i,
				onChange: a
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.chooseExisting") }), /* @__PURE__ */ (0, Z.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: t.aliases.map((e) => /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: () => a(e.name),
						children: e.name
					}, e.key))
				})]
			}),
			/* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: Y("follow:creatorAliases.renameHint")
			}),
			o.error ? /* @__PURE__ */ (0, Z.jsx)(B, {
				tone: "error",
				children: o.error
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					onClick: n,
					children: Y("follow:shared.cancel")
				}), /* @__PURE__ */ (0, Z.jsx)(u, {
					type: "submit",
					variant: "primary",
					disabled: !i.trim() || i.trim() === t.canonical_name,
					...K(!!o.busy),
					children: Y("follow:creatorAliases.rename")
				})]
			})
		]
	});
}
// src/react/follow-manage/alias-manager.tsx
var Tn = (e) => Y("follow:creatorAliases.removeBody", { alias: e }), En = Rt({
	rowSelectionFeature: Ot,
	rowSortingFeature: kt,
	rowPaginationFeature: Dt,
	columnVisibilityFeature: Pe,
	sortedRowModel: nn(),
	paginatedRowModel: tn()
}), Dn = En, On = {
	id: "select",
	label: Y("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, kn = {
	id: "canonical",
	label: Y("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, An = [
	On,
	kn,
	{
		id: "alias",
		label: Y("follow:creatorAliases.platformAlias"),
		width: 240
	},
	{
		id: "evidence",
		label: Y("follow:creatorAliases.evidence"),
		width: 320
	},
	{
		id: "actions",
		label: Y("follow:shared.actions"),
		width: 112
	}
], jn = [
	On,
	kn,
	{
		id: "aliases",
		label: Y("follow:creatorAliases.platformAlias"),
		width: 400
	},
	{
		id: "actions",
		label: Y("follow:shared.actions"),
		width: 184,
		min: 168
	}
], Mn = (e) => e.alias;
function Nn(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function Pn({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Z.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Z.jsx)(Xt, {
			group: Nn(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Z.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function Fn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = Jt("alias-suggestions", An), f = Jt("alias-saved", jn), [p, g] = (0, X.useState)(null), [_, v] = (0, X.useState)({}), [w, T] = (0, X.useState)({});
	Gt(() => {
		v({}), T({});
	}), (0, X.useEffect)(() => {
		(Object.values(_).some(Boolean) || Object.values(w).some(Boolean)) && Ue();
	}, [_, w]);
	let E = rn(() => v({})), D = rn(() => T({})), [O, k] = (0, X.useState)([]), [A, j] = (0, X.useState)([]), [N, F] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [I, L] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), R = {
		...N,
		pageIndex: Math.min(N.pageIndex, Math.max(0, Math.ceil(t.length / N.pageSize) - 1))
	}, z = {
		...I,
		pageIndex: Math.min(I.pageIndex, Math.max(0, Math.ceil(e.length / I.pageSize) - 1))
	}, [te, B] = (0, X.useState)(""), [V, re] = (0, X.useState)(""), [H, ie] = (0, X.useState)(""), ae = Wt({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await be(n.canonical, n.alias);
				} catch (n) {
					throw t && J(), Error(Y("follow:creatorAliases.mergePartialError", {
						error: q(n),
						count: e.length - t
					}));
				}
				t += 1;
			}
			return {
				done: t,
				items: e
			};
		},
		onSuccess: () => {
			B(""), v({}), J();
		},
		onError: (e) => B(q(e))
	}), U = Wt({
		mutationFn: (e) => be(e.canonical, e.alias),
		onSuccess: () => {
			B(""), re(""), ie(""), J(), l(Y("follow:creatorAliases.saved"));
		},
		onError: (e) => B(q(e))
	}), W = Wt({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await bt(e), n += 1;
			} catch (e) {
				throw Error(Y("follow:creatorAliases.removePartialError", {
					error: q(e),
					removed: n,
					count: t.length - n
				}));
			} finally {
				J();
			}
		},
		onSuccess: (e, t) => {
			B(""), T({}), typeof t == "string" && l(Y("follow:creatorAliases.removed"));
		},
		onError: (e) => B(q(e))
	}), se = {
		receipt: l,
		failure: (e) => B(q(e))
	}, ce = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: Y(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: Y(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: Y("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: st(t.map((e) => Y("follow:creatorAliases.mergePair", {
					alias: yt(e.alias),
					canonical: yt(e.canonical)
				})))
			}),
			confirmLabel: Y(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await ae.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await bt(n.alias);
				await J();
			};
		},
		receipt: (e) => Y("follow:creatorAliases.merged", { count: e.length })
	}), le = (e, t) => {
		e.length && At(ce(t, e.length), e, se).catch(se.failure);
	}, me = {
		key: "remove",
		reversal: "undo",
		label: Y("follow:creatorAliases.removeSelectedCount", { count: 0 }),
		confirm: (e) => ({
			title: Y("follow:creatorAliases.removeSelectedTitle"),
			body: Y("follow:creatorAliases.removeSelectedBody", { count: e.length }),
			items: e.map((e) => e.name),
			confirmLabel: Y("follow:creatorAliases.removeSelectedConfirm")
		}),
		run: async (e) => (await W.mutateAsync(e.map((e) => e.name)), async () => {
			for (let t of e) await be(t.canonical, t.name);
			await J();
		}),
		receipt: () => Y("follow:creatorAliases.removed")
	}, he = (e) => void Ie({
		title: Y("follow:creatorAliases.removeTitle"),
		body: Tn(e),
		confirmLabel: Y("follow:creatorAliases.removeTitle"),
		onConfirm: () => W.mutateAsync(e)
	}), G = (0, X.useRef)({
		sources: s,
		readOnly: c,
		merging: ae.isPending,
		removing: W.isPending,
		merge: le,
		remove: he,
		rename: g
	});
	G.current = {
		sources: s,
		readOnly: c,
		merging: ae.isPending,
		removing: W.isPending,
		merge: le,
		remove: he,
		rename: g
	};
	let ge = (0, X.useMemo)(() => {
		let e = Le();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(pe, {
					table: e.table,
					label: Y("follow:creatorAliases.selectAllPending")
				}),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					"aria-label": Y("follow:creatorAliases.selectPendingRow", {
						alias: e.row.original.alias,
						name: e.row.original.canonical
					}),
					onChange: (t) => e.row.toggleSelected(t)
				})
			}),
			e.accessor("canonical", {
				header: Y("follow:creatorAliases.displayName"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Pn, {
					sources: G.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: Y("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => Mt(e.evidence_code ?? "", e.evidence, e.evidence_params), {
				id: "evidence",
				header: Y("follow:creatorAliases.evidence"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: e.getValue()
				})
			}),
			e.display({
				id: "actions",
				header: Y("follow:shared.actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: G.current.readOnly,
					...K(G.current.merging),
					onClick: () => G.current.merge([e.row.original], !1),
					children: Y("follow:shared.merge")
				})
			})
		]);
	}, []), ve = (0, X.useMemo)(() => {
		let e = Le();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Z.jsx)(pe, {
					table: e,
					label: Y("follow:creatorAliases.selectAllSaved")
				}),
				cell: ({ row: e }) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					"aria-label": Y("follow:creatorAliases.selectSavedRow", { name: e.original.canonical_name }),
					isSelected: e.getIsSelected(),
					onChange: (t) => e.toggleSelected(t)
				})
			}),
			e.accessor("canonical_name", {
				id: "canonical",
				header: Y("follow:creatorAliases.displayName"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Pn, {
					sources: G.current.sources,
					name: e.getValue(),
					canonicalKey: e.row.original.canonical_key
				})
			}),
			e.accessor("aliases", {
				header: Y("follow:creatorAliases.platformAlias"),
				sortFn: (e, t) => e.original.aliases.map((e) => e.name).join(" ").localeCompare(t.original.aliases.map((e) => e.name).join(" "), "zh-CN"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "flex flex-wrap items-center gap-1.5",
					children: e.getValue().map((e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "inline-flex items-center gap-1 rounded-md bg-background-secondary-default px-1.5 py-1 text-caption-1-medium text-text-secondary",
						children: [e.name, /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "xs",
							iconOnly: !0,
							leadingIcon: ne,
							"aria-label": Y("follow:creatorAliases.removeAliasNamed", { name: e.name }),
							disabled: G.current.readOnly,
							...K(G.current.removing),
							onClick: () => G.current.remove(e.name)
						})]
					}, e.key))
				})
			}),
			e.display({
				id: "actions",
				header: Y("follow:shared.actions"),
				cell: ({ row: e }) => /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: G.current.readOnly,
					"aria-label": Y("follow:creatorAliases.renameRowLabel", { name: e.original.canonical_name }),
					onClick: () => G.current.rename(e.original),
					children: Y("follow:creatorAliases.rename")
				})
			})
		]);
	}, []), ye = qt({
		features: En,
		data: t,
		columns: ge,
		getRowId: Mn,
		state: {
			rowSelection: _,
			sorting: O,
			pagination: R,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			E(), v(e);
		},
		onSortingChange: (e) => {
			k(e), F((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: F,
		enableRowSelection: !0
	}), xe = qt({
		features: Dn,
		data: e,
		columns: ve,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: w,
			sorting: A,
			pagination: z,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			D(), T(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			j(e), L((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: L
	}), Se = ye.getSelectedRowModel().rows.map((e) => e.original), Ce = xe.getSelectedRowModel().rows.flatMap((e) => e.original.aliases.map((t) => ({
		name: t.name,
		canonical: e.original.canonical_name
	}))), we = K(ae.isPending);
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Te({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: Y("follow:creatorAliases.title")
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.addManually") }), /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(P, {
							"aria-label": Y("follow:creatorAliases.displayName"),
							placeholder: Y("follow:creatorAliases.displayNamePlaceholder"),
							value: V,
							onChange: re,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(P, {
							"aria-label": Y("follow:creatorAliases.platformAlias"),
							placeholder: Y("follow:creatorAliases.platformAlias"),
							value: H,
							onChange: ie,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							disabled: c || !V.trim() || !H.trim(),
							...K(U.isPending),
							onClick: () => U.mutate({
								canonical: V.trim(),
								alias: H.trim()
							}),
							children: Y("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			te ? /* @__PURE__ */ (0, Z.jsx)(C, { children: te }) : null,
			t.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: t.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [
								/* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "primary",
									size: "small",
									disabled: c,
									...we,
									onClick: () => le(t, !0),
									children: Y("follow:creatorAliases.mergeAllCount", { count: t.length })
								}),
								/* @__PURE__ */ (0, Z.jsx)(b, {
									label: Y("follow:creatorAliases.pendingTable"),
									sorting: O,
									options: [
										{
											id: "canonical",
											label: Y("follow:creatorAliases.displayName")
										},
										{
											id: "alias",
											label: Y("follow:creatorAliases.platformAlias")
										},
										{
											id: "evidence",
											label: Y("follow:creatorAliases.evidence")
										}
									],
									onChange: (e) => {
										k(e), F((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Z.jsx)(de, {
									preferences: d,
									label: Y("follow:creatorAliases.pendingTable")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(oe, {
						label: Y("follow:creatorAliases.pendingBulkActions"),
						visible: Se.length > 0,
						count: Y("follow:creatorAliases.groupsSelected", { count: Se.length }),
						actions: [{
							action: ce(!1, Se.length),
							items: Se,
							host: se,
							disabled: c || ae.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Ge,
							children: Y("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(ee, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => ye.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(ue, {
							"aria-label": Y("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: O[0] ? {
								column: O[0].id,
								direction: O[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => ye.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [ye.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [$e(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(fe, {
									preferences: d,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: d.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: ye.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: $e(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(y, {
						label: Y("follow:creatorAliases.pendingTable"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: t.length,
						pagination: R,
						onChange: F
					})
				]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: e.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(b, {
								label: Y("follow:creatorAliases.saved"),
								sorting: A,
								options: [{
									id: "canonical",
									label: Y("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: Y("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									j(e), L((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Z.jsx)(de, {
								preferences: f,
								label: Y("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(oe, {
						label: Y("follow:creatorAliases.savedBulkActions"),
						visible: Ce.length > 0,
						count: Y("follow:creatorAliases.aliasesSelected", { count: Ce.length }),
						actions: [{
							action: {
								...me,
								label: Y("follow:creatorAliases.removeSelectedCount", { count: Ce.length })
							},
							items: Ce,
							host: se,
							disabled: c || W.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Ge,
							children: Y("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(ee, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => xe.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(ue, {
							"aria-label": Y("follow:creatorAliases.saved"),
							size: "sm",
							sortDescriptor: A[0] ? {
								column: A[0].id,
								direction: A[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => xe.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [xe.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [$e(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(fe, {
									preferences: f,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: f.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: xe.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: $e(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}), /* @__PURE__ */ (0, Z.jsx)(y, {
						label: Y("follow:creatorAliases.saved"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: e.length,
						pagination: z,
						onChange: L
					})] }) : /* @__PURE__ */ (0, Z.jsx)(S, {
						size: "compact",
						icon: _e,
						title: Y("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Z.jsx)(x, {
							target: `input[aria-label="${Y("follow:creatorAliases.displayName")}"]`,
							children: Y("follow:creatorAliases.addAlias")
						}),
						children: Y("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(Cn, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var In = Rt({
	rowPaginationFeature: Dt,
	rowSelectionFeature: Ot,
	rowSortingFeature: kt,
	columnVisibilityFeature: Pe,
	sortedRowModel: nn(),
	paginatedRowModel: tn()
}), Ln = {
	select: Y("follow:shared.select"),
	name: Y("follow:shared.name"),
	kind: Y("follow:shared.type"),
	origin: Y("follow:followFeed.filterKindSource"),
	status: Y("follow:shared.status"),
	interval: Y("follow:feedSources.colInterval"),
	fetched: Y("follow:feedSources.colLastFetched"),
	fresh: Y("follow:feedSources.colLastAdded"),
	actions: Y("follow:shared.actions")
}, Rn = /* @__PURE__ */ new Set(["actions"]), zn = Object.entries(Ln).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), Bn = () => vt.invalidateQueries({
	queryKey: T,
	exact: !0
}), Vn = (e) => e.name || e.url;
function Hn(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function Un({ source: e }) {
	return e.enabled ? e.last_error ? /* @__PURE__ */ (0, Z.jsx)(g, {
		variant: "caption",
		color: "rose",
		children: Y("follow:feedSources.fetchFailed")
	}) : e.last_fetched_at ? /* @__PURE__ */ (0, Z.jsx)(g, {
		variant: "caption",
		color: "lime",
		children: Y("follow:shared.ok")
	}) : /* @__PURE__ */ (0, Z.jsx)(g, {
		variant: "caption",
		color: "gray",
		children: Y("follow:feedSources.notChecked")
	}) : /* @__PURE__ */ (0, Z.jsx)(g, {
		variant: "caption",
		color: "gray",
		children: Y("follow:shared.paused")
	});
}
function Wn({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Z.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${an}`,
		dangerouslySetInnerHTML: { __html: we(Vn(e), t, null, "performer") }
	});
}
var Gn = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function Kn(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function qn(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return Ie({
		title: n ? Y("follow:feedSources.removeOne") : Y("follow:feedSources.removeMany", { count: e.length }),
		body: n ? Y("follow:feedSources.removeOneBody", { name: Vn(n) }) : Y("follow:feedSources.removeManyBody"),
		confirmLabel: Y(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		onConfirm: t
	});
}
function Jn({ readOnly: e, toast: t, onAdd: c, selection: l }) {
	let d = Kt({
		queryKey: T,
		queryFn: ({ signal: e }) => Ye(e)
	}), p = Ht(), g = Jt("jav-feeds", zn), _ = d.data, v = (0, X.useMemo)(() => _?.sources ?? [], [_]), [x, w] = (0, X.useState)(/* @__PURE__ */ new Set()), E = l?.ids ?? x, D = l?.onChange ?? w, [O, k] = (0, X.useState)(1), [A, j] = (0, X.useState)(20), [M, P] = (0, X.useState)([]), F = ht(v.length, A, O);
	(0, X.useEffect)(() => {
		k((e) => Math.min(e, F.pages));
	}, [F.pages]), (0, X.useEffect)(() => {
		D((e) => {
			let t = new Set(v.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [v, D]);
	let L = Wt({
		mutationFn: async (e) => {
			let t = await ft(e.ids, 4, async (t) => {
				e.action === "remove" ? await xt(t) : await Nt(t, e.action === "enabled");
			});
			return {
				...e,
				results: t
			};
		},
		onSuccess: (e) => {
			let t = e.results.filter((e) => !e.ok);
			if (D(/* @__PURE__ */ new Set()), Bn(), t.length) {
				let e = t[0];
				p.setError(Y("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : q(e.error)
				}));
			}
		},
		onError: (e) => p.setError(q(e))
	}), R = {
		receipt: t,
		failure: (e) => p.setError(q(e))
	}, z = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:feedSources.enableMany" : "follow:feedSources.pauseMany"),
			body: Y(e ? "follow:feedSources.enableManyBody" : "follow:feedSources.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => t.enabled !== e), { results: r } = await L.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await ft(i.map((e) => e.id), 4, (t) => Nt(t, !e)), await Bn();
			};
		},
		receipt: (t) => Y(e ? "follow:feedSources.enabledMany" : "follow:feedSources.pausedMany", { count: t.length })
	}), te = {
		key: "remove",
		label: Y("follow:shared.remove"),
		reversal: "irreversible",
		danger: !0,
		confirm: (e) => ({
			title: Y("follow:feedSources.removeMany", { count: e.length }),
			danger: !0,
			body: Y("follow:feedSources.removeManyBody"),
			confirmLabel: Y("follow:feedSources.removeSelected")
		}),
		run: async (e) => {
			await L.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:feedSources.removedMany", { count: e.length })
	}, ne = (0, X.useMemo)(() => Kn(v), [v]), V = (0, X.useRef)({
		readOnly: e,
		shared: ne,
		busy: null,
		toggle: () => {},
		fetch: () => {},
		remove: () => {}
	});
	V.current = {
		readOnly: e,
		shared: ne,
		busy: p.busy,
		toggle: (e, t) => void p.run(`enabled-${e.id}`, (n) => Nt(e.id, t, n), () => void Bn()),
		fetch: (e) => void p.run(`check-${e.id}`, (t) => Oe(t, [e.id]), () => void Bn()),
		remove: (e) => void qn([e], async () => {
			await xt(e.id), t(Y("follow:feedSources.removedOne", { name: Vn(e) })), Bn();
		})
	};
	let re = (0, X.useMemo)(() => {
		let e = Le(), t = (e) => () => Ln[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(pe, {
					table: e.table,
					label: Y("follow:feedSources.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": Y("follow:shared.selectNamed", { name: Vn(e.row.original) })
				})
			}),
			e.accessor(Vn, {
				id: "name",
				header: t("name"),
				cell: (e) => {
					let t = Gn(e.row.original, V.current.shared);
					return /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(Wn, { source: e.row.original }),
							e.getValue(),
							t ? /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								title: Y("follow:feedSources.aliasTitle", { alias: t }),
								children: t
							}) : null
						]
					});
				}
			}),
			e.accessor((e) => Ne(e, "kind_label"), {
				id: "kind",
				header: t("kind"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap",
					children: e.getValue()
				})
			}),
			e.accessor((e) => e.url, {
				id: "origin",
				header: t("origin"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("a", {
					href: e.getValue(),
					target: "_blank",
					rel: "noopener noreferrer",
					title: Y("follow:followDetail.viewOnSite"),
					className: "max-w-full text-text-primary underline-offset-2 hover:underline",
					children: [/* @__PURE__ */ (0, Z.jsx)(W, {
						site: e.row.original.kind.startsWith("javdb") ? "javdb" : e.row.original.kind.startsWith("dmm") ? "dmm" : Hn(e.getValue()),
						label: Hn(e.getValue())
					}), /* @__PURE__ */ (0, Z.jsx)(ge, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? Y("follow:feedSources.fetchFailed") : e.enabled ? Y("follow:shared.enabled") : Y("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Un, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap",
					children: Ke(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? ut(e.row.original.last_fetched_at) : Y("follow:feedSources.neverFetched")
				})
			}),
			e.accessor((e) => e.last_new_count, {
				id: "fresh",
				header: t("fresh"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: Y("follow:feedSources.itemCount", { count: e.getValue() })
				})
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(le, {
							"aria-label": Y("follow:shared.enableNamed", { name: Vn(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: V.current.readOnly,
							onChange: (t) => V.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Be,
							"aria-label": Y("follow:feedSources.fetchNamed", { name: Vn(e.row.original) }),
							disabled: V.current.readOnly,
							...K(V.current.busy === `check-${e.row.original.id}`),
							onClick: () => V.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: I,
							"aria-label": Y("follow:shared.removeNamed", { name: Vn(e.row.original) }),
							disabled: V.current.readOnly,
							onClick: () => V.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), H = (0, X.useMemo)(() => Object.fromEntries([...E].map((e) => [String(e), !0])), [E]), ie = qt({
		features: In,
		data: v,
		columns: re,
		getRowId: (e) => String(e.id),
		state: {
			rowSelection: H,
			sorting: M,
			pagination: {
				pageIndex: F.page - 1,
				pageSize: A
			},
			columnVisibility: g.visibility
		},
		onColumnVisibilityChange: g.change,
		onSortingChange: (e) => {
			P(e), k(1);
		},
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			l?.onActivate();
			let t = typeof e == "function" ? e(H) : e;
			D(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	});
	if (!_) return d.error ? /* @__PURE__ */ (0, Z.jsx)(B, {
		tone: "error",
		title: Y("follow:feedSources.loadFailed"),
		children: q(d.error)
	}) : /* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:feedSources.loading") });
	let ae = () => void p.run("check", (e) => Oe(e), () => void Bn()), U = (e) => {
		l?.onActivate(), D((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, se = v.filter((e) => E.has(e.id)), ce = v.filter((e) => e.last_error);
	return /* @__PURE__ */ (0, Z.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Z.jsxs)("section", {
			"aria-label": Y("follow:feedSources.listLabel"),
			className: Te({
				padding: "none",
				className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
			}),
			children: [
				/* @__PURE__ */ (0, Z.jsxs)("div", {
					"data-responsive-toolbar": "",
					children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-toolbar-heading": "",
						children: [/* @__PURE__ */ (0, Z.jsx)("h3", {
							className: "text-title-2-medium text-text-primary",
							children: Y("follow:feedSources.title")
						}), /* @__PURE__ */ (0, Z.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: Y("follow:feedSources.summary", {
								count: v.length,
								unread: Number(_.unread) || 0
							})
						})]
					}), /* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-toolbar-actions": "",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(u, {
								onClick: ae,
								disabled: e,
								...K(p.busy === "check"),
								children: Y("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Z.jsx)(de, {
								preferences: g,
								label: Y("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Z.jsx)(b, {
								label: Y("follow:feedSources.title"),
								sorting: M,
								onChange: (e) => {
									P(e), k(1);
								},
								options: [
									"name",
									"kind",
									"origin",
									"status",
									"interval",
									"fetched",
									"fresh"
								].map((e) => ({
									id: e,
									label: Ln[e]
								}))
							})
						]
					})]
				}),
				ce.length || p.error ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [ce.length ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "error",
						title: Y("follow:feedSources.failedTitle", { count: ce.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ce.map((e) => /* @__PURE__ */ (0, Z.jsx)("li", {
								className: "min-w-0 truncate",
								title: Ne(e, "last_error"),
								children: Y("follow:shared.labeled", {
									label: Vn(e),
									value: We(Ne(e, "last_error")) || Y("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: Y("follow:feedSources.failedBody")
					}) : null, p.error ? /* @__PURE__ */ (0, Z.jsx)(C, { children: p.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)(oe, {
					visible: se.length > 0,
					label: Y("follow:feedSources.bulkActions"),
					count: Y("follow:feedSources.selectedCount", { count: se.length }),
					actions: [
						z(!0),
						z(!1),
						te
					].map((t) => ({
						action: t,
						items: se,
						host: R,
						disabled: e || L.isPending
					})),
					children: /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: Ge,
						children: Y("follow:shared.clearSelection")
					})
				}),
				v.length ? /* @__PURE__ */ (0, Z.jsx)(ee, {
					follow: !0,
					preferences: g,
					onRowClick: (e) => U(Number(e)),
					children: /* @__PURE__ */ (0, Z.jsxs)(ue, {
						"aria-label": Y("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: M[0] ? {
							column: M[0].id,
							direction: M[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => ie.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [ie.getHeaderGroups()[0].headers.map((e) => {
							let t = $e(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...g.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [Rn.has(e.column.id) ? /* @__PURE__ */ (0, Z.jsx)(s, { children: t }) : /* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [t, e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(fe, {
									preferences: g,
									id: e.id
								})] })
							}, e.id);
						}), /* @__PURE__ */ (0, Z.jsx)(r, {
							id: "remaining-space",
							"aria-label": Y("follow:shared.rowSpacer"),
							"data-table-space": "",
							width: g.spaceWidth,
							minWidth: 0
						})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: ie.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: $e(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id)) })]
					})
				}) : /* @__PURE__ */ (0, Z.jsx)(S, {
					icon: f,
					title: Y("follow:feedSources.empty"),
					size: "compact",
					actions: e ? void 0 : /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						onClick: c,
						children: Y("follow:feedSources.add")
					}),
					children: Y("follow:feedSources.emptyHint")
				}),
				v.length ? /* @__PURE__ */ (0, Z.jsx)(y, {
					label: Y("follow:feedSources.footerLabel"),
					total: F.total,
					unit: Y("follow:feedSources.unit"),
					pagination: {
						pageIndex: F.page - 1,
						pageSize: A
					},
					onChange: (e) => {
						j(e.pageSize), k(e.pageIndex + 1);
					}
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)("footer", {
					className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
					children: /* @__PURE__ */ (0, Z.jsx)("span", {
						role: "status",
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:feedSources.footerSummary", {
							unread: Number(_.unread) || 0,
							enabled: v.filter((e) => e.enabled).length,
							total: v.length
						})
					})
				})
			]
		})
	});
}
// src/react/follow-manage/source-list.tsx
var Yn = Rt({
	rowPaginationFeature: Dt,
	rowSelectionFeature: Ot,
	rowSortingFeature: kt,
	columnVisibilityFeature: Pe,
	paginatedRowModel: tn()
}), Xn = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), Zn = 740;
function Qn() {
	let [e, t] = (0, X.useState)(!1), n = (0, X.useRef)(null), r = (0, X.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < Zn));
		r.observe(e), n.current = r, t(e.clientWidth < Zn);
	}, []);
	return (0, X.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var $n = {
	select: Y("follow:shared.select"),
	author: Y("follow:shared.creator"),
	source: Y("follow:followFeed.filterKindSource"),
	provider: Y("follow:shared.site"),
	status: Y("follow:shared.status"),
	checked: Y("follow:sourceList.colLastChecked"),
	actions: Y("follow:shared.actions")
}, er = Object.entries($n).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
}));
function tr({ source: e, selected: t, onToggle: n, handlers: r }) {
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		"data-selected": t || void 0,
		"data-follow-source-row": "",
		className: "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3 last:rounded-b-lg max-sm:gap-x-2",
		onClick: (e) => {
			Me(e, e.currentTarget) && n(!t);
		},
		children: [
			/* @__PURE__ */ (0, Z.jsx)(m, {
				isSelected: t,
				onChange: n,
				"aria-label": Y("follow:shared.selectNamed", { name: e.label })
			}),
			/* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 grow basis-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					"data-follow-source-site": "",
					className: "flex shrink-0 items-center text-body-medium",
					children: /* @__PURE__ */ (0, Z.jsx)(Qt, { provider: e.provider })
				}), /* @__PURE__ */ (0, Z.jsx)($t, { source: e })]
			}),
			/* @__PURE__ */ (0, Z.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Z.jsx)(en, { source: e }),
			e.last_error ? /* @__PURE__ */ (0, Z.jsxs)("span", {
				"data-follow-source-error": "",
				className: "flex min-w-0 basis-full gap-3 max-sm:gap-x-2 sm:order-last",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					"aria-hidden": !0,
					className: "w-4 shrink-0"
				}), /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex min-w-0 grow gap-1.5",
					children: [/* @__PURE__ */ (0, Z.jsx)("span", {
						"aria-hidden": !0,
						className: "w-(--icon-inline) shrink-0 text-body-medium"
					}), /* @__PURE__ */ (0, Z.jsx)("span", {
						className: "min-w-0 grow",
						children: /* @__PURE__ */ (0, Z.jsx)(Zt, { text: Ne(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: je(e)
					}),
					/* @__PURE__ */ (0, Z.jsx)(le, {
						"aria-label": Y("follow:shared.enableNamed", { name: e.label }),
						isSelected: e.enabled,
						isDisabled: r.readOnly,
						onChange: (t) => r.toggle(e, t)
					}),
					/* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex shrink-0 items-center gap-1",
						children: [/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Be,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...K(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: I,
							"aria-label": Y("follow:shared.removeNamed", { name: e.label }),
							disabled: r.readOnly,
							onClick: () => r.remove(e)
						})]
					})
				]
			})
		]
	});
}
function nr({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(it).length, p = st([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = jt(r, l);
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Y("follow:sourceList.groupLabel", { name: t }),
		className: Te({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Z.jsx)(Xt, {
					group: e,
					name: t
				}),
				/* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex min-w-0 grow basis-0 flex-col gap-1",
					children: [/* @__PURE__ */ (0, Z.jsx)("b", {
						className: "min-w-0 text-body-medium wrap-anywhere text-text-primary",
						children: t
					}), /* @__PURE__ */ (0, Z.jsxs)("span", {
						"data-follow-author-sites": "",
						className: "flex min-w-0 flex-wrap items-center gap-1 text-body-2-regular",
						title: p,
						children: [
							e.map((e) => /* @__PURE__ */ (0, Z.jsx)(Qt, { provider: e.provider }, e.id)),
							/* @__PURE__ */ (0, Z.jsx)(s, { children: Y("follow:sourceList.providers", { providers: p }) }),
							f ? /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "ml-1 shrink-0 text-text-error-primary",
								children: Y("follow:shared.failedCount", { count: f })
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, Z.jsxs)("span", {
					"data-follow-author-controls": "",
					className: "flex flex-none items-center gap-2 max-sm:w-full max-sm:justify-end",
					children: [/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						iconOnly: !0,
						leadingIcon: Be,
						"aria-label": Y("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...K(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: lt,
							"aria-pressed": h.all ? "true" : h.some ? "mixed" : "false",
							"aria-label": Y(h.all ? "follow:sourceList.deselectGroup" : "follow:sourceList.selectGroup", { name: t }),
							onClick: () => o(!h.all),
							children: h.all ? Y("follow:shared.deselectAll") : Y("follow:shared.selectAll")
						}), /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							"aria-expanded": n,
							"aria-controls": m,
							leadingIcon: _,
							"aria-label": Y(n ? "follow:sourceList.collapseGroup" : "follow:sourceList.expandGroup", { name: t }),
							onClick: () => a(!n),
							children: Y(n ? "follow:shared.collapse" : "follow:shared.expand")
						})]
					})]
				})
			]
		}), /* @__PURE__ */ (0, Z.jsx)(v, {
			id: m,
			open: n,
			"data-source-divider": !0,
			children: e.map((e) => /* @__PURE__ */ (0, Z.jsx)(tr, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function rr(e) {
	let { data: t, sort: c, dir: l, page: d, layout: g, pageSize: v, selected: b, readOnly: x, onSort: C, onPage: w, onLayout: T, onPageSize: O, onSelected: k, toast: A, openFollow: j, onAdd: M } = e, N = t.sources, P = (0, X.useMemo)(() => t.author_aliases || [], [t.author_aliases]), L = t.counts || {}, [R, z] = (0, X.useState)(/* @__PURE__ */ new Set()), [te, ne] = Qn(), [H, U] = (0, X.useState)(""), W = (0, X.useMemo)(() => Se(N, c, l, P), [
		N,
		c,
		l,
		P
	]), ce = (0, X.useMemo)(() => zt(W, c, l, P), [
		W,
		c,
		l,
		P
	]), { job: me, running: ge, outcome: _e, start: ve } = Ut({
		queryKey: E,
		taskKey: D,
		queryFn: ({ signal: e }) => qe(e),
		start: (e) => It(e),
		onError: (e) => U(q(e)),
		onFinish: (e) => {
			J(), A(e.status === "failed" ? ot(e, "error") || Y("follow:followCheck.checkFailed") : ke(e));
		}
	}), be = (e) => {
		ge || ve.isPending || (U(""), ve.mutate(e));
	}, xe = (e, t) => k(Bt(b, [e], t)), we = (e, t) => k(Bt(b, e, t)), Oe = Wt({
		mutationFn: (e) => St(e),
		onSuccess: (e, t) => {
			Ve([t]), k(Bt(b, [t], !1)), A(Y("follow:sourceList.unfollowed"));
		},
		onError: (e) => U(q(e))
	}), Me = Wt({
		mutationFn: (e) => Pt(e.id, e.enabled),
		onSuccess: (e, t) => {
			gt(t.id, { enabled: t.enabled }), U("");
		},
		onError: (e) => U(q(e))
	}), Pe = (e) => void Ie({
		title: Y("follow:sourceList.unfollow"),
		body: Y("follow:sourceList.unfollowBody"),
		confirmLabel: Y("follow:sourceList.unfollow"),
		danger: !0,
		onConfirm: () => Oe.mutateAsync(e.id)
	}), Fe = Wt({
		mutationFn: async (e) => {
			let t = await ft(e.ids, 4, async (t) => {
				e.action === "remove" ? await St(t) : await Pt(t, e.action === "enabled");
			});
			return {
				...e,
				done: e.ids.filter((e, n) => t[n]?.ok),
				results: t
			};
		},
		onSuccess: (e) => {
			if (e.action === "remove") Ve(e.done);
			else for (let t of e.done) gt(t, { enabled: e.action === "enabled" });
			k(Bt(b, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? U(Y("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: q(t[0]?.error)
			})) : U("");
		},
		onError: (e) => U(q(e))
	}), Re = Wt({
		mutationFn: pt,
		onSuccess: (e) => {
			J(), e.failed ? U(Y("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: q(e.error)
			})) : U("");
		},
		onError: (e) => U(q(e))
	}), ze = {
		receipt: A,
		failure: (e) => U(q(e))
	}, Ue = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: Y(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => N.find((e) => e.id === t)?.enabled !== e), { done: r } = await Fe.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await ft(r, 4, (t) => Pt(t, !e));
				for (let t of r) gt(t, { enabled: !e });
			};
		},
		receipt: (t) => Y(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), Ke = {
		key: "delete",
		label: Y("follow:shared.delete"),
		reversal: "irreversible",
		danger: !0,
		confirm: (e) => ({
			title: Y("follow:sourceList.deleteManyTitle", { count: e.length }),
			danger: !0,
			body: Y("follow:sourceList.deleteManyBody"),
			confirmLabel: Y("follow:sourceList.deleteSelected")
		}),
		run: async (e) => {
			await Fe.mutateAsync({
				ids: [...e],
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:sourceList.bulkDeleted", { count: e.length })
	}, Je = (e) => {
		let t = [];
		return {
			key: `mark-${e}`,
			label: Y(e === "seen" ? "follow:sourceList.markAllWatched" : "follow:sourceList.ignoreAll"),
			reversal: "undo",
			confirm: ([t]) => e === "seen" ? {
				title: Y("follow:followDetail.markSeen"),
				body: Y("follow:sourceList.markWatchedBody", { count: t })
			} : {
				title: Y("follow:sourceList.markIgnored"),
				body: Y("follow:sourceList.markIgnoredBody", { count: t }),
				recovery: Y("shell:batchFollow.ignoreRecovery")
			},
			run: async () => (t = (await Re.mutateAsync(e)).marked, async () => {
				await Vt(t), await J();
			}),
			receipt: () => Y("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Ye = (e, t) => Me.mutate({
		id: e.id,
		enabled: t
	}), Xe = (0, X.useRef)({
		check: be,
		toggle: Ye,
		remove: Pe,
		busy: !1,
		readOnly: x
	});
	Xe.current = {
		check: be,
		toggle: Ye,
		remove: Pe,
		busy: ge || ve.isPending,
		readOnly: x
	};
	let Ze = Xe.current, Qe = (0, X.useMemo)(() => {
		let e = Le(), t = (e) => () => $n[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(pe, {
					table: e.table,
					label: Y("follow:sourceList.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": Y("follow:shared.selectNamed", { name: e.row.original.source.label })
				})
			}),
			e.accessor((e) => e.author, {
				id: "author",
				header: t("author"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex min-w-0 items-center gap-2",
					children: [/* @__PURE__ */ (0, Z.jsx)(Xt, {
						group: e.row.original.group,
						name: e.row.original.author
					}), /* @__PURE__ */ (0, Z.jsx)("span", {
						className: "min-w-0 break-words",
						children: e.row.original.author
					})]
				})
			}),
			e.accessor((e) => e.source.label, {
				id: "source",
				header: t("source"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex min-w-0 flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, Z.jsx)($t, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Z.jsx)(Zt, { text: Ne(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Z.jsx)(Qt, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(en, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => je(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(le, {
							"aria-label": Y("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: Ze.readOnly,
							onChange: (t) => Xe.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Be,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || Ze.readOnly,
							...K(Ze.busy),
							onClick: () => Xe.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: I,
							"aria-label": Y("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: Ze.readOnly,
							onClick: () => Xe.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [Ze]), et = (0, X.useMemo)(() => {
		let e = Xn[c];
		return e ? [{
			id: e,
			desc: l === "desc"
		}] : [];
	}, [c, l]), tt = (0, X.useMemo)(() => Object.fromEntries([...b].map((e) => [String(e), !0])), [b]), nt = g === "table", rt = Jt("follow-sources", er), it = ht(nt ? ce.length : W.length, v, d), at = qt({
		features: Yn,
		data: ce,
		columns: Qe,
		getRowId: (e) => String(e.source.id),
		state: {
			sorting: et,
			rowSelection: tt,
			pagination: {
				pageIndex: it.page - 1,
				pageSize: v
			},
			columnVisibility: rt.visibility
		},
		onColumnVisibilityChange: rt.change,
		manualSorting: !0,
		enableRowSelection: !0,
		onSortingChange: (e) => {
			let t = (typeof e == "function" ? e(et) : e)[0];
			if (!t) return;
			let n = p[t.id];
			n && C(n, t.desc ? "desc" : "asc");
		},
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(tt) : e;
			k(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		},
		onPaginationChange: (e) => {
			let t = {
				pageIndex: it.page - 1,
				pageSize: v
			}, n = typeof e == "function" ? e(t) : e;
			n.pageSize === v ? n.pageIndex !== t.pageIndex && w(n.pageIndex + 1) : O(n.pageSize);
		}
	}), st = at.getRowModel().rows, ct = nt ? st.map((e) => e.original.source.id) : W.slice(it.start, it.end).flatMap((e) => e.map((e) => e.id)), lt = jt(b, ct), ut = [...b], dt = De(_e), mt = N.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), _t = Ee(_e), vt = W.length > 0 && R.size >= W.length;
	return N.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Te({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				ref: te,
				"data-follow-toolbar": "",
				"data-responsive-toolbar": "",
				children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
					"data-follow-toolbar-heading": "",
					"data-toolbar-heading": "",
					children: [/* @__PURE__ */ (0, Z.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: Y("follow:followManageNav.list")
					}), /* @__PURE__ */ (0, Z.jsx)("span", {
						className: "text-body-2-regular text-text-secondary",
						children: L.new ? Y("follow:sourceList.sourceCountUnseen", {
							count: N.length,
							unseen: Number(L.new) || 0
						}) : Y("follow:sourceList.sourceCount", { count: N.length })
					})]
				}), /* @__PURE__ */ (0, Z.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						mt.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							disabled: x,
							...K(Ze.busy),
							onClick: () => be(mt),
							children: Y("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							leadingIcon: Be,
							disabled: x,
							"aria-label": Y("follow:sourceList.checkAll"),
							iconOnly: ne,
							...K(Ze.busy),
							onClick: () => be([]),
							children: Y("follow:sourceList.checkAll")
						}),
						/* @__PURE__ */ (0, Z.jsxs)("span", {
							"data-follow-toolbar-controls": "",
							className: "contents",
							children: [
								/* @__PURE__ */ (0, Z.jsxs)("span", {
									"data-button-group": !0,
									role: "group",
									"aria-label": Y("follow:sourceList.layout"),
									children: [/* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: G,
										"aria-label": F[0][1],
										"aria-pressed": !nt,
										onClick: () => T("default")
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: He,
										"aria-label": F[1][1],
										"aria-pressed": nt,
										onClick: () => T("table")
									})]
								}),
								nt ? /* @__PURE__ */ (0, Z.jsx)(de, {
									preferences: rt,
									label: Y("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Z.jsx)(ie, {
										"aria-label": Y("follow:sourceList.sortLabel"),
										prefix: Y("follow:shared.sort"),
										selectedKey: c,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											C(t, V[t]);
										},
										children: re.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(ae, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: se,
										"data-icon-state": l === "asc" ? "a" : "b",
										"aria-label": Ft(c, l),
										onClick: () => C(c, l === "asc" ? "desc" : "asc")
									})]
								}),
								nt ? null : /* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "secondary",
									iconOnly: ne,
									leadingIcon: _,
									"aria-expanded": !vt,
									"aria-label": Y(vt ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => z(vt ? /* @__PURE__ */ new Set() : new Set(W.map((e) => String(e[0].author_key || e[0].id)))),
									children: Y(vt ? "follow:shared.expandAll" : "follow:shared.collapseAll")
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [
					ge ? /* @__PURE__ */ (0, Z.jsx)(he, {
						embedded: !0,
						kind: me?.older ? ye("feed-scrape") : ye("follow-check"),
						label: ot(me) || (me?.total ? Y(me.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: me.checked || 0,
							count: me.total
						}) : Y("follow:sourceList.preparingCheck")),
						value: me?.checked,
						total: me?.total
					}) : null,
					H ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "error",
						title: Y("follow:shared.actionFailed"),
						children: H
					}) : null,
					!ge && _e?.results?.length ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "neutral",
						title: Y("follow:followFeed.checkResults"),
						children: Ae(_e)
					}) : null,
					dt.length ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "error",
						title: Y("follow:sourceList.failedTitle", { count: dt.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: dt.map((e, t) => /* @__PURE__ */ (0, Z.jsx)("li", { children: Y("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: We(e.error || "") || Y("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: Y("follow:sourceList.failedBody")
					}) : null,
					_t ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "warning",
						children: Y("follow:sourceList.evidenceGap", { error: _t })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(oe, {
				label: Y("follow:sourceList.bulkActions"),
				visible: ut.length > 0,
				count: Y("follow:sourceList.selectedCount", { count: ut.length }),
				actions: [
					Ue(!0),
					Ue(!1),
					Ke
				].map((e) => ({
					action: e,
					items: ut,
					host: ze,
					disabled: x || Fe.isPending
				})),
				leading: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: x,
					...K(Ze.busy),
					onClick: () => be(ut),
					children: Y("follow:sourceList.checkSelected")
				}),
				children: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: Ge,
					children: Y("follow:shared.clearSelection")
				})
			}),
			nt ? /* @__PURE__ */ (0, Z.jsx)(ee, {
				follow: !0,
				preferences: rt,
				onRowClick: (e) => xe(Number(e), !b.has(Number(e))),
				children: /* @__PURE__ */ (0, Z.jsxs)(ue, {
					"aria-label": Y("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: et[0] ? {
						column: et[0].id,
						direction: et[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => at.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [at.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = $e(e.column.columnDef.header, e.getContext());
						return /* @__PURE__ */ (0, Z.jsx)(r, {
							id: e.id,
							allowsSorting: t,
							isRowHeader: e.column.id === "source",
							...rt.columnProps(e.id),
							children: ({ sortDirection: r }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [e.id === "select" ? n : t ? /* @__PURE__ */ (0, Z.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [n, /* @__PURE__ */ (0, Z.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": r || void 0,
									children: /* @__PURE__ */ (0, Z.jsx)(h, {})
								})]
							}) : /* @__PURE__ */ (0, Z.jsx)(s, { children: n }), /* @__PURE__ */ (0, Z.jsx)(fe, {
								preferences: rt,
								id: e.id
							})] })
						}, e.id);
					}), /* @__PURE__ */ (0, Z.jsx)(r, {
						id: "remaining-space",
						"aria-label": Y("follow:shared.rowSpacer"),
						"data-table-space": "",
						width: rt.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
						renderEmptyState: () => Y("follow:sourceList.pageEmpty"),
						children: st.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: $e(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(m, {
				isSelected: lt.all,
				isIndeterminate: lt.some,
				onChange: (e) => we(ct, e),
				"aria-label": Y("follow:sourceList.selectPage"),
				children: Y("follow:sourceList.selectPageShort")
			}), /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex flex-col gap-3",
				children: W.slice(it.start, it.end).map((e) => {
					let t = String(e[0].author_key || e[0].id);
					return /* @__PURE__ */ (0, Z.jsx)(nr, {
						group: e,
						name: Ce(e, P),
						handlers: Ze,
						selected: b,
						open: !R.has(t),
						onOpen: (e) => {
							let n = new Set(R);
							e ? n.delete(t) : n.add(t), z(n);
						},
						onToggleGroup: (t) => we(e.map((e) => e.id), t),
						onToggle: xe
					}, t);
				})
			})] }),
			/* @__PURE__ */ (0, Z.jsx)(y, {
				label: Y("follow:followManageNav.list"),
				total: it.total,
				pagination: {
					pageIndex: it.page - 1,
					pageSize: v
				},
				unit: Y(nt ? "follow:followOverview.sourceUnit" : "follow:sourceList.creatorUnit"),
				pageUnit: Y(nt ? "follow:followOverview.itemUnit" : "follow:followOverview.creatorUnit"),
				onChange: (e) => {
					e.pageSize === v ? at.setPageIndex(e.pageIndex) : at.setPageSize(e.pageSize);
				}
			}),
			L.new ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:sourceList.markSummary", {
							unwatched: Number(L.new) || 0,
							watched: Number(L.seen) || 0,
							saved: Number(L.saved) || 0,
							ignored: Number(L.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: j,
						children: Y("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = Je(e);
						return /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: x,
							...K(Re.isPending),
							onClick: () => void At(t, [Number(L.new) || 0], ze).catch(ze.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Z.jsx)(S, {
		icon: f,
		title: Y("follow:sourceList.empty"),
		actions: /* @__PURE__ */ (0, Z.jsx)(u, {
			variant: "primary",
			size: "small",
			onClick: M,
			children: Y("follow:followFeed.addFollow")
		}),
		children: Y("follow:sourceList.emptyHint")
	});
}
// node_modules/skullet/dist/index.mjs
var ir = "skullet-reveal", ar = "skullet-pane", or = "skullet-loading", sr = "skullet-ghost", cr = "skullet-snapshot", lr = "skullet-layer", ur = "skullet-rect", dr = "skullet-bar", fr = "skullet-inactive", pr = "skullet-exiting", mr = "skullet-covered", hr = "skullet-own", gr = "skullet-block", _r = Symbol.for("skullet.ghost"), vr = Symbol.for("skullet.uncover"), yr = "skullet-status", br = "skullet-xray", xr = "var(--skullet-base, rgb(128 128 128 / 0.2))", Sr = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", Cr = 280, wr = 1e4, Tr = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, Er = [
	"a",
	"b",
	"code",
	"dd",
	"dt",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"i",
	"label",
	"li",
	"p",
	"small",
	"span",
	"strong",
	"td",
	"th",
	"time"
], Dr = [
	"audio",
	"canvas",
	"embed",
	"iframe",
	"img",
	"input",
	"object",
	"picture",
	"select",
	"svg",
	"textarea",
	"video"
], Or = Dr.join(", "), kr = `
[${ir}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${ar}] {
  display: block;
}

[${or}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${fr}] {
  display: none !important;
}

[${lr}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${dr}] {
  display: block;
  background-color: ${xr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${or}]) to ([${hr}], [${lr}]) {
  :scope,
  :scope * {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important;
    text-decoration-color: transparent !important;
  }

  :scope ::placeholder {
    color: transparent !important;
  }

  /* A line to measure in empty text; content only, never a size, or a dot-sized span would grow round it */
  :scope :is(${Er.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${Or}, [${mr}], [${gr}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${xr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${Or}, [${gr}]):not(svg *) {
      visibility: visible !important;
      background: ${xr} !important;
    }

    :scope svg * {
      fill: transparent !important;
      stroke: transparent !important;
    }

    :scope :is(img, video) {
      object-position: -100vw 0;
    }
  }
}

/* Read by screen readers in the skeleton's place, never seen */
[${yr}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${br}] [${or}] [${sr}],
[${br}] [${or}] [${sr}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Ar = null, jr = 0, Mr;
function Nr() {
	jr++, !Ar && (Mr ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !Mr && (Ar = document.createElement("style"), Ar.dataset.skullet = "true", Ar.textContent = kr, document.head.appendChild(Ar)));
}
function Pr() {
	jr--, !(jr > 0 || !Ar) && (Ar.remove(), Ar = null);
}
var Fr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", Ir = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...Ir });
function Lr(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? Ir[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var Rr = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function zr({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = Lr(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${Rr(o)} }`), a === "system") {
		let t = Lr({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${Rr(t)} } }`);
	}
	return s.join("\n");
}
var Br = /* @__PURE__ */ new Map(), Vr, Q = null, Hr = 0;
function Ur() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var Wr = () => Vr ??= typeof window < "u" && Ur(), Gr = (e) => Wr() || !!e?.closest("[skullet-debug]");
function Kr(e) {
	Vr = e, e ? Zr() : Qr();
}
function qr(e, t) {
	!e || !Gr(e) || (Br.set(e, {
		state: "loading",
		source: t
	}), Yr());
}
function Jr(e, t) {
	!e || !Gr(e) || (Br.set(e, {
		...Br.get(e),
		state: "shown",
		moved: t
	}), Yr());
}
function Yr() {
	Zr(), cancelAnimationFrame(Hr), ei();
}
var Xr = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function Zr() {
	if (typeof document > "u") return;
	if (!Q?.isConnected) {
		Q = document.createElement("div"), Q.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = Q.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${Xr}</style><div class="boxes"></div>`, document.body.append(Q);
	}
	let e = Q.shadowRoot;
	if (Vr && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(br, e.target.checked);
		}), e.append(t);
	}
	Hr ||= requestAnimationFrame(ei);
}
function Qr() {
	Q?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(br), ![...Br.keys()].some((e) => Gr(e)) && (cancelAnimationFrame(Hr), Hr = 0, Q?.remove(), Q = null);
}
var $r = ({ state: e, source: t, moved: n }) => {
	let r = t ? ` \xB7 ${t}` : "";
	return e === "loading" ? {
		kind: "loading",
		text: `skeleton${r}`
	} : !n || n.width === 0 && n.height === 0 ? {
		kind: "still",
		text: `\u2713 no movement${r}`
	} : {
		kind: "moved",
		text: `\u2717 moved ${n.width}\xD7${n.height}px${r}`
	};
};
function ei() {
	if (Hr = 0, !Q?.shadowRoot) return;
	let e = Q.shadowRoot.querySelector(".boxes");
	for (let e of Br.keys()) e.isConnected && Gr(e) || Br.delete(e);
	let t = [...Br];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = $r(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), (Vr || Br.size) && (Hr = requestAnimationFrame(ei));
}
var ti, ni = () => ti ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), ri = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, ii = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], ai = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function oi(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function si(e, t, n) {
	let r = ri(e, t), i = oi(n, t), a = e ? ii(e) : [], o = ii(t), s = ii(r).map((t, n) => ai(t, o[n]) ? i[n] : e && ai(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function ci(e, t, n, r) {
	if (!e) return n;
	let i = ii(e), a = ii(t).map((t, n) => e.corners[n] > 0 && ai(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = oi(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var li = (e, t) => {
	let n = ri(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, ui = {
	top: "ascender",
	bottom: "descender"
}, di = /* @__PURE__ */ new Map(), fi = (e) => [...e.getClientRects?.() ?? []];
function pi(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (di.has(t)) return di.get(t);
	let n = ni(), r = null;
	if (n) {
		n.font = t;
		let e = n.measureText("H"), i = (e) => n.measureText(e).actualBoundingBoxAscent;
		r = {
			ascent: e.fontBoundingBoxAscent,
			descent: e.fontBoundingBoxDescent,
			ascender: i("bdfhkl"),
			capHeight: e.actualBoundingBoxAscent,
			xHeight: i("xz"),
			descender: n.measureText("gjpqy").actualBoundingBoxDescent
		};
	}
	return di.set(t, r), r;
}
var mi = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, hi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function gi(e, t, n) {
	let r = pi(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = hi(t, "--skullet-text-top", Object.keys(mi), ui.top), a = hi(t, "--skullet-text-bottom", ["baseline", "descender"], ui.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[mi[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var _i = new Set(Dr), vi = new Set(Er), yi = .4, bi = /[,/]\s*0\)$/, xi = (e, t) => e !== "" && e !== t, Si = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], Ci = (e) => Si.every((t) => xi(e[`border${t}Style`], "none") && xi(e[`border${t}Width`], "0px")), wi = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, Ti = (e) => xi(e, "none") && !e.split(/,(?![^(]*\))/).every(wi), Ei = (e) => xi(e.backgroundColor, "transparent") && !bi.test(e.backgroundColor) || xi(e.backgroundImage, "none") || Ti(e.boxShadow) || Ci(e), Di = (e) => _i.has(e.localName), Oi = (e) => vi.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), ki = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(fi(n).filter((e) => e.width || e.height));
		} else Oi(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * yi, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, Ai = (e, t) => e.hasAttribute("skullet-block") || Di(e) || Ei(t) && ki(e) <= 1;
function ji(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function Mi(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * yi;
		});
		e ? (e.left = Math.min(e.left, n.left), e.right = Math.max(e.right, n.right), e.top = Math.min(e.top, n.top), e.bottom = Math.max(e.bottom, n.bottom), e.fontSize = Math.max(e.fontSize, n.fontSize), e.barTop = Math.min(e.barTop, n.barTop), e.barBottom = Math.max(e.barBottom, n.barBottom)) : t.push({ ...n });
	}
	return t.map((e) => {
		let t = e.barBottom - e.barTop;
		return {
			x: e.left,
			y: e.barTop,
			width: e.right - e.left,
			height: t,
			radius: e.radius || `${Math.round(t / 3)}px`
		};
	});
}
function Ni(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = li(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...gi(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of fi(d)) f(e, r, t);
	}, m = (e, t) => {
		for (let n of e.childNodes) {
			if (n.nodeType === Node.TEXT_NODE) {
				p(n, t);
				continue;
			}
			if (n.nodeType !== Node.ELEMENT_NODE) continue;
			let e = n;
			if (e.hasAttribute("skullet-ignore") || e.hasAttribute("skullet-own")) continue;
			let r = getComputedStyle(e);
			if (r.display === "none") continue;
			if (Ai(e, r)) {
				let n = li(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: ci(t, n, ji(e, r), r)
					});
				}
				Di(e) || u.add(e);
				continue;
			}
			if (Oi(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? si(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...Mi(l)];
	for (let t of e.querySelectorAll(`[${mr}]`)) u.has(t) || t.removeAttribute(mr);
	for (let e of u) e.hasAttribute(mr) || e.setAttribute(mr, "");
	return [...c, ...Mi(l)];
}
var Pi = (e) => typeof matchMedia < "u" && matchMedia(e).matches, Fi = () => typeof Element < "u" && typeof Element.prototype.animate == "function", Ii = () => !Fi() || Pi("(prefers-reduced-motion: reduce)"), Li = () => Pi("(prefers-reduced-transparency: reduce)"), Ri = (e) => e.getAnimations?.() ?? [], zi = .7, Bi = 1280, Vi = 320, Hi = 2.5, Ui = .45, Wi = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function Gi(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", Wi, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Tr[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var Ki = 20, qi = Math.sin(Ki * Math.PI / 180), Ji = Math.cos(Ki * Math.PI / 180), Yi = qi / Ji, Xi = Ji, Zi = `${90 + Ki}deg`, Qi = .85, $ = 12, $i = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function ea(e) {
	let t = e * Hi, n = (t, n) => `color-mix(in srgb, ${Sr} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * Qi, $i(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(Qi + e / $ * (1 - Qi), $i(1 - e / $)));
	return {
		width: t / Ji,
		image: `repeating-linear-gradient(${Zi}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function ta(e, t, n = Gi(e)) {
	for (let t of Ri(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", Ii() || typeof e.animate != "function" || n.animation === "none") return;
	let r = {
		duration: n.duration,
		iterations: 1 / 0
	};
	if (n.animation === "pulse") {
		e.animate([
			{
				opacity: 1,
				easing: "ease-in-out"
			},
			{
				opacity: Ui,
				easing: "ease-in-out"
			},
			{ opacity: 1 }
		], r).startTime = 0;
		return;
	}
	let i = e.getBoundingClientRect(), a = i.left + scrollX, o = n.animation === "group-shimmer" ? t ?? {
		left: a,
		top: i.top,
		width: i.width,
		height: i.height
	} : {
		left: 0,
		top: 0,
		width: document.documentElement.clientWidth || innerWidth
	}, { width: s, image: c } = ea(Math.min(Math.max(o.width * .4, 80), Vi)), l = a - o.left + (i.top - o.top) * Yi, u = n.duration * zi / (Bi + Vi);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function na(e) {
	if (Ii()) return null;
	let t = Gi(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * zi / (Bi + Vi);
}
var ra = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), ia = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function aa(e, t) {
	let n = ra(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = Gi(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${xr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, ta(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var oa = 120, sa = 72, ca = 3, la = 60, ua = 150, da = 400, fa = 1.5, pa = 1e3, ma = 1e3, ha = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), ga = -1 / 0, _a = !1;
function va() {
	if (!(_a || typeof addEventListener > "u")) {
		_a = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => ga = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var ya = /* @__PURE__ */ new WeakMap();
function ba(e, { served: t, refetch: n }) {
	va();
	let r = ya.get(e)?.since ?? performance.now();
	ya.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function xa(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function Sa(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var Ca = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function wa(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${pr}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var Ta = (e, t) => Math.min(Math.max(e, 0), t), Ea = -1 / 0;
function Da(e, t, n, r, i) {
	let a = performance.now();
	a - Ea > ua && (Ea = a);
	let o = a - Ea, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of xa(e)) {
		let n = Sa(t, e), r = c.get(n);
		r || (r = {
			rect: n.getBoundingClientRect(),
			size: 0
		}, c.set(n, r));
		let i = u(t);
		r.size = Math.max(r.size, i), l.set(t, {
			unit: r,
			size: i
		});
	}
	let d = (e) => {
		let t = n(e);
		return t === null ? null : Ta(t, pa) + Math.max(r.delay ?? 0, 0);
	};
	return {
		kind: "sequence",
		duration: i,
		enter: r.enter,
		pieceDelay: (e) => {
			let t = l.get(e);
			return t ? d({
				rect: e.getBoundingClientRect(),
				unit: t.unit.rect,
				secondary: t.size < t.unit.size,
				reveal: s,
				late: o
			}) : null;
		},
		boneDelay: (e) => {
			let t = [...c.values()].find((t) => Ca(t.rect, e));
			return d({
				rect: e,
				unit: t?.rect ?? null,
				secondary: !!t && e.height < t.size * .8,
				reveal: s,
				late: o
			});
		}
	};
}
function Oa(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) ha.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function ka(e, t, n, r = () => {}) {
	let i = ya.get(t);
	ya.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - ga < da,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: xa(e).length
			})
		};
	}
	let o = Ta(a.duration ?? 200, ma);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, pa)
	}, !o) return { kind: "instant" };
	let s = Oa(a.enter, r);
	if (a.wipe) {
		let e = wa(t);
		if (e.width * e.height <= innerWidth * innerHeight * fa) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return Da(e, t, a.order, {
		...a,
		enter: s
	}, o);
	return {
		kind: "together",
		delay: Math.max(a.delay ?? 0, 0),
		duration: o,
		enter: s
	};
}
var Aa = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return Ta(n * .8 + r * .2, 1) * 320;
}, ja = (e) => e.bottom > 0 && e.top < innerHeight, Ma = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return ja(e) ? 0 : null;
	if (!ja(t)) return null;
	let i = Ta(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? la : 0);
}, Na = { duration: 0 }, Pa = { order: "together" }, Fa = { order: Aa }, Ia = (e) => e.input || e.waited < 150 ? Na : e.refetch ? {
	order: "together",
	duration: oa
} : null, La = (e) => e.height < sa || e.pieces <= ca ? Pa : { order: Ma }, Ra = {
	hold: 150,
	choose: (e) => Ia(e) ?? La(e)
}, za = new Set(Dr), Ba = "script, noscript, template, base, meta, link", Va = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), Ha = /* @__PURE__ */ new Set([
	"src",
	"srcset",
	"sizes",
	"poster",
	"data",
	"srcdoc",
	"action",
	"formaction",
	"value",
	"alt",
	mr
]), Ua = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function Wa(e, t) {
	let n = Ua(t.data);
	t.data = n;
	let r = e.parentElement, i = ni();
	if (!r || !i || !n.trim()) return;
	let a = getComputedStyle(r);
	i.font = `${a.fontStyle} ${a.fontWeight} ${a.fontSize} ${a.fontFamily}`;
	let o = (e) => {
		let t = e.replace(/\s+/g, " ");
		return a.textTransform === "uppercase" ? t.toUpperCase() : a.textTransform === "lowercase" ? t.toLowerCase() : t;
	}, s = (i.measureText(o(e.data)).width - i.measureText(o(n)).width) / o(n).length;
	if (Math.abs(s) < .01) return;
	let c = document.createElement("span");
	c.style.letterSpacing = `${(parseFloat(a.letterSpacing) || 0) + s}px`, t.replaceWith(c), c.append(t);
}
function Ga(e) {
	for (let t of e.querySelectorAll(Ba)) t.remove();
	for (let t of e.querySelectorAll("*")) if (Va.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || Ha.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function Ka(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (za.has(e.localName) || Va.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) Wa(e, t);
	return Ga(n), n.innerHTML;
}
function qa(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, Ga(t.content), t.content;
}
var Ja = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${Ja(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), Ya = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function Xa(e) {
	let t = Ja(e, 2);
	return t ? `${location.pathname}|${Ya(t)}` : null;
}
var Za = !1;
try {
	Za = !1;
} catch {
	Za = !1;
}
var Qa = Za, $a = /* @__PURE__ */ new Set();
function eo(e, t) {
	!Qa || $a.has(e) || ($a.add(e), console.warn(`[skullet] ${t}`));
}
var to = /^(https?:|\/|data:|blob:)/;
function no(e) {
	return typeof e == "string" ? to.test(e) ? "" : Ua(e) : Array.isArray(e) ? e.map(no) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, no(t)])) : e;
}
var ro = "skullet:shapes", io = 2, ao = 50, oo = 2e4, so = /* @__PURE__ */ new Map(), co = /* @__PURE__ */ new Map();
function lo(e, t) {
	return co.has(e) || co.set(e, /* @__PURE__ */ new Set()), co.get(e).add(t), () => co.get(e)?.delete(t);
}
function uo(e) {
	for (let t of co.get(e) ?? []) t();
}
function fo() {
	try {
		let e = JSON.parse(localStorage.getItem(ro) ?? "null");
		return e?.v === io ? e.shapes : {};
	} catch {
		return {};
	}
}
function po(e) {
	try {
		localStorage.setItem(ro, JSON.stringify({
			v: io,
			shapes: e
		}));
	} catch {}
}
function mo(e, t) {
	so.set(e, Ka(t, !1));
	let n = Ka(t, !0);
	if (n.length > oo) return;
	let r = fo();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - ao)) delete r[e];
	po(r);
}
function ho(e) {
	return so.get(e) ?? fo()[e] ?? null;
}
var go = [
	100,
	90,
	60
].map((e) => `<div ${gr} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), _o = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${or}]`)), vo = /* @__PURE__ */ new WeakMap();
function yo(e) {
	if (!e) return;
	let t = vo.get(e);
	return vo.delete(e), t;
}
function bo(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var xo = (e) => !!e.firstElementChild || !!e.textContent?.trim(), So = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, Nr(), e[_r] = !0, e.setAttribute(or, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = bo(e, sr), this.snapshot = bo(e, cr), this.layer = bo(e, lr), this.hadContent = xo(this.ghost);
		let n = e.closest(`[${ir}]`);
		n && ba(n, {
			served: _o.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[vr]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
			childList: !0,
			subtree: !0,
			characterData: !0,
			attributes: !0
		}), this.resize = typeof ResizeObserver > "u" ? null : new ResizeObserver(this.schedule), this.resize?.observe(e), e.addEventListener("load", this.schedule, !0), addEventListener("resize", this.schedule), document.fonts?.ready.then(this.schedule);
	}
	root;
	options;
	ghost;
	snapshot;
	layer;
	source = null;
	hadContent = !1;
	frame = 0;
	mutations;
	resize;
	schedule = () => {
		this.root.closest(`[${pr}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = xo(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || _o.has(this.root), r = !!this.ghost.querySelector(`[${hr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? Xa(this.ghost);
			n && (uo(n), t = ho(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(qa(t)) : e === "fallback" ? (this.snapshot.innerHTML = go, eo(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(fr, e !== "ghost"), this.snapshot.toggleAttribute(fr, e === "ghost"), this.source = e, qr(this.root.closest(`[${ir}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : _o.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		aa(this.layer, Ni(e, this.layer));
		let t = this.root.closest(`[${ir}]`);
		t && vo.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), Pr();
	}
}, Co = 250, wo = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? Xa(e), this.untrack = this.key ? lo(this.key, () => this.save()) : () => {}, (Qa || Gr(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
			childList: !0,
			subtree: !0,
			characterData: !0
		}), this.resize = typeof ResizeObserver > "u" ? null : new ResizeObserver(this.schedule), this.resize?.observe(e), e.addEventListener("load", this.schedule, !0);
	}
	element;
	options;
	key;
	timer;
	mutations;
	resize;
	untrack;
	schedule = () => {
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), Co);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && mo(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${ir}]`), o = yo(a);
		if (!o) return;
		o.guessed && n && !r && e != null && eo(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify(no(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (Jr(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? eo(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : eo(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, To = () => {}, Eo = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, Do = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !Eo(e));
function Oo(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(To, To), new Promise((e) => setTimeout(e, wr))]);
}
var ko = 360, Ao = 2, jo = 600, Mo = 40, No = Mo / Xi, Po = 320, Fo = 120, Io = .45, Lo = (e) => e.left + e.top * Yi, Ro = (e) => e.width + e.height * Yi, zo = (e, t) => Lo(t) - No + (Ro(t) + 2 * No) * e, Bo = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function Vo(e) {
	let t = e.querySelector(`:scope > [${pr}] [${lr}]`), n = t && na(t);
	if (!n) return null;
	let r = wa(e);
	if (r.width * r.height > innerWidth * innerHeight * fa) return null;
	let i = Lo(r), a = i + Ro(r), o = performance.now(), s = o - Bo.start;
	s <= ua && (i - Bo.origin) / Bo.speed >= s && (a - Bo.origin) / Bo.speed - s <= jo || (Bo = {
		start: o,
		origin: i,
		speed: Math.max(Ao / n, (a - i) / ko)
	});
	let { start: c, origin: l, speed: u } = Bo;
	return {
		delay: (i - No - l) / u - (o - c),
		duration: (a - i + 2 * No) / u
	};
}
var Ho = (e) => (t, { rect: n, reveal: r }) => {
	let i = (zo(t, r) - Lo(n)) * Xi;
	return `linear-gradient(${Zi}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - $i(n / $) : $i(n / $), a = -Mo + 2 * Mo * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, Uo = "http://www.w3.org/2000/svg", Wo = null, Go = 0;
function Ko() {
	return Wo?.isConnected || (Wo = document.createElementNS(Uo, "svg"), Wo.setAttribute("aria-hidden", "true"), Wo.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(Wo)), Wo;
}
var qo = (e, t) => {
	let n = document.createElementNS(Uo, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, Jo = {
	mask: Ho(!0),
	out: Ho(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (Li()) return;
		let i = Lo(t), a = Ro(t), o = Po / 2 / Xi, s = () => zo(r(), n) - i - Fo / Xi;
		if (s() - o > a) return;
		let c = 2 * o + t.height * Yi, l = c / 2, u = t.height / 2, d = Po / 2 * Xi, f = Po / 2 * Yi * Xi, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${$i(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++Go}`, _ = qo("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = qo("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(qo(`feFunc${e}`, {
			type: "linear",
			slope: 1 - Io,
			intercept: Io
		}));
		let y = qo("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, qo("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), qo("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), Ko().append(_), e.style.filter = `url(#${g})`;
		let ee = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * Yi) / t.width).toFixed(4)), requestAnimationFrame(ee));
		};
		ee();
	}
}, Yo = {
	together: Pa,
	sequence: Fa,
	smart: Ra,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = Ia(e);
			if (t) return t;
			let n = Vo(e.reveal);
			return n ? {
				wipe: Jo,
				...n
			} : La(e);
		}
	}
}, Xo = (e = "smart") => typeof e == "string" ? Yo[e] : e, Zo = () => {}, Qo = (e) => e.finished.then(Zo, Zo), $o = /* @__PURE__ */ new WeakMap();
function es(e, t = 0, n = 200, r = 0, i) {
	return Ii() ? Promise.resolve() : Qo(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var ts = (e) => !!e.querySelector(`[${lr}], [${sr}], :scope > [${hr}]`), ns = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, rs = /* @__PURE__ */ new WeakMap();
function is(e) {
	for (let t of rs.get(e) ?? []) t.remove();
	rs.delete(e);
}
function as(e, t) {
	let n = Do(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && ts(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${pr}] [${lr}]`)].flatMap(ia), a = rs.get(t) ?? /* @__PURE__ */ new Set();
			rs.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => ns(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(ur, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: xr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), ta(c), Oo(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", es(e), Ii()) return c.remove();
						Qo(c.animate([{ opacity: 1 }, { opacity: 0 }], {
							duration: 200,
							easing: "ease",
							fill: "forwards"
						})).then(() => c.remove());
					}
				});
			}
		});
	}
}
function os(e, t) {
	return Ii() ? Promise.resolve() : Promise.all(xa(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return es(e, n, t.duration, 0, t.enter);
	})).then(Zo);
}
function ss(e) {
	for (let t of e.querySelectorAll(`:scope > [${pr}]`)) {
		for (let e of Ri(t)) e.finish();
		t.style.opacity = "0";
	}
}
function cs(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${pr}]`)) if (!ts(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of Ri(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function ls(e, t = "smart", { initial: n = !1 } = {}) {
	let r = us.get(e);
	return r || (r = ds(e, t, n), us.set(e, r)), r;
}
var us = /* @__PURE__ */ new WeakMap();
function ds(e, t, n) {
	let r = e.parentElement, i = Xo(t);
	if (ts(e)) {
		r && is(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && $o.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : es(e, t)) : (r && $o.delete(r), n ? Promise.resolve() : es(e));
	}
	if (n || !r) return Promise.resolve();
	let a = cs(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return $o.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), es(e, 0, t, a);
	}
	as(e, r);
	let o = ka(e, r, i, (e) => eo(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return $o.set(r, o), o.kind === "instant" ? (ss(r), Promise.resolve()) : o.kind === "sequence" ? os(e, o) : o.kind === "wipe" ? ws(e, o, !0) : es(e, o.delay, o.duration, 0, o.enter);
}
function fs(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function ps(e, t = fs(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(pr, ""), t;
}
var ms = /* @__PURE__ */ new WeakMap();
function hs(e, t) {
	let n = e.querySelector(`:scope > [${ar}]:not([${pr}])`);
	if (!n) return;
	let r = ms.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && gs(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: Cr,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	ms.set(e, u), Qo(l).then(() => {
		ms.get(e) === u && gs(e, u);
	});
}
function gs(e, { overflow: t, boxSizing: n }) {
	ms.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function _s(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of Ri(e)) t.cancel();
	Cs(e), e.style.filter = "";
	let i = e.parentElement;
	i && !ts(e) && is(i);
	let a = ps(e, t), o = (t, n) => Fi() ? Qo(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && $o.get(i), n = Ii() || t?.kind === "instant";
		if (i && !n && hs(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && ts(e) ? vs(e, t) : t?.kind === "wipe" && ts(e) ? ws(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function vs(e, t) {
	for (let t of e.querySelectorAll(`[${sr}], [${cr}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${sr}] [${hr}]`)].filter((e) => !e.parentElement?.closest(`[${hr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${lr}]`)].flatMap(ia), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => Qo(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(Zo);
}
var ys = 100, bs = /* @__PURE__ */ new WeakMap();
function xs(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function Ss(e, t) {
	xs(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function Cs(e) {
	bs.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function ws(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? xs(e, i(t, r)) : a ? xs(e, a(t, r)) : Ss(e, i(t, r));
	}, s = () => (performance.now() - t.start) / t.duration;
	return s() >= 1 ? (n || (e.style.opacity = "0"), Promise.resolve()) : (n && (t.wipe.effect?.(e, {
		...r,
		progress: s
	}), t.enter && e.animate([t.enter, {}], {
		duration: t.duration,
		delay: Math.max(t.start - performance.now(), 0),
		easing: "ease",
		fill: "backwards"
	})), new Promise((n) => {
		let r = 0, i = performance.now(), a = 0, c = () => {
			let e = performance.now();
			if (e - i > ys && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), bs.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + ys);
		bs.set(e, l), c();
	}).then((t) => {
		if (Cs(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? es(e, 0, r, t) : Qo(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var Ts = X.createContext({}), Es = X.createContext(null), Ds = () => X.useContext(Ts), Os = () => X.useContext(Es), ks = () => Ds().reveal;
function As({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = zr({
		theme: r,
		mode: i,
		text: a
	}), [c] = X.useState(() => ({ sent: !1 }));
	return X.useEffect(() => {
		n !== void 0 && Kr(n);
	}, [n]), (0, Z.jsx)(Ts.Provider, {
		value: t,
		children: (0, Z.jsxs)(Es.Provider, {
			value: c,
			children: [s && (0, Z.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var js = typeof window > "u" ? X.useEffect : X.useLayoutEffect, Ms = () => X.useInsertionEffect(() => (Nr(), Pr), []), Ns = Number("19.3.1".split(".")[0]) >= 19, Ps = () => {
	let { nonce: e } = Ds();
	return Ns ? (0, Z.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: kr
	}) : null;
}, Fs = Ns ? { inert: !0 } : { inert: "" }, Is = (e) => X.Children.map(e, (e) => {
	if (!X.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Z.jsx)("span", {
		[hr]: "",
		children: (0, Z.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? X.cloneElement(e, void 0, Is(e.props.children)) : e;
}), Ls = () => () => {}, Rs = () => X.useSyncExternalStore(Ls, () => !1, () => !0), zs = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = X.useRef(null), { nonce: o } = Ds(), s = Os(), c = Rs(), l = Fr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), js(() => {
		if (!a.current) return;
		let e = new So(a.current, {
			id: t,
			exact: n,
			refetch: r
		});
		return () => e.destroy();
	}, [
		t,
		n,
		r
	]), (0, Z.jsxs)(Z.Fragment, { children: [
		i && (0, Z.jsx)("span", {
			"skullet-status": "",
			children: i
		}),
		(0, Z.jsxs)("div", {
			ref: a,
			[or]: "",
			"aria-hidden": !0,
			...Fs,
			children: [
				(0, Z.jsx)("div", {
					[sr]: "",
					children: Is(e)
				}),
				(0, Z.jsx)("div", { [cr]: "" }),
				(0, Z.jsx)("div", { [lr]: "" })
			]
		}),
		c && (0, Z.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, Bs = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = X.useRef(null), l = ks();
	return js(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), ls(c.current, l, { initial: !r }).then(s), o && (e.memory = new wo(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), js(() => {
		!i || !c.current || _s(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Z.jsx)("div", {
		ref: c,
		[ar]: "",
		children: e
	});
}, Vs = class extends X.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = fs(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function Hs(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	Ms();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = X.useRef(null);
	js(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Z.jsx)("div", {
			[hr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Z.jsx)(zs, {
			id: t,
			exact: i != null,
			refetch: u != null,
			label: n,
			children: m(i ?? d)
		});
	} else o ? (g = "error", _ = o) : i ? (g = "empty", _ = a ?? m(u)) : (g = "content", _ = m(u), v = {
		id: t,
		data: u,
		rendered: !!l,
		sample: d !== void 0
	});
	let [y, ee] = X.useState({
		id: 0,
		key: g
	}), [b, x] = X.useState([]), S = X.useRef(/* @__PURE__ */ new Map()).current, C = X.useRef(_);
	if (js(() => {
		C.current = _;
	}), y.key !== g) {
		let e = {
			id: y.id,
			node: C.current
		};
		x((t) => t.some((t) => t.id === e.id) ? t : [...t, e]), ee({
			id: y.id + 1,
			key: g,
			from: y.key
		});
	}
	let w = X.useRef(e.onReveal);
	js(() => {
		w.current = e.onReveal;
	});
	let T = y.key === "content" && y.from === "skeleton" ? () => w.current?.() : void 0, E = (e) => x((t) => t.filter((t) => t.id !== e)), D = [...b.map((e) => (0, Z.jsx)(Bs, {
		id: e.id,
		registry: S,
		enter: !1,
		exiting: !0,
		onExited: () => E(e.id),
		children: e.node
	}, e.id)), (0, Z.jsx)(Bs, {
		id: y.id,
		registry: S,
		enter: y.id > 0,
		exiting: !1,
		onExited: () => {},
		memory: v,
		onEntered: T,
		children: _
	}, y.id)];
	return (0, Z.jsxs)("div", {
		[ir]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Z.jsx)(Ps, {}), (0, Z.jsx)(Vs, {
			exiting: b.map((e) => e.id),
			registry: S,
			children: D
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var Us = {
	creators: [Y("follow:followOverview.creators"), Y("follow:followOverview.creatorUnit")],
	enabled: [Y("follow:followOverview.enabledSources"), ""],
	failed: [Y("follow:followCheck.checkFailed"), Y("follow:followOverview.sourceUnit")],
	updates: [Y("follow:followOverview.unwatchedUpdates"), Y("follow:followOverview.itemUnit")],
	subscriptions: [Y("follow:feedSources.footerLabel"), Y("follow:followOverview.actressUnit")],
	releases: [Y("follow:followOverview.unwatchedReleases"), Y("follow:followOverview.itemUnit")]
}, Ws = {
	duration: 0,
	delay: 0,
	hold: 150
}, Gs;
function Ks() {
	return Gs || (Gs = new CSSStyleSheet(), Gs.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), Gs;
}
function qs({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Z.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Z.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function Js({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = Us[e], o = (0, X.useRef)(null);
	return (0, X.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = Ks();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Z.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: Te({
			padding: "none",
			className: "flex flex-col gap-3 px-6 py-5 max-sm:gap-2 max-sm:p-4"
		}),
		children: [/* @__PURE__ */ (0, Z.jsx)("span", {
			className: "text-body-medium text-text-secondary",
			children: i
		}), t === void 0 && r ? /* @__PURE__ */ (0, Z.jsx)("b", {
			"data-follow-reading": "",
			className: "text-title-1-medium text-text-primary",
			children: Y("follow:shared.notFound")
		}) : /* @__PURE__ */ (0, Z.jsx)(As, {
			reveal: Ws,
			children: /* @__PURE__ */ (0, Z.jsx)(Hs, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: Y("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Z.jsx)(qs, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var Ys = (e) => A.some(([t]) => t === e);
function Xs(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, X.useState)(Ys(e.tab) ? e.tab : "list"), [u, f] = (0, X.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, X.useState)(() => Et(e.sort, e.dir).sort), [h, g] = (0, X.useState)(() => Et(e.sort, e.dir).dir), [_, v] = (0, X.useState)(at(e.layout) ? e.layout : "default"), [y, ee] = (0, X.useState)(mt(e.pageSize)), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, X.useState)(/* @__PURE__ */ new Set());
	Gt(() => {
		x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set());
	}), (0, X.useEffect)(() => {
		(b.size || S.size) && Ue();
	}, [b, S]);
	let E = Kt({
		queryKey: k,
		queryFn: ({ signal: e }) => Xe(e)
	}), D = Kt({
		queryKey: O,
		queryFn: ({ signal: e }) => Je(e)
	}), j = Kt({
		queryKey: T,
		queryFn: ({ signal: e }) => Ye(e)
	}), M = E.data || { sources: [] }, N = D.data || {
		root: "",
		providers: []
	}, P = M.sources;
	(0, X.useEffect)(() => {
		x((e) => {
			let t = ct(e, P);
			return t.size === e.size ? e : t;
		});
	}, [P]);
	let F = (e) => {
		let n = e.sort ?? p, r = e.dir ?? h;
		t({
			tab: e.tab ?? c,
			page: e.page ?? u,
			sort: n === "checked" ? "" : n,
			dir: r === V[n] ? "" : r
		});
	}, I = rt(P), L = P.filter(it).length, R = P.filter((e) => e.enabled).length, z = (N.providers || []).filter((e) => e.requirement === "required" && !Re(e)).length, te = new Set((j.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Z.jsxs)(Yt, { children: [
		a ? /* @__PURE__ */ (0, Z.jsx)(B, {
			tone: "warning",
			title: Y("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Z.jsx)(w, {
					href: s,
					children: Y("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: H,
			"aria-label": Y("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "creators",
					figure: E.data ? I.length : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "enabled",
					figure: E.data ? R : void 0,
					total: P.length,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "failed",
					figure: E.data ? L : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "updates",
					figure: E.data ? M.counts?.new || 0 : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "subscriptions",
					figure: j.data ? te : void 0,
					failed: j.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Js, {
					field: "releases",
					figure: j.data ? j.data.unread || 0 : void 0,
					failed: j.isError
				})
			]
		}),
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: "flex flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, Z.jsx)("div", {
					"data-section-nav": !0,
					children: /* @__PURE__ */ (0, Z.jsx)(ce, {
						group: "follow",
						label: Y("follow:followManagePage.sectionTabs"),
						value: c,
						panelPrefix: "follow",
						sectionItems: !0,
						tabs: A.map(([e, t]) => ({
							value: e,
							label: t
						})),
						className: "",
						itemClassName: "cursor-pointer whitespace-nowrap",
						onChange: (e) => {
							x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set()), l(e), F({ tab: e });
						}
					})
				}),
				c === "list" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-list",
					"aria-labelledby": "follow-tab-list",
					className: "flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, Z.jsx)(Jn, {
						readOnly: a,
						toast: r,
						onAdd: () => {
							l("add"), F({ tab: "add" });
						},
						selection: {
							ids: S,
							onChange: C,
							onActivate: () => x(/* @__PURE__ */ new Set())
						}
					}), E.data ? /* @__PURE__ */ (0, Z.jsx)(rr, {
						data: M,
						sort: p,
						dir: h,
						page: u,
						layout: _,
						pageSize: y,
						selected: b,
						readOnly: a,
						toast: r,
						openFollow: i,
						onAdd: () => {
							l("add"), F({ tab: "add" });
						},
						onSort: (e, t) => {
							m(e), g(t), f(1), F({
								sort: e,
								dir: t,
								page: 1
							});
						},
						onPage: (e) => {
							f(e), F({ page: e });
						},
						onSelected: (e) => {
							x(e), C(/* @__PURE__ */ new Set());
						},
						onLayout: (e) => {
							v(e), f(1), n({ layout: e }), F({ page: 1 });
						},
						onPageSize: (e) => {
							ee(e), f(1), n({ pageSize: e }), F({ page: 1 });
						}
					}) : E.isError ? /* @__PURE__ */ (0, Z.jsx)(B, {
						tone: "error",
						children: Y("follow:followManagePage.listFailed")
					}) : /* @__PURE__ */ (0, Z.jsx)("div", {
						role: "status",
						"aria-label": Y("follow:followManagePage.listLoading"),
						"data-skeleton": "",
						className: "skeleton-sheen h-32 rounded-lg"
					})]
				}) : null,
				c === "add" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-add",
					"aria-labelledby": "follow-tab-add",
					className: "flex flex-col gap-8",
					children: [
						D.data && E.data ? /* @__PURE__ */ (0, Z.jsx)(_n, {
							data: M,
							credentials: N,
							readOnly: a,
							toast: r
						}) : D.isError || E.isError ? /* @__PURE__ */ (0, Z.jsx)(B, {
							tone: "error",
							children: Y("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Z.jsx)("div", {
							role: "status",
							"aria-label": Y("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Z.jsx)(Sn, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								j.refetch(), l("list"), F({ tab: "list" });
							}
						}),
						E.data ? /* @__PURE__ */ (0, Z.jsx)(Fn, {
							groups: M.author_aliases || [],
							readOnly: a,
							toast: r,
							suggestions: M.alias_suggestions || [],
							sources: M.sources
						}) : null
					]
				}) : null,
				c === "tags" ? /* @__PURE__ */ (0, Z.jsx)("div", {
					role: "tabpanel",
					id: "follow-panel-tags",
					"aria-labelledby": "follow-tab-tags",
					className: "flex flex-col gap-4",
					children: /* @__PURE__ */ (0, Z.jsx)(me, { scope: "online" })
				}) : null
			]
		}),
		/* @__PURE__ */ (0, Z.jsx)("div", { children: /* @__PURE__ */ (0, Z.jsx)(d, {
			variant: "secondary",
			href: "/settings/subscriptions",
			children: z ? Y("follow:followManagePage.feedSettingsPending", { count: z }) : Y("follow:followManagePage.feedSettings")
		}) })
	] });
}
export { Xs as FollowManagePage };

//# debugId=06aab636-612c-42ca-b61c-8e8a34cb241e