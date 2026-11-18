(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "648b152f-801d-4a50-8d98-66219538f118", e._sentryDebugIdIdentifier = "sentry-dbid-648b152f-801d-4a50-8d98-66219538f118");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, ColumnFilterAvatar as y, ColumnFilterChips as b, Ct as x, DataTableFooter as S, DataTableFrame as C, DataTableSort as w, EmptyFocusButton as T, EmptyState as E, ErrorText as D, ExternalLink as O, FEEDS_KEY as ee, FOLLOW_CHECK_KEY as k, FOLLOW_CHECK_TASK as A, FOLLOW_CREDENTIALS_KEY as te, FOLLOW_MANAGE_KEY as ne, FOLLOW_MANAGE_NAV as j, FOLLOW_RESOLVE_KEY as M, FieldLabel as N, Gg as re, H7 as P, Help as F, Input as ie, LAYOUTS as I, LEGACY_AVATAR_IMG as ae, M6 as oe, MENU_ITEM as L, MENU_ITEM_INTERACTIVE as R, MENU_POPOVER_SURFACE as z, ModalFrame as B, Note as V, OV as H, P7 as U, SORT_DEFAULT_DIR as se, SORT_OPTIONS as ce, STAT_STRIP_SIX as le, Select as W, SelectItem as ue, SelectionDock as de, SelectionPopover as fe, SiteIcon as pe, SiteLabel as me, SortDirectionIcon as he, SortableBoardTabs as G, Switch as ge, Table as _e, TableColumnControls as ve, TableColumnResizer as ye, TableSelectionHeader as be, TaskProgress as xe, Un as Se, Wt as Ce, Xf as we, __toESM as Te, activityKind as Ee, addAlias as De, addSource as Oe, authorGroups as ke, authorName as Ae, avatarInner as je, busyProps as K, cardClass as Me, checkEvidenceGap as Ne, checkFailures as Pe, checkFeeds as Fe, checkReceipt as Ie, checkSummary as Le, checkedText as Re, clickedBlank as ze, codedText as Be, columnVisibilityFeature as Ve, composingKey as He, confirmModal as Ue, createColumnHelper as We, credentialDone as Ge, cx as Ke, dZ as qe, dropSources as Je, du as Ye, enterPageSelection as q, errorHeadline as Xe, errorMessage as J, exitPageSelection as Ze, feedIntervalText as Qe, fetchCheckJob as $e, fetchCredentials as et, fetchFeeds as tt, fetchFollow as nt, fetchResolveJob as rt, fetchSuggestions as it, flexRender as at, followFeedByName as ot, followFeedEntity as st, followSuggestKey as ct, groupByAuthor as lt, isBroken as ut, isLayout as dt, jobText as ft, joinList as pt, keepSelected as mt, l7 as ht, localTime as gt, lookupFeedActor as _t, mapLimit as vt, markAllPending as yt, pageSizeOf as bt, pageWindow as xt, patchSource as St, pv as Ct, queryClient as wt, quoted as Tt, reloadFollowManage as Et, removeAlias as Dt, removeFeed as Ot, removeSource as kt, renameAliasGroup as At, require_jsx_runtime as jt, require_react as Mt, resolveFollowSort as Nt, rowPaginationFeature as Pt, rowSelectionFeature as Ft, rowSelectionOperation as It, rowSortingFeature as Lt, runBulkAction as Rt, selectionState as zt, serverLabel as Bt, setFeedEnabled as Vt, setSourceEnabled as Ht, skeletonHtml as Ut, sortLabel as Wt, startCheck as Gt, startResolve as Kt, statusText as qt, t as Y, tableFeatures as Jt, tableRows as Yt, th as Xt, toggleGroup as Zt, unmarkItems as Qt, useAction as $t, useBackgroundJob as en, useMutation as tn, usePageSelection as nn, useQuery as rn, useRowWorkContext as an, useTable as on, useTableFilters as sn, useTablePreferences as cn, useWorkContextMenu as ln, utcDate as un } from "./peach-app.js";
import { Page as dn } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as fn, ErrorLine as pn, SourceIcon as mn, SourceLink as hn, StatusBadge as gn } from "./peach-app.source-view-CDbKpFus.js";
import { createPaginatedRowModel as _n, createSortedRowModel as vn, useTableSelection as yn } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/follow-manage/add-source.tsx
var X = /* @__PURE__ */ Te(Mt(), 1), Z = jt(), bn = Ke(L, R, "text-body-2-medium"), xn = Y("follow:addCreatorSource.placeholder"), Sn = Y("follow:addCreatorSource.title"), Cn = Y("follow:addCreatorSource.searchingByName"), wn = Y("follow:addCreatorSource.recognizing"), Tn = Y("follow:addCreatorSource.noSourceFound"), En = "/settings/subscriptions", Dn = (e, t) => `${e}:${t.url}`;
function On({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
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
		className: Ke(z, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
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
			className: t === i ? Ke(bn, "bg-background-secondary-default") : bn,
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
function kn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? Y("follow:addCreatorSource.allSources") : Y("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Z.jsx)(fe, {
		label: Y("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: Y("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Z.jsx)(mn, { provider: e.provider }), e.provider_label]
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
				href: En
			}
		]
	});
}
function An({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Z.jsx)(V, {
		tone: "error",
		title: e.line,
		children: ft(e, "error") || Y("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Me({
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
				let n = Dn(t, e);
				return /* @__PURE__ */ (0, Z.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(mn, { provider: e.provider }),
							/* @__PURE__ */ (0, Z.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "min-w-0 break-words",
								children: Be(e, "label")
							}),
							/* @__PURE__ */ (0, Z.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? Y("follow:addCreatorSource.alreadyFollowing") : Be(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Z.jsx)(F, { children: Tn }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: Be(e, "evidence")
				}), /* @__PURE__ */ (0, Z.jsx)(O, {
					href: e.url,
					children: Y("follow:shared.labeled", {
						label: Be(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Z.jsx)(F, { children: pt(o.map(([t, n]) => Y("follow:shared.labeled", {
				label: t,
				value: Bt(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function jn({ data: e, credentials: t, readOnly: n, toast: r }) {
	let [i, a] = (0, X.useState)(""), [o, s] = (0, X.useState)(!1), [c, l] = (0, X.useState)(""), [d, f] = (0, X.useState)(""), [p, m] = (0, X.useState)(!1), [h, g] = (0, X.useState)(null), [_, v] = (0, X.useState)(-1), y = (0, X.useRef)(null), b = (0, X.useRef)(null), [x, S] = (0, X.useState)(/* @__PURE__ */ new Set()), [C, w] = (0, X.useState)(/* @__PURE__ */ new Set()), [T, E] = (0, X.useState)(""), [D, O] = (0, X.useState)(0);
	(0, X.useEffect)(() => {
		let e = i.trim();
		if (o || !e || e.includes("/")) {
			f("");
			return;
		}
		let t = setTimeout(() => f(e), 250);
		return () => clearTimeout(t);
	}, [i, o]);
	let ee = rn({
		queryKey: ct(d),
		queryFn: ({ signal: e }) => it(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), k = (0, X.useMemo)(() => (ee.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: Bt(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: Bt(e.label_code ?? "", e.label)
	}))), [ee.data]), { job: A, running: te, outcome: ne, start: j, dismiss: re } = en({
		queryKey: M,
		queryFn: ({ signal: e }) => rt(e),
		start: (e) => Kt([e]),
		onStarted: () => w(/* @__PURE__ */ new Set()),
		onError: (e) => E(J(e)),
		onFinish: (e) => {
			e.status === "failed" && E(ft(e, "error") || Y("follow:addCreatorSource.searchFailed"));
		}
	}), P = (e) => {
		let t = e.trim();
		!t || n || o || te || j.isPending || (E(""), v(-1), l(t), a(t), f(""), g(t), j.mutate(t));
	}, F = ee.isFetching, I = p && !o && h !== i && (k.length > 0 || F), ae = () => {
		v(-1), g(i);
	}, oe = (e) => {
		if (!(o || He(e.nativeEvent))) {
			if (e.key === "Escape" && I) ae();
			else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!k.length) return;
				if (e.preventDefault(), !I) {
					g(null);
					return;
				}
				let t = e.key === "ArrowDown" ? 1 : -1;
				v((e) => {
					let n = e + t;
					return n < 0 ? k.length - 1 : n >= k.length ? 0 : n;
				});
			} else e.key === "Enter" && (e.preventDefault(), P(k[_]?.value || i));
		}
	}, L = ne?.results || [], R = L.flatMap((e, t) => (e.candidates || []).filter((e) => !e.known && !x.has(e.provider_label || "")).map((e) => ({
		candidate: e,
		key: Dn(t, e)
	})).filter((e) => !C.has(e.key))), z = tn({
		mutationFn: async (e) => {
			let t = [], n = [];
			O(0);
			for (let r of e) {
				try {
					let e = await Oe(r.candidate);
					n.push(e.source);
				} catch (e) {
					t.push(Y("follow:shared.labeled", {
						label: r.candidate.label,
						value: J(e)
					}));
				}
				O((e) => e + 1);
			}
			if (n.length) try {
				await Gt(n);
			} catch (e) {
				t.push(J(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			Et(), e.failures.length ? E(pt(e.failures)) : (E(""), re(), r(Y("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => E(J(e))
	}), B = e.suggestions || [], H = !c.includes("/");
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Sn,
		className: Me({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: Sn
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
							!e.currentTarget.contains(t) && !b.current?.contains(t) && m(!1);
						},
						children: [/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:addCreatorSource.inputLabel"),
							placeholder: xn,
							value: i,
							leadingIcon: Ct,
							enterKeyHint: "search",
							isDisabled: n,
							onChange: a,
							onCompositionStart: () => {
								s(!0), v(-1);
							},
							onCompositionEnd: (e) => {
								s(!1), a(e.currentTarget.value);
							},
							onKeyDown: oe
						}), I ? /* @__PURE__ */ (0, Z.jsx)(On, {
							field: y,
							menu: b,
							options: k,
							active: _,
							busy: F,
							onPick: P,
							onClose: ae
						}) : null]
					}),
					/* @__PURE__ */ (0, Z.jsx)(kn, {
						credentials: t,
						hidden: x,
						onHidden: S
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...K(te || j.isPending),
						onClick: () => P(i),
						children: Y("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [te || j.isPending ? /* @__PURE__ */ (0, Z.jsx)(xe, {
					embedded: !0,
					kind: Ee("follow-resolve"),
					label: ft(A) || (A?.total ? Y("follow:addCreatorSource.searchProgress", {
						checked: A.checked || 0,
						count: A.total
					}) : H ? Cn : wn),
					value: A?.checked,
					total: A?.total
				}) : null, T ? /* @__PURE__ */ (0, Z.jsx)(V, {
					tone: "error",
					title: Y("follow:addJavFeed.notCompleted"),
					children: T
				}) : null]
			}),
			L.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:addCreatorSource.results") }),
					L.map((e, t) => /* @__PURE__ */ (0, Z.jsx)(An, {
						row: e,
						at: t,
						hidden: x,
						unpicked: C,
						onPick: (e, t) => {
							let n = new Set(C);
							t ? n.delete(e) : n.add(e), w(n);
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
								disabled: n || !R.length,
								...K(z.isPending),
								onClick: () => z.mutate(R),
								children: Y("follow:addCreatorSource.addSelected", { count: R.length })
							}),
							z.isPending ? /* @__PURE__ */ (0, Z.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:addCreatorSource.addingProgress", {
									added: D,
									count: R.length
								})
							}) : null
						]
					})
				]
			}) : null,
			B.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: Y("follow:addCreatorSource.suggested")
				}), B.map((e) => /* @__PURE__ */ (0, Z.jsx)(u, {
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
var Mn = Y("follow:addJavFeed.placeholder"), Nn = Y("follow:addJavFeed.title");
function Pn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: Y("follow:addJavFeed.cardsSplitAcrossPeople", { names: pt([...n.values()]) }),
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
function Fn({ card: e, picked: t, onPick: n }) {
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
						children: pt(e.names)
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
		}), /* @__PURE__ */ (0, Z.jsx)(O, {
			href: e.url,
			children: e.id
		})]
	});
}
function In({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, X.useState)(""), [a, o] = (0, X.useState)(null), [s, c] = (0, X.useState)(/* @__PURE__ */ new Set()), l = $t(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => _t(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !He(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => ot(a.q, [...s], e), (e) => {
			t(e.created ? Y("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : Y("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => st(e.id, t), () => {
			t(Y("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? Pn(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Nn,
		className: Me({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: Nn
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Z.jsx)(ie, {
						"aria-label": Y("follow:addJavFeed.actressName"),
						placeholder: Mn,
						value: r,
						leadingIcon: Ct,
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
						children: Bt(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Z.jsx)(Fn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Z.jsx)(F, { children: a.unavailable ? Y("follow:addJavFeed.noCardsThisTime") : Y("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Z.jsx)(F, {
						role: "status",
						children: s.size ? g.text : Y("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Z.jsx)(F, {
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
function Ln({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Z.jsx)(B, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: Y("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Z.jsx)(Rn, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function Rn({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, X.useState)(t.canonical_name), o = $t();
	return /* @__PURE__ */ (0, Z.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => At(t.canonical_key, i.trim(), e), () => {
				Et(), r(Y("follow:creatorAliases.renamed", { name: i.trim() })), n();
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
				children: [/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:creatorAliases.chooseExisting") }), /* @__PURE__ */ (0, Z.jsx)("div", {
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
var zn = (e) => Y("follow:creatorAliases.removeBody", { alias: e }), Bn = Jt({
	rowSelectionFeature: Ft,
	rowSortingFeature: Lt,
	rowPaginationFeature: Pt,
	columnVisibilityFeature: Ve,
	sortedRowModel: vn(),
	paginatedRowModel: _n()
}), Vn = Bn, Hn = {
	id: "select",
	label: Y("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, Un = {
	id: "canonical",
	label: Y("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, Wn = [
	Hn,
	Un,
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
], Gn = [
	Hn,
	Un,
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
], Kn = (e) => e.alias;
function qn(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function Jn({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Z.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Z.jsx)(fn, {
			group: qn(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Z.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function Yn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = cn("alias-suggestions", Wn), f = cn("alias-saved", Gn), [p, g] = (0, X.useState)(null), [_, v] = (0, X.useState)({}), [y, b] = (0, X.useState)({});
	nn(() => {
		v({}), b({});
	}), (0, X.useEffect)(() => {
		(Object.values(_).some(Boolean) || Object.values(y).some(Boolean)) && q();
	}, [_, y]);
	let O = yn(() => v({})), ee = yn(() => b({})), [k, A] = (0, X.useState)([]), [te, ne] = (0, X.useState)([]), [j, M] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [re, P] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), F = sn(t, {
		canonical: {
			values: (e) => e.canonical,
			option: (e) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(fn, {
				group: qn(s, e),
				name: e,
				small: !0
			}) })
		},
		alias: {
			values: (e) => e.alias,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(fn, {
				group: qn(s, t?.canonical ?? e),
				name: e,
				small: !0
			}) })
		},
		evidence: { values: (e) => Bt(e.evidence_code ?? "", e.evidence, e.evidence_params) }
	}, () => M((e) => ({
		...e,
		pageIndex: 0
	}))), I = sn(e, {
		canonical: {
			values: (e) => e.canonical_name,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(fn, {
				group: qn(s, e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		},
		aliases: {
			values: (e) => e.aliases.map((e) => e.name),
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Z.jsx)(fn, {
				group: qn(s, t?.canonical_name ?? e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		}
	}, () => P((e) => ({
		...e,
		pageIndex: 0
	}))), ae = {
		...j,
		pageIndex: Math.min(j.pageIndex, Math.max(0, Math.ceil(F.items.length / j.pageSize) - 1))
	}, L = {
		...re,
		pageIndex: Math.min(re.pageIndex, Math.max(0, Math.ceil(I.items.length / re.pageSize) - 1))
	}, [R, z] = (0, X.useState)(""), [B, V] = (0, X.useState)(""), [H, se] = (0, X.useState)(""), ce = tn({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await De(n.canonical, n.alias);
				} catch (n) {
					throw t && Et(), Error(Y("follow:creatorAliases.mergePartialError", {
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
			z(""), v({}), Et();
		},
		onError: (e) => z(J(e))
	}), le = tn({
		mutationFn: (e) => De(e.canonical, e.alias),
		onSuccess: () => {
			z(""), V(""), se(""), Et(), l(Y("follow:creatorAliases.saved"));
		},
		onError: (e) => z(J(e))
	}), W = tn({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await Dt(e), n += 1;
			} catch (e) {
				throw Error(Y("follow:creatorAliases.removePartialError", {
					error: J(e),
					removed: n,
					count: t.length - n
				}));
			} finally {
				Et();
			}
		},
		onSuccess: (e, t) => {
			z(""), b({}), typeof t == "string" && l(Y("follow:creatorAliases.removed"));
		},
		onError: (e) => z(J(e))
	}), ue = {
		receipt: l,
		failure: (e) => z(J(e))
	}, fe = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: Y(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: Y(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: Y("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: pt(t.map((e) => Y("follow:creatorAliases.mergePair", {
					alias: Tt(e.alias),
					canonical: Tt(e.canonical)
				})))
			}),
			confirmLabel: Y(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await ce.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await Dt(n.alias);
				await Et();
			};
		},
		receipt: (e) => Y("follow:creatorAliases.merged", { count: e.length })
	}), pe = (e, t) => {
		e.length && Rt(fe(t, e.length), e, ue).catch(ue.failure);
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
			for (let t of e) await De(t.canonical, t.name);
			await Et();
		}),
		receipt: () => Y("follow:creatorAliases.removed")
	}, he = (e) => void Ue({
		title: Y("follow:creatorAliases.removeTitle"),
		body: zn(e),
		confirmLabel: Y("follow:creatorAliases.removeTitle"),
		onConfirm: () => W.mutateAsync(e)
	}), G = (0, X.useRef)({
		sources: s,
		readOnly: c,
		merging: ce.isPending,
		removing: W.isPending,
		merge: pe,
		remove: he,
		rename: g
	});
	G.current = {
		sources: s,
		readOnly: c,
		merging: ce.isPending,
		removing: W.isPending,
		merge: pe,
		remove: he,
		rename: g
	};
	let ge = (0, X.useMemo)(() => {
		let e = We();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(be, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Jn, {
					sources: G.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: Y("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => Bt(e.evidence_code ?? "", e.evidence, e.evidence_params), {
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
		let e = We();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Z.jsx)(be, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Jn, {
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
							leadingIcon: U,
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
	}, []), Se = on({
		features: Bn,
		data: F.items,
		columns: ge,
		getRowId: Kn,
		state: {
			rowSelection: _,
			sorting: k,
			pagination: ae,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			O(), v(e);
		},
		onSortingChange: (e) => {
			A(e), M((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: M,
		enableRowSelection: !0
	}), Ce = on({
		features: Vn,
		data: I.items,
		columns: xe,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: y,
			sorting: te,
			pagination: L,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			ee(), b(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			ne(e), P((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: P
	}), Te = t.filter((e) => _[Kn(e)]), Ee = e.filter((e) => y[e.canonical_key]).flatMap((e) => e.aliases.map((t) => ({
		name: t.name,
		canonical: e.canonical_name
	}))), Oe = an((e) => t.find((t) => Kn(t) === e), (e) => {
		let t = Se.getRow(Kn(e));
		return [It(t.getIsSelected(), () => t.toggleSelected()), {
			id: "merge",
			label: Y("follow:shared.merge"),
			icon: Xt,
			disabled: c || ce.isPending,
			run: () => pe([e], !1)
		}];
	}), ke = an((t) => e.find((e) => e.canonical_key === t), (e) => {
		let t = Ce.getRow(e.canonical_key), n = e.aliases.map((t) => ({
			name: t.name,
			canonical: e.canonical_name
		}));
		return [
			{
				id: "rename",
				label: Y("follow:creatorAliases.rename"),
				icon: x,
				disabled: c,
				run: () => g(e)
			},
			It(t.getIsSelected(), () => t.toggleSelected()),
			{
				id: "remove",
				label: Y("follow:creatorAliases.removeRowAliases", { count: n.length }),
				icon: oe,
				danger: !0,
				disabled: c || W.isPending || !n.length,
				run: async () => {
					await Rt(me, n, ue);
				}
			}
		];
	}), Ae = K(ce.isPending);
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Me({
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
				children: [/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:creatorAliases.addManually") }), /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:creatorAliases.displayName"),
							placeholder: Y("follow:creatorAliases.displayNamePlaceholder"),
							value: B,
							onChange: V,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(ie, {
							"aria-label": Y("follow:creatorAliases.platformAlias"),
							placeholder: Y("follow:creatorAliases.platformAlias"),
							value: H,
							onChange: se,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							disabled: c || !B.trim() || !H.trim(),
							...K(le.isPending),
							onClick: () => le.mutate({
								canonical: B.trim(),
								alias: H.trim()
							}),
							children: Y("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			R ? /* @__PURE__ */ (0, Z.jsx)(D, { children: R }) : null,
			t.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				onKeyDown: Oe.onKeyDown,
				children: [
					Oe.menu,
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Z.jsx)("span", {
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
								/* @__PURE__ */ (0, Z.jsx)(w, {
									label: Y("follow:creatorAliases.pendingTable"),
									sorting: k,
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
										A(e), M((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Z.jsx)(ve, {
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
							host: ue,
							disabled: c || ce.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Ze,
							children: Y("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(C, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => Se.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(_e, {
							"aria-label": Y("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: k[0] ? {
								column: k[0].id,
								direction: k[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => Se.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [Se.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [F.header(e.id, String(e.column.columnDef.header)) ?? at(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ye, {
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
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: at(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(S, {
						label: Y("follow:creatorAliases.pendingTable"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: F.items.length,
						pagination: ae,
						onChange: M
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
							children: [/* @__PURE__ */ (0, Z.jsx)(N, { children: Y("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: I.items.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(w, {
								label: Y("follow:creatorAliases.saved"),
								sorting: te,
								options: [{
									id: "canonical",
									label: Y("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: Y("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									ne(e), P((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Z.jsx)(ve, {
								preferences: f,
								label: Y("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(de, {
						label: Y("follow:creatorAliases.savedBulkActions"),
						visible: Ee.length > 0,
						count: Y("follow:creatorAliases.aliasesSelected", { count: Ee.length }),
						actions: [{
							action: {
								...me,
								label: Y("follow:creatorAliases.removeSelectedCount", { count: Ee.length })
							},
							items: Ee,
							host: ue,
							disabled: c || W.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: Ze,
							children: Y("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(C, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => Ce.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(_e, {
							"aria-label": Y("follow:creatorAliases.saved"),
							size: "sm",
							sortDescriptor: te[0] ? {
								column: te[0].id,
								direction: te[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => Ce.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [Ce.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [I.header(e.id, String(e.column.columnDef.header)) ?? at(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ye, {
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
								children: Ce.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
									id: e.id,
									"data-board-selected": e.getIsSelected() || void 0,
									"data-work-context-row": e.id,
									onContextMenu: (t) => ke.onContextMenu?.(t, e.original, e.id),
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: at(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}), /* @__PURE__ */ (0, Z.jsx)(S, {
						label: Y("follow:creatorAliases.saved"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: I.items.length,
						pagination: L,
						onChange: P
					})] }) : /* @__PURE__ */ (0, Z.jsx)(E, {
						size: "compact",
						icon: we,
						title: Y("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Z.jsx)(T, {
							target: `input[aria-label="${Y("follow:creatorAliases.displayName")}"]`,
							children: Y("follow:creatorAliases.addAlias")
						}),
						children: Y("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(Ln, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var Xn = Jt({
	rowPaginationFeature: Pt,
	rowSelectionFeature: Ft,
	rowSortingFeature: Lt,
	columnVisibilityFeature: Ve,
	sortedRowModel: vn(),
	paginatedRowModel: _n()
}), Zn = {
	select: Y("follow:shared.select"),
	name: Y("follow:shared.name"),
	kind: Y("follow:shared.type"),
	origin: Y("follow:followFeed.filterKindSource"),
	status: Y("follow:shared.status"),
	interval: Y("follow:feedSources.colInterval"),
	fetched: Y("follow:feedSources.colLastFetched"),
	fresh: Y("follow:feedSources.colLastAdded"),
	actions: Y("follow:shared.actions")
}, Qn = Object.entries(Zn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), $n = () => wt.invalidateQueries({
	queryKey: ee,
	exact: !0
}), Q = (e) => e.name || e.url, er = (e) => e.kind.startsWith("javdb") ? "javdb" : e.kind.startsWith("dmm") ? "dmm" : tr(e.url);
function tr(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function nr({ source: e }) {
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
function rr({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Z.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${ae}`,
		dangerouslySetInnerHTML: { __html: je(Q(e), t, null, "performer") }
	});
}
var ir = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function ar(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function or(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return Ue({
		title: n ? Y("follow:feedSources.removeOne") : Y("follow:feedSources.removeMany", { count: e.length }),
		body: n ? Y("follow:feedSources.removeOneBody", { name: Q(n) }) : Y("follow:feedSources.removeManyBody"),
		confirmLabel: Y(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: t
	});
}
function sr({ readOnly: e, toast: t, onAdd: s, selection: c }) {
	let l = rn({
		queryKey: ee,
		queryFn: ({ signal: e }) => tt(e)
	}), d = $t(), p = cn("jav-feeds", Qn), g = l.data, _ = (0, X.useMemo)(() => g?.sources ?? [], [g]), [v, b] = (0, X.useState)(/* @__PURE__ */ new Set()), x = c?.ids ?? v, T = c?.onChange ?? b, [O, k] = (0, X.useState)(1), [A, te] = (0, X.useState)(20), [ne, j] = (0, X.useState)([]), M = sn(_, {
		name: {
			values: Q,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(y, { person: {
				...t,
				id: t.entity_id,
				name: e
			} }) })
		},
		kind: {
			values: (e) => Be(e, "kind_label"),
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(pe, { site: er(t) }) })
		},
		origin: {
			values: (e) => tr(e.url),
			option: (e, t) => ({ leading: /* @__PURE__ */ (0, Z.jsx)(pe, { site: t ? er(t) : e }) })
		},
		status: { values: (e) => e.enabled ? e.last_error ? Y("follow:feedSources.fetchFailed") : e.last_fetched_at ? Y("follow:shared.ok") : Y("follow:feedSources.notChecked") : Y("follow:shared.paused") },
		interval: { values: (e) => Qe(e.interval_minutes) },
		fetched: {
			range: "timestamp",
			value: (e) => e.last_fetched_at ? un(e.last_fetched_at).getTime() / 1e3 : null
		},
		fresh: {
			range: "count",
			value: (e) => e.last_new_count
		}
	}, () => k(1)), N = xt(M.items.length, A, O);
	(0, X.useEffect)(() => {
		k((e) => Math.min(e, N.pages));
	}, [N.pages]), (0, X.useEffect)(() => {
		T((e) => {
			let t = new Set(_.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [_, T]);
	let F = tn({
		mutationFn: async (e) => {
			let t = await vt(e.ids, 4, async (t) => {
				e.action === "remove" ? await Ot(t) : await Vt(t, e.action === "enabled");
			});
			return {
				...e,
				results: t
			};
		},
		onSuccess: (e) => {
			let t = e.results.filter((e) => !e.ok);
			if (T(/* @__PURE__ */ new Set()), $n(), t.length) {
				let e = t[0];
				d.setError(Y("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : J(e.error)
				}));
			}
		},
		onError: (e) => d.setError(J(e))
	}), ie = {
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
			let n = t.filter((t) => t.enabled !== e), { results: r } = await F.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await vt(i.map((e) => e.id), 4, (t) => Vt(t, !e)), await $n();
			};
		},
		receipt: (t) => Y(e ? "follow:feedSources.enabledMany" : "follow:feedSources.pausedMany", { count: t.length })
	}), ae = {
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
			await F.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:feedSources.removedMany", { count: e.length })
	}, L = (0, X.useMemo)(() => ar(_), [_]), R = (0, X.useRef)({
		readOnly: e,
		shared: L,
		busy: null,
		toggle: () => {},
		fetch: () => {},
		remove: () => {}
	});
	R.current = {
		readOnly: e,
		shared: L,
		busy: d.busy,
		toggle: (e, t) => void d.run(`enabled-${e.id}`, (n) => Vt(e.id, t, n), () => void $n()),
		fetch: (e) => void d.run(`check-${e.id}`, (t) => Fe(t, [e.id]), () => void $n()),
		remove: (e) => void or([e], async () => {
			await Ot(e.id), t(Y("follow:feedSources.removedOne", { name: Q(e) })), $n();
		})
	};
	let z = (0, X.useMemo)(() => {
		let e = We(), t = (e) => () => Zn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(be, {
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
					let t = ir(e.row.original, R.current.shared);
					return /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(rr, { source: e.row.original }),
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
			e.accessor((e) => Be(e, "kind_label"), {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(me, {
						site: er(e.row.original),
						label: tr(e.getValue())
					}), /* @__PURE__ */ (0, Z.jsx)(Ce, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? Y("follow:feedSources.fetchFailed") : e.enabled ? Y("follow:shared.enabled") : Y("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(nr, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap",
					children: Qe(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? gt(e.row.original.last_fetched_at) : Y("follow:feedSources.neverFetched")
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
						/* @__PURE__ */ (0, Z.jsx)(ge, {
							"aria-label": Y("follow:shared.enableNamed", { name: Q(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: R.current.readOnly,
							onChange: (t) => R.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: qe,
							"aria-label": Y("follow:feedSources.fetchNamed", { name: Q(e.row.original) }),
							disabled: R.current.readOnly,
							...K(R.current.busy === `check-${e.row.original.id}`),
							onClick: () => R.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: oe,
							"aria-label": Y("follow:shared.removeNamed", { name: Q(e.row.original) }),
							disabled: R.current.readOnly,
							onClick: () => R.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), B = (0, X.useMemo)(() => Object.fromEntries([...x].map((e) => [String(e), !0])), [x]), U = on({
		features: Xn,
		data: M.items,
		columns: z,
		getRowId: (e) => String(e.id),
		state: {
			rowSelection: B,
			sorting: ne,
			pagination: {
				pageIndex: N.page - 1,
				pageSize: A
			},
			columnVisibility: p.visibility
		},
		onColumnVisibilityChange: p.change,
		onSortingChange: (e) => {
			j(e), k(1);
		},
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			c?.onActivate();
			let t = typeof e == "function" ? e(B) : e;
			T(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	}), se = () => void d.run("check", (e) => Fe(e), () => void $n()), ce = (e) => {
		c?.onActivate(), T((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, le = _.filter((e) => x.has(e.id)), W = _.filter((e) => e.last_error), ue = an((e) => _.find((t) => String(t.id) === e), (t) => {
		let n = [{
			id: "select",
			label: Y(x.has(t.id) ? "follow:shared.clearSelection" : "follow:shared.selectNamed", { name: Q(t) }),
			icon: P,
			run: () => ce(t.id)
		}];
		return t.url && n.unshift({
			id: "open",
			label: Y("follow:sourceView.openSource"),
			icon: Ce,
			run: () => {
				window.open(t.url, "_blank", "noopener,noreferrer");
			}
		}), e || n.push({
			id: "fetch",
			label: Y("follow:feedSources.fetchNamed", { name: Q(t) }),
			icon: qe,
			disabled: !!d.busy,
			run: () => R.current.fetch(t)
		}, {
			id: "enabled",
			label: Y(t.enabled ? "follow:shared.pause" : "follow:shared.enable"),
			icon: t.enabled ? H : re,
			disabled: !!d.busy,
			run: () => R.current.toggle(t, !t.enabled)
		}, {
			id: "remove",
			label: Y("follow:shared.removeNamed", { name: Q(t) }),
			icon: oe,
			danger: !0,
			run: () => R.current.remove(t)
		}), n;
	});
	return g ? /* @__PURE__ */ (0, Z.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Z.jsxs)("section", {
			"aria-label": Y("follow:feedSources.listLabel"),
			className: Me({
				padding: "none",
				className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
			}),
			onKeyDown: ue.onKeyDown,
			children: [
				ue.menu,
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
								onClick: se,
								disabled: e,
								...K(d.busy === "check"),
								children: Y("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Z.jsx)(ve, {
								preferences: p,
								label: Y("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Z.jsx)(w, {
								label: Y("follow:feedSources.title"),
								sorting: ne,
								onChange: (e) => {
									j(e), k(1);
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
									label: Zn[e]
								}))
							})
						]
					})]
				}),
				W.length || d.error ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [W.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:feedSources.failedTitle", { count: W.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: W.map((e) => /* @__PURE__ */ (0, Z.jsx)("li", {
								className: "min-w-0 truncate",
								title: Be(e, "last_error"),
								children: Y("follow:shared.labeled", {
									label: Q(e),
									value: Xe(Be(e, "last_error")) || Y("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: Y("follow:feedSources.failedBody")
					}) : null, d.error ? /* @__PURE__ */ (0, Z.jsx)(D, { children: d.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)(de, {
					visible: le.length > 0,
					label: Y("follow:feedSources.bulkActions"),
					count: Y("follow:feedSources.selectedCount", { count: le.length }),
					actions: [
						I(!0),
						I(!1),
						ae
					].map((t) => ({
						action: t,
						items: le,
						host: ie,
						disabled: e || F.isPending
					})),
					children: /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: Ze,
						children: Y("follow:shared.clearSelection")
					})
				}),
				_.length ? /* @__PURE__ */ (0, Z.jsx)(C, {
					follow: !0,
					preferences: p,
					onRowClick: (e) => ce(Number(e)),
					children: /* @__PURE__ */ (0, Z.jsxs)(_e, {
						"aria-label": Y("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: ne[0] ? {
							column: ne[0].id,
							direction: ne[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => U.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [U.getHeaderGroups()[0].headers.map((e) => {
							let t = at(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...p.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [M.header(e.id, Zn[e.id] || e.id) ?? t, e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(ye, {
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
							children: U.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-follow-selected": e.getIsSelected() || void 0,
								"data-work-context-row": e.id,
								onContextMenu: (t) => ue.onContextMenu?.(t, e.original, e.id),
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: at(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id))
						})]
					})
				}) : /* @__PURE__ */ (0, Z.jsx)(E, {
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
				_.length ? /* @__PURE__ */ (0, Z.jsx)(S, {
					label: Y("follow:feedSources.footerLabel"),
					total: N.total,
					unit: Y("follow:feedSources.unit"),
					pagination: {
						pageIndex: N.page - 1,
						pageSize: A
					},
					onChange: (e) => {
						te(e.pageSize), k(e.pageIndex + 1);
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
	}) : /* @__PURE__ */ (0, Z.jsx)("div", { dangerouslySetInnerHTML: { __html: Ut(Y("follow:feedSources.loading"), { fill: !1 }) } });
}
// src/react/follow-manage/source-list.tsx
var cr = Jt({
	rowPaginationFeature: Pt,
	rowSelectionFeature: Ft,
	rowSortingFeature: Lt,
	columnVisibilityFeature: Ve,
	paginatedRowModel: _n()
}), lr = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), ur = 740;
function dr() {
	let [e, t] = (0, X.useState)(!1), n = (0, X.useRef)(null), r = (0, X.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < ur));
		r.observe(e), n.current = r, t(e.clientWidth < ur);
	}, []);
	return (0, X.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var fr = {
	select: Y("follow:shared.select"),
	author: Y("follow:shared.creator"),
	source: Y("follow:followFeed.filterKindSource"),
	provider: Y("follow:shared.site"),
	status: Y("follow:shared.status"),
	checked: Y("follow:sourceList.colLastChecked"),
	actions: Y("follow:shared.actions")
}, pr = Object.entries(fr).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
})), mr = "timestamp", hr = Object.entries(fr).map(([e, t]) => ({
	id: e,
	label: t,
	range: e === "checked" ? mr : void 0
}));
function gr(e, t, n, r) {
	let i = [{
		id: "select",
		label: Y(t ? "follow:shared.clearSelection" : "follow:shared.selectNamed", { name: e.label }),
		icon: ht,
		run: () => n(!t)
	}];
	return e.url && i.unshift({
		id: "open",
		label: Y("follow:sourceView.openSource"),
		icon: Ce,
		run: () => {
			window.open(e.url, "_blank", "noopener,noreferrer");
		}
	}), r.readOnly || i.push({
		id: "check",
		label: Y("follow:sourceList.checkNamed", { name: e.label }),
		icon: qe,
		disabled: !e.enabled || r.busy,
		run: () => r.check([e.id])
	}, {
		id: "enabled",
		label: Y(e.enabled ? "follow:shared.pause" : "follow:shared.enable"),
		icon: e.enabled ? H : re,
		run: () => r.toggle(e, !e.enabled)
	}, {
		id: "remove",
		label: Y("follow:sourceList.unfollow"),
		icon: oe,
		danger: !0,
		run: () => r.remove(e)
	}), i;
}
function _r({ source: e, selected: t, onToggle: n, handlers: r }) {
	let i = ln(), a = () => ({
		key: e.id,
		operations: gr(e, t, n, r)
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
			ze(e, e.currentTarget) && n(!t);
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
					children: /* @__PURE__ */ (0, Z.jsx)(mn, { provider: e.provider })
				}), /* @__PURE__ */ (0, Z.jsx)(hn, { source: e })]
			}),
			/* @__PURE__ */ (0, Z.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Z.jsx)(gn, { source: e }),
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
						children: /* @__PURE__ */ (0, Z.jsx)(pn, { text: Be(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: Re(e)
					}),
					/* @__PURE__ */ (0, Z.jsx)(ge, {
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
							leadingIcon: qe,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...K(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: oe,
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
function vr({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(ut).length, p = pt([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = zt(r, l);
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Y("follow:sourceList.groupLabel", { name: t }),
		className: Me({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Z.jsx)(fn, {
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
							e.map((e) => /* @__PURE__ */ (0, Z.jsx)(mn, { provider: e.provider }, e.id)),
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
						leadingIcon: qe,
						"aria-label": Y("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...K(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: ht,
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
			children: e.map((e) => /* @__PURE__ */ (0, Z.jsx)(_r, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function yr(e) {
	let { data: t, sort: s, dir: c, page: l, layout: d, pageSize: g, selected: v, readOnly: y, onSort: x, onPage: w, onLayout: T, onPageSize: D, onSelected: O, toast: ee, openFollow: te, onAdd: ne } = e, j = t.sources, M = (0, X.useMemo)(() => t.author_aliases || [], [t.author_aliases]), N = t.counts || {}, [re, P] = (0, X.useState)(/* @__PURE__ */ new Set()), [F, ie] = dr(), [ae, L] = (0, X.useState)(""), R = (0, X.useMemo)(() => ke(j, s, c, M), [
		j,
		s,
		c,
		M
	]), z = (0, X.useMemo)(() => Yt(R, s, c, M), [
		R,
		s,
		c,
		M
	]), B = sn(z, {
		author: {
			values: (e) => e.author,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(fn, {
				group: t.group,
				name: e,
				small: !0
			}) })
		},
		source: {
			values: (e) => e.source.label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(mn, { provider: t.source.provider }) })
		},
		provider: {
			values: (e) => e.source.provider_label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Z.jsx)(mn, { provider: t.source.provider }) })
		},
		status: { values: (e) => qt(e.source) },
		checked: {
			range: mr,
			value: (e) => e.source.last_checked_at ? un(e.source.last_checked_at).getTime() / 1e3 : null
		}
	}, () => w(1)), H = (0, X.useMemo)(() => {
		let e = new Set(B.items.map((e) => e.source.id));
		return R.flatMap((t) => {
			let n = t.filter((t) => e.has(t.id));
			return n.length ? [{
				key: String(t[0].author_key || t[0].id),
				name: Ae(t, M),
				sources: n
			}] : [];
		});
	}, [
		M,
		B.items,
		R
	]), { job: U, running: le, outcome: fe, start: pe } = en({
		queryKey: k,
		taskKey: A,
		queryFn: ({ signal: e }) => $e(e),
		start: (e) => Gt(e),
		onError: (e) => L(J(e)),
		onFinish: (e) => {
			Et(), ee(e.status === "failed" ? ft(e, "error") || Y("follow:followCheck.checkFailed") : Ie(e));
		}
	}), me = (e) => {
		le || pe.isPending || (L(""), pe.mutate(e));
	}, G = (e, t) => O(Zt(v, [e], t)), Ce = (e, t) => O(Zt(v, e, t)), we = tn({
		mutationFn: (e) => kt(e),
		onSuccess: (e, t) => {
			Je([t]), O(Zt(v, [t], !1)), ee(Y("follow:sourceList.unfollowed"));
		},
		onError: (e) => L(J(e))
	}), Te = tn({
		mutationFn: (e) => Ht(e.id, e.enabled),
		onSuccess: (e, t) => {
			St(t.id, { enabled: t.enabled }), L("");
		},
		onError: (e) => L(J(e))
	}), De = (e) => void Ue({
		title: Y("follow:sourceList.unfollow"),
		body: Y("follow:sourceList.unfollowBody"),
		confirmLabel: Y("follow:sourceList.unfollow"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: () => we.mutateAsync(e.id)
	}), Oe = tn({
		mutationFn: async (e) => {
			let t = await vt(e.ids, 4, async (t) => {
				e.action === "remove" ? await kt(t) : await Ht(t, e.action === "enabled");
			});
			return {
				...e,
				done: e.ids.filter((e, n) => t[n]?.ok),
				results: t
			};
		},
		onSuccess: (e) => {
			if (e.action === "remove") Je(e.done);
			else for (let t of e.done) St(t, { enabled: e.action === "enabled" });
			O(Zt(v, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? L(Y("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: J(t[0]?.error)
			})) : L("");
		},
		onError: (e) => L(J(e))
	}), je = tn({
		mutationFn: yt,
		onSuccess: (e) => {
			Et(), e.failed ? L(Y("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: J(e.error)
			})) : L("");
		},
		onError: (e) => L(J(e))
	}), Fe = {
		receipt: ee,
		failure: (e) => L(J(e))
	}, ze = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: Y(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => j.find((e) => e.id === t)?.enabled !== e), { done: r } = await Oe.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await vt(r, 4, (t) => Ht(t, !e));
				for (let t of r) St(t, { enabled: !e });
			};
		},
		receipt: (t) => Y(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), Ve = {
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
			await Oe.mutateAsync({
				ids: [...e],
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:sourceList.bulkDeleted", { count: e.length })
	}, He = (e) => {
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
			run: async () => (t = (await je.mutateAsync(e)).marked, async () => {
				await Qt(t), await Et();
			}),
			receipt: () => Y("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Ge = (e, t) => Te.mutate({
		id: e.id,
		enabled: t
	}), Ke = (0, X.useRef)({
		check: me,
		toggle: Ge,
		remove: De,
		busy: !1,
		readOnly: y
	});
	Ke.current = {
		check: me,
		toggle: Ge,
		remove: De,
		busy: le || pe.isPending,
		readOnly: y
	};
	let q = Ke.current, Qe = an((e) => j.find((t) => String(t.id) === e), (e) => gr(e, v.has(e.id), (t) => G(e.id, t), q)), et = (0, X.useMemo)(() => {
		let e = We(), t = (e) => () => fr[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(be, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(fn, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(hn, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Z.jsx)(pn, { text: Be(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Z.jsx)(mn, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(gn, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => Re(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(ge, {
							"aria-label": Y("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: q.readOnly,
							onChange: (t) => Ke.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: qe,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || q.readOnly,
							...K(q.busy),
							onClick: () => Ke.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: oe,
							"aria-label": Y("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: q.readOnly,
							onClick: () => Ke.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [q]), tt = (0, X.useMemo)(() => {
		let e = lr[s];
		return e ? [{
			id: e,
			desc: c === "desc"
		}] : [];
	}, [s, c]), nt = (0, X.useMemo)(() => Object.fromEntries([...v].map((e) => [String(e), !0])), [v]), rt = d === "table", it = cn("follow-sources", pr), ot = xt(rt ? B.items.length : H.length, g, l), st = on({
		features: cr,
		data: B.items,
		columns: et,
		getRowId: (e) => String(e.source.id),
		state: {
			sorting: tt,
			rowSelection: nt,
			pagination: {
				pageIndex: ot.page - 1,
				pageSize: g
			},
			columnVisibility: it.visibility
		},
		onColumnVisibilityChange: it.change,
		manualSorting: !0,
		enableRowSelection: !0,
		onSortingChange: (e) => {
			let t = (typeof e == "function" ? e(tt) : e)[0];
			if (!t) return;
			let n = p[t.id];
			n && x(n, t.desc ? "desc" : "asc");
		},
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e(nt) : e;
			O(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		},
		onPaginationChange: (e) => {
			let t = {
				pageIndex: ot.page - 1,
				pageSize: g
			}, n = typeof e == "function" ? e(t) : e;
			n.pageSize === g ? n.pageIndex !== t.pageIndex && w(n.pageIndex + 1) : D(n.pageSize);
		}
	}), ct = st.getRowModel().rows, lt = rt ? ct.map((e) => e.original.source.id) : H.slice(ot.start, ot.end).flatMap(({ sources: e }) => e.map((e) => e.id)), ut = zt(v, lt), dt = [...v], pt = Pe(fe), mt = j.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), ht = Ne(fe), gt = H.length > 0 && H.every(({ key: e }) => re.has(e));
	return j.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Me({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		onKeyDown: Qe.onKeyDown,
		children: [
			Qe.menu,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				ref: F,
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
						children: N.new ? Y("follow:sourceList.sourceCountUnseen", {
							count: j.length,
							unseen: Number(N.new) || 0
						}) : Y("follow:sourceList.sourceCount", { count: j.length })
					})]
				}), /* @__PURE__ */ (0, Z.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						mt.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							disabled: y,
							...K(q.busy),
							onClick: () => me(mt),
							children: Y("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							leadingIcon: qe,
							disabled: y,
							"aria-label": Y("follow:sourceList.checkAll"),
							iconOnly: ie,
							...K(q.busy),
							onClick: () => me([]),
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
										leadingIcon: Se,
										"aria-label": I[0][1],
										"aria-pressed": !rt,
										onClick: () => T("default")
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: Ye,
										"aria-label": I[1][1],
										"aria-pressed": rt,
										onClick: () => T("table")
									})]
								}),
								rt ? /* @__PURE__ */ (0, Z.jsx)(ve, {
									preferences: it,
									label: Y("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Z.jsx)(W, {
										"aria-label": Y("follow:sourceList.sortLabel"),
										prefix: Y("follow:shared.sort"),
										selectedKey: s,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											x(t, se[t]);
										},
										children: ce.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(ue, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: he,
										"data-icon-state": c === "asc" ? "a" : "b",
										"aria-label": Wt(s, c),
										onClick: () => x(s, c === "asc" ? "desc" : "asc")
									})]
								}),
								rt ? null : /* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "secondary",
									iconOnly: ie,
									leadingIcon: _,
									"aria-expanded": !gt,
									"aria-label": Y(gt ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => P(gt ? /* @__PURE__ */ new Set() : new Set(H.map(({ key: e }) => e))),
									children: Y(gt ? "follow:shared.expandAll" : "follow:shared.collapseAll")
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
					le ? /* @__PURE__ */ (0, Z.jsx)(xe, {
						embedded: !0,
						kind: U?.older ? Ee("feed-scrape") : Ee("follow-check"),
						label: ft(U) || (U?.total ? Y(U.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: U.checked || 0,
							count: U.total
						}) : Y("follow:sourceList.preparingCheck")),
						value: U?.checked,
						total: U?.total
					}) : null,
					ae ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:shared.actionFailed"),
						children: ae
					}) : null,
					!le && fe?.results?.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "neutral",
						title: Y("follow:followFeed.checkResults"),
						children: Le(fe)
					}) : null,
					pt.length ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "error",
						title: Y("follow:sourceList.failedTitle", { count: pt.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: pt.map((e, t) => /* @__PURE__ */ (0, Z.jsx)("li", { children: Y("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: Xe(e.error || "") || Y("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: Y("follow:sourceList.failedBody")
					}) : null,
					ht ? /* @__PURE__ */ (0, Z.jsx)(V, {
						tone: "warning",
						children: Y("follow:sourceList.evidenceGap", { error: ht })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(de, {
				label: Y("follow:sourceList.bulkActions"),
				visible: dt.length > 0,
				count: Y("follow:sourceList.selectedCount", { count: dt.length }),
				actions: [
					ze(!0),
					ze(!1),
					Ve
				].map((e) => ({
					action: e,
					items: dt,
					host: Fe,
					disabled: y || Oe.isPending
				})),
				leading: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: y,
					...K(q.busy),
					onClick: () => me(dt),
					children: Y("follow:sourceList.checkSelected")
				}),
				children: /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: Ze,
					children: Y("follow:shared.clearSelection")
				})
			}),
			rt ? /* @__PURE__ */ (0, Z.jsx)(C, {
				follow: !0,
				preferences: it,
				onRowClick: (e) => G(Number(e), !v.has(Number(e))),
				children: /* @__PURE__ */ (0, Z.jsxs)(_e, {
					"aria-label": Y("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: tt[0] ? {
						column: tt[0].id,
						direction: tt[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => st.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [st.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = at(e.column.columnDef.header, e.getContext());
						return /* @__PURE__ */ (0, Z.jsx)(r, {
							id: e.id,
							allowsSorting: t,
							isRowHeader: e.column.id === "source",
							...it.columnProps(e.id),
							children: ({ sortDirection: r }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [e.id === "select" ? n : t ? /* @__PURE__ */ (0, Z.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [B.header(e.id, fr[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Z.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": r || void 0,
									children: /* @__PURE__ */ (0, Z.jsx)(h, {})
								})]
							}) : B.header(e.id, fr[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Z.jsx)(ye, {
								preferences: it,
								id: e.id
							})] })
						}, e.id);
					}), /* @__PURE__ */ (0, Z.jsx)(r, {
						id: "remaining-space",
						"aria-label": Y("follow:shared.rowSpacer"),
						"data-table-space": "",
						width: it.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, Z.jsx)(n, {
						renderEmptyState: () => Y("follow:sourceList.pageEmpty"),
						children: ct.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							"data-work-context-row": e.original.source.id,
							onContextMenu: (t) => Qe.onContextMenu?.(t, e.original.source, String(e.original.source.id)),
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: at(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [
				/* @__PURE__ */ (0, Z.jsx)(b, {
					filters: B.values,
					columns: hr,
					onRemove: B.clear,
					valueLabel: (e, t) => t || Y("cleanup:shared.none")
				}),
				lt.length ? /* @__PURE__ */ (0, Z.jsx)(m, {
					isSelected: ut.all,
					isIndeterminate: ut.some,
					onChange: (e) => Ce(lt, e),
					"aria-label": Y("follow:sourceList.selectPage"),
					children: Y("follow:sourceList.selectPageShort")
				}) : null,
				H.length ? null : /* @__PURE__ */ (0, Z.jsx)(E, {
					icon: f,
					title: Y("follow:sourceList.pageEmpty"),
					children: null
				}),
				/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "flex flex-col gap-3",
					children: H.slice(ot.start, ot.end).map(({ key: e, name: t, sources: n }) => /* @__PURE__ */ (0, Z.jsx)(vr, {
						group: n,
						name: t,
						handlers: q,
						selected: v,
						open: !re.has(e),
						onOpen: (t) => {
							let n = new Set(re);
							t ? n.delete(e) : n.add(e), P(n);
						},
						onToggleGroup: (e) => Ce(n.map((e) => e.id), e),
						onToggle: G
					}, e))
				})
			] }),
			/* @__PURE__ */ (0, Z.jsx)(S, {
				label: Y("follow:followManageNav.list"),
				total: ot.total,
				pagination: {
					pageIndex: ot.page - 1,
					pageSize: g
				},
				unit: Y(rt ? "follow:followOverview.sourceUnit" : "follow:sourceList.creatorUnit"),
				pageUnit: Y(rt ? "follow:followOverview.itemUnit" : "follow:followOverview.creatorUnit"),
				onChange: (e) => {
					e.pageSize === g ? st.setPageIndex(e.pageIndex) : st.setPageSize(e.pageSize);
				}
			}),
			N.new ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:sourceList.markSummary", {
							unwatched: Number(N.new) || 0,
							watched: Number(N.seen) || 0,
							saved: Number(N.saved) || 0,
							ignored: Number(N.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: te,
						children: Y("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = He(e);
						return /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: y,
							...K(je.isPending),
							onClick: () => void Rt(t, [Number(N.new) || 0], Fe).catch(Fe.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Z.jsx)(E, {
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
var br = "skullet-reveal", xr = "skullet-pane", Sr = "skullet-loading", Cr = "skullet-ghost", wr = "skullet-snapshot", Tr = "skullet-layer", Er = "skullet-rect", Dr = "skullet-bar", Or = "skullet-inactive", kr = "skullet-exiting", Ar = "skullet-covered", jr = "skullet-own", Mr = "skullet-block", Nr = Symbol.for("skullet.ghost"), Pr = Symbol.for("skullet.uncover"), Fr = "skullet-status", Ir = "skullet-xray", Lr = "var(--skullet-base, rgb(128 128 128 / 0.2))", Rr = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", zr = 280, Br = 1e4, Vr = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, Hr = [
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
], Ur = [
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
], Wr = Ur.join(", "), Gr = `
[${br}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${xr}] {
  display: block;
}

[${Sr}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${Or}] {
  display: none !important;
}

[${Tr}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${Dr}] {
  display: block;
  background-color: ${Lr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${Sr}]) to ([${jr}], [${Tr}]) {
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
  :scope :is(${Hr.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${Wr}, [${Ar}], [${Mr}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${Lr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${Wr}, [${Mr}]):not(svg *) {
      visibility: visible !important;
      background: ${Lr} !important;
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
[${Fr}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${Ir}] [${Sr}] [${Cr}],
[${Ir}] [${Sr}] [${Cr}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Kr = null, qr = 0, Jr;
function Yr() {
	qr++, !Kr && (Jr ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !Jr && (Kr = document.createElement("style"), Kr.dataset.skullet = "true", Kr.textContent = Gr, document.head.appendChild(Kr)));
}
function Xr() {
	qr--, !(qr > 0 || !Kr) && (Kr.remove(), Kr = null);
}
var Zr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", Qr = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...Qr });
function $r(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? Qr[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var ei = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function ti({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = $r(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${ei(o)} }`), a === "system") {
		let t = $r({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${ei(t)} } }`);
	}
	return s.join("\n");
}
var ni = /* @__PURE__ */ new Map(), ri, ii = null, ai = 0;
function oi() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var si = () => ri ??= typeof window < "u" && oi(), ci = (e) => si() || !!e?.closest("[skullet-debug]");
function li(e) {
	ri = e, e ? mi() : hi();
}
function ui(e, t) {
	!e || !ci(e) || (ni.set(e, {
		state: "loading",
		source: t
	}), fi());
}
function di(e, t) {
	!e || !ci(e) || (ni.set(e, {
		...ni.get(e),
		state: "shown",
		moved: t
	}), fi());
}
function fi() {
	mi(), cancelAnimationFrame(ai), _i();
}
var pi = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function mi() {
	if (typeof document > "u") return;
	if (!ii?.isConnected) {
		ii = document.createElement("div"), ii.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = ii.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${pi}</style><div class="boxes"></div>`, document.body.append(ii);
	}
	let e = ii.shadowRoot;
	if (ri && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(Ir, e.target.checked);
		}), e.append(t);
	}
	ai ||= requestAnimationFrame(_i);
}
function hi() {
	ii?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(Ir), ![...ni.keys()].some((e) => ci(e)) && (cancelAnimationFrame(ai), ai = 0, ii?.remove(), ii = null);
}
var gi = ({ state: e, source: t, moved: n }) => {
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
function _i() {
	if (ai = 0, !ii?.shadowRoot) return;
	let e = ii.shadowRoot.querySelector(".boxes");
	for (let e of ni.keys()) e.isConnected && ci(e) || ni.delete(e);
	let t = [...ni];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = gi(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), (ri || ni.size) && (ai = requestAnimationFrame(_i));
}
var vi, yi = () => vi ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), bi = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, xi = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], Si = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function Ci(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function wi(e, t, n) {
	let r = bi(e, t), i = Ci(n, t), a = e ? xi(e) : [], o = xi(t), s = xi(r).map((t, n) => Si(t, o[n]) ? i[n] : e && Si(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function Ti(e, t, n, r) {
	if (!e) return n;
	let i = xi(e), a = xi(t).map((t, n) => e.corners[n] > 0 && Si(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = Ci(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var Ei = (e, t) => {
	let n = bi(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, Di = {
	top: "ascender",
	bottom: "descender"
}, Oi = /* @__PURE__ */ new Map(), ki = (e) => [...e.getClientRects?.() ?? []];
function Ai(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (Oi.has(t)) return Oi.get(t);
	let n = yi(), r = null;
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
	return Oi.set(t, r), r;
}
var ji = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, Mi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function Ni(e, t, n) {
	let r = Ai(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = Mi(t, "--skullet-text-top", Object.keys(ji), Di.top), a = Mi(t, "--skullet-text-bottom", ["baseline", "descender"], Di.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[ji[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var Pi = new Set(Ur), Fi = new Set(Hr), Ii = .4, Li = /[,/]\s*0\)$/, Ri = (e, t) => e !== "" && e !== t, zi = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], Bi = (e) => zi.every((t) => Ri(e[`border${t}Style`], "none") && Ri(e[`border${t}Width`], "0px")), Vi = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, Hi = (e) => Ri(e, "none") && !e.split(/,(?![^(]*\))/).every(Vi), Ui = (e) => Ri(e.backgroundColor, "transparent") && !Li.test(e.backgroundColor) || Ri(e.backgroundImage, "none") || Hi(e.boxShadow) || Bi(e), Wi = (e) => Pi.has(e.localName), Gi = (e) => Fi.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), Ki = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(ki(n).filter((e) => e.width || e.height));
		} else Gi(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * Ii, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, qi = (e, t) => e.hasAttribute("skullet-block") || Wi(e) || Ui(t) && Ki(e) <= 1;
function Ji(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function Yi(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * Ii;
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
function Xi(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = Ei(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...Ni(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of ki(d)) f(e, r, t);
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
			if (qi(e, r)) {
				let n = Ei(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: Ti(t, n, Ji(e, r), r)
					});
				}
				Wi(e) || u.add(e);
				continue;
			}
			if (Gi(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? wi(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...Yi(l)];
	for (let t of e.querySelectorAll(`[${Ar}]`)) u.has(t) || t.removeAttribute(Ar);
	for (let e of u) e.hasAttribute(Ar) || e.setAttribute(Ar, "");
	return [...c, ...Yi(l)];
}
var Zi = (e) => typeof matchMedia < "u" && matchMedia(e).matches, Qi = () => typeof Element < "u" && typeof Element.prototype.animate == "function", $i = () => !Qi() || Zi("(prefers-reduced-motion: reduce)"), ea = () => Zi("(prefers-reduced-transparency: reduce)"), ta = (e) => e.getAnimations?.() ?? [], na = .7, ra = 1280, ia = 320, aa = 2.5, oa = .45, sa = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function ca(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", sa, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Vr[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var la = 20, ua = Math.sin(la * Math.PI / 180), da = Math.cos(la * Math.PI / 180), fa = ua / da, pa = da, ma = `${90 + la}deg`, ha = .85, $ = 12, ga = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function _a(e) {
	let t = e * aa, n = (t, n) => `color-mix(in srgb, ${Rr} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * ha, ga(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(ha + e / $ * (1 - ha), ga(1 - e / $)));
	return {
		width: t / da,
		image: `repeating-linear-gradient(${ma}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function va(e, t, n = ca(e)) {
	for (let t of ta(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", $i() || typeof e.animate != "function" || n.animation === "none") return;
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
				opacity: oa,
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
	}, { width: s, image: c } = _a(Math.min(Math.max(o.width * .4, 80), ia)), l = a - o.left + (i.top - o.top) * fa, u = n.duration * na / (ra + ia);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function ya(e) {
	if ($i()) return null;
	let t = ca(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * na / (ra + ia);
}
var ba = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), xa = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function Sa(e, t) {
	let n = ba(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = ca(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${Lr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, va(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var Ca = 120, wa = 72, Ta = 3, Ea = 60, Da = 150, Oa = 400, ka = 1.5, Aa = 1e3, ja = 1e3, Ma = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), Na = -1 / 0, Pa = !1;
function Fa() {
	if (!(Pa || typeof addEventListener > "u")) {
		Pa = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => Na = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var Ia = /* @__PURE__ */ new WeakMap();
function La(e, { served: t, refetch: n }) {
	Fa();
	let r = Ia.get(e)?.since ?? performance.now();
	Ia.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function Ra(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function za(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var Ba = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function Va(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${kr}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var Ha = (e, t) => Math.min(Math.max(e, 0), t), Ua = -1 / 0;
function Wa(e, t, n, r, i) {
	let a = performance.now();
	a - Ua > Da && (Ua = a);
	let o = a - Ua, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of Ra(e)) {
		let n = za(t, e), r = c.get(n);
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
		return t === null ? null : Ha(t, Aa) + Math.max(r.delay ?? 0, 0);
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
			let t = [...c.values()].find((t) => Ba(t.rect, e));
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
function Ga(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) Ma.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function Ka(e, t, n, r = () => {}) {
	let i = Ia.get(t);
	Ia.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - Na < Oa,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: Ra(e).length
			})
		};
	}
	let o = Ha(a.duration ?? 200, ja);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, Aa)
	}, !o) return { kind: "instant" };
	let s = Ga(a.enter, r);
	if (a.wipe) {
		let e = Va(t);
		if (e.width * e.height <= innerWidth * innerHeight * ka) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return Wa(e, t, a.order, {
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
var qa = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return Ha(n * .8 + r * .2, 1) * 320;
}, Ja = (e) => e.bottom > 0 && e.top < innerHeight, Ya = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return Ja(e) ? 0 : null;
	if (!Ja(t)) return null;
	let i = Ha(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? Ea : 0);
}, Xa = { duration: 0 }, Za = { order: "together" }, Qa = { order: qa }, $a = (e) => e.input || e.waited < 150 ? Xa : e.refetch ? {
	order: "together",
	duration: Ca
} : null, eo = (e) => e.height < wa || e.pieces <= Ta ? Za : { order: Ya }, to = {
	hold: 150,
	choose: (e) => $a(e) ?? eo(e)
}, no = new Set(Ur), ro = "script, noscript, template, base, meta, link", io = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), ao = /* @__PURE__ */ new Set([
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
	Ar
]), oo = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function so(e, t) {
	let n = oo(t.data);
	t.data = n;
	let r = e.parentElement, i = yi();
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
function co(e) {
	for (let t of e.querySelectorAll(ro)) t.remove();
	for (let t of e.querySelectorAll("*")) if (io.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || ao.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function lo(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (no.has(e.localName) || io.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) so(e, t);
	return co(n), n.innerHTML;
}
function uo(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, co(t.content), t.content;
}
var fo = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${fo(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), po = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function mo(e) {
	let t = fo(e, 2);
	return t ? `${location.pathname}|${po(t)}` : null;
}
var ho = !1;
try {
	ho = !1;
} catch {
	ho = !1;
}
var go = ho, _o = /* @__PURE__ */ new Set();
function vo(e, t) {
	!go || _o.has(e) || (_o.add(e), console.warn(`[skullet] ${t}`));
}
var yo = /^(https?:|\/|data:|blob:)/;
function bo(e) {
	return typeof e == "string" ? yo.test(e) ? "" : oo(e) : Array.isArray(e) ? e.map(bo) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, bo(t)])) : e;
}
var xo = "skullet:shapes", So = 2, Co = 50, wo = 2e4, To = /* @__PURE__ */ new Map(), Eo = /* @__PURE__ */ new Map();
function Do(e, t) {
	return Eo.has(e) || Eo.set(e, /* @__PURE__ */ new Set()), Eo.get(e).add(t), () => Eo.get(e)?.delete(t);
}
function Oo(e) {
	for (let t of Eo.get(e) ?? []) t();
}
function ko() {
	try {
		let e = JSON.parse(localStorage.getItem(xo) ?? "null");
		return e?.v === So ? e.shapes : {};
	} catch {
		return {};
	}
}
function Ao(e) {
	try {
		localStorage.setItem(xo, JSON.stringify({
			v: So,
			shapes: e
		}));
	} catch {}
}
function jo(e, t) {
	To.set(e, lo(t, !1));
	let n = lo(t, !0);
	if (n.length > wo) return;
	let r = ko();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - Co)) delete r[e];
	Ao(r);
}
function Mo(e) {
	return To.get(e) ?? ko()[e] ?? null;
}
var No = [
	100,
	90,
	60
].map((e) => `<div ${Mr} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), Po = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${Sr}]`)), Fo = /* @__PURE__ */ new WeakMap();
function Io(e) {
	if (!e) return;
	let t = Fo.get(e);
	return Fo.delete(e), t;
}
function Lo(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var Ro = (e) => !!e.firstElementChild || !!e.textContent?.trim(), zo = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, Yr(), e[Nr] = !0, e.setAttribute(Sr, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = Lo(e, Cr), this.snapshot = Lo(e, wr), this.layer = Lo(e, Tr), this.hadContent = Ro(this.ghost);
		let n = e.closest(`[${br}]`);
		n && La(n, {
			served: Po.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[Pr]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
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
		this.root.closest(`[${kr}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = Ro(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || Po.has(this.root), r = !!this.ghost.querySelector(`[${jr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? mo(this.ghost);
			n && (Oo(n), t = Mo(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(uo(t)) : e === "fallback" ? (this.snapshot.innerHTML = No, vo(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(Or, e !== "ghost"), this.snapshot.toggleAttribute(Or, e === "ghost"), this.source = e, ui(this.root.closest(`[${br}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : Po.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		Sa(this.layer, Xi(e, this.layer));
		let t = this.root.closest(`[${br}]`);
		t && Fo.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), Xr();
	}
}, Bo = 250, Vo = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? mo(e), this.untrack = this.key ? Do(this.key, () => this.save()) : () => {}, (go || ci(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
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
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), Bo);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && jo(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${br}]`), o = Io(a);
		if (!o) return;
		o.guessed && n && !r && e != null && vo(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify(bo(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (di(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? vo(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : vo(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, Ho = () => {}, Uo = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, Wo = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !Uo(e));
function Go(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(Ho, Ho), new Promise((e) => setTimeout(e, Br))]);
}
var Ko = 360, qo = 2, Jo = 600, Yo = 40, Xo = Yo / pa, Zo = 320, Qo = 120, $o = .45, es = (e) => e.left + e.top * fa, ts = (e) => e.width + e.height * fa, ns = (e, t) => es(t) - Xo + (ts(t) + 2 * Xo) * e, rs = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function is(e) {
	let t = e.querySelector(`:scope > [${kr}] [${Tr}]`), n = t && ya(t);
	if (!n) return null;
	let r = Va(e);
	if (r.width * r.height > innerWidth * innerHeight * ka) return null;
	let i = es(r), a = i + ts(r), o = performance.now(), s = o - rs.start;
	s <= Da && (i - rs.origin) / rs.speed >= s && (a - rs.origin) / rs.speed - s <= Jo || (rs = {
		start: o,
		origin: i,
		speed: Math.max(qo / n, (a - i) / Ko)
	});
	let { start: c, origin: l, speed: u } = rs;
	return {
		delay: (i - Xo - l) / u - (o - c),
		duration: (a - i + 2 * Xo) / u
	};
}
var as = (e) => (t, { rect: n, reveal: r }) => {
	let i = (ns(t, r) - es(n)) * pa;
	return `linear-gradient(${ma}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - ga(n / $) : ga(n / $), a = -Yo + 2 * Yo * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, os = "http://www.w3.org/2000/svg", ss = null, cs = 0;
function ls() {
	return ss?.isConnected || (ss = document.createElementNS(os, "svg"), ss.setAttribute("aria-hidden", "true"), ss.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(ss)), ss;
}
var us = (e, t) => {
	let n = document.createElementNS(os, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, ds = {
	mask: as(!0),
	out: as(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (ea()) return;
		let i = es(t), a = ts(t), o = Zo / 2 / pa, s = () => ns(r(), n) - i - Qo / pa;
		if (s() - o > a) return;
		let c = 2 * o + t.height * fa, l = c / 2, u = t.height / 2, d = Zo / 2 * pa, f = Zo / 2 * fa * pa, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${ga(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++cs}`, _ = us("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = us("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(us(`feFunc${e}`, {
			type: "linear",
			slope: 1 - $o,
			intercept: $o
		}));
		let y = us("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, us("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), us("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), ls().append(_), e.style.filter = `url(#${g})`;
		let b = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * fa) / t.width).toFixed(4)), requestAnimationFrame(b));
		};
		b();
	}
}, fs = {
	together: Za,
	sequence: Qa,
	smart: to,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = $a(e);
			if (t) return t;
			let n = is(e.reveal);
			return n ? {
				wipe: ds,
				...n
			} : eo(e);
		}
	}
}, ps = (e = "smart") => typeof e == "string" ? fs[e] : e, ms = () => {}, hs = (e) => e.finished.then(ms, ms), gs = /* @__PURE__ */ new WeakMap();
function _s(e, t = 0, n = 200, r = 0, i) {
	return $i() ? Promise.resolve() : hs(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var vs = (e) => !!e.querySelector(`[${Tr}], [${Cr}], :scope > [${jr}]`), ys = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, bs = /* @__PURE__ */ new WeakMap();
function xs(e) {
	for (let t of bs.get(e) ?? []) t.remove();
	bs.delete(e);
}
function Ss(e, t) {
	let n = Wo(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && vs(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${kr}] [${Tr}]`)].flatMap(xa), a = bs.get(t) ?? /* @__PURE__ */ new Set();
			bs.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => ys(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(Er, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: Lr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), va(c), Go(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", _s(e), $i()) return c.remove();
						hs(c.animate([{ opacity: 1 }, { opacity: 0 }], {
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
function Cs(e, t) {
	return $i() ? Promise.resolve() : Promise.all(Ra(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return _s(e, n, t.duration, 0, t.enter);
	})).then(ms);
}
function ws(e) {
	for (let t of e.querySelectorAll(`:scope > [${kr}]`)) {
		for (let e of ta(t)) e.finish();
		t.style.opacity = "0";
	}
}
function Ts(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${kr}]`)) if (!vs(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of ta(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function Es(e, t = "smart", { initial: n = !1 } = {}) {
	let r = Ds.get(e);
	return r || (r = Os(e, t, n), Ds.set(e, r)), r;
}
var Ds = /* @__PURE__ */ new WeakMap();
function Os(e, t, n) {
	let r = e.parentElement, i = ps(t);
	if (vs(e)) {
		r && xs(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && gs.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : _s(e, t)) : (r && gs.delete(r), n ? Promise.resolve() : _s(e));
	}
	if (n || !r) return Promise.resolve();
	let a = Ts(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return gs.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), _s(e, 0, t, a);
	}
	Ss(e, r);
	let o = Ka(e, r, i, (e) => vo(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return gs.set(r, o), o.kind === "instant" ? (ws(r), Promise.resolve()) : o.kind === "sequence" ? Cs(e, o) : o.kind === "wipe" ? Vs(e, o, !0) : _s(e, o.delay, o.duration, 0, o.enter);
}
function ks(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function As(e, t = ks(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(kr, ""), t;
}
var js = /* @__PURE__ */ new WeakMap();
function Ms(e, t) {
	let n = e.querySelector(`:scope > [${xr}]:not([${kr}])`);
	if (!n) return;
	let r = js.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && Ns(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: zr,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	js.set(e, u), hs(l).then(() => {
		js.get(e) === u && Ns(e, u);
	});
}
function Ns(e, { overflow: t, boxSizing: n }) {
	js.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function Ps(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of ta(e)) t.cancel();
	Bs(e), e.style.filter = "";
	let i = e.parentElement;
	i && !vs(e) && xs(i);
	let a = As(e, t), o = (t, n) => Qi() ? hs(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && gs.get(i), n = $i() || t?.kind === "instant";
		if (i && !n && Ms(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && vs(e) ? Fs(e, t) : t?.kind === "wipe" && vs(e) ? Vs(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function Fs(e, t) {
	for (let t of e.querySelectorAll(`[${Cr}], [${wr}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${Cr}] [${jr}]`)].filter((e) => !e.parentElement?.closest(`[${jr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${Tr}]`)].flatMap(xa), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => hs(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(ms);
}
var Is = 100, Ls = /* @__PURE__ */ new WeakMap();
function Rs(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function zs(e, t) {
	Rs(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function Bs(e) {
	Ls.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function Vs(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? Rs(e, i(t, r)) : a ? Rs(e, a(t, r)) : zs(e, i(t, r));
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
			if (e - i > Is && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), Ls.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + Is);
		Ls.set(e, l), c();
	}).then((t) => {
		if (Bs(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? _s(e, 0, r, t) : hs(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var Hs = X.createContext({}), Us = X.createContext(null), Ws = () => X.useContext(Hs), Gs = () => X.useContext(Us), Ks = () => Ws().reveal;
function qs({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = ti({
		theme: r,
		mode: i,
		text: a
	}), [c] = X.useState(() => ({ sent: !1 }));
	return X.useEffect(() => {
		n !== void 0 && li(n);
	}, [n]), (0, Z.jsx)(Hs.Provider, {
		value: t,
		children: (0, Z.jsxs)(Us.Provider, {
			value: c,
			children: [s && (0, Z.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var Js = typeof window > "u" ? X.useEffect : X.useLayoutEffect, Ys = () => X.useInsertionEffect(() => (Yr(), Xr), []), Xs = Number("19.3.1".split(".")[0]) >= 19, Zs = () => {
	let { nonce: e } = Ws();
	return Xs ? (0, Z.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: Gr
	}) : null;
}, Qs = Xs ? { inert: !0 } : { inert: "" }, $s = (e) => X.Children.map(e, (e) => {
	if (!X.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Z.jsx)("span", {
		[jr]: "",
		children: (0, Z.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? X.cloneElement(e, void 0, $s(e.props.children)) : e;
}), ec = () => () => {}, tc = () => X.useSyncExternalStore(ec, () => !1, () => !0), nc = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = X.useRef(null), { nonce: o } = Ws(), s = Gs(), c = tc(), l = Zr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), Js(() => {
		if (!a.current) return;
		let e = new zo(a.current, {
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
			[Sr]: "",
			"aria-hidden": !0,
			...Qs,
			children: [
				(0, Z.jsx)("div", {
					[Cr]: "",
					children: $s(e)
				}),
				(0, Z.jsx)("div", { [wr]: "" }),
				(0, Z.jsx)("div", { [Tr]: "" })
			]
		}),
		c && (0, Z.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, rc = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = X.useRef(null), l = Ks();
	return Js(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), Es(c.current, l, { initial: !r }).then(s), o && (e.memory = new Vo(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), Js(() => {
		!i || !c.current || Ps(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Z.jsx)("div", {
		ref: c,
		[xr]: "",
		children: e
	});
}, ic = class extends X.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = ks(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function ac(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	Ys();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = X.useRef(null);
	Js(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Z.jsx)("div", {
			[jr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Z.jsx)(nc, {
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
	let [y, b] = X.useState({
		id: 0,
		key: g
	}), [x, S] = X.useState([]), C = X.useRef(/* @__PURE__ */ new Map()).current, w = X.useRef(_);
	if (Js(() => {
		w.current = _;
	}), y.key !== g) {
		let e = {
			id: y.id,
			node: w.current
		};
		S((t) => t.some((t) => t.id === e.id) ? t : [...t, e]), b({
			id: y.id + 1,
			key: g,
			from: y.key
		});
	}
	let T = X.useRef(e.onReveal);
	Js(() => {
		T.current = e.onReveal;
	});
	let E = y.key === "content" && y.from === "skeleton" ? () => T.current?.() : void 0, D = (e) => S((t) => t.filter((t) => t.id !== e)), O = [...x.map((e) => (0, Z.jsx)(rc, {
		id: e.id,
		registry: C,
		enter: !1,
		exiting: !0,
		onExited: () => D(e.id),
		children: e.node
	}, e.id)), (0, Z.jsx)(rc, {
		id: y.id,
		registry: C,
		enter: y.id > 0,
		exiting: !1,
		onExited: () => {},
		memory: v,
		onEntered: E,
		children: _
	}, y.id)];
	return (0, Z.jsxs)("div", {
		[br]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Z.jsx)(Zs, {}), (0, Z.jsx)(ic, {
			exiting: x.map((e) => e.id),
			registry: C,
			children: O
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var oc = {
	creators: [Y("follow:followOverview.creators"), Y("follow:followOverview.creatorUnit")],
	enabled: [Y("follow:followOverview.enabledSources"), ""],
	failed: [Y("follow:followCheck.checkFailed"), Y("follow:followOverview.sourceUnit")],
	updates: [Y("follow:followOverview.unwatchedUpdates"), Y("follow:followOverview.itemUnit")],
	subscriptions: [Y("follow:feedSources.footerLabel"), Y("follow:followOverview.actressUnit")],
	releases: [Y("follow:followOverview.unwatchedReleases"), Y("follow:followOverview.itemUnit")]
}, sc = {
	duration: 0,
	delay: 0,
	hold: 150
}, cc;
function lc() {
	return cc || (cc = new CSSStyleSheet(), cc.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), cc;
}
function uc({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Z.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Z.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function dc({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = oc[e], o = (0, X.useRef)(null);
	return (0, X.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = lc();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Z.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: Me({
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
		}) : /* @__PURE__ */ (0, Z.jsx)(qs, {
			reveal: sc,
			children: /* @__PURE__ */ (0, Z.jsx)(ac, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: Y("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Z.jsx)(uc, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var fc = (e) => j.some(([t]) => t === e);
function pc(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, X.useState)(fc(e.tab) ? e.tab : "list"), [u, f] = (0, X.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, X.useState)(() => Nt(e.sort, e.dir).sort), [h, g] = (0, X.useState)(() => Nt(e.sort, e.dir).dir), [_, v] = (0, X.useState)(dt(e.layout) ? e.layout : "default"), [y, b] = (0, X.useState)(bt(e.pageSize)), [x, S] = (0, X.useState)(/* @__PURE__ */ new Set()), [C, w] = (0, X.useState)(/* @__PURE__ */ new Set());
	nn(() => {
		S(/* @__PURE__ */ new Set()), w(/* @__PURE__ */ new Set());
	}), (0, X.useEffect)(() => {
		(x.size || C.size) && q();
	}, [x, C]);
	let T = rn({
		queryKey: ne,
		queryFn: ({ signal: e }) => nt(e)
	}), E = rn({
		queryKey: te,
		queryFn: ({ signal: e }) => et(e)
	}), D = rn({
		queryKey: ee,
		queryFn: ({ signal: e }) => tt(e)
	}), k = T.data || { sources: [] }, A = E.data || {
		root: "",
		providers: []
	}, M = k.sources;
	(0, X.useEffect)(() => {
		S((e) => {
			let t = mt(e, M);
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
	}, re = lt(M), P = M.filter(ut).length, F = M.filter((e) => e.enabled).length, ie = (A.providers || []).filter((e) => e.requirement === "required" && !Ge(e)).length, I = new Set((D.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Z.jsxs)(dn, { children: [
		a ? /* @__PURE__ */ (0, Z.jsx)(V, {
			tone: "warning",
			title: Y("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Z.jsx)(O, {
					href: s,
					children: Y("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: le,
			"aria-label": Y("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Z.jsx)(dc, {
					field: "creators",
					figure: T.data ? re.length : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(dc, {
					field: "enabled",
					figure: T.data ? F : void 0,
					total: M.length,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(dc, {
					field: "failed",
					figure: T.data ? P : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(dc, {
					field: "updates",
					figure: T.data ? k.counts?.new || 0 : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(dc, {
					field: "subscriptions",
					figure: D.data ? I : void 0,
					failed: D.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(dc, {
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
					children: /* @__PURE__ */ (0, Z.jsx)(G, {
						group: "follow",
						label: Y("follow:followManagePage.sectionTabs"),
						value: c,
						panelPrefix: "follow",
						sectionItems: !0,
						tabs: j.map(([e, t]) => ({
							value: e,
							label: t
						})),
						className: "",
						itemClassName: "cursor-pointer whitespace-nowrap",
						onChange: (e) => {
							S(/* @__PURE__ */ new Set()), w(/* @__PURE__ */ new Set()), l(e), N({ tab: e });
						}
					})
				}),
				c === "list" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-list",
					"aria-labelledby": "follow-tab-list",
					className: "flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, Z.jsx)(sr, {
						readOnly: a,
						toast: r,
						onAdd: () => {
							l("add"), N({ tab: "add" });
						},
						selection: {
							ids: C,
							onChange: w,
							onActivate: () => S(/* @__PURE__ */ new Set())
						}
					}), T.data ? /* @__PURE__ */ (0, Z.jsx)(yr, {
						data: k,
						sort: p,
						dir: h,
						page: u,
						layout: _,
						pageSize: y,
						selected: x,
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
							S(e), w(/* @__PURE__ */ new Set());
						},
						onLayout: (e) => {
							v(e), f(1), n({ layout: e }), N({ page: 1 });
						},
						onPageSize: (e) => {
							b(e), f(1), n({ pageSize: e }), N({ page: 1 });
						}
					}) : T.isError ? /* @__PURE__ */ (0, Z.jsx)(V, {
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
						E.data && T.data ? /* @__PURE__ */ (0, Z.jsx)(jn, {
							data: k,
							credentials: A,
							readOnly: a,
							toast: r
						}) : E.isError || T.isError ? /* @__PURE__ */ (0, Z.jsx)(V, {
							tone: "error",
							children: Y("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Z.jsx)("div", {
							role: "status",
							"aria-label": Y("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Z.jsx)(In, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								D.refetch(), l("list"), N({ tab: "list" });
							}
						}),
						T.data ? /* @__PURE__ */ (0, Z.jsx)(Yn, {
							groups: k.author_aliases || [],
							readOnly: a,
							toast: r,
							suggestions: k.alias_suggestions || [],
							sources: k.sources
						}) : null
					]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, Z.jsx)("div", { children: /* @__PURE__ */ (0, Z.jsx)(d, {
			variant: "secondary",
			href: "/settings/subscriptions",
			children: ie ? Y("follow:followManagePage.feedSettingsPending", { count: ie }) : Y("follow:followManagePage.feedSettings")
		}) })
	] });
}
export { pc as FollowManagePage };

//# debugId=648b152f-801d-4a50-8d98-66219538f118