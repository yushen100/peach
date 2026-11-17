(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "0a1a2161-9577-42b8-8445-8e3f97722d0c", e._sentryDebugIdIdentifier = "sentry-dbid-0a1a2161-9577-42b8-8445-8e3f97722d0c");
	} catch {}
})();
import { Button as e, Checkbox as t, DUPLICATES_KEY as n, EmptyState as r, FilterActionButton as i, FilterGlassRows as a, KEEP_LABELS as o, KEPT_DUPLICATES_KEY as s, LOC as c, MEDIA_SOURCES_KEY as l, MEDIA_SOURCE_ICONS as u, Note as ee, SelectAllButton as te, SelectionDock as ne, SortKeys as re, SourceLabel as d, SourceMark as f, TRASH_KEY as p, __toESM as m, batchOperate as h, bulkCloudPreferences as ie, busyProps as ae, cardClass as oe, cloudLocations as se, confirmModal as ce, coverUrl as g, distinctName as _, duplicateVictims as v, enterPageSelection as y, errorMessage as b, exitPageSelection as le, fetchDuplicates as ue, fetchKeptDuplicates as de, fetchMediaSources as fe, fmtDur as x, fmtSize as S, groupKey as C, keepGroup as w, keepGroups as T, mixedCloudPreferences as pe, queryClient as E, require_jsx_runtime as D, require_react as O, runBulkAction as me, sharedNamePrefix as he, spriteGlyph as k, t as A, useMutation as ge, usePageSelection as _e, useQuery as j, useQueueSort as ve, victimBytes as M } from "./peach-app.js";
// src/react/duplicates/duplicates-page.tsx
var N = /* @__PURE__ */ m(O(), 1), P = D(), F = k("play"), I = k("file-stack"), ye = oe({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), L = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", R = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", z = "font-mono text-caption-1-regular leading-5 text-text-secondary", B = () => {
	E.invalidateQueries({ queryKey: n }), E.invalidateQueries({
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
		holdToConfirm: !0,
		confirm: (t) => {
			let n = v(t, e);
			return {
				title: A("cleanup:duplicates.moveToTrash"),
				danger: e === "all",
				body: A("cleanup:duplicates.trashBody", {
					count: n.length,
					groups: t.length,
					keep: o[e] ?? o.largest,
					size: S(M(t, n))
				})
			};
		},
		run: async (t) => (n = v(t, e), await h(n, "dispose"), B(), async () => {
			await h(n, "restore"), B();
		}),
		receipt: () => A("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var U = (e) => ({
	key: "keep-all",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: A("cleanup:duplicates.markKeepAll"),
		body: A("cleanup:duplicates.keepAllBody", {
			count: e.length,
			files: V(e)
		}),
		recovery: A("cleanup:duplicates.keepAllRecovery")
	}),
	run: async (e) => (await T(e, !0), B(), async () => {
		await T(e, !1), B();
	}),
	receipt: (e) => A("cleanup:duplicates.keptGroups", { count: e.length })
}), W = (e) => ({
	key: "unkeep",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: A("cleanup:duplicates.unkeep"),
		body: A("cleanup:duplicates.unkeepBody", { count: e.length })
	}),
	run: async (e) => (await T(e, !1), B(), async () => {
		await T(e, !0), B();
	}),
	receipt: (e) => A("cleanup:duplicates.unkeptGroups", { count: e.length })
});
function be(e) {
	return e.identical ? /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-(--keep)`,
		children: A("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? A("cleanup:duplicates.sameCodeShorter") : A("cleanup:duplicates.byDuration")
	});
}
function xe({ file: e, prefix: n, openItem: r, selected: i, onSelect: a }) {
	let o = () => r(e.id), s = c[e.location] || e.location || e.drive, l = `/thumb?id=${e.id}&c=4`;
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		children: [
			/* @__PURE__ */ (0, P.jsxs)("button", {
				type: "button",
				onClick: o,
				"aria-label": A("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, P.jsx)(F, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, P.jsx)("img", {
					src: e.has_cover ? g(e, 2) : l,
					alt: "",
					loading: "lazy",
					"data-drop": "self",
					"data-fallbacks": e.has_cover ? l : void 0,
					className: "absolute inset-0 size-full object-contain"
				}, e.cover_version || l)]
			}),
			/* @__PURE__ */ (0, P.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [
					a ? /* @__PURE__ */ (0, P.jsx)(t, {
						slot: null,
						"aria-label": A("cleanup:duplicates.selectFile", { name: e.name }),
						isSelected: i,
						onChange: a
					}) : null,
					/* @__PURE__ */ (0, P.jsx)("button", {
						type: "button",
						onClick: o,
						title: e.name,
						"data-middle-truncate": !0,
						"data-middle-truncate-within": !0,
						className: "min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary",
						children: _(e.name, n)
					}),
					e.is_largest || e.is_longest || e.is_new ? /* @__PURE__ */ (0, P.jsxs)("span", {
						className: "flex flex-none gap-1",
						children: [
							e.is_new ? /* @__PURE__ */ (0, P.jsx)("i", {
								className: `${L} not-italic bg-background-primary-hover text-text-primary`,
								children: A("cleanup:duplicates.newCopy")
							}) : null,
							e.is_largest ? /* @__PURE__ */ (0, P.jsx)("i", {
								className: `${L} not-italic bg-background-primary-hover text-text-secondary`,
								children: A("cleanup:duplicates.largest")
							}) : null,
							e.is_longest ? /* @__PURE__ */ (0, P.jsx)("i", {
								className: `${L} not-italic bg-(--keep)/22 text-(--keep)`,
								children: A("cleanup:duplicates.longest")
							}) : null
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, P.jsxs)("span", {
				className: `${z} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, P.jsx)(f, { mark: u[e.location] || "database" }), /* @__PURE__ */ (0, P.jsx)("span", {
					title: s,
					className: "min-w-0 truncate",
					children: s
				})]
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: z,
				children: S(e.size || 0)
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: z,
				children: x(e.duration)
			}),
			/* @__PURE__ */ (0, P.jsx)("span", {
				className: `${z} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: e.path ?? ""
			})
		]
	});
}
function G({ openItem: u, toast: f, failure: p }) {
	let [m, oe] = (0, N.useState)("pending"), g = j({
		queryKey: n,
		queryFn: ({ signal: e }) => ue(e)
	}), _ = j({
		queryKey: s,
		queryFn: ({ signal: e }) => de(e),
		enabled: m === "kept"
	}), x = j({
		queryKey: l,
		queryFn: ({ signal: e }) => fe(e)
	}), [T, E] = (0, N.useState)(""), [D, O] = (0, N.useState)(/* @__PURE__ */ new Set()), [k, F] = (0, N.useState)(/* @__PURE__ */ new Set());
	_e(() => {
		O(/* @__PURE__ */ new Set()), F(/* @__PURE__ */ new Set());
	});
	let L = {
		receipt: f,
		failure: (e) => p(A("cleanup:duplicates.bulkFailed"), e)
	}, z = ge({
		mutationFn: (e) => h(e, "dispose"),
		onSuccess: (e, t) => {
			F((e) => new Set([...e].filter((e) => !t.includes(e)))), B(), f(A("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await h(t, "restore");
				} catch (e) {
					p(A("cleanup:duplicates.undoTrash"), e);
				} finally {
					B();
				}
			} });
		},
		onSettled: () => E("")
	}), V = ge({
		mutationFn: ({ group: e, on: t }) => w(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			B(), f(A(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await w(t.files.map((e) => e.id), !n);
				} catch (e) {
					p(A("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					B();
				}
			} });
		},
		onError: (e) => p(A("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => E("")
	}), G = ve("duplicates", { size: (e) => Number(e.reclaimable || 0) }), K = m === "kept", q = K ? _.data : g.data, Se = K ? _.error : g.error;
	if (!q) return K && _.isPending ? /* @__PURE__ */ (0, P.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, P.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, P.jsx)(ee, {
			tone: "error",
			title: A("cleanup:duplicates.loadFailed"),
			children: Se ? b(Se) : A("cleanup:duplicates.listUnavailable")
		})
	});
	let J = G.sort(q.groups ?? []), Ce = Number(g.data?.kept ?? q.kept ?? 0), Y = se(x.data), X = J.filter((e) => D.has(C(e))), we = (e) => {
		O(/* @__PURE__ */ new Set()), F(/* @__PURE__ */ new Set()), oe(e);
	}, Te = (e, t) => {
		t && y(), O((n) => {
			let r = new Set(n);
			return t ? r.add(C(e)) : r.delete(C(e)), r;
		});
	}, Z = (e, t) => {
		T || (E(t), me(e, J, L).catch(L.failure).finally(() => E("")));
	}, Q = ({ groups: e, keep: t, key: n }) => {
		if (z.isPending) return;
		let r = v(e, t);
		r.length && ce({
			title: A("cleanup:duplicates.moveToTrash"),
			body: A("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: o[t] ?? o.largest,
				size: S(M(e, r))
			}) + A("shell:bulkAction.canUndo"),
			confirmLabel: A("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (E(n), z.mutateAsync(r))
		});
	}, Ee = (e, t) => {
		t && y(), F((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	}, De = (e, t) => {
		if (T) return;
		let n = e.files.filter((e) => k.has(e.id)).map((e) => e.id);
		n.length && ce({
			title: A("cleanup:duplicates.moveToTrash"),
			body: A("cleanup:duplicates.selectedTrashBody", {
				count: n.length,
				remaining: e.files.length - n.length,
				size: S(M([e], n))
			}) + A("shell:bulkAction.canUndo"),
			confirmLabel: A("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (E(t), z.mutateAsync(n))
		});
	}, $ = (e) => ae(T === e && (z.isPending || V.isPending)), Oe = (e, t, n) => {
		V.isPending || z.isPending || (E(t), V.mutate({
			group: e,
			on: n
		}));
	}, ke = /* @__PURE__ */ (0, P.jsx)(te, {
		label: A("cleanup:duplicates.selectPage"),
		picked: X.length,
		total: J.length,
		onChange: (e) => {
			e && y(), O(e ? new Set(J.map(C)) : /* @__PURE__ */ new Set());
		}
	}), Ae = K ? [W(A("cleanup:duplicates.unkeep"))] : [
		H("largest", A("cleanup:duplicates.keepLargest")),
		H("longest", A("cleanup:duplicates.keepLongest")),
		...ie(X, Y).map((e) => H(e, A("cleanup:duplicates.keepStorage", { storage: c[e] || e }))),
		U(A("cleanup:duplicates.keepAll")),
		H("all", A("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, P.jsx)(a, {
				label: A(K ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				topLabel: A(K ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": "",
					"data-duplicates-frame": ""
				},
				bottomClassName: "min-h-12",
				top: K ? /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
					J.length ? /* @__PURE__ */ (0, P.jsx)(i, {
						busy: T === "all:unkeep",
						onPress: () => Z(W(A("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: A("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(i, {
						onPress: () => we("pending"),
						children: A("cleanup:duplicates.backToPending")
					})
				] }) : /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
					J.length ? /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: T === "all:largest",
							onPress: () => Z(H("largest", ""), "all:largest"),
							children: A("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: T === "all:longest",
							onPress: () => Z(H("longest", ""), "all:longest"),
							children: A("cleanup:duplicates.allKeepLongest")
						}),
						ie(J, Y).map((e) => /* @__PURE__ */ (0, P.jsx)(i, {
							busy: T === `all:${e}`,
							onPress: () => Z(H(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, P.jsx)(d, {
								source: e,
								label: A("cleanup:duplicates.allPreferStorage", { storage: c[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: T === "all:keep",
							onPress: () => Z(U(""), "all:keep"),
							children: A("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(i, {
						onPress: () => we("kept"),
						children: A("cleanup:duplicates.viewKept", { count: Ce })
					})
				] }),
				bottom: /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [/* @__PURE__ */ (0, P.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, P.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							A(K ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
							" · ",
							A("cleanup:duplicates.groupCount", { count: Number(q.total || 0) }),
							" · ",
							K ? A("cleanup:duplicates.keptDetail", { count: Number(q.files || 0) }) : A("cleanup:duplicates.summaryDetail", {
								count: Number(q.files || 0),
								size: S(q.reclaimable)
							})
						]
					}), J.length ? ke : null]
				}), /* @__PURE__ */ (0, P.jsx)("span", {
					"data-entity-sorts": "",
					children: /* @__PURE__ */ (0, P.jsx)(re, {
						sorts: G.sorts,
						onSort: G.onSort
					})
				})] })
			}),
			/* @__PURE__ */ (0, P.jsx)(ne, {
				label: A("cleanup:duplicates.dockLabel"),
				visible: X.length > 0,
				count: A("cleanup:duplicates.selectedGroups", { count: X.length }),
				actions: Ae.map((e) => ({
					action: e,
					items: X,
					host: L,
					done: () => O(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, P.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: le,
					children: A("cleanup:duplicates.clearSelection")
				})
			}),
			z.isError ? /* @__PURE__ */ (0, P.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, P.jsx)(ee, {
					tone: "error",
					title: A("cleanup:duplicates.trashFailed"),
					children: b(z.error)
				})
			}) : null,
			J.length ? J.map((n, r) => {
				let i = [n], a = he(n.files.map((e) => e.name)), o = (e) => `${r}:${e}`;
				return /* @__PURE__ */ (0, P.jsxs)("section", {
					"aria-label": n.code,
					className: ye,
					"data-board-selected": D.has(C(n)) || void 0,
					children: [/* @__PURE__ */ (0, P.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, P.jsx)(t, {
								slot: null,
								"aria-label": A("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: D.has(C(n)),
								onChange: (e) => Te(n, e)
							}),
							/* @__PURE__ */ (0, P.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: n.code
							}),
							/* @__PURE__ */ (0, P.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: A("cleanup:duplicates.groupDetail", {
									count: Number(n.count || 0),
									size: S(n.reclaimable)
								})
							}),
							be(n),
							n.new_files ? /* @__PURE__ */ (0, P.jsx)("span", {
								className: `${R} text-text-primary`,
								children: A("cleanup:duplicates.newFiles", { count: n.new_files })
							}) : null,
							n.cross_drive ? /* @__PURE__ */ (0, P.jsx)("span", {
								className: `${R} text-text-secondary`,
								children: A("cleanup:duplicates.crossDrive", { drives: n.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, P.jsx)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: K ? /* @__PURE__ */ (0, P.jsx)(e, {
									variant: "secondary",
									size: "small",
									...$(o("unkeep")),
									onClick: () => Oe(n, o("unkeep"), !1),
									children: A("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "danger",
										size: "small",
										...$(o("files")),
										disabled: T !== "" || !n.files.some((e) => k.has(e.id)),
										onClick: () => De(n, o("files")),
										children: A("cleanup:duplicates.trashSelectedFiles", { count: n.files.filter((e) => k.has(e.id)).length })
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(o("largest")),
										onClick: () => Q({
											groups: i,
											keep: "largest",
											key: o("largest")
										}),
										children: A("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(o("longest")),
										onClick: () => Q({
											groups: i,
											keep: "longest",
											key: o("longest")
										}),
										children: A("cleanup:duplicates.keepLongest")
									}),
									pe(n.files, Y).map((t) => /* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(o(t)),
										onClick: () => Q({
											groups: i,
											keep: t,
											key: o(t)
										}),
										children: /* @__PURE__ */ (0, P.jsx)(d, {
											source: t,
											label: A("cleanup:duplicates.keepStorage", { storage: c[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(o("keep")),
										onClick: () => Oe(n, o("keep"), !0),
										children: A("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "danger",
										size: "small",
										...$(o("all")),
										onClick: () => Q({
											groups: i,
											keep: "all",
											key: o("all")
										}),
										children: A("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, P.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, P.jsx)(xe, {
						file: e,
						prefix: a,
						openItem: u,
						selected: k.has(e.id),
						onSelect: K ? void 0 : (t) => Ee(e.id, t)
					}, e.id)) })]
				}, C(n));
			}) : K ? /* @__PURE__ */ (0, P.jsx)(r, {
				icon: I,
				title: A("cleanup:duplicates.keptEmptyTitle"),
				children: A("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, P.jsx)(r, {
				icon: I,
				title: A("cleanup:duplicates.emptyTitle"),
				children: A("cleanup:duplicates.emptyBody")
			}),
			J.length > 0 && q.total > J.length ? /* @__PURE__ */ (0, P.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: A("cleanup:duplicates.topGroups", {
					shown: J.length.toLocaleString(),
					count: Number(q.total)
				})
			}) : null
		]
	});
}
export { G as DuplicatesPage };

//# debugId=0a1a2161-9577-42b8-8445-8e3f97722d0c