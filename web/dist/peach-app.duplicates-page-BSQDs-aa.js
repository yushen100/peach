(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "69874542-7122-4068-80fd-5b55e60fdecd", e._sentryDebugIdIdentifier = "sentry-dbid-69874542-7122-4068-80fd-5b55e60fdecd");
	} catch {}
})();
import { Button as e, Checkbox as t, DUPLICATES_KEY as n, EmptyState as r, FilterActionButton as i, FilterGlassRows as a, KEEP_LABELS as o, KEPT_DUPLICATES_KEY as s, LOC as c, MEDIA_SOURCES_KEY as l, MEDIA_SOURCE_ICONS as ee, Note as te, SelectAllButton as ne, SelectionDock as re, SortKeys as ie, SourceLabel as u, SourceMark as d, TRASH_KEY as f, __toESM as p, batchOperate as m, bulkCloudPreferences as ae, busyProps as oe, cardClass as h, cloudLocations as se, confirmModal as g, coverUrl as _, duplicateVictims as v, enterPageSelection as y, errorMessage as b, exitPageSelection as ce, fetchDuplicates as le, fetchKeptDuplicates as ue, fetchMediaSources as de, fmtDur as x, fmtSize as S, groupKey as C, keepGroup as w, keepGroups as T, middleTruncateCut as E, mixedCloudPreferences as fe, queryClient as D, require_jsx_runtime as O, require_react as k, runBulkAction as pe, spriteGlyph as A, t as j, useMutation as me, usePageSelection as he, useQuery as M, useQueueSort as ge, victimBytes as N } from "./peach-app.js";
import { ComparisonText as P } from "./peach-app.comparison-text-d2N41j2E.js";
// src/react/components/filename-comparison.tsx
var F = /* @__PURE__ */ p(k(), 1), I = O();
function L({ value: e, reference: t, onOpen: n }) {
	let r = (0, F.useRef)(null), [i, a] = (0, F.useState)(null);
	return (0, F.useLayoutEffect)(() => {
		let t = r.current;
		if (!t) return;
		let n = !0, i = () => {
			if (!n) return;
			let r = E(t, e);
			a((e) => e?.start === r?.start && e?.end === r?.end ? e : r);
		};
		i();
		let o = typeof ResizeObserver > "u" ? null : new ResizeObserver(i);
		return o?.observe(t), t.parentElement && o?.observe(t.parentElement), document.fonts?.ready.then(i), () => {
			n = !1, o?.disconnect();
		};
	}, [e]), /* @__PURE__ */ (0, I.jsx)("button", {
		ref: r,
		type: "button",
		onClick: n,
		title: e,
		"aria-label": e,
		"data-middle-truncate": "",
		"data-middle-truncate-within": "",
		"data-middle-truncate-managed": "",
		onCopy: (t) => {
			t.clipboardData.setData("text/plain", e), t.preventDefault();
		},
		className: "min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary",
		children: /* @__PURE__ */ (0, I.jsx)(P, {
			value: e,
			reference: t,
			cut: i
		})
	});
}
// src/react/duplicates/duplicates-page.tsx
var R = A("play"), z = A("file-stack"), _e = h({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), B = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", V = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", H = "font-mono text-caption-1-regular leading-5 text-text-secondary", U = () => {
	D.invalidateQueries({ queryKey: n }), D.invalidateQueries({
		queryKey: f,
		exact: !0
	});
}, W = (e) => e.reduce((e, t) => e + t.files.length, 0);
function G(e, t) {
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
				title: j("cleanup:duplicates.moveToTrash"),
				danger: e === "all",
				body: j("cleanup:duplicates.trashBody", {
					count: n.length,
					groups: t.length,
					keep: o[e] ?? o.largest,
					size: S(N(t, n))
				})
			};
		},
		run: async (t) => (n = v(t, e), await m(n, "dispose"), U(), async () => {
			await m(n, "restore"), U();
		}),
		receipt: () => j("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var ve = (e) => ({
	key: "keep-all",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: j("cleanup:duplicates.markKeepAll"),
		body: j("cleanup:duplicates.keepAllBody", {
			count: e.length,
			files: W(e)
		}),
		recovery: j("cleanup:duplicates.keepAllRecovery")
	}),
	run: async (e) => (await T(e, !0), U(), async () => {
		await T(e, !1), U();
	}),
	receipt: (e) => j("cleanup:duplicates.keptGroups", { count: e.length })
}), ye = (e) => ({
	key: "unkeep",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: j("cleanup:duplicates.unkeep"),
		body: j("cleanup:duplicates.unkeepBody", { count: e.length })
	}),
	run: async (e) => (await T(e, !1), U(), async () => {
		await T(e, !0), U();
	}),
	receipt: (e) => j("cleanup:duplicates.unkeptGroups", { count: e.length })
});
function be(e) {
	return e.identical ? /* @__PURE__ */ (0, I.jsx)("span", {
		className: `${V} text-(--keep)`,
		children: j("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, I.jsx)("span", {
		className: `${V} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? j("cleanup:duplicates.sameCodeShorter") : j("cleanup:duplicates.byDuration")
	});
}
function xe({ file: e, reference: n, openItem: r, selected: i, onSelect: a }) {
	let o = () => r(e.id), s = c[e.location] || e.location || e.drive, l = `/thumb?id=${e.id}&c=4`;
	return /* @__PURE__ */ (0, I.jsxs)("div", {
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		children: [
			/* @__PURE__ */ (0, I.jsxs)("button", {
				type: "button",
				onClick: o,
				"aria-label": j("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, I.jsx)(R, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, I.jsx)("img", {
					src: e.has_cover ? _(e, 2) : l,
					alt: "",
					loading: "lazy",
					"data-drop": "self",
					"data-fallbacks": e.has_cover ? l : void 0,
					className: "absolute inset-0 size-full object-contain"
				}, e.cover_version || l)]
			}),
			/* @__PURE__ */ (0, I.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [
					a ? /* @__PURE__ */ (0, I.jsx)(t, {
						slot: null,
						"aria-label": j("cleanup:duplicates.selectFile", { name: e.name }),
						isSelected: i,
						onChange: a
					}) : null,
					/* @__PURE__ */ (0, I.jsx)(L, {
						value: e.name,
						reference: n?.name,
						onOpen: o
					}),
					e.is_largest || e.is_longest || e.is_new ? /* @__PURE__ */ (0, I.jsxs)("span", {
						className: "flex flex-none gap-1",
						children: [
							e.is_new ? /* @__PURE__ */ (0, I.jsx)("i", {
								className: `${B} not-italic bg-background-primary-hover text-text-primary`,
								children: j("cleanup:duplicates.newCopy")
							}) : null,
							e.is_largest ? /* @__PURE__ */ (0, I.jsx)("i", {
								className: `${B} not-italic bg-background-primary-hover text-text-secondary`,
								children: j("cleanup:duplicates.largest")
							}) : null,
							e.is_longest ? /* @__PURE__ */ (0, I.jsx)("i", {
								className: `${B} not-italic bg-(--keep)/22 text-(--keep)`,
								children: j("cleanup:duplicates.longest")
							}) : null
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, I.jsxs)("span", {
				className: `${H} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, I.jsx)(d, { mark: ee[e.location] || "database" }), /* @__PURE__ */ (0, I.jsx)("span", {
					title: s,
					className: "min-w-0 truncate",
					children: s
				})]
			}),
			/* @__PURE__ */ (0, I.jsx)("span", {
				className: H,
				children: S(e.size || 0)
			}),
			/* @__PURE__ */ (0, I.jsx)("span", {
				className: H,
				children: x(e.duration)
			}),
			/* @__PURE__ */ (0, I.jsx)("span", {
				className: `${H} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: /* @__PURE__ */ (0, I.jsx)(P, {
					value: e.path ?? "",
					reference: n?.path ?? void 0
				})
			})
		]
	});
}
function K({ openItem: ee, toast: d, failure: f }) {
	let [p, h] = (0, F.useState)("pending"), _ = M({
		queryKey: n,
		queryFn: ({ signal: e }) => le(e)
	}), x = M({
		queryKey: s,
		queryFn: ({ signal: e }) => ue(e),
		enabled: p === "kept"
	}), T = M({
		queryKey: l,
		queryFn: ({ signal: e }) => de(e)
	}), [E, D] = (0, F.useState)(""), [O, k] = (0, F.useState)(/* @__PURE__ */ new Set()), [A, P] = (0, F.useState)(/* @__PURE__ */ new Set());
	he(() => {
		k(/* @__PURE__ */ new Set()), P(/* @__PURE__ */ new Set());
	});
	let L = {
		receipt: d,
		failure: (e) => f(j("cleanup:duplicates.bulkFailed"), e)
	}, R = me({
		mutationFn: (e) => m(e, "dispose"),
		onSuccess: (e, t) => {
			P((e) => new Set([...e].filter((e) => !t.includes(e)))), U(), d(j("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await m(t, "restore");
				} catch (e) {
					f(j("cleanup:duplicates.undoTrash"), e);
				} finally {
					U();
				}
			} });
		},
		onSettled: () => D("")
	}), B = me({
		mutationFn: ({ group: e, on: t }) => w(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			U(), d(j(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await w(t.files.map((e) => e.id), !n);
				} catch (e) {
					f(j("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					U();
				}
			} });
		},
		onError: (e) => f(j("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => D("")
	}), H = ge("duplicates", { size: (e) => Number(e.reclaimable || 0) }), W = p === "kept", K = W ? x.data : _.data, Se = W ? x.error : _.error;
	if (!K) return W && x.isPending ? /* @__PURE__ */ (0, I.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, I.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, I.jsx)(te, {
			tone: "error",
			title: j("cleanup:duplicates.loadFailed"),
			children: Se ? b(Se) : j("cleanup:duplicates.listUnavailable")
		})
	});
	let q = H.sort(K.groups ?? []), Ce = Number(_.data?.kept ?? K.kept ?? 0), J = se(T.data), Y = q.filter((e) => O.has(C(e))), we = (e) => {
		k(/* @__PURE__ */ new Set()), P(/* @__PURE__ */ new Set()), h(e);
	}, Te = (e, t) => {
		t && y(), k((n) => {
			let r = new Set(n);
			return t ? r.add(C(e)) : r.delete(C(e)), r;
		});
	}, X = (e, t) => {
		E || (D(t), pe(e, q, L).catch(L.failure).finally(() => D("")));
	}, Z = ({ groups: e, keep: t, key: n }) => {
		if (R.isPending) return;
		let r = v(e, t);
		r.length && g({
			title: j("cleanup:duplicates.moveToTrash"),
			body: j("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: o[t] ?? o.largest,
				size: S(N(e, r))
			}) + j("shell:bulkAction.canUndo"),
			confirmLabel: j("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (D(n), R.mutateAsync(r))
		});
	}, Ee = (e, t) => {
		t && y(), P((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	}, De = (e, t) => {
		if (E) return;
		let n = e.files.filter((e) => A.has(e.id)).map((e) => e.id);
		n.length && g({
			title: j("cleanup:duplicates.moveToTrash"),
			body: j("cleanup:duplicates.selectedTrashBody", {
				count: n.length,
				remaining: e.files.length - n.length,
				size: S(N([e], n))
			}) + j("shell:bulkAction.canUndo"),
			confirmLabel: j("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (D(t), R.mutateAsync(n))
		});
	}, Q = (e) => oe(E === e && (R.isPending || B.isPending)), $ = (e, t, n) => {
		B.isPending || R.isPending || (D(t), B.mutate({
			group: e,
			on: n
		}));
	}, Oe = /* @__PURE__ */ (0, I.jsx)(ne, {
		label: j("cleanup:duplicates.selectPage"),
		picked: Y.length,
		total: q.length,
		onChange: (e) => {
			e && y(), k(e ? new Set(q.map(C)) : /* @__PURE__ */ new Set());
		}
	}), ke = W ? [ye(j("cleanup:duplicates.unkeep"))] : [
		G("largest", j("cleanup:duplicates.keepLargest")),
		G("longest", j("cleanup:duplicates.keepLongest")),
		...ae(Y, J).map((e) => G(e, j("cleanup:duplicates.keepStorage", { storage: c[e] || e }))),
		ve(j("cleanup:duplicates.keepAll")),
		G("all", j("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, I.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, I.jsx)(a, {
				label: j(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				topLabel: j(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": "",
					"data-duplicates-frame": ""
				},
				bottomClassName: "min-h-12",
				top: W ? /* @__PURE__ */ (0, I.jsxs)(I.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, I.jsx)(i, {
						busy: E === "all:unkeep",
						onPress: () => X(ye(j("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: j("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, I.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, I.jsx)(i, {
						onPress: () => we("pending"),
						children: j("cleanup:duplicates.backToPending")
					})
				] }) : /* @__PURE__ */ (0, I.jsxs)(I.Fragment, { children: [
					q.length ? /* @__PURE__ */ (0, I.jsxs)(I.Fragment, { children: [
						/* @__PURE__ */ (0, I.jsx)(i, {
							busy: E === "all:largest",
							onPress: () => X(G("largest", ""), "all:largest"),
							children: j("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, I.jsx)(i, {
							busy: E === "all:longest",
							onPress: () => X(G("longest", ""), "all:longest"),
							children: j("cleanup:duplicates.allKeepLongest")
						}),
						ae(q, J).map((e) => /* @__PURE__ */ (0, I.jsx)(i, {
							busy: E === `all:${e}`,
							onPress: () => X(G(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, I.jsx)(u, {
								source: e,
								label: j("cleanup:duplicates.allPreferStorage", { storage: c[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, I.jsx)(i, {
							busy: E === "all:keep",
							onPress: () => X(ve(""), "all:keep"),
							children: j("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, I.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, I.jsx)(i, {
						onPress: () => we("kept"),
						children: j("cleanup:duplicates.viewKept", { count: Ce })
					})
				] }),
				bottom: /* @__PURE__ */ (0, I.jsxs)(I.Fragment, { children: [/* @__PURE__ */ (0, I.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, I.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							j(W ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
							" · ",
							j("cleanup:duplicates.groupCount", { count: Number(K.total || 0) }),
							" · ",
							W ? j("cleanup:duplicates.keptDetail", { count: Number(K.files || 0) }) : j("cleanup:duplicates.summaryDetail", {
								count: Number(K.files || 0),
								size: S(K.reclaimable)
							})
						]
					}), q.length ? Oe : null]
				}), /* @__PURE__ */ (0, I.jsx)("span", {
					"data-entity-sorts": "",
					children: /* @__PURE__ */ (0, I.jsx)(ie, {
						sorts: H.sorts,
						onSort: H.onSort
					})
				})] })
			}),
			/* @__PURE__ */ (0, I.jsx)(re, {
				label: j("cleanup:duplicates.dockLabel"),
				visible: Y.length > 0,
				count: j("cleanup:duplicates.selectedGroups", { count: Y.length }),
				actions: ke.map((e) => ({
					action: e,
					items: Y,
					host: L,
					done: () => k(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, I.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: ce,
					children: j("cleanup:duplicates.clearSelection")
				})
			}),
			R.isError ? /* @__PURE__ */ (0, I.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, I.jsx)(te, {
					tone: "error",
					title: j("cleanup:duplicates.trashFailed"),
					children: b(R.error)
				})
			}) : null,
			q.length ? q.map((n, r) => {
				let i = [n], a = (e) => `${r}:${e}`;
				return /* @__PURE__ */ (0, I.jsxs)("section", {
					"aria-label": n.code,
					className: _e,
					"data-board-selected": O.has(C(n)) || void 0,
					children: [/* @__PURE__ */ (0, I.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, I.jsx)(t, {
								slot: null,
								"aria-label": j("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: O.has(C(n)),
								onChange: (e) => Te(n, e)
							}),
							/* @__PURE__ */ (0, I.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: n.code
							}),
							/* @__PURE__ */ (0, I.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: j("cleanup:duplicates.groupDetail", {
									count: Number(n.count || 0),
									size: S(n.reclaimable)
								})
							}),
							be(n),
							n.new_files ? /* @__PURE__ */ (0, I.jsx)("span", {
								className: `${V} text-text-primary`,
								children: j("cleanup:duplicates.newFiles", { count: n.new_files })
							}) : null,
							n.cross_drive ? /* @__PURE__ */ (0, I.jsx)("span", {
								className: `${V} text-text-secondary`,
								children: j("cleanup:duplicates.crossDrive", { drives: n.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, I.jsx)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: W ? /* @__PURE__ */ (0, I.jsx)(e, {
									variant: "secondary",
									size: "small",
									...Q(a("unkeep")),
									onClick: () => $(n, a("unkeep"), !1),
									children: j("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, I.jsxs)(I.Fragment, { children: [
									/* @__PURE__ */ (0, I.jsx)(e, {
										variant: "danger",
										size: "small",
										...Q(a("files")),
										disabled: E !== "" || !n.files.some((e) => A.has(e.id)),
										onClick: () => De(n, a("files")),
										children: j("cleanup:duplicates.trashSelectedFiles", { count: n.files.filter((e) => A.has(e.id)).length })
									}),
									/* @__PURE__ */ (0, I.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("largest")),
										onClick: () => Z({
											groups: i,
											keep: "largest",
											key: a("largest")
										}),
										children: j("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, I.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("longest")),
										onClick: () => Z({
											groups: i,
											keep: "longest",
											key: a("longest")
										}),
										children: j("cleanup:duplicates.keepLongest")
									}),
									fe(n.files, J).map((t) => /* @__PURE__ */ (0, I.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a(t)),
										onClick: () => Z({
											groups: i,
											keep: t,
											key: a(t)
										}),
										children: /* @__PURE__ */ (0, I.jsx)(u, {
											source: t,
											label: j("cleanup:duplicates.keepStorage", { storage: c[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, I.jsx)(e, {
										variant: "secondary",
										size: "small",
										...Q(a("keep")),
										onClick: () => $(n, a("keep"), !0),
										children: j("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, I.jsx)(e, {
										variant: "danger",
										size: "small",
										...Q(a("all")),
										onClick: () => Z({
											groups: i,
											keep: "all",
											key: a("all")
										}),
										children: j("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, I.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, I.jsx)(xe, {
						file: e,
						reference: n.files.find((t) => t.id !== e.id),
						openItem: ee,
						selected: A.has(e.id),
						onSelect: W ? void 0 : (t) => Ee(e.id, t)
					}, e.id)) })]
				}, C(n));
			}) : W ? /* @__PURE__ */ (0, I.jsx)(r, {
				icon: z,
				title: j("cleanup:duplicates.keptEmptyTitle"),
				children: j("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, I.jsx)(r, {
				icon: z,
				title: j("cleanup:duplicates.emptyTitle"),
				children: j("cleanup:duplicates.emptyBody")
			}),
			q.length > 0 && K.total > q.length ? /* @__PURE__ */ (0, I.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: j("cleanup:duplicates.topGroups", {
					shown: q.length.toLocaleString(),
					count: Number(K.total)
				})
			}) : null
		]
	});
}
export { K as DuplicatesPage };

//# debugId=69874542-7122-4068-80fd-5b55e60fdecd