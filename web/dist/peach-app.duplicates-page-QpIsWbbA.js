(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "c79a91d3-cdf3-4279-8fd4-6806b64dabd6", e._sentryDebugIdIdentifier = "sentry-dbid-c79a91d3-cdf3-4279-8fd4-6806b64dabd6");
	} catch {}
})();
import { Button as e, Checkbox as t, DUPLICATES_KEY as n, EmptyState as r, FilterActionButton as i, FilterGlassRows as ee, KEEP_LABELS as a, KEPT_DUPLICATES_KEY as te, LOC as o, MEDIA_SOURCES_KEY as ne, MEDIA_SOURCE_ICONS as s, Note as c, SelectAllButton as re, SelectionDock as ie, SortKeys as ae, SourceLabel as l, SourceMark as u, TRASH_KEY as d, __toESM as f, batchOperate as p, bulkCloudPreferences as oe, busyProps as se, cardClass as m, cloudLocations as ce, confirmModal as le, distinctName as h, duplicateVictims as g, enterPageSelection as _, errorMessage as v, exitPageSelection as ue, fetchDuplicates as de, fetchKeptDuplicates as fe, fetchMediaSources as pe, fmtDur as y, fmtSize as b, groupKey as x, keepGroup as S, keepGroups as C, mixedCloudPreferences as me, queryClient as w, require_jsx_runtime as T, require_react as E, runBulkAction as he, sharedNamePrefix as ge, spriteGlyph as D, t as O, useMutation as k, usePageSelection as _e, useQuery as A, useQueueSort as ve, victimBytes as j } from "./peach-app.js";
// src/react/duplicates/duplicates-page.tsx
var M = /* @__PURE__ */ f(E(), 1), N = T(), P = D("play"), F = D("file-stack"), ye = m({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), I = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", L = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", R = "font-mono text-caption-1-regular leading-5 text-text-secondary", z = () => {
	w.invalidateQueries({ queryKey: n }), w.invalidateQueries({
		queryKey: d,
		exact: !0
	});
}, B = (e) => e.reduce((e, t) => e + t.files.length, 0);
function V(e, t) {
	let n = [];
	return {
		key: `keep-${e}`,
		label: t,
		reversal: "undo",
		danger: e === "all",
		holdToConfirm: !0,
		confirm: (t) => {
			let n = g(t, e);
			return {
				title: O("cleanup:duplicates.moveToTrash"),
				danger: e === "all",
				body: O("cleanup:duplicates.trashBody", {
					count: n.length,
					groups: t.length,
					keep: a[e] ?? a.largest,
					size: b(j(t, n))
				})
			};
		},
		run: async (t) => (n = g(t, e), await p(n, "dispose"), z(), async () => {
			await p(n, "restore"), z();
		}),
		receipt: () => O("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var H = (e) => ({
	key: "keep-all",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: O("cleanup:duplicates.markKeepAll"),
		body: O("cleanup:duplicates.keepAllBody", {
			count: e.length,
			files: B(e)
		}),
		recovery: O("cleanup:duplicates.keepAllRecovery")
	}),
	run: async (e) => (await C(e, !0), z(), async () => {
		await C(e, !1), z();
	}),
	receipt: (e) => O("cleanup:duplicates.keptGroups", { count: e.length })
}), U = (e) => ({
	key: "unkeep",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: O("cleanup:duplicates.unkeep"),
		body: O("cleanup:duplicates.unkeepBody", { count: e.length })
	}),
	run: async (e) => (await C(e, !1), z(), async () => {
		await C(e, !0), z();
	}),
	receipt: (e) => O("cleanup:duplicates.unkeptGroups", { count: e.length })
});
function be(e) {
	return e.identical ? /* @__PURE__ */ (0, N.jsx)("span", {
		className: `${L} text-(--keep)`,
		children: O("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, N.jsx)("span", {
		className: `${L} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? O("cleanup:duplicates.sameCodeShorter") : O("cleanup:duplicates.byDuration")
	});
}
function xe({ file: e, prefix: t, openItem: n }) {
	let r = () => n(e.id), i = o[e.location] || e.location || e.drive;
	return /* @__PURE__ */ (0, N.jsxs)("div", {
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		children: [
			/* @__PURE__ */ (0, N.jsxs)("button", {
				type: "button",
				onClick: r,
				"aria-label": O("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, N.jsx)(P, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, N.jsx)("img", {
					src: `/thumb?id=${e.id}&c=4`,
					alt: "",
					loading: "lazy",
					onError: (e) => e.currentTarget.remove(),
					className: "absolute inset-0 size-full object-contain"
				})]
			}),
			/* @__PURE__ */ (0, N.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [/* @__PURE__ */ (0, N.jsx)("button", {
					type: "button",
					onClick: r,
					title: e.name,
					"data-middle-truncate": !0,
					"data-middle-truncate-within": !0,
					className: "min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary",
					children: h(e.name, t)
				}), e.is_largest || e.is_longest || e.is_new ? /* @__PURE__ */ (0, N.jsxs)("span", {
					className: "flex flex-none gap-1",
					children: [
						e.is_new ? /* @__PURE__ */ (0, N.jsx)("i", {
							className: `${I} not-italic bg-background-primary-hover text-text-primary`,
							children: O("cleanup:duplicates.newCopy")
						}) : null,
						e.is_largest ? /* @__PURE__ */ (0, N.jsx)("i", {
							className: `${I} not-italic bg-background-primary-hover text-text-secondary`,
							children: O("cleanup:duplicates.largest")
						}) : null,
						e.is_longest ? /* @__PURE__ */ (0, N.jsx)("i", {
							className: `${I} not-italic bg-(--keep)/22 text-(--keep)`,
							children: O("cleanup:duplicates.longest")
						}) : null
					]
				}) : null]
			}),
			/* @__PURE__ */ (0, N.jsxs)("span", {
				className: `${R} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, N.jsx)(u, { mark: s[e.location] || "database" }), /* @__PURE__ */ (0, N.jsx)("span", {
					title: i,
					className: "min-w-0 truncate",
					children: i
				})]
			}),
			/* @__PURE__ */ (0, N.jsx)("span", {
				className: R,
				children: b(e.size || 0)
			}),
			/* @__PURE__ */ (0, N.jsx)("span", {
				className: R,
				children: y(e.duration)
			}),
			/* @__PURE__ */ (0, N.jsx)("span", {
				className: `${R} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: e.path ?? ""
			})
		]
	});
}
function W({ openItem: s, toast: u, failure: d }) {
	let [f, m] = (0, M.useState)("pending"), h = A({
		queryKey: n,
		queryFn: ({ signal: e }) => de(e)
	}), y = A({
		queryKey: te,
		queryFn: ({ signal: e }) => fe(e),
		enabled: f === "kept"
	}), C = A({
		queryKey: ne,
		queryFn: ({ signal: e }) => pe(e)
	}), [w, T] = (0, M.useState)(""), [E, D] = (0, M.useState)(/* @__PURE__ */ new Set());
	_e(() => D(/* @__PURE__ */ new Set()));
	let P = {
		receipt: u,
		failure: (e) => d(O("cleanup:duplicates.bulkFailed"), e)
	}, I = k({
		mutationFn: (e) => p(e, "dispose"),
		onSuccess: (e, t) => {
			z(), u(O("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await p(t, "restore");
				} catch (e) {
					d(O("cleanup:duplicates.undoTrash"), e);
				} finally {
					z();
				}
			} });
		},
		onSettled: () => T("")
	}), R = k({
		mutationFn: ({ group: e, on: t }) => S(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			z(), u(O(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await S(t.files.map((e) => e.id), !n);
				} catch (e) {
					d(O("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					z();
				}
			} });
		},
		onError: (e) => d(O("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => T("")
	}), B = ve("duplicates", { size: (e) => Number(e.reclaimable || 0) }), W = f === "kept", G = W ? y.data : h.data, K = W ? y.error : h.error;
	if (!G) return W && y.isPending ? /* @__PURE__ */ (0, N.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, N.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, N.jsx)(c, {
			tone: "error",
			title: O("cleanup:duplicates.loadFailed"),
			children: K ? v(K) : O("cleanup:duplicates.listUnavailable")
		})
	});
	let q = B.sort(G.groups ?? []), Se = Number(h.data?.kept ?? G.kept ?? 0), J = ce(C.data), Y = q.filter((e) => E.has(x(e))), Ce = (e) => {
		D(/* @__PURE__ */ new Set()), m(e);
	}, we = (e, t) => {
		t && _(), D((n) => {
			let r = new Set(n);
			return t ? r.add(x(e)) : r.delete(x(e)), r;
		});
	}, X = (e, t) => {
		w || (T(t), he(e, q, P).catch(P.failure).finally(() => T("")));
	}, Z = ({ groups: e, keep: t, key: n }) => {
		if (I.isPending) return;
		let r = g(e, t);
		r.length && le({
			title: O("cleanup:duplicates.moveToTrash"),
			body: O("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: a[t] ?? a.largest,
				size: b(j(e, r))
			}) + O("shell:bulkAction.canUndo"),
			confirmLabel: O("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (T(n), I.mutateAsync(r))
		});
	}, Q = (e) => se(w === e && (I.isPending || R.isPending)), $ = (e, t, n) => {
		R.isPending || I.isPending || (T(t), R.mutate({
			group: e,
			on: n
		}));
	}, Te = /* @__PURE__ */ (0, N.jsx)(re, {
		label: O("cleanup:duplicates.selectPage"),
		picked: Y.length,
		total: q.length,
		onChange: (e) => {
			e && _(), D(e ? new Set(q.map(x)) : /* @__PURE__ */ new Set());
		}
	}), Ee = W ? [U(O("cleanup:duplicates.unkeep"))] : [
		V("largest", O("cleanup:duplicates.keepLargest")),
		V("longest", O("cleanup:duplicates.keepLongest")),
		...oe(Y, J).map((e) => V(e, O("cleanup:duplicates.keepStorage", { storage: o[e] || e }))),
		H(O("cleanup:duplicates.keepAll")),
		V("all", O("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, N.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, N.jsx)(ee, {
				label: O(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				topLabel: O(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": "",
					"data-duplicates-frame": ""
				},
				bottomClassName: "min-h-12",
				top: W ? /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, N.jsx)(i, {
						busy: w === "all:unkeep",
						onPress: () => X(U(O("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: O("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, N.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, N.jsx)(i, {
						onPress: () => Ce("pending"),
						children: O("cleanup:duplicates.backToPending")
					})
				] }) : /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [
						/* @__PURE__ */ (0, N.jsx)(i, {
							busy: w === "all:largest",
							onPress: () => X(V("largest", ""), "all:largest"),
							children: O("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, N.jsx)(i, {
							busy: w === "all:longest",
							onPress: () => X(V("longest", ""), "all:longest"),
							children: O("cleanup:duplicates.allKeepLongest")
						}),
						oe(q, J).map((e) => /* @__PURE__ */ (0, N.jsx)(i, {
							busy: w === `all:${e}`,
							onPress: () => X(V(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, N.jsx)(l, {
								source: e,
								label: O("cleanup:duplicates.allPreferStorage", { storage: o[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, N.jsx)(i, {
							busy: w === "all:keep",
							onPress: () => X(H(""), "all:keep"),
							children: O("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, N.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, N.jsx)(i, {
						onPress: () => Ce("kept"),
						children: O("cleanup:duplicates.viewKept", { count: Se })
					})
				] }),
				bottom: /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [/* @__PURE__ */ (0, N.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, N.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							O(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
							" · ",
							O("cleanup:duplicates.groupCount", { count: Number(G.total || 0) }),
							" · ",
							W ? O("cleanup:duplicates.keptDetail", { count: Number(G.files || 0) }) : O("cleanup:duplicates.summaryDetail", {
								count: Number(G.files || 0),
								size: b(G.reclaimable)
							})
						]
					}), q.length ? Te : null]
				}), /* @__PURE__ */ (0, N.jsx)("span", {
					"data-entity-sorts": "",
					children: /* @__PURE__ */ (0, N.jsx)(ae, {
						sorts: B.sorts,
						onSort: B.onSort
					})
				})] })
			}),
			/* @__PURE__ */ (0, N.jsx)(ie, {
				label: O("cleanup:duplicates.dockLabel"),
				visible: Y.length > 0,
				count: O("cleanup:duplicates.selectedGroups", { count: Y.length }),
				actions: Ee.map((e) => ({
					action: e,
					items: Y,
					host: P,
					done: () => D(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, N.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: ue,
					children: O("cleanup:duplicates.clearSelection")
				})
			}),
			I.isError ? /* @__PURE__ */ (0, N.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, N.jsx)(c, {
					tone: "error",
					title: O("cleanup:duplicates.trashFailed"),
					children: v(I.error)
				})
			}) : null,
			q.length ? q.map((n, r) => {
				let i = [n], ee = ge(n.files.map((e) => e.name)), a = (e) => `${r}:${e}`;
				return /* @__PURE__ */ (0, N.jsxs)("section", {
					"aria-label": n.code,
					className: ye,
					"data-board-selected": E.has(x(n)) || void 0,
					children: [/* @__PURE__ */ (0, N.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, N.jsx)(t, {
								slot: null,
								"aria-label": O("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: E.has(x(n)),
								onChange: (e) => we(n, e)
							}),
							/* @__PURE__ */ (0, N.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: n.code
							}),
							/* @__PURE__ */ (0, N.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: O("cleanup:duplicates.groupDetail", {
									count: Number(n.count || 0),
									size: b(n.reclaimable)
								})
							}),
							be(n),
							n.new_files ? /* @__PURE__ */ (0, N.jsx)("span", {
								className: `${L} text-text-primary`,
								children: O("cleanup:duplicates.newFiles", { count: n.new_files })
							}) : null,
							n.cross_drive ? /* @__PURE__ */ (0, N.jsx)("span", {
								className: `${L} text-text-secondary`,
								children: O("cleanup:duplicates.crossDrive", { drives: n.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, N.jsx)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: W ? /* @__PURE__ */ (0, N.jsx)(e, {
									variant: "secondary",
									size: "small",
									...Q(a("unkeep")),
									onClick: () => $(n, a("unkeep"), !1),
									children: O("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, N.jsxs)(N.Fragment, { children: [
									/* @__PURE__ */ (0, N.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("largest")),
										onClick: () => Z({
											groups: i,
											keep: "largest",
											key: a("largest")
										}),
										children: O("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, N.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("longest")),
										onClick: () => Z({
											groups: i,
											keep: "longest",
											key: a("longest")
										}),
										children: O("cleanup:duplicates.keepLongest")
									}),
									me(n.files, J).map((t) => /* @__PURE__ */ (0, N.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a(t)),
										onClick: () => Z({
											groups: i,
											keep: t,
											key: a(t)
										}),
										children: /* @__PURE__ */ (0, N.jsx)(l, {
											source: t,
											label: O("cleanup:duplicates.keepStorage", { storage: o[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, N.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("keep")),
										onClick: () => $(n, a("keep"), !0),
										children: O("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, N.jsx)(e, {
										variant: "danger",
										size: "small",
										...Q(a("all")),
										onClick: () => Z({
											groups: i,
											keep: "all",
											key: a("all")
										}),
										children: O("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, N.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, N.jsx)(xe, {
						file: e,
						prefix: ee,
						openItem: s
					}, e.id)) })]
				}, x(n));
			}) : W ? /* @__PURE__ */ (0, N.jsx)(r, {
				icon: F,
				title: O("cleanup:duplicates.keptEmptyTitle"),
				children: O("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, N.jsx)(r, {
				icon: F,
				title: O("cleanup:duplicates.emptyTitle"),
				children: O("cleanup:duplicates.emptyBody")
			}),
			q.length > 0 && G.total > q.length ? /* @__PURE__ */ (0, N.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: O("cleanup:duplicates.topGroups", {
					shown: q.length.toLocaleString(),
					count: Number(G.total)
				})
			}) : null
		]
	});
}
export { W as DuplicatesPage };

//# debugId=c79a91d3-cdf3-4279-8fd4-6806b64dabd6