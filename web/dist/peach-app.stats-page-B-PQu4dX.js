(function() {
	try {
		var e = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, t = new e.Error().stack;
		t && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[t] = "1886cd1e-d18d-48ff-8c79-a27558548666", e._sentryDebugIdIdentifier = "sentry-dbid-1886cd1e-d18d-48ff-8c79-a27558548666");
	} catch {}
})();
import { $b4f18e3395fe64d7$export$3d96ec278d3efce4 as e, $b4f18e3395fe64d7$export$3e41faf802a29e71 as t, $b4f18e3395fe64d7$export$b2539bed5023c21c as n, $b4f18e3395fe64d7$export$e51a686c67fdaa2d as r, ButtonLink as i, EmptyState as a, LOC as o, MEDIA_SOURCE_ICONS as s, NR as c, Note as l, Progress as u, SEGMENT as d, SEGMENTED_TRACK as f, STATS_KEY as p, STAT_STRIP as m, SegmentedTabList as h, SourceMark as g, StatCard as _, StatusLabel as v, Xc as y, Xt as b, _8 as x, __toESM as S, bandRows as C, cardClass as w, clsx as T, codedText as E, errorMessage as D, fetchStats as ee, fmtCount as O, fmtSize as k, known as A, lengthRows as j, mM as M, mediumRows as te, percentText as ne, playedFor as re, playedItemUrl as ie, radialArc as ae, radialBarSize as oe, radialCeiling as se, radialSlices as ce, reachedShare as le, replayRows as ue, require_jsx_runtime as de, require_react as fe, settingsPath as pe, statCardClass as me, t as N, uo as he, useQuery as ge, watchNote as _e, watchedShare as ve } from "./peach-app.js";
import { ActivityHeat as ye, BarCard as P, ExpandableRanking as be, PolarAngleAxis as xe, selectPolarAxisScale as Se, selectPolarAxisTicks as Ce, selectPolarGraphicalItemAxisTicks as we } from "./peach-app.expandable-ranking-CFsyhiRc.js";
import { AnimatedItems as Te, CHART_CARD as Ee, CHART_COLORS as De, Cell as Oe, ChartBackground as ke, ChartContainer as Ae, ChartEmpty as je, ChartLegend as Me, ChartLegendContent as Ne, ChartTip as Pe, ChartTooltip as Fe, ChartTooltipContent as Ie, DataLabelColorsContextProvider as Le, DataLabelThemeContextProvider as Re, DefaultZIndexes as F, EntryFillDefinitions as ze, FillObjectDefinition as Be, LabelListFromLabelProp as Ve, Layer as I, LoadingIndicator as He, PolarChart as Ue, PolarLabelListContextProvider as We, RegisterGraphicalItemId as Ge, Sector as L, SetPolarGraphicalItem as Ke, SetPolarLegendPayload as qe, SetTooltipEntrySettings as Je, Shape as Ye, ZIndexLayer as Xe, adaptEventsOfChild as Ze, arrayTooltipSearcher as Qe, combineAllBarPositions as $e, combineBarPosition as et, combineBarSizeList as tt, combineStackedData as nt, createSelector as R, defaultPolarChartProps as rt, findAllByType as it, getActiveStyleOverrides as at, getBandSizeOfAxis as z, getBaseValueOfBar as ot, getCateCoordinateOfBar as st, getColorsCount as ct, getEntryColor as lt, getEntryFillId as ut, getEntryFillObject as dt, getEntryShapeColors as ft, getEntryStyleOverrides as pt, getFillUrl as mt, getNormalizedStackId as ht, getSeriesFillId as gt, getTooltipNameProp as _t, getValueByDataKey as vt, getZIndexFromUnknown as yt, hasEntryFillObjects as bt, interpolate as xt, isCategoricalAxis as St, isNullish as Ct, matchAppend as wt, mathSign as Tt, noop as Et, omit as Dt, omitEntrySvgProps as Ot, readEntryFill as kt, resolveDefaultProps as At, selectActiveTooltipIndex as jt, selectAngleAxis as Mt, selectBarCategoryGap as Nt, selectBarGap as Pt, selectChartDataAndAlwaysIgnoreIndexes as Ft, selectChartDataWithIndexes as It, selectChartLayout as B, selectPolarStackGroups as Lt, selectPolarViewBox as Rt, selectRadiusAxis as zt, selectRootBarSize as Bt, selectRootMaxBarSize as Vt, selectUnfilteredPolarItems as Ht, sliceConfig as Ut, sliceKey as Wt, splitFill as Gt, svgPropertiesNoEvents as Kt, svgPropertiesNoEventsFromUnknown as qt, truncateByDomain as Jt, useAnimationCallbacks as Yt, useAppSelector as Xt, useBackwardsCompatibleTheme as Zt, useEffectiveDataKey as Qt, useGraphicalItemIdentity as $t, useGraphicalItemThemeFill as en, useMouseClickItemDispatch as tn, useMouseEnterItemDispatch as nn, useMouseLeaveItemDispatch as rn, usePolarChartLayout as an, useSeriesLabelThemeResolver as on, useThemedActiveStyles as sn, useUnthemedColors as cn, withEntryFillColor as ln } from "./peach-app.chart-tip-BdEMpPYU.js";
import { ConnectionStatus as un } from "./peach-app.connection-status-BrXhLGSm.js";
import { Page as dn } from "./peach-app.page-QAncjzM1.js";
// node_modules/recharts/es6/util/RadialBarUtils.js
var V = /* @__PURE__ */ S(fe()), fn = ["option"];
function pn(e, t) {
	if (e == null) return {};
	var n, r, i = mn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function mn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var hn = L;
function gn(e) {
	return typeof e == "string" ? parseInt(e, 10) : e;
}
function _n(e) {
	var t = e.option, n = pn(e, fn);
	return /*#__PURE__*/ V.createElement(Ye, {
		option: t,
		DefaultShape: hn,
		shapeProps: n
	});
}
// node_modules/recharts/es6/state/selectors/radialBarSelectors.js
function vn(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function H(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? vn(Object(n), !0).forEach(function(t) {
			yn(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : vn(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function yn(e, t, n) {
	return (t = bn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function bn(e) {
	var t = xn(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function xn(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var U = R([(e, t) => zt(e, t), (e, t) => Se(e, "radiusAxis", t)], (e, t) => {
	if (e != null && t != null) return H(H({}, e), {}, { scale: t });
}), Sn = (e, t) => we(e, "radiusAxis", t, !1), W = R([(e, t, n) => Mt(e, n), (e, t, n) => Se(e, "angleAxis", n)], (e, t) => {
	if (e != null && t != null) return H(H({}, e), {}, { scale: t });
}), Cn = (e, t, n) => Ce(e, "angleAxis", n, !1), wn = R([Ht, (e, t, n, r) => r], (e, t) => {
	if (e.some((e) => e.type === "radialBar" && t.dataKey === e.dataKey && t.stackId === e.stackId)) return t;
}), Tn = R([
	B,
	U,
	Sn,
	W,
	Cn
], (e, t, n, r, i) => St(e, "radiusAxis") ? z(t, n, !1) : z(r, i, !1)), En = R([
	W,
	U,
	B
], (e, t, n) => {
	var r = n === "radial" ? e : t;
	if (r != null && r.scale != null) return ot({ numericAxis: r });
}), Dn = (e, t, n, r, i) => i, On = (e, t, n, r, i) => n, kn = (e, t, n, r, i) => t, An = (e, t, n, r, i) => r.maxBarSize, jn = (e) => e.type === "radialBar", Mn = R([
	B,
	Ht,
	On,
	kn
], (e, t, n, r) => t.filter((t) => e === "centric" ? t.angleAxisId === n : t.radiusAxisId === r).filter((e) => e.hide === !1).filter(jn)), Nn = R([
	Mn,
	Bt,
	() => void 0
], tt), Pn = R([
	B,
	Vt,
	W,
	Cn,
	U,
	Sn,
	An
], (e, t, n, r, i, a, o) => {
	var s = Ct(o) ? t : o;
	return e === "centric" ? z(n, r, !0) ?? s ?? 0 : z(i, a, !0) ?? s ?? 0;
}), Fn = R([
	Nn,
	Vt,
	Pt,
	Nt,
	Pn,
	Tn,
	An
], $e), In = R([Fn, wn], et), Ln = R([(e, t, n) => B(e) === "centric" ? Lt(e, "radiusAxis", t) : Lt(e, "angleAxis", n), wn], nt), Rn = R([
	W,
	Cn,
	U,
	Sn,
	It,
	wn,
	Tn,
	B,
	En,
	Rt,
	Dn,
	In,
	Ln
], (e, t, n, r, i, a, o, s, c, l, u, d, f) => {
	var p = i.chartData, m = i.dataStartIndex, h = i.dataEndIndex;
	if (a == null || n == null || e == null || p == null || o == null || d == null || s !== "centric" && s !== "radial" || r == null || l == null) return [];
	var g = a.dataKey, _ = a.minAngle, v = a.minPointSize, y = l.cx, b = l.cy, x = l.startAngle, S = l.endAngle;
	return sr({
		angleAxis: e,
		angleAxisTicks: t,
		bandSize: o,
		baseValue: c,
		cells: u,
		cx: y,
		cy: b,
		dataKey: g,
		dataStartIndex: m,
		displayedData: p.slice(m, h + 1),
		endAngle: S,
		layout: s,
		minAngle: _,
		minPointSize: v,
		pos: d,
		radiusAxis: n,
		radiusAxisTicks: r,
		stackedData: f,
		stackedDomain: f ? (s === "centric" ? n : e).scale.domain() : null,
		startAngle: x
	});
}), zn = R([Ft, (e, t) => t], (e, t) => {
	var n = e.chartData, r = e.dataStartIndex, i = e.dataEndIndex;
	if (n == null) return [];
	var a = n.slice(r, i + 1);
	return a.length === 0 ? [] : a.map((e) => ({
		type: t,
		value: e.name,
		payload: e
	}));
}), Bn = [
	"shape",
	"activeShape",
	"cornerRadius",
	"id",
	"unthemedColors",
	"themedActiveStyles",
	"fillObject"
], Vn = [
	"onMouseEnter",
	"onClick",
	"onMouseLeave"
], Hn = ["value", "background"];
function G() {
	return G = Object.assign ? Object.assign.bind() : function(e) {
		for (var t = 1; t < arguments.length; t++) {
			var n = arguments[t];
			for (var r in n) ({}).hasOwnProperty.call(n, r) && (e[r] = n[r]);
		}
		return e;
	}, G.apply(null, arguments);
}
function Un(e, t) {
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
		t % 2 ? Un(Object(n), !0).forEach(function(t) {
			Wn(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : Un(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function Wn(e, t, n) {
	return (t = Gn(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function Gn(e) {
	var t = Kn(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function Kn(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
function qn(e, t) {
	if (e == null) return {};
	var n, r, i = Jn(e, t);
	if (Object.getOwnPropertySymbols) {
		var a = Object.getOwnPropertySymbols(e);
		for (r = 0; r < a.length; r++) n = a[r], t.indexOf(n) === -1 && {}.propertyIsEnumerable.call(e, n) && (i[n] = e[n]);
	}
	return i;
}
function Jn(e, t) {
	if (e == null) return {};
	var n = {};
	for (var r in e) if ({}.hasOwnProperty.call(e, r)) {
		if (t.indexOf(r) !== -1) continue;
		n[r] = e[r];
	}
	return n;
}
var Yn = [];
function Xn(e) {
	var t = e.showLabels, n = e.sectors, r = e.fill, i = e.stroke, a = e.unthemedColors, o = e.children, s = V.useMemo(() => ({
		hasFilledShapes: !0,
		getShapeColors: (e) => ft(n[e], r, i, a)
	}), [
		n,
		r,
		i,
		a
	]), c = n.map((e) => ({
		value: e.value,
		payload: e.payload,
		parentViewBox: void 0,
		clockWise: !1,
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
	}));
	return /*#__PURE__*/ V.createElement(We, { value: t ? c : void 0 }, /*#__PURE__*/ V.createElement(Le, { value: s }, o));
}
function Zn(e) {
	var t = e.sectors, n = e.allOtherRadialBarProps, r = e.showLabels, i = e.animationElapsedTime, a = e.isAnimating, o = e.isEntrance, s = n.shape, c = n.activeShape, l = n.cornerRadius, u = n.id, d = n.unthemedColors, f = n.themedActiveStyles, p = n.fillObject, m = qn(n, Bn), h = Kt(m), g = p == null ? h : K(K({}, h), {}, { fill: mt(gt(u)) }), _ = Xt(jt), v = n.onMouseEnter, y = n.onClick, b = n.onMouseLeave, x = qn(n, Vn), S = nn(v, n.dataKey, u), C = rn(b), w = tn(y, n.dataKey, u);
	return t == null ? null : /*#__PURE__*/ V.createElement(Xn, {
		showLabels: r,
		sectors: t,
		fill: m.fill,
		stroke: m.stroke,
		unthemedColors: d
	}, t.map((e, t) => {
		var n = !!(c && _ === String(t)), r = S(e, t), p = C(e, t), h = w(e, t), v = K(K(K(K(K(K(K({}, g), {}, { cornerRadius: gn(l) }, pt(e, d)), e), kt(e.payload).fillObject == null ? void 0 : { fill: mt(ut(u, t)) }), n ? at(c, f, e) : void 0), Ze(x, e, t)), {}, {
			onMouseEnter: r,
			onMouseLeave: p,
			onClick: h,
			className: T("recharts-radial-bar-sector", e.className),
			forceCornerRadius: m.forceCornerRadius,
			cornerIsExternal: m.cornerIsExternal,
			animationElapsedTime: i,
			isAnimating: a,
			isEntrance: o,
			isActive: n,
			option: n && c != null ? c : s,
			index: t
		});
		return n ? /*#__PURE__*/ V.createElement(Xe, {
			zIndex: F.activeBar,
			key: `sector-${e.cx}-${e.cy}-${e.innerRadius}-${e.outerRadius}-${e.startAngle}-${e.endAngle}-${t}`
		}, /*#__PURE__*/ V.createElement(_n, v)) : /*#__PURE__*/ V.createElement(_n, G({ key: `sector-${e.cx}-${e.cy}-${e.innerRadius}-${e.outerRadius}-${e.startAngle}-${e.endAngle}-${t}` }, v));
	}), /*#__PURE__*/ V.createElement(Ve, { label: n.label }), n.children);
}
var Qn = (e, t) => e == null ? [] : t === 1 ? e.flatMap((e) => e.status === "removed" ? [] : [e.next]) : e.flatMap((e) => e.status === "removed" ? [] : e.status === "matched" ? [K(K({}, e.next), {}, {
	startAngle: xt(e.prev.startAngle, e.next.startAngle, t),
	endAngle: xt(e.prev.endAngle, e.next.endAngle, t)
})] : [K(K({}, e.next), {}, { endAngle: xt(e.next.startAngle, e.next.endAngle, t) })]);
function $n(e) {
	var t = e.props, n = e.previousSectorsRef, r = t.sectors, i = t.isAnimationActive, a = t.animationBegin, o = t.animationDuration, s = t.animationEasing, c = t.onAnimationStart, l = t.onAnimationEnd, u = Yt(c, l), d = u.isAnimating, f = u.handleAnimationStart, p = u.handleAnimationEnd, m = an();
	return m == null ? null : /*#__PURE__*/ V.createElement(Te, {
		animationInput: t,
		animationIdPrefix: "recharts-radialbar-",
		items: r,
		previousItemsRef: n,
		isAnimationActive: i,
		animationBegin: a,
		animationDuration: o,
		animationEasing: s,
		onAnimationStart: f,
		onAnimationEnd: p,
		animationInterpolateFn: t.animationInterpolateFn,
		animationMatchBy: t.animationMatchBy,
		layout: m
	}, (e, n, r) => /*#__PURE__*/ V.createElement(Zn, {
		sectors: e,
		allOtherRadialBarProps: t,
		showLabels: !d,
		animationElapsedTime: n,
		isAnimating: d || n < 1,
		isEntrance: r
	}));
}
function er(e) {
	var t = (0, V.useRef)(null);
	return /*#__PURE__*/ V.createElement($n, {
		props: e,
		previousSectorsRef: t
	});
}
function tr(e) {
	var t = e.legendType, n = e.fill, r = e.stroke, i = e.unthemedColors, a = e.fillObject, o = e.children, s = V.useMemo(() => it(o, Oe), [o]), c = Xt((e) => zn(e, t))?.map((e, t) => {
		var o = K(K({}, e.payload), s[t]?.props);
		return K(K({}, e), {}, {
			color: lt(o, n, r, i),
			fill: dt(o, a)
		});
	});
	return /*#__PURE__*/ V.createElement(qe, { legendPayload: c ?? [] });
}
var nr = /*#__PURE__*/ V.memo((e) => {
	var t = e.dataKey, n = e.sectors, r = e.stroke, i = e.strokeWidth, a = e.name, o = e.hide, s = e.fill, c = e.tooltipType, l = e.formatter, u = e.id, d = e.unthemedColors, f = {
		dataDefinedOnItem: n,
		getPosition: Et,
		getEntryColor: (e) => lt(e, s, r, d),
		settings: {
			graphicalItemId: u,
			stroke: r,
			strokeWidth: i,
			fill: s,
			nameKey: void 0,
			dataKey: t,
			name: _t(a, t),
			hide: o,
			type: c,
			color: s,
			unit: "",
			formatter: l
		}
	};
	return /*#__PURE__*/ V.createElement(Je, { tooltipEntrySettings: f });
}), rr = { fill: "#eee" };
function ir(e) {
	var t = e.sectors, n = e.allOtherRadialBarProps, r = n.cornerRadius, i = n.background, a = qt(i), o = Zt((e) => e.barBackground, a ?? {}, rr);
	return t == null ? null : /*#__PURE__*/ V.createElement(Xe, { zIndex: yt(i, F.barBackground) }, t.map((e, t) => {
		e.value;
		var s = e.background, c = qn(e, Hn);
		if (!s) return null;
		var l = K(K(K(K(K(K({ cornerRadius: gn(r) }, Ot(c)), o), s), a), Ze(n, e, t)), {}, {
			index: t,
			className: T("recharts-radial-bar-background-sector", a?.className == null ? void 0 : String(a.className)),
			option: /*#__PURE__*/ V.isValidElement(i) || typeof i == "function" ? i : s,
			isActive: !1
		});
		return /*#__PURE__*/ V.createElement(_n, G({ key: `background-${c.cx}-${c.cy}-${c.innerRadius}-${c.outerRadius}-${c.startAngle}-${c.endAngle}-${t}` }, l));
	}));
}
var ar = class extends V.PureComponent {
	renderBackground(e) {
		return /*#__PURE__*/ V.createElement(ir, {
			sectors: e,
			allOtherRadialBarProps: this.props
		});
	}
	render() {
		var e = this.props, t = e.hide, n = e.sectors, r = e.className, i = e.background, a = e.fillObject, o = e.id, s = e.fill, c = e.stroke, l = e.unthemedColors;
		if (t) return null;
		var u = T("recharts-area", r), d = bt(n.map((e) => e.payload));
		return /*#__PURE__*/ V.createElement(Xe, { zIndex: this.props.zIndex }, /*#__PURE__*/ V.createElement(I, { className: u }, (a != null || d) && /*#__PURE__*/ V.createElement("defs", null, a != null && /*#__PURE__*/ V.createElement(Be, {
			id: gt(o),
			fillObject: a,
			color: s
		}), d && /*#__PURE__*/ V.createElement(ze, {
			id: o,
			entries: n.map((e, t) => ({
				index: t,
				payload: e.payload,
				color: ft(e.payload, s, c, l).fill
			}))
		})), i && /*#__PURE__*/ V.createElement(I, { className: "recharts-radial-bar-background" }, this.renderBackground(n)), /*#__PURE__*/ V.createElement(I, { className: "recharts-radial-bar-sectors" }, /*#__PURE__*/ V.createElement(er, this.props))));
	}
};
function or(e) {
	var t = V.useMemo(() => it(e.children, Oe), [e.children]), n = V.useMemo(() => ({
		data: void 0,
		hide: !1,
		id: e.id,
		dataKey: e.dataKey,
		minAngle: e.minAngle,
		minPointSize: e.minPointSize,
		stackId: ht(e.stackId),
		maxBarSize: e.maxBarSize,
		barSize: e.barSize,
		type: "radialBar",
		angleAxisId: e.angleAxisId,
		radiusAxisId: e.radiusAxisId
	}), [
		e.id,
		e.dataKey,
		e.minAngle,
		e.minPointSize,
		e.stackId,
		e.maxBarSize,
		e.barSize,
		e.angleAxisId,
		e.radiusAxisId
	]), r = Xt((r) => Rn(r, e.radiusAxisId, e.angleAxisId, n, t)) ?? Yn;
	return /*#__PURE__*/ V.createElement(V.Fragment, null, /*#__PURE__*/ V.createElement(nr, {
		dataKey: e.dataKey,
		sectors: r,
		stroke: e.stroke,
		strokeWidth: e.strokeWidth,
		name: e.name,
		hide: e.hide,
		fill: e.fill,
		tooltipType: e.tooltipType,
		formatter: e.formatter,
		id: e.id,
		unthemedColors: e.unthemedColors
	}), /*#__PURE__*/ V.createElement(ar, G({}, e, { sectors: r })));
}
var q = {
	angleAxisId: 0,
	animationBegin: 0,
	animationDuration: 1500,
	animationEasing: "ease",
	animationMatchBy: wt,
	animationInterpolateFn: Qn,
	background: !1,
	cornerIsExternal: !1,
	cornerRadius: 0,
	forceCornerRadius: !1,
	hide: !1,
	isAnimationActive: "auto",
	label: !1,
	legendType: "rect",
	minAngle: 0,
	minPointSize: 0,
	radiusAxisId: 0,
	shape: hn,
	zIndex: F.bar
};
function sr(e) {
	var t = e.displayedData, n = e.stackedData, r = e.dataStartIndex, i = e.stackedDomain, a = e.dataKey, o = e.baseValue, s = e.layout, c = e.radiusAxis, l = e.radiusAxisTicks, u = e.bandSize, d = e.pos, f = e.angleAxis, p = e.minAngle, m = e.minPointSize, h = e.cx, g = e.cy, _ = e.angleAxisTicks, v = e.cells, y = e.startAngle, b = e.endAngle;
	return _ == null || l == null ? Yn : (t ?? []).map((e, t) => {
		var x = typeof e == "object" && e ? Dt(e, ["id"]) : e, S, C, w, T, E, D;
		if (n ? S = Jt(n[r + t], i) : (S = vt(e, a), Array.isArray(S) || (S = [o, S])), s === "radial") {
			T = f.scale.map(S[0]) ?? y;
			var ee = f.scale.map(S[1]);
			if (E = ee ?? T, C = st({
				axis: c,
				ticks: l,
				bandSize: u,
				offset: d.offset,
				entry: e,
				index: t
			}), C != null && E != null && T != null) {
				w = C + d.size;
				var O = E - T;
				if (ee != null && Math.abs(m) > 0 && Math.abs(O) < Math.abs(m)) {
					var k = Tt(O || m) * (Math.abs(m) - Math.abs(O));
					E += k, O = E - T;
				}
				if (Math.abs(p) > 0 && O !== 0 && Math.abs(O) < Math.abs(p)) {
					var A = Tt(O) * (Math.abs(p) - Math.abs(O));
					E += A;
				}
				D = { background: {
					cx: h,
					cy: g,
					innerRadius: C,
					outerRadius: w,
					startAngle: y,
					endAngle: b
				} };
			}
		} else if (C = c.scale.map(S[0]), w = c.scale.map(S[1]), T = st({
			axis: f,
			ticks: _,
			bandSize: u,
			offset: d.offset,
			entry: e,
			index: t
		}), C != null && w != null && T != null) {
			E = T + d.size;
			var j = w - C;
			if (Math.abs(m) > 0 && Math.abs(j) < Math.abs(m)) {
				var M = Tt(j || m) * (Math.abs(m) - Math.abs(j));
				w += M;
			}
		}
		return ln(K(K(K({}, x), D), {}, {
			payload: e,
			value: n ? S : S[1],
			cx: h,
			cy: g,
			innerRadius: C,
			outerRadius: w,
			startAngle: T,
			endAngle: E
		}, v && v[t] && v[t].props), e);
	});
}
function cr(e) {
	var t = Gt(e.fill), n = t.color, r = t.fillObject, i = K(K({}, e), {}, { fill: n }), a = Qt({
		dataKey: i.dataKey,
		angleAxisId: i.angleAxisId ?? q.angleAxisId,
		radiusAxisId: i.radiusAxisId ?? q.radiusAxisId
	}), o = $t(a, i), s = en(a, i), c = r ?? s, l = on(o), u = cn(i), d = sn(o, i), f = Zt(o, i, void 0), p = At(K(K({}, i), {}, { dataKey: a }), q), m = i.fill ?? f?.fill, h = i.stroke ?? f?.stroke, g = i.strokeWidth ?? f?.strokeWidth, _ = i.strokeOpacity ?? f?.strokeOpacity, v = i.strokeDasharray ?? f?.strokeDasharray, y = i.fillOpacity ?? f?.fillOpacity, b = {};
	return m !== void 0 && (b.fill = m), h !== void 0 && (b.stroke = h), g !== void 0 && (b.strokeWidth = g), _ !== void 0 && (b.strokeOpacity = _), v !== void 0 && (b.strokeDasharray = v), y !== void 0 && (b.fillOpacity = y), /*#__PURE__*/ V.createElement(Ge, {
		id: p.id,
		type: "radialBar"
	}, (e) => /*#__PURE__*/ V.createElement(V.Fragment, null, /*#__PURE__*/ V.createElement(Ke, {
		type: "radialBar",
		id: e,
		data: void 0,
		dataKey: p.dataKey,
		hide: p.hide ?? q.hide,
		angleAxisId: p.angleAxisId ?? q.angleAxisId,
		radiusAxisId: p.radiusAxisId ?? q.radiusAxisId,
		stackId: ht(p.stackId),
		barSize: p.barSize,
		minAngle: p.minAngle,
		minPointSize: p.minPointSize,
		maxBarSize: p.maxBarSize
	}), /*#__PURE__*/ V.createElement(tr, {
		legendType: p.legendType,
		fill: b.fill,
		stroke: b.stroke,
		unthemedColors: u,
		fillObject: c
	}, p.children), /*#__PURE__*/ V.createElement(Re, { value: l }, /*#__PURE__*/ V.createElement(or, G({}, p, b, {
		id: e,
		fillObject: c,
		unthemedColors: u,
		themedActiveStyles: d
	})))));
}
cr.displayName = "RadialBar";
// node_modules/recharts/es6/chart/RadialBarChart.js
function lr(e, t) {
	var n = Object.keys(e);
	if (Object.getOwnPropertySymbols) {
		var r = Object.getOwnPropertySymbols(e);
		t && (r = r.filter(function(t) {
			return Object.getOwnPropertyDescriptor(e, t).enumerable;
		})), n.push.apply(n, r);
	}
	return n;
}
function ur(e) {
	for (var t = 1; t < arguments.length; t++) {
		var n = arguments[t] == null ? {} : arguments[t];
		t % 2 ? lr(Object(n), !0).forEach(function(t) {
			dr(e, t, n[t]);
		}) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(n)) : lr(Object(n)).forEach(function(t) {
			Object.defineProperty(e, t, Object.getOwnPropertyDescriptor(n, t));
		});
	}
	return e;
}
function dr(e, t, n) {
	return (t = fr(t)) in e ? Object.defineProperty(e, t, {
		value: n,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[t] = n, e;
}
function fr(e) {
	var t = pr(e, "string");
	return typeof t == "symbol" ? t : t + "";
}
function pr(e, t) {
	if (typeof e != "object" || !e) return e;
	var n = e[Symbol.toPrimitive];
	if (n !== void 0) {
		var r = n.call(e, t || "default");
		if (typeof r != "object") return r;
		throw TypeError("@@toPrimitive must return a primitive value.");
	}
	return (t === "string" ? String : Number)(e);
}
var mr = ["axis", "item"], hr = ur(ur({}, rt), {}, {
	layout: "radial",
	startAngle: 0,
	endAngle: 360
}), gr = /*#__PURE__*/ (0, V.forwardRef)((e, t) => {
	var n = At(e, hr);
	return /*#__PURE__*/ V.createElement(Ue, {
		chartName: "RadialBarChart",
		defaultTooltipEventType: "axis",
		validateTooltipEventTypes: mr,
		tooltipPayloadSearcher: Qe,
		categoricalChartProps: n,
		ref: t
	});
}), J = de(), _r = "30%", vr = "100%", yr = 5, br = 14, xr = 5, Sr = 1500, Cr = (0, V.createContext)(null);
function wr() {
	let e = (0, V.use)(Cr);
	if (!e) throw Error("Radial chart parts (<RadialBar />, <Tooltip />, …) must be used within <EvilRadialChart />");
	return e;
}
function Y({ config: e, data: t, nameKey: n, children: r, className: i, chartProps: a, variant: o = "full", max: s, innerRadius: c = _r, outerRadius: l = vr, defaultSelectedDataKey: u = null, onSelectionChange: d, isLoading: f = !1, backgroundVariant: p }) {
	let m = (0, V.useId)().replace(/:/g, ""), [h, g] = (0, V.useState)(u), _ = jr(f), v = Or(o), y = (0, V.useCallback)((e, t) => {
		g(e), d?.(e === null ? null : {
			dataKey: e,
			value: t ?? 0
		});
	}, [d]), b = (0, V.useMemo)(() => t.map((e) => ({
		...e,
		fill: `url(#${m}-radial-colors-${e[n]})`
	})), [
		t,
		n,
		m
	]), x = (0, V.useMemo)(() => ({
		config: e,
		nameKey: n,
		chartId: m,
		isLoading: f,
		selectedBar: h,
		selectBar: y
	}), [
		e,
		n,
		m,
		f,
		h,
		y
	]);
	return /* @__PURE__ */ (0, J.jsx)(Cr, {
		value: x,
		children: /* @__PURE__ */ (0, J.jsxs)(Ae, {
			className: i,
			config: e,
			children: [/* @__PURE__ */ (0, J.jsx)(He, { isLoading: f }), /* @__PURE__ */ (0, J.jsxs)(gr, {
				id: m,
				data: f ? _ : b,
				innerRadius: c,
				outerRadius: l,
				startAngle: v.startAngle,
				endAngle: v.endAngle,
				cx: v.cx,
				cy: v.cy,
				...a,
				children: [
					s != null && s > 0 && /* @__PURE__ */ (0, J.jsx)(xe, {
						type: "number",
						domain: [0, s],
						tick: !1,
						axisLine: !1
					}),
					p && /* @__PURE__ */ (0, J.jsx)(ke, { variant: p }),
					r,
					f && /* @__PURE__ */ (0, J.jsx)(Mr, {}),
					/* @__PURE__ */ (0, J.jsx)("defs", { children: /* @__PURE__ */ (0, J.jsx)(kr, {
						config: e,
						chartId: m
					}) })
				]
			})]
		})
	});
}
function Tr({ dataKey: e, cornerRadius: t = yr, barSize: n = br, showBackground: r = !0, isClickable: i = !1, radialBarProps: a }) {
	let { nameKey: o, isLoading: s, selectedBar: c, selectBar: l } = wr();
	return s ? null : /* @__PURE__ */ (0, J.jsx)(cr, {
		dataKey: e,
		cornerRadius: t,
		barSize: n,
		background: r,
		className: "drop-shadow-sm",
		style: i ? { cursor: "pointer" } : void 0,
		onClick: (t, n) => {
			if (!i) return;
			let r = t, a = r?.[o] ?? String(n), s = Number(r?.[e] ?? 0);
			l(c === a ? null : a, s);
		},
		shape: (e) => {
			let t = e[o], n = c === null || c === t;
			return /* @__PURE__ */ (0, J.jsx)(L, {
				...e,
				opacity: i && !n ? .15 : 1,
				className: "transition-opacity duration-200"
			});
		},
		...a
	});
}
function Er({ variant: e, roundness: t, defaultIndex: n }) {
	let { nameKey: r, isLoading: i } = wr();
	return i ? null : /* @__PURE__ */ (0, J.jsx)(Fe, {
		defaultIndex: n,
		cursor: !1,
		content: /* @__PURE__ */ (0, J.jsx)(Ie, {
			nameKey: r,
			hideLabel: !0,
			roundness: t,
			variant: e
		})
	});
}
function Dr({ variant: e, align: t = "center", verticalAlign: n = "bottom", isClickable: r = !1 }) {
	let { nameKey: i, isLoading: a, selectedBar: o, selectBar: s } = wr();
	return a ? null : /* @__PURE__ */ (0, J.jsx)(Me, {
		verticalAlign: n,
		align: t,
		content: /* @__PURE__ */ (0, J.jsx)(Ne, {
			selected: o,
			onSelectChange: s,
			isClickable: r,
			nameKey: i,
			variant: e
		})
	});
}
function Or(e) {
	switch (e) {
		case "semi": return {
			startAngle: 180,
			endAngle: 0,
			cx: "50%",
			cy: "70%"
		};
		default: return {
			startAngle: 90,
			endAngle: -270,
			cx: "50%",
			cy: "50%"
		};
	}
}
var kr = ({ config: e, chartId: t }) => /* @__PURE__ */ (0, J.jsx)(J.Fragment, { children: Object.entries(e).map(([e, n]) => {
	let r = ct(n);
	return /* @__PURE__ */ (0, J.jsx)("linearGradient", {
		id: `${t}-radial-colors-${e}`,
		x1: "0",
		y1: "0",
		x2: "1",
		y2: "1",
		children: r === 1 ? /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [/* @__PURE__ */ (0, J.jsx)("stop", {
			offset: "0%",
			stopColor: `var(--color-${e}-0)`
		}), /* @__PURE__ */ (0, J.jsx)("stop", {
			offset: "100%",
			stopColor: `var(--color-${e}-0)`
		})] }) : Array.from({ length: r }, (t, n) => {
			let i = `${n / (r - 1) * 100}%`;
			return /* @__PURE__ */ (0, J.jsx)("stop", {
				offset: i,
				stopColor: `var(--color-${e}-${n}, var(--color-${e}-0))`
			}, i);
		})
	}, `${t}-radial-colors-${e}`);
}) });
function Ar() {
	return Array.from({ length: xr }, (e, t) => ({
		name: `loading${t}`,
		value: 40 + Math.random() * 60
	}));
}
function jr(e) {
	let [t, n] = (0, V.useState)(0);
	return (0, V.useEffect)(() => {
		if (!e) return;
		let t = setInterval(() => {
			n((e) => e + 1);
		}, Sr);
		return () => clearInterval(t);
	}, [e]), (0, V.useMemo)(() => Ar(), [t]);
}
var Mr = () => /* @__PURE__ */ (0, J.jsx)(cr, {
	dataKey: "value",
	cornerRadius: yr,
	barSize: br,
	background: !0,
	isAnimationActive: !0,
	animationDuration: Sr,
	animationEasing: "ease-in-out",
	shape: (e) => /* @__PURE__ */ (0, J.jsx)(L, {
		...e,
		fill: "currentColor",
		fillOpacity: .25
	})
});
Y.RadialBar = Tr, Y.Tooltip = Er, Y.Legend = Dr;
// src/react/stats/radial-card.tsx
var Nr = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
	"bg-chart-6"
], Pr = [
	"aria-pressed:bg-chart-1/10 aria-pressed:ring-chart-1",
	"aria-pressed:bg-chart-2/10 aria-pressed:ring-chart-2",
	"aria-pressed:bg-chart-3/10 aria-pressed:ring-chart-3",
	"aria-pressed:bg-chart-4/10 aria-pressed:ring-chart-4",
	"aria-pressed:bg-chart-5/10 aria-pressed:ring-chart-5",
	"aria-pressed:bg-chart-6/10 aria-pressed:ring-chart-6"
];
function Fr({ title: e, rows: t, empty: n, unit: r = (e) => N("manage:radialCard.videoUnit", { count: e }) }) {
	let [i, a] = (0, V.useState)(-1), [o, s] = (0, V.useState)(-1), c = ce(t);
	if (!c.length) return /* @__PURE__ */ (0, J.jsx)(je, {
		title: e,
		children: n
	});
	let l = o >= 0 ? o : i, u = c.reduce((e, t) => e + t.value, 0), d = c[l], f = (e) => a((t) => t === e ? -1 : e), p = se(c.map((e) => e.value)), m = c.map((e, t) => ({
		slice: Wt(t),
		count: e.value,
		arc: ae(e.value, p)
	}));
	return /* @__PURE__ */ (0, J.jsxs)("section", {
		className: Ee,
		children: [
			/* @__PURE__ */ (0, J.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-x-4 gap-y-1",
				children: [/* @__PURE__ */ (0, J.jsxs)("span", {
					className: "flex min-w-0 flex-col gap-1",
					children: [/* @__PURE__ */ (0, J.jsxs)("h3", {
						className: "flex items-center gap-1.5 text-title-2-medium wrap-anywhere text-text-primary",
						children: [d?.mark ? /* @__PURE__ */ (0, J.jsx)(g, { mark: d.mark }) : null, d ? d.name : e]
					}), /* @__PURE__ */ (0, J.jsx)("b", {
						className: "text-display-4-medium tabular-nums text-text-primary",
						children: (d ? d.value : u).toLocaleString()
					})]
				}), /* @__PURE__ */ (0, J.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: r(d ? d.value : u)
				})]
			}),
			/* @__PURE__ */ (0, J.jsx)("div", {
				role: "img",
				"aria-label": e,
				onPointerLeave: () => s(-1),
				children: /* @__PURE__ */ (0, J.jsxs)(Y, {
					data: m,
					nameKey: "slice",
					config: Ut(c.map((e) => e.name)),
					max: p,
					innerRadius: "22%",
					className: "aspect-auto h-75 max-sm:h-65",
					children: [/* @__PURE__ */ (0, J.jsx)(Y.RadialBar, {
						dataKey: "arc",
						barSize: oe(c.length),
						radialBarProps: {
							shape: (e) => /* @__PURE__ */ (0, J.jsx)(L, {
								...e,
								opacity: l >= 0 && l !== e.index ? .3 : 1,
								className: "cursor-pointer transition-opacity duration-200"
							}),
							onClick: (e, t) => f(t),
							onMouseEnter: (e, t) => s(t)
						}
					}), /* @__PURE__ */ (0, J.jsx)(Pe, {
						nameKey: "slice",
						valueKey: "count",
						hideLabel: !0
					})]
				})
			}),
			/* @__PURE__ */ (0, J.jsx)("div", {
				className: "inline-grid w-full grid-cols-3 gap-2 max-sm:grid-cols-2",
				children: c.map((e, t) => /* @__PURE__ */ (0, J.jsxs)("button", {
					type: "button",
					"aria-pressed": i === t,
					onClick: () => f(t),
					onPointerEnter: () => s(t),
					onPointerLeave: () => s(-1),
					onFocus: () => s(t),
					onBlur: () => s(-1),
					className: `flex min-w-0 cursor-pointer flex-col items-start gap-1 rounded-xl bg-background-tertiary-default p-2.5 text-left outline-none aria-pressed:ring-1 aria-pressed:ring-inset focus-visible:ring-2 focus-visible:ring-border-focus-ring ${Pr[t % 6]}`,
					children: [
						/* @__PURE__ */ (0, J.jsxs)("span", {
							className: "flex min-w-0 max-w-full items-start gap-1.5 text-caption-1-regular text-text-secondary",
							children: [/* @__PURE__ */ (0, J.jsx)("i", {
								"aria-hidden": !0,
								className: `mt-0.5 size-3 shrink-0 rounded-sm ${Nr[t % 6]}`
							}), /* @__PURE__ */ (0, J.jsxs)("span", {
								className: "inline-flex min-w-0 items-start gap-1.5 wrap-anywhere",
								children: [e.mark ? /* @__PURE__ */ (0, J.jsx)(g, { mark: e.mark }) : null, e.name]
							})]
						}),
						/* @__PURE__ */ (0, J.jsx)("b", {
							className: "text-title-2-medium tabular-nums text-text-primary",
							children: e.value.toLocaleString()
						}),
						e.bytes == null ? null : /* @__PURE__ */ (0, J.jsx)("small", {
							className: "text-caption-1-regular text-text-secondary",
							children: k(e.bytes)
						})
					]
				}, Wt(t)))
			})
		]
	});
}
// src/react/stats/stats-page.tsx
var Ir = pe("library"), Lr = 10, Rr = De[5], zr = De[4], Br = `${w()} flex flex-col gap-4`, Vr = (e) => N("manage:radialCard.videoUnit", { count: e }), Hr = (e) => N("manage:stats.viewingUnit", { count: e }), X = N("manage:stats.noVideoHint"), Ur = N("manage:stats.noTagHint"), Wr = N("manage:stats.noWatchHint"), Gr = N("manage:stats.noTagSourceHint"), Kr = N("manage:stats.noVolumeHint"), qr = N("manage:stats.noLibraryHint"), Jr = N("manage:stats.noLengthHint"), Yr = N("manage:stats.noQualityHint"), Xr = N("manage:stats.noPlayTimeHint"), Zr = N("manage:stats.noReplayHint"), Qr = (e, t) => Math.min(Math.max(e, 0), t);
function Z({ term: e, value: t }) {
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "flex min-h-16 min-w-0 flex-col gap-1.5 rounded-2lg bg-background-primary-default p-3",
		children: [/* @__PURE__ */ (0, J.jsx)("span", {
			className: "text-caption-1-regular text-text-secondary",
			children: e
		}), /* @__PURE__ */ (0, J.jsx)("b", {
			className: "text-title-3-medium tabular-nums text-text-primary",
			children: O(t)
		})]
	});
}
function Q({ term: e, value: t, total: n }) {
	let r = Math.max(n, 1);
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "flex flex-col gap-1.5 border-b border-separator-border py-3 last:border-b-0",
		children: [/* @__PURE__ */ (0, J.jsxs)("p", {
			className: "flex items-baseline justify-between gap-3 text-body-2-regular text-text-primary",
			children: [/* @__PURE__ */ (0, J.jsx)("span", { children: e }), /* @__PURE__ */ (0, J.jsxs)("b", {
				className: "tabular-nums",
				children: [O(t), A(t) ? /* @__PURE__ */ (0, J.jsx)("span", {
					className: "ml-1.5 text-caption-1-regular text-text-secondary",
					children: ne(t, n)
				}) : null]
			})]
		}), /* @__PURE__ */ (0, J.jsx)(u, {
			meter: !0,
			label: N("manage:shared.termProgress", {
				term: e,
				value: O(t),
				total: n.toLocaleString()
			}),
			value: A(t) ? Qr(t, r) : 0,
			max: r
		})]
	});
}
function $r({ term: e, figure: t, unit: n }) {
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "flex shrink-0 flex-col gap-0.5 pb-5 md:w-64 md:pr-6 md:pb-0",
		children: [
			/* @__PURE__ */ (0, J.jsx)("span", {
				className: "text-caption-1-regular text-text-secondary",
				children: e
			}),
			/* @__PURE__ */ (0, J.jsx)("b", {
				className: "text-display-4-medium tabular-nums text-text-primary",
				children: t
			}),
			/* @__PURE__ */ (0, J.jsx)("span", {
				className: "text-body-2-regular text-text-secondary",
				children: n
			})
		]
	});
}
function ei({ headline: e, children: t }) {
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		className: `${Br} md:flex-row md:gap-6`,
		children: [e, /* @__PURE__ */ (0, J.jsx)("div", {
			className: "min-w-0 grow",
			children: t
		})]
	});
}
function ti({ data: e }) {
	return e.by_loc.reduce((e, t) => e + t.videos, 0) ? /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [/* @__PURE__ */ (0, J.jsxs)("div", {
			className: "inline-grid w-full gap-5 md:grid-cols-2",
			children: [/* @__PURE__ */ (0, J.jsx)(Fr, {
				title: N("manage:stats.cloudAndLocal"),
				empty: X,
				rows: e.by_loc.map((e) => ({
					name: o[e.k] ?? e.k,
					value: e.videos,
					bytes: e.bytes,
					mark: s[e.k] || "database"
				}))
			}), /* @__PURE__ */ (0, J.jsx)(Fr, {
				title: N("manage:shared.library"),
				empty: qr,
				rows: e.by_library.map((e) => ({
					name: e.name,
					value: e.videos,
					bytes: e.bytes,
					mark: s[e.icon] || e.icon || "database"
				}))
			})]
		}), /* @__PURE__ */ (0, J.jsxs)("div", {
			className: "inline-grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3",
			children: [
				/* @__PURE__ */ (0, J.jsx)(P, {
					title: N("manage:shared.duration"),
					unit: Vr,
					series: N("manage:processingTraffic.sourceVideos"),
					color: Rr,
					rows: j(e.by_length),
					empty: Jr
				}),
				/* @__PURE__ */ (0, J.jsx)(P, {
					title: N("manage:shared.quality"),
					unit: Vr,
					series: N("manage:processingTraffic.sourceVideos"),
					color: Rr,
					rows: C(e.by_quality),
					empty: Yr
				}),
				/* @__PURE__ */ (0, J.jsx)(P, {
					title: N("manage:stats.fileTypes"),
					unit: (e) => N("manage:stats.itemsUnit", { count: e }),
					series: N("manage:stats.itemsSeries"),
					color: Rr,
					layout: "horizontal",
					rows: te(e.by_medium),
					empty: X
				})
			]
		})]
	}) : /* @__PURE__ */ (0, J.jsx)(a, {
		icon: c,
		title: N("manage:stats.noVideosTitle"),
		actions: /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [/* @__PURE__ */ (0, J.jsx)(i, {
			variant: "secondary",
			href: "/subscriptions?tab=add",
			size: "small",
			children: N("manage:stats.newFollow")
		}), /* @__PURE__ */ (0, J.jsx)(i, {
			variant: "primary",
			href: Ir,
			size: "small",
			children: N("manage:shared.addMedia")
		})] }),
		children: X
	});
}
function ni({ data: e }) {
	return /* @__PURE__ */ (0, J.jsxs)(J.Fragment, { children: [/* @__PURE__ */ (0, J.jsx)(ye, {
		activity: e.play_activity,
		title: N("manage:stats.playTimes"),
		dailyTitle: N("manage:stats.dailyPlays"),
		words: {
			unit: Hr,
			series: N("manage:shared.video"),
			cell: (e) => N("manage:stats.viewingCell", { count: e })
		},
		tone: 5,
		empty: Xr
	}), /* @__PURE__ */ (0, J.jsx)(P, {
		title: N("manage:stats.plays"),
		unit: Hr,
		series: N("manage:shared.video"),
		color: zr,
		rows: ue(e.replays),
		empty: Zr
	})] });
}
function ri({ attribution: e }) {
	let t = e.videos;
	return /* @__PURE__ */ (0, J.jsxs)("div", {
		className: "flex flex-col",
		children: [
			/* @__PURE__ */ (0, J.jsx)(Q, {
				term: N("manage:stats.hasCreator"),
				value: e.creator,
				total: t
			}),
			/* @__PURE__ */ (0, J.jsx)(Q, {
				term: N("manage:stats.hasCode"),
				value: e.code,
				total: t
			}),
			/* @__PURE__ */ (0, J.jsx)(Q, {
				term: N("manage:stats.hasLabel"),
				value: e.studio,
				total: t
			}),
			/* @__PURE__ */ (0, J.jsx)(Q, {
				term: N("manage:stats.framesExtracted"),
				value: e.thumb,
				total: t
			}),
			/* @__PURE__ */ (0, J.jsx)(Q, {
				term: N("manage:stats.durationProbed"),
				value: e.duration,
				total: t
			})
		]
	});
}
function ii({ volume: e }) {
	let t = e.total, n = e.used ?? 0, r = E(e, "label");
	return /* @__PURE__ */ (0, J.jsxs)("article", {
		className: "flex min-w-0 flex-col gap-1.5 border-b border-separator-border py-3 last:border-b-0",
		children: [
			/* @__PURE__ */ (0, J.jsxs)("header", {
				className: "flex items-baseline justify-between gap-3 text-body-2-regular text-text-primary",
				children: [/* @__PURE__ */ (0, J.jsx)("h3", {
					className: "min-w-0 break-words",
					children: r
				}), t == null ? e.online ? /* @__PURE__ */ (0, J.jsx)(v, { children: N("manage:stats.capacityNotFound") }) : /* @__PURE__ */ (0, J.jsx)(un, { online: !1 }) : /* @__PURE__ */ (0, J.jsxs)("b", {
					className: "whitespace-nowrap tabular-nums",
					children: [k(n), /* @__PURE__ */ (0, J.jsx)("span", {
						className: "ml-1.5 text-caption-1-regular text-text-secondary",
						children: ne(n, t)
					})]
				})]
			}),
			t == null ? null : /* @__PURE__ */ (0, J.jsx)(u, {
				meter: !0,
				label: N("manage:stats.volumeUsage", { volume: r }),
				value: Qr(n, Math.max(t, 1)),
				max: Math.max(t, 1)
			}),
			/* @__PURE__ */ (0, J.jsxs)("p", {
				className: "flex justify-between gap-3 text-caption-1-regular text-text-secondary",
				children: [/* @__PURE__ */ (0, J.jsx)("span", {
					className: "min-w-0 break-words",
					children: e.root ?? N("manage:stats.notMapped")
				}), t == null ? null : /* @__PURE__ */ (0, J.jsx)("span", {
					className: "whitespace-nowrap tabular-nums",
					children: N("manage:stats.volumeFreeTotal", {
						free: k(e.free ?? 0),
						total: k(t)
					})
				})]
			})
		]
	});
}
function ai({ volumes: e }) {
	return e.length ? /* @__PURE__ */ (0, J.jsx)("div", {
		className: "flex flex-col",
		children: e.map((e) => /* @__PURE__ */ (0, J.jsx)(ii, { volume: e }, `${e.kind}:${e.label}`))
	}) : /* @__PURE__ */ (0, J.jsx)(a, {
		icon: y,
		title: N("manage:stats.noStorageTitle"),
		actions: /* @__PURE__ */ (0, J.jsx)(i, {
			variant: "primary",
			href: Ir,
			size: "small",
			children: N("manage:shared.addMedia")
		}),
		children: Kr
	});
}
function oi({ tags: e, tagLabel: t, onTag: n, hasMedia: r }) {
	return e.length ? /* @__PURE__ */ (0, J.jsx)(be, {
		previewCount: Lr,
		className: "inline-grid w-full gap-x-6 gap-y-1 sm:grid-cols-2",
		children: e.map((e, r) => /* @__PURE__ */ (0, J.jsx)("li", {
			className: "min-w-0",
			children: /* @__PURE__ */ (0, J.jsxs)("button", {
				type: "button",
				onClick: () => n(e.k),
				className: "flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
				children: [
					/* @__PURE__ */ (0, J.jsx)("span", {
						className: "w-6 shrink-0 text-caption-1-regular tabular-nums text-text-secondary",
						children: r + 1
					}),
					/* @__PURE__ */ (0, J.jsx)("span", {
						className: "min-w-0 grow text-body-2-regular break-words text-text-primary",
						children: t(e.k)
					}),
					/* @__PURE__ */ (0, J.jsx)("b", {
						className: "text-body-2-medium tabular-nums text-text-secondary",
						children: e.n.toLocaleString()
					})
				]
			})
		}, `${e.k}:${r}`))
	}) : /* @__PURE__ */ (0, J.jsx)(a, {
		icon: M,
		title: N("manage:stats.noContentTagsTitle"),
		actions: /* @__PURE__ */ (0, J.jsx)(i, {
			variant: "secondary",
			href: r ? "/data-cleanup" : "/settings/library",
			size: "small",
			children: N(r ? "manage:shared.fillInMetadata" : "manage:shared.addMedia")
		}),
		children: Ur
	});
}
function si({ rows: e, hasMedia: t }) {
	return e.length ? /* @__PURE__ */ (0, J.jsx)("div", {
		className: "flex flex-col gap-5",
		children: e.map((e) => {
			let t = ve(e);
			return /* @__PURE__ */ (0, J.jsxs)("article", {
				className: "flex flex-wrap items-center gap-x-6 gap-y-2",
				children: [/* @__PURE__ */ (0, J.jsxs)("div", {
					className: "min-w-0 grow basis-64",
					children: [/* @__PURE__ */ (0, J.jsx)("h3", {
						className: "min-w-0 text-body-2-medium text-text-primary",
						children: /* @__PURE__ */ (0, J.jsx)("a", {
							href: ie(e),
							"data-middle-truncate": !0,
							className: "block max-w-full overflow-hidden whitespace-nowrap hover:underline",
							children: e.name
						})
					}), /* @__PURE__ */ (0, J.jsxs)("p", {
						className: "flex flex-wrap gap-3 text-caption-1-regular text-text-secondary",
						children: [e.creator ? /* @__PURE__ */ (0, J.jsx)("span", {
							className: "min-w-0 wrap-anywhere",
							children: e.creator
						}) : null, /* @__PURE__ */ (0, J.jsx)("span", { children: _e(e) })]
					})]
				}), /* @__PURE__ */ (0, J.jsxs)("div", {
					className: "min-w-0 basis-40",
					children: [/* @__PURE__ */ (0, J.jsx)(u, {
						meter: !0,
						label: N("manage:stats.watchedShare", { percent: t.toFixed(0) }),
						value: t
					}), /* @__PURE__ */ (0, J.jsx)("small", {
						className: "mt-1.5 block text-caption-1-regular text-text-secondary",
						children: N("manage:stats.watchedReached", {
							watched: t.toFixed(0),
							reached: le(e).toFixed(0)
						})
					})]
				})]
			}, `${e.kind}:${e.id}`);
		})
	}) : /* @__PURE__ */ (0, J.jsx)(a, {
		icon: he,
		title: N("manage:stats.noWatchHistoryTitle"),
		actions: /* @__PURE__ */ (0, J.jsx)(i, {
			variant: "secondary",
			href: t ? "/" : "/settings/library",
			size: "small",
			children: N(t ? "manage:shared.browseCollection" : "manage:shared.addMedia")
		}),
		children: Wr
	});
}
function ci({ sources: e, videos: t }) {
	return e.length ? /* @__PURE__ */ (0, J.jsx)("div", {
		className: "inline-grid w-full gap-x-8 gap-y-6 sm:grid-cols-2",
		children: e.map((e) => /* @__PURE__ */ (0, J.jsxs)("article", {
			className: "flex min-w-0 flex-col gap-1.5",
			children: [
				/* @__PURE__ */ (0, J.jsxs)("header", {
					className: "flex items-baseline justify-between gap-3",
					children: [/* @__PURE__ */ (0, J.jsx)("h3", {
						className: "min-w-0 text-body-2-medium break-words text-text-primary",
						children: e.k
					}), /* @__PURE__ */ (0, J.jsxs)("b", {
						className: "text-body-2-medium whitespace-nowrap text-text-primary",
						children: [e.assets.toLocaleString(), /* @__PURE__ */ (0, J.jsx)("small", {
							className: "ml-1 text-caption-1-regular font-normal text-text-secondary",
							children: Vr(e.assets)
						})]
					})]
				}),
				/* @__PURE__ */ (0, J.jsx)(u, {
					meter: !0,
					label: N("manage:stats.tagSourceCoverage", { source: e.k }),
					value: Qr(e.assets, Math.max(t, 1)),
					max: Math.max(t, 1)
				}),
				/* @__PURE__ */ (0, J.jsx)("small", {
					className: "text-caption-1-regular text-text-secondary",
					children: N("manage:stats.tagsCount", { count: e.n })
				})
			]
		}, e.k))
	}) : /* @__PURE__ */ (0, J.jsx)(a, {
		icon: M,
		title: N("manage:stats.noTagSourcesTitle"),
		actions: /* @__PURE__ */ (0, J.jsx)(i, {
			variant: "secondary",
			href: t ? "/data-cleanup" : "/settings/library",
			size: "small",
			children: N(t ? "manage:shared.fillInMetadata" : "manage:shared.addMedia")
		}),
		children: Gr
	});
}
function $({ id: e, label: n, figure: r, detail: i, icon: a, accent: o }) {
	return /* @__PURE__ */ (0, J.jsx)(t, {
		id: e,
		className: me({
			interactive: !0,
			selectable: !0
		}),
		children: /* @__PURE__ */ (0, J.jsx)(_, {
			label: n,
			icon: a,
			accent: o,
			figure: r,
			footer: i
		})
	});
}
function li(i) {
	let a = ge({
		queryKey: p,
		queryFn: ({ signal: e }) => ee(e)
	}), o = a.data;
	if (!o) return /* @__PURE__ */ (0, J.jsx)(dn, { children: /* @__PURE__ */ (0, J.jsx)(l, {
		tone: "error",
		title: N("manage:stats.loadFailedTitle"),
		children: a.error ? D(a.error) : N("manage:stats.loadFailedHint")
	}) });
	let s = o.consumption, c = o.storage_summary, u = o.by_loc.reduce((e, t) => e + t.videos, 0), g = o.by_loc.reduce((e, t) => e + t.bytes, 0), _ = A(o.tag_cov) ? ne(o.tag_cov, o.attribution.videos) : N("manage:shared.notFound"), v = `${O(o.tag_cov)} / ${o.attribution.videos.toLocaleString()}`;
	return /* @__PURE__ */ (0, J.jsxs)(dn, { children: [/* @__PURE__ */ (0, J.jsxs)(n, {
		defaultSelectedKey: "inventory",
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, J.jsxs)(r, {
				"aria-label": N("manage:stats.viewsLabel"),
				className: m,
				children: [
					/* @__PURE__ */ (0, J.jsx)($, {
						id: "inventory",
						label: N("manage:statsSkeleton.collection"),
						icon: x,
						accent: 0,
						figure: u.toLocaleString(),
						detail: k(g)
					}),
					/* @__PURE__ */ (0, J.jsx)($, {
						id: "viewing",
						label: N("manage:shared.watched"),
						icon: b,
						accent: 1,
						figure: O(s.played),
						detail: re(s.play_seconds)
					}),
					/* @__PURE__ */ (0, J.jsx)($, {
						id: "coverage",
						label: N("manage:statsSkeleton.contentTags"),
						icon: M,
						accent: 2,
						figure: _,
						detail: v
					}),
					/* @__PURE__ */ (0, J.jsx)($, {
						id: "storage",
						label: N("manage:statsSkeleton.spaceUsed"),
						icon: y,
						accent: 3,
						figure: N("manage:stats.volumeCount", { count: c.online }),
						detail: c.measured ? N("manage:stats.usedSize", { size: k(c.used) }) : N("manage:stats.capacityNotFound")
					})
				]
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "inventory",
				children: /* @__PURE__ */ (0, J.jsx)(ti, {
					data: o,
					...i
				})
			}),
			/* @__PURE__ */ (0, J.jsxs)(e, {
				id: "viewing",
				className: "flex flex-col gap-5",
				children: [/* @__PURE__ */ (0, J.jsx)(ei, {
					headline: /* @__PURE__ */ (0, J.jsx)($r, {
						term: N("manage:stats.watchedTerm"),
						figure: O(s.played),
						unit: N("manage:stats.videosWithPlays", { count: s.played ?? 0 })
					}),
					children: /* @__PURE__ */ (0, J.jsxs)("div", {
						className: "inline-grid w-full gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.watchedInCollection"),
								value: s.library_played
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.watchedOnline"),
								value: s.online_played
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.climaxCount"),
								value: s.o_total
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.skimmed"),
								value: s.skimmed
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:shared.like"),
								value: s.liked
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.disliked"),
								value: s.dislike
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:stats.seenIt"),
								value: s.seen
							}),
							/* @__PURE__ */ (0, J.jsx)(Z, {
								term: N("manage:managePages.trash"),
								value: s.trash
							})
						]
					})
				}), /* @__PURE__ */ (0, J.jsx)(ni, { data: o })]
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "coverage",
				children: /* @__PURE__ */ (0, J.jsx)(ei, {
					headline: /* @__PURE__ */ (0, J.jsx)($r, {
						term: N("manage:stats.contentTagCoverage"),
						figure: _,
						unit: v
					}),
					children: /* @__PURE__ */ (0, J.jsx)(ri, { attribution: o.attribution })
				})
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "storage",
				children: /* @__PURE__ */ (0, J.jsx)(ei, {
					headline: /* @__PURE__ */ (0, J.jsx)($r, {
						term: N("manage:statsSkeleton.spaceUsed"),
						figure: c.measured.toLocaleString(),
						unit: N("manage:stats.volumesMeasured", { count: c.measured })
					}),
					children: /* @__PURE__ */ (0, J.jsx)(ai, {
						volumes: o.storage_volumes,
						...i
					})
				})
			})
		]
	}), /* @__PURE__ */ (0, J.jsxs)(n, {
		defaultSelectedKey: "tags",
		className: `${w({ padding: "none" })} flex flex-col`,
		children: [
			/* @__PURE__ */ (0, J.jsx)("div", {
				className: "px-4 pt-3",
				children: /* @__PURE__ */ (0, J.jsxs)(h, {
					"aria-label": N("manage:stats.breakdownsLabel"),
					className: f,
					children: [
						/* @__PURE__ */ (0, J.jsx)(t, {
							id: "tags",
							className: d,
							children: N("manage:statsSkeleton.contentTags")
						}),
						/* @__PURE__ */ (0, J.jsx)(t, {
							id: "recent",
							className: d,
							children: N("manage:stats.recentlyWatched")
						}),
						/* @__PURE__ */ (0, J.jsx)(t, {
							id: "sources",
							className: d,
							children: N("manage:stats.tagSources")
						})
					]
				})
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "tags",
				className: "px-4 pt-3.5 pb-4",
				children: /* @__PURE__ */ (0, J.jsx)(oi, {
					tags: o.top_tags,
					hasMedia: u > 0,
					...i
				})
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "recent",
				className: "px-4 pt-3.5 pb-4",
				children: /* @__PURE__ */ (0, J.jsx)(si, {
					rows: o.recent,
					hasMedia: u > 0
				})
			}),
			/* @__PURE__ */ (0, J.jsx)(e, {
				id: "sources",
				className: "px-4 pt-3.5 pb-4",
				children: /* @__PURE__ */ (0, J.jsx)(ci, {
					sources: o.tag_source,
					videos: o.attribution.videos
				})
			})
		]
	})] });
}
export { li as StatsPage };

//# debugId=1886cd1e-d18d-48ff-8c79-a27558548666