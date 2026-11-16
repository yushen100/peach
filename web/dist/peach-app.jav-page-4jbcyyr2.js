(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "f1d7452f-ae87-4d95-afe7-51403dd18628", e._sentryDebugIdIdentifier = "sentry-dbid-f1d7452f-ae87-4d95-afe7-51403dd18628");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, $fe21c36db05242bb$export$d7b12c4107be0d61 as a, ActivityMotion as o, ArtSlot as s, Button as c, ButtonLink as l, Bx as u, COVER_STATE_TITLE as d, CatalogViewToggle as f, Checkbox as p, ChevronSortDown as m, Chip as h, CloudDownloadDialog as g, ColumnFilterAvatar as _, CoverQueue as v, DISCOVERY_METADATA_KEY as y, DISCOVERY_SORTS as b, DOWNLOADS_KEY as x, DOWNLOADS_URL as S, DataTableFooter as C, DataTableFrame as w, E3 as T, EmptyFocusButton as E, EmptyState as D, FilterGlassRows as O, FilterIconButton as k, FilterPill as A, GlassPill as ee, HoldButton as j, IndexSearch as te, Input as ne, JAV_LAYOUTS as M, JAV_RECOMMENDATION_GRID as re, JAV_SELECTION_EVENT as N, JavHeader as P, LibraryShortcuts as F, M6 as ie, Note as I, PHASES as L, RELEASE_COLUMN_VISIBILITY_KEY as R, RELEASE_COLUMN_WIDTHS_KEY as z, RELEASE_PAGE_SIZES as ae, RELEASE_SORTS as oe, RELEASE_SORT_COLUMNS as B, SEGMENT as V, SEGMENTED_TRACK as H, ScrapeSourceLabel as U, SegmentedRadioGroup as W, Segments as se, SelectionDock as G, Shuffle as ce, SortKeys as le, SourceAvatar as ue, Table as de, TableColumnControls as fe, TableColumnFilter as K, TableColumnResizer as pe, TaskProgress as me, WANTS_KEY as he, WantMagnets as ge, Wt as _e, __toESM as ve, activityKind as ye, addWant as be, apiGet as xe, appSettingsStore as Se, avatarInner as Ce, busyProps as q, cachedMagnetStates as we, cardClass as Te, cardRatio as Ee, catalogListSkeletonCellHtml as De, columnValueSelected as Oe, composingKey as ke, controlDiscoveryMetadata as Ae, controlReleaseMetadata as je, coverArrived as Me, coverFetching as Ne, coverFetchingHtml as Pe, coverReason as Fe, coverStateAction as Ie, coverUrl as Le, discoveryArtwork as Re, discoveryKey as ze, discoveryScore as Be, entityDisplayName as Ve, entityFaceImg as He, entityPath as Ue, entityWriting as We, errorMessage as Ge, esc as Ke, facePos as qe, fetchCoverNow as Je, fetchDiscoveries as Ye, fetchDiscoveryMetadata as Xe, fetchReleaseColumn as Ze, fetchReleases as Qe, fetchWants as $e, firstGrapheme as et, fmtDur as tt, gridLayout as nt, invalidateWants as J, javContentSkeleton as rt, javLayout as it, javTagSkeleton as at, jobText as ot, joinList as st, keepPreviousData as ct, lastSearchNote as lt, leadingGraphemes as ut, logoUrl as dt, metadataInterval as ft, pageWindow as pt, pv as mt, qE as ht, queryClient as gt, recommendationScore as _t, relayoutCovers as vt, releaseColumnSelection as yt, releaseColumnValues as bt, releaseColumns as xt, releaseFilters as St, releaseKey as Ct, removeWants as wt, require_jsx_runtime as Tt, require_react as Et, resetWants as Dt, resourceSourceKey as Ot, restoreWants as kt, searchNote as At, selectRange as jt, selectionSummary as Mt, serverLabelList as Nt, setReleaseColumn as Pt, spriteGlyph as Ft, storeJavLayout as It, suppressShiftTextSelection as Lt, t as Y, textLang as Rt, tierPlaceholdersHtml as zt, toggleColumnValue as Bt, useAction as Vt, useCatalogView as Ht, useDense as Ut, useEntityNames as Wt, useQuery as X, useTablePreferences as Gt, wantName as Kt, wantsInterval as qt, wireHorizontalScroller as Jt, writeJavQuery as Z } from "./peach-app.js";
import { JavBatchResources as Yt } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
import { ErrorLine as Xt } from "./peach-app.source-view-Dyh_AG3b.js";
// src/react/jav/jav-selection.tsx
var Q = /* @__PURE__ */ ve(Et(), 1), $ = Tt(), Zt = (0, Q.createContext)(null), Qt = () => (0, Q.useContext)(Zt);
function $t(e) {
	let t = Qt()?.visible;
	(0, Q.useEffect)(() => {
		t?.(e);
	}, [e, t]);
}
function en({ children: e, readOnly: t, receipt: n, dock: r = !0 }) {
	let i = Ut(), [a, o] = (0, Q.useState)(!1), [s, l] = (0, Q.useState)(/* @__PURE__ */ new Map()), [u, d] = (0, Q.useState)([]), [f, p] = (0, Q.useState)(null), m = (0, Q.useRef)(null), h = new Set(s.keys()), g = Mt(h, u.map((e) => e.code)), _ = (0, Q.useCallback)((e) => {
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
		return window.addEventListener(N, e), () => window.removeEventListener(N, e);
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
			jt(i, u.map((e) => e.code), n, e.code, t);
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
			label: Y("catalog:javSelection.addToWants"),
			reversal: "undo",
			confirm: (e) => ({
				title: Y("catalog:javSelection.addToWants"),
				body: Y("catalog:javSelection.wantConfirm", { count: e.length })
			}),
			run: async (n) => {
				try {
					for (let r of n) if (!e.has(r.code)) {
						try {
							let e = await be({ code: r.code });
							e?.created && t.push(e.want.id);
						} catch (t) {
							throw Error(Y("catalog:javSelection.wantPartialFailed", {
								count: e.size,
								code: r.code,
								error: Ge(t)
							}));
						}
						e.add(r.code), l((e) => {
							let t = new Map(e);
							return t.delete(r.code), t;
						});
					}
				} finally {
					J();
				}
				return async () => {
					t.length && await wt(t), await J();
				};
			},
			receipt: () => Y("catalog:javSelection.wantAdded", { count: e.size })
		};
	})(), C = { receipt: n };
	return /* @__PURE__ */ (0, $.jsxs)(Zt.Provider, {
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
			/* @__PURE__ */ (0, $.jsxs)(G, {
				visible: r && a,
				count: Y("catalog:javSelection.selectedCount", { count: s.size }),
				label: Y("catalog:javSelection.dockLabel"),
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
						children: g.all ? Y("catalog:javSelection.deselectPage") : Y("catalog:javSelection.selectPage")
					})
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !s.size,
					onClick: () => p([...s.values()]),
					children: Y("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: v,
					children: Y("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(Yt, {
				items: f,
				close: () => p(null),
				readOnly: t,
				receipt: n
			})
		]
	});
}
// src/react/wants/want-list.tsx
var tn = {
	code: Y("catalog:wants.originManual"),
	feed: Y("catalog:entityHero.subscribeNewReleases"),
	follow: Y("catalog:entityHero.following")
}, nn = [
	["all", Y("catalog:shared.all")],
	["available", Y("catalog:wants.hasMagnet")],
	["missing", Y("catalog:wants.noMagnet")]
], rn = (e) => [
	e.release_date,
	e.studio,
	e.performers,
	tn[e.origin]
].filter(Boolean).join(" · ");
function an({ want: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "relative inline-grid w-card-cover shrink-0 aspect-card-cover place-items-center overflow-hidden rounded-2lg bg-media-placeholder max-sm:w-24",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-caption-1-regular text-text-secondary",
			children: Y("catalog:shared.noCover")
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
function on({ want: e, readOnly: t, busy: n, onReset: r, onRemove: i, onCloudDownload: a, downloads: o, provider: s, toast: u, picked: d }) {
	let [f, m] = (0, Q.useState)([]), h = e.link || (!f.length && e.code ? `https://javdb.com/search?q=${encodeURIComponent(e.code)}&f=all` : ""), g = h && URL.canParse(h) ? new URL(h).hostname.replace(/^www\./, "") : "", _ = Ot(e.follow_provider || g.split(".")[0] || ""), v = _ === "javdb" ? "JavDB" : _ === "javbus" ? "JavBus" : g, y = h && g && !f.some((e) => e.source === _) ? [{
		source: _,
		label: v,
		url: h
	}, ...f] : f, b = e.code && e.phase === "searching" ? lt(e) : At(e);
	return /* @__PURE__ */ (0, $.jsxs)("li", {
		"data-want-id": e.id,
		className: Te({ className: "flex flex-col gap-4 max-sm:p-4" }),
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 items-start gap-4 max-sm:gap-3",
			children: [
				d ? /* @__PURE__ */ (0, $.jsx)(p, {
					slot: null,
					className: "mt-1 shrink-0 self-start",
					"aria-label": Y("catalog:wants.selectRow", { name: Kt(e) }),
					isSelected: d.on,
					onChange: d.toggle
				}) : null,
				/* @__PURE__ */ (0, $.jsx)(an, { want: e }),
				/* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col gap-1",
					children: [
						/* @__PURE__ */ (0, $.jsxs)("p", {
							className: "flex min-w-0 flex-wrap items-baseline gap-x-2",
							children: [/* @__PURE__ */ (0, $.jsx)("b", {
								className: "min-w-0 text-headline-medium wrap-anywhere text-text-primary",
								children: Kt(e)
							}), e.code && e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
								className: "min-w-0 truncate text-body-2-regular text-text-secondary",
								children: e.title
							}) : null]
						}),
						rn(e) ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: rn(e)
						}) : null,
						b ? /* @__PURE__ */ (0, $.jsx)("p", {
							"data-want-note": "",
							className: "text-caption-1-regular text-text-secondary",
							children: b
						}) : null,
						e.scrape_error ? /* @__PURE__ */ (0, $.jsx)(Xt, {
							text: e.scrape_error,
							prefix: Y("catalog:wants.metadataNotFound"),
							tone: "muted"
						}) : null,
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-want-actions": "",
							className: "mt-1 flex flex-wrap items-center gap-2",
							children: [
								y.map((e) => /* @__PURE__ */ (0, $.jsx)(l, {
									"data-button-link": "",
									variant: "secondary",
									size: "small",
									trailingIcon: _e,
									href: e.url,
									target: "_blank",
									rel: "noopener noreferrer",
									children: /* @__PURE__ */ (0, $.jsx)(U, {
										source: e.source,
										label: e.label
									})
								}, e.source)),
								e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "secondary",
									size: "small",
									disabled: t,
									...q(n === `reset:${e.id}`),
									onClick: r,
									children: Y("catalog:wants.searchAgain")
								}) : null,
								e.phase === "searching" || e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "primary",
									size: "small",
									leadingIcon: mt,
									onClick: a,
									children: Y("catalog:shared.searchTorrents")
								}) : null,
								/* @__PURE__ */ (0, $.jsx)(j, {
									variant: "danger",
									size: "small",
									leadingIcon: ie,
									disabled: t,
									...q(n === `remove:${e.id}`),
									onClick: i,
									children: Y("catalog:shared.remove")
								})
							]
						})
					]
				})
			]
		}), e.code && (e.phase === "searching" || e.phase === "given_up") ? /* @__PURE__ */ (0, $.jsx)(ge, {
			want: e,
			readOnly: t,
			downloads: o,
			provider: s,
			toast: u,
			onSources: m
		}) : null]
	});
}
function sn({ phase: e, label: t, rows: n, row: r }) {
	let [i, o] = (0, Q.useState)(1), [s, l] = (0, Q.useState)(20), [u, d] = (0, Q.useState)("all"), f = we(n), p = (e) => e.has_magnets ?? f.get(e.code || "") ?? !1, m = n.filter(p), h = e !== "searching" || u === "all" ? n : n.filter((e) => p(e) === (u === "available")), g = pt(h.length, s, i);
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
				}), e === "searching" ? /* @__PURE__ */ (0, $.jsx)(W, {
					name: "want-magnet-filter",
					"aria-label": Y("catalog:wants.magnetFilter"),
					orientation: "horizontal",
					value: u,
					className: H,
					onChange: (e) => {
						d(e), o(1);
					},
					children: nn.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)(a, {
						value: e,
						"aria-label": t,
						className: V,
						children: [t, /* @__PURE__ */ (0, $.jsx)("span", {
							className: "text-caption-1-regular tabular-nums text-text-tertiary",
							children: (e === "all" ? n.length : e === "available" ? m.length : n.length - m.length).toLocaleString()
						})]
					}, e))
				}) : null]
			}),
			h.length ? null : /* @__PURE__ */ (0, $.jsx)(D, {
				size: "compact",
				icon: ht,
				title: Y("catalog:wants.noFilterMatches"),
				actions: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: () => {
						d("all"), o(1);
					},
					children: Y("catalog:shared.viewAll")
				}),
				children: null
			}),
			/* @__PURE__ */ (0, $.jsx)("ul", {
				className: "flex flex-col gap-4",
				children: h.slice(g.start, g.end).map(r)
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-want-pager": "",
				children: /* @__PURE__ */ (0, $.jsx)(C, {
					label: t,
					total: g.total,
					pagination: {
						pageIndex: g.page - 1,
						pageSize: s
					},
					onChange: (e) => {
						l(e.pageSize), o(e.pageIndex + 1);
					},
					unit: Y("catalog:wants.itemUnit")
				})
			})
		]
	});
}
function cn({ readOnly: e, toast: t, query: n = "", clearQuery: r }) {
	let [i, a] = (0, Q.useState)(""), [o, s] = (0, Q.useState)(null), l = Vt(), u = X({
		queryKey: he,
		queryFn: ({ signal: e }) => $e(e),
		staleTime: 3e4,
		refetchInterval: qt
	}), d = () => {
		let n = i.trim();
		n && !e && l.run("add", (e) => be({ code: n }, e), (e) => {
			t(e.created ? Y("catalog:wants.added", { name: Kt(e.want) }) : Y("catalog:wants.alreadyAdded", { name: Kt(e.want) })), a(""), J();
		});
	}, f = (e) => {
		e.key === "Enter" && !ke(e.nativeEvent) && (e.preventDefault(), d());
	}, p = (e) => {
		l.run(`remove:${e.id}`, (t) => wt([e.id], t), () => {
			t(Y("catalog:wants.removed", { name: Kt(e) })), J();
		});
	}, m = (e) => {
		l.run(`reset:${e.id}`, (t) => Dt([e.id], t), () => {
			t(Y("catalog:wants.backToSearching", { name: Kt(e) })), J();
		});
	}, h = u.data, _ = (h?.items || []).filter((e) => !n || [
		e.code,
		e.title,
		e.performers
	].join(" ").toLocaleLowerCase().includes(n.toLocaleLowerCase())), v = Qt(), y = !!v?.mode, [b, C] = (0, Q.useState)(/* @__PURE__ */ new Set()), [w, T] = (0, Q.useState)(null);
	(0, Q.useEffect)(() => {
		y || C(/* @__PURE__ */ new Set());
	}, [y]);
	let O = _.filter((e) => b.has(e.id)), k = _.length > 0 && O.length === _.length, A = { receipt: t }, ee = {
		key: "remove",
		label: Y("catalog:shared.remove"),
		reversal: "undo",
		danger: !0,
		holdToConfirm: !0,
		confirm: (e) => ({
			title: Y("catalog:wants.removeMany"),
			body: Y("catalog:wants.removeManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await wt(e.map((e) => e.id));
			return await J(), async () => {
				await kt(t), await J();
			};
		},
		receipt: (e) => Y("catalog:wants.removedMany", { count: e.length })
	}, j = {
		key: "reset",
		label: Y("catalog:wants.searchAgain"),
		reversal: "undo",
		confirm: (e) => ({
			title: Y("catalog:wants.searchAgainMany"),
			body: Y("catalog:wants.searchAgainManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await Dt(e.map((e) => e.id));
			return await J(), async () => {
				await kt(t), await J();
			};
		},
		receipt: (e) => Y("catalog:wants.searchAgainDone", { count: e.length })
	}, te = O.filter((e) => e.code && (e.phase === "searching" || e.phase === "given_up")), M = X({
		queryKey: x,
		queryFn: ({ signal: e }) => xe(`${S}?limit=100`, e),
		enabled: _.some((e) => e.code && (e.phase === "searching" || e.phase === "given_up"))
	}), re = M.data?.providers.filter((e) => e.configured) || [], N = re[0]?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"aria-busy": u.isPending,
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: Te({
					padding: "none",
					className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
				}),
				children: [
					/* @__PURE__ */ (0, $.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: Y("catalog:wants.addByCode")
					}),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-wrap items-end gap-2",
						children: [/* @__PURE__ */ (0, $.jsx)("div", {
							className: "min-w-64 grow max-sm:min-w-0",
							children: /* @__PURE__ */ (0, $.jsx)(ne, {
								"aria-label": Y("catalog:shared.code"),
								placeholder: Y("catalog:wants.codePlaceholder"),
								value: i,
								isDisabled: e,
								onChange: a,
								onKeyDown: f
							})
						}), /* @__PURE__ */ (0, $.jsx)(c, {
							variant: "primary",
							disabled: e || !i.trim(),
							...q(l.busy === "add"),
							onClick: d,
							children: Y("catalog:shared.add")
						})]
					}),
					l.error ? /* @__PURE__ */ (0, $.jsx)(I, {
						tone: "error",
						title: Y("catalog:wants.actionFailed"),
						children: l.error
					}) : null
				]
			}),
			u.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				title: Y("catalog:wants.loadFailed"),
				children: Ge(u.error)
			}) : null,
			u.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": Y("catalog:wants.loading"),
				dangerouslySetInnerHTML: { __html: rt("wants") }
			}) : null,
			h?.scraping ? /* @__PURE__ */ (0, $.jsx)(me, {
				embedded: !0,
				kind: ye("want-scrape"),
				label: Y("catalog:wants.fetchingNew")
			}) : null,
			h?.searching ? /* @__PURE__ */ (0, $.jsx)(me, {
				embedded: !0,
				kind: ye("want-search"),
				label: Y("catalog:wants.searchingResources")
			}) : null,
			M.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				title: Y("catalog:wants.downloadSettingsFailed"),
				children: Ge(M.error)
			}) : null,
			M.data && !re.length ? /* @__PURE__ */ (0, $.jsxs)(I, {
				tone: "neutral",
				children: [
					Y("shell:downloadChannels.notConfigured"),
					Y("shell:format.sentenceGap"),
					/* @__PURE__ */ (0, $.jsx)("a", {
						href: "/settings/downloads",
						children: Y("shell:downloadChannels.settingsLink")
					})
				]
			}) : null,
			M.data && !M.data.available ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "neutral",
				children: Y("catalog:wants.cloudPrimaryOnly")
			}) : null,
			h && !_.length ? /* @__PURE__ */ (0, $.jsx)(D, {
				size: "compact",
				icon: ht,
				title: Y(n ? "catalog:wants.noSearchMatches" : "catalog:wants.empty"),
				actions: n && r ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: r,
					children: Y("catalog:shared.clearSearch")
				}) : !n && !e ? /* @__PURE__ */ (0, $.jsx)(E, {
					target: `input[aria-label="${Y("catalog:shared.code")}"]`,
					children: Y("catalog:wants.addWork")
				}) : void 0,
				children: Y(n ? "catalog:wants.tryOtherSearch" : "catalog:wants.emptyHint")
			}) : null,
			L.map(([n, r]) => {
				let i = _.filter((e) => e.phase === n);
				return i.length ? /* @__PURE__ */ (0, $.jsx)(sn, {
					phase: n,
					label: r,
					rows: i,
					row: (n) => /* @__PURE__ */ (0, $.jsx)(on, {
						want: n,
						readOnly: e,
						busy: l.busy,
						downloads: M.data,
						provider: N,
						toast: t,
						picked: y ? {
							on: b.has(n.id),
							toggle: (e) => C((t) => {
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
			/* @__PURE__ */ (0, $.jsx)(g, {
				prefill: o,
				close: () => s(null),
				receipt: t,
				provider: N
			}),
			/* @__PURE__ */ (0, $.jsxs)(G, {
				visible: y,
				label: Y("catalog:wants.dockLabel"),
				count: Y("catalog:javSelection.selectedCount", { count: O.length }),
				actions: [{
					action: ee,
					items: O,
					host: A,
					disabled: e,
					done: () => C(/* @__PURE__ */ new Set())
				}, {
					action: j,
					items: O.filter((e) => e.phase === "given_up"),
					host: A,
					disabled: e,
					done: () => C(/* @__PURE__ */ new Set())
				}],
				leading: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !_.length,
					onClick: () => C(k ? /* @__PURE__ */ new Set() : new Set(_.map((e) => e.id))),
					children: Y(k ? "catalog:javSelection.deselectPage" : "catalog:wants.selectAll")
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !te.length,
					onClick: () => T(te.map((e) => ({
						id: e.id,
						code: e.code,
						title: e.title || "",
						release_date: e.release_date || void 0
					}))),
					children: Y("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: () => v?.close(),
					children: Y("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(Yt, {
				items: w,
				close: () => T(null),
				readOnly: e,
				receipt: t
			})
		]
	});
}
// src/react/jav/discovery-faces.tsx
function ln({ item: e }) {
	Wt();
	let t = e.performer_refs?.length ? e.performer_refs : [...new Set(e.performers.split(/[,，、;/]/).filter(Boolean))].map((e) => ({ name: e })), n = t.slice(0, 5).map((t, n) => {
		let r = { "--media-avatar-index": n }, i = t.source_avatar && t.source_actor_id && !t.has_image ? { children: /* @__PURE__ */ (0, $.jsx)(ue, {
			code: e.code,
			person: t
		}) } : { dangerouslySetInnerHTML: { __html: Ce(t.name, t, null) } };
		return t.id ? /* @__PURE__ */ (0, $.jsx)("a", {
			"data-media-avatar": "",
			style: r,
			href: Ue("performer", t.name, t.id),
			"aria-label": Y("catalog:javDiscovery.openActress", { name: Ve("performer", t.name, t.id) }),
			...i
		}, t.name) : /* @__PURE__ */ (0, $.jsx)("span", {
			"data-media-avatar": "",
			style: r,
			title: Ve("performer", t.name),
			...i
		}, t.name);
	});
	return t.length > 1 ? /* @__PURE__ */ (0, $.jsx)("div", {
		"data-media-avatars": "",
		style: { "--media-avatar-count": Math.min(5, t.length) },
		children: n
	}) : n[0] || null;
}
// src/react/jav/discovery-card.tsx
var un = (e) => ({
	...e,
	cover: e.has_cover ? Le(e, !0) : e.cover_url,
	origin: `${e.asset_id ? "asset" : "feed"}:${e.id}`
}), dn = "relative inline-grid place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default";
function fn({ item: e, readOnly: t }) {
	let n = Vt(), [r, i] = (0, Q.useState)("");
	(0, Q.useSyncExternalStore)(Ne.subscribe, Ne.revision);
	let a = e.cover_state;
	if (!a) return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-media-nopic": "",
		children: Y("catalog:shared.noCover")
	});
	if (a === "fetching" || Ne.has(e.code)) return /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Pe() } });
	let s = () => {
		n.run("cover", (t) => Je(e.code, t), (t) => {
			t.has_cover ? Me(e.code, t) : i(t.message || Y("catalog:javDiscovery.noOfficialCover"));
		});
	}, l = r || n.error ? "missing" : a, u = n.error || r || Fe(e);
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
				children: Ie(l)
			})
		]
	});
}
function pn({ item: e, layout: t, javImage: n, readOnly: r, navigate: i, tag: a, onTag: o, wanting: u, onWant: d, onResource: f, badge: p }) {
	let m = Qt(), h = m?.selected.has(e.code), g = !!m?.dense, _ = e.performer_refs?.length ? st(e.performer_refs.map((e) => e.name)) : e.performers, v = Re(e, t, n), y = e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`;
	return /* @__PURE__ */ (0, $.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-selected": h ? "" : void 0,
		onMouseDown: Lt,
		onClickCapture: (t) => {
			m && (m.mode || t.shiftKey || t.ctrlKey || t.metaKey) && (t.preventDefault(), t.stopPropagation(), m.toggle(e, t.shiftKey));
		},
		onClick: (e) => {
			e.target.closest("a,button,input") || i(y);
		},
		children: [
			v ? /* @__PURE__ */ (0, $.jsx)("a", {
				href: y,
				"aria-label": Y("catalog:javDiscovery.viewDetails", { code: e.code }),
				onClick: (e) => {
					e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0 || (e.preventDefault(), i(y));
				},
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: dn,
				children: /* @__PURE__ */ (0, $.jsx)(s, {
					artwork: {
						kind: "cover",
						html: v
					},
					identity: Re(e, "small", n),
					relayout: (e) => vt(e, t)
				})
			}) : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: dn,
				children: /* @__PURE__ */ (0, $.jsx)(fn, {
					item: e,
					readOnly: r
				})
			}),
			m?.mode ? /* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				"data-media-check": "",
				"aria-label": Y("catalog:javDiscovery.select", { code: e.code }),
				"aria-pressed": !!h,
				children: /* @__PURE__ */ (0, $.jsx)("svg", {
					viewBox: "0 0 24 24",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-check" })
				})
			}) : null,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				"data-media-meta": "",
				children: [/* @__PURE__ */ (0, $.jsx)(ln, { item: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-media-text": "",
					children: [
						/* @__PURE__ */ (0, $.jsxs)("h3", {
							"data-jav-title": "",
							"data-media-title": "",
							title: `${e.code} · ${e.title || Y("catalog:javDiscovery.titleNotFound")}`,
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: e.code }),
								" ",
								e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: Rt(e.title),
									children: e.title
								}) : Y("catalog:javDiscovery.titleNotFound")
							]
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-media-byline": "",
							children: [
								e.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsxs)("a", {
									"data-media-who": "",
									href: Ue("performer", e.performer_refs[0].name),
									title: _,
									children: [/* @__PURE__ */ (0, $.jsx)("svg", {
										viewBox: "0 0 24 24",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-user-round" })
									}), /* @__PURE__ */ (0, $.jsx)("span", { children: e.performer_refs[0].name })]
								}) : /* @__PURE__ */ (0, $.jsxs)("span", {
									"data-media-who": "",
									title: _,
									children: [/* @__PURE__ */ (0, $.jsx)("svg", {
										viewBox: "0 0 24 24",
										"aria-hidden": "true",
										children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-user-round" })
									}), /* @__PURE__ */ (0, $.jsx)("span", { children: e.performer_refs?.[0]?.name || _ })]
								}),
								(e.performer_refs?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
									"data-media-who-more": "",
									children: Y("catalog:javDiscovery.morePeople", {
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
				"data-compact": g ? "" : void 0,
				"data-has-source": e.link ? "" : void 0,
				className: "flex flex-wrap gap-2",
				children: [
					e.link ? /* @__PURE__ */ (0, $.jsx)(l, {
						"data-button-link": "",
						"data-jav-source": "",
						variant: "secondary",
						size: g ? "small" : "medium",
						iconOnly: g,
						"aria-label": Y("catalog:shared.viewOnSite"),
						title: Y("catalog:shared.viewOnSite"),
						leadingIcon: g ? _e : void 0,
						trailingIcon: g ? void 0 : _e,
						href: e.link,
						target: "_blank",
						rel: "noopener noreferrer",
						children: g ? null : Y("catalog:shared.viewOnSite")
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "ghost",
						size: g ? "small" : "medium",
						disabled: r || e.wanted || !!e.asset_id,
						...q(u),
						onClick: d,
						children: e.asset_id ? Y("catalog:javWant.imported") : e.wanted ? Y("catalog:javWant.wanted") : Y("catalog:javWant.want")
					}),
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "secondary",
						size: g ? "small" : "medium",
						onClick: f,
						children: Y("catalog:shared.searchTorrents")
					})
				]
			})
		]
	});
}
// src/react/jav/jav-release-table.tsx
var mn = {
	widths: z,
	visibility: R
};
function hn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return e?.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
		"data-list-studio-mark": "",
		src: dt(e.name, "icon", e.logo_version),
		alt: "",
		width: 16,
		height: 16,
		loading: "lazy",
		decoding: "async",
		onError: () => n(!0)
	}) : /* @__PURE__ */ (0, $.jsx)("span", {
		"data-list-studio-mark": "",
		"aria-hidden": "true",
		children: ut(e?.name || "", 1)
	});
}
function gn({ column: e, label: t, filters: n, onChange: r }) {
	let i = e === "people" ? "performer" : e === "tags" ? "tag" : "studio", a = Pt(n, i, void 0);
	return /* @__PURE__ */ (0, $.jsx)(K, {
		id: e,
		label: t,
		values: yt(n, i),
		load: async (t, n, r) => {
			let i = await Ze(a, e, n, r, t);
			return {
				items: i.items.map((t) => {
					let n = e === "people" ? t : null, r = n && We("performer", n.name, n.id);
					return {
						id: t.name,
						label: t.name,
						count: t.count,
						searchTerms: [...n?.aliases || [], ...[r?.ja, r?.zh_cn].filter((e) => !!e)],
						leading: n ? /* @__PURE__ */ (0, $.jsx)(_, { person: n }) : void 0
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
function _n({ items: a, waiting: o, filters: l, studios: u, facets: f, javImage: h, readOnly: g, navigate: _, onTag: v, onFilter: y, onSort: b, wanting: x, onWant: S, onResource: C }) {
	let T = Qt(), E = Gt("jav-releases", xt, mn), D = xt.filter((e) => e.required || E.visibility[e.id] !== !1), O = Object.entries(B).find(([, e]) => e === l.sort)?.[0], k = new Map(u.map((e) => [e.name, e])), A = (e) => (t) => {
		t.preventDefault(), T?.mode || t.shiftKey || t.ctrlKey || t.metaKey ? T?.toggle(e, t.shiftKey) : _(`/works/${encodeURIComponent(e.code)}`);
	}, ee = (e, t) => {
		let n = t.performer_refs?.[0]?.name || t.performers.split(/[,，、;/]/)[0] || "";
		switch (e) {
			case "name": {
				let e = Re(t, "small", h);
				return /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-list-identity": "",
					children: [/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						"data-list-open": "",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: A(t),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-list-picture": "",
							children: e ? /* @__PURE__ */ (0, $.jsx)(s, {
								artwork: {
									kind: "cover",
									html: e
								},
								relayout: (e) => vt(e, "small")
							}) : /* @__PURE__ */ (0, $.jsx)("span", {
								title: Fe(t) || void 0,
								children: t.cover_state ? d[t.cover_state] : Y("catalog:shared.noCover")
							})
						})
					}), /* @__PURE__ */ (0, $.jsx)("span", {
						"data-list-text": "",
						children: /* @__PURE__ */ (0, $.jsxs)("button", {
							type: "button",
							"data-list-name": "",
							title: `${t.code} · ${t.title || Y("catalog:javDiscovery.titleNotFound")}`,
							"aria-label": Y("catalog:javDiscovery.viewDetails", { code: t.code }),
							onClick: A(t),
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: t.code }),
								" ",
								t.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: Rt(t.title),
									children: t.title
								}) : Y("catalog:javDiscovery.titleNotFound")
							]
						})
					})]
				});
			}
			case "people": return n ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-list-people": "",
				children: [
					/* @__PURE__ */ (0, $.jsx)(ln, { item: t }),
					t.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsx)("a", {
						"data-media-who": "",
						href: Ue("performer", n),
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}) : /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who": "",
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}),
					(t.performer_refs?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who-more": "",
						children: Y("catalog:javDiscovery.morePeople", {
							count: t.performer_refs.length - 1,
							total: t.performer_refs.length
						})
					}) : null
				]
			}) : "—";
			case "studio": return t.studio ? /* @__PURE__ */ (0, $.jsxs)("span", {
				"data-list-library": "",
				title: t.studio,
				children: [/* @__PURE__ */ (0, $.jsx)(hn, { studio: t.studio_ref || k.get(t.studio) }), /* @__PURE__ */ (0, $.jsx)("span", { children: t.studio })]
			}) : "—";
			case "tags": return t.tags?.length ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-tags": "",
				"data-list-tags": "",
				children: t.tags.map((e) => /* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					"data-media-tag": "",
					"aria-pressed": bt(l, "tag").includes(e),
					onClick: () => v(e),
					children: e
				}, e))
			}) : "—";
			case "code": return t.code;
			case "dur": return tt(t.duration) || "—";
			case "score": return t.source_score == null ? "—" : `${t.source_score.toFixed(2)} / 5`;
			case "release": return t.release_date || "—";
			default: return /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-release-actions": "",
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					disabled: g || t.wanted || !!t.asset_id,
					...q(x(t)),
					onClick: () => S(t),
					children: t.wanted ? Y("catalog:javWant.wanted") : Y("catalog:javWant.want")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					onClick: () => C(t),
					children: Y("catalog:shared.searchTorrents")
				})]
			});
		}
	};
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"data-catalog-table": "",
		"data-release-table": "",
		className: "flex min-w-0 flex-col gap-4",
		children: [/* @__PURE__ */ (0, $.jsx)("div", {
			className: "flex flex-wrap justify-end gap-2",
			role: "toolbar",
			"aria-label": Y("catalog:javReleases.toolbar"),
			children: /* @__PURE__ */ (0, $.jsx)("div", {
				"data-toolbar-actions": "",
				children: /* @__PURE__ */ (0, $.jsx)(fe, {
					preferences: E,
					label: Y("catalog:javReleases.list")
				})
			})
		}), /* @__PURE__ */ (0, $.jsx)(w, {
			follow: !0,
			preferences: E,
			children: /* @__PURE__ */ (0, $.jsxs)(de, {
				"aria-label": Y("catalog:javReleases.list"),
				size: "sm",
				sortDescriptor: O ? {
					column: O,
					direction: l.dir === "asc" ? "ascending" : "descending"
				} : void 0,
				onSortChange: (e) => {
					let t = B[String(e.column)];
					t && b(t, e.direction === "ascending" ? "asc" : "desc");
				},
				children: [/* @__PURE__ */ (0, $.jsxs)(i, { children: [
					T?.mode ? /* @__PURE__ */ (0, $.jsx)(t, {
						id: "selection",
						width: 44,
						"aria-label": Y("catalog:javReleases.selectVideos"),
						children: /* @__PURE__ */ (0, $.jsx)(p, {
							slot: null,
							"aria-label": Y("catalog:catalogList.selectAllOnPage"),
							isSelected: T.all,
							isIndeterminate: T.mixed,
							isDisabled: o || !a.length,
							onChange: T.selectPage
						})
					}) : null,
					D.map((e) => /* @__PURE__ */ (0, $.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === "name",
						allowsSorting: e.id in B,
						...E.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [f && y && [
								"people",
								"studio",
								"tags"
							].includes(e.id) ? /* @__PURE__ */ (0, $.jsx)(gn, {
								column: e.id,
								label: e.label,
								filters: l,
								onChange: y
							}) : e.label, e.id in B ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, $.jsx)(m, {})
							}) : null]
						}), /* @__PURE__ */ (0, $.jsx)(pe, {
							preferences: E,
							id: e.id
						})] })
					}, e.id)),
					/* @__PURE__ */ (0, $.jsx)(t, {
						id: "remaining-space",
						"aria-label": Y("catalog:catalogList.rowSpacer"),
						"data-table-space": "",
						width: E.spaceWidth,
						minWidth: 0
					})
				] }), /* @__PURE__ */ (0, $.jsx)(e, {
					renderEmptyState: () => Y("catalog:javReleases.noMatches"),
					children: o ? Array.from({ length: 6 }, (e, t) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: `skeleton-${t}`,
						"data-list-skeleton-row": "",
						"aria-hidden": "true",
						children: [
							T?.mode ? /* @__PURE__ */ (0, $.jsx)(r, {}) : null,
							D.map((e) => /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: De(e.id) } }) }, e.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, `skeleton-${t}`)) : a.map((e) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: String(e.id),
						"data-catalog-row": "",
						"data-release-row": "",
						children: [
							T?.mode ? /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)(p, {
								slot: null,
								"aria-label": Y("catalog:javDiscovery.select", { code: e.code }),
								isSelected: T.selected.has(e.code),
								onChange: () => T.toggle(e)
							}) }) : null,
							D.map((t) => /* @__PURE__ */ (0, $.jsx)(r, { children: ee(t.id, e) }, t.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, e.id))
				})]
			})
		})]
	});
}
// src/react/jav/jav-releases.tsx
var vn = `<div data-catalog-tier="performers" data-skeleton="tiers">${zt("performer")}</div><div data-catalog-tier="studios">${zt("studio")}</div>`, yn = (e) => `<span data-tier-initial>${Ke(et(Ve("performer", e.name, e.id)))}</span>${He({
	id: e.id,
	hasImage: e.has_image,
	version: e.image_version,
	style: qe(e.avatar_focus),
	focus: e.avatar_focus,
	standIn: e.avatar_stand_in
})}`;
function bn({ value: e }) {
	let t = _t(e);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-jav-taste-score": "",
		title: Y("catalog:javScore.taste", { score: t.score }),
		children: /* @__PURE__ */ (0, $.jsx)(h, {
			color: t.color,
			children: t.label
		})
	});
}
function xn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-tier-mark": "",
		children: e.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: dt(e.name, "icon", e.logo_version),
			alt: "",
			width: 28,
			height: 28,
			loading: "lazy",
			decoding: "async",
			onError: () => n(!0)
		}) : ut(e.name, 2)
	});
}
var Sn = (e) => Je(e).then((t) => (t.has_cover && Me(e, t), t.has_cover));
function Cn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	Wt();
	let [o, s] = (0, Q.useState)(() => St(location.search));
	(0, Q.useEffect)(() => {
		r !== o.q && (s((e) => ({
			...e,
			q: r,
			page: 1
		})), Z({ page: "" }));
	}, [r, o.q]);
	let d = (e, t) => {
		let n = Pt(o, e, t);
		s(n), Z({
			[e]: "",
			column_filters: n.column_filters || "",
			page: ""
		});
	}, p = (e, t) => {
		let n = yt(o, e);
		d(e, n === void 0 ? [t] : Bt(n, t, !Oe(n, t)));
	}, m = (0, Q.useRef)(null), h = ({ pageIndex: e, pageSize: t }) => {
		let n = e + 1;
		s((e) => ({
			...e,
			page: n,
			size: t
		})), Z({
			page: n > 1 ? String(n) : "",
			size: t === 24 ? "" : String(t)
		}), m.current?.scrollIntoView({ block: "start" });
	}, g = () => {
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
	}, _ = (e) => b(e, e === o.sort ? o.dir === "asc" ? "desc" : "asc" : e === "code" ? "asc" : "desc"), b = (e, t) => {
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
	}, x = () => {
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
		let e = [...m.current?.querySelectorAll("[data-catalog-tier],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Jt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let S = Se();
	(0, Q.useSyncExternalStore)(S.subscribe, S.version, S.version);
	let w = it(), T = Ht(), E = Ee(nt({
		active: !0,
		home: !1,
		portrait: !1
	})), k = X({
		queryKey: Ct(o),
		queryFn: ({ signal: e }) => Qe(o, e),
		placeholderData: ct,
		retry: !1,
		refetchOnWindowFocus: !1
	}), j = k.data?.metadata_job, te = (0, Q.useRef)(!1);
	te.current = j?.status === "running";
	let ne = gt.getQueryData(y)?.metadata_job, N = X({
		queryKey: y,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: j?.status === "running" || ne?.status === "running",
		queryFn: ({ signal: e }) => Xe(e),
		refetchInterval: ft(() => te.current)
	}), P = N.data && N.dataUpdatedAt >= k.dataUpdatedAt ? N.data.metadata_job : j, F = P?.status === "running", ie = (0, Q.useRef)(!1);
	(0, Q.useEffect)(() => {
		ie.current && !F && k.refetch(), ie.current = F;
	}, [F, k]);
	let L = (0, Q.useRef)(""), R = JSON.stringify([
		o.performer,
		o.studio,
		o.tag,
		o.column_filters,
		o.q,
		o.sort,
		o.dir,
		o.seed
	]), z = !k.isPlaceholderData && (k.data?.metadata_unread || 0) > 0 && !F;
	(0, Q.useEffect)(() => {
		z && L.current !== R && (L.current = R, je("start", o).then(async (e) => {
			await gt.cancelQueries({ queryKey: y }), gt.setQueryData(y, e);
		}).catch(() => {}));
	}, [z, R]);
	let B = Vt(), V = (e) => {
		B.run(String(e.id), (t) => be({ code: e.code }, t), () => {
			t(Y("catalog:javWant.added")), J(), k.refetch();
		});
	}, H = k.data;
	$t(H?.items || []);
	let U = k.isPending, W = !!(o.performer || o.studio || o.tag || o.column_filters || o.q), G = Math.max(1, Math.ceil((H?.total || 0) / o.size));
	return (0, Q.useEffect)(() => {
		!H || k.isPlaceholderData || o.page <= G || (s((e) => ({
			...e,
			page: G
		})), Z({ page: G > 1 ? String(G) : "" }));
	}, [
		H,
		k.isPlaceholderData,
		o.page,
		G
	]), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: m,
		"aria-label": Y("catalog:entityHero.subscribeNewReleases"),
		"aria-busy": U || k.isFetching,
		className: "flex min-w-0 scroll-mt-24 flex-col gap-4",
		children: [
			U ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-catalog-tiers": "",
				"aria-busy": "true",
				dangerouslySetInnerHTML: { __html: vn }
			}) : null,
			H && (H.facets.performers.length || H.facets.studios.length) ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-catalog-tiers": "",
				"data-release-tiers": "",
				children: [H.facets.performers.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "performers",
					role: "group",
					"aria-label": Y("catalog:javReleases.filterByActress"),
					children: H.facets.performers.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-performer": "",
						"aria-pressed": bt(o, "performer").includes(e.name),
						title: Y("catalog:javReleases.facetCount", {
							name: Ve("performer", e.name, e.id),
							count: e.count
						}),
						onClick: () => p("performer", e.name),
						children: [/* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-ring": "",
							dangerouslySetInnerHTML: { __html: yn(e) }
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-name": "",
							children: Ve("performer", e.name, e.id)
						})]
					}, e.name))
				}) : null, H.facets.studios.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "studios",
					role: "group",
					"aria-label": Y("catalog:javReleases.filterByLabel"),
					children: H.facets.studios.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-studio": "",
						"aria-pressed": bt(o, "studio").includes(e.name),
						title: Y("catalog:javReleases.facetCount", {
							name: e.name,
							count: e.count
						}),
						onClick: () => p("studio", e.name),
						children: [
							/* @__PURE__ */ (0, $.jsx)(xn, { studio: e }),
							e.name,
							/* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: e.count
							})
						]
					}, e.name))
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(O, {
				label: Y("catalog:javReleases.filtersLabel"),
				topLabel: Y("catalog:javReleases.tagsLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: U,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-scroll": "",
					children: /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: U ? { __html: at() } : void 0,
						children: U ? null : H?.facets.tags.map((e) => /* @__PURE__ */ (0, $.jsxs)(A, {
							"data-catalog-tag": e.name,
							"data-entity-press": "",
							pressed: bt(o, "tag").includes(e.name),
							onPress: () => p("tag", e.name),
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
						children: U ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : W ? Y("catalog:javReleases.matchedCount", {
							matched: H?.total || 0,
							count: H?.candidate_total || 0
						}) : Y("catalog:countLabel.works", { count: H?.total || 0 })
					}),
					W ? /* @__PURE__ */ (0, $.jsx)(ee, {
						onPress: g,
						children: Y("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							/* @__PURE__ */ (0, $.jsx)(ce, {
								onPress: x,
								busy: o.sort === "random" && k.isFetching
							}),
							T === "cards" ? /* @__PURE__ */ (0, $.jsx)(se, {
								label: Y("catalog:entityFilter.javCardLayout"),
								value: w,
								options: M,
								onChange: It
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(f, {}),
							/* @__PURE__ */ (0, $.jsx)(le, {
								group: "releases",
								sorts: oe.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === o.sort,
									dir: o.dir
								})),
								onSort: (e) => _(e)
							})
						]
					})
				] })
			}),
			U && T === "cards" ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": Y("catalog:javReleases.loading"),
				dangerouslySetInnerHTML: { __html: rt("discover", w) }
			}) : null,
			k.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				title: Y("catalog:javReleases.failed"),
				children: Ge(k.error)
			}) : null,
			F && P ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(me, {
					kind: ye("jav-discovery-metadata"),
					label: Y("catalog:javMetadata.loadingProgress", {
						completed: P.completed,
						count: P.total
					}),
					value: P.completed,
					total: P.total
				})
			}) : null,
			e ? null : /* @__PURE__ */ (0, $.jsx)(v, {
				scope: Y("catalog:javReleases.coverQueueScope"),
				fetchOne: Sn,
				codes: (H?.items || []).filter((e) => e.cover_state === "queued" && !e.cover_url).map((e) => e.code),
				settled: (e, n) => {
					t(e === n ? Y("catalog:javReleases.coversFetched", { count: n }) : Y("catalog:javReleases.coversPartial", {
						got: e,
						count: n
					})), k.refetch();
				}
			}),
			!U && !k.error && !H?.items.length && (T === "cards" || !W) ? /* @__PURE__ */ (0, $.jsx)(D, {
				icon: u,
				title: Y(W ? "catalog:javReleases.noMatches" : "catalog:javReleases.emptyTitle"),
				actions: W ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: g,
					children: Y("catalog:shared.clearFilters")
				}) : /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/subscriptions?tab=add",
					children: Y("catalog:javReleases.addSubscription")
				}),
				children: Y(W ? "catalog:javReleases.clearFiltersHint" : "catalog:javReleases.emptyHint")
			}) : null,
			B.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				children: B.error
			}) : null,
			T === "list" ? U || H?.items.length || W ? /* @__PURE__ */ (0, $.jsx)(_n, {
				items: H?.items || [],
				waiting: U,
				filters: o,
				studios: H?.facets.studios || [],
				javImage: S.value.javImage,
				readOnly: e,
				navigate: i,
				facets: H?.facets,
				onFilter: d,
				onTag: (e) => p("tag", e),
				onSort: b,
				wanting: (e) => B.busy === String(e.id),
				onWant: V,
				onResource: (e) => n(un(e))
			}) : null : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: re,
				style: { "--card-ratio": E },
				children: (H?.items || []).map((t) => /* @__PURE__ */ (0, $.jsx)(pn, {
					item: t,
					layout: w,
					javImage: S.value.javImage,
					readOnly: e,
					navigate: i,
					tag: bt(o, "tag"),
					onTag: (e) => p("tag", e),
					wanting: B.busy === String(t.id),
					onWant: () => V(t),
					onResource: () => n(un(t)),
					badge: o.sort === "taste" ? /* @__PURE__ */ (0, $.jsx)(bn, { value: t.taste_score }) : void 0
				}, t.id))
			}),
			H ? /* @__PURE__ */ (0, $.jsx)(C, {
				label: Y("catalog:javTabs.newReleases"),
				total: H.total,
				pagination: {
					pageIndex: o.page - 1,
					pageSize: o.size
				},
				onChange: h,
				unit: Y("catalog:catalogList.footerUnit"),
				pageUnit: Y("catalog:catalogList.footerPageUnit"),
				pageSizes: ae
			}) : null
		]
	});
}
// src/react/jav/jav-page.tsx
var wn = Ft("x"), Tn = Ft("refresh-cw"), En = {
	releases: Y("catalog:javSearch.filterReleases"),
	discover: Y("catalog:javSearch.filterRecommended"),
	wants: Y("catalog:javSearch.filterWants")
};
function Dn({ tab: e, readOnly: t, navigate: n, receipt: r }) {
	let [i, a] = (0, Q.useState)(null), [o, s] = (0, Q.useState)(() => new URLSearchParams(location.search).get("q") || ""), c = (e) => {
		s(e), Z({ q: e });
	};
	return /* @__PURE__ */ (0, $.jsx)(en, {
		readOnly: t,
		receipt: r,
		dock: e !== "wants",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex w-full flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, $.jsx)(P, {
					tab: e,
					navigate: n,
					find: () => a({}),
					search: /* @__PURE__ */ (0, $.jsx)(te, {
						label: En[e] || Y("catalog:javDiscover.filter"),
						value: o,
						onQuery: c
					})
				}),
				e === "releases" ? /* @__PURE__ */ (0, $.jsx)(Cn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : e === "discover" ? /* @__PURE__ */ (0, $.jsx)(On, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : /* @__PURE__ */ (0, $.jsx)(cn, {
					readOnly: t,
					toast: r,
					query: o.trim(),
					clearQuery: () => c("")
				}),
				/* @__PURE__ */ (0, $.jsx)(g, {
					prefill: i,
					close: () => a(null),
					receipt: r
				})
			]
		})
	}, e);
}
function On({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	let o = new URLSearchParams(location.search), [s, u] = (0, Q.useState)(() => o.get("scope") === "library" ? "library" : "external"), [d, f] = (0, Q.useState)(() => o.get("tag") || ""), [p, m] = (0, Q.useState)(() => b.some(([e]) => e === o.get("sort")) ? o.get("sort") : "taste"), [g, _] = (0, Q.useState)(() => o.get("dir") === "asc"), v = (e) => {
		u(e), Z({ scope: e === "external" ? "" : e });
	}, x = (e) => {
		f(e), Z({ tag: e });
	}, S = (e) => {
		m(e), Z({ sort: e === "taste" ? "" : e });
	}, C = (e) => {
		_(e), Z({ dir: e ? "asc" : "" });
	}, w = (0, Q.useRef)(null);
	(0, Q.useEffect)(() => {
		let e = [...w.current?.querySelectorAll("[data-catalog-scroll],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Jt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let E = Se();
	(0, Q.useSyncExternalStore)(E.subscribe, E.version, E.version);
	let j = it(), te = Ee(nt({
		active: !0,
		home: !1,
		portrait: !1
	})), ne = g ? "asc" : "desc", N = X({
		queryKey: ze(s, p, ne),
		retry: !1,
		refetchOnWindowFocus: !1,
		queryFn: ({ signal: e }) => Ye(s, e, {
			sort: p,
			direction: ne
		})
	}), P = N.data?.metadata_job, ie = (0, Q.useRef)(!1);
	ie.current = P?.status === "running";
	let L = X({
		queryKey: y,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: s === "external",
		queryFn: ({ signal: e }) => Xe(e),
		refetchInterval: ft(() => ie.current)
	}), R = L.data && L.dataUpdatedAt >= N.dataUpdatedAt ? L.data.metadata_job : P, z = (e) => e ? `${e.job_id}:${e.status}` : "", ae = (0, Q.useRef)(""), oe = (0, Q.useRef)(""), B = L.data?.metadata_job;
	(0, Q.useEffect)(() => {
		let e = z(B), t = oe.current.endsWith(":running") && B && B.status !== "running";
		oe.current = e, t && e !== ae.current && N.refetch();
	}, [z(B)]);
	let V = Vt(), H = Vt(), U = async (e, t) => {
		let n = await Ae(e, {
			sort: p,
			direction: ne,
			jobId: R?.job_id
		}, t);
		e !== "start" && await N.refetch({
			cancelRefetch: !0,
			throwOnError: !0
		}), await gt.cancelQueries({ queryKey: y }), ae.current = z(n.metadata_job), gt.setQueryData(y, n);
	}, W = (e) => {
		H.run(e, (t) => U(e === "stop" ? "cancel" : "refresh", t), () => {});
	}, G = (0, Q.useRef)(!1), ce = s === "external" && R?.status !== "running" && (N.data?.items || []).some((e) => e.metadata_state === "pending" || e.metadata_state === "stale");
	(0, Q.useEffect)(() => {
		ce && !G.current && (G.current = !0, U("start").catch(() => {}));
	}, [ce]);
	let ue = N.data?.items || [], de = [...new Set(ue.flatMap((e) => e.tags || []))], fe = ue.filter((e) => (!d || e.tags?.includes(d)) && (!r || [
		e.code,
		e.title,
		e.performers,
		e.studio,
		...e.tags || [],
		...(e.performer_refs || []).map((e) => e.name)
	].join(" ").toLocaleLowerCase().includes(r.toLocaleLowerCase()))), K = N.isPending;
	return $t(fe), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: w,
		"aria-label": Y("catalog:shared.recommendedForYou"),
		"aria-busy": K,
		className: "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, $.jsx)(O, {
				label: Y("catalog:javDiscover.filtersLabel"),
				topLabel: Y("catalog:javDiscover.scopeLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: K,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-catalog-scroll": "",
					children: [/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-catalog-views": "",
						children: [[["external", Y("catalog:javDiscover.external")], ["library", Y("catalog:javDiscover.library")]].map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(A, {
							"data-entity-tag": e,
							"data-entity-press": "",
							pressed: s === e,
							onPress: () => {
								v(e), x("");
							},
							children: t
						}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-entity-sep": "",
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: K ? { __html: at() } : void 0,
						children: K ? null : de.map((e) => /* @__PURE__ */ (0, $.jsxs)(A, {
							"data-catalog-tag": e,
							"data-entity-press": "",
							pressed: d === e,
							onPress: () => x(d === e ? "" : e),
							children: [e, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: ue.filter((t) => t.tags?.includes(e)).length
							})]
						}, e))
					})]
				}),
				bottom: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-catalog-readout": "",
						children: K ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : Y("catalog:countLabel.works", { count: fe.length })
					}),
					/* @__PURE__ */ (0, $.jsx)(F, { currentHref: () => location.pathname + location.search }),
					r || d ? /* @__PURE__ */ (0, $.jsx)(ee, {
						onPress: () => {
							x(""), a();
						},
						children: Y("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							s === "external" ? /* @__PURE__ */ (0, $.jsx)(k, {
								"data-entity-batch": "",
								"data-jav-metadata-update": "",
								label: R?.status === "running" ? Y("catalog:javDiscover.stopUpdating") : Y("catalog:javDiscover.updateMetadata"),
								disabled: K,
								"data-skeleton-action": K ? "" : void 0,
								busy: !!H.busy,
								icon: R?.status === "running" ? wn : Tn,
								onPress: () => W(R?.status === "running" ? "stop" : "update")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(se, {
								label: Y("catalog:entityFilter.javCardLayout"),
								value: j,
								options: M,
								onChange: It
							}),
							/* @__PURE__ */ (0, $.jsx)(le, {
								group: "discover",
								sorts: b.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === p,
									dir: ne
								})),
								onSort: (e) => {
									e === p ? C(!g) : (S(e), C(e === "code"));
								}
							})
						]
					})
				] })
			}),
			K ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": Y("catalog:javDiscover.loading"),
				dangerouslySetInnerHTML: { __html: rt("discover", j) }
			}) : null,
			N.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				title: Y("catalog:javDiscover.failed"),
				children: Ge(N.error)
			}) : null,
			s === "external" && R?.status === "running" ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(me, {
					kind: ye("jav-discovery-metadata"),
					label: Y("catalog:javMetadata.loadingProgress", {
						completed: R.completed,
						count: R.total
					}),
					value: R.completed,
					total: R.total
				})
			}) : null,
			R && R.status !== "running" && (R.status !== "complete" || R.failed > 0) ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "neutral",
				action: /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "secondary",
					...q(H.busy === "retry"),
					"aria-label": Y("catalog:javMetadata.retry"),
					onClick: () => W("retry"),
					children: Y("catalog:shared.retryNow")
				}),
				children: ot(R) || Y("catalog:javMetadata.progress", {
					completed: R.completed,
					count: R.total
				})
			}) : null,
			H.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				children: H.error
			}) : null,
			!K && !N.error && !fe.length ? /* @__PURE__ */ (0, $.jsx)(D, {
				icon: T,
				title: Y(r || d ? "catalog:javDiscover.noMatches" : "catalog:javDiscover.noTasteMatches"),
				actions: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/taste",
					variant: "secondary",
					children: Y("catalog:javDiscover.viewTaste")
				}), r || d ? /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => {
						a(), f(""), Z({
							q: "",
							tag: ""
						});
					},
					children: Y("catalog:shared.clearFilters")
				}) : s === "library" ? /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "primary",
					size: "small",
					href: "/",
					children: Y("catalog:entityPage.browseCollection")
				}) : /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => n({}),
					children: Y("catalog:javDiscover.findVideos")
				})] }),
				children: Y(r || d ? "catalog:javDiscover.clearFiltersHint" : s === "library" ? "catalog:javDiscover.libraryEmptyHint" : "catalog:javDiscover.externalEmptyHint")
			}) : null,
			V.error ? /* @__PURE__ */ (0, $.jsx)(I, {
				tone: "error",
				children: V.error
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: re,
				style: { "--card-ratio": te },
				children: fe.map((r) => {
					let a = _t(r.taste_score ?? r.score), o = [
						a.label,
						Y("catalog:javScore.taste", { score: Be(r.taste_score ?? r.score) }),
						N.data?.ranking_method === "mmr" && r.ranking_score != null ? Y("catalog:javScore.ranking", { score: Be(r.ranking_score) }) : "",
						r.source_score == null ? "" : Y("catalog:javScore.siteRating", { rating: r.source_score.toFixed(1) }),
						...Nt(r.reasons, r.reason_codes, r.reason_params)
					].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, $.jsx)(pn, {
						item: r,
						layout: j,
						javImage: E.value.javImage,
						readOnly: e,
						navigate: i,
						tag: d,
						onTag: x,
						wanting: V.busy === String(r.id),
						onWant: () => {
							V.run(String(r.id), (e) => be({ code: r.code }, e), () => {
								t(Y("catalog:javWant.added")), J(), N.refetch();
							});
						},
						onResource: () => n(un(r)),
						badge: /* @__PURE__ */ (0, $.jsx)("button", {
							"data-jav-taste-score": "",
							type: "button",
							title: o,
							"aria-label": Y("catalog:javScore.badgeLabel", {
								score: a.score,
								label: a.label
							}),
							className: "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
							children: /* @__PURE__ */ (0, $.jsx)(h, {
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
export { Dn as JavPage };

//# debugId=f1d7452f-ae87-4d95-afe7-51403dd18628