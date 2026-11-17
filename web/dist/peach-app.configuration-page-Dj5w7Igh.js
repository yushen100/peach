(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "db02cb9d-45be-45e9-a14a-4e1830228f9d", e._sentryDebugIdIdentifier = "sentry-dbid-db02cb9d-45be-45e9-a14a-4e1830228f9d");
	} catch {}
})();
import { $2ec61d1d4f780267$export$a8a3e93435678ff9 as e, $3a442827418ebe87$export$eb2fcfdbd7ba97d4 as t, $542a13ca2fa5b484$export$5b6b19405a83ff9d as n, $72abaeab4d80592f$export$78efe591171d7d45 as r, $bd263d78e9bf3c56$export$f5c9f3c2c4054eec as i, $ea3928288112382f$export$439d29a4e110a164 as a, $f2ff30fde7b014be$export$3ddf2d174ce01153 as o, $fe21c36db05242bb$export$a98f0dcb43a68a25 as s, $fe21c36db05242bb$export$d7b12c4107be0d61 as c, ACCENTS as l, ActivityStatus as u, ApiError as d, Button as f, ButtonLink as p, CLOUD_LOCATIONS as m, CLOUD_PROXY_HELP as h, CONFIGURATION_KEY as g, CONFIGURATION_SECTIONS as _, CONFIGURATION_URL as v, CREDENTIAL_STATE as y, Checkbox as b, Chip as x, CommandSteps as S, Disclosure as C, ENTRY_LINKS_HELP as ee, ENTRY_LINKS_HINT as te, EmptyState as w, ErrorText as T, Eu as E, ExternalLink as D, FOLLOW_CREDENTIALS_KEY as O, FOLLOW_INITIAL_RANGE_OPTIONS as ne, Fact as k, FactList as re, FieldLabel as ie, Footer as A, Help as j, HintText as ae, Input as M, L1 as oe, LIBRARY_FOLDER_HELP as se, LIBRARY_PROCESSING_KEY as ce, Label as le, LinkButton as ue, M6 as de, MEDIA_PROCESSING_KEY as fe, MEDIA_PROCESSING_URL as pe, MEDIA_SOURCE_ICONS as me, MENU_POPOVER_SURFACE as he, Note as N, PICK_FOLDER_URL as ge, POLICY_COLUMNS as _e, POLICY_COVER_NOTE as ve, POLICY_MATRIX as ye, POLICY_SUMMARY as be, PathLine as xe, ProcessingMode as Se, Progress as Ce, RELEASE_NOTICE_EVENT as we, REPAIR_CENTER_PATH as Te, Rows as P, SCHEDULES as Ee, SCRAPING_KEY as De, SCRAPING_SETTINGS_URL as Oe, SEGMENT as ke, SEGMENTED_TRACK as Ae, SETTINGS_KEY as je, SETTINGS_URL as Me, Section as F, SectionSkeleton as Ne, SegmentedRadioGroup as Pe, Select as Fe, Select$1 as I, SelectItem as L, SettingsCard as Ie, SettingsRow as R, SiteLabel as Le, SortableBoardTabs as Re, SourceLabel as ze, SourceMark as Be, Stack as z, StatusLabel as B, Switch as V, THUMBNAIL_JOBS_KEY as Ve, TaskCenterLink as He, TaskProgress as Ue, TextField as We, TextFieldContext as Ge, Uz as Ke, __toESM as qe, _p as Je, activityKind as Ye, animate as Xe, apiGet as H, apiSend as U, appSettingsStore as Ze, bodyFieldErrors as Qe, boundedPreference as $e, busyProps as W, cardClass as et, checkClientUpdates as tt, cloudProxySkeleton as nt, clsx as rt, cn as it, codedText as G, confirmModal as at, credentialDone as ot, credentialsSkeleton as st, cx as ct, d6 as lt, devicesSkeleton as ut, errorMessage as K, fetchConfiguration as dt, fetchCredentials as ft, fetchLibraryProcessing as pt, fetchMediaProcessing as mt, fetchSettings as ht, fetchSources as gt, fetchThumbnailJobs as _t, fmtSize as vt, i2 as yt, indexersSkeleton as bt, interfaceLanguage as xt, javBrowserSkeleton as St, jobText as Ct, joinList as wt, l1 as Tt, ledgerBackupsSkeleton as Et, localizedFact as Dt, momentText as Ot, motion as kt, overlayHost as At, peachHistory$1 as jt, pickServerFolder as Mt, pollUntil as Nt, previewLibraryColor as Pt, processingActive as Ft, providerIcon as It, queryClient as q, randomId as Lt, rememberShape as Rt, require_jsx_runtime as zt, require_react as Bt, restartEffectText as Vt, saveCredential as Ht, schedulePollInterval as Ut, sectionTitle as Wt, serverLabel as Gt, serverLabelList as Kt, serverText as qt, settingsPath as Jt, shellNavigate as Yt, sortCx as Xt, sourceDefaultCost as Zt, stageText as Qt, t as J, translateWithNodes as $t, useAction as Y, useClientUpdates as en, useLibraryTints as tn, useMutation as nn, useOrderedLibraries as rn, useQuery as X, useQueryClient as an, useReducedMotion as on, useRunSchedule as sn, useSaveSchedule as cn, useSaveSettings as ln, useSaveThumbnailMode as un, we as dn, z3 as fn } from "./peach-app.js";
import { ConnectionStatus as pn } from "./peach-app.connection-status-BrXhLGSm.js";
import { CodeBlock as mn } from "./peach-app.code-block-CXu10nIP.js";
import { AnimatedItems as hn, Cell as gn, ChartBackground as _n, ChartContainer as vn, ChartLegend as yn, ChartLegendContent as bn, ChartTip as xn, ChartTooltip as Sn, ChartTooltipContent as Cn, Curve as wn, DATA_ITEM_GRAPHICAL_ITEM_ID_ATTRIBUTE_NAME as Tn, DATA_ITEM_INDEX_ATTRIBUTE_NAME as En, DefaultZIndexes as Dn, EvilBarChart as On, LabelList as kn, LabelListFromLabelProp as An, Layer as jn, LoadingIndicator as Mn, PolarChart as Nn, PolarLabelContextProvider as Pn, PolarLabelListContextProvider as Fn, RegisterGraphicalItemId as In, Sector as Ln, SetPolarGraphicalItem as Rn, SetPolarLegendPayload as zn, SetTooltipEntrySettings as Bn, Shape as Vn, TIP_SWATCH as Hn, Text as Un, ZIndexLayer as Wn, adaptEventsOfChild as Gn, arrayTooltipSearcher as Kn, createSelector as qn, defaultPolarChartProps as Jn, findAllByType as Yn, get as Xn, getClassNameFromUnknown as Zn, getColorsCount as Qn, getMaxRadius as $n, getPercentValue as er, getTooltipNameProp as tr, getValueByDataKey as nr, interpolate as rr, isNumber as ir, matchAppend as ar, mathSign as or, polarToCartesian as sr, resolveDefaultProps as cr, selectActiveTooltipDataKey as lr, selectActiveTooltipGraphicalItemId as ur, selectActiveTooltipIndex as dr, selectChartDataAndAlwaysIgnoreIndexes as fr, selectChartOffsetInternal as pr, selectUnfilteredPolarItems as mr, svgPropertiesNoEvents as hr, svgPropertiesNoEventsFromUnknown as gr, tone as _r, useAnimationCallbacks as vr, useAppSelector as yr, useMouseClickItemDispatch as br, useMouseEnterItemDispatch as xr, useMouseLeaveItemDispatch as Sr, usePolarChartLayout as Cr } from "./peach-app.chart-tip-CRxYp6KT.js";
import { FolderField as wr, FolderFieldLine as Tr, FolderRow as Er, MEDIA_SOURCES as Dr, MediaReadPolicy as Or, MediaReadPolicyHelp as kr, SourceSelect as Ar, isCloudSource as jr, sourceMark as Mr, useFolderRows as Nr } from "./peach-app.folder-rows-C3hhF_90.js";
import { BrowserIcon as Pr, browserIconId as Fr } from "./peach-app.browser-icon-N9Od-bAf.js";
import { SourceIcon as Ir } from "./peach-app.source-view-CDbKpFus.js";
// src/react/settings/configuration-panel.ts
var Z = /* @__PURE__ */ qe(Bt(), 1), Lr = "flex flex-col gap-6";
function Rr(e) {
	return e ? {
		className: e.active ? `${Lr} ui-board-group-active` : Lr,
		"data-board-group": String(e.index),
		id: e.id,
		role: "tabpanel",
		"aria-labelledby": e.labelledBy
	} : { className: Lr };
}
// src/react/settings/userscript-probe.ts
function zr() {
	let e = (0, Z.useRef)(null), [t, n] = (0, Z.useState)(0), [r, i] = (0, Z.useState)("checking");
	return (0, Z.useEffect)(() => {
		let t = Lt(), n = !1, r = e.current, a, o = () => {
			n = !0, clearInterval(u), i("missing");
		}, s = () => {
			n || (clearTimeout(a), a = setTimeout(o, 3e3), c());
		}, c = () => e.current?.contentWindow?.postMessage({
			type: "peach-userscript:probe",
			nonce: t
		}, window.location.origin), l = (r) => {
			!n && r.source === e.current?.contentWindow && r.origin === window.location.origin && r.data?.type === "peach-userscript:ready" && r.data.nonce === t && r.data.protocol === 1 && typeof r.data.version == "string" && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(r.data.version) && typeof r.data.paired == "boolean" && (n = !0, clearInterval(u), clearTimeout(a), i({
				version: r.data.version,
				paired: r.data.paired
			}));
		};
		window.addEventListener("message", l);
		let u = setInterval(c, 250);
		return a = setTimeout(o, 15e3), r?.addEventListener("load", s), r?.contentDocument?.readyState === "complete" && r.contentDocument.URL !== "about:blank" && s(), c(), () => {
			clearInterval(u), clearTimeout(a), r?.removeEventListener("load", s), window.removeEventListener("message", l);
		};
	}, [t]), {
		frame: e,
		attempt: t,
		status: r,
		retry: () => {
			r !== "checking" && (i("checking"), n((e) => e + 1));
		}
	};
}
// src/react/settings/userscript-status.tsx
var Q = zt();
function Br(e, t) {
	let n = e.split(".").map(Number), r = t.split(".").map(Number);
	for (let e = 0; e < 3; e++) if (n[e] !== r[e]) return n[e] > r[e];
	return !0;
}
function Vr({ enabled: e, release: t }) {
	let { frame: n, attempt: r, status: i, retry: a } = zr(), o = typeof i == "object", s = o && !Br(i.version, t.minimum_version), c = o && !Br(i.version, t.version), l = i === "checking" ? "progress" : i === "missing" ? "neutral" : s || c || !i.paired ? "warning" : "success", u = i === "checking" ? J("settings:userscriptStatus.checking") : i === "missing" ? J("settings:mediaLibraries.dependencyMissing") : s ? J("settings:userscriptStatus.updateRequired") : c ? J("settings:userscriptStatus.updateAvailable") : i.paired ? J("settings:userscriptStatus.connected") : J("settings:userscriptStatus.unpaired"), d = i === "checking" ? "checking" : i === "missing" ? "missing" : s ? "required" : c ? "available" : i.paired ? e ? "enabled" : "disabled" : "unpaired";
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)("iframe", {
		ref: n,
		title: J("settings:userscriptStatus.probeFrame"),
		hidden: !0,
		src: "/integrations/peach-userscript-bridge"
	}, r), /* @__PURE__ */ (0, Q.jsxs)("div", {
		"aria-live": "polite",
		"data-userscript-status": "",
		className: et({
			variant: "raised",
			bordered: "line",
			className: "flex flex-col gap-3"
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-medium text-text-primary",
					children: J("settings:userscriptStatus.title")
				}), /* @__PURE__ */ (0, Q.jsx)(pn, {
					tone: l,
					children: /* @__PURE__ */ (0, Q.jsx)("span", {
						"data-copy-key": `userscript.${d}.status`,
						children: u
					})
				})]
			}),
			o ? /* @__PURE__ */ (0, Q.jsxs)("p", {
				"data-copy-key": "userscript.installed.version",
				className: "text-body-regular text-text-secondary",
				children: [J("settings:userscriptStatus.installedVersion"), i.version]
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-regular text-text-secondary",
					children: J("settings:userscriptStatus.addFromBrowser")
				}), /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: e ? "success" : "neutral",
					children: /* @__PURE__ */ (0, Q.jsx)("span", {
						"data-copy-key": `userscript.adding.${e ? "enabled" : "disabled"}`,
						children: J(e ? "settings:shared.enabled" : "settings:shared.notEnabled")
					})
				})]
			}),
			/* @__PURE__ */ (0, Q.jsx)("p", {
				"data-copy-key": `userscript.${d}.message`,
				className: "text-caption-1-regular text-text-secondary",
				children: i === "checking" ? J("settings:userscriptStatus.checkingHelp") : i === "missing" ? J("settings:userscriptStatus.missingHelp") : s ? J("settings:userscriptStatus.updateRequiredHelp", { version: t.minimum_version }) : c ? J("settings:userscriptStatus.updateAvailableHelp", { version: t.version }) : i.paired ? J(e ? "settings:userscriptStatus.readyHelp" : "settings:userscriptStatus.addingDisabledHelp") : J("settings:userscriptStatus.pairHelp")
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					i === "missing" || s || c ? /* @__PURE__ */ (0, Q.jsx)(D, {
						href: t.install_url,
						children: /* @__PURE__ */ (0, Q.jsx)("span", {
							"data-copy-key": `userscript.${i === "missing" ? "install" : "update"}.action`,
							children: J(s || c ? "settings:userscriptStatus.update" : "settings:userscriptStatus.install")
						})
					}) : null,
					i === "missing" ? /* @__PURE__ */ (0, Q.jsx)(D, {
						href: "https://www.tampermonkey.net/faq.php#Q209",
						children: J("settings:userscriptStatus.permissionGuide")
					}) : null,
					/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						type: "button",
						...W(i === "checking"),
						onClick: a,
						children: J("settings:userscriptStatus.checkAgain")
					})
				]
			})
		]
	})] });
}
// src/react/settings/jav-browser-settings.tsx
var Hr = "/api/configuration/jav-browser";
function Ur({ receipt: e, refreshKey: t }) {
	let n = X({
		queryKey: ["jav-browser-settings", t],
		queryFn: ({ signal: e }) => H(Hr, e),
		refetchOnMount: "always",
		refetchOnWindowFocus: "always"
	});
	return n.error && !n.data ? /* @__PURE__ */ (0, Q.jsx)(T, { children: K(n.error) }) : n.isFetching && !n.data ? /* @__PURE__ */ (0, Q.jsx)(Ne, {
		label: J("settings:browserAdd.loading"),
		html: St
	}) : n.data ? /* @__PURE__ */ (0, Q.jsx)(Wr, {
		initial: n.data,
		receipt: e
	}) : null;
}
function Wr({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(e.provider), [o, s] = (0, Z.useState)(""), c = Y();
	(0, Z.useEffect)(() => {
		Rt("javBrowser", {
			enabled: e.enabled,
			ready: e.providers.some((t) => t.key === e.provider && t.configured && t.target)
		}), r(e), a((t) => e.providers.some((e) => e.key === t) ? t : e.provider), e.enabled || s("");
	}, [e]);
	let l = (e) => {
		c.run(e, (t) => U(Hr, {
			action: e,
			provider: i
		}, "POST", t), (n) => {
			let { token: i = "", ...o } = n;
			r(o), a(o.provider), s(i), t(J(e === "disable" ? "settings:browserAdd.turnedOff" : "settings:browserAdd.tokenIssued"));
		});
	}, u = (e) => {
		c.busy || (r((t) => ({
			...t,
			want_on_no_match: e
		})), c.run("want", (t) => U("/api/settings", { javBrowserWantOnNoMatch: e }, "POST", t), () => t(J("settings:shared.settingsSaved")), (t) => {
			r((t) => ({
				...t,
				want_on_no_match: !e
			})), c.setError(K(t));
		}));
	}, d = n.providers.some((e) => e.key === i && e.configured && e.target);
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "browser",
		title: J("settings:javBrowser.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			children: [
				/* @__PURE__ */ (0, Q.jsx)(Vr, {
					enabled: n.enabled,
					release: n.userscript
				}),
				/* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-col gap-1",
					children: [/* @__PURE__ */ (0, Q.jsx)(ie, { children: J("settings:browserAdd.channel") }), /* @__PURE__ */ (0, Q.jsx)(I, {
						"aria-label": J("settings:browserAdd.channel"),
						selectedKey: i || null,
						placeholder: J("settings:browserAdd.noChannels"),
						onSelectionChange: (e) => {
							e !== null && a(String(e));
						},
						isDisabled: !n.providers.length || !!c.busy,
						children: n.providers.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
							id: e.key,
							textValue: e.label,
							children: /* @__PURE__ */ (0, Q.jsx)(ze, {
								source: e.key,
								label: e.label
							})
						}, e.key))
					})]
				}),
				d ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:browserAdd.needsCloudDrive") }),
				n.problems?.map((e) => /* @__PURE__ */ (0, Q.jsx)(j, { children: e }, e)),
				n.enabled && n.active_provider && !n.providers.some((e) => e.key === n.active_provider) ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:browserAdd.channelUnavailable") }) : null,
				/* @__PURE__ */ (0, Q.jsx)("div", { children: /* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:browserAdd.wantOnNoMatch"),
					description: J("settings:browserAdd.wantOnNoMatchHelp"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:browserAdd.wantOnNoMatch"),
						isSelected: n.want_on_no_match,
						isDisabled: !!c.busy || !n.enabled,
						onChange: u
					})
				}) }),
				/* @__PURE__ */ (0, Q.jsx)(M, {
					label: J("settings:browserAdd.peachUrl"),
					value: window.location.origin,
					isReadOnly: !0,
					autoComplete: "off"
				}),
				o ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
					/* @__PURE__ */ (0, Q.jsx)(M, {
						label: J("settings:browserAdd.token"),
						type: "password",
						value: o,
						isReadOnly: !0,
						autoComplete: "new-password"
					}),
					/* @__PURE__ */ (0, Q.jsx)("div", { children: /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						type: "button",
						onClick: () => {
							c.run("copy", async () => navigator.clipboard.writeText(JSON.stringify({
								peach_pairing: 1,
								base: window.location.origin,
								token: o
							})), () => t(J("settings:browserAdd.pairingCopied")));
						},
						...W(c.busy === "copy"),
						children: J("settings:browserAdd.copyPairing")
					}) }),
					/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:browserAdd.pairingHelp") })
				] }) : null
			]
		}), c.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: c.error }) : null] }), /* @__PURE__ */ (0, Q.jsxs)(A, { children: [n.enabled ? /* @__PURE__ */ (0, Q.jsx)(f, {
			variant: "secondary",
			type: "button",
			disabled: !!c.busy,
			onClick: () => l("disable"),
			children: J("settings:javBrowser.disable")
		}) : null, /* @__PURE__ */ (0, Q.jsx)(f, {
			type: "button",
			disabled: !n.available || !d || !!c.busy,
			onClick: () => l(n.enabled ? "rotate" : "enable"),
			...W(c.busy === "enable" || c.busy === "rotate"),
			children: n.enabled ? J("settings:javBrowser.updateChannelToken") : J("settings:javBrowser.enable")
		})] })]
	});
}
// src/react/settings/download-settings.tsx
var Gr = "/api/configuration/downloads", Kr = "/api/configuration/downloads/check", qr = "/api/configuration/downloads/folder", Jr = "/api/configuration/downloads/pikpak/login", Yr = "/api/configuration/downloads/pikpak/logout", Xr = "/api/configuration/downloads/pikpak/browser-login", Zr = 2e3, Qr = 9e5, $r = It("pikpak"), ei = (e) => (e.problems ?? []).map((t, n) => {
	let r = e.problem_codes?.[n];
	return r?.code ? Gt(r.code, t, r.params) : t;
}), ti = (e) => e.missing.map((t, n) => Gt(e.missing_codes?.[n] ?? "", t));
function ni({ initial: e, receipt: t, panel: n, issues: r }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(n),
		children: [r, e ? /* @__PURE__ */ (0, Q.jsx)(ri, {
			initial: e,
			receipt: t
		}) : null]
	});
}
function ri({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)("");
	(0, Z.useEffect)(() => {
		r((t) => ({
			...t,
			media_sources: e.media_sources,
			pikpak_roots: e.pikpak_roots
		}));
	}, [e.media_sources, e.pikpak_roots]);
	let o = n.media_sources ?? [], s = o.includes("pikpak"), c = o.some((e) => m.includes(e)), l = s && (n.pikpak.logged_in || !!i.trim());
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		c ? /* @__PURE__ */ (0, Q.jsx)(ii, {
			state: n,
			settle: r,
			receipt: t,
			pikpakAccount: l
		}) : null,
		s ? /* @__PURE__ */ (0, Q.jsx)(si, {
			state: n,
			settle: r,
			receipt: t,
			username: i,
			setUsername: a
		}) : null,
		/* @__PURE__ */ (0, Q.jsx)(Ur, {
			receipt: t,
			refreshKey: JSON.stringify([
				n.media_sources,
				n.config,
				n.token_set,
				n.pikpak.logged_in
			])
		})
	] });
}
function ii({ state: e, settle: t, receipt: n, pikpakAccount: r }) {
	let [i, a] = (0, Z.useState)(e.config), [o, s] = (0, Z.useState)(""), [c, l] = (0, Z.useState)(String(e.config.wait_hours)), [d, p] = (0, Z.useState)(null), [m, h] = (0, Z.useState)(""), [g, _] = (0, Z.useState)(ai), [v, y] = (0, Z.useState)(""), [b, x] = (0, Z.useState)(!1), S = Y(), C = e.media_sources ?? [], ee = C.includes("115"), te = C.includes("pikpak"), w = (e) => i.targets[e] ?? "", E = (e, t) => a({
		...i,
		targets: {
			...i.targets,
			[e]: t
		}
	}), D = ee && !(!g.target || g.target.exists || w("115") !== g.target.path), O = (e, t, n = "") => {
		let r = t.target ? e.suggested_target : null, i = !!(r && n && r.path === n), o = t.root ? e.suggested_pikpak_root : "";
		a((n) => ({
			...n,
			clouddrive_address: t.address && e.address ? e.address : n.clouddrive_address,
			targets: r && !i ? {
				...n.targets,
				115: r.path
			} : n.targets,
			pikpak_root: o || n.pikpak_root
		})), p(e), h(t.address ? e.address : ""), _({
			target: r,
			root: o,
			saved: i
		}), x(!1), y("");
	};
	return (0, Z.useEffect)(() => {
		if (!e.available || !e.config.clouddrive_address || !e.token_set) return;
		let t = {
			address: !1,
			target: !e.config.targets[115],
			root: !e.config.pikpak_root
		};
		S.run("auto", (e) => H(Kr, e), (e) => O(e, t), (e) => y(K(e)));
	}, []), /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "download",
		title: J("settings:cloudDownload.title"),
		onSubmit: (e) => {
			if (e.preventDefault(), D) {
				x(!0);
				return;
			}
			let u = !w("115").trim(), d = {
				...i,
				wait_hours: c,
				token: o,
				pikpak_account: r
			};
			S.run("save", (e) => U(Gr, d, "POST", e), (e) => {
				let { report: r, ...i } = e;
				t(i), a(i.config), l(String(i.config.wait_hours)), s(""), r ? O(r, {
					address: !i.config.clouddrive_address,
					target: u,
					root: !i.config.pikpak_root
				}, i.config.targets[115] ?? "") : (p(null), h(""), _(ai), x(!1), y("")), n(J("settings:shared.settingsSaved"));
			}, (e) => y(K(e)));
		},
		children: [
			e.problems?.length ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("settings:cloudDownload.needsAttention"),
				children: ei(e).join("\n")
			}) }) : null,
			/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
				/* @__PURE__ */ (0, Q.jsx)(M, {
					label: J("settings:cloudDownload.cloudDriveUrl"),
					placeholder: J("settings:cloudDownload.addressPlaceholder"),
					autoComplete: "off",
					maxLength: 200,
					value: i.clouddrive_address,
					isDisabled: !e.available,
					onChange: (e) => a({
						...i,
						clouddrive_address: e
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(M, {
					label: J("settings:cloudDownload.apiToken"),
					type: "password",
					autoComplete: "off",
					maxLength: 400,
					placeholder: e.token_set ? J("settings:shared.savedLeaveBlank") : J("settings:cloudDownload.tokenPlaceholder"),
					hint: J("settings:cloudDownload.apiTokenHelp"),
					value: o,
					isDisabled: !e.available,
					onChange: s
				}),
				ee ? /* @__PURE__ */ (0, Q.jsx)(M, {
					label: /* @__PURE__ */ (0, Q.jsx)(ze, {
						source: "115",
						label: J("settings:cloudDownload.target115")
					}),
					placeholder: J("settings:cloudDownload.targetPlaceholder"),
					autoComplete: "off",
					maxLength: 300,
					validationBehavior: "aria",
					isInvalid: D,
					hint: J(D ? b ? "settings:cloudDownload.createOrPick" : "settings:cloudDownload.directoryMissing" : "settings:cloudDownload.target115Help"),
					value: w("115"),
					isDisabled: !e.available,
					onChange: (e) => E("115", e)
				}) : null,
				te ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(M, {
					label: /* @__PURE__ */ (0, Q.jsx)(ze, {
						source: "pikpak",
						label: J("settings:cloudDownload.targetPikpak")
					}),
					placeholder: J("settings:cloudDownload.pikpakPathPlaceholder"),
					autoComplete: "off",
					maxLength: 300,
					hint: J("settings:cloudDownload.targetPikpakHelp"),
					value: w("pikpak"),
					isDisabled: !e.available,
					onChange: (e) => E("pikpak", e)
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-col gap-1",
					children: [/* @__PURE__ */ (0, Q.jsx)(ie, { children: /* @__PURE__ */ (0, Q.jsx)(ze, {
						source: "pikpak",
						label: J("settings:cloudDownload.pikpakRootDirectory")
					}) }), e.pikpak_roots.length ? /* @__PURE__ */ (0, Q.jsx)(I, {
						"aria-label": J("settings:cloudDownload.pikpakRootDirectory"),
						selectedKey: i.pikpak_root || null,
						isDisabled: !e.available || !r,
						placeholder: J("settings:cloudDownload.rootPlaceholder"),
						onSelectionChange: (e) => a({
							...i,
							pikpak_root: e === null ? "" : String(e)
						}),
						children: e.pikpak_roots.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
							id: e,
							children: e
						}, e))
					}) : /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudDownload.addPikpakMount") })]
				})] }) : null,
				/* @__PURE__ */ (0, Q.jsx)(M, {
					label: J("settings:cloudDownload.maxWait"),
					type: "number",
					inputMode: "numeric",
					autoComplete: "off",
					hint: J("settings:cloudDownload.waitHint", { max: e.max_wait_hours }),
					value: c,
					isDisabled: !e.available,
					onChange: l
				})
			] }),
			S.busy === "auto" ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(u, {
					kind: "radar",
					label: J("settings:cloudDownload.checking")
				})
			}) : null,
			d ? /* @__PURE__ */ (0, Q.jsx)(oi, {
				report: d,
				detected: m,
				suggested: g,
				create: e.available ? (e) => {
					let t = {
						clouddrive_address: i.clouddrive_address,
						token: o,
						path: e,
						pikpak_root: i.pikpak_root,
						pikpak_account: r
					};
					S.run("folder", (e) => U(qr, t, "POST", e), (t) => {
						p(t), _((t) => ({
							...t,
							target: {
								path: e,
								exists: !0
							}
						})), x(!1), y(""), n(J("settings:cloudDownload.directoryCreated"));
					}, (e) => y(K(e)));
				} : void 0,
				creating: S.busy === "folder"
			}) : null,
			v || S.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: v || S.error })
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)(A, {
				status: e.available ? void 0 : J("settings:cloudDownload.primaryOnly"),
				children: [/* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					onClick: () => {
						let e = {
							address: !i.clouddrive_address.trim(),
							target: !w("115").trim(),
							root: !i.pikpak_root
						}, t = {
							clouddrive_address: i.clouddrive_address,
							token: o,
							target: w("115"),
							pikpak_root: i.pikpak_root,
							pikpak_account: r
						};
						S.run("check", (e) => U(Kr, t, "POST", e), (t) => O(t, e), (e) => y(K(e)));
					},
					disabled: !e.available,
					...W(S.busy === "check"),
					children: J("settings:cloudDownload.testConnection")
				}), /* @__PURE__ */ (0, Q.jsx)(f, {
					type: "submit",
					disabled: !e.available,
					...W(S.busy === "save"),
					children: J("settings:shared.saveSettings")
				})]
			})
		]
	});
}
var ai = {
	target: null,
	root: "",
	saved: !1
};
function oi({ report: e, detected: t, suggested: n, create: r, creating: i }) {
	let a = n.target, o = !!(t || a || n.root || e.permissions.length || e.folder || e.quota);
	return !o && !e.problems.length ? null : /* @__PURE__ */ (0, Q.jsxs)(z, {
		divided: !0,
		children: [o ? /* @__PURE__ */ (0, Q.jsxs)(re, { children: [
			t ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:cloudDownload.cloudDriveUrl"),
				children: J("settings:cloudDownload.detectedAddress", { address: t })
			}) : null,
			a?.exists ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: /* @__PURE__ */ (0, Q.jsx)(ze, {
					source: "115",
					label: J("settings:cloudDownload.target115")
				}),
				children: n.saved ? J("settings:cloudDownload.filledSaved", { path: a.path }) : J("settings:cloudDownload.filledPending", { path: a.path })
			}) : null,
			a && !a.exists ? /* @__PURE__ */ (0, Q.jsxs)(k, {
				term: /* @__PURE__ */ (0, Q.jsx)(ze, {
					source: "115",
					label: J("settings:cloudDownload.target115")
				}),
				children: [J("settings:cloudDownload.pathMissing", { path: a.path }), r ? /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					size: "small",
					onClick: () => r(a.path),
					...W(i),
					children: J("settings:cloudDownload.createDirectory")
				}) : null]
			}) : null,
			n.root ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: /* @__PURE__ */ (0, Q.jsx)(ze, {
					source: "pikpak",
					label: J("settings:cloudDownload.pikpakRoot")
				}),
				children: J("settings:cloudDownload.filledPending", { path: n.root })
			}) : null,
			e.permissions.length ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:cloudDownload.offlinePermissions"),
				children: e.missing.length ? ti(e).map((e) => /* @__PURE__ */ (0, Q.jsx)(x, {
					variant: "caption",
					color: "yellow",
					children: J("settings:cloudDownload.missingPermission", { permission: e })
				}, e)) : /* @__PURE__ */ (0, Q.jsx)(x, {
					variant: "caption",
					color: "lime",
					children: J("settings:cloudDownload.permissionsComplete")
				})
			}) : null,
			e.folder ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:cloudDownload.targetDirectory"),
				children: e.folder.can_offline ? J("settings:cloudDownload.offlineSupported", { path: e.folder.path }) : J("settings:cloudDownload.offlineUnsupported", { path: e.folder.path })
			}) : null,
			e.quota ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: /* @__PURE__ */ (0, Q.jsx)(ze, {
					source: "115",
					label: J("settings:cloudDownload.quota115")
				}),
				children: J("settings:cloudDownload.quotaLeft", {
					count: e.quota.left,
					total: e.quota.total
				})
			}) : null
		] }) : null, ei(e).map((e) => /* @__PURE__ */ (0, Q.jsx)(T, { children: e }, e))]
	});
}
function si({ state: e, settle: t, receipt: n, username: r, setUsername: i }) {
	let [a, o] = (0, Z.useState)(""), [s, c] = (0, Z.useState)(!1), [l, d] = (0, Z.useState)(""), [p, m] = (0, Z.useState)(""), [h, g] = (0, Z.useState)(""), _ = Y(), v = e.pikpak, y = e.pikpak_browser, x = y.state === "waiting";
	(0, Z.useEffect)(() => {
		if (!x) return;
		let e = new AbortController();
		return Nt({
			signal: e.signal,
			everyMs: Zr,
			limitMs: Qr,
			read: (e) => H(Xr, e),
			apply: (e) => {
				t(e), e.pikpak_browser.state === "done" ? n(J("settings:pikpakAccount.signedInReceipt")) : e.pikpak_browser.state !== "waiting" && g(Ct(e.pikpak_browser));
			},
			done: (e) => e.pikpak_browser.state !== "waiting",
			failed: (e) => m(K(e))
		}), () => e.abort();
	}, [x]);
	let S = () => {
		g(""), _.run("browser", (e) => U(Xr, {}, "POST", e), (e) => {
			t(e), m("");
		}, (e) => m(K(e)));
	}, C = () => {
		_.run("cancel", (e) => U(`${Xr}/cancel`, {}, "POST", e), (e) => {
			t(e), m(""), g(Ct(e.pikpak_browser));
		}, (e) => m(K(e)));
	}, ee = (e) => {
		if (e.preventDefault(), v.logged_in) return;
		let i = {
			username: r,
			password: a,
			remember: s
		};
		_.run("login", (e) => U(Jr, i, "POST", e), (e) => {
			t(e.settings), m(""), e.ok ? (d(""), o(""), n(J("settings:pikpakAccount.signedInReceipt"))) : d(e.captcha_url ?? "");
		}, (e) => m(K(e)));
	}, te = () => {
		_.run("logout", (e) => U(Yr, {}, "POST", e), (e) => {
			t(e), m(""), n(J("settings:pikpakAccount.signedOutReceipt"));
		}, (e) => m(K(e)));
	}, w = /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsx)(M, {
			label: J("settings:shared.account"),
			placeholder: J("settings:pikpakAccount.usernamePlaceholder"),
			autoComplete: "username",
			maxLength: 200,
			value: r,
			isDisabled: !e.available,
			onChange: i
		}),
		/* @__PURE__ */ (0, Q.jsx)(M, {
			label: J("settings:shared.password"),
			type: "password",
			autoComplete: "current-password",
			maxLength: 200,
			value: a,
			isDisabled: !e.available,
			onChange: o
		}),
		/* @__PURE__ */ (0, Q.jsx)(b, {
			isSelected: s,
			isDisabled: !e.available,
			onChange: c,
			children: J("settings:pikpakAccount.rememberPassword")
		}),
		l ? /* @__PURE__ */ (0, Q.jsx)(N, {
			tone: "warning",
			title: J("settings:pikpakAccount.captchaTitle"),
			extra: /* @__PURE__ */ (0, Q.jsx)("div", {
				className: "pt-2",
				children: /* @__PURE__ */ (0, Q.jsx)(D, {
					href: l,
					children: J("settings:pikpakAccount.openCaptcha")
				})
			}),
			children: J("settings:pikpakAccount.captchaHelp")
		}) : null
	] }), E = /* @__PURE__ */ (0, Q.jsx)(f, {
		type: "submit",
		variant: "primary",
		disabled: !e.available || x,
		...W(_.busy === "login"),
		children: J("settings:shared.signIn")
	}), O = y.state === "timeout" || y.state === "failed";
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "pikpak",
		title: J("settings:pikpakAccount.title"),
		icon: /* @__PURE__ */ (0, Q.jsx)($r, {}),
		onSubmit: ee,
		aside: /* @__PURE__ */ (0, Q.jsx)(B, {
			tone: v.logged_in ? "success" : x ? "progress" : O ? "error" : "neutral",
			children: v.logged_in ? J("settings:pikpakAccount.signedIn") : J(x ? "settings:pikpakAccount.waiting" : O ? "settings:pikpakAccount.incomplete" : "settings:pikpakAccount.notSignedIn")
		}),
		children: [
			v.logged_in ? /* @__PURE__ */ (0, Q.jsxs)(re, { children: [/* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:shared.account"),
				children: v.username || J("settings:pikpakAccount.signedIn")
			}), v.method === "browser" ? /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:pikpakAccount.method"),
				children: J("settings:pikpakAccount.browserMethod")
			}) : /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:shared.password"),
				children: v.remember ? J("settings:pikpakAccount.passwordSaved") : J("settings:pikpakAccount.passwordNotSaved")
			})] }) : /* @__PURE__ */ (0, Q.jsxs)(z, { children: [h ? O ? /* @__PURE__ */ (0, Q.jsx)(T, { children: h }) : /* @__PURE__ */ (0, Q.jsx)(j, {
				role: "status",
				children: h
			}) : null, w] }),
			p || _.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: p || _.error })
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, {
				status: !v.logged_in && x ? /* @__PURE__ */ (0, Q.jsx)(u, {
					kind: "clock",
					label: Ct(y) || J("settings:pikpakAccount.waitingBrowser")
				}) : null,
				children: v.logged_in ? /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					onClick: te,
					disabled: !e.available,
					...W(_.busy === "logout"),
					children: J("settings:shared.signOut")
				}) : /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [y.available ? x ? /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					type: "button",
					onClick: C,
					...W(_.busy === "cancel"),
					children: J("settings:shared.cancel")
				}) : /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					type: "button",
					onClick: S,
					disabled: !e.available,
					...W(_.busy === "browser"),
					children: J("settings:pikpakAccount.browserSignIn")
				}) : null, E] })
			})
		]
	});
}
// src/react/settings/ledger-backup-settings.tsx
var ci = "/api/configuration/ledger-backups", li = 1500, ui = 36e5, di = (e) => (/* @__PURE__ */ new Date(e.modified_at * 1e3)).toLocaleString(xt);
function fi(e) {
	return [e.source === "manual" ? J("settings:databaseBackups.manual") : J("settings:databaseBackups.automatic", { purpose: Gt(`ledgerBackup.purpose.${e.purpose_code}`, e.purpose) }), vt(e.bytes)].join(" · ");
}
function pi({ job: e, task: t, label: n }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"aria-live": "polite",
		className: "flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)(Ue, {
			embedded: !0,
			kind: Ye(t, e.stage_code),
			label: [n, Qt(e)].filter(Boolean).join(" · "),
			value: e.done || 0,
			total: e.total
		}), /* @__PURE__ */ (0, Q.jsx)(He, {})]
	});
}
function mi({ receipt: e }) {
	let [t, n] = (0, Z.useState)(null), [r, i] = (0, Z.useState)(""), a = Y(), o = t?.backup.status === "running", s = t?.restore.status === "running", c = o || s, l = (0, Z.useRef)({
		backup: !1,
		restore: !1
	});
	if ((0, Z.useEffect)(() => {
		let e = new AbortController();
		return H(ci, e.signal).then(n, (t) => {
			e.signal.aborted || i(String(t?.message || t));
		}), () => e.abort();
	}, []), (0, Z.useEffect)(() => {
		if (!c) return;
		let e = new AbortController();
		return Nt({
			signal: e.signal,
			everyMs: li,
			limitMs: ui,
			read: (e) => H(ci, e),
			apply: n,
			done: (e) => e.backup.status !== "running" && e.restore.status !== "running"
		}), () => e.abort();
	}, [c]), (0, Z.useEffect)(() => {
		if (t) for (let n of ["backup", "restore"]) {
			let r = t[n];
			r.status === "running" ? l.current[n] = !0 : l.current[n] && (l.current[n] = !1, r.status === "complete" && e(n === "backup" ? J("settings:databaseBackups.backedUp", { name: r.name }) : J("settings:databaseBackups.restored", { name: r.saved })));
		}
	}, [t]), !t && !r) return /* @__PURE__ */ (0, Q.jsx)(Ne, {
		label: J("settings:databaseBackups.loading"),
		html: Et
	});
	if (!t) return /* @__PURE__ */ (0, Q.jsx)(F, {
		id: "ledgerBackups",
		guide: "ledger-backups",
		title: J("settings:databaseBackups.title"),
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: r }) })
	});
	let u = () => void a.run("backup", (e) => U(`${ci}/backup`, {}, "POST", e), n), d = (e) => void at({
		title: J("settings:databaseBackups.restoreTitle"),
		danger: !0,
		body: J("settings:databaseBackups.restoreBody", {
			time: di(e),
			details: fi(e)
		}),
		confirmLabel: J("settings:databaseBackups.replaceCurrent"),
		onConfirm: async () => {
			l.current.restore = !0, n(await U(`${ci}/restore`, {
				id: e.id,
				confirm: !0
			}));
		}
	}), p = [t.backup, t.restore].find((e) => e.status === "failed"), m = t.last_restore, h = o ? J("settings:databaseBackups.backingUp") : s ? J("settings:databaseBackups.restoring") : t.backups.length ? J("settings:databaseBackups.count", { count: t.backups.length }) : J("settings:databaseBackups.empty");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "ledgerBackups",
		guide: "ledger-backups",
		title: J("settings:databaseBackups.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:databaseBackups.help") }),
				t.writer ? null : /* @__PURE__ */ (0, Q.jsxs)(j, { children: [J("settings:databaseBackups.notPrimary"), G(t, "writer_reason")] }),
				o ? /* @__PURE__ */ (0, Q.jsx)(pi, {
					job: t.backup,
					task: "ledger-backup",
					label: J("settings:databaseBackups.backupProgress")
				}) : null,
				s ? /* @__PURE__ */ (0, Q.jsx)(pi, {
					job: t.restore,
					task: "ledger-restore",
					label: J("settings:databaseBackups.restoreProgress")
				}) : null,
				p ? /* @__PURE__ */ (0, Q.jsx)(T, { children: Ct(p, "error") || J("settings:databaseBackups.jobIncomplete") }) : null,
				m ? m.outcome === "kept" || m.outcome === "completed" ? /* @__PURE__ */ (0, Q.jsx)(j, { children: G(m, "message") }) : /* @__PURE__ */ (0, Q.jsx)(T, { children: G(m, "message") }) : null,
				a.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: a.error }) : null
			] }),
			t.backups.length ? /* @__PURE__ */ (0, Q.jsx)("div", {
				className: "border-t border-separator-border",
				"data-ledger-backups": "",
				children: /* @__PURE__ */ (0, Q.jsx)(P, { children: t.backups.map((e) => /* @__PURE__ */ (0, Q.jsx)(R, {
					label: di(e),
					description: fi(e),
					children: /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						disabled: !t.writer || c,
						onClick: () => d(e),
						children: J("settings:databaseBackups.restore")
					})
				}, e.id)) })
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, {
				status: /* @__PURE__ */ (0, Q.jsx)("p", { children: h }),
				children: /* @__PURE__ */ (0, Q.jsx)(f, {
					disabled: c,
					onClick: u,
					...W(a.busy === "backup" || o),
					children: J("settings:databaseBackups.backUpNow")
				})
			})
		]
	});
}
// src/react/settings/retention-settings.tsx
var hi = "/api/configuration/retention", gi = ["retention-settings"], _i = [
	2,
	5,
	10,
	20
], vi = [
	30,
	90,
	183,
	365
], yi = (e) => e === 183 ? J("settings:retention.halfYear") : e === 365 ? J("settings:retention.oneYear") : J("settings:retention.days", { count: e });
function bi({ receipt: e }) {
	let t = X({
		queryKey: gi,
		queryFn: ({ signal: e }) => H(hi, e)
	}), n = Y(), r = !t.data || !!n.busy, i = (t) => void n.run("save", (e) => U(hi, t, "POST", e), (t) => {
		q.setQueryData(gi, t), e(J("settings:shared.settingsSaved"));
	}), a = n.error || (t.error ? K(t.error) : "");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:retention.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(P, { children: [/* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:retention.backups"),
			description: J("settings:retention.backupsHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "backupKeepSetting",
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:retention.backups"),
					selectedKey: String(t.data?.backup_keep ?? 5),
					isDisabled: r,
					onSelectionChange: (e) => {
						e !== null && i({ backup_keep: Number(e) });
					},
					children: _i.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: String(e),
						children: J("settings:retention.copies", { count: e })
					}, e))
				})
			})
		}), /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:retention.logs"),
			description: J("settings:retention.logsHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "logDaysSetting",
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:retention.logs"),
					selectedKey: String(t.data?.log_days ?? 183),
					isDisabled: r,
					onSelectionChange: (e) => {
						e !== null && i({ log_days: Number(e) });
					},
					children: vi.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: String(e),
						children: yi(e)
					}, e))
				})
			})
		})] }), a ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: a })
		}) : null]
	});
}
// src/react/settings/library-sharing-settings.tsx
function xi({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(null), [o, s] = (0, Z.useState)(!1), [c, l] = (0, Z.useState)(!1), u = (0, Z.useMemo)(() => i ? JSON.stringify(i.data, null, 2) : "", [i]), d = Y(), p = n.participation, m = {
		"not-attempted": J("settings:librarySharing.notSent"),
		queued: J("settings:librarySharing.waiting"),
		accepted: J("settings:librarySharing.sent"),
		failed: J("settings:librarySharing.sendFailed"),
		unknown: J("settings:librarySharing.resultUnknown"),
		blocked: J("settings:librarySharing.blocked")
	}, h = {
		queued: "progress",
		accepted: "success",
		failed: "error",
		unknown: "warning",
		blocked: "warning"
	}, g = (e) => void d.run("save", (t) => U("/api/configuration/library-sharing", {
		enabled: e,
		schema: n.schema,
		consent: c,
		preview_token: i?.token
	}, "POST", t), (e) => {
		r(e), a(null), l(!1), s(!1), t(J("settings:librarySharing.saved"));
	}), _ = () => {
		let e = URL.createObjectURL(new Blob([u], { type: "application/json" })), t = document.createElement("a");
		t.href = e, t.download = "peach-library-taste-preview.json", document.body.append(t);
		try {
			t.click();
		} finally {
			t.remove(), setTimeout(() => URL.revokeObjectURL(e), 1e3);
		}
	};
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:librarySharing.uploadDetails"),
			description: J("settings:librarySharing.uploadDescription"),
			children: /* @__PURE__ */ (0, Q.jsx)(V, {
				"aria-label": J("settings:librarySharing.uploadDetails"),
				isSelected: n.enabled,
				onChange: (e) => e ? s(!0) : g(!1),
				...W(d.busy === "save")
			})
		}) }),
		n.available ? null : /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, Q.jsx)(B, { children: J("settings:librarySharing.unavailable") })
			})
		}),
		n.consent_state === "needs-consent" ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: "warning",
					children: J("settings:librarySharing.needsConsent")
				})
			}), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.fieldsChanged") })]
		}) : null,
		/* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsxs)(C, {
				summary: J("settings:librarySharing.fieldsAndRules"),
				children: [/* @__PURE__ */ (0, Q.jsx)("ul", {
					className: "list-disc space-y-2 pl-5",
					children: Kt(n.fields, n.field_codes).map((e) => /* @__PURE__ */ (0, Q.jsx)("li", { children: /* @__PURE__ */ (0, Q.jsx)(j, { children: e }) }, e))
				}), /* @__PURE__ */ (0, Q.jsx)(j, { children: G(n, "notice") })]
			})
		}),
		p ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsx)(re, { children: /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:librarySharing.participation"),
				children: /* @__PURE__ */ (0, Q.jsx)(B, {
					"aria-label": J("settings:librarySharing.participation"),
					tone: p.pending_state ? "progress" : h[p.status] || "neutral",
					children: p.pending_state ? p.pending_state === "disabled" ? J("settings:librarySharing.pendingOff") : J("settings:librarySharing.pendingOn") : m[p.status] || J("settings:librarySharing.resultUnknown")
				})
			}) }), n.last_sent_at ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.lastSentAt", { date: new Date(n.last_sent_at).toLocaleDateString(xt) }) }) : null]
		}) : null,
		n.enabled && n.last_attempt?.snapshot_id ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [
				/* @__PURE__ */ (0, Q.jsxs)(re, { children: [/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:librarySharing.snapshot"),
					children: /* @__PURE__ */ (0, Q.jsx)(B, {
						tone: h[n.last_attempt.status || ""] || "neutral",
						children: m[n.last_attempt.status || ""] || J("settings:librarySharing.waitingData")
					})
				}), /* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:librarySharing.snapshotId"),
					children: n.last_attempt.snapshot_id
				})] }),
				n.last_attempt.raw_bytes !== void 0 && n.last_attempt.compressed_bytes !== void 0 ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.snapshotSizes", {
					raw: (n.last_attempt.raw_bytes / 1024).toFixed(1),
					compressed: (n.last_attempt.compressed_bytes / 1024).toFixed(1)
				}) }) : null,
				n.last_attempt.status === "accepted" ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.acceptedHelp") }) : null
			]
		}) : null,
		n.enabled && n.last_attempt?.status === "failed" ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: n.last_attempt.attempted ? "error" : "warning",
					children: n.last_attempt.attempted ? J("settings:librarySharing.uploadFailed") : J("settings:librarySharing.retryPending")
				})
			}), /* @__PURE__ */ (0, Q.jsx)(T, { children: n.last_attempt.attempted ? J("settings:librarySharing.failedThisWeek") : J("settings:librarySharing.incomplete") })]
		}) : null,
		n.enabled && n.last_attempt?.status === "waiting-data" ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, Q.jsx)(B, { children: J("settings:librarySharing.waitingData") })
			}), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.waitingDataHelp") })]
		}) : null,
		n.enabled && n.last_attempt?.status === "unknown" ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "self-start",
				children: /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: "warning",
					children: J("settings:librarySharing.resultUnknown")
				})
			}), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.resultUnknownHelp") })]
		}) : null,
		i ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.previewSummary", {
					count: i.data.library.length,
					uncoded: i.data.coverage.uncoded_items,
					size: (i.bytes / 1024).toFixed(1)
				}) }),
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.snapshotSizes", {
					raw: (i.bytes / 1024).toFixed(1),
					compressed: (i.compressed_bytes / 1024).toFixed(1)
				}) }),
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.previewNotice") }),
				/* @__PURE__ */ (0, Q.jsx)(C, {
					summary: J("settings:librarySharing.previewData"),
					defaultOpen: !0,
					children: /* @__PURE__ */ (0, Q.jsx)(mn, {
						code: u,
						language: "json",
						label: J("settings:librarySharing.previewLabel"),
						maxCharacters: 24e3
					})
				}),
				u.length > 24e3 ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.truncated") }) : null,
				/* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					onClick: _,
					children: J("settings:librarySharing.downloadPreview")
				}),
				n.enabled ? null : /* @__PURE__ */ (0, Q.jsx)(b, {
					isSelected: c,
					onChange: l,
					children: J("settings:librarySharing.consent")
				})
			]
		}) : null,
		d.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: d.error })
		}) : null,
		/* @__PURE__ */ (0, Q.jsxs)(A, { children: [
			o && !n.enabled ? /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => {
					s(!1), a(null), l(!1);
				},
				children: J("settings:shared.cancel")
			}) : null,
			p ? /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => void d.run("refresh", async (e) => {
					let t = await H("/api/configuration", e);
					if (!t.library_sharing) throw Error(J("settings:librarySharing.statusUnavailable"));
					return t.library_sharing;
				}, r),
				...W(d.busy === "refresh"),
				children: J("settings:librarySharing.refreshStatus")
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => {
					s(!0), d.run("preview", (e) => H("/api/configuration/library-sharing/preview", e), (e) => {
						a(e), l(!1);
					});
				},
				...W(d.busy === "preview"),
				children: J("settings:librarySharing.preview")
			}),
			!n.enabled && i ? /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "primary",
				disabled: !c,
				onClick: () => g(!0),
				...W(d.busy === "save"),
				children: J("settings:librarySharing.agreeAndEnable")
			}) : null
		] })
	] });
}
// src/react/settings/remote-reporting-settings.tsx
function Si({ value: e, onChange: t, busy: n = !1 }) {
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
		label: J("settings:dataSharing.reportErrors"),
		description: J("settings:dataSharing.reportErrorsHelp"),
		children: /* @__PURE__ */ (0, Q.jsx)(V, {
			"aria-label": J("settings:dataSharing.reportErrors"),
			isSelected: e.usage && e.errors,
			onChange: (n) => t({
				...e,
				usage: n,
				errors: n
			}),
			...W(n)
		})
	}) }), e.available ? null : /* @__PURE__ */ (0, Q.jsx)(z, {
		divided: !0,
		children: /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "self-start",
			children: /* @__PURE__ */ (0, Q.jsx)(B, { children: J("settings:librarySharing.unavailable") })
		})
	})] });
}
function Ci({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), i = Y(), a = Object.values(n.delivery ?? {}).flatMap((e) => e.last_sent_at ? [Date.parse(e.last_sent_at)] : []).filter(Number.isFinite), o = a.length ? Math.max(...a) : null;
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsx)(Si, {
			value: n,
			busy: i.busy === "save",
			onChange: (e) => {
				i.run("save", (t) => U("/api/configuration/remote-reporting", {
					usage: e.usage,
					errors: e.errors
				}, "POST", t), (e) => {
					r(e), t(J("settings:diagnosticsReporting.saved"));
				});
			}
		}),
		/* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [/* @__PURE__ */ (0, Q.jsxs)(C, {
				summary: J("settings:diagnosticsReporting.fieldsAndRules"),
				children: [
					/* @__PURE__ */ (0, Q.jsx)(j, { children: Gt(n.field_codes?.usage ?? "", n.fields.usage) }),
					/* @__PURE__ */ (0, Q.jsx)(j, { children: Gt(n.field_codes?.errors ?? "", n.fields.errors) }),
					/* @__PURE__ */ (0, Q.jsx)(j, { children: G(n, "notice") })
				]
			}), o === null ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:librarySharing.lastSentAt", { date: new Date(o).toLocaleDateString(xt) }) })]
		}),
		i.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: i.error })
		}) : null
	] });
}
// src/react/components/animated-number.tsx
var wi = .6;
function Ti({ value: e, format: t = (e) => Math.round(e).toLocaleString(), className: n }) {
	let r = on(), [i, a] = (0, Z.useState)(e), o = (0, Z.useRef)(e);
	return (0, Z.useEffect)(() => {
		if (r || o.current === e) {
			o.current = e, a(e);
			return;
		}
		let t = Xe(o.current, e, {
			duration: wi,
			ease: "easeOut",
			onUpdate: (e) => {
				o.current = e, a(e);
			}
		});
		return () => t.stop();
	}, [e, r]), /* @__PURE__ */ (0, Q.jsx)("span", {
		className: n ? `tabular-nums ${n}` : "tabular-nums",
		children: t(i)
	});
}
// node_modules/recharts/es6/state/selectors/pieSelectors.js
function Ei(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Di(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Ei(Object(n), !0).forEach(function(t) {
			Oi(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Ei(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Oi(e, t, n) {
	return (t = ki(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function ki(e) {
	var t = Ai(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ai(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var ji = qn([mr, (e, t) => t], (e, t) => e.filter((e) => e.type === "pie").find((e) => e.id === t)), Mi = [], Ni = (e, t, n) => n?.length === 0 ? Mi : n, Pi = qn([
	fr,
	ji,
	Ni
], (e, t, n) => {
	var r = e.chartData;
	if (t != null) {
		var i = t?.data != null && t.data.length > 0 ? t.data : r;
		if (i && i.length || n == null || (i = n.map((e) => Di(Di({}, t.presentationProps), e.props))), i != null) return i;
	}
}), Fi = qn([
	Pi,
	ji,
	Ni
], (e, t, n) => {
	if (e != null && t != null) return e.map((e, r) => {
		var i, a = nr(e, t.nameKey, t.name), o = n != null && (i = n[r]) != null && (i = i.props) != null && i.fill ? n[r].props.fill : typeof e == "object" && e && "fill" in e ? e.fill : t.fill;
		return {
			value: tr(a, t.dataKey),
			dataKey: t.dataKey,
			color: o,
			payload: e,
			type: t.legendType
		};
	});
}), Ii = qn([
	Pi,
	ji,
	Ni,
	pr
], (e, t, n, r) => {
	if (t != null && e != null) return sa({
		offset: r,
		pieSettings: t,
		displayedData: e,
		cells: n
	});
}), Li = ["key"], Ri = [
	"onMouseEnter",
	"onClick",
	"onMouseLeave"
], zi = ["id"], Bi = ["id"];
function Vi() {
	return Vi = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, Vi.apply(null, arguments);
}
function Hi(e, t) {
	if (e == null) return {};
	var n, r, i = Ui(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Ui(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function Wi(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function $(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Wi(Object(n), !0).forEach(function(t) {
			Gi(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Wi(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Gi(e, t, n) {
	return (t = Ki(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Ki(e) {
	var t = qi(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function qi(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Ji = Ln;
function Yi(e) {
	var t = (0, Z.useMemo)(() => Yn(e.children, gn), [e.children]), n = yr((n) => Fi(n, e.id, t));
	return n == null ? null : /*#__PURE__*/ Z.createElement(zn, { legendPayload: n });
}
function Xi(e) {
	if (e != null && typeof e != "boolean" && typeof e != "function") {
		if (/*#__PURE__*/ Z.isValidElement(e)) {
			var t = e.props?.fill;
			return typeof t == "string" ? t : void 0;
		}
		var n = e.fill;
		return typeof n == "string" ? n : void 0;
	}
}
var Zi = /*#__PURE__*/ Z.memo((e) => {
	var t = e.dataKey, n = e.nameKey, r = e.sectors, i = e.stroke, a = e.strokeWidth, o = e.fill, s = e.name, c = e.hide, l = e.tooltipType, u = e.formatter, d = e.id, f = e.activeShape, p = Xi(f), m = {
		dataDefinedOnItem: r.map((e) => {
			var t = e.tooltipPayload;
			return p == null || t == null ? t : t.map((e) => $($({}, e), {}, {
				color: p,
				fill: p
			}));
		}),
		getPosition: (e) => r[Number(e)]?.tooltipPosition,
		settings: {
			stroke: i,
			strokeWidth: a,
			fill: o,
			dataKey: t,
			nameKey: n,
			name: tr(s, t),
			hide: c,
			type: l,
			color: o,
			unit: "",
			formatter: u,
			graphicalItemId: d
		}
	};
	return /*#__PURE__*/ Z.createElement(Bn, { tooltipEntrySettings: m });
}), Qi = (e, t) => e > t ? "start" : e < t ? "end" : "middle", $i = (e, t, n) => er(typeof t == "function" ? t(e) : t, n, n * .8), ea = (e, t, n) => {
	var r = t.top, i = t.left, a = t.width, o = t.height, s = $n(a, o);
	return {
		cx: i + er(e.cx, a, a / 2),
		cy: r + er(e.cy, o, o / 2),
		innerRadius: er(e.innerRadius, s, 0),
		outerRadius: $i(n, e.outerRadius, s),
		maxRadius: e.maxRadius || Math.sqrt(a * a + o * o) / 2
	};
}, ta = (e, t) => or(t - e) * Math.min(Math.abs(t - e), 360), na = (e, t) => {
	if (/*#__PURE__*/ Z.isValidElement(e)) return /*#__PURE__*/ Z.cloneElement(e, t);
	if (typeof e == "function") return e(t);
	var n = rt("recharts-pie-label-line", typeof e == "boolean" ? "" : e.className);
	t.key;
	var r = Hi(t, Li);
	return /*#__PURE__*/ Z.createElement(wn, Vi({}, r, {
		type: "linear",
		className: n
	}));
}, ra = (e, t, n) => {
	if (/*#__PURE__*/ Z.isValidElement(e)) return /*#__PURE__*/ Z.cloneElement(e, t);
	var r = n;
	if (typeof e == "function" && (r = e(t), /*#__PURE__*/ Z.isValidElement(r))) return r;
	var i = rt("recharts-pie-label-text", Zn(e));
	return /*#__PURE__*/ Z.createElement(Un, Vi({}, t, {
		alignmentBaseline: "middle",
		className: i
	}), r);
};
function ia(e) {
	var t = e.sectors, n = e.props, r = e.showLabels, i = n.label, a = n.labelLine, o = n.dataKey;
	if (!r || !i || !t) return null;
	var s = hr(n), c = gr(i), l = gr(a), u = typeof i == "object" && "offsetRadius" in i && typeof i.offsetRadius == "number" && i.offsetRadius || 20, d = t.map((e, t) => {
		var n = (e.startAngle + e.endAngle) / 2, r = sr(e.cx, e.cy, e.outerRadius + u, n), d = $($($($({}, s), e), {}, { stroke: "none" }, c), {}, {
			index: t,
			textAnchor: Qi(r.x, e.cx)
		}, r), f = $($($($({}, s), e), {}, {
			fill: "none",
			stroke: e.fill
		}, l), {}, {
			index: t,
			points: [sr(e.cx, e.cy, e.outerRadius, n), r],
			key: "line"
		});
		return /*#__PURE__*/ Z.createElement(Wn, {
			zIndex: Dn.label,
			key: `label-${e.startAngle}-${e.endAngle}-${e.midAngle}-${t}`
		}, /*#__PURE__*/ Z.createElement(jn, null, a && na(a, f), ra(i, d, nr(e, o))));
	});
	return /*#__PURE__*/ Z.createElement(jn, { className: "recharts-pie-labels" }, d);
}
function aa(e) {
	var t = e.sectors, n = e.props, r = e.showLabels, i = n.label;
	return typeof i == "object" && i && "position" in i ? /*#__PURE__*/ Z.createElement(An, { label: i }) : /*#__PURE__*/ Z.createElement(ia, {
		sectors: t,
		props: n,
		showLabels: r
	});
}
function oa(e) {
	var t = e.sectors, n = e.activeShape, r = e.inactiveShape, i = e.allOtherPieProps, a = e.shape, o = e.id, s = e.animationElapsedTime, c = e.isAnimating, l = e.isEntrance, u = yr(dr), d = yr(lr), f = yr(ur), p = i.onMouseEnter, m = i.onClick, h = i.onMouseLeave, g = Hi(i, Ri), _ = xr(p, i.dataKey, o), v = Sr(h), y = br(m, i.dataKey, o);
	return t == null || t.length === 0 ? null : /*#__PURE__*/ Z.createElement(Z.Fragment, null, t.map((e, p) => {
		if (e?.startAngle === 0 && e?.endAngle === 0 && t.length !== 1) return null;
		var m = f == null || f === o, h = String(p) === u && (d == null || i.dataKey === d) && m, b = n && h ? n : u ? r : null, x = $($({}, e), {}, {
			stroke: e.stroke,
			tabIndex: -1,
			index: p,
			isActive: h,
			animationElapsedTime: s,
			isAnimating: c,
			isEntrance: l,
			[En]: p,
			[Tn]: o
		});
		return /*#__PURE__*/ Z.createElement(jn, Vi({
			key: `sector-${e?.startAngle}-${e?.endAngle}-${e.midAngle}-${p}`,
			tabIndex: -1,
			className: "recharts-pie-sector"
		}, Gn(g, e, p), {
			onMouseEnter: _(e, p),
			onMouseLeave: v(e, p),
			onClick: y(e, p)
		}), /*#__PURE__*/ Z.createElement(Vn, {
			option: b ?? a,
			DefaultShape: Ji,
			shapeProps: x
		}));
	}));
}
function sa(e) {
	var t = e.pieSettings, n = e.displayedData, r = e.cells, i = e.offset, a = t.cornerRadius, o = t.startAngle, s = t.endAngle, c = t.dataKey, l = t.nameKey, u = t.tooltipType, d = Math.abs(t.minAngle), f = ta(o, s), p = Math.abs(f), m = n.length <= 1 ? 0 : t.paddingAngle ?? 0, h = n.filter((e) => nr(e, c, 0) !== 0).length, g = (p >= 360 ? h : h - 1) * m, _ = n.reduce((e, t) => {
		var n = nr(t, c, 0);
		return e + (ir(n) ? n : 0);
	}, 0), v = d > 0 && _ > 0 && n.some((e) => {
		var t = nr(e, c, 0), n = (ir(t) ? t : 0) / _;
		return t !== 0 && n * p < d;
	}) ? d : 0, y = p - h * v - g, b;
	if (_ > 0) {
		var x;
		b = n.map((e, n) => {
			var s = nr(e, c, 0), d = nr(e, l, n), p = ea(t, i, e), h = (ir(s) ? s : 0) / _, g, b = $($({}, e), r && r[n] && r[n].props), S = b != null && "fill" in b && typeof b.fill == "string" ? b.fill : t.fill;
			g = n ? x.endAngle + or(f) * m * (s === 0 ? 0 : 1) : o;
			var C = g + or(f) * ((s === 0 ? 0 : v) + h * y), ee = (g + C) / 2, te = (p.innerRadius + p.outerRadius) / 2, w = [{
				name: d,
				value: s,
				payload: b,
				dataKey: c,
				type: u,
				color: S,
				fill: S,
				graphicalItemId: t.id
			}], T = sr(p.cx, p.cy, te, ee);
			return x = $($($($({}, t.presentationProps), {}, {
				percent: h,
				cornerRadius: typeof a == "string" ? parseFloat(a) : a,
				name: d,
				tooltipPayload: w,
				midAngle: ee,
				middleRadius: te,
				tooltipPosition: T
			}, b), p), {}, {
				value: s,
				dataKey: c,
				startAngle: g,
				endAngle: C,
				payload: b,
				paddingAngle: s === 0 ? 0 : or(f) * m
			}), x;
		});
	}
	return b;
}
function ca(e) {
	var t = e.showLabels, n = e.sectors, r = e.children, i = (0, Z.useMemo)(() => !t || !n ? [] : n.map((e) => ({
		value: e.value,
		payload: e.payload,
		clockWise: !1,
		parentViewBox: void 0,
		viewBox: {
			cx: e.cx,
			cy: e.cy,
			innerRadius: e.innerRadius,
			outerRadius: e.outerRadius,
			startAngle: e.startAngle,
			endAngle: e.endAngle,
			clockWise: !1
		},
		fill: e.fill
	})), [n, t]);
	return /*#__PURE__*/ Z.createElement(Fn, { value: t ? i : void 0 }, r);
}
var la = (e, t) => {
	if (e == null) return [];
	var n = [], r = e.find((e) => e.status !== "removed"), i = r ? r.next.startAngle : 0;
	return e.forEach((e, r) => {
		if (e.status !== "removed") {
			var a = r > 0 ? Xn(e.next, "paddingAngle", 0) : 0;
			if (e.status === "matched") {
				var o = rr(e.prev.endAngle - e.prev.startAngle, e.next.endAngle - e.next.startAngle, t), s = $($({}, e.next), {}, {
					startAngle: i + a,
					endAngle: i + o + a
				});
				n.push(s), i = s.endAngle;
			} else {
				var c = rr(0, e.next.endAngle - e.next.startAngle, t), l = $($({}, e.next), {}, {
					startAngle: i + a,
					endAngle: i + c + a
				});
				n.push(l), i = l.endAngle;
			}
		}
	}), n;
};
function ua(e) {
	var t = e.props, n = e.previousSectorsRef, r = e.id, i = t.sectors, a = t.activeShape, o = t.inactiveShape, s = t.animationInterpolateFn, c = vr(t.onAnimationStart, t.onAnimationEnd), l = c.isAnimating, u = c.handleAnimationStart, d = c.handleAnimationEnd, f = Cr();
	if (f == null) return null;
	var p = i[0];
	return /*#__PURE__*/ Z.createElement(ca, {
		showLabels: !l,
		sectors: i
	}, /*#__PURE__*/ Z.createElement(hn, {
		animationInput: t,
		animationIdPrefix: "recharts-pie-",
		items: i,
		previousItemsRef: n,
		isAnimationActive: t.isAnimationActive,
		animationBegin: t.animationBegin,
		animationDuration: t.animationDuration,
		animationEasing: t.animationEasing,
		onAnimationStart: u,
		onAnimationEnd: d,
		animationInterpolateFn: s,
		animationMatchBy: t.animationMatchBy,
		layout: f
	}, (e, n, i) => /*#__PURE__*/ Z.createElement(jn, null, /*#__PURE__*/ Z.createElement(oa, {
		sectors: e,
		activeShape: a,
		inactiveShape: o,
		allOtherPieProps: t,
		shape: t.shape,
		id: r,
		animationElapsedTime: n,
		isAnimating: l || n < 1,
		isEntrance: i
	}))), /*#__PURE__*/ Z.createElement(aa, {
		showLabels: !l,
		sectors: i,
		props: t
	}), /*#__PURE__*/ Z.createElement(Pn, {
		cx: p?.cx ?? 0,
		cy: p?.cy ?? 0,
		innerRadius: p?.innerRadius ?? 0,
		outerRadius: p?.outerRadius ?? 0,
		startAngle: t.startAngle,
		endAngle: t.endAngle,
		clockWise: !1
	}, t.children));
}
var da = {
	animationBegin: 400,
	animationDuration: 1500,
	animationEasing: "ease",
	animationInterpolateFn: la,
	animationMatchBy: ar,
	cx: "50%",
	cy: "50%",
	dataKey: "value",
	endAngle: 360,
	fill: "#808080",
	hide: !1,
	innerRadius: 0,
	isAnimationActive: "auto",
	label: !1,
	labelLine: !0,
	legendType: "rect",
	minAngle: 0,
	nameKey: "name",
	outerRadius: "80%",
	paddingAngle: 0,
	rootTabIndex: 0,
	shape: Ji,
	startAngle: 0,
	stroke: "#fff",
	zIndex: Dn.area
};
function fa(e) {
	var t = e.id, n = Hi(e, zi), r = e.hide, i = e.className, a = e.rootTabIndex, o = (0, Z.useMemo)(() => Yn(e.children, gn), [e.children]), s = yr((e) => Ii(e, t, o)), c = (0, Z.useRef)(null), l = rt("recharts-pie", i);
	return r || s == null ? (c.current = null, /*#__PURE__*/ Z.createElement(jn, {
		tabIndex: a,
		className: l
	})) : /*#__PURE__*/ Z.createElement(Wn, { zIndex: e.zIndex }, /*#__PURE__*/ Z.createElement(Zi, {
		dataKey: e.dataKey,
		nameKey: e.nameKey,
		sectors: s,
		stroke: e.stroke,
		strokeWidth: e.strokeWidth,
		fill: e.fill,
		name: e.name,
		hide: e.hide,
		tooltipType: e.tooltipType,
		formatter: e.formatter,
		id: t,
		activeShape: e.activeShape
	}), /*#__PURE__*/ Z.createElement(jn, {
		tabIndex: a,
		className: l
	}, /*#__PURE__*/ Z.createElement(ua, {
		props: $($({}, n), {}, { sectors: s }),
		previousSectorsRef: c,
		id: t
	})));
}
function pa(e) {
	var t = cr(e, da), n = t.id, r = Hi(t, Bi), i = hr(r);
	return /*#__PURE__*/ Z.createElement(In, {
		id: n,
		type: "pie"
	}, (e) => /*#__PURE__*/ Z.createElement(Z.Fragment, null, /*#__PURE__*/ Z.createElement(Rn, {
		type: "pie",
		id: e,
		data: r.data,
		dataKey: r.dataKey,
		hide: r.hide,
		angleAxisId: 0,
		radiusAxisId: 0,
		name: r.name,
		nameKey: r.nameKey,
		tooltipType: r.tooltipType,
		legendType: r.legendType,
		fill: r.fill,
		cx: r.cx,
		cy: r.cy,
		startAngle: r.startAngle,
		endAngle: r.endAngle,
		paddingAngle: r.paddingAngle,
		minAngle: r.minAngle,
		innerRadius: r.innerRadius,
		outerRadius: r.outerRadius,
		cornerRadius: r.cornerRadius,
		presentationProps: i,
		maxRadius: t.maxRadius
	}), /*#__PURE__*/ Z.createElement(Yi, Vi({}, r, { id: e })), /*#__PURE__*/ Z.createElement(fa, Vi({}, r, { id: e }))));
}
var ma = pa;
ma.displayName = "Pie";
// node_modules/recharts/es6/chart/PieChart.js
function ha(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function ga(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ha(Object(n), !0).forEach(function(t) {
			_a(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ha(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function _a(e, t, n) {
	return (t = va(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function va(e) {
	var t = ya(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function ya(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var ba = ["item"], xa = ga(ga({}, Jn), {}, {
	layout: "centric",
	startAngle: 0,
	endAngle: 360
}), Sa = /*#__PURE__*/ (0, Z.forwardRef)((e, t) => {
	var n = cr(e, xa);
	return /*#__PURE__*/ Z.createElement(Nn, {
		chartName: "PieChart",
		defaultTooltipEventType: "item",
		validateTooltipEventTypes: ba,
		tooltipPayloadSearcher: Kn,
		categoricalChartProps: n,
		ref: t
	});
}), Ca = 5, wa = 2e3, Ta = 0, Ea = "80%", Da = 0, Oa = 0, ka = 0, Aa = 360, ja = [], Ma = (0, Z.createContext)(null);
function Na() {
	let e = (0, Z.use)(Ma);
	if (!e) throw Error("Pie chart parts (<Pie />, <Tooltip />, …) must be used within <EvilPieChart />");
	return e;
}
function Pa({ config: e, data: t, dataKey: n, nameKey: r, children: i, className: a, chartProps: o, defaultSelectedSector: s = null, onSelectionChange: c, isLoading: l = !1 }) {
	let [u, d] = (0, Z.useState)(s), f = (0, Z.useCallback)((e) => {
		if (d(e), e === null) {
			c?.(null);
			return;
		}
		let i = t.find((t) => t[r] === e);
		i && c?.({
			dataKey: e,
			value: i[n]
		});
	}, [
		t,
		n,
		r,
		c
	]), p = (0, Z.useMemo)(() => ({
		config: e,
		data: t,
		dataKey: n,
		nameKey: r,
		isLoading: l,
		selectedSector: u,
		selectSector: f
	}), [
		e,
		t,
		n,
		r,
		l,
		u,
		f
	]);
	return /* @__PURE__ */ (0, Q.jsx)(Ma, {
		value: p,
		children: /* @__PURE__ */ (0, Q.jsxs)(vn, {
			className: a,
			config: e,
			children: [/* @__PURE__ */ (0, Q.jsx)(Mn, { isLoading: l }), /* @__PURE__ */ (0, Q.jsx)(Sa, {
				id: "evil-charts-pie-chart",
				accessibilityLayer: !0,
				...o,
				children: i
			})]
		})
	});
}
function Fa({ variant: e = "gradient", innerRadius: t = Ta, outerRadius: n = Ea, cornerRadius: r = Da, paddingAngle: i = Oa, startAngle: a = ka, endAngle: o = Aa, isClickable: s = !1, glowingSectors: c = ja, children: l, pieProps: u }) {
	let { config: d, data: f, dataKey: p, nameKey: m, isLoading: h, selectedSector: g, selectSector: _ } = Na(), v = (0, Z.useId)().replace(/:/g, "");
	if (h) return /* @__PURE__ */ (0, Q.jsx)(ma, {
		data: Ua,
		dataKey: "value",
		nameKey: "name",
		innerRadius: t,
		outerRadius: n,
		cornerRadius: r,
		paddingAngle: i,
		startAngle: a,
		endAngle: o,
		strokeWidth: 0,
		isAnimationActive: !1,
		shape: (e) => /* @__PURE__ */ (0, Q.jsx)(Wa, { ...e })
	});
	let y = Ba(l, p), b = f.map((e) => ({
		...e,
		fill: `url(#${v}-colors-${e[m]})`
	}));
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(ma, {
		data: b,
		dataKey: p,
		nameKey: m,
		innerRadius: t,
		outerRadius: n,
		cornerRadius: r,
		paddingAngle: i,
		startAngle: a,
		endAngle: o,
		strokeWidth: 0,
		isAnimationActive: !0,
		style: s ? { cursor: "pointer" } : void 0,
		onClick: (e, t) => {
			if (!s) return;
			let n = f[t]?.[m];
			_(g === n ? null : n);
		},
		shape: (e) => {
			let t = f[e.index ?? 0]?.[m], n = c.includes(t), r = s && g !== null && g !== t;
			return /* @__PURE__ */ (0, Q.jsx)(Ln, {
				...e,
				fill: `url(#${v}-colors-${t})`,
				filter: n ? `url(#${v}-glow-${t})` : void 0,
				stroke: i < 0 ? "var(--background)" : "none",
				strokeWidth: i < 0 ? 5 : 0,
				opacity: r ? .15 : 1,
				className: "transition-opacity duration-200"
			});
		},
		...u,
		children: y
	}), /* @__PURE__ */ (0, Q.jsxs)("defs", { children: [/* @__PURE__ */ (0, Q.jsx)(Va, {
		id: v,
		config: d,
		variant: e
	}), c.length > 0 && /* @__PURE__ */ (0, Q.jsx)(Ha, {
		id: v,
		glowingSectors: c
	})] })] });
}
var Ia = () => null;
function La({ variant: e, roundness: t, defaultIndex: n }) {
	let { isLoading: r, nameKey: i } = Na();
	return r ? null : /* @__PURE__ */ (0, Q.jsx)(Sn, {
		defaultIndex: n,
		content: /* @__PURE__ */ (0, Q.jsx)(Cn, {
			nameKey: i,
			hideLabel: !0,
			roundness: t,
			variant: e
		})
	});
}
function Ra({ variant: e, align: t = "center", verticalAlign: n = "bottom", isClickable: r = !1 }) {
	let { nameKey: i, selectedSector: a, selectSector: o } = Na();
	return /* @__PURE__ */ (0, Q.jsx)(yn, {
		verticalAlign: n,
		align: t,
		content: /* @__PURE__ */ (0, Q.jsx)(bn, {
			selected: a,
			onSelectChange: o,
			isClickable: r,
			nameKey: i,
			variant: e
		})
	});
}
function za({ variant: e = "dots" }) {
	return /* @__PURE__ */ (0, Q.jsx)(_n, { variant: e });
}
var Ba = (e, t) => {
	let n = null;
	return Z.Children.forEach(e, (e) => {
		if (!(0, Z.isValidElement)(e) || e.type !== Ia) return;
		let { dataKey: r, labelListProps: i } = e.props;
		n = /* @__PURE__ */ (0, Q.jsx)(kn, {
			dataKey: r ?? t,
			stroke: "none",
			fontSize: 12,
			fontWeight: 500,
			fill: "currentColor",
			className: "fill-background",
			...i
		});
	}), n;
}, Va = ({ id: e, config: t }) => /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: Object.entries(t).map(([t, n]) => {
	let r = Qn(n);
	return /* @__PURE__ */ (0, Q.jsx)("linearGradient", {
		id: `${e}-colors-${t}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "1",
		children: r === 1 ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)("stop", {
			offset: "0%",
			stopColor: `var(--color-${t}-0)`
		}), /* @__PURE__ */ (0, Q.jsx)("stop", {
			offset: "100%",
			stopColor: `var(--color-${t}-0)`
		})] }) : Array.from({ length: r }, (e, n) => {
			let i = `${n / (r - 1) * 100}%`;
			return /* @__PURE__ */ (0, Q.jsx)("stop", {
				offset: i,
				stopColor: `var(--color-${t}-${n}, var(--color-${t}-0))`
			}, i);
		})
	}, `${e}-colors-${t}`);
}) }), Ha = ({ id: e, glowingSectors: t }) => /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: t.map((t) => /* @__PURE__ */ (0, Q.jsxs)("filter", {
	id: `${e}-glow-${t}`,
	x: "-100%",
	y: "-100%",
	width: "300%",
	height: "300%",
	children: [
		/* @__PURE__ */ (0, Q.jsx)("feGaussianBlur", {
			in: "SourceGraphic",
			stdDeviation: "8",
			result: "blur"
		}),
		/* @__PURE__ */ (0, Q.jsx)("feColorMatrix", {
			in: "blur",
			type: "matrix",
			values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0",
			result: "glow"
		}),
		/* @__PURE__ */ (0, Q.jsxs)("feMerge", { children: [/* @__PURE__ */ (0, Q.jsx)("feMergeNode", { in: "glow" }), /* @__PURE__ */ (0, Q.jsx)("feMergeNode", { in: "SourceGraphic" })] })
	]
}, `${e}-glow-${t}`)) }), Ua = Array.from({ length: Ca }, (e, t) => ({
	name: `loading${t}`,
	value: 100 / Ca
})), Wa = (e) => {
	let { index: t = 0, ...n } = e, r = t / Ca * (wa / 1e3);
	return /* @__PURE__ */ (0, Q.jsx)(kt.g, {
		initial: { opacity: .15 },
		animate: { opacity: [
			.15,
			.5,
			.15
		] },
		transition: {
			duration: wa / 1e3,
			delay: r,
			repeat: Infinity,
			ease: "easeInOut"
		},
		children: /* @__PURE__ */ (0, Q.jsx)(Ln, {
			...n,
			fill: "currentColor"
		})
	});
};
Pa.Pie = Fa, Pa.Label = Ia, Pa.Tooltip = La, Pa.Legend = Ra, Pa.Background = za;
// src/react/settings/storage-charts.tsx
var Ga = {
	database: "var(--color-chart-1)",
	backups: "var(--color-chart-2)",
	playback: "var(--color-chart-3)",
	thumbnails: "var(--color-chart-4)",
	previews: "var(--color-chart-5)",
	downloads: "var(--color-chart-6)",
	sources: "var(--color-chart-7)",
	records: "var(--color-chart-8)",
	tools: "var(--color-chart-9)"
}, Ka = "var(--color-text-tertiary)", qa = {
	database: "bg-chart-1",
	backups: "bg-chart-2",
	playback: "bg-chart-3",
	thumbnails: "bg-chart-4",
	previews: "bg-chart-5",
	downloads: "bg-chart-6",
	sources: "bg-chart-7",
	records: "bg-chart-8",
	tools: "bg-chart-9"
}, Ja = (e) => vt(e);
function Ya(e) {
	let t = e.filter((e) => Ga[e.key] && e.bytes > 0).map((e) => ({
		key: e.key,
		label: e.label,
		bytes: e.bytes,
		color: Ga[e.key]
	})), n = e.filter((e) => !Ga[e.key]).reduce((e, t) => e + t.bytes, 0);
	return n > 0 ? [...t, {
		key: "rest",
		label: J("settings:storageCharts.rest"),
		bytes: n,
		color: Ka
	}] : t;
}
function Xa({ storage: e }) {
	let t = e.usage, n = Ya(t.categories), r = Object.fromEntries(n.map((e) => [e.key, {
		label: e.label,
		colors: _r(e.color)
	}])), i = n.map((e) => ({
		slice: e.key,
		value: e.bytes
	}));
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-5 md:flex-row md:items-center",
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "relative mx-auto size-48 flex-none",
			role: "img",
			"aria-label": J("settings:storageCharts.categoryShare", { size: Ja(t.total_bytes) }),
			children: [/* @__PURE__ */ (0, Q.jsxs)(Pa, {
				data: i,
				dataKey: "value",
				nameKey: "slice",
				config: r,
				className: "aspect-square size-48 flex-none",
				children: [/* @__PURE__ */ (0, Q.jsx)(Pa.Pie, {
					innerRadius: "68%",
					outerRadius: "100%",
					paddingAngle: 1,
					cornerRadius: 3
				}), /* @__PURE__ */ (0, Q.jsx)(xn, {
					nameKey: "slice",
					hideLabel: !0,
					format: Ja
				})]
			}), /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center",
				children: [/* @__PURE__ */ (0, Q.jsx)("b", {
					className: "text-title-2-medium tabular-nums text-text-primary",
					children: Ja(t.total_bytes)
				}), /* @__PURE__ */ (0, Q.jsx)("small", {
					className: "text-caption-1-regular tabular-nums text-text-secondary",
					children: J("settings:storageCharts.fileCount", { count: t.total_files })
				})]
			})]
		}), /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-1 flex-col gap-4",
			children: [/* @__PURE__ */ (0, Q.jsx)("ul", {
				className: "flex flex-wrap gap-x-4 gap-y-1.5",
				"aria-label": J("settings:storageCharts.legend"),
				children: n.map((e) => /* @__PURE__ */ (0, Q.jsxs)("li", {
					className: "flex items-center gap-1.5 text-caption-1-regular text-text-secondary",
					children: [
						/* @__PURE__ */ (0, Q.jsx)("i", {
							"aria-hidden": !0,
							className: `${Hn} ${qa[e.key] || "bg-text-tertiary"}`
						}),
						e.label,
						/* @__PURE__ */ (0, Q.jsx)("span", {
							className: "tabular-nums text-text-primary",
							children: Ja(e.bytes)
						})
					]
				}, e.key))
			}), /* @__PURE__ */ (0, Q.jsx)(Za, { storage: e })]
		})]
	});
}
function Za({ storage: e }) {
	if (e.total_bytes === null || e.free_bytes === null || !e.usage) return null;
	let t = Math.min(e.usage.total_bytes, e.total_bytes), n = e.free_bytes, r = Math.max(0, e.total_bytes - n - t), i = {
		peach: {
			label: J("settings:storageCharts.peachData"),
			colors: _r("var(--color-border-focus-ring)")
		},
		others: {
			label: J("settings:storageCharts.otherFiles"),
			colors: _r(Ka)
		},
		free: {
			label: J("settings:storageCharts.free"),
			colors: _r("var(--color-background-tertiary-default)")
		}
	};
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)("p", {
			className: "text-caption-1-regular text-text-secondary",
			children: J("settings:storageCharts.diskSummary", {
				total: Ja(e.total_bytes),
				systemDrive: e.system_drive ? J("settings:storageCharts.systemDrive") : "",
				share: ((t) => {
					let n = t / e.total_bytes * 100;
					return n < .1 ? J("settings:storageCharts.underTenthPercent") : `${n.toFixed(+(n < 10))}%`;
				})(t),
				free: Ja(n)
			})
		}), /* @__PURE__ */ (0, Q.jsxs)(On, {
			data: [{
				disk: J("settings:libraryIcons.hardDrive"),
				peach: t,
				others: r,
				free: n
			}],
			config: i,
			layout: "horizontal",
			stackType: "percent",
			barRadius: 4,
			chartProps: { margin: {
				top: 0,
				right: 0,
				bottom: 0,
				left: 0
			} },
			className: "aspect-auto h-6 flex-none",
			children: [
				/* @__PURE__ */ (0, Q.jsx)(On.YAxis, {
					dataKey: "disk",
					hide: !0
				}),
				/* @__PURE__ */ (0, Q.jsx)(On.XAxis, { hide: !0 }),
				/* @__PURE__ */ (0, Q.jsx)(On.Bar, { dataKey: "peach" }),
				/* @__PURE__ */ (0, Q.jsx)(On.Bar, { dataKey: "others" }),
				/* @__PURE__ */ (0, Q.jsx)(On.Bar, { dataKey: "free" }),
				/* @__PURE__ */ (0, Q.jsx)(xn, {
					hideLabel: !0,
					format: Ja
				})
			]
		})]
	});
}
// src/react/components/configuration-fields.tsx
function Qa({ id: e, label: t, value: n, onChange: r, options: i, isDisabled: a, isInvalid: o, children: s }) {
	let l = `${e}-label`;
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [
			/* @__PURE__ */ (0, Q.jsx)(le, {
				id: l,
				elementType: "span",
				children: t
			}),
			/* @__PURE__ */ (0, Q.jsx)(Pe, {
				id: e,
				"aria-labelledby": l,
				orientation: "horizontal",
				className: Ae,
				value: n,
				onChange: r,
				isDisabled: a,
				isInvalid: o,
				children: i.map((e) => /* @__PURE__ */ (0, Q.jsx)(c, {
					value: e.value,
					className: ke,
					children: e.label
				}, e.value))
			}),
			s
		]
	});
}
function $a({ prefix: e, suffix: t, unit: n, fieldClassName: r, ...i }) {
	let a = () => /* @__PURE__ */ (0, Q.jsx)("span", {
		"aria-hidden": n ? !0 : void 0,
		className: ct("shrink-0 text-body-regular text-text-secondary", n ? "w-10" : "pr-1"),
		children: n ? /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "absolute inset-y-0 right-0 flex items-center border-l border-border-button-default px-2",
			children: n
		}) : t
	});
	return /* @__PURE__ */ (0, Q.jsx)(M, {
		...i,
		fieldClassName: r,
		leadingAddon: e ? /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "shrink-0 pl-1 text-body-regular text-text-secondary",
			children: e
		}) : void 0,
		trailingIcon: n || t ? a : void 0
	});
}
// src/react/settings/storage-budget-settings.tsx
var eo = [
	[
		"minimum_free_gib",
		J("settings:storageLimits.reservedSpace"),
		J("settings:storageLimits.reservedSpaceHelp")
	],
	[
		"data_max_gib",
		J("settings:storageLimits.dataLimit"),
		J("settings:storageLimits.dataLimitHelp")
	],
	[
		"cache_max_gib",
		J("settings:storageLimits.cacheLimit"),
		J("settings:storageLimits.cacheLimitHelp")
	]
], to = (e) => Kt(e.reasons, e.reason_codes?.map((e) => e?.code ?? null), e.reason_codes?.map((e) => e?.params ?? null));
function no({ initial: e, after: t, receipt: n }) {
	let [r, i] = (0, Z.useState)(e.policy), a = Y(G(e, "error")), [o, s] = (0, Z.useState)("");
	(0, Z.useEffect)(() => {
		if (!r?.enabled || e.policy?.external_cache_path) return;
		let t = new AbortController();
		return s(J("settings:storageLimits.readingCloudDrive")), H("/api/configuration/storage/external-cache", t.signal).then((e) => {
			if (t.signal.aborted) return;
			let n = e.path;
			n ? (i((e) => e && !e.external_cache_path ? {
				...e,
				external_cache_path: n
			} : e), s(J("settings:storageLimits.cacheDetected"))) : s(J("settings:storageLimits.cloudDriveMissing"));
		}).catch((e) => {
			t.signal.aborted || s(J("settings:storageLimits.cacheReadFailed", { error: K(e) }));
		}), () => t.abort();
	}, [r?.enabled, e.policy?.external_cache_path]);
	let c = (e, t) => i((n) => n && {
		...n,
		[e]: t
	}), l = e.last_check;
	return r ? /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "storageBudgetSettings",
		title: J("settings:storageLimits.title"),
		onSubmit: (e) => {
			e.preventDefault(), a.run("save", (e) => U("/api/configuration/storage/policy", r, "POST", e), (e) => {
				s(""), t(e), n(J("settings:storageLimits.saved"));
			});
		},
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(P, { children: [/* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:storageLimits.enable"),
				description: J("settings:storageLimits.enableHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)(V, {
					"aria-label": J("settings:storageLimits.enable"),
					isSelected: r.enabled,
					isDisabled: !!a.busy,
					onChange: (e) => c("enabled", e)
				})
			}), r.enabled ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [eo.map(([e, t, n]) => /* @__PURE__ */ (0, Q.jsx)(R, {
				label: t,
				description: n,
				children: /* @__PURE__ */ (0, Q.jsx)($a, {
					"aria-label": J("settings:storageLimits.limitGib", { label: t }),
					unit: "GiB",
					inputMode: "numeric",
					pattern: "[0-9]*",
					size: "small",
					className: "w-32 shrink-0",
					placeholder: J(e === "minimum_free_gib" ? "settings:shared.auto" : "settings:shared.noLimit"),
					value: r[e] ? String(r[e]) : "",
					onChange: (t) => c(e, Number(t)),
					isDisabled: !!a.busy
				})
			}, e)), /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:storageLimits.autoClean"),
				description: J("settings:storageLimits.autoCleanHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)(V, {
					"aria-label": J("settings:storageLimits.autoClean"),
					isSelected: r.auto_clean,
					isDisabled: !!a.busy,
					onChange: (e) => c("auto_clean", e)
				})
			})] }) : null] }),
			r.enabled ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(M, {
					label: J("settings:storageLimits.externalCache"),
					hint: o || J("settings:storageLimits.externalCacheHelp"),
					value: r.external_cache_path,
					size: "small",
					className: "w-full",
					placeholder: J("settings:shared.notSet"),
					onChange: (e) => c("external_cache_path", e),
					isDisabled: !!a.busy
				})
			}) : null,
			r.enabled && r.external_cache_path ? /* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:storageLimits.externalCacheLimit"),
				description: J("settings:storageLimits.externalCacheLimitHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)($a, {
					"aria-label": J("settings:storageLimits.externalCacheLimitGib"),
					unit: "GiB",
					size: "small",
					className: "w-32 shrink-0",
					placeholder: J("settings:shared.noLimit"),
					inputMode: "numeric",
					pattern: "[0-9]*",
					value: r.external_cache_max_gib ? String(r.external_cache_max_gib) : "",
					onChange: (e) => c("external_cache_max_gib", Number(e)),
					isDisabled: !!a.busy
				})
			}) }) : null,
			/* @__PURE__ */ (0, Q.jsxs)(z, {
				divided: !0,
				children: [
					r.enabled ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:storageLimits.limitsHelp") }) : null,
					r.enabled && l?.paused ? /* @__PURE__ */ (0, Q.jsx)(T, { children: J("settings:storageLimits.pausedWithReasons", { reasons: to(l).join(J("shell:format.semicolonSeparator")) }) }) : null,
					a.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: a.error }) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				...W(a.busy === "save"),
				children: J("settings:shared.saveSettings")
			}) })
		]
	}) : /* @__PURE__ */ (0, Q.jsx)(F, {
		title: J("settings:storageLimits.title"),
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: a.error || J("settings:storageLimits.loadFailed") }) })
	});
}
// src/react/settings/storage-settings.tsx
var ro = "/api/configuration/storage", io = 1500, ao = 36e5, oo = 864e5, so = (e) => e instanceof d && Qe(e.body)?.target || K(e);
function co(e) {
	if (e.free_bytes === null || e.total_bytes === null) return J("settings:shared.notFound");
	let t = J("settings:storageSpace.diskFreeOfTotal", {
		free: vt(e.free_bytes),
		total: vt(e.total_bytes)
	});
	return e.system_drive ? J("settings:storageSpace.systemDriveSuffix", { summary: t }) : t;
}
var lo = (e) => e.cleanable && e.reclaimable > 0, uo = (e) => ({
	...e,
	label: Gt(`storage.category.${e.key}.label`, e.label),
	description: Gt(`storage.category.${e.key}.description`, e.description),
	note: Gt(`storage.category.${e.key}.note`, e.note)
}), fo = (e) => [G(e, "message"), ...(e.notes ?? []).map((t, n) => Gt(e.note_codes?.[n]?.code ?? "", t, e.note_codes?.[n]?.params))], po = (e) => ({
	text: G(e, "text"),
	command: G(e, "command")
});
function mo({ job: e }) {
	let t = e.files || 0, n = e.expected_files || 0, r = {
		files: /* @__PURE__ */ (0, Q.jsx)(Ti, { value: t }),
		size: /* @__PURE__ */ (0, Q.jsx)(Ti, {
			value: e.bytes || 0,
			format: vt
		})
	};
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"aria-live": "polite",
		className: "flex flex-col gap-2",
		children: [n ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(Ce, {
			label: J("settings:storageSpace.measureProgress"),
			value: Math.min(t, n * .99),
			max: n
		}), /* @__PURE__ */ (0, Q.jsx)(j, { children: $t("settings:storageSpace.measuringOfLast", {
			count: t,
			expected: n
		}, r) })] }) : /* @__PURE__ */ (0, Q.jsx)(u, {
			kind: "radar",
			label: J("settings:storageSpace.measuringLabel")
		}), n ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: $t("settings:storageSpace.measuring", { count: t }, r) })]
	});
}
function ho({ category: e, selected: t, disabled: n, onToggle: r }) {
	let i = lo(e), a = e.cleanable ? e.reclaimable > 0 ? J("settings:storageSpace.afterCleanup", { effect: e.note }) : J("settings:storageSpace.nothingToClean") : J("settings:storageSpace.cannotClean", { reason: e.note });
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"data-category": e.key,
		className: "flex min-h-13 w-full items-start gap-3 border-b border-separator-border py-2.5 pr-3 last:border-b-0",
		children: [
			/* @__PURE__ */ (0, Q.jsx)(b, {
				"aria-label": J("settings:storageSpace.cleanCategory", { category: e.label }),
				isSelected: t,
				isDisabled: !i || n,
				onChange: r,
				className: "mt-0.5"
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col gap-0.5",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("p", {
						className: "flex items-center gap-2 text-body-regular text-text-primary",
						children: [/* @__PURE__ */ (0, Q.jsx)("i", {
							"aria-hidden": !0,
							className: `size-2.5 shrink-0 rounded-xs ${qa[e.key] || "bg-text-tertiary"}`
						}), e.label]
					}),
					/* @__PURE__ */ (0, Q.jsx)("p", {
						className: "text-body-2-regular text-text-secondary",
						children: e.description
					}),
					/* @__PURE__ */ (0, Q.jsx)("p", {
						className: "text-caption-1-regular text-text-tertiary",
						children: a
					})
				]
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex shrink-0 flex-col items-end gap-0.5 text-right",
				children: [/* @__PURE__ */ (0, Q.jsx)(Ti, {
					value: e.bytes,
					format: vt,
					className: "text-body-regular text-text-primary"
				}), i ? /* @__PURE__ */ (0, Q.jsxs)("span", {
					className: "text-caption-1-regular text-text-secondary",
					children: [
						J("settings:storageSpace.canFree"),
						" ",
						vt(e.reclaimable)
					]
				}) : null]
			})
		]
	});
}
function go({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(""), [o, s] = (0, Z.useState)(/* @__PURE__ */ new Set()), c = Y(), l = n.job.state !== "idle", u = (0, Z.useRef)(l);
	(0, Z.useEffect)(() => {
		e.usage || e.job.state !== "idle" || document.body.classList.contains("peach-guiding") || c.run("measure", (e) => U(`${ro}/measure`, {}, "POST", e), r);
	}, []), (0, Z.useEffect)(() => {
		if (!l) return;
		let e = new AbortController();
		return Nt({
			signal: e.signal,
			everyMs: io,
			limitMs: ao,
			read: (e) => H(ro, e),
			apply: r,
			done: (e) => e.job.state === "idle"
		}), () => e.abort();
	}, [l]), (0, Z.useEffect)(() => {
		l ? u.current = !0 : u.current && (u.current = !1, s(/* @__PURE__ */ new Set()), n.job.error || t(G(n.job, "message") || J("settings:storageSpace.measured")));
	}, [l]);
	let d = () => void c.run("measure", (e) => U(`${ro}/measure`, {}, "POST", e), r), p = n.usage && {
		...n.usage,
		categories: n.usage.categories.map(uo)
	}, m = p?.categories.filter(lo) ?? [], h = m.filter((e) => o.has(e.key)), g = (e, t) => {
		if (!e.length) return;
		let n = e.reduce((e, t) => e + t.reclaimable, 0);
		at({
			title: t,
			body: J("settings:storageSpace.cleanBody", {
				size: vt(n),
				items: wt(e.map((e) => J("settings:storageSpace.cleanItem", {
					label: e.label,
					size: vt(e.reclaimable),
					effect: e.note
				})))
			}),
			confirmLabel: J("settings:storageSpace.cleanSize", { size: vt(n) }),
			holdToConfirm: !0,
			danger: e.some((e) => e.key === "backups"),
			onConfirm: async () => r(await U(`${ro}/clean`, { categories: e.map((e) => e.key) }))
		});
	}, _ = () => void c.run("relocate", async (e) => {
		let t = await Mt(n.data_root, (t) => U(ge, t, "POST", e), "data");
		if (!t) return;
		let r = n.usage ? vt(n.usage.total_bytes) : "";
		await at({
			title: J("settings:storageSpace.moveDataDirectory"),
			body: J("settings:storageSpace.moveConfirm", {
				size: r,
				from: n.data_root,
				to: t
			}),
			confirmLabel: J("settings:storageSpace.moveDataDirectory"),
			onConfirm: async () => {
				try {
					a(qt(await U(`${ro}/relocate`, { target: t })));
				} catch (e) {
					throw Error(so(e));
				}
			}
		});
	}, () => void 0), v = n.relocation.last, y = v && (v.state === "error" || (v.notes?.length ?? 0) > 0 || Date.now() - v.finished_at * 1e3 < oo), b = p?.categories.find((e) => e.key === n.job.category)?.label, x = i || (n.job.state === "cleaning" ? J("settings:storageSpace.cleaningCategory", { category: b || "" }) : n.job.state === "measuring" ? J("settings:storageSpace.measuringStatus") : h.length ? J("settings:storageSpace.selectedSummary", {
		count: h.length,
		size: vt(h.reduce((e, t) => e + t.reclaimable, 0))
	}) : p ? J("settings:storageSpace.measuredAt", { time: (/* @__PURE__ */ new Date(p.measured_at * 1e3)).toLocaleString(xt) }) : ""), C = l || !!i, ee = (e) => (t) => s((n) => {
		let r = new Set(n);
		return t ? r.add(e) : r.delete(e), r;
	});
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "storageSettings",
		guide: "storage",
		title: J("settings:diskUsage.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(re, { children: [/* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:shared.dataDirectory"),
				children: /* @__PURE__ */ (0, Q.jsx)(xe, {
					path: n.data_root,
					className: "text-body-regular text-text-primary",
					onRevealed: t
				})
			}), /* @__PURE__ */ (0, Q.jsx)(k, {
				term: J("settings:diskUsage.disk"),
				children: co(n)
			})] }),
			/* @__PURE__ */ (0, Q.jsxs)(z, {
				divided: !0,
				children: [
					n.job.state === "measuring" ? /* @__PURE__ */ (0, Q.jsx)(mo, { job: n.job }) : null,
					p?.capacity_error ? /* @__PURE__ */ (0, Q.jsxs)(T, { children: [J("settings:storageSpace.capacityIncomplete"), p.capacity_error] }) : null,
					p?.allocated_bytes == null ? null : /* @__PURE__ */ (0, Q.jsxs)(j, { children: [
						J("settings:storageSpace.allocatedOnDisk"),
						" ",
						vt(p.allocated_bytes)
					] }),
					p ? /* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-storage-result": "",
						className: et({
							variant: "outlined",
							padding: "none",
							className: "flex flex-col"
						}),
						children: [/* @__PURE__ */ (0, Q.jsx)("div", {
							className: "border-b border-separator-border p-4",
							children: /* @__PURE__ */ (0, Q.jsx)(Xa, { storage: p ? {
								...n,
								usage: p
							} : n })
						}), /* @__PURE__ */ (0, Q.jsx)("div", {
							className: "flex flex-col pl-4",
							children: p.categories.map((e) => /* @__PURE__ */ (0, Q.jsx)(ho, {
								category: e,
								selected: o.has(e.key),
								disabled: C,
								onToggle: ee(e.key)
							}, e.key))
						})]
					}) : n.job.state === "measuring" ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:diskUsage.emptyHelp") }),
					n.relocation.available ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: G(n.relocation, "message") }),
					!n.relocation.available && n.relocation.steps?.length ? /* @__PURE__ */ (0, Q.jsx)(S, {
						label: J("settings:storageSpace.moveOnHost"),
						steps: n.relocation.steps.map(po)
					}) : null,
					n.job.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: G(n.job, "message") }) : null,
					c.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: c.error }) : null,
					y && v ? v.state === "error" ? /* @__PURE__ */ (0, Q.jsx)(T, { children: fo(v).join(J("shell:format.semicolonSeparator")) }) : /* @__PURE__ */ (0, Q.jsx)(j, { children: fo(v).join(J("shell:format.semicolonSeparator")) }) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsxs)(A, {
				status: x ? /* @__PURE__ */ (0, Q.jsx)("p", {
					role: i ? "status" : void 0,
					children: x
				}) : null,
				children: [
					p ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						disabled: C || !h.length,
						...W(n.job.state === "cleaning" && h.length > 0),
						onClick: () => g(h, J("settings:storageSpace.cleanSelectedTitle")),
						children: J("settings:storageSpace.cleanSelected")
					}), /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						disabled: C || !m.length,
						onClick: () => g(m, J("settings:storageSpace.cleanAllTitle")),
						children: J("settings:storageSpace.cleanAll")
					})] }) : null,
					/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						disabled: C || !n.relocation.available || !p,
						onClick: _,
						...W(c.busy === "relocate"),
						children: J("settings:diskUsage.changeLocation")
					}),
					/* @__PURE__ */ (0, Q.jsx)(f, {
						disabled: !!i || n.job.state === "cleaning",
						onClick: d,
						...W(c.busy === "measure" || n.job.state === "measuring"),
						children: J(p ? "settings:diskUsage.measureAgain" : "settings:diskUsage.measure")
					})
				]
			})
		]
	}), n.budget ? /* @__PURE__ */ (0, Q.jsx)(no, {
		initial: n.budget,
		after: r,
		receipt: t
	}) : null] });
}
// src/react/settings/maintenance-settings.tsx
var _o = [
	["6", J("settings:automaticUpdates.every6Hours")],
	["24", J("settings:automaticUpdates.daily")],
	["168", J("settings:automaticUpdates.weekly")]
];
function vo({ data: e, receipt: t, reopenTutorial: n, panel: r }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(r),
		children: [
			e.storage ? /* @__PURE__ */ (0, Q.jsx)(go, {
				initial: e.storage,
				receipt: t
			}) : null,
			e.storage ? /* @__PURE__ */ (0, Q.jsx)(mi, { receipt: t }) : null,
			e.storage ? /* @__PURE__ */ (0, Q.jsx)(bi, { receipt: t }) : null,
			e.remote_reporting || e.library_sharing ? /* @__PURE__ */ (0, Q.jsxs)(F, {
				id: "librarySharing",
				guide: "reporting",
				title: J("settings:dataSharing.title"),
				children: [e.remote_reporting ? /* @__PURE__ */ (0, Q.jsx)(Ci, {
					initial: e.remote_reporting,
					receipt: t
				}) : null, e.library_sharing ? /* @__PURE__ */ (0, Q.jsx)("div", {
					className: "border-t border-separator-border",
					children: /* @__PURE__ */ (0, Q.jsx)(xi, {
						initial: e.library_sharing,
						receipt: t
					})
				}) : null]
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(xo, {
				facts: e.facts,
				receipt: t
			}),
			/* @__PURE__ */ (0, Q.jsx)(yo, {
				receipt: t,
				reopenTutorial: n
			}),
			e.uninstall ? /* @__PURE__ */ (0, Q.jsx)(So, {
				uninstall: e.uninstall,
				receipt: t
			}) : null
		]
	});
}
function yo({ reopenTutorial: e }) {
	return /* @__PURE__ */ (0, Q.jsx)("section", {
		"aria-label": J("settings:tour.guidedTour"),
		className: "w-full",
		children: /* @__PURE__ */ (0, Q.jsx)(Ie, { children: /* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:tour.guidedTour"),
			description: J("settings:tour.reopenDescription"),
			children: /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => void e(),
				children: J("settings:tour.reopen")
			})
		}) }) })
	});
}
function bo({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e.mode), [i, a] = (0, Z.useState)(e.interval_hours), o = Y(e.error ? G(e, "error") : e.error), s = (r) => {
		r.preventDefault(), e.available && o.run("save", (e) => U("/api/configuration/automatic-updates", {
			mode: n,
			interval_hours: i
		}, "POST", e), () => t(J("settings:shared.settingsSaved")));
	}, c = e.available ? e.download_available ? J("settings:automaticUpdates.confirmInstall") : void 0 : J("settings:automaticUpdates.needsTray");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "automaticUpdates",
		guide: "automatic-updates",
		title: J("settings:autoUpdate.title"),
		onSubmit: s,
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(P, { children: [
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:autoUpdate.autoCheck"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:autoUpdate.autoCheck"),
						isSelected: n !== "off",
						isDisabled: !e.available,
						onChange: (e) => r(e ? "check" : "off")
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:autoUpdate.autoDownload"),
					description: J("settings:autoUpdate.autoDownloadHelp"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:autoUpdate.autoDownload"),
						isSelected: n === "download",
						isDisabled: !e.available || !e.download_available || n === "off",
						onChange: (e) => r(e ? "download" : "check")
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:autoUpdate.frequency"),
					description: c,
					children: /* @__PURE__ */ (0, Q.jsx)(I, {
						"aria-label": J("settings:autoUpdate.frequency"),
						selectedKey: String(i),
						isDisabled: !e.available || n === "off",
						onSelectionChange: (e) => {
							e !== null && a(Number(e));
						},
						children: _o.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(L, {
							id: e,
							children: t
						}, e))
					})
				})
			] }),
			o.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: o.error })
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				disabled: !e.available,
				...W(o.busy === "save"),
				children: J("settings:shared.saveSettings")
			}) })
		]
	});
}
function xo({ facts: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(null), i = n ?? e, a = Y(), o = (e) => void a.run(e, (t) => U("/api/configuration/media-tools", { tool: e }, "POST", t), (e) => {
		r(e.facts.map(Dt)), t(qt(e) || e.message);
	});
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "facts",
		title: J("settings:runtimeInfo.title"),
		children: [/* @__PURE__ */ (0, Q.jsx)(re, { children: i.map(({ term: e, value: t, install_tool: n, download_url: r, download_label: i }) => /* @__PURE__ */ (0, Q.jsx)(k, {
			term: e,
			children: n ? /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 items-center gap-3",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "min-w-0",
					children: t
				}), /* @__PURE__ */ (0, Q.jsx)(f, {
					size: "small",
					className: "shrink-0",
					onClick: () => o(n),
					...W(a.busy === n),
					children: J("settings:shared.install")
				})]
			}) : /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [t, r ? /* @__PURE__ */ (0, Q.jsx)(D, {
				href: r,
				children: i
			}) : null] })
		}, e)) }), a.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: a.error }) : null]
	});
}
function So({ uninstall: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(!1), [i, a] = (0, Z.useState)(""), o = () => void at({
		title: J("settings:uninstall.title"),
		holdToConfirm: !0,
		danger: !0,
		body: J(n ? "settings:uninstall.confirmFull" : "settings:uninstall.confirmAppOnly"),
		confirmLabel: J("settings:uninstall.title"),
		onConfirm: async () => {
			let e = await U("/api/configuration/uninstall", {
				delete_data: n,
				confirmation: "uninstall-peach"
			});
			a(qt(e) || e.message);
		}
	}), s = i || G(e, "message"), c = [.../* @__PURE__ */ new Set([e.data_root, ...e.directories])];
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "uninstallPeach",
		guide: "uninstall",
		title: J("settings:uninstall.title"),
		children: [
			e.available ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:uninstall.help") }) }) : null,
			/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:uninstall.full"),
				description: J("settings:uninstall.fullHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)(V, {
					"aria-label": J("settings:uninstall.full"),
					isSelected: n,
					isDisabled: !e.full_available || !!i,
					onChange: r
				})
			}) }),
			/* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(C, {
					summary: J("settings:shared.dataDirectory"),
					children: c.map((e) => /* @__PURE__ */ (0, Q.jsx)(xe, {
						path: e,
						className: "text-body-2-regular text-text-secondary",
						onRevealed: t
					}, e))
				})
			}),
			/* @__PURE__ */ (0, Q.jsx)(A, {
				status: s ? /* @__PURE__ */ (0, Q.jsx)("p", {
					role: i ? "status" : void 0,
					children: s
				}) : null,
				children: /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "danger",
					disabled: !e.available || !!i,
					onClick: o,
					children: J("settings:uninstall.title")
				})
			})
		]
	});
}
// src/react/settings/docker-update.tsx
var Co = 3e3, wo = 9e5;
async function To(e, t, n) {
	let r = "";
	return await Nt({
		read: n.read || ((e) => H("/api/client-updates", e)),
		apply: (t) => {
			let n = t.runtime?.version;
			n && n !== e && (r = n);
		},
		done: () => !!r,
		signal: t,
		everyMs: Co,
		limitMs: Math.max(1, n.limitMs),
		pause: n.pause
	}), t.aborted ? null : r ? {
		state: "done",
		version: r
	} : { state: "timeout" };
}
function Eo(e) {
	let [t, n] = (0, Z.useState)({ state: "idle" }), r = Y(), i = (0, Z.useRef)(0);
	return (0, Z.useEffect)(() => {
		if (t.state !== "updating") return;
		let r = new AbortController();
		return To(e, r.signal, { limitMs: wo - (Date.now() - i.current) }).then((e) => {
			e && n(e);
		}), () => r.abort();
	}, [t.state, e]), {
		job: t,
		run: () => r.run("docker-update", (e) => U("/api/configuration/docker-update", {}, "POST", e), () => {
			i.current = Date.now(), n({ state: "updating" });
		}),
		busy: r.busy === "docker-update",
		error: r.error
	};
}
function Do({ job: e }) {
	return e.state === "updating" ? /* @__PURE__ */ (0, Q.jsx)(Ue, {
		embedded: !0,
		kind: "clock",
		label: J("settings:dockerUpdate.updating")
	}) : e.state === "done" ? /* @__PURE__ */ (0, Q.jsx)(j, {
		role: "status",
		children: J("settings:dockerUpdate.done", { version: e.version })
	}) : e.state === "timeout" ? /* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsx)(T, { children: J("settings:dockerUpdate.timeout") }), /* @__PURE__ */ (0, Q.jsx)(S, {
		label: J("settings:dockerUpdate.logsLabel"),
		steps: [{
			text: J("settings:dockerUpdate.watchtowerLog"),
			command: "docker compose logs watchtower"
		}, {
			text: J("settings:dockerUpdate.peachLog"),
			command: "docker compose logs peach"
		}]
	})] }) : null;
}
// src/react/settings/release-updates.tsx
var Oo = /* @__PURE__ */ new Set([
	"downloading",
	"verifying",
	"extracting",
	"preparing",
	"restarting",
	"installing"
]), ko = [
	65,
	75,
	90
], Ao = 7, jo = "https://github.com/peach-mitao/peach/releases", Mo = /((?:[\w.-]+\/[\w.-]+)?#\d+)/;
function No(e) {
	let [t, n] = e.split("#");
	return `https://github.com/${t || "peach-mitao/peach"}/issues/${n}`;
}
function Po({ text: e }) {
	return /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: e.split("`").map((e, t) => t % 2 ? /* @__PURE__ */ (0, Q.jsx)("code", { children: e }, t) : e.split(Mo).map((e, n) => n % 2 ? /* @__PURE__ */ (0, Q.jsx)("a", {
		href: No(e),
		target: "_blank",
		rel: "noopener noreferrer",
		className: "text-accent-600 hover:underline",
		children: e
	}, `${t}-${n}`) : e)) });
}
function Fo({ notes: e }) {
	let t = xt === "zh-CN" ? "zh-CN" : "en";
	return /* @__PURE__ */ (0, Q.jsx)(C, {
		summary: J("settings:releaseUpdates.changelogTitle", { versions: wt(e.map((e) => e.version)) }),
		children: /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "flex flex-col gap-5 pt-3",
			children: e.map((e) => /* @__PURE__ */ (0, Q.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex items-baseline justify-between gap-3",
					children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
						className: "text-body-2-medium text-text-primary",
						children: e.version
					}), /* @__PURE__ */ (0, Q.jsx)(D, {
						href: e.url,
						children: J("settings:releaseUpdates.releasePage")
					})]
				}), /* @__PURE__ */ (0, Q.jsx)("ul", {
					className: "flex list-disc flex-col gap-1 ps-5 text-body-2-regular text-text-primary",
					children: e[t].map((e, t) => /* @__PURE__ */ (0, Q.jsxs)("li", { children: [e.title ? /* @__PURE__ */ (0, Q.jsx)("span", {
						className: "text-body-2-medium",
						children: J("settings:releaseUpdates.highlightTitle", { title: e.title })
					}) : null, /* @__PURE__ */ (0, Q.jsx)(Po, { text: e.text })] }, t))
				})]
			}, e.version))
		})
	});
}
function Io({ initial: e, initialJob: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(t || {
		state: "idle",
		progress: 0
	}), { snapshot: o, failures: s } = en(), c = (0, Z.useRef)(o), l = Y(), u = (0, Z.useRef)(!1), d = (0, Z.useRef)(!0), m = Oo.has(i.state), h = Eo(e.current_version), g = n.state === "available" && !!n.one_click?.available, _ = h.job.state === "updating", v = n.installation_code === "standalone", y = () => void at({
		title: J("settings:releaseUpdates.oneClickUpdate"),
		body: J("settings:releaseUpdates.dockerUpdateBody", { version: n.latest_version || "" }),
		confirmLabel: J("settings:releaseUpdates.startUpdate"),
		cancelLabel: J("settings:shared.cancel"),
		onConfirm: h.run
	});
	(0, Z.useEffect)(() => (d.current = !0, () => {
		d.current = !1;
	}), []);
	let b = async () => {
		let e = await U("/api/configuration/update-restart", {});
		d.current && a(e), tt();
	}, x = () => void at({
		title: J("settings:releaseUpdates.updateReady"),
		body: J("settings:releaseUpdates.installAfterRestart", { version: i.version || "" }),
		confirmLabel: J("settings:releaseUpdates.restartNow"),
		cancelLabel: J("settings:shared.later"),
		onConfirm: b
	});
	(0, Z.useEffect)(() => {
		i.state !== "ready" || u.current || (u.current = !0, x());
	}, [i.state]), (0, Z.useEffect)(() => {
		if (!o || o === c.current) return;
		let e = o.update_job;
		a(e), o.release.checked_at && r(o.release), e.state === "complete" && r((t) => ({
			...t,
			current_version: e.version || t.current_version,
			state: "current",
			message: J("settings:releaseUpdates.latestTestBuild")
		}));
	}, [o]);
	let C = () => {
		m || (u.current = !1, l.run("download", (e) => U("/api/configuration/update", {}, "POST", e), (e) => {
			a(e), tt();
		}));
	}, ee = () => void l.run("check", (e) => H("/api/configuration/updates", e), r, (t) => {
		r({
			...e,
			state: "error"
		}), l.setError(K(t));
	}), te = s >= Ao ? J("settings:releaseUpdates.connectionLost") : "", w = l.error || te || h.error, E = qt(n), O = n.installation_code === "standalone" && (n.state === "available" || i.state !== "idle") ? n.package_kind : void 0, ne = O === "update" ? J("settings:releaseUpdates.updatePackageHelp") : O === "full" ? J("settings:releaseUpdates.includesMediaTools") : O === "installer" ? J("settings:releaseUpdates.installerHelp") : "", ie = i.state === "downloading" && i.total ? `${((i.downloaded || 0) / 1048576).toFixed(1)} / ${(i.total / 1048576).toFixed(1)} MB` : `${i.progress}%`;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "releaseUpdates",
		guide: "updates",
		title: J("settings:releaseUpdates.check"),
		aside: /* @__PURE__ */ (0, Q.jsx)(B, {
			tone: w || n.state === "error" || i.state === "error" || h.job.state === "timeout" ? "error" : m || _ ? "progress" : h.job.state === "done" ? "success" : n.state === "available" ? "warning" : n.state === "unchecked" ? "neutral" : "success",
			children: w || n.state === "error" || i.state === "error" ? J("settings:releaseUpdates.checkIncomplete") : h.job.state === "timeout" ? J("settings:releaseUpdates.updateIncomplete") : m ? J("settings:releaseUpdates.preparing") : _ ? J("settings:releaseUpdates.updating") : h.job.state === "done" ? J("settings:releaseUpdates.updated") : i.state === "ready" ? J("settings:releaseUpdates.readyToInstall") : n.state === "available" ? J("settings:releaseUpdates.updateAvailable") : n.state === "unchecked" ? J("settings:releaseUpdates.notChecked") : J("settings:releaseUpdates.checkDone")
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(re, { children: [
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:releaseUpdates.currentVersion"),
					children: h.job.state === "done" ? h.job.version : n.current_version
				}),
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:releaseUpdates.installation"),
					children: Gt(`release.installation.${n.installation_code}`, n.installation)
				}),
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:releaseUpdates.channel"),
					children: Gt(`release.channel.${n.channel_code}`, n.channel)
				}),
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:releaseUpdates.latestVersion"),
					children: n.latest_version || J("settings:shared.notFound")
				}),
				O ? /* @__PURE__ */ (0, Q.jsxs)(k, {
					term: J("settings:releaseUpdates.package"),
					children: [J(O === "update" ? "settings:releaseUpdates.appUpdatePackage" : O === "installer" ? "settings:releaseUpdates.macosDiskImage" : "settings:releaseUpdates.appAndTools"), n.asset_size ? ` · ${(n.asset_size / 1048576).toFixed(1)} MB` : ""]
				}) : null
			] }),
			ne ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(j, { children: ne }) }) : null,
			n.state === "unchecked" && !n.checked_at && !w && i.state === "idle" ? null : /* @__PURE__ */ (0, Q.jsxs)(z, {
				divided: !0,
				children: [
					n.checked_at ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:releaseUpdates.checkedAt", { time: (/* @__PURE__ */ new Date(n.checked_at * 1e3)).toLocaleString(xt) }) }) : null,
					h.job.state === "done" ? null : n.state === "available" && !w ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(N, {
						tone: "info",
						title: J("settings:releaseUpdates.updateAvailable"),
						children: E
					}), n.notes?.length ? /* @__PURE__ */ (0, Q.jsx)(Fo, { notes: n.notes }) : null] }) : w || n.state === "error" ? /* @__PURE__ */ (0, Q.jsx)(T, { children: w || E }) : n.state === "unchecked" ? null : /* @__PURE__ */ (0, Q.jsx)(j, {
						role: "status",
						children: E
					}),
					n.state === "available" && !w && !g && h.job.state === "idle" && n.steps?.length ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(S, {
						label: J("settings:releaseUpdates.updateOnHost"),
						steps: n.steps.map((e) => ({
							...e,
							text: Gt(`release.dockerStep.${e.id}`, e.text)
						}))
					}), /* @__PURE__ */ (0, Q.jsx)(j, { children: (n.one_click?.reason ? G(n.one_click, "reason") : "") || J("settings:releaseUpdates.watchtowerHint") })] }) : null,
					/* @__PURE__ */ (0, Q.jsx)(Do, { job: h.job }),
					i.state === "error" ? /* @__PURE__ */ (0, Q.jsx)(T, { children: Ct(i) }) : null,
					i.state !== "idle" && i.state !== "error" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
						"aria-live": "polite",
						className: "flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(Ce, {
								label: J("settings:releaseUpdates.progressLabel"),
								value: i.progress,
								stops: ko
							}),
							/* @__PURE__ */ (0, Q.jsxs)(j, { children: [
								J("settings:releaseUpdates.progressSteps"),
								" ",
								Ct(i)
							] }),
							/* @__PURE__ */ (0, Q.jsx)(j, { children: ie })
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, Q.jsxs)(A, {
				status: /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(D, {
							href: "https://peach.video/#download",
							children: J("settings:shared.officialSite")
						}),
						/* @__PURE__ */ (0, Q.jsx)(D, {
							href: "https://github.com/peach-mitao/peach",
							children: "GitHub"
						}),
						/* @__PURE__ */ (0, Q.jsx)(D, {
							href: n.release_url || jo,
							children: J("settings:releaseUpdates.releasePage")
						})
					]
				}),
				children: [
					/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "ghost",
						onClick: () => document.dispatchEvent(new Event(we)),
						children: J("settings:releaseUpdates.whatsNew")
					}),
					/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: i.state === "ready" || g || n.state === "available" && v ? "secondary" : "primary",
						disabled: m || _,
						onClick: ee,
						...W(l.busy === "check"),
						children: J("settings:releaseUpdates.check")
					}),
					h.job.state === "done" ? /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "primary",
						onClick: () => window.location.reload(),
						children: J("settings:releaseUpdates.refreshPage")
					}) : g ? /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "primary",
						onClick: y,
						...W(_ || h.busy),
						children: J("settings:releaseUpdates.oneClickUpdate")
					}) : null,
					n.state === "available" && n.in_app_update && i.state !== "ready" ? /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "primary",
						onClick: C,
						...W(m || l.busy === "download"),
						children: J("settings:releaseUpdates.downloadAndInstall")
					}) : n.state === "available" && v && n.asset_url ? /* @__PURE__ */ (0, Q.jsx)(p, {
						variant: "primary",
						href: n.asset_url,
						children: J("settings:releaseUpdates.downloadNewVersion")
					}) : null,
					i.state === "ready" ? /* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "primary",
						onClick: x,
						children: J("settings:releaseUpdates.restartToInstall")
					}) : null
				]
			})
		]
	});
}
// src/react/settings/upgrade-repairs.tsx
var Lo = {
	pending: J("settings:upgradeRepairs.pending"),
	running: J("settings:upgradeRepairs.repairing"),
	failed: J("settings:repairCenter.needsRetry"),
	deferred: J("settings:repairCenter.deferred"),
	review: J("settings:upgradeRepairs.needsReview"),
	complete: J("settings:shared.completed"),
	unavailable: J("settings:upgradeRepairs.unavailable")
}, Ro = (e) => $t("settings:upgradeRepairs.itemCount", { count: e }, { value: /* @__PURE__ */ (0, Q.jsx)(Ti, { value: e }) });
function zo() {
	let { snapshot: e } = en(), [t, n] = (0, Z.useState)(null), r = Y();
	(0, Z.useEffect)(() => n(null), [e]);
	let i = t ?? e?.repairs, a = i?.state || "pending", o = i?.items.reduce((e, t) => e + (t.pending || 0), 0) || 0, s = i?.items.reduce((e, t) => e + (t.failed || 0), 0) || 0, c = i?.items.reduce((e, t) => e + (t.deferred || 0), 0) || 0, l = i?.items.reduce((e, t) => e + (t.review_count || 0), 0) || 0;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "upgradeRepairs",
		title: J("settings:upgradeRepairs.title"),
		aside: /* @__PURE__ */ (0, Q.jsx)(B, {
			tone: a === "failed" ? "error" : a === "running" ? "progress" : a === "review" ? "warning" : a === "complete" ? "success" : "neutral",
			children: /* @__PURE__ */ (0, Q.jsx)("span", {
				"data-copy-key": `upgradeRepairs.${a}.status`,
				children: Lo[a] || J("settings:shared.notFound")
			}, a)
		}),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(re, { children: [
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:upgradeRepairs.toDo"),
					children: /* @__PURE__ */ (0, Q.jsx)("span", { children: Ro(o) })
				}),
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:shared.failed"),
					children: /* @__PURE__ */ (0, Q.jsx)("span", { children: Ro(s) })
				}),
				c ? /* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:upgradeRepairs.deferred"),
					children: /* @__PURE__ */ (0, Q.jsx)("span", { children: Ro(c) })
				}) : null,
				/* @__PURE__ */ (0, Q.jsx)(k, {
					term: J("settings:upgradeRepairs.toReview"),
					children: /* @__PURE__ */ (0, Q.jsx)("span", { children: Ro(l) })
				})
			] }),
			i?.message || r.error ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: r.error || G(i, "message") }) }) : null,
			a === "running" ? /* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:upgradeRepairs.runningHelp") }), /* @__PURE__ */ (0, Q.jsx)(He, {})] }) : null,
			a === "deferred" ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:upgradeRepairs.deferredHelp") }) }) : null,
			/* @__PURE__ */ (0, Q.jsxs)(A, {
				status: l ? /* @__PURE__ */ (0, Q.jsx)(D, {
					href: "/api/configuration/upgrade-repairs/review",
					children: J("settings:upgradeRepairs.downloadReviewLog")
				}) : null,
				children: [/* @__PURE__ */ (0, Q.jsx)(ue, {
					href: Te,
					size: "small",
					trailingIcon: yt,
					children: J("settings:upgradeRepairs.repairCenterLink")
				}), /* @__PURE__ */ (0, Q.jsx)(f, {
					size: "small",
					variant: "secondary",
					disabled: !i?.available || a === "running" || !!r.busy || !s && a !== "failed",
					onClick: () => void r.run("retry", (e) => U("/api/configuration/upgrade-repairs/retry", {}, "POST", e), (e) => {
						n(e), tt();
					}),
					children: J("settings:upgradeRepairs.retryFailed")
				})]
			})
		]
	});
}
// src/react/settings/general-settings.tsx
function Bo({ data: e, receipt: t, panel: n }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(n),
		children: [
			e.updates ? /* @__PURE__ */ (0, Q.jsx)(Io, {
				initial: e.updates,
				initialJob: e.update_job
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(zo, {}),
			e.automatic_updates ? /* @__PURE__ */ (0, Q.jsx)(bo, {
				initial: e.automatic_updates,
				receipt: t
			}) : null,
			e.startup ? /* @__PURE__ */ (0, Q.jsx)(Vo, {
				startup: e.startup,
				receipt: t
			}) : null
		]
	});
}
function Vo({ startup: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e.enabled), [i, a] = (0, Z.useState)(e.silent), [o, s] = (0, Z.useState)(e.desktop), c = Y(), l = e.available && !e.desktop_message, u = G(e, "desktop_message"), d = G(e, "message");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "startup",
		title: J("settings:startup.title"),
		onSubmit: (r) => {
			r.preventDefault(), e.available && c.run("save", (e) => U("/api/configuration/startup", {
				enabled: n,
				silent: i,
				desktop: o
			}, "POST", e), () => t(J("settings:shared.settingsSaved")));
		},
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(P, { children: [
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:startup.launchAtStartup"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:startup.launchAtStartup"),
						isSelected: n,
						isDisabled: !e.available,
						onChange: r
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:startup.trayOnly"),
					description: J("settings:startup.trayOnlyHelp"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:startup.trayOnly"),
						isSelected: i,
						isDisabled: !e.available || !n,
						onChange: a
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:startup.desktopShortcut"),
					description: u || void 0,
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:startup.desktopShortcut"),
						isSelected: o,
						isDisabled: !l,
						onChange: s
					})
				})
			] }),
			d || c.error ? /* @__PURE__ */ (0, Q.jsxs)(z, {
				divided: !0,
				children: [d ? /* @__PURE__ */ (0, Q.jsx)(j, { children: d }) : null, c.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: c.error }) : null]
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				disabled: !e.available,
				...W(c.busy === "save"),
				children: J("settings:shared.saveSettings")
			}) })
		]
	});
}
// src/react/restart-redirect.ts
var Ho = 8e3, Uo = [
	{
		name: J("settings:cloudDriveGuide.tierHdd"),
		cache: "10–20 GiB",
		read: "256 / 128 KB",
		task: J("settings:cloudDriveGuide.tasksOne")
	},
	{
		name: J("settings:cloudDriveGuide.tierSata"),
		cache: "20–50 GiB",
		read: "256 / 128 KB",
		task: J("settings:cloudDriveGuide.tasksOneToTwo")
	},
	{
		name: J("settings:cloudDriveGuide.tierNvme"),
		cache: "50–100 GiB",
		read: "256 / 128 KB",
		task: J("settings:cloudDriveGuide.tasksTwoPlus")
	}
], Wo = [
	["cache", J("settings:cloudDriveGuide.cacheLimit")],
	["read", J("settings:cloudDriveGuide.readLength")],
	["task", J("settings:cloudDriveGuide.concurrentVideos")]
];
function Go() {
	return /* @__PURE__ */ (0, Q.jsx)("div", {
		className: "@container flex flex-col gap-3",
		children: /* @__PURE__ */ (0, Q.jsxs)(C, {
			summary: J("settings:cloudDriveGuide.title"),
			children: [
				/* @__PURE__ */ (0, Q.jsxs)(j, { children: [J("settings:cloudDriveGuide.mountFirst"), /* @__PURE__ */ (0, Q.jsx)(D, {
					href: "https://www.clouddrive2.com/help.html",
					children: J("settings:cloudDriveGuide.mountHelp")
				})] }),
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudDriveGuide.cacheHelp") }),
				/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudDriveGuide.writeAccess") }),
				/* @__PURE__ */ (0, Q.jsx)("ul", {
					"aria-label": J("settings:cloudDriveGuide.tiersLabel"),
					className: "flex flex-col gap-2",
					children: Uo.map((e) => /* @__PURE__ */ (0, Q.jsxs)("li", {
						className: "flex flex-col gap-2 rounded-2lg border border-separator-border bg-background-primary-default p-3",
						children: [/* @__PURE__ */ (0, Q.jsx)("p", {
							className: "text-body-medium text-text-primary",
							children: e.name
						}), /* @__PURE__ */ (0, Q.jsx)("dl", {
							className: "inline-grid grid-cols-1 gap-2 @md:grid-cols-3",
							children: Wo.map(([t, n]) => /* @__PURE__ */ (0, Q.jsxs)("div", {
								className: "flex flex-col",
								children: [/* @__PURE__ */ (0, Q.jsx)("dt", {
									className: "text-caption-1-regular text-text-secondary",
									children: n
								}), /* @__PURE__ */ (0, Q.jsx)("dd", {
									className: "text-body-regular text-text-primary",
									children: e[t]
								})]
							}, t))
						})]
					}, e.name))
				}),
				/* @__PURE__ */ (0, Q.jsxs)("ul", {
					className: "flex list-disc flex-col gap-1 pl-5 text-body-2-regular text-text-secondary",
					children: [
						/* @__PURE__ */ (0, Q.jsx)("li", { children: J("settings:cloudDriveGuide.cacheSettingsTip") }),
						/* @__PURE__ */ (0, Q.jsx)("li", { children: J("settings:cloudDriveGuide.readLengthTip") }),
						/* @__PURE__ */ (0, Q.jsx)("li", { children: J("settings:cloudDriveGuide.cacheTypesTip") })
					]
				}),
				/* @__PURE__ */ (0, Q.jsx)(j, { children: /* @__PURE__ */ (0, Q.jsx)(D, {
					href: "https://github.com/peach-mitao/peach/blob/master/docs/CLOUDDRIVE.md",
					children: J("settings:cloudDriveGuide.fullGuide")
				}) })
			]
		})
	});
}
// src/react/settings/cloud-proxy-settings.tsx
var Ko = "/api/configuration/cloud-proxies", qo = [
	["direct", J("settings:cloudProxy.direct")],
	["system", J("settings:shared.followSystem")],
	["http", J("settings:cloudProxy.http")],
	["socks5", J("settings:cloudProxy.socks5")]
];
function Jo({ receipt: e }) {
	let [t, n] = (0, Z.useState)(null), [r, i] = (0, Z.useState)(!0), a = (0, Z.useRef)(/* @__PURE__ */ new Set()), o = (0, Z.useRef)(/* @__PURE__ */ new Set()), [s, c] = (0, Z.useState)(!1), l = (0, Z.useRef)(() => void 0), u = Y(), d = () => {
		o.current.size || u.run("refresh", (e) => H(Ko, e), (e) => {
			a.current.clear(), n(e), i(!1);
		}, (e) => {
			i(!1), u.setError(e instanceof Error ? e.message : J("settings:cloudProxy.loadFailed"));
		});
	};
	return l.current = d, (0, Z.useEffect)(() => {
		l.current();
		let e = () => {
			a.current.size || l.current();
		};
		return window.addEventListener("focus", e), () => window.removeEventListener("focus", e);
	}, []), (0, Z.useEffect)(() => {
		if (!t) return;
		let e = (e) => e.mode === "http" || e.mode === "socks5";
		Rt("cloudProxy", {
			configured: t.configured !== !1,
			unlinked: t.unlinked?.length ?? 0,
			accounts: t.accounts.map((t) => [e(t.data), e(t.api)])
		});
	}, [t]), r ? /* @__PURE__ */ (0, Q.jsx)(Ne, {
		label: J("settings:cloudProxy.loading"),
		html: nt
	}) : /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "cloud-proxy",
		title: J("settings:cloudProxy.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: h }), /* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			children: [
				u.error ? /* @__PURE__ */ (0, Q.jsxs)(N, {
					tone: "error",
					title: J("settings:cloudProxy.readFailedTitle"),
					children: [
						u.error,
						" ",
						/* @__PURE__ */ (0, Q.jsx)(ue, {
							href: "/settings/downloads",
							size: "small",
							children: J("settings:cloudProxy.downloadSettingsLink")
						})
					]
				}) : null,
				t?.configured === !1 ? /* @__PURE__ */ (0, Q.jsxs)(j, { children: [
					J("settings:cloudProxy.notConfigured"),
					" ",
					/* @__PURE__ */ (0, Q.jsx)(ue, {
						href: "/settings/downloads",
						size: "small",
						children: J("settings:cloudProxy.downloadSettingsLink")
					})
				] }) : t?.accounts.length === 0 && !t.unlinked?.length ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudProxy.noLibraries") }) : null,
				t?.unlinked?.map((e) => /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-1",
					children: [/* @__PURE__ */ (0, Q.jsx)(ie, { children: /* @__PURE__ */ (0, Q.jsxs)("span", {
						className: "inline-flex items-center gap-2",
						children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: Mr(e.location) }), e.name]
					}) }), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudProxy.unmatched") })]
				}, e.root)),
				t?.accounts.map((t) => /* @__PURE__ */ (0, Q.jsx)(Yo, {
					initial: t,
					receipt: e,
					onDirty: () => a.current.add(t.id),
					onSaving: (e) => {
						e ? o.current.add(t.id) : o.current.delete(t.id), c(!!o.current.size);
					},
					onSaved: (e) => {
						a.current.delete(e.id), n((t) => t && {
							...t,
							accounts: t.accounts.map((t) => t.id === e.id ? e : t)
						});
					}
				}, t.id + t.revision))
			]
		})] }), /* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
			variant: "secondary",
			disabled: s,
			onClick: d,
			...W(u.busy === "refresh"),
			children: J("settings:shared.reload")
		}) })]
	});
}
function Yo({ initial: e, receipt: t, onDirty: n, onSaved: r, onSaving: i }) {
	let [a, o] = (0, Z.useState)(e), [s, c] = (0, Z.useState)([]), l = wt(a.libraries?.map((e) => e.name) ?? []) || a.name, u = Y(), d = (e, t) => {
		o((n) => ({
			...n,
			[e]: t
		})), c((t) => t.includes(e) ? t : [...t, e]), n();
	};
	return /* @__PURE__ */ (0, Q.jsxs)("form", {
		"aria-label": J("settings:cloudProxy.accountForm", { name: l }),
		onSubmit: (e) => {
			e.preventDefault(), i(!0), u.run("save", (e) => U(Ko, {
				id: a.id,
				revision: a.revision,
				...s.includes("api") ? { api: a.api } : {},
				...s.includes("data") ? { data: a.data } : {}
			}, "POST", e), (e) => {
				o(e), c([]), r(e), t(J("settings:cloudProxy.saved"));
			}).finally(() => i(!1));
		},
		className: "flex min-w-0 flex-col gap-4 border-t border-separator-border pt-4",
		children: [
			/* @__PURE__ */ (0, Q.jsx)(ie, { children: /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "inline-flex items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: Mr(a.libraries?.[0]?.location || (a.cloud === "115open" ? "115" : a.cloud.toLowerCase())) }), l]
			}) }),
			/* @__PURE__ */ (0, Q.jsxs)(j, { children: [
				a.name,
				" · ",
				a.path
			] }),
			/* @__PURE__ */ (0, Q.jsx)(Xo, {
				label: J("settings:cloudProxy.dataProxy"),
				value: a.data,
				disabled: !a.writable || !!u.busy,
				onChange: (e) => d("data", e)
			}),
			/* @__PURE__ */ (0, Q.jsx)(Xo, {
				label: J("settings:cloudProxy.apiProxy"),
				value: a.api,
				disabled: !a.writable || !!u.busy,
				onChange: (e) => d("api", e)
			}),
			a.writable ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:cloudProxy.needsWritePermission") }),
			u.error ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("settings:shared.notSaved"),
				children: u.error
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ (0, Q.jsx)(f, {
					type: "submit",
					disabled: !a.writable || !s.length,
					...W(u.busy === "save"),
					children: J("settings:shared.saveSettings")
				})
			})
		]
	});
}
function Xo({ label: e, value: t, disabled: n, onChange: r }) {
	let i = t.mode === "http" || t.mode === "socks5";
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, Q.jsx)(ie, { children: e }),
			/* @__PURE__ */ (0, Q.jsxs)(I, {
				"aria-label": e,
				selectedKey: t.mode,
				isDisabled: n,
				onSelectionChange: (e) => {
					e && r({
						...t,
						mode: String(e)
					});
				},
				children: [t.mode === "unknown" ? /* @__PURE__ */ (0, Q.jsx)(L, {
					id: "unknown",
					children: J("settings:cloudProxy.unknownType")
				}) : null, qo.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(L, {
					id: e,
					children: t
				}, e))]
			}),
			i ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap gap-3",
				children: [/* @__PURE__ */ (0, Q.jsx)(M, {
					className: "min-w-40 flex-1",
					label: J("settings:cloudProxy.host", { label: e }),
					value: t.host,
					autoComplete: "off",
					isDisabled: n,
					onChange: (e) => r({
						...t,
						host: e
					})
				}), /* @__PURE__ */ (0, Q.jsx)(M, {
					className: "w-full sm:w-28",
					label: J("settings:cloudProxy.port", { label: e }),
					value: t.port ? String(t.port) : "",
					inputMode: "numeric",
					isDisabled: n,
					onChange: (e) => r({
						...t,
						port: Number(e)
					})
				})]
			}), /* @__PURE__ */ (0, Q.jsxs)(C, {
				summary: J("settings:cloudProxy.authentication"),
				children: [
					/* @__PURE__ */ (0, Q.jsx)(M, {
						label: J("settings:cloudProxy.username", { label: e }),
						value: t.username,
						autoComplete: "off",
						isDisabled: n,
						onChange: (e) => r({
							...t,
							username: e
						})
					}),
					/* @__PURE__ */ (0, Q.jsx)(M, {
						label: J("settings:cloudProxy.password", { label: e }),
						type: "password",
						value: t.password || "",
						autoComplete: "new-password",
						isDisabled: n,
						placeholder: t.password_set ? J("settings:shared.savedLeaveBlank") : J("settings:shared.optional"),
						onChange: (e) => r({
							...t,
							password: e
						})
					}),
					t.password_set ? /* @__PURE__ */ (0, Q.jsx)(b, {
						isSelected: !!t.clear_password,
						isDisabled: n,
						onChange: (e) => r({
							...t,
							clear_password: e
						}),
						children: J("settings:cloudProxy.clearPassword")
					}) : null
				]
			})] }) : null
		]
	});
}
// src/react/settings/library-icon-picker.tsx
var Zo = [
	["", J("settings:libraryIcons.auto")],
	["hard-drive", J("settings:libraryIcons.hardDrive")],
	["database", J("settings:libraryIcons.database")],
	["heart", J("settings:libraryIcons.crush")],
	["heart-hand", J("settings:libraryIcons.intimate")],
	["flame", J("settings:libraryIcons.passion")],
	["cherry", J("settings:libraryIcons.cherry")],
	["lollipop", J("settings:libraryIcons.sweetie")],
	["candy", J("settings:libraryIcons.candy")],
	["banana", J("settings:libraryIcons.banana")],
	["droplets", J("settings:libraryIcons.wet")],
	["venus", J("settings:libraryIcons.female")],
	["mars", J("settings:libraryIcons.male")],
	["venus-and-mars", J("settings:libraryIcons.couple")],
	["gem", J("settings:libraryIcons.featured")],
	["crown", J("settings:libraryIcons.queen")],
	["ribbon", J("settings:libraryIcons.ribbon")],
	["shirt", J("settings:libraryIcons.uniform")],
	["graduation-cap", J("settings:libraryIcons.student")],
	["stethoscope", J("settings:libraryIcons.nurse")],
	["glasses", J("settings:libraryIcons.glasses")],
	["footprints", J("settings:libraryIcons.footprints")],
	["hand", J("settings:libraryIcons.hands")],
	["flower", J("settings:libraryIcons.flower")],
	["venetian-mask", J("settings:libraryIcons.cosplay")],
	["rabbit", J("settings:libraryIcons.bunnyGirl")],
	["paw-print", J("settings:libraryIcons.animalEars")],
	["dumbbell", J("settings:libraryIcons.fitness")],
	["bed-double", J("settings:libraryIcons.bedroom")],
	["bath", J("settings:libraryIcons.bathroom")],
	["key-round", J("settings:libraryIcons.private")],
	["wine", J("settings:libraryIcons.tipsy")],
	["cigarette", J("settings:libraryIcons.smoking")],
	["moon", J("settings:libraryIcons.night")],
	["sparkles", J("settings:libraryIcons.fantasy")],
	["camera", J("settings:libraryIcons.photoShoot")],
	["video", J("settings:libraryIcons.videos")],
	["film", J("settings:libraryIcons.movies")],
	["image", J("settings:libraryIcons.imageSets")],
	["gamepad-2", J("settings:libraryIcons.games")],
	["star", J("settings:libraryIcons.favorites")],
	["tags", J("settings:libraryIcons.topics")]
];
function Qo(e) {
	let t = e === "local" ? "" : me[e];
	return t ? [t, J("settings:libraryIcons.auto")] : ["hard-drive", J("settings:libraryIcons.default")];
}
var $o = "auto";
function es({ value: t, label: r, kind: i = "local", onChange: a }) {
	let l = (0, Z.useRef)(null), [u, d] = (0, Z.useState)(!1), [p, m] = (0, Z.useState)(t), [h, g] = Qo(i);
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(f, {
		ref: l,
		variant: "secondary",
		className: "self-start",
		"aria-label": r,
		"aria-haspopup": "dialog",
		"aria-expanded": u,
		onClick: () => {
			m(t), d(!0);
		},
		children: /* @__PURE__ */ (0, Q.jsxs)("span", {
			"data-icon-choice": !0,
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: t || h }), ((e) => e && Zo.find(([t]) => t === e)?.[1] || g)(t)]
		})
	}), /* @__PURE__ */ (0, Q.jsx)(n, {
		triggerRef: l,
		isOpen: u,
		onOpenChange: d,
		placement: "bottom start",
		offset: 4,
		className: he,
		children: /* @__PURE__ */ (0, Q.jsxs)(o, {
			"aria-label": J("settings:libraryIcons.dialogLabel", { label: r }),
			className: "flex w-72 flex-col gap-3 outline-none",
			children: [
				/* @__PURE__ */ (0, Q.jsx)(e, {
					slot: "title",
					className: "px-1 text-body-medium text-text-primary",
					children: J("settings:libraryIcons.title")
				}),
				/* @__PURE__ */ (0, Q.jsx)(s, {
					"aria-label": J("settings:libraryIcons.choices"),
					value: p || $o,
					onChange: (e) => m(e === $o ? "" : e),
					className: "inline-grid grid-cols-7 gap-1",
					children: Zo.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(c, {
						value: e || $o,
						"aria-label": e ? t : g,
						className: "flex h-10 cursor-pointer items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-dropdown-item-hover-background focus-visible:ring-2 focus-visible:ring-border-focus-ring data-selected:bg-dropdown-item-hover-background data-selected:text-text-primary",
						children: /* @__PURE__ */ (0, Q.jsx)(Be, { mark: e || h })
					}, e || $o))
				}),
				/* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex justify-end gap-2 border-t border-separator-border pt-2.5",
					children: [/* @__PURE__ */ (0, Q.jsx)(f, {
						variant: "secondary",
						onClick: () => d(!1),
						children: J("settings:shared.cancel")
					}), /* @__PURE__ */ (0, Q.jsx)(f, {
						disabled: p === t,
						onClick: () => {
							a(p), d(!1);
						},
						children: J("settings:shared.apply")
					})]
				})
			]
		})
	})] });
}
// src/react/settings/library-policy-settings.tsx
var ts = [
	["probe", J("settings:libraryPolicy.stepProbe")],
	["metadata", J("settings:libraryPolicy.stepMetadata")],
	["cover", J("settings:libraryPolicy.stepCovers")],
	["people", J("settings:libraryPolicy.stepAvatars")],
	["preview", J("settings:libraryPolicy.stepContactSheet")]
], ns = [
	"probe",
	"metadata",
	"cover",
	"people",
	"preview"
], rs = [
	[
		"auto",
		J("settings:libraryPolicy.auto"),
		J("settings:libraryPolicy.autoHint")
	],
	[
		"local",
		J("settings:libraryPolicy.localOnly"),
		J("settings:libraryPolicy.localHint")
	],
	[
		"custom",
		J("settings:shared.custom"),
		J("settings:libraryPolicy.customHint")
	]
];
function is() {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		"data-policy-legend": "",
		className: "flex flex-col gap-1",
		children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: be }), /* @__PURE__ */ (0, Q.jsxs)(C, {
			summary: J("settings:libraryPolicy.compare"),
			children: [/* @__PURE__ */ (0, Q.jsxs)("table", {
				"data-policy-matrix": "",
				className: "text-body-2-regular",
				children: [/* @__PURE__ */ (0, Q.jsx)("thead", { children: /* @__PURE__ */ (0, Q.jsxs)("tr", { children: [/* @__PURE__ */ (0, Q.jsx)("th", {
					scope: "col",
					children: /* @__PURE__ */ (0, Q.jsx)(a, { children: J("settings:libraryPolicy.step") })
				}), _e.map((e) => /* @__PURE__ */ (0, Q.jsx)("th", {
					scope: "col",
					children: e
				}, e))] }) }), /* @__PURE__ */ (0, Q.jsx)("tbody", { children: ye.map(([e, ...t]) => /* @__PURE__ */ (0, Q.jsxs)("tr", { children: [/* @__PURE__ */ (0, Q.jsx)("th", {
					scope: "row",
					children: e
				}), t.map((e, t) => /* @__PURE__ */ (0, Q.jsx)("td", {
					"data-policy-cell": e === "✓" ? "on" : e === "—" ? "off" : "choice",
					children: e === "✓" ? /* @__PURE__ */ (0, Q.jsx)("span", {
						"aria-label": J("settings:libraryPolicy.included"),
						children: "✓"
					}) : e === "—" ? /* @__PURE__ */ (0, Q.jsx)("span", {
						"aria-label": J("settings:libraryPolicy.notIncluded"),
						children: "—"
					}) : e
				}, _e[t]))] }, e)) })]
			}), /* @__PURE__ */ (0, Q.jsx)(j, { children: ve })]
		})]
	});
}
function as({ name: e, value: t, onChange: n }) {
	return /* @__PURE__ */ (0, Q.jsx)(Fe, {
		"data-guide-target": "library-policy",
		className: "w-full",
		"aria-label": J("settings:libraryPolicy.modeLabel", { name: e }),
		selectedKey: t,
		prefix: J("settings:libraryPolicy.mode"),
		renderValue: /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "truncate",
			children: rs.find(([e]) => e === t)?.[1]
		}),
		onSelectionChange: (e) => n(String(e)),
		children: rs.map(([e, t, n]) => /* @__PURE__ */ (0, Q.jsx)(L, {
			id: e,
			textValue: t,
			children: /* @__PURE__ */ (0, Q.jsxs)("span", {
				className: "flex min-w-0 flex-col",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", { children: t }), /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-2-regular text-text-secondary whitespace-normal",
					children: n
				})]
			})
		}, e))
	});
}
function os({ name: e, value: t, onChange: n, previewsOff: r = !1 }) {
	return /* @__PURE__ */ (0, Q.jsxs)(C, {
		defaultOpen: !0,
		summary: J("settings:libraryPolicy.stepsSummary", {
			name: e,
			selected: t.length,
			total: ts.length
		}),
		children: [/* @__PURE__ */ (0, Q.jsx)("div", {
			className: "flex flex-wrap gap-x-6 gap-y-2",
			role: "group",
			"aria-label": J("settings:libraryPolicy.stepsLabel", { name: e }),
			children: ts.map(([e, i]) => /* @__PURE__ */ (0, Q.jsx)(b, {
				isSelected: t.includes(e),
				isDisabled: r && e === "preview",
				onChange: (r) => n(r ? [...t, e] : t.filter((t) => t !== e)),
				children: i
			}, e))
		}), r ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:libraryPolicy.previewsOff") }) : null]
	});
}
function ss({ id: e, name: t, value: i, onChange: a }) {
	let s = (0, Z.useRef)(null), [c, u] = (0, Z.useState)(!1), d = l.find(([e]) => e === i)?.[1] || J("settings:libraryColor.none"), f = (t) => {
		a(t), Pt(e, t), u(!1);
	};
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsxs)("button", {
		ref: s,
		type: "button",
		className: "text-body-medium",
		"data-glow-chip": "",
		"data-library-color-trigger": "",
		"aria-haspopup": "dialog",
		"aria-expanded": c,
		"aria-label": J("settings:libraryColor.triggerLabel", {
			name: t || J("settings:mediaLibraries.untitled"),
			color: d
		}),
		title: d,
		onClick: () => u(!0),
		children: [
			/* @__PURE__ */ (0, Q.jsx)("span", {
				"aria-hidden": !0,
				className: "text-text-tertiary",
				children: J("settings:libraryColor.label")
			}),
			i ? /* @__PURE__ */ (0, Q.jsx)("span", {
				"data-glow-ball": "",
				"aria-hidden": "true",
				"data-accent-ball": i
			}) : /* @__PURE__ */ (0, Q.jsx)("span", {
				"data-glow-ball": "",
				"data-library-none": "",
				"aria-hidden": "true"
			}),
			/* @__PURE__ */ (0, Q.jsx)("span", { children: d })
		]
	}), /* @__PURE__ */ (0, Q.jsx)(r, {
		getContainer: () => At(s.current),
		children: /* @__PURE__ */ (0, Q.jsx)(n, {
			triggerRef: s,
			isOpen: c,
			onOpenChange: u,
			placement: "bottom start",
			offset: 8,
			containerPadding: 12,
			className: he,
			children: /* @__PURE__ */ (0, Q.jsxs)(o, {
				"aria-label": J("settings:libraryColor.dialogLabel", { name: t || J("settings:mediaLibraries.untitled") }),
				className: "outline-none",
				children: [/* @__PURE__ */ (0, Q.jsx)("p", {
					className: "px-1 pb-2 text-body-medium text-text-primary",
					children: J("settings:libraryColor.choose")
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					"data-accent-grid": "",
					"data-library-colors": "",
					role: "group",
					children: [/* @__PURE__ */ (0, Q.jsx)("button", {
						type: "button",
						"data-glow-chip": "",
						"aria-pressed": !i,
						title: J("settings:libraryColor.none"),
						"aria-label": J("settings:libraryColor.none"),
						onClick: () => f(""),
						children: /* @__PURE__ */ (0, Q.jsx)("span", {
							"data-glow-ball": "",
							"data-library-none": "",
							"aria-hidden": "true"
						})
					}), l.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)("button", {
						type: "button",
						"data-glow-chip": "",
						"aria-pressed": e === i,
						title: t,
						"aria-label": t,
						onClick: () => f(e),
						children: /* @__PURE__ */ (0, Q.jsx)("span", {
							"data-glow-ball": "",
							"aria-hidden": "true",
							"data-accent-ball": e
						})
					}, e))]
				})]
			})
		})
	})] });
}
// src/react/settings/push-discovery-settings.tsx
var cs = "/api/configuration/push-discovery", ls = "/api/configuration/push-discovery/secret";
function us({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(e.prefixes), [o, s] = (0, Z.useState)(""), c = Y(), l = n.media_roots, [u, d] = (0, Z.useState)(e), p = (e, n) => {
		r(e), d(e), a(e.prefixes), s(""), t(n);
	}, m = (e, t) => a((n) => n.map((n, r) => r === e ? {
		...n,
		...t
	} : n)), h = (e) => {
		e.preventDefault();
		let t = {
			enabled: n.enabled,
			watch_local: n.watch_local,
			cloud: n.cloud,
			prefixes: i
		};
		c.run("save", (e) => U(cs, t, "POST", e), (e) => p(e, J("settings:shared.settingsSaved")), (e) => s(K(e)));
	}, g = () => {
		c.run("secret", (e) => U(ls, {}, "POST", e), (e) => p(e, J("settings:pushDiscovery.secretRotated")), (e) => s(K(e)));
	}, _ = [
		J("settings:pushDiscovery.ingestedCount", { count: u.queue.ingested }),
		u.queue.failed ? J("settings:pushDiscovery.failedCount", { count: u.queue.failed }) : "",
		u.queue.pending ? J("settings:pushDiscovery.pendingCount", { count: u.queue.pending }) : ""
	].filter(Boolean).join(J("shell:format.clauseSeparator")), v = u.local_running ? J("settings:pushDiscovery.monitoring", { paths: wt(u.local_roots) }) : (u.local_message ? G(u, "local_message") : "") || J("settings:pushDiscovery.notRunningDetail");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "pushDiscovery",
		guide: "discovery",
		title: J("settings:fileDiscovery.title"),
		onSubmit: h,
		children: [
			/* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)("span", {
					className: "text-body-regular text-text-secondary",
					children: J("settings:pushDiscovery.localMonitoring")
				}), /* @__PURE__ */ (0, Q.jsx)(B, {
					tone: !u.enabled || !u.watch_local ? "neutral" : u.local_running ? "progress" : "warning",
					children: !u.enabled || !u.watch_local ? J("settings:shared.notEnabled") : u.local_running ? J("settings:shared.running") : J("settings:pushDiscovery.notRunning")
				})]
			}) }),
			/* @__PURE__ */ (0, Q.jsxs)(P, { children: [
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:fileDiscovery.autoImport"),
					description: u.enabled ? _ : void 0,
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:fileDiscovery.autoImport"),
						isSelected: n.enabled,
						isDisabled: !n.available,
						onChange: (e) => r({
							...n,
							enabled: e
						})
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:fileDiscovery.monitorLocal"),
					description: u.enabled && u.watch_local ? v : void 0,
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:fileDiscovery.monitorLocal"),
						isSelected: n.watch_local,
						isDisabled: !n.available || !n.enabled,
						onChange: (e) => r({
							...n,
							watch_local: e
						})
					})
				}),
				/* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:fileDiscovery.cloudNotify"),
					description: J("settings:fileDiscovery.cloudNotifyHelp"),
					children: /* @__PURE__ */ (0, Q.jsx)(V, {
						"aria-label": J("settings:fileDiscovery.cloudNotify"),
						isSelected: n.cloud,
						isDisabled: !n.available || !n.enabled,
						onChange: (e) => r({
							...n,
							cloud: e
						})
					})
				}),
				u.enabled && u.cloud ? /* @__PURE__ */ (0, Q.jsx)(R, {
					label: J("settings:fileDiscovery.webhookConfig"),
					description: u.config_toml ? J("settings:pushDiscovery.webhookHelp") : u.origin ? J("settings:pushDiscovery.noSecret") : J("settings:pushDiscovery.needsLanUrl")
				}) : null
			] }),
			u.enabled && u.queue.last_error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(N, {
					tone: "error",
					title: J("settings:pushDiscovery.lastImportFailed"),
					children: u.queue.last_error
				})
			}) : null,
			u.enabled && u.cloud && u.config_toml ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)("div", {
					className: "flex flex-col gap-3",
					children: /* @__PURE__ */ (0, Q.jsxs)(C, {
						summary: J("settings:fileDiscovery.viewConfig"),
						children: [/* @__PURE__ */ (0, Q.jsx)(mn, {
							code: u.config_toml,
							language: "toml",
							label: J("settings:pushDiscovery.configLabel"),
							bounded: !1,
							copyLabel: J("settings:pushDiscovery.copyConfig"),
							onCopy: () => t(J("settings:pushDiscovery.configCopied"))
						}), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:pushDiscovery.invalidPasteHelp") })]
					})
				})
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, Q.jsx)(ie, { children: J("settings:pushDiscovery.cloudPrefixes") }),
						/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:pushDiscovery.cloudPrefixesHelp") }),
						/* @__PURE__ */ (0, Q.jsx)("div", {
							role: "group",
							"aria-label": J("settings:pushDiscovery.cloudPrefixes"),
							className: "flex flex-col gap-3",
							children: i.map((e, t) => /* @__PURE__ */ (0, Q.jsxs)("div", {
								className: "flex items-start gap-2",
								children: [
									/* @__PURE__ */ (0, Q.jsx)(M, {
										className: "min-w-0 flex-1",
										"aria-label": J("settings:pushDiscovery.prefixLabel", { index: t + 1 }),
										placeholder: "/115",
										autoComplete: "off",
										maxLength: 200,
										value: e.prefix,
										onChange: (e) => m(t, { prefix: e })
									}),
									/* @__PURE__ */ (0, Q.jsx)(Fe, {
										"aria-label": J("settings:pushDiscovery.prefixRootLabel", { index: t + 1 }),
										prefix: J("settings:pushDiscovery.mapsTo"),
										selectedKey: e.root,
										onSelectionChange: (e) => {
											e !== null && m(t, { root: String(e) });
										},
										children: l.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
											id: e,
											children: e
										}, e))
									}),
									/* @__PURE__ */ (0, Q.jsx)(f, {
										variant: "danger",
										iconOnly: !0,
										leadingIcon: de,
										"aria-label": J("settings:pushDiscovery.removeRow"),
										onClick: () => a((e) => e.filter((e, n) => n !== t))
									})
								]
							}, t))
						}),
						/* @__PURE__ */ (0, Q.jsx)("div", { children: /* @__PURE__ */ (0, Q.jsx)(f, {
							variant: "secondary",
							onClick: () => a((e) => [...e, {
								prefix: "",
								root: l[0] ?? ""
							}]),
							children: J("settings:pushDiscovery.addPrefix")
						}) })
					]
				})
			}),
			o || c.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: o || c.error })
			}) : null,
			/* @__PURE__ */ (0, Q.jsxs)(A, { children: [u.enabled && u.cloud && u.config_toml ? /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: g,
				disabled: !n.available,
				...W(c.busy === "secret"),
				children: J("settings:fileDiscovery.rotateSecret")
			}) : null, /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				disabled: !n.available,
				...W(c.busy === "save"),
				children: J("settings:shared.saveSettings")
			})] })
		]
	});
}
// src/react/settings/media-settings.tsx
async function ds(e) {
	let t;
	try {
		t = await pt();
	} catch {
		return !0;
	}
	if (!Ft(t)) return !0;
	let { confirmed: n } = await at({
		title: J("settings:mediaLibraries.processingRunning"),
		body: Vt(t, e),
		confirmLabel: J("settings:mediaLibraries.saveAnyway")
	});
	return n;
}
var fs = (e) => Dr.find(([t]) => t === e)?.[1] ?? e, ps = [...Dr, ["smb", J("settings:mediaLibraries.smbShare")]], ms = (e) => e.library_icon || Qo(e.transport === "smb" ? "smb" : e.location)[0], hs = async (e) => Mt(e, (e) => U(ge, e)), gs = (e) => ({
	library_id: e.library_id,
	library: e.library,
	library_icon: e.library_icon,
	library_color: e.library_color,
	library_policy: e.library_policy,
	library_stages: e.library_stages
}), _s = (e) => e.library_stages ? ns.filter((t) => e.library_stages.split(",").includes(t)) : [], vs = (e = "") => ({
	path: e,
	transport: e.startsWith("smb://") ? "smb" : "filesystem",
	location: "local",
	root: "",
	library_id: Lt(),
	library: "",
	library_icon: "",
	library_color: "",
	library_policy: "auto",
	library_stages: "",
	cost: "free"
});
function ys(e) {
	let t = e.media_sources?.filter((e) => Dr.some(([t]) => t === e.location));
	return t?.length ? t.map((e) => ({
		transport: e.transport === "smb" || e.path.startsWith("smb://") ? "smb" : "filesystem",
		smb_username: e.smb_username,
		smb_password: "",
		smb_encrypt: e.smb_encrypt,
		smb_password_saved: e.smb_password_saved,
		path: e.path,
		location: e.location,
		root: e.root,
		library: e.library || "",
		library_icon: e.library_icon || "",
		library_color: e.library_color || "",
		library_policy: e.library_policy || "auto",
		library_stages: e.library_stages || "",
		root_id: e.root_id,
		library_id: e.library_id || Lt(),
		cost: e.cost ?? Zt(e.location)
	})) : (e.media_dirs.length ? e.media_dirs : [""]).map((e) => vs(e));
}
var bs = (e) => !(e instanceof d) || e.status !== 400 ? null : Qe(e.body) ?? null;
function xs({ data: e, receipt: t, panel: n }) {
	let r = !!e.media_sources?.some((e) => jr(e.location));
	return (0, Z.useEffect)(() => {
		if (e.editable) {
			let t = /* @__PURE__ */ new Map();
			for (let n of ys(e)) t.set(n.library_id, (t.get(n.library_id) ?? 0) + 1);
			Rt("media", {
				folders: [...t.values()],
				cloud: r
			});
		}
		let t = e.push_discovery;
		t && Rt("discovery", {
			enabled: t.enabled,
			watchLocal: t.watch_local,
			cloud: t.cloud,
			webhook: t.enabled && t.cloud && !!t.config_toml,
			prefixes: t.prefixes.length
		});
	}, [e, r]), /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(n),
		children: [
			e.editable ? /* @__PURE__ */ (0, Q.jsx)(Ss, {
				data: e,
				receipt: t
			}) : /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "neutral",
				title: J("settings:mediaLibraries.readOnly"),
				children: e.notice
			}),
			e.editable ? null : /* @__PURE__ */ (0, Q.jsx)(ws, { data: e }),
			r ? /* @__PURE__ */ (0, Q.jsx)(Jo, { receipt: t }) : null,
			e.push_discovery ? /* @__PURE__ */ (0, Q.jsx)(us, {
				initial: e.push_discovery,
				receipt: t
			}) : null
		]
	});
}
function Ss({ data: e, receipt: t }) {
	let { rows: n, edit: r, add: i, remove: a, errors: o, setErrors: s, picking: c, pick: l, inputRef: u } = Nr({
		initial: () => ys(e),
		blank: () => vs(),
		pickFolder: hs,
		describe: K
	}), [d, p] = (0, Z.useState)(!1), m = X({
		queryKey: fe,
		queryFn: ({ signal: e }) => mt(e)
	}, q).data?.metadata_only === !0, [h, g] = (0, Z.useState)(!1), [_, y] = (0, Z.useState)(""), [x, S] = (0, Z.useState)({}), [C, ee] = (0, Z.useState)(null), te = (0, Z.useRef)(e.revision), w = (0, Z.useRef)(!1), T = Y();
	tn();
	let E = (e, t) => {
		n.forEach((i, a) => {
			i.library_id === n[e].library_id && r(a, t);
		});
	}, O = rn([...n.reduce((e, t) => e.has(t.library_id) ? e : e.set(t.library_id, t), /* @__PURE__ */ new Map()).values()], (e) => e.library_id), [ne, k] = (0, Z.useState)(null);
	(0, Z.useEffect)(() => {
		if (!ne) return;
		let e = document.querySelector(`[data-library-key="${CSS.escape(ne)}"] [data-library-head] input`);
		e?.scrollIntoView({ block: "center" }), e?.focus(), k(null);
	}, [ne]);
	let re = (e, t) => {
		let i = n.find((e) => e.library_id === t);
		if (i) {
			r(e, gs(i));
			return;
		}
		let a = Lt();
		r(e, {
			library_id: a,
			library: "",
			library_icon: "",
			library_color: "",
			library_policy: "auto",
			library_stages: ""
		}), k(a);
	};
	(0, Z.useEffect)(() => {
		if (!C) return;
		let e = setTimeout(() => location.assign(C.url), Ho);
		return () => clearTimeout(e);
	}, [C]);
	let ie = (e) => {
		e.preventDefault();
		let t = n.findIndex((e) => !e.cost);
		if (t >= 0) {
			g(!0);
			let n = e.currentTarget;
			requestAnimationFrame(() => n.querySelector(`[data-media-read-policy="${t}"] button`)?.focus());
		} else T.busy || w.current || (y(""), w.current = !0, ds(d).then((e) => {
			w.current = !1, e && ae();
		}));
	}, ae = () => {
		T.run("save", (t) => U(v, {
			revision: te.current,
			media_dirs: n.map((e) => e.path),
			...e.media_sources ? { media_sources: n } : {},
			port: String(e.port),
			scan_now: d
		}, "POST", t), (e) => {
			te.current = e.revision, s([]), t(J("settings:shared.settingsSaved")), ee(e);
		}, (e) => {
			let t = bs(e);
			s(t?.media_dirs ?? []), (!t || t.port) && y(t?.port || K(e));
		});
	};
	if (C) return /* @__PURE__ */ (0, Q.jsx)(F, {
		guide: "media",
		title: J("settings:libraryFolders.title"),
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsxs)(N, {
			tone: "success",
			title: J("settings:shared.configSaved"),
			children: [
				J("settings:mediaLibraries.restartingRedirect"),
				/* @__PURE__ */ (0, Q.jsx)(ue, {
					href: C.url,
					size: "small",
					children: J("settings:mediaLibraries.goToCollection")
				}),
				J("shell:format.period")
			]
		}) })
	});
	let oe = (t) => e.media_sources?.find((e) => e.root_id === t.root_id && e.path === t.path), ce = n.some((e) => jr(e.location)), le = ce ? (e.mount_dependencies ?? []).filter((e) => !e.available) : [];
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "media",
		title: J("settings:libraryFolders.title"),
		onSubmit: ie,
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
			/* @__PURE__ */ (0, Q.jsx)(is, {}),
			/* @__PURE__ */ (0, Q.jsx)("div", {
				role: "group",
				"aria-label": J("settings:libraryFolders.title"),
				className: "flex flex-col gap-4",
				children: O.map((e) => {
					let t = n.findIndex((t) => t.library_id === e.library_id), s = n.map((e, t) => ({
						row: e,
						index: t
					})).filter(({ row: t }) => t.library_id === e.library_id), d = e.library_policy, p = e.library || J("settings:mediaLibraries.untitled");
					return /* @__PURE__ */ (0, Q.jsxs)("div", {
						"data-library-block": "",
						"data-library-key": e.library_id,
						className: et({
							variant: "raised",
							padding: "none",
							className: "flex flex-col p-2"
						}),
						"data-library": e.library_color ? e.library_id : void 0,
						children: [
							/* @__PURE__ */ (0, Q.jsxs)("div", {
								"data-library-head": "",
								children: [
									/* @__PURE__ */ (0, Q.jsx)(es, {
										label: J("settings:mediaLibraries.iconLabel", { name: p }),
										value: e.library_icon,
										kind: e.transport === "smb" ? "smb" : e.location,
										onChange: (e) => E(t, { library_icon: e })
									}),
									/* @__PURE__ */ (0, Q.jsx)(M, {
										className: "w-full",
										"aria-label": J("settings:mediaLibraries.nameLabel", { name: p }),
										maxLength: 80,
										placeholder: J("settings:mediaLibraries.namePlaceholder"),
										value: e.library,
										onChange: (e) => E(t, { library: e })
									}),
									/* @__PURE__ */ (0, Q.jsx)(ss, {
										id: e.library_id,
										name: e.library,
										value: e.library_color,
										onChange: (e) => E(t, { library_color: e })
									}),
									/* @__PURE__ */ (0, Q.jsx)(as, {
										name: p,
										value: d,
										onChange: (n) => E(t, {
											library_policy: n,
											library_stages: n === "custom" ? e.library_stages || ns.join(",") : ""
										})
									})
								]
							}),
							d === "custom" ? /* @__PURE__ */ (0, Q.jsx)(os, {
								name: p,
								value: _s(e),
								previewsOff: m,
								onChange: (e) => E(t, { library_stages: ns.filter((t) => e.includes(t)).join(",") })
							}) : null,
							/* @__PURE__ */ (0, Q.jsxs)("div", {
								"data-library-folders": "",
								role: "group",
								"aria-label": J("settings:mediaLibraries.directoriesLabel", { name: p }),
								children: [s.map(({ row: t, index: i }) => /* @__PURE__ */ (0, Q.jsxs)(Er, {
									label: J("settings:mediaLibraries.directoryLabel", { index: i + 1 }),
									path: t.path,
									onPath: (e) => r(i, {
										path: e,
										transport: e.startsWith("smb://") ? "smb" : t.transport
									}),
									error: o[i],
									inputRef: u(i),
									picking: c === i,
									onPick: () => void l(i),
									onRemove: n.length > 1 ? () => a(i) : void 0,
									status: oe(t) ? /* @__PURE__ */ (0, Q.jsx)(Cs, { online: oe(t)?.online }) : null,
									children: [/* @__PURE__ */ (0, Q.jsxs)(Tr, { children: [
										/* @__PURE__ */ (0, Q.jsx)(Ar, {
											index: i,
											value: t.transport === "smb" ? "smb" : t.location,
											options: ps,
											onChange: (e) => {
												let n = e === "smb";
												r(i, {
													transport: n ? "smb" : "filesystem",
													location: n ? "local" : e,
													cost: n || e === "local" ? "free" : "",
													path: n ? t.path.startsWith("smb://") ? t.path : "smb://" : t.path.startsWith("smb://") ? "" : t.path
												}), S((e) => {
													let t = { ...e };
													return delete t[i], t;
												});
											}
										}),
										/* @__PURE__ */ (0, Q.jsx)(Or, {
											index: i,
											cost: t.cost,
											onChange: (e) => r(i, { cost: e }),
											error: h && !t.cost ? J("settings:mediaLibraries.readPolicyRequired") : void 0
										}),
										t.root_id && !oe(t) ? /* @__PURE__ */ (0, Q.jsx)(wr, {
											label: J("settings:mediaLibraries.changeType"),
											className: "w-full @lg:w-auto @lg:flex-1",
											children: /* @__PURE__ */ (0, Q.jsxs)(I, {
												className: "w-full",
												"aria-label": J("settings:mediaLibraries.changeTypeLabel", { index: i + 1 }),
												placeholder: J("settings:mediaLibraries.changeTypePlaceholder"),
												selectedKey: t.change_mode || null,
												onSelectionChange: (e) => {
													e === "add" ? r(i, {
														root_id: void 0,
														root: "",
														change_mode: ""
													}) : r(i, { change_mode: "relocate" });
												},
												children: [/* @__PURE__ */ (0, Q.jsx)(L, {
													id: "relocate",
													children: J("settings:mediaLibraries.relocate")
												}), /* @__PURE__ */ (0, Q.jsx)(L, {
													id: "add",
													children: J("settings:mediaLibraries.addAnother")
												})]
											})
										}) : null,
										O.length > 1 ? /* @__PURE__ */ (0, Q.jsx)(wr, {
											label: J("settings:mediaLibraries.moveTo"),
											className: "w-full @lg:w-48",
											children: /* @__PURE__ */ (0, Q.jsxs)(I, {
												className: "w-full",
												"aria-label": J("settings:mediaLibraries.moveToLabel", { index: i + 1 }),
												selectedKey: t.library_id,
												renderValue: /* @__PURE__ */ (0, Q.jsxs)("span", {
													className: "flex min-w-0 items-center gap-2",
													children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: ms(e) }), /* @__PURE__ */ (0, Q.jsx)("span", {
														className: "truncate",
														children: p
													})]
												}),
												onSelectionChange: (e) => {
													e && re(i, String(e));
												},
												children: [O.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
													id: e.library_id,
													textValue: e.library || J("settings:mediaLibraries.untitled"),
													children: /* @__PURE__ */ (0, Q.jsxs)("span", {
														className: "flex min-w-0 items-center gap-2",
														children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: ms(e) }), /* @__PURE__ */ (0, Q.jsx)("span", {
															className: "truncate",
															children: e.library || J("settings:mediaLibraries.untitled")
														})]
													})
												}, e.library_id)), s.length > 1 ? /* @__PURE__ */ (0, Q.jsx)(L, {
													id: "new",
													textValue: J("settings:mediaLibraries.newLibrary"),
													children: /* @__PURE__ */ (0, Q.jsxs)("span", {
														className: "flex min-w-0 items-center gap-2",
														children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: "plus" }), /* @__PURE__ */ (0, Q.jsx)("span", { children: J("settings:mediaLibraries.newLibrary") })]
													})
												}) : null]
											})
										}) : null
									] }), t.transport === "smb" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
										className: "flex w-full flex-col gap-2",
										children: [
											/* @__PURE__ */ (0, Q.jsxs)(Tr, { children: [/* @__PURE__ */ (0, Q.jsx)(wr, {
												label: J("settings:smbShare.account"),
												className: "w-full @lg:flex-1",
												children: /* @__PURE__ */ (0, Q.jsx)(M, {
													"aria-label": J("settings:smbShare.accountLabel", { index: i + 1 }),
													value: t.smb_username || "",
													autoComplete: "off",
													isDisabled: t.smb_clear,
													onChange: (e) => r(i, { smb_username: e })
												})
											}), /* @__PURE__ */ (0, Q.jsx)(wr, {
												label: J("settings:smbShare.password"),
												className: "w-full @lg:flex-1",
												children: /* @__PURE__ */ (0, Q.jsx)(M, {
													"aria-label": J("settings:smbShare.passwordLabel", { index: i + 1 }),
													type: "password",
													value: t.smb_password || "",
													autoComplete: "new-password",
													placeholder: t.smb_password_saved ? J("settings:smbShare.keepPassword") : "",
													isDisabled: t.smb_clear,
													onChange: (e) => r(i, { smb_password: e })
												})
											})] }),
											/* @__PURE__ */ (0, Q.jsx)(b, {
												isSelected: t.smb_encrypt || !1,
												isDisabled: t.smb_clear,
												onChange: (e) => r(i, { smb_encrypt: e }),
												children: J("settings:smbShare.requireEncryption")
											}),
											/* @__PURE__ */ (0, Q.jsx)(b, {
												isSelected: t.smb_clear || !1,
												onChange: (e) => r(i, { smb_clear: e }),
												children: J("settings:smbShare.removeAccount")
											}),
											/* @__PURE__ */ (0, Q.jsx)(f, {
												className: "self-start",
												variant: "secondary",
												...W(T.busy === `smb-${i}`),
												onClick: () => void T.run(`smb-${i}`, (e) => U("/api/configuration/smb/test", t, "POST", e), (e) => S((t) => ({
													...t,
													[i]: {
														message: J("settings:smbShare.readable"),
														directories: e.directories
													}
												})), (e) => S((t) => ({
													...t,
													[i]: {
														message: K(e),
														directories: []
													}
												}))),
												children: J("settings:smbShare.testConnection")
											}),
											x[i] ? /* @__PURE__ */ (0, Q.jsx)(j, { children: x[i].message }) : null,
											x[i]?.directories.length ? /* @__PURE__ */ (0, Q.jsx)(I, {
												"aria-label": J("settings:smbShare.subdirectoryLabel", { index: i + 1 }),
												placeholder: J("settings:smbShare.openSubdirectory"),
												selectedKey: null,
												onSelectionChange: (e) => {
													e && (r(i, { path: t.path.replace(/\/$/, "") + "/" + encodeURIComponent(String(e)) }), S((e) => ({
														...e,
														[i]: {
															message: J("settings:smbShare.testSubdirectory"),
															directories: []
														}
													})));
												},
												children: x[i].directories.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
													id: e,
													children: e
												}, e))
											}) : null,
											/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:smbShare.help") })
										]
									}) : null]
								}, i)), /* @__PURE__ */ (0, Q.jsx)("div", {
									className: "flex",
									children: /* @__PURE__ */ (0, Q.jsx)(f, {
										variant: "secondary",
										"aria-label": J("settings:mediaLibraries.addDirectoryLabel", { name: p }),
										onClick: () => {
											i(), r(n.length, {
												...gs(e),
												location: e.location,
												cost: e.cost
											});
										},
										children: J("settings:mediaLibraries.addDirectory")
									})
								})]
							})
						]
					}, e.library_id);
				})
			}),
			/* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				className: "self-start",
				onClick: i,
				children: J("settings:mediaLibraries.addLibrary")
			}),
			/* @__PURE__ */ (0, Q.jsx)(j, { children: se }),
			ce ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(kr, {}), /* @__PURE__ */ (0, Q.jsx)(Go, {})] }) : null,
			le.map((e) => /* @__PURE__ */ (0, Q.jsxs)(j, { children: [
				J("settings:mediaLibraries.dependencyMissingName", { name: e.name }),
				J("shell:format.sentenceGap"),
				/* @__PURE__ */ (0, Q.jsxs)(D, {
					href: e.download_url,
					children: [
						J("settings:shared.download"),
						" ",
						e.name
					]
				})
			] }, e.name)),
			/* @__PURE__ */ (0, Q.jsx)(b, {
				isSelected: d,
				onChange: p,
				children: J("settings:mediaLibraries.scanAfterSave")
			}),
			_ ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("settings:shared.notSaved"),
				children: _
			}) : null
		] }), /* @__PURE__ */ (0, Q.jsx)(A, {
			status: J("settings:libraryFolders.restartNotice"),
			children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				...W(T.busy === "save"),
				children: J("settings:shared.saveSettings")
			})
		})]
	});
}
function Cs({ online: e }) {
	return /* @__PURE__ */ (0, Q.jsx)(pn, { online: e });
}
function ws({ data: e }) {
	let t = e.media_sources, n = Y();
	return t ? /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "mounts",
		title: J("settings:mountStatus.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsx)(re, { children: t.map((e, t) => /* @__PURE__ */ (0, Q.jsxs)(k, {
				term: /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(Be, { mark: Mr(e.location) }), fs(e.location)] }),
				children: [e.path || J("settings:mountStatus.notConfigured"), /* @__PURE__ */ (0, Q.jsx)(Cs, { online: e.online })]
			}, t)) }),
			n.error ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: n.error })
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => void n.run("refresh", (e) => dt(e), (e) => q.setQueryData(g, e)),
				...W(n.busy === "refresh"),
				children: J("settings:mountStatus.refresh")
			}) })
		]
	}) : null;
}
// src/react/settings/service-preferences.tsx
var Ts = [
	["off", J("settings:timelineThumbnails.off")],
	["precise", J("settings:timelineThumbnails.precise")],
	["coarse", J("settings:timelineThumbnails.coarse")]
], Es = [
	{
		key: "sourceBudgetRequests",
		fallback: 6e3,
		choices: [
			1500,
			3e3,
			6e3,
			12e3,
			24e3,
			48e3
		],
		label: () => J("settings:sourceBudget.requests"),
		help: () => J("settings:sourceBudget.requestsHelp"),
		option: (e) => J("settings:sourceBudget.requestCount", { count: e })
	},
	{
		key: "sourceBudgetHours",
		fallback: 4,
		choices: [
			1,
			2,
			4,
			8,
			12,
			24
		],
		label: () => J("settings:sourceBudget.hours"),
		help: () => void 0,
		option: (e) => J("settings:sourceBudget.hourCount", { count: e })
	},
	{
		key: "sourceBudgetGigabytes",
		fallback: 1,
		choices: [
			1,
			2,
			4,
			8,
			16
		],
		label: () => J("settings:sourceBudget.gigabytes"),
		help: () => void 0,
		option: (e) => J("settings:sourceBudget.gigabyteCount", { count: e })
	}
];
function Ds({ receipt: e }) {
	let t = X({
		queryKey: je,
		queryFn: ({ signal: e }) => ht(e)
	}), n = ln(), r = n.error || t.error, i = !t.data || n.isPending;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:taskSpeed.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(P, { children: [/* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:taskSpeed.defaultSpeed"),
			description: J("settings:taskSpeed.defaultSpeedHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)(Se, {
				value: t.data?.taskSpeedMode || "standard",
				busy: i,
				onChange: (t) => n.mutate({ taskSpeedMode: t }, { onSuccess: () => e(J("settings:taskSpeed.saved")) })
			})
		}), Es.map((r) => /* @__PURE__ */ (0, Q.jsx)(R, {
			label: r.label(),
			description: r.help(),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: `${r.key}Setting`,
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": r.label(),
					selectedKey: String(t.data?.[r.key] ?? r.fallback),
					isDisabled: i,
					onSelectionChange: (t) => {
						t !== null && n.mutate({ [r.key]: Number(t) }, { onSuccess: () => e(J("settings:sourceBudget.saved")) });
					},
					children: r.choices.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: String(e),
						children: r.option(e)
					}, e))
				})
			})
		}, r.key))] }), r ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(r) })
		}) : null]
	});
}
function Os({ epoch: e = 0, disabled: t = !1 }) {
	let n = X({
		queryKey: Ve,
		queryFn: ({ signal: e }) => _t(e),
		refetchOnMount: "always"
	}), r = un(), i = r.reset;
	(0, Z.useEffect)(() => {
		i();
	}, [e, i]);
	let a = n.data, o = r.error || n.error;
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:videoPreviews.timeline"),
			description: J("settings:videoPreviews.timelineHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "videoThumbnailSetting",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:timelineThumbnails.interval"),
					selectedKey: a?.mode || "off",
					isDisabled: t || !a || n.isFetching || r.isPending,
					onSelectionChange: (e) => {
						e !== null && r.mutate(String(e));
					},
					children: Ts.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: e,
						children: t
					}, e))
				})
			})
		}) }),
		r.isPending || a?.status === "running" ? /* @__PURE__ */ (0, Q.jsxs)(z, {
			divided: !0,
			children: [r.isPending ? /* @__PURE__ */ (0, Q.jsx)(Ue, {
				embedded: !0,
				kind: "gather",
				label: J("settings:shared.saving")
			}) : /* @__PURE__ */ (0, Q.jsx)(Ue, {
				embedded: !0,
				kind: Ye("timeline-thumbnails"),
				label: J("settings:timelineThumbnails.generating")
			}), r.isPending ? null : /* @__PURE__ */ (0, Q.jsx)(He, {})]
		}) : null,
		o ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(o) })
		}) : null
	] });
}
function ks({ receipt: e }) {
	let t = Ze();
	(0, Z.useSyncExternalStore)(t.subscribe, t.version);
	let n = X({
		queryKey: je,
		queryFn: ({ signal: e }) => ht(e),
		refetchOnMount: "always"
	}), r = ln(), i = n.data?.followInitialDays ?? t.value.followInitialDays, a = r.error || n.error;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "follow-options",
		title: J("settings:followFetch.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(P, { children: [
			/* @__PURE__ */ (0, Q.jsx)(js, { kind: "follow" }),
			/* @__PURE__ */ (0, Q.jsx)(js, { kind: "feed" }),
			/* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:followFetch.initialRange"),
				description: J("settings:followFetch.initialRangeHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("div", {
					id: "followInitialDaysSetting",
					className: "shrink-0",
					children: /* @__PURE__ */ (0, Q.jsx)(I, {
						"aria-label": J("settings:followFetch.initialRange"),
						selectedKey: String(i),
						isDisabled: n.isFetching || r.isPending,
						onSelectionChange: (n) => {
							n !== null && r.mutate({ followInitialDays: Number(n) }, { onSuccess: (n) => {
								typeof n.followInitialDays == "number" && (t.value.followInitialDays = n.followInitialDays), t.save(), e(J("settings:followSchedule.initialRangeSaved"));
							} });
						},
						children: ne.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(L, {
							id: e,
							children: t
						}, e))
					})
				})
			}),
			/* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:followFetch.avatarRefresh"),
				description: J("settings:followFetch.avatarRefreshHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "shrink-0",
					children: J("settings:followSchedule.avatarRefresh")
				})
			}),
			/* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:followFetch.faviconRefresh"),
				description: J("settings:followFetch.faviconRefreshHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("span", {
					className: "shrink-0",
					children: J("settings:followSchedule.faviconRefresh")
				})
			})
		] }), a ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(a) })
		}) : null]
	});
}
var As = {
	follow: {
		id: "followScheduleSetting",
		label: () => J("settings:followFetch.autoCheck"),
		help: () => J("settings:followSchedule.autoCheckHelp"),
		input: () => J("settings:followSchedule.autoCheckInterval"),
		name: "follow-interval",
		running: () => J("settings:followSchedule.checking"),
		activity: "follow-check",
		failure: () => J("settings:followSchedule.lastCheckFailed")
	},
	feed: {
		id: "feedScheduleSetting",
		label: () => J("settings:followFetch.feedSchedule"),
		help: () => J("settings:followSchedule.feedScheduleHelp"),
		input: () => J("settings:followSchedule.feedScheduleInterval"),
		name: "feed-interval",
		running: () => J("settings:followSchedule.fetchingFeeds"),
		activity: "feed-check",
		failure: () => J("settings:followSchedule.lastFetchFailed")
	}
};
function js({ kind: e }) {
	let t = As[e], { key: n, fetch: r, fallback: i } = Ee[e], a = X({
		queryKey: n,
		queryFn: ({ signal: e }) => r(e),
		refetchOnMount: "always",
		refetchInterval: Ut
	}), o = cn(e), s = a.data, c = `peach.number.${t.id}`, l = (0, Z.useRef)($e(Number(localStorage.getItem(c)), 15, 10080, i)), [u, d] = (0, Z.useState)(String(i)), [f, p] = (0, Z.useState)(!1);
	(0, Z.useEffect)(() => {
		s?.enabled && (l.current = s.interval_minutes, d(String(s.interval_minutes)));
	}, [s]);
	let m = !s?.available || a.isFetching || o.isPending, h = () => {
		let e = Number(u);
		!Number.isInteger(e) || e < 15 || e > 10080 ? p(!0) : (p(!1), s?.enabled && !m && e !== s.interval_minutes && (l.current = e, localStorage.setItem(c, String(e)), o.mutate(e)));
	}, g = o.error || a.error, _ = s && !s.available ? J("settings:followSchedule.primaryOnly") : t.help();
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsx)(R, {
			label: t.label(),
			description: _,
			children: /* @__PURE__ */ (0, Q.jsxs)("div", {
				id: t.id,
				className: "flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-2",
				children: [/* @__PURE__ */ (0, Q.jsx)(V, {
					"aria-label": t.label(),
					isSelected: s?.enabled === !0,
					isDisabled: m,
					onChange: (e) => {
						localStorage.setItem(c, String(l.current)), o.mutate(e ? l.current : 0);
					}
				}), s?.enabled ? /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, Q.jsx)(M, {
						type: "number",
						inputMode: "numeric",
						name: t.name,
						autoComplete: "off",
						"aria-label": t.input(),
						className: "w-21 sm:w-24",
						value: u,
						onChange: (e) => {
							d(e), p(!1);
						},
						onBlur: h,
						onKeyDown: (e) => {
							e.key === "Enter" && (e.preventDefault(), h());
						},
						isDisabled: m,
						isInvalid: f
					}), /* @__PURE__ */ (0, Q.jsx)("span", {
						className: "text-body-2-regular text-text-secondary",
						children: J("settings:numberSetting.unitMinutes")
					})]
				}) : null]
			})
		}),
		f ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: J("settings:followSchedule.invalidInterval") }) }) : null,
		o.isPending || s?.running ? /* @__PURE__ */ (0, Q.jsx)(z, { children: o.isPending ? /* @__PURE__ */ (0, Q.jsx)(Ue, {
			embedded: !0,
			kind: "gather",
			label: J("settings:shared.saving")
		}) : /* @__PURE__ */ (0, Q.jsx)(Ue, {
			embedded: !0,
			kind: Ye(t.activity),
			label: t.running()
		}) }) : null,
		/* @__PURE__ */ (0, Q.jsx)(Ms, {
			kind: e,
			status: s,
			title: t.failure()
		}),
		g ? /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(g) }) }) : null
	] });
}
function Ms({ kind: e, status: t, title: n }) {
	let r = sn(e);
	if (!t?.enabled || t.running || !t.last_error) return null;
	let i = t.consecutive_failures ?? 0, a = Ot(t.next_run_at), o = [i > 1 ? J("settings:followSchedule.consecutiveFailures", { count: i }) : "", a ? J("settings:followSchedule.nextRun", { time: a }) : ""].filter(Boolean).join(J("shell:format.clauseSeparator")), s = [
		t.last_error,
		o,
		r.error ? J("settings:followSchedule.retryFailed", { error: K(r.error) }) : ""
	].filter(Boolean).join("\n");
	return /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(N, {
		tone: "error",
		title: n,
		action: /* @__PURE__ */ (0, Q.jsx)(f, {
			variant: "secondary",
			size: "small",
			disabled: !t.available,
			...W(r.isPending),
			onClick: () => r.mutate(),
			children: J("settings:shared.retryNow")
		}),
		children: s
	}) });
}
// src/react/settings/media-processing-settings.tsx
function Ns({ receipt: e }) {
	let t = X({
		queryKey: fe,
		queryFn: ({ signal: e }) => mt(e)
	}), n = Y(), r = n.error || (t.error ? K(t.error) : ""), i = !t.data || t.isFetching || !!n.busy;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "preview",
		title: J("settings:videoPreviews.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:videoPreviews.generate"),
				description: J("settings:videoPreviews.generateHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)(V, {
					"aria-label": J("settings:videoPreviews.generate"),
					isSelected: !!t.data && !t.data.metadata_only,
					isDisabled: i,
					onChange: (t) => void n.run("save", (e) => U(pe, { metadata_only: !t }, "POST", e), (t) => {
						q.setQueryData(fe, t), q.invalidateQueries({ queryKey: Ve }), q.invalidateQueries({ queryKey: ce }), e(t.metadata_only ? J("settings:videoPreview.turnedOff") : J("settings:videoPreview.turnedOn"));
					})
				})
			}) }),
			/* @__PURE__ */ (0, Q.jsx)(Os, { disabled: !t.data || t.data.metadata_only || !!n.busy }),
			/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:videoPreviews.decoder"),
				description: J("settings:videoPreviews.decoderHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("div", {
					id: "previewAccelerationSetting",
					children: /* @__PURE__ */ (0, Q.jsxs)(I, {
						"aria-label": J("settings:videoPreviews.decoder"),
						selectedKey: t.data?.preview_acceleration || "auto",
						isDisabled: i || !!t.data?.metadata_only,
						onSelectionChange: (t) => {
							t !== null && n.run("preview_acceleration", (e) => U(pe, { preview_acceleration: String(t) }, "POST", e), (t) => {
								q.setQueryData(fe, t), e(J("settings:videoPreview.decodingSaved"));
							});
						},
						children: [/* @__PURE__ */ (0, Q.jsx)(L, {
							id: "auto",
							children: J("settings:videoProcessing.autoHardwareFirst")
						}), /* @__PURE__ */ (0, Q.jsx)(L, {
							id: "software",
							children: J("settings:videoPreview.softwareDecoding")
						})]
					})
				})
			}) }),
			n.busy ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(Ue, {
					embedded: !0,
					kind: "gather",
					label: J("settings:shared.saving")
				})
			}) : null,
			r ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: r })
			}) : null
		]
	});
}
var Ps = [
	0,
	1080,
	720,
	480
];
function Fs({ receipt: e }) {
	let t = X({
		queryKey: fe,
		queryFn: ({ signal: e }) => mt(e)
	}), n = Y(), r = n.error || (t.error ? K(t.error) : ""), i = !t.data || t.isFetching || !!n.busy;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "transcode",
		title: J("settings:transcoding.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(P, { children: [/* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:transcoding.mode"),
				description: J("settings:transcoding.modeHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("div", {
					id: "playbackAccelerationSetting",
					children: /* @__PURE__ */ (0, Q.jsxs)(I, {
						"aria-label": J("settings:transcoding.mode"),
						selectedKey: t.data?.playback_acceleration || "auto",
						isDisabled: i,
						onSelectionChange: (t) => {
							t !== null && n.run("playback_acceleration", (e) => U(pe, { playback_acceleration: String(t) }, "POST", e), (t) => {
								q.setQueryData(fe, t), e(J("settings:playbackTranscode.saved"));
							});
						},
						children: [/* @__PURE__ */ (0, Q.jsx)(L, {
							id: "auto",
							children: J("settings:videoProcessing.autoHardwareFirst")
						}), /* @__PURE__ */ (0, Q.jsx)(L, {
							id: "software",
							children: J("settings:playbackTranscode.software")
						})]
					})
				})
			}), /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:transcoding.quality"),
				description: J("settings:transcoding.qualityHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)("div", {
					id: "playbackQualitySetting",
					children: /* @__PURE__ */ (0, Q.jsx)(I, {
						"aria-label": J("settings:transcoding.quality"),
						selectedKey: String(t.data?.playback_max_height ?? 0),
						isDisabled: i,
						onSelectionChange: (t) => {
							t !== null && n.run("playback_max_height", (e) => U(pe, { playback_max_height: Number(t) }, "POST", e), (t) => {
								q.setQueryData(fe, t), e(J("settings:playbackTranscode.qualitySaved"));
							});
						},
						children: Ps.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
							id: String(e),
							children: e ? J("settings:transcoding.qualityHeight", { height: e }) : J("settings:transcoding.original")
						}, e))
					})
				})
			})] }),
			n.busy ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(Ue, {
					embedded: !0,
					kind: "gather",
					label: J("settings:shared.saving")
				})
			}) : null,
			r ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(T, { children: r })
			}) : null
		]
	});
}
// src/react/boardui/components/base/textarea/textarea.tsx
var Is = Xt({
	field: "relative flex w-full flex-col rounded-2lg bg-background-tertiary-default text-foreground-icon-tertiary ring-2 ring-inset ring-transparent transition-[background-color,box-shadow,color] duration-[var(--input-transition-ms)] ease",
	fieldSize: {
		medium: "p-2",
		small: "px-1.5 py-2"
	},
	textarea: "block w-full min-w-0 bg-transparent border-0 outline-none m-0 p-0 px-1 font-sans text-body-regular text-text-primary placeholder:text-text-tertiary focus:placeholder:text-text-primary disabled:text-input-disabled-text disabled:placeholder:text-input-disabled-text disabled:cursor-not-allowed aria-invalid:placeholder:text-text-error-placeholder",
	resize: {
		none: "resize-none",
		vertical: "resize-y"
	},
	footer: "flex w-full items-start justify-between gap-3",
	count: "ms-auto shrink-0 pt-px text-caption-1-medium text-text-tertiary tabular-nums"
}), Ls = 20;
function Rs({ size: e, rows: n = 3, autoResize: r = !1, maxRows: a, resize: o = "vertical", fieldClassName: s, className: c, ref: l, groupRef: u, onInput: d, ...f }) {
	let p = (0, Z.useContext)(Ge), m = e ?? p.size ?? "medium", h = (0, Z.useRef)(null), g = (e) => {
		h.current = e, typeof l == "function" ? l(e) : l && (l.current = e);
	}, _ = () => {
		let e = h.current;
		if (!e) return;
		if (!r) {
			e.style.height = "", e.style.maxHeight = "", e.style.overflowY = "";
			return;
		}
		let t = parseFloat(window.getComputedStyle(e).lineHeight) || Ls, i = a ? a * t : Infinity;
		e.style.height = "0px";
		let o = Math.max(e.scrollHeight, n * t);
		e.style.height = `${Math.min(o, i)}px`, e.style.maxHeight = a ? `${i}px` : "", e.style.overflowY = o > i ? "auto" : "hidden";
	};
	return (0, Z.useLayoutEffect)(_), /* @__PURE__ */ (0, Q.jsx)(t, {
		ref: u,
		className: ({ isFocusWithin: e, isHovered: t, isDisabled: n, isInvalid: r }) => ct(Is.field, Is.fieldSize[m], t && !e && !n && !r && "ring-border-button-hover", e && !n && !r && "ring-border-button-active", n && "bg-input-disabled-background text-input-disabled-foreground", r && "bg-background-tertiary-error text-foreground-icon-error", p.fieldClassName, s),
		children: /* @__PURE__ */ (0, Q.jsx)(i, {
			ref: g,
			rows: n,
			...f,
			onInput: (e) => {
				_(), d?.(e);
			},
			className: ct(Is.textarea, Is.resize[r ? "none" : o], p.inputClassName, c)
		})
	});
}
Rs.displayName = "TextareaBase";
function zs({ label: e, hint: t, tooltip: n, placeholder: r, rows: i, autoResize: a, maxRows: o, resize: s, maxLength: c, showCount: l = !1, fieldClassName: u, ref: d, groupRef: f, className: p, value: m, defaultValue: h, onChange: g, ..._ }) {
	let [v, y] = (0, Z.useState)(() => (h ?? "").length), b = m === void 0 ? v : m.length;
	return /* @__PURE__ */ (0, Q.jsx)(We, {
		..._,
		value: m,
		defaultValue: h,
		onChange: (e) => {
			l && m === void 0 && y(e.length), g?.(e);
		},
		className: p,
		"aria-label": _["aria-label"] ?? (!e && typeof r == "string" ? r : void 0),
		children: ({ isRequired: p, isInvalid: m }) => /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
			e && /* @__PURE__ */ (0, Q.jsx)(le, {
				isRequired: p,
				isInvalid: m,
				tooltip: n,
				children: e
			}),
			/* @__PURE__ */ (0, Q.jsx)(Rs, {
				ref: d,
				groupRef: f,
				placeholder: r,
				rows: i,
				autoResize: a,
				maxRows: o,
				resize: s,
				maxLength: c,
				fieldClassName: u
			}),
			(t || l) && /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: Is.footer,
				children: [t && /* @__PURE__ */ (0, Q.jsx)(ae, {
					isInvalid: m,
					children: t
				}), l && /* @__PURE__ */ (0, Q.jsx)("span", {
					className: ct(Is.count, m && "text-text-error-primary"),
					children: c ? `${b}/${c}` : b
				})]
			})
		] })
	});
}
zs.displayName = "Textarea";
// src/react/settings/code-pattern-settings.tsx
var Bs = "^\\+{3}\\s*(?<code>FC2-PPV-\\d+)\n\\[(?<code>[A-Z]+-\\d+)\\]";
function Vs({ receipt: e }) {
	let t = X({
		queryKey: je,
		queryFn: ({ signal: e }) => ht(e)
	}), [n, r] = (0, Z.useState)(null), i = Y(), a = n ?? (t.data?.codePatterns ?? []).join("\n"), o = i.error || (t.error ? K(t.error) : "");
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "codes",
		title: J("settings:codePatterns.title"),
		onSubmit: (t) => {
			t.preventDefault();
			let n = a.split("\n").map((e) => e.trim()).filter(Boolean);
			i.run("save", (e) => U(Me, { codePatterns: n }, "POST", e), (t) => {
				q.setQueryData(je, t), r(null), e(J("settings:shared.settingsSaved"));
			});
		},
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:codePatterns.help") }), /* @__PURE__ */ (0, Q.jsx)(zs, {
			id: "codePatternSetting",
			"aria-label": J("settings:codePatterns.title"),
			rows: 3,
			autoResize: !0,
			maxRows: 12,
			spellCheck: "false",
			autoComplete: "off",
			placeholder: Bs,
			value: a,
			isDisabled: !t.data,
			isInvalid: !!o,
			hint: o || void 0,
			onChange: r
		})] }), /* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
			type: "submit",
			...W(i.busy === "save"),
			children: J("settings:shared.saveSettings")
		}) })]
	});
}
// src/react/settings/password-pair.tsx
function Hs({ label: e, password: t, confirmation: n, onPassword: r, onConfirmation: i, disabled: a = !1, passwordError: o, passwordHint: s, confirmationError: c, confirmationInvalid: l = !1 }) {
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(M, {
		id: "access-password",
		type: "password",
		label: e,
		autoComplete: "new-password",
		maxLength: 256,
		value: t,
		onChange: r,
		isDisabled: a,
		isRequired: !a,
		validationBehavior: "aria",
		isInvalid: !a && !!o,
		hint: a ? s : o || s
	}), /* @__PURE__ */ (0, Q.jsx)(M, {
		id: "access-confirm",
		type: "password",
		label: J("settings:accessPassword.confirm"),
		autoComplete: "new-password",
		maxLength: 256,
		value: n,
		onChange: i,
		isDisabled: a,
		isRequired: !a,
		validationBehavior: "aria",
		isInvalid: !a && (!!c || l),
		hint: a ? void 0 : c
	})] });
}
// src/react/settings/access-settings.tsx
var Us = {
	legacy: J("settings:accessPassword.legacyHelp"),
	locked: J("settings:accessPassword.lockedHelp"),
	password: J("settings:accessPassword.passwordHelp")
};
function Ws({ initial: e, receipt: t, devices: n, after: r, onSaved: i }) {
	let [a, o] = (0, Z.useState)(e), [s, c] = (0, Z.useState)(""), [l, u] = (0, Z.useState)(""), [p, m] = (0, Z.useState)(""), [h, g] = (0, Z.useState)(!1), [_, v] = (0, Z.useState)({}), y = (0, Z.useRef)(null), x = Y(), S = (e) => {
		e.preventDefault();
		let n = {};
		a.mode === "password" && !s && (n.current_password = J("settings:accessPassword.enterCurrent")), h || ((l.length < 8 || l.length > 256) && (n.password = J("settings:accessPassword.lengthError")), l !== p && (n.confirmation = J("settings:accessPassword.mismatch"))), v(n), Object.keys(n).length ? requestAnimationFrame(() => y.current?.querySelector("input[aria-invalid=\"true\"]")?.focus()) : x.run("save", (e) => U("/api/configuration/access", {
			revision: a.revision,
			action: h ? "disable" : "set",
			confirm_disable: h,
			current_password: s,
			password: h ? "" : l,
			confirmation: h ? "" : p
		}, "POST", e), (e) => {
			o(e), c(""), u(""), m(""), g(!1), v({}), i?.(e), t(e.mode === "open" ? J("settings:accessPassword.turnedOff") : J("settings:shared.settingsSaved"));
		}, (e) => {
			let t = e instanceof d ? e.body : null, n = Qe(t) || Qe(t?.detail);
			n ? v(n) : x.setError(K(e));
		});
	}, C = Us[a.mode], ee = a.mode !== "locked";
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		/* @__PURE__ */ (0, Q.jsxs)(F, {
			guide: "access",
			title: J("settings:accessPassword.title"),
			onSubmit: S,
			children: [/* @__PURE__ */ (0, Q.jsx)("div", {
				ref: y,
				children: /* @__PURE__ */ (0, Q.jsxs)(z, { children: [
					C ? /* @__PURE__ */ (0, Q.jsx)(j, { children: C }) : null,
					a.mode === "open" ? /* @__PURE__ */ (0, Q.jsx)(N, {
						tone: "warning",
						title: J("settings:accessPassword.notSet"),
						children: J("settings:accessPassword.openWarning")
					}) : null,
					a.mode === "password" || a.mode === "legacy" ? /* @__PURE__ */ (0, Q.jsx)(b, {
						isSelected: h,
						onChange: g,
						children: J("settings:accessPassword.turnOff")
					}) : null,
					a.mode === "password" ? /* @__PURE__ */ (0, Q.jsx)(M, {
						id: "access-current",
						type: "password",
						label: J("settings:accessPassword.current"),
						autoComplete: "current-password",
						maxLength: 256,
						value: s,
						onChange: c,
						isRequired: !0,
						validationBehavior: "aria",
						isInvalid: !!_.current_password,
						hint: _.current_password
					}) : null,
					ee && !h ? /* @__PURE__ */ (0, Q.jsx)(Hs, {
						label: a.mode === "password" ? J("settings:accessPassword.new") : J("settings:accessPassword.set"),
						password: l,
						confirmation: p,
						onPassword: u,
						onConfirmation: m,
						passwordError: _.password,
						confirmationError: _.confirmation,
						passwordHint: J("settings:accessPassword.newHelp")
					}) : null,
					h ? /* @__PURE__ */ (0, Q.jsx)(N, {
						tone: "warning",
						title: J("settings:accessPassword.scope"),
						children: J("settings:accessPassword.disableWarning")
					}) : null,
					x.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: x.error }) : null
				] })
			}), ee ? /* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				...W(x.busy === "save"),
				children: J("settings:shared.saveSettings")
			}) }) : null]
		}),
		n && (a.mode === "password" || a.mode === "legacy") ? n(a) : null,
		r ? r(a) : null
	] });
}
// src/react/settings/api-token-settings.tsx
var Gs = "/api/configuration/access/token/rotate";
function Ks(e, t) {
	let n = J("settings:accessToken.scriptsInvalidated"), r = J(e === "legacy" ? "settings:accessToken.rotateEffectLegacy" : e === "open" ? "settings:accessToken.rotateEffectOpen" : "settings:accessToken.rotateEffectPassword", { scripts: n });
	return t ? J("settings:accessToken.rotateEffectPaired", { sentence: r }) : r;
}
function qs({ initial: e, mode: t, receipt: n }) {
	let [r, i] = (0, Z.useState)(e), [a, o] = (0, Z.useState)(null), s = Y(), c = an();
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:accessToken.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
			/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:accessToken.help") }),
			a ? /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, Q.jsxs)("div", {
						className: "flex min-w-0 flex-wrap items-end gap-2",
						children: [/* @__PURE__ */ (0, Q.jsx)(M, {
							className: "min-w-0 flex-1",
							label: J("settings:accessToken.newToken"),
							value: a.token,
							isReadOnly: !0,
							autoComplete: "off"
						}), /* @__PURE__ */ (0, Q.jsx)(f, {
							variant: "secondary",
							"aria-label": J("settings:accessToken.copyNew"),
							onClick: () => void s.run("copy", () => navigator.clipboard.writeText(a.token), () => n(J("settings:accessToken.copied"))),
							children: J("settings:accessToken.copy")
						})]
					}),
					s.error ? /* @__PURE__ */ (0, Q.jsx)(j, {
						role: "status",
						children: J("settings:accessToken.copyFailed")
					}) : null,
					/* @__PURE__ */ (0, Q.jsx)(N, {
						tone: "info",
						title: J("settings:accessToken.shownOnce"),
						children: J("settings:accessToken.shownOnceHelp")
					})
				]
			}) : null,
			a?.relogin ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "warning",
				title: J("settings:accessToken.reloginTitle"),
				children: J("settings:accessToken.reloginHelp")
			}) : null,
			r.rotatable ? null : /* @__PURE__ */ (0, Q.jsx)(j, { children: r.reason })
		] }), r.rotatable ? /* @__PURE__ */ (0, Q.jsx)(A, {
			status: J("settings:accessToken.immediate"),
			children: /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				onClick: () => void at({
					title: J("settings:accessToken.rotateTitle"),
					body: Ks(t, r.paired),
					confirmLabel: J("settings:accessToken.rotate"),
					onConfirm: async () => {
						let e = await U(Gs, {});
						i(e), o(e), e.mode === "legacy" && c.invalidateQueries({ queryKey: ["access-sessions"] }), n(e.signed_out ? J("settings:accessToken.rotatedSignedOut", { count: e.signed_out }) : J("settings:accessToken.rotated"));
					}
				}),
				children: J("settings:accessToken.rotate")
			})
		}) : null]
	});
}
// src/react/settings/certificate-trust.tsx
function Js({ rows: e, label: t }) {
	let n = e.length + 8, r = e.flatMap((e, t) => [...e].flatMap((e, n) => e === "1" ? [`M${n + 4} ${t + 4}h1v1h-1z`] : [])).join("");
	return /* @__PURE__ */ (0, Q.jsx)("svg", {
		role: "img",
		"aria-label": t,
		viewBox: `0 0 ${n} ${n}`,
		shapeRendering: "crispEdges",
		className: "size-40 shrink-0 rounded-lg bg-white text-black",
		children: /* @__PURE__ */ (0, Q.jsx)("path", {
			d: r,
			fill: "currentColor"
		})
	});
}
var Ys = [
	[J("settings:certificateTrust.iosDevices"), J("settings:certificateTrust.iosSteps")],
	["Android", J("settings:certificateTrust.androidSteps")],
	[J("settings:certificateTrust.computer"), J("settings:certificateTrust.computerSteps")]
];
function Xs({ initial: e }) {
	let t = X({
		queryKey: ["ca-certificate"],
		initialData: e,
		queryFn: ({ signal: e }) => H("/api/configuration/certificate", e),
		staleTime: Infinity,
		refetchInterval: Math.max(60, e.expires_in - 60) * 1e3
	}).data, n = t.fingerprint.split(":"), r = [
		0,
		8,
		16,
		24
	].map((e) => n.slice(e, e + 8).join(":"));
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:certificateTrust.title"),
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:certificateTrust.help") }), /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-wrap items-start gap-4",
				children: [/* @__PURE__ */ (0, Q.jsx)(Js, {
					rows: t.qr,
					label: J("settings:certificateTrust.qrLabel")
				}), /* @__PURE__ */ (0, Q.jsxs)("div", {
					className: "flex min-w-0 flex-1 basis-64 flex-col gap-2",
					children: [/* @__PURE__ */ (0, Q.jsxs)(re, { children: [/* @__PURE__ */ (0, Q.jsx)(k, {
						term: J("settings:certificateTrust.fingerprint"),
						children: /* @__PURE__ */ (0, Q.jsx)("span", {
							className: "flex max-w-sm flex-wrap justify-end gap-x-2 font-mono text-caption-1-regular",
							children: r.map((e, t) => /* @__PURE__ */ (0, Q.jsx)("span", {
								className: "whitespace-nowrap",
								children: e
							}, t))
						})
					}), /* @__PURE__ */ (0, Q.jsx)(k, {
						term: J("settings:certificateTrust.validUntil"),
						children: t.not_after
					})] }), /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:certificateTrust.qrHelp") })]
				})]
			})] }),
			/* @__PURE__ */ (0, Q.jsx)(P, { children: Ys.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(R, {
				label: e,
				description: t
			}, e)) }),
			/* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:certificateTrust.verifyHelp") })
			}),
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(p, {
				href: t.download,
				download: "peach-local-ca.crt",
				leadingIcon: dn,
				children: J("settings:certificateTrust.download")
			}) })
		]
	});
}
// src/react/settings/device-sessions.tsx
var Zs = "/api/configuration/access/sessions", Qs = (e) => e.device || J("settings:deviceSessions.unknownBrowser"), $s = {
	glyph: oe,
	brand: "apple"
}, ec = {
	glyph: Tt,
	brand: "android"
}, tc = {
	iPhone: {
		platform: $s,
		terminal: Je
	},
	iPad: {
		platform: $s,
		terminal: E
	},
	Android: {
		platform: ec,
		terminal: Je
	},
	"Android tablet": {
		platform: ec,
		terminal: E,
		label: () => J("settings:deviceSessions.androidTablet")
	},
	ChromeOS: {
		platform: { browser: "chrome" },
		terminal: fn
	},
	Windows: {
		platform: {
			glyph: Ke,
			brand: "windows"
		},
		terminal: fn
	},
	macOS: {
		platform: $s,
		terminal: fn
	},
	Linux: { terminal: fn }
}, nc = "inline size-4 -mt-0.5 mr-1 align-middle";
function rc({ platform: e }) {
	if ("browser" in e) return /* @__PURE__ */ (0, Q.jsx)(Pr, {
		name: e.browser,
		className: nc
	});
	let { glyph: t, brand: n } = e;
	return /* @__PURE__ */ (0, Q.jsx)(t, {
		"aria-hidden": !0,
		"data-platform-mark": n,
		className: nc
	});
}
function ic({ row: e }) {
	if (!e.device) return Qs(e);
	let t = e.device.split(" · "), n = tc[t.at(-1) ?? ""] ? t.pop() : "", r = t.join(" · "), i = n ? tc[n].platform : void 0;
	return /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
		r ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [Fr(r) ? /* @__PURE__ */ (0, Q.jsx)(Pr, {
			name: r,
			className: nc
		}) : null, r] }) : null,
		r && n ? " · " : null,
		n ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [i ? /* @__PURE__ */ (0, Q.jsx)(rc, { platform: i }) : null, tc[n].label?.() ?? n] }) : null
	] });
}
function ac({ row: e }) {
	let t = tc[e.device.split(" · ").at(-1) ?? ""]?.terminal ?? lt;
	return /* @__PURE__ */ (0, Q.jsx)(t, {
		"aria-hidden": !0,
		className: "size-5 shrink-0 text-foreground-icon-secondary"
	});
}
function oc({ row: e, children: t }) {
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-h-13 w-full items-center justify-between gap-4 border-b border-separator-border py-2.5 pr-2.5 last:border-b-0",
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 items-center gap-3",
			children: [/* @__PURE__ */ (0, Q.jsx)(ac, { row: e }), /* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex min-w-0 flex-col",
				children: [/* @__PURE__ */ (0, Q.jsx)("p", {
					className: "text-body-regular text-text-primary",
					children: /* @__PURE__ */ (0, Q.jsx)(ic, { row: e })
				}), /* @__PURE__ */ (0, Q.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: lc(e)
				})]
			})]
		}), t]
	});
}
function sc(e, t = Date.now() / 1e3) {
	let n = Math.max(0, t - e);
	return n < 60 ? J("settings:deviceSessions.justNow") : n < 3600 ? J("settings:deviceSessions.minutesAgo", { count: Math.floor(n / 60) }) : n < 86400 ? J("settings:deviceSessions.hoursAgo", { count: Math.floor(n / 3600) }) : n < 2592e3 ? J("settings:deviceSessions.daysAgo", { count: Math.floor(n / 86400) }) : (/* @__PURE__ */ new Date(e * 1e3)).toLocaleDateString(xt);
}
function cc(e) {
	return e.network === "loopback" ? J("settings:deviceSessions.loopback") : e.network ? e.remote ? J("settings:deviceSessions.viaRemoteAccess", { network: e.network }) : e.network : "";
}
var lc = (e) => [J("settings:deviceSessions.lastActive", { time: sc(e.last_seen) }), cc(e)].filter(Boolean).join(" · ");
function uc({ revision: e, receipt: t }) {
	let n = X({
		queryKey: ["access-sessions", e],
		refetchOnMount: "always",
		queryFn: ({ signal: e }) => H(Zs, e)
	});
	return n.error ? /* @__PURE__ */ (0, Q.jsx)(F, {
		title: J("settings:signedInDevices.title"),
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(n.error) }) })
	}) : n.isFetching || !n.data ? /* @__PURE__ */ (0, Q.jsx)(Ne, {
		label: J("settings:deviceSessions.loading"),
		html: ut
	}) : /* @__PURE__ */ (0, Q.jsx)(dc, {
		initial: n.data,
		receipt: t
	});
}
function dc({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e);
	(0, Z.useEffect)(() => r(e), [e]);
	let i = n.sessions.filter((e) => !e.current);
	(0, Z.useEffect)(() => {
		Rt("devices", {
			rows: Math.min(n.sessions.length, 8),
			manageable: n.manageable && i.length > 0
		});
	}, [n, i.length]);
	let a = (e) => void at({
		title: J("settings:deviceSessions.revokeTitle"),
		body: J("settings:deviceSessions.revokeBody", {
			device: Qs(e),
			details: lc(e)
		}),
		confirmLabel: J("settings:deviceSessions.revokeConfirm"),
		onConfirm: async () => {
			r(await U(`${Zs}/revoke`, {
				revision: n.revision,
				id: e.id
			})), t(J("settings:deviceSessions.revoked"));
		}
	});
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:signedInDevices.title"),
		children: [
			n.sessions.length ? /* @__PURE__ */ (0, Q.jsx)(P, { children: n.sessions.map((e) => /* @__PURE__ */ (0, Q.jsx)(oc, {
				row: e,
				children: e.current ? /* @__PURE__ */ (0, Q.jsx)(x, {
					color: "blue",
					variant: "caption",
					children: J("settings:deviceSessions.thisDevice")
				}) : n.manageable ? /* @__PURE__ */ (0, Q.jsx)(f, {
					size: "small",
					variant: "secondary",
					"aria-label": J("settings:deviceSessions.revokeDevice", { device: Qs(e) }),
					onClick: () => a(e),
					children: J("settings:deviceSessions.revoke")
				}) : null
			}, e.id)) }) : /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:deviceSessions.empty") }) }),
			!n.manageable && i.length ? /* @__PURE__ */ (0, Q.jsx)(z, {
				divided: !0,
				children: /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:deviceSessions.serverOnly") })
			}) : null,
			n.manageable && i.length ? /* @__PURE__ */ (0, Q.jsx)(A, {
				status: J("settings:signedInDevices.passwordChangeNotice"),
				children: /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "secondary",
					onClick: () => void at({
						title: J("settings:deviceSessions.revokeOthersTitle"),
						body: J("settings:deviceSessions.revokeOthersBody", { count: i.length }),
						confirmLabel: J("settings:deviceSessions.revokeConfirm"),
						onConfirm: async () => {
							let e = await U(`${Zs}/revoke`, {
								revision: n.revision,
								scope: "others"
							});
							r(e), t(J("settings:deviceSessions.revokedCount", { count: e.removed }));
						}
					}),
					children: J("settings:signedInDevices.revokeOthers")
				})
			}) : null
		]
	});
}
// src/react/settings/port-settings.tsx
var fc = [{
	value: "0.0.0.0",
	label: J("settings:accessAddress.lanDevices")
}, {
	value: "127.0.0.1",
	label: J("settings:accessAddress.thisComputerOnly")
}];
function pc({ data: e, receipt: t }) {
	let n = e.network, r = n ? n.editable : e.editable && e.port_editable !== !1, [i, a] = (0, Z.useState)(n?.host ?? "127.0.0.1"), [o, s] = (0, Z.useState)(n?.mdns_name ?? "peach"), [c, l] = (0, Z.useState)(String(e.port)), [u, p] = (0, Z.useState)({}), [m, h] = (0, Z.useState)(null), g = Y();
	return (0, Z.useEffect)(() => {
		if (!m) return;
		let e = setTimeout(() => location.assign(m.url), Ho);
		return () => clearTimeout(e);
	}, [m]), m ? /* @__PURE__ */ (0, Q.jsx)(F, {
		guide: "port",
		title: J("settings:accessUrls.title"),
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsxs)(N, {
			tone: "success",
			title: J("settings:shared.configSaved"),
			children: [J("settings:accessAddress.restarting"), /* @__PURE__ */ (0, Q.jsx)(ue, {
				href: m.url,
				size: "small",
				children: J("settings:accessAddress.backToNetwork")
			})]
		}) })
	}) : /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "port",
		title: J("settings:accessUrls.title"),
		onSubmit: r ? (r) => {
			r.preventDefault(), p({}), g.run("save", (t) => U(v, {
				revision: e.revision,
				media_dirs: e.media_dirs,
				...e.media_sources ? { media_sources: e.media_sources } : {},
				port: c,
				scan_now: !1,
				...n?.editable ? {
					host: i,
					...i === "0.0.0.0" ? { mdns_name: o } : {}
				} : {}
			}, "POST", t), (e) => {
				h({ url: new URL("/settings/network", e.url).href }), t(J("settings:shared.settingsSaved"));
			}, (e) => {
				let t = e instanceof d && e.status === 400 ? Qe(e.body) : null;
				t && (t.port || t.host || t.mdns_name) ? p(t) : g.setError(K(e));
			});
		} : void 0,
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
			n ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(mc, {
				label: J("settings:accessAddress.localUrl"),
				value: n.local_url,
				receipt: t
			}), n.lan_url || n.ip_url ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [
				/* @__PURE__ */ (0, Q.jsx)(mc, {
					label: J("settings:accessAddress.phoneUrl"),
					value: n.lan_url || n.ip_url,
					receipt: t
				}),
				n.lan_url && n.ip_url ? /* @__PURE__ */ (0, Q.jsx)(mc, {
					label: J("settings:accessAddress.alternateIp"),
					value: n.ip_url,
					receipt: t
				}) : null,
				/* @__PURE__ */ (0, Q.jsxs)(j, { children: [J("settings:accessAddress.sameWifi"), n.ip_url && n.lan_url ? J("settings:accessAddress.tryIp") : ""] })
			] }) : /* @__PURE__ */ (0, Q.jsx)(j, { children: n.scope === "local" ? J("settings:accessAddress.localOnly") : J("settings:accessAddress.lanUnavailable") })] }) : null,
			r ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [n?.editable ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(Qa, {
				id: "configHost",
				label: J("settings:accessAddress.whoCanConnect"),
				value: i,
				onChange: a,
				options: fc,
				isDisabled: !!g.busy,
				isInvalid: !!u.host,
				children: u.host ? /* @__PURE__ */ (0, Q.jsx)(T, { children: u.host }) : null
			}), i === "0.0.0.0" ? /* @__PURE__ */ (0, Q.jsx)($a, {
				id: "configMdnsName",
				label: J("settings:accessUrls.lanUrl"),
				value: o,
				onChange: s,
				prefix: n.local_url.startsWith("https:") ? "https://" : "http://",
				suffix: ".local",
				autoComplete: "off",
				spellCheck: "false",
				maxLength: 63,
				isDisabled: !!g.busy,
				validationBehavior: "aria",
				isInvalid: !!u.mdns_name,
				hint: u.mdns_name || void 0
			}) : null] }) : null, /* @__PURE__ */ (0, Q.jsx)($a, {
				id: "configPort",
				label: J("settings:accessUrls.port"),
				prefix: "localhost:",
				inputMode: "numeric",
				value: c,
				onChange: l,
				isDisabled: !!g.busy,
				validationBehavior: "aria",
				isInvalid: !!u.port,
				hint: u.port
			})] }) : /* @__PURE__ */ (0, Q.jsx)(j, { children: e.notice || J("settings:accessAddress.managedByStartup") }),
			n?.editable && i === "0.0.0.0" && n.scope === "local" ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("settings:accessAddress.phoneUrlAfterRestart") }) : null,
			g.error ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("settings:shared.notSaved"),
				children: g.error
			}) : null
		] }), r ? /* @__PURE__ */ (0, Q.jsx)(A, {
			status: J("settings:accessUrls.restartNotice"),
			children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				...W(g.busy === "save"),
				children: J("settings:shared.saveSettings")
			})
		}) : null]
	});
}
function mc({ label: e, value: t, receipt: n }) {
	let r = Y();
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-wrap items-end gap-2",
			children: [/* @__PURE__ */ (0, Q.jsx)(M, {
				className: "min-w-0 flex-1",
				label: e,
				value: t,
				isReadOnly: !0,
				autoComplete: "off"
			}), /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				"aria-label": J("settings:accessAddress.copyLabel", { label: e }),
				onClick: () => void r.run("copy", () => navigator.clipboard.writeText(t), () => n(J("settings:accessAddress.copied"))),
				children: J("settings:accessAddress.copyUrl")
			})]
		}), r.error ? /* @__PURE__ */ (0, Q.jsx)(j, {
			role: "status",
			children: J("settings:accessAddress.copyFailed")
		}) : null]
	});
}
// src/react/settings/peach-proxy-fields.tsx
var hc = [
	["environment", J("settings:peachProxy.environment")],
	["direct", J("settings:cloudProxy.direct")],
	["proxy", J("settings:shared.custom")]
];
function gc({ mode: e, onChange: t, labelledBy: n }) {
	return /* @__PURE__ */ (0, Q.jsx)(I, {
		"aria-label": n ? void 0 : J("settings:peachProxy.mode"),
		"aria-labelledby": n,
		selectedKey: e,
		onSelectionChange: (e) => {
			e !== null && t(String(e));
		},
		children: hc.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(L, {
			id: e,
			children: t
		}, e))
	});
}
function _c({ id: e, value: t, onChange: n, saved: r = !1, error: i }) {
	return /* @__PURE__ */ (0, Q.jsx)(M, {
		id: e,
		type: "password",
		label: J("settings:peachProxy.url"),
		autoComplete: "off",
		spellCheck: "false",
		value: t,
		onChange: n,
		placeholder: r ? J("settings:peachProxy.savedPlaceholder") : "http://127.0.0.1:7890",
		validationBehavior: "aria",
		isInvalid: !!i,
		hint: i
	});
}
// src/react/settings/tunnel-settings.tsx
var vc = 2e3, yc = 3e5, bc = [["quick", J("settings:cloudflareTunnel.quick")], ["named", J("settings:cloudflareTunnel.named")]], xc = {
	quick: J("settings:remoteAccess.quickHelp"),
	named: J("settings:remoteAccess.namedHelp")
};
function Sc({ revision: e, initial: t, receipt: n, blocked: r = !1 }) {
	let [i, a] = (0, Z.useState)(t);
	(0, Z.useEffect)(() => {
		r && a((e) => e.state === "stopped" ? e : {
			...e,
			enabled: !1,
			state: "stopped",
			url: ""
		});
	}, [r]);
	let [o, s] = (0, Z.useState)(e), [l, u] = (0, Z.useState)(t.mode), [p, m] = (0, Z.useState)(t.hostname), [h, _] = (0, Z.useState)(""), [v, y] = (0, Z.useState)({}), b = Y(), x = i.state === "starting" || i.state === "running", S = i.named_available && l === "named";
	(0, Z.useEffect)(() => {
		if (i.state !== "starting") return;
		let e = new AbortController();
		return Nt({
			signal: e.signal,
			everyMs: vc,
			limitMs: yc,
			read: (e) => dt(e),
			apply: (e) => {
				e.tunnel && (q.setQueryData(g, e), a(e.tunnel), s(e.revision));
			},
			done: (e) => !!e.tunnel && e.tunnel.state !== "starting"
		}), () => e.abort();
	}, [i.state]);
	let C = (e, t, n) => {
		y({}), b.run(e, (e) => U("/api/configuration/tunnel", {
			revision: o,
			enabled: t,
			mode: l,
			hostname: p,
			token: h
		}, "POST", e), (e) => {
			a(e), s(e.revision), u(e.mode), m(e.hostname), _(""), n(e);
		}, (e) => {
			let t = e instanceof d ? e.body : null, n = Qe(t) || Qe(t?.detail);
			n ? y(n) : b.setError(K(e));
		});
	};
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "tunnel",
		guide: "tunnel",
		title: J("settings:remoteAccess.title"),
		onSubmit: (e) => {
			e.preventDefault(), C("save", x, () => n(J("settings:shared.settingsSaved")));
		},
		aside: /* @__PURE__ */ (0, Q.jsx)(B, {
			tone: i.error ? "error" : x ? "progress" : "neutral",
			children: i.error ? J("settings:cloudflareTunnel.connectionFailed") : i.state === "running" ? J("settings:shared.running") : i.state === "starting" ? J("settings:cloudflareTunnel.connectingStatus") : J("settings:shared.stopped")
		}),
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
			i.named_available ? /* @__PURE__ */ (0, Q.jsx)(Pe, {
				"aria-label": J("settings:cloudflareTunnel.modeLabel"),
				value: l,
				isDisabled: x || r,
				onChange: (e) => u(e),
				className: Ae,
				children: bc.map(([e, t]) => /* @__PURE__ */ (0, Q.jsx)(c, {
					value: e,
					className: ke,
					children: t
				}, e))
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(j, { children: xc[S ? "named" : "quick"] }),
			S ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)(M, {
				id: "tunnel-hostname",
				label: J("settings:remoteAccess.hostname"),
				autoComplete: "off",
				maxLength: 253,
				value: p,
				onChange: m,
				isDisabled: x || r,
				validationBehavior: "aria",
				isInvalid: !!v.hostname,
				hint: v.hostname || J("settings:remoteAccess.hostnameHelp")
			}), /* @__PURE__ */ (0, Q.jsx)(M, {
				id: "tunnel-token",
				type: "password",
				label: J("settings:remoteAccess.tunnelToken"),
				autoComplete: "off",
				maxLength: 2048,
				value: h,
				onChange: _,
				isDisabled: x || r,
				validationBehavior: "aria",
				hint: i.token_set ? J("settings:cloudflareTunnel.tokenSaved") : J("settings:cloudflareTunnel.tokenHint")
			})] }) : null,
			i.available ? null : /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "warning",
				title: J("settings:cloudflareTunnel.binaryMissing"),
				children: J("settings:cloudflareTunnel.binaryMissingHelp")
			}),
			i.state === "running" && i.url ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "info",
				title: J("settings:cloudflareTunnel.publicUrl"),
				children: /* @__PURE__ */ (0, Q.jsx)(D, {
					href: i.url,
					children: i.url
				})
			}) : null,
			i.state === "starting" ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "info",
				title: J("settings:cloudflareTunnel.connectingTitle"),
				children: J("settings:cloudflareTunnel.connectingHelp")
			}) : null,
			i.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: G(i, "error") }) : null,
			b.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: b.error }) : null
		] }), /* @__PURE__ */ (0, Q.jsxs)(A, { children: [/* @__PURE__ */ (0, Q.jsx)(f, {
			variant: i.named_available ? "secondary" : "primary",
			onClick: () => C("toggle", !x, (e) => n(e.enabled ? J("settings:cloudflareTunnel.started") : J("settings:cloudflareTunnel.stopped"))),
			...W(b.busy === "toggle"),
			disabled: r && !x,
			children: J(x ? "settings:cloudflareTunnel.stop" : "settings:remoteAccess.start")
		}), i.named_available ? /* @__PURE__ */ (0, Q.jsx)(f, {
			type: "submit",
			...W(b.busy === "save"),
			children: J("settings:shared.saveSettings")
		}) : null] })]
	});
}
// src/react/settings/network-settings.tsx
function Cc({ data: e, receipt: t, panel: n, issues: r }) {
	let [i, a] = (0, Z.useState)(e.access?.mode), o = i === "open" || i === "locked";
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(n),
		children: [
			r,
			e.network || e.editable && e.port_editable !== !1 && !e.section_errors?.media_sources ? /* @__PURE__ */ (0, Q.jsx)(pc, {
				data: e,
				receipt: t
			}) : null,
			e.access ? /* @__PURE__ */ (0, Q.jsx)(Ws, {
				initial: e.access,
				receipt: t,
				onSaved: (e) => a(e.mode),
				devices: (e) => /* @__PURE__ */ (0, Q.jsx)(uc, {
					revision: e.revision,
					receipt: t
				}),
				after: e.api_token ? (n) => /* @__PURE__ */ (0, Q.jsx)(qs, {
					initial: e.api_token,
					mode: n.mode,
					receipt: t
				}) : void 0
			}) : null,
			e.certificate ? /* @__PURE__ */ (0, Q.jsx)(Xs, { initial: e.certificate }) : null,
			e.tunnel ? /* @__PURE__ */ (0, Q.jsx)(Sc, {
				revision: e.revision,
				initial: e.tunnel,
				receipt: t,
				blocked: o
			}) : null,
			e.peach_proxy ? /* @__PURE__ */ (0, Q.jsx)(wc, {
				initial: e.peach_proxy,
				receipt: t
			}) : null
		]
	});
}
function wc({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e), [i, a] = (0, Z.useState)(e.mode), [o, s] = (0, Z.useState)(""), c = Y();
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		id: "peachProxy",
		guide: "proxy",
		title: J("settings:peachProxy.title"),
		onSubmit: (e) => {
			e.preventDefault(), c.run("save", (e) => U("/api/configuration/peach-proxy", {
				mode: i,
				proxy: o
			}, "POST", e), (e) => {
				r(e), s(""), t(J("settings:shared.settingsSaved"));
			});
		},
		children: [
			/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
				label: J("settings:peachProxy.mode"),
				description: J("settings:peachProxy.modeHelp"),
				children: /* @__PURE__ */ (0, Q.jsx)(gc, {
					mode: i,
					onChange: a
				})
			}) }),
			i === "proxy" || n.needs_selection || c.error ? /* @__PURE__ */ (0, Q.jsxs)(z, {
				divided: !0,
				children: [
					i === "proxy" ? /* @__PURE__ */ (0, Q.jsx)(_c, {
						id: "peachProxyAddress",
						value: o,
						onChange: s,
						saved: n.proxy_saved
					}) : null,
					n.needs_selection ? /* @__PURE__ */ (0, Q.jsx)(N, {
						tone: "warning",
						title: J("settings:peachProxy.chooseMode"),
						children: J("settings:peachProxy.modeConflict")
					}) : null,
					c.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: c.error }) : null
				]
			}) : null,
			/* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
				type: "submit",
				...W(c.busy === "save"),
				children: J("settings:shared.saveSettings")
			}) })
		]
	});
}
// src/react/follow-manage/credentials.tsx
var Tc = J("follow:sourceCredentials.clearBody"), Ec = J("follow:sourceCredentials.worldReadable");
function Dc(e, t) {
	return (e.shared_fields || []).includes(t) ? J("follow:sourceCredentials.fromSharedHint") : e.fields.includes(t) ? J("follow:sourceCredentials.savedHint") : J("follow:sourceCredentials.notSet");
}
function Oc({ row: e }) {
	if (ot(e)) return /* @__PURE__ */ (0, Q.jsx)(x, {
		variant: "caption",
		color: "lime",
		children: J("follow:sourceCredentials.configured")
	});
	let t = e.requirement === "required" ? "yellow" : e.requirement === "blocked" ? "rose" : "neutral";
	return /* @__PURE__ */ (0, Q.jsx)(x, {
		variant: "caption",
		color: t,
		children: y[e.requirement] || ""
	});
}
function kc({ row: e, readOnly: t, toast: n }) {
	let [r, i] = (0, Z.useState)({}), [a, o] = (0, Z.useState)(""), s = ot(e), c = nn({
		mutationFn: (t) => Ht(e.provider, t),
		onSuccess: (e, t) => {
			e.note ? o(Gt(e.note_code ?? "", e.note)) : (o(""), i({}), q.invalidateQueries({
				queryKey: O,
				exact: !0
			}), n(Object.keys(t).length ? J("follow:sourceCredentials.saved") : J("follow:sourceCredentials.cleared")));
		},
		onError: (e) => o(K(e))
	}), l = () => {
		let e = Object.fromEntries(Object.entries(r).map(([e, t]) => [e, t.trim()]).filter(([, e]) => e));
		Object.keys(e).length ? c.mutate(e) : o(J("follow:sourceCredentials.nothingEntered"));
	};
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, Q.jsxs)(j, { children: [G(e, "why"), e.where ? /* @__PURE__ */ (0, Q.jsxs)(Q.Fragment, { children: [" ", /* @__PURE__ */ (0, Q.jsx)(D, {
				href: e.where,
				children: J("follow:sourceCredentials.getCredentials")
			})] }) : null] }),
			e.howto ? /* @__PURE__ */ (0, Q.jsx)(j, { children: G(e, "howto") }) : null,
			/* @__PURE__ */ (0, Q.jsx)("div", {
				className: "flex w-full flex-col gap-3",
				children: (e.needs || []).map((n) => /* @__PURE__ */ (0, Q.jsx)(M, {
					type: "password",
					label: n,
					placeholder: Dc(e, n),
					autoComplete: "off",
					spellCheck: "false",
					isDisabled: t,
					value: r[n] || "",
					onChange: (e) => i({
						...r,
						[n]: e
					}),
					className: "w-full min-w-0"
				}, n))
			}),
			/* @__PURE__ */ (0, Q.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [s ? /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "danger",
					disabled: t,
					...W(c.isPending),
					onClick: () => void at({
						title: J("follow:sourceCredentials.clearTitle"),
						body: Tc,
						confirmLabel: J("follow:sourceCredentials.clearTitle"),
						danger: !0,
						holdToConfirm: !0,
						onConfirm: () => c.mutateAsync({})
					}),
					children: J("follow:shared.clear")
				}) : null, /* @__PURE__ */ (0, Q.jsx)(f, {
					variant: "primary",
					disabled: t,
					...W(c.isPending),
					onClick: l,
					children: J("follow:shared.saveSettings")
				})]
			}),
			a ? /* @__PURE__ */ (0, Q.jsx)(T, { children: a }) : null,
			(e.shared_fields || []).length ? /* @__PURE__ */ (0, Q.jsx)(j, { children: J("follow:sourceCredentials.sharedFieldsHint", {
				count: e.shared_fields.length,
				fields: wt(e.shared_fields)
			}) }) : null,
			e.path ? /* @__PURE__ */ (0, Q.jsx)(C, {
				summary: J("follow:sourceCredentials.credentialsFile"),
				children: /* @__PURE__ */ (0, Q.jsx)(xe, {
					path: e.path,
					className: "font-mono text-caption-1-regular text-text-tertiary",
					onRevealed: n
				})
			}) : null
		]
	});
}
function Ac({ row: e, readOnly: t, toast: n }) {
	let r = /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 flex-wrap items-center gap-2",
		children: [
			/* @__PURE__ */ (0, Q.jsx)("span", {
				className: "inline-flex size-3.5 shrink-0 items-center justify-center",
				children: /* @__PURE__ */ (0, Q.jsx)(Ir, { provider: e.provider })
			}),
			/* @__PURE__ */ (0, Q.jsx)("b", {
				className: "min-w-0 text-body-medium wrap-anywhere text-text-primary",
				children: e.provider_label
			}),
			/* @__PURE__ */ (0, Q.jsx)(Oc, { row: e }),
			e.missing.map((e) => /* @__PURE__ */ (0, Q.jsx)(x, {
				variant: "caption",
				color: "rose",
				children: J("follow:sourceCredentials.missingField", { field: e })
			}, e))
		]
	});
	return e.requirement === "none" || e.requirement === "blocked" ? /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-wrap items-center gap-3 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4",
		children: [r, e.requirement === "blocked" ? /* @__PURE__ */ (0, Q.jsx)(j, { children: G(e, "why") }) : null]
	}) : /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: "flex flex-col gap-2 border-b border-separator-border px-6 py-5 last:border-b-0 max-sm:px-4",
		children: [
			r,
			/* @__PURE__ */ (0, Q.jsx)(C, {
				summary: ot(e) ? J("follow:sourceCredentials.editCredentials") : J("follow:sourceCredentials.enterCredentials"),
				defaultOpen: e.requirement === "required" && !ot(e),
				children: /* @__PURE__ */ (0, Q.jsx)(kc, {
					row: e,
					readOnly: t,
					toast: n
				})
			}),
			e.world_readable ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("follow:sourceCredentials.permissionsTooOpen"),
				children: Ec
			}) : null
		]
	});
}
function jc({ data: e, readOnly: t, toast: n, embedded: r = !1 }) {
	let i = e.providers || [], a = i.filter((e) => e.requirement === "required" && !ot(e));
	if ((0, Z.useEffect)(() => {
		Rt("credentials", { done: i.filter(ot).map((e) => e.provider) });
	}, [e]), !i.length) return /* @__PURE__ */ (0, Q.jsx)(w, {
		size: "compact",
		icon: it,
		title: J("follow:sourceCredentials.emptyTitle"),
		children: J("follow:sourceCredentials.emptyHint")
	});
	let o = a.length ? /* @__PURE__ */ (0, Q.jsx)("span", {
		className: "text-body-2-regular text-text-error-primary",
		children: J("follow:sourceCredentials.pendingCount", { count: a.length })
	}) : null, s = /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: [
		{
			title: J("follow:sourceCredentials.groupSupported"),
			rows: i.filter((e) => e.requirement !== "none" && e.requirement !== "blocked")
		},
		{
			title: J("follow:sourceCredentials.groupNotNeeded"),
			rows: i.filter((e) => e.requirement === "none")
		},
		{
			title: J("follow:sourceCredentials.groupUnsupported"),
			rows: i.filter((e) => e.requirement === "blocked")
		}
	].filter((e) => e.rows.length).map((e) => /* @__PURE__ */ (0, Q.jsxs)("section", {
		"aria-label": e.title,
		className: "flex flex-col gap-2",
		children: [/* @__PURE__ */ (0, Q.jsx)("h4", {
			className: "text-body-medium text-text-secondary",
			children: e.title
		}), /* @__PURE__ */ (0, Q.jsx)("div", {
			className: et({
				variant: "outlined",
				padding: "none",
				className: "flex flex-col overflow-hidden"
			}),
			children: e.rows.map((e) => /* @__PURE__ */ (0, Q.jsx)(Ac, {
				row: e,
				readOnly: t,
				toast: n
			}, e.provider))
		})]
	}, e.title)) });
	return r ? /* @__PURE__ */ (0, Q.jsx)(F, {
		guide: "credentials",
		title: J("follow:sourceCredentials.sectionTitle"),
		aside: o || void 0,
		children: /* @__PURE__ */ (0, Q.jsx)(z, { children: /* @__PURE__ */ (0, Q.jsx)("div", {
			className: "flex flex-col gap-4",
			children: s
		}) })
	}) : /* @__PURE__ */ (0, Q.jsxs)("div", {
		className: et({
			padding: "none",
			className: "flex flex-col gap-4 px-6 py-5 max-sm:px-4"
		}),
		children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [/* @__PURE__ */ (0, Q.jsx)("h3", {
				className: "mr-auto text-title-2-medium text-text-primary",
				children: J("follow:sourceCredentials.sectionTitle")
			}), o]
		}), s]
	});
}
// src/react/settings/entry-links-settings.tsx
function Mc({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e.sites), i = Y(), a = (e, t) => r((n) => n.map((n) => n.key === e ? {
		...n,
		host: t
	} : n));
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "entry-links",
		title: J("settings:entryLinks.title"),
		onSubmit: (e) => {
			e.preventDefault();
			let a = { sites: Object.fromEntries(n.map((e) => [e.key, { host: e.host }])) };
			i.run("save", (e) => U("/api/configuration/entry-links", a, "POST", e), (e) => {
				r(e.sites), t(J("settings:shared.settingsSaved"));
			});
		},
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [
			/* @__PURE__ */ (0, Q.jsx)(j, { children: ee }),
			n.map((e) => /* @__PURE__ */ (0, Q.jsx)(M, {
				id: `entry-link-${e.key}`,
				label: /* @__PURE__ */ (0, Q.jsx)(Le, {
					site: e.key,
					label: J("settings:entryLinks.siteAddress", { site: e.label })
				}),
				autoComplete: "off",
				maxLength: 100,
				value: e.host,
				placeholder: e.default_host,
				onChange: (t) => a(e.key, t),
				validationBehavior: "aria",
				hint: te
			}, e.key)),
			i.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: i.error }) : null
		] }), /* @__PURE__ */ (0, Q.jsx)(A, { children: /* @__PURE__ */ (0, Q.jsx)(f, {
			type: "submit",
			...W(i.busy === "save"),
			children: J("settings:shared.saveSettings")
		}) })]
	});
}
// src/react/settings/indexer-settings.tsx
var Nc = "/api/configuration/indexers";
function Pc({ receipt: e }) {
	let t = X({
		queryKey: ["indexers"],
		queryFn: ({ signal: e }) => H(Nc, e),
		refetchOnMount: "always"
	});
	return t.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: K(t.error) }) : t.isFetching ? /* @__PURE__ */ (0, Q.jsx)(Ne, {
		label: J("settings:indexers.loading"),
		html: bt
	}) : t.data ? /* @__PURE__ */ (0, Q.jsx)(Lc, {
		initial: t.data,
		receipt: e
	}) : null;
}
function Fc(e) {
	try {
		return new globalThis.URL(e).host;
	} catch {
		return e;
	}
}
function Ic({ row: e, index: t }) {
	let n = [
		e.url ? Fc(e.url) : J("settings:indexers.noUrl"),
		e.enabled ? J("settings:shared.enabled") : J("settings:shared.disabled"),
		e.api_key_set && !e.clear_api_key ? J("settings:indexers.apiKeySaved") : e.api_key ? J("settings:indexers.apiKeyUnsaved") : J("settings:indexers.noApiKey")
	];
	return /* @__PURE__ */ (0, Q.jsxs)("span", {
		className: "flex min-w-0 items-baseline gap-3",
		children: [/* @__PURE__ */ (0, Q.jsx)("span", {
			className: "shrink-0 text-text-primary",
			children: e.name || J("settings:indexers.defaultName", { index: t + 1 })
		}), /* @__PURE__ */ (0, Q.jsx)("span", {
			className: "truncate text-body-2-regular text-text-secondary",
			children: n.join(" · ")
		})]
	});
}
function Lc({ initial: e, receipt: t }) {
	let [n, r] = (0, Z.useState)(e.indexers), i = Y();
	(0, Z.useEffect)(() => {
		Rt("indexers", { open: e.indexers.map((e) => !e.url) });
	}, [e]);
	let a = (e, t) => r((n) => n.map((n) => n.key === e ? {
		...n,
		...t
	} : n));
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		guide: "indexers",
		title: J("settings:indexers.title"),
		onSubmit: (e) => {
			e.preventDefault(), i.run("save", (e) => U(Nc, { indexers: n }, "POST", e), (e) => {
				r(e.indexers), t(J("settings:indexers.saved"));
			});
		},
		children: [/* @__PURE__ */ (0, Q.jsxs)(z, { children: [/* @__PURE__ */ (0, Q.jsxs)("div", {
			className: "flex min-w-0 flex-col gap-4",
			children: [/* @__PURE__ */ (0, Q.jsx)(C, {
				summary: J("settings:indexers.connectHelp"),
				children: /* @__PURE__ */ (0, Q.jsxs)(j, { children: [
					J("settings:indexers.helpText"),
					" ",
					/* @__PURE__ */ (0, Q.jsx)(D, {
						href: "https://github.com/peach-mitao/peach/blob/master/docs/RESOURCE_SEARCH.md",
						children: J("settings:indexers.setupGuide")
					})
				] })
			}), n.map((e, t) => /* @__PURE__ */ (0, Q.jsx)("div", {
				className: "min-w-0 border-t border-separator-border pt-2",
				children: /* @__PURE__ */ (0, Q.jsx)(C, {
					defaultOpen: !e.url,
					summary: /* @__PURE__ */ (0, Q.jsx)(Ic, {
						row: e,
						index: t
					}),
					children: /* @__PURE__ */ (0, Q.jsxs)("div", {
						className: "flex min-w-0 flex-col gap-4",
						children: [
							/* @__PURE__ */ (0, Q.jsx)(M, {
								label: J("settings:shared.name"),
								"aria-label": J("settings:indexers.nameLabel", { index: t + 1 }),
								value: e.name,
								maxLength: 80,
								isDisabled: !!i.busy,
								onChange: (t) => a(e.key, { name: t })
							}),
							/* @__PURE__ */ (0, Q.jsx)(M, {
								label: J("settings:indexers.torznabUrl"),
								"aria-label": J("settings:indexers.torznabUrlLabel", { index: t + 1 }),
								value: e.url,
								type: "url",
								autoComplete: "off",
								placeholder: J("settings:indexers.urlPlaceholder"),
								isDisabled: !!i.busy,
								onChange: (t) => a(e.key, { url: t })
							}),
							/* @__PURE__ */ (0, Q.jsx)(M, {
								label: "API key",
								"aria-label": J("settings:indexers.apiKeyLabel", { index: t + 1 }),
								type: "password",
								autoComplete: "new-password",
								value: e.api_key || "",
								placeholder: e.api_key_set ? J("settings:shared.savedLeaveBlank") : void 0,
								isDisabled: !!i.busy,
								onChange: (t) => a(e.key, { api_key: t })
							}),
							/* @__PURE__ */ (0, Q.jsxs)("div", {
								className: "flex flex-wrap items-center gap-x-6 gap-y-2",
								children: [
									/* @__PURE__ */ (0, Q.jsx)(b, {
										isSelected: e.enabled,
										isDisabled: !!i.busy,
										onChange: (t) => a(e.key, { enabled: t }),
										children: J("settings:shared.enable")
									}),
									e.api_key_set ? /* @__PURE__ */ (0, Q.jsx)(b, {
										isSelected: !!e.clear_api_key,
										isDisabled: !!i.busy,
										onChange: (t) => a(e.key, { clear_api_key: t }),
										children: J("settings:indexers.clearApiKey")
									}) : null,
									/* @__PURE__ */ (0, Q.jsx)(f, {
										variant: "danger",
										type: "button",
										size: "small",
										disabled: !!i.busy,
										"aria-label": J("settings:indexers.removeLabel", { index: t + 1 }),
										onClick: () => r(n.filter((t) => t.key !== e.key)),
										children: J("settings:shared.remove")
									})
								]
							})
						]
					})
				})
			}, e.key))]
		}), i.error ? /* @__PURE__ */ (0, Q.jsx)(T, { children: i.error }) : null] }), /* @__PURE__ */ (0, Q.jsxs)(A, { children: [/* @__PURE__ */ (0, Q.jsx)(f, {
			variant: "secondary",
			type: "button",
			disabled: !!i.busy || n.length >= e.max_indexers,
			onClick: () => r([...n, {
				key: Lt(),
				name: "",
				url: "",
				enabled: !0,
				api_key_set: !1
			}]),
			children: J("settings:indexers.add")
		}), /* @__PURE__ */ (0, Q.jsx)(f, {
			type: "submit",
			...W(i.busy === "save"),
			children: J("settings:shared.saveSettings")
		})] })]
	});
}
// src/react/settings/scraping-browser-settings.tsx
var Rc = ["window", "headless"], zc = (e) => J(e === "headless" ? "settings:scrapingBrowser.headless" : "settings:scrapingBrowser.window");
function Bc({ receipt: e }) {
	let t = X({
		queryKey: De,
		queryFn: ({ signal: e }) => gt(e),
		refetchOnMount: "always"
	}), n = nn({
		mutationFn: (e) => U(Oe, { browser_mode: e }),
		onSuccess: (t) => {
			q.setQueryData(De, (e) => e && {
				...e,
				browser_mode: t.browser_mode
			}), e(J("settings:shared.settingsSaved"));
		}
	}, q), r = n.error || t.error;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:scrapingBrowser.title"),
		children: [/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:scrapingBrowser.mode"),
			description: J("settings:scrapingBrowser.modeHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "scrapingBrowserModeSetting",
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:scrapingBrowser.mode"),
					selectedKey: t.data?.browser_mode ?? "window",
					isDisabled: !t.data || n.isPending,
					onSelectionChange: (e) => {
						e !== null && n.mutate(String(e));
					},
					children: Rc.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: e,
						children: zc(e)
					}, e))
				})
			})
		}) }), r ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(r) })
		}) : null]
	});
}
// src/react/settings/want-search-settings.tsx
var Vc = [
	1,
	3,
	7,
	14,
	30
], Hc = [
	1,
	3,
	5,
	10,
	0
], Uc = (e) => e === 1 ? J("settings:wantSearch.daily") : J("settings:wantSearch.everyDays", { count: e }), Wc = (e) => e === 0 ? J("settings:wantSearch.never") : J("settings:wantSearch.attempts", { count: e });
function Gc({ receipt: e }) {
	let t = X({
		queryKey: je,
		queryFn: ({ signal: e }) => ht(e),
		refetchOnMount: "always"
	}), n = ln("want-search"), r = !t.data || n.isPending, i = (t) => n.mutate(t, { onSuccess: () => e(J("settings:shared.settingsSaved")) }), a = n.error || t.error;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:wantSearch.title"),
		children: [/* @__PURE__ */ (0, Q.jsxs)(P, { children: [/* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:wantSearch.interval"),
			description: J("settings:wantSearch.intervalHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "wantStaleSearchDaysSetting",
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:wantSearch.interval"),
					selectedKey: String(t.data?.wantStaleSearchDays ?? 7),
					isDisabled: r,
					onSelectionChange: (e) => {
						e !== null && i({ wantStaleSearchDays: Number(e) });
					},
					children: Vc.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: String(e),
						children: Uc(e)
					}, e))
				})
			})
		}), /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:wantSearch.giveUp"),
			description: J("settings:wantSearch.giveUpHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)("div", {
				id: "wantStaleAttemptLimitSetting",
				className: "shrink-0",
				children: /* @__PURE__ */ (0, Q.jsx)(I, {
					"aria-label": J("settings:wantSearch.giveUp"),
					selectedKey: String(t.data?.wantStaleAttemptLimit ?? 3),
					isDisabled: r,
					onSelectionChange: (e) => {
						e !== null && i({ wantStaleAttemptLimit: Number(e) });
					},
					children: Hc.map((e) => /* @__PURE__ */ (0, Q.jsx)(L, {
						id: String(e),
						children: Wc(e)
					}, e))
				})
			})
		})] }), a ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(a) })
		}) : null]
	});
}
// src/react/settings/cover-fallback-settings.tsx
function Kc({ receipt: e }) {
	let t = X({
		queryKey: je,
		queryFn: ({ signal: e }) => ht(e),
		refetchOnMount: "always"
	}), n = ln("cover-fallback"), r = n.error || t.error;
	return /* @__PURE__ */ (0, Q.jsxs)(F, {
		title: J("settings:coverFallback.title"),
		children: [/* @__PURE__ */ (0, Q.jsx)(P, { children: /* @__PURE__ */ (0, Q.jsx)(R, {
			label: J("settings:coverFallback.javdb"),
			description: J("settings:coverFallback.javdbHelp"),
			children: /* @__PURE__ */ (0, Q.jsx)(V, {
				"aria-label": J("settings:coverFallback.javdb"),
				isSelected: t.data?.javdbCoverFallback === !0,
				isDisabled: !t.data || n.isPending,
				onChange: (t) => n.mutate({ javdbCoverFallback: t }, { onSuccess: () => e(J("settings:shared.settingsSaved")) })
			})
		}) }), r ? /* @__PURE__ */ (0, Q.jsx)(z, {
			divided: !0,
			children: /* @__PURE__ */ (0, Q.jsx)(T, { children: K(r) })
		}) : null]
	});
}
// src/react/settings/source-settings.tsx
function qc({ data: e, receipt: t, panel: n, issues: r }) {
	let i = X({
		queryKey: O,
		queryFn: ({ signal: e }) => ft(e),
		enabled: n?.active !== !1,
		refetchOnMount: "always"
	});
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		...Rr(n),
		children: [
			r,
			/* @__PURE__ */ (0, Q.jsx)("div", {
				"data-guide-target": "sources",
				children: /* @__PURE__ */ (0, Q.jsx)(p, {
					href: "/sources",
					variant: "secondary",
					children: J("settings:sourceSettings.sourcesLink")
				})
			}),
			i.data ? /* @__PURE__ */ (0, Q.jsx)(jc, {
				data: i.data,
				readOnly: !!e.ledger_read_only,
				toast: t,
				embedded: !0
			}) : i.error ? /* @__PURE__ */ (0, Q.jsx)(N, {
				tone: "error",
				title: J("settings:sourceSettings.credentialsFailed"),
				children: K(i.error)
			}) : n?.active === !1 ? null : /* @__PURE__ */ (0, Q.jsx)(Ne, {
				label: J("settings:sourceSettings.loadingCredentials"),
				html: st
			}),
			/* @__PURE__ */ (0, Q.jsx)(ks, { receipt: t }),
			/* @__PURE__ */ (0, Q.jsx)(Bc, { receipt: t }),
			/* @__PURE__ */ (0, Q.jsx)(Gc, { receipt: t }),
			/* @__PURE__ */ (0, Q.jsx)(Kc, { receipt: t }),
			/* @__PURE__ */ (0, Q.jsx)(Pc, { receipt: t }),
			e.entry_links ? /* @__PURE__ */ (0, Q.jsx)(Mc, {
				initial: e.entry_links,
				receipt: t
			}) : null
		]
	});
}
// src/react/settings/configuration-shape.ts
function Jc(e) {
	let t = e.downloads;
	if (!t) return null;
	let n = t.media_sources ?? [];
	return {
		cloud: n.some((e) => m.includes(e)),
		has115: n.includes("115"),
		pikpak: n.includes("pikpak"),
		pikpakRoots: t.pikpak_roots.length > 0,
		pikpakLoggedIn: t.pikpak.logged_in,
		browserLogin: t.pikpak_browser.available
	};
}
function Yc(e) {
	let t = e.tunnel;
	return {
		port: !!(e.editable && e.port_editable !== !1),
		addresses: e.network ? 1 + Number(!!(e.network.lan_url || e.network.ip_url)) + Number(!!(e.network.lan_url && e.network.ip_url)) : 0,
		networkEditable: !!e.network?.editable,
		lan: e.network?.host === "0.0.0.0",
		proxyAddress: e.peach_proxy?.mode === "proxy" || !!e.peach_proxy?.needs_selection,
		access: e.access?.mode ?? "",
		tunnelNamed: !!t?.named_available,
		tunnelNamedMode: !!(t?.named_available && t.mode === "named"),
		tunnelNote: !!(t && (!t.available || t.state === "starting" || t.state === "running" && t.url))
	};
}
function Xc(e) {
	let t = e.updates, n = e.update_job?.state ?? "idle", r = !t || t.state === "unchecked" && !t.checked_at && n === "idle", i = +!!t?.package_kind + (r ? 0 : +!!t?.checked_at + (t?.state === "unchecked" ? 0 : 1) + (n === "idle" ? 0 : 1)), a = e.automatic_updates, o = e.storage;
	return {
		releaseFacts: t?.package_kind ? 5 : 4,
		releaseNotes: i,
		autoUpdateHelp: !(!a || a.available && !a.download_available),
		startupNote: !!e.startup?.message,
		desktopNote: !!e.startup?.desktop_message,
		storageRows: o?.usage?.categories.length ?? 0,
		storageNotes: o && !o.relocation.available ? 1 : 0,
		reporting: !!e.remote_reporting,
		reportingIdle: !(!e.remote_reporting || e.remote_reporting.available),
		sharing: !!e.library_sharing,
		sharingNotice: !!e.library_sharing?.notice,
		sharingIdle: !(!e.library_sharing || e.library_sharing.available),
		facts: e.facts.map((e) => e.term),
		uninstall: !!e.uninstall,
		uninstallHelp: !!e.uninstall?.available
	};
}
// src/react/settings/configuration-page.tsx
function Zc({ receipt: e, reopenTutorial: t, section: n = "", diagnostics: r }) {
	let i = X({
		queryKey: g,
		queryFn: ({ signal: e }) => dt(e)
	}), a = i.data;
	return a ? /* @__PURE__ */ (0, Q.jsx)(el, {
		data: a,
		receipt: e,
		reopenTutorial: t,
		section: n,
		diagnostics: r,
		refreshing: i.isFetching,
		reload: () => {
			i.refetch({ cancelRefetch: !1 });
		}
	}) : /* @__PURE__ */ (0, Q.jsx)("div", {
		className: "ui-configpage",
		children: /* @__PURE__ */ (0, Q.jsx)(N, {
			tone: "error",
			title: J("settings:configurationPage.loadFailedTitle"),
			children: i.error ? K(i.error) : J("settings:configurationPage.loadFailed")
		})
	});
}
function Qc({ data: e, sections: t, reload: n, refreshing: r }) {
	return /* @__PURE__ */ (0, Q.jsx)(Q.Fragment, { children: t.map((t) => {
		let i = e.section_errors?.[t];
		return i ? /* @__PURE__ */ (0, Q.jsx)(N, {
			tone: "error",
			title: i.title,
			action: /* @__PURE__ */ (0, Q.jsx)(f, {
				variant: "secondary",
				size: "small",
				onClick: n,
				...W(r),
				children: J("settings:shared.reload")
			}),
			children: i.message
		}, t) : null;
	}) });
}
var $c = 0;
function el({ data: e, receipt: t, reopenTutorial: n, section: r, diagnostics: i, reload: a, refreshing: o }) {
	let [s] = (0, Z.useState)(() => `board-tabs-${++$c}`), [c, l] = (0, Z.useState)(r), u = (0, Z.useRef)(null), d = (0, Z.useRef)(c);
	(0, Z.useEffect)(() => {
		l(r);
	}, [r]), (0, Z.useEffect)(() => {
		let t = Jc(e);
		t && Rt("downloads", t), Rt("network", Yc(e)), Rt("maintenance", Xc(e));
	}, [e]), (0, Z.useLayoutEffect)(() => {
		if (d.current === c) return;
		d.current = c;
		let e = u.current?.querySelector(".ui-board-local-nav"), t = u.current?.querySelector(".ui-board-group-active");
		if (!e || !t) return;
		let n = parseFloat(getComputedStyle(e).top);
		if (!Number.isFinite(n) || e.getBoundingClientRect().top > n + 1) return;
		let r = matchMedia("(max-width:900px)").matches ? e.getBoundingClientRect().bottom + 8 : n;
		window.scrollTo(0, Math.max(0, window.scrollY + t.getBoundingClientRect().top - r));
	}, [c]);
	let f = (e) => {
		l(e), Yt(Jt(e), {
			replace: !0,
			state: jt.navigation.location.state
		});
	}, [p, m] = (0, Z.useState)(() => matchMedia("(max-width:900px)").matches);
	(0, Z.useEffect)(() => {
		let e = matchMedia("(max-width:900px)"), t = () => m(e.matches);
		return e.addEventListener("change", t), () => e.removeEventListener("change", t);
	}, []);
	let h = {
		data: e,
		receipt: t
	}, g = (t) => /* @__PURE__ */ (0, Q.jsx)(Qc, {
		data: e,
		sections: t,
		reload: a,
		refreshing: o
	}), v = [
		"peach_proxy",
		"access",
		"tunnel",
		"push_discovery",
		...e.editable && e.port_editable !== !1 ? ["media_sources"] : []
	], y = !!(e.peach_proxy || e.access || e.tunnel || e.editable && e.port_editable !== !1 || v.some((t) => e.section_errors?.[t])), b = e.downloads, x = [
		{
			id: "library",
			title: _.library,
			body: (n) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				...Rr(n),
				children: [
					g([
						"media_sources",
						"library_count",
						"mount_dependencies"
					]),
					!e.section_errors?.media_sources && !e.section_errors?.library_count ? /* @__PURE__ */ (0, Q.jsx)(xs, { ...h }) : null,
					/* @__PURE__ */ (0, Q.jsx)(Vs, { receipt: t }),
					/* @__PURE__ */ (0, Q.jsx)(Ns, { receipt: t }),
					/* @__PURE__ */ (0, Q.jsx)(Ds, { receipt: t })
				]
			})
		},
		{
			id: "sources",
			title: _.subscriptions,
			body: (e) => /* @__PURE__ */ (0, Q.jsx)(qc, {
				...h,
				panel: e,
				issues: g(["entry_links"])
			})
		},
		...b || e.section_errors?.downloads ? [{
			id: "downloads",
			title: _.downloads,
			body: (e) => /* @__PURE__ */ (0, Q.jsx)(ni, {
				initial: b,
				receipt: t,
				panel: e,
				issues: g(["downloads"])
			})
		}] : [],
		...y ? [{
			id: "network",
			title: _.network,
			body: (e) => /* @__PURE__ */ (0, Q.jsx)(Cc, {
				...h,
				panel: e,
				issues: g(v)
			})
		}] : [],
		{
			id: "maintenance",
			title: _.maintenance,
			body: (e) => /* @__PURE__ */ (0, Q.jsxs)("div", {
				...Rr(e),
				children: [
					g([
						"startup",
						"uninstall",
						"storage",
						"remote_reporting",
						"library_sharing",
						"updates",
						"update_job",
						"automatic_updates",
						"facts"
					]),
					/* @__PURE__ */ (0, Q.jsx)(Bo, { ...h }),
					/* @__PURE__ */ (0, Q.jsx)(Fs, { receipt: t }),
					/* @__PURE__ */ (0, Q.jsx)(vo, {
						...h,
						reopenTutorial: n
					})
				]
			})
		},
		{
			id: "diagnostics",
			title: _.diagnostics,
			body: (e) => /* @__PURE__ */ (0, Q.jsx)("div", {
				...Rr(e),
				children: e.active ? i : null
			})
		}
	], S = Math.max(0, x.findIndex((e) => e.title === Wt(c)));
	return /* @__PURE__ */ (0, Q.jsxs)("div", {
		ref: u,
		className: "ui-configpage",
		children: [/* @__PURE__ */ (0, Q.jsx)("div", {
			className: "ui-board-local-nav",
			"data-section-nav": "",
			children: /* @__PURE__ */ (0, Q.jsx)(Re, {
				group: "configuration",
				label: J("settings:configurationPage.sectionsLabel"),
				value: x[S].id,
				tabs: x.map(({ id: e, title: t }) => ({
					value: e,
					label: t
				})),
				sectionItems: !0,
				panelPrefix: s,
				orientation: p ? "horizontal" : "vertical",
				className: "",
				onChange: (e) => f(x.find((t) => t.id === e).title)
			})
		}), x.map(({ id: e, title: t, body: n }, r) => /* @__PURE__ */ (0, Q.jsxs)(Z.Fragment, { children: [/* @__PURE__ */ (0, Q.jsx)("h2", {
			className: "ui-configgroup",
			children: t
		}), n({
			index: r,
			id: `${s}-panel-${e}`,
			labelledBy: `${s}-tab-${e}`,
			active: r === S
		})] }, t))]
	});
}
export { Zc as ConfigurationPage };

//# debugId=db02cb9d-45be-45e9-a14a-4e1830228f9d