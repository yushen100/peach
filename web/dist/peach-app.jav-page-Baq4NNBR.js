(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "99298380-dc9c-47fe-9e0c-32337f1fdf9d", e._sentryDebugIdIdentifier = "sentry-dbid-99298380-dc9c-47fe-9e0c-32337f1fdf9d");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, $fe21c36db05242bb$export$d7b12c4107be0d61 as a, ActivityMotion as o, ArtSlot as s, Button as c, ButtonLink as l, Bx as u, COVER_STATE_TITLE as d, CatalogViewToggle as f, Checkbox as p, ChevronSortDown as m, Chip as h, CloudDownloadDialog as g, CoverQueue as _, DISCOVERY_METADATA_KEY as v, DISCOVERY_SORTS as y, DOWNLOADS_KEY as b, DOWNLOADS_URL as x, DataTableFooter as S, DataTableFrame as C, E3 as w, EmptyFocusButton as T, EmptyState as E, FilterGlassRows as ee, FilterIconButton as D, FilterPill as O, GlassPill as te, IndexSearch as k, Input as A, JAV_LAYOUTS as ne, JAV_RECOMMENDATION_GRID as re, JAV_SELECTION_EVENT as j, JavHeader as M, LibraryShortcuts as N, M6 as P, Note as F, PHASES as ie, RELEASE_COLUMN_VISIBILITY_KEY as ae, RELEASE_COLUMN_WIDTHS_KEY as I, RELEASE_PAGE_SIZES as L, RELEASE_SORTS as oe, RELEASE_SORT_COLUMNS as R, SEGMENT as z, SEGMENTED_TRACK as B, ScrapeSourceLabel as V, SegmentedRadioGroup as H, Segments as se, SelectionDock as U, Shuffle as ce, SortKeys as le, SourceAvatar as W, Table as ue, TableColumnControls as de, TableColumnResizer as fe, TaskProgress as pe, WANTS_KEY as me, WantMagnets as G, Wt as he, __toESM as ge, activityKind as _e, addWant as ve, apiGet as ye, appSettingsStore as be, avatarInner as xe, busyProps as K, cachedMagnetStates as Se, cardClass as Ce, cardRatio as we, catalogListSkeletonCellHtml as Te, composingKey as Ee, controlDiscoveryMetadata as De, controlReleaseMetadata as Oe, coverArrived as ke, coverFetching as Ae, coverFetchingHtml as je, coverReason as Me, coverStateAction as Ne, coverUrl as Pe, discoveryArtwork as Fe, discoveryKey as Ie, discoveryScore as Le, entityDisplayName as Re, entityFaceImg as ze, entityPath as Be, errorMessage as Ve, esc as He, facePos as Ue, fetchCoverNow as We, fetchDiscoveries as Ge, fetchDiscoveryMetadata as Ke, fetchReleases as qe, fetchWants as Je, firstGrapheme as Ye, fmtDur as Xe, gridLayout as Ze, invalidateWants as q, javContentSkeleton as Qe, javLayout as $e, javTagSkeleton as et, jobText as tt, joinList as nt, keepPreviousData as rt, lastSearchNote as it, leadingGraphemes as at, logoUrl as ot, metadataInterval as st, pageWindow as ct, pv as lt, qE as ut, queryClient as dt, recommendationScore as ft, relayoutCovers as pt, releaseColumns as mt, releaseFilters as ht, releaseKey as gt, removeWants as _t, require_jsx_runtime as vt, require_react as yt, resetWants as bt, resourceSourceKey as xt, restoreWants as St, searchNote as Ct, selectRange as wt, selectionSummary as Tt, serverLabelList as Et, spriteGlyph as Dt, storeJavLayout as Ot, suppressShiftTextSelection as kt, t as J, textLang as At, tierPlaceholdersHtml as jt, useAction as Mt, useCatalogView as Nt, useEntityNames as Pt, useQuery as Y, useTablePreferences as Ft, wantName as X, wantsInterval as It, wireHorizontalScroller as Lt, writeJavQuery as Z } from "./peach-app.js";
import { JavBatchResources as Rt } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
import { ErrorLine as zt } from "./peach-app.source-view-Dyh_AG3b.js";
// src/react/jav/jav-selection.tsx
var Q = /* @__PURE__ */ ge(yt(), 1), $ = vt();
function Bt(e) {
	let t = new MutationObserver(e);
	return t.observe(document.body, {
		attributes: !0,
		attributeFilter: ["data-density"]
	}), () => t.disconnect();
}
var Vt = () => document.body.dataset.density === "dense", Ht = (0, Q.createContext)(null), Ut = () => (0, Q.useContext)(Ht);
function Wt(e) {
	let t = Ut()?.visible;
	(0, Q.useEffect)(() => {
		t?.(e);
	}, [e, t]);
}
function Gt({ children: e, readOnly: t, receipt: n, dock: r = !0 }) {
	let i = (0, Q.useSyncExternalStore)(Bt, Vt, () => !1), [a, o] = (0, Q.useState)(!1), [s, l] = (0, Q.useState)(/* @__PURE__ */ new Map()), [u, d] = (0, Q.useState)([]), [f, p] = (0, Q.useState)(null), m = (0, Q.useRef)(null), h = new Set(s.keys()), g = Tt(h, u.map((e) => e.code)), _ = (0, Q.useCallback)((e) => {
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
		return window.addEventListener(j, e), () => window.removeEventListener(j, e);
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
			wt(i, u.map((e) => e.code), n, e.code, t);
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
			label: J("catalog:javSelection.addToWants"),
			reversal: "undo",
			confirm: (e) => ({
				title: J("catalog:javSelection.addToWants"),
				body: J("catalog:javSelection.wantConfirm", { count: e.length })
			}),
			run: async (n) => {
				try {
					for (let r of n) if (!e.has(r.code)) {
						try {
							let e = await ve({ code: r.code });
							e?.created && t.push(e.want.id);
						} catch (t) {
							throw Error(J("catalog:javSelection.wantPartialFailed", {
								count: e.size,
								code: r.code,
								error: Ve(t)
							}));
						}
						e.add(r.code), l((e) => {
							let t = new Map(e);
							return t.delete(r.code), t;
						});
					}
				} finally {
					q();
				}
				return async () => {
					t.length && await _t(t), await q();
				};
			},
			receipt: () => J("catalog:javSelection.wantAdded", { count: e.size })
		};
	})(), C = { receipt: n };
	return /* @__PURE__ */ (0, $.jsxs)(Ht.Provider, {
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
			/* @__PURE__ */ (0, $.jsxs)(U, {
				visible: r && a,
				count: J("catalog:javSelection.selectedCount", { count: s.size }),
				label: J("catalog:javSelection.dockLabel"),
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
						children: g.all ? J("catalog:javSelection.deselectPage") : J("catalog:javSelection.selectPage")
					})
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !s.size,
					onClick: () => p([...s.values()]),
					children: J("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: v,
					children: J("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(Rt, {
				items: f,
				close: () => p(null),
				readOnly: t,
				receipt: n
			})
		]
	});
}
// src/react/wants/want-list.tsx
var Kt = {
	code: J("catalog:wants.originManual"),
	feed: J("catalog:entityHero.subscribeNewReleases"),
	follow: J("catalog:entityHero.following")
}, qt = [
	["all", J("catalog:shared.all")],
	["available", J("catalog:wants.hasMagnet")],
	["missing", J("catalog:wants.noMagnet")]
], Jt = (e) => [
	e.release_date,
	e.studio,
	e.performers,
	Kt[e.origin]
].filter(Boolean).join(" · ");
function Yt({ want: e }) {
	return /* @__PURE__ */ (0, $.jsxs)("span", {
		className: "relative inline-grid w-card-cover shrink-0 aspect-card-cover place-items-center overflow-hidden rounded-2lg bg-media-placeholder max-sm:w-24",
		children: [/* @__PURE__ */ (0, $.jsx)("span", {
			className: "text-caption-1-regular text-text-secondary",
			children: J("catalog:shared.noCover")
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
function Xt({ want: e, readOnly: t, busy: n, onReset: r, onRemove: i, onCloudDownload: a, downloads: o, provider: s, toast: u, picked: d }) {
	let [f, m] = (0, Q.useState)([]), h = e.link || (!f.length && e.code ? `https://javdb.com/search?q=${encodeURIComponent(e.code)}&f=all` : ""), g = h && URL.canParse(h) ? new URL(h).hostname.replace(/^www\./, "") : "", _ = xt(e.follow_provider || g.split(".")[0] || ""), v = _ === "javdb" ? "JavDB" : _ === "javbus" ? "JavBus" : g, y = h && g && !f.some((e) => e.source === _) ? [{
		source: _,
		label: v,
		url: h
	}, ...f] : f, b = e.code && e.phase === "searching" ? it(e) : Ct(e);
	return /* @__PURE__ */ (0, $.jsxs)("li", {
		"data-want-id": e.id,
		className: Ce({ className: "flex flex-col gap-4 max-sm:p-4" }),
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 items-start gap-4 max-sm:gap-3",
			children: [
				d ? /* @__PURE__ */ (0, $.jsx)(p, {
					slot: null,
					className: "mt-1 shrink-0 self-start",
					"aria-label": J("catalog:wants.selectRow", { name: X(e) }),
					isSelected: d.on,
					onChange: d.toggle
				}) : null,
				/* @__PURE__ */ (0, $.jsx)(Yt, { want: e }),
				/* @__PURE__ */ (0, $.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-col gap-1",
					children: [
						/* @__PURE__ */ (0, $.jsxs)("p", {
							className: "flex min-w-0 flex-wrap items-baseline gap-x-2",
							children: [/* @__PURE__ */ (0, $.jsx)("b", {
								className: "min-w-0 text-headline-medium wrap-anywhere text-text-primary",
								children: X(e)
							}), e.code && e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
								className: "min-w-0 truncate text-body-2-regular text-text-secondary",
								children: e.title
							}) : null]
						}),
						Jt(e) ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: Jt(e)
						}) : null,
						b ? /* @__PURE__ */ (0, $.jsx)("p", {
							"data-want-note": "",
							className: "text-caption-1-regular text-text-secondary",
							children: b
						}) : null,
						e.scrape_error ? /* @__PURE__ */ (0, $.jsx)(zt, {
							text: e.scrape_error,
							prefix: J("catalog:wants.metadataNotFound"),
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
									trailingIcon: he,
									href: e.url,
									target: "_blank",
									rel: "noopener noreferrer",
									children: /* @__PURE__ */ (0, $.jsx)(V, {
										source: e.source,
										label: e.label
									})
								}, e.url)),
								e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "secondary",
									size: "small",
									disabled: t,
									...K(n === `reset:${e.id}`),
									onClick: r,
									children: J("catalog:wants.searchAgain")
								}) : null,
								e.phase === "searching" || e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "primary",
									size: "small",
									leadingIcon: lt,
									onClick: a,
									children: J("catalog:shared.searchTorrents")
								}) : null,
								/* @__PURE__ */ (0, $.jsx)(c, {
									variant: "danger",
									size: "small",
									leadingIcon: P,
									disabled: t,
									...K(n === `remove:${e.id}`),
									onClick: i,
									children: J("catalog:shared.remove")
								})
							]
						})
					]
				})
			]
		}), e.code && (e.phase === "searching" || e.phase === "given_up") ? /* @__PURE__ */ (0, $.jsx)(G, {
			want: e,
			readOnly: t,
			downloads: o,
			provider: s,
			toast: u,
			onSources: m
		}) : null]
	});
}
function Zt({ phase: e, label: t, rows: n, row: r }) {
	let [i, o] = (0, Q.useState)(1), [s, l] = (0, Q.useState)(20), [u, d] = (0, Q.useState)("all"), f = Se(n), p = (e) => e.has_magnets ?? f.get(e.code || "") ?? !1, m = n.filter(p), h = e !== "searching" || u === "all" ? n : n.filter((e) => p(e) === (u === "available")), g = ct(h.length, s, i);
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
				}), e === "searching" ? /* @__PURE__ */ (0, $.jsx)(H, {
					name: "want-magnet-filter",
					"aria-label": J("catalog:wants.magnetFilter"),
					orientation: "horizontal",
					value: u,
					className: B,
					onChange: (e) => {
						d(e), o(1);
					},
					children: qt.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)(a, {
						value: e,
						"aria-label": t,
						className: z,
						children: [t, /* @__PURE__ */ (0, $.jsx)("span", {
							className: "text-caption-1-regular tabular-nums text-text-tertiary",
							children: (e === "all" ? n.length : e === "available" ? m.length : n.length - m.length).toLocaleString()
						})]
					}, e))
				}) : null]
			}),
			h.length ? null : /* @__PURE__ */ (0, $.jsx)(E, {
				size: "compact",
				icon: ut,
				title: J("catalog:wants.noFilterMatches"),
				actions: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: () => {
						d("all"), o(1);
					},
					children: J("catalog:shared.viewAll")
				}),
				children: null
			}),
			/* @__PURE__ */ (0, $.jsx)("ul", {
				className: "flex flex-col gap-4",
				children: h.slice(g.start, g.end).map(r)
			}),
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-want-pager": "",
				children: /* @__PURE__ */ (0, $.jsx)(S, {
					label: t,
					total: g.total,
					pagination: {
						pageIndex: g.page - 1,
						pageSize: s
					},
					onChange: (e) => {
						l(e.pageSize), o(e.pageIndex + 1);
					},
					unit: J("catalog:wants.itemUnit")
				})
			})
		]
	});
}
function Qt({ readOnly: e, toast: t, query: n = "", clearQuery: r }) {
	let [i, a] = (0, Q.useState)(""), [o, s] = (0, Q.useState)(null), l = Mt(), u = Y({
		queryKey: me,
		queryFn: ({ signal: e }) => Je(e),
		staleTime: 3e4,
		refetchInterval: It
	}), d = () => {
		let n = i.trim();
		n && !e && l.run("add", (e) => ve({ code: n }, e), (e) => {
			t(e.created ? J("catalog:wants.added", { name: X(e.want) }) : J("catalog:wants.alreadyAdded", { name: X(e.want) })), a(""), q();
		});
	}, f = (e) => {
		e.key === "Enter" && !Ee(e.nativeEvent) && (e.preventDefault(), d());
	}, p = (e) => {
		l.run(`remove:${e.id}`, (t) => _t([e.id], t), () => {
			t(J("catalog:wants.removed", { name: X(e) })), q();
		});
	}, m = (e) => {
		l.run(`reset:${e.id}`, (t) => bt([e.id], t), () => {
			t(J("catalog:wants.backToSearching", { name: X(e) })), q();
		});
	}, h = u.data, _ = (h?.items || []).filter((e) => !n || [
		e.code,
		e.title,
		e.performers
	].join(" ").toLocaleLowerCase().includes(n.toLocaleLowerCase())), v = Ut(), y = !!v?.mode, [S, C] = (0, Q.useState)(/* @__PURE__ */ new Set()), [w, ee] = (0, Q.useState)(null);
	(0, Q.useEffect)(() => {
		y || C(/* @__PURE__ */ new Set());
	}, [y]);
	let D = _.filter((e) => S.has(e.id)), O = _.length > 0 && D.length === _.length, te = { receipt: t }, k = {
		key: "remove",
		label: J("catalog:shared.remove"),
		reversal: "undo",
		danger: !0,
		confirm: (e) => ({
			title: J("catalog:wants.removeMany"),
			body: J("catalog:wants.removeManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await _t(e.map((e) => e.id));
			return await q(), async () => {
				await St(t), await q();
			};
		},
		receipt: (e) => J("catalog:wants.removedMany", { count: e.length })
	}, ne = {
		key: "reset",
		label: J("catalog:wants.searchAgain"),
		reversal: "undo",
		confirm: (e) => ({
			title: J("catalog:wants.searchAgainMany"),
			body: J("catalog:wants.searchAgainManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await bt(e.map((e) => e.id));
			return await q(), async () => {
				await St(t), await q();
			};
		},
		receipt: (e) => J("catalog:wants.searchAgainDone", { count: e.length })
	}, re = D.filter((e) => e.code && (e.phase === "searching" || e.phase === "given_up")), j = Y({
		queryKey: b,
		queryFn: ({ signal: e }) => ye(`${x}?limit=100`, e),
		enabled: _.some((e) => e.code && (e.phase === "searching" || e.phase === "given_up"))
	}), M = j.data?.providers.filter((e) => e.configured) || [], N = M[0]?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"aria-busy": u.isPending,
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: Ce({
					padding: "none",
					className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
				}),
				children: [
					/* @__PURE__ */ (0, $.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: J("catalog:wants.addByCode")
					}),
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "flex flex-wrap items-end gap-2",
						children: [/* @__PURE__ */ (0, $.jsx)("div", {
							className: "min-w-64 grow max-sm:min-w-0",
							children: /* @__PURE__ */ (0, $.jsx)(A, {
								"aria-label": J("catalog:shared.code"),
								placeholder: J("catalog:wants.codePlaceholder"),
								value: i,
								isDisabled: e,
								onChange: a,
								onKeyDown: f
							})
						}), /* @__PURE__ */ (0, $.jsx)(c, {
							variant: "primary",
							disabled: e || !i.trim(),
							...K(l.busy === "add"),
							onClick: d,
							children: J("catalog:shared.add")
						})]
					}),
					l.error ? /* @__PURE__ */ (0, $.jsx)(F, {
						tone: "error",
						title: J("catalog:wants.actionFailed"),
						children: l.error
					}) : null
				]
			}),
			u.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				title: J("catalog:wants.loadFailed"),
				children: Ve(u.error)
			}) : null,
			u.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:wants.loading"),
				dangerouslySetInnerHTML: { __html: Qe("wants") }
			}) : null,
			h?.scraping ? /* @__PURE__ */ (0, $.jsx)(pe, {
				embedded: !0,
				kind: _e("want-scrape"),
				label: J("catalog:wants.fetchingNew")
			}) : null,
			h?.searching ? /* @__PURE__ */ (0, $.jsx)(pe, {
				embedded: !0,
				kind: _e("want-search"),
				label: J("catalog:wants.searchingResources")
			}) : null,
			j.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				title: J("catalog:wants.downloadSettingsFailed"),
				children: Ve(j.error)
			}) : null,
			j.data && !M.length ? /* @__PURE__ */ (0, $.jsxs)(F, {
				tone: "neutral",
				children: [
					J("shell:downloadChannels.notConfigured"),
					J("shell:format.sentenceGap"),
					/* @__PURE__ */ (0, $.jsx)("a", {
						href: "/settings/downloads",
						children: J("shell:downloadChannels.settingsLink")
					})
				]
			}) : null,
			j.data && !j.data.available ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "neutral",
				children: J("catalog:wants.cloudPrimaryOnly")
			}) : null,
			h && !_.length ? /* @__PURE__ */ (0, $.jsx)(E, {
				size: "compact",
				icon: ut,
				title: J(n ? "catalog:wants.noSearchMatches" : "catalog:wants.empty"),
				actions: n && r ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: r,
					children: J("catalog:shared.clearSearch")
				}) : !n && !e ? /* @__PURE__ */ (0, $.jsx)(T, {
					target: `input[aria-label="${J("catalog:shared.code")}"]`,
					children: J("catalog:wants.addWork")
				}) : void 0,
				children: J(n ? "catalog:wants.tryOtherSearch" : "catalog:wants.emptyHint")
			}) : null,
			ie.map(([n, r]) => {
				let i = _.filter((e) => e.phase === n);
				return i.length ? /* @__PURE__ */ (0, $.jsx)(Zt, {
					phase: n,
					label: r,
					rows: i,
					row: (n) => /* @__PURE__ */ (0, $.jsx)(Xt, {
						want: n,
						readOnly: e,
						busy: l.busy,
						downloads: j.data,
						provider: N,
						toast: t,
						picked: y ? {
							on: S.has(n.id),
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
			/* @__PURE__ */ (0, $.jsxs)(U, {
				visible: y,
				label: J("catalog:wants.dockLabel"),
				count: J("catalog:javSelection.selectedCount", { count: D.length }),
				actions: [{
					action: k,
					items: D,
					host: te,
					disabled: e,
					done: () => C(/* @__PURE__ */ new Set())
				}, {
					action: ne,
					items: D.filter((e) => e.phase === "given_up"),
					host: te,
					disabled: e,
					done: () => C(/* @__PURE__ */ new Set())
				}],
				leading: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !_.length,
					onClick: () => C(O ? /* @__PURE__ */ new Set() : new Set(_.map((e) => e.id))),
					children: J(O ? "catalog:javSelection.deselectPage" : "catalog:wants.selectAll")
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !re.length,
					onClick: () => ee(re.map((e) => ({
						id: e.id,
						code: e.code,
						title: e.title || "",
						release_date: e.release_date || void 0
					}))),
					children: J("catalog:shared.searchTorrents")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					onClick: () => v?.close(),
					children: J("catalog:javSelection.exit")
				})]
			}),
			/* @__PURE__ */ (0, $.jsx)(Rt, {
				items: w,
				close: () => ee(null),
				readOnly: e,
				receipt: t
			})
		]
	});
}
// src/react/jav/discovery-faces.tsx
function $t({ item: e }) {
	Pt();
	let t = e.performer_refs?.length ? e.performer_refs : [...new Set(e.performers.split(/[,，、;/]/).filter(Boolean))].map((e) => ({ name: e })), n = t.slice(0, 5).map((t, n) => {
		let r = { "--media-avatar-index": n }, i = t.source_avatar && t.source_actor_id && !t.has_image ? { children: /* @__PURE__ */ (0, $.jsx)(W, {
			code: e.code,
			person: t
		}) } : { dangerouslySetInnerHTML: { __html: xe(t.name, t, null) } };
		return t.id ? /* @__PURE__ */ (0, $.jsx)("a", {
			"data-media-avatar": "",
			style: r,
			href: Be("performer", t.name, t.id),
			"aria-label": J("catalog:javDiscovery.openActress", { name: Re("performer", t.name, t.id) }),
			...i
		}, t.name) : /* @__PURE__ */ (0, $.jsx)("span", {
			"data-media-avatar": "",
			style: r,
			title: Re("performer", t.name),
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
var en = (e) => ({
	...e,
	cover: e.has_cover ? Pe(e, !0) : e.cover_url,
	origin: `${e.asset_id ? "asset" : "feed"}:${e.id}`
}), tn = "relative inline-grid place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default";
function nn({ item: e, readOnly: t }) {
	let n = Mt(), [r, i] = (0, Q.useState)("");
	(0, Q.useSyncExternalStore)(Ae.subscribe, Ae.revision);
	let a = e.cover_state;
	if (!a) return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-media-nopic": "",
		children: J("catalog:shared.noCover")
	});
	if (a === "fetching" || Ae.has(e.code)) return /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: je() } });
	let s = () => {
		n.run("cover", (t) => We(e.code, t), (t) => {
			t.has_cover ? ke(e.code, t) : i(t.message || J("catalog:javDiscovery.noOfficialCover"));
		});
	}, l = r || n.error ? "missing" : a, u = n.error || r || Me(e);
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
				children: Ne(l)
			})
		]
	});
}
function rn({ item: e, layout: t, javImage: n, readOnly: r, navigate: i, tag: a, onTag: o, wanting: u, onWant: d, onResource: f, badge: p }) {
	let m = Ut(), h = m?.selected.has(e.code), g = !!m?.dense, _ = e.performer_refs?.length ? nt(e.performer_refs.map((e) => e.name)) : e.performers, v = Fe(e, t, n), y = e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`;
	return /* @__PURE__ */ (0, $.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-selected": h ? "" : void 0,
		onMouseDown: kt,
		onClickCapture: (t) => {
			m && (m.mode || t.shiftKey || t.ctrlKey || t.metaKey) && (t.preventDefault(), t.stopPropagation(), m.toggle(e, t.shiftKey));
		},
		onClick: (e) => {
			e.target.closest("a,button,input") || i(y);
		},
		children: [
			v ? /* @__PURE__ */ (0, $.jsx)("a", {
				href: y,
				"aria-label": J("catalog:javDiscovery.viewDetails", { code: e.code }),
				onClick: (e) => {
					e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0 || (e.preventDefault(), i(y));
				},
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: tn,
				children: /* @__PURE__ */ (0, $.jsx)(s, {
					artwork: {
						kind: "cover",
						html: v
					},
					identity: Fe(e, "small", n),
					relayout: (e) => pt(e, t)
				})
			}) : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: tn,
				children: /* @__PURE__ */ (0, $.jsx)(nn, {
					item: e,
					readOnly: r
				})
			}),
			m?.mode ? /* @__PURE__ */ (0, $.jsx)("button", {
				type: "button",
				"data-media-check": "",
				"aria-label": J("catalog:javDiscovery.select", { code: e.code }),
				"aria-pressed": !!h,
				children: /* @__PURE__ */ (0, $.jsx)("svg", {
					viewBox: "0 0 24 24",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, $.jsx)("use", { href: "#i-check" })
				})
			}) : null,
			/* @__PURE__ */ (0, $.jsxs)("div", {
				"data-media-meta": "",
				children: [/* @__PURE__ */ (0, $.jsx)($t, { item: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-media-text": "",
					children: [
						/* @__PURE__ */ (0, $.jsxs)("h3", {
							"data-jav-title": "",
							"data-media-title": "",
							title: `${e.code} · ${e.title || J("catalog:javDiscovery.titleNotFound")}`,
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: e.code }),
								" ",
								e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: At(e.title),
									children: e.title
								}) : J("catalog:javDiscovery.titleNotFound")
							]
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-media-byline": "",
							children: [
								e.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsxs)("a", {
									"data-media-who": "",
									href: Be("performer", e.performer_refs[0].name),
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
									children: J("catalog:javDiscovery.morePeople", {
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
								"aria-pressed": a === e,
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
						"aria-label": J("catalog:shared.viewOnSite"),
						title: J("catalog:shared.viewOnSite"),
						leadingIcon: g ? he : void 0,
						trailingIcon: g ? void 0 : he,
						href: e.link,
						target: "_blank",
						rel: "noopener noreferrer",
						children: g ? null : J("catalog:shared.viewOnSite")
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "ghost",
						size: g ? "small" : "medium",
						disabled: r || e.wanted || !!e.asset_id,
						...K(u),
						onClick: d,
						children: e.asset_id ? J("catalog:javWant.imported") : e.wanted ? J("catalog:javWant.wanted") : J("catalog:javWant.want")
					}),
					/* @__PURE__ */ (0, $.jsx)(c, {
						variant: "secondary",
						size: g ? "small" : "medium",
						onClick: f,
						children: J("catalog:shared.searchTorrents")
					})
				]
			})
		]
	});
}
// src/react/jav/jav-release-table.tsx
var an = {
	widths: I,
	visibility: ae
};
function on({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return e?.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
		"data-list-studio-mark": "",
		src: ot(e.name, "icon", e.logo_version),
		alt: "",
		width: 16,
		height: 16,
		loading: "lazy",
		decoding: "async",
		onError: () => n(!0)
	}) : /* @__PURE__ */ (0, $.jsx)("span", {
		"data-list-studio-mark": "",
		"aria-hidden": "true",
		children: at(e?.name || "", 1)
	});
}
function sn({ items: a, waiting: o, filters: l, studios: u, javImage: f, readOnly: h, navigate: g, onTag: _, onSort: v, wanting: y, onWant: b, onResource: x }) {
	let S = Ut(), w = Ft("jav-releases", mt, an), T = mt.filter((e) => e.required || w.visibility[e.id] !== !1), E = Object.entries(R).find(([, e]) => e === l.sort)?.[0], ee = new Map(u.map((e) => [e.name, e])), D = (e) => (t) => {
		t.preventDefault(), S?.mode || t.shiftKey || t.ctrlKey || t.metaKey ? S?.toggle(e, t.shiftKey) : g(`/works/${encodeURIComponent(e.code)}`);
	}, O = (e, t) => {
		let n = t.performer_refs?.[0]?.name || t.performers.split(/[,，、;/]/)[0] || "";
		switch (e) {
			case "name": {
				let e = Fe(t, "small", f);
				return /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-list-identity": "",
					children: [/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						"data-list-open": "",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: D(t),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-list-picture": "",
							children: e ? /* @__PURE__ */ (0, $.jsx)(s, {
								artwork: {
									kind: "cover",
									html: e
								},
								relayout: (e) => pt(e, "small")
							}) : /* @__PURE__ */ (0, $.jsx)("span", {
								title: Me(t) || void 0,
								children: t.cover_state ? d[t.cover_state] : J("catalog:shared.noCover")
							})
						})
					}), /* @__PURE__ */ (0, $.jsx)("span", {
						"data-list-text": "",
						children: /* @__PURE__ */ (0, $.jsxs)("button", {
							type: "button",
							"data-list-name": "",
							title: `${t.code} · ${t.title || J("catalog:javDiscovery.titleNotFound")}`,
							"aria-label": J("catalog:javDiscovery.viewDetails", { code: t.code }),
							onClick: D(t),
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: t.code }),
								" ",
								t.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: At(t.title),
									children: t.title
								}) : J("catalog:javDiscovery.titleNotFound")
							]
						})
					})]
				});
			}
			case "people": return n ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-list-people": "",
				children: [
					/* @__PURE__ */ (0, $.jsx)($t, { item: t }),
					t.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsx)("a", {
						"data-media-who": "",
						href: Be("performer", n),
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}) : /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who": "",
						children: /* @__PURE__ */ (0, $.jsx)("span", { children: n })
					}),
					(t.performer_refs?.length || 0) > 1 ? /* @__PURE__ */ (0, $.jsx)("span", {
						"data-media-who-more": "",
						children: J("catalog:javDiscovery.morePeople", {
							count: t.performer_refs.length - 1,
							total: t.performer_refs.length
						})
					}) : null
				]
			}) : "—";
			case "studio": return t.studio ? /* @__PURE__ */ (0, $.jsxs)("span", {
				"data-list-library": "",
				title: t.studio,
				children: [/* @__PURE__ */ (0, $.jsx)(on, { studio: ee.get(t.studio) }), /* @__PURE__ */ (0, $.jsx)("span", { children: t.studio })]
			}) : "—";
			case "tags": return t.tags?.length ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-tags": "",
				"data-list-tags": "",
				children: t.tags.map((e) => /* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					"data-media-tag": "",
					"aria-pressed": l.tag === e,
					onClick: () => _(l.tag === e ? "" : e),
					children: e
				}, e))
			}) : "—";
			case "code": return t.code;
			case "dur": return Xe(t.duration) || "—";
			case "score": return t.source_score == null ? "—" : `${t.source_score.toFixed(2)} / 5`;
			case "release": return t.release_date || "—";
			default: return /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-release-actions": "",
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "ghost",
					disabled: h || t.wanted || !!t.asset_id,
					...K(y(t)),
					onClick: () => b(t),
					children: t.wanted ? J("catalog:javWant.wanted") : J("catalog:javWant.want")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					onClick: () => x(t),
					children: J("catalog:shared.searchTorrents")
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
			"aria-label": J("catalog:javReleases.toolbar"),
			children: /* @__PURE__ */ (0, $.jsx)("div", {
				"data-toolbar-actions": "",
				children: /* @__PURE__ */ (0, $.jsx)(de, {
					preferences: w,
					label: J("catalog:javReleases.list")
				})
			})
		}), /* @__PURE__ */ (0, $.jsx)(C, {
			follow: !0,
			preferences: w,
			children: /* @__PURE__ */ (0, $.jsxs)(ue, {
				"aria-label": J("catalog:javReleases.list"),
				size: "sm",
				sortDescriptor: E ? {
					column: E,
					direction: l.dir === "asc" ? "ascending" : "descending"
				} : void 0,
				onSortChange: (e) => {
					let t = R[String(e.column)];
					t && v(t, e.direction === "ascending" ? "asc" : "desc");
				},
				children: [/* @__PURE__ */ (0, $.jsxs)(i, { children: [
					S?.mode ? /* @__PURE__ */ (0, $.jsx)(t, {
						id: "selection",
						width: 44,
						"aria-label": J("catalog:javReleases.selectVideos"),
						children: /* @__PURE__ */ (0, $.jsx)(p, {
							slot: null,
							"aria-label": J("catalog:catalogList.selectAllOnPage"),
							isSelected: S.all,
							isIndeterminate: S.mixed,
							isDisabled: o || !a.length,
							onChange: S.selectPage
						})
					}) : null,
					T.map((e) => /* @__PURE__ */ (0, $.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === "name",
						allowsSorting: e.id in R,
						...w.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [e.label, e.id in R ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, $.jsx)(m, {})
							}) : null]
						}), /* @__PURE__ */ (0, $.jsx)(fe, {
							preferences: w,
							id: e.id
						})] })
					}, e.id)),
					/* @__PURE__ */ (0, $.jsx)(t, {
						id: "remaining-space",
						"aria-label": J("catalog:catalogList.rowSpacer"),
						"data-table-space": "",
						width: w.spaceWidth,
						minWidth: 0
					})
				] }), /* @__PURE__ */ (0, $.jsx)(e, {
					renderEmptyState: () => J("catalog:javReleases.noMatches"),
					children: o ? Array.from({ length: 6 }, (e, t) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: `skeleton-${t}`,
						"data-list-skeleton-row": "",
						"aria-hidden": "true",
						children: [
							S?.mode ? /* @__PURE__ */ (0, $.jsx)(r, {}) : null,
							T.map((e) => /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Te(e.id) } }) }, e.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, `skeleton-${t}`)) : a.map((e) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: String(e.id),
						"data-catalog-row": "",
						"data-release-row": "",
						children: [
							S?.mode ? /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)(p, {
								slot: null,
								"aria-label": J("catalog:javDiscovery.select", { code: e.code }),
								isSelected: S.selected.has(e.code),
								onChange: () => S.toggle(e)
							}) }) : null,
							T.map((t) => /* @__PURE__ */ (0, $.jsx)(r, { children: O(t.id, e) }, t.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, e.id))
				})]
			})
		})]
	});
}
// src/react/jav/jav-releases.tsx
var cn = `<div data-catalog-tier="performers" data-skeleton="tiers">${jt("performer")}</div><div data-catalog-tier="studios">${jt("studio")}</div>`, ln = (e) => `<span data-tier-initial>${He(Ye(Re("performer", e.name, e.id)))}</span>${ze({
	id: e.id,
	hasImage: e.has_image,
	version: e.image_version,
	style: Ue(e.avatar_focus),
	focus: e.avatar_focus,
	standIn: e.avatar_stand_in
})}`;
function un({ value: e }) {
	let t = ft(e);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-jav-taste-score": "",
		title: J("catalog:javScore.taste", { score: t.score }),
		children: /* @__PURE__ */ (0, $.jsx)(h, {
			color: t.color,
			children: t.label
		})
	});
}
function dn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-tier-mark": "",
		children: e.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: ot(e.name, "icon", e.logo_version),
			alt: "",
			width: 28,
			height: 28,
			loading: "lazy",
			decoding: "async",
			onError: () => n(!0)
		}) : at(e.name, 2)
	});
}
var fn = (e) => We(e).then((t) => (t.has_cover && ke(e, t), t.has_cover));
function pn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	Pt();
	let [o, s] = (0, Q.useState)(() => ht(location.search));
	(0, Q.useEffect)(() => {
		r !== o.q && (s((e) => ({
			...e,
			q: r,
			page: 1
		})), Z({ page: "" }));
	}, [r, o.q]);
	let d = (e, t) => {
		let n = o[e] === t ? "" : t;
		s((t) => ({
			...t,
			[e]: n,
			page: 1
		})), Z({
			[e]: n,
			page: ""
		});
	}, p = (0, Q.useRef)(null), m = ({ pageIndex: e, pageSize: t }) => {
		let n = e + 1;
		s((e) => ({
			...e,
			page: n,
			size: t
		})), Z({
			page: n > 1 ? String(n) : "",
			size: t === 24 ? "" : String(t)
		}), p.current?.scrollIntoView({ block: "start" });
	}, h = () => {
		s((e) => ({
			...e,
			performer: "",
			studio: "",
			tag: "",
			q: "",
			page: 1
		})), Z({
			performer: "",
			studio: "",
			tag: "",
			page: ""
		}), a();
	}, g = (e) => y(e, e === o.sort ? o.dir === "asc" ? "desc" : "asc" : e === "code" ? "asc" : "desc"), y = (e, t) => {
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
	}, b = () => {
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
		let e = [...p.current?.querySelectorAll("[data-catalog-tier],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Lt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let x = be();
	(0, Q.useSyncExternalStore)(x.subscribe, x.version, x.version);
	let C = $e(), w = Nt(), T = we(Ze({
		active: !0,
		home: !1,
		portrait: !1
	})), D = Y({
		queryKey: gt(o),
		queryFn: ({ signal: e }) => qe(o, e),
		placeholderData: rt,
		retry: !1,
		refetchOnWindowFocus: !1
	}), k = D.data?.metadata_job, A = (0, Q.useRef)(!1);
	A.current = k?.status === "running";
	let j = dt.getQueryData(v)?.metadata_job, M = Y({
		queryKey: v,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: k?.status === "running" || j?.status === "running",
		queryFn: ({ signal: e }) => Ke(e),
		refetchInterval: st(() => A.current)
	}), N = M.data && M.dataUpdatedAt >= D.dataUpdatedAt ? M.data.metadata_job : k, P = N?.status === "running", ie = (0, Q.useRef)(!1);
	(0, Q.useEffect)(() => {
		ie.current && !P && D.refetch(), ie.current = P;
	}, [P, D]);
	let ae = (0, Q.useRef)(""), I = JSON.stringify([
		o.performer,
		o.studio,
		o.tag,
		o.q,
		o.sort,
		o.dir,
		o.seed
	]), R = !D.isPlaceholderData && (D.data?.metadata_unread || 0) > 0 && !P;
	(0, Q.useEffect)(() => {
		R && ae.current !== I && (ae.current = I, Oe("start", o).then(async (e) => {
			await dt.cancelQueries({ queryKey: v }), dt.setQueryData(v, e);
		}).catch(() => {}));
	}, [R, I]);
	let z = Mt(), B = (e) => {
		z.run(String(e.id), (t) => ve({ code: e.code }, t), () => {
			t(J("catalog:javWant.added")), q(), D.refetch();
		});
	}, V = D.data;
	Wt(V?.items || []);
	let H = D.isPending, U = !!(o.performer || o.studio || o.tag || o.q), W = Math.max(1, Math.ceil((V?.total || 0) / o.size));
	return (0, Q.useEffect)(() => {
		!V || D.isPlaceholderData || o.page <= W || (s((e) => ({
			...e,
			page: W
		})), Z({ page: W > 1 ? String(W) : "" }));
	}, [
		V,
		D.isPlaceholderData,
		o.page,
		W
	]), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: p,
		"aria-label": J("catalog:entityHero.subscribeNewReleases"),
		"aria-busy": H || D.isFetching,
		className: "flex min-w-0 scroll-mt-24 flex-col gap-4",
		children: [
			H ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-catalog-tiers": "",
				"aria-busy": "true",
				dangerouslySetInnerHTML: { __html: cn }
			}) : null,
			V && (V.facets.performers.length || V.facets.studios.length) ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-catalog-tiers": "",
				"data-release-tiers": "",
				children: [V.facets.performers.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "performers",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByActress"),
					children: V.facets.performers.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-performer": "",
						"aria-pressed": o.performer === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: Re("performer", e.name, e.id),
							count: e.count
						}),
						onClick: () => d("performer", e.name),
						children: [/* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-ring": "",
							dangerouslySetInnerHTML: { __html: ln(e) }
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-name": "",
							children: Re("performer", e.name, e.id)
						})]
					}, e.name))
				}) : null, V.facets.studios.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "studios",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByLabel"),
					children: V.facets.studios.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-studio": "",
						"aria-pressed": o.studio === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: e.name,
							count: e.count
						}),
						onClick: () => d("studio", e.name),
						children: [
							/* @__PURE__ */ (0, $.jsx)(dn, { studio: e }),
							e.name,
							/* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: e.count
							})
						]
					}, e.name))
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(ee, {
				label: J("catalog:javReleases.filtersLabel"),
				topLabel: J("catalog:javReleases.tagsLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: H,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-scroll": "",
					children: /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: H ? { __html: et() } : void 0,
						children: H ? null : V?.facets.tags.map((e) => /* @__PURE__ */ (0, $.jsxs)(O, {
							"data-catalog-tag": e.name,
							"data-entity-press": "",
							pressed: o.tag === e.name,
							onPress: () => d("tag", e.name),
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
						children: H ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : U ? J("catalog:javReleases.matchedCount", {
							matched: V?.total || 0,
							count: V?.candidate_total || 0
						}) : J("catalog:countLabel.works", { count: V?.total || 0 })
					}),
					U ? /* @__PURE__ */ (0, $.jsx)(te, {
						onPress: h,
						children: J("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							/* @__PURE__ */ (0, $.jsx)(ce, {
								onPress: b,
								busy: o.sort === "random" && D.isFetching
							}),
							w === "cards" ? /* @__PURE__ */ (0, $.jsx)(se, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: C,
								options: ne,
								onChange: Ot
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(f, {}),
							/* @__PURE__ */ (0, $.jsx)(le, {
								sorts: oe.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === o.sort,
									dir: o.dir
								})),
								onSort: (e) => g(e)
							})
						]
					})
				] })
			}),
			H && w === "cards" ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javReleases.loading"),
				dangerouslySetInnerHTML: { __html: Qe("discover", C) }
			}) : null,
			D.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				title: J("catalog:javReleases.failed"),
				children: Ve(D.error)
			}) : null,
			P && N ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(pe, {
					kind: _e("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: N.completed,
						count: N.total
					}),
					value: N.completed,
					total: N.total
				})
			}) : null,
			e ? null : /* @__PURE__ */ (0, $.jsx)(_, {
				scope: J("catalog:javReleases.coverQueueScope"),
				fetchOne: fn,
				codes: (V?.items || []).filter((e) => e.cover_state === "queued" && !e.cover_url).map((e) => e.code),
				settled: (e, n) => {
					t(e === n ? J("catalog:javReleases.coversFetched", { count: n }) : J("catalog:javReleases.coversPartial", {
						got: e,
						count: n
					})), D.refetch();
				}
			}),
			!H && !D.error && !V?.items.length ? /* @__PURE__ */ (0, $.jsx)(E, {
				icon: u,
				title: J(U ? "catalog:javReleases.noMatches" : "catalog:javReleases.emptyTitle"),
				actions: U ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: h,
					children: J("catalog:shared.clearFilters")
				}) : /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/subscriptions?tab=add",
					children: J("catalog:javReleases.addSubscription")
				}),
				children: J(U ? "catalog:javReleases.clearFiltersHint" : "catalog:javReleases.emptyHint")
			}) : null,
			z.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				children: z.error
			}) : null,
			w === "list" ? H || V?.items.length ? /* @__PURE__ */ (0, $.jsx)(sn, {
				items: V?.items || [],
				waiting: H,
				filters: o,
				studios: V?.facets.studios || [],
				javImage: x.value.javImage,
				readOnly: e,
				navigate: i,
				onTag: (e) => d("tag", e || o.tag),
				onSort: y,
				wanting: (e) => z.busy === String(e.id),
				onWant: B,
				onResource: (e) => n(en(e))
			}) : null : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: re,
				style: { "--card-ratio": T },
				children: (V?.items || []).map((t) => /* @__PURE__ */ (0, $.jsx)(rn, {
					item: t,
					layout: C,
					javImage: x.value.javImage,
					readOnly: e,
					navigate: i,
					tag: o.tag,
					onTag: (e) => d("tag", e || o.tag),
					wanting: z.busy === String(t.id),
					onWant: () => B(t),
					onResource: () => n(en(t)),
					badge: o.sort === "taste" ? /* @__PURE__ */ (0, $.jsx)(un, { value: t.taste_score }) : void 0
				}, t.id))
			}),
			V ? /* @__PURE__ */ (0, $.jsx)(S, {
				label: J("catalog:javTabs.newReleases"),
				total: V.total,
				pagination: {
					pageIndex: o.page - 1,
					pageSize: o.size
				},
				onChange: m,
				unit: J("catalog:catalogList.footerUnit"),
				pageUnit: J("catalog:catalogList.footerPageUnit"),
				pageSizes: L
			}) : null
		]
	});
}
// src/react/jav/jav-page.tsx
var mn = Dt("x"), hn = Dt("refresh-cw"), gn = {
	releases: J("catalog:javSearch.filterReleases"),
	discover: J("catalog:javSearch.filterRecommended"),
	wants: J("catalog:javSearch.filterWants")
};
function _n({ tab: e, readOnly: t, navigate: n, receipt: r }) {
	let [i, a] = (0, Q.useState)(null), [o, s] = (0, Q.useState)(() => new URLSearchParams(location.search).get("q") || ""), c = (e) => {
		s(e), Z({ q: e });
	};
	return /* @__PURE__ */ (0, $.jsx)(Gt, {
		readOnly: t,
		receipt: r,
		dock: e !== "wants",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex w-full flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, $.jsx)(M, {
					tab: e,
					navigate: n,
					find: () => a({}),
					search: /* @__PURE__ */ (0, $.jsx)(k, {
						label: gn[e] || J("catalog:javDiscover.filter"),
						value: o,
						onQuery: c
					})
				}),
				e === "releases" ? /* @__PURE__ */ (0, $.jsx)(pn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : e === "discover" ? /* @__PURE__ */ (0, $.jsx)(vn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : /* @__PURE__ */ (0, $.jsx)(Qt, {
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
function vn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	let o = new URLSearchParams(location.search), [s, u] = (0, Q.useState)(() => o.get("scope") === "library" ? "library" : "external"), [d, f] = (0, Q.useState)(() => o.get("tag") || ""), [p, m] = (0, Q.useState)(() => y.some(([e]) => e === o.get("sort")) ? o.get("sort") : "taste"), [g, _] = (0, Q.useState)(() => o.get("dir") === "asc"), b = (e) => {
		u(e), Z({ scope: e === "external" ? "" : e });
	}, x = (e) => {
		f(e), Z({ tag: e });
	}, S = (e) => {
		m(e), Z({ sort: e === "taste" ? "" : e });
	}, C = (e) => {
		_(e), Z({ dir: e ? "asc" : "" });
	}, T = (0, Q.useRef)(null);
	(0, Q.useEffect)(() => {
		let e = [...T.current?.querySelectorAll("[data-catalog-scroll],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Lt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let k = be();
	(0, Q.useSyncExternalStore)(k.subscribe, k.version, k.version);
	let A = $e(), j = we(Ze({
		active: !0,
		home: !1,
		portrait: !1
	})), M = g ? "asc" : "desc", P = Y({
		queryKey: Ie(s, p, M),
		retry: !1,
		refetchOnWindowFocus: !1,
		queryFn: ({ signal: e }) => Ge(s, e, {
			sort: p,
			direction: M
		})
	}), ie = P.data?.metadata_job, ae = (0, Q.useRef)(!1);
	ae.current = ie?.status === "running";
	let I = Y({
		queryKey: v,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: s === "external",
		queryFn: ({ signal: e }) => Ke(e),
		refetchInterval: st(() => ae.current)
	}), L = I.data && I.dataUpdatedAt >= P.dataUpdatedAt ? I.data.metadata_job : ie, oe = (e) => e ? `${e.job_id}:${e.status}` : "", R = (0, Q.useRef)(""), z = (0, Q.useRef)(""), B = I.data?.metadata_job;
	(0, Q.useEffect)(() => {
		let e = oe(B), t = z.current.endsWith(":running") && B && B.status !== "running";
		z.current = e, t && e !== R.current && P.refetch();
	}, [oe(B)]);
	let V = Mt(), H = Mt(), U = async (e, t) => {
		let n = await De(e, {
			sort: p,
			direction: M,
			jobId: L?.job_id
		}, t);
		e !== "start" && await P.refetch({
			cancelRefetch: !0,
			throwOnError: !0
		}), await dt.cancelQueries({ queryKey: v }), R.current = oe(n.metadata_job), dt.setQueryData(v, n);
	}, ce = (e) => {
		H.run(e, (t) => U(e === "stop" ? "cancel" : "refresh", t), () => {});
	}, W = (0, Q.useRef)(!1), ue = s === "external" && L?.status !== "running" && (P.data?.items || []).some((e) => e.metadata_state === "pending" || e.metadata_state === "stale");
	(0, Q.useEffect)(() => {
		ue && !W.current && (W.current = !0, U("start").catch(() => {}));
	}, [ue]);
	let de = P.data?.items || [], fe = [...new Set(de.flatMap((e) => e.tags || []))], me = de.filter((e) => (!d || e.tags?.includes(d)) && (!r || [
		e.code,
		e.title,
		e.performers,
		e.studio,
		...e.tags || [],
		...(e.performer_refs || []).map((e) => e.name)
	].join(" ").toLocaleLowerCase().includes(r.toLocaleLowerCase()))), G = P.isPending;
	return Wt(me), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: T,
		"aria-label": J("catalog:shared.recommendedForYou"),
		"aria-busy": G,
		className: "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, $.jsx)(ee, {
				label: J("catalog:javDiscover.filtersLabel"),
				topLabel: J("catalog:javDiscover.scopeLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: G,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-catalog-scroll": "",
					children: [/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-catalog-views": "",
						children: [[["external", J("catalog:javDiscover.external")], ["library", J("catalog:javDiscover.library")]].map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(O, {
							"data-entity-tag": e,
							"data-entity-press": "",
							pressed: s === e,
							onPress: () => {
								b(e), x("");
							},
							children: t
						}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-entity-sep": "",
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: G ? { __html: et() } : void 0,
						children: G ? null : fe.map((e) => /* @__PURE__ */ (0, $.jsxs)(O, {
							"data-catalog-tag": e,
							"data-entity-press": "",
							pressed: d === e,
							onPress: () => x(d === e ? "" : e),
							children: [e, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: de.filter((t) => t.tags?.includes(e)).length
							})]
						}, e))
					})]
				}),
				bottom: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-catalog-readout": "",
						children: G ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : J("catalog:countLabel.works", { count: me.length })
					}),
					/* @__PURE__ */ (0, $.jsx)(N, { currentHref: () => location.pathname + location.search }),
					r || d ? /* @__PURE__ */ (0, $.jsx)(te, {
						onPress: () => {
							x(""), a();
						},
						children: J("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							s === "external" ? /* @__PURE__ */ (0, $.jsx)(D, {
								"data-entity-batch": "",
								"data-jav-metadata-update": "",
								label: L?.status === "running" ? J("catalog:javDiscover.stopUpdating") : J("catalog:javDiscover.updateMetadata"),
								disabled: G,
								"data-skeleton-action": G ? "" : void 0,
								busy: !!H.busy,
								icon: L?.status === "running" ? mn : hn,
								onPress: () => ce(L?.status === "running" ? "stop" : "update")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(se, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: A,
								options: ne,
								onChange: Ot
							}),
							/* @__PURE__ */ (0, $.jsx)(le, {
								sorts: y.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === p,
									dir: M
								})),
								onSort: (e) => {
									e === p ? C(!g) : (S(e), C(e === "code"));
								}
							})
						]
					})
				] })
			}),
			G ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javDiscover.loading"),
				dangerouslySetInnerHTML: { __html: Qe("discover", A) }
			}) : null,
			P.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				title: J("catalog:javDiscover.failed"),
				children: Ve(P.error)
			}) : null,
			s === "external" && L?.status === "running" ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(pe, {
					kind: _e("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: L.completed,
						count: L.total
					}),
					value: L.completed,
					total: L.total
				})
			}) : null,
			L && L.status !== "running" && (L.status !== "complete" || L.failed > 0) ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "neutral",
				action: /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "secondary",
					...K(H.busy === "retry"),
					"aria-label": J("catalog:javMetadata.retry"),
					onClick: () => ce("retry"),
					children: J("catalog:shared.retryNow")
				}),
				children: tt(L) || J("catalog:javMetadata.progress", {
					completed: L.completed,
					count: L.total
				})
			}) : null,
			H.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				children: H.error
			}) : null,
			!G && !P.error && !me.length ? /* @__PURE__ */ (0, $.jsx)(E, {
				icon: w,
				title: J(r || d ? "catalog:javDiscover.noMatches" : "catalog:javDiscover.noTasteMatches"),
				actions: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/taste",
					variant: "secondary",
					children: J("catalog:javDiscover.viewTaste")
				}), r || d ? /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => {
						a(), f(""), Z({
							q: "",
							tag: ""
						});
					},
					children: J("catalog:shared.clearFilters")
				}) : s === "library" ? /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "primary",
					size: "small",
					href: "/",
					children: J("catalog:entityPage.browseCollection")
				}) : /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "primary",
					size: "small",
					onClick: () => n({}),
					children: J("catalog:javDiscover.findVideos")
				})] }),
				children: J(r || d ? "catalog:javDiscover.clearFiltersHint" : s === "library" ? "catalog:javDiscover.libraryEmptyHint" : "catalog:javDiscover.externalEmptyHint")
			}) : null,
			V.error ? /* @__PURE__ */ (0, $.jsx)(F, {
				tone: "error",
				children: V.error
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: re,
				style: { "--card-ratio": j },
				children: me.map((r) => {
					let a = ft(r.taste_score ?? r.score), o = [
						a.label,
						J("catalog:javScore.taste", { score: Le(r.taste_score ?? r.score) }),
						P.data?.ranking_method === "mmr" && r.ranking_score != null ? J("catalog:javScore.ranking", { score: Le(r.ranking_score) }) : "",
						r.source_score == null ? "" : J("catalog:javScore.siteRating", { rating: r.source_score.toFixed(1) }),
						...Et(r.reasons, r.reason_codes, r.reason_params)
					].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, $.jsx)(rn, {
						item: r,
						layout: A,
						javImage: k.value.javImage,
						readOnly: e,
						navigate: i,
						tag: d,
						onTag: x,
						wanting: V.busy === String(r.id),
						onWant: () => {
							V.run(String(r.id), (e) => ve({ code: r.code }, e), () => {
								t(J("catalog:javWant.added")), q(), P.refetch();
							});
						},
						onResource: () => n(en(r)),
						badge: /* @__PURE__ */ (0, $.jsx)("button", {
							"data-jav-taste-score": "",
							type: "button",
							title: o,
							"aria-label": J("catalog:javScore.badgeLabel", {
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
export { _n as JavPage };

//# debugId=99298380-dc9c-47fe-9e0c-32337f1fdf9d