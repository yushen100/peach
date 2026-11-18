(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "ae8f3d25-afce-4696-ab6f-bb14e9b2884f", e._sentryDebugIdIdentifier = "sentry-dbid-ae8f3d25-afce-4696-ab6f-bb14e9b2884f");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, $fe21c36db05242bb$export$d7b12c4107be0d61 as a, ActivityMotion as o, ArtSlot as s, Button as c, ButtonLink as l, Bx as u, COVER_STATE_TITLE as d, CatalogColumnFilterChips as f, CatalogViewToggle as p, Checkbox as m, ChevronSortDown as h, Chip as g, CloudDownloadDialog as _, ColumnFilterAvatar as v, CoverQueue as y, DISCOVERY_METADATA_KEY as b, DISCOVERY_SORTS as x, DOWNLOADS_KEY as S, DOWNLOADS_URL as C, DataTableFooter as w, DataTableFrame as T, E3 as E, EmptyFocusButton as D, EmptyState as ee, FilterActionButton as O, FilterGlassRows as k, FilterIconButton as A, FilterPill as te, Gg as j, H7 as M, IndexSearch as N, Input as ne, JAV_LAYOUTS as re, JAV_RECOMMENDATION_GRID as ie, JAV_SELECTION_EVENT as ae, JZ as P, JavHeader as F, LibraryShortcuts as I, M6 as L, Note as R, PHASES as oe, RELEASE_COLUMN_VISIBILITY_KEY as z, RELEASE_COLUMN_WIDTHS_KEY as B, RELEASE_PAGE_SIZES as se, RELEASE_SORTS as V, RELEASE_SORT_COLUMNS as H, SEGMENT as ce, SEGMENTED_TRACK as U, ScrapeSourceLabel as W, SegmentedRadioGroup as G, Segments as le, SelectionDock as K, Shuffle as ue, SortKeys as de, SourceAvatar as q, Table as fe, TableColumnControls as pe, TableColumnFilter as me, TableColumnRange as he, TableColumnResizer as ge, TaskProgress as _e, WANTS_KEY as ve, WantMagnets as ye, Wt as be, __toESM as xe, activityKind as Se, addWant as Ce, apiGet as we, appSettingsStore as Te, avatarInner as Ee, busyProps as J, cachedMagnetStates as De, cardClass as Oe, cardRatio as ke, catalogListSkeletonCellHtml as Ae, columnRangeKinds as je, columnValueSelected as Me, composingKey as Ne, controlDiscoveryMetadata as Pe, controlReleaseMetadata as Fe, coverArrived as Ie, coverFetching as Le, coverFetchingHtml as Re, coverReason as ze, coverStateAction as Be, coverUrl as Ve, discoveryArtwork as He, discoveryKey as Ue, discoveryScore as We, entityDisplayName as Ge, entityFaceImg as Ke, entityPath as qe, entityWriting as Je, errorMessage as Ye, esc as Xe, facePos as Ze, fetchCoverNow as Qe, fetchDiscoveries as $e, fetchDiscoveryMetadata as et, fetchReleaseColumn as tt, fetchReleases as nt, fetchWants as rt, firstGrapheme as it, fmtDur as at, gridLayout as ot, invalidateWants as Y, javContentSkeleton as st, javLayout as ct, javTagSkeleton as lt, jobText as ut, joinList as dt, keepPreviousData as ft, lastSearchNote as pt, leadingGraphemes as mt, logoUrl as ht, metadataInterval as gt, pageWindow as _t, pv as vt, qE as yt, queryClient as bt, readColumnFilters as xt, recommendationScore as St, relayoutCovers as Ct, releaseColumnSelection as wt, releaseColumnValues as Tt, releaseColumns as Et, releaseDateQuery as Dt, releaseFilters as Ot, releaseKey as kt, removeWants as At, require_jsx_runtime as jt, require_react as Mt, resetWants as Nt, resourceSourceKey as Pt, restoreWants as Ft, searchNote as It, selectRange as Lt, selectionSummary as Rt, serverLabelList as zt, setReleaseColumn as Bt, spriteGlyph as Vt, storeJavLayout as Ht, suppressShiftTextSelection as Ut, t as X, textLang as Wt, tierPlaceholdersHtml as Gt, toggleColumnValue as Kt, useAction as qt, useCatalogView as Jt, useDense as Yt, useEntityNames as Xt, useQuery as Zt, useTablePreferences as Qt, useWorkContextMenu as $t, wantName as en, wantsInterval as tn, wireHorizontalScroller as nn, writeColumnFilters as rn, writeJavQuery as Z } from "./peach-app.js";
import { JavBatchResources as an } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
import { ErrorLine as on } from "./peach-app.source-view-CDbKpFus.js";
// src/react/jav/jav-selection.tsx
var Q = /* @__PURE__ */ xe(Mt(), 1), $ = jt(), sn = (0, Q.createContext)(null), cn = () => (0, Q.useContext)(sn);
function ln(e) {
	let t = cn()?.visible;
	(0, Q.useEffect)(() => {
		t?.(e);
	}, [e, t]);
}
function un({ children: e, readOnly: t, receipt: n, dock: r = !0 }) {
	let i = Yt(), [a, o] = (0, Q.useState)(!1), [s, l] = (0, Q.useState)(/* @__PURE__ */ new Map()), [u, d] = (0, Q.useState)([]), [f, p] = (0, Q.useState)(null), m = (0, Q.useRef)(null), h = new Set(s.keys()), g = Rt(h, u.map((e) => e.code)), _ = (0, Q.useCallback)((e) => {
		d((t) => t.length === e.length && t.every((t, n) => t === e[n]) ? t : e), l((t) => {
			let n = e.filter((e) => t.has(e.code) && t.get(e.code) !== e);
			return n.length ? new Map([...t, ...n.map((e) => [e.code, e])]) : t;
		});
	}, []), v = (0, Q.useCallback)(() => {
		o(!1), l(/* @__PURE__ */ new Map()), m.current = null;
	}, []), y = () => l((e) => {
		let t = new Map(e);
		return u.forEach((e) => g.all ? t.delete(e.code) : t.set(e.code, e)), t;
	});
	(0, Q.useEffect)(() => {
		let e = () => {
			a ? v() : o(!0);
		};
		return window.addEventListener(ae, e), () => window.removeEventListener(ae, e);
	}, [a, v]), (0, Q.useEffect)(() => (a || (l(/* @__PURE__ */ new Map()), m.current = null), document.getElementById("selectMode")?.setAttribute("aria-pressed", String(a)), () => document.getElementById("selectMode")?.setAttribute("aria-pressed", "false")), [a]), (0, Q.useEffect)(() => {
		if (!a) return;
		let e = (e) => {
			e.target.closest("input,textarea,[contenteditable]:not([contenteditable=\"false\"]),[role=\"dialog\"]") || (e.key === "Escape" && (e.preventDefault(), v()), (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && (e.preventDefault(), l((e) => new Map([...e, ...u.map((e) => [e.code, e])]))));
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [
		a,
		v,
		u
	]);
	let b = (e, t = !1) => {
		o(!0);
		let n = m.current;
		m.current = e.code, l((r) => {
			let i = new Set(r.keys());
			Lt(i, u.map((e) => e.code), n, e.code, t);
			let a = new Map([
				...r,
				...u.map((e) => [e.code, e]),
				[e.code, e]
			]);
			return new Map([...i].map((e) => [e, a.get(e)]));
		});
	}, x = [...s.values()].filter((e) => !e.wanted && !e.asset_id), S = (() => {
		let e = /* @__PURE__ */ new Set(), t = [];
		return {
			key: "want",
			label: X("catalog:javSelection.addToWants"),
			reversal: "undo",
			confirm: (e) => ({
				title: X("catalog:javSelection.addToWants"),
				body: X("catalog:javSelection.wantConfirm", { count: e.length })
			}),
			run: async (n) => {
				try {
					for (let r of n) if (!e.has(r.code)) {
						try {
							let e = await Ce({ code: r.code });
							e?.created && t.push(e.want.id);
						} catch (t) {
							throw Error(X("catalog:javSelection.wantPartialFailed", {
								count: e.size,
								code: r.code,
								error: Ye(t)
							}));
						}
						e.add(r.code), l((e) => {
							let t = new Map(e);
							return t.delete(r.code), t;
						});
					}
				} finally {
					Y();
				}
				return async () => {
					t.length && await At(t), await Y();
				};
			},
			receipt: () => X("catalog:javSelection.wantAdded", { count: e.size })
		};
	})(), C = { receipt: n };
	return /* @__PURE__ */ (0, $.jsxs)(sn.Provider, {
		value: {
			dense: i,
			mode: a,
			selected: h,
			toggle: b,
			visible: _,
			selectPage: y,
			close: v,
			all: g.all,
			mixed: g.mixed
		},
		children: [
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-selection": "",
				"data-select-mode": a ? "" : void 0,
				className: "flex min-w-0 flex-col gap-4",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsxs)(K, {
				visible: r && a,
				count: X("catalog:javSelection.selectedCount", { count: s.size }),
				label: X("catalog:javSelection.dockLabel"),
				actions: [{
					action: S,
					items: x,
					host: C,
					disabled: t
				}],
				leading: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !u.length,
					onClick: y,
					children: /* @__PURE__ */ (0, $.jsx)("span", {
						"data-copy-key": `jav.selection.page.${g.all ? "clear" : "all"}`,
						children: g.all ? X("catalog:javSelection.deselectPage") : X("catalog:javSelection.selectPage")
					})
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !s.size,
					onClick: () => p([...s.values()]),
					children: X("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: v,
					children: X("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(an, {
				items: f,
				close: () => p(null),
				readOnly: t,
				receipt: n
			})
		]
	});
}
// src/react/wants/want-list.tsx
var dn = {
	code: X("catalog:wants.originManual"),
	feed: X("catalog:entityHero.subscribeNewReleases"),
	follow: X("catalog:entityHero.following")
}, fn = [
	["all", X("catalog:shared.all")],
	["available", X("catalog:wants.hasMagnet")],
	["missing", X("catalog:wants.noMagnet")]
], pn = (e) => [
	e.release_date,
	e.studio,
	e.performers,
	dn[e.origin]
].filter(Boolean).join(" · ");
function mn({ want: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "relative inline-grid w-card-cover shrink-0 aspect-card-cover place-items-center overflow-hidden rounded-2lg bg-media-placeholder max-sm:w-24",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-caption-1-regular text-text-secondary",
			children: X("catalog:shared.noCover")
		}), e.cover ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: e.cover,
			alt: "",
			loading: "lazy",
			referrerPolicy: e.remote_cover ? "no-referrer" : void 0,
			onError: (e) => e.currentTarget.remove(),
			className: "absolute inset-0 size-full object-cover"
		}) : null]
	});
}
function hn({ want: e, readOnly: t, busy: n, onReset: r, onRemove: i, onCloudDownload: a, downloads: o, provider: s, toast: u, picked: d }) {
	let f = $t(), [p, h] = (0, Q.useState)([]), g = e.link || (!p.length && e.code ? `https://javdb.com/search?q=${encodeURIComponent(e.code)}&f=all` : ""), _ = g && URL.canParse(g) ? new URL(g).hostname.replace(/^www\./, "") : "", v = Pt(e.follow_provider || _.split(".")[0] || ""), y = v === "javdb" ? "JavDB" : v === "javbus" ? "JavBus" : _, b = g && _ && !p.some((e) => e.source === v) ? [{
		source: v,
		label: y,
		url: g
	}, ...p] : p, x = e.code && e.phase === "searching" ? pt(e) : It(e), S = b.map((e) => ({
		id: `source:${e.source}`,
		label: e.label,
		icon: be,
		run: () => {
			window.open(e.url, "_blank", "noopener,noreferrer");
		}
	}));
	(e.phase === "searching" || e.phase === "given_up") && S.push({
		id: "resource",
		label: X("catalog:shared.searchTorrents"),
		icon: vt,
		run: a
	}), e.phase === "given_up" && S.push({
		id: "reset",
		label: X("catalog:wants.searchAgain"),
		icon: P,
		disabled: t || !!n,
		run: r
	}), d && S.push({
		id: "select",
		label: X(d.on ? "catalog:mediaActions.deselect" : "catalog:mediaActions.select"),
		icon: M,
		run: () => d.toggle(!d.on)
	}), S.push({
		id: "remove",
		label: X("catalog:shared.remove"),
		icon: L,
		danger: !0,
		disabled: t || !!n,
		run: i
	});
	let C = {
		key: e.id,
		operations: S
	};
	return /* @__PURE__ */ (0, $.jsxs)("li", {
		"data-want-id": e.id,
		onContextMenu: (e) => f.onContextMenu(e, C),
		onKeyDown: (e) => f.onKeyDown(e, C),
		className: Oe({ className: "flex flex-col gap-4 max-sm:p-4" }),
		children: [
			f.menu,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex min-w-0 items-start gap-4 max-sm:gap-3",
				children: [
					d ? /* @__PURE__ */ (0, $.jsx)(m, {
						slot: null,
						className: "mt-1 shrink-0 self-start",
						"aria-label": X("catalog:wants.selectRow", { name: en(e) }),
						isSelected: d.on,
						onChange: d.toggle
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(mn, { want: e }),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex min-w-0 flex-1 flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, $.jsxs)("p", {
								className: "flex min-w-0 flex-wrap items-baseline gap-x-2",
								children: [/* @__PURE__ */ (0, $.jsx)("b", {
									className: "min-w-0 text-headline-medium wrap-anywhere text-text-primary",
									children: en(e)
								}), e.code && e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									className: "min-w-0 truncate text-body-2-regular text-text-secondary",
									children: e.title
								}) : null]
							}),
							pn(e) ? /* @__PURE__ */ (0, $.jsx)("p", {
								className: "text-body-2-regular text-text-secondary",
								children: pn(e)
							}) : null,
							x ? /* @__PURE__ */ (0, $.jsx)("p", {
								"data-want-note": "",
								className: "text-caption-1-regular text-text-secondary",
								children: x
							}) : null,
							e.scrape_error ? /* @__PURE__ */ (0, $.jsx)(on, {
								text: e.scrape_error,
								prefix: X("catalog:wants.metadataNotFound"),
								tone: "muted"
							}) : null,
							/* @__PURE__ */ (0, $.jsxs)("div", {
								"data-want-actions": "",
								className: "mt-1 flex flex-wrap items-center gap-2",
								children: [
									b.map((e) => /* @__PURE__ */ (0, $.jsx)(l, {
										"data-button-link": "",
										variant: "secondary",
										size: "small",
										trailingIcon: be,
										href: e.url,
										target: "_blank",
										rel: "noopener noreferrer",
										children: /* @__PURE__ */ (0, $.jsx)(W, {
											source: e.source,
											label: e.label
										})
									}, e.source)),
									e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
										variant: "secondary",
										size: "small",
										disabled: t,
										...J(n === `reset:${e.id}`),
										onClick: r,
										children: X("catalog:wants.searchAgain")
									}) : null,
									e.phase === "searching" || e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
										variant: "primary",
										size: "small",
										leadingIcon: vt,
										onClick: a,
										children: X("catalog:shared.searchTorrents")
									}) : null,
									/* @__PURE__ */ (0, $.jsx)(c, {
										variant: "danger",
										size: "small",
										leadingIcon: L,
										disabled: t,
										...J(n === `remove:${e.id}`),
										onClick: i,
										children: X("catalog:shared.remove")
									})
								]
							})
						]
					})
				]
			}),
			e.code && (e.phase === "searching" || e.phase === "given_up") ? /* @__PURE__ */ (0, $.jsx)(ye, {
				want: e,
				readOnly: t,
				downloads: o,
				provider: s,
				toast: u,
				onSources: h
			}) : null
		]
	});
}
function gn({ phase: e, label: t, rows: n, row: r }) {
	let [i, o] = (0, Q.useState)(1), [s, l] = (0, Q.useState)(20), [u, d] = (0, Q.useState)("all"), f = De(n), p = (e) => e.has_magnets ?? f.get(e.code || "") ?? !1, m = n.filter(p), h = e !== "searching" || u === "all" ? n : n.filter((e) => p(e) === (u === "available")), g = _t(h.length, s, i);
	return /* @__PURE__ */ (0, $.jsxs)("section", {
		"aria-label": t,
		"data-want-phase": e,
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, $.jsxs)("h3", {
					className: "flex items-baseline gap-2 text-title-2-medium text-text-primary",
					children: [t, /* @__PURE__ */ (0, $.jsx)("span", {
						className: "text-body-2-regular tabular-nums text-text-secondary",
						children: n.length.toLocaleString()
					})]
				}), e === "searching" ? /* @__PURE__ */ (0, $.jsx)(G, {
					name: "want-magnet-filter",
					"aria-label": X("catalog:wants.magnetFilter"),
					orientation: "horizontal",
					value: u,
					className: U,
					onChange: (e) => {
						d(e), o(1);
					},
					children: fn.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)(a, {
						value: e,
						"aria-label": t,
						className: ce,
						children: [t, /* @__PURE__ */ (0, $.jsx)("span", {
							className: "text-caption-1-regular tabular-nums text-text-tertiary",
							children: (e === "all" ? n.length : e === "available" ? m.length : n.length - m.length).toLocaleString()
						})]
					}, e))
				}) : null]
			}),
			h.length ? null : /* @__PURE__ */ (0, $.jsx)(ee, {
				size: "compact",
				icon: yt,
				title: X("catalog:wants.noFilterMatches"),
				actions: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: () => {
						d("all"), o(1);
					},
					children: X("catalog:shared.viewAll")
				}),
				children: null
			}),
			/* @__PURE__ */ (0, $.jsx)("ul", {
				className: "flex flex-col gap-4",
				children: h.slice(g.start, g.end).map(r)
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-want-pager": "",
				children: /* @__PURE__ */ (0, $.jsx)(w, {
					label: t,
					total: g.total,
					pagination: {
						pageIndex: g.page - 1,
						pageSize: s
					},
					onChange: (e) => {
						l(e.pageSize), o(e.pageIndex + 1);
					},
					unit: X("catalog:wants.itemUnit")
				})
			})
		]
	});
}
function _n({ readOnly: e, toast: t, query: n = "", clearQuery: r }) {
	let [i, a] = (0, Q.useState)(""), [o, s] = (0, Q.useState)(null), l = qt(), u = Zt({
		queryKey: ve,
		queryFn: ({ signal: e }) => rt(e),
		staleTime: 3e4,
		refetchInterval: tn
	}), d = () => {
		let n = i.trim();
		n && !e && l.run("add", (e) => Ce({ code: n }, e), (e) => {
			t(e.created ? X("catalog:wants.added", { name: en(e.want) }) : X("catalog:wants.alreadyAdded", { name: en(e.want) })), a(""), Y();
		});
	}, f = (e) => {
		e.key === "Enter" && !Ne(e.nativeEvent) && (e.preventDefault(), d());
	}, p = (e) => {
		l.run(`remove:${e.id}`, (t) => At([e.id], t), () => {
			t(X("catalog:wants.removed", { name: en(e) })), Y();
		});
	}, m = (e) => {
		l.run(`reset:${e.id}`, (t) => Nt([e.id], t), () => {
			t(X("catalog:wants.backToSearching", { name: en(e) })), Y();
		});
	}, h = u.data, g = (h?.items || []).filter((e) => !n || [
		e.code,
		e.title,
		e.performers
	].join(" ").toLocaleLowerCase().includes(n.toLocaleLowerCase())), v = cn(), y = !!v?.mode, [b, x] = (0, Q.useState)(/* @__PURE__ */ new Set()), [w, T] = (0, Q.useState)(null);
	(0, Q.useEffect)(() => {
		y || x(/* @__PURE__ */ new Set());
	}, [y]);
	let E = g.filter((e) => b.has(e.id)), O = g.length > 0 && E.length === g.length, k = { receipt: t }, A = {
		key: "remove",
		label: X("catalog:shared.remove"),
		reversal: "undo",
		danger: !0,
		confirm: (e) => ({
			title: X("catalog:wants.removeMany"),
			body: X("catalog:wants.removeManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await At(e.map((e) => e.id));
			return await Y(), async () => {
				await Ft(t), await Y();
			};
		},
		receipt: (e) => X("catalog:wants.removedMany", { count: e.length })
	}, te = {
		key: "reset",
		label: X("catalog:wants.searchAgain"),
		reversal: "undo",
		confirm: (e) => ({
			title: X("catalog:wants.searchAgainMany"),
			body: X("catalog:wants.searchAgainManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await Nt(e.map((e) => e.id));
			return await Y(), async () => {
				await Ft(t), await Y();
			};
		},
		receipt: (e) => X("catalog:wants.searchAgainDone", { count: e.length })
	}, j = E.filter((e) => e.code && (e.phase === "searching" || e.phase === "given_up")), M = Zt({
		queryKey: S,
		queryFn: ({ signal: e }) => we(`${C}?limit=100`, e),
		enabled: g.some((e) => e.code && (e.phase === "searching" || e.phase === "given_up"))
	}), N = M.data?.providers.filter((e) => e.configured) || [], re = N[0]?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"aria-busy": u.isPending,
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: Oe({
					padding: "none",
					className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
				}),
				children: [
					/* @__PURE__ */ (0, $.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: X("catalog:wants.addByCode")
					}),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-wrap items-end gap-2",
						children: [/* @__PURE__ */ (0, $.jsx)("div", {
							className: "min-w-64 grow max-sm:min-w-0",
							children: /* @__PURE__ */ (0, $.jsx)(ne, {
								"aria-label": X("catalog:shared.code"),
								placeholder: X("catalog:wants.codePlaceholder"),
								value: i,
								isDisabled: e,
								onChange: a,
								onKeyDown: f
							})
						}), /* @__PURE__ */ (0, $.jsx)(c, {
							variant: "primary",
							disabled: e || !i.trim(),
							...J(l.busy === "add"),
							onClick: d,
							children: X("catalog:shared.add")
						})]
					}),
					l.error ? /* @__PURE__ */ (0, $.jsx)(R, {
						tone: "error",
						title: X("catalog:wants.actionFailed"),
						children: l.error
					}) : null
				]
			}),
			u.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				title: X("catalog:wants.loadFailed"),
				children: Ye(u.error)
			}) : null,
			u.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": X("catalog:wants.loading"),
				dangerouslySetInnerHTML: { __html: st("wants") }
			}) : null,
			h?.scraping ? /* @__PURE__ */ (0, $.jsx)(_e, {
				embedded: !0,
				kind: Se("want-scrape"),
				label: X("catalog:wants.fetchingNew")
			}) : null,
			h?.searching ? /* @__PURE__ */ (0, $.jsx)(_e, {
				embedded: !0,
				kind: Se("want-search"),
				label: X("catalog:wants.searchingResources")
			}) : null,
			M.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				title: X("catalog:wants.downloadSettingsFailed"),
				children: Ye(M.error)
			}) : null,
			M.data && !N.length ? /* @__PURE__ */ (0, $.jsxs)(R, {
				tone: "neutral",
				children: [
					X("shell:downloadChannels.notConfigured"),
					X("shell:format.sentenceGap"),
					/* @__PURE__ */ (0, $.jsx)("a", {
						href: "/settings/downloads",
						children: X("shell:downloadChannels.settingsLink")
					})
				]
			}) : null,
			M.data && !M.data.available ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "neutral",
				children: X("catalog:wants.cloudPrimaryOnly")
			}) : null,
			h && !g.length ? /* @__PURE__ */ (0, $.jsx)(ee, {
				size: "compact",
				icon: yt,
				title: X(n ? "catalog:wants.noSearchMatches" : "catalog:wants.empty"),
				actions: n && r ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: r,
					children: X("catalog:shared.clearSearch")
				}) : !n && !e ? /* @__PURE__ */ (0, $.jsx)(D, {
					target: `input[aria-label="${X("catalog:shared.code")}"]`,
					children: X("catalog:wants.addWork")
				}) : void 0,
				children: X(n ? "catalog:wants.tryOtherSearch" : "catalog:wants.emptyHint")
			}) : null,
			oe.map(([n, r]) => {
				let i = g.filter((e) => e.phase === n);
				return i.length ? /* @__PURE__ */ (0, $.jsx)(gn, {
					phase: n,
					label: r,
					rows: i,
					row: (n) => /* @__PURE__ */ (0, $.jsx)(hn, {
						want: n,
						readOnly: e,
						busy: l.busy,
						downloads: M.data,
						provider: re,
						toast: t,
						picked: y ? {
							on: b.has(n.id),
							toggle: (e) => x((t) => {
								let r = new Set(t);
								return e ? r.add(n.id) : r.delete(n.id), r;
							})
						} : void 0,
						onReset: () => m(n),
						onRemove: () => p(n),
						onCloudDownload: () => s({
							code: n.code || "",
							title: n.title || "",
							origin: `wishlist:${n.id}`,
							cover: n.cover || "",
							performers: n.performers || "",
							release_date: n.release_date || "",
							studio: n.studio || ""
						})
					}, n.id)
				}, n) : null;
			}),
			/* @__PURE__ */ (0, $.jsx)(_, {
				prefill: o,
				close: () => s(null),
				receipt: t,
				provider: re
			}),
			/* @__PURE__ */ (0, $.jsxs)(K, {
				visible: y,
				label: X("catalog:wants.dockLabel"),
				count: X("catalog:javSelection.selectedCount", { count: E.length }),
				actions: [{
					action: A,
					items: E,
					host: k,
					disabled: e,
					done: () => x(/* @__PURE__ */ new Set())
				}, {
					action: te,
					items: E.filter((e) => e.phase === "given_up"),
					host: k,
					disabled: e,
					done: () => x(/* @__PURE__ */ new Set())
				}],
				leading: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !g.length,
					onClick: () => x(O ? /* @__PURE__ */ new Set() : new Set(g.map((e) => e.id))),
					children: X(O ? "catalog:javSelection.deselectPage" : "catalog:wants.selectAll")
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !j.length,
					onClick: () => T(j.map((e) => ({
						id: e.id,
						code: e.code,
						title: e.title || "",
						release_date: e.release_date || void 0
					}))),
					children: X("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: () => v?.close(),
					children: X("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(an, {
				items: w,
				close: () => T(null),
				readOnly: e,
				receipt: t
			})
		]
	});
}
// src/react/jav/discovery-faces.tsx
function vn({ item: e }) {
	Xt();
	let t = e.performer_refs?.length ? e.performer_refs : [...new Set(e.performers.split(/[,，、;/]/).filter(Boolean))].map((e) => ({ name: e })), n = t.slice(0, 5).map((t, n) => {
		let r = { "--media-avatar-index": n }, i = t.source_avatar && t.source_actor_id && !t.has_image && !t.has_avatar ? { children: /* @__PURE__ */ (0, $.jsx)(q, {
			code: e.code,
			person: t
		}) } : { dangerouslySetInnerHTML: { __html: Ee(t.name, t, null) } };
		return t.id ? /* @__PURE__ */ (0, $.jsx)("a", {
			"data-media-avatar": "",
			style: r,
			href: qe("performer", t.name, t.id),
			"aria-label": X("catalog:javDiscovery.openActress", { name: Ge("performer", t.name, t.id) }),
			...i
		}, t.name) : /* @__PURE__ */ (0, $.jsx)("span", {
			"data-media-avatar": "",
			style: r,
			title: Ge("performer", t.name),
			...i
		}, t.name);
	});
	return t.length > 1 ? /* @__PURE__ */ (0, $.jsx)("div", {
		"data-media-avatars": "",
		style: { "--media-avatar-count": Math.min(5, t.length) },
		children: n
	}) : n[0] || null;
}
// src/react/jav/discovery-context.ts
function yn(e, t) {
	let n = [
		{
			id: "open",
			label: X("catalog:mediaActions.open"),
			icon: j,
			run: () => t.navigate(e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`)
		},
		{
			id: "want",
			label: X(e.asset_id ? "catalog:javWant.imported" : e.wanted ? "catalog:javWant.wanted" : "catalog:javWant.want"),
			icon: yt,
			disabled: t.readOnly || t.wanting || !!e.wanted || !!e.asset_id,
			run: t.onWant
		},
		{
			id: "resource",
			label: X("catalog:shared.searchTorrents"),
			icon: vt,
			run: t.onResource
		}
	];
	return e.link && n.push({
		id: "source",
		label: X("catalog:shared.viewOnSite"),
		icon: be,
		run: () => {
			window.open(e.link, "_blank", "noopener,noreferrer");
		}
	}), t.selection && n.push({
		id: "select",
		label: X(t.selection.selected.has(e.code) ? "catalog:mediaActions.deselect" : "catalog:mediaActions.select"),
		icon: M,
		run: () => t.selection?.toggle(e)
	}), {
		key: e.code,
		operations: n
	};
}
// src/react/jav/discovery-card.tsx
var bn = (e) => ({
	...e,
	cover: e.has_cover ? Ve(e, !0) : e.cover_url,
	origin: `${e.asset_id ? "asset" : "feed"}:${e.id}`
}), xn = "relative inline-grid place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default";
function Sn({ item: e, readOnly: t }) {
	let n = qt(), [r, i] = (0, Q.useState)("");
	(0, Q.useSyncExternalStore)(Le.subscribe, Le.revision);
	let a = e.cover_state;
	if (!a) return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-media-nopic": "",
		children: X("catalog:shared.noCover")
	});
	if (a === "fetching" || Le.has(e.code)) return /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Re() } });
	let s = () => {
		n.run("cover", (t) => Qe(e.code, t), (t) => {
			t.has_cover ? Ie(e.code, t) : i(t.message || X("catalog:javDiscovery.noOfficialCover"));
		});
	}, l = r || n.error ? "missing" : a, u = n.error || r || ze(e);
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"data-cover-state": l,
		className: "flex max-w-full flex-col items-center gap-1.5 px-4 text-center",
		children: [
			l === "queued" ? /* @__PURE__ */ (0, $.jsx)(o, {
				kind: "clock",
				size: "card",
				still: !0
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("span", {
				"data-media-nopic": "",
				children: d[l]
			}),
			u ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "line-clamp-3 text-caption-1-regular text-text-secondary",
				title: u,
				children: u
			}) : null,
			t ? null : /* @__PURE__ */ (0, $.jsx)(c, {
				size: "small",
				variant: "secondary",
				className: "mt-1",
				onClick: s,
				children: Be(l)
			})
		]
	});
}
function Cn({ item: e, layout: t, javImage: n, readOnly: r, navigate: i, tag: a, onTag: o, wanting: u, onWant: d, onResource: f, badge: p }) {
	let m = cn(), h = $t(), g = yn(e, {
		selection: m,
		readOnly: r,
		wanting: u,
		navigate: i,
		onWant: d,
		onResource: f
	}), _ = m?.selected.has(e.code), v = !!m?.dense, y = e.performer_refs?.length ? dt(e.performer_refs.map((e) => e.name)) : e.performers, b = He(e, t, n), x = e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`;
	return /* @__PURE__ */ (0, $.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-selected": _ ? "" : void 0,
		onMouseDown: Ut,
		onContextMenu: (e) => h.onContextMenu(e, g),
		onKeyDown: (e) => h.onKeyDown(e, g),
		onClickCapture: (t) => {
			t.target.closest("[data-work-context-menu]") || m && (m.mode || t.shiftKey || t.ctrlKey || t.metaKey) && (t.preventDefault(), t.stopPropagation(), m.toggle(e, t.shiftKey));
		},
		onClick: (e) => {
			e.target.closest("a,button,input") || i(x);
		},
		children: [
			h.menu,
			b ? /* @__PURE__ */ (0, $.jsx)("a", {
				href: x,
				"aria-label": X("catalog:javDiscovery.viewDetails", { code: e.code }),
				onClick: (e) => {
					e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0 || (e.preventDefault(), i(x));
				},
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: xn,
				children: /* @__PURE__ */ (0, $.jsx)(s, {
					artwork: {
						kind: "cover",
						html: b
					},
					identity: He(e, "small", n),
					relayout: (e) => Ct(e, t)
				})
			}) : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: xn,
				children: /* @__PURE__ */ (0, $.jsx)(Sn, {
					item: e,
					readOnly: r
				})
			}),
			m?.mode ? /* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				"data-media-check": "",
				"aria-label": X("catalog:javDiscovery.select", { code: e.code }),
				"aria-pressed": !!_,
				children: /* @__PURE__ */ (0, $.jsx)("svg", {
					viewBox: "0 0 24 24",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-check" })
				})
			}) : null,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				"data-media-meta": "",
				children: [/* @__PURE__ */ (0, $.jsx)(vn, { item: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-media-text": "",
					children: [
						/* @__PURE__ */ (0, $.jsxs)("h3", {
							"data-jav-title": "",
							"data-media-title": "",
							title: `${e.code} · ${e.title || X("catalog:javDiscovery.titleNotFound")}`,
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: e.code }),
								" ",
								e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: Wt(e.title),
									children: e.title
								}) : X("catalog:javDiscovery.titleNotFound")
							]
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-media-byline": "",
							children: [
								e.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsxs)("a", {
									"data-media-who": "",
									href: qe("performer", e.performer_refs[0].name),
									title: y,
									children: [/* @__PURE__ */ (0, $.jsx)("svg", {
										viewBox: "0 0 24 24",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-user-round" })
									}), /* @__PURE__ */ (0, $.jsx)("span", { children: e.performer_refs[0].name })]
								}) : /* @__PURE__ */ (0, $.jsxs)("span", {
									"data-media-who": "",
									title: y,
									children: [/* @__PURE__ */ (0, $.jsx)("svg", {
										viewBox: "0 0 24 24",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-user-round" })
									}), /* @__PURE__ */ (0, $.jsx)("span", { children: e.performer_refs?.[0]?.name || y })]
								}),
								(e.performer_refs?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
									"data-media-who-more": "",
									children: X("catalog:javDiscovery.morePeople", {
										count: e.performer_refs.length - 1,
										total: e.performer_refs.length
									})
								}) : null,
								e.release_date ? /* @__PURE__ */ (0, $.jsx)("span", {
									"data-media-facts": "",
									children: /* @__PURE__ */ (0, $.jsxs)("time", {
										"data-media-release": "",
										dateTime: e.release_date,
										children: [/* @__PURE__ */ (0, $.jsx)("svg", {
											viewBox: "0 0 24 24",
											"aria-hidden": "true",
											children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-calendar" })
										}), e.release_date]
									})
								}) : null
							]
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-jav-tags": "",
							"data-media-tags": "",
							children: [p, (e.tags || []).slice(0, 4).map((e) => /* @__PURE__ */ (0, $.jsx)("button", {
								type: "button",
								"data-media-tag": "",
								"aria-pressed": typeof a == "string" ? a === e : a.includes(e),
								onClick: () => o(a === e ? "" : e),
								children: e
							}, e))]
						})
					]
				})]
			}),
			m?.mode ? null : /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-jav-actions": "",
				"data-compact": v ? "" : void 0,
				"data-has-source": e.link ? "" : void 0,
				className: "flex flex-wrap gap-2",
				children: [
					e.link ? /* @__PURE__ */ (0, $.jsx)(l, {
						"data-button-link": "",
						"data-jav-source": "",
						variant: "secondary",
						size: v ? "small" : "medium",
						iconOnly: v,
						"aria-label": X("catalog:shared.viewOnSite"),
						title: X("catalog:shared.viewOnSite"),
						leadingIcon: v ? be : void 0,
						trailingIcon: v ? void 0 : be,
						href: e.link,
						target: "_blank",
						rel: "noopener noreferrer",
						children: v ? null : X("catalog:shared.viewOnSite")
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "ghost",
						size: v ? "small" : "medium",
						disabled: r || e.wanted || !!e.asset_id,
						...J(u),
						onClick: d,
						children: e.asset_id ? X("catalog:javWant.imported") : e.wanted ? X("catalog:javWant.wanted") : X("catalog:javWant.want")
					}),
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "secondary",
						size: v ? "small" : "medium",
						onClick: f,
						children: X("catalog:shared.searchTorrents")
					})
				]
			})
		]
	});
}
// src/react/jav/jav-release-table.tsx
var wn = {
	widths: B,
	visibility: z
};
function Tn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return e?.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
		"data-list-studio-mark": "",
		src: ht(e.name, "icon", e.logo_version),
		alt: "",
		width: 16,
		height: 16,
		loading: "lazy",
		decoding: "async",
		onError: () => n(!0)
	}) : /* @__PURE__ */ (0, $.jsx)("span", {
		"data-list-studio-mark": "",
		"aria-hidden": "true",
		children: mt(e?.name || "", 1)
	});
}
function En({ column: e, label: t, filters: n, onChange: r }) {
	let i = e === "people" ? "performer" : e === "tags" ? "tag" : "studio", a = Bt(n, i, void 0);
	return /* @__PURE__ */ (0, $.jsx)(me, {
		id: e,
		label: t,
		values: wt(n, i),
		load: async (t, n, r) => {
			let i = await tt(a, e, n, r, t);
			return {
				items: i.items.map((t) => {
					let n = e === "people" ? t : null, r = n && Je("performer", n.name, n.id);
					return {
						id: t.name,
						label: t.name,
						count: t.count,
						searchTerms: [...n?.aliases || [], ...[r?.ja, r?.zh_cn].filter((e) => !!e)],
						leading: n ? /* @__PURE__ */ (0, $.jsx)(v, { person: n }) : void 0
					};
				}),
				nextOffset: i.next_offset ?? void 0
			};
		},
		queryKey: [
			"jav-release-column",
			e,
			a.performer,
			a.studio,
			a.tag,
			a.column_filters || "",
			a.q
		],
		onChange: (e) => r(i, e)
	});
}
function Dn({ items: a, waiting: o, filters: l, studios: u, facets: f, javImage: p, readOnly: g, navigate: _, onTag: v, onFilter: y, onRange: b, onSort: x, wanting: S, onWant: C, onResource: w }) {
	let E = cn(), D = $t(), ee = (e) => yn(e, {
		selection: E,
		readOnly: g,
		wanting: S(e),
		navigate: _,
		onWant: () => C(e),
		onResource: () => w(e)
	}), O = Qt("jav-releases", Et, wn), k = Et.filter((e) => e.required || O.visibility[e.id] !== !1), A = Object.entries(H).find(([, e]) => e === l.sort)?.[0], te = xt(l.column_filters), j = new Map(u.map((e) => [e.name, e])), M = (e) => (t) => {
		t.preventDefault(), E?.mode || t.shiftKey || t.ctrlKey || t.metaKey ? E?.toggle(e, t.shiftKey) : _(`/works/${encodeURIComponent(e.code)}`);
	}, N = (e, t) => {
		let n = t.performer_refs?.[0]?.name || t.performers.split(/[,，、;/]/)[0] || "";
		switch (e) {
			case "name": {
				let e = He(t, "small", p);
				return /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-list-identity": "",
					children: [/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						"data-list-open": "",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: M(t),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-list-picture": "",
							children: e ? /* @__PURE__ */ (0, $.jsx)(s, {
								artwork: {
									kind: "cover",
									html: e
								},
								relayout: (e) => Ct(e, "small")
							}) : /* @__PURE__ */ (0, $.jsx)("span", {
								title: ze(t) || void 0,
								children: t.cover_state ? d[t.cover_state] : X("catalog:shared.noCover")
							})
						})
					}), /* @__PURE__ */ (0, $.jsx)("span", {
						"data-list-text": "",
						children: /* @__PURE__ */ (0, $.jsxs)("button", {
							type: "button",
							"data-list-name": "",
							title: `${t.code} · ${t.title || X("catalog:javDiscovery.titleNotFound")}`,
							"aria-label": X("catalog:javDiscovery.viewDetails", { code: t.code }),
							onClick: M(t),
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: t.code }),
								" ",
								t.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: Wt(t.title),
									children: t.title
								}) : X("catalog:javDiscovery.titleNotFound")
							]
						})
					})]
				});
			}
			case "people": return n ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-list-people": "",
				children: [
					/* @__PURE__ */ (0, $.jsx)(vn, { item: t }),
					t.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsx)("a", {
						"data-media-who": "",
						href: qe("performer", n),
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}) : /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who": "",
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}),
					(t.performer_refs?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who-more": "",
						children: X("catalog:javDiscovery.morePeople", {
							count: t.performer_refs.length - 1,
							total: t.performer_refs.length
						})
					}) : null
				]
			}) : "—";
			case "studio": return t.studio ? /* @__PURE__ */ (0, $.jsxs)("span", {
				"data-list-library": "",
				title: t.studio,
				children: [/* @__PURE__ */ (0, $.jsx)(Tn, { studio: t.studio_ref || j.get(t.studio) }), /* @__PURE__ */ (0, $.jsx)("span", { children: t.studio })]
			}) : "—";
			case "tags": return t.tags?.length ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-tags": "",
				"data-list-tags": "",
				children: t.tags.map((e) => /* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					"data-media-tag": "",
					"aria-pressed": Tt(l, "tag").includes(e),
					onClick: () => v(e),
					children: e
				}, e))
			}) : "—";
			case "code": return t.code;
			case "dur": return at(t.duration) || "—";
			case "score": return t.source_score == null ? "—" : `${t.source_score.toFixed(2)} / 5`;
			case "release": return t.release_date || "—";
			default: return /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-release-actions": "",
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					disabled: g || t.wanted || !!t.asset_id,
					...J(S(t)),
					onClick: () => C(t),
					children: t.wanted ? X("catalog:javWant.wanted") : X("catalog:javWant.want")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					onClick: () => w(t),
					children: X("catalog:shared.searchTorrents")
				})]
			});
		}
	};
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"data-catalog-table": "",
		"data-release-table": "",
		className: "flex min-w-0 flex-col gap-4",
		onKeyDown: (e) => {
			let t = e.target.closest("[data-release-row]"), n = t && a.find((e) => String(e.id) === t.dataset.releaseId);
			n && !o && D.onKeyDown(e, ee(n), t);
		},
		children: [
			D.menu,
			/* @__PURE__ */ (0, $.jsx)("div", {
				className: "flex flex-wrap justify-end gap-2",
				role: "toolbar",
				"aria-label": X("catalog:javReleases.toolbar"),
				children: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-toolbar-actions": "",
					children: /* @__PURE__ */ (0, $.jsx)(pe, {
						preferences: O,
						label: X("catalog:javReleases.list")
					})
				})
			}),
			/* @__PURE__ */ (0, $.jsx)(T, {
				follow: !0,
				preferences: O,
				children: /* @__PURE__ */ (0, $.jsxs)(fe, {
					"aria-label": X("catalog:javReleases.list"),
					size: "sm",
					sortDescriptor: A ? {
						column: A,
						direction: l.dir === "asc" ? "ascending" : "descending"
					} : void 0,
					onSortChange: (e) => {
						let t = H[String(e.column)];
						t && x(t, e.direction === "ascending" ? "asc" : "desc");
					},
					children: [/* @__PURE__ */ (0, $.jsxs)(i, { children: [
						E?.mode ? /* @__PURE__ */ (0, $.jsx)(t, {
							id: "selection",
							width: 44,
							"aria-label": X("catalog:javReleases.selectVideos"),
							children: /* @__PURE__ */ (0, $.jsx)(m, {
								slot: null,
								"aria-label": X("catalog:catalogList.selectAllOnPage"),
								isSelected: E.all,
								isIndeterminate: E.mixed,
								isDisabled: o || !a.length,
								onChange: E.selectPage
							})
						}) : null,
						k.map((e) => /* @__PURE__ */ (0, $.jsx)(t, {
							id: e.id,
							isRowHeader: e.id === "name",
							allowsSorting: e.id in H,
							...O.columnProps(e.id),
							children: ({ sortDirection: t }) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
								className: "flex items-center gap-0.5",
								children: [b && (e.id === "release" || e.id === "dur" || e.id === "score") ? /* @__PURE__ */ (0, $.jsx)(he, {
									id: e.id,
									label: e.label,
									kind: je[e.id],
									value: te[e.id],
									rangeQuery: e.id === "release" ? Dt(l) : void 0,
									onChange: (t) => b(e.id, t)
								}) : f && y && [
									"people",
									"studio",
									"tags"
								].includes(e.id) ? /* @__PURE__ */ (0, $.jsx)(En, {
									column: e.id,
									label: e.label,
									filters: l,
									onChange: y
								}) : e.label, e.id in H ? /* @__PURE__ */ (0, $.jsx)("span", {
									"data-sort-indicator": !0,
									"data-direction": t || void 0,
									children: /* @__PURE__ */ (0, $.jsx)(h, {})
								}) : null]
							}), /* @__PURE__ */ (0, $.jsx)(ge, {
								preferences: O,
								id: e.id
							})] })
						}, e.id)),
						/* @__PURE__ */ (0, $.jsx)(t, {
							id: "remaining-space",
							"aria-label": X("catalog:catalogList.rowSpacer"),
							"data-table-space": "",
							width: O.spaceWidth,
							minWidth: 0
						})
					] }), /* @__PURE__ */ (0, $.jsx)(e, {
						renderEmptyState: () => X("catalog:javReleases.noMatches"),
						children: o ? Array.from({ length: 6 }, (e, t) => /* @__PURE__ */ (0, $.jsxs)(n, {
							id: `skeleton-${t}`,
							"data-list-skeleton-row": "",
							"aria-hidden": "true",
							children: [
								E?.mode ? /* @__PURE__ */ (0, $.jsx)(r, {}) : null,
								k.map((e) => /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Ae(e.id) } }) }, e.id)),
								/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
							]
						}, `skeleton-${t}`)) : a.map((e) => /* @__PURE__ */ (0, $.jsxs)(n, {
							id: String(e.id),
							"data-catalog-row": "",
							"data-release-row": "",
							"data-release-id": e.id,
							onContextMenu: (t) => D.onContextMenu(t, ee(e)),
							children: [
								E?.mode ? /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)(m, {
									slot: null,
									"aria-label": X("catalog:javDiscovery.select", { code: e.code }),
									isSelected: E.selected.has(e.code),
									onChange: () => E.toggle(e)
								}) }) : null,
								k.map((t) => /* @__PURE__ */ (0, $.jsx)(r, { children: N(t.id, e) }, t.id)),
								/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
							]
						}, e.id))
					})]
				})
			})
		]
	});
}
// src/react/jav/jav-releases.tsx
var On = `<div data-catalog-tier="performers" data-skeleton="tiers">${Gt("performer")}</div><div data-catalog-tier="studios">${Gt("studio")}</div>`, kn = (e) => `<span data-tier-initial>${Xe(it(Ge("performer", e.name, e.id)))}</span>${Ke({
	id: e.id,
	hasImage: e.has_image,
	version: e.image_version,
	style: Ze(e.avatar_focus),
	focus: e.avatar_focus,
	standIn: e.avatar_stand_in
})}`;
function An({ value: e }) {
	let t = St(e);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-jav-taste-score": "",
		title: X("catalog:javScore.taste", { score: t.score }),
		children: /* @__PURE__ */ (0, $.jsx)(g, {
			color: t.color,
			children: t.label
		})
	});
}
function jn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-tier-mark": "",
		children: e.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: ht(e.name, "icon", e.logo_version),
			alt: "",
			width: 28,
			height: 28,
			loading: "lazy",
			decoding: "async",
			onError: () => n(!0)
		}) : mt(e.name, 2)
	});
}
var Mn = (e) => Qe(e).then((t) => (t.has_cover && Ie(e, t), t.has_cover));
function Nn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	Xt();
	let [o, s] = (0, Q.useState)(() => Ot(location.search));
	(0, Q.useEffect)(() => {
		r !== o.q && (s((e) => ({
			...e,
			q: r,
			page: 1
		})), Z({ page: "" }));
	}, [r, o.q]);
	let d = (e, t) => {
		let n = Bt(o, e, t);
		s(n), Z({
			[e]: "",
			column_filters: n.column_filters || "",
			page: ""
		});
	}, m = (e, t) => {
		let n = wt(o, e);
		d(e, n === void 0 ? [t] : Kt(n, t, !Me(n, t)));
	}, h = (e) => {
		s((t) => ({
			...t,
			column_filters: e,
			page: 1
		})), Z({
			column_filters: e,
			page: ""
		});
	}, g = (e, t) => h(rn(xt(o.column_filters), e, t)), _ = (0, Q.useRef)(null), v = ({ pageIndex: e, pageSize: t }) => {
		let n = e + 1;
		s((e) => ({
			...e,
			page: n,
			size: t
		})), Z({
			page: n > 1 ? String(n) : "",
			size: t === 24 ? "" : String(t)
		}), _.current?.scrollIntoView({ block: "start" });
	}, x = () => {
		s((e) => ({
			...e,
			performer: "",
			studio: "",
			tag: "",
			column_filters: "",
			q: "",
			page: 1
		})), Z({
			performer: "",
			studio: "",
			tag: "",
			column_filters: "",
			page: ""
		}), a();
	}, S = (e) => C(e, e === o.sort ? o.dir === "asc" ? "desc" : "asc" : e === "code" ? "asc" : "desc"), C = (e, t) => {
		s((n) => ({
			...n,
			sort: e,
			dir: t,
			seed: "",
			page: 1
		})), Z({
			sort: e === "release_date" ? "" : e,
			dir: t === "asc" ? "asc" : "",
			seed: "",
			page: ""
		});
	}, T = () => {
		let e = Math.random().toString(36).slice(2, 10);
		s((t) => ({
			...t,
			sort: "random",
			dir: "desc",
			seed: e,
			page: 1
		})), Z({
			sort: "random",
			dir: "",
			seed: e,
			page: ""
		});
	};
	(0, Q.useEffect)(() => {
		let e = [..._.current?.querySelectorAll("[data-catalog-tier],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => nn(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let E = Te();
	(0, Q.useSyncExternalStore)(E.subscribe, E.version, E.version);
	let D = ct(), A = Jt(), j = ke(ot({
		active: !0,
		home: !1,
		portrait: !1
	})), M = Zt({
		queryKey: kt(o),
		queryFn: ({ signal: e }) => nt(o, e),
		placeholderData: ft,
		retry: !1,
		refetchOnWindowFocus: !1
	}), N = M.data?.metadata_job, ne = (0, Q.useRef)(!1);
	ne.current = N?.status === "running";
	let ae = bt.getQueryData(b)?.metadata_job, P = Zt({
		queryKey: b,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: N?.status === "running" || ae?.status === "running",
		queryFn: ({ signal: e }) => et(e),
		refetchInterval: gt(() => ne.current)
	}), F = P.data && P.dataUpdatedAt >= M.dataUpdatedAt ? P.data.metadata_job : N, I = F?.status === "running", L = (0, Q.useRef)(!1);
	(0, Q.useEffect)(() => {
		L.current && !I && M.refetch(), L.current = I;
	}, [I, M]);
	let oe = (0, Q.useRef)(""), z = JSON.stringify([
		o.performer,
		o.studio,
		o.tag,
		o.column_filters,
		o.q,
		o.sort,
		o.dir,
		o.seed
	]), B = !M.isPlaceholderData && (M.data?.metadata_unread || 0) > 0 && !I;
	(0, Q.useEffect)(() => {
		B && oe.current !== z && (oe.current = z, Fe("start", o).then(async (e) => {
			await bt.cancelQueries({ queryKey: b }), bt.setQueryData(b, e);
		}).catch(() => {}));
	}, [B, z]);
	let H = qt(), ce = (e) => {
		H.run(String(e.id), (t) => Ce({ code: e.code }, t), () => {
			t(X("catalog:javWant.added")), Y(), M.refetch();
		});
	}, U = M.data;
	ln(U?.items || []);
	let W = M.isPending, G = !!(o.performer || o.studio || o.tag || o.column_filters || o.q), K = Math.max(1, Math.ceil((U?.total || 0) / o.size));
	return (0, Q.useEffect)(() => {
		!U || M.isPlaceholderData || o.page <= K || (s((e) => ({
			...e,
			page: K
		})), Z({ page: K > 1 ? String(K) : "" }));
	}, [
		U,
		M.isPlaceholderData,
		o.page,
		K
	]), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: _,
		"aria-label": X("catalog:entityHero.subscribeNewReleases"),
		"aria-busy": W || M.isFetching,
		className: "flex min-w-0 scroll-mt-24 flex-col gap-4",
		children: [
			W ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-catalog-tiers": "",
				"aria-busy": "true",
				dangerouslySetInnerHTML: { __html: On }
			}) : null,
			U && (U.facets.performers.length || U.facets.studios.length) ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-catalog-tiers": "",
				"data-release-tiers": "",
				children: [U.facets.performers.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "performers",
					role: "group",
					"aria-label": X("catalog:javReleases.filterByActress"),
					children: U.facets.performers.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-performer": "",
						"aria-pressed": Tt(o, "performer").includes(e.name),
						title: X("catalog:javReleases.facetCount", {
							name: Ge("performer", e.name, e.id),
							count: e.count
						}),
						onClick: () => m("performer", e.name),
						children: [/* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-ring": "",
							dangerouslySetInnerHTML: { __html: kn(e) }
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-name": "",
							children: Ge("performer", e.name, e.id)
						})]
					}, e.name))
				}) : null, U.facets.studios.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "studios",
					role: "group",
					"aria-label": X("catalog:javReleases.filterByLabel"),
					children: U.facets.studios.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-studio": "",
						"aria-pressed": Tt(o, "studio").includes(e.name),
						title: X("catalog:javReleases.facetCount", {
							name: e.name,
							count: e.count
						}),
						onClick: () => m("studio", e.name),
						children: [
							/* @__PURE__ */ (0, $.jsx)(jn, { studio: e }),
							e.name,
							/* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: e.count
							})
						]
					}, e.name))
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(k, {
				label: X("catalog:javReleases.filtersLabel"),
				topLabel: X("catalog:javReleases.tagsLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: W,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-scroll": "",
					children: /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: W ? { __html: lt() } : void 0,
						children: W ? null : U?.facets.tags.map((e) => /* @__PURE__ */ (0, $.jsxs)(te, {
							"data-catalog-tag": e.name,
							"data-entity-press": "",
							pressed: Tt(o, "tag").includes(e.name),
							onPress: () => m("tag", e.name),
							children: [e.name, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: e.count
							})]
						}, e.name))
					})
				}),
				bottom: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-catalog-readout": "",
						children: W ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : G ? X("catalog:javReleases.matchedCount", {
							matched: U?.total || 0,
							count: U?.candidate_total || 0
						}) : X("catalog:countLabel.works", { count: U?.total || 0 })
					}),
					G ? /* @__PURE__ */ (0, $.jsx)(O, {
						onPress: x,
						children: X("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							/* @__PURE__ */ (0, $.jsx)(ue, {
								onPress: T,
								busy: o.sort === "random" && M.isFetching
							}),
							A === "cards" ? /* @__PURE__ */ (0, $.jsx)(le, {
								label: X("catalog:entityFilter.javCardLayout"),
								value: D,
								options: re,
								onChange: Ht
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(p, {}),
							/* @__PURE__ */ (0, $.jsx)(de, {
								group: "releases",
								sorts: V.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === o.sort,
									dir: o.dir
								})),
								onSort: (e) => S(e)
							})
						]
					})
				] })
			}),
			A === "cards" && o.column_filters ? /* @__PURE__ */ (0, $.jsx)(f, {
				encoded: o.column_filters,
				columns: Et,
				onChange: h
			}) : null,
			W && A === "cards" ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": X("catalog:javReleases.loading"),
				dangerouslySetInnerHTML: { __html: st("discover", D) }
			}) : null,
			M.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				title: X("catalog:javReleases.failed"),
				children: Ye(M.error)
			}) : null,
			I && F ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(_e, {
					kind: Se("jav-discovery-metadata"),
					label: X("catalog:javMetadata.loadingProgress", {
						completed: F.completed,
						count: F.total
					}),
					value: F.completed,
					total: F.total
				})
			}) : null,
			e ? null : /* @__PURE__ */ (0, $.jsx)(y, {
				scope: X("catalog:javReleases.coverQueueScope"),
				fetchOne: Mn,
				codes: (U?.items || []).filter((e) => e.cover_state === "queued" && !e.cover_url).map((e) => e.code),
				settled: (e, n) => {
					t(e === n ? X("catalog:javReleases.coversFetched", { count: n }) : X("catalog:javReleases.coversPartial", {
						got: e,
						count: n
					})), M.refetch();
				}
			}),
			!W && !M.error && !U?.items.length && (A === "cards" || !G) ? /* @__PURE__ */ (0, $.jsx)(ee, {
				icon: u,
				title: X(G ? "catalog:javReleases.noMatches" : "catalog:javReleases.emptyTitle"),
				actions: G ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: x,
					children: X("catalog:shared.clearFilters")
				}) : /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/subscriptions?tab=add",
					children: X("catalog:javReleases.addSubscription")
				}),
				children: X(G ? "catalog:javReleases.clearFiltersHint" : "catalog:javReleases.emptyHint")
			}) : null,
			H.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				children: H.error
			}) : null,
			A === "list" ? W || U?.items.length || G ? /* @__PURE__ */ (0, $.jsx)(Dn, {
				items: U?.items || [],
				waiting: W,
				filters: o,
				studios: U?.facets.studios || [],
				javImage: E.value.javImage,
				readOnly: e,
				navigate: i,
				facets: U?.facets,
				onFilter: d,
				onRange: g,
				onTag: (e) => m("tag", e),
				onSort: C,
				wanting: (e) => H.busy === String(e.id),
				onWant: ce,
				onResource: (e) => n(bn(e))
			}) : null : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: ie,
				style: { "--card-ratio": j },
				children: (U?.items || []).map((t) => /* @__PURE__ */ (0, $.jsx)(Cn, {
					item: t,
					layout: D,
					javImage: E.value.javImage,
					readOnly: e,
					navigate: i,
					tag: Tt(o, "tag"),
					onTag: (e) => m("tag", e),
					wanting: H.busy === String(t.id),
					onWant: () => ce(t),
					onResource: () => n(bn(t)),
					badge: o.sort === "taste" ? /* @__PURE__ */ (0, $.jsx)(An, { value: t.taste_score }) : void 0
				}, t.id))
			}),
			U ? /* @__PURE__ */ (0, $.jsx)(w, {
				label: X("catalog:javTabs.newReleases"),
				total: U.total,
				pagination: {
					pageIndex: o.page - 1,
					pageSize: o.size
				},
				onChange: v,
				unit: X("catalog:catalogList.footerUnit"),
				pageUnit: X("catalog:catalogList.footerPageUnit"),
				pageSizes: se
			}) : null
		]
	});
}
// src/react/jav/jav-page.tsx
var Pn = Vt("x"), Fn = Vt("refresh-cw"), In = {
	releases: X("catalog:javSearch.filterReleases"),
	discover: X("catalog:javSearch.filterRecommended"),
	wants: X("catalog:javSearch.filterWants")
};
function Ln({ tab: e, readOnly: t, navigate: n, receipt: r }) {
	let [i, a] = (0, Q.useState)(null), [o, s] = (0, Q.useState)(() => new URLSearchParams(location.search).get("q") || ""), c = (e) => {
		s(e), Z({ q: e });
	};
	return /* @__PURE__ */ (0, $.jsx)(un, {
		readOnly: t,
		receipt: r,
		dock: e !== "wants",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex w-full flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, $.jsx)(F, {
					tab: e,
					navigate: n,
					find: () => a({}),
					search: /* @__PURE__ */ (0, $.jsx)(N, {
						label: In[e] || X("catalog:javDiscover.filter"),
						value: o,
						onQuery: c
					})
				}),
				e === "releases" ? /* @__PURE__ */ (0, $.jsx)(Nn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : e === "discover" ? /* @__PURE__ */ (0, $.jsx)(Rn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : /* @__PURE__ */ (0, $.jsx)(_n, {
					readOnly: t,
					toast: r,
					query: o.trim(),
					clearQuery: () => c("")
				}),
				/* @__PURE__ */ (0, $.jsx)(_, {
					prefill: i,
					close: () => a(null),
					receipt: r
				})
			]
		})
	}, e);
}
function Rn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	let o = new URLSearchParams(location.search), [s, u] = (0, Q.useState)(() => o.get("scope") === "library" ? "library" : "external"), [d, f] = (0, Q.useState)(() => o.get("tag") || ""), [p, m] = (0, Q.useState)(() => x.some(([e]) => e === o.get("sort")) ? o.get("sort") : "taste"), [h, _] = (0, Q.useState)(() => o.get("dir") === "asc"), v = (e) => {
		u(e), Z({ scope: e === "external" ? "" : e });
	}, y = (e) => {
		f(e), Z({ tag: e });
	}, S = (e) => {
		m(e), Z({ sort: e === "taste" ? "" : e });
	}, C = (e) => {
		_(e), Z({ dir: e ? "asc" : "" });
	}, w = (0, Q.useRef)(null);
	(0, Q.useEffect)(() => {
		let e = [...w.current?.querySelectorAll("[data-catalog-scroll],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => nn(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let T = Te();
	(0, Q.useSyncExternalStore)(T.subscribe, T.version, T.version);
	let D = ct(), j = ke(ot({
		active: !0,
		home: !1,
		portrait: !1
	})), M = h ? "asc" : "desc", N = Zt({
		queryKey: Ue(s, p, M),
		retry: !1,
		refetchOnWindowFocus: !1,
		queryFn: ({ signal: e }) => $e(s, e, {
			sort: p,
			direction: M
		})
	}), ne = N.data?.metadata_job, ae = (0, Q.useRef)(!1);
	ae.current = ne?.status === "running";
	let P = Zt({
		queryKey: b,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: s === "external",
		queryFn: ({ signal: e }) => et(e),
		refetchInterval: gt(() => ae.current)
	}), F = P.data && P.dataUpdatedAt >= N.dataUpdatedAt ? P.data.metadata_job : ne, L = (e) => e ? `${e.job_id}:${e.status}` : "", oe = (0, Q.useRef)(""), z = (0, Q.useRef)(""), B = P.data?.metadata_job;
	(0, Q.useEffect)(() => {
		let e = L(B), t = z.current.endsWith(":running") && B && B.status !== "running";
		z.current = e, t && e !== oe.current && N.refetch();
	}, [L(B)]);
	let se = qt(), V = qt(), H = async (e, t) => {
		let n = await Pe(e, {
			sort: p,
			direction: M,
			jobId: F?.job_id
		}, t);
		e !== "start" && await N.refetch({
			cancelRefetch: !0,
			throwOnError: !0
		}), await bt.cancelQueries({ queryKey: b }), oe.current = L(n.metadata_job), bt.setQueryData(b, n);
	}, ce = (e) => {
		V.run(e, (t) => H(e === "stop" ? "cancel" : "refresh", t), () => {});
	}, U = (0, Q.useRef)(!1), W = s === "external" && F?.status !== "running" && (N.data?.items || []).some((e) => e.metadata_state === "pending" || e.metadata_state === "stale");
	(0, Q.useEffect)(() => {
		W && !U.current && (U.current = !0, H("start").catch(() => {}));
	}, [W]);
	let G = N.data?.items || [], K = [...new Set(G.flatMap((e) => e.tags || []))], ue = G.filter((e) => (!d || e.tags?.includes(d)) && (!r || [
		e.code,
		e.title,
		e.performers,
		e.studio,
		...e.tags || [],
		...(e.performer_refs || []).map((e) => e.name)
	].join(" ").toLocaleLowerCase().includes(r.toLocaleLowerCase()))), q = N.isPending;
	return ln(ue), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: w,
		"aria-label": X("catalog:shared.recommendedForYou"),
		"aria-busy": q,
		className: "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, $.jsx)(k, {
				label: X("catalog:javDiscover.filtersLabel"),
				topLabel: X("catalog:javDiscover.scopeLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: q,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-catalog-scroll": "",
					children: [/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-catalog-views": "",
						children: [[["external", X("catalog:javDiscover.external")], ["library", X("catalog:javDiscover.library")]].map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(te, {
							"data-entity-tag": e,
							"data-entity-press": "",
							pressed: s === e,
							onPress: () => {
								v(e), y("");
							},
							children: t
						}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-entity-sep": "",
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: q ? { __html: lt() } : void 0,
						children: q ? null : K.map((e) => /* @__PURE__ */ (0, $.jsxs)(te, {
							"data-catalog-tag": e,
							"data-entity-press": "",
							pressed: d === e,
							onPress: () => y(d === e ? "" : e),
							children: [e, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: G.filter((t) => t.tags?.includes(e)).length
							})]
						}, e))
					})]
				}),
				bottom: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-catalog-readout": "",
						children: q ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : X("catalog:countLabel.works", { count: ue.length })
					}),
					/* @__PURE__ */ (0, $.jsx)(I, { currentHref: () => location.pathname + location.search }),
					r || d ? /* @__PURE__ */ (0, $.jsx)(O, {
						onPress: () => {
							y(""), a();
						},
						children: X("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							s === "external" ? /* @__PURE__ */ (0, $.jsx)(A, {
								"data-entity-batch": "",
								"data-jav-metadata-update": "",
								label: F?.status === "running" ? X("catalog:javDiscover.stopUpdating") : X("catalog:javDiscover.updateMetadata"),
								disabled: q,
								"data-skeleton-action": q ? "" : void 0,
								busy: !!V.busy,
								icon: F?.status === "running" ? Pn : Fn,
								onPress: () => ce(F?.status === "running" ? "stop" : "update")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(le, {
								label: X("catalog:entityFilter.javCardLayout"),
								value: D,
								options: re,
								onChange: Ht
							}),
							/* @__PURE__ */ (0, $.jsx)(de, {
								group: "discover",
								sorts: x.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === p,
									dir: M
								})),
								onSort: (e) => {
									e === p ? C(!h) : (S(e), C(e === "code"));
								}
							})
						]
					})
				] })
			}),
			q ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": X("catalog:javDiscover.loading"),
				dangerouslySetInnerHTML: { __html: st("discover", D) }
			}) : null,
			N.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				title: X("catalog:javDiscover.failed"),
				children: Ye(N.error)
			}) : null,
			s === "external" && F?.status === "running" ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(_e, {
					kind: Se("jav-discovery-metadata"),
					label: X("catalog:javMetadata.loadingProgress", {
						completed: F.completed,
						count: F.total
					}),
					value: F.completed,
					total: F.total
				})
			}) : null,
			F && F.status !== "running" && (F.status !== "complete" || F.failed > 0) ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "neutral",
				action: /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "secondary",
					...J(V.busy === "retry"),
					"aria-label": X("catalog:javMetadata.retry"),
					onClick: () => ce("retry"),
					children: X("catalog:shared.retryNow")
				}),
				children: ut(F) || X("catalog:javMetadata.progress", {
					completed: F.completed,
					count: F.total
				})
			}) : null,
			V.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				children: V.error
			}) : null,
			!q && !N.error && !ue.length ? /* @__PURE__ */ (0, $.jsx)(ee, {
				icon: E,
				title: X(r || d ? "catalog:javDiscover.noMatches" : "catalog:javDiscover.noTasteMatches"),
				actions: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/taste",
					variant: "secondary",
					children: X("catalog:javDiscover.viewTaste")
				}), r || d ? /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => {
						a(), f(""), Z({
							q: "",
							tag: ""
						});
					},
					children: X("catalog:shared.clearFilters")
				}) : s === "library" ? /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "primary",
					size: "small",
					href: "/",
					children: X("catalog:entityPage.browseCollection")
				}) : /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => n({}),
					children: X("catalog:javDiscover.findVideos")
				})] }),
				children: X(r || d ? "catalog:javDiscover.clearFiltersHint" : s === "library" ? "catalog:javDiscover.libraryEmptyHint" : "catalog:javDiscover.externalEmptyHint")
			}) : null,
			se.error ? /* @__PURE__ */ (0, $.jsx)(R, {
				tone: "error",
				children: se.error
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: ie,
				style: { "--card-ratio": j },
				children: ue.map((r) => {
					let a = St(r.taste_score ?? r.score), o = [
						a.label,
						X("catalog:javScore.taste", { score: We(r.taste_score ?? r.score) }),
						N.data?.ranking_method === "mmr" && r.ranking_score != null ? X("catalog:javScore.ranking", { score: We(r.ranking_score) }) : "",
						r.source_score == null ? "" : X("catalog:javScore.siteRating", { rating: r.source_score.toFixed(1) }),
						...zt(r.reasons, r.reason_codes, r.reason_params)
					].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, $.jsx)(Cn, {
						item: r,
						layout: D,
						javImage: T.value.javImage,
						readOnly: e,
						navigate: i,
						tag: d,
						onTag: y,
						wanting: se.busy === String(r.id),
						onWant: () => {
							se.run(String(r.id), (e) => Ce({ code: r.code }, e), () => {
								t(X("catalog:javWant.added")), Y(), N.refetch();
							});
						},
						onResource: () => n(bn(r)),
						badge: /* @__PURE__ */ (0, $.jsx)("button", {
							"data-jav-taste-score": "",
							type: "button",
							title: o,
							"aria-label": X("catalog:javScore.badgeLabel", {
								score: a.score,
								label: a.label
							}),
							className: "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
							children: /* @__PURE__ */ (0, $.jsx)(g, {
								color: a.color,
								children: a.label
							})
						})
					}, r.id);
				})
			})
		]
	});
}
export { Ln as JavPage };

//# debugId=ae8f3d25-afce-4696-ab6f-bb14e9b2884f