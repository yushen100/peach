(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "974081b4-7a83-457d-a6d6-e1ff2355532a", e._sentryDebugIdIdentifier = "sentry-dbid-974081b4-7a83-457d-a6d6-e1ff2355532a");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, ColumnFilterAvatar as y, Ct as ee, DataTableFooter as b, DataTableFrame as x, DataTableSort as S, EmptyFocusButton as C, EmptyState as w, ErrorText as T, ExternalLink as E, FEEDS_KEY as te, FOLLOW_CHECK_KEY as D, FOLLOW_CHECK_TASK as O, FOLLOW_CREDENTIALS_KEY as k, FOLLOW_MANAGE_KEY as ne, FOLLOW_MANAGE_NAV as A, FOLLOW_RESOLVE_KEY as j, FieldLabel as M, Gg as N, H7 as re, Help as P, Input as ie, LAYOUTS as F, LEGACY_AVATAR_IMG as I, M6 as ae, MENU_ITEM as L, MENU_ITEM_INTERACTIVE as R, MENU_POPOVER_SURFACE as z, ModalFrame as B, Note as V, OV as H, P7 as oe, SORT_DEFAULT_DIR as se, SORT_OPTIONS as ce, STAT_STRIP_SIX as U, Select as le, SelectItem as ue, SelectionDock as de, SelectionPopover as W, SiteIcon as fe, SiteLabel as pe, SortDirectionIcon as me, SortableBoardTabs as he, Switch as G, Table as ge, TableColumnControls as _e, TableColumnResizer as ve, TableSelectionHeader as ye, TaskProgress as be, Un as xe, Wt as Se, Xf as Ce, __toESM as we, activityKind as Te, addAlias as Ee, addSource as De, authorGroups as Oe, authorName as ke, avatarInner as Ae, busyProps as K, cardClass as je, checkEvidenceGap as Me, checkFailures as Ne, checkFeeds as Pe, checkReceipt as Fe, checkSummary as Ie, checkedText as Le, clickedBlank as Re, codedText as ze, columnVisibilityFeature as Be, composingKey as Ve, confirmModal as He, createColumnHelper as Ue, credentialDone as We, cx as q, dZ as Ge, dropSources as Ke, du as qe, enterPageSelection as Je, errorHeadline as Ye, errorMessage as J, exitPageSelection as Xe, feedIntervalText as Ze, fetchCheckJob as Qe, fetchCredentials as $e, fetchFeeds as et, fetchFollow as tt, fetchResolveJob as nt, fetchSuggestions as rt, flexRender as it, followFeedByName as at, followFeedEntity as ot, followSuggestKey as st, groupByAuthor as ct, isBroken as lt, isLayout as ut, jobText as dt, joinList as ft, keepSelected as pt, l7 as mt, localTime as ht, lookupFeedActor as gt, mapLimit as _t, markAllPending as vt, pageSizeOf as yt, pageWindow as bt, patchSource as xt, pv as St, queryClient as Ct, quoted as wt, reloadFollowManage as Tt, removeAlias as Et, removeFeed as Dt, removeSource as Ot, renameAliasGroup as kt, require_jsx_runtime as At, require_react as jt, resolveFollowSort as Mt, rowPaginationFeature as Nt, rowSelectionFeature as Pt, rowSelectionOperation as Ft, rowSortingFeature as It, runBulkAction as Lt, selectionState as Rt, serverLabel as zt, setFeedEnabled as Bt, setSourceEnabled as Vt, skeletonHtml as Ht, sortLabel as Ut, startCheck as Wt, startResolve as Gt, statusText as Kt, t as Y, tableFeatures as qt, tableRows as Jt, th as Yt, toggleGroup as Xt, unmarkItems as Zt, useAction as Qt, useBackgroundJob as $t, useMutation as en, usePageSelection as tn, useQuery as nn, useRowWorkContext as rn, useTable as an, useTableFilters as on, useTablePreferences as sn, useWorkContextMenu as cn } from "./peach-app.js";
import { Page as ln } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as un, ErrorLine as dn, SourceIcon as fn, SourceLink as pn, StatusBadge as mn } from "./peach-app.source-view-CDbKpFus.js";
import { createPaginatedRowModel as hn, createSortedRowModel as gn, useTableSelection as _n } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/follow-manage/add-source.tsx
var X = /* @__PURE__ */ we(jt(), 1), Z = At(), vn = q(L, R, "text-body-2-medium"), yn = Y("follow:addCreatorSource.placeholder"), bn = Y("follow:addCreatorSource.title"), xn = Y("follow:addCreatorSource.searchingByName"), Sn = Y("follow:addCreatorSource.recognizing"), Cn = Y("follow:addCreatorSource.noSourceFound"), wn = "/settings/subscriptions", Tn = (e, t) => `${e}:${t.url}`;
function En({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
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
		className: q(z, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
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
			className: t === i ? q(vn, "bg-background-secondary-default") : vn,
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
function Dn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? Y("follow:addCreatorSource.allSources") : Y("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Z.jsx)(W, {
		label: Y("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: Y("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Z.jsx)(fn, { provider: e.provider }), e.provider_label]
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
				href: wn
			}
		]
	});
}
function On({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Z.jsx)(V, {
		tone: "error",
		title: e.line,
		children: dt(e, "error") || Y("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: je({
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
				let n = Tn(t, e);
				return /* @__PURE__ */ (0, Z.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(fn, { provider: e.provider }),
							/* @__PURE__ */ (0, Z.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "min-w-0 break-words",
								children: ze(e, "label")
							}),
							/* @__PURE__ */ (0, Z.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? Y("follow:addCreatorSource.alreadyFollowing") : ze(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Z.jsx)(P, { children: Cn }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: ze(e, "evidence")
				}), /* @__PURE__ */ (0, Z.jsx)(E, {
					href: e.url,
					children: Y("follow:shared.labeled", {
						label: ze(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Z.jsx)(P, { children: ft(o.map(([t, n]) => Y("follow:shared.labeled", {
				label: t,
				value: zt(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function kn({ data: e, credentials: t, readOnly: n, toast: r }) {
	let [i, a] = (0, X.useState)(""), [o, s] = (0, X.useState)(!1), [c, l] = (0, X.useState)(""), [d, f] = (0, X.useState)(""), [p, m] = (0, X.useState)(!1), [h, g] = (0, X.useState)(null), [_, v] = (0, X.useState)(-1), y = (0, X.useRef)(null), ee = (0, X.useRef)(null), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, X.useState)(/* @__PURE__ */ new Set()), [w, T] = (0, X.useState)(""), [E, te] = (0, X.useState)(0);
	(0, X.useEffect)(() => {
		let e = i.trim();
		if (o || !e || e.includes("/")) {
			f("");
			return;
		}
		let t = setTimeout(() => f(e), 250);
		return () => clearTimeout(t);
	}, [i, o]);
	let D = nn({
		queryKey: st(d),
		queryFn: ({ signal: e }) => rt(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), O = (0, X.useMemo)(() => (D.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: zt(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: zt(e.label_code ?? "", e.label)
	}))), [D.data]), { job: k, running: ne, outcome: A, start: N, dismiss: re } = $t({
		queryKey: j,
		queryFn: ({ signal: e }) => nt(e),
		start: (e) => Gt([e]),
		onStarted: () => C(/* @__PURE__ */ new Set()),
		onError: (e) => T(J(e)),
		onFinish: (e) => {
			e.status === "failed" && T(dt(e, "error") || Y("follow:addCreatorSource.searchFailed"));
		}
	}), P = (e) => {
		let t = e.trim();
		!t || n || o || ne || N.isPending || (T(""), v(-1), l(t), a(t), f(""), g(t), N.mutate(t));
	}, F = D.isFetching, I = p && !o && h !== i && (O.length > 0 || F), ae = () => {
		v(-1), g(i);
	}, L = (e) => {
		if (!(o || Ve(e.nativeEvent))) {
			if (e.key === "Escape" && I) ae();
			else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!O.length) return;
				if (e.preventDefault(), !I) {
					g(null);
					return;
				}
				let t = e.key === "ArrowDown" ? 1 : -1;
				v((e) => {
					let n = e + t;
					return n < 0 ? O.length - 1 : n >= O.length ? 0 : n;
				});
			} else e.key === "Enter" && (e.preventDefault(), P(O[_]?.value || i));
		}
	}, R = A?.results || [], z = R.flatMap((e, t) => (e.candidates || []).filter((e) => !e.known && !b.has(e.provider_label || "")).map((e) => ({
		candidate: e,
		key: Tn(t, e)
	})).filter((e) => !S.has(e.key))), B = en({
		mutationFn: async (e) => {
			let t = [], n = [];
			te(0);
			for (let r of e) {
				try {
					let e = await De(r.candidate);
					n.push(e.source);
				} catch (e) {
					t.push(Y("follow:shared.labeled", {
						label: r.candidate.label,
						value: J(e)
					}));
				}
				te((e) => e + 1);
			}
			if (n.length) try {
				await Wt(n);
			} catch (e) {
				t.push(J(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			Tt(), e.failures.length ? T(ft(e.failures)) : (T(""), re(), r(Y("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => T(J(e))
	}), H = e.suggestions || [], oe = !c.includes("/");
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": bn,
		className: je({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: bn
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
						children: [/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:addCreatorSource.inputLabel"),
							placeholder: yn,
							value: i,
							leadingIcon: St,
							enterKeyHint: "search",
							isDisabled: n,
							onChange: a,
							onCompositionStart: () => {
								s(!0), v(-1);
							},
							onCompositionEnd: (e) => {
								s(!1), a(e.currentTarget.value);
							},
							onKeyDown: L
						}), I ? /* @__PURE__ */ (0, Z.jsx)(En, {
							field: y,
							menu: ee,
							options: O,
							active: _,
							busy: F,
							onPick: P,
							onClose: ae
						}) : null]
					}),
					/* @__PURE__ */ (0, Z.jsx)(Dn, {
						credentials: t,
						hidden: b,
						onHidden: x
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...K(ne || N.isPending),
						onClick: () => P(i),
						children: Y("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [ne || N.isPending ? /* @__PURE__ */ (0, Z.jsx)(be, {
					embedded: !0,
					kind: Te("follow-resolve"),
					label: dt(k) || (k?.total ? Y("follow:addCreatorSource.searchProgress", {
						checked: k.checked || 0,
						count: k.total
					}) : oe ? xn : Sn),
					value: k?.checked,
					total: k?.total
				}) : null, w ? /* @__PURE__ */ (0, Z.jsx)(V, {
					tone: "error",
					title: Y("follow:addJavFeed.notCompleted"),
					children: w
				}) : null]
			}),
			R.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:addCreatorSource.results") }),
					R.map((e, t) => /* @__PURE__ */ (0, Z.jsx)(On, {
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
								onClick: () => re(),
								children: Y("follow:shared.close")
							}),
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: n || !z.length,
								...K(B.isPending),
								onClick: () => B.mutate(z),
								children: Y("follow:addCreatorSource.addSelected", { count: z.length })
							}),
							B.isPending ? /* @__PURE__ */ (0, Z.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:addCreatorSource.addingProgress", {
									added: E,
									count: z.length
								})
							}) : null
						]
					})
				]
			}) : null,
			H.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: Y("follow:addCreatorSource.suggested")
				}), H.map((e) => /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: n,
					title: e.origin ? Y("follow:addCreatorSource.historyVisitsFrom", {
						count: e.visits,
						origin: e.origin
					}) : Y("follow:addCreatorSource.historyVisits", { count: e.visits }),
					onClick: () => P(e.name),
					children: e.name
				}, e.name))]
			}) : null
		]
	});
}
// src/react/follow-manage/add-feed.tsx
var An = Y("follow:addJavFeed.placeholder"), jn = Y("follow:addJavFeed.title");
function Mn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: Y("follow:addJavFeed.cardsSplitAcrossPeople", { names: ft([...n.values()]) }),
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
function Nn({ card: e, picked: t, onPick: n }) {
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
						children: ft(e.names)
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
		}), /* @__PURE__ */ (0, Z.jsx)(E, {
			href: e.url,
			children: e.id
		})]
	});
}
function Pn({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, X.useState)(""), [a, o] = (0, X.useState)(null), [s, c] = (0, X.useState)(/* @__PURE__ */ new Set()), l = Qt(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => gt(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !Ve(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => at(a.q, [...s], e), (e) => {
			t(e.created ? Y("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : Y("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => ot(e.id, t), () => {
			t(Y("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? Mn(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": jn,
		className: je({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: jn
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Z.jsx)(ie, {
						"aria-label": Y("follow:addJavFeed.actressName"),
						placeholder: An,
						value: r,
						leadingIcon: St,
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
			l.error ? /* @__PURE__ */ (0, Z.jsx)(V, {
				tone: "error",
				title: Y("follow:addJavFeed.notCompleted"),
				children: l.error
			}) : null,
			a ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					a.unavailable ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "warning",
						title: Y("follow:addJavFeed.javdbSearchFailed"),
						children: zt(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Z.jsx)(Nn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Z.jsx)(P, { children: a.unavailable ? Y("follow:addJavFeed.noCardsThisTime") : Y("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Z.jsx)(P, {
						role: "status",
						children: s.size ? g.text : Y("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Z.jsx)(P, {
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
function Fn({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Z.jsx)(B, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: Y("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Z.jsx)(In, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function In({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, X.useState)(t.canonical_name), o = Qt();
	return /* @__PURE__ */ (0, Z.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => kt(t.canonical_key, i.trim(), e), () => {
				Tt(), r(Y("follow:creatorAliases.renamed", { name: i.trim() })), n();
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
			/* @__PURE__ */ (0, Z.jsx)(ie, {
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
			o.error ? /* @__PURE__ */ (0, Z.jsx)(V, {
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
var Ln = (e) => Y("follow:creatorAliases.removeBody", { alias: e }), Rn = qt({
	rowSelectionFeature: Pt,
	rowSortingFeature: It,
	rowPaginationFeature: Nt,
	columnVisibilityFeature: Be,
	sortedRowModel: gn(),
	paginatedRowModel: hn()
}), zn = Rn, Bn = {
	id: "select",
	label: Y("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, Vn = {
	id: "canonical",
	label: Y("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, Hn = [
	Bn,
	Vn,
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
], Un = [
	Bn,
	Vn,
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
], Wn = (e) => e.alias;
function Gn(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function Kn({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Z.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Z.jsx)(un, {
			group: Gn(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Z.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function qn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = sn("alias-suggestions", Hn), f = sn("alias-saved", Un), [p, g] = (0, X.useState)(null), [_, v] = (0, X.useState)({}), [y, E] = (0, X.useState)({});
	tn(() => {
		v({}), E({});
	}), (0, X.useEffect)(() => {
		(Object.values(_).some(Boolean) || Object.values(y).some(Boolean)) && Je();
	}, [_, y]);
	let te = _n(() => v({})), D = _n(() => E({})), [O, k] = (0, X.useState)([]), [ne, A] = (0, X.useState)([]), [j, N] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [re, P] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), F = on(t, {
		canonical: {
			values: (e) => e.canonical,
			option: (e) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(un, {
				group: Gn(s, e),
				name: e,
				small: !0
			}) })
		},
		alias: {
			values: (e) => e.alias,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(un, {
				group: Gn(s, t?.canonical ?? e),
				name: e,
				small: !0
			}) })
		},
		evidence: { values: (e) => zt(e.evidence_code ?? "", e.evidence, e.evidence_params) }
	}, () => N((e) => ({
		...e,
		pageIndex: 0
	}))), I = on(e, {
		canonical: {
			values: (e) => e.canonical_name,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(un, {
				group: Gn(s, e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		},
		aliases: {
			values: (e) => e.aliases.map((e) => e.name),
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(un, {
				group: Gn(s, t?.canonical_name ?? e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		}
	}, () => P((e) => ({
		...e,
		pageIndex: 0
	}))), L = {
		...j,
		pageIndex: Math.min(j.pageIndex, Math.max(0, Math.ceil(F.items.length / j.pageSize) - 1))
	}, R = {
		...re,
		pageIndex: Math.min(re.pageIndex, Math.max(0, Math.ceil(I.items.length / re.pageSize) - 1))
	}, [z, B] = (0, X.useState)(""), [V, H] = (0, X.useState)(""), [se, ce] = (0, X.useState)(""), U = en({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await Ee(n.canonical, n.alias);
				} catch (n) {
					throw t && Tt(), Error(Y("follow:creatorAliases.mergePartialError", {
						error: J(n),
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
			B(""), v({}), Tt();
		},
		onError: (e) => B(J(e))
	}), le = en({
		mutationFn: (e) => Ee(e.canonical, e.alias),
		onSuccess: () => {
			B(""), H(""), ce(""), Tt(), l(Y("follow:creatorAliases.saved"));
		},
		onError: (e) => B(J(e))
	}), ue = en({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await Et(e), n += 1;
			} catch (e) {
				throw Error(Y("follow:creatorAliases.removePartialError", {
					error: J(e),
					removed: n,
					count: t.length - n
				}));
			} finally {
				Tt();
			}
		},
		onSuccess: (e, t) => {
			B(""), E({}), typeof t == "string" && l(Y("follow:creatorAliases.removed"));
		},
		onError: (e) => B(J(e))
	}), W = {
		receipt: l,
		failure: (e) => B(J(e))
	}, fe = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: Y(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: Y(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: Y("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: ft(t.map((e) => Y("follow:creatorAliases.mergePair", {
					alias: wt(e.alias),
					canonical: wt(e.canonical)
				})))
			}),
			confirmLabel: Y(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await U.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await Et(n.alias);
				await Tt();
			};
		},
		receipt: (e) => Y("follow:creatorAliases.merged", { count: e.length })
	}), pe = (e, t) => {
		e.length && Lt(fe(t, e.length), e, W).catch(W.failure);
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
		run: async (e) => (await ue.mutateAsync(e.map((e) => e.name)), async () => {
			for (let t of e) await Ee(t.canonical, t.name);
			await Tt();
		}),
		receipt: () => Y("follow:creatorAliases.removed")
	}, he = (e) => void He({
		title: Y("follow:creatorAliases.removeTitle"),
		body: Ln(e),
		confirmLabel: Y("follow:creatorAliases.removeTitle"),
		onConfirm: () => ue.mutateAsync(e)
	}), G = (0, X.useRef)({
		sources: s,
		readOnly: c,
		merging: U.isPending,
		removing: ue.isPending,
		merge: pe,
		remove: he,
		rename: g
	});
	G.current = {
		sources: s,
		readOnly: c,
		merging: U.isPending,
		removing: ue.isPending,
		merge: pe,
		remove: he,
		rename: g
	};
	let be = (0, X.useMemo)(() => {
		let e = Ue();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(ye, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Kn, {
					sources: G.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: Y("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => zt(e.evidence_code ?? "", e.evidence, e.evidence_params), {
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
	}, []), xe = (0, X.useMemo)(() => {
		let e = Ue();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Z.jsx)(ye, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Kn, {
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
							leadingIcon: oe,
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
	}, []), Se = an({
		features: Rn,
		data: F.items,
		columns: be,
		getRowId: Wn,
		state: {
			rowSelection: _,
			sorting: O,
			pagination: L,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			te(), v(e);
		},
		onSortingChange: (e) => {
			k(e), N((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: N,
		enableRowSelection: !0
	}), we = an({
		features: zn,
		data: I.items,
		columns: xe,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: y,
			sorting: ne,
			pagination: R,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			D(), E(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			A(e), P((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: P
	}), Te = t.filter((e) => _[Wn(e)]), De = e.filter((e) => y[e.canonical_key]).flatMap((e) => e.aliases.map((t) => ({
		name: t.name,
		canonical: e.canonical_name
	}))), Oe = rn((e) => t.find((t) => Wn(t) === e), (e) => {
		let t = Se.getRow(Wn(e));
		return [Ft(t.getIsSelected(), () => t.toggleSelected()), {
			id: "merge",
			label: Y("follow:shared.merge"),
			icon: Yt,
			disabled: c || U.isPending,
			run: () => pe([e], !1)
		}];
	}), ke = rn((t) => e.find((e) => e.canonical_key === t), (e) => {
		let t = we.getRow(e.canonical_key), n = e.aliases.map((t) => ({
			name: t.name,
			canonical: e.canonical_name
		}));
		return [
			{
				id: "rename",
				label: Y("follow:creatorAliases.rename"),
				icon: ee,
				disabled: c,
				run: () => g(e)
			},
			Ft(t.getIsSelected(), () => t.toggleSelected()),
			{
				id: "remove",
				label: Y("follow:creatorAliases.removeRowAliases", { count: n.length }),
				icon: ae,
				danger: !0,
				disabled: c || ue.isPending || !n.length,
				run: async () => {
					await Lt(me, n, W);
				}
			}
		];
	}), Ae = K(U.isPending);
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: je({
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
						/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:creatorAliases.displayName"),
							placeholder: Y("follow:creatorAliases.displayNamePlaceholder"),
							value: V,
							onChange: H,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:creatorAliases.platformAlias"),
							placeholder: Y("follow:creatorAliases.platformAlias"),
							value: se,
							onChange: ce,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							disabled: c || !V.trim() || !se.trim(),
							...K(le.isPending),
							onClick: () => le.mutate({
								canonical: V.trim(),
								alias: se.trim()
							}),
							children: Y("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			z ? /* @__PURE__ */ (0, Z.jsx)(T, { children: z }) : null,
			t.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				onKeyDown: Oe.onKeyDown,
				children: [
					Oe.menu,
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: F.items.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [
								/* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "primary",
									size: "small",
									disabled: c,
									...Ae,
									onClick: () => pe(F.items, !0),
									children: Y("follow:creatorAliases.mergeAllCount", { count: F.items.length })
								}),
								/* @__PURE__ */ (0, Z.jsx)(S, {
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
										k(e), N((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Z.jsx)(_e, {
									preferences: d,
									label: Y("follow:creatorAliases.pendingTable")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(de, {
						label: Y("follow:creatorAliases.pendingBulkActions"),
						visible: Te.length > 0,
						count: Y("follow:creatorAliases.groupsSelected", { count: Te.length }),
						actions: [{
							action: fe(!1, Te.length),
							items: Te,
							host: W,
							disabled: c || U.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Xe,
							children: Y("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(x, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => Se.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(ge, {
							"aria-label": Y("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: O[0] ? {
								column: O[0].id,
								direction: O[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => Se.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [Se.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [F.header(e.id, String(e.column.columnDef.header)) ?? it(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ve, {
									preferences: d,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: d.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
								renderEmptyState: () => Y("shell:dataTable.empty"),
								children: Se.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
									id: e.id,
									"data-board-selected": e.getIsSelected() || void 0,
									"data-work-context-row": e.id,
									onContextMenu: (t) => Oe.onContextMenu?.(t, e.original, e.id),
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: it(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(b, {
						label: Y("follow:creatorAliases.pendingTable"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: F.items.length,
						pagination: L,
						onChange: N
					})
				]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				onKeyDown: ke.onKeyDown,
				children: [
					ke.menu,
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: I.items.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(S, {
								label: Y("follow:creatorAliases.saved"),
								sorting: ne,
								options: [{
									id: "canonical",
									label: Y("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: Y("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									A(e), P((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Z.jsx)(_e, {
								preferences: f,
								label: Y("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(de, {
						label: Y("follow:creatorAliases.savedBulkActions"),
						visible: De.length > 0,
						count: Y("follow:creatorAliases.aliasesSelected", { count: De.length }),
						actions: [{
							action: {
								...me,
								label: Y("follow:creatorAliases.removeSelectedCount", { count: De.length })
							},
							items: De,
							host: W,
							disabled: c || ue.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Xe,
							children: Y("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(x, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => we.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(ge, {
							"aria-label": Y("follow:creatorAliases.saved"),
							size: "sm",
							sortDescriptor: ne[0] ? {
								column: ne[0].id,
								direction: ne[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => we.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [we.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [I.header(e.id, String(e.column.columnDef.header)) ?? it(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ve, {
									preferences: f,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: f.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
								renderEmptyState: () => Y("shell:dataTable.empty"),
								children: we.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
									id: e.id,
									"data-board-selected": e.getIsSelected() || void 0,
									"data-work-context-row": e.id,
									onContextMenu: (t) => ke.onContextMenu?.(t, e.original, e.id),
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: it(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}), /* @__PURE__ */ (0, Z.jsx)(b, {
						label: Y("follow:creatorAliases.saved"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: I.items.length,
						pagination: R,
						onChange: P
					})] }) : /* @__PURE__ */ (0, Z.jsx)(w, {
						size: "compact",
						icon: Ce,
						title: Y("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Z.jsx)(C, {
							target: `input[aria-label="${Y("follow:creatorAliases.displayName")}"]`,
							children: Y("follow:creatorAliases.addAlias")
						}),
						children: Y("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(Fn, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var Jn = qt({
	rowPaginationFeature: Nt,
	rowSelectionFeature: Pt,
	rowSortingFeature: It,
	columnVisibilityFeature: Be,
	sortedRowModel: gn(),
	paginatedRowModel: hn()
}), Yn = {
	select: Y("follow:shared.select"),
	name: Y("follow:shared.name"),
	kind: Y("follow:shared.type"),
	origin: Y("follow:followFeed.filterKindSource"),
	status: Y("follow:shared.status"),
	interval: Y("follow:feedSources.colInterval"),
	fetched: Y("follow:feedSources.colLastFetched"),
	fresh: Y("follow:feedSources.colLastAdded"),
	actions: Y("follow:shared.actions")
}, Xn = Object.entries(Yn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), Zn = () => Ct.invalidateQueries({
	queryKey: te,
	exact: !0
}), Q = (e) => e.name || e.url, Qn = (e) => e.kind.startsWith("javdb") ? "javdb" : e.kind.startsWith("dmm") ? "dmm" : $n(e.url);
function $n(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function er({ source: e }) {
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
function tr({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Z.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${I}`,
		dangerouslySetInnerHTML: { __html: Ae(Q(e), t, null, "performer") }
	});
}
var nr = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function rr(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function ir(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return He({
		title: n ? Y("follow:feedSources.removeOne") : Y("follow:feedSources.removeMany", { count: e.length }),
		body: n ? Y("follow:feedSources.removeOneBody", { name: Q(n) }) : Y("follow:feedSources.removeManyBody"),
		confirmLabel: Y(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: t
	});
}
function ar({ readOnly: e, toast: t, onAdd: s, selection: c }) {
	let l = nn({
		queryKey: te,
		queryFn: ({ signal: e }) => et(e)
	}), d = Qt(), p = sn("jav-feeds", Xn), g = l.data, _ = (0, X.useMemo)(() => g?.sources ?? [], [g]), [v, ee] = (0, X.useState)(/* @__PURE__ */ new Set()), C = c?.ids ?? v, E = c?.onChange ?? ee, [D, O] = (0, X.useState)(1), [k, ne] = (0, X.useState)(20), [A, j] = (0, X.useState)([]), M = on(_, {
		name: {
			values: Q,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(y, { person: {
				...t,
				id: t.entity_id,
				name: e
			} }) })
		},
		kind: {
			values: (e) => ze(e, "kind_label"),
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(fe, { site: Qn(t) }) })
		},
		origin: {
			values: (e) => $n(e.url),
			option: (e, t) => ({ leading: /* @__PURE__ */ (0, Z.jsx)(fe, { site: t ? Qn(t) : e }) })
		},
		status: { values: (e) => e.enabled ? e.last_error ? Y("follow:feedSources.fetchFailed") : e.last_fetched_at ? Y("follow:shared.ok") : Y("follow:feedSources.notChecked") : Y("follow:shared.paused") },
		interval: { values: (e) => Ze(e.interval_minutes) }
	}, () => O(1)), P = bt(M.items.length, k, D);
	(0, X.useEffect)(() => {
		O((e) => Math.min(e, P.pages));
	}, [P.pages]), (0, X.useEffect)(() => {
		E((e) => {
			let t = new Set(_.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [_, E]);
	let ie = en({
		mutationFn: async (e) => {
			let t = await _t(e.ids, 4, async (t) => {
				e.action === "remove" ? await Dt(t) : await Bt(t, e.action === "enabled");
			});
			return {
				...e,
				results: t
			};
		},
		onSuccess: (e) => {
			let t = e.results.filter((e) => !e.ok);
			if (E(/* @__PURE__ */ new Set()), Zn(), t.length) {
				let e = t[0];
				d.setError(Y("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : J(e.error)
				}));
			}
		},
		onError: (e) => d.setError(J(e))
	}), F = {
		receipt: t,
		failure: (e) => d.setError(J(e))
	}, I = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:feedSources.enableMany" : "follow:feedSources.pauseMany"),
			body: Y(e ? "follow:feedSources.enableManyBody" : "follow:feedSources.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => t.enabled !== e), { results: r } = await ie.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await _t(i.map((e) => e.id), 4, (t) => Bt(t, !e)), await Zn();
			};
		},
		receipt: (t) => Y(e ? "follow:feedSources.enabledMany" : "follow:feedSources.pausedMany", { count: t.length })
	}), L = {
		key: "remove",
		label: Y("follow:shared.remove"),
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: Y("follow:feedSources.removeMany", { count: e.length }),
			danger: !0,
			body: Y("follow:feedSources.removeManyBody"),
			confirmLabel: Y("follow:feedSources.removeSelected")
		}),
		run: async (e) => {
			await ie.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:feedSources.removedMany", { count: e.length })
	}, R = (0, X.useMemo)(() => rr(_), [_]), z = (0, X.useRef)({
		readOnly: e,
		shared: R,
		busy: null,
		toggle: () => {},
		fetch: () => {},
		remove: () => {}
	});
	z.current = {
		readOnly: e,
		shared: R,
		busy: d.busy,
		toggle: (e, t) => void d.run(`enabled-${e.id}`, (n) => Bt(e.id, t, n), () => void Zn()),
		fetch: (e) => void d.run(`check-${e.id}`, (t) => Pe(t, [e.id]), () => void Zn()),
		remove: (e) => void ir([e], async () => {
			await Dt(e.id), t(Y("follow:feedSources.removedOne", { name: Q(e) })), Zn();
		})
	};
	let B = (0, X.useMemo)(() => {
		let e = Ue(), t = (e) => () => Yn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(ye, {
					table: e.table,
					label: Y("follow:feedSources.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": Y("follow:shared.selectNamed", { name: Q(e.row.original) })
				})
			}),
			e.accessor(Q, {
				id: "name",
				header: t("name"),
				cell: (e) => {
					let t = nr(e.row.original, z.current.shared);
					return /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(tr, { source: e.row.original }),
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
			e.accessor((e) => ze(e, "kind_label"), {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(pe, {
						site: Qn(e.row.original),
						label: $n(e.getValue())
					}), /* @__PURE__ */ (0, Z.jsx)(Se, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? Y("follow:feedSources.fetchFailed") : e.enabled ? Y("follow:shared.enabled") : Y("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(er, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap",
					children: Ze(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? ht(e.row.original.last_fetched_at) : Y("follow:feedSources.neverFetched")
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
						/* @__PURE__ */ (0, Z.jsx)(G, {
							"aria-label": Y("follow:shared.enableNamed", { name: Q(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: z.current.readOnly,
							onChange: (t) => z.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Ge,
							"aria-label": Y("follow:feedSources.fetchNamed", { name: Q(e.row.original) }),
							disabled: z.current.readOnly,
							...K(z.current.busy === `check-${e.row.original.id}`),
							onClick: () => z.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ae,
							"aria-label": Y("follow:shared.removeNamed", { name: Q(e.row.original) }),
							disabled: z.current.readOnly,
							onClick: () => z.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), oe = (0, X.useMemo)(() => Object.fromEntries([...C].map((e) => [String(e), !0])), [C]), se = an({
		features: Jn,
		data: M.items,
		columns: B,
		getRowId: (e) => String(e.id),
		state: {
			rowSelection: oe,
			sorting: A,
			pagination: {
				pageIndex: P.page - 1,
				pageSize: k
			},
			columnVisibility: p.visibility
		},
		onColumnVisibilityChange: p.change,
		onSortingChange: (e) => {
			j(e), O(1);
		},
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			c?.onActivate();
			let t = typeof e == "function" ? e(oe) : e;
			E(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	}), ce = () => void d.run("check", (e) => Pe(e), () => void Zn()), U = (e) => {
		c?.onActivate(), E((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, le = _.filter((e) => C.has(e.id)), ue = _.filter((e) => e.last_error), W = rn((e) => _.find((t) => String(t.id) === e), (t) => {
		let n = [{
			id: "select",
			label: Y(C.has(t.id) ? "follow:shared.clearSelection" : "follow:shared.selectNamed", { name: Q(t) }),
			icon: re,
			run: () => U(t.id)
		}];
		return t.url && n.unshift({
			id: "open",
			label: Y("follow:sourceView.openSource"),
			icon: Se,
			run: () => {
				window.open(t.url, "_blank", "noopener,noreferrer");
			}
		}), e || n.push({
			id: "fetch",
			label: Y("follow:feedSources.fetchNamed", { name: Q(t) }),
			icon: Ge,
			disabled: !!d.busy,
			run: () => z.current.fetch(t)
		}, {
			id: "enabled",
			label: Y(t.enabled ? "follow:shared.pause" : "follow:shared.enable"),
			icon: t.enabled ? H : N,
			disabled: !!d.busy,
			run: () => z.current.toggle(t, !t.enabled)
		}, {
			id: "remove",
			label: Y("follow:shared.removeNamed", { name: Q(t) }),
			icon: ae,
			danger: !0,
			run: () => z.current.remove(t)
		}), n;
	});
	return g ? /* @__PURE__ */ (0, Z.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Z.jsxs)("section", {
			"aria-label": Y("follow:feedSources.listLabel"),
			className: je({
				padding: "none",
				className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
			}),
			onKeyDown: W.onKeyDown,
			children: [
				W.menu,
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
								count: _.length,
								unread: Number(g.unread) || 0
							})
						})]
					}), /* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-toolbar-actions": "",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(u, {
								onClick: ce,
								disabled: e,
								...K(d.busy === "check"),
								children: Y("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Z.jsx)(_e, {
								preferences: p,
								label: Y("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Z.jsx)(S, {
								label: Y("follow:feedSources.title"),
								sorting: A,
								onChange: (e) => {
									j(e), O(1);
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
									label: Yn[e]
								}))
							})
						]
					})]
				}),
				ue.length || d.error ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [ue.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:feedSources.failedTitle", { count: ue.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ue.map((e) => /* @__PURE__ */ (0, Z.jsx)("li", {
								className: "min-w-0 truncate",
								title: ze(e, "last_error"),
								children: Y("follow:shared.labeled", {
									label: Q(e),
									value: Ye(ze(e, "last_error")) || Y("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: Y("follow:feedSources.failedBody")
					}) : null, d.error ? /* @__PURE__ */ (0, Z.jsx)(T, { children: d.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)(de, {
					visible: le.length > 0,
					label: Y("follow:feedSources.bulkActions"),
					count: Y("follow:feedSources.selectedCount", { count: le.length }),
					actions: [
						I(!0),
						I(!1),
						L
					].map((t) => ({
						action: t,
						items: le,
						host: F,
						disabled: e || ie.isPending
					})),
					children: /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: Xe,
						children: Y("follow:shared.clearSelection")
					})
				}),
				_.length ? /* @__PURE__ */ (0, Z.jsx)(x, {
					follow: !0,
					preferences: p,
					onRowClick: (e) => U(Number(e)),
					children: /* @__PURE__ */ (0, Z.jsxs)(ge, {
						"aria-label": Y("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: A[0] ? {
							column: A[0].id,
							direction: A[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => se.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [se.getHeaderGroups()[0].headers.map((e) => {
							let t = it(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...p.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [M.header(e.id, Yn[e.id] || e.id) ?? t, e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ve, {
									preferences: p,
									id: e.id
								})] })
							}, e.id);
						}), /* @__PURE__ */ (0, Z.jsx)(r, {
							id: "remaining-space",
							"aria-label": Y("follow:shared.rowSpacer"),
							"data-table-space": "",
							width: p.spaceWidth,
							minWidth: 0
						})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
							renderEmptyState: () => Y("shell:dataTable.empty"),
							children: se.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-follow-selected": e.getIsSelected() || void 0,
								"data-work-context-row": e.id,
								onContextMenu: (t) => W.onContextMenu?.(t, e.original, e.id),
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: it(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id))
						})]
					})
				}) : /* @__PURE__ */ (0, Z.jsx)(w, {
					icon: f,
					title: Y("follow:feedSources.empty"),
					size: "compact",
					actions: e ? void 0 : /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						onClick: s,
						children: Y("follow:feedSources.add")
					}),
					children: Y("follow:feedSources.emptyHint")
				}),
				_.length ? /* @__PURE__ */ (0, Z.jsx)(b, {
					label: Y("follow:feedSources.footerLabel"),
					total: P.total,
					unit: Y("follow:feedSources.unit"),
					pagination: {
						pageIndex: P.page - 1,
						pageSize: k
					},
					onChange: (e) => {
						ne(e.pageSize), O(e.pageIndex + 1);
					}
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)("footer", {
					className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
					children: /* @__PURE__ */ (0, Z.jsx)("span", {
						role: "status",
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:feedSources.footerSummary", {
							unread: Number(g.unread) || 0,
							enabled: _.filter((e) => e.enabled).length,
							total: _.length
						})
					})
				})
			]
		})
	}) : l.error ? /* @__PURE__ */ (0, Z.jsx)(V, {
		tone: "error",
		title: Y("follow:feedSources.loadFailed"),
		children: J(l.error)
	}) : /* @__PURE__ */ (0, Z.jsx)("div", { dangerouslySetInnerHTML: { __html: Ht(Y("follow:feedSources.loading"), { fill: !1 }) } });
}
// src/react/follow-manage/source-list.tsx
var or = qt({
	rowPaginationFeature: Nt,
	rowSelectionFeature: Pt,
	rowSortingFeature: It,
	columnVisibilityFeature: Be,
	paginatedRowModel: hn()
}), sr = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), cr = 740;
function lr() {
	let [e, t] = (0, X.useState)(!1), n = (0, X.useRef)(null), r = (0, X.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < cr));
		r.observe(e), n.current = r, t(e.clientWidth < cr);
	}, []);
	return (0, X.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var ur = {
	select: Y("follow:shared.select"),
	author: Y("follow:shared.creator"),
	source: Y("follow:followFeed.filterKindSource"),
	provider: Y("follow:shared.site"),
	status: Y("follow:shared.status"),
	checked: Y("follow:sourceList.colLastChecked"),
	actions: Y("follow:shared.actions")
}, dr = Object.entries(ur).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
}));
function fr(e, t, n, r) {
	let i = [{
		id: "select",
		label: Y(t ? "follow:shared.clearSelection" : "follow:shared.selectNamed", { name: e.label }),
		icon: mt,
		run: () => n(!t)
	}];
	return e.url && i.unshift({
		id: "open",
		label: Y("follow:sourceView.openSource"),
		icon: Se,
		run: () => {
			window.open(e.url, "_blank", "noopener,noreferrer");
		}
	}), r.readOnly || i.push({
		id: "check",
		label: Y("follow:sourceList.checkNamed", { name: e.label }),
		icon: Ge,
		disabled: !e.enabled || r.busy,
		run: () => r.check([e.id])
	}, {
		id: "enabled",
		label: Y(e.enabled ? "follow:shared.pause" : "follow:shared.enable"),
		icon: e.enabled ? H : N,
		run: () => r.toggle(e, !e.enabled)
	}, {
		id: "remove",
		label: Y("follow:sourceList.unfollow"),
		icon: ae,
		danger: !0,
		run: () => r.remove(e)
	}), i;
}
function pr({ source: e, selected: t, onToggle: n, handlers: r }) {
	let i = cn(), a = () => ({
		key: e.id,
		operations: fr(e, t, n, r)
	});
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		"data-selected": t || void 0,
		"data-follow-source-row": "",
		className: "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3 last:rounded-b-lg max-sm:gap-x-2",
		onContextMenu: (e) => i.onContextMenu(e, a()),
		onKeyDown: (e) => {
			(e.key === "ContextMenu" || e.shiftKey && e.key === "F10") && i.onKeyDown(e, a());
		},
		onClick: (e) => {
			Re(e, e.currentTarget) && n(!t);
		},
		children: [
			i.menu,
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
					children: /* @__PURE__ */ (0, Z.jsx)(fn, { provider: e.provider })
				}), /* @__PURE__ */ (0, Z.jsx)(pn, { source: e })]
			}),
			/* @__PURE__ */ (0, Z.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Z.jsx)(mn, { source: e }),
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
						children: /* @__PURE__ */ (0, Z.jsx)(dn, { text: ze(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: Le(e)
					}),
					/* @__PURE__ */ (0, Z.jsx)(G, {
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
							leadingIcon: Ge,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...K(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ae,
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
function mr({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(lt).length, p = ft([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = Rt(r, l);
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Y("follow:sourceList.groupLabel", { name: t }),
		className: je({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Z.jsx)(un, {
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
							e.map((e) => /* @__PURE__ */ (0, Z.jsx)(fn, { provider: e.provider }, e.id)),
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
						leadingIcon: Ge,
						"aria-label": Y("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...K(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: mt,
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
			children: e.map((e) => /* @__PURE__ */ (0, Z.jsx)(pr, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function hr(e) {
	let { data: t, sort: s, dir: c, page: l, layout: d, pageSize: g, selected: v, readOnly: y, onSort: ee, onPage: S, onLayout: C, onPageSize: T, onSelected: E, toast: te, openFollow: k, onAdd: ne } = e, A = t.sources, j = (0, X.useMemo)(() => t.author_aliases || [], [t.author_aliases]), M = t.counts || {}, [N, re] = (0, X.useState)(/* @__PURE__ */ new Set()), [P, ie] = lr(), [I, L] = (0, X.useState)(""), R = (0, X.useMemo)(() => Oe(A, s, c, j), [
		A,
		s,
		c,
		j
	]), z = (0, X.useMemo)(() => Jt(R, s, c, j), [
		R,
		s,
		c,
		j
	]), B = on(z, {
		author: {
			values: (e) => e.author,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(un, {
				group: t.group,
				name: e,
				small: !0
			}) })
		},
		source: {
			values: (e) => e.source.label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(fn, { provider: t.source.provider }) })
		},
		provider: {
			values: (e) => e.source.provider_label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(fn, { provider: t.source.provider }) })
		},
		status: { values: (e) => Kt(e.source) }
	}, () => S(1)), { job: H, running: oe, outcome: U, start: W } = $t({
		queryKey: D,
		taskKey: O,
		queryFn: ({ signal: e }) => Qe(e),
		start: (e) => Wt(e),
		onError: (e) => L(J(e)),
		onFinish: (e) => {
			Tt(), te(e.status === "failed" ? dt(e, "error") || Y("follow:followCheck.checkFailed") : Fe(e));
		}
	}), fe = (e) => {
		oe || W.isPending || (L(""), W.mutate(e));
	}, pe = (e, t) => E(Xt(v, [e], t)), he = (e, t) => E(Xt(v, e, t)), Se = en({
		mutationFn: (e) => Ot(e),
		onSuccess: (e, t) => {
			Ke([t]), E(Xt(v, [t], !1)), te(Y("follow:sourceList.unfollowed"));
		},
		onError: (e) => L(J(e))
	}), Ce = en({
		mutationFn: (e) => Vt(e.id, e.enabled),
		onSuccess: (e, t) => {
			xt(t.id, { enabled: t.enabled }), L("");
		},
		onError: (e) => L(J(e))
	}), we = (e) => void He({
		title: Y("follow:sourceList.unfollow"),
		body: Y("follow:sourceList.unfollowBody"),
		confirmLabel: Y("follow:sourceList.unfollow"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: () => Se.mutateAsync(e.id)
	}), Ee = en({
		mutationFn: async (e) => {
			let t = await _t(e.ids, 4, async (t) => {
				e.action === "remove" ? await Ot(t) : await Vt(t, e.action === "enabled");
			});
			return {
				...e,
				done: e.ids.filter((e, n) => t[n]?.ok),
				results: t
			};
		},
		onSuccess: (e) => {
			if (e.action === "remove") Ke(e.done);
			else for (let t of e.done) xt(t, { enabled: e.action === "enabled" });
			E(Xt(v, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? L(Y("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: J(t[0]?.error)
			})) : L("");
		},
		onError: (e) => L(J(e))
	}), De = en({
		mutationFn: vt,
		onSuccess: (e) => {
			Tt(), e.failed ? L(Y("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: J(e.error)
			})) : L("");
		},
		onError: (e) => L(J(e))
	}), Ae = {
		receipt: te,
		failure: (e) => L(J(e))
	}, Pe = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: Y(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => A.find((e) => e.id === t)?.enabled !== e), { done: r } = await Ee.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await _t(r, 4, (t) => Vt(t, !e));
				for (let t of r) xt(t, { enabled: !e });
			};
		},
		receipt: (t) => Y(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), Re = {
		key: "delete",
		label: Y("follow:shared.delete"),
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: Y("follow:sourceList.deleteManyTitle", { count: e.length }),
			danger: !0,
			body: Y("follow:sourceList.deleteManyBody"),
			confirmLabel: Y("follow:sourceList.deleteSelected")
		}),
		run: async (e) => {
			await Ee.mutateAsync({
				ids: [...e],
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:sourceList.bulkDeleted", { count: e.length })
	}, Be = (e) => {
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
			run: async () => (t = (await De.mutateAsync(e)).marked, async () => {
				await Zt(t), await Tt();
			}),
			receipt: () => Y("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Ve = (e, t) => Ce.mutate({
		id: e.id,
		enabled: t
	}), We = (0, X.useRef)({
		check: fe,
		toggle: Ve,
		remove: we,
		busy: !1,
		readOnly: y
	});
	We.current = {
		check: fe,
		toggle: Ve,
		remove: we,
		busy: oe || W.isPending,
		readOnly: y
	};
	let q = We.current, Je = rn((e) => A.find((t) => String(t.id) === e), (e) => fr(e, v.has(e.id), (t) => pe(e.id, t), q)), Ze = (0, X.useMemo)(() => {
		let e = Ue(), t = (e) => () => ur[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(ye, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(un, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(pn, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Z.jsx)(dn, { text: ze(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Z.jsx)(fn, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(mn, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => Le(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(G, {
							"aria-label": Y("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: q.readOnly,
							onChange: (t) => We.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Ge,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || q.readOnly,
							...K(q.busy),
							onClick: () => We.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ae,
							"aria-label": Y("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: q.readOnly,
							onClick: () => We.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [q]), $e = (0, X.useMemo)(() => {
		let e = sr[s];
		return e ? [{
			id: e,
			desc: c === "desc"
		}] : [];
	}, [s, c]), et = (0, X.useMemo)(() => Object.fromEntries([...v].map((e) => [String(e), !0])), [v]), tt = d === "table", nt = sn("follow-sources", dr), rt = bt(tt ? B.items.length : R.length, g, l), at = an({
		features: or,
		data: B.items,
		columns: Ze,
		getRowId: (e) => String(e.source.id),
		state: {
			sorting: $e,
			rowSelection: et,
			pagination: {
				pageIndex: rt.page - 1,
				pageSize: g
			},
			columnVisibility: nt.visibility
		},
		onColumnVisibilityChange: nt.change,
		manualSorting: !0,
		enableRowSelection: !0,
		onSortingChange: (e) => {
			let t = (typeof e == "function" ? e($e) : e)[0];
			if (!t) return;
			let n = p[t.id];
			n && ee(n, t.desc ? "desc" : "asc");
		},
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(et) : e;
			E(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		},
		onPaginationChange: (e) => {
			let t = {
				pageIndex: rt.page - 1,
				pageSize: g
			}, n = typeof e == "function" ? e(t) : e;
			n.pageSize === g ? n.pageIndex !== t.pageIndex && S(n.pageIndex + 1) : T(n.pageSize);
		}
	}), ot = at.getRowModel().rows, st = tt ? ot.map((e) => e.original.source.id) : R.slice(rt.start, rt.end).flatMap((e) => e.map((e) => e.id)), ct = Rt(v, st), lt = [...v], ut = Ne(U), ft = A.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), pt = Me(U), mt = R.length > 0 && N.size >= R.length;
	return A.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: je({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		onKeyDown: Je.onKeyDown,
		children: [
			Je.menu,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				ref: P,
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
						children: M.new ? Y("follow:sourceList.sourceCountUnseen", {
							count: A.length,
							unseen: Number(M.new) || 0
						}) : Y("follow:sourceList.sourceCount", { count: A.length })
					})]
				}), /* @__PURE__ */ (0, Z.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						ft.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							disabled: y,
							...K(q.busy),
							onClick: () => fe(ft),
							children: Y("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							leadingIcon: Ge,
							disabled: y,
							"aria-label": Y("follow:sourceList.checkAll"),
							iconOnly: ie,
							...K(q.busy),
							onClick: () => fe([]),
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
										leadingIcon: xe,
										"aria-label": F[0][1],
										"aria-pressed": !tt,
										onClick: () => C("default")
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: qe,
										"aria-label": F[1][1],
										"aria-pressed": tt,
										onClick: () => C("table")
									})]
								}),
								tt ? /* @__PURE__ */ (0, Z.jsx)(_e, {
									preferences: nt,
									label: Y("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Z.jsx)(le, {
										"aria-label": Y("follow:sourceList.sortLabel"),
										prefix: Y("follow:shared.sort"),
										selectedKey: s,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											ee(t, se[t]);
										},
										children: ce.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(ue, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: me,
										"data-icon-state": c === "asc" ? "a" : "b",
										"aria-label": Ut(s, c),
										onClick: () => ee(s, c === "asc" ? "desc" : "asc")
									})]
								}),
								tt ? null : /* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "secondary",
									iconOnly: ie,
									leadingIcon: _,
									"aria-expanded": !mt,
									"aria-label": Y(mt ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => re(mt ? /* @__PURE__ */ new Set() : new Set(R.map((e) => String(e[0].author_key || e[0].id)))),
									children: Y(mt ? "follow:shared.expandAll" : "follow:shared.collapseAll")
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
					oe ? /* @__PURE__ */ (0, Z.jsx)(be, {
						embedded: !0,
						kind: H?.older ? Te("feed-scrape") : Te("follow-check"),
						label: dt(H) || (H?.total ? Y(H.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: H.checked || 0,
							count: H.total
						}) : Y("follow:sourceList.preparingCheck")),
						value: H?.checked,
						total: H?.total
					}) : null,
					I ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:shared.actionFailed"),
						children: I
					}) : null,
					!oe && U?.results?.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "neutral",
						title: Y("follow:followFeed.checkResults"),
						children: Ie(U)
					}) : null,
					ut.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:sourceList.failedTitle", { count: ut.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ut.map((e, t) => /* @__PURE__ */ (0, Z.jsx)("li", { children: Y("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: Ye(e.error || "") || Y("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: Y("follow:sourceList.failedBody")
					}) : null,
					pt ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "warning",
						children: Y("follow:sourceList.evidenceGap", { error: pt })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(de, {
				label: Y("follow:sourceList.bulkActions"),
				visible: lt.length > 0,
				count: Y("follow:sourceList.selectedCount", { count: lt.length }),
				actions: [
					Pe(!0),
					Pe(!1),
					Re
				].map((e) => ({
					action: e,
					items: lt,
					host: Ae,
					disabled: y || Ee.isPending
				})),
				leading: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: y,
					...K(q.busy),
					onClick: () => fe(lt),
					children: Y("follow:sourceList.checkSelected")
				}),
				children: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: Xe,
					children: Y("follow:shared.clearSelection")
				})
			}),
			tt ? /* @__PURE__ */ (0, Z.jsx)(x, {
				follow: !0,
				preferences: nt,
				onRowClick: (e) => pe(Number(e), !v.has(Number(e))),
				children: /* @__PURE__ */ (0, Z.jsxs)(ge, {
					"aria-label": Y("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: $e[0] ? {
						column: $e[0].id,
						direction: $e[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => at.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [at.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = it(e.column.columnDef.header, e.getContext());
						return /* @__PURE__ */ (0, Z.jsx)(r, {
							id: e.id,
							allowsSorting: t,
							isRowHeader: e.column.id === "source",
							...nt.columnProps(e.id),
							children: ({ sortDirection: r }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [e.id === "select" ? n : t ? /* @__PURE__ */ (0, Z.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [B.header(e.id, ur[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Z.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": r || void 0,
									children: /* @__PURE__ */ (0, Z.jsx)(h, {})
								})]
							}) : B.header(e.id, ur[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Z.jsx)(ve, {
								preferences: nt,
								id: e.id
							})] })
						}, e.id);
					}), /* @__PURE__ */ (0, Z.jsx)(r, {
						id: "remaining-space",
						"aria-label": Y("follow:shared.rowSpacer"),
						"data-table-space": "",
						width: nt.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
						renderEmptyState: () => Y("follow:sourceList.pageEmpty"),
						children: ot.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							"data-work-context-row": e.original.source.id,
							onContextMenu: (t) => Je.onContextMenu?.(t, e.original.source, String(e.original.source.id)),
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: it(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(m, {
				isSelected: ct.all,
				isIndeterminate: ct.some,
				onChange: (e) => he(st, e),
				"aria-label": Y("follow:sourceList.selectPage"),
				children: Y("follow:sourceList.selectPageShort")
			}), /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex flex-col gap-3",
				children: R.slice(rt.start, rt.end).map((e) => {
					let t = String(e[0].author_key || e[0].id);
					return /* @__PURE__ */ (0, Z.jsx)(mr, {
						group: e,
						name: ke(e, j),
						handlers: q,
						selected: v,
						open: !N.has(t),
						onOpen: (e) => {
							let n = new Set(N);
							e ? n.delete(t) : n.add(t), re(n);
						},
						onToggleGroup: (t) => he(e.map((e) => e.id), t),
						onToggle: pe
					}, t);
				})
			})] }),
			/* @__PURE__ */ (0, Z.jsx)(b, {
				label: Y("follow:followManageNav.list"),
				total: rt.total,
				pagination: {
					pageIndex: rt.page - 1,
					pageSize: g
				},
				unit: Y(tt ? "follow:followOverview.sourceUnit" : "follow:sourceList.creatorUnit"),
				pageUnit: Y(tt ? "follow:followOverview.itemUnit" : "follow:followOverview.creatorUnit"),
				onChange: (e) => {
					e.pageSize === g ? at.setPageIndex(e.pageIndex) : at.setPageSize(e.pageSize);
				}
			}),
			M.new ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:sourceList.markSummary", {
							unwatched: Number(M.new) || 0,
							watched: Number(M.seen) || 0,
							saved: Number(M.saved) || 0,
							ignored: Number(M.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: k,
						children: Y("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = Be(e);
						return /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: y,
							...K(De.isPending),
							onClick: () => void Lt(t, [Number(M.new) || 0], Ae).catch(Ae.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Z.jsx)(w, {
		icon: f,
		title: Y("follow:sourceList.empty"),
		actions: /* @__PURE__ */ (0, Z.jsx)(u, {
			variant: "primary",
			size: "small",
			onClick: ne,
			children: Y("follow:followFeed.addFollow")
		}),
		children: Y("follow:sourceList.emptyHint")
	});
}
// node_modules/skullet/dist/index.mjs
var gr = "skullet-reveal", _r = "skullet-pane", vr = "skullet-loading", yr = "skullet-ghost", br = "skullet-snapshot", xr = "skullet-layer", Sr = "skullet-rect", Cr = "skullet-bar", wr = "skullet-inactive", Tr = "skullet-exiting", Er = "skullet-covered", Dr = "skullet-own", Or = "skullet-block", kr = Symbol.for("skullet.ghost"), Ar = Symbol.for("skullet.uncover"), jr = "skullet-status", Mr = "skullet-xray", Nr = "var(--skullet-base, rgb(128 128 128 / 0.2))", Pr = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", Fr = 280, Ir = 1e4, Lr = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, Rr = [
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
], zr = [
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
], Br = zr.join(", "), Vr = `
[${gr}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${_r}] {
  display: block;
}

[${vr}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${wr}] {
  display: none !important;
}

[${xr}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${Cr}] {
  display: block;
  background-color: ${Nr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${vr}]) to ([${Dr}], [${xr}]) {
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
  :scope :is(${Rr.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${Br}, [${Er}], [${Or}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${Nr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${Br}, [${Or}]):not(svg *) {
      visibility: visible !important;
      background: ${Nr} !important;
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
[${jr}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${Mr}] [${vr}] [${yr}],
[${Mr}] [${vr}] [${yr}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Hr = null, Ur = 0, Wr;
function Gr() {
	Ur++, !Hr && (Wr ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !Wr && (Hr = document.createElement("style"), Hr.dataset.skullet = "true", Hr.textContent = Vr, document.head.appendChild(Hr)));
}
function Kr() {
	Ur--, !(Ur > 0 || !Hr) && (Hr.remove(), Hr = null);
}
var qr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", Jr = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...Jr });
function Yr(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? Jr[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var Xr = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function Zr({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = Yr(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${Xr(o)} }`), a === "system") {
		let t = Yr({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${Xr(t)} } }`);
	}
	return s.join("\n");
}
var Qr = /* @__PURE__ */ new Map(), $r, ei = null, ti = 0;
function ni() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var ri = () => $r ??= typeof window < "u" && ni(), ii = (e) => ri() || !!e?.closest("[skullet-debug]");
function ai(e) {
	$r = e, e ? ui() : di();
}
function oi(e, t) {
	!e || !ii(e) || (Qr.set(e, {
		state: "loading",
		source: t
	}), ci());
}
function si(e, t) {
	!e || !ii(e) || (Qr.set(e, {
		...Qr.get(e),
		state: "shown",
		moved: t
	}), ci());
}
function ci() {
	ui(), cancelAnimationFrame(ti), pi();
}
var li = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function ui() {
	if (typeof document > "u") return;
	if (!ei?.isConnected) {
		ei = document.createElement("div"), ei.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = ei.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${li}</style><div class="boxes"></div>`, document.body.append(ei);
	}
	let e = ei.shadowRoot;
	if ($r && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(Mr, e.target.checked);
		}), e.append(t);
	}
	ti ||= requestAnimationFrame(pi);
}
function di() {
	ei?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(Mr), ![...Qr.keys()].some((e) => ii(e)) && (cancelAnimationFrame(ti), ti = 0, ei?.remove(), ei = null);
}
var fi = ({ state: e, source: t, moved: n }) => {
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
function pi() {
	if (ti = 0, !ei?.shadowRoot) return;
	let e = ei.shadowRoot.querySelector(".boxes");
	for (let e of Qr.keys()) e.isConnected && ii(e) || Qr.delete(e);
	let t = [...Qr];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = fi(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), ($r || Qr.size) && (ti = requestAnimationFrame(pi));
}
var mi, hi = () => mi ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), gi = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, _i = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], vi = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function yi(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function bi(e, t, n) {
	let r = gi(e, t), i = yi(n, t), a = e ? _i(e) : [], o = _i(t), s = _i(r).map((t, n) => vi(t, o[n]) ? i[n] : e && vi(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function xi(e, t, n, r) {
	if (!e) return n;
	let i = _i(e), a = _i(t).map((t, n) => e.corners[n] > 0 && vi(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = yi(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var Si = (e, t) => {
	let n = gi(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, Ci = {
	top: "ascender",
	bottom: "descender"
}, wi = /* @__PURE__ */ new Map(), Ti = (e) => [...e.getClientRects?.() ?? []];
function Ei(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (wi.has(t)) return wi.get(t);
	let n = hi(), r = null;
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
	return wi.set(t, r), r;
}
var Di = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, Oi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function ki(e, t, n) {
	let r = Ei(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = Oi(t, "--skullet-text-top", Object.keys(Di), Ci.top), a = Oi(t, "--skullet-text-bottom", ["baseline", "descender"], Ci.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[Di[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var Ai = new Set(zr), ji = new Set(Rr), Mi = .4, Ni = /[,/]\s*0\)$/, Pi = (e, t) => e !== "" && e !== t, Fi = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], Ii = (e) => Fi.every((t) => Pi(e[`border${t}Style`], "none") && Pi(e[`border${t}Width`], "0px")), Li = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, Ri = (e) => Pi(e, "none") && !e.split(/,(?![^(]*\))/).every(Li), zi = (e) => Pi(e.backgroundColor, "transparent") && !Ni.test(e.backgroundColor) || Pi(e.backgroundImage, "none") || Ri(e.boxShadow) || Ii(e), Bi = (e) => Ai.has(e.localName), Vi = (e) => ji.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), Hi = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(Ti(n).filter((e) => e.width || e.height));
		} else Vi(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * Mi, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, Ui = (e, t) => e.hasAttribute("skullet-block") || Bi(e) || zi(t) && Hi(e) <= 1;
function Wi(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function Gi(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * Mi;
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
function Ki(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = Si(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...ki(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of Ti(d)) f(e, r, t);
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
			if (Ui(e, r)) {
				let n = Si(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: xi(t, n, Wi(e, r), r)
					});
				}
				Bi(e) || u.add(e);
				continue;
			}
			if (Vi(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? bi(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...Gi(l)];
	for (let t of e.querySelectorAll(`[${Er}]`)) u.has(t) || t.removeAttribute(Er);
	for (let e of u) e.hasAttribute(Er) || e.setAttribute(Er, "");
	return [...c, ...Gi(l)];
}
var qi = (e) => typeof matchMedia < "u" && matchMedia(e).matches, Ji = () => typeof Element < "u" && typeof Element.prototype.animate == "function", Yi = () => !Ji() || qi("(prefers-reduced-motion: reduce)"), Xi = () => qi("(prefers-reduced-transparency: reduce)"), Zi = (e) => e.getAnimations?.() ?? [], Qi = .7, $i = 1280, ea = 320, ta = 2.5, na = .45, ra = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function ia(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", ra, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Lr[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var aa = 20, oa = Math.sin(aa * Math.PI / 180), sa = Math.cos(aa * Math.PI / 180), ca = oa / sa, la = sa, ua = `${90 + aa}deg`, da = .85, $ = 12, fa = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function pa(e) {
	let t = e * ta, n = (t, n) => `color-mix(in srgb, ${Pr} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * da, fa(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(da + e / $ * (1 - da), fa(1 - e / $)));
	return {
		width: t / sa,
		image: `repeating-linear-gradient(${ua}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function ma(e, t, n = ia(e)) {
	for (let t of Zi(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", Yi() || typeof e.animate != "function" || n.animation === "none") return;
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
				opacity: na,
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
	}, { width: s, image: c } = pa(Math.min(Math.max(o.width * .4, 80), ea)), l = a - o.left + (i.top - o.top) * ca, u = n.duration * Qi / ($i + ea);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function ha(e) {
	if (Yi()) return null;
	let t = ia(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * Qi / ($i + ea);
}
var ga = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), _a = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function va(e, t) {
	let n = ga(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = ia(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${Nr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, ma(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var ya = 120, ba = 72, xa = 3, Sa = 60, Ca = 150, wa = 400, Ta = 1.5, Ea = 1e3, Da = 1e3, Oa = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), ka = -1 / 0, Aa = !1;
function ja() {
	if (!(Aa || typeof addEventListener > "u")) {
		Aa = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => ka = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var Ma = /* @__PURE__ */ new WeakMap();
function Na(e, { served: t, refetch: n }) {
	ja();
	let r = Ma.get(e)?.since ?? performance.now();
	Ma.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function Pa(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function Fa(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var Ia = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function La(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${Tr}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var Ra = (e, t) => Math.min(Math.max(e, 0), t), za = -1 / 0;
function Ba(e, t, n, r, i) {
	let a = performance.now();
	a - za > Ca && (za = a);
	let o = a - za, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of Pa(e)) {
		let n = Fa(t, e), r = c.get(n);
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
		return t === null ? null : Ra(t, Ea) + Math.max(r.delay ?? 0, 0);
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
			let t = [...c.values()].find((t) => Ia(t.rect, e));
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
function Va(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) Oa.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function Ha(e, t, n, r = () => {}) {
	let i = Ma.get(t);
	Ma.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - ka < wa,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: Pa(e).length
			})
		};
	}
	let o = Ra(a.duration ?? 200, Da);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, Ea)
	}, !o) return { kind: "instant" };
	let s = Va(a.enter, r);
	if (a.wipe) {
		let e = La(t);
		if (e.width * e.height <= innerWidth * innerHeight * Ta) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return Ba(e, t, a.order, {
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
var Ua = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return Ra(n * .8 + r * .2, 1) * 320;
}, Wa = (e) => e.bottom > 0 && e.top < innerHeight, Ga = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return Wa(e) ? 0 : null;
	if (!Wa(t)) return null;
	let i = Ra(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? Sa : 0);
}, Ka = { duration: 0 }, qa = { order: "together" }, Ja = { order: Ua }, Ya = (e) => e.input || e.waited < 150 ? Ka : e.refetch ? {
	order: "together",
	duration: ya
} : null, Xa = (e) => e.height < ba || e.pieces <= xa ? qa : { order: Ga }, Za = {
	hold: 150,
	choose: (e) => Ya(e) ?? Xa(e)
}, Qa = new Set(zr), $a = "script, noscript, template, base, meta, link", eo = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), to = /* @__PURE__ */ new Set([
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
	Er
]), no = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function ro(e, t) {
	let n = no(t.data);
	t.data = n;
	let r = e.parentElement, i = hi();
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
function io(e) {
	for (let t of e.querySelectorAll($a)) t.remove();
	for (let t of e.querySelectorAll("*")) if (eo.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || to.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function ao(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (Qa.has(e.localName) || eo.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) ro(e, t);
	return io(n), n.innerHTML;
}
function oo(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, io(t.content), t.content;
}
var so = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${so(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), co = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function lo(e) {
	let t = so(e, 2);
	return t ? `${location.pathname}|${co(t)}` : null;
}
var uo = !1;
try {
	uo = !1;
} catch {
	uo = !1;
}
var fo = uo, po = /* @__PURE__ */ new Set();
function mo(e, t) {
	!fo || po.has(e) || (po.add(e), console.warn(`[skullet] ${t}`));
}
var ho = /^(https?:|\/|data:|blob:)/;
function go(e) {
	return typeof e == "string" ? ho.test(e) ? "" : no(e) : Array.isArray(e) ? e.map(go) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, go(t)])) : e;
}
var _o = "skullet:shapes", vo = 2, yo = 50, bo = 2e4, xo = /* @__PURE__ */ new Map(), So = /* @__PURE__ */ new Map();
function Co(e, t) {
	return So.has(e) || So.set(e, /* @__PURE__ */ new Set()), So.get(e).add(t), () => So.get(e)?.delete(t);
}
function wo(e) {
	for (let t of So.get(e) ?? []) t();
}
function To() {
	try {
		let e = JSON.parse(localStorage.getItem(_o) ?? "null");
		return e?.v === vo ? e.shapes : {};
	} catch {
		return {};
	}
}
function Eo(e) {
	try {
		localStorage.setItem(_o, JSON.stringify({
			v: vo,
			shapes: e
		}));
	} catch {}
}
function Do(e, t) {
	xo.set(e, ao(t, !1));
	let n = ao(t, !0);
	if (n.length > bo) return;
	let r = To();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - yo)) delete r[e];
	Eo(r);
}
function Oo(e) {
	return xo.get(e) ?? To()[e] ?? null;
}
var ko = [
	100,
	90,
	60
].map((e) => `<div ${Or} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), Ao = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${vr}]`)), jo = /* @__PURE__ */ new WeakMap();
function Mo(e) {
	if (!e) return;
	let t = jo.get(e);
	return jo.delete(e), t;
}
function No(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var Po = (e) => !!e.firstElementChild || !!e.textContent?.trim(), Fo = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, Gr(), e[kr] = !0, e.setAttribute(vr, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = No(e, yr), this.snapshot = No(e, br), this.layer = No(e, xr), this.hadContent = Po(this.ghost);
		let n = e.closest(`[${gr}]`);
		n && Na(n, {
			served: Ao.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[Ar]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
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
		this.root.closest(`[${Tr}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = Po(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || Ao.has(this.root), r = !!this.ghost.querySelector(`[${Dr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? lo(this.ghost);
			n && (wo(n), t = Oo(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(oo(t)) : e === "fallback" ? (this.snapshot.innerHTML = ko, mo(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(wr, e !== "ghost"), this.snapshot.toggleAttribute(wr, e === "ghost"), this.source = e, oi(this.root.closest(`[${gr}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : Ao.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		va(this.layer, Ki(e, this.layer));
		let t = this.root.closest(`[${gr}]`);
		t && jo.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), Kr();
	}
}, Io = 250, Lo = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? lo(e), this.untrack = this.key ? Co(this.key, () => this.save()) : () => {}, (fo || ii(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
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
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), Io);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && Do(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${gr}]`), o = Mo(a);
		if (!o) return;
		o.guessed && n && !r && e != null && mo(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify(go(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (si(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? mo(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : mo(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, Ro = () => {}, zo = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, Bo = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !zo(e));
function Vo(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(Ro, Ro), new Promise((e) => setTimeout(e, Ir))]);
}
var Ho = 360, Uo = 2, Wo = 600, Go = 40, Ko = Go / la, qo = 320, Jo = 120, Yo = .45, Xo = (e) => e.left + e.top * ca, Zo = (e) => e.width + e.height * ca, Qo = (e, t) => Xo(t) - Ko + (Zo(t) + 2 * Ko) * e, $o = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function es(e) {
	let t = e.querySelector(`:scope > [${Tr}] [${xr}]`), n = t && ha(t);
	if (!n) return null;
	let r = La(e);
	if (r.width * r.height > innerWidth * innerHeight * Ta) return null;
	let i = Xo(r), a = i + Zo(r), o = performance.now(), s = o - $o.start;
	s <= Ca && (i - $o.origin) / $o.speed >= s && (a - $o.origin) / $o.speed - s <= Wo || ($o = {
		start: o,
		origin: i,
		speed: Math.max(Uo / n, (a - i) / Ho)
	});
	let { start: c, origin: l, speed: u } = $o;
	return {
		delay: (i - Ko - l) / u - (o - c),
		duration: (a - i + 2 * Ko) / u
	};
}
var ts = (e) => (t, { rect: n, reveal: r }) => {
	let i = (Qo(t, r) - Xo(n)) * la;
	return `linear-gradient(${ua}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - fa(n / $) : fa(n / $), a = -Go + 2 * Go * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, ns = "http://www.w3.org/2000/svg", rs = null, is = 0;
function as() {
	return rs?.isConnected || (rs = document.createElementNS(ns, "svg"), rs.setAttribute("aria-hidden", "true"), rs.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(rs)), rs;
}
var os = (e, t) => {
	let n = document.createElementNS(ns, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, ss = {
	mask: ts(!0),
	out: ts(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (Xi()) return;
		let i = Xo(t), a = Zo(t), o = qo / 2 / la, s = () => Qo(r(), n) - i - Jo / la;
		if (s() - o > a) return;
		let c = 2 * o + t.height * ca, l = c / 2, u = t.height / 2, d = qo / 2 * la, f = qo / 2 * ca * la, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${fa(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++is}`, _ = os("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = os("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(os(`feFunc${e}`, {
			type: "linear",
			slope: 1 - Yo,
			intercept: Yo
		}));
		let y = os("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, os("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), os("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), as().append(_), e.style.filter = `url(#${g})`;
		let ee = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * ca) / t.width).toFixed(4)), requestAnimationFrame(ee));
		};
		ee();
	}
}, cs = {
	together: qa,
	sequence: Ja,
	smart: Za,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = Ya(e);
			if (t) return t;
			let n = es(e.reveal);
			return n ? {
				wipe: ss,
				...n
			} : Xa(e);
		}
	}
}, ls = (e = "smart") => typeof e == "string" ? cs[e] : e, us = () => {}, ds = (e) => e.finished.then(us, us), fs = /* @__PURE__ */ new WeakMap();
function ps(e, t = 0, n = 200, r = 0, i) {
	return Yi() ? Promise.resolve() : ds(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var ms = (e) => !!e.querySelector(`[${xr}], [${yr}], :scope > [${Dr}]`), hs = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, gs = /* @__PURE__ */ new WeakMap();
function _s(e) {
	for (let t of gs.get(e) ?? []) t.remove();
	gs.delete(e);
}
function vs(e, t) {
	let n = Bo(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && ms(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${Tr}] [${xr}]`)].flatMap(_a), a = gs.get(t) ?? /* @__PURE__ */ new Set();
			gs.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => hs(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(Sr, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: Nr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), ma(c), Vo(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", ps(e), Yi()) return c.remove();
						ds(c.animate([{ opacity: 1 }, { opacity: 0 }], {
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
function ys(e, t) {
	return Yi() ? Promise.resolve() : Promise.all(Pa(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return ps(e, n, t.duration, 0, t.enter);
	})).then(us);
}
function bs(e) {
	for (let t of e.querySelectorAll(`:scope > [${Tr}]`)) {
		for (let e of Zi(t)) e.finish();
		t.style.opacity = "0";
	}
}
function xs(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${Tr}]`)) if (!ms(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of Zi(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function Ss(e, t = "smart", { initial: n = !1 } = {}) {
	let r = Cs.get(e);
	return r || (r = ws(e, t, n), Cs.set(e, r)), r;
}
var Cs = /* @__PURE__ */ new WeakMap();
function ws(e, t, n) {
	let r = e.parentElement, i = ls(t);
	if (ms(e)) {
		r && _s(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && fs.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : ps(e, t)) : (r && fs.delete(r), n ? Promise.resolve() : ps(e));
	}
	if (n || !r) return Promise.resolve();
	let a = xs(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return fs.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), ps(e, 0, t, a);
	}
	vs(e, r);
	let o = Ha(e, r, i, (e) => mo(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return fs.set(r, o), o.kind === "instant" ? (bs(r), Promise.resolve()) : o.kind === "sequence" ? ys(e, o) : o.kind === "wipe" ? Ls(e, o, !0) : ps(e, o.delay, o.duration, 0, o.enter);
}
function Ts(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function Es(e, t = Ts(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(Tr, ""), t;
}
var Ds = /* @__PURE__ */ new WeakMap();
function Os(e, t) {
	let n = e.querySelector(`:scope > [${_r}]:not([${Tr}])`);
	if (!n) return;
	let r = Ds.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && ks(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: Fr,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	Ds.set(e, u), ds(l).then(() => {
		Ds.get(e) === u && ks(e, u);
	});
}
function ks(e, { overflow: t, boxSizing: n }) {
	Ds.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function As(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of Zi(e)) t.cancel();
	Is(e), e.style.filter = "";
	let i = e.parentElement;
	i && !ms(e) && _s(i);
	let a = Es(e, t), o = (t, n) => Ji() ? ds(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && fs.get(i), n = Yi() || t?.kind === "instant";
		if (i && !n && Os(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && ms(e) ? js(e, t) : t?.kind === "wipe" && ms(e) ? Ls(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function js(e, t) {
	for (let t of e.querySelectorAll(`[${yr}], [${br}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${yr}] [${Dr}]`)].filter((e) => !e.parentElement?.closest(`[${Dr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${xr}]`)].flatMap(_a), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => ds(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(us);
}
var Ms = 100, Ns = /* @__PURE__ */ new WeakMap();
function Ps(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function Fs(e, t) {
	Ps(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function Is(e) {
	Ns.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function Ls(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? Ps(e, i(t, r)) : a ? Ps(e, a(t, r)) : Fs(e, i(t, r));
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
			if (e - i > Ms && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), Ns.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + Ms);
		Ns.set(e, l), c();
	}).then((t) => {
		if (Is(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? ps(e, 0, r, t) : ds(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var Rs = X.createContext({}), zs = X.createContext(null), Bs = () => X.useContext(Rs), Vs = () => X.useContext(zs), Hs = () => Bs().reveal;
function Us({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = Zr({
		theme: r,
		mode: i,
		text: a
	}), [c] = X.useState(() => ({ sent: !1 }));
	return X.useEffect(() => {
		n !== void 0 && ai(n);
	}, [n]), (0, Z.jsx)(Rs.Provider, {
		value: t,
		children: (0, Z.jsxs)(zs.Provider, {
			value: c,
			children: [s && (0, Z.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var Ws = typeof window > "u" ? X.useEffect : X.useLayoutEffect, Gs = () => X.useInsertionEffect(() => (Gr(), Kr), []), Ks = Number("19.3.1".split(".")[0]) >= 19, qs = () => {
	let { nonce: e } = Bs();
	return Ks ? (0, Z.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: Vr
	}) : null;
}, Js = Ks ? { inert: !0 } : { inert: "" }, Ys = (e) => X.Children.map(e, (e) => {
	if (!X.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Z.jsx)("span", {
		[Dr]: "",
		children: (0, Z.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? X.cloneElement(e, void 0, Ys(e.props.children)) : e;
}), Xs = () => () => {}, Zs = () => X.useSyncExternalStore(Xs, () => !1, () => !0), Qs = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = X.useRef(null), { nonce: o } = Bs(), s = Vs(), c = Zs(), l = qr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), Ws(() => {
		if (!a.current) return;
		let e = new Fo(a.current, {
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
			[vr]: "",
			"aria-hidden": !0,
			...Js,
			children: [
				(0, Z.jsx)("div", {
					[yr]: "",
					children: Ys(e)
				}),
				(0, Z.jsx)("div", { [br]: "" }),
				(0, Z.jsx)("div", { [xr]: "" })
			]
		}),
		c && (0, Z.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, $s = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = X.useRef(null), l = Hs();
	return Ws(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), Ss(c.current, l, { initial: !r }).then(s), o && (e.memory = new Lo(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), Ws(() => {
		!i || !c.current || As(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Z.jsx)("div", {
		ref: c,
		[_r]: "",
		children: e
	});
}, ec = class extends X.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = Ts(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function tc(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	Gs();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = X.useRef(null);
	Ws(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Z.jsx)("div", {
			[Dr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Z.jsx)(Qs, {
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
	if (Ws(() => {
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
	Ws(() => {
		w.current = e.onReveal;
	});
	let T = y.key === "content" && y.from === "skeleton" ? () => w.current?.() : void 0, E = (e) => x((t) => t.filter((t) => t.id !== e)), te = [...b.map((e) => (0, Z.jsx)($s, {
		id: e.id,
		registry: S,
		enter: !1,
		exiting: !0,
		onExited: () => E(e.id),
		children: e.node
	}, e.id)), (0, Z.jsx)($s, {
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
		[gr]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Z.jsx)(qs, {}), (0, Z.jsx)(ec, {
			exiting: b.map((e) => e.id),
			registry: S,
			children: te
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var nc = {
	creators: [Y("follow:followOverview.creators"), Y("follow:followOverview.creatorUnit")],
	enabled: [Y("follow:followOverview.enabledSources"), ""],
	failed: [Y("follow:followCheck.checkFailed"), Y("follow:followOverview.sourceUnit")],
	updates: [Y("follow:followOverview.unwatchedUpdates"), Y("follow:followOverview.itemUnit")],
	subscriptions: [Y("follow:feedSources.footerLabel"), Y("follow:followOverview.actressUnit")],
	releases: [Y("follow:followOverview.unwatchedReleases"), Y("follow:followOverview.itemUnit")]
}, rc = {
	duration: 0,
	delay: 0,
	hold: 150
}, ic;
function ac() {
	return ic || (ic = new CSSStyleSheet(), ic.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), ic;
}
function oc({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Z.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Z.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function sc({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = nc[e], o = (0, X.useRef)(null);
	return (0, X.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = ac();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Z.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: je({
			padding: "none",
			className: "flex flex-col justify-between gap-3 px-6 py-5 max-sm:gap-2 max-sm:p-4"
		}),
		children: [/* @__PURE__ */ (0, Z.jsx)("span", {
			className: "text-body-medium text-text-secondary",
			children: i
		}), t === void 0 && r ? /* @__PURE__ */ (0, Z.jsx)("b", {
			"data-follow-reading": "",
			className: "text-title-1-medium text-text-primary",
			children: Y("follow:shared.notFound")
		}) : /* @__PURE__ */ (0, Z.jsx)(Us, {
			reveal: rc,
			children: /* @__PURE__ */ (0, Z.jsx)(tc, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: Y("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Z.jsx)(oc, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var cc = (e) => A.some(([t]) => t === e);
function lc(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, X.useState)(cc(e.tab) ? e.tab : "list"), [u, f] = (0, X.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, X.useState)(() => Mt(e.sort, e.dir).sort), [h, g] = (0, X.useState)(() => Mt(e.sort, e.dir).dir), [_, v] = (0, X.useState)(ut(e.layout) ? e.layout : "default"), [y, ee] = (0, X.useState)(yt(e.pageSize)), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, X.useState)(/* @__PURE__ */ new Set());
	tn(() => {
		x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set());
	}), (0, X.useEffect)(() => {
		(b.size || S.size) && Je();
	}, [b, S]);
	let w = nn({
		queryKey: ne,
		queryFn: ({ signal: e }) => tt(e)
	}), T = nn({
		queryKey: k,
		queryFn: ({ signal: e }) => $e(e)
	}), D = nn({
		queryKey: te,
		queryFn: ({ signal: e }) => et(e)
	}), O = w.data || { sources: [] }, j = T.data || {
		root: "",
		providers: []
	}, M = O.sources;
	(0, X.useEffect)(() => {
		x((e) => {
			let t = pt(e, M);
			return t.size === e.size ? e : t;
		});
	}, [M]);
	let N = (e) => {
		let n = e.sort ?? p, r = e.dir ?? h;
		t({
			tab: e.tab ?? c,
			page: e.page ?? u,
			sort: n === "checked" ? "" : n,
			dir: r === se[n] ? "" : r
		});
	}, re = ct(M), P = M.filter(lt).length, ie = M.filter((e) => e.enabled).length, F = (j.providers || []).filter((e) => e.requirement === "required" && !We(e)).length, I = new Set((D.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Z.jsxs)(ln, { children: [
		a ? /* @__PURE__ */ (0, Z.jsx)(V, {
			tone: "warning",
			title: Y("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Z.jsx)(E, {
					href: s,
					children: Y("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: U,
			"aria-label": Y("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "creators",
					figure: w.data ? re.length : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "enabled",
					figure: w.data ? ie : void 0,
					total: M.length,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "failed",
					figure: w.data ? P : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "updates",
					figure: w.data ? O.counts?.new || 0 : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "subscriptions",
					figure: D.data ? I : void 0,
					failed: D.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(sc, {
					field: "releases",
					figure: D.data ? D.data.unread || 0 : void 0,
					failed: D.isError
				})
			]
		}),
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: "flex flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, Z.jsx)("div", {
					"data-section-nav": !0,
					children: /* @__PURE__ */ (0, Z.jsx)(he, {
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
							x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set()), l(e), N({ tab: e });
						}
					})
				}),
				c === "list" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-list",
					"aria-labelledby": "follow-tab-list",
					className: "flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, Z.jsx)(ar, {
						readOnly: a,
						toast: r,
						onAdd: () => {
							l("add"), N({ tab: "add" });
						},
						selection: {
							ids: S,
							onChange: C,
							onActivate: () => x(/* @__PURE__ */ new Set())
						}
					}), w.data ? /* @__PURE__ */ (0, Z.jsx)(hr, {
						data: O,
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
							l("add"), N({ tab: "add" });
						},
						onSort: (e, t) => {
							m(e), g(t), f(1), N({
								sort: e,
								dir: t,
								page: 1
							});
						},
						onPage: (e) => {
							f(e), N({ page: e });
						},
						onSelected: (e) => {
							x(e), C(/* @__PURE__ */ new Set());
						},
						onLayout: (e) => {
							v(e), f(1), n({ layout: e }), N({ page: 1 });
						},
						onPageSize: (e) => {
							ee(e), f(1), n({ pageSize: e }), N({ page: 1 });
						}
					}) : w.isError ? /* @__PURE__ */ (0, Z.jsx)(V, {
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
						T.data && w.data ? /* @__PURE__ */ (0, Z.jsx)(kn, {
							data: O,
							credentials: j,
							readOnly: a,
							toast: r
						}) : T.isError || w.isError ? /* @__PURE__ */ (0, Z.jsx)(V, {
							tone: "error",
							children: Y("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Z.jsx)("div", {
							role: "status",
							"aria-label": Y("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Z.jsx)(Pn, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								D.refetch(), l("list"), N({ tab: "list" });
							}
						}),
						w.data ? /* @__PURE__ */ (0, Z.jsx)(qn, {
							groups: O.author_aliases || [],
							readOnly: a,
							toast: r,
							suggestions: O.alias_suggestions || [],
							sources: O.sources
						}) : null
					]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, Z.jsx)("div", { children: /* @__PURE__ */ (0, Z.jsx)(d, {
			variant: "secondary",
			href: "/settings/subscriptions",
			children: F ? Y("follow:followManagePage.feedSettingsPending", { count: F }) : Y("follow:followManagePage.feedSettings")
		}) })
	] });
}
export { lc as FollowManagePage };

//# debugId=974081b4-7a83-457d-a6d6-e1ff2355532a