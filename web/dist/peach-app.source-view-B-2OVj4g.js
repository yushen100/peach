(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "33ed7609-a10a-4a21-a0e6-6a50da7458c3", e._sentryDebugIdIdentifier = "sentry-dbid-33ed7609-a10a-4a21-a0e6-6a50da7458c3");
	} catch {}
})();
import { Button as e, Chip as t, Wt as n, __toESM as r, authorAvatar as i, authorInitial as a, errorHeadline as o, isBroken as s, require_jsx_runtime as c, require_react as l, sourceIconUrl as u, statusText as d, t as f } from "./peach-app.js";
import { MarkImage as p } from "./peach-app.site-mark-D_VlIyJz.js";
// src/react/follow-manage/source-view.tsx
var m = /* @__PURE__ */ r(l(), 1), h = c();
function g({ provider: e }) {
	return /* @__PURE__ */ (0, h.jsx)(p, { src: u(e) });
}
function _({ group: e, name: t }) {
	let { src: n, fallback: r } = i(e), [o, s] = (0, m.useState)(0), c = [n, r].filter(Boolean)[o];
	return c ? /* @__PURE__ */ (0, h.jsx)("img", {
		src: c,
		alt: "",
		width: 32,
		height: 32,
		loading: "lazy",
		referrerPolicy: "no-referrer",
		onError: () => s(o + 1),
		className: "size-8 shrink-0 rounded-full bg-media-placeholder object-cover"
	}) : /* @__PURE__ */ (0, h.jsx)("span", {
		title: f("follow:sourceView.noAvatar"),
		className: "inline-grid size-8 shrink-0 place-items-center rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary",
		children: a(t)
	});
}
function v({ source: e }) {
	let n = !e.enabled || e.history_exhausted ? "gray" : s(e) ? "rose" : e.enabled && e.last_status === "ok" ? "lime" : e.enabled ? "yellow" : "gray";
	return /* @__PURE__ */ (0, h.jsx)(t, {
		variant: "caption",
		color: n,
		children: d(e)
	});
}
function y({ source: e }) {
	return /* @__PURE__ */ (0, h.jsxs)("a", {
		href: e.url,
		target: "_blank",
		rel: "noopener noreferrer",
		title: f("follow:sourceView.openSource"),
		className: "max-w-full min-w-0 self-start text-body-medium wrap-anywhere text-text-primary underline-offset-2 hover:underline",
		children: [e.label, /* @__PURE__ */ (0, h.jsx)(n, {
			"aria-hidden": !0,
			className: "size-(--icon-inline) shrink-0"
		})]
	});
}
function b({ text: t, prefix: n = "", tone: r = "error" }) {
	let i = (0, m.useRef)(null), [a, s] = (0, m.useState)(!1), [c, l] = (0, m.useState)(!1), u = o(t);
	(0, m.useLayoutEffect)(() => {
		let e = i.current;
		if (!e || a) return;
		let t = () => l(e.scrollWidth > e.clientWidth + 1);
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}, [u, a]);
	let d = c || u !== String(t || "").trim();
	return /* @__PURE__ */ (0, h.jsxs)("span", {
		className: "flex min-w-0 max-w-full flex-col items-start gap-0.5",
		children: [/* @__PURE__ */ (0, h.jsxs)("small", {
			ref: i,
			"data-error-line": "",
			className: `max-w-full text-caption-1-regular ${r === "error" ? "text-text-error-primary" : "text-text-secondary"} ${a ? "whitespace-pre-line wrap-anywhere" : "block truncate"}`,
			children: [n, a ? t : u]
		}), d ? /* @__PURE__ */ (0, h.jsx)(e, {
			variant: "ghost",
			size: "small",
			"data-error-line-toggle": "",
			"data-error-details-toggle": "",
			"aria-expanded": a,
			className: "-ml-2",
			onClick: () => s(!a),
			children: f(a ? "follow:sourceView.hideDetails" : "follow:sourceView.showDetails")
		}) : null]
	});
}
export { _ as AuthorAvatar, b as ErrorLine, g as SourceIcon, y as SourceLink, v as StatusBadge };

//# debugId=33ed7609-a10a-4a21-a0e6-6a50da7458c3