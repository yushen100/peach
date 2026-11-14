(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "0826d36e-ed92-4f78-972c-5585b6718cdf", e._sentryDebugIdIdentifier = "sentry-dbid-0826d36e-ed92-4f78-972c-5585b6718cdf");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $76d00c5a4edb230a$export$76ccd210b9029917 as t, $76d00c5a4edb230a$export$816b5d811295e6bc as n, $76d00c5a4edb230a$export$b59bdbef9ce70de2 as r, $76d00c5a4edb230a$export$f6f0c3fe4ec306ea as i, $76d00c5a4edb230a$export$f850895b287ef28e as a, $fe21c36db05242bb$export$d7b12c4107be0d61 as o, ActivityMotion as s, ArtSlot as c, Button as l, ButtonLink as u, Bx as d, COVER_STATE_TITLE as f, CatalogViewToggle as p, Checkbox as m, ChevronSortDown as h, Chip as g, CloudDownloadDialog as _, CoverQueue as v, DISCOVERY_METADATA_KEY as y, DISCOVERY_SORTS as b, DOWNLOADS_KEY as x, DOWNLOADS_URL as S, DataTableFooter as C, DataTableFrame as w, E3 as T, EmptyFocusButton as E, EmptyState as ee, FilterGlassRows as te, FilterIconButton as D, FilterPill as ne, GlassPill as re, IndexSearch as O, Input as ie, JAV_LAYOUTS as ae, JAV_RECOMMENDATION_GRID as oe, JAV_SELECTION_EVENT as k, JavHeader as A, LibraryShortcuts as j, M6 as se, ModalFrame as M, Note as N, P7 as P, PHASES as F, RELEASE_COLUMN_VISIBILITY_KEY as I, RELEASE_COLUMN_WIDTHS_KEY as ce, RELEASE_PAGE_SIZES as le, RELEASE_SORTS as L, RELEASE_SORT_COLUMNS as R, SEGMENT as z, SEGMENTED_TRACK as B, SegmentedRadioGroup as V, Segments as ue, SelectionDock as de, Shuffle as fe, SortKeys as pe, SourceAvatar as me, Table as he, TableColumnControls as H, TableColumnResizer as U, TaskProgress as ge, WANTS_KEY as _e, WantMagnets as ve, Wt as ye, __toESM as be, activityKind as xe, addWant as Se, apiGet as Ce, appSettingsStore as we, avatarInner as Te, busyProps as W, cachedMagnetStates as Ee, cardClass as De, cardRatio as Oe, catalogListSkeletonCellHtml as ke, composingKey as Ae, controlDiscoveryMetadata as je, controlReleaseMetadata as Me, coverArrived as Ne, coverFetching as Pe, coverFetchingHtml as Fe, coverReason as Ie, coverStateAction as Le, coverUrl as Re, discoveryArtwork as ze, discoveryKey as Be, discoveryScore as Ve, entityDisplayName as G, entityFaceImg as He, entityPath as Ue, errorMessage as K, esc as We, facePos as Ge, fetchCoverNow as Ke, fetchDiscoveries as qe, fetchDiscoveryMetadata as Je, fetchReleases as Ye, fetchWants as Xe, firstGrapheme as Ze, fmtDur as Qe, gridLayout as $e, invalidateWants as q, javContentSkeleton as et, javLayout as tt, javTagSkeleton as nt, jobText as rt, joinList as it, keepPreviousData as at, lastSearchNote as ot, leadingGraphemes as st, logoUrl as ct, metadataInterval as lt, pageWindow as ut, qE as dt, queryClient as ft, recommendationScore as pt, relayoutCovers as mt, releaseColumns as ht, releaseFilters as gt, releaseKey as _t, removeWants as vt, require_jsx_runtime as yt, require_react as bt, resetWants as xt, searchNote as St, selectRange as Ct, selectionSummary as wt, serverLabelList as Tt, spriteGlyph as Et, storeJavLayout as Dt, suppressShiftTextSelection as Ot, t as J, textLang as kt, tierPlaceholdersHtml as At, useAction as Y, useCatalogView as jt, useEntityNames as Mt, useQuery as X, useTablePreferences as Nt, wantName as Pt, wireHorizontalScroller as Ft, writeJavQuery as Z } from "./peach-app.js";
import { ErrorLine as It } from "./peach-app.source-view-B-2OVj4g.js";
// src/react/wants/want-list.tsx
var Q = /* @__PURE__ */ be(bt(), 1), $ = yt(), Lt = {
	code: J("catalog:wants.originManual"),
	feed: J("catalog:entityHero.subscribeNewReleases"),
	follow: J("catalog:entityHero.following")
}, Rt = [
	["all", J("catalog:shared.all")],
	["available", J("catalog:wants.hasMagnet")],
	["missing", J("catalog:wants.noMagnet")]
], zt = (e) => [
	e.release_date,
	e.studio,
	e.performers,
	Lt[e.origin]
].filter(Boolean).join(" · ");
function Bt({ want: e }) {
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
function Vt({ want: e, readOnly: t, busy: n, onReset: r, onRemove: i, onCloudDownload: a, downloads: o, provider: s, toast: c }) {
	let [d, f] = (0, Q.useState)(""), p = e.link || d || (e.code ? `https://javdb.com/search?q=${encodeURIComponent(e.code)}&f=all` : ""), m = e.code && e.phase === "searching" ? ot(e) : St(e);
	return /* @__PURE__ */ (0, $.jsxs)("li", {
		"data-want-id": e.id,
		className: De({ className: "flex flex-col gap-4 max-sm:p-4" }),
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 items-start gap-4 max-sm:gap-3",
			children: [/* @__PURE__ */ (0, $.jsx)(Bt, { want: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col gap-1",
				children: [
					/* @__PURE__ */ (0, $.jsxs)("p", {
						className: "flex min-w-0 flex-wrap items-baseline gap-x-2",
						children: [/* @__PURE__ */ (0, $.jsx)("b", {
							className: "min-w-0 text-headline-medium wrap-anywhere text-text-primary",
							children: Pt(e)
						}), e.code && e.title ? /* @__PURE__ */ (0, $.jsx)("span", {
							className: "min-w-0 truncate text-body-2-regular text-text-secondary",
							children: e.title
						}) : null]
					}),
					zt(e) ? /* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: zt(e)
					}) : null,
					m ? /* @__PURE__ */ (0, $.jsx)("p", {
						"data-want-note": "",
						className: "text-caption-1-regular text-text-secondary",
						children: m
					}) : null,
					e.scrape_error ? /* @__PURE__ */ (0, $.jsx)(It, {
						text: e.scrape_error,
						prefix: J("catalog:wants.metadataNotFound"),
						tone: "muted"
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("div", {
						className: "mt-1 flex flex-wrap items-center gap-2",
						children: [
							p ? /* @__PURE__ */ (0, $.jsx)(u, {
								"data-button-link": "",
								variant: "secondary",
								size: "small",
								trailingIcon: ye,
								href: p,
								target: "_blank",
								rel: "noopener noreferrer",
								children: J("catalog:wants.sourcePage")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(l, {
								variant: "secondary",
								size: "small",
								leadingIcon: se,
								disabled: t,
								...W(n === `remove:${e.id}`),
								onClick: i,
								children: J("catalog:shared.remove")
							}),
							e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(l, {
								variant: "secondary",
								size: "small",
								disabled: t,
								...W(n === `reset:${e.id}`),
								onClick: r,
								children: J("catalog:wants.searchAgain")
							}) : null,
							e.phase === "searching" || e.phase === "given_up" ? /* @__PURE__ */ (0, $.jsx)(l, {
								variant: "secondary",
								size: "small",
								onClick: a,
								children: J("catalog:shared.searchTorrents")
							}) : null
						]
					})
				]
			})]
		}), e.code && (e.phase === "searching" || e.phase === "given_up") ? /* @__PURE__ */ (0, $.jsx)(ve, {
			want: e,
			readOnly: t,
			downloads: o,
			provider: s,
			toast: c,
			onSource: f
		}) : null]
	});
}
function Ht({ phase: e, label: t, rows: n, row: r }) {
	let [i, a] = (0, Q.useState)(1), [s, c] = (0, Q.useState)(20), [u, d] = (0, Q.useState)("all"), f = Ee(n), p = (e) => e.has_magnets ?? f.get(e.code || "") ?? !1, m = n.filter(p), h = e !== "searching" || u === "all" ? n : n.filter((e) => p(e) === (u === "available")), g = ut(h.length, s, i);
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
				}), e === "searching" ? /* @__PURE__ */ (0, $.jsx)(V, {
					name: "want-magnet-filter",
					"aria-label": J("catalog:wants.magnetFilter"),
					orientation: "horizontal",
					value: u,
					className: B,
					onChange: (e) => {
						d(e), a(1);
					},
					children: Rt.map(([e, t]) => /* @__PURE__ */ (0, $.jsxs)(o, {
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
			h.length ? null : /* @__PURE__ */ (0, $.jsx)(ee, {
				size: "compact",
				icon: dt,
				title: J("catalog:wants.noFilterMatches"),
				actions: /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					onClick: () => {
						d("all"), a(1);
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
				children: /* @__PURE__ */ (0, $.jsx)(C, {
					label: t,
					total: g.total,
					pagination: {
						pageIndex: g.page - 1,
						pageSize: s
					},
					onChange: (e) => {
						c(e.pageSize), a(e.pageIndex + 1);
					},
					unit: J("catalog:wants.itemUnit")
				})
			})
		]
	});
}
function Ut({ readOnly: e, toast: t, query: n = "", clearQuery: r }) {
	let [i, a] = (0, Q.useState)(""), [o, s] = (0, Q.useState)(null), c = Y(), u = X({
		queryKey: _e,
		queryFn: ({ signal: e }) => Xe(e),
		staleTime: 3e4,
		refetchInterval: (e) => e.state.data?.scraping ? 3e3 : e.state.data?.searching ? 1e4 : !1
	}), d = () => {
		let n = i.trim();
		n && !e && c.run("add", (e) => Se({ code: n }, e), (e) => {
			t(e.created ? J("catalog:wants.added", { name: Pt(e.want) }) : J("catalog:wants.alreadyAdded", { name: Pt(e.want) })), a(""), q();
		});
	}, f = (e) => {
		e.key === "Enter" && !Ae(e.nativeEvent) && (e.preventDefault(), d());
	}, p = (e) => {
		c.run(`remove:${e.id}`, (t) => vt([e.id], t), () => {
			t(J("catalog:wants.removed", { name: Pt(e) })), q();
		});
	}, m = (e) => {
		c.run(`reset:${e.id}`, (t) => xt([e.id], t), () => {
			t(J("catalog:wants.backToSearching", { name: Pt(e) })), q();
		});
	}, h = u.data, g = (h?.items || []).filter((e) => !n || [
		e.code,
		e.title,
		e.performers
	].join(" ").toLocaleLowerCase().includes(n.toLocaleLowerCase())), v = X({
		queryKey: x,
		queryFn: ({ signal: e }) => Ce(`${S}?limit=100`, e),
		enabled: g.some((e) => e.code && (e.phase === "searching" || e.phase === "given_up"))
	}), y = v.data?.providers.filter((e) => e.configured) || [], b = y[0]?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"aria-busy": u.isPending,
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ (0, $.jsxs)("div", {
				className: De({
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
							children: /* @__PURE__ */ (0, $.jsx)(ie, {
								"aria-label": J("catalog:shared.code"),
								placeholder: J("catalog:wants.codePlaceholder"),
								value: i,
								isDisabled: e,
								onChange: a,
								onKeyDown: f
							})
						}), /* @__PURE__ */ (0, $.jsx)(l, {
							variant: "primary",
							disabled: e || !i.trim(),
							...W(c.busy === "add"),
							onClick: d,
							children: J("catalog:shared.add")
						})]
					}),
					c.error ? /* @__PURE__ */ (0, $.jsx)(N, {
						tone: "error",
						title: J("catalog:wants.actionFailed"),
						children: c.error
					}) : null
				]
			}),
			u.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				title: J("catalog:wants.loadFailed"),
				children: K(u.error)
			}) : null,
			u.isPending ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:wants.loading"),
				dangerouslySetInnerHTML: { __html: et("wants") }
			}) : null,
			h?.scraping ? /* @__PURE__ */ (0, $.jsx)(ge, {
				embedded: !0,
				kind: xe("want-scrape"),
				label: J("catalog:wants.fetchingNew")
			}) : null,
			h?.searching ? /* @__PURE__ */ (0, $.jsx)(ge, {
				embedded: !0,
				kind: xe("want-search"),
				label: J("catalog:wants.searchingResources")
			}) : null,
			v.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				title: J("catalog:wants.downloadSettingsFailed"),
				children: K(v.error)
			}) : null,
			v.data && !y.length ? /* @__PURE__ */ (0, $.jsxs)(N, {
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
			v.data && !v.data.available ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "neutral",
				children: J("catalog:wants.cloudPrimaryOnly")
			}) : null,
			h && !g.length ? /* @__PURE__ */ (0, $.jsx)(ee, {
				size: "compact",
				icon: dt,
				title: J(n ? "catalog:wants.noSearchMatches" : "catalog:wants.empty"),
				actions: n && r ? /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					onClick: r,
					children: J("catalog:shared.clearSearch")
				}) : !n && !e ? /* @__PURE__ */ (0, $.jsx)(E, {
					target: `input[aria-label="${J("catalog:shared.code")}"]`,
					children: J("catalog:wants.addWork")
				}) : void 0,
				children: J(n ? "catalog:wants.tryOtherSearch" : "catalog:wants.emptyHint")
			}) : null,
			F.map(([n, r]) => {
				let i = g.filter((e) => e.phase === n);
				return i.length ? /* @__PURE__ */ (0, $.jsx)(Ht, {
					phase: n,
					label: r,
					rows: i,
					row: (n) => /* @__PURE__ */ (0, $.jsx)(Vt, {
						want: n,
						readOnly: e,
						busy: c.busy,
						downloads: v.data,
						provider: b,
						toast: t,
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
				provider: b
			})
		]
	});
}
// src/react/jav/jav-batch-resources.tsx
function Wt({ items: t, close: n, readOnly: r, receipt: i }) {
	let a = X({
		queryKey: x,
		queryFn: ({ signal: e }) => Ce(`${S}?limit=50`, e),
		enabled: !!t
	}), o = a.data?.providers.find((e) => e.configured)?.key || "";
	return /* @__PURE__ */ (0, $.jsxs)(M, {
		isOpen: !!t,
		onOpenChange: (e) => {
			e || n();
		},
		width: "collections",
		children: [/* @__PURE__ */ (0, $.jsxs)("div", {
			className: "sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-separator-border bg-background-full px-5 py-4",
			children: [/* @__PURE__ */ (0, $.jsxs)(e, {
				slot: "title",
				className: "text-title-2-medium text-text-primary",
				children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-copy-key": "jav.resources.title",
						children: J("catalog:javBatch.title")
					}),
					" · ",
					J("catalog:countLabel.works", { count: t?.length || 0 })
				]
			}), /* @__PURE__ */ (0, $.jsx)(l, {
				iconOnly: !0,
				variant: "ghost",
				leadingIcon: P,
				"aria-label": J("catalog:javBatch.close"),
				onClick: n
			})]
		}), /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-6 p-5",
			children: [a.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				children: J("catalog:javBatch.downloadSettingsFailed", { error: K(a.error) })
			}) : null, t?.map((e) => /* @__PURE__ */ (0, $.jsxs)("section", {
				"aria-label": e.code,
				className: "flex min-w-0 flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, $.jsx)("h3", {
						className: "text-headline-medium text-text-primary",
						children: e.code
					}),
					e.title ? /* @__PURE__ */ (0, $.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: e.title
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(ve, {
						want: {
							id: e.id,
							code: e.code,
							title: e.title,
							release_date: e.release_date || null
						},
						queryUrl: `/api/jav/resources?code=${encodeURIComponent(e.code)}`,
						eager: !0,
						readOnly: r,
						downloads: a.data,
						provider: o,
						toast: i
					})
				]
			}, e.code))]
		})]
	});
}
// src/react/jav/jav-selection.tsx
function Gt(e) {
	let t = new MutationObserver(e);
	return t.observe(document.body, {
		attributes: !0,
		attributeFilter: ["data-density"]
	}), () => t.disconnect();
}
var Kt = () => document.body.dataset.density === "dense", qt = (0, Q.createContext)(null), Jt = () => (0, Q.useContext)(qt);
function Yt(e) {
	let t = Jt()?.visible;
	(0, Q.useEffect)(() => {
		t?.(e);
	}, [e, t]);
}
function Xt({ children: e, readOnly: t, receipt: n }) {
	let r = (0, Q.useSyncExternalStore)(Gt, Kt, () => !1), [i, a] = (0, Q.useState)(!1), [o, s] = (0, Q.useState)(/* @__PURE__ */ new Map()), [c, u] = (0, Q.useState)([]), [d, f] = (0, Q.useState)(null), p = (0, Q.useRef)(null), m = Y(), h = new Set(o.keys()), g = wt(h, c.map((e) => e.code)), _ = (0, Q.useCallback)((e) => {
		u((t) => t.length === e.length && t.every((t, n) => t === e[n]) ? t : e), s((t) => {
			let n = e.filter((e) => t.has(e.code) && t.get(e.code) !== e);
			return n.length ? new Map([...t, ...n.map((e) => [e.code, e])]) : t;
		});
	}, []), v = m.cancel, y = (0, Q.useCallback)(() => {
		v(), a(!1), s(/* @__PURE__ */ new Map()), p.current = null;
	}, [v]), b = () => s((e) => {
		let t = new Map(e);
		return c.forEach((e) => g.all ? t.delete(e.code) : t.set(e.code, e)), t;
	});
	(0, Q.useEffect)(() => {
		let e = () => {
			i ? y() : a(!0);
		};
		return window.addEventListener(k, e), () => window.removeEventListener(k, e);
	}, [i, y]), (0, Q.useEffect)(() => (i || (s(/* @__PURE__ */ new Map()), p.current = null), document.getElementById("selectMode")?.setAttribute("aria-pressed", String(i)), () => document.getElementById("selectMode")?.setAttribute("aria-pressed", "false")), [i]), (0, Q.useEffect)(() => {
		if (!i) return;
		let e = (e) => {
			e.target.closest("input,textarea,[contenteditable]:not([contenteditable=\"false\"]),[role=\"dialog\"]") || (e.key === "Escape" && (e.preventDefault(), y()), (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && (e.preventDefault(), s((e) => new Map([...e, ...c.map((e) => [e.code, e])]))));
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [
		i,
		y,
		c
	]);
	let x = (e, t = !1) => {
		a(!0);
		let n = p.current;
		p.current = e.code, s((r) => {
			let i = new Set(r.keys());
			Ct(i, c.map((e) => e.code), n, e.code, t);
			let a = new Map([
				...r,
				...c.map((e) => [e.code, e]),
				[e.code, e]
			]);
			return new Map([...i].map((e) => [e, a.get(e)]));
		});
	}, S = [...o.values()].filter((e) => !e.wanted && !e.asset_id), C = () => {
		m.run("want", async (e) => {
			let t = 0;
			try {
				for (let n of S) {
					e.throwIfAborted();
					try {
						await Se({ code: n.code }, e);
					} catch (e) {
						throw Error(J("catalog:javSelection.wantPartialFailed", {
							count: t,
							code: n.code,
							error: K(e)
						}));
					}
					e.throwIfAborted(), t++, s((e) => {
						let t = new Map(e);
						return t.delete(n.code), t;
					});
				}
				return t;
			} finally {
				q();
			}
		}, (e) => n(J("catalog:javSelection.wantAdded", { count: e })));
	};
	return /* @__PURE__ */ (0, $.jsxs)(qt.Provider, {
		value: {
			dense: r,
			mode: i,
			selected: h,
			toggle: x,
			visible: _,
			selectPage: b,
			all: g.all,
			mixed: g.mixed
		},
		children: [
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-selection": "",
				"data-select-mode": i ? "" : void 0,
				className: "flex min-w-0 flex-col gap-4",
				children: e
			}),
			/* @__PURE__ */ (0, $.jsxs)(de, {
				visible: i,
				count: J("catalog:javSelection.selectedCount", { count: o.size }),
				label: J("catalog:javSelection.dockLabel"),
				children: [
					m.error ? /* @__PURE__ */ (0, $.jsx)("p", {
						role: "alert",
						className: "w-full px-2 text-caption-1-regular text-text-error-primary",
						children: m.error
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(l, {
						size: "small",
						variant: "secondary",
						disabled: !c.length || !!m.busy,
						onClick: b,
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-copy-key": `jav.selection.page.${g.all ? "clear" : "all"}`,
							children: g.all ? J("catalog:javSelection.deselectPage") : J("catalog:javSelection.selectPage")
						})
					}),
					/* @__PURE__ */ (0, $.jsx)(l, {
						size: "small",
						variant: "secondary",
						disabled: t || !S.length,
						...W(m.busy === "want"),
						onClick: C,
						children: J("catalog:javSelection.addToWants")
					}),
					/* @__PURE__ */ (0, $.jsx)(l, {
						size: "small",
						variant: "secondary",
						disabled: !o.size || !!m.busy,
						onClick: () => f([...o.values()]),
						children: J("catalog:shared.searchTorrents")
					}),
					/* @__PURE__ */ (0, $.jsx)(l, {
						size: "small",
						variant: "ghost",
						onClick: y,
						children: J("catalog:javSelection.exit")
					})
				]
			}),
			/* @__PURE__ */ (0, $.jsx)(Wt, {
				items: d,
				close: () => f(null),
				readOnly: t,
				receipt: n
			})
		]
	});
}
// src/react/jav/discovery-faces.tsx
function Zt({ item: e }) {
	Mt();
	let t = e.performer_refs?.length ? e.performer_refs : [...new Set(e.performers.split(/[,，、;/]/).filter(Boolean))].map((e) => ({ name: e })), n = t.slice(0, 5).map((t, n) => {
		let r = { "--media-avatar-index": n }, i = t.source_avatar && t.source_actor_id && !t.has_image ? { children: /* @__PURE__ */ (0, $.jsx)(me, {
			code: e.code,
			person: t
		}) } : { dangerouslySetInnerHTML: { __html: Te(t.name, t, null) } };
		return t.id ? /* @__PURE__ */ (0, $.jsx)("a", {
			"data-media-avatar": "",
			style: r,
			href: Ue("performer", t.name, t.id),
			"aria-label": J("catalog:javDiscovery.openActress", { name: G("performer", t.name, t.id) }),
			...i
		}, t.name) : /* @__PURE__ */ (0, $.jsx)("span", {
			"data-media-avatar": "",
			style: r,
			title: G("performer", t.name),
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
var Qt = (e) => ({
	...e,
	cover: e.has_cover ? Re(e, !0) : e.cover_url,
	origin: `${e.asset_id ? "asset" : "feed"}:${e.id}`
}), $t = "relative inline-grid place-items-center overflow-hidden rounded-2lg bg-background-tertiary-default";
function en({ item: e, readOnly: t }) {
	let n = Y(), [r, i] = (0, Q.useState)("");
	(0, Q.useSyncExternalStore)(Pe.subscribe, Pe.revision);
	let a = e.cover_state;
	if (!a) return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-media-nopic": "",
		children: J("catalog:shared.noCover")
	});
	if (a === "fetching" || Pe.has(e.code)) return /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: Fe() } });
	let o = () => {
		n.run("cover", (t) => Ke(e.code, t), (t) => {
			t.has_cover ? Ne(e.code, t) : i(t.message || J("catalog:javDiscovery.noOfficialCover"));
		});
	}, c = r || n.error ? "missing" : a, u = n.error || r || Ie(e);
	return /* @__PURE__ */ (0, $.jsxs)("div", {
		"data-cover-state": c,
		className: "flex max-w-full flex-col items-center gap-1.5 px-4 text-center",
		children: [
			c === "queued" ? /* @__PURE__ */ (0, $.jsx)(s, {
				kind: "clock",
				size: "card",
				still: !0
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("span", {
				"data-media-nopic": "",
				children: f[c]
			}),
			u ? /* @__PURE__ */ (0, $.jsx)("span", {
				className: "line-clamp-3 text-caption-1-regular text-text-secondary",
				title: u,
				children: u
			}) : null,
			t ? null : /* @__PURE__ */ (0, $.jsx)(l, {
				size: "small",
				variant: "secondary",
				className: "mt-1",
				onClick: o,
				children: Le(c)
			})
		]
	});
}
function tn({ item: e, layout: t, javImage: n, readOnly: r, navigate: i, tag: a, onTag: o, wanting: s, onWant: d, onResource: f, badge: p }) {
	let m = Jt(), h = m?.selected.has(e.code), g = !!m?.dense, _ = e.performer_refs?.length ? it(e.performer_refs.map((e) => e.name)) : e.performers, v = ze(e, t, n), y = e.asset_id ? `/assets/${e.asset_id}` : `/works/${encodeURIComponent(e.code)}`;
	return /* @__PURE__ */ (0, $.jsxs)("article", {
		"data-media-card": "",
		"data-jav-card": "",
		"data-selected": h ? "" : void 0,
		onMouseDown: Ot,
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
				className: $t,
				children: /* @__PURE__ */ (0, $.jsx)(c, {
					artwork: {
						kind: "cover",
						html: v
					},
					identity: ze(e, "small", n),
					relayout: (e) => mt(e, t)
				})
			}) : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-pic": "",
				"data-jav-cover-box": "",
				className: $t,
				children: /* @__PURE__ */ (0, $.jsx)(en, {
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
				children: [/* @__PURE__ */ (0, $.jsx)(Zt, { item: e }), /* @__PURE__ */ (0, $.jsxs)("div", {
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
									lang: kt(e.title),
									children: e.title
								}) : J("catalog:javDiscovery.titleNotFound")
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
					e.link ? /* @__PURE__ */ (0, $.jsx)(u, {
						"data-button-link": "",
						"data-jav-source": "",
						variant: "secondary",
						size: g ? "small" : "medium",
						iconOnly: g,
						"aria-label": J("catalog:shared.viewOnSite"),
						title: J("catalog:shared.viewOnSite"),
						leadingIcon: g ? ye : void 0,
						trailingIcon: g ? void 0 : ye,
						href: e.link,
						target: "_blank",
						rel: "noopener noreferrer",
						children: g ? null : J("catalog:shared.viewOnSite")
					}) : null,
					/* @__PURE__ */ (0, $.jsx)(l, {
						variant: "ghost",
						size: g ? "small" : "medium",
						disabled: r || e.wanted || !!e.asset_id,
						...W(s),
						onClick: d,
						children: e.asset_id ? J("catalog:javWant.imported") : e.wanted ? J("catalog:javWant.wanted") : J("catalog:javWant.want")
					}),
					/* @__PURE__ */ (0, $.jsx)(l, {
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
var nn = {
	widths: ce,
	visibility: I
};
function rn({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return e?.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
		"data-list-studio-mark": "",
		src: ct(e.name, "icon", e.logo_version),
		alt: "",
		width: 16,
		height: 16,
		loading: "lazy",
		decoding: "async",
		onError: () => n(!0)
	}) : /* @__PURE__ */ (0, $.jsx)("span", {
		"data-list-studio-mark": "",
		"aria-hidden": "true",
		children: st(e?.name || "", 1)
	});
}
function an({ items: e, waiting: o, filters: s, studios: u, javImage: d, readOnly: p, navigate: g, onTag: _, onSort: v, wanting: y, onWant: b, onResource: x }) {
	let S = Jt(), C = Nt("jav-releases", ht, nn), T = ht.filter((e) => e.required || C.visibility[e.id] !== !1), E = Object.entries(R).find(([, e]) => e === s.sort)?.[0], ee = new Map(u.map((e) => [e.name, e])), te = (e) => (t) => {
		t.preventDefault(), S?.mode || t.shiftKey || t.ctrlKey || t.metaKey ? S?.toggle(e, t.shiftKey) : g(`/works/${encodeURIComponent(e.code)}`);
	}, D = (e, t) => {
		let n = t.performer_refs?.[0]?.name || t.performers.split(/[,，、;/]/)[0] || "";
		switch (e) {
			case "name": {
				let e = ze(t, "small", d);
				return /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-list-identity": "",
					children: [/* @__PURE__ */ (0, $.jsx)("button", {
						type: "button",
						"data-list-open": "",
						tabIndex: -1,
						"aria-hidden": "true",
						onClick: te(t),
						children: /* @__PURE__ */ (0, $.jsx)("span", {
							"data-list-picture": "",
							children: e ? /* @__PURE__ */ (0, $.jsx)(c, {
								artwork: {
									kind: "cover",
									html: e
								},
								relayout: (e) => mt(e, "small")
							}) : /* @__PURE__ */ (0, $.jsx)("span", {
								title: Ie(t) || void 0,
								children: t.cover_state ? f[t.cover_state] : J("catalog:shared.noCover")
							})
						})
					}), /* @__PURE__ */ (0, $.jsx)("span", {
						"data-list-text": "",
						children: /* @__PURE__ */ (0, $.jsxs)("button", {
							type: "button",
							"data-list-name": "",
							title: `${t.code} · ${t.title || J("catalog:javDiscovery.titleNotFound")}`,
							"aria-label": J("catalog:javDiscovery.viewDetails", { code: t.code }),
							onClick: te(t),
							children: [
								/* @__PURE__ */ (0, $.jsx)("b", { children: t.code }),
								" ",
								t.title ? /* @__PURE__ */ (0, $.jsx)("span", {
									lang: kt(t.title),
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
					/* @__PURE__ */ (0, $.jsx)(Zt, { item: t }),
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
				children: [/* @__PURE__ */ (0, $.jsx)(rn, { studio: ee.get(t.studio) }), /* @__PURE__ */ (0, $.jsx)("span", { children: t.studio })]
			}) : "—";
			case "tags": return t.tags?.length ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-tags": "",
				"data-list-tags": "",
				children: t.tags.map((e) => /* @__PURE__ */ (0, $.jsx)("button", {
					type: "button",
					"data-media-tag": "",
					"aria-pressed": s.tag === e,
					onClick: () => _(s.tag === e ? "" : e),
					children: e
				}, e))
			}) : "—";
			case "code": return t.code;
			case "dur": return Qe(t.duration) || "—";
			case "score": return t.source_score == null ? "—" : `${t.source_score.toFixed(2)} / 5`;
			case "release": return t.release_date || "—";
			default: return /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-release-actions": "",
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					variant: "ghost",
					disabled: p || t.wanted || !!t.asset_id,
					...W(y(t)),
					onClick: () => b(t),
					children: t.wanted ? J("catalog:javWant.wanted") : J("catalog:javWant.want")
				}), /* @__PURE__ */ (0, $.jsx)(l, {
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
				children: /* @__PURE__ */ (0, $.jsx)(H, {
					preferences: C,
					label: J("catalog:javReleases.list")
				})
			})
		}), /* @__PURE__ */ (0, $.jsx)(w, {
			follow: !0,
			preferences: C,
			children: /* @__PURE__ */ (0, $.jsxs)(he, {
				"aria-label": J("catalog:javReleases.list"),
				size: "sm",
				sortDescriptor: E ? {
					column: E,
					direction: s.dir === "asc" ? "ascending" : "descending"
				} : void 0,
				onSortChange: (e) => {
					let t = R[String(e.column)];
					t && v(t, e.direction === "ascending" ? "asc" : "desc");
				},
				children: [/* @__PURE__ */ (0, $.jsxs)(a, { children: [
					S?.mode ? /* @__PURE__ */ (0, $.jsx)(n, {
						id: "selection",
						width: 44,
						"aria-label": J("catalog:javReleases.selectVideos"),
						children: /* @__PURE__ */ (0, $.jsx)(m, {
							slot: null,
							"aria-label": J("catalog:catalogList.selectAllOnPage"),
							isSelected: S.all,
							isIndeterminate: S.mixed,
							isDisabled: o || !e.length,
							onChange: S.selectPage
						})
					}) : null,
					T.map((e) => /* @__PURE__ */ (0, $.jsx)(n, {
						id: e.id,
						isRowHeader: e.id === "name",
						allowsSorting: e.id in R,
						...C.columnProps(e.id),
						children: ({ sortDirection: t }) => /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsxs)("span", {
							className: "flex items-center gap-0.5",
							children: [e.label, e.id in R ? /* @__PURE__ */ (0, $.jsx)("span", {
								"data-sort-indicator": !0,
								"data-direction": t || void 0,
								children: /* @__PURE__ */ (0, $.jsx)(h, {})
							}) : null]
						}), /* @__PURE__ */ (0, $.jsx)(U, {
							preferences: C,
							id: e.id
						})] })
					}, e.id)),
					/* @__PURE__ */ (0, $.jsx)(n, {
						id: "remaining-space",
						"aria-label": J("catalog:catalogList.rowSpacer"),
						"data-table-space": "",
						width: C.spaceWidth,
						minWidth: 0
					})
				] }), /* @__PURE__ */ (0, $.jsx)(t, {
					renderEmptyState: () => J("catalog:javReleases.noMatches"),
					children: o ? Array.from({ length: 6 }, (e, t) => /* @__PURE__ */ (0, $.jsxs)(r, {
						id: `skeleton-${t}`,
						"data-list-skeleton-row": "",
						"aria-hidden": "true",
						children: [
							S?.mode ? /* @__PURE__ */ (0, $.jsx)(i, {}) : null,
							T.map((e) => /* @__PURE__ */ (0, $.jsx)(i, { children: /* @__PURE__ */ (0, $.jsx)("span", { dangerouslySetInnerHTML: { __html: ke(e.id) } }) }, e.id)),
							/* @__PURE__ */ (0, $.jsx)(i, { "data-table-space": "" })
						]
					}, `skeleton-${t}`)) : e.map((e) => /* @__PURE__ */ (0, $.jsxs)(r, {
						id: String(e.id),
						"data-catalog-row": "",
						"data-release-row": "",
						children: [
							S?.mode ? /* @__PURE__ */ (0, $.jsx)(i, { children: /* @__PURE__ */ (0, $.jsx)(m, {
								slot: null,
								"aria-label": J("catalog:javDiscovery.select", { code: e.code }),
								isSelected: S.selected.has(e.code),
								onChange: () => S.toggle(e)
							}) }) : null,
							T.map((t) => /* @__PURE__ */ (0, $.jsx)(i, { children: D(t.id, e) }, t.id)),
							/* @__PURE__ */ (0, $.jsx)(i, { "data-table-space": "" })
						]
					}, e.id))
				})]
			})
		})]
	});
}
// src/react/jav/jav-releases.tsx
var on = `<div data-catalog-tier="performers" data-skeleton="tiers">${At("performer")}</div><div data-catalog-tier="studios">${At("studio")}</div>`, sn = (e) => `<span data-tier-initial>${We(Ze(G("performer", e.name, e.id)))}</span>${He({
	id: e.id,
	hasImage: e.has_image,
	version: e.image_version,
	style: Ge(e.avatar_focus),
	focus: e.avatar_focus,
	standIn: e.avatar_stand_in
})}`;
function cn({ value: e }) {
	let t = pt(e);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-jav-taste-score": "",
		title: J("catalog:javScore.taste", { score: t.score }),
		children: /* @__PURE__ */ (0, $.jsx)(g, {
			color: t.color,
			children: t.label
		})
	});
}
function ln({ studio: e }) {
	let [t, n] = (0, Q.useState)(!1);
	return /* @__PURE__ */ (0, $.jsx)("span", {
		"data-tier-mark": "",
		children: e.has_logo && !t ? /* @__PURE__ */ (0, $.jsx)("img", {
			src: ct(e.name, "icon", e.logo_version),
			alt: "",
			width: 28,
			height: 28,
			loading: "lazy",
			decoding: "async",
			onError: () => n(!0)
		}) : st(e.name, 2)
	});
}
var un = (e) => Ke(e).then((t) => (t.has_cover && Ne(e, t), t.has_cover));
function dn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	Mt();
	let [o, s] = (0, Q.useState)(() => gt(location.search));
	(0, Q.useEffect)(() => {
		r !== o.q && (s((e) => ({
			...e,
			q: r,
			page: 1
		})), Z({ page: "" }));
	}, [r, o.q]);
	let c = (e, t) => {
		let n = o[e] === t ? "" : t;
		s((t) => ({
			...t,
			[e]: n,
			page: 1
		})), Z({
			[e]: n,
			page: ""
		});
	}, f = (0, Q.useRef)(null), m = ({ pageIndex: e, pageSize: t }) => {
		let n = e + 1;
		s((e) => ({
			...e,
			page: n,
			size: t
		})), Z({
			page: n > 1 ? String(n) : "",
			size: t === 24 ? "" : String(t)
		}), f.current?.scrollIntoView({ block: "start" });
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
	}, g = (e) => _(e, e === o.sort ? o.dir === "asc" ? "desc" : "asc" : e === "code" ? "asc" : "desc"), _ = (e, t) => {
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
		let e = [...f.current?.querySelectorAll("[data-catalog-tier],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Ft(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let x = we();
	(0, Q.useSyncExternalStore)(x.subscribe, x.version, x.version);
	let S = tt(), w = jt(), T = Oe($e({
		active: !0,
		home: !1,
		portrait: !1
	})), E = X({
		queryKey: _t(o),
		queryFn: ({ signal: e }) => Ye(o, e),
		placeholderData: at,
		retry: !1,
		refetchOnWindowFocus: !1
	}), D = E.data?.metadata_job, O = (0, Q.useRef)(!1);
	O.current = D?.status === "running";
	let ie = ft.getQueryData(y)?.metadata_job, k = X({
		queryKey: y,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: D?.status === "running" || ie?.status === "running",
		queryFn: ({ signal: e }) => Je(e),
		refetchInterval: lt(() => O.current)
	}), A = k.data && k.dataUpdatedAt >= E.dataUpdatedAt ? k.data.metadata_job : D, j = A?.status === "running", se = (0, Q.useRef)(!1);
	(0, Q.useEffect)(() => {
		se.current && !j && E.refetch(), se.current = j;
	}, [j, E]);
	let M = (0, Q.useRef)(""), P = JSON.stringify([
		o.performer,
		o.studio,
		o.tag,
		o.q,
		o.sort,
		o.dir,
		o.seed
	]), F = !E.isPlaceholderData && (E.data?.metadata_unread || 0) > 0 && !j;
	(0, Q.useEffect)(() => {
		F && M.current !== P && (M.current = P, Me("start", o).then(async (e) => {
			await ft.cancelQueries({ queryKey: y }), ft.setQueryData(y, e);
		}).catch(() => {}));
	}, [F, P]);
	let I = Y(), ce = (e) => {
		I.run(String(e.id), (t) => Se({ code: e.code }, t), () => {
			t(J("catalog:javWant.added")), q(), E.refetch();
		});
	}, R = E.data;
	Yt(R?.items || []);
	let z = E.isPending, B = !!(o.performer || o.studio || o.tag || o.q), V = Math.max(1, Math.ceil((R?.total || 0) / o.size));
	return (0, Q.useEffect)(() => {
		!R || E.isPlaceholderData || o.page <= V || (s((e) => ({
			...e,
			page: V
		})), Z({ page: V > 1 ? String(V) : "" }));
	}, [
		R,
		E.isPlaceholderData,
		o.page,
		V
	]), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: f,
		"aria-label": J("catalog:entityHero.subscribeNewReleases"),
		"aria-busy": z || E.isFetching,
		className: "flex min-w-0 scroll-mt-24 flex-col gap-4",
		children: [
			z ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-catalog-tiers": "",
				"aria-busy": "true",
				dangerouslySetInnerHTML: { __html: on }
			}) : null,
			R && (R.facets.performers.length || R.facets.studios.length) ? /* @__PURE__ */ (0, $.jsxs)("div", {
				"data-catalog-tiers": "",
				"data-release-tiers": "",
				children: [R.facets.performers.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "performers",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByActress"),
					children: R.facets.performers.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-performer": "",
						"aria-pressed": o.performer === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: G("performer", e.name, e.id),
							count: e.count
						}),
						onClick: () => c("performer", e.name),
						children: [/* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-ring": "",
							dangerouslySetInnerHTML: { __html: sn(e) }
						}), /* @__PURE__ */ (0, $.jsx)("span", {
							"data-tier-name": "",
							children: G("performer", e.name, e.id)
						})]
					}, e.name))
				}) : null, R.facets.studios.length ? /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-tier": "studios",
					role: "group",
					"aria-label": J("catalog:javReleases.filterByLabel"),
					children: R.facets.studios.map((e) => /* @__PURE__ */ (0, $.jsxs)("button", {
						type: "button",
						"data-tier-studio": "",
						"aria-pressed": o.studio === e.name,
						title: J("catalog:javReleases.facetCount", {
							name: e.name,
							count: e.count
						}),
						onClick: () => c("studio", e.name),
						children: [
							/* @__PURE__ */ (0, $.jsx)(ln, { studio: e }),
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
				busy: z,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsx)("div", {
					"data-catalog-scroll": "",
					children: /* @__PURE__ */ (0, $.jsx)("div", {
						"data-catalog-tags": "",
						dangerouslySetInnerHTML: z ? { __html: nt() } : void 0,
						children: z ? null : R?.facets.tags.map((e) => /* @__PURE__ */ (0, $.jsxs)(ne, {
							"data-catalog-tag": e.name,
							"data-entity-press": "",
							pressed: o.tag === e.name,
							onPress: () => c("tag", e.name),
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
						children: z ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : B ? J("catalog:javReleases.matchedCount", {
							matched: R?.total || 0,
							count: R?.candidate_total || 0
						}) : J("catalog:countLabel.works", { count: R?.total || 0 })
					}),
					B ? /* @__PURE__ */ (0, $.jsx)(re, {
						onPress: h,
						children: J("catalog:shared.clearFilters")
					}) : null,
					/* @__PURE__ */ (0, $.jsxs)("span", {
						"data-entity-sorts": "",
						children: [
							/* @__PURE__ */ (0, $.jsx)(fe, {
								onPress: b,
								busy: o.sort === "random" && E.isFetching
							}),
							w === "cards" ? /* @__PURE__ */ (0, $.jsx)(ue, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: S,
								options: ae,
								onChange: Dt
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(p, {}),
							/* @__PURE__ */ (0, $.jsx)(pe, {
								sorts: L.map(([e, t, n]) => ({
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
			z && w === "cards" ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javReleases.loading"),
				dangerouslySetInnerHTML: { __html: et("discover", S) }
			}) : null,
			E.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				title: J("catalog:javReleases.failed"),
				children: K(E.error)
			}) : null,
			j && A ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(ge, {
					kind: xe("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: A.completed,
						count: A.total
					}),
					value: A.completed,
					total: A.total
				})
			}) : null,
			e ? null : /* @__PURE__ */ (0, $.jsx)(v, {
				scope: J("catalog:javReleases.coverQueueScope"),
				fetchOne: un,
				codes: (R?.items || []).filter((e) => e.cover_state === "queued" && !e.cover_url).map((e) => e.code),
				settled: (e, n) => {
					t(e === n ? J("catalog:javReleases.coversFetched", { count: n }) : J("catalog:javReleases.coversPartial", {
						got: e,
						count: n
					})), E.refetch();
				}
			}),
			!z && !E.error && !R?.items.length ? /* @__PURE__ */ (0, $.jsx)(ee, {
				icon: d,
				title: J(B ? "catalog:javReleases.noMatches" : "catalog:javReleases.emptyTitle"),
				actions: B ? /* @__PURE__ */ (0, $.jsx)(l, {
					size: "small",
					onClick: h,
					children: J("catalog:shared.clearFilters")
				}) : /* @__PURE__ */ (0, $.jsx)(u, {
					size: "small",
					href: "/subscriptions?tab=add",
					children: J("catalog:javReleases.addSubscription")
				}),
				children: J(B ? "catalog:javReleases.clearFiltersHint" : "catalog:javReleases.emptyHint")
			}) : null,
			I.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				children: I.error
			}) : null,
			w === "list" ? z || R?.items.length ? /* @__PURE__ */ (0, $.jsx)(an, {
				items: R?.items || [],
				waiting: z,
				filters: o,
				studios: R?.facets.studios || [],
				javImage: x.value.javImage,
				readOnly: e,
				navigate: i,
				onTag: (e) => c("tag", e || o.tag),
				onSort: _,
				wanting: (e) => I.busy === String(e.id),
				onWant: ce,
				onResource: (e) => n(Qt(e))
			}) : null : /* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: oe,
				style: { "--card-ratio": T },
				children: (R?.items || []).map((t) => /* @__PURE__ */ (0, $.jsx)(tn, {
					item: t,
					layout: S,
					javImage: x.value.javImage,
					readOnly: e,
					navigate: i,
					tag: o.tag,
					onTag: (e) => c("tag", e || o.tag),
					wanting: I.busy === String(t.id),
					onWant: () => ce(t),
					onResource: () => n(Qt(t)),
					badge: o.sort === "taste" ? /* @__PURE__ */ (0, $.jsx)(cn, { value: t.taste_score }) : void 0
				}, t.id))
			}),
			R ? /* @__PURE__ */ (0, $.jsx)(C, {
				label: J("catalog:javTabs.newReleases"),
				total: R.total,
				pagination: {
					pageIndex: o.page - 1,
					pageSize: o.size
				},
				onChange: m,
				unit: J("catalog:catalogList.footerUnit"),
				pageUnit: J("catalog:catalogList.footerPageUnit"),
				pageSizes: le
			}) : null
		]
	});
}
// src/react/jav/jav-page.tsx
var fn = Et("x"), pn = Et("refresh-cw"), mn = {
	releases: J("catalog:javSearch.filterReleases"),
	discover: J("catalog:javSearch.filterRecommended"),
	wants: J("catalog:javSearch.filterWants")
};
function hn({ tab: e, readOnly: t, navigate: n, receipt: r }) {
	let [i, a] = (0, Q.useState)(null), [o, s] = (0, Q.useState)(() => new URLSearchParams(location.search).get("q") || ""), c = (e) => {
		s(e), Z({ q: e });
	};
	return /* @__PURE__ */ (0, $.jsx)(Xt, {
		readOnly: t,
		receipt: r,
		children: /* @__PURE__ */ (0, $.jsxs)("div", {
			className: "flex w-full flex-col gap-6",
			children: [
				/* @__PURE__ */ (0, $.jsx)(A, {
					tab: e,
					navigate: n,
					find: () => a({}),
					search: /* @__PURE__ */ (0, $.jsx)(O, {
						label: mn[e] || J("catalog:javDiscover.filter"),
						value: o,
						onQuery: c
					})
				}),
				e === "releases" ? /* @__PURE__ */ (0, $.jsx)(dn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : e === "discover" ? /* @__PURE__ */ (0, $.jsx)(gn, {
					readOnly: t,
					receipt: r,
					resource: a,
					query: o.trim(),
					navigate: n,
					clearText: () => c("")
				}) : /* @__PURE__ */ (0, $.jsx)(Ut, {
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
function gn({ readOnly: e, receipt: t, resource: n, query: r, navigate: i, clearText: a }) {
	let o = new URLSearchParams(location.search), [s, c] = (0, Q.useState)(() => o.get("scope") === "library" ? "library" : "external"), [d, f] = (0, Q.useState)(() => o.get("tag") || ""), [p, m] = (0, Q.useState)(() => b.some(([e]) => e === o.get("sort")) ? o.get("sort") : "taste"), [h, _] = (0, Q.useState)(() => o.get("dir") === "asc"), v = (e) => {
		c(e), Z({ scope: e === "external" ? "" : e });
	}, x = (e) => {
		f(e), Z({ tag: e });
	}, S = (e) => {
		m(e), Z({ sort: e === "taste" ? "" : e });
	}, C = (e) => {
		_(e), Z({ dir: e ? "asc" : "" });
	}, w = (0, Q.useRef)(null);
	(0, Q.useEffect)(() => {
		let e = [...w.current?.querySelectorAll("[data-catalog-scroll],[data-catalog-tags],[data-filter-row=\"bottom\"]") || []].map((e) => Ft(e, { drag: !0 }));
		return () => e.forEach((e) => e.destroy());
	}, []);
	let E = we();
	(0, Q.useSyncExternalStore)(E.subscribe, E.version, E.version);
	let O = tt(), ie = Oe($e({
		active: !0,
		home: !1,
		portrait: !1
	})), k = h ? "asc" : "desc", A = X({
		queryKey: Be(s, p, k),
		retry: !1,
		refetchOnWindowFocus: !1,
		queryFn: ({ signal: e }) => qe(s, e, {
			sort: p,
			direction: k
		})
	}), se = A.data?.metadata_job, M = (0, Q.useRef)(!1);
	M.current = se?.status === "running";
	let P = X({
		queryKey: y,
		retry: !1,
		refetchOnWindowFocus: !1,
		enabled: s === "external",
		queryFn: ({ signal: e }) => Je(e),
		refetchInterval: lt(() => M.current)
	}), F = P.data && P.dataUpdatedAt >= A.dataUpdatedAt ? P.data.metadata_job : se, I = (e) => e ? `${e.job_id}:${e.status}` : "", ce = (0, Q.useRef)(""), le = (0, Q.useRef)(""), L = P.data?.metadata_job;
	(0, Q.useEffect)(() => {
		let e = I(L), t = le.current.endsWith(":running") && L && L.status !== "running";
		le.current = e, t && e !== ce.current && A.refetch();
	}, [I(L)]);
	let R = Y(), z = Y(), B = async (e, t) => {
		let n = await je(e, {
			sort: p,
			direction: k,
			jobId: F?.job_id
		}, t);
		e !== "start" && await A.refetch({
			cancelRefetch: !0,
			throwOnError: !0
		}), await ft.cancelQueries({ queryKey: y }), ce.current = I(n.metadata_job), ft.setQueryData(y, n);
	}, V = (e) => {
		z.run(e, (t) => B(e === "stop" ? "cancel" : "refresh", t), () => {});
	}, de = (0, Q.useRef)(!1), fe = s === "external" && F?.status !== "running" && (A.data?.items || []).some((e) => e.metadata_state === "pending" || e.metadata_state === "stale");
	(0, Q.useEffect)(() => {
		fe && !de.current && (de.current = !0, B("start").catch(() => {}));
	}, [fe]);
	let me = A.data?.items || [], he = [...new Set(me.flatMap((e) => e.tags || []))], H = me.filter((e) => (!d || e.tags?.includes(d)) && (!r || [
		e.code,
		e.title,
		e.performers,
		e.studio,
		...e.tags || [],
		...(e.performer_refs || []).map((e) => e.name)
	].join(" ").toLocaleLowerCase().includes(r.toLocaleLowerCase()))), U = A.isPending;
	return Yt(H), /* @__PURE__ */ (0, $.jsxs)("section", {
		ref: w,
		"aria-label": J("catalog:shared.recommendedForYou"),
		"aria-busy": U,
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
				busy: U,
				topClassName: "gap-1.5 overflow-visible",
				bottomClassName: "min-h-12",
				top: /* @__PURE__ */ (0, $.jsxs)("div", {
					"data-catalog-scroll": "",
					children: [/* @__PURE__ */ (0, $.jsxs)("div", {
						"data-catalog-views": "",
						children: [[["external", J("catalog:javDiscover.external")], ["library", J("catalog:javDiscover.library")]].map(([e, t]) => /* @__PURE__ */ (0, $.jsx)(ne, {
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
						dangerouslySetInnerHTML: U ? { __html: nt() } : void 0,
						children: U ? null : he.map((e) => /* @__PURE__ */ (0, $.jsxs)(ne, {
							"data-catalog-tag": e,
							"data-entity-press": "",
							pressed: d === e,
							onPress: () => x(d === e ? "" : e),
							children: [e, /* @__PURE__ */ (0, $.jsx)("span", {
								"data-count-badge": "",
								children: me.filter((t) => t.tags?.includes(e)).length
							})]
						}, e))
					})]
				}),
				bottom: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [
					/* @__PURE__ */ (0, $.jsx)("span", {
						"data-catalog-readout": "",
						children: U ? /* @__PURE__ */ (0, $.jsx)("span", {
							"data-skeleton": "count",
							"aria-hidden": !0,
							className: "relative inline-block h-3.5 w-37.5 rounded-md align-middle skeleton-sheen"
						}) : J("catalog:countLabel.works", { count: H.length })
					}),
					/* @__PURE__ */ (0, $.jsx)(j, { currentHref: () => location.pathname + location.search }),
					r || d ? /* @__PURE__ */ (0, $.jsx)(re, {
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
								label: F?.status === "running" ? J("catalog:javDiscover.stopUpdating") : J("catalog:javDiscover.updateMetadata"),
								disabled: U,
								"data-skeleton-action": U ? "" : void 0,
								busy: !!z.busy,
								icon: F?.status === "running" ? fn : pn,
								onPress: () => V(F?.status === "running" ? "stop" : "update")
							}) : null,
							/* @__PURE__ */ (0, $.jsx)(ue, {
								label: J("catalog:entityFilter.javCardLayout"),
								value: O,
								options: ae,
								onChange: Dt
							}),
							/* @__PURE__ */ (0, $.jsx)(pe, {
								sorts: b.map(([e, t, n]) => ({
									key: e,
									label: t,
									ariaLabel: n,
									pressed: e === p,
									dir: k
								})),
								onSort: (e) => {
									e === p ? C(!h) : (S(e), C(e === "code"));
								}
							})
						]
					})
				] })
			}),
			U ? /* @__PURE__ */ (0, $.jsx)("div", {
				role: "status",
				"aria-label": J("catalog:javDiscover.loading"),
				dangerouslySetInnerHTML: { __html: et("discover", O) }
			}) : null,
			A.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				title: J("catalog:javDiscover.failed"),
				children: K(A.error)
			}) : null,
			s === "external" && F?.status === "running" ? /* @__PURE__ */ (0, $.jsx)("div", {
				"data-jav-metadata": "",
				className: "min-w-0",
				children: /* @__PURE__ */ (0, $.jsx)(ge, {
					kind: xe("jav-discovery-metadata"),
					label: J("catalog:javMetadata.loadingProgress", {
						completed: F.completed,
						count: F.total
					}),
					value: F.completed,
					total: F.total
				})
			}) : null,
			F && F.status !== "running" && (F.status !== "complete" || F.failed > 0) ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "neutral",
				action: /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "secondary",
					...W(z.busy === "retry"),
					"aria-label": J("catalog:javMetadata.retry"),
					onClick: () => V("retry"),
					children: J("catalog:shared.retryNow")
				}),
				children: rt(F) || J("catalog:javMetadata.progress", {
					completed: F.completed,
					count: F.total
				})
			}) : null,
			z.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				children: z.error
			}) : null,
			!U && !A.error && !H.length ? /* @__PURE__ */ (0, $.jsx)(ee, {
				icon: T,
				title: J(r || d ? "catalog:javDiscover.noMatches" : "catalog:javDiscover.noTasteMatches"),
				actions: /* @__PURE__ */ (0, $.jsxs)($.Fragment, { children: [/* @__PURE__ */ (0, $.jsx)(u, {
					size: "small",
					href: "/taste",
					variant: "secondary",
					children: J("catalog:javDiscover.viewTaste")
				}), r || d ? /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "primary",
					size: "small",
					onClick: () => {
						a(), f(""), Z({
							q: "",
							tag: ""
						});
					},
					children: J("catalog:shared.clearFilters")
				}) : s === "library" ? /* @__PURE__ */ (0, $.jsx)(u, {
					variant: "primary",
					size: "small",
					href: "/",
					children: J("catalog:entityPage.browseCollection")
				}) : /* @__PURE__ */ (0, $.jsx)(l, {
					variant: "primary",
					size: "small",
					onClick: () => n({}),
					children: J("catalog:javDiscover.findVideos")
				})] }),
				children: J(r || d ? "catalog:javDiscover.clearFiltersHint" : s === "library" ? "catalog:javDiscover.libraryEmptyHint" : "catalog:javDiscover.externalEmptyHint")
			}) : null,
			R.error ? /* @__PURE__ */ (0, $.jsx)(N, {
				tone: "error",
				children: R.error
			}) : null,
			/* @__PURE__ */ (0, $.jsx)("div", {
				"data-media-grid": "",
				className: oe,
				style: { "--card-ratio": ie },
				children: H.map((r) => {
					let a = pt(r.taste_score ?? r.score), o = [
						a.label,
						J("catalog:javScore.taste", { score: Ve(r.taste_score ?? r.score) }),
						A.data?.ranking_method === "mmr" && r.ranking_score != null ? J("catalog:javScore.ranking", { score: Ve(r.ranking_score) }) : "",
						r.source_score == null ? "" : J("catalog:javScore.siteRating", { rating: r.source_score.toFixed(1) }),
						...Tt(r.reasons, r.reason_codes, r.reason_params)
					].filter(Boolean).join(" · ");
					return /* @__PURE__ */ (0, $.jsx)(tn, {
						item: r,
						layout: O,
						javImage: E.value.javImage,
						readOnly: e,
						navigate: i,
						tag: d,
						onTag: x,
						wanting: R.busy === String(r.id),
						onWant: () => {
							R.run(String(r.id), (e) => Se({ code: r.code }, e), () => {
								t(J("catalog:javWant.added")), q(), A.refetch();
							});
						},
						onResource: () => n(Qt(r)),
						badge: /* @__PURE__ */ (0, $.jsx)("button", {
							"data-jav-taste-score": "",
							type: "button",
							title: o,
							"aria-label": J("catalog:javScore.badgeLabel", {
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
export { hn as JavPage };

//# debugId=0826d36e-ed92-4f78-972c-5585b6718cdf