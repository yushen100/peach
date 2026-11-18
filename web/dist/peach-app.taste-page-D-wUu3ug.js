(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "39dc6c95-e93d-48d3-b936-524cdaf5b11b", e._sentryDebugIdIdentifier = "sentry-dbid-39dc6c95-e93d-48d3-b936-524cdaf5b11b");
	} catch {}
})();
import { $542a13ca2fa5b484$export$5b6b19405a83ff9d as e, $b4f18e3395fe64d7$export$3d96ec278d3efce4 as t, $b4f18e3395fe64d7$export$3e41faf802a29e71 as n, $b4f18e3395fe64d7$export$b2539bed5023c21c as r, Button as i, ButtonLink as a, Disclosure as o, E3 as s, EmptyState as c, FLOW_LABEL_X as l, FLOW_VIEWBOX as u, Gg as d, Input as f, LEGACY_AVATAR_IMG as p, M6 as m, MENU_ITEM as h, MENU_ITEM_INTERACTIVE as g, MENU_POPOVER_SURFACE as _, MenuDialog as v, Note as y, OV as b, Progress as x, Rf as S, SEGMENT as C, SEGMENTED_TRACK as w, STAT_STRIP as T, SegmentedTabList as ee, Select$1 as te, SelectItem as ne, StatCard as E, TASTE_REFRESH_KEY as re, TASTE_REFRESH_TASK as ie, TASTE_WINDOWS as ae, TaskProgress as oe, Wt as D, Xt as se, _8 as ce, __toESM as le, aB as ue, activityKind as de, avatarInner as O, busyProps as k, cB as fe, cardClass as A, clsx as j, codedText as M, configureTasteBrowser as pe, confirmModal as N, cx as me, errorMessage as P, f1 as he, fetchTaste as ge, fetchTasteJob as _e, firstGrapheme as ve, flowGraph as ye, flowLabel as be, fmtSize as xe, g4 as Se, historySpan as Ce, importTasteExport as we, jobText as Te, joinList as Ee, keepPreviousData as De, mM as Oe, pv as ke, queryClient as F, r2 as Ae, radarRows as je, rankDetail as Me, rankShares as Ne, removeTasteSource as Pe, require_jsx_runtime as Fe, require_react as Ie, serverLabel as Le, serverLabelList as Re, siteMarkUrl as ze, startTasteRefresh as Be, statCardClass as Ve, t as I, tasteDate as He, tasteDimensions as Ue, tasteHours as We, tasteKey as L, tasteRefetchInterval as Ge, tasteTime as Ke, topScores as qe, uo as Je, useBackgroundJob as Ye, useMutation as Xe, useQuery as Ze } from "./peach-app.js";
import { ActivityHeat as Qe, BAR_DOMAIN as $e, ExpandableRanking as et, PolarAngleAxis as tt, Polygon as nt, barLabel as rt, selectPolarAngleAxisTicks as it, selectPolarAxisScale as at, selectPolarAxisTicks as ot } from "./peach-app.expandable-ranking-CFsyhiRc.js";
import { Page as st } from "./peach-app.page-QAncjzM1.js";
import { ActivePoints as ct, AnimatedItems as lt, CHART_CARD as ut, CHART_COLORS as dt, CartesianLabelListContextProvider as ft, CategoryTick as pt, ChartBackground as mt, ChartContainer as ht, ChartHead as gt, ChartLegend as _t, ChartLegendContent as vt, ChartTip as yt, ChartTooltip as bt, ChartTooltipContent as xt, DataLabelColorsContextProvider as St, DataLabelThemeContextProvider as Ct, DefaultZIndexes as wt, Dots as Tt, EvilBarChart as Et, FillObjectDefinition as Dt, LabelListFromLabelProp as Ot, Layer as kt, LoadingIndicator as At, PolarChart as jt, PolarLabelContextProvider as Mt, PolarLabelFromLabelProp as Nt, RegisterGraphicalItemId as Pt, SetPolarGraphicalItem as Ft, SetPolarLegendPayload as It, SetTooltipEntrySettings as Lt, Text as Rt, ZIndexLayer as zt, adaptEventsOfChild as Bt, addRadiusAxis as Vt, arrayTooltipSearcher as Ht, categoryAxisWidth as Ut, cn as Wt, createSelector as R, defaultPolarChartProps as Gt, defaultPolarRadiusAxisProps as Kt, fitLabel as qt, getAxisTypeBasedOnLayout as Jt, getBandSizeOfAxis as Yt, getClassNameFromUnknown as Xt, getColorsCount as Zt, getDotSymbol as Qt, getFillUrl as $t, getLegendPayloadDot as en, getPercentValue as tn, getSeriesFillId as nn, getTooltipNameProp as rn, getValueByDataKey as an, identity as on, interpolate as sn, isArrayLike as cn, isCategoricalAxis as ln, isNullish as un, iteratee as dn, matchAnimationItems as fn, matchByIndex as pn, noop as mn, polarToCartesian as z, removeRadiusAxis as hn, resolveDefaultProps as gn, selectAngleAxis as _n, selectAngleAxisRangeWithReversed as vn, selectChartDataAndAlwaysIgnoreIndexes as yn, selectChartLayout as bn, selectPolarViewBox as xn, selectRadiusAxis as Sn, selectUnfilteredPolarItems as Cn, splitFill as wn, svgPropertiesAndEvents as Tn, svgPropertiesNoEvents as B, svgPropertiesNoEventsFromUnknown as En, tone as Dn, useAnimationCallbacks as On, useAnimationStartSnapshot as kn, useAppDispatch as An, useAppSelector as V, useBackwardsCompatibleTheme as jn, useEffectiveDataKey as Mn, useFillPaint as Nn, useGraphicalItemIdentity as Pn, useGraphicalItemThemeFill as Fn, useIsPanorama as In, usePolarChartLayout as Ln, useRechartsTheme as Rn, useSeriesDataLabelColors as zn, useSeriesLabelThemeResolver as Bn, useThemeFillObject as Vn, useThemedActiveStyles as Hn, useUnthemedColors as Un, withFillColor as Wn } from "./peach-app.chart-tip-BdEMpPYU.js";
import { BrowserIcon as Gn } from "./peach-app.browser-icon-N9Od-bAf.js";
var Kn = R([(e, t) => it(e, "angleAxis", t, !1)], (e) => {
	if (e) return e.map((e) => e.coordinate);
}), qn = R([(e, t) => ot(e, "radiusAxis", t, !1)], (e) => {
	if (e) return e.map((e) => e.coordinate);
}), H = /* @__PURE__ */ le(Ie()), Jn = [
	"gridType",
	"radialLines",
	"angleAxisId",
	"radiusAxisId",
	"cx",
	"cy",
	"innerRadius",
	"outerRadius",
	"polarAngles",
	"polarRadius",
	"zIndex"
];
function Yn(e, t) {
	if (e == null) return {};
	var n, r, i = Xn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Xn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function U() {
	return U = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, U.apply(null, arguments);
}
function Zn(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function W(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Zn(Object(n), !0).forEach(function(t) {
			Qn(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Zn(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Qn(e, t, n) {
	return (t = $n(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function $n(e) {
	var t = er(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function er(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var tr = (e, t, n, r) => {
	var i = "";
	return r.forEach((r, a) => {
		var o = z(t, n, e, r);
		i += a ? `L ${o.x},${o.y}` : `M ${o.x},${o.y}`;
	}), i += "Z", i;
}, nr = (e) => {
	var t = e.cx, n = e.cy, r = e.innerRadius, i = e.outerRadius, a = e.polarAngles, o = e.radialLines;
	if (!a || !a.length || !o) return null;
	var s = W({}, B(e));
	return /*#__PURE__*/ H.createElement("g", { className: "recharts-polar-grid-angle" }, a.map((e) => {
		var a = z(t, n, r, e), o = z(t, n, i, e);
		return /*#__PURE__*/ H.createElement("line", U({ key: `line-${e}` }, s, {
			x1: a.x,
			y1: a.y,
			x2: o.x,
			y2: o.y
		}));
	}));
}, rr = (e) => {
	var t = e.cx, n = e.cy, r = e.radius, i = W({}, B(e));
	return /*#__PURE__*/ H.createElement("circle", U({}, i, {
		className: j("recharts-polar-grid-concentric-circle", e.className),
		cx: t,
		cy: n,
		r
	}));
}, ir = (e) => {
	var t = e.radius, n = W({}, B(e));
	return /*#__PURE__*/ H.createElement("path", U({}, n, {
		className: j("recharts-polar-grid-concentric-polygon", e.className),
		d: tr(t, e.cx, e.cy, e.polarAngles)
	}));
}, ar = (e) => {
	var t = e.polarRadius, n = e.gridType;
	if (!t || !t.length) return null;
	var r = Math.max(...t), i = e.fill && e.fill !== "none";
	return /*#__PURE__*/ H.createElement("g", { className: "recharts-polar-grid-concentric" }, i && n === "circle" && /*#__PURE__*/ H.createElement(rr, U({}, e, { radius: r })), i && n !== "circle" && /*#__PURE__*/ H.createElement(ir, U({}, e, { radius: r })), t.map((t, r) => {
		var i = r;
		return n === "circle" ? /*#__PURE__*/ H.createElement(rr, U({ key: i }, e, {
			fill: "none",
			radius: t
		})) : /*#__PURE__*/ H.createElement(ir, U({ key: i }, e, {
			fill: "none",
			radius: t
		}));
	}));
}, or = {
	stroke: "#ccc",
	strokeWidth: 1,
	fill: "none"
}, sr = {
	angleAxisId: 0,
	radiusAxisId: 0,
	gridType: "polygon",
	radialLines: !0,
	zIndex: wt.grid
}, cr = (e) => {
	var t = W(W({}, e), {}, { fill: wn(e.fill).color }), n = jn((e) => Wn(e.grid), t, or), r = Vn((e) => e.grid), i = Nn(e.fill ?? r, n.fill, "recharts-polar-grid-fill"), a = W(W(W({}, t), n), {}, { fill: i.paint }), o = gn(a, sr), s = o.gridType, c = o.radialLines, l = o.angleAxisId, u = o.radiusAxisId, d = o.cx, f = o.cy, p = o.innerRadius, m = o.outerRadius, h = o.polarAngles, g = o.polarRadius, _ = o.zIndex, v = Yn(o, Jn), y = V(xn), b = V((e) => Kn(e, l)), x = V((e) => qn(e, u)), S = Array.isArray(h) ? h : b, C = Array.isArray(g) ? g : x;
	if (S == null || C == null) return null;
	var w = y?.outerRadius ?? m ?? 0;
	if (w <= 0) return null;
	var T = C.map((e) => tn(e, w)), ee = W({
		cx: y?.cx ?? d ?? 0,
		cy: y?.cy ?? f ?? 0,
		innerRadius: y?.innerRadius ?? p ?? 0,
		outerRadius: w,
		polarAngles: S,
		polarRadius: T,
		zIndex: _
	}, v);
	return /*#__PURE__*/ H.createElement(zt, { zIndex: ee.zIndex }, /*#__PURE__*/ H.createElement("g", { className: "recharts-polar-grid" }, i.definition != null && /*#__PURE__*/ H.createElement("defs", null, i.definition), /*#__PURE__*/ H.createElement(ar, U({
		gridType: s,
		radialLines: c
	}, ee, {
		polarAngles: S,
		polarRadius: T
	})), /*#__PURE__*/ H.createElement(nr, U({
		gridType: s,
		radialLines: c
	}, ee, {
		polarAngles: S,
		polarRadius: T
	}))));
};
cr.displayName = "PolarGrid";
// node_modules/es-toolkit/dist/compat/_internal/toArray.mjs
function lr(e) {
	return Array.isArray(e) ? e : Array.from(e);
}
// node_modules/es-toolkit/dist/compat/math/maxBy.mjs
function ur(e, t = on) {
	if (e == null) return;
	let n = lr(e);
	if (n.length === 0) return;
	let r = dn(t), i, a;
	for (let e = 0; e < n.length; e++) {
		let t = n[e], o = r(t, e, n);
		o == null || Number.isNaN(o) || typeof o == "symbol" || (a === void 0 || o > a) && (a = o, i = t);
	}
	return i;
}
// node_modules/es-toolkit/dist/compat/math/minBy.mjs
function dr(e, t = on) {
	if (e == null) return;
	let n = lr(e);
	if (n.length === 0) return;
	let r = dn(t), i, a;
	for (let e = 0; e < n.length; e++) {
		let t = n[e], o = r(t, e, n);
		o == null || Number.isNaN(o) || typeof o == "symbol" || (a === void 0 || o < a) && (a = o, i = t);
	}
	return i;
}
// node_modules/recharts/es6/polar/PolarRadiusAxis.js
var fr = ["type"], pr = [
	"cx",
	"cy",
	"angle",
	"axisLine"
], mr = [
	"angle",
	"tickFormatter",
	"stroke",
	"tick"
];
function G() {
	return G = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, G.apply(null, arguments);
}
function hr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function K(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? hr(Object(n), !0).forEach(function(t) {
			gr(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : hr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function gr(e, t, n) {
	return (t = _r(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function _r(e) {
	var t = vr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function vr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function yr(e, t) {
	if (e == null) return {};
	var n, r, i = br(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function br(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var xr = "radiusAxis", Sr = { stroke: "#ccc" };
function Cr(e) {
	var t = An(), n = Ln(), r = (0, H.useMemo)(() => {
		var t = e.type, r = yr(e, fr), i = Jt(n, "radiusAxis", t);
		if (i != null) return K(K({}, r), {}, { type: i });
	}, [e, n]);
	return (0, H.useEffect)(() => r == null ? mn : (t(Vt(r)), () => {
		t(hn(r));
	}), [t, r]), null;
}
var wr = (e, t, n, r) => {
	var i = e.coordinate;
	return z(n, r, i, t);
}, Tr = (e) => {
	var t;
	switch (e) {
		case "left":
			t = "end";
			break;
		case "right":
			t = "start";
			break;
		default: t = "middle";
	}
	return t;
}, Er = (e, t, n, r) => {
	var i = ur(r, (e) => e.coordinate || 0);
	return {
		cx: t,
		cy: n,
		startAngle: e,
		endAngle: e,
		innerRadius: dr(r, (e) => e.coordinate || 0)?.coordinate || 0,
		outerRadius: i?.coordinate || 0,
		clockWise: !1
	};
}, Dr = (e, t) => {
	var n = e.cx, r = e.cy, i = e.angle, a = e.axisLine, o = yr(e, pr), s = t.reduce((e, t) => [Math.min(e[0], t.coordinate), Math.max(e[1], t.coordinate)], [Infinity, -Infinity]), c = z(n, r, s[0], i), l = z(n, r, s[1], i), u = K(K(K({}, B(o)), {}, { fill: "none" }, B(a)), {}, {
		x1: c.x,
		y1: c.y,
		x2: l.x,
		y2: l.y
	});
	return /*#__PURE__*/ H.createElement("line", G({ className: "recharts-polar-radius-axis-line" }, u));
}, Or = (e, t, n) => /*#__PURE__*/ H.isValidElement(e) ? /*#__PURE__*/ H.cloneElement(e, t) : typeof e == "function" ? e(t) : /*#__PURE__*/ H.createElement(Rt, G({}, t, { className: "recharts-polar-radius-axis-tick-value" }), n), kr = (e, t) => {
	var n = e.angle, r = e.tickFormatter, i = e.stroke, a = e.tick, o = yr(e, mr), s = Tr(e.orientation), c = B(o), l = En(a), u = t.map((t, o) => {
		var u = wr(t, e.angle, e.cx, e.cy), d = K(K(K(K({
			textAnchor: s,
			transform: `rotate(${90 - n}, ${u.x}, ${u.y})`
		}, c), {}, {
			stroke: "none",
			fill: i
		}, l), {}, { index: o }, u), {}, { payload: t });
		return /*#__PURE__*/ H.createElement(kt, G({
			className: j("recharts-polar-radius-axis-tick", Xt(a)),
			key: `tick-${t.coordinate}`
		}, Bt(e, t, o)), Or(a, d, r ? r(t.value, o) : t.value));
	});
	return /*#__PURE__*/ H.createElement(kt, { className: "recharts-polar-radius-axis-ticks" }, u);
}, Ar = (e) => {
	var t = e.radiusAxisId, n = jn((e) => e.axis, {
		stroke: e.stroke,
		strokeWidth: e.strokeWidth,
		strokeOpacity: e.strokeOpacity,
		strokeDasharray: e.strokeDasharray
	}, Sr), r = V(xn), i = V((e) => at(e, "radiusAxis", t)), a = V((e) => ot(e, "radiusAxis", t, !1));
	if (r == null || !a || !a.length || i == null) return null;
	var o = K(K(K({}, e), n), {}, { scale: i }, r), s = o.tick, c = o.axisLine;
	return /*#__PURE__*/ H.createElement(zt, { zIndex: o.zIndex }, /*#__PURE__*/ H.createElement(kt, { className: j("recharts-polar-radius-axis", xr, o.className) }, c && Dr(o, a), s && kr(o, a), /*#__PURE__*/ H.createElement(Mt, Er(o.angle, o.cx, o.cy, a), /*#__PURE__*/ H.createElement(Nt, { label: o.label }), o.children)));
};
function jr(e) {
	var t = gn(e, Kt);
	return /*#__PURE__*/ H.createElement(H.Fragment, null, /*#__PURE__*/ H.createElement(Cr, {
		domain: t.domain,
		id: t.radiusAxisId,
		scale: t.scale,
		type: t.type,
		dataKey: t.dataKey,
		unit: void 0,
		name: t.name,
		allowDuplicatedCategory: t.allowDuplicatedCategory,
		allowDataOverflow: t.allowDataOverflow,
		reversed: t.reversed,
		includeHidden: t.includeHidden,
		allowDecimals: t.allowDecimals,
		niceTicks: t.niceTicks ?? "auto",
		ticks: t.ticks,
		tickCount: t.tickCount,
		tick: t.tick
	}), /*#__PURE__*/ H.createElement(Ar, t));
}
jr.displayName = "PolarRadiusAxis";
// node_modules/es-toolkit/dist/array/last.mjs
function Mr(e) {
	return e[e.length - 1];
}
// node_modules/es-toolkit/dist/compat/array/last.mjs
function Nr(e) {
	if (cn(e) && e.length !== 0) return Mr(lr(e));
}
// node_modules/recharts/es6/state/selectors/radarSelectors.js
function Pr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Fr(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Pr(Object(n), !0).forEach(function(t) {
			Ir(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Pr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Ir(e, t, n) {
	return (t = Lr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Lr(e) {
	var t = Rr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Rr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var zr = (e, t) => at(e, "radiusAxis", t), Br = R([zr], (e) => {
	if (e != null) return { scale: e };
}), Vr = R([Sn, zr], (e, t) => {
	if (e != null && t != null) return Fr(Fr({}, e), {}, { scale: t });
}), Hr = (e, t, n, r) => ot(e, "radiusAxis", t, r), Ur = (e, t, n) => _n(e, n), Wr = (e, t, n) => at(e, "angleAxis", n), Gr = R([Ur, Wr], (e, t) => {
	if (e != null && t != null) return Fr(Fr({}, e), {}, { scale: t });
}), Kr = (e, t, n, r) => ot(e, "angleAxis", n, r), qr = R([
	Ur,
	Wr,
	xn,
	(e, t, n) => vn(e, n)
], (e, t, n, r) => {
	if (n != null && t != null && r != null) return {
		scale: t,
		type: e.type,
		dataKey: e.dataKey,
		cx: n.cx,
		cy: n.cy,
		range: r
	};
}), Jr = (e, t, n, r, i) => i, Yr = R([
	bn,
	Vr,
	Hr,
	Gr,
	Kr
], (e, t, n, r, i) => ln(e, "radiusAxis") ? Yt(t, n, !1) : Yt(r, i, !1)), Xr = R([Cn, Jr], (e, t) => {
	if (e != null) return e.find((e) => e.type === "radar" && t === e.id)?.dataKey;
}), Zr = R([
	Br,
	qr,
	yn,
	Xr,
	Yr
], (e, t, n, r, i) => {
	var a = n.chartData, o = n.dataStartIndex, s = n.dataEndIndex;
	if (e != null && t != null && a != null && i != null && r != null) return li({
		radiusAxis: e,
		angleAxis: t,
		displayedData: a.slice(o, s + 1),
		dataKey: r,
		bandSize: i
	});
}), Qr = [
	"id",
	"dotFill",
	"unthemedColors"
], $r = [
	"shape",
	"isRange",
	"connectNulls",
	"dotFill",
	"fillObject"
];
function q() {
	return q = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, q.apply(null, arguments);
}
function ei(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function J(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? ei(Object(n), !0).forEach(function(t) {
			ti(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : ei(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ti(e, t, n) {
	return (t = ni(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function ni(e) {
	var t = ri(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function ri(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function ii(e, t) {
	if (e == null) return {};
	var n, r, i = ai(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function ai(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function Y(e, t) {
	return e && e !== "none" ? e : t;
}
var oi = (e, t, n) => {
	var r = e.dataKey, i = e.name, a = e.stroke, o = e.fill, s = e.legendType, c = e.hide, l = e.dot;
	return [{
		inactive: c,
		dataKey: r,
		type: s,
		dot: en(l, {
			fill: t ?? o,
			stroke: a
		}, !1),
		color: Y(a, o),
		fill: n,
		value: rn(i, r),
		payload: e
	}];
}, si = /*#__PURE__*/ H.memo((e) => {
	var t = e.dataKey, n = e.stroke, r = e.strokeWidth, i = e.fill, a = e.name, o = e.hide, s = e.tooltipType, c = e.id, l = {
		dataDefinedOnItem: void 0,
		getPosition: mn,
		settings: {
			stroke: n,
			strokeWidth: r,
			fill: i,
			nameKey: void 0,
			dataKey: t,
			name: rn(a, t),
			hide: o,
			type: s,
			color: Y(n, i),
			unit: "",
			graphicalItemId: c,
			ignoreDataEntryColors: !0
		}
	};
	return /*#__PURE__*/ H.createElement(Lt, { tooltipEntrySettings: l });
});
function ci(e) {
	var t = e.points, n = e.props, r = n.dot, i = n.dataKey;
	n.id;
	var a = n.dotFill, o = n.unthemedColors, s = ii(n, Qr), c = B(s);
	return /*#__PURE__*/ H.createElement(Tt, {
		points: t,
		dot: r,
		className: "recharts-radar-dots",
		dotClassName: "recharts-radar-dot",
		dataKey: i,
		baseProps: J(J({}, c), {}, { fill: a ?? c.fill }),
		unthemedColors: o
	});
}
function li(e) {
	var t = e.radiusAxis, n = e.angleAxis, r = e.displayedData, i = e.dataKey, a = e.bandSize, o = n.cx, s = n.cy, c = !1, l = [], u = n.range[0] > n.range[1], d = n.type !== "number" && u ? a ?? 0 : 0;
	r.forEach((e, r) => {
		var a = an(e, n.dataKey, r), u = an(e, i), f = (n.scale.map(a) ?? 0) + d, p = Array.isArray(u) ? Nr(u) : u, m = un(p) ? NaN : t.scale.map(p) ?? 0;
		Array.isArray(u) && u.length >= 2 && (c = !0), l.push(J(J({}, z(o, s, m, f)), {}, {
			name: a,
			value: u,
			cx: o,
			cy: s,
			radius: m,
			angle: f,
			payload: e
		}));
	});
	var f = [];
	return c && l.forEach((e) => {
		if (Array.isArray(e.value)) {
			var n = e.value[0], r = un(n) ? NaN : t.scale.map(n) ?? 0;
			f.push(J(J({}, e), {}, { radius: r }, z(o, s, r, e.angle)));
		} else f.push(e);
	}), {
		points: l,
		isRange: c,
		baseLinePoints: f
	};
}
function ui(e) {
	var t = e.showLabels, n = e.points, r = e.children, i = n.map((e) => {
		var t = {
			x: e.x,
			y: e.y,
			width: 0,
			lowerWidth: 0,
			upperWidth: 0,
			height: 0
		};
		return J(J({}, t), {}, {
			value: e.value ?? "",
			payload: e.payload,
			parentViewBox: void 0,
			viewBox: t,
			fill: void 0
		});
	});
	return /*#__PURE__*/ H.createElement(ft, { value: t ? i : void 0 }, r);
}
function di(e) {
	var t = e.points, n = e.baseLinePoints, r = e.props;
	if (t == null) return null;
	var i = r.shape, a = r.isRange, o = r.connectNulls;
	r.dotFill;
	var s = r.fillObject, c = ii(r, $r), l = s == null ? r.fill : $t(nn(r.id)), u = /*#__PURE__*/ H.isValidElement(i) ? /*#__PURE__*/ H.cloneElement(i, J(J({}, c), {}, {
		fill: l,
		points: t
	})) : typeof i == "function" ? i(J(J({}, c), {}, {
		fill: l,
		points: t
	})) : /*#__PURE__*/ H.createElement(nt, q({}, Tn(r), {
		fill: l,
		onMouseEnter: (e) => {
			var t = r.onMouseEnter;
			t && t(r, e);
		},
		onMouseLeave: (e) => {
			var t = r.onMouseLeave;
			t && t(r, e);
		},
		points: t,
		baseLinePoints: a ? n : void 0,
		connectNulls: o
	}));
	return /*#__PURE__*/ H.createElement(kt, { className: "recharts-radar-polygon" }, u, /*#__PURE__*/ H.createElement(ci, {
		props: r,
		points: t
	}));
}
var fi = (e, t) => e == null ? [] : t === 1 ? e.flatMap((e) => e.status === "removed" ? [] : [e.next]) : e.flatMap((e) => e.status === "removed" ? [] : e.status === "matched" ? [J(J({}, e.next), {}, {
	x: sn(e.prev.x, e.next.x, t),
	y: sn(e.prev.y, e.next.y, t)
})] : [J(J({}, e.next), {}, {
	x: sn(e.next.cx, e.next.x, t),
	y: sn(e.next.cy, e.next.y, t)
})]);
function pi(e) {
	var t = e.props, n = e.previousPointsRef, r = e.previousBaseLinePointsRef, i = t.points, a = t.baseLinePoints, o = t.isAnimationActive, s = t.animationBegin, c = t.animationDuration, l = t.animationEasing, u = t.animationMatchBy, d = t.animationInterpolateFn, f = t.onAnimationStart, p = t.onAnimationEnd, m = kn(t, r), h = m.startValue, g = fn(h ?? null, a, u), _ = On(f, p), v = _.isAnimating, y = _.handleAnimationStart, b = _.handleAnimationEnd, x = Ln();
	return x == null ? null : /*#__PURE__*/ H.createElement(ui, {
		showLabels: !v,
		points: i
	}, /*#__PURE__*/ H.createElement(lt, {
		animationInput: t,
		animationIdPrefix: "recharts-radar-",
		items: i,
		previousItemsRef: n,
		isAnimationActive: o,
		animationBegin: s,
		animationDuration: c,
		animationEasing: l,
		onAnimationStart: y,
		onAnimationEnd: b,
		animationInterpolateFn: d,
		animationMatchBy: u,
		layout: x
	}, (e, n) => {
		var r = n === 1 ? a : d(g, n, x);
		return m.syncStepValue(r, n), /*#__PURE__*/ H.createElement(di, {
			points: e,
			baseLinePoints: r,
			props: t
		});
	}), /*#__PURE__*/ H.createElement(Ot, { label: t.label }), t.children);
}
function mi(e) {
	var t = (0, H.useRef)(void 0), n = (0, H.useRef)(void 0);
	return /*#__PURE__*/ H.createElement(pi, {
		props: e,
		previousPointsRef: t,
		previousBaseLinePointsRef: n
	});
}
var hi = {
	activeDot: !0,
	angleAxisId: 0,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationMatchBy: pn,
	animationInterpolateFn: fi,
	dot: !1,
	hide: !1,
	isAnimationActive: "auto",
	label: !1,
	legendType: "rect",
	radiusAxisId: 0,
	zIndex: wt.area
};
function gi(e) {
	var t = e.hide, n = e.className, r = e.points;
	if (t) return null;
	var i = j("recharts-radar", n);
	return /*#__PURE__*/ H.createElement(zt, { zIndex: e.zIndex }, /*#__PURE__*/ H.createElement(kt, { className: i }, e.fillObject != null && /*#__PURE__*/ H.createElement("defs", null, /*#__PURE__*/ H.createElement(Dt, {
		id: nn(e.id),
		fillObject: e.fillObject,
		color: e.fill
	})), /*#__PURE__*/ H.createElement(mi, e)), /*#__PURE__*/ H.createElement(ct, {
		points: r,
		mainColor: Y(e.stroke, e.fill),
		itemDataKey: e.dataKey,
		activeDot: e.activeDot,
		themedActiveStyles: e.themedActiveStyles
	}));
}
function _i(e) {
	var t = In(), n = V((n) => Zr(n, e.radiusAxisId, e.angleAxisId, t, e.id));
	return n?.points == null ? null : /*#__PURE__*/ H.createElement(gi, q({}, e, {
		points: n?.points,
		baseLinePoints: n?.baseLinePoints,
		isRange: n?.isRange
	}));
}
function vi(e) {
	var t = wn(e.fill), n = t.color, r = t.fillObject, i = J(J({}, e), {}, { fill: n }), a = Rn(), o = Mn({
		dataKey: i.dataKey,
		angleAxisId: i.angleAxisId ?? hi.angleAxisId,
		radiusAxisId: i.radiusAxisId ?? hi.radiusAxisId
	}), s = Pn(o, i), c = Fn(o, i), l = r ?? c, u = Bn(s), d = jn(s, i, void 0), f = d?.strokeDasharray, p = Un(i), m = Hn(s, i), h = J(J({}, i), {}, {
		dataKey: o,
		activeDot: i.activeDot,
		legendType: i.legendType ?? Qt(i.dot),
		fill: i.fill ?? d?.fill,
		fillOpacity: i.fillOpacity ?? d?.fillOpacity,
		stroke: i.stroke ?? d?.stroke,
		strokeOpacity: i.strokeOpacity ?? d?.strokeOpacity,
		strokeWidth: i.strokeWidth ?? d?.strokeWidth,
		strokeDasharray: i.strokeDasharray ?? (Array.isArray(f) ? f.join(",") : f)
	}), g = gn(h, hi), _ = i.fill ?? (a == null ? g.fill : Y(g.stroke, d?.fill)), v = zn(Y(g.stroke, g.fill));
	return /*#__PURE__*/ H.createElement(Pt, {
		id: g.id,
		type: "radar"
	}, (e) => /*#__PURE__*/ H.createElement(H.Fragment, null, /*#__PURE__*/ H.createElement(Ft, {
		type: "radar",
		id: e,
		data: void 0,
		dataKey: g.dataKey,
		hide: g.hide,
		angleAxisId: g.angleAxisId,
		radiusAxisId: g.radiusAxisId
	}), /*#__PURE__*/ H.createElement(It, { legendPayload: oi(g, _, l) }), /*#__PURE__*/ H.createElement(si, {
		dataKey: g.dataKey,
		stroke: g.stroke,
		strokeWidth: g.strokeWidth,
		fill: g.fill,
		name: g.name,
		hide: g.hide,
		tooltipType: g.tooltipType,
		id: e
	}), /*#__PURE__*/ H.createElement(Ct, { value: u }, /*#__PURE__*/ H.createElement(St, { value: v }, /*#__PURE__*/ H.createElement(_i, q({}, g, {
		id: e,
		dotFill: _,
		fillObject: l,
		unthemedColors: p,
		themedActiveStyles: m
	}))))));
}
vi.displayName = "Radar";
// node_modules/recharts/es6/chart/RadarChart.js
function yi(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function bi(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? yi(Object(n), !0).forEach(function(t) {
			xi(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : yi(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function xi(e, t, n) {
	return (t = Si(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Si(e) {
	var t = Ci(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ci(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var wi = ["axis"], Ti = bi(bi({}, Gt), {}, {
	layout: "centric",
	startAngle: 90,
	endAngle: -270
}), Ei = /*#__PURE__*/ (0, H.forwardRef)((e, t) => {
	var n = gn(e, Ti);
	return /*#__PURE__*/ H.createElement(jt, {
		chartName: "RadarChart",
		defaultTooltipEventType: "axis",
		validateTooltipEventTypes: wi,
		tooltipPayloadSearcher: Ht,
		categoricalChartProps: n,
		ref: t
	});
}), X = Fe(), Di = H.memo(function({ cx: e, cy: t, dataKey: n, chartId: r, className: i, fillOpacity: a = 1, type: o = "default", maskId: s }) {
	let c = H.useId().replace(/:/g, ""), l = `url(#${r}-colors-${String(n)})`;
	if (e === void 0 || t === void 0) return null;
	switch (o) {
		case "border": return /* @__PURE__ */ (0, X.jsx)(ki, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
		case "colored-border": return /* @__PURE__ */ (0, X.jsx)(Ai, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
		default: return /* @__PURE__ */ (0, X.jsx)(Oi, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
	}
}), Oi = H.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
	className: a,
	mask: o ? `url(#${o})` : void 0,
	children: [/* @__PURE__ */ (0, X.jsx)("defs", { children: /* @__PURE__ */ (0, X.jsx)("clipPath", {
		id: `dot-clip-${n}`,
		children: /* @__PURE__ */ (0, X.jsx)("circle", {
			cx: e,
			cy: t,
			r: 3
		})
	}) }), /* @__PURE__ */ (0, X.jsx)("rect", {
		x: "0",
		y: t - 3,
		width: "100%",
		height: 6,
		fill: i,
		fillOpacity: r,
		clipPath: `url(#dot-clip-${n})`
	})]
}));
Oi.displayName = "DefaultDot";
var ki = H.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
	className: Wt(a, "text-background"),
	mask: o ? `url(#${o})` : void 0,
	children: [
		/* @__PURE__ */ (0, X.jsx)("defs", { children: /* @__PURE__ */ (0, X.jsx)("clipPath", {
			id: `dot-clip-${n}`,
			children: /* @__PURE__ */ (0, X.jsx)("circle", {
				cx: e,
				cy: t,
				r: 6
			})
		}) }),
		/* @__PURE__ */ (0, X.jsx)("circle", {
			cx: e,
			cy: t,
			r: 6,
			fill: "currentColor"
		}),
		/* @__PURE__ */ (0, X.jsx)("rect", {
			x: "0",
			y: t - (6 - 5 / 2),
			width: "100%",
			height: 7,
			fill: i,
			fillOpacity: r,
			clipPath: `url(#dot-clip-inner-${n})`
		}),
		/* @__PURE__ */ (0, X.jsx)("defs", { children: /* @__PURE__ */ (0, X.jsx)("clipPath", {
			id: `dot-clip-inner-${n}`,
			children: /* @__PURE__ */ (0, X.jsx)("circle", {
				cx: e,
				cy: t,
				r: 6 - 5 / 2
			})
		}) })
	]
}));
ki.displayName = "PrimaryBorderDot";
var Ai = H.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
	className: Wt(a, "text-background"),
	mask: o ? `url(#${o})` : void 0,
	children: [
		/* @__PURE__ */ (0, X.jsx)("defs", { children: /* @__PURE__ */ (0, X.jsx)("clipPath", {
			id: `dot-clip-${n}`,
			children: /* @__PURE__ */ (0, X.jsx)("circle", {
				cx: e,
				cy: t,
				r: 3.5
			})
		}) }),
		/* @__PURE__ */ (0, X.jsx)("rect", {
			x: "0",
			y: t - 3 - 1 / 2,
			width: "100%",
			height: 7,
			fill: i,
			fillOpacity: r,
			clipPath: `url(#dot-clip-${n})`
		}),
		/* @__PURE__ */ (0, X.jsx)("circle", {
			cx: e,
			cy: t,
			r: 3 - 1 / 2,
			fill: "currentColor"
		})
	]
}));
Ai.displayName = "ColoredBorderDot";
// src/react/evilcharts/registry/charts/recharts-radar-chart.tsx
var ji = 1, Mi = .3, Ni = 6, Pi = 1500, Fi = "value", Ii = (0, H.createContext)(null);
function Z() {
	let e = (0, H.use)(Ii);
	if (!e) throw Error("Radar chart parts (<Radar />, <PolarAngleAxis />, …) must be used within <EvilRadarChart />");
	return e;
}
function Q({ config: e, data: t, children: n, className: r, chartProps: i, backgroundVariant: a, defaultSelectedDataKey: o = null, onSelectionChange: s, isLoading: c = !1, loadingPoints: l }) {
	let u = (0, H.useId)().replace(/:/g, ""), [d, f] = (0, H.useState)(o), p = Qi(c, l), m = (0, H.useCallback)((e) => {
		f(e), s?.(e);
	}, [s]), h = (0, H.useMemo)(() => ({
		config: e,
		isLoading: c,
		selectedDataKey: d,
		selectDataKey: m
	}), [
		e,
		c,
		d,
		m
	]);
	return /* @__PURE__ */ (0, X.jsx)(Ii, {
		value: h,
		children: /* @__PURE__ */ (0, X.jsxs)(ht, {
			className: r,
			config: e,
			children: [/* @__PURE__ */ (0, X.jsx)(At, { isLoading: c }), /* @__PURE__ */ (0, X.jsxs)(Ei, {
				id: u,
				data: c ? p : t,
				...i,
				children: [
					a && /* @__PURE__ */ (0, X.jsx)(mt, { variant: a }),
					n,
					c && /* @__PURE__ */ (0, X.jsx)($i, {})
				]
			})]
		})
	});
}
function Li({ dataKey: e, variant: t = "filled", fillOpacity: n = Mi, isGlowing: r = !1, isClickable: i = !1, children: a, radarProps: o }) {
	let { config: s, isLoading: c, selectedDataKey: l, selectDataKey: u } = Z(), d = (0, H.useId)().replace(/:/g, "");
	if (c) return null;
	let f = i && l !== null && l !== e, p = {
		stroke: f ? .2 : 1,
		fill: f ? .1 : 1,
		dot: f ? .2 : 1
	}, m = t === "filled", { dot: h, activeDot: g } = Gi(a, d, e, p.dot);
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsx)(vi, {
		dataKey: e,
		stroke: `url(#${d}-radar-stroke-${e})`,
		strokeOpacity: p.stroke,
		strokeWidth: ji,
		fill: m ? `url(#${d}-radar-fill-${e})` : "none",
		fillOpacity: m ? n * p.fill : 0,
		dot: h,
		activeDot: g,
		filter: r ? `url(#${d}-radar-glow-${e})` : void 0,
		className: "transition-opacity duration-200",
		style: i ? { cursor: "pointer" } : void 0,
		onClick: () => {
			i && u(l === e ? null : e);
		},
		...o
	}), /* @__PURE__ */ (0, X.jsxs)("defs", { children: [
		/* @__PURE__ */ (0, X.jsx)(qi, {
			id: d,
			dataKey: e,
			config: s
		}),
		/* @__PURE__ */ (0, X.jsx)(Ji, {
			id: d,
			dataKey: e,
			config: s
		}),
		m && /* @__PURE__ */ (0, X.jsx)(Yi, {
			id: d,
			dataKey: e,
			config: s
		}),
		r && /* @__PURE__ */ (0, X.jsx)(Xi, {
			id: d,
			dataKey: e
		})
	] })] });
}
var Ri = () => null, zi = () => null;
function Bi({ gridType: e = "polygon", stroke: t = "currentColor", strokeOpacity: n = .2, strokeDasharray: r = "3 4", ...i }) {
	return /* @__PURE__ */ (0, X.jsx)(cr, {
		gridType: e,
		stroke: t,
		strokeOpacity: n,
		strokeDasharray: r,
		...i
	});
}
function Vi({ tick: e = {
	fill: "currentColor",
	fontSize: 12
}, tickLine: t = !1, ...n }) {
	let { isLoading: r } = Z();
	return r ? null : /* @__PURE__ */ (0, X.jsx)(tt, {
		tick: e,
		tickLine: t,
		...n
	});
}
function Hi({ tick: e = {
	fill: "currentColor",
	fontSize: 10
}, tickLine: t = !1, axisLine: n = !1, ...r }) {
	let { isLoading: i } = Z();
	return i ? null : /* @__PURE__ */ (0, X.jsx)(jr, {
		tick: e,
		tickLine: t,
		axisLine: n,
		...r
	});
}
function Ui({ variant: e, roundness: t, defaultIndex: n }) {
	let { isLoading: r, selectedDataKey: i } = Z();
	return r ? null : /* @__PURE__ */ (0, X.jsx)(bt, {
		defaultIndex: n,
		cursor: !1,
		content: /* @__PURE__ */ (0, X.jsx)(xt, {
			selected: i,
			roundness: t,
			variant: e
		})
	});
}
function Wi({ variant: e, align: t = "center", verticalAlign: n = "bottom", isClickable: r = !1 }) {
	let { isLoading: i, selectedDataKey: a, selectDataKey: o } = Z();
	return i ? null : /* @__PURE__ */ (0, X.jsx)(_t, {
		verticalAlign: n,
		align: t,
		content: /* @__PURE__ */ (0, X.jsx)(vt, {
			selected: a,
			onSelectChange: o,
			isClickable: r,
			variant: e
		})
	});
}
var Gi = (e, t, n, r) => {
	let i = !1, a = !1;
	return H.Children.forEach(e, (e) => {
		if ((0, H.isValidElement)(e)) {
			if (e.type === Ri) {
				let { variant: a } = e.props;
				i = /* @__PURE__ */ (0, X.jsx)(Di, {
					type: a,
					dataKey: n,
					chartId: t,
					fillOpacity: r
				});
			}
			if (e.type === zi) {
				let { variant: i } = e.props;
				a = /* @__PURE__ */ (0, X.jsx)(Di, {
					type: i,
					dataKey: n,
					chartId: t,
					fillOpacity: r
				});
			}
		}
	}), {
		dot: i,
		activeDot: a
	};
}, Ki = ({ dataKey: e, colorsCount: t, opacities: n }) => t === 1 ? /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsx)("stop", {
	offset: "0%",
	stopColor: `var(--color-${e}-0)`,
	stopOpacity: n?.[0]
}), /* @__PURE__ */ (0, X.jsx)("stop", {
	offset: "100%",
	stopColor: `var(--color-${e}-0)`,
	stopOpacity: n?.[n.length - 1]
})] }) : /* @__PURE__ */ (0, X.jsx)(X.Fragment, { children: Array.from({ length: t }, (r, i) => {
	let a = `${i / (t - 1) * 100}%`;
	return /* @__PURE__ */ (0, X.jsx)("stop", {
		offset: a,
		stopColor: `var(--color-${e}-${i}, var(--color-${e}-0))`,
		stopOpacity: n?.[i]
	}, a);
}) }), qi = ({ id: e, dataKey: t, config: n }) => {
	let r = Zt(n[t] ?? {});
	return /* @__PURE__ */ (0, X.jsx)("linearGradient", {
		id: `${e}-colors-${t}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "0",
		children: /* @__PURE__ */ (0, X.jsx)(Ki, {
			dataKey: t,
			colorsCount: r
		})
	});
}, Ji = ({ id: e, dataKey: t, config: n }) => {
	let r = Zt(n[t] ?? {});
	return /* @__PURE__ */ (0, X.jsx)("linearGradient", {
		id: `${e}-radar-stroke-${t}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "1",
		children: /* @__PURE__ */ (0, X.jsx)(Ki, {
			dataKey: t,
			colorsCount: r
		})
	});
}, Yi = ({ id: e, dataKey: t, config: n }) => {
	let r = Zt(n[t] ?? {}), i = r === 1 ? [.8, .3] : Array.from({ length: r }, (e, t) => t === 0 ? .8 : .3);
	return /* @__PURE__ */ (0, X.jsx)("radialGradient", {
		id: `${e}-radar-fill-${t}`,
		cx: "50%",
		cy: "50%",
		r: "50%",
		children: /* @__PURE__ */ (0, X.jsx)(Ki, {
			dataKey: t,
			colorsCount: r,
			opacities: i
		})
	});
}, Xi = ({ id: e, dataKey: t }) => /* @__PURE__ */ (0, X.jsxs)("filter", {
	id: `${e}-radar-glow-${t}`,
	x: "-50%",
	y: "-50%",
	width: "200%",
	height: "200%",
	children: [
		/* @__PURE__ */ (0, X.jsx)("feGaussianBlur", {
			in: "SourceGraphic",
			stdDeviation: "4",
			result: "blur"
		}),
		/* @__PURE__ */ (0, X.jsx)("feColorMatrix", {
			in: "blur",
			type: "matrix",
			values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0",
			result: "glow"
		}),
		/* @__PURE__ */ (0, X.jsxs)("feMerge", { children: [/* @__PURE__ */ (0, X.jsx)("feMergeNode", { in: "glow" }), /* @__PURE__ */ (0, X.jsx)("feMergeNode", { in: "SourceGraphic" })] })
	]
}), Zi = (e) => [
	"A",
	"B",
	"C",
	"D",
	"E",
	"F"
].slice(0, e).map((e) => ({
	skill: e,
	[Fi]: 30 + Math.random() * 70
}));
function Qi(e, t = Ni) {
	let [n, r] = (0, H.useState)(0);
	return (0, H.useEffect)(() => {
		if (!e) return;
		let t = setInterval(() => {
			r((e) => e + 1);
		}, Pi);
		return () => clearInterval(t);
	}, [e]), (0, H.useMemo)(() => Zi(t), [t, n]);
}
var $i = () => /* @__PURE__ */ (0, X.jsx)(vi, {
	dataKey: Fi,
	stroke: "currentColor",
	strokeOpacity: .3,
	strokeWidth: 2,
	fill: "currentColor",
	fillOpacity: .1,
	dot: !1,
	isAnimationActive: !0,
	animationDuration: Pi,
	animationEasing: "ease-in-out"
});
Q.Radar = Li, Q.Dot = Ri, Q.ActiveDot = zi, Q.PolarGrid = Bi, Q.PolarAngleAxis = Vi, Q.PolarRadiusAxis = Hi, Q.Tooltip = Ui, Q.Legend = Wi;
// src/react/taste/charts.tsx
function ea(e) {
	let { x: t = 0, cx: n, textAnchor: r, payload: i, ...a } = e, o = String(i?.value ?? ""), s = typeof n == "number" ? n * 2 : 0, c = s ? r === "start" ? s - t : r === "end" ? t : 2 * Math.min(t, s - t) : 56;
	return /* @__PURE__ */ (0, X.jsxs)("g", { children: [/* @__PURE__ */ (0, X.jsx)("title", { children: o }), /* @__PURE__ */ (0, X.jsx)(Rt, {
		...a,
		x: t,
		textAnchor: r,
		fill: "currentColor",
		fontSize: 12,
		children: qt(o, c - 4)
	})] });
}
var ta = [
	"stroke-chart-1",
	"stroke-chart-2",
	"stroke-chart-3",
	"stroke-chart-4",
	"stroke-chart-5",
	"stroke-chart-6"
], na = [
	"fill-chart-1",
	"fill-chart-2",
	"fill-chart-3",
	"fill-chart-4",
	"fill-chart-5",
	"fill-chart-6"
], ra = { value: {
	label: I("manage:tasteCharts.tagOccurrences"),
	colors: Dn(dt[3])
} }, ia = [
	"min-h-24",
	"min-h-24",
	"min-h-24",
	"min-h-32",
	"min-h-40",
	"min-h-48",
	"min-h-52",
	"min-h-60",
	"min-h-64"
], aa = 26, oa = { radius: ra.value }, sa = (e, t) => Math.sqrt(e / t);
function ca({ rows: e, label: t }) {
	let n = je(e);
	if (!n.length) return null;
	let r = n[0].value, i = n.map((e) => ({
		...e,
		radius: sa(e.value, r)
	}));
	return /* @__PURE__ */ (0, X.jsx)("div", {
		role: "img",
		"aria-label": I("manage:tasteCharts.radarSummary", {
			label: t,
			items: Ee(i.map((e) => e.name))
		}),
		children: /* @__PURE__ */ (0, X.jsxs)(Q, {
			data: i,
			config: oa,
			chartProps: { outerRadius: "58%" },
			className: "aspect-auto h-70 text-text-secondary",
			children: [
				/* @__PURE__ */ (0, X.jsx)(Q.PolarGrid, {}),
				/* @__PURE__ */ (0, X.jsx)(Q.PolarAngleAxis, {
					dataKey: "name",
					tick: /* @__PURE__ */ (0, X.jsx)(ea, {})
				}),
				/* @__PURE__ */ (0, X.jsx)(Q.PolarRadiusAxis, {
					domain: [0, 1],
					allowDecimals: !0,
					tick: !1
				}),
				/* @__PURE__ */ (0, X.jsx)(Q.Radar, { dataKey: "radius" }),
				/* @__PURE__ */ (0, X.jsx)(yt, { valueKey: "value" })
			]
		})
	});
}
function la({ rows: e, label: t }) {
	let n = qe(e, 8);
	return n.length ? /* @__PURE__ */ (0, X.jsx)("section", {
		"aria-label": t,
		className: `flex grow flex-col ${ia[n.length]}`,
		children: /* @__PURE__ */ (0, X.jsxs)(Et, {
			data: n,
			config: ra,
			layout: "horizontal",
			barRadius: 4,
			chartProps: {
				maxBarSize: aa,
				margin: {
					top: 5,
					right: 56,
					bottom: 5,
					left: 5
				}
			},
			className: "aspect-auto text-text-secondary",
			children: [
				/* @__PURE__ */ (0, X.jsx)(Et.YAxis, {
					dataKey: "name",
					interval: 0,
					tick: /* @__PURE__ */ (0, X.jsx)(pt, { along: "y" }),
					width: Ut(n.map((e) => e.name))
				}),
				/* @__PURE__ */ (0, X.jsx)(Et.XAxis, {
					hide: !0,
					domain: $e
				}),
				/* @__PURE__ */ (0, X.jsx)(Et.Bar, {
					dataKey: "value",
					enableHoverHighlight: !0,
					barProps: {
						dataKey: "value",
						label: rt("right")
					}
				}),
				/* @__PURE__ */ (0, X.jsx)(yt, {})
			]
		})
	}) : null;
}
function ua({ flows: e }) {
	let [t, n] = (0, H.useState)(null), r = ye(e);
	if (!r) return null;
	let i = t?.node ?? null, a = (e, n) => t ? i === null ? t.label === n : e.source === i || e.target === i : !0;
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: ut,
		children: [
			/* @__PURE__ */ (0, X.jsx)(gt, {
				title: I("manage:tasteCharts.creatorLeadSources"),
				figure: (t ? t.value : r.total).toLocaleString(),
				note: t ? t.label : I("manage:tasteCharts.leadsUnit", { count: r.total })
			}),
			/* @__PURE__ */ (0, X.jsx)("ol", {
				"aria-label": I("manage:tasteCharts.sitesAndCreatorLeads"),
				className: "flex flex-col sm:hidden",
				children: [...r.links].sort((e, t) => t.value - e.value).map((e) => /* @__PURE__ */ (0, X.jsxs)("li", {
					className: "flex items-baseline justify-between gap-3 border-b border-separator-border py-2 text-body-2-regular text-text-primary last:border-b-0",
					children: [/* @__PURE__ */ (0, X.jsx)("span", {
						className: "min-w-0 wrap-anywhere",
						children: e.label
					}), /* @__PURE__ */ (0, X.jsx)("b", {
						className: "shrink-0 tabular-nums",
						children: e.value.toLocaleString()
					})]
				}, e.key))
			}),
			/* @__PURE__ */ (0, X.jsx)("div", {
				className: "min-w-0 max-sm:hidden",
				children: /* @__PURE__ */ (0, X.jsxs)("svg", {
					viewBox: `0 0 ${u.width} ${r.height}`,
					fill: "none",
					role: "img",
					"aria-label": I("manage:tasteCharts.sitesAndCreatorLeads"),
					className: "block h-auto w-full",
					onPointerLeave: () => n(null),
					children: [/* @__PURE__ */ (0, X.jsx)("g", { children: r.links.map((e) => /* @__PURE__ */ (0, X.jsx)("path", {
						d: e.d,
						strokeWidth: e.width,
						tabIndex: 0,
						role: "img",
						"aria-label": I("manage:tasteCharts.leadCount", {
							name: e.label,
							count: e.value
						}),
						fillOpacity: 0,
						strokeOpacity: a(e, e.label) ? .55 : .08,
						className: `outline-none transition-opacity ${ta[e.color]}`,
						onPointerEnter: () => n({
							value: e.value,
							label: e.label,
							node: null
						}),
						onFocus: () => n({
							value: e.value,
							label: e.label,
							node: null
						}),
						onBlur: () => n(null)
					}, e.key)) }), /* @__PURE__ */ (0, X.jsx)("g", { children: r.nodes.map((e) => /* @__PURE__ */ (0, X.jsxs)("g", {
						tabIndex: 0,
						role: "img",
						"aria-label": I("manage:tasteCharts.leadCount", {
							name: e.name,
							count: e.value
						}),
						className: "outline-none focus-visible:opacity-100",
						onPointerEnter: () => n({
							value: e.value,
							label: e.name,
							node: e.index
						}),
						onFocus: () => n({
							value: e.value,
							label: e.name,
							node: e.index
						}),
						onBlur: () => n(null),
						children: [/* @__PURE__ */ (0, X.jsx)("rect", {
							x: e.x,
							y: e.y,
							width: 10,
							height: e.height,
							rx: 5,
							className: e.side === "source" ? na[e.color] : "fill-text-secondary"
						}), /* @__PURE__ */ (0, X.jsxs)("text", {
							x: l[e.side],
							y: e.y + e.height / 2,
							textAnchor: e.side === "source" ? "end" : "start",
							dominantBaseline: "middle",
							className: "fill-text-secondary text-caption-1-regular",
							children: [be(e.name), /* @__PURE__ */ (0, X.jsx)("tspan", {
								x: l[e.side],
								dy: 15,
								children: e.side === "source" ? e.value.toLocaleString() : `${e.share.toFixed(1)}%`
							})]
						})]
					}, e.id)) })]
				})
			}),
			/* @__PURE__ */ (0, X.jsxs)("footer", {
				className: "flex justify-between gap-3 text-caption-1-regular text-text-secondary max-sm:hidden",
				children: [/* @__PURE__ */ (0, X.jsx)("span", { children: I("manage:tasteCharts.sourceSites") }), /* @__PURE__ */ (0, X.jsx)("span", { children: I("manage:tasteCharts.creatorsLeadShare") })]
			})
		]
	});
}
// src/react/taste/browser-sources.tsx
var da = "flex min-w-0 items-center gap-3 rounded-xl bg-background-primary-default p-3";
function fa({ browsers: e, sources: t, range: n, children: r }) {
	let [a, o] = (0, H.useState)(!1), [s, c] = (0, H.useState)(""), [l, u] = (0, H.useState)(""), p = Xe({
		mutationFn: (e) => pe(e, n),
		onSuccess: (e) => {
			F.setQueryData(L(n), e.dashboard), o(!1), c(""), u("");
		}
	});
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: `${A()} flex flex-col gap-4`,
		"aria-label": I("manage:tasteSources.dataSources"),
		children: [
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, X.jsx)("h3", {
					className: "text-title-2-medium text-text-primary",
					children: I("manage:tasteSources.dataSources")
				}), /* @__PURE__ */ (0, X.jsx)(i, {
					variant: "secondary",
					onClick: () => o(!0),
					disabled: a,
					children: I("manage:tasteSources.addBrowser")
				})]
			}),
			p.error ? /* @__PURE__ */ (0, X.jsx)(y, {
				tone: "error",
				children: P(p.error)
			}) : null,
			a ? /* @__PURE__ */ (0, X.jsxs)("form", {
				className: "flex flex-col gap-3",
				onSubmit: (e) => {
					e.preventDefault(), p.isPending || p.mutate({
						operation: "add",
						name: s,
						path: l
					});
				},
				children: [
					/* @__PURE__ */ (0, X.jsx)(f, {
						label: I("manage:tasteSources.browserName"),
						value: s,
						onChange: c,
						maxLength: 80,
						isRequired: !0,
						isDisabled: p.isPending
					}),
					/* @__PURE__ */ (0, X.jsx)(f, {
						label: I("manage:tasteSources.profilePath"),
						value: l,
						onChange: u,
						maxLength: 1024,
						isRequired: !0,
						isDisabled: p.isPending,
						hint: I("manage:tasteSources.profilePathHint")
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, X.jsx)(i, {
							variant: "ghost",
							disabled: p.isPending,
							onClick: () => {
								o(!1), p.reset();
							},
							children: I("manage:shared.cancel")
						}), /* @__PURE__ */ (0, X.jsx)(i, {
							type: "submit",
							variant: "secondary",
							disabled: !s.trim() || !l.trim(),
							...k(p.isPending),
							children: I("manage:shared.add")
						})]
					})
				]
			}) : null,
			/* @__PURE__ */ (0, X.jsxs)("div", {
				className: "inline-grid w-full min-w-0 gap-2 sm:grid-cols-2",
				children: [r, e.map((e) => {
					let n = t.filter((t) => e.source_keys?.includes(t.source_key)), r = n.reduce((e, t) => e + (t.visits || 0), 0), a = n.reduce((e, t) => e + (t.bookmarks || 0), 0);
					return /* @__PURE__ */ (0, X.jsxs)("div", {
						"data-taste-source": "browser",
						className: da,
						children: [
							/* @__PURE__ */ (0, X.jsx)("span", {
								className: "inline-grid size-8 shrink-0 place-items-center rounded-lg text-text-secondary",
								children: /* @__PURE__ */ (0, X.jsx)(Gn, { name: e.name })
							}),
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: "flex min-w-0 grow flex-col gap-0.5",
								children: [
									/* @__PURE__ */ (0, X.jsx)("b", {
										className: "text-body-2-medium break-words text-text-primary",
										children: e.name
									}),
									/* @__PURE__ */ (0, X.jsx)("span", {
										className: "break-all text-caption-1-regular text-text-secondary",
										children: e.path
									}),
									/* @__PURE__ */ (0, X.jsx)("span", {
										className: "text-caption-1-regular text-text-secondary",
										children: e.enabled ? e.available ? I("manage:tasteSources.profileCount", { count: e.profiles }) : I("manage:tasteSources.profileUnavailable") : I("manage:tasteSources.readingStopped")
									}),
									n.length ? /* @__PURE__ */ (0, X.jsxs)("span", {
										className: "text-caption-1-regular text-text-secondary",
										children: [
											I("manage:tasteSources.historyCount", { count: r }),
											" · ",
											I("manage:tasteSources.bookmarkCount", { count: a })
										]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, X.jsxs)("span", {
								className: "flex shrink-0 gap-1",
								children: [/* @__PURE__ */ (0, X.jsx)(i, {
									variant: "secondary",
									size: "small",
									...k(p.isPending),
									iconOnly: !0,
									leadingIcon: e.enabled ? b : d,
									"aria-label": `${e.enabled ? I("manage:tasteSources.stopReading") : I("manage:customSources.enable")} ${e.name}`,
									onClick: () => {
										e.enabled ? N({
											title: I("manage:tasteSources.stopReadingTitle", { browser: e.name }),
											body: I("manage:tasteSources.stopReadingBody"),
											confirmLabel: I("manage:tasteSources.stopReading"),
											onConfirm: () => p.mutateAsync({
												operation: "disable",
												id: e.id
											})
										}) : p.mutate({
											operation: "enable",
											id: e.id
										});
									}
								}), /* @__PURE__ */ (0, X.jsx)(i, {
									variant: "secondary",
									size: "small",
									iconOnly: !0,
									leadingIcon: m,
									...k(p.isPending),
									"aria-label": I("manage:tasteSources.deleteBrowserTitle", { browser: e.name }),
									onClick: () => {
										N({
											title: I("manage:tasteSources.deleteBrowserTitle", { browser: e.name }),
											body: I("manage:tasteSources.deleteBrowserBody"),
											confirmLabel: I("manage:tasteSources.deleteBrowser"),
											danger: !0,
											holdToConfirm: !0,
											onConfirm: () => p.mutateAsync({
												operation: "delete_browser",
												id: e.id
											})
										});
									}
								})]
							})
						]
					}, e.id);
				})]
			})
		]
	});
}
// src/react/taste/taste-page.tsx
var pa = 10, ma = me(h, g, "text-body-2-medium"), ha = `${A()} flex flex-col gap-4`, ga = "rounded-xl bg-background-primary-default p-3", _a = I("manage:taste.readHistoryTooltip"), va = I("manage:taste.noSourceHint"), ya = I("manage:taste.noLeadHint"), ba = I("manage:taste.noCategoryHint"), xa = I("manage:taste.gapHint"), Sa = I("manage:taste.noBrowserTagHint"), Ca = I("manage:taste.noBrowserCreatorHint"), wa = I("manage:taste.noDomainHint"), Ta = I("manage:taste.noPeachTagHint"), Ea = I("manage:taste.noPeachCreatorHint"), Da = I("manage:taste.noPeachActressHint"), Oa = I("manage:taste.guideLocal"), ka = I("manage:taste.guideRemote"), Aa = I("manage:taste.guideRefresh"), ja = I("manage:taste.removeSourceBody"), Ma = "peach-taste-guide-dismissed", Na = "\0", Pa = (e, t) => {
	let [n = "", r = ""] = e.split(Na);
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
		n,
		t,
		r
	] });
}, Fa = (0, H.createContext)(/* @__PURE__ */ (0, X.jsx)(a, {
	size: "small",
	href: "/",
	children: I("manage:shared.browseCollection")
}));
function Ia() {
	return (0, H.useContext)(Fa);
}
function $({ icon: e, term: t, figure: n, detail: r, detailTitle: i, accent: a }) {
	return /* @__PURE__ */ (0, X.jsx)("div", {
		className: Ve(),
		children: /* @__PURE__ */ (0, X.jsx)(E, {
			label: t,
			icon: e,
			accent: a,
			figure: n,
			footer: /* @__PURE__ */ (0, X.jsx)("span", {
				className: "block min-w-0 truncate",
				title: i || r,
				children: r ?? ""
			})
		})
	});
}
function La({ name: e, domain: t }) {
	return /* @__PURE__ */ (0, X.jsxs)("span", {
		className: "relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-background-tertiary-default text-caption-1-medium text-text-secondary",
		children: [ve(e).toUpperCase(), /* @__PURE__ */ (0, X.jsx)("img", {
			src: ze({ domain: t }),
			alt: "",
			loading: "lazy",
			width: 20,
			height: 20,
			onError: (e) => e.currentTarget.remove(),
			className: "absolute size-5 object-contain"
		})]
	});
}
function Ra({ html: e }) {
	return /* @__PURE__ */ (0, X.jsx)("span", {
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary ${p}`,
		dangerouslySetInnerHTML: { __html: e }
	});
}
function za({ rows: e, kind: t, visual: n, empty: r, onSignal: i }) {
	if (!e.length) return /* @__PURE__ */ (0, X.jsx)(c, {
		size: "compact",
		icon: ke,
		title: I("manage:taste.notEnoughData"),
		actions: /* @__PURE__ */ (0, X.jsx)(Ia, {}),
		children: r
	});
	let a = Ne(e);
	return /* @__PURE__ */ (0, X.jsx)(et, {
		previewCount: pa,
		className: "inline-grid w-full gap-x-7 gap-y-2 sm:grid-cols-2",
		children: e.map((e, r) => {
			let o = !!t && !!e.peach_items, s = String(e.source_domain || ""), c = /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
				/* @__PURE__ */ (0, X.jsx)("svg", {
					viewBox: "0 0 100 1",
					preserveAspectRatio: "none",
					"aria-hidden": !0,
					className: "absolute inset-0 -z-10 size-full overflow-hidden rounded-lg opacity-15",
					children: /* @__PURE__ */ (0, X.jsx)("rect", {
						width: a[r],
						height: 1,
						className: "fill-chart-4"
					})
				}),
				/* @__PURE__ */ (0, X.jsx)("span", {
					className: "w-6 shrink-0 text-caption-1-regular tabular-nums text-text-secondary",
					children: r + 1
				}),
				n === "domain" ? /* @__PURE__ */ (0, X.jsx)(La, {
					name: e.name,
					domain: e.name
				}) : null,
				n === "creator" && !e.entity_id && !e.has_avatar && s ? /* @__PURE__ */ (0, X.jsx)(La, {
					name: e.name,
					domain: s
				}) : null,
				n !== "none" && n !== "domain" && (e.entity_id || e.has_avatar || !s) ? /* @__PURE__ */ (0, X.jsx)(Ra, { html: O(e.name, e.entity_id ? {
					id: e.entity_id,
					has_image: !!e.has_image,
					image_version: e.image_version,
					avatar_focus: e.avatar_focus,
					avatar_stand_in: e.avatar_stand_in
				} : null, e.has_avatar ? e.representative_asset_id ?? null : null, n === "creator" ? "creator" : t || "performer") }) : null,
				/* @__PURE__ */ (0, X.jsxs)("span", {
					className: "flex min-w-0 grow flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, X.jsx)("b", {
						className: "min-w-0 text-body-medium break-words text-text-primary",
						children: e.name
					}), /* @__PURE__ */ (0, X.jsx)("small", {
						className: "text-caption-1-regular text-text-secondary",
						children: Me(e)
					})]
				}),
				o ? /* @__PURE__ */ (0, X.jsx)(Ae, {
					"aria-hidden": !0,
					className: "size-4 shrink-0 text-text-tertiary"
				}) : null
			] }), l = "relative isolate flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left";
			return /* @__PURE__ */ (0, X.jsx)("li", {
				className: "min-w-0",
				children: o ? /* @__PURE__ */ (0, X.jsx)("button", {
					type: "button",
					onClick: () => i(t, e.name),
					className: `${l} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring`,
					children: c
				}) : /* @__PURE__ */ (0, X.jsx)("div", {
					className: l,
					children: c
				})
			}, `${e.name}:${r}`);
		})
	});
}
function Ba({ label: e, panels: i, onSignal: a }) {
	return /* @__PURE__ */ (0, X.jsxs)(r, {
		className: `${A({ padding: "none" })} flex flex-col`,
		children: [/* @__PURE__ */ (0, X.jsx)("div", {
			className: "px-4 pt-3",
			children: /* @__PURE__ */ (0, X.jsx)(ee, {
				"aria-label": e,
				className: w,
				children: i.map((e) => /* @__PURE__ */ (0, X.jsx)(n, {
					id: e.id,
					className: C,
					children: e.name
				}, e.id))
			})
		}), i.map((e) => /* @__PURE__ */ (0, X.jsx)(t, {
			id: e.id,
			className: "px-4 pt-3.5 pb-4",
			children: /* @__PURE__ */ (0, X.jsx)(za, {
				...e.props,
				onSignal: a
			})
		}, e.id))]
	});
}
function Va({ data: e, onSignal: t, navigate: n }) {
	let r = e.analysis;
	if (!r?.headline) return null;
	let i = r.confidence || {}, o = [...(r.explore || []).map((e) => ({
		key: `tag:${e.tag}`,
		title: M(e, "title"),
		detail: M(e, "detail"),
		act: () => t("tag", e.tag)
	})), ...(r.next_steps || []).map((e) => ({
		key: `route:${e.route}`,
		title: M(e, "title"),
		detail: M(e, "detail"),
		act: () => n(e.route)
	}))];
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: ha,
		"aria-label": I("manage:taste.summary"),
		children: [
			/* @__PURE__ */ (0, X.jsxs)("header", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, X.jsx)("h3", {
						className: "text-title-2-medium text-text-primary",
						children: I("manage:taste.summary")
					}),
					/* @__PURE__ */ (0, X.jsx)("p", {
						className: "max-w-prose text-title-2-regular wrap-anywhere text-text-primary",
						children: M(r, "headline")
					}),
					/* @__PURE__ */ (0, X.jsxs)("p", {
						className: "flex flex-wrap items-center gap-2 text-body-2-regular text-text-secondary",
						children: [/* @__PURE__ */ (0, X.jsx)("i", {
							"aria-hidden": !0,
							className: `size-2 shrink-0 rounded-full ${i.level === "high" ? "bg-status-lime-text" : i.level === "medium" ? "bg-status-yellow-text" : "bg-text-tertiary"}`
						}), /* @__PURE__ */ (0, X.jsx)("span", {
							className: "min-w-0 wrap-anywhere",
							children: M(i, "label") || I("manage:taste.stillLearning")
						})]
					})
				]
			}),
			r.points?.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "inline-grid w-full gap-3 sm:grid-cols-2",
				children: r.points.map((e) => /* @__PURE__ */ (0, X.jsxs)("div", {
					className: `flex min-w-0 flex-col gap-1 ${ga}`,
					children: [/* @__PURE__ */ (0, X.jsx)("span", {
						className: "text-caption-1-regular text-text-secondary",
						children: M(e, "label")
					}), /* @__PURE__ */ (0, X.jsx)("b", {
						className: "text-body-2-medium break-words text-text-primary",
						children: M(e, "text")
					})]
				}, e.label))
			}) : null,
			o.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "flex flex-col gap-2",
				children: o.map((e) => /* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					onClick: e.act,
					className: `flex w-full min-w-0 cursor-pointer items-center gap-3 ${ga} text-left outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring`,
					children: [/* @__PURE__ */ (0, X.jsxs)("span", {
						className: "flex min-w-0 grow flex-col gap-1",
						children: [/* @__PURE__ */ (0, X.jsx)("b", {
							className: "text-body-2-medium wrap-anywhere text-text-primary",
							children: e.title
						}), /* @__PURE__ */ (0, X.jsx)("small", {
							className: "text-caption-1-regular wrap-anywhere text-text-secondary",
							children: e.detail
						})]
					}), /* @__PURE__ */ (0, X.jsx)(Ae, {
						"aria-hidden": !0,
						className: "size-4 shrink-0 text-text-tertiary"
					})]
				}, e.key))
			}) : /* @__PURE__ */ (0, X.jsx)(c, {
				size: "compact",
				icon: ke,
				title: I("manage:taste.nothingToExplore"),
				actions: /* @__PURE__ */ (0, X.jsx)(a, {
					size: "small",
					href: "/",
					children: I("manage:shared.browseCollection")
				}),
				children: ya
			})
		]
	});
}
function Ha({ onboarding: e, done: t }) {
	let [n, r] = (0, H.useState)(() => {
		try {
			return localStorage.getItem(Ma) === "1";
		} catch {
			return !1;
		}
	});
	return t || n ? null : /* @__PURE__ */ (0, X.jsx)("div", {
		className: A({
			padding: "none",
			className: "p-4"
		}),
		children: /* @__PURE__ */ (0, X.jsxs)(o, {
			summary: I("manage:taste.importGuide"),
			defaultOpen: e,
			children: [
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: Oa
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: ka
				}),
				/* @__PURE__ */ (0, X.jsxs)("ul", {
					className: "flex list-disc flex-col gap-1 pl-5 text-body-2-regular text-text-secondary",
					children: [/* @__PURE__ */ (0, X.jsx)("li", { children: Pa(I("manage:taste.guideChrome", { link: Na }), /* @__PURE__ */ (0, X.jsxs)("a", {
						href: "https://takeout.google.com/",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-text-primary underline-offset-4 hover:underline",
						children: ["Google Takeout", /* @__PURE__ */ (0, X.jsx)(D, {
							"aria-hidden": !0,
							className: "size-(--icon-inline) shrink-0"
						})]
					})) }), /* @__PURE__ */ (0, X.jsx)("li", { children: Pa(I("manage:taste.guideOther", { link: Na }), /* @__PURE__ */ (0, X.jsxs)("a", {
						href: "https://github.com/purarue/browserexport",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-text-primary underline-offset-4 hover:underline",
						children: ["browserexport", /* @__PURE__ */ (0, X.jsx)(D, {
							"aria-hidden": !0,
							className: "size-(--icon-inline) shrink-0"
						})]
					})) })]
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: Aa
				}),
				/* @__PURE__ */ (0, X.jsx)("span", {
					className: "self-start",
					children: /* @__PURE__ */ (0, X.jsx)(i, {
						variant: "secondary",
						size: "small",
						onClick: () => {
							try {
								localStorage.setItem(Ma, "1");
							} catch {}
							r(!0);
						},
						children: I("manage:shared.skip")
					})
				})
			]
		})
	});
}
function Ua({ busy: t, onRefresh: n, onImport: r, onImportBookmarks: a }) {
	let o = (0, H.useRef)(null), [c, l] = (0, H.useState)(!1), u = (e) => {
		l(!1), e();
	};
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsxs)("span", {
		"data-guide-target": "history-import",
		"data-button-group": !0,
		"data-split-button": !0,
		"data-variant": "primary",
		children: [/* @__PURE__ */ (0, X.jsx)(i, {
			leadingIcon: s,
			title: _a,
			onClick: n,
			...k(t),
			children: I("manage:taste.readBrowserHistory")
		}), /* @__PURE__ */ (0, X.jsx)(i, {
			ref: o,
			iconOnly: !0,
			leadingIcon: he,
			"aria-label": I("manage:taste.moreHistoryOptions"),
			"aria-haspopup": "dialog",
			"aria-expanded": c,
			...k(t),
			onClick: () => {
				t || l(!0);
			}
		})]
	}), /* @__PURE__ */ (0, X.jsx)(e, {
		triggerRef: o,
		isOpen: c,
		onOpenChange: l,
		placement: "bottom end",
		offset: 4,
		className: _,
		children: /* @__PURE__ */ (0, X.jsxs)(v, {
			"aria-label": I("manage:taste.moreHistoryOptions"),
			className: "flex w-52 flex-col gap-1 outline-none",
			children: [
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: ma,
					onClick: () => u(n),
					children: [/* @__PURE__ */ (0, X.jsx)(s, {
						"aria-hidden": !0,
						className: "size-4 shrink-0"
					}), I("manage:taste.readBrowserHistory")]
				}),
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: ma,
					onClick: () => u(r),
					children: [/* @__PURE__ */ (0, X.jsx)(S, {
						"aria-hidden": !0,
						className: "size-4 shrink-0"
					}), I("manage:taste.importHistoryFile")]
				}),
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: ma,
					onClick: () => u(a),
					children: [/* @__PURE__ */ (0, X.jsx)(Se, {
						"aria-hidden": !0,
						className: "size-4 shrink-0"
					}), I("manage:taste.importBookmarksFile")]
				})
			]
		})
	})] });
}
function Wa({ sources: e, browsers: t, window: n, toast: r, emptyActions: a }) {
	let o = Xe({
		mutationFn: (e) => Pe(e, n),
		onSuccess: (e) => {
			F.setQueryData(L(n), e.dashboard), r(I("manage:taste.sourceRemoved"));
		}
	});
	return /* @__PURE__ */ (0, X.jsxs)(fa, {
		browsers: t,
		sources: e,
		range: n,
		children: [o.error ? /* @__PURE__ */ (0, X.jsx)("div", {
			className: "sm:col-span-2",
			children: /* @__PURE__ */ (0, X.jsx)(y, {
				tone: "error",
				children: P(o.error)
			})
		}) : null, e.length ? /* @__PURE__ */ (0, X.jsx)(X.Fragment, { children: e.filter((e) => !t.some((t) => t.source_keys?.includes(e.source_key))).map((e) => /* @__PURE__ */ (0, X.jsxs)("div", {
			"data-taste-source": "import",
			className: da,
			children: [
				/* @__PURE__ */ (0, X.jsx)("span", {
					className: "inline-grid size-8 shrink-0 place-items-center rounded-lg text-text-secondary",
					children: e.browser === "browserexport" ? /* @__PURE__ */ (0, X.jsx)(S, {
						"aria-hidden": !0,
						className: "size-4"
					}) : /* @__PURE__ */ (0, X.jsx)(ce, {
						"aria-hidden": !0,
						className: "size-4"
					})
				}),
				/* @__PURE__ */ (0, X.jsxs)("span", {
					className: "flex min-w-0 grow flex-col gap-0.5",
					children: [/* @__PURE__ */ (0, X.jsx)("b", {
						className: "min-w-0 text-body-2-medium break-words text-text-primary",
						children: e.profile
					}), /* @__PURE__ */ (0, X.jsx)("small", {
						className: "min-w-0 text-caption-1-regular break-words text-text-secondary",
						children: I(e.bookmarks ? "manage:taste.importedBookmarks" : "manage:taste.importedHistory", {
							host: e.host,
							count: Number(e.visits || e.bookmarks || 0)
						})
					})]
				}),
				/* @__PURE__ */ (0, X.jsx)(i, {
					variant: "secondary",
					size: "small",
					"aria-label": I("manage:taste.removeSourceLabel", { source: e.profile }),
					className: "shrink-0",
					iconOnly: !0,
					leadingIcon: m,
					...k(o.isPending),
					onClick: () => {
						o.isPending || N({
							title: I("manage:taste.removeSource"),
							body: ja,
							confirmLabel: I("manage:taste.removeSource"),
							holdToConfirm: !0,
							onConfirm: () => o.mutateAsync(e.source_key)
						});
					}
				})
			]
		}, e.source_key)) }) : t.length ? null : /* @__PURE__ */ (0, X.jsx)(c, {
			size: "compact",
			icon: ce,
			title: I("manage:taste.noSourcesTitle"),
			actions: a,
			children: va
		})]
	});
}
function Ga(e) {
	let { onSignal: o, navigate: s, toast: l, onboarding: u } = e, [d, f] = (0, H.useState)("all"), [p, m] = (0, H.useState)("browser"), h = (0, H.useRef)(null), g = (0, H.useRef)(null), _ = Ze({
		queryKey: L(d),
		queryFn: ({ signal: e }) => ge(d, e),
		placeholderData: De,
		refetchInterval: Ge
	}), { job: v, running: b, outcome: x, start: S } = Ye({
		queryKey: re,
		queryFn: ({ signal: e }) => _e(e),
		start: () => Be(d),
		taskKey: ie,
		onFinish: (e) => {
			e.status !== "failed" && (F.invalidateQueries({ queryKey: ["taste"] }), l(e.warnings?.length ? I("manage:taste.partialHistory") : I("manage:taste.analysisUpdated")));
		}
	}), E = Xe({
		mutationFn: (e) => ge(e, void 0, !0),
		onSuccess: (e, t) => {
			F.setQueryData(L(t), e);
		}
	}), D = Xe({
		mutationFn: (e) => we(e),
		onSuccess: (e) => {
			F.setQueryData(L("all"), e.dashboard), f("all"), l(I("manage:taste.dataImported"));
		}
	}), ce = (e) => {
		let t = e.currentTarget.files?.[0];
		e.currentTarget.value = "", t && !D.isPending && (D.reset(), D.mutate(t));
	}, le = () => {
		b || S.isPending || (S.reset(), S.mutate());
	}, O = _.data;
	if (!O) return /* @__PURE__ */ (0, X.jsx)(st, { children: /* @__PURE__ */ (0, X.jsx)(y, {
		tone: "error",
		title: I("manage:taste.loadFailedTitle"),
		children: _.error ? P(_.error) : I("manage:taste.loadFailedBody")
	}) });
	let A = O.summary || {}, j = O.coverage || {}, M = O.rankings || {}, pe = O.storage || {}, N = Ue(M.browser_categories || []), me = je(N).length > 0, he = O.gaps || [], ve = j.tagged || 0, ye = j.identified || 0, be = S.error ? P(S.error) : D.error ? P(D.error) : E.error ? P(E.error) : x?.status === "failed" ? Te(x, "error") || I("manage:taste.readNotFound") : "", Ee = /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "flex flex-wrap justify-center gap-2",
		children: [/* @__PURE__ */ (0, X.jsx)(i, {
			variant: "secondary",
			...k(b || S.isPending || D.isPending),
			onClick: le,
			children: I("manage:taste.readBrowserHistory")
		}), /* @__PURE__ */ (0, X.jsx)(i, {
			variant: "secondary",
			...k(D.isPending),
			onClick: () => h.current?.click(),
			children: I("manage:taste.importHistoryFile")
		})]
	});
	return /* @__PURE__ */ (0, X.jsx)(st, { children: /* @__PURE__ */ (0, X.jsxs)(Fa, {
		value: d === "all" ? p === "peach" ? /* @__PURE__ */ (0, X.jsx)(a, {
			size: "small",
			variant: "secondary",
			href: "/",
			children: I("manage:shared.browseCollection")
		}) : Ee : /* @__PURE__ */ (0, X.jsx)(i, {
			size: "small",
			variant: "secondary",
			onClick: () => f("all"),
			children: I("manage:taste.viewAllTime")
		}),
		children: [
			/* @__PURE__ */ (0, X.jsxs)(r, {
				selectedKey: p,
				onSelectionChange: (e) => m(String(e)),
				className: "flex flex-col gap-5",
				children: [
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, X.jsxs)(ee, {
							"aria-label": I("manage:taste.evidenceLabel"),
							className: w,
							children: [/* @__PURE__ */ (0, X.jsx)(n, {
								id: "peach",
								className: C,
								children: I("manage:taste.peachActivity")
							}), /* @__PURE__ */ (0, X.jsx)(n, {
								id: "browser",
								className: C,
								children: I("manage:taste.browserHistory")
							})]
						}), /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, X.jsx)(te, {
									"aria-label": I("manage:taste.rangeLabel"),
									selectedKey: d,
									onSelectionChange: (e) => {
										e !== null && f(String(e));
									},
									children: ae.map(([e, t]) => /* @__PURE__ */ (0, X.jsx)(ne, {
										id: e,
										children: t
									}, e))
								}),
								/* @__PURE__ */ (0, X.jsx)(Ua, {
									busy: b || S.isPending || D.isPending,
									onRefresh: le,
									onImport: () => h.current?.click(),
									onImportBookmarks: () => g.current?.click()
								}),
								/* @__PURE__ */ (0, X.jsx)("input", {
									ref: h,
									type: "file",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									onChange: ce
								}),
								/* @__PURE__ */ (0, X.jsx)("input", {
									ref: g,
									type: "file",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									"data-bookmark-import": !0,
									onChange: ce
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, X.jsx)(Ha, {
						onboarding: u,
						done: !!(A.history_sources || O.updated_at)
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						"aria-live": "polite",
						className: "flex flex-col gap-3 empty:hidden",
						children: [
							b ? /* @__PURE__ */ (0, X.jsx)(oe, {
								kind: de("taste-refresh"),
								label: Te(v, "message") || I("manage:taste.refreshing"),
								value: v?.checked,
								total: v?.total
							}) : null,
							D.isPending ? /* @__PURE__ */ (0, X.jsx)(oe, {
								kind: "gather",
								label: I("manage:taste.importing")
							}) : null,
							O.stale && O.error ? /* @__PURE__ */ (0, X.jsx)(y, {
								tone: "error",
								action: /* @__PURE__ */ (0, X.jsx)(i, {
									variant: "secondary",
									size: "small",
									...k(E.isPending),
									onClick: () => E.mutate(d),
									children: I("manage:shared.retryNow")
								}),
								children: I("manage:taste.updateFailedStale", {
									time: Ke(O.computed_at),
									error: Le(O.message_code ?? "", O.error, O.message_params)
								})
							}) : O.stale ? /* @__PURE__ */ (0, X.jsx)(oe, {
								kind: de("taste-refresh"),
								label: I("manage:taste.updatingStale", { time: Ke(O.computed_at) })
							}) : null,
							be ? /* @__PURE__ */ (0, X.jsx)(y, {
								tone: "error",
								children: be
							}) : null,
							x?.warnings?.length ? /* @__PURE__ */ (0, X.jsx)(y, {
								tone: "warning",
								children: Re(x.warnings, x.warning_codes, x.warning_params).join(I("shell:format.semicolonSeparator"))
							}) : null
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)(t, {
						id: "browser",
						className: "flex flex-col gap-5",
						children: [
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: T,
								children: [
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 0,
										icon: Je,
										term: I("manage:tasteSkeleton.browsingHistory"),
										figure: Number(A.history_visits || 0).toLocaleString(),
										detail: Ce(A),
										detailTitle: `${He(A.range_start)}—${He(A.range_end)}`
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 1,
										icon: Oe,
										term: I("manage:tasteSkeleton.tasteDimensions"),
										figure: N.length.toLocaleString(),
										detail: N[0]?.name || I("manage:taste.noTopDimension")
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 2,
										icon: ke,
										term: I("manage:tasteSkeleton.browsingLeads"),
										figure: he.length.toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 3,
										icon: Se,
										term: I("manage:taste.bookmarks"),
										figure: Number(A.bookmarks || 0).toLocaleString(),
										detail: I("manage:taste.privateExports", {
											count: Number(pe.exports || 0),
											size: xe(pe.bytes || 0)
										})
									})
								]
							}),
							/* @__PURE__ */ (0, X.jsxs)("section", {
								className: me ? `${ha} md:flex-row md:gap-6` : ha,
								"aria-label": I("manage:taste.browsingProfile"),
								children: [/* @__PURE__ */ (0, X.jsxs)("div", {
									className: me ? "flex shrink-0 flex-col gap-2 pb-5 md:w-80 md:pr-6 md:pb-0" : "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
									children: [
										/* @__PURE__ */ (0, X.jsx)("span", {
											className: "text-caption-1-regular text-text-secondary",
											children: I("manage:taste.browsingProfile")
										}),
										me ? /* @__PURE__ */ (0, X.jsx)(ca, {
											rows: N,
											label: I("manage:taste.topDimensions")
										}) : null,
										/* @__PURE__ */ (0, X.jsx)("small", {
											className: "text-caption-1-regular text-text-secondary",
											children: O.updated_at ? I("manage:taste.updatedAt", { date: He(O.updated_at) }) : I("manage:taste.historyNotFetched")
										})
									]
								}), /* @__PURE__ */ (0, X.jsx)("div", {
									className: "flex min-w-0 grow flex-col",
									children: N.length ? /* @__PURE__ */ (0, X.jsx)(la, {
										rows: N,
										label: I("manage:taste.dimensionRanking")
									}) : /* @__PURE__ */ (0, X.jsx)(c, {
										size: "compact",
										icon: ke,
										title: I("manage:taste.noDimensions"),
										actions: /* @__PURE__ */ (0, X.jsx)(Ia, {}),
										children: ba
									})
								})]
							}),
							/* @__PURE__ */ (0, X.jsx)(Qe, {
								activity: O.activity,
								title: I("manage:taste.browsingActivity"),
								dailyTitle: I("manage:taste.dailyActivity"),
								words: {
									unit: (e) => I("manage:taste.siteVisitsUnit", { count: e }),
									series: I("manage:taste.visitsSeries"),
									cell: (e) => I("manage:taste.visitsCell", { count: e })
								},
								tone: 4,
								empty: I("manage:taste.noVisitsHint")
							}),
							/* @__PURE__ */ (0, X.jsx)(ua, { flows: O.creator_flows }),
							/* @__PURE__ */ (0, X.jsx)(Ba, {
								label: I("manage:taste.browserDimensions"),
								onSignal: o,
								panels: [
									{
										id: "tags",
										name: I("manage:shared.tags"),
										props: {
											rows: M.browser_tags || [],
											kind: "tag",
											visual: "none",
											empty: Sa
										}
									},
									{
										id: "creators",
										name: I("manage:shared.creators"),
										props: {
											rows: M.browser_creators || [],
											kind: "creator",
											visual: "creator",
											empty: Ca
										}
									},
									{
										id: "performers",
										name: I("manage:shared.actresses"),
										props: {
											rows: M.browser_performers || [],
											kind: "performer",
											visual: "entity",
											empty: I("manage:taste.noActressHistory")
										}
									},
									{
										id: "domains",
										name: I("manage:taste.topSites"),
										props: {
											rows: M.domains || [],
											kind: "",
											visual: "domain",
											empty: wa
										}
									},
									{
										id: "gaps",
										name: I("manage:tasteSkeleton.browsingLeads"),
										props: {
											rows: he,
											kind: "",
											visual: "none",
											empty: xa
										}
									}
								]
							})
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)(t, {
						id: "peach",
						className: "flex flex-col gap-5",
						children: [
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: T,
								children: [
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 0,
										icon: se,
										term: I("manage:taste.watchedInPeach"),
										figure: Number(A.peach_items || 0).toLocaleString(),
										detail: We(A.peach_seconds || 0)
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 1,
										icon: ue,
										term: I("manage:shared.like"),
										figure: Number(A.liked || 0).toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 2,
										icon: fe,
										term: I("manage:taste.disliked"),
										figure: Number(A.disliked || 0).toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 3,
										icon: Oe,
										term: I("manage:taste.tagged"),
										figure: ve.toLocaleString()
									})
								]
							}),
							/* @__PURE__ */ (0, X.jsxs)("section", {
								className: `${ha} md:flex-row md:gap-6`,
								"aria-label": I("manage:taste.peachViewing"),
								children: [/* @__PURE__ */ (0, X.jsxs)("div", {
									className: "flex shrink-0 flex-col gap-0.5 pb-5 md:w-72 md:pr-6 md:pb-0",
									children: [
										/* @__PURE__ */ (0, X.jsx)("span", {
											className: "text-caption-1-regular text-text-secondary",
											children: I("manage:taste.peachViewing")
										}),
										/* @__PURE__ */ (0, X.jsx)("b", {
											className: "text-display-4-medium tabular-nums text-text-primary",
											children: Number(A.peach_items || 0).toLocaleString()
										}),
										/* @__PURE__ */ (0, X.jsx)("span", {
											className: "text-body-2-regular text-text-secondary",
											children: I("manage:taste.watchedOrRatedUnit", { count: Number(A.peach_items || 0) })
										})
									]
								}), /* @__PURE__ */ (0, X.jsxs)("div", {
									className: "flex min-w-0 grow flex-col",
									children: [/* @__PURE__ */ (0, X.jsx)(Ka, {
										term: I("manage:taste.tagged"),
										value: ve,
										rest: j.untagged || 0
									}), /* @__PURE__ */ (0, X.jsx)(Ka, {
										term: I("manage:taste.identified"),
										value: ye,
										rest: j.unidentified || 0
									})]
								})]
							}),
							/* @__PURE__ */ (0, X.jsx)(Ba, {
								label: I("manage:taste.peachDimensions"),
								onSignal: o,
								panels: [
									{
										id: "tags",
										name: I("manage:shared.tags"),
										props: {
											rows: M.peach_tags || [],
											kind: "tag",
											visual: "none",
											empty: Ta
										}
									},
									{
										id: "creators",
										name: I("manage:shared.creators"),
										props: {
											rows: M.peach_creators || [],
											kind: "creator",
											visual: "creator",
											empty: Ea
										}
									},
									{
										id: "performers",
										name: I("manage:shared.actresses"),
										props: {
											rows: M.peach_performers || [],
											kind: "performer",
											visual: "entity",
											empty: Da
										}
									}
								]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, X.jsx)(Va, {
				data: O,
				onSignal: o,
				navigate: s
			}),
			/* @__PURE__ */ (0, X.jsx)(Wa, {
				sources: O.sources || [],
				browsers: O.browsers || [],
				window: d,
				toast: l,
				emptyActions: Ee
			})
		]
	}) });
}
function Ka({ term: e, value: t, rest: n }) {
	let r = Math.max(t + n, 1);
	return /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "flex flex-col gap-1.5 border-b border-separator-border py-3 last:border-b-0",
		children: [/* @__PURE__ */ (0, X.jsxs)("p", {
			className: "flex items-baseline justify-between gap-3 text-body-2-regular text-text-primary",
			children: [/* @__PURE__ */ (0, X.jsx)("span", { children: e }), /* @__PURE__ */ (0, X.jsxs)("b", {
				className: "tabular-nums",
				children: [t.toLocaleString(), /* @__PURE__ */ (0, X.jsx)("span", {
					className: "ml-1.5 text-caption-1-regular text-text-secondary",
					children: I("manage:taste.remainingCount", { count: n })
				})]
			})]
		}), /* @__PURE__ */ (0, X.jsx)(x, {
			meter: !0,
			label: I("manage:shared.termProgress", {
				term: e,
				value: t.toLocaleString(),
				total: r.toLocaleString()
			}),
			value: t,
			max: r
		})]
	});
}
export { Ma as TASTE_GUIDE_KEY, Ga as TastePage };

//# debugId=39dc6c95-e93d-48d3-b936-524cdaf5b11b