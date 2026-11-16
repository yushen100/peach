(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "cf58b8e7-42e7-42cd-8562-489117511a06", e._sentryDebugIdIdentifier = "sentry-dbid-cf58b8e7-42e7-42cd-8562-489117511a06");
	} catch {}
})();
import { $fe21c36db05242bb$export$d7b12c4107be0d61 as e, AMANE_BRIDGE_CHECK_URL as t, AMANE_BRIDGE_KEY as n, AMANE_BRIDGE_REBUILD_URL as r, Button as i, CHECK_ALL_KEY as a, COVER_JOB_KEY as o, CUSTOM_SOURCES_KEY as s, CUSTOM_SOURCES_URL as c, Checkbox as l, Disclosure as u, ErrorText as d, ExternalLink as f, Fact as p, FactList as m, FieldLabel as h, Footer as g, Help as _, Input as v, IssueRow as y, LinkButton as ee, Note as b, Rows as te, SCRAPING_CHECK_ALL_URL as x, SCRAPING_CHECK_URL as ne, SCRAPING_COVER_URL as S, SCRAPING_KEY as C, SCRAPING_SETTINGS_URL as re, SEGMENT as ie, SEGMENTED_TRACK as ae, Section as w, SegmentedRadioGroup as oe, Select$1 as se, SelectField as T, SelectItem as ce, SettingsRow as le, SiteMark as E, Stack as D, StatusLabel as O, TaskProgress as k, __toESM as A, activityKind as j, apiSend as M, busyProps as N, checkText as ue, codedText as P, composingKey as F, confirmModal as de, errorMessage as I, esc as L, fetchAmaneBridge as R, fetchCheckAllJob as z, fetchCoverJob as B, fetchCustomSources as V, fetchSources as fe, i2 as pe, interfaceLanguage as me, jobText as H, joinList as he, momentText as ge, partsLabel as _e, queryClient as U, require_jsx_runtime as ve, require_react as ye, serverLabel as be, spinnerHtml as xe, t as W, useAction as G, useBackgroundJob as K, useMutation as q, useQuery as J } from "./peach-app.js";
import { ConnectionStatus as Se } from "./peach-app.connection-status-BrXhLGSm.js";
import { Page as Y } from "./peach-app.page-QAncjzM1.js";
import { CodeBlock as Ce } from "./peach-app.code-block-CXu10nIP.js";
// src/react/scraping/custom-sources.tsx
var X = /* @__PURE__ */ A(ye(), 1), Z = ve(), we = [
	["code", W("manage:shared.code")],
	["title", W("manage:shared.title")],
	["studio", W("manage:customSources.fieldStudio")],
	["series", W("manage:shared.series")],
	["release_date", W("manage:shared.releaseDate")],
	["performers", W("manage:customSources.fieldPerformers")],
	["tags", W("manage:customSources.fieldTags")]
], Te = [
	["censored", W("manage:customSources.typeCensored")],
	["amateur", W("manage:customSources.typeAmateur")],
	["uncensored", W("manage:shared.uncensored")],
	["fc2", "FC2"],
	["kmib", W("manage:customSources.typeKoreanMib")],
	["other", W("manage:shared.other")],
	["unsure", W("manage:customSources.typeUnverifiedCode")],
	["unknown", W("manage:shared.unknown")]
], Ee = () => ({
	name: "",
	endpoint: "",
	enabled: !1,
	fields: {
		code: "id",
		title: "title"
	},
	content_types: ["censored"]
});
function De({ receipt: e }) {
	let [t, n] = (0, X.useState)(null), r = J({
		queryKey: s,
		queryFn: ({ signal: e }) => V(e)
	}), a = G(), o = (e) => U.setQueryData(s, e), l = !!(r.isPending || r.error || r.data?.items.length || a.error), u = /* @__PURE__ */ (0, Z.jsx)(i, {
		variant: "secondary",
		onClick: () => n(Ee()),
		children: W("manage:customSources.addSource")
	});
	return /* @__PURE__ */ (0, Z.jsxs)(w, {
		title: W("manage:customSources.title"),
		children: [
			l ? /* @__PURE__ */ (0, Z.jsxs)(D, { children: [
				r.isPending ? /* @__PURE__ */ (0, Z.jsx)("div", {
					"aria-busy": "true",
					"data-skeleton": "",
					"aria-label": W("manage:customSources.loading")
				}) : null,
				r.error ? /* @__PURE__ */ (0, Z.jsx)(d, { children: I(r.error) }) : null,
				r.data?.items.map((t) => /* @__PURE__ */ (0, Z.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, Z.jsx)("span", {
							className: "min-w-0 flex-1",
							children: t.name
						}),
						/* @__PURE__ */ (0, Z.jsx)(O, {
							tone: t.enabled ? "success" : "neutral",
							children: t.enabled ? W("manage:customSources.enabled") : W("manage:customSources.disabled")
						}),
						/* @__PURE__ */ (0, Z.jsx)(i, {
							variant: "secondary",
							onClick: () => n(t),
							children: W("manage:shared.edit")
						}),
						/* @__PURE__ */ (0, Z.jsx)(i, {
							variant: "secondary",
							...N(a.busy === t.id),
							onClick: () => void a.run(t.id, (e) => M(c, {
								...t,
								enabled: !t.enabled
							}, "POST", e), (n) => {
								o(n), e(t.enabled ? W("manage:customSources.sourceDisabled") : W("manage:customSources.sourceEnabled"));
							}),
							children: t.enabled ? W("manage:customSources.disable") : W("manage:customSources.enable")
						}),
						/* @__PURE__ */ (0, Z.jsx)(i, {
							variant: "danger",
							onClick: () => de({
								title: W("manage:customSources.deleteTitle"),
								body: W("manage:customSources.deleteBody", { name: L(t.name) }),
								confirmLabel: W("manage:customSources.deleteConfirm"),
								danger: !0,
								onConfirm: async () => {
									o(await M(c, {
										action: "delete",
										id: t.id
									})), n(null), e(W("manage:customSources.deleted"));
								}
							}),
							children: W("manage:shared.delete")
						})
					]
				}, t.id)),
				a.error ? /* @__PURE__ */ (0, Z.jsx)(d, { children: a.error }) : null
			] }) : null,
			t ? null : l ? /* @__PURE__ */ (0, Z.jsx)(g, { children: u }) : /* @__PURE__ */ (0, Z.jsx)(D, { children: /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex justify-end",
				children: u
			}) }),
			t ? /* @__PURE__ */ (0, Z.jsx)(Oe, {
				initial: t,
				cancel: () => n(null),
				saved: (t) => {
					o(t), n(null), e(W("manage:customSources.saved"));
				}
			}, t.id || "new") : null
		]
	});
}
function Oe({ initial: e, cancel: t, saved: n }) {
	let [r, a] = (0, X.useState)(e), [o, s] = (0, X.useState)(""), [u, f] = (0, X.useState)(""), p = (0, X.useRef)(0), m = G(), y = (e) => {
		p.current++, a((t) => ({
			...t,
			...e
		})), f("");
	};
	return /* @__PURE__ */ (0, Z.jsxs)("form", {
		"aria-label": W("manage:customSources.formLabel"),
		"aria-busy": m.busy === "preview",
		onSubmit: (e) => {
			e.preventDefault(), m.run("save", (e) => M(c, r, "POST", e), n);
		},
		children: [/* @__PURE__ */ (0, Z.jsxs)(D, { children: [
			/* @__PURE__ */ (0, Z.jsx)(v, {
				label: W("manage:customSources.name"),
				value: r.name,
				maxLength: 80,
				onChange: (e) => y({ name: e })
			}),
			/* @__PURE__ */ (0, Z.jsx)(v, {
				label: W("manage:customSources.endpoint"),
				value: r.endpoint,
				maxLength: 2048,
				placeholder: "https://example.com/api/movies/{code}",
				onChange: (e) => y({ endpoint: e })
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(h, { children: W("manage:customSources.network") }), /* @__PURE__ */ (0, Z.jsx)(T, {
					id: "custom-source-network",
					label: W("manage:customSources.network"),
					epoch: 0,
					value: r.network || "direct",
					options: [["direct", W("manage:processingTraffic.connectionDirect")], ["peach_proxy", W("manage:customSources.peachProxy")]],
					onPick: (e) => y({ network: e })
				})]
			}),
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)(h, { children: W("manage:customSources.codeFormat") }), /* @__PURE__ */ (0, Z.jsx)(T, {
					id: "custom-source-code-format",
					label: W("manage:customSources.codeFormat"),
					epoch: 0,
					value: r.code_format || "original",
					options: [
						["original", W("manage:customSources.codeAsIs")],
						["lowercase", W("manage:customSources.codeLowercase")],
						["compact", W("manage:customSources.codeNoHyphens")],
						["underscore", W("manage:customSources.codeUnderscores")]
					],
					onPick: (e) => y({ code_format: e })
				})]
			}),
			/* @__PURE__ */ (0, Z.jsx)(_, { children: W("manage:customSources.help") }),
			we.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(v, {
				label: W("manage:customSources.fieldPath", { field: t }),
				value: r.fields[e] || "",
				onChange: (t) => {
					let n = { ...r.fields };
					t ? n[e] = t : delete n[e], y({ fields: n });
				}
			}, e)),
			/* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex flex-wrap gap-3",
				role: "group",
				"aria-label": W("manage:customSources.contentTypes"),
				children: Te.map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(l, {
					isSelected: r.content_types.includes(e),
					onChange: (t) => y({ content_types: t ? [...r.content_types, e] : r.content_types.filter((t) => t !== e) }),
					children: t
				}, e))
			}),
			/* @__PURE__ */ (0, Z.jsx)(l, {
				isSelected: r.enabled,
				onChange: (e) => y({ enabled: e }),
				children: W("manage:customSources.enableSource")
			}),
			/* @__PURE__ */ (0, Z.jsx)(v, {
				label: W("manage:customSources.testCode"),
				value: o,
				onChange: (e) => {
					p.current++, s(e), f("");
				},
				onKeyDown: (e) => {
					if (e.key !== "Enter" || F(e.nativeEvent)) return;
					e.preventDefault();
					let t = p.current;
					m.run("preview", (e) => M(c, {
						...r,
						code: o,
						action: "preview"
					}, "POST", e), (e) => {
						t === p.current && f(JSON.stringify(e.record, null, 2));
					}, (e) => {
						t === p.current && m.setError(I(e));
					});
				}
			}),
			m.busy === "preview" ? /* @__PURE__ */ (0, Z.jsxs)(_, {
				role: "status",
				children: [/* @__PURE__ */ (0, Z.jsx)("span", { dangerouslySetInnerHTML: { __html: xe(W("manage:customSources.testing")) } }), W("manage:customSources.testing")]
			}) : null,
			u ? /* @__PURE__ */ (0, Z.jsx)(Ce, {
				code: u,
				language: "json",
				label: W("manage:customSources.response")
			}) : null,
			m.error ? /* @__PURE__ */ (0, Z.jsx)(d, { children: m.error }) : null
		] }), /* @__PURE__ */ (0, Z.jsxs)(g, { children: [/* @__PURE__ */ (0, Z.jsx)(i, {
			variant: "secondary",
			type: "button",
			onClick: t,
			children: W("manage:shared.cancel")
		}), /* @__PURE__ */ (0, Z.jsx)(i, {
			type: "submit",
			...N(m.busy === "save"),
			children: W("manage:customSources.saveSource")
		})] })]
	});
}
// src/react/scraping/scraping-page.tsx
var Q = [["peach", W("manage:customSources.peachProxy")], ["direct", W("manage:sourceSettings.direct")]];
function ke(e) {
	return Q.some(([t]) => t === e) || !e ? [...Q] : [...Q, [e, e]];
}
function Ae(e) {
	try {
		return new URL(e).host || e;
	} catch {
		return e;
	}
}
var je = [["paste", W("manage:sourceSettings.pasteCookie")], ["file", W("manage:sourceSettings.uploadFile")]];
function Me() {
	return /* @__PURE__ */ (0, Z.jsx)(E, { source: "github" });
}
function Ne({ source: t, toast: n }) {
	let [r, a] = (0, X.useState)(t.network), [o, s] = (0, X.useState)(""), [c, l] = (0, X.useState)(""), [u, p] = (0, X.useState)(je[0][0]), [m, _] = (0, X.useState)(""), [y, x] = (0, X.useState)(""), S = (0, X.useRef)(null);
	function T() {
		s(""), l(""), _(""), x(""), S.current && (S.current.value = "");
	}
	let k = q({
		mutationFn: (e) => M(re, {
			source: t.source,
			network: r,
			cookie: o,
			cookies_text: c,
			revoke: e
		}),
		onSuccess: (e, t) => {
			U.setQueryData(C, (t) => t && {
				...t,
				sources: t.sources.map((t) => t.source === e.saved.source ? e.saved : t)
			}), T(), n(W(t ? "manage:sourceSettings.cookieRevoked" : "manage:sourceSettings.saved"));
		}
	}), A = q({ mutationFn: () => M(ne, { source: t.source }) }), j = k.isPending || A.isPending, F = (e) => {
		e.preventDefault(), j || (A.reset(), k.mutate(!1));
	}, de = () => {
		j || (A.reset(), k.mutate(!0));
	}, L = () => {
		j || (k.reset(), A.mutate());
	};
	async function R(e) {
		let t = e.currentTarget, n = t.files?.[0];
		if (l(""), x(""), !n) _("");
		else if (n.size > 262144) t.value = "", _(""), x(W("manage:sourceSettings.cookieTooLarge"));
		else try {
			let e = await n.text();
			l(e), _(n.name);
		} catch {
			x(W("manage:sourceSettings.cookieFileUnread"));
		}
	}
	let z = y || (k.error ? I(k.error) : "") || (A.error ? I(A.error) : ""), B = A.data?.results ?? [], V = r === "peach" || t.accepts_cookie || t.browser || !!z || B.length > 0;
	return /* @__PURE__ */ (0, Z.jsxs)(w, {
		title: P(t, "label"),
		onSubmit: F,
		aside: /* @__PURE__ */ (0, Z.jsxs)("span", {
			className: "flex min-w-0 items-center gap-1",
			children: [/* @__PURE__ */ (0, Z.jsx)(E, { source: t.source }), t.login ? /* @__PURE__ */ (0, Z.jsx)(f, {
				href: t.login,
				children: Ae(t.login)
			}) : null]
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsx)(te, { children: /* @__PURE__ */ (0, Z.jsx)(le, {
				label: W("manage:sourceSettings.connectionMode"),
				children: /* @__PURE__ */ (0, Z.jsx)(se, {
					"aria-label": W("manage:sourceSettings.connectionMode"),
					className: "w-44 min-w-0",
					selectedKey: r,
					onSelectionChange: (e) => {
						e !== null && a(String(e));
					},
					children: ke(r).map(([e, t]) => /* @__PURE__ */ (0, Z.jsx)(ce, {
						id: e,
						children: t
					}, e))
				})
			}) }),
			t.cooldown_until && t.cooldown_until > Date.now() / 1e3 ? /* @__PURE__ */ (0, Z.jsx)(b, {
				tone: "warning",
				children: /* @__PURE__ */ (0, Z.jsxs)("span", {
					className: "inline-flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, Z.jsx)(O, {
						tone: "warning",
						children: W("manage:sourceSettings.coolingDown")
					}), /* @__PURE__ */ (0, Z.jsx)("span", { children: W("manage:sourceSettings.retryAfter", { time: (/* @__PURE__ */ new Date(t.cooldown_until * 1e3)).toLocaleString(me) }) })]
				})
			}) : null,
			V ? /* @__PURE__ */ (0, Z.jsxs)(D, {
				divided: !0,
				children: [
					r === "peach" ? /* @__PURE__ */ (0, Z.jsx)("span", {
						className: "self-start",
						children: /* @__PURE__ */ (0, Z.jsx)(ee, {
							href: "/settings/library#peachProxy",
							size: "small",
							trailingIcon: pe,
							children: W("manage:sourceSettings.setUpProxy")
						})
					}) : null,
					t.browser ? /* @__PURE__ */ (0, Z.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: W("manage:sourceSettings.browserVerification")
					}) : null,
					t.accepts_cookie && !t.browser ? /* @__PURE__ */ (0, Z.jsxs)(Z.Fragment, { children: [
						/* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [/* @__PURE__ */ (0, Z.jsx)("span", {
								className: "self-start",
								children: /* @__PURE__ */ (0, Z.jsx)(O, {
									tone: t.cookie_saved ? "success" : "neutral",
									children: t.cookie_saved ? W("manage:sourceSettings.cookieSaved") : W("manage:sourceSettings.cookieNotSet")
								})
							}), /* @__PURE__ */ (0, Z.jsx)("p", {
								className: "text-body-2-regular text-text-secondary",
								children: t.cookie_saved ? W("manage:sourceSettings.signInUnverified") : W("manage:sourceSettings.provideCookieHint")
							})]
						}),
						/* @__PURE__ */ (0, Z.jsx)(oe, {
							"aria-label": W("manage:sourceSettings.cookieMethod"),
							value: u,
							onChange: (e) => {
								p(e), T();
							},
							className: ae,
							children: je.map(([t, n]) => /* @__PURE__ */ (0, Z.jsx)(e, {
								value: t,
								className: ie,
								children: n
							}, t))
						}),
						u === "paste" ? /* @__PURE__ */ (0, Z.jsx)(v, {
							type: "password",
							label: "Cookie",
							autoComplete: "off",
							value: o,
							onChange: s
						}) : /* @__PURE__ */ (0, Z.jsxs)("div", {
							className: "flex flex-col gap-2",
							children: [
								/* @__PURE__ */ (0, Z.jsx)(h, { children: W("manage:sourceSettings.cookieFileLabel") }),
								/* @__PURE__ */ (0, Z.jsxs)("div", {
									className: "flex flex-wrap items-center gap-3",
									children: [/* @__PURE__ */ (0, Z.jsx)(i, {
										variant: "secondary",
										onClick: () => S.current?.click(),
										children: W("manage:sourceSettings.chooseFile")
									}), /* @__PURE__ */ (0, Z.jsx)("span", {
										className: "min-w-0 text-body-2-regular break-all text-text-secondary",
										children: m || W("manage:sourceSettings.noFileChosen")
									})]
								}),
								/* @__PURE__ */ (0, Z.jsx)("input", {
									ref: S,
									type: "file",
									accept: ".txt",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									onChange: (e) => {
										R(e);
									}
								})
							]
						})
					] }) : null,
					z ? /* @__PURE__ */ (0, Z.jsx)(d, { children: z }) : null,
					B.map((e) => /* @__PURE__ */ (0, Z.jsx)(b, {
						tone: e.ok ? "success" : "error",
						children: /* @__PURE__ */ (0, Z.jsxs)("span", {
							className: "flex flex-col items-start gap-1",
							children: [/* @__PURE__ */ (0, Z.jsx)(Se, {
								tone: e.ok ? "success" : "error",
								children: e.ok ? W("manage:sourceSettings.reachable") : W("manage:sourceSettings.connectionFailed")
							}), /* @__PURE__ */ (0, Z.jsx)("span", { children: ue(e, P(t, "label")) })]
						})
					}, e.label))
				]
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)(g, { children: [
				t.accepts_cookie && t.cookie_saved ? /* @__PURE__ */ (0, Z.jsx)(i, {
					variant: "secondary",
					onClick: de,
					...N(j),
					children: W("manage:sourceSettings.revokeCookie")
				}) : null,
				/* @__PURE__ */ (0, Z.jsx)(i, {
					variant: "secondary",
					onClick: L,
					...N(j),
					children: W("manage:sourceSettings.testConnection")
				}),
				/* @__PURE__ */ (0, Z.jsx)(i, {
					type: "submit",
					...N(j),
					children: W("manage:shared.save")
				})
			] })
		]
	});
}
var Pe = {
	ok: "success",
	auth: "warning",
	http: "error",
	cooldown: "warning",
	network: "error",
	skipped: "neutral"
}, $ = [
	"ok",
	"auth",
	"cooldown",
	"http",
	"network",
	"skipped"
];
function Fe(e, t) {
	let n = P(e, "label");
	return t.target === "cdn" ? W("manage:connectionCheck.hdImages", { source: n }) : n;
}
function Ie({ toast: e }) {
	let { job: t, running: n, start: r, query: o } = K({
		queryKey: a,
		queryFn: ({ signal: e }) => z(e),
		start: () => M(x, {}),
		onFinish: (t) => {
			U.invalidateQueries({
				queryKey: C,
				exact: !0
			}), t.status === "complete" && e(t.failed ? W("manage:connectionCheck.doneWithFailures", { count: t.failed }) : W("manage:connectionCheck.doneAllReachable"));
		}
	}), s = (e) => {
		e.preventDefault(), !o.data || n || r.isPending || r.mutate();
	}, c = (t?.results ?? []).flatMap((e) => e.results.map((t) => ({
		source: e.source,
		name: Fe(e, t),
		check: t
	}))), l = (e, t) => /* @__PURE__ */ (0, Z.jsxs)("span", {
		className: "inline-flex min-w-0 items-center gap-1.5",
		children: [/* @__PURE__ */ (0, Z.jsx)(E, { source: e }), t]
	}), d = c.filter(({ check: e }) => e.outcome === "ok"), f = c.filter(({ check: e }) => e.outcome !== "ok").sort((e, t) => $.indexOf(e.check.outcome) - $.indexOf(t.check.outcome)), h = r.error ? I(r.error) : o.error ? I(o.error) : t?.status === "failed" ? H(t, "error") || W("manage:connectionCheck.notFinished") : "", v = t?.status === "complete" && t.completed_at ? [ge((/* @__PURE__ */ new Date(t.completed_at * 1e3)).toISOString()), t.elapsed_s === void 0 ? "" : W("manage:connectionCheck.elapsed", { seconds: t.elapsed_s.toFixed(1) })].filter(Boolean).join(" · ") : "";
	return /* @__PURE__ */ (0, Z.jsxs)(w, {
		id: "check-all",
		title: W("manage:connectionCheck.title"),
		onSubmit: s,
		children: [/* @__PURE__ */ (0, Z.jsxs)(D, { children: [
			o.isPending ? /* @__PURE__ */ (0, Z.jsx)("div", {
				role: "status",
				"aria-label": W("manage:connectionCheck.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, Z.jsx)(_, { children: W("manage:connectionCheck.help") }),
			n ? /* @__PURE__ */ (0, Z.jsx)(k, {
				embedded: !0,
				kind: "radar",
				value: t?.checked ?? 0,
				total: t?.total ?? 0,
				label: W("manage:connectionCheck.checkedCount", {
					checked: t?.checked ?? 0,
					count: t?.total ?? 0
				})
			}) : null,
			h ? /* @__PURE__ */ (0, Z.jsx)(b, {
				tone: "error",
				children: h
			}) : null,
			c.length ? /* @__PURE__ */ (0, Z.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: $.map((e) => {
					let t = c.filter(({ check: t }) => t.outcome === e).length;
					return t ? /* @__PURE__ */ (0, Z.jsxs)(O, {
						tone: Pe[e],
						children: [
							P(c.find(({ check: t }) => t.outcome === e)?.check, "outcome_label"),
							" ",
							t
						]
					}, e) : null;
				})
			}) : null,
			f.length ? /* @__PURE__ */ (0, Z.jsx)("ul", {
				className: "flex min-w-0 flex-col",
				children: f.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, Z.jsx)(y, {
					title: l(e, t),
					children: /* @__PURE__ */ (0, Z.jsxs)("span", {
						className: "flex flex-wrap items-center gap-2",
						children: [/* @__PURE__ */ (0, Z.jsx)(O, {
							tone: Pe[n.outcome],
							children: P(n, "outcome_label")
						}), n.message ? /* @__PURE__ */ (0, Z.jsx)("span", {
							className: "text-body-2-regular text-text-secondary",
							children: P(n, "message")
						}) : null]
					})
				}, t))
			}) : null,
			d.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
				summary: W("manage:connectionCheck.reachableCount", { count: d.length }),
				children: /* @__PURE__ */ (0, Z.jsx)(m, { children: d.map(({ source: e, name: t, check: n }) => /* @__PURE__ */ (0, Z.jsx)(p, {
					term: l(e, t),
					children: [n.width ? `${n.width} × ${n.height}` : "", n.elapsed_s === void 0 ? "" : W("manage:connectionCheck.seconds", { seconds: n.elapsed_s.toFixed(2) })].filter(Boolean).join(" · ")
				}, t)) })
			}) : null
		] }), /* @__PURE__ */ (0, Z.jsx)(g, {
			status: v ? W("manage:connectionCheck.lastChecked", { time: v }) : void 0,
			children: /* @__PURE__ */ (0, Z.jsx)(i, {
				type: "submit",
				disabled: !o.data,
				...N(n || r.isPending),
				children: W("manage:connectionCheck.checkAll")
			})
		})]
	});
}
var Le = (e) => be(e.result_code ?? "", e.result ?? "", e.result_params), Re = (e) => _e(e.error_parts, H(e, "error"));
function ze({ toast: e }) {
	let [t, n] = (0, X.useState)(""), { running: r, outcome: a, start: s, query: c } = K({
		queryKey: o,
		queryFn: ({ signal: e }) => B(e),
		start: () => M(S, { code: t }),
		onFinish: (t) => {
			t.status === "complete" && e(Le(t) || W("manage:hdCover.fetched"));
		}
	}), l = (e) => {
		e.preventDefault(), c.data && !r && !s.isPending && t.trim() && s.mutate();
	}, u = s.error ? I(s.error) : c.error ? I(c.error) : a?.status === "failed" ? Re(a) || W("manage:hdCover.notFound") : "";
	return /* @__PURE__ */ (0, Z.jsx)(w, {
		title: W("manage:hdCover.title"),
		onSubmit: l,
		children: /* @__PURE__ */ (0, Z.jsxs)(D, { children: [
			c.isPending ? /* @__PURE__ */ (0, Z.jsx)("div", {
				role: "status",
				"aria-label": W("manage:hdCover.loadingStatus"),
				"data-skeleton": "",
				className: "skeleton-sheen h-6 rounded-md"
			}) : null,
			/* @__PURE__ */ (0, Z.jsxs)("div", {
				className: "flex flex-wrap items-end gap-2",
				children: [/* @__PURE__ */ (0, Z.jsx)("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ (0, Z.jsx)(v, {
						"aria-label": W("manage:hdCover.codeLabel"),
						isRequired: !0,
						isDisabled: r,
						value: t,
						onChange: n,
						placeholder: W("manage:hdCover.codePlaceholder")
					})
				}), /* @__PURE__ */ (0, Z.jsx)(i, {
					type: "submit",
					disabled: !c.data || !t.trim(),
					...N(r || s.isPending),
					children: W("manage:hdCover.fetchCover")
				})]
			}),
			r ? /* @__PURE__ */ (0, Z.jsx)(k, {
				embedded: !0,
				kind: j("scraping-cover"),
				label: W("manage:hdCover.fetching")
			}) : null,
			u ? /* @__PURE__ */ (0, Z.jsx)(b, {
				tone: "error",
				children: u
			}) : null,
			a?.status === "complete" ? /* @__PURE__ */ (0, Z.jsx)(b, {
				tone: "success",
				children: Le(a) || W("manage:hdCover.fetched")
			}) : null
		] })
	});
}
function Be({ toast: e }) {
	let { query: a, running: o, outcome: s, start: c } = K({
		queryKey: n,
		queryFn: ({ signal: e }) => R(e),
		start: () => M(r, {}),
		jobOf: (e) => e.job,
		withJob: (e, t) => e && {
			...e,
			job: t
		},
		onFinish: (t) => {
			t.status === "complete" && e(P(t, "result") || W("manage:amaneRuntime.rebuilt"));
		}
	}), l = q({ mutationFn: () => M(t, {}) }), d = a.data;
	if (!d) return a.error ? /* @__PURE__ */ (0, Z.jsx)(w, {
		id: "amane",
		title: "amane",
		children: /* @__PURE__ */ (0, Z.jsx)(D, { children: /* @__PURE__ */ (0, Z.jsx)(b, {
			tone: "error",
			children: I(a.error)
		}) })
	}) : null;
	let h = o || c.isPending || l.isPending, v = c.error ? I(c.error) : l.error ? I(l.error) : s?.status === "failed" ? H(s, "error") || W("manage:amaneRuntime.rebuildNotFinished") : "";
	return /* @__PURE__ */ (0, Z.jsxs)(w, {
		id: "amane",
		title: "amane",
		aside: /* @__PURE__ */ (0, Z.jsx)(f, {
			href: d.repository,
			leadingIcon: Me,
			children: d.repository
		}),
		children: [
			/* @__PURE__ */ (0, Z.jsxs)(m, { children: [
				/* @__PURE__ */ (0, Z.jsx)(p, {
					term: W("manage:amaneRuntime.installedVersion"),
					children: d.installed_version || W("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, Z.jsx)(p, {
					term: W("manage:amaneRuntime.latestVersion"),
					children: l.data ? P(l.data, "latest") : W("manage:amaneRuntime.notChecked")
				}),
				/* @__PURE__ */ (0, Z.jsx)(p, {
					term: W("manage:amaneRuntime.runtime"),
					children: d.installed ? W("manage:amaneRuntime.installed") : W("manage:amaneRuntime.notInstalled")
				}),
				/* @__PURE__ */ (0, Z.jsx)(p, {
					term: W("manage:amaneRuntime.builtInSites"),
					children: W("manage:amaneRuntime.siteCount", { count: d.sites.length })
				})
			] }),
			/* @__PURE__ */ (0, Z.jsxs)(D, {
				divided: !0,
				children: [
					d.sites.length ? /* @__PURE__ */ (0, Z.jsx)(u, {
						summary: W("manage:amaneRuntime.showSites"),
						children: /* @__PURE__ */ (0, Z.jsx)("p", {
							className: "text-body-2-regular text-text-secondary",
							children: he(d.sites.map((e) => P(e, "label")))
						})
					}) : null,
					d.problem ? /* @__PURE__ */ (0, Z.jsx)(b, {
						tone: "error",
						children: d.problem
					}) : /* @__PURE__ */ (0, Z.jsx)(_, { children: W("manage:amaneRuntime.help", {
						license: d.license,
						version: d.version
					}) }),
					o ? /* @__PURE__ */ (0, Z.jsx)(k, {
						embedded: !0,
						kind: j("amane-bridge"),
						label: W("manage:amaneRuntime.rebuilding")
					}) : null,
					v ? /* @__PURE__ */ (0, Z.jsx)(b, {
						tone: "error",
						children: v
					}) : null,
					s?.status === "complete" ? /* @__PURE__ */ (0, Z.jsx)(b, {
						tone: "success",
						children: P(s, "result") || W("manage:amaneRuntime.rebuilt")
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Z.jsxs)(g, { children: [/* @__PURE__ */ (0, Z.jsx)(i, {
				variant: "secondary",
				onClick: () => {
					h || l.mutate();
				},
				...N(l.isPending),
				children: W("manage:amaneRuntime.checkUpstream")
			}), /* @__PURE__ */ (0, Z.jsx)(i, {
				disabled: !!d.problem,
				onClick: () => {
					h || c.mutate();
				},
				...N(o || c.isPending),
				children: d.installed ? W("manage:amaneRuntime.reinstall") : W("manage:amaneRuntime.install")
			})] })
		]
	});
}
function Ve({ toast: e }) {
	let t = J({
		queryKey: C,
		queryFn: ({ signal: e }) => fe(e)
	}), n = t.data;
	return n ? /* @__PURE__ */ (0, Z.jsxs)(Y, { children: [
		/* @__PURE__ */ (0, Z.jsx)("p", {
			className: "text-body-2-regular text-text-secondary",
			children: W("manage:scrapingSources.proxyHint")
		}),
		/* @__PURE__ */ (0, Z.jsx)(Ie, { toast: e }),
		/* @__PURE__ */ (0, Z.jsx)(ze, { toast: e }),
		/* @__PURE__ */ (0, Z.jsx)(De, { receipt: e }),
		(n.sources || []).map((t) => /* @__PURE__ */ (0, Z.jsx)(Ne, {
			source: t,
			toast: e
		}, t.source)),
		/* @__PURE__ */ (0, Z.jsx)(Be, { toast: e })
	] }) : /* @__PURE__ */ (0, Z.jsx)(Y, { children: /* @__PURE__ */ (0, Z.jsx)(b, {
		tone: "error",
		title: W("manage:scrapingSources.loadFailedTitle"),
		children: t.error ? I(t.error) : W("manage:scrapingSources.loadFailed")
	}) });
}
export { Ve as ScrapingPage, Ae as linkHost, ke as networkOptions };

//# debugId=cf58b8e7-42e7-42cd-8562-489117511a06