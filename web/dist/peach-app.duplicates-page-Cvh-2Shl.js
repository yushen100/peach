(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "80bd7a72-8de3-4089-93f1-02dab1988c40", e._sentryDebugIdIdentifier = "sentry-dbid-80bd7a72-8de3-4089-93f1-02dab1988c40");
	} catch {}
})();
import { Button as e, Checkbox as t, DUPLICATES_KEY as n, EmptyState as r, FilterActionButton as i, FilterGlassRows as a, Gg as o, H7 as ee, JZ as s, KEEP_LABELS as c, KEPT_DUPLICATES_KEY as l, LOC as u, M6 as te, MEDIA_SOURCES_KEY as d, MEDIA_SOURCE_ICONS as f, Note as p, SelectAllButton as m, SelectionDock as h, SortKeys as g, SourceLabel as ne, SourceMark as _, TRASH_KEY as v, __toESM as y, batchOperate as b, bulkCloudPreferences as re, busyProps as ie, cardClass as ae, cloudLocations as oe, confirmModal as se, coverUrl as x, duplicateVictims as S, enterPageSelection as C, errorMessage as ce, exitPageSelection as le, fetchDuplicates as ue, fetchKeptDuplicates as de, fetchMediaSources as fe, fmtDur as w, fmtSize as T, groupKey as E, keepGroup as pe, keepGroups as D, middleTruncateCut as O, mixedCloudPreferences as me, queryClient as k, qx as he, require_jsx_runtime as A, require_react as j, runBulkAction as ge, spriteGlyph as M, t as N, useMutation as _e, usePageSelection as ve, useQuery as P, useQueueSort as ye, useWorkContextMenu as be, victimBytes as F } from "./peach-app.js";
import { ComparisonText as I } from "./peach-app.comparison-text-d2N41j2E.js";
// src/react/components/filename-comparison.tsx
var L = /* @__PURE__ */ y(j(), 1), R = A();
function z({ value: e, reference: t, onOpen: n }) {
	let r = (0, L.useRef)(null), [i, a] = (0, L.useState)(null);
	return (0, L.useLayoutEffect)(() => {
		let t = r.current;
		if (!t) return;
		let n = !0, i = () => {
			if (!n) return;
			let r = O(t, e);
			a((e) => e?.start === r?.start && e?.end === r?.end ? e : r);
		};
		i();
		let o = typeof ResizeObserver > "u" ? null : new ResizeObserver(i);
		return o?.observe(t), t.parentElement && o?.observe(t.parentElement), document.fonts?.ready.then(i), () => {
			n = !1, o?.disconnect();
		};
	}, [e]), /* @__PURE__ */ (0, R.jsx)("button", {
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
		children: /* @__PURE__ */ (0, R.jsx)(I, {
			value: e,
			reference: t,
			cut: i
		})
	});
}
// src/react/duplicates/duplicates-page.tsx
var B = M("play"), xe = M("file-stack"), Se = ae({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), V = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", H = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", U = "font-mono text-caption-1-regular leading-5 text-text-secondary", W = () => {
	k.invalidateQueries({ queryKey: n }), k.invalidateQueries({
		queryKey: v,
		exact: !0
	});
}, G = (e) => e.reduce((e, t) => e + t.files.length, 0);
function K(e, t) {
	let n = [];
	return {
		key: `keep-${e}`,
		label: t,
		reversal: "undo",
		danger: e === "all",
		holdToConfirm: !0,
		confirm: (t) => {
			let n = S(t, e);
			return {
				title: N("cleanup:duplicates.moveToTrash"),
				danger: e === "all",
				body: N("cleanup:duplicates.trashBody", {
					count: n.length,
					groups: t.length,
					keep: c[e] ?? c.largest,
					size: T(F(t, n))
				})
			};
		},
		run: async (t) => (n = S(t, e), await b(n, "dispose"), W(), async () => {
			await b(n, "restore"), W();
		}),
		receipt: () => N("cleanup:duplicates.movedToTrash", { count: n.length })
	};
}
var Ce = (e) => ({
	key: "keep-all",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: N("cleanup:duplicates.markKeepAll"),
		body: N("cleanup:duplicates.keepAllBody", {
			count: e.length,
			files: G(e)
		}),
		recovery: N("cleanup:duplicates.keepAllRecovery")
	}),
	run: async (e) => (await D(e, !0), W(), async () => {
		await D(e, !1), W();
	}),
	receipt: (e) => N("cleanup:duplicates.keptGroups", { count: e.length })
}), we = (e) => ({
	key: "unkeep",
	label: e,
	reversal: "undo",
	confirm: (e) => ({
		title: N("cleanup:duplicates.unkeep"),
		body: N("cleanup:duplicates.unkeepBody", { count: e.length })
	}),
	run: async (e) => (await D(e, !1), W(), async () => {
		await D(e, !0), W();
	}),
	receipt: (e) => N("cleanup:duplicates.unkeptGroups", { count: e.length })
});
function Te(e) {
	return e.identical ? /* @__PURE__ */ (0, R.jsx)("span", {
		className: `${H} text-(--keep)`,
		children: N("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, R.jsx)("span", {
		className: `${H} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? N("cleanup:duplicates.sameCodeShorter") : N("cleanup:duplicates.byDuration")
	});
}
function Ee({ file: e, reference: n, openItem: r, selected: i, onSelect: a, onTrash: s, busy: c }) {
	let l = be(), d = () => r(e.id), p = [{
		id: "open",
		label: N("catalog:mediaActions.open"),
		icon: o,
		run: d
	}];
	a && p.push({
		id: "select",
		label: N(i ? "catalog:mediaActions.deselect" : "catalog:mediaActions.select"),
		icon: ee,
		run: () => a(!i)
	}), s && p.push({
		id: "trash",
		label: N("cleanup:duplicates.moveToTrash"),
		icon: te,
		danger: !0,
		disabled: c,
		run: s
	});
	let m = {
		key: e.id,
		operations: p
	}, h = u[e.location] || e.location || e.drive, g = `/thumb?id=${e.id}&c=4`;
	return /* @__PURE__ */ (0, R.jsxs)("div", {
		"data-duplicate-file": e.id,
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		onContextMenu: (e) => l.onContextMenu(e, m),
		onKeyDown: (e) => l.onKeyDown(e, m),
		children: [
			l.menu,
			/* @__PURE__ */ (0, R.jsxs)("button", {
				type: "button",
				onClick: d,
				"aria-label": N("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, R.jsx)(B, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, R.jsx)("img", {
					src: e.has_cover ? x(e, 2) : g,
					alt: "",
					loading: "lazy",
					"data-drop": "self",
					"data-fallbacks": e.has_cover ? g : void 0,
					className: "absolute inset-0 size-full object-contain"
				}, e.cover_version || g)]
			}),
			/* @__PURE__ */ (0, R.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [
					a ? /* @__PURE__ */ (0, R.jsx)(t, {
						slot: null,
						"aria-label": N("cleanup:duplicates.selectFile", { name: e.name }),
						isSelected: i,
						onChange: a
					}) : null,
					/* @__PURE__ */ (0, R.jsx)(z, {
						value: e.name,
						reference: n?.name,
						onOpen: d
					}),
					e.is_largest || e.is_longest || e.is_new ? /* @__PURE__ */ (0, R.jsxs)("span", {
						className: "flex flex-none gap-1",
						children: [
							e.is_new ? /* @__PURE__ */ (0, R.jsx)("i", {
								className: `${V} not-italic bg-background-primary-hover text-text-primary`,
								children: N("cleanup:duplicates.newCopy")
							}) : null,
							e.is_largest ? /* @__PURE__ */ (0, R.jsx)("i", {
								className: `${V} not-italic bg-background-primary-hover text-text-secondary`,
								children: N("cleanup:duplicates.largest")
							}) : null,
							e.is_longest ? /* @__PURE__ */ (0, R.jsx)("i", {
								className: `${V} not-italic bg-(--keep)/22 text-(--keep)`,
								children: N("cleanup:duplicates.longest")
							}) : null
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, R.jsxs)("span", {
				className: `${U} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, R.jsx)(_, { mark: f[e.location] || "database" }), /* @__PURE__ */ (0, R.jsx)("span", {
					title: h,
					className: "min-w-0 truncate",
					children: h
				})]
			}),
			/* @__PURE__ */ (0, R.jsx)("span", {
				className: U,
				children: T(e.size || 0)
			}),
			/* @__PURE__ */ (0, R.jsx)("span", {
				className: U,
				children: w(e.duration)
			}),
			/* @__PURE__ */ (0, R.jsx)("span", {
				className: `${U} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: /* @__PURE__ */ (0, R.jsx)(I, {
					value: e.path ?? "",
					reference: n?.path ?? void 0
				})
			})
		]
	});
}
function q({ openItem: o, toast: f, failure: _ }) {
	let v = be(), [y, ae] = (0, L.useState)("pending"), x = P({
		queryKey: n,
		queryFn: ({ signal: e }) => ue(e)
	}), w = P({
		queryKey: l,
		queryFn: ({ signal: e }) => de(e),
		enabled: y === "kept"
	}), D = P({
		queryKey: d,
		queryFn: ({ signal: e }) => fe(e)
	}), [O, k] = (0, L.useState)(""), [A, j] = (0, L.useState)(/* @__PURE__ */ new Set()), [M, I] = (0, L.useState)(/* @__PURE__ */ new Set());
	ve(() => {
		j(/* @__PURE__ */ new Set()), I(/* @__PURE__ */ new Set());
	});
	let z = {
		receipt: f,
		failure: (e) => _(N("cleanup:duplicates.bulkFailed"), e)
	}, B = _e({
		mutationFn: (e) => b(e, "dispose"),
		onSuccess: (e, t) => {
			I((e) => new Set([...e].filter((e) => !t.includes(e)))), W(), f(N("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await b(t, "restore");
				} catch (e) {
					_(N("cleanup:duplicates.undoTrash"), e);
				} finally {
					W();
				}
			} });
		},
		onSettled: () => k("")
	}), V = _e({
		mutationFn: ({ group: e, on: t }) => pe(e.files.map((e) => e.id), t),
		onSuccess: (e, { group: t, on: n }) => {
			W(), f(N(n ? "cleanup:duplicates.keptAll" : "cleanup:duplicates.unkeptOne", { code: t.code }), { undo: async () => {
				try {
					await pe(t.files.map((e) => e.id), !n);
				} catch (e) {
					_(N("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					W();
				}
			} });
		},
		onError: (e) => _(N("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => k("")
	}), U = ye("duplicates", { size: (e) => Number(e.reclaimable || 0) }), G = y === "kept", q = G ? w.data : x.data, De = G ? w.error : x.error;
	if (!q) return G && w.isPending ? /* @__PURE__ */ (0, R.jsx)("div", { className: "mx-auto w-full max-w-board" }) : /* @__PURE__ */ (0, R.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, R.jsx)(p, {
			tone: "error",
			title: N("cleanup:duplicates.loadFailed"),
			children: De ? ce(De) : N("cleanup:duplicates.listUnavailable")
		})
	});
	let J = U.sort(q.groups ?? []), Oe = Number(x.data?.kept ?? q.kept ?? 0), Y = oe(D.data), X = J.filter((e) => A.has(E(e))), ke = (e) => {
		j(/* @__PURE__ */ new Set()), I(/* @__PURE__ */ new Set()), ae(e);
	}, Ae = (e, t) => {
		t && C(), j((n) => {
			let r = new Set(n);
			return t ? r.add(E(e)) : r.delete(E(e)), r;
		});
	}, Z = (e, t) => {
		O || (k(t), ge(e, J, z).catch(z.failure).finally(() => k("")));
	}, Q = ({ groups: e, keep: t, key: n }) => {
		if (B.isPending) return;
		let r = S(e, t);
		r.length && se({
			title: N("cleanup:duplicates.moveToTrash"),
			body: N("cleanup:duplicates.trashBody", {
				count: r.length,
				groups: e.length,
				keep: c[t] ?? c.largest,
				size: T(F(e, r))
			}) + N("shell:bulkAction.canUndo"),
			confirmLabel: N("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (k(n), B.mutateAsync(r))
		});
	}, je = (e, t) => {
		t && C(), I((n) => {
			let r = new Set(n);
			return t ? r.add(e) : r.delete(e), r;
		});
	}, Me = (e, t, n = M) => {
		if (O) return;
		let r = e.files.filter((e) => n.has(e.id)).map((e) => e.id);
		r.length && se({
			title: N("cleanup:duplicates.moveToTrash"),
			body: N("cleanup:duplicates.selectedTrashBody", {
				count: r.length,
				remaining: e.files.length - r.length,
				size: T(F([e], r))
			}) + N("shell:bulkAction.canUndo"),
			confirmLabel: N("cleanup:duplicates.moveToTrash"),
			holdToConfirm: !0,
			onConfirm: () => (k(t), B.mutateAsync(r))
		});
	}, $ = (e) => ie(O === e && (B.isPending || V.isPending)), Ne = (e, t, n) => {
		V.isPending || B.isPending || (k(t), V.mutate({
			group: e,
			on: n
		}));
	}, Pe = /* @__PURE__ */ (0, R.jsx)(m, {
		label: N("cleanup:duplicates.selectPage"),
		picked: X.length,
		total: J.length,
		onChange: (e) => {
			e && C(), j(e ? new Set(J.map(E)) : /* @__PURE__ */ new Set());
		}
	}), Fe = G ? [we(N("cleanup:duplicates.unkeep"))] : [
		K("largest", N("cleanup:duplicates.keepLargest")),
		K("longest", N("cleanup:duplicates.keepLongest")),
		...re(X, Y).map((e) => K(e, N("cleanup:duplicates.keepStorage", { storage: u[e] || e }))),
		Ce(N("cleanup:duplicates.keepAll")),
		K("all", N("cleanup:duplicates.trashGroup"))
	];
	return /* @__PURE__ */ (0, R.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			v.menu,
			/* @__PURE__ */ (0, R.jsx)(a, {
				label: N(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				topLabel: N(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.bulkKeep"),
				attrs: {
					"data-catalog-frame": "",
					"data-filter-frame": "",
					"data-duplicates-frame": ""
				},
				bottomClassName: "min-h-12",
				top: G ? /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [
					J.length ? /* @__PURE__ */ (0, R.jsx)(i, {
						busy: O === "all:unkeep",
						onPress: () => Z(we(N("cleanup:duplicates.allUnkeep")), "all:unkeep"),
						children: N("cleanup:duplicates.allUnkeep")
					}) : null,
					/* @__PURE__ */ (0, R.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, R.jsx)(i, {
						onPress: () => ke("pending"),
						children: N("cleanup:duplicates.backToPending")
					})
				] }) : /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [
					J.length ? /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [
						/* @__PURE__ */ (0, R.jsx)(i, {
							busy: O === "all:largest",
							onPress: () => Z(K("largest", ""), "all:largest"),
							children: N("cleanup:duplicates.allKeepLargest")
						}),
						/* @__PURE__ */ (0, R.jsx)(i, {
							busy: O === "all:longest",
							onPress: () => Z(K("longest", ""), "all:longest"),
							children: N("cleanup:duplicates.allKeepLongest")
						}),
						re(J, Y).map((e) => /* @__PURE__ */ (0, R.jsx)(i, {
							busy: O === `all:${e}`,
							onPress: () => Z(K(e, ""), `all:${e}`),
							children: /* @__PURE__ */ (0, R.jsx)(ne, {
								source: e,
								label: N("cleanup:duplicates.allPreferStorage", { storage: u[e] || e })
							})
						}, e)),
						/* @__PURE__ */ (0, R.jsx)(i, {
							busy: O === "all:keep",
							onPress: () => Z(Ce(""), "all:keep"),
							children: N("cleanup:duplicates.allKeepAll")
						})
					] }) : null,
					/* @__PURE__ */ (0, R.jsx)("span", { className: "ml-auto" }),
					/* @__PURE__ */ (0, R.jsx)(i, {
						onPress: () => ke("kept"),
						children: N("cleanup:duplicates.viewKept", { count: Oe })
					})
				] }),
				bottom: /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [/* @__PURE__ */ (0, R.jsxs)("span", {
					"data-catalog-summary": "",
					children: [/* @__PURE__ */ (0, R.jsxs)("span", {
						"data-catalog-readout": "",
						role: "status",
						children: [
							N(G ? "cleanup:duplicates.keptLabel" : "cleanup:duplicates.summaryLabel"),
							" · ",
							N("cleanup:duplicates.groupCount", { count: Number(q.total || 0) }),
							" · ",
							G ? N("cleanup:duplicates.keptDetail", { count: Number(q.files || 0) }) : N("cleanup:duplicates.summaryDetail", {
								count: Number(q.files || 0),
								size: T(q.reclaimable)
							})
						]
					}), J.length ? Pe : null]
				}), /* @__PURE__ */ (0, R.jsx)("span", {
					"data-entity-sorts": "",
					children: /* @__PURE__ */ (0, R.jsx)(g, {
						sorts: U.sorts,
						onSort: U.onSort
					})
				})] })
			}),
			/* @__PURE__ */ (0, R.jsx)(h, {
				label: N("cleanup:duplicates.dockLabel"),
				visible: X.length > 0,
				count: N("cleanup:duplicates.selectedGroups", { count: X.length }),
				actions: Fe.map((e) => ({
					action: e,
					items: X,
					host: z,
					done: () => j(/* @__PURE__ */ new Set())
				})),
				children: /* @__PURE__ */ (0, R.jsx)(e, {
					variant: "ghost",
					size: "small",
					onClick: le,
					children: N("cleanup:duplicates.clearSelection")
				})
			}),
			B.isError ? /* @__PURE__ */ (0, R.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, R.jsx)(p, {
					tone: "error",
					title: N("cleanup:duplicates.trashFailed"),
					children: ce(B.error)
				})
			}) : null,
			J.length ? J.map((n, r) => {
				let i = [n], a = (e) => `${r}:${e}`, c = A.has(E(n)), l = () => {
					let e = [{
						id: "select",
						label: c ? N("catalog:mediaActions.deselect") : N("cleanup:duplicates.selectGroup", { code: n.code }),
						icon: ee,
						run: () => Ae(n, !c)
					}, {
						id: "keep",
						label: N(G ? "cleanup:duplicates.unkeep" : "cleanup:duplicates.keepAll"),
						icon: G ? s : he,
						disabled: !!O,
						run: () => Ne(n, a("keep"), !G)
					}];
					if (!G) {
						let t = [
							["largest", N("cleanup:duplicates.keepLargest")],
							["longest", N("cleanup:duplicates.keepLongest")],
							...me(n.files, Y).map((e) => [e, N("cleanup:duplicates.keepStorage", { storage: u[e] || e })]),
							["all", N("cleanup:duplicates.trashGroup")]
						];
						for (let [n, r] of t) e.push({
							id: n,
							label: r,
							icon: n === "all" ? te : he,
							danger: n === "all",
							disabled: !!O,
							run: () => Q({
								groups: i,
								keep: n,
								key: a(n)
							})
						});
					}
					return {
						key: E(n),
						operations: e
					};
				};
				return /* @__PURE__ */ (0, R.jsxs)("section", {
					"aria-label": n.code,
					className: Se,
					"data-board-selected": A.has(E(n)) || void 0,
					children: [/* @__PURE__ */ (0, R.jsxs)("div", {
						"data-duplicate-group-tools": "",
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						onContextMenu: (e) => v.onContextMenu(e, l()),
						onKeyDown: (e) => {
							(e.key === "ContextMenu" || e.shiftKey && e.key === "F10") && v.onKeyDown(e, l());
						},
						children: [
							/* @__PURE__ */ (0, R.jsx)(t, {
								slot: null,
								"aria-label": N("cleanup:duplicates.selectGroup", { code: n.code }),
								isSelected: A.has(E(n)),
								onChange: (e) => Ae(n, e)
							}),
							/* @__PURE__ */ (0, R.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: n.code
							}),
							/* @__PURE__ */ (0, R.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: N("cleanup:duplicates.groupDetail", {
									count: Number(n.count || 0),
									size: T(n.reclaimable)
								})
							}),
							Te(n),
							n.new_files ? /* @__PURE__ */ (0, R.jsx)("span", {
								className: `${H} text-text-primary`,
								children: N("cleanup:duplicates.newFiles", { count: n.new_files })
							}) : null,
							n.cross_drive ? /* @__PURE__ */ (0, R.jsx)("span", {
								className: `${H} text-text-secondary`,
								children: N("cleanup:duplicates.crossDrive", { drives: n.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, R.jsx)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: G ? /* @__PURE__ */ (0, R.jsx)(e, {
									variant: "secondary",
									size: "small",
									...$(a("unkeep")),
									onClick: () => Ne(n, a("unkeep"), !1),
									children: N("cleanup:duplicates.unkeep")
								}) : /* @__PURE__ */ (0, R.jsxs)(R.Fragment, { children: [
									/* @__PURE__ */ (0, R.jsx)(e, {
										variant: "danger",
										size: "small",
										...$(a("files")),
										disabled: O !== "" || !n.files.some((e) => M.has(e.id)),
										onClick: () => Me(n, a("files")),
										children: N("cleanup:duplicates.trashSelectedFiles", { count: n.files.filter((e) => M.has(e.id)).length })
									}),
									/* @__PURE__ */ (0, R.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(a("largest")),
										onClick: () => Q({
											groups: i,
											keep: "largest",
											key: a("largest")
										}),
										children: N("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, R.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(a("longest")),
										onClick: () => Q({
											groups: i,
											keep: "longest",
											key: a("longest")
										}),
										children: N("cleanup:duplicates.keepLongest")
									}),
									me(n.files, Y).map((t) => /* @__PURE__ */ (0, R.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(a(t)),
										onClick: () => Q({
											groups: i,
											keep: t,
											key: a(t)
										}),
										children: /* @__PURE__ */ (0, R.jsx)(ne, {
											source: t,
											label: N("cleanup:duplicates.keepStorage", { storage: u[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, R.jsx)(e, {
										variant: "secondary",
										size: "small",
										...$(a("keep")),
										onClick: () => Ne(n, a("keep"), !0),
										children: N("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, R.jsx)(e, {
										variant: "danger",
										size: "small",
										...$(a("all")),
										onClick: () => Q({
											groups: i,
											keep: "all",
											key: a("all")
										}),
										children: N("cleanup:duplicates.trashGroup")
									})
								] })
							})
						]
					}), /* @__PURE__ */ (0, R.jsx)("div", { children: n.files.map((e) => /* @__PURE__ */ (0, R.jsx)(Ee, {
						file: e,
						reference: n.files.find((t) => t.id !== e.id),
						openItem: o,
						selected: M.has(e.id),
						onSelect: G ? void 0 : (t) => je(e.id, t),
						busy: !!O,
						onTrash: G ? void 0 : () => Me(n, a("files"), /* @__PURE__ */ new Set([e.id]))
					}, e.id)) })]
				}, E(n));
			}) : G ? /* @__PURE__ */ (0, R.jsx)(r, {
				icon: xe,
				title: N("cleanup:duplicates.keptEmptyTitle"),
				children: N("cleanup:duplicates.keptEmptyBody")
			}) : /* @__PURE__ */ (0, R.jsx)(r, {
				icon: xe,
				title: N("cleanup:duplicates.emptyTitle"),
				children: N("cleanup:duplicates.emptyBody")
			}),
			J.length > 0 && q.total > J.length ? /* @__PURE__ */ (0, R.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: N("cleanup:duplicates.topGroups", {
					shown: J.length.toLocaleString(),
					count: Number(q.total)
				})
			}) : null
		]
	});
}
export { q as DuplicatesPage };

//# debugId=80bd7a72-8de3-4089-93f1-02dab1988c40