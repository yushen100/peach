(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "64841e21-1412-4e77-a1d5-d2d762beb7b9", e._sentryDebugIdIdentifier = "sentry-dbid-64841e21-1412-4e77-a1d5-d2d762beb7b9");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $542a13ca2fa5b484$export$5b6b19405a83ff9d as t, Button as n, EmptyFocusButton as r, EmptyState as i, Input as a, MENU_ITEM as o, MENU_ITEM_INTERACTIVE as s, MENU_POPOVER_SURFACE as c, MenuDialog as l, MixCard as u, ModalFrame as d, ObjectOrderDialog as f, PLAYLISTS_KEY as p, RetryNote as m, __toESM as h, busyProps as g, confirmModal as _, createPlaylist as v, cx as y, deletePlaylist as b, errorMessage as x, fetchPlaylist as S, fetchPlaylists as C, keepPlaylist as w, posterUrl as T, recreatePlaylist as E, refreshPlaylists as D, renamePlaylist as O, reorderPlaylist as k, require_jsx_runtime as A, require_react as j, resumeAssetId as M, spriteGlyph as N, t as P, useMutation as F, useQuery as I } from "./peach-app.js";
// src/react/playlists/playlists-page.tsx
var L = /* @__PURE__ */ h(j(), 1), R = A(), z = N("ellipsis"), B = N("pencil"), V = N("trash"), H = N("playlist"), U = y(o, s, "text-body-2-medium"), W = P("catalog:playlistsPage.nameRequired"), G = (e) => async () => {
	try {
		await e();
	} finally {
		D();
	}
};
function K({ toast: e }) {
	let [t, r] = (0, L.useState)(""), [i, o] = (0, L.useState)(""), s = F({
		mutationFn: (e) => v(e),
		onSuccess: (t) => {
			r(""), o(""), D(), e(P("catalog:playlistsPage.created"), { undo: G(() => b(t.playlist.id)) });
		},
		onError: (e) => o(x(e) || P("catalog:playlistsPage.createFailed"))
	});
	return /* @__PURE__ */ (0, R.jsxs)("form", {
		"data-playlist-create": "",
		"aria-label": P("catalog:playlistsPage.create"),
		onSubmit: (e) => {
			e.preventDefault(), s.isPending || (t.trim() ? s.mutate(t) : o(W));
		},
		className: "flex flex-wrap items-end gap-2",
		children: [/* @__PURE__ */ (0, R.jsx)("div", {
			className: "min-w-50 max-w-80 flex-1 basis-50 max-board-narrow:min-w-0 max-board-narrow:max-w-none",
			children: /* @__PURE__ */ (0, R.jsx)(a, {
				label: P("catalog:playlistsPage.newPlaylistLabel"),
				placeholder: P("catalog:playlistsPage.enterName"),
				maxLength: 80,
				value: t,
				onChange: (e) => {
					r(e), o("");
				},
				validationBehavior: "aria",
				isInvalid: !!i,
				hint: i || void 0
			})
		}), /* @__PURE__ */ (0, R.jsx)(n, {
			type: "submit",
			...g(s.isPending),
			children: P("catalog:playlistsPage.createButton")
		})]
	});
}
function q({ target: t, close: r, toast: i }) {
	let [o, s] = (0, L.useState)(""), [c, l] = (0, L.useState)(""), u = (0, L.useRef)(null);
	(0, L.useEffect)(() => {
		if (!t) return;
		s(t.name), l("");
		let e = requestAnimationFrame(() => {
			u.current?.focus(), u.current?.select();
		});
		return () => cancelAnimationFrame(e);
	}, [t]);
	let f = F({
		mutationFn: ({ row: e, value: t }) => O(e.id, t),
		onSuccess: (e, { row: t }) => {
			r(), D(), i(P("catalog:playlistsPage.renamed"), { undo: G(() => O(t.id, t.name)) });
		},
		onError: (e) => l(x(e))
	});
	return /* @__PURE__ */ (0, R.jsx)(d, {
		isOpen: !!t,
		onOpenChange: (e) => {
			e || r();
		},
		width: "form",
		children: /* @__PURE__ */ (0, R.jsxs)("form", {
			"data-playlist-rename": "",
			onSubmit: (e) => {
				if (e.preventDefault(), !t || f.isPending) return;
				let n = o.trim();
				n ? f.mutate({
					row: t,
					value: n
				}) : l(W);
			},
			className: "flex min-h-0 flex-col",
			children: [/* @__PURE__ */ (0, R.jsxs)("div", {
				className: "flex flex-col gap-4 p-5",
				children: [/* @__PURE__ */ (0, R.jsx)(e, {
					slot: "title",
					className: "text-title-2-semibold text-text-primary",
					children: P("catalog:playlistsPage.editName")
				}), /* @__PURE__ */ (0, R.jsx)(a, {
					ref: u,
					label: P("catalog:catalogList.sortName"),
					placeholder: P("catalog:playlistsPage.enterName"),
					maxLength: 80,
					value: o,
					onChange: (e) => {
						s(e), l("");
					},
					validationBehavior: "aria",
					isInvalid: !!c,
					hint: c || void 0
				})]
			}), /* @__PURE__ */ (0, R.jsxs)("div", {
				className: "flex justify-between gap-4 p-3",
				children: [/* @__PURE__ */ (0, R.jsx)(n, {
					variant: "secondary",
					onClick: r,
					children: P("catalog:shared.cancel")
				}), /* @__PURE__ */ (0, R.jsx)(n, {
					type: "submit",
					...g(f.isPending),
					children: P("catalog:playlistsPage.saveName")
				})]
			})]
		})
	});
}
function J({ name: e, onRename: n, onDelete: r, onSort: i }) {
	let a = (0, L.useRef)(null), [o, s] = (0, L.useState)(!1), u = (e) => {
		s(!1), e();
	};
	return /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [/* @__PURE__ */ (0, R.jsx)("button", {
		ref: a,
		type: "button",
		title: P("catalog:playlistsPage.moreActions"),
		"aria-label": P("catalog:playlistsPage.menuLabel", { name: e }),
		"aria-haspopup": "dialog",
		"aria-expanded": o,
		"data-playlist-menu": "",
		onClick: () => s(!0),
		className: "flex size-7.5 flex-none cursor-pointer items-center justify-center rounded-2lg text-foreground-icon-secondary outline-none transition-colors hover:bg-background-primary-hover hover:text-foreground-icon-primary aria-expanded:bg-background-primary-hover aria-expanded:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
		children: /* @__PURE__ */ (0, R.jsx)(z, {
			"aria-hidden": !0,
			className: "size-4.5"
		})
	}), /* @__PURE__ */ (0, R.jsx)(t, {
		triggerRef: a,
		isOpen: o,
		onOpenChange: s,
		placement: "bottom end",
		offset: 4,
		className: c,
		children: /* @__PURE__ */ (0, R.jsxs)(l, {
			"aria-label": P("catalog:playlistsPage.menuLabel", { name: e }),
			className: "flex w-37.5 flex-col gap-0.5 outline-none",
			children: [
				/* @__PURE__ */ (0, R.jsxs)("button", {
					type: "button",
					className: U,
					onClick: () => u(n),
					children: [/* @__PURE__ */ (0, R.jsx)(B, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					}), P("catalog:playlistsPage.editName")]
				}),
				/* @__PURE__ */ (0, R.jsxs)("button", {
					type: "button",
					className: U,
					onClick: () => u(i),
					children: [/* @__PURE__ */ (0, R.jsx)(H, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					}), P("catalog:playlistOrder.reorder")]
				}),
				/* @__PURE__ */ (0, R.jsxs)("button", {
					type: "button",
					className: U,
					onClick: () => u(r),
					children: [/* @__PURE__ */ (0, R.jsx)(V, {
						"aria-hidden": !0,
						className: "size-(--icon-inline) shrink-0"
					}), P("catalog:playlistsPage.delete")]
				})
			]
		})
	})] });
}
function Y({ openPlaylist: e, openEntity: t, canFlip: n, toast: a, revision: o }) {
	let s = I({
		queryKey: p,
		queryFn: ({ signal: e }) => C(e)
	}), [c, l] = (0, L.useState)(null), [d, f] = (0, L.useState)(null), h = (0, L.useRef)(o);
	(0, L.useEffect)(() => {
		h.current !== o && (h.current = o, D());
	}, [o]);
	let g = s.data, v = g?.items ?? [], y = (e) => {
		_({
			title: P("catalog:playlistsPage.delete"),
			body: P("catalog:playlistsPage.deleteConfirmBody"),
			confirmLabel: P("catalog:playlistsPage.delete"),
			danger: !0,
			holdToConfirm: !0,
			onConfirm: async () => {
				let t = await w(e.id);
				await b(e.id), D(), a(P("catalog:playlistsPage.deleted"), t ? { undo: G(() => E(t)) } : void 0);
			}
		});
	};
	return /* @__PURE__ */ (0, R.jsxs)("div", {
		className: "w-full pt-1 pb-10.5",
		children: [
			/* @__PURE__ */ (0, R.jsxs)("header", {
				className: "mb-4 flex items-start justify-between gap-4.5 max-board-narrow:flex-col max-board-narrow:items-stretch",
				children: [/* @__PURE__ */ (0, R.jsxs)("div", { children: [/* @__PURE__ */ (0, R.jsx)("h2", {
					className: "mb-1 text-display-4-medium! text-text-primary",
					children: P("catalog:shared.playlists")
				}), /* @__PURE__ */ (0, R.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: P("catalog:playlistsPage.description")
				})] }), /* @__PURE__ */ (0, R.jsx)(K, { toast: a })]
			}),
			/* @__PURE__ */ (0, R.jsx)("div", {
				className: "mx-auto w-full max-w-board",
				children: g ? v.length ? /* @__PURE__ */ (0, R.jsx)("div", {
					"data-playlist-grid": "",
					className: "card-grid-cover gap-4.5",
					children: v.map((r) => {
						let i = M(r), a = r.name.trim() || P("catalog:playlistsPage.untitled"), o = () => l(r), s = () => f(r), c = () => y(r), d = [
							{
								id: "rename",
								label: P("catalog:playlistsPage.editName"),
								icon: B,
								run: o
							},
							{
								id: "sort",
								label: P("catalog:playlistOrder.reorder"),
								icon: H,
								run: s
							},
							{
								id: "delete",
								label: P("catalog:playlistsPage.delete"),
								icon: V,
								danger: !0,
								run: c
							}
						];
						return i && d.unshift({
							id: "open",
							label: P("catalog:mediaActions.open"),
							icon: N("play"),
							run: () => e(r.id, i)
						}), /* @__PURE__ */ (0, R.jsx)(u, {
							"data-playlist-card": String(r.id),
							name: a,
							caption: r.source_kind === "mix" ? P("catalog:playlistsPage.savedFromMix") : P("catalog:playlistsPage.manual"),
							count: r.item_count,
							poster: r.preview_asset_id ? T(r.preview_asset_id) : null,
							flipImages: async () => (r.preview_ids || []).map(T),
							canFlip: n,
							faces: r.faces || [],
							onOpenEntity: t,
							...i ? { onOpen: () => e(r.id, i) } : {},
							openLabel: P("catalog:playlistsPage.open", { name: a }),
							contextOperations: d,
							menu: /* @__PURE__ */ (0, R.jsx)(J, {
								name: a,
								onRename: o,
								onDelete: c,
								onSort: s
							})
						}, r.id);
					})
				}) : /* @__PURE__ */ (0, R.jsx)(i, {
					icon: H,
					title: P("catalog:playlistsPage.emptyTitle"),
					actions: /* @__PURE__ */ (0, R.jsx)(r, {
						target: "[data-playlist-create] input",
						children: P("catalog:playlistsPage.create")
					}),
					children: P("catalog:playlistsPage.emptyHint")
				}) : s.isError ? /* @__PURE__ */ (0, R.jsx)(m, {
					message: x(s.error) || P("catalog:playlistsPage.loadFailed"),
					onRetry: () => void s.refetch()
				}) : null
			}),
			/* @__PURE__ */ (0, R.jsx)(q, {
				target: c,
				close: () => l(null),
				toast: a
			}),
			d ? /* @__PURE__ */ (0, R.jsx)(X, {
				row: d,
				close: () => f(null),
				toast: a
			}, d.id) : null
		]
	});
}
function X({ row: e, close: t, toast: r }) {
	let i = I({
		queryKey: ["playlist-order", e.id],
		queryFn: ({ signal: t }) => S(e.id, t),
		staleTime: 0,
		refetchOnWindowFocus: !1,
		refetchOnReconnect: !1
	}), a = i.data;
	return !a || i.isFetching ? /* @__PURE__ */ (0, R.jsx)(d, {
		isOpen: !0,
		onOpenChange: (e) => {
			e || t();
		},
		width: "form",
		label: P("catalog:playlistOrder.reorder"),
		children: /* @__PURE__ */ (0, R.jsxs)("div", {
			className: "p-5",
			children: [i.isError ? /* @__PURE__ */ (0, R.jsx)(m, {
				message: x(i.error),
				onRetry: () => void i.refetch()
			}) : /* @__PURE__ */ (0, R.jsx)("p", {
				role: "status",
				children: P("catalog:playlistOrder.loading")
			}), /* @__PURE__ */ (0, R.jsx)(n, {
				variant: "secondary",
				onClick: t,
				children: P("catalog:shared.cancel")
			})]
		})
	}) : /* @__PURE__ */ (0, R.jsx)(f, {
		title: P("catalog:playlistOrder.dialogTitle", { name: e.name }),
		close: t,
		items: a.items.map((e) => ({
			id: String(e.id),
			name: e.title || e.name || P("catalog:playlistOrder.fallbackName", { id: e.id })
		})),
		save: async (t) => {
			await k(e.id, t.map(Number)), D(), r(P("catalog:playlistOrder.saved"), { undo: G(() => k(e.id, a.items.map((e) => e.id))) });
		}
	});
}
export { Y as PlaylistsPage };

//# debugId=64841e21-1412-4e77-a1d5-d2d762beb7b9