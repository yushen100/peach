(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "fd02a663-3896-4907-9ebc-706fbd897c5c", e._sentryDebugIdIdentifier = "sentry-dbid-fd02a663-3896-4907-9ebc-706fbd897c5c");
	} catch {}
})();
import { Button as e, CollectionSummary as t, DUPLICATES_KEY as n, EmptyState as r, FilterGlass as i, GlassPill as a, KEEP_LABELS as o, LOC as s, MEDIA_SOURCES_KEY as c, MEDIA_SOURCE_ICONS as l, Note as u, SourceLabel as d, SourceMark as f, TRASH_KEY as p, __toESM as m, batchOperate as h, bulkCloudPreferences as g, busyProps as _, cardClass as v, cloudLocations as y, confirmModal as b, distinctName as x, duplicateVictims as S, errorMessage as C, fetchDuplicates as w, fetchMediaSources as T, fmtDur as E, fmtSize as D, keepGroup as O, mixedCloudPreferences as k, queryClient as A, require_jsx_runtime as j, require_react as M, sharedNamePrefix as N, spriteGlyph as P, t as F, useMutation as I, useQuery as L, victimBytes as R } from "./peach-app.js";
// src/react/duplicates/duplicates-page.tsx
var z = /* @__PURE__ */ m(M(), 1), B = j(), V = P("play"), H = P("file-stack"), U = v({
	padding: "none",
	radius: "surface",
	className: "mb-6 overflow-hidden dark:bg-background-primary-default"
}), W = "rounded-sm px-1.5 py-px text-caption-1-regular leading-5", G = "rounded-sm px-2 py-0.5 text-caption-1-regular leading-5", K = "font-mono text-caption-1-regular leading-5 text-text-secondary", q = () => {
	A.invalidateQueries({
		queryKey: n,
		exact: !0
	}), A.invalidateQueries({
		queryKey: p,
		exact: !0
	});
};
function J(e) {
	return e.identical ? /* @__PURE__ */ (0, B.jsx)("span", {
		className: `${G} text-(--keep)`,
		children: F("cleanup:duplicates.sha1Match")
	}) : /* @__PURE__ */ (0, B.jsx)("span", {
		className: `${G} text-text-secondary`,
		children: e.evidence === "same_code_short_copy" ? F("cleanup:duplicates.sameCodeShorter") : F("cleanup:duplicates.byDuration")
	});
}
function Y({ file: e, prefix: t, openItem: n }) {
	let r = () => n(e.id), i = s[e.location] || e.location || e.drive;
	return /* @__PURE__ */ (0, B.jsxs)("div", {
		className: "duplicate-row items-center gap-3 border-t border-separator-border px-5 py-4 max-compact:p-4",
		children: [
			/* @__PURE__ */ (0, B.jsxs)("button", {
				type: "button",
				onClick: r,
				"aria-label": F("cleanup:duplicates.previewFile", { name: e.name }),
				className: "relative row-span-2 inline-grid aspect-16/10 w-full cursor-pointer place-items-center overflow-hidden rounded-2lg bg-media-placeholder text-text-secondary",
				children: [/* @__PURE__ */ (0, B.jsx)(V, {
					"aria-hidden": !0,
					className: "size-6"
				}), /* @__PURE__ */ (0, B.jsx)("img", {
					src: `/thumb?id=${e.id}&c=4`,
					alt: "",
					loading: "lazy",
					onError: (e) => e.currentTarget.remove(),
					className: "absolute inset-0 size-full object-contain"
				})]
			}),
			/* @__PURE__ */ (0, B.jsxs)("span", {
				className: "flex min-w-0 items-center gap-2 max-duplicate-narrow:col-start-2 max-duplicate-narrow:-col-end-1",
				children: [/* @__PURE__ */ (0, B.jsx)("button", {
					type: "button",
					onClick: r,
					title: e.name,
					"data-middle-truncate": !0,
					"data-middle-truncate-within": !0,
					className: "min-w-0 shrink cursor-pointer truncate text-left text-body-regular hover:text-text-secondary",
					children: x(e.name, t)
				}), e.is_largest || e.is_longest ? /* @__PURE__ */ (0, B.jsxs)("span", {
					className: "flex flex-none gap-1",
					children: [e.is_largest ? /* @__PURE__ */ (0, B.jsx)("i", {
						className: `${W} not-italic bg-background-primary-hover text-text-secondary`,
						children: F("cleanup:duplicates.largest")
					}) : null, e.is_longest ? /* @__PURE__ */ (0, B.jsx)("i", {
						className: `${W} not-italic bg-(--keep)/22 text-(--keep)`,
						children: F("cleanup:duplicates.longest")
					}) : null]
				}) : null]
			}),
			/* @__PURE__ */ (0, B.jsxs)("span", {
				className: `${K} flex min-w-0 items-center gap-1.5`,
				children: [/* @__PURE__ */ (0, B.jsx)(f, { mark: l[e.location] || "database" }), /* @__PURE__ */ (0, B.jsx)("span", {
					title: i,
					className: "min-w-0 truncate",
					children: i
				})]
			}),
			/* @__PURE__ */ (0, B.jsx)("span", {
				className: K,
				children: D(e.size || 0)
			}),
			/* @__PURE__ */ (0, B.jsx)("span", {
				className: K,
				children: E(e.duration)
			}),
			/* @__PURE__ */ (0, B.jsx)("span", {
				className: `${K} col-start-2 -col-end-1 min-w-0 pt-0.5 wrap-anywhere max-duplicate-narrow:col-span-full`,
				children: e.path ?? ""
			})
		]
	});
}
function X({ openItem: l, toast: f, failure: p }) {
	let m = L({
		queryKey: n,
		queryFn: ({ signal: e }) => w(e)
	}), v = L({
		queryKey: c,
		queryFn: ({ signal: e }) => T(e)
	}), [x, E] = (0, z.useState)(""), A = I({
		mutationFn: (e) => h(e, "dispose"),
		onSuccess: (e, t) => {
			q(), f(F("cleanup:duplicates.movedToTrash", { count: t.length }), { undo: async () => {
				try {
					await h(t, "restore");
				} catch (e) {
					p(F("cleanup:duplicates.undoTrash"), e);
				} finally {
					q();
				}
			} });
		},
		onSettled: () => E("")
	}), j = I({
		mutationFn: (e) => O(e.files.map((e) => e.id), !0),
		onSuccess: (e, t) => {
			q(), f(F("cleanup:duplicates.keptAll", { code: t.code }), { undo: async () => {
				try {
					await O(t.files.map((e) => e.id), !1);
				} catch (e) {
					p(F("cleanup:duplicates.undoKeepAll"), e);
				} finally {
					q();
				}
			} });
		},
		onError: (e) => p(F("cleanup:duplicates.markKeepAll"), e),
		onSettled: () => E("")
	}), M = m.data;
	if (!M) return /* @__PURE__ */ (0, B.jsx)("div", {
		className: "mx-auto w-full max-w-board",
		children: /* @__PURE__ */ (0, B.jsx)(u, {
			tone: "error",
			title: F("cleanup:duplicates.loadFailed"),
			children: m.error ? C(m.error) : F("cleanup:duplicates.listUnavailable")
		})
	});
	let P = M.groups ?? [], V = y(v.data), W = ({ groups: e, keep: t, key: n }) => {
		if (A.isPending) return;
		let r = S(e, t);
		r.length && b({
			title: F("cleanup:duplicates.moveToTrash"),
			body: F("cleanup:duplicates.trashBody", {
				count: r.length,
				keep: o[t] ?? o.largest,
				size: D(R(e, r))
			}),
			confirmLabel: F("cleanup:duplicates.moveToTrash"),
			onConfirm: () => (E(n), A.mutateAsync(r))
		});
	}, K = (e) => _(x === e && (A.isPending || j.isPending)), X = (e, t) => {
		j.isPending || A.isPending || (E(t), j.mutate(e));
	};
	return /* @__PURE__ */ (0, B.jsxs)("div", {
		className: "mx-auto w-full max-w-board pb-10.5",
		children: [
			/* @__PURE__ */ (0, B.jsx)(t, {
				label: F("cleanup:duplicates.summaryLabel"),
				figure: F("cleanup:duplicates.groupCount", { count: Number(M.total || 0) }),
				detail: F("cleanup:duplicates.summaryDetail", {
					count: Number(M.files || 0),
					size: D(M.reclaimable)
				})
			}),
			P.length ? /* @__PURE__ */ (0, B.jsxs)(i, {
				title: F("cleanup:duplicates.bulkKeep"),
				children: [
					/* @__PURE__ */ (0, B.jsx)(a, {
						busy: x === "all:largest",
						onPress: () => W({
							groups: P,
							keep: "largest",
							key: "all:largest"
						}),
						children: F("cleanup:duplicates.allKeepLargest")
					}),
					/* @__PURE__ */ (0, B.jsx)(a, {
						busy: x === "all:longest",
						onPress: () => W({
							groups: P,
							keep: "longest",
							key: "all:longest"
						}),
						children: F("cleanup:duplicates.allKeepLongest")
					}),
					g(P, V).map((e) => /* @__PURE__ */ (0, B.jsx)(a, {
						busy: x === `all:${e}`,
						onPress: () => W({
							groups: P,
							keep: e,
							key: `all:${e}`
						}),
						children: /* @__PURE__ */ (0, B.jsx)(d, {
							source: e,
							label: F("cleanup:duplicates.allPreferStorage", { storage: s[e] || e })
						})
					}, e))
				]
			}) : null,
			A.isError ? /* @__PURE__ */ (0, B.jsx)("div", {
				className: "mb-5",
				children: /* @__PURE__ */ (0, B.jsx)(u, {
					tone: "error",
					title: F("cleanup:duplicates.trashFailed"),
					children: C(A.error)
				})
			}) : null,
			P.length ? P.map((t, n) => {
				let r = [t], i = N(t.files.map((e) => e.name)), a = (e) => `${n}:${e}`;
				return /* @__PURE__ */ (0, B.jsxs)("section", {
					"aria-label": t.code,
					className: U,
					children: [/* @__PURE__ */ (0, B.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 bg-background-tertiary-default p-5 max-compact:p-4 dark:bg-background-secondary-default",
						children: [
							/* @__PURE__ */ (0, B.jsx)("b", {
								className: "text-title-2-medium text-text-primary",
								children: t.code
							}),
							/* @__PURE__ */ (0, B.jsx)("span", {
								className: "font-mono text-caption-1-regular leading-5 text-text-primary",
								children: F("cleanup:duplicates.groupDetail", {
									count: Number(t.count || 0),
									size: D(t.reclaimable)
								})
							}),
							J(t),
							t.cross_drive ? /* @__PURE__ */ (0, B.jsx)("span", {
								className: `${G} text-text-secondary`,
								children: F("cleanup:duplicates.crossDrive", { drives: t.drives.join(" ") })
							}) : null,
							/* @__PURE__ */ (0, B.jsxs)("span", {
								className: "ml-auto flex flex-wrap gap-2 max-compact:ml-0 max-compact:w-full",
								children: [
									/* @__PURE__ */ (0, B.jsx)(e, {
										variant: "secondary",
										size: "small",
										...K(a("largest")),
										onClick: () => W({
											groups: r,
											keep: "largest",
											key: a("largest")
										}),
										children: F("cleanup:duplicates.keepLargest")
									}),
									/* @__PURE__ */ (0, B.jsx)(e, {
										variant: "secondary",
										size: "small",
										...K(a("longest")),
										onClick: () => W({
											groups: r,
											keep: "longest",
											key: a("longest")
										}),
										children: F("cleanup:duplicates.keepLongest")
									}),
									k(t.files, V).map((t) => /* @__PURE__ */ (0, B.jsx)(e, {
										variant: "secondary",
										size: "small",
										...K(a(t)),
										onClick: () => W({
											groups: r,
											keep: t,
											key: a(t)
										}),
										children: /* @__PURE__ */ (0, B.jsx)(d, {
											source: t,
											label: F("cleanup:duplicates.keepStorage", { storage: s[t] || t })
										})
									}, t)),
									/* @__PURE__ */ (0, B.jsx)(e, {
										variant: "secondary",
										size: "small",
										...K(a("keep")),
										onClick: () => X(t, a("keep")),
										children: F("cleanup:duplicates.keepAll")
									}),
									/* @__PURE__ */ (0, B.jsx)(e, {
										variant: "danger",
										size: "small",
										...K(a("all")),
										onClick: () => W({
											groups: r,
											keep: "all",
											key: a("all")
										}),
										children: F("cleanup:duplicates.trashGroup")
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, B.jsx)("div", { children: t.files.map((e) => /* @__PURE__ */ (0, B.jsx)(Y, {
						file: e,
						prefix: i,
						openItem: l
					}, e.id)) })]
				}, `${t.code}-${n}`);
			}) : /* @__PURE__ */ (0, B.jsx)(r, {
				icon: H,
				title: F("cleanup:duplicates.emptyTitle"),
				children: F("cleanup:duplicates.emptyBody")
			}),
			P.length > 0 && M.total > P.length ? /* @__PURE__ */ (0, B.jsx)("p", {
				className: "text-center text-caption-1-regular text-text-secondary",
				children: F("cleanup:duplicates.topGroups", {
					shown: P.length.toLocaleString(),
					count: Number(M.total)
				})
			}) : null,
			M.kept ? /* @__PURE__ */ (0, B.jsx)("p", {
				className: "mt-2 text-center text-caption-1-regular text-text-secondary",
				children: F("cleanup:duplicates.keptHidden", { count: M.kept })
			}) : null
		]
	});
}
export { X as DuplicatesPage };

//# debugId=fd02a663-3896-4907-9ebc-706fbd897c5c