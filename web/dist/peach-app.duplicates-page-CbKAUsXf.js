(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "9662d6f4-54a0-4074-9185-c16d99763dbb", e._sentryDebugIdIdentifier = "sentry-dbid-9662d6f4-54a0-4074-9185-c16d99763dbb");
	} catch {}
})();
import { Button as e, Checkbox as t, CollectionSummary as n, DUPLICATES_KEY as r, EmptyState as i, FilterGlass as a, GlassPill as o, KEEP_LABELS as s, KEPT_DUPLICATES_KEY as ee, LOC as c, MEDIA_SOURCES_KEY as te, MEDIA_SOURCE_ICONS as l, Note as u, SelectionDock as ne, SourceLabel as d, SourceMark as f, TRASH_KEY as p, __toESM as m, batchOperate as h, bulkCloudPreferences as re, busyProps as ie, cardClass as ae, cloudLocations as oe, confirmModal as se, distinctName as g, duplicateVictims as _, enterPageSelection as v, errorMessage as y, exitPageSelection as ce, fetchDuplicates as le, fetchKeptDuplicates as ue, fetchMediaSources as de, fmtDur as b, fmtSize as x, groupKey as S, keepGroup as C, keepGroups as w, mixedCloudPreferences as fe, queryClient as T, require_jsx_runtime as E, require_react as D, runBulkAction as pe, sharedNamePrefix as me, spriteGlyph as O, t as k, useMutation as A, usePageSelection as he, useQuery as j, victimBytes as M } from "./peach-app.js";
// src/react/duplicates/duplicates-page.tsx
var N = /* @__PURE__ */ m(D(), 1), P = E(), F = O("play"), I = O("file-stack"), ge = ae({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), L = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", R = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", z = "font-mono text-caption-1-regular leading-5 text-text-secondary", B = () => {
	T.invalidateQueries({ queryKey: r }), T.invalidateQueries({
		queryKey: p,
		exact: !0
	});
}, V = (e) => e.reduce((e, t) => e + t.files.length, 0);
function H(e, t) {
	let n = [];
	return {
		key: `keep-${e}`,
		label: t,
		reversal: "undo",
		danger: e === "all",
		confirm: (t) => {
			let n = _(t, e);
			return {
				title: k("cleanup:duplicates.moveToTrash"),
				danger: e === "all",
				body: k("cleanup:duplicates.trashBody", {
					count: n.length,
					groups: t.length,
					keep: s[e] ?? s.largest,
					size: x(M(t, n))
				})
			};
		},
		run: async (t) => (n = _(t, e), await h(n, "dispose"), B(), async () => {
			await h(n, "restore"), B();
		}),
		receipt: () => k("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var U = (e) => ({
	key: "keep-all",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: k("cleanup:duplicates.markKeepAll"),
		body: k("cleanup:duplicates.keepAllBody", {
			count: e.length,
			files: V(e)
		}),
		recovery: k("cleanup:duplicates.keepAllRecovery")
	}),
	run: async (e) => (await w(e, !0), B(), async () => {
		await w(e, !1), B();
	}),
	receipt: (e) => k("cleanup:duplicates.keptGroups", { count: e.length })
}), W = (e) => ({
	key: "unkeep",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: k("cleanup:duplicates.unkeep"),
		body: k("cleanup:duplicates.unkeepBody", { count: e.length })
	}),
	run: async (e) => (await w(e, !1), B(), async () => {
		await w(e, !0), B();
	}),
	receipt: (e) => k("cleanup:duplicates.unkeptGroups", { count: e.length })
});
function _e(e) {
	return e.identical ? /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-(--keep)`,
		children: k("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? k("cleanup:duplicates.sameCodeShorter") : k("cleanup:duplicates.byDuration")
	});
}
function ve({ file: e, prefix: t, openItem: n }) {
	let r = () => n(e.id), i = c[e.location] || e.location || e.drive;
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		children: [
			/* @__PURE__ */ (0, P.jsxs)("button", {
				type: "button",
				onClick: r,
				"aria-label": k("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, P.jsx)(F, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, P.jsx)("img", {
					src: `/thumb?id=${e.id}&c=4`,
					alt: "",
					loading: "lazy",
					onError: (e) => e.currentTarget.remove(),
					className: "absolute inset-0 size-full object-contain"
				})]
			}),
			/* @__PURE__ */ (0, P.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [/* @__PURE__ */ (0, P.jsx)("button", {
					type: "button",
					onClick: r,
					title: e.name,
					"data-middle-truncate": !0,
					"data-middle-truncate-within": !0,
					className: "min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary",
					children: g(e.name, t)
				}), e.is_largest || e.is_longest || e.is_new ? /* @__PURE__ */ (0, P.jsxs)("span", {
					className: "flex flex-none gap-1",
					children: [
						e.is_new ? /* @__PURE__ */ (0, P.jsx)("i", {
							className: `${L} not-italic bg-background-primary-hover text-text-primary`,
							children: k("cleanup:duplicates.newCopy")
						}) : null,
						e.is_largest ? /* @__PURE__ */ (0, P.jsx)("i", {
							className: `${L} not-italic bg-background-primary-hover text-text-secondary`,
							children: k("cleanup:duplicates.largest")
						}) : null,
						e.is_longest ? /* @__PURE__ */ (0, P.jsx)("i", {
							className: `${L} not-italic bg-(--keep)/22 text-(--keep)`,
							children: k("cleanup:duplicates.longest")
						}) : null
					]
				}) : null]
			}),
			/* @__PURE__ */ (0, P.jsxs)("span", {
				className: `${z} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, P.jsx)(f, { mark: l[e.location] || "database" }), /* @__PURE__ */ (0, P.jsx)("span", {
					title: i,
					className: "min-w-0 truncate",
					children: i
				})]
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: z,
				children: x(e.size || 0)
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: z,
				children: b(e.duration)
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: `${z} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: e.path ?? ""
			})
		]
	});
}
function G({ openItem: l, toast: f, failure: p }) {
	let [m, ae] = (0, N.useState)("pending"), g = j({
		queryKey: r,
		queryFn: ({ signal: e }) => le(e)
	}), b = j({
		queryKey: ee,
		queryFn: ({ signal: e }) => ue(e),
		enabled: m === "kept"
	}), w = j({
		queryKey: te,
		queryFn: ({ signal: e }) => de(e)
	}), [T, E] = (0, N.useState)(""), [D, O] = (0, N.useState)(/* @__PURE__ */ new Set());
	he(() => O(/* @__PURE__ */ new Set()));
	let F = {
		receipt: f,
		failure: (e) => p(k("cleanup:duplicates.bulkFailed"), e)
	}, L = A({
		mutationFn: (e) => h(e, "dispose"),
		onSuccess: (e, t) => {
			B(), f(k("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await h(t, "restore");
				} catch (e) {
					p(k("cleanup:duplicates.undoTrash"), e);
				} finally {
					B();
				}
			} });
		},
		onSettled: () => E("")
	}), z = A({
		mutationFn: ({ group: e, on: t }) => C(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			B(), f(k(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await C(t.files.map((e) => e.id), !n);
				} catch (e) {
					p(k("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					B();
				}
			} });
		},
		onError: (e) => p(k("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => E("")
	}), V = m === "kept", G = V ? b.data : g.data, K = V ? b.error : g.error;
	if (!G) return V && b.isPending ? /* @__PURE__ */ (0, P.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, P.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, P.jsx)(u, {
			tone: "error",
			title: k("cleanup:duplicates.loadFailed"),
			children: K ? y(K) : k("cleanup:duplicates.listUnavailable")
		})
	});
	let q = G.groups ?? [], ye = Number(g.data?.kept ?? G.kept ?? 0), J = oe(w.data), Y = q.filter((e) => D.has(S(e))), be = q.length > 0 && Y.length === q.length, xe = (e) => {
		O(/* @__PURE__ */ new Set()), ae(e);
	}, Se = (e, t) => {
		t && v(), O((n) => {
			let r = new Set(n);
			return t ? r.add(S(e)) : r.delete(S(e)), r;
		});
	}, X = (e, t) => {
		T || (E(t), pe(e, q, F).catch(F.failure).finally(() => E("")));
	}, Z = ({ groups: e, keep: t, key: n }) => {
		if (L.isPending) return;
		let r = _(e, t);
		r.length && se({
			title: k("cleanup:duplicates.moveToTrash"),
			body: k("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: s[t] ?? s.largest,
				size: x(M(e, r))
			}) + k("shell:bulkAction.canUndo"),
			confirmLabel: k("cleanup:duplicates.moveToTrash"),
			onConfirm: () => (E(n), L.mutateAsync(r))
		});
	}, Q = (e) => ie(T === e && (L.isPending || z.isPending)), Ce = (e, t, n) => {
		z.isPending || L.isPending || (E(t), z.mutate({
			group: e,
			on: n
		}));
	}, $ = /* @__PURE__ */ (0, P.jsx)(t, {
		size: "sm",
		isSelected: be,
		isIndeterminate: Y.length > 0 && !be,
		onChange: (e) => {
			e && v(), O(e ? new Set(q.map(S)) : /* @__PURE__ */ new Set());
		},
		children: k("cleanup:duplicates.selectPage")
	}), we = V ? [W(k("cleanup:duplicates.unkeep"))] : [
		H("largest", k("cleanup:duplicates.keepLargest")),
		H("longest", k("cleanup:duplicates.keepLongest")),
		...re(Y, J).map((e) => H(e, k("cleanup:duplicates.keepStorage", { storage: c[e] || e }))),
		U(k("cleanup:duplicates.keepAll")),
		H("all", k("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, P.jsx)(n, {
				label: k(V ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
				figure: k("cleanup:duplicates.groupCount", { count: Number(G.total || 0) }),
				detail: V ? k("cleanup:duplicates.keptDetail", { count: Number(G.files || 0) }) : k("cleanup:duplicates.summaryDetail", {
					count: Number(G.files || 0),
					size: x(G.reclaimable)
				})
			}),
			V ? /* @__PURE__ */ (0, P.jsxs)(a, {
				title: k("cleanup:duplicates.keptLabel"),
				children: [
					q.length ? $ : null,
					q.length ? /* @__PURE__ */ (0, P.jsx)(o, {
						busy: T === "all:unkeep",
						onPress: () => X(W(k("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: k("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(o, {
						onPress: () => xe("pending"),
						children: k("cleanup:duplicates.backToPending")
					})
				]
			}) : /* @__PURE__ */ (0, P.jsxs)(a, {
				title: k("cleanup:duplicates.bulkKeep"),
				children: [
					q.length ? /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
						$,
						/* @__PURE__ */ (0, P.jsx)(o, {
							busy: T === "all:largest",
							onPress: () => X(H("largest", ""), "all:largest"),
							children: k("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, P.jsx)(o, {
							busy: T === "all:longest",
							onPress: () => X(H("longest", ""), "all:longest"),
							children: k("cleanup:duplicates.allKeepLongest")
						}),
						re(q, J).map((e) => /* @__PURE__ */ (0, P.jsx)(o, {
							busy: T === `all:${e}`,
							onPress: () => X(H(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, P.jsx)(d, {
								source: e,
								label: k("cleanup:duplicates.allPreferStorage", { storage: c[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, P.jsx)(o, {
							busy: T === "all:keep",
							onPress: () => X(U(""), "all:keep"),
							children: k("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(o, {
						onPress: () => xe("kept"),
						children: k("cleanup:duplicates.viewKept", { count: ye })
					})
				]
			}),
			/* @__PURE__ */ (0, P.jsx)(ne, {
				label: k("cleanup:duplicates.dockLabel"),
				visible: Y.length > 0,
				count: k("cleanup:duplicates.selectedGroups", { count: Y.length }),
				actions: we.map((e) => ({
					action: e,
					items: Y,
					host: F,
					done: () => O(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, P.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: ce,
					children: k("cleanup:duplicates.clearSelection")
				})
			}),
			L.isError ? /* @__PURE__ */ (0, P.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, P.jsx)(u, {
					tone: "error",
					title: k("cleanup:duplicates.trashFailed"),
					children: y(L.error)
				})
			}) : null,
			q.length ? q.map((n, r) => {
				let i = [n], a = me(n.files.map((e) => e.name)), o = (e) => `${r}:${e}`;
				return /* @__PURE__ */ (0, P.jsxs)("section", {
					"aria-label": n.code,
					className: ge,
					"data-board-selected": D.has(S(n)) || void 0,
					children: [/* @__PURE__ */ (0, P.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, P.jsx)(t, {
								slot: null,
								"aria-label": k("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: D.has(S(n)),
								onChange: (e) => Se(n, e)
							}),
							/* @__PURE__ */ (0, P.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: n.code
							}),
							/* @__PURE__ */ (0, P.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: k("cleanup:duplicates.groupDetail", {
									count: Number(n.count || 0),
									size: x(n.reclaimable)
								})
							}),
							_e(n),
							n.new_files ? /* @__PURE__ */ (0, P.jsx)("span", {
								className: `${R} text-text-primary`,
								children: k("cleanup:duplicates.newFiles", { count: n.new_files })
							}) : null,
							n.cross_drive ? /* @__PURE__ */ (0, P.jsx)("span", {
								className: `${R} text-text-secondary`,
								children: k("cleanup:duplicates.crossDrive", { drives: n.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, P.jsx)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: V ? /* @__PURE__ */ (0, P.jsx)(e, {
									variant: "secondary",
									size: "small",
									...Q(o("unkeep")),
									onClick: () => Ce(n, o("unkeep"), !1),
									children: k("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o("largest")),
										onClick: () => Z({
											groups: i,
											keep: "largest",
											key: o("largest")
										}),
										children: k("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o("longest")),
										onClick: () => Z({
											groups: i,
											keep: "longest",
											key: o("longest")
										}),
										children: k("cleanup:duplicates.keepLongest")
									}),
									fe(n.files, J).map((t) => /* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o(t)),
										onClick: () => Z({
											groups: i,
											keep: t,
											key: o(t)
										}),
										children: /* @__PURE__ */ (0, P.jsx)(d, {
											source: t,
											label: k("cleanup:duplicates.keepStorage", { storage: c[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o("keep")),
										onClick: () => Ce(n, o("keep"), !0),
										children: k("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "danger",
										size: "small",
										...Q(o("all")),
										onClick: () => Z({
											groups: i,
											keep: "all",
											key: o("all")
										}),
										children: k("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, P.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, P.jsx)(ve, {
						file: e,
						prefix: a,
						openItem: l
					}, e.id)) })]
				}, S(n));
			}) : V ? /* @__PURE__ */ (0, P.jsx)(i, {
				icon: I,
				title: k("cleanup:duplicates.keptEmptyTitle"),
				children: k("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, P.jsx)(i, {
				icon: I,
				title: k("cleanup:duplicates.emptyTitle"),
				children: k("cleanup:duplicates.emptyBody")
			}),
			q.length > 0 && G.total > q.length ? /* @__PURE__ */ (0, P.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: k("cleanup:duplicates.topGroups", {
					shown: q.length.toLocaleString(),
					count: Number(G.total)
				})
			}) : null
		]
	});
}
export { G as DuplicatesPage };

//# debugId=9662d6f4-54a0-4074-9185-c16d99763dbb