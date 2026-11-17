(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "61f09cbb-10ee-4c70-92f9-b22a800bcd14", e._sentryDebugIdIdentifier = "sentry-dbid-61f09cbb-10ee-4c70-92f9-b22a800bcd14");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, $76d00c5a4edb230a$export$76ccd210b9029917 as n, $76d00c5a4edb230a$export$816b5d811295e6bc as r, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as i, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as a, $76d00c5a4edb230a$export$f850895b287ef28e as o, $ea3928288112382f$export$439d29a4e110a164 as s, $l as c, ActivityStatus as l, Button as u, ButtonLink as d, Bx as f, COLUMN_SORT as p, Checkbox as m, ChevronSortDown as h, Chip as g, CollapseChevron as _, CollapseRegion as v, ColumnFilterAvatar as y, DataTableFooter as ee, DataTableFrame as b, DataTableSort as x, EmptyFocusButton as S, EmptyState as C, ErrorText as w, ExternalLink as T, FEEDS_KEY as E, FOLLOW_CHECK_KEY as D, FOLLOW_CHECK_TASK as O, FOLLOW_CREDENTIALS_KEY as k, FOLLOW_MANAGE_KEY as A, FOLLOW_MANAGE_NAV as te, FOLLOW_RESOLVE_KEY as j, FieldLabel as M, Help as N, Input as P, LAYOUTS as F, LEGACY_AVATAR_IMG as I, M6 as L, MENU_ITEM as R, MENU_ITEM_INTERACTIVE as ne, MENU_POPOVER_SURFACE as re, ModalFrame as z, Note as B, P7 as V, SORT_DEFAULT_DIR as H, SORT_OPTIONS as ie, STAT_STRIP_SIX as ae, Select as oe, SelectItem as se, SelectionDock as ce, SelectionPopover as U, SiteIcon as W, SiteLabel as le, SortDirectionIcon as ue, SortableBoardTabs as de, Switch as fe, Table as pe, TableColumnControls as me, TableColumnResizer as he, TableSelectionHeader as ge, TaskProgress as _e, Un as G, Wt as ve, Xf as ye, __toESM as be, activityKind as xe, addAlias as Se, addSource as Ce, authorGroups as we, authorName as Te, avatarInner as Ee, busyProps as K, cardClass as De, checkEvidenceGap as Oe, checkFailures as ke, checkFeeds as Ae, checkReceipt as je, checkSummary as Me, checkedText as Ne, clickedBlank as Pe, codedText as Fe, columnVisibilityFeature as Ie, composingKey as Le, confirmModal as Re, createColumnHelper as ze, credentialDone as Be, cx as Ve, dZ as He, dropSources as Ue, du as We, enterPageSelection as Ge, errorHeadline as Ke, errorMessage as q, exitPageSelection as qe, feedIntervalText as Je, fetchCheckJob as Ye, fetchCredentials as Xe, fetchFeeds as J, fetchFollow as Ze, fetchResolveJob as Qe, fetchSuggestions as $e, flexRender as et, followFeedByName as tt, followFeedEntity as nt, followSuggestKey as rt, groupByAuthor as it, isBroken as at, isLayout as ot, jobText as st, joinList as ct, keepSelected as lt, l7 as ut, localTime as dt, lookupFeedActor as ft, mapLimit as pt, markAllPending as mt, pageSizeOf as ht, pageWindow as gt, patchSource as _t, pv as vt, queryClient as yt, quoted as bt, reloadFollowManage as Y, removeAlias as xt, removeFeed as St, removeSource as Ct, renameAliasGroup as wt, require_jsx_runtime as Tt, require_react as Et, resolveFollowSort as Dt, rowPaginationFeature as Ot, rowSelectionFeature as kt, rowSortingFeature as At, runBulkAction as jt, selectionState as Mt, serverLabel as Nt, setFeedEnabled as Pt, setSourceEnabled as Ft, skeletonHtml as It, sortLabel as Lt, startCheck as Rt, startResolve as zt, statusText as Bt, t as X, tableFeatures as Vt, tableRows as Ht, toggleGroup as Ut, unmarkItems as Wt, useAction as Gt, useBackgroundJob as Kt, useMutation as qt, usePageSelection as Jt, useQuery as Yt, useTable as Xt, useTableFilters as Zt, useTablePreferences as Qt } from "./peach-app.js";
import { Page as $t } from "./peach-app.page-QAncjzM1.js";
import { AuthorAvatar as en, ErrorLine as tn, SourceIcon as nn, SourceLink as rn, StatusBadge as an } from "./peach-app.source-view-CDbKpFus.js";
import { createPaginatedRowModel as on, createSortedRowModel as sn, useTableSelection as cn } from "./peach-app.use-table-selection-CnuGRvGn.js";
// src/react/follow-manage/add-source.tsx
var Z = /* @__PURE__ */ be(Et(), 1), Q = Tt(), ln = Ve(R, ne, "text-body-2-medium"), un = X("follow:addCreatorSource.placeholder"), dn = X("follow:addCreatorSource.title"), fn = X("follow:addCreatorSource.searchingByName"), pn = X("follow:addCreatorSource.recognizing"), mn = X("follow:addCreatorSource.noSourceFound"), hn = "/settings/subscriptions", gn = (e, t) => `${e}:${t.url}`;
function _n({ field: e, menu: n, options: r, active: i, busy: a, onPick: o, onClose: s }) {
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
		className: Ve(re, "flex w-(--trigger-width) flex-col gap-1 overscroll-contain"),
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
			className: t === i ? Ve(ln, "bg-background-secondary-default") : ln,
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
function vn({ credentials: e, hidden: t, onHidden: n }) {
	let r = (e.providers || []).filter((e) => e.followable), i = r.filter((e) => !t.has(e.provider_label)).length, a = i === r.length ? X("follow:addCreatorSource.allSources") : X("follow:addCreatorSource.shownSources", {
		shown: i,
		count: r.length
	});
	return /* @__PURE__ */ (0, Q.jsx)(U, {
		label: X("follow:addCreatorSource.sourceFilter"),
		triggerLabel: a,
		leadingIcon: c,
		empty: X("follow:addCreatorSource.noSources"),
		items: r.map((e) => ({
			id: e.provider_label,
			selected: !t.has(e.provider_label),
			label: /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 items-center gap-1.5",
				children: [/* @__PURE__ */ (0, Q.jsx)(nn, { provider: e.provider }), e.provider_label]
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
				href: hn
			}
		]
	});
}
function yn({ row: e, at: t, hidden: n, unpicked: r, onPick: i }) {
	if (e.kind === "error") return /* @__PURE__ */ (0, Q.jsx)(B, {
		tone: "error",
		title: e.line,
		children: st(e, "error") || X("follow:addCreatorSource.searchFailed")
	});
	let a = (e.candidates || []).filter((e) => !n.has(e.provider_label || "")), o = Object.entries(e.failures || {});
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: De({
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
				let n = gn(t, e);
				return /* @__PURE__ */ (0, Q.jsx)(m, {
					isSelected: !e.known && !r.has(n),
					isDisabled: e.known,
					onChange: (e) => i(n, e),
					children: /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex min-w-0 flex-wrap items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(nn, { provider: e.provider }),
							/* @__PURE__ */ (0, Q.jsx)("b", {
								className: "text-body-medium",
								children: e.provider_label
							}),
							/* @__PURE__ */ (0, Q.jsx)("span", {
								className: "min-w-0 break-words",
								children: Fe(e, "label")
							}),
							/* @__PURE__ */ (0, Q.jsx)("small", {
								className: "text-caption-1-regular text-text-secondary",
								children: e.known ? X("follow:addCreatorSource.alreadyFollowing") : Fe(e, "evidence")
							})
						]
					})
				}, n);
			}) : /* @__PURE__ */ (0, Q.jsx)(N, { children: mn }),
			(e.external_searches || []).map((e) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: Fe(e, "evidence")
				}), /* @__PURE__ */ (0, Q.jsx)(T, {
					href: e.url,
					children: X("follow:shared.labeled", {
						label: Fe(e, "label"),
						value: e.query
					})
				})]
			}, e.url)),
			o.length ? /* @__PURE__ */ (0, Q.jsx)(N, { children: ct(o.map(([t, n]) => X("follow:shared.labeled", {
				label: t,
				value: Nt(e.failure_codes?.[t]?.code ?? "", n, e.failure_codes?.[t]?.params)
			}))) }) : null
		]
	});
}
function bn({ data: e, credentials: t, readOnly: n, toast: r }) {
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
	let O = Yt({
		queryKey: rt(d),
		queryFn: ({ signal: e }) => $e(d, e),
		enabled: d.length > 0 && p && !o && h !== i
	}), k = (0, Z.useMemo)(() => (O.data?.groups || []).flatMap((e) => e.items.map((t) => ({
		value: t.value,
		matched: Nt(t.matched_code ?? "", t.matched || ""),
		n: t.n || 0,
		group: Nt(e.label_code ?? "", e.label)
	}))), [O.data]), { job: A, running: te, outcome: N, start: F, dismiss: I } = Kt({
		queryKey: j,
		queryFn: ({ signal: e }) => Qe(e),
		start: (e) => zt([e]),
		onStarted: () => C(/* @__PURE__ */ new Set()),
		onError: (e) => T(q(e)),
		onFinish: (e) => {
			e.status === "failed" && T(st(e, "error") || X("follow:addCreatorSource.searchFailed"));
		}
	}), L = (e) => {
		let t = e.trim();
		!t || n || o || te || F.isPending || (T(""), v(-1), l(t), a(t), f(""), g(t), F.mutate(t));
	}, R = O.isFetching, ne = p && !o && h !== i && (k.length > 0 || R), re = () => {
		v(-1), g(i);
	}, z = (e) => {
		if (!(o || Le(e.nativeEvent))) {
			if (e.key === "Escape" && ne) re();
			else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				if (!k.length) return;
				if (e.preventDefault(), !ne) {
					g(null);
					return;
				}
				let t = e.key === "ArrowDown" ? 1 : -1;
				v((e) => {
					let n = e + t;
					return n < 0 ? k.length - 1 : n >= k.length ? 0 : n;
				});
			} else e.key === "Enter" && (e.preventDefault(), L(k[_]?.value || i));
		}
	}, V = N?.results || [], H = V.flatMap((e, t) => (e.candidates || []).filter((e) => !e.known && !b.has(e.provider_label || "")).map((e) => ({
		candidate: e,
		key: gn(t, e)
	})).filter((e) => !S.has(e.key))), ie = qt({
		mutationFn: async (e) => {
			let t = [], n = [];
			D(0);
			for (let r of e) {
				try {
					let e = await Ce(r.candidate);
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
				await Rt(n);
			} catch (e) {
				t.push(q(e));
			}
			return {
				failures: t,
				sources: n
			};
		},
		onSuccess: (e) => {
			Y(), e.failures.length ? T(ct(e.failures)) : (T(""), I(), r(X("follow:addCreatorSource.sourcesAdded", { count: e.sources.length })));
		},
		onError: (e) => T(q(e))
	}), ae = e.suggestions || [], oe = !c.includes("/");
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": dn,
		className: De({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: dn
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
						children: [/* @__PURE__ */ (0, Q.jsx)(P, {
							"aria-label": X("follow:addCreatorSource.inputLabel"),
							placeholder: un,
							value: i,
							leadingIcon: vt,
							enterKeyHint: "search",
							isDisabled: n,
							onChange: a,
							onCompositionStart: () => {
								s(!0), v(-1);
							},
							onCompositionEnd: (e) => {
								s(!1), a(e.currentTarget.value);
							},
							onKeyDown: z
						}), ne ? /* @__PURE__ */ (0, Q.jsx)(_n, {
							field: y,
							menu: ee,
							options: k,
							active: _,
							busy: R,
							onPick: L,
							onClose: re
						}) : null]
					}),
					/* @__PURE__ */ (0, Q.jsx)(vn, {
						credentials: t,
						hidden: b,
						onHidden: x
					}),
					/* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "primary",
						disabled: n || !i.trim(),
						...K(te || F.isPending),
						onClick: () => L(i),
						children: X("follow:shared.search")
					})
				]
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				"aria-live": "polite",
				className: "flex flex-col gap-3 empty:hidden",
				children: [te || F.isPending ? /* @__PURE__ */ (0, Q.jsx)(_e, {
					embedded: !0,
					kind: xe("follow-resolve"),
					label: st(A) || (A?.total ? X("follow:addCreatorSource.searchProgress", {
						checked: A.checked || 0,
						count: A.total
					}) : oe ? fn : pn),
					value: A?.checked,
					total: A?.total
				}) : null, w ? /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: "error",
					title: X("follow:addJavFeed.notCompleted"),
					children: w
				}) : null]
			}),
			V.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:addCreatorSource.results") }),
					V.map((e, t) => /* @__PURE__ */ (0, Q.jsx)(yn, {
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
								disabled: n || !H.length,
								...K(ie.isPending),
								onClick: () => ie.mutate(H),
								children: X("follow:addCreatorSource.addSelected", { count: H.length })
							}),
							ie.isPending ? /* @__PURE__ */ (0, Q.jsx)("span", {
								role: "status",
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:addCreatorSource.addingProgress", {
									added: E,
									count: H.length
								})
							}) : null
						]
					})
				]
			}) : null,
			ae.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-2-regular text-text-secondary",
					children: X("follow:addCreatorSource.suggested")
				}), ae.map((e) => /* @__PURE__ */ (0, Q.jsx)(u, {
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
var xn = X("follow:addJavFeed.placeholder"), Sn = X("follow:addJavFeed.title");
function Cn(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.candidates) t.has(r.id) && r.held_by && n.set(r.held_by.id, r.held_by.name);
	if (n.size > 1) return {
		text: X("follow:addJavFeed.cardsSplitAcrossPeople", { names: ct([...n.values()]) }),
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
function wn({ card: e, picked: t, onPick: n }) {
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
						children: ct(e.names)
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
		}), /* @__PURE__ */ (0, Q.jsx)(T, {
			href: e.url,
			children: e.id
		})]
	});
}
function Tn({ readOnly: e, toast: t, onAdded: n }) {
	let [r, i] = (0, Z.useState)(""), [a, o] = (0, Z.useState)(null), [s, c] = (0, Z.useState)(/* @__PURE__ */ new Set()), l = Gt(), d = () => {
		let t = r.trim();
		t && !e && l.run("lookup", (e) => ft(t, e), (e) => {
			o(e), c(new Set(e.suggested));
		});
	}, f = (e) => {
		e.key === "Enter" && !Le(e.nativeEvent) && (e.preventDefault(), d());
	}, p = () => {
		o(null), c(/* @__PURE__ */ new Set()), l.setError("");
	}, m = () => {
		a && l.run("follow", (e) => tt(a.q, [...s], e), (e) => {
			t(e.created ? X("follow:addJavFeed.createdAndSubscribed", { name: e.entity_name }) : X("follow:addJavFeed.subscribed", { name: e.entity_name })), i(""), p(), n();
		});
	}, h = () => {
		let e = a?.known;
		e && l.run("known", (t) => nt(e.id, t), () => {
			t(X("follow:addJavFeed.subscribed", { name: e.name })), i(""), p(), n();
		});
	}, g = a ? Cn(a, s) : null, _ = a && !a.candidates.length && a.known?.subscribable ? a.known : null;
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": Sn,
		className: De({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "text-title-2-medium text-text-primary",
				children: Sn
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("div", {
					className: "min-w-64 grow",
					children: /* @__PURE__ */ (0, Q.jsx)(P, {
						"aria-label": X("follow:addJavFeed.actressName"),
						placeholder: xn,
						value: r,
						leadingIcon: vt,
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
			l.error ? /* @__PURE__ */ (0, Q.jsx)(B, {
				tone: "error",
				title: X("follow:addJavFeed.notCompleted"),
				children: l.error
			}) : null,
			a ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [
					a.unavailable ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "warning",
						title: X("follow:addJavFeed.javdbSearchFailed"),
						children: Nt(a.unavailable_code ?? "", a.unavailable, a.unavailable_params)
					}) : null,
					/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:addJavFeed.javdbCards") }),
					a.candidates.length ? a.candidates.map((e) => /* @__PURE__ */ (0, Q.jsx)(wn, {
						card: e,
						picked: s.has(e.id),
						onPick: (t) => c((n) => {
							let r = new Set(n);
							return t ? r.add(e.id) : r.delete(e.id), r;
						})
					}, e.id)) : /* @__PURE__ */ (0, Q.jsx)(N, { children: a.unavailable ? X("follow:addJavFeed.noCardsThisTime") : X("follow:addJavFeed.noJavdbMatch") }),
					a.candidates.length ? /* @__PURE__ */ (0, Q.jsx)(N, {
						role: "status",
						children: s.size ? g.text : X("follow:addJavFeed.pickCardsHint")
					}) : null,
					_ ? /* @__PURE__ */ (0, Q.jsx)(N, {
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
function En({ group: e, close: t, receipt: n }) {
	return /* @__PURE__ */ (0, Q.jsx)(z, {
		isOpen: !!e,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: X("follow:creatorAliases.rename"),
		children: e ? /* @__PURE__ */ (0, Q.jsx)(Dn, {
			group: e,
			close: t,
			receipt: n
		}, e.canonical_key) : null
	});
}
function Dn({ group: t, close: n, receipt: r }) {
	let [i, a] = (0, Z.useState)(t.canonical_name), o = Gt();
	return /* @__PURE__ */ (0, Q.jsxs)("form", {
		onSubmit: (e) => {
			e.preventDefault(), i.trim() && i.trim() !== t.canonical_name && o.run("rename", (e) => wt(t.canonical_key, i.trim(), e), () => {
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
			/* @__PURE__ */ (0, Q.jsx)(P, {
				"aria-label": X("follow:creatorAliases.displayName"),
				autoFocus: !0,
				value: i,
				onChange: a
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:creatorAliases.chooseExisting") }), /* @__PURE__ */ (0, Q.jsx)("div", {
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
			o.error ? /* @__PURE__ */ (0, Q.jsx)(B, {
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
var On = (e) => X("follow:creatorAliases.removeBody", { alias: e }), kn = Vt({
	rowSelectionFeature: kt,
	rowSortingFeature: At,
	rowPaginationFeature: Ot,
	columnVisibilityFeature: Ie,
	sortedRowModel: sn(),
	paginatedRowModel: on()
}), An = kn, jn = {
	id: "select",
	label: X("follow:shared.select"),
	width: 48,
	min: 48,
	max: 48,
	required: !0
}, Mn = {
	id: "canonical",
	label: X("follow:creatorAliases.displayName"),
	width: 280,
	min: 240,
	required: !0,
	flex: !0
}, Nn = [
	jn,
	Mn,
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
], Pn = [
	jn,
	Mn,
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
], Fn = (e) => e.alias;
function In(e, t, n) {
	let r = n ? `name:${n}` : "", i = r && e.find((e) => e.author_key === r) || e.find((e) => e.author_name === t || e.entity_name === t);
	return i ? e.filter((e) => e.author_key === i.author_key) : [];
}
function Ln({ sources: e, name: t, canonicalKey: n }) {
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex items-center gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)(en, {
			group: In(e, t, n),
			name: t
		}), /* @__PURE__ */ (0, Q.jsx)("b", {
			className: "text-body-medium",
			children: t
		})]
	});
}
function Rn({ groups: e, suggestions: t, sources: s = [], readOnly: c, toast: l }) {
	let d = Qt("alias-suggestions", Nn), f = Qt("alias-saved", Pn), [p, g] = (0, Z.useState)(null), [_, v] = (0, Z.useState)({}), [y, T] = (0, Z.useState)({});
	Jt(() => {
		v({}), T({});
	}), (0, Z.useEffect)(() => {
		(Object.values(_).some(Boolean) || Object.values(y).some(Boolean)) && Ge();
	}, [_, y]);
	let E = cn(() => v({})), D = cn(() => T({})), [O, k] = (0, Z.useState)([]), [A, te] = (0, Z.useState)([]), [j, N] = (0, Z.useState)({
		pageIndex: 0,
		pageSize: 20
	}), [F, I] = (0, Z.useState)({
		pageIndex: 0,
		pageSize: 20
	}), L = Zt(t, {
		canonical: {
			values: (e) => e.canonical,
			option: (e) => ({ leading: () => /* @__PURE__ */ (0, Q.jsx)(en, {
				group: In(s, e),
				name: e,
				small: !0
			}) })
		},
		alias: {
			values: (e) => e.alias,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Q.jsx)(en, {
				group: In(s, t?.canonical ?? e),
				name: e,
				small: !0
			}) })
		},
		evidence: { values: (e) => Nt(e.evidence_code ?? "", e.evidence, e.evidence_params) }
	}, () => N((e) => ({
		...e,
		pageIndex: 0
	}))), R = Zt(e, {
		canonical: {
			values: (e) => e.canonical_name,
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Q.jsx)(en, {
				group: In(s, e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		},
		aliases: {
			values: (e) => e.aliases.map((e) => e.name),
			option: (e, t) => ({ leading: () => /* @__PURE__ */ (0, Q.jsx)(en, {
				group: In(s, t?.canonical_name ?? e, t?.canonical_key),
				name: e,
				small: !0
			}) })
		}
	}, () => I((e) => ({
		...e,
		pageIndex: 0
	}))), ne = {
		...j,
		pageIndex: Math.min(j.pageIndex, Math.max(0, Math.ceil(L.items.length / j.pageSize) - 1))
	}, re = {
		...F,
		pageIndex: Math.min(F.pageIndex, Math.max(0, Math.ceil(R.items.length / F.pageSize) - 1))
	}, [z, B] = (0, Z.useState)(""), [H, ie] = (0, Z.useState)(""), [ae, oe] = (0, Z.useState)(""), se = qt({
		mutationFn: async (e) => {
			let t = 0;
			for (let n of e) {
				try {
					await Se(n.canonical, n.alias);
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
			B(""), v({}), Y();
		},
		onError: (e) => B(q(e))
	}), U = qt({
		mutationFn: (e) => Se(e.canonical, e.alias),
		onSuccess: () => {
			B(""), ie(""), oe(""), Y(), l(X("follow:creatorAliases.saved"));
		},
		onError: (e) => B(q(e))
	}), W = qt({
		mutationFn: async (e) => {
			let t = typeof e == "string" ? [e] : e, n = 0;
			try {
				for (let e of t) await xt(e), n += 1;
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
			B(""), T({}), typeof t == "string" && l(X("follow:creatorAliases.removed"));
		},
		onError: (e) => B(q(e))
	}), le = {
		receipt: l,
		failure: (e) => B(q(e))
	}, ue = (e, t) => ({
		key: e ? "merge-all" : "merge",
		reversal: "undo",
		label: X(e ? "follow:creatorAliases.mergeAllCount" : "follow:creatorAliases.mergeSelectedCount", { count: t }),
		confirm: (t) => ({
			title: X(e ? "follow:creatorAliases.mergeAllTitle" : "follow:creatorAliases.mergeSelectedTitle"),
			body: X("follow:creatorAliases.mergeBody", {
				count: t.length,
				pairs: ct(t.map((e) => X("follow:creatorAliases.mergePair", {
					alias: bt(e.alias),
					canonical: bt(e.canonical)
				})))
			}),
			confirmLabel: X(e ? "follow:creatorAliases.mergeAllConfirm" : "follow:creatorAliases.mergeSelectedConfirm")
		}),
		run: async (e) => {
			let { done: t } = await se.mutateAsync([...e]);
			return async () => {
				for (let n of e.slice(0, t)) await xt(n.alias);
				await Y();
			};
		},
		receipt: (e) => X("follow:creatorAliases.merged", { count: e.length })
	}), de = (e, t) => {
		e.length && jt(ue(t, e.length), e, le).catch(le.failure);
	}, fe = {
		key: "remove",
		reversal: "undo",
		label: X("follow:creatorAliases.removeSelectedCount", { count: 0 }),
		confirm: (e) => ({
			title: X("follow:creatorAliases.removeSelectedTitle"),
			body: X("follow:creatorAliases.removeSelectedBody", { count: e.length }),
			items: e.map((e) => e.name),
			confirmLabel: X("follow:creatorAliases.removeSelectedConfirm")
		}),
		run: async (e) => (await W.mutateAsync(e.map((e) => e.name)), async () => {
			for (let t of e) await Se(t.canonical, t.name);
			await Y();
		}),
		receipt: () => X("follow:creatorAliases.removed")
	}, _e = (e) => void Re({
		title: X("follow:creatorAliases.removeTitle"),
		body: On(e),
		confirmLabel: X("follow:creatorAliases.removeTitle"),
		onConfirm: () => W.mutateAsync(e)
	}), G = (0, Z.useRef)({
		sources: s,
		readOnly: c,
		merging: se.isPending,
		removing: W.isPending,
		merge: de,
		remove: _e,
		rename: g
	});
	G.current = {
		sources: s,
		readOnly: c,
		merging: se.isPending,
		removing: W.isPending,
		merge: de,
		remove: _e,
		rename: g
	};
	let ve = (0, Z.useMemo)(() => {
		let e = ze();
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(ge, {
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
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Ln, {
					sources: G.current.sources,
					name: e.getValue()
				})
			}),
			e.accessor("alias", {
				header: X("follow:creatorAliases.platformAlias"),
				cell: (e) => e.getValue()
			}),
			e.accessor((e) => Nt(e.evidence_code ?? "", e.evidence, e.evidence_params), {
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
					disabled: G.current.readOnly,
					...K(G.current.merging),
					onClick: () => G.current.merge([e.row.original], !1),
					children: X("follow:shared.merge")
				})
			})
		]);
	}, []), be = (0, Z.useMemo)(() => {
		let e = ze();
		return e.columns([
			e.display({
				id: "select",
				header: ({ table: e }) => /* @__PURE__ */ (0, Q.jsx)(ge, {
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
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Ln, {
					sources: G.current.sources,
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
							leadingIcon: V,
							"aria-label": X("follow:creatorAliases.removeAliasNamed", { name: e.name }),
							disabled: G.current.readOnly,
							...K(G.current.removing),
							onClick: () => G.current.remove(e.name)
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
					disabled: G.current.readOnly,
					"aria-label": X("follow:creatorAliases.renameRowLabel", { name: e.original.canonical_name }),
					onClick: () => G.current.rename(e.original),
					children: X("follow:creatorAliases.rename")
				})
			})
		]);
	}, []), xe = Xt({
		features: kn,
		data: L.items,
		columns: ve,
		getRowId: Fn,
		state: {
			rowSelection: _,
			sorting: O,
			pagination: ne,
			columnVisibility: d.visibility
		},
		onColumnVisibilityChange: d.change,
		onRowSelectionChange: (e) => {
			E(), v(e);
		},
		onSortingChange: (e) => {
			k(e), N((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: N,
		enableRowSelection: !0
	}), Ce = Xt({
		features: An,
		data: R.items,
		columns: be,
		getRowId: (e) => e.canonical_key,
		state: {
			rowSelection: y,
			sorting: A,
			pagination: re,
			columnVisibility: f.visibility
		},
		onColumnVisibilityChange: f.change,
		onRowSelectionChange: (e) => {
			D(), T(e);
		},
		enableRowSelection: !0,
		onSortingChange: (e) => {
			te(e), I((e) => ({
				...e,
				pageIndex: 0
			}));
		},
		onPaginationChange: I
	}), we = t.filter((e) => _[Fn(e)]), Te = e.filter((e) => y[e.canonical_key]).flatMap((e) => e.aliases.map((t) => ({
		name: t.name,
		canonical: e.canonical_name
	}))), Ee = K(se.isPending);
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: De({
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
				children: [/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:creatorAliases.addManually") }), /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-wrap items-end gap-2",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(P, {
							"aria-label": X("follow:creatorAliases.displayName"),
							placeholder: X("follow:creatorAliases.displayNamePlaceholder"),
							value: H,
							onChange: ie,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Q.jsx)(P, {
							"aria-label": X("follow:creatorAliases.platformAlias"),
							placeholder: X("follow:creatorAliases.platformAlias"),
							value: ae,
							onChange: oe,
							isDisabled: c,
							className: "w-56"
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "primary",
							disabled: c || !H.trim() || !ae.trim(),
							...K(U.isPending),
							onClick: () => U.mutate({
								canonical: H.trim(),
								alias: ae.trim()
							}),
							children: X("follow:creatorAliases.saveAlias")
						})
					]
				})]
			}),
			z ? /* @__PURE__ */ (0, Q.jsx)(w, { children: z }) : null,
			t.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-responsive-toolbar": "",
						children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-heading": "",
							children: [/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:creatorAliases.pending") }), /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:creatorAliases.groupCount", { count: L.items.length })
							})]
						}), /* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [
								/* @__PURE__ */ (0, Q.jsx)(u, {
									variant: "primary",
									size: "small",
									disabled: c,
									...Ee,
									onClick: () => de(L.items, !0),
									children: X("follow:creatorAliases.mergeAllCount", { count: L.items.length })
								}),
								/* @__PURE__ */ (0, Q.jsx)(x, {
									label: X("follow:creatorAliases.pendingTable"),
									sorting: O,
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
										k(e), N((e) => ({
											...e,
											pageIndex: 0
										}));
									}
								}),
								/* @__PURE__ */ (0, Q.jsx)(me, {
									preferences: d,
									label: X("follow:creatorAliases.pendingTable")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, Q.jsx)(ce, {
						label: X("follow:creatorAliases.pendingBulkActions"),
						visible: we.length > 0,
						count: X("follow:creatorAliases.groupsSelected", { count: we.length }),
						actions: [{
							action: ue(!1, we.length),
							items: we,
							host: le,
							disabled: c || se.isPending
						}],
						children: /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: qe,
							children: X("follow:shared.clearSelection")
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(b, {
						follow: !0,
						preferences: d,
						onRowClick: (e) => xe.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Q.jsxs)(pe, {
							"aria-label": X("follow:creatorAliases.pendingTable"),
							size: "sm",
							sortDescriptor: O[0] ? {
								column: O[0].id,
								direction: O[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => xe.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [xe.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...d.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [L.header(e.id, String(e.column.columnDef.header)) ?? et(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(he, {
									preferences: d,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Q.jsx)(r, {
								id: "remaining-space",
								"aria-label": X("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: d.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Q.jsx)(n, {
								renderEmptyState: () => X("shell:dataTable.empty"),
								children: xe.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
									id: e.id,
									"data-board-selected": e.getIsSelected() || void 0,
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: et(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(ee, {
						label: X("follow:creatorAliases.pendingTable"),
						unit: X("follow:creatorAliases.groupUnit"),
						total: L.items.length,
						pagination: ne,
						onChange: N
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
							children: [/* @__PURE__ */ (0, Q.jsx)(M, { children: X("follow:creatorAliases.savedAliases") }), /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "text-body-2-regular text-text-secondary",
								children: X("follow:creatorAliases.groupCount", { count: R.items.length })
							})]
						}), /* @__PURE__ */ (0, Q.jsxs)("div", {
							"data-toolbar-actions": "",
							children: [/* @__PURE__ */ (0, Q.jsx)(x, {
								label: X("follow:creatorAliases.saved"),
								sorting: A,
								options: [{
									id: "canonical",
									label: X("follow:creatorAliases.displayName")
								}, {
									id: "aliases",
									label: X("follow:creatorAliases.platformAlias")
								}],
								onChange: (e) => {
									te(e), I((e) => ({
										...e,
										pageIndex: 0
									}));
								}
							}), /* @__PURE__ */ (0, Q.jsx)(me, {
								preferences: f,
								label: X("follow:creatorAliases.saved")
							})]
						})]
					}),
					/* @__PURE__ */ (0, Q.jsx)(ce, {
						label: X("follow:creatorAliases.savedBulkActions"),
						visible: Te.length > 0,
						count: X("follow:creatorAliases.aliasesSelected", { count: Te.length }),
						actions: [{
							action: {
								...fe,
								label: X("follow:creatorAliases.removeSelectedCount", { count: Te.length })
							},
							items: Te,
							host: le,
							disabled: c || W.isPending
						}],
						children: /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "ghost",
							size: "small",
							onClick: qe,
							children: X("follow:shared.clearSelection")
						})
					}),
					e.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(b, {
						follow: !0,
						preferences: f,
						onRowClick: (e) => Ce.getRow(e)?.toggleSelected(),
						children: /* @__PURE__ */ (0, Q.jsxs)(pe, {
							"aria-label": X("follow:creatorAliases.saved"),
							size: "sm",
							sortDescriptor: A[0] ? {
								column: A[0].id,
								direction: A[0].desc ? "descending" : "ascending"
							} : void 0,
							onSortChange: (e) => Ce.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
							children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [Ce.getHeaderGroups()[0].headers.map((e) => /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "canonical",
								allowsSorting: e.column.getCanSort(),
								...f.columnProps(e.id),
								children: ({ sortDirection: t }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [R.header(e.id, String(e.column.columnDef.header)) ?? et(e.column.columnDef.header, e.getContext()), e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": t || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(he, {
									preferences: f,
									id: e.id
								})] })
							}, e.id)), /* @__PURE__ */ (0, Q.jsx)(r, {
								id: "remaining-space",
								"aria-label": X("follow:shared.rowSpacer"),
								"data-table-space": "",
								width: f.spaceWidth,
								minWidth: 0
							})] }), /* @__PURE__ */ (0, Q.jsx)(n, {
								renderEmptyState: () => X("shell:dataTable.empty"),
								children: Ce.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
									id: e.id,
									"data-board-selected": e.getIsSelected() || void 0,
									children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: et(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
								}, e.id))
							})]
						})
					}), /* @__PURE__ */ (0, Q.jsx)(ee, {
						label: X("follow:creatorAliases.saved"),
						unit: X("follow:creatorAliases.groupUnit"),
						total: R.items.length,
						pagination: re,
						onChange: I
					})] }) : /* @__PURE__ */ (0, Q.jsx)(C, {
						size: "compact",
						icon: ye,
						title: X("follow:creatorAliases.emptyTitle"),
						actions: c ? void 0 : /* @__PURE__ */ (0, Q.jsx)(S, {
							target: `input[aria-label="${X("follow:creatorAliases.displayName")}"]`,
							children: X("follow:creatorAliases.addAlias")
						}),
						children: X("follow:creatorAliases.emptyBody")
					})
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)(En, {
				group: p,
				close: () => g(null),
				receipt: l
			})
		]
	});
}
// src/react/follow-manage/feed-sources.tsx
var zn = Vt({
	rowPaginationFeature: Ot,
	rowSelectionFeature: kt,
	rowSortingFeature: At,
	columnVisibilityFeature: Ie,
	sortedRowModel: sn(),
	paginatedRowModel: on()
}), Bn = {
	select: X("follow:shared.select"),
	name: X("follow:shared.name"),
	kind: X("follow:shared.type"),
	origin: X("follow:followFeed.filterKindSource"),
	status: X("follow:shared.status"),
	interval: X("follow:feedSources.colInterval"),
	fetched: X("follow:feedSources.colLastFetched"),
	fresh: X("follow:feedSources.colLastAdded"),
	actions: X("follow:shared.actions")
}, Vn = Object.entries(Bn).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "name" ? 300 : e === "actions" ? 208 : e === "fetched" ? 200 : e === "origin" ? 184 : 160,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "name" ? 300 : 112,
	max: e === "select" ? 48 : e === "name" ? 2e3 : 800,
	flex: e === "name",
	required: e === "select" || e === "name"
})), Hn = () => yt.invalidateQueries({
	queryKey: E,
	exact: !0
}), Un = (e) => e.name || e.url, Wn = (e) => e.kind.startsWith("javdb") ? "javdb" : e.kind.startsWith("dmm") ? "dmm" : Gn(e.url);
function Gn(e) {
	try {
		return new URL(e).hostname.replace(/^www\./, "");
	} catch {
		return e;
	}
}
function Kn({ source: e }) {
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
function qn({ source: e }) {
	let t = e.entity_id ? {
		id: e.entity_id,
		has_image: !!e.has_image,
		image_version: e.image_version,
		avatar_focus: e.avatar_focus
	} : null;
	return /* @__PURE__ */ (0, Q.jsx)("span", {
		"aria-hidden": !0,
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary ${I}`,
		dangerouslySetInnerHTML: { __html: Ee(Un(e), t, null, "performer") }
	});
}
var Jn = (e, t) => e.entity_id !== null && t.has(e.entity_id) && e.page_name && e.page_name !== e.name ? e.page_name : "";
function Yn(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	for (let { entity_id: r } of e) r !== null && (t.has(r) ? n.add(r) : t.add(r));
	return n;
}
function Xn(e, t) {
	let n = e.length === 1 ? e[0] : null;
	return Re({
		title: n ? X("follow:feedSources.removeOne") : X("follow:feedSources.removeMany", { count: e.length }),
		body: n ? X("follow:feedSources.removeOneBody", { name: Un(n) }) : X("follow:feedSources.removeManyBody"),
		confirmLabel: X(n ? "follow:feedSources.removeOne" : "follow:feedSources.removeSelected"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: t
	});
}
function Zn({ readOnly: e, toast: t, onAdd: s, selection: c }) {
	let l = Yt({
		queryKey: E,
		queryFn: ({ signal: e }) => J(e)
	}), d = Gt(), p = Qt("jav-feeds", Vn), g = l.data, _ = (0, Z.useMemo)(() => g?.sources ?? [], [g]), [v, S] = (0, Z.useState)(/* @__PURE__ */ new Set()), T = c?.ids ?? v, D = c?.onChange ?? S, [O, k] = (0, Z.useState)(1), [A, te] = (0, Z.useState)(20), [j, M] = (0, Z.useState)([]), N = Zt(_, {
		name: {
			values: Un,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Q.jsx)(y, { person: {
				...t,
				id: t.entity_id,
				name: e
			} }) })
		},
		kind: {
			values: (e) => Fe(e, "kind_label"),
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Q.jsx)(W, { site: Wn(t) }) })
		},
		origin: {
			values: (e) => Gn(e.url),
			option: (e, t) => ({ leading: /* @__PURE__ */ (0, Q.jsx)(W, { site: t ? Wn(t) : e }) })
		},
		status: { values: (e) => e.enabled ? e.last_error ? X("follow:feedSources.fetchFailed") : e.last_fetched_at ? X("follow:shared.ok") : X("follow:feedSources.notChecked") : X("follow:shared.paused") },
		interval: { values: (e) => Je(e.interval_minutes) }
	}, () => k(1)), P = gt(N.items.length, A, O);
	(0, Z.useEffect)(() => {
		k((e) => Math.min(e, P.pages));
	}, [P.pages]), (0, Z.useEffect)(() => {
		D((e) => {
			let t = new Set(_.map((e) => e.id)), n = new Set([...e].filter((e) => t.has(e)));
			return n.size === e.size ? e : n;
		});
	}, [_, D]);
	let F = qt({
		mutationFn: async (e) => {
			let t = await pt(e.ids, 4, async (t) => {
				e.action === "remove" ? await St(t) : await Pt(t, e.action === "enabled");
			});
			return {
				...e,
				results: t
			};
		},
		onSuccess: (e) => {
			let t = e.results.filter((e) => !e.ok);
			if (D(/* @__PURE__ */ new Set()), Hn(), t.length) {
				let e = t[0];
				d.setError(X("follow:feedSources.writeFailed", {
					count: t.length,
					error: e.ok ? "" : q(e.error)
				}));
			}
		},
		onError: (e) => d.setError(q(e))
	}), I = {
		receipt: t,
		failure: (e) => d.setError(q(e))
	}, R = (e) => ({
		key: e ? "enable" : "pause",
		label: X(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: X(e ? "follow:feedSources.enableMany" : "follow:feedSources.pauseMany"),
			body: X(e ? "follow:feedSources.enableManyBody" : "follow:feedSources.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => t.enabled !== e), { results: r } = await F.mutateAsync({
				ids: n.map((e) => e.id),
				action: e ? "enabled" : "paused"
			}), i = n.filter((e, t) => r[t]?.ok);
			return async () => {
				await pt(i.map((e) => e.id), 4, (t) => Pt(t, !e)), await Hn();
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
			await F.mutateAsync({
				ids: e.map((e) => e.id),
				action: "remove"
			});
		},
		receipt: (e) => X("follow:feedSources.removedMany", { count: e.length })
	}, re = (0, Z.useMemo)(() => Yn(_), [_]), z = (0, Z.useRef)({
		readOnly: e,
		shared: re,
		busy: null,
		toggle: () => {},
		fetch: () => {},
		remove: () => {}
	});
	z.current = {
		readOnly: e,
		shared: re,
		busy: d.busy,
		toggle: (e, t) => void d.run(`enabled-${e.id}`, (n) => Pt(e.id, t, n), () => void Hn()),
		fetch: (e) => void d.run(`check-${e.id}`, (t) => Ae(t, [e.id]), () => void Hn()),
		remove: (e) => void Xn([e], async () => {
			await St(e.id), t(X("follow:feedSources.removedOne", { name: Un(e) })), Hn();
		})
	};
	let V = (0, Z.useMemo)(() => {
		let e = ze(), t = (e) => () => Bn[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(ge, {
					table: e.table,
					label: X("follow:feedSources.selectPage"),
					page: !0
				}),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(m, {
					slot: null,
					isSelected: e.row.getIsSelected(),
					onChange: (t) => e.row.toggleSelected(t),
					"aria-label": X("follow:shared.selectNamed", { name: Un(e.row.original) })
				})
			}),
			e.accessor(Un, {
				id: "name",
				header: t("name"),
				cell: (e) => {
					let t = Jn(e.row.original, z.current.shared);
					return /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex items-center gap-2 whitespace-nowrap text-body-medium text-text-primary",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(qn, { source: e.row.original }),
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
			e.accessor((e) => Fe(e, "kind_label"), {
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
					children: [/* @__PURE__ */ (0, Q.jsx)(le, {
						site: Wn(e.row.original),
						label: Gn(e.getValue())
					}), /* @__PURE__ */ (0, Q.jsx)(ve, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					})]
				})
			}),
			e.accessor((e) => e.last_error ? X("follow:feedSources.fetchFailed") : e.enabled ? X("follow:shared.enabled") : X("follow:shared.paused"), {
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(Kn, { source: e.row.original })
			}),
			e.accessor((e) => e.interval_minutes, {
				id: "interval",
				header: t("interval"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap",
					children: Je(e.getValue())
				})
			}),
			e.accessor((e) => e.last_fetched_at && Date.parse(e.last_fetched_at) || 0, {
				id: "fetched",
				header: t("fetched"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: e.row.original.last_fetched_at ? dt(e.row.original.last_fetched_at) : X("follow:feedSources.neverFetched")
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
						/* @__PURE__ */ (0, Q.jsx)(fe, {
							"aria-label": X("follow:shared.enableNamed", { name: Un(e.row.original) }),
							isSelected: e.row.original.enabled,
							isDisabled: z.current.readOnly,
							onChange: (t) => z.current.toggle(e.row.original, t)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: He,
							"aria-label": X("follow:feedSources.fetchNamed", { name: Un(e.row.original) }),
							disabled: z.current.readOnly,
							...K(z.current.busy === `check-${e.row.original.id}`),
							onClick: () => z.current.fetch(e.row.original)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: L,
							"aria-label": X("follow:shared.removeNamed", { name: Un(e.row.original) }),
							disabled: z.current.readOnly,
							onClick: () => z.current.remove(e.row.original)
						})
					]
				})
			})
		]);
	}, []), H = (0, Z.useMemo)(() => Object.fromEntries([...T].map((e) => [String(e), !0])), [T]), ie = Xt({
		features: zn,
		data: N.items,
		columns: V,
		getRowId: (e) => String(e.id),
		state: {
			rowSelection: H,
			sorting: j,
			pagination: {
				pageIndex: P.page - 1,
				pageSize: A
			},
			columnVisibility: p.visibility
		},
		onColumnVisibilityChange: p.change,
		onSortingChange: (e) => {
			M(e), k(1);
		},
		enableRowSelection: !0,
		onRowSelectionChange: (e) => {
			c?.onActivate();
			let t = typeof e == "function" ? e(H) : e;
			D(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		}
	});
	if (!g) return l.error ? /* @__PURE__ */ (0, Q.jsx)(B, {
		tone: "error",
		title: X("follow:feedSources.loadFailed"),
		children: q(l.error)
	}) : /* @__PURE__ */ (0, Q.jsx)("div", { dangerouslySetInnerHTML: { __html: It(X("follow:feedSources.loading"), { fill: !1 }) } });
	let ae = () => void d.run("check", (e) => Ae(e), () => void Hn()), oe = (e) => {
		c?.onActivate(), D((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, se = _.filter((e) => T.has(e.id)), U = _.filter((e) => e.last_error);
	return /* @__PURE__ */ (0, Q.jsx)("div", {
		className: "flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Q.jsxs)("section", {
			"aria-label": X("follow:feedSources.listLabel"),
			className: De({
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
								count: _.length,
								unread: Number(g.unread) || 0
							})
						})]
					}), /* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-toolbar-actions": "",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(u, {
								onClick: ae,
								disabled: e,
								...K(d.busy === "check"),
								children: X("follow:feedSources.fetchNow")
							}),
							/* @__PURE__ */ (0, Q.jsx)(me, {
								preferences: p,
								label: X("follow:feedSources.title")
							}),
							/* @__PURE__ */ (0, Q.jsx)(x, {
								label: X("follow:feedSources.title"),
								sorting: j,
								onChange: (e) => {
									M(e), k(1);
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
									label: Bn[e]
								}))
							})
						]
					})]
				}),
				U.length || d.error ? /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [U.length ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "error",
						title: X("follow:feedSources.failedTitle", { count: U.length }),
						extra: /* @__PURE__ */ (0, Q.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: U.map((e) => /* @__PURE__ */ (0, Q.jsx)("li", {
								className: "min-w-0 truncate",
								title: Fe(e, "last_error"),
								children: X("follow:shared.labeled", {
									label: Un(e),
									value: Ke(Fe(e, "last_error")) || X("follow:shared.noReason")
								})
							}, e.id))
						}),
						children: X("follow:feedSources.failedBody")
					}) : null, d.error ? /* @__PURE__ */ (0, Q.jsx)(w, { children: d.error }) : null]
				}) : null,
				/* @__PURE__ */ (0, Q.jsx)(ce, {
					visible: se.length > 0,
					label: X("follow:feedSources.bulkActions"),
					count: X("follow:feedSources.selectedCount", { count: se.length }),
					actions: [
						R(!0),
						R(!1),
						ne
					].map((t) => ({
						action: t,
						items: se,
						host: I,
						disabled: e || F.isPending
					})),
					children: /* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "ghost",
						size: "small",
						onClick: qe,
						children: X("follow:shared.clearSelection")
					})
				}),
				_.length ? /* @__PURE__ */ (0, Q.jsx)(b, {
					follow: !0,
					preferences: p,
					onRowClick: (e) => oe(Number(e)),
					children: /* @__PURE__ */ (0, Q.jsxs)(pe, {
						"aria-label": X("follow:feedSources.title"),
						size: "sm",
						sortDescriptor: j[0] ? {
							column: j[0].id,
							direction: j[0].desc ? "descending" : "ascending"
						} : void 0,
						onSortChange: (e) => ie.getColumn(String(e.column))?.toggleSorting(e.direction === "descending"),
						children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [ie.getHeaderGroups()[0].headers.map((e) => {
							let t = et(e.column.columnDef.header, e.getContext());
							return /* @__PURE__ */ (0, Q.jsx)(r, {
								id: e.id,
								isRowHeader: e.column.id === "name",
								allowsSorting: e.column.getCanSort(),
								...p.columnProps(e.id),
								children: ({ sortDirection: n }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex items-center gap-0.5",
									children: [N.header(e.id, Bn[e.id] || e.id) ?? t, e.column.getCanSort() ? /* @__PURE__ */ (0, Q.jsx)("span", {
										"data-sort-indicator": !0,
										"data-direction": n || void 0,
										children: /* @__PURE__ */ (0, Q.jsx)(h, {})
									}) : null]
								}), /* @__PURE__ */ (0, Q.jsx)(he, {
									preferences: p,
									id: e.id
								})] })
							}, e.id);
						}), /* @__PURE__ */ (0, Q.jsx)(r, {
							id: "remaining-space",
							"aria-label": X("follow:shared.rowSpacer"),
							"data-table-space": "",
							width: p.spaceWidth,
							minWidth: 0
						})] }), /* @__PURE__ */ (0, Q.jsx)(n, {
							renderEmptyState: () => X("shell:dataTable.empty"),
							children: ie.getRowModel().rows.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
								id: e.id,
								"data-follow-selected": e.getIsSelected() || void 0,
								children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: et(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
							}, e.id))
						})]
					})
				}) : /* @__PURE__ */ (0, Q.jsx)(C, {
					icon: f,
					title: X("follow:feedSources.empty"),
					size: "compact",
					actions: e ? void 0 : /* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						onClick: s,
						children: X("follow:feedSources.add")
					}),
					children: X("follow:feedSources.emptyHint")
				}),
				_.length ? /* @__PURE__ */ (0, Q.jsx)(ee, {
					label: X("follow:feedSources.footerLabel"),
					total: P.total,
					unit: X("follow:feedSources.unit"),
					pagination: {
						pageIndex: P.page - 1,
						pageSize: A
					},
					onChange: (e) => {
						te(e.pageSize), k(e.pageIndex + 1);
					}
				}) : null,
				/* @__PURE__ */ (0, Q.jsx)("footer", {
					className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
					children: /* @__PURE__ */ (0, Q.jsx)("span", {
						role: "status",
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: X("follow:feedSources.footerSummary", {
							unread: Number(g.unread) || 0,
							enabled: _.filter((e) => e.enabled).length,
							total: _.length
						})
					})
				})
			]
		})
	});
}
// src/react/follow-manage/source-list.tsx
var Qn = Vt({
	rowPaginationFeature: Ot,
	rowSelectionFeature: kt,
	rowSortingFeature: At,
	columnVisibilityFeature: Ie,
	paginatedRowModel: on()
}), $n = Object.fromEntries(Object.entries(p).map(([e, t]) => [t, e])), er = 740;
function tr() {
	let [e, t] = (0, Z.useState)(!1), n = (0, Z.useRef)(null), r = (0, Z.useCallback)((e) => {
		if (n.current?.disconnect(), !e) {
			n.current = null;
			return;
		}
		let r = new ResizeObserver(() => t(e.clientWidth < er));
		r.observe(e), n.current = r, t(e.clientWidth < er);
	}, []);
	return (0, Z.useEffect)(() => () => n.current?.disconnect(), []), [r, e];
}
var nr = {
	select: X("follow:shared.select"),
	author: X("follow:shared.creator"),
	source: X("follow:followFeed.filterKindSource"),
	provider: X("follow:shared.site"),
	status: X("follow:shared.status"),
	checked: X("follow:sourceList.colLastChecked"),
	actions: X("follow:shared.actions")
}, rr = Object.entries(nr).map(([e, t]) => ({
	id: e,
	label: t,
	width: e === "select" ? 48 : e === "source" ? 320 : e === "author" ? 240 : e === "actions" ? 208 : 184,
	min: e === "select" ? 48 : e === "actions" ? 200 : e === "source" ? 320 : 112,
	max: e === "select" ? 48 : e === "source" ? 2e3 : 800,
	flex: e === "source",
	required: e === "select" || e === "source"
}));
function ir({ source: e, selected: t, onToggle: n, handlers: r }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"data-selected": t || void 0,
		"data-follow-source-row": "",
		className: "flex min-h-16 flex-wrap items-center gap-3 px-2 py-3 last:rounded-b-lg max-sm:gap-x-2",
		onClick: (e) => {
			Pe(e, e.currentTarget) && n(!t);
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
					children: /* @__PURE__ */ (0, Q.jsx)(nn, { provider: e.provider })
				}), /* @__PURE__ */ (0, Q.jsx)(rn, { source: e })]
			}),
			/* @__PURE__ */ (0, Q.jsx)(s, { children: e.provider_label }),
			/* @__PURE__ */ (0, Q.jsx)(an, { source: e }),
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
						children: /* @__PURE__ */ (0, Q.jsx)(tn, { text: Fe(e, "last_error") })
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)("span", {
				"data-follow-source-controls": "",
				className: "flex w-max max-w-full flex-none flex-wrap items-center gap-1.5 max-sm:w-full",
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "shrink-0 text-body-2-regular whitespace-nowrap text-text-secondary max-sm:mr-auto max-sm:text-caption-1-regular",
						children: Ne(e)
					}),
					/* @__PURE__ */ (0, Q.jsx)(fe, {
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
							leadingIcon: He,
							"aria-label": X("follow:sourceList.checkNamed", { name: e.label }),
							disabled: !e.enabled || r.readOnly,
							...K(r.busy),
							onClick: () => r.check([e.id])
						}), /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: L,
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
function ar({ group: e, name: t, open: n, selected: r, handlers: i, onOpen: a, onToggleGroup: o, onToggle: c }) {
	let l = e.map((e) => e.id), d = e.filter((e) => e.enabled).map((e) => e.id), f = e.filter(at).length, p = ct([...new Set(e.map((e) => e.provider_label || e.provider))]), m = `follow-author-${e[0].id}`, h = Mt(r, l);
	return /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": X("follow:sourceList.groupLabel", { name: t }),
		className: De({
			variant: "raised",
			padding: "none",
			className: "flex flex-col overflow-hidden p-2"
		}),
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			"data-follow-author-header": !0,
			"data-open": n || void 0,
			className: "flex flex-wrap items-center gap-3 px-2 py-2.5",
			children: [
				/* @__PURE__ */ (0, Q.jsx)(en, {
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
							e.map((e) => /* @__PURE__ */ (0, Q.jsx)(nn, { provider: e.provider }, e.id)),
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
						leadingIcon: He,
						"aria-label": X("follow:sourceList.checkGroup", { name: t }),
						disabled: !d.length || i.readOnly,
						...K(i.busy),
						onClick: () => i.check(d)
					}), /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "flex flex-none items-center gap-2",
						children: [/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							leadingIcon: ut,
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
			children: e.map((e) => /* @__PURE__ */ (0, Q.jsx)(ir, {
				source: e,
				handlers: i,
				selected: r.has(e.id),
				onToggle: (t) => c(e.id, t)
			}, e.id))
		})]
	});
}
function or(e) {
	let { data: t, sort: s, dir: c, page: l, layout: d, pageSize: g, selected: v, readOnly: y, onSort: x, onPage: S, onLayout: w, onPageSize: T, onSelected: E, toast: k, openFollow: A, onAdd: te } = e, j = t.sources, M = (0, Z.useMemo)(() => t.author_aliases || [], [t.author_aliases]), N = t.counts || {}, [P, I] = (0, Z.useState)(/* @__PURE__ */ new Set()), [R, ne] = tr(), [re, z] = (0, Z.useState)(""), V = (0, Z.useMemo)(() => we(j, s, c, M), [
		j,
		s,
		c,
		M
	]), ae = (0, Z.useMemo)(() => Ht(V, s, c, M), [
		V,
		s,
		c,
		M
	]), U = Zt(ae, {
		author: {
			values: (e) => e.author,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Q.jsx)(en, {
				group: t.group,
				name: e,
				small: !0
			}) })
		},
		source: {
			values: (e) => e.source.label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Q.jsx)(nn, { provider: t.source.provider }) })
		},
		provider: {
			values: (e) => e.source.provider_label,
			option: (e, t) => ({ leading: t && /* @__PURE__ */ (0, Q.jsx)(nn, { provider: t.source.provider }) })
		},
		status: { values: (e) => Bt(e.source) }
	}, () => S(1)), { job: W, running: le, outcome: de, start: ve } = Kt({
		queryKey: D,
		taskKey: O,
		queryFn: ({ signal: e }) => Ye(e),
		start: (e) => Rt(e),
		onError: (e) => z(q(e)),
		onFinish: (e) => {
			Y(), k(e.status === "failed" ? st(e, "error") || X("follow:followCheck.checkFailed") : je(e));
		}
	}), ye = (e) => {
		le || ve.isPending || (z(""), ve.mutate(e));
	}, be = (e, t) => E(Ut(v, [e], t)), Se = (e, t) => E(Ut(v, e, t)), Ce = qt({
		mutationFn: (e) => Ct(e),
		onSuccess: (e, t) => {
			Ue([t]), E(Ut(v, [t], !1)), k(X("follow:sourceList.unfollowed"));
		},
		onError: (e) => z(q(e))
	}), Ee = qt({
		mutationFn: (e) => Ft(e.id, e.enabled),
		onSuccess: (e, t) => {
			_t(t.id, { enabled: t.enabled }), z("");
		},
		onError: (e) => z(q(e))
	}), Ae = (e) => void Re({
		title: X("follow:sourceList.unfollow"),
		body: X("follow:sourceList.unfollowBody"),
		confirmLabel: X("follow:sourceList.unfollow"),
		danger: !0,
		holdToConfirm: !0,
		onConfirm: () => Ce.mutateAsync(e.id)
	}), Pe = qt({
		mutationFn: async (e) => {
			let t = await pt(e.ids, 4, async (t) => {
				e.action === "remove" ? await Ct(t) : await Ft(t, e.action === "enabled");
			});
			return {
				...e,
				done: e.ids.filter((e, n) => t[n]?.ok),
				results: t
			};
		},
		onSuccess: (e) => {
			if (e.action === "remove") Ue(e.done);
			else for (let t of e.done) _t(t, { enabled: e.action === "enabled" });
			E(Ut(v, e.done, !1));
			let t = e.results.filter((e) => !e.ok);
			t.length ? z(X("follow:sourceList.bulkPartialFail", {
				failed: t.length,
				total: e.ids.length,
				error: q(t[0]?.error)
			})) : z("");
		},
		onError: (e) => z(q(e))
	}), Ie = qt({
		mutationFn: mt,
		onSuccess: (e) => {
			Y(), e.failed ? z(X("follow:sourceList.bulkMarkFailed", {
				failed: e.failed,
				total: e.total,
				error: q(e.error)
			})) : z("");
		},
		onError: (e) => z(q(e))
	}), Le = {
		receipt: k,
		failure: (e) => z(q(e))
	}, Be = (e) => ({
		key: e ? "enable" : "pause",
		label: X(e ? "follow:shared.enable" : "follow:shared.pause"),
		reversal: "undo",
		confirm: (t) => ({
			title: X(e ? "follow:sourceList.enableMany" : "follow:sourceList.pauseMany"),
			body: X(e ? "follow:sourceList.enableManyBody" : "follow:sourceList.pauseManyBody", { count: t.length })
		}),
		run: async (t) => {
			let n = t.filter((t) => j.find((e) => e.id === t)?.enabled !== e), { done: r } = await Pe.mutateAsync({
				ids: n,
				action: e ? "enabled" : "paused"
			});
			return async () => {
				await pt(r, 4, (t) => Ft(t, !e));
				for (let t of r) _t(t, { enabled: !e });
			};
		},
		receipt: (t) => X(e ? "follow:sourceList.bulkEnabled" : "follow:sourceList.bulkPaused", { count: t.length })
	}), Ve = {
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
			await Pe.mutateAsync({
				ids: [...e],
				action: "remove"
			});
		},
		receipt: (e) => X("follow:sourceList.bulkDeleted", { count: e.length })
	}, Ge = (e) => {
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
			run: async () => (t = (await Ie.mutateAsync(e)).marked, async () => {
				await Wt(t), await Y();
			}),
			receipt: () => X("follow:sourceList.bulkMarked", { count: t.length })
		};
	}, Je = (e, t) => Ee.mutate({
		id: e.id,
		enabled: t
	}), Xe = (0, Z.useRef)({
		check: ye,
		toggle: Je,
		remove: Ae,
		busy: !1,
		readOnly: y
	});
	Xe.current = {
		check: ye,
		toggle: Je,
		remove: Ae,
		busy: le || ve.isPending,
		readOnly: y
	};
	let J = Xe.current, Ze = (0, Z.useMemo)(() => {
		let e = ze(), t = (e) => () => nr[e] || e;
		return e.columns([
			e.display({
				id: "select",
				header: (e) => /* @__PURE__ */ (0, Q.jsx)(ge, {
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
					children: [/* @__PURE__ */ (0, Q.jsx)(en, {
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
					children: [/* @__PURE__ */ (0, Q.jsx)(rn, { source: e.row.original.source }), e.row.original.source.last_error ? /* @__PURE__ */ (0, Q.jsx)(tn, { text: Fe(e.row.original.source, "last_error") }) : null]
				})
			}),
			e.accessor((e) => e.source.provider_label, {
				id: "provider",
				header: t("provider"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ (0, Q.jsx)(nn, { provider: e.row.original.source.provider }), e.row.original.source.provider_label]
				})
			}),
			e.display({
				id: "status",
				header: t("status"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsx)(an, { source: e.row.original.source })
			}),
			e.accessor((e) => e.source.last_checked_at || "", {
				id: "checked",
				header: t("checked"),
				cell: (e) => Ne(e.row.original.source)
			}),
			e.display({
				id: "actions",
				header: t("actions"),
				cell: (e) => /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "flex items-center gap-1",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(fe, {
							"aria-label": X("follow:shared.enableNamed", { name: e.row.original.source.label }),
							isSelected: e.row.original.source.enabled,
							isDisabled: J.readOnly,
							onChange: (t) => Xe.current.toggle(e.row.original.source, t)
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: He,
							"aria-label": X("follow:sourceList.checkNamed", { name: e.row.original.source.label }),
							disabled: !e.row.original.source.enabled || J.readOnly,
							...K(J.busy),
							onClick: () => Xe.current.check([e.row.original.source.id])
						}),
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							iconOnly: !0,
							leadingIcon: L,
							"aria-label": X("follow:shared.removeNamed", { name: e.row.original.source.label }),
							disabled: J.readOnly,
							onClick: () => Xe.current.remove(e.row.original.source)
						})
					]
				})
			})
		]);
	}, [J]), Qe = (0, Z.useMemo)(() => {
		let e = $n[s];
		return e ? [{
			id: e,
			desc: c === "desc"
		}] : [];
	}, [s, c]), $e = (0, Z.useMemo)(() => Object.fromEntries([...v].map((e) => [String(e), !0])), [v]), tt = d === "table", nt = Qt("follow-sources", rr), rt = gt(tt ? U.items.length : V.length, g, l), it = Xt({
		features: Qn,
		data: U.items,
		columns: Ze,
		getRowId: (e) => String(e.source.id),
		state: {
			sorting: Qe,
			rowSelection: $e,
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
			let t = (typeof e == "function" ? e(Qe) : e)[0];
			if (!t) return;
			let n = p[t.id];
			n && x(n, t.desc ? "desc" : "asc");
		},
		onRowSelectionChange: (e) => {
			let t = typeof e == "function" ? e($e) : e;
			E(new Set(Object.entries(t).filter(([, e]) => e).map(([e]) => Number(e))));
		},
		onPaginationChange: (e) => {
			let t = {
				pageIndex: rt.page - 1,
				pageSize: g
			}, n = typeof e == "function" ? e(t) : e;
			n.pageSize === g ? n.pageIndex !== t.pageIndex && S(n.pageIndex + 1) : T(n.pageSize);
		}
	}), at = it.getRowModel().rows, ot = tt ? at.map((e) => e.original.source.id) : V.slice(rt.start, rt.end).flatMap((e) => e.map((e) => e.id)), ct = Mt(v, ot), lt = [...v], ut = ke(de), dt = j.filter((e) => e.enabled && (e.last_status === "error" || e.last_status === "unauthorized")).map((e) => e.id), ft = Oe(de), ht = V.length > 0 && P.size >= V.length;
	return j.length ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: De({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				ref: R,
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
						children: N.new ? X("follow:sourceList.sourceCountUnseen", {
							count: j.length,
							unseen: Number(N.new) || 0
						}) : X("follow:sourceList.sourceCount", { count: j.length })
					})]
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-follow-toolbar-actions": "",
					"data-toolbar-actions": "",
					children: [
						dt.length ? /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							disabled: y,
							...K(J.busy),
							onClick: () => ye(dt),
							children: X("follow:sourceList.checkFailed")
						}) : null,
						/* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "primary",
							leadingIcon: He,
							disabled: y,
							"aria-label": X("follow:sourceList.checkAll"),
							iconOnly: ne,
							...K(J.busy),
							onClick: () => ye([]),
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
										leadingIcon: G,
										"aria-label": F[0][1],
										"aria-pressed": !tt,
										onClick: () => w("default")
									}), /* @__PURE__ */ (0, Q.jsx)(u, {
										variant: "ghost",
										iconOnly: !0,
										leadingIcon: We,
										"aria-label": F[1][1],
										"aria-pressed": tt,
										onClick: () => w("table")
									})]
								}),
								tt ? /* @__PURE__ */ (0, Q.jsx)(me, {
									preferences: nt,
									label: X("follow:sourceList.tableLabel")
								}) : null,
								/* @__PURE__ */ (0, Q.jsxs)("span", {
									className: "flex flex-none items-center gap-2",
									children: [/* @__PURE__ */ (0, Q.jsx)(oe, {
										"aria-label": X("follow:sourceList.sortLabel"),
										prefix: X("follow:shared.sort"),
										selectedKey: s,
										onSelectionChange: (e) => {
											if (e === null) return;
											let t = String(e);
											x(t, H[t]);
										},
										children: ie.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(se, {
											id: e,
											children: t
										}, e))
									}), /* @__PURE__ */ (0, Q.jsx)(u, {
										variant: "secondary",
										iconOnly: !0,
										leadingIcon: ue,
										"data-icon-state": c === "asc" ? "a" : "b",
										"aria-label": Lt(s, c),
										onClick: () => x(s, c === "asc" ? "desc" : "asc")
									})]
								}),
								tt ? null : /* @__PURE__ */ (0, Q.jsx)(u, {
									variant: "secondary",
									iconOnly: ne,
									leadingIcon: _,
									"aria-expanded": !ht,
									"aria-label": X(ht ? "follow:shared.expandAll" : "follow:shared.collapseAll"),
									onClick: () => I(ht ? /* @__PURE__ */ new Set() : new Set(V.map((e) => String(e[0].author_key || e[0].id)))),
									children: X(ht ? "follow:shared.expandAll" : "follow:shared.collapseAll")
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
					le ? /* @__PURE__ */ (0, Q.jsx)(_e, {
						embedded: !0,
						kind: W?.older ? xe("feed-scrape") : xe("follow-check"),
						label: st(W) || (W?.total ? X(W.older ? "follow:sourceList.backfillProgress" : "follow:sourceList.checkProgress", {
							checked: W.checked || 0,
							count: W.total
						}) : X("follow:sourceList.preparingCheck")),
						value: W?.checked,
						total: W?.total
					}) : null,
					re ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "error",
						title: X("follow:shared.actionFailed"),
						children: re
					}) : null,
					!le && de?.results?.length ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "neutral",
						title: X("follow:followFeed.checkResults"),
						children: Me(de)
					}) : null,
					ut.length ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "error",
						title: X("follow:sourceList.failedTitle", { count: ut.length }),
						extra: /* @__PURE__ */ (0, Q.jsx)("ul", {
							className: "flex flex-col gap-0.5 text-body-2-regular",
							children: ut.map((e, t) => /* @__PURE__ */ (0, Q.jsx)("li", { children: X("follow:shared.labeled", {
								label: `${e.provider_label || e.provider || ""} ${e.author || e.label || e.ref || ""}`.trim(),
								value: Ke(e.error || "") || X("follow:shared.noReason")
							}) }, `${e.provider || ""}-${e.ref || t}`))
						}),
						children: X("follow:sourceList.failedBody")
					}) : null,
					ft ? /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: "warning",
						children: X("follow:sourceList.evidenceGap", { error: ft })
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)(ce, {
				label: X("follow:sourceList.bulkActions"),
				visible: lt.length > 0,
				count: X("follow:sourceList.selectedCount", { count: lt.length }),
				actions: [
					Be(!0),
					Be(!1),
					Ve
				].map((e) => ({
					action: e,
					items: lt,
					host: Le,
					disabled: y || Pe.isPending
				})),
				leading: /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "secondary",
					size: "small",
					disabled: y,
					...K(J.busy),
					onClick: () => ye(lt),
					children: X("follow:sourceList.checkSelected")
				}),
				children: /* @__PURE__ */ (0, Q.jsx)(u, {
					variant: "ghost",
					size: "small",
					onClick: qe,
					children: X("follow:shared.clearSelection")
				})
			}),
			tt ? /* @__PURE__ */ (0, Q.jsx)(b, {
				follow: !0,
				preferences: nt,
				onRowClick: (e) => be(Number(e), !v.has(Number(e))),
				children: /* @__PURE__ */ (0, Q.jsxs)(pe, {
					"aria-label": X("follow:sourceList.tableLabel"),
					size: "sm",
					sortDescriptor: Qe[0] ? {
						column: Qe[0].id,
						direction: Qe[0].desc ? "descending" : "ascending"
					} : void 0,
					onSortChange: (e) => it.setSorting([{
						id: String(e.column),
						desc: e.direction === "descending"
					}]),
					children: [/* @__PURE__ */ (0, Q.jsxs)(o, { children: [it.getHeaderGroups()[0].headers.map((e) => {
						let t = e.column.id in p, n = et(e.column.columnDef.header, e.getContext());
						return /* @__PURE__ */ (0, Q.jsx)(r, {
							id: e.id,
							allowsSorting: t,
							isRowHeader: e.column.id === "source",
							...nt.columnProps(e.id),
							children: ({ sortDirection: r }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [e.id === "select" ? n : t ? /* @__PURE__ */ (0, Q.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [U.header(e.id, nr[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Q.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": r || void 0,
									children: /* @__PURE__ */ (0, Q.jsx)(h, {})
								})]
							}) : U.header(e.id, nr[e.id] || e.id) ?? n, /* @__PURE__ */ (0, Q.jsx)(he, {
								preferences: nt,
								id: e.id
							})] })
						}, e.id);
					}), /* @__PURE__ */ (0, Q.jsx)(r, {
						id: "remaining-space",
						"aria-label": X("follow:shared.rowSpacer"),
						"data-table-space": "",
						width: nt.spaceWidth,
						minWidth: 0
					})] }), /* @__PURE__ */ (0, Q.jsx)(n, {
						renderEmptyState: () => X("follow:sourceList.pageEmpty"),
						children: at.map((e) => /* @__PURE__ */ (0, Q.jsxs)(i, {
							id: e.id,
							"data-follow-selected": e.getIsSelected() || void 0,
							children: [e.getVisibleCells().map((e) => /* @__PURE__ */ (0, Q.jsx)(a, { children: et(e.column.columnDef.cell, e.getContext()) }, e.id)), /* @__PURE__ */ (0, Q.jsx)(a, { "data-table-space": "" })]
						}, e.id))
					})]
				})
			}) : /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(m, {
				isSelected: ct.all,
				isIndeterminate: ct.some,
				onChange: (e) => Se(ot, e),
				"aria-label": X("follow:sourceList.selectPage"),
				children: X("follow:sourceList.selectPageShort")
			}), /* @__PURE__ */ (0, Q.jsx)("div", {
				className: "flex flex-col gap-3",
				children: V.slice(rt.start, rt.end).map((e) => {
					let t = String(e[0].author_key || e[0].id);
					return /* @__PURE__ */ (0, Q.jsx)(ar, {
						group: e,
						name: Te(e, M),
						handlers: J,
						selected: v,
						open: !P.has(t),
						onOpen: (e) => {
							let n = new Set(P);
							e ? n.delete(t) : n.add(t), I(n);
						},
						onToggleGroup: (t) => Se(e.map((e) => e.id), t),
						onToggle: be
					}, t);
				})
			})] }),
			/* @__PURE__ */ (0, Q.jsx)(ee, {
				label: X("follow:followManageNav.list"),
				total: rt.total,
				pagination: {
					pageIndex: rt.page - 1,
					pageSize: g
				},
				unit: X(tt ? "follow:followOverview.sourceUnit" : "follow:sourceList.creatorUnit"),
				pageUnit: X(tt ? "follow:followOverview.itemUnit" : "follow:followOverview.creatorUnit"),
				onChange: (e) => {
					e.pageSize === g ? it.setPageIndex(e.pageIndex) : it.setPageSize(e.pageSize);
				}
			}),
			N.new ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "-mx-6 -mb-5 flex flex-wrap items-center gap-2 border-t border-separator-border rounded-b-2xl bg-card-footer px-6 py-4 max-sm:-mx-4 max-sm:px-4",
				children: [
					/* @__PURE__ */ (0, Q.jsx)("span", {
						className: "mr-auto text-body-2-regular text-text-secondary",
						children: X("follow:sourceList.markSummary", {
							unwatched: Number(N.new) || 0,
							watched: Number(N.seen) || 0,
							saved: Number(N.saved) || 0,
							ignored: Number(N.ignored) || 0
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(u, {
						variant: "secondary",
						size: "small",
						onClick: A,
						children: X("follow:sourceList.seeUpdates")
					}),
					["seen", "ignored"].map((e) => {
						let t = Ge(e);
						return /* @__PURE__ */ (0, Q.jsx)(u, {
							variant: "secondary",
							size: "small",
							disabled: y,
							...K(Ie.isPending),
							onClick: () => void jt(t, [Number(N.new) || 0], Le).catch(Le.failure),
							children: t.label
						}, e);
					})
				]
			}) : null
		]
	}) : /* @__PURE__ */ (0, Q.jsx)(C, {
		icon: f,
		title: X("follow:sourceList.empty"),
		actions: /* @__PURE__ */ (0, Q.jsx)(u, {
			variant: "primary",
			size: "small",
			onClick: te,
			children: X("follow:followFeed.addFollow")
		}),
		children: X("follow:sourceList.emptyHint")
	});
}
// node_modules/skullet/dist/index.mjs
var sr = "skullet-reveal", cr = "skullet-pane", lr = "skullet-loading", ur = "skullet-ghost", dr = "skullet-snapshot", fr = "skullet-layer", pr = "skullet-rect", mr = "skullet-bar", hr = "skullet-inactive", gr = "skullet-exiting", _r = "skullet-covered", vr = "skullet-own", yr = "skullet-block", br = Symbol.for("skullet.ghost"), xr = Symbol.for("skullet.uncover"), Sr = "skullet-status", Cr = "skullet-xray", wr = "var(--skullet-base, rgb(128 128 128 / 0.2))", Tr = "var(--skullet-highlight, rgb(255 255 255 / 0.12))", Er = 280, Dr = 1e4, Or = {
	shimmer: {
		slow: 4e3,
		fast: 2e3
	},
	pulse: {
		slow: 2400,
		fast: 1200
	}
}, kr = [
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
], Ar = [
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
], jr = Ar.join(", "), Mr = `
[${sr}] {
  position: relative;
}

skullet-reveal {
  display: block;
}

skullet-reveal[loading]:not(:defined) {
  visibility: hidden;
}

[${cr}] {
  display: block;
}

[${lr}] {
  position: relative;
  -webkit-user-select: none;
  user-select: none;
  pointer-events: none;
}

[${hr}] {
  display: none !important;
}

[${fr}] {
  position: absolute;
  inset: 0;
  overflow: visible;
}

[${mr}] {
  display: block;
  background-color: ${wr};
  background-repeat: no-repeat;
}

/* Containers keep their surface; what they hold is drawn by bones, measured before the first paint */
@scope ([${lr}]) to ([${vr}], [${fr}]) {
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
  :scope :is(${kr.join(", ")}):empty:not(svg *)::before {
    content: "000000";
  }

  /* Leaves are drawn by bones, so their own paint never shows; visibility, as measuring reads it */
  :scope :is(:not(:has(*)), ${jr}, [${_r}], [${yr}]):not(svg *) {
    visibility: hidden !important;
  }

  /* No script to measure: a bar struck through each line of text instead */
  @media (scripting: none) {
    :scope :not(:has(*)):not(svg *) {
      visibility: visible !important;
    }

    :scope,
    :scope * {
      text-decoration: line-through ${wr} !important;
      text-decoration-thickness: 0.72em !important;
      text-decoration-skip-ink: none !important;
    }

    :scope :is(${jr}, [${yr}]):not(svg *) {
      visibility: visible !important;
      background: ${wr} !important;
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
[${Sr}] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Debug x-ray: the ghost shown through its bones, to see what was measured */
[${Cr}] [${lr}] [${ur}],
[${Cr}] [${lr}] [${ur}] *:not(svg *) {
  visibility: visible !important;
  color: rgb(255 0 80 / 0.7) !important;
  -webkit-text-fill-color: rgb(255 0 80 / 0.7) !important;
}

/* Lets addStyles see a stylesheet already on the page, from styles.css or a server render */
:root {
  --skullet: 1;
}`, Nr = null, Pr = 0, Fr;
function Ir() {
	Pr++, !Nr && (Fr ??= !!getComputedStyle(document.documentElement).getPropertyValue("--skullet"), !Fr && (Nr = document.createElement("style"), Nr.dataset.skullet = "true", Nr.textContent = Mr, document.head.appendChild(Nr)));
}
function Lr() {
	Pr--, !(Pr > 0 || !Nr) && (Nr.remove(), Nr = null);
}
var Rr = "\"use strict\";(()=>{var B=\"skullet-ghost\";var D=\"skullet-layer\",L=\"skullet-rect\";var R=\"skullet-covered\",$=\"skullet-own\",v=\"skullet-ignore\",H=\"skullet-block\",I=Symbol.for(\"skullet.ghost\"),G=Symbol.for(\"skullet.uncover\"),P=\"skullet.boot\";var W=\"var(--skullet-base, rgb(128 128 128 / 0.2))\",z=\"var(--skullet-highlight, rgb(255 255 255 / 0.12))\";var F={shimmer:{slow:4e3,fast:2e3},pulse:{slow:2400,fast:1200}},X=[\"a\",\"b\",\"code\",\"dd\",\"dt\",\"em\",\"h1\",\"h2\",\"h3\",\"h4\",\"h5\",\"h6\",\"i\",\"label\",\"li\",\"p\",\"small\",\"span\",\"strong\",\"td\",\"th\",\"time\"],U=[\"audio\",\"canvas\",\"embed\",\"iframe\",\"img\",\"input\",\"object\",\"picture\",\"select\",\"svg\",\"textarea\",\"video\"];var gt,V=()=>gt??(gt=/jsdom/.test(navigator.userAgent)?null:document.createElement(\"canvas\").getContext(\"2d\"));var J=(t,n)=>t?{left:Math.max(t.left,n.left),right:Math.min(t.right,n.right),top:Math.max(t.top,n.top),bottom:Math.min(t.bottom,n.bottom)}:n,A=t=>[[t.left,t.top],[t.right,t.top],[t.right,t.bottom],[t.left,t.bottom]],k=(t,n)=>Math.abs(t[0]-n[0])<1&&Math.abs(t[1]-n[1])<1;function Q(t,n){let e=Math.min(n.right-n.left,n.bottom-n.top),o=r=>r.endsWith(\"%\")?parseFloat(r)/100*e:parseFloat(r)||0;return[o(t.borderTopLeftRadius),o(t.borderTopRightRadius),o(t.borderBottomRightRadius),o(t.borderBottomLeftRadius)]}function bt(t,n,e){let o=J(t,n),r=Q(e,n),c=t?A(t):[],a=A(n),l=A(o).map((f,T)=>k(f,a[T])?r[T]:t&&k(f,c[T])?t.corners[T]:0),{left:s,right:i,top:u,bottom:h}=o;return{left:s,right:i,top:u,bottom:h,corners:l}}function Tt(t,n,e,o){if(!t)return e;let r=A(t),c=A(n).map((l,s)=>t.corners[s]>0&&k(l,r[s]));if(!c.some(Boolean))return e;let a=Q(o,n);return c.map((l,s)=>l?Math.max(a[s],t.corners[s]):a[s]).map(l=>`${l}px`).join(\" \")}var j=(t,n)=>{let e=J(n,t);return e.right-e.left>=2&&e.bottom-e.top>=2?e:null},q={top:\"ascender\",bottom:\"descender\"},C=new Map,tt=t=>[...t.getClientRects?.()??[]];function St(t){let n=`${t.fontStyle} ${t.fontWeight} ${t.fontSize} ${t.fontFamily}`;if(C.has(n))return C.get(n);let e=V(),o=null;if(e){e.font=n;let r=e.measureText(\"H\"),c=a=>e.measureText(a).actualBoundingBoxAscent;o={ascent:r.fontBoundingBoxAscent,descent:r.fontBoundingBoxDescent,ascender:c(\"bdfhkl\"),capHeight:r.actualBoundingBoxAscent,xHeight:c(\"xz\"),descender:e.measureText(\"gjpqy\").actualBoundingBoxDescent}}return C.set(n,o),o}var Y={ascender:\"ascender\",\"cap-height\":\"capHeight\",\"x-height\":\"xHeight\"},K=(t,n,e,o)=>{let r=t.getPropertyValue(n).trim();return e.includes(r)?r:o};function xt(t,n,e){let o=St(n);if(!o){let s=Math.min(e*.72,t.bottom-t.top),i=(t.top+t.bottom)/2;return{barTop:i-s/2,barBottom:i+s/2}}let r=K(n,\"--skullet-text-top\",Object.keys(Y),q.top),c=K(n,\"--skullet-text-bottom\",[\"baseline\",\"descender\"],q.bottom),a=o.ascent+o.descent,l=t.top+(t.bottom-t.top-a)/2+o.ascent;return{barTop:l-o[Y[r]],barBottom:l+(c===\"descender\"?o.descender:0)}}var Et=new Set(U),Rt=new Set(X),et=.4,At=/[,/]\\s*0\\)$/,y=(t,n)=>t!==\"\"&&t!==n,yt=[\"Top\",\"Right\",\"Bottom\",\"Left\"],Mt=t=>yt.every(n=>y(t[`border${n}Style`],\"none\")&&y(t[`border${n}Width`],\"0px\")),Ct=t=>{let[n=0,e=0,o=0,r=0]=(t.replace(/rgba?\\([^)]*\\)|#\\w+/g,\"\").match(/-?[\\d.]+px/g)??[]).map(parseFloat);return t.includes(\"inset\")&&!o&&!r&&n===0!=(e===0)&&Math.abs(n+e)<=2},kt=t=>y(t,\"none\")&&!t.split(/,(?![^(]*\\))/).every(Ct),Ot=t=>y(t.backgroundColor,\"transparent\")&&!At.test(t.backgroundColor)||y(t.backgroundImage,\"none\")||kt(t.boxShadow)||Mt(t),ot=t=>Et.has(t.localName),nt=t=>Rt.has(t.localName)&&!t.firstElementChild&&!t.textContent?.trim(),wt=t=>{let n=document.createTreeWalker(t,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT),e=document.createRange(),o=[],r=0;for(;n.nextNode();){let i=n.currentNode;if(i.nodeType===Node.TEXT_NODE){let u=i.parentElement;if(!i.textContent?.trim()||!u)continue;r++;let h=u.getBoundingClientRect();if(h.width<=1||h.height<=1)continue;e.selectNodeContents(i),o.push(tt(e).filter(f=>f.width||f.height))}else nt(i)&&(r++,o.push([...i.getClientRects()]))}if(!o.some(i=>i.length))return r;let c=(parseFloat(getComputedStyle(t).fontSize)||16)*et,a=(i,u)=>Math.min(i.bottom,u.bottom)-Math.max(i.top,u.top)>=Math.min(i.height,u.height)/2&&Math.max(i.left,u.left)-Math.min(i.right,u.right)<=c,l=o.map((i,u)=>u),s=i=>l[i]===i?i:l[i]=s(l[i]);for(let i=0;i<o.length;i++)for(let u=i+1;u<o.length;u++)o[i].some(h=>o[u].some(f=>a(h,f)))&&(l[s(u)]=s(i));return new Set(o.map((i,u)=>s(u))).size},Nt=(t,n)=>t.hasAttribute(H)||ot(t)||Ot(n)&&wt(t)<=1;function _t(t,n){if(parseFloat(n.borderRadius)||!t.parentElement)return n.borderRadius||\"0px\";let e=t.parentElement,o=getComputedStyle(e),r=t.getBoundingClientRect(),c=e.getBoundingClientRect();return Math.abs(r.width-c.width)<1&&Math.abs(r.height-c.height)<1&&o.overflow!==\"visible\"?o.borderRadius:n.borderRadius||\"0px\"}function Z(t){t.sort((e,o)=>e.left-o.left);let n=[];for(let e of t){let o=n.find(r=>{let c=Math.min(r.bottom,e.bottom)-Math.max(r.top,e.top),a=Math.min(r.bottom-r.top,e.bottom-e.top),l=e.left-r.right;return c>=a/2&&l<=Math.max(r.fontSize,e.fontSize)*et});o?(o.left=Math.min(o.left,e.left),o.right=Math.max(o.right,e.right),o.top=Math.min(o.top,e.top),o.bottom=Math.max(o.bottom,e.bottom),o.fontSize=Math.max(o.fontSize,e.fontSize),o.barTop=Math.min(o.barTop,e.barTop),o.barBottom=Math.max(o.barBottom,e.barBottom)):n.push({...e})}return n.map(e=>{let o=e.barBottom-e.barTop;return{x:e.left,y:e.barTop,width:e.right-e.left,height:o,radius:e.radius||`${Math.round(o/3)}px`}})}function rt(t,n,{mark:e=!0,onCovered:o}={}){let r=n.getBoundingClientRect(),c=n.offsetWidth?r.width/n.offsetWidth:1,a=n.offsetHeight?r.height/n.offsetHeight:1,l=m=>({left:(m.left-r.left)/c,right:(m.right-r.left)/c,top:(m.top-r.top)/a,bottom:(m.bottom-r.top)/a}),s=[],i=[],u=new Set,h=document.createRange(),f=(m,g,b)=>{let d=j(m,b);if(!d)return;let p=parseFloat(g.fontSize)||16,M=l(d);i.push({...M,fontSize:p,...xt(M,g,p),radius:g.getPropertyValue(\"--skullet-radius\").trim()})},T=(m,g)=>{let b=m.data.search(/\\S/);if(b<0||!m.parentElement)return;h.setStart(m,b),h.setEnd(m,m.data.trimEnd().length);let d=getComputedStyle(m.parentElement);for(let p of tt(h))f(p,d,g)},_=(m,g)=>{for(let b of m.childNodes){if(b.nodeType===Node.TEXT_NODE){T(b,g);continue}if(b.nodeType!==Node.ELEMENT_NODE)continue;let d=b;if(d.hasAttribute(v)||d.hasAttribute($))continue;let p=getComputedStyle(d);if(p.display===\"none\")continue;if(Nt(d,p)){let E=j(d.getBoundingClientRect(),g);if(E){let S=l(E);s.push({x:S.left,y:S.top,width:S.right-S.left,height:S.bottom-S.top,radius:Tt(g,E,_t(d,p),p)})}ot(d)||u.add(d);continue}if(nt(d)){for(let E of d.getClientRects())f(E,p,g);continue}let M=p.overflowX!==\"visible\"||p.overflowY!==\"visible\";_(d,M?bt(g,d.getBoundingClientRect(),p):g)}};if(_(t,null),o?.(u),!e)return[...s,...Z(i)];for(let m of t.querySelectorAll(`[${R}]`))u.has(m)||m.removeAttribute(R);for(let m of u)m.hasAttribute(R)||m.setAttribute(R,\"\");return[...s,...Z(i)]}var Bt=t=>typeof matchMedia<\"u\"&&matchMedia(t).matches,Dt=()=>typeof Element<\"u\"&&typeof Element.prototype.animate==\"function\",st=()=>!Dt()||Bt(\"(prefers-reduced-motion: reduce)\");var it=t=>t.getAnimations?.()??[];var Lt=.7,$t=1280,at=320,vt=2.5,Ht=.45,It=[\"shimmer\",\"group-shimmer\",\"pulse\",\"none\"];function lt(t){let n=getComputedStyle(t),e=(c,a,l)=>{let s=n.getPropertyValue(c).trim();return a.includes(s)?s:l},o=e(\"--skullet-animation\",It,\"shimmer\"),r=e(\"--skullet-speed\",[\"slow\",\"fast\"],\"slow\");return{animation:o,duration:F[o===\"pulse\"?\"pulse\":\"shimmer\"][r]}}var w=20,Gt=Math.sin(w*Math.PI/180),ut=Math.cos(w*Math.PI/180),Pt=Gt/ut;var Wt=`${90+w}deg`,O=.85,x=12,ct=t=>(1-Math.cos(Math.PI*t))/2;function zt(t){let n=t*vt,e=(r,c)=>`color-mix(in srgb, ${z} ${(c*100).toFixed(1)}%, transparent) ${(r*t).toFixed(2)}px`,o=[];for(let r=0;r<=x;r++)o.push(e(r/x*O,ct(r/x)));for(let r=1;r<=x;r++)o.push(e(O+r/x*(1-O),ct(1-r/x)));return{width:n/ut,image:`repeating-linear-gradient(${Wt}, ${o.join(\", \")}, transparent ${n.toFixed(2)}px)`}}function Ft(t,n,e=lt(t)){for(let f of it(t))f.cancel();if(t.style.backgroundImage=\"\",t.style.backgroundRepeat=\"\",st()||typeof t.animate!=\"function\"||e.animation===\"none\")return;let o={duration:e.duration,iterations:1/0};if(e.animation===\"pulse\"){t.animate([{opacity:1,easing:\"ease-in-out\"},{opacity:Ht,easing:\"ease-in-out\"},{opacity:1}],o).startTime=0;return}let r=t.getBoundingClientRect(),c=r.left+scrollX,a=e.animation===\"group-shimmer\"?n??{left:c,top:r.top,width:r.width,height:r.height}:{left:0,top:0,width:document.documentElement.clientWidth||innerWidth,height:innerHeight},l=Math.min(Math.max(a.width*.4,80),at),{width:s,image:i}=zt(l),u=c-a.left+(r.top-a.top)*Pt,h=e.duration*Lt/($t+at);t.style.backgroundImage=i,t.style.backgroundSize=`${s}px 100%`,t.style.backgroundRepeat=\"repeat-x\",t.animate([{backgroundPosition:`${-u}px 0`},{backgroundPosition:`${s-u}px 0`}],{duration:s*h,iterations:1/0}).startTime=0}var Xt=t=>t.shadowRoot??t.attachShadow({mode:\"open\"});function mt(t,n){let e=Xt(t),o=t.getBoundingClientRect(),r={left:o.left+scrollX,top:o.top,width:o.width,height:o.height},c=lt(t);for(n.forEach((a,l)=>{let s=e.children[l];s||(s=document.createElement(\"div\"),s.setAttribute(L,\"\"),s.style.cssText=`position:absolute;display:block;pointer-events:none;background-color:${W};background-repeat:no-repeat`,e.append(s)),Object.assign(s.style,{left:`${a.x}px`,top:`${a.y}px`,width:`${a.width}px`,height:`${a.height}px`,borderRadius:a.radius});let i=`${Math.round(r.left+a.x)}|${Math.round(a.y)}|${Math.round(a.height)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}|${document.documentElement.clientWidth}|${c.animation}|${c.duration}`;s.dataset.motion!==i&&(s.dataset.motion=i,Ft(s,r,c))});e.children.length>n.length;)e.lastElementChild.remove()}var pt=t=>t.parentElement?`${pt(t.parentElement)} > :nth-child(${[...t.parentElement.children].indexOf(t)+1})`:\":root\";function N(t){let n=t?.previousElementSibling,e=n?.querySelector(`:scope > [${B}]`),o=n?.querySelector(`:scope > [${D}]`);if(!n||!e||!o)return;let r=typeof CSSStyleSheet==\"function\"&&\"replaceSync\"in CSSStyleSheet.prototype?new CSSStyleSheet:null;r&&(document.adoptedStyleSheets=[...document.adoptedStyleSheets,r],n[G]=()=>{document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==r)});let c=s=>r?.replaceSync(s.size?`${[...s].map(pt).join(\", \")} { visibility: hidden !important; }`:\"\"),a=()=>{if(!o.isConnected||n[I])return l.disconnect();e.getClientRects().length&&mt(o,rt(e,o,{mark:!1,onCovered:c}))},l=new ResizeObserver(a);l.observe(n),document.fonts?.ready.then(a)}var ht=self,ft=Symbol.for(P),dt=ht[ft];ht[ft]=N;Array.isArray(dt)&&dt.forEach(N);N(document.currentScript);})();", zr = {
	light: {
		base: "rgb(0 0 0 / 0.07)",
		highlight: "rgb(255 255 255 / 0.6)"
	},
	dark: {
		base: "rgb(255 255 255 / 0.08)",
		highlight: "rgb(255 255 255 / 0.1)"
	}
};
({ ...zr });
function Br(e = {}, t = null) {
	let n = {}, r = t && (e[t] ?? zr[t]);
	return r && (n["--skullet-base"] = r.base, n["--skullet-highlight"] = r.highlight), e.radius && (n["--skullet-radius"] = e.radius), e.animation && (n["--skullet-animation"] = e.animation), e.speed && (n["--skullet-speed"] = e.speed), e.text?.top && (n["--skullet-text-top"] = e.text.top), e.text?.bottom && (n["--skullet-text-bottom"] = e.text.bottom), n;
}
var Vr = (e) => Object.entries(e).map(([e, t]) => `${e}: ${t};`).join(" ");
function Hr({ theme: e = {}, mode: t, text: n, selector: r = ":root" }) {
	let i = {
		...e,
		text: {
			...e.text,
			...n
		}
	}, a = t ?? (e.light || e.dark ? "system" : null), o = Br(i, a === "dark" ? "dark" : a ? "light" : null), s = [];
	if (Object.keys(o).length && s.push(`${r} { ${Vr(o)} }`), a === "system") {
		let t = Br({ dark: e.dark }, "dark");
		s.push(`@media (prefers-color-scheme: dark) { ${r} { ${Vr(t)} } }`);
	}
	return s.join("\n");
}
var Ur = /* @__PURE__ */ new Map(), Wr, Gr = null, Kr = 0;
function qr() {
	try {
		return new URLSearchParams(location.search).has("skullet-debug") || localStorage.getItem("skullet:debug") === "1";
	} catch {
		return !1;
	}
}
var Jr = () => Wr ??= typeof window < "u" && qr(), Yr = (e) => Jr() || !!e?.closest("[skullet-debug]");
function Xr(e) {
	Wr = e, e ? ti() : ni();
}
function Zr(e, t) {
	!e || !Yr(e) || (Ur.set(e, {
		state: "loading",
		source: t
	}), $r());
}
function Qr(e, t) {
	!e || !Yr(e) || (Ur.set(e, {
		...Ur.get(e),
		state: "shown",
		moved: t
	}), $r());
}
function $r() {
	ti(), cancelAnimationFrame(Kr), ii();
}
var ei = "\n:host { all: initial; }\n.box { position: fixed; box-sizing: border-box; border: 1px dashed; border-radius: 4px; }\n.label {\n  position: absolute; left: -1px; bottom: 100%; margin-bottom: 2px;\n  padding: 1px 6px; border-radius: 4px; white-space: nowrap;\n  font: 500 11px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff;\n}\n.loading { border-color: #3b82f6; } .loading .label { background: #3b82f6; }\n.still { border-color: #22c55e; } .still .label { background: #16a34a; }\n.moved { border-color: #ef4444; border-style: solid; } .moved .label { background: #dc2626; }\n.panel {\n  position: fixed; right: 12px; bottom: 12px; display: flex; gap: 8px; align-items: center;\n  padding: 6px 10px; border-radius: 8px; background: #111; color: #fff; pointer-events: auto;\n  font: 500 12px/16px ui-sans-serif, system-ui, sans-serif; box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);\n}\n.panel label { display: flex; gap: 4px; align-items: center; cursor: pointer; }\n";
function ti() {
	if (typeof document > "u") return;
	if (!Gr?.isConnected) {
		Gr = document.createElement("div"), Gr.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
		let e = Gr.attachShadow({ mode: "open" });
		e.innerHTML = `<style>${ei}</style><div class="boxes"></div>`, document.body.append(Gr);
	}
	let e = Gr.shadowRoot;
	if (Wr && !e.querySelector(".panel")) {
		let t = document.createElement("div");
		t.className = "panel", t.innerHTML = "skullet debug <label><input type=\"checkbox\" class=\"xray\"> x-ray</label>", t.querySelector(".xray").addEventListener("change", (e) => {
			document.documentElement.toggleAttribute(Cr, e.target.checked);
		}), e.append(t);
	}
	Kr ||= requestAnimationFrame(ii);
}
function ni() {
	Gr?.shadowRoot?.querySelector(".panel")?.remove(), document.documentElement.removeAttribute(Cr), ![...Ur.keys()].some((e) => Yr(e)) && (cancelAnimationFrame(Kr), Kr = 0, Gr?.remove(), Gr = null);
}
var ri = ({ state: e, source: t, moved: n }) => {
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
function ii() {
	if (Kr = 0, !Gr?.shadowRoot) return;
	let e = Gr.shadowRoot.querySelector(".boxes");
	for (let e of Ur.keys()) e.isConnected && Yr(e) || Ur.delete(e);
	let t = [...Ur];
	for (; e.children.length > t.length;) e.lastElementChild.remove();
	t.forEach(([t, n], r) => {
		let i = e.children[r];
		i || (i = e.appendChild(document.createElement("div")), i.innerHTML = "<span class=\"label\"></span>");
		let a = t.getBoundingClientRect(), { kind: o, text: s } = ri(n);
		i.className = `box ${o}`, Object.assign(i.style, {
			left: `${a.left - 2}px`,
			top: `${a.top - 2}px`,
			width: `${a.width + 4}px`,
			height: `${a.height + 4}px`
		}), i.firstElementChild.textContent = s;
	}), (Wr || Ur.size) && (Kr = requestAnimationFrame(ii));
}
var ai, oi = () => ai ??= /jsdom/.test(navigator.userAgent) ? null : document.createElement("canvas").getContext("2d"), si = (e, t) => e ? {
	left: Math.max(e.left, t.left),
	right: Math.min(e.right, t.right),
	top: Math.max(e.top, t.top),
	bottom: Math.min(e.bottom, t.bottom)
} : t, ci = (e) => [
	[e.left, e.top],
	[e.right, e.top],
	[e.right, e.bottom],
	[e.left, e.bottom]
], li = (e, t) => Math.abs(e[0] - t[0]) < 1 && Math.abs(e[1] - t[1]) < 1;
function ui(e, t) {
	let n = Math.min(t.right - t.left, t.bottom - t.top), r = (e) => e.endsWith("%") ? parseFloat(e) / 100 * n : parseFloat(e) || 0;
	return [
		r(e.borderTopLeftRadius),
		r(e.borderTopRightRadius),
		r(e.borderBottomRightRadius),
		r(e.borderBottomLeftRadius)
	];
}
function di(e, t, n) {
	let r = si(e, t), i = ui(n, t), a = e ? ci(e) : [], o = ci(t), s = ci(r).map((t, n) => li(t, o[n]) ? i[n] : e && li(t, a[n]) ? e.corners[n] : 0), { left: c, right: l, top: u, bottom: d } = r;
	return {
		left: c,
		right: l,
		top: u,
		bottom: d,
		corners: s
	};
}
function fi(e, t, n, r) {
	if (!e) return n;
	let i = ci(e), a = ci(t).map((t, n) => e.corners[n] > 0 && li(t, i[n]));
	if (!a.some(Boolean)) return n;
	let o = ui(r, t);
	return a.map((t, n) => t ? Math.max(o[n], e.corners[n]) : o[n]).map((e) => `${e}px`).join(" ");
}
var pi = (e, t) => {
	let n = si(t, e);
	return n.right - n.left >= 2 && n.bottom - n.top >= 2 ? n : null;
}, mi = {
	top: "ascender",
	bottom: "descender"
}, hi = /* @__PURE__ */ new Map(), gi = (e) => [...e.getClientRects?.() ?? []];
function _i(e) {
	let t = `${e.fontStyle} ${e.fontWeight} ${e.fontSize} ${e.fontFamily}`;
	if (hi.has(t)) return hi.get(t);
	let n = oi(), r = null;
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
	return hi.set(t, r), r;
}
var vi = {
	ascender: "ascender",
	"cap-height": "capHeight",
	"x-height": "xHeight"
}, yi = (e, t, n, r) => {
	let i = e.getPropertyValue(t).trim();
	return n.includes(i) ? i : r;
};
function bi(e, t, n) {
	let r = _i(t);
	if (!r) {
		let t = Math.min(n * .72, e.bottom - e.top), r = (e.top + e.bottom) / 2;
		return {
			barTop: r - t / 2,
			barBottom: r + t / 2
		};
	}
	let i = yi(t, "--skullet-text-top", Object.keys(vi), mi.top), a = yi(t, "--skullet-text-bottom", ["baseline", "descender"], mi.bottom), o = r.ascent + r.descent, s = e.top + (e.bottom - e.top - o) / 2 + r.ascent;
	return {
		barTop: s - r[vi[i]],
		barBottom: s + (a === "descender" ? r.descender : 0)
	};
}
var xi = new Set(Ar), Si = new Set(kr), Ci = .4, wi = /[,/]\s*0\)$/, Ti = (e, t) => e !== "" && e !== t, Ei = [
	"Top",
	"Right",
	"Bottom",
	"Left"
], Di = (e) => Ei.every((t) => Ti(e[`border${t}Style`], "none") && Ti(e[`border${t}Width`], "0px")), Oi = (e) => {
	let [t = 0, n = 0, r = 0, i = 0] = (e.replace(/rgba?\([^)]*\)|#\w+/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
	return e.includes("inset") && !r && !i && t === 0 != (n === 0) && Math.abs(t + n) <= 2;
}, ki = (e) => Ti(e, "none") && !e.split(/,(?![^(]*\))/).every(Oi), Ai = (e) => Ti(e.backgroundColor, "transparent") && !wi.test(e.backgroundColor) || Ti(e.backgroundImage, "none") || ki(e.boxShadow) || Di(e), ji = (e) => xi.has(e.localName), Mi = (e) => Si.has(e.localName) && !e.firstElementChild && !e.textContent?.trim(), Ni = (e) => {
	let t = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = document.createRange(), r = [], i = 0;
	for (; t.nextNode();) {
		let e = t.currentNode;
		if (e.nodeType === Node.TEXT_NODE) {
			let t = e.parentElement;
			if (!e.textContent?.trim() || !t) continue;
			i++;
			let a = t.getBoundingClientRect();
			if (a.width <= 1 || a.height <= 1) continue;
			n.selectNodeContents(e), r.push(gi(n).filter((e) => e.width || e.height));
		} else Mi(e) && (i++, r.push([...e.getClientRects()]));
	}
	if (!r.some((e) => e.length)) return i;
	let a = (parseFloat(getComputedStyle(e).fontSize) || 16) * Ci, o = (e, t) => Math.min(e.bottom, t.bottom) - Math.max(e.top, t.top) >= Math.min(e.height, t.height) / 2 && Math.max(e.left, t.left) - Math.min(e.right, t.right) <= a, s = r.map((e, t) => t), c = (e) => s[e] === e ? e : s[e] = c(s[e]);
	for (let e = 0; e < r.length; e++) for (let t = e + 1; t < r.length; t++) r[e].some((e) => r[t].some((t) => o(e, t))) && (s[c(t)] = c(e));
	return new Set(r.map((e, t) => c(t))).size;
}, Pi = (e, t) => e.hasAttribute("skullet-block") || ji(e) || Ai(t) && Ni(e) <= 1;
function Fi(e, t) {
	if (parseFloat(t.borderRadius) || !e.parentElement) return t.borderRadius || "0px";
	let n = e.parentElement, r = getComputedStyle(n), i = e.getBoundingClientRect(), a = n.getBoundingClientRect();
	return Math.abs(i.width - a.width) < 1 && Math.abs(i.height - a.height) < 1 && r.overflow !== "visible" ? r.borderRadius : t.borderRadius || "0px";
}
function Ii(e) {
	e.sort((e, t) => e.left - t.left);
	let t = [];
	for (let n of e) {
		let e = t.find((e) => {
			let t = Math.min(e.bottom, n.bottom) - Math.max(e.top, n.top), r = Math.min(e.bottom - e.top, n.bottom - n.top), i = n.left - e.right;
			return t >= r / 2 && i <= Math.max(e.fontSize, n.fontSize) * Ci;
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
function Li(e, t, { mark: n = !0, onCovered: r } = {}) {
	let i = t.getBoundingClientRect(), a = t.offsetWidth ? i.width / t.offsetWidth : 1, o = t.offsetHeight ? i.height / t.offsetHeight : 1, s = (e) => ({
		left: (e.left - i.left) / a,
		right: (e.right - i.left) / a,
		top: (e.top - i.top) / o,
		bottom: (e.bottom - i.top) / o
	}), c = [], l = [], u = /* @__PURE__ */ new Set(), d = document.createRange(), f = (e, t, n) => {
		let r = pi(e, n);
		if (!r) return;
		let i = parseFloat(t.fontSize) || 16, a = s(r);
		l.push({
			...a,
			fontSize: i,
			...bi(a, t, i),
			radius: t.getPropertyValue("--skullet-radius").trim()
		});
	}, p = (e, t) => {
		let n = e.data.search(/\S/);
		if (n < 0 || !e.parentElement) return;
		d.setStart(e, n), d.setEnd(e, e.data.trimEnd().length);
		let r = getComputedStyle(e.parentElement);
		for (let e of gi(d)) f(e, r, t);
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
			if (Pi(e, r)) {
				let n = pi(e.getBoundingClientRect(), t);
				if (n) {
					let i = s(n);
					c.push({
						x: i.left,
						y: i.top,
						width: i.right - i.left,
						height: i.bottom - i.top,
						radius: fi(t, n, Fi(e, r), r)
					});
				}
				ji(e) || u.add(e);
				continue;
			}
			if (Mi(e)) {
				for (let n of e.getClientRects()) f(n, r, t);
				continue;
			}
			let i = r.overflowX !== "visible" || r.overflowY !== "visible";
			m(e, i ? di(t, e.getBoundingClientRect(), r) : t);
		}
	};
	if (m(e, null), r?.(u), !n) return [...c, ...Ii(l)];
	for (let t of e.querySelectorAll(`[${_r}]`)) u.has(t) || t.removeAttribute(_r);
	for (let e of u) e.hasAttribute(_r) || e.setAttribute(_r, "");
	return [...c, ...Ii(l)];
}
var Ri = (e) => typeof matchMedia < "u" && matchMedia(e).matches, zi = () => typeof Element < "u" && typeof Element.prototype.animate == "function", Bi = () => !zi() || Ri("(prefers-reduced-motion: reduce)"), Vi = () => Ri("(prefers-reduced-transparency: reduce)"), Hi = (e) => e.getAnimations?.() ?? [], Ui = .7, Wi = 1280, Gi = 320, Ki = 2.5, qi = .45, Ji = [
	"shimmer",
	"group-shimmer",
	"pulse",
	"none"
];
function Yi(e) {
	let t = getComputedStyle(e), n = (e, n, r) => {
		let i = t.getPropertyValue(e).trim();
		return n.includes(i) ? i : r;
	}, r = n("--skullet-animation", Ji, "shimmer"), i = n("--skullet-speed", ["slow", "fast"], "slow");
	return {
		animation: r,
		duration: Or[r === "pulse" ? "pulse" : "shimmer"][i]
	};
}
var Xi = 20, Zi = Math.sin(Xi * Math.PI / 180), Qi = Math.cos(Xi * Math.PI / 180), $i = Zi / Qi, ea = Qi, ta = `${90 + Xi}deg`, na = .85, $ = 12, ra = (e) => (1 - Math.cos(Math.PI * e)) / 2;
function ia(e) {
	let t = e * Ki, n = (t, n) => `color-mix(in srgb, ${Tr} ${(n * 100).toFixed(1)}%, transparent) ${(t * e).toFixed(2)}px`, r = [];
	for (let e = 0; e <= $; e++) r.push(n(e / $ * na, ra(e / $)));
	for (let e = 1; e <= $; e++) r.push(n(na + e / $ * (1 - na), ra(1 - e / $)));
	return {
		width: t / Qi,
		image: `repeating-linear-gradient(${ta}, ${r.join(", ")}, transparent ${t.toFixed(2)}px)`
	};
}
function aa(e, t, n = Yi(e)) {
	for (let t of Hi(e)) t.cancel();
	if (e.style.backgroundImage = "", e.style.backgroundRepeat = "", Bi() || typeof e.animate != "function" || n.animation === "none") return;
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
				opacity: qi,
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
	}, { width: s, image: c } = ia(Math.min(Math.max(o.width * .4, 80), Gi)), l = a - o.left + (i.top - o.top) * $i, u = n.duration * Ui / (Wi + Gi);
	e.style.backgroundImage = c, e.style.backgroundSize = `${s}px 100%`, e.style.backgroundRepeat = "repeat-x", e.animate([{ backgroundPosition: `${-l}px 0` }, { backgroundPosition: `${s - l}px 0` }], {
		duration: s * u,
		iterations: 1 / 0
	}).startTime = 0;
}
function oa(e) {
	if (Bi()) return null;
	let t = Yi(e);
	return t.animation !== "shimmer" && t.animation !== "group-shimmer" ? null : t.duration * Ui / (Wi + Gi);
}
var sa = (e) => e.shadowRoot ?? e.attachShadow({ mode: "open" }), ca = (e) => e.shadowRoot ? [...e.shadowRoot.children] : [];
function la(e, t) {
	let n = sa(e), r = e.getBoundingClientRect(), i = {
		left: r.left + scrollX,
		top: r.top,
		width: r.width,
		height: r.height
	}, a = Yi(e);
	for (t.forEach((e, t) => {
		let r = n.children[t];
		r || (r = document.createElement("div"), r.setAttribute("skullet-rect", ""), r.style.cssText = `position:absolute;display:block;pointer-events:none;background-color:${wr};background-repeat:no-repeat`, n.append(r)), Object.assign(r.style, {
			left: `${e.x}px`,
			top: `${e.y}px`,
			width: `${e.width}px`,
			height: `${e.height}px`,
			borderRadius: e.radius
		});
		let o = `${Math.round(i.left + e.x)}|${Math.round(e.y)}|${Math.round(e.height)}|${Math.round(i.left)}|${Math.round(i.width)}|${Math.round(i.height)}|${document.documentElement.clientWidth}|${a.animation}|${a.duration}`;
		r.dataset.motion !== o && (r.dataset.motion = o, aa(r, i, a));
	}); n.children.length > t.length;) n.lastElementChild.remove();
}
var ua = 120, da = 72, fa = 3, pa = 60, ma = 150, ha = 400, ga = 1.5, _a = 1e3, va = 1e3, ya = /* @__PURE__ */ new Set([
	"filter",
	"transform",
	"translate",
	"scale",
	"rotate",
	"clipPath",
	"easing",
	"composite"
]), ba = -1 / 0, xa = !1;
function Sa() {
	if (!(xa || typeof addEventListener > "u")) {
		xa = !0;
		for (let e of [
			"wheel",
			"touchmove",
			"keydown"
		]) addEventListener(e, () => ba = performance.now(), {
			passive: !0,
			capture: !0
		});
	}
}
var Ca = /* @__PURE__ */ new WeakMap();
function wa(e, { served: t, refetch: n }) {
	Sa();
	let r = Ca.get(e)?.since ?? performance.now();
	Ca.set(e, {
		since: t ? -1 / 0 : r,
		refetch: n
	});
}
function Ta(e) {
	let t = [], n = (e) => {
		for (let r of e.children) {
			let e = [...r.childNodes].some((e) => e.nodeType === Node.TEXT_NODE && e.textContent?.trim());
			!r.firstElementChild || e || r.localName === "svg" ? t.push(r) : n(r);
		}
	};
	return n(e), t;
}
function Ea(e, t) {
	for (let n = e; n && n !== t; n = n.parentElement) {
		let e = n.parentElement;
		if (!e) break;
		if ([...e.children].filter((e) => e.localName === n.localName && e.className === n.className).length >= 3) return n;
	}
	return e;
}
var Da = (e, t) => {
	let n = t.left + t.width / 2, r = t.top + t.height / 2;
	return n >= e.left && n <= e.right && r >= e.top && r <= e.bottom;
};
function Oa(e) {
	let { left: t, top: n, right: r, bottom: i } = e.getBoundingClientRect();
	for (let a of e.querySelectorAll(`:scope > [${gr}]`)) {
		let e = a.getBoundingClientRect();
		t = Math.min(t, e.left), n = Math.min(n, e.top), r = Math.max(r, e.right), i = Math.max(i, e.bottom);
	}
	return new DOMRect(t, n, r - t, i - n);
}
var ka = (e, t) => Math.min(Math.max(e, 0), t), Aa = -1 / 0;
function ja(e, t, n, r, i) {
	let a = performance.now();
	a - Aa > ma && (Aa = a);
	let o = a - Aa, s = t.getBoundingClientRect(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (e) => parseFloat(getComputedStyle(e).fontSize) || 16;
	for (let t of Ta(e)) {
		let n = Ea(t, e), r = c.get(n);
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
		return t === null ? null : ka(t, _a) + Math.max(r.delay ?? 0, 0);
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
			let t = [...c.values()].find((t) => Da(t.rect, e));
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
function Ma(e, t) {
	if (!e) return;
	let n = {};
	for (let [r, i] of Object.entries(e)) ya.has(r) ? n[r] = i : r !== "opacity" && t(r);
	return n;
}
function Na(e, t, n, r = () => {}) {
	let i = Ca.get(t);
	Ca.delete(t);
	let a = n;
	for (; a.choose;) {
		let { choose: n, ...r } = a;
		a = {
			...r,
			...n({
				content: e,
				reveal: t,
				waited: i ? performance.now() - i.since : 1 / 0,
				input: performance.now() - ba < ha,
				refetch: !!i?.refetch,
				height: e.getBoundingClientRect().height,
				pieces: Ta(e).length
			})
		};
	}
	let o = ka(a.duration ?? 200, va);
	if (a = {
		...a,
		delay: Math.min(a.delay ?? 0, _a)
	}, !o) return { kind: "instant" };
	let s = Ma(a.enter, r);
	if (a.wipe) {
		let e = Oa(t);
		if (e.width * e.height <= innerWidth * innerHeight * ga) return {
			kind: "wipe",
			wipe: a.wipe,
			start: performance.now() + (a.delay ?? 0),
			duration: o,
			reveal: e,
			enter: s
		};
	} else if (typeof a.order == "function") return ja(e, t, a.order, {
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
var Pa = ({ rect: e, reveal: t }) => {
	let n = (e.top - t.top) / Math.max(t.height, 1), r = (e.left - t.left) / Math.max(t.width, 1);
	return ka(n * .8 + r * .2, 1) * 320;
}, Fa = (e) => e.bottom > 0 && e.top < innerHeight, Ia = ({ rect: e, unit: t, secondary: n, late: r }) => {
	if (!t) return Fa(e) ? 0 : null;
	if (!Fa(t)) return null;
	let i = ka(t.top / innerHeight, 1) * 320;
	return Math.max(i - r, 0) + (n ? pa : 0);
}, La = { duration: 0 }, Ra = { order: "together" }, za = { order: Pa }, Ba = (e) => e.input || e.waited < 150 ? La : e.refetch ? {
	order: "together",
	duration: ua
} : null, Va = (e) => e.height < da || e.pieces <= fa ? Ra : { order: Ia }, Ha = {
	hold: 150,
	choose: (e) => Ba(e) ?? Va(e)
}, Ua = new Set(Ar), Wa = "script, noscript, template, base, meta, link", Ga = /* @__PURE__ */ new Set([
	"iframe",
	"object",
	"embed"
]), Ka = /* @__PURE__ */ new Set([
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
	_r
]), qa = (e) => e.replace(/[A-Z]/g, "X").replace(/[a-z]/g, "x").replace(/\d/g, "0");
function Ja(e, t) {
	let n = qa(t.data);
	t.data = n;
	let r = e.parentElement, i = oi();
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
function Ya(e) {
	for (let t of e.querySelectorAll(Wa)) t.remove();
	for (let t of e.querySelectorAll("*")) if (Ga.has(t.localName)) {
		let e = document.createElement("span");
		e.style.cssText = t.getAttribute("style") ?? "", e.style.display ||= "inline-block", t.replaceWith(e);
	} else {
		for (let { name: e, value: n } of [...t.attributes]) {
			let r = e.toLowerCase();
			(r.startsWith("on") || Ka.has(r) || r.endsWith("href") && /^\s*javascript:/i.test(n)) && t.removeAttribute(e);
		}
		t.localName === "img" && t.setAttribute("alt", "");
	}
	for (let t of e.querySelectorAll("video source, picture source")) t.remove();
}
function Xa(e, t) {
	let n = e.cloneNode(!0), r = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, i = document.createTreeWalker(e, r), a = document.createTreeWalker(n, r), o = [], s = [];
	for (; i.nextNode() && a.nextNode();) {
		let e = i.currentNode, n = a.currentNode;
		e.nodeType === Node.TEXT_NODE ? t && o.push([e, n]) : (Ua.has(e.localName) || Ga.has(e.localName)) && s.push([e, n]);
	}
	for (let [e, t] of s) {
		let n = e.getBoundingClientRect();
		t.style.boxSizing = "border-box", t.style.width = `${n.width}px`, n.width && n.height ? (t.style.maxWidth = "100%", t.style.height = "auto", t.style.aspectRatio = `${n.width} / ${n.height}`) : t.style.height = `${n.height}px`;
	}
	for (let [e, t] of o) Ja(e, t);
	return Ya(n), n.innerHTML;
}
function Za(e) {
	let t = document.createElement("template");
	return t.innerHTML = e, Ya(t.content), t.content;
}
var Qa = (e, t) => [...e.children].map((e) => {
	let n = [...e.classList].sort().join("."), r = t > 1 && e.firstElementChild ? `(${Qa(e, t - 1)})` : "";
	return `${e.localName}${n ? `.${n}` : ""}${r}`;
}).join(","), $a = (e) => {
	let t = 5381;
	for (let n = 0; n < e.length; n++) t = t * 33 ^ e.charCodeAt(n);
	return (t >>> 0).toString(36);
};
function eo(e) {
	let t = Qa(e, 2);
	return t ? `${location.pathname}|${$a(t)}` : null;
}
var to = !1;
try {
	to = !1;
} catch {
	to = !1;
}
var no = to, ro = /* @__PURE__ */ new Set();
function io(e, t) {
	!no || ro.has(e) || (ro.add(e), console.warn(`[skullet] ${t}`));
}
var ao = /^(https?:|\/|data:|blob:)/;
function oo(e) {
	return typeof e == "string" ? ao.test(e) ? "" : qa(e) : Array.isArray(e) ? e.map(oo) : e instanceof Date ? e : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).map(([e, t]) => [e, oo(t)])) : e;
}
var so = "skullet:shapes", co = 2, lo = 50, uo = 2e4, fo = /* @__PURE__ */ new Map(), po = /* @__PURE__ */ new Map();
function mo(e, t) {
	return po.has(e) || po.set(e, /* @__PURE__ */ new Set()), po.get(e).add(t), () => po.get(e)?.delete(t);
}
function ho(e) {
	for (let t of po.get(e) ?? []) t();
}
function go() {
	try {
		let e = JSON.parse(localStorage.getItem(so) ?? "null");
		return e?.v === co ? e.shapes : {};
	} catch {
		return {};
	}
}
function _o(e) {
	try {
		localStorage.setItem(so, JSON.stringify({
			v: co,
			shapes: e
		}));
	} catch {}
}
function vo(e, t) {
	fo.set(e, Xa(t, !1));
	let n = Xa(t, !0);
	if (n.length > uo) return;
	let r = go();
	delete r[e], r[e] = n;
	let i = Object.keys(r);
	for (let e of i.slice(0, i.length - lo)) delete r[e];
	_o(r);
}
function yo(e) {
	return fo.get(e) ?? go()[e] ?? null;
}
var bo = [
	100,
	90,
	60
].map((e) => `<div ${yr} style="width:${e}%;height:0.75em;margin:0.5em 0;border-radius:0.25em"></div>`).join(""), xo = new WeakSet(typeof document > "u" ? [] : document.querySelectorAll(`[${lr}]`)), So = /* @__PURE__ */ new WeakMap();
function Co(e) {
	if (!e) return;
	let t = So.get(e);
	return So.delete(e), t;
}
function wo(e, t) {
	for (let n of e.children) if (n.hasAttribute(t)) return n;
	let n = document.createElement("div");
	return n.setAttribute(t, ""), e.append(n), n;
}
var To = (e) => !!e.firstElementChild || !!e.textContent?.trim(), Eo = class {
	constructor(e, t = {}) {
		this.root = e, this.options = t, Ir(), e[br] = !0, e.setAttribute(lr, ""), e.setAttribute("aria-hidden", "true"), e.inert = !0, this.ghost = wo(e, ur), this.snapshot = wo(e, dr), this.layer = wo(e, fr), this.hadContent = To(this.ghost);
		let n = e.closest(`[${sr}]`);
		n && wa(n, {
			served: xo.has(e),
			refetch: !!t.refetch && this.hadContent
		}), this.choose(), this.measure(), e[xr]?.(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(this.ghost, {
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
		this.root.closest(`[${gr}]`) || (cancelAnimationFrame(this.frame), this.frame = requestAnimationFrame(() => {
			let e = To(this.ghost);
			e !== this.hadContent && (this.hadContent = e, this.choose()), this.measure();
		}));
	};
	choose() {
		let e = "fallback", t = null, n = this.options.exact || xo.has(this.root), r = !!this.ghost.querySelector(`[${vr}]`);
		if ((n || r) && this.hadContent) e = "ghost";
		else {
			let n = this.options.id ?? eo(this.ghost);
			n && (ho(n), t = yo(n)), t ? e = "recall" : this.hadContent && (e = "ghost");
		}
		e !== this.source && (e === "recall" && t ? this.snapshot.replaceChildren(Za(t)) : e === "fallback" ? (this.snapshot.innerHTML = bo, io(`fallback:${this.options.id}`, `Nothing to draw a skeleton from${this.options.id ? ` for "${this.options.id}"` : ""}. Pass \`sample\` data, or an \`id\` so its shape is remembered after the first load. For a lone placeholder box, use \`SkeletonBox\`.`)) : this.snapshot.replaceChildren()), this.ghost.toggleAttribute(hr, e !== "ghost"), this.snapshot.toggleAttribute(hr, e === "ghost"), this.source = e, Zr(this.root.closest(`[${sr}]`), e === "recall" ? "remembered shape" : e === "fallback" ? "fallback" : this.options.exact ? "data" : xo.has(this.root) ? "server render" : "sample");
	}
	measure() {
		let e = this.source === "ghost" ? this.ghost : this.snapshot;
		la(this.layer, Li(e, this.layer));
		let t = this.root.closest(`[${sr}]`);
		t && So.set(t, {
			width: this.root.offsetWidth,
			height: this.root.offsetHeight,
			guessed: !(this.options.exact && this.source === "ghost"),
			images: [...e.querySelectorAll("img")].map((e) => e.getBoundingClientRect().height)
		});
	}
	destroy() {
		cancelAnimationFrame(this.frame), this.mutations.disconnect(), this.resize?.disconnect(), this.root.removeEventListener("load", this.schedule, !0), removeEventListener("resize", this.schedule), Lr();
	}
}, Do = 250, Oo = class {
	constructor(e, t = {}) {
		this.element = e, this.options = t, this.key = t.id ?? eo(e), this.untrack = this.key ? mo(this.key, () => this.save()) : () => {}, (no || Yr(e)) && this.check(), this.save(), this.mutations = new MutationObserver(this.schedule), this.mutations.observe(e, {
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
		clearTimeout(this.timer), this.timer = setTimeout(() => this.save(), Do);
	};
	save() {
		clearTimeout(this.timer), this.key && this.element.isConnected && this.element.offsetHeight && vo(this.key, this.element);
	}
	check() {
		let { data: e, id: t, rendered: n, sample: r } = this.options, i = t ? `<Skeleton id="${t}">` : "<Skeleton>", a = this.element.closest(`[${sr}]`), o = Co(a);
		if (!o) return;
		o.guessed && n && !r && e != null && io(`sample:${this.key}`, `${i} has no \`sample\`, so a first load guesses its shape${t ? "" : " and it can't be remembered"}. Pass this to make it exact:
  sample={${JSON.stringify(oo(e))}}`);
		let s = [...this.element.querySelectorAll("img")].filter((e) => !e.complete);
		Promise.all(s.map((e) => new Promise((t) => {
			e.addEventListener("load", t, { once: !0 }), e.addEventListener("error", t, { once: !0 });
		}))).then(() => {
			if (!this.element.isConnected) return;
			let e = this.element.offsetWidth, t = this.element.offsetHeight;
			if (Qr(a, {
				width: e - o.width,
				height: t - o.height
			}), Math.abs(e - o.width) <= 1 && Math.abs(t - o.height) <= 1) return;
			let r = [...this.element.querySelectorAll("img")].filter((e, t) => (o.images[t] ?? 0) < 1 && e.getBoundingClientRect().height >= 1).map((e) => e.currentSrc.split("/").pop() || "an image");
			r.length ? io(`unsized:${this.key}`, `${i}'s skeleton had no room for ${r.length === 1 ? "an image" : `${r.length} images`} (${r.slice(0, 3).join(", ")}${r.length > 3 ? ", …" : ""}), so the layout jumped when they loaded. Give each \`width\` and \`height\` attributes, or an \`aspect-ratio\`, so its space is known before it loads.`) : io(`jump:${this.key}`, o.guessed ? `${i}'s skeleton was ${o.width}\xD7${o.height}px but its content is ${e}\xD7${t}px, so the layout jumped on reveal. ${n ? "Pass `sample` data shaped like the real thing" : "Pass an `id` so its shape is remembered"}, and give images a size.` : `${i}'s skeleton was drawn from the data on screen (${o.width}\xD7${o.height}px), but the new data is ${e}\xD7${t}px, so the layout jumped on reveal. When new data adds to what's shown \u2014 another page of a list \u2014 give the addition a reveal of its own.`);
		});
	}
	destroy() {
		this.save(), clearTimeout(this.timer), this.mutations.disconnect(), this.resize?.disconnect(), this.element.removeEventListener("load", this.schedule, !0), this.untrack();
	}
}, ko = () => {}, Ao = (e) => {
	if (e.loading !== "lazy") return !1;
	let t = e.getBoundingClientRect();
	return t.bottom < -innerHeight || t.top > innerHeight * 2;
}, jo = (e) => [...e.querySelectorAll("img")].filter((e) => !e.complete && !Ao(e));
function Mo(e) {
	let t = e.complete ? Promise.resolve() : new Promise((t) => {
		e.addEventListener("load", () => t(), { once: !0 }), e.addEventListener("error", () => t(), { once: !0 });
	});
	return Promise.race([t.then(() => e.decode?.()).then(ko, ko), new Promise((e) => setTimeout(e, Dr))]);
}
var No = 360, Po = 2, Fo = 600, Io = 40, Lo = Io / ea, Ro = 320, zo = 120, Bo = .45, Vo = (e) => e.left + e.top * $i, Ho = (e) => e.width + e.height * $i, Uo = (e, t) => Vo(t) - Lo + (Ho(t) + 2 * Lo) * e, Wo = {
	start: -1 / 0,
	origin: 0,
	speed: 1
};
function Go(e) {
	let t = e.querySelector(`:scope > [${gr}] [${fr}]`), n = t && oa(t);
	if (!n) return null;
	let r = Oa(e);
	if (r.width * r.height > innerWidth * innerHeight * ga) return null;
	let i = Vo(r), a = i + Ho(r), o = performance.now(), s = o - Wo.start;
	s <= ma && (i - Wo.origin) / Wo.speed >= s && (a - Wo.origin) / Wo.speed - s <= Fo || (Wo = {
		start: o,
		origin: i,
		speed: Math.max(Po / n, (a - i) / No)
	});
	let { start: c, origin: l, speed: u } = Wo;
	return {
		delay: (i - Lo - l) / u - (o - c),
		duration: (a - i + 2 * Lo) / u
	};
}
var Ko = (e) => (t, { rect: n, reveal: r }) => {
	let i = (Uo(t, r) - Vo(n)) * ea;
	return `linear-gradient(${ta}, ${Array.from({ length: $ + 1 }, (t, n) => {
		let r = e ? 1 - ra(n / $) : ra(n / $), a = -Io + 2 * Io * n / $;
		return `rgb(0 0 0 / ${r.toFixed(3)}) ${(i + a).toFixed(2)}px`;
	}).join(", ")})`;
}, qo = "http://www.w3.org/2000/svg", Jo = null, Yo = 0;
function Xo() {
	return Jo?.isConnected || (Jo = document.createElementNS(qo, "svg"), Jo.setAttribute("aria-hidden", "true"), Jo.style.cssText = "position:absolute;width:0;height:0;overflow:hidden", document.body.append(Jo)), Jo;
}
var Zo = (e, t) => {
	let n = document.createElementNS(qo, e);
	for (let [e, r] of Object.entries(t)) n.setAttribute(e, String(r));
	return n;
}, Qo = {
	mask: Ko(!0),
	out: Ko(!1),
	effect: (e, { rect: t, reveal: n, progress: r }) => {
		if (Vi()) return;
		let i = Vo(t), a = Ho(t), o = Ro / 2 / ea, s = () => Uo(r(), n) - i - zo / ea;
		if (s() - o > a) return;
		let c = 2 * o + t.height * $i, l = c / 2, u = t.height / 2, d = Ro / 2 * ea, f = Ro / 2 * $i * ea, p = document.createElement("canvas");
		p.width = Math.ceil(c), p.height = Math.ceil(t.height);
		let m = p.getContext("2d");
		if (!m) return;
		let h = m.createLinearGradient(l - d, u - f, l + d, u + f);
		for (let e = 0; e <= $; e++) {
			let t = e / $;
			h.addColorStop(t, `rgb(255 255 255 / ${ra(1 - Math.abs(t * 2 - 1)).toFixed(3)})`);
		}
		m.fillStyle = h, m.fillRect(0, 0, p.width, p.height);
		let g = `skullet-gloss-${++Yo}`, _ = Zo("filter", {
			id: g,
			"color-interpolation-filters": "sRGB",
			primitiveUnits: "objectBoundingBox"
		}), v = Zo("feComponentTransfer", {
			in: "SourceGraphic",
			result: "lit"
		});
		for (let e of [
			"R",
			"G",
			"B"
		]) v.append(Zo(`feFunc${e}`, {
			type: "linear",
			slope: 1 - Bo,
			intercept: Bo
		}));
		let y = Zo("feImage", {
			href: p.toDataURL(),
			y: 0,
			width: c / t.width,
			height: 1,
			preserveAspectRatio: "none",
			result: "band"
		});
		_.append(v, y, Zo("feComposite", {
			in: "lit",
			in2: "band",
			operator: "in",
			result: "shine"
		}), Zo("feComposite", {
			in: "shine",
			in2: "SourceGraphic",
			operator: "over"
		})), Xo().append(_), e.style.filter = `url(#${g})`;
		let ee = () => {
			let n = s();
			n - o > a || !e.isConnected ? (e.style.filter.includes(g) && (e.style.filter = ""), _.remove()) : (y.setAttribute("x", ((n - l - u * $i) / t.width).toFixed(4)), requestAnimationFrame(ee));
		};
		ee();
	}
}, $o = {
	together: Ra,
	sequence: za,
	smart: Ha,
	sweep: {
		hold: 150,
		choose: (e) => {
			let t = Ba(e);
			if (t) return t;
			let n = Go(e.reveal);
			return n ? {
				wipe: Qo,
				...n
			} : Va(e);
		}
	}
}, es = (e = "smart") => typeof e == "string" ? $o[e] : e, ts = () => {}, ns = (e) => e.finished.then(ts, ts), rs = /* @__PURE__ */ new WeakMap();
function is(e, t = 0, n = 200, r = 0, i) {
	return Bi() ? Promise.resolve() : ns(e.animate([{
		...i,
		opacity: r
	}, { opacity: 1 }], {
		duration: n,
		delay: t,
		easing: "ease",
		fill: "backwards"
	}));
}
var as = (e) => !!e.querySelector(`[${fr}], [${ur}], :scope > [${vr}]`), os = (e, t) => Math.abs(e.left - t.left) < 2 && Math.abs(e.top - t.top) < 2 && Math.abs(e.width - t.width) < 2 && Math.abs(e.height - t.height) < 2, ss = /* @__PURE__ */ new WeakMap();
function cs(e) {
	for (let t of ss.get(e) ?? []) t.remove();
	ss.delete(e);
}
function ls(e, t) {
	let n = jo(e), r = [...t.children].some((t) => t !== e && t.hasAttribute("skullet-pane") && as(t));
	if (n.length && r) {
		for (let e of n) e.style.opacity = "0";
		queueMicrotask(() => {
			if (!e.isConnected) return;
			let r = t.getBoundingClientRect(), i = [...t.querySelectorAll(`:scope > [${gr}] [${fr}]`)].flatMap(ca), a = ss.get(t) ?? /* @__PURE__ */ new Set();
			ss.set(t, a);
			for (let e of n) {
				let n = e.getBoundingClientRect(), o = i.find((e) => os(e.getBoundingClientRect(), n)), s = o?.getBoundingClientRect() ?? n, c = document.createElement("div");
				c.setAttribute(pr, ""), Object.assign(c.style, {
					position: "absolute",
					left: `${s.left - r.left - t.clientLeft}px`,
					top: `${s.top - r.top - t.clientTop}px`,
					width: `${s.width}px`,
					height: `${s.height}px`,
					borderRadius: o?.style.borderRadius || getComputedStyle(e).borderRadius,
					backgroundColor: wr,
					backgroundRepeat: "no-repeat",
					pointerEvents: "none"
				}), t.append(c), a.add(c), o && (o.style.visibility = "hidden"), aa(c), Mo(e).then(() => {
					if (a.has(c)) {
						if (a.delete(c), e.style.opacity = "", is(e), Bi()) return c.remove();
						ns(c.animate([{ opacity: 1 }, { opacity: 0 }], {
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
function us(e, t) {
	return Bi() ? Promise.resolve() : Promise.all(Ta(e).map((e) => {
		let n = t.pieceDelay(e);
		if (n !== null) return is(e, n, t.duration, 0, t.enter);
	})).then(ts);
}
function ds(e) {
	for (let t of e.querySelectorAll(`:scope > [${gr}]`)) {
		for (let e of Hi(t)) e.finish();
		t.style.opacity = "0";
	}
}
function fs(e) {
	let t = 0;
	for (let n of e.querySelectorAll(`:scope > [${gr}]`)) if (!as(n)) {
		t = Math.max(t, parseFloat(getComputedStyle(n).opacity) || 0);
		for (let e of Hi(n)) e.finish();
		n.style.opacity = "0";
	}
	return t;
}
function ps(e, t = "smart", { initial: n = !1 } = {}) {
	let r = ms.get(e);
	return r || (r = hs(e, t, n), ms.set(e, r)), r;
}
var ms = /* @__PURE__ */ new WeakMap();
function hs(e, t, n) {
	let r = e.parentElement, i = es(t);
	if (as(e)) {
		r && cs(r);
		let t = Math.max(i.hold ?? 0, 0);
		return t ? (r && rs.set(r, {
			kind: "skeleton",
			hold: t
		}), n ? Promise.resolve() : is(e, t)) : (r && rs.delete(r), n ? Promise.resolve() : is(e));
	}
	if (n || !r) return Promise.resolve();
	let a = fs(r);
	if (a > .01) {
		let t = 200 * (1 - a);
		return rs.set(r, {
			kind: "together",
			delay: 0,
			duration: t
		}), is(e, 0, t, a);
	}
	ls(e, r);
	let o = Na(e, r, i, (e) => io(`enter:${e}`, `\`enter\` can't set \`${e}\`: only properties that change nothing's layout animate, so the reveal never moves the page.`));
	return rs.set(r, o), o.kind === "instant" ? (ds(r), Promise.resolve()) : o.kind === "sequence" ? us(e, o) : o.kind === "wipe" ? Os(e, o, !0) : is(e, o.delay, o.duration, 0, o.enter);
}
function gs(e) {
	let t = e.getBoundingClientRect(), n = e.offsetParent ?? document.documentElement, r = n.getBoundingClientRect();
	return {
		top: t.top - r.top - n.clientTop,
		left: t.left - r.left - n.clientLeft,
		width: t.width,
		height: t.height
	};
}
function _s(e, t = gs(e)) {
	return Object.assign(e.style, {
		position: "absolute",
		top: `${t.top}px`,
		left: `${t.left}px`,
		width: `${t.width}px`,
		height: `${t.height}px`,
		margin: "0",
		boxSizing: "border-box",
		pointerEvents: "none"
	}), e.inert = !0, e.setAttribute(gr, ""), t;
}
var vs = /* @__PURE__ */ new WeakMap();
function ys(e, t) {
	let n = e.querySelector(`:scope > [${cr}]:not([${gr}])`);
	if (!n) return;
	let r = vs.get(e), i = e.getBoundingClientRect().height;
	r?.animation.cancel();
	let a = e.getBoundingClientRect().height, o = r ? i : a - n.getBoundingClientRect().height + t.height;
	if (Math.abs(o - a) < .5) {
		r && bs(e, r);
		return;
	}
	let { overflow: s, boxSizing: c } = r ?? e.style;
	Object.assign(e.style, {
		overflow: "clip",
		boxSizing: "border-box"
	});
	let l = e.animate([{ height: `${o}px` }, { height: `${a}px` }], {
		duration: Er,
		easing: "cubic-bezier(0.2, 0, 0, 1)"
	}), u = {
		animation: l,
		overflow: s,
		boxSizing: c
	};
	vs.set(e, u), ns(l).then(() => {
		vs.get(e) === u && bs(e, u);
	});
}
function bs(e, { overflow: t, boxSizing: n }) {
	vs.delete(e), Object.assign(e.style, {
		overflow: t,
		boxSizing: n
	});
}
function xs(e, t) {
	let n = parseFloat(getComputedStyle(e).opacity), r = Number.isNaN(n) ? 1 : n;
	for (let t of Hi(e)) t.cancel();
	Ds(e), e.style.filter = "";
	let i = e.parentElement;
	i && !as(e) && cs(i);
	let a = _s(e, t), o = (t, n) => zi() ? ns(e.animate([{ opacity: r }, { opacity: 0 }], {
		duration: n * r,
		delay: t,
		easing: "ease",
		fill: "forwards"
	})) : (e.style.opacity = "0", Promise.resolve());
	return Promise.resolve().then(() => {
		let t = i && rs.get(i), n = Bi() || t?.kind === "instant";
		if (i && !n && ys(i, a), t?.kind === "skeleton") return o(t.hold, 200);
		if (n) e.style.opacity = "0";
		else return t?.kind === "sequence" && as(e) ? Ss(e, t) : t?.kind === "wipe" && as(e) ? Os(e, t, !1) : t?.kind === "together" ? o(t.delay, t.duration) : o(0, 200);
	});
}
function Ss(e, t) {
	for (let t of e.querySelectorAll(`[${ur}], [${dr}]`)) t.style.visibility = "hidden";
	let n = [...e.querySelectorAll(`[${ur}] [${vr}]`)].filter((e) => !e.parentElement?.closest(`[${vr}]`));
	for (let e of n) e.style.visibility = "visible";
	let r = [...[...e.querySelectorAll(`[${fr}]`)].flatMap(ca), ...n];
	return Promise.all(r.map((e) => {
		let n = e.getBoundingClientRect(), r = (n) => ns(e.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: t.duration,
			delay: n,
			easing: "ease",
			fill: "forwards"
		})), i = t.boneDelay(n);
		if (i === null) e.style.opacity = "0";
		else return r(i);
	})).then(ts);
}
var Cs = 100, ws = /* @__PURE__ */ new WeakMap();
function Ts(e, t) {
	e.style.setProperty("mask-image", t), e.style.setProperty("-webkit-mask-image", t);
}
function Es(e, t) {
	Ts(e, `linear-gradient(#000 0 0), ${t}`), e.style.setProperty("-webkit-mask-composite", "xor"), e.style.setProperty("mask-composite", "exclude");
}
function Ds(e) {
	ws.get(e)?.();
	for (let t of [
		"mask-image",
		"-webkit-mask-image",
		"mask-composite",
		"-webkit-mask-composite"
	]) e.style.removeProperty(t);
}
function Os(e, t, n) {
	let r = {
		rect: e.getBoundingClientRect(),
		reveal: t.reveal
	}, { mask: i, out: a } = t.wipe, o = (t) => {
		n ? Ts(e, i(t, r)) : a ? Ts(e, a(t, r)) : Es(e, i(t, r));
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
			if (e - i > Cs && (t.stalled = !0), i = e, t.stalled) return l(a);
			a = Math.min(Math.max(s(), 0), 1), o(a), a < 1 ? r = requestAnimationFrame(c) : l(null);
		}, l = (t = null) => {
			cancelAnimationFrame(r), clearTimeout(u), ws.delete(e), n(t);
		}, u = setTimeout(() => l(null), Math.max(t.start + t.duration - performance.now(), 0) + Cs);
		ws.set(e, l), c();
	}).then((t) => {
		if (Ds(e), t === null) {
			n || (e.style.opacity = "0");
			return;
		}
		let r = 200 * (1 - t);
		return n ? is(e, 0, r, t) : ns(e.animate([{ opacity: 1 - t }, { opacity: 0 }], {
			duration: r,
			easing: "ease",
			fill: "forwards"
		})).then(() => {
			e.style.opacity = "0";
		});
	}));
}
// node_modules/skullet/dist/react/index.mjs
var ks = Z.createContext({}), As = Z.createContext(null), js = () => Z.useContext(ks), Ms = () => Z.useContext(As), Ns = () => js().reveal;
function Ps({ children: e, ...t }) {
	let { debug: n, theme: r, mode: i, text: a, nonce: o } = t, s = Hr({
		theme: r,
		mode: i,
		text: a
	}), [c] = Z.useState(() => ({ sent: !1 }));
	return Z.useEffect(() => {
		n !== void 0 && Xr(n);
	}, [n]), (0, Q.jsx)(ks.Provider, {
		value: t,
		children: (0, Q.jsxs)(As.Provider, {
			value: c,
			children: [s && (0, Q.jsx)("style", {
				nonce: o,
				children: s
			}), e]
		})
	});
}
var Fs = typeof window > "u" ? Z.useEffect : Z.useLayoutEffect, Is = () => Z.useInsertionEffect(() => (Ir(), Lr), []), Ls = Number("19.3.1".split(".")[0]) >= 19, Rs = () => {
	let { nonce: e } = js();
	return Ls ? (0, Q.jsx)("style", {
		href: "skullet",
		precedence: "medium",
		nonce: e,
		children: Mr
	}) : null;
}, zs = Ls ? { inert: !0 } : { inert: "" }, Bs = (e) => Z.Children.map(e, (e) => {
	if (!Z.isValidElement(e)) return e;
	let t = e.type.Skeleton;
	return t ? (0, Q.jsx)("span", {
		[vr]: "",
		children: (0, Q.jsx)(t, { ...e.props })
	}) : e.props.children && typeof e.props.children != "function" ? Z.cloneElement(e, void 0, Bs(e.props.children)) : e;
}), Vs = () => () => {}, Hs = () => Z.useSyncExternalStore(Vs, () => !1, () => !0), Us = ({ children: e, id: t, exact: n, refetch: r, label: i }) => {
	let a = Z.useRef(null), { nonce: o } = js(), s = Ms(), c = Hs(), l = Rr;
	return c && s && (s.sent && (l = "(s=>{let k=Symbol.for(\"skullet.boot\"),b=self[k];typeof b==\"function\"?b(s):(self[k]=b||[]).push(s)})(document.currentScript)"), s.sent = !0), Fs(() => {
		if (!a.current) return;
		let e = new Eo(a.current, {
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
			[lr]: "",
			"aria-hidden": !0,
			...zs,
			children: [
				(0, Q.jsx)("div", {
					[ur]: "",
					children: Bs(e)
				}),
				(0, Q.jsx)("div", { [dr]: "" }),
				(0, Q.jsx)("div", { [fr]: "" })
			]
		}),
		c && (0, Q.jsx)("script", {
			nonce: o,
			suppressHydrationWarning: !0,
			dangerouslySetInnerHTML: { __html: l }
		})
	] });
}, Ws = ({ children: e, id: t, registry: n, enter: r, exiting: i, onExited: a, memory: o, onEntered: s }) => {
	let c = Z.useRef(null), l = Ns();
	return Fs(() => {
		if (!c.current) return;
		let e = {
			element: c.current,
			memory: null
		};
		return n.set(t, e), ps(c.current, l, { initial: !r }).then(s), o && (e.memory = new Oo(c.current, o)), () => {
			e.memory?.destroy(), n.delete(t);
		};
	}, []), Fs(() => {
		!i || !c.current || xs(c.current, n.get(t)?.box).then(a);
	}, [i]), (0, Q.jsx)("div", {
		ref: c,
		[cr]: "",
		children: e
	});
}, Gs = class extends Z.Component {
	getSnapshotBeforeUpdate(e) {
		for (let t of this.props.exiting) {
			if (e.exiting.includes(t)) continue;
			let n = this.props.registry.get(t);
			n && (n.memory?.save(), n.box = gs(n.element));
		}
		return null;
	}
	componentDidUpdate() {}
	render() {
		return this.props.children;
	}
};
function Ks(e) {
	let { id: t, label: n, skeleton: r, empty: i, emptyMessage: a, error: o, className: s, style: c } = e;
	Is();
	let l = typeof e.children == "function" ? e.children : null, u = l ? e.data : void 0, d = l ? e.sample : void 0, f = l ? null : e.children, p = Z.useRef(null);
	Fs(() => {
		u != null && (p.current = {
			id: t,
			data: u
		});
	});
	let m = (e) => l ? e == null ? null : l(e) : f, h = !!e.loading || !!l && u == null && !o && !i, g, _, v;
	if (h) {
		let e = p.current, i = u ?? (e && e.id === t ? e.data : null);
		g = "skeleton", _ = r ? (0, Q.jsx)("div", {
			[vr]: "",
			"aria-hidden": !0,
			children: r
		}) : (0, Q.jsx)(Us, {
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
	if (Fs(() => {
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
	Fs(() => {
		w.current = e.onReveal;
	});
	let T = y.key === "content" && y.from === "skeleton" ? () => w.current?.() : void 0, E = (e) => x((t) => t.filter((t) => t.id !== e)), D = [...b.map((e) => (0, Q.jsx)(Ws, {
		id: e.id,
		registry: S,
		enter: !1,
		exiting: !0,
		onExited: () => E(e.id),
		children: e.node
	}, e.id)), (0, Q.jsx)(Ws, {
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
		[sr]: "",
		"aria-busy": g === "skeleton" || void 0,
		className: s,
		style: c,
		children: [(0, Q.jsx)(Rs, {}), (0, Q.jsx)(Gs, {
			exiting: b.map((e) => e.id),
			registry: S,
			children: D
		})]
	});
}
// src/react/follow-manage/measured-reading.tsx
var qs = {
	creators: [X("follow:followOverview.creators"), X("follow:followOverview.creatorUnit")],
	enabled: [X("follow:followOverview.enabledSources"), ""],
	failed: [X("follow:followCheck.checkFailed"), X("follow:followOverview.sourceUnit")],
	updates: [X("follow:followOverview.unwatchedUpdates"), X("follow:followOverview.itemUnit")],
	subscriptions: [X("follow:feedSources.footerLabel"), X("follow:followOverview.actressUnit")],
	releases: [X("follow:followOverview.unwatchedReleases"), X("follow:followOverview.itemUnit")]
}, Js = {
	duration: 0,
	delay: 0,
	hold: 150
}, Ys;
function Xs() {
	return Ys || (Ys = new CSSStyleSheet(), Ys.replaceSync("\n      @keyframes peach-skeleton-sweep { to { transform: translateX(-50%); } }\n      [skullet-rect] { overflow: hidden; }\n      [skullet-rect]::after {\n        content: ''; position: absolute; inset: 0; right: -200%; border-radius: inherit;\n        background: linear-gradient(to right, var(--skullet-base), var(--skullet-highlight) 50%, var(--skullet-base));\n        background-size: 50% 100%; animation: peach-skeleton-sweep 1.5s ease-in-out infinite reverse;\n      }\n      @media (prefers-reduced-motion: reduce) { [skullet-rect]::after { animation: none; } }\n    ")), Ys;
}
function Zs({ figure: e, unit: t }) {
	return /* @__PURE__ */ (0, Q.jsxs)("b", {
		"data-follow-reading": "",
		className: `flex min-w-0 flex-wrap items-baseline gap-x-1 tabular-nums text-text-primary ${e >= 1e6 ? "text-headline-medium" : e >= 1e5 ? "text-title-3-medium" : "text-title-1-medium"}`,
		children: [/* @__PURE__ */ (0, Q.jsx)("span", { children: e.toLocaleString() }), /* @__PURE__ */ (0, Q.jsx)("small", {
			className: "whitespace-nowrap text-body-2-regular text-text-secondary",
			children: ` ${t}`
		})]
	});
}
function Qs({ field: e, figure: t, total: n, failed: r = !1 }) {
	let [i, a] = qs[e], o = (0, Z.useRef)(null);
	return (0, Z.useLayoutEffect)(() => {
		let e = [...o.current.querySelectorAll("[skullet-layer]")].map((e) => e.shadowRoot).filter((e) => !!e);
		if (!e.length) return;
		let t = Xs();
		for (let n of e) n.adoptedStyleSheets = [...n.adoptedStyleSheets, t];
		return () => {
			for (let n of e) n.adoptedStyleSheets = n.adoptedStyleSheets.filter((e) => e !== t);
		};
	}, [t, r]), /* @__PURE__ */ (0, Q.jsxs)("div", {
		ref: o,
		"data-measured-reading": e,
		className: De({
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
		}) : /* @__PURE__ */ (0, Q.jsx)(Ps, {
			reveal: Js,
			children: /* @__PURE__ */ (0, Q.jsx)(Ks, {
				id: `peach:follow-reading:v1:${e}`,
				data: t,
				sample: 12345,
				label: X("follow:followOverview.loading", { term: i }),
				children: (t) => /* @__PURE__ */ (0, Q.jsx)(Zs, {
					figure: t,
					unit: e === "enabled" ? `/ ${n ?? 0}` : a
				})
			})
		})]
	});
}
// src/react/follow-manage/follow-manage-page.tsx
var $s = (e) => te.some(([t]) => t === e);
function ec(e) {
	let { route: t, savePreference: n, toast: r, openFollow: i, readOnly: a, readOnlyMessage: o, writerUrl: s } = e, [c, l] = (0, Z.useState)($s(e.tab) ? e.tab : "list"), [u, f] = (0, Z.useState)(Math.max(1, Math.floor(e.page) || 1)), [p, m] = (0, Z.useState)(() => Dt(e.sort, e.dir).sort), [h, g] = (0, Z.useState)(() => Dt(e.sort, e.dir).dir), [_, v] = (0, Z.useState)(ot(e.layout) ? e.layout : "default"), [y, ee] = (0, Z.useState)(ht(e.pageSize)), [b, x] = (0, Z.useState)(/* @__PURE__ */ new Set()), [S, C] = (0, Z.useState)(/* @__PURE__ */ new Set());
	Jt(() => {
		x(/* @__PURE__ */ new Set()), C(/* @__PURE__ */ new Set());
	}), (0, Z.useEffect)(() => {
		(b.size || S.size) && Ge();
	}, [b, S]);
	let w = Yt({
		queryKey: A,
		queryFn: ({ signal: e }) => Ze(e)
	}), D = Yt({
		queryKey: k,
		queryFn: ({ signal: e }) => Xe(e)
	}), O = Yt({
		queryKey: E,
		queryFn: ({ signal: e }) => J(e)
	}), j = w.data || { sources: [] }, M = D.data || {
		root: "",
		providers: []
	}, N = j.sources;
	(0, Z.useEffect)(() => {
		x((e) => {
			let t = lt(e, N);
			return t.size === e.size ? e : t;
		});
	}, [N]);
	let P = (e) => {
		let n = e.sort ?? p, r = e.dir ?? h;
		t({
			tab: e.tab ?? c,
			page: e.page ?? u,
			sort: n === "checked" ? "" : n,
			dir: r === H[n] ? "" : r
		});
	}, F = it(N), I = N.filter(at).length, L = N.filter((e) => e.enabled).length, R = (M.providers || []).filter((e) => e.requirement === "required" && !Be(e)).length, ne = new Set((O.data?.sources || []).map((e) => e.entity_id ?? `source-${e.id}`)).size;
	return /* @__PURE__ */ (0, Q.jsxs)($t, { children: [
		a ? /* @__PURE__ */ (0, Q.jsx)(B, {
			tone: "warning",
			title: X("follow:followManagePage.readOnly"),
			extra: s ? /* @__PURE__ */ (0, Q.jsx)("p", {
				className: "text-body-2-regular",
				children: /* @__PURE__ */ (0, Q.jsx)(T, {
					href: s,
					children: X("follow:followManagePage.goToPrimary")
				})
			}) : void 0,
			children: o
		}) : null,
		/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: ae,
			"aria-label": X("follow:followManagePage.overview"),
			children: [
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "creators",
					figure: w.data ? F.length : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "enabled",
					figure: w.data ? L : void 0,
					total: N.length,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "failed",
					figure: w.data ? I : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "updates",
					figure: w.data ? j.counts?.new || 0 : void 0,
					failed: w.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "subscriptions",
					figure: O.data ? ne : void 0,
					failed: O.isError
				}),
				/* @__PURE__ */ (0, Q.jsx)(Qs, {
					field: "releases",
					figure: O.data ? O.data.unread || 0 : void 0,
					failed: O.isError
				})
			]
		}),
		/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, Q.jsx)("div", {
					"data-section-nav": !0,
					children: /* @__PURE__ */ (0, Q.jsx)(de, {
						group: "follow",
						label: X("follow:followManagePage.sectionTabs"),
						value: c,
						panelPrefix: "follow",
						sectionItems: !0,
						tabs: te.map(([e, t]) => ({
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
					children: [/* @__PURE__ */ (0, Q.jsx)(Zn, {
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
					}), w.data ? /* @__PURE__ */ (0, Q.jsx)(or, {
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
					}) : w.isError ? /* @__PURE__ */ (0, Q.jsx)(B, {
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
						D.data && w.data ? /* @__PURE__ */ (0, Q.jsx)(bn, {
							data: j,
							credentials: M,
							readOnly: a,
							toast: r
						}) : D.isError || w.isError ? /* @__PURE__ */ (0, Q.jsx)(B, {
							tone: "error",
							children: X("follow:followManagePage.credentialsFailed")
						}) : /* @__PURE__ */ (0, Q.jsx)("div", {
							role: "status",
							"aria-label": X("follow:followManagePage.credentialsLoading"),
							"data-skeleton": "",
							className: "skeleton-sheen h-32 rounded-lg"
						}),
						/* @__PURE__ */ (0, Q.jsx)(Tn, {
							readOnly: a,
							toast: r,
							onAdded: () => {
								O.refetch(), l("list"), P({ tab: "list" });
							}
						}),
						w.data ? /* @__PURE__ */ (0, Q.jsx)(Rn, {
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
export { ec as FollowManagePage };

//# debugId=61f09cbb-10ee-4c70-92f9-b22a800bcd14