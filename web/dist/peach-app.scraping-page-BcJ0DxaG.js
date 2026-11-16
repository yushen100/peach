(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "46170e15-4515-407f-8b87-9c2ad4a9d7bf", e._sentryDebugIdIdentifier = "sentry-dbid-46170e15-4515-407f-8b87-9c2ad4a9d7bf");
	} catch {}
})();
import { $fe21c36db05242bb$export$d7b12c4107be0d61 as e, AMANE_BRIDGE_CHECK_URL as t, AMANE_BRIDGE_KEY as n, AMANE_BRIDGE_REBUILD_URL as r, Button as i, CHECK_ALL_KEY as a, COVER_JOB_KEY as o, CUSTOM_SOURCES_KEY as s, CUSTOM_SOURCES_URL as c, Checkbox as l, Disclosure as u, ErrorText as d, ExternalLink as f, Fact as p, FactList as m, FieldLabel as h, Footer as g, Help as _, Input as v, IssueRow as y, LinkButton as ee, Note as b, Rows as te, SCRAPING_CHECK_ALL_URL as x, SCRAPING_CHECK_URL as ne, SCRAPING_COVER_URL as S, SCRAPING_KEY as C, SCRAPING_SETTINGS_URL as re, SEGMENT as ie, SEGMENTED_TRACK as ae, Section as w, SegmentedRadioGroup as oe, Select$1 as se, SelectField as T, SelectItem as ce, SettingsRow as le, Stack as E, StatusLabel as D, TaskProgress as O, __toESM as k, activityKind as A, apiSend as j, busyProps as M, checkText as ue, codedText as N, composingKey as P, confirmModal as de, errorMessage as F, esc as fe, fetchAmaneBridge as I, fetchCheckAllJob as L, fetchCoverJob as R, fetchCustomSources as z, fetchSources as pe, i2 as me, interfaceLanguage as he, jobText as B, joinList as ge, momentText as _e, partsLabel as ve, queryClient as V, require_jsx_runtime as ye, require_react as be, serverLabel as xe, spinnerHtml as Se, t as H, useAction as U, useBackgroundJob as W, useMutation as G, useQuery as K } from "./peach-app.js";
import { ConnectionStatus as Ce } from "./peach-app.connection-status-BrXhLGSm.js";
import { Page as q } from "./peach-app.page-QAncjzM1.js";
import { SiteMark as J } from "./peach-app.site-mark-D_VlIyJz.js";
import { CodeBlock as we } from "./peach-app.code-block-CXu10nIP.js";
// src/react/scraping/custom-sources.tsx
var Y = /* @__PURE__ */ k(be(), 1), X = ye(), Te = [
	["code", H("manage:shared.code")],
	["title", H("manage:shared.title")],
	["studio", H("manage:customSources.fieldStudio")],
	["series", H("manage:shared.series")],
	["release_date", H("manage:shared.releaseDate")],
	["performers", H("manage:customSources.fieldPerformers")],
	["tags", H("manage:customSources.fieldTags")]
], Ee = [
	["censored", H("manage:customSources.typeCensored")],
	["amateur", H("manage:customSources.typeAmateur")],
	["uncensored", H("manage:shared.uncensored")],
	["fc2", "FC2"],
	["kmib", H("manage:customSources.typeKoreanMib")],
	["other", H("manage:shared.other")],
	["unsure", H("manage:customSources.typeUnverifiedCode")],
	["unknown", H("manage:shared.unknown")]
], De = () => ({
	name: "",
	endpoint: "",
	enabled: !1,
	fields: {
		code: "id",
		title: "title"
	},
	content_types: ["censored"]
});
function Oe({ receipt: e }) {
	let [t, n] = (0, Y.useState)(null), r = K({
		queryKey: s,
		queryFn: ({ signal: e }) => z(e)
	}), a = U(), o = (e) => V.setQueryData(s, e), l = !!(r.isPending || r.error || r.data?.items.length || a.error), u = /* @__PURE__ */ (0, X.jsx)(i, {
		variant: "secondary",
		onClick: () => n(De()),
		children: H("manage:customSources.addSource")
	});
	return /* @__PURE__ */ (0, X.jsxs)(w, {
		title: H("manage:customSources.title"),
		children: [
			l ? /* @__PURE__ */ (0, X.jsxs)(E, { children: [
				r.isPending ? /* @__PURE__ */ (0, X.jsx)("div", {
					"aria-busy": "true",
					"data-skeleton": "",
					"aria-label": H("manage:customSources.loading")
				}) : null,
				r.error ? /* @__PURE__ */ (0, X.jsx)(d, { children: F(r.error) }) : null,
				r.data?.items.map((t) => /* @__PURE__ */ (0, X.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, X.jsx)("span", {
							className: "min-w-0 flex-1",
							children: t.name
						}),
						/* @__PURE__ */ (0, X.jsx)(D, {
							tone: t.enabled ? "success" : "neutral",
							children: t.enabled ? H("manage:customSources.enabled") : H("manage:customSources.disabled")
						}),
						/* @__PURE__ */ (0, X.jsx)(i, {
							variant: "secondary",
							onClick: () => n(t),
							children: H("manage:shared.edit")
						}),
						/* @__PURE__ */ (0, X.jsx)(i, {
							variant: "secondary",
							...M(a.busy === t.id),
							onClick: () => void a.run(t.id, (e) => j(c, {
								...t,
								enabled: !t.enabled
							}, "POST", e), (n) => {
								o(n), e(t.enabled ? H("manage:customSources.sourceDisabled") : H("manage:customSources.sourceEnabled"));
							}),
							children: t.enabled ? H("manage:customSources.disable") : H("manage:customSources.enable")
						}),
						/* @__PURE__ */ (0, X.jsx)(i, {
							variant: "danger",
							onClick: () => de({
								title: H("manage:customSources.deleteTitle"),
								body: H("manage:customSources.deleteBody", { name: fe(t.name) }),
								confirmLabel: H("manage:customSources.deleteConfirm"),
								danger: !0,
								holdToConfirm: !0,
								onConfirm: async () => {
									o(await j(c, {
										action: "delete",
										id: t.id
									})), n(null), e(H("manage:customSources.deleted"));
								}
							}),
							children: H("manage:shared.delete")
						})
					]
				}, t.id)),
				a.error ? /* @__PURE__ */ (0, X.jsx)(d, { children: a.error }) : null
			] }) : null,
			t ? null : l ? /* @__PURE__ */ (0, X.jsx)(g, { children: u }) : /* @__PURE__ */ (0, X.jsx)(E, { children: /* @__PURE__ */ (0, X.jsx)("div", {
				className: "flex justify-end",
				children: u
			}) }),
			t ? /* @__PURE__ */ (0, X.jsx)(ke, {
				initial: t,
				cancel: () => n(null),
				saved: (t) => {
					o(t), n(null), e(H("manage:customSources.saved"));
				}
			}, t.id || "new") : null
		]
	});
}
function ke({ initial: e, cancel: t, saved: n }) {
	let [r, a] = (0, Y.useState)(e), [o, s] = (0, Y.useState)(""), [u, f] = (0, Y.useState)(""), p = (0, Y.useRef)(0), m = U(), y = (e) => {
		p.current++, a((t) => ({
			...t,
			...e
		})), f("");
	};
	return /* @__PURE__ */ (0, X.jsxs)("form", {
		"aria-label": H("manage:customSources.formLabel"),
		"aria-busy": m.busy === "preview",
		onSubmit: (e) => {
			e.preventDefault(), m.run("save", (e) => j(c, r, "POST", e), n);
		},
		children: [/* @__PURE__ */ (0, X.jsxs)(E, { children: [
			/* @__PURE__ */ (0, X.jsx)(v, {
				label: H("manage:customSources.name"),
				value: r.name,
				maxLength: 80,
				onChange: (e) => y({ name: e })
			}),
			/* @__PURE__ */ (0, X.jsx)(v, {
				label: H("manage:customSources.endpoint"),
				value: r.endpoint,
				maxLength: 2048,
				placeholder: "https://example.com/api/movies/{code}",
				onChange: (e) => y({ endpoint: e })
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, X.jsx)(h, { children: H("manage:customSources.network") }), /* @__PURE__ */ (0, X.jsx)(T, {
					id: "custom-source-network",
					label: H("manage:customSources.network"),
					epoch: 0,
					value: r.network || "direct",
					options: [["direct", H("manage:processingTraffic.connectionDirect")], ["peach_proxy", H("manage:customSources.peachProxy")]],
					onPick: (e) => y({ network: e })
				})]
			}),
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, X.jsx)(h, { children: H("manage:customSources.codeFormat") }), /* @__PURE__ */ (0, X.jsx)(T, {
					id: "custom-source-code-format",
					label: H("manage:customSources.codeFormat"),
					epoch: 0,
					value: r.code_format || "original",
					options: [
						["original", H("manage:customSources.codeAsIs")],
						["lowercase", H("manage:customSources.codeLowercase")],
						["compact", H("manage:customSources.codeNoHyphens")],
						["underscore", H("manage:customSources.codeUnderscores")]
					],
					onPick: (e) => y({ code_format: e })
				})]
			}),
			/* @__PURE__ */ (0, X.jsx)(_, { children: H("manage:customSources.help") }),
			Te.map(([e, t]) => /* @__PURE__ */ (0, X.jsx)(v, {
				label: H("manage:customSources.fieldPath", { field: t }),
				value: r.fields[e] || "",
				onChange: (t) => {
					let n = { ...r.fields };
					t ? n[e] = t : delete n[e], y({ fields: n });
				}
			}, e)),
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "flex flex-wrap gap-3",
				role: "group",
				"aria-label": H("manage:customSources.contentTypes"),
				children: Ee.map(([e, t]) => /* @__PURE__ */ (0, X.jsx)(l, {
					isSelected: r.content_types.includes(e),
					onChange: (t) => y({ content_types: t ? [...r.content_types, e] : r.content_types.filter((t) => t !== e) }),
					children: t
				}, e))
			}),
			/* @__PURE__ */ (0, X.jsx)(l, {
				isSelected: r.enabled,
				onChange: (e) => y({ enabled: e }),
				children: H("manage:customSources.enableSource")
			}),
			/* @__PURE__ */ (0, X.jsx)(v, {
				label: H("manage:customSources.testCode"),
				value: o,
				onChange: (e) => {
					p.current++, s(e), f("");
				},
				onKeyDown: (e) => {
					if (e.key !== "Enter" || P(e.nativeEvent)) return;
					e.preventDefault();
					let t = p.current;
					m.run("preview", (e) => j(c, {
						...r,
						code: o,
						action: "preview"
					}, "POST", e), (e) => {
						t === p.current && f(JSON.stringify(e.record, null, 2));
					}, (e) => {
						t === p.current && m.setError(F(e));
					});
				}
			}),
			m.busy === "preview" ? /* @__PURE__ */ (0, X.jsxs)(_, {
				role: "status",
				children: [/* @__PURE__ */ (0, X.jsx)("span", { dangerouslySetInnerHTML: { __html: Se(H("manage:customSources.testing")) } }), H("manage:customSources.testing")]
			}) : null,
			u ? /* @__PURE__ */ (0, X.jsx)(we, {
				code: u,
				language: "json",
				label: H("manage:customSources.response")
			}) : null,
			m.error ? /* @__PURE__ */ (0, X.jsx)(d, { children: m.error }) : null
		] }), /* @__PURE__ */ (0, X.jsxs)(g, { children: [/* @__PURE__ */ (0, X.jsx)(i, {
			variant: "secondary",
			type: "button",
			onClick: t,
			children: H("manage:shared.cancel")
		}), /* @__PURE__ */ (0, X.jsx)(i, {
			type: "submit",
			...M(m.busy === "save"),
			children: H("manage:customSources.saveSource")
		})] })]
	});
}
// src/react/scraping/scraping-page.tsx
var Z = [["peach", H("manage:customSources.peachProxy")], ["direct", H("manage:sourceSettings.direct")]];
function Ae(e) {
	return Z.some(([t]) => t === e) || !e ? [...Z] : [...Z, [e, e]];
}
function je(e) {
	try {
		return new URL(e).host || e;
	} catch {
		return e;
	}
}
var Me = [["paste", H("manage:sourceSettings.pasteCookie")], ["file", H("manage:sourceSettings.uploadFile")]];
function Ne() {
	return /* @__PURE__ */ (0, X.jsx)(J, { source: "github" });
}
function Pe({ source: t, toast: n }) {
	let [r, a] = (0, Y.useState)(t.network), [o, s] = (0, Y.useState)(""), [c, l] = (0, Y.useState)(""), [u, p] = (0, Y.useState)(Me[0][0]), [m, _] = (0, Y.useState)(""), [y, x] = (0, Y.useState)(""), S = (0, Y.useRef)(null);
	function T() {
		s(""), l(""), _(""), x(""), S.current && (S.current.value = "");
	}
	let O = G({
		mutationFn: (e) => j(re, {
			source: t.source,
			network: r,
			cookie: o,
			cookies_text: c,
			revoke: e
		}),
		onSuccess: (e, t) => {
			V.setQueryData(C, (t) => t && {
				...t,
				sources: t.sources.map((t) => t.source === e.saved.source ? e.saved : t)
			}), T(), n(H(t ? "manage:sourceSettings.cookieRevoked" : "manage:sourceSettings.saved"));
		}
	}), k = G({ mutationFn: () => j(ne, { source: t.source }) }), A = O.isPending || k.isPending, P = (e) => {
		e.preventDefault(), A || (k.reset(), O.mutate(!1));
	}, de = () => {
		A || (k.reset(), O.mutate(!0));
	}, fe = () => {
		A || (O.reset(), k.mutate());
	};
	async function I(e) {
		let t = e.currentTarget, n = t.files?.[0];
		if (l(""), x(""), !n) _("");
		else if (n.size > 262144) t.value = "", _(""), x(H("manage:sourceSettings.cookieTooLarge"));
		else try {
			let e = await n.text();
			l(e), _(n.name);
		} catch {
			x(H("manage:sourceSettings.cookieFileUnread"));
		}
	}
	let L = y || (O.error ? F(O.error) : "") || (k.error ? F(k.error) : ""), R = k.data?.results ?? [], z = r === "peach" || t.accepts_cookie || t.browser || !!L || R.length > 0;
	return /* @__PURE__ */ (0, X.jsxs)(w, {
		title: N(t, "label"),
		onSubmit: P,
		aside: /* @__PURE__ */ (0, X.jsxs)("span", {
			className: "flex min-w-0 items-center gap-1",
			children: [/* @__PURE__ */ (0, X.jsx)(J, { source: t.source }), t.login ? /* @__PURE__ */ (0, X.jsx)(f, {
				href: t.login,
				children: je(t.login)
			}) : null]
		}),
		children: [
			/* @__PURE__ */ (0, X.jsx)(te, { children: /* @__PURE__ */ (0, X.jsx)(le, {
				label: H("manage:sourceSettings.connectionMode"),
				children: /* @__PURE__ */ (0, X.jsx)(se, {
					"aria-label": H("manage:sourceSettings.connectionMode"),
					className: "w-44 min-w-0",
					selectedKey: r,
					onSelectionChange: (e) => {
						e !== null && a(String(e));
					},
					children: Ae(r).map(([e, t]) => /* @__PURE__ */ (0, X.jsx)(ce, {
						id: e,
						children: t
					}, e))
				})
			}) }),
			t.cooldown_until && t.cooldown_until > Date.now() / 1e3 ? /* @__PURE__ */ (0, X.jsx)(b, {
				tone: "warning",
				children: /* @__PURE__ */ (0, X.jsxs)("span", {
					className: "inline-flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, X.jsx)(D, {
						tone: "warning",
						children: H("manage:sourceSettings.coolingDown")
					}), /* @__PURE__ */ (0, X.jsx)("span", { children: H("manage:sourceSettings.retryAfter", { time: (/* @__PURE__ */ new Date(t.cooldown_until * 1e3)).toLocaleString(he) }) })]
				})
			}) : null,
			z ? /* @__PURE__ */ (0, X.jsxs)(E, {
				divided: !0,
				children: [
					r === "peach" ? /* @__PURE__ */ (0, X.jsx)("span", {
						className: "self-start",
						children: /* @__PURE__ */ (0, X.jsx)(ee, {
							href: "/settings/library#peachProxy",
							size: "small",
							trailingIcon: me,
							children: H("manage:sourceSettings.setUpProxy")
						})
					}) : null,
					t.browser ? /* @__PURE__ */ (0, X.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: H("manage:sourceSettings.browserVerification")
					}) : null,
					t.accepts_cookie && !t.browser ? /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
						/* @__PURE__ */ (0, X.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, X.jsx)("span", {
								className: "self-start",
								children: /* @__PURE__ */ (0, X.jsx)(D, {
									tone: t.cookie_saved ? "success" : "neutral",
									children: t.cookie_saved ? H("manage:sourceSettings.cookieSaved") : H("manage:sourceSettings.cookieNotSet")
								})
							}), /* @__PURE__ */ (0, X.jsx)("p", {
								className: "text-body-2-regular text-text-secondary",
								children: t.cookie_saved ? H("manage:sourceSettings.signInUnverified") : H("manage:sourceSettings.provideCookieHint")
							})]
						}),
						/* @__PURE__ */ (0, X.jsx)(oe, {
							"aria-label": H("manage:sourceSettings.cookieMethod"),
							value: u,
							onChange: (e) => {
								p(e), T();
							},
							className: ae,
							children: Me.map(([t, n]) => /* @__PURE__ */ (0, X.jsx)(e, {
								value: t,
								className: ie,
								children: n
							}, t))
						}),
						u === "paste" ? /* @__PURE__ */ (0, X.jsx)(v, {
							type: "password",
							label: "Cookie",
							autoComplete: "off",
							value: o,
							onChange: s
						}) : /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, X.jsx)(h, { children: H("manage:sourceSettings.cookieFileLabel") }),
								/* @__PURE__ */ (0, X.jsxs)("div", {
									className: "flex flex-wrap items-center gap-3",
									children: [/* @__PURE__ */ (0, X.jsx)(i, {
										variant: "secondary",
										onClick: () => S.current?.click(),
										children: H("manage:sourceSettings.chooseFile")
									}), /* @__PURE__ */ (0, X.jsx)("span", {
										className: "min-w-0 text-body-2-regular break-all text-text-secondary",
										children: m || H("manage:sourceSettings.noFileChosen")
									})]
								}),
								/* @__PURE__ */ (0, X.jsx)("input", {
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
					L ? /* @__PURE__ */ (0, X.jsx)(d, { children: L }) : null,
					R.map((e) => {
						let n = e.kind === "unchecked" ? "neutral" : e.ok ? "success" : "error", r = e.kind === "unchecked" ? H("manage:sourceSettings.unchecked") : e.ok ? H("manage:sourceSettings.reachable") : H("manage:sourceSettings.connectionFailed");
						return /* @__PURE__ */ (0, X.jsx)(b, {
							tone: n,
							children: /* @__PURE__ */ (0, X.jsxs)("span", {
								className: "flex flex-col items-start gap-1",
								children: [/* @__PURE__ */ (0, X.jsx)(Ce, {
									tone: n,
									children: r
								}), /* @__PURE__ */ (0, X.jsx)("span", { children: ue(e, N(t, "label")) })]
							})
						}, e.label);
					})
				]
			}) : null,
			/* @__PURE__ */ (0, X.jsxs)(g, { children: [
				t.accepts_cookie && t.cookie_saved ? /* @__PURE__ */ (0, X.jsx)(i, {
					variant: "secondary",
					onClick: de,
					...M(A),
					children: H("manage:sourceSettings.revokeCookie")
				}) : null,
				/* @__PURE__ */ (0, X.jsx)(i, {
					variant: "secondary",
					onClick: fe,
					...M(A),
					children: H("manage:sourceSettings.testConnection")
				}),
				/* @__PURE__ */ (0, X.jsx)(i, {
					type: "submit",
					...M(A),
					children: H("manage:shared.save")
				})
			] })
		]
	});
}
var Fe = {
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
function Ie(e, t) {
	let n = N(e, "label");
	return t.target === "cdn" ? H("manage:connectionCheck.hdImages", { source: n }) : n;
}
function Le({ toast: e }) {
	let { job: t, running: n, start: r, query: o } = W({
		queryKey: a,
		queryFn: ({ signal: e }) => L(e),
		start: () => j(x, {}),
		onFinish: (t) => {
			V.invalidateQueries({
				queryKey: C,
				exact: !0
			}), t.status === "complete" && e(t.failed ? H("manage:connectionCheck.doneWithFailures", { count: t.failed }) : H("manage:connectionCheck.doneAllReachable"));
		}
	}), s = (e) => {
		e.preventDefault(), !o.data || n || r.isPending || r.mutate();
	}, c = (t?.results ?? []).flatMap((e) => e.results.map((t) => ({
		source: e.source,
		name: Ie(e, t),
		check: t
	}))), l = (e, t) => /* @__PURE__ */ (0, X.jsxs)("span", {
		className: "inline-flex min-w-0 items-center gap-1.5",
		children: [/* @__PURE__ */ (0, X.jsx)(J, { source: e }), t]
	}), d = c.filter(({ check: e }) => e.outcome === "ok"), f = c.filter(({ check: e }) => e.outcome !== "ok").sort((e, t) => Q.indexOf(e.check.outcome) - Q.indexOf(t.check.outcome)), h = r.error ? F(r.error) : o.error ? F(o.error) : t?.status === "failed" ? B(t, "error") || H("manage:connectionCheck.notFinished") : "", v = t?.status === "complete" && t.completed_at ? [_e((/* @__PURE__ */ new Date(t.completed_at * 1e3)).toISOString()), t.elapsed_s === void 0 ? "" : H("manage:connectionCheck.elapsed", { seconds: t.elapsed_s.toFixed(1) })].filter(Boolean).join(" · ") : "";
	return /* @__PURE__ */ (0, X.jsxs)(w, {
		id: "check-all",
		title: H("manage:connectionCheck.title"),
		onSubmit: s,
		children: [/* @__PURE__ */ (0, X.jsxs)(E, { children: [
			o.isPending ? /* @__PURE__ */ (0, X.jsx)("div", {
				role: "status",
				"aria-label": H("manage:connectionCheck.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, X.jsx)(_, { children: H("manage:connectionCheck.help") }),
			n ? /* @__PURE__ */ (0, X.jsx)(O, {
				embedded: !0,
				kind: "radar",
				value: t?.checked ?? 0,
				total: t?.total ?? 0,
				label: H("manage:connectionCheck.checkedCount", {
					checked: t?.checked ?? 0,
					count: t?.total ?? 0
				})
			}) : null,
			h ? /* @__PURE__ */ (0, X.jsx)(b, {
				tone: "error",
				children: h
			}) : null,
			c.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: Q.map((e) => {
					let t = c.filter(({ check: t }) => t.outcome === e).length;
					return t ? /* @__PURE__ */ (0, X.jsxs)(D, {
						tone: Fe[e],
						children: [
							N(c.find(({ check: t }) => t.outcome === e)?.check, "outcome_label"),
							" ",
							t
						]
					}, e) : null;
				})
			}) : null,
			f.length ? /* @__PURE__ */ (0, X.jsx)("ul", {
				className: "flex min-w-0 flex-col",
				children: f.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, X.jsx)(y, {
					title: l(e, t),
					children: /* @__PURE__ */ (0, X.jsxs)("span", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, X.jsx)(D, {
							tone: Fe[n.outcome],
							children: N(n, "outcome_label")
						}), n.message ? /* @__PURE__ */ (0, X.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: N(n, "message")
						}) : null]
					})
				}, t))
			}) : null,
			d.length ? /* @__PURE__ */ (0, X.jsx)(u, {
				summary: H("manage:connectionCheck.reachableCount", { count: d.length }),
				children: /* @__PURE__ */ (0, X.jsx)(m, { children: d.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, X.jsx)(p, {
					term: l(e, t),
					children: [n.width ? `${n.width} × ${n.height}` : "", n.elapsed_s === void 0 ? "" : H("manage:connectionCheck.seconds", { seconds: n.elapsed_s.toFixed(2) })].filter(Boolean).join(" · ")
				}, t)) })
			}) : null
		] }), /* @__PURE__ */ (0, X.jsx)(g, {
			status: v ? H("manage:connectionCheck.lastChecked", { time: v }) : void 0,
			children: /* @__PURE__ */ (0, X.jsx)(i, {
				type: "submit",
				disabled: !o.data,
				...M(n || r.isPending),
				children: H("manage:connectionCheck.checkAll")
			})
		})]
	});
}
var $ = (e) => xe(e.result_code ?? "", e.result ?? "", e.result_params), Re = (e) => ve(e.error_parts, B(e, "error"));
function ze({ toast: e }) {
	let [t, n] = (0, Y.useState)(""), { running: r, outcome: a, start: s, query: c } = W({
		queryKey: o,
		queryFn: ({ signal: e }) => R(e),
		start: () => j(S, { code: t }),
		onFinish: (t) => {
			t.status === "complete" && e($(t) || H("manage:hdCover.fetched"));
		}
	}), l = (e) => {
		e.preventDefault(), c.data && !r && !s.isPending && t.trim() && s.mutate();
	}, u = s.error ? F(s.error) : c.error ? F(c.error) : a?.status === "failed" ? Re(a) || H("manage:hdCover.notFound") : "";
	return /* @__PURE__ */ (0, X.jsx)(w, {
		title: H("manage:hdCover.title"),
		onSubmit: l,
		children: /* @__PURE__ */ (0, X.jsxs)(E, { children: [
			c.isPending ? /* @__PURE__ */ (0, X.jsx)("div", {
				role: "status",
				"aria-label": H("manage:hdCover.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, X.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, X.jsx)(v, {
						"aria-label": H("manage:hdCover.codeLabel"),
						isRequired: !0,
						isDisabled: r,
						value: t,
						onChange: n,
						placeholder: H("manage:hdCover.codePlaceholder")
					})
				}), /* @__PURE__ */ (0, X.jsx)(i, {
					type: "submit",
					disabled: !c.data || !t.trim(),
					...M(r || s.isPending),
					children: H("manage:hdCover.fetchCover")
				})]
			}),
			r ? /* @__PURE__ */ (0, X.jsx)(O, {
				embedded: !0,
				kind: A("scraping-cover"),
				label: H("manage:hdCover.fetching")
			}) : null,
			u ? /* @__PURE__ */ (0, X.jsx)(b, {
				tone: "error",
				children: u
			}) : null,
			a?.status === "complete" ? /* @__PURE__ */ (0, X.jsx)(b, {
				tone: "success",
				children: $(a) || H("manage:hdCover.fetched")
			}) : null
		] })
	});
}
function Be({ toast: e }) {
	let { query: a, running: o, outcome: s, start: c } = W({
		queryKey: n,
		queryFn: ({ signal: e }) => I(e),
		start: () => j(r, {}),
		jobOf: (e) => e.job,
		withJob: (e, t) => e && {
			...e,
			job: t
		},
		onFinish: (t) => {
			t.status === "complete" && e(N(t, "result") || H("manage:amaneRuntime.rebuilt"));
		}
	}), l = G({ mutationFn: () => j(t, {}) }), d = a.data;
	if (!d) return a.error ? /* @__PURE__ */ (0, X.jsx)(w, {
		id: "amane",
		title: "amane",
		children: /* @__PURE__ */ (0, X.jsx)(E, { children: /* @__PURE__ */ (0, X.jsx)(b, {
			tone: "error",
			children: F(a.error)
		}) })
	}) : null;
	let h = o || c.isPending || l.isPending, v = c.error ? F(c.error) : l.error ? F(l.error) : s?.status === "failed" ? B(s, "error") || H("manage:amaneRuntime.rebuildNotFinished") : "";
	return /* @__PURE__ */ (0, X.jsxs)(w, {
		id: "amane",
		title: "amane",
		aside: /* @__PURE__ */ (0, X.jsx)(f, {
			href: d.repository,
			leadingIcon: Ne,
			children: d.repository
		}),
		children: [
			/* @__PURE__ */ (0, X.jsxs)(m, { children: [
				/* @__PURE__ */ (0, X.jsx)(p, {
					term: H("manage:amaneRuntime.installedVersion"),
					children: d.installed_version || H("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, X.jsx)(p, {
					term: H("manage:amaneRuntime.latestVersion"),
					children: l.data ? N(l.data, "latest") : H("manage:amaneRuntime.notChecked")
				}),
				/* @__PURE__ */ (0, X.jsx)(p, {
					term: H("manage:amaneRuntime.runtime"),
					children: d.installed ? H("manage:amaneRuntime.installed") : H("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, X.jsx)(p, {
					term: H("manage:amaneRuntime.builtInSites"),
					children: H("manage:amaneRuntime.siteCount", { count: d.sites.length })
				})
			] }),
			/* @__PURE__ */ (0, X.jsxs)(E, {
				divided: !0,
				children: [
					d.sites.length ? /* @__PURE__ */ (0, X.jsx)(u, {
						summary: H("manage:amaneRuntime.showSites"),
						children: /* @__PURE__ */ (0, X.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: ge(d.sites.map((e) => N(e, "label")))
						})
					}) : null,
					d.problem ? /* @__PURE__ */ (0, X.jsx)(b, {
						tone: "error",
						children: d.problem
					}) : /* @__PURE__ */ (0, X.jsx)(_, { children: H("manage:amaneRuntime.help", {
						license: d.license,
						version: d.version
					}) }),
					o ? /* @__PURE__ */ (0, X.jsx)(O, {
						embedded: !0,
						kind: A("amane-bridge"),
						label: H("manage:amaneRuntime.rebuilding")
					}) : null,
					v ? /* @__PURE__ */ (0, X.jsx)(b, {
						tone: "error",
						children: v
					}) : null,
					s?.status === "complete" ? /* @__PURE__ */ (0, X.jsx)(b, {
						tone: "success",
						children: N(s, "result") || H("manage:amaneRuntime.rebuilt")
					}) : null
				]
			}),
			/* @__PURE__ */ (0, X.jsxs)(g, { children: [/* @__PURE__ */ (0, X.jsx)(i, {
				variant: "secondary",
				onClick: () => {
					h || l.mutate();
				},
				...M(l.isPending),
				children: H("manage:amaneRuntime.checkUpstream")
			}), /* @__PURE__ */ (0, X.jsx)(i, {
				disabled: !!d.problem,
				onClick: () => {
					h || c.mutate();
				},
				...M(o || c.isPending),
				children: d.installed ? H("manage:amaneRuntime.reinstall") : H("manage:amaneRuntime.install")
			})] })
		]
	});
}
function Ve({ toast: e }) {
	let t = K({
		queryKey: C,
		queryFn: ({ signal: e }) => pe(e)
	}), n = t.data;
	return n ? /* @__PURE__ */ (0, X.jsxs)(q, { children: [
		/* @__PURE__ */ (0, X.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: H("manage:scrapingSources.proxyHint")
		}),
		/* @__PURE__ */ (0, X.jsx)(Le, { toast: e }),
		/* @__PURE__ */ (0, X.jsx)(ze, { toast: e }),
		/* @__PURE__ */ (0, X.jsx)(Oe, { receipt: e }),
		(n.sources || []).map((t) => /* @__PURE__ */ (0, X.jsx)(Pe, {
			source: t,
			toast: e
		}, t.source)),
		/* @__PURE__ */ (0, X.jsx)(Be, { toast: e })
	] }) : /* @__PURE__ */ (0, X.jsx)(q, { children: /* @__PURE__ */ (0, X.jsx)(b, {
		tone: "error",
		title: H("manage:scrapingSources.loadFailedTitle"),
		children: t.error ? F(t.error) : H("manage:scrapingSources.loadFailed")
	}) });
}
export { Ve as ScrapingPage, je as linkHost, Ae as networkOptions };

//# debugId=46170e15-4515-407f-8b87-9c2ad4a9d7bf