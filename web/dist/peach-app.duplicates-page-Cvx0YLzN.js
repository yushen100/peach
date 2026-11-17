(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "f6b2a803-1c9c-4ff2-8c0a-1f24332df5a4", e._sentryDebugIdIdentifier = "sentry-dbid-f6b2a803-1c9c-4ff2-8c0a-1f24332df5a4");
	} catch {}
})();
import { Button as e, Checkbox as t, DUPLICATES_KEY as n, EmptyState as r, FilterActionButton as i, FilterGlassRows as a, KEEP_LABELS as o, KEPT_DUPLICATES_KEY as s, LOC as c, MEDIA_SOURCES_KEY as ee, MEDIA_SOURCE_ICONS as l, Note as u, SelectAllButton as te, SelectionDock as ne, SortKeys as re, SourceLabel as ie, SourceMark as d, TRASH_KEY as f, __toESM as p, batchOperate as m, bulkCloudPreferences as h, busyProps as ae, cardClass as g, cloudLocations as oe, confirmModal as _, distinctName as v, duplicateVictims as y, enterPageSelection as b, errorMessage as se, exitPageSelection as ce, fetchDuplicates as le, fetchKeptDuplicates as ue, fetchMediaSources as de, fmtDur as x, fmtSize as S, groupKey as C, keepGroup as w, keepGroups as T, mixedCloudPreferences as fe, queryClient as E, require_jsx_runtime as D, require_react as O, runBulkAction as pe, sharedNamePrefix as me, spriteGlyph as k, t as A, useMutation as he, usePageSelection as ge, useQuery as j, useQueueSort as _e, victimBytes as M } from "./peach-app.js";
// src/react/duplicates/duplicates-page.tsx
var N = /* @__PURE__ */ p(O(), 1), P = D(), F = k("play"), I = k("file-stack"), ve = g({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), L = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", R = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", z = "font-mono text-caption-1-regular leading-5 text-text-secondary", B = () => {
	E.invalidateQueries({ queryKey: n }), E.invalidateQueries({
		queryKey: f,
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
			let n = y(t, e);
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
		run: async (t) => (n = y(t, e), await m(n, "dispose"), B(), async () => {
			await m(n, "restore"), B();
		}),
		receipt: () => A("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var ye = (e) => ({
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
}), be = (e) => ({
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
function xe(e) {
	return e.identical ? /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-(--keep)`,
		children: A("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, P.jsx)("span", {
		className: `${R} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? A("cleanup:duplicates.sameCodeShorter") : A("cleanup:duplicates.byDuration")
	});
}
function Se({ file: e, prefix: n, openItem: r, selected: i, onSelect: a }) {
	let o = () => r(e.id), s = c[e.location] || e.location || e.drive;
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
					src: `/thumb?id=${e.id}&c=4`,
					alt: "",
					loading: "lazy",
					onError: (e) => e.currentTarget.remove(),
					className: "absolute inset-0 size-full object-contain"
				})]
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
						children: v(e.name, n)
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
				children: [/* @__PURE__ */ (0, P.jsx)(d, { mark: l[e.location] || "database" }), /* @__PURE__ */ (0, P.jsx)("span", {
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
function U({ openItem: l, toast: d, failure: f }) {
	let [p, g] = (0, N.useState)("pending"), v = j({
		queryKey: n,
		queryFn: ({ signal: e }) => le(e)
	}), x = j({
		queryKey: s,
		queryFn: ({ signal: e }) => ue(e),
		enabled: p === "kept"
	}), T = j({
		queryKey: ee,
		queryFn: ({ signal: e }) => de(e)
	}), [E, D] = (0, N.useState)(""), [O, k] = (0, N.useState)(/* @__PURE__ */ new Set()), [F, L] = (0, N.useState)(/* @__PURE__ */ new Set());
	ge(() => {
		k(/* @__PURE__ */ new Set()), L(/* @__PURE__ */ new Set());
	});
	let z = {
		receipt: d,
		failure: (e) => f(A("cleanup:duplicates.bulkFailed"), e)
	}, V = he({
		mutationFn: (e) => m(e, "dispose"),
		onSuccess: (e, t) => {
			L((e) => new Set([...e].filter((e) => !t.includes(e)))), B(), d(A("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await m(t, "restore");
				} catch (e) {
					f(A("cleanup:duplicates.undoTrash"), e);
				} finally {
					B();
				}
			} });
		},
		onSettled: () => D("")
	}), U = he({
		mutationFn: ({ group: e, on: t }) => w(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			B(), d(A(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await w(t.files.map((e) => e.id), !n);
				} catch (e) {
					f(A("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					B();
				}
			} });
		},
		onError: (e) => f(A("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => D("")
	}), W = _e("duplicates", { size: (e) => Number(e.reclaimable || 0) }), G = p === "kept", K = G ? x.data : v.data, Ce = G ? x.error : v.error;
	if (!K) return G && x.isPending ? /* @__PURE__ */ (0, P.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, P.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, P.jsx)(u, {
			tone: "error",
			title: A("cleanup:duplicates.loadFailed"),
			children: Ce ? se(Ce) : A("cleanup:duplicates.listUnavailable")
		})
	});
	let q = W.sort(K.groups ?? []), we = Number(v.data?.kept ?? K.kept ?? 0), J = oe(T.data), Y = q.filter((e) => O.has(C(e))), Te = (e) => {
		k(/* @__PURE__ */ new Set()), L(/* @__PURE__ */ new Set()), g(e);
	}, Ee = (e, t) => {
		t && b(), k((n) => {
			let r = new Set(n);
			return t ? r.add(C(e)) : r.delete(C(e)), r;
		});
	}, X = (e, t) => {
		E || (D(t), pe(e, q, z).catch(z.failure).finally(() => D("")));
	}, Z = ({ groups: e, keep: t, key: n }) => {
		if (V.isPending) return;
		let r = y(e, t);
		r.length && _({
			title: A("cleanup:duplicates.moveToTrash"),
			body: A("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: o[t] ?? o.largest,
				size: S(M(e, r))
			}) + A("shell:bulkAction.canUndo"),
			confirmLabel: A("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (D(n), V.mutateAsync(r))
		});
	}, De = (e, t) => {
		t && b(), L((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	}, Oe = (e, t) => {
		if (E) return;
		let n = e.files.filter((e) => F.has(e.id)).map((e) => e.id);
		n.length && _({
			title: A("cleanup:duplicates.moveToTrash"),
			body: A("cleanup:duplicates.selectedTrashBody", {
				count: n.length,
				remaining: e.files.length - n.length,
				size: S(M([e], n))
			}) + A("shell:bulkAction.canUndo"),
			confirmLabel: A("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (D(t), V.mutateAsync(n))
		});
	}, Q = (e) => ae(E === e && (V.isPending || U.isPending)), $ = (e, t, n) => {
		U.isPending || V.isPending || (D(t), U.mutate({
			group: e,
			on: n
		}));
	}, ke = /* @__PURE__ */ (0, P.jsx)(te, {
		label: A("cleanup:duplicates.selectPage"),
		picked: Y.length,
		total: q.length,
		onChange: (e) => {
			e && b(), k(e ? new Set(q.map(C)) : /* @__PURE__ */ new Set());
		}
	}), Ae = G ? [be(A("cleanup:duplicates.unkeep"))] : [
		H("largest", A("cleanup:duplicates.keepLargest")),
		H("longest", A("cleanup:duplicates.keepLongest")),
		...h(Y, J).map((e) => H(e, A("cleanup:duplicates.keepStorage", { storage: c[e] || e }))),
		ye(A("cleanup:duplicates.keepAll")),
		H("all", A("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, P.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, P.jsx)(a, {
				label: A(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				topLabel: A(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": "",
					"data-duplicates-frame": ""
				},
				bottomClassName: "min-h-12",
				top: G ? /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, P.jsx)(i, {
						busy: E === "all:unkeep",
						onPress: () => X(be(A("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: A("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(i, {
						onPress: () => Te("pending"),
						children: A("cleanup:duplicates.backToPending")
					})
				] }) : /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: E === "all:largest",
							onPress: () => X(H("largest", ""), "all:largest"),
							children: A("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: E === "all:longest",
							onPress: () => X(H("longest", ""), "all:longest"),
							children: A("cleanup:duplicates.allKeepLongest")
						}),
						h(q, J).map((e) => /* @__PURE__ */ (0, P.jsx)(i, {
							busy: E === `all:${e}`,
							onPress: () => X(H(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, P.jsx)(ie, {
								source: e,
								label: A("cleanup:duplicates.allPreferStorage", { storage: c[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, P.jsx)(i, {
							busy: E === "all:keep",
							onPress: () => X(ye(""), "all:keep"),
							children: A("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, P.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, P.jsx)(i, {
						onPress: () => Te("kept"),
						children: A("cleanup:duplicates.viewKept", { count: we })
					})
				] }),
				bottom: /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [/* @__PURE__ */ (0, P.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, P.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							A(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
							" · ",
							A("cleanup:duplicates.groupCount", { count: Number(K.total || 0) }),
							" · ",
							G ? A("cleanup:duplicates.keptDetail", { count: Number(K.files || 0) }) : A("cleanup:duplicates.summaryDetail", {
								count: Number(K.files || 0),
								size: S(K.reclaimable)
							})
						]
					}), q.length ? ke : null]
				}), /* @__PURE__ */ (0, P.jsx)("span", {
					"data-entity-sorts": "",
					children: /* @__PURE__ */ (0, P.jsx)(re, {
						sorts: W.sorts,
						onSort: W.onSort
					})
				})] })
			}),
			/* @__PURE__ */ (0, P.jsx)(ne, {
				label: A("cleanup:duplicates.dockLabel"),
				visible: Y.length > 0,
				count: A("cleanup:duplicates.selectedGroups", { count: Y.length }),
				actions: Ae.map((e) => ({
					action: e,
					items: Y,
					host: z,
					done: () => k(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, P.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: ce,
					children: A("cleanup:duplicates.clearSelection")
				})
			}),
			V.isError ? /* @__PURE__ */ (0, P.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, P.jsx)(u, {
					tone: "error",
					title: A("cleanup:duplicates.trashFailed"),
					children: se(V.error)
				})
			}) : null,
			q.length ? q.map((n, r) => {
				let i = [n], a = me(n.files.map((e) => e.name)), o = (e) => `${r}:${e}`;
				return /* @__PURE__ */ (0, P.jsxs)("section", {
					"aria-label": n.code,
					className: ve,
					"data-board-selected": O.has(C(n)) || void 0,
					children: [/* @__PURE__ */ (0, P.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, P.jsx)(t, {
								slot: null,
								"aria-label": A("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: O.has(C(n)),
								onChange: (e) => Ee(n, e)
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
							xe(n),
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
								children: G ? /* @__PURE__ */ (0, P.jsx)(e, {
									variant: "secondary",
									size: "small",
									...Q(o("unkeep")),
									onClick: () => $(n, o("unkeep"), !1),
									children: A("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, P.jsxs)(P.Fragment, { children: [
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "danger",
										size: "small",
										...Q(o("files")),
										disabled: E !== "" || !n.files.some((e) => F.has(e.id)),
										onClick: () => Oe(n, o("files")),
										children: A("cleanup:duplicates.trashSelectedFiles", { count: n.files.filter((e) => F.has(e.id)).length })
									}),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o("largest")),
										onClick: () => Z({
											groups: i,
											keep: "largest",
											key: o("largest")
										}),
										children: A("cleanup:duplicates.keepLargest")
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
										children: A("cleanup:duplicates.keepLongest")
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
										children: /* @__PURE__ */ (0, P.jsx)(ie, {
											source: t,
											label: A("cleanup:duplicates.keepStorage", { storage: c[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, P.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(o("keep")),
										onClick: () => $(n, o("keep"), !0),
										children: A("cleanup:duplicates.keepAll")
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
										children: A("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, P.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, P.jsx)(Se, {
						file: e,
						prefix: a,
						openItem: l,
						selected: F.has(e.id),
						onSelect: G ? void 0 : (t) => De(e.id, t)
					}, e.id)) })]
				}, C(n));
			}) : G ? /* @__PURE__ */ (0, P.jsx)(r, {
				icon: I,
				title: A("cleanup:duplicates.keptEmptyTitle"),
				children: A("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, P.jsx)(r, {
				icon: I,
				title: A("cleanup:duplicates.emptyTitle"),
				children: A("cleanup:duplicates.emptyBody")
			}),
			q.length > 0 && K.total > q.length ? /* @__PURE__ */ (0, P.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: A("cleanup:duplicates.topGroups", {
					shown: q.length.toLocaleString(),
					count: Number(K.total)
				})
			}) : null
		]
	});
}
export { U as DuplicatesPage };

//# debugId=f6b2a803-1c9c-4ff2-8c0a-1f24332df5a4