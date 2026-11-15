(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "71b6d25b-7de9-4beb-a74e-2838b25d7809", e._sentryDebugIdIdentifier = "sentry-dbid-71b6d25b-7de9-4beb-a74e-2838b25d7809");
	} catch {}
})();
import { $542a13ca2fa5b484$export$5b6b19405a83ff9d as e, $b4f18e3395fe64d7$export$3d96ec278d3efce4 as t, $b4f18e3395fe64d7$export$3e41faf802a29e71 as n, $b4f18e3395fe64d7$export$b2539bed5023c21c as r, Button as i, ButtonLink as a, Disclosure as o, E3 as s, EmptyState as c, FLOW_LABEL_X as l, FLOW_VIEWBOX as u, Gg as d, Input as f, M6 as p, MENU_ITEM as m, MENU_ITEM_INTERACTIVE as h, MENU_POPOVER_SURFACE as g, MenuDialog as _, Note as v, OV as y, Progress as b, Rf as x, SEGMENT as ee, SEGMENTED_TRACK as te, STAT_STRIP as ne, SegmentedTabList as re, Select$1 as ie, SelectItem as ae, StatCard as S, TASTE_REFRESH_KEY as oe, TASTE_REFRESH_TASK as se, TASTE_WINDOWS as ce, TaskProgress as le, Wt as C, Xt as ue, _8 as w, __toESM as de, aB as fe, activityKind as pe, avatarInner as me, busyProps as T, cB as he, cardClass as E, clsx as D, codedText as O, configureTasteBrowser as k, confirmModal as A, cx as j, errorMessage as M, f1 as N, fetchTaste as ge, fetchTasteJob as _e, firstGrapheme as ve, flowGraph as ye, flowLabel as be, fmtSize as xe, g4 as Se, historySpan as Ce, importTasteExport as we, jobText as Te, joinList as Ee, keepPreviousData as De, mM as Oe, pv as P, queryClient as F, r2 as ke, radarRows as Ae, rankDetail as je, rankShares as Me, removeTasteSource as Ne, require_jsx_runtime as Pe, require_react as Fe, serverLabel as Ie, serverLabelList as Le, siteMarkUrl as Re, startTasteRefresh as ze, statCardClass as Be, t as I, tasteDate as Ve, tasteDimensions as He, tasteHours as Ue, tasteKey as L, tasteRefetchInterval as We, tasteTime as Ge, topScores as Ke, uo as qe, useBackgroundJob as Je, useMutation as Ye, useQuery as Xe } from "./peach-app.js";
import { ActivityHeat as Ze, BAR_DOMAIN as Qe, ExpandableRanking as $e, PolarAngleAxis as et, Polygon as tt, barLabel as nt, selectPolarAxisScale as rt, selectPolarAxisTicks as R } from "./peach-app.expandable-ranking-msnIi2GJ.js";
import { LEGACY_AVATAR_IMG as it } from "./peach-app.legacy-avatar-NSITxLRS.js";
import { Page as at } from "./peach-app.page-QAncjzM1.js";
import { ActivePoints as ot, AnimatedItems as st, CHART_CARD as ct, CHART_COLORS as lt, CartesianLabelListContextProvider as ut, CategoryTick as dt, ChartBackground as ft, ChartContainer as pt, ChartHead as mt, ChartLegend as ht, ChartLegendContent as gt, ChartTip as _t, ChartTooltip as vt, ChartTooltipContent as yt, DefaultZIndexes as bt, Dots as xt, EvilBarChart as St, LabelListFromLabelProp as Ct, Layer as z, LoadingIndicator as wt, PolarChart as Tt, PolarLabelContextProvider as Et, PolarLabelFromLabelProp as Dt, RegisterGraphicalItemId as Ot, SetPolarGraphicalItem as kt, SetPolarLegendPayload as At, SetTooltipEntrySettings as jt, Text as Mt, ZIndexLayer as Nt, adaptEventsOfChild as Pt, addRadiusAxis as Ft, arrayTooltipSearcher as It, categoryAxisWidth as Lt, cn as Rt, createSelector as B, defaultPolarChartProps as zt, defaultPolarRadiusAxisProps as Bt, fitLabel as Vt, getAxisTypeBasedOnLayout as Ht, getBandSizeOfAxis as Ut, getClassNameFromUnknown as Wt, getColorsCount as Gt, getTooltipNameProp as Kt, getValueByDataKey as qt, identity as Jt, interpolate as Yt, isArrayLike as Xt, isCategoricalAxis as Zt, isNullish as Qt, iteratee as $t, matchAnimationItems as en, matchByIndex as tn, noop as nn, polarToCartesian as V, removeRadiusAxis as rn, resolveDefaultProps as an, selectAngleAxis as on, selectChartDataAndAlwaysIgnoreIndexes as sn, selectChartLayout as cn, selectPolarViewBox as ln, selectRadiusAxis as un, selectUnfilteredPolarItems as dn, svgPropertiesAndEvents as fn, svgPropertiesNoEvents as H, svgPropertiesNoEventsFromUnknown as pn, tone as mn, useAnimationCallbacks as hn, useAnimationStartSnapshot as gn, useAppDispatch as _n, useAppSelector as U, useIsPanorama as vn, usePolarChartLayout as yn } from "./peach-app.chart-tip-CRxYp6KT.js";
import { BrowserIcon as bn } from "./peach-app.browser-icon-N9Od-bAf.js";
var xn = B([(e, t) => R(e, "angleAxis", t, !1)], (e) => {
	if (e) return e.map((e) => e.coordinate);
}), Sn = B([(e, t) => R(e, "radiusAxis", t, !1)], (e) => {
	if (e) return e.map((e) => e.coordinate);
}), W = /* @__PURE__ */ de(Fe()), Cn = [
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
function wn(e, t) {
	if (e == null) return {};
	var n, r, i = Tn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Tn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function G() {
	return G = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, G.apply(null, arguments);
}
function En(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Dn(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? En(Object(n), !0).forEach(function(t) {
			On(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : En(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function On(e, t, n) {
	return (t = kn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function kn(e) {
	var t = An(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function An(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var jn = (e, t, n, r) => {
	var i = "";
	return r.forEach((r, a) => {
		var o = V(t, n, e, r);
		i += a ? `L ${o.x},${o.y}` : `M ${o.x},${o.y}`;
	}), i += "Z", i;
}, Mn = (e) => {
	var t = e.cx, n = e.cy, r = e.innerRadius, i = e.outerRadius, a = e.polarAngles, o = e.radialLines;
	if (!a || !a.length || !o) return null;
	var s = Dn({}, H(e));
	return /*#__PURE__*/ W.createElement("g", { className: "recharts-polar-grid-angle" }, a.map((e) => {
		var a = V(t, n, r, e), o = V(t, n, i, e);
		return /*#__PURE__*/ W.createElement("line", G({ key: `line-${e}` }, s, {
			x1: a.x,
			y1: a.y,
			x2: o.x,
			y2: o.y
		}));
	}));
}, Nn = (e) => {
	var t = e.cx, n = e.cy, r = e.radius, i = Dn({}, H(e));
	return /*#__PURE__*/ W.createElement("circle", G({}, i, {
		className: D("recharts-polar-grid-concentric-circle", e.className),
		cx: t,
		cy: n,
		r
	}));
}, Pn = (e) => {
	var t = e.radius, n = Dn({}, H(e));
	return /*#__PURE__*/ W.createElement("path", G({}, n, {
		className: D("recharts-polar-grid-concentric-polygon", e.className),
		d: jn(t, e.cx, e.cy, e.polarAngles)
	}));
}, Fn = (e) => {
	var t = e.polarRadius, n = e.gridType;
	if (!t || !t.length) return null;
	var r = Math.max(...t), i = e.fill && e.fill !== "none";
	return /*#__PURE__*/ W.createElement("g", { className: "recharts-polar-grid-concentric" }, i && n === "circle" && /*#__PURE__*/ W.createElement(Nn, G({}, e, { radius: r })), i && n !== "circle" && /*#__PURE__*/ W.createElement(Pn, G({}, e, { radius: r })), t.map((t, r) => {
		var i = r;
		return n === "circle" ? /*#__PURE__*/ W.createElement(Nn, G({ key: i }, e, {
			fill: "none",
			radius: t
		})) : /*#__PURE__*/ W.createElement(Pn, G({ key: i }, e, {
			fill: "none",
			radius: t
		}));
	}));
}, In = {
	angleAxisId: 0,
	radiusAxisId: 0,
	gridType: "polygon",
	radialLines: !0,
	zIndex: bt.grid,
	stroke: "#ccc",
	strokeWidth: 1,
	fill: "none"
}, Ln = (e) => {
	var t = an(e, In), n = t.gridType, r = t.radialLines, i = t.angleAxisId, a = t.radiusAxisId, o = t.cx, s = t.cy, c = t.innerRadius, l = t.outerRadius, u = t.polarAngles, d = t.polarRadius, f = t.zIndex, p = wn(t, Cn), m = U(ln), h = U((e) => xn(e, i)), g = U((e) => Sn(e, a)), _ = Array.isArray(u) ? u : h, v = Array.isArray(d) ? d : g;
	if (_ == null || v == null) return null;
	var y = Dn({
		cx: m?.cx ?? o ?? 0,
		cy: m?.cy ?? s ?? 0,
		innerRadius: m?.innerRadius ?? c ?? 0,
		outerRadius: m?.outerRadius ?? l ?? 0,
		polarAngles: _,
		polarRadius: v,
		zIndex: f
	}, p);
	return y.outerRadius <= 0 ? null : /*#__PURE__*/ W.createElement(Nt, { zIndex: y.zIndex }, /*#__PURE__*/ W.createElement("g", { className: "recharts-polar-grid" }, /*#__PURE__*/ W.createElement(Fn, G({
		gridType: n,
		radialLines: r
	}, y, {
		polarAngles: _,
		polarRadius: v
	})), /*#__PURE__*/ W.createElement(Mn, G({
		gridType: n,
		radialLines: r
	}, y, {
		polarAngles: _,
		polarRadius: v
	}))));
};
Ln.displayName = "PolarGrid";
// node_modules/es-toolkit/dist/compat/_internal/toArray.mjs
function Rn(e) {
	return Array.isArray(e) ? e : Array.from(e);
}
// node_modules/es-toolkit/dist/compat/math/maxBy.mjs
function zn(e, t = Jt) {
	if (e == null) return;
	let n = Rn(e);
	if (n.length === 0) return;
	let r = $t(t), i, a;
	for (let e = 0; e < n.length; e++) {
		let t = n[e], o = r(t, e, n);
		o == null || Number.isNaN(o) || typeof o == "symbol" || (a === void 0 || o > a) && (a = o, i = t);
	}
	return i;
}
// node_modules/es-toolkit/dist/compat/math/minBy.mjs
function Bn(e, t = Jt) {
	if (e == null) return;
	let n = Rn(e);
	if (n.length === 0) return;
	let r = $t(t), i, a;
	for (let e = 0; e < n.length; e++) {
		let t = n[e], o = r(t, e, n);
		o == null || Number.isNaN(o) || typeof o == "symbol" || (a === void 0 || o < a) && (a = o, i = t);
	}
	return i;
}
// node_modules/recharts/es6/polar/PolarRadiusAxis.js
var Vn = ["type"], Hn = [
	"cx",
	"cy",
	"angle",
	"axisLine"
], Un = [
	"angle",
	"tickFormatter",
	"stroke",
	"tick"
];
function K() {
	return K = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, K.apply(null, arguments);
}
function Wn(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function q(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Wn(Object(n), !0).forEach(function(t) {
			Gn(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Wn(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Gn(e, t, n) {
	return (t = Kn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Kn(e) {
	var t = qn(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function qn(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function Jn(e, t) {
	if (e == null) return {};
	var n, r, i = Yn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Yn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var Xn = "radiusAxis";
function Zn(e) {
	var t = _n(), n = yn(), r = (0, W.useMemo)(() => {
		var t = e.type, r = Jn(e, Vn), i = Ht(n, "radiusAxis", t);
		if (i != null) return q(q({}, r), {}, { type: i });
	}, [e, n]);
	return (0, W.useEffect)(() => r == null ? nn : (t(Ft(r)), () => {
		t(rn(r));
	}), [t, r]), null;
}
var Qn = (e, t, n, r) => {
	var i = e.coordinate;
	return V(n, r, i, t);
}, $n = (e) => {
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
}, er = (e, t, n, r) => {
	var i = zn(r, (e) => e.coordinate || 0);
	return {
		cx: t,
		cy: n,
		startAngle: e,
		endAngle: e,
		innerRadius: Bn(r, (e) => e.coordinate || 0)?.coordinate || 0,
		outerRadius: i?.coordinate || 0,
		clockWise: !1
	};
}, tr = (e, t) => {
	var n = e.cx, r = e.cy, i = e.angle, a = e.axisLine, o = Jn(e, Hn), s = t.reduce((e, t) => [Math.min(e[0], t.coordinate), Math.max(e[1], t.coordinate)], [Infinity, -Infinity]), c = V(n, r, s[0], i), l = V(n, r, s[1], i), u = q(q(q({}, H(o)), {}, { fill: "none" }, H(a)), {}, {
		x1: c.x,
		y1: c.y,
		x2: l.x,
		y2: l.y
	});
	return /*#__PURE__*/ W.createElement("line", K({ className: "recharts-polar-radius-axis-line" }, u));
}, nr = (e, t, n) => /*#__PURE__*/ W.isValidElement(e) ? /*#__PURE__*/ W.cloneElement(e, t) : typeof e == "function" ? e(t) : /*#__PURE__*/ W.createElement(Mt, K({}, t, { className: "recharts-polar-radius-axis-tick-value" }), n), rr = (e, t) => {
	var n = e.angle, r = e.tickFormatter, i = e.stroke, a = e.tick, o = Jn(e, Un), s = $n(e.orientation), c = H(o), l = pn(a), u = t.map((t, o) => {
		var u = Qn(t, e.angle, e.cx, e.cy), d = q(q(q(q({
			textAnchor: s,
			transform: `rotate(${90 - n}, ${u.x}, ${u.y})`
		}, c), {}, {
			stroke: "none",
			fill: i
		}, l), {}, { index: o }, u), {}, { payload: t });
		return /*#__PURE__*/ W.createElement(z, K({
			className: D("recharts-polar-radius-axis-tick", Wt(a)),
			key: `tick-${t.coordinate}`
		}, Pt(e, t, o)), nr(a, d, r ? r(t.value, o) : t.value));
	});
	return /*#__PURE__*/ W.createElement(z, { className: "recharts-polar-radius-axis-ticks" }, u);
}, ir = (e) => {
	var t = e.radiusAxisId, n = U(ln), r = U((e) => rt(e, "radiusAxis", t)), i = U((e) => R(e, "radiusAxis", t, !1));
	if (n == null || !i || !i.length || r == null) return null;
	var a = q(q({}, e), {}, { scale: r }, n), o = a.tick, s = a.axisLine;
	return /*#__PURE__*/ W.createElement(Nt, { zIndex: a.zIndex }, /*#__PURE__*/ W.createElement(z, { className: D("recharts-polar-radius-axis", Xn, a.className) }, s && tr(a, i), o && rr(a, i), /*#__PURE__*/ W.createElement(Et, er(a.angle, a.cx, a.cy, i), /*#__PURE__*/ W.createElement(Dt, { label: a.label }), a.children)));
};
function ar(e) {
	var t = an(e, Bt);
	return /*#__PURE__*/ W.createElement(W.Fragment, null, /*#__PURE__*/ W.createElement(Zn, {
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
	}), /*#__PURE__*/ W.createElement(ir, t));
}
ar.displayName = "PolarRadiusAxis";
// node_modules/es-toolkit/dist/array/last.mjs
function or(e) {
	return e[e.length - 1];
}
// node_modules/es-toolkit/dist/compat/array/last.mjs
function sr(e) {
	if (Xt(e) && e.length !== 0) return or(Rn(e));
}
// node_modules/recharts/es6/state/selectors/radarSelectors.js
function cr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function lr(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? cr(Object(n), !0).forEach(function(t) {
			ur(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : cr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function ur(e, t, n) {
	return (t = dr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function dr(e) {
	var t = fr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function fr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var pr = (e, t) => rt(e, "radiusAxis", t), mr = B([pr], (e) => {
	if (e != null) return { scale: e };
}), hr = B([un, pr], (e, t) => {
	if (e != null && t != null) return lr(lr({}, e), {}, { scale: t });
}), gr = (e, t, n, r) => R(e, "radiusAxis", t, r), _r = (e, t, n) => on(e, n), vr = (e, t, n) => rt(e, "angleAxis", n), yr = B([_r, vr], (e, t) => {
	if (e != null && t != null) return lr(lr({}, e), {}, { scale: t });
}), br = (e, t, n, r) => R(e, "angleAxis", n, r), xr = B([
	_r,
	vr,
	ln
], (e, t, n) => {
	if (n != null && t != null) return {
		scale: t,
		type: e.type,
		dataKey: e.dataKey,
		cx: n.cx,
		cy: n.cy
	};
}), Sr = (e, t, n, r, i) => i, Cr = B([
	cn,
	hr,
	gr,
	yr,
	br
], (e, t, n, r, i) => Zt(e, "radiusAxis") ? Ut(t, n, !1) : Ut(r, i, !1)), wr = B([dn, Sr], (e, t) => {
	if (e != null) return e.find((e) => e.type === "radar" && t === e.id)?.dataKey;
}), Tr = B([
	mr,
	xr,
	sn,
	wr,
	Cr
], (e, t, n, r, i) => {
	var a = n.chartData, o = n.dataStartIndex, s = n.dataEndIndex;
	if (e != null && t != null && a != null && i != null && r != null) return Lr({
		radiusAxis: e,
		angleAxis: t,
		displayedData: a.slice(o, s + 1),
		dataKey: r,
		bandSize: i
	});
}), Er = ["id"];
function J() {
	return J = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, J.apply(null, arguments);
}
function Dr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Y(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? Dr(Object(n), !0).forEach(function(t) {
			Or(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Dr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Or(e, t, n) {
	return (t = kr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function kr(e) {
	var t = Ar(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Ar(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function jr(e, t) {
	if (e == null) return {};
	var n, r, i = Mr(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Mr(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
function Nr(e, t) {
	return e && e !== "none" ? e : t;
}
var Pr = (e) => {
	var t = e.dataKey, n = e.name, r = e.stroke, i = e.fill, a = e.legendType;
	return [{
		inactive: e.hide,
		dataKey: t,
		type: a,
		color: Nr(r, i),
		value: Kt(n, t),
		payload: e
	}];
}, Fr = /*#__PURE__*/ W.memo((e) => {
	var t = e.dataKey, n = e.stroke, r = e.strokeWidth, i = e.fill, a = e.name, o = e.hide, s = e.tooltipType, c = e.id, l = {
		dataDefinedOnItem: void 0,
		getPosition: nn,
		settings: {
			stroke: n,
			strokeWidth: r,
			fill: i,
			nameKey: void 0,
			dataKey: t,
			name: Kt(a, t),
			hide: o,
			type: s,
			color: Nr(n, i),
			unit: "",
			graphicalItemId: c
		}
	};
	return /*#__PURE__*/ W.createElement(jt, { tooltipEntrySettings: l });
});
function Ir(e) {
	var t = e.points, n = e.props, r = n.dot, i = n.dataKey;
	n.id;
	var a = jr(n, Er), o = H(a);
	return /*#__PURE__*/ W.createElement(xt, {
		points: t,
		dot: r,
		className: "recharts-radar-dots",
		dotClassName: "recharts-radar-dot",
		dataKey: i,
		baseProps: o
	});
}
function Lr(e) {
	var t = e.radiusAxis, n = e.angleAxis, r = e.displayedData, i = e.dataKey, a = e.bandSize, o = n.cx, s = n.cy, c = !1, l = [], u = n.type === "number" ? 0 : a ?? 0;
	r.forEach((e, r) => {
		var a = qt(e, n.dataKey, r), d = qt(e, i), f = (n.scale.map(a) ?? 0) + u, p = Array.isArray(d) ? sr(d) : d, m = Qt(p) ? 0 : t.scale.map(p) ?? 0;
		Array.isArray(d) && d.length >= 2 && (c = !0), l.push(Y(Y({}, V(o, s, m, f)), {}, {
			name: a,
			value: d,
			cx: o,
			cy: s,
			radius: m,
			angle: f,
			payload: e
		}));
	});
	var d = [];
	return c && l.forEach((e) => {
		if (Array.isArray(e.value)) {
			var n = e.value[0], r = Qt(n) ? 0 : t.scale.map(n) ?? 0;
			d.push(Y(Y({}, e), {}, { radius: r }, V(o, s, r, e.angle)));
		} else d.push(e);
	}), {
		points: l,
		isRange: c,
		baseLinePoints: d
	};
}
function Rr(e) {
	var t = e.showLabels, n = e.points, r = e.children, i = n.map((e) => {
		var t = {
			x: e.x,
			y: e.y,
			width: 0,
			lowerWidth: 0,
			upperWidth: 0,
			height: 0
		};
		return Y(Y({}, t), {}, {
			value: e.value ?? "",
			payload: e.payload,
			parentViewBox: void 0,
			viewBox: t,
			fill: void 0
		});
	});
	return /*#__PURE__*/ W.createElement(ut, { value: t ? i : void 0 }, r);
}
function zr(e) {
	var t = e.points, n = e.baseLinePoints, r = e.props;
	if (t == null) return null;
	var i = r.shape, a = r.isRange, o = r.connectNulls, s = /*#__PURE__*/ W.isValidElement(i) ? /*#__PURE__*/ W.cloneElement(i, Y(Y({}, r), {}, { points: t })) : typeof i == "function" ? i(Y(Y({}, r), {}, { points: t })) : /*#__PURE__*/ W.createElement(tt, J({}, fn(r), {
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
	return /*#__PURE__*/ W.createElement(z, { className: "recharts-radar-polygon" }, s, /*#__PURE__*/ W.createElement(Ir, {
		props: r,
		points: t
	}));
}
var Br = (e, t) => e == null ? [] : t === 1 ? e.flatMap((e) => e.status === "removed" ? [] : [e.next]) : e.flatMap((e) => e.status === "removed" ? [] : e.status === "matched" ? [Y(Y({}, e.next), {}, {
	x: Yt(e.prev.x, e.next.x, t),
	y: Yt(e.prev.y, e.next.y, t)
})] : [Y(Y({}, e.next), {}, {
	x: Yt(e.next.cx, e.next.x, t),
	y: Yt(e.next.cy, e.next.y, t)
})]);
function Vr(e) {
	var t = e.props, n = e.previousPointsRef, r = e.previousBaseLinePointsRef, i = t.points, a = t.baseLinePoints, o = t.isAnimationActive, s = t.animationBegin, c = t.animationDuration, l = t.animationEasing, u = t.animationMatchBy, d = t.animationInterpolateFn, f = t.onAnimationStart, p = t.onAnimationEnd, m = gn(t, r), h = m.startValue, g = en(h ?? null, a, u), _ = hn(f, p), v = _.isAnimating, y = _.handleAnimationStart, b = _.handleAnimationEnd, x = yn();
	return x == null ? null : /*#__PURE__*/ W.createElement(Rr, {
		showLabels: !v,
		points: i
	}, /*#__PURE__*/ W.createElement(st, {
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
		return m.syncStepValue(r, n), /*#__PURE__*/ W.createElement(zr, {
			points: e,
			baseLinePoints: r,
			props: t
		});
	}), /*#__PURE__*/ W.createElement(Ct, { label: t.label }), t.children);
}
function Hr(e) {
	var t = (0, W.useRef)(void 0), n = (0, W.useRef)(void 0);
	return /*#__PURE__*/ W.createElement(Vr, {
		props: e,
		previousPointsRef: t,
		previousBaseLinePointsRef: n
	});
}
var Ur = {
	activeDot: !0,
	angleAxisId: 0,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationMatchBy: tn,
	animationInterpolateFn: Br,
	dot: !1,
	hide: !1,
	isAnimationActive: "auto",
	label: !1,
	legendType: "rect",
	radiusAxisId: 0,
	zIndex: bt.area
};
function Wr(e) {
	var t = e.hide, n = e.className, r = e.points;
	if (t) return null;
	var i = D("recharts-radar", n);
	return /*#__PURE__*/ W.createElement(Nt, { zIndex: e.zIndex }, /*#__PURE__*/ W.createElement(z, { className: i }, /*#__PURE__*/ W.createElement(Hr, e)), /*#__PURE__*/ W.createElement(ot, {
		points: r,
		mainColor: Nr(e.stroke, e.fill),
		itemDataKey: e.dataKey,
		activeDot: e.activeDot
	}));
}
function Gr(e) {
	var t = vn(), n = U((n) => Tr(n, e.radiusAxisId, e.angleAxisId, t, e.id));
	return n?.points == null ? null : /*#__PURE__*/ W.createElement(Wr, J({}, e, {
		points: n?.points,
		baseLinePoints: n?.baseLinePoints,
		isRange: n?.isRange
	}));
}
function Kr(e) {
	var t = an(e, Ur);
	return /*#__PURE__*/ W.createElement(Ot, {
		id: t.id,
		type: "radar"
	}, (e) => /*#__PURE__*/ W.createElement(W.Fragment, null, /*#__PURE__*/ W.createElement(kt, {
		type: "radar",
		id: e,
		data: void 0,
		dataKey: t.dataKey,
		hide: t.hide,
		angleAxisId: t.angleAxisId,
		radiusAxisId: t.radiusAxisId
	}), /*#__PURE__*/ W.createElement(At, { legendPayload: Pr(t) }), /*#__PURE__*/ W.createElement(Fr, {
		dataKey: t.dataKey,
		stroke: t.stroke,
		strokeWidth: t.strokeWidth,
		fill: t.fill,
		name: t.name,
		hide: t.hide,
		tooltipType: t.tooltipType,
		id: e
	}), /*#__PURE__*/ W.createElement(Gr, J({}, t, { id: e }))));
}
Kr.displayName = "Radar";
// node_modules/recharts/es6/chart/RadarChart.js
function qr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function Jr(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? qr(Object(n), !0).forEach(function(t) {
			Yr(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : qr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Yr(e, t, n) {
	return (t = Xr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Xr(e) {
	var t = Zr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Zr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var Qr = ["axis"], $r = Jr(Jr({}, zt), {}, {
	layout: "centric",
	startAngle: 90,
	endAngle: -270
}), ei = /*#__PURE__*/ (0, W.forwardRef)((e, t) => {
	var n = an(e, $r);
	return /*#__PURE__*/ W.createElement(Tt, {
		chartName: "RadarChart",
		defaultTooltipEventType: "axis",
		validateTooltipEventTypes: Qr,
		tooltipPayloadSearcher: It,
		categoricalChartProps: n,
		ref: t
	});
}), X = Pe(), ti = W.memo(function({ cx: e, cy: t, dataKey: n, chartId: r, className: i, fillOpacity: a = 1, type: o = "default", maskId: s }) {
	let c = W.useId().replace(/:/g, ""), l = `url(#${r}-colors-${String(n)})`;
	if (e === void 0 || t === void 0) return null;
	switch (o) {
		case "border": return /* @__PURE__ */ (0, X.jsx)(ri, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
		case "colored-border": return /* @__PURE__ */ (0, X.jsx)(ii, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
		default: return /* @__PURE__ */ (0, X.jsx)(ni, {
			cx: e,
			cy: t,
			dotId: c,
			fillOpacity: a,
			gradientUrl: l,
			className: i,
			maskId: s
		});
	}
}), ni = W.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
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
ni.displayName = "DefaultDot";
var ri = W.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
	className: Rt(a, "text-background"),
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
ri.displayName = "PrimaryBorderDot";
var ii = W.memo(({ cx: e, cy: t, dotId: n, fillOpacity: r, gradientUrl: i, className: a, maskId: o }) => /* @__PURE__ */ (0, X.jsxs)("g", {
	className: Rt(a, "text-background"),
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
ii.displayName = "ColoredBorderDot";
// src/react/evilcharts/registry/charts/recharts-radar-chart.tsx
var ai = 1, oi = .3, si = 6, ci = 1500, li = "value", ui = (0, W.createContext)(null);
function Z() {
	let e = (0, W.use)(ui);
	if (!e) throw Error("Radar chart parts (<Radar />, <PolarAngleAxis />, …) must be used within <EvilRadarChart />");
	return e;
}
function Q({ config: e, data: t, children: n, className: r, chartProps: i, backgroundVariant: a, defaultSelectedDataKey: o = null, onSelectionChange: s, isLoading: c = !1, loadingPoints: l }) {
	let u = (0, W.useId)().replace(/:/g, ""), [d, f] = (0, W.useState)(o), p = Ei(c, l), m = (0, W.useCallback)((e) => {
		f(e), s?.(e);
	}, [s]), h = (0, W.useMemo)(() => ({
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
	return /* @__PURE__ */ (0, X.jsx)(ui, {
		value: h,
		children: /* @__PURE__ */ (0, X.jsxs)(pt, {
			className: r,
			config: e,
			children: [/* @__PURE__ */ (0, X.jsx)(wt, { isLoading: c }), /* @__PURE__ */ (0, X.jsxs)(ei, {
				id: u,
				data: c ? p : t,
				...i,
				children: [
					a && /* @__PURE__ */ (0, X.jsx)(ft, { variant: a }),
					n,
					c && /* @__PURE__ */ (0, X.jsx)(Di, {})
				]
			})]
		})
	});
}
function di({ dataKey: e, variant: t = "filled", fillOpacity: n = oi, isGlowing: r = !1, isClickable: i = !1, children: a, radarProps: o }) {
	let { config: s, isLoading: c, selectedDataKey: l, selectDataKey: u } = Z(), d = (0, W.useId)().replace(/:/g, "");
	if (c) return null;
	let f = i && l !== null && l !== e, p = {
		stroke: f ? .2 : 1,
		fill: f ? .1 : 1,
		dot: f ? .2 : 1
	}, m = t === "filled", { dot: h, activeDot: g } = yi(a, d, e, p.dot);
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsx)(Kr, {
		dataKey: e,
		stroke: `url(#${d}-radar-stroke-${e})`,
		strokeOpacity: p.stroke,
		strokeWidth: ai,
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
		/* @__PURE__ */ (0, X.jsx)(xi, {
			id: d,
			dataKey: e,
			config: s
		}),
		/* @__PURE__ */ (0, X.jsx)(Si, {
			id: d,
			dataKey: e,
			config: s
		}),
		m && /* @__PURE__ */ (0, X.jsx)(Ci, {
			id: d,
			dataKey: e,
			config: s
		}),
		r && /* @__PURE__ */ (0, X.jsx)(wi, {
			id: d,
			dataKey: e
		})
	] })] });
}
var fi = () => null, pi = () => null;
function mi({ gridType: e = "polygon", stroke: t = "currentColor", strokeOpacity: n = .2, strokeDasharray: r = "3 4", ...i }) {
	return /* @__PURE__ */ (0, X.jsx)(Ln, {
		gridType: e,
		stroke: t,
		strokeOpacity: n,
		strokeDasharray: r,
		...i
	});
}
function hi({ tick: e = {
	fill: "currentColor",
	fontSize: 12
}, tickLine: t = !1, ...n }) {
	let { isLoading: r } = Z();
	return r ? null : /* @__PURE__ */ (0, X.jsx)(et, {
		tick: e,
		tickLine: t,
		...n
	});
}
function gi({ tick: e = {
	fill: "currentColor",
	fontSize: 10
}, tickLine: t = !1, axisLine: n = !1, ...r }) {
	let { isLoading: i } = Z();
	return i ? null : /* @__PURE__ */ (0, X.jsx)(ar, {
		tick: e,
		tickLine: t,
		axisLine: n,
		...r
	});
}
function _i({ variant: e, roundness: t, defaultIndex: n }) {
	let { isLoading: r, selectedDataKey: i } = Z();
	return r ? null : /* @__PURE__ */ (0, X.jsx)(vt, {
		defaultIndex: n,
		cursor: !1,
		content: /* @__PURE__ */ (0, X.jsx)(yt, {
			selected: i,
			roundness: t,
			variant: e
		})
	});
}
function vi({ variant: e, align: t = "center", verticalAlign: n = "bottom", isClickable: r = !1 }) {
	let { isLoading: i, selectedDataKey: a, selectDataKey: o } = Z();
	return i ? null : /* @__PURE__ */ (0, X.jsx)(ht, {
		verticalAlign: n,
		align: t,
		content: /* @__PURE__ */ (0, X.jsx)(gt, {
			selected: a,
			onSelectChange: o,
			isClickable: r,
			variant: e
		})
	});
}
var yi = (e, t, n, r) => {
	let i = !1, a = !1;
	return W.Children.forEach(e, (e) => {
		if ((0, W.isValidElement)(e)) {
			if (e.type === fi) {
				let { variant: a } = e.props;
				i = /* @__PURE__ */ (0, X.jsx)(ti, {
					type: a,
					dataKey: n,
					chartId: t,
					fillOpacity: r
				});
			}
			if (e.type === pi) {
				let { variant: i } = e.props;
				a = /* @__PURE__ */ (0, X.jsx)(ti, {
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
}, bi = ({ dataKey: e, colorsCount: t, opacities: n }) => t === 1 ? /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsx)("stop", {
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
}) }), xi = ({ id: e, dataKey: t, config: n }) => {
	let r = Gt(n[t] ?? {});
	return /* @__PURE__ */ (0, X.jsx)("linearGradient", {
		id: `${e}-colors-${t}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "0",
		children: /* @__PURE__ */ (0, X.jsx)(bi, {
			dataKey: t,
			colorsCount: r
		})
	});
}, Si = ({ id: e, dataKey: t, config: n }) => {
	let r = Gt(n[t] ?? {});
	return /* @__PURE__ */ (0, X.jsx)("linearGradient", {
		id: `${e}-radar-stroke-${t}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "1",
		children: /* @__PURE__ */ (0, X.jsx)(bi, {
			dataKey: t,
			colorsCount: r
		})
	});
}, Ci = ({ id: e, dataKey: t, config: n }) => {
	let r = Gt(n[t] ?? {}), i = r === 1 ? [.8, .3] : Array.from({ length: r }, (e, t) => t === 0 ? .8 : .3);
	return /* @__PURE__ */ (0, X.jsx)("radialGradient", {
		id: `${e}-radar-fill-${t}`,
		cx: "50%",
		cy: "50%",
		r: "50%",
		children: /* @__PURE__ */ (0, X.jsx)(bi, {
			dataKey: t,
			colorsCount: r,
			opacities: i
		})
	});
}, wi = ({ id: e, dataKey: t }) => /* @__PURE__ */ (0, X.jsxs)("filter", {
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
}), Ti = (e) => [
	"A",
	"B",
	"C",
	"D",
	"E",
	"F"
].slice(0, e).map((e) => ({
	skill: e,
	[li]: 30 + Math.random() * 70
}));
function Ei(e, t = si) {
	let [n, r] = (0, W.useState)(0);
	return (0, W.useEffect)(() => {
		if (!e) return;
		let t = setInterval(() => {
			r((e) => e + 1);
		}, ci);
		return () => clearInterval(t);
	}, [e]), (0, W.useMemo)(() => Ti(t), [t, n]);
}
var Di = () => /* @__PURE__ */ (0, X.jsx)(Kr, {
	dataKey: li,
	stroke: "currentColor",
	strokeOpacity: .3,
	strokeWidth: 2,
	fill: "currentColor",
	fillOpacity: .1,
	dot: !1,
	isAnimationActive: !0,
	animationDuration: ci,
	animationEasing: "ease-in-out"
});
Q.Radar = di, Q.Dot = fi, Q.ActiveDot = pi, Q.PolarGrid = mi, Q.PolarAngleAxis = hi, Q.PolarRadiusAxis = gi, Q.Tooltip = _i, Q.Legend = vi;
// src/react/taste/charts.tsx
function Oi(e) {
	let { x: t = 0, cx: n, textAnchor: r, payload: i, ...a } = e, o = String(i?.value ?? ""), s = typeof n == "number" ? n * 2 : 0, c = s ? r === "start" ? s - t : r === "end" ? t : 2 * Math.min(t, s - t) : 56;
	return /* @__PURE__ */ (0, X.jsxs)("g", { children: [/* @__PURE__ */ (0, X.jsx)("title", { children: o }), /* @__PURE__ */ (0, X.jsx)(Mt, {
		...a,
		x: t,
		textAnchor: r,
		fill: "currentColor",
		fontSize: 12,
		children: Vt(o, c - 4)
	})] });
}
var ki = [
	"stroke-chart-1",
	"stroke-chart-2",
	"stroke-chart-3",
	"stroke-chart-4",
	"stroke-chart-5",
	"stroke-chart-6"
], Ai = [
	"fill-chart-1",
	"fill-chart-2",
	"fill-chart-3",
	"fill-chart-4",
	"fill-chart-5",
	"fill-chart-6"
], ji = { value: {
	label: I("manage:tasteCharts.tagOccurrences"),
	colors: mn(lt[3])
} }, Mi = [
	"min-h-24",
	"min-h-24",
	"min-h-24",
	"min-h-32",
	"min-h-40",
	"min-h-48",
	"min-h-52",
	"min-h-60",
	"min-h-64"
], Ni = 26, Pi = { radius: ji.value }, Fi = (e, t) => Math.sqrt(e / t);
function Ii({ rows: e, label: t }) {
	let n = Ae(e);
	if (!n.length) return null;
	let r = n[0].value, i = n.map((e) => ({
		...e,
		radius: Fi(e.value, r)
	}));
	return /* @__PURE__ */ (0, X.jsx)("div", {
		role: "img",
		"aria-label": I("manage:tasteCharts.radarSummary", {
			label: t,
			items: Ee(i.map((e) => e.name))
		}),
		children: /* @__PURE__ */ (0, X.jsxs)(Q, {
			data: i,
			config: Pi,
			chartProps: { outerRadius: "58%" },
			className: "aspect-auto h-70 text-text-secondary",
			children: [
				/* @__PURE__ */ (0, X.jsx)(Q.PolarGrid, {}),
				/* @__PURE__ */ (0, X.jsx)(Q.PolarAngleAxis, {
					dataKey: "name",
					tick: /* @__PURE__ */ (0, X.jsx)(Oi, {})
				}),
				/* @__PURE__ */ (0, X.jsx)(Q.PolarRadiusAxis, {
					domain: [0, 1],
					allowDecimals: !0,
					tick: !1
				}),
				/* @__PURE__ */ (0, X.jsx)(Q.Radar, { dataKey: "radius" }),
				/* @__PURE__ */ (0, X.jsx)(_t, { valueKey: "value" })
			]
		})
	});
}
function Li({ rows: e, label: t }) {
	let n = Ke(e, 8);
	return n.length ? /* @__PURE__ */ (0, X.jsx)("section", {
		"aria-label": t,
		className: `flex grow flex-col ${Mi[n.length]}`,
		children: /* @__PURE__ */ (0, X.jsxs)(St, {
			data: n,
			config: ji,
			layout: "horizontal",
			barRadius: 4,
			chartProps: {
				maxBarSize: Ni,
				margin: {
					top: 5,
					right: 56,
					bottom: 5,
					left: 5
				}
			},
			className: "aspect-auto text-text-secondary",
			children: [
				/* @__PURE__ */ (0, X.jsx)(St.YAxis, {
					dataKey: "name",
					interval: 0,
					tick: /* @__PURE__ */ (0, X.jsx)(dt, { along: "y" }),
					width: Lt(n.map((e) => e.name))
				}),
				/* @__PURE__ */ (0, X.jsx)(St.XAxis, {
					hide: !0,
					domain: Qe
				}),
				/* @__PURE__ */ (0, X.jsx)(St.Bar, {
					dataKey: "value",
					enableHoverHighlight: !0,
					barProps: {
						dataKey: "value",
						label: nt("right")
					}
				}),
				/* @__PURE__ */ (0, X.jsx)(_t, {})
			]
		})
	}) : null;
}
function Ri({ flows: e }) {
	let [t, n] = (0, W.useState)(null), r = ye(e);
	if (!r) return null;
	let i = t?.node ?? null, a = (e, n) => t ? i === null ? t.label === n : e.source === i || e.target === i : !0;
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: ct,
		children: [
			/* @__PURE__ */ (0, X.jsx)(mt, {
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
						className: `outline-none transition-opacity ${ki[e.color]}`,
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
							className: e.side === "source" ? Ai[e.color] : "fill-text-secondary"
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
var zi = "flex min-w-0 items-center gap-3 rounded-xl bg-background-primary-default p-3";
function Bi({ browsers: e, sources: t, range: n, children: r }) {
	let [a, o] = (0, W.useState)(!1), [s, c] = (0, W.useState)(""), [l, u] = (0, W.useState)(""), m = Ye({
		mutationFn: (e) => k(e, n),
		onSuccess: (e) => {
			F.setQueryData(L(n), e.dashboard), o(!1), c(""), u("");
		}
	});
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: `${E()} flex flex-col gap-4`,
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
			m.error ? /* @__PURE__ */ (0, X.jsx)(v, {
				tone: "error",
				children: M(m.error)
			}) : null,
			a ? /* @__PURE__ */ (0, X.jsxs)("form", {
				className: "flex flex-col gap-3",
				onSubmit: (e) => {
					e.preventDefault(), m.isPending || m.mutate({
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
						isDisabled: m.isPending
					}),
					/* @__PURE__ */ (0, X.jsx)(f, {
						label: I("manage:tasteSources.profilePath"),
						value: l,
						onChange: u,
						maxLength: 1024,
						isRequired: !0,
						isDisabled: m.isPending,
						hint: I("manage:tasteSources.profilePathHint")
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, X.jsx)(i, {
							variant: "ghost",
							disabled: m.isPending,
							onClick: () => {
								o(!1), m.reset();
							},
							children: I("manage:shared.cancel")
						}), /* @__PURE__ */ (0, X.jsx)(i, {
							type: "submit",
							variant: "secondary",
							disabled: !s.trim() || !l.trim(),
							...T(m.isPending),
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
						className: zi,
						children: [
							/* @__PURE__ */ (0, X.jsx)("span", {
								className: "inline-grid size-8 shrink-0 place-items-center rounded-lg text-text-secondary",
								children: /* @__PURE__ */ (0, X.jsx)(bn, { name: e.name })
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
									...T(m.isPending),
									iconOnly: !0,
									leadingIcon: e.enabled ? y : d,
									"aria-label": `${e.enabled ? I("manage:tasteSources.stopReading") : I("manage:customSources.enable")} ${e.name}`,
									onClick: () => {
										e.enabled ? A({
											title: I("manage:tasteSources.stopReadingTitle", { browser: e.name }),
											body: I("manage:tasteSources.stopReadingBody"),
											confirmLabel: I("manage:tasteSources.stopReading"),
											onConfirm: () => m.mutateAsync({
												operation: "disable",
												id: e.id
											})
										}) : m.mutate({
											operation: "enable",
											id: e.id
										});
									}
								}), /* @__PURE__ */ (0, X.jsx)(i, {
									variant: "secondary",
									size: "small",
									iconOnly: !0,
									leadingIcon: p,
									...T(m.isPending),
									"aria-label": I("manage:tasteSources.deleteBrowserTitle", { browser: e.name }),
									onClick: () => {
										A({
											title: I("manage:tasteSources.deleteBrowserTitle", { browser: e.name }),
											body: I("manage:tasteSources.deleteBrowserBody"),
											confirmLabel: I("manage:tasteSources.deleteBrowser"),
											danger: !0,
											onConfirm: () => m.mutateAsync({
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
var Vi = 10, Hi = j(m, h, "text-body-2-medium"), Ui = `${E()} flex flex-col gap-4`, Wi = "rounded-xl bg-background-primary-default p-3", Gi = I("manage:taste.readHistoryTooltip"), Ki = I("manage:taste.noSourceHint"), qi = I("manage:taste.noLeadHint"), Ji = I("manage:taste.noCategoryHint"), Yi = I("manage:taste.gapHint"), Xi = I("manage:taste.noBrowserTagHint"), Zi = I("manage:taste.noBrowserCreatorHint"), Qi = I("manage:taste.noDomainHint"), $i = I("manage:taste.noPeachTagHint"), ea = I("manage:taste.noPeachCreatorHint"), ta = I("manage:taste.noPeachActressHint"), na = I("manage:taste.guideLocal"), ra = I("manage:taste.guideRemote"), ia = I("manage:taste.guideRefresh"), aa = I("manage:taste.removeSourceBody"), oa = "peach-taste-guide-dismissed", sa = "\0", ca = (e, t) => {
	let [n = "", r = ""] = e.split(sa);
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [
		n,
		t,
		r
	] });
}, la = (0, W.createContext)(/* @__PURE__ */ (0, X.jsx)(a, {
	size: "small",
	href: "/",
	children: I("manage:shared.browseCollection")
}));
function ua() {
	return (0, W.useContext)(la);
}
function $({ icon: e, term: t, figure: n, detail: r, detailTitle: i, accent: a }) {
	return /* @__PURE__ */ (0, X.jsx)("div", {
		className: Be(),
		children: /* @__PURE__ */ (0, X.jsx)(S, {
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
function da({ name: e, domain: t }) {
	return /* @__PURE__ */ (0, X.jsxs)("span", {
		className: "relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-background-tertiary-default text-caption-1-medium text-text-secondary",
		children: [ve(e).toUpperCase(), /* @__PURE__ */ (0, X.jsx)("img", {
			src: Re({ domain: t }),
			alt: "",
			loading: "lazy",
			width: 20,
			height: 20,
			onError: (e) => e.currentTarget.remove(),
			className: "absolute size-5 object-contain"
		})]
	});
}
function fa({ html: e }) {
	return /* @__PURE__ */ (0, X.jsx)("span", {
		className: `relative inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-media-placeholder text-caption-1-medium text-text-secondary ${it}`,
		dangerouslySetInnerHTML: { __html: e }
	});
}
function pa({ rows: e, kind: t, visual: n, empty: r, onSignal: i }) {
	if (!e.length) return /* @__PURE__ */ (0, X.jsx)(c, {
		size: "compact",
		icon: P,
		title: I("manage:taste.notEnoughData"),
		actions: /* @__PURE__ */ (0, X.jsx)(ua, {}),
		children: r
	});
	let a = Me(e);
	return /* @__PURE__ */ (0, X.jsx)($e, {
		previewCount: Vi,
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
				n === "domain" ? /* @__PURE__ */ (0, X.jsx)(da, {
					name: e.name,
					domain: e.name
				}) : null,
				n === "creator" && !e.entity_id && !e.has_avatar && s ? /* @__PURE__ */ (0, X.jsx)(da, {
					name: e.name,
					domain: s
				}) : null,
				n !== "none" && n !== "domain" && (e.entity_id || e.has_avatar || !s) ? /* @__PURE__ */ (0, X.jsx)(fa, { html: me(e.name, e.entity_id ? {
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
						children: je(e)
					})]
				}),
				o ? /* @__PURE__ */ (0, X.jsx)(ke, {
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
function ma({ label: e, panels: i, onSignal: a }) {
	return /* @__PURE__ */ (0, X.jsxs)(r, {
		className: `${E({ padding: "none" })} flex flex-col`,
		children: [/* @__PURE__ */ (0, X.jsx)("div", {
			className: "px-4 pt-3",
			children: /* @__PURE__ */ (0, X.jsx)(re, {
				"aria-label": e,
				className: te,
				children: i.map((e) => /* @__PURE__ */ (0, X.jsx)(n, {
					id: e.id,
					className: ee,
					children: e.name
				}, e.id))
			})
		}), i.map((e) => /* @__PURE__ */ (0, X.jsx)(t, {
			id: e.id,
			className: "px-4 pt-3.5 pb-4",
			children: /* @__PURE__ */ (0, X.jsx)(pa, {
				...e.props,
				onSignal: a
			})
		}, e.id))]
	});
}
function ha({ data: e, onSignal: t, navigate: n }) {
	let r = e.analysis;
	if (!r?.headline) return null;
	let i = r.confidence || {}, o = [...(r.explore || []).map((e) => ({
		key: `tag:${e.tag}`,
		title: O(e, "title"),
		detail: O(e, "detail"),
		act: () => t("tag", e.tag)
	})), ...(r.next_steps || []).map((e) => ({
		key: `route:${e.route}`,
		title: O(e, "title"),
		detail: O(e, "detail"),
		act: () => n(e.route)
	}))];
	return /* @__PURE__ */ (0, X.jsxs)("section", {
		className: Ui,
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
						children: O(r, "headline")
					}),
					/* @__PURE__ */ (0, X.jsxs)("p", {
						className: "flex flex-wrap items-center gap-2 text-body-2-regular text-text-secondary",
						children: [/* @__PURE__ */ (0, X.jsx)("i", {
							"aria-hidden": !0,
							className: `size-2 shrink-0 rounded-full ${i.level === "high" ? "bg-status-lime-text" : i.level === "medium" ? "bg-status-yellow-text" : "bg-text-tertiary"}`
						}), /* @__PURE__ */ (0, X.jsx)("span", {
							className: "min-w-0 wrap-anywhere",
							children: O(i, "label") || I("manage:taste.stillLearning")
						})]
					})
				]
			}),
			r.points?.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "inline-grid w-full gap-3 sm:grid-cols-2",
				children: r.points.map((e) => /* @__PURE__ */ (0, X.jsxs)("div", {
					className: `flex min-w-0 flex-col gap-1 ${Wi}`,
					children: [/* @__PURE__ */ (0, X.jsx)("span", {
						className: "text-caption-1-regular text-text-secondary",
						children: O(e, "label")
					}), /* @__PURE__ */ (0, X.jsx)("b", {
						className: "text-body-2-medium break-words text-text-primary",
						children: O(e, "text")
					})]
				}, e.label))
			}) : null,
			o.length ? /* @__PURE__ */ (0, X.jsx)("div", {
				className: "flex flex-col gap-2",
				children: o.map((e) => /* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					onClick: e.act,
					className: `flex w-full min-w-0 cursor-pointer items-center gap-3 ${Wi} text-left outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring`,
					children: [/* @__PURE__ */ (0, X.jsxs)("span", {
						className: "flex min-w-0 grow flex-col gap-1",
						children: [/* @__PURE__ */ (0, X.jsx)("b", {
							className: "text-body-2-medium wrap-anywhere text-text-primary",
							children: e.title
						}), /* @__PURE__ */ (0, X.jsx)("small", {
							className: "text-caption-1-regular wrap-anywhere text-text-secondary",
							children: e.detail
						})]
					}), /* @__PURE__ */ (0, X.jsx)(ke, {
						"aria-hidden": !0,
						className: "size-4 shrink-0 text-text-tertiary"
					})]
				}, e.key))
			}) : /* @__PURE__ */ (0, X.jsx)(c, {
				size: "compact",
				icon: P,
				title: I("manage:taste.nothingToExplore"),
				actions: /* @__PURE__ */ (0, X.jsx)(a, {
					size: "small",
					href: "/",
					children: I("manage:shared.browseCollection")
				}),
				children: qi
			})
		]
	});
}
function ga({ onboarding: e, done: t }) {
	let [n, r] = (0, W.useState)(() => {
		try {
			return localStorage.getItem(oa) === "1";
		} catch {
			return !1;
		}
	});
	return t || n ? null : /* @__PURE__ */ (0, X.jsx)("div", {
		className: E({
			padding: "none",
			className: "p-4"
		}),
		children: /* @__PURE__ */ (0, X.jsxs)(o, {
			summary: I("manage:taste.importGuide"),
			defaultOpen: e,
			children: [
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: na
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: ra
				}),
				/* @__PURE__ */ (0, X.jsxs)("ul", {
					className: "flex list-disc flex-col gap-1 pl-5 text-body-2-regular text-text-secondary",
					children: [/* @__PURE__ */ (0, X.jsx)("li", { children: ca(I("manage:taste.guideChrome", { link: sa }), /* @__PURE__ */ (0, X.jsxs)("a", {
						href: "https://takeout.google.com/",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-text-primary underline-offset-4 hover:underline",
						children: ["Google Takeout", /* @__PURE__ */ (0, X.jsx)(C, {
							"aria-hidden": !0,
							className: "size-(--icon-inline) shrink-0"
						})]
					})) }), /* @__PURE__ */ (0, X.jsx)("li", { children: ca(I("manage:taste.guideOther", { link: sa }), /* @__PURE__ */ (0, X.jsxs)("a", {
						href: "https://github.com/purarue/browserexport",
						target: "_blank",
						rel: "noopener noreferrer",
						className: "text-text-primary underline-offset-4 hover:underline",
						children: ["browserexport", /* @__PURE__ */ (0, X.jsx)(C, {
							"aria-hidden": !0,
							className: "size-(--icon-inline) shrink-0"
						})]
					})) })]
				}),
				/* @__PURE__ */ (0, X.jsx)("p", {
					className: "text-body-2-regular text-text-secondary",
					children: ia
				}),
				/* @__PURE__ */ (0, X.jsx)("span", {
					className: "self-start",
					children: /* @__PURE__ */ (0, X.jsx)(i, {
						variant: "secondary",
						size: "small",
						onClick: () => {
							try {
								localStorage.setItem(oa, "1");
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
function _a({ busy: t, onRefresh: n, onImport: r, onImportBookmarks: a }) {
	let o = (0, W.useRef)(null), [c, l] = (0, W.useState)(!1), u = (e) => {
		l(!1), e();
	};
	return /* @__PURE__ */ (0, X.jsxs)(X.Fragment, { children: [/* @__PURE__ */ (0, X.jsxs)("span", {
		"data-guide-target": "history-import",
		"data-button-group": !0,
		"data-split-button": !0,
		"data-variant": "primary",
		children: [/* @__PURE__ */ (0, X.jsx)(i, {
			leadingIcon: s,
			title: Gi,
			onClick: n,
			...T(t),
			children: I("manage:taste.readBrowserHistory")
		}), /* @__PURE__ */ (0, X.jsx)(i, {
			ref: o,
			iconOnly: !0,
			leadingIcon: N,
			"aria-label": I("manage:taste.moreHistoryOptions"),
			"aria-haspopup": "dialog",
			"aria-expanded": c,
			...T(t),
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
		className: g,
		children: /* @__PURE__ */ (0, X.jsxs)(_, {
			"aria-label": I("manage:taste.moreHistoryOptions"),
			className: "flex w-52 flex-col gap-1 outline-none",
			children: [
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: Hi,
					onClick: () => u(n),
					children: [/* @__PURE__ */ (0, X.jsx)(s, {
						"aria-hidden": !0,
						className: "size-4 shrink-0"
					}), I("manage:taste.readBrowserHistory")]
				}),
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: Hi,
					onClick: () => u(r),
					children: [/* @__PURE__ */ (0, X.jsx)(x, {
						"aria-hidden": !0,
						className: "size-4 shrink-0"
					}), I("manage:taste.importHistoryFile")]
				}),
				/* @__PURE__ */ (0, X.jsxs)("button", {
					type: "button",
					className: Hi,
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
function va({ sources: e, browsers: t, window: n, toast: r, emptyActions: a }) {
	let o = Ye({
		mutationFn: (e) => Ne(e, n),
		onSuccess: (e) => {
			F.setQueryData(L(n), e.dashboard), r(I("manage:taste.sourceRemoved"));
		}
	});
	return /* @__PURE__ */ (0, X.jsxs)(Bi, {
		browsers: t,
		sources: e,
		range: n,
		children: [o.error ? /* @__PURE__ */ (0, X.jsx)("div", {
			className: "sm:col-span-2",
			children: /* @__PURE__ */ (0, X.jsx)(v, {
				tone: "error",
				children: M(o.error)
			})
		}) : null, e.length ? /* @__PURE__ */ (0, X.jsx)(X.Fragment, { children: e.filter((e) => !t.some((t) => t.source_keys?.includes(e.source_key))).map((e) => /* @__PURE__ */ (0, X.jsxs)("div", {
			"data-taste-source": "import",
			className: zi,
			children: [
				/* @__PURE__ */ (0, X.jsx)("span", {
					className: "inline-grid size-8 shrink-0 place-items-center rounded-lg text-text-secondary",
					children: e.browser === "browserexport" ? /* @__PURE__ */ (0, X.jsx)(x, {
						"aria-hidden": !0,
						className: "size-4"
					}) : /* @__PURE__ */ (0, X.jsx)(w, {
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
					leadingIcon: p,
					...T(o.isPending),
					onClick: () => {
						o.isPending || A({
							title: I("manage:taste.removeSource"),
							body: aa,
							confirmLabel: I("manage:taste.removeSource"),
							onConfirm: () => o.mutateAsync(e.source_key)
						});
					}
				})
			]
		}, e.source_key)) }) : t.length ? null : /* @__PURE__ */ (0, X.jsx)(c, {
			size: "compact",
			icon: w,
			title: I("manage:taste.noSourcesTitle"),
			actions: a,
			children: Ki
		})]
	});
}
function ya(e) {
	let { onSignal: o, navigate: s, toast: l, onboarding: u } = e, [d, f] = (0, W.useState)("all"), [p, m] = (0, W.useState)("browser"), h = (0, W.useRef)(null), g = (0, W.useRef)(null), _ = Xe({
		queryKey: L(d),
		queryFn: ({ signal: e }) => ge(d, e),
		placeholderData: De,
		refetchInterval: We
	}), { job: y, running: b, outcome: x, start: S } = Je({
		queryKey: oe,
		queryFn: ({ signal: e }) => _e(e),
		start: () => ze(d),
		taskKey: se,
		onFinish: (e) => {
			e.status !== "failed" && (F.invalidateQueries({ queryKey: ["taste"] }), l(e.warnings?.length ? I("manage:taste.partialHistory") : I("manage:taste.analysisUpdated")));
		}
	}), C = Ye({
		mutationFn: (e) => ge(e, void 0, !0),
		onSuccess: (e, t) => {
			F.setQueryData(L(t), e);
		}
	}), w = Ye({
		mutationFn: (e) => we(e),
		onSuccess: (e) => {
			F.setQueryData(L("all"), e.dashboard), f("all"), l(I("manage:taste.dataImported"));
		}
	}), de = (e) => {
		let t = e.currentTarget.files?.[0];
		e.currentTarget.value = "", t && !w.isPending && (w.reset(), w.mutate(t));
	}, me = () => {
		b || S.isPending || (S.reset(), S.mutate());
	}, E = _.data;
	if (!E) return /* @__PURE__ */ (0, X.jsx)(at, { children: /* @__PURE__ */ (0, X.jsx)(v, {
		tone: "error",
		title: I("manage:taste.loadFailedTitle"),
		children: _.error ? M(_.error) : I("manage:taste.loadFailedBody")
	}) });
	let D = E.summary || {}, O = E.coverage || {}, k = E.rankings || {}, A = E.storage || {}, j = He(k.browser_categories || []), N = Ae(j).length > 0, ve = E.gaps || [], ye = O.tagged || 0, be = O.identified || 0, Ee = S.error ? M(S.error) : w.error ? M(w.error) : C.error ? M(C.error) : x?.status === "failed" ? Te(x, "error") || I("manage:taste.readNotFound") : "", ke = /* @__PURE__ */ (0, X.jsxs)("div", {
		className: "flex flex-wrap justify-center gap-2",
		children: [/* @__PURE__ */ (0, X.jsx)(i, {
			variant: "secondary",
			...T(b || S.isPending || w.isPending),
			onClick: me,
			children: I("manage:taste.readBrowserHistory")
		}), /* @__PURE__ */ (0, X.jsx)(i, {
			variant: "secondary",
			...T(w.isPending),
			onClick: () => h.current?.click(),
			children: I("manage:taste.importHistoryFile")
		})]
	});
	return /* @__PURE__ */ (0, X.jsx)(at, { children: /* @__PURE__ */ (0, X.jsxs)(la, {
		value: d === "all" ? p === "peach" ? /* @__PURE__ */ (0, X.jsx)(a, {
			size: "small",
			variant: "secondary",
			href: "/",
			children: I("manage:shared.browseCollection")
		}) : ke : /* @__PURE__ */ (0, X.jsx)(i, {
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
						children: [/* @__PURE__ */ (0, X.jsxs)(re, {
							"aria-label": I("manage:taste.evidenceLabel"),
							className: te,
							children: [/* @__PURE__ */ (0, X.jsx)(n, {
								id: "peach",
								className: ee,
								children: I("manage:taste.peachActivity")
							}), /* @__PURE__ */ (0, X.jsx)(n, {
								id: "browser",
								className: ee,
								children: I("manage:taste.browserHistory")
							})]
						}), /* @__PURE__ */ (0, X.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2",
							children: [
								/* @__PURE__ */ (0, X.jsx)(ie, {
									"aria-label": I("manage:taste.rangeLabel"),
									selectedKey: d,
									onSelectionChange: (e) => {
										e !== null && f(String(e));
									},
									children: ce.map(([e, t]) => /* @__PURE__ */ (0, X.jsx)(ae, {
										id: e,
										children: t
									}, e))
								}),
								/* @__PURE__ */ (0, X.jsx)(_a, {
									busy: b || S.isPending || w.isPending,
									onRefresh: me,
									onImport: () => h.current?.click(),
									onImportBookmarks: () => g.current?.click()
								}),
								/* @__PURE__ */ (0, X.jsx)("input", {
									ref: h,
									type: "file",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									onChange: de
								}),
								/* @__PURE__ */ (0, X.jsx)("input", {
									ref: g,
									type: "file",
									tabIndex: -1,
									"aria-hidden": !0,
									className: "hidden",
									"data-bookmark-import": !0,
									onChange: de
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, X.jsx)(ga, {
						onboarding: u,
						done: !!(D.history_sources || E.updated_at)
					}),
					/* @__PURE__ */ (0, X.jsxs)("div", {
						"aria-live": "polite",
						className: "flex flex-col gap-3 empty:hidden",
						children: [
							b ? /* @__PURE__ */ (0, X.jsx)(le, {
								kind: pe("taste-refresh"),
								label: Te(y, "message") || I("manage:taste.refreshing"),
								value: y?.checked,
								total: y?.total
							}) : null,
							w.isPending ? /* @__PURE__ */ (0, X.jsx)(le, {
								kind: "gather",
								label: I("manage:taste.importing")
							}) : null,
							E.stale && E.error ? /* @__PURE__ */ (0, X.jsx)(v, {
								tone: "error",
								action: /* @__PURE__ */ (0, X.jsx)(i, {
									variant: "secondary",
									size: "small",
									...T(C.isPending),
									onClick: () => C.mutate(d),
									children: I("manage:shared.retryNow")
								}),
								children: I("manage:taste.updateFailedStale", {
									time: Ge(E.computed_at),
									error: Ie(E.message_code ?? "", E.error, E.message_params)
								})
							}) : E.stale ? /* @__PURE__ */ (0, X.jsx)(le, {
								kind: pe("taste-refresh"),
								label: I("manage:taste.updatingStale", { time: Ge(E.computed_at) })
							}) : null,
							Ee ? /* @__PURE__ */ (0, X.jsx)(v, {
								tone: "error",
								children: Ee
							}) : null,
							x?.warnings?.length ? /* @__PURE__ */ (0, X.jsx)(v, {
								tone: "warning",
								children: Le(x.warnings, x.warning_codes, x.warning_params).join(I("shell:format.semicolonSeparator"))
							}) : null
						]
					}),
					/* @__PURE__ */ (0, X.jsxs)(t, {
						id: "browser",
						className: "flex flex-col gap-5",
						children: [
							/* @__PURE__ */ (0, X.jsxs)("div", {
								className: ne,
								children: [
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 0,
										icon: qe,
										term: I("manage:tasteSkeleton.browsingHistory"),
										figure: Number(D.history_visits || 0).toLocaleString(),
										detail: Ce(D),
										detailTitle: `${Ve(D.range_start)}—${Ve(D.range_end)}`
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 1,
										icon: Oe,
										term: I("manage:tasteSkeleton.tasteDimensions"),
										figure: j.length.toLocaleString(),
										detail: j[0]?.name || I("manage:taste.noTopDimension")
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 2,
										icon: P,
										term: I("manage:tasteSkeleton.browsingLeads"),
										figure: ve.length.toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 3,
										icon: Se,
										term: I("manage:taste.bookmarks"),
										figure: Number(D.bookmarks || 0).toLocaleString(),
										detail: I("manage:taste.privateExports", {
											count: Number(A.exports || 0),
											size: xe(A.bytes || 0)
										})
									})
								]
							}),
							/* @__PURE__ */ (0, X.jsxs)("section", {
								className: N ? `${Ui} md:flex-row md:gap-6` : Ui,
								"aria-label": I("manage:taste.browsingProfile"),
								children: [/* @__PURE__ */ (0, X.jsxs)("div", {
									className: N ? "flex shrink-0 flex-col gap-2 pb-5 md:w-80 md:pr-6 md:pb-0" : "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
									children: [
										/* @__PURE__ */ (0, X.jsx)("span", {
											className: "text-caption-1-regular text-text-secondary",
											children: I("manage:taste.browsingProfile")
										}),
										N ? /* @__PURE__ */ (0, X.jsx)(Ii, {
											rows: j,
											label: I("manage:taste.topDimensions")
										}) : null,
										/* @__PURE__ */ (0, X.jsx)("small", {
											className: "text-caption-1-regular text-text-secondary",
											children: E.updated_at ? I("manage:taste.updatedAt", { date: Ve(E.updated_at) }) : I("manage:taste.historyNotFetched")
										})
									]
								}), /* @__PURE__ */ (0, X.jsx)("div", {
									className: "flex min-w-0 grow flex-col",
									children: j.length ? /* @__PURE__ */ (0, X.jsx)(Li, {
										rows: j,
										label: I("manage:taste.dimensionRanking")
									}) : /* @__PURE__ */ (0, X.jsx)(c, {
										size: "compact",
										icon: P,
										title: I("manage:taste.noDimensions"),
										actions: /* @__PURE__ */ (0, X.jsx)(ua, {}),
										children: Ji
									})
								})]
							}),
							/* @__PURE__ */ (0, X.jsx)(Ze, {
								activity: E.activity,
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
							/* @__PURE__ */ (0, X.jsx)(Ri, { flows: E.creator_flows }),
							/* @__PURE__ */ (0, X.jsx)(ma, {
								label: I("manage:taste.browserDimensions"),
								onSignal: o,
								panels: [
									{
										id: "tags",
										name: I("manage:shared.tags"),
										props: {
											rows: k.browser_tags || [],
											kind: "tag",
											visual: "none",
											empty: Xi
										}
									},
									{
										id: "creators",
										name: I("manage:shared.creators"),
										props: {
											rows: k.browser_creators || [],
											kind: "creator",
											visual: "creator",
											empty: Zi
										}
									},
									{
										id: "performers",
										name: I("manage:shared.actresses"),
										props: {
											rows: k.browser_performers || [],
											kind: "performer",
											visual: "entity",
											empty: I("manage:taste.noActressHistory")
										}
									},
									{
										id: "domains",
										name: I("manage:taste.topSites"),
										props: {
											rows: k.domains || [],
											kind: "",
											visual: "domain",
											empty: Qi
										}
									},
									{
										id: "gaps",
										name: I("manage:tasteSkeleton.browsingLeads"),
										props: {
											rows: ve,
											kind: "",
											visual: "none",
											empty: Yi
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
								className: ne,
								children: [
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 0,
										icon: ue,
										term: I("manage:taste.watchedInPeach"),
										figure: Number(D.peach_items || 0).toLocaleString(),
										detail: Ue(D.peach_seconds || 0)
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 1,
										icon: fe,
										term: I("manage:shared.like"),
										figure: Number(D.liked || 0).toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 2,
										icon: he,
										term: I("manage:taste.disliked"),
										figure: Number(D.disliked || 0).toLocaleString()
									}),
									/* @__PURE__ */ (0, X.jsx)($, {
										accent: 3,
										icon: Oe,
										term: I("manage:taste.tagged"),
										figure: ye.toLocaleString()
									})
								]
							}),
							/* @__PURE__ */ (0, X.jsxs)("section", {
								className: `${Ui} md:flex-row md:gap-6`,
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
											children: Number(D.peach_items || 0).toLocaleString()
										}),
										/* @__PURE__ */ (0, X.jsx)("span", {
											className: "text-body-2-regular text-text-secondary",
											children: I("manage:taste.watchedOrRatedUnit", { count: Number(D.peach_items || 0) })
										})
									]
								}), /* @__PURE__ */ (0, X.jsxs)("div", {
									className: "flex min-w-0 grow flex-col",
									children: [/* @__PURE__ */ (0, X.jsx)(ba, {
										term: I("manage:taste.tagged"),
										value: ye,
										rest: O.untagged || 0
									}), /* @__PURE__ */ (0, X.jsx)(ba, {
										term: I("manage:taste.identified"),
										value: be,
										rest: O.unidentified || 0
									})]
								})]
							}),
							/* @__PURE__ */ (0, X.jsx)(ma, {
								label: I("manage:taste.peachDimensions"),
								onSignal: o,
								panels: [
									{
										id: "tags",
										name: I("manage:shared.tags"),
										props: {
											rows: k.peach_tags || [],
											kind: "tag",
											visual: "none",
											empty: $i
										}
									},
									{
										id: "creators",
										name: I("manage:shared.creators"),
										props: {
											rows: k.peach_creators || [],
											kind: "creator",
											visual: "creator",
											empty: ea
										}
									},
									{
										id: "performers",
										name: I("manage:shared.actresses"),
										props: {
											rows: k.peach_performers || [],
											kind: "performer",
											visual: "entity",
											empty: ta
										}
									}
								]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, X.jsx)(ha, {
				data: E,
				onSignal: o,
				navigate: s
			}),
			/* @__PURE__ */ (0, X.jsx)(va, {
				sources: E.sources || [],
				browsers: E.browsers || [],
				window: d,
				toast: l,
				emptyActions: ke
			})
		]
	}) });
}
function ba({ term: e, value: t, rest: n }) {
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
		}), /* @__PURE__ */ (0, X.jsx)(b, {
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
export { oa as TASTE_GUIDE_KEY, ya as TastePage };

//# debugId=71b6d25b-7de9-4beb-a74e-2838b25d7809