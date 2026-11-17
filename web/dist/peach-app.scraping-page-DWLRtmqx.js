(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "093b4a69-4d36-42c5-a56f-98c6008f38b3", e._sentryDebugIdIdentifier = "sentry-dbid-093b4a69-4d36-42c5-a56f-98c6008f38b3");
	} catch {}
})();
import { $fe21c36db05242bb$export$d7b12c4107be0d61 as e, AMANE_BRIDGE_CHECK_URL as t, AMANE_BRIDGE_KEY as n, AMANE_BRIDGE_REBUILD_URL as r, Button as i, CHECK_ALL_KEY as a, COVER_JOB_KEY as o, CUSTOM_SOURCES_KEY as s, CUSTOM_SOURCES_URL as c, Checkbox as l, Disclosure as u, ErrorText as d, ExternalLink as f, Fact as p, FactList as m, FieldLabel as h, Footer as g, Help as _, Input as v, IssueRow as y, LinkButton as ee, Note as b, PillTabList as x, Rows as te, SCRAPING_CHECK_ALL_URL as S, SCRAPING_CHECK_URL as ne, SCRAPING_COVER_URL as C, SCRAPING_KEY as w, SCRAPING_SETTINGS_URL as re, SEGMENT as ie, SEGMENTED_TRACK as ae, Section as T, SegmentedRadioGroup as oe, Select$1 as se, SelectField as E, SelectItem as ce, SettingsRow as le, SiteMark as D, Stack as O, StatusLabel as k, TaskProgress as A, __toESM as j, activityKind as M, apiSend as N, busyProps as P, checkText as ue, codedText as F, composingKey as de, confirmModal as fe, cx as I, errorMessage as L, esc as R, fetchAmaneBridge as z, fetchCheckAllJob as B, fetchCoverJob as pe, fetchCustomSources as me, fetchSources as he, i2 as ge, interfaceLanguage as _e, jobText as V, joinList as ve, momentText as ye, partsLabel as be, queryClient as H, require_jsx_runtime as xe, require_react as Se, serverLabel as Ce, spinnerHtml as we, t as U, useAction as W, useBackgroundJob as G, useHorizontalScroller as Te, useMutation as K, useQuery as Ee } from "./peach-app.js";
import { ConnectionStatus as De } from "./peach-app.connection-status-BrXhLGSm.js";
import { Page as q } from "./peach-app.page-QAncjzM1.js";
import { CodeBlock as Oe } from "./peach-app.code-block-CXu10nIP.js";
// src/react/components/section-toc.css
var J = /* @__PURE__ */ j(Se(), 1), Y = xe();
function ke({ label: e, entries: t, children: n }) {
	let r = (0, J.useRef)(null), i = Te(), [a, o] = (0, J.useState)(t[0]?.id ?? ""), s = JSON.stringify(t.map((e) => e.id));
	return (0, J.useEffect)(() => {
		let e = 0, t = JSON.parse(s).map((e) => document.getElementById(e)).filter((e) => !!e), n = () => {
			e = 0;
			let n = t[0]?.id ?? "";
			for (let e of t) {
				let t = parseFloat(getComputedStyle(e).scrollMarginTop) + parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
				e.getBoundingClientRect().top <= t + 1 && (n = e.id);
			}
			window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2 && (n = t.at(-1)?.id ?? n), o(n);
		}, i = () => {
			e ||= requestAnimationFrame(n);
		}, a = document.getElementById(location.hash.slice(1));
		a && r.current?.contains(a) && a.scrollIntoView({ block: "start" }), n(), window.addEventListener("scroll", i, { passive: !0 }), window.addEventListener("resize", i);
		let c = new ResizeObserver(i);
		return c.observe(r.current), () => {
			window.removeEventListener("scroll", i), window.removeEventListener("resize", i), c.disconnect(), cancelAnimationFrame(e);
		};
	}, [s]), (0, J.useEffect)(() => {
		let e = r.current?.querySelector("nav"), t = e?.querySelector("[aria-current]");
		e && t && (t.offsetTop < e.scrollTop ? e.scrollTop = t.offsetTop : t.offsetTop + t.offsetHeight > e.scrollTop + e.clientHeight && (e.scrollTop = t.offsetTop + t.offsetHeight - e.clientHeight), t.offsetLeft < e.scrollLeft ? e.scrollLeft = t.offsetLeft : t.offsetLeft + t.offsetWidth > e.scrollLeft + e.clientWidth && (e.scrollLeft = t.offsetLeft + t.offsetWidth - e.clientWidth));
	}, [a]), /* @__PURE__ */ (0, Y.jsxs)("div", {
		ref: r,
		"data-section-page": "",
		children: [/* @__PURE__ */ (0, Y.jsx)("nav", {
			ref: i,
			"aria-label": e,
			"data-section-toc": "",
			children: /* @__PURE__ */ (0, Y.jsx)(x, {
				"data-section-toc-items": "",
				"data-pill-nav": "",
				children: t.map((e) => /* @__PURE__ */ (0, Y.jsxs)("a", {
					href: `#${e.id}`,
					"aria-current": a === e.id ? "location" : void 0,
					"data-pill-selected": a === e.id ? "" : void 0,
					"data-pill-variant": "gray",
					className: I("relative z-1 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-body-regular text-text-secondary", "outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring", a === e.id && "text-text-primary"),
					children: [e.icon, /* @__PURE__ */ (0, Y.jsx)("span", { children: e.label })]
				}, e.id))
			})
		}), /* @__PURE__ */ (0, Y.jsx)("div", {
			"data-toc-content": "",
			className: "flex min-w-0 flex-col gap-8",
			children: n
		})]
	});
}
// src/react/scraping/custom-sources.tsx
var Ae = [
	["code", U("manage:shared.code")],
	["title", U("manage:shared.title")],
	["studio", U("manage:customSources.fieldStudio")],
	["series", U("manage:shared.series")],
	["release_date", U("manage:shared.releaseDate")],
	["performers", U("manage:customSources.fieldPerformers")],
	["tags", U("manage:customSources.fieldTags")]
], je = [
	["censored", U("manage:customSources.typeCensored")],
	["amateur", U("manage:customSources.typeAmateur")],
	["uncensored", U("manage:shared.uncensored")],
	["fc2", "FC2"],
	["kmib", U("manage:customSources.typeKoreanMib")],
	["other", U("manage:shared.other")],
	["unsure", U("manage:customSources.typeUnverifiedCode")],
	["unknown", U("manage:shared.unknown")]
], Me = () => ({
	name: "",
	endpoint: "",
	enabled: !1,
	fields: {
		code: "id",
		title: "title"
	},
	content_types: ["censored"]
});
function Ne({ receipt: e }) {
	let [t, n] = (0, J.useState)(null), r = Ee({
		queryKey: s,
		queryFn: ({ signal: e }) => me(e)
	}), a = W(), o = (e) => H.setQueryData(s, e), l = !!(r.isPending || r.error || r.data?.items.length || a.error), u = /* @__PURE__ */ (0, Y.jsx)(i, {
		variant: "secondary",
		onClick: () => n(Me()),
		children: U("manage:customSources.addSource")
	});
	return /* @__PURE__ */ (0, Y.jsxs)(T, {
		id: "custom-sources",
		title: U("manage:customSources.title"),
		children: [
			l ? /* @__PURE__ */ (0, Y.jsxs)(O, { children: [
				r.isPending ? /* @__PURE__ */ (0, Y.jsx)("div", {
					"aria-busy": "true",
					"data-skeleton": "",
					"aria-label": U("manage:customSources.loading")
				}) : null,
				r.error ? /* @__PURE__ */ (0, Y.jsx)(d, { children: L(r.error) }) : null,
				r.data?.items.map((t) => /* @__PURE__ */ (0, Y.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, Y.jsx)("span", {
							className: "min-w-0 flex-1",
							children: t.name
						}),
						/* @__PURE__ */ (0, Y.jsx)(k, {
							tone: t.enabled ? "success" : "neutral",
							children: t.enabled ? U("manage:customSources.enabled") : U("manage:customSources.disabled")
						}),
						/* @__PURE__ */ (0, Y.jsx)(i, {
							variant: "secondary",
							onClick: () => n(t),
							children: U("manage:shared.edit")
						}),
						/* @__PURE__ */ (0, Y.jsx)(i, {
							variant: "secondary",
							...P(a.busy === t.id),
							onClick: () => void a.run(t.id, (e) => N(c, {
								...t,
								enabled: !t.enabled
							}, "POST", e), (n) => {
								o(n), e(t.enabled ? U("manage:customSources.sourceDisabled") : U("manage:customSources.sourceEnabled"));
							}),
							children: t.enabled ? U("manage:customSources.disable") : U("manage:customSources.enable")
						}),
						/* @__PURE__ */ (0, Y.jsx)(i, {
							variant: "danger",
							onClick: () => fe({
								title: U("manage:customSources.deleteTitle"),
								body: U("manage:customSources.deleteBody", { name: R(t.name) }),
								confirmLabel: U("manage:customSources.deleteConfirm"),
								danger: !0,
								holdToConfirm: !0,
								onConfirm: async () => {
									o(await N(c, {
										action: "delete",
										id: t.id
									})), n(null), e(U("manage:customSources.deleted"));
								}
							}),
							children: U("manage:shared.delete")
						})
					]
				}, t.id)),
				a.error ? /* @__PURE__ */ (0, Y.jsx)(d, { children: a.error }) : null
			] }) : null,
			t ? null : l ? /* @__PURE__ */ (0, Y.jsx)(g, { children: u }) : /* @__PURE__ */ (0, Y.jsx)(O, { children: /* @__PURE__ */ (0, Y.jsx)("div", {
				className: "flex justify-end",
				children: u
			}) }),
			t ? /* @__PURE__ */ (0, Y.jsx)(Pe, {
				initial: t,
				cancel: () => n(null),
				saved: (t) => {
					o(t), n(null), e(U("manage:customSources.saved"));
				}
			}, t.id || "new") : null
		]
	});
}
function Pe({ initial: e, cancel: t, saved: n }) {
	let [r, a] = (0, J.useState)(e), [o, s] = (0, J.useState)(""), [u, f] = (0, J.useState)(""), p = (0, J.useRef)(0), m = W(), y = (e) => {
		p.current++, a((t) => ({
			...t,
			...e
		})), f("");
	};
	return /* @__PURE__ */ (0, Y.jsxs)("form", {
		"aria-label": U("manage:customSources.formLabel"),
		"aria-busy": m.busy === "preview",
		onSubmit: (e) => {
			e.preventDefault(), m.run("save", (e) => N(c, r, "POST", e), n);
		},
		children: [/* @__PURE__ */ (0, Y.jsxs)(O, { children: [
			/* @__PURE__ */ (0, Y.jsx)(v, {
				label: U("manage:customSources.name"),
				value: r.name,
				maxLength: 80,
				onChange: (e) => y({ name: e })
			}),
			/* @__PURE__ */ (0, Y.jsx)(v, {
				label: U("manage:customSources.endpoint"),
				value: r.endpoint,
				maxLength: 2048,
				placeholder: "https://example.com/api/movies/{code}",
				onChange: (e) => y({ endpoint: e })
			}),
			/* @__PURE__ */ (0, Y.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Y.jsx)(h, { children: U("manage:customSources.network") }), /* @__PURE__ */ (0, Y.jsx)(E, {
					id: "custom-source-network",
					label: U("manage:customSources.network"),
					epoch: 0,
					value: r.network || "direct",
					options: [["direct", U("manage:processingTraffic.connectionDirect")], ["peach_proxy", U("manage:customSources.peachProxy")]],
					onPick: (e) => y({ network: e })
				})]
			}),
			/* @__PURE__ */ (0, Y.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Y.jsx)(h, { children: U("manage:customSources.codeFormat") }), /* @__PURE__ */ (0, Y.jsx)(E, {
					id: "custom-source-code-format",
					label: U("manage:customSources.codeFormat"),
					epoch: 0,
					value: r.code_format || "original",
					options: [
						["original", U("manage:customSources.codeAsIs")],
						["lowercase", U("manage:customSources.codeLowercase")],
						["compact", U("manage:customSources.codeNoHyphens")],
						["underscore", U("manage:customSources.codeUnderscores")]
					],
					onPick: (e) => y({ code_format: e })
				})]
			}),
			/* @__PURE__ */ (0, Y.jsx)(_, { children: U("manage:customSources.help") }),
			Ae.map(([e, t]) => /* @__PURE__ */ (0, Y.jsx)(v, {
				label: U("manage:customSources.fieldPath", { field: t }),
				value: r.fields[e] || "",
				onChange: (t) => {
					let n = { ...r.fields };
					t ? n[e] = t : delete n[e], y({ fields: n });
				}
			}, e)),
			/* @__PURE__ */ (0, Y.jsx)("div", {
				className: "flex flex-wrap gap-3",
				role: "group",
				"aria-label": U("manage:customSources.contentTypes"),
				children: je.map(([e, t]) => /* @__PURE__ */ (0, Y.jsx)(l, {
					isSelected: r.content_types.includes(e),
					onChange: (t) => y({ content_types: t ? [...r.content_types, e] : r.content_types.filter((t) => t !== e) }),
					children: t
				}, e))
			}),
			/* @__PURE__ */ (0, Y.jsx)(l, {
				isSelected: r.enabled,
				onChange: (e) => y({ enabled: e }),
				children: U("manage:customSources.enableSource")
			}),
			/* @__PURE__ */ (0, Y.jsx)(v, {
				label: U("manage:customSources.testCode"),
				value: o,
				onChange: (e) => {
					p.current++, s(e), f("");
				},
				onKeyDown: (e) => {
					if (e.key !== "Enter" || de(e.nativeEvent)) return;
					e.preventDefault();
					let t = p.current;
					m.run("preview", (e) => N(c, {
						...r,
						code: o,
						action: "preview"
					}, "POST", e), (e) => {
						t === p.current && f(JSON.stringify(e.record, null, 2));
					}, (e) => {
						t === p.current && m.setError(L(e));
					});
				}
			}),
			m.busy === "preview" ? /* @__PURE__ */ (0, Y.jsxs)(_, {
				role: "status",
				children: [/* @__PURE__ */ (0, Y.jsx)("span", { dangerouslySetInnerHTML: { __html: we(U("manage:customSources.testing")) } }), U("manage:customSources.testing")]
			}) : null,
			u ? /* @__PURE__ */ (0, Y.jsx)(Oe, {
				code: u,
				language: "json",
				label: U("manage:customSources.response")
			}) : null,
			m.error ? /* @__PURE__ */ (0, Y.jsx)(d, { children: m.error }) : null
		] }), /* @__PURE__ */ (0, Y.jsxs)(g, { children: [/* @__PURE__ */ (0, Y.jsx)(i, {
			variant: "secondary",
			type: "button",
			onClick: t,
			children: U("manage:shared.cancel")
		}), /* @__PURE__ */ (0, Y.jsx)(i, {
			type: "submit",
			...P(m.busy === "save"),
			children: U("manage:customSources.saveSource")
		})] })]
	});
}
// src/react/scraping/scraping-page.tsx
var X = [["peach", U("manage:customSources.peachProxy")], ["direct", U("manage:sourceSettings.direct")]];
function Fe(e) {
	return X.some(([t]) => t === e) || !e ? [...X] : [...X, [e, e]];
}
function Ie(e) {
	try {
		return new URL(e).host || e;
	} catch {
		return e;
	}
}
var Z = [["paste", U("manage:sourceSettings.pasteCookie")], ["file", U("manage:sourceSettings.uploadFile")]];
function Le() {
	return /* @__PURE__ */ (0, Y.jsx)(D, { source: "github" });
}
function Re({ source: t, toast: n }) {
	let [r, a] = (0, J.useState)(t.network), [o, s] = (0, J.useState)(""), [c, l] = (0, J.useState)(""), [u, p] = (0, J.useState)(Z[0][0]), [m, _] = (0, J.useState)(""), [y, x] = (0, J.useState)(""), S = (0, J.useRef)(null);
	function C() {
		s(""), l(""), _(""), x(""), S.current && (S.current.value = "");
	}
	let E = K({
		mutationFn: (e) => N(re, {
			source: t.source,
			network: r,
			cookie: o,
			cookies_text: c,
			revoke: e
		}),
		onSuccess: (e, t) => {
			H.setQueryData(w, (t) => t && {
				...t,
				sources: t.sources.map((t) => t.source === e.saved.source ? e.saved : t)
			}), C(), n(U(t ? "manage:sourceSettings.cookieRevoked" : "manage:sourceSettings.saved"));
		}
	}), A = K({ mutationFn: () => N(ne, { source: t.source }) }), j = E.isPending || A.isPending, M = (e) => {
		e.preventDefault(), j || (A.reset(), E.mutate(!1));
	}, de = () => {
		j || (A.reset(), E.mutate(!0));
	}, fe = () => {
		j || (E.reset(), A.mutate());
	};
	async function I(e) {
		let t = e.currentTarget, n = t.files?.[0];
		if (l(""), x(""), !n) _("");
		else if (n.size > 262144) t.value = "", _(""), x(U("manage:sourceSettings.cookieTooLarge"));
		else try {
			let e = await n.text();
			l(e), _(n.name);
		} catch {
			x(U("manage:sourceSettings.cookieFileUnread"));
		}
	}
	let R = y || (E.error ? L(E.error) : "") || (A.error ? L(A.error) : ""), z = A.data?.results ?? [], B = r === "peach" || t.accepts_cookie || t.browser || !!R || z.length > 0;
	return /* @__PURE__ */ (0, Y.jsxs)(T, {
		id: `source-${t.source}`,
		title: F(t, "label"),
		onSubmit: M,
		aside: /* @__PURE__ */ (0, Y.jsxs)("span", {
			className: "flex min-w-0 items-center gap-1",
			children: [/* @__PURE__ */ (0, Y.jsx)(D, { source: t.source }), t.login ? /* @__PURE__ */ (0, Y.jsx)(f, {
				href: t.login,
				children: Ie(t.login)
			}) : null]
		}),
		children: [
			/* @__PURE__ */ (0, Y.jsx)(te, { children: /* @__PURE__ */ (0, Y.jsx)(le, {
				label: U("manage:sourceSettings.connectionMode"),
				children: /* @__PURE__ */ (0, Y.jsx)(se, {
					"aria-label": U("manage:sourceSettings.connectionMode"),
					className: "w-44 min-w-0",
					selectedKey: r,
					onSelectionChange: (e) => {
						e !== null && a(String(e));
					},
					children: Fe(r).map(([e, t]) => /* @__PURE__ */ (0, Y.jsx)(ce, {
						id: e,
						children: t
					}, e))
				})
			}) }),
			t.cooldown_until && t.cooldown_until > Date.now() / 1e3 ? /* @__PURE__ */ (0, Y.jsx)(b, {
				tone: "warning",
				children: /* @__PURE__ */ (0, Y.jsxs)("span", {
					className: "inline-flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, Y.jsx)(k, {
						tone: "warning",
						children: U("manage:sourceSettings.coolingDown")
					}), /* @__PURE__ */ (0, Y.jsx)("span", { children: U("manage:sourceSettings.retryAfter", { time: (/* @__PURE__ */ new Date(t.cooldown_until * 1e3)).toLocaleString(_e) }) })]
				})
			}) : null,
			B ? /* @__PURE__ */ (0, Y.jsxs)(O, {
				divided: !0,
				children: [
					r === "peach" ? /* @__PURE__ */ (0, Y.jsx)("span", {
						className: "self-start",
						children: /* @__PURE__ */ (0, Y.jsx)(ee, {
							href: "/settings/library#peachProxy",
							size: "small",
							trailingIcon: ge,
							children: U("manage:sourceSettings.setUpProxy")
						})
					}) : null,
					t.browser ? /* @__PURE__ */ (0, Y.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: U("manage:sourceSettings.browserVerification")
					}) : null,
					t.accepts_cookie && !t.browser ? /* @__PURE__ */ (0, Y.jsxs)(Y.Fragment, { children: [
						/* @__PURE__ */ (0, Y.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, Y.jsx)("span", {
								className: "self-start",
								children: /* @__PURE__ */ (0, Y.jsx)(k, {
									tone: t.cookie_saved ? "success" : "neutral",
									children: t.cookie_saved ? U("manage:sourceSettings.cookieSaved") : U("manage:sourceSettings.cookieNotSet")
								})
							}), /* @__PURE__ */ (0, Y.jsx)("p", {
								className: "text-body-2-regular text-text-secondary",
								children: t.cookie_saved ? U("manage:sourceSettings.signInUnverified") : U("manage:sourceSettings.provideCookieHint")
							})]
						}),
						/* @__PURE__ */ (0, Y.jsx)(oe, {
							"aria-label": U("manage:sourceSettings.cookieMethod"),
							value: u,
							onChange: (e) => {
								p(e), C();
							},
							className: ae,
							children: Z.map(([t, n]) => /* @__PURE__ */ (0, Y.jsx)(e, {
								value: t,
								className: ie,
								children: n
							}, t))
						}),
						u === "paste" ? /* @__PURE__ */ (0, Y.jsx)(v, {
							type: "password",
							label: "Cookie",
							autoComplete: "off",
							value: o,
							onChange: s
						}) : /* @__PURE__ */ (0, Y.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, Y.jsx)(h, { children: U("manage:sourceSettings.cookieFileLabel") }),
								/* @__PURE__ */ (0, Y.jsxs)("div", {
									className: "flex flex-wrap items-center gap-3",
									children: [/* @__PURE__ */ (0, Y.jsx)(i, {
										variant: "secondary",
										onClick: () => S.current?.click(),
										children: U("manage:sourceSettings.chooseFile")
									}), /* @__PURE__ */ (0, Y.jsx)("span", {
										className: "min-w-0 text-body-2-regular break-all text-text-secondary",
										children: m || U("manage:sourceSettings.noFileChosen")
									})]
								}),
								/* @__PURE__ */ (0, Y.jsx)("input", {
									ref: S,
									type: "file",
									accept: ".txt",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									onChange: (e) => {
										I(e);
									}
								})
							]
						})
					] }) : null,
					R ? /* @__PURE__ */ (0, Y.jsx)(d, { children: R }) : null,
					z.map((e) => {
						let n = e.kind === "unchecked" ? "neutral" : e.ok ? "success" : "error", r = e.kind === "unchecked" ? U("manage:sourceSettings.unchecked") : e.ok ? U("manage:sourceSettings.reachable") : U("manage:sourceSettings.connectionFailed");
						return /* @__PURE__ */ (0, Y.jsx)(b, {
							tone: n,
							children: /* @__PURE__ */ (0, Y.jsxs)("span", {
								className: "flex flex-col items-start gap-1",
								children: [/* @__PURE__ */ (0, Y.jsx)(De, {
									tone: n,
									children: r
								}), /* @__PURE__ */ (0, Y.jsx)("span", { children: ue(e, F(t, "label")) })]
							})
						}, e.label);
					})
				]
			}) : null,
			/* @__PURE__ */ (0, Y.jsxs)(g, { children: [
				t.accepts_cookie && t.cookie_saved ? /* @__PURE__ */ (0, Y.jsx)(i, {
					variant: "secondary",
					onClick: de,
					...P(j),
					children: U("manage:sourceSettings.revokeCookie")
				}) : null,
				/* @__PURE__ */ (0, Y.jsx)(i, {
					variant: "secondary",
					onClick: fe,
					...P(j),
					children: U("manage:sourceSettings.testConnection")
				}),
				/* @__PURE__ */ (0, Y.jsx)(i, {
					type: "submit",
					...P(j),
					children: U("manage:shared.save")
				})
			] })
		]
	});
}
var ze = {
	ok: "success",
	auth: "warning",
	http: "error",
	cooldown: "warning",
	network: "error",
	skipped: "neutral"
}, Q = [
	"ok",
	"auth",
	"cooldown",
	"http",
	"network",
	"skipped"
];
function Be(e, t) {
	let n = F(e, "label");
	return t.target === "cdn" ? U("manage:connectionCheck.hdImages", { source: n }) : n;
}
function Ve({ toast: e }) {
	let { job: t, running: n, start: r, query: o } = G({
		queryKey: a,
		queryFn: ({ signal: e }) => B(e),
		start: () => N(S, {}),
		onFinish: (t) => {
			H.invalidateQueries({
				queryKey: w,
				exact: !0
			}), t.status === "complete" && e(t.failed ? U("manage:connectionCheck.doneWithFailures", { count: t.failed }) : U("manage:connectionCheck.doneAllReachable"));
		}
	}), s = (e) => {
		e.preventDefault(), !o.data || n || r.isPending || r.mutate();
	}, c = (t?.results ?? []).flatMap((e) => e.results.map((t) => ({
		source: e.source,
		name: Be(e, t),
		check: t
	}))), l = (e, t) => /* @__PURE__ */ (0, Y.jsxs)("span", {
		className: "inline-flex min-w-0 items-center gap-1.5",
		children: [/* @__PURE__ */ (0, Y.jsx)(D, { source: e }), t]
	}), d = c.filter(({ check: e }) => e.outcome === "ok"), f = c.filter(({ check: e }) => e.outcome !== "ok").sort((e, t) => Q.indexOf(e.check.outcome) - Q.indexOf(t.check.outcome)), h = r.error ? L(r.error) : o.error ? L(o.error) : t?.status === "failed" ? V(t, "error") || U("manage:connectionCheck.notFinished") : "", v = t?.status === "complete" && t.completed_at ? [ye((/* @__PURE__ */ new Date(t.completed_at * 1e3)).toISOString()), t.elapsed_s === void 0 ? "" : U("manage:connectionCheck.elapsed", { seconds: t.elapsed_s.toFixed(1) })].filter(Boolean).join(" · ") : "";
	return /* @__PURE__ */ (0, Y.jsxs)(T, {
		id: "check-all",
		title: U("manage:connectionCheck.title"),
		onSubmit: s,
		children: [/* @__PURE__ */ (0, Y.jsxs)(O, { children: [
			o.isPending ? /* @__PURE__ */ (0, Y.jsx)("div", {
				role: "status",
				"aria-label": U("manage:connectionCheck.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, Y.jsx)(_, { children: U("manage:connectionCheck.help") }),
			n ? /* @__PURE__ */ (0, Y.jsx)(A, {
				embedded: !0,
				kind: "radar",
				value: t?.checked ?? 0,
				total: t?.total ?? 0,
				label: U("manage:connectionCheck.checkedCount", {
					checked: t?.checked ?? 0,
					count: t?.total ?? 0
				})
			}) : null,
			h ? /* @__PURE__ */ (0, Y.jsx)(b, {
				tone: "error",
				children: h
			}) : null,
			c.length ? /* @__PURE__ */ (0, Y.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: Q.map((e) => {
					let t = c.filter(({ check: t }) => t.outcome === e).length;
					return t ? /* @__PURE__ */ (0, Y.jsxs)(k, {
						tone: ze[e],
						children: [
							F(c.find(({ check: t }) => t.outcome === e)?.check, "outcome_label"),
							" ",
							t
						]
					}, e) : null;
				})
			}) : null,
			f.length ? /* @__PURE__ */ (0, Y.jsx)("ul", {
				className: "flex min-w-0 flex-col",
				children: f.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, Y.jsx)(y, {
					title: l(e, t),
					children: /* @__PURE__ */ (0, Y.jsxs)("span", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, Y.jsx)(k, {
							tone: ze[n.outcome],
							children: F(n, "outcome_label")
						}), n.message ? /* @__PURE__ */ (0, Y.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: F(n, "message")
						}) : null]
					})
				}, t))
			}) : null,
			d.length ? /* @__PURE__ */ (0, Y.jsx)(u, {
				summary: U("manage:connectionCheck.reachableCount", { count: d.length }),
				children: /* @__PURE__ */ (0, Y.jsx)(m, { children: d.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, Y.jsx)(p, {
					term: l(e, t),
					children: [n.width ? `${n.width} × ${n.height}` : "", n.elapsed_s === void 0 ? "" : U("manage:connectionCheck.seconds", { seconds: n.elapsed_s.toFixed(2) })].filter(Boolean).join(" · ")
				}, t)) })
			}) : null
		] }), /* @__PURE__ */ (0, Y.jsx)(g, {
			status: v ? U("manage:connectionCheck.lastChecked", { time: v }) : void 0,
			children: /* @__PURE__ */ (0, Y.jsx)(i, {
				type: "submit",
				disabled: !o.data,
				...P(n || r.isPending),
				children: U("manage:connectionCheck.checkAll")
			})
		})]
	});
}
var $ = (e) => Ce(e.result_code ?? "", e.result ?? "", e.result_params), He = (e) => be(e.error_parts, V(e, "error"));
function Ue({ toast: e }) {
	let [t, n] = (0, J.useState)(""), { running: r, outcome: a, start: s, query: c } = G({
		queryKey: o,
		queryFn: ({ signal: e }) => pe(e),
		start: () => N(C, { code: t }),
		onFinish: (t) => {
			t.status === "complete" && e($(t) || U("manage:hdCover.fetched"));
		}
	}), l = (e) => {
		e.preventDefault(), c.data && !r && !s.isPending && t.trim() && s.mutate();
	}, u = s.error ? L(s.error) : c.error ? L(c.error) : a?.status === "failed" ? He(a) || U("manage:hdCover.notFound") : "";
	return /* @__PURE__ */ (0, Y.jsx)(T, {
		id: "hd-cover",
		title: U("manage:hdCover.title"),
		onSubmit: l,
		children: /* @__PURE__ */ (0, Y.jsxs)(O, { children: [
			c.isPending ? /* @__PURE__ */ (0, Y.jsx)("div", {
				role: "status",
				"aria-label": U("manage:hdCover.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, Y.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Y.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, Y.jsx)(v, {
						"aria-label": U("manage:hdCover.codeLabel"),
						isRequired: !0,
						isDisabled: r,
						value: t,
						onChange: n,
						placeholder: U("manage:hdCover.codePlaceholder")
					})
				}), /* @__PURE__ */ (0, Y.jsx)(i, {
					type: "submit",
					disabled: !c.data || !t.trim(),
					...P(r || s.isPending),
					children: U("manage:hdCover.fetchCover")
				})]
			}),
			r ? /* @__PURE__ */ (0, Y.jsx)(A, {
				embedded: !0,
				kind: M("scraping-cover"),
				label: U("manage:hdCover.fetching")
			}) : null,
			u ? /* @__PURE__ */ (0, Y.jsx)(b, {
				tone: "error",
				children: u
			}) : null,
			a?.status === "complete" ? /* @__PURE__ */ (0, Y.jsx)(b, {
				tone: "success",
				children: $(a) || U("manage:hdCover.fetched")
			}) : null
		] })
	});
}
function We({ toast: e }) {
	let { query: a, running: o, outcome: s, start: c } = G({
		queryKey: n,
		queryFn: ({ signal: e }) => z(e),
		start: () => N(r, {}),
		jobOf: (e) => e.job,
		withJob: (e, t) => e && {
			...e,
			job: t
		},
		onFinish: (t) => {
			t.status === "complete" && e(F(t, "result") || U("manage:amaneRuntime.rebuilt"));
		}
	}), l = K({ mutationFn: () => N(t, {}) }), d = a.data;
	if (!d) return a.error ? /* @__PURE__ */ (0, Y.jsx)(T, {
		id: "amane",
		title: "amane",
		children: /* @__PURE__ */ (0, Y.jsx)(O, { children: /* @__PURE__ */ (0, Y.jsx)(b, {
			tone: "error",
			children: L(a.error)
		}) })
	}) : null;
	let h = o || c.isPending || l.isPending, v = c.error ? L(c.error) : l.error ? L(l.error) : s?.status === "failed" ? V(s, "error") || U("manage:amaneRuntime.rebuildNotFinished") : "";
	return /* @__PURE__ */ (0, Y.jsxs)(T, {
		id: "amane",
		title: "amane",
		aside: /* @__PURE__ */ (0, Y.jsx)(f, {
			href: d.repository,
			leadingIcon: Le,
			children: d.repository
		}),
		children: [
			/* @__PURE__ */ (0, Y.jsxs)(m, { children: [
				/* @__PURE__ */ (0, Y.jsx)(p, {
					term: U("manage:amaneRuntime.installedVersion"),
					children: d.installed_version || U("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, Y.jsx)(p, {
					term: U("manage:amaneRuntime.latestVersion"),
					children: l.data ? F(l.data, "latest") : U("manage:amaneRuntime.notChecked")
				}),
				/* @__PURE__ */ (0, Y.jsx)(p, {
					term: U("manage:amaneRuntime.runtime"),
					children: d.installed ? U("manage:amaneRuntime.installed") : U("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, Y.jsx)(p, {
					term: U("manage:amaneRuntime.builtInSites"),
					children: U("manage:amaneRuntime.siteCount", { count: d.sites.length })
				})
			] }),
			/* @__PURE__ */ (0, Y.jsxs)(O, {
				divided: !0,
				children: [
					d.sites.length ? /* @__PURE__ */ (0, Y.jsx)(u, {
						summary: U("manage:amaneRuntime.showSites"),
						children: /* @__PURE__ */ (0, Y.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: ve(d.sites.map((e) => F(e, "label")))
						})
					}) : null,
					d.problem ? /* @__PURE__ */ (0, Y.jsx)(b, {
						tone: "error",
						children: d.problem
					}) : /* @__PURE__ */ (0, Y.jsx)(_, { children: U("manage:amaneRuntime.help", {
						license: d.license,
						version: d.version
					}) }),
					o ? /* @__PURE__ */ (0, Y.jsx)(A, {
						embedded: !0,
						kind: M("amane-bridge"),
						label: U("manage:amaneRuntime.rebuilding")
					}) : null,
					v ? /* @__PURE__ */ (0, Y.jsx)(b, {
						tone: "error",
						children: v
					}) : null,
					s?.status === "complete" ? /* @__PURE__ */ (0, Y.jsx)(b, {
						tone: "success",
						children: F(s, "result") || U("manage:amaneRuntime.rebuilt")
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Y.jsxs)(g, { children: [/* @__PURE__ */ (0, Y.jsx)(i, {
				variant: "secondary",
				onClick: () => {
					h || l.mutate();
				},
				...P(l.isPending),
				children: U("manage:amaneRuntime.checkUpstream")
			}), /* @__PURE__ */ (0, Y.jsx)(i, {
				disabled: !!d.problem,
				onClick: () => {
					h || c.mutate();
				},
				...P(o || c.isPending),
				children: d.installed ? U("manage:amaneRuntime.reinstall") : U("manage:amaneRuntime.install")
			})] })
		]
	});
}
function Ge({ toast: e }) {
	let t = Ee({
		queryKey: w,
		queryFn: ({ signal: e }) => he(e)
	}), n = t.data;
	return n ? /* @__PURE__ */ (0, Y.jsxs)(q, { children: [/* @__PURE__ */ (0, Y.jsx)("p", {
		className: "text-body-2-regular text-text-secondary",
		children: U("manage:scrapingSources.proxyHint")
	}), /* @__PURE__ */ (0, Y.jsxs)(ke, {
		label: U("manage:scrapingSources.contents"),
		entries: [
			{
				id: "check-all",
				label: U("manage:connectionCheck.title")
			},
			{
				id: "hd-cover",
				label: U("manage:hdCover.title")
			},
			{
				id: "custom-sources",
				label: U("manage:customSources.title")
			},
			...(n.sources || []).map((e) => ({
				id: `source-${e.source}`,
				label: F(e, "label"),
				icon: e.source === "makers" ? void 0 : /* @__PURE__ */ (0, Y.jsx)(D, { source: e.source })
			})),
			{
				id: "source-amane",
				label: "amane"
			}
		],
		children: [
			/* @__PURE__ */ (0, Y.jsx)(Ve, { toast: e }),
			/* @__PURE__ */ (0, Y.jsx)(Ue, { toast: e }),
			/* @__PURE__ */ (0, Y.jsx)(Ne, { receipt: e }),
			(n.sources || []).map((t) => /* @__PURE__ */ (0, Y.jsx)(Re, {
				source: t,
				toast: e
			}, t.source)),
			/* @__PURE__ */ (0, Y.jsx)("div", {
				id: "source-amane",
				children: /* @__PURE__ */ (0, Y.jsx)(We, { toast: e })
			})
		]
	})] }) : /* @__PURE__ */ (0, Y.jsx)(q, { children: /* @__PURE__ */ (0, Y.jsx)(b, {
		tone: "error",
		title: U("manage:scrapingSources.loadFailedTitle"),
		children: t.error ? L(t.error) : U("manage:scrapingSources.loadFailed")
	}) });
}
export { Ge as ScrapingPage, Ie as linkHost, Fe as networkOptions };

//# debugId=093b4a69-4d36-42c5-a56f-98c6008f38b3