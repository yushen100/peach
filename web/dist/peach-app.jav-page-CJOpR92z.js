(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "279ce96e-20e2-4a9f-bf3a-dcc9f7d1b985", e._sentryDebugIdIdentifier = "sentry-dbid-279ce96e-20e2-4a9f-bf3a-dcc9f7d1b985");
	} catch {}
})();
import { $76d00c5a4edb230a$export$76ccd210b9029917 as e, $76d00c5a4edb230a$export$816b5d811295e6bc as t, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as n, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as r, $76d00c5a4edb230a$export$f850895b287ef28e as i, $fe21c36db05242bb$export$d7b12c4107be0d61 as a, ActivityMotion as o, ArtSlot as s, Button as c, ButtonLink as l, Bx as u, COVER_STATE_TITLE as d, CatalogViewToggle as f, Checkbox as p, ChevronSortDown as m, Chip as h, CloudDownloadDialog as g, CoverQueue as _, DISCOVERY_METADATA_KEY as v, DISCOVERY_SORTS as y, DOWNLOADS_KEY as ee, DOWNLOADS_URL as b, DataTableFooter as x, DataTableFrame as S, E3 as C, EmptyFocusButton as w, EmptyState as T, FilterGlassRows as te, FilterIconButton as E, FilterPill as D, GlassPill as ne, IndexSearch as O, Input as k, JAV_LAYOUTS as re, JAV_RECOMMENDATION_GRID as ie, JAV_SELECTION_EVENT as A, JavHeader as j, LibraryShortcuts as M, M6 as N, Note as P, PHASES as ae, RELEASE_COLUMN_VISIBILITY_KEY as oe, RELEASE_COLUMN_WIDTHS_KEY as F, RELEASE_PAGE_SIZES as I, RELEASE_SORTS as se, RELEASE_SORT_COLUMNS as L, SEGMENT as R, SEGMENTED_TRACK as z, SegmentedRadioGroup as B, Segments as ce, SelectionDock as V, Shuffle as le, SortKeys as ue, SourceAvatar as H, Table as U, TableColumnControls as de, TableColumnResizer as fe, TaskProgress as pe, WANTS_KEY as me, WantMagnets as W, Wt as G, __toESM as he, activityKind as ge, addWant as _e, apiGet as ve, appSettingsStore as ye, avatarInner as be, busyProps as K, cachedMagnetStates as xe, cardClass as Se, cardRatio as Ce, catalogListSkeletonCellHtml as we, composingKey as Te, controlDiscoveryMetadata as Ee, controlReleaseMetadata as De, coverArrived as Oe, coverFetching as ke, coverFetchingHtml as Ae, coverReason as je, coverStateAction as Me, coverUrl as Ne, discoveryArtwork as Pe, discoveryKey as Fe, discoveryScore as Ie, entityDisplayName as Le, entityFaceImg as Re, entityPath as ze, errorMessage as Be, esc as Ve, facePos as He, fetchCoverNow as Ue, fetchDiscoveries as We, fetchDiscoveryMetadata as Ge, fetchReleases as Ke, fetchWants as qe, firstGrapheme as Je, fmtDur as Ye, gridLayout as Xe, invalidateWants as q, javContentSkeleton as Ze, javLayout as Qe, javTagSkeleton as $e, jobText as et, joinList as tt, keepPreviousData as nt, lastSearchNote as rt, leadingGraphemes as it, logoUrl as at, metadataInterval as ot, pageWindow as st, qE as ct, queryClient as lt, recommendationScore as ut, relayoutCovers as dt, releaseColumns as ft, releaseFilters as pt, releaseKey as mt, removeWants as ht, require_jsx_runtime as gt, require_react as _t, resetWants as vt, restoreWants as yt, searchNote as bt, selectRange as xt, selectionSummary as St, serverLabelList as Ct, spriteGlyph as wt, storeJavLayout as Tt, suppressShiftTextSelection as Et, t as J, textLang as Dt, tierPlaceholdersHtml as Ot, useAction as kt, useCatalogView as At, useEntityNames as jt, useQuery as Y, useTablePreferences as Mt, wantName as X, wantsInterval as Nt, wireHorizontalScroller as Pt, writeJavQuery as Z } from "./peach-app.js";
import { JavBatchResources as Ft } from "./peach-app.jav-batch-resources-B1BkGgyg.js";
import { ErrorLine as It } from "./peach-app.source-view-B-2OVj4g.js";
// src/react/jav/jav-selection.tsx
var Q = /* @__PURE__ */ he(_t(), 1), $ = gt();
function Lt(e) {
	let t = new MutationObserver(e);
	return t.observe(document.body, {
		attributes: !0,
		attributeFilter: ["data-density"]
	}), () => t.disconnect();
}
var Rt = () => document.body.dataset.density === "dense", zt = (0, Q.createContext)(null), Bt = () => (0, Q.useContext)(zt);
function Vt(e) {
	let t = Bt()?.visible;
	(0, Q.useEffect)(() => {
		t?.(e);
	}, [e, t]);
}
function Ht({ children: e, readOnly: t, receipt: n, dock: r = !0 }) {
	let i = (0, Q.useSyncExternalStore)(Lt, Rt, () => !1), [a, o] = (0, Q.useState)(!1), [s, l] = (0, Q.useState)(/* @__PURE__ */ new Map()), [u, d] = (0, Q.useState)([]), [f, p] = (0, Q.useState)(null), m = (0, Q.useRef)(null), h = new Set(s.keys()), g = St(h, u.map((e) => e.code)), _ = (0, Q.useCallback)((e) => {
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
		return window.addEventListener(A, e), () => window.removeEventListener(A, e);
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
	let ee = (e, t = !1) => {
		o(!0);
		let n = m.current;
		m.current = e.code, l((r) => {
			let i = new Set(r.keys());
			xt(i, u.map((e) => e.code), n, e.code, t);
			let a = new Map([
				...r,
				...u.map((e) => [e.code, e]),
				[e.code, e]
			]);
			return new Map([...i].map((e) => [e, a.get(e)]));
		});
	}, b = [...s.values()].filter((e) => !e.wanted && !e.asset_id), x = (() => {
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
							let e = await _e({ code: r.code });
							e?.created && t.push(e.want.id);
						} catch (t) {
							throw Error(J("catalog:javSelection.wantPartialFailed", {
								count: e.size,
								code: r.code,
								error: Be(t)
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
					t.length && await ht(t), await q();
				};
			},
			receipt: () => J("catalog:javSelection.wantAdded", { count: e.size })
		};
	})(), S = { receipt: n };
	return /* @__PURE__ */ (0, $.jsxs)(zt.Provider, {
		value: {
			dense: i,
			mode: a,
			selected: h,
			toggle: ee,
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
			/* @__PURE__ */ (0, $.jsxs)(V, {
				visible: r && a,
				count: J("catalog:javSelection.selectedCount", { count: s.size }),
				label: J("catalog:javSelection.dockLabel"),
				actions: [{
					action: x,
					items: b,
					host: S,
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
			/* @__PURE__ */ (0, $.jsx)(Ft, {
				items: f,
				close: () => p(null),
				readOnly: t,
				receipt: n
			})
		]
	});
}
// src/react/wants/want-list.tsx
var Ut = {
	code: J("catalog:wants.originManual"),
	feed: J("catalog:entityHero.subscribeNewReleases"),
	follow: J("catalog:entityHero.following")
}, Wt = [
	["all", J("catalog:shared.all")],
	["available", J("catalog:wants.hasMagnet")],
	["missing", J("catalog:wants.noMagnet")]
], Gt = (e) => [
	e.release_date,
	e.studio,
	e.performers,
	Ut[e.origin]
].filter(Boolean).join(" · ");
function Kt({ want: e }) {
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
function qt({ want: e, readOnly: t, busy: n, onReset: r, onRemove: i, onCloudDownload: a, downloads: o, provider: s, toast: u, picked: d }) {
	let [f, m] = (0, Q.useState)(""), h = e.link || f || (e.code ? `https://javdb.com/search?q=${encodeURIComponent(e.code)}&f=all` : ""), g = e.code && e.phase === "searching" ? rt(e) : bt(e);
	return /* @__PURE__ */ (0, $.jsxs)("li", {
		"data-want-id": e.id,
		className: Se({ className: "flex flex-col gap-4 max-sm:p-4" }),
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
				/* @__PURE__ */ (0, $.jsx)(Kt, { want: e }),
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
						Gt(e) ? /* @__PURE__ */ (0, $.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: Gt(e)
						}) : null,
						g ? /* @__PURE__ */ (0, $.jsx)("p", {
							"data-want-note": "",
							className: "text-caption-1-regular text-text-secondary",
							children: g
						}) : null,
						e.scrape_error ? /* @__PURE__ */ (0, $.jsx)(It, {
							text: e.scrape_error,
							prefix: J("catalog:wants.metadataNotFound"),
							tone: "muted"
						}) : null,
						/* @__PURE__ */ (0, $.jsxs)("div", {
							className: "mt-1 flex flex-wrap items-center gap-2",
							children: [
								h ? /* @__PURE__ */ (0, $.jsx)(l, {
									"data-button-link": "",
									variant: "secondary",
									size: "small",
									trailingIcon: G,
									href: h,
									target: "_blank",
									rel: "noopener noreferrer",
									children: J("catalog:wants.sourcePage")
								}) : null,
								/* @__PURE__ */ (0, $.jsx)(c, {
									variant: "secondary",
									size: "small",
									leadingIcon: N,
									disabled: t,
									...K(n === `remove:${e.id}`),
									onClick: i,
									children: J("catalog:shared.remove")
								}),
								e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "secondary",
									size: "small",
									disabled: t,
									...K(n === `reset:${e.id}`),
									onClick: r,
									children: J("catalog:wants.searchAgain")
								}) : null,
								e.phase === "searching" || e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(c, {
									variant: "secondary",
									size: "small",
									onClick: a,
									children: J("catalog:shared.searchTorrents")
								}) : null
							]
						})
					]
				})
			]
		}), e.code && (e.phase === "searching" || e.phase === "given_up") ? /* @__PURE__ */ (0, $.jsx)(W, {
			want: e,
			readOnly: t,
			downloads: o,
			provider: s,
			toast: u,
			onSource: m
		}) : null]
	});
}
function Jt({ phase: e, label: t, rows: n, row: r }) {
	let [i, o] = (0, Q.useState)(1), [s, l] = (0, Q.useState)(20), [u, d] = (0, Q.useState)("all"), f = xe(n), p = (e) => e.has_magnets ?? f.get(e.code || "") ?? !1, m = n.filter(p), h = e !== "searching" || u === "all" ? n : n.filter((e) => p(e) === (u === "available")), g = st(h.length, s, i);
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
				}), e === "searching" ? /* @__PURE__ */ (0, $.jsx)(B, {
					name: "want-magnet-filter",
					"aria-label": J("catalog:wants.magnetFilter"),
					orientation: "horizontal",
					value: u,
					className: z,
					onChange: (e) => {
						d(e), o(1);
					},
					children: Wt.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)(a, {
						value: e,
						"aria-label": t,
						className: R,
						children: [t, /* @__PURE__ */ (0, $.jsx)("span", {
							className: "text-caption-1-regular tabular-nums text-text-tertiary",
							children: (e === "all" ? n.length : e === "available" ? m.length : n.length - m.length).toLocaleString()
						})]
					}, e))
				}) : null]
			}),
			h.length ? null : /* @__PURE__ */ (0, $.jsx)(T, {
				size: "compact",
				icon: ct,
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
				children: /* @__PURE__ */ (0, $.jsx)(x, {
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
function Yt({ readOnly: e, toast: t, query: n = "", clearQuery: r }) {
	let [i, a] = (0, Q.useState)(""), [o, s] = (0, Q.useState)(null), l = kt(), u = Y({
		queryKey: me,
		queryFn: ({ signal: e }) => qe(e),
		staleTime: 3e4,
		refetchInterval: Nt
	}), d = () => {
		let n = i.trim();
		n && !e && l.run("add", (e) => _e({ code: n }, e), (e) => {
			t(e.created ? J("catalog:wants.added", { name: X(e.want) }) : J("catalog:wants.alreadyAdded", { name: X(e.want) })), a(""), q();
		});
	}, f = (e) => {
		e.key === "Enter" && !Te(e.nativeEvent) && (e.preventDefault(), d());
	}, p = (e) => {
		l.run(`remove:${e.id}`, (t) => ht([e.id], t), () => {
			t(J("catalog:wants.removed", { name: X(e) })), q();
		});
	}, m = (e) => {
		l.run(`reset:${e.id}`, (t) => vt([e.id], t), () => {
			t(J("catalog:wants.backToSearching", { name: X(e) })), q();
		});
	}, h = u.data, _ = (h?.items || []).filter((e) => !n || [
		e.code,
		e.title,
		e.performers
	].join(" ").toLocaleLowerCase().includes(n.toLocaleLowerCase())), v = Bt(), y = !!v?.mode, [x, S] = (0, Q.useState)(/* @__PURE__ */ new Set()), [C, te] = (0, Q.useState)(null);
	(0, Q.useEffect)(() => {
		y || S(/* @__PURE__ */ new Set());
	}, [y]);
	let E = _.filter((e) => x.has(e.id)), D = _.length > 0 && E.length === _.length, ne = { receipt: t }, O = {
		key: "remove",
		label: J("catalog:shared.remove"),
		reversal: "undo",
		danger: !0,
		confirm: (e) => ({
			title: J("catalog:wants.removeMany"),
			body: J("catalog:wants.removeManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await ht(e.map((e) => e.id));
			return await q(), async () => {
				await yt(t), await q();
			};
		},
		receipt: (e) => J("catalog:wants.removedMany", { count: e.length })
	}, re = {
		key: "reset",
		label: J("catalog:wants.searchAgain"),
		reversal: "undo",
		confirm: (e) => ({
			title: J("catalog:wants.searchAgainMany"),
			body: J("catalog:wants.searchAgainManyBody", { count: e.length })
		}),
		run: async (e) => {
			let { previous: t } = await vt(e.map((e) => e.id));
			return await q(), async () => {
				await yt(t), await q();
			};
		},
		receipt: (e) => J("catalog:wants.searchAgainDone", { count: e.length })
	}, ie = E.filter((e) => e.code && (e.phase === "searching" || e.phase === "given_up")), A = Y({
		queryKey: ee,
		queryFn: ({ signal: e }) => ve(`${b}?limit=100`, e),
		enabled: _.some((e) => e.code && (e.phase === "searching" || e.phase === "given_up"))
	}), j = A.data?.providers.filter((e) => e.configured) || [], M = j[0]?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"aria-busy": u.isPending,
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: Se({
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
							children: /* @__PURE__ */ (0, $.jsx)(k, {
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
					l.error ? /* @__PURE__ */ (0, $.jsx)(P, {
						tone: "error",
						title: J("catalog:wants.actionFailed"),
						children: l.error
					}) : null
				]
			}),
			u.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				title: J("catalog:wants.loadFailed"),
				children: Be(u.error)
			}) : null,
			u.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:wants.loading"),
				dangerouslySetInnerHTML: { __html: Ze("wants") }
			}) : null,
			h?.scraping ? /* @__PURE__ */ (0, $.jsx)(pe, {
				embedded: !0,
				kind: ge("want-scrape"),
				label: J("catalog:wants.fetchingNew")
			}) : null,
			h?.searching ? /* @__PURE__ */ (0, $.jsx)(pe, {
				embedded: !0,
				kind: ge("want-search"),
				label: J("catalog:wants.searchingResources")
			}) : null,
			A.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				title: J("catalog:wants.downloadSettingsFailed"),
				children: Be(A.error)
			}) : null,
			A.data && !j.length ? /* @__PURE__ */ (0, $.jsxs)(P, {
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
			A.data && !A.data.available ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "neutral",
				children: J("catalog:wants.cloudPrimaryOnly")
			}) : null,
			h && !_.length ? /* @__PURE__ */ (0, $.jsx)(T, {
				size: "compact",
				icon: ct,
				title: J(n ? "catalog:wants.noSearchMatches" : "catalog:wants.empty"),
				actions: n && r ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: r,
					children: J("catalog:shared.clearSearch")
				}) : !n && !e ? /* @__PURE__ */ (0, $.jsx)(w, {
					target: `input[aria-label="${J("catalog:shared.code")}"]`,
					children: J("catalog:wants.addWork")
				}) : void 0,
				children: J(n ? "catalog:wants.tryOtherSearch" : "catalog:wants.emptyHint")
			}) : null,
			ae.map(([n, r]) => {
				let i = _.filter((e) => e.phase === n);
				return i.length ? /* @__PURE__ */ (0, $.jsx)(Jt, {
					phase: n,
					label: r,
					rows: i,
					row: (n) => /* @__PURE__ */ (0, $.jsx)(qt, {
						want: n,
						readOnly: e,
						busy: l.busy,
						downloads: A.data,
						provider: M,
						toast: t,
						picked: y ? {
							on: x.has(n.id),
							toggle: (e) => S((t) => {
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
				provider: M
			}),
			/* @__PURE__ */ (0, $.jsxs)(V, {
				visible: y,
				label: J("catalog:wants.dockLabel"),
				count: J("catalog:javSelection.selectedCount", { count: E.length }),
				actions: [{
					action: O,
					items: E,
					host: ne,
					disabled: e,
					done: () => S(/* @__PURE__ */ new Set())
				}, {
					action: re,
					items: E.filter((e) => e.phase === "given_up"),
					host: ne,
					disabled: e,
					done: () => S(/* @__PURE__ */ new Set())
				}],
				leading: /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !_.length,
					onClick: () => S(D ? /* @__PURE__ */ new Set() : new Set(_.map((e) => e.id))),
					children: J(D ? "catalog:javSelection.deselectPage" : "catalog:wants.selectAll")
				}),
				children: [/* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					disabled: !ie.length,
					onClick: () => te(ie.map((e) => ({
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
			/* @__PURE__ */ (0, $.jsx)(Ft, {
				items: C,
				close: () => te(null),
				readOnly: e,
				receipt: t
			})
		]
	});
}
// src/react/jav/discovery-faces.tsx
function Xt({ item: e }) {
	jt();
	let t = e.performer_refs?.length ? e.performer_refs : [...new Set(e.performers.split(/[,，、;/]/).filter(Boolean))].map((e) => ({ name: e })), n = t.slice(0, 5).map((t, n) => {
		let r = { "--media-avatar-index": n }, i = t.source_avatar && t.source_actor_id && !t.has_image ? { children: /* @__PURE__ */ (0, $.jsx)(H, {
			code: e.code,
			person: t
		}) } : { dangerouslySetInnerHTML: { __html: be(t.name, t, null) } };
		return t.id ? /* @__PURE__ */ (0, $.jsx)("a", {
			"data-media-avatar": "",
			style: r,
			href: ze("performer", t.name, t.id),
			"aria-label": J("catalog:javDiscovery.openActress", { name: Le("performer", t.name, t.id) }),
			...i
		}, t.name) : /* @__PURE__ */ (0, $.jsx)("span", {
			"data-media-avatar": "",
			style: r,
			title: Le("performer", t.name),
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
var Zt = (e) => ({
	...e,
	cover: e.has_cover ? Ne(e, !0) : e.cover_url,
	origin: `${e.asset_id ? "asset" : "feed"}:${e.id}`
}), Qt = "relative inline-grid place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default";
function $t({ item: e, readOnly: t }) {
	let n = kt(), [r, i] = (0, Q.useState)("");
	(0, Q.useSyncExternalStore)(ke.subscribe, ke.revision);
	let a = e.cover_state;
	if (!a) return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-media-nopic": "",
		children: J("catalog:shared.noCover")
	});
	if (a === "fetching" || ke.has(e.code)) return /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Ae() } });
	let s = () => {
		n.run("cover", (t) => Ue(e.code, t), (t) => {
			t.has_cover ? Oe(e.code, t) : i(t.message || J("catalog:javDiscovery.noOfficialCover"));
		});
	}, l = r || n.error ? "missing" : a, u = n.error || r || je(e);
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
				children: Me(l)
			})
		]
	});
}
function en({ item: e, layout: t, javImage: n, readOnly: r, navigate: i, tag: a, onTag: o, wanting: u, onWant: d, onResource: f, badge: p }) {
	let m = Bt(), h = m?.selected.has(e.code), g = !!m?.dense, _ = e.performer_refs?.length ? tt(e.performer_refs.map((e) => e.name)) : e.performers, v = Pe(e, t, n), y = e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`;
	return /* @__PURE__ */ (0, $.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-selected": h ? "" : void 0,
		onMouseDown: Et,
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
				className: Qt,
				children: /* @__PURE__ */ (0, $.jsx)(s, {
					artwork: {
						kind: "cover",
						html: v
					},
					identity: Pe(e, "small", n),
					relayout: (e) => dt(e, t)
				})
			}) : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: Qt,
				children: /* @__PURE__ */ (0, $.jsx)($t, {
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
				children: [/* @__PURE__ */ (0, $.jsx)(Xt, { item: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
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
									lang: Dt(e.title),
									children: e.title
								}) : J("catalog:javDiscovery.titleNotFound")
							]
						}),
						/* @__PURE__ */ (0, $.jsxs)("div", {
							"data-media-byline": "",
							children: [
								e.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsxs)("a", {
									"data-media-who": "",
									href: ze("performer", e.performer_refs[0].name),
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
						leadingIcon: g ? G : void 0,
						trailingIcon: g ? void 0 : G,
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
var tn = {
	widths: F,
	visibility: oe
};
function nn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return e?.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
		"data-list-studio-mark": "",
		src: at(e.name, "icon", e.logo_version),
		alt: "",
		width: 16,
		height: 16,
		loading: "lazy",
		decoding: "async",
		onError: () => n(!0)
	}) : /* @__PURE__ */ (0, $.jsx)("span", {
		"data-list-studio-mark": "",
		"aria-hidden": "true",
		children: it(e?.name || "", 1)
	});
}
function rn({ items: a, waiting: o, filters: l, studios: u, javImage: f, readOnly: h, navigate: g, onTag: _, onSort: v, wanting: y, onWant: ee, onResource: b }) {
	let x = Bt(), C = Mt("jav-releases", ft, tn), w = ft.filter((e) => e.required || C.visibility[e.id] !== !1), T = Object.entries(L).find(([, e]) => e === l.sort)?.[0], te = new Map(u.map((e) => [e.name, e])), E = (e) => (t) => {
		t.preventDefault(), x?.mode || t.shiftKey || t.ctrlKey || t.metaKey ? x?.toggle(e, t.shiftKey) : g(`/works/${encodeURIComponent(e.code)}`);
	}, D = (e, t) => {
		let n = t.performer_refs?.[0]?.name || t.performers.split(/[,，、;/]/)[0] || "";
		switch (e) {
			case "name": {
				let e = Pe(t, "small", f);
				return /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-list-identity": "",
					children: [/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						"data-list-open": "",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: E(t),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-list-picture": "",
							children: e ? /* @__PURE__ */ (0, $.jsx)(s, {
								artwork: {
									kind: "cover",
									html: e
								},
								relayout: (e) => dt(e, "small")
							}) : /* @__PURE__ */ (0, $.jsx)("span", {
								title: je(t) || void 0,
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
							onClick: E(t),
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: t.code }),
								" ",
								t.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: Dt(t.title),
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
					/* @__PURE__ */ (0, $.jsx)(Xt, { item: t }),
					t.performer_refs?.[0]?.id ? /* @__PURE__ */ (0, $.jsx)("a", {
						"data-media-who": "",
						href: ze("performer", n),
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
				children: [/* @__PURE__ */ (0, $.jsx)(nn, { studio: te.get(t.studio) }), /* @__PURE__ */ (0, $.jsx)("span", { children: t.studio })]
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
			case "dur": return Ye(t.duration) || "—";
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
					onClick: () => ee(t),
					children: t.wanted ? J("catalog:javWant.wanted") : J("catalog:javWant.want")
				}), /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					variant: "secondary",
					onClick: () => b(t),
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
					preferences: C,
					label: J("catalog:javReleases.list")
				})
			})
		}), /* @__PURE__ */ (0, $.jsx)(S, {
			follow: !0,
			preferences: C,
			children: /* @__PURE__ */ (0, $.jsxs)(U, {
				"aria-label": J("catalog:javReleases.list"),
				size: "sm",
				sortDescriptor: T ? {
					column: T,
					direction: l.dir === "asc" ? "ascending" : "descending"
				} : void 0,
				onSortChange: (e) => {
					let t = L[String(e.column)];
					t && v(t, e.direction === "ascending" ? "asc" : "desc");
				},
				children: [/* @__PURE__ */ (0, $.jsxs)(i, { children: [
					x?.mode ? /* @__PURE__ */ (0, $.jsx)(t, {
						id: "selection",
						width: 44,
						"aria-label": J("catalog:javReleases.selectVideos"),
						children: /* @__PURE__ */ (0, $.jsx)(p, {
							slot: null,
							"aria-label": J("catalog:catalogList.selectAllOnPage"),
							isSelected: x.all,
							isIndeterminate: x.mixed,
							isDisabled: o || !a.length,
							onChange: x.selectPage
						})
					}) : null,
					w.map((e) => /* @__PURE__ */ (0, $.jsx)(t, {
						id: e.id,
						isRowHeader: e.id === "name",
						allowsSorting: e.id in L,
						...C.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [e.label, e.id in L ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, $.jsx)(m, {})
							}) : null]
						}), /* @__PURE__ */ (0, $.jsx)(fe, {
							preferences: C,
							id: e.id
						})] })
					}, e.id)),
					/* @__PURE__ */ (0, $.jsx)(t, {
						id: "remaining-space",
						"aria-label": J("catalog:catalogList.rowSpacer"),
						"data-table-space": "",
						width: C.spaceWidth,
						minWidth: 0
					})
				] }), /* @__PURE__ */ (0, $.jsx)(e, {
					renderEmptyState: () => J("catalog:javReleases.noMatches"),
					children: o ? Array.from({ length: 6 }, (e, t) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: `skeleton-${t}`,
						"data-list-skeleton-row": "",
						"aria-hidden": "true",
						children: [
							x?.mode ? /* @__PURE__ */ (0, $.jsx)(r, {}) : null,
							w.map((e) => /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: we(e.id) } }) }, e.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, `skeleton-${t}`)) : a.map((e) => /* @__PURE__ */ (0, $.jsxs)(n, {
						id: String(e.id),
						"data-catalog-row": "",
						"data-release-row": "",
						children: [
							x?.mode ? /* @__PURE__ */ (0, $.jsx)(r, { children: /* @__PURE__ */ (0, $.jsx)(p, {
								slot: null,
								"aria-label": J("catalog:javDiscovery.select", { code: e.code }),
								isSelected: x.selected.has(e.code),
								onChange: () => x.toggle(e)
							}) }) : null,
							w.map((t) => /* @__PURE__ */ (0, $.jsx)(r, { children: D(t.id, e) }, t.id)),
							/* @__PURE__ */ (0, $.jsx)(r, { "data-table-space": "" })
						]
					}, e.id))
				})]
			})
		})]
	});
}
// src/react/jav/jav-releases.tsx
var an = `<div data-catalog-tier="performers" data-skeleton="tiers">${Ot("performer")}</div><div data-catalog-tier="studios">${Ot("studio")}</div>`, on = (e) => `<span data-tier-initial>${Ve(Je(Le("performer", e.name, e.id)))}</span>${Re({
	id: e.id,
	hasImage: e.has_image,
	version: e.image_version,
	style: He(e.avatar_focus),
	focus: e.avatar_focus,
	standIn: e.avatar_stand_in
})}`;
function sn({ value: e }) {
	let t = ut(e);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-jav-taste-score": "",
		title: J("catalog:javScore.taste", { score: t.score }),
		children: /* @__PURE__ */ (0, $.jsx)(h, {
			color: t.color,
			children: t.label
		})
	});
}
function cn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-tier-mark": "",
		children: e.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: at(e.name, "icon", e.logo_version),
			alt: "",
			width: 28,
			height: 28,
			loading: "lazy",
			decoding: "async",
			onError: () => n(!0)
		}) : it(e.name, 2)
	});
}
var ln = (e) => Ue(e).then((t) => (t.has_cover && Oe(e, t), t.has_cover));
function un({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	jt();
	let [o, s] = (0, Q.useState)(() => pt(location.search));
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
	}, ee = () => {
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
		let e = [...p.current?.querySelectorAll("[data-catalog-tier],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Pt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let b = ye();
	(0, Q.useSyncExternalStore)(b.subscribe, b.version, b.version);
	let S = Qe(), C = At(), w = Ce(Xe({
		active: !0,
		home: !1,
		portrait: !1
	})), E = Y({
		queryKey: mt(o),
		queryFn: ({ signal: e }) => Ke(o, e),
		placeholderData: nt,
		retry: !1,
		refetchOnWindowFocus: !1
	}), O = E.data?.metadata_job, k = (0, Q.useRef)(!1);
	k.current = O?.status === "running";
	let A = lt.getQueryData(v)?.metadata_job, j = Y({
		queryKey: v,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: O?.status === "running" || A?.status === "running",
		queryFn: ({ signal: e }) => Ge(e),
		refetchInterval: ot(() => k.current)
	}), M = j.data && j.dataUpdatedAt >= E.dataUpdatedAt ? j.data.metadata_job : O, N = M?.status === "running", ae = (0, Q.useRef)(!1);
	(0, Q.useEffect)(() => {
		ae.current && !N && E.refetch(), ae.current = N;
	}, [N, E]);
	let oe = (0, Q.useRef)(""), F = JSON.stringify([
		o.performer,
		o.studio,
		o.tag,
		o.q,
		o.sort,
		o.dir,
		o.seed
	]), L = !E.isPlaceholderData && (E.data?.metadata_unread || 0) > 0 && !N;
	(0, Q.useEffect)(() => {
		L && oe.current !== F && (oe.current = F, De("start", o).then(async (e) => {
			await lt.cancelQueries({ queryKey: v }), lt.setQueryData(v, e);
		}).catch(() => {}));
	}, [L, F]);
	let R = kt(), z = (e) => {
		R.run(String(e.id), (t) => _e({ code: e.code }, t), () => {
			t(J("catalog:javWant.added")), q(), E.refetch();
		});
	}, B = E.data;
	Vt(B?.items || []);
	let V = E.isPending, H = !!(o.performer || o.studio || o.tag || o.q), U = Math.max(1, Math.ceil((B?.total || 0) / o.size));
	return (0, Q.useEffect)(() => {
		!B || E.isPlaceholderData || o.page <= U || (s((e) => ({
			...e,
			page: U
		})), Z({ page: U > 1 ? String(U) : "" }));
	}, [
		B,
		E.isPlaceholderData,
		o.page,
		U
	]), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: p,
		"aria-label": J("catalog:entityHero.subscribeNewReleases"),
		"aria-busy": V || E.isFetching,
		className: "flex min-w-0 scroll-mt-24 flex-col gap-4",
		children: [
			V ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-catalog-tiers": "",
				"aria-busy": "true",
				dangerouslySetInnerHTML: { __html: an }
			}) : null,
			B && (B.facets.performers.length || B.facets.studios.length) ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-catalog-tiers": "",
				"data-release-tiers": "",
				children: [B.facets.performers.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "performers",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByActress"),
					children: B.facets.performers.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-performer": "",
						"aria-pressed": o.performer === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: Le("performer", e.name, e.id),
							count: e.count
						}),
						onClick: () => d("performer", e.name),
						children: [/* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-ring": "",
							dangerouslySetInnerHTML: { __html: on(e) }
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-name": "",
							children: Le("performer", e.name, e.id)
						})]
					}, e.name))
				}) : null, B.facets.studios.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "studios",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByLabel"),
					children: B.facets.studios.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-studio": "",
						"aria-pressed": o.studio === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: e.name,
							count: e.count
						}),
						onClick: () => d("studio", e.name),
						children: [
							/* @__PURE__ */ (0, $.jsx)(cn, { studio: e }),
							e.name,
							/* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: e.count
							})
						]
					}, e.name))
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, $.jsx)(te, {
				label: J("catalog:javReleases.filtersLabel"),
				topLabel: J("catalog:javReleases.tagsLabel"),
				attrs: {
					"data-filter-frame": "",
					"data-jav-filter": "",
					"data-catalog-frame": ""
				},
				busy: V,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-scroll": "",
					children: /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: V ? { __html: $e() } : void 0,
						children: V ? null : B?.facets.tags.map((e) => /* @__PURE__ */ (0, $.jsxs)(D, {
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
						children: V ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : H ? J("catalog:javReleases.matchedCount", {
							matched: B?.total || 0,
							count: B?.candidate_total || 0
						}) : J("catalog:countLabel.works", { count: B?.total || 0 })
					}),
					H ? /* @__PURE__ */ (0, $.jsx)(ne, {
						onPress: h,
						children: J("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							/* @__PURE__ */ (0, $.jsx)(le, {
								onPress: ee,
								busy: o.sort === "random" && E.isFetching
							}),
							C === "cards" ? /* @__PURE__ */ (0, $.jsx)(ce, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: S,
								options: re,
								onChange: Tt
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(f, {}),
							/* @__PURE__ */ (0, $.jsx)(ue, {
								sorts: se.map(([e, t, n]) => ({
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
			V && C === "cards" ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javReleases.loading"),
				dangerouslySetInnerHTML: { __html: Ze("discover", S) }
			}) : null,
			E.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				title: J("catalog:javReleases.failed"),
				children: Be(E.error)
			}) : null,
			N && M ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(pe, {
					kind: ge("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: M.completed,
						count: M.total
					}),
					value: M.completed,
					total: M.total
				})
			}) : null,
			e ? null : /* @__PURE__ */ (0, $.jsx)(_, {
				scope: J("catalog:javReleases.coverQueueScope"),
				fetchOne: ln,
				codes: (B?.items || []).filter((e) => e.cover_state === "queued" && !e.cover_url).map((e) => e.code),
				settled: (e, n) => {
					t(e === n ? J("catalog:javReleases.coversFetched", { count: n }) : J("catalog:javReleases.coversPartial", {
						got: e,
						count: n
					})), E.refetch();
				}
			}),
			!V && !E.error && !B?.items.length ? /* @__PURE__ */ (0, $.jsx)(T, {
				icon: u,
				title: J(H ? "catalog:javReleases.noMatches" : "catalog:javReleases.emptyTitle"),
				actions: H ? /* @__PURE__ */ (0, $.jsx)(c, {
					size: "small",
					onClick: h,
					children: J("catalog:shared.clearFilters")
				}) : /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					href: "/subscriptions?tab=add",
					children: J("catalog:javReleases.addSubscription")
				}),
				children: J(H ? "catalog:javReleases.clearFiltersHint" : "catalog:javReleases.emptyHint")
			}) : null,
			R.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				children: R.error
			}) : null,
			C === "list" ? V || B?.items.length ? /* @__PURE__ */ (0, $.jsx)(rn, {
				items: B?.items || [],
				waiting: V,
				filters: o,
				studios: B?.facets.studios || [],
				javImage: b.value.javImage,
				readOnly: e,
				navigate: i,
				onTag: (e) => d("tag", e || o.tag),
				onSort: y,
				wanting: (e) => R.busy === String(e.id),
				onWant: z,
				onResource: (e) => n(Zt(e))
			}) : null : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: ie,
				style: { "--card-ratio": w },
				children: (B?.items || []).map((t) => /* @__PURE__ */ (0, $.jsx)(en, {
					item: t,
					layout: S,
					javImage: b.value.javImage,
					readOnly: e,
					navigate: i,
					tag: o.tag,
					onTag: (e) => d("tag", e || o.tag),
					wanting: R.busy === String(t.id),
					onWant: () => z(t),
					onResource: () => n(Zt(t)),
					badge: o.sort === "taste" ? /* @__PURE__ */ (0, $.jsx)(sn, { value: t.taste_score }) : void 0
				}, t.id))
			}),
			B ? /* @__PURE__ */ (0, $.jsx)(x, {
				label: J("catalog:javTabs.newReleases"),
				total: B.total,
				pagination: {
					pageIndex: o.page - 1,
					pageSize: o.size
				},
				onChange: m,
				unit: J("catalog:catalogList.footerUnit"),
				pageUnit: J("catalog:catalogList.footerPageUnit"),
				pageSizes: I
			}) : null
		]
	});
}
// src/react/jav/jav-page.tsx
var dn = wt("x"), fn = wt("refresh-cw"), pn = {
	releases: J("catalog:javSearch.filterReleases"),
	discover: J("catalog:javSearch.filterRecommended"),
	wants: J("catalog:javSearch.filterWants")
};
function mn({ tab: e, readOnly: t, navigate: n, receipt: r }) {
	let [i, a] = (0, Q.useState)(null), [o, s] = (0, Q.useState)(() => new URLSearchParams(location.search).get("q") || ""), c = (e) => {
		s(e), Z({ q: e });
	};
	return /* @__PURE__ */ (0, $.jsx)(Ht, {
		readOnly: t,
		receipt: r,
		dock: e !== "wants",
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex w-full flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, $.jsx)(j, {
					tab: e,
					navigate: n,
					find: () => a({}),
					search: /* @__PURE__ */ (0, $.jsx)(O, {
						label: pn[e] || J("catalog:javDiscover.filter"),
						value: o,
						onQuery: c
					})
				}),
				e === "releases" ? /* @__PURE__ */ (0, $.jsx)(un, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : e === "discover" ? /* @__PURE__ */ (0, $.jsx)(hn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : /* @__PURE__ */ (0, $.jsx)(Yt, {
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
function hn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	let o = new URLSearchParams(location.search), [s, u] = (0, Q.useState)(() => o.get("scope") === "library" ? "library" : "external"), [d, f] = (0, Q.useState)(() => o.get("tag") || ""), [p, m] = (0, Q.useState)(() => y.some(([e]) => e === o.get("sort")) ? o.get("sort") : "taste"), [g, _] = (0, Q.useState)(() => o.get("dir") === "asc"), ee = (e) => {
		u(e), Z({ scope: e === "external" ? "" : e });
	}, b = (e) => {
		f(e), Z({ tag: e });
	}, x = (e) => {
		m(e), Z({ sort: e === "taste" ? "" : e });
	}, S = (e) => {
		_(e), Z({ dir: e ? "asc" : "" });
	}, w = (0, Q.useRef)(null);
	(0, Q.useEffect)(() => {
		let e = [...w.current?.querySelectorAll("[data-catalog-scroll],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Pt(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let O = ye();
	(0, Q.useSyncExternalStore)(O.subscribe, O.version, O.version);
	let k = Qe(), A = Ce(Xe({
		active: !0,
		home: !1,
		portrait: !1
	})), j = g ? "asc" : "desc", N = Y({
		queryKey: Fe(s, p, j),
		retry: !1,
		refetchOnWindowFocus: !1,
		queryFn: ({ signal: e }) => We(s, e, {
			sort: p,
			direction: j
		})
	}), ae = N.data?.metadata_job, oe = (0, Q.useRef)(!1);
	oe.current = ae?.status === "running";
	let F = Y({
		queryKey: v,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: s === "external",
		queryFn: ({ signal: e }) => Ge(e),
		refetchInterval: ot(() => oe.current)
	}), I = F.data && F.dataUpdatedAt >= N.dataUpdatedAt ? F.data.metadata_job : ae, se = (e) => e ? `${e.job_id}:${e.status}` : "", L = (0, Q.useRef)(""), R = (0, Q.useRef)(""), z = F.data?.metadata_job;
	(0, Q.useEffect)(() => {
		let e = se(z), t = R.current.endsWith(":running") && z && z.status !== "running";
		R.current = e, t && e !== L.current && N.refetch();
	}, [se(z)]);
	let B = kt(), V = kt(), le = async (e, t) => {
		let n = await Ee(e, {
			sort: p,
			direction: j,
			jobId: I?.job_id
		}, t);
		e !== "start" && await N.refetch({
			cancelRefetch: !0,
			throwOnError: !0
		}), await lt.cancelQueries({ queryKey: v }), L.current = se(n.metadata_job), lt.setQueryData(v, n);
	}, H = (e) => {
		V.run(e, (t) => le(e === "stop" ? "cancel" : "refresh", t), () => {});
	}, U = (0, Q.useRef)(!1), de = s === "external" && I?.status !== "running" && (N.data?.items || []).some((e) => e.metadata_state === "pending" || e.metadata_state === "stale");
	(0, Q.useEffect)(() => {
		de && !U.current && (U.current = !0, le("start").catch(() => {}));
	}, [de]);
	let fe = N.data?.items || [], me = [...new Set(fe.flatMap((e) => e.tags || []))], W = fe.filter((e) => (!d || e.tags?.includes(d)) && (!r || [
		e.code,
		e.title,
		e.performers,
		e.studio,
		...e.tags || [],
		...(e.performer_refs || []).map((e) => e.name)
	].join(" ").toLocaleLowerCase().includes(r.toLocaleLowerCase()))), G = N.isPending;
	return Vt(W), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: w,
		"aria-label": J("catalog:shared.recommendedForYou"),
		"aria-busy": G,
		className: "flex min-w-0 flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, $.jsx)(te, {
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
						children: [[["external", J("catalog:javDiscover.external")], ["library", J("catalog:javDiscover.library")]].map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(D, {
							"data-entity-tag": e,
							"data-entity-press": "",
							pressed: s === e,
							onPress: () => {
								ee(e), b("");
							},
							children: t
						}, e)), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-entity-sep": "",
							"aria-hidden": "true"
						})]
					}), /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: G ? { __html: $e() } : void 0,
						children: G ? null : me.map((e) => /* @__PURE__ */ (0, $.jsxs)(D, {
							"data-catalog-tag": e,
							"data-entity-press": "",
							pressed: d === e,
							onPress: () => b(d === e ? "" : e),
							children: [e, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: fe.filter((t) => t.tags?.includes(e)).length
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
						}) : J("catalog:countLabel.works", { count: W.length })
					}),
					/* @__PURE__ */ (0, $.jsx)(M, { currentHref: () => location.pathname + location.search }),
					r || d ? /* @__PURE__ */ (0, $.jsx)(ne, {
						onPress: () => {
							b(""), a();
						},
						children: J("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							s === "external" ? /* @__PURE__ */ (0, $.jsx)(E, {
								"data-entity-batch": "",
								"data-jav-metadata-update": "",
								label: I?.status === "running" ? J("catalog:javDiscover.stopUpdating") : J("catalog:javDiscover.updateMetadata"),
								disabled: G,
								"data-skeleton-action": G ? "" : void 0,
								busy: !!V.busy,
								icon: I?.status === "running" ? dn : fn,
								onPress: () => H(I?.status === "running" ? "stop" : "update")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(ce, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: k,
								options: re,
								onChange: Tt
							}),
							/* @__PURE__ */ (0, $.jsx)(ue, {
								sorts: y.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === p,
									dir: j
								})),
								onSort: (e) => {
									e === p ? S(!g) : (x(e), S(e === "code"));
								}
							})
						]
					})
				] })
			}),
			G ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javDiscover.loading"),
				dangerouslySetInnerHTML: { __html: Ze("discover", k) }
			}) : null,
			N.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				title: J("catalog:javDiscover.failed"),
				children: Be(N.error)
			}) : null,
			s === "external" && I?.status === "running" ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(pe, {
					kind: ge("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: I.completed,
						count: I.total
					}),
					value: I.completed,
					total: I.total
				})
			}) : null,
			I && I.status !== "running" && (I.status !== "complete" || I.failed > 0) ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "neutral",
				action: /* @__PURE__ */ (0, $.jsx)(c, {
					variant: "secondary",
					...K(V.busy === "retry"),
					"aria-label": J("catalog:javMetadata.retry"),
					onClick: () => H("retry"),
					children: J("catalog:shared.retryNow")
				}),
				children: et(I) || J("catalog:javMetadata.progress", {
					completed: I.completed,
					count: I.total
				})
			}) : null,
			V.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				children: V.error
			}) : null,
			!G && !N.error && !W.length ? /* @__PURE__ */ (0, $.jsx)(T, {
				icon: C,
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
			B.error ? /* @__PURE__ */ (0, $.jsx)(P, {
				tone: "error",
				children: B.error
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: ie,
				style: { "--card-ratio": A },
				children: W.map((r) => {
					let a = ut(r.taste_score ?? r.score), o = [
						a.label,
						J("catalog:javScore.taste", { score: Ie(r.taste_score ?? r.score) }),
						N.data?.ranking_method === "mmr" && r.ranking_score != null ? J("catalog:javScore.ranking", { score: Ie(r.ranking_score) }) : "",
						r.source_score == null ? "" : J("catalog:javScore.siteRating", { rating: r.source_score.toFixed(1) }),
						...Ct(r.reasons, r.reason_codes, r.reason_params)
					].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, $.jsx)(en, {
						item: r,
						layout: k,
						javImage: O.value.javImage,
						readOnly: e,
						navigate: i,
						tag: d,
						onTag: b,
						wanting: B.busy === String(r.id),
						onWant: () => {
							B.run(String(r.id), (e) => _e({ code: r.code }, e), () => {
								t(J("catalog:javWant.added")), q(), N.refetch();
							});
						},
						onResource: () => n(Zt(r)),
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
export { mn as JavPage };

//# debugId=279ce96e-20e2-4a9f-bf3a-dcc9f7d1b985