(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "14b41d0b-83b5-474f-a05f-b16030f36fda", e._sentryDebugIdIdentifier = "sentry-dbid-14b41d0b-83b5-474f-a05f-b16030f36fda");
	} catch {}
})();
import { Button as e, CLOUD_LOCATIONS as t, ErrorText as n, Help as r, IconButton as i, Input as a, Label as o, M6 as s, MEDIA_SOURCE_ICONS as c, MEDIA_SOURCE_OPTIONS as l, Select$1 as u, SelectItem as d, SourceMark as f, __toESM as p, busyProps as m, cx as h, require_jsx_runtime as g, require_react as _, t as v } from "./peach-app.js";
// src/react/settings/folder-rows.tsx
var y = /* @__PURE__ */ p(_(), 1), b = g();
function x({ className: e }) {
	return /* @__PURE__ */ (0, b.jsx)("svg", {
		"aria-hidden": !0,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 2,
		strokeLinecap: "round",
		strokeLinejoin: "round",
		className: e,
		children: /* @__PURE__ */ (0, b.jsx)("use", { href: "#i-folder-search" })
	});
}
var S = l, C = (e) => c[e] || "database", w = (e) => t.includes(e);
function T({ label: e, className: t, children: n }) {
	return /* @__PURE__ */ (0, b.jsxs)("div", {
		className: h("flex min-w-0 flex-col gap-1", t),
		children: [/* @__PURE__ */ (0, b.jsx)(o, {
			elementType: "span",
			"aria-hidden": !0,
			children: e
		}), n]
	});
}
function E({ children: e }) {
	return /* @__PURE__ */ (0, b.jsx)("div", {
		className: "flex w-full flex-wrap items-start gap-2",
		children: e
	});
}
function D({ index: e, cost: t, error: r, onChange: i }) {
	return /* @__PURE__ */ (0, b.jsxs)("div", {
		"data-media-read-policy": e,
		className: "flex w-full flex-col gap-1 @lg:w-32",
		children: [
			/* @__PURE__ */ (0, b.jsx)(o, {
				elementType: "span",
				"aria-hidden": !0,
				children: v("settings:folderRow.readPolicy")
			}),
			/* @__PURE__ */ (0, b.jsxs)(u, {
				"aria-label": v("settings:folderRow.readPolicyNumbered", { index: e + 1 }),
				placeholder: v("settings:folderRow.chooseReadPolicy"),
				isRequired: !0,
				validationBehavior: "aria",
				isInvalid: !!r,
				selectedKey: t || null,
				onSelectionChange: (e) => {
					(e === "free" || e === "metered") && i(e);
				},
				children: [/* @__PURE__ */ (0, b.jsx)(d, {
					id: "free",
					children: v("settings:folderRow.readNormal")
				}), /* @__PURE__ */ (0, b.jsx)(d, {
					id: "metered",
					children: v("settings:folderRow.readDataSaver")
				})]
			}),
			r ? /* @__PURE__ */ (0, b.jsx)(n, { children: r }) : null
		]
	});
}
function O() {
	return /* @__PURE__ */ (0, b.jsx)(r, { children: v("settings:folderRow.readPolicyHelp") });
}
function k({ initial: e, blank: t, pickFolder: n, describe: r, focusAfterPick: i = !1 }) {
	let [a, o] = (0, y.useState)(e), [s, c] = (0, y.useState)([]), [l, u] = (0, y.useState)(null), [d, f] = (0, y.useState)(null), p = (0, y.useRef)(!1), m = (0, y.useRef)([]);
	(0, y.useLayoutEffect)(() => {
		l !== null && (m.current[l]?.focus(), u(null));
	}, [l]);
	let h = (e, t) => o((n) => n.map((n, r) => r === e ? {
		...n,
		...t
	} : n)), g = (e, t) => c((n) => {
		let r = [...n];
		for (; r.length <= e;) r.push("");
		return r[e] = t, r;
	});
	return {
		rows: a,
		edit: h,
		add: () => {
			u(a.length), o((e) => [...e, t()]);
		},
		remove: (e) => {
			o((t) => t.filter((t, n) => n !== e)), c((t) => t.filter((t, n) => n !== e));
		},
		errors: s,
		setErrors: c,
		picking: d,
		pick: async (e) => {
			if (!p.current) {
				p.current = !0, f(e);
				try {
					let t = await n(a[e]?.path ?? "");
					t && (h(e, { path: t }), g(e, "")), i && u(e);
				} catch (t) {
					g(e, r(t));
				} finally {
					p.current = !1, f(null);
				}
			}
		},
		inputRef: (e) => (t) => {
			m.current[e] = t;
		}
	};
}
function A({ label: t, path: n, onPath: r, error: o, inputRef: c, picking: l, onPick: u, onRemove: d, status: f, children: p }) {
	let h = (0, y.useRef)(null), g = () => {
		let e = h.current;
		e && e.ownerDocument.activeElement !== e && (e.scrollLeft = e.scrollWidth);
	};
	return (0, y.useLayoutEffect)(() => {
		h.current && (h.current.title = n), g();
	}, [n]), /* @__PURE__ */ (0, b.jsxs)("div", {
		"data-folder-row": !0,
		className: "@container flex flex-col gap-2 rounded-2lg border border-separator-border bg-background-primary-default p-3",
		children: [/* @__PURE__ */ (0, b.jsxs)("div", {
			className: "flex items-start gap-2",
			children: [
				/* @__PURE__ */ (0, b.jsx)(a, {
					className: "min-w-0 flex-1",
					"aria-label": t,
					placeholder: v("settings:folderRow.pathPlaceholder"),
					value: n,
					onChange: r,
					ref: (e) => {
						h.current = e, c(e);
					},
					onBlur: () => requestAnimationFrame(g),
					validationBehavior: "aria",
					isInvalid: !!o,
					hint: o || void 0
				}),
				f ? /* @__PURE__ */ (0, b.jsx)("div", {
					className: "flex h-9 shrink-0 items-center",
					children: f
				}) : null,
				/* @__PURE__ */ (0, b.jsx)(i, {
					icon: x,
					"aria-label": v("settings:folderRow.pickDirectory"),
					onClick: u,
					...m(l)
				}),
				d ? /* @__PURE__ */ (0, b.jsx)(e, {
					variant: "danger",
					iconOnly: !0,
					leadingIcon: s,
					"aria-label": v("settings:folderRow.removeDirectory"),
					onClick: d
				}) : null
			]
		}), /* @__PURE__ */ (0, b.jsx)("div", {
			className: "flex flex-wrap items-end gap-2",
			children: p
		})]
	});
}
function j({ index: e, value: t, onChange: n, options: r = S }) {
	return /* @__PURE__ */ (0, b.jsx)(T, {
		label: v("settings:folderRow.storage"),
		className: "w-full @lg:w-60",
		children: /* @__PURE__ */ (0, b.jsx)(u, {
			className: "w-full",
			"aria-label": v("settings:folderRow.storageNumbered", { index: e + 1 }),
			selectedKey: t,
			onSelectionChange: (e) => {
				e !== null && n(String(e));
			},
			children: r.map(([e, t]) => /* @__PURE__ */ (0, b.jsxs)(d, {
				id: e,
				textValue: t,
				children: [/* @__PURE__ */ (0, b.jsx)(f, { mark: C(e) }), t]
			}, e))
		})
	});
}
export { T as FolderField, E as FolderFieldLine, A as FolderRow, x as FolderSearchIcon, S as MEDIA_SOURCES, D as MediaReadPolicy, O as MediaReadPolicyHelp, j as SourceSelect, w as isCloudSource, C as sourceMark, k as useFolderRows };

//# debugId=14b41d0b-83b5-474f-a05f-b16030f36fda