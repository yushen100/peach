(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "c0cdcf9b-ccf6-4779-b43f-ff7cc2daf4c5", e._sentryDebugIdIdentifier = "sentry-dbid-c0cdcf9b-ccf6-4779-b43f-ff7cc2daf4c5");
	} catch {}
})();
import { Button as e, Chip as t, MarkImage as n, Wt as r, __toESM as i, authorAvatar as a, authorInitial as o, errorHeadline as s, isBroken as c, require_jsx_runtime as l, require_react as u, sourceIconUrl as d, statusText as f, t as p } from "./peach-app.js";
// src/react/follow-manage/source-view.tsx
var m = /* @__PURE__ */ i(u(), 1), h = l();
function g({ provider: e }) {
	return /* @__PURE__ */ (0, h.jsx)(n, { src: d(e) });
}
function _({ group: e, name: t }) {
	let { src: n, fallback: r } = a(e), [i, s] = (0, m.useState)(0), c = [n, r].filter(Boolean)[i];
	return c ? /* @__PURE__ */ (0, h.jsx)("img", {
		src: c,
		alt: "",
		width: 32,
		height: 32,
		loading: "lazy",
		referrerPolicy: "no-referrer",
		onError: () => s(i + 1),
		className: "size-8 shrink-0 rounded-full bg-media-placeholder object-cover"
	}) : /* @__PURE__ */ (0, h.jsx)("span", {
		title: p("follow:sourceView.noAvatar"),
		className: "inline-grid size-8 shrink-0 place-items-center rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary",
		children: o(t)
	});
}
function v({ source: e }) {
	let n = !e.enabled || e.history_exhausted ? "gray" : c(e) ? "rose" : e.enabled && e.last_status === "ok" ? "lime" : e.enabled ? "yellow" : "gray";
	return /* @__PURE__ */ (0, h.jsx)(t, {
		variant: "caption",
		color: n,
		children: f(e)
	});
}
function y({ source: e }) {
	return /* @__PURE__ */ (0, h.jsxs)("a", {
		href: e.url,
		target: "_blank",
		rel: "noopener noreferrer",
		title: p("follow:sourceView.openSource"),
		className: "max-w-full min-w-0 self-start text-body-medium wrap-anywhere text-text-primary underline-offset-2 hover:underline",
		children: [e.label, /* @__PURE__ */ (0, h.jsx)(r, {
			"aria-hidden": !0,
			className: "size-(--icon-inline) shrink-0"
		})]
	});
}
function b({ text: t, prefix: n = "", tone: r = "error" }) {
	let i = (0, m.useRef)(null), [a, o] = (0, m.useState)(!1), [c, l] = (0, m.useState)(!1), u = s(t);
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
			onClick: () => o(!a),
			children: p(a ? "follow:sourceView.hideDetails" : "follow:sourceView.showDetails")
		}) : null]
	});
}
export { _ as AuthorAvatar, b as ErrorLine, g as SourceIcon, y as SourceLink, v as StatusBadge };

//# debugId=c0cdcf9b-ccf6-4779-b43f-ff7cc2daf4c5