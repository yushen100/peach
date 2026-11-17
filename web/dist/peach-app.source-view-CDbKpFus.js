(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "bd0b03ea-421f-4824-b8e0-2ee0713e21f8", e._sentryDebugIdIdentifier = "sentry-dbid-bd0b03ea-421f-4824-b8e0-2ee0713e21f8");
	} catch {}
})();
import { Button as e, Chip as t, ColumnFilterAvatar as n, MarkImage as r, Wt as i, __toESM as a, authorAvatar as o, authorInitial as s, authorPortrait as c, errorHeadline as l, isBroken as u, require_jsx_runtime as d, require_react as f, sourceIconUrl as p, statusText as m, t as h } from "./peach-app.js";
// src/react/follow-manage/source-view.tsx
var g = /* @__PURE__ */ a(f(), 1), _ = d();
function v({ provider: e }) {
	return /* @__PURE__ */ (0, _.jsx)(r, { src: p(e) });
}
function y({ group: e, name: t, small: r = !1 }) {
	let { src: i, fallback: a } = o(e), [l, u] = (0, g.useState)(0), d = c(e);
	if (d) return /* @__PURE__ */ (0, _.jsx)(n, {
		person: d,
		kind: "creator",
		size: r ? "small" : "medium"
	});
	let f = [i, a].filter(Boolean)[l];
	return f ? /* @__PURE__ */ (0, _.jsx)("img", {
		src: f,
		alt: "",
		width: r ? 24 : 32,
		height: r ? 24 : 32,
		loading: "lazy",
		referrerPolicy: "no-referrer",
		onError: () => u(l + 1),
		className: `${r ? "size-6" : "size-8"} shrink-0 rounded-full bg-media-placeholder object-cover`
	}) : /* @__PURE__ */ (0, _.jsx)("span", {
		title: h("follow:sourceView.noAvatar"),
		className: `inline-grid ${r ? "size-6" : "size-8"} shrink-0 place-items-center rounded-full bg-media-placeholder text-caption-1-semibold text-text-secondary`,
		children: s(t)
	});
}
function b({ source: e }) {
	let n = !e.enabled || e.history_exhausted ? "gray" : u(e) ? "rose" : e.enabled && e.last_status === "ok" ? "lime" : e.enabled ? "yellow" : "gray";
	return /* @__PURE__ */ (0, _.jsx)(t, {
		variant: "caption",
		color: n,
		children: m(e)
	});
}
function x({ source: e }) {
	return /* @__PURE__ */ (0, _.jsxs)("a", {
		href: e.url,
		target: "_blank",
		rel: "noopener noreferrer",
		title: h("follow:sourceView.openSource"),
		className: "max-w-full min-w-0 self-start text-body-medium wrap-anywhere text-text-primary underline-offset-2 hover:underline",
		children: [e.label, /* @__PURE__ */ (0, _.jsx)(i, {
			"aria-hidden": !0,
			className: "size-(--icon-inline) shrink-0"
		})]
	});
}
function S({ text: t, prefix: n = "", tone: r = "error" }) {
	let i = (0, g.useRef)(null), [a, o] = (0, g.useState)(!1), [s, c] = (0, g.useState)(!1), u = l(t);
	(0, g.useLayoutEffect)(() => {
		let e = i.current;
		if (!e || a) return;
		let t = () => c(e.scrollWidth > e.clientWidth + 1);
		t();
		let n = new ResizeObserver(t);
		return n.observe(e), () => n.disconnect();
	}, [u, a]);
	let d = s || u !== String(t || "").trim();
	return /* @__PURE__ */ (0, _.jsxs)("span", {
		className: "flex min-w-0 max-w-full flex-col items-start gap-0.5",
		children: [/* @__PURE__ */ (0, _.jsxs)("small", {
			ref: i,
			"data-error-line": "",
			className: `max-w-full text-caption-1-regular ${r === "error" ? "text-text-error-primary" : "text-text-secondary"} ${a ? "whitespace-pre-line wrap-anywhere" : "block truncate"}`,
			children: [n, a ? t : u]
		}), d ? /* @__PURE__ */ (0, _.jsx)(e, {
			variant: "ghost",
			size: "small",
			"data-error-line-toggle": "",
			"data-error-details-toggle": "",
			"aria-expanded": a,
			className: "-ml-2",
			onClick: () => o(!a),
			children: h(a ? "follow:sourceView.hideDetails" : "follow:sourceView.showDetails")
		}) : null]
	});
}
export { y as AuthorAvatar, S as ErrorLine, v as SourceIcon, x as SourceLink, b as StatusBadge };

//# debugId=bd0b03ea-421f-4824-b8e0-2ee0713e21f8