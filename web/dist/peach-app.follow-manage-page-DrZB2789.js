(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "3b9e063b-5706-417b-a5cd-55036be89b5a", e._sentryDebugIdIdentifier = "sentry-dbid-3b9e063b-5706-417b-a5cd-55036be89b5a");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, DataTableFooter as y, DataTableFrame as ee, DataTableSort as b, EmptyFocusButton as x, EmptyState as te, ErrorText as S, ExternalLink as C, FEEDS_KEY as w, FOLLOW_CHECK_KEY as T, FOLLOW_CHECK_TASK as E, FOLLOW_CREDENTIALS_KEY as D, FOLLOW_MANAGE_KEY as O, FOLLOW_MANAGE_NAV as k, FOLLOW_RESOLVE_KEY as A, FieldLabel as j, Help as M, Input as N, LAYOUTS as P, M6 as F, MENU_ITEM as I, MENU_ITEM_INTERACTIVE as L, MENU_POPOVER_SURFACE as R, ModalFrame as ne, Note as z, P7 as re, SORT_DEFAULT_DIR as B, SORT_OPTIONS as ie, STAT_STRIP_SIX as V, Select as ae, SelectItem as oe, SelectionDock as se, SelectionPopover as H, SiteLabel as U, SortDirectionIcon as ce, SortableBoardTabs as le, Switch as ue, Table as de, TableColumnControls as fe, TableColumnResizer as pe, TableSelectionHeader as me, TagManager as he, TaskProgress as ge, Un as W, Wt as _e, Xf as ve, __toESM as ye, activityKind as be, addAlias as xe, addSource as Se, authorGroups as Ce, authorName as we, avatarInner as Te, busyProps as G, cardClass as Ee, checkEvidenceGap as De, checkFailures as Oe, checkFeeds as ke, checkReceipt as Ae, checkSummary as je, checkedText as Me, clickedBlank as Ne, codedText as Pe, columnVisibilityFeature as Fe, composingKey as Ie, confirmModal as Le, createColumnHelper as Re, credentialDone as ze, cx as Be, dZ as Ve, dropSources as He, du as Ue, errorHeadline as We, errorMessage as K, feedIntervalText as Ge, fetchCheckJob as Ke, fetchCredentials as qe, fetchFeeds as Je, fetchFollow as Ye, fetchResolveJob as Xe, fetchSuggestions as Ze, flexRender as Qe, followFeedByName as $e, followFeedEntity as et, followSuggestKey as tt, groupByAuthor as nt, isBroken as rt, isLayout as it, jobText as at, joinList as q, keepSelected as ot, l7 as st, localTime as ct, lookupFeedActor as lt, mapLimit as ut, markAllPending as dt, pageSizeOf as ft, pageWindow as pt, patchSource as mt, pv as ht, queryClient as gt, quoted as _t, reloadFollowManage as J, removeAlias as vt, removeFeed as yt, removeSource as bt, renameAliasGroup as xt, require_jsx_runtime as St, require_react as Ct, resolveFollowSort as wt, rowPaginationFeature as Tt, rowSelectionFeature as Et, rowSortingFeature as Dt, runBulkAction as Ot, selectionState as kt, serverLabel as At, setFeedEnabled as jt, setSourceEnabled as Mt, sortLabel as Nt, startCheck as Pt, startResolve as Ft, t as Y, tableFeatures as It, tableRows as Lt, toggleGroup as Rt, unmarkItems as zt, useAction as Bt, useBackgroundJob as Vt, useMutation as Ht, useQuery as Ut, useTable as Wt, useTablePreferences as Gt } from "./peach-app.js";
import { Page as Kt } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as qt, ErrorLine as Jt, SourceIcon as Yt, SourceLink as Xt, StatusBadge as Zt } from "./peach-app.source-view--K6uWAMi.js";
import { createPaginatedRowModel as Qt, createSortedRowModel as $t, useTableSelection as en } from "./peach-app.use-table-selection-CnuGRvGn.js";
import { LEGACY_AVATAR_IMG as tn } from "./peach-app.legacy-avatar-NSITxLRS.js";
// src/react/follow-manage/add-source.tsx
var X = /* @__PURE__ */ ye(Ct(), 1), Z = St(), nn = Be(I, L, "text-body-2-medium"), rn = Y("follow:addCreatorSource.placeholder"), an = Y("follow:addCreatorSource.title"), on = Y("follow:addCreatorSource.searchingByName"), sn = Y("follow:addCreatorSource.recognizing"), cn = Y("follow:addCreatorSource.noSourceFound"), ln = "/settings/subscriptions", un = (e, t) => `${e}:${t.url}`;
function dn({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
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
		className: Be(R, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
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
			className: t === i ? Be(nn, "bg-background-secondary-default") : nn,
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
function fn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? Y("follow:addCreatorSource.allSources") : Y("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Z.jsx)(H, {
		label: Y("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: Y("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Z.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Z.jsx)(Yt, { provider: e.provider }), e.provider_label]
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
				href: ln
			}
		]
	});
}
function pn({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Z.jsx)(z, {
		tone: "error",
		title: e.line,
		children: at(e, "error") || Y("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Ee({
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
				let n = un(t, e);
				return /* @__PURE__ */ (0, Z.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(Yt, { provider: e.provider }),
							/* @__PURE__ */ (0, Z.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "min-w-0 break-words",
								children: Pe(e, "label")
							}),
							/* @__PURE__ */ (0, Z.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? Y("follow:addCreatorSource.alreadyFollowing") : Pe(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Z.jsx)(M, { children: cn }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: Pe(e, "evidence")
				}), /* @__PURE__ */ (0, Z.jsx)(C, {
					href: e.url,
					children: Y("follow:shared.labeled", {
						label: Pe(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Z.jsx)(M, { children: q(o.map(([t, n]) => Y("follow:shared.labeled", {
				label: t,
				value: At(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function mn({ data: e, credentials: t, readOnly: n, toast: r }) {
	let [i, a] = (0, X.useState)(""), [o, s] = (0, X.useState)(!1), [c, l] = (0, X.useState)(""), [d, f] = (0, X.useState)(""), [p, m] = (0, X.useState)(!1), [h, g] = (0, X.useState)(null), [_, v] = (0, X.useState)(-1), y = (0, X.useRef)(null), ee = (0, X.useRef)(null), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [te, S] = (0, X.useState)(/* @__PURE__ */ new Set()), [C, w] = (0, X.useState)(""), [T, E] = (0, X.useState)(0);
	(0, X.useEffect)(() => {
		let e = i.trim();
		if (o || !e || e.includes("/")) {
			f("");
			return;
		}
		let t = setTimeout(() => f(e), 250);
		return () => clearTimeout(t);
	}, [i, o]);
	let D = Ut({
		queryKey: tt(d),
		queryFn: ({ signal: e }) => Ze(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), O = (0, X.useMemo)(() => (D.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: At(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: At(e.label_code ?? "", e.label)
	}))), [D.data]), { job: k, running: M, outcome: P, start: F, dismiss: I } = Vt({
		queryKey: A,
		queryFn: ({ signal: e }) => Xe(e),
		start: (e) => Ft([e]),
		onStarted: () => S(/* @__PURE__ */ new Set()),
		onError: (e) => w(K(e)),
		onFinish: (e) => {
			e.status === "failed" && w(at(e, "error") || Y("follow:addCreatorSource.searchFailed"));
		}
	}), L = (e) => {
		let t = e.trim();
		!t || n || o || M || F.isPending || (w(""), v(-1), l(t), a(t), f(""), g(t), F.mutate(t));
	}, R = D.isFetching, ne = p && !o && h !== i && (O.length > 0 || R), re = () => {
		v(-1), g(i);
	}, B = (e) => {
		if (!(o || Ie(e.nativeEvent))) {
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
		key: un(t, e)
	})).filter((e) => !te.has(e.key))), ae = Ht({
		mutationFn: async (e) => {
			let t = [], n = [];
			E(0);
			for (let r of e) {
				try {
					let e = await Se(r.candidate);
					n.push(e.source);
				} catch (e) {
					t.push(Y("follow:shared.labeled", {
						label: r.candidate.label,
						value: K(e)
					}));
				}
				E((e) => e + 1);
			}
			if (n.length) try {
				await Pt(n);
			} catch (e) {
				t.push(K(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			J(), e.failures.length ? w(q(e.failures)) : (w(""), I(), r(Y("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => w(K(e))
	}), oe = e.suggestions || [], se = !c.includes("/");
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": an,
		className: Ee({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: an
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
						children: [/* @__PURE__ */ (0, Z.jsx)(N, {
							"aria-label": Y("follow:addCreatorSource.inputLabel"),
							placeholder: rn,
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
						}), ne ? /* @__PURE__ */ (0, Z.jsx)(dn, {
							field: y,
							menu: ee,
							options: O,
							active: _,
							busy: R,
							onPick: L,
							onClose: re
						}) : null]
					}),
					/* @__PURE__ */ (0, Z.jsx)(fn, {
						credentials: t,
						hidden: b,
						onHidden: x
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...G(M || F.isPending),
						onClick: () => L(i),
						children: Y("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [M || F.isPending ? /* @__PURE__ */ (0, Z.jsx)(ge, {
					embedded: !0,
					kind: be("follow-resolve"),
					label: at(k) || (k?.total ? Y("follow:addCreatorSource.searchProgress", {
						checked: k.checked || 0,
						count: k.total
					}) : se ? on : sn),
					value: k?.checked,
					total: k?.total
				}) : null, C ? /* @__PURE__ */ (0, Z.jsx)(z, {
					tone: "error",
					title: Y("follow:addJavFeed.notCompleted"),
					children: C
				}) : null]
			}),
			ie.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:addCreatorSource.results") }),
					ie.map((e, t) => /* @__PURE__ */ (0, Z.jsx)(pn, {
						row: e,
						at: t,
						hidden: b,
						unpicked: te,
						onPick: (e, t) => {
							let n = new Set(te);
							t ? n.delete(e) : n.add(e), S(n);
						}
					}, `${e.line}-${t}`)),
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "secondary",
								size: "small",
								onClick: () => I(),
								children: Y("follow:shared.close")
							}),
							/* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: n || !V.length,
								...G(ae.isPending),
								onClick: () => ae.mutate(V),
								children: Y("follow:addCreatorSource.addSelected", { count: V.length })
							}),
							ae.isPending ? /* @__PURE__ */ (0, Z.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:addCreatorSource.addingProgress", {
									added: T,
									count: V.length
								})
							}) : null
						]
					})
				]
			}) : null,
			oe.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: Y("follow:addCreatorSource.suggested")
				}), oe.map((e) => /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: n,
					title: e.origin ? Y("follow:addCreatorSource.historyVisitsFrom", {
						count: e.visits,
						origin: e.origin
					}) : Y("follow:addCreatorSource.historyVisits", { count: e.visits }),
					onClick: () => L(e.name),
					children: e.name
				}, e.name))]
			}) : null
		]
	});
}
// src/react/follow-manage/add-feed.tsx
var hn = Y("follow:addJavFeed.placeholder"), gn = Y("follow:addJavFeed.title");
function _n(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: Y("follow:addJavFeed.cardsSplitAcrossPeople", { names: q([...n.values()]) }),
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
function vn({ card: e, picked: t, onPick: n }) {
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
						children: q(e.names)
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
		}), /* @__PURE__ */ (0, Z.jsx)(C, {
			href: e.url,
			children: e.id
		})]
	});
}
function yn({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, X.useState)(""), [a, o] = (0, X.useState)(null), [s, c] = (0, X.useState)(/* @__PURE__ */ new Set()), l = Bt(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => lt(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !Ie(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => $e(a.q, [...s], e), (e) => {
			t(e.created ? Y("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : Y("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => et(e.id, t), () => {
			t(Y("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? _n(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": gn,
		className: Ee({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: gn
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Z.jsx)(N, {
						"aria-label": Y("follow:addJavFeed.actressName"),
						placeholder: hn,
						value: r,
						leadingIcon: ht,
						enterKeyHint: "search",
						isDisabled: e,
						onChange: i,
						onKeyDown: f
					})
				}), /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "primary",
					disabled: e || !r.trim(),
					...G(l.busy === "lookup"),
					onClick: d,
					children: Y("follow:shared.search")
				})]
			}),
			l.error ? /* @__PURE__ */ (0, Z.jsx)(z, {
				tone: "error",
				title: Y("follow:addJavFeed.notCompleted"),
				children: l.error
			}) : null,
			a ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					a.unavailable ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "warning",
						title: Y("follow:addJavFeed.javdbSearchFailed"),
						children: At(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Z.jsx)(vn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Z.jsx)(M, { children: a.unavailable ? Y("follow:addJavFeed.noCardsThisTime") : Y("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Z.jsx)(M, {
						role: "status",
						children: s.size ? g.text : Y("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Z.jsx)(M, {
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
								...G(l.busy === "follow"),
								onClick: m,
								children: Y("follow:addJavFeed.subscribePicked", { count: s.size })
							}) : null,
							_ && !_.following ? /* @__PURE__ */ (0, Z.jsx)(u, {
								variant: "primary",
								size: "small",
								disabled: e,
								...G(l.busy === "known"),
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
function bn({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Z.jsx)(ne, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: Y("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Z.jsx)(xn, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function xn({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, X.useState)(t.canonical_name), o = Bt();
	return /* @__PURE__ */ (0, Z.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => xt(t.canonical_key, i.trim(), e), () => {
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
			/* @__PURE__ */ (0, Z.jsx)(N, {
				"aria-label": Y("follow:creatorAliases.displayName"),
				autoFocus: !0,
				value: i,
				onChange: a
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:creatorAliases.chooseExisting") }), /* @__PURE__ */ (0, Z.jsx)("div", {
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
			o.error ? /* @__PURE__ */ (0, Z.jsx)(z, {
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
					...G(!!o.busy),
					children: Y("follow:creatorAliases.rename")
				})]
			})
		]
	});
}
// src/react/follow-manage/alias-manager.tsx
var Sn = (e) => Y("follow:creatorAliases.removeBody", { alias: e }), Cn = It({
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	rowPaginationFeature: Tt,
	columnVisibilityFeature: Fe,
	sortedRowModel: $t(),
	paginatedRowModel: Qt()
}), wn = Cn, Tn = {
	id: "select",
	label: Y("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, En = {
	id: "canonical",
	label: Y("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, Dn = [
	Tn,
	En,
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
], On = [
	Tn,
	En,
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
], kn = (e) => e.alias;
function An(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function jn({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Z.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Z.jsx)(qt, {
			group: An(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Z.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function Mn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = Gt("alias-suggestions", Dn), f = Gt("alias-saved", On), [p, g] = (0, X.useState)(null), [_, v] = (0, X.useState)({}), [C, w] = (0, X.useState)({}), T = en(() => v({})), E = en(() => w({})), [D, O] = (0, X.useState)([]), [k, A] = (0, X.useState)([]), [M, P] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [F, I] = (0, X.useState)({
		pageIndex: 0,
		pageSize: 20
	}), L = {
		...M,
		pageIndex: Math.min(M.pageIndex, Math.max(0, Math.ceil(t.length / M.pageSize) - 1))
	}, R = {
		...F,
		pageIndex: Math.min(F.pageIndex, Math.max(0, Math.ceil(e.length / F.pageSize) - 1))
	}, [ne, z] = (0, X.useState)(""), [B, ie] = (0, X.useState)(""), [V, ae] = (0, X.useState)(""), oe = Ht({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await xe(n.canonical, n.alias);
				} catch (n) {
					throw t && J(), Error(Y("follow:creatorAliases.mergePartialError", {
						error: K(n),
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
			z(""), v({}), J();
		},
		onError: (e) => z(K(e))
	}), H = Ht({
		mutationFn: (e) => xe(e.canonical, e.alias),
		onSuccess: () => {
			z(""), ie(""), ae(""), J(), l(Y("follow:creatorAliases.saved"));
		},
		onError: (e) => z(K(e))
	}), U = Ht({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await vt(e), n += 1;
			} catch (e) {
				throw Error(Y("follow:creatorAliases.removePartialError", {
					error: K(e),
					removed: n,
					count: t.length - n
				}));
			} finally {
				J();
			}
		},
		onSuccess: (e, t) => {
			z(""), w({}), typeof t == "string" && l(Y("follow:creatorAliases.removed"));
		},
		onError: (e) => z(K(e))
	}), ce = {
		receipt: l,
		failure: (e) => z(K(e))
	}, le = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: Y(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: Y(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: Y("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: q(t.map((e) => Y("follow:creatorAliases.mergePair", {
					alias: _t(e.alias),
					canonical: _t(e.canonical)
				})))
			}),
			confirmLabel: Y(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await oe.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await vt(n.alias);
				await J();
			};
		},
		receipt: (e) => Y("follow:creatorAliases.merged", { count: e.length })
	}), ue = (e, t) => {
		e.length && Ot(le(t, e.length), e, ce).catch(ce.failure);
	}, he = {
		key: "remove",
		reversal: "undo",
		label: Y("follow:creatorAliases.removeSelectedCount", { count: 0 }),
		confirm: (e) => ({
			title: Y("follow:creatorAliases.removeSelectedTitle"),
			body: Y("follow:creatorAliases.removeSelectedBody", { count: e.length }),
			items: e.map((e) => e.name),
			confirmLabel: Y("follow:creatorAliases.removeSelectedConfirm")
		}),
		run: async (e) => (await U.mutateAsync(e.map((e) => e.name)), async () => {
			for (let t of e) await xe(t.canonical, t.name);
			await J();
		}),
		receipt: () => Y("follow:creatorAliases.removed")
	}, ge = (e) => void Le({
		title: Y("follow:creatorAliases.removeTitle"),
		body: Sn(e),
		confirmLabel: Y("follow:creatorAliases.removeTitle"),
		onConfirm: () => U.mutateAsync(e)
	}), W = (0, X.useRef)({
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
	let _e = (0, X.useMemo)(() => {
		let e = Re();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(me, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(jn, {
					sources: W.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: Y("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => At(e.evidence_code ?? "", e.evidence, e.evidence_params), {
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
					disabled: W.current.readOnly,
					...G(W.current.merging),
					onClick: () => W.current.merge([e.row.original], !1),
					children: Y("follow:shared.merge")
				})
			})
		]);
	}, []), ye = (0, X.useMemo)(() => {
		let e = Re();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Z.jsx)(me, {
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
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(jn, {
					sources: W.current.sources,
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
							leadingIcon: re,
							"aria-label": Y("follow:creatorAliases.removeAliasNamed", { name: e.name }),
							disabled: W.current.readOnly,
							...G(W.current.removing),
							onClick: () => W.current.remove(e.name)
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
					disabled: W.current.readOnly,
					"aria-label": Y("follow:creatorAliases.renameRowLabel", { name: e.original.canonical_name }),
					onClick: () => W.current.rename(e.original),
					children: Y("follow:creatorAliases.rename")
				})
			})
		]);
	}, []), be = Wt({
		features: Cn,
		data: t,
		columns: _e,
		getRowId: kn,
		state: {
			rowSelection: _,
			sorting: D,
			pagination: L,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			T(), v(e);
		},
		onSortingChange: (e) => {
			O(e), P((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: P,
		enableRowSelection: !0
	}), Se = Wt({
		features: wn,
		data: e,
		columns: ye,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: C,
			sorting: k,
			pagination: R,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			E(), w(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			A(e), I((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: I
	}), Ce = be.getSelectedRowModel().rows.map((e) => e.original), we = Se.getSelectedRowModel().rows.flatMap((e) => e.original.aliases.map((t) => ({
		name: t.name,
		canonical: e.original.canonical_name
	}))), Te = G(oe.isPending);
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Ee({
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
				children: [/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:creatorAliases.addManually") }), /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(N, {
							"aria-label": Y("follow:creatorAliases.displayName"),
							placeholder: Y("follow:creatorAliases.displayNamePlaceholder"),
							value: B,
							onChange: ie,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(N, {
							"aria-label": Y("follow:creatorAliases.platformAlias"),
							placeholder: Y("follow:creatorAliases.platformAlias"),
							value: V,
							onChange: ae,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							disabled: c || !B.trim() || !V.trim(),
							...G(H.isPending),
							onClick: () => H.mutate({
								canonical: B.trim(),
								alias: V.trim()
							}),
							children: Y("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			ne ? /* @__PURE__ */ (0, Z.jsx)(S, { children: ne }) : null,
			t.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Z.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Z.jsx)("span", {
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
									...Te,
									onClick: () => ue(t, !0),
									children: Y("follow:creatorAliases.mergeAllCount", { count: t.length })
								}),
								/* @__PURE__ */ (0, Z.jsx)(b, {
									label: Y("follow:creatorAliases.pendingTable"),
									sorting: D,
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
										O(e), P((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Z.jsx)(fe, {
									preferences: d,
									label: Y("follow:creatorAliases.pendingTable")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(se, {
						label: Y("follow:creatorAliases.pendingBulkActions"),
						visible: Ce.length > 0,
						count: Y("follow:creatorAliases.groupsSelected", { count: Ce.length }),
						actions: [{
							action: le(!1, Ce.length),
							items: Ce,
							host: ce,
							disabled: c || oe.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: () => v({}),
							children: Y("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(ee, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => be.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(de, {
							"aria-label": Y("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: D[0] ? {
								column: D[0].id,
								direction: D[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => be.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [be.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [Qe(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(pe, {
									preferences: d,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: d.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: be.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(y, {
						label: Y("follow:creatorAliases.pendingTable"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: t.length,
						pagination: L,
						onChange: P
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
							children: [/* @__PURE__ */ (0, Z.jsx)(j, { children: Y("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Z.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: Y("follow:creatorAliases.groupCount", { count: e.length })
							})]
						}), /* @__PURE__ */ (0, Z.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Z.jsx)(b, {
								label: Y("follow:creatorAliases.saved"),
								sorting: k,
								options: [{
									id: "canonical",
									label: Y("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: Y("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									A(e), I((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Z.jsx)(fe, {
								preferences: f,
								label: Y("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Z.jsx)(se, {
						label: Y("follow:creatorAliases.savedBulkActions"),
						visible: we.length > 0,
						count: Y("follow:creatorAliases.aliasesSelected", { count: we.length }),
						actions: [{
							action: {
								...he,
								label: Y("follow:creatorAliases.removeSelectedCount", { count: we.length })
							},
							items: we,
							host: ce,
							disabled: c || U.isPending
						}],
						children: /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: () => w({}),
							children: Y("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(ee, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => Se.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Z.jsxs)(de, {
							"aria-label": Y("follow:creatorAliases.saved"),
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
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [Qe(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(pe, {
									preferences: f,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Z.jsx)(r, {
								id: "remaining-space",
								"aria-label": Y("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: f.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: Se.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
								id: e.id,
								"data-board-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
							}, e.id)) })]
						})
					}), /* @__PURE__ */ (0, Z.jsx)(y, {
						label: Y("follow:creatorAliases.saved"),
						unit: Y("follow:creatorAliases.groupUnit"),
						total: e.length,
						pagination: R,
						onChange: I
					})] }) : /* @__PURE__ */ (0, Z.jsx)(te, {
						size: "compact",
						icon: ve,
						title: Y("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Z.jsx)(x, {
							target: `input[aria-label="${Y("follow:creatorAliases.displayName")}"]`,
							children: Y("follow:creatorAliases.addAlias")
						}),
						children: Y("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Z.jsx)(bn, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var Nn = It({
	rowPaginationFeature: Tt,
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	columnVisibilityFeature: Fe,
	sortedRowModel: $t(),
	paginatedRowModel: Qt()
}), Pn = {
	select: Y("follow:shared.select"),
	name: Y("follow:shared.name"),
	kind: Y("follow:shared.type"),
	origin: Y("follow:followFeed.filterKindSource"),
	status: Y("follow:shared.status"),
	interval: Y("follow:feedSources.colInterval"),
	fetched: Y("follow:feedSources.colLastFetched"),
	fresh: Y("follow:feedSources.colLastAdded"),
	actions: Y("follow:shared.actions")
}, Fn = /* @__PURE__ */ new Set(["actions"]), In = Object.entries(Pn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), Ln = () => gt.invalidateQueries({
	queryKey: w,
	exact: !0
}), Rn = (e) => e.name || e.url;
function zn(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function Bn({ source: e }) {
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
function Vn({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Z.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-background-tertiary-default text-caption-1-semibold text-text-secondary ${tn}`,
		dangerouslySetInnerHTML: { __html: Te(Rn(e), t, null, "performer") }
	});
}
var Hn = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function Un(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function Wn(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return Le({
		title: n ? Y("follow:feedSources.removeOne") : Y("follow:feedSources.removeMany", { count: e.length }),
		body: n ? Y("follow:feedSources.removeOneBody", { name: Rn(n) }) : Y("follow:feedSources.removeManyBody"),
		confirmLabel: Y(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		onConfirm: t
	});
}
function Gn({ readOnly: e, toast: t, onAdd: c, selection: l }) {
	let d = Ut({
		queryKey: w,
		queryFn: ({ signal: e }) => Je(e)
	}), p = Bt(), g = Gt("jav-feeds", In), _ = d.data, v = (0, X.useMemo)(() => _?.sources ?? [], [_]), [x, C] = (0, X.useState)(/* @__PURE__ */ new Set()), T = l?.ids ?? x, E = l?.onChange ?? C, [D, O] = (0, X.useState)(1), [k, A] = (0, X.useState)(20), [j, N] = (0, X.useState)([]), P = pt(v.length, k, D);
	(0, X.useEffect)(() => {
		O((e) => Math.min(e, P.pages));
	}, [P.pages]), (0, X.useEffect)(() => {
		E((e) => {
			let t = new Set(v.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [v, E]);
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
			if (E(/* @__PURE__ */ new Set()), Ln(), t.length) {
				let e = t[0];
				p.setError(Y("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : K(e.error)
				}));
			}
		},
		onError: (e) => p.setError(K(e))
	}), L = {
		receipt: t,
		failure: (e) => p.setError(K(e))
	}, R = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:feedSources.enableMany" : "follow:feedSources.pauseMany"),
			body: Y(e ? "follow:feedSources.enableManyBody" : "follow:feedSources.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => t.enabled !== e), { results: r } = await I.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await ut(i.map((e) => e.id), 4, (t) => jt(t, !e)), await Ln();
			};
		},
		receipt: (t) => Y(e ? "follow:feedSources.enabledMany" : "follow:feedSources.pausedMany", { count: t.length })
	}), ne = {
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
			await I.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => Y("follow:feedSources.removedMany", { count: e.length })
	}, re = (0, X.useMemo)(() => Un(v), [v]), B = (0, X.useRef)({
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
		toggle: (e, t) => void p.run(`enabled-${e.id}`, (n) => jt(e.id, t, n), () => void Ln()),
		fetch: (e) => void p.run(`check-${e.id}`, (t) => ke(t, [e.id]), () => void Ln()),
		remove: (e) => void Wn([e], async () => {
			await yt(e.id), t(Y("follow:feedSources.removedOne", { name: Rn(e) })), Ln();
		})
	};
	let ie = (0, X.useMemo)(() => {
		let e = Re(), t = (e) => () => Pn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(me, {
					table: e.table,
					label: Y("follow:feedSources.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": Y("follow:shared.selectNamed", { name: Rn(e.row.original) })
				})
			}),
			e.accessor(Rn, {
				id: "name",
				header: t("name"),
				cell: (e) => {
					let t = Hn(e.row.original, B.current.shared);
					return /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Z.jsx)(Vn, { source: e.row.original }),
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
			e.accessor((e) => Pe(e, "kind_label"), {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(U, {
						site: e.row.original.kind.startsWith("javdb") ? "javdb" : e.row.original.kind.startsWith("dmm") ? "dmm" : zn(e.getValue()),
						label: zn(e.getValue())
					}), /* @__PURE__ */ (0, Z.jsx)(_e, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? Y("follow:feedSources.fetchFailed") : e.enabled ? Y("follow:shared.enabled") : Y("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Bn, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap",
					children: Ge(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? ct(e.row.original.last_fetched_at) : Y("follow:feedSources.neverFetched")
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
						/* @__PURE__ */ (0, Z.jsx)(ue, {
							"aria-label": Y("follow:shared.enableNamed", { name: Rn(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: B.current.readOnly,
							onChange: (t) => B.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Ve,
							"aria-label": Y("follow:feedSources.fetchNamed", { name: Rn(e.row.original) }),
							disabled: B.current.readOnly,
							...G(B.current.busy === `check-${e.row.original.id}`),
							onClick: () => B.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
							"aria-label": Y("follow:shared.removeNamed", { name: Rn(e.row.original) }),
							disabled: B.current.readOnly,
							onClick: () => B.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), V = (0, X.useMemo)(() => Object.fromEntries([...T].map((e) => [String(e), !0])), [T]), ae = Wt({
		features: Nn,
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
			E(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	});
	if (!_) return d.error ? /* @__PURE__ */ (0, Z.jsx)(z, {
		tone: "error",
		title: Y("follow:feedSources.loadFailed"),
		children: K(d.error)
	}) : /* @__PURE__ */ (0, Z.jsx)(M, { children: Y("follow:feedSources.loading") });
	let oe = () => void p.run("check", (e) => ke(e), () => void Ln()), H = (e) => {
		l?.onActivate(), E((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, ce = v.filter((e) => T.has(e.id)), le = v.filter((e) => e.last_error);
	return /* @__PURE__ */ (0, Z.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Z.jsxs)("section", {
			"aria-label": Y("follow:feedSources.listLabel"),
			className: Ee({
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
								onClick: oe,
								disabled: e,
								...G(p.busy === "check"),
								children: Y("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Z.jsx)(fe, {
								preferences: g,
								label: Y("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Z.jsx)(b, {
								label: Y("follow:feedSources.title"),
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
									label: Pn[e]
								}))
							})
						]
					})]
				}),
				le.length || p.error ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [le.length ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "error",
						title: Y("follow:feedSources.failedTitle", { count: le.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: le.map((e) => /* @__PURE__ */ (0, Z.jsx)("li", {
								className: "min-w-0 truncate",
								title: Pe(e, "last_error"),
								children: Y("follow:shared.labeled", {
									label: Rn(e),
									value: We(Pe(e, "last_error")) || Y("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: Y("follow:feedSources.failedBody")
					}) : null, p.error ? /* @__PURE__ */ (0, Z.jsx)(S, { children: p.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)(se, {
					visible: ce.length > 0,
					label: Y("follow:feedSources.bulkActions"),
					count: Y("follow:feedSources.selectedCount", { count: ce.length }),
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
					children: /* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: () => E(/* @__PURE__ */ new Set()),
						children: Y("follow:shared.clearSelection")
					})
				}),
				v.length ? /* @__PURE__ */ (0, Z.jsx)(ee, {
					follow: !0,
					preferences: g,
					onRowClick: (e) => H(Number(e)),
					children: /* @__PURE__ */ (0, Z.jsxs)(de, {
						"aria-label": Y("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: j[0] ? {
							column: j[0].id,
							direction: j[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => ae.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [ae.getHeaderGroups()[0].headers.map((e) => {
							let t = Qe(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Z.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...g.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [Fn.has(e.column.id) ? /* @__PURE__ */ (0, Z.jsx)(s, { children: t }) : /* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [t, e.column.getCanSort() ? /* @__PURE__ */ (0, Z.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Z.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Z.jsx)(pe, {
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
						})] }), /* @__PURE__ */ (0, Z.jsx)(n, { children: ae.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id)) })]
					})
				}) : /* @__PURE__ */ (0, Z.jsx)(te, {
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
					total: P.total,
					unit: Y("follow:feedSources.unit"),
					pagination: {
						pageIndex: P.page - 1,
						pageSize: k
					},
					onChange: (e) => {
						A(e.pageSize), O(e.pageIndex + 1);
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
var Kn = It({
	rowPaginationFeature: Tt,
	rowSelectionFeature: Et,
	rowSortingFeature: Dt,
	columnVisibilityFeature: Fe,
	paginatedRowModel: Qt()
}), qn = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), Jn = 740;
function Yn() {
	let [e, t] = (0, X.useState)(!1), n = (0, X.useRef)(null), r = (0, X.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < Jn));
		r.observe(e), n.current = r, t(e.clientWidth < Jn);
	}, []);
	return (0, X.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var Xn = {
	select: Y("follow:shared.select"),
	author: Y("follow:shared.creator"),
	source: Y("follow:followFeed.filterKindSource"),
	provider: Y("follow:shared.site"),
	status: Y("follow:shared.status"),
	checked: Y("follow:sourceList.colLastChecked"),
	actions: Y("follow:shared.actions")
}, Zn = Object.entries(Xn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
}));
function Qn({ source: e, selected: t, onToggle: n, handlers: r }) {
	return /* @__PURE__ */ (0, Z.jsxs)("div", {
		"data-selected": t || void 0,
		"data-follow-source-row": "",
		className: "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3 last:rounded-b-lg max-sm:gap-x-2",
		onClick: (e) => {
			Ne(e, e.currentTarget) && n(!t);
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
					children: /* @__PURE__ */ (0, Z.jsx)(Yt, { provider: e.provider })
				}), /* @__PURE__ */ (0, Z.jsx)(Xt, { source: e })]
			}),
			/* @__PURE__ */ (0, Z.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Z.jsx)(Zt, { source: e }),
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
						children: /* @__PURE__ */ (0, Z.jsx)(Jt, { text: Pe(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: Me(e)
					}),
					/* @__PURE__ */ (0, Z.jsx)(ue, {
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
							leadingIcon: Ve,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...G(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
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
function $n({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(rt).length, p = q([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = kt(r, l);
	return /* @__PURE__ */ (0, Z.jsxs)("section", {
		"aria-label": Y("follow:sourceList.groupLabel", { name: t }),
		className: Ee({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Z.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Z.jsx)(qt, {
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
							e.map((e) => /* @__PURE__ */ (0, Z.jsx)(Yt, { provider: e.provider }, e.id)),
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
						leadingIcon: Ve,
						"aria-label": Y("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...G(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: st,
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
			children: e.map((e) => /* @__PURE__ */ (0, Z.jsx)(Qn, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function er(e) {
	let { data: t, sort: c, dir: l, page: d, layout: g, pageSize: v, selected: b, readOnly: x, onSort: S, onPage: C, onLayout: w, onPageSize: D, onSelected: O, toast: k, openFollow: A, onAdd: j } = e, M = t.sources, N = (0, X.useMemo)(() => t.author_aliases || [], [t.author_aliases]), I = t.counts || {}, [L, R] = (0, X.useState)(/* @__PURE__ */ new Set()), [ne, re] = Yn(), [V, H] = (0, X.useState)(""), U = (0, X.useMemo)(() => Ce(M, c, l, N), [
		M,
		c,
		l,
		N
	]), le = (0, X.useMemo)(() => Lt(U, c, l, N), [
		U,
		c,
		l,
		N
	]), { job: he, running: _e, outcome: ve, start: ye } = Vt({
		queryKey: T,
		taskKey: E,
		queryFn: ({ signal: e }) => Ke(e),
		start: (e) => Pt(e),
		onError: (e) => H(K(e)),
		onFinish: (e) => {
			J(), k(e.status === "failed" ? at(e, "error") || Y("follow:followCheck.checkFailed") : Ae(e));
		}
	}), xe = (e) => {
		_e || ye.isPending || (H(""), ye.mutate(e));
	}, Se = (e, t) => O(Rt(b, [e], t)), Te = (e, t) => O(Rt(b, e, t)), ke = Ht({
		mutationFn: (e) => bt(e),
		onSuccess: (e, t) => {
			He([t]), O(Rt(b, [t], !1)), k(Y("follow:sourceList.unfollowed"));
		},
		onError: (e) => H(K(e))
	}), Ne = Ht({
		mutationFn: (e) => Mt(e.id, e.enabled),
		onSuccess: (e, t) => {
			mt(t.id, { enabled: t.enabled }), H("");
		},
		onError: (e) => H(K(e))
	}), Fe = (e) => void Le({
		title: Y("follow:sourceList.unfollow"),
		body: Y("follow:sourceList.unfollowBody"),
		confirmLabel: Y("follow:sourceList.unfollow"),
		danger: !0,
		onConfirm: () => ke.mutateAsync(e.id)
	}), Ie = Ht({
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
			if (e.action === "remove") He(e.done);
			else for (let t of e.done) mt(t, { enabled: e.action === "enabled" });
			O(Rt(b, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? H(Y("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: K(t[0]?.error)
			})) : H("");
		},
		onError: (e) => H(K(e))
	}), ze = Ht({
		mutationFn: dt,
		onSuccess: (e) => {
			J(), e.failed ? H(Y("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: K(e.error)
			})) : H("");
		},
		onError: (e) => H(K(e))
	}), Be = {
		receipt: k,
		failure: (e) => H(K(e))
	}, Ge = (e) => ({
		key: e ? "enable" : "pause",
		label: Y(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: Y(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: Y(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => M.find((e) => e.id === t)?.enabled !== e), { done: r } = await Ie.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await ut(r, 4, (t) => Mt(t, !e));
				for (let t of r) mt(t, { enabled: !e });
			};
		},
		receipt: (t) => Y(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), qe = {
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
			await Ie.mutateAsync({
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
			run: async () => (t = (await ze.mutateAsync(e)).marked, async () => {
				await zt(t), await J();
			}),
			receipt: () => Y("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Ye = (e, t) => Ne.mutate({
		id: e.id,
		enabled: t
	}), Xe = (0, X.useRef)({
		check: xe,
		toggle: Ye,
		remove: Fe,
		busy: !1,
		readOnly: x
	});
	Xe.current = {
		check: xe,
		toggle: Ye,
		remove: Fe,
		busy: _e || ye.isPending,
		readOnly: x
	};
	let Ze = Xe.current, $e = (0, X.useMemo)(() => {
		let e = Re(), t = (e) => () => Xn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Z.jsx)(me, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(qt, {
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
					children: [/* @__PURE__ */ (0, Z.jsx)(Xt, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Z.jsx)(Jt, { text: Pe(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Z.jsx)(Yt, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsx)(Zt, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => Me(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Z.jsx)(ue, {
							"aria-label": Y("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: Ze.readOnly,
							onChange: (t) => Xe.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: Ve,
							"aria-label": Y("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || Ze.readOnly,
							...G(Ze.busy),
							onClick: () => Xe.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: F,
							"aria-label": Y("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: Ze.readOnly,
							onClick: () => Xe.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [Ze]), et = (0, X.useMemo)(() => {
		let e = qn[c];
		return e ? [{
			id: e,
			desc: l === "desc"
		}] : [];
	}, [c, l]), tt = (0, X.useMemo)(() => Object.fromEntries([...b].map((e) => [String(e), !0])), [b]), nt = g === "table", rt = Gt("follow-sources", Zn), it = pt(nt ? le.length : U.length, v, d), q = Wt({
		features: Kn,
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
			n && S(n, t.desc ? "desc" : "asc");
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
			n.pageSize === v ? n.pageIndex !== t.pageIndex && C(n.pageIndex + 1) : D(n.pageSize);
		}
	}), ot = q.getRowModel().rows, st = nt ? ot.map((e) => e.original.source.id) : U.slice(it.start, it.end).flatMap((e) => e.map((e) => e.id)), ct = kt(b, st), lt = [...b], ft = Oe(ve), ht = M.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), gt = De(ve), _t = U.length > 0 && L.size >= U.length;
	return M.length ? /* @__PURE__ */ (0, Z.jsxs)("div", {
		className: Ee({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				ref: ne,
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
						children: I.new ? Y("follow:sourceList.sourceCountUnseen", {
							count: M.length,
							unseen: Number(I.new) || 0
						}) : Y("follow:sourceList.sourceCount", { count: M.length })
					})]
				}), /* @__PURE__ */ (0, Z.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						ht.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							disabled: x,
							...G(Ze.busy),
							onClick: () => xe(ht),
							children: Y("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "primary",
							leadingIcon: Ve,
							disabled: x,
							"aria-label": Y("follow:sourceList.checkAll"),
							iconOnly: re,
							...G(Ze.busy),
							onClick: () => xe([]),
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
										leadingIcon: W,
										"aria-label": P[0][1],
										"aria-pressed": !nt,
										onClick: () => w("default")
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: Ue,
										"aria-label": P[1][1],
										"aria-pressed": nt,
										onClick: () => w("table")
									})]
								}),
								nt ? /* @__PURE__ */ (0, Z.jsx)(fe, {
									preferences: rt,
									label: Y("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Z.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Z.jsx)(ae, {
										"aria-label": Y("follow:sourceList.sortLabel"),
										prefix: Y("follow:shared.sort"),
										selectedKey: c,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											S(t, B[t]);
										},
										children: ie.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(oe, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Z.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: ce,
										"data-icon-state": l === "asc" ? "a" : "b",
										"aria-label": Nt(c, l),
										onClick: () => S(c, l === "asc" ? "desc" : "asc")
									})]
								}),
								nt ? null : /* @__PURE__ */ (0, Z.jsx)(u, {
									variant: "secondary",
									iconOnly: re,
									leadingIcon: _,
									"aria-expanded": !_t,
									"aria-label": Y(_t ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => R(_t ? /* @__PURE__ */ new Set() : new Set(U.map((e) => String(e[0].author_key || e[0].id)))),
									children: Y(_t ? "follow:shared.expandAll" : "follow:shared.collapseAll")
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
					_e ? /* @__PURE__ */ (0, Z.jsx)(ge, {
						embedded: !0,
						kind: he?.older ? be("feed-scrape") : be("follow-check"),
						label: at(he) || (he?.total ? Y(he.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: he.checked || 0,
							count: he.total
						}) : Y("follow:sourceList.preparingCheck")),
						value: he?.checked,
						total: he?.total
					}) : null,
					V ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "error",
						title: Y("follow:shared.actionFailed"),
						children: V
					}) : null,
					!_e && ve?.results?.length ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "neutral",
						title: Y("follow:followFeed.checkResults"),
						children: je(ve)
					}) : null,
					ft.length ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "error",
						title: Y("follow:sourceList.failedTitle", { count: ft.length }),
						extra: /* @__PURE__ */ (0, Z.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ft.map((e, t) => /* @__PURE__ */ (0, Z.jsx)("li", { children: Y("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: We(e.error || "") || Y("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: Y("follow:sourceList.failedBody")
					}) : null,
					gt ? /* @__PURE__ */ (0, Z.jsx)(z, {
						tone: "warning",
						children: Y("follow:sourceList.evidenceGap", { error: gt })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)(se, {
				label: Y("follow:sourceList.bulkActions"),
				visible: lt.length > 0,
				count: Y("follow:sourceList.selectedCount", { count: lt.length }),
				actions: [
					Ge(!0),
					Ge(!1),
					qe
				].map((e) => ({
					action: e,
					items: lt,
					host: Be,
					disabled: x || Ie.isPending
				})),
				children: [/* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: x,
					...G(Ze.busy),
					onClick: () => xe(lt),
					children: Y("follow:sourceList.checkSelected")
				}), /* @__PURE__ */ (0, Z.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: () => O(/* @__PURE__ */ new Set()),
					children: Y("follow:shared.clearSelection")
				})]
			}),
			nt ? /* @__PURE__ */ (0, Z.jsx)(ee, {
				follow: !0,
				preferences: rt,
				onRowClick: (e) => Se(Number(e), !b.has(Number(e))),
				children: /* @__PURE__ */ (0, Z.jsxs)(de, {
					"aria-label": Y("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: et[0] ? {
						column: et[0].id,
						direction: et[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => q.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Z.jsxs)(o, { children: [q.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = Qe(e.column.columnDef.header, e.getContext());
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
							}) : /* @__PURE__ */ (0, Z.jsx)(s, { children: n }), /* @__PURE__ */ (0, Z.jsx)(pe, {
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
						children: ot.map((e) => /* @__PURE__ */ (0, Z.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Z.jsx)(a, { children: Qe(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Z.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Z.jsx)(m, {
				isSelected: ct.all,
				isIndeterminate: ct.some,
				onChange: (e) => Te(st, e),
				"aria-label": Y("follow:sourceList.selectPage"),
				children: Y("follow:sourceList.selectPageShort")
			}), /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex flex-col gap-3",
				children: U.slice(it.start, it.end).map((e) => {
					let t = String(e[0].author_key || e[0].id);
					return /* @__PURE__ */ (0, Z.jsx)($n, {
						group: e,
						name: we(e, N),
						handlers: Ze,
						selected: b,
						open: !L.has(t),
						onOpen: (e) => {
							let n = new Set(L);
							e ? n.delete(t) : n.add(t), R(n);
						},
						onToggleGroup: (t) => Te(e.map((e) => e.id), t),
						onToggle: Se
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
					e.pageSize === v ? q.setPageIndex(e.pageIndex) : q.setPageSize(e.pageSize);
				}
			}),
			I.new ? /* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Z.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: Y("follow:sourceList.markSummary", {
							unwatched: Number(I.new) || 0,
							watched: Number(I.seen) || 0,
							saved: Number(I.saved) || 0,
							ignored: Number(I.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Z.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: A,
						children: Y("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = Je(e);
						return /* @__PURE__ */ (0, Z.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: x,
							...G(ze.isPending),
							onClick: () => void Ot(t, [Number(I.new) || 0], Be).catch(Be.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Z.jsx)(te, {
		icon: f,
		title: Y("follow:sourceList.empty"),
		actions: /* @__PURE__ */ (0, Z.jsx)(u, {
			variant: "primary",
			size: "small",
			onClick: j,
			children: Y("follow:followFeed.addFollow")
		}),
		children: Y("follow:sourceList.emptyHint")
	});
}
// node_modules/skullet/dist/index.mjs
var tr = "skullet-reveal", nr = "skullet-pane", rr = "skullet-loading", ir = "skullet-ghost", ar = "skullet-snapshot", or = "skullet-layer", sr = "skullet-rect", cr = "skullet-bar", lr = "skullet-inactive", ur = "skullet-exiting", dr = "skullet-covered", fr = "skullet-own", pr = "skullet-block", mr = Symbol.for("skullet.ghost"), hr = Symbol.for("skullet.uncover"), gr = "skullet-status", _r = "skullet-xray", vr = "var(--skullet-base, rgb(128 128 128 / 0.2))", yr = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", br = 280, xr = 1e4, Sr = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, Cr = [
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
], wr = [
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
], Tr = wr.join(", "), Er = `
[${tr}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${nr}] {
  display: block;
}

[${rr}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${lr}] {
  display: none !important;
}

[${or}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${cr}] {
  display: block;
  background-color: ${vr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${rr}]) to ([${fr}], [${or}]) {
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
  :scope :is(${Cr.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${Tr}, [${dr}], [${pr}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${vr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${Tr}, [${pr}]):not(svg *) {
      visibility: visible !important;
      background: ${vr} !important;
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
[${gr}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${_r}] [${rr}] [${ir}],
[${_r}] [${rr}] [${ir}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Dr = null, Or = 0, kr;
function Ar() {
	Or++, !Dr && (kr ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !kr && (Dr = document.createElement("style"), Dr.dataset.skullet = "true", Dr.textContent = Er, document.head.appendChild(Dr)));
}
function jr() {
	Or--, !(Or > 0 || !Dr) && (Dr.remove(), Dr = null);
}
var Mr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", Nr = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...Nr });
function Pr(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? Nr[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var Fr = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function Ir({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = Pr(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${Fr(o)} }`), a === "system") {
		let t = Pr({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${Fr(t)} } }`);
	}
	return s.join("\n");
}
var Lr = /* @__PURE__ */ new Map(), Rr, Q = null, zr = 0;
function Br() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var Vr = () => Rr ??= typeof window < "u" && Br(), Hr = (e) => Vr() || !!e?.closest("[skullet-debug]");
function Ur(e) {
	Rr = e, e ? Jr() : Yr();
}
function Wr(e, t) {
	!e || !Hr(e) || (Lr.set(e, {
		state: "loading",
		source: t
	}), Kr());
}
function Gr(e, t) {
	!e || !Hr(e) || (Lr.set(e, {
		...Lr.get(e),
		state: "shown",
		moved: t
	}), Kr());
}
function Kr() {
	Jr(), cancelAnimationFrame(zr), Zr();
}
var qr = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function Jr() {
	if (typeof document > "u") return;
	if (!Q?.isConnected) {
		Q = document.createElement("div"), Q.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = Q.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${qr}</style><div class="boxes"></div>`, document.body.append(Q);
	}
	let e = Q.shadowRoot;
	if (Rr && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(_r, e.target.checked);
		}), e.append(t);
	}
	zr ||= requestAnimationFrame(Zr);
}
function Yr() {
	Q?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(_r), ![...Lr.keys()].some((e) => Hr(e)) && (cancelAnimationFrame(zr), zr = 0, Q?.remove(), Q = null);
}
var Xr = ({ state: e, source: t, moved: n }) => {
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
function Zr() {
	if (zr = 0, !Q?.shadowRoot) return;
	let e = Q.shadowRoot.querySelector(".boxes");
	for (let e of Lr.keys()) e.isConnected && Hr(e) || Lr.delete(e);
	let t = [...Lr];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = Xr(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), (Rr || Lr.size) && (zr = requestAnimationFrame(Zr));
}
var Qr, $r = () => Qr ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), ei = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, ti = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], ni = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function ri(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function ii(e, t, n) {
	let r = ei(e, t), i = ri(n, t), a = e ? ti(e) : [], o = ti(t), s = ti(r).map((t, n) => ni(t, o[n]) ? i[n] : e && ni(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function ai(e, t, n, r) {
	if (!e) return n;
	let i = ti(e), a = ti(t).map((t, n) => e.corners[n] > 0 && ni(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = ri(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var oi = (e, t) => {
	let n = ei(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, si = {
	top: "ascender",
	bottom: "descender"
}, ci = /* @__PURE__ */ new Map(), li = (e) => [...e.getClientRects?.() ?? []];
function ui(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (ci.has(t)) return ci.get(t);
	let n = $r(), r = null;
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
	return ci.set(t, r), r;
}
var di = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, fi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function pi(e, t, n) {
	let r = ui(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = fi(t, "--skullet-text-top", Object.keys(di), si.top), a = fi(t, "--skullet-text-bottom", ["baseline", "descender"], si.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[di[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var mi = new Set(wr), hi = new Set(Cr), gi = .4, _i = /[,/]\s*0\)$/, vi = (e, t) => e !== "" && e !== t, yi = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], bi = (e) => yi.every((t) => vi(e[`border${t}Style`], "none") && vi(e[`border${t}Width`], "0px")), xi = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, Si = (e) => vi(e, "none") && !e.split(/,(?![^(]*\))/).every(xi), Ci = (e) => vi(e.backgroundColor, "transparent") && !_i.test(e.backgroundColor) || vi(e.backgroundImage, "none") || Si(e.boxShadow) || bi(e), wi = (e) => mi.has(e.localName), Ti = (e) => hi.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), Ei = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(li(n).filter((e) => e.width || e.height));
		} else Ti(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * gi, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, Di = (e, t) => e.hasAttribute("skullet-block") || wi(e) || Ci(t) && Ei(e) <= 1;
function Oi(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function ki(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * gi;
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
function Ai(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = oi(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...pi(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of li(d)) f(e, r, t);
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
			if (Di(e, r)) {
				let n = oi(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: ai(t, n, Oi(e, r), r)
					});
				}
				wi(e) || u.add(e);
				continue;
			}
			if (Ti(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? ii(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...ki(l)];
	for (let t of e.querySelectorAll(`[${dr}]`)) u.has(t) || t.removeAttribute(dr);
	for (let e of u) e.hasAttribute(dr) || e.setAttribute(dr, "");
	return [...c, ...ki(l)];
}
var ji = (e) => typeof matchMedia < "u" && matchMedia(e).matches, Mi = () => typeof Element < "u" && typeof Element.prototype.animate == "function", Ni = () => !Mi() || ji("(prefers-reduced-motion: reduce)"), Pi = () => ji("(prefers-reduced-transparency: reduce)"), Fi = (e) => e.getAnimations?.() ?? [], Ii = .7, Li = 1280, Ri = 320, zi = 2.5, Bi = .45, Vi = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function Hi(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", Vi, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Sr[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var Ui = 20, Wi = Math.sin(Ui * Math.PI / 180), Gi = Math.cos(Ui * Math.PI / 180), Ki = Wi / Gi, qi = Gi, Ji = `${90 + Ui}deg`, Yi = .85, $ = 12, Xi = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function Zi(e) {
	let t = e * zi, n = (t, n) => `color-mix(in srgb, ${yr} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * Yi, Xi(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(Yi + e / $ * (1 - Yi), Xi(1 - e / $)));
	return {
		width: t / Gi,
		image: `repeating-linear-gradient(${Ji}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function Qi(e, t, n = Hi(e)) {
	for (let t of Fi(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", Ni() || typeof e.animate != "function" || n.animation === "none") return;
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
				opacity: Bi,
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
	}, { width: s, image: c } = Zi(Math.min(Math.max(o.width * .4, 80), Ri)), l = a - o.left + (i.top - o.top) * Ki, u = n.duration * Ii / (Li + Ri);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function $i(e) {
	if (Ni()) return null;
	let t = Hi(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * Ii / (Li + Ri);
}
var ea = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), ta = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function na(e, t) {
	let n = ea(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = Hi(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${vr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, Qi(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var ra = 120, ia = 72, aa = 3, oa = 60, sa = 150, ca = 400, la = 1.5, ua = 1e3, da = 1e3, fa = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), pa = -1 / 0, ma = !1;
function ha() {
	if (!(ma || typeof addEventListener > "u")) {
		ma = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => pa = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var ga = /* @__PURE__ */ new WeakMap();
function _a(e, { served: t, refetch: n }) {
	ha();
	let r = ga.get(e)?.since ?? performance.now();
	ga.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function va(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function ya(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var ba = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function xa(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${ur}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var Sa = (e, t) => Math.min(Math.max(e, 0), t), Ca = -1 / 0;
function wa(e, t, n, r, i) {
	let a = performance.now();
	a - Ca > sa && (Ca = a);
	let o = a - Ca, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of va(e)) {
		let n = ya(t, e), r = c.get(n);
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
		return t === null ? null : Sa(t, ua) + Math.max(r.delay ?? 0, 0);
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
			let t = [...c.values()].find((t) => ba(t.rect, e));
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
function Ta(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) fa.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function Ea(e, t, n, r = () => {}) {
	let i = ga.get(t);
	ga.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - pa < ca,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: va(e).length
			})
		};
	}
	let o = Sa(a.duration ?? 200, da);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, ua)
	}, !o) return { kind: "instant" };
	let s = Ta(a.enter, r);
	if (a.wipe) {
		let e = xa(t);
		if (e.width * e.height <= innerWidth * innerHeight * la) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return wa(e, t, a.order, {
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
var Da = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return Sa(n * .8 + r * .2, 1) * 320;
}, Oa = (e) => e.bottom > 0 && e.top < innerHeight, ka = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return Oa(e) ? 0 : null;
	if (!Oa(t)) return null;
	let i = Sa(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? oa : 0);
}, Aa = { duration: 0 }, ja = { order: "together" }, Ma = { order: Da }, Na = (e) => e.input || e.waited < 150 ? Aa : e.refetch ? {
	order: "together",
	duration: ra
} : null, Pa = (e) => e.height < ia || e.pieces <= aa ? ja : { order: ka }, Fa = {
	hold: 150,
	choose: (e) => Na(e) ?? Pa(e)
}, Ia = new Set(wr), La = "script, noscript, template, base, meta, link", Ra = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), za = /* @__PURE__ */ new Set([
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
	dr
]), Ba = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function Va(e, t) {
	let n = Ba(t.data);
	t.data = n;
	let r = e.parentElement, i = $r();
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
function Ha(e) {
	for (let t of e.querySelectorAll(La)) t.remove();
	for (let t of e.querySelectorAll("*")) if (Ra.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || za.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function Ua(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (Ia.has(e.localName) || Ra.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) Va(e, t);
	return Ha(n), n.innerHTML;
}
function Wa(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, Ha(t.content), t.content;
}
var Ga = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${Ga(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), Ka = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function qa(e) {
	let t = Ga(e, 2);
	return t ? `${location.pathname}|${Ka(t)}` : null;
}
var Ja = !1;
try {
	Ja = !1;
} catch {
	Ja = !1;
}
var Ya = Ja, Xa = /* @__PURE__ */ new Set();
function Za(e, t) {
	!Ya || Xa.has(e) || (Xa.add(e), console.warn(`[skullet] ${t}`));
}
var Qa = /^(https?:|\/|data:|blob:)/;
function $a(e) {
	return typeof e == "string" ? Qa.test(e) ? "" : Ba(e) : Array.isArray(e) ? e.map($a) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, $a(t)])) : e;
}
var eo = "skullet:shapes", to = 2, no = 50, ro = 2e4, io = /* @__PURE__ */ new Map(), ao = /* @__PURE__ */ new Map();
function oo(e, t) {
	return ao.has(e) || ao.set(e, /* @__PURE__ */ new Set()), ao.get(e).add(t), () => ao.get(e)?.delete(t);
}
function so(e) {
	for (let t of ao.get(e) ?? []) t();
}
function co() {
	try {
		let e = JSON.parse(localStorage.getItem(eo) ?? "null");
		return e?.v === to ? e.shapes : {};
	} catch {
		return {};
	}
}
function lo(e) {
	try {
		localStorage.setItem(eo, JSON.stringify({
			v: to,
			shapes: e
		}));
	} catch {}
}
function uo(e, t) {
	io.set(e, Ua(t, !1));
	let n = Ua(t, !0);
	if (n.length > ro) return;
	let r = co();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - no)) delete r[e];
	lo(r);
}
function fo(e) {
	return io.get(e) ?? co()[e] ?? null;
}
var po = [
	100,
	90,
	60
].map((e) => `<div ${pr} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), mo = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${rr}]`)), ho = /* @__PURE__ */ new WeakMap();
function go(e) {
	if (!e) return;
	let t = ho.get(e);
	return ho.delete(e), t;
}
function _o(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var vo = (e) => !!e.firstElementChild || !!e.textContent?.trim(), yo = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, Ar(), e[mr] = !0, e.setAttribute(rr, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = _o(e, ir), this.snapshot = _o(e, ar), this.layer = _o(e, or), this.hadContent = vo(this.ghost);
		let n = e.closest(`[${tr}]`);
		n && _a(n, {
			served: mo.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[hr]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
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
		this.root.closest(`[${ur}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = vo(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || mo.has(this.root), r = !!this.ghost.querySelector(`[${fr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? qa(this.ghost);
			n && (so(n), t = fo(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(Wa(t)) : e === "fallback" ? (this.snapshot.innerHTML = po, Za(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(lr, e !== "ghost"), this.snapshot.toggleAttribute(lr, e === "ghost"), this.source = e, Wr(this.root.closest(`[${tr}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : mo.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		na(this.layer, Ai(e, this.layer));
		let t = this.root.closest(`[${tr}]`);
		t && ho.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), jr();
	}
}, bo = 250, xo = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? qa(e), this.untrack = this.key ? oo(this.key, () => this.save()) : () => {}, (Ya || Hr(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
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
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), bo);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && uo(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${tr}]`), o = go(a);
		if (!o) return;
		o.guessed && n && !r && e != null && Za(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify($a(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (Gr(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? Za(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : Za(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, So = () => {}, Co = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, wo = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !Co(e));
function To(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(So, So), new Promise((e) => setTimeout(e, xr))]);
}
var Eo = 360, Do = 2, Oo = 600, ko = 40, Ao = ko / qi, jo = 320, Mo = 120, No = .45, Po = (e) => e.left + e.top * Ki, Fo = (e) => e.width + e.height * Ki, Io = (e, t) => Po(t) - Ao + (Fo(t) + 2 * Ao) * e, Lo = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function Ro(e) {
	let t = e.querySelector(`:scope > [${ur}] [${or}]`), n = t && $i(t);
	if (!n) return null;
	let r = xa(e);
	if (r.width * r.height > innerWidth * innerHeight * la) return null;
	let i = Po(r), a = i + Fo(r), o = performance.now(), s = o - Lo.start;
	s <= sa && (i - Lo.origin) / Lo.speed >= s && (a - Lo.origin) / Lo.speed - s <= Oo || (Lo = {
		start: o,
		origin: i,
		speed: Math.max(Do / n, (a - i) / Eo)
	});
	let { start: c, origin: l, speed: u } = Lo;
	return {
		delay: (i - Ao - l) / u - (o - c),
		duration: (a - i + 2 * Ao) / u
	};
}
var zo = (e) => (t, { rect: n, reveal: r }) => {
	let i = (Io(t, r) - Po(n)) * qi;
	return `linear-gradient(${Ji}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - Xi(n / $) : Xi(n / $), a = -ko + 2 * ko * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, Bo = "http://www.w3.org/2000/svg", Vo = null, Ho = 0;
function Uo() {
	return Vo?.isConnected || (Vo = document.createElementNS(Bo, "svg"), Vo.setAttribute("aria-hidden", "true"), Vo.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(Vo)), Vo;
}
var Wo = (e, t) => {
	let n = document.createElementNS(Bo, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, Go = {
	mask: zo(!0),
	out: zo(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (Pi()) return;
		let i = Po(t), a = Fo(t), o = jo / 2 / qi, s = () => Io(r(), n) - i - Mo / qi;
		if (s() - o > a) return;
		let c = 2 * o + t.height * Ki, l = c / 2, u = t.height / 2, d = jo / 2 * qi, f = jo / 2 * Ki * qi, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${Xi(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++Ho}`, _ = Wo("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = Wo("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(Wo(`feFunc${e}`, {
			type: "linear",
			slope: 1 - No,
			intercept: No
		}));
		let y = Wo("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, Wo("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), Wo("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), Uo().append(_), e.style.filter = `url(#${g})`;
		let ee = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * Ki) / t.width).toFixed(4)), requestAnimationFrame(ee));
		};
		ee();
	}
}, Ko = {
	together: ja,
	sequence: Ma,
	smart: Fa,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = Na(e);
			if (t) return t;
			let n = Ro(e.reveal);
			return n ? {
				wipe: Go,
				...n
			} : Pa(e);
		}
	}
}, qo = (e = "smart") => typeof e == "string" ? Ko[e] : e, Jo = () => {}, Yo = (e) => e.finished.then(Jo, Jo), Xo = /* @__PURE__ */ new WeakMap();
function Zo(e, t = 0, n = 200, r = 0, i) {
	return Ni() ? Promise.resolve() : Yo(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var Qo = (e) => !!e.querySelector(`[${or}], [${ir}], :scope > [${fr}]`), $o = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, es = /* @__PURE__ */ new WeakMap();
function ts(e) {
	for (let t of es.get(e) ?? []) t.remove();
	es.delete(e);
}
function ns(e, t) {
	let n = wo(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && Qo(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${ur}] [${or}]`)].flatMap(ta), a = es.get(t) ?? /* @__PURE__ */ new Set();
			es.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => $o(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(sr, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: vr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), Qi(c), To(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", Zo(e), Ni()) return c.remove();
						Yo(c.animate([{ opacity: 1 }, { opacity: 0 }], {
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
function rs(e, t) {
	return Ni() ? Promise.resolve() : Promise.all(va(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return Zo(e, n, t.duration, 0, t.enter);
	})).then(Jo);
}
function is(e) {
	for (let t of e.querySelectorAll(`:scope > [${ur}]`)) {
		for (let e of Fi(t)) e.finish();
		t.style.opacity = "0";
	}
}
function as(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${ur}]`)) if (!Qo(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of Fi(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function os(e, t = "smart", { initial: n = !1 } = {}) {
	let r = ss.get(e);
	return r || (r = cs(e, t, n), ss.set(e, r)), r;
}
var ss = /* @__PURE__ */ new WeakMap();
function cs(e, t, n) {
	let r = e.parentElement, i = qo(t);
	if (Qo(e)) {
		r && ts(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && Xo.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : Zo(e, t)) : (r && Xo.delete(r), n ? Promise.resolve() : Zo(e));
	}
	if (n || !r) return Promise.resolve();
	let a = as(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return Xo.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), Zo(e, 0, t, a);
	}
	ns(e, r);
	let o = Ea(e, r, i, (e) => Za(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return Xo.set(r, o), o.kind === "instant" ? (is(r), Promise.resolve()) : o.kind === "sequence" ? rs(e, o) : o.kind === "wipe" ? xs(e, o, !0) : Zo(e, o.delay, o.duration, 0, o.enter);
}
function ls(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function us(e, t = ls(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(ur, ""), t;
}
var ds = /* @__PURE__ */ new WeakMap();
function fs(e, t) {
	let n = e.querySelector(`:scope > [${nr}]:not([${ur}])`);
	if (!n) return;
	let r = ds.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && ps(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: br,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	ds.set(e, u), Yo(l).then(() => {
		ds.get(e) === u && ps(e, u);
	});
}
function ps(e, { overflow: t, boxSizing: n }) {
	ds.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function ms(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of Fi(e)) t.cancel();
	bs(e), e.style.filter = "";
	let i = e.parentElement;
	i && !Qo(e) && ts(i);
	let a = us(e, t), o = (t, n) => Mi() ? Yo(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && Xo.get(i), n = Ni() || t?.kind === "instant";
		if (i && !n && fs(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && Qo(e) ? hs(e, t) : t?.kind === "wipe" && Qo(e) ? xs(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function hs(e, t) {
	for (let t of e.querySelectorAll(`[${ir}], [${ar}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${ir}] [${fr}]`)].filter((e) => !e.parentElement?.closest(`[${fr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${or}]`)].flatMap(ta), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => Yo(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(Jo);
}
var gs = 100, _s = /* @__PURE__ */ new WeakMap();
function vs(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function ys(e, t) {
	vs(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function bs(e) {
	_s.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function xs(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? vs(e, i(t, r)) : a ? vs(e, a(t, r)) : ys(e, i(t, r));
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
			if (e - i > gs && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), _s.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + gs);
		_s.set(e, l), c();
	}).then((t) => {
		if (bs(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? Zo(e, 0, r, t) : Yo(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var Ss = X.createContext({}), Cs = X.createContext(null), ws = () => X.useContext(Ss), Ts = () => X.useContext(Cs), Es = () => ws().reveal;
function Ds({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = Ir({
		theme: r,
		mode: i,
		text: a
	}), [c] = X.useState(() => ({ sent: !1 }));
	return X.useEffect(() => {
		n !== void 0 && Ur(n);
	}, [n]), (0, Z.jsx)(Ss.Provider, {
		value: t,
		children: (0, Z.jsxs)(Cs.Provider, {
			value: c,
			children: [s && (0, Z.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var Os = typeof window > "u" ? X.useEffect : X.useLayoutEffect, ks = () => X.useInsertionEffect(() => (Ar(), jr), []), As = Number("19.3.1".split(".")[0]) >= 19, js = () => {
	let { nonce: e } = ws();
	return As ? (0, Z.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: Er
	}) : null;
}, Ms = As ? { inert: !0 } : { inert: "" }, Ns = (e) => X.Children.map(e, (e) => {
	if (!X.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Z.jsx)("span", {
		[fr]: "",
		children: (0, Z.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? X.cloneElement(e, void 0, Ns(e.props.children)) : e;
}), Ps = () => () => {}, Fs = () => X.useSyncExternalStore(Ps, () => !1, () => !0), Is = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = X.useRef(null), { nonce: o } = ws(), s = Ts(), c = Fs(), l = Mr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), Os(() => {
		if (!a.current) return;
		let e = new yo(a.current, {
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
			[rr]: "",
			"aria-hidden": !0,
			...Ms,
			children: [
				(0, Z.jsx)("div", {
					[ir]: "",
					children: Ns(e)
				}),
				(0, Z.jsx)("div", { [ar]: "" }),
				(0, Z.jsx)("div", { [or]: "" })
			]
		}),
		c && (0, Z.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, Ls = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = X.useRef(null), l = Es();
	return Os(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), os(c.current, l, { initial: !r }).then(s), o && (e.memory = new xo(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), Os(() => {
		!i || !c.current || ms(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Z.jsx)("div", {
		ref: c,
		[nr]: "",
		children: e
	});
}, Rs = class extends X.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = ls(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function zs(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	ks();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = X.useRef(null);
	Os(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Z.jsx)("div", {
			[fr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Z.jsx)(Is, {
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
	}), [b, x] = X.useState([]), te = X.useRef(/* @__PURE__ */ new Map()).current, S = X.useRef(_);
	if (Os(() => {
		S.current = _;
	}), y.key !== g) {
		let e = {
			id: y.id,
			node: S.current
		};
		x((t) => t.some((t) => t.id === e.id) ? t : [...t, e]), ee({
			id: y.id + 1,
			key: g,
			from: y.key
		});
	}
	let C = X.useRef(e.onReveal);
	Os(() => {
		C.current = e.onReveal;
	});
	let w = y.key === "content" && y.from === "skeleton" ? () => C.current?.() : void 0, T = (e) => x((t) => t.filter((t) => t.id !== e)), E = [...b.map((e) => (0, Z.jsx)(Ls, {
		id: e.id,
		registry: te,
		enter: !1,
		exiting: !0,
		onExited: () => T(e.id),
		children: e.node
	}, e.id)), (0, Z.jsx)(Ls, {
		id: y.id,
		registry: te,
		enter: y.id > 0,
		exiting: !1,
		onExited: () => {},
		memory: v,
		onEntered: w,
		children: _
	}, y.id)];
	return (0, Z.jsxs)("div", {
		[tr]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Z.jsx)(js, {}), (0, Z.jsx)(Rs, {
			exiting: b.map((e) => e.id),
			registry: te,
			children: E
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var Bs = {
	creators: [Y("follow:followOverview.creators"), Y("follow:followOverview.creatorUnit")],
	enabled: [Y("follow:followOverview.enabledSources"), ""],
	failed: [Y("follow:followCheck.checkFailed"), Y("follow:followOverview.sourceUnit")],
	updates: [Y("follow:followOverview.unwatchedUpdates"), Y("follow:followOverview.itemUnit")],
	subscriptions: [Y("follow:feedSources.footerLabel"), Y("follow:followOverview.actressUnit")],
	releases: [Y("follow:followOverview.unwatchedReleases"), Y("follow:followOverview.itemUnit")]
}, Vs = {
	duration: 0,
	delay: 0,
	hold: 150
}, Hs;
function Us() {
	return Hs || (Hs = new CSSStyleSheet(), Hs.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), Hs;
}
function Ws({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Z.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Z.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Z.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function Gs({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = Bs[e], o = (0, X.useRef)(null);
	return (0, X.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = Us();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Z.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: Ee({
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
		}) : /* @__PURE__ */ (0, Z.jsx)(Ds, {
			reveal: Vs,
			children: /* @__PURE__ */ (0, Z.jsx)(zs, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: Y("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Z.jsx)(Ws, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var Ks = (e) => k.some(([t]) => t === e);
function qs(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, X.useState)(Ks(e.tab) ? e.tab : "list"), [u, f] = (0, X.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, X.useState)(() => wt(e.sort, e.dir).sort), [h, g] = (0, X.useState)(() => wt(e.sort, e.dir).dir), [_, v] = (0, X.useState)(it(e.layout) ? e.layout : "default"), [y, ee] = (0, X.useState)(ft(e.pageSize)), [b, x] = (0, X.useState)(/* @__PURE__ */ new Set()), [te, S] = (0, X.useState)(/* @__PURE__ */ new Set()), T = Ut({
		queryKey: O,
		queryFn: ({ signal: e }) => Ye(e)
	}), E = Ut({
		queryKey: D,
		queryFn: ({ signal: e }) => qe(e)
	}), A = Ut({
		queryKey: w,
		queryFn: ({ signal: e }) => Je(e)
	}), j = T.data || { sources: [] }, M = E.data || {
		root: "",
		providers: []
	}, N = j.sources;
	(0, X.useEffect)(() => {
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
	}, F = nt(N), I = N.filter(rt).length, L = N.filter((e) => e.enabled).length, R = (M.providers || []).filter((e) => e.requirement === "required" && !ze(e)).length, ne = new Set((A.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Z.jsxs)(Kt, { children: [
		a ? /* @__PURE__ */ (0, Z.jsx)(z, {
			tone: "warning",
			title: Y("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Z.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Z.jsx)(C, {
					href: s,
					children: Y("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: V,
			"aria-label": Y("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "creators",
					figure: T.data ? F.length : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "enabled",
					figure: T.data ? L : void 0,
					total: N.length,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "failed",
					figure: T.data ? I : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "updates",
					figure: T.data ? j.counts?.new || 0 : void 0,
					failed: T.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "subscriptions",
					figure: A.data ? ne : void 0,
					failed: A.isError
				}),
				/* @__PURE__ */ (0, Z.jsx)(Gs, {
					field: "releases",
					figure: A.data ? A.data.unread || 0 : void 0,
					failed: A.isError
				})
			]
		}),
		/* @__PURE__ */ (0, Z.jsxs)("div", {
			className: "flex flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, Z.jsx)("div", {
					"data-section-nav": !0,
					children: /* @__PURE__ */ (0, Z.jsx)(le, {
						group: "follow",
						label: Y("follow:followManagePage.sectionTabs"),
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
							x(/* @__PURE__ */ new Set()), S(/* @__PURE__ */ new Set()), l(e), P({ tab: e });
						}
					})
				}),
				c === "list" ? /* @__PURE__ */ (0, Z.jsxs)("div", {
					role: "tabpanel",
					id: "follow-panel-list",
					"aria-labelledby": "follow-tab-list",
					className: "flex flex-col gap-4",
					children: [/* @__PURE__ */ (0, Z.jsx)(Gn, {
						readOnly: a,
						toast: r,
						onAdd: () => {
							l("add"), P({ tab: "add" });
						},
						selection: {
							ids: te,
							onChange: S,
							onActivate: () => x(/* @__PURE__ */ new Set())
						}
					}), T.data ? /* @__PURE__ */ (0, Z.jsx)(er, {
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
							x(e), S(/* @__PURE__ */ new Set());
						},
						onLayout: (e) => {
							v(e), f(1), n({ layout: e }), P({ page: 1 });
						},
						onPageSize: (e) => {
							ee(e), f(1), n({ pageSize: e }), P({ page: 1 });
						}
					}) : T.isError ? /* @__PURE__ */ (0, Z.jsx)(z, {
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
						E.data && T.data ? /* @__PURE__ */ (0, Z.jsx)(mn, {
							data: j,
							credentials: M,
							readOnly: a,
							toast: r
						}) : E.isError || T.isError ? /* @__PURE__ */ (0, Z.jsx)(z, {
							tone: "error",
							children: Y("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Z.jsx)("div", {
							role: "status",
							"aria-label": Y("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Z.jsx)(yn, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								A.refetch(), l("list"), P({ tab: "list" });
							}
						}),
						T.data ? /* @__PURE__ */ (0, Z.jsx)(Mn, {
							groups: j.author_aliases || [],
							readOnly: a,
							toast: r,
							suggestions: j.alias_suggestions || [],
							sources: j.sources
						}) : null
					]
				}) : null,
				c === "tags" ? /* @__PURE__ */ (0, Z.jsx)("div", {
					role: "tabpanel",
					id: "follow-panel-tags",
					"aria-labelledby": "follow-tab-tags",
					className: "flex flex-col gap-4",
					children: /* @__PURE__ */ (0, Z.jsx)(he, { scope: "online" })
				}) : null
			]
		}),
		/* @__PURE__ */ (0, Z.jsx)("div", { children: /* @__PURE__ */ (0, Z.jsx)(d, {
			variant: "secondary",
			href: "/settings/subscriptions",
			children: R ? Y("follow:followManagePage.feedSettingsPending", { count: R }) : Y("follow:followManagePage.feedSettings")
		}) })
	] });
}
export { qs as FollowManagePage };

//# debugId=3b9e063b-5706-417b-a5cd-55036be89b5a