(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "cc73cc05-4363-4ff6-8a9c-a1d35da6327b", e._sentryDebugIdIdentifier = "sentry-dbid-cc73cc05-4363-4ff6-8a9c-a1d35da6327b");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, DataTableFooter as y, DataTableFrame as ee, DataTableSort as b, EmptyFocusButton as x, EmptyState as S, ErrorText as C, ExternalLink as w, FEEDS_KEY as T, FOLLOW_CHECK_KEY as E, FOLLOW_CHECK_TASK as D, FOLLOW_CREDENTIALS_KEY as te, FOLLOW_MANAGE_KEY as O, FOLLOW_MANAGE_NAV as k, FOLLOW_RESOLVE_KEY as A, FieldLabel as j, Help as M, Input as N, LAYOUTS as P, M6 as F, MENU_ITEM as I, MENU_ITEM_INTERACTIVE as L, MENU_POPOVER_SURFACE as R, ModalFrame as ne, Note as z, P7 as re, SORT_DEFAULT_DIR as B, SORT_OPTIONS as ie, STAT_STRIP_SIX as V, Select as ae, SelectItem as oe, SelectionDock as se, SelectionPopover as H, SiteLabel as U, SortDirectionIcon as ce, SortableBoardTabs as le, Switch as ue, Table as de, TableColumnControls as fe, TableColumnResizer as pe, TableSelectionHeader as me, TaskProgress as he, Un as ge, Wt as W, Xf as _e, __toESM as ve, activityKind as ye, addAlias as be, addSource as G, authorGroups as xe, authorName as Se, avatarInner as Ce, busyProps as K, cardClass as we, checkEvidenceGap as Te, checkFailures as Ee, checkFeeds as De, checkReceipt as Oe, checkSummary as ke, checkedText as Ae, clickedBlank as je, codedText as Me, columnVisibilityFeature as Ne, composingKey as Pe, confirmModal as Fe, createColumnHelper as Ie, credentialDone as Le, cx as Re, dZ as ze, dropSources as Be, du as Ve, enterPageSelection as He, errorHeadline as Ue, errorMessage as q, exitPageSelection as We, feedIntervalText as Ge, fetchCheckJob as Ke, fetchCredentials as qe, fetchFeeds as Je, fetchFollow as Ye, fetchResolveJob as Xe, fetchSuggestions as Ze, flexRender as Qe, followFeedByName as $e, followFeedEntity as et, followSuggestKey as tt, groupByAuthor as nt, isBroken as rt, isLayout as it, jobText as at, joinList as J, keepSelected as ot, l7 as st, localTime as ct, lookupFeedActor as lt, mapLimit as ut, markAllPending as dt, pageSizeOf as ft, pageWindow as pt, patchSource as mt, pv as ht, queryClient as gt, quoted as _t, reloadFollowManage as Y, removeAlias as vt, removeFeed as yt, removeSource as bt, renameAliasGroup as xt, require_jsx_runtime as St, require_react as Ct, resolveFollowSort as wt, rowPaginationFeature as Tt, rowSelectionFeature as Et, rowSortingFeature as Dt, runBulkAction as Ot, selectionState as kt, serverLabel as At, setFeedEnabled as jt, setSourceEnabled as Mt, sortLabel as Nt, startCheck as Pt, startResolve as Ft, t as X, tableFeatures as It, tableRows as Lt, toggleGroup as Rt, unmarkItems as zt, useAction as Bt, useBackgroundJob as Vt, useMutation as Ht, usePageSelection as Ut, useQuery as Wt, useTable as Gt, useTablePreferences as Kt } from "./peach-app.js";
import { Page as qt } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as Jt, ErrorLine as Yt, SourceIcon as Xt, SourceLink as Zt, StatusBadge as Qt } from "./peach-app.source-view-Dyh_AG3b.js";
import { createPaginatedRowModel as $t, createSortedRowModel as en, useTableSelection as tn } from "./peach-app.use-table-selection-CnuGRvGn.js";
import { LEGACY_AVATAR_IMG as nn } from "./peach-app.legacy-avatar-NSITxLRS.js";
// src/react/follow-manage/add-source.tsx
var Z = /* @__PURE__ */ ve(Ct(), 1), Q = St(), rn = Re(I, L, "text-body-2-medium"), an = X("follow:addCreatorSource.placeholder"), on = X("follow:addCreatorSource.title"), sn = X("follow:addCreatorSource.searchingByName"), cn = X("follow:addCreatorSource.recognizing"), ln = X("follow:addCreatorSource.noSourceFound"), un = "/settings/subscriptions", dn = (e, t) => `${e}:${t.url}`;
function fn({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
	return (0, Z.useEffect)(() => {
		n.current?.querySelector("[aria-current=\"true\"]")?.scrollIntoView({ block: "nearest" });
	}, [n, i]), /* @__PURE__ */ (0, Q.jsxs)(t, {
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
		"aria-label": X("follow:addCreatorSource.suggestions"),
		className: Re(R, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
		children: [a && !r.length ? /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "px-2 py-1.5",
			children: /* @__PURE__ */ (0, Q.jsx)(l, {
				kind: "radar",
				label: X("follow:addCreatorSource.findingSuggestions")
			})
		}) : null, r.map((e, t) => /* @__PURE__ */ (0, Q.jsxs)(Z.Fragment, { children: [e.group === r[t - 1]?.group ? null : /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "px-2 pt-1 text-caption-1-regular text-text-tertiary",
			children: e.group
		}), /* @__PURE__ */ (0, Q.jsxs)("button", {
			type: "button",
			"aria-current": t === i ? "true" : void 0,
			className: t === i ? Re(rn, "bg-background-secondary-default") : rn,
			onMouseDown: (e) => e.preventDefault(),
			onClick: () => o(e.value),
			children: [
				/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "min-w-0 grow truncate text-left",
					children: e.value
				}),
				e.matched ? /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "shrink-0 text-caption-1-regular text-text-tertiary",
					children: e.matched
				}) : null,
				e.n ? /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "shrink-0 text-caption-1-regular tabular-nums text-text-tertiary",
					children: e.n.toLocaleString()
				}) : null
			]
		})] }, `${e.group}-${e.value}`))]
	});
}
function pn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? X("follow:addCreatorSource.allSources") : X("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Q.jsx)(H, {
		label: X("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: X("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Q.jsx)(Xt, { provider: e.provider }), e.provider_label]
			})
		})),
		onChange: (e, r) => {
			let i = new Set(t);
			r ? i.delete(e) : i.add(e), n(i);
		},
		actions: [
			{
				label: X("follow:shared.selectAll"),
				disabled: !r.length,
				onPress: () => n(/* @__PURE__ */ new Set())
			},
			{
				label: X("follow:shared.selectNone"),
				disabled: !r.length,
				onPress: () => n(new Set(r.map((e) => e.provider_label)))
			},
			{
				label: X("follow:addCreatorSource.credentialSettings"),
				href: un
			}
		]
	});
}
function mn({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Q.jsx)(z, {
		tone: "error",
		title: e.line,
		children: at(e, "error") || X("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: we({
			variant: "outlined",
			padding: "none",
			className: "flex flex-col gap-2 p-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("b", {
				className: "text-body-medium text-text-primary",
				children: e.line
			}),
			a.length ? a.map((e) => {
				let n = dn(t, e);
				return /* @__PURE__ */ (0, Q.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(Xt, { provider: e.provider }),
							/* @__PURE__ */ (0, Q.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Q.jsx)("span", {
								className: "min-w-0 break-words",
								children: Me(e, "label")
							}),
							/* @__PURE__ */ (0, Q.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? X("follow:addCreatorSource.alreadyFollowing") : Me(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Q.jsx)(M, { children: ln }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: Me(e, "evidence")
				}), /* @__PURE__ */ (0, Q.jsx)(w, {
					href: e.url,
					children: X("follow:shared.labeled", {
						label: Me(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Q.jsx)(M, { children: J(o.map(([t, n]) => X("follow:shared.labeled", {
				label: t,
				value: At(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function hn({ data: e, credentials: t, readOnly: n, toast: r }) {
	let [i, a] = (0, Z.useState)(""), [o, s] = (0, Z.useState)(!1), [c, l] = (0, Z.useState)(""), [d, f] = (0, Z.useState)(""), [p, m] = (0, Z.useState)(!1), [h, g] = (0, Z.useState)(null), [_, v] = (0, Z.useState)(-1), y = (0, Z.useRef)(null), ee = (0, Z.useRef)(null), [b, x] = (0, Z.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, Z.useState)(/* @__PURE__ */ new Set()), [w, T] = (0, Z.useState)(""), [E, D] = (0, Z.useState)(0);
	(0, Z.useEffect)(() => {
		let e = i.trim();
		if (o || !e || e.includes("/")) {
			f("");
			return;
		}
		let t = setTimeout(() => f(e), 250);
		return () => clearTimeout(t);
	}, [i, o]);
	let te = Wt({
		queryKey: tt(d),
		queryFn: ({ signal: e }) => Ze(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), O = (0, Z.useMemo)(() => (te.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: At(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: At(e.label_code ?? "", e.label)
	}))), [te.data]), { job: k, running: M, outcome: P, start: F, dismiss: I } = Vt({
		queryKey: A,
		queryFn: ({ signal: e }) => Xe(e),
		start: (e) => Ft([e]),
		onStarted: () => C(/* @__PURE__ */ new Set()),
		onError: (e) => T(q(e)),
		onFinish: (e) => {
			e.status === "failed" && T(at(e, "error") || X("follow:addCreatorSource.searchFailed"));
		}
	}), L = (e) => {
		let t = e.trim();
		!t || n || o || M || F.isPending || (T(""), v(-1), l(t), a(t), f(""), g(t), F.mutate(t));
	}, R = te.isFetching, ne = p && !o && h !== i && (O.length > 0 || R), re = () => {
		v(-1), g(i);
	}, B = (e) => {
		if (!(o || Pe(e.nativeEvent))) {
			if (e.key === "Escape" && ne) re();
			else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!O.length) return;
				if (e.preventDefault(), !ne) {
					g(null);
					return;
				}
				let t = e.key === "ArrowDown" ? 1 : -1;
				v((e) => {
					let n = e + t;
					return n < 0 ? O.length - 1 : n >= O.length ? 0 : n;
				});
			} else e.key === "Enter" && (e.preventDefault(), L(O[_]?.value || i));
		}
	}, ie = P?.results || [], V = ie.flatMap((e, t) => (e.candidates || []).filter((e) => !e.known && !b.has(e.provider_label || "")).map((e) => ({
		candidate: e,
		key: dn(t, e)
	})).filter((e) => !S.has(e.key))), ae = Ht({
		mutationFn: async (e) => {
			let t = [], n = [];
			D(0);
			for (let r of e) {
				try {
					let e = await G(r.candidate);
					n.push(e.source);
				} catch (e) {
					t.push(X("follow:shared.labeled", {
						label: r.candidate.label,
						value: q(e)
					}));
				}
				D((e) => e + 1);
			}
			if (n.length) try {
				await Pt(n);
			} catch (e) {
				t.push(q(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			Y(), e.failures.length ? T(J(e.failures)) : (T(""), I(), r(X("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => T(q(e))
	}), oe = e.suggestions || [], se = !c.includes("/");
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": on,
		className: we({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: on
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						ref: y,
						className: "min-w-64 grow",
						onFocus: () => m(!0),
						onBlur: (e) => {
							let t = e.relatedTarget;
							!e.currentTarget.contains(t) && !ee.current?.contains(t) && m(!1);
						},
						children: [/* @__PURE__ */ (0, Q.jsx)(N, {
							"aria-label": X("follow:addCreatorSource.inputLabel"),
							placeholder: an,
							value: i,
							leadingIcon: ht,
							enterKeyHint: "search",
							isDisabled: n,
							onChange: a,
							onCompositionStart: () => {
								s(!0), v(-1);
							},
							onCompositionEnd: (e) => {
								s(!1), a(e.currentTarget.value);
							},
							onKeyDown: B
						}), ne ? /* @__PURE__ */ (0, Q.jsx)(fn, {
							field: y,
							menu: ee,
							options: O,
							active: _,
							busy: R,
							onPick: L,
							onClose: re
						}) : null]
					}),
					/* @__PURE__ */ (0, Q.jsx)(pn, {
						credentials: t,
						hidden: b,
						onHidden: x
					}),
					/* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...K(M || F.isPending),
						onClick: () => L(i),
						children: X("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [M || F.isPending ? /* @__PURE__ */ (0, Q.jsx)(he, {
					embedded: !0,
					kind: ye("follow-resolve"),
					label: at(k) || (k?.total ? X("follow:addCreatorSource.searchProgress", {
						checked: k.checked || 0,
						count: k.total
					}) : se ? sn : cn),
					value: k?.checked,
					total: k?.total
				}) : null, w ? /* @__PURE__ */ (0, Q.jsx)(z, {
					tone: "error",
					title: X("follow:addJavFeed.notCompleted"),
					children: w
				}) : null]
			}),
			ie.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:addCreatorSource.results") }),
					ie.map((e, t) => /* @__PURE__ */ (0, Q.jsx)(mn, {
						row: e,
						at: t,
						hidden: b,
						unpicked: S,
						onPick: (e, t) => {
							let n = new Set(S);
							t ? n.delete(e) : n.add(e), C(n);
						}
					}, `${e.line}-${t}`)),
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(u, {
								variant: "secondary",
								size: "small",
								onClick: () => I(),
								children: X("follow:shared.close")
							}),
							/* @__PURE__ */ (0, Q.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: n || !V.length,
								...K(ae.isPending),
								onClick: () => ae.mutate(V),
								children: X("follow:addCreatorSource.addSelected", { count: V.length })
							}),
							ae.isPending ? /* @__PURE__ */ (0, Q.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:addCreatorSource.addingProgress", {
									added: E,
									count: V.length
								})
							}) : null
						]
					})
				]
			}) : null,
			oe.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: X("follow:addCreatorSource.suggested")
				}), oe.map((e) => /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: n,
					title: e.origin ? X("follow:addCreatorSource.historyVisitsFrom", {
						count: e.visits,
						origin: e.origin
					}) : X("follow:addCreatorSource.historyVisits", { count: e.visits }),
					onClick: () => L(e.name),
					children: e.name
				}, e.name))]
			}) : null
		]
	});
}
// src/react/follow-manage/add-feed.tsx
var gn = X("follow:addJavFeed.placeholder"), _n = X("follow:addJavFeed.title");
function vn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: X("follow:addJavFeed.cardsSplitAcrossPeople", { names: J([...n.values()]) }),
		blocked: !0
	};
	let [r] = n.values();
	return r ? {
		text: X("follow:addJavFeed.willAddUnder", { name: r }),
		blocked: !1
	} : e.known ? {
		text: X("follow:addJavFeed.willAddUnderKnown", { name: e.known.name }),
		blocked: !1
	} : {
		text: X("follow:addJavFeed.willCreate", { name: e.q }),
		blocked: !1
	};
}
function yn({ card: e, picked: t, onPick: n }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-wrap items-center gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)(m, {
			isSelected: t,
			onChange: n,
			children: /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 flex-wrap items-center gap-1.5",
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "min-w-0 break-words",
						children: J(e.names)
					}),
					e.record ? /* @__PURE__ */ (0, Q.jsx)(g, {
						variant: "caption",
						color: "neutral",
						children: e.record
					}) : null,
					e.held_by ? /* @__PURE__ */ (0, Q.jsx)("small", {
						className: "text-caption-1-regular text-text-secondary",
						children: X("follow:addJavFeed.alreadyUnder", { name: e.held_by.name })
					}) : null
				]
			})
		}), /* @__PURE__ */ (0, Q.jsx)(w, {
			href: e.url,
			children: e.id
		})]
	});
}
function bn({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, Z.useState)(""), [a, o] = (0, Z.useState)(null), [s, c] = (0, Z.useState)(/* @__PURE__ */ new Set()), l = Bt(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => lt(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !Pe(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => $e(a.q, [...s], e), (e) => {
			t(e.created ? X("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : X("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => et(e.id, t), () => {
			t(X("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? vn(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": _n,
		className: we({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: _n
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Q.jsx)(N, {
						"aria-label": X("follow:addJavFeed.actressName"),
						placeholder: gn,
						value: r,
						leadingIcon: ht,
						enterKeyHint: "search",
						isDisabled: e,
						onChange: i,
						onKeyDown: f
					})
				}), /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "primary",
					disabled: e || !r.trim(),
					...K(l.busy === "lookup"),
					onClick: d,
					children: X("follow:shared.search")
				})]
			}),
			l.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				tone: "error",
				title: X("follow:addJavFeed.notCompleted"),
				children: l.error
			}) : null,
			a ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					a.unavailable ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "warning",
						title: X("follow:addJavFeed.javdbSearchFailed"),
						children: At(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Q.jsx)(yn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Q.jsx)(M, { children: a.unavailable ? X("follow:addJavFeed.noCardsThisTime") : X("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Q.jsx)(M, {
						role: "status",
						children: s.size ? g.text : X("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Q.jsx)(M, {
						role: "status",
						children: _.following ? X("follow:addJavFeed.alreadySubscribed", { name: _.name }) : X("follow:addJavFeed.canSubscribeDirectly", { name: _.name })
					}) : null,
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(u, {
								variant: "secondary",
								size: "small",
								onClick: p,
								children: X("follow:shared.close")
							}),
							a.candidates.length ? /* @__PURE__ */ (0, Q.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: e || !s.size || g.blocked,
								...K(l.busy === "follow"),
								onClick: m,
								children: X("follow:addJavFeed.subscribePicked", { count: s.size })
							}) : null,
							_ && !_.following ? /* @__PURE__ */ (0, Q.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: e,
								...K(l.busy === "known"),
								onClick: h,
								children: X("follow:addJavFeed.subscribeTo", { name: _.name })
							}) : null
						]
					})
				]
			}) : null
		]
	});
}
// src/react/follow-manage/alias-rename-dialog.tsx
function xn({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Q.jsx)(ne, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: X("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Q.jsx)(Sn, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function Sn({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, Z.useState)(t.canonical_name), o = Bt();
	return /* @__PURE__ */ (0, Q.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => xt(t.canonical_key, i.trim(), e), () => {
				Y(), r(X("follow:creatorAliases.renamed", { name: i.trim() })), n();
			});
		},
		className: "flex min-h-0 flex-col gap-4 p-5",
		children: [
			/* @__PURE__ */ (0, Q.jsx)(e, {
				slot: "title",
				className: "text-title-2-semibold text-text-primary",
				children: X("follow:creatorAliases.rename")
			}),
			/* @__PURE__ */ (0, Q.jsxs)("p", {
				className: "text-body-2-regular wrap-anywhere text-text-secondary",
				children: [X("follow:creatorAliases.currentName"), t.canonical_name]
			}),
			/* @__PURE__ */ (0, Q.jsx)(N, {
				"aria-label": X("follow:creatorAliases.displayName"),
				autoFocus: !0,
				value: i,
				onChange: a
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:creatorAliases.chooseExisting") }), /* @__PURE__ */ (0, Q.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: t.aliases.map((e) => /* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: () => a(e.name),
						children: e.name
					}, e.key))
				})]
			}),
			/* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular text-text-secondary",
				children: X("follow:creatorAliases.renameHint")
			}),
			o.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				tone: "error",
				children: o.error
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap justify-end gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					onClick: n,
					children: X("follow:shared.cancel")
				}), /* @__PURE__ */ (0, Q.jsx)(u, {
					type: "submit",
					variant: "primary",
					disabled: !i.trim() || i.trim() === t.canonical_name,
					...K(!!o.busy),
					children: X("follow:creatorAliases.rename")
				})]
			})
		]
	});
}
// src/react/follow-manage/alias-manager.tsx
var Cn = (e) => X("follow:creatorAliases.removeBody", { alias: e }), wn = It({
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	rowPaginationFeature: Tt,
	columnVisibilityFeature: Ne,
	sortedRowModel: en(),
	paginatedRowModel: $t()
}), Tn = wn, En = {
	id: "select",
	label: X("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, Dn = {
	id: "canonical",
	label: X("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, On = [
	En,
	Dn,
	{
		id: "alias",
		label: X("follow:creatorAliases.platformAlias"),
		width: 240
	},
	{
		id: "evidence",
		label: X("follow:creatorAliases.evidence"),
		width: 320
	},
	{
		id: "actions",
		label: X("follow:shared.actions"),
		width: 112
	}
], kn = [
	En,
	Dn,
	{
		id: "aliases",
		label: X("follow:creatorAliases.platformAlias"),
		width: 400
	},
	{
		id: "actions",
		label: X("follow:shared.actions"),
		width: 184,
		min: 168
	}
], An = (e) => e.alias;
function jn(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function Mn({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)(Jt, {
			group: jn(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Q.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function Nn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = Kt("alias-suggestions", On), f = Kt("alias-saved", kn), [p, g] = (0, Z.useState)(null), [_, v] = (0, Z.useState)({}), [w, T] = (0, Z.useState)({});
	Ut(() => {
		v({}), T({});
	}), (0, Z.useEffect)(() => {
		(Object.values(_).some(Boolean) || Object.values(w).some(Boolean)) && He();
	}, [_, w]);
	let E = tn(() => v({})), D = tn(() => T({})), [te, O] = (0, Z.useState)([]), [k, A] = (0, Z.useState)([]), [M, P] = (0, Z.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [F, I] = (0, Z.useState)({
		pageIndex: 0,
		pageSize: 20
	}), L = {
		...M,
		pageIndex: Math.min(M.pageIndex, Math.max(0, Math.ceil(t.length / M.pageSize) - 1))
	}, R = {
		...F,
		pageIndex: Math.min(F.pageIndex, Math.max(0, Math.ceil(e.length / F.pageSize) - 1))
	}, [ne, z] = (0, Z.useState)(""), [B, ie] = (0, Z.useState)(""), [V, ae] = (0, Z.useState)(""), oe = Ht({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await be(n.canonical, n.alias);
				} catch (n) {
					throw t && Y(), Error(X("follow:creatorAliases.mergePartialError", {
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
			z(""), v({}), Y();
		},
		onError: (e) => z(q(e))
	}), H = Ht({
		mutationFn: (e) => be(e.canonical, e.alias),
		onSuccess: () => {
			z(""), ie(""), ae(""), Y(), l(X("follow:creatorAliases.saved"));
		},
		onError: (e) => z(q(e))
	}), U = Ht({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await vt(e), n += 1;
			} catch (e) {
				throw Error(X("follow:creatorAliases.removePartialError", {
					error: q(e),
					removed: n,
					count: t.length - n
				}));
			} finally {
				Y();
			}
		},
		onSuccess: (e, t) => {
			z(""), T({}), typeof t == "string" && l(X("follow:creatorAliases.removed"));
		},
		onError: (e) => z(q(e))
	}), ce = {
		receipt: l,
		failure: (e) => z(q(e))
	}, le = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: X(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: X(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: X("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: J(t.map((e) => X("follow:creatorAliases.mergePair", {
					alias: _t(e.alias),
					canonical: _t(e.canonical)
				})))
			}),
			confirmLabel: X(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await oe.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await vt(n.alias);
				await Y();
			};
		},
		receipt: (e) => X("follow:creatorAliases.merged", { count: e.length })
	}), ue = (e, t) => {
		e.length && Ot(le(t, e.length), e, ce).catch(ce.failure);
	}, he = {
		key: "remove",
		reversal: "undo",
		label: X("follow:creatorAliases.removeSelectedCount", { count: 0 }),
		confirm: (e) => ({
			title: X("follow:creatorAliases.removeSelectedTitle"),
			body: X("follow:creatorAliases.removeSelectedBody", { count: e.length }),
			items: e.map((e) => e.name),
			confirmLabel: X("follow:creatorAliases.removeSelectedConfirm")
		}),
		run: async (e) => (await U.mutateAsync(e.map((e) => e.name)), async () => {
			for (let t of e) await be(t.canonical, t.name);
			await Y();
		}),
		receipt: () => X("follow:creatorAliases.removed")
	}, ge = (e) => void Fe({
		title: X("follow:creatorAliases.removeTitle"),
		body: Cn(e),
		confirmLabel: X("follow:creatorAliases.removeTitle"),
		onConfirm: () => U.mutateAsync(e)
	}), W = (0, Z.useRef)({
		sources: s,
		readOnly: c,
		merging: oe.isPending,
		removing: U.isPending,
		merge: ue,
		remove: ge,
		rename: g
	});
	W.current = {
		sources: s,
		readOnly: c,
		merging: oe.isPending,
		removing: U.isPending,
		merge: ue,
		remove: ge,
		rename: g
	};
	let ve = (0, Z.useMemo)(() => {
		let e = Ie();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(me, {
					table: e.table,
					label: X("follow:creatorAliases.selectAllPending")
				}),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					"aria-label": X("follow:creatorAliases.selectPendingRow", {
						alias: e.row.original.alias,
						name: e.row.original.canonical
					}),
					onChange: (t) => e.row.toggleSelected(t)
				})
			}),
			e.accessor("canonical", {
				header: X("follow:creatorAliases.displayName"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Mn, {
					sources: W.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: X("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => At(e.evidence_code ?? "", e.evidence, e.evidence_params), {
				id: "evidence",
				header: X("follow:creatorAliases.evidence"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: e.getValue()
				})
			}),
			e.display({
				id: "actions",
				header: X("follow:shared.actions"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: W.current.readOnly,
					...K(W.current.merging),
					onClick: () => W.current.merge([e.row.original], !1),
					children: X("follow:shared.merge")
				})
			})
		]);
	}, []), ye = (0, Z.useMemo)(() => {
		let e = Ie();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Q.jsx)(me, {
					table: e,
					label: X("follow:creatorAliases.selectAllSaved")
				}),
				cell: ({ row: e }) => /* @__PURE__ */ (0, Q.jsx)(m, {
					slot: null,
					"aria-label": X("follow:creatorAliases.selectSavedRow", { name: e.original.canonical_name }),
					isSelected: e.getIsSelected(),
					onChange: (t) => e.toggleSelected(t)
				})
			}),
			e.accessor("canonical_name", {
				id: "canonical",
				header: X("follow:creatorAliases.displayName"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Mn, {
					sources: W.current.sources,
					name: e.getValue(),
					canonicalKey: e.row.original.canonical_key
				})
			}),
			e.accessor("aliases", {
				header: X("follow:creatorAliases.platformAlias"),
				sortFn: (e, t) => e.original.aliases.map((e) => e.name).join(" ").localeCompare(t.original.aliases.map((e) => e.name).join(" "), "zh-CN"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "flex flex-wrap items-center gap-1.5",
					children: e.getValue().map((e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "inline-flex items-center gap-1 rounded-md bg-background-secondary-default px-1.5 py-1 text-caption-1-medium text-text-secondary",
						children: [e.name, /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "ghost",
							size: "xs",
							iconOnly: !0,
							leadingIcon: re,
							"aria-label": X("follow:creatorAliases.removeAliasNamed", { name: e.name }),
							disabled: W.current.readOnly,
							...K(W.current.removing),
							onClick: () => W.current.remove(e.name)
						})]
					}, e.key))
				})
			}),
			e.display({
				id: "actions",
				header: X("follow:shared.actions"),
				cell: ({ row: e }) => /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: W.current.readOnly,
					"aria-label": X("follow:creatorAliases.renameRowLabel", { name: e.original.canonical_name }),
					onClick: () => W.current.rename(e.original),
					children: X("follow:creatorAliases.rename")
				})
			})
		]);
	}, []), G = Gt({
		features: wn,
		data: t,
		columns: ve,
		getRowId: An,
		state: {
			rowSelection: _,
			sorting: te,
			pagination: L,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			E(), v(e);
		},
		onSortingChange: (e) => {
			O(e), P((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: P,
		enableRowSelection: !0
	}), xe = Gt({
		features: Tn,
		data: e,
		columns: ye,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: w,
			sorting: k,
			pagination: R,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			D(), T(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			A(e), I((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: I
	}), Se = G.getSelectedRowModel().rows.map((e) => e.original), Ce = xe.getSelectedRowModel().rows.flatMap((e) => e.original.aliases.map((t) => ({
		name: t.name,
		canonical: e.original.canonical_name
	}))), Te = K(oe.isPending);
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: we({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: X("follow:creatorAliases.title")
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:creatorAliases.addManually") }), /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(N, {
							"aria-label": X("follow:creatorAliases.displayName"),
							placeholder: X("follow:creatorAliases.displayNamePlaceholder"),
							value: B,
							onChange: ie,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Q.jsx)(N, {
							"aria-label": X("follow:creatorAliases.platformAlias"),
							placeholder: X("follow:creatorAliases.platformAlias"),
							value: V,
							onChange: ae,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "primary",
							disabled: c || !B.trim() || !V.trim(),
							...K(H.isPending),
							onClick: () => H.mutate({
								canonical: B.trim(),
								alias: V.trim()
							}),
							children: X("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			ne ? /* @__PURE__ */ (0, Q.jsx)(C, { children: ne }) : null,
			t.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:creatorAliases.groupCount", { count: t.length })
							})]
						}), /* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [
								/* @__PURE__ */ (0, Q.jsx)(u, {
									variant: "primary",
									size: "small",
									disabled: c,
									...Te,
									onClick: () => ue(t, !0),
									children: X("follow:creatorAliases.mergeAllCount", { count: t.length })
								}),
								/* @__PURE__ */ (0, Q.jsx)(b, {
									label: X("follow:creatorAliases.pendingTable"),
									sorting: te,
									options: [
										{
											id: "canonical",
											label: X("follow:creatorAliases.displayName")
										},
										{
											id: "alias",
											label: X("follow:creatorAliases.platformAlias")
										},
										{
											id: "evidence",
											label: X("follow:creatorAliases.evidence")
										}
									],
									onChange: (e) => {
										O(e), P((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Q.jsx)(fe, {
									preferences: d,
									label: X("follow:creatorAliases.pendingTable")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, Q.jsx)(se, {
						label: X("follow:creatorAliases.pendingBulkActions"),
						visible: Se.length > 0,
						count: X("follow:creatorAliases.groupsSelected", { count: Se.length }),
						actions: [{
							action: le(!1, Se.length),
							items: Se,
							host: ce,
							disabled: c || oe.isPending
						}],
						children: /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: We,
							children: X("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(ee, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => G.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Q.jsxs)(de, {
							"aria-label": X("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: te[0] ? {
								column: te[0].id,
								direction: te[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => G.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [G.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [Qe(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(pe, {
									preferences: d,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Q.jsx)(r, {
								id: "remaining-space",
								"aria-label": X("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: d.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Q.jsx)(n, { children: G.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(y, {
						label: X("follow:creatorAliases.pendingTable"),
						unit: X("follow:creatorAliases.groupUnit"),
						total: t.length,
						pagination: L,
						onChange: P
					})
				]
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: X("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:creatorAliases.groupCount", { count: e.length })
							})]
						}), /* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Q.jsx)(b, {
								label: X("follow:creatorAliases.saved"),
								sorting: k,
								options: [{
									id: "canonical",
									label: X("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: X("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									A(e), I((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Q.jsx)(fe, {
								preferences: f,
								label: X("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Q.jsx)(se, {
						label: X("follow:creatorAliases.savedBulkActions"),
						visible: Ce.length > 0,
						count: X("follow:creatorAliases.aliasesSelected", { count: Ce.length }),
						actions: [{
							action: {
								...he,
								label: X("follow:creatorAliases.removeSelectedCount", { count: Ce.length })
							},
							items: Ce,
							host: ce,
							disabled: c || U.isPending
						}],
						children: /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: We,
							children: X("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(ee, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => xe.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Q.jsxs)(de, {
							"aria-label": X("follow:creatorAliases.saved"),
							size: "sm",
							sortDescriptor: k[0] ? {
								column: k[0].id,
								direction: k[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => xe.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [xe.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [Qe(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(pe, {
									preferences: f,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Q.jsx)(r, {
								id: "remaining-space",
								"aria-label": X("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: f.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Q.jsx)(n, { children: xe.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}), /* @__PURE__ */ (0, Q.jsx)(y, {
						label: X("follow:creatorAliases.saved"),
						unit: X("follow:creatorAliases.groupUnit"),
						total: e.length,
						pagination: R,
						onChange: I
					})] }) : /* @__PURE__ */ (0, Q.jsx)(S, {
						size: "compact",
						icon: _e,
						title: X("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Q.jsx)(x, {
							target: `input[aria-label="${X("follow:creatorAliases.displayName")}"]`,
							children: X("follow:creatorAliases.addAlias")
						}),
						children: X("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)(xn, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var Pn = It({
	rowPaginationFeature: Tt,
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	columnVisibilityFeature: Ne,
	sortedRowModel: en(),
	paginatedRowModel: $t()
}), Fn = {
	select: X("follow:shared.select"),
	name: X("follow:shared.name"),
	kind: X("follow:shared.type"),
	origin: X("follow:followFeed.filterKindSource"),
	status: X("follow:shared.status"),
	interval: X("follow:feedSources.colInterval"),
	fetched: X("follow:feedSources.colLastFetched"),
	fresh: X("follow:feedSources.colLastAdded"),
	actions: X("follow:shared.actions")
}, In = /* @__PURE__ */ new Set(["actions"]), Ln = Object.entries(Fn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), Rn = () => gt.invalidateQueries({
	queryKey: T,
	exact: !0
}), zn = (e) => e.name || e.url;
function Bn(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function Vn({ source: e }) {
	return e.enabled ? e.last_error ? /* @__PURE__ */ (0, Q.jsx)(g, {
		variant: "caption",
		color: "rose",
		children: X("follow:feedSources.fetchFailed")
	}) : e.last_fetched_at ? /* @__PURE__ */ (0, Q.jsx)(g, {
		variant: "caption",
		color: "lime",
		children: X("follow:shared.ok")
	}) : /* @__PURE__ */ (0, Q.jsx)(g, {
		variant: "caption",
		color: "gray",
		children: X("follow:feedSources.notChecked")
	}) : /* @__PURE__ */ (0, Q.jsx)(g, {
		variant: "caption",
		color: "gray",
		children: X("follow:shared.paused")
	});
}
function Hn({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Q.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${nn}`,
		dangerouslySetInnerHTML: { __html: Ce(zn(e), t, null, "performer") }
	});
}
var Un = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function Wn(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function Gn(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return Fe({
		title: n ? X("follow:feedSources.removeOne") : X("follow:feedSources.removeMany", { count: e.length }),
		body: n ? X("follow:feedSources.removeOneBody", { name: zn(n) }) : X("follow:feedSources.removeManyBody"),
		confirmLabel: X(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: t
	});
}
function Kn({ readOnly: e, toast: t, onAdd: c, selection: l }) {
	let d = Wt({
		queryKey: T,
		queryFn: ({ signal: e }) => Je(e)
	}), p = Bt(), g = Kt("jav-feeds", Ln), _ = d.data, v = (0, Z.useMemo)(() => _?.sources ?? [], [_]), [x, w] = (0, Z.useState)(/* @__PURE__ */ new Set()), E = l?.ids ?? x, D = l?.onChange ?? w, [te, O] = (0, Z.useState)(1), [k, A] = (0, Z.useState)(20), [j, N] = (0, Z.useState)([]), P = pt(v.length, k, te);
	(0, Z.useEffect)(() => {
		O((e) => Math.min(e, P.pages));
	}, [P.pages]), (0, Z.useEffect)(() => {
		D((e) => {
			let t = new Set(v.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [v, D]);
	let I = Ht({
		mutationFn: async (e) => {
			let t = await ut(e.ids, 4, async (t) => {
				e.action === "remove" ? await yt(t) : await jt(t, e.action === "enabled");
			});
			return {
				...e,
				results: t
			};
		},
		onSuccess: (e) => {
			let t = e.results.filter((e) => !e.ok);
			if (D(/* @__PURE__ */ new Set()), Rn(), t.length) {
				let e = t[0];
				p.setError(X("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : q(e.error)
				}));
			}
		},
		onError: (e) => p.setError(q(e))
	}), L = {
		receipt: t,
		failure: (e) => p.setError(q(e))
	}, R = (e) => ({
		key: e ? "enable" : "pause",
		label: X(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: X(e ? "follow:feedSources.enableMany" : "follow:feedSources.pauseMany"),
			body: X(e ? "follow:feedSources.enableManyBody" : "follow:feedSources.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => t.enabled !== e), { results: r } = await I.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await ut(i.map((e) => e.id), 4, (t) => jt(t, !e)), await Rn();
			};
		},
		receipt: (t) => X(e ? "follow:feedSources.enabledMany" : "follow:feedSources.pausedMany", { count: t.length })
	}), ne = {
		key: "remove",
		label: X("follow:shared.remove"),
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: X("follow:feedSources.removeMany", { count: e.length }),
			danger: !0,
			body: X("follow:feedSources.removeManyBody"),
			confirmLabel: X("follow:feedSources.removeSelected")
		}),
		run: async (e) => {
			await I.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => X("follow:feedSources.removedMany", { count: e.length })
	}, re = (0, Z.useMemo)(() => Wn(v), [v]), B = (0, Z.useRef)({
		readOnly: e,
		shared: re,
		busy: null,
		toggle: () => {},
		fetch: () => {},
		remove: () => {}
	});
	B.current = {
		readOnly: e,
		shared: re,
		busy: p.busy,
		toggle: (e, t) => void p.run(`enabled-${e.id}`, (n) => jt(e.id, t, n), () => void Rn()),
		fetch: (e) => void p.run(`check-${e.id}`, (t) => De(t, [e.id]), () => void Rn()),
		remove: (e) => void Gn([e], async () => {
			await yt(e.id), t(X("follow:feedSources.removedOne", { name: zn(e) })), Rn();
		})
	};
	let ie = (0, Z.useMemo)(() => {
		let e = Ie(), t = (e) => () => Fn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(me, {
					table: e.table,
					label: X("follow:feedSources.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": X("follow:shared.selectNamed", { name: zn(e.row.original) })
				})
			}),
			e.accessor(zn, {
				id: "name",
				header: t("name"),
				cell: (e) => {
					let t = Un(e.row.original, B.current.shared);
					return /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(Hn, { source: e.row.original }),
							e.getValue(),
							t ? /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								title: X("follow:feedSources.aliasTitle", { alias: t }),
								children: t
							}) : null
						]
					});
				}
			}),
			e.accessor((e) => Me(e, "kind_label"), {
				id: "kind",
				header: t("kind"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap",
					children: e.getValue()
				})
			}),
			e.accessor((e) => e.url, {
				id: "origin",
				header: t("origin"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("a", {
					href: e.getValue(),
					target: "_blank",
					rel: "noopener noreferrer",
					title: X("follow:followDetail.viewOnSite"),
					className: "max-w-full text-text-primary underline-offset-2 hover:underline",
					children: [/* @__PURE__ */ (0, Q.jsx)(U, {
						site: e.row.original.kind.startsWith("javdb") ? "javdb" : e.row.original.kind.startsWith("dmm") ? "dmm" : Bn(e.getValue()),
						label: Bn(e.getValue())
					}), /* @__PURE__ */ (0, Q.jsx)(W, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? X("follow:feedSources.fetchFailed") : e.enabled ? X("follow:shared.enabled") : X("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Vn, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap",
					children: Ge(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? ct(e.row.original.last_fetched_at) : X("follow:feedSources.neverFetched")
				})
			}),
			e.accessor((e) => e.last_new_count, {
				id: "fresh",
				header: t("fresh"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: X("follow:feedSources.itemCount", { count: e.getValue() })
				})
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(ue, {
							"aria-label": X("follow:shared.enableNamed", { name: zn(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: B.current.readOnly,
							onChange: (t) => B.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ze,
							"aria-label": X("follow:feedSources.fetchNamed", { name: zn(e.row.original) }),
							disabled: B.current.readOnly,
							...K(B.current.busy === `check-${e.row.original.id}`),
							onClick: () => B.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
							"aria-label": X("follow:shared.removeNamed", { name: zn(e.row.original) }),
							disabled: B.current.readOnly,
							onClick: () => B.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), V = (0, Z.useMemo)(() => Object.fromEntries([...E].map((e) => [String(e), !0])), [E]), ae = Gt({
		features: Pn,
		data: v,
		columns: ie,
		getRowId: (e) => String(e.id),
		state: {
			rowSelection: V,
			sorting: j,
			pagination: {
				pageIndex: P.page - 1,
				pageSize: k
			},
			columnVisibility: g.visibility
		},
		onColumnVisibilityChange: g.change,
		onSortingChange: (e) => {
			N(e), O(1);
		},
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			l?.onActivate();
			let t = typeof e == "function" ? e(V) : e;
			D(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	});
	if (!_) return d.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
		tone: "error",
		title: X("follow:feedSources.loadFailed"),
		children: q(d.error)
	}) : /* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:feedSources.loading") });
	let oe = () => void p.run("check", (e) => De(e), () => void Rn()), H = (e) => {
		l?.onActivate(), D((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, ce = v.filter((e) => E.has(e.id)), le = v.filter((e) => e.last_error);
	return /* @__PURE__ */ (0, Q.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Q.jsxs)("section", {
			"aria-label": X("follow:feedSources.listLabel"),
			className: we({
				padding: "none",
				className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
			}),
			children: [
				/* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-responsive-toolbar": "",
					children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-toolbar-heading": "",
						children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
							className: "text-title-2-medium text-text-primary",
							children: X("follow:feedSources.title")
						}), /* @__PURE__ */ (0, Q.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: X("follow:feedSources.summary", {
								count: v.length,
								unread: Number(_.unread) || 0
							})
						})]
					}), /* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-toolbar-actions": "",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(u, {
								onClick: oe,
								disabled: e,
								...K(p.busy === "check"),
								children: X("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Q.jsx)(fe, {
								preferences: g,
								label: X("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Q.jsx)(b, {
								label: X("follow:feedSources.title"),
								sorting: j,
								onChange: (e) => {
									N(e), O(1);
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
									label: Fn[e]
								}))
							})
						]
					})]
				}),
				le.length || p.error ? /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [le.length ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "error",
						title: X("follow:feedSources.failedTitle", { count: le.length }),
						extra: /* @__PURE__ */ (0, Q.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: le.map((e) => /* @__PURE__ */ (0, Q.jsx)("li", {
								className: "min-w-0 truncate",
								title: Me(e, "last_error"),
								children: X("follow:shared.labeled", {
									label: zn(e),
									value: Ue(Me(e, "last_error")) || X("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: X("follow:feedSources.failedBody")
					}) : null, p.error ? /* @__PURE__ */ (0, Q.jsx)(C, { children: p.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Q.jsx)(se, {
					visible: ce.length > 0,
					label: X("follow:feedSources.bulkActions"),
					count: X("follow:feedSources.selectedCount", { count: ce.length }),
					actions: [
						R(!0),
						R(!1),
						ne
					].map((t) => ({
						action: t,
						items: ce,
						host: L,
						disabled: e || I.isPending
					})),
					children: /* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: We,
						children: X("follow:shared.clearSelection")
					})
				}),
				v.length ? /* @__PURE__ */ (0, Q.jsx)(ee, {
					follow: !0,
					preferences: g,
					onRowClick: (e) => H(Number(e)),
					children: /* @__PURE__ */ (0, Q.jsxs)(de, {
						"aria-label": X("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: j[0] ? {
							column: j[0].id,
							direction: j[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => ae.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [ae.getHeaderGroups()[0].headers.map((e) => {
							let t = Qe(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...g.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [In.has(e.column.id) ? /* @__PURE__ */ (0, Q.jsx)(s, { children: t }) : /* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [t, e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(pe, {
									preferences: g,
									id: e.id
								})] })
							}, e.id);
						}), /* @__PURE__ */ (0, Q.jsx)(r, {
							id: "remaining-space",
							"aria-label": X("follow:shared.rowSpacer"),
							"data-table-space": "",
							width: g.spaceWidth,
							minWidth: 0
						})] }), /* @__PURE__ */ (0, Q.jsx)(n, { children: ae.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
						}, e.id)) })]
					})
				}) : /* @__PURE__ */ (0, Q.jsx)(S, {
					icon: f,
					title: X("follow:feedSources.empty"),
					size: "compact",
					actions: e ? void 0 : /* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						onClick: c,
						children: X("follow:feedSources.add")
					}),
					children: X("follow:feedSources.emptyHint")
				}),
				v.length ? /* @__PURE__ */ (0, Q.jsx)(y, {
					label: X("follow:feedSources.footerLabel"),
					total: P.total,
					unit: X("follow:feedSources.unit"),
					pagination: {
						pageIndex: P.page - 1,
						pageSize: k
					},
					onChange: (e) => {
						A(e.pageSize), O(e.pageIndex + 1);
					}
				}) : null,
				/* @__PURE__ */ (0, Q.jsx)("footer", {
					className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
					children: /* @__PURE__ */ (0, Q.jsx)("span", {
						role: "status",
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: X("follow:feedSources.footerSummary", {
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
var qn = It({
	rowPaginationFeature: Tt,
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	columnVisibilityFeature: Ne,
	paginatedRowModel: $t()
}), Jn = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), Yn = 740;
function Xn() {
	let [e, t] = (0, Z.useState)(!1), n = (0, Z.useRef)(null), r = (0, Z.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < Yn));
		r.observe(e), n.current = r, t(e.clientWidth < Yn);
	}, []);
	return (0, Z.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var Zn = {
	select: X("follow:shared.select"),
	author: X("follow:shared.creator"),
	source: X("follow:followFeed.filterKindSource"),
	provider: X("follow:shared.site"),
	status: X("follow:shared.status"),
	checked: X("follow:sourceList.colLastChecked"),
	actions: X("follow:shared.actions")
}, Qn = Object.entries(Zn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
}));
function $n({ source: e, selected: t, onToggle: n, handlers: r }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"data-selected": t || void 0,
		"data-follow-source-row": "",
		className: "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3 last:rounded-b-lg max-sm:gap-x-2",
		onClick: (e) => {
			je(e, e.currentTarget) && n(!t);
		},
		children: [
			/* @__PURE__ */ (0, Q.jsx)(m, {
				isSelected: t,
				onChange: n,
				"aria-label": X("follow:shared.selectNamed", { name: e.label })
			}),
			/* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 grow basis-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					"data-follow-source-site": "",
					className: "flex shrink-0 items-center text-body-medium",
					children: /* @__PURE__ */ (0, Q.jsx)(Xt, { provider: e.provider })
				}), /* @__PURE__ */ (0, Q.jsx)(Zt, { source: e })]
			}),
			/* @__PURE__ */ (0, Q.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Q.jsx)(Qt, { source: e }),
			e.last_error ? /* @__PURE__ */ (0, Q.jsxs)("span", {
				"data-follow-source-error": "",
				className: "flex min-w-0 basis-full gap-3 max-sm:gap-x-2 sm:order-last",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					"aria-hidden": !0,
					className: "w-4 shrink-0"
				}), /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex min-w-0 grow gap-1.5",
					children: [/* @__PURE__ */ (0, Q.jsx)("span", {
						"aria-hidden": !0,
						className: "w-(--icon-inline) shrink-0 text-body-medium"
					}), /* @__PURE__ */ (0, Q.jsx)("span", {
						className: "min-w-0 grow",
						children: /* @__PURE__ */ (0, Q.jsx)(Yt, { text: Me(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: Ae(e)
					}),
					/* @__PURE__ */ (0, Q.jsx)(ue, {
						"aria-label": X("follow:shared.enableNamed", { name: e.label }),
						isSelected: e.enabled,
						isDisabled: r.readOnly,
						onChange: (t) => r.toggle(e, t)
					}),
					/* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex shrink-0 items-center gap-1",
						children: [/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ze,
							"aria-label": X("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...K(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
							"aria-label": X("follow:shared.removeNamed", { name: e.label }),
							disabled: r.readOnly,
							onClick: () => r.remove(e)
						})]
					})
				]
			})
		]
	});
}
function er({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(rt).length, p = J([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = kt(r, l);
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": X("follow:sourceList.groupLabel", { name: t }),
		className: we({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Q.jsx)(Jt, {
					group: e,
					name: t
				}),
				/* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex min-w-0 grow basis-0 flex-col gap-1",
					children: [/* @__PURE__ */ (0, Q.jsx)("b", {
						className: "min-w-0 text-body-medium wrap-anywhere text-text-primary",
						children: t
					}), /* @__PURE__ */ (0, Q.jsxs)("span", {
						"data-follow-author-sites": "",
						className: "flex min-w-0 flex-wrap items-center gap-1 text-body-2-regular",
						title: p,
						children: [
							e.map((e) => /* @__PURE__ */ (0, Q.jsx)(Xt, { provider: e.provider }, e.id)),
							/* @__PURE__ */ (0, Q.jsx)(s, { children: X("follow:sourceList.providers", { providers: p }) }),
							f ? /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "ml-1 shrink-0 text-text-error-primary",
								children: X("follow:shared.failedCount", { count: f })
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, Q.jsxs)("span", {
					"data-follow-author-controls": "",
					className: "flex flex-none items-center gap-2 max-sm:w-full max-sm:justify-end",
					children: [/* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						size: "small",
						iconOnly: !0,
						leadingIcon: ze,
						"aria-label": X("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...K(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: st,
							"aria-pressed": h.all ? "true" : h.some ? "mixed" : "false",
							"aria-label": X(h.all ? "follow:sourceList.deselectGroup" : "follow:sourceList.selectGroup", { name: t }),
							onClick: () => o(!h.all),
							children: h.all ? X("follow:shared.deselectAll") : X("follow:shared.selectAll")
						}), /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							"aria-expanded": n,
							"aria-controls": m,
							leadingIcon: _,
							"aria-label": X(n ? "follow:sourceList.collapseGroup" : "follow:sourceList.expandGroup", { name: t }),
							onClick: () => a(!n),
							children: X(n ? "follow:shared.collapse" : "follow:shared.expand")
						})]
					})]
				})
			]
		}), /* @__PURE__ */ (0, Q.jsx)(v, {
			id: m,
			open: n,
			"data-source-divider": !0,
			children: e.map((e) => /* @__PURE__ */ (0, Q.jsx)($n, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function tr(e) {
	let { data: t, sort: c, dir: l, page: d, layout: g, pageSize: v, selected: b, readOnly: x, onSort: C, onPage: w, onLayout: T, onPageSize: te, onSelected: O, toast: k, openFollow: A, onAdd: j } = e, M = t.sources, N = (0, Z.useMemo)(() => t.author_aliases || [], [t.author_aliases]), I = t.counts || {}, [L, R] = (0, Z.useState)(/* @__PURE__ */ new Set()), [ne, re] = Xn(), [V, H] = (0, Z.useState)(""), U = (0, Z.useMemo)(() => xe(M, c, l, N), [
		M,
		c,
		l,
		N
	]), le = (0, Z.useMemo)(() => Lt(U, c, l, N), [
		U,
		c,
		l,
		N
	]), { job: W, running: _e, outcome: ve, start: be } = Vt({
		queryKey: E,
		taskKey: D,
		queryFn: ({ signal: e }) => Ke(e),
		start: (e) => Pt(e),
		onError: (e) => H(q(e)),
		onFinish: (e) => {
			Y(), k(e.status === "failed" ? at(e, "error") || X("follow:followCheck.checkFailed") : Oe(e));
		}
	}), G = (e) => {
		_e || be.isPending || (H(""), be.mutate(e));
	}, Ce = (e, t) => O(Rt(b, [e], t)), De = (e, t) => O(Rt(b, e, t)), je = Ht({
		mutationFn: (e) => bt(e),
		onSuccess: (e, t) => {
			Be([t]), O(Rt(b, [t], !1)), k(X("follow:sourceList.unfollowed"));
		},
		onError: (e) => H(q(e))
	}), Ne = Ht({
		mutationFn: (e) => Mt(e.id, e.enabled),
		onSuccess: (e, t) => {
			mt(t.id, { enabled: t.enabled }), H("");
		},
		onError: (e) => H(q(e))
	}), Pe = (e) => void Fe({
		title: X("follow:sourceList.unfollow"),
		body: X("follow:sourceList.unfollowBody"),
		confirmLabel: X("follow:sourceList.unfollow"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: () => je.mutateAsync(e.id)
	}), Le = Ht({
		mutationFn: async (e) => {
			let t = await ut(e.ids, 4, async (t) => {
				e.action === "remove" ? await bt(t) : await Mt(t, e.action === "enabled");
			});
			return {
				...e,
				done: e.ids.filter((e, n) => t[n]?.ok),
				results: t
			};
		},
		onSuccess: (e) => {
			if (e.action === "remove") Be(e.done);
			else for (let t of e.done) mt(t, { enabled: e.action === "enabled" });
			O(Rt(b, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? H(X("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: q(t[0]?.error)
			})) : H("");
		},
		onError: (e) => H(q(e))
	}), Re = Ht({
		mutationFn: dt,
		onSuccess: (e) => {
			Y(), e.failed ? H(X("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: q(e.error)
			})) : H("");
		},
		onError: (e) => H(q(e))
	}), He = {
		receipt: k,
		failure: (e) => H(q(e))
	}, Ge = (e) => ({
		key: e ? "enable" : "pause",
		label: X(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: X(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: X(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => M.find((e) => e.id === t)?.enabled !== e), { done: r } = await Le.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await ut(r, 4, (t) => Mt(t, !e));
				for (let t of r) mt(t, { enabled: !e });
			};
		},
		receipt: (t) => X(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), qe = {
		key: "delete",
		label: X("follow:shared.delete"),
		reversal: "irreversible",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: X("follow:sourceList.deleteManyTitle", { count: e.length }),
			danger: !0,
			body: X("follow:sourceList.deleteManyBody"),
			confirmLabel: X("follow:sourceList.deleteSelected")
		}),
		run: async (e) => {
			await Le.mutateAsync({
				ids: [...e],
				action: "remove"
			});
		},
		receipt: (e) => X("follow:sourceList.bulkDeleted", { count: e.length })
	}, Je = (e) => {
		let t = [];
		return {
			key: `mark-${e}`,
			label: X(e === "seen" ? "follow:sourceList.markAllWatched" : "follow:sourceList.ignoreAll"),
			reversal: "undo",
			confirm: ([t]) => e === "seen" ? {
				title: X("follow:followDetail.markSeen"),
				body: X("follow:sourceList.markWatchedBody", { count: t })
			} : {
				title: X("follow:sourceList.markIgnored"),
				body: X("follow:sourceList.markIgnoredBody", { count: t }),
				recovery: X("shell:batchFollow.ignoreRecovery")
			},
			run: async () => (t = (await Re.mutateAsync(e)).marked, async () => {
				await zt(t), await Y();
			}),
			receipt: () => X("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Ye = (e, t) => Ne.mutate({
		id: e.id,
		enabled: t
	}), Xe = (0, Z.useRef)({
		check: G,
		toggle: Ye,
		remove: Pe,
		busy: !1,
		readOnly: x
	});
	Xe.current = {
		check: G,
		toggle: Ye,
		remove: Pe,
		busy: _e || be.isPending,
		readOnly: x
	};
	let Ze = Xe.current, $e = (0, Z.useMemo)(() => {
		let e = Ie(), t = (e) => () => Zn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(me, {
					table: e.table,
					label: X("follow:sourceList.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": X("follow:shared.selectNamed", { name: e.row.original.source.label })
				})
			}),
			e.accessor((e) => e.author, {
				id: "author",
				header: t("author"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex min-w-0 items-center gap-2",
					children: [/* @__PURE__ */ (0, Q.jsx)(Jt, {
						group: e.row.original.group,
						name: e.row.original.author
					}), /* @__PURE__ */ (0, Q.jsx)("span", {
						className: "min-w-0 break-words",
						children: e.row.original.author
					})]
				})
			}),
			e.accessor((e) => e.source.label, {
				id: "source",
				header: t("source"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex min-w-0 flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, Q.jsx)(Zt, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Q.jsx)(Yt, { text: Me(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Q.jsx)(Xt, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Qt, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => Ae(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(ue, {
							"aria-label": X("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: Ze.readOnly,
							onChange: (t) => Xe.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: ze,
							"aria-label": X("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || Ze.readOnly,
							...K(Ze.busy),
							onClick: () => Xe.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
							"aria-label": X("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: Ze.readOnly,
							onClick: () => Xe.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [Ze]), et = (0, Z.useMemo)(() => {
		let e = Jn[c];
		return e ? [{
			id: e,
			desc: l === "desc"
		}] : [];
	}, [c, l]), tt = (0, Z.useMemo)(() => Object.fromEntries([...b].map((e) => [String(e), !0])), [b]), nt = g === "table", rt = Kt("follow-sources", Qn), it = pt(nt ? le.length : U.length, v, d), J = Gt({
		features: qn,
		data: le,
		columns: $e,
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
			O(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		},
		onPaginationChange: (e) => {
			let t = {
				pageIndex: it.page - 1,
				pageSize: v
			}, n = typeof e == "function" ? e(t) : e;
			n.pageSize === v ? n.pageIndex !== t.pageIndex && w(n.pageIndex + 1) : te(n.pageSize);
		}
	}), ot = J.getRowModel().rows, st = nt ? ot.map((e) => e.original.source.id) : U.slice(it.start, it.end).flatMap((e) => e.map((e) => e.id)), ct = kt(b, st), lt = [...b], ft = Ee(ve), ht = M.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), gt = Te(ve), _t = U.length > 0 && L.size >= U.length;
	return M.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: we({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				ref: ne,
				"data-follow-toolbar": "",
				"data-responsive-toolbar": "",
				children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
					"data-follow-toolbar-heading": "",
					"data-toolbar-heading": "",
					children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: X("follow:followManageNav.list")
					}), /* @__PURE__ */ (0, Q.jsx)("span", {
						className: "text-body-2-regular text-text-secondary",
						children: I.new ? X("follow:sourceList.sourceCountUnseen", {
							count: M.length,
							unseen: Number(I.new) || 0
						}) : X("follow:sourceList.sourceCount", { count: M.length })
					})]
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						ht.length ? /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							disabled: x,
							...K(Ze.busy),
							onClick: () => G(ht),
							children: X("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "primary",
							leadingIcon: ze,
							disabled: x,
							"aria-label": X("follow:sourceList.checkAll"),
							iconOnly: re,
							...K(Ze.busy),
							onClick: () => G([]),
							children: X("follow:sourceList.checkAll")
						}),
						/* @__PURE__ */ (0, Q.jsxs)("span", {
							"data-follow-toolbar-controls": "",
							className: "contents",
							children: [
								/* @__PURE__ */ (0, Q.jsxs)("span", {
									"data-button-group": !0,
									role: "group",
									"aria-label": X("follow:sourceList.layout"),
									children: [/* @__PURE__ */ (0, Q.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: ge,
										"aria-label": P[0][1],
										"aria-pressed": !nt,
										onClick: () => T("default")
									}), /* @__PURE__ */ (0, Q.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: Ve,
										"aria-label": P[1][1],
										"aria-pressed": nt,
										onClick: () => T("table")
									})]
								}),
								nt ? /* @__PURE__ */ (0, Q.jsx)(fe, {
									preferences: rt,
									label: X("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Q.jsx)(ae, {
										"aria-label": X("follow:sourceList.sortLabel"),
										prefix: X("follow:shared.sort"),
										selectedKey: c,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											C(t, B[t]);
										},
										children: ie.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(oe, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Q.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: ce,
										"data-icon-state": l === "asc" ? "a" : "b",
										"aria-label": Nt(c, l),
										onClick: () => C(c, l === "asc" ? "desc" : "asc")
									})]
								}),
								nt ? null : /* @__PURE__ */ (0, Q.jsx)(u, {
									variant: "secondary",
									iconOnly: re,
									leadingIcon: _,
									"aria-expanded": !_t,
									"aria-label": X(_t ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => R(_t ? /* @__PURE__ */ new Set() : new Set(U.map((e) => String(e[0].author_key || e[0].id)))),
									children: X(_t ? "follow:shared.expandAll" : "follow:shared.collapseAll")
								})
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [
					_e ? /* @__PURE__ */ (0, Q.jsx)(he, {
						embedded: !0,
						kind: W?.older ? ye("feed-scrape") : ye("follow-check"),
						label: at(W) || (W?.total ? X(W.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: W.checked || 0,
							count: W.total
						}) : X("follow:sourceList.preparingCheck")),
						value: W?.checked,
						total: W?.total
					}) : null,
					V ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "error",
						title: X("follow:shared.actionFailed"),
						children: V
					}) : null,
					!_e && ve?.results?.length ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "neutral",
						title: X("follow:followFeed.checkResults"),
						children: ke(ve)
					}) : null,
					ft.length ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "error",
						title: X("follow:sourceList.failedTitle", { count: ft.length }),
						extra: /* @__PURE__ */ (0, Q.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ft.map((e, t) => /* @__PURE__ */ (0, Q.jsx)("li", { children: X("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: Ue(e.error || "") || X("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: X("follow:sourceList.failedBody")
					}) : null,
					gt ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "warning",
						children: X("follow:sourceList.evidenceGap", { error: gt })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)(se, {
				label: X("follow:sourceList.bulkActions"),
				visible: lt.length > 0,
				count: X("follow:sourceList.selectedCount", { count: lt.length }),
				actions: [
					Ge(!0),
					Ge(!1),
					qe
				].map((e) => ({
					action: e,
					items: lt,
					host: He,
					disabled: x || Le.isPending
				})),
				leading: /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: x,
					...K(Ze.busy),
					onClick: () => G(lt),
					children: X("follow:sourceList.checkSelected")
				}),
				children: /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: We,
					children: X("follow:shared.clearSelection")
				})
			}),
			nt ? /* @__PURE__ */ (0, Q.jsx)(ee, {
				follow: !0,
				preferences: rt,
				onRowClick: (e) => Ce(Number(e), !b.has(Number(e))),
				children: /* @__PURE__ */ (0, Q.jsxs)(de, {
					"aria-label": X("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: et[0] ? {
						column: et[0].id,
						direction: et[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => J.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [J.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = Qe(e.column.columnDef.header, e.getContext());
						return /* @__PURE__ */ (0, Q.jsx)(r, {
							id: e.id,
							allowsSorting: t,
							isRowHeader: e.column.id === "source",
							...rt.columnProps(e.id),
							children: ({ sortDirection: r }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [e.id === "select" ? n : t ? /* @__PURE__ */ (0, Q.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [n, /* @__PURE__ */ (0, Q.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": r || void 0,
									children: /* @__PURE__ */ (0, Q.jsx)(h, {})
								})]
							}) : /* @__PURE__ */ (0, Q.jsx)(s, { children: n }), /* @__PURE__ */ (0, Q.jsx)(pe, {
								preferences: rt,
								id: e.id
							})] })
						}, e.id);
					}), /* @__PURE__ */ (0, Q.jsx)(r, {
						id: "remaining-space",
						"aria-label": X("follow:shared.rowSpacer"),
						"data-table-space": "",
						width: rt.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, Q.jsx)(n, {
						renderEmptyState: () => X("follow:sourceList.pageEmpty"),
						children: ot.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(m, {
				isSelected: ct.all,
				isIndeterminate: ct.some,
				onChange: (e) => De(st, e),
				"aria-label": X("follow:sourceList.selectPage"),
				children: X("follow:sourceList.selectPageShort")
			}), /* @__PURE__ */ (0, Q.jsx)("div", {
				className: "flex flex-col gap-3",
				children: U.slice(it.start, it.end).map((e) => {
					let t = String(e[0].author_key || e[0].id);
					return /* @__PURE__ */ (0, Q.jsx)(er, {
						group: e,
						name: Se(e, N),
						handlers: Ze,
						selected: b,
						open: !L.has(t),
						onOpen: (e) => {
							let n = new Set(L);
							e ? n.delete(t) : n.add(t), R(n);
						},
						onToggleGroup: (t) => De(e.map((e) => e.id), t),
						onToggle: Ce
					}, t);
				})
			})] }),
			/* @__PURE__ */ (0, Q.jsx)(y, {
				label: X("follow:followManageNav.list"),
				total: it.total,
				pagination: {
					pageIndex: it.page - 1,
					pageSize: v
				},
				unit: X(nt ? "follow:followOverview.sourceUnit" : "follow:sourceList.creatorUnit"),
				pageUnit: X(nt ? "follow:followOverview.itemUnit" : "follow:followOverview.creatorUnit"),
				onChange: (e) => {
					e.pageSize === v ? J.setPageIndex(e.pageIndex) : J.setPageSize(e.pageSize);
				}
			}),
			I.new ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: X("follow:sourceList.markSummary", {
							unwatched: Number(I.new) || 0,
							watched: Number(I.seen) || 0,
							saved: Number(I.saved) || 0,
							ignored: Number(I.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: A,
						children: X("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = Je(e);
						return /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: x,
							...K(Re.isPending),
							onClick: () => void Ot(t, [Number(I.new) || 0], He).catch(He.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Q.jsx)(S, {
		icon: f,
		title: X("follow:sourceList.empty"),
		actions: /* @__PURE__ */ (0, Q.jsx)(u, {
			variant: "primary",
			size: "small",
			onClick: j,
			children: X("follow:followFeed.addFollow")
		}),
		children: X("follow:sourceList.emptyHint")
	});
}
// node_modules/skullet/dist/index.mjs
var nr = "skullet-reveal", rr = "skullet-pane", ir = "skullet-loading", ar = "skullet-ghost", or = "skullet-snapshot", sr = "skullet-layer", cr = "skullet-rect", lr = "skullet-bar", ur = "skullet-inactive", dr = "skullet-exiting", fr = "skullet-covered", pr = "skullet-own", mr = "skullet-block", hr = Symbol.for("skullet.ghost"), gr = Symbol.for("skullet.uncover"), _r = "skullet-status", vr = "skullet-xray", yr = "var(--skullet-base, rgb(128 128 128 / 0.2))", br = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", xr = 280, Sr = 1e4, Cr = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, wr = [
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
], Tr = [
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
], Er = Tr.join(", "), Dr = `
[${nr}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${rr}] {
  display: block;
}

[${ir}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${ur}] {
  display: none !important;
}

[${sr}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${lr}] {
  display: block;
  background-color: ${yr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${ir}]) to ([${pr}], [${sr}]) {
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
  :scope :is(${wr.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${Er}, [${fr}], [${mr}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${yr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${Er}, [${mr}]):not(svg *) {
      visibility: visible !important;
      background: ${yr} !important;
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
[${_r}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${vr}] [${ir}] [${ar}],
[${vr}] [${ir}] [${ar}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Or = null, kr = 0, Ar;
function jr() {
	kr++, !Or && (Ar ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !Ar && (Or = document.createElement("style"), Or.dataset.skullet = "true", Or.textContent = Dr, document.head.appendChild(Or)));
}
function Mr() {
	kr--, !(kr > 0 || !Or) && (Or.remove(), Or = null);
}
var Nr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", Pr = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...Pr });
function Fr(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? Pr[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var Ir = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function Lr({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = Fr(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${Ir(o)} }`), a === "system") {
		let t = Fr({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${Ir(t)} } }`);
	}
	return s.join("\n");
}
var Rr = /* @__PURE__ */ new Map(), zr, Br = null, Vr = 0;
function Hr() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var Ur = () => zr ??= typeof window < "u" && Hr(), Wr = (e) => Ur() || !!e?.closest("[skullet-debug]");
function Gr(e) {
	zr = e, e ? Xr() : Zr();
}
function Kr(e, t) {
	!e || !Wr(e) || (Rr.set(e, {
		state: "loading",
		source: t
	}), Jr());
}
function qr(e, t) {
	!e || !Wr(e) || (Rr.set(e, {
		...Rr.get(e),
		state: "shown",
		moved: t
	}), Jr());
}
function Jr() {
	Xr(), cancelAnimationFrame(Vr), $r();
}
var Yr = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function Xr() {
	if (typeof document > "u") return;
	if (!Br?.isConnected) {
		Br = document.createElement("div"), Br.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = Br.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${Yr}</style><div class="boxes"></div>`, document.body.append(Br);
	}
	let e = Br.shadowRoot;
	if (zr && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(vr, e.target.checked);
		}), e.append(t);
	}
	Vr ||= requestAnimationFrame($r);
}
function Zr() {
	Br?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(vr), ![...Rr.keys()].some((e) => Wr(e)) && (cancelAnimationFrame(Vr), Vr = 0, Br?.remove(), Br = null);
}
var Qr = ({ state: e, source: t, moved: n }) => {
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
function $r() {
	if (Vr = 0, !Br?.shadowRoot) return;
	let e = Br.shadowRoot.querySelector(".boxes");
	for (let e of Rr.keys()) e.isConnected && Wr(e) || Rr.delete(e);
	let t = [...Rr];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = Qr(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), (zr || Rr.size) && (Vr = requestAnimationFrame($r));
}
var ei, ti = () => ei ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), ni = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, ri = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], ii = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function ai(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function oi(e, t, n) {
	let r = ni(e, t), i = ai(n, t), a = e ? ri(e) : [], o = ri(t), s = ri(r).map((t, n) => ii(t, o[n]) ? i[n] : e && ii(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function si(e, t, n, r) {
	if (!e) return n;
	let i = ri(e), a = ri(t).map((t, n) => e.corners[n] > 0 && ii(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = ai(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var ci = (e, t) => {
	let n = ni(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, li = {
	top: "ascender",
	bottom: "descender"
}, ui = /* @__PURE__ */ new Map(), di = (e) => [...e.getClientRects?.() ?? []];
function fi(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (ui.has(t)) return ui.get(t);
	let n = ti(), r = null;
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
	return ui.set(t, r), r;
}
var pi = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, mi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function hi(e, t, n) {
	let r = fi(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = mi(t, "--skullet-text-top", Object.keys(pi), li.top), a = mi(t, "--skullet-text-bottom", ["baseline", "descender"], li.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[pi[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var gi = new Set(Tr), _i = new Set(wr), vi = .4, yi = /[,/]\s*0\)$/, bi = (e, t) => e !== "" && e !== t, xi = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], Si = (e) => xi.every((t) => bi(e[`border${t}Style`], "none") && bi(e[`border${t}Width`], "0px")), Ci = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, wi = (e) => bi(e, "none") && !e.split(/,(?![^(]*\))/).every(Ci), Ti = (e) => bi(e.backgroundColor, "transparent") && !yi.test(e.backgroundColor) || bi(e.backgroundImage, "none") || wi(e.boxShadow) || Si(e), Ei = (e) => gi.has(e.localName), Di = (e) => _i.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), Oi = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(di(n).filter((e) => e.width || e.height));
		} else Di(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * vi, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, ki = (e, t) => e.hasAttribute("skullet-block") || Ei(e) || Ti(t) && Oi(e) <= 1;
function Ai(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function ji(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * vi;
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
function Mi(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = ci(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...hi(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of di(d)) f(e, r, t);
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
			if (ki(e, r)) {
				let n = ci(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: si(t, n, Ai(e, r), r)
					});
				}
				Ei(e) || u.add(e);
				continue;
			}
			if (Di(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? oi(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...ji(l)];
	for (let t of e.querySelectorAll(`[${fr}]`)) u.has(t) || t.removeAttribute(fr);
	for (let e of u) e.hasAttribute(fr) || e.setAttribute(fr, "");
	return [...c, ...ji(l)];
}
var Ni = (e) => typeof matchMedia < "u" && matchMedia(e).matches, Pi = () => typeof Element < "u" && typeof Element.prototype.animate == "function", Fi = () => !Pi() || Ni("(prefers-reduced-motion: reduce)"), Ii = () => Ni("(prefers-reduced-transparency: reduce)"), Li = (e) => e.getAnimations?.() ?? [], Ri = .7, zi = 1280, Bi = 320, Vi = 2.5, Hi = .45, Ui = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function Wi(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", Ui, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Cr[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var Gi = 20, Ki = Math.sin(Gi * Math.PI / 180), qi = Math.cos(Gi * Math.PI / 180), Ji = Ki / qi, Yi = qi, Xi = `${90 + Gi}deg`, Zi = .85, $ = 12, Qi = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function $i(e) {
	let t = e * Vi, n = (t, n) => `color-mix(in srgb, ${br} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * Zi, Qi(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(Zi + e / $ * (1 - Zi), Qi(1 - e / $)));
	return {
		width: t / qi,
		image: `repeating-linear-gradient(${Xi}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function ea(e, t, n = Wi(e)) {
	for (let t of Li(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", Fi() || typeof e.animate != "function" || n.animation === "none") return;
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
				opacity: Hi,
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
	}, { width: s, image: c } = $i(Math.min(Math.max(o.width * .4, 80), Bi)), l = a - o.left + (i.top - o.top) * Ji, u = n.duration * Ri / (zi + Bi);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function ta(e) {
	if (Fi()) return null;
	let t = Wi(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * Ri / (zi + Bi);
}
var na = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), ra = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function ia(e, t) {
	let n = na(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = Wi(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${yr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, ea(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var aa = 120, oa = 72, sa = 3, ca = 60, la = 150, ua = 400, da = 1.5, fa = 1e3, pa = 1e3, ma = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), ha = -1 / 0, ga = !1;
function _a() {
	if (!(ga || typeof addEventListener > "u")) {
		ga = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => ha = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var va = /* @__PURE__ */ new WeakMap();
function ya(e, { served: t, refetch: n }) {
	_a();
	let r = va.get(e)?.since ?? performance.now();
	va.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function ba(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function xa(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var Sa = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function Ca(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${dr}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var wa = (e, t) => Math.min(Math.max(e, 0), t), Ta = -1 / 0;
function Ea(e, t, n, r, i) {
	let a = performance.now();
	a - Ta > la && (Ta = a);
	let o = a - Ta, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of ba(e)) {
		let n = xa(t, e), r = c.get(n);
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
		return t === null ? null : wa(t, fa) + Math.max(r.delay ?? 0, 0);
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
			let t = [...c.values()].find((t) => Sa(t.rect, e));
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
function Da(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) ma.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function Oa(e, t, n, r = () => {}) {
	let i = va.get(t);
	va.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - ha < ua,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: ba(e).length
			})
		};
	}
	let o = wa(a.duration ?? 200, pa);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, fa)
	}, !o) return { kind: "instant" };
	let s = Da(a.enter, r);
	if (a.wipe) {
		let e = Ca(t);
		if (e.width * e.height <= innerWidth * innerHeight * da) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return Ea(e, t, a.order, {
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
var ka = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return wa(n * .8 + r * .2, 1) * 320;
}, Aa = (e) => e.bottom > 0 && e.top < innerHeight, ja = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return Aa(e) ? 0 : null;
	if (!Aa(t)) return null;
	let i = wa(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? ca : 0);
}, Ma = { duration: 0 }, Na = { order: "together" }, Pa = { order: ka }, Fa = (e) => e.input || e.waited < 150 ? Ma : e.refetch ? {
	order: "together",
	duration: aa
} : null, Ia = (e) => e.height < oa || e.pieces <= sa ? Na : { order: ja }, La = {
	hold: 150,
	choose: (e) => Fa(e) ?? Ia(e)
}, Ra = new Set(Tr), za = "script, noscript, template, base, meta, link", Ba = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), Va = /* @__PURE__ */ new Set([
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
	fr
]), Ha = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function Ua(e, t) {
	let n = Ha(t.data);
	t.data = n;
	let r = e.parentElement, i = ti();
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
function Wa(e) {
	for (let t of e.querySelectorAll(za)) t.remove();
	for (let t of e.querySelectorAll("*")) if (Ba.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || Va.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function Ga(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (Ra.has(e.localName) || Ba.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) Ua(e, t);
	return Wa(n), n.innerHTML;
}
function Ka(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, Wa(t.content), t.content;
}
var qa = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${qa(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), Ja = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function Ya(e) {
	let t = qa(e, 2);
	return t ? `${location.pathname}|${Ja(t)}` : null;
}
var Xa = !1;
try {
	Xa = !1;
} catch {
	Xa = !1;
}
var Za = Xa, Qa = /* @__PURE__ */ new Set();
function $a(e, t) {
	!Za || Qa.has(e) || (Qa.add(e), console.warn(`[skullet] ${t}`));
}
var eo = /^(https?:|\/|data:|blob:)/;
function to(e) {
	return typeof e == "string" ? eo.test(e) ? "" : Ha(e) : Array.isArray(e) ? e.map(to) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, to(t)])) : e;
}
var no = "skullet:shapes", ro = 2, io = 50, ao = 2e4, oo = /* @__PURE__ */ new Map(), so = /* @__PURE__ */ new Map();
function co(e, t) {
	return so.has(e) || so.set(e, /* @__PURE__ */ new Set()), so.get(e).add(t), () => so.get(e)?.delete(t);
}
function lo(e) {
	for (let t of so.get(e) ?? []) t();
}
function uo() {
	try {
		let e = JSON.parse(localStorage.getItem(no) ?? "null");
		return e?.v === ro ? e.shapes : {};
	} catch {
		return {};
	}
}
function fo(e) {
	try {
		localStorage.setItem(no, JSON.stringify({
			v: ro,
			shapes: e
		}));
	} catch {}
}
function po(e, t) {
	oo.set(e, Ga(t, !1));
	let n = Ga(t, !0);
	if (n.length > ao) return;
	let r = uo();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - io)) delete r[e];
	fo(r);
}
function mo(e) {
	return oo.get(e) ?? uo()[e] ?? null;
}
var ho = [
	100,
	90,
	60
].map((e) => `<div ${mr} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), go = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${ir}]`)), _o = /* @__PURE__ */ new WeakMap();
function vo(e) {
	if (!e) return;
	let t = _o.get(e);
	return _o.delete(e), t;
}
function yo(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var bo = (e) => !!e.firstElementChild || !!e.textContent?.trim(), xo = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, jr(), e[hr] = !0, e.setAttribute(ir, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = yo(e, ar), this.snapshot = yo(e, or), this.layer = yo(e, sr), this.hadContent = bo(this.ghost);
		let n = e.closest(`[${nr}]`);
		n && ya(n, {
			served: go.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[gr]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
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
		this.root.closest(`[${dr}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = bo(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || go.has(this.root), r = !!this.ghost.querySelector(`[${pr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? Ya(this.ghost);
			n && (lo(n), t = mo(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(Ka(t)) : e === "fallback" ? (this.snapshot.innerHTML = ho, $a(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(ur, e !== "ghost"), this.snapshot.toggleAttribute(ur, e === "ghost"), this.source = e, Kr(this.root.closest(`[${nr}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : go.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		ia(this.layer, Mi(e, this.layer));
		let t = this.root.closest(`[${nr}]`);
		t && _o.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), Mr();
	}
}, So = 250, Co = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? Ya(e), this.untrack = this.key ? co(this.key, () => this.save()) : () => {}, (Za || Wr(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
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
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), So);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && po(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${nr}]`), o = vo(a);
		if (!o) return;
		o.guessed && n && !r && e != null && $a(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify(to(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (qr(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? $a(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : $a(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, wo = () => {}, To = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, Eo = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !To(e));
function Do(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(wo, wo), new Promise((e) => setTimeout(e, Sr))]);
}
var Oo = 360, ko = 2, Ao = 600, jo = 40, Mo = jo / Yi, No = 320, Po = 120, Fo = .45, Io = (e) => e.left + e.top * Ji, Lo = (e) => e.width + e.height * Ji, Ro = (e, t) => Io(t) - Mo + (Lo(t) + 2 * Mo) * e, zo = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function Bo(e) {
	let t = e.querySelector(`:scope > [${dr}] [${sr}]`), n = t && ta(t);
	if (!n) return null;
	let r = Ca(e);
	if (r.width * r.height > innerWidth * innerHeight * da) return null;
	let i = Io(r), a = i + Lo(r), o = performance.now(), s = o - zo.start;
	s <= la && (i - zo.origin) / zo.speed >= s && (a - zo.origin) / zo.speed - s <= Ao || (zo = {
		start: o,
		origin: i,
		speed: Math.max(ko / n, (a - i) / Oo)
	});
	let { start: c, origin: l, speed: u } = zo;
	return {
		delay: (i - Mo - l) / u - (o - c),
		duration: (a - i + 2 * Mo) / u
	};
}
var Vo = (e) => (t, { rect: n, reveal: r }) => {
	let i = (Ro(t, r) - Io(n)) * Yi;
	return `linear-gradient(${Xi}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - Qi(n / $) : Qi(n / $), a = -jo + 2 * jo * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, Ho = "http://www.w3.org/2000/svg", Uo = null, Wo = 0;
function Go() {
	return Uo?.isConnected || (Uo = document.createElementNS(Ho, "svg"), Uo.setAttribute("aria-hidden", "true"), Uo.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(Uo)), Uo;
}
var Ko = (e, t) => {
	let n = document.createElementNS(Ho, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, qo = {
	mask: Vo(!0),
	out: Vo(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (Ii()) return;
		let i = Io(t), a = Lo(t), o = No / 2 / Yi, s = () => Ro(r(), n) - i - Po / Yi;
		if (s() - o > a) return;
		let c = 2 * o + t.height * Ji, l = c / 2, u = t.height / 2, d = No / 2 * Yi, f = No / 2 * Ji * Yi, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${Qi(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++Wo}`, _ = Ko("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = Ko("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(Ko(`feFunc${e}`, {
			type: "linear",
			slope: 1 - Fo,
			intercept: Fo
		}));
		let y = Ko("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, Ko("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), Ko("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), Go().append(_), e.style.filter = `url(#${g})`;
		let ee = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * Ji) / t.width).toFixed(4)), requestAnimationFrame(ee));
		};
		ee();
	}
}, Jo = {
	together: Na,
	sequence: Pa,
	smart: La,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = Fa(e);
			if (t) return t;
			let n = Bo(e.reveal);
			return n ? {
				wipe: qo,
				...n
			} : Ia(e);
		}
	}
}, Yo = (e = "smart") => typeof e == "string" ? Jo[e] : e, Xo = () => {}, Zo = (e) => e.finished.then(Xo, Xo), Qo = /* @__PURE__ */ new WeakMap();
function $o(e, t = 0, n = 200, r = 0, i) {
	return Fi() ? Promise.resolve() : Zo(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var es = (e) => !!e.querySelector(`[${sr}], [${ar}], :scope > [${pr}]`), ts = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, ns = /* @__PURE__ */ new WeakMap();
function rs(e) {
	for (let t of ns.get(e) ?? []) t.remove();
	ns.delete(e);
}
function is(e, t) {
	let n = Eo(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && es(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${dr}] [${sr}]`)].flatMap(ra), a = ns.get(t) ?? /* @__PURE__ */ new Set();
			ns.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => ts(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(cr, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: yr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), ea(c), Do(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", $o(e), Fi()) return c.remove();
						Zo(c.animate([{ opacity: 1 }, { opacity: 0 }], {
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
function as(e, t) {
	return Fi() ? Promise.resolve() : Promise.all(ba(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return $o(e, n, t.duration, 0, t.enter);
	})).then(Xo);
}
function os(e) {
	for (let t of e.querySelectorAll(`:scope > [${dr}]`)) {
		for (let e of Li(t)) e.finish();
		t.style.opacity = "0";
	}
}
function ss(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${dr}]`)) if (!es(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of Li(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function cs(e, t = "smart", { initial: n = !1 } = {}) {
	let r = ls.get(e);
	return r || (r = us(e, t, n), ls.set(e, r)), r;
}
var ls = /* @__PURE__ */ new WeakMap();
function us(e, t, n) {
	let r = e.parentElement, i = Yo(t);
	if (es(e)) {
		r && rs(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && Qo.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : $o(e, t)) : (r && Qo.delete(r), n ? Promise.resolve() : $o(e));
	}
	if (n || !r) return Promise.resolve();
	let a = ss(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return Qo.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), $o(e, 0, t, a);
	}
	is(e, r);
	let o = Oa(e, r, i, (e) => $a(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return Qo.set(r, o), o.kind === "instant" ? (os(r), Promise.resolve()) : o.kind === "sequence" ? as(e, o) : o.kind === "wipe" ? Cs(e, o, !0) : $o(e, o.delay, o.duration, 0, o.enter);
}
function ds(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function fs(e, t = ds(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(dr, ""), t;
}
var ps = /* @__PURE__ */ new WeakMap();
function ms(e, t) {
	let n = e.querySelector(`:scope > [${rr}]:not([${dr}])`);
	if (!n) return;
	let r = ps.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && hs(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: xr,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	ps.set(e, u), Zo(l).then(() => {
		ps.get(e) === u && hs(e, u);
	});
}
function hs(e, { overflow: t, boxSizing: n }) {
	ps.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function gs(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of Li(e)) t.cancel();
	Ss(e), e.style.filter = "";
	let i = e.parentElement;
	i && !es(e) && rs(i);
	let a = fs(e, t), o = (t, n) => Pi() ? Zo(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && Qo.get(i), n = Fi() || t?.kind === "instant";
		if (i && !n && ms(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && es(e) ? _s(e, t) : t?.kind === "wipe" && es(e) ? Cs(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function _s(e, t) {
	for (let t of e.querySelectorAll(`[${ar}], [${or}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${ar}] [${pr}]`)].filter((e) => !e.parentElement?.closest(`[${pr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${sr}]`)].flatMap(ra), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => Zo(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(Xo);
}
var vs = 100, ys = /* @__PURE__ */ new WeakMap();
function bs(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function xs(e, t) {
	bs(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function Ss(e) {
	ys.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function Cs(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? bs(e, i(t, r)) : a ? bs(e, a(t, r)) : xs(e, i(t, r));
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
			if (e - i > vs && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), ys.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + vs);
		ys.set(e, l), c();
	}).then((t) => {
		if (Ss(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? $o(e, 0, r, t) : Zo(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var ws = Z.createContext({}), Ts = Z.createContext(null), Es = () => Z.useContext(ws), Ds = () => Z.useContext(Ts), Os = () => Es().reveal;
function ks({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = Lr({
		theme: r,
		mode: i,
		text: a
	}), [c] = Z.useState(() => ({ sent: !1 }));
	return Z.useEffect(() => {
		n !== void 0 && Gr(n);
	}, [n]), (0, Q.jsx)(ws.Provider, {
		value: t,
		children: (0, Q.jsxs)(Ts.Provider, {
			value: c,
			children: [s && (0, Q.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var As = typeof window > "u" ? Z.useEffect : Z.useLayoutEffect, js = () => Z.useInsertionEffect(() => (jr(), Mr), []), Ms = Number("19.3.1".split(".")[0]) >= 19, Ns = () => {
	let { nonce: e } = Es();
	return Ms ? (0, Q.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: Dr
	}) : null;
}, Ps = Ms ? { inert: !0 } : { inert: "" }, Fs = (e) => Z.Children.map(e, (e) => {
	if (!Z.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Q.jsx)("span", {
		[pr]: "",
		children: (0, Q.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? Z.cloneElement(e, void 0, Fs(e.props.children)) : e;
}), Is = () => () => {}, Ls = () => Z.useSyncExternalStore(Is, () => !1, () => !0), Rs = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = Z.useRef(null), { nonce: o } = Es(), s = Ds(), c = Ls(), l = Nr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), As(() => {
		if (!a.current) return;
		let e = new xo(a.current, {
			id: t,
			exact: n,
			refetch: r
		});
		return () => e.destroy();
	}, [
		t,
		n,
		r
	]), (0, Q.jsxs)(Q.Fragment, { children: [
		i && (0, Q.jsx)("span", {
			"skullet-status": "",
			children: i
		}),
		(0, Q.jsxs)("div", {
			ref: a,
			[ir]: "",
			"aria-hidden": !0,
			...Ps,
			children: [
				(0, Q.jsx)("div", {
					[ar]: "",
					children: Fs(e)
				}),
				(0, Q.jsx)("div", { [or]: "" }),
				(0, Q.jsx)("div", { [sr]: "" })
			]
		}),
		c && (0, Q.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, zs = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = Z.useRef(null), l = Os();
	return As(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), cs(c.current, l, { initial: !r }).then(s), o && (e.memory = new Co(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), As(() => {
		!i || !c.current || gs(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Q.jsx)("div", {
		ref: c,
		[rr]: "",
		children: e
	});
}, Bs = class extends Z.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = ds(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function Vs(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	js();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = Z.useRef(null);
	As(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Q.jsx)("div", {
			[pr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Q.jsx)(Rs, {
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
	let [y, ee] = Z.useState({
		id: 0,
		key: g
	}), [b, x] = Z.useState([]), S = Z.useRef(/* @__PURE__ */ new Map()).current, C = Z.useRef(_);
	if (As(() => {
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
	let w = Z.useRef(e.onReveal);
	As(() => {
		w.current = e.onReveal;
	});
	let T = y.key === "content" && y.from === "skeleton" ? () => w.current?.() : void 0, E = (e) => x((t) => t.filter((t) => t.id !== e)), D = [...b.map((e) => (0, Q.jsx)(zs, {
		id: e.id,
		registry: S,
		enter: !1,
		exiting: !0,
		onExited: () => E(e.id),
		children: e.node
	}, e.id)), (0, Q.jsx)(zs, {
		id: y.id,
		registry: S,
		enter: y.id > 0,
		exiting: !1,
		onExited: () => {},
		memory: v,
		onEntered: T,
		children: _
	}, y.id)];
	return (0, Q.jsxs)("div", {
		[nr]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Q.jsx)(Ns, {}), (0, Q.jsx)(Bs, {
			exiting: b.map((e) => e.id),
			registry: S,
			children: D
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var Hs = {
	creators: [X("follow:followOverview.creators"), X("follow:followOverview.creatorUnit")],
	enabled: [X("follow:followOverview.enabledSources"), ""],
	failed: [X("follow:followCheck.checkFailed"), X("follow:followOverview.sourceUnit")],
	updates: [X("follow:followOverview.unwatchedUpdates"), X("follow:followOverview.itemUnit")],
	subscriptions: [X("follow:feedSources.footerLabel"), X("follow:followOverview.actressUnit")],
	releases: [X("follow:followOverview.unwatchedReleases"), X("follow:followOverview.itemUnit")]
}, Us = {
	duration: 0,
	delay: 0,
	hold: 150
}, Ws;
function Gs() {
	return Ws || (Ws = new CSSStyleSheet(), Ws.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), Ws;
}
function Ks({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Q.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Q.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Q.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function qs({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = Hs[e], o = (0, Z.useRef)(null);
	return (0, Z.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = Gs();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Q.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: we({
			padding: "none",
			className: "flex flex-col justify-between gap-3 px-6 py-5 max-sm:gap-2 max-sm:p-4"
		}),
		children: [/* @__PURE__ */ (0, Q.jsx)("span", {
			className: "text-body-medium text-text-secondary",
			children: i
		}), t === void 0 && r ? /* @__PURE__ */ (0, Q.jsx)("b", {
			"data-follow-reading": "",
			className: "text-title-1-medium text-text-primary",
			children: X("follow:shared.notFound")
		}) : /* @__PURE__ */ (0, Q.jsx)(ks, {
			reveal: Us,
			children: /* @__PURE__ */ (0, Q.jsx)(Vs, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: X("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Q.jsx)(Ks, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var Js = (e) => k.some(([t]) => t === e);
function Ys(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, Z.useState)(Js(e.tab) ? e.tab : "list"), [u, f] = (0, Z.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, Z.useState)(() => wt(e.sort, e.dir).sort), [h, g] = (0, Z.useState)(() => wt(e.sort, e.dir).dir), [_, v] = (0, Z.useState)(it(e.layout) ? e.layout : "default"), [y, ee] = (0, Z.useState)(ft(e.pageSize)), [b, x] = (0, Z.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, Z.useState)(/* @__PURE__ */ new Set());
	Ut(() => {
		x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set());
	}), (0, Z.useEffect)(() => {
		(b.size || S.size) && He();
	}, [b, S]);
	let E = Wt({
		queryKey: O,
		queryFn: ({ signal: e }) => Ye(e)
	}), D = Wt({
		queryKey: te,
		queryFn: ({ signal: e }) => qe(e)
	}), A = Wt({
		queryKey: T,
		queryFn: ({ signal: e }) => Je(e)
	}), j = E.data || { sources: [] }, M = D.data || {
		root: "",
		providers: []
	}, N = j.sources;
	(0, Z.useEffect)(() => {
		x((e) => {
			let t = ot(e, N);
			return t.size === e.size ? e : t;
		});
	}, [N]);
	let P = (e) => {
		let n = e.sort ?? p, r = e.dir ?? h;
		t({
			tab: e.tab ?? c,
			page: e.page ?? u,
			sort: n === "checked" ? "" : n,
			dir: r === B[n] ? "" : r
		});
	}, F = nt(N), I = N.filter(rt).length, L = N.filter((e) => e.enabled).length, R = (M.providers || []).filter((e) => e.requirement === "required" && !Le(e)).length, ne = new Set((A.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Q.jsxs)(qt, { children: [
		a ? /* @__PURE__ */ (0, Q.jsx)(z, {
			tone: "warning",
			title: X("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Q.jsx)(w, {
					href: s,
					children: X("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: V,
			"aria-label": X("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "creators",
					figure: E.data ? F.length : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "enabled",
					figure: E.data ? L : void 0,
					total: N.length,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "failed",
					figure: E.data ? I : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "updates",
					figure: E.data ? j.counts?.new || 0 : void 0,
					failed: E.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "subscriptions",
					figure: A.data ? ne : void 0,
					failed: A.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(qs, {
					field: "releases",
					figure: A.data ? A.data.unread || 0 : void 0,
					failed: A.isError
				})
			]
		}),
		/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, Q.jsx)("div", {
					"data-section-nav": !0,
					children: /* @__PURE__ */ (0, Q.jsx)(le, {
						group: "follow",
						label: X("follow:followManagePage.sectionTabs"),
						value: c,
						panelPrefix: "follow",
						sectionItems: !0,
						tabs: k.map(([e, t]) => ({
							value: e,
							label: t
						})),
						className: "",
						itemClassName: "cursor-pointer whitespace-nowrap",
						onChange: (e) => {
							x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set()), l(e), P({ tab: e });
						}
					})
				}),
				c === "list" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-list",
					"aria-labelledby": "follow-tab-list",
					className: "flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, Q.jsx)(Kn, {
						readOnly: a,
						toast: r,
						onAdd: () => {
							l("add"), P({ tab: "add" });
						},
						selection: {
							ids: S,
							onChange: C,
							onActivate: () => x(/* @__PURE__ */ new Set())
						}
					}), E.data ? /* @__PURE__ */ (0, Q.jsx)(tr, {
						data: j,
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
							l("add"), P({ tab: "add" });
						},
						onSort: (e, t) => {
							m(e), g(t), f(1), P({
								sort: e,
								dir: t,
								page: 1
							});
						},
						onPage: (e) => {
							f(e), P({ page: e });
						},
						onSelected: (e) => {
							x(e), C(/* @__PURE__ */ new Set());
						},
						onLayout: (e) => {
							v(e), f(1), n({ layout: e }), P({ page: 1 });
						},
						onPageSize: (e) => {
							ee(e), f(1), n({ pageSize: e }), P({ page: 1 });
						}
					}) : E.isError ? /* @__PURE__ */ (0, Q.jsx)(z, {
						tone: "error",
						children: X("follow:followManagePage.listFailed")
					}) : /* @__PURE__ */ (0, Q.jsx)("div", {
						role: "status",
						"aria-label": X("follow:followManagePage.listLoading"),
						"data-skeleton": "",
						className: "skeleton-sheen h-32 rounded-lg"
					})]
				}) : null,
				c === "add" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-add",
					"aria-labelledby": "follow-tab-add",
					className: "flex flex-col gap-8",
					children: [
						D.data && E.data ? /* @__PURE__ */ (0, Q.jsx)(hn, {
							data: j,
							credentials: M,
							readOnly: a,
							toast: r
						}) : D.isError || E.isError ? /* @__PURE__ */ (0, Q.jsx)(z, {
							tone: "error",
							children: X("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Q.jsx)("div", {
							role: "status",
							"aria-label": X("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Q.jsx)(bn, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								A.refetch(), l("list"), P({ tab: "list" });
							}
						}),
						E.data ? /* @__PURE__ */ (0, Q.jsx)(Nn, {
							groups: j.author_aliases || [],
							readOnly: a,
							toast: r,
							suggestions: j.alias_suggestions || [],
							sources: j.sources
						}) : null
					]
				}) : null
			]
		}),
		/* @__PURE__ */ (0, Q.jsx)("div", { children: /* @__PURE__ */ (0, Q.jsx)(d, {
			variant: "secondary",
			href: "/settings/subscriptions",
			children: R ? X("follow:followManagePage.feedSettingsPending", { count: R }) : X("follow:followManagePage.feedSettings")
		}) })
	] });
}
export { Ys as FollowManagePage };

//# debugId=cc73cc05-4363-4ff6-8a9c-a1d35da6327b