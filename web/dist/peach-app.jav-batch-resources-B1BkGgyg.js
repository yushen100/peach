(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "f4a50522-eeec-4b45-8cac-a5f679723f23", e._sentryDebugIdIdentifier = "sentry-dbid-f4a50522-eeec-4b45-8cac-a5f679723f23");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, Button as t, DOWNLOADS_KEY as n, DOWNLOADS_URL as r, ModalFrame as i, Note as a, P7 as o, WantMagnets as s, apiGet as c, errorMessage as l, require_jsx_runtime as u, t as d, useQuery as f } from "./peach-app.js";
// src/react/jav/jav-batch-resources.tsx
var p = u();
function m({ items: u, close: m, readOnly: h, receipt: g }) {
	let _ = f({
		queryKey: n,
		queryFn: ({ signal: e }) => c(`${r}?limit=50`, e),
		enabled: !!u
	}), v = _.data?.providers.find((e) => e.configured)?.key || "";
	return /* @__PURE__ */ (0, p.jsxs)(i, {
		isOpen: !!u,
		onOpenChange: (e) => {
			e || m();
		},
		width: "collections",
		children: [/* @__PURE__ */ (0, p.jsxs)("div", {
			className: "sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-separator-border bg-background-full px-5 py-4",
			children: [/* @__PURE__ */ (0, p.jsxs)(e, {
				slot: "title",
				className: "text-title-2-medium text-text-primary",
				children: [
					/* @__PURE__ */ (0, p.jsx)("span", {
						"data-copy-key": "jav.resources.title",
						children: d("catalog:javBatch.title")
					}),
					" · ",
					d("catalog:countLabel.works", { count: u?.length || 0 })
				]
			}), /* @__PURE__ */ (0, p.jsx)(t, {
				iconOnly: !0,
				variant: "ghost",
				leadingIcon: o,
				"aria-label": d("catalog:javBatch.close"),
				onClick: m
			})]
		}), /* @__PURE__ */ (0, p.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-6 p-5",
			children: [_.error ? /* @__PURE__ */ (0, p.jsx)(a, {
				tone: "error",
				children: d("catalog:javBatch.downloadSettingsFailed", { error: l(_.error) })
			}) : null, u?.map((e) => /* @__PURE__ */ (0, p.jsxs)("section", {
				"aria-label": e.code,
				className: "flex min-w-0 flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, p.jsx)("h3", {
						className: "text-headline-medium text-text-primary",
						children: e.code
					}),
					e.title ? /* @__PURE__ */ (0, p.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: e.title
					}) : null,
					/* @__PURE__ */ (0, p.jsx)(s, {
						want: {
							id: e.id,
							code: e.code,
							title: e.title,
							release_date: e.release_date || null
						},
						queryUrl: `/api/jav/resources?code=${encodeURIComponent(e.code)}`,
						eager: !0,
						readOnly: h,
						downloads: _.data,
						provider: v,
						toast: g
					})
				]
			}, e.code))]
		})]
	});
}
export { m as JavBatchResources };

//# debugId=f4a50522-eeec-4b45-8cac-a5f679723f23